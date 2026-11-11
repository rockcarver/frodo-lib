/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    This step breaks down into 2 phases, because the tests of the second phase delete what the first phase left:
 *
 *    Phase 1: Create, update, read and list CIMD profiles; the Cloud root realm (read-only answers of the server)
 *    Phase 2: Delete by id
 *
 *    CIMD profiles exist from PingAM 9.0 on; today only Identity Cloud tenants offer them. Record against a
 *    non-production tenant that lists the agent type 'CIMDProfile'. The tests run in the realm 'bravo' (see
 *    TEST_REALM in src/test/setup/CIMDProfileSetup.ts). Recording refuses to start if that realm holds a CIMD profile
 *    whose id does not start with 'FrodoTest', so the recordings never hold the name of somebody else's profile, and
 *    it deletes every profile whose id starts with 'FrodoTest' before and after each phase. The tests of a phase build
 *    on each other (a profile that one test creates is read by the next), so record a phase in one run, in the order
 *    of the file.
 *
 *    To record and update snapshots, you must call the test:record script and override all the connection state
 *    variables required to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record -- src/api/OAuth2CIMDProfileApi.test.ts
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record -- src/api/OAuth2CIMDProfileApi.test.ts
 *
 *    The above commands assume that you have a connection profile for 'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording, the snapshots are already updated as that happens in one go. To rewrite them from the
 *    recordings alone, run:
 *
 *        FRODO_DEBUG=1 npm run test:update -- src/api/OAuth2CIMDProfileApi.test.ts
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in replay mode and make sure they all
 *    succeed as well:
 *
 *        npm run test:only -- src/api/OAuth2CIMDProfileApi.test.ts
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output in case things don't function as
 * expected
 */
import { state } from '../index';
import * as TestData from '../test/setup/CIMDProfileSetup';
import { summarizeError } from '../test/setup/ErrorSummary';
import * as CIMDProfileApi from './OAuth2CIMDProfileApi';

/** Run a call that must fail and hand back its error */
async function failure(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error('The call was expected to fail');
}

describe('OAuth2CIMDProfileApi', () => {
  TestData.setup(false);

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
      await TestData.removeTestProfiles();
    }
  });

  describe('Cloud Tests', () => {
    // Phase 1
    if (TestData.phase(1)) {
      describe('encodeCIMDProfileId()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileApi.encodeCIMDProfileId).toBeDefined();
        });

        test('1: Encode ids for the last segment of a path', async () => {
          const ids = [
            'FrodoTestCIMDProfile1',
            TestData.oddId,
            "a!b'c(d)e*f",
            'a b',
            'a/b?c#d',
          ];
          expect(ids.map(CIMDProfileApi.encodeCIMDProfileId)).toMatchSnapshot();
        });
      });

      describe('getCIMDProfiles()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileApi.getCIMDProfiles).toBeDefined();
        });

        test('1: Get all CIMD profiles of a realm that has none', async () => {
          const response = await CIMDProfileApi.getCIMDProfiles({ state });
          expect(response).toMatchSnapshot();
        });
      });

      describe('getCIMDProfileTemplate()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileApi.getCIMDProfileTemplate).toBeDefined();
        });

        test('1: Get the CIMD profile template', async () => {
          const response = await CIMDProfileApi.getCIMDProfileTemplate({
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('getCIMDProfileSchema()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileApi.getCIMDProfileSchema).toBeDefined();
        });

        test('1: Get the CIMD profile schema', async () => {
          const response = await CIMDProfileApi.getCIMDProfileSchema({ state });
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

      describe('putCIMDProfile()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileApi.putCIMDProfile).toBeDefined();
        });

        test(`1: Create CIMD profile '${TestData.ids.profile1}' (plain values)`, async () => {
          const response = await CIMDProfileApi.putCIMDProfile({
            profileId: TestData.ids.profile1,
            profileData: TestData.rich(1),
            failIfExists: true,
            state,
          });
          expect(response.status).toBe(201);
          // a create is refused by the server if the id exists, and the api version is the one of the module
          const request = TestData.lastRequest('PUT');
          expect(request.headers['if-none-match']).toBe('*');
          expect(request.headers['accept-api-version']).toBe(
            'protocol=2.1,resource=1.0'
          );
          expect(response).toMatchSnapshot();
        });

        test(`2: Create CIMD profile '${TestData.ids.profile2}' (wrapped values)`, async () => {
          const response = await CIMDProfileApi.putCIMDProfile({
            profileId: TestData.ids.profile2,
            profileData: TestData.wrapped(2),
            failIfExists: true,
            state,
          });
          expect(response.status).toBe(201);
          // the server completes the profile with its defaults and answers the wrapped shape
          expect(TestData.shapeOf(response.data)).toMatchSnapshot();
        });

        test(`3: Create CIMD profile '${TestData.ids.profile3}' (minimal body)`, async () => {
          const response = await CIMDProfileApi.putCIMDProfile({
            profileId: TestData.ids.profile3,
            profileData: TestData.minimal(3),
            failIfExists: true,
            state,
          });
          expect(response.status).toBe(201);
          expect(TestData.shapeOf(response.data)).toMatchSnapshot();
        });

        test(`4: Create CIMD profile '${TestData.ids.profile1}' that already exists`, async () => {
          const error = await failure(
            CIMDProfileApi.putCIMDProfile({
              profileId: TestData.ids.profile1,
              profileData: TestData.rich(1),
              failIfExists: true,
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('5: Create a CIMD profile with a pattern the server refuses', async () => {
          const error = await failure(
            CIMDProfileApi.putCIMDProfile({
              profileId: 'FrodoTestCIMDInvalid',
              profileData: TestData.invalidPattern(7),
              failIfExists: true,
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('6: Create a CIMD profile with attributes the server does not know', async () => {
          const error = await failure(
            CIMDProfileApi.putCIMDProfile({
              profileId: 'FrodoTestCIMDUnknown',
              profileData: TestData.unknownAttributes(8),
              failIfExists: true,
              state,
            })
          );
          const summary = summarizeError(error) as {
            status: number;
            data: { message: string; detail: { validAttributes: string[] } };
          };
          expect(summary.status).toBe(400);
          expect(summary.data.message).toBe('Invalid attribute specified.');
          // the server lists the attributes it accepts: 105 names, the groups' attributes flattened
          expect(summary.data.detail.validAttributes).toEqual(
            expect.arrayContaining([
              'cimdClientIdUrlPatterns',
              'cimdMetadataDenyList',
              'cimdSsrfProtectionEnabled',
            ])
          );
          expect(summary.data.detail.validAttributes).toMatchSnapshot();
        });

        test(`7: Create CIMD profile '${TestData.oddId}' (an id with characters that need encoding)`, async () => {
          const response = await CIMDProfileApi.putCIMDProfile({
            profileId: TestData.oddId,
            profileData: TestData.minimal(9),
            failIfExists: true,
            state,
          });
          expect(response.status).toBe(201);
          expect(response.data._id).toBe(TestData.oddId);
        });

        test(`8: Create CIMD profile '${TestData.ids.caseOriginal}'`, async () => {
          const response = await CIMDProfileApi.putCIMDProfile({
            profileId: TestData.ids.caseOriginal,
            profileData: TestData.minimal(10),
            failIfExists: true,
            state,
          });
          expect(response.status).toBe(201);
        });

        test(`9: Create CIMD profile '${TestData.ids.caseOther}' that exists with the case of another id`, async () => {
          const error = await failure(
            CIMDProfileApi.putCIMDProfile({
              profileId: TestData.ids.caseOther,
              profileData: TestData.minimal(10),
              failIfExists: true,
              state,
            })
          );
          // ids are unique without regard to case
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });

      describe('getCIMDProfile()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileApi.getCIMDProfile).toBeDefined();
        });

        test(`1: Get CIMD profile '${TestData.ids.profile1}' (wrapped shape)`, async () => {
          const response = await CIMDProfileApi.getCIMDProfile({
            profileId: TestData.ids.profile1,
            state,
          });
          expect(response).toMatchSnapshot();
        });

        test(`2: Get CIMD profile '${TestData.oddId}'`, async () => {
          const response = await CIMDProfileApi.getCIMDProfile({
            profileId: TestData.oddId,
            state,
          });
          expect(response._id).toBe(TestData.oddId);
          expect(TestData.shapeOf(response)).toMatchSnapshot();
        });

        test(`3: Get CIMD profile '${TestData.ids.caseOther}' with the case of another id`, async () => {
          const response = await CIMDProfileApi.getCIMDProfile({
            profileId: TestData.ids.caseOther,
            state,
          });
          // the single read finds it and echoes the case of the request
          expect(response._id).toBe(TestData.ids.caseOther);
        });

        test('4: Get a CIMD profile that does not exist', async () => {
          const error = await failure(
            CIMDProfileApi.getCIMDProfile({
              profileId: 'FrodoTestCIMDMissing',
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });

      describe('getCIMDProfiles() with profiles', () => {
        test('1: Get all CIMD profiles of the realm (plain shape)', async () => {
          const response = await CIMDProfileApi.getCIMDProfiles({ state });
          expect(response.resultCount).toBe(response.result.length);
          expect(
            response.result.map((profile) => profile._id)
          ).toMatchSnapshot();
          // the list holds the plain values; the sparse and the completed profiles differ in their attributes
          expect(response.result.map(TestData.shapeOf)).toMatchSnapshot();
          expect(
            response.result.find((p) => p._id === TestData.ids.profile1)
          ).toMatchSnapshot();
        });
      });

      describe('putCIMDProfile() as an update', () => {
        test(`1: Update CIMD profile '${TestData.ids.profile1}' (replace)`, async () => {
          const response = await CIMDProfileApi.putCIMDProfile({
            profileId: TestData.ids.profile1,
            profileData: {
              ...TestData.rich(1),
              coreOAuth2ClientConfig: {
                status: 'Active',
                clientName: ['FrodoTest CIMD profile 1 (updated)'],
              },
            },
            state,
          });
          expect(response.status).toBe(200);
          // a write replaces what is stored: the attributes that were not sent are gone
          expect(TestData.shapeOf(response.data)).toMatchSnapshot();
        });

        test(`2: Update CIMD profile '${TestData.ids.profile2}' with the answer of a read (the revision is not sent)`, async () => {
          const read = await CIMDProfileApi.getCIMDProfile({
            profileId: TestData.ids.profile2,
            state,
          });
          expect(typeof read._rev).toBe('string');
          const response = await CIMDProfileApi.putCIMDProfile({
            profileId: TestData.ids.profile2,
            profileData: read,
            state,
          });
          expect(response.status).toBe(200);
          // an update is an upsert: the server is not told to refuse an existing id
          expect(
            TestData.lastRequest('PUT').headers['if-none-match']
          ).toBeUndefined();
          // the object that was passed in is not changed
          expect(typeof read._rev).toBe('string');
          expect(TestData.shapeOf(response.data)).toMatchSnapshot();
        });
      });

      describe('Cloud root realm', () => {
        // the root realm of an Identity Cloud tenant offers no CIMD profiles: every request is answered 403
        beforeAll(() => {
          TestData.setTestRealm('/');
        });
        afterAll(async () => {
          if (process.env.FRODO_POLLY_MODE === 'record') {
            // nothing is created in the root realm, but make sure of it
            try {
              await CIMDProfileApi.deleteCIMDProfile({
                profileId: 'FrodoTestCIMDRoot',
                state,
              });
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
              // ignore: it does not exist
            }
          }
          TestData.setTestRealm();
        });

        test('1: Get all CIMD profiles of the root realm', async () => {
          const error = await failure(
            CIMDProfileApi.getCIMDProfiles({ state })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('2: Get a CIMD profile of the root realm', async () => {
          const error = await failure(
            CIMDProfileApi.getCIMDProfile({
              profileId: 'FrodoTestCIMDRoot',
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('3: Get the template and the schema of the root realm', async () => {
          const template = await failure(
            CIMDProfileApi.getCIMDProfileTemplate({ state })
          );
          const schema = await failure(
            CIMDProfileApi.getCIMDProfileSchema({ state })
          );
          expect([
            summarizeError(template),
            summarizeError(schema),
          ]).toMatchSnapshot();
        });

        test('4: Create a CIMD profile in the root realm', async () => {
          const error = await failure(
            CIMDProfileApi.putCIMDProfile({
              profileId: 'FrodoTestCIMDRoot',
              profileData: TestData.minimal(4),
              failIfExists: true,
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test('5: Delete a CIMD profile in the root realm', async () => {
          const error = await failure(
            CIMDProfileApi.deleteCIMDProfile({
              profileId: 'FrodoTestCIMDRoot',
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });
      });
    }

    // Phase 2
    if (TestData.phase(2)) {
      describe('deleteCIMDProfile()', () => {
        test('0: Method is implemented', async () => {
          expect(CIMDProfileApi.deleteCIMDProfile).toBeDefined();
        });

        test(`1: Delete CIMD profile '${TestData.ids.delete1}'`, async () => {
          const response = await CIMDProfileApi.deleteCIMDProfile({
            profileId: TestData.ids.delete1,
            state,
          });
          // the answer is the deleted profile in the wrapped shape
          expect(response._id).toBe(TestData.ids.delete1);
          expect(response).toMatchSnapshot();
        });

        test(`2: Delete CIMD profile '${TestData.ids.delete1}' again`, async () => {
          const error = await failure(
            CIMDProfileApi.deleteCIMDProfile({
              profileId: TestData.ids.delete1,
              state,
            })
          );
          expect(summarizeError(error)).toMatchSnapshot();
        });

        test(`3: Delete CIMD profile '${TestData.oddId}'`, async () => {
          const response = await CIMDProfileApi.deleteCIMDProfile({
            profileId: TestData.oddId,
            state,
          });
          expect(response._id).toBe(TestData.oddId);
        });
      });
    }
  });
});
