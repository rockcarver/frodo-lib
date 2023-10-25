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
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record SecretsOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update SecretsOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only SecretsOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */

import { autoSetupPolly } from "../../utils/AutoSetupPolly";
import { state } from "../../index";
import * as SecretsOps from './SecretsOps';
import axios, { AxiosError } from "axios";

autoSetupPolly();

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
    await SecretsOps.deleteSecret({ secretId: secret.id, state })
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
        state: state
      });
    }
  }
}

describe('SecretsOps', () => {
  const secret1 = {
    id: 'esv-frodo-test-secret-1',
    value: 'value1',
    description: 'description1',
    encoding: 'generic',
    useInPlaceholders: true
  }
  const secret2 = {
    id: 'esv-frodo-test-secret-2',
    value: 'value2',
    description: 'description2',
    encoding: 'generic',
    useInPlaceholders: false
  }
  const secret3 = {
    id: 'esv-frodo-test-secret-3',
    value: 'value3',
    description: 'description3',
    encoding: 'generic',
    useInPlaceholders: false
  }
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageSecret(secret1);
      await stageSecret(secret2);
      await stageSecret(secret3, false);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageSecret(secret1, false);
      await stageSecret(secret2, false);
      await stageSecret(secret3, false);
    }
  });

  describe('createSecretsExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsOps.createSecretsExportTemplate).toBeDefined();
    });

    test('1: Return template with meta data', async () => {
      expect(SecretsOps.createSecretsExportTemplate({ state: state })).toStrictEqual({
        meta: expect.any(Object),
        secrets: {}
      });
    });
  });

  describe('exportSecrets()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsOps.exportSecrets).toBeDefined();
    });

    test('1: Export all secrets', async () => {
      const response = await SecretsOps.exportSecrets({ state: state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('exportSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsOps.exportSecret).toBeDefined();
    });

    test('1: Export secret1', async () => {
      const response = await SecretsOps.exportSecret({ secretId: secret1.id, state: state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('2: Export secret2', async () => {
      const response = await SecretsOps.exportSecret({ secretId: secret2.id, state: state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('3: Export secret3 (non-existent)', async () => {
      let errorCaught = false;
      try {
        await SecretsOps.exportSecret({ secretId: secret3.id, state: state })
      } catch (e: any) {
        errorCaught = true;
        expect(axios.isAxiosError(e)).toBeTruthy();
        expect((e as AxiosError).response.status).toBe(404)
      }
      expect(errorCaught).toBeTruthy();
    });
  });
});
