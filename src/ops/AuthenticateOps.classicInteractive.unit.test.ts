/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.classicInteractive
 *
 * Regression coverage for Phase D: classic browser login inside
 * getTokensInteractive(). Unlike ForgeOps, classic supports only the
 * session-capture-script mechanism — there is no bearer-token fallback,
 * since classic has no IDM to fall back to — so a token response with no
 * `sessionId` must fail clearly rather than silently proceed.
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

const getServerInfo = jest.fn(async (_args?: any): Promise<any> => ({
  cookieName: 'iPlanetDirectoryPro',
}));
const getServerVersionInfo = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/ServerInfoApi', () => ({
  getServerInfo,
  getServerVersionInfo,
}));

// lookupCallerPrivilegeGroups() (CallerTrustTierOps.ts) calls readUser() at
// fresh-login time to capture the caller's admin role/group for `frodo
// session describe` — mocked so that stays hermetic instead of attempting a
// real network call against this test's fake host.
const readUser = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('./UserOps', () => ({
  readUser,
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
    host: 'https://openam-classic.example.com/am',
    deploymentType: 'classic',
  });
}

function fakeAccessTokenJwt(sub: string): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode({ sub })}.fake-signature`;
}

describe('Classic browser login (getTokensInteractive)', () => {
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
        deploymentType: 'classic',
        promptHandler,
        state,
      })
    );
    expect(error.message).toMatch(/requires an OAuth2 client id/);
    expect(runInteractiveAuthorizationCodeFlow).not.toHaveBeenCalled();
  });

  test('2: Throws a clear error when the token has no sessionId, rather than falling back to a bearer token', async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('amadmin'),
      token_type: 'Bearer',
      scope: 'openid',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    const error = await getUnderlyingError(
      getTokensInteractive({
        deploymentType: 'classic',
        loginClientId: 'my-browser-client',
        promptHandler,
        state,
      })
    );

    expect(error.message).toMatch(/requires a session-capture script/);
    expect(state.getUseBearerTokenForAmApis()).toBeFalsy();
    expect(getAuthenticationSettings).not.toHaveBeenCalled();
  });

  test('3: A token carrying sessionId uses the session-capture-script path', async () => {
    const state = freshState();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('amadmin'),
      token_type: 'Bearer',
      scope: 'openid',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
      sessionId: 'AQIC5wM2LY4SfczXYZ789',
    });
    getSessionInfo.mockResolvedValueOnce({
      username: 'amadmin',
      universalId: 'id=amadmin,ou=user,ou=am-config',
      realm: '/',
      latestAccessTime: new Date().toISOString(),
      maxIdleExpirationTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      maxSessionExpirationTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      properties: { AMCtxId: 'ctx-1' },
    });

    const tokens = await getTokensInteractive({
      deploymentType: 'classic',
      loginClientId: 'my-browser-client',
      promptHandler,
      state,
    });

    expect(tokens.userSessionToken?.tokenId).toBe('AQIC5wM2LY4SfczXYZ789');
    expect(state.getUseBearerTokenForAmApis()).toBeFalsy();
    expect(state.getCookieName()).toBe('iPlanetDirectoryPro');
  });
});
