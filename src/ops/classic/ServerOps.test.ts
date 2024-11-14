/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    Recording requires an available classic deployment, since servers
 *    can only be accessed in classic. Set FRODO_HOST and FRODO_REALM
 *    environment variables or alternatively FRODO_DEPLOY=classic
 *    in order to appropriately record requests to the classic deployment.
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state required to connect to the
 *    env to record from:
 *
 *    ATTENTION: For the recording to succeed, you MUST make sure to use a
 *               user account, not a service account.
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record ServerOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update ServerOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only ServerOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { autoSetupPolly, setDefaultState } from "../../utils/AutoSetupPolly";
import { filterRecording } from "../../utils/PollyUtils";
import * as ServerOps from "./ServerOps";
import { state } from "../../lib/FrodoLib";
import Constants from "../../shared/Constants";

const ctx = autoSetupPolly();

describe('ServerOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
    setDefaultState(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY);
  });

  describe('createServerExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(ServerOps.createServerExportTemplate).toBeDefined();
    });

    test('1: Create Server Export Template', async () => {
      const response = ServerOps.createServerExportTemplate({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('readServer()', () => {
    test('0: Method is implemented', async () => {
      expect(ServerOps.readServer).toBeDefined();
    });
    //TODO: create tests
  });

  describe('readServers()', () => {
    test('0: Method is implemented', async () => {
      expect(ServerOps.readServers).toBeDefined();
    });

    test('1: Read Servers', async () => {
      const response = await ServerOps.readServers({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('exportServer()', () => {
    test('0: Method is implemented', async () => {
      expect(ServerOps.exportServer).toBeDefined();
    });
    //TODO: create tests
  });

  describe('exportServers()', () => {
    test('0: Method is implemented', async () => {
      expect(ServerOps.exportServers).toBeDefined();
    });

    test('1: Export Servers without default properties', async () => {
      const response = await ServerOps.exportServers({ options: { includeDefault: false }, state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('2: Export Servers with default properties', async () => {
      const response = await ServerOps.exportServers({ options: { includeDefault: true }, state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('createServer()', () => {
    test('0: Method is implemented', async () => {
      expect(ServerOps.createServer).toBeDefined();
    });
    //TODO: create tests
  });

  describe('importFirstServer()', () => {
    test('0: Method is implemented', async () => {
      expect(ServerOps.importFirstServer).toBeDefined();
    });
    //TODO: create tests
  });


  describe('importServers()', () => {
    test('0: Method is implemented', async () => {
      expect(ServerOps.importServers).toBeDefined();
    });
    //TODO: create tests
  });

});
