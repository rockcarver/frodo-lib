/**
 * Run tests
 *
 *        npm run test:only ToolRuntime.listCompleteness
 *
 * A list or search result that the MCP runtime cut (to its response size budget,
 * to its item ceiling, or to the page the caller asked for) says so in the first
 * fields of the result: `truncated`, `returned`, `total` and `nextPageOffset` or
 * `nextPageToken`, with a `warning`, placed before `data` (frodo-cli#1373). `data`
 * itself is what it was. These tests pin the fields, their order, the three kinds
 * of result they are built from (an array, a result that the platform pages, a live
 * cursor), the results that must not get them, and the texts that tell an agent how
 * to read on. Unit test: no recordings, no tenant, fake methods.
 */
import '../index';
import http from 'http';
import { AddressInfo } from 'net';
import { jest } from '@jest/globals';
import FrodoLib, { frodo } from '../lib/FrodoLib';
import { buildCapabilityInventory } from './CapabilityRegistry';
import { buildToolManifest } from './ToolManifest';
import {
  createToolRuntime,
  McpToolExecutionResult,
  McpToolRuntimeOptions,
} from './ToolRuntime';

const inventory = buildCapabilityInventory(frodo, { includeUtils: false });
const manifest = buildToolManifest(inventory);

type Method = (...args: any[]) => unknown;

const RESULT_FIELDS = [
  'truncated',
  'returned',
  'total',
  'nextPageOffset',
  'nextPageToken',
  'warning',
];

/** A root with the login the runtime asks for and one method at the path of the capability id. */
function rootWith(id: string, method: Method, extra: object = {}) {
  const root: any = { login: { getTokens: async () => undefined }, ...extra };
  const path = id.split('.');
  let node = root;
  for (const segment of path.slice(0, -1)) {
    node = node[segment] = node[segment] ?? {};
  }
  node[path[path.length - 1]] = method;
  return root;
}

/** A state that has the Log API key and secret the log capabilities require. */
const withLogApiCredential = {
  state: { getLogApiKey: () => 'key', getLogApiSecret: () => 'secret' },
};

function runtimeFor(root: unknown, options: McpToolRuntimeOptions = {}) {
  return createToolRuntime(manifest, inventory, {} as any, {
    resolveFrodoForRequest: () => root as any,
    ...options,
  });
}

const context = { auth: { mode: 'state-config', config: {} } } as any;

function dispatch(
  runtime: ReturnType<typeof runtimeFor>,
  skillId: string,
  args: Record<string, unknown> = {},
  toolName = 'frodo_dispatch_read_only'
): Promise<McpToolExecutionResult> {
  return runtime.executeTool({
    toolName,
    arguments: { skillId, ...args },
    context,
  });
}

/** An item whose compact JSON is exactly `bytes` long. */
function itemOfSize(index: number, bytes: number) {
  const id = `item-${String(index).padStart(5, '0')}`;
  const base = JSON.stringify({ _id: id, pad: '' }).length;
  return { _id: id, pad: 'x'.repeat(bytes - base) };
}

/** `count` items of `bytes` bytes each (compact JSON). */
function items(count: number, bytes: number) {
  return Array.from({ length: count }, (_, index) => itemOfSize(index, bytes));
}

/** `count` items of 20 bytes each: far below the size budget. */
function smallItems(count: number) {
  return Array.from({ length: count }, () => 'x'.repeat(18));
}

/** The result of `authn.journey.readJourneys` for `list`, through the read-only tool. */
async function readJourneys(
  list: unknown[],
  args: Record<string, unknown> = {},
  options: McpToolRuntimeOptions = {}
) {
  const readJourneys = jest.fn(async () => list);
  const result = await dispatch(
    runtimeFor(rootWith('authn.journey.readJourneys', readJourneys), options),
    'authn.journey.readJourneys',
    args
  );
  return result as McpToolExecutionResult & { data: unknown[] };
}

describe('the test items', () => {
  test('an item of 2,300 bytes is 2,300 bytes of compact JSON, and the budget lets 28 of them through', () => {
    expect(JSON.stringify(itemOfSize(7, 2300)).length).toBe(2300);
    // 2 brackets + 28 items + 27 commas fit 65,536 bytes, a 29th does not
    expect(2 + 28 * 2300 + 27).toBeLessThanOrEqual(65536);
    expect(2 + 29 * 2300 + 28).toBeGreaterThan(65536);
  });
});

describe('a list result that the runtime cut to its size budget', () => {
  test('T1a: the cut is reported only in the nested pagination metadata (the symptom, true before and after)', async () => {
    const result = await readJourneys(items(195, 2300));

    expect(result.data).toHaveLength(28);
    expect(result.metadata?.pagination).toMatchObject({
      isPartial: true,
      returnedCount: 28,
      totalCount: 195,
      hasMore: true,
      nextPageOffset: 28,
    });
  });

  test('T1: the first fields of the result say that data is not complete, how much it holds and how to read on', async () => {
    const result = await readJourneys(items(195, 2300));

    expect(result).toMatchObject({
      truncated: true,
      returned: 28,
      total: 195,
      nextPageOffset: 28,
    });
    expect(result.warning).toContain('28 of 195');
    expect(result.warning).toContain('pageOffset: 28');
    expect(result.warning).toContain('pageSize');
    expect(result.warning).toContain('count capability');
    expect(result.warning).toBe(result.metadata?.pagination?.warning);
    expect('nextPageToken' in result).toBe(false);
  });

  test('T1b: the warning is the sentence of the specification, with the numbers filled in', async () => {
    const result = await readJourneys(items(195, 2300));

    expect(result.warning).toBe(
      'Result is not complete: data holds 28 of 195 items; the other 167 are not in this response (size limit 65536 bytes, at most 1000 items per call). Do not count or search only this page. Pass pageOffset: 28 to read on (pageSize is the maximum number of items you want), or use a count capability for the exact total.'
    );
  });

  test('T1c: the limits in the warning are the ones the runtime was created with', async () => {
    const result = await readJourneys(
      items(50, 200),
      {},
      {
        resultWarningThresholdBytes: 1000,
        paginationWarningThreshold: 40,
      }
    );

    expect(result.truncated).toBe(true);
    expect(result.warning).toContain('size limit 1000 bytes');
    expect(result.warning).toContain('at most 40 items per call');
  });

  test('T2: the fields are printed before data, in a fixed order', async () => {
    const result = await readJourneys(items(195, 2300));
    const keys = Object.keys(result);

    expect(keys).toEqual([
      'toolName',
      'descriptorId',
      'truncated',
      'returned',
      'total',
      'nextPageOffset',
      'warning',
      'data',
      'metadata',
    ]);
    expect(keys.indexOf('truncated')).toBeLessThan(keys.indexOf('data'));
    // what a client reads first is what the JSON text starts with
    expect(JSON.stringify(result).indexOf('"truncated"')).toBeLessThan(
      JSON.stringify(result).indexOf('"data"')
    );
  });

  test('T2b: data is the same list as before, item for item', async () => {
    const list = items(195, 2300);
    const result = await readJourneys(list);

    expect(JSON.stringify(result.data)).toBe(JSON.stringify(list.slice(0, 28)));
  });

  test('T6: an explicit pageSize above the budget is not honoured, and the result still says it is cut', async () => {
    const result = await readJourneys(items(195, 2300), { pageSize: 195 });

    expect(result.data).toHaveLength(28);
    expect(result).toMatchObject({
      truncated: true,
      returned: 28,
      total: 195,
      nextPageOffset: 28,
    });
    expect(result.metadata?.pagination?.requestedPageSize).toBe(195);
  });
});

describe('a list result that is complete', () => {
  test('T3: says so: truncated is false, returned equals total, nothing tells the agent to read on', async () => {
    const list = items(3, 300);
    const result = await readJourneys(list);

    expect(result.data).toEqual(list);
    expect(result).toMatchObject({ truncated: false, returned: 3, total: 3 });
    expect('nextPageOffset' in result).toBe(false);
    expect('nextPageToken' in result).toBe(false);
    expect('warning' in result).toBe(false);
    expect(Object.keys(result)).toEqual([
      'toolName',
      'descriptorId',
      'truncated',
      'returned',
      'total',
      'data',
      'metadata',
    ]);
  });

  test('T3b: an empty list is complete', async () => {
    const result = await readJourneys([]);

    expect(result).toMatchObject({ truncated: false, returned: 0, total: 0 });
  });

  test('T5b: a list of exactly the item ceiling is complete, and the nested metadata agrees', async () => {
    const result = await readJourneys(smallItems(1000));

    expect(result.data).toHaveLength(1000);
    expect(result).toMatchObject({
      truncated: false,
      returned: 1000,
      total: 1000,
    });
    expect(result.metadata?.pagination?.isPartial).toBe(false);
    expect(result.metadata?.pagination?.warning).toBeUndefined();
    expect('warning' in result).toBe(false);
  });
});

describe('a list result that was read in pages', () => {
  test('T4: a page in the middle says that more follow and where', async () => {
    const result = await readJourneys(items(195, 300), {
      pageOffset: 20,
      pageSize: 10,
    });

    expect(result.data).toHaveLength(10);
    expect((result.data[0] as { _id: string })._id).toBe('item-00020');
    expect(result).toMatchObject({
      truncated: true,
      returned: 10,
      total: 195,
      nextPageOffset: 30,
    });
    expect(result.warning).toContain('pageOffset: 30');
  });

  test('T4b: the last page is not truncated and has no next offset', async () => {
    const result = await readJourneys(items(195, 300), {
      pageOffset: 190,
      pageSize: 10,
    });

    expect(result.data).toHaveLength(5);
    expect(result).toMatchObject({ truncated: false, returned: 5, total: 195 });
    expect('nextPageOffset' in result).toBe(false);
    expect('warning' in result).toBe(false);
  });

  test('T4c: an offset past the end returns nothing and is not truncated', async () => {
    const result = await readJourneys(items(195, 300), { pageOffset: 500 });

    expect(result.data).toEqual([]);
    expect(result).toMatchObject({ truncated: false, returned: 0, total: 195 });
    expect('nextPageOffset' in result).toBe(false);
  });

  test('T4d: following nextPageOffset to the end reads every item once', async () => {
    const list = items(195, 2300);
    const seen: string[] = [];
    let offset: number | undefined = 0;
    let calls = 0;
    while (offset !== undefined) {
      const page: McpToolExecutionResult & { data: Array<{ _id: string }> } =
        (await readJourneys(list, { pageOffset: offset })) as any;
      seen.push(...page.data.map((item) => item._id));
      offset = page.nextPageOffset;
      calls += 1;
    }

    expect(seen).toEqual(list.map((item) => item._id));
    expect(calls).toBe(7);
  });

  test('T4e: a page of the size the caller asked for is truncated when more remain', async () => {
    const result = await readJourneys(items(195, 300), { pageSize: 50 });

    expect(result.data).toHaveLength(50);
    expect(result).toMatchObject({
      truncated: true,
      returned: 50,
      total: 195,
      nextPageOffset: 50,
    });
  });
});

describe('a list result that the item ceiling cut', () => {
  test('T5: 1,500 small items give 1,000, and the result says it is cut', async () => {
    const result = await readJourneys(smallItems(1500));

    expect(result.data).toHaveLength(1000);
    expect(result).toMatchObject({
      truncated: true,
      returned: 1000,
      total: 1500,
      nextPageOffset: 1000,
    });
    expect(result.warning).toContain('1000 of 1500');
  });
});

describe('a result that the platform pages', () => {
  const systemObjects = (page: object) =>
    dispatch(
      runtimeFor(
        rootWith(
          'idm.system.querySystemObjects',
          jest.fn(async () => page)
        )
      ),
      'idm.system.querySystemObjects',
      {
        namedArgs: {
          systemName: 'ldap',
          systemObjectType: 'account',
          filter: 'true',
        },
      }
    );

  const ten = Array.from({ length: 10 }, (_, index) => ({ _id: `u${index}` }));

  test('T7: a cookie means that more follow: truncated, an unknown total, the token to continue with', async () => {
    const page = {
      result: ten,
      resultCount: 10,
      pagedResultsCookie: 'abc',
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    };
    const result = await systemObjects(page);

    expect(result.data).toBe(page);
    expect(result).toMatchObject({
      truncated: true,
      returned: 10,
      total: null,
      nextPageToken: 'abc',
    });
    expect('nextPageOffset' in result).toBe(false);
    expect(result.warning).toContain('pageToken');
    expect(result.warning).not.toContain('abc');
    expect(result.metadata?.pagination).toMatchObject({
      isPartial: true,
      hasMore: true,
      returnedCount: 10,
    });
    expect(result.metadata?.pagination?.warning).toBe(result.warning);
    expect(Object.keys(result).indexOf('truncated')).toBeLessThan(
      Object.keys(result).indexOf('data')
    );
  });

  test('T7b: no cookie and an exact total: complete', async () => {
    const result = await systemObjects({
      result: ten,
      resultCount: 10,
      pagedResultsCookie: null,
      totalPagedResultsPolicy: 'EXACT',
      totalPagedResults: 10,
      remainingPagedResults: -1,
    });

    expect(result).toMatchObject({ truncated: false, returned: 10, total: 10 });
    expect('nextPageToken' in result).toBe(false);
    expect('warning' in result).toBe(false);
    expect(result.metadata?.pagination?.isPartial).toBe(false);
  });

  test('T7c: a known total and a cookie: the total is reported with the cut', async () => {
    const result = await systemObjects({
      result: ten,
      resultCount: 10,
      pagedResultsCookie: 'def',
      totalPagedResultsPolicy: 'EXACT',
      totalPagedResults: 120,
      remainingPagedResults: 110,
    });

    expect(result).toMatchObject({
      truncated: true,
      returned: 10,
      total: 120,
      nextPageToken: 'def',
    });
    expect(result.warning).toContain('10 of 120');
    expect(result.metadata?.pagination).toMatchObject({
      isPartial: true,
      totalCount: 120,
    });
  });

  test('T7d: remaining results without a cookie are truncated, with no token', async () => {
    const result = await systemObjects({
      result: ten,
      resultCount: 10,
      pagedResultsCookie: null,
      totalPagedResults: -1,
      remainingPagedResults: 5,
    });

    expect(result).toMatchObject({
      truncated: true,
      returned: 10,
      total: null,
    });
    expect('nextPageToken' in result).toBe(false);
  });

  test('T7e: an object that holds a result array but is not a paged result gets no fields', async () => {
    const result = await systemObjects({
      result: ten,
      somethingElse: true,
    } as any);

    for (const field of RESULT_FIELDS) {
      expect(field in result).toBe(false);
    }
  });
});

describe('a one-page managed-object query', () => {
  let server: http.Server;
  let host: string;
  let requests: string[];

  beforeAll(async () => {
    requests = [];
    server = http.createServer((request, response) => {
      requests.push(`${request.method} ${request.url}`);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          result: [{ _id: 'u1' }, { _id: 'u2' }],
          resultCount: 2,
          pagedResultsCookie: 'mo-cookie',
          totalPagedResultsPolicy: 'NONE',
          totalPagedResults: -1,
          remainingPagedResults: -1,
        })
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve())
    );
    host = `http://127.0.0.1:${(server.address() as AddressInfo).port}/am`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  test('T7f: reports a cookie as a cut, in the same way as the other results the platform pages', async () => {
    const instance = FrodoLib({
      host,
      deploymentType: 'cloud',
      realm: 'alpha',
    });
    instance.state.setUseTokenCache(false);
    instance.state.setCookieName('iPlanetDirectoryPro');
    instance.state.setBearerTokenMeta({
      access_token: 'demo-access-token',
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 3600,
      expires: Date.now() + 3600 * 1000,
    } as any);
    (instance.login as any).getTokens = async () => undefined;
    requests.length = 0;

    const result = await dispatch(
      runtimeFor(instance),
      'idm.managed.queryManagedObjects',
      { namedArgs: { type: 'alpha_user' } }
    );

    expect(requests).toHaveLength(1);
    expect(result).toMatchObject({
      truncated: true,
      returned: 2,
      total: null,
      nextPageToken: 'mo-cookie',
    });
  });
});

describe('the log capabilities', () => {
  const logPage = (cookie: string | null) => ({
    result: [
      { timestamp: '2026-11-17T10:00:00Z', payload: { message: 'one' } },
      { timestamp: '2026-11-17T10:00:01Z', payload: { message: 'two' } },
    ],
    resultCount: 2,
    pagedResultsCookie: cookie,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  });

  test('T8: a bounded fetch with a cookie is truncated and carries the token', async () => {
    const fetch = jest.fn(async () => logPage('COOKIE'));
    const result = await dispatch(
      runtimeFor(rootWith('cloud.log.fetch', fetch, withLogApiCredential)),
      'cloud.log.fetch',
      {
        namedArgs: {
          source: 'am-core',
          startTs: '2026-11-17T10:00:00Z',
          endTs: '2026-11-17T11:00:00Z',
          cookie: '',
          txid: '',
          filter: '',
        },
      }
    );

    expect(result).toMatchObject({
      truncated: true,
      returned: 2,
      total: null,
      nextPageToken: 'COOKIE',
    });
    expect(result.metadata?.pagination).toMatchObject({
      isPartial: true,
      hasMore: true,
    });
  });

  test('T8b: the last page of a fetch has no cookie and is complete', async () => {
    const fetch = jest.fn(async () => logPage(null));
    const result = await dispatch(
      runtimeFor(rootWith('cloud.log.fetch', fetch, withLogApiCredential)),
      'cloud.log.fetch',
      {
        namedArgs: {
          source: 'am-core',
          startTs: '2026-11-17T10:00:00Z',
          endTs: '2026-11-17T11:00:00Z',
          cookie: 'COOKIE',
          txid: '',
          filter: '',
        },
      }
    );

    expect(result).toMatchObject({
      truncated: false,
      returned: 2,
      total: null,
    });
    expect('nextPageToken' in result).toBe(false);
  });

  test('T8c: a live cursor reports returned and the token, and never truncated', async () => {
    const tail = jest.fn(async () => logPage('NEXT'));
    const result = await dispatch(
      runtimeFor(rootWith('cloud.log.tail', tail, withLogApiCredential)),
      'cloud.log.tail',
      { positionalArgs: ['am-core', ''] }
    );

    expect(result).toMatchObject({ returned: 2, nextPageToken: 'NEXT' });
    for (const field of ['truncated', 'total', 'nextPageOffset', 'warning']) {
      expect(field in result).toBe(false);
    }
    expect(Object.keys(result).indexOf('returned')).toBeLessThan(
      Object.keys(result).indexOf('data')
    );
  });

  test('T8d: a live cursor with no further token still reports returned', async () => {
    const tail = jest.fn(async () => logPage(null));
    const result = await dispatch(
      runtimeFor(rootWith('cloud.log.tail', tail, withLogApiCredential)),
      'cloud.log.tail',
      { positionalArgs: ['am-core', ''] }
    );

    expect(result.returned).toBe(2);
    expect('nextPageToken' in result).toBe(false);
    expect('truncated' in result).toBe(false);
  });
});

describe('a search that stops at a limit of its own', () => {
  const searchEvents = (
    events: unknown[],
    namedArgs: Record<string, unknown> = {}
  ) =>
    dispatch(
      runtimeFor(
        rootWith(
          'cloud.log.searchEvents',
          jest.fn(async () => events),
          withLogApiCredential
        )
      ),
      'cloud.log.searchEvents',
      {
        namedArgs: {
          source: 'am-authentication',
          startTs: '2026-11-17T10:00:00Z',
          endTs: '2026-11-17T11:00:00Z',
          ...namedArgs,
        },
      }
    );

  test('T14: as many events as the default limit: it probably stopped there, so the result is truncated with an unknown total', async () => {
    const result = await searchEvents(smallItems(1000));

    expect(result.data).toHaveLength(1000);
    expect(result).toMatchObject({
      truncated: true,
      returned: 1000,
      total: null,
    });
    expect('nextPageOffset' in result).toBe(false);
    expect(result.warning).toBe(
      'Result is not complete: the capability stopped at its own limit of 1000 items (argument maxEvents), so more items may exist than it returned. Do not count or search only this result. Raise maxEvents or narrow the search to read more.'
    );
    expect(result.metadata?.pagination).toMatchObject({
      isPartial: true,
      returnedCount: 1000,
    });
    expect(result.metadata?.pagination?.warning).toBe(result.warning);
    expect('hasMore' in (result.metadata?.pagination ?? {})).toBe(false);
    expect('totalCount' in (result.metadata?.pagination ?? {})).toBe(false);
    expect(Object.keys(result).indexOf('truncated')).toBeLessThan(
      Object.keys(result).indexOf('data')
    );
  });

  test('T14b: fewer events than the limit: complete', async () => {
    const result = await searchEvents(smallItems(999));

    expect(result).toMatchObject({
      truncated: false,
      returned: 999,
      total: 999,
    });
    expect('warning' in result).toBe(false);
    expect(result.metadata?.pagination?.isPartial).toBe(false);
  });

  test('T14c: the limit is the one the caller sent', async () => {
    const atTheLimit = await searchEvents(smallItems(50), { maxEvents: 50 });
    const belowTheLimit = await searchEvents(smallItems(49), { maxEvents: 50 });
    const aboveTheDefault = await searchEvents(smallItems(1000), {
      maxEvents: 5000,
    });

    expect(atTheLimit).toMatchObject({
      truncated: true,
      returned: 50,
      total: null,
    });
    expect(atTheLimit.warning).toContain(
      'limit of 50 items (argument maxEvents)'
    );
    expect(belowTheLimit).toMatchObject({ truncated: false, total: 49 });
    expect(aboveTheDefault).toMatchObject({ truncated: false, total: 1000 });
  });

  test('T14d: a limit of 0 and no events is not a cut', async () => {
    const result = await searchEvents([], { maxEvents: 0 });

    expect(result).toMatchObject({ truncated: false, returned: 0, total: 0 });
  });

  test('T14e: a result that the capability limited and that the runtime cut as well says both', async () => {
    const result = await searchEvents(items(1000, 2300));

    expect(result.data).toHaveLength(28);
    expect(result).toMatchObject({
      truncated: true,
      returned: 28,
      total: null,
      nextPageOffset: 28,
    });
    expect(result.warning).toBe(
      'Result is not complete: the capability stopped at its own limit of 1000 items (argument maxEvents), so more items may exist than it returned. Do not count or search only this result. Raise maxEvents or narrow the search to read more. The response was also cut: data holds 28 of the 1000 items that the capability returned. Pass pageOffset: 28 to read the rest of them.'
    );
    expect(result.metadata?.pagination).toMatchObject({
      isPartial: true,
      hasMore: true,
      nextPageOffset: 28,
      returnedCount: 28,
    });
    expect('totalCount' in (result.metadata?.pagination ?? {})).toBe(false);
  });

  test('T14f: a list that does not limit itself is complete at the same size', async () => {
    const result = await readJourneys(smallItems(1000));

    expect(result).toMatchObject({ truncated: false, total: 1000 });
  });
});

describe('results that are not lists', () => {
  test('T10: a count, a read, a create and an update have none of the fields', async () => {
    const countResult = await dispatch(
      runtimeFor(rootWith('authn.journey.countJourneys', async () => 195)),
      'authn.journey.countJourneys'
    );
    const readResult = await dispatch(
      runtimeFor(
        // a read that returns an array is still not a list
        rootWith('authn.journey.readJourney', async () => [
          { _id: 'Login' },
          { _id: 'Logout' },
        ])
      ),
      'authn.journey.readJourney',
      { positionalArgs: ['Login'] }
    );
    const createResult = await dispatch(
      runtimeFor(rootWith('script.createScript', async () => ({ _id: 's1' }))),
      'script.createScript',
      {
        namedArgs: {
          scriptId: 's1',
          scriptName: 'one',
          scriptData: { name: 'one' },
        },
      },
      'frodo_dispatch'
    );
    const updateResult = await dispatch(
      runtimeFor(
        // an update whose answer looks like a paged result is still not a list
        rootWith('script.updateScript', async () => ({
          result: [{ _id: 's1' }],
          resultCount: 1,
          pagedResultsCookie: 'not-a-cursor',
        }))
      ),
      'script.updateScript',
      { namedArgs: { scriptId: 's1', scriptData: { name: 'one' } } },
      'frodo_dispatch'
    );

    for (const result of [
      countResult,
      readResult,
      createResult,
      updateResult,
    ]) {
      for (const field of RESULT_FIELDS) {
        expect(field in result).toBe(false);
      }
      expect(Object.keys(result).sort()).toEqual([
        'data',
        'descriptorId',
        'metadata',
        'toolName',
      ]);
      expect(result.metadata?.pagination).toBeUndefined();
    }
    expect(countResult.data).toBe(195);
  });

  test('T10b: a list capability whose result is neither a list nor a paged result gets none of the fields', async () => {
    const result = await readJourneys({ unexpected: 'shape' } as any);

    for (const field of RESULT_FIELDS) {
      expect(field in result).toBe(false);
    }
  });
});

describe('frodo_find_skills with an executed recommendation', () => {
  const cloudContext = {
    auth: { mode: 'state-config', config: { deploymentType: 'cloud' } },
  } as any;

  async function findAndExecute(list: unknown[]) {
    const readManagedObjects = jest.fn(async () => list);
    const runtime = runtimeFor(
      rootWith('idm.managed.readManagedObjects', readManagedObjects),
      {
        managedObjectTypes: ['alpha_user', 'bravo_user'],
        managedObjectHydrationStatus: 'available',
        executeRecommendedByDefault: true,
      }
    );
    const found = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: {
        query: 'list alpha_user',
        skillIdPrefix: 'idm.managed.readManagedObjects',
      },
      context: cloudContext,
    });
    return found.data as {
      executionTruncated?: true;
      nextAction?: string;
      execution?: McpToolExecutionResult;
    };
  }

  test('T9: an execution that was cut says so, and does not tell the agent to answer from it', async () => {
    const payload = await findAndExecute(items(195, 2300));

    expect(payload.execution).toMatchObject({
      truncated: true,
      returned: 28,
      total: 195,
      nextPageOffset: 28,
    });
    expect(payload.executionTruncated).toBe(true);
    expect(payload.nextAction).toContain('not complete');
    expect(payload.nextAction).toContain('execution.truncated is true');
    expect(payload.nextAction).toContain('execution.nextPageOffset');
    expect(payload.nextAction).toContain('frodo_dispatch_read_only');
    expect(payload.nextAction).not.toContain('Answer the user from');
    // the first thing of the answer
    expect(Object.keys(payload)[0]).toBe('executionTruncated');
  });

  test('T9b: a complete execution keeps the old text and has no executionTruncated', async () => {
    const payload = await findAndExecute(items(3, 300));

    expect(payload.execution).toMatchObject({ truncated: false, returned: 3 });
    expect('executionTruncated' in payload).toBe(false);
    expect(payload.nextAction).toBe(
      'Answer the user from execution.data. The recommended read-only skill has already run; do not call any more discovery tools.'
    );
  });
});

describe('policy and exposure', () => {
  test('T11: the read-only tool still rejects an update, and the mutating tool still rejects a list', async () => {
    const readOnlyUpdate = dispatch(
      runtimeFor(rootWith('script.updateScript', async () => ({}))),
      'script.updateScript',
      { namedArgs: { scriptId: 's1', scriptData: {} } }
    );
    const mutatingList = dispatch(
      runtimeFor(rootWith('authn.journey.readJourneys', async () => [])),
      'authn.journey.readJourneys',
      {},
      'frodo_dispatch'
    );

    await expect(readOnlyUpdate).rejects.toThrow(
      "'frodo_dispatch_read_only' cannot execute 'update'"
    );
    await expect(mutatingList).rejects.toThrow(
      "'frodo_dispatch' is for mutating operations"
    );
  });

  test('T11b: the manifest has the same number of capabilities as the inventory, and each tool is still a tool of the five', () => {
    expect(manifest.backingDescriptorCount).toBe(inventory.length);
    expect(manifest.canonicalTools.map((tool) => tool.toolName)).toEqual([
      'frodo_find_skills',
      'frodo_describe_skill',
      'frodo_dispatch_read_only',
      'frodo_dispatch',
    ]);
  });
});

describe('frodo_describe_skill', () => {
  async function describeSkill(
    skillId: string,
    options: McpToolRuntimeOptions = {}
  ) {
    const result = await runtimeFor({}, options).executeTool({
      toolName: 'frodo_describe_skill',
      arguments: { skillId },
      context,
    });
    return result.data as { descriptor: unknown; paging?: any };
  }

  test('T12: a list capability has a paging block built from the limits of the runtime', async () => {
    const described = await describeSkill('authn.journey.readJourneys');

    expect(described.paging).toBeDefined();
    expect(described.paging.defaultMaxBytes).toBe(65536);
    expect(described.paging.defaultMaxItems).toBe(1000);
    expect(described.paging.controls).toEqual([
      'pageSize',
      'pageOffset',
      'pageToken',
    ]);
    expect(described.paging.resultFields).toEqual(RESULT_FIELDS);
    expect(described.paging.note).toContain('truncated');
    expect(described.paging.note).toContain('nextPageOffset');
    expect(described.paging.note).toContain('nextPageToken');
    expect(described.paging.note).toContain('semantic count');
    expect(Object.keys(described)).toEqual([
      'descriptor',
      'supportedSelectors',
      'paging',
    ]);
  });

  test('T12b: the limits in the block follow the options of the runtime', async () => {
    const described = await describeSkill('authn.journey.readJourneys', {
      resultWarningThresholdBytes: 2048,
      paginationWarningThreshold: 25,
    });

    expect(described.paging.defaultMaxBytes).toBe(2048);
    expect(described.paging.defaultMaxItems).toBe(25);
  });

  test('T12c: a search capability has the block too, and a count, a read and a create capability do not', async () => {
    expect((await describeSkill('cloud.log.fetch')).paging).toBeDefined();
    for (const id of [
      'authn.journey.countJourneys',
      'authn.journey.readJourney',
      'script.createScript',
    ]) {
      expect('paging' in (await describeSkill(id))).toBe(false);
    }
  });
});

describe('the tool descriptions', () => {
  const tool = (name: string) =>
    manifest.canonicalTools.find((canonical) => canonical.toolName === name)!;

  test('T13: the read-only dispatch tool says that a list result states whether it is complete, and how to read on', () => {
    const description = tool('frodo_dispatch_read_only').description;

    expect(description).toContain('truncated, returned and total');
    expect(description).toContain('before data');
    expect(description).toContain('pageOffset');
    expect(description).toContain('nextPageOffset');
    expect(description).toContain('pageToken');
    expect(description).toContain('nextPageToken');
    expect(description).toContain('count capability');
    // the sentence about a bulk call that failed in part is kept
    expect(description).toContain('partial: true');
    expect(description).toContain('itemResults.failures');
  });

  test('T13c: the description of find_skills does not tell the agent to answer from a result that was cut', () => {
    const description = tool('frodo_find_skills').description;

    expect(description).toContain(
      'answer from that result without further discovery, unless the answer has executionTruncated: true, in which case read on as its nextAction says'
    );
    expect(description).toContain('Search available capabilities');
    expect(description).not.toContain('skills');
  });

  test('T13b: the list and search descriptions say it too', () => {
    for (const operationType of ['list', 'search']) {
      const generic = manifest.genericTools.find(
        (candidate) => candidate.operationType === operationType
      );
      expect(generic?.description).toContain('truncated, returned, total');
      expect(generic?.description).toContain('pageOffset or pageToken');
    }
  });
});
