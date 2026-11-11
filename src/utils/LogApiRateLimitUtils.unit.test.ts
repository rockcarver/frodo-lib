/**
 * Run tests
 *
 *        npm run test:only LogApiRateLimitUtils.unit
 *
 * What the library reads out of the rate limit headers of the Log API
 * (frodo-lib#1034): the state of an answer, with limits of 60 and 28 as
 * recorded answers carry both, and no crash on headers that are absent,
 * partial or garbled.
 *
 * Unit test: no network, no recordings.
 */
import { AxiosHeaders } from 'axios';
import {
  getRateLimitWaitMs,
  getSearchSpacingMs,
  parseLogApiRateLimit,
  type LogApiRateLimit,
} from './LogApiRateLimitUtils';

// 2026-01-01T00:00:00Z
const NOW = Date.UTC(2026, 0, 1);

/** The headers of an answer whose window resets `seconds` after `NOW`. */
function headers(limit: number, remaining: number, seconds: number) {
  return {
    'x-ratelimit-limit': String(limit),
    'x-ratelimit-remaining': String(remaining),
    'x-ratelimit-reset': String(NOW / 1000 + seconds),
  };
}

describe('parseLogApiRateLimit', () => {
  test.each([
    [60, 59, 41],
    [28, 28, 60],
    [28, 0, 3],
  ])(
    'reads limit %d, remaining %d and a reset %d seconds away',
    (limit, remaining, seconds) => {
      expect(
        parseLogApiRateLimit(headers(limit, remaining, seconds), NOW)
      ).toEqual({
        limit,
        remaining,
        resetAt: NOW + seconds * 1000,
      });
    }
  );

  test('reads the headers of an AxiosHeaders instance, in any case', () => {
    const axiosHeaders = new AxiosHeaders({
      'X-RateLimit-Limit': '28',
      'X-RateLimit-Remaining': '27',
      'X-RateLimit-Reset': String(NOW / 1000 + 10),
    });
    expect(parseLogApiRateLimit(axiosHeaders, NOW)).toEqual({
      limit: 28,
      remaining: 27,
      resetAt: NOW + 10_000,
    });
  });

  test('reads the headers of a plain object with capitalised names', () => {
    expect(
      parseLogApiRateLimit(
        {
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '1',
          'X-RateLimit-Reset': String(NOW / 1000 + 5),
        },
        NOW
      )
    ).toEqual({ limit: 60, remaining: 1, resetAt: NOW + 5000 });
  });

  test('takes the first value of a header that arrives as an array', () => {
    expect(
      parseLogApiRateLimit(
        {
          'x-ratelimit-limit': ['28', '28'],
          'x-ratelimit-remaining': ['3'],
          'x-ratelimit-reset': [String(NOW / 1000 + 5)],
        },
        NOW
      )
    ).toEqual({ limit: 28, remaining: 3, resetAt: NOW + 5000 });
  });

  test.each([
    ['no headers', undefined],
    ['null headers', null],
    ['empty headers', {}],
    ['a string instead of headers', 'x-ratelimit-limit: 60'],
    [
      'no limit',
      {
        'x-ratelimit-remaining': '1',
        'x-ratelimit-reset': String(NOW / 1000),
      },
    ],
    [
      'no remaining',
      { 'x-ratelimit-limit': '60', 'x-ratelimit-reset': String(NOW / 1000) },
    ],
    ['no reset', { 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '1' }],
    [
      'a limit that is not a number',
      { ...headers(60, 1, 5), 'x-ratelimit-limit': 'many' },
    ],
    [
      'a negative remaining',
      { ...headers(60, 1, 5), 'x-ratelimit-remaining': '-1' },
    ],
    ['an empty reset', { ...headers(60, 1, 5), 'x-ratelimit-reset': ' ' }],
    [
      'a reset beyond the range of a date',
      { ...headers(60, 1, 5), 'x-ratelimit-reset': '1e30' },
    ],
  ])('is undefined, and does not throw, for %s', (_name, input) => {
    expect(() => parseLogApiRateLimit(input, NOW)).not.toThrow();
    expect(parseLogApiRateLimit(input, NOW)).toBeUndefined();
  });

  describe('a reset on the clock of the server', () => {
    const serverDate = (offsetMs: number) =>
      new Date(NOW + offsetMs).toUTCString();

    test('is taken as it is when the clock of the machine is close to the one of the server', () => {
      // the Date header has a resolution of one second, and the answer takes a moment
      expect(
        parseLogApiRateLimit(
          { ...headers(60, 59, 30), date: serverDate(-900) },
          NOW
        )?.resetAt
      ).toBe(NOW + 30_000);
    });

    test('is moved onto the clock of the machine when the machine is behind the server', () => {
      // the server says 12:05:00, this machine 12:00:00, the window resets at 12:05:30
      expect(
        parseLogApiRateLimit(
          {
            ...headers(60, 59, 5 * 60 + 30),
            date: serverDate(5 * 60 * 1000),
          },
          NOW
        )?.resetAt
      ).toBe(NOW + 30_000);
    });

    test('is moved onto the clock of the machine when the machine is ahead of the server', () => {
      // the server says 11:55:00, this machine 12:00:00, the window resets at 11:55:30
      expect(
        parseLogApiRateLimit(
          {
            ...headers(60, 59, -5 * 60 + 30),
            date: serverDate(-5 * 60 * 1000),
          },
          NOW
        )?.resetAt
      ).toBe(NOW + 30_000);
    });

    test('is taken as it is when the Date header cannot be read', () => {
      expect(
        parseLogApiRateLimit({ ...headers(60, 59, 30), date: 'yesterday' }, NOW)
          ?.resetAt
      ).toBe(NOW + 30_000);
    });
  });
});

describe('getRateLimitWaitMs', () => {
  test('is the Retry-After in seconds, plus a margin', () => {
    expect(getRateLimitWaitMs({ 'retry-after': '5' }, NOW)).toBe(6000);
    expect(getRateLimitWaitMs({ 'Retry-After': '0' }, NOW)).toBe(1000);
  });

  test('is the time to the reset, plus a margin, when there is no Retry-After', () => {
    expect(getRateLimitWaitMs(headers(28, 0, 7), NOW)).toBe(8000);
    expect(getRateLimitWaitMs(headers(60, 0, 41), NOW)).toBe(42_000);
  });

  test('prefers the Retry-After to the reset', () => {
    expect(
      getRateLimitWaitMs({ ...headers(60, 0, 41), 'retry-after': '3' }, NOW)
    ).toBe(4000);
  });

  test('needs no other rate limit header than the reset', () => {
    expect(
      getRateLimitWaitMs({ 'x-ratelimit-reset': String(NOW / 1000 + 30) }, NOW)
    ).toBe(31_000);
  });

  test('waits only the margin for a reset that has passed', () => {
    expect(getRateLimitWaitMs(headers(60, 0, -90), NOW)).toBe(1000);
  });

  test('goes by the clock of the server where the clock of the machine is off', () => {
    // this machine is five minutes behind the server, which resets the window in 12 seconds
    expect(
      getRateLimitWaitMs(
        {
          ...headers(60, 0, 5 * 60 + 12),
          date: new Date(NOW + 5 * 60 * 1000).toUTCString(),
        },
        NOW
      )
    ).toBe(13_000);
  });

  test.each([
    ['no headers', undefined],
    ['empty headers', {}],
    [
      'a Retry-After that is a date',
      { 'retry-after': 'Thu, 01 Jan 2026 00:00:10 GMT' },
    ],
    ['a negative Retry-After', { 'retry-after': '-1' }],
    ['a reset that is not a number', { 'x-ratelimit-reset': 'soon' }],
    ['a reset beyond the range of a date', { 'x-ratelimit-reset': '1e30' }],
  ])('is undefined, and does not throw, for %s', (_name, input) => {
    expect(() => getRateLimitWaitMs(input, NOW)).not.toThrow();
    expect(getRateLimitWaitMs(input, NOW)).toBeUndefined();
  });
});

describe('getSearchSpacingMs', () => {
  /** The state of an answer: `remaining` requests left, the window resets in `seconds`. */
  const state = (
    limit: number,
    remaining: number,
    seconds: number
  ): LogApiRateLimit => ({ limit, remaining, resetAt: NOW + seconds * 1000 });

  test.each([
    // limit, remaining, seconds to the reset, share, expected spacing in ms
    // half of 60: 30 stay free, the 29 requests above them are spread over the 59 seconds that are left
    [60, 59, 59, 0.5, 2035],
    // half of 28: 14 stay free, 13 requests are spread over 40 seconds
    [28, 27, 40, 0.5, 3077],
    // the limit is read from the answer: the same state with a limit of 28 and of 60 gives a different pace
    [28, 28, 28, 0.5, 2000],
    [60, 60, 60, 0.5, 2000],
    // the whole limit
    [60, 59, 59, 1, 1000],
    [28, 20, 10, 1, 500],
    // a share that does not divide the limit: 19 of 28 may be used, 9 stay free
    [28, 28, 38, 0.7, 2000],
    // 0.9 of 60 is 54 and not 53.99999: 6 stay free, not 7
    [60, 60, 54, 0.9, 1000],
    // a window that has run out: a limit of 1 leaves nothing to keep free
    [1, 1, 30, 0.5, 30_000],
    // the window is over already, there is no time left to spread the requests over
    [60, 50, -5, 0.5, 0],
  ])(
    'limit %d, remaining %d, reset in %d seconds, share %d: %d ms',
    (limit, remaining, seconds, share, expected) => {
      expect(
        getSearchSpacingMs(state(limit, remaining, seconds), share, NOW)
      ).toBe(expected);
    }
  );

  test.each([
    // limit, remaining, seconds to the reset, share, expected wait in ms
    // only the kept-back half is left: wait for the window to reset, plus a margin
    [60, 30, 2, 0.5, 3000],
    [28, 14, 25, 0.5, 26_000],
    // below the kept-back part: other readers have spent the budget
    [60, 10, 20, 0.5, 21_000],
    [28, 0, 7, 0.5, 8000],
    [60, 0, 7, 1, 8000],
  ])(
    'waits for the window to reset when the part that is kept free is all that is left: limit %d, remaining %d, reset in %d seconds, share %d: %d ms',
    (limit, remaining, seconds, share, expected) => {
      expect(
        getSearchSpacingMs(state(limit, remaining, seconds), share, NOW)
      ).toBe(expected);
    }
  );

  test('waits one second when the answer carried no rate limit state', () => {
    expect(getSearchSpacingMs(undefined, 0.5, NOW)).toBe(1000);
    expect(getSearchSpacingMs(undefined, 1, NOW)).toBe(1000);
  });

  test('slows down when another reader spends the budget of the window', () => {
    const alone = getSearchSpacingMs(state(60, 59, 50), 0.5, NOW);
    const shared = getSearchSpacingMs(state(60, 40, 50), 0.5, NOW);
    const crowded = getSearchSpacingMs(state(60, 32, 50), 0.5, NOW);
    expect(alone).toBeLessThan(shared);
    expect(shared).toBeLessThan(crowded);
  });

  test.each([
    [60, 0.5],
    [28, 0.5],
    [60, 1],
    [28, 0.3],
  ])(
    'a search on its own uses at most the share of every window and does not stall: limit %d, share %d',
    (limit, share) => {
      // the server: windows of one minute that start at 0, and a clock that the search follows
      const windowMs = 60_000;
      let clock = 0;
      let windowEnd = windowMs;
      let remaining = limit;
      const perWindow: number[] = [];
      let used = 0;
      const request = () => {
        if (clock >= windowEnd) {
          perWindow.push(used);
          used = 0;
          windowEnd += windowMs;
          remaining = limit;
        }
        remaining -= 1;
        used += 1;
        return { limit, remaining, resetAt: windowEnd };
      };
      const windows = 5;
      let rateLimit = request();
      while (perWindow.length < windows) {
        clock += getSearchSpacingMs(rateLimit, share, clock);
        rateLimit = request();
      }
      const allowed = Math.floor(limit * share + 1e-9);
      for (const count of perWindow) {
        expect(count).toBeLessThanOrEqual(allowed);
        // it keeps going: a window is used up to the share, give or take the request at the border
        expect(count).toBeGreaterThanOrEqual(allowed - 1);
      }
    }
  );
});
