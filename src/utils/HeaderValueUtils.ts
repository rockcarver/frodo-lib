/**
 * Whether a text may be sent as the value of a request header: printable ASCII
 * only and not unreasonably long. Used for validators (`ETag`, `Last-Modified`)
 * that come from a file, which is not trusted.
 * @param {unknown} value the candidate value
 * @returns {boolean} true if it is safe to send
 */
export function isSafeHeaderValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    /^[\x20-\x7e]+$/.test(value)
  );
}
