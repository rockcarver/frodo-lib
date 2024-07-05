/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state variables required to connect to the
 *    env to record from:
 *
 *    ATTENTION: For the recording to succeed, you MUST make sure to use a
 *               user account, not a service account.
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record VariablesOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update VariablesOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only VariablesOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */

import { autoSetupPolly, filterRecording } from '../../utils/AutoSetupPolly';
import { state } from '../../index';
import * as VariablesOps from './VariablesOps';
import { VariableExpressionType } from '../../api/cloud/VariablesApi';
import { FrodoError } from '../FrodoError';
import { encode } from '../../utils/Base64Utils';

const ctx = autoSetupPolly();

async function stageVariable(
  variable: {
    id: string;
    value: string;
    description: string;
    expressionType: string;
  },
  create = true
) {
  // delete if exists, then create
  try {
    await VariablesOps.deleteVariable({ variableId: variable.id, state });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await VariablesOps.createVariable({
        variableId: variable.id,
        value: variable.value,
        description: variable.description,
        expressionType: variable.expressionType as VariableExpressionType,
        state: state,
      });
    }
  }
}

describe('VariablesOps', () => {
  const variable1 = {
    id: 'esv-frodo-test-variable-1',
    value: 'value1',
    description: 'description1',
    expressionType: 'string',
  };
  const variable2 = {
    id: 'esv-frodo-test-variable-2',
    value: '42',
    description: 'description2',
    expressionType: 'int',
  };
  const variable3 = {
    id: 'esv-frodo-test-variable-3',
    value: 'true',
    description: 'description3',
    expressionType: 'bool',
  };
  const variable4 = {
    id: 'esv-frodo-test-variable-4',
    value: 'value4',
    description: 'description4',
    expressionType: 'string',
  };
  const variable4Export: VariablesOps.VariablesExportInterface = {
    meta: {
      exportDate: '2024-07-03T03:29:28.835Z',
      exportTool: 'frodo',
      exportToolVersion: 'v2.0.0-89 [v20.5.1]',
      exportedBy: 'volker.scheuber@forgerock.com',
      origin: 'https://openam-frodo-dev.forgeblocks.com/am',
      originAmVersion: '7.6.0',
    },
    variables: {
      'esv-frodo-test-variable-4': {
        _id: 'esv-frodo-test-variable-4',
        description: 'description4',
        expressionType: 'string',
        lastChangeDate: '2024-07-03T03:28:19.227876Z',
        lastChangedBy: 'volker.scheuber@forgerock.com',
        loaded: false,
        value: 'value4',
      },
    },
  };
  const variable5 = {
    id: 'esv-frodo-test-variable-5',
    value: 'value5',
    description: 'description5',
    expressionType: 'string',
  };
  const variable5Export: VariablesOps.VariablesExportInterface = {
    meta: {
      exportDate: '2024-07-03T03:29:28.835Z',
      exportTool: 'frodo',
      exportToolVersion: 'v2.0.0-89 [v20.5.1]',
      exportedBy: 'volker.scheuber@forgerock.com',
      origin: 'https://openam-frodo-dev.forgeblocks.com/am',
      originAmVersion: '7.6.0',
    },
    variables: {
      'esv-frodo-test-variable-5': {
        _id: 'esv-frodo-test-variable-5',
        description: 'description5',
        expressionType: 'string',
        lastChangeDate: '2024-07-03T03:28:19.227876Z',
        lastChangedBy: 'volker.scheuber@forgerock.com',
        loaded: false,
        value: 'value5',
      },
    },
  };
  const variable6 = {
    id: 'esv-frodo-test-variable-6',
    value: 'value6',
    description: 'description6',
    expressionType: 'string',
  };
  const variable6Export: VariablesOps.VariablesExportInterface = {
    meta: {
      exportDate: '2024-07-03T03:29:28.835Z',
      exportTool: 'frodo',
      exportToolVersion: 'v2.0.0-89 [v20.5.1]',
      exportedBy: 'volker.scheuber@forgerock.com',
      origin: 'https://openam-frodo-dev.forgeblocks.com/am',
      originAmVersion: '7.6.0',
    },
    variables: {
      'esv-frodo-test-variable-6': {
        _id: 'esv-frodo-test-variable-6',
        description: 'description6',
        expressionType: 'string',
        lastChangeDate: '2024-07-03T03:28:19.227876Z',
        lastChangedBy: 'volker.scheuber@forgerock.com',
        loaded: false,
        value: 'value6',
      },
    },
  };
  const variable7 = {
    id: 'esv-frodo-test-variable-7',
    value: 'value7',
    description: 'description7',
    expressionType: 'string',
  };
  const variable7Export: VariablesOps.VariablesExportInterface = {
    meta: {
      exportDate: '2024-07-03T03:29:28.835Z',
      exportTool: 'frodo',
      exportToolVersion: 'v2.0.0-89 [v20.5.1]',
      exportedBy: 'volker.scheuber@forgerock.com',
      origin: 'https://openam-frodo-dev.forgeblocks.com/am',
      originAmVersion: '7.6.0',
    },
    variables: {
      'esv-frodo-test-variable-7': {
        _id: 'esv-frodo-test-variable-7',
        description: 'description7',
        expressionType: 'string',
        lastChangeDate: '2024-07-03T03:28:19.227876Z',
        lastChangedBy: 'volker.scheuber@forgerock.com',
        loaded: false,
        value: 'value7',
      },
    },
  };
  const variable8 = {
    id: 'esv-frodo-test-variable-8',
    value: 'value8',
    description: 'description8',
    expressionType: 'string',
  };
  const variable9 = {
    id: 'esv-frodo-test-variable-9',
    value: 'value9',
    description: 'description9',
    expressionType: 'string',
  };
  const variables89Export: VariablesOps.VariablesExportInterface = {
    meta: {
      exportDate: '2024-07-03T03:48:18.901Z',
      exportTool: 'frodo',
      exportToolVersion: 'v2.0.0-89 [v20.5.1]',
      exportedBy: 'volker.scheuber@forgerock.com',
      origin: 'https://openam-frodo-dev.forgeblocks.com/am',
      originAmVersion: '7.6.0',
    },
    variables: {
      'esv-frodo-test-variable-8': {
        _id: 'esv-frodo-test-variable-8',
        description: 'description8',
        expressionType: 'string',
        lastChangeDate: '2024-07-03T03:46:04.882539Z',
        lastChangedBy: 'Frodo-SA-1701393386423',
        loaded: false,
        value: 'value8',
        valueBase64: 'dmFsdWU4',
      },
      'esv-frodo-test-variable-9': {
        _id: 'esv-frodo-test-variable-9',
        description: 'description9',
        expressionType: 'string',
        lastChangeDate: '2024-07-03T03:46:05.676501Z',
        lastChangedBy: 'Frodo-SA-1701393386423',
        loaded: false,
        value: 'value9',
        valueBase64: 'dmFsdWU5',
      },
    },
  };
  const variable10 = {
    id: 'esv-frodo-test-variable-10',
    value: 'value10',
    description: 'description10',
    expressionType: 'string',
  };
  const variable11 = {
    id: 'esv-frodo-test-variable-11',
    value: 'value11',
    description: 'description11',
    expressionType: 'string',
  };
  const variables1011Export: VariablesOps.VariablesExportInterface = {
    meta: {
      exportDate: '2024-07-03T03:48:18.901Z',
      exportTool: 'frodo',
      exportToolVersion: 'v2.0.0-89 [v20.5.1]',
      exportedBy: 'volker.scheuber@forgerock.com',
      origin: 'https://openam-frodo-dev.forgeblocks.com/am',
      originAmVersion: '7.6.0',
    },
    variables: {
      'esv-frodo-test-variable-10': {
        _id: 'esv-frodo-test-variable-10',
        description: 'description10',
        expressionType: 'string',
        lastChangeDate: '2024-07-03T03:45:51.06282Z',
        lastChangedBy: 'Frodo-SA-1701393386423',
        loaded: false,
        value: 'value10',
        valueBase64: 'dmFsdWUxMA==',
      },
      'esv-frodo-test-variable-11': {
        _id: 'esv-frodo-test-variable-11',
        description: 'description11',
        expressionType: 'string',
        lastChangeDate: '2024-07-03T03:45:52.248873Z',
        lastChangedBy: 'Frodo-SA-1701393386423',
        loaded: false,
        value: 'value11',
        valueBase64: 'dmFsdWUxMQ==',
      },
    },
  };
  const variable12 = {
    id: 'esv-frodo-test-variable-12',
    value: 'value12',
    description: 'description12',
    expressionType: 'string',
  };
  const variable13 = {
    id: 'esv-frodo-test-variable-13',
    value: 'value13',
    description: 'description13',
    expressionType: 'string',
  };
  const variable14 = {
    id: 'esv-frodo-test-variable-14',
    value: 'value14',
    description: 'description14',
    expressionType: 'string',
  };
  const variable15 = {
    id: 'esv-frodo-test-variable-15',
    value: 'value15',
    description: 'description15',
    expressionType: 'string',
  };
  const variable16 = {
    id: 'esv-frodo-test-variable-16',
    value: 'value16',
    description: 'description16',
    expressionType: 'string',
  };
  const variable17 = {
    id: 'esv-frodo-test-variable-17',
    value: 'value17',
    description: 'description17',
    expressionType: 'string',
  };
  const variable18 = {
    id: 'esv-frodo-test-variable-18',
    value: 'value18',
    description: 'description18',
    expressionType: 'string',
  };
  const variable19 = {
    id: 'esv-frodo-test-variable-19',
    value: 'value19',
    description: 'description19',
    expressionType: 'string',
  };
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

  describe('createVariablesExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.createVariablesExportTemplate).toBeDefined();
    });

    test('1: Return template with meta data', async () => {
      expect(
        VariablesOps.createVariablesExportTemplate({ state: state })
      ).toStrictEqual({
        meta: expect.any(Object),
        variables: {},
      });
    });
  });

  describe('exportVariables()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.exportVariables).toBeDefined();
    });

    test('1: Export all variables', async () => {
      const response = await VariablesOps.exportVariables({
        noDecode: false,
        state: state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('2: Export all variables without decoding', async () => {
      const response = await VariablesOps.exportVariables({
        noDecode: true,
        state: state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('exportVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.exportVariable).toBeDefined();
    });

    test('1: Export variable1', async () => {
      const response = await VariablesOps.exportVariable({
        variableId: variable1.id,
        noDecode: false,
        state: state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('2: Export variable2 without decoding', async () => {
      const response = await VariablesOps.exportVariable({
        variableId: variable2.id,
        noDecode: true,
        state: state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('3: Export variable3 (non-existent)', async () => {
      expect.assertions(2);
      try {
        await VariablesOps.exportVariable({
          variableId: variable3.id,
          noDecode: false,
          state: state,
        });
      } catch (e: any) {
        expect(e.name).toEqual('FrodoError');
        expect((e as FrodoError).getCombinedMessage()).toMatchSnapshot();
      }
    });
  });

  describe('readVariables()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.readVariables).toBeDefined();
    });

    test('1: Read all variables', async () => {
      const response = await VariablesOps.readVariables({
        noDecode: false,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Read all variables without decoding', async () => {
      const response = await VariablesOps.readVariables({
        noDecode: true,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('readVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.readVariable).toBeDefined();
    });

    test('1: Read variable1', async () => {
      const response = await VariablesOps.readVariable({
        variableId: variable1.id,
        noDecode: false,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Read variable2 without decoding', async () => {
      const response = await VariablesOps.readVariable({
        variableId: variable2.id,
        noDecode: true,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('3: Read variable3 (non-existent)', async () => {
      expect.assertions(2);
      try {
        await VariablesOps.readVariable({
          variableId: variable3.id,
          noDecode: false,
          state: state,
        });
      } catch (e: any) {
        expect(e.name).toEqual('FrodoError');
        expect((e as FrodoError).getCombinedMessage()).toMatchSnapshot();
      }
    });
  });

  describe('importVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.importVariable).toBeDefined();
    });

    test('1: Import variable4', async () => {
      const response = await VariablesOps.importVariable({
        variableId: variable4.id,
        importData: variable4Export,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Import variable5 (decoded)', async () => {
      const response = await VariablesOps.importVariable({
        variableId: variable5.id,
        importData: variable5Export,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('3: Import first variable6', async () => {
      const response = await VariablesOps.importVariable({
        variableId: undefined,
        importData: variable6Export,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('4: Import first variable7 (decoded)', async () => {
      const response = await VariablesOps.importVariable({
        variableId: undefined,
        importData: variable7Export,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('importVariables()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.importVariables).toBeDefined();
    });

    test('1: Import all variables', async () => {
      const response = await VariablesOps.importVariables({
        importData: variables89Export,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Import all variables (decoded)', async () => {
      const response = await VariablesOps.importVariables({
        importData: variables1011Export,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('createVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.createVariable).toBeDefined();
    });

    test('1: Create variable12 (pre-encoded)', async () => {
      const response = await VariablesOps.createVariable({
        variableId: variable12.id,
        value: encode(variable12.value),
        description: variable12.description,
        expressionType: variable12.expressionType as VariableExpressionType,
        noEncode: true,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Create variable13 (not encoded)', async () => {
      const response = await VariablesOps.createVariable({
        variableId: variable13.id,
        value: variable13.value,
        description: variable13.description,
        expressionType: variable13.expressionType as VariableExpressionType,
        noEncode: false,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('updateVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.updateVariable).toBeDefined();
    });

    test('1: Update existing variable14 (pre-encoded)', async () => {
      const response = await VariablesOps.updateVariable({
        variableId: variable14.id,
        value: encode(variable14.value),
        description: variable14.description,
        expressionType: variable14.expressionType as VariableExpressionType,
        noEncode: true,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Update existing variable15 (not encoded)', async () => {
      const response = await VariablesOps.updateVariable({
        variableId: variable15.id,
        value: variable15.value,
        description: variable15.description,
        expressionType: variable15.expressionType as VariableExpressionType,
        noEncode: false,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('3: Update/create non-existing variable16 (pre-encoded)', async () => {
      const response = await VariablesOps.updateVariable({
        variableId: variable16.id,
        value: encode(variable16.value),
        description: variable16.description,
        expressionType: variable16.expressionType as VariableExpressionType,
        noEncode: true,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('4: Update/create non-existing variable17 (not encoded)', async () => {
      const response = await VariablesOps.updateVariable({
        variableId: variable17.id,
        value: variable17.value,
        description: variable17.description,
        expressionType: variable17.expressionType as VariableExpressionType,
        noEncode: false,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('updateVariableDescription()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.updateVariable).toBeDefined();
    });

    test('1: Update variable18 description', async () => {
      const response = await VariablesOps.updateVariableDescription({
        variableId: variable18.id,
        description: variable18.description,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('deleteVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.deleteVariable).toBeDefined();
    });

    test('1: Delete variable19', async () => {
      const response = await VariablesOps.deleteVariable({
        variableId: variable19.id,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Delete variable3 (non-existent)', async () => {
      expect.assertions(2);
      try {
        await VariablesOps.deleteVariable({
          variableId: variable3.id,
          state: state,
        });
      } catch (e: any) {
        expect(e.name).toEqual('FrodoError');
        expect((e as FrodoError).getCombinedMessage()).toMatchSnapshot();
      }
    });
  });
});
