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
 *        FRODO_DEBUG=1 npm run test:only ServiceAccountOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../../index';
import * as ServiceAccountOps from './ServiceAccountOps';
import { createJwkRsa, createJwks, getJwkRsaPublic } from '../JoseOps';
import {
  autoSetupPolly,
  defaultMatchRequestsBy,
  filterRecording,
} from '../../utils/AutoSetupPolly';

// need to modify the default matching rules to allow the mocking to work for service account tests.
const matchConfig = defaultMatchRequestsBy();
matchConfig.body = false; // service account create requests are tricky because of the public key, which is different for each request

const ctx = autoSetupPolly(matchConfig);

describe('ServiceAccountOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('isServiceAccountsFeatureAvailable()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceAccountOps.isServiceAccountsFeatureAvailable).toBeDefined();
    });

    test('1: Check tenant supporting service accounts', async () => {
      const response =
        await ServiceAccountOps.isServiceAccountsFeatureAvailable({
          state,
        });
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
      expect(ServiceAccountOps.createServiceAccount).toBeDefined();
    });

    test('1: Create service account', async () => {
      const name = 'sa';
      const description = 'service account';
      const accountStatus = 'Active';
      const scopes = ['fr:am:*', 'fr:idm:*', 'fr:idc:esv:*'];
      const jwk = await createJwkRsa();
      const publicJwk = await getJwkRsaPublic(jwk);
      const jwks = createJwks(publicJwk);
      const response = await ServiceAccountOps.createServiceAccount({
        name,
        description,
        accountStatus,
        scopes,
        jwks,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
