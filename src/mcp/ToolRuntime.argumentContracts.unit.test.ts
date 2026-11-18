/**
 * Run tests
 *
 *        npm run test:only ToolRuntime.argumentContracts
 *
 * How the runtime turns the arguments of a dispatch call into the arguments of
 * the library method: named arguments are mapped by name to the positions of
 * the signature, a value that has an explicit schema is checked, and the
 * `pageToken` argument is the cookie of a capability that has no `pageToken`
 * parameter (frodo-cli#1373). No tenant and no recording: the method behind
 * every capability is a fake that records its arguments, except in the last
 * block, which reads the log capabilities page by page from a loopback server.
 */
import http from 'http';
import { AddressInfo } from 'net';
import { jest } from '@jest/globals';
import { frodo } from '../lib/FrodoLib';
import { createMcpService, type McpService } from './McpService';
import type { McpToolExecutionResult } from './ToolRuntime';

type Handler = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

/**
 * The capabilities whose TSDoc had no `@param` tags, with the parameter names
 * of their signature in declaration order. The order is written out here on
 * purpose: it is the independent source against which the position of every
 * named argument is proven.
 */
const REPAIRED_CAPABILITIES: Record<string, string[]> = {
  'admin.executeRfc7523AuthZGrantFlow': [
    'clientId',
    'iss',
    'jwk',
    'sub',
    'scope',
  ],
  'admin.generateRfc7523AuthZGrantArtefacts': [
    'clientId',
    'iss',
    'jwk',
    'sub',
    'scope',
    'options',
  ],
  'admin.generateRfc7523ClientAuthNArtefacts': [
    'clientId',
    'aud',
    'jwk',
    'options',
  ],
  'admin.trainAA': [
    'apiKey',
    'apiSecret',
    'customUsernames',
    'customUserAgents',
    'customIPs',
    'loginsPerUser',
    'service',
  ],
  'authz.policySet.createPolicySet': ['policySetData', 'policySetName'],
  'authz.policySet.deletePolicySet': ['policySetName'],
  'cloud.env.readServiceAccountScopes': ['flatten'],
  'idm.crypto.decrypt': ['value'],
  'idm.script.compileScript': ['script'],
  'idm.script.evaluateScript': ['script', 'globals'],
  'idm.system.readSystemStatus': ['systemName'],
  'oauth2oidc.endpoint.accessToken': ['amBaseUrl', 'data', 'config'],
  'oauth2oidc.endpoint.accessTokenRfc7523AuthZGrant': [
    'clientId',
    'jwt',
    'scope',
    'config',
  ],
  'oauth2oidc.endpoint.authorize': ['amBaseUrl', 'data', 'config'],
  'oauth2oidc.endpoint.clientCredentialsGrant': [
    'amBaseUrl',
    'clientId',
    'clientSecret',
    'scope',
  ],
  'oauth2oidc.endpoint.deviceAuthorizationRequest': [
    'amBaseUrl',
    'data',
    'config',
  ],
  'oauth2oidc.endpoint.getTokenInfo': ['amBaseUrl', 'config'],
};

/** Operation types that only `frodo_dispatch_read_only` accepts. */
const READ_ONLY_TYPES = ['count', 'read', 'search', 'list'];

let service: McpService;
let currentFake: unknown;

beforeAll(() => {
  service = createMcpService(frodo, {
    policyPreset: 'admin',
    inventoryOptions: { includeUtils: false },
    runtimeOptions: {
      // The scoped instance of every call is a fake that holds one handler.
      resolveFrodoForRequest: () => currentFake as never,
    },
  });
});

/**
 * Builds a fake Frodo instance that has one method, at the module path of the
 * capability, and the little of the rest that a dispatch looks at.
 */
function fakeInstance(id: string, handler: Handler): unknown {
  const path = id.split('.');
  const methodName = path.pop() as string;
  const root: Record<string, unknown> = {
    login: { getTokens: jest.fn(async () => undefined) },
    state: {
      getDeploymentType: () => 'cloud',
      getLogApiKey: () => 'key',
      getLogApiSecret: () => 'secret',
    },
  };
  let node = root;
  for (const segment of path) {
    node[segment] = (node[segment] as Record<string, unknown>) ?? {};
    node = node[segment] as Record<string, unknown>;
  }
  node[methodName] = handler;
  return root;
}

/**
 * Dispatches one capability against a recording fake.
 *
 * @returns the handler (to read its arguments) and the settled result
 */
async function dispatch(
  id: string,
  args: Record<string, unknown>
): Promise<{
  handler: Handler;
  result: McpToolExecutionResult;
}> {
  const handler: Handler = jest.fn(async () => ({ ok: true }));
  currentFake = fakeInstance(id, handler);
  const descriptor = service.capabilities.find(
    (capability) => capability.id === id
  );
  if (!descriptor) {
    throw new Error(`capability ${id} is not exposed`);
  }
  const result = await service.executeTool({
    toolName: READ_ONLY_TYPES.includes(descriptor.operationType)
      ? 'frodo_dispatch_read_only'
      : 'frodo_dispatch',
    arguments: { skillId: id, ...args },
    context: { auth: { mode: 'state-config', config: {} } },
  });
  return { handler, result };
}

/** A value of the type a parameter declares, distinct for every parameter. */
function sentinel(name: string, type: string | undefined): unknown {
  const lower = (type ?? '').toLowerCase();
  if (lower === 'boolean') return true;
  if (lower === 'number' || lower === 'integer') return 7;
  if (lower === 'string') return `value-of-${name}`;
  if (lower.endsWith('[]') || lower === 'array') return [`item-of-${name}`];
  return { marker: name };
}

describe('namedArgs of idm.script.evaluateScript', () => {
  test('a string script reaches the method as the first argument', async () => {
    const { handler } = await dispatch('idm.script.evaluateScript', {
      namedArgs: { script: '1+1' },
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]).toEqual(['1+1', undefined]);
  });

  test('globals reaches the method as the second argument', async () => {
    const { handler } = await dispatch('idm.script.evaluateScript', {
      namedArgs: { script: 'a + 1', globals: { a: 1 } },
    });
    expect(handler.mock.calls[0]).toEqual(['a + 1', { a: 1 }]);
  });

  test('a script that is an object is rejected before the method is called', async () => {
    const handler: Handler = jest.fn(async () => undefined);
    currentFake = fakeInstance('idm.script.evaluateScript', handler);
    await expect(
      service.executeTool({
        toolName: 'frodo_dispatch',
        arguments: {
          skillId: 'idm.script.evaluateScript',
          namedArgs: { script: { type: 'text/javascript', source: '1+1' } },
        },
        context: { auth: { mode: 'state-config', config: {} } },
      })
    ).rejects.toThrow(
      "received invalid value for named argument 'script': must be string"
    );
    expect(handler).not.toHaveBeenCalled();
  });

  test('a call without a script is rejected', async () => {
    await expect(
      dispatch('idm.script.evaluateScript', { namedArgs: { globals: {} } })
    ).rejects.toThrow('missing required named argument(s): script');
  });
});

describe('positionalArgs', () => {
  test('a string script still reaches the method as given', async () => {
    const { handler } = await dispatch('idm.script.evaluateScript', {
      positionalArgs: ['1+1'],
    });
    expect(handler.mock.calls[0]).toEqual(['1+1']);
  });

  test('an undefined for an optional parameter, from a host that calls in process, is not checked against its schema', async () => {
    const { handler } = await dispatch('idm.script.evaluateScript', {
      positionalArgs: ['1+1', undefined],
    });
    expect(handler.mock.calls[0]).toEqual(['1+1', undefined]);
  });

  test('a null for an optional parameter is not checked against its schema', async () => {
    const { handler } = await dispatch('idm.script.evaluateScript', {
      positionalArgs: ['1+1', null],
    });
    expect(handler.mock.calls[0]).toEqual(['1+1', null]);
  });

  test('a value that breaks an explicit schema is rejected before the method is called', async () => {
    const handler: Handler = jest.fn(async () => undefined);
    currentFake = fakeInstance('idm.script.evaluateScript', handler);
    await expect(
      service.executeTool({
        toolName: 'frodo_dispatch',
        arguments: {
          skillId: 'idm.script.evaluateScript',
          positionalArgs: [{ type: 'text/javascript', source: '1+1' }],
        },
        context: { auth: { mode: 'state-config', config: {} } },
      })
    ).rejects.toThrow(
      "received invalid value for positionalArgs[0] ('script'): must be string"
    );
    expect(handler).not.toHaveBeenCalled();
  });

  test.each([[0], [false], [{}], [['1+1']]])(
    'a script that is %p is rejected, falsy or not',
    async (script) => {
      const handler: Handler = jest.fn(async () => undefined);
      currentFake = fakeInstance('idm.script.evaluateScript', handler);
      await expect(
        service.executeTool({
          toolName: 'frodo_dispatch',
          arguments: {
            skillId: 'idm.script.evaluateScript',
            positionalArgs: [script],
          },
          context: { auth: { mode: 'state-config', config: {} } },
        })
      ).rejects.toThrow("positionalArgs[0] ('script')");
      expect(handler).not.toHaveBeenCalled();
    }
  );

  test.each([[['1+1']], [[]], [['']]])(
    'a pageToken does not change the positional arguments %p of a capability without a cookie parameter',
    async (positionalArgs) => {
      const { handler } = await dispatch('idm.script.evaluateScript', {
        positionalArgs,
        pageToken: 'CK',
      });
      expect(handler.mock.calls[0]).toEqual(positionalArgs);
      expect(handler.mock.calls[0]).toHaveLength(positionalArgs.length);
    }
  );

  test('a value is not checked against a parameter that has no explicit schema', async () => {
    // idm.system.readSystemStatus declares systemName: string through its
    // TSDoc only; a positional call keeps reaching the method unchecked.
    const { handler } = await dispatch('idm.system.readSystemStatus', {
      positionalArgs: [42],
    });
    expect(handler.mock.calls[0]).toEqual([42]);
  });
});

describe('every capability that had no parameter contract', () => {
  test.each(Object.entries(REPAIRED_CAPABILITIES))(
    '%s: namedArgs reach the method in the order of its signature',
    async (id, names) => {
      const descriptor = service.capabilities.find((c) => c.id === id);
      expect(descriptor).toBeDefined();
      const declared = [...(descriptor?.parameters ?? [])].sort(
        (left, right) => (left.position ?? 0) - (right.position ?? 0)
      );
      expect(declared.map(({ name }) => name)).toEqual(names);

      const values = declared.map(({ name, type }) => sentinel(name, type));
      const namedArgs = Object.fromEntries(
        declared.map(({ name }, index) => [name, values[index]])
      );

      const named = await dispatch(id, { namedArgs });
      expect(named.handler).toHaveBeenCalledTimes(1);
      // the same arguments, in the same positions, as a positional call
      const positional = await dispatch(id, { positionalArgs: values });
      expect(named.handler.mock.calls[0]).toEqual(values);
      expect(named.handler.mock.calls[0]).toEqual(
        positional.handler.mock.calls[0]
      );
    }
  );
});

describe('cloud.log.fetch and cloud.log.tail', () => {
  const window = {
    source: 'am-core',
    startTs: '2026-11-17T10:00:00Z',
    endTs: '2026-11-17T10:05:00Z',
  };
  const windowArgs = [
    'am-core',
    '2026-11-17T10:00:00Z',
    '2026-11-17T10:05:00Z',
  ];

  test('fetch needs only the source and the time window', async () => {
    const { handler } = await dispatch('cloud.log.fetch', {
      namedArgs: window,
    });
    expect(handler.mock.calls[0]).toEqual([
      ...windowArgs,
      undefined,
      undefined,
      undefined,
    ]);
  });

  test('fetch still accepts empty strings for the optional arguments', async () => {
    const { handler } = await dispatch('cloud.log.fetch', {
      namedArgs: { ...window, cookie: '', txid: '', filter: '' },
    });
    expect(handler.mock.calls[0].slice(3)).toEqual(['', '', '']);
  });

  test('fetch still needs the time window', async () => {
    await expect(
      dispatch('cloud.log.fetch', { namedArgs: { source: 'am-core' } })
    ).rejects.toThrow('missing required named argument(s): startTs, endTs');
  });

  // One rule for the cookie, named and positional: a cookie that the caller
  // gave (not undefined, null or an empty string) wins; a cookie that is left
  // out, null or empty is replaced by the pageToken argument; an empty
  // pageToken is no token.
  describe('the cookie of fetch, named', () => {
    test.each([
      ['no cookie, no token', {}, undefined, undefined],
      ['no cookie, token', {}, 'CK', 'CK'],
      ['empty cookie, token', { cookie: '' }, 'CK', 'CK'],
      ['null cookie, token', { cookie: null }, 'CK', 'CK'],
      ['given cookie, token', { cookie: 'NAMED' }, 'CK', 'NAMED'],
      ['given cookie, no token', { cookie: 'NAMED' }, undefined, 'NAMED'],
      ['no cookie, empty token', {}, '', undefined],
      ['empty cookie, empty token', { cookie: '' }, '', ''],
      ['null cookie, no token', { cookie: null }, undefined, null],
    ])('%s', async (_name, cookie, pageToken, expected) => {
      const { handler } = await dispatch('cloud.log.fetch', {
        namedArgs: { ...window, ...cookie },
        ...(pageToken === undefined ? {} : { pageToken }),
      });
      expect(handler.mock.calls[0]).toHaveLength(6);
      expect(handler.mock.calls[0][3]).toBe(expected);
    });
  });

  // txid and filter are optional strings like the cookie: undefined, null and
  // an empty string all mean left out, and a value that the caller gave is
  // passed on. A pageToken has no effect on them.
  describe.each([
    ['txid', 4],
    ['filter', 5],
  ])('%s of fetch, named', (name, index) => {
    test.each([
      ['not given', {}, undefined, undefined],
      ['undefined', { [name]: undefined }, undefined, undefined],
      ['null', { [name]: null }, undefined, null],
      ['empty', { [name]: '' }, undefined, ''],
      ['given', { [name]: 'GIVEN' }, undefined, 'GIVEN'],
      ['null, with a pageToken', { [name]: null }, 'CK', null],
      ['given, with a pageToken', { [name]: 'GIVEN' }, 'CK', 'GIVEN'],
    ])('%s', async (_cell, extra, pageToken, expected) => {
      const { handler } = await dispatch('cloud.log.fetch', {
        namedArgs: { ...window, ...extra },
        ...(pageToken === undefined ? {} : { pageToken }),
      });
      expect(handler.mock.calls[0]).toHaveLength(6);
      expect(handler.mock.calls[0][index]).toBe(expected);
    });
  });

  describe('what null and a wrong type are not for', () => {
    async function rejected(
      id: string,
      toolName: string,
      namedArgs: Record<string, unknown>
    ) {
      const handler: Handler = jest.fn(async () => undefined);
      currentFake = fakeInstance(id, handler);
      await expect(
        service.executeTool({
          toolName,
          arguments: { skillId: id, namedArgs },
          context: { auth: { mode: 'state-config', config: {} } },
        })
      ).rejects.toThrow('must be string');
      expect(handler).not.toHaveBeenCalled();
    }

    test('a required parameter of fetch does not take null', async () => {
      await rejected('cloud.log.fetch', 'frodo_dispatch_read_only', {
        ...window,
        startTs: null,
      });
      await rejected('cloud.log.fetch', 'frodo_dispatch_read_only', {
        ...window,
        source: null,
      });
    });

    test.each([['cookie'], ['txid'], ['filter']])(
      'the optional %s of fetch does not take a number or an object',
      async (name) => {
        await rejected('cloud.log.fetch', 'frodo_dispatch_read_only', {
          ...window,
          [name]: 5,
        });
        await rejected('cloud.log.fetch', 'frodo_dispatch_read_only', {
          ...window,
          [name]: {},
        });
      }
    );

    test('the script of evaluateScript and compileScript does not take null', async () => {
      await rejected('idm.script.evaluateScript', 'frodo_dispatch', {
        script: null,
      });
      await rejected('idm.script.compileScript', 'frodo_dispatch', {
        script: null,
      });
    });

    test('the optional globals of evaluateScript does not take null', async () => {
      const handler: Handler = jest.fn(async () => undefined);
      currentFake = fakeInstance('idm.script.evaluateScript', handler);
      await expect(
        service.executeTool({
          toolName: 'frodo_dispatch',
          arguments: {
            skillId: 'idm.script.evaluateScript',
            namedArgs: { script: '1+1', globals: null },
          },
          context: { auth: { mode: 'state-config', config: {} } },
        })
      ).rejects.toThrow("named argument 'globals'");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('the cookie of tail, positional', () => {
    test.each([
      ['no cookie, no token', ['am-core'], undefined, ['am-core']],
      ['no cookie, token', ['am-core'], 'CK', ['am-core', 'CK']],
      ['empty cookie, token', ['am-core', ''], 'CK', ['am-core', 'CK']],
      ['null cookie, token', ['am-core', null], 'CK', ['am-core', 'CK']],
      ['given cookie, token', ['am-core', 'GIVEN'], 'CK', ['am-core', 'GIVEN']],
      [
        'given cookie, no token',
        ['am-core', 'GIVEN'],
        undefined,
        ['am-core', 'GIVEN'],
      ],
      ['no cookie, empty token', ['am-core'], '', ['am-core']],
      ['empty cookie, empty token', ['am-core', ''], '', ['am-core', '']],
      [
        'null cookie, no token',
        ['am-core', null],
        undefined,
        ['am-core', null],
      ],
    ])('%s', async (_name, positionalArgs, pageToken, expected) => {
      const { handler } = await dispatch('cloud.log.tail', {
        positionalArgs,
        ...(pageToken === undefined ? {} : { pageToken }),
      });
      expect(handler.mock.calls[0]).toEqual(expected);
      expect(handler.mock.calls[0]).toHaveLength(expected.length);
    });

    test('no positional arguments and a token: the source stays empty, the token is the cookie', async () => {
      const { handler } = await dispatch('cloud.log.tail', {
        positionalArgs: [],
        pageToken: 'CK',
      });
      expect(handler.mock.calls[0]).toEqual([undefined, 'CK']);
      expect(handler.mock.calls[0]).toHaveLength(2);
    });

    test('the array of the caller is not changed when a token is applied', async () => {
      const positionalArgs = ['am-core', null];
      const { handler } = await dispatch('cloud.log.tail', {
        positionalArgs,
        pageToken: 'CK',
      });
      expect(handler.mock.calls[0]).toEqual(['am-core', 'CK']);
      expect(positionalArgs).toEqual(['am-core', null]);
    });

    test('the array of the caller is passed on as it is when there is no token', async () => {
      const positionalArgs = ['am-core', ''];
      await dispatch('cloud.log.tail', { positionalArgs });
      expect(positionalArgs).toEqual(['am-core', '']);
    });
  });
});

// The queries of IDM take their cursor as pageCookie. The pageToken argument
// fills it by the same rule as the cookie of the log reads: a cookie that the
// caller gave wins, a missing, null or empty one is replaced by the token.
describe('the pageCookie of a system query', () => {
  // the queries of IDM that take a pageCookie accept named arguments only
  test.each([
    ['named, no cookie, token', { pageCookie: undefined }, 'CK', 'CK'],
    ['named, empty cookie, token', { pageCookie: '' }, 'CK', 'CK'],
    ['named, given cookie, token', { pageCookie: 'GIVEN' }, 'CK', 'GIVEN'],
    ['named, empty cookie, empty token', { pageCookie: '' }, '', ''],
    ['named, no cookie, no token', {}, undefined, undefined],
  ])('%s', async (_cell, extra, pageToken, expected) => {
    const { handler } = await dispatch('idm.system.querySystemObjects', {
      namedArgs: {
        systemName: 'system',
        systemObjectType: 'object',
        filter: 'true',
        ...extra,
      },
      ...(pageToken === undefined ? {} : { pageToken }),
    });
    expect(handler.mock.calls[0]).toHaveLength(6);
    expect(handler.mock.calls[0][5]).toBe(expected);
  });
});

// The log reads with the completeness fields of a list result: a page that has
// a next page says so in nextPageToken, and that token, passed back as
// pageToken, reads the next page. The real library answers from a loopback
// server that stands in for the Log API; nothing else is faked.
describe('walking the pages of the log reads with nextPageToken', () => {
  /** Three pages of two events, each reachable through the cookie of the page before. */
  const PAGES: Record<string, { payloads: string[]; next: string | null }> = {
    first: { payloads: ['e0', 'e1'], next: 'cookie-2/+=' },
    'cookie-2/+=': { payloads: ['e2', 'e3'], next: 'cookie-3 %' },
    'cookie-3 %': { payloads: ['e4', 'e5'], next: null },
  };
  const window = {
    source: 'am-core',
    startTs: '2026-11-17T10:00:00Z',
    endTs: '2026-11-17T10:05:00Z',
  };
  let server: http.Server;
  let instance: ReturnType<typeof frodo.createInstance>;
  let requests: string[];

  beforeAll(async () => {
    requests = [];
    server = http.createServer((request, response) => {
      requests.push(`${request.method} ${request.url}`);
      const cookie = new URL(
        request.url ?? '',
        'http://127.0.0.1'
      ).searchParams.get('_pagedResultsCookie');
      const page = PAGES[cookie || 'first'] ?? { payloads: [], next: null };
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          result: page.payloads.map((payload) => ({
            payload,
            timestamp: '2026-11-17T10:00:00Z',
            type: 'text/plain',
            source: 'am-core',
          })),
          resultCount: page.payloads.length,
          pagedResultsCookie: page.next,
          totalPagedResultsPolicy: 'NONE',
          totalPagedResults: -1,
          remainingPagedResults: -1,
        })
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve())
    );
    instance = frodo.createInstance({
      host: `http://127.0.0.1:${(server.address() as AddressInfo).port}/am`,
      deploymentType: 'cloud',
      realm: 'alpha',
      logApiKey: 'key-id',
      logApiSecret: 'key-secret',
    });
    // the loopback server knows the log endpoints only: no login
    (
      instance.login as unknown as { getTokens: () => Promise<void> }
    ).getTokens = async () => undefined;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  /** One call through the real runtime, answered by the instance of this block. */
  async function read(id: string, args: Record<string, unknown>) {
    currentFake = instance;
    return service.executeTool({
      toolName: 'frodo_dispatch_read_only',
      arguments: { skillId: id, ...args },
      context: { auth: { mode: 'state-config', config: {} } },
    });
  }

  /** The payloads of the events of a page. */
  const payloadsOf = (result: McpToolExecutionResult) =>
    (result.data as { result: Array<{ payload: string }> }).result.map(
      ({ payload }) => payload
    );

  test('fetch: the token of each page, passed back as pageToken, reads the next page and the end', async () => {
    requests.length = 0;
    const payloads: string[] = [];
    const pages: McpToolExecutionResult[] = [];
    let result = await read('cloud.log.fetch', { namedArgs: window });
    // a bounded walk: a token that does not advance fails the test, it does not hang it
    for (let calls = 1; calls <= 5; calls++) {
      pages.push(result);
      payloads.push(...payloadsOf(result));
      if (result.nextPageToken === undefined) break;
      result = await read('cloud.log.fetch', {
        namedArgs: window,
        pageToken: result.nextPageToken,
      });
    }

    expect(payloads).toEqual(['e0', 'e1', 'e2', 'e3', 'e4', 'e5']);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toMatchObject({
      truncated: true,
      returned: 2,
      total: null,
      nextPageToken: 'cookie-2/+=',
    });
    expect(pages[2]).toMatchObject({ truncated: false, returned: 2 });
    expect('nextPageToken' in pages[2]).toBe(false);
    expect(requests).toHaveLength(3);
    expect(requests[0]).toContain('/monitoring/logs?source=am-core');
    expect(requests[0]).not.toContain('_pagedResultsCookie');
    expect(requests[1]).toContain(
      `_pagedResultsCookie=${encodeURIComponent('cookie-2/+=')}`
    );
    expect(requests[2]).toContain(
      `_pagedResultsCookie=${encodeURIComponent('cookie-3 %')}`
    );
  });

  test('tail: the token of each page, passed back as pageToken to a positional call, reads the next page and the end', async () => {
    requests.length = 0;
    const payloads: string[] = [];
    const pages: McpToolExecutionResult[] = [];
    let result = await read('cloud.log.tail', { positionalArgs: ['am-core'] });
    for (let calls = 1; calls <= 5; calls++) {
      pages.push(result);
      payloads.push(...payloadsOf(result));
      if (result.nextPageToken === undefined) break;
      result = await read('cloud.log.tail', {
        positionalArgs: ['am-core'],
        pageToken: result.nextPageToken,
      });
    }

    expect(payloads).toEqual(['e0', 'e1', 'e2', 'e3', 'e4', 'e5']);
    expect(pages).toHaveLength(3);
    // a live cursor is never complete: it has returned and nextPageToken, no truncated
    expect(pages[0]).toMatchObject({
      returned: 2,
      nextPageToken: 'cookie-2/+=',
    });
    expect('truncated' in pages[0]).toBe(false);
    expect(requests).toHaveLength(3);
    expect(requests[0]).toContain('/monitoring/logs/tail?source=am-core');
    expect(requests[1]).toContain(
      `_pagedResultsCookie=${encodeURIComponent('cookie-2/+=')}`
    );
  });

  test('fetch: a pageToken that the caller sends with an empty cookie reads the next page', async () => {
    requests.length = 0;
    const result = await read('cloud.log.fetch', {
      namedArgs: { ...window, cookie: '' },
      pageToken: 'cookie-2/+=',
    });
    expect(payloadsOf(result)).toEqual(['e2', 'e3']);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain(
      `_pagedResultsCookie=${encodeURIComponent('cookie-2/+=')}`
    );
  });
});
