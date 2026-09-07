/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent AuthenticateOps.serviceAccountSubject
 *
 * Regression coverage for `getSaBearerToken()`'s subject resolution: a
 * service-account bearer token used to always show 'unknown' in
 * `frodo session list`, since only browser-login entries had a subject
 * side-index. Fixed by resolving the service account's real name via IDM
 * (`getServiceAccount()`, the same lookup `getLoggedInSubject()` already
 * used for the non-interactive login's own printed message) and recording
 * it — but only for a freshly-acquired token, never a cache-hit re-save,
 * since `getSaBearerToken()` re-saves on every call and re-resolving on
 * every cache hit would add a network call to a path that's supposed to
 * stay cheap on repeat.
 */
import { jest } from '@jest/globals';

const getServiceAccount = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('getServiceAccount mock not configured');
});

jest.unstable_mockModule('./cloud/ServiceAccountOps', () => ({
  getServiceAccount,
  SERVICE_ACCOUNT_DEFAULT_SCOPES: ['fr:idm:*'],
}));

const createSignedJwtToken = jest.fn(async (_payload?: any, _jwk?: any): Promise<string> => 'fake.jwt.token');

jest.unstable_mockModule('./JoseOps', () => ({
  createSignedJwtToken,
}));

// Not exercised by this test's code path, but ConnectionProfileOps.ts
// (transitively imported via AuthenticateOps.ts) itself imports from
// ./JoseOps — stubbing it out entirely avoids having to also replicate
// its own JoseOps dependency surface.
jest.unstable_mockModule('./ConnectionProfileOps', () => ({
  getConnectionProfile: jest.fn(async () => {
    throw new Error('getConnectionProfile mock not configured');
  }),
  loadConnectionProfile: jest.fn(async () => {
    throw new Error('loadConnectionProfile mock not configured');
  }),
  saveConnectionProfile: jest.fn(async () => {
    throw new Error('saveConnectionProfile mock not configured');
  }),
}));

const accessToken = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('accessToken mock not configured');
});
const authorize = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('authorize mock not configured');
});
// Not exercised by this test's code path, but BrowserAuthenticateOps.ts
// (transitively imported via AuthenticateOps.ts) imports this from the
// same module, so the mock must still provide it.
const deviceAuthorizationRequest = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('deviceAuthorizationRequest mock not configured');
});
// Not exercised by this test's code path (only called from
// getTokensInteractive()'s cloud fresh-login case), but AuthenticateOps.ts
// imports it at module load time, so the mock must still provide it.
const getTokenInfo = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('getTokenInfo mock not configured');
});

jest.unstable_mockModule('./OAuth2OidcOps', () => ({
  accessToken,
  authorize,
  deviceAuthorizationRequest,
  getTokenInfo,
}));

const { getSaBearerToken } = await import('./AuthenticateOps');
const { getRecordedSubject } = await import('./TokenCacheOps');
const { default: StateImpl } = await import('../shared/State');

function freshState(cachePath: string) {
  const state = StateImpl({
    host: 'https://openam-sa.example.com/am',
    serviceAccountId: 'svc-account-uuid',
    serviceAccountJwk: { kid: 'test-key' } as any,
    useTokenCache: true,
  });
  state.setTokenCachePath(cachePath);
  state.setMasterKeyPath(cachePath + '.masterkey');
  return state;
}

function fakeSaTokenResponse() {
  return {
    access_token: 'sa-access-token',
    token_type: 'Bearer',
    scope: 'fr:idm:*',
    expires_in: 1800,
    expires: Date.now() + 1_800_000,
  };
}

describe("getSaBearerToken()'s subject resolution", () => {
  beforeEach(() => {
    getServiceAccount.mockReset();
    accessToken.mockReset();
  });

  test('1: A fresh token resolves the service account name via IDM and records it', async () => {
    const cachePath = `/tmp/frodo-test-sa-subject-${Math.random()}.json`;
    const state = freshState(cachePath);
    accessToken.mockResolvedValueOnce(fakeSaTokenResponse());
    getServiceAccount.mockResolvedValueOnce({ name: 'my-service-account' });

    await getSaBearerToken({ state });

    expect(getServiceAccount).toHaveBeenCalledWith(
      expect.objectContaining({ serviceAccountId: 'svc-account-uuid' })
    );
    expect(
      getRecordedSubject({ tokenType: 'saBearer' as any, state })
    ).toBe('my-service-account');
  });

  test('2: Falls back to the raw service account id when the IDM lookup fails, rather than recording nothing', async () => {
    const cachePath = `/tmp/frodo-test-sa-subject-${Math.random()}.json`;
    const state = freshState(cachePath);
    accessToken.mockResolvedValueOnce(fakeSaTokenResponse());
    getServiceAccount.mockRejectedValueOnce(new Error('not found'));

    await getSaBearerToken({ state });

    expect(
      getRecordedSubject({ tokenType: 'saBearer' as any, state })
    ).toBe('svc-account-uuid');
  });

  test('3: A cache-hit re-save does not repeat the IDM lookup', async () => {
    const cachePath = `/tmp/frodo-test-sa-subject-${Math.random()}.json`;
    const state = freshState(cachePath);
    accessToken.mockResolvedValueOnce(fakeSaTokenResponse());
    getServiceAccount.mockResolvedValueOnce({ name: 'my-service-account' });

    await getSaBearerToken({ state });
    expect(getServiceAccount).toHaveBeenCalledTimes(1);

    // Second call against the same state/cache hits the cached token
    // (readSaBearerToken), not a fresh accessToken() call.
    await getSaBearerToken({ state });

    expect(getServiceAccount).toHaveBeenCalledTimes(1);
    expect(
      getRecordedSubject({ tokenType: 'saBearer' as any, state })
    ).toBe('my-service-account');
  });
});
