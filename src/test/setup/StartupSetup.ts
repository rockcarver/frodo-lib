import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { stageVariable, variable1, variable2 } from './VariablesSetup';
import { stageSecret, secret1, secret2 } from './SecretSetup';

export async function setup() {
  const ctx = autoSetupPolly();

  // filter out secrets when recording
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageVariable(variable1);
      await stageVariable(variable2);
      await stageSecret(secret1);
      await stageSecret(secret2);
    }
  });

  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageVariable(variable1, false);
      await stageVariable(variable2, false);
      await stageSecret(secret1, false);
      await stageSecret(secret2, false);
    }
  });
}
