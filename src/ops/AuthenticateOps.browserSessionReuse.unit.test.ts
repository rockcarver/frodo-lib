/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent AuthenticateOps.browserSessionReuse
 *
 * Regression coverage for the Phase F session-lifecycle addendum's core
 * fix: getTokens()'s browser-login branch (unlike every other auth mode)
 * never checked the token cache before doing a real interactive round trip,
 * so `frodo login --browser --save` followed by any other command against
 * that host silently redid the entire login. This exercises the real,
 * isolated token cache file (not mocked — same convention as
 * TokenCacheOps.browserToken.unit.test.ts) across all three deployment
 * types, simulating two *separate* State objects (standing in for two
 * separate CLI processes) sharing the same cache file on disk.
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

const getSessionInfo = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('getSessionInfo mock not configured');
});

jest.unstable_mockModule('./SessionOps', () => ({
  getSessionInfo,
}));

// Cloud's opportunistic getTokenInfo() enrichment (only called from
// getTokensInteractive()'s fresh-login case, never from a cache-hit
// resume) — mocked here purely for test hermeticity/speed; test 1 below
// also asserts on the call count as a regression guard for that "never on
// resume" guarantee. `accessToken`/`authorize` aren't exercised by this
// test file's own code path either, but AuthenticateOps.ts imports them at
// module load time, so the mock must still provide them.
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

const getAuthenticationSettings = jest.fn(
  async (_args?: any): Promise<any> => ({})
);

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
// fresh-login time, the same "never on resume" shape as getTokenInfo()
// above — mocked here purely for test hermeticity/speed.
const readUser = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('./UserOps', () => ({
  readUser,
}));

const { getTokens } = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');

const TMP_DIR = resolve(
  '.',
  'test',
  'fs_tmp',
  'AuthenticateOps.browserSessionReuse'
);

function fakeAccessTokenJwt(sub: string): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode({ sub })}.fake-signature`;
}

/**
 * A fresh State configured with a shared, isolated token cache + master key
 * on disk, and `authMode`/`deploymentType` already set — standing in for
 * either an explicit CLI `--browser`/`--device` flag, or a saved connection
 * profile's own fields, both of which land on `state` the same way before
 * getTokens()'s browser-login branch runs. No connection profile is
 * involved in this test at all (real ConnectionProfileOps.ts is never
 * mocked, but also never reached): `authMode: 'interactive'` set directly
 * on a bare state makes getTokens()'s *first* browser-login check fire
 * before any profile lookup, exactly like Phase E's own
 * AuthenticateOps.browserModeBranch.unit.test.ts test 3 relies on.
 */
function freshState({
  cachePath,
  deploymentType,
}: {
  cachePath: string;
  deploymentType: string;
}) {
  const state = StateImpl({
    host: 'https://openam-session-reuse.example.com/am',
  });
  // Unlike the CLI (whose --no-cache option defaults the underlying flag to
  // true), frodo-lib itself defaults getUseTokenCache() to falsy — a bare
  // library consumer has to opt in explicitly.
  state.setUseTokenCache(true);
  state.setTokenCachePath(cachePath);
  state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
  state.setAuthMode('interactive');
  state.setDeploymentType(deploymentType);
  // ForgeOps/classic have no built-in client id to fall back to (cloud
  // does — see CLOUD_BROWSER_LOGIN_CLIENT_ID); harmless to set for cloud
  // too, since a mocked flow doesn't care which client id it's called with.
  state.setBrowserLoginClientId('my-browser-client');
  return state;
}

describe('getTokens() reuses a cached browser-login session instead of a fresh interactive round trip', () => {
  const promptHandler = jest.fn(async () => {});

  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    // A stable, pre-existing master key avoids DataProtection's own async
    // auto-generate-on-first-use path racing with afterAll's cleanup below.
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    runInteractiveAuthorizationCodeFlow.mockReset();
    getSessionInfo.mockReset();
    getTokenInfo.mockReset();
  });

  test('1: cloud — a second, independent getTokens() call reuses the cached session with no interactive round trip', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
      // Confirmed empirically: cloud's AICMCPClient/AICMCPExchangeClient
      // never return one — exercises the master-key-only cache-entry key.
    });
    const first = await getTokens({
      state: freshState({ cachePath, deploymentType: 'cloud' }),
      autoRefresh: false,
      promptHandler,
    });
    expect(first.subject).toBe('jdoe');
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    // The fresh login above opportunistically called getTokenInfo() once.
    expect(getTokenInfo).toHaveBeenCalledTimes(1);

    const second = await getTokens({
      state: freshState({ cachePath, deploymentType: 'cloud' }),
      autoRefresh: false,
      promptHandler,
    });
    expect(second.subject).toBe('jdoe');
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    // Regression guard: a cache-hit resume must never call getTokenInfo()
    // again — that would add a surprise network call to what's supposed to
    // stay a cheap, purely local cache read.
    expect(getTokenInfo).toHaveBeenCalledTimes(1);
  });

  test('2: forgeops (session-capture path) — a second call reuses the cached AM session, re-validating it via getSessionInfo but never re-running the interactive flow', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'openid fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
      sessionId: 'AQIC5wM2LY4SfczABC123',
    });
    getSessionInfo.mockResolvedValue({
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

    const first = await getTokens({
      state: freshState({ cachePath, deploymentType: 'forgeops' }),
      autoRefresh: false,
      promptHandler,
    });
    expect(first.userSessionToken?.tokenId).toBe('AQIC5wM2LY4SfczABC123');
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    expect(getSessionInfo).toHaveBeenCalledTimes(1);

    const second = await getTokens({
      state: freshState({ cachePath, deploymentType: 'forgeops' }),
      autoRefresh: false,
      promptHandler,
    });
    expect(second.userSessionToken?.tokenId).toBe('AQIC5wM2LY4SfczABC123');
    // Re-validated against AM (a real, cheap network call), but never
    // re-ran the actual interactive browser round trip.
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    expect(getSessionInfo).toHaveBeenCalledTimes(2);
  });

  test('3: classic (session-capture path) — a second call reuses the cached AM session with no interactive round trip', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'openid',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
      sessionId: 'AQIC5wM2LY4SfczCLASSIC',
    });
    getSessionInfo.mockResolvedValue({
      username: 'jdoe',
      universalId: 'id=jdoe,ou=user,o=classic',
      realm: '/',
      latestAccessTime: new Date().toISOString(),
      maxIdleExpirationTime: new Date(
        Date.now() + 30 * 60 * 1000
      ).toISOString(),
      maxSessionExpirationTime: new Date(
        Date.now() + 2 * 60 * 60 * 1000
      ).toISOString(),
      properties: { AMCtxId: 'ctx-2' },
    });

    const first = await getTokens({
      state: freshState({ cachePath, deploymentType: 'classic' }),
      autoRefresh: false,
      promptHandler,
    });
    expect(first.userSessionToken?.tokenId).toBe('AQIC5wM2LY4SfczCLASSIC');
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);

    const second = await getTokens({
      state: freshState({ cachePath, deploymentType: 'classic' }),
      autoRefresh: false,
      promptHandler,
    });
    expect(second.userSessionToken?.tokenId).toBe('AQIC5wM2LY4SfczCLASSIC');
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
  });

  test('4: an expired cached entry still falls through to a fresh interactive round trip', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 1,
      // Within TOKEN_FRESHNESS_BUFFER_MS (30s) of "now" — readToken() must
      // treat this as stale.
      expires: Date.now() + 1000,
    });
    await getTokens({
      state: freshState({ cachePath, deploymentType: 'cloud' }),
      autoRefresh: false,
      promptHandler,
    });
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);

    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    await getTokens({
      state: freshState({ cachePath, deploymentType: 'cloud' }),
      autoRefresh: false,
      promptHandler,
    });
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(2);
  });

  test('5: no cache entry at all falls through to a fresh interactive round trip', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    await getTokens({
      state: freshState({ cachePath, deploymentType: 'cloud' }),
      autoRefresh: false,
      promptHandler,
    });
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
  });

  test("6: item 21's fix — a later call with no explicit authMode/forceLoginAsUser/defaultCredential still reuses a merely-cached browser session (not just one saved with authMode: 'interactive')", async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    await getTokens({
      state: freshState({ cachePath, deploymentType: 'cloud' }),
      autoRefresh: false,
      promptHandler,
    });
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);

    // Simulates the exact item 21 repro: a later, unrelated implicit
    // command whose own state never set authMode: 'interactive' at all
    // (no --browser flag this time, and the ad hoc login was never
    // --save'd, so no profile carries it either) — only the token cache
    // file is shared.
    const laterState = StateImpl({
      host: 'https://openam-session-reuse.example.com/am',
    });
    laterState.setUseTokenCache(true);
    laterState.setTokenCachePath(cachePath);
    laterState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    laterState.setDeploymentType('cloud');

    const later = await getTokens({
      state: laterState,
      autoRefresh: false,
      promptHandler,
    });
    expect(later.subject).toBe('jdoe');
    // Still never re-ran the actual interactive round trip.
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
  });

  test('7: an explicit forceLoginAsUser on that later call skips the merely-cached browser session instead of silently reusing it', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    await getTokens({
      state: freshState({ cachePath, deploymentType: 'cloud' }),
      autoRefresh: false,
      promptHandler,
    });

    const laterState = StateImpl({
      host: 'https://openam-session-reuse.example.com/am',
    });
    laterState.setUseTokenCache(true);
    laterState.setTokenCachePath(cachePath);
    laterState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    laterState.setDeploymentType('cloud');

    // No service account/Amster/plain-user credential is configured on this
    // state at all, so if the explicit override is honored (skipping the
    // cached browser session), this has nothing left to fall back to and
    // must reject — proving it didn't silently reuse 'jdoe's cached
    // session, which would have resolved successfully instead.
    await expect(
      getTokens({
        state: laterState,
        autoRefresh: false,
        forceLoginAsUser: true,
        promptHandler,
      })
    ).rejects.toThrow();
  });

  test("8: credentialOverride 'browser' reuses a merely-cached session on a later call with nothing else configured, same as the ambient default", async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    await getTokens({
      state: freshState({ cachePath, deploymentType: 'cloud' }),
      autoRefresh: false,
      promptHandler,
    });

    const laterState = StateImpl({
      host: 'https://openam-session-reuse.example.com/am',
    });
    laterState.setUseTokenCache(true);
    laterState.setTokenCachePath(cachePath);
    laterState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    laterState.setDeploymentType('cloud');

    const later = await getTokens({
      state: laterState,
      autoRefresh: false,
      credentialOverride: 'browser',
      promptHandler,
    });
    expect(later.subject).toBe('jdoe');
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
  });

  test("9: credentialOverride 'browser' with no cached session at all fails clearly instead of falling back to a fresh interactive login or a different credential", async () => {
    const laterState = StateImpl({
      host: 'https://openam-session-reuse.example.com/am',
    });
    laterState.setUseTokenCache(true);
    laterState.setTokenCachePath(
      resolve(TMP_DIR, `${Math.random()}.TokenCache.json`)
    );
    laterState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    laterState.setDeploymentType('cloud');

    let caught: any;
    try {
      await getTokens({
        state: laterState,
        autoRefresh: false,
        credentialOverride: 'browser',
        promptHandler,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect(caught.originalErrors?.[0]?.message).toMatch(
      /No valid cached browser-login session/
    );
    expect(runInteractiveAuthorizationCodeFlow).not.toHaveBeenCalled();
  });

  test("10: credentialOverride 'browser' wins even over a saved defaultCredential that would otherwise skip the cached session entirely", async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    await getTokens({
      state: freshState({ cachePath, deploymentType: 'cloud' }),
      autoRefresh: false,
      promptHandler,
    });

    const laterState = StateImpl({
      host: 'https://openam-session-reuse.example.com/am',
    });
    laterState.setUseTokenCache(true);
    laterState.setTokenCachePath(cachePath);
    laterState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    laterState.setDeploymentType('cloud');
    // Without credentialOverride, this alone would make tryBrowserLogin()
    // skip the cached session entirely (per test 7's own mechanism) — and
    // since nothing else is configured, getTokens() would reject.
    laterState.setDefaultCredential('svcacct');

    const later = await getTokens({
      state: laterState,
      autoRefresh: false,
      credentialOverride: 'browser',
      promptHandler,
    });
    expect(later.subject).toBe('jdoe');
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
  });
});

describe('a cached browser-login session is found whatever the command line named the host', () => {
  const promptHandler = jest.fn(async () => {});
  const URL_HOST = 'https://openam-session-reuse.example.com/am';
  let cachePath: string;
  let profilesPath: string;

  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    runInteractiveAuthorizationCodeFlow.mockReset();
    getTokenInfo.mockReset();
    authorize.mockReset();
    cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    profilesPath = resolve(TMP_DIR, `${Math.random()}.Connections.json`);
  });

  const loginResult = (expiresInMs = 1_800_000) => ({
    access_token: fakeAccessTokenJwt('jdoe'),
    token_type: 'Bearer',
    scope: 'fr:idm:*',
    expires_in: expiresInMs / 1000,
    expires: Date.now() + expiresInMs,
  });

  /** A first login against the full URL puts a session in the cache. */
  async function seedSession(expiresInMs?: number) {
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce(
      loginResult(expiresInMs)
    );
    await getTokens({
      state: freshState({ cachePath, deploymentType: 'cloud' }),
      autoRefresh: false,
      promptHandler,
    });
    runInteractiveAuthorizationCodeFlow.mockClear();
  }

  /** A later invocation: same cache, nothing but a host on the command line. */
  function laterState(host: string, authMode?: 'interactive') {
    const state = StateImpl({ host });
    state.setUseTokenCache(true);
    state.setTokenCachePath(cachePath);
    state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    state.setConnectionProfilesPath(profilesPath);
    if (authMode) state.setAuthMode(authMode);
    state.setBrowserLoginClientId('my-browser-client');
    return state;
  }

  async function saveProfile(deploymentType?: string, alias?: string) {
    const { saveConnectionProfile } = await import('./ConnectionProfileOps');
    const state = laterState(URL_HOST);
    if (deploymentType) state.setDeploymentType(deploymentType);
    if (alias) state.setAlias(alias);
    await saveConnectionProfile({ host: URL_HOST, state });
  }

  const probeAsCloud = () =>
    authorize.mockImplementation(async (args: any) => {
      const clientId = String(args.data.match(/client_id=([^&]+)/)?.[1]);
      throw {
        response:
          clientId === 'idmAdminClient'
            ? { status: 302, headers: { location: `${URL_HOST}/UI/Login` } }
            : { status: 400, headers: {} },
      };
    });

  test('1: --browser with an alias and no --type reuses the session cached under the full URL, without a probe', async () => {
    await seedSession();
    await saveProfile('cloud', 'reuse-alias');

    const tokens = await getTokens({
      state: laterState('reuse-alias', 'interactive'),
      autoRefresh: false,
      promptHandler,
    });

    expect(tokens.subject).toBe('jdoe');
    expect(tokens.host).toBe(URL_HOST);
    expect(runInteractiveAuthorizationCodeFlow).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  });

  test('2: --browser with the full URL, no profile and no --type learns the type by probe and reuses the session', async () => {
    await seedSession();
    probeAsCloud();

    const tokens = await getTokens({
      state: laterState(URL_HOST, 'interactive'),
      autoRefresh: false,
      promptHandler,
    });

    expect(tokens.subject).toBe('jdoe');
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(runInteractiveAuthorizationCodeFlow).not.toHaveBeenCalled();
  });

  test('3: --browser with no cached session probes for the type and then logs in', async () => {
    probeAsCloud();
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce(loginResult());

    const state = laterState(URL_HOST, 'interactive');
    const tokens = await getTokens({
      state,
      autoRefresh: false,
      promptHandler,
    });

    expect(tokens.subject).toBe('jdoe');
    expect(state.getDeploymentType()).toBe('cloud');
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
  });

  test('4: a command with no --browser and a saved profile without a type learns it by probe, but only because a session is cached', async () => {
    await seedSession();
    await saveProfile(undefined);
    probeAsCloud();

    const tokens = await getTokens({
      state: laterState(URL_HOST),
      autoRefresh: false,
      promptHandler,
    });

    expect(tokens.subject).toBe('jdoe');
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(runInteractiveAuthorizationCodeFlow).not.toHaveBeenCalled();
  });

  test('5: a command that has no cached session never pays for a probe', async () => {
    await saveProfile(undefined);
    probeAsCloud();

    await expect(
      getTokens({
        state: laterState(URL_HOST),
        autoRefresh: false,
        promptHandler,
      })
    ).rejects.toBeDefined();

    expect(authorize).not.toHaveBeenCalled();
  });

  test('6: --credential browser with an alias finds the cached session', async () => {
    await seedSession();
    await saveProfile('cloud', 'reuse-alias');

    const tokens = await getTokens({
      state: laterState('reuse-alias'),
      autoRefresh: false,
      credentialOverride: 'browser',
      promptHandler,
    });

    expect(tokens.subject).toBe('jdoe');
    expect(runInteractiveAuthorizationCodeFlow).not.toHaveBeenCalled();
  });

  describe('hasCachedBrowserSession()', () => {
    const check = (host: string, state = laterState('unused')) =>
      AuthenticateOpsFacade(state).hasCachedBrowserSession(host);
    let AuthenticateOpsFacade: any;
    beforeAll(async () => {
      AuthenticateOpsFacade = (await import('./AuthenticateOps')).default;
    });

    test('7: true for a fresh session, by URL, alias or substring, and it changes nothing on the state', async () => {
      await seedSession();
      await saveProfile('cloud', 'reuse-alias');
      const state = laterState('unused');

      expect(check(URL_HOST, state)).toBe(true);
      expect(check('reuse-alias', state)).toBe(true);
      expect(check('session-reuse', state)).toBe(true);
      expect(state.getHost()).toBe('unused');
      expect(state.getDeploymentType()).toBeUndefined();
    });

    test('8: false without a cache, for another host and when caching is off', async () => {
      expect(check(URL_HOST)).toBe(false);
      await seedSession();
      expect(check('https://openam-other.example.com/am')).toBe(false);
      const off = laterState('unused');
      off.setUseTokenCache(false);
      expect(check(URL_HOST, off)).toBe(false);
    });

    test('9: a session with less than 30 seconds left does not count, one with more does', async () => {
      await seedSession(20_000);
      expect(check(URL_HOST)).toBe(false);
      await seedSession(120_000);
      expect(check(URL_HOST)).toBe(true);
    });

    test('10: agrees with the real cache read about the 30 second headroom', async () => {
      const { readToken } = await import('./TokenCacheOps');
      await seedSession(20_000);
      const stale = laterState(URL_HOST);
      expect(check(URL_HOST, stale)).toBe(false);
      await expect(
        readToken({ tokenType: 'browserUserBearer', state: stale })
      ).rejects.toBeDefined();
      await seedSession(120_000);
      const fresh = laterState(URL_HOST);
      expect(check(URL_HOST, fresh)).toBe(true);
      await expect(
        readToken({ tokenType: 'browserUserBearer', state: fresh })
      ).resolves.toBeDefined();
    });
  });
});
