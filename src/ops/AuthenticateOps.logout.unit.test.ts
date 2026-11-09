/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.logout
 *
 * `login.logout()` and `login.dispose()` (frodo-lib#908). The library had no way
 * to end a session, so every session that an instance created lasted until its
 * own timeout. The rules (core record 0021): an explicit logout ends the session
 * and removes the token cache entries that hold it; disposing of an instance
 * ends only a session that it created and did not share, and leaves a session
 * that came out of the cache or went into it to expire, because another process
 * may use it. The tests talk to a fake AM that runs in the test process and
 * records the logouts it receives.
 */
import '../index';
import fs from 'fs';
import { resolve } from 'path';
import { jest } from '@jest/globals';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
import FrodoLib from '../lib/FrodoLib';
import { createJwkRsa } from './JoseOps';

const TMP_DIR = resolve('.', 'test', 'fs_tmp', 'AuthenticateOps.logout');

let am: FakeAm;

beforeAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  am = await startFakeAm();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await am.close();
});

/** A classic user instance; with a cache path the token cache is on, without it the cache is off. */
function userInstance(cachePath?: string) {
  const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
  frodo.state.setUseTokenCache(!!cachePath);
  if (cachePath) {
    frodo.state.setTokenCachePath(cachePath);
    frodo.state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
  }
  frodo.state.setUsername('someone');
  frodo.state.setPassword('password');
  return frodo;
}

async function serviceAccountInstance() {
  const frodo = FrodoLib({ host: am.host, deploymentType: 'cloud' });
  frodo.state.setUseTokenCache(false);
  frodo.state.setServiceAccountId('sa-1');
  frodo.state.setServiceAccountJwk(await createJwkRsa());
  return frodo;
}

function newCachePath() {
  return resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
}

function cacheEntries(cachePath: string) {
  const dir = cachePath.replace('.json', '');
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

function readJourneys(frodo: ReturnType<typeof FrodoLib>) {
  return frodo.authn.journey.readJourneys();
}

describe('login.logout(): the explicit logout', () => {
  test('0: the methods are on the facade', () => {
    const frodo = userInstance();
    expect(typeof frodo.login.logout).toBe('function');
    expect(typeof frodo.login.dispose).toBe('function');
  });

  test('1: it ends the session at AM with the session token, and the instance forgets everything', async () => {
    const frodo = userInstance();
    await frodo.login.getTokens();
    const tokenId = frodo.state.getUserSessionTokenMeta().tokenId;
    expect(frodo.state.getAutoRefreshTimer()).toBeDefined();
    // the login asks for the session info
    const sessionRequests = am.count('/sessions');

    const result = await frodo.login.logout();

    expect(result).toEqual({ userSession: 'ended', cacheEntriesRemoved: 0 });
    expect(am.loggedOut()).toEqual([tokenId]);
    expect(am.count('/sessions')).toBe(sessionRequests + 1);
    expect(frodo.state.getUserSessionTokenMeta()).toBeUndefined();
    expect(frodo.state.getBearerTokenMeta()).toBeUndefined();
    expect(frodo.state.getAutoRefreshTimer()).toBeUndefined();
    expect(frodo.state.getTokenRefreshHandler()).toBeUndefined();
    expect(frodo.state.getRejectedCredentialHandler()).toBeUndefined();
  });

  test('2: an instance without a user session has nothing to end: no request, nothing changes', async () => {
    const frodo = await serviceAccountInstance();
    await frodo.login.getTokens();
    const requests = am.requests.length;
    const bearer = frodo.state.getBearerToken();

    const result = await frodo.login.logout();

    expect(result).toEqual({ userSession: 'none', cacheEntriesRemoved: 0 });
    expect(am.requests.length).toBe(requests);
    expect(am.loggedOut()).toEqual([]);
    expect(frodo.state.getBearerToken()).toBe(bearer);
  });

  test('3: an instance that never logged in has nothing to end', async () => {
    const frodo = userInstance();
    expect(await frodo.login.logout()).toEqual({
      userSession: 'none',
      cacheEntriesRemoved: 0,
    });
    expect(am.requests).toEqual([]);
  });

  test('4: the session of an instance that created it and cached it is ended and its cache entry removed', async () => {
    const cachePath = newCachePath();
    const frodo = userInstance(cachePath);
    await frodo.login.getTokens();
    expect(cacheEntries(cachePath)).toHaveLength(1);

    const result = await frodo.login.logout();

    expect(result).toEqual({ userSession: 'ended', cacheEntriesRemoved: 1 });
    expect(cacheEntries(cachePath)).toHaveLength(0);
    // nothing in the cache for the next process: it logs in
    const next = userInstance(cachePath);
    await next.login.getTokens();
    expect(am.logins()).toBe(2);
  });

  test('5: a session that the instance restored from the cache is ended too, because the caller asked for it', async () => {
    const cachePath = newCachePath();
    await userInstance(cachePath).login.getTokens();
    expect(am.logins()).toBe(1);

    const second = userInstance(cachePath);
    await second.login.getTokens();
    expect(second.state.getUserSessionTokenMeta().from_cache).toBe(true);
    expect(am.logins()).toBe(1);

    const result = await second.login.logout();

    expect(result).toEqual({ userSession: 'ended', cacheEntriesRemoved: 1 });
    expect(am.loggedOut()).toEqual(['fake-session-1']);
    expect(cacheEntries(cachePath)).toHaveLength(0);
  });

  test('6: when AM refuses the logout it throws and the instance is left as it was', async () => {
    const cachePath = newCachePath();
    const frodo = userInstance(cachePath);
    await frodo.login.getTokens();
    // the session is gone at the server, so the logout is answered with 401
    am.revokeAll();
    const timer = frodo.state.getAutoRefreshTimer();

    await expect(frodo.login.logout()).rejects.toThrow('Error logging out');

    expect(frodo.state.getUserSessionTokenMeta()).toBeDefined();
    expect(frodo.state.getAutoRefreshTimer()).toBe(timer);
    expect(frodo.state.getTokenRefreshHandler()).toBeDefined();
    expect(cacheEntries(cachePath)).toHaveLength(1);
  });

  test('7: getTokens() logs in again after a logout', async () => {
    const frodo = userInstance();
    await frodo.login.getTokens();
    await frodo.login.logout();
    await frodo.login.getTokens();
    expect(am.logins()).toBe(2);
    expect(frodo.state.getAutoRefreshTimer()).toBeDefined();
    clearTimeout(frodo.state.getAutoRefreshTimer());
  });
});

describe('login.dispose(): the end of an instance', () => {
  test('1: with the cache off, the session that the instance created is ended; no timer, no handler, no credential', async () => {
    const frodo = userInstance();
    await frodo.login.getTokens();
    const tokenId = frodo.state.getUserSessionTokenMeta().tokenId;
    const timer = frodo.state.getAutoRefreshTimer();
    const clear = jest.spyOn(global, 'clearTimeout');

    const result = await frodo.login.dispose();

    expect(result).toEqual({ userSession: 'ended', cacheEntriesRemoved: 0 });
    expect(am.loggedOut()).toEqual([tokenId]);
    expect(clear).toHaveBeenCalledWith(timer);
    expect(frodo.state.getAutoRefreshTimer()).toBeUndefined();
    expect(frodo.state.getTokenRefreshHandler()).toBeUndefined();
    expect(frodo.state.getRejectedCredentialHandler()).toBeUndefined();
    expect(frodo.state.getUserSessionTokenMeta()).toBeUndefined();
  });

  test('2: with the cache on, a session that this instance created is left to expire: it went into the shared cache', async () => {
    const cachePath = newCachePath();
    const frodo = userInstance(cachePath);
    await frodo.login.getTokens();
    expect(frodo.state.getUserSessionTokenMeta().from_cache).toBe(false);
    const sessionRequests = am.count('/sessions');

    const result = await frodo.login.dispose();

    expect(result).toEqual({ userSession: 'kept', cacheEntriesRemoved: 0 });
    expect(am.loggedOut()).toEqual([]);
    expect(am.count('/sessions')).toBe(sessionRequests);
    expect(cacheEntries(cachePath)).toHaveLength(1);
    expect(frodo.state.getAutoRefreshTimer()).toBeUndefined();
    expect(frodo.state.getTokenRefreshHandler()).toBeUndefined();
  });

  test('3: a session that the instance restored from the cache is never ended by it', async () => {
    const cachePath = newCachePath();
    await userInstance(cachePath).login.getTokens();
    const second = userInstance(cachePath);
    await second.login.getTokens();
    expect(second.state.getUserSessionTokenMeta().from_cache).toBe(true);

    const result = await second.login.dispose();

    expect(result.userSession).toBe('kept');
    expect(am.loggedOut()).toEqual([]);
    expect(cacheEntries(cachePath)).toHaveLength(1);
  });

  test('4: an instance without a session (a service account) just stops: no request', async () => {
    const frodo = await serviceAccountInstance();
    await frodo.login.getTokens();
    expect(frodo.state.getAutoRefreshTimer()).toBeDefined();
    const requests = am.requests.length;

    const result = await frodo.login.dispose();

    expect(result).toEqual({ userSession: 'none', cacheEntriesRemoved: 0 });
    expect(am.requests.length).toBe(requests);
    expect(frodo.state.getAutoRefreshTimer()).toBeUndefined();
    expect(frodo.state.getTokenRefreshHandler()).toBeUndefined();
    expect(frodo.state.getBearerTokenMeta()).toBeUndefined();
  });

  test('5: a logout that fails is reported in the result and never thrown', async () => {
    const frodo = userInstance();
    await frodo.login.getTokens();
    am.revokeAll();

    const result = await frodo.login.dispose();

    expect(result.userSession).toBe('failed');
    expect(result.error?.message).toContain('Error logging out');
    expect(frodo.state.getAutoRefreshTimer()).toBeUndefined();
    expect(frodo.state.getUserSessionTokenMeta()).toBeUndefined();
  });

  test('6: a disposed instance does not log in by itself: a request that finds no credential fails instead of logging in', async () => {
    const frodo = userInstance();
    await frodo.login.getTokens();
    await frodo.login.dispose();
    expect(am.logins()).toBe(1);

    await expect(readJourneys(frodo)).rejects.toThrow();

    expect(am.logins()).toBe(1);
  });

  test('7: a login that is still running when the instance is disposed sets no refresh timer', async () => {
    const frodo = userInstance();
    const login = frodo.login.getTokens();
    await frodo.login.dispose();
    await login;

    expect(frodo.state.getUserSessionTokenMeta()).toBeDefined();
    expect(frodo.state.getAutoRefreshTimer()).toBeUndefined();
  });

  test('9: a session that this instance did not create (a caller presented it) is never ended by it, with the cache off too', async () => {
    const frodo = userInstance();
    // what applying a token that comes with a session leaves in the state: no from_cache flag
    frodo.state.setUserSessionTokenMeta({
      tokenId: 'presented-by-a-caller',
      successUrl: '/',
      realm: '/',
      expires: Date.now() + 30 * 60 * 1000,
    });

    const result = await frodo.login.dispose();

    expect(result.userSession).toBe('kept');
    expect(am.loggedOut()).toEqual([]);
    expect(am.count('/sessions')).toBe(0);
  });

  test('8: an explicit getTokens() makes a disposed instance work again, with its timer', async () => {
    const frodo = userInstance();
    await frodo.login.getTokens();
    await frodo.login.dispose();

    await frodo.login.getTokens();

    expect(am.logins()).toBe(2);
    expect(frodo.state.getAutoRefreshTimer()).toBeDefined();
    clearTimeout(frodo.state.getAutoRefreshTimer());
  });
});
