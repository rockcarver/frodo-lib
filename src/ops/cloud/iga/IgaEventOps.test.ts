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
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=trivir-f npm run test:record IgaEventOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record IgaEventOps
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE JOURNEYS!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record IgaEventOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update IgaEventOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only IgaEventOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../../../index';
import * as IgaEventOps from './IgaEventOps';
import * as TestData from '../../../test/setup/IgaEventSetup';
import { snapshotResultCallback } from '../../../test/utils/TestUtils';
import { debugMessage } from '../../../utils/Console';
import { template1 } from '../../../test/setup/EmailTemplateSetup';

describe('IgaEventOps', () => {
  
  TestData.setup();

  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('createEventExportTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.createEventExportTemplate).toBeDefined();
      });

      test('1: Create Event Export Template', async () => {
        const response = IgaEventOps.createEventExportTemplate({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object)
        });
      });
    });

    describe('createEvent()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.createEvent).toBeDefined();
      });

      test(`1: Create event`, async () => {
        const response = await IgaEventOps.createEvent({
          eventData: TestData.event1,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readEvent()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.readEvent).toBeDefined();
      });

      test(`1: Read existing event by ID`, async () => {
        const response = await IgaEventOps.readEvent({
          eventId: TestData.event2.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing event', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaEventOps.readEvent({
          eventId: unknownId,
          state,
        })).rejects.toThrow('Error reading event ' + unknownId);
      });
    });

    describe('readEventByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.readEventByName).toBeDefined();
      });

      test(`1: Read existing event by name`, async () => {
        const response = await IgaEventOps.readEventByName({
          eventName: TestData.event2.name,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing event with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaEventOps.readEventByName({
          eventName: unknownName,
          state,
        })).rejects.toThrow('Error reading event ' + unknownName);
      });
    });

    describe('readEvents()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.readEvents).toBeDefined();
      });

      test(`1: Read existing events`, async () => {
        const response = await IgaEventOps.readEvents({
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportEvent()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.exportEvent).toBeDefined();
      });

      test(`1: Export existing event by ID with dependencies`, async () => {
        const response = await IgaEventOps.exportEvent({
          eventId: TestData.event2.id,
          options: { deps: true },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
  
      test('2: Export non-existing event', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaEventOps.exportEvent({
          eventId: unknownId,
          options: { deps: true },
          state,
        })).rejects.toThrow('Error exporting event ' + unknownId);
      });
    });

    describe('exportEventByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.exportEventByName).toBeDefined();
      });

      test(`1: Export existing event by name without dependencies`, async () => {
        const response = await IgaEventOps.exportEventByName({
          eventName: TestData.event2.name,
          options: { deps: false },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('2: Export non-existing event with unknown name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaEventOps.exportEventByName({
          eventName: unknownName,
          options: { deps: false },
          state,
        })).rejects.toThrow('Error exporting event ' + unknownName);
      });
    });

    describe('exportEvents()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.exportEvents).toBeDefined();
      });

      test(`1: Export existing events with dependencies`, async () => {
        const response = await IgaEventOps.exportEvents({
          options: { deps: true },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export existing events without dependencies`, async () => {
        const response = await IgaEventOps.exportEvents({
          options: { deps: false },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('updateEvent()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.updateEvent).toBeDefined();
      });

      test(`1: Update existing event`, async () => {
        const response = await IgaEventOps.updateEvent({
          eventId: TestData.event2.id,
          eventData: TestData.event2,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('importEvents()', () => {
      const importData = IgaEventOps.createEventExportTemplate({ state });
      importData.event = {
        [TestData.event3.id]: TestData.event3,
        [TestData.event4.id]: TestData.event4,
        [TestData.event5.id]: TestData.event5,
      }
      importData.emailTemplate = {
        [template1._id]: template1
      }
      
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.importEvents).toBeDefined();
      });

      test('1: Import None', async () => {
        const response = await IgaEventOps.importEvents({
          importData: IgaEventOps.createEventExportTemplate({ state }),
          options: {
            deps: true
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Import by ID with deps', async () => {
        await TestData.stageEvent(TestData.event3);
        debugMessage({message: `importData = ${JSON.stringify(importData)}`, state });
        const response = await IgaEventOps.importEvents({
          eventId: TestData.event3.id,
          importData,
          options: {
            deps: true
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('3: Import by Name with no deps', async () => {
        await TestData.stageEvent(TestData.event3);
        const response = await IgaEventOps.importEvents({
          eventName: TestData.event3.name,
          importData,
          options: {
            deps: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('4: Import all', async () => {
        await TestData.stageEvent(TestData.event3);
        const response = await IgaEventOps.importEvents({
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

    describe('deleteEvent()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.deleteEvent).toBeDefined();
      });

      test(`1: Delete existing event by id`, async () => {
        const response = await IgaEventOps.deleteEvent({
          eventId: TestData.event6.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing event by id', async () => {
        const unknownId = '11111111-1111-1111-1111-111111111111';
        await expect(IgaEventOps.deleteEvent({
          eventId: unknownId,
          state,
        })).rejects.toThrow('Error deleting event ' + unknownId);
      });
    });

    describe('deleteEventByName()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.deleteEventByName).toBeDefined();
      });

      test(`1: Delete existing event by name`, async () => {
        const response = await IgaEventOps.deleteEventByName({
          eventName: TestData.event7.name,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Delete non-existing event by name', async () => {
        const unknownName = 'unknownName';
        await expect(IgaEventOps.deleteEventByName({
          eventName: unknownName,
          state,
        })).rejects.toThrow('Error deleting event ' + unknownName);
      });
    });
  }
  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('deleteEvents()', () => {
      test('0: Method is implemented', async () => {
        expect(IgaEventOps.deleteEvents).toBeDefined();
      });

      test.todo('1: Delete existing events');
    });
  }
});