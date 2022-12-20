import { VariablesRaw } from '../index';
import autoSetupPolly from '../utils/AutoSetupPolly';

const pollyContext = autoSetupPolly();

describe('VariablesApi', () => {
  describe('getVariables()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesRaw.getVariables).toBeDefined();
    });

    test('1: Get all variables - success', async () => {
      const response = await VariablesRaw.getVariables();
      expect(response).toMatchSnapshot();
    });

    // test('2: Get all variables - error', async () => {
    //   try {
    //     await VariablesRaw.getVariables();
    //   } catch (error) {
    //     expect(error.response.data).toMatchSnapshot();
    //   }
    // });
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

    // test('putVariable() 2: Create variable: esv-volkerstestvariable2 - error', async () => {
    //   try {
    //     await VariablesRaw.putVariable(
    //       'esv-volkerstestvariable2',
    //       "Volker's Test Variable Value",
    //       "Volker's Test Variable Description"
    //     );
    //   } catch (error) {
    //     expect(error.response.data).toMatchSnapshot();
    //   }
    // });
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
