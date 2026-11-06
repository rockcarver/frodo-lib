/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent AuthenticateOps.alreadyAuthenticated
 *
 * `getTokens()` is the one call that gives an instance a usable credential, and
 * a consumer (the MCP server calls it for every request) may call it as often as
 * it likes: an instance that is already authenticated as the same identity, with
 * credentials that are still fresh, answers from memory without a request. These
 * tests count what the real login code sends to a fake AM that runs in the test
 * process.
 */
import '../index';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
import FrodoLib from '../lib/FrodoLib';
import Constants from '../shared/Constants';
import StateImpl from '../shared/State';
import { authenticationIdentity, hasFreshCredentials } from './AuthenticateOps';
import { createJwkRsa } from './JoseOps';

let am: FakeAm;

beforeEach(async () => {
  am = await startFakeAm();
});

afterEach(async () => {
  await am.close();
});

function userInstance(password = 'password') {
  const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
  frodo.state.setUseTokenCache(false);
  frodo.state.setUsername('someone');
  frodo.state.setPassword(password);
  return frodo;
}

async function serviceAccountInstance() {
  const frodo = FrodoLib({ host: am.host, deploymentType: 'cloud' });
  frodo.state.setUseTokenCache(false);
  frodo.state.setServiceAccountId('sa-1');
  frodo.state.setServiceAccountJwk(await createJwkRsa());
  return frodo;
}

describe('getTokens() on an instance that is already authenticated', () => {
  test('1: a user session: later calls make no request and return the tokens of the first', async () => {
    const frodo = userInstance();
    const first = await frodo.login.getTokens();
    const sent = am.requests.length;
    expect(am.logins()).toBe(1);

    for (let i = 0; i < 5; i++) {
      const again = await frodo.login.getTokens();
      expect(again.userSessionToken.tokenId).toBe(
        first.userSessionToken.tokenId
      );
      expect(again.subject).toBe(first.subject);
    }
    expect(am.requests.length).toBe(sent);
    expect(am.logins()).toBe(1);
  });

  test('2: a service account: later calls make no request, not even the one that looks up the account name', async () => {
    const frodo = await serviceAccountInstance();
    const first = await frodo.login.getTokens();
    const sent = am.requests.length;
    expect(first.subject).toBe('service account sa-1');
    expect(am.accessTokens()).toBe(1);

    const again = await frodo.login.getTokens();
    expect(again.subject).toBe('service account sa-1');
    expect(again.bearerToken.access_token).toBe(first.bearerToken.access_token);
    expect(am.requests.length).toBe(sent);
    expect(am.accessTokens()).toBe(1);
  });

  test('3: callers that ask at the same moment share one login', async () => {
    const frodo = userInstance();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => frodo.login.getTokens())
    );
    expect(am.logins()).toBe(1);
    for (const result of results) {
      expect(result.userSessionToken.tokenId).toBe(
        results[0].userSessionToken.tokenId
      );
    }
  });

  test('3b: callers that ask for something different at the same moment do not share a login', async () => {
    const frodo = userInstance();
    await Promise.all([
      frodo.login.getTokens(),
      frodo.login.getTokens(true),
      frodo.login.getTokens(false, false),
    ]);
    expect(am.logins()).toBe(3);
  });

  test('4: callers that ask at the same moment on an expired instance share one new login', async () => {
    const frodo = userInstance();
    await frodo.login.getTokens();
    // the session is about to expire
    frodo.state.setUserSessionTokenMeta({
      ...frodo.state.getUserSessionTokenMeta(),
      expires: Date.now() + 1000,
    });

    await Promise.all(Array.from({ length: 6 }, () => frodo.login.getTokens()));
    expect(am.logins()).toBe(2);
  });

  test('5: the freshness buffer decides: a session with more than the buffer left is used, one with less logs in again', async () => {
    const buffer = Constants.TOKEN_FRESHNESS_BUFFER_MS;
    const frodo = userInstance();
    await frodo.login.getTokens();
    const meta = frodo.state.getUserSessionTokenMeta();

    frodo.state.setUserSessionTokenMeta({
      ...meta,
      expires: Date.now() + buffer + 5000,
    });
    await frodo.login.getTokens();
    expect(am.logins()).toBe(1);

    frodo.state.setUserSessionTokenMeta({
      ...meta,
      expires: Date.now() + buffer - 5000,
    });
    await frodo.login.getTokens();
    expect(am.logins()).toBe(2);
  });

  test('6: an expiry that is not known is not fresh', async () => {
    const frodo = userInstance();
    await frodo.login.getTokens();
    frodo.state.setUserSessionTokenMeta({
      ...frodo.state.getUserSessionTokenMeta(),
      expires: NaN,
    });
    await frodo.login.getTokens();
    expect(am.logins()).toBe(2);
    // and so is one that never ends: nothing says when to log in again
    frodo.state.setUserSessionTokenMeta({
      ...frodo.state.getUserSessionTokenMeta(),
      expires: Infinity,
    });
    await frodo.login.getTokens();
    expect(am.logins()).toBe(3);
  });

  test('7: another password, another user name or another service account is another identity and logs in again', async () => {
    const frodo = userInstance();
    await frodo.login.getTokens();
    frodo.state.setPassword('another-password');
    await frodo.login.getTokens();
    expect(am.logins()).toBe(2);
    frodo.state.setUsername('someone-else');
    await frodo.login.getTokens();
    expect(am.logins()).toBe(3);
    // and the new identity is then the one that is remembered
    await frodo.login.getTokens();
    expect(am.logins()).toBe(3);
  });

  test('8: the options that decide which credential is used are part of the identity', async () => {
    const frodo = userInstance();
    await frodo.login.getTokens();
    await frodo.login.getTokens(true);
    expect(am.logins()).toBe(2);
    await frodo.login.getTokens(true);
    expect(am.logins()).toBe(2);
    await frodo.login.getTokens(false, false);
    expect(am.logins()).toBe(3);
  });

  test('8b: not refreshing automatically is a different request than refreshing automatically', async () => {
    const frodo = userInstance();
    await frodo.login.getTokens();
    await frodo.login.getTokens(false, false);
    expect(am.logins()).toBe(2);
  });

  test('8c: another host is another identity', async () => {
    const other = await startFakeAm();
    try {
      const frodo = userInstance();
      await frodo.login.getTokens();
      frodo.state.setHost(other.host);
      await frodo.login.getTokens();
      expect(am.logins()).toBe(1);
      expect(other.logins()).toBe(1);
      await frodo.login.getTokens();
      expect(other.logins()).toBe(1);
    } finally {
      await other.close();
    }
  });

  test('9: instances do not share what they know: each logs in once', async () => {
    const a = userInstance();
    const b = userInstance();
    await a.login.getTokens();
    await b.login.getTokens();
    await a.login.getTokens();
    await b.login.getTokens();
    expect(am.logins()).toBe(2);
  });

  test('10: a login that fails is not remembered, so the next call tries again', async () => {
    const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
    frodo.state.setUseTokenCache(false);
    // no credentials at all
    await expect(frodo.login.getTokens()).rejects.toThrow();
    await expect(frodo.login.getTokens()).rejects.toThrow();
    frodo.state.setUsername('someone');
    frodo.state.setPassword('password');
    await frodo.login.getTokens();
    expect(am.logins()).toBe(1);
  });

  test('11: a caller that waited for another one gets the result, and a failure reaches every waiter', async () => {
    const frodo = FrodoLib({ host: am.host, deploymentType: 'classic' });
    frodo.state.setUseTokenCache(false);
    const outcomes = await Promise.allSettled([
      frodo.login.getTokens(),
      frodo.login.getTokens(),
    ]);
    expect(outcomes.map((o) => o.status)).toEqual(['rejected', 'rejected']);
    // nothing stays "in flight" after a failure
    frodo.state.setUsername('someone');
    frodo.state.setPassword('password');
    await expect(frodo.login.getTokens()).resolves.toBeDefined();
  });
});

describe('which credentials count as fresh', () => {
  const buffer = Constants.TOKEN_FRESHNESS_BUFFER_MS;
  const fresh = () => Date.now() + buffer + 60_000;
  const stale = () => Date.now() + buffer - 5_000;

  function stateWith({
    deploymentType,
    bearerExpires,
    sessionExpires,
    useBearer = false,
  }: {
    deploymentType: string;
    bearerExpires?: number;
    sessionExpires?: number;
    useBearer?: boolean;
  }) {
    const state = StateImpl({ host: 'https://openam-fresh.example.com/am' });
    state.setDeploymentType(deploymentType);
    state.setUseBearerTokenForAmApis(useBearer);
    if (bearerExpires !== undefined) {
      state.setBearerTokenMeta({
        access_token: 'b',
        token_type: 'Bearer',
        scope: '',
        expires_in: 0,
        expires: bearerExpires,
      } as any);
    }
    if (sessionExpires !== undefined) {
      state.setUserSessionTokenMeta({
        tokenId: 's',
        successUrl: '/',
        realm: '/',
        expires: sessionExpires,
      });
    }
    return state;
  }

  test('1: a classic deployment relies on the session alone', () => {
    expect(
      hasFreshCredentials(
        stateWith({
          deploymentType: 'classic',
          sessionExpires: fresh(),
          bearerExpires: stale(),
        })
      )
    ).toBe(true);
    expect(
      hasFreshCredentials(
        stateWith({ deploymentType: 'classic', sessionExpires: stale() })
      )
    ).toBe(false);
  });

  test('2: a bearer token used for AM APIs is the credential on its own', () => {
    expect(
      hasFreshCredentials(
        stateWith({
          deploymentType: 'cloud',
          useBearer: true,
          bearerExpires: fresh(),
          sessionExpires: stale(),
        })
      )
    ).toBe(true);
    expect(
      hasFreshCredentials(
        stateWith({
          deploymentType: 'cloud',
          useBearer: true,
          bearerExpires: stale(),
          sessionExpires: fresh(),
        })
      )
    ).toBe(false);
  });

  test('3: with a session and a bearer token both must be fresh', () => {
    const both = { deploymentType: 'cloud', useBearer: false };
    expect(
      hasFreshCredentials(
        stateWith({ ...both, bearerExpires: fresh(), sessionExpires: fresh() })
      )
    ).toBe(true);
    expect(
      hasFreshCredentials(
        stateWith({ ...both, bearerExpires: fresh(), sessionExpires: stale() })
      )
    ).toBe(false);
    expect(
      hasFreshCredentials(
        stateWith({ ...both, bearerExpires: stale(), sessionExpires: fresh() })
      )
    ).toBe(false);
    // one that is missing is not fresh either
    expect(
      hasFreshCredentials(stateWith({ ...both, bearerExpires: fresh() }))
    ).toBe(false);
  });

  test('4: an expiry that is not a finite number is not fresh', () => {
    for (const expires of [NaN, Infinity, undefined]) {
      expect(
        hasFreshCredentials(
          stateWith({ deploymentType: 'classic', sessionExpires: expires })
        )
      ).toBe(false);
    }
  });
});

describe('what identifies an authentication', () => {
  const options = {
    forceLoginAsUser: false,
    credentialOverride: undefined as
      undefined | 'user' | 'svcacct' | 'amster' | 'browser',
    autoRefresh: true,
    types: ['classic', 'cloud', 'forgeops'],
  };

  function baseState() {
    const state = StateImpl({ host: 'https://openam-identity.example.com/am' });
    state.setRealm('alpha');
    state.setDeploymentType('cloud');
    state.setUsername('someone');
    state.setPassword('password');
    state.setServiceAccountId('sa-1');
    state.setServiceAccountJwk({ kty: 'RSA', kid: 'one' } as any);
    state.setAmsterPrivateKey('amster-key');
    state.setAuthenticationService('service-one');
    state.setAuthenticationHeaderOverrides({ 'x-one': '1' });
    return state;
  }

  const identityOf = (state = baseState(), override = {}) =>
    authenticationIdentity({ ...options, ...override, state });

  test('1: the same state and options give the same identity', () => {
    expect(identityOf()).toBeDefined();
    expect(identityOf()).toBe(identityOf());
  });

  test.each([
    ['the host', (s) => s.setHost('https://openam-other.example.com/am')],
    ['the realm', (s) => s.setRealm('bravo')],
    ['the deployment type', (s) => s.setDeploymentType('classic')],
    ['the user name', (s) => s.setUsername('someone-else')],
    ['the password', (s) => s.setPassword('another-password')],
    ['the service account', (s) => s.setServiceAccountId('sa-2')],
    [
      'the service account key',
      (s) => s.setServiceAccountJwk({ kty: 'RSA', kid: 'two' }),
    ],
    ['the Amster key', (s) => s.setAmsterPrivateKey('another-key')],
    [
      'the authentication service',
      (s) => s.setAuthenticationService('service-two'),
    ],
    [
      'the authentication header overrides',
      (s) => s.setAuthenticationHeaderOverrides({ 'x-two': '2' }),
    ],
  ])('2: %s is part of the identity', (_, change) => {
    const state = baseState();
    const before = identityOf(state);
    change(state);
    expect(identityOf(state)).not.toBe(before);
  });

  test.each([
    ['forcing the login as a user', { forceLoginAsUser: true }],
    ['the credential override', { credentialOverride: 'svcacct' }],
    ['the automatic refresh', { autoRefresh: false }],
    ['the deployment types', { types: ['classic'] }],
  ])('3: %s is part of the identity', (_, change) => {
    expect(identityOf(baseState(), change)).not.toBe(identityOf());
  });

  test('4: browser login has no identity, however it is asked for', () => {
    expect(
      identityOf(baseState(), { credentialOverride: 'browser' })
    ).toBeUndefined();
    const preferred = baseState();
    preferred.setPreferredCredential('browser');
    expect(identityOf(preferred)).toBeUndefined();
    const interactive = baseState();
    interactive.setAuthMode('interactive');
    expect(identityOf(interactive)).toBeUndefined();
  });

  test('5: the identity does not contain the credentials', () => {
    expect(identityOf()).not.toContain('password');
    expect(identityOf()).toMatch(/^[0-9a-f]{64}$/);
  });
});
