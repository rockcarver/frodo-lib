/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.browserLoginProfileReuse
 *
 * Regression coverage for the exact workflow the user asked about: save a
 * browser-login connection profile once (e.g. via `frodo conn save
 * --browser --login-client-id <id>`), persisting the OAuth2 client id, then
 * on a *separate*, later invocation against the same host — with none of
 * those flags repeated — getTokens() must load the saved profile and
 * transparently re-trigger the interactive flow using the *saved* client
 * id, not require it again. Real, isolated file I/O for the connection
 * profile (not mocked) — only the actual network-facing browser-login
 * primitives are mocked.
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

const getAuthenticationSettings = jest.fn(async (_args?: any): Promise<any> => ({}));
const putAuthenticationSettings = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/AuthenticationSettingsApi', () => ({
  getAuthenticationSettings,
  putAuthenticationSettings,
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

import fs from 'fs';
import { resolve } from 'path';

// ConnectionProfileOps.ts is deliberately NOT mocked here — this test needs
// the real save/load round trip.
const { getTokens } = await import('./AuthenticateOps');
const { saveConnectionProfile } = await import('./ConnectionProfileOps');
const { default: StateImpl } = await import('../shared/State');

const TMP_DIR = resolve(
  '.',
  'test',
  'fs_tmp',
  'AuthenticateOps.browserLoginProfileReuse'
);

function fakeAccessTokenJwt(sub: string): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode({ sub })}.fake-signature`;
}

describe('Reusing a saved browser-login connection profile (no flags repeated)', () => {
  const connectionProfilesPath = resolve(TMP_DIR, 'connections.json');
  const host = 'https://openam-forgeops-reuse.example.com/am';
  const promptHandler = jest.fn(async () => {});

  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    // A stable, pre-existing master key avoids DataProtection's own
    // async auto-generate-on-first-use path racing with afterAll's cleanup
    // below — see TokenCacheOps.browserToken.unit.test.ts's identical fix.
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    runInteractiveAuthorizationCodeFlow.mockReset();
  });

  test('A fresh invocation against a saved host uses the saved client id, scope, and redirect URI automatically', async () => {
    // Step 1: simulate `frodo conn save --browser --login-client-id
    // my-saved-client --login-scope "openid fr:idm:*" --type forgeops
    // <host>` — the caller supplies the client id explicitly once, and it
    // gets persisted.
    const saveState = StateImpl({ host });
    saveState.setConnectionProfilesPath(connectionProfilesPath);
    saveState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    saveState.setDeploymentType('forgeops');
    saveState.setAuthMode('interactive');
    saveState.setBrowserLoginClientId('my-saved-client');
    saveState.setBrowserLoginScope('openid fr:idm:*');
    // Shared with the non-interactive synthetic flow's own
    // --login-redirect-uri field — see AuthenticateOps.cloudInteractive
    // .unit.test.ts test 6 for the same sharing behavior on cloud.
    saveState.setAdminClientRedirectUri('http://127.0.0.1:54321/callback');
    await saveConnectionProfile({ host, state: saveState });

    // Step 2: simulate a completely separate, later invocation — a brand
    // new State (as a fresh CLI process would have), no client id, no
    // scope, no authMode: just the host. Nothing here tells getTokens()
    // this is a browser-login host except the saved profile itself.
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'openid fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
    const freshInvocationState = StateImpl({ host });
    freshInvocationState.setConnectionProfilesPath(connectionProfilesPath);
    freshInvocationState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));

    const tokens = await getTokens({
      state: freshInvocationState,
      autoRefresh: false,
      promptHandler,
    });

    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    const call = runInteractiveAuthorizationCodeFlow.mock.calls[0][0] as {
      clientId: string;
      scope: string;
      redirectUri: string;
    };
    expect(call.clientId).toBe('my-saved-client');
    expect(call.scope).toBe('openid fr:idm:*');
    expect(call.redirectUri).toBe('http://127.0.0.1:54321/callback');
    expect(tokens.subject).toBe('jdoe');
  });
});
