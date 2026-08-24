import { AxiosError } from 'axios';

export class FrodoError extends Error {
  originalErrors: Error[] = [];
  isHttpError: boolean = false;
  httpCode: string;
  httpStatus: number;
  httpMessage: string;
  httpDetail: string;
  httpErrorText: string;
  httpErrorReason: string;
  httpDescription: string;

  constructor(message: string, originalErrors: Error | Error[] = null) {
    super(message);
    this.name = this.constructor.name;

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
      this.httpCode = originalError['code'];
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
    });
    // if (this.originalErrors.slice(-1))
    //   combinedMessage += '\n  ' + this.originalErrors.slice(-1)[0].stack;
    return combinedMessage;
  }

  toString() {
    return this.getCombinedMessage();
  }
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
