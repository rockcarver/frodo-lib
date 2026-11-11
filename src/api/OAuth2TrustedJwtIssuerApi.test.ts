/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    This step breaks down into 2 phases, because the tests of the second phase delete what the first phase left:
 *
 *    Phase 1: Create, update, read and list trusted JWT issuers; the Cloud root realm (read-only answers of the server)
 *    Phase 2: Delete by id
 *
 *    Record against a non-production tenant. The tests run in the realm 'bravo' (see TEST_REALM in
 *    src/test/setup/TrustedJwtIssuerSetup.ts). Recording refuses to start if that realm holds a trusted JWT issuer
 *    whose id does not start with 'FrodoTest', so the recordings never hold the name of somebody else's issuer, and it
 *    deletes every issuer whose id starts with 'FrodoTest' before and after each phase. The issuers of the tests have
 *    made-up URLs on example.com and, where they have a key set, a throw-away PUBLIC key. The tests of a phase build on
 *    each other (an issuer that one test creates is read by the next), so record a phase in one run, in the order of
 *    the file.
 *
 *    To record and update snapshots, you must call the test:record script and override all the connection state
 *    variables required to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record -- src/api/OAuth2TrustedJwtIssuerApi.test.ts
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record -- src/api/OAuth2TrustedJwtIssuerApi.test.ts
 *
 *    The above commands assume that you have a connection profile for 'frodo-dev' on your development machine.
 *    Not recorded: ForgeOps and classic deployments (the mocked unit tests of the module cover them).
 *
 * 2. Update snapshots
 *
 *    Recording a phase with --updateSnapshot removes the snapshots of the other phase, so rewrite all of them from the
 *    recordings after the last phase:
 *
 *        FRODO_DEBUG=1 npm run test:update -- src/api/OAuth2TrustedJwtIssuerApi.test.ts
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in replay mode and make sure they all
 *    succeed as well:
 *
 *        npm run test:only -- src/api/OAuth2TrustedJwtIssuerApi.test.ts
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output in case things don't function as
 * expected
 */
import { state } from '../index';
import { summarizeError } from '../test/setup/ErrorSummary';
import * as TestData from '../test/setup/TrustedJwtIssuerSetup';
import * as IssuerApi from './OAuth2TrustedJwtIssuerApi';

/** Run a call that must fail and hand back its error */
async function failure(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error('The call was expected to fail');
}

describe('OAuth2TrustedJwtIssuerApi', () => {
  TestData.setup();

  // in recording mode, stage the realm before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      const n = Number(process.env.FRODO_RECORD_PHASE);
      if (n === 1 || n === 2) await TestData.stagePhase(n);
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
      describe('getOAuth2TrustedJwtIssuers()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerApi.getOAuth2TrustedJwtIssuers).toBeDefined();
        });

        test('1: Get all trusted JWT issuers of a realm that has none', async () => {
          const response = await IssuerApi.getOAuth2TrustedJwtIssuers({
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('putOAuth2TrustedJwtIssuer()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerApi.putOAuth2TrustedJwtIssuer).toBeDefined();
        });

        test(`1: Create trusted JWT issuer '${TestData.ids.issuer1}' (wrapped values, key set)`, async () => {
          const response = await IssuerApi.putOAuth2TrustedJwtIssuer({
            id: TestData.ids.issuer1,
            issuerData: TestData.withJwkSet(1),
            state,
          });
          // the answer is the wrapped issuer; the key set is shown by its members, not its key
          expect(response._id).toBe(TestData.ids.issuer1);
          // the module asks for the api version it was written for
          expect(
            TestData.lastRequest('PUT').headers['accept-api-version']
          ).toBe('protocol=2.0,resource=1.0');
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`2: Create trusted JWT issuer '${TestData.ids.issuer2}' (plain values, key set URI)`, async () => {
          const response = await IssuerApi.putOAuth2TrustedJwtIssuer({
            id: TestData.ids.issuer2,
            issuerData: TestData.withJwksUri(2),
            state,
          });
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`3: Create trusted JWT issuer '${TestData.ids.issuer3}' (minimal body)`, async () => {
          const response = await IssuerApi.putOAuth2TrustedJwtIssuer({
            id: TestData.ids.issuer3,
            issuerData: TestData.minimal(3),
            state,
          });
          // the server completes the issuer with its defaults
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test('4: Create a trusted JWT issuer with an attribute the server does not know', async () => {
          const error = await failure(
            IssuerApi.putOAuth2TrustedJwtIssuer({
              id: 'FrodoTestIssuerUnknown',
              issuerData: TestData.unknownAttribute(4),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('5: Create a trusted JWT issuer without an issuer (the server does not require it)', async () => {
          const response = await IssuerApi.putOAuth2TrustedJwtIssuer({
            id: 'FrodoTestIssuerNoIssuer',
            issuerData: { allowedSubjects: ['carol@matrix.example.com'] },
            state,
          });
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });
      });

      describe('getOAuth2TrustedJwtIssuer()', () => {
        test('0: Method is implemented', async () => {
          expect(IssuerApi.getOAuth2TrustedJwtIssuer).toBeDefined();
        });

        test(`1: Get trusted JWT issuer '${TestData.ids.issuer1}' (wrapped shape)`, async () => {
          const response = await IssuerApi.getOAuth2TrustedJwtIssuer({
            id: TestData.ids.issuer1,
            state,
          });
          // the key set is the public key of the tests
          expect(response).toMatchSnapshot();
        });

        test('2: Get a trusted JWT issuer that does not exist', async () => {
          const error = await failure(
            IssuerApi.getOAuth2TrustedJwtIssuer({
              id: 'FrodoTestIssuerMissing',
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });

      describe('getOAuth2TrustedJwtIssuers() with issuers', () => {
        test('1: Get all trusted JWT issuers of the realm (plain shape)', async () => {
          const response = await IssuerApi.getOAuth2TrustedJwtIssuers({
            state,
          });
          expect(response.resultCount).toBe(response.result.length);
          // the list holds the plain values, and null for what is not set
          expect(response.result.map(TestData.shapeOf)).toMatchSnapshot();
        });
      });

      describe('putOAuth2TrustedJwtIssuer() as an update', () => {
        test(`1: Update trusted JWT issuer '${TestData.ids.issuer1}' with the answer of a read (the revision is not sent)`, async () => {
          const read = await IssuerApi.getOAuth2TrustedJwtIssuer({
            id: TestData.ids.issuer1,
            state,
          });
          expect(typeof read._rev).toBe('string');
          const response = await IssuerApi.putOAuth2TrustedJwtIssuer({
            id: TestData.ids.issuer1,
            issuerData: {
              ...read,
              allowedSubjects: {
                inherited: false,
                value: [
                  'alice1@matrix.example.com',
                  'dave1@matrix.example.com',
                ],
              },
            },
            state,
          });
          // the object that was passed in is not changed
          expect(typeof read._rev).toBe('string');
          // the server keeps a set of subjects, not a list: the order is its own
          expect(
            [...(response.allowedSubjects as { value: string[] }).value].sort()
          ).toStrictEqual([
            'alice1@matrix.example.com',
            'dave1@matrix.example.com',
          ]);
        });

        test(`2: Update trusted JWT issuer '${TestData.ids.issuer2}' with a sparse body`, async () => {
          const response = await IssuerApi.putOAuth2TrustedJwtIssuer({
            id: TestData.ids.issuer2,
            issuerData: TestData.sparse(2),
            state,
          });
          // a write replaces what is stored: only the attributes that were sent are left
          expect(TestData.shapeOf(response)).toMatchSnapshot();
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
              await IssuerApi.deleteOAuth2TrustedJwtIssuer({
                id: 'FrodoTestIssuerRoot',
                state,
              });
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
              // ignore: it does not exist
            }
          }
          TestData.setTestRealm();
        });

        test('1: Get all trusted JWT issuers of the root realm', async () => {
          const error = await failure(
            IssuerApi.getOAuth2TrustedJwtIssuers({ state })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('2: Get a trusted JWT issuer of the root realm', async () => {
          const error = await failure(
            IssuerApi.getOAuth2TrustedJwtIssuer({
              id: 'FrodoTestIssuerRoot',
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('3: Create a trusted JWT issuer in the root realm', async () => {
          const error = await failure(
            IssuerApi.putOAuth2TrustedJwtIssuer({
              id: 'FrodoTestIssuerRoot',
              issuerData: TestData.minimal(3),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('4: Delete a trusted JWT issuer in the root realm', async () => {
          const error = await failure(
            IssuerApi.deleteOAuth2TrustedJwtIssuer({
              id: 'FrodoTestIssuerRoot',
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
          expect(IssuerApi.deleteOAuth2TrustedJwtIssuer).toBeDefined();
        });

        test(`1: Delete trusted JWT issuer '${TestData.ids.delete1}'`, async () => {
          const response = await IssuerApi.deleteOAuth2TrustedJwtIssuer({
            id: TestData.ids.delete1,
            state,
          });
          // the answer is the deleted issuer
          expect(response._id).toBe(TestData.ids.delete1);
          expect(response).toMatchSnapshot();
        });

        test(`2: Delete trusted JWT issuer '${TestData.ids.delete1}' again`, async () => {
          const error = await failure(
            IssuerApi.deleteOAuth2TrustedJwtIssuer({
              id: TestData.ids.delete1,
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });
    }
  });
});
