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
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record AdminOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update AdminOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only AdminOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */

import { autoSetupPolly } from "../utils/AutoSetupPolly";
import * as AdminOps from "./AdminOps";
import { state } from "../index";

autoSetupPolly();

describe('AdminOps', () => {
  describe('exportFullConfiguration()', () => {
    test('0: Method is implemented', async () => {
      expect(AdminOps.exportFullConfiguration).toBeDefined();
    });

    test('1: Export everything with string arrays and decoding', async () => {
      const response = await AdminOps.exportFullConfiguration({ options: { useStringArrays: true, noDecode: false }, state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object)
      });
    });

    test('2: Export everything without string arrays and decoding', async () => {
      const response = await AdminOps.exportFullConfiguration({ options: { useStringArrays: false, noDecode: true }, state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object)
      });
    });
  });
});
