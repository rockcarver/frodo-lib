import { VariablesRaw } from '../index';
import autoSetupPolly from '../utils/AutoSetupPolly';

const pollyContext = autoSetupPolly();

describe('VariablesApi', () => {
  describe('VariablesApi - getVariables()', () => {
    test('getVariables() 0: Method is implemented', async () => {
      expect(VariablesRaw.getVariables).toBeDefined();
    });

    test('getVariables() 1: Get all variables - success', async () => {
      const response = await VariablesRaw.getVariables();
      expect(response).toMatchSnapshot();
    });

    test('getVariables() 2: Get all variables - error', async () => {
      try {
        await VariablesRaw.getVariables();
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('VariablesApi - getVariable()', () => {
    test('getVariable() 0: Method is implemented', async () => {
      expect(VariablesRaw.getVariable).toBeDefined();
    });

    test('getVariable() 1: Get existing variable: esv-volkerstestvariable1', async () => {
      const response = await VariablesRaw.getVariable(
        'esv-volkerstestvariable1'
      );
      expect(response).toMatchSnapshot();
    });

    test('getVariable() 2: Get non-existing variable: esv-does-not-exist', async () => {
      try {
        await VariablesRaw.getVariable('esv-does-not-exist');
      } catch (error) {
        // expect(error.response.status).toBe(404);
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('VariablesApi - putVariable()', () => {
    test('putVariable() 0: Method is implemented', async () => {
      expect(VariablesRaw.putVariable).toBeDefined();
    });

    test('putVariable() 1: Create variable: esv-volkerstestvariable2 - success', async () => {
      const response = await VariablesRaw.putVariable(
        'esv-volkerstestvariable2',
        "Volker's Test Variable Value",
        "Volker's Test Variable Description"
      );
      expect(response).toMatchSnapshot();
    });

    test('putVariable() 2: Create variable: esv-volkerstestvariable2 - error', async () => {
      try {
        await VariablesRaw.putVariable(
          'esv-volkerstestvariable2',
          "Volker's Test Variable Value",
          "Volker's Test Variable Description"
        );
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('VariablesApi - setVariableDescription()', () => {
    test('setVariableDescription() 0: Method is implemented', async () => {
      expect(VariablesRaw.setVariableDescription).toBeDefined();
    });

    test('setVariableDescription() 1: Set variable description: esv-volkerstestvariable2 - success', async () => {
      const response = await VariablesRaw.setVariableDescription(
        'esv-volkerstestvariable2',
        "Volker's Updated Test Secret Description"
      );
      expect(response).toMatchSnapshot();
    });

    test('setVariableDescription() 2: Set variable description: esv-volkerstestvariable3 - error', async () => {
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

  describe('VariablesApi - deleteVariable()', () => {
    test('deleteVariable() 0: Method is implemented', async () => {
      expect(VariablesRaw.deleteVariable).toBeDefined();
    });

    test('deleteVariable() 1: Delete variable: esv-volkerstestvariable2 - success', async () => {
      const response = await VariablesRaw.deleteVariable(
        'esv-volkerstestvariable2'
      );
      expect(response).toMatchSnapshot();
    });

    test('deleteVariable() 2: Delete variable: esv-volkerstestvariable3 - error', async () => {
      try {
        await VariablesRaw.deleteVariable('esv-volkerstestvariable3');
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });
});
