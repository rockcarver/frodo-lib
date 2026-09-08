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

const getAuthenticationSettings = jest.fn(async (_args?: any): Promise<any> => ({}));

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

import fs from 'fs';
import { resolve } from 'path';

const { getTokens } = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');

const TMP_DIR = resolve('.', 'test', 'fs_tmp', 'AuthenticateOps.browserSessionReuse');

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
      maxIdleExpirationTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      maxSessionExpirationTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
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
      maxIdleExpirationTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      maxSessionExpirationTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
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
});
