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
import { jest } from '@jest/globals';
import { VariablesRaw } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

// Increase timeout for this test as pipeline keeps failing with error:
// Timeout - Async callback was not invoked within the 5000 ms timeout specified by jest.setTimeout.
jest.setTimeout(30000);

autoSetupPolly();

describe('VariablesApi', () => {
  const var1 = 'esv-frodo-test-variable1';
  const var2 = 'esv-frodo-test-variable2';
  const var3 = 'esv-frodo-test-variable3';
  const var4 = 'esv-frodo-test-variable4';
  // in recording mode, setup test data
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup esv-frodoTestVariable1 - delete if exists, then create
      try {
        await VariablesRaw.getVariable(var1);
        await VariablesRaw.deleteVariable(var1);
      } catch (error) {
        // ignore
      } finally {
        await VariablesRaw.putVariable(
          var1,
          'Frodo Test Variable One Value',
          'Frodo Test Variable One Description'
        );
      }
      // setup esv-frodoTestVariable2 - delete if exists, then create
      try {
        await VariablesRaw.getVariable(var2);
        await VariablesRaw.deleteVariable(var2);
      } catch (error) {
        // ignore
      } finally {
        await VariablesRaw.putVariable(
          var2,
          'Frodo Test Variable Two Value',
          'Frodo Test Variable Two Description'
        );
      }
      // setup esv-frodoTestVariable3 - delete if exists, then create
      try {
        await VariablesRaw.getVariable(var3);
        await VariablesRaw.deleteVariable(var3);
      } catch (error) {
        // ignore
      } finally {
        await VariablesRaw.putVariable(
          var3,
          'Frodo Test Variable Three Value',
          'Frodo Test Variable Three Description'
        );
      }
      // setup esv-frodoTestVariable4 - delete if exists
      try {
        await VariablesRaw.getVariable(var4);
        await VariablesRaw.deleteVariable(var4);
      } catch (error) {
        // ignore
      }
    }
  });

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

    test(`1: Get existing variable: ${var1}`, async () => {
      const response = await VariablesRaw.getVariable(var1);
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

    test(`2: Create new variable: ${var4} - success`, async () => {
      const response = await VariablesRaw.putVariable(
        var4,
        'Frodo Test Variable Four Value',
        'Frodo Test Variable Four Description'
      );
      expect(response).toMatchSnapshot();
    });
  });

  describe('setVariableDescription()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesRaw.setVariableDescription).toBeDefined();
    });

    test(`1: Set existing variable's description: ${var2} - success`, async () => {
      const response = await VariablesRaw.setVariableDescription(
        var2,
        'Updated Frodo Test Variable Two Description'
      );
      expect(response).toMatchSnapshot();
    });

    test("2: Set non-existing variable's description: esv-does-not-exist - error", async () => {
      try {
        await VariablesRaw.setVariableDescription(
          'esv-does-not-exist',
          'Updated Frodo Test Variable Description'
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

    test(`1: Delete existing variable: ${var3} - success`, async () => {
      const response = await VariablesRaw.deleteVariable(var3);
      expect(response).toMatchSnapshot();
    });

    test('2: Delete non-existing variable: esv-does-not-exist - error', async () => {
      try {
        await VariablesRaw.deleteVariable('esv-does-not-exist');
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });
});
