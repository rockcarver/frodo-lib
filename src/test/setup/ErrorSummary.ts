/**
 * The parts of an error that a snapshot can hold without a host name, a stack or a request URL: the message chain of a
 * `FrodoError`, its code, and for a failed request the status and the body the server answered.
 *
 * `FrodoError.getCombinedMessage()` is not used on purpose: it prints the URL of the request, which holds the host the
 * test was recorded against.
 * @param {unknown} error the error to summarise
 * @returns {object} a plain object
 */
export function summarizeError(error: unknown): Record<string, unknown> {
  const e = error as {
    name?: string;
    message?: string;
    code?: string;
    originalErrors?: unknown[];
    response?: { status?: number; data?: unknown };
  };
  const summary: Record<string, unknown> = {
    name: e?.name,
    message: e?.message,
  };
  if (e?.code && typeof e.code === 'string' && e.name === 'FrodoError') {
    summary.code = e.code;
  }
  if (e?.response) {
    summary.status = e.response.status;
    summary.data = e.response.data;
  }
  if (Array.isArray(e?.originalErrors) && e.originalErrors.length > 0) {
    summary.causes = e.originalErrors.map(summarizeError);
  }
  return summary;
}
