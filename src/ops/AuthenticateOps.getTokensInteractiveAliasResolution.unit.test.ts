/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.getTokensInteractiveAliasResolution
 *
 * Regression coverage for a live-repro'd bug: `frodo login <alias>
 * --browser`/`--device` failed with "Invalid URL" because
 * getTokensInteractive() — unlike getTokens()'s implicit path — never
 * resolved a non-URL host argument (a saved connection profile's alias or a
 * unique substring of its tenant URL) to a full URL before handing it to
 * the browser-login flow's `new URL(...)` calls. Real, isolated file I/O for
 * the connection profile (not mocked) — only the network-facing
 * browser-login primitives are mocked.
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
const exchangeTokenForScope = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('exchangeTokenForScope mock not configured');
});

jest.unstable_mockModule('./BrowserAuthenticateOps', () => ({
  runInteractiveAuthorizationCodeFlow,
  startDeviceAuthorizationFlow,
  refreshBrowserBearerToken,
  exchangeTokenForScope,
  readMayActClientId: () => undefined,
}));

const getAuthenticationSettings = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const putAuthenticationSettings = jest.fn(
  async (_args?: any): Promise<any> => ({})
);

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

// With no type from the caller or a saved profile, browser login asks the
// anonymous probe; this host does not answer, which is inconclusive.
const authorize = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('getaddrinfo ENOTFOUND');
});
jest.unstable_mockModule('./OAuth2OidcOps', () => ({
  authorize,
  accessToken: jest.fn(),
  accessTokenRfc7523AuthZGrant: jest.fn(),
  deviceAuthorizationRequest: jest.fn(),
  getTokenInfo: jest.fn(),
  clientCredentialsGrant: jest.fn(),
}));

// ConnectionProfileOps.ts is deliberately NOT mocked here — this test needs
// the real save/load round trip and the real alias/substring matching in
// findConnectionProfiles().
const { getTokensInteractive } = await import('./AuthenticateOps');
const { saveConnectionProfile } = await import('./ConnectionProfileOps');
const { default: StateImpl } = await import('../shared/State');

const TMP_DIR = resolve(
  '.',
  'test',
  'fs_tmp',
  'AuthenticateOps.getTokensInteractiveAliasResolution'
);

function fakeAccessTokenJwt(sub: string): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode({ sub })}.fake-signature`;
}

describe('getTokensInteractive() resolves a non-URL host before use', () => {
  const connectionProfilesPath = resolve(TMP_DIR, 'connections.json');
  const host = 'https://openam-volker-dev.forgeblocks.com/am';
  const promptHandler = jest.fn(async () => {});

  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    runInteractiveAuthorizationCodeFlow.mockReset();
  });

  test('1: a unique substring of a saved profile\'s host resolves to the full URL instead of throwing "Invalid URL"', async () => {
    const saveState = StateImpl({ host });
    saveState.setConnectionProfilesPath(connectionProfilesPath);
    saveState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    saveState.setDeploymentType('cloud');
    await saveConnectionProfile({ host, state: saveState });

    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('volker.scheuber@pingidentity.com'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    // Exactly the reported repro: `frodo login volker-dev --browser --type
    // cloud` — a bare substring, not a URL, with no other host resolution
    // step run beforehand (login.ts calls getTokensInteractive() directly).
    const invocationState = StateImpl({ host: 'volker-dev' });
    invocationState.setConnectionProfilesPath(connectionProfilesPath);
    invocationState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    invocationState.setDeploymentType('cloud');

    const tokens = await getTokensInteractive({
      state: invocationState,
      promptHandler,
    });

    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    expect(tokens.host).toBe(host);
    expect(invocationState.getHost()).toBe(host);
  });

  test('2: an already-full URL is left untouched and never triggers a connection-profile lookup', async () => {
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    // No connection profile saved for this host at all — if the fix
    // incorrectly ran alias resolution on an already-valid URL, this would
    // throw "No connection profile found matching ...".
    const invocationState = StateImpl({
      host: 'https://openam-unrelated-host.forgeblocks.com/am',
    });
    invocationState.setConnectionProfilesPath(connectionProfilesPath);
    invocationState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    invocationState.setDeploymentType('cloud');

    const tokens = await getTokensInteractive({
      state: invocationState,
      promptHandler,
    });

    expect(tokens.host).toBe(
      'https://openam-unrelated-host.forgeblocks.com/am'
    );
  });

  test('3: a non-URL host with no matching saved profile still fails clearly, not with "Invalid URL"', async () => {
    const invocationState = StateImpl({ host: 'no-such-alias' });
    invocationState.setConnectionProfilesPath(connectionProfilesPath);
    invocationState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    invocationState.setDeploymentType('cloud');

    // getTokensInteractive() wraps the underlying failure as
    // `originalErrors[0]` on its own "Error getting tokens interactively"
    // FrodoError — assert on the wrapped cause, which is exactly what
    // regressed before this fix: it used to be "Invalid URL" (from a raw
    // `new URL('no-such-alias/oauth2/authorize')`) instead of a clear
    // "no matching connection profile" message.
    let caught: any;
    try {
      await getTokensInteractive({ state: invocationState, promptHandler });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect(caught.originalErrors?.[0]?.message).toMatch(
      /No connection profile found matching/
    );
  });

  test("4: a saved profile's deploymentType is used when the invocation supplies none — no --type needed for a known alias", async () => {
    const saveState = StateImpl({ host });
    saveState.setConnectionProfilesPath(connectionProfilesPath);
    saveState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    saveState.setDeploymentType('cloud');
    await saveConnectionProfile({ host, state: saveState });

    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('volker.scheuber@pingidentity.com'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    // Exactly the second reported repro: `frodo login volker-dev --browser`
    // with no --type at all — deploymentType is deliberately left unset
    // here to prove it comes from the saved profile, not a test fixture
    // default.
    const invocationState = StateImpl({ host: 'volker-dev' });
    invocationState.setConnectionProfilesPath(connectionProfilesPath);
    invocationState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));

    const tokens = await getTokensInteractive({
      state: invocationState,
      promptHandler,
    });

    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    expect(tokens.host).toBe(host);
    expect(invocationState.getDeploymentType()).toBe('cloud');
  });

  test("5: an explicit deploymentType always wins over a saved profile's own value", async () => {
    // Saved profile says 'forgeops' (a materially different flow — session
    // capture, not OAuth2 authorization-code); the invocation explicitly
    // says 'cloud'. Only cloud's flow is mocked below, so this only passes
    // if the explicit value actually won and the profile's was ignored.
    const saveState = StateImpl({ host });
    saveState.setConnectionProfilesPath(connectionProfilesPath);
    saveState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    saveState.setDeploymentType('forgeops');
    await saveConnectionProfile({ host, state: saveState });

    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('volker.scheuber@pingidentity.com'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    const invocationState = StateImpl({ host: 'volker-dev' });
    invocationState.setConnectionProfilesPath(connectionProfilesPath);
    invocationState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    invocationState.setDeploymentType('cloud');

    await getTokensInteractive({ state: invocationState, promptHandler });

    expect(invocationState.getDeploymentType()).toBe('cloud');
  });

  test('6: an already-full URL with no saved profile, no explicit type and an inconclusive probe still fails clearly', async () => {
    const invocationState = StateImpl({
      host: 'https://openam-no-profile-no-type.forgeblocks.com/am',
    });
    invocationState.setConnectionProfilesPath(connectionProfilesPath);
    invocationState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));

    let caught: any;
    try {
      await getTokensInteractive({ state: invocationState, promptHandler });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect(caught.originalErrors?.[0]?.message).toMatch(
      /could not determine the deployment type of https:\/\/openam-no-profile-no-type\.forgeblocks\.com\/am/
    );
    expect(authorize).toHaveBeenCalledTimes(2);
  });

  const cloudAnswers = (clientId: string) => {
    throw {
      response:
        clientId === 'idmAdminClient'
          ? {
              status: 302,
              headers: {
                location: 'https://x.example.com/am/UI/Login?realm=/',
              },
            }
          : { status: 400, headers: {} },
    };
  };
  const answerAs = (answer: (clientId: string) => never) =>
    authorize.mockImplementation(async (args: any) =>
      answer(String(args.data.match(/client_id=([^&]+)/)?.[1]))
    );
  const successfulLogin = () =>
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

  test('7: no type anywhere: the anonymous probe finds cloud and the login goes ahead', async () => {
    authorize.mockReset();
    answerAs(cloudAnswers);
    successfulLogin();
    const invocationState = StateImpl({
      host: 'https://openam-probed.forgeblocks.com/am',
    });
    invocationState.setConnectionProfilesPath(connectionProfilesPath);
    invocationState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));

    await getTokensInteractive({ state: invocationState, promptHandler });

    expect(authorize).toHaveBeenCalledTimes(2);
    expect(invocationState.getDeploymentType()).toBe('cloud');
    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
  });

  test('8: an explicit type never probes', async () => {
    authorize.mockReset();
    successfulLogin();
    const invocationState = StateImpl({
      host: 'https://openam-explicit.forgeblocks.com/am',
    });
    invocationState.setConnectionProfilesPath(connectionProfilesPath);
    invocationState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));

    await getTokensInteractive({
      state: invocationState,
      deploymentType: 'cloud',
      promptHandler,
    });

    expect(authorize).not.toHaveBeenCalled();
  });

  test("9: a full URL finds its saved profile: the profile's type is used and the probe is not", async () => {
    const saveState = StateImpl({ host });
    saveState.setConnectionProfilesPath(connectionProfilesPath);
    saveState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    saveState.setDeploymentType('cloud');
    await saveConnectionProfile({ host, state: saveState });
    authorize.mockReset();
    successfulLogin();

    const invocationState = StateImpl({ host });
    invocationState.setConnectionProfilesPath(connectionProfilesPath);
    invocationState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));

    await getTokensInteractive({ state: invocationState, promptHandler });

    expect(invocationState.getDeploymentType()).toBe('cloud');
    expect(authorize).not.toHaveBeenCalled();
  });

  test("10: the saved profile's connection settings are adopted, its credentials are not", async () => {
    const insecureHost = 'https://openam-insecure.forgeblocks.com/am';
    const saveState = StateImpl({ host: insecureHost });
    saveState.setConnectionProfilesPath(connectionProfilesPath);
    saveState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    saveState.setDeploymentType('cloud');
    saveState.setAllowInsecureConnection(true);
    saveState.setAuthenticationHeaderOverrides({ 'X-Gateway': 'ok' });
    saveState.setUsername('saved.user');
    saveState.setPassword('saved-password');
    await saveConnectionProfile({ host: insecureHost, state: saveState });
    successfulLogin();

    const invocationState = StateImpl({ host: insecureHost });
    invocationState.setConnectionProfilesPath(connectionProfilesPath);
    invocationState.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));

    await getTokensInteractive({ state: invocationState, promptHandler });

    expect(invocationState.getAllowInsecureConnection()).toBe(true);
    expect(invocationState.getAuthenticationHeaderOverrides()).toEqual({
      'X-Gateway': 'ok',
    });
    expect(invocationState.getPassword()).toBeUndefined();
  });

  test('11: classic is chosen only when the probe is conclusive', async () => {
    // both clients answer 400: an AM without the built-in clients
    authorize.mockReset();
    answerAs(() => {
      throw { response: { status: 400, headers: {} } };
    });
    const conclusive = StateImpl({
      host: 'https://openam-classic.example.com/am',
    });
    conclusive.setConnectionProfilesPath(connectionProfilesPath);
    conclusive.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    await getTokensInteractive({ state: conclusive, promptHandler }).catch(
      () => undefined
    );
    expect(conclusive.getDeploymentType()).toBe('classic');

    // a 404 everywhere: not an AM, no type, a clear error
    authorize.mockReset();
    answerAs(() => {
      throw { response: { status: 404, headers: {} } };
    });
    const inconclusive = StateImpl({
      host: 'https://not-an-am.example.com/am',
    });
    inconclusive.setConnectionProfilesPath(connectionProfilesPath);
    inconclusive.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    await expect(
      getTokensInteractive({ state: inconclusive, promptHandler })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({
          message: expect.stringMatching(
            /could not determine the deployment type/
          ),
        }),
      ],
    });
    expect(inconclusive.getDeploymentType()).toBeUndefined();
  });
});
