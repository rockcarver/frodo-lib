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

import { state } from '../../index';
import * as SecretsOps from './SecretsOps';
import { FrodoError } from '../FrodoError';
import * as TestData from '../../test/setup/SecretSetup'
import { snapshotResultCallback } from '../../test/utils/TestUtils';

describe('SecretsOps', () => {

  TestData.setup();

  describe('createSecretsExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsOps.createSecretsExportTemplate).toBeDefined();
    });

    test('1: Return template with meta data', async () => {
      expect(
        SecretsOps.createSecretsExportTemplate({ state: state })
      ).toStrictEqual({
        meta: expect.any(Object),
        secret: {},
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

    test('2: Export all secrets including active values', async () => {
      const response = await SecretsOps.exportSecrets({
        options: { includeActiveValues: true, target: '' },
        state: state,
      });
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
      const response = await SecretsOps.exportSecret({
        secretId: TestData.secret1._id,
        state: state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('2: Export secret2', async () => {
      const response = await SecretsOps.exportSecret({
        secretId: TestData.secret2._id,
        state: state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('3: Export secret3 (non-existent)', async () => {
      expect.assertions(2);
      try {
        await SecretsOps.exportSecret({ secretId: TestData.secret3._id, state: state });
      } catch (error) {
        expect(error.name).toEqual('FrodoError');
        expect((error as FrodoError).getCombinedMessage()).toMatchSnapshot();
      }
    });

    test('4: Export secret2 including active value', async () => {
      const response = await SecretsOps.exportSecret({
        secretId: TestData.secret2._id,
        options: { includeActiveValues: true },
        state: state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('importSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsOps.importSecret).toBeDefined();
    });

    test('1: Import secret6', async () => {
      try {
        const response = await SecretsOps.importSecret({
          secretId: TestData.secret6._id,
          importData: TestData.secret6Export,
          state: state,
        });
        expect(response).toMatchSnapshot();
      } catch (error) {
        console.dir(error);
        // fail("Command should've succeeded");
      }
    });

    test('2: Import secret7 including active value', async () => {
      try {
        const response = await SecretsOps.importSecret({
          secretId: TestData.secret7._id,
          importData: TestData.secret7Export,
          options: { includeActiveValues: true },
          state: state,
        });
        expect(response).toMatchSnapshot();
      } catch (error) {
        console.dir(error);
        // fail("Command should've succeeded");
      }
    });
  });

  describe('importSecrets()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsOps.importSecrets).toBeDefined();
    });

    test('1: Import all secrets (secret8 and secret9)', async () => {
      const response = await SecretsOps.importSecrets({
        importData: TestData.secret89Export,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Import all secrets (secret10 and secret11) including active values', async () => {
      const response = await SecretsOps.importSecrets({
        importData: TestData.secret1011Export,
        options: { includeActiveValues: true },
        state: state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('createSecret()', () => {
    test(`0: Create pem encoded secret: ${TestData.secret4._id} - success`, async () => {
      const response = await SecretsOps.createSecret({
        secretId: TestData.secret4._id,
        value: TestData.secret4.value,
        description: TestData.secret4.description,
        encoding: TestData.secret4.encoding,
        useInPlaceholders: TestData.secret4.useInPlaceholders,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`1: Create new version of pem encoded secret: ${TestData.secret4._id} - success`, async () => {
      const secret4NewValue = `-----BEGIN CERTIFICATE-----
MIICXjCCAccCAg4GMA0GCSqGSIb3DQEBBQUAMIGbMQswCQYDVQQGEwJKUDEOMAwG
A1UECBMFVG9reW8xEDAOBgNVBAcTB0NodW8ta3UxETAPBgNVBAoTCEZyYW5rNERE
MRgwFgYDVQQLEw9XZWJDZXJ0IFN1cHBvcnQxGDAWBgNVBAMTD0ZyYW5rNEREIFdl
YiBDQTEjMCEGCSqGSIb3DQEJARYUc3VwcG9ydEBmcmFuazRkZC5jb20wHhcNMTIw
OTI3MTMwMDE0WhcNMTcwOTI2MTMwMDE0WjBKMQswCQYDVQQGEwJKUDEOMAwGA1UE
CAwFVG9reW8xETAPBgNVBAoMCEZyYW5rNEREMRgwFgYDVQQDDA93d3cuZXhhbXBs
ZS5jb20wgacwEAYHKoZIzj0CAQYFK4EEACcDgZIABAIZ0Rc0Y3jsqPqqptRz3tiS
AuvTHA9vUigM2gUjM6YkTKofP7RRls4dqt6aM7/1eLbFg4Jdh9DXS4zU1EFeiZQZ
+drSQYAmAgAtTzpmtmUoy+miwtiSBomu3CSUe6YrVvWb+Oirmvw2x3BCTJW2Xjhy
5y6tDPVRRyhg0nh5wm/UxZv4jo7AZuJV8ztZKwCEADANBgkqhkiG9w0BAQUFAAOB
gQBlaOF5O4RyvDQ1qCAuM6oXjmL3kCA3Kp7VfytDYaxbaJVhC8PnE0A8VPX2ypn9
aQR4yq98e2umPsrSL7gPddoga+OvatusG9GnIviWGSzazQBQTTQdESJxrPdDXE0E
YF5PPxAO+0yKGqkl8PepvymXBrMAeszlHaRFXeRojXVALw==
-----END CERTIFICATE-----`;
      const response = await SecretsOps.createVersionOfSecret({
        secretId: TestData.secret4._id,
        value: secret4NewValue,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Create base64hmac encoded secret: ${TestData.secret5._id} - success`, async () => {
      const response = await SecretsOps.createSecret({
        secretId: TestData.secret5._id,
        value: TestData.secret5.value,
        description: TestData.secret5.description,
        encoding: TestData.secret5.encoding,
        useInPlaceholders: TestData.secret5.useInPlaceholders,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('pruneVersionsOfSecret()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsOps.pruneVersionsOfSecret).toBeDefined();
    });

    test('1: Prune all versions of secret', async () => {
      const response = await SecretsOps.pruneVersionsOfSecret({ secretId: TestData.secret12._id, keepLoaded: false, keepDeactivated: false, resultCallback: snapshotResultCallback, state });
      expect(response).toMatchSnapshot();
      expect(response.length).toBe(4);
    });

    test('2: Prune all versions except loaded of secret', async () => {
      const response = await SecretsOps.pruneVersionsOfSecret({ secretId: TestData.secret13._id, keepLoaded: true, keepDeactivated: false, resultCallback: snapshotResultCallback, state });
      expect(response).toMatchSnapshot();
      // Still 4 like previous test since loaded version is the active version
      expect(response.length).toBe(4);
    });

    test('3: Prune all versions except deactivated of secret', async () => {
      const response = await SecretsOps.pruneVersionsOfSecret({ secretId: TestData.secret14._id, keepLoaded: false, keepDeactivated: true, resultCallback: snapshotResultCallback, state });
      expect(response).toMatchSnapshot();
      expect(response.length).toBe(2);
    });

    test('3: Prune all versions except loaded and deactivated of secret', async () => {
      const response = await SecretsOps.pruneVersionsOfSecret({ secretId: TestData.secret15._id, keepLoaded: true, keepDeactivated: true, resultCallback: snapshotResultCallback, state });
      expect(response).toMatchSnapshot();
      // Still 2 like previous test since loaded version is the active version
      expect(response.length).toBe(2);
    });
  });
});
