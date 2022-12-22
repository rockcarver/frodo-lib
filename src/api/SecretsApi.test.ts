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
import { SecretsRaw } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

autoSetupPolly();

describe('SecretsApi', () => {
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

    test('1: Get existing secret: esv-volkerstestsecret1', async () => {
      const response = await SecretsRaw.getSecret('esv-volkerstestsecret1');
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing secret: esv-does-not-exist', async () => {
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

    test('1: Create secret: esv-volkerstestsecret1 - success', async () => {
      const response = await SecretsRaw.putSecret(
        'esv-volkerstestsecret1',
        "Volker's Test Secret Value",
        "Volker's Test Secret Description",
        'generic',
        true
      );
      expect(response).toMatchSnapshot();
    });
  });

  describe('setSecretDescription()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.setSecretDescription).toBeDefined();
    });

    test('1: Set secret description: esv-volkerstestsecret1 - success', async () => {
      const response = await SecretsRaw.setSecretDescription(
        'esv-volkerstestsecret1',
        "Volker's Updated Test Secret Description"
      );
      expect(response).toMatchSnapshot();
    });
  });

  describe('deleteSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.deleteSecret).toBeDefined();
    });

    test('1: Delete secret: esv-volkerstestsecret1 - success', async () => {
      const response = await SecretsRaw.deleteSecret('esv-volkerstestsecret1');
      expect(response).toMatchSnapshot();
    });
  });

  describe('getSecretVersions()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.getSecretVersions).toBeDefined();
    });

    test('1: Get versions of existing secret: esv-volkerstestsecret1', async () => {
      const response = await SecretsRaw.getSecretVersions(
        'esv-volkerstestsecret1'
      );
      expect(response).toMatchSnapshot();
    });

    test('2: Get versions of non-existing secret: esv-does-not-exist', async () => {
      try {
        await SecretsRaw.getSecretVersions('esv-does-not-exist');
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('createNewVersionOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.createNewVersionOfSecret).toBeDefined();
    });

    test('1: Create new version of existing secret: esv-volkerstestsecret1 - success', async () => {
      const response = await SecretsRaw.createNewVersionOfSecret(
        'esv-volkerstestsecret1',
        "Volker's Test Secret Value"
      );
      expect(response).toMatchSnapshot();
    });

    test('2: Create new version of non-existing secret: esv-does-not-exist - error', async () => {
      try {
        await SecretsRaw.createNewVersionOfSecret(
          'esv-does-not-exist',
          "Volker's Test Secret Value"
        );
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('getVersionOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.getVersionOfSecret).toBeDefined();
    });

    test('1: Get version 2 of existing secret: esv-volkerstestsecret1', async () => {
      const response = await SecretsRaw.getVersionOfSecret(
        'esv-volkerstestsecret1',
        '2'
      );
      expect(response).toMatchSnapshot();
    });

    test('2: Get version 2 of non-existing secret: esv-does-not-exist', async () => {
      try {
        await SecretsRaw.getVersionOfSecret('esv-does-not-exist', '2');
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('setStatusOfVersionOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsRaw.setStatusOfVersionOfSecret).toBeDefined();
    });

    test('1: Disable version 2 of existing secret: esv-volkerstestsecret1 - success', async () => {
      const response = await SecretsRaw.setStatusOfVersionOfSecret(
        'esv-volkerstestsecret1',
        '2',
        SecretsRaw.VersionOfSecretStatus.DISABLED
      );
      expect(response).toMatchSnapshot();
    });

    test('2: Disable version 2 of non-existing secret: esv-does-not-exist - error', async () => {
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

    test('1: Delete version 2 of secret: esv-volkerstestsecret1 - success', async () => {
      const response = await SecretsRaw.deleteVersionOfSecret(
        'esv-volkerstestsecret1',
        '2'
      );
      expect(response).toMatchSnapshot();
    });
  });
});
