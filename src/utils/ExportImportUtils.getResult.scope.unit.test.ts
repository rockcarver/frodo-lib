/**
 * Unit tests for how getResult() treats the two answers that used to be skipped without a word:
 *
 * - an insufficient scope (an InsufficientScopeError anywhere in the error chain) is a failed item: it goes to the
 *   result callback as an error that names the item, with the cause nested and the code INSUFFICIENT_SCOPE, or it is
 *   thrown when there is no callback;
 * - the answer "This operation is not available in PingOne Advanced Identity Cloud." (HTTP 403) is still skipped
 *   silently, now with a debug message that names the operation and the request.
 *
 * Run with:
 *
 *        npm run test:only ExportImportUtils.getResult.scope
 *
 * Origin: frodo-lib#957 (bulk exports and imports report per item). No recording and no tenant is needed: the functions
 * are fakes.
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import { FrodoError } from '../ops/FrodoError';
import {
  assertHasRequiredScope,
  InsufficientScopeError,
  resolveAvailableScope,
} from '../ops/RequiredScopesOps';
import { getResult } from './ExportImportUtils';

const NOT_AVAILABLE =
  'This operation is not available in PingOne Advanced Identity Cloud.';

/** An error that the cloud answers with 403 and the "not available" message, as the api layer raises it. */
function notAvailableError(url = 'https://example.com/am/json/things'): Error {
  const error = new AxiosError('Request failed with status code 403');
  error.config = { url, method: 'get' } as AxiosError['config'];
  error.response = {
    status: 403,
    data: { code: 403, message: NOT_AVAILABLE },
  } as AxiosError['response'];
  return new FrodoError('Error reading things', error);
}

/** An insufficient scope error wrapped the way export-everything callers wrap it: two layers deep. */
function wrappedScopeError(): FrodoError {
  const cause = new InsufficientScopeError(
    'This operation requires scope(s) [fr:idm:*], which the current session does not carry.',
    null,
    'INSUFFICIENT_SCOPE'
  );
  return new FrodoError(
    'Error exporting things',
    new FrodoError('Error reading things', cause)
  );
}

function stateWithDebug(handler = jest.fn()) {
  return { state: { getDebugHandler: () => handler }, handler };
}

describe('getResult() and an insufficient scope', () => {
  test('is a failed item: the callback gets an error that names the item, with the cause nested and the code', async () => {
    const resultCallback = jest.fn();
    const cause = wrappedScopeError();

    const result = await getResult(
      resultCallback,
      'Error exporting the thing alpha',
      async () => {
        throw cause;
      }
    );

    expect(result).toBeNull();
    expect(resultCallback).toHaveBeenCalledTimes(1);
    const [error, value] = resultCallback.mock.calls[0] as [
      FrodoError,
      unknown,
    ];
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error exporting the thing alpha');
    expect(error.originalErrors).toEqual([cause]);
    expect(error.code).toBe('INSUFFICIENT_SCOPE');
    expect(value).toBeUndefined();
  });

  test('is recognised at any depth of the error chain', async () => {
    const resultCallback = jest.fn();
    let deep: Error = new InsufficientScopeError(
      'needs a scope',
      null,
      'INSUFFICIENT_SCOPE'
    );
    for (let layer = 0; layer < 4; layer++) {
      deep = new FrodoError(`layer ${layer}`, deep);
    }

    await getResult(resultCallback, 'Error doing it', async () => {
      throw deep;
    });

    expect(resultCallback).toHaveBeenCalledTimes(1);
    expect((resultCallback.mock.calls[0][0] as FrodoError).code).toBe(
      'INSUFFICIENT_SCOPE'
    );
  });

  test('is thrown, naming the item and with the code, when there is no callback', async () => {
    const cause = wrappedScopeError();

    const error: FrodoError = await getResult(
      undefined,
      'Error exporting the thing alpha',
      async () => {
        throw cause;
      }
    ).catch((e) => e);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error exporting the thing alpha');
    expect(error.originalErrors).toEqual([cause]);
    expect(error.code).toBe('INSUFFICIENT_SCOPE');
  });

  test('without an error message the error itself is passed on, and it carries the code from where it was raised', async () => {
    const resultCallback = jest.fn();
    const raised = new InsufficientScopeError(
      'needs a scope',
      null,
      'INSUFFICIENT_SCOPE'
    );

    await getResult(resultCallback, undefined, async () => {
      throw raised;
    });

    expect(resultCallback).toHaveBeenCalledWith(raised, undefined);
    expect(raised.code).toBe('INSUFFICIENT_SCOPE');
  });

  test('the errors that the library raises for a missing scope carry the code', () => {
    const state = {
      getDeploymentType: () => 'cloud',
      getAuthMode: () => 'interactive',
    } as any;
    let missing: unknown;
    try {
      assertHasRequiredScope({
        requiredScopes: ['fr:idm:*'],
        grantedScope: 'fr:am:*',
        state,
      });
    } catch (error) {
      missing = error;
    }
    let unavailable: unknown;
    try {
      resolveAvailableScope({
        requiredScopes: ['fr:not-a-scope:*'],
        state,
      });
    } catch (error) {
      unavailable = error;
    }

    expect(missing).toBeInstanceOf(InsufficientScopeError);
    expect((missing as FrodoError).code).toBe('INSUFFICIENT_SCOPE');
    expect(unavailable).toBeInstanceOf(InsufficientScopeError);
    expect((unavailable as FrodoError).code).toBe('INSUFFICIENT_SCOPE');
  });

  test('the item with the missing scope fails and the others are still processed, each reported once, in order', async () => {
    const outcomes: Array<[string | undefined, string | undefined]> = [];
    const resultCallback = (error?: FrodoError, result?: string) =>
      outcomes.push([error?.message, result]);
    const items = ['a', 'b', 'c'];
    const processed: string[] = [];

    for (const item of items) {
      const result = await getResult(
        resultCallback,
        `Error exporting item ${item}`,
        async () => {
          if (item === 'b') throw wrappedScopeError();
          return item.toUpperCase();
        }
      );
      if (result) processed.push(result);
    }

    expect(processed).toEqual(['A', 'C']);
    expect(outcomes).toEqual([
      [undefined, 'A'],
      ['Error exporting item b', undefined],
      [undefined, 'C'],
    ]);
  });

  test('an ordinary failure carries no code', async () => {
    const resultCallback = jest.fn();

    await getResult(resultCallback, 'Error doing it', async () => {
      throw new Error('boom');
    });

    expect(
      (resultCallback.mock.calls[0][0] as FrodoError).code
    ).toBeUndefined();
  });

  test('a 403 with another message is a failed item, not a skipped one', async () => {
    const resultCallback = jest.fn();
    const forbidden = new AxiosError('Request failed with status code 403');
    forbidden.response = {
      status: 403,
      data: { code: 403, message: 'Forbidden' },
    } as AxiosError['response'];

    const result = await getResult(
      resultCallback,
      'Error doing it',
      async () => {
        throw new FrodoError('Error reading things', forbidden);
      }
    );

    expect(result).toBeNull();
    expect(resultCallback).toHaveBeenCalledTimes(1);
    expect((resultCallback.mock.calls[0][0] as FrodoError).message).toBe(
      'Error doing it'
    );
  });
});

describe('getResult() and an operation that is not available in the cloud', () => {
  test('is skipped silently: no callback call, nothing thrown, null returned', async () => {
    const resultCallback = jest.fn();
    const { state } = stateWithDebug();

    const result = await getResult(
      resultCallback,
      'Error exporting circles of trust',
      async () => {
        throw notAvailableError();
      },
      { state }
    );

    expect(result).toBeNull();
    expect(resultCallback).not.toHaveBeenCalled();
  });

  test('is skipped without a callback as well', async () => {
    const { state } = stateWithDebug();

    await expect(
      getResult(
        undefined,
        'Error exporting circles of trust',
        async () => {
          throw notAvailableError();
        },
        { state }
      )
    ).resolves.toBeNull();
  });

  test('is written to the debug handler once, naming the function, the operation and the request', async () => {
    const { state, handler } = stateWithDebug();
    async function exportCirclesOfTrust(_params: unknown): Promise<null> {
      throw notAvailableError('https://example.com/am/json/circlesoftrust');
    }

    await getResult(
      jest.fn(),
      'Error exporting circles of trust',
      exportCirclesOfTrust,
      { state }
    );

    expect(handler).toHaveBeenCalledTimes(1);
    const message = String(handler.mock.calls[0][0]);
    expect(message).toContain('exportCirclesOfTrust');
    expect(message).toContain('Error exporting circles of trust');
    expect(message).toContain(
      'not available in PingOne Advanced Identity Cloud'
    );
    expect(message).toContain('GET https://example.com/am/json/circlesoftrust');
  });

  test('finds the state in a parameter that is not the first one', async () => {
    const { state, handler } = stateWithDebug();

    await getResult(
      undefined,
      'Error doing it',
      async () => {
        throw notAvailableError();
      },
      'a plain parameter',
      { state }
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('is skipped also when no state can be found for the debug message', async () => {
    const resultCallback = jest.fn();

    const result = await getResult(
      resultCallback,
      'Error doing it',
      async () => {
        throw notAvailableError();
      },
      'a plain parameter'
    );

    expect(result).toBeNull();
    expect(resultCallback).not.toHaveBeenCalled();
  });

  test('writes no debug message for a failure that is not skipped', async () => {
    const { state, handler } = stateWithDebug();

    await getResult(
      jest.fn(),
      'Error doing it',
      async () => {
        throw new Error('boom');
      },
      { state }
    );

    expect(handler).not.toHaveBeenCalled();
  });
});
