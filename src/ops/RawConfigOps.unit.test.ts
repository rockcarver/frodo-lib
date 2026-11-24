import { jest } from '@jest/globals';

/**
 * Run tests
 *
 *        npm run test:only RawConfigOps.unit
 *
 * Unit tests for the raw config ops layer. The api layer (`RawConfigApi`) is
 * replaced by fakes that record which function was called with what; no
 * recording, no tenant. They pin which api function serves each root, with
 * which endpoint and version, what an unsupported root does, and what the
 * options `overrides`, `pushApiVersion` and `apiVersion` do. Hosts are made up.
 */

type Call = { fn: string; args: any };
const calls: Call[] = [];
let answer: (call: Call) => any = (call) => ({ answeredBy: call.fn });

const names = [
  'getRawAm',
  'getRawEnv',
  'getRawIdm',
  'getRawIga',
  'getRawKeys',
  'getRawMonitoringLogs',
  'getRawWs',
  'putRawAm',
  'putRawEnv',
  'putRawIdm',
  'putRawIga',
  'putRawKeys',
  'putRawMonitoringLogs',
  'putRawWs',
];
jest.unstable_mockModule(
  '../api/RawConfigApi',
  () =>
    Object.fromEntries(
      names.map((fn) => [
        fn,
        async (args: any) => {
          const call = { fn, args };
          calls.push(call);
          return answer(call);
        },
      ])
    ) as any
);

const RawConfigOps = await import('./RawConfigOps');
const { default: facade } = RawConfigOps;
const { default: State } = await import('../shared/State');

const CUSTOM = { protocol: '2.1', resource: '3.0' };
const FILE_VERSION = { protocol: '1.0', resource: '9.9' };

function newState(host = 'https://openam-matrix.example.com/am') {
  const state = State({});
  state.setHost(host);
  return state;
}

beforeEach(() => {
  calls.length = 0;
  answer = (call) => ({ answeredBy: call.fn });
});

/**
 * root, a path on it, the api function of each direction and the endpoint that
 * function gets: without the root for am, openidm and environment (the base
 * URL stands for it), the whole path for the roots at the root of the host.
 */
const roots = [
  {
    root: 'am',
    path: 'am/json/realms/root/realms/alpha/x',
    get: 'getRawAm',
    put: 'putRawAm',
    endpoint: 'json/realms/root/realms/alpha/x',
  },
  {
    root: 'openidm',
    path: 'openidm/config/x',
    get: 'getRawIdm',
    put: 'putRawIdm',
    endpoint: 'config/x',
  },
  {
    root: 'environment',
    path: 'environment/variables/x',
    get: 'getRawEnv',
    put: 'putRawEnv',
    endpoint: 'variables/x',
  },
  {
    root: 'iga',
    path: 'iga/governance/requestTypes/x',
    get: 'getRawIga',
    put: 'putRawIga',
    endpoint: 'iga/governance/requestTypes/x',
  },
  {
    root: 'keys',
    path: 'keys/x',
    get: 'getRawKeys',
    put: 'putRawKeys',
    endpoint: 'keys/x',
  },
  {
    root: 'monitoring',
    path: 'monitoring/logs?source=am-core',
    get: 'getRawMonitoringLogs',
    put: 'putRawMonitoringLogs',
    endpoint: 'monitoring/logs?source=am-core',
  },
  {
    root: 'ws',
    path: 'ws/admin/pf-admin-api/v1/x',
    get: 'getRawWs',
    put: 'putRawWs',
    endpoint: 'ws/admin/pf-admin-api/v1/x',
  },
];

describe.each(roots)('exportRawConfig on the $root root', (row) => {
  test('1: calls the api function of the root with its endpoint and returns the answer', async () => {
    const state = newState();
    const response = await RawConfigOps.exportRawConfig({
      options: { path: row.path },
      state,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe(row.get);
    expect(calls[0].args.endpoint).toBe(row.endpoint);
    expect(calls[0].args.state).toBe(state);
    expect(calls[0].args.apiVersion).toBeUndefined();
    expect(response).toEqual({ answeredBy: row.get });
  });

  test('2: takes a path with a leading slash as one without', async () => {
    await RawConfigOps.exportRawConfig({
      options: { path: `/${row.path}` },
      state: newState(),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe(row.get);
    expect(calls[0].args.endpoint).toBe(row.endpoint);
  });

  test('3: forwards the apiVersion option', async () => {
    await RawConfigOps.exportRawConfig({
      options: { path: row.path, apiVersion: CUSTOM },
      state: newState(),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].args.apiVersion).toEqual(CUSTOM);
  });

  test('4: merges the overrides into the answer', async () => {
    answer = () => ({ _id: 'x', keep: 'kept', nested: { a: 1, b: 2 } });
    const response = await RawConfigOps.exportRawConfig({
      options: {
        path: row.path,
        overrides: { _id: 'changed', nested: { b: 3 } },
      },
      state: newState(),
    });
    expect(response).toEqual({
      _id: 'changed',
      keep: 'kept',
      nested: { a: 1, b: 3 },
    });
  });

  test('5: adds the pushApiVersion to the answer of the am root only', async () => {
    answer = () => ({ _id: 'x' });
    const response = await RawConfigOps.exportRawConfig({
      options: { path: row.path, pushApiVersion: FILE_VERSION },
      state: newState(),
    });
    if (row.root === 'am') {
      expect(response).toEqual({ _id: 'x', _pushApiVersion: FILE_VERSION });
    } else {
      expect(response).toEqual({ _id: 'x' });
    }
    // it is a note for a later import, not the version of this request
    expect(calls[0].args.apiVersion).toBeUndefined();
  });
});

describe.each(roots)('importRawConfig on the $root root', (row) => {
  const data = { _id: 'x', value: 'sample' };

  test('1: calls the api function of the root with its endpoint and the data', async () => {
    const state = newState();
    const response = await RawConfigOps.importRawConfig({
      options: { path: row.path },
      data,
      state,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe(row.put);
    expect(calls[0].args.endpoint).toBe(row.endpoint);
    expect(calls[0].args.payload).toEqual(data);
    expect(calls[0].args.state).toBe(state);
    expect(calls[0].args.apiVersion).toBeUndefined();
    expect(response).toEqual({ answeredBy: row.put });
  });

  test('2: takes a path with a leading slash as one without', async () => {
    await RawConfigOps.importRawConfig({
      options: { path: `/${row.path}` },
      data,
      state: newState(),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe(row.put);
    expect(calls[0].args.endpoint).toBe(row.endpoint);
  });

  test('3: forwards the apiVersion option', async () => {
    await RawConfigOps.importRawConfig({
      options: { path: row.path, apiVersion: CUSTOM },
      data,
      state: newState(),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].args.apiVersion).toEqual(CUSTOM);
  });

  test('4: never sends the _pushApiVersion of the data as a property', async () => {
    await RawConfigOps.importRawConfig({
      options: { path: row.path },
      data: { ...data, _pushApiVersion: FILE_VERSION },
      state: newState(),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].args.payload).toEqual(data);
    expect(calls[0].args.payload._pushApiVersion).toBeUndefined();
  });

  test('5: takes the _pushApiVersion of the data as the version of the am and environment roots only', async () => {
    await RawConfigOps.importRawConfig({
      options: { path: row.path },
      data: { ...data, _pushApiVersion: FILE_VERSION },
      state: newState(),
    });
    expect(calls[0].args.apiVersion).toEqual(
      ['am', 'environment'].includes(row.root) ? FILE_VERSION : undefined
    );
  });

  test('6: an apiVersion option wins over the _pushApiVersion of the data', async () => {
    await RawConfigOps.importRawConfig({
      options: { path: row.path, apiVersion: CUSTOM },
      data: { ...data, _pushApiVersion: FILE_VERSION },
      state: newState(),
    });
    expect(calls[0].args.apiVersion).toEqual(CUSTOM);
  });
});

describe('a path with a root that is not supported', () => {
  // the path and the first segment that the refusal names, after one leading slash is removed
  const cases: [string, string][] = [
    ['unknown/x', 'unknown'],
    ['', ''],
    ['/', ''],
    ['AM/json/x', 'AM'],
    ['Iga/governance/x', 'Iga'],
    ['iga2/x', 'iga2'],
    ['https://evil.example/x', 'https:'],
    ['//evil.example/x', ''],
    ['a@evil-host/x', 'a@evil-host'],
    ['..', '..'],
    ['%2e%2e/openidm/config/x', '%2e%2e'],
    ['\\evil.example\\x', '\\evil.example\\x'],
    ['x\nopenidm/config/x', 'x\nopenidm'],
    // only one leading slash is removed: these are not the roots they end in
    ['//openidm/config/x', ''],
    ['//iga/x', ''],
    ['///am/x', ''],
  ];

  test.each(cases)(
    '1: export refuses %j, names %j and calls nothing',
    async (path, root) => {
      const error: any = await RawConfigOps.exportRawConfig({
        options: { path },
        state: newState(),
      }).catch((e) => e);
      expect(error.message).toBe(
        `Error in exportRawIdm with relative url: ${path}`
      );
      expect(error.getCombinedMessage()).toContain(
        `URL paths that start with ${root} are not supported`
      );
      expect(calls).toHaveLength(0);
    }
  );

  test.each(cases)(
    '2: import refuses %j, names %j and calls nothing',
    async (path, root) => {
      const error: any = await RawConfigOps.importRawConfig({
        options: { path },
        data: { _id: 'x' },
        state: newState(),
      }).catch((e) => e);
      expect(error.message).toBe(
        `Error in importRawConfig with relative url: ${path}`
      );
      expect(error.getCombinedMessage()).toContain(
        `URL paths that start with ${root} are not supported`
      );
      expect(calls).toHaveLength(0);
    }
  );
});

describe('the am root and the host', () => {
  const hosts = [
    'https://openam-matrix.example.com/am',
    'https://openam-matrix.example.com/openam',
    'https://openam-matrix.example.com:8443/auth',
    'https://openam-matrix.example.com',
    'https://openam-matrix.example.com/',
  ];

  test.each(hosts)(
    '1: %s: /am/... goes to the AM function with the endpoint that follows am',
    async (host) => {
      await RawConfigOps.exportRawConfig({
        options: { path: '/am/json/realms/root/x' },
        state: newState(host),
      });
      await RawConfigOps.importRawConfig({
        options: { path: '/am/json/realms/root/x' },
        data: { _id: 'x' },
        state: newState(host),
      });
      expect(calls.map((c) => [c.fn, c.args.endpoint])).toEqual([
        ['getRawAm', 'json/realms/root/x'],
        ['putRawAm', 'json/realms/root/x'],
      ]);
    }
  );

  test.each(hosts)(
    '2: %s: the name of the host context is no root of its own',
    async (host) => {
      const context = new URL(host).pathname.replace(/^\/|\/$/g, '');
      const hostName = new URL(host).host;
      for (const root of [context, hostName, '']) {
        if (root === 'am') continue;
        await expect(
          RawConfigOps.exportRawConfig({
            options: { path: `/${root}/json/realms/root/x` },
            state: newState(host),
          })
        ).rejects.toThrow('Error in exportRawIdm');
        await expect(
          RawConfigOps.importRawConfig({
            options: { path: `/${root}/json/realms/root/x` },
            data: { _id: 'x' },
            state: newState(host),
          })
        ).rejects.toThrow('Error in importRawConfig');
      }
      expect(calls).toHaveLength(0);
    }
  );
});

describe('the facade', () => {
  test('1: exportRawConfig(options) passes the options on and returns the answer', async () => {
    const state = newState();
    const response = await facade(state).exportRawConfig({
      path: '/iga/governance/requestTypes/x',
      apiVersion: CUSTOM,
      overrides: { extra: 'added' },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe('getRawIga');
    expect(calls[0].args).toEqual({
      endpoint: 'iga/governance/requestTypes/x',
      apiVersion: CUSTOM,
      state,
    });
    expect(response).toEqual({ answeredBy: 'getRawIga', extra: 'added' });
  });

  test('2: importRawConfig(options, data) passes both on and returns the answer', async () => {
    const state = newState();
    const response = await facade(state).importRawConfig(
      { path: '/ws/admin/pf-admin-api/v1/x', apiVersion: CUSTOM },
      { _id: 'x', value: 'sample' }
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe('putRawWs');
    expect(calls[0].args).toEqual({
      endpoint: 'ws/admin/pf-admin-api/v1/x',
      payload: { _id: 'x', value: 'sample' },
      apiVersion: CUSTOM,
      state,
    });
    expect(response).toEqual({ answeredBy: 'putRawWs' });
  });

  test('3: a failure of the api layer is wrapped and keeps its cause', async () => {
    answer = () => {
      throw new Error('sample failure');
    };
    const error: any = await facade(newState())
      .exportRawConfig({ path: '/keys/x' })
      .catch((e) => e);
    expect(error.message).toContain(
      'Error in exportRawIdm with relative url: /keys/x'
    );
    expect(error.getCombinedMessage()).toContain('sample failure');
  });
});
