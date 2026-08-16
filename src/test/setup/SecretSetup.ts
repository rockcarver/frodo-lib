import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { FrodoError, state } from '../../index';
import * as SecretsOps from '../../ops/cloud/SecretsOps';
import {
  SecretSkeleton,
  SecretEncodingType,
  VersionOfSecretStatus,
  deleteVersionOfSecret,
} from '../../api/cloud/SecretsApi';

type TestSecret = SecretSkeleton & {
  value: string;
  encoding: string;
  useInPlaceholders: boolean;
};

export const secret1 = createTestSecret({
  id: 'esv-frodo-test-secret-1',
  value: 'value1',
  description: 'description1',
  encoding: 'generic',
  useInPlaceholders: true,
});

export const secret2 = createTestSecret({
  id: 'esv-frodo-test-secret-2',
  value: 'value2',
  description: 'description2',
  encoding: 'generic',
  useInPlaceholders: true,
});

export const secret3 = createTestSecret({
  id: 'esv-frodo-test-secret-3',
  value: 'value3',
  description: 'description3',
  encoding: 'generic',
  useInPlaceholders: true,
});

export const secret4 = createTestSecret({
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
  description: 'Frodo Test PEM encoded Secret Four Description',
  encoding: 'pem',
  useInPlaceholders: true,
});

export const secret5 = createTestSecret({
  id: 'esv-frodo-test-secret-5',
  value: '0nbVGkrNnIm4o5WKzYS/dL3/eo/k9EnSBH2QOOm5dLM=',
  description: 'description5',
  encoding: 'base64hmac',
  useInPlaceholders: false,
});

export const secret6 = createTestSecret({
  id: 'esv-frodo-test-secret-6',
  value: 'value6',
  description: 'description6',
  encoding: 'generic',
  useInPlaceholders: true,
});

export const secret7 = createTestSecret({
  id: 'esv-frodo-test-secret-7',
  value: 'value7',
  description: 'description7',
  encoding: 'generic',
  useInPlaceholders: true,
  activeValue: {
    $crypto: {
      type: 'x-simple-encryption',
      value: {
        cipher: 'AES/CBC/PKCS5Padding',
        data: 'pVE6Y1Va4V1DB50A10mqkQ==',
        iv: '2GjZJDuomoZeBOkr4MWBGQ==',
        keySize: 16,
        mac: 'A2TT/N3gBzWdQjhHo3QPjg==',
        purpose: 'idm.password.encryption',
        salt: 'Osc1v2DpgdnE6Bqf8SH5ng==',
        stableId: 'openidm-sym-default',
      },
    },
  },
});

export const secret8 = createTestSecret({
  id: 'esv-frodo-test-secret-8',
  value: 'value8',
  description: 'description8',
  encoding: 'generic',
  useInPlaceholders: true,
});

export const secret9 = createTestSecret({
  id: 'esv-frodo-test-secret-9',
  value: 'value9',
  description: 'description9',
  encoding: 'generic',
  useInPlaceholders: true,
});

export const secret10 = createTestSecret({
  id: 'esv-frodo-test-secret-10',
  value: 'value10',
  description: 'description10',
  encoding: 'generic',
  useInPlaceholders: true,
  activeValue: {
    $crypto: {
      type: 'x-simple-encryption',
      value: {
        cipher: 'AES/CBC/PKCS5Padding',
        data: 'SZ8gU3fq5dGlbhPgd7kT3Q==',
        iv: 'KCOai4hfGovwyrSswB9mow==',
        keySize: 16,
        mac: 'lJdfWa1DkNkxcHBMfqlXuw==',
        purpose: 'idm.password.encryption',
        salt: 'bqeoBikq1SB1c+ThqqQDaw==',
        stableId: 'openidm-sym-default',
      },
    },
  },
});

export const secret11 = createTestSecret({
  id: 'esv-frodo-test-secret-11',
  value: 'value11',
  description: 'description11',
  encoding: 'generic',
  useInPlaceholders: true,
  activeValue: {
    $crypto: {
      type: 'x-simple-encryption',
      value: {
        cipher: 'AES/CBC/PKCS5Padding',
        data: 'Sxb6VWMMUCQ/qBmYB08kCA==',
        iv: '7rayASsrtPPg+VAojLADdQ==',
        keySize: 16,
        mac: 'nx2l6Sx4k8nk3DDVXb5rqQ==',
        purpose: 'idm.password.encryption',
        salt: 'i4CP2IeVdFR9vTXvs69/RA==',
        stableId: 'openidm-sym-default',
      },
    },
  },
});

export const secret12 = createTestSecret({
  id: 'esv-frodo-test-secret-12',
  value: 'value12',
  description: 'description12',
  encoding: 'generic',
  useInPlaceholders: true,
});

export const secret13 = createTestSecret({
  id: 'esv-frodo-test-secret-13',
  value: 'value13',
  description: 'description13',
  encoding: 'generic',
  useInPlaceholders: false,
});

export const secret14 = createTestSecret({
  id: 'esv-frodo-test-secret-14',
  value: 'value14',
  description: 'description14',
  encoding: 'generic',
  useInPlaceholders: true,
});

export const secret15 = createTestSecret({
  id: 'esv-frodo-test-secret-15',
  value: 'value15',
  description: 'description15',
  encoding: 'generic',
  useInPlaceholders: false,
});

export const secret6Export = createTestSecretExport([secret6]);

export const secret7Export = createTestSecretExport([secret7]);

export const secret89Export = createTestSecretExport([secret8, secret9]);

export const secret1011Export = createTestSecretExport([secret10, secret11]);

export const enabledVersion1 = createSecretVersion('enabled1');

export const enabledVersion2 = createSecretVersion('enabled2');

export const disabledVersion1 = createSecretVersion('disabled1', 'DISABLED');

export const disabledVersion2 = createSecretVersion('disabled2', 'DISABLED');

export const destroyedVersion1 = createSecretVersion('destroyed1', 'DESTROYED');

export const destroyedVersion2 = createSecretVersion('destroyed2', 'DESTROYED');

export const allVersions = [
  enabledVersion1,
  enabledVersion2,
  disabledVersion1,
  disabledVersion2,
  destroyedVersion1,
  destroyedVersion2,
];

function createTestSecret({
  id,
  description,
  value,
  encoding,
  useInPlaceholders,
  activeValue,
}: {
  id: string;
  description: string;
  value: string;
  encoding: SecretEncodingType;
  useInPlaceholders: boolean;
  activeValue?: any;
}): TestSecret {
  return {
    _id: id,
    description,
    encoding,
    useInPlaceholders,
    activeVersion: '1',
    loadedVersion: '1',
    lastChangeDate: '2024-07-03T03:28:19.227876Z',
    lastChangedBy: 'volker.scheuber@forgerock.com',
    loaded: true,
    value,
    activeValue,
  };
}

export function createTestSecretExport(
  secrets: TestSecret[]
): SecretsOps.SecretsExportInterface {
  return {
    meta: {
      exportDate: '2024-07-03T03:48:18.901Z',
      exportTool: 'frodo',
      exportToolVersion: 'v2.0.0-89 [v20.5.1]',
      exportedBy: 'volker.scheuber@forgerock.com',
      origin: 'https://openam-frodo-dev.forgeblocks.com/am',
      originAmVersion: '7.6.0',
    },
    secret: Object.fromEntries(secrets.map((s) => [s._id, s])),
  };
}

export function createSecretVersion(
  value: string,
  status: VersionOfSecretStatus = 'ENABLED'
): { value: string; status: VersionOfSecretStatus } {
  return { value, status };
}

export async function stageSecret(
  secret: TestSecret,
  create = true,
  versions: { value: string; status: VersionOfSecretStatus }[] = []
) {
  // delete if exists, then create
  try {
    await SecretsOps.deleteSecret({ secretId: secret._id, state });
  } catch {
    // ignore
  }
  if (create) {
    // We want the value of the secret to be the current version, so put it at the end of the versions array
    versions = [...versions, createSecretVersion(secret.value)];
    await SecretsOps.createSecret({
      secretId: secret._id,
      value: versions[0].value,
      description: secret.description,
      encoding: secret.encoding,
      useInPlaceholders: secret.useInPlaceholders,
      state,
    });
    // Create versions if any are provided
    for (let i = 1; i < versions.length; ++i) {
      await SecretsOps.createVersionOfSecret({
        secretId: secret._id,
        value: versions[i].value,
        state,
      });
      // Set status of the previous version since it's no longer the active version
      switch (versions[i - 1].status) {
        case 'DISABLED':
          await SecretsOps.disableVersionOfSecret({
            secretId: secret._id,
            // Use i, not i - 1 since versions are not zero based
            version: String(i),
            state,
          });
          break;
        case 'DESTROYED':
          await deleteVersionOfSecret({
            secretId: secret._id,
            // Use i, not i - 1 since versions are not zero based
            version: String(i),
            state,
          });
          break;
        case 'ENABLED':
          await SecretsOps.enableVersionOfSecret({
            secretId: secret._id,
            // Use i, not i - 1 since versions are not zero based
            version: String(i),
            state,
          });
          break;
        default:
          throw new FrodoError(
            `Unknown version status supplied: ${versions[i].status}`
          );
      }
    }
  }
}

export async function setup() {
  const ctx = autoSetupPolly();

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
      await stageSecret(secret3, false);
      await stageSecret(secret4, false);
      await stageSecret(secret5, false);
      await stageSecret(secret6, false);
      await stageSecret(secret7, false);
      await stageSecret(secret8, false);
      await stageSecret(secret9, false);
      await stageSecret(secret10, false);
      await stageSecret(secret11, false);
      await stageSecret(secret12, true, allVersions);
      await stageSecret(secret13, true, allVersions);
      await stageSecret(secret14, true, allVersions);
      await stageSecret(secret15, true, allVersions);
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
      await stageSecret(secret6, false);
      await stageSecret(secret7, false);
      await stageSecret(secret8, false);
      await stageSecret(secret9, false);
      await stageSecret(secret10, false);
      await stageSecret(secret11, false);
      await stageSecret(secret12, false);
      await stageSecret(secret13, false);
      await stageSecret(secret14, false);
      await stageSecret(secret15, false);
    }
  });
}
