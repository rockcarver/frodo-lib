/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record_noauth
 *    script and override all the connection state variables supplied to the
 *    getTokens() function by the test to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=https://openam-frodo-dev.forgeblocks.com/am FRODO_USERNAME=volker.scheuber@forgerock.com FRODO_PASSWORD='S3cr3!S@uc3' npm run test:record_noauth AuthenticateOps
 *
 *    You must also do the same when testing a classic deployment. Additionally, 
 *    if recording any tests involving the Amster private key in the pkcs8.pem 
 *    file, you must add the corresponding public key from pkcs8.pub into your 
 *    authorized_keys file in /path/to/am/security/keys/amster/authorized_keys,
 *    otherwise the key will not be recognized by AM and you will get a 401 error.
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
 *        FRODO_DEBUG=1 npm run test:only AuthenticateOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as AuthenticateOps from './AuthenticateOps';
import { autoSetupPolly, setDefaultState } from '../utils/AutoSetupPolly';
import { defaultMatchRequestsBy, filterRecording } from '../utils/PollyUtils';
import Constants from '../shared/Constants';
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// need to modify the default matching rules to allow the mocking to work for an authentication flow.
const matchConfig = defaultMatchRequestsBy();
matchConfig.body = false; // oauth flows are tricky because of the PKCE challenge, which is different for each request
matchConfig.order = true; // since we instruct Polly not to match the body, we need to enable ordering of the requests

const ctx = autoSetupPolly(matchConfig);

describe('AuthenticateOps', () => {
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
    (process.env.FRODO_POLLY_MODE === 'record_noauth' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('Cloud Tests', () => {
      beforeEach(() => {
        setDefaultState(undefined, true);
      });

      describe('getTokens()', () => {
        test('0: Method is implemented', async () => {
          expect(AuthenticateOps.getTokens).toBeDefined();
        });
    
        test.skip('1: Authenticate successfully as user', async () => {
          state.setDeploymentType(undefined);
          state.setUsername(process.env.FRODO_USERNAME || 'mockUser');
          state.setPassword(process.env.FRODO_PASSWORD || 'mockPassword');
          const result = await AuthenticateOps.getTokens({ state });
          expect(result).toBeTruthy();
          expect(result.subject).toEqual("user " + state.getUsername());
          expect(result.userSessionToken.tokenId).toBeTruthy();
          expect(result.userSessionToken.expires).toBeTruthy();
          expect(result).toMatchSnapshot({
            subject: expect.any(String)
          });
          expect(state.getDeploymentType()).toEqual(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);
          expect(state.getCookieName()).toBeTruthy();
          expect(state.getCookieValue()).toBeTruthy();
          expect(state.getBearerToken()).toBeTruthy();
          expect(state.getCookieName()).toMatchSnapshot();
          expect(state.getCookieValue()).toMatchSnapshot();
          expect(state.getBearerToken()).toMatchSnapshot();
        });

        test.todo("2: Authenticate successfully as service account");
      });
    });
  }
  
  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record_noauth' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('Classic Tests', () => {
      beforeEach(() => {
        setDefaultState(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY, true);
      });
      describe('getTokens()', () => {  
        test('0: Authenticate successfully as user', async () => {
          state.setDeploymentType(undefined);
          state.setUsername(process.env.FRODO_USERNAME || 'mockUser');
          state.setPassword(process.env.FRODO_PASSWORD || 'mockPassword');
          const result = await AuthenticateOps.getTokens({ autoRefresh: false, state });
          expect(result).toBeTruthy();
          expect(result.subject).toEqual("user " + state.getUsername());
          expect(result.userSessionToken.tokenId).toBeTruthy();
          expect(result.userSessionToken.expires).toBeTruthy();
          expect(result).toMatchSnapshot({
            subject: expect.any(String)
          });
          expect(state.getDeploymentType()).toEqual(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
          expect(state.getCookieName()).toBeTruthy();
          expect(state.getCookieValue()).toBeTruthy();
          expect(state.getCookieName()).toMatchSnapshot();
          expect(state.getCookieValue()).toMatchSnapshot();
        });

        test('1: Authenticate successfully using Amster credentials', async () => {
          const privateKey = process.env.FRODO_AMSTER_PRIVATE_KEY || fs.readFileSync(
            path.resolve(
              __dirname,
              '../test/mocks/AuthenticateOps/pkcs8.pem'
            ),
            'utf8'
          );
          state.setDeploymentType(undefined);
          state.setAmsterPrivateKey(privateKey);;
          const result = await AuthenticateOps.getTokens({ autoRefresh: false, state });
          expect(result).toBeTruthy();
          expect(result.subject).toEqual("user " + state.getUsername());
          expect(result.userSessionToken.tokenId).toBeTruthy();
          expect(result.userSessionToken.expires).toBeTruthy();
          expect(result).toMatchSnapshot({
            subject: expect.any(String),
          });
          expect(state.getDeploymentType()).toEqual(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
          expect(state.getAmsterPrivateKey()).toEqual(privateKey);
          expect(state.getAuthenticationService()).toEqual(Constants.DEFAULT_AMSTER_SERVICE);
          expect(state.getUsername()).toEqual(Constants.DEFAULT_CLASSIC_USERNAME);
          expect(state.getCookieName()).toBeTruthy();
          expect(state.getCookieValue()).toBeTruthy();
          expect(state.getCookieName()).toMatchSnapshot();
          expect(state.getCookieValue()).toMatchSnapshot();
        });

        test('2: Authenticate successfully using alternative Amster subject and service', async () => {
          const privateKey = process.env.FRODO_AMSTER_PRIVATE_KEY || fs.readFileSync(
            path.resolve(
              __dirname,
              '../test/mocks/AuthenticateOps/pkcs8.pem'
            ),
            'utf8'
          );
          const authenticationService = process.env.FRODO_AUTHENTICATION_SERVICE || 'MockAmsterService';
          const username = process.env.FRODO_USERNAME || 'MockUser';
          state.setAuthenticationService(authenticationService);
          state.setUsername(username);
          state.setDeploymentType(undefined);
          state.setAmsterPrivateKey(privateKey);
          const result = await AuthenticateOps.getTokens({ autoRefresh: false, state });
          expect(result).toBeTruthy();
          expect(result.subject).toEqual("user " + state.getUsername());
          expect(result.userSessionToken.tokenId).toBeTruthy();
          expect(result.userSessionToken.expires).toBeTruthy();
          expect(result).toMatchSnapshot({
            subject: expect.any(String)
          });
          expect(state.getDeploymentType()).toEqual(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
          expect(state.getAmsterPrivateKey()).toEqual(privateKey);
          expect(state.getAuthenticationService()).toEqual(authenticationService);
          expect(state.getUsername()).toEqual(username);
          expect(state.getCookieName()).toBeTruthy();
          expect(state.getCookieValue()).toBeTruthy();
          expect(state.getCookieName()).toMatchSnapshot();
          expect(state.getCookieValue()).toMatchSnapshot();
        });
      });
    });
  }
});
