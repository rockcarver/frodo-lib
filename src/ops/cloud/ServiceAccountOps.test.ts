/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state variables required to connect to the
 *    env to record from:
 *
 *    ATTENTION: For the recording to succeed, you MUST make sure to use a
 *               user account, not a service account.
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record ServiceAccountOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update ServiceAccountOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only ServiceAccountOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { jest } from '@jest/globals';
import { createJwkRsa, createJwks, getJwkRsaPublic } from '../JoseOps';
import * as ServiceAccount from './ServiceAccountOps';
import {
  autoSetupPolly,
  defaultMatchRequestsBy,
} from '../../utils/AutoSetupPolly';

// Increase timeout for this test as pipeline keeps failing with error:
// Timeout - Async callback was not invoked within the 5000 ms timeout specified by jest.setTimeout.
jest.setTimeout(30000);

// need to modify the default matching rules to allow the mocking to work for service account tests.
const matchConfig = defaultMatchRequestsBy();
matchConfig.body = false; // service account create requests are tricky because of the public key, which is different for each request

autoSetupPolly(matchConfig);

describe.only('ServiceAccountOps', () => {
  describe('isServiceAccountsFeatureAvailable()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceAccount.isServiceAccountsFeatureAvailable).toBeDefined();
    });

    test('1: Check tenant supporting service accounts', async () => {
      const response = await ServiceAccount.isServiceAccountsFeatureAvailable();
      expect(response).toBeTruthy();
    });

    // test('2: Check tenant not supporting service accounts', async () => {
    //   (context.polly as Polly).server.any().on('request', (req) => {
    //     req.overrideRecordingName(
    //       'ServiceAccountOps/isServiceAccountsFeatureAvailable()/2: Check tenant not supporting service accounts'
    //     );
    //     console.log(`+++++polly: recordingName: ${req.recordingName}`);
    //   });
    //   const response = await ServiceAccount.isServiceAccountsFeatureAvailable();
    //   expect(response).toBeFalsy();
    // });
  });

  describe('createServiceAccount()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceAccount.createServiceAccount).toBeDefined();
    });

    test('1: Create service account', async () => {
      const name = 'sa';
      const description = 'service account';
      const accountStatus = 'Active';
      const scopes = ['fr:am:*', 'fr:idm:*', 'fr:idc:esv:*'];
      const jwk = await createJwkRsa();
      const publicJwk = await getJwkRsaPublic(jwk);
      const jwks = createJwks(publicJwk);
      const response = await ServiceAccount.createServiceAccount(
        name,
        description,
        accountStatus,
        scopes,
        jwks
      );
      expect(response).toMatchSnapshot();
    });
  });
});
