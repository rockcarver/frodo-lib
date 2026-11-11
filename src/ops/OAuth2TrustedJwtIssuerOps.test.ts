/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    This step breaks down into 3 phases:
 *
 *    Phase 1: Non-destructive tests: create, read, update, export, import, and the Cloud root realm (read-only
 *             answers of the server)
 *    Phase 2: Delete by id
 *    Phase 3: Delete all issuers of the realm (leaves the realm empty)
 *
 *    Record against a non-production tenant. The tests run in the realm 'bravo' (see TEST_REALM in
 *    src/test/setup/TrustedJwtIssuerSetup.ts). THE THIRD PHASE DELETES EVERY TRUSTED JWT ISSUER OF THAT REALM:
 *    recording refuses to start (in any phase) if the realm holds an issuer whose id does not start with 'FrodoTest',
 *    so an issuer of somebody else is never deleted and its name never reaches a recording. Recording deletes every
 *    issuer whose id starts with 'FrodoTest' before and after each phase. The issuers of the tests have made-up URLs
 *    on example.com and, where they have a key set, a throw-away PUBLIC key.
 *
 *    The tests of a phase build on each other (an issuer that one test creates is read by the next), so record a phase
 *    in one run, in the order of the file.
 *
 *    To record and update snapshots, you must call the test:record script and override all the connection state
 *    variables required to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record -- src/ops/OAuth2TrustedJwtIssuerOps.test.ts
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record -- src/ops/OAuth2TrustedJwtIssuerOps.test.ts
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=3 FRODO_HOST=frodo-dev npm run test:record -- src/ops/OAuth2TrustedJwtIssuerOps.test.ts
 *
 *    The above commands assume that you have a connection profile for 'frodo-dev' on your development machine.
 *    Not recorded: ForgeOps and classic deployments (the mocked unit tests of the module cover them).
 *
 * 2. Update snapshots
 *
 *    Recording a phase with --updateSnapshot removes the snapshots of the other phases, so rewrite all of them from
 *    the recordings after the last phase:
 *
 *        FRODO_DEBUG=1 npm run test:update -- src/ops/OAuth2TrustedJwtIssuerOps.test.ts
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in replay mode and make sure they all
 *    succeed as well:
 *
 *        npm run test:only -- src/ops/OAuth2TrustedJwtIssuerOps.test.ts
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output in case things don't function as
 * expected
 */
import { state } from '../index';
import { summarizeError } from '../test/setup/ErrorSummary';
import * as TestData from '../test/setup/TrustedJwtIssuerSetup';
import { FrodoError } from './FrodoError';
import * as IssuerOps from './OAuth2TrustedJwtIssuerOps';
import {
  type OAuth2TrustedJwtIssuerExportInterface,
  type OAuth2TrustedJwtIssuerImportData,
} from './OAuth2TrustedJwtIssuerOps';

/** Run a call that must fail and hand back its error */
async function failure(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error('The call was expected to fail');
}

/** Run a call and describe what happened, whichever way it went */
async function settle<T>(
  call: Promise<T>,
  describeResult: (result: T) => unknown
) {
  try {
    return { result: describeResult(await call) };
  } catch (error) {
    return { error: summarizeError(error) };
  }
}

/** A result callback that remembers what it was told, by issuer id */
function collector<R>(describeResult: (result: R) => unknown) {
  const calls: unknown[] = [];
  const callback = (error?: FrodoError, result?: R) => {
    calls.push(
      error
        ? { error: summarizeError(error) }
        : { result: describeResult(result) }
    );
  };
  return { calls, callback };
}

/** Import data in the format of an export of issuers */
const importOf = (
  issuers: Record<string, unknown>
): OAuth2TrustedJwtIssuerExportInterface =>
  ({
    trustedJwtIssuer: issuers,
  }) as unknown as OAuth2TrustedJwtIssuerExportInterface;

/** Import data in the format of an export of agents, which holds issuers too (agent type 'TrustedJwtIssuer') */
const agentImportOf = (
  agents: Record<string, unknown>
): OAuth2TrustedJwtIssuerImportData =>
  ({ agent: agents }) as unknown as OAuth2TrustedJwtIssuerImportData;

describe('OAuth2TrustedJwtIssuerOps', () => {
  TestData.setup();

  // in recording mode, stage the realm before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      const n = Number(process.env.FRODO_RECORD_PHASE);
      if (n === 1 || n === 2 || n === 3) await TestData.stagePhase(n);
    }
  });

  // in recording mode, remove the test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      TestData.setTestRealm();
      TestData.useTestRealm();
      await TestData.removeTestIssuers();
    }
  });

  describe('Cloud Tests', () => {
    // Phase 1
    if (TestData.phase(1)) {
      describe('createOAuth2TrustedJwtIssuerExportTemplate()', () => {
        test('0: Method is implemented', async () => {
          expect(
            IssuerOps.createOAuth2TrustedJwtIssuerExportTemplate
          ).toBeDefined();
        });

        test('1: Create trusted JWT issuer export template', async () => {
          const response = IssuerOps.createOAuth2TrustedJwtIssuerExportTemplate(
            { state }
          );
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('readOAuth2TrustedJwtIssuers()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerOps.readOAuth2TrustedJwtIssuers).toBeDefined();
        });

        test('1: Read all trusted JWT issuers of a realm that has none', async () => {
          const response = await IssuerOps.readOAuth2TrustedJwtIssuers({
            state,
          });
          expect(response).toStrictEqual([]);
        });
      });

      describe('createOAuth2TrustedJwtIssuer()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerOps.createOAuth2TrustedJwtIssuer).toBeDefined();
        });

        test(`1: Create trusted JWT issuer '${TestData.ids.issuer1}' (wrapped values, key set)`, async () => {
          const response = await IssuerOps.createOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer1,
            issuerData: TestData.withJwkSet(1),
            state,
          });
          expect(response._id).toBe(TestData.ids.issuer1);
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`2: Create trusted JWT issuer '${TestData.ids.issuer2}' (plain values, key set URI)`, async () => {
          const response = await IssuerOps.createOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer2,
            issuerData: TestData.withJwksUri(2),
            state,
          });
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`3: Create trusted JWT issuer '${TestData.ids.issuer3}' (minimal body)`, async () => {
          const response = await IssuerOps.createOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer3,
            issuerData: TestData.minimal(3),
            state,
          });
          // the server completes the issuer with its defaults
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`4: Create trusted JWT issuer '${TestData.ids.issuer1}' that already exists`, async () => {
          const error = await failure(
            IssuerOps.createOAuth2TrustedJwtIssuer({
              issuerId: TestData.ids.issuer1,
              issuerData: TestData.withJwkSet(1),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('5: Create a trusted JWT issuer with an attribute the server does not know', async () => {
          const error = await failure(
            IssuerOps.createOAuth2TrustedJwtIssuer({
              issuerId: 'FrodoTestIssuerUnknown',
              issuerData: TestData.unknownAttribute(5),
              state,
            })
          );
          // the module tries again without the attributes the server names, which does not help for a plain value
          expect(
            TestData.requests.filter((request) => request.method === 'PUT')
          ).toHaveLength(2);
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('6: Create a trusted JWT issuer with a group of attributes the server does not know', async () => {
          // the module removes the members of the group before it tries again: whatever the server makes of what is left
          const outcome = await settle(
            IssuerOps.createOAuth2TrustedJwtIssuer({
              issuerId: 'FrodoTestIssuerLegacy',
              issuerData: TestData.unknownGroup(6),
              state,
            }),
            TestData.shapeOf
          );
          // the first write is refused, the second one (without the members of the group) is refused too
          expect(
            TestData.requests.filter((request) => request.method === 'PUT')
          ).toHaveLength(2);
          expect(outcome).toMatchSnapshot();
        });
      });

      describe('readOAuth2TrustedJwtIssuers() with issuers', () => {
        test('1: Read all trusted JWT issuers (plain shape)', async () => {
          const response = await IssuerOps.readOAuth2TrustedJwtIssuers({
            state,
          });
          expect(response.map(TestData.shapeOf)).toMatchSnapshot();
        });
      });

      describe('readOAuth2TrustedJwtIssuer()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerOps.readOAuth2TrustedJwtIssuer).toBeDefined();
        });

        test(`1: Read trusted JWT issuer '${TestData.ids.issuer1}'`, async () => {
          const response = await IssuerOps.readOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer1,
            state,
          });
          // the single read has the wrapped shape
          expect(response).toMatchSnapshot();
        });

        test('2: Read a trusted JWT issuer that does not exist', async () => {
          const error = await failure(
            IssuerOps.readOAuth2TrustedJwtIssuer({
              issuerId: 'FrodoTestIssuerMissing',
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });

      describe('updateOAuth2TrustedJwtIssuer()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerOps.updateOAuth2TrustedJwtIssuer).toBeDefined();
        });

        test(`1: Update trusted JWT issuer '${TestData.ids.issuer1}' (change the allowed subjects)`, async () => {
          const read = await IssuerOps.readOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer1,
            state,
          });
          const response = await IssuerOps.updateOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer1,
            issuerData: {
              ...read,
              allowedSubjects: {
                inherited: false,
                value: ['erin1@matrix.example.com'],
              },
            },
            state,
          });
          expect(response.allowedSubjects).toStrictEqual({
            inherited: false,
            value: ['erin1@matrix.example.com'],
          });
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`2: Update trusted JWT issuer '${TestData.ids.issuer2}' with a sparse body`, async () => {
          const response = await IssuerOps.updateOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer2,
            issuerData: TestData.sparse(2),
            state,
          });
          // a write replaces what is stored: only the attributes that were sent are left
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`3: Read the sparse trusted JWT issuer '${TestData.ids.issuer2}' in the list`, async () => {
          const issuers = await IssuerOps.readOAuth2TrustedJwtIssuers({
            state,
          });
          const issuer = issuers.find(
            (item) => item._id === TestData.ids.issuer2
          );
          expect(TestData.shapeOf(issuer)).toMatchSnapshot();
        });

        test(`4: Update trusted JWT issuer '${TestData.ids.upsert}' that does not exist (the server creates it)`, async () => {
          const response = await IssuerOps.updateOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.upsert,
            issuerData: TestData.minimal(4),
            state,
          });
          expect(response._id).toBe(TestData.ids.upsert);
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });
      });

      describe('exportOAuth2TrustedJwtIssuer()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerOps.exportOAuth2TrustedJwtIssuer).toBeDefined();
        });

        test(`1: Export trusted JWT issuer '${TestData.ids.issuer1}'`, async () => {
          const response = await IssuerOps.exportOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer1,
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test('2: Export a trusted JWT issuer that does not exist', async () => {
          const error = await failure(
            IssuerOps.exportOAuth2TrustedJwtIssuer({
              issuerId: 'FrodoTestIssuerMissing',
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });

      describe('exportOAuth2TrustedJwtIssuers()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerOps.exportOAuth2TrustedJwtIssuers).toBeDefined();
        });

        test('1: Export all trusted JWT issuers', async () => {
          const response = await IssuerOps.exportOAuth2TrustedJwtIssuers({
            state,
          });
          expect(response.meta).toBeDefined();
          expect(Object.keys(response.trustedJwtIssuer)).toMatchSnapshot();
          expect(
            Object.values(response.trustedJwtIssuer).map(TestData.shapeOf)
          ).toMatchSnapshot();
        });

        test('2: Export all trusted JWT issuers with a result callback', async () => {
          const { calls, callback } = collector<{ _id: string }>(
            (issuer) => issuer._id
          );
          const response = await IssuerOps.exportOAuth2TrustedJwtIssuers({
            resultCallback: callback,
            state,
          });
          expect(calls).toHaveLength(
            Object.keys(response.trustedJwtIssuer).length
          );
          expect(calls).toMatchSnapshot();
        });
      });

      describe('importOAuth2TrustedJwtIssuer()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerOps.importOAuth2TrustedJwtIssuer).toBeDefined();
        });

        test(`1: Import trusted JWT issuer '${TestData.ids.issuer1}' over the existing one`, async () => {
          const exported = await IssuerOps.exportOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer1,
            state,
          });
          const response = await IssuerOps.importOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer1,
            importData: exported,
            state,
          });
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`2: Import trusted JWT issuer as '${TestData.ids.issuer4}' (new)`, async () => {
          const exported = await IssuerOps.exportOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer1,
            state,
          });
          const response = await IssuerOps.importOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer4,
            importData: importOf({
              [TestData.ids.issuer4]: {
                ...exported.trustedJwtIssuer[TestData.ids.issuer1],
                _id: TestData.ids.issuer4,
              },
            }),
            state,
          });
          expect(response._id).toBe(TestData.ids.issuer4);
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test('3: Import a trusted JWT issuer that is not in the import data', async () => {
          const error = await failure(
            IssuerOps.importOAuth2TrustedJwtIssuer({
              issuerId: TestData.ids.issuer5,
              importData: importOf({
                [TestData.ids.issuer4]: TestData.minimal(4),
              }),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('4: Import a trusted JWT issuer with an attribute the server does not know', async () => {
          const error = await failure(
            IssuerOps.importOAuth2TrustedJwtIssuer({
              issuerId: 'FrodoTestIssuerUnknown',
              importData: importOf({
                FrodoTestIssuerUnknown: TestData.unknownAttribute(4),
              }),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });

      describe('importFirstOAuth2TrustedJwtIssuer()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerOps.importFirstOAuth2TrustedJwtIssuer).toBeDefined();
        });

        test('1: Import the first of two trusted JWT issuers', async () => {
          const response = await IssuerOps.importFirstOAuth2TrustedJwtIssuer({
            importData: importOf({
              [TestData.ids.issuer5]: TestData.withJwkSet(5),
              [TestData.ids.issuer6]: TestData.withJwkSet(6),
            }),
            state,
          });
          expect(response._id).toBe(TestData.ids.issuer5);
          // the second one is not imported
          const issuers = await IssuerOps.readOAuth2TrustedJwtIssuers({
            state,
          });
          expect(issuers.map((item) => item._id)).toContain(
            TestData.ids.issuer5
          );
          expect(issuers.map((item) => item._id)).not.toContain(
            TestData.ids.issuer6
          );
        });

        test('2: Import the first trusted JWT issuer of import data that has none', async () => {
          const error = await failure(
            IssuerOps.importFirstOAuth2TrustedJwtIssuer({
              importData: importOf({}),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });

      describe('importOAuth2TrustedJwtIssuers()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerOps.importOAuth2TrustedJwtIssuers).toBeDefined();
        });

        test('1: Import trusted JWT issuers (one exists, one is new) with a result callback', async () => {
          const exported = await IssuerOps.exportOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.issuer1,
            state,
          });
          const { calls, callback } = collector<{ _id: string }>((issuer) =>
            TestData.shapeOf(issuer)
          );
          const response = await IssuerOps.importOAuth2TrustedJwtIssuers({
            importData: importOf({
              [TestData.ids.issuer1]:
                exported.trustedJwtIssuer[TestData.ids.issuer1],
              [TestData.ids.issuer6]: TestData.withJwkSet(6),
            }),
            resultCallback: callback,
            state,
          });
          expect(response).toHaveLength(2);
          expect(calls).toMatchSnapshot();
        });

        test('2: Import trusted JWT issuers (one is refused by the server) with a result callback', async () => {
          const { calls, callback } = collector<{ _id: string }>((issuer) =>
            TestData.shapeOf(issuer)
          );
          const response = await IssuerOps.importOAuth2TrustedJwtIssuers({
            importData: importOf({
              FrodoTestIssuerUnknown: TestData.unknownAttribute(2),
              [TestData.ids.issuer7]: TestData.withJwksUri(7),
            }),
            resultCallback: callback,
            state,
          });
          // the callback tells each item as it happens, the failed item as an error that names it
          expect(response).toHaveLength(1);
          expect(calls).toMatchSnapshot();
        });

        test('3: Import trusted JWT issuers (one is refused by the server) without a result callback', async () => {
          const error = await failure(
            IssuerOps.importOAuth2TrustedJwtIssuers({
              importData: importOf({
                FrodoTestIssuerUnknown: TestData.unknownAttribute(3),
                [TestData.ids.issuer7]: TestData.withJwksUri(7),
              }),
              state,
            })
          );
          // the item that succeeded is imported, the failure is thrown at the end
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test(`4: Import trusted JWT issuer '${TestData.ids.issuer8}' from the agents of an agent export`, async () => {
          const response = await IssuerOps.importOAuth2TrustedJwtIssuers({
            importData: agentImportOf({
              [TestData.ids.issuer8]: {
                ...TestData.withJwksUri(8),
                _type: TestData.issuerType,
              },
            }),
            state,
          });
          // an issuer in the 'agent' section of an export is routed to this module
          expect(response).toHaveLength(1);
          expect(response[0]._id).toBe(TestData.ids.issuer8);
        });

        test('5: Import trusted JWT issuers from import data that has none', async () => {
          const response = await IssuerOps.importOAuth2TrustedJwtIssuers({
            importData: importOf({}),
            state,
          });
          expect(response).toStrictEqual([]);
        });
      });

      describe('frodo.oauth2oidc.issuer', () => {
        test('1: The module reads through the facade', async () => {
          const issuer = IssuerOps.default(state);
          const response = await issuer.readOAuth2TrustedJwtIssuer(
            TestData.ids.issuer1
          );
          expect(response._id).toBe(TestData.ids.issuer1);
        });
      });

      describe('Cloud root realm', () => {
        // the root realm of an Identity Cloud tenant offers no trusted JWT issuers: every request is answered 403
        beforeAll(() => {
          TestData.setTestRealm('/');
        });
        afterAll(async () => {
          if (process.env.FRODO_POLLY_MODE === 'record') {
            // nothing is created in the root realm, but make sure of it
            try {
              await IssuerOps.deleteOAuth2TrustedJwtIssuer({
                issuerId: 'FrodoTestIssuerRoot',
                state,
              });
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
              // ignore: it does not exist
            }
          }
          TestData.setTestRealm();
        });

        test('1: Read all trusted JWT issuers of the root realm (none, no error)', async () => {
          expect(
            await IssuerOps.readOAuth2TrustedJwtIssuers({ state })
          ).toStrictEqual([]);
        });

        test('2: Read, create, update, delete and export a trusted JWT issuer of the root realm', async () => {
          const issuerId = 'FrodoTestIssuerRoot';
          const errors = {
            read: await failure(
              IssuerOps.readOAuth2TrustedJwtIssuer({ issuerId, state })
            ),
            create: await failure(
              IssuerOps.createOAuth2TrustedJwtIssuer({
                issuerId,
                issuerData: TestData.minimal(2),
                state,
              })
            ),
            update: await failure(
              IssuerOps.updateOAuth2TrustedJwtIssuer({
                issuerId,
                issuerData: TestData.minimal(2),
                state,
              })
            ),
            delete: await failure(
              IssuerOps.deleteOAuth2TrustedJwtIssuer({ issuerId, state })
            ),
            export: await failure(
              IssuerOps.exportOAuth2TrustedJwtIssuer({ issuerId, state })
            ),
          };
          expect(
            Object.fromEntries(
              Object.entries(errors).map(([name, error]) => [
                name,
                summarizeError(error),
              ])
            )
          ).toMatchSnapshot();
        });

        test('3: Export all trusted JWT issuers of the root realm (none)', async () => {
          const response = await IssuerOps.exportOAuth2TrustedJwtIssuers({
            state,
          });
          expect(response.trustedJwtIssuer).toStrictEqual({});
        });

        test('4: Delete all trusted JWT issuers of the root realm (none)', async () => {
          expect(
            await IssuerOps.deleteOAuth2TrustedJwtIssuers({ state })
          ).toStrictEqual([]);
        });

        test('5: Import trusted JWT issuers into the root realm', async () => {
          const error = await failure(
            IssuerOps.importOAuth2TrustedJwtIssuers({
              importData: importOf({
                FrodoTestIssuerRoot: TestData.minimal(5),
              }),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });
    }

    // Phase 2
    if (TestData.phase(2)) {
      describe('deleteOAuth2TrustedJwtIssuer()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerOps.deleteOAuth2TrustedJwtIssuer).toBeDefined();
        });

        test(`1: Delete trusted JWT issuer '${TestData.ids.delete1}'`, async () => {
          const response = await IssuerOps.deleteOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.delete1,
            state,
          });
          // the answer is the deleted issuer
          expect(response._id).toBe(TestData.ids.delete1);
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`2: Delete trusted JWT issuer '${TestData.ids.delete1}' again`, async () => {
          const error = await failure(
            IssuerOps.deleteOAuth2TrustedJwtIssuer({
              issuerId: TestData.ids.delete1,
              state,
            })
          );
          // a failed delete is a FrodoError that names the issuer
          expect(error).toBeInstanceOf(FrodoError);
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test(`3: Delete trusted JWT issuer '${TestData.ids.delete2}'`, async () => {
          const response = await IssuerOps.deleteOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.delete2,
            state,
          });
          expect(response._id).toBe(TestData.ids.delete2);
        });
      });
    }

    // Phase 3
    if (TestData.phase(3)) {
      describe('deleteOAuth2TrustedJwtIssuers()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerOps.deleteOAuth2TrustedJwtIssuers).toBeDefined();
        });

        test('1: Delete all trusted JWT issuers with a result callback', async () => {
          const { calls, callback } = collector<{ _id: string }>(
            (issuer) => issuer._id
          );
          const response = await IssuerOps.deleteOAuth2TrustedJwtIssuers({
            resultCallback: callback,
            state,
          });
          expect(response.map((issuer) => issuer._id)).toMatchSnapshot();
          expect(calls).toHaveLength(response.length);
          expect(calls).toMatchSnapshot();
        });

        test('2: Delete all trusted JWT issuers without a result callback', async () => {
          // the realm is empty after the first test: create two issuers to delete
          await IssuerOps.createOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.all4,
            issuerData: TestData.withJwkSet(24),
            state,
          });
          await IssuerOps.createOAuth2TrustedJwtIssuer({
            issuerId: TestData.ids.all5,
            issuerData: TestData.minimal(25),
            state,
          });
          const response = await IssuerOps.deleteOAuth2TrustedJwtIssuers({
            state,
          });
          expect(response.map((issuer) => issuer._id)).toMatchSnapshot();
        });

        test('3: Delete all trusted JWT issuers of a realm that has none', async () => {
          const response = await IssuerOps.deleteOAuth2TrustedJwtIssuers({
            state,
          });
          expect(response).toStrictEqual([]);
        });
      });
    }
  });
});
