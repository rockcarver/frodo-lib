/**
 * To record and update snapshots, you must perform 4 steps in order:
 *
 * 1. Record API responses & create/update snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record get policy tests
 *    Phase 2: Record set policy tests
 *    Phase 3: Record enable policy tests
 *    Phase 4: Record disable policy tests
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
 *        FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record EnvContentSecurityPolicyOps
 *        FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record EnvContentSecurityPolicyOps
 *        FRODO_RECORD_PHASE=3 FRODO_HOST=frodo-dev npm run test:record EnvContentSecurityPolicyOps
 *        FRODO_RECORD_PHASE=4 FRODO_HOST=frodo-dev npm run test:record EnvContentSecurityPolicyOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update EnvContentSecurityPolicyOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only EnvContentSecurityPolicyOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as EnvContentSecurityPolicyApi from '../../api/cloud/EnvContentSecurityPolicyApi';
import * as EnvContentSecurityPolicyOps from './EnvContentSecurityPolicyOps';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { state } from '../../index';
import { ContentSecurityPolicy } from '../../api/cloud/EnvContentSecurityPolicyApi';
import { cloneDeep } from '../../utils/JsonUtils';

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

describe('EnvContentSecurityPolicyOps', () => {
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
  const activeTestPolicy: ContentSecurityPolicy = {
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
  const inactiveTestPolicy: ContentSecurityPolicy = cloneDeep(activeTestPolicy);
  inactiveTestPolicy.active = false;
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    // read
    if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1'
    ) {
      await Promise.allSettled([
        stageEnforcedPolicy(activeTestPolicy),
        stageReportOnlyPolicy(activeTestPolicy),
      ]);
    }
    // update
    else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2'
    ) {
      await Promise.allSettled([
        stageEnforcedPolicy(emptyPolicy),
        stageReportOnlyPolicy(emptyPolicy),
      ]);
    }
    // enable
    else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3'
    ) {
      await Promise.allSettled([
        stageEnforcedPolicy(inactiveTestPolicy),
        stageReportOnlyPolicy(inactiveTestPolicy),
      ]);
    }
    // disable
    else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '4'
    ) {
      await Promise.allSettled([
        stageEnforcedPolicy(activeTestPolicy),
        stageReportOnlyPolicy(activeTestPolicy),
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
    describe('readEnforcedContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyOps.readEnforcedContentSecurityPolicy
        ).toBeDefined();
      });

      test('1: Get enforced content security policy - success', async () => {
        const response =
          await EnvContentSecurityPolicyOps.readEnforcedContentSecurityPolicy({
            state,
          });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readReportOnlyContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyOps.readReportOnlyContentSecurityPolicy
        ).toBeDefined();
      });

      test('1: Get report-only content security policy - success', async () => {
        const response =
          await EnvContentSecurityPolicyOps.readReportOnlyContentSecurityPolicy(
            {
              state,
            }
          );
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
    describe('updateEnforcedContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyOps.updateEnforcedContentSecurityPolicy
        ).toBeDefined();
      });

      test(`1: Set enforced content security policy - success`, async () => {
        const response =
          await EnvContentSecurityPolicyOps.updateEnforcedContentSecurityPolicy(
            {
              policy: activeTestPolicy,
              state,
            }
          );
        expect(response).toMatchSnapshot();
      });
    });

    describe('updateReportOnlyContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyOps.updateReportOnlyContentSecurityPolicy
        ).toBeDefined();
      });

      test(`1: Set report-only content security policy - success`, async () => {
        const response =
          await EnvContentSecurityPolicyOps.updateReportOnlyContentSecurityPolicy(
            {
              policy: activeTestPolicy,
              state,
            }
          );
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 3 - Enable Content Security Policy
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3')
  ) {
    describe('enableEnforcedContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyOps.enableEnforcedContentSecurityPolicy
        ).toBeDefined();
      });

      test(`1: Enable enforced content security policy - success`, async () => {
        const response =
          await EnvContentSecurityPolicyOps.enableEnforcedContentSecurityPolicy(
            {
              state,
            }
          );
        expect(response).toMatchSnapshot();
      });
    });

    describe('enableReportOnlyContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyOps.enableReportOnlyContentSecurityPolicy
        ).toBeDefined();
      });

      test(`1: Enable report-only content security policy - success`, async () => {
        const response =
          await EnvContentSecurityPolicyOps.enableReportOnlyContentSecurityPolicy(
            {
              state,
            }
          );
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 4 - Disable Content Security Policy
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '4')
  ) {
    describe('disableEnforcedContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyOps.disableEnforcedContentSecurityPolicy
        ).toBeDefined();
      });

      test(`1: Disable enforced content security policy - success`, async () => {
        const response =
          await EnvContentSecurityPolicyOps.disableEnforcedContentSecurityPolicy(
            {
              state,
            }
          );
        expect(response).toMatchSnapshot();
      });
    });

    describe('disableReportOnlyContentSecurityPolicy()', () => {
      test('0: Method is implemented', async () => {
        expect(
          EnvContentSecurityPolicyOps.disableReportOnlyContentSecurityPolicy
        ).toBeDefined();
      });

      test(`1: Disable report-only content security policy - success`, async () => {
        const response =
          await EnvContentSecurityPolicyOps.disableReportOnlyContentSecurityPolicy(
            {
              state,
            }
          );
        expect(response).toMatchSnapshot();
      });
    });
  }
});
