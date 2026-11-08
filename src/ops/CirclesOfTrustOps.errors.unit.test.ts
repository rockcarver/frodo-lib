import { jest } from '@jest/globals';

/**
 * The errors of `exportCirclesOfTrust` and `importCirclesOfTrust` carry their
 * causes: the error of the failed read, and one nested error per circle of
 * trust that could not be created or updated, naming the circle.
 * Mocked unit test: no recordings.
 */

const getCirclesOfTrust = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const createCircleOfTrust = jest.fn(async (_args?: any): Promise<any> => ({}));

const actualApi = await import('../api/CirclesOfTrustApi');
jest.unstable_mockModule('../api/CirclesOfTrustApi', () => ({
  ...actualApi,
  getCirclesOfTrust,
  createCircleOfTrust,
}));

const actualSaml2Ops = await import('./Saml2Ops');
jest.unstable_mockModule('./Saml2Ops', () => ({
  ...actualSaml2Ops,
  readSaml2EntityIds: jest.fn(async () => ['a', 'b', 'c']),
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

const actualExportImportUtils = await import('../utils/ExportImportUtils');
jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  ...actualExportImportUtils,
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const { exportCirclesOfTrust, importCirclesOfTrust } =
  await import('./CirclesOfTrustOps');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'cloud',
} as any;

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

beforeEach(() => {
  jest.clearAllMocks();
  getCirclesOfTrust.mockReset();
  getCirclesOfTrust.mockImplementation(async () => ({ result: [] }));
  createCircleOfTrust.mockReset();
  createCircleOfTrust.mockImplementation(async ({ cotData }: any) => cotData);
});

describe('exportCirclesOfTrust', () => {
  test('a failed read is the cause of the error that is thrown', async () => {
    getCirclesOfTrust.mockImplementation(async () => {
      throw new Error('HTTP 500');
    });

    const error: any = await exportCirclesOfTrust({ state }).catch((e) => e);

    expect(error.message).toContain('circles of trust');
    expect(error.originalErrors).toHaveLength(1);
    expect(messagesOf(error)).toContain('HTTP 500');
  });

  test('a tenant that does not offer circles of trust exports none', async () => {
    getCirclesOfTrust.mockImplementation(async () => {
      throw Object.assign(new Error('Forbidden'), {
        response: {
          status: 403,
          data: {
            message:
              'This operation is not available in PingOne Advanced Identity Cloud.',
          },
        },
      });
    });

    const exported = await exportCirclesOfTrust({ state });

    expect(exported.saml.cot).toEqual({});
  });
});

describe('importCirclesOfTrust', () => {
  const importData = (): any => ({
    saml: {
      cot: {
        cot1: { _id: 'cot1', trustedProviders: ['a|saml2'] },
        cot2: { _id: 'cot2', trustedProviders: ['b|saml2'] },
        cot3: { _id: 'cot3', trustedProviders: ['c|saml2'] },
      },
    },
  });

  test('imports every circle of trust', async () => {
    const responses = await importCirclesOfTrust({
      importData: importData(),
      state,
    });

    expect(responses.map((it: any) => it._id)).toEqual([
      'cot1',
      'cot2',
      'cot3',
    ]);
  });

  test('the error carries one nested error per failed circle, naming it, and the other circles are imported', async () => {
    createCircleOfTrust.mockImplementation(async ({ cotData }: any) => {
      if (cotData._id === 'cot2') throw new Error('HTTP 500');
      return cotData;
    });

    const error: any = await importCirclesOfTrust({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.originalErrors).toHaveLength(1);
    expect(messagesOf(error.originalErrors[0])).toContain(
      'circle of trust cot2'
    );
    expect(messagesOf(error.originalErrors[0])).toContain('HTTP 500');
    expect(createCircleOfTrust).toHaveBeenCalledTimes(3);
  });
});
