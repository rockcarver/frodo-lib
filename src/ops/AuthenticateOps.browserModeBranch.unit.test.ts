/**
 * Run tests
 *
 *        npm run test:only AuthenticateOps.browserModeBranch
 *
 * Regression coverage for getTokens()'s Phase E profile-bootstrap branch:
 * a loaded connection profile with authMode: 'interactive' must require the
 * caller to supply a promptHandler (getTokens() has no browser-launching
 * context of its own), and must never silently fall through to any other
 * auth mode's credential-resolution logic.
 */
import { jest } from '@jest/globals';

const getConnectionProfile = jest.fn(async (_args?: any): Promise<any> => ({}));
// Simulates a saved browser-login connection profile: loading it sets
// authMode on state, exactly like the real loadConnectionProfileByHost does.
const loadConnectionProfile = jest.fn(async ({ state }: any): Promise<any> => {
  state.setAuthMode('interactive');
  state.setBrowserLoginClientId('AICMCPClient');
  state.setBrowserLoginScope('fr:am:* fr:idm:*');
  return true;
});
const saveConnectionProfile = jest.fn(async (_args?: any): Promise<any> => true);

jest.unstable_mockModule('./ConnectionProfileOps', () => ({
  getConnectionProfile,
  loadConnectionProfile,
  saveConnectionProfile,
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
const { FrodoError } = await import('./FrodoError');

async function getUnderlyingError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    // getTokens() wraps every thrown error in its own FrodoError, and
    // getTokensInteractive() (which getTokens() delegates to for browser
    // login) does the same — unwrap however many layers exist to reach the
    // actual root cause.
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

describe("getTokens()'s browser-login (authMode: 'interactive') branch", () => {
  beforeEach(() => {
    getConnectionProfile.mockClear();
    loadConnectionProfile.mockClear();
    saveConnectionProfile.mockClear();
  });

  test('1: Throws a clear error when no promptHandler is supplied', async () => {
    const state = StateImpl({
      host: 'https://openam-example.forgeblocks.com/am',
    });

    const error = await getUnderlyingError(
      getTokens({ state, autoRefresh: false })
    );

    expect(error.message).toMatch(/requires a promptHandler/);
    expect(saveConnectionProfile).not.toHaveBeenCalled();
  });

  test('2: Attempts the interactive flow (not any other auth mode) when a promptHandler is supplied', async () => {
    const state = StateImpl({
      host: 'https://openam-example.forgeblocks.com/am',
    });
    const promptHandler = jest.fn(async () => {});

    // No deploymentType is set on this bare state, so getTokensInteractive()
    // itself will reject before ever reaching a real network call — that's
    // fine, it still proves getTokens() actually attempted delegation
    // rather than silently falling through to service-account/Amster/
    // password credential resolution (none of which are configured here and
    // would otherwise fail with a completely different error).
    const error = await getUnderlyingError(
      getTokens({ state, autoRefresh: false, promptHandler })
    );

    expect(error.message).toMatch(/known deployment type/);
  });

  test('3: An authMode set to interactive before getTokens() is called (e.g. a CLI --browser flag) skips connection-profile lookup entirely, even for a brand-new host with no saved profile', async () => {
    const state = StateImpl({
      host: 'https://openam-example.forgeblocks.com/am',
    });
    state.setAuthMode('interactive');
    const promptHandler = jest.fn(async () => {});

    const error = await getUnderlyingError(
      getTokens({ state, autoRefresh: false, promptHandler })
    );

    // Regression: before the fix, getTokens() always attempted
    // loadConnectionProfile()/getConnectionProfile() first whenever no
    // username/password/service-account/Amster key was set — which is
    // exactly the browser-login case — so a fresh host with no saved
    // profile yet failed with "No connection profile found" instead of
    // ever reaching the interactive branch.
    expect(loadConnectionProfile).not.toHaveBeenCalled();
    expect(getConnectionProfile).not.toHaveBeenCalled();
    expect(error.message).toMatch(/known deployment type/);
  });
});
