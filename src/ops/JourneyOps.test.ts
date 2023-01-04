/**
 * To record and update snapshots, you must perform 5 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    This step breaks down into 4 phases:
 *
 *    Phase 1: Record Non-destructive tests
 *    Phase 2: Record Group 1 of DESTRUCTIVE tests - Deletes by ID
 *    Phase 3: Record Group 2 of DESTRUCTIVE tests - Deletes by tag
 *    Phase 4: Record Group 3 of DESTRUCTIVE tests - Delete all
 *
 *    Because destructive tests interfere with the recording of non-destructive
 *    tests and also interfere among themselves, they have to be run in groups
 *    of non-interfering tests.
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record JourneyOps
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE AGENTS!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record JourneyOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=3 FRODO_HOST=frodo-dev npm run test:record JourneyOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=4 FRODO_HOST=frodo-dev npm run test:record JourneyOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update JourneyOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only JourneyOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { jest } from '@jest/globals';
import { Journey, state } from '../index';
import { getJourney } from '../test/mocks/ForgeRockApiMockEngine';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import * as globalConfig from '../storage/StaticStorage';

// Increase timeout for this test as pipeline keeps failing with error:
// Timeout - Async callback was not invoked within the 5000 ms timeout specified by jest.setTimeout.
jest.setTimeout(30000);

autoSetupPolly();

state.setDeploymentType(globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY);

async function stageJourney(journey: { id: string }, create = true) {
  // delete if exists, then create
  try {
    await Journey.getJourney(journey.id);
    await Journey.deleteJourney(journey.id, {
      deep: true,
      verbose: false,
      progress: false,
    });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await Journey.importJourney(getJourney(journey.id), {
        reUuid: false,
        deps: true,
      });
    }
  }
}

describe('JourneyOps', () => {
  const journey1 = {
    id: 'FrodoTestJourney1',
  };
  const journey2 = {
    id: 'FrodoTestJourney2',
  };
  const journey3 = {
    id: 'FrodoTestJourney3',
  };
  const journey4 = {
    id: 'FrodoTestJourney4',
  };
  const journey5 = {
    id: 'FrodoTestJourney5',
  };
  const journey6 = {
    id: 'FrodoTestJourney6',
  };
  const journey7 = {
    id: 'FrodoTestJourney7',
  };
  const journey8 = {
    id: 'FrodoTestJourney8',
  };
  const journey9 = {
    id: 'FrodoTestJourney9',
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageJourney(journey1);
      await stageJourney(journey2);
      await stageJourney(journey3);
      await stageJourney(journey4, false);
      await stageJourney(journey5, false);
      await stageJourney(journey6);
      await stageJourney(journey7);
      await stageJourney(journey8);
      await stageJourney(journey9);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageJourney(journey1, false);
      await stageJourney(journey2, false);
      await stageJourney(journey3, false);
      await stageJourney(journey4, false);
      await stageJourney(journey5, false);
      await stageJourney(journey6, false);
      await stageJourney(journey7, false);
      await stageJourney(journey8, false);
      await stageJourney(journey9, false);
    }
  });
  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('getJourneys()', () => {
      test('0: Method is implemented', async () => {
        expect(Journey.getJourneys).toBeDefined();
      });

      test('1: Get all journeys', async () => {
        const journeys = await Journey.getJourneys();
        expect(journeys).toMatchSnapshot();
      });
    });

    describe('exportJourney()', () => {
      test('0: Method is implemented', async () => {
        expect(Journey.exportJourney).toBeDefined();
      });

      test(`1: Export journey '${journey3.id}' w/o dependencies`, async () => {
        const response = await Journey.exportJourney(journey3.id, {
          useStringArrays: false,
          deps: false,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export journey '${journey3.id}' w/ dependencies`, async () => {
        const response = await Journey.exportJourney(journey3.id, {
          useStringArrays: false,
          deps: true,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('importJourney()', () => {
      test('0: Method is implemented', async () => {
        expect(Journey.importJourney).toBeDefined();
      });

      test(`1: Import journey '${journey4.id}' w/o dependencies`, async () => {
        const journeyExport = getJourney(journey4.id);
        expect.assertions(1);
        const response = await Journey.importJourney(journeyExport, {
          reUuid: false,
          deps: false,
        });
        expect(response).toBeTruthy();
      });

      test(`2: Import journey '${journey5.id}' w/ dependencies`, async () => {
        const journeyExport = getJourney(journey5.id);
        expect.assertions(1);
        const response = await Journey.importJourney(journeyExport, {
          reUuid: false,
          deps: true,
        });
        expect(response).toBeTruthy();
      });
    });

    describe('enableJourney()', () => {
      test('0: Method is implemented', async () => {
        expect(Journey.enableJourney).toBeDefined();
      });

      test(`1: Enable disabled journey '${journey6.id}'`, async () => {
        expect.assertions(1);
        const result = await Journey.enableJourney(journey6.id);
        expect(result).toBeTruthy();
      });

      test(`2: Enable already enabled journey '${journey7.id}'`, async () => {
        expect.assertions(1);
        const result = await Journey.enableJourney(journey7.id);
        expect(result).toBeTruthy();
      });
    });

    describe('disableJourney()', () => {
      test('0: Method is implemented', async () => {
        expect(Journey.disableJourney).toBeDefined();
      });

      test(`1: Disable enabled journey '${journey8.id}'`, async () => {
        expect.assertions(1);
        const result = await Journey.disableJourney(journey8.id);
        expect(result).toBeTruthy();
      });

      test(`2: Disable already disabled journey '${journey9.id}'`, async () => {
        expect.assertions(1);
        const result = await Journey.disableJourney(journey9.id);
        expect(result).toBeTruthy();
      });
    });
  }
});
