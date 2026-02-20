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
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record IgaWorkflowOps
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE JOURNEYS!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record IgaWorkflowOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IgaWorkflowOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IgaWorkflowOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../../../index';
import * as IgaWorkflowOps from './IgaWorkflowOps';
import * as TestData from '../../../test/setup/IgaWorkflowSetup';
import * as EmailTemplateTestData from '../../../test/setup/EmailTemplateSetup';
import { snapshotResultCallback } from '../../../test/utils/TestUtils';
import { EMAIL_TEMPLATE_TYPE } from '../../EmailTemplateOps';

describe('IgaWorkflowOps', () => {

  TestData.setup();
  
  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {

    describe('createWorkflowExportTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.createWorkflowExportTemplate).toBeDefined();
      });

      test('1: Create Workflow Export Template', async () => {
        const response = IgaWorkflowOps.createWorkflowExportTemplate({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('publishWorkflow()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.publishWorkflow).toBeDefined();
      });

      test(`1: Publish existing draft workflow`, async () => {
        const response = await IgaWorkflowOps.publishWorkflow({
          workflowId: TestData.workflow7.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Publish non-existing draft workflow', async () => {
        await expect(IgaWorkflowOps.publishWorkflow({
          workflowId: TestData.workflow4.id,
          state,
        })).rejects.toThrow('Error publishing draft workflow ' + TestData.workflow4.id);
      });
    });

    describe('readDraftWorkflow()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.readDraftWorkflow).toBeDefined();
      });

      test(`1: Read existing draft workflow by ID`, async () => {
        const response = await IgaWorkflowOps.readDraftWorkflow({
          workflowId: TestData.workflow1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing draft workflow', async () => {
        await expect(IgaWorkflowOps.readDraftWorkflow({
          workflowId: TestData.workflow4.id,
          state,
        })).rejects.toThrow('Error reading draft workflow ' + TestData.workflow4.id);
      });
    });

    describe('readPublishedWorkflow()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.readPublishedWorkflow).toBeDefined();
      });

      test(`1: Read existing published workflow by ID`, async () => {
        const response = await IgaWorkflowOps.readPublishedWorkflow({
          workflowId: TestData.workflow2.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing published workflow', async () => {
        await expect(IgaWorkflowOps.readPublishedWorkflow({
          workflowId: TestData.workflow3.id,
          state,
        })).rejects.toThrow('Error reading published workflow ' + TestData.workflow3.id);
      });
    });

    describe('readWorkflowGroup()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.readWorkflowGroup).toBeDefined();
      });

      test(`1: Read existing workflow by ID`, async () => {
        const response = await IgaWorkflowOps.readWorkflowGroup({
          workflowId: TestData.workflow1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing workflow', async () => {
        const response = await IgaWorkflowOps.readWorkflowGroup({
          workflowId: TestData.workflow3.id,
          state,
        });
        expect(response.draft).toBeFalsy();
        expect(response.published).toBeFalsy();
      });
    });

    describe('readWorkflows()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.readWorkflows).toBeDefined();
      });

      test(`1: Read existing workflows`, async () => {
        const response = await IgaWorkflowOps.readWorkflows({
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readWorkflowGroups()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.readWorkflowGroups).toBeDefined();
      });

      test(`1: Read existing workflow groups`, async () => {
        const response = await IgaWorkflowOps.readWorkflowGroups({
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportWorkflow()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.exportWorkflow).toBeDefined();
      });

      test(`1: Export existing workflow by ID with coordinates, string arrays, dependencies, and readonly config`, async () => {
        const response = await IgaWorkflowOps.exportWorkflow({
          workflowId: TestData.workflow1.id,
          options: { deps: true, useStringArrays: true, coords: true, includeReadOnly: true },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export existing workflow by ID without coordinates, string arrays, dependencies, and readonly config`, async () => {
        const response = await IgaWorkflowOps.exportWorkflow({
          workflowId: TestData.workflow2.id,
          options: { deps: false, useStringArrays: false, coords: false, includeReadOnly: false },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
  
      test('3: Export non-existing workflow', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaWorkflowOps.exportWorkflow({
          workflowId: unknownId,
          options: { deps: false, useStringArrays: false, coords: false, includeReadOnly: false },
          state,
        })).rejects.toThrow(`Workflow '${unknownId}' not found.`);
      });
    });

    describe('exportWorkflows()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.exportWorkflows).toBeDefined();
      });

      test(`1: Export existing workflows with coordinates, string arrays, dependencies, and readonly config`, async () => {
        const response = await IgaWorkflowOps.exportWorkflows({
          options: { deps: true, coords: true, useStringArrays: true, includeReadOnly: true },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export existing workflows without coordinates, string arrays, dependencies, and readonly config`, async () => {
        const response = await IgaWorkflowOps.exportWorkflows({
          options: { deps: false, coords: false, useStringArrays: false, includeReadOnly: false },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('updateWorkflow()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.updateWorkflow).toBeDefined();
      });

      test(`1: Update existing draft workflow`, async () => {
        const response = await IgaWorkflowOps.updateWorkflow({
          workflowId: TestData.workflow1.id,
          workflowData: TestData.workflow1,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Update existing published workflow`, async () => {
        const response = await IgaWorkflowOps.updateWorkflow({
          workflowId: TestData.workflow8.id,
          workflowData: TestData.workflow8,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('importWorkflows()', () => {
      const importData = IgaWorkflowOps.createWorkflowExportTemplate({ state });
      importData.workflow = {
        [TestData.workflow1.id]: {
          draft: TestData.workflow1,
          published: TestData.workflow2
        },
        [TestData.workflow3.id]: {
          draft: TestData.workflow3,
        },
        [TestData.workflow4.id]: {
          published: TestData.workflow4,
        },
      };
      importData.emailTemplate = {
        [EmailTemplateTestData.template1._id]: {...EmailTemplateTestData.template1, _id: `${EMAIL_TEMPLATE_TYPE}/${EmailTemplateTestData.template1._id}`},
        [EmailTemplateTestData.template2._id]: {...EmailTemplateTestData.template2, _id: `${EMAIL_TEMPLATE_TYPE}/${EmailTemplateTestData.template2._id}`},
        [EmailTemplateTestData.template3._id]: {...EmailTemplateTestData.template3, _id: `${EMAIL_TEMPLATE_TYPE}/${EmailTemplateTestData.template3._id}`},
        [EmailTemplateTestData.template4._id]: {...EmailTemplateTestData.template4, _id: `${EMAIL_TEMPLATE_TYPE}/${EmailTemplateTestData.template4._id}`},
      };
      importData.event = {
        [TestData.workflowEvent1.id]: TestData.workflowEvent1,
        [TestData.workflowEvent2.id]: TestData.workflowEvent2,
      }
      importData.requestForm = {
        [TestData.workflowRequestForm1.id]: TestData.workflowRequestForm1,
        [TestData.workflowRequestForm2.id]: TestData.workflowRequestForm2,
      }
      importData.requestType = {
        [TestData.workflowRequestType1.id]: TestData.workflowRequestType1,
        [TestData.workflowRequestType2.id]: TestData.workflowRequestType2,
        [TestData.workflowRequestType3.id]: TestData.workflowRequestType3,
        [TestData.workflowRequestType5.id]: TestData.workflowRequestType5,
      }

      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.importWorkflows).toBeDefined();
      });

      test('1: Import None', async () => {
        const response = await IgaWorkflowOps.importWorkflows({
          importData: IgaWorkflowOps.createWorkflowExportTemplate({ state }),
          options: {
            deps: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Import by ID with no deps', async () => {
        const response = await IgaWorkflowOps.importWorkflows({
          workflowId: TestData.workflow1.id,
          importData,
          options: {
            deps: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('3: Import all', async () => {
        const response = await IgaWorkflowOps.importWorkflows({
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

    describe('deleteDraftWorkflow()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.deleteDraftWorkflow).toBeDefined();
      });

      test(`1: Delete existing draft workflow by id`, async () => {
        const response = await IgaWorkflowOps.deleteDraftWorkflow({
          workflowId: TestData.workflow5.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing draft workflow by id', async () => {
        await expect(IgaWorkflowOps.deleteDraftWorkflow({
          workflowId: TestData.workflow6.id,
          state,
        })).rejects.toThrow('Error deleting draft workflow ' + TestData.workflow6.id);
      });
    });

    describe('deletePublishedWorkflow()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.deletePublishedWorkflow).toBeDefined();
      });

      test(`1: Delete existing published workflow by id`, async () => {
        const response = await IgaWorkflowOps.deletePublishedWorkflow({
          workflowId: TestData.workflow6.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing published workflow by id', async () => {
        await expect(IgaWorkflowOps.deletePublishedWorkflow({
          workflowId: TestData.workflow5.id,
          state,
        })).rejects.toThrow('Error deleting published workflow ' + TestData.workflow6.id);
      });
    });
  }
  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('deleteWorkflows()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaWorkflowOps.deleteWorkflows).toBeDefined();
      });

      test.todo('1: Delete existing workflows');
    });
  }
});