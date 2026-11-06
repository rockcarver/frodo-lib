/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent BaseApi.rejectedCredential
 *
 * A credential is judged by its expiry, but the server can end it earlier. The
 * library then sends it again and again until it expires. These tests use the
 * real login code and requests against a fake AM that runs in the test process:
 * a request that the server answers with 401 gets a new credential and is sent
 * once more, however many requests find out at the same moment, and a 401 that
 * is not a stale credential stays a 401.
 */
import '../index';
import fs from 'fs';
import { resolve } from 'path';
import { Readable } from 'stream';
import { jest } from '@jest/globals';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
import FrodoLib from '../lib/FrodoLib';
import { FrodoError } from '../ops/FrodoError';
import { createJwkRsa } from '../ops/JoseOps';
import { generateAmApi } from './BaseApi';

let am: FakeAm;
const PROTECTED = '/realm-config/';

// The library keeps a credential that it obtained a moment ago when the server
// answers 401 (IDM also answers 401 for a request that is not permitted). Most
// of these tests are about a credential that was ended meanwhile, so they let
// the time pass after the login.
let clockOffset = 0;
const passTime = (ms = 31_000) => {
  clockOffset += ms;
};

beforeEach(async () => {
  clockOffset = 0;
  const realNow = Date.now.bind(Date);
  jest.spyOn(Date, 'now').mockImplementation(() => realNow() + clockOffset);
  am = await startFakeAm();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await am.close();
});

function userInstance({ autoRefresh = true } = {}) {
  const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
  frodo.state.setUseTokenCache(false);
  frodo.state.setUsername('someone');
  frodo.state.setPassword('password');
  return {
    frodo,
    login: async () => {
      const tokens = await frodo.login.getTokens(false, autoRefresh);
      passTime();
      return tokens;
    },
  };
}

/** A call that needs a credential: reads the journeys of the root realm. */
const readJourneys = (frodo: ReturnType<typeof FrodoLib>) =>
  frodo.authn.journey.readJourneys();

describe('a credential that the server rejected', () => {
  test('1: is replaced and the request is sent again, without the caller noticing', async () => {
    const { frodo, login } = userInstance();
    await login();
    await expect(readJourneys(frodo)).resolves.toEqual([]);
    expect(am.logins()).toBe(1);

    am.revokeAll();
    await expect(readJourneys(frodo)).resolves.toEqual([]);
    expect(am.logins()).toBe(2);
    // the request went out twice: rejected, then accepted
    expect(am.count(PROTECTED)).toBe(3);

    // and the new credential is in use from then on
    await readJourneys(frodo);
    expect(am.logins()).toBe(2);
  });

  test('2: requests that find out at the same moment share one new login', async () => {
    const { frodo, login } = userInstance();
    await login();
    am.revokeAll();

    const results = await Promise.all(
      Array.from({ length: 6 }, () => readJourneys(frodo))
    );
    expect(results).toEqual(Array(6).fill([]));
    expect(am.logins()).toBe(2);
  });

  test('3: a 401 after the new credential is the answer, and is returned', async () => {
    const { frodo, login } = userInstance();
    await login();
    am.alwaysReject();

    await expect(readJourneys(frodo)).rejects.toThrow();
    // sent twice, with a new login in between, and no more
    expect(am.count(PROTECTED)).toBe(2);
    expect(am.logins()).toBe(2);
  });

  test('4: a credential that was renewed just now and is rejected again is not renewed again', async () => {
    const { frodo, login } = userInstance();
    await login();
    am.alwaysReject();

    for (let i = 0; i < 3; i++) {
      await expect(readJourneys(frodo)).rejects.toThrow();
    }
    expect(am.logins()).toBe(2);
  });

  test('5: but is renewed again once the interval has passed', async () => {
    const { frodo, login } = userInstance();
    await login();
    am.alwaysReject();
    await expect(readJourneys(frodo)).rejects.toThrow();
    expect(am.logins()).toBe(2);

    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    await expect(readJourneys(frodo)).rejects.toThrow();
    expect(am.logins()).toBe(3);
  });

  test('6: stays a 401 when the instance may not refresh by itself', async () => {
    const { frodo, login } = userInstance({ autoRefresh: false });
    await login();
    am.revokeAll();

    await expect(readJourneys(frodo)).rejects.toThrow();
    expect(am.logins()).toBe(1);
    expect(am.count(PROTECTED)).toBe(1);
  });

  test('7: a credential that the caller set is not the library’s to replace', async () => {
    const { frodo, login } = userInstance();
    await login();
    // an explicit header always wins over the credential of the state
    frodo.state.setAuthenticationHeaderOverrides({
      Cookie: 'iPlanetDirectoryPro=made-up',
    });
    const before = am.count(PROTECTED);

    await expect(readJourneys(frodo)).rejects.toThrow();

    expect(am.count(PROTECTED)).toBe(before + 1);
    expect(am.logins()).toBe(1);
  });

  test('8: a 401 from the authentication endpoint is the answer to a login and is not renewed or sent again', async () => {
    const { frodo } = userInstance();
    frodo.state.setPassword('wrong');
    await expect(frodo.login.getTokens()).rejects.toThrow();
    // the callbacks and the credentials, once each
    expect(am.count('/authenticate')).toBe(2);
    expect(am.logins()).toBe(0);
  });

  /** A request of our own: the raw instance of the library for a full URL. */
  function raw(frodo: ReturnType<typeof FrodoLib>) {
    return generateAmApi({
      resource: {},
      requiredScopes: [],
      state: frodo.state,
    });
  }

  test('10: only a 401 is sent again: another error is the answer', async () => {
    const { frodo, login } = userInstance();
    await login();
    await expect(raw(frodo).get(`${am.host}/json/boom`)).rejects.toThrow();
    expect(am.count('/boom')).toBe(1);
    expect(am.logins()).toBe(1);
  });

  test('11: a body that is a stream cannot be sent twice and is not', async () => {
    const { frodo, login } = userInstance();
    await login();
    am.revokeAll();
    await expect(
      raw(frodo).post(
        `${am.host}/json/realms/root/realm-config/x`,
        Readable.from(['streamed'])
      )
    ).rejects.toThrow();
    expect(am.count(PROTECTED)).toBe(1);
    expect(am.logins()).toBe(1);
  });

  test('12: a JSON body is sent again unchanged', async () => {
    const { frodo, login } = userInstance();
    await login();
    am.revokeAll();
    await raw(frodo).post(`${am.host}/json/realms/root/realm-config/x`, {
      name: 'value',
    });
    expect(am.logins()).toBe(2);
    expect(am.bodies(PROTECTED).map((b) => JSON.parse(b))).toEqual([
      { name: 'value' },
      { name: 'value' },
    ]);
  });

  test('13: a request is sent again once, whatever the rate limit says', async () => {
    const { frodo, login } = userInstance();
    await login();
    am.alwaysReject();
    // every look at the clock is another minute later: the rate limit never holds
    let clock = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => (clock += 60_000));
    await expect(readJourneys(frodo)).rejects.toThrow();
    expect(am.count(PROTECTED)).toBe(2);
  });

  test('14: a rejection that arrives after another request has renewed the credential does not renew it again', async () => {
    const { frodo, login } = userInstance();
    await login();
    am.revokeAll();
    // the first request is rejected late, the second finds out at once
    const slow = raw(frodo).get(
      `${am.host}/json/realms/root/realm-config/slow-one`
    );
    await new Promise((done) => setTimeout(done, 50));
    await readJourneys(frodo);
    expect(am.logins()).toBe(2);

    await expect(slow).resolves.toBeDefined();
    // it was sent again with the credential that is in the state now
    expect(am.logins()).toBe(2);
    expect(am.count('/slow-one')).toBe(2);
  });

  test('15: when the new credential cannot be had, the caller gets the answer of the server, not the failure of the login', async () => {
    const { frodo, login } = userInstance();
    await login();
    am.revokeAll();
    // the password was changed meanwhile: logging in again fails
    frodo.state.setPassword('wrong');

    const error = await readJourneys(frodo).then(
      () => undefined,
      (e) => e
    );
    expect(error).toBeDefined();
    const message = (error as FrodoError).getCombinedMessage();
    expect(message).toContain('401');
    expect(message).not.toContain('Authentication Failed');
  });

  test('9: a service account token that the server rejected is replaced too', async () => {
    const frodo = FrodoLib({ host: am.host, deploymentType: 'cloud' });
    frodo.state.setUseTokenCache(false);
    frodo.state.setServiceAccountId('sa-1');
    frodo.state.setServiceAccountJwk(await createJwkRsa());
    await frodo.login.getTokens();
    passTime();
    expect(am.accessTokens()).toBe(1);

    am.revokeAll();
    await expect(readJourneys(frodo)).resolves.toEqual([]);
    expect(am.accessTokens()).toBe(2);
  });

  test('16: a credential that this instance obtained a moment ago is kept: the 401 is the answer', async () => {
    // IDM answers 401 also for a request that is not permitted
    const { frodo } = userInstance();
    await frodo.login.getTokens();
    am.alwaysReject();

    await expect(readJourneys(frodo)).rejects.toThrow();
    expect(am.logins()).toBe(1);
    expect(am.count(PROTECTED)).toBe(1);

    // once it has some age, the same answer ends the credential
    passTime();
    await expect(readJourneys(frodo)).rejects.toThrow();
    expect(am.logins()).toBe(2);
    expect(am.count(PROTECTED)).toBe(3);
  });
});

describe('a credential that the server rejected, with the token cache on', () => {
  const TMP_DIR = resolve('.', 'test', 'fs_tmp', 'BaseApi.rejectedCredential');

  beforeAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  /** An instance of one process: they share the cache file path and nothing else. */
  function cachedInstance(cachePath: string) {
    const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
    frodo.state.setUseTokenCache(true);
    frodo.state.setTokenCachePath(cachePath);
    frodo.state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    frodo.state.setUsername('someone');
    frodo.state.setPassword('password');
    return frodo;
  }

  test('1: the rejected session leaves the cache and the new one takes its place', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const frodo = cachedInstance(cachePath);
    await frodo.login.getTokens();
    passTime();
    const before = fs.readdirSync(cachePath.replace('.json', ''));
    expect(before).toHaveLength(1);

    am.revokeAll();
    await expect(readJourneys(frodo)).resolves.toEqual([]);

    expect(am.logins()).toBe(2);
    const after = await frodo.cache.readUserSessionToken();
    expect(after.tokenId).toBe('fake-session-2');
  });

  test('2: another process that held the same rejected session finds the new one in the cache and logs in no more', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const first = cachedInstance(cachePath);
    await first.login.getTokens();
    passTime();
    // a second process starts and takes the session from the cache
    const second = cachedInstance(cachePath);
    const tokens = await second.login.getTokens();
    expect(tokens.userSessionToken.from_cache).toBe(true);
    expect(am.logins()).toBe(1);

    am.revokeAll();
    // the first process finds out, logs in and caches the new session
    await readJourneys(first);
    expect(am.logins()).toBe(2);
    // the second one is rejected with the old session, which is no longer in
    // the cache, and takes the new one from there. It got that session from the
    // cache, not from a login of its own, so it is replaced at once.
    await expect(readJourneys(second)).resolves.toEqual([]);
    expect(am.logins()).toBe(2);
  });

  test('4: a service account token that the server rejected leaves the cache too', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const frodo = FrodoLib({ host: am.host, deploymentType: 'cloud' });
    frodo.state.setUseTokenCache(true);
    frodo.state.setTokenCachePath(cachePath);
    frodo.state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
    frodo.state.setServiceAccountId('sa-1');
    frodo.state.setServiceAccountJwk(await createJwkRsa());
    await frodo.login.getTokens();
    passTime();
    expect(am.accessTokens()).toBe(1);

    am.revokeAll();
    await expect(readJourneys(frodo)).resolves.toEqual([]);
    expect(am.accessTokens()).toBe(2);
    expect((await frodo.cache.readSaBearerToken()).access_token).toBe(
      'fake-access-token-2'
    );
  });

  test('3: the instance no longer counts as authenticated, so a plain getTokens() does not hand out the rejected session', async () => {
    const cachePath = resolve(TMP_DIR, `${Math.random()}.TokenCache.json`);
    const frodo = cachedInstance(cachePath);
    await frodo.login.getTokens();
    passTime();
    am.revokeAll();
    await readJourneys(frodo);
    const tokens = await frodo.login.getTokens();
    expect(tokens.userSessionToken.tokenId).toBe('fake-session-2');
    expect(am.logins()).toBe(2);
  });
});
