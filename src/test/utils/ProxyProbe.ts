/**
 * What the live proxy probe (src/api/BaseApi.proxy.live.test.ts) does with the
 * answer of the tenant.
 *
 * The probe sends one unauthenticated request through a real proxy to a real
 * tenant. When the tenant is down, that request fails for a reason that has
 * nothing to do with the proxy, and a pull request must not fail because of it.
 * So the probe first sends the same request without the proxy:
 *
 * - the tenant answers 2xx: the request through the proxy must answer 2xx too;
 * - the tenant does not answer 2xx (no answer at all, a timeout, a 5xx, a 429,
 *   any other status): the probe says nothing about the proxy, tells so loudly,
 *   and does not send the request through the proxy.
 *
 * The decision is a pure function so that a test can pin it without a tenant.
 * See decisions/0017-proxy-support-is-guarded-by-a-short-named-set-of-tests.md.
 */

/** How the direct request ended: with an HTTP status, or with an error and no answer. */
export type DirectOutcome = { status: number } | { error: unknown };

export type ProbeVerdict =
  | { run: true }
  /** `reason` is a sentence fragment that names the status or the error. */
  | { run: false; reason: string };

/**
 * Decide from the result of the direct request whether the probe can say
 * anything about the proxy.
 * @param {DirectOutcome} direct the status of the answer, or the error of a request that got none
 * @returns {ProbeVerdict} run the proxied request only if the tenant answered 2xx
 */
export function proxyProbeVerdict(direct: DirectOutcome): ProbeVerdict {
  const error = 'error' in direct ? (direct.error as any) : undefined;
  // axios rejects a non-2xx answer with the answer attached
  const status: unknown =
    'status' in direct ? direct.status : error?.response?.status;
  if (typeof status === 'number') {
    return status >= 200 && status < 300
      ? { run: true }
      : { run: false, reason: `status ${status}` };
  }
  const what = error?.code ?? error?.message ?? String(error);
  return { run: false, reason: `no answer, ${what}` };
}

/**
 * Run the probe: the direct request first, the request through the proxy only
 * if the tenant answered 2xx on the direct one.
 * @param {object} steps the steps of the probe
 * @param {() => Promise<unknown>} steps.askDirect sends the request without the proxy; resolves for a 2xx answer and rejects otherwise
 * @param {() => Promise<unknown>} steps.askThroughProxy sends the same request through the proxy; rejects if it fails
 * @param {(message: string) => void} steps.announce tells the person who reads the log that the probe did not run
 * @returns {Promise<'ran' | 'skipped'>} whether the request through the proxy was sent
 */
export async function runProxyProbe({
  askDirect,
  askThroughProxy,
  announce,
}: {
  askDirect: () => Promise<unknown>;
  askThroughProxy: () => Promise<unknown>;
  announce: (message: string) => void;
}): Promise<'ran' | 'skipped'> {
  let direct: DirectOutcome;
  try {
    await askDirect();
    // axios resolves only a 2xx answer, so the exact status is not needed
    direct = { status: 200 };
  } catch (error) {
    direct = { error };
  }
  const verdict = proxyProbeVerdict(direct);
  if (verdict.run === false) {
    announce(
      `The tenant did not answer a direct request with 2xx (${verdict.reason}), ` +
        'so the proxy probe says nothing about the proxy and was not run.'
    );
    return 'skipped';
  }
  await askThroughProxy();
  return 'ran';
}
