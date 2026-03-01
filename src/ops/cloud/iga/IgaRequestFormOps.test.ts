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
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record IgaRequestFormOps
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE JOURNEYS!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record IgaRequestFormOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IgaRequestFormOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IgaRequestFormOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../../../index';
import * as IgaRequestFormOps from './IgaRequestFormOps';
import * as TestData from '../../../test/setup/IgaRequestFormSetup';
import * as RequestTypeTestData from '../../../test/setup/IgaRequestTypeSetup';
import { snapshotResultCallback } from '../../../test/utils/TestUtils';

describe('IgaRequestFormOps', () => {

  TestData.setup();
  
  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {

    describe('createRequestFormExportTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.createRequestFormExportTemplate).toBeDefined();
      });

      test('1: Create Request Form Export Template', async () => {
        const response = IgaRequestFormOps.createRequestFormExportTemplate({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('readRequestForm()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.readRequestForm).toBeDefined();
      });

      test(`1: Read existing request form by ID`, async () => {
        const response = await IgaRequestFormOps.readRequestForm({
          formId: TestData.requestForm1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing request form', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaRequestFormOps.readRequestForm({
          formId: unknownId,
          state,
        })).rejects.toThrow('Error reading request form ' + unknownId);
      });
    });

    describe('readRequestFormByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.readRequestFormByName).toBeDefined();
      });

      test(`1: Read existing request form by name`, async () => {
        const response = await IgaRequestFormOps.readRequestFormByName({
          formName: TestData.requestForm1.name,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing request form with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaRequestFormOps.readRequestFormByName({
          formName: unknownName,
          state,
        })).rejects.toThrow('Error reading request form ' + unknownName);
      });
    });

    describe('readRequestForms()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.readRequestForms).toBeDefined();
      });

      test(`1: Read existing request forms`, async () => {
        const response = await IgaRequestFormOps.readRequestForms({
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportRequestForm()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.exportRequestForm).toBeDefined();
      });

      test(`1: Export existing request form by ID with string arrays and dependencies`, async () => {
        const response = await IgaRequestFormOps.exportRequestForm({
          formId: TestData.requestForm1.id,
          options: { deps: true, useStringArrays: true },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
  
      test('2: Export non-existing request form', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaRequestFormOps.exportRequestForm({
          formId: unknownId,
          options: { deps: false, useStringArrays: false },
          state,
        })).rejects.toThrow('Error exporting request form ' + unknownId);
      });
    });

    describe('exportRequestFormByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.exportRequestFormByName).toBeDefined();
      });

      test(`1: Export existing request form by name without string arrays and dependencies`, async () => {
        const response = await IgaRequestFormOps.exportRequestFormByName({
          formName: TestData.requestForm1.name,
          options: { deps: false, useStringArrays: false },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
  
      test('2: Export non-existing request form with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaRequestFormOps.exportRequestFormByName({
          formName: unknownName,
          options: { deps: false, useStringArrays: false },
          state,
        })).rejects.toThrow('Error exporting request form ' + unknownName);
      });
    });

    describe('exportRequestForms()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.exportRequestForms).toBeDefined();
      });

      test(`1: Export existing request forms with dependencies using string arrays`, async () => {
        const response = await IgaRequestFormOps.exportRequestForms({
          options: { deps: true, useStringArrays: true },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export existing request forms without dependencies and string arrays`, async () => {
        const response = await IgaRequestFormOps.exportRequestForms({
          options: { deps: false, useStringArrays: false },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('updateRequestForm()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.updateRequestForm).toBeDefined();
      });

      test(`1: Update existing request form`, async () => {
        const response = await IgaRequestFormOps.updateRequestForm({
          formId: TestData.requestForm1.id,
          formData: TestData.requestForm1,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('importRequestForms()', () => {
      const importData = IgaRequestFormOps.createRequestFormExportTemplate({ state });
      importData.requestForm = {
        [TestData.requestForm2.id]: TestData.requestForm2,
        [TestData.requestForm3.id]: TestData.requestForm3,
        [TestData.requestForm4.id]: TestData.requestForm4,
      }
      importData.requestType = {
        [RequestTypeTestData.requestType1.id]: RequestTypeTestData.requestType1
      }

      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.importRequestForms).toBeDefined();
      });

      test('1: Import None', async () => {
        const response = await IgaRequestFormOps.importRequestForms({
          importData: IgaRequestFormOps.createRequestFormExportTemplate({ state }),
          options: {
            deps: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Import by ID with no deps', async () => {
        const response = await IgaRequestFormOps.importRequestForms({
          formId: TestData.requestForm2.id,
          importData,
          options: {
            deps: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('3: Import by Name with deps', async () => {
        const response = await IgaRequestFormOps.importRequestForms({
          formName: TestData.requestForm2.name,
          importData,
          options: {
            deps: true
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('4: Import all', async () => {
        const response = await IgaRequestFormOps.importRequestForms({
          importData,
          options: {
            deps: true
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('deleteRequestForm()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.deleteRequestForm).toBeDefined();
      });

      test(`1: Delete existing request form by id`, async () => {
        const response = await IgaRequestFormOps.deleteRequestForm({
          formId: TestData.requestForm5.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing request form by id', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaRequestFormOps.deleteRequestForm({
          formId: unknownId,
          state,
        })).rejects.toThrow('Error deleting request form ' + unknownId);
      });
    });

    describe('deleteRequestFormByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.deleteRequestFormByName).toBeDefined();
      });

      test(`1: Delete existing request form by name`, async () => {
        const response = await IgaRequestFormOps.deleteRequestFormByName({
          formName: TestData.requestForm6.name,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing request form by name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaRequestFormOps.deleteRequestFormByName({
          formName: unknownName,
          state,
        })).rejects.toThrow('Error deleting request form ' + unknownName);
      });
    });
  }
  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('deleteRequestForms()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaRequestFormOps.deleteRequestForms).toBeDefined();
      });

      test.todo('1: Delete existing request forms');
    });
  }
});