import { jest } from '@jest/globals';
import type { ConnectorServerReference } from './ConnectorOps';

/**
 * `findConnectorServerReferences` reads the two sources that can name a
 * connector server once, together, and joins the answer in memory: the server
 * clusters of the connector info provider configuration, and the connector
 * definitions (their host). Mocked unit test: the readers that ConnectorOps
 * imports are replaced one level above the requests, so the real readers (404
 * as none, only `provisioner.openicf/` ids are connectors) and the real joins
 * run. No recordings, no tenant.
 */

const MISSING = Symbol('missing');

const notFound = () =>
  Object.assign(new Error('Request failed with status code 404'), {
    response: { status: 404 },
  });
const serverError = (what: string) =>
  Object.assign(new Error(`${what} failed with status code 500`), {
    response: { status: 500 },
  });

type Tenant = {
  /** the `provisioner.openicf.connectorinfoprovider` configuration */
  connectorInfo: unknown;
  /** what the query of the `provisioner.openicf` configurations returns */
  connectors: unknown;
};

let tenant: Tenant = { connectorInfo: MISSING, connectors: [] };

function answer(value: unknown) {
  if (value === MISSING) throw notFound();
  if (value instanceof Error) throw value;
  return value;
}

const getConfigEntity = jest.fn(async (args?: any): Promise<any> => {
  if (args.entityId === 'provisioner.openicf.connectorinfoprovider') {
    return answer(tenant.connectorInfo);
  }
  throw new Error(`unexpected entity ${args.entityId}`);
});
const readConfigEntitiesByType = jest.fn(async (args?: any): Promise<any> => {
  if (args.type === 'provisioner.openicf') return answer(tenant.connectors);
  throw new Error(`unexpected type ${args.type}`);
});

const actualIdmConfigApi = await import('../api/IdmConfigApi');
const actualIdmConfigOps = await import('./IdmConfigOps');
jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  ...actualIdmConfigApi,
  getConfigEntity,
}));
jest.unstable_mockModule('./IdmConfigOps', () => ({
  ...actualIdmConfigOps,
  readConfigEntitiesByType,
}));

const { default: ConnectorOps, findConnectorServerReferences } =
  await import('./ConnectorOps');
const { FrodoError } = await import('./FrodoError');

const setRealm = jest.fn();
const state = {
  getDeploymentType: () => 'cloud',
  getRealm: () => 'alpha',
  setRealm,
  getDebugHandler: () => undefined,
} as any;
const connectors = ConnectorOps(state);

/** The dependency of every source, stated here on purpose and not read from the code. */
const EXPECTED_SOURCE_DEPENDENCY: Record<string, 'hard' | 'soft'> = {
  'server-cluster': 'soft',
  connector: 'hard',
};

const requestCount = () =>
  getConfigEntity.mock.calls.length +
  readConfigEntitiesByType.mock.calls.length;

const SERVER = 'zion-connector-server';

const find = async (name = SERVER) =>
  findConnectorServerReferences({ serverNames: name, state });

const infoOf = (...clusters: unknown[]) => ({
  _id: 'provisioner.openicf.connectorinfoprovider',
  remoteConnectorClients: [{ name: SERVER, enabled: true, useSSL: true }],
  remoteConnectorClientsGroups: clusters,
  remoteConnectorServers: [],
  remoteConnectorServersGroups: [],
});
const cluster = (name: string, ...servers: unknown[]) => ({
  name,
  algorithm: 'roundrobin',
  serversList: servers,
});
const connector = (name: string, host: unknown) => ({
  _id: `provisioner.openicf/${name}`,
  enabled: true,
  connectorRef: {
    connectorName: 'org.forgerock.openicf.connectors.csvfile.CSVFileConnector',
    connectorHostRef: host,
    systemType: 'provisioner.openicf',
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  tenant = { connectorInfo: MISSING, connectors: [] };
});

describe('the server clusters', () => {
  test('a cluster that lists the server is a soft reference, by the path of its list', async () => {
    tenant.connectorInfo = infoOf(
      cluster('matrix-cluster', { name: SERVER }, { name: 'other-server' }),
      cluster('elsewhere', { name: 'other-server' })
    );
    expect(await find()).toEqual([
      {
        source: 'server-cluster',
        dependency: 'soft',
        id: 'matrix-cluster',
        from: 'serversList',
      },
    ]);
  });

  test('a cluster that lists the server twice is one reference', async () => {
    tenant.connectorInfo = infoOf(
      cluster('matrix-cluster', { name: SERVER }, { name: SERVER })
    );
    expect(await find()).toHaveLength(1);
  });

  test('clusters are listed by name', async () => {
    tenant.connectorInfo = infoOf(
      cluster('b-cluster', { name: SERVER }),
      cluster('a-cluster', { name: SERVER })
    );
    expect((await find()).map(({ id }) => id)).toEqual([
      'a-cluster',
      'b-cluster',
    ]);
  });

  test.each([
    ['another server whose name starts with the same letters', `${SERVER}-2`],
    ['a longer name that ends with it', `x-${SERVER}`],
    ['a different case', SERVER.toUpperCase()],
    ['a blank around the name', ` ${SERVER}`],
  ])('%s is not a reference', async (_description, name) => {
    tenant.connectorInfo = infoOf(cluster('matrix-cluster', { name }));
    expect(await find()).toEqual([]);
  });

  test('malformed clusters and server entries are skipped', async () => {
    tenant.connectorInfo = infoOf(
      null,
      'a string',
      7,
      [{ name: SERVER }],
      // no name
      { serversList: [{ name: SERVER }] },
      { name: 7, serversList: [{ name: SERVER }] },
      // no list, or a list that is not a list
      { name: 'no-list' },
      { name: 'string-list', serversList: SERVER },
      { name: 'object-list', serversList: { name: SERVER } },
      // entries that do not name the server
      cluster('bad-entries', null, 'a string', SERVER, 7, { name: 7 }, {}),
      cluster('valid', { name: SERVER })
    );
    expect(await find()).toEqual([
      {
        source: 'server-cluster',
        dependency: 'soft',
        id: 'valid',
        from: 'serversList',
      },
    ]);
  });

  test.each([
    [
      'has no cluster list',
      { _id: 'provisioner.openicf.connectorinfoprovider' },
    ],
    [
      'has a cluster list that is not a list',
      { remoteConnectorClientsGroups: { name: 'x' } },
    ],
    [
      'holds only the servers of the platform as the client',
      {
        remoteConnectorServers: [{ name: SERVER }],
        remoteConnectorServersGroups: [
          cluster('platform-cluster', { name: SERVER }),
        ],
      },
    ],
    ['is not an object', 'provisioner.openicf.connectorinfoprovider'],
    ['is null', null],
    ['is a list', [cluster('matrix-cluster', { name: SERVER })]],
    ['is missing (404), as on a tenant that has none', MISSING],
  ])(
    'a connector info configuration that %s has no cluster that names the server',
    async (_description, connectorInfo) => {
      tenant.connectorInfo = connectorInfo;
      expect(await find()).toEqual([]);
    }
  );

  test('a server entry without a client id is nothing to read: the lookup only needs the names', async () => {
    tenant.connectorInfo = {
      _id: 'provisioner.openicf.connectorinfoprovider',
      remoteConnectorClients: [{ name: SERVER, enabled: true, useSSL: true }],
      remoteConnectorClientsGroups: [
        cluster('matrix-cluster', { name: SERVER }),
      ],
    };
    expect(await find()).toHaveLength(1);
  });
});

describe('the connectors', () => {
  test('a connector whose host is the server is a hard reference, by its name without the type prefix', async () => {
    tenant.connectors = [
      connector('csv', SERVER),
      connector('ldap', 'another-server'),
      connector('local', ''),
    ];
    expect(await find()).toEqual([
      {
        source: 'connector',
        dependency: 'hard',
        id: 'csv',
        from: 'connectorRef.connectorHostRef',
      },
    ]);
  });

  test('connectors are listed by name', async () => {
    tenant.connectors = [connector('b', SERVER), connector('a', SERVER)];
    expect((await find()).map(({ id }) => id)).toEqual(['a', 'b']);
  });

  test.each([
    ['another server whose name starts with the same letters', `${SERVER}-2`],
    ['a longer name that ends with it', `x-${SERVER}`],
    ['a different case', SERVER.toUpperCase()],
    ['a blank around the name', `${SERVER} `],
    ['the empty host of a local connector', ''],
    ['a number', 7],
    ['a list', [SERVER]],
    ['null', null],
    ['nothing', undefined],
  ])('a host of %s is not a reference', async (_description, host) => {
    tenant.connectors = [connector('near', host)];
    expect(await find()).toEqual([]);
  });

  test('a connector that names a server cluster that lists the server is not a holder of the server', async () => {
    tenant.connectorInfo = infoOf(cluster('matrix-cluster', { name: SERVER }));
    tenant.connectors = [connector('csv', 'matrix-cluster')];
    expect(await find()).toEqual([
      expect.objectContaining({ source: 'server-cluster' }),
    ]);
  });

  test('malformed connectors are skipped, and so are configurations that are not connectors', async () => {
    tenant.connectors = [
      'a string',
      7,
      { _id: 'provisioner.openicf/noRef' },
      { _id: 'provisioner.openicf/stringRef', connectorRef: SERVER },
      { _id: 7, connectorRef: { connectorHostRef: SERVER } },
      { connectorRef: { connectorHostRef: SERVER } },
      // the connector info provider and other configurations that only start with the type
      {
        _id: 'provisioner.openicf.connectorinfoprovider',
        connectorRef: { connectorHostRef: SERVER },
      },
      {
        _id: 'provisioner.openicf',
        connectorRef: { connectorHostRef: SERVER },
      },
      {
        _id: 'x.provisioner.openicf/outside',
        connectorRef: { connectorHostRef: SERVER },
      },
      connector('valid', SERVER),
    ];
    expect(await find()).toEqual([expect.objectContaining({ id: 'valid' })]);
  });

  test('an answer that is not a list of configurations is unreadable, not none', async () => {
    tenant.connectors = { not: 'a list' };
    await expect(find()).rejects.toThrow(
      `Error finding references to connector server ${SERVER}: Error reading connectors`
    );
  });
});

describe('the answer', () => {
  function everyHolder() {
    tenant.connectorInfo = infoOf(cluster('matrix-cluster', { name: SERVER }));
    tenant.connectors = [connector('csv', SERVER), connector('ldap', SERVER)];
  }

  test('is ordered by source (server clusters, connectors), then by id', async () => {
    everyHolder();
    expect((await find()).map(({ source, id }) => [source, id])).toEqual([
      ['server-cluster', 'matrix-cluster'],
      ['connector', 'csv'],
      ['connector', 'ldap'],
    ]);
  });

  test('gives every source the dependency that is stated here', async () => {
    everyHolder();
    const found = await find();
    expect(new Set(found.map(({ source }) => source))).toEqual(
      new Set(Object.keys(EXPECTED_SOURCE_DEPENDENCY))
    );
    for (const reference of found) {
      expect(reference.dependency).toBe(
        EXPECTED_SOURCE_DEPENDENCY[reference.source]
      );
    }
  });

  test('is empty when nothing names the server, and the server need not exist', async () => {
    everyHolder();
    expect(await find('does-not-exist')).toEqual([]);
  });

  test('is the same for a list of names as for each name alone', async () => {
    everyHolder();
    const { references, unreadable } = await findConnectorServerReferences({
      serverNames: [SERVER, 'does-not-exist'],
      state,
    });
    expect(unreadable).toEqual([]);
    expect(references).toEqual({
      [SERVER]: await find(SERVER),
      'does-not-exist': [],
    });
    expect(Object.keys(references)).toEqual([SERVER, 'does-not-exist']);
  });

  test('types: one name answers a list of references, a list of names answers an object', async () => {
    everyHolder();
    const single: ConnectorServerReference[] =
      await connectors.findConnectorServerReferences(SERVER);
    const batch: Record<string, ConnectorServerReference[]> = (
      await connectors.findConnectorServerReferences([SERVER])
    ).references;
    expect(Array.isArray(single)).toBe(true);
    expect(Array.isArray(batch)).toBe(false);
    expect(batch[SERVER]).toEqual(single);
    // @ts-expect-error a list of names does not answer a list of references
    const wrong: ConnectorServerReference[] =
      await connectors.findConnectorServerReferences([SERVER]);
    expect(Array.isArray(wrong)).toBe(false);
  });

  test('the facade answers like the function', async () => {
    everyHolder();
    expect(await connectors.findConnectorServerReferences(SERVER)).toEqual(
      await find()
    );
  });

  test('does not change the active realm', async () => {
    everyHolder();
    await find();
    expect(setRealm).not.toHaveBeenCalled();
  });
});

describe('the requests', () => {
  test.each([
    ['one name', [SERVER]],
    [
      'twenty-five names',
      Array.from({ length: 25 }, (_value, i) => `server-${i}`),
    ],
  ])('two requests for %s', async (_description, names) => {
    const answer = await findConnectorServerReferences({
      serverNames: names,
      state,
    });
    expect(answer.unreadable).toEqual([]);
    expect(Object.keys(answer.references)).toHaveLength(names.length);
    expect(getConfigEntity).toHaveBeenCalledTimes(1);
    expect(getConfigEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'provisioner.openicf.connectorinfoprovider',
      })
    );
    expect(readConfigEntitiesByType).toHaveBeenCalledTimes(1);
    expect(readConfigEntitiesByType).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'provisioner.openicf' })
    );
    expect(requestCount()).toBe(2);
  });

  test('one name costs the same two requests', async () => {
    await find();
    expect(requestCount()).toBe(2);
  });
});

describe('fail closed', () => {
  const failures: [string, string, string, (error: Error) => void][] = [
    [
      'the connector info configuration',
      'server clusters',
      'server-cluster',
      (e) => (tenant.connectorInfo = e),
    ],
    [
      'the connector definitions',
      'connectors',
      'connector',
      (e) => (tenant.connectors = e),
    ],
  ];

  test.each(failures)(
    'when %s cannot be read the single form fails with one error that names the source, and the other source was still read',
    async (_description, label, _source, fail) => {
      fail(serverError('the read'));
      const failure = find();
      await expect(failure).rejects.toBeInstanceOf(FrodoError);
      const error = await failure.catch((caught) => caught);
      expect(error.message).toBe(
        `Error finding references to connector server ${SERVER}: Error reading ${label}`
      );
      expect(error.originalErrors).toHaveLength(1);
      expect(error.originalErrors[0].message).toBe(`Error reading ${label}`);
      // both sources were attempted all the same
      expect(requestCount()).toBe(2);
    }
  );

  test('both sources unreadable are one error with one nested error each, in the order of the sources', async () => {
    tenant.connectorInfo = serverError('the connector info');
    tenant.connectors = serverError('the connectors');
    const error = await find().catch((caught) => caught);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      `Error finding references to connector server ${SERVER}: Error reading server clusters; Error reading connectors`
    );
    expect(error.originalErrors.map((nested: Error) => nested.message)).toEqual(
      ['Error reading server clusters', 'Error reading connectors']
    );
  });

  test('a source that is missing (404) is none and not a failure', async () => {
    tenant.connectorInfo = MISSING;
    await expect(find()).resolves.toEqual([]);
  });

  test.each(failures)(
    'when %s cannot be read a list of names answers with the rest and names the source',
    async (_description, _label, source, fail) => {
      tenant.connectorInfo = infoOf(
        cluster('matrix-cluster', { name: SERVER })
      );
      tenant.connectors = [connector('csv', SERVER)];
      fail(serverError('the read'));
      const answer = await findConnectorServerReferences({
        serverNames: [SERVER, 'other-server'],
        state,
      });
      expect(answer.unreadable).toEqual([source]);
      expect(Object.keys(answer.references)).toEqual([SERVER, 'other-server']);
      expect(
        answer.references[SERVER].map((reference) => reference.source)
      ).not.toContain(source);
      expect(answer.references[SERVER]).toHaveLength(1);
      expect(answer.references['other-server']).toEqual([]);
    }
  );

  test('a list of names names both sources when neither can be read', async () => {
    tenant.connectorInfo = serverError('the connector info');
    tenant.connectors = serverError('the connectors');
    await expect(
      findConnectorServerReferences({ serverNames: [SERVER], state })
    ).resolves.toEqual({
      references: { [SERVER]: [] },
      unreadable: ['server-cluster', 'connector'],
    });
  });
});

describe('the names', () => {
  test.each([[''], ['   '], ['\t\n']])(
    'the blank name %j is refused before anything is read',
    async (name) => {
      await expect(find(name)).rejects.toThrow(
        'Error finding references to a connector server: the connector server id is empty'
      );
      expect(requestCount()).toBe(0);
    }
  );

  test.each([[undefined], [null], [7], [{}], [true]])(
    'the name %p, which is not a string, is refused before anything is read',
    async (name) => {
      await expect(
        findConnectorServerReferences({ serverNames: name as any, state })
      ).rejects.toThrow(
        'Error finding references to a connector server: the connector server id is empty'
      );
      expect(requestCount()).toBe(0);
    }
  );

  test('an empty list answers an empty result and reads nothing', async () => {
    await expect(
      findConnectorServerReferences({ serverNames: [], state })
    ).resolves.toEqual({ references: {}, unreadable: [] });
    expect(requestCount()).toBe(0);
  });

  test.each([[''], ['  '], [undefined], [null], [7], [{}]])(
    'the element %p of a list is refused before anything is read, whatever else the list holds',
    async (element) => {
      await expect(
        findConnectorServerReferences({
          serverNames: [SERVER, element as any],
          state,
        })
      ).rejects.toThrow(
        'Error finding references to connector servers: an id in the list is empty or not a string'
      );
      expect(requestCount()).toBe(0);
    }
  );

  test('a name that is repeated is answered once', async () => {
    const answer = await findConnectorServerReferences({
      serverNames: [SERVER, 'other', SERVER, SERVER],
      state,
    });
    expect(Object.keys(answer.references)).toEqual([SERVER, 'other']);
    expect(requestCount()).toBe(2);
  });

  test('a name that is the name of an object property is a plain key', async () => {
    tenant.connectorInfo = infoOf(
      cluster('proto-cluster', { name: '__proto__' })
    );
    const answer = await findConnectorServerReferences({
      serverNames: ['__proto__', 'constructor'],
      state,
    });
    expect(Object.getPrototypeOf(answer.references)).toBeNull();
    expect(Object.keys(answer.references)).toEqual([
      '__proto__',
      'constructor',
    ]);
    expect(answer.references['__proto__']).toEqual([
      expect.objectContaining({ id: 'proto-cluster' }),
    ]);
    expect(answer.references['constructor']).toEqual([]);
  });
});
