import { jest } from '@jest/globals';
import { FrodoError, isNotFoundError } from './FrodoError';

const getOAuth2TrustedJwtIssuers = jest.fn(
  async (_args?: any): Promise<any> => ({ result: [] })
);
const deleteOAuth2TrustedJwtIssuerApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);

jest.unstable_mockModule('../api/OAuth2TrustedJwtIssuerApi', () => ({
  deleteOAuth2TrustedJwtIssuer: deleteOAuth2TrustedJwtIssuerApi,
  getOAuth2TrustedJwtIssuer: jest.fn(),
  getOAuth2TrustedJwtIssuers,
  putOAuth2TrustedJwtIssuer: jest.fn(),
}));

const { deleteOAuth2TrustedJwtIssuer, deleteOAuth2TrustedJwtIssuers } =
  await import('./OAuth2TrustedJwtIssuerOps');

function mockState({ realm = 'alpha', deployment = 'cloud' } = {}) {
  return {
    getRealm: () => realm,
    getHost: () => 'https://openam-matrix.example.com/am',
    getDebugHandler: () => undefined,
    getDeploymentType: () => deployment,
    getAuthMode: () => 'noninteractive',
    getUseBearerTokenForAmApis: () => false,
  } as any;
}

// What the api layer rejects with when a request fails: a request error that
// carries the response of the server.
function requestError(status: number, message: string) {
  return { response: { status, data: { message } } };
}

beforeEach(() => {
  deleteOAuth2TrustedJwtIssuerApi.mockReset();
  getOAuth2TrustedJwtIssuers.mockReset();
});

describe('deleteOAuth2TrustedJwtIssuer', () => {
  test('returns what the api layer returns', async () => {
    const deleted = { _id: 'matrix-issuer', issuer: 'https://idp.example.com' };
    deleteOAuth2TrustedJwtIssuerApi.mockResolvedValue(deleted);

    await expect(
      deleteOAuth2TrustedJwtIssuer({
        issuerId: 'matrix-issuer',
        state: mockState(),
      })
    ).resolves.toBe(deleted);
    expect(deleteOAuth2TrustedJwtIssuerApi).toHaveBeenCalledWith({
      id: 'matrix-issuer',
      state: expect.anything(),
    });
  });

  test('a failed delete rejects with a FrodoError that names the realm and the issuer and keeps the cause', async () => {
    const failure = requestError(404, 'Not Found');
    deleteOAuth2TrustedJwtIssuerApi.mockRejectedValue(failure);

    const error: FrodoError = await deleteOAuth2TrustedJwtIssuer({
      issuerId: 'matrix-issuer',
      state: mockState({ realm: 'alpha' }),
    }).then(
      () => {
        throw new Error('expected a rejection');
      },
      (e) => e
    );

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      'Error deleting alpha realm trusted issuer matrix-issuer'
    );
    expect(error.originalErrors[0]).toBe(failure);
    expect(error.httpStatus).toBe(404);
    expect(isNotFoundError(error)).toBe(true);
  });

  test('the message names the realm of the state', async () => {
    deleteOAuth2TrustedJwtIssuerApi.mockRejectedValue(
      requestError(500, 'Server Error')
    );
    await expect(
      deleteOAuth2TrustedJwtIssuer({
        issuerId: 'zion-issuer',
        state: mockState({ realm: '/', deployment: 'forgeops' }),
      })
    ).rejects.toThrow('Error deleting / realm trusted issuer zion-issuer');
  });
});

describe('deleteOAuth2TrustedJwtIssuers', () => {
  test('one failing delete of two: the error names the failed issuer, the other one is deleted', async () => {
    const first = { _id: 'matrix-one' };
    const second = { _id: 'matrix-two' };
    getOAuth2TrustedJwtIssuers.mockResolvedValue({ result: [first, second] });
    const failure = requestError(500, 'Server Error');
    deleteOAuth2TrustedJwtIssuerApi.mockImplementation(
      async ({ id }: { id: string }) => {
        if (id === 'matrix-one') throw failure;
        return { _id: id };
      }
    );

    const error: FrodoError = await deleteOAuth2TrustedJwtIssuers({
      state: mockState(),
    }).then(
      () => {
        throw new Error('expected a rejection');
      },
      (e) => e
    );

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting alpha realm trusted issuers');
    expect(error.originalErrors).toHaveLength(1);
    const nested = error.originalErrors[0] as FrodoError;
    expect(nested).toBeInstanceOf(FrodoError);
    expect(nested.message).toBe(
      'Error deleting alpha realm trusted issuer matrix-one'
    );
    expect(nested.originalErrors[0]).toBe(failure);
    // The delete went on after the failure.
    expect(deleteOAuth2TrustedJwtIssuerApi).toHaveBeenCalledTimes(2);
  });

  test('deletes every issuer and returns them when nothing fails', async () => {
    getOAuth2TrustedJwtIssuers.mockResolvedValue({
      result: [{ _id: 'matrix-one' }, { _id: 'matrix-two' }],
    });
    deleteOAuth2TrustedJwtIssuerApi.mockImplementation(
      async ({ id }: { id: string }) => ({ _id: id })
    );

    await expect(
      deleteOAuth2TrustedJwtIssuers({ state: mockState() })
    ).resolves.toEqual([{ _id: 'matrix-one' }, { _id: 'matrix-two' }]);
  });
});
