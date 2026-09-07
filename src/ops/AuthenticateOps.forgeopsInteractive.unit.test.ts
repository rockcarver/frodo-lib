/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.forgeopsInteractive
 *
 * Regression coverage for Phase C: ForgeOps browser login's two AM-access
 * mechanisms inside getTokensInteractive() — the recommended
 * session-capture-script path (a real AM session id embedded via
 * `sessionId` on the token response) and the Tier A/B bearer-token
 * fallback, plus the mandatory-client-id fail-fast check and
 * probeAmBearerTokenAcceptance()'s caching behavior.
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

const getSessionInfo = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('getSessionInfo mock not configured');
});

jest.unstable_mockModule('./SessionOps', () => ({
  getSessionInfo,
}));

const getAuthenticationSettings = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('getAuthenticationSettings mock not configured');
});

jest.unstable_mockModule('../api/AuthenticationSettingsApi', () => ({
  getAuthenticationSettings,
}));

// Test 3 (no sessionId) has no already-known username, so
// resolveBrowserLoginSubject() falls through to resolveIdentity() for
// ForgeOps — mocked here so that path stays hermetic instead of attempting
// a real network call against this test's fake host.
const resolveIdentity = jest.fn(async (_args?: any): Promise<any> => ({
  id: 'jdoe',
  kind: 'unknown',
}));

jest.unstable_mockModule('./ManagedObjectOps', () => ({
  resolveIdentity,
}));

const getServerInfo = jest.fn(async (_args?: any): Promise<any> => ({
  cookieName: 'iPlanetDirectoryPro',
}));
const getServerVersionInfo = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/ServerInfoApi', () => ({
  getServerInfo,
  getServerVersionInfo,
}));

const {
  getTokensInteractive,
  probeAmBearerTokenAcceptance,
} = await import('./AuthenticateOps');
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
    host: 'https://openam-frodo-dev.forgeops.example.com/am',
    deploymentType: 'forgeops',
  });
}

function fakeAccessTokenJwt(sub: string): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode({ sub })}.fake-signature`;
}

describe('ForgeOps browser login (getTokensInteractive)', () => {
  const promptHandler = jest.fn(async () => {});

  beforeEach(() => {
    runInteractiveAuthorizationCodeFlow.mockReset();
    getSessionInfo.mockReset();
    getAuthenticationSettings.mockReset();
  });

  test('1: Throws a clear error when no client id is available', async () => {
    const state = freshState();
    const error = await getUnderlyingError(
      getTokensInteractive({
        deploymentType: 'forgeops',
        promptHandler,
        state,
      })
    );
    expect(error.message).toMatch(/requires an OAuth2 client id/);
    expect(runInteractiveAuthorizationCodeFlow).not.toHaveBeenCalled();
  });

  test('2: A token carrying sessionId uses the session-capture-script path, never Tier B', async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'openid fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
      sessionId: 'AQIC5wM2LY4SfczABC123',
    });
    getSessionInfo.mockResolvedValueOnce({
      username: 'jdoe',
      universalId: 'id=jdoe,ou=user,o=forgeops',
      realm: '/',
      latestAccessTime: new Date().toISOString(),
      maxIdleExpirationTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      maxSessionExpirationTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      properties: { AMCtxId: 'ctx-1' },
    });

    const tokens = await getTokensInteractive({
      deploymentType: 'forgeops',
      loginClientId: 'my-browser-client',
      promptHandler,
      state,
    });

    expect(tokens.userSessionToken?.tokenId).toBe('AQIC5wM2LY4SfczABC123');
    expect(state.getUseBearerTokenForAmApis()).toBeFalsy();
    expect(state.getCookieName()).toBe('iPlanetDirectoryPro');
    expect(getAuthenticationSettings).not.toHaveBeenCalled();
    // Session-capture already resolved a real username for free — no need
    // for (and no cost of) an extra IDM lookup to get one.
    expect(tokens.subject).toBe('jdoe');
    expect(resolveIdentity).not.toHaveBeenCalled();
  });

  test('3: A token with no sessionId falls back to Tier A/B and warns when AM rejects the bearer token', async () => {
    const state = freshState();
    const printHandler = jest.fn();
    state.setPrintHandler(printHandler);
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'openid fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    getAuthenticationSettings.mockRejectedValueOnce(new Error('401'));
    resolveIdentity.mockResolvedValueOnce({
      id: 'jdoe',
      kind: 'admin',
      username: 'jdoe',
    });

    const tokens = await getTokensInteractive({
      deploymentType: 'forgeops',
      loginClientId: 'my-browser-client',
      promptHandler,
      state,
    });

    expect(tokens.userSessionToken).toBeUndefined();
    expect(state.getUseBearerTokenForAmApis()).toBe(true);
    expect(getAuthenticationSettings).toHaveBeenCalledTimes(1);
    expect(printHandler).toHaveBeenCalledWith(
      expect.stringMatching(/no session-capture script configured/),
      'warn',
      expect.anything()
    );
    // No session-capture step ran (Tier B), so the only way to get a real
    // subject here is the IDM-based resolver.
    expect(resolveIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ idOrDn: 'jdoe' })
    );
    expect(tokens.subject).toBe('jdoe');
  });
});

describe('probeAmBearerTokenAcceptance', () => {
  beforeEach(() => {
    getAuthenticationSettings.mockReset();
  });

  test('4: Caches the probe result on state and only calls AM once', async () => {
    const state = freshState();
    getAuthenticationSettings.mockResolvedValueOnce({});

    const first = await probeAmBearerTokenAcceptance({ state });
    const second = await probeAmBearerTokenAcceptance({ state });

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(getAuthenticationSettings).toHaveBeenCalledTimes(1);
  });
});
