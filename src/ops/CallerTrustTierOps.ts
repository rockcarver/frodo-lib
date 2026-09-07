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
 * The only signal built in here is the auth-mode short-circuit above; for a
 * browser-login session, the *default* (no customer-supplied resolver) is a
 * deliberately conservative `'delegated'` — fails toward the more
 * restrictive tier rather than guessing at a tenant-specific privilege
 * model (an IDM "who am I" role query, an AM group-membership lookup
 * against a configurable admin-group name, or OIDC claims-script output)
 * that hasn't been verified against a real tenant, unlike the rest of this
 * project's mechanisms. `state.setCallerTrustTierResolver(fn)` is the
 * intended extension point: a customer (or a future, tenant-verified
 * built-in heuristic) plugs in their own privilege model to let a
 * browser-login admin be recognized as `'full-trust'` too.
 */
import { State } from '../shared/State';

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
  const resolved = resolver ? await resolver({ state }) : 'delegated';
  state.setCallerTrustTier(resolved);
  return resolved;
}
