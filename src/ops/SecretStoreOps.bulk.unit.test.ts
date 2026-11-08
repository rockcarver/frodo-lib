import { jest } from '@jest/globals';

/**
 * `exportSecretStores` and `importSecretStores` report every secret store once.
 * A store whose mappings cannot be read or written is a failed store: the
 * callback gets one error that names the store, the store is not reported as a
 * success and is left out of the result. `exportSecretStores` without a
 * callback throws instead of exporting the store without its mappings.
 * Mocked unit test: no recordings.
 */

const getSecretStores = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getSecretStoreMappings = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const putSecretStore = jest.fn(async (_args?: any): Promise<any> => ({}));
const putSecretStoreMapping = jest.fn(
  async (_args?: any): Promise<any> => ({})
);

const actualSecretStoreApi = await import('../api/SecretStoreApi');
jest.unstable_mockModule('../api/SecretStoreApi', () => ({
  ...actualSecretStoreApi,
  getSecretStores,
  getSecretStoreMappings,
  putSecretStore,
  putSecretStoreMapping,
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

const { exportSecretStores, importSecretStores } =
  await import('./SecretStoreOps');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'classic',
} as any;

const TYPE = 'KeyStoreSecretStore';

const store = (id: string): any => ({
  _id: id,
  _type: { _id: TYPE },
});

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

type Outcome = { error?: any; result?: any };
let outcomes: Outcome[];
const callback = (error: any, result?: any) => outcomes.push({ error, result });

beforeEach(() => {
  jest.clearAllMocks();
  outcomes = [];
  getSecretStores.mockReset();
  getSecretStores.mockImplementation(async () => ({
    result: [store('a'), store('b'), store('c')],
  }));
  getSecretStoreMappings.mockReset();
  getSecretStoreMappings.mockImplementation(async ({ secretStoreId }: any) => ({
    result: [{ _id: `${secretStoreId}-mapping`, secretId: 'x' }],
  }));
  putSecretStore.mockReset();
  putSecretStore.mockImplementation(async ({ secretStoreData }: any) => ({
    ...secretStoreData,
  }));
  putSecretStoreMapping.mockReset();
  putSecretStoreMapping.mockImplementation(
    async ({ secretStoreMappingData }: any) => ({ ...secretStoreMappingData })
  );
});

describe('exportSecretStores', () => {
  test('exports every store with its mappings and reports each store once', async () => {
    const exported = await exportSecretStores({
      globalConfig: false,
      resultCallback: callback,
      state,
    });

    expect(Object.keys(exported.secretstore)).toEqual(['a', 'b', 'c']);
    expect(exported.secretstore.b.mappings).toEqual([
      { _id: 'b-mapping', secretId: 'x' },
    ]);
    expect(outcomes.map((it) => it.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map((it) => it.result._id)).toEqual(['a', 'b', 'c']);
  });

  test('a store whose mappings cannot be read is reported once, by name, and not exported', async () => {
    getSecretStoreMappings.mockImplementation(
      async ({ secretStoreId }: any) => {
        if (secretStoreId === 'b') throw new Error('HTTP 500');
        return { result: [] };
      }
    );

    const exported = await exportSecretStores({
      globalConfig: false,
      resultCallback: callback,
      state,
    });

    expect(outcomes).toHaveLength(3);
    const failures = outcomes.filter((it) => it.error);
    expect(failures).toHaveLength(1);
    expect(messagesOf(failures[0].error)).toContain('secret store b');
    expect(messagesOf(failures[0].error)).toContain('HTTP 500');
    expect(
      outcomes.filter((it) => it.result).map((it) => it.result._id)
    ).toEqual(['a', 'c']);
    expect(Object.keys(exported.secretstore)).toEqual(['a', 'c']);
  });

  test('without a callback a store whose mappings cannot be read fails the export instead of leaving the mappings out', async () => {
    getSecretStoreMappings.mockImplementation(
      async ({ secretStoreId }: any) => {
        if (secretStoreId === 'b') throw new Error('HTTP 500');
        return { result: [] };
      }
    );

    await expect(
      exportSecretStores({ globalConfig: false, state })
    ).rejects.toThrow();
    const error = await exportSecretStores({
      globalConfig: false,
      state,
    }).catch((e) => e);
    expect(messagesOf(error)).toContain('secret store b');
    expect(messagesOf(error)).toContain('HTTP 500');
  });
});

describe('importSecretStores', () => {
  const importData = (): any => ({
    secretstore: {
      a: { ...store('a'), mappings: [{ _id: 'a-mapping', secretId: 'x' }] },
      b: { ...store('b'), mappings: [{ _id: 'b-mapping', secretId: 'y' }] },
      c: { ...store('c'), mappings: [{ _id: 'c-mapping', secretId: 'z' }] },
    },
  });

  test('imports every store and reports each store once', async () => {
    const response = await importSecretStores({
      importData: importData(),
      globalConfig: false,
      resultCallback: callback,
      state,
    });

    expect(response.map((it) => it._id)).toEqual(['a', 'b', 'c']);
    expect(outcomes.map((it) => it.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(response[1].mappings).toEqual([{ _id: 'b-mapping', secretId: 'y' }]);
  });

  test('a store whose mappings cannot be imported is reported once, by name, and not as imported', async () => {
    putSecretStoreMapping.mockImplementation(
      async ({ secretStoreId, secretStoreMappingData }: any) => {
        if (secretStoreId === 'b') throw new Error('HTTP 400');
        return { ...secretStoreMappingData };
      }
    );

    const response = await importSecretStores({
      importData: importData(),
      globalConfig: false,
      resultCallback: callback,
      state,
    });

    expect(outcomes).toHaveLength(3);
    const failures = outcomes.filter((it) => it.error);
    expect(failures).toHaveLength(1);
    expect(messagesOf(failures[0].error)).toContain('secret store b');
    expect(messagesOf(failures[0].error)).toContain('HTTP 400');
    expect(
      outcomes.filter((it) => it.result).map((it) => it.result._id)
    ).toEqual(['a', 'c']);
    expect(response.map((it) => it._id)).toEqual(['a', 'c']);
  });

  test('a store that cannot be written is reported by name', async () => {
    putSecretStore.mockImplementation(async ({ secretStoreData }: any) => {
      if (secretStoreData._id === 'c') throw new Error('HTTP 403');
      return { ...secretStoreData };
    });

    const response = await importSecretStores({
      importData: importData(),
      globalConfig: false,
      resultCallback: callback,
      state,
    });

    const failures = outcomes.filter((it) => it.error);
    expect(failures).toHaveLength(1);
    expect(messagesOf(failures[0].error)).toContain('secret store c');
    expect(messagesOf(failures[0].error)).toContain('HTTP 403');
    expect(response.map((it) => it._id)).toEqual(['a', 'b']);
  });
});
