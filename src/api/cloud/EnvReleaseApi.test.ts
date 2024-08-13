/**
 * To record and update snapshots, you must perform 2 steps in order:
 *
 * 1. Record API responses & create/update snapshots
 *
 *    To record and create/update snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_HOST=frodo-dev npm run test:record EnvReleaseApi
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only EnvReleaseApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as EnvReleaseApi from './EnvReleaseApi';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { state } from '../../index';

const ctx = autoSetupPolly();

describe('EnvReleaseApi', () => {
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    // nothing to setup
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('getRelease()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvReleaseApi.getRelease).toBeDefined();
    });

    test('1: Get release info - success', async () => {
      const response = await EnvReleaseApi.getRelease({
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
