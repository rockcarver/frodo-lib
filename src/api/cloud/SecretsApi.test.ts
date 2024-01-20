/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record SecretsApi
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
 *        npm run test:only SecretsApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as SecretsApi from './SecretsApi';
import { autoSetupPolly, filterRecording } from '../../utils/AutoSetupPolly';
import { state } from '../../index';

const ctx = autoSetupPolly();

describe('SecretsApi', () => {
  const secret1 = {
    name: 'esv-frodo-test-secret1',
    value: 'RnJvZG8gVGVzdCBTZWNyZXQgT25lIFZhbHVl', // base64 encoded 'Frodo Test Secret One Value'
    valueV2: 'RnJvZG8gVGVzdCBTZWNyZXQgT25lIFZhbHVlIFZlcnNpb24gMg==', // base64 'Frodo Test Secret One Value Version 2'
    valueV3: 'RnJvZG8gVGVzdCBTZWNyZXQgT25lIFZhbHVlIFZlcnNpb24gMw==', // base64 'Frodo Test Secret One Value Version 3'
    description: 'Frodo Test Secret One Description',
  };
  const secret2 = {
    name: 'esv-frodo-test-secret2',
    value: 'RnJvZG8gVGVzdCBTZWNyZXQgVHdvIFZhbHVl', // base64 encoded 'Frodo Test Secret Two Value'
    valueV2: 'RnJvZG8gVGVzdCBTZWNyZXQgVHdvIFZhbHVlIFZlcnNpb24gMg==', // base64 'Frodo Test Secret Two Value Version 2'
    valueV3: 'RnJvZG8gVGVzdCBTZWNyZXQgVHdvIFZhbHVlIFZlcnNpb24gMw==', // base64 'Frodo Test Secret Two Value Version 3'
    valueV4: 'RnJvZG8gVGVzdCBTZWNyZXQgVHdvIFZhbHVlIFZlcnNpb24gNA==', // base64 encoded 'Frodo Test Secret Two Value Version 4'
    description: 'Frodo Test Secret Two Description',
  };
  const secret3 = {
    name: 'esv-frodo-test-secret3',
    value: 'RnJvZG8gVGVzdCBTZWNyZXQgVGhyZWUgVmFsdWU=', // base64 encoded 'Frodo Test Secret Three Value'
    description: 'Frodo Test Secret Three Description',
  };
  const secret4 = {
    name: 'esv-frodo-test-secret4',
    value: 'RnJvZG8gVGVzdCBTZWNyZXQgRm91ciBWYWx1ZQ==', // base64 encoded 'Frodo Test Secret Four Value'
    description: 'Frodo Test Secret Four Description',
    encoding: 'generic',
    placeholders: true,
  };
  const secret5 = {
    name: 'esv-frodo-test-secret5',
    value: `LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNFakNDQVhzQ0FnMzZNQTBHQ1NxR1NJYjNEUUVCQlFVQU1JR2JNUXN3Q1FZRFZRUUdFd0pLVURFT01Bd0cKQTFVRUNCTUZWRzlyZVc4eEVEQU9CZ05WQkFjVEIwTm9kVzh0YTNVeEVUQVBCZ05WQkFvVENFWnlZVzVyTkVSRQpNUmd3RmdZRFZRUUxFdzlYWldKRFpYSjBJRk4xY0hCdmNuUXhHREFXQmdOVkJBTVREMFp5WVc1ck5FUkVJRmRsCllpQkRRVEVqTUNFR0NTcUdTSWIzRFFFSkFSWVVjM1Z3Y0c5eWRFQm1jbUZ1YXpSa1pDNWpiMjB3SGhjTk1USXcKT0RJeU1EVXlOalUwV2hjTk1UY3dPREl4TURVeU5qVTBXakJLTVFzd0NRWURWUVFHRXdKS1VERU9NQXdHQTFVRQpDQXdGVkc5cmVXOHhFVEFQQmdOVkJBb01DRVp5WVc1ck5FUkVNUmd3RmdZRFZRUUREQTkzZDNjdVpYaGhiWEJzClpTNWpiMjB3WERBTkJna3Foa2lHOXcwQkFRRUZBQU5MQURCSUFrRUFtL3hta0htRVFydXJFLzByZS9qZUZSTGwKOFpQakJvcDd1TEhobmlhN2xRRy81ekR0WklVQzNSVnBxRFN3QnV3L05Ud2VHeXVQK284QUc5OEh4cXhUQndJRApBUUFCTUEwR0NTcUdTSWIzRFFFQkJRVUFBNEdCQUJTMlRMdUJlVFBtY2FUYVVXL0xDQjJOWU95OEdNZHpSMW14CjhpQkl1Mkg2L0UydGlZM1JJZXZWMk9XNjFxWTIvWFJRZzdZUHh4M2ZmZVV1Z1g5RjRKL2lQbm51MXpBeHh5QnkKMlZndUt2NFNXalJGb1JrSWZJbEhYMHFWdmlNaFNsTnkyaW9GTHk3SmNQWmIrdjNmdERHeXdVcWNCaVZEb2VhMApIbitHbXhaQQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0t`,
    newValue: `LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNYakNDQWNjQ0FnNEdNQTBHQ1NxR1NJYjNEUUVCQlFVQU1JR2JNUXN3Q1FZRFZRUUdFd0pLVURFT01Bd0cKQTFVRUNCTUZWRzlyZVc4eEVEQU9CZ05WQkFjVEIwTm9kVzh0YTNVeEVUQVBCZ05WQkFvVENFWnlZVzVyTkVSRQpNUmd3RmdZRFZRUUxFdzlYWldKRFpYSjBJRk4xY0hCdmNuUXhHREFXQmdOVkJBTVREMFp5WVc1ck5FUkVJRmRsCllpQkRRVEVqTUNFR0NTcUdTSWIzRFFFSkFSWVVjM1Z3Y0c5eWRFQm1jbUZ1YXpSa1pDNWpiMjB3SGhjTk1USXcKT1RJM01UTXdNREUwV2hjTk1UY3dPVEkyTVRNd01ERTBXakJLTVFzd0NRWURWUVFHRXdKS1VERU9NQXdHQTFVRQpDQXdGVkc5cmVXOHhFVEFQQmdOVkJBb01DRVp5WVc1ck5FUkVNUmd3RmdZRFZRUUREQTkzZDNjdVpYaGhiWEJzClpTNWpiMjB3Z2Fjd0VBWUhLb1pJemowQ0FRWUZLNEVFQUNjRGdaSUFCQUlaMFJjMFkzanNxUHFxcHRSejN0aVMKQXV2VEhBOXZVaWdNMmdVak02WWtUS29mUDdSUmxzNGRxdDZhTTcvMWVMYkZnNEpkaDlEWFM0elUxRUZlaVpRWgorZHJTUVlBbUFnQXRUenBtdG1Vb3krbWl3dGlTQm9tdTNDU1VlNllyVnZXYitPaXJtdncyeDNCQ1RKVzJYamh5CjV5NnREUFZSUnloZzBuaDV3bS9VeFp2NGpvN0FadUpWOHp0Wkt3Q0VBREFOQmdrcWhraUc5dzBCQVFVRkFBT0IKZ1FCbGFPRjVPNFJ5dkRRMXFDQXVNNm9Yam1MM2tDQTNLcDdWZnl0RFlheGJhSlZoQzhQbkUwQThWUFgyeXBuOQphUVI0eXE5OGUydW1Qc3JTTDdnUGRkb2dhK092YXR1c0c5R25JdmlXR1N6YXpRQlFUVFFkRVNKeHJQZERYRTBFCllGNVBQeEFPKzB5S0dxa2w4UGVwdnltWEJyTUFlc3psSGFSRlhlUm9qWFZBTHc9PQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0t`,
    description: 'Frodo Test PEM encoded Secret Five Description',
    encoding: 'pem',
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
          value: secret1.valueV2,
          state,
        });
        await SecretsApi.createNewVersionOfSecret({
          secretId: secret1.name,
          value: secret1.valueV3,
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
          value: secret2.valueV2,
          state,
        });
        await SecretsApi.createNewVersionOfSecret({
          secretId: secret2.name,
          value: secret2.valueV3,
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
      // setup secret5 - delete if exists
      try {
        await SecretsApi.getSecret({ secretId: secret5.name, state });
        await SecretsApi.deleteSecret({ secretId: secret5.name, state });
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
      try {
        await SecretsApi.getSecret({ secretId: secret5.name, state });
        await SecretsApi.deleteSecret({ secretId: secret5.name, state });
      } catch (error) {
        // ignore
      }
    }
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
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

    test(`2: Create pem encoded secret: ${secret5.name} - success`, async () => {
      const response = await SecretsApi.putSecret({
        secretId: secret5.name,
        value: secret5.value,
        description: secret5.description,
        encoding: secret5.encoding,
        useInPlaceholders: secret5.placeholders,
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
        value: secret2.valueV4,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Create new version of non-existing secret: esv-does-not-exist - error', async () => {
      expect.assertions(1);
      try {
        await SecretsApi.createNewVersionOfSecret({
          secretId: 'esv-does-not-exist',
          value: 'RnJvZG8gTm9uLUV4aXN0aW5nIFRlc3QgU2VjcmV0IFZhbHVlIFZlcnNpb24gMg==', // base64 encoded 'Frodo Non-Existing Test Secret Value Version 2',
          state,
        });
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });

    test(`3: Create new version of existing secret with pem encoding: ${secret5.name} - success`, async () => {
      const response = await SecretsApi.createNewVersionOfSecret({
        secretId: secret5.name,
        value: secret5.newValue,
        state,
      });
      expect(response).toMatchSnapshot();
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
