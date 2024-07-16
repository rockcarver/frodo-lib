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
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record ServiceOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update ServiceOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only ServiceOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { autoSetupPolly } from "../utils/AutoSetupPolly";
import { filterRecording } from "../utils/PollyUtils";
import * as ServiceOps from "./ServiceOps";
import {state} from "../lib/FrodoLib";

const ctx = autoSetupPolly();

describe('ServiceOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('createServiceExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceOps.createServiceExportTemplate).toBeDefined();
    });

    test('1: Create Service Export Template', async () => {
      const response = ServiceOps.createServiceExportTemplate({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('getListOfServices()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceOps.getListOfServices).toBeDefined();
    });

    test('1: Get List of Global Services', async () => {
      const response = await ServiceOps.getListOfServices({ globalConfig: true, state });
      expect(response).toMatchSnapshot();
    });

    test('2: Get List of Realm Services', async () => {
      const response = await ServiceOps.getListOfServices({ globalConfig: false, state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getFullServices()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceOps.getFullServices).toBeDefined();
    });

    test('1: Get full Global Services', async () => {
      const response = await ServiceOps.getFullServices({ globalConfig: true, state });
      expect(response).toMatchSnapshot();
    });

    test('2: Get full Realm Services', async () => {
      const response = await ServiceOps.getFullServices({ globalConfig: false, state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('putFullService()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceOps.putFullService).toBeDefined();
    });
    //TODO: create tests
  });

  describe('putFullServices()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceOps.putFullServices).toBeDefined();
    });
    //TODO: create tests
  });

  describe('deleteFullService()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceOps.deleteFullService).toBeDefined();
    });
    //TODO: create tests
  });

  describe('deleteFullServices()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceOps.deleteFullServices).toBeDefined();
    });
    //TODO: create tests
  });

  describe('exportService()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceOps.exportService).toBeDefined();
    });
    //TODO: create tests
  });

  describe('exportServices()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceOps.exportServices).toBeDefined();
    });

    test('1: Export Global Services', async () => {
      const response = await ServiceOps.exportServices({ globalConfig: true, state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('2: Export Realm Services', async () => {
      const response = await ServiceOps.exportServices({ globalConfig: false, state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('importService()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceOps.importService).toBeDefined();
    });
    //TODO: create tests
  });

  describe('importServices()', () => {
    test('0: Method is implemented', async () => {
      expect(ServiceOps.importServices).toBeDefined();
    });
    //TODO: create tests
  });
});
