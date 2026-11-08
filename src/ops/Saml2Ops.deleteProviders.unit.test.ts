import { jest } from '@jest/globals';

const deleteProviderMock = jest.fn(async (_args?: any): Promise<any> => ({}));
const getProviderStubsMock = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));

jest.unstable_mockModule('../api/Saml2Api', () => ({
  createProvider: jest.fn(),
  deleteProvider: deleteProviderMock,
  getProvider: jest.fn(),
  getProviderMetadata: jest.fn(),
  getProviderMetadataUrl: jest.fn(),
  getProviderStubs: getProviderStubsMock,
  queryProviderStubs: jest.fn(),
  updateProvider: jest.fn(),
}));

const { deleteSaml2Providers } = await import('./Saml2Ops');
const { FrodoError } = await import('./FrodoError');

const state = {
  getRealm: () => '/alpha',
  getDebugHandler: () => undefined,
} as any;

const entity64 = (entityId: string) =>
  Buffer.from(entityId).toString('base64url');

const stubs = [
  'https://idp-a.example.com',
  'https://idp-b.example.com',
  'https://idp-c.example.com',
].map((entityId) => ({
  _id: entity64(entityId),
  entityId,
  location: 'remote',
  roles: [],
}));

beforeEach(() => {
  jest.clearAllMocks();
  getProviderStubsMock.mockResolvedValue({ result: stubs });
  deleteProviderMock.mockImplementation(async ({ entityId64 }: any) => ({
    _id: entityId64,
  }));
});

describe('deleteSaml2Providers', () => {
  test('returns every deleted provider when all deletes succeed', async () => {
    const deleted = await deleteSaml2Providers({ state });

    expect(deleted.map((p: any) => p._id)).toEqual(stubs.map((s) => s._id));
    expect(deleteProviderMock).toHaveBeenCalledTimes(3);
  });

  test('tries every provider after one fails and throws one error that names the failed one', async () => {
    const cause = Object.assign(
      new Error('Request failed with status code 500'),
      {
        name: 'AxiosError',
      }
    );
    deleteProviderMock.mockImplementation(async ({ entityId64 }: any) => {
      if (entityId64 === stubs[1]._id) throw cause;
      return { _id: entityId64 };
    });

    let thrown: any;
    try {
      await deleteSaml2Providers({ state });
    } catch (error) {
      thrown = error;
    }

    // the third provider is still tried after the second failed
    expect(
      deleteProviderMock.mock.calls.map(([args]: any) => args.entityId64)
    ).toEqual(stubs.map((s) => s._id));
    expect(thrown).toBeInstanceOf(FrodoError);
    expect(thrown.message).toBe('Error deleting alpha realm saml2 providers');
    // one nested error per failed provider, naming it and keeping its cause
    expect(thrown.originalErrors).toHaveLength(1);
    expect(thrown.originalErrors[0]).toBeInstanceOf(FrodoError);
    expect(thrown.originalErrors[0].message).toBe(
      `Error deleting alpha realm saml2 provider ${stubs[1].entityId}`
    );
    expect(thrown.originalErrors[0].originalErrors).toEqual([cause]);
  });

  test('names every failed provider when several fail', async () => {
    deleteProviderMock.mockImplementation(async ({ entityId64 }: any) => {
      if (entityId64 !== stubs[1]._id) throw new Error(`failed ${entityId64}`);
      return { _id: entityId64 };
    });

    const thrown: any = await deleteSaml2Providers({ state }).catch((e) => e);

    expect(deleteProviderMock).toHaveBeenCalledTimes(3);
    expect(thrown.originalErrors.map((e: any) => e.message)).toEqual([
      `Error deleting alpha realm saml2 provider ${stubs[0].entityId}`,
      `Error deleting alpha realm saml2 provider ${stubs[2].entityId}`,
    ]);
  });

  test('throws one error and deletes nothing when the providers cannot be read', async () => {
    const cause = new Error('Request failed with status code 500');
    getProviderStubsMock.mockRejectedValue(cause);

    const thrown: any = await deleteSaml2Providers({ state }).catch((e) => e);

    expect(deleteProviderMock).not.toHaveBeenCalled();
    expect(thrown).toBeInstanceOf(FrodoError);
    expect(thrown.message).toBe('Error deleting alpha realm saml2 providers');
    expect(thrown.originalErrors).toHaveLength(1);
    expect(thrown.originalErrors[0].message).toBe(
      'Error reading alpha realm saml2 provider stubs'
    );
  });
});
