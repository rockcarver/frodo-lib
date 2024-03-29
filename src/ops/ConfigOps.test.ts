/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state required to connect to the
 *    env to record from:
 *
 *    ATTENTION: For the recording to succeed, you MUST make sure to use a
 *               user account, not a service account.
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record ConfigOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update ConfigOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only ConfigOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */

import { autoSetupPolly, filterRecording } from "../utils/AutoSetupPolly";
import * as ConfigOps from "./ConfigOps";
import { state } from "../index";
import Constants from '../shared/Constants';

const ctx = autoSetupPolly();

describe('ConfigOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });
  describe('exportFullConfiguration()', () => {
    test('0: Method is implemented', async () => {
      expect(ConfigOps.exportFullConfiguration).toBeDefined();
    });

    test('1: Export everything with string arrays, decoding variables, including journey coordinates and default scripts', async () => {
      // Set deployment type to cloud since it is necessary for exporting applications correctly. It does this automatically when recording the mock, but not when running the test after recording
      state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);
      const response = await ConfigOps.exportFullConfiguration({ options: { useStringArrays: true, noDecode: false, coords: true, includeDefault: true }, state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object)
      });
    });

    test('2: Export everything without string arrays, decoding variables, excluding journey coordinates and default scripts', async () => {
      // Set deployment type to cloud since it is necessary for exporting applications correctly. It does this automatically when recording the mock, but not when running the test after recording
      state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);
      const response = await ConfigOps.exportFullConfiguration({ options: { useStringArrays: false, noDecode: true, coords: false, includeDefault: false }, state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object)
      });
    });
  });

  describe('importFullConfiguration()', () => {
    test('0: Method is implemented', async () => {
      expect(ConfigOps.importFullConfiguration).toBeDefined();
    });
    // TODO: Write tests for full import
  });
});
