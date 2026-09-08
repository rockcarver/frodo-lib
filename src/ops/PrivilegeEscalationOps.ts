/**
 * Pure ranking/classification logic for item 1+21's "try the least-
 * privileged available credential, escalate on a real insufficient-scope
 * failure" mechanism.
 *
 * @remarks
 * Only ever meaningful for cloud: `assertHasRequiredScope()`/
 * `resolveAvailableScope()` (`RequiredScopesOps.ts`, the two pre-flight
 * checks that throw `InsufficientScopeError`, the signal this ladder reacts
 * to) are no-ops for every other deployment type, so Amster (classic-only)
 * never needs a place on this ladder — only the three cloud-relevant
 * sources (`browser`, `svcacct`, `user`) do.
 *
 * Deliberately has no knowledge of *how* to acquire a credential (that
 * stays in `AuthenticateOps.ts`, which already owns `getSaBearerToken()`
 * etc. — this file can't import from there without a circular dependency,
 * since `AuthenticateOps.ts` already depends on this one transitively via
 * `CallerTrustTierOps.ts`) — only which one to try next, given what's
 * available and what's already been tried.
 */
import { State } from '../shared/State';
import {
  CLOUD_SUPER_ADMIN_GROUP,
  CLOUD_TENANT_ADMIN_GROUP,
  CLOUD_TENANT_AUDITOR_GROUP,
  CLOUD_THEME_ADMIN_GROUP,
  lookupCallerPrivilegeGroups,
} from './CallerTrustTierOps';

export type CredentialSource = 'user' | 'svcacct' | 'browser';

export type CredentialTier =
  | 'super-admin'
  | 'tenant-admin'
  | 'service-account'
  | 'tenant-auditor'
  | 'theme-admin'
  | 'unknown';

export type EscalationCandidate = {
  source: CredentialSource;
  tier: CredentialTier;
};

/**
 * Classifies a `user`/`browser` source's tier from its own AM-native
 * privilege groups — the same lookup `determineCallerTrustTier()` uses for
 * MCP trust-tier classification, reused here for a finer-grained rank
 * instead of a binary full-trust/delegated split. `service-account` never
 * calls this (there's no group to look up — it's a fixed tier, always
 * rank 4 below).
 */
export async function classifyCredentialTier({
  username,
  state,
}: {
  username: string | undefined;
  state: State;
}): Promise<CredentialTier> {
  const groups = await lookupCallerPrivilegeGroups({ username, state });
  const isMemberOf = groups?.isMemberOf ?? [];
  const has = (group: string) =>
    isMemberOf.some((dn) => dn.startsWith(`cn=${group},`));
  if (has(CLOUD_SUPER_ADMIN_GROUP)) return 'super-admin';
  if (has(CLOUD_TENANT_ADMIN_GROUP)) return 'tenant-admin';
  if (has(CLOUD_TENANT_AUDITOR_GROUP)) return 'tenant-auditor';
  if (has(CLOUD_THEME_ADMIN_GROUP)) return 'theme-admin';
  return 'unknown';
}

/**
 * Item 21's privilege hierarchy, inverted into try-order: lower rank tries
 * first (least privileged). `'unknown'` — no group membership could be
 * classified — ranks lowest of all regardless of source: no evidence it's
 * actually privileged, so assume it isn't, the same fail-closed reasoning
 * `determineCallerTrustTier()`'s own built-in heuristic already uses.
 */
function rank({ source, tier }: EscalationCandidate): number {
  if (tier === 'unknown') return -1;
  if (source === 'browser') {
    switch (tier) {
      case 'theme-admin':
        return 0;
      case 'tenant-auditor':
        return 1;
      case 'tenant-admin':
        return 2;
      case 'super-admin':
        return 3;
    }
  }
  if (source === 'svcacct') {
    return 4;
  }
  // source === 'user'
  return tier === 'tenant-admin' ? 5 : 6; // super-admin ranks highest of all
}

/**
 * Picks the next credential to escalate to: the untried candidate with the
 * lowest rank (i.e. the least additional privilege that hasn't already
 * failed) — never jumps straight to the most privileged available option.
 * Returns `undefined` when every available candidate has already been
 * tried, telling the caller there is nothing left to escalate to.
 */
export function pickNextEscalationCandidate({
  available,
  tried,
}: {
  available: EscalationCandidate[];
  tried: Set<CredentialSource>;
}): EscalationCandidate | undefined {
  const untried = available.filter((c) => !tried.has(c.source));
  if (untried.length === 0) {
    return undefined;
  }
  return untried.reduce((lowest, c) =>
    rank(c) < rank(lowest) ? c : lowest
  );
}
