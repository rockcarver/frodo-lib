import { expect } from '@jest/globals';
import { AxiosError, AxiosHeaders } from 'axios';
import { FrodoError } from '../../ops/FrodoError';

/**
 * A failed request the way the API layer lets it escape: an `AxiosError` with a response.
 * @param {number} status HTTP status of the response
 * @param {Record<string, string>} headers headers of the response
 * @returns {AxiosError} the error an API function rejects with
 */
export function failedRequest(
  status = 500,
  headers: Record<string, string> = {}
): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
    config,
    undefined,
    {
      status,
      statusText: 'sample status',
      headers,
      config,
      data: { message: 'sample failure' },
    }
  );
}

/**
 * Assert that a promise rejects with the `FrodoError` of the `catch` of an ops function: the message names the
 * operation, the cause is attached in `originalErrors`, and the HTTP details of the cause are readable on it.
 * A function that returns the promise of the API layer from a `try` block without `await` fails this check, because
 * its `catch` never runs and the raw `AxiosError` reaches the caller.
 * @param {Promise<unknown>} promise the promise returned by the ops function
 * @param {string} message the message of the `FrodoError` thrown by the `catch`
 * @param {Error} cause the error the mocked function rejected with, or the error that was raised inside the function
 * @param {number} wrappers number of `FrodoError`s between the caller and the cause: 1 when the function calls the
 * API layer itself, 2 when it calls another ops function that wraps the failure in its own `FrodoError` first
 */
export async function expectWrappedFailure(
  promise: Promise<unknown>,
  message: string,
  cause: Error,
  wrappers = 1
): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(FrodoError);
  expect(error).not.toBe(cause);
  const wrapped = error as FrodoError;
  expect(wrapped.message).toBe(message);
  let inner: Error = wrapped;
  let innermost: FrodoError = wrapped;
  for (let level = 1; level <= wrappers; level++) {
    expect(inner).toBeInstanceOf(FrodoError);
    innermost = inner as FrodoError;
    expect(innermost.originalErrors).toHaveLength(1);
    inner = innermost.originalErrors[0];
  }
  expect(inner).toBe(cause);
  if (cause instanceof AxiosError) {
    // the FrodoError that wraps the request failure carries its HTTP details
    expect(innermost.isHttpError).toBe(true);
    expect(innermost.httpStatus).toBe(cause.response.status);
  }
}
