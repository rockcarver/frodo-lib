/**
 * Run tests
 *
 *        npm run test:only CallerTrustTierOps.builtInHeuristic
 *
 * Regression coverage for determineCallerTrustTier()'s built-in heuristic
 * (resolveBuiltInCallerTrustTier, consulted when no customer resolver is
 * configured): the frodo.user.readUser()-based check for both ForgeOps/
 * classic's `roles` and cloud's `isMemberOf`, the fail-closed defaults for
 * every unrecognized/missing/error case, and the root-realm save/restore
 * around the lookup.
 */
import { jest } from '@jest/globals';

const readUser = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('readUser mock not configured');
});

jest.unstable_mockModule('./UserOps', () => ({
  readUser,
}));

const { determineCallerTrustTier } = await import('./CallerTrustTierOps');
const { default: StateImpl } = await import('../shared/State');

function interactiveStateWithUsername(username: string) {
  const state = StateImpl({ host: 'https://openam-example.com/am' });
  state.setAuthMode('interactive');
  state.setUsername(username);
  return state;
}

describe('determineCallerTrustTier built-in heuristic', () => {
  beforeEach(() => {
    readUser.mockReset();
  });

  test('1: No username at all resolves to delegated without calling readUser()', async () => {
    const state = StateImpl({ host: 'https://openam-example.com/am' });
    state.setAuthMode('interactive');

    const tier = await determineCallerTrustTier({ state });

    expect(tier).toBe('delegated');
    expect(readUser).not.toHaveBeenCalled();
  });

  test("2: ForgeOps/classic identity with 'ui-global-admin' resolves to full-trust", async () => {
    readUser.mockResolvedValue({
      roles: ['ui-global-admin', 'ui-realm-admin'],
    });
    const state = interactiveStateWithUsername('amadmin');

    const tier = await determineCallerTrustTier({ state });

    expect(tier).toBe('full-trust');
  });

  test("3: ForgeOps/classic identity with only 'ui-realm-admin' (no 'ui-global-admin') fails closed to delegated", async () => {
    readUser.mockResolvedValue({ roles: ['ui-realm-admin'] });
    const state = interactiveStateWithUsername('realm-admin-user');

    const tier = await determineCallerTrustTier({ state });

    expect(tier).toBe('delegated');
  });

  test("4: Cloud identity in 'super-admins' resolves to full-trust", async () => {
    readUser.mockResolvedValue({
      isMemberOf: ['cn=super-admins,ou=groups,o=root,ou=identities'],
    });
    const state = interactiveStateWithUsername('vscheuber@gmail.com');

    const tier = await determineCallerTrustTier({ state });

    expect(tier).toBe('full-trust');
  });

  test("5: Cloud identity in 'tenant-admins' resolves to full-trust", async () => {
    readUser.mockResolvedValue({
      isMemberOf: ['cn=tenant-admins,ou=groups,o=root,ou=identities'],
    });
    const state = interactiveStateWithUsername('vscheuber@gmail.com');

    const tier = await determineCallerTrustTier({ state });

    expect(tier).toBe('full-trust');
  });

  test.each(['tenant-auditor', 'brand-admin'])(
    "6: Cloud identity in only '%s' fails closed to delegated",
    async (group) => {
      readUser.mockResolvedValue({
        isMemberOf: [`cn=${group},ou=groups,o=root,ou=identities`],
      });
      const state = interactiveStateWithUsername('vscheuber@gmail.com');

      const tier = await determineCallerTrustTier({ state });

      expect(tier).toBe('delegated');
    }
  );

  test('7: Cloud identity with multiple simultaneous groups (isMemberOf is additive) resolves full-trust if any one qualifies', async () => {
    readUser.mockResolvedValue({
      isMemberOf: [
        'cn=brand-admin,ou=groups,o=root,ou=identities',
        'cn=tenant-admins,ou=groups,o=root,ou=identities',
      ],
    });
    const state = interactiveStateWithUsername('vscheuber@gmail.com');

    const tier = await determineCallerTrustTier({ state });

    expect(tier).toBe('full-trust');
  });

  test('8: An identity with neither roles nor isMemberOf (e.g. an ordinary IDM-synced user) resolves to delegated', async () => {
    readUser.mockResolvedValue({ username: 'jdoe' });
    const state = interactiveStateWithUsername('jdoe');

    const tier = await determineCallerTrustTier({ state });

    expect(tier).toBe('delegated');
  });

  test('9: A readUser() failure (e.g. 404/403/network error) fails closed to delegated rather than throwing', async () => {
    readUser.mockRejectedValue(new Error('Request failed with status code 403'));
    const state = interactiveStateWithUsername('vscheuber@gmail.com');

    await expect(determineCallerTrustTier({ state })).resolves.toBe('delegated');
  });

  test("10: Looks up the identity scoped to the root realm ('/'), and restores the caller's original active realm afterward", async () => {
    let realmDuringLookup: string | undefined;
    readUser.mockImplementation(async ({ state }: any) => {
      realmDuringLookup = state.getRealm();
      return { isMemberOf: ['cn=super-admins,ou=groups,o=root,ou=identities'] };
    });
    const state = interactiveStateWithUsername('vscheuber@gmail.com');
    state.setRealm('alpha');

    await determineCallerTrustTier({ state });

    expect(realmDuringLookup).toBe('/');
    expect(state.getRealm()).toBe('alpha');
  });

  test('11: Restores the original active realm even when readUser() fails', async () => {
    readUser.mockRejectedValue(new Error('boom'));
    const state = interactiveStateWithUsername('vscheuber@gmail.com');
    state.setRealm('alpha');

    await determineCallerTrustTier({ state });

    expect(state.getRealm()).toBe('alpha');
  });
});
