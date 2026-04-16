import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { state } from '../../index';
import * as SecretsOps from '../../ops/cloud/SecretsOps';
import { SecretSkeleton, SecretEncodingType } from '../../api/cloud/SecretsApi';

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

function createTestSecret({
  id,
  description,
  value,
  encoding,
  useInPlaceholders,
}: {
  id: string;
  description: string;
  value: string;
  encoding: SecretEncodingType;
  useInPlaceholders: boolean;
}): TestSecret {
  return {
    _id: id,
    description,
    encoding,
    useInPlaceholders,
    lastChangeDate: '2024-07-03T03:28:19.227876Z',
    lastChangedBy: 'volker.scheuber@forgerock.com',
    loaded: false,
    value,
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

export async function stageSecret(secret: TestSecret, create = true) {
  // delete if exists, then create
  try {
    await SecretsOps.deleteSecret({ secretId: secret._id, state });
  } catch {
    // ignore
  }
  if (create) {
    await SecretsOps.createSecret({
      secretId: secret._id,
      value: secret.value,
      description: secret.description,
      encoding: secret.encoding,
      useInPlaceholders: secret.useInPlaceholders,
      state,
    });
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
}
