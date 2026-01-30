/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record Non-destructive tests
 *    Phase 2: Record DESTRUCTIVE tests
 *
 *    Because destructive tests interfere with the recording of non-destructive
 *    tests and also interfere among themselves, they have to be run in groups
 *    of non-interfering tests.
 *
 *    To record and update snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record IgaRequestTypeOps
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE JOURNEYS!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record IgaRequestTypeOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IgaRequestTypeOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IgaRequestTypeOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../../../index';
import * as IgaRequestTypeOps from './IgaRequestTypeOps';

import * as TestData from '../../../test/setup/IgaRequestTypeSetup';
import { snapshotResultCallback } from '../../../test/utils/TestUtils';

describe('IgaRequestTypeOps', () => {

  TestData.setup();
  
  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {

    describe('createRequestTypeExportTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.createRequestTypeExportTemplate).toBeDefined();
      });

      test('1: Create Request Type Export Template', async () => {
        const response = IgaRequestTypeOps.createRequestTypeExportTemplate({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('createRequestType()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.createRequestType).toBeDefined();
      });

      test('1: Create Glossary Schema Export Template', async () => {
        const response = await IgaRequestTypeOps.createRequestType({ typeData: TestData.requestType1, state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readRequestType()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.readRequestType).toBeDefined();
      });

      test(`1: Read existing request type by ID`, async () => {
        const response = await IgaRequestTypeOps.readRequestType({
          typeId: TestData.requestType2.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing request type', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaRequestTypeOps.readRequestType({
          typeId: unknownId,
          state,
        })).rejects.toThrow('Error reading request type ' + unknownId);
      });
    });

    describe('readRequestTypeByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.readRequestTypeByName).toBeDefined();
      });

      test(`1: Read existing request type by name`, async () => {
        const response = await IgaRequestTypeOps.readRequestTypeByName({
          typeName: TestData.requestType2.displayName,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing request type with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaRequestTypeOps.readRequestTypeByName({
          typeName: unknownName,
          state,
        })).rejects.toThrow('Error reading request type ' + unknownName);
      });
    });

    describe('readRequestTypes()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.readRequestTypes).toBeDefined();
      });

      test(`1: Read existing request types`, async () => {
        const response = await IgaRequestTypeOps.readRequestTypes({
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportRequestType()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.exportRequestType).toBeDefined();
      });

      test(`1: Export existing request type by ID with string arrays`, async () => {
        const response = await IgaRequestTypeOps.exportRequestType({
          typeId: TestData.requestType2.id,
          options: { onlyCustom: false, useStringArrays: true },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
  
      test('2: Export non-existing request type', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaRequestTypeOps.exportRequestType({
          typeId: unknownId,
          options: { onlyCustom: false, useStringArrays: false },
          state,
        })).rejects.toThrow('Error exporting request type ' + unknownId);
      });
    });

    describe('exportRequestTypeByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.exportRequestTypeByName).toBeDefined();
      });

      test(`1: Export existing request type by name without string arrays`, async () => {
        const response = await IgaRequestTypeOps.exportRequestTypeByName({
          typeName: TestData.requestType2.displayName,
          options: { onlyCustom: false, useStringArrays: false },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
  
      test('2: Export non-existing request type with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaRequestTypeOps.exportRequestTypeByName({
          typeName: unknownName,
          options: { onlyCustom: false, useStringArrays: false },
          state,
        })).rejects.toThrow('Error exporting request type ' + unknownName);
      });
    });

    describe('exportRequestTypes()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.exportRequestTypes).toBeDefined();
      });

      test(`1: Export existing custom request types using string arrays`, async () => {
        const response = await IgaRequestTypeOps.exportRequestTypes({
          options: { onlyCustom: true, useStringArrays: true },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export existing request types without string arrays`, async () => {
        const response = await IgaRequestTypeOps.exportRequestTypes({
          options: { onlyCustom: false, useStringArrays: false },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('updateRequestType()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.updateRequestType).toBeDefined();
      });

      test(`1: Update existing request type`, async () => {
        const response = await IgaRequestTypeOps.updateRequestType({
          typeId: TestData.requestType2.id,
          typeData: TestData.requestType2,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Update non-existing request type`, async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaRequestTypeOps.updateRequestType({
          typeId: unknownId,
          typeData: {...TestData.requestType2, id: unknownId },
          state,
        })).rejects.toThrow(`Error updating request type '${unknownId}'`);
      });
    });

    describe('importRequestTypes()', () => {
      const importData = IgaRequestTypeOps.createRequestTypeExportTemplate({ state });
      importData.requestType = {
        [TestData.requestType2.id]: TestData.requestType2,
        [TestData.requestType3.id]: TestData.requestType3,
        [TestData.requestType4.id]: TestData.requestType4,
      }

      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.importRequestTypes).toBeDefined();
      });

      test('1: Import None', async () => {
        const response = await IgaRequestTypeOps.importRequestTypes({
          importData: IgaRequestTypeOps.createRequestTypeExportTemplate({ state }),
          options: {
            onlyCustom: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Import by ID', async () => {
        const response = await IgaRequestTypeOps.importRequestTypes({
          typeId: TestData.requestType3.id,
          importData,
          options: {
            onlyCustom: true
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('3: Import by Name', async () => {
        const response = await IgaRequestTypeOps.importRequestTypes({
          typeName: TestData.requestType3.displayName,
          importData,
          options: {
            onlyCustom: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('4: Import all only custom', async () => {
        const response = await IgaRequestTypeOps.importRequestTypes({
          importData,
          options: {
            onlyCustom: true
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('5: Import all', async () => {
        const response = await IgaRequestTypeOps.importRequestTypes({
          importData,
          options: {
            onlyCustom: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('deleteRequestType()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.deleteRequestType).toBeDefined();
      });

      test(`1: Delete existing request type by id`, async () => {
        const response = await IgaRequestTypeOps.deleteRequestType({
          typeId: TestData.requestType5.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing request type by id', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaRequestTypeOps.deleteRequestType({
          typeId: unknownId,
          state,
        })).rejects.toThrow('Error deleting request type ' + unknownId);
      });
    });

    describe('deleteRequestTypeByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.deleteRequestTypeByName).toBeDefined();
      });

      test(`1: Delete existing request type by name`, async () => {
        const response = await IgaRequestTypeOps.deleteRequestTypeByName({
          typeName: TestData.requestType6.displayName,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing request type by name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaRequestTypeOps.deleteRequestTypeByName({
          typeName: unknownName,
          state,
        })).rejects.toThrow('Error deleting request type ' + unknownName);
      });
    });
  }
  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('deleteRequestTypes()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestTypeOps.deleteRequestTypes).toBeDefined();
      });

      test.todo('1: Delete existing request types');
    });
  }
});