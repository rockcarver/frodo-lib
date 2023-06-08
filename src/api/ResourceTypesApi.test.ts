/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record ResourceTypesApi
 *
 *    The above command assumes that you have a connection profile for
 *    'volker-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update ResourceTypesApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only ResourceTypesApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as ResourceTypesApi from './ResourceTypesApi';
import { state } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { ResourceTypeSkeleton } from './ApiTypes';

autoSetupPolly();

async function stageResourceType(type: ResourceTypeSkeleton, create = true) {
  // delete if exists, then create
  try {
    await ResourceTypesApi.getResourceType({
      resourceTypeUuid: type.uuid,
      state,
    });
    await ResourceTypesApi.deleteResourceType({
      resourceTypeUuid: type.uuid,
      state,
    });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await ResourceTypesApi.createResourceType({
        resourceTypeData: type,
        state,
      });
    }
  }
}

describe('ResourceTypesApi', () => {
  const type1: ResourceTypeSkeleton = {
    uuid: '7d0b246e-d6fc-4c90-b8f8-dcfb99187cb2',
    name: 'FrodoTestResourceType1',
    description: 'Frodo Test Resource Type One',
    patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
    actions: { action2: true, action1: true },
  };
  const type2: ResourceTypeSkeleton = {
    uuid: 'ab5fb0da-8fe8-4f48-be05-aba822aa23bb',
    name: 'FrodoTestResourceType2',
    description: 'Frodo Test Resource Type Two',
    patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
    actions: { action2: true, action1: true },
  };
  const type3: ResourceTypeSkeleton = {
    uuid: '3ea23a32-ffdf-4a7f-a1f2-5d53fbba9ba6',
    name: 'FrodoTestResourceType3',
    description: 'Frodo Test Resource Type Three',
    patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
    actions: { action2: true, action1: true },
  };
  const type4: ResourceTypeSkeleton = {
    uuid: 'e219144d-8d94-47b6-8789-3a7b820d6cde',
    name: 'FrodoTestResourceType4',
    description: 'Frodo Test Resource Type Four',
    patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
    actions: { action2: true, action1: true },
  };
  const type5: ResourceTypeSkeleton = {
    uuid: 'cef1897f-1be5-4025-beed-a155605e2f83',
    name: 'FrodoTestResourceType5',
    description: 'Frodo Test Resource Type Five',
    patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
    actions: { action2: true, action1: true },
  };
  const type6: ResourceTypeSkeleton = {
    uuid: '05e5fdb6-435e-43d9-b707-c73f7f347358',
    name: 'FrodoTestResourceType6',
    description: 'Frodo Test Resource Type Six',
    patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
    actions: { action2: true, action1: true },
  };
  const type7: ResourceTypeSkeleton = {
    uuid: '3d66c934-9bab-4363-973b-f5502245decc',
    name: 'FrodoTestResourceType7',
    description: 'Frodo Test Resource Type Seven',
    patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
    actions: { action2: true, action1: true },
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageResourceType(type1);
      await stageResourceType(type2);
      await stageResourceType(type3, false);
      await stageResourceType(type4);
      await stageResourceType(type5);
      await stageResourceType(type6, false);
      await stageResourceType(type7);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageResourceType(type1, false);
      await stageResourceType(type2, false);
      await stageResourceType(type3, false);
      await stageResourceType(type4, false);
      await stageResourceType(type5, false);
      await stageResourceType(type6, false);
      await stageResourceType(type7, false);
    }
  });

  describe('getResourceTypes()', () => {
    test('0: Method is implemented', async () => {
      expect(ResourceTypesApi.getResourceTypes).toBeDefined();
    });

    test('1: Get all resource types', async () => {
      const response = await ResourceTypesApi.getResourceTypes({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getResourceType()', () => {
    test('0: Method is implemented', async () => {
      expect(ResourceTypesApi.getResourceType).toBeDefined();
    });

    test(`1: Get existing resource type by uuid [${type1.uuid} - ${type1.name}]`, async () => {
      const response = await ResourceTypesApi.getResourceType({
        resourceTypeUuid: type1.uuid,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing resource type by uuid [00000000-0000-0000-0000-000000000000]', async () => {
      expect.assertions(1);
      try {
        await ResourceTypesApi.getResourceType({
          resourceTypeUuid: '00000000-0000-0000-0000-000000000000',
          state,
        });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('getResourceTypeByName()', () => {
    test('0: Method is implemented', async () => {
      expect(ResourceTypesApi.getResourceTypeByName).toBeDefined();
    });

    test(`1: Get existing resource type by name [${type2.name} - ${type2.uuid}]`, async () => {
      const response = await ResourceTypesApi.getResourceTypeByName({
        resourceTypeName: type2.name,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing resource type by name [DoesNotExist]', async () => {
      const response = await ResourceTypesApi.getResourceTypeByName({
        resourceTypeName: 'DoesNotExist',
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('createResourceType()', () => {
    test('0: Method is implemented', async () => {
      expect(ResourceTypesApi.createResourceType).toBeDefined();
    });

    test(`1: Create non-existing resource type [${type3.uuid} - ${type3.name}]`, async () => {
      const response = await ResourceTypesApi.createResourceType({
        resourceTypeData: type3,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Create existing resource type [${type4.uuid} - ${type4.name}]`, async () => {
      expect.assertions(1);
      try {
        await ResourceTypesApi.createResourceType({
          resourceTypeData: type4,
          state,
        });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('putResourceType()', () => {
    test('0: Method is implemented', async () => {
      expect(ResourceTypesApi.putResourceType).toBeDefined();
    });

    test(`1: Update existing resource type [${type5.uuid} - ${type5.name}]`, async () => {
      const response = await ResourceTypesApi.putResourceType({
        resourceTypeUuid: type5.uuid,
        resourceTypeData: type5,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Update non-existing resource type [${type6.uuid} - ${type6.name}]`, async () => {
      expect.assertions(1);
      try {
        await ResourceTypesApi.putResourceType({
          resourceTypeUuid: type6.uuid,
          resourceTypeData: type6,
          state,
        });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('deleteResourceType()', () => {
    test('0: Method is implemented', async () => {
      expect(ResourceTypesApi.deleteResourceType).toBeDefined();
    });

    test(`1: Delete existing resource type [${type7.uuid} - ${type7.name}]`, async () => {
      const node = await ResourceTypesApi.deleteResourceType({
        resourceTypeUuid: type7.uuid,
        state,
      });
      expect(node).toMatchSnapshot();
    });

    test('2: Delete non-existing resource type [00000000-0000-0000-0000-000000000000]', async () => {
      expect.assertions(1);
      try {
        await ResourceTypesApi.deleteResourceType({
          resourceTypeUuid: '00000000-0000-0000-0000-000000000000',
          state,
        });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });
});
