/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=volker-dev npm run test:record VariablesApi
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
 *        npm run test VariablesApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as VariablesApi from './VariablesApi';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { state } from '../../index';

autoSetupPolly();

describe('VariablesApi', () => {
  const var1 = {
    name: 'esv-frodo-test-variable1',
    value: 'Frodo Test Variable One Value',
    description: 'Frodo Test Variable One Description',
  };
  const var2 = {
    name: 'esv-frodo-test-variable2',
    value: 'Frodo Test Variable Two Value',
    description: 'Frodo Test Variable Two Description',
  };
  const var3 = {
    name: 'esv-frodo-test-variable3',
    value: 'Frodo Test Variable Three Value',
    description: 'Frodo Test Variable Three Description',
  };
  const var4 = {
    name: 'esv-frodo-test-variable4',
    value: 'Frodo Test Variable Four Value',
    description: 'Frodo Test Variable Four Description',
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup var1 - delete if exists, then create
      try {
        await VariablesApi.getVariable({ variableId: var1.name, state });
        await VariablesApi.deleteVariable({ variableId: var1.name, state });
      } catch (error) {
        // ignore
      } finally {
        await VariablesApi.putVariable({
          variableId: var1.name,
          value: var1.value,
          description: var1.description,
          state,
        });
      }
      // setup var2 - delete if exists, then create
      try {
        await VariablesApi.getVariable({ variableId: var2.name, state });
        await VariablesApi.deleteVariable({ variableId: var2.name, state });
      } catch (error) {
        // ignore
      } finally {
        await VariablesApi.putVariable({
          variableId: var2.name,
          value: var2.value,
          description: var2.description,
          state,
        });
      }
      // setup var3 - delete if exists, then create
      try {
        await VariablesApi.getVariable({ variableId: var3.name, state });
        await VariablesApi.deleteVariable({ variableId: var3.name, state });
      } catch (error) {
        // ignore
      } finally {
        await VariablesApi.putVariable({
          variableId: var3.name,
          value: var3.value,
          description: var3.description,
          state,
        });
      }
      // setup var4 - delete if exists
      try {
        await VariablesApi.getVariable({ variableId: var4.name, state });
        await VariablesApi.deleteVariable({ variableId: var4.name, state });
      } catch (error) {
        // ignore
      }
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      try {
        await VariablesApi.getVariable({ variableId: var1.name, state });
        await VariablesApi.deleteVariable({ variableId: var1.name, state });
      } catch (error) {
        // ignore
      }
      try {
        await VariablesApi.getVariable({ variableId: var2.name, state });
        await VariablesApi.deleteVariable({ variableId: var2.name, state });
      } catch (error) {
        // ignore
      }
      try {
        await VariablesApi.getVariable({ variableId: var3.name, state });
        await VariablesApi.deleteVariable({ variableId: var3.name, state });
      } catch (error) {
        // ignore
      }
      try {
        await VariablesApi.getVariable({ variableId: var4.name, state });
        await VariablesApi.deleteVariable({ variableId: var4.name, state });
      } catch (error) {
        // ignore
      }
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

    test(`2: Create new variable: ${var4.name} - success`, async () => {
      const response = await VariablesApi.putVariable({
        variableId: var4.name,
        value: var4.value,
        description: var4.description,
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
