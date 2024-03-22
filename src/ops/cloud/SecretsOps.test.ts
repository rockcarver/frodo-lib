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

import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { state } from '../../index';
import * as SecretsOps from './SecretsOps';
import axios, { AxiosError } from 'axios';
import { FrodoError } from '../../FrodoError';

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

describe('SecretsOps', () => {
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
  const secret4 = {
    id: 'esv-frodo-test-secret4',
    value: `-----BEGIN CERTIFICATE-----
MIICEjCCAXsCAg36MA0GCSqGSIb3DQEBBQUAMIGbMQswCQYDVQQGEwJKUDEOMAwG
A1UECBMFVG9reW8xEDAOBgNVBAcTB0NodW8ta3UxETAPBgNVBAoTCEZyYW5rNERE
MRgwFgYDVQQLEw9XZWJDZXJ0IFN1cHBvcnQxGDAWBgNVBAMTD0ZyYW5rNEREIFdl
YiBDQTEjMCEGCSqGSIb3DQEJARYUc3VwcG9ydEBmcmFuazRkZC5jb20wHhcNMTIw
ODIyMDUyNjU0WhcNMTcwODIxMDUyNjU0WjBKMQswCQYDVQQGEwJKUDEOMAwGA1UE
CAwFVG9reW8xETAPBgNVBAoMCEZyYW5rNEREMRgwFgYDVQQDDA93d3cuZXhhbXBs
ZS5jb20wXDANBgkqhkiG9w0BAQEFAANLADBIAkEAm/xmkHmEQrurE/0re/jeFRLl
8ZPjBop7uLHhnia7lQG/5zDtZIUC3RVpqDSwBuw/NTweGyuP+o8AG98HxqxTBwID
AQABMA0GCSqGSIb3DQEBBQUAA4GBABS2TLuBeTPmcaTaUW/LCB2NYOy8GMdzR1mx
8iBIu2H6/E2tiY3RIevV2OW61qY2/XRQg7YPxx3ffeUugX9F4J/iPnnu1zAxxyBy
2VguKv4SWjRFoRkIfIlHX0qVviMhSlNy2ioFLy7JcPZb+v3ftDGywUqcBiVDoea0
Hn+GmxZA
-----END CERTIFICATE-----`,
    newValue: `-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----`,
    description: 'Frodo Test PEM encoded Secret Four Description',
    encoding: 'pem',
    useInPlaceholders: true,
  };

  const secret5 = {
    id: 'esv-frodo-test-secret-5',
    value: '0nbVGkrNnIm4o5WKzYS/dL3/eo/k9EnSBH2QOOm5dLM=',
    description: 'description5',
    encoding: 'base64hmac',
    useInPlaceholders: false,
  };
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
      await stageSecret(secret4, false);
      await stageSecret(secret5, false);
    }
  });

  describe('createSecretsExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(SecretsOps.createSecretsExportTemplate).toBeDefined();
    });

    test('1: Return template with meta data', async () => {
      expect(
        SecretsOps.createSecretsExportTemplate({ state: state })
      ).toStrictEqual({
        meta: expect.any(Object),
        secrets: {},
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
      const response = await SecretsOps.exportSecret({
        secretId: secret1.id,
        state: state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('2: Export secret2', async () => {
      const response = await SecretsOps.exportSecret({
        secretId: secret2.id,
        state: state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('3: Export secret3 (non-existent)', async () => {
      expect.assertions(2);
      try {
        await SecretsOps.exportSecret({ secretId: secret3.id, state: state });
      } catch (error) {
        expect(error.name).toEqual('FrodoError');
        expect((error as FrodoError).getCombinedMessage()).toMatchSnapshot();
      }
    });
  });

  describe('createSecret()', () => {
    test(`0: Create pem encoded secret: ${secret4.id} - success`, async () => {
      const response = await SecretsOps.createSecret({
        secretId: secret4.id,
        value: secret4.value,
        description: secret4.description,
        encoding: secret4.encoding,
        useInPlaceholders: secret4.useInPlaceholders,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`1: Create new version of pem encoded secret: ${secret4.id} - success`, async () => {
      const response = await SecretsOps.createVersionOfSecret({
        secretId: secret4.id,
        value: secret4.newValue,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`3: Create base64hmac encoded secret: ${secret5.id} - success`, async () => {
      const response = await SecretsOps.createSecret({
        secretId: secret5.id,
        value: secret5.value,
        description: secret5.description,
        encoding: secret5.encoding,
        useInPlaceholders: secret5.useInPlaceholders,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
