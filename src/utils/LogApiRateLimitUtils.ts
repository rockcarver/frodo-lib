/**
 * What the Log API says about its rate limit, and what to do with it.
 *
 * The Log API (`/monitoring/logs`, `/monitoring/logs/tail` and
 * `/monitoring/logs/sources`) is the one throttled API that frodo uses. Ping
 * documents 60 requests per minute for an environment, shared by everything
 * that reads the logs of that environment (other processes, MCP servers,
 * SIEM exports), see
 * https://docs.pingidentity.com/pingoneaic/tenants/audit-debug-logs-pull.html.
 * The limit that a response reports is the one to go by: it has been seen to
 * differ between environments, so nothing in the library assumes a value.
 *
 * Every answer of the API carries the headers `X-RateLimit-Limit`,
 * `X-RateLimit-Remaining` and `X-RateLimit-Reset` (seconds since 1970-01-01
 * UTC at which the window resets). An answer that rejects a request with 429
 * carries them too, and may carry `Retry-After`, which Ping does not document.
 */

/** The state of the rate limit of the Log API as of one answer of the API. */
export type LogApiRateLimit = {
  /**
   * The number of requests that the API allows in one window, as reported by `X-RateLimit-Limit`.
   * It is shared by every reader of the logs of the environment.
   */
  limit: number;
  /**
   * The number of requests that are left in the current window, as reported by `X-RateLimit-Remaining`.
   * Requests of other readers count against it too.
   */
  remaining: number;
  /**
   * When the current window resets, in milliseconds since 1970-01-01 UTC on the clock of this machine
   * (`X-RateLimit-Reset` is in seconds). If the answer carries a `Date` header and the clock of this
   * machine differs from the one of the server by more than a couple of seconds, the difference is
   * taken out, so that `resetAt - Date.now()` is the time left in the window either way.
   */
  resetAt: number;
};

/** How far the clock of this machine may be off the one of the server before the difference is taken out. */
const CLOCK_TOLERANCE_MS = 2000;
/** Added to every wait for the end of a window: the reset is given in whole seconds. */
const WAIT_MARGIN_MS = 1000;

/**
 * Reads one header, whether `headers` is an `AxiosHeaders` instance or a plain object.
 * @param {unknown} headers the headers of a response
 * @param {string} name lower-case name of the header
 * @returns {string | undefined} the value, or undefined if the header is absent or empty
 */
function readHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const get = (headers as { get?: unknown }).get;
  let value: unknown;
  if (typeof get === 'function') {
    value = (get as (header: string) => unknown).call(headers, name);
  }
  if (value === undefined || value === null) {
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
    value = key ? (headers as Record<string, unknown>)[key] : undefined;
  }
  if (Array.isArray(value)) value = value[0];
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

/**
 * Reads a header that holds a non-negative number.
 * @param {unknown} headers the headers of a response
 * @param {string} name lower-case name of the header
 * @returns {number | undefined} the number, or undefined if the header is absent or not a non-negative number
 */
function readNumber(headers: unknown, name: string): number | undefined {
  const text = readHeader(headers, name);
  if (text === undefined) return undefined;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * The time the window resets, on the clock of this machine.
 * @param {unknown} headers the headers of a response
 * @param {number} now current time, in milliseconds since 1970-01-01 UTC
 * @returns {number | undefined} milliseconds since 1970-01-01 UTC, or undefined if the answer has no usable `X-RateLimit-Reset`
 */
function readResetAt(headers: unknown, now: number): number | undefined {
  const reset = readNumber(headers, 'x-ratelimit-reset');
  if (reset === undefined) return undefined;
  let resetAt = reset * 1000;
  // The reset is a point in time on the clock of the server. A machine whose clock is off (a virtual machine that
  // slept, a container) would otherwise wait for a window that is long over, or not at all.
  const serverNow = Date.parse(readHeader(headers, 'date') ?? '');
  if (
    Number.isFinite(serverNow) &&
    Math.abs(serverNow - now) > CLOCK_TOLERANCE_MS
  ) {
    resetAt -= serverNow - now;
  }
  return Number.isFinite(new Date(resetAt).getTime()) ? resetAt : undefined;
}

/**
 * Reads the rate limit state from the headers of an answer of the Log API.
 * @param {unknown} headers the headers of the response (an `AxiosHeaders` instance or a plain object)
 * @param {number} now current time, in milliseconds since 1970-01-01 UTC; only the tests pass it
 * @returns {LogApiRateLimit | undefined} the state, or undefined if the answer lacks any of `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`, or one of them is not a number
 */
export function parseLogApiRateLimit(
  headers: unknown,
  now: number = Date.now()
): LogApiRateLimit | undefined {
  const limit = readNumber(headers, 'x-ratelimit-limit');
  const remaining = readNumber(headers, 'x-ratelimit-remaining');
  const resetAt = readResetAt(headers, now);
  if (limit === undefined || remaining === undefined || resetAt === undefined) {
    return undefined;
  }
  return { limit, remaining, resetAt };
}

/**
 * How long to wait before a request that was rejected with 429 is sent again.
 * `Retry-After` (seconds) wins where an answer carries it, otherwise the end of the window that
 * `X-RateLimit-Reset` names is awaited.
 * @param {unknown} headers the headers of the 429 response
 * @param {number} now current time, in milliseconds since 1970-01-01 UTC; only the tests pass it
 * @returns {number | undefined} milliseconds to wait, or undefined if the answer says nothing the caller can wait for
 */
export function getRateLimitWaitMs(
  headers: unknown,
  now: number = Date.now()
): number | undefined {
  const retryAfter = readNumber(headers, 'retry-after');
  if (retryAfter !== undefined) {
    return retryAfter * 1000 + WAIT_MARGIN_MS;
  }
  const resetAt = readResetAt(headers, now);
  if (resetAt !== undefined) {
    return Math.max(0, resetAt - now) + WAIT_MARGIN_MS;
  }
  return undefined;
}
