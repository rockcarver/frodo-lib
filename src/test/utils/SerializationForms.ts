import { format, formatWithOptions, inspect } from 'util';
import { AxiosError, AxiosHeaders } from 'axios';

/**
 * Made-up values for the tests of how errors are written: a test puts one into
 * a request and then searches every form that the error can be written in for
 * it. None of them is a real value.
 */
export const MARKER_A = 'MARKER-A-0001';
export const MARKER_B = 'MARKER-B-0001';
export const MARKER_C = 'MARKER-C-0001';
export const MARKER_D = 'MARKER-D-0001';

/**
 * Every way of writing a value that a consumer of the library and a terminal
 * use: `JSON.stringify` (compact and indented), `util.inspect` (default depth,
 * unlimited depth, with the hidden properties), `console.log` and `console.error`
 * (`util.format` and `formatWithOptions` with colors), the `%s`, `%o`, `%O` and
 * `%j` placeholders, a template string, and an object that holds the value.
 * @param {unknown} value the value to write
 * @returns {Record<string, string>} the text of each form, by name
 */
export function allForms(value: unknown): Record<string, string> {
  const holder = {
    status: 'error',
    nodes: { n1: { status: 'error', error: value } },
  };
  const safe = (write: () => unknown): string => {
    try {
      return String(write());
    } catch (error) {
      return `<throws ${String(error)}>`;
    }
  };
  return {
    'JSON.stringify': safe(() => JSON.stringify(value)),
    'JSON.stringify indented': safe(() => JSON.stringify(value, null, 2)),
    'JSON.stringify of a holder': safe(() => JSON.stringify(holder, null, 2)),
    'util.inspect': safe(() => inspect(value)),
    'util.inspect depth null': safe(() => inspect(value, { depth: null })),
    'util.inspect showHidden': safe(() =>
      inspect(value, { depth: null, showHidden: true })
    ),
    'util.inspect of a holder': safe(() => inspect(holder, { depth: null })),
    'console.log': safe(() => format(value)),
    'console.log colors': safe(() =>
      formatWithOptions({ colors: true }, value)
    ),
    'console.log of a holder': safe(() => format(holder)),
    '%s': safe(() => format('%s', value)),
    '%o': safe(() => format('%o', value)),
    '%O': safe(() => format('%O', value)),
    '%j': safe(() => format('%j', value)),
    template: safe(() => `${value as string}`),
    String: safe(() => String(value)),
  };
}

/** What the failed request of a test looked like. */
export type FailureOptions = {
  status?: number;
  method?: string;
  url?: string;
  baseURL?: string;
  headers?: Record<string, string> | AxiosHeaders;
  data?: unknown;
  auth?: { username: string; password: string };
  responseHeaders?: Record<string, string>;
  responseData?: unknown;
};

/**
 * The error of a request with headers, a body and an authentication: an
 * `AxiosError` whose config holds them and whose response carries what the
 * server answered.
 * @param {FailureOptions} options what the request and the answer held
 * @returns {AxiosError} the error
 */
export function failure(options: FailureOptions = {}): AxiosError {
  const status = options.status ?? 409;
  const headers =
    options.headers instanceof AxiosHeaders
      ? options.headers
      : new AxiosHeaders(
          options.headers ?? {
            Accept: 'application/json',
            Authorization: `Bearer ${MARKER_A}`,
          }
        );
  const config = {
    url: options.url ?? 'https://tenant.example.com/am/json/trees/n1',
    baseURL: options.baseURL,
    method: options.method ?? 'delete',
    headers,
    data: options.data,
    auth: options.auth,
    // a member of the config that no list of the view mentions
    extra: `Bearer ${MARKER_A}`,
  };
  return new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
    config as never,
    { _header: `DELETE /x HTTP/1.1\r\nAuthorization: Bearer ${MARKER_A}\r\n` },
    {
      status,
      statusText: 'sample status',
      headers: new AxiosHeaders(options.responseHeaders ?? {}),
      config: config as never,
      data: options.responseData ?? { code: status, message: 'sample failure' },
    }
  );
}
