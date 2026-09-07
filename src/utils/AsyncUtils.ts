/**
 * Wraps an async function so that concurrent invocations share a single
 * in-flight call instead of each independently triggering their own run.
 * Once the in-flight call settles (resolves or rejects), the next call
 * starts a fresh one.
 *
 * @remarks
 * Used to de-duplicate on-demand token refresh: if several API calls in
 * flight at once all discover their cached token has gone stale, only one
 * actual re-authentication should happen, with every caller awaiting that
 * same result rather than each kicking off its own redundant login.
 */
export function dedupeAsync<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | undefined;
  return () => {
    if (!inFlight) {
      inFlight = fn().finally(() => {
        inFlight = undefined;
      });
    }
    return inFlight;
  };
}
