import { jest } from '@jest/globals';
import { FrodoError } from './FrodoError';

const createProviderMock = jest.fn(async (_args?: any): Promise<any> => ({
  _id: 'created',
}));
const updateProviderMock = jest.fn(async (_args?: any): Promise<any> => ({
  _id: 'updated',
}));
const getScriptMock = jest.fn(async (_args?: any): Promise<any> => ({
  _id: 'script',
}));

jest.unstable_mockModule('../api/Saml2Api', () => ({
  createProvider: createProviderMock,
  deleteProvider: jest.fn(),
  getProvider: jest.fn(),
  getProviderMetadata: jest.fn(),
  getProviderMetadataUrl: jest.fn(),
  getProviderStubs: jest.fn(),
  queryProviderStubs: jest.fn(),
  updateProvider: updateProviderMock,
}));

jest.unstable_mockModule('../api/ScriptApi', () => ({
  deleteScript: jest.fn(),
  deleteScriptByName: jest.fn(),
  getLibraryScriptConfigByName: jest.fn(),
  getScript: getScriptMock,
  getScriptByName: jest.fn(),
  getScripts: jest.fn(),
  putScript: jest.fn(),
}));

const { importSaml2Provider, importSaml2Providers } =
  await import('./Saml2Ops');

function mockState() {
  return {
    getRealm: () => '/alpha',
    getDebugHandler: () => undefined,
  } as any;
}

function errorWithStatus(status: number) {
  const error: any = new Error(`HTTP ${status}`);
  error.name = 'AxiosError';
  error.response = { status };
  return error;
}

// remote provider skeleton: metadata imported via _action=importEntity, the
// remainder of the configuration applied by a subsequent update
function remoteImportData(entityId: string) {
  const entityId64 = Buffer.from(entityId).toString('base64url');
  return {
    script: {},
    saml: {
      hosted: {},
      remote: {
        [entityId64]: {
          _id: entityId64,
          entityId,
          entityLocation: 'remote',
          serviceProvider: {},
          identityProvider: {},
          attributeQueryProvider: {},
          xacmlPolicyEnforcementPoint: {},
        },
      },
      metadata: { [entityId64]: ['<xml/>'] },
    },
  } as any;
}

function hostedImportData(entityId: string) {
  const entityId64 = Buffer.from(entityId).toString('base64url');
  return {
    script: {},
    saml: {
      hosted: {
        [entityId64]: {
          _id: entityId64,
          entityId,
          entityLocation: 'hosted',
          serviceProvider: {},
          identityProvider: {},
          attributeQueryProvider: {},
          xacmlPolicyEnforcementPoint: {},
        },
      },
      remote: {},
      metadata: {},
    },
  } as any;
}

describe('importSaml2Provider', () => {
  beforeEach(() => {
    createProviderMock.mockReset();
    updateProviderMock.mockReset();
    createProviderMock.mockResolvedValue({ _id: 'created' });
    updateProviderMock.mockResolvedValue({ _id: 'updated' });
  });

  test('remote: updates the provider after successful creation', async () => {
    const result = await importSaml2Provider({
      entityId: 'idp',
      importData: remoteImportData('idp'),
      state: mockState(),
    });

    expect(createProviderMock).toHaveBeenCalledTimes(1);
    expect(updateProviderMock).toHaveBeenCalledTimes(1);
    // merged create + update responses
    expect(result).toEqual({ _id: 'updated' });
  });

  test('remote: falls back to update when creation fails', async () => {
    createProviderMock.mockRejectedValue(errorWithStatus(400));

    const result = await importSaml2Provider({
      entityId: 'idp',
      importData: remoteImportData('idp'),
      state: mockState(),
    });

    expect(createProviderMock).toHaveBeenCalledTimes(1);
    expect(updateProviderMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ _id: 'updated' });
  });

  test('hosted: does not update after successful creation', async () => {
    await importSaml2Provider({
      entityId: 'sp',
      importData: hostedImportData('sp'),
      state: mockState(),
    });

    expect(createProviderMock).toHaveBeenCalledTimes(1);
    expect(updateProviderMock).not.toHaveBeenCalled();
  });

  test('hosted: falls back to update when creation fails', async () => {
    createProviderMock.mockRejectedValue(errorWithStatus(400));

    const result = await importSaml2Provider({
      entityId: 'sp',
      importData: hostedImportData('sp'),
      state: mockState(),
    });

    expect(createProviderMock).toHaveBeenCalledTimes(1);
    expect(updateProviderMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ _id: 'updated' });
  });

  test('reports both create and update errors when both fail', async () => {
    const createError = errorWithStatus(400);
    const updateError = errorWithStatus(409);
    createProviderMock.mockRejectedValue(createError);
    updateProviderMock.mockRejectedValue(updateError);

    const promise = importSaml2Provider({
      entityId: 'sp',
      importData: hostedImportData('sp'),
      state: mockState(),
    });

    await expect(promise).rejects.toThrow(FrodoError);

    try {
      await importSaml2Provider({
        entityId: 'sp',
        importData: hostedImportData('sp'),
        state: mockState(),
      });
    } catch (error) {
      const frodoError = error as FrodoError;
      // the outer catch re-wraps: outer error -> per-provider error -> both http errors
      expect(frodoError.originalErrors).toHaveLength(1);
      const providerError = frodoError.originalErrors[0] as FrodoError;
      expect(providerError.originalErrors).toHaveLength(2);
      expect(providerError.originalErrors[0]).toBe(createError);
      expect(providerError.originalErrors[1]).toBe(updateError);
      expect(providerError.httpStatus).toBe(400);
      expect(frodoError.getCombinedMessage()).toContain('Network error:');
    }
  });
});

describe('importSaml2Providers', () => {
  beforeEach(() => {
    createProviderMock.mockReset();
    updateProviderMock.mockReset();
    createProviderMock.mockResolvedValue({ _id: 'created' });
    updateProviderMock.mockResolvedValue({ _id: 'updated' });
  });

  test('remote: updates the provider after successful creation', async () => {
    const result = await importSaml2Providers({
      importData: remoteImportData('idp'),
      state: mockState(),
    });

    expect(createProviderMock).toHaveBeenCalledTimes(1);
    expect(updateProviderMock).toHaveBeenCalledTimes(1);
    // merged create + update responses
    expect(result).toEqual([{ _id: 'updated' }]);
  });

  test('remote: falls back to update when creation fails', async () => {
    createProviderMock.mockRejectedValue(errorWithStatus(400));

    const result = await importSaml2Providers({
      importData: remoteImportData('idp'),
      state: mockState(),
    });

    expect(createProviderMock).toHaveBeenCalledTimes(1);
    expect(updateProviderMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ _id: 'updated' }]);
  });

  test('hosted: does not update after successful creation', async () => {
    const result = await importSaml2Providers({
      importData: hostedImportData('sp'),
      state: mockState(),
    });

    expect(createProviderMock).toHaveBeenCalledTimes(1);
    expect(updateProviderMock).not.toHaveBeenCalled();
    expect(result).toEqual([{ _id: 'created' }]);
  });

  test('reports both create and update errors when both fail', async () => {
    const createError = errorWithStatus(400);
    const updateError = errorWithStatus(409);
    createProviderMock.mockRejectedValue(createError);
    updateProviderMock.mockRejectedValue(updateError);

    const promise = importSaml2Providers({
      importData: hostedImportData('sp'),
      state: mockState(),
    });

    await expect(promise).rejects.toThrow(FrodoError);

    try {
      await importSaml2Providers({
        importData: hostedImportData('sp'),
        state: mockState(),
      });
    } catch (error) {
      const frodoError = error as FrodoError;
      // outer error wraps one per-provider error, which wraps both
      expect(frodoError.originalErrors).toHaveLength(1);
      const providerError = frodoError.originalErrors[0] as FrodoError;
      expect(providerError.originalErrors).toHaveLength(2);
      expect(providerError.originalErrors[0]).toBe(createError);
      expect(providerError.originalErrors[1]).toBe(updateError);
    }
  });
});
