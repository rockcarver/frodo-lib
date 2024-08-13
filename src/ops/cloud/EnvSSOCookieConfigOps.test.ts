/**
 * To record and update snapshots, you must perform 4 steps in order:
 *
 * 1. Record API responses & create/update snapshots
 *
 *    This step breaks down into 3 phases:
 *
 *    Phase 1: Record get SSO Cookie Config tests
 *    Phase 2: Record set SSO Cookie Config tests
 *    Phase 2: Record reset SSO Cookie Config tests
 *
 *    Because SSO Cookie Config is a global singleton, get and set tests interfere
 *    with each other and have to be run in separate phases.
 *
 *    To record and create/update snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE Custom SSO Cookie Config!!!
 *
 *        FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record EnvSSOCookieConfigOps
 *        FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record EnvSSOCookieConfigOps
 *        FRODO_RECORD_PHASE=3 FRODO_HOST=frodo-dev npm run test:record EnvSSOCookieConfigOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update EnvSSOCookieConfigOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only EnvSSOCookieConfigOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as EnvSSOCookieConfigApi from '../../api/cloud/EnvSSOCookieConfigApi';
import * as EnvSSOCookieConfigOps from './EnvSSOCookieConfigOps';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { state } from '../../index';
import { SSOCookieConfig } from '../../api/cloud/EnvSSOCookieConfigApi';

const ctx = autoSetupPolly();

describe('EnvSSOCookieConfigOps', () => {
  const customSSOCookieConfig: SSOCookieConfig = { name: 'myCustomTestCookieName' };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1'
    ) {
      await Promise.allSettled([
        EnvSSOCookieConfigApi.setSSOCookieConfig({
          config: customSSOCookieConfig,
          state,
        }),
      ]);
    } else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2'
    ) {
      await Promise.allSettled([
        EnvSSOCookieConfigApi.resetSSOCookieConfig({ state }),
      ]);
    } else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3'
    ) {
      await Promise.allSettled([
        EnvSSOCookieConfigApi.setSSOCookieConfig({
          config: customSSOCookieConfig,
          state,
        }),
      ]);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await Promise.allSettled([
        EnvSSOCookieConfigApi.resetSSOCookieConfig({ state }),
      ]);
    }
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  // Phase 1 - Get SSO Cookie Config
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('readSSOCookieConfig()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvSSOCookieConfigOps.readSSOCookieConfig).toBeDefined();
      });

      test(`1: Read SSO Cookie Config - success`, async () => {
        const response = await EnvSSOCookieConfigOps.readSSOCookieConfig({
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 2 - Set SSO Cookie Config
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('updateSSOCookieConfig()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvSSOCookieConfigOps.updateSSOCookieConfig).toBeDefined();
      });

      test(`1: Update custom SSO cookie config - success`, async () => {
        const response = await EnvSSOCookieConfigOps.updateSSOCookieConfig({
          config: customSSOCookieConfig,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 3 - Reset SSO Cookie Config
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3')
  ) {
    describe('resetSSOCookieConfig()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvSSOCookieConfigOps.resetSSOCookieConfig).toBeDefined();
      });

      test(`1: Reset custom SSO cookie config - success`, async () => {
        const response = await EnvSSOCookieConfigOps.resetSSOCookieConfig({
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }
});
