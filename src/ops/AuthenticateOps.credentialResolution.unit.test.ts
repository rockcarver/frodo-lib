import { jest } from '@jest/globals';

const getConnectionProfile = jest.fn(async (_args?: any): Promise<any> => ({}));
const loadConnectionProfile = jest.fn(async (_args?: any): Promise<any> => false);
const saveConnectionProfile = jest.fn(async (_args?: any): Promise<any> => true);

jest.unstable_mockModule('./ConnectionProfileOps', () => ({
  getConnectionProfile,
  loadConnectionProfile,
  saveConnectionProfile,
}));

const NETWORK_SENTINEL = new Error(
  'network layer reached — sentinel, not a real failure'
);
const getServerInfo = jest.fn(async (_args?: any): Promise<any> => {
  throw NETWORK_SENTINEL;
});

jest.unstable_mockModule('../api/ServerInfoApi', () => ({
  getServerInfo,
  getServerVersionInfo: jest.fn(),
  getIdmServerVersionInfo: jest.fn(),
}));

const { getTokens } = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');
const { FrodoError } = await import('./FrodoError');

/**
 * getTokens wraps every thrown error in an outer `Error getting tokens`
 * FrodoError, so assertions on the specific underlying cause need to unwrap
 * `originalErrors[0]` rather than matching the outer error directly.
 */
async function getUnderlyingError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof FrodoError && error.originalErrors.length > 0) {
      return error.originalErrors[0];
    }
    return error as Error;
  }
  throw new Error('Expected promise to reject, but it resolved.');
}

describe('AuthenticateOps username-only credential resolution', () => {
  beforeEach(() => {
    getConnectionProfile.mockReset();
    loadConnectionProfile.mockReset();
    loadConnectionProfile.mockResolvedValue(false);
    getServerInfo.mockReset();
    getServerInfo.mockRejectedValue(NETWORK_SENTINEL);
  });

  test('resolves the stored password when the given username matches the connection profile', async () => {
    getConnectionProfile.mockResolvedValue({
      username: 'svc-account',
      password: 'stored-secret',
    });
    const state = StateImpl({
      host: 'https://openam-example.forgeblocks.com/am',
      username: 'svc-account',
    });

    // Past credential resolution, getTokens proceeds into real network calls —
    // the mocked getServerInfo sentinel proves execution got that far.
    const underlying = await getUnderlyingError(getTokens({ state }));
    expect(underlying).toBe(NETWORK_SENTINEL);

    expect(getConnectionProfile).toHaveBeenCalledWith(
      expect.objectContaining({ state })
    );
    expect(state.getPassword()).toBe('stored-secret');
    expect(state.getUsername()).toBe('svc-account');
  });

  test('throws rather than silently proceeding when the given username does not match the stored profile', async () => {
    getConnectionProfile.mockResolvedValue({
      username: 'someone-else',
      password: 'stored-secret',
    });
    const state = StateImpl({
      host: 'https://openam-example.forgeblocks.com/am',
      username: 'svc-account',
    });

    const underlying = await getUnderlyingError(getTokens({ state }));
    expect(underlying.message).toMatch(
      /No stored password found for username 'svc-account'/
    );
    expect(state.getPassword()).toBeFalsy();
    expect(getServerInfo).not.toHaveBeenCalled();
  });

  test('throws rather than silently proceeding when no connection profile has a stored password at all', async () => {
    getConnectionProfile.mockResolvedValue({
      username: 'svc-account',
      password: null,
    });
    const state = StateImpl({
      host: 'https://openam-example.forgeblocks.com/am',
      username: 'svc-account',
    });

    const underlying = await getUnderlyingError(getTokens({ state }));
    expect(underlying.message).toMatch(
      /No stored password found for username 'svc-account'/
    );
    expect(getServerInfo).not.toHaveBeenCalled();
  });

  test('does not attempt profile resolution when both username and password are already provided', async () => {
    const state = StateImpl({
      host: 'https://openam-example.forgeblocks.com/am',
      username: 'svc-account',
      password: 'explicit-password',
    });

    const underlying = await getUnderlyingError(getTokens({ state }));
    expect(underlying).toBe(NETWORK_SENTINEL);

    expect(getConnectionProfile).not.toHaveBeenCalled();
    expect(loadConnectionProfile).not.toHaveBeenCalled();
    expect(state.getPassword()).toBe('explicit-password');
  });
});
