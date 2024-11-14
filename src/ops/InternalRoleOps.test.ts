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
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record InternalRoleOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update InternalRoleOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only InternalRoleOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { autoSetupPolly } from "../utils/AutoSetupPolly";
import { filterRecording } from "../utils/PollyUtils";
import * as InternalRoleOps from "./InternalRoleOps";
import { state } from "../lib/FrodoLib";

const ctx = autoSetupPolly();

describe('InternalRoleOps', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('createInternalRoleExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.createInternalRoleExportTemplate).toBeDefined();
    });

    test('1: Create InternalRole Export Template', async () => {
      const response = InternalRoleOps.createInternalRoleExportTemplate({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('createInternalRole()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.createInternalRole).toBeDefined();
    });
    //TODO: create tests
  });

  describe('readInternalRole()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.readInternalRole).toBeDefined();
    });
    //TODO: create tests
  });

  describe('readInternalRoleByName()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.readInternalRoleByName).toBeDefined();
    });
    //TODO: create tests
  });

  describe('readInternalRoles()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.readInternalRoles).toBeDefined();
    });
    test('1: Read internal roles', async () => {
      const response = await InternalRoleOps.readInternalRoles({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('updateInternalRole()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.updateInternalRole).toBeDefined();
    });
    //TODO: create tests
  });

  describe('deleteInternalRoleByName()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.deleteInternalRoleByName).toBeDefined();
    });
    //TODO: create tests
  });

  describe('deleteInternalRoles()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.deleteInternalRoles).toBeDefined();
    });
    //TODO: create tests
  });

  describe('queryInternalRoles()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.queryInternalRoles).toBeDefined();
    });
    //TODO: create tests
  });

  describe('exportInternalRole()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.exportInternalRole).toBeDefined();
    });
    //TODO: create tests
  });

  describe('exportInternalRoleByName()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.exportInternalRoleByName).toBeDefined();
    });
    //TODO: create tests
  });

  describe('exportInternalRoles()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.exportInternalRoles).toBeDefined();
    });
    test('1: Export internal roles', async () => {
      const response = await InternalRoleOps.exportInternalRoles({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('importInternalRole()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.importInternalRole).toBeDefined();
    });
    //TODO: create tests
  });

  describe('importInternalRoleByName()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.importInternalRoleByName).toBeDefined();
    });
    //TODO: create tests
  });

  describe('importFirstInternalRole()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.importFirstInternalRole).toBeDefined();
    });
    //TODO: create tests
  });

  describe('importInternalRoles()', () => {
    test('0: Method is implemented', async () => {
      expect(InternalRoleOps.importInternalRoles).toBeDefined();
    });
    //TODO: create tests
  });
});
