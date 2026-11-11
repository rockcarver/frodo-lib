import { jest } from '@jest/globals';

/**
 * `exportSaml2Providers` and `importSaml2Providers` try every provider.
 * Without a result callback the failures are collected and thrown as one
 * combined error; with one, every outcome is reported to it as it happens
 * (a failed provider as an error that names it), a failed provider does not
 * throw, and a failure to list the providers or to read the import data still
 * does. A provider that is not available in the cloud is skipped without a
 * word, but leaves a debug line.
 * Mocked unit test: no recordings.
 */

const getProviderStubs = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getProvider = jest.fn(async (_args?: any): Promise<any> => ({}));
const getProviderMetadata = jest.fn(
  async (_args?: any): Promise<any> => '<EntityDescriptor/>'
);
const createProvider = jest.fn(async (_args?: any): Promise<any> => ({}));
const updateProvider = jest.fn(async (_args?: any): Promise<any> => ({}));

const actualApi = await import('../api/Saml2Api');
jest.unstable_mockModule('../api/Saml2Api', () => ({
  ...actualApi,
  createProvider,
  getProvider,
  getProviderMetadata,
  getProviderStubs,
  updateProvider,
}));

const getScript = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualScriptApi = await import('../api/ScriptApi');
jest.unstable_mockModule('../api/ScriptApi', () => ({
  ...actualScriptApi,
  getScript,
}));

const updateScript = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualScriptOps = await import('./ScriptOps');
jest.unstable_mockModule('./ScriptOps', () => ({
  ...actualScriptOps,
  updateScript,
}));

const debugMessage = jest.fn();
const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage,
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

const actualExportImportUtils = await import('../utils/ExportImportUtils');
jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  ...actualExportImportUtils,
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const { exportSaml2Providers, importSaml2Providers } =
  await import('./Saml2Ops');
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

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

const SP1 = 'https://sp1.example.com';
const SP2 = 'https://sp2.example.com';
const SP3 = 'https://sp3.example.com';

/** the id of a provider is its base64url entity id */
const idOf = (entityId: string) => encode(entityId, false);

describe('exportSaml2Providers', () => {
  let failure: Error;

  /** three hosted providers; the first has an attribute mapper script */
  beforeEach(() => {
    failure = new Error('HTTP 500');
    getProviderStubs.mockReset();
    getProviderStubs.mockResolvedValue({
      result: [SP1, SP2, SP3].map((entityId) => ({
        _id: idOf(entityId),
        entityId,
        location: 'hosted',
      })),
    });
    getProvider.mockReset();
    getProvider.mockImplementation(async ({ entityId64 }: any) => {
      const entityId = [SP1, SP2, SP3].find((id) => idOf(id) === entityId64);
      return {
        _id: entityId64,
        entityId,
        identityProvider:
          entityId === SP1
            ? {
                assertionProcessing: {
                  attributeMapper: { attributeMapperScript: 'mapper-1' },
                },
              }
            : {},
      };
    });
    getProviderMetadata.mockReset();
    getProviderMetadata.mockImplementation(
      async ({ entityId }: any) => `<EntityDescriptor id="${entityId}"/>`
    );
    getScript.mockReset();
    getScript.mockImplementation(async ({ scriptId }: any) => ({
      _id: scriptId,
      script: Buffer.from('return 1;').toString('base64'),
    }));
    debugMessage.mockClear();
  });

  const failProvider = (entityId: string, error: Error = failure) =>
    getProvider.mockImplementation(async ({ entityId64 }: any) => {
      if (entityId64 === idOf(entityId)) throw error;
      return { _id: entityId64, entityId: 'other', identityProvider: {} };
    });

  test('exports every provider with its metadata and scripts, without a callback', async () => {
    const exported = await exportSaml2Providers({ state });

    expect(Object.keys(exported.saml.hosted)).toEqual([
      idOf(SP1),
      idOf(SP2),
      idOf(SP3),
    ]);
    expect(Object.keys(exported.saml.metadata)).toEqual([
      idOf(SP1),
      idOf(SP2),
      idOf(SP3),
    ]);
    expect(Object.keys(exported.script)).toEqual(['mapper-1']);
  });

  test('with a callback every provider is reported once, in order, as the provider that was read', async () => {
    const outcomes: any[] = [];

    const exported = await exportSaml2Providers({
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map(([, provider]) => provider.entityId)).toEqual([
      SP1,
      SP2,
      SP3,
    ]);
    // the object that is in the export
    expect(outcomes[0][1]).toBe(exported.saml.hosted[idOf(SP1)]);
  });

  test('with a callback a failed provider is reported with its name, the others are exported, nothing is thrown', async () => {
    failProvider(SP2);
    const outcomes: any[] = [];

    const exported = await exportSaml2Providers({
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][1].entityId).toBe('other');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      `Error exporting alpha realm saml2 provider ${idOf(SP2)}`
    );
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][1]).toBeDefined();
    // the partial result
    expect(Object.keys(exported.saml.hosted)).toEqual([idOf(SP1), idOf(SP3)]);
    expect(Object.keys(exported.saml.metadata)).toEqual([idOf(SP1), idOf(SP3)]);
  });

  test('with a callback every failure is reported once when all providers fail', async () => {
    getProvider.mockImplementation(async () => {
      throw failure;
    });
    const errors: any[] = [];
    const successes: any[] = [];

    const exported = await exportSaml2Providers({
      resultCallback: (error, provider) =>
        error ? errors.push(error) : successes.push(provider),
      state,
    });

    expect(successes).toEqual([]);
    expect(errors.map((error) => error.message)).toEqual([
      `Error exporting alpha realm saml2 provider ${idOf(SP1)}`,
      `Error exporting alpha realm saml2 provider ${idOf(SP2)}`,
      `Error exporting alpha realm saml2 provider ${idOf(SP3)}`,
    ]);
    expect(exported.saml.hosted).toEqual({});
  });

  test('without a callback every provider is tried and the failures are thrown as one combined error', async () => {
    failProvider(SP2);

    const error: any = await exportSaml2Providers({ state }).catch((e) => e);

    expect(error.message).toBe('Error exporting alpha realm saml2 providers');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      `Error exporting alpha realm saml2 provider ${idOf(SP2)}`
    );
    expect(rootCause(error)).toBe(failure);
    // every provider was read
    expect(getProvider).toHaveBeenCalledTimes(3);
  });

  test('a provider whose script cannot be read is a failed provider that leaves nothing in the export', async () => {
    getScript.mockRejectedValue(new Error('HTTP 404'));
    const outcomes: any[] = [];

    const exported = await exportSaml2Providers({
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][1]).toBeUndefined();
    expect(outcomes[0][0].message).toBe(
      `Error exporting alpha realm saml2 provider ${idOf(SP1)}`
    );
    expect(messagesOf(outcomes[0][0])).toContain('HTTP 404');
    expect(Object.keys(exported.saml.hosted)).toEqual([idOf(SP2), idOf(SP3)]);
    expect(Object.keys(exported.saml.metadata)).toEqual([idOf(SP2), idOf(SP3)]);
    expect(exported.script).toEqual({});
  });

  test('without a callback the error of a script is collected as it was: not wrapped by the provider', async () => {
    getScript.mockRejectedValue(new Error('HTTP 404'));

    const error: any = await exportSaml2Providers({ state }).catch((e) => e);

    expect(error.message).toBe('Error exporting alpha realm saml2 providers');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error exporting alpha realm saml2 dependencies'
    );
  });

  test('a provider whose metadata cannot be read is a failed provider', async () => {
    getProviderMetadata.mockImplementation(async ({ entityId }: any) => {
      if (entityId === SP3) return undefined;
      return '<EntityDescriptor/>';
    });
    const outcomes: any[] = [];

    const exported = await exportSaml2Providers({
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(outcomes[2][1]).toBeUndefined();
    expect(outcomes[2][0].message).toBe(
      `Error exporting alpha realm saml2 provider ${idOf(SP3)}`
    );
    expect(Object.keys(exported.saml.hosted)).toEqual([idOf(SP1), idOf(SP2)]);
  });

  test('a failure to list the providers still throws, with and without a callback', async () => {
    getProviderStubs.mockRejectedValue(new Error('HTTP 500'));
    const callback = jest.fn();

    const withCallback: any = await exportSaml2Providers({
      resultCallback: callback,
      state,
    }).catch((e) => e);
    const without: any = await exportSaml2Providers({ state }).catch((e) => e);

    expect(withCallback.message).toBe(
      'Error exporting alpha realm saml2 providers'
    );
    expect(without.message).toBe('Error exporting alpha realm saml2 providers');
    expect(callback).not.toHaveBeenCalled();
  });

  test('a provider that is not available in the cloud is skipped without a word and leaves a debug line', async () => {
    const notAvailable: any = new Error('HTTP 403');
    notAvailable.httpStatus = 403;
    notAvailable.httpMessage =
      'This operation is not available in PingOne Advanced Identity Cloud.';
    failProvider(SP2, notAvailable);
    const outcomes: any[] = [];

    const exported = await exportSaml2Providers({
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });
    // and without a callback it does not throw either
    const withoutCallback = await exportSaml2Providers({ state });

    expect(outcomes).toHaveLength(2);
    expect(outcomes.every(([error]) => error === undefined)).toBe(true);
    expect(Object.keys(exported.saml.hosted)).toEqual([idOf(SP1), idOf(SP3)]);
    expect(Object.keys(withoutCallback.saml.hosted)).toEqual([
      idOf(SP1),
      idOf(SP3),
    ]);
    const lines = debugMessage.mock.calls
      .map(([arg]: any) => arg.message)
      .filter((message: string) => message.includes('not available'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Saml2Ops.exportSaml2Providers');
    expect(lines[0]).toContain(idOf(SP2));
  });

  test('an exception of the callback is not reported to the callback as a failed provider', async () => {
    const callback = jest.fn((_error?: any, _provider?: any) => {
      throw new Error('callback bug');
    });

    const error: any = await exportSaml2Providers({
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error exporting alpha realm saml2 providers');
    expect(rootCause(error).message).toBe('callback bug');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
  });

  test('does not read the scripts when the dependencies are not asked for', async () => {
    const exported = await exportSaml2Providers({
      options: { deps: false },
      state,
    });

    expect(getScript).not.toHaveBeenCalled();
    expect(Object.keys(exported.saml.hosted)).toHaveLength(3);
  });
});

describe('importSaml2Providers', () => {
  let createFailure: Error;

  /** three hosted providers; the first has an attribute mapper script that is in the file */
  const importData = (): any => ({
    saml: {
      hosted: {
        [idOf(SP1)]: {
          entityId: SP1,
          identityProvider: {
            assertionProcessing: {
              attributeMapper: { attributeMapperScript: 'mapper-1' },
            },
          },
        },
        [idOf(SP2)]: { entityId: SP2 },
        [idOf(SP3)]: { entityId: SP3 },
      },
      remote: {},
      metadata: {},
    },
    script: { 'mapper-1': { _id: 'mapper-1', script: ['return 1;'] } },
  });

  beforeEach(() => {
    createFailure = new Error('create: HTTP 400');
    createProvider.mockReset();
    createProvider.mockImplementation(async ({ providerData }: any) => ({
      ...providerData,
      created: true,
    }));
    updateProvider.mockReset();
    updateProvider.mockImplementation(async ({ providerData }: any) => ({
      ...providerData,
      updated: true,
    }));
    updateScript.mockReset();
    updateScript.mockImplementation(async () => ({}));
    debugMessage.mockClear();
  });

  /** the provider can be neither created nor updated */
  const failProvider = (entityId: string) => {
    createProvider.mockImplementation(async ({ providerData }: any) => {
      if (providerData.entityId === entityId) throw createFailure;
      return { ...providerData, created: true };
    });
    updateProvider.mockImplementation(async ({ providerData }: any) => {
      if (providerData.entityId === entityId) throw new Error('update: 404');
      return { ...providerData, updated: true };
    });
  };

  test('imports every provider without a callback', async () => {
    const response = await importSaml2Providers({
      importData: importData(),
      state,
    });

    expect(response.map((provider: any) => provider.entityId)).toEqual([
      SP1,
      SP2,
      SP3,
    ]);
  });

  test('with a callback every provider is reported once, in order, as the provider that was written', async () => {
    const outcomes: any[] = [];

    const response = await importSaml2Providers({
      importData: importData(),
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(outcomes.map(([, provider]) => provider.entityId)).toEqual([
      SP1,
      SP2,
      SP3,
    ]);
    expect(outcomes.every(([, provider]) => provider.created)).toBe(true);
    expect(response).toHaveLength(3);
    expect(response[1]).toBe(outcomes[1][1]);
  });

  test('a provider that exists is updated and reported once, as the updated provider', async () => {
    createProvider.mockImplementation(async ({ providerData }: any) => {
      if (providerData.entityId === SP2) throw new Error('create: HTTP 409');
      return { ...providerData, created: true };
    });
    const outcomes: any[] = [];

    await importSaml2Providers({
      importData: importData(),
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes[1][0]).toBeUndefined();
    expect(outcomes[1][1].updated).toBe(true);
  });

  test('with a callback a failed provider is reported with its entity id, the others are imported, nothing is thrown', async () => {
    failProvider(SP2);
    const outcomes: any[] = [];

    const response = await importSaml2Providers({
      importData: importData(),
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][1].entityId).toBe(SP1);
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      `Error importing alpha realm saml2 provider ${SP2}`
    );
    expect(messagesOf(outcomes[1][0])).toContain('create: HTTP 400');
    expect(messagesOf(outcomes[1][0])).toContain('update: 404');
    expect(outcomes[2][1].entityId).toBe(SP3);
    expect(response.map((provider: any) => provider.entityId)).toEqual([
      SP1,
      SP3,
    ]);
  });

  test('with a callback every failure is reported once when all providers fail', async () => {
    createProvider.mockRejectedValue(createFailure);
    updateProvider.mockRejectedValue(new Error('update: 404'));
    const errors: any[] = [];
    const successes: any[] = [];

    const response = await importSaml2Providers({
      importData: importData(),
      resultCallback: (error, provider) =>
        error ? errors.push(error) : successes.push(provider),
      state,
    });

    expect(successes).toEqual([]);
    expect(errors.map((error) => error.message)).toEqual([
      `Error importing alpha realm saml2 provider ${SP1}`,
      `Error importing alpha realm saml2 provider ${SP2}`,
      `Error importing alpha realm saml2 provider ${SP3}`,
    ]);
    expect(response).toEqual([]);
  });

  test('without a callback every provider is tried and the failures are thrown as one combined error', async () => {
    failProvider(SP2);

    const error: any = await importSaml2Providers({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm saml2 providers');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      `Error creating or updating alpha realm saml2 provider ${SP2}`
    );
    // every provider was tried
    expect(createProvider).toHaveBeenCalledTimes(3);
  });

  test('a provider whose script cannot be imported is a failed provider, although the provider is written', async () => {
    updateScript.mockRejectedValue(new Error('script: HTTP 500'));
    const outcomes: any[] = [];

    const response = await importSaml2Providers({
      importData: importData(),
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][1]).toBeUndefined();
    expect(outcomes[0][0].message).toBe(
      `Error importing alpha realm saml2 provider ${SP1}`
    );
    expect(messagesOf(outcomes[0][0])).toContain('script: HTTP 500');
    // the provider was written all the same
    expect(createProvider).toHaveBeenCalledTimes(3);
    // and is not reported twice nor returned
    expect(response.map((provider: any) => provider.entityId)).toEqual([
      SP2,
      SP3,
    ]);
  });

  test('without a callback the error of a script is collected as it was', async () => {
    updateScript.mockRejectedValue(new Error('script: HTTP 500'));

    const error: any = await importSaml2Providers({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm saml2 providers');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      `Error importing alpha realm saml2 provider ${SP1} dependencies`
    );
  });

  test('a provider with a failing script and a failing write is one failed provider with both reasons', async () => {
    updateScript.mockRejectedValue(new Error('script: HTTP 500'));
    failProvider(SP1);
    const outcomes: any[] = [];

    await importSaml2Providers({
      importData: importData(),
      resultCallback: (error, provider) => outcomes.push([error, provider]),
      state,
    });

    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0].originalErrors).toHaveLength(2);
    expect(messagesOf(outcomes[0][0])).toContain('script: HTTP 500');
    expect(messagesOf(outcomes[0][0])).toContain('create: HTTP 400');
  });

  test('without a callback a provider with a failing script and a failing write adds both errors, as before', async () => {
    updateScript.mockRejectedValue(new Error('script: HTTP 500'));
    failProvider(SP1);

    const error: any = await importSaml2Providers({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      `Error importing alpha realm saml2 provider ${SP1} dependencies`,
      `Error creating or updating alpha realm saml2 provider ${SP1}`,
    ]);
  });

  describe('remote providers', () => {
    const remoteData = (withMetadata: boolean): any => ({
      saml: {
        hosted: {},
        remote: {
          [idOf(SP1)]: { entityId: SP1 },
          [idOf(SP2)]: { entityId: SP2 },
        },
        metadata: withMetadata
          ? { [idOf(SP1)]: ['<xml/>'], [idOf(SP2)]: ['<xml/>'] }
          : { [idOf(SP1)]: ['<xml/>'] },
      },
      script: {},
    });

    test('a remote provider is created from its metadata and updated, and reported once as both', async () => {
      const outcomes: any[] = [];

      await importSaml2Providers({
        importData: remoteData(true),
        resultCallback: (error, provider) => outcomes.push([error, provider]),
        state,
      });

      expect(outcomes).toHaveLength(2);
      expect(outcomes[0][1].created).toBe(true);
      expect(outcomes[0][1].updated).toBe(true);
    });

    test('a remote provider without metadata in the file is a failed provider with a callback, and the others are imported', async () => {
      const outcomes: any[] = [];

      const response = await importSaml2Providers({
        importData: remoteData(false),
        resultCallback: (error, provider) => outcomes.push([error, provider]),
        state,
      });

      expect(outcomes).toHaveLength(2);
      expect(outcomes[0][1].entityId).toBe(SP1);
      expect(outcomes[1][1]).toBeUndefined();
      expect(outcomes[1][0].message).toBe(
        `Error importing alpha realm saml2 provider ${SP2}`
      );
      expect(messagesOf(outcomes[1][0])).toContain(
        `the metadata of alpha realm saml2 provider ${SP2}`
      );
      // it was never written
      expect(createProvider).toHaveBeenCalledTimes(1);
      expect(response).toHaveLength(1);
    });

    test('without a callback a remote provider without metadata ends the import as before', async () => {
      const error: any = await importSaml2Providers({
        importData: remoteData(false),
        state,
      }).catch((e) => e);

      expect(error.message).toBe('Error importing alpha realm saml2 providers');
      expect(error.originalErrors).toHaveLength(1);
      expect(error.originalErrors[0]).toBeInstanceOf(TypeError);
    });
  });

  test('import data that cannot be read still throws, with and without a callback', async () => {
    const callback = jest.fn();

    const withCallback: any = await importSaml2Providers({
      importData: {} as any,
      resultCallback: callback,
      state,
    }).catch((e) => e);
    const without: any = await importSaml2Providers({
      importData: {} as any,
      state,
    }).catch((e) => e);

    expect(withCallback.message).toBe(
      'Error importing alpha realm saml2 providers'
    );
    expect(without.message).toBe('Error importing alpha realm saml2 providers');
    expect(callback).not.toHaveBeenCalled();
  });

  test('an exception of the callback is not reported to the callback as a failed provider', async () => {
    const callback = jest.fn((_error?: any, _provider?: any) => {
      throw new Error('callback bug');
    });

    const error: any = await importSaml2Providers({
      importData: importData(),
      resultCallback: callback,
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing alpha realm saml2 providers');
    expect(rootCause(error).message).toBe('callback bug');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
  });
});

describe('the facade', () => {
  test('exportSaml2Providers and importSaml2Providers pass the callback on', async () => {
    const { default: Saml2 } = await import('./Saml2Ops');
    const facade = Saml2(state);
    getProviderStubs.mockResolvedValue({
      result: [{ _id: idOf(SP1), entityId: SP1, location: 'hosted' }],
    });
    getProvider.mockResolvedValue({ _id: idOf(SP1), entityId: SP1 });
    createProvider.mockImplementation(async ({ providerData }: any) => ({
      ...providerData,
    }));
    const exported: any[] = [];
    const imported: any[] = [];

    await facade.exportSaml2Providers({ deps: false }, (error, provider) =>
      exported.push([error, provider])
    );
    await facade.importSaml2Providers(
      {
        saml: {
          hosted: { [idOf(SP1)]: { entityId: SP1 } },
          remote: {},
          metadata: {},
        },
        script: {},
      } as any,
      { deps: false },
      (error, provider) => imported.push([error, provider])
    );

    expect(exported).toHaveLength(1);
    expect(exported[0][1].entityId).toBe(SP1);
    expect(imported).toHaveLength(1);
    expect(imported[0][1].entityId).toBe(SP1);
  });
});
