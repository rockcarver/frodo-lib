/**
 * To record and update snapshots, you must perform 3 steps in order:
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
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE JOURNEYS!!!
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
import { state } from '../index';
import * as JourneyOps from './JourneyOps';
import { getJourney } from '../test/mocks/ForgeRockApiMockEngine';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { filterRecording } from '../utils/PollyUtils';
import Constants from '../shared/Constants';
import { snapshotResultCallback } from '../test/utils/TestUtils';

const ctx = autoSetupPolly();

state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);

async function stageJourney(journey: { id: string }, create = true) {
  // delete if exists, then create
  try {
    await JourneyOps.readJourney({ journeyId: journey.id, state });
    await JourneyOps.deleteJourney({
      journeyId: journey.id,
      options: {
        deep: true,
        verbose: false,
        progress: false,
      },
      state,
    });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await JourneyOps.importJourney({
        importData: getJourney(journey.id),
        options: {
          reUuid: false,
          deps: true,
        },
        state,
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
  const journey10 = {
    id: 'FrodoTestJourney10',
  };
  const journey10NoCoords = {
    id: 'FrodoTestJourney10NoCoords'
  };
  const journey11 = {
    id: 'FrodoTestJourney11',
  }
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
      await stageJourney(journey10);
      await stageJourney(journey10NoCoords, false);
      await stageJourney(journey11, false);
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
      await stageJourney(journey10, false);
      await stageJourney(journey10NoCoords, false);
      await stageJourney(journey11, false);
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
    describe('updateCoordinates()', () => {
      const node1 = '5883ff1e-80dd-49f5-a609-120303e1b0cd';
      const node2 = '59129227-f192-4ff4-a7b4-bc7690b82d4f';
      const node5 = '6a1aa88f-25f8-4d40-8008-bfc6684b2a58';
      const node6 = '8b1a8dc8-338f-46af-a4c5-6fe7cf6a2cf5';

      test('0: Method is implemented', async () => {
        expect(JourneyOps.updateCoordinates).toBeDefined();
      });

      test('1: Nothing changes when coordinates exist', async () => {
        const journey = getJourney(journey10.id);
        const tree = JSON.parse(JSON.stringify(journey.tree));
        expect(await JourneyOps.updateCoordinates({
          tree: tree,
          nodesAttributeName: "nodes",
          serverTree: null,
          state
        })).toBeNull();
        expect(tree).toMatchSnapshot(journey.tree);
      });

      test('2: Update coordinates with server coordinates when server tree exists', async () => {
        const journey = getJourney(journey10.id);
        const tree = JSON.parse(JSON.stringify(journey.tree));
        delete tree.nodes[node1].x;
        delete tree.nodes[node2].y;
        const serverTree = await JourneyOps.updateCoordinates({
          tree: tree,
          nodesAttributeName: "nodes",
          serverTree: null,
          state
        });
        //Ignore the _rev field
        if (serverTree) serverTree._rev = journey.tree._rev;
        expect(serverTree).toStrictEqual(journey.tree);
        expect(tree).toMatchSnapshot(journey.tree);
      });

      test('3: Updates coordinates to 0 if serverTree does not exist', async () => {
        const journey = getJourney(journey11.id);
        const expectedTree = JSON.parse(JSON.stringify(journey.tree));
        expectedTree.nodes[node5].x = 0;
        expectedTree.nodes[node5].y = 0;
        expectedTree.nodes[node6].x = 0;
        expectedTree.nodes[node6].y = 0;
        const tree = JSON.parse(JSON.stringify(journey.tree));
        expect(await JourneyOps.updateCoordinates({
          tree: tree,
          nodesAttributeName: "nodes",
          serverTree: null,
          state
        })).toBeNull();
        expect(tree).toMatchSnapshot(expectedTree);
      });

      test('4: Updates coordinates to 0 if serverTree nodes do not exist', async () => {
        const journey = getJourney(journey10NoCoords.id);
        const expectedTree = JSON.parse(JSON.stringify(journey.tree));
        expectedTree.nodes[node1].x = 0;
        expectedTree.nodes[node1].y = 0;
        expectedTree.nodes[node2].x = 0;
        expectedTree.nodes[node2].y = 0;
        const serverTree = JSON.parse(JSON.stringify(journey.tree));
        delete serverTree.nodes;
        const tree = JSON.parse(JSON.stringify(journey.tree));
        expect(await JourneyOps.updateCoordinates({
          tree: tree,
          nodesAttributeName: "nodes",
          serverTree: serverTree,
          state
        })).toStrictEqual(serverTree);
        expect(tree).toStrictEqual(expectedTree);
      });

      test('5: Updates coordinates in various cases', async () => {
        const journey = getJourney(journey10.id);
        const journeyNoCoords = getJourney(journey10NoCoords.id);
        const expectedTree = JSON.parse(JSON.stringify(journey.tree));
        expectedTree.nodes[node1].x = 0;
        expectedTree.nodes[node2].y = 0;
        expectedTree.nodes[node2].x = 1001;
        expectedTree.staticNodes.node3.y = 0;
        expectedTree.staticNodes.node4.x = 0;
        expectedTree.staticNodes.node4.y = 1002;
        const serverTree = JSON.parse(JSON.stringify(journey.tree));
        delete serverTree.nodes[node1].x;
        delete serverTree.nodes[node2].y;
        delete serverTree.staticNodes.node3.y;
        delete serverTree.staticNodes.node4.x;
        const tree = JSON.parse(JSON.stringify(journeyNoCoords.tree));
        tree.nodes[node2].x = 1001;
        tree.staticNodes.node4.y = 1002;
        expect(await JourneyOps.updateCoordinates({
          tree: tree,
          nodesAttributeName: "nodes",
          serverTree: serverTree,
          state
        })).toStrictEqual(serverTree);
        expect(await JourneyOps.updateCoordinates({
          tree: tree,
          nodesAttributeName: "staticNodes",
          serverTree: serverTree,
          state
        })).toStrictEqual(serverTree);
        expect(tree).toStrictEqual(expectedTree);
      });
    });

    describe('readJourneys()', () => {
      test('0: Method is implemented', async () => {
        expect(JourneyOps.readJourneys).toBeDefined();
      });

      test('1: Read all journeys', async () => {
        const journeys = await JourneyOps.readJourneys({ state });
        expect(journeys).toMatchSnapshot();
      });
    });

    describe('exportJourney()', () => {
      test('0: Method is implemented', async () => {
        expect(JourneyOps.exportJourney).toBeDefined();
      });

      test(`1: Export journey '${journey3.id}' w/o dependencies`, async () => {
        const response = await JourneyOps.exportJourney({
          journeyId: journey3.id,
          options: {
            useStringArrays: false,
            deps: false,
            coords: true,
          },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`2: Export journey '${journey3.id}' w/ dependencies`, async () => {
        const response = await JourneyOps.exportJourney({
          journeyId: journey3.id,
          options: {
            useStringArrays: false,
            deps: true,
            coords: true,
          },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`3: Export journey '${journey3.id}' w/ dependencies and w/o coordinates`, async () => {
        const response = await JourneyOps.exportJourney({
          journeyId: journey3.id,
          options: {
            useStringArrays: false,
            deps: true,
            coords: false,
          },
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('exportJourneys()', () => {
      test('0: Method is implemented', async () => {
        expect(JourneyOps.exportJourneys).toBeDefined();
      });

      test('1: Export journeys w/o dependencies', async () => {
        const response = await JourneyOps.exportJourneys({ options: { deps: false, useStringArrays: true, coords: true }, resultCallback: snapshotResultCallback, state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('2: Export journeys w/ dependencies', async () => {
        const response = await JourneyOps.exportJourneys({ options: { deps: true, useStringArrays: true, coords: true }, resultCallback: snapshotResultCallback, state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test('3: Export journeys w/ dependencies and w/o coordinates', async () => {
        const response = await JourneyOps.exportJourneys({ options: { deps: true, useStringArrays: true, coords: false }, resultCallback: snapshotResultCallback, state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('importJourney()', () => {
      test('0: Method is implemented', async () => {
        expect(JourneyOps.importJourney).toBeDefined();
      });

      test(`1: Import journey '${journey4.id}' w/o dependencies`, async () => {
        const journeyExport = getJourney(journey4.id);
        expect.assertions(1);
        const response = await JourneyOps.importJourney({
          importData: journeyExport,
          options: {
            reUuid: false,
            deps: false,
          },
          state,
        });
        expect(response).toBeTruthy();
      });

      test(`2: Import journey '${journey5.id}' w/ dependencies`, async () => {
        const journeyExport = getJourney(journey5.id);
        expect.assertions(1);
        const response = await JourneyOps.importJourney({
          importData: journeyExport,
          options: {
            reUuid: false,
            deps: true,
          },
          state,
        });
        expect(response).toBeTruthy();
      });
    });

    describe('enableJourney()', () => {
      test('0: Method is implemented', async () => {
        expect(JourneyOps.enableJourney).toBeDefined();
      });

      test(`1: Enable disabled journey '${journey6.id}'`, async () => {
        expect.assertions(1);
        const result = await JourneyOps.enableJourney({
          journeyId: journey6.id,
          state,
        });
        expect(result).toBeTruthy();
      });

      test(`2: Enable already enabled journey '${journey7.id}'`, async () => {
        expect.assertions(1);
        const result = await JourneyOps.enableJourney({
          journeyId: journey7.id,
          state,
        });
        expect(result).toBeTruthy();
      });
    });

    describe('disableJourney()', () => {
      test('0: Method is implemented', async () => {
        expect(JourneyOps.disableJourney).toBeDefined();
      });

      test(`1: Disable enabled journey '${journey8.id}'`, async () => {
        expect.assertions(1);
        const result = await JourneyOps.disableJourney({
          journeyId: journey8.id,
          state,
        });
        expect(result).toBeTruthy();
      });

      test(`2: Disable already disabled journey '${journey9.id}'`, async () => {
        expect.assertions(1);
        const result = await JourneyOps.disableJourney({
          journeyId: journey9.id,
          state,
        });
        expect(result).toBeTruthy();
      });
    });
  }
});
