/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.accessProfile
 *
 * What the library asks for in an interactive login on Cloud, and what it reports about the
 * session it got (measured on a Cloud development tenant on 2026-11-14):
 *
 *   - a browser login on the built-in client asks for all five scopes the client offers
 *     (`fr:am:* fr:idm:* fr:idc:esv:read fr:idc:esv:update fr:idc:monitoring:*`);
 *   - a device login asks for the same without `fr:am:*` (with it, the token step ends in a 500
 *     after the approval, and the token of a device login cannot call Access Management anyway);
 *   - an explicit scope always wins, and a client the customer registered keeps the two scopes it
 *     always got;
 *   - the login result and `getAccessProfile()` report what the session can do, also for a session
 *     reused from the session cache (an isolated cache file, never the real home).
 */
import fs from 'fs';
import { resolve } from 'path';
import { jest } from '@jest/globals';

const runInteractiveAuthorizationCodeFlow = jest.fn(
  async (_args?: any): Promise<any> => {
    throw new Error('runInteractiveAuthorizationCodeFlow mock not configured');
  }
);
const startDeviceAuthorizationFlow = jest.fn(
  async (_args?: any): Promise<any> => {
    throw new Error('startDeviceAuthorizationFlow mock not configured');
  }
);
const refreshBrowserBearerToken = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('refreshBrowserBearerToken mock not configured');
});
const exchangeTokenForScope = jest.fn(async (_args?: any): Promise<any> => ({
  access_token: 'exchanged-am-token',
  token_type: 'Bearer',
  expires_in: 40,
  expires: Date.now() + 40_000,
}));

jest.unstable_mockModule('./BrowserAuthenticateOps', () => ({
  runInteractiveAuthorizationCodeFlow,
  startDeviceAuthorizationFlow,
  refreshBrowserBearerToken,
  exchangeTokenForScope,
  readMayActClientId: () => undefined,
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

const resolveIdentity = jest.fn(async (_args?: any): Promise<any> => ({
  id: 'jdoe',
  kind: 'unknown',
}));
jest.unstable_mockModule('./ManagedObjectOps', () => ({ resolveIdentity }));

const readUser = jest.fn(async (_args?: any): Promise<any> => ({}));
jest.unstable_mockModule('./UserOps', () => ({ readUser }));

const {
  getTokensInteractive,
  getTokens,
  default: AuthenticateImpl,
} = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');
const { FrodoError } = await import('./FrodoError');

const TMP_DIR = resolve('.', 'test', 'fs_tmp', 'AuthenticateOps.accessProfile');

const FIVE =
  'fr:am:* fr:idm:* fr:idc:esv:read fr:idc:esv:update fr:idc:monitoring:*';
const DEVICE_FOUR =
  'fr:idm:* fr:idc:esv:read fr:idc:esv:update fr:idc:monitoring:*';
const SESSION_VALUE = 'a-session-value-that-must-never-leak';

function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode({
    sub: 'jdoe',
    client_id: 'AICMCPClient',
    ...claims,
  })}.fake-signature`;
}

/** A token response of the built-in client: with the AM session (browser login) or without (device login). */
function tokenResponse({
  scope,
  session,
  clientId = 'AICMCPClient',
}: {
  scope: string;
  session: boolean;
  clientId?: string;
}) {
  return {
    access_token: fakeJwt({
      client_id: clientId,
      scope: scope.split(' '),
      may_act: { client_id: 'AICMCPExchangeClient' },
      ...(session ? { sessionToken: SESSION_VALUE } : {}),
    }),
    token_type: 'Bearer',
    scope,
    expires_in: 1800,
    expires: Date.now() + 1_800_000,
  };
}

function freshState(cachePath?: string) {
  const state = StateImpl({
    host: 'https://openam-cloud.example.com/am',
    deploymentType: 'cloud',
  });
  if (cachePath) {
    state.setUseTokenCache(true);
    state.setTokenCachePath(cachePath);
    state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    state.setAuthMode('interactive');
  }
  return state;
}

const promptHandler = jest.fn(async () => {});

function area(profile: any, id: string) {
  return profile.areas.find((a: any) => a.id === id);
}

describe('Cloud interactive login: the requested scope per flow', () => {
  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    runInteractiveAuthorizationCodeFlow.mockReset();
    startDeviceAuthorizationFlow.mockReset();
    getTokenInfo.mockReset();
    refreshBrowserBearerToken.mockReset();
  });

  test('1: a browser login on the built-in client asks for all five scopes and reports what it got', async () => {
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce(
      tokenResponse({ scope: FIVE, session: true })
    );
    const state = freshState();
    const tokens = await getTokensInteractive({
      deploymentType: 'cloud',
      promptHandler,
      state,
    });
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'AICMCPClient', scope: FIVE })
    );
    expect(state.getBrowserLoginScope()).toBe(FIVE);
    const profile = tokens.accessProfile;
    expect(profile).toBeDefined();
    expect(profile.flow).toBe('browser');
    expect(profile.requestedScope).toBe(FIVE);
    expect(profile.scopesNotGranted).toEqual([]);
    expect(profile.adaptations).toEqual([]);
    expect(area(profile, 'am').reachable).toBe('yes');
    expect(area(profile, 'esv').reachable).toBe('yes');
    // the same profile from the facade
    expect(AuthenticateImpl(state).getAccessProfile()).toEqual(profile);
    // no token and no session value in the profile
    expect(JSON.stringify(profile)).not.toContain(SESSION_VALUE);
  });

  test('2: a device login on the built-in client asks for the same without fr:am:*, says so, and reports no AM', async () => {
    startDeviceAuthorizationFlow.mockResolvedValueOnce(
      tokenResponse({ scope: DEVICE_FOUR, session: false })
    );
    const state = freshState();
    const tokens = await getTokensInteractive({
      deploymentType: 'cloud',
      useDeviceFlow: true,
      promptHandler,
      state,
    });
    expect(startDeviceAuthorizationFlow).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'AICMCPClient', scope: DEVICE_FOUR })
    );
    expect(DEVICE_FOUR).not.toContain('fr:am:*');
    const profile = tokens.accessProfile;
    expect(profile.flow).toBe('device');
    expect(profile.amSession).toBe('absent');
    expect(area(profile, 'am')).toMatchObject({
      reachable: 'no',
      reason: 'no-am-session',
    });
    expect(area(profile, 'idm').reachable).toBe('yes');
    expect(area(profile, 'esv').reachable).toBe('yes');
    expect(profile.adaptations.map((a: any) => a.code)).toEqual([
      'DEVICE_LOGIN_AM_SCOPE_NOT_REQUESTED',
    ]);
  });

  test('3: an explicit scope wins in both flows, also fr:am:* for a device login (and then there is no adaptation to report)', async () => {
    startDeviceAuthorizationFlow.mockResolvedValueOnce(
      tokenResponse({ scope: 'fr:am:* fr:idm:*', session: true })
    );
    const device = await getTokensInteractive({
      deploymentType: 'cloud',
      useDeviceFlow: true,
      loginScope: 'fr:am:* fr:idm:*',
      promptHandler,
      state: freshState(),
    });
    expect(startDeviceAuthorizationFlow).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'fr:am:* fr:idm:*' })
    );
    expect(device.accessProfile.adaptations).toEqual([]);
    // a device token that does carry the session claim reaches AM
    expect(area(device.accessProfile, 'am').reachable).toBe('yes');

    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce(
      tokenResponse({ scope: 'fr:idm:*', session: true })
    );
    await getTokensInteractive({
      deploymentType: 'cloud',
      loginScope: 'fr:idm:*',
      promptHandler,
      state: freshState(),
    });
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'fr:idm:*' })
    );
  });

  test('4: a client the customer registered keeps the two scopes it always got, in both flows', async () => {
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce(
      tokenResponse({
        scope: 'fr:am:* fr:idm:*',
        session: true,
        clientId: 'my-own-client',
      })
    );
    await getTokensInteractive({
      deploymentType: 'cloud',
      loginClientId: 'my-own-client',
      promptHandler,
      state: freshState(),
    });
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'my-own-client',
        scope: 'fr:am:* fr:idm:*',
      })
    );

    startDeviceAuthorizationFlow.mockResolvedValueOnce(
      tokenResponse({
        scope: 'fr:am:* fr:idm:*',
        session: true,
        clientId: 'my-own-client',
      })
    );
    const device = await getTokensInteractive({
      deploymentType: 'cloud',
      loginClientId: 'my-own-client',
      useDeviceFlow: true,
      promptHandler,
      state: freshState(),
    });
    expect(startDeviceAuthorizationFlow).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'fr:am:* fr:idm:*' })
    );
    expect(device.accessProfile.adaptations).toEqual([]);
  });

  test('5: a client that grants fewer scopes than requested is reported, not an error', async () => {
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce(
      tokenResponse({ scope: 'fr:am:* fr:idm:*', session: true })
    );
    const tokens = await getTokensInteractive({
      deploymentType: 'cloud',
      promptHandler,
      state: freshState(),
    });
    expect(tokens.accessProfile.requestedScope).toBe(FIVE);
    expect(tokens.accessProfile.grantedScopes).toEqual(['fr:am:*', 'fr:idm:*']);
    expect(tokens.accessProfile.scopesNotGranted).toEqual([
      'fr:idc:esv:read',
      'fr:idc:esv:update',
      'fr:idc:monitoring:*',
    ]);
    expect(area(tokens.accessProfile, 'esv').reachable).toBe('no');
  });

  test('6: a session reused from the session cache has the same profile, adaptations included', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    startDeviceAuthorizationFlow.mockResolvedValueOnce(
      tokenResponse({ scope: DEVICE_FOUR, session: false })
    );
    const first = await getTokens({
      state: freshState(cachePath),
      autoRefresh: false,
      useDeviceFlow: true,
      promptHandler,
    });
    expect(first.accessProfile.flow).toBe('device');

    const reusedState = freshState(cachePath);
    const second = await getTokens({
      state: reusedState,
      autoRefresh: false,
      useDeviceFlow: true,
      promptHandler,
    });
    // reused: no second login
    expect(startDeviceAuthorizationFlow).toHaveBeenCalledTimes(1);
    expect(second.accessProfile).toBeDefined();
    expect(second.accessProfile.flow).toBe('device');
    expect(second.accessProfile.grantedScopes).toEqual(DEVICE_FOUR.split(' '));
    expect(second.accessProfile.adaptations.map((a: any) => a.code)).toEqual([
      'DEVICE_LOGIN_AM_SCOPE_NOT_REQUESTED',
    ]);
    expect(area(second.accessProfile, 'am').reason).toBe('no-am-session');
    expect(second.accessProfile.areas).toEqual(first.accessProfile.areas);
    expect(AuthenticateImpl(reusedState).getAccessProfile()).toEqual(
      second.accessProfile
    );
  });

  test("7: an access token issued elsewhere is applied, reported as such, and the caller's object is left alone", async () => {
    const token = {
      ...tokenResponse({ scope: 'fr:am:* fr:idm:*', session: true }),
    };
    const before = JSON.stringify(token);
    const state = freshState();
    const tokens = await AuthenticateImpl(state).applyAccessToken(token as any);
    expect(JSON.stringify(token)).toBe(before);
    expect(tokens.accessProfile.flow).toBe('external-token');
    expect(area(tokens.accessProfile, 'am').reachable).toBe('yes');
  });

  test('8: a refreshed token is the same login: the login information is kept', async () => {
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      ...tokenResponse({ scope: FIVE, session: true }),
      refresh_token: 'refresh-1',
    });
    const state = freshState();
    await getTokensInteractive({
      deploymentType: 'cloud',
      promptHandler,
      state,
    });
    expect(state.getBearerTokenMeta().login?.flow).toBe('browser');
    refreshBrowserBearerToken.mockResolvedValueOnce(
      tokenResponse({ scope: FIVE, session: true })
    );
    await state.getTokenRefreshHandler()();
    expect(refreshBrowserBearerToken).toHaveBeenCalledTimes(1);
    expect(state.getBearerTokenMeta().login).toEqual({
      flow: 'browser',
      requestedScope: FIVE,
      adaptations: [],
    });
    expect(AuthenticateImpl(state).getAccessProfile().flow).toBe('browser');
  });

  // A tenant whose built-in client does not offer one of the default scopes refuses the request
  // with invalid_scope before anything is approved: the browser login sees it as the error of the
  // loopback redirect, the device login as the error answer of the device endpoint.
  const browserInvalidScope = () =>
    new FrodoError('Browser login failed: invalid_scope (unknown scope)');
  const deviceInvalidScope = () =>
    new FrodoError(
      'Error requesting a device code',
      Object.assign(new Error('Request failed with status code 400'), {
        name: 'AxiosError',
        response: {
          status: 400,
          data: { error: 'invalid_scope' },
          headers: {},
        },
      })
    );

  test('9: a browser login whose client refuses the default scopes asks again, once, for the two it always asked for, and says so', async () => {
    runInteractiveAuthorizationCodeFlow
      .mockRejectedValueOnce(browserInvalidScope())
      .mockResolvedValueOnce(
        tokenResponse({ scope: 'fr:am:* fr:idm:*', session: true })
      );
    const state = freshState();
    const tokens = await getTokensInteractive({
      deploymentType: 'cloud',
      promptHandler,
      state,
    });
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(2);
    expect(
      runInteractiveAuthorizationCodeFlow.mock.calls.map((c: any) => c[0].scope)
    ).toEqual([FIVE, 'fr:am:* fr:idm:*']);
    expect(state.getBrowserLoginScope()).toBe('fr:am:* fr:idm:*');
    expect(tokens.accessProfile.requestedScope).toBe('fr:am:* fr:idm:*');
    expect(tokens.accessProfile.adaptations.map((a: any) => a.code)).toEqual([
      'DEFAULT_SCOPES_REDUCED',
    ]);
    expect(area(tokens.accessProfile, 'am').reachable).toBe('yes');
  });

  test('10: a device login whose client refuses the default scopes asks again for Identity Management only, with both adaptations reported', async () => {
    startDeviceAuthorizationFlow
      .mockRejectedValueOnce(deviceInvalidScope())
      .mockResolvedValueOnce(
        tokenResponse({ scope: 'fr:idm:*', session: false })
      );
    const tokens = await getTokensInteractive({
      deploymentType: 'cloud',
      useDeviceFlow: true,
      promptHandler,
      state: freshState(),
    });
    expect(
      startDeviceAuthorizationFlow.mock.calls.map((c: any) => c[0].scope)
    ).toEqual([DEVICE_FOUR, 'fr:idm:*']);
    expect(tokens.accessProfile.adaptations.map((a: any) => a.code)).toEqual([
      'DEVICE_LOGIN_AM_SCOPE_NOT_REQUESTED',
      'DEFAULT_SCOPES_REDUCED',
    ]);
    expect(area(tokens.accessProfile, 'idm').reachable).toBe('yes');
  });

  test('11: a scope the caller named is never reduced, a customer client is never retried, other errors are not retried, and a second refusal ends it', async () => {
    runInteractiveAuthorizationCodeFlow.mockRejectedValueOnce(
      browserInvalidScope()
    );
    await expect(
      getTokensInteractive({
        deploymentType: 'cloud',
        loginScope: 'fr:idm:*',
        promptHandler,
        state: freshState(),
      })
    ).rejects.toThrow();
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);

    runInteractiveAuthorizationCodeFlow.mockReset();
    runInteractiveAuthorizationCodeFlow.mockRejectedValueOnce(
      browserInvalidScope()
    );
    await expect(
      getTokensInteractive({
        deploymentType: 'cloud',
        loginClientId: 'my-own-client',
        promptHandler,
        state: freshState(),
      })
    ).rejects.toThrow();
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);

    runInteractiveAuthorizationCodeFlow.mockReset();
    runInteractiveAuthorizationCodeFlow.mockRejectedValueOnce(
      new FrodoError('Browser login failed: access_denied (no)')
    );
    await expect(
      getTokensInteractive({
        deploymentType: 'cloud',
        promptHandler,
        state: freshState(),
      })
    ).rejects.toThrow();
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);

    runInteractiveAuthorizationCodeFlow.mockReset();
    runInteractiveAuthorizationCodeFlow
      .mockRejectedValueOnce(browserInvalidScope())
      .mockRejectedValueOnce(browserInvalidScope());
    await expect(
      getTokensInteractive({
        deploymentType: 'cloud',
        promptHandler,
        state: freshState(),
      })
    ).rejects.toThrow();
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(2);
  });
});
