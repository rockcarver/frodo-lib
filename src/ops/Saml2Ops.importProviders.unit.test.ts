import { jest } from '@jest/globals';

/**
 * `importSaml2Providers` collects one error per provider that could not be
 * imported, and each error names the entity id of the provider: the error of
 * its dependencies and the error of creating or updating it.
 * Mocked unit test: no recordings.
 */

const createProvider = jest.fn(async (_args?: any): Promise<any> => ({}));
const updateProvider = jest.fn(async (_args?: any): Promise<any> => ({}));

const actualApi = await import('../api/Saml2Api');
jest.unstable_mockModule('../api/Saml2Api', () => ({
  ...actualApi,
  createProvider,
  updateProvider,
}));

const updateScript = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualScriptOps = await import('./ScriptOps');
jest.unstable_mockModule('./ScriptOps', () => ({
  ...actualScriptOps,
  updateScript,
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  debugMessage: jest.fn(),
}));

const { importSaml2Providers } = await import('./Saml2Ops');
const { encode } = await import('../utils/Base64Utils');

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

const SP1 = 'https://sp1.example.com';
const SP2 = 'https://sp2.example.com';

/** hosted providers; the first has an attribute mapper script that is not in the file */
const importData = (): any => ({
  saml: {
    hosted: {
      [encode(SP1, false)]: {
        entityId: SP1,
        identityProvider: {
          assertionProcessing: {
            attributeMapper: { attributeMapperScript: 'mapper-1' },
          },
        },
      },
      [encode(SP2, false)]: { entityId: SP2 },
    },
    remote: {},
    metadata: {},
    cot: {},
  },
  script: {},
});

beforeEach(() => {
  jest.clearAllMocks();
  createProvider.mockReset();
  createProvider.mockImplementation(async ({ providerData }: any) => ({
    ...providerData,
  }));
  updateProvider.mockReset();
  updateProvider.mockImplementation(async ({ providerData }: any) => ({
    ...providerData,
  }));
  updateScript.mockReset();
  updateScript.mockImplementation(async () => ({}));
});

describe('importSaml2Providers', () => {
  test('imports every provider', async () => {
    const response = await importSaml2Providers({
      importData: importData(),
      options: { deps: false },
      state,
    });

    expect(response.map((it: any) => it.entityId)).toEqual([SP1, SP2]);
  });

  test('a provider that can be neither created nor updated is named in its error', async () => {
    createProvider.mockImplementation(async ({ providerData }: any) => {
      if (providerData.entityId === SP2) throw new Error('create: HTTP 400');
      return { ...providerData };
    });
    updateProvider.mockImplementation(async ({ providerData }: any) => {
      if (providerData.entityId === SP2) throw new Error('update: HTTP 404');
      return { ...providerData };
    });

    const error: any = await importSaml2Providers({
      importData: importData(),
      options: { deps: false },
      state,
    }).catch((e) => e);

    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toContain(SP2);
    expect(messagesOf(error.originalErrors[0])).toContain('create: HTTP 400');
    expect(messagesOf(error.originalErrors[0])).toContain('update: HTTP 404');
  });

  test('a provider whose dependencies cannot be imported is named in its error', async () => {
    const error: any = await importSaml2Providers({
      importData: importData(),
      options: { deps: true },
      state,
    }).catch((e) => e);

    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toContain(SP1);
    expect(messagesOf(error.originalErrors[0])).toContain('attribute mapper');
  });
});
