/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record non-conflicting tests
 *    Phase 2: Record conflicting tests - Deletes
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record ResourceTypeOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record ResourceTypeOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update ResourceTypeOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only ResourceTypeOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as ResourceTypeOps from './ResourceTypeOps';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { ResourceTypeSkeleton } from '../api/ApiTypes';

autoSetupPolly();

async function stageResourceType(type: ResourceTypeSkeleton, create = true) {
  // delete if exists, then create
  try {
    await ResourceTypeOps.getResourceType({
      resourceTypeUuid: type.uuid,
      state,
    });
    await ResourceTypeOps.deleteResourceType({
      resourceTypeUuid: type.uuid,
      state,
    });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await ResourceTypeOps.createResourceType({
        resourceTypeData: type,
        state,
      });
    }
  }
}

describe('ResourceTypeOps', () => {
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
  const type8: ResourceTypeSkeleton = {
    uuid: '84f7b719-cbd4-4b82-8170-6c230f2973be',
    name: 'FrodoTestResourceType8',
    description: 'Frodo Test Resource Type Eight',
    patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
    actions: { action2: true, action1: true },
  };
  const type9: ResourceTypeSkeleton = {
    uuid: '0c2b73b2-f18f-4634-85ec-14dc71f1b216',
    name: 'FrodoTestResourceType9',
    description: 'Frodo Test Resource Type Nine',
    patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
    actions: { action2: true, action1: true },
  };
  const type10: ResourceTypeSkeleton = {
    uuid: '6d5eed85-872b-48f4-be47-3151fd073961',
    name: 'FrodoTestResourceType10',
    description: 'Frodo Test Resource Type Ten',
    patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
    actions: { action2: true, action1: true },
  };
  const import1: ResourceTypeSkeleton = {
    uuid: '993eba78-1c3f-4f27-b205-b4b29418f831',
    name: 'FrodoTestResourceType11',
    type: {
      meta: {
        origin: 'https://openam-volker-dev.forgeblocks.com/am',
        originAmVersion: '7.3.0',
        exportedBy: 'volker.scheuber@forgerock.com',
        exportDate: '2023-05-18T18:09:05.247Z',
        exportTool: 'frodo',
        exportToolVersion: 'v0.18.9-6 [v19.4.0]',
      },
      script: {},
      policy: {},
      policyset: {},
      resourcetype: {
        '993eba78-1c3f-4f27-b205-b4b29418f831': {
          uuid: '993eba78-1c3f-4f27-b205-b4b29418f831',
          name: 'FrodoTestResourceType11',
          description: 'Frodo Test Resource Type Eleven',
          patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
          actions: { action2: true, action1: true },
        },
      },
    },
  };
  const import2: ResourceTypeSkeleton = {
    uuid: '3fc799d7-b73f-49e0-a70b-e37990e54e56',
    name: 'FrodoTestResourceType12',
    type: {
      meta: {
        origin: 'https://openam-volker-dev.forgeblocks.com/am',
        originAmVersion: '7.3.0',
        exportedBy: 'volker.scheuber@forgerock.com',
        exportDate: '2023-05-18T18:09:05.247Z',
        exportTool: 'frodo',
        exportToolVersion: 'v0.18.9-6 [v19.4.0]',
      },
      script: {},
      policy: {},
      policyset: {},
      resourcetype: {
        '3fc799d7-b73f-49e0-a70b-e37990e54e56': {
          uuid: '3fc799d7-b73f-49e0-a70b-e37990e54e56',
          name: 'FrodoTestResourceType12',
          description: 'Frodo Test Resource Type Twelve',
          patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
          actions: { action2: true, action1: true },
        },
      },
    },
  };
  const import3: ResourceTypeSkeleton = {
    uuid: '0aa5ed25-0c62-4ff5-9a42-3bda8c5cbb76',
    name: 'FrodoTestResourceType12',
    type: {
      meta: {
        origin: 'https://openam-volker-dev.forgeblocks.com/am',
        originAmVersion: '7.3.0',
        exportedBy: 'volker.scheuber@forgerock.com',
        exportDate: '2023-05-18T18:09:05.247Z',
        exportTool: 'frodo',
        exportToolVersion: 'v0.18.9-6 [v19.4.0]',
      },
      script: {},
      policy: {},
      policyset: {},
      resourcetype: {
        '0aa5ed25-0c62-4ff5-9a42-3bda8c5cbb76': {
          uuid: '0aa5ed25-0c62-4ff5-9a42-3bda8c5cbb76',
          name: 'FrodoTestResourceType13',
          description: 'Frodo Test Resource Type Thirteen',
          patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
          actions: { action2: true, action1: true },
        },
        '49dffc9a-9221-4bda-9c95-4864f2c57fb2': {
          uuid: '49dffc9a-9221-4bda-9c95-4864f2c57fb2',
          name: 'FrodoTestResourceType13a',
          description: 'Frodo Test Resource Type Thirteen A',
          patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
          actions: { action2: true, action1: true },
        },
      },
    },
  };
  const import5: ResourceTypeSkeleton = {
    uuid: '3c5f13af-ca17-403e-b47d-d15263cce954',
    name: 'FrodoTestResourceType15',
    description: 'Frodo Test Resource Type Fifteen',
    patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
    actions: { action2: true, action1: true },
  };
  const import4: ResourceTypeSkeleton = {
    uuid: '119b291c-40b3-4b1e-8d84-c2a561a2cb1f',
    name: 'FrodoTestResourceType12',
    type: {
      meta: {
        origin: 'https://openam-volker-dev.forgeblocks.com/am',
        originAmVersion: '7.3.0',
        exportedBy: 'volker.scheuber@forgerock.com',
        exportDate: '2023-05-18T18:09:05.247Z',
        exportTool: 'frodo',
        exportToolVersion: 'v0.18.9-6 [v19.4.0]',
      },
      script: {},
      policy: {},
      policyset: {},
      resourcetype: {
        '119b291c-40b3-4b1e-8d84-c2a561a2cb1f': {
          uuid: '119b291c-40b3-4b1e-8d84-c2a561a2cb1f',
          name: 'FrodoTestResourceType14',
          description: 'Frodo Test Resource Type Fourteen',
          patterns: ['pattern2://*:*/*?*', 'pattern1://*:*/*'],
          actions: { action2: true, action1: true },
        },
        [import5.uuid]: import5,
      },
    },
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
      await stageResourceType(type8);
      await stageResourceType(type9);
      await stageResourceType(type10);
      await stageResourceType(import1.type?.[import1.uuid], false);
      await stageResourceType(import2.type?.[import2.uuid], false);
      await stageResourceType(import3.type?.[import3.uuid], false);
      await stageResourceType(import4.type?.[import4.uuid], false);
      await stageResourceType(import5.type?.[import5.uuid], false);
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
      await stageResourceType(type8, false);
      await stageResourceType(type9, false);
      await stageResourceType(type10, false);
      await stageResourceType(import1.type?.[import1.uuid], false);
      await stageResourceType(import2.type?.[import2.uuid], false);
      await stageResourceType(import3.type?.[import3.uuid], false);
      await stageResourceType(import4.type?.[import4.uuid], false);
      await stageResourceType(import5.type?.[import5.uuid], false);
    }
  });

  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('getResourceTypes()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.getResourceTypes).toBeDefined();
      });

      test('1: Get all resource types', async () => {
        const response = await ResourceTypeOps.getResourceTypes({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('getResourceType()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.getResourceType).toBeDefined();
      });

      test(`1: Get existing resource type by uuid [${type1.uuid} - ${type1.name}]`, async () => {
        const response = await ResourceTypeOps.getResourceType({
          resourceTypeUuid: type1.uuid,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Get non-existing resource type by uuid [00000000-0000-0000-0000-000000000000]', async () => {
        expect.assertions(1);
        try {
          await ResourceTypeOps.getResourceType({
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
        expect(ResourceTypeOps.getResourceTypeByName).toBeDefined();
      });

      test(`1: Get existing resource type by name [${type2.name} - ${type2.uuid}]`, async () => {
        const response = await ResourceTypeOps.getResourceTypeByName({
          resourceTypeName: type2.name,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Get non-existing resource type by name [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await ResourceTypeOps.getResourceTypeByName({
            resourceTypeName: 'DoesNotExist',
            state,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('createResourceType()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.createResourceType).toBeDefined();
      });

      test(`1: Create non-existing resource type [${type3.uuid} - ${type3.name}]`, async () => {
        const response = await ResourceTypeOps.createResourceType({
          resourceTypeData: type3,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Create existing resource type [${type4.uuid} - ${type4.name}]`, async () => {
        expect.assertions(1);
        try {
          await ResourceTypeOps.createResourceType({
            resourceTypeData: type4,
            state,
          });
        } catch (error) {
          expect(error.response.data).toMatchSnapshot();
        }
      });
    });

    describe('updateResourceType()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.updateResourceType).toBeDefined();
      });

      test(`1: Update existing resource type [${type5.uuid} - ${type5.name}]`, async () => {
        const response = await ResourceTypeOps.updateResourceType({
          resourceTypeUuid: type5.uuid,
          resourceTypeData: type5,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Update non-existing resource type [${type6.uuid} - ${type6.name}]`, async () => {
        expect.assertions(1);
        try {
          await ResourceTypeOps.updateResourceType({
            resourceTypeUuid: type6.uuid,
            resourceTypeData: type6,
            state,
          });
        } catch (error) {
          expect(error.response.data).toMatchSnapshot();
        }
      });
    });

    describe('exportResourceType()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.exportResourceType).toBeDefined();
      });

      test(`1: Export existing resource type by uuid [${type9.uuid} - ${type9.name}]`, async () => {
        const response = await ResourceTypeOps.exportResourceType({
          resourceTypeUuid: type9.uuid,
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('2: Export non-existing resource type by uuid [00000000-0000-0000-0000-000000000000]', async () => {
        expect.assertions(1);
        try {
          await ResourceTypeOps.exportResourceType({
            resourceTypeUuid: '00000000-0000-0000-0000-000000000000',
            state,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('exportResourceTypeByName()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.exportResourceTypeByName).toBeDefined();
      });

      test(`1: Export existing resource type by name [${type10.name} - ${type10.uuid}]`, async () => {
        const response = await ResourceTypeOps.exportResourceTypeByName({
          resourceTypeName: type10.name,
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('2: Export non-existing resource type by name [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await ResourceTypeOps.exportResourceTypeByName({
            resourceTypeName: 'DoesNotExist',
            state,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('exportResourceTypes()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.exportResourceTypes).toBeDefined();
      });

      test('1: Export all resource types', async () => {
        const response = await ResourceTypeOps.exportResourceTypes({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('importResourceType()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.importResourceType).toBeDefined();
      });

      test(`1: Import existing resource type by uuid [${import1.uuid} - ${import1.name}]`, async () => {
        const response = await ResourceTypeOps.importResourceType({
          resourceTypeUuid: import1.uuid,
          importData:
            import1.type as ResourceTypeOps.ResourceTypeExportInterface,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Import non-existing resource type by uuid [00000000-0000-0000-0000-000000000000]', async () => {
        expect.assertions(1);
        try {
          await ResourceTypeOps.importResourceType({
            resourceTypeUuid: '00000000-0000-0000-0000-000000000000',
            importData:
              import1.type as ResourceTypeOps.ResourceTypeExportInterface,
            state,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('importResourceTypeByName()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.importResourceTypeByName).toBeDefined();
      });

      test(`1: Export existing resource type by name [${import2.name} - ${import2.uuid}]`, async () => {
        const response = await ResourceTypeOps.importResourceTypeByName({
          resourceTypeName: import2.name,
          importData:
            import2.type as ResourceTypeOps.ResourceTypeExportInterface,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Export non-existing resource type by name [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await ResourceTypeOps.importResourceTypeByName({
            resourceTypeName: 'DoesNotExist',
            importData:
              import2.type as ResourceTypeOps.ResourceTypeExportInterface,
            state,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('importFirstResourceType()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.importFirstResourceType).toBeDefined();
      });

      test('1: Import first resource type', async () => {
        const response = await ResourceTypeOps.importFirstResourceType({
          importData:
            import3.type as ResourceTypeOps.ResourceTypeExportInterface,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('importResourceTypes()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.importResourceTypes).toBeDefined();
      });

      test('1: Import all resource types', async () => {
        const response = await ResourceTypeOps.importResourceTypes({
          importData:
            import4.type as ResourceTypeOps.ResourceTypeExportInterface,
          state,
        });
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
    describe('deleteResourceType()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.deleteResourceType).toBeDefined();
      });

      test(`1: Delete existing resource type [${type7.uuid} - ${type7.name}]`, async () => {
        const response = await ResourceTypeOps.deleteResourceType({
          resourceTypeUuid: type7.uuid,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Delete non-existing resource type [00000000-0000-0000-0000-000000000000]', async () => {
        expect.assertions(1);
        try {
          await ResourceTypeOps.deleteResourceType({
            resourceTypeUuid: '00000000-0000-0000-0000-000000000000',
            state,
          });
        } catch (error) {
          expect(error.response.data).toMatchSnapshot();
        }
      });
    });

    describe('deleteResourceTypeByName()', () => {
      test('0: Method is implemented', async () => {
        expect(ResourceTypeOps.deleteResourceType).toBeDefined();
      });

      test(`1: Delete existing resource type by name [${type8.name} - ${type8.uuid}]`, async () => {
        const response = await ResourceTypeOps.deleteResourceTypeByName({
          resourceTypeName: type8.name,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Delete non-existing resource type by name [DoesNotExist]', async () => {
        expect.assertions(1);
        try {
          await ResourceTypeOps.deleteResourceTypeByName({
            resourceTypeName: 'DoesNotExist',
            state,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });
  }
});
