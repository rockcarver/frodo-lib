/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    This step breaks down into 3 phases:
 *
 *    Phase 1: Non-destructive tests: availability, template, schema, create, read, update, export, import, and the
 *             Cloud root realm (read-only answers of the server)
 *    Phase 2: Delete by id
 *    Phase 3: Delete all profiles of the realm (leaves the realm empty)
 *
 *    CIMD profiles exist from PingAM 9.0 on; today only Identity Cloud tenants offer them. Record against a
 *    non-production tenant that lists the agent type 'CIMDProfile'. The tests run in the realm 'bravo' (see
 *    TEST_REALM in src/test/setup/CIMDProfileSetup.ts). THE THIRD PHASE DELETES EVERY CIMD PROFILE OF THAT REALM:
 *    recording refuses to start (in any phase) if the realm holds a profile whose id does not start with 'FrodoTest',
 *    so a profile of somebody else is never deleted and its name never reaches a recording. Recording deletes every
 *    profile whose id starts with 'FrodoTest' before and after each phase.
 *
 *    The tests of a phase build on each other (a profile that one test creates is read by the next), so record a phase
 *    in one run, in the order of the file. The type list of the agent types is asked for before each test (it is
 *    cached for the life of the process otherwise), so that a single test can be run alone.
 *
 *    To record and update snapshots, you must call the test:record script and override all the connection state
 *    variables required to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record -- src/ops/OAuth2CIMDProfileOps.test.ts
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record -- src/ops/OAuth2CIMDProfileOps.test.ts
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=3 FRODO_HOST=frodo-dev npm run test:record -- src/ops/OAuth2CIMDProfileOps.test.ts
 *
 *    The above commands assume that you have a connection profile for 'frodo-dev' on your development machine.
 *    Not recorded: ForgeOps and classic deployments (PingAM 9.0 is not available there yet), and a Cloud tenant that
 *    does not list the type (the unit tests of the module cover it with fakes).
 *
 * 2. Update snapshots
 *
 *    Recording a phase with --updateSnapshot removes the snapshots of the other phases, so rewrite all of them from
 *    the recordings after the last phase:
 *
 *        FRODO_DEBUG=1 npm run test:update -- src/ops/OAuth2CIMDProfileOps.test.ts
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in replay mode and make sure they all
 *    succeed as well:
 *
 *        npm run test:only -- src/ops/OAuth2CIMDProfileOps.test.ts
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output in case things don't function as
 * expected
 */
import { state } from '../index';
import * as TestData from '../test/setup/CIMDProfileSetup';
import { summarizeError } from '../test/setup/ErrorSummary';
import { FrodoError } from './FrodoError';
import * as CIMDProfileOps from './OAuth2CIMDProfileOps';
import {
  type CIMDProfileExportInterface,
  type CIMDProfileImportResult,
} from './OAuth2CIMDProfileOps';

/** Run a call that must fail and hand back its error */
async function failure(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error('The call was expected to fail');
}

/** A result callback that remembers what it was told, by profile id */
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

const importOf = (
  profiles: Record<string, unknown>
): CIMDProfileExportInterface =>
  ({
    cimdProfile: profiles,
  }) as unknown as CIMDProfileExportInterface;

describe('OAuth2CIMDProfileOps', () => {
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
      await TestData.removeTestProfiles();
    }
  });

  describe('Cloud Tests', () => {
    // Phase 1
    if (TestData.phase(1)) {
      describe('isCIMDProfileAvailable()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.isCIMDProfileAvailable).toBeDefined();
        });

        test('1: The realm offers CIMD profiles', async () => {
          expect(await CIMDProfileOps.isCIMDProfileAvailable({ state })).toBe(
            true
          );
        });

        test('2: The realm offers CIMD profiles (the type list is read again)', async () => {
          expect(
            await CIMDProfileOps.isCIMDProfileAvailable({
              refreshCache: true,
              state,
            })
          ).toBe(true);
        });
      });

      describe('createCIMDProfileExportTemplate()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.createCIMDProfileExportTemplate).toBeDefined();
        });

        test('1: Create CIMD profile export template', async () => {
          const response = CIMDProfileOps.createCIMDProfileExportTemplate({
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('readCIMDProfileTemplate()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.readCIMDProfileTemplate).toBeDefined();
        });

        test('1: Read the CIMD profile template', async () => {
          const response = await CIMDProfileOps.readCIMDProfileTemplate({
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('readCIMDProfileSchema()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.readCIMDProfileSchema).toBeDefined();
        });

        test('1: Read the CIMD profile schema', async () => {
          const response = await CIMDProfileOps.readCIMDProfileSchema({
            state,
          });
          // the schema is long: the groups with their attributes are what a reader needs
          expect({
            type: response.type,
            groups: Object.fromEntries(
              Object.entries(response.properties).map(([name, group]) => [
                name,
                Object.keys((group as { properties: object }).properties),
              ])
            ),
          }).toMatchSnapshot();
        });
      });

      describe('readCIMDProfiles()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.readCIMDProfiles).toBeDefined();
        });

        test('1: Read all CIMD profiles of a realm that has none', async () => {
          const response = await CIMDProfileOps.readCIMDProfiles({ state });
          expect(response).toStrictEqual([]);
        });
      });

      describe('createCIMDProfile()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.createCIMDProfile).toBeDefined();
        });

        test(`1: Create CIMD profile '${TestData.ids.profile1}' (plain values)`, async () => {
          const response = await CIMDProfileOps.createCIMDProfile({
            profileId: TestData.ids.profile1,
            profileData: TestData.rich(1),
            state,
          });
          // a create is refused by the server if the id exists
          expect(TestData.lastRequest('PUT').headers['if-none-match']).toBe(
            '*'
          );
          // the answer of a write has the wrapped shape and the server's defaults
          expect(TestData.shapeOf(response)).toMatchSnapshot();
          expect(response.cimdConfig).toMatchSnapshot();
        });

        test(`2: Create CIMD profile '${TestData.ids.profile2}' (wrapped values, SSRF protection off)`, async () => {
          const response = await CIMDProfileOps.createCIMDProfile({
            profileId: TestData.ids.profile2,
            profileData: TestData.wrapped(2),
            state,
          });
          expect(TestData.shapeOf(response)).toMatchSnapshot();
          expect(response.cimdConfig).toMatchSnapshot();
        });

        test(`3: Create CIMD profile '${TestData.ids.profile3}' (minimal body)`, async () => {
          const response = await CIMDProfileOps.createCIMDProfile({
            profileId: TestData.ids.profile3,
            profileData: TestData.minimal(3),
            state,
          });
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`4: Create CIMD profile '${TestData.ids.profile1}' that already exists`, async () => {
          const error = await failure(
            CIMDProfileOps.createCIMDProfile({
              profileId: TestData.ids.profile1,
              profileData: TestData.rich(1),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('5: Create a CIMD profile with a pattern the server refuses', async () => {
          const error = await failure(
            CIMDProfileOps.createCIMDProfile({
              profileId: 'FrodoTestCIMDInvalid',
              profileData: TestData.invalidPattern(5),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('6: Create a CIMD profile with attributes the server does not know', async () => {
          const error = (await failure(
            CIMDProfileOps.createCIMDProfile({
              profileId: 'FrodoTestCIMDUnknown',
              profileData: TestData.unknownAttributes(6),
              state,
            })
          )) as FrodoError;
          // the message names the attributes, the server's list of valid ones stays in the cause
          expect(error.message).toContain('cimdBogus');
          expect(error.message).toContain('notAGroup');
          expect(error.message).not.toContain('cimdClientIdUrlPatterns');
          expect(error.message).toMatchSnapshot();
        });

        test('7: Create CIMD profiles with ids the module refuses before it sends anything', async () => {
          const messages: Record<string, string> = {};
          for (const profileId of [
            'FrodoTest/slash',
            'FrodoTest?query',
            'FrodoTest#hash',
            'FrodoTest+plus',
            'FrodoTest,comma',
            'FrodoTest;semicolon',
            'FrodoTest!bang',
            ' FrodoTestLeadingSpace',
            'FrodoTestTrailingSpace ',
            '..',
            '',
          ]) {
            const error = await failure(
              CIMDProfileOps.createCIMDProfile({
                profileId,
                profileData: TestData.minimal(7),
                state,
              })
            );
            messages[profileId] = (error as FrodoError).message;
          }
          expect(messages).toMatchSnapshot();
        });

        test(`8: Create CIMD profile '${TestData.oddId}' (an id with characters that need encoding)`, async () => {
          const response = await CIMDProfileOps.createCIMDProfile({
            profileId: TestData.oddId,
            profileData: TestData.minimal(8),
            state,
          });
          expect(response._id).toBe(TestData.oddId);
        });

        test(`9: Create CIMD profile '${TestData.ids.caseOriginal}'`, async () => {
          const response = await CIMDProfileOps.createCIMDProfile({
            profileId: TestData.ids.caseOriginal,
            profileData: TestData.minimal(9),
            state,
          });
          expect(response._id).toBe(TestData.ids.caseOriginal);
        });

        test(`10: Create CIMD profile '${TestData.ids.caseOther}' that exists with the case of another id`, async () => {
          const error = await failure(
            CIMDProfileOps.createCIMDProfile({
              profileId: TestData.ids.caseOther,
              profileData: TestData.minimal(9),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });

      describe('readCIMDProfiles() with profiles', () => {
        test('1: Read all CIMD profiles (plain shape, sorted by id)', async () => {
          const response = await CIMDProfileOps.readCIMDProfiles({ state });
          expect(response.map((profile) => profile._id)).toMatchSnapshot();
          expect(response.map(TestData.shapeOf)).toMatchSnapshot();
        });
      });

      describe('readCIMDProfile()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.readCIMDProfile).toBeDefined();
        });

        test(`1: Read CIMD profile '${TestData.ids.profile1}'`, async () => {
          const response = await CIMDProfileOps.readCIMDProfile({
            profileId: TestData.ids.profile1,
            state,
          });
          // the plain shape of the list: values without the wrapper
          expect(response).toMatchSnapshot();
        });

        test(`2: Read CIMD profile '${TestData.oddId}'`, async () => {
          const response = await CIMDProfileOps.readCIMDProfile({
            profileId: TestData.oddId,
            state,
          });
          expect(response._id).toBe(TestData.oddId);
        });

        test('3: Read a CIMD profile with the case of another id', async () => {
          const response = await CIMDProfileOps.readCIMDProfile({
            profileId: TestData.ids.caseOther,
            state,
          });
          // the profile is found, and the id is the stored one
          expect(response._id).toBe(TestData.ids.caseOriginal);
        });

        test('4: Read a CIMD profile that does not exist', async () => {
          const error = await failure(
            CIMDProfileOps.readCIMDProfile({
              profileId: 'FrodoTestCIMDMissing',
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('5: Read a CIMD profile with an id the module refuses', async () => {
          const error = await failure(
            CIMDProfileOps.readCIMDProfile({
              profileId: 'FrodoTest/slash',
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });

      describe('updateCIMDProfile()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.updateCIMDProfile).toBeDefined();
        });

        test(`1: Update CIMD profile '${TestData.ids.profile1}' with what a read returned`, async () => {
          const read = await CIMDProfileOps.readCIMDProfile({
            profileId: TestData.ids.profile1,
            state,
          });
          const response = await CIMDProfileOps.updateCIMDProfile({
            profileId: TestData.ids.profile1,
            profileData: {
              ...read,
              coreOAuth2ClientConfig: {
                ...read.coreOAuth2ClientConfig,
                clientName: ['FrodoTest CIMD profile 1 (updated)'],
              },
            },
            state,
          });
          // an update is an upsert: the server is not told to refuse an existing id
          expect(
            TestData.lastRequest('PUT').headers['if-none-match']
          ).toBeUndefined();
          expect(response.coreOAuth2ClientConfig.clientName).toStrictEqual({
            inherited: false,
            value: ['FrodoTest CIMD profile 1 (updated)'],
          });
          // the profile keeps its attributes: the body was complete
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`2: Update CIMD profile '${TestData.ids.profile3}' with a sparse body`, async () => {
          const response = await CIMDProfileOps.updateCIMDProfile({
            profileId: TestData.ids.profile3,
            profileData: TestData.sparse(3),
            state,
          });
          // a write replaces what is stored: only the attributes that were sent are left
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`3: Read the sparse CIMD profile '${TestData.ids.profile3}'`, async () => {
          const response = await CIMDProfileOps.readCIMDProfile({
            profileId: TestData.ids.profile3,
            state,
          });
          expect(response).toMatchSnapshot();
        });

        test('4: Update a CIMD profile with attributes the server does not know', async () => {
          const error = (await failure(
            CIMDProfileOps.updateCIMDProfile({
              profileId: TestData.ids.profile3,
              profileData: TestData.unknownAttributes(4),
              state,
            })
          )) as FrodoError;
          expect(error.message).toContain('cimdBogus');
          expect(error.message).toMatchSnapshot();
        });

        test(`5: Update CIMD profile '${TestData.ids.upsert}' that does not exist (the server creates it)`, async () => {
          const response = await CIMDProfileOps.updateCIMDProfile({
            profileId: TestData.ids.upsert,
            profileData: TestData.minimal(5),
            state,
          });
          expect(response._id).toBe(TestData.ids.upsert);
          // completed with the defaults like a create
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });
      });

      describe('exportCIMDProfile()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.exportCIMDProfile).toBeDefined();
        });

        test(`1: Export CIMD profile '${TestData.ids.profile1}'`, async () => {
          const response = await CIMDProfileOps.exportCIMDProfile({
            profileId: TestData.ids.profile1,
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test('2: Export a CIMD profile that does not exist', async () => {
          const error = await failure(
            CIMDProfileOps.exportCIMDProfile({
              profileId: 'FrodoTestCIMDMissing',
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });

      describe('exportCIMDProfiles()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.exportCIMDProfiles).toBeDefined();
        });

        test('1: Export all CIMD profiles', async () => {
          const response = await CIMDProfileOps.exportCIMDProfiles({ state });
          expect(response.meta).toBeDefined();
          expect(Object.keys(response.cimdProfile)).toMatchSnapshot();
          expect(
            Object.values(response.cimdProfile).map(TestData.shapeOf)
          ).toMatchSnapshot();
        });

        test('2: Export all CIMD profiles with a result callback', async () => {
          const { calls, callback } = collector<{ _id: string }>(
            (profile) => profile._id
          );
          const response = await CIMDProfileOps.exportCIMDProfiles({
            resultCallback: callback,
            state,
          });
          expect(calls).toHaveLength(Object.keys(response.cimdProfile).length);
          expect(calls).toMatchSnapshot();
        });
      });

      describe('importCIMDProfile()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.importCIMDProfile).toBeDefined();
        });

        test(`1: Import CIMD profile '${TestData.ids.profile1}' over the existing one`, async () => {
          const exported = await CIMDProfileOps.exportCIMDProfile({
            profileId: TestData.ids.profile1,
            state,
          });
          const response = await CIMDProfileOps.importCIMDProfile({
            profileId: TestData.ids.profile1,
            importData: exported,
            state,
          });
          expect({
            created: response.created,
            repaired: response.repaired,
            shape: TestData.shapeOf(response.profile),
          }).toMatchSnapshot();
        });

        test(`2: Import a complete CIMD profile as '${TestData.ids.profile4}' (new)`, async () => {
          const exported = await CIMDProfileOps.exportCIMDProfile({
            profileId: TestData.ids.profile1,
            state,
          });
          const response = await CIMDProfileOps.importCIMDProfile({
            profileId: TestData.ids.profile4,
            importData: importOf({
              [TestData.ids.profile4]: {
                ...exported.cimdProfile[TestData.ids.profile1],
                _id: TestData.ids.profile4,
              },
            }),
            state,
          });
          // created, and the server added nothing to the complete profile
          expect({
            created: response.created,
            repaired: response.repaired,
            shape: TestData.shapeOf(response.profile),
          }).toMatchSnapshot();
        });

        test(`3: Import a sparse CIMD profile as '${TestData.ids.profile5}' (new: created, then written again)`, async () => {
          const response = await CIMDProfileOps.importCIMDProfile({
            profileId: TestData.ids.profile5,
            importData: importOf({
              [TestData.ids.profile5]: TestData.sparse(5),
            }),
            state,
          });
          // the server completed the new profile with its defaults, the second write replaced them again
          expect(response.created).toBe(true);
          expect(response.repaired).toBe(true);
          expect(TestData.shapeOf(response.profile)).toMatchSnapshot();
          const read = await CIMDProfileOps.readCIMDProfile({
            profileId: TestData.ids.profile5,
            state,
          });
          expect(
            Object.keys(read)
              .filter((k) => !k.startsWith('_'))
              .sort()
          ).toEqual(Object.keys(TestData.sparse(5)).sort());
        });

        test('4: Import a CIMD profile of another agent type', async () => {
          const error = await failure(
            CIMDProfileOps.importCIMDProfile({
              profileId: TestData.ids.profile4,
              importData: importOf({
                [TestData.ids.profile4]: {
                  ...TestData.minimal(4),
                  _type: { _id: 'WebAgent', name: 'Web Agent' },
                },
              }),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('5: Import a CIMD profile that is not in the import data', async () => {
          const error = await failure(
            CIMDProfileOps.importCIMDProfile({
              profileId: TestData.ids.profile4,
              importData: importOf({
                [TestData.ids.profile5]: TestData.sparse(5),
              }),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('6: Import a CIMD profile with a pattern the server refuses', async () => {
          const error = await failure(
            CIMDProfileOps.importCIMDProfile({
              profileId: 'FrodoTestCIMDInvalid',
              importData: importOf({
                FrodoTestCIMDInvalid: TestData.invalidPattern(6),
              }),
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });

      describe('importCIMDProfiles()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.importCIMDProfiles).toBeDefined();
        });

        test('1: Import CIMD profiles (one exists, one is new) with a result callback', async () => {
          const exported = await CIMDProfileOps.exportCIMDProfile({
            profileId: TestData.ids.profile1,
            state,
          });
          const { calls, callback } = collector<CIMDProfileImportResult>(
            (result) => ({
              id: result.profile._id,
              created: result.created,
              repaired: result.repaired,
            })
          );
          const response = await CIMDProfileOps.importCIMDProfiles({
            importData: importOf({
              [TestData.ids.profile1]:
                exported.cimdProfile[TestData.ids.profile1],
              [TestData.ids.profile6]: {
                ...exported.cimdProfile[TestData.ids.profile1],
                _id: TestData.ids.profile6,
              },
            }),
            resultCallback: callback,
            state,
          });
          expect(response).toHaveLength(2);
          expect(calls).toMatchSnapshot();
        });

        test('2: Import CIMD profiles (one is refused by the server) with a result callback', async () => {
          const { calls, callback } = collector<CIMDProfileImportResult>(
            (result) => ({
              id: result.profile._id,
              created: result.created,
              repaired: result.repaired,
            })
          );
          const response = await CIMDProfileOps.importCIMDProfiles({
            importData: importOf({
              FrodoTestCIMDInvalid: TestData.invalidPattern(2),
              [TestData.ids.profile7]: TestData.sparse(7),
            }),
            resultCallback: callback,
            state,
          });
          // the callback tells each item as it happens, the failed item as an error that names it
          expect(response).toHaveLength(1);
          expect(calls).toMatchSnapshot();
        });

        test('3: Import CIMD profiles (one is refused by the server) without a result callback', async () => {
          const error = await failure(
            CIMDProfileOps.importCIMDProfiles({
              importData: importOf({
                FrodoTestCIMDInvalid: TestData.invalidPattern(3),
                [TestData.ids.profile7]: TestData.sparse(7),
              }),
              state,
            })
          );
          // the item that succeeded is imported, the failure is thrown at the end
          expect(summarizeError(error)).toMatchSnapshot();
          const read = await CIMDProfileOps.readCIMDProfile({
            profileId: TestData.ids.profile7,
            state,
          });
          expect(read._id).toBe(TestData.ids.profile7);
        });

        test('4: Import CIMD profiles from import data that has none', async () => {
          const response = await CIMDProfileOps.importCIMDProfiles({
            importData: importOf({}),
            state,
          });
          expect(response).toStrictEqual([]);
        });
      });

      describe('frodo.oauth2oidc.cimd', () => {
        test('1: The module reads through the facade', async () => {
          const cimd = CIMDProfileOps.default(state);
          expect(await cimd.isCIMDProfileAvailable()).toBe(true);
          const profile = await cimd.readCIMDProfile(TestData.ids.profile1);
          expect(profile._id).toBe(TestData.ids.profile1);
        });
      });

      describe('Cloud root realm', () => {
        // the root realm of an Identity Cloud tenant does not offer the type: its type list is answered 403
        beforeAll(() => {
          TestData.setTestRealm('/');
        });
        afterAll(() => {
          TestData.setTestRealm();
        });

        test('1: The root realm does not offer CIMD profiles', async () => {
          expect(await CIMDProfileOps.isCIMDProfileAvailable({ state })).toBe(
            false
          );
        });

        test('2: Read all CIMD profiles of the root realm (none, no error)', async () => {
          expect(
            await CIMDProfileOps.readCIMDProfiles({ state })
          ).toStrictEqual([]);
        });

        test('3: Read, create, update, delete and export a CIMD profile of the root realm', async () => {
          const profileId = 'FrodoTestCIMDRoot';
          const errors = {
            read: await failure(
              CIMDProfileOps.readCIMDProfile({ profileId, state })
            ),
            create: await failure(
              CIMDProfileOps.createCIMDProfile({
                profileId,
                profileData: TestData.minimal(3),
                state,
              })
            ),
            update: await failure(
              CIMDProfileOps.updateCIMDProfile({
                profileId,
                profileData: TestData.minimal(3),
                state,
              })
            ),
            delete: await failure(
              CIMDProfileOps.deleteCIMDProfile({ profileId, state })
            ),
            export: await failure(
              CIMDProfileOps.exportCIMDProfile({ profileId, state })
            ),
            template: await failure(
              CIMDProfileOps.readCIMDProfileTemplate({ state })
            ),
            schema: await failure(
              CIMDProfileOps.readCIMDProfileSchema({ state })
            ),
          };
          // every one of them is the same condition, with the same code
          for (const error of Object.values(errors)) {
            expect((error as FrodoError).code).toBe(
              'CIMD_PROFILES_NOT_AVAILABLE'
            );
          }
          expect(
            Object.fromEntries(
              Object.entries(errors).map(([name, error]) => [
                name,
                summarizeError(error),
              ])
            )
          ).toMatchSnapshot();
        });

        test('4: Export all CIMD profiles of the root realm (none)', async () => {
          const response = await CIMDProfileOps.exportCIMDProfiles({ state });
          expect(response.cimdProfile).toStrictEqual({});
        });

        test('5: Delete all CIMD profiles of the root realm (none)', async () => {
          expect(
            await CIMDProfileOps.deleteCIMDProfiles({ state })
          ).toStrictEqual([]);
        });

        test('6: Import CIMD profiles into the root realm (skipped, no error)', async () => {
          const response = await CIMDProfileOps.importCIMDProfiles({
            importData: importOf({ FrodoTestCIMDRoot: TestData.minimal(6) }),
            state,
          });
          expect(response).toStrictEqual([]);
        });

        test('7: Import a CIMD profile into the root realm', async () => {
          const error = await failure(
            CIMDProfileOps.importCIMDProfile({
              profileId: 'FrodoTestCIMDRoot',
              importData: importOf({ FrodoTestCIMDRoot: TestData.minimal(7) }),
              state,
            })
          );
          expect((error as FrodoError).code).toBe(
            'CIMD_PROFILES_NOT_AVAILABLE'
          );
        });
      });
    }

    // Phase 2
    if (TestData.phase(2)) {
      describe('deleteCIMDProfile()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.deleteCIMDProfile).toBeDefined();
        });

        test(`1: Delete CIMD profile '${TestData.ids.delete1}'`, async () => {
          const response = await CIMDProfileOps.deleteCIMDProfile({
            profileId: TestData.ids.delete1,
            state,
          });
          // the answer is the deleted profile
          expect(response._id).toBe(TestData.ids.delete1);
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`2: Delete CIMD profile '${TestData.ids.delete1}' again`, async () => {
          const error = await failure(
            CIMDProfileOps.deleteCIMDProfile({
              profileId: TestData.ids.delete1,
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test(`3: Delete CIMD profile '${TestData.oddId}'`, async () => {
          const response = await CIMDProfileOps.deleteCIMDProfile({
            profileId: TestData.oddId,
            state,
          });
          expect(response._id).toBe(TestData.oddId);
        });

        test('4: Delete a CIMD profile with an id the module refuses', async () => {
          const error = await failure(
            CIMDProfileOps.deleteCIMDProfile({
              profileId: 'FrodoTest/slash',
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });
    }

    // Phase 3
    if (TestData.phase(3)) {
      describe('deleteCIMDProfiles()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileOps.deleteCIMDProfiles).toBeDefined();
        });

        test('1: Delete all CIMD profiles with a result callback', async () => {
          const { calls, callback } = collector<{ _id: string }>(
            (profile) => profile._id
          );
          const response = await CIMDProfileOps.deleteCIMDProfiles({
            resultCallback: callback,
            state,
          });
          expect(response.map((profile) => profile._id)).toMatchSnapshot();
          expect(calls).toHaveLength(response.length);
          expect(calls).toMatchSnapshot();
        });

        test('2: Delete all CIMD profiles without a result callback', async () => {
          // the realm is empty after the first test: create two profiles to delete
          await CIMDProfileOps.createCIMDProfile({
            profileId: TestData.ids.all4,
            profileData: TestData.rich(24),
            state,
          });
          await CIMDProfileOps.createCIMDProfile({
            profileId: TestData.ids.all5,
            profileData: TestData.minimal(25),
            state,
          });
          const response = await CIMDProfileOps.deleteCIMDProfiles({ state });
          expect(response.map((profile) => profile._id)).toMatchSnapshot();
        });

        test('3: Delete all CIMD profiles of a realm that has none', async () => {
          const response = await CIMDProfileOps.deleteCIMDProfiles({ state });
          expect(response).toStrictEqual([]);
        });
      });
    }
  });
});
