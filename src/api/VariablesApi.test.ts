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
import { VariablesRaw } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

autoSetupPolly();

describe('VariablesApi', () => {
  describe('getVariables()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesRaw.getVariables).toBeDefined();
    });

    test('1: Get all variables - success', async () => {
      const response = await VariablesRaw.getVariables();
      expect(response).toMatchSnapshot();
    });
  });

  describe('getVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesRaw.getVariable).toBeDefined();
    });

    test('1: Get existing variable: esv-volkerstestvariable1', async () => {
      const response = await VariablesRaw.getVariable(
        'esv-volkerstestvariable1'
      );
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing variable: esv-does-not-exist', async () => {
      try {
        await VariablesRaw.getVariable('esv-does-not-exist');
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('putVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesRaw.putVariable).toBeDefined();
    });

    test('1: Create variable: esv-volkerstestvariable2 - success', async () => {
      const response = await VariablesRaw.putVariable(
        'esv-volkerstestvariable2',
        "Volker's Test Variable Value",
        "Volker's Test Variable Description"
      );
      expect(response).toMatchSnapshot();
    });
  });

  describe('setVariableDescription()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesRaw.setVariableDescription).toBeDefined();
    });

    test('1: Set variable description: esv-volkerstestvariable2 - success', async () => {
      const response = await VariablesRaw.setVariableDescription(
        'esv-volkerstestvariable2',
        "Volker's Updated Test Secret Description"
      );
      expect(response).toMatchSnapshot();
    });

    test('2: Set variable description: esv-volkerstestvariable3 - error', async () => {
      try {
        await VariablesRaw.setVariableDescription(
          'esv-volkerstestvariable3',
          "Volker's Updated Test Secret Description"
        );
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('deleteVariable()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesRaw.deleteVariable).toBeDefined();
    });

    test('1: Delete variable: esv-volkerstestvariable2 - success', async () => {
      const response = await VariablesRaw.deleteVariable(
        'esv-volkerstestvariable2'
      );
      expect(response).toMatchSnapshot();
    });

    test('2: Delete variable: esv-volkerstestvariable3 - error', async () => {
      try {
        await VariablesRaw.deleteVariable('esv-volkerstestvariable3');
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });
});
