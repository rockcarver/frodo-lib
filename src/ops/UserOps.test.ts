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
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record UserOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update UserOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only UserOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { autoSetupPolly } from "../utils/AutoSetupPolly";
import { filterRecording } from "../utils/PollyUtils";
import * as UserOps from "./UserOps";
import { state } from "../lib/FrodoLib";

const ctx = autoSetupPolly();

describe('UserOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('createUserExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.createUserExportTemplate).toBeDefined();
    });

    test('1: Create User Export Template', async () => {
      const response = UserOps.createUserExportTemplate({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('readUser()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.readUser).toBeDefined();
    });
    //TODO: create tests
  });

  describe('readUsers()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.readUsers).toBeDefined();
    });

    test('1: Read Users', async () => {
      const response = await UserOps.readUsers({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('exportUser()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.exportUser).toBeDefined();
    });
    //TODO: create tests
  });

  describe('exportUsers()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.exportUsers).toBeDefined();
    });

    test('1: Export Users', async () => {
      const response = await UserOps.exportUsers({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('createUserGroupExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.createUserGroupExportTemplate).toBeDefined();
    });

    test('1: Create User Group Export Template', async () => {
      const response = UserOps.createUserGroupExportTemplate({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('readUserGroup()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.readUserGroup).toBeDefined();
    });
    //TODO: create tests
  });

  describe('readUserGroups()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.readUserGroups).toBeDefined();
    });

    test('1: Read User Groups', async () => {
      const response = await UserOps.readUserGroups({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('exportUserGroup()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.exportUserGroup).toBeDefined();
    });
    //TODO: create tests
  });

  describe('exportUserGroups()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.exportUserGroups).toBeDefined();
    });

    test('1: Export User Groups', async () => {
      const response = await UserOps.exportUserGroups({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('importUsers()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.importUsers).toBeDefined();
    });
    //TODO: create tests
  });

  describe('importUserGroups()', () => {
    test('0: Method is implemented', async () => {
      expect(UserOps.importUserGroups).toBeDefined();
    });
    //TODO: create tests
  });
});
