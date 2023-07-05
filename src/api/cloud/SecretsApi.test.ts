/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=volker-dev npm run test:record SecretsApi
 *
 *    The above command assumes that you have a connection profile for
 *    'volker-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update SecretsApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test SecretsApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as SecretsApi from './SecretsApi';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { state } from '../../index';

autoSetupPolly();

describe('SecretsApi', () => {
  const secret1 = {
    name: 'esv-frodo-test-secret1',
    value: 'Frodo Test Secret One Value',
    description: 'Frodo Test Secret One Description',
  };
  const secret2 = {
    name: 'esv-frodo-test-secret2',
    value: 'Frodo Test Secret Two Value',
    description: 'Frodo Test Secret Two Description',
  };
  const secret3 = {
    name: 'esv-frodo-test-secret3',
    value: 'Frodo Test Secret Three Value',
    description: 'Frodo Test Secret Three Description',
  };
  const secret4 = {
    name: 'esv-frodo-test-secret4',
    value: 'Frodo Test Secret Four Value',
    description: 'Frodo Test Secret Four Description',
    encoding: 'generic',
    placeholders: true,
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup secret1 - delete if exists, then create
      try {
        await SecretsApi.getSecret({ secretId: secret1.name, state });
        await SecretsApi.deleteSecret({ secretId: secret1.name, state });
      } catch (error) {
        // ignore
      } finally {
        await SecretsApi.putSecret({
          secretId: secret1.name,
          value: secret1.value,
          description: secret1.description,
          state,
        });
        await SecretsApi.createNewVersionOfSecret({
          secretId: secret1.name,
          value: secret1.value + ' Version 2',
          state,
        });
        await SecretsApi.createNewVersionOfSecret({
          secretId: secret1.name,
          value: secret1.value + ' Version 3',
          state,
        });
        await SecretsApi.setStatusOfVersionOfSecret({
          secretId: secret1.name,
          version: '2',
          status: 'DISABLED',
          state,
        });
      }
      // setup secret2 - delete if exists, then create
      try {
        await SecretsApi.getSecret({ secretId: secret2.name, state });
        await SecretsApi.deleteSecret({ secretId: secret2.name, state });
      } catch (error) {
        // ignore
      } finally {
        await SecretsApi.putSecret({
          secretId: secret2.name,
          value: secret2.value,
          description: secret2.description,
          state,
        });
        await SecretsApi.createNewVersionOfSecret({
          secretId: secret2.name,
          value: secret2.value + ' Version 2',
          state,
        });
        await SecretsApi.createNewVersionOfSecret({
          secretId: secret2.name,
          value: secret2.value + ' Version 3',
          state,
        });
      }
      // setup secret3 - delete if exists, then create
      try {
        await SecretsApi.getSecret({ secretId: secret3.name, state });
        await SecretsApi.deleteSecret({ secretId: secret3.name, state });
      } catch (error) {
        // ignore
      } finally {
        await SecretsApi.putSecret({
          secretId: secret3.name,
          value: secret3.value,
          description: secret3.description,
          state,
        });
      }
      // setup secret4 - delete if exists
      try {
        await SecretsApi.getSecret({ secretId: secret4.name, state });
        await SecretsApi.deleteSecret({ secretId: secret4.name, state });
      } catch (error) {
        // ignore
      }
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      try {
        await SecretsApi.getSecret({ secretId: secret1.name, state });
        await SecretsApi.deleteSecret({ secretId: secret1.name, state });
      } catch (error) {
        // ignore
      }
      try {
        await SecretsApi.getSecret({ secretId: secret2.name, state });
        await SecretsApi.deleteSecret({ secretId: secret2.name, state });
      } catch (error) {
        // ignore
      }
      try {
        await SecretsApi.getSecret({ secretId: secret3.name, state });
        await SecretsApi.deleteSecret({ secretId: secret3.name, state });
      } catch (error) {
        // ignore
      }
      try {
        await SecretsApi.getSecret({ secretId: secret4.name, state });
        await SecretsApi.deleteSecret({ secretId: secret4.name, state });
      } catch (error) {
        // ignore
      }
    }
  });

  describe('getSecrets()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsApi.getSecrets).toBeDefined();
    });

    test('1: Get all secrets - success', async () => {
      const response = await SecretsApi.getSecrets({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsApi.getSecret).toBeDefined();
    });

    test(`1: Get existing secret: ${secret1.name}`, async () => {
      const response = await SecretsApi.getSecret({
        secretId: secret1.name,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing secret: esv-does-not-exist', async () => {
      expect.assertions(1);
      try {
        await SecretsApi.getSecret({
          secretId: 'esv-does-not-exist',
          state,
        });
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('putSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsApi.putSecret).toBeDefined();
    });

    test(`1: Create secret: ${secret4.name} - success`, async () => {
      const response = await SecretsApi.putSecret({
        secretId: secret4.name,
        value: secret4.value,
        description: secret4.description,
        encoding: secret4.encoding,
        useInPlaceholders: secret4.placeholders,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('setSecretDescription()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsApi.setSecretDescription).toBeDefined();
    });

    test(`1: Set existing secret's description: ${secret2.name} - success`, async () => {
      const response = await SecretsApi.setSecretDescription({
        secretId: secret2.name,
        description: 'Updated Frodo Test Secret Two Description',
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('deleteSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsApi.deleteSecret).toBeDefined();
    });

    test(`1: Delete existing secret: ${secret3.name} - success`, async () => {
      const response = await SecretsApi.deleteSecret({
        secretId: secret3.name,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getSecretVersions()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsApi.getSecretVersions).toBeDefined();
    });

    test(`1: Get versions of existing secret: ${secret1.name}`, async () => {
      const response = await SecretsApi.getSecretVersions({
        secretId: secret1.name,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get versions of non-existing secret: esv-does-not-exist', async () => {
      expect.assertions(1);
      try {
        await SecretsApi.getSecretVersions({
          secretId: 'esv-does-not-exist',
          state,
        });
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('getVersionOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsApi.getVersionOfSecret).toBeDefined();
    });

    test(`1: Get version 2 of existing secret: ${secret1.name}`, async () => {
      const response = await SecretsApi.getVersionOfSecret({
        secretId: secret1.name,
        version: '2',
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get version 2 of non-existing secret: esv-does-not-exist', async () => {
      expect.assertions(1);
      try {
        await SecretsApi.getVersionOfSecret({
          secretId: 'esv-does-not-exist',
          version: '2',
          state,
        });
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('createNewVersionOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsApi.createNewVersionOfSecret).toBeDefined();
    });

    test(`1: Create new version of existing secret: ${secret2.name} - success`, async () => {
      const response = await SecretsApi.createNewVersionOfSecret({
        secretId: secret2.name,
        value: secret2.value + ' Version 4',
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Create new version of non-existing secret: esv-does-not-exist - error', async () => {
      expect.assertions(1);
      try {
        await SecretsApi.createNewVersionOfSecret({
          secretId: 'esv-does-not-exist',
          value: 'Frodo Non-Existing Test Secret Value Version 2',
          state,
        });
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('setStatusOfVersionOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsApi.setStatusOfVersionOfSecret).toBeDefined();
    });

    test(`1: Disable version 2 of existing secret: ${secret2.name} - success`, async () => {
      expect.assertions(1);
      const response = await SecretsApi.setStatusOfVersionOfSecret({
        secretId: secret2.name,
        version: '2',
        status: 'DISABLED',
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Disable version 2 of non-existing secret: esv-does-not-exist - error', async () => {
      expect.assertions(1);
      try {
        await SecretsApi.setStatusOfVersionOfSecret({
          secretId: 'esv-does-not-exist',
          version: '2',
          status: 'DISABLED',
          state,
        });
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('deleteVersionOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsApi.deleteVersionOfSecret).toBeDefined();
    });

    test(`1: Delete version 1 of secret: ${secret2.name} - success`, async () => {
      const response = await SecretsApi.deleteVersionOfSecret({
        secretId: secret2.name,
        version: '1',
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
