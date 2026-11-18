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
 * every capability is a fake that records its arguments.
 */
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

  test('fetch needs only the source and the time window', async () => {
    const { handler } = await dispatch('cloud.log.fetch', {
      namedArgs: window,
    });
    expect(handler.mock.calls[0]).toEqual([
      'am-core',
      '2026-11-17T10:00:00Z',
      '2026-11-17T10:05:00Z',
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

  test('the pageToken argument is the cookie of fetch', async () => {
    const { handler } = await dispatch('cloud.log.fetch', {
      namedArgs: window,
      pageToken: 'CK',
    });
    expect(handler.mock.calls[0][3]).toBe('CK');
  });

  test('a cookie in namedArgs wins over the pageToken argument', async () => {
    const { handler } = await dispatch('cloud.log.fetch', {
      namedArgs: { ...window, cookie: 'NAMED' },
      pageToken: 'CK',
    });
    expect(handler.mock.calls[0][3]).toBe('NAMED');
  });

  test('tail needs only the source', async () => {
    const { handler } = await dispatch('cloud.log.tail', {
      positionalArgs: ['am-core'],
    });
    expect(handler.mock.calls[0]).toEqual(['am-core']);
  });

  test('the pageToken argument is the cookie of tail', async () => {
    const { handler } = await dispatch('cloud.log.tail', {
      positionalArgs: ['am-core'],
      pageToken: 'CK',
    });
    expect(handler.mock.calls[0]).toEqual(['am-core', 'CK']);
  });

  test('a cookie in positionalArgs wins over the pageToken argument', async () => {
    const { handler } = await dispatch('cloud.log.tail', {
      positionalArgs: ['am-core', 'GIVEN'],
      pageToken: 'CK',
    });
    expect(handler.mock.calls[0]).toEqual(['am-core', 'GIVEN']);
  });

  test('a call without pageToken passes the positional arguments as given', async () => {
    const args = ['am-core', ''];
    const { handler } = await dispatch('cloud.log.tail', {
      positionalArgs: args,
    });
    expect(handler.mock.calls[0]).toEqual(['am-core', '']);
    expect(args).toEqual(['am-core', '']);
  });
});
