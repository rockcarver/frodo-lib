import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { state } from '../../index';
import * as VariablesOps from '../../ops/cloud/VariablesOps';
import {
  VariableExpressionType,
  VariableSkeleton,
} from '../../api/cloud/VariablesApi';

export const variable1 = createTestVariable({
  id: 'esv-frodo-test-variable-1',
  value: 'value1',
  description: 'description1',
  expressionType: 'string',
});

export const variable2 = createTestVariable({
  id: 'esv-frodo-test-variable-2',
  value: '42',
  description: 'description2',
  expressionType: 'int',
});

export const variable3 = createTestVariable({
  id: 'esv-frodo-test-variable-3',
  value: 'true',
  description: 'description3',
  expressionType: 'bool',
});

export const variable4 = createTestVariable({
  id: 'esv-frodo-test-variable-4',
  value: 'value4',
  description: 'description4',
  expressionType: 'string',
});

export const variable5 = createTestVariable({
  id: 'esv-frodo-test-variable-5',
  value: 'value5',
  description: 'description5',
  expressionType: 'string',
});

export const variable6 = createTestVariable({
  id: 'esv-frodo-test-variable-6',
  value: 'value6',
  description: 'description6',
  expressionType: 'string',
});

export const variable7 = createTestVariable({
  id: 'esv-frodo-test-variable-7',
  value: 'value7',
  description: 'description7',
  expressionType: 'string',
});

export const variable8 = createTestVariable({
  id: 'esv-frodo-test-variable-8',
  value: 'value8',
  description: 'description8',
  expressionType: 'string',
});

export const variable9 = createTestVariable({
  id: 'esv-frodo-test-variable-9',
  value: 'value9',
  description: 'description9',
  expressionType: 'string',
});

export const variable10 = createTestVariable({
  id: 'esv-frodo-test-variable-10',
  value: 'value10',
  description: 'description10',
  expressionType: 'string',
});

export const variable11 = createTestVariable({
  id: 'esv-frodo-test-variable-11',
  value: 'value11',
  description: 'description11',
  expressionType: 'string',
});

export const variable12 = createTestVariable({
  id: 'esv-frodo-test-variable-12',
  value: 'value12',
  description: 'description12',
  expressionType: 'string',
});

export const variable13 = createTestVariable({
  id: 'esv-frodo-test-variable-13',
  value: 'value13',
  description: 'description13',
  expressionType: 'string',
});

export const variable14 = createTestVariable({
  id: 'esv-frodo-test-variable-14',
  value: 'value14',
  description: 'description14',
  expressionType: 'string',
});

export const variable15 = createTestVariable({
  id: 'esv-frodo-test-variable-15',
  value: 'value15',
  description: 'description15',
  expressionType: 'string',
});

export const variable16 = createTestVariable({
  id: 'esv-frodo-test-variable-16',
  value: 'value16',
  description: 'description16',
  expressionType: 'string',
});

export const variable17 = createTestVariable({
  id: 'esv-frodo-test-variable-17',
  value: 'value17',
  description: 'description17',
  expressionType: 'string',
});

export const variable18 = createTestVariable({
  id: 'esv-frodo-test-variable-18',
  value: 'value18',
  description: 'description18',
  expressionType: 'string',
});

export const variable19 = createTestVariable({
  id: 'esv-frodo-test-variable-19',
  value: 'value19',
  description: 'description19',
  expressionType: 'string',
});

function createTestVariable({
  id,
  description,
  expressionType,
  value,
}: {
  id: string;
  description: string;
  expressionType: VariableExpressionType;
  value: string;
}): VariableSkeleton {
  return {
    _id: id,
    description,
    expressionType,
    lastChangeDate: '2024-07-03T03:28:19.227876Z',
    lastChangedBy: 'volker.scheuber@forgerock.com',
    loaded: false,
    value,
  };
}

export function createTestVariableExport(
  variables: VariableSkeleton[]
): VariablesOps.VariablesExportInterface {
  return {
    meta: {
      exportDate: '2024-07-03T03:48:18.901Z',
      exportTool: 'frodo',
      exportToolVersion: 'v2.0.0-89 [v20.5.1]',
      exportedBy: 'volker.scheuber@forgerock.com',
      origin: 'https://openam-frodo-dev.forgeblocks.com/am',
      originAmVersion: '7.6.0',
    },
    variable: Object.fromEntries(variables.map((v) => [v._id, v])),
  };
}

export async function stageVariable(variable: VariableSkeleton, create = true) {
  // delete if exists, then create
  await VariablesOps.deleteVariable({ variableId: variable._id, state });

  // ignore
  if (create) {
    await VariablesOps.createVariable({
      variableId: variable._id,
      value: variable.value,
      description: variable.description,
      expressionType: variable.expressionType as VariableExpressionType,
      state: state,
    });
  }
}

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
      await stageVariable(variable3, false);
      await stageVariable(variable4, false);
      await stageVariable(variable5, false);
      await stageVariable(variable6, false);
      await stageVariable(variable7, false);
      await stageVariable(variable8, false);
      await stageVariable(variable9, false);
      await stageVariable(variable10, false);
      await stageVariable(variable11, false);
      await stageVariable(variable12, false);
      await stageVariable(variable13, false);
      await stageVariable(variable14);
      await stageVariable(variable15);
      await stageVariable(variable16, false);
      await stageVariable(variable17, false);
      await stageVariable(variable18);
      await stageVariable(variable19);
    }
  });

  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageVariable(variable1, false);
      await stageVariable(variable2, false);
      await stageVariable(variable3, false);
      await stageVariable(variable4, false);
      await stageVariable(variable5, false);
      await stageVariable(variable6, false);
      await stageVariable(variable7, false);
      await stageVariable(variable8, false);
      await stageVariable(variable9, false);
      await stageVariable(variable10, false);
      await stageVariable(variable11, false);
      await stageVariable(variable12, false);
      await stageVariable(variable13, false);
      await stageVariable(variable14, false);
      await stageVariable(variable15, false);
      await stageVariable(variable16, false);
      await stageVariable(variable17, false);
      await stageVariable(variable18, false);
      await stageVariable(variable19, false);
    }
  });
}
