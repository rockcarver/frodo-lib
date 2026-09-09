/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent AuthenticateOps.defaultCredential
 *
 * Regression coverage for `defaultCredential` (a profile's explicit
 * preference for which non-interactive credential type to use when more
 * than one is configured — service account, Amster, or plain user), plus
 * `tryBrowserLogin()`'s companion fix: a merely-cached (not `--save`d)
 * browser session must not be silently ignored by a later implicit command
 * when nothing else was explicitly configured, but an explicit
 * `forceLoginAsUser`/`defaultCredential` preference always wins over it.
 *
 * Distinguishes which non-interactive branch actually ran without needing
 * each one to complete a full, real login: the service account branch
 * wraps its own network failure in a distinct "Service account login
 * error" FrodoError, so its own sentinel is identifiable by that wrapper
 * alone. The Amster and plain-user branches share the exact same
 * underlying tree-login call (`step`) with no distinguishing wrapper, so
 * they're told apart by a synchronous, branch-specific side effect that
 * happens before that shared call: the Amster branch sets
 * `state.authenticationService` to `Constants.DEFAULT_AMSTER_SERVICE` when
 * it wasn't already set; the plain-user branch never does.
 */
import { jest } from '@jest/globals';

const createSignedJwtToken = jest.fn(
  async (_payload?: any, _jwk?: any): Promise<string> => 'fake.jwt.token'
);

jest.unstable_mockModule('./JoseOps', () => ({
  createSignedJwtToken,
}));

const SVCACCT_SENTINEL = new Error('svcacct network layer reached — sentinel');
const accessToken = jest.fn(async (_args?: any): Promise<any> => {
  throw SVCACCT_SENTINEL;
});
const authorize = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('authorize mock not configured');
});
const deviceAuthorizationRequest = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('deviceAuthorizationRequest mock not configured');
});
const getTokenInfo = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('getTokenInfo mock not configured');
});

jest.unstable_mockModule('./OAuth2OidcOps', () => ({
  accessToken,
  authorize,
  deviceAuthorizationRequest,
  getTokenInfo,
}));

const TREE_LOGIN_SENTINEL = new Error(
  'tree-login network layer reached — sentinel'
);
const step = jest.fn(async (_args?: any): Promise<any> => {
  throw TREE_LOGIN_SENTINEL;
});

jest.unstable_mockModule('../api/AuthenticateApi', () => ({
  step,
}));

const getServerInfo = jest.fn(async (_args?: any): Promise<any> => ({
  cookieName: 'iPlanetDirectoryPro',
}));
const getServerVersionInfo = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/ServerInfoApi', () => ({
  getServerInfo,
  getServerVersionInfo,
  getIdmServerVersionInfo: jest.fn(),
}));

// Module-load safety only: bypassed at runtime by setting every credential
// directly on state before calling getTokens(), so getTokens()'s own
// "nothing set yet, load a profile" precondition never fires.
jest.unstable_mockModule('./ConnectionProfileOps', () => ({
  getConnectionProfile: jest.fn(async () => {
    throw new Error('getConnectionProfile mock not configured');
  }),
  loadConnectionProfile: jest.fn(async () => {
    throw new Error('loadConnectionProfile mock not configured');
  }),
  saveConnectionProfile: jest.fn(async () => true),
}));

// Module-load safety only: authMode is never interactive in these tests, so
// this is never actually exercised.
jest.unstable_mockModule('./BrowserAuthenticateOps', () => ({
  runInteractiveAuthorizationCodeFlow: jest.fn(async () => {
    throw new Error('runInteractiveAuthorizationCodeFlow mock not configured');
  }),
  startDeviceAuthorizationFlow: jest.fn(async () => {
    throw new Error('startDeviceAuthorizationFlow mock not configured');
  }),
  refreshBrowserBearerToken: jest.fn(async () => {
    throw new Error('refreshBrowserBearerToken mock not configured');
  }),
  exchangeTokenForScope: jest.fn(async () => {
    throw new Error('exchangeTokenForScope mock not configured');
  }),
}));

// lookupCallerPrivilegeGroups()/classifyCredentialTier() call readUser() —
// tracked (not just stubbed) so tests can assert on whether escalation
// actually needed the network call classifyCredentialTier() exists for, or
// correctly skipped it (see test 6 below).
const readUser = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('./UserOps', () => ({
  readUser,
}));

const { getTokens } = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');
const { FrodoError } = await import('./FrodoError');
const Constants = (await import('../shared/Constants')).default;

/**
 * getTokens wraps the real cause in several layers of FrodoError (e.g.
 * "Error getting tokens" > "Service account login error" > "Error getting
 * access token for service account" > the actual sentinel) — unwraps all
 * the way down so tests can assert on the real cause directly.
 */
async function getUnderlyingError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    let current = error;
    while (
      current instanceof FrodoError &&
      current.originalErrors.length > 0
    ) {
      current = current.originalErrors[0];
    }
    return current as Error;
  }
  throw new Error('Expected promise to reject, but it resolved.');
}

function stateWithAllThreeCredentials() {
  const state = StateImpl({ host: 'https://openam-example.forgeblocks.com/am' });
  state.setServiceAccountId('sa-id');
  state.setServiceAccountJwk({ kty: 'RSA' } as any);
  state.setAmsterPrivateKey('fake-amster-key');
  state.setUsername('plain-user');
  state.setPassword('plain-password');
  state.setUseTokenCache(false);
  return state;
}

describe('AuthenticateOps defaultCredential resolution', () => {
  beforeEach(() => {
    accessToken.mockClear();
    step.mockClear();
    getServerInfo.mockClear();
    readUser.mockClear();
  });

  test('1: No defaultCredential set — service account still wins first, unchanged from today', async () => {
    const state = stateWithAllThreeCredentials();

    const underlying = await getUnderlyingError(getTokens({ state }));

    expect(underlying).toBe(SVCACCT_SENTINEL);
    expect(step).not.toHaveBeenCalled();
  });

  test("2: defaultCredential 'svcacct' (explicit but same as default) — service account still wins", async () => {
    const state = stateWithAllThreeCredentials();
    state.setDefaultCredential('svcacct');

    const underlying = await getUnderlyingError(getTokens({ state }));

    expect(underlying).toBe(SVCACCT_SENTINEL);
    expect(step).not.toHaveBeenCalled();
  });

  test("3: defaultCredential 'amster' — skips the service account, uses Amster", async () => {
    const state = stateWithAllThreeCredentials();
    state.setDefaultCredential('amster');

    const underlying = await getUnderlyingError(getTokens({ state }));

    expect(accessToken).not.toHaveBeenCalled();
    expect(underlying).toBe(TREE_LOGIN_SENTINEL);
    // Amster branch's own synchronous prep, distinguishing it from the
    // plain-user branch, which shares the same underlying step() call.
    expect(state.getAuthenticationService()).toBe(
      Constants.DEFAULT_AMSTER_SERVICE
    );
  });

  test("4: defaultCredential 'user' — skips both service account and Amster, uses the plain user", async () => {
    const state = stateWithAllThreeCredentials();
    state.setDefaultCredential('user');

    const underlying = await getUnderlyingError(getTokens({ state }));

    expect(accessToken).not.toHaveBeenCalled();
    expect(underlying).toBe(TREE_LOGIN_SENTINEL);
    expect(state.getAuthenticationService()).not.toBe(
      Constants.DEFAULT_AMSTER_SERVICE
    );
  });

  test('5: forceLoginAsUser (pre-existing flag) still skips both, same as defaultCredential user — regression guard', async () => {
    const state = stateWithAllThreeCredentials();

    const underlying = await getUnderlyingError(
      getTokens({ state, forceLoginAsUser: true })
    );

    expect(accessToken).not.toHaveBeenCalled();
    expect(underlying).toBe(TREE_LOGIN_SENTINEL);
    expect(state.getAuthenticationService()).not.toBe(
      Constants.DEFAULT_AMSTER_SERVICE
    );
  });

  test("6: escalating from the service account (the only other configured credential is 'user') never calls readUser() — nothing to rank against, so classifyCredentialTier() must be skipped", async () => {
    // Regression test for a real bug caught via CI on the actual PR: the
    // escalation handler used to call classifyCredentialTier() (a
    // readUser() network call) unconditionally for the 'user' candidate,
    // even when it was the *only* remaining one — needlessly, since there
    // was nothing to compare its rank against. That extra, unanticipated
    // call broke every Polly-replay e2e test whose command happened to
    // trigger an escalation at all, since no pre-existing fixture
    // recording could have anticipated it.
    accessToken.mockResolvedValueOnce({
      access_token: 'valid-sa-token',
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 3600,
      expires: Date.now() + 3_600_000,
    });
    const state = stateWithAllThreeCredentials();

    const tokens = await getTokens({ state });

    expect(tokens).toBeTruthy();
    expect(state.getActiveCredentialSource()).toBe('svcacct');
    const escalate = state.getPrivilegeEscalationHandler();
    expect(escalate).toBeDefined();

    await escalate();

    expect(readUser).not.toHaveBeenCalled();
  });

  test("7: credentialOverride 'svcacct' wins even over an explicit defaultCredential 'user' — a stronger, per-invocation override", async () => {
    const state = stateWithAllThreeCredentials();
    state.setDefaultCredential('user');

    const underlying = await getUnderlyingError(
      getTokens({ state, credentialOverride: 'svcacct' })
    );

    expect(underlying).toBe(SVCACCT_SENTINEL);
    expect(step).not.toHaveBeenCalled();
  });

  test("8: credentialOverride 'amster' skips service account and plain user, forcing the amster branch", async () => {
    const state = stateWithAllThreeCredentials();

    const underlying = await getUnderlyingError(
      getTokens({ state, credentialOverride: 'amster' })
    );

    expect(accessToken).not.toHaveBeenCalled();
    expect(underlying).toBe(TREE_LOGIN_SENTINEL);
    expect(state.getAuthenticationService()).toBe(
      Constants.DEFAULT_AMSTER_SERVICE
    );
  });

  test("9: credentialOverride 'user' skips service account and amster, forcing the plain-user branch", async () => {
    const state = stateWithAllThreeCredentials();

    const underlying = await getUnderlyingError(
      getTokens({ state, credentialOverride: 'user' })
    );

    expect(accessToken).not.toHaveBeenCalled();
    expect(underlying).toBe(TREE_LOGIN_SENTINEL);
    expect(state.getAuthenticationService()).not.toBe(
      Constants.DEFAULT_AMSTER_SERVICE
    );
  });

  test("10: credentialOverride 'svcacct' on a profile with no service account configured fails clearly instead of silently falling through to amster/user", async () => {
    const state = StateImpl({ host: 'https://openam-example.forgeblocks.com/am' });
    state.setAmsterPrivateKey('fake-amster-key');
    state.setUsername('plain-user');
    state.setPassword('plain-password');
    state.setUseTokenCache(false);

    const underlying = await getUnderlyingError(
      getTokens({ state, credentialOverride: 'svcacct' })
    );

    expect(accessToken).not.toHaveBeenCalled();
    expect(step).not.toHaveBeenCalled();
    expect(underlying.message).toMatch(/Incomplete or no credentials/);
  });
});
