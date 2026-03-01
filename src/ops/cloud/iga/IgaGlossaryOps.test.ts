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
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record IgaGlossaryOps
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE JOURNEYS!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record IgaGlossaryOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IgaGlossaryOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IgaGlossaryOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../../../index';
import * as IgaGlossaryOps from './IgaGlossaryOps';

import * as TestData from '../../../test/setup/IgaGlossarySetup';
import { snapshotResultCallback } from '../../../test/utils/TestUtils';

describe('IgaGlossaryOps', () => {

  TestData.setup();
  
  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {

    describe('createGlossarySchemaExportTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.createGlossarySchemaExportTemplate).toBeDefined();
      });

      test('1: Create Glossary Schema Export Template', async () => {
        const response = IgaGlossaryOps.createGlossarySchemaExportTemplate({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('createGlossarySchema()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.createGlossarySchema).toBeDefined();
      });

      test('1: Create Glossary Schema Export Template', async () => {
        const response = await IgaGlossaryOps.createGlossarySchema({ glossarySchemaData: TestData.glossary7, state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readGlossarySchema()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.readGlossarySchema).toBeDefined();
      });

      test(`1: Read existing glossary schema by ID`, async () => {
        const response = await IgaGlossaryOps.readGlossarySchema({
          glossaryId: TestData.glossary1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing glossary schema', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaGlossaryOps.readGlossarySchema({
          glossaryId: unknownId,
          state,
        })).rejects.toThrow('Error reading glossary schema ' + unknownId);
      });
    });

    describe('readGlossarySchemaByNameAndObjectType()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.readGlossarySchemaByNameAndObjectType).toBeDefined();
      });

      test(`1: Read existing glossary schema by name and objectype`, async () => {
        const response = await IgaGlossaryOps.readGlossarySchemaByNameAndObjectType({
          glossaryName: TestData.glossary1.name,
          objectType: TestData.glossary1.objectType,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing glossary schema with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaGlossaryOps.readGlossarySchemaByNameAndObjectType({
          glossaryName: unknownName,
          objectType: TestData.glossary1.objectType,
          state,
        })).rejects.toThrow('Error reading glossary schema ' + unknownName);
      });

      test('3: Read non-existing glossary schema with unknown object type', async () => {
        const unknownObjectType = 'unknownObjectType';
        await expect(IgaGlossaryOps.readGlossarySchemaByNameAndObjectType({
          glossaryName: TestData.glossary1.name,
          // @ts-expect-error since we are doing an unknown object type
          objectType: unknownObjectType,
          state,
        })).rejects.toThrow('Error reading glossary schema ' + TestData.glossary1.name);
      });
    });

    describe('readGlossarySchemas()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.readGlossarySchemas).toBeDefined();
      });

      test(`1: Read existing glossary schemas`, async () => {
        const response = await IgaGlossaryOps.readGlossarySchemas({
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportGlossarySchema()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.exportGlossarySchema).toBeDefined();
      });

      test(`1: Export existing glossary schema by ID`, async () => {
        const response = await IgaGlossaryOps.exportGlossarySchema({
          glossaryId: TestData.glossary1.id,
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
  
      test('2: Export non-existing glossary schema', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaGlossaryOps.exportGlossarySchema({
          glossaryId: unknownId,
          state,
        })).rejects.toThrow('Error exporting glossary schema ' + unknownId);
      });
    });

    describe('exportGlossarySchemaByNameAndObjectType()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.exportGlossarySchemaByNameAndObjectType).toBeDefined();
      });

      test(`1: Export existing glossary schema by name and objectype`, async () => {
        const response = await IgaGlossaryOps.exportGlossarySchemaByNameAndObjectType({
          glossaryName: TestData.glossary1.name,
          objectType: TestData.glossary1.objectType,
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
  
      test('2: Export non-existing glossary schema with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaGlossaryOps.exportGlossarySchemaByNameAndObjectType({
          glossaryName: unknownName,
          objectType: TestData.glossary1.objectType,
          state,
        })).rejects.toThrow('Error exporting glossary schema ' + unknownName);
      });

      test('3: Export non-existing glossary schema with unknown object type', async () => {
        const unknownObjectType = 'unknownObjectType';
        await expect(IgaGlossaryOps.exportGlossarySchemaByNameAndObjectType({
          glossaryName: TestData.glossary1.name,
          // @ts-expect-error since we are doing an unknown object type
          objectType: unknownObjectType,
          state,
        })).rejects.toThrow('Error exporting glossary schema ' + TestData.glossary1.name);
      });
    });

    describe('exportGlossarySchemas()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.exportGlossarySchemas).toBeDefined();
      });

      test(`1: Export existing glossary schemas without internal`, async () => {
        const response = await IgaGlossaryOps.exportGlossarySchemas({
          options: { includeInternal: false },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export existing glossary schemas with internal`, async () => {
        const response = await IgaGlossaryOps.exportGlossarySchemas({
          options: { includeInternal: true },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('updateGlossarySchema()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.updateGlossarySchema).toBeDefined();
      });

      test(`1: Update existing glossary schema`, async () => {
        const response = await IgaGlossaryOps.updateGlossarySchema({
          glossaryId: TestData.glossary2.id,
          glossarySchemaData: TestData.glossary2,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Update non-existing glossary schema`, async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaGlossaryOps.updateGlossarySchema({
          glossaryId: unknownId,
          glossarySchemaData: TestData.glossary2,
          state,
        })).rejects.toThrow(`Error updating glossary schema '${unknownId}'`);
      });
    });

    describe('importGlossarySchemas()', () => {
      const importData = IgaGlossaryOps.createGlossarySchemaExportTemplate({ state });
      importData.glossarySchema = {
        [TestData.glossary2.id]: TestData.glossary2,
        [TestData.glossary3.id]: TestData.glossary3,
        [TestData.glossary4.id]: TestData.glossary4,
      }

      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.importGlossarySchemas).toBeDefined();
      });

      test('1: Import None', async () => {
        const response = await IgaGlossaryOps.importGlossarySchemas({
          importData: IgaGlossaryOps.createGlossarySchemaExportTemplate({ state }),
          options: {
            includeInternal: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Import by ID', async () => {
        const response = await IgaGlossaryOps.importGlossarySchemas({
          glossaryId: TestData.glossary3.id,
          importData,
          options: {
            includeInternal: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('3: Import by Name', async () => {
        const response = await IgaGlossaryOps.importGlossarySchemas({
          glossaryName: TestData.glossary3.name,
          objectType: TestData.glossary3.objectType,
          importData,
          options: {
            includeInternal: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('4: Import all', async () => {
        const response = await IgaGlossaryOps.importGlossarySchemas({
          importData,
          options: {
            includeInternal: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      // Note: we don't have a test for the includeInternal: true case since importing internal config makes the config undeletable in the tenant
    });

    describe('deleteGlossarySchema()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.deleteGlossarySchema).toBeDefined();
      });

      test(`1: Delete existing glossary schema by id`, async () => {
        const response = await IgaGlossaryOps.deleteGlossarySchema({
          glossaryId: TestData.glossary5.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing glossary by id', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaGlossaryOps.deleteGlossarySchema({
          glossaryId: unknownId,
          state,
        })).rejects.toThrow('Error deleting glossary schema ' + unknownId);
      });
    });

    describe('deleteGlossarySchemaByNameAndObjectType()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.deleteGlossarySchemaByNameAndObjectType).toBeDefined();
      });

      test(`1: Delete existing glossary schema by name`, async () => {
        const response = await IgaGlossaryOps.deleteGlossarySchemaByNameAndObjectType({
          glossaryName: TestData.glossary6.name,
          objectType: TestData.glossary6.objectType,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing glossary by unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaGlossaryOps.deleteGlossarySchemaByNameAndObjectType({
          glossaryName: unknownName,
          objectType: TestData.glossary1.objectType,
          state,
        })).rejects.toThrow('Error deleting glossary schema ' + unknownName);
      });

      test('3: Delete non-existing glossary by unknown object type', async () => {
        const unknownObjectType = 'unknownObjectType';
        await expect(IgaGlossaryOps.deleteGlossarySchemaByNameAndObjectType({
          glossaryName: TestData.glossary1.name,
          // @ts-expect-error
          objectType: unknownObjectType,
          state,
        })).rejects.toThrow('Error deleting glossary schema ' + TestData.glossary1.name);
      });
    });
  }
  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('deleteGlossarySchemas()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaGlossaryOps.deleteGlossarySchemas).toBeDefined();
      });

      test.todo('1: Delete existing glossary schemas');
    });
  }
});