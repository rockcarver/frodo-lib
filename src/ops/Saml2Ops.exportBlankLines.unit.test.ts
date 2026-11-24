import { jest } from '@jest/globals';
import {
  hostedSpMetadata,
  remoteIdpMetadata,
} from '../test/utils/RemoteSamlMetadata';

/**
 * The server puts whitespace-only lines between two lines of markup into the
 * metadata of a remote SAML provider and adds more with every save. The export
 * of a provider, one or all, does not carry them; the raw read of the metadata
 * stays raw. Signed metadata is exported as it is.
 * Mocked unit test: Saml2Api is replaced, there are no recordings and no
 * network.
 */

const getProviderStubs = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const queryProviderStubs = jest.fn(async (_args?: any): Promise<any> => ({
  resultCount: 0,
  result: [],
}));
const getProvider = jest.fn(async (_args?: any): Promise<any> => ({}));
const getProviderMetadata = jest.fn(
  async (_args?: any): Promise<any> => '<EntityDescriptor/>'
);

const actualApi = await import('../api/Saml2Api');
jest.unstable_mockModule('../api/Saml2Api', () => ({
  ...actualApi,
  getProvider,
  getProviderMetadata,
  getProviderStubs,
  queryProviderStubs,
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

const { exportSaml2Provider, exportSaml2Providers, getSaml2ProviderMetadata } =
  await import('./Saml2Ops');
const { decodeBase64Url, encode } = await import('../utils/Base64Utils');
const { convertTextArrayToBase64Url } =
  await import('../utils/ExportImportUtils');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'cloud',
} as any;

const REMOTE = 'https://idp.example.com/saml2';
const HOSTED = 'https://sp.example.com/saml2';
const idOf = (entityId: string) => encode(entityId, false);

/** what the server returns as the metadata, by entity id */
let served: Record<string, string>;

const stubs = [
  { _id: idOf(REMOTE), entityId: REMOTE, location: 'remote' },
  { _id: idOf(HOSTED), entityId: HOSTED, location: 'hosted' },
];

beforeEach(() => {
  served = {};
  getProviderStubs.mockReset();
  getProviderStubs.mockResolvedValue({ result: stubs });
  queryProviderStubs.mockReset();
  queryProviderStubs.mockImplementation(async ({ filter }: any) => {
    const found = stubs.filter((stub) => filter.includes(`'${stub.entityId}'`));
    return { resultCount: found.length, result: found };
  });
  getProvider.mockReset();
  getProvider.mockImplementation(async ({ entityId64 }: any) => ({
    _id: entityId64,
    entityId: stubs.find((stub) => stub._id === entityId64)?.entityId,
  }));
  getProviderMetadata.mockReset();
  getProviderMetadata.mockImplementation(
    async ({ entityId }: any) => served[entityId]
  );
});

/** the metadata text of an exported provider, decoded from its lines */
function exportedText(
  exported: { saml: { metadata: Record<string, string[]> } },
  entityId: string
): string {
  const lines = exported.saml.metadata[idOf(entityId)];
  return decodeBase64Url(convertTextArrayToBase64Url(lines));
}

describe('exportSaml2Provider', () => {
  test('a remote provider is exported without the whitespace-only lines', async () => {
    served[REMOTE] = remoteIdpMetadata({
      keyInfoBlankLines: [4, 4],
      encryptionBlankLines: 1,
    });
    const exported = await exportSaml2Provider({
      entityId: REMOTE,
      options: { deps: false },
      state,
    });
    const clean = remoteIdpMetadata({
      keyInfoBlankLines: [0, 0],
      encryptionBlankLines: 0,
    });
    expect(exportedText(exported, REMOTE)).toBe(clean);
    expect(exported.saml.metadata[idOf(REMOTE)]).toEqual(clean.split('\n'));
    expect(
      exported.saml.metadata[idOf(REMOTE)].filter((line) => line.trim() === '')
    ).toEqual(['']); // only the empty rest after the last newline
  });

  test.each([
    ['0 lines', [0, 0]],
    ['3 lines per ds:KeyInfo, as after creating the provider', [3, 3]],
    ['4 lines per ds:KeyInfo, as after one more save', [4, 4]],
    ['2 lines per ds:KeyInfo, mixed', [1, 3]],
  ])('a remote provider with %s exports the same text', async (_n, blanks) => {
    served[REMOTE] = remoteIdpMetadata({ keyInfoBlankLines: blanks });
    const exported = await exportSaml2Provider({
      entityId: REMOTE,
      options: { deps: false },
      state,
    });
    expect(exportedText(exported, REMOTE)).toBe(
      remoteIdpMetadata({ keyInfoBlankLines: [0, 0] })
    );
  });

  test('every later save of the server leaves the export as it was', async () => {
    const texts: string[] = [];
    // the server adds one line per ds:KeyInfo with every save
    for (const saves of [0, 1, 2, 3, 10]) {
      served[REMOTE] = remoteIdpMetadata({
        keyInfoBlankLines: [3 + saves, 3 + saves],
      });
      const exported = await exportSaml2Provider({
        entityId: REMOTE,
        options: { deps: false },
        state,
      });
      texts.push(exportedText(exported, REMOTE));
    }
    expect(new Set(texts).size).toBe(1);
  });

  test('a hosted provider is exported unchanged', async () => {
    served[HOSTED] = hostedSpMetadata();
    const exported = await exportSaml2Provider({
      entityId: HOSTED,
      options: { deps: false },
      state,
    });
    expect(exportedText(exported, HOSTED)).toBe(hostedSpMetadata());
  });

  test('signed metadata is exported unchanged', async () => {
    served[REMOTE] = remoteIdpMetadata({
      keyInfoBlankLines: [4, 4],
      signed: true,
    });
    const exported = await exportSaml2Provider({
      entityId: REMOTE,
      options: { deps: false },
      state,
    });
    expect(exportedText(exported, REMOTE)).toBe(served[REMOTE]);
  });

  test('the metadata keeps \\r\\n line endings', async () => {
    served[REMOTE] = remoteIdpMetadata({
      keyInfoBlankLines: [4, 4],
      eol: '\r\n',
    });
    const exported = await exportSaml2Provider({
      entityId: REMOTE,
      options: { deps: false },
      state,
    });
    expect(exportedText(exported, REMOTE)).toBe(
      remoteIdpMetadata({ keyInfoBlankLines: [0, 0], eol: '\r\n' })
    );
  });
});

describe('exportSaml2Providers', () => {
  test('every remote provider is exported without the lines, every hosted one unchanged', async () => {
    served[REMOTE] = remoteIdpMetadata({
      keyInfoBlankLines: [4, 4],
      encryptionBlankLines: 2,
    });
    served[HOSTED] = hostedSpMetadata();
    const exported = await exportSaml2Providers({
      options: { deps: false },
      state,
    });
    expect(exportedText(exported, REMOTE)).toBe(
      remoteIdpMetadata({ keyInfoBlankLines: [0, 0], encryptionBlankLines: 0 })
    );
    expect(exportedText(exported, HOSTED)).toBe(hostedSpMetadata());
  });

  test('signed metadata is exported unchanged', async () => {
    served[REMOTE] = remoteIdpMetadata({
      keyInfoBlankLines: [3, 3],
      signed: true,
    });
    served[HOSTED] = hostedSpMetadata();
    const exported = await exportSaml2Providers({
      options: { deps: false },
      state,
    });
    expect(exportedText(exported, REMOTE)).toBe(served[REMOTE]);
  });
});

describe('getSaml2ProviderMetadata', () => {
  test('the raw read stays raw', async () => {
    served[REMOTE] = remoteIdpMetadata({ keyInfoBlankLines: [4, 4] });
    const raw = await getSaml2ProviderMetadata({ entityId: REMOTE, state });
    expect(raw).toBe(served[REMOTE]);
  });
});
