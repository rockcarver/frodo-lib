/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.applyAccessToken
 *
 * Regression coverage for applyAccessToken() — the entry point that wires
 * an already-obtained, externally-issued OAuth2 access token onto `state`,
 * for hosts that resolve their own per-request caller identity (e.g. an MCP
 * server acting as an OAuth2 resource server) rather than performing a
 * login themselves. Unlike getTokens()/getTokensInteractive(), this must
 * never call an authorization/token endpoint itself — the token already
 * exists and, by this function's contract, was already verified by the
 * caller before being handed to it. It reuses the exact same
 * deployment-type-specific wiring (applyInteractiveToken() and its cloud/
 * forgeops/classic helpers) a real browser login uses, so those helpers'
 * own branch coverage (Tier A/B fallback, session-capture specifics, etc.)
 * lives in the existing cloudInteractive/forgeopsInteractive/
 * classicInteractive test files and isn't re-verified here.
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
const exchangeTokenForScope = jest.fn(async (_args?: any): Promise<any> => ({
  access_token: 'exchanged-token',
  token_type: 'Bearer',
  scope: 'fr:am:*',
  expires_in: 30,
  expires: Date.now() + 30_000,
}));
// Defaults to a truthy client id — i.e. this token behaves like a real
// browser/interactive-obtained one (test 3 relies on the exchange path
// actually running). Test 7 overrides this to `undefined` to exercise the
// BYOT (bring-your-own-token) fallback instead.
const readMayActClientId = jest.fn((_jwt: string): string | undefined => 'AICMCPExchangeClient');

jest.unstable_mockModule('./BrowserAuthenticateOps', () => ({
  runInteractiveAuthorizationCodeFlow,
  startDeviceAuthorizationFlow,
  refreshBrowserBearerToken,
  exchangeTokenForScope,
  readMayActClientId,
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

const resolveIdentity = jest.fn(async (_args?: any): Promise<any> => ({
  id: 'jdoe',
  username: 'jdoe',
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

const readUser = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('./UserOps', () => ({
  readUser,
}));

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

const { default: AuthenticateOps } = await import('./AuthenticateOps');
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

function freshState(deploymentType: string, host: string) {
  return StateImpl({ host, deploymentType, useTokenCache: false });
}

const externalToken = {
  access_token: 'caller-supplied-token',
  token_type: 'Bearer',
  scope: 'fr:idm:*',
  expires_in: 300,
  expires: Date.now() + 300_000,
};

describe('applyAccessToken', () => {
  beforeEach(() => {
    runInteractiveAuthorizationCodeFlow.mockClear();
    startDeviceAuthorizationFlow.mockClear();
    accessToken.mockClear();
    authorize.mockClear();
    exchangeTokenForScope.mockClear();
    readMayActClientId.mockClear();
    readMayActClientId.mockReturnValue('AICMCPExchangeClient');
    getSessionInfo.mockReset();
    resolveIdentity.mockClear();
  });

  test('1: throws a clear error when no deployment type is configured', async () => {
    const state = StateImpl({
      host: 'https://openam-cloud.example.com/am',
      useTokenCache: false,
    });
    const { applyAccessToken } = AuthenticateOps(state);

    const error = await getUnderlyingError(applyAccessToken(externalToken));

    expect(error.message).toMatch(/no deployment type is configured/);
  });

  test('2: cloud — wires the bearer token and an AM credential provider, never calls an authorization endpoint', async () => {
    const state = freshState('cloud', 'https://openam-cloud.example.com/am');
    const { applyAccessToken } = AuthenticateOps(state);

    const tokens = await applyAccessToken(externalToken);

    expect(state.getBearerToken()).toBe('caller-supplied-token');
    expect(state.getAmCredentialProvider()).toBeDefined();
    expect(tokens.host).toBe('https://openam-cloud.example.com/am');
    expect(tokens.realm).toBe('root');
    // Never performs a login round trip of its own — the token already
    // exists and was already verified by the caller.
    expect(runInteractiveAuthorizationCodeFlow).not.toHaveBeenCalled();
    expect(startDeviceAuthorizationFlow).not.toHaveBeenCalled();
    expect(accessToken).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  });

  test('3: cloud — the installed AM credential provider performs the RFC 8693 exchange using the caller-supplied token as the subject token', async () => {
    const state = freshState('cloud', 'https://openam-cloud.example.com/am');
    const { applyAccessToken } = AuthenticateOps(state);

    await applyAccessToken(externalToken);
    await state.getAmCredentialProvider()(['fr:am:*']);

    expect(exchangeTokenForScope).toHaveBeenCalledTimes(1);
    const call = exchangeTokenForScope.mock.calls[0][0] as {
      subjectToken: string;
    };
    expect(call.subjectToken).toBe('caller-supplied-token');
  });

  test("3b: cloud BYOT — a token with no 'may_act' claim falls back to using it directly, never attempting an exchange", async () => {
    readMayActClientId.mockReturnValue(undefined);
    const state = freshState('cloud', 'https://openam-cloud.example.com/am');
    const { applyAccessToken } = AuthenticateOps(state);

    await applyAccessToken(externalToken);
    const credential = await state.getAmCredentialProvider()(['fr:am:*']);

    expect(exchangeTokenForScope).not.toHaveBeenCalled();
    expect(credential).toEqual({
      header: 'Authorization',
      value: 'Bearer caller-supplied-token',
    });
  });

  test('4: cloud — resolves subject via IDM identity lookup and sets it on state', async () => {
    const state = freshState('cloud', 'https://openam-cloud.example.com/am');
    const { applyAccessToken } = AuthenticateOps(state);

    const tokens = await applyAccessToken(externalToken);

    expect(resolveIdentity).toHaveBeenCalledTimes(1);
    expect(tokens.subject).toBe('jdoe');
    expect(state.getUsername()).toBe('jdoe');
  });

  test('5: forgeops — a token carrying sessionId is applied via session capture, resolving the real username with no IDM lookup', async () => {
    const state = freshState(
      'forgeops',
      'https://openam-frodo-dev.forgeops.example.com/am'
    );
    const { applyAccessToken } = AuthenticateOps(state);

    getSessionInfo.mockResolvedValueOnce({
      username: 'jdoe',
      universalId: 'id=jdoe,ou=user,o=forgeops',
      realm: '/',
      latestAccessTime: new Date().toISOString(),
      maxIdleExpirationTime: new Date(
        Date.now() + 30 * 60 * 1000
      ).toISOString(),
      maxSessionExpirationTime: new Date(
        Date.now() + 2 * 60 * 60 * 1000
      ).toISOString(),
      properties: { AMCtxId: 'ctx-1' },
    });

    const tokens = await applyAccessToken({
      ...externalToken,
      sessionId: 'real-am-session-id',
    });

    expect(getSessionInfo).toHaveBeenCalledWith(
      expect.objectContaining({ tokenId: 'real-am-session-id' })
    );
    expect(resolveIdentity).not.toHaveBeenCalled();
    expect(tokens.subject).toBe('jdoe');
    expect(state.getUsername()).toBe('jdoe');
  });

  test('6: classic — a token with no sessionId fails clearly (no bearer-token fallback exists for classic)', async () => {
    const state = freshState(
      'classic',
      'https://openam-classic.example.com/am'
    );
    const { applyAccessToken } = AuthenticateOps(state);

    const error = await getUnderlyingError(applyAccessToken(externalToken));

    expect(error.message).toMatch(/session-capture script/);
  });
});
