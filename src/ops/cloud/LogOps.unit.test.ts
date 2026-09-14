import { jest } from '@jest/globals';

const fetch = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
  resultCount: 0,
  pagedResultsCookie: null,
  totalPagedResultsPolicy: 'NONE',
  totalPagedResults: -1,
  remainingPagedResults: -1,
}));

const tailMock = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
  resultCount: 0,
  pagedResultsCookie: null,
  totalPagedResultsPolicy: 'NONE',
  totalPagedResults: -1,
  remainingPagedResults: -1,
}));

jest.unstable_mockModule('../../api/cloud/LogApi', () => ({
  createLogApiKey: jest.fn(),
  deleteLogApiKey: jest.fn(),
  fetch,
  getLogApiKey: jest.fn(),
  getLogApiKeys: jest.fn(),
  getSources: jest.fn(),
  isLogApiKeyValid: jest.fn(),
  tail: tailMock,
}));

const { searchEvents, createLogTailStream } = await import('./LogOps');

function mockState() {
  return {} as any;
}

function event(transactionId: string, extra: Record<string, unknown> = {}) {
  return {
    payload: { transactionId, ...extra },
    timestamp: '2026-08-16T00:00:00Z',
    type: 'application/json',
    source: 'am-authentication',
  };
}

describe('searchEvents', () => {
  beforeEach(() => {
    fetch.mockReset();
    fetch.mockResolvedValue({
      result: [],
      resultCount: 0,
      pagedResultsCookie: null,
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });
  });

  test('builds an OR-joined, parenthesized filter for multiple event names, AND-joined with a principal filter', async () => {
    fetch.mockResolvedValue({
      result: [],
      resultCount: 0,
      pagedResultsCookie: null,
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    await searchEvents({
      source: 'am-authentication',
      startTs: '2026-08-15T00:00:00Z',
      endTs: '2026-08-16T00:00:00Z',
      eventNames: ['AM-TREE-LOGIN-COMPLETED', 'AM-CONFIG-CHANGE'],
      principal: 'o=alpha',
      state: mockState(),
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        filter:
          '(/payload/eventName eq "AM-TREE-LOGIN-COMPLETED" or /payload/eventName eq "AM-CONFIG-CHANGE") and /payload/userId co "o=alpha"',
      })
    );
  });

  test('does not parenthesize a single event name', async () => {
    await searchEvents({
      source: 'am-authentication',
      startTs: '2026-08-15T00:00:00Z',
      endTs: '2026-08-16T00:00:00Z',
      eventNames: ['AM-TREE-LOGIN-COMPLETED'],
      state: mockState(),
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: '/payload/eventName eq "AM-TREE-LOGIN-COMPLETED"',
      })
    );
  });

  test('rejects an eventName or principal containing a double quote rather than risk filter injection', async () => {
    await expect(
      searchEvents({
        source: 'am-authentication',
        startTs: '2026-08-15T00:00:00Z',
        endTs: '2026-08-16T00:00:00Z',
        principal: '") or (/payload/eventName pr',
        state: mockState(),
      })
    ).rejects.toThrow(/double-quote/);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('auto-paginates until the cookie is exhausted', async () => {
    fetch
      .mockResolvedValueOnce({
        result: [event('tx-1')],
        resultCount: 1,
        pagedResultsCookie: 'cookie-1',
        totalPagedResultsPolicy: 'NONE',
        totalPagedResults: -1,
        remainingPagedResults: -1,
      })
      .mockResolvedValueOnce({
        result: [event('tx-2')],
        resultCount: 1,
        pagedResultsCookie: null,
        totalPagedResultsPolicy: 'NONE',
        totalPagedResults: -1,
        remainingPagedResults: -1,
      });

    const result = await searchEvents({
      source: 'am-authentication',
      startTs: '2026-08-15T00:00:00Z',
      endTs: '2026-08-16T00:00:00Z',
      state: mockState(),
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  test('stops once maxEvents is reached even if a cookie remains', async () => {
    fetch.mockResolvedValue({
      result: [event('tx-1'), event('tx-2')],
      resultCount: 2,
      pagedResultsCookie: 'cookie-1',
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    await searchEvents({
      source: 'am-authentication',
      startTs: '2026-08-15T00:00:00Z',
      endTs: '2026-08-16T00:00:00Z',
      maxEvents: 2,
      dedupeByTransactionId: false,
      state: mockState(),
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('dedupes by transaction id, keeping the last event seen (the actual outcome of a retry)', async () => {
    fetch.mockResolvedValue({
      result: [
        event('tx-1', { result: 'FAILED' }),
        event('tx-1', { result: 'SUCCESSFUL' }),
        event('tx-2', { result: 'SUCCESSFUL' }),
      ],
      resultCount: 3,
      pagedResultsCookie: null,
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    const result = await searchEvents({
      source: 'am-authentication',
      startTs: '2026-08-15T00:00:00Z',
      endTs: '2026-08-16T00:00:00Z',
      state: mockState(),
    });

    expect(result).toHaveLength(2);
    const tx1 = result.find(
      (e: any) => e.payload.transactionId === 'tx-1'
    ) as any;
    expect(tx1.payload.result).toBe('SUCCESSFUL');
  });

  test('does not dedupe when dedupeByTransactionId is false', async () => {
    fetch.mockResolvedValue({
      result: [event('tx-1'), event('tx-1')],
      resultCount: 2,
      pagedResultsCookie: null,
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    const result = await searchEvents({
      source: 'am-authentication',
      startTs: '2026-08-15T00:00:00Z',
      endTs: '2026-08-16T00:00:00Z',
      dedupeByTransactionId: false,
      state: mockState(),
    });

    expect(result).toHaveLength(2);
  });

  test('keeps events with no transaction id (e.g. debug-source raw log lines) rather than collapsing them together', async () => {
    fetch.mockResolvedValue({
      result: [
        { payload: 'raw debug line 1', timestamp: 't', type: 'text/plain', source: 'am-core' },
        { payload: 'raw debug line 2', timestamp: 't', type: 'text/plain', source: 'am-core' },
      ],
      resultCount: 2,
      pagedResultsCookie: null,
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    const result = await searchEvents({
      source: 'am-core',
      startTs: '2026-08-15T00:00:00Z',
      endTs: '2026-08-16T00:00:00Z',
      state: mockState(),
    });

    expect(result).toHaveLength(2);
  });

  test('chunks a window wider than ~24h into consecutive sub-24h calls — verified live the Log API 400s past that regardless of source or filter', async () => {
    await searchEvents({
      source: 'am-authentication',
      startTs: '2026-08-14T00:00:00.000Z',
      endTs: '2026-08-16T18:00:00.000Z',
      state: mockState(),
    });

    // ~66.5h / 24h chunks = 3 calls: [Aug14 00:00, Aug15 00:00), [Aug15 00:00, Aug16 00:00), [Aug16 00:00, Aug16 18:00]
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        startTs: '2026-08-14T00:00:00.000Z',
        endTs: '2026-08-15T00:00:00.000Z',
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        startTs: '2026-08-15T00:00:00.000Z',
        endTs: '2026-08-16T00:00:00.000Z',
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        startTs: '2026-08-16T00:00:00.000Z',
        endTs: '2026-08-16T18:00:00.000Z',
      })
    );
  });

  test('does not chunk a window at or under ~24h — a single call, matching what was actually verified live', async () => {
    await searchEvents({
      source: 'am-authentication',
      startTs: '2026-08-15T17:19:20.000Z',
      endTs: '2026-08-16T17:19:20.000Z',
      state: mockState(),
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('stops chunking early once maxEvents is reached mid-sequence, without fetching remaining chunks', async () => {
    fetch.mockResolvedValue({
      result: [event('tx-1'), event('tx-2')],
      resultCount: 2,
      pagedResultsCookie: null,
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    await searchEvents({
      source: 'am-authentication',
      startTs: '2026-08-14T00:00:00.000Z',
      endTs: '2026-08-16T18:00:00.000Z',
      maxEvents: 2,
      dedupeByTransactionId: false,
      state: mockState(),
    });

    // Would be 3 calls across the full range if not for maxEvents cutting it short after the first chunk.
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('createLogTailStream', () => {
  beforeEach(() => {
    tailMock.mockReset();
  });

  function tailEvent(timestamp: string, payload: unknown) {
    return {
      payload,
      timestamp,
      type: 'application/json',
      source: 'am-authentication',
    };
  }

  test('threads the cookie returned from each poll into the next', async () => {
    tailMock
      .mockResolvedValueOnce({
        result: [],
        resultCount: 0,
        pagedResultsCookie: 'cookie-1',
        totalPagedResultsPolicy: 'NONE',
        totalPagedResults: -1,
        remainingPagedResults: -1,
      })
      .mockResolvedValueOnce({
        result: [],
        resultCount: 0,
        pagedResultsCookie: 'cookie-2',
        totalPagedResultsPolicy: 'NONE',
        totalPagedResults: -1,
        remainingPagedResults: -1,
      });

    const stream = createLogTailStream({
      source: 'am-authentication',
      state: mockState(),
    });
    await stream.poll();
    await stream.poll();

    expect(tailMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ cookie: undefined })
    );
    expect(tailMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cookie: 'cookie-1' })
    );
  });

  // Regression test: PingOne AIC's own tail-endpoint docs say each
  // subsequent call's range "starts from the last returned log entry in
  // the previous result (inclusive)" -- the boundary event is documented
  // to repeat by design.
  test("the documented boundary overlap -- the previous poll's last event repeating as the next poll's first -- is filtered out", async () => {
    const a = tailEvent('t1', { transactionId: 'tx-a' });
    const b = tailEvent('t2', { transactionId: 'tx-b' });
    const c = tailEvent('t3', { transactionId: 'tx-c' });

    tailMock
      .mockResolvedValueOnce({
        result: [a, b],
        resultCount: 2,
        pagedResultsCookie: 'cookie-1',
        totalPagedResultsPolicy: 'NONE',
        totalPagedResults: -1,
        remainingPagedResults: -1,
      })
      .mockResolvedValueOnce({
        result: [b, c],
        resultCount: 2,
        pagedResultsCookie: 'cookie-2',
        totalPagedResultsPolicy: 'NONE',
        totalPagedResults: -1,
        remainingPagedResults: -1,
      });

    const stream = createLogTailStream({
      source: 'am-authentication',
      state: mockState(),
    });
    const first = await stream.poll();
    const second = await stream.poll();

    expect(first).toEqual([a, b]);
    expect(second).toEqual([c]);
  });

  // Regression test: confirmed live against `volker-dev` that tail() can
  // redeliver the exact same event twice within a single poll's own
  // result array, not just across a cookie boundary.
  test("a redelivered event within a single poll's own result array is also caught", async () => {
    const a = tailEvent('t1', { transactionId: 'tx-a' });
    tailMock.mockResolvedValueOnce({
      result: [a, a],
      resultCount: 2,
      pagedResultsCookie: 'cookie-1',
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    const stream = createLogTailStream({
      source: 'am-authentication',
      state: mockState(),
    });
    const result = await stream.poll();

    expect(result).toHaveLength(1);
  });

  test('two events with identical payload content but different timestamps are never wrongly deduped', async () => {
    const a1 = tailEvent('t1', { transactionId: 'tx-a' });
    const a2 = tailEvent('t2', { transactionId: 'tx-a' });
    tailMock.mockResolvedValueOnce({
      result: [a1, a2],
      resultCount: 2,
      pagedResultsCookie: 'cookie-1',
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    const stream = createLogTailStream({
      source: 'am-authentication',
      state: mockState(),
    });
    const result = await stream.poll();

    expect(result).toHaveLength(2);
  });

  test('an event with no timestamp is never treated as a duplicate (no false-positive drops)', async () => {
    const noTimestamp = {
      payload: { transactionId: 'tx-a' },
      type: 'application/json',
      source: 'am-authentication',
    };
    tailMock.mockResolvedValueOnce({
      result: [noTimestamp, noTimestamp],
      resultCount: 2,
      pagedResultsCookie: 'cookie-1',
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    const stream = createLogTailStream({
      source: 'am-authentication',
      state: mockState(),
    });
    const result = await stream.poll();

    expect(result).toHaveLength(2);
  });

  test('a string (debug-source) payload participates in the dedup key too', async () => {
    const line1 = {
      payload: 'raw debug line',
      timestamp: 't1',
      type: 'text/plain',
      source: 'am-core',
    };
    const line2 = {
      payload: 'raw debug line',
      timestamp: 't1',
      type: 'text/plain',
      source: 'am-core',
    };
    tailMock.mockResolvedValueOnce({
      result: [line1, line2],
      resultCount: 2,
      pagedResultsCookie: 'cookie-1',
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    const stream = createLogTailStream({
      source: 'am-core',
      state: mockState(),
    });
    const result = await stream.poll();

    expect(result).toHaveLength(1);
  });
});
