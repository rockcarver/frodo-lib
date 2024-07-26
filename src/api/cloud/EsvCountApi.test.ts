/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record EsvCountApi
 *
 *    The above command assumes that you have a connection profile for
 *    'volker-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update EsvCountApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only EsvCountApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */

import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { state } from '../../index';
import * as EsvCountApi from './EsvCountApi';
import * as SecretsOps from '../../ops/cloud/SecretsOps';
import * as VariablesOps from '../../ops/cloud/VariablesOps';
import { VariableExpressionType } from './VariablesApi';

const ctx = autoSetupPolly();

async function stageSecret(
  secret: {
    id: string;
    value: string;
    description: string;
    encoding: string;
    useInPlaceholders: boolean;
  },
  create = true
) {
  // delete if exists, then create
  try {
    await SecretsOps.deleteSecret({ secretId: secret.id, state });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await SecretsOps.createSecret({
        secretId: secret.id,
        value: secret.value,
        description: secret.description,
        encoding: secret.encoding,
        useInPlaceholders: secret.useInPlaceholders,
        state: state,
      });
    }
  }
}

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

describe(' EsvCountApi', () => {
  const secret1 = {
    id: 'esv-frodo-test-secret-1',
    value: 'value1',
    description: 'description1',
    encoding: 'generic',
    useInPlaceholders: true,
  };
  const secret2 = {
    id: 'esv-frodo-test-secret-2',
    value: 'value2',
    description: 'description2',
    encoding: 'generic',
    useInPlaceholders: false,
  };
  const secret3 = {
    id: 'esv-frodo-test-secret-3',
    value: 'value3',
    description: 'description3',
    encoding: 'generic',
    useInPlaceholders: false,
  };
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
      await stageSecret(secret1);
      await stageSecret(secret2);
      await stageSecret(secret3);
      await stageVariable(variable1);
      await stageVariable(variable2);
      await stageVariable(variable3);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageSecret(secret1, false);
      await stageSecret(secret2, false);
      await stageSecret(secret3, false);
      await stageVariable(variable1, false);
      await stageVariable(variable2, false);
      await stageVariable(variable3, false);
    }
  });

  describe('getEsvCount()', () => {
    test('0: Method is implemented', async () => {
      expect(EsvCountApi.getEsvCount).toBeDefined();
    });

    test('1: Get ESV count', async () => {
      const response = await EsvCountApi.getEsvCount({
        state: state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
