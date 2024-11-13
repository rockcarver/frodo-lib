/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record tests that require cloud deployment
 *    Phase 2: Record tests that require classic deployment
 *
 *    Because certain tests can only be successfully ran in classic deployments and/or
 *    cloud deployments, they have to be run in groups so that it is possible to record
 *    each group of tests using their appropriate deployments. Make sure to set the
 *    FRODO_HOST and FRODO_REALM environment variables when recording to ensure you
 *    are using the right deployment (by default these are set to the frodo-dev cloud tenant
 *    and alpha realm respectively). Alternatively, you can use FRODO_DEPLOY=classic to
 *    use the default settings of host/realm for classic deployments.
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state required to connect to the
 *    env to record from:
 *
 *    ATTENTION: For the recording to succeed, you MUST make sure to use a
 *               user account, not a service account.
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record AuthenticationSettingsOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update AuthenticationSettingsOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only AuthenticationSettingsOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { autoSetupPolly, setDefaultState } from "../utils/AutoSetupPolly";
import { filterRecording } from "../utils/PollyUtils";
import * as AuthenticationSettingsOps from "./AuthenticationSettingsOps";
import { state } from "../lib/FrodoLib";
import Constants from "../shared/Constants";

const ctx = autoSetupPolly();

describe('AuthenticationSettingsOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('Cloud Tests', () => {
      beforeEach(() => {
        setDefaultState();
      });
      describe('createAuthenticationSettingsExportTemplate()', () => {
        test('0: Method is implemented', async () => {
          expect(AuthenticationSettingsOps.createAuthenticationSettingsExportTemplate).toBeDefined();
        });

        test('1: Create AuthenticationSettings Export Template', async () => {
          const response = AuthenticationSettingsOps.createAuthenticationSettingsExportTemplate({state});
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('readAuthenticationSettings()', () => {
        test('0: Method is implemented', async () => {
          expect(AuthenticationSettingsOps.readAuthenticationSettings).toBeDefined();
        });

        test('1: Read Realm AuthenticationSettings', async () => {
          const response = await AuthenticationSettingsOps.readAuthenticationSettings({globalConfig: false, state});
          expect(response).toMatchSnapshot();
        });
      });

      describe('updateAuthenticationSettings()', () => {
        test('0: Method is implemented', async () => {
          expect(AuthenticationSettingsOps.updateAuthenticationSettings).toBeDefined();
        });
        //TODO: create tests (globalConfig = false)
      });

      describe('exportAuthenticationSettings()', () => {
        test('0: Method is implemented', async () => {
          expect(AuthenticationSettingsOps.exportAuthenticationSettings).toBeDefined();
        });

        test('1: Export Realm AuthenticationSettings', async () => {
          const response = await AuthenticationSettingsOps.exportAuthenticationSettings({globalConfig: false, state});
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('importAuthenticationSettings()', () => {
        test('0: Method is implemented', async () => {
          expect(AuthenticationSettingsOps.importAuthenticationSettings).toBeDefined();
        });
        //TODO: create tests (globalConfig = false)
      });
    });
  }
  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('Classic Tests', () => {
      beforeEach(() => {
        setDefaultState(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
      });
      describe('readAuthenticationSettings()', () => {
        test('2: Read Global AuthenticationSettings', async () => {
          const response = await AuthenticationSettingsOps.readAuthenticationSettings({globalConfig: true, state });
          expect(response).toMatchSnapshot();
        });

        test('3: Read Realm AuthenticationSettings', async () => {
          const response = await AuthenticationSettingsOps.readAuthenticationSettings({globalConfig: false, state });
          expect(response).toMatchSnapshot();
        });
      });

      describe('updateAuthenticationSettings()', () => {
        //TODO: create tests (globalConfig = true)
      });

      describe('exportAuthenticationSettings()', () => {
        test('2: Export Global AuthenticationSettings', async () => {
          const response = await AuthenticationSettingsOps.exportAuthenticationSettings({globalConfig: true, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test('3: Export Realm AuthenticationSettings', async () => {
          const response = await AuthenticationSettingsOps.exportAuthenticationSettings({globalConfig: false, state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('importAuthenticationSettings()', () => {
        //TODO: create tests (globalConfig = true)
      });
    });
  }
});
