/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.cloudInteractive
 *
 * Regression coverage for cloud browser login's redirect URI construction
 * inside getTokensInteractive(). The built-in client (`AICMCPClient`) is
 * confirmed (2026-09-07, empirically against a real AIC tenant by probing
 * `/oauth2/authorize` directly) to accept exactly one registered redirect
 * URI, `http://localhost:3000` — not `http://127.0.0.1:3000` (wrong host),
 * not `http://localhost:54321` (wrong port), not any URI with a path. The
 * general-purpose loopback listener's own defaults (127.0.0.1, an
 * OS-assigned ephemeral port, a `/callback` path) never reproduce this, so
 * cloud's default browser login must override them — this was a real,
 * previously-unnoticed bug (no cloud-specific interactive test existed
 * before this file, and every other regression test in this project mocks
 * `runInteractiveAuthorizationCodeFlow` without asserting on the redirect
 * URI it was actually called with).
 *
 * Also covers `--login-redirect-uri` (`loginRedirectUri`) sharing the same
 * option/state field as the pre-existing, non-interactive synthetic login
 * flow's own redirect URI setting (`state.getAdminClientRedirectUri()`),
 * exactly like `--login-client-id` already shares `state.getAdminClientId()`
 * between the two flows — the `--login-redirect-port` option this
 * superseded is gone entirely.
 */
import { jest } from '@jest/globals';

const runInteractiveAuthorizationCodeFlow = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('runInteractiveAuthorizationCodeFlow mock not configured');
});
const startDeviceAuthorizationFlow = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('startDeviceAuthorizationFlow mock not configured');
});
const refreshBrowserBearerToken = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('refreshBrowserBearerToken mock not configured');
});
const exchangeTokenForScope = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('exchangeTokenForScope mock not configured');
});

jest.unstable_mockModule('./BrowserAuthenticateOps', () => ({
  runInteractiveAuthorizationCodeFlow,
  startDeviceAuthorizationFlow,
  refreshBrowserBearerToken,
  exchangeTokenForScope,
}));

// The cloud interactive path's only touch point into OAuth2OidcOps is the
// opportunistic getTokenInfo() enrichment (tests 10-11 below) — every
// other test in this file leaves it at its default rejection, exercising
// the "must not break the login" fallback implicitly. `accessToken` isn't
// exercised by this test file's own code path either (that's the
// non-interactive synthetic flow's function), but AuthenticateOps.ts
// imports it at module load time, so the mock must still provide it.
const getTokenInfo = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('getTokenInfo mock not configured');
});
const accessToken = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('accessToken mock not configured');
});
const authorize = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('authorize mock not configured');
});

jest.unstable_mockModule('./OAuth2OidcOps', () => ({
  getTokenInfo,
  accessToken,
  authorize,
}));

// Cloud never runs a session-capture step, so resolveBrowserLoginSubject()
// always falls through to resolveIdentity() here — mocked so that path
// stays hermetic instead of attempting a real network call against this
// test's fake host.
const resolveIdentity = jest.fn(async (_args?: any): Promise<any> => ({
  id: 'jdoe',
  kind: 'unknown',
}));

jest.unstable_mockModule('./ManagedObjectOps', () => ({
  resolveIdentity,
}));

const { getTokensInteractive } = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');
const { FrodoError } = await import('./FrodoError');

async function getUnderlyingError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    let current = error;
    while (
      current instanceof FrodoError &&
      current.originalErrors.length > 0
    ) {
      current = current.originalErrors[0];
    }
    return current as Error;
  }
  throw new Error('Expected promise to reject, but it resolved.');
}

function freshState() {
  return StateImpl({
    host: 'https://openam-cloud.example.com/am',
    deploymentType: 'cloud',
  });
}

function fakeAccessTokenJwt(sub: string): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode({ sub })}.fake-signature`;
}

describe('Cloud browser login (getTokensInteractive)', () => {
  const promptHandler = jest.fn(async () => {});

  beforeEach(() => {
    runInteractiveAuthorizationCodeFlow.mockReset();
    getTokenInfo.mockReset();
  });

  test('1: Default (built-in client) forces the one confirmed-working redirect: "http://localhost:3000"', async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    await getTokensInteractive({
      deploymentType: 'cloud',
      promptHandler,
      state,
    });

    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    const call = runInteractiveAuthorizationCodeFlow.mock.calls[0][0] as {
      clientId: string;
      redirectUri?: string;
    };
    expect(call.clientId).toBe('AICMCPClient');
    expect(call.redirectUri).toBe('http://localhost:3000');
  });

  test('2: --login-redirect-uri matching "http://localhost:3000" is accepted for the built-in client', async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    await getTokensInteractive({
      deploymentType: 'cloud',
      loginRedirectUri: 'http://localhost:3000',
      promptHandler,
      state,
    });

    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
  });

  test('3: --login-redirect-uri set to anything other than "http://localhost:3000" fails clearly, before any network call, for the built-in client', async () => {
    const state = freshState();

    const error = await getUnderlyingError(
      getTokensInteractive({
        deploymentType: 'cloud',
        loginRedirectUri: 'http://localhost:5000',
        promptHandler,
        state,
      })
    );

    expect(error.message).toMatch(/not supported with cloud's built-in OAuth2 client/);
    expect(runInteractiveAuthorizationCodeFlow).not.toHaveBeenCalled();
  });

  test('4: A custom --login-client-id is NOT forced onto the built-in redirect — its own --login-redirect-uri (or none) passes through untouched', async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    await getTokensInteractive({
      deploymentType: 'cloud',
      loginClientId: 'my-custom-cloud-client',
      loginRedirectUri: 'http://localhost:5000',
      promptHandler,
      state,
    });

    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    const call = runInteractiveAuthorizationCodeFlow.mock.calls[0][0] as {
      clientId: string;
      redirectUri?: string;
    };
    expect(call.clientId).toBe('my-custom-cloud-client');
    expect(call.redirectUri).toBe('http://localhost:5000');
  });

  test('5: With a custom --login-client-id and no --login-redirect-uri, no override is passed at all (falls through to the auto-generated loopback default)', async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    await getTokensInteractive({
      deploymentType: 'cloud',
      loginClientId: 'my-custom-cloud-client',
      promptHandler,
      state,
    });

    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    const call = runInteractiveAuthorizationCodeFlow.mock.calls[0][0] as {
      clientId: string;
      redirectUri?: string;
    };
    expect(call.clientId).toBe('my-custom-cloud-client');
    expect(call.redirectUri).toBeUndefined();
  });

  test('6: --login-redirect-uri is shared with the non-interactive synthetic flow\'s state field (state.getAdminClientRedirectUri())', async () => {
    const state = freshState();
    // Simulates --login-redirect-uri already having been resolved onto
    // state by FrodoCommand.ts's stateMap, exactly like --login-client-id
    // already does for state.getAdminClientId().
    state.setAdminClientRedirectUri('http://localhost:3000');
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    await getTokensInteractive({
      deploymentType: 'cloud',
      promptHandler,
      state,
    });

    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    const call = runInteractiveAuthorizationCodeFlow.mock.calls[0][0] as {
      redirectUri?: string;
    };
    expect(call.redirectUri).toBe('http://localhost:3000');
  });

  test('7: The JWT sub claim (a UUID for cloud) is resolved to a real username via IDM, and used as the returned subject', async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('63dce142-2ade-4311-a43f-165d8705c236'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    resolveIdentity.mockResolvedValueOnce({
      id: '63dce142-2ade-4311-a43f-165d8705c236',
      kind: 'admin',
      username: 'jdoe',
    });

    const tokens = await getTokensInteractive({
      deploymentType: 'cloud',
      promptHandler,
      state,
    });

    expect(resolveIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        idOrDn: '63dce142-2ade-4311-a43f-165d8705c236',
      })
    );
    expect(tokens.subject).toBe('jdoe');
  });

  test("8: Falls back to the raw JWT sub claim when IDM resolution can't identify it", async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('63dce142-2ade-4311-a43f-165d8705c236'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    resolveIdentity.mockResolvedValueOnce({
      id: '63dce142-2ade-4311-a43f-165d8705c236',
      kind: 'unknown',
    });

    const tokens = await getTokensInteractive({
      deploymentType: 'cloud',
      promptHandler,
      state,
    });

    expect(tokens.subject).toBe('63dce142-2ade-4311-a43f-165d8705c236');
  });

  test('9: Falls back to the raw JWT sub claim when the IDM lookup itself fails, rather than breaking the login', async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('63dce142-2ade-4311-a43f-165d8705c236'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    resolveIdentity.mockRejectedValueOnce(new Error('network error'));

    const tokens = await getTokensInteractive({
      deploymentType: 'cloud',
      promptHandler,
      state,
    });

    expect(tokens.subject).toBe('63dce142-2ade-4311-a43f-165d8705c236');
  });

  test('10: A successful opportunistic getTokenInfo() call enriches the cached bearer token with sub/tokenName/realm/auditTrackingId', async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    getTokenInfo.mockResolvedValueOnce({
      sub: 'jdoe',
      tokenName: 'Access Token',
      realm: '/',
      auditTrackingId: 'abc-123',
    });

    const tokens = await getTokensInteractive({
      deploymentType: 'cloud',
      promptHandler,
      state,
    });

    expect(getTokenInfo).toHaveBeenCalledTimes(1);
    expect(tokens.bearerToken.tokenInfo).toEqual({
      sub: 'jdoe',
      tokenName: 'Access Token',
      realm: '/',
      auditTrackingId: 'abc-123',
    });
  });

  test('11: A failed opportunistic getTokenInfo() call does not break the login — the token is cached without tokenInfo', async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    getTokenInfo.mockRejectedValueOnce(new Error('tokeninfo endpoint unreachable'));

    const tokens = await getTokensInteractive({
      deploymentType: 'cloud',
      promptHandler,
      state,
    });

    expect(tokens.subject).toBe('jdoe');
    expect(tokens.bearerToken.tokenInfo).toBeUndefined();
  });
});
