/**
 * Run tests
 *
 *        npm run test:only ToolRuntime.itemResults
 *
 * The runtime passes a collecting result callback to a bulk function (frodo-lib#957).
 * An MCP caller cannot pass a function, and since a missing scope is a failed
 * item (frodo-lib#998) a bulk function without a callback throws at the first
 * failed item: a session with a scope-limited credential got one error instead
 * of the sections it can read. These tests pin what the tool result holds now:
 * the result of the function and, when an item failed, the failed items, in
 * sibling fields of `data`. A result without a failed item is what it was.
 * Unit test: no recordings, no tenant, a fake server on 127.0.0.1 for one case.
 */
import '../index';
import http from 'http';
import { AddressInfo } from 'net';
import { jest } from '@jest/globals';
import FrodoLib, { frodo } from '../lib/FrodoLib';
import { FrodoError } from '../ops/FrodoError';
import { InsufficientScopeError } from '../ops/RequiredScopesOps';
import { buildCapabilityInventory } from './CapabilityRegistry';
import { buildToolManifest } from './ToolManifest';
import { createToolRuntime, McpToolExecutionResult } from './ToolRuntime';

const inventory = buildCapabilityInventory(frodo, { includeUtils: false });
const manifest = buildToolManifest(inventory);

type Method = (...args: any[]) => unknown;

/** A root with the login the runtime asks for and one method at the path of the capability id. */
function rootWith(id: string, method: Method) {
  const root: any = { login: { getTokens: async () => undefined } };
  const path = id.split('.');
  let node = root;
  for (const segment of path.slice(0, -1)) {
    node = node[segment] = {};
  }
  node[path[path.length - 1]] = method;
  return root;
}

function runtimeFor(root: unknown) {
  return createToolRuntime(manifest, inventory, {} as any, {
    resolveFrodoForRequest: () => root as any,
  });
}

function dispatch(
  runtime: ReturnType<typeof runtimeFor>,
  skillId: string,
  args: Record<string, unknown> = {},
  toolName = 'frodo_dispatch'
): Promise<McpToolExecutionResult> {
  return runtime.executeTool({
    toolName,
    arguments: { skillId, ...args },
    context: { auth: { mode: 'state-config', config: {} } } as any,
  });
}

/** The error that `getResult` reports for a credential that lacks a scope. */
function scopeError(section: string): FrodoError {
  return new FrodoError(
    `Error Exporting ${section}`,
    new InsufficientScopeError(
      'This operation requires scope(s) [fr:iga:*], which the current session token does not carry (granted: [fr:idm:*]).',
      null,
      'INSUFFICIENT_SCOPE'
    ),
    'INSUFFICIENT_SCOPE'
  );
}

/** A method that reports to its result callback at `position`, then returns `returned`. */
function reporting(
  position: number,
  reports: (callback: (error?: unknown, result?: unknown) => void) => void,
  returned: unknown
) {
  return jest.fn(async (...args: any[]) => {
    reports(args[position]);
    return returned;
  });
}

describe('a bulk call through the MCP runtime', () => {
  test('1: no item failed: the tool result is exactly what it was, with no failure fields', async () => {
    const data = { script: { one: { name: 'One' }, two: { name: 'Two' } } };
    const method = reporting(
      1,
      (callback) => {
        callback(undefined, { name: 'One' });
        callback(undefined, { name: 'Two' });
      },
      data
    );
    const silent = jest.fn(async () => data);

    const result = await dispatch(
      runtimeFor(rootWith('script.exportScripts', method)),
      'script.exportScripts',
      { namedArgs: { options: {} } }
    );
    const withoutCallback = await dispatch(
      runtimeFor(rootWith('script.exportScripts', silent)),
      'script.exportScripts',
      { namedArgs: { options: {} } }
    );

    expect(result.data).toBe(data);
    expect(Object.keys(result).sort()).toEqual([
      'data',
      'descriptorId',
      'metadata',
      'toolName',
    ]);
    expect('partial' in result).toBe(false);
    expect('itemResults' in result).toBe(false);
    // a function that never reports gives the same tool result byte for byte
    expect(JSON.stringify(result)).toBe(JSON.stringify(withoutCallback));
  });

  test('2: one item failed: the result of the function and the failed item', async () => {
    const data = { script: { one: { name: 'One' } } };
    const method = reporting(
      1,
      (callback) => {
        callback(undefined, { name: 'One' });
        callback(scopeError('Secret Stores'));
        callback(undefined, { name: 'Three' });
      },
      data
    );

    const result = await dispatch(
      runtimeFor(rootWith('script.exportScripts', method)),
      'script.exportScripts',
      { namedArgs: { options: {} } }
    );

    expect(result.data).toBe(data);
    expect(result.partial).toBe(true);
    expect(result.itemResults).toMatchObject({
      succeededCount: 2,
      failedCount: 1,
      failures: [
        {
          code: 'INSUFFICIENT_SCOPE',
          item: 'Secret Stores',
          message: expect.stringContaining('requires scope(s) [fr:iga:*]'),
        },
      ],
    });
    expect(result.itemResults?.omittedFailureCount).toBeUndefined();
    expect(result.itemResults?.summary).toBe(
      '1 reported item failed and is missing from data; 2 succeeded. data holds the rest. Report the failures to the user.'
    );
    // the other fields are as before
    expect(result.metadata?.result?.topLevelType).toBe('object');
    expect(result.descriptorId).toBe('script.exportScripts');
  });

  test('3: every item failed: the partial result is empty and says so', async () => {
    const method = reporting(
      1,
      (callback) => {
        callback(scopeError('Workflows'));
        callback(scopeError('Events'));
        callback(scopeError('Request Types'));
      },
      {}
    );

    const result = await dispatch(
      runtimeFor(rootWith('script.exportScripts', method)),
      'script.exportScripts',
      { namedArgs: { options: {} } }
    );

    expect(result.data).toEqual({});
    expect(result.partial).toBe(true);
    expect(result.itemResults?.succeededCount).toBe(0);
    expect(result.itemResults?.failedCount).toBe(3);
    expect(result.itemResults?.failures.map((failure) => failure.item)).toEqual(
      ['Workflows', 'Events', 'Request Types']
    );
  });

  test('4: the failures keep the order they were reported in', async () => {
    const method = reporting(
      1,
      (callback) => {
        for (const name of ['C', 'A', 'B']) {
          callback(new FrodoError(`Error exporting script ${name}`));
        }
      },
      []
    );

    const result = await dispatch(
      runtimeFor(rootWith('script.exportScripts', method)),
      'script.exportScripts',
      { namedArgs: { options: {} } }
    );

    expect(
      result.itemResults?.failures.map((failure) => failure.message)
    ).toEqual([
      'Error exporting script C',
      'Error exporting script A',
      'Error exporting script B',
    ]);
  });

  test('5: the number of listed failures is capped and the rest is counted', async () => {
    const method = reporting(
      1,
      (callback) => {
        for (let i = 0; i < 80; i++) {
          callback(new FrodoError(`Error exporting script S${i}`));
        }
        callback(undefined, { name: 'fine' });
      },
      []
    );

    const result = await dispatch(
      runtimeFor(rootWith('script.exportScripts', method)),
      'script.exportScripts',
      { namedArgs: { options: {} } }
    );

    expect(result.itemResults?.failures).toHaveLength(50);
    expect(result.itemResults?.failedCount).toBe(80);
    expect(result.itemResults?.omittedFailureCount).toBe(30);
    expect(result.itemResults?.succeededCount).toBe(1);
    expect(result.itemResults?.summary).toContain('80 reported items failed');
    expect(result.itemResults?.summary).toContain('30 failures are not listed');
    expect(result.itemResults?.failures[49].message).toBe(
      'Error exporting script S49'
    );
  });

  test('6: a function that reports what cannot be read still returns its result', async () => {
    const hostile = Object.defineProperty(new FrodoError('x'), 'message', {
      get() {
        throw new Error('message getter');
      },
    });
    const method = reporting(
      1,
      (callback) => {
        callback(hostile);
        callback(Object.create(null));
        callback(Symbol('boom') as any);
        callback(new FrodoError('Error exporting script Fine'));
      },
      { script: {} }
    );

    const result = await dispatch(
      runtimeFor(rootWith('script.exportScripts', method)),
      'script.exportScripts',
      { namedArgs: { options: {} } }
    );

    expect(result.data).toEqual({ script: {} });
    expect(result.partial).toBe(true);
    expect(result.itemResults?.failedCount).toBe(4);
    expect(result.itemResults?.failures).toHaveLength(4);
  });

  test('7: a credential in an error is not in the tool result', async () => {
    const method = reporting(
      1,
      (callback) => {
        callback(
          new FrodoError(
            'Error exporting script Leaky',
            new Error('refused: Authorization: Bearer abcdefgh12345678ijkl')
          )
        );
      },
      []
    );

    const result = await dispatch(
      runtimeFor(rootWith('script.exportScripts', method)),
      'script.exportScripts',
      { namedArgs: { options: {} } }
    );

    expect(JSON.stringify(result)).not.toContain('abcdefgh12345678ijkl');
    expect(result.itemResults?.failures[0].message).toContain('<redacted>');
  });

  test('8: a call is its own: a failure of one call is not in the result of another, also a parallel one', async () => {
    let started = 0;
    const method = jest.fn(async (...args: any[]) => {
      const callback = args[1];
      // only the first call reports a failure
      if (started++ === 0) {
        callback(new FrodoError('Error exporting script Broken'));
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
      callback(undefined, { name: 'fine' });
      return [];
    });
    const runtime = runtimeFor(rootWith('script.exportScripts', method));
    const args = { namedArgs: { options: {} } };

    const [first, second] = await Promise.all([
      dispatch(runtime, 'script.exportScripts', args),
      dispatch(runtime, 'script.exportScripts', args),
    ]);
    const third = await dispatch(runtime, 'script.exportScripts', args);

    expect(first.itemResults?.failedCount).toBe(1);
    expect(first.itemResults?.succeededCount).toBe(1);
    expect(second.itemResults).toBeUndefined();
    expect('partial' in second).toBe(false);
    expect(third.itemResults).toBeUndefined();
  });
});

describe('where the callback is placed', () => {
  test('9: with named arguments the callback follows the arguments the caller sent', async () => {
    const method = jest.fn(async (..._args: any[]) => ({}));
    const options = { useStringArrays: true };

    await dispatch(
      runtimeFor(rootWith('script.exportScripts', method)),
      'script.exportScripts',
      { namedArgs: { options } }
    );

    expect(method).toHaveBeenCalledTimes(1);
    expect(method.mock.calls[0]).toHaveLength(2);
    expect(method.mock.calls[0][0]).toEqual(options);
    expect(typeof method.mock.calls[0][1]).toBe('function');
  });

  test('10: with positional arguments too, also when the caller sent fewer than the callback position', async () => {
    const method = jest.fn(async (..._args: any[]) => []);
    const runtime = runtimeFor(
      rootWith('authn.journey.importJourneys', method)
    );
    const importData = { trees: {} };

    await dispatch(runtime, 'authn.journey.importJourneys', {
      positionalArgs: [importData],
    });
    await dispatch(runtime, 'authn.journey.importJourneys', {
      positionalArgs: [importData, { reUuid: false }],
    });

    expect(method.mock.calls[0]).toHaveLength(3);
    expect(method.mock.calls[0].slice(0, 2)).toEqual([importData, undefined]);
    expect(typeof method.mock.calls[0][2]).toBe('function');
    expect(method.mock.calls[1].slice(0, 2)).toEqual([
      importData,
      { reUuid: false },
    ]);
    expect(typeof method.mock.calls[1][2]).toBe('function');
  });

  test('11: a function whose only parameter is the callback gets it at position 0, however the caller sent its arguments', async () => {
    const method = jest.fn(async (..._args: any[]) => []);
    const runtime = runtimeFor(rootWith('agent.deleteAgents', method));

    await dispatch(runtime, 'agent.deleteAgents', { positionalArgs: [] });
    await dispatch(runtime, 'agent.deleteAgents', { namedArgs: {} });
    await dispatch(runtime, 'agent.deleteAgents', {
      namedArgs: { anything: 1 },
    });

    for (const call of method.mock.calls) {
      expect(call).toHaveLength(1);
      expect(typeof call[0]).toBe('function');
    }
  });

  test('12: a callback that is not the last parameter keeps the other arguments where they are', async () => {
    // deleteScripts(resultCallback, filter)
    const method = jest.fn(async (..._args: any[]) => []);
    const filter = { name: 'old' };

    await dispatch(
      runtimeFor(rootWith('script.deleteScripts', method)),
      'script.deleteScripts',
      { namedArgs: { filter } }
    );

    expect(method.mock.calls[0]).toHaveLength(2);
    expect(typeof method.mock.calls[0][0]).toBe('function');
    expect(method.mock.calls[0][1]).toEqual(filter);
  });

  test('13: a caller cannot choose the callback: it is not a parameter of the capability', async () => {
    const descriptor = inventory.find(
      (it) => it.id === 'config.exportFullConfiguration'
    );
    // it used to be a required parameter that a named-argument call had to send
    expect((descriptor?.parameters ?? []).map((it) => it.name)).toEqual([
      'options',
    ]);

    const method = jest.fn(async (..._args: any[]) => ({}));
    const runtime = runtimeFor(
      rootWith('config.exportFullConfiguration', method)
    );

    await expect(
      dispatch(runtime, 'config.exportFullConfiguration', {
        namedArgs: { options: {}, resultCallback: 'x' },
      })
    ).rejects.toThrow(/does not accept named argument\(s\) resultCallback/);
    expect(method).not.toHaveBeenCalled();

    await dispatch(runtime, 'config.exportFullConfiguration', {
      namedArgs: { options: {} },
    });
    expect(method.mock.calls[0]).toHaveLength(2);
    expect(typeof method.mock.calls[0][1]).toBe('function');
  });

  test('14: whatever a JSON payload put at the position of the callback is replaced, a function a host passed in process is kept', async () => {
    const method = jest.fn(async (..._args: any[]) => ({}));
    const runtime = runtimeFor(rootWith('script.exportScripts', method));
    const own = jest.fn();

    await dispatch(runtime, 'script.exportScripts', {
      positionalArgs: [{}, null],
    });
    await dispatch(runtime, 'script.exportScripts', {
      positionalArgs: [{}, 'x'],
    });
    await dispatch(runtime, 'script.exportScripts', {
      positionalArgs: [{}, own],
    });

    expect(typeof method.mock.calls[0][1]).toBe('function');
    expect(method.mock.calls[0][1]).not.toBe(own);
    expect(typeof method.mock.calls[1][1]).toBe('function');
    expect(method.mock.calls[2][1]).toBe(own);
  });

  test("15: a callback of a host is the host's: nothing is collected from it", async () => {
    const method = jest.fn(async (...args: any[]) => {
      args[1](new FrodoError('Error exporting script Broken'));
      return [];
    });
    const own = jest.fn();

    const result = await dispatch(
      runtimeFor(rootWith('script.exportScripts', method)),
      'script.exportScripts',
      { positionalArgs: [{}, own] }
    );

    expect(own).toHaveBeenCalledTimes(1);
    expect(result.itemResults).toBeUndefined();
    expect('partial' in result).toBe(false);
  });
});

describe('what is not a bulk call with a callback', () => {
  test('16: a capability without a result callback gets the arguments it was sent and no extra one', async () => {
    const method = jest.fn(async (..._args: any[]) => ({ _id: 'Login' }));

    const result = await dispatch(
      runtimeFor(rootWith('authn.journey.readJourney', method)),
      'authn.journey.readJourney',
      { positionalArgs: ['Login'] },
      'frodo_dispatch_read_only'
    );

    expect(method.mock.calls[0]).toEqual(['Login']);
    expect(result.data).toEqual({ _id: 'Login' });
    expect('partial' in result).toBe(false);
    expect('itemResults' in result).toBe(false);
  });

  test('17: a function that throws still returns an error, as before, also after it reported failed items', async () => {
    const cause = new FrodoError('Error reading journeys');
    const method = jest.fn(async (...args: any[]) => {
      args[1](new FrodoError('Error exporting journey Broken'));
      throw cause;
    });

    const failure = await dispatch(
      runtimeFor(rootWith('authn.journey.exportJourneys', method)),
      'authn.journey.exportJourneys',
      { namedArgs: {} }
    ).catch((error) => error);

    expect(failure).toBeInstanceOf(FrodoError);
    expect(failure.message).toBe(
      "MCP runtime error: failed invoking 'authn.journey.exportJourneys' (authn.journey.exportJourneys)"
    );
    expect(failure.originalErrors[0]).toBe(cause);
    // the failed item reported before the error is not in the error
    expect(failure.getCombinedMessage()).not.toContain('Broken');
  });

  test('18: a function that fails before it reports anything (the list read) is an error', async () => {
    const method = jest.fn(async () => {
      throw new FrodoError('Error reading mappings');
    });

    await expect(
      dispatch(
        runtimeFor(rootWith('idm.mapping.deleteMappings', method)),
        'idm.mapping.deleteMappings',
        { namedArgs: {} }
      )
    ).rejects.toThrow(/failed invoking 'idm.mapping.deleteMappings'/);
  });
});

describe('write operations report their failed items the same way', () => {
  test('19: importJourneys: the journeys that failed are listed, the summary says they were not completed', async () => {
    const method = reporting(
      2,
      (callback) => {
        callback(
          new FrodoError(
            'Error importing the alpha realm journey Broken',
            new Error(
              "Entry node 'missing-entry' does not resolve to a graph node"
            )
          )
        );
        callback(
          new FrodoError(
            'Error importing the alpha realm journey Needy',
            new Error('Journey Needy requires Ghost, which is not installed')
          )
        );
        callback(undefined, { _id: 'Good' });
      },
      [{ _id: 'Good' }]
    );

    const result = await dispatch(
      runtimeFor(rootWith('authn.journey.importJourneys', method)),
      'authn.journey.importJourneys',
      { positionalArgs: [{ trees: {} }, {}] }
    );

    expect(result.data).toEqual([{ _id: 'Good' }]);
    expect(result.partial).toBe(true);
    expect(result.itemResults?.succeededCount).toBe(1);
    expect(result.itemResults?.failedCount).toBe(2);
    expect(result.itemResults?.failures.map((failure) => failure.item)).toEqual(
      ['alpha realm journey Broken', 'alpha realm journey Needy']
    );
    expect(result.itemResults?.failures[0].message).toContain(
      "Entry node 'missing-entry' does not resolve to a graph node"
    );
    expect(result.itemResults?.summary).toBe(
      '2 reported items failed and were not completed; 1 succeeded. data holds what the function returned for the others. Report the failures to the user.'
    );
  });

  test('20: a bulk delete: the items it could not delete are listed', async () => {
    const method = reporting(
      2,
      (callback) => {
        callback(undefined, { _id: 'a' });
        callback(new FrodoError('Error deleting mapping b'));
      },
      [{ _id: 'a' }]
    );

    const result = await dispatch(
      runtimeFor(rootWith('idm.mapping.deleteMappings', method)),
      'idm.mapping.deleteMappings',
      { namedArgs: { connectorId: 'ldap' } }
    );

    expect(method.mock.calls[0].slice(0, 2)).toEqual(['ldap', undefined]);
    expect(result.itemResults?.failures).toEqual([
      { message: 'Error deleting mapping b', item: 'mapping b' },
    ]);
    expect(result.partial).toBe(true);
    expect(result.itemResults?.summary).toBe(
      '1 reported item failed and was not completed; 1 succeeded. data holds what the function returned for the others. Report the failures to the user.'
    );
  });

  test('21: a read-only call (a list with a callback) reports through the read-only tool', async () => {
    const method = reporting(
      1,
      (callback) => {
        callback(undefined, { name: 'one' });
        callback(new FrodoError("Error reading service 'two'"));
      },
      [{ name: 'one' }]
    );

    const result = await dispatch(
      runtimeFor(rootWith('service.getFullServices', method)),
      'service.getFullServices',
      { positionalArgs: [] },
      'frodo_dispatch_read_only'
    );

    expect(method.mock.calls[0]).toHaveLength(2);
    expect(result.data).toEqual([{ name: 'one' }]);
    expect(result.partial).toBe(true);
    expect(result.itemResults?.failures[0]).toEqual({
      message: "Error reading service 'two'",
      item: 'service two',
    });
  });
});

describe('a full export with a credential that has no scope for some sections', () => {
  const options = {
    useStringArrays: true,
    noDecode: false,
    coords: true,
    includeDefault: false,
    includeActiveValues: true,
    target: '',
    includeReadOnly: false,
    onlyRealm: false,
    onlyGlobal: true,
    onlyCustom: false,
    includeStatic: false,
    includeDynamic: true,
  };
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
          result: [],
          resultCount: 0,
          pagedResultsCookie: null,
          totalPagedResults: 0,
          remainingPagedResults: 0,
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

  /** A cloud instance with IGA whose bearer token carries only the IDM scope. */
  function scopeLimitedInstance() {
    const instance = FrodoLib({
      host,
      deploymentType: 'cloud',
      realm: 'alpha',
    });
    instance.state.setIsIGA(true);
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

  test('22: without a callback the export throws at the first section the credential cannot read (the function, as it is)', async () => {
    requests.length = 0;
    await expect(
      scopeLimitedInstance().config.exportFullConfiguration(
        options,
        undefined as any
      )
    ).rejects.toThrow('Error Exporting Certification Templates');
  });

  test('23: through the MCP runtime: the readable sections and a failure with code INSUFFICIENT_SCOPE for every section without scope', async () => {
    requests.length = 0;
    const instance = scopeLimitedInstance();
    const runtime = createToolRuntime(manifest, inventory, {} as any, {
      resolveFrodoForRequest: () => instance,
    });

    const result = await dispatch(runtime, 'config.exportFullConfiguration', {
      namedArgs: { options },
    });

    // the section the credential can read is in data
    expect((result.data as any).global.internalRole).toEqual({});
    expect((result.data as any).meta.exportTool).toBe('frodo');
    expect(result.partial).toBe(true);
    expect(result.itemResults?.succeededCount).toBe(1);
    expect(result.itemResults?.failedCount).toBe(9);
    expect(result.itemResults?.failures.map((failure) => failure.item)).toEqual(
      [
        'Certification Templates',
        'Events',
        'Glossary Schemas',
        'Request Forms',
        'Request Types',
        'ESV Secrets',
        'Telemetry',
        'ESV Variables',
        'Workflows',
      ]
    );
    for (const failure of result.itemResults?.failures ?? []) {
      expect(failure.code).toBe('INSUFFICIENT_SCOPE');
      expect(failure.message).toContain(
        "which the current session's token does not carry"
      );
      expect(failure.message).not.toContain('demo-access-token');
      expect(failure.message).not.toMatch(/\n\s+at /);
    }
    // the request that no scope allowed was never sent
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('/openidm/internal/role');
  });

  test('24: with positional arguments, which a caller could always send, the result is the same', async () => {
    const instance = scopeLimitedInstance();
    const runtime = createToolRuntime(manifest, inventory, {} as any, {
      resolveFrodoForRequest: () => instance,
    });

    const result = await dispatch(runtime, 'config.exportFullConfiguration', {
      positionalArgs: [options],
    });

    expect((result.data as any).global.internalRole).toEqual({});
    expect(result.partial).toBe(true);
    expect(result.itemResults?.failedCount).toBe(9);
    expect(result.itemResults?.succeededCount).toBe(1);
  });
});
