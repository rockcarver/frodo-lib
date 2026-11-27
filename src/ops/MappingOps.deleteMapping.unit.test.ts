import { jest } from '@jest/globals';

/**
 * `deleteMapping` of a legacy mapping (`sync/<name>`) takes that one entry out
 * of the `sync` configuration and writes the rest as it was stored: every other
 * entry and every other property is written exactly as it was read. Nothing is
 * derived or added (no `_id`, no `syncAfter`), a reference to the deleted
 * mapping is not removed, and an entry that cannot be recognised (null, or
 * without a name) keeps its place. The after-write check looks for the entry by
 * name, because entries that were written without an `_id` come back without
 * one. A new-style mapping (`mapping/<name>`) is one configuration object of its
 * own and does not touch `sync`.
 * Mocked unit test: no recordings. The fake keeps the stored document, so what
 * the code writes can be compared with what it read, byte for byte.
 */

const putConfigEntity = jest.fn(async (_args?: any): Promise<any> => ({}));
const deleteConfigEntity = jest.fn(async (_args?: any): Promise<any> => ({}));
const readConfigEntitiesByType = jest.fn(
  async (_args?: any): Promise<any> => []
);
const readConfigEntity = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  putConfigEntity,
}));

jest.unstable_mockModule('./IdmConfigOps', () => ({
  deleteConfigEntity,
  readConfigEntitiesByType,
  readConfigEntity,
}));

// the Console module is mocked in part: the rest of it is the real module,
// because the managed object and realm readers that MappingOps imports load
// the api layer, which imports more of it
const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const {
  default: MappingOps,
  deleteMapping,
  readSyncMappings,
} = await import('./MappingOps');
const { FrodoError } = await import('./FrodoError');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'cloud',
} as any;

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

// The three mappings of the stored document, as a tenant stores them. The key
// order is part of the fixture. A has neither `syncAfter` nor `_id`, B has both,
// C has a `syncAfter` that names A and B and no `_id`.
const mappingA = () => ({
  name: 'ldapUser',
  source: 'system/ldap/account',
  target: 'managed/user',
  properties: [{ source: 'uid', target: 'userName' }],
  policies: [{ situation: 'ABSENT', action: 'CREATE' }],
});
const mappingB = () => ({
  _id: 'sync/ldapRole',
  name: 'ldapRole',
  source: 'system/ldap/group',
  target: 'managed/role',
  syncAfter: ['ldapUser'],
});
const mappingC = () => ({
  name: 'ldapGroup',
  source: 'system/ldap/organization',
  target: 'managed/organization',
  consentRequired: false,
  syncAfter: ['ldapUser', 'ldapRole'],
});

/** A mapping without a name. */
const nameless = () => ({
  source: 'system/ldap/other',
  target: 'managed/other',
});

const syncOf = (mappings: any[], more: object = {}) => ({
  _id: 'sync',
  ...more,
  mappings,
});

/** The error of a failed request for `config/sync`, as the HTTP client raises it. */
function requestFailed(status: number): any {
  const failed: any = new Error(`Request failed with status code ${status}`);
  failed.response = { status };
  failed.config = {
    url: 'https://openam-matrix.example.com/openidm/config/sync',
  };
  return failed;
}

/** The error that a read of `config/sync` answers where the deployment has none. */
function noSyncConfiguration() {
  return new FrodoError('Error reading config entity sync', requestFailed(404));
}

/** the document the tenant holds; `undefined` where there is no `sync` configuration */
let stored: any;
/** every object that the fake handed out for a read of `sync`, and its text at that moment */
let handedOut: { object: any; text: string }[];
/** every update of the fake: the entity id and the text of the body */
let puts: { entityId: string; body: string }[];
/** what the tenant answers to an update; by default what it was given, which it keeps */
let answer: ((written: any) => any) | undefined;
/** an error that the read of `sync` fails with */
let readFailure: Error | undefined;
/** an error that the update of `sync` fails with: the tenant refuses the write and keeps what it holds */
let putFailure: Error | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  stored = syncOf([mappingA(), mappingB(), mappingC()]);
  handedOut = [];
  puts = [];
  answer = undefined;
  readFailure = undefined;
  putFailure = undefined;
  readConfigEntity.mockReset();
  readConfigEntity.mockImplementation(async ({ entityId }: any) => {
    if (entityId !== 'sync') throw new Error(`unexpected read of ${entityId}`);
    if (readFailure) throw readFailure;
    if (stored === undefined) throw noSyncConfiguration();
    // a fresh object on every call, as a request gives it
    const object = JSON.parse(JSON.stringify(stored));
    handedOut.push({ object, text: JSON.stringify(object) });
    return object;
  });
  readConfigEntitiesByType.mockReset();
  readConfigEntitiesByType.mockImplementation(async () => []);
  deleteConfigEntity.mockReset();
  putConfigEntity.mockReset();
  putConfigEntity.mockImplementation(async ({ entityId, entityData }: any) => {
    const body = JSON.stringify(entityData);
    puts.push({ entityId, body });
    if (putFailure) throw putFailure;
    if (answer) return answer(JSON.parse(body));
    stored = JSON.parse(body);
    return JSON.parse(body);
  });
});

describe('deleteMapping, a legacy mapping', () => {
  test.each([
    ['first', 'sync/ldapUser', () => [mappingB(), mappingC()]],
    ['middle', 'sync/ldapRole', () => [mappingA(), mappingC()]],
    ['last', 'sync/ldapGroup', () => [mappingA(), mappingB()]],
  ])(
    'writes the stored document without the %s entry, byte for byte, in one read and one write',
    async (_position, mappingId, remaining) => {
      await deleteMapping({ mappingId, state });

      expect(puts).toHaveLength(1);
      expect(puts[0].entityId).toBe('sync');
      expect(puts[0].body).toBe(JSON.stringify(syncOf(remaining())));
      expect(readConfigEntity).toHaveBeenCalledTimes(1);
      expect(readConfigEntity.mock.calls[0][0].entityId).toBe('sync');
      expect(putConfigEntity).toHaveBeenCalledTimes(1);
      expect(putConfigEntity.mock.calls[0][0].entityId).toBe('sync');
      expect(deleteConfigEntity).not.toHaveBeenCalled();
    }
  );

  test('keeps the syncAfter of the others as stored, also where it names the deleted mapping', async () => {
    // the stored lists are not the ones that the order of the mappings gives:
    // B names the deleted mapping A, C does not, and D lists them the other way round
    stored = syncOf([
      mappingA(),
      { ...mappingB(), syncAfter: ['ldapUser'] },
      { ...mappingC(), syncAfter: ['ldapRole'] },
      {
        name: 'ldapOrg',
        source: 'system/ldap/org',
        target: 'managed/org',
        syncAfter: ['ldapRole', 'ldapUser'],
      },
    ]);

    await deleteMapping({ mappingId: 'sync/ldapUser', state });

    const written = JSON.parse(puts[0].body).mappings;
    expect(written.map((it: any) => it.name)).toEqual([
      'ldapRole',
      'ldapGroup',
      'ldapOrg',
    ]);
    // the reference to the deleted mapping stays, and nothing is added or removed
    expect(written[0].syncAfter).toEqual(['ldapUser']);
    expect(written[1].syncAfter).toEqual(['ldapRole']);
    expect(written[2].syncAfter).toEqual(['ldapRole', 'ldapUser']);
  });

  test('writes back the _id of the document and every other property of it', async () => {
    stored = syncOf([mappingA(), mappingB(), mappingC()], {
      unknownSetting: { kept: ['as', 'stored'] },
    });

    await deleteMapping({ mappingId: 'sync/ldapRole', state });

    expect(puts[0].body).toBe(
      JSON.stringify({
        _id: 'sync',
        unknownSetting: { kept: ['as', 'stored'] },
        mappings: [mappingA(), mappingC()],
      })
    );
  });

  test('does not change the object that was read', async () => {
    await deleteMapping({ mappingId: 'sync/ldapUser', state });

    expect(handedOut).toHaveLength(1);
    // no _id and no syncAfter was added to what the read handed out
    expect(JSON.stringify(handedOut[0].object)).toBe(handedOut[0].text);
  });

  test('keeps a null entry and an entry without a name where they are', async () => {
    stored = syncOf([mappingA(), null, mappingB(), nameless(), mappingC()]);

    await deleteMapping({ mappingId: 'sync/ldapRole', state });

    expect(puts[0].body).toBe(
      JSON.stringify(syncOf([mappingA(), null, nameless(), mappingC()]))
    );
  });

  test('deletes first, middle and last in turn: each write is the stored document minus that entry', async () => {
    const entry = (name: string, syncAfter?: string[]) => ({
      name,
      source: `system/ldap/${name}`,
      target: 'managed/user',
      ...(syncAfter ? { syncAfter } : {}),
    });
    const all = [
      entry('first'),
      entry('second', ['first']),
      entry('middle', ['first', 'second']),
      entry('fourth', ['first', 'second', 'middle']),
      entry('last', ['first', 'second', 'middle', 'fourth']),
    ];
    stored = syncOf(all);
    let expected = all;
    const steps = ['first', 'middle', 'last', 'second', 'fourth'];
    for (const name of steps) {
      const before = JSON.stringify(stored);
      expect(before).toBe(JSON.stringify(syncOf(expected)));

      await deleteMapping({ mappingId: `sync/${name}`, state });

      expected = expected.filter((it) => it.name !== name);
      expect(JSON.stringify(stored)).toBe(JSON.stringify(syncOf(expected)));
    }
    expect(stored).toEqual({ _id: 'sync', mappings: [] });
    expect(puts).toHaveLength(steps.length);
  });

  describe.each([
    [
      'the mapping is not in the document',
      () => {
        stored = syncOf([mappingA(), mappingB()]);
      },
      'sync/ldapGroup',
      'Mapping sync/ldapGroup not found in sync.json or multiple mappings found!',
    ],
    [
      'two entries have the name',
      () => {
        stored = syncOf([mappingA(), mappingB(), mappingA()]);
      },
      'sync/ldapUser',
      'Mapping sync/ldapUser not found in sync.json or multiple mappings found!',
    ],
    [
      'the deployment has no sync configuration (HTTP 404)',
      () => {
        stored = undefined;
      },
      'sync/ldapUser',
      'Mapping sync/ldapUser not found in sync.json or multiple mappings found!',
    ],
    [
      'the mappings of the document are not a list',
      () => {
        stored = { _id: 'sync', mappings: { ldapUser: mappingA() } };
      },
      'sync/ldapUser',
      'The sync configuration does not hold a list of mappings.',
    ],
  ])('when %s', (_situation, setUp, mappingId, message) => {
    test('throws and writes nothing', async () => {
      setUp();

      const error: any = await deleteMapping({ mappingId, state }).catch(
        (e) => e
      );

      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe(`Error deleting mapping ${mappingId}`);
      expect(rootCause(error).message).toBe(message);
      expect(putConfigEntity).not.toHaveBeenCalled();
    });
  });

  describe('the check after the write looks for the entry by name', () => {
    test('throws where the answer still holds the entry, although that entry has no _id', async () => {
      // the tenant keeps what it holds and answers it: A has no _id there
      answer = () => syncOf([mappingA(), mappingB(), mappingC()]);

      const error: any = await deleteMapping({
        mappingId: 'sync/ldapUser',
        state,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(FrodoError);
      expect(rootCause(error).message).toBe(
        'Mapping sync/ldapUser was not deleted from sync.json after successful update.'
      );
    });

    test('resolves where the answer does not hold the entry', async () => {
      answer = () => syncOf([mappingB(), mappingC()]);

      const deleted = await deleteMapping({
        mappingId: 'sync/ldapUser',
        state,
      });

      expect(deleted.name).toBe('ldapUser');
    });
  });

  test.each([
    [
      'an entry that stores neither an _id nor a syncAfter',
      'sync/ldapUser',
      () => syncOf([mappingA(), mappingB(), mappingC()]),
      { ...mappingA(), _id: 'sync/ldapUser', syncAfter: [] },
    ],
    [
      'an entry whose stored syncAfter is not the one that its place gives',
      'sync/ldapGroup',
      () =>
        syncOf([
          mappingA(),
          mappingB(),
          { ...mappingC(), syncAfter: ['ldapRole'] },
        ]),
      {
        ...mappingC(),
        _id: 'sync/ldapGroup',
        syncAfter: ['ldapUser', 'ldapRole'],
      },
    ],
  ])(
    'returns the deleted mapping as readSyncMappings gives it (%s): _id and syncAfter derived from its place',
    async (_what, mappingId, document, expected) => {
      stored = document();
      const listed = await readSyncMappings({ state });

      const deleted = await deleteMapping({ mappingId, state });

      expect(deleted).toEqual(listed.find((it) => it._id === mappingId));
      expect(deleted).toEqual(expected);
    }
  );

  test.each(['ldapUser', 'ldap'])(
    'removes only the entry named %s, not an entry with a near name',
    async (name) => {
      const entry = (named: string) => ({
        name: named,
        source: 'system/ldap/account',
        target: 'managed/user',
      });
      const all = [
        'ldap',
        'ldapUser',
        'LDAPUser',
        'ldapuser',
        'ldapUser2',
        'ldapUser/x',
        'ldap user',
      ].map(entry);
      stored = syncOf(all);

      await deleteMapping({ mappingId: `sync/${name}`, state });

      expect(puts[0].body).toBe(
        JSON.stringify(syncOf(all.filter((it) => it.name !== name)))
      );
    }
  );

  test.each([500, 403])(
    'passes on a read error that is not a 404 (HTTP %i) and writes nothing',
    async (status) => {
      const cause = requestFailed(status);
      readFailure = new FrodoError('Error reading config entity sync', cause);

      const error: any = await deleteMapping({
        mappingId: 'sync/ldapUser',
        state,
      }).catch((e) => e);

      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error deleting mapping sync/ldapUser');
      expect(error.originalErrors[0].message).toBe(
        'Error reading sync mappings'
      );
      expect(rootCause(error)).toBe(cause);
      expect(putConfigEntity).not.toHaveBeenCalled();
    }
  );

  test('does not report a delete that the tenant refused: the error of the write reaches the caller and the entry stays', async () => {
    const refused = new Error('HTTP 403');
    putFailure = refused;

    const error: any = await deleteMapping({
      mappingId: 'sync/ldapRole',
      state,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting mapping sync/ldapRole');
    expect(error.originalErrors[0].message).toBe(
      'Error updating legacy mappings'
    );
    expect(rootCause(error)).toBe(refused);
    expect(puts).toHaveLength(1);
    expect(stored).toEqual(syncOf([mappingA(), mappingB(), mappingC()]));
  });

  test('as before, an answer to the update that holds no list of mappings fails after the write was made', async () => {
    // a recorded answer always holds the list. This pins what the function does
    // when it does not (the check after the write needs the list): it is what
    // the function did before, not something to rely on.
    answer = () => ({ _id: 'sync' });

    const error: any = await deleteMapping({
      mappingId: 'sync/ldapUser',
      state,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting mapping sync/ldapUser');
    expect(puts).toHaveLength(1);
  });
});

describe('deleteMapping, a new-style mapping', () => {
  test('deletes the configuration object of its own and does not touch sync', async () => {
    const object = {
      _id: 'mapping/ldapUser',
      name: 'ldapUser',
      source: 'system/ldap/account',
      target: 'managed/user',
    };
    deleteConfigEntity.mockImplementation(async () => object);

    const deleted = await deleteMapping({
      mappingId: 'mapping/ldapUser',
      state,
    });

    expect(deleted).toBe(object);
    expect(deleteConfigEntity).toHaveBeenCalledTimes(1);
    expect(deleteConfigEntity.mock.calls[0][0].entityId).toBe(
      'mapping/ldapUser'
    );
    expect(readConfigEntity).not.toHaveBeenCalled();
    expect(putConfigEntity).not.toHaveBeenCalled();
  });
});

describe('readSyncMappings, the legacy mappings as the library presents them', () => {
  test('gives every mapping an _id and a syncAfter from its place, skips a null entry and lists an entry without a name as sync/undefined', async () => {
    stored = syncOf([
      mappingA(),
      null,
      { ...mappingB(), _id: 'sync/stale' },
      mappingC(),
      nameless(),
    ]);

    const result = await readSyncMappings({ state });

    expect(result).toEqual([
      { ...mappingA(), _id: 'sync/ldapUser', syncAfter: [] },
      { ...mappingB(), _id: 'sync/ldapRole', syncAfter: ['ldapUser'] },
      {
        ...mappingC(),
        _id: 'sync/ldapGroup',
        syncAfter: ['ldapUser', 'ldapRole'],
      },
      // an entry without a name is listed as sync/undefined
      {
        ...nameless(),
        _id: 'sync/undefined',
        syncAfter: ['ldapUser', 'ldapRole', 'ldapGroup'],
      },
    ]);
    // the entries keep their keys in the order they were stored: _id and syncAfter come last
    // (where the entry had none), a stored key keeps its place
    expect(Object.keys(result[0])).toEqual([
      'name',
      'source',
      'target',
      'properties',
      'policies',
      '_id',
      'syncAfter',
    ]);
    expect(Object.keys(result[1])).toEqual([
      '_id',
      'name',
      'source',
      'target',
      'syncAfter',
    ]);
    // and the facade function gives the same
    expect(await MappingOps(state).readSyncMappings()).toEqual(result);
  });
});
