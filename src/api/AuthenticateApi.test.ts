/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record_noauth
 *    script and override all the connection state variables supplied to the
 *    getTokens() function by the test to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 \
 *        FRODO_HOST=https://openam-frodo-dev.forgeblocks.com/am \
 *        FRODO_REALM=alpha \
 *        FRODO_USERNAME=vscheuber@gmail.com \
 *        FRODO_PASSWORD='S3cr3!S@uc3' \
 *        FRODO_AUTHENTICATION_SERVICE=PasswordGrant \
 *        npm run test:record_noauth AuthenticateApi
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update AuthenticateApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test AuthenticateApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as AuthenticateApi from './AuthenticateApi';
import { state } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { defaultMatchRequestsBy, filterRecording } from '../utils/PollyUtils';
import { fillCallbacks } from '../ops/CallbackOps';
import { AuthenticateStep } from './AuthenticateApi';

// need to modify the default matching rules to allow the mocking to work for an authentication flow.
const matchConfig = defaultMatchRequestsBy();
matchConfig.body = false; // oauth flows are tricky because of the PKCE challenge, which is different for each request
matchConfig.order = true; // since we instruct Polly not to match the body, we need to enable ordering of the requests

const ctx = autoSetupPolly(matchConfig);

describe('AuthenticateApi', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('step()', () => {
    test('0: Method is implemented', async () => {
      expect(AuthenticateApi.step).toBeDefined();
    });

    test("1: Single step login journey 'PasswordGrant'", async () => {
      state.setHost(
        process.env.FRODO_HOST || 'https://openam-frodo-dev.forgeblocks.com/am'
      );
      state.setRealm(process.env.FRODO_REALM || 'alpha');
      state.setUsername(process.env.FRODO_USERNAME || 'mockUser');
      state.setPassword(process.env.FRODO_PASSWORD || 'mockPassword');
      state.setAuthenticationService(
        process.env.FRODO_AUTHENTICATION_SERVICE || 'PasswordGrant'
      );
      const config = {
        headers: {
          'X-OpenAM-Username': state.getUsername(),
          'X-OpenAM-Password': state.getPassword(),
        },
      };
      const step = await AuthenticateApi.step({
        body: {},
        config,
        realm: state.getRealm(),
        state,
      });
      expect(step).toMatchSnapshot();
    });

    test("2: Two step login journey 'PasswordGrant'", async () => {
      state.setHost(
        process.env.FRODO_HOST || 'https://openam-frodo-dev.forgeblocks.com/am'
      );
      state.setRealm(process.env.FRODO_REALM || 'alpha');
      state.setUsername(process.env.FRODO_USERNAME || 'mockUser');
      state.setPassword(process.env.FRODO_PASSWORD || 'mockPassword');
      state.setAuthenticationService(
        process.env.FRODO_AUTHENTICATION_SERVICE || 'PasswordGrant'
      );
      const step1 = await AuthenticateApi.step({
        body: {},
        config: {},
        realm: state.getRealm(),
        state,
      });
      expect(step1).toMatchSnapshot();
      const body = fillCallbacks({
        step: step1 as AuthenticateStep,
        map: {
          IDToken1: state.getUsername() as string,
          IDToken2: state.getPassword() as string,
        },
      });
      const step2 = await AuthenticateApi.step({
        body,
        config: {},
        realm: state.getRealm(),
        state,
      });
      expect(step2).toMatchSnapshot();
    });
  });
});
