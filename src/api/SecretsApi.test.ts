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
import { jest } from '@jest/globals';
import { SecretsRaw } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

// Increase timeout for this test as pipeline keeps failing with error:
// Timeout - Async callback was not invoked within the 5000 ms timeout specified by jest.setTimeout.
jest.setTimeout(30000);

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
        await SecretsRaw.getSecret(secret1.name);
        await SecretsRaw.deleteSecret(secret1.name);
      } catch (error) {
        // ignore
      } finally {
        await SecretsRaw.putSecret(
          secret1.name,
          secret1.value,
          secret1.description
        );
        await SecretsRaw.createNewVersionOfSecret(
          secret1.name,
          secret1.value + ' Version 2'
        );
        await SecretsRaw.createNewVersionOfSecret(
          secret1.name,
          secret1.value + ' Version 3'
        );
        await SecretsRaw.setStatusOfVersionOfSecret(
          secret1.name,
          '2',
          SecretsRaw.VersionOfSecretStatus.DISABLED
        );
      }
      // setup secret2 - delete if exists, then create
      try {
        await SecretsRaw.getSecret(secret2.name);
        await SecretsRaw.deleteSecret(secret2.name);
      } catch (error) {
        // ignore
      } finally {
        await SecretsRaw.putSecret(
          secret2.name,
          secret2.value,
          secret2.description
        );
        await SecretsRaw.createNewVersionOfSecret(
          secret2.name,
          secret2.value + ' Version 2'
        );
        await SecretsRaw.createNewVersionOfSecret(
          secret2.name,
          secret2.value + ' Version 3'
        );
      }
      // setup secret3 - delete if exists, then create
      try {
        await SecretsRaw.getSecret(secret3.name);
        await SecretsRaw.deleteSecret(secret3.name);
      } catch (error) {
        // ignore
      } finally {
        await SecretsRaw.putSecret(
          secret3.name,
          secret3.value,
          secret3.description
        );
      }
      // setup secret4 - delete if exists
      try {
        await SecretsRaw.getSecret(secret4.name);
        await SecretsRaw.deleteSecret(secret4.name);
      } catch (error) {
        // ignore
      }
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup secret1 - delete if exists, then create
      try {
        await SecretsRaw.getSecret(secret1.name);
        await SecretsRaw.deleteSecret(secret1.name);
      } catch (error) {
        // ignore
      }
      // setup secret2 - delete if exists, then create
      try {
        await SecretsRaw.getSecret(secret2.name);
        await SecretsRaw.deleteSecret(secret2.name);
      } catch (error) {
        // ignore
      }
      // setup secret3 - delete if exists, then create
      try {
        await SecretsRaw.getSecret(secret3.name);
        await SecretsRaw.deleteSecret(secret3.name);
      } catch (error) {
        // ignore
      }
      // setup secret4 - delete if exists
      try {
        await SecretsRaw.getSecret(secret4.name);
        await SecretsRaw.deleteSecret(secret4.name);
      } catch (error) {
        // ignore
      }
    }
  });

  describe('getSecrets()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.getSecrets).toBeDefined();
    });

    test('1: Get all secrets - success', async () => {
      const response = await SecretsRaw.getSecrets();
      expect(response).toMatchSnapshot();
    });
  });

  describe('getSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.getSecret).toBeDefined();
    });

    test(`1: Get existing secret: ${secret1.name}`, async () => {
      const response = await SecretsRaw.getSecret(secret1.name);
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing secret: esv-does-not-exist', async () => {
      expect.assertions(1);
      try {
        await SecretsRaw.getSecret('esv-does-not-exist');
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('putSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.putSecret).toBeDefined();
    });

    test(`1: Create secret: ${secret4.name} - success`, async () => {
      const response = await SecretsRaw.putSecret(
        secret4.name,
        secret4.value,
        secret4.description,
        secret4.encoding,
        secret4.placeholders
      );
      expect(response).toMatchSnapshot();
    });
  });

  describe('setSecretDescription()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.setSecretDescription).toBeDefined();
    });

    test(`1: Set existing secret's description: ${secret2.name} - success`, async () => {
      const response = await SecretsRaw.setSecretDescription(
        secret2.name,
        'Updated Frodo Test Secret Two Description'
      );
      expect(response).toMatchSnapshot();
    });
  });

  describe('deleteSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.deleteSecret).toBeDefined();
    });

    test(`1: Delete existing secret: ${secret3.name} - success`, async () => {
      const response = await SecretsRaw.deleteSecret(secret3.name);
      expect(response).toMatchSnapshot();
    });
  });

  describe('getSecretVersions()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.getSecretVersions).toBeDefined();
    });

    test(`1: Get versions of existing secret: ${secret1.name}`, async () => {
      const response = await SecretsRaw.getSecretVersions(secret1.name);
      expect(response).toMatchSnapshot();
    });

    test('2: Get versions of non-existing secret: esv-does-not-exist', async () => {
      expect.assertions(1);
      try {
        await SecretsRaw.getSecretVersions('esv-does-not-exist');
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('getVersionOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.getVersionOfSecret).toBeDefined();
    });

    test(`1: Get version 2 of existing secret: ${secret1.name}`, async () => {
      const response = await SecretsRaw.getVersionOfSecret(secret1.name, '2');
      expect(response).toMatchSnapshot();
    });

    test('2: Get version 2 of non-existing secret: esv-does-not-exist', async () => {
      expect.assertions(1);
      try {
        await SecretsRaw.getVersionOfSecret('esv-does-not-exist', '2');
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('createNewVersionOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.createNewVersionOfSecret).toBeDefined();
    });

    test(`1: Create new version of existing secret: ${secret2.name} - success`, async () => {
      const response = await SecretsRaw.createNewVersionOfSecret(
        secret2.name,
        secret2.value + ' Version 4'
      );
      expect(response).toMatchSnapshot();
    });

    test('2: Create new version of non-existing secret: esv-does-not-exist - error', async () => {
      expect.assertions(1);
      try {
        await SecretsRaw.createNewVersionOfSecret(
          'esv-does-not-exist',
          'Frodo Non-Existing Test Secret Value Version 2'
        );
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('setStatusOfVersionOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.setStatusOfVersionOfSecret).toBeDefined();
    });

    test(`1: Disable version 2 of existing secret: ${secret2.name} - success`, async () => {
      expect.assertions(1);
      const response = await SecretsRaw.setStatusOfVersionOfSecret(
        secret2.name,
        '2',
        SecretsRaw.VersionOfSecretStatus.DISABLED
      );
      expect(response).toMatchSnapshot();
    });

    test('2: Disable version 2 of non-existing secret: esv-does-not-exist - error', async () => {
      expect.assertions(1);
      try {
        await SecretsRaw.setStatusOfVersionOfSecret(
          'esv-does-not-exist',
          '2',
          SecretsRaw.VersionOfSecretStatus.DISABLED
        );
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('deleteVersionOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.deleteVersionOfSecret).toBeDefined();
    });

    test(`1: Delete version 1 of secret: ${secret2.name} - success`, async () => {
      const response = await SecretsRaw.deleteVersionOfSecret(
        secret2.name,
        '1'
      );
      expect(response).toMatchSnapshot();
    });
  });
});
