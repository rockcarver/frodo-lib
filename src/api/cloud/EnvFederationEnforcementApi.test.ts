/**
 * To record and update snapshots, you must perform 4 steps in order:
 *
 * 1. Record API responses & create/update snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record get federation enforcement tests
 *    Phase 2: Record set federation enforcement tests
 *
 *    Because federation enforcement settings is a global singleton, get and set tests interfere
 *    with each other and have to be run in separate phases.
 *
 *    To record and create/update snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE Federation Enforcement Settings!!!
 *
 *        FRODO_FORCE_LOGIN_AS_USER=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record EnvFederationEnforcementApi
 *        FRODO_FORCE_LOGIN_AS_USER=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record EnvFederationEnforcementApi
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update EnvFederationEnforcementApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only EnvFederationEnforcementApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as EnvFederationEnforcementApi from './EnvFederationEnforcementApi';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { state } from '../../index';
import { FederationEnforcement } from './EnvFederationEnforcementApi';

const ctx = autoSetupPolly();

async function stageFederationEnforcement(config: FederationEnforcement) {
  try {
    await EnvFederationEnforcementApi.setFederationEnforcement({
      config,
      state,
    });
  } catch (error) {
    console.debug('error staging federation enforcement', error);
  }
}

describe('EnvFederationEnforcementApi', () => {
  const none: FederationEnforcement = {
    groups: 'none',
  };
  const noneGlobal: FederationEnforcement = {
    groups: 'non-global',
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1'
    ) {
      await Promise.allSettled([stageFederationEnforcement(noneGlobal)]);
    } else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2'
    ) {
      await Promise.allSettled([stageFederationEnforcement(none)]);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await Promise.allSettled([stageFederationEnforcement(none)]);
    }
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  // Phase 1 - Get federation enforcement
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('getFederationEnforcement()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvFederationEnforcementApi.getFederationEnforcement
        ).toBeDefined();
      });

      test('1: Get federation enforcement - success', async () => {
        const response =
          await EnvFederationEnforcementApi.getFederationEnforcement({
            state,
          });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 2 - Set federation enforcement
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('setFederationEnforcement()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvFederationEnforcementApi.setFederationEnforcement
        ).toBeDefined();
      });

      test(`1: Set federation enforcement - success`, async () => {
        const response =
          await EnvFederationEnforcementApi.setFederationEnforcement({
            config: noneGlobal,
            state,
          });
        expect(response).toMatchSnapshot();
      });
    });
  }
});
