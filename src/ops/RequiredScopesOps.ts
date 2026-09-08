import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { FrodoError } from './FrodoError';

/**
 * Thrown by `assertHasRequiredScope()`/`resolveAvailableScope()` below —
 * both pre-flight checks reachable only through `api/BaseApi.ts`'s
 * `attachCredentialInterceptor()`, which distinguishes this from any other
 * failure to decide whether escalating to a higher-tier credential (see
 * `ops/PrivilegeEscalationOps.ts`) and retrying is worth attempting at all.
 * A plain `FrodoError` here would be indistinguishable from an unrelated
 * failure (a config error, a network error surfacing through the same
 * call path) that retrying with a different credential can't fix.
 */
export class InsufficientScopeError extends FrodoError {}

/**
 * Resolves the scope string to actually request for a module's declared
 * required scopes, given the current session's auth mode.
 *
 * @remarks
 * Every non-browser auth mode (password, service-account, Amster) already
 * holds a session cookie or a full-scope bearer token, so the module's
 * required scopes pass straight through unchanged — there is nothing to
 * narrow or gate. Cloud browser-login mode is the one case that matters: its
 * AM-domain calls go through an RFC 8693 exchange (see
 * `BrowserAuthenticateOps.ts`'s `exchangeTokenForScope`) via a Ping-owned
 * client (`AICMCPExchangeClient`) with a hard-coded scope allow-list
 * (`Constants.CLOUD_BROWSER_MODE_AVAILABLE_SCOPES`). A module whose required
 * scope falls outside that allow-list is structurally unreachable via cloud
 * browser-mode, so this throws a clear, actionable error rather than letting
 * the call fail later with an opaque 400/401 from AM.
 */
export function resolveAvailableScope({
  requiredScopes,
  state,
}: {
  requiredScopes: string[];
  state: State;
}): string {
  const isCloudBrowserMode =
    state.getAuthMode() === 'interactive' &&
    state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY;

  if (!isCloudBrowserMode) {
    return requiredScopes.join(' ');
  }

  const unavailable = requiredScopes.filter(
    (scope) => !Constants.CLOUD_BROWSER_MODE_AVAILABLE_SCOPES.includes(scope)
  );

  if (unavailable.length > 0) {
    throw new InsufficientScopeError(
      `This operation requires scope(s) [${unavailable.join(', ')}], which cloud browser-login mode cannot obtain. AICMCPExchangeClient (the client browser-mode exchanges AM-domain tokens through) only allows: ${Constants.CLOUD_BROWSER_MODE_AVAILABLE_SCOPES.join(', ')}. Use a non-browser auth mode for this operation, or wait for a widened/dedicated exchange client.`
    );
  }

  return requiredScopes.join(' ');
}

/**
 * Returns whether a single granted scope covers a single required scope:
 * an exact match, or a wildcard grant (`fr:idc:esv:*`) whose prefix covers
 * the required scope (`fr:idc:esv:read`).
 */
function scopeSatisfies(grantedScope: string, requiredScope: string): boolean {
  if (grantedScope === requiredScope) return true;
  return (
    grantedScope.endsWith(':*') &&
    requiredScope.startsWith(grantedScope.slice(0, -1))
  );
}

/**
 * Local pre-flight gate: throws before a request goes out if the current
 * session's credential does not carry a scope an operation requires,
 * instead of letting AM/IDM reject the call over the wire.
 *
 * @remarks
 * This is called from exactly one place — `api/BaseApi.ts`'s per-request
 * credential resolvers — never from ops-layer code. Required scopes are
 * declared at the api layer (one value per api-layer function, since each
 * one maps 1:1 to a single HTTP verb+path, the same granularity AIC's own
 * scope enforcement operates at) and required (non-optional) on
 * `generateAmApi`/`generateIdmApi`/`generateEnvApi`/etc., so there is no
 * ops-layer call site that could forget to gate a new operation — omitting
 * `requiredScopes` anywhere in that chain is a compile error, not a silent
 * gap. See the `anchor-enforcement-at-wire-layer` design note for why this
 * replaced an earlier, ops-layer-anchored version of this same gate.
 *
 * OAuth2 scope-gated access control (the `fr:` namespace) is a PingOne
 * Advanced Identity Cloud concept, not a universal one — classic has no
 * such scope model at all, and it's unconfirmed whether ForgeOps's IDM
 * shares cloud's (see the `frodo-scopes-are-cloud-only` design note); this
 * check is a no-op for every deployment type except cloud. It's also a
 * no-op whenever the caller has no granted-scope value to check at all
 * (e.g. a plain AM session cookie, which carries no OAuth2 scope concept,
 * or no token yet because login hasn't completed) — callers pass `undefined`
 * for `grantedScope` in exactly those cases rather than this function
 * inferring it.
 */
export function assertHasRequiredScope({
  requiredScopes,
  grantedScope,
  state,
}: {
  requiredScopes: string[];
  grantedScope: string | undefined;
  state: State;
}): void {
  if (state.getDeploymentType() !== Constants.CLOUD_DEPLOYMENT_TYPE_KEY) {
    return;
  }

  if (!grantedScope) {
    return;
  }

  const granted = grantedScope.split(' ').filter(Boolean);
  const missing = requiredScopes.filter(
    (required) => !granted.some((g) => scopeSatisfies(g, required))
  );

  if (missing.length > 0) {
    throw new InsufficientScopeError(
      `This operation requires scope(s) [${missing.join(', ')}], which the current session's token does not carry (granted: [${
        granted.join(', ') || 'none'
      }]). Re-authenticate with a credential granted the required scope to continue.`
    );
  }
}
