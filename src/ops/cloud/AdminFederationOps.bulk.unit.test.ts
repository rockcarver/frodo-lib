import { jest } from '@jest/globals';

/**
 * `exportAdminFederationProviders` and `importAdminFederationProviders` take an optional
 * result callback (frodo-lib#957). With it, the outcome of every provider is passed to it once,
 * as it happens: a provider that was exported or imported with its configuration as the
 * provider, a provider that failed (or whose configuration failed) as one error that names the
 * provider and carries the cause. A failed provider does not stop the others, is left out of the
 * export or of the result, and the function does not throw for it. Failing to read the
 * providers still throws. Without a callback nothing changes: one combined error is thrown
 * after every provider was tried.
 * Mocked unit test: no recordings.
 */

const getAdminFederationProviders = jest.fn(
  async (_args?: any): Promise<any> => ({ result: [] })
);
const putProviderByTypeAndId = jest.fn(async (args?: any): Promise<any> => ({
  ...args.providerData,
}));
// the actual modules are not loaded first: their imports may reach AdminFederationOps, which would then keep the real API
jest.unstable_mockModule('../../api/cloud/AdminFederationProvidersApi', () => ({
  getAdminFederationProviderTypes: jest.fn(),
  getAdminFederationProvidersByType: jest.fn(),
  getAdminFederationProviders,
  getProviderByTypeAndId: jest.fn(),
  putProviderByTypeAndId,
  deleteProviderByTypeAndId: jest.fn(),
}));

const getConfigEntity = jest.fn(async (args?: any): Promise<any> => ({
  _id: args.entityId,
}));
const putConfigEntity = jest.fn(async (args?: any): Promise<any> => ({
  ...args.entityData,
}));
const actualIdmConfigApi = await import('../../api/IdmConfigApi');
jest.unstable_mockModule('../../api/IdmConfigApi', () => ({
  ...actualIdmConfigApi,
  getConfigEntity,
  putConfigEntity,
}));

const {
  default: AdminFederationOps,
  exportAdminFederationProviders,
  importAdminFederationProviders,
} = await import('./AdminFederationOps');
const { default: State } = await import('../../shared/State');

const state = State({});
state.setRealm('alpha');

const provider = (id: string): any => ({
  _id: id,
  _type: { _id: 'oidc' },
  clientId: `client-${id}`,
});

const providers = () => [provider('a'), provider('b'), provider('c')];

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

type Outcome = { error?: any; result?: any };
let outcomes: Outcome[];
const callback = (error?: any, result?: any) =>
  outcomes.push({ error, result });

beforeEach(() => {
  outcomes = [];
  for (const mock of [
    getAdminFederationProviders,
    putProviderByTypeAndId,
    getConfigEntity,
    putConfigEntity,
  ]) {
    mock.mockClear();
  }
  getAdminFederationProviders.mockImplementation(async () => ({
    result: providers(),
  }));
  putProviderByTypeAndId.mockImplementation(async (args: any) => ({
    ...args.providerData,
  }));
  getConfigEntity.mockImplementation(async (args: any) => ({
    _id: args.entityId,
  }));
  putConfigEntity.mockImplementation(async (args: any) => ({
    ...args.entityData,
  }));
});

describe('exportAdminFederationProviders', () => {
  test('without a callback: exports every provider with its configuration', async () => {
    const exportData = await exportAdminFederationProviders({ state });

    expect(Object.keys(exportData.idp)).toEqual(['a', 'b', 'c']);
    expect(Object.keys(exportData.config)).toEqual([
      'fidc/federation-a',
      'fidc/federation-b',
      'fidc/federation-c',
    ]);
  });

  test('with a callback: reports every provider once, in order, and exports the same as without', async () => {
    const plain = await exportAdminFederationProviders({ state });

    const exportData = await exportAdminFederationProviders({
      resultCallback: callback,
      state,
    });

    expect(exportData.idp).toEqual(plain.idp);
    expect(exportData.config).toEqual(plain.config);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: a provider whose configuration cannot be read is a failed item that names it, and is not in the export without its configuration', async () => {
    getConfigEntity.mockImplementation(async (args: any) => {
      if (args.entityId === 'fidc/federation-b')
        throw new Error('config b: HTTP 500');
      return { _id: args.entityId };
    });

    const exportData = await exportAdminFederationProviders({
      resultCallback: callback,
      state,
    });

    expect(Object.keys(exportData.idp)).toEqual(['a', 'c']);
    expect(Object.keys(exportData.config)).toEqual([
      'fidc/federation-a',
      'fidc/federation-c',
    ]);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].result._id).toBe('a');
    expect(outcomes[2].result._id).toBe('c');
    expect(outcomes[1].result).toBeUndefined();
    expect(outcomes[1].error.message).toBe(
      'Error exporting admin federation provider b'
    );
    expect(outcomes[1].error.originalErrors).toHaveLength(1);
    expect(messagesOf(outcomes[1].error)).toContain('config b: HTTP 500');
  });

  test('with a callback: every provider failing reports every provider and returns an empty export without throwing', async () => {
    getConfigEntity.mockRejectedValue(new Error('HTTP 500'));

    const exportData = await exportAdminFederationProviders({
      resultCallback: callback,
      state,
    });

    expect(exportData.idp).toEqual({});
    expect(exportData.config).toEqual({});
    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((o) => o.error && !o.result)).toBe(true);
  });

  test('with a callback: failing to read the providers still throws and reports nothing', async () => {
    getAdminFederationProviders.mockRejectedValue(new Error('list: HTTP 500'));

    const error: any = await exportAdminFederationProviders({
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error exporting admin federation providers');
    expect(error.originalErrors).toHaveLength(1);
    expect(messagesOf(error)).toContain('list: HTTP 500');
    expect(outcomes).toEqual([]);
  });

  test('without a callback: the failures are thrown as one combined error after every provider was tried', async () => {
    getConfigEntity.mockImplementation(async (args: any) => {
      if (args.entityId === 'fidc/federation-b')
        throw new Error('config b: HTTP 500');
      return { _id: args.entityId };
    });

    const error: any = await exportAdminFederationProviders({ state }).catch(
      (e) => e
    );

    // unchanged: the combined error with the raw error nested
    expect(error.message).toBe('Error exporting admin federation providers');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe('config b: HTTP 500');
    expect(getConfigEntity).toHaveBeenCalledTimes(3);
  });

  test('the facade passes the callback on', async () => {
    await AdminFederationOps(state).exportAdminFederationProviders(callback);

    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
  });
});

describe('importAdminFederationProviders', () => {
  const importData = (): any => ({
    idp: { a: provider('a'), b: provider('b'), c: provider('c') },
    config: {
      'fidc/federation-a': { _id: 'fidc/federation-a' },
      'fidc/federation-b': { _id: 'fidc/federation-b' },
      'fidc/federation-c': { _id: 'fidc/federation-c' },
    },
  });
  /** Writing provider b fails. */
  const failProviderB = () =>
    putProviderByTypeAndId.mockImplementation(async (args: any) => {
      if (args.providerId === 'b') throw new Error('provider b: HTTP 500');
      return { ...args.providerData };
    });

  test('without a callback: imports every provider with its configuration', async () => {
    const response = await importAdminFederationProviders({
      importData: importData(),
      state,
    });

    expect(response.map((p) => p._id)).toEqual(['a', 'b', 'c']);
    expect(putConfigEntity).toHaveBeenCalledTimes(3);
  });

  test('with a callback: reports every provider once, in order, and returns the same as without', async () => {
    const plain = await importAdminFederationProviders({
      importData: importData(),
      state,
    });

    const response = await importAdminFederationProviders({
      importData: importData(),
      resultCallback: callback,
      state,
    });

    expect(response).toEqual(plain);
    expect(outcomes.map((o) => o.error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
  });

  test('with a callback: a provider that cannot be written is a failed item that names it, the others are imported, the function does not throw', async () => {
    failProviderB();

    const response = await importAdminFederationProviders({
      importData: importData(),
      resultCallback: callback,
      state,
    });

    expect(response.map((p) => p._id)).toEqual(['a', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].result._id).toBe('a');
    expect(outcomes[2].result._id).toBe('c');
    expect(outcomes[1].result).toBeUndefined();
    expect(outcomes[1].error.message).toBe(
      'Error importing admin federation provider b'
    );
    expect(outcomes[1].error.originalErrors).toHaveLength(1);
    expect(messagesOf(outcomes[1].error)).toContain('provider b: HTTP 500');
    // the configuration of the failed provider is not written
    expect(putConfigEntity.mock.calls.map(([a]: any) => a.entityId)).toEqual([
      'fidc/federation-a',
      'fidc/federation-c',
    ]);
  });

  test('with a callback: a provider that was written but whose configuration cannot be written is one failed item and not part of the result', async () => {
    putConfigEntity.mockImplementation(async (args: any) => {
      if (args.entityId === 'fidc/federation-a')
        throw new Error('config a: HTTP 500');
      return { ...args.entityData };
    });

    const response = await importAdminFederationProviders({
      importData: importData(),
      resultCallback: callback,
      state,
    });

    expect(response.map((p) => p._id)).toEqual(['b', 'c']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0].error.message).toBe(
      'Error importing admin federation provider a'
    );
    expect(messagesOf(outcomes[0].error)).toContain('config a: HTTP 500');
    expect(outcomes[1].result._id).toBe('b');
  });

  test('with a callback: a provider without a configuration in the import data is imported', async () => {
    const data = importData();
    delete data.config['fidc/federation-b'];

    const response = await importAdminFederationProviders({
      importData: data,
      resultCallback: callback,
      state,
    });

    expect(response.map((p) => p._id)).toEqual(['a', 'b', 'c']);
    expect(putConfigEntity).toHaveBeenCalledTimes(2);
    expect(outcomes.every((o) => !o.error)).toBe(true);
  });

  test('with a callback: every provider failing reports every provider, returns an empty result and does not throw', async () => {
    putProviderByTypeAndId.mockRejectedValue(new Error('HTTP 500'));

    const response = await importAdminFederationProviders({
      importData: importData(),
      resultCallback: callback,
      state,
    });

    expect(response).toEqual([]);
    expect(outcomes).toHaveLength(3);
    expect(outcomes.map((o) => o.error.message)).toEqual([
      'Error importing admin federation provider a',
      'Error importing admin federation provider b',
      'Error importing admin federation provider c',
    ]);
  });

  test('without a callback: the failures are thrown as one combined error after every provider was tried', async () => {
    failProviderB();

    const error: any = await importAdminFederationProviders({
      importData: importData(),
      state,
    }).catch((e) => e);

    // unchanged: the combined error with the error of the failed provider nested
    expect(error.message).toBe('Error importing admin federation providers');
    expect(error.originalErrors).toHaveLength(1);
    expect(messagesOf(error)).toContain('provider b: HTTP 500');
    expect(putProviderByTypeAndId).toHaveBeenCalledTimes(3);
  });

  test('the facade passes the callback on', async () => {
    await AdminFederationOps(state).importAdminFederationProviders(
      importData(),
      callback
    );

    expect(outcomes.map((o) => o.result?._id)).toEqual(['a', 'b', 'c']);
  });
});
