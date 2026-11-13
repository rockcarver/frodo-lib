import { AxiosError, type AxiosResponse } from 'axios';
import type { LogApiRateLimit } from '../utils/LogApiRateLimitUtils';
import { PROXY_FAILURE_CODES } from '../utils/ProxyFailureUtils';

/**
 * The error conditions that carry a stable identity (see `FrodoError.code`).
 *
 * A message of the library states facts. How to fix the condition is advice
 * in the words of one interface (an option of a command line, a field of a
 * form, a tool argument), and the library does not know its caller. A caller
 * that wants to give that advice recognises the condition by its code instead
 * of parsing the message.
 *
 * Codes are never renamed or reused. Add a code here when a caller needs to
 * recognise a condition; a message without a code is not a promise.
 */
export const FRODO_ERROR_CODES = [
  /** Browser login found no valid cached session for the host. */
  'BROWSER_LOGIN_NO_SESSION',
  /** A username was given, but the connection profile stores no password for it. */
  'LOGIN_NO_STORED_PASSWORD',
  /** Browser login could not establish the deployment type of the host. */
  'BROWSER_LOGIN_DEPLOYMENT_TYPE_UNKNOWN',
  /** A redirect URI other than the registered one was given with the built-in Cloud client. */
  'BROWSER_LOGIN_REDIRECT_URI_NOT_SUPPORTED',
  /** ForgeOps browser login needs an OAuth2 client id, and none is set. */
  'BROWSER_LOGIN_FORGEOPS_CLIENT_ID_REQUIRED',
  /** Classic browser login needs an OAuth2 client id, and none is set. */
  'BROWSER_LOGIN_CLASSIC_CLIENT_ID_REQUIRED',
  /** Classic browser login needs a session-capture script on the OAuth2 client, and the token carries no session. */
  'BROWSER_LOGIN_CLASSIC_SESSION_CAPTURE_REQUIRED',
  /** A capability needs the Log API key and secret, and the connection has none. */
  'LOG_API_CREDENTIAL_MISSING',
  /**
   * A request through a proxy failed because of the proxy: it refused the
   * tunnel or the credentials, could not be reached, refused the connection or
   * closed it. The codes and what each one means are in ProxyFailureUtils.
   */
  ...PROXY_FAILURE_CODES,
  /**
   * The credential of the connection does not carry a scope that a request needs.
   * It is on the error that is raised before the request is sent, and on the error of an item of a bulk
   * operation that failed for this reason; in a nested error it is found through `originalErrors`.
   */
  'INSUFFICIENT_SCOPE',
  /** CIMD profiles were asked for in a realm of a deployment that does not offer the agent type `CIMDProfile`. */
  'CIMD_PROFILES_NOT_AVAILABLE',
  /**
   * The Log API rejected a request with 429 because the rate limit of the environment is exceeded. The limit is
   * shared by every reader of the logs of the environment. If the answer carried the `X-RateLimit-*` headers, the
   * error holds them as `rateLimit`, and `rateLimit.resetAt` is when the window resets.
   */
  'LOG_API_RATE_LIMITED',
] as const;

/** The identity of an error condition, see {@link FRODO_ERROR_CODES}. */
export type FrodoErrorCode = (typeof FRODO_ERROR_CODES)[number];

export class FrodoError extends Error {
  /**
   * Every code that a `FrodoError` can carry, for a caller that keeps a table
   * keyed by code and wants to be told when the library adds one.
   */
  static readonly codes: readonly FrodoErrorCode[] = FRODO_ERROR_CODES;

  /**
   * The stable identity of the condition this error reports, if it has one.
   * It is stable across releases, unlike the message. An error that wraps
   * another `FrodoError` does not copy its code: look through `originalErrors`
   * for the condition underneath. The one exception is a request that failed
   * because of its proxy: the error of the request carries `proxyFailure`, and
   * the `FrodoError` that wraps it is given that failure's code.
   */
  code?: FrodoErrorCode;
  /**
   * The state of the rate limit of the Log API, on the error that reports a request the API rejected with 429 (code
   * `LOG_API_RATE_LIMITED`), if the answer carried the `X-RateLimit-*` headers. Like `code`, it is not copied by an
   * error that wraps this one.
   */
  rateLimit?: LogApiRateLimit;
  /**
   * The `x-forgerock-transactionid` header of the response of the request that failed, on the errors of operations
   * that set it explicitly (for example enabling the AI agent feature), where the platform's own log is the only way to
   * find the cause of a generic 500. Support asks for it. Declared, not initialised: an error that does not set it
   * has no such property. Like `code`, it is not copied by an error that wraps this one.
   */
  declare httpTransactionId?: string;
  originalErrors: Error[] = [];
  isHttpError: boolean = false;
  httpCode: string;
  httpStatus: number;
  httpMessage: string;
  httpDetail: string;
  httpErrorText: string;
  httpErrorReason: string;
  httpDescription: string;

  constructor(
    message: string,
    originalErrors: Error | Error[] = null,
    code?: FrodoErrorCode
  ) {
    super(message);
    this.name = this.constructor.name;
    if (code) this.code = code;

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }

    if (originalErrors && Array.isArray(originalErrors)) {
      this.originalErrors = originalErrors;
    } else if (originalErrors) {
      this.originalErrors = [originalErrors as Error];
    }

    // determine if http error and set http error fields
    if (originalErrors) {
      const originalError = this.originalErrors[0];
      this.isHttpError = originalError.name === 'AxiosError';
      // the code of a FrodoError names a condition of the library, not a
      // transport error, so it never becomes the http code of the wrapper
      this.httpCode =
        originalError.name === 'FrodoError' ? undefined : originalError['code'];
      this.httpStatus = originalError['response']
        ? originalError['response'].status
        : null;
      this.httpMessage = originalError['response']
        ? originalError['response'].data
          ? originalError['response'].data.message
          : null
        : null;
      this.httpDetail = originalError['response']
        ? originalError['response'].data
          ? originalError['response'].data.detail
          : null
        : null;
      this.httpErrorText = originalError['response']
        ? originalError['response'].data
          ? originalError['response'].data.error
          : null
        : null;
      this.httpErrorReason = originalError['response']
        ? originalError['response'].data
          ? originalError['response'].data.reason
          : null
        : null;
      this.httpDescription = originalError['response']
        ? originalError['response'].data
          ? originalError['response'].data.error_description
          : null
        : null;
    }

    // a request that failed because of its proxy: the condition is the one the
    // request reports (only the error of a request carries `proxyFailure`, so a
    // FrodoError that wraps a FrodoError copies nothing), see ProxyFailureUtils
    if (!this.code) {
      const failure = this.originalErrors
        .map((original) => original?.['proxyFailure'])
        .find((found) => FRODO_ERROR_CODES.includes(found?.code));
      if (failure) this.code = failure.code;
    }

    // message = `${message}${this.originalErrors.length ? ` [${this.originalErrors.length} nested error(s)]` : ''}`;

    // super.message = message;
  }

  getOriginalErrors(): Error[] {
    return this.originalErrors;
  }

  getCombinedMessage(level: number = 1): string {
    const indent = '  '.repeat(level);
    let combinedMessage = this.message || '';
    this.originalErrors.forEach((originalError) => {
      switch (originalError.name) {
        case 'FrodoError':
          combinedMessage +=
            `\n${indent}` +
            (originalError as FrodoError).getCombinedMessage(level + 1);
          break;

        case 'AxiosError':
          {
            combinedMessage += `\n${indent}Network error:`;
            combinedMessage += (originalError as AxiosError).config?.url
              ? `\n${indent}  URL: ${(originalError as AxiosError).config.url}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.status
              ? `\n${indent}  Status: ${(originalError as AxiosError).response.status}`
              : '';
            combinedMessage += (originalError as AxiosError).code
              ? `\n${indent}  Code: ${(originalError as AxiosError).code}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.[
              'data'
            ]?.['error']
              ? `\n${indent}  Error: ${(originalError as AxiosError).response?.['data']?.['error']}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.[
              'data'
            ]?.['reason']
              ? `\n${indent}  Reason: ${(originalError as AxiosError).response?.['data']?.['reason']}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.[
              'data'
            ]?.['message']
              ? `\n${indent}  Message: ${(originalError as AxiosError).response?.['data']?.['message']}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.[
              'data'
            ]?.['detail']
              ? `\n${indent}  Detail: ${typeof (originalError as AxiosError).response?.['data']?.['detail'] === 'object' ? JSON.stringify((originalError as AxiosError).response?.['data']?.['detail']) : (originalError as AxiosError).response?.['data']?.['detail']}`
              : '';
            combinedMessage += (originalError as AxiosError).response?.[
              'data'
            ]?.['error_description']
              ? `\n${indent}  Description: ${(originalError as AxiosError).response?.['data']?.['error_description']}`
              : '';
          }
          break;

        default:
          combinedMessage += `\n${indent}` + originalError.message;
          break;
      }
      // a request that failed because of its proxy carries which proxy and what it did, see ProxyFailureUtils
      const proxyFailure = originalError['proxyFailure'];
      if (proxyFailure?.message)
        combinedMessage += `\n${indent}${proxyFailure.message}`;
      // a failed host name lookup carries what is wrong, see NetworkDiagnosisUtils
      const diagnosis = originalError['nameResolutionDiagnosis'];
      if (diagnosis?.message)
        combinedMessage += `\n${indent}${diagnosis.message}`;
    });
    if (this.httpTransactionId)
      combinedMessage += `\n${indent}Transaction id: ${this.httpTransactionId}`;
    // if (this.originalErrors.slice(-1))
    //   combinedMessage += '\n  ' + this.originalErrors.slice(-1)[0].stack;
    return combinedMessage;
  }

  toString() {
    return this.getCombinedMessage();
  }
}

/**
 * The HTTP response of the request that failed, whether `error` is the raw `AxiosError` that a function of the api
 * layer throws or a `FrodoError` that wraps it. A `FrodoError` is followed through its first original error, at any
 * depth: that is the error it takes its own `httpStatus` from. Use this (not `error.response`) to read the answer of
 * the server in a `catch` block of code that calls an ops function: the ops function wraps a failed request in a
 * `FrodoError`, which has no `response` of its own.
 * @param {unknown} error the error that was caught
 * @returns {AxiosResponse | undefined} the response, or undefined if no error in the chain carries one
 */
export function getFailedResponse(error: unknown): AxiosResponse | undefined {
  const seen = new Set<unknown>();
  let link: unknown = error;
  while (link && typeof link === 'object' && !seen.has(link)) {
    seen.add(link);
    const { response, originalErrors } = link as {
      response?: AxiosResponse;
      originalErrors?: unknown;
    };
    if (response && typeof response === 'object') return response;
    link = Array.isArray(originalErrors) ? originalErrors[0] : undefined;
  }
  return undefined;
}

/**
 * The transaction id of the request that failed: the `x-forgerock-transactionid` header of the response, whether `error`
 * is the raw `AxiosError` of the api layer or a `FrodoError` that wraps it (see {@link getFailedResponse}). The
 * platform logs every request under this id, so it is what finds the cause behind a response that says nothing
 * ("500 Internal Server Error").
 * @param {unknown} error the error that was caught
 * @returns {string | undefined} the transaction id, or undefined if the response carries none
 */
export function getTransactionId(error: unknown): string | undefined {
  const headers = getFailedResponse(error)?.headers as
    { get?: (name: string) => unknown; [name: string]: unknown } | undefined;
  if (!headers) return undefined;
  const value =
    typeof headers.get === 'function'
      ? headers.get('x-forgerock-transactionid')
      : headers['x-forgerock-transactionid'];
  return typeof value === 'string' && value ? value : undefined;
}

/** True if `error` itself (not any wrapped cause) directly carries a 404 status. */
function hasDirect404Status(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const withStatus = error as { httpStatus?: unknown; response?: unknown };
  if (withStatus.httpStatus === 404) {
    return true;
  }
  const response = withStatus.response as { status?: unknown } | undefined;
  return !!response && response.status === 404;
}

/**
 * True only for a confirmed HTTP 404 — never for permission (403), server
 * (5xx), network/timeout, or malformed-response failures. Use this (not a
 * bare `catch` block) to decide whether a failed existence-check read means
 * "confirmed absent, safe to create" versus "the check itself failed, don't
 * guess."
 *
 * @remarks
 * Checks the error itself first (a `FrodoError.httpStatus`, or a raw
 * axios-shaped `error.response.status` — `originalErrors` can hold either,
 * see {@link FrodoError.getCombinedMessage}'s own `FrodoError`-vs-
 * `AxiosError` branching), then recurses through
 * {@link FrodoError.originalErrors} if this is a `FrodoError`. Two things
 * make the direct check alone insufficient: a `FrodoError` thrown from
 * inside another `FrodoError`'s own `catch` block (a double-wrap, e.g. a
 * read function that itself calls another read function) has no
 * `.response` of its own for the outer wrap's constructor to read a status
 * off of, so its own `httpStatus` is `null` even when the underlying
 * failure genuinely was a 404; and `FrodoError.httpStatus` itself only ever
 * reflects `originalErrors[0]` (see the constructor), so a 404 at another
 * index of a wrapped *array* of causes would otherwise be missed too.
 * Recursing checks every node in the chain, at any depth, individually.
 */
export function isNotFoundError(error: unknown): boolean {
  if (hasDirect404Status(error)) {
    return true;
  }
  if (error instanceof FrodoError) {
    return error.originalErrors.some((original) => isNotFoundError(original));
  }
  return false;
}
