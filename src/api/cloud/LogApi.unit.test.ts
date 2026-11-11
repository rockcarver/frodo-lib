/**
 * Run tests
 *
 *        npm run test:only LogApi.unit
 *
 * The Log API layer (frodo-lib#1034): `tail` and `fetch` return the rate limit
 * state that the answer reported, next to the page of events.
 *
 * Unit test, no network and no recordings: an axios adapter answers the
 * requests of the real `generateLogApi` instance, so the headers arrive the way
 * axios hands them out. Hosts and credentials are made up.
 */
import axios from 'axios';
import StateImpl from '../../shared/State';
import { stubAdapter, type StubAnswer } from '../../test/utils/StubAdapter';
import { fetch, tail } from './LogApi';

// 2026-01-01T00:00:00Z
const NOW = Date.UTC(2026, 0, 1);

const page = {
  result: [
    {
      payload: 'sample payload',
      timestamp: '2026-01-01T00:00:00Z',
      type: 'text/plain',
      source: 'am-core',
    },
  ],
  resultCount: 1,
  pagedResultsCookie: 'sample-cookie',
  totalPagedResultsPolicy: 'NONE',
  totalPagedResults: -1,
  remainingPagedResults: -1,
};

function rateLimitHeaders(limit: number, remaining: number, seconds: number) {
  return {
    'x-ratelimit-limit': String(limit),
    'x-ratelimit-remaining': String(remaining),
    'x-ratelimit-reset': String(NOW / 1000 + seconds),
  };
}

const state = StateImpl({
  host: 'https://openam-matrix.example.com/am',
  logApiKey: 'sample-key',
  logApiSecret: 'sample-secret',
});

const originalAdapter = axios.defaults.adapter;

/** Answer the requests of the instances that are created from now on. */
function answer(...answers: StubAnswer[]) {
  const stub = stubAdapter(answers);
  axios.defaults.adapter = stub.adapter;
  return stub.requests;
}

afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});

const calls = {
  tail: () => tail({ source: 'am-everything', cookie: undefined, state }),
  fetch: () =>
    fetch({
      source: 'am-everything',
      startTs: '2026-01-01T00:00:00Z',
      endTs: '2026-01-01T01:00:00Z',
      cookie: undefined,
      txid: undefined,
      filter: undefined,
      state,
    }),
};

describe.each(Object.entries(calls))('%s', (_name, call) => {
  test.each([
    [60, 59, 41],
    [28, 27, 60],
  ])(
    'returns the page with the rate limit of the answer: limit %d, remaining %d, reset in %d seconds',
    async (limit, remaining, seconds) => {
      answer({
        data: page,
        headers: rateLimitHeaders(limit, remaining, seconds),
      });
      const result = await call();
      expect(result).toEqual({
        ...page,
        rateLimit: { limit, remaining, resetAt: NOW + seconds * 1000 },
      });
    }
  );

  test('returns the page as it is, without a rateLimit, when the answer has no rate limit headers', async () => {
    answer({ data: page });
    const result = await call();
    expect(result).toEqual(page);
    expect(result).not.toHaveProperty('rateLimit');
  });

  test('returns the page without a rateLimit when a header is missing', async () => {
    const { 'x-ratelimit-reset': _reset, ...partial } = rateLimitHeaders(
      60,
      59,
      41
    );
    answer({ data: page, headers: partial });
    expect(await call()).not.toHaveProperty('rateLimit');
  });

  test('does not fail on an answer without a body', async () => {
    answer({ data: '', headers: rateLimitHeaders(60, 59, 41) });
    await expect(call()).resolves.toBe('');
  });
});
