import { state } from '../../index';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { stageEmailTemplate, template1, template2 } from './EmailTemplateSetup';
import { customNode1, customNode2, stageCustomNode } from './NodeSetup';
import { stageVariable, variable1, variable2 } from './VariablesSetup';

export function setup() {
  const ctx = autoSetupPolly();

  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        // Filter recordings
        filterRecording(recording, true, state);
      });
    }
  });

  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageVariable(variable1, true);
      await stageVariable(variable2);
      await stageCustomNode(customNode1, true);
      await stageCustomNode(customNode2);
      await stageEmailTemplate(template1, true);
      await stageEmailTemplate(template2);
    }
  });

  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageVariable(variable1);
      await stageVariable(variable2);
      await stageCustomNode(customNode1);
      await stageCustomNode(customNode2);
      await stageEmailTemplate(template1);
      await stageEmailTemplate(template2);
    }
  });
}
