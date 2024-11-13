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
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record ScriptTypeOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update ScriptTypeOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only ScriptTypeOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { autoSetupPolly } from "../utils/AutoSetupPolly";
import { filterRecording } from "../utils/PollyUtils";
import * as ScriptTypeOps from "./ScriptTypeOps";
import { state } from "../lib/FrodoLib";

const ctx = autoSetupPolly();

describe('ScriptTypeOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('createScriptTypeExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptTypeOps.createScriptTypeExportTemplate).toBeDefined();
    });

    test('1: Create ScriptType Export Template', async () => {
      const response = ScriptTypeOps.createScriptTypeExportTemplate({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('readScriptType()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptTypeOps.readScriptType).toBeDefined();
    });
    //TODO: create tests
  });

  describe('readScriptTypes()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptTypeOps.readScriptTypes).toBeDefined();
    });

    test('1: Read ScriptTypes', async () => {
      const response = await ScriptTypeOps.readScriptTypes({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('exportScriptTypes()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptTypeOps.exportScriptTypes).toBeDefined();
    });

    test('1: Export ScriptTypes', async () => {
      const response = await ScriptTypeOps.exportScriptTypes({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('updateScriptType()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptTypeOps.updateScriptType).toBeDefined();
    });
    //TODO: create tests
  });

  describe('importScriptTypes()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptTypeOps.importScriptTypes).toBeDefined();
    });
    //TODO: create tests
  });

});
