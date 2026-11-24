import { jest } from '@jest/globals';
import type { MappingReference } from './MappingOps';

/**
 * `findMappingReferences` reads every source that can name a mapping once,
 * together, and joins the answer in memory: the other mappings (the `sync`
 * configuration and the `mapping/` configurations: `links` and `syncAfter`),
 * the schedules (`invokeContext.mapping`) and the applications of every realm
 * (`mappingNames`). Mocked unit test: the readers that MappingOps imports are
 * replaced one level above the requests, so the real joins, the real 404 as
 * none and the real application reader run. No recordings, no tenant.
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
  /** what the query of the `schedule` configurations returns */
  schedules: unknown;
  realms: unknown;
  /** per managed type: the pages of its records, or what the read fails with */
  applications: Record<string, unknown[][] | Error | typeof MISSING>;
};

function emptyTenant(): Tenant {
  return {
    sync: MISSING,
    mappings: [],
    schedules: [],
    realms: [ROOT, ALPHA, BRAVO],
    applications: {},
  };
}

let tenant: Tenant = emptyTenant();

function answer(value: unknown) {
  if (value === MISSING) throw notFound();
  if (value instanceof Error) throw value;
  return value;
}

const { FrodoError } = await import('./FrodoError');
const { default: Constants } = await import('../shared/Constants');

// the real reader wraps what the request threw in a FrodoError, and the 404
// is found again in the chain: the fake does the same
const readConfigEntity = jest.fn(async (args?: any): Promise<any> => {
  if (args.entityId !== 'sync') {
    throw new Error(`unexpected entity ${args.entityId}`);
  }
  try {
    return answer(tenant.sync);
  } catch (error) {
    throw new FrodoError(`Error reading config entity ${args.entityId}`, error);
  }
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

const actualIdmConfigOps = await import('./IdmConfigOps');
const actualRealmOps = await import('./RealmOps');
const actualManagedObjectApi = await import('../api/ManagedObjectApi');
jest.unstable_mockModule('./IdmConfigOps', () => ({
  ...actualIdmConfigOps,
  readConfigEntity,
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

const { default: MappingOps, findMappingReferences } =
  await import('./MappingOps');

let deploymentType: string = Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
let useRealmPrefix = false;
const setRealm = jest.fn();
const state = {
  getDeploymentType: () => deploymentType,
  getUseRealmPrefixOnManagedObjects: () => useRealmPrefix,
  getRealm: () => 'alpha',
  setRealm,
  getDebugHandler: () => undefined,
} as any;
const mappings = MappingOps(state);

/** The dependency of every holder, stated here on purpose and not read from the code. */
const EXPECTED_DEPENDENCY = {
  schedule: 'hard',
  application: 'hard',
  links: 'hard',
  syncAfter: 'soft',
} as const;

/** Every request that was sent to the tenant. */
const requestCount = () =>
  readConfigEntity.mock.calls.length +
  readConfigEntitiesByType.mock.calls.length +
  getRealms.mock.calls.length +
  queryAllManagedObjectsByType.mock.calls.length;

const find = async (name = 'mapA') =>
  findMappingReferences({ mappingNames: name, state });

const syncOf = (...entries: unknown[]) => ({ _id: 'sync', mappings: entries });
const mappingOf = (name: string, fields: Record<string, unknown> = {}) => ({
  _id: `mapping/${name}`,
  name,
  source: 'managed/alpha_user',
  target: 'system/zion/account',
  ...fields,
});

beforeEach(() => {
  jest.clearAllMocks();
  tenant = emptyTenant();
  deploymentType = Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
  useRealmPrefix = false;
});

describe('the mappings of the sync configuration', () => {
  test('a mapping whose links is the name is a hard reference, named by its sync id', async () => {
    tenant.sync = syncOf(
      { name: 'mapB', links: 'mapA' },
      { name: 'mapC', links: 'mapOther' },
      { name: 'mapA' }
    );
    expect(await find()).toEqual([
      {
        source: 'mapping',
        dependency: EXPECTED_DEPENDENCY.links,
        id: 'sync/mapB',
        name: 'mapB',
        from: 'links',
      },
    ]);
  });

  test('a mapping whose syncAfter lists the name is a soft reference', async () => {
    tenant.sync = syncOf(
      { name: 'mapB', syncAfter: ['mapX', 'mapA'] },
      { name: 'mapC', syncAfter: ['mapX'] },
      { name: 'mapD', syncAfter: [] }
    );
    expect(await find()).toEqual([
      {
        source: 'mapping',
        dependency: EXPECTED_DEPENDENCY.syncAfter,
        id: 'sync/mapB',
        name: 'mapB',
        from: 'syncAfter',
      },
    ]);
  });

  test('a mapping that has both is two references, one per field, each with its own flag', async () => {
    tenant.sync = syncOf({
      name: 'mapB',
      links: 'mapA',
      syncAfter: ['mapA'],
    });
    expect(await find()).toEqual([
      expect.objectContaining({
        id: 'sync/mapB',
        from: 'links',
        dependency: 'hard',
      }),
      expect.objectContaining({
        id: 'sync/mapB',
        from: 'syncAfter',
        dependency: 'soft',
      }),
    ]);
  });

  test('a mapping that lists the name twice is one reference', async () => {
    tenant.sync = syncOf({ name: 'mapB', syncAfter: ['mapA', 'mapA'] });
    expect(await find()).toHaveLength(1);
  });

  test('the order of the entries is not a syncAfter: an entry that comes after the mapping is no holder', async () => {
    tenant.sync = syncOf(
      { name: 'mapA' },
      { name: 'mapB' },
      { name: 'mapC', links: 'mapB' }
    );
    expect(await find('mapA')).toEqual([]);
    expect(await find('mapB')).toEqual([
      expect.objectContaining({ id: 'sync/mapC', from: 'links' }),
    ]);
  });

  test('an entry without a name is not seen, even when it names the mapping (the public text says so)', async () => {
    tenant.sync = syncOf(
      { links: 'mapA' },
      { syncAfter: ['mapA'] },
      { name: 'named', links: 'mapA' }
    );
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'sync/named', from: 'links' }),
    ]);
  });

  test('malformed entries are skipped and do not fail the lookup', async () => {
    tenant.sync = syncOf(
      null,
      'a string',
      42,
      ['mapA'],
      { name: 'numberLinks', links: 7 },
      { name: 'listLinks', links: ['mapA'] },
      { name: 'objectLinks', links: { name: 'mapA' } },
      { name: 'stringSyncAfter', syncAfter: 'mapA' },
      { name: 'objectSyncAfter', syncAfter: { 0: 'mapA' } },
      { name: 'numberSyncAfter', syncAfter: [7, null, { name: 'mapA' }] },
      { name: 123, links: 'mapA' },
      { name: 'valid', links: 'mapA' }
    );
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'sync/valid', from: 'links' }),
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
    ['is a list', [{ name: 'x', links: 'mapA' }]],
    ['is missing (404)', MISSING],
  ])(
    'a sync configuration that %s has no mappings, and the other store is still read',
    async (_description, sync) => {
      tenant.sync = sync;
      tenant.mappings = [mappingOf('stillRead', { links: 'mapA' })];
      expect(await find()).toEqual([
        expect.objectContaining({ id: 'mapping/stillRead' }),
      ]);
    }
  );
});

describe('the mapping configurations', () => {
  test('a mapping configuration that names the mapping is a reference under its configuration id, with the flag of its field', async () => {
    tenant.mappings = [
      mappingOf('newLinks', { links: 'mapA' }),
      mappingOf('newAfter', { syncAfter: ['mapA'] }),
      mappingOf('unrelated', { links: 'mapOther', syncAfter: ['mapOther'] }),
    ];
    expect(await find()).toEqual([
      {
        source: 'mapping',
        dependency: 'soft',
        id: 'mapping/newAfter',
        name: 'newAfter',
        from: 'syncAfter',
      },
      {
        source: 'mapping',
        dependency: 'hard',
        id: 'mapping/newLinks',
        name: 'newLinks',
        from: 'links',
      },
    ]);
  });

  test('a mapping configuration without a name takes its name from its id', async () => {
    tenant.mappings = [
      { _id: 'mapping/fromId', links: 'mapA' },
      { _id: 'mapping/x/y', syncAfter: ['mapA'] },
    ];
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'mapping/fromId', name: 'fromId' }),
      expect.objectContaining({ id: 'mapping/x/y', name: 'x/y' }),
    ]);
  });

  test('malformed configurations are skipped, and so are entries that only start with the word mapping', async () => {
    tenant.mappings = [
      null,
      'a string',
      { _id: 123, links: 'mapA' },
      { links: 'mapA' },
      { _id: 'mappingNotAConfig/x', links: 'mapA' },
      { _id: 'mapping', links: 'mapA' },
      mappingOf('valid', { links: 'mapA' }),
    ];
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'mapping/valid', from: 'links' }),
    ]);
  });

  test('a list of mapping configurations that is not a list is none, and the sync configuration is still read', async () => {
    tenant.mappings = { not: 'a list' };
    tenant.sync = syncOf({ name: 'valid', links: 'mapA' });
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'sync/valid' }),
    ]);
  });
});

describe('a mapping that is stored in both places', () => {
  test('is one reference per field, under the mapping configuration id', async () => {
    tenant.sync = syncOf(
      { name: 'both', links: 'mapA' },
      { name: 'bothAfter', syncAfter: ['mapA'] }
    );
    tenant.mappings = [
      mappingOf('both', { links: 'mapA' }),
      mappingOf('bothAfter', { syncAfter: ['mapA'] }),
    ];
    expect(await find()).toEqual([
      expect.objectContaining({
        id: 'mapping/both',
        from: 'links',
        dependency: 'hard',
      }),
      expect.objectContaining({
        id: 'mapping/bothAfter',
        from: 'syncAfter',
        dependency: 'soft',
      }),
    ]);
  });

  test('that names the mapping in a different field of each place is two references, each under the id of its place', async () => {
    tenant.sync = syncOf({ name: 'split', links: 'mapA' });
    tenant.mappings = [mappingOf('split', { syncAfter: ['mapA'] })];
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'mapping/split', from: 'syncAfter' }),
      expect.objectContaining({ id: 'sync/split', from: 'links' }),
    ]);
  });

  test('only counts for the field where the mapping configuration holds a match: the other store keeps its own id', async () => {
    tenant.sync = syncOf({ name: 'legacyMatch', links: 'mapA' });
    tenant.mappings = [mappingOf('legacyMatch', { links: 'mapOther' })];
    expect(await find()).toEqual([
      {
        source: 'mapping',
        dependency: 'hard',
        id: 'sync/legacyMatch',
        name: 'legacyMatch',
        from: 'links',
      },
    ]);
  });

  test('a mapping that is looked up and stored in both places is no holder of itself, in either place', async () => {
    tenant.sync = syncOf({
      name: 'mapA',
      links: 'mapA',
      syncAfter: ['mapA'],
    });
    tenant.mappings = [
      mappingOf('mapA', { links: 'mapA', syncAfter: ['mapA'] }),
    ];
    expect(await find()).toEqual([]);
  });

  test('a holder that is stored in both places while the looked up mapping is stored in both too is still found', async () => {
    tenant.sync = syncOf({ name: 'mapA' }, { name: 'mapB', links: 'mapA' });
    tenant.mappings = [mappingOf('mapA'), mappingOf('mapB', { links: 'mapA' })];
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'mapping/mapB', from: 'links' }),
    ]);
  });
});

describe('itself and its neighbours', () => {
  test('a mapping that names itself is no holder', async () => {
    tenant.sync = syncOf({
      name: 'mapA',
      links: 'mapA',
      syncAfter: ['mapA'],
    });
    tenant.mappings = [mappingOf('mapA', { links: 'mapA' })];
    expect(await find()).toEqual([]);
  });

  test('a name that starts with the looked up name is another mapping: mapA is not found by mapAB', async () => {
    tenant.sync = syncOf(
      { name: 'one', links: 'mapAB', syncAfter: ['mapAB'] },
      { name: 'two', links: 'mapA' }
    );
    tenant.mappings = [mappingOf('three', { syncAfter: ['mapAB'] })];
    tenant.schedules = [schedule('recon', 'mapAB')];
    tenant.applications = {
      alpha_application: [[app('a-1', 'App', ['mapAB'])]],
    };
    expect(await find('mapA')).toEqual([
      expect.objectContaining({ id: 'sync/two', from: 'links' }),
    ]);
    // and the longer name finds only what names it
    expect((await find('mapAB')).map((reference) => reference.id)).toEqual([
      'mapping/three',
      'sync/one',
      'sync/one',
      'schedule/recon',
      'a-1',
    ]);
  });

  test.each([
    ['a different case', 'MAPA'],
    ['a trailing blank', 'mapA '],
    ['a leading blank', ' mapA'],
    ['a prefix of the store', 'sync/mapA'],
    ['a path', 'mapA/x'],
    ['a shorter name', 'map'],
  ])('%s is another mapping', async (_description, value) => {
    tenant.sync = syncOf({ name: 'one', links: value, syncAfter: [value] });
    tenant.mappings = [mappingOf('two', { links: value, syncAfter: [value] })];
    tenant.schedules = [schedule('recon', value)];
    tenant.applications = {
      alpha_application: [[app('a-1', 'App', [value])]],
    };
    expect(await find('mapA')).toEqual([]);
  });

  test('the mapping need not exist: holders are found for a name that no store holds', async () => {
    tenant.sync = syncOf({ name: 'mapB', links: 'gone' });
    expect(await find('gone')).toEqual([
      expect.objectContaining({ id: 'sync/mapB' }),
    ]);
  });
});

const schedule = (name: string, mapping: unknown, action = 'reconcile') => ({
  _id: `schedule/${name}`,
  enabled: true,
  invokeService: 'sync',
  invokeContext: { action, mapping },
});
const app = (id: string, name: string, mappingNames: unknown) => ({
  _id: id,
  name,
  mappingNames,
});

describe('the schedules', () => {
  test('a schedule whose invoke context mapping is the name is a hard reference', async () => {
    tenant.schedules = [schedule('reconA', 'mapA'), schedule('reconB', 'mapB')];
    expect(await find()).toEqual([
      {
        source: 'schedule',
        dependency: EXPECTED_DEPENDENCY.schedule,
        id: 'schedule/reconA',
        from: 'invokeContext.mapping',
      },
    ]);
  });

  test('a schedule that names the mapping is found whatever its action', async () => {
    tenant.schedules = [schedule('other', 'mapA', 'liveSync')];
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'schedule/other' }),
    ]);
  });

  test.each([
    ['a different case', 'MAPA'],
    ['a longer name', 'mapAB'],
    ['a number', 7],
    ['a list', ['mapA']],
    ['an object', { name: 'mapA' }],
    ['nothing', undefined],
  ])('a mapping of %s is not a reference', async (_description, value) => {
    tenant.schedules = [schedule('near', value)];
    expect(await find()).toEqual([]);
  });

  test('a live sync schedule names a source, not a mapping: it is not a reference', async () => {
    tenant.schedules = [
      {
        _id: 'schedule/live',
        invokeService: 'provisioner',
        invokeContext: { action: 'liveSync', source: 'system/zion/account' },
      },
    ];
    expect(await find('system/zion/account')).toEqual([]);
  });

  test('malformed schedules are skipped, and so are entries that only start with the word schedule', async () => {
    tenant.schedules = [
      null,
      'a string',
      { _id: 'schedule/noContext' },
      { _id: 'schedule/stringContext', invokeContext: 'mapA' },
      { _id: 'schedule/listContext', invokeContext: ['mapA'] },
      { _id: 7, invokeContext: { mapping: 'mapA' } },
      { invokeContext: { mapping: 'mapA' } },
      { _id: 'scheduleExtra/notASchedule', invokeContext: { mapping: 'mapA' } },
      schedule('valid', 'mapA'),
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
    tenant.schedules = [schedule('b', 'mapA'), schedule('a', 'mapA')];
    expect((await find()).map((reference) => reference.id)).toEqual([
      'schedule/a',
      'schedule/b',
    ]);
  });
});

describe('the applications', () => {
  test('on Cloud the applications of every realm are read, the root realm is skipped and the active realm is not changed', async () => {
    tenant.applications = {
      alpha_application: [
        [
          app('a-1', 'Alpha one', ['mapA', 'mapB']),
          app('a-2', 'Alpha two', []),
        ],
      ],
      bravo_application: [[app('b-1', 'Bravo one', ['mapA'])]],
    };
    expect(await find()).toEqual([
      {
        source: 'application',
        dependency: EXPECTED_DEPENDENCY.application,
        id: 'a-1',
        name: 'Alpha one',
        realm: 'alpha',
        from: 'mappingNames',
      },
      {
        source: 'application',
        dependency: 'hard',
        id: 'b-1',
        name: 'Bravo one',
        realm: 'bravo',
        from: 'mappingNames',
      },
    ]);
    expect(
      queryAllManagedObjectsByType.mock.calls.map(([a]: any[]) => a.type)
    ).toEqual(['alpha_application', 'bravo_application']);
    // only the two fields that the lookup needs are asked for
    for (const [args] of queryAllManagedObjectsByType.mock.calls as any[]) {
      expect(args).toMatchObject({ fields: ['name', 'mappingNames'] });
    }
    expect(setRealm).not.toHaveBeenCalled();
    expect(state.getRealm()).toBe('alpha');
  });

  test('an application in two realms that names the mapping is one reference per realm', async () => {
    tenant.applications = {
      alpha_application: [[app('same-id', 'Twin', ['mapA'])]],
      bravo_application: [[app('same-id', 'Twin', ['mapA'])]],
    };
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'same-id', realm: 'alpha' }),
      expect.objectContaining({ id: 'same-id', realm: 'bravo' }),
    ]);
  });

  test('an application that lists the name twice is one reference', async () => {
    tenant.applications = {
      alpha_application: [[app('a-1', 'Twice', ['mapA', 'mapA'])]],
    };
    expect(await find()).toHaveLength(1);
  });

  test.each([
    ['a different case', ['MAPA']],
    ['a longer name', ['mapAB']],
    ['a trailing blank', ['mapA ']],
    ['the name as a string, not a list', 'mapA'],
    ['numbers', [7, 8]],
    ['a list of lists', [['mapA']]],
    ['null', null],
    ['nothing', undefined],
  ])('mappingNames of %s is not a reference', async (_description, value) => {
    tenant.applications = {
      alpha_application: [[app('a-1', 'Near miss', value)]],
    };
    expect(await find()).toEqual([]);
  });

  test('malformed records are skipped', async () => {
    tenant.applications = {
      alpha_application: [
        [
          null,
          'a string',
          42,
          { name: 'no id', mappingNames: ['mapA'] },
          { _id: 7, name: 'numeric id', mappingNames: ['mapA'] },
          { _id: 'a-ok', mappingNames: ['mapA'] },
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
        from: 'mappingNames',
      },
    ]);
  });

  test('every page of the applications of a realm is read', async () => {
    tenant.applications = {
      alpha_application: [
        [app('a-1', 'First page', ['other'])],
        [app('a-2', 'Second page', ['mapA'])],
        [app('a-3', 'Third page', ['mapA'])],
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
      bravo_application: [[app('b-1', 'Bravo one', ['mapA'])]],
    };
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'b-1', realm: 'bravo' }),
    ]);
  });

  test('on ForgeOps with realm prefixes the root realm has its own type', async () => {
    deploymentType = Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;
    useRealmPrefix = true;
    tenant.applications = {
      application: [[app('root-1', 'Root one', ['mapA'])]],
      alpha_application: [[app('a-1', 'Alpha one', ['mapA'])]],
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
    deploymentType = Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;
    useRealmPrefix = false;
    tenant.applications = {
      application: [[app('shared-1', 'Shared one', ['mapA'])]],
    };
    const references = await find();
    expect(references).toEqual([
      {
        source: 'application',
        dependency: 'hard',
        id: 'shared-1',
        name: 'Shared one',
        from: 'mappingNames',
      },
    ]);
    expect(references[0]).not.toHaveProperty('realm');
    expect(queryAllManagedObjectsByType).toHaveBeenCalledTimes(1);
  });

  test('realms that the tenant does not list are none, and a malformed realm is skipped', async () => {
    tenant.realms = [null, { _id: 'x' }, ALPHA];
    tenant.applications = {
      alpha_application: [[app('a-1', 'Alpha one', ['mapA'])]],
    };
    expect(await find()).toEqual([expect.objectContaining({ id: 'a-1' })]);
    tenant.realms = 'no realms';
    expect(await find()).toEqual([]);
  });

  describe('on a classic deployment, which has no applications', () => {
    beforeEach(() => {
      deploymentType = Constants.CLASSIC_DEPLOYMENT_TYPE_KEY;
      // what a tenant would answer if it were asked
      tenant.applications = {
        application: [[app('a-1', 'Would be found', ['mapA'])]],
        alpha_application: [[app('a-2', 'Would be found', ['mapA'])]],
      };
    });

    test('no request is sent for them: no realms, no application type', async () => {
      tenant.sync = syncOf({ name: 'mapB', links: 'mapA' });
      expect(await find()).toEqual([
        expect.objectContaining({ id: 'sync/mapB' }),
      ]);
      expect(getRealms).not.toHaveBeenCalled();
      expect(queryAllManagedObjectsByType).not.toHaveBeenCalled();
    });

    test('the mappings and the schedules are still read, three requests whatever the number of names', async () => {
      tenant.schedules = [schedule('recon', 'mapA')];
      expect(await find()).toEqual([
        expect.objectContaining({ id: 'schedule/recon' }),
      ]);
      expect(requestCount()).toBe(3);
      jest.clearAllMocks();
      const answer = await findMappingReferences({
        mappingNames: ['mapA', 'mapB', 'mapC'],
        state,
      });
      expect(answer.unreadable).toEqual([]);
      expect(requestCount()).toBe(3);
    });

    test('the list form does not name the applications as unreadable, because they were not read', async () => {
      const answer = await findMappingReferences({
        mappingNames: ['mapA'],
        state,
      });
      expect(answer).toEqual({ references: { mapA: [] }, unreadable: [] });
    });
  });
});

describe('the answer', () => {
  function everyHolder() {
    tenant.sync = syncOf(
      { name: 'zSync', links: 'mapA' },
      { name: 'aSync', syncAfter: ['mapA'] }
    );
    tenant.mappings = [mappingOf('mNew', { links: 'mapA' })];
    tenant.schedules = [schedule('sched', 'mapA')];
    tenant.applications = {
      alpha_application: [[app('a-9', 'Nine', ['mapA'])]],
      bravo_application: [[app('a-1', 'One', ['mapA'])]],
    };
  }

  test('is ordered by source (mappings, schedules, applications), then by id and field', async () => {
    everyHolder();
    const found = await find();
    expect(found.map(({ source, id }) => [source, id])).toEqual([
      ['mapping', 'mapping/mNew'],
      ['mapping', 'sync/aSync'],
      ['mapping', 'sync/zSync'],
      ['schedule', 'schedule/sched'],
      ['application', 'a-1'],
      ['application', 'a-9'],
    ]);
  });

  test('orders the two fields of one holder by field', async () => {
    tenant.sync = syncOf({ name: 'mapB', syncAfter: ['mapA'], links: 'mapA' });
    expect((await find()).map(({ from }) => from)).toEqual([
      'links',
      'syncAfter',
    ]);
  });

  test('gives every holder the dependency that is stated here', async () => {
    everyHolder();
    const found = await find();
    expect(new Set(found.map(({ source }) => source))).toEqual(
      new Set(['mapping', 'schedule', 'application'])
    );
    for (const reference of found) {
      const expected =
        reference.source === 'mapping'
          ? EXPECTED_DEPENDENCY[reference.from as 'links' | 'syncAfter']
          : EXPECTED_DEPENDENCY[reference.source];
      expect(reference.dependency).toBe(expected);
    }
  });

  test('is empty when nothing names the mapping, and the mapping need not exist', async () => {
    everyHolder();
    expect(await find('does-not-exist')).toEqual([]);
  });

  test('is the same for a list of names as for each name alone', async () => {
    everyHolder();
    tenant.sync = syncOf(
      { name: 'zSync', links: 'mapA' },
      { name: 'other', syncAfter: ['mapB'] }
    );
    const alone = {
      mapA: await find('mapA'),
      mapB: await find('mapB'),
    };
    const { references, unreadable } = await findMappingReferences({
      mappingNames: ['mapA', 'mapB'],
      state,
    });
    expect(unreadable).toEqual([]);
    expect(references).toEqual(alone);
    expect(Object.keys(references)).toEqual(['mapA', 'mapB']);
  });

  test('a holder that is another mapping of the same list is reported like any other, and no name is a holder of itself', async () => {
    tenant.sync = syncOf(
      { name: 'mapA' },
      { name: 'mapB', links: 'mapA', syncAfter: ['mapB'] }
    );
    const { references } = await findMappingReferences({
      mappingNames: ['mapA', 'mapB'],
      state,
    });
    expect(references.mapA).toEqual([
      expect.objectContaining({ id: 'sync/mapB', from: 'links' }),
    ]);
    expect(references.mapB).toEqual([]);
  });

  test('one name answers a list of references, a list of names answers an object', async () => {
    everyHolder();
    // The annotations and the ts-expect-error line are for the reader and the
    // editor: the test run does not type-check test files (the declared types
    // are checked where code uses them).
    const single: MappingReference[] =
      await mappings.findMappingReferences('mapA');
    const batch: Record<string, MappingReference[]> = (
      await mappings.findMappingReferences(['mapA'])
    ).references;
    expect(Array.isArray(single)).toBe(true);
    expect(Array.isArray(batch)).toBe(false);
    expect(batch.mapA).toEqual(single);
    // @ts-expect-error a list of names does not answer a list of references
    const wrong: MappingReference[] = await mappings.findMappingReferences([
      'mapA',
    ]);
    expect(Array.isArray(wrong)).toBe(false);
  });

  test('the facade answers like the function', async () => {
    everyHolder();
    expect(await mappings.findMappingReferences('mapA')).toEqual(
      await find('mapA')
    );
  });

  test('the facade looks up every name of a list and reports each one, as the function does', async () => {
    tenant.sync = syncOf(
      { name: 'byLinks', links: 'mapA' },
      { name: 'byOrder', syncAfter: ['mapB'] }
    );
    tenant.schedules = [schedule('recon', 'mapC')];
    tenant.applications = {
      alpha_application: [[app('a-1', 'Owner', ['mapD'])]],
    };
    const names = ['mapA', 'mapB', 'mapC', 'mapD', 'mapE'];
    const answer = await mappings.findMappingReferences(names);
    expect(answer.unreadable).toEqual([]);
    expect(Object.keys(answer.references)).toEqual(names);
    expect(answer.references.mapA).toEqual([
      expect.objectContaining({ id: 'sync/byLinks', from: 'links' }),
    ]);
    expect(answer.references.mapB).toEqual([
      expect.objectContaining({ id: 'sync/byOrder', from: 'syncAfter' }),
    ]);
    expect(answer.references.mapC).toEqual([
      expect.objectContaining({ id: 'schedule/recon' }),
    ]);
    expect(answer.references.mapD).toEqual([
      expect.objectContaining({ id: 'a-1', realm: 'alpha' }),
    ]);
    expect(answer.references.mapE).toEqual([]);
    expect(answer).toEqual(
      await findMappingReferences({ mappingNames: names, state })
    );
  });
});

describe('the requests', () => {
  test.each([
    ['one name', ['mapA']],
    [
      'twenty-five names',
      Array.from({ length: 25 }, (_value, i) => `mapping${i}`),
    ],
  ])(
    'six requests on Cloud with two realms for %s',
    async (_description, names) => {
      const answer = await findMappingReferences({
        mappingNames: names,
        state,
      });
      expect(answer.unreadable).toEqual([]);
      expect(Object.keys(answer.references)).toHaveLength(names.length);
      expect(readConfigEntity).toHaveBeenCalledTimes(1);
      expect(readConfigEntitiesByType).toHaveBeenCalledTimes(2);
      expect(getRealms).toHaveBeenCalledTimes(1);
      expect(queryAllManagedObjectsByType).toHaveBeenCalledTimes(2);
      expect(requestCount()).toBe(6);
    }
  );

  test('one name costs the same six requests', async () => {
    await find();
    expect(requestCount()).toBe(6);
  });

  test('a further realm adds one request', async () => {
    tenant.realms = [ROOT, ALPHA, BRAVO, realm('charlie')];
    await find();
    expect(requestCount()).toBe(7);
  });

  test('five requests on ForgeOps without realm prefixes, where one type serves every realm', async () => {
    deploymentType = Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;
    await find();
    expect(requestCount()).toBe(5);
  });

  test('every request is a read of one of the sources', async () => {
    await find();
    expect(readConfigEntity.mock.calls.map(([a]: any[]) => a.entityId)).toEqual(
      ['sync']
    );
    expect(
      readConfigEntitiesByType.mock.calls.map(([a]: any[]) => a.type).sort()
    ).toEqual(['mapping', 'schedule']);
  });
});

describe('fail closed', () => {
  const failures: [string, string, MappingReference['source'], () => void][] = [
    [
      'the sync configuration',
      'mappings',
      'mapping',
      () => (tenant.sync = serverError('the read')),
    ],
    [
      'the mapping configurations',
      'mappings',
      'mapping',
      () => (tenant.mappings = serverError('the read')),
    ],
    [
      'the schedules',
      'schedules',
      'schedule',
      () => (tenant.schedules = serverError('the read')),
    ],
    [
      'the realms',
      'applications',
      'application',
      () => (tenant.realms = serverError('the read')),
    ],
    [
      'the applications of a realm',
      'applications',
      'application',
      () =>
        (tenant.applications = {
          alpha_application: serverError('the read'),
        }),
    ],
  ];

  test.each(failures)(
    'when %s cannot be read the single form fails with one error that names the source, and every other source was still read',
    async (_description, label, _source, fail) => {
      fail();
      const failure = find();
      await expect(failure).rejects.toBeInstanceOf(FrodoError);
      const error = await failure.catch((caught) => caught);
      expect(error.message).toBe(
        `Error finding references to mapping mapA: Error reading ${label}`
      );
      expect(error.originalErrors).toHaveLength(1);
      expect(error.originalErrors[0].message).toBe(`Error reading ${label}`);
      // the sources that could be read were attempted all the same
      expect(readConfigEntity).toHaveBeenCalledTimes(1);
      expect(readConfigEntitiesByType).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'mapping' })
      );
      expect(readConfigEntitiesByType).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'schedule' })
      );
      expect(getRealms).toHaveBeenCalledTimes(1);
    }
  );

  test('a failed read of one application type fails the source of the applications, not the realms that were read', async () => {
    tenant.applications = {
      bravo_application: serverError('the read'),
      alpha_application: [[app('a-1', 'One', ['mapA'])]],
    };
    const error = await find().catch((caught) => caught);
    expect(error.message).toBe(
      'Error finding references to mapping mapA: Error reading applications'
    );
    // no partial list
    expect(error.originalErrors).toHaveLength(1);
  });

  test('several unreadable sources are one error with one nested error each, in the order of the sources', async () => {
    tenant.mappings = serverError('mappings');
    tenant.schedules = serverError('schedules');
    tenant.realms = serverError('realms');
    const error = await find().catch((caught) => caught);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      'Error finding references to mapping mapA: Error reading mappings; Error reading schedules; Error reading applications'
    );
    expect(error.originalErrors.map((nested: Error) => nested.message)).toEqual(
      [
        'Error reading mappings',
        'Error reading schedules',
        'Error reading applications',
      ]
    );
  });

  test('a source that is missing (404) is none and not a failure', async () => {
    tenant.sync = MISSING;
    tenant.applications = {
      alpha_application: MISSING,
      bravo_application: MISSING,
    };
    await expect(find()).resolves.toEqual([]);
  });

  test('a missing sync configuration does not hide a holder in the other sources', async () => {
    tenant.sync = MISSING;
    tenant.schedules = [schedule('recon', 'mapA')];
    expect(await find()).toEqual([
      expect.objectContaining({ id: 'schedule/recon' }),
    ]);
  });

  test.each(failures)(
    'when %s cannot be read a list of names answers with the rest and names the source',
    async (_description, _label, source, fail) => {
      tenant.sync = syncOf({ name: 'm', links: 'mapA' });
      tenant.schedules = [schedule('s', 'mapA')];
      tenant.applications = {
        alpha_application: [[app('a-1', 'One', ['mapA'])]],
      };
      fail();
      const answer = await findMappingReferences({
        mappingNames: ['mapA', 'mapB'],
        state,
      });
      expect(answer.unreadable).toEqual([source]);
      expect(Object.keys(answer.references)).toEqual(['mapA', 'mapB']);
      expect(
        answer.references.mapA.map((reference) => reference.source)
      ).not.toContain(source);
      expect(answer.references.mapB).toEqual([]);
    }
  );

  test('a list of names names every source that could not be read, in the order of the sources', async () => {
    tenant.mappings = serverError('mappings');
    tenant.schedules = serverError('schedules');
    tenant.realms = serverError('realms');
    const answer = await findMappingReferences({
      mappingNames: ['mapA'],
      state,
    });
    expect(answer).toEqual({
      references: { mapA: [] },
      unreadable: ['mapping', 'schedule', 'application'],
    });
  });
});

describe('the names', () => {
  test.each([[''], ['   '], ['\t\n']])(
    'the blank name %j is refused before anything is read',
    async (name) => {
      await expect(find(name)).rejects.toThrow(
        'Error finding references to a mapping: the mapping id is empty'
      );
      expect(requestCount()).toBe(0);
    }
  );

  test.each([[undefined], [null], [7], [{}], [true]])(
    'the name %p, which is not a string, is refused before anything is read',
    async (name) => {
      await expect(
        findMappingReferences({ mappingNames: name as any, state })
      ).rejects.toThrow(
        'Error finding references to a mapping: the mapping id is empty'
      );
      expect(requestCount()).toBe(0);
    }
  );

  test('an empty list answers an empty result and reads nothing', async () => {
    const answer = await findMappingReferences({ mappingNames: [], state });
    expect(answer).toEqual({ references: {}, unreadable: [] });
    expect(requestCount()).toBe(0);
  });

  test.each([[''], ['  '], [undefined], [null], [7], [{}]])(
    'the element %p of a list is refused before anything is read, whatever else the list holds',
    async (element) => {
      await expect(
        findMappingReferences({
          mappingNames: ['mapA', element as any, 'mapB'],
          state,
        })
      ).rejects.toThrow(
        'Error finding references to mappings: an id in the list is empty or not a string'
      );
      expect(requestCount()).toBe(0);
    }
  );

  test('a name that is repeated is answered once', async () => {
    const answer = await findMappingReferences({
      mappingNames: ['mapA', 'mapB', 'mapA', 'mapA'],
      state,
    });
    expect(Object.keys(answer.references)).toEqual(['mapA', 'mapB']);
    expect(requestCount()).toBe(6);
  });

  test('a name that is the name of an object property is a plain key', async () => {
    tenant.sync = syncOf({ name: 'toProto', links: '__proto__' });
    const answer = await findMappingReferences({
      mappingNames: ['__proto__', 'constructor', 'toString'],
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

  test.each([
    ['a slash', 'org/user'],
    ['a path that goes up', '../x'],
    ['a blank inside', 'managed user'],
    ['dots', 'a.b'],
    ['regular expression characters', 'a+b(c)[d]*'],
    ['percent encoding', '%2e%2e'],
    ['quotes', `"quoted" and 'single'`],
    ['a backslash', 'back\\slash'],
    ['accents and symbols', 'ünï-cødé-✓'],
    ['a colon and an at sign', 'a:b@c'],
  ])(
    'a name with %s is matched exactly in every source and is no pattern',
    async (_description, name) => {
      tenant.sync = syncOf(
        { name: 'one', links: name },
        { name: 'two', syncAfter: [name] },
        // none of these must match: a pattern, a decoded or a trimmed name
        { name: 'near', links: `${name}x`, syncAfter: [`x${name}`] }
      );
      tenant.mappings = [mappingOf('three', { links: name })];
      tenant.schedules = [
        schedule('recon', name),
        schedule('near', `${name}x`),
      ];
      tenant.applications = {
        alpha_application: [
          [app('a-1', 'Mine', [name]), app('a-2', 'Near', [`${name}x`])],
        ],
      };
      expect((await find(name)).map(({ id }) => id)).toEqual([
        'mapping/three',
        'sync/one',
        'sync/two',
        'schedule/recon',
        'a-1',
      ]);
    }
  );

  test('a looked up name with blanks at its edges is matched exactly as given: it is not trimmed, in the single and the list form', async () => {
    tenant.sync = syncOf(
      { name: 'plain', links: 'mapA' },
      { name: 'leading', links: ' mapA' },
      { name: 'trailing', syncAfter: ['mapA '] }
    );
    tenant.schedules = [
      schedule('plainRecon', 'mapA'),
      schedule('leadingRecon', ' mapA'),
    ];
    tenant.applications = {
      alpha_application: [
        [
          app('a-plain', 'Plain', ['mapA']),
          app('a-trailing', 'Trailing', ['mapA ']),
        ],
      ],
    };
    const ids = async (name: string) =>
      (await find(name)).map((reference) => reference.id);
    expect(await ids('mapA')).toEqual([
      'sync/plain',
      'schedule/plainRecon',
      'a-plain',
    ]);
    expect(await ids(' mapA')).toEqual([
      'sync/leading',
      'schedule/leadingRecon',
    ]);
    expect(await ids('mapA ')).toEqual(['sync/trailing', 'a-trailing']);
    expect(await ids('  mapA')).toEqual([]);
    // the list form keeps the three names apart: one key each, never merged into mapA
    const { references } = await findMappingReferences({
      mappingNames: ['mapA', ' mapA', 'mapA '],
      state,
    });
    expect(Object.keys(references)).toEqual(['mapA', ' mapA', 'mapA ']);
    expect(references['mapA']).toHaveLength(3);
    expect(references[' mapA']).toHaveLength(2);
    expect(references['mapA ']).toHaveLength(2);
  });

  test('a dot is not a wildcard: a.b is not found by axb', async () => {
    tenant.sync = syncOf({ name: 'one', links: 'axb' });
    expect(await find('a.b')).toEqual([]);
    expect(await find('axb')).toHaveLength(1);
  });
});
