/**
 * Run tests
 *
 *        npm run test:only BaseApi.logRateLimit.unit
 *
 * What the Log API instance does with a request that was rejected with 429
 * (frodo-lib#1034): it waits for the end of the window and sends the request
 * once more, going by `Retry-After` or else by `X-RateLimit-Reset`, unless the
 * caller does the waiting itself.
 *
 * Unit test, no network and no recordings: an axios adapter answers the
 * requests, and fake timers stand for the wait. Hosts and credentials are made
 * up.
 */
import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  settled,
  stubAdapter,
  type StubAnswer,
} from '../test/utils/StubAdapter';
import { generateLogApi } from './BaseApi';

// 2026-01-01T00:00:00Z
const NOW = Date.UTC(2026, 0, 1);
const URL = 'https://openam-matrix.example.com/monitoring/logs?source=am-core';

const state = StateImpl({
  host: 'https://openam-matrix.example.com/am',
  logApiKey: 'sample-key',
  logApiSecret: 'sample-secret',
});

const limited = (headers: Record<string, string> = {}): StubAnswer => ({
  status: 429,
  headers,
  data: { code: 429, message: 'rate limit exceeded' },
});
const ok: StubAnswer = { status: 200, data: { result: [] } };

/** Seconds since 1970 that are `seconds` after `NOW`. */
const resetIn = (seconds: number) => String(NOW / 1000 + seconds);

function logApi(answers: StubAnswer[], waitOnRateLimit?: boolean) {
  const { adapter, requests } = stubAdapter(answers);
  const api = generateLogApi({
    state,
    requestOverride: { adapter },
    ...(waitOnRateLimit !== undefined && { waitOnRateLimit }),
  });
  return { api, requests };
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'queueMicrotask'] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('a Log API request that was rejected with 429 and names a wait', () => {
  test.each([
    ['Retry-After of 5 seconds', { 'retry-after': '5' }, 6000],
    ['Retry-After of 0', { 'retry-after': '0' }, 1000],
    [
      'X-RateLimit-Reset 7 seconds away',
      {
        'x-ratelimit-limit': '28',
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': resetIn(7),
      },
      8000,
    ],
    ['X-RateLimit-Reset alone', { 'x-ratelimit-reset': resetIn(30) }, 31_000],
    [
      'an X-RateLimit-Reset that has passed',
      { 'x-ratelimit-reset': resetIn(-20) },
      1000,
    ],
    [
      'both, Retry-After first',
      { 'retry-after': '2', 'x-ratelimit-reset': resetIn(30) },
      3000,
    ],
    [
      'an X-RateLimit-Reset of a server whose clock is five minutes ahead',
      {
        'x-ratelimit-reset': resetIn(5 * 60 + 12),
        date: new Date(NOW + 5 * 60 * 1000).toUTCString(),
      },
      13_000,
    ],
  ])('is sent once more after the wait: %s', async (_name, headers, waitMs) => {
    const { api, requests } = logApi([limited(headers), ok]);

    const outcome = settled(api.get(URL));
    await jest.advanceTimersByTimeAsync(waitMs - 1);
    expect(requests).toHaveLength(1);
    expect(outcome.done).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    expect(requests).toHaveLength(2);
    expect(outcome.done).toBe(true);
    expect(outcome.error).toBeUndefined();
    expect((outcome.value as { status: number }).status).toBe(200);
  });

  test('is rejected when the second attempt is rejected with 429 as well', async () => {
    const { api, requests } = logApi([limited({ 'retry-after': '1' })]);

    const outcome = settled(api.get(URL));
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(60_000);

    expect(requests).toHaveLength(2);
    expect(outcome.done).toBe(true);
    expect(
      (outcome.error as { response: { status: number } }).response.status
    ).toBe(429);
  });
});

describe('a Log API request that was rejected with 429 and names no wait', () => {
  test.each([
    ['no headers', {}],
    [
      'a Retry-After that is a date',
      { 'retry-after': 'Thu, 01 Jan 2026 00:00:10 GMT' },
    ],
    ['a Retry-After that is not a number', { 'retry-after': 'soon' }],
    ['a negative Retry-After', { 'retry-after': '-5' }],
    [
      'an X-RateLimit-Reset that is not a number',
      { 'x-ratelimit-reset': 'tomorrow' },
    ],
    [
      'the other rate limit headers only',
      { 'x-ratelimit-limit': '28', 'x-ratelimit-remaining': '0' },
    ],
  ])('is rejected at once, with %s', async (_name, headers) => {
    const { api, requests } = logApi([limited(headers), ok]);

    const outcome = settled(api.get(URL));
    await jest.advanceTimersByTimeAsync(0);

    expect(outcome.done).toBe(true);
    expect(
      (outcome.error as { response: { status: number } }).response.status
    ).toBe(429);
    expect(requests).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe.each([400, 401, 403, 500, 503])(
  'a request rejected with %d',
  (status) => {
    test('is not sent again, whatever the headers say', async () => {
      const { api, requests } = logApi([
        {
          status,
          headers: { 'retry-after': '1', 'x-ratelimit-reset': resetIn(1) },
        },
        ok,
      ]);

      const outcome = settled(api.get(URL));
      await jest.advanceTimersByTimeAsync(10_000);

      expect(outcome.done).toBe(true);
      expect(
        (outcome.error as { response: { status: number } }).response.status
      ).toBe(status);
      expect(requests).toHaveLength(1);
    });
  }
);

describe('with waitOnRateLimit false', () => {
  test.each([
    ['Retry-After', { 'retry-after': '5' }],
    ['X-RateLimit-Reset', { 'x-ratelimit-reset': resetIn(7) }],
  ])(
    'a 429 with %s is rejected at once and not sent again',
    async (_name, headers) => {
      const { api, requests } = logApi([limited(headers), ok], false);

      const outcome = settled(api.get(URL));
      await jest.advanceTimersByTimeAsync(0);

      expect(outcome.done).toBe(true);
      expect(
        (outcome.error as { response: { status: number } }).response.status
      ).toBe(429);
      expect(requests).toHaveLength(1);
      expect(jest.getTimerCount()).toBe(0);
    }
  );

  test('the rejection still carries the headers of the answer', async () => {
    const headers = {
      'x-ratelimit-limit': '28',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': resetIn(7),
    };
    const { api } = logApi([limited(headers)], false);

    const outcome = settled(api.get(URL));
    await jest.advanceTimersByTimeAsync(0);

    const response = (
      outcome.error as { response: { headers: Record<string, string> } }
    ).response;
    expect(response.headers['x-ratelimit-reset']).toBe(resetIn(7));
  });

  test('a successful answer is returned as usual', async () => {
    const { api } = logApi([ok], false);
    const response = await api.get(URL);
    expect(response.status).toBe(200);
  });
});

describe('waitOnRateLimit defaults to true', () => {
  test('an instance that is given no option waits', async () => {
    const { api, requests } = logApi([limited({ 'retry-after': '1' }), ok]);

    const outcome = settled(api.get(URL));
    await jest.advanceTimersByTimeAsync(2000);

    expect(requests).toHaveLength(2);
    expect(outcome.done).toBe(true);
    expect(outcome.error).toBeUndefined();
  });
});
