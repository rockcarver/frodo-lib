import { jest } from '@jest/globals';
import type { ConnectorReference } from './ConnectorOps';

/**
 * `findConnectorReferences` reads every source that can name a connector
 * definition once, together, and joins the answer in memory: the mappings (the
 * `sync` configuration and the `mapping/` configurations), the applications of
 * every realm, the schedules and the login configuration. Mocked unit test:
 * the api layer is replaced, so the real readers (404 as none, all pages of a
 * type) and the real joins run. No recordings, no tenant.
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

const realm = (name: string) => ({
  _id: name === '/' ? 'root' : name,
  name,
  parentPath: name === '/' ? '' : '/',
  active: true,
  aliases: [],
});
const ROOT = realm('/');
const ALPHA = realm('alpha');
const BRAVO = realm('bravo');

type Tenant = {
  /** the `sync` configuration */
  sync: unknown;
  /** what the query of the `mapping` configurations returns */
  mappings: unknown;
  realms: unknown;
  /** per managed type: the pages of its records, or what the read fails with */
  applications: Record<string, unknown[][] | Error | typeof MISSING>;
  schedules: unknown;
  /** the `authentication` configuration */
  authentication: unknown;
};

function emptyTenant(): Tenant {
  return {
    sync: MISSING,
    mappings: [],
    realms: [ROOT, ALPHA, BRAVO],
    applications: {},
    schedules: [],
    authentication: MISSING,
  };
}

let tenant: Tenant = emptyTenant();

function answer(value: unknown) {
  if (value === MISSING) throw notFound();
  if (value instanceof Error) throw value;
  return value;
}

const getConfigEntity = jest.fn(async (args?: any): Promise<any> => {
  if (args.entityId === 'sync') return answer(tenant.sync);
  if (args.entityId === 'authentication') return answer(tenant.authentication);
  throw new Error(`unexpected entity ${args.entityId}`);
});
const readConfigEntitiesByType = jest.fn(async (args?: any): Promise<any> => {
  if (args.type === 'mapping') return answer(tenant.mappings);
  if (args.type === 'schedule') return answer(tenant.schedules);
  throw new Error(`unexpected type ${args.type}`);
});
const getRealms = jest.fn(async (_args?: any): Promise<any> =>
  answer(tenant.realms)
);
const queryAllManagedObjectsByType = jest.fn(
  async (args?: any): Promise<any> => {
    const pages = answer(tenant.applications[args.type] ?? [[]]) as unknown[][];
    const index = args.pageCookie ? Number(args.pageCookie) : 0;
    return {
      result: pages[index],
      pagedResultsCookie: index + 1 < pages.length ? String(index + 1) : null,
    };
  }
);

// The readers that ConnectorOps imports are replaced one level above the
// requests: the configuration reads, the realms and the page of managed
// objects. The real code runs on top: 404 as none, every page of a type, and
// the joins.
const actualIdmConfigApi = await import('../api/IdmConfigApi');
const actualIdmConfigOps = await import('./IdmConfigOps');
const actualRealmOps = await import('./RealmOps');
const actualManagedObjectApi = await import('../api/ManagedObjectApi');
jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  ...actualIdmConfigApi,
  getConfigEntity,
}));
jest.unstable_mockModule('./IdmConfigOps', () => ({
  ...actualIdmConfigOps,
  readConfigEntitiesByType,
}));
jest.unstable_mockModule('./RealmOps', () => ({
  ...actualRealmOps,
  getRealms,
}));
jest.unstable_mockModule('../api/ManagedObjectApi', () => ({
  ...actualManagedObjectApi,
  queryAllManagedObjectsByType,
}));

const { default: ConnectorOps, findConnectorReferences } =
  await import('./ConnectorOps');
const { FrodoError } = await import('./FrodoError');

let deploymentType = 'cloud';
let useRealmPrefix = false;
const setRealm = jest.fn();
const state = {
  getDeploymentType: () => deploymentType,
  getUseRealmPrefixOnManagedObjects: () => useRealmPrefix,
  getRealm: () => 'alpha',
  setRealm,
  getDebugHandler: () => undefined,
} as any;
const connectors = ConnectorOps(state);

/** The dependency of every source, stated here on purpose and not read from the code. */
const EXPECTED_SOURCE_DEPENDENCY: Record<string, 'hard' | 'soft'> = {
  mapping: 'hard',
  application: 'hard',
  schedule: 'hard',
  'authentication-module': 'hard',
};

/** Every request that was sent to the tenant. */
const requestCount = () =>
  getConfigEntity.mock.calls.length +
  readConfigEntitiesByType.mock.calls.length +
  getRealms.mock.calls.length +
  queryAllManagedObjectsByType.mock.calls.length;

const find = async (id = 'csv') =>
  findConnectorReferences({ connectorIds: id, state });

beforeEach(() => {
  jest.clearAllMocks();
  tenant = emptyTenant();
  deploymentType = 'cloud';
  useRealmPrefix = false;
});

describe('the mappings', () => {
  const syncOf = (...mappings: unknown[]) => ({ _id: 'sync', mappings });
  const mappingOf = (name: string, source: string, target: string) => ({
    _id: `mapping/${name}`,
    name,
    source,
    target,
  });

  test('a mapping in the sync configuration that names the connector in its source or target is a hard reference, one per field', async () => {
    tenant.sync = syncOf(
      {
        name: 'fromCsv',
        source: 'system/csv/account',
        target: 'managed/alpha_user',
      },
      {
        name: 'toCsv',
        source: 'managed/alpha_user',
        target: 'system/csv/account',
      },
      {
        name: 'csvToCsv',
        source: 'system/csv/account',
        target: 'system/csv/group',
      },
      {
        name: 'other',
        source: 'system/ldap/account',
        target: 'managed/alpha_user',
      }
    );
    expect(await find()).toEqual([
      {
        source: 'mapping',
        dependency: 'hard',
        id: 'sync/csvToCsv',
        name: 'csvToCsv',
        from: 'source',
      },
      {
        source: 'mapping',
        dependency: 'hard',
        id: 'sync/csvToCsv',
        name: 'csvToCsv',
        from: 'target',
      },
      {
        source: 'mapping',
        dependency: 'hard',
        id: 'sync/fromCsv',
        name: 'fromCsv',
        from: 'source',
      },
      {
        source: 'mapping',
        dependency: 'hard',
        id: 'sync/toCsv',
        name: 'toCsv',
        from: 'target',
      },
    ]);
  });

  test('a mapping configuration that names the connector is a reference under its configuration id', async () => {
    tenant.mappings = [
      mappingOf('newFrom', 'system/csv/account', 'managed/alpha_user'),
      mappingOf('newTo', 'managed/alpha_user', 'system/csv/account'),
      mappingOf('unrelated', 'managed/alpha_user', 'managed/bravo_user'),
    ];
    expect(await find()).toEqual([
      {
        source: 'mapping',
        dependency: 'hard',
        id: 'mapping/newFrom',
        name: 'newFrom',
        from: 'source',
      },
      {
        source: 'mapping',
        dependency: 'hard',
        id: 'mapping/newTo',
        name: 'newTo',
        from: 'target',
      },
    ]);
  });

  test.each([
    [
      'another connector whose id starts with the same letters',
      'system/csv2/account',
    ],
    ['a different case', 'system/CSV/account'],
    ['no path after the connector id', 'system/csv'],
    ['the id in the middle of the path', 'system/ldap/csv/account'],
    ['a prefix before system', 'x-system/csv/account'],
    ['a managed object', 'managed/csv/account'],
  ])('%s is not a reference', async (_description, value) => {
    tenant.sync = syncOf({
      name: 'near',
      source: value,
      target: 'managed/alpha_user',
    });
    tenant.mappings = [mappingOf('nearNew', 'managed/alpha_user', value)];
    expect(await find()).toEqual([]);
  });

  test('a mapping that is stored in both places is one reference per field, under the mapping configuration id', async () => {
    tenant.sync = syncOf(
      {
        name: 'both',
        source: 'system/csv/account',
        target: 'managed/alpha_user',
      },
      {
        name: 'bothTarget',
        source: 'managed/alpha_user',
        target: 'system/csv/account',
      }
    );
    tenant.mappings = [
      mappingOf('both', 'system/csv/account', 'managed/alpha_user'),
      mappingOf('bothTarget', 'managed/alpha_user', 'system/csv/account'),
    ];
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'mapping/both', from: 'source' }),
      expect.objectContaining({ id: 'mapping/bothTarget', from: 'target' }),
    ]);
  });

  test('a mapping that names the connector in a different field of each place is two references, each under the id of its place', async () => {
    tenant.sync = syncOf({
      name: 'split',
      source: 'system/csv/account',
      target: 'managed/alpha_user',
    });
    tenant.mappings = [
      mappingOf('split', 'managed/alpha_user', 'system/csv/account'),
    ];
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'mapping/split', from: 'target' }),
      expect.objectContaining({ id: 'sync/split', from: 'source' }),
    ]);
  });

  test('a mapping configuration only counts for the field where it holds a match: the other store keeps its own id', async () => {
    tenant.sync = syncOf({
      name: 'legacyMatch',
      source: 'system/csv/account',
      target: 'managed/alpha_user',
    });
    tenant.mappings = [
      mappingOf('legacyMatch', 'managed/alpha_user', 'managed/bravo_user'),
    ];
    expect(await find()).toEqual([
      {
        source: 'mapping',
        dependency: 'hard',
        id: 'sync/legacyMatch',
        name: 'legacyMatch',
        from: 'source',
      },
    ]);
  });

  test('a mapping configuration without a name takes its name from its id', async () => {
    tenant.mappings = [
      {
        _id: 'mapping/unnamed',
        source: 'system/csv/account',
        target: 'managed/alpha_user',
      },
    ];
    tenant.sync = syncOf({
      name: 'unnamed',
      source: 'system/csv/account',
      target: 'managed/alpha_user',
    });
    expect(await find()).toEqual([
      expect.objectContaining({
        id: 'mapping/unnamed',
        name: 'unnamed',
        from: 'source',
      }),
    ]);
  });

  test('malformed entries are skipped and do not fail the lookup', async () => {
    tenant.sync = syncOf(
      null,
      'a string',
      42,
      ['system/csv/account'],
      { name: 'numberSource', source: 7, target: 'managed/alpha_user' },
      {
        name: 'objectSource',
        source: { path: 'system/csv/account' },
        target: null,
      },
      { name: 'arraySource', source: ['system/csv/account'] },
      { source: 'system/csv/account', target: 'managed/alpha_user' },
      { name: 123, source: 'system/csv/account' },
      {
        name: 'valid',
        source: 'system/csv/account',
        target: 'managed/alpha_user',
      }
    );
    tenant.mappings = [
      null,
      'a string',
      { _id: 123, source: 'system/csv/account' },
      { source: 'system/csv/account' },
      { _id: 'mapping/numberTarget', source: 'managed/alpha_user', target: 9 },
      { _id: 'mappingNotAConfig/x', source: 'system/csv/account' },
      { _id: 'mapping', source: 'system/csv/account' },
    ];
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'sync/valid', from: 'source' }),
    ]);
  });

  test.each([
    ['has no mappings list', { _id: 'sync' }],
    [
      'has a mappings list that is not a list',
      { _id: 'sync', mappings: 'none' },
    ],
    ['is not an object', 'sync'],
    ['is null', null],
    ['is a list', [{ name: 'x', source: 'system/csv/account' }]],
    ['is missing (404)', MISSING],
  ])(
    'a sync configuration that %s has no mappings',
    async (_description, sync) => {
      tenant.sync = sync;
      tenant.mappings = [
        mappingOf('stillRead', 'system/csv/account', 'managed/alpha_user'),
      ];
      // the other store is still read
      expect(await find()).toEqual([
        expect.objectContaining({ id: 'mapping/stillRead' }),
      ]);
    }
  );

  test('a list of mapping configurations that is not a list is none', async () => {
    tenant.mappings = { not: 'a list' };
    tenant.sync = syncOf({
      name: 'valid',
      source: 'system/csv/account',
      target: 'managed/alpha_user',
    });
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'sync/valid' }),
    ]);
  });
});

describe('the applications', () => {
  const app = (id: string, name: string, connectorId: unknown) => ({
    _id: id,
    name,
    connectorId,
  });

  test('on Cloud the applications of every realm are read, the root realm is skipped and the active realm is not changed', async () => {
    tenant.applications = {
      alpha_application: [
        [app('a-1', 'Alpha CSV', 'csv'), app('a-2', 'Alpha LDAP', 'ldap')],
      ],
      bravo_application: [[app('b-1', 'Bravo CSV', 'csv')]],
    };
    expect(await find()).toEqual([
      {
        source: 'application',
        dependency: 'hard',
        id: 'a-1',
        name: 'Alpha CSV',
        realm: 'alpha',
        from: 'connectorId',
      },
      {
        source: 'application',
        dependency: 'hard',
        id: 'b-1',
        name: 'Bravo CSV',
        realm: 'bravo',
        from: 'connectorId',
      },
    ]);
    expect(
      queryAllManagedObjectsByType.mock.calls.map(([a]: any[]) => a.type)
    ).toEqual(['alpha_application', 'bravo_application']);
    expect(queryAllManagedObjectsByType.mock.calls[0][0]).toMatchObject({
      fields: ['name', 'connectorId'],
    });
    expect(setRealm).not.toHaveBeenCalled();
    expect(state.getRealm()).toBe('alpha');
  });

  test.each([
    ['another connector whose id starts with the same letters', 'csv2'],
    ['a different case', 'CSV'],
    ['a path', 'system/csv/'],
    ['a trailing blank', 'csv '],
    ['a number', 7],
    ['a list', ['csv']],
    ['null', null],
    ['nothing', undefined],
  ])(
    'a connectorId of %s is not a reference',
    async (_description, connectorId) => {
      tenant.applications = {
        alpha_application: [[app('a-1', 'Near miss', connectorId)]],
      };
      expect(await find()).toEqual([]);
    }
  );

  test('malformed records are skipped', async () => {
    tenant.applications = {
      alpha_application: [
        [
          null,
          'a string',
          42,
          { name: 'no id', connectorId: 'csv' },
          { _id: 7, name: 'numeric id', connectorId: 'csv' },
          { _id: 'a-ok', connectorId: 'csv' },
        ],
      ],
    };
    // a record without a name is reported without one
    expect(await find()).toEqual([
      {
        source: 'application',
        dependency: 'hard',
        id: 'a-ok',
        realm: 'alpha',
        from: 'connectorId',
      },
    ]);
  });

  test('every page of the applications of a realm is read', async () => {
    tenant.applications = {
      alpha_application: [
        [app('a-1', 'First page', 'ldap')],
        [app('a-2', 'Second page', 'csv')],
        [app('a-3', 'Third page', 'csv')],
      ],
    };
    expect((await find()).map((reference) => reference.id)).toEqual([
      'a-2',
      'a-3',
    ]);
    // three pages of alpha and one of bravo
    expect(queryAllManagedObjectsByType).toHaveBeenCalledTimes(4);
  });

  test('a type that the tenant does not have is none and does not hide the other realms', async () => {
    tenant.applications = {
      alpha_application: MISSING,
      bravo_application: [[app('b-1', 'Bravo CSV', 'csv')]],
    };
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'b-1', realm: 'bravo' }),
    ]);
  });

  test('on ForgeOps with realm prefixes the root realm has its own type', async () => {
    deploymentType = 'platform';
    useRealmPrefix = true;
    tenant.applications = {
      application: [[app('root-1', 'Root CSV', 'csv')]],
      alpha_application: [[app('a-1', 'Alpha CSV', 'csv')]],
      bravo_application: [[]],
    };
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'a-1', realm: 'alpha' }),
      expect.objectContaining({ id: 'root-1', realm: '/' }),
    ]);
    expect(
      queryAllManagedObjectsByType.mock.calls.map(([a]: any[]) => a.type)
    ).toEqual(['application', 'alpha_application', 'bravo_application']);
  });

  test('on ForgeOps without realm prefixes the one type is read once and the record says no realm', async () => {
    deploymentType = 'platform';
    useRealmPrefix = false;
    tenant.applications = {
      application: [[app('shared-1', 'Shared CSV', 'csv')]],
    };
    const references = await find();
    expect(references).toEqual([
      {
        source: 'application',
        dependency: 'hard',
        id: 'shared-1',
        name: 'Shared CSV',
        from: 'connectorId',
      },
    ]);
    expect(references[0]).not.toHaveProperty('realm');
    expect(queryAllManagedObjectsByType).toHaveBeenCalledTimes(1);
    expect(queryAllManagedObjectsByType.mock.calls[0][0]).toMatchObject({
      type: 'application',
    });
  });

  test('realms that the tenant does not list are none, and a malformed realm is skipped', async () => {
    tenant.realms = [null, { _id: 'x' }, ALPHA];
    tenant.applications = {
      alpha_application: [[app('a-1', 'Alpha CSV', 'csv')]],
    };
    expect(await find()).toEqual([expect.objectContaining({ id: 'a-1' })]);
    tenant.realms = 'no realms';
    expect(await find()).toEqual([]);
  });
});

describe('the schedules', () => {
  const schedule = (name: string, source: unknown) => ({
    _id: `schedule/${name}`,
    enabled: true,
    invokeService: 'provisioner',
    invokeContext: { action: 'liveSync', source },
  });

  test('a schedule whose invoke context source names the connector is a hard reference', async () => {
    tenant.schedules = [
      schedule('csvLiveSync', 'system/csv/account'),
      schedule('ldapLiveSync', 'system/ldap/account'),
    ];
    expect(await find()).toEqual([
      {
        source: 'schedule',
        dependency: 'hard',
        id: 'schedule/csvLiveSync',
        from: 'invokeContext.source',
      },
    ]);
  });

  test.each([
    [
      'another connector whose id starts with the same letters',
      'system/csv2/account',
    ],
    ['a different case', 'system/Csv/account'],
    ['no path after the connector id', 'system/csv'],
    ['a number', 7],
    ['a list', ['system/csv/account']],
    ['nothing', undefined],
  ])('a source of %s is not a reference', async (_description, value) => {
    tenant.schedules = [schedule('near', value)];
    expect(await find()).toEqual([]);
  });

  test('malformed schedules are skipped, and so are entries that only start with the word schedule', async () => {
    tenant.schedules = [
      null,
      'a string',
      { _id: 'schedule/noContext' },
      { _id: 'schedule/stringContext', invokeContext: 'system/csv/account' },
      { _id: 7, invokeContext: { source: 'system/csv/account' } },
      { invokeContext: { source: 'system/csv/account' } },
      {
        _id: 'scheduleExtra/notASchedule',
        invokeContext: { source: 'system/csv/account' },
      },
      schedule('valid', 'system/csv/account'),
    ];
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'schedule/valid' }),
    ]);
  });

  test('a list of schedules that is not a list is none', async () => {
    tenant.schedules = { not: 'a list' };
    expect(await find()).toEqual([]);
  });

  test('schedules are listed by id', async () => {
    tenant.schedules = [
      schedule('b', 'system/csv/account'),
      schedule('a', 'system/csv/account'),
    ];
    expect((await find()).map((reference) => reference.id)).toEqual([
      'schedule/a',
      'schedule/b',
    ]);
  });
});

describe('the authentication modules', () => {
  test('a module of the server authentication context is named by its own name, and the field is a path without list indexes', async () => {
    tenant.authentication = {
      _id: 'authentication',
      serverAuthContext: {
        authModules: [
          {
            name: 'PASSTHROUGH',
            enabled: true,
            properties: {
              queryOnResource: 'system/csv/account',
              passthroughAuth: 'system/ldap/account',
            },
          },
          {
            name: 'PASSTHROUGH2',
            properties: { passthroughAuth: 'system/csv/account' },
          },
        ],
      },
    };
    expect(await find()).toEqual([
      {
        source: 'authentication-module',
        dependency: 'hard',
        id: 'PASSTHROUGH',
        from: 'serverAuthContext.authModules.properties.queryOnResource',
      },
      {
        source: 'authentication-module',
        dependency: 'hard',
        id: 'PASSTHROUGH2',
        from: 'serverAuthContext.authModules.properties.passthroughAuth',
      },
    ]);
  });

  test('a value that no module owns is reported under the authentication configuration', async () => {
    tenant.authentication = {
      _id: 'authentication',
      rsFilter: {
        subjectMapping: [
          { queryOnResource: 'system/csv/account' },
          { queryOnResource: 'managed/user' },
        ],
      },
    };
    expect(await find()).toEqual([
      {
        source: 'authentication-module',
        dependency: 'hard',
        id: 'authentication',
        from: 'rsFilter.subjectMapping.queryOnResource',
      },
    ]);
  });

  test('the name of the nearest enclosing object that has one is the id', async () => {
    tenant.authentication = {
      _id: 'authentication',
      name: 'outer',
      serverAuthContext: {
        authModules: [
          {
            name: 'module',
            properties: {
              nested: { name: 'inner', queryOnResource: 'system/csv/account' },
              passthroughAuth: 'system/csv/account',
            },
          },
        ],
      },
    };
    const found = await find();
    expect(found.map(({ id, from }) => [id, from])).toEqual([
      [
        'inner',
        'serverAuthContext.authModules.properties.nested.queryOnResource',
      ],
      ['module', 'serverAuthContext.authModules.properties.passthroughAuth'],
    ]);
  });

  test('a name that is not a string or is empty does not name the module', async () => {
    tenant.authentication = {
      _id: 'authentication',
      authModules: [
        { name: 7, properties: { queryOnResource: 'system/csv/account' } },
        { name: '', properties: { passthroughAuth: 'system/csv/account' } },
      ],
    };
    expect((await find()).map(({ id }) => id)).toEqual([
      'authentication',
      'authentication',
    ]);
  });

  test('modules are listed by name, then by field', async () => {
    tenant.authentication = {
      _id: 'authentication',
      serverAuthContext: {
        authModules: [
          {
            name: 'zeta',
            properties: { queryOnResource: 'system/csv/account' },
          },
          {
            name: 'alpha',
            properties: {
              queryOnResource: 'system/csv/account',
              passthroughAuth: 'system/csv/account',
            },
          },
        ],
      },
    };
    expect(
      (await find()).map(({ id, from }) => [id, from.split('.').pop()])
    ).toEqual([
      ['alpha', 'passthroughAuth'],
      ['alpha', 'queryOnResource'],
      ['zeta', 'queryOnResource'],
    ]);
  });

  test('the whole entity is walked, whatever the level and the list', async () => {
    tenant.authentication = {
      _id: 'authentication',
      a: {
        b: {
          c: [[{ d: [{ name: 'deep', passthroughAuth: 'system/csv/x' }] }]],
        },
      },
    };
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'deep', from: 'a.b.c.d.passthroughAuth' }),
    ]);
  });

  test.each([
    [
      'another connector whose id starts with the same letters',
      'system/csv2/account',
    ],
    ['a different case', 'system/CSV/account'],
    ['no path after the connector id', 'system/csv'],
    ['a number', 7],
    ['a list', ['system/csv/account']],
    ['an object', { path: 'system/csv/account' }],
    ['null', null],
  ])('a value of %s is not a reference', async (_description, value) => {
    tenant.authentication = {
      _id: 'authentication',
      authModules: [
        {
          name: 'm',
          properties: { queryOnResource: value, passthroughAuth: value },
        },
      ],
    };
    expect(await find()).toEqual([]);
  });

  test('a property with another name is not a reference, whatever it holds', async () => {
    tenant.authentication = {
      _id: 'authentication',
      authModules: [
        { name: 'm', properties: { someOtherField: 'system/csv/account' } },
      ],
      queryOnResourceX: 'system/csv/account',
    };
    expect(await find()).toEqual([]);
  });

  test.each([
    ['is missing (404), as on a tenant that has none', MISSING],
    [
      'holds only the resource server filter',
      {
        _id: 'authentication',
        rsFilter: { subjectMapping: [{ queryOnResource: 'managed/user' }] },
      },
    ],
    ['is null', null],
    ['is a string', 'authentication'],
  ])(
    'an authentication configuration that %s has no modules that name the connector',
    async (_description, authentication) => {
      tenant.authentication = authentication;
      expect(await find()).toEqual([]);
    }
  );
});

describe('the answer', () => {
  function everyHolder() {
    tenant.sync = {
      _id: 'sync',
      mappings: [
        {
          name: 'zSync',
          source: 'system/csv/account',
          target: 'managed/alpha_user',
        },
        {
          name: 'aSync',
          source: 'system/csv/account',
          target: 'managed/alpha_user',
        },
      ],
    };
    tenant.mappings = [
      {
        _id: 'mapping/mNew',
        name: 'mNew',
        source: 'managed/alpha_user',
        target: 'system/csv/account',
      },
    ];
    tenant.applications = {
      alpha_application: [[{ _id: 'a-9', name: 'Nine', connectorId: 'csv' }]],
      bravo_application: [[{ _id: 'a-1', name: 'One', connectorId: 'csv' }]],
    };
    tenant.schedules = [
      {
        _id: 'schedule/sched',
        invokeContext: { source: 'system/csv/account' },
      },
    ];
    tenant.authentication = {
      _id: 'authentication',
      rsFilter: { subjectMapping: [{ queryOnResource: 'system/csv/account' }] },
    };
  }

  test('is ordered by source (mappings, applications, schedules, authentication modules), then by id', async () => {
    everyHolder();
    const found = await find();
    expect(found.map(({ source, id }) => [source, id])).toEqual([
      ['mapping', 'mapping/mNew'],
      ['mapping', 'sync/aSync'],
      ['mapping', 'sync/zSync'],
      ['application', 'a-1'],
      ['application', 'a-9'],
      ['schedule', 'schedule/sched'],
      ['authentication-module', 'authentication'],
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

  test('is empty when nothing names the connector, and the connector need not exist', async () => {
    everyHolder();
    expect(await find('does-not-exist')).toEqual([]);
  });

  test('is the same for a list of ids as for each id alone', async () => {
    everyHolder();
    const alone = {
      csv: await find('csv'),
      ldap: await find('ldap'),
    };
    const { references, unreadable } = await findConnectorReferences({
      connectorIds: ['csv', 'ldap'],
      state,
    });
    expect(unreadable).toEqual([]);
    expect(references).toEqual(alone);
    expect(Object.keys(references)).toEqual(['csv', 'ldap']);
  });

  test('types: one id answers a list of references, a list of ids answers an object', async () => {
    everyHolder();
    // The annotations and the ts-expect-error line are for the reader and the
    // editor: the test run does not type-check test files (the declared types
    // are checked where code uses them).
    const single: ConnectorReference[] =
      await connectors.findConnectorReferences('csv');
    const batch: Record<string, ConnectorReference[]> = (
      await connectors.findConnectorReferences(['csv'])
    ).references;
    expect(Array.isArray(single)).toBe(true);
    expect(Array.isArray(batch)).toBe(false);
    expect(batch.csv).toEqual(single);
    // @ts-expect-error a list of ids does not answer a list of references
    const wrong: ConnectorReference[] =
      await connectors.findConnectorReferences(['csv']);
    expect(Array.isArray(wrong)).toBe(false);
  });

  test('the facade answers like the function', async () => {
    everyHolder();
    expect(await connectors.findConnectorReferences('csv')).toEqual(
      await find('csv')
    );
  });
});

describe('the requests', () => {
  test.each([
    ['one id', ['csv']],
    [
      'twenty-five ids',
      Array.from({ length: 25 }, (_value, i) => `connector${i}`),
    ],
  ])(
    'seven requests on Cloud with two realms for %s',
    async (_description, ids) => {
      const answer = await findConnectorReferences({
        connectorIds: ids,
        state,
      });
      expect(answer.unreadable).toEqual([]);
      expect(Object.keys(answer.references)).toHaveLength(ids.length);
      expect(getConfigEntity).toHaveBeenCalledTimes(2);
      expect(readConfigEntitiesByType).toHaveBeenCalledTimes(2);
      expect(getRealms).toHaveBeenCalledTimes(1);
      expect(queryAllManagedObjectsByType).toHaveBeenCalledTimes(2);
      expect(requestCount()).toBe(7);
    }
  );

  test('one id costs the same seven requests', async () => {
    await find();
    expect(requestCount()).toBe(7);
  });

  test('a further realm adds one request', async () => {
    tenant.realms = [ROOT, ALPHA, BRAVO, realm('charlie')];
    await find();
    expect(requestCount()).toBe(8);
  });

  test('every request is a read of one of the sources', async () => {
    await find();
    expect(
      getConfigEntity.mock.calls.map(([a]: any[]) => a.entityId).sort()
    ).toEqual(['authentication', 'sync']);
    expect(
      readConfigEntitiesByType.mock.calls.map(([a]: any[]) => a.type).sort()
    ).toEqual(['mapping', 'schedule']);
  });
});

describe('fail closed', () => {
  const failures: [string, string, (error: Error) => void][] = [
    ['the sync configuration', 'mappings', (e) => (tenant.sync = e)],
    ['the mapping configurations', 'mappings', (e) => (tenant.mappings = e)],
    ['the realms', 'applications', (e) => (tenant.realms = e)],
    [
      'the applications of a realm',
      'applications',
      (e) => (tenant.applications = { alpha_application: e }),
    ],
    ['the schedules', 'schedules', (e) => (tenant.schedules = e)],
    [
      'the authentication configuration',
      'authentication modules',
      (e) => (tenant.authentication = e),
    ],
  ];

  test.each(failures)(
    'when %s cannot be read the single form fails with one error that names the source, and every other source was still read',
    async (_description, label, fail) => {
      fail(serverError('the read'));
      const failure = find();
      await expect(failure).rejects.toBeInstanceOf(FrodoError);
      const error = await failure.catch((caught) => caught);
      expect(error.message).toBe(
        `Error finding references to connector csv: Error reading ${label}`
      );
      expect(error.originalErrors).toHaveLength(1);
      expect(error.originalErrors[0].message).toBe(`Error reading ${label}`);
      // the sources that could be read were attempted all the same
      expect(getConfigEntity).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: 'authentication' })
      );
      expect(readConfigEntitiesByType).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'schedule' })
      );
    }
  );

  test('a failed read of one application type fails the sources of the applications, not the realms that were read', async () => {
    tenant.applications = {
      bravo_application: serverError('the read'),
      alpha_application: [[{ _id: 'a-1', name: 'One', connectorId: 'csv' }]],
    };
    const error = await find().catch((caught) => caught);
    expect(error.message).toBe(
      'Error finding references to connector csv: Error reading applications'
    );
    // no partial list
    expect(error.originalErrors).toHaveLength(1);
  });

  test('several unreadable sources are one error with one nested error each, in the order of the sources', async () => {
    tenant.mappings = serverError('mappings');
    tenant.schedules = serverError('schedules');
    tenant.authentication = serverError('authentication');
    const error = await find().catch((caught) => caught);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      'Error finding references to connector csv: Error reading mappings; Error reading schedules; Error reading authentication modules'
    );
    expect(error.originalErrors.map((nested: Error) => nested.message)).toEqual(
      [
        'Error reading mappings',
        'Error reading schedules',
        'Error reading authentication modules',
      ]
    );
    // the sources that were fine were attempted all the same
    expect(getRealms).toHaveBeenCalledTimes(1);
    expect(queryAllManagedObjectsByType).toHaveBeenCalledTimes(2);
  });

  test('a source that is missing (404) is none and not a failure', async () => {
    tenant.sync = MISSING;
    tenant.authentication = MISSING;
    tenant.applications = {
      alpha_application: MISSING,
      bravo_application: MISSING,
    };
    await expect(find()).resolves.toEqual([]);
  });

  test.each(failures)(
    'when %s cannot be read a list of ids answers with the rest and names the source',
    async (_description, label, fail) => {
      tenant.sync = {
        _id: 'sync',
        mappings: [
          {
            name: 'm',
            source: 'system/csv/account',
            target: 'managed/alpha_user',
          },
        ],
      };
      tenant.schedules = [
        { _id: 'schedule/s', invokeContext: { source: 'system/csv/account' } },
      ];
      fail(serverError('the read'));
      const answer = await findConnectorReferences({
        connectorIds: ['csv', 'ldap'],
        state,
      });
      const source = {
        mappings: 'mapping',
        applications: 'application',
        schedules: 'schedule',
        'authentication modules': 'authentication-module',
      }[label];
      expect(answer.unreadable).toEqual([source]);
      expect(Object.keys(answer.references)).toEqual(['csv', 'ldap']);
      expect(
        answer.references.csv.map((reference) => reference.source)
      ).not.toContain(source);
      expect(answer.references.ldap).toEqual([]);
    }
  );

  test('a list of ids names every source that could not be read, in the order of the sources', async () => {
    tenant.mappings = serverError('mappings');
    tenant.realms = serverError('realms');
    tenant.schedules = serverError('schedules');
    tenant.authentication = serverError('authentication');
    const answer = await findConnectorReferences({
      connectorIds: ['csv'],
      state,
    });
    expect(answer).toEqual({
      references: { csv: [] },
      unreadable: [
        'mapping',
        'application',
        'schedule',
        'authentication-module',
      ],
    });
  });
});

describe('the ids', () => {
  test.each([[''], ['   '], ['\t\n']])(
    'the blank id %j is refused before anything is read',
    async (id) => {
      await expect(find(id)).rejects.toThrow(
        'Error finding references to a connector: the connector id is empty'
      );
      expect(requestCount()).toBe(0);
    }
  );

  test.each([[undefined], [null], [7], [{}], [true]])(
    'the id %p, which is not a string, is refused before anything is read',
    async (id) => {
      await expect(
        findConnectorReferences({ connectorIds: id as any, state })
      ).rejects.toThrow(
        'Error finding references to a connector: the connector id is empty'
      );
      expect(requestCount()).toBe(0);
    }
  );

  test('an empty list answers an empty result and reads nothing', async () => {
    const answer = await findConnectorReferences({ connectorIds: [], state });
    expect(answer).toEqual({ references: {}, unreadable: [] });
    expect(requestCount()).toBe(0);
  });

  test.each([[''], ['  '], [undefined], [null], [7], [{}]])(
    'the element %p of a list is refused before anything is read, whatever else the list holds',
    async (element) => {
      await expect(
        findConnectorReferences({
          connectorIds: ['csv', element as any, 'ldap'],
          state,
        })
      ).rejects.toThrow(
        'Error finding references to connectors: an id in the list is empty or not a string'
      );
      expect(requestCount()).toBe(0);
    }
  );

  test('an id that is repeated is answered once', async () => {
    const answer = await findConnectorReferences({
      connectorIds: ['csv', 'ldap', 'csv', 'csv'],
      state,
    });
    expect(Object.keys(answer.references)).toEqual(['csv', 'ldap']);
    expect(requestCount()).toBe(7);
  });

  test('an id that is the name of an object property is a plain key', async () => {
    tenant.sync = {
      _id: 'sync',
      mappings: [
        {
          name: 'toProto',
          source: 'system/__proto__/account',
          target: 'managed/alpha_user',
        },
      ],
    };
    const answer = await findConnectorReferences({
      connectorIds: ['__proto__', 'constructor', 'toString'],
      state,
    });
    expect(Object.getPrototypeOf(answer.references)).toBeNull();
    expect(Object.keys(answer.references)).toEqual([
      '__proto__',
      'constructor',
      'toString',
    ]);
    expect(answer.references['__proto__']).toEqual([
      expect.objectContaining({ id: 'sync/toProto' }),
    ]);
    expect(answer.references['constructor']).toEqual([]);
    expect(answer.references['toString']).toEqual([]);
  });

  test('the id is matched as it is: a blank around it, a path or another case names another connector', async () => {
    tenant.sync = {
      _id: 'sync',
      mappings: [
        {
          name: 'm',
          source: 'system/csv/account',
          target: 'managed/alpha_user',
        },
      ],
    };
    expect(await find(' csv')).toEqual([]);
    expect(await find('csv ')).toEqual([]);
    expect(await find('CSV')).toEqual([]);
    expect(await find('csv/account')).toEqual([]);
    expect(await find('csv')).toHaveLength(1);
  });
});
