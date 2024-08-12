/**
 * To record and update snapshots, you must perform 4 steps in order:
 *
 * 1. Record API responses & create/update snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record get cookie domains tests
 *    Phase 2: Record set cookie domains tests
 *
 *    Because cookie domain settings is a global singleton, get and set tests interfere
 *    with each other and have to be run in separate phases.
 *
 *    To record and create/update snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE Cookie Domains Settings!!!
 *
 *        FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record EnvCookieDomainsOps
 *        FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record EnvCookieDomainsOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update EnvCookieDomainsOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only EnvCookieDomainsOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as EnvCookieDomainsApi from '../../api/cloud/EnvCookieDomainsApi';
import * as EnvCookieDomainsOps from './EnvCookieDomainsOps';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { state } from '../../index';
import { CookieDomains } from '../../api/cloud/EnvCookieDomainsApi';

const ctx = autoSetupPolly();

async function stageCookieDomains(domains: CookieDomains) {
  try {
    await EnvCookieDomainsApi.setCookieDomains({
      domains,
      state,
    });
  } catch (error) {
    console.debug('error staging cookie domains', error);
  }
}

describe('EnvCookieDomainsOps', () => {
  const empty: CookieDomains = {
    domains: [],
  };
  const testDomains: CookieDomains = {
    domains: ['mytestrun.com', 'mytest.run'],
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1'
    ) {
      await Promise.allSettled([stageCookieDomains(testDomains)]);
    } else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2'
    ) {
      await Promise.allSettled([stageCookieDomains(empty)]);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await Promise.allSettled([stageCookieDomains(empty)]);
    }
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  // Phase 1 - Get cookie domains
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('readCookieDomains()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvCookieDomainsOps.readCookieDomains).toBeDefined();
      });

      test('1: Read cookie domains - success', async () => {
        const response = await EnvCookieDomainsOps.readCookieDomains({
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 2 - Set cookie domains
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('updateCookieDomains()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvCookieDomainsOps.updateCookieDomains).toBeDefined();
      });

      test(`1: Update cookie domains - success`, async () => {
        const response = await EnvCookieDomainsOps.updateCookieDomains({
          domains: testDomains,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });
  }
});
