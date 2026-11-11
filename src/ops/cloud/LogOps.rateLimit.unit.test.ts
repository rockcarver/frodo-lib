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

const actualLogApi = await import('../../api/cloud/LogApi');
const logApi = {
  fetch: jest.fn<(...args: any[]) => Promise<any>>(),
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
