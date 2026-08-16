import { jest } from '@jest/globals';

const fetch = jest.fn(async (_args?: any): Promise<any> => ({
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
  tail: jest.fn(),
}));

const { searchEvents } = await import('./LogOps');

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
});
