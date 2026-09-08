/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.sessionExpiry
 *
 * Regression test for a real bug: getFreshUserSessionToken() used to record
 * only maxIdleExpirationTime as the session's effective expiry, ignoring
 * maxSessionExpirationTime — a separate, independent absolute cap that can
 * be shorter than the idle timeout. The effective expiry must be whichever
 * of the two comes first.
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

const getServerInfo = jest.fn(async (_args?: any): Promise<any> => ({
  cookieName: 'iPlanetDirectoryPro',
}));

const getServerVersionInfo = jest.fn(async (_args?: any): Promise<any> => ({
  fullVersion: 'ForgeRock Access Management 7.3.0',
  version: '7.3.0',
}));

jest.unstable_mockModule('../api/ServerInfoApi', () => ({
  getServerInfo,
  getServerVersionInfo,
  getIdmServerVersionInfo: jest.fn(),
}));

const step = jest.fn(async (_args?: any): Promise<any> => ({
  tokenId: 'fake-token-id',
  successUrl: '/console',
  realm: '/',
}));

jest.unstable_mockModule('../api/AuthenticateApi', () => ({
  step,
}));

let sessionInfoResponse: { maxIdleExpirationTime: string; maxSessionExpirationTime: string };
const getSessionInfo = jest.fn(async (_args?: any): Promise<any> => sessionInfoResponse);

jest.unstable_mockModule('./SessionOps', () => ({
  getSessionInfo,
}));

// Not exercised by this test's code path (getUserSessionToken() isn't the
// interactive browser-login flow lookupCallerPrivilegeGroups() is called
// from), but AuthenticateOps.ts imports it (transitively, via
// CallerTrustTierOps.ts) at module load time, so the mock must still
// provide it.
const readUser = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('./UserOps', () => ({
  readUser,
}));

const { getTokens } = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');
const Constants = (await import('../shared/Constants')).default;

describe('AuthenticateOps user session expiry', () => {
  beforeEach(() => {
    getConnectionProfile.mockClear();
    loadConnectionProfile.mockClear();
    getServerInfo.mockClear();
    getServerVersionInfo.mockClear();
    step.mockClear();
    getSessionInfo.mockClear();
  });

  test('0: Method is implemented', () => {
    expect(getTokens).toBeDefined();
  });

  test('1: Effective expiry is maxSessionExpirationTime when it is earlier than maxIdleExpirationTime', async () => {
    const earlier = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes out
    const later = new Date(Date.now() + 60 * 60 * 1000); // 1 hour out
    sessionInfoResponse = {
      maxIdleExpirationTime: later.toISOString(),
      maxSessionExpirationTime: earlier.toISOString(),
    };

    const state = StateImpl({
      host: 'https://openam-example.forgeblocks.com/am',
      username: 'amadmin',
      password: 'secret',
      deploymentType: Constants.CLASSIC_DEPLOYMENT_TYPE_KEY,
    });

    await getTokens({ state, autoRefresh: false });

    expect(state.getUserSessionTokenMeta().expires).toBe(earlier.getTime());
  });

  test('2: Effective expiry is maxIdleExpirationTime when it is earlier than maxSessionExpirationTime', async () => {
    const earlier = new Date(Date.now() + 5 * 60 * 1000);
    const later = new Date(Date.now() + 60 * 60 * 1000);
    sessionInfoResponse = {
      maxIdleExpirationTime: earlier.toISOString(),
      maxSessionExpirationTime: later.toISOString(),
    };

    const state = StateImpl({
      host: 'https://openam-example.forgeblocks.com/am',
      username: 'amadmin',
      password: 'secret',
      deploymentType: Constants.CLASSIC_DEPLOYMENT_TYPE_KEY,
    });

    await getTokens({ state, autoRefresh: false });

    expect(state.getUserSessionTokenMeta().expires).toBe(earlier.getTime());
  });
});
