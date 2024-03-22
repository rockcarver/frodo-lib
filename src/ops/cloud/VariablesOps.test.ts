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

import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { state } from '../../index';
import * as VariablesOps from './VariablesOps';
import axios, { AxiosError } from 'axios';
import { VariableExpressionType } from '../../api/cloud/VariablesApi';
import { FrodoError } from '../../FrodoError';

autoSetupPolly();

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
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageVariable(variable1);
      await stageVariable(variable2);
      await stageVariable(variable3, false);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageVariable(variable1, false);
      await stageVariable(variable2, false);
      await stageVariable(variable3, false);
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
      expect.assertions(2)
      let errorCaught = false;
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
});
