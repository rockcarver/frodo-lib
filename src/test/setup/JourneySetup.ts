import { state } from '../../index';
import * as JourneyOps from '../../ops/JourneyOps';
import { getJourney } from '../mocks/ForgeRockApiMockEngine';

function getJourneyFixture(
  journeyId: string
): JourneyOps.SingleTreeExportInterface {
  const rawJourney = getJourney(journeyId) as any;
  // Support both fixture formats:
  // 1) Single tree export: { tree, nodes, innerNodes, ... }
  // 2) Wrapped export: { meta, trees: { [journeyId]: { tree, ... } } }
  if (rawJourney?.tree) {
    return rawJourney as JourneyOps.SingleTreeExportInterface;
  }
  const wrappedTree = rawJourney?.trees?.[journeyId];
  if (wrappedTree?.tree) {
    return {
      ...(wrappedTree as JourneyOps.SingleTreeExportInterface),
      meta: rawJourney?.meta,
    } as JourneyOps.SingleTreeExportInterface;
  }
  throw new Error(`Unable to resolve journey fixture '${journeyId}'`);
}

export const journey1 = getJourneyFixture('FrodoTestJourney1');
export const journey2 = getJourneyFixture('FrodoTestJourney2');
export const journey3 = getJourneyFixture('FrodoTestJourney3');
export const journey4 = getJourneyFixture('FrodoTestJourney4');
export const journey5 = getJourneyFixture('FrodoTestJourney5');
export const journey6 = getJourneyFixture('FrodoTestJourney6');
export const journey7 = getJourneyFixture('FrodoTestJourney7');
export const journey8 = getJourneyFixture('FrodoTestJourney8');
export const journey9 = getJourneyFixture('FrodoTestJourney9');
export const journey10 = getJourneyFixture('FrodoTestJourney10');
export const journey10NoCoords = getJourneyFixture(
  'FrodoTestJourney10NoCoords'
);
export const journey11 = getJourneyFixture('FrodoTestJourney11');
export const journey12 = getJourneyFixture('FrodoTestJourney12');
export const journey13 = getJourneyFixture('FrodoTestJourney13');

export async function stageJourney(
  journey: JourneyOps.SingleTreeExportInterface,
  create = true
) {
  // delete if exists, then create
  try {
    await JourneyOps.deleteJourney({
      journeyId: journey.tree._id,
      options: {
        deep: true,
        verbose: false,
        progress: false,
      },
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await JourneyOps.importJourney({
        importData: getJourneyFixture(journey.tree._id),
        options: {
          reUuid: false,
          deps: true,
        },
        state,
      });
    }
  }
}

export function setup() {
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
      await stageJourney(journey12);
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
      await stageJourney(journey12, false);
    }
  });
}
