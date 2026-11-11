/**
 * Unit tests for the answer "This operation is not available in PingOne Advanced Identity Cloud." (HTTP 403) in
 * getResult(), for the two shapes in which the answer reaches it.
 *
 * - The function that getResult() calls is an ops function: it throws a FrodoError that wraps the AxiosError of the
 *   api layer. FrodoError copies the status and the message of the response into `httpStatus` and `httpMessage`, but
 *   only from its immediate original error.
 * - The function is a function of the api layer, which is what a caller passes when it deletes, patches or reads one
 *   item directly (`_deleteConfigEntity`, `deleteVersionOfSecret`, `unassignRequestForm`, `patchRequestType`,
 *   `getConfigEntity`): it throws the raw AxiosError. A raw AxiosError has no `httpStatus` and no `httpMessage`, the
 *   answer is in `response.status` and `response.data.message`.
 *
 * Both are the same answer, and both are skipped without a word: no call of the result callback, nothing thrown, the
 * call itself is still made, and a debug message names the skip. Any other answer, in either shape, is a failed item:
 * the status and the message must both match, and the cause stays nested in the error that names the item.
 *
 * The tests use real AxiosErrors, as the api layer raises them, and fake only the function that getResult() calls.
 *
 * Run with:
 *
 *        npm run test:only ExportImportUtils.getResult.rawErrors
 *
 * Origin: frodo-lib#957 (bulk exports and imports report per item). No recording and no tenant is needed. All values
 * are made up.
 */
import { jest } from '@jest/globals';
import { AxiosError } from 'axios';
import { FrodoError } from '../ops/FrodoError';
import State from '../shared/State';
import { findFailedRequest, getResult } from './ExportImportUtils';

const NOT_AVAILABLE =
  'This operation is not available in PingOne Advanced Identity Cloud.';
const URL = 'https://openidm.example.com/openidm/config/sample/widget';

/** The answer of a server, as the api layer raises it: an AxiosError that carries the response. */
function axiosAnswer(
  status: number,
  data: unknown,
  { url = URL, method = 'get' }: { url?: string; method?: string } = {}
): AxiosError {
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST'
  );
  error.config = { url, method } as AxiosError['config'];
  error.response = { status, data } as AxiosError['response'];
  return error;
}

/** An AxiosError without a response: the server was not reached. */
function networkError(): AxiosError {
  const error = new AxiosError('connect ECONNRESET', 'ECONNRESET');
  error.config = { url: URL, method: 'get' } as AxiosError['config'];
  return error;
}

const notAvailable = (options?: { url?: string; method?: string }) =>
  axiosAnswer(403, { code: 403, message: NOT_AVAILABLE }, options);

/** The two shapes in which an api error reaches getResult(): as it is, or wrapped by an ops function. */
const SHAPES: [string, (cause: Error) => Error][] = [
  ['a raw AxiosError of the api layer', (cause) => cause],
  [
    'an AxiosError wrapped in a FrodoError of an ops function',
    (cause) => new FrodoError('Error reading the widget', cause),
  ],
];

/** The answers that are failures, with a name. The first ones have the right message but not the right status. */
const FAILING_ANSWERS: [string, () => Error][] = [
  [
    'a 500 with the "not available" message',
    () => axiosAnswer(500, { code: 500, message: NOT_AVAILABLE }),
  ],
  [
    'a 404 with the "not available" message',
    () => axiosAnswer(404, { code: 404, message: NOT_AVAILABLE }),
  ],
  [
    'a 401 with the "not available" message',
    () => axiosAnswer(401, { code: 401, message: NOT_AVAILABLE }),
  ],
  [
    'a 400 with the "not available" message',
    () => axiosAnswer(400, { code: 400, message: NOT_AVAILABLE }),
  ],
  [
    'a 403 with another message',
    () => axiosAnswer(403, { code: 403, message: 'Forbidden' }),
  ],
  [
    'a 403 with a message that lacks the final period',
    () =>
      axiosAnswer(403, {
        code: 403,
        message: NOT_AVAILABLE.replace(/\.$/, ''),
      }),
  ],
  ['a 403 without a message', () => axiosAnswer(403, { code: 403 })],
  ['a 403 without a body', () => axiosAnswer(403, null)],
  [
    'a 403 whose body is not an object',
    () => axiosAnswer(403, '<html>Forbidden</html>'),
  ],
  ['a 404 without a body', () => axiosAnswer(404, null)],
  ['a 500 without a body', () => axiosAnswer(500, null)],
  ['a network error', () => networkError()],
  ['an error without any http field', () => new Error('boom')],
];

const state = State({});
const debug = jest.fn();
const debugLines = () => debug.mock.calls.map(([message]) => String(message));
/** The debug lines that name the skip of a "not available" answer. */
const skipLines = () => debugLines().filter((line) => line.includes('skipped'));

beforeEach(() => {
  jest.clearAllMocks();
  state.setDebugHandler(debug);
});

afterEach(() => {
  state.setDebugHandler(undefined);
});

describe.each(SHAPES)('getResult() and %s', (_shape, shape) => {
  describe('answering 403 "not available in PingOne Advanced Identity Cloud"', () => {
    test('is skipped: the function is called, the callback is not, nothing is thrown, null is returned', async () => {
      const resultCallback = jest.fn();
      const func = jest.fn(async (_params: unknown): Promise<unknown> => {
        throw shape(notAvailable());
      });

      const result = await getResult(
        resultCallback,
        'Error deleting the widget',
        func,
        { widgetId: 'one', state }
      );

      expect(result).toBeNull();
      expect(func).toHaveBeenCalledTimes(1);
      expect(func).toHaveBeenCalledWith({ widgetId: 'one', state });
      expect(resultCallback).not.toHaveBeenCalled();
    });

    test('is skipped without a callback too: nothing is thrown', async () => {
      const func = jest.fn(async (_params: unknown): Promise<unknown> => {
        throw shape(notAvailable());
      });

      await expect(
        getResult(undefined, 'Error deleting the widget', func, { state })
      ).resolves.toBeNull();
      expect(func).toHaveBeenCalledTimes(1);
    });

    test('leaves one debug message that names the function, the operation and the request', async () => {
      async function deleteWidget(_params: unknown): Promise<unknown> {
        throw shape(notAvailable({ method: 'delete' }));
      }

      await getResult(jest.fn(), 'Error deleting the widget', deleteWidget, {
        state,
      });

      const lines = skipLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('ExportImportUtils.getResult: skipped');
      expect(lines[0]).toContain('deleteWidget');
      expect(lines[0]).toContain('Error deleting the widget');
      expect(lines[0]).toContain(
        'not available in PingOne Advanced Identity Cloud'
      );
      expect(lines[0]).toContain(`[DELETE ${URL}]`);
    });

    test('is skipped when there is no state to write the debug message to', async () => {
      const resultCallback = jest.fn();

      const result = await getResult(
        resultCallback,
        'Error deleting the widget',
        async () => {
          throw shape(notAvailable());
        },
        { widgetId: 'one' }
      );

      expect(result).toBeNull();
      expect(resultCallback).not.toHaveBeenCalled();
      expect(debug).not.toHaveBeenCalled();
    });

    test('is skipped when there is no debug handler: no message and no failure', async () => {
      state.setDebugHandler(undefined);
      const resultCallback = jest.fn();

      const result = await getResult(
        resultCallback,
        'Error deleting the widget',
        async () => {
          throw shape(notAvailable());
        },
        { state }
      );

      expect(result).toBeNull();
      expect(resultCallback).not.toHaveBeenCalled();
      expect(debug).not.toHaveBeenCalled();
    });

    test('skips the item and goes on: the others are reported once each, in order, and a failure in the same run stays a failure', async () => {
      const outcomes: [string | undefined, string | undefined][] = [];
      const resultCallback = (error?: FrodoError, result?: string) =>
        outcomes.push([error?.message, result]);
      const items = ['one', 'two', 'three', 'four'];
      const cause500 = axiosAnswer(500, { code: 500, message: 'boom' });

      const results: (string | null)[] = [];
      for (const item of items) {
        results.push(
          await getResult(
            resultCallback,
            `Error deleting widget ${item}`,
            async () => {
              if (item === 'two') throw shape(notAvailable());
              if (item === 'three') throw shape(cause500);
              return item.toUpperCase();
            },
            { state }
          )
        );
      }

      expect(results).toEqual(['ONE', null, null, 'FOUR']);
      expect(outcomes).toEqual([
        [undefined, 'ONE'],
        ['Error deleting widget three', undefined],
        [undefined, 'FOUR'],
      ]);
      expect(skipLines()).toHaveLength(1);
    });
  });

  describe('answering anything else', () => {
    test.each(FAILING_ANSWERS)(
      '%s is a failed item: it goes to the callback, names the item and nests the cause',
      async (_name, makeCause) => {
        const resultCallback = jest.fn();
        const thrown = shape(makeCause());

        const result = await getResult(
          resultCallback,
          'Error deleting the widget',
          async () => {
            throw thrown;
          },
          { state }
        );

        expect(result).toBeNull();
        expect(resultCallback).toHaveBeenCalledTimes(1);
        const [error, value] = resultCallback.mock.calls[0] as [
          FrodoError,
          unknown,
        ];
        expect(error).toBeInstanceOf(FrodoError);
        expect(error.message).toBe('Error deleting the widget');
        expect(error.originalErrors).toHaveLength(1);
        expect(error.originalErrors[0]).toBe(thrown);
        expect(value).toBeUndefined();
        expect(skipLines()).toEqual([]);
      }
    );

    test.each(FAILING_ANSWERS)(
      '%s is thrown when there is no callback, naming the item and nesting the cause',
      async (_name, makeCause) => {
        const thrown = shape(makeCause());

        const error: FrodoError = await getResult(
          undefined,
          'Error deleting the widget',
          async () => {
            throw thrown;
          },
          { state }
        ).then(
          () => {
            throw new Error('expected getResult to throw, but it returned');
          },
          (e) => e
        );

        expect(error).toBeInstanceOf(FrodoError);
        expect(error.message).toBe('Error deleting the widget');
        expect(error.originalErrors[0]).toBe(thrown);
        expect(skipLines()).toEqual([]);
      }
    );
  });
});

describe('getResult() and a failed item', () => {
  test('a raw 403 with another message keeps its status and message on the failed item', async () => {
    const resultCallback = jest.fn();
    const forbidden = axiosAnswer(403, { code: 403, message: 'Forbidden' });

    await getResult(
      resultCallback,
      'Error deleting the widget',
      async () => {
        throw forbidden;
      },
      { state }
    );

    const [error] = resultCallback.mock.calls[0] as [FrodoError];
    expect(error.originalErrors[0]).toBe(forbidden);
    expect(error.httpStatus).toBe(403);
    expect(error.httpMessage).toBe('Forbidden');
    expect(error.code).toBeUndefined();
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'boom'],
  ])(
    'a function that throws %s is a failed item, not a crash of the check for the answer',
    async (_name, thrown) => {
      const resultCallback = jest.fn();
      const func = async (): Promise<unknown> => {
        throw thrown;
      };

      await getResult(resultCallback, 'Error deleting the widget', func, {
        state,
      });
      const error: FrodoError = await getResult(
        undefined,
        'Error deleting the widget',
        func,
        { state }
      ).then(
        () => {
          throw new Error('expected getResult to throw, but it returned');
        },
        (e) => e
      );

      expect(resultCallback).toHaveBeenCalledTimes(1);
      const [reported] = resultCallback.mock.calls[0] as [FrodoError];
      expect(reported).toBeInstanceOf(FrodoError);
      expect(reported.message).toBe('Error deleting the widget');
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error deleting the widget');
      expect(skipLines()).toEqual([]);
    }
  );
});

describe('findFailedRequest()', () => {
  test('finds the request of a raw AxiosError', () => {
    expect(findFailedRequest(notAvailable())).toBe(`GET ${URL}`);
  });

  test.each([
    ['delete', 'DELETE'],
    ['PATCH', 'PATCH'],
    ['put', 'PUT'],
  ])('writes the method %s in capitals: %s', (method, expected) => {
    expect(findFailedRequest(notAvailable({ method }))).toBe(
      `${expected} ${URL}`
    );
  });

  test('takes GET when the config names no method', () => {
    const error = axiosAnswer(403, null);
    error.config = { url: URL } as AxiosError['config'];

    expect(findFailedRequest(error)).toBe(`GET ${URL}`);
  });

  test('finds the request of the AxiosError that a FrodoError wraps, at any depth and among several causes', () => {
    const cause = notAvailable({ method: 'patch' });

    expect(
      findFailedRequest(new FrodoError('Error reading the widget', cause))
    ).toBe(`PATCH ${URL}`);
    expect(
      findFailedRequest(
        new FrodoError('layer 2', new FrodoError('layer 1', cause))
      )
    ).toBe(`PATCH ${URL}`);
    expect(
      findFailedRequest(
        new FrodoError('several causes', [
          new Error('the first cause names no request'),
          new FrodoError('nor does the second', new Error('no request')),
          cause,
        ])
      )
    ).toBe(`PATCH ${URL}`);
  });

  test.each([
    ['an AxiosError without a config', new AxiosError('boom')],
    [
      'an AxiosError whose config has no url',
      Object.assign(new AxiosError('boom'), { config: { method: 'get' } }),
    ],
    ['an error without a request', new Error('boom')],
    ['a FrodoError without a cause', new FrodoError('boom')],
    ['undefined', undefined],
    ['null', null],
    ['a string', 'boom'],
  ])('finds no request in %s', (_name, error) => {
    expect(findFailedRequest(error)).toBeUndefined();
  });
});
