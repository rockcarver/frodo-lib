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

import { state } from '../../index';
import * as VariablesOps from './VariablesOps';
import { VariableExpressionType } from '../../api/cloud/VariablesApi';
import { FrodoError } from '../FrodoError';
import { encode } from '../../utils/Base64Utils';
import * as TestData from '../../test/setup/VariablesSetup'

describe('VariablesOps', () => {

  TestData.setup();

  describe('createVariablesExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(VariablesOps.createVariablesExportTemplate).toBeDefined();
    });

    test('1: Return template with meta data', async () => {
      expect(
        VariablesOps.createVariablesExportTemplate({ state: state })
      ).toStrictEqual({
        meta: expect.any(Object),
        variable: {},
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
        variableId: TestData.variable1._id,
        noDecode: false,
        state: state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('2: Export variable2 without decoding', async () => {
      const response = await VariablesOps.exportVariable({
        variableId: TestData.variable2._id,
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
          variableId: TestData.variable3._id,
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
        variableId: TestData.variable1._id,
        noDecode: false,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Read variable2 without decoding', async () => {
      const response = await VariablesOps.readVariable({
        variableId: TestData.variable2._id,
        noDecode: true,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('3: Read variable3 (non-existent)', async () => {
      expect.assertions(2);
      try {
        await VariablesOps.readVariable({
          variableId: TestData.variable3._id,
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
        variableId: TestData.variable4._id,
        importData: TestData.createTestVariableExport([TestData.variable4]),
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Import variable5 (decoded)', async () => {
      const response = await VariablesOps.importVariable({
        variableId: TestData.variable5._id,
        importData: TestData.createTestVariableExport([TestData.variable5]),
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('3: Import first variable6', async () => {
      const response = await VariablesOps.importVariable({
        variableId: undefined,
        importData: TestData.createTestVariableExport([TestData.variable6]),
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('4: Import first variable7 (decoded)', async () => {
      const response = await VariablesOps.importVariable({
        variableId: undefined,
        importData: TestData.createTestVariableExport([TestData.variable7]),
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
        importData: TestData.createTestVariableExport([TestData.variable8, TestData.variable9]),
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Import all variables (decoded)', async () => {
      const response = await VariablesOps.importVariables({
        importData: TestData.createTestVariableExport([TestData.variable10, TestData.variable11]),
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
        variableId: TestData.variable12._id,
        value: encode(TestData.variable12.value),
        description: TestData.variable12.description,
        expressionType: TestData.variable12.expressionType as VariableExpressionType,
        noEncode: true,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Create variable13 (not encoded)', async () => {
      const response = await VariablesOps.createVariable({
        variableId: TestData.variable13._id,
        value: TestData.variable13.value,
        description: TestData.variable13.description,
        expressionType: TestData.variable13.expressionType as VariableExpressionType,
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
        variableId: TestData.variable14._id,
        value: encode(TestData.variable14.value),
        description: TestData.variable14.description,
        expressionType: TestData.variable14.expressionType as VariableExpressionType,
        noEncode: true,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Update existing variable15 (not encoded)', async () => {
      const response = await VariablesOps.updateVariable({
        variableId: TestData.variable15._id,
        value: TestData.variable15.value,
        description: TestData.variable15.description,
        expressionType: TestData.variable15.expressionType as VariableExpressionType,
        noEncode: false,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('3: Update/create non-existing variable16 (pre-encoded)', async () => {
      const response = await VariablesOps.updateVariable({
        variableId: TestData.variable16._id,
        value: encode(TestData.variable16.value),
        description: TestData.variable16.description,
        expressionType: TestData.variable16.expressionType as VariableExpressionType,
        noEncode: true,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('4: Update/create non-existing variable17 (not encoded)', async () => {
      const response = await VariablesOps.updateVariable({
        variableId: TestData.variable17._id,
        value: TestData.variable17.value,
        description: TestData.variable17.description,
        expressionType: TestData.variable17.expressionType as VariableExpressionType,
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
        variableId: TestData.variable18._id,
        description: TestData.variable18.description,
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
        variableId: TestData.variable19._id,
        state: state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Delete variable3 (non-existent)', async () => {
      expect.assertions(2);
      try {
        await VariablesOps.deleteVariable({
          variableId: TestData.variable3._id,
          state: state,
        });
      } catch (e: any) {
        expect(e.name).toEqual('FrodoError');
        expect((e as FrodoError).getCombinedMessage()).toMatchSnapshot();
      }
    });
  });
});
