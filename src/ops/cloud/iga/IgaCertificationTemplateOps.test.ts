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
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record IgaCertificationTemplateOps
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE JOURNEYS!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record IgaCertificationTemplateOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IgaCertificationTemplateOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IgaCertificationTemplateOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../../../index';
import * as IgaCertificationTemplateOps from './IgaCertificationTemplateOps';
import * as TestData from '../../../test/setup/IgaCertificationTemplateSetup';
import { snapshotResultCallback } from '../../../test/utils/TestUtils';
import { template1 } from '../../../test/setup/EmailTemplateSetup';

describe('IgaCertificationTemplateOps', () => {

  TestData.setup();
  
  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {

    describe('createCertificationTemplateExportTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.createCertificationTemplateExportTemplate).toBeDefined();
      });

      test('1: Create Certification Template Export Template', async () => {
        const response = IgaCertificationTemplateOps.createCertificationTemplateExportTemplate({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('createCertificationTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.createCertificationTemplate).toBeDefined();
      });

      test(`1: Create certification template`, async () => {
        const response = await IgaCertificationTemplateOps.createCertificationTemplate({
          templateData: TestData.certificationTemplate1,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Create existing template', async () => {
        await expect(IgaCertificationTemplateOps.createCertificationTemplate({
          templateData: TestData.certificationTemplate2,
          state,
        })).rejects.toThrow('Error creating certification template ' + TestData.certificationTemplate2.name );
      });
    });

    describe('readCertificationTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.readCertificationTemplate).toBeDefined();
      });

      test(`1: Read existing certification template by ID`, async () => {
        const response = await IgaCertificationTemplateOps.readCertificationTemplate({
          templateId: TestData.certificationTemplate2.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing certification template', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaCertificationTemplateOps.readCertificationTemplate({
          templateId: unknownId,
          state,
        })).rejects.toThrow('Error reading certification template ' + unknownId);
      });
    });

    describe('readCertificationTemplateByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.readCertificationTemplateByName).toBeDefined();
      });

      test(`1: Read existing certification template by name`, async () => {
        const response = await IgaCertificationTemplateOps.readCertificationTemplateByName({
          templateName: TestData.certificationTemplate2.name,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing certification template with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaCertificationTemplateOps.readCertificationTemplateByName({
          templateName: unknownName,
          state,
        })).rejects.toThrow('Error reading certification template ' + unknownName);
      });
    });

    describe('readCertificationTemplates()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.readCertificationTemplates).toBeDefined();
      });

      test(`1: Read existing certification templates, including event ones`, async () => {
        const response = await IgaCertificationTemplateOps.readCertificationTemplates({
          includeEventTemplates: true,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Read existing certification templates, excluding event ones`, async () => {
        const response = await IgaCertificationTemplateOps.readCertificationTemplates({
          includeEventTemplates: false,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportCertificationTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.exportCertificationTemplate).toBeDefined();
      });

      test(`1: Export existing certification template by ID with dependencies`, async () => {
        const response = await IgaCertificationTemplateOps.exportCertificationTemplate({
          templateId: TestData.certificationTemplate2.id,
          options: { deps: true, includeEventTemplates: true },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
  
      test('2: Export non-existing certification template', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaCertificationTemplateOps.exportCertificationTemplate({
          templateId: unknownId,
          options: { deps: false, includeEventTemplates: true },
          state,
        })).rejects.toThrow('Error exporting certification template ' + unknownId);
      });
    });

    describe('exportCertificationTemplateByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.exportCertificationTemplateByName).toBeDefined();
      });

      test(`1: Export existing certification template by name without dependencies`, async () => {
        const response = await IgaCertificationTemplateOps.exportCertificationTemplateByName({
          templateName: TestData.certificationTemplate2.name,
          options: { deps: false, includeEventTemplates: false },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
  
      test('2: Export non-existing certification template with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaCertificationTemplateOps.exportCertificationTemplateByName({
          templateName: unknownName,
          options: { deps: false, includeEventTemplates: false },
          state,
        })).rejects.toThrow('Error exporting certification template ' + unknownName);
      });
    });

    describe('exportCertificationTemplates()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.exportCertificationTemplates).toBeDefined();
      });

      test(`1: Export existing certification templates with dependencies and event templates`, async () => {
        const response = await IgaCertificationTemplateOps.exportCertificationTemplates({
          options: { deps: true, includeEventTemplates: true },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export existing certification templates without dependencies and without event templates`, async () => {
        const response = await IgaCertificationTemplateOps.exportCertificationTemplates({
          options: { deps: false, includeEventTemplates: false },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('updateCertificationTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.updateCertificationTemplate).toBeDefined();
      });

      test(`1: Update existing certification template`, async () => {
        const response = await IgaCertificationTemplateOps.updateCertificationTemplate({
          templateId: TestData.certificationTemplate2.id,
          templateData: TestData.certificationTemplate2,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('importCertificationTemplates()', () => {
      const importData = IgaCertificationTemplateOps.createCertificationTemplateExportTemplate({ state });
      importData.certificationTemplate = {
        [TestData.certificationTemplate3.id]: TestData.certificationTemplate3,
        [TestData.certificationTemplate4.id]: TestData.certificationTemplate4,
        [TestData.certificationTemplate5.id]: TestData.certificationTemplate5,
      }
      importData.emailTemplate = {
        [template1._id]: template1
      }

      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.importCertificationTemplates).toBeDefined();
      });

      test('1: Import None', async () => {
        const response = await IgaCertificationTemplateOps.importCertificationTemplates({
          importData: IgaCertificationTemplateOps.createCertificationTemplateExportTemplate({ state }),
          options: {
            deps: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Import by ID with no deps', async () => {
        await TestData.stageCertificationTemplate(TestData.certificationTemplate3);
        const response = await IgaCertificationTemplateOps.importCertificationTemplates({
          templateId: TestData.certificationTemplate3.id,
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
        await TestData.stageCertificationTemplate(TestData.certificationTemplate3);
        const response = await IgaCertificationTemplateOps.importCertificationTemplates({
          templateName: TestData.certificationTemplate3.name,
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
        await TestData.stageCertificationTemplate(TestData.certificationTemplate3);
        const response = await IgaCertificationTemplateOps.importCertificationTemplates({
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

    describe('deleteCertificationTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.deleteCertificationTemplate).toBeDefined();
      });

      test(`1: Delete existing certification template by id`, async () => {
        const response = await IgaCertificationTemplateOps.deleteCertificationTemplate({
          templateId: TestData.certificationTemplate6.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing certification template by id', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaCertificationTemplateOps.deleteCertificationTemplate({
          templateId: unknownId,
          state,
        })).rejects.toThrow('Error deleting certification template ' + unknownId);
      });
    });

    describe('deleteCertificationTemplateByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.deleteCertificationTemplateByName).toBeDefined();
      });

      test(`1: Delete existing certification template by name`, async () => {
        const response = await IgaCertificationTemplateOps.deleteCertificationTemplateByName({
          templateName: TestData.certificationTemplate7.name,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing certification template by name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaCertificationTemplateOps.deleteCertificationTemplateByName({
          templateName: unknownName,
          state,
        })).rejects.toThrow('Error deleting certification template ' + unknownName);
      });
    });
  }
  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('deleteCertificationTemplates()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaCertificationTemplateOps.deleteCertificationTemplates).toBeDefined();
      });

      test.todo('1: Delete existing certification templates');
    });
  }
});