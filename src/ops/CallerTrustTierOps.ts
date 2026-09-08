/**
 * Determines the caller-privilege tier for the currently-authenticated
 * session, so the MCP runtime's `assertTrustTierAllowed` (see
 * `mcp/ToolRuntime.ts`) can decide whether a capability marked
 * `trustTier: 'full-trust'` (the default — see `mcp/CapabilityTypes.ts`'s
 * `McpCapabilityTrustTier`) is safe to expose to this caller.
 *
 * @remarks
 * `admin-account`/`service-account`/`state-config` sessions are already
 * full-trust identities by construction — there is no privilege to probe,
 * so this short-circuits for every auth mode except a real interactive
 * (browser) login, which is the only mode that can plausibly represent a
 * non-admin, delegated end user.
 *
 * For a browser-login session, `state.setCallerTrustTierResolver(fn)` (if
 * set) always wins — a customer's own privilege model, verified against
 * their own tenant, is preferred over guessing. Failing that, the built-in
 * heuristic below (`resolveBuiltInCallerTrustTier`) checks the logged-in
 * identity's own AM-native privilege markers via `frodo.user.readUser()` —
 * confirmed live, this session, to be self-readable (unlike the equivalent
 * IDM `teammember` managed-object record, which 403s even for a self-read)
 * for both ForgeOps/classic (`roles` containing `'ui-global-admin'`) and
 * cloud (`isMemberOf` containing a known admin-tier group). Any lookup
 * failure, or no username at all (e.g. a fully custom instance resolver
 * that never populated `state.getUsername()`), fails toward the more
 * restrictive `'delegated'` tier rather than guessing.
 */
import { State } from '../shared/State';
import { readUser } from './UserOps';

/**
 * A customer- (or future built-in-) supplied privilege resolver, plugged in
 * via `state.setCallerTrustTierResolver()`. Only ever consulted for a real
 * interactive (browser) login session — every other auth mode already
 * short-circuits to `'full-trust'` before this would be called.
 */
export type CallerTrustTierResolver = (args: {
  state: State;
}) => Promise<'full-trust' | 'delegated'>;

/**
 * ForgeOps/classic AM UI-privilege role (`UserSkeleton.roles`) that marks a
 * genuine full-privilege identity — confirmed live against `amadmin` on a
 * real ForgeOps tenant (identical when forcing `--type classic` against the
 * same AM engine), and confirmed absent on 5 ordinary IDM-synced managed
 * users in the same realm. `'ui-realm-admin'` (also present on `amadmin`)
 * is deliberately NOT treated as sufficient on its own here — there's no
 * live-tested example of an identity with `'ui-realm-admin'` but not
 * `'ui-global-admin'`, so a realm-only admin fails toward `'delegated'`
 * rather than assuming it's equivalent.
 */
const FORGEOPS_CLASSIC_FULL_TRUST_ROLE = 'ui-global-admin';

/**
 * Cloud (AIC) `isMemberOf` group names confirmed live, this session, to
 * carry full tenant privilege (item 21's privilege-hierarchy tiers 1–2):
 * `super-admins` ("manages everything... with zero restrictions") and
 * `tenant-admins` ("everything super admin can do except manage other
 * admin users and manage admin federation"). Deliberately an allow-list,
 * not a deny-list — any group not named here (including the two tracked
 * immediately below) fails toward `'delegated'` by default, so a future,
 * as-yet-unseen AIC admin-group name can't accidentally grant full trust.
 */
const CLOUD_FULL_TRUST_GROUPS = ['super-admins', 'tenant-admins'];

/**
 * Cloud groups confirmed live this session to exist and be genuinely
 * narrower than the full-trust tier above (item 21's tiers 6–7) — tracked
 * explicitly, by name (not just left as an implicit "everything else"), so
 * a maintainer reading this file can see they were deliberately considered
 * and excluded, not simply never checked. Not consulted by
 * `hasCloudFullTrustGroup()` — inclusion here has no effect on the actual
 * `'delegated'` outcome, which already applies to any group not named in
 * `CLOUD_FULL_TRUST_GROUPS` above. `tenant-auditor`: read-only.
 * `brand-admin`: the narrowest tier, hosted pages/themes only. Both are
 * singular, unlike the two full-trust groups above — AIC's own
 * group-naming isn't uniformly pluralized, confirmed by directly
 * inspecting a live identity holding both simultaneously (`isMemberOf` is
 * additive, not a single value).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CLOUD_KNOWN_NON_FULL_TRUST_GROUPS = ['tenant-auditor', 'brand-admin'];

/**
 * Checks whether a cloud `isMemberOf` DN list names one of
 * `CLOUD_FULL_TRUST_GROUPS`. Matches on the DN's `cn=<name>,` prefix rather
 * than exact string equality — confirmed live that the full value is a
 * complete DN (e.g. `'cn=super-admins,ou=groups,o=root,ou=identities'}`),
 * not a bare group name.
 */
function hasCloudFullTrustGroup(isMemberOf: string[] | undefined): boolean {
  if (!isMemberOf) {
    return false;
  }
  return CLOUD_FULL_TRUST_GROUPS.some((group) =>
    isMemberOf.some((dn) => dn.startsWith(`cn=${group},`))
  );
}

/**
 * The built-in privilege heuristic consulted when no customer-supplied
 * `CallerTrustTierResolver` is configured. Looks up the logged-in
 * identity's own AM-native user record (`frodo.user.readUser()`) — the same
 * API/module the user explicitly pointed at for this — scoped to the root
 * realm regardless of the caller's currently-active realm (both ForgeOps/
 * classic's `amadmin`-equivalent and cloud's tenant-admin identities live
 * there, confirmed live; the realm override is saved/restored so this never
 * leaks a changed active realm back to the caller). Never throws: any
 * failure (no username known, lookup error, deployment type with no
 * meaningful realm concept) resolves to `'delegated'`.
 */
async function resolveBuiltInCallerTrustTier({
  state,
}: {
  state: State;
}): Promise<'full-trust' | 'delegated'> {
  const username = state.getUsername();
  if (!username) {
    return 'delegated';
  }
  const previousRealm = state.getRealm();
  try {
    state.setRealm('/');
    const user = await readUser({ userId: username, state });
    if (user.roles?.includes(FORGEOPS_CLASSIC_FULL_TRUST_ROLE)) {
      return 'full-trust';
    }
    if (hasCloudFullTrustGroup(user.isMemberOf)) {
      return 'full-trust';
    }
    return 'delegated';
  } catch {
    return 'delegated';
  } finally {
    state.setRealm(previousRealm);
  }
}

/**
 * Resolves and caches (for the life of the session, on `state`) the
 * caller-privilege tier for the currently-authenticated session.
 * @param {State} state library state
 * @returns {Promise<'full-trust' | 'delegated'>} the resolved tier
 */
export async function determineCallerTrustTier({
  state,
}: {
  state: State;
}): Promise<'full-trust' | 'delegated'> {
  const cached = state.getCallerTrustTier();
  if (cached) {
    return cached;
  }

  // Every existing auth mode (admin-account, service-account, state-config)
  // is already a full-trust identity by construction — only a real
  // interactive (browser) login can plausibly be a delegated, non-admin
  // caller.
  if (state.getAuthMode() !== 'interactive') {
    state.setCallerTrustTier('full-trust');
    return 'full-trust';
  }

  const resolver = state.getCallerTrustTierResolver();
  const resolved = resolver
    ? await resolver({ state })
    : await resolveBuiltInCallerTrustTier({ state });
  state.setCallerTrustTier(resolved);
  return resolved;
}
