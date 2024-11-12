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
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record RealmOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update RealmOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only RealmOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { autoSetupPolly } from "../utils/AutoSetupPolly";
import { filterRecording } from "../utils/PollyUtils";
import * as RealmOps from "./RealmOps";
import {state} from "../lib/FrodoLib";

const ctx = autoSetupPolly();

describe('RealmOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('createRealmExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.createRealmExportTemplate).toBeDefined();
    });

    test('1: Create Realm Export Template', async () => {
      const response = RealmOps.createRealmExportTemplate({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('getRealms()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.getRealms).toBeDefined();
    });

    test('1: Get Realms', async () => {
      const response = await RealmOps.getRealms({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('exportRealms()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.exportRealms).toBeDefined();
    });

    test('1: Export Realms', async () => {
      const response = await RealmOps.exportRealms({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('createRealm()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.createRealm).toBeDefined();
    });
    //TODO: create tests
  });

  describe('updateRealm()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.updateRealm).toBeDefined();
    });
    //TODO: create tests
  });

  describe('importRealms()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.importRealms).toBeDefined();
    });
    //TODO: create tests
  });

  describe('getRealm()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.getRealm).toBeDefined();
    });
    //TODO: create tests
  });

  describe('getRealmByName()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.getRealmByName).toBeDefined();
    });
    //TODO: create tests
  });

  describe('deleteRealm()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.deleteRealm).toBeDefined();
    });
    //TODO: create tests
  });

  describe('deleteRealmByName()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.deleteRealmByName).toBeDefined();
    });
    //TODO: create tests
  });

  describe('addCustomDomain()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.addCustomDomain).toBeDefined();
    });
    //TODO: create tests
  });

  describe('removeCustomDomain()', () => {
    test('0: Method is implemented', async () => {
      expect(RealmOps.removeCustomDomain).toBeDefined();
    });
    //TODO: create tests
  });
});
