/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    This step breaks down into multiple phases to allow the staging of test
 *    data for each phase.
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state variables required to connect to the
 *    env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=volker-dev npm run test:record IdmSystemOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=volker-dev npm run test:record IdmSystemOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IdmSystemOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IdmSystemOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as IdmSystemApi from '../api/IdmSystemApi';
import * as IdmSystemOps from './IdmSystemOps';
import { autoSetupPolly, filterRecording } from '../utils/AutoSetupPolly';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import { SystemObjectPatchOperationInterface } from '../api/IdmSystemApi';
import { decode } from '../utils/Base64Utils';

const ctx = autoSetupPolly();

async function stageSystemObject(
  obj: {
    cn: string[];
    sn: string[];
    userPassword: string[];
    description: string[];
    __NAME__: string;
    mail: string[];
    givenName: string[];
    uid: string[];
  },
  create = true
) {
  const systemName = 'OUD';
  const systemObjectType = '__ACCOUNT__';
  // delete if exists, then create
  try {
    const { result } = await IdmSystemOps.querySystemObjects({
      systemName,
      systemObjectType,
      filter: `uid eq '${obj.uid[0]}'`,
      state,
    });
    if (result.length) {
      const found = result[0];
      await IdmSystemOps.readSystemObject({
        systemName,
        systemObjectType,
        systemObjectId: found._id as string,
        state,
      });
      await IdmSystemOps.deleteSystemObject({
        systemName,
        systemObjectType,
        systemObjectId: found._id as string,
        state,
      });
    }
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await IdmSystemOps.createSystemObject({
        systemName,
        systemObjectType,
        systemObjectData: obj,
        state,
      });
    }
  }
}

describe('IdmSystemOps', () => {
  const obj1 = {
    _id: '00a65804-f2c9-4643-92aa-1a6ed196249d',
    cn: ['Frodo Test User 1'],
    sn: ['Test'],
    userPassword: [Buffer.from('Password').toString('base64')],
    description: ['Frodo Test User 1'],
    __NAME__: 'uid=frodo1,ou=People,dc=example,dc=com',
    mail: ['frodo1@example.com'],
    givenName: ['Frodo'],
    uid: ['frodo1'],
  };
  const obj2 = {
    _id: '7289cc0a-47f5-41ac-92d0-42f12526aede',
    cn: ['Frodo Test User 2'],
    sn: ['Test'],
    userPassword: [Buffer.from('Password').toString('base64')],
    description: ['Frodo Test User 2'],
    __NAME__: 'uid=frodo2,ou=People,dc=example,dc=com',
    mail: ['frodo2@example.com'],
    givenName: ['Frodo'],
    uid: ['frodo2'],
  };
  const obj3 = {
    _id: 'ec9c08e6-0d60-4c4f-9ab0-dd280a490db1',
    cn: ['Frodo Test User 3'],
    sn: ['Test'],
    userPassword: [Buffer.from('Password').toString('base64')],
    description: ['Frodo Test User 3'],
    __NAME__: 'uid=frodo3,ou=People,dc=example,dc=com',
    mail: ['frodo3@example.com'],
    givenName: ['Frodo'],
    uid: ['frodo3'],
  };
  const obj4 = {
    _id: 'fea7a86d-d80b-4cae-a664-b4dadf218b99',
    cn: ['Frodo Test User 4'],
    sn: ['Test'],
    userPassword: [Buffer.from('Password').toString('base64')],
    description: ['Frodo Test User 4'],
    __NAME__: 'uid=frodo4,ou=People,dc=example,dc=com',
    mail: ['frodo4@example.com'],
    givenName: ['Frodo'],
    uid: ['frodo4'],
  };
  const obj5 = {
    _id: '9e8c2d58-6420-479c-9252-f126941c47f2',
    cn: ['Frodo Test User 5'],
    sn: ['Test'],
    userPassword: [Buffer.from('Password').toString('base64')],
    description: ['Frodo Test User 5'],
    __NAME__: 'uid=frodo5,ou=People,dc=example,dc=com',
    mail: ['frodo5@example.com'],
    givenName: ['Frodo'],
    uid: ['frodo5'],
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1'
    ) {
      await stageSystemObject(obj1);
      await stageSystemObject(obj2);
      await stageSystemObject(obj3);
      await stageSystemObject(obj4, false);
      await stageSystemObject(obj5, false);
    } else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2'
    ) {
      await stageSystemObject(obj1, false);
      await stageSystemObject(obj2);
      await stageSystemObject(obj3);
      await stageSystemObject(obj4);
      await stageSystemObject(obj5);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageSystemObject(obj1, false);
      await stageSystemObject(obj2, false);
      await stageSystemObject(obj3, false);
      await stageSystemObject(obj4, false);
      await stageSystemObject(obj5, false);
    }
  });

  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('authenticateSystemObject()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.authenticateSystemObject).toBeDefined();
      });

      test(`1: Authenticate system object (AD user '${obj1.uid[0]}')`, async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const username = obj1.uid[0];
        const password = decode(obj1.userPassword[0]);
        const response = await IdmSystemOps.authenticateSystemObject({
          systemName,
          systemObjectType,
          username,
          password,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('queryAllSystemObjectIds()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.queryAllSystemObjectIds).toBeDefined();
      });

      test(`1: Query all system object ids (default page size)`, async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const response = await IdmSystemOps.queryAllSystemObjectIds({
          systemName,
          systemObjectType,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Query all system object ids (custom page size`, async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const pageSize = 1;
        const pageCookie = undefined;
        const response = await IdmSystemOps.queryAllSystemObjectIds({
          systemName,
          systemObjectType,
          pageSize,
          pageCookie,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('querySystemObjects()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.querySystemObjects).toBeDefined();
      });

      test(`1: Query system objects (custom fields, default page size)`, async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const filter = `uid eq '${obj1.uid[0]}'`;
        const fields: string[] = ['cn', 'mail'];
        const response = await IdmSystemOps.querySystemObjects({
          systemName,
          systemObjectType,
          filter,
          fields,
          state,
        });
        expect(response).toMatchSnapshot();
        expect(response.resultCount).toBe(1);
      });

      test(`2: Query system objects (default fields, custom page size`, async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const filter = `uid sw '${obj1.givenName[0]}'`;
        const pageSize = 1;
        const page1 = await IdmSystemOps.querySystemObjects({
          systemName,
          systemObjectType,
          filter,
          pageSize,
          state,
        });
        expect(page1).toMatchSnapshot();
        const page2 = await IdmSystemOps.querySystemObjects({
          systemName,
          systemObjectType,
          filter,
          pageSize,
          pageCookie: page1.pagedResultsCookie,
          state,
        });
        expect(page2).toMatchSnapshot();
        const page3 = await IdmSystemOps.querySystemObjects({
          systemName,
          systemObjectType,
          filter,
          pageSize,
          pageCookie: page2.pagedResultsCookie,
          state,
        });
        expect(page3).toMatchSnapshot();
        const page4 = await IdmSystemOps.querySystemObjects({
          systemName,
          systemObjectType,
          filter,
          pageSize,
          pageCookie: page3.pagedResultsCookie,
          state,
        });
        expect(page4).toMatchSnapshot();
        expect(page4.pagedResultsCookie).toBe(null);
      });
    });

    describe('readAvailableSystems()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.readAvailableSystems).toBeDefined();
      });

      test(`1: Read available systems`, async () => {
        const response = await IdmSystemOps.readAvailableSystems({
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readSystemObject()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.readSystemObject).toBeDefined();
      });

      test(`1: Read system object (all fields)`, async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const { result } = await IdmSystemOps.querySystemObjects({
          systemName,
          systemObjectType,
          filter: `uid eq '${obj1.uid[0]}'`,
          state,
        });
        expect.assertions(1);
        if (result.length) {
          const found = result[0];
          const systemObjectId = found._id as string;
          const response = await IdmSystemOps.readSystemObject({
            systemName,
            systemObjectType,
            systemObjectId,
            state,
          });
          expect(response).toMatchSnapshot();
        }
      });

      test(`1: Read system object (custom fields)`, async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const fields: string[] = ['cn', 'mail', 'uid'];
        const { result } = await IdmSystemOps.querySystemObjects({
          systemName,
          systemObjectType,
          filter: `uid eq '${obj1.uid[0]}'`,
          state,
        });
        expect.assertions(1);
        if (result.length) {
          const found = result[0];
          const systemObjectId = found._id as string;
          const response = await IdmSystemOps.readSystemObject({
            systemName,
            systemObjectType,
            systemObjectId,
            fields,
            state,
          });
          expect(response).toMatchSnapshot();
        }
      });
    });

    describe('readSystemSchema()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.readSystemSchema).toBeDefined();
      });

      test(`1: Read system schema`, async () => {
        const systemName = 'OUD';
        const response = await IdmSystemOps.readSystemSchema({
          systemName,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readSystemStatus()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.readSystemStatus).toBeDefined();
      });

      test(`1: Read system status`, async () => {
        const systemName = 'OUD';
        const response = await IdmSystemOps.readSystemStatus({
          systemName,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('runSystemScript()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.runSystemScript).toBeDefined();
      });

      // test(`1: Read system object`, async () => {
      //   const systemName = '';
      //   const scriptName = '';
      //   const response = await IdmSystemOps.runSystemScript({
      //     systemName,
      //     scriptName,
      //     state,
      //   });
      //   expect(response).toMatchSnapshot();
      // });
    });

    describe('testConnectorServers()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.testConnectorServers).toBeDefined();
      });

      test(`1: Test connector servers`, async () => {
        const response = await IdmSystemOps.testConnectorServers({ state });
        expect(response).toMatchSnapshot();
      });
    });
  }

  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('createSystemObject()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.createSystemObject).toBeDefined();
      });

      test('1: Create system object', async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const systemObjectData = obj1;
        const response = await IdmSystemOps.createSystemObject({
          systemName,
          systemObjectType,
          systemObjectData,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('deleteSystemObject()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.deleteSystemObject).toBeDefined();
      });

      test(`1: Delete system object`, async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const { result } = await IdmSystemOps.querySystemObjects({
          systemName,
          systemObjectType,
          filter: `uid eq '${obj2.uid[0]}'`,
          state,
        });
        expect.assertions(1);
        if (result.length) {
          const found = result[0];
          const systemObjectId = found._id as string;
          const response = await IdmSystemOps.deleteSystemObject({
            systemName,
            systemObjectType,
            systemObjectId,
            state,
          });
          expect(response).toMatchSnapshot();
        }
      });
    });

    describe('updateSystemObject()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.updateSystemObject).toBeDefined();
      });

      test(`1: Update system object`, async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const systemObjectData = obj3;
        const failIfExists = false;
        const { result } = await IdmSystemOps.querySystemObjects({
          systemName,
          systemObjectType,
          filter: `uid eq '${obj3.uid[0]}'`,
          state,
        });
        expect.assertions(1);
        if (result.length) {
          const found = result[0];
          const systemObjectId = found._id as string;
          const response = await IdmSystemOps.updateSystemObject({
            systemName,
            systemObjectType,
            systemObjectId,
            systemObjectData,
            failIfExists,
            state,
          });
          expect(response).toMatchSnapshot();
        }
      });

      test(`2: Update system object (fail if exists)`, async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const systemObjectData = obj4;
        const failIfExists = true;
        const { result } = await IdmSystemOps.querySystemObjects({
          systemName,
          systemObjectType,
          filter: `uid eq '${obj4.uid[0]}'`,
          state,
        });
        expect.assertions(1);
        if (result.length) {
          const found = result[0];
          const systemObjectId = found._id as string;
          try {
            const response = await IdmSystemOps.updateSystemObject({
              systemName,
              systemObjectType,
              systemObjectId,
              systemObjectData,
              failIfExists,
              state,
            });
          } catch (error) {
            expect(error).toMatchSnapshot();
          }
        }
      });
    });

    describe('updateSystemObjectProperties()', () => {
      test('0: Method is implemented', async () => {
        expect(IdmSystemOps.updateSystemObjectProperties).toBeDefined();
      });

      test(`1: Update system object properties`, async () => {
        const systemName = 'OUD';
        const systemObjectType = '__ACCOUNT__';
        const operations: SystemObjectPatchOperationInterface[] = [
          {
            field: '/sn',
            operation: 'replace',
            value: `${obj5.sn[0]} - replaced`,
          },
          {
            field: '/givenName',
            operation: 'remove',
            value: `${obj5.givenName[0]}`,
          },
          {
            field: '/givenName',
            operation: 'add',
            value: `${obj5.givenName[0]} - modified`,
          },
        ];
        const { result } = await IdmSystemOps.querySystemObjects({
          systemName,
          systemObjectType,
          filter: `uid eq '${obj5.uid[0]}'`,
          state,
        });
        expect.assertions(1);
        if (result.length) {
          const found = result[0];
          const systemObjectId = found._id as string;
          const response = await IdmSystemOps.updateSystemObjectProperties({
            systemName,
            systemObjectType,
            systemObjectId,
            operations,
            state,
          });
          expect(response).toMatchSnapshot();
        }
      });
    });
  }
});
