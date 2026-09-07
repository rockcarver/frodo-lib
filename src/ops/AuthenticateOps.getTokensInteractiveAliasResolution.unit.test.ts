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

import fs from 'fs';
import { resolve } from 'path';

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

    expect(tokens.host).toBe('https://openam-unrelated-host.forgeblocks.com/am');
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
});
