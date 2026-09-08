/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.deviceFlowNonLogin
 *
 * `frodo login --device` calls `getTokensInteractive()` directly, and that
 * path already has coverage (BrowserAuthenticateOps.deviceFlow.test.ts,
 * AuthenticateOps.cloudInteractive.unit.test.ts, etc.). But every other CLI
 * command reaches browser/device login only through `getTokens()`'s
 * implicit `tryBrowserLogin()` branch (see AuthenticateOps.
 * browserModeBranch.unit.test.ts for that branch's non-device coverage) —
 * confirmed empirically (2026-09-06, `frodo journey list <host> --device
 * --type cloud` against a real tenant) to already work, since `getTokens()`
 * forwards its own `useDeviceFlow` parameter straight into
 * `getTokensInteractive()`. No test asserted on that specific forwarding
 * before this file: it's the concrete, previously-uncovered case of
 * `--device` being used on a command other than `login`.
 */
import { jest } from '@jest/globals';

const getConnectionProfile = jest.fn(async (_args?: any): Promise<any> => ({}));
const loadConnectionProfile = jest.fn(async (_args?: any): Promise<any> => false);
const saveConnectionProfile = jest.fn(async (_args?: any): Promise<any> => true);

jest.unstable_mockModule('./ConnectionProfileOps', () => ({
  getConnectionProfile,
  loadConnectionProfile,
  saveConnectionProfile,
}));

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

// lookupCallerPrivilegeGroups() (CallerTrustTierOps.ts) calls readUser() at
// fresh-login time to capture the caller's admin role/group for `frodo
// session describe` — mocked so that stays hermetic instead of attempting a
// real network call against this test's fake host.
const readUser = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('./UserOps', () => ({
  readUser,
}));

const { getTokens } = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');

function fakeAccessTokenJwt(sub: string): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode({ sub })}.fake-signature`;
}

describe("getTokens()'s implicit browser-login branch forwards useDeviceFlow (e.g. a non-login CLI command run with --device)", () => {
  beforeEach(() => {
    runInteractiveAuthorizationCodeFlow.mockReset();
    startDeviceAuthorizationFlow.mockReset();
    saveConnectionProfile.mockClear();
  });

  test('1: useDeviceFlow: true drives the device-authorization grant, not the loopback-redirect flow, through getTokens() (not getTokensInteractive() directly)', async () => {
    const state = StateImpl({
      host: 'https://openam-cloud.example.com/am',
      deploymentType: 'cloud',
    });
    state.setAuthMode('interactive');
    const promptHandler = jest.fn(async () => {});
    startDeviceAuthorizationFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    await getTokens({
      state,
      autoRefresh: false,
      useDeviceFlow: true,
      promptHandler,
    });

    expect(startDeviceAuthorizationFlow).toHaveBeenCalledTimes(1);
    expect(runInteractiveAuthorizationCodeFlow).not.toHaveBeenCalled();
  });

  test('2: useDeviceFlow: false (or omitted) still uses the loopback-redirect flow through getTokens()', async () => {
    const state = StateImpl({
      host: 'https://openam-cloud.example.com/am',
      deploymentType: 'cloud',
    });
    state.setAuthMode('interactive');
    const promptHandler = jest.fn(async () => {});
    runInteractiveAuthorizationCodeFlow.mockResolvedValueOnce({
      access_token: fakeAccessTokenJwt('jdoe'),
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    await getTokens({
      state,
      autoRefresh: false,
      promptHandler,
    });

    expect(runInteractiveAuthorizationCodeFlow).toHaveBeenCalledTimes(1);
    expect(startDeviceAuthorizationFlow).not.toHaveBeenCalled();
  });
});
