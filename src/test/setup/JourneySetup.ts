import { state } from '../../index';
import * as JourneyOps from '../../ops/JourneyOps';
import { getJourney } from '../mocks/ForgeRockApiMockEngine';

export const journey1 = getJourney('FrodoTestJourney1');
export const journey2 = getJourney('FrodoTestJourney2');
export const journey3 = getJourney('FrodoTestJourney3');
export const journey4 = getJourney('FrodoTestJourney4');
export const journey5 = getJourney('FrodoTestJourney5');
export const journey6 = getJourney('FrodoTestJourney6');
export const journey7 = getJourney('FrodoTestJourney7');
export const journey8 = getJourney('FrodoTestJourney8');
export const journey9 = getJourney('FrodoTestJourney9');
export const journey10 = getJourney('FrodoTestJourney10');
export const journey10NoCoords = getJourney('FrodoTestJourney10NoCoords');
export const journey11 = getJourney('FrodoTestJourney11');
export const journey12 = getJourney('FrodoTestJourney12');

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
        importData: getJourney(journey.tree._id),
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
