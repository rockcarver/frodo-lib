/**
 * Run tests
 *
 *        npm run test:only LogOps.rateLimit.unit
 *
 * The rate limit of the Log API in the ops layer (frodo-lib#1034): what
 * `tail()`, `fetch()` and the tail stream hand to the caller.
 *
 * Unit test: the API layer is replaced, there are no recordings and no network.
 */
import { jest } from '@jest/globals';
import StateImpl from '../../shared/State';
import { failedRequest } from '../../test/utils/ErrorWrapping';
import { FrodoError } from '../FrodoError';

const actualLogApi = await import('../../api/cloud/LogApi');
const logApi = {
  fetch: jest.fn<(...args: any[]) => Promise<any>>(),
  getSources: jest.fn<(...args: any[]) => Promise<any>>(),
  tail: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../../api/cloud/LogApi', () => ({
  ...actualLogApi,
  ...logApi,
}));

const ops = await import('./LogOps');

const state = StateImpl({});
state.setRealm('alpha');

// 2026-01-01T00:00:00Z
const NOW = Date.UTC(2026, 0, 1);

function page(extra: Record<string, unknown> = {}, cookie = 'cookie') {
  return {
    result: [],
    resultCount: 0,
    pagedResultsCookie: cookie,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
    ...extra,
  };
}

beforeEach(() => {
  logApi.fetch.mockReset();
  logApi.getSources.mockReset();
  logApi.tail.mockReset();
});

describe('tail() and fetch() hand over the rate limit of the answer', () => {
  const rateLimit = { limit: 28, remaining: 20, resetAt: NOW + 12_000 };

  test('tail', async () => {
    logApi.tail.mockResolvedValue(page({ rateLimit }));
    const result = await ops.tail({
      source: 'am-everything',
      cookie: undefined,
      state,
    });
    expect(result.rateLimit).toEqual(rateLimit);
  });

  test('fetch', async () => {
    logApi.fetch.mockResolvedValue(page({ rateLimit }));
    const result = await ops.fetch({
      source: 'am-everything',
      startTs: '2026-01-01T00:00:00Z',
      endTs: '2026-01-01T01:00:00Z',
      cookie: undefined,
      txid: undefined,
      filter: undefined,
      state,
    });
    expect(result.rateLimit).toEqual(rateLimit);
  });
});

describe('createLogTailStream().rateLimit', () => {
  test('is undefined before the first poll', () => {
    const stream = ops.createLogTailStream({ source: 'am-everything', state });
    expect(stream.rateLimit).toBeUndefined();
  });

  test('is the rate limit of the answer to the latest poll', async () => {
    const first = { limit: 60, remaining: 59, resetAt: NOW + 59_000 };
    const second = { limit: 60, remaining: 58, resetAt: NOW + 59_000 };
    logApi.tail
      .mockResolvedValueOnce(page({ rateLimit: first }, 'cookie-1'))
      .mockResolvedValueOnce(page({ rateLimit: second }, 'cookie-2'));
    const stream = ops.createLogTailStream({ source: 'am-everything', state });

    await stream.poll();
    expect(stream.rateLimit).toEqual(first);
    await stream.poll();
    expect(stream.rateLimit).toEqual(second);
  });

  test('is undefined again when the latest answer carries no rate limit headers', async () => {
    logApi.tail
      .mockResolvedValueOnce(
        page({ rateLimit: { limit: 28, remaining: 5, resetAt: NOW } })
      )
      .mockResolvedValueOnce(page());
    const stream = ops.createLogTailStream({ source: 'am-everything', state });

    await stream.poll();
    expect(stream.rateLimit).toBeDefined();
    await stream.poll();
    expect(stream.rateLimit).toBeUndefined();
  });

  test('cannot be assigned from outside', async () => {
    const stream = ops.createLogTailStream({ source: 'am-everything', state });
    expect(() => {
      (stream as { rateLimit: unknown }).rateLimit = { limit: 1 };
    }).toThrow(TypeError);
  });
});

describe('a request that the Log API rejected with 429', () => {
  const calls = [
    {
      name: 'tail',
      message: 'Error tailing logs',
      api: logApi.tail,
      call: () =>
        ops.tail({ source: 'am-everything', cookie: undefined, state }),
    },
    {
      name: 'fetch',
      message: 'Error fetching logs',
      api: logApi.fetch,
      call: () =>
        ops.fetch({
          source: 'am-everything',
          startTs: '2026-01-01T00:00:00Z',
          endTs: '2026-01-01T01:00:00Z',
          cookie: undefined,
          txid: undefined,
          filter: undefined,
          state,
        }),
    },
    {
      name: 'getLogSources',
      message: 'Error getting log sources',
      api: logApi.getSources,
      call: () => ops.getLogSources({ state }),
    },
    {
      name: 'searchEvents',
      message: 'Error searching events',
      api: logApi.fetch,
      call: () =>
        ops.searchEvents({
          source: 'am-authentication',
          startTs: '2026-01-01T00:00:00Z',
          endTs: '2026-01-01T01:00:00Z',
          state,
        }),
    },
  ];

  const caught = async (call: () => Promise<unknown>) =>
    (await call().then(
      () => undefined,
      (error: unknown) => error
    )) as FrodoError;

  describe.each(calls)('$name', ({ message, api, call }) => {
    test.each([
      [60, 0, 41],
      [28, 3, 7],
    ])(
      'is a FrodoError with the code and the state of the limit (limit %d, remaining %d, reset in %d seconds)',
      async (limit, remaining, seconds) => {
        const cause = failedRequest(429, {
          'x-ratelimit-limit': String(limit),
          'x-ratelimit-remaining': String(remaining),
          'x-ratelimit-reset': String(NOW / 1000 + seconds),
        });
        api.mockRejectedValue(cause);

        const error = await caught(call);

        expect(error).toBeInstanceOf(FrodoError);
        expect(error.code).toBe('LOG_API_RATE_LIMITED');
        expect(error.rateLimit).toEqual({
          limit,
          remaining,
          resetAt: NOW + seconds * 1000,
        });
        expect(error.message).toBe(
          `${message}: the rate limit of the Log API is exceeded, it resets at ${new Date(NOW + seconds * 1000).toISOString()}`
        );
        expect(error.originalErrors).toEqual([cause]);
        expect(error.isHttpError).toBe(true);
        expect(error.httpStatus).toBe(429);
      }
    );

    test('still has the code when the answer carries no rate limit headers', async () => {
      const cause = failedRequest(429);
      api.mockRejectedValue(cause);

      const error = await caught(call);

      expect(error.code).toBe('LOG_API_RATE_LIMITED');
      expect(error.rateLimit).toBeUndefined();
      expect(error.message).toBe(
        `${message}: the rate limit of the Log API is exceeded`
      );
      expect(error.originalErrors).toEqual([cause]);
    });

    test('still has the code when only some of the headers are there', async () => {
      api.mockRejectedValue(failedRequest(429, { 'retry-after': '12' }));

      const error = await caught(call);

      expect(error.code).toBe('LOG_API_RATE_LIMITED');
      expect(error.rateLimit).toBeUndefined();
    });

    test.each([400, 401, 403, 500, 503])(
      'is not coded for a %d, even with rate limit headers',
      async (status) => {
        api.mockRejectedValue(
          failedRequest(status, {
            'x-ratelimit-limit': '28',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(NOW / 1000 + 5),
          })
        );

        const error = await caught(call);

        expect(error).toBeInstanceOf(FrodoError);
        expect(error.code).toBeUndefined();
        expect(error.rateLimit).toBeUndefined();
        expect(error.message).toBe(message);
      }
    );

    test('is not coded for a failure that is no HTTP answer', async () => {
      api.mockRejectedValue(new Error('socket hang up'));

      const error = await caught(call);

      expect(error.code).toBeUndefined();
      expect(error.message).toBe(message);
    });
  });

  test('a FrodoError that wraps the 429 is coded too', async () => {
    const cause = failedRequest(429, {
      'x-ratelimit-limit': '28',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(NOW / 1000 + 5),
    });
    logApi.tail.mockRejectedValue(new FrodoError('inner', cause));

    const error = await caught(() =>
      ops.tail({ source: 'am-everything', cookie: undefined, state })
    );

    expect(error.code).toBe('LOG_API_RATE_LIMITED');
    expect(error.rateLimit?.resetAt).toBe(NOW + 5000);
  });

  describe('in a tail stream', () => {
    const limited = (seconds: number) =>
      failedRequest(429, {
        'x-ratelimit-limit': '28',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(NOW / 1000 + seconds),
      });

    test('poll() rejects with the coded error and the stream reports the state of that answer', async () => {
      logApi.tail
        .mockResolvedValueOnce(
          page({ rateLimit: { limit: 28, remaining: 4, resetAt: NOW + 9000 } })
        )
        .mockRejectedValueOnce(limited(30));
      const stream = ops.createLogTailStream({
        source: 'am-everything',
        state,
      });
      await stream.poll();

      const error = await caught(() => stream.poll());

      expect(error.code).toBe('LOG_API_RATE_LIMITED');
      expect(stream.rateLimit).toEqual({
        limit: 28,
        remaining: 0,
        resetAt: NOW + 30_000,
      });
    });

    test('a poll that fails otherwise leaves the state of the latest answer', async () => {
      const first = { limit: 28, remaining: 4, resetAt: NOW + 9000 };
      logApi.tail
        .mockResolvedValueOnce(page({ rateLimit: first }))
        .mockRejectedValueOnce(failedRequest(500));
      const stream = ops.createLogTailStream({
        source: 'am-everything',
        state,
      });
      await stream.poll();

      await expect(stream.poll()).rejects.toBeInstanceOf(FrodoError);
      expect(stream.rateLimit).toEqual(first);
    });

    test('the cookie is not advanced by a rejected poll', async () => {
      logApi.tail
        .mockResolvedValueOnce(page({}, 'cookie-1'))
        .mockRejectedValueOnce(limited(5))
        .mockResolvedValueOnce(page({}, 'cookie-2'));
      const stream = ops.createLogTailStream({
        source: 'am-everything',
        state,
      });
      await stream.poll();
      await caught(() => stream.poll());
      await stream.poll();

      expect(logApi.tail).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ cookie: 'cookie-1' })
      );
      expect(logApi.tail).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ cookie: 'cookie-1' })
      );
    });
  });
});
