/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.emptyTokenId
 *
 * Regression tests for frodo-lib#897. With HttpOnly session cookies enabled,
 * AM answers a login that carries a valid session with an empty tokenId. The
 * login of a user must therefore not send the session the state already holds,
 * must refuse an empty tokenId instead of installing it, and a session whose
 * expiry is unknown must not start an auto refresh timer that fires at once.
 */
import { jest } from '@jest/globals';

jest.unstable_mockModule('./ConnectionProfileOps', () => ({
  findSavedConnectionTarget: () => undefined,
  decryptSavedAuthenticationHeaderOverrides: async () => ({}),
  getConnectionProfile: jest.fn(async (_args?: any): Promise<any> => ({})),
  loadConnectionProfile: jest.fn(async (_args?: any): Promise<any> => false),
  saveConnectionProfile: jest.fn(async (_args?: any): Promise<any> => true),
}));

jest.unstable_mockModule('../api/ServerInfoApi', () => ({
  getServerInfo: jest.fn(async (_args?: any): Promise<any> => ({
    cookieName: 'iPlanetDirectoryPro',
  })),
  getServerVersionInfo: jest.fn(async (_args?: any): Promise<any> => ({
    fullVersion: 'ForgeRock Access Management 7.3.0',
    version: '7.3.0',
  })),
  getIdmServerVersionInfo: jest.fn(),
}));

let stepResponse: Record<string, unknown>;
const step = jest.fn(async (_args?: any): Promise<any> => stepResponse);

jest.unstable_mockModule('../api/AuthenticateApi', () => ({
  step,
}));

let sessionInfoResponse: Record<string, unknown>;
const getSessionInfo = jest.fn(
  async (_args?: any): Promise<any> => sessionInfoResponse
);

jest.unstable_mockModule('./SessionOps', () => ({
  getSessionInfo,
}));

jest.unstable_mockModule('./UserOps', () => ({
  readUser: jest.fn(async (_args?: any): Promise<any> => ({})),
}));

const { getTokens } = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');
const Constants = (await import('../shared/Constants')).default;

function classicState() {
  return StateImpl({
    host: 'https://openam-example.example.com/am',
    username: 'amadmin',
    password: 'secret',
    deploymentType: Constants.CLASSIC_DEPLOYMENT_TYPE_KEY,
  });
}

function validSessionInfo() {
  return {
    maxIdleExpirationTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    maxSessionExpirationTime: new Date(
      Date.now() + 60 * 60 * 1000
    ).toISOString(),
  };
}

describe('AuthenticateOps user login with a session already in the state', () => {
  beforeEach(() => {
    step.mockClear();
    getSessionInfo.mockClear();
    stepResponse = { tokenId: 'new-token-id', successUrl: '/', realm: '/' };
    sessionInfoResponse = validSessionInfo();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('0: Method is implemented', () => {
    expect(getTokens).toBeDefined();
  });

  test('1: The login steps are sent without the session the state holds', async () => {
    const state = classicState();
    await getTokens({ state, autoRefresh: false });
    expect(step).toHaveBeenCalled();
    for (const [args] of step.mock.calls as any[][]) {
      expect(args.anonymous).toBe(true);
    }
  });

  test('2: An empty tokenId fails the login and leaves the session of the state alone', async () => {
    const state = classicState();
    const existing = {
      tokenId: 'existing-token-id',
      successUrl: '/',
      realm: '/',
      expires: Date.now() + 30 * 60 * 1000,
    };
    state.setUserSessionTokenMeta(existing);
    stepResponse = { tokenId: '', successUrl: '/', realm: '/' };

    await expect(getTokens({ state, autoRefresh: false })).rejects.toThrow(
      /Error getting tokens/
    );

    expect(getSessionInfo).not.toHaveBeenCalled();
    expect(state.getUserSessionTokenMeta()).toBe(existing);
    expect(state.getCookieValue()).toBe('existing-token-id');
  });

  test('3: A tokenId that is not a string is refused as well', async () => {
    const state = classicState();
    stepResponse = { tokenId: null, successUrl: '/', realm: '/' };

    await expect(getTokens({ state, autoRefresh: false })).rejects.toThrow();

    expect(getSessionInfo).not.toHaveBeenCalled();
    expect(state.getCookieValue()).toBeUndefined();
  });

  test('4: A session with a known expiry starts the auto refresh timer', async () => {
    const state = classicState();
    await getTokens({ state, autoRefresh: true });
    const timer = state.getAutoRefreshTimer();
    expect(timer).toBeDefined();
    clearTimeout(timer);
  });

  test('5: A session with an unknown expiry starts no auto refresh timer and no re-login loop', async () => {
    jest.useFakeTimers();
    const state = classicState();
    // what AM answers for a session id it does not report times for
    sessionInfoResponse = { valid: true };

    await getTokens({ state, autoRefresh: true });
    expect(state.getUserSessionTokenMeta().expires).toBeNaN();
    const stepsAfterLogin = step.mock.calls.length;

    await jest.advanceTimersByTimeAsync(60 * 1000);

    expect(state.getAutoRefreshTimer()).toBeUndefined();
    expect(step.mock.calls.length).toBe(stepsAfterLogin);
  });
});
