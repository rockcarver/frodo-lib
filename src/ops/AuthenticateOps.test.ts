/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record_noauth
 *    script and override all the connection state variables supplied to the
 *    getTokens() function by the test to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=https://openam-volker-dev.forgeblocks.com/am \
 *        FRODO_USERNAME=volker.scheuber@forgerock.com FRODO_PASSWORD='S3cr3!S@uc3' \
 *        npm run test:record_noauth AuthenticateOps
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update AuthenticateOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test AuthenticateOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { jest } from '@jest/globals';
import { Authenticate, state } from '../index';
import {
  autoSetupPolly,
  defaultMatchRequestsBy,
} from '../utils/AutoSetupPolly';

// need to modify the default matching rules to allow the mocking to work for an authentication flow.
const matchConfig = defaultMatchRequestsBy();
matchConfig.body = false; // oauth flows are tricky because of the PKCE challenge, which is different for each request
matchConfig.order = true; // since we instruct Polly not to match the body, we need to enable ordering of the requests

autoSetupPolly(matchConfig);

// Increase timeout for this test as pipeline keeps failing with error:
// Timeout - Async callback was not invoked within the 5000 ms timeout specified by jest.setTimeout.
jest.setTimeout(30000);

describe('AuthenticateOps', () => {
  describe('getTokens()', () => {
    test('0: Method is implemented', async () => {
      expect(Authenticate.getTokens).toBeDefined();
    });

    test('1: Authenticate successfully as user', async () => {
      state.setHost(
        process.env.FRODO_HOST || 'https://openam-frodo-dev.forgeblocks.com/am'
      );
      state.setRealm(process.env.FRODO_REALM || 'alpha');
      state.setUsername(process.env.FRODO_USERNAME || 'mockUser');
      state.setPassword(process.env.FRODO_PASSWORD || 'mockPassword');
      const result = await Authenticate.getTokens();
      expect(result).toBe(true);
      expect(state.getDeploymentType()).toEqual('cloud');
      expect(state.getCookieName()).toBeTruthy();
      expect(state.getCookieValue()).toBeTruthy();
      expect(state.getBearerToken()).toBeTruthy();
      expect(state.getCookieName()).toMatchSnapshot();
      expect(state.getCookieValue()).toMatchSnapshot();
      expect(state.getBearerToken()).toMatchSnapshot();
    });
  });
});
