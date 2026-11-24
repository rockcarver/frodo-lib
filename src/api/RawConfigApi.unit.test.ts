import { jest } from '@jest/globals';

/**
 * Run tests
 *
 *        npm run test:only RawConfigApi.unit
 *
 * Unit tests for the raw config api layer. The HTTP layer (`BaseApi`) is
 * replaced by a fake that records which instance was asked for, with which
 * resource config and scopes, and the request that went through it; no
 * recording, no tenant. Hosts and credentials are made up.
 */

type Call = {
  generator: string;
  method: string;
  url: string;
  body?: any;
  resource?: { apiVersion?: string };
  requiredScopes?: string[];
};
const calls: Call[] = [];

const generate = (generator: string) => (config: any) => {
  const record = (method: string, url: string, body?: any) => {
    calls.push({
      generator,
      method,
      url,
      body,
      resource: config.resource,
      requiredScopes: config.requiredScopes,
    });
    return { data: { answer: `${generator} ${method}` } };
  };
  return {
    get: async (url: string) => record('GET', url),
    put: async (url: string, body: any) => record('PUT', url, body),
  };
};
jest.unstable_mockModule('./BaseApi', () => ({
  generateAmApi: generate('am'),
  generateAmAuthApi: generate('amAuth'),
  generateOauth2Api: generate('oauth2'),
  generateIdmApi: generate('idm'),
  generateIdmSystemApi: generate('idmSystem'),
  generateLogKeysApi: generate('logKeys'),
  generateLogApi: generate('log'),
  generateEnvApi: generate('env'),
  generateGovernanceApi: generate('governance'),
  generateWSFedApi: generate('wsFed'),
  generateReleaseApi: generate('release'),
}));

const api = await import('./RawConfigApi');
const { default: Constants } = await import('../shared/Constants');
const { default: State } = await import('../shared/State');

const HOST = 'https://openam-matrix.example.com/am';
const IDM_HOST = 'https://idm-matrix.example.com/openidm';
const DEFAULT_VERSION = 'protocol=2.0,resource=1.0';
const CUSTOM = { protocol: '2.1', resource: '3.0' };
const CUSTOM_VERSION = 'protocol=2.1,resource=3.0';

function newState({ host = HOST, idmHost = '' } = {}) {
  const state = State({});
  state.setHost(host);
  if (idmHost) state.setIdmHost(idmHost);
  return state;
}

beforeEach(() => {
  calls.length = 0;
});

type Row = {
  name: string;
  get: (args: any) => Promise<any>;
  put: (args: any) => Promise<any>;
  generator: string;
  /** the endpoint to pass in and the URL it ends up at on HOST */
  endpoint: string;
  url: string;
  /** the version header when the caller names none: undefined means no header */
  defaultVersion?: string;
  scopes?: string[];
};

const rows: Row[] = [
  {
    name: 'am',
    get: api.getRawAm,
    put: api.putRawAm,
    generator: 'am',
    endpoint: 'json/realms/root/realms/alpha/x',
    url: `${HOST}/json/realms/root/realms/alpha/x`,
    defaultVersion: DEFAULT_VERSION,
    scopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
  },
  {
    name: 'idm',
    get: api.getRawIdm,
    put: api.putRawIdm,
    generator: 'idm',
    endpoint: 'config/x',
    url: 'https://openam-matrix.example.com/openidm/config/x',
    scopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
  },
  {
    name: 'environment',
    get: api.getRawEnv,
    put: api.putRawEnv,
    generator: 'env',
    endpoint: 'variables/x',
    url: 'https://openam-matrix.example.com/environment/variables/x',
    defaultVersion: DEFAULT_VERSION,
    scopes: [],
  },
  {
    name: 'iga',
    get: api.getRawIga,
    put: api.putRawIga,
    generator: 'governance',
    endpoint: 'iga/governance/requestTypes/x',
    url: 'https://openam-matrix.example.com/iga/governance/requestTypes/x',
    defaultVersion: DEFAULT_VERSION,
    scopes: [Constants.AVAILABLE_SCOPES.IGAFullScope],
  },
  {
    name: 'keys',
    get: api.getRawKeys,
    put: api.putRawKeys,
    generator: 'logKeys',
    endpoint: 'keys/x',
    url: 'https://openam-matrix.example.com/keys/x',
  },
  {
    name: 'monitoring',
    get: api.getRawMonitoringLogs,
    put: api.putRawMonitoringLogs,
    generator: 'log',
    endpoint: 'monitoring/logs?source=am-core',
    url: 'https://openam-matrix.example.com/monitoring/logs?source=am-core',
  },
  {
    name: 'ws',
    get: api.getRawWs,
    put: api.putRawWs,
    generator: 'wsFed',
    endpoint: 'ws/admin/pf-admin-api/v1/x',
    url: 'https://openam-matrix.example.com/ws/admin/pf-admin-api/v1/x',
    scopes: [Constants.AVAILABLE_SCOPES.WSFedAdminScope],
  },
];

describe.each(rows)('the raw $name functions', (row) => {
  test('1: get asks the right instance for the right URL and returns the data', async () => {
    const data = await row.get({ endpoint: row.endpoint, state: newState() });
    expect(calls).toHaveLength(1);
    expect(calls[0].generator).toBe(row.generator);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(row.url);
    expect(calls[0].requiredScopes ?? []).toEqual(row.scopes ?? []);
    expect(data).toEqual({ answer: `${row.generator} GET` });
  });

  test('2: put asks the right instance for the right URL and sends the payload', async () => {
    const payload = { _id: 'x', value: 'sample' };
    const data = await row.put({
      endpoint: row.endpoint,
      payload,
      state: newState(),
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].generator).toBe(row.generator);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toBe(row.url);
    expect(calls[0].body).toEqual(payload);
    expect(calls[0].requiredScopes ?? []).toEqual(row.scopes ?? []);
    expect(data).toEqual({ answer: `${row.generator} PUT` });
  });

  test('3: without a version, sends the default one or none', async () => {
    await row.get({ endpoint: row.endpoint, state: newState() });
    await row.put({ endpoint: row.endpoint, payload: {}, state: newState() });
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.resource?.apiVersion).toBe(row.defaultVersion);
    }
  });

  test('4: with a version, sends it', async () => {
    await row.get({
      endpoint: row.endpoint,
      apiVersion: CUSTOM,
      state: newState(),
    });
    await row.put({
      endpoint: row.endpoint,
      payload: {},
      apiVersion: CUSTOM,
      state: newState(),
    });
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.resource?.apiVersion).toBe(CUSTOM_VERSION);
    }
  });
});

describe('the host of a raw URL', () => {
  const hostRoots = rows.filter((r) =>
    ['environment', 'iga', 'keys', 'monitoring', 'ws'].includes(r.name)
  );

  test.each(hostRoots)(
    '5: $name is built from the host alone, without its port and context ignored',
    async (row) => {
      const state = newState({
        host: 'https://openam-zion.example.com:8443/openam',
      });
      await row.get({ endpoint: row.endpoint, state });
      await row.put({ endpoint: row.endpoint, payload: {}, state });
      expect(calls.map((c) => c.url)).toEqual([
        row.url.replace(
          'openam-matrix.example.com',
          'openam-zion.example.com:8443'
        ),
        row.url.replace(
          'openam-matrix.example.com',
          'openam-zion.example.com:8443'
        ),
      ]);
    }
  );

  test('6: am is built from the host with its own context', async () => {
    for (const host of [
      'https://openam-zion.example.com:8443/am',
      'https://openam-zion.example.com:8443/openam',
    ]) {
      calls.length = 0;
      await api.getRawAm({ endpoint: 'json/x', state: newState({ host }) });
      await api.putRawAm({
        endpoint: 'json/x',
        payload: {},
        state: newState({ host }),
      });
      expect(calls.map((c) => c.url)).toEqual([
        `${host}/json/x`,
        `${host}/json/x`,
      ]);
    }
  });

  test('7: idm is built from the IDM host when there is one, and from the host root and /openidm otherwise', async () => {
    await api.getRawIdm({
      endpoint: 'config/x',
      state: newState({ idmHost: IDM_HOST }),
    });
    await api.putRawIdm({
      endpoint: 'config/x',
      payload: {},
      state: newState({ idmHost: IDM_HOST }),
    });
    await api.getRawIdm({ endpoint: 'config/x', state: newState() });
    await api.putRawIdm({
      endpoint: 'config/x',
      payload: {},
      state: newState(),
    });
    expect(calls.map((c) => c.url)).toEqual([
      `${IDM_HOST}/config/x`,
      `${IDM_HOST}/config/x`,
      'https://openam-matrix.example.com/openidm/config/x',
      'https://openam-matrix.example.com/openidm/config/x',
    ]);
  });
});

/**
 * A raw path is a path by design: whatever the caller puts in it ends up
 * after the host and a slash, so it cannot choose the host. The URL that the
 * request goes to is read back with the URL parser, as the HTTP client does.
 */
describe('a path that tries to leave the host', () => {
  const hostile = [
    'https://evil.example/x',
    '//evil.example/x',
    'a@evil.example/x',
    '@evil.example:443/x',
    'x/@evil.example:443/y',
    '..',
    '../../evil/x',
    '%2e%2e/x',
    '%2e%2e%2f%2e%2e%2fx',
    '\\evil.example\\x',
    '\\\\evil.example\\x',
    'x\nHost: evil.example',
    'x%0d%0aHost: evil.example',
    '?x=https://evil.example',
    '#@evil.example',
  ];
  const bases: [string, (endpoint: string) => Promise<any>[]][] = [
    [
      'am',
      (endpoint) => [
        api.getRawAm({ endpoint, state: newState() }),
        api.putRawAm({ endpoint, payload: {}, state: newState() }),
      ],
    ],
    [
      'idm',
      (endpoint) => [
        api.getRawIdm({ endpoint, state: newState() }),
        api.putRawIdm({ endpoint, payload: {}, state: newState() }),
      ],
    ],
    [
      'idm with an IDM host',
      (endpoint) => [
        api.getRawIdm({ endpoint, state: newState({ idmHost: IDM_HOST }) }),
        api.putRawIdm({
          endpoint,
          payload: {},
          state: newState({ idmHost: IDM_HOST }),
        }),
      ],
    ],
    ...rows
      .filter((r) =>
        ['environment', 'iga', 'keys', 'monitoring', 'ws'].includes(r.name)
      )
      .map((r): [string, (endpoint: string) => Promise<any>[]] => [
        r.name,
        (endpoint) => [
          r.get({ endpoint, state: newState() }),
          r.put({ endpoint, payload: {}, state: newState() }),
        ],
      ]),
  ];

  test.each(bases)(
    '8: %s keeps the host of the request',
    async (name, send) => {
      const expectedHost = name.startsWith('idm with')
        ? 'idm-matrix.example.com'
        : 'openam-matrix.example.com';
      for (const path of hostile) {
        calls.length = 0;
        await Promise.all(send(path));
        expect(calls).toHaveLength(2);
        for (const call of calls) {
          const url = new URL(call.url);
          expect({ path, host: url.host, protocol: url.protocol }).toEqual({
            path,
            host: expectedHost,
            protocol: 'https:',
          });
          expect({ path, user: url.username, password: url.password }).toEqual({
            path,
            user: '',
            password: '',
          });
        }
      }
    }
  );

  test('9: the URL is the host, a slash and the path, unchanged', async () => {
    await api.getRawIga({
      endpoint: '//evil.example/x',
      state: newState(),
    });
    await api.getRawKeys({
      endpoint: 'a@evil.example/x',
      state: newState(),
    });
    await api.getRawWs({
      endpoint: 'https://evil.example/x',
      state: newState(),
    });
    expect(calls.map((c) => c.url)).toEqual([
      'https://openam-matrix.example.com///evil.example/x',
      'https://openam-matrix.example.com/a@evil.example/x',
      'https://openam-matrix.example.com/https://evil.example/x',
    ]);
  });
});
