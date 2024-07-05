/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record VariablesApi
 *
 *    The above command assumes that you have a connection profile for
 *    'volker-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update VariablesApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only VariablesApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as VariablesApi from './VariablesApi';
import { autoSetupPolly, filterRecording } from '../../utils/AutoSetupPolly';
import { state } from '../../index';
import { encode } from '../../utils/Base64Utils';

const ctx = autoSetupPolly();

type TestVariable = {
  name: string;
  value: string;
  description: string;
  type: VariablesApi.VariableExpressionType;
};

async function stageVariable(variable: TestVariable, create = true) {
  // delete if exists, then create
  try {
    await VariablesApi.getVariable({
      variableId: variable.name,
      state,
    });
    await VariablesApi.deleteVariable({
      variableId: variable.name,
      state,
    });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      try {
        await VariablesApi.putVariable({
          variableId: variable.name,
          valueBase64: encode(variable.value),
          description: variable.description,
          expressionType: variable.type,
          state,
        });
      } catch (error) {
        // ignore
      }
    }
  }
}

describe('VariablesApi', () => {
  const var1: TestVariable = {
    name: 'esv-frodo-test-variable1',
    value: 'Frodo Test Variable One Value',
    description: 'Frodo Test Variable One Description',
    type: 'string',
  };
  const var2: TestVariable = {
    name: 'esv-frodo-test-variable2',
    value: 'Frodo Test Variable Two Value',
    description: 'Frodo Test Variable Two Description',
    type: 'string',
  };
  const var3: TestVariable = {
    name: 'esv-frodo-test-variable3',
    value: 'Frodo Test Variable Three Value',
    description: 'Frodo Test Variable Three Description',
    type: 'string',
  };
  const var4: TestVariable = {
    name: 'esv-frodo-test-variable4',
    value: 'Frodo Test Variable Four Value',
    description: 'Frodo Test Variable Four Description',
    type: 'string',
  };
  const var5: TestVariable = {
    name: 'esv-frodo-test-variable5',
    value: 'Frodo Test Variable Five Value',
    description: 'Frodo Test Variable Five (string) Description',
    type: 'string',
  };
  const var6: TestVariable = {
    name: 'esv-frodo-test-variable6',
    value: '["one","two","three","four","five",6,7,8,9,10]',
    description: 'Frodo Test Variable Six (array) Description',
    type: 'array',
  };
  // const var7: TestVariable = {
  //   name: 'esv-frodo-test-variable7',
  //   value: '',
  //   description: 'Frodo Test Variable Seven (base64encodedinlined) Description',
  //   type: 'base64encodedinlined',
  // };
  const var8: TestVariable = {
    name: 'esv-frodo-test-variable8',
    value: 'false',
    description: 'Frodo Test Variable Eight (bool) Description',
    type: 'bool',
  };
  const var9: TestVariable = {
    name: 'esv-frodo-test-variable9',
    value: '12345',
    description: 'Frodo Test Variable Nine (int) Description',
    type: 'int',
  };
  const var10: TestVariable = {
    name: 'esv-frodo-test-variable10',
    value: '{"k1":"v1","k2":"v2","k3":"v3"}',
    description: 'Frodo Test Variable Ten (keyvaluelist) Description',
    type: 'keyvaluelist',
  };
  const var11: TestVariable = {
    name: 'esv-frodo-test-variable11',
    value: 'one,two,three,four,five,6,7,8,9,10',
    description: 'Frodo Test Variable Eleven (list) Description',
    type: 'list',
  };
  const var12: TestVariable = {
    name: 'esv-frodo-test-variable12',
    value: '123.45',
    description: 'Frodo Test Variable Twelve (number) Description',
    type: 'number',
  };
  const var13: TestVariable = {
    name: 'esv-frodo-test-variable13',
    value: '{ "a": [{ "b": { "c": 3 } }] }',
    description: 'Frodo Test Variable Thirteen (object) Description',
    type: 'object',
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageVariable(var1, true);
      await stageVariable(var2, true);
      await stageVariable(var3, true);
      await stageVariable(var4, false);
      await stageVariable(var5, false);
      await stageVariable(var6, false);
      // await stageVariable(var7, false);
      await stageVariable(var8, false);
      await stageVariable(var9, false);
      await stageVariable(var10, false);
      await stageVariable(var11, false);
      await stageVariable(var12, false);
      await stageVariable(var13, false);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageVariable(var1, false);
      await stageVariable(var2, false);
      await stageVariable(var3, false);
      await stageVariable(var4, false);
      await stageVariable(var5, false);
      await stageVariable(var6, false);
      // await stageVariable(var7, false);
      await stageVariable(var8, false);
      await stageVariable(var9, false);
      await stageVariable(var10, false);
      await stageVariable(var11, false);
      await stageVariable(var12, false);
      await stageVariable(var13, false);
    }
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('getVariables()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesApi.getVariables).toBeDefined();
    });

    test('1: Get all variables - success', async () => {
      const response = await VariablesApi.getVariables({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesApi.getVariable).toBeDefined();
    });

    test(`1: Get existing variable: ${var1.name}`, async () => {
      const response = await VariablesApi.getVariable({
        variableId: var1.name,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing variable: esv-does-not-exist', async () => {
      expect.assertions(1);
      try {
        await VariablesApi.getVariable({
          variableId: 'esv-does-not-exist',
          state,
        });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('putVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesApi.putVariable).toBeDefined();
    });

    test(`1: Create new variable with default type (string): ${var4.name} - success`, async () => {
      const response = await VariablesApi.putVariable({
        variableId: var4.name,
        valueBase64: encode(var4.value),
        description: var4.description,
        expressionType: var4.type,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Create new string variable (explicit type): ${var5.name} - success`, async () => {
      const response = await VariablesApi.putVariable({
        variableId: var5.name,
        valueBase64: encode(var5.value),
        description: var5.description,
        expressionType: var5.type,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`3: Create new array variable: ${var6.name} - success`, async () => {
      const response = await VariablesApi.putVariable({
        variableId: var6.name,
        valueBase64: encode(var6.value),
        description: var6.description,
        expressionType: var6.type,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    // test(`4: Create new base64encodedinlined variable: ${var7.name} - success`, async () => {
    //   const response = await VariablesApi.putVariable({
    //     variableId: var7.name,
    //     value: var7.value,
    //     description: var7.description,
    //     expressionType: var7.type,
    //     state,
    //   });
    //   expect(response).toMatchSnapshot();
    // });

    test(`5: Create new bool variable: ${var8.name} - success`, async () => {
      const response = await VariablesApi.putVariable({
        variableId: var8.name,
        valueBase64: encode(var8.value),
        description: var8.description,
        expressionType: var8.type,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`6: Create new int variable: ${var9.name} - success`, async () => {
      const response = await VariablesApi.putVariable({
        variableId: var9.name,
        valueBase64: encode(var9.value),
        description: var9.description,
        expressionType: var9.type,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`7: Create new keyvaluelist variable: ${var10.name} - success`, async () => {
      const response = await VariablesApi.putVariable({
        variableId: var10.name,
        valueBase64: encode(var10.value),
        description: var10.description,
        expressionType: var10.type,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`8: Create new list variable: ${var11.name} - success`, async () => {
      const response = await VariablesApi.putVariable({
        variableId: var11.name,
        valueBase64: encode(var11.value),
        description: var11.description,
        expressionType: var11.type,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`9: Create new number variable: ${var12.name} - success`, async () => {
      const response = await VariablesApi.putVariable({
        variableId: var12.name,
        valueBase64: encode(var12.value),
        description: var12.description,
        expressionType: var12.type,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`10: Create new object variable: ${var13.name} - success`, async () => {
      const response = await VariablesApi.putVariable({
        variableId: var13.name,
        valueBase64: encode(var13.value),
        description: var13.description,
        expressionType: var13.type,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('setVariableDescription()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesApi.setVariableDescription).toBeDefined();
    });

    test(`1: Set existing variable's description: ${var2.name} - success`, async () => {
      const response = await VariablesApi.setVariableDescription({
        variableId: var2.name,
        description: 'Updated Frodo Test Variable Two Description',
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test("2: Set non-existing variable's description: esv-does-not-exist - error", async () => {
      expect.assertions(1);
      try {
        await VariablesApi.setVariableDescription({
          variableId: 'esv-does-not-exist',
          description: 'Updated Frodo Test Variable Description',
          state,
        });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('deleteVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesApi.deleteVariable).toBeDefined();
    });

    test(`1: Delete existing variable: ${var3.name} - success`, async () => {
      const response = await VariablesApi.deleteVariable({
        variableId: var3.name,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Delete non-existing variable: esv-does-not-exist - error', async () => {
      expect.assertions(1);
      try {
        await VariablesApi.deleteVariable({
          variableId: 'esv-does-not-exist',
          state,
        });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });
});
