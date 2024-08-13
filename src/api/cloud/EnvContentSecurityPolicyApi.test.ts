/**
 * To record and update snapshots, you must perform 4 steps in order:
 *
 * 1. Record API responses & create/update snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record get policy tests
 *    Phase 2: Record set policy tests
 *
 *    Because content security policies are global singletons, get and set tests interfere
 *    with each other and have to be run in separate phases.
 *
 *    To record and create/update snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE Content Security Policy!!!
 *
 *        FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record EnvContentSecurityPolicyApi
 *        FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record EnvContentSecurityPolicyApi
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update EnvContentSecurityPolicyApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only EnvContentSecurityPolicyApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as EnvContentSecurityPolicyApi from './EnvContentSecurityPolicyApi';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { state } from '../../index';
import { ContentSecurityPolicy } from './EnvContentSecurityPolicyApi';

const ctx = autoSetupPolly();

async function stageEnforcedPolicy(policy: ContentSecurityPolicy) {
  try {
    await EnvContentSecurityPolicyApi.setEnforcedContentSecurityPolicy({
      policy,
      state,
    });
  } catch (error) {
    console.debug('error staging enforced content security policy', error);
  }
}

async function stageReportOnlyPolicy(policy: ContentSecurityPolicy) {
  try {
    await EnvContentSecurityPolicyApi.setReportOnlyContentSecurityPolicy({
      policy,
      state,
    });
  } catch (error) {
    console.debug('error staging report-only content security policy', error);
  }
}

describe('EnvContentSecurityPolicyApi', () => {
  const emptyPolicy: ContentSecurityPolicy = {
    active: false,
    directives: {},
  };
  const defaultReportOnlyPolicy: ContentSecurityPolicy = {
    active: true,
    directives: {
      'frame-ancestors': ["'self'"],
      'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
    },
  };
  const testPolicy: ContentSecurityPolicy = {
    active: true,
    directives: {
      'frame-ancestors': ["'self'"],
      referrer: [
        "'no-referrer'",
        "'none-when-downgrade'",
        "'origin'",
        "'origin-when-cross-origin'",
        "'unsafe-url'",
      ],
      sandbox: [
        "'allow-forms'",
        "'allow-same-origin'",
        "'allow-scripts'",
        "'allow-top-navigation'",
        "'allow-popups'",
        "'allow-pointer-lock'",
      ],
      'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
    },
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1'
    ) {
      await Promise.allSettled([
        stageEnforcedPolicy(testPolicy),
        stageReportOnlyPolicy(testPolicy),
      ]);
    } else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2'
    ) {
      await Promise.allSettled([
        stageEnforcedPolicy(emptyPolicy),
        stageReportOnlyPolicy(emptyPolicy),
      ]);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await Promise.allSettled([
        stageEnforcedPolicy(emptyPolicy),
        stageReportOnlyPolicy(defaultReportOnlyPolicy),
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

  // Phase 1 - Get Content Security Policy
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('getEnforcedContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyApi.getEnforcedContentSecurityPolicy
        ).toBeDefined();
      });

      test('1: Get enforced content security policy - success', async () => {
        const response =
          await EnvContentSecurityPolicyApi.getEnforcedContentSecurityPolicy({
            state,
          });
        expect(response).toMatchSnapshot();
      });
    });

    describe('getReportOnlyContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyApi.getReportOnlyContentSecurityPolicy
        ).toBeDefined();
      });

      test('1: Get report-only content security policy - success', async () => {
        const response =
          await EnvContentSecurityPolicyApi.getReportOnlyContentSecurityPolicy({
            state,
          });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 2 - Set Content Security Policy
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('setEnforcedContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyApi.setEnforcedContentSecurityPolicy
        ).toBeDefined();
      });

      test(`1: Set enforced content security policy - success`, async () => {
        const response =
          await EnvContentSecurityPolicyApi.setEnforcedContentSecurityPolicy({
            policy: testPolicy,
            state,
          });
        expect(response).toMatchSnapshot();
      });
    });

    describe('setReportOnlyContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyApi.setReportOnlyContentSecurityPolicy
        ).toBeDefined();
      });

      test(`1: Set report-only content security policy - success`, async () => {
        const response =
          await EnvContentSecurityPolicyApi.setReportOnlyContentSecurityPolicy({
            policy: testPolicy,
            state,
          });
        expect(response).toMatchSnapshot();
      });
    });
  }
});
