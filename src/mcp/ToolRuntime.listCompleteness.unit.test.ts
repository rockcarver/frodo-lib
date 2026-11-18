/**
 * Run tests
 *
 *        npm run test:only ToolRuntime.listCompleteness
 *
 * A list or search result that the MCP runtime cut (to its response size budget,
 * to its item ceiling, or to the page the caller asked for) says so in the first
 * fields of the result: `truncated`, `returned`, `total` and `nextPageOffset` or
 * `nextPageToken`, with a `warning`, placed before `data` (frodo-cli#1373). `data`
 * itself is what it was. These tests pin the fields, their order, the three shapes
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
    // bounded: a wrong continuation must fail the test, not hang it
    while (offset !== undefined && calls < 20) {
      const page: McpToolExecutionResult & { data: Array<{ _id: string }> } =
        (await readJourneys(list, { pageOffset: offset })) as any;
      seen.push(...page.data.map((item) => item._id));
      offset = page.nextPageOffset;
      calls += 1;
    }

    expect(offset).toBeUndefined();
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
    expect(result.warning).toBe(
      'Result is not complete: data.result holds 10 items and more exist. Do not count or search only this page. Pass nextPageToken as pageToken to read on, or use a count capability for the exact total.'
    );
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
    expect(result.warning).toBe(
      'Result is not complete: data.result holds 10 of 120 items; the other 110 are not in this response. Do not count or search only this page. Pass nextPageToken as pageToken to read on, or use a count capability for the exact total.'
    );
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
    expect(result.warning).toBe(
      'Result is not complete: data.result holds 10 items and more exist. Do not count or search only this page. Read on with the paging controls of this capability, or use a count capability for the exact total.'
    );
  });

  test.each([
    {
      name: 'an exact total of 0 is a total, and nothing remains: complete',
      page: {
        result: [],
        pagedResultsCookie: null,
        totalPagedResults: 0,
        remainingPagedResults: 0,
      },
      expected: { truncated: false, returned: 0, total: 0 },
    },
    {
      name: 'remaining results of 0 and no cookie: complete',
      page: {
        result: ten,
        pagedResultsCookie: null,
        totalPagedResults: 10,
        remainingPagedResults: 0,
      },
      expected: { truncated: false, returned: 10, total: 10 },
    },
    {
      name: 'an empty cookie is no cookie: complete, no token',
      page: {
        result: ten,
        pagedResultsCookie: '',
        totalPagedResults: -1,
        remainingPagedResults: -1,
      },
      expected: { truncated: false, returned: 10, total: null },
    },
    {
      name: 'a result is paged when it has resultCount alone',
      page: { result: ten, resultCount: 10 },
      expected: { truncated: false, returned: 10, total: null },
    },
    {
      name: 'a result is paged when it has totalPagedResults alone',
      page: { result: ten, totalPagedResults: 10 },
      expected: { truncated: false, returned: 10, total: 10 },
    },
    {
      name: 'a result is paged when it has pagedResultsCookie alone',
      page: { result: ten, pagedResultsCookie: 'only-a-cookie' },
      expected: {
        truncated: true,
        returned: 10,
        total: null,
        nextPageToken: 'only-a-cookie',
      },
    },
  ])('T7g: $name', async ({ page, expected }) => {
    const result = await systemObjects(page as object);

    expect(result).toMatchObject(expected);
    expect('nextPageToken' in result).toBe('nextPageToken' in expected);
    expect('warning' in result).toBe(expected.truncated);
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

/** A cloud instance of the library with a bearer token that carries the IDM scope, for the host of a loopback server. */
function idmInstance(host: string) {
  const instance = FrodoLib({ host, deploymentType: 'cloud', realm: 'alpha' });
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
  return instance;
}

/**
 * Follows `nextPageToken` from page to page with `pageToken`, for at most
 * `limit` calls: a continuation that does not advance fails the test instead
 * of hanging it. Returns the ids of the items of every page, and the number of
 * calls.
 */
async function walkPages(
  first: () => Promise<McpToolExecutionResult>,
  next: (token: string) => Promise<McpToolExecutionResult>,
  limit = 6
) {
  const ids: string[] = [];
  let calls = 1;
  let result = await first();
  for (;;) {
    ids.push(
      ...(result.data as { result: Array<{ _id: string }> }).result.map(
        (item) => item._id
      )
    );
    if (result.nextPageToken === undefined || calls >= limit) {
      break;
    }
    result = await next(result.nextPageToken);
    calls += 1;
  }
  return { ids, calls, last: result };
}

/** Three pages of two items, each reachable only through the cookie of the page before. */
const PAGES: Record<string, { items: string[]; next: string | null }> = {
  first: { items: ['a0', 'a1'], next: 'cookie-2' },
  'cookie-2': { items: ['b0', 'b1'], next: 'cookie-3' },
  'cookie-3': { items: ['c0', 'c1'], next: null },
};

/** The paged result that the platform answers for the page the cookie names. */
const pagedAnswer = (cookie: string | undefined | null) => {
  const page = PAGES[cookie || 'first'] ?? { items: [], next: null };
  return {
    result: page.items.map((_id) => ({ _id })),
    resultCount: page.items.length,
    pagedResultsCookie: page.next,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  };
};

describe('a one-page managed-object query', () => {
  let server: http.Server;
  let host: string;
  let requests: string[];

  beforeAll(async () => {
    requests = [];
    server = http.createServer((request, response) => {
      requests.push(`${request.method} ${request.url}`);
      const cookie = new URL(
        request.url ?? '',
        'http://127.0.0.1'
      ).searchParams.get('_pagedResultsCookie');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(pagedAnswer(cookie)));
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
    requests.length = 0;

    const result = await dispatch(
      runtimeFor(idmInstance(host)),
      'idm.managed.queryManagedObjects',
      { namedArgs: { type: 'alpha_user' } }
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toContain('_pagedResultsCookie');
    expect(result).toMatchObject({
      truncated: true,
      returned: 2,
      total: null,
      nextPageToken: 'cookie-2',
    });
  });

  test('T15a: the nextPageToken of a managed-object query, passed back as pageToken, reads the next page and the end', async () => {
    requests.length = 0;
    const runtime = runtimeFor(idmInstance(host));
    const read = (extra: Record<string, unknown> = {}) =>
      dispatch(runtime, 'idm.managed.queryManagedObjects', {
        namedArgs: { type: 'alpha_user' },
        ...extra,
      });

    const walked = await walkPages(
      () => read(),
      (token) => read({ pageToken: token })
    );

    expect(walked.ids).toEqual(['a0', 'a1', 'b0', 'b1', 'c0', 'c1']);
    expect(walked.calls).toBe(3);
    expect(walked.last).toMatchObject({ truncated: false, returned: 2 });
    expect('nextPageToken' in walked.last).toBe(false);
    expect(requests).toHaveLength(3);
    expect(requests[1]).toContain('_pagedResultsCookie=cookie-2');
    expect(requests[2]).toContain('_pagedResultsCookie=cookie-3');
  });
});

describe('a recommended execution of a managed-object query', () => {
  test('T9c: the cut execution of a query with an unknown total is marked, and its nextAction says how to read on', async () => {
    // the runtime reads the page through the api layer: serve it from a loopback server
    // a server that ends: a page for a cookie, the last one without a cookie
    const server = http.createServer((request, response) => {
      const cookie = new URL(
        request.url ?? '',
        'http://127.0.0.1'
      ).searchParams.get('_pagedResultsCookie');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(pagedAnswer(cookie)));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve())
    );
    try {
      const instance = FrodoLib({
        host: `http://127.0.0.1:${(server.address() as AddressInfo).port}/am`,
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
      const runtime = runtimeFor(instance, {
        managedObjectTypes: ['alpha_user'],
        managedObjectHydrationStatus: 'available',
        executeRecommendedByDefault: true,
      });

      const found = await runtime.executeTool({
        toolName: 'frodo_find_skills',
        arguments: {
          query: 'query alpha_user',
          skillIdPrefix: 'idm.managed.queryManagedObjects',
        },
        context: {
          auth: { mode: 'state-config', config: { deploymentType: 'cloud' } },
        } as any,
      });
      const payload = found.data as {
        executionTruncated?: true;
        nextAction?: string;
        execution?: McpToolExecutionResult;
      };

      expect(payload.execution).toMatchObject({
        truncated: true,
        returned: 2,
        total: null,
        nextPageToken: 'cookie-2',
      });
      expect(payload.executionTruncated).toBe(true);
      expect(payload.nextAction).toContain(
        '(execution.total is null when the number is not known)'
      );
      expect(payload.nextAction).toContain('execution.nextPageToken');
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

/**
 * The cookies that a query of IDM can hand out, and what the request that
 * carries them back has to look like. The server below decodes the query string
 * as a servlet container does (a raw `+` becomes a space), so a cookie that is
 * not encoded properly is not found and the walk ends early.
 */
const COOKIE_CASES = [
  {
    // what IDM answers for a connector query: already percent-encoded
    name: 'a cookie that IDM has already percent-encoded',
    issued: ['fHwAAAAAAJiWlA%3D%3D%3A0', 'fHwAAAAAAJiWlQ%3D%3D%3A0'],
    inUrl: ['fHwAAAAAAJiWlA%3D%3D%3A0', 'fHwAAAAAAJiWlQ%3D%3D%3A0'],
    decoded: ['fHwAAAAAAJiWlA==:0', 'fHwAAAAAAJiWlQ==:0'],
    managedToo: false,
  },
  {
    // the same, from an encoder that writes lower-case hex digits: an escape is kept as it came
    name: 'a cookie that IDM has already percent-encoded with lower-case hex digits',
    issued: ['ab%3d%3d%3a0', 'cd%3d%3d%3a0'],
    inUrl: ['ab%3d%3d%3a0', 'cd%3d%3d%3a0'],
    decoded: ['ab==:0', 'cd==:0'],
    managedToo: false,
  },
  {
    name: 'a base64 cookie with +, / and =',
    issued: ['ab+10/cd==', 'xy+20/ef=='],
    inUrl: ['ab%2B10%2Fcd%3D%3D', 'xy%2B20%2Fef%3D%3D'],
    decoded: ['ab+10/cd==', 'xy+20/ef=='],
    managedToo: true,
  },
  {
    name: 'a cookie that would add a parameter to the request',
    issued: ['p2&_pageSize=1', 'p3&_queryFilter=false'],
    inUrl: ['p2%26_pageSize%3D1', 'p3%26_queryFilter%3Dfalse'],
    decoded: ['p2&_pageSize=1', 'p3&_queryFilter=false'],
    managedToo: true,
  },
  {
    name: 'a cookie with characters that a format string would read',
    issued: ['a%s%d', 'b%j%%'],
    inUrl: ['a%25s%25d', 'b%25j%25%25'],
    decoded: ['a%s%d', 'b%j%%'],
    managedToo: true,
  },
];

describe('a paged-results cookie in the URL of a query of IDM', () => {
  let server: http.Server;
  let host: string;
  let requests: string[];
  let current: (typeof COOKIE_CASES)[number];

  beforeAll(async () => {
    requests = [];
    server = http.createServer((request, response) => {
      requests.push(request.url ?? '');
      const params = new URL(request.url ?? '', 'http://127.0.0.1')
        .searchParams;
      const cookies = params.getAll('_pagedResultsCookie');
      // no cookie: the first page; one cookie that the server handed out: the page after it; anything else is unknown
      const position =
        cookies.length === 0
          ? 0
          : cookies.length === 1 && current.decoded.includes(cookies[0])
            ? current.decoded.indexOf(cookies[0]) + 1
            : -1;
      const items = [
        ['a0', 'a1'],
        ['b0', 'b1'],
        ['c0', 'c1'],
      ][position];
      response.writeHead(items ? 200 : 400, {
        'content-type': 'application/json',
      });
      response.end(
        JSON.stringify(
          items
            ? {
                result: items.map((_id) => ({ _id })),
                resultCount: items.length,
                pagedResultsCookie: current.issued[position] ?? null,
                totalPagedResultsPolicy: 'NONE',
                totalPagedResults: -1,
                remainingPagedResults: -1,
              }
            : { code: 400, message: 'unknown cookie' }
        )
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

  const capabilities = [
    {
      id: 'idm.system.querySystemObjects',
      namedArgs: {
        systemName: 'ldap',
        systemObjectType: 'account',
        filter: 'true',
      },
    },
    {
      id: 'idm.system.queryAllSystemObjectIds',
      namedArgs: { systemName: 'ldap', systemObjectType: 'account' },
    },
    {
      id: 'idm.managed.queryManagedObjects',
      namedArgs: { type: 'alpha_user' },
    },
  ];

  const cases = capabilities.flatMap((capability) =>
    COOKIE_CASES.filter(
      (cookieCase) =>
        cookieCase.managedToo || capability.id.startsWith('idm.system.')
    ).map((cookieCase) => ({ capability, cookieCase }))
  );

  test.each(cases)(
    'T20: $capability.id walks to the end with $cookieCase.name, and the cookie is in the request as the platform needs it',
    async ({ capability, cookieCase }) => {
      current = cookieCase;
      requests.length = 0;
      const runtime = runtimeFor(idmInstance(host));
      const read = (extra: Record<string, unknown> = {}) =>
        dispatch(runtime, capability.id, {
          namedArgs: capability.namedArgs,
          ...extra,
        });

      const walked = await walkPages(
        () => read(),
        (token) => read({ pageToken: token })
      );

      expect(walked.ids).toEqual(['a0', 'a1', 'b0', 'b1', 'c0', 'c1']);
      expect(walked.calls).toBe(3);
      expect(requests).toHaveLength(3);
      const rawCookie = (url: string) =>
        /[?&]_pagedResultsCookie=([^&]*)/.exec(url)?.[1];
      expect(rawCookie(requests[0])).toBeUndefined();
      expect(rawCookie(requests[1])).toBe(cookieCase.inUrl[0]);
      expect(rawCookie(requests[2])).toBe(cookieCase.inUrl[1]);
      // one cookie and nothing else added: the request has the parameters of the first one, plus the cookie
      const names = (url: string) =>
        [...new URL(url, 'http://127.0.0.1').searchParams.keys()].sort();
      expect(names(requests[1])).toEqual(
        [...names(requests[0]), '_pagedResultsCookie'].sort()
      );
    },
    30000
  );

  test.each([
    {
      method: 'querySystemObjects',
      call: (instance: ReturnType<typeof idmInstance>) =>
        instance.idm.system.querySystemObjects(
          'ldap',
          'account',
          'true',
          undefined,
          undefined,
          ''
        ),
    },
    {
      method: 'queryAllSystemObjectIds',
      call: (instance: ReturnType<typeof idmInstance>) =>
        instance.idm.system.queryAllSystemObjectIds(
          'ldap',
          'account',
          undefined,
          ''
        ),
    },
  ])(
    'T20e: $method sends no cookie parameter for an empty cookie',
    async ({ call }) => {
      current = COOKIE_CASES[1];
      requests.length = 0;

      const page = await call(idmInstance(host));

      expect(page.result).toHaveLength(2);
      expect(requests).toHaveLength(1);
      expect(requests[0]).not.toContain('_pagedResultsCookie');
    },
    30000
  );

  test('T20b: a cookie with a character that cannot be encoded is replaced, not thrown', async () => {
    current = {
      ...COOKIE_CASES[1],
      issued: ['q\ud800q', 'xy+20/ef=='],
      decoded: ['q�q', 'xy+20/ef=='],
    };
    requests.length = 0;
    const runtime = runtimeFor(idmInstance(host));

    const second = await dispatch(runtime, 'idm.system.querySystemObjects', {
      namedArgs: {
        systemName: 'ldap',
        systemObjectType: 'account',
        filter: 'true',
      },
      pageToken: 'q\ud800q',
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('_pagedResultsCookie=q%EF%BF%BDq');
    expect(second.returned).toBe(2);
  }, 30000);

  test('T20c: a cookie with a character outside the basic plane is encoded as one character', async () => {
    current = {
      ...COOKIE_CASES[1],
      issued: ['a\u{1F600}', 'xy+20/ef=='],
      decoded: ['a\u{1F600}', 'xy+20/ef=='],
    };
    requests.length = 0;
    const runtime = runtimeFor(idmInstance(host));

    const second = await dispatch(runtime, 'idm.system.querySystemObjects', {
      namedArgs: {
        systemName: 'ldap',
        systemObjectType: 'account',
        filter: 'true',
      },
      pageToken: 'a\u{1F600}',
    });

    expect(requests[0]).toContain('_pagedResultsCookie=a%F0%9F%98%80');
    expect(second.returned).toBe(2);
  }, 30000);
});

describe('the nextPageToken of the capabilities that the runtime reads', () => {
  test.each([
    {
      id: 'idm.system.querySystemObjects',
      namedArgs: {
        systemName: 'ldap',
        systemObjectType: 'account',
        filter: 'true',
      },
      cookieAt: 5,
    },
    {
      id: 'idm.system.queryAllSystemObjectIds',
      namedArgs: { systemName: 'ldap', systemObjectType: 'account' },
      cookieAt: 3,
    },
  ])(
    'T15b: $id: the token, passed back as pageToken, reads the next page and the end',
    async ({ id, namedArgs, cookieAt }) => {
      const method = jest.fn(async (...args: any[]) =>
        pagedAnswer(args[cookieAt])
      );
      const runtime = runtimeFor(rootWith(id, method));
      const read = (extra: Record<string, unknown> = {}) =>
        dispatch(runtime, id, { namedArgs, ...extra });

      const walked = await walkPages(
        () => read(),
        (token) => read({ pageToken: token })
      );

      expect(walked.ids).toEqual(['a0', 'a1', 'b0', 'b1', 'c0', 'c1']);
      expect(walked.calls).toBe(3);
      expect('nextPageToken' in walked.last).toBe(false);
      expect(method.mock.calls.map((call) => call[cookieAt])).toEqual([
        undefined,
        'cookie-2',
        'cookie-3',
      ]);
    }
  );
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

/** The warning of a self-capping search that stopped at its limit. */
const searchCapWarning = (limit: number, extra = '') =>
  `Result is not complete: the capability cloud.log.searchEvents stopped at or after its own limit of ${limit} items (argument maxEvents; it reads whole pages, so it can return more items than the limit, and returned says how many it returned), so more items may exist than it returned. Do not count or search only this result. Raise maxEvents or narrow the search to read more.${extra}`;

/** The warning of a search that removes duplicates after its limit and returned fewer events than the limit. */
const searchDedupeWarning = (limit: number, extra = '') =>
  `Result may be incomplete: the capability cloud.log.searchEvents stops at or after its own limit of ${limit} events (argument maxEvents; it reads whole pages, so it can return more events than the limit, and returned says how many it returned), counted before duplicate events are removed (argument dedupeByTransactionId, which is on unless you pass false), so a result can be incomplete even when it has fewer than maxEvents events. Do not count or search only this result, and do not use returned as a total. Pass dedupeByTransactionId: false to read a result that says whether the limit was reached.${extra}`;

describe('a search that stops at a limit of its own', () => {
  const searchEvents = (
    events: unknown[],
    namedArgs: Record<string, unknown> = {},
    paging: Record<string, unknown> = {}
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
        ...paging,
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
    expect(result.warning).toBe(searchCapWarning(1000));
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

  test('T14b: fewer events than the limit, without deduplication: complete', async () => {
    const result = await searchEvents(smallItems(999), {
      dedupeByTransactionId: false,
    });

    expect(result).toMatchObject({
      truncated: false,
      returned: 999,
      total: 999,
    });
    expect('warning' in result).toBe(false);
    expect(result.metadata?.pagination?.isPartial).toBe(false);
  });

  test('T14c: the limit is the one the caller sent', async () => {
    const noDedupe = { dedupeByTransactionId: false };
    const atTheLimit = await searchEvents(smallItems(50), {
      maxEvents: 50,
      ...noDedupe,
    });
    const belowTheLimit = await searchEvents(smallItems(49), {
      maxEvents: 50,
      ...noDedupe,
    });
    const aboveTheDefault = await searchEvents(smallItems(1000), {
      maxEvents: 5000,
      ...noDedupe,
    });

    expect(atTheLimit).toMatchObject({
      truncated: true,
      returned: 50,
      total: null,
    });
    expect(atTheLimit.warning).toBe(searchCapWarning(50));
    expect(belowTheLimit).toMatchObject({ truncated: false, total: 49 });
    expect(aboveTheDefault).toMatchObject({ truncated: false, total: 1000 });
  });

  test('T14d: no events is no cut, whatever the limit and the deduplication', async () => {
    for (const namedArgs of [
      { maxEvents: 0 },
      {},
      { dedupeByTransactionId: false },
    ]) {
      const result = await searchEvents([], namedArgs);

      expect(result).toMatchObject({ truncated: false, returned: 0, total: 0 });
      expect('warning' in result).toBe(false);
    }
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
      searchCapWarning(
        1000,
        ' The response was also cut: data holds 28 of the 1000 items that the capability returned. Pass pageOffset: 28 to read the rest of them.'
      )
    );
    expect(result.metadata?.pagination).toMatchObject({
      isPartial: true,
      hasMore: true,
      nextPageOffset: 28,
      returnedCount: 28,
    });
    expect('totalCount' in (result.metadata?.pagination ?? {})).toBe(false);
  });

  test('T14g: the limit is also read from a positional call', async () => {
    // the capability itself takes named arguments only: let a copy of its descriptor take both
    const descriptors = inventory.map((descriptor) =>
      descriptor.id === 'cloud.log.searchEvents'
        ? { ...descriptor, argumentMode: 'mixed' as const }
        : descriptor
    );
    const runtime = createToolRuntime(
      buildToolManifest(descriptors),
      descriptors,
      {} as any,
      {
        resolveFrodoForRequest: () =>
          rootWith(
            'cloud.log.searchEvents',
            jest.fn(async () => smallItems(50)),
            withLogApiCredential
          ) as any,
      }
    );

    const result = await dispatch(runtime, 'cloud.log.searchEvents', {
      positionalArgs: [
        'am-authentication',
        '2026-11-17T10:00:00Z',
        '2026-11-17T11:00:00Z',
        undefined,
        undefined,
        50,
      ],
    });

    expect(result).toMatchObject({
      truncated: true,
      returned: 50,
      total: null,
    });
    expect(result.warning).toBe(searchCapWarning(50));
  });

  test('T14h: the last page of an offset read of a search that stopped at its limit is still truncated, and the nested metadata has no total either', async () => {
    const result = await searchEvents(
      smallItems(1000),
      { dedupeByTransactionId: false },
      { pageOffset: 995, pageSize: 10 }
    );

    expect(result.data).toHaveLength(5);
    expect(result).toMatchObject({ truncated: true, returned: 5, total: null });
    expect('nextPageOffset' in result).toBe(false);
    expect(result.warning).toBe(searchCapWarning(1000));
    expect(result.metadata?.pagination).toMatchObject({
      isPartial: true,
      returnedCount: 5,
      warning: result.warning,
    });
    expect('totalCount' in (result.metadata?.pagination ?? {})).toBe(false);
  });

  test('T14f: a list that does not limit itself is complete at the same size', async () => {
    const result = await readJourneys(smallItems(1000));

    expect(result).toMatchObject({ truncated: false, total: 1000 });
  });
});

describe('a search that removes duplicate events after its limit', () => {
  const searchEvents = (
    events: unknown[],
    namedArgs: Record<string, unknown> = {},
    paging: Record<string, unknown> = {}
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
        ...paging,
      }
    );

  test('T17: with deduplication (the default) a count below the limit proves nothing: no truncated, no total, a warning that says why', async () => {
    const result = await searchEvents(smallItems(500));

    expect(result.data).toHaveLength(500);
    expect(Object.keys(result)).toEqual([
      'toolName',
      'descriptorId',
      'returned',
      'warning',
      'data',
      'metadata',
    ]);
    expect(result.returned).toBe(500);
    expect(result.warning).toBe(searchDedupeWarning(1000));
    expect(result.metadata?.pagination?.isPartial).toBe(false);
    expect(result.metadata?.pagination?.warning).toBe(result.warning);
    expect('totalCount' in (result.metadata?.pagination ?? {})).toBe(false);
  });

  test('T17b: the same when the caller asks for deduplication, and with the limit the caller sent', async () => {
    const asked = await searchEvents(smallItems(40), {
      dedupeByTransactionId: true,
      maxEvents: 50,
    });

    expect(asked.returned).toBe(40);
    expect('truncated' in asked).toBe(false);
    expect('total' in asked).toBe(false);
    expect(asked.warning).toBe(searchDedupeWarning(50));
  });

  test('T17c: without deduplication the count is the count of the search: below the limit it is complete', async () => {
    const result = await searchEvents(smallItems(500), {
      dedupeByTransactionId: false,
    });

    expect(result).toMatchObject({
      truncated: false,
      returned: 500,
      total: 500,
    });
    expect('warning' in result).toBe(false);
  });

  test('T17d: at the limit the result is truncated whatever the deduplication: duplicates are only removed, never added', async () => {
    const result = await searchEvents(smallItems(1000), {
      dedupeByTransactionId: true,
    });

    expect(result).toMatchObject({
      truncated: true,
      returned: 1000,
      total: null,
    });
    expect(result.warning).toBe(searchCapWarning(1000));
  });

  test('T17e: when the runtime cut the response too, that is known: truncated, an unknown total, the offset, and both warnings', async () => {
    const result = await searchEvents(items(500, 300));

    expect(result.returned).toBeLessThan(500);
    expect(result).toMatchObject({ truncated: true, total: null });
    expect(result.nextPageOffset).toBe(result.returned);
    expect(result.warning).toBe(
      searchDedupeWarning(
        1000,
        ` The response was also cut: data holds ${result.returned} of the 500 items that the capability returned. Pass pageOffset: ${result.nextPageOffset} to read the rest of them.`
      )
    );
    expect(result.metadata?.pagination).toMatchObject({
      isPartial: true,
      hasMore: true,
    });
    expect(result.metadata?.pagination?.warning).toBe(result.warning);
  });

  test('T17g: the warning of an uncertain result says not to count it, names the argument that makes the next result say more, and promises no certainty', async () => {
    const result = await searchEvents(smallItems(500));

    expect(result.warning).toContain('Do not count or search only this result');
    expect(result.warning).toContain('do not use returned as a total');
    expect(result.warning).toContain(
      'Pass dedupeByTransactionId: false to read a result that says whether the limit was reached.'
    );
    // a narrower window with deduplication on is just as uncertain, and a count below the limit proves nothing
    expect(result.warning).not.toMatch(/to be sure|certain|time window/i);
    expect(result.warning).not.toContain('compare returned');
  });

  test('T17h: the last page of an offset read of an uncertain result says nothing about a total, at the top and in the nested metadata, and keeps the warning in both', async () => {
    const result = await searchEvents(
      smallItems(500),
      {},
      { pageOffset: 495, pageSize: 10 }
    );

    expect(result.data).toHaveLength(5);
    expect(Object.keys(result)).toEqual([
      'toolName',
      'descriptorId',
      'returned',
      'warning',
      'data',
      'metadata',
    ]);
    expect(result.returned).toBe(5);
    expect(result.warning).toBe(searchDedupeWarning(1000));
    expect(result.metadata?.pagination).toMatchObject({
      isPartial: false,
      returnedCount: 5,
      warning: result.warning,
    });
    expect('totalCount' in (result.metadata?.pagination ?? {})).toBe(false);
  });

  test('T17i: a page in the middle of an offset read of an uncertain result is truncated with an unknown total, and the nested metadata has no total', async () => {
    const result = await searchEvents(
      smallItems(500),
      {},
      { pageOffset: 100, pageSize: 10 }
    );

    expect(result).toMatchObject({
      truncated: true,
      returned: 10,
      total: null,
      nextPageOffset: 110,
    });
    expect(result.metadata?.pagination).toMatchObject({
      isPartial: true,
      hasMore: true,
      returnedCount: 10,
    });
    expect('totalCount' in (result.metadata?.pagination ?? {})).toBe(false);
  });

  test('T17f: the limit and the deduplication that apply are the defaults of the descriptor, which is what the call gets', async () => {
    const shipped = inventory.find(
      (descriptor) => descriptor.id === 'cloud.log.searchEvents'
    )!;
    const defaultOf = (name: string) =>
      shipped.parameters?.find((parameter) => parameter.name === name)
        ?.defaultValue;
    expect(defaultOf('maxEvents')).toBe(1000);
    expect(defaultOf('dedupeByTransactionId')).toBe(true);

    // a descriptor with other defaults: the call gets them, and the result compares with them
    const descriptors = inventory.map((descriptor) =>
      descriptor.id === 'cloud.log.searchEvents'
        ? {
            ...descriptor,
            parameters: descriptor.parameters?.map((parameter) =>
              parameter.name === 'maxEvents'
                ? { ...parameter, defaultValue: 700 }
                : parameter.name === 'dedupeByTransactionId'
                  ? { ...parameter, defaultValue: false }
                  : parameter
            ),
          }
        : descriptor
    );
    let events = smallItems(700);
    const method = jest.fn(async (..._args: any[]) => events);
    const runtime = createToolRuntime(
      buildToolManifest(descriptors),
      descriptors,
      {} as any,
      {
        resolveFrodoForRequest: () =>
          rootWith(
            'cloud.log.searchEvents',
            method,
            withLogApiCredential
          ) as any,
      }
    );

    const result = await dispatch(runtime, 'cloud.log.searchEvents', {
      namedArgs: {
        source: 'am-authentication',
        startTs: '2026-11-17T10:00:00Z',
        endTs: '2026-11-17T11:00:00Z',
      },
    });

    // the arguments are source, startTs, endTs, eventNames, principal, maxEvents, dedupeByTransactionId
    expect(method.mock.calls[0][5]).toBe(700);
    expect(method.mock.calls[0][6]).toBe(false);
    expect(result).toMatchObject({
      truncated: true,
      returned: 700,
      total: null,
    });
    expect(result.warning).toBe(searchCapWarning(700));

    // below that limit, and with deduplication off by the default of the descriptor: complete
    events = smallItems(650);
    const below = await dispatch(runtime, 'cloud.log.searchEvents', {
      namedArgs: {
        source: 'am-authentication',
        startTs: '2026-11-17T10:00:00Z',
        endTs: '2026-11-17T11:00:00Z',
      },
    });

    expect(below).toMatchObject({
      truncated: false,
      returned: 650,
      total: 650,
    });
    expect('warning' in below).toBe(false);
  });
});

describe('the real search of events against a loopback Log API', () => {
  let server: http.Server;
  let host: string;
  let upstream = { pageSize: 500, events: 5000, pairs: false };
  let pagesServed = 0;

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      if (!request.url?.startsWith('/monitoring/logs?')) {
        response.writeHead(404);
        response.end('{}');
        return;
      }
      const start = pagesServed * upstream.pageSize;
      pagesServed += 1;
      const count = Math.max(
        0,
        Math.min(upstream.pageSize, upstream.events - start)
      );
      const result = Array.from({ length: count }, (_, index) => {
        const event = start + index;
        // small events, so that 1000 of them stay below the size budget of one response
        return {
          payload: {
            transactionId: `tx-${upstream.pairs ? Math.floor(event / 2) : event}`,
          },
        };
      });
      const more = start + count < upstream.events;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          result,
          resultCount: count,
          pagedResultsCookie: more ? 'MORE' : null,
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

  async function search(
    shape: Partial<typeof upstream>,
    namedArgs: Record<string, unknown> = {}
  ) {
    upstream = { pageSize: 500, events: 5000, pairs: false, ...shape };
    pagesServed = 0;
    const instance = FrodoLib({
      host,
      deploymentType: 'cloud',
      realm: 'alpha',
    });
    instance.state.setUseTokenCache(false);
    instance.state.setLogApiKey('key');
    instance.state.setLogApiSecret('secret');
    (instance.login as any).getTokens = async () => undefined;
    const result = await dispatch(
      runtimeFor(instance),
      'cloud.log.searchEvents',
      {
        namedArgs: {
          source: 'am-core',
          startTs: '2026-11-17T10:00:00Z',
          endTs: '2026-11-17T10:30:00Z',
          ...namedArgs,
        },
      }
    );
    return { result, pages: pagesServed };
  }

  test('T18: the default limit of the real search is the one the runtime compares with: 1000 events, then it stops', async () => {
    const { result, pages } = await search({});

    expect(pages).toBe(2);
    expect(result).toMatchObject({
      truncated: true,
      returned: 1000,
      total: null,
    });
    expect(result.warning).toBe(searchCapWarning(1000));
  }, 30000);

  test('T18b: events that share transaction ids: with deduplication the search stops at the limit and the result is not called complete', async () => {
    const { result, pages } = await search({ pairs: true });

    expect(pages).toBe(2);
    expect(result.returned).toBe(500);
    expect('truncated' in result).toBe(false);
    expect('total' in result).toBe(false);
    expect(result.warning).toBe(searchDedupeWarning(1000));
  }, 30000);

  test('T18c: the same search without deduplication shows that the limit was reached', async () => {
    const { result } = await search(
      { pairs: true },
      { dedupeByTransactionId: false }
    );

    expect(result).toMatchObject({
      truncated: true,
      returned: 1000,
      total: null,
    });
    expect(result.warning).toBe(searchCapWarning(1000));
  }, 30000);

  test('T18e: a limit below the size of a page: the search reads the whole page, returns more than the limit, and the warning says so', async () => {
    const { result, pages } = await search(
      { pageSize: 500 },
      { maxEvents: 100, dedupeByTransactionId: false }
    );

    expect(pages).toBe(1);
    expect(result.returned).toBe(500);
    expect(result).toMatchObject({ truncated: true, total: null });
    expect(result.warning).toBe(searchCapWarning(100));
    expect(result.warning).toContain(
      'it reads whole pages, so it can return more items than the limit, and returned says how many it returned'
    );
  }, 30000);

  test('T18d: a search that reads every event is complete without deduplication, and warns with it', async () => {
    const plain = await search(
      { events: 40 },
      { dedupeByTransactionId: false }
    );
    const deduped = await search({ events: 40 });

    expect(plain.result).toMatchObject({
      truncated: false,
      returned: 40,
      total: 40,
    });
    expect(deduped.result.returned).toBe(40);
    expect('truncated' in deduped.result).toBe(false);
    expect(deduped.result.warning).toBe(searchDedupeWarning(1000));
  }, 30000);
});

describe('a read that stops at a limit that it has no argument for', () => {
  const read = (id: string, list: unknown[], namedArgs?: object) =>
    dispatch(
      runtimeFor(
        rootWith(
          id,
          jest.fn(async () => list)
        )
      ),
      id,
      namedArgs ? { namedArgs } : {}
    );

  test('T16: role.readInternalRoles with as many roles as its one request holds is truncated, with an unknown total, and the warning names the capability to use', async () => {
    const result = await read('role.readInternalRoles', smallItems(1000));

    expect(result).toMatchObject({
      truncated: true,
      returned: 1000,
      total: null,
    });
    expect(result.warning).toBe(
      'Result is not complete: the capability role.readInternalRoles stopped at its own limit of 1000 items, so more items may exist than it returned. Do not count or search only this result. Use role.queryInternalRoles with a filter that matches fewer roles to read the rest.'
    );
    expect(result.metadata?.pagination?.isPartial).toBe(true);
  });

  test('T16b: role.readInternalRoles with fewer roles is complete', async () => {
    const result = await read('role.readInternalRoles', smallItems(999));

    expect(result).toMatchObject({
      truncated: false,
      returned: 999,
      total: 999,
    });
    expect('warning' in result).toBe(false);
  });

  test('T16c: role.queryInternalRoles is limited in the same way, tells the agent to narrow the filter, and says both when the response was cut too', async () => {
    const atTheLimit = await read('role.queryInternalRoles', smallItems(1000), {
      filter: 'true',
    });
    const alsoCut = await read('role.queryInternalRoles', items(1000, 300), {
      filter: 'true',
    });

    expect(atTheLimit).toMatchObject({
      truncated: true,
      returned: 1000,
      total: null,
    });
    expect(atTheLimit.warning).toBe(
      'Result is not complete: the capability role.queryInternalRoles stopped at its own limit of 1000 items, so more items may exist than it returned. Do not count or search only this result. Narrow the filter to read the rest.'
    );
    expect(alsoCut).toMatchObject({ truncated: true, total: null });
    expect(alsoCut.returned).toBeLessThan(1000);
    expect(alsoCut.warning).toContain(
      'the capability role.queryInternalRoles stopped at its own limit of 1000 items'
    );
    expect(alsoCut.warning).toContain(
      `data holds ${alsoCut.returned} of the 1000 items that the capability returned`
    );
    expect(alsoCut.warning).toContain(
      `Pass pageOffset: ${alsoCut.nextPageOffset} to read the rest of them.`
    );
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
    expect(payload.nextAction).toContain(
      '(execution.total is null when the number is not known)'
    );
    expect(payload.nextAction).toContain('read execution.warning');
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

describe('what frodo_find_skills may execute on its own', () => {
  test('T19: only a managed-object query, which hands out a token, is a recommended execution with an unknown total; no other capability whose total is unknown is', async () => {
    const cloudContext = {
      auth: { mode: 'state-config', config: { deploymentType: 'cloud' } },
    } as any;
    const runtime = runtimeFor(
      {},
      {
        managedObjectTypes: ['alpha_user', 'alpha_role'],
        managedObjectHydrationStatus: 'available',
      }
    );
    const recommended = new Set<string>();
    for (const descriptor of inventory.filter(
      (candidate) =>
        candidate.operationType === 'list' ||
        candidate.operationType === 'search'
    )) {
      for (const query of ['list alpha_user', 'list internal roles']) {
        const found = await runtime.executeTool({
          toolName: 'frodo_find_skills',
          arguments: {
            query,
            skillIdPrefix: descriptor.id,
            includeIncompatible: true,
            executeRecommended: false,
          },
          context: cloudContext,
        });
        const skillId = (
          found.data as {
            recommendedDispatch?: { arguments: { skillId?: string } };
          }
        ).recommendedDispatch?.arguments.skillId;
        if (skillId) {
          recommended.add(skillId);
        }
      }
    }

    expect([...recommended].sort()).toEqual([
      'idm.managed.queryManagedObjects',
      'idm.managed.readManagedObjects',
    ]);
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
    expect(description).toContain(
      'do not count it, and do not conclude that an item does not exist'
    );
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
      const listTool = manifest.genericTools.find(
        (candidate) => candidate.operationType === operationType
      );
      expect(listTool?.description).toContain('truncated, returned, total');
      expect(listTool?.description).toContain('pageOffset or pageToken');
    }
  });
});
