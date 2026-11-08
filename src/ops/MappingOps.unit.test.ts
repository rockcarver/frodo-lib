import { jest } from '@jest/globals';

/**
 * `deleteMappings` tries every mapping. A mapping that cannot be deleted does
 * not stop the others; after all of them were tried the function throws one
 * error that carries one nested error per failed mapping, naming it.
 * With a connector and/or a managed object type, only the mappings that belong
 * to them are touched: the others are neither deleted nor written to sync.json
 * and not reported as deleted.
 * Mocked unit test: no recordings.
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

jest.unstable_mockModule('../utils/Console', () => ({
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
  deleteMappings,
  readMappings,
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

const mapping = (name: string) => ({
  name,
  source: 'system/ldap/account',
  target: 'managed/user',
});

/** A mapping of a connector to a managed object type. */
const mappingOf = (name: string, connector: string, moType: string) => ({
  name,
  source: `system/${connector}/account`,
  target: `managed/${moType}`,
});

let attempted: string[];
let failure: Error;
let failing: Set<string>;

beforeEach(() => {
  jest.clearAllMocks();
  attempted = [];
  failure = new Error('HTTP 500');
  failing = new Set();
  // sync.json holds one legacy mapping, the new-style mappings are a, b and c
  // (fresh objects on every call: the code adds an _id to what it reads)
  readConfigEntity.mockReset();
  readConfigEntity.mockImplementation(async () => ({
    mappings: [mapping('legacyA')],
  }));
  readConfigEntitiesByType.mockReset();
  readConfigEntitiesByType.mockImplementation(async () => [
    mapping('a'),
    mapping('b'),
    mapping('c'),
  ]);
  deleteConfigEntity.mockReset();
  deleteConfigEntity.mockImplementation(async ({ entityId }: any) => {
    attempted.push(entityId);
    if (failing.has(entityId)) throw failure;
    return { ...mapping(entityId.split('/')[1]), _id: entityId };
  });
  putConfigEntity.mockReset();
  putConfigEntity.mockImplementation(async ({ entityData }: any) => ({
    mappings: entityData.mappings,
  }));
});

const names = (result: any[]) => result.map((it) => it.name);

describe('deleteMappings, all mappings', () => {
  test('deletes the legacy and the new mappings and returns them', async () => {
    const result = await deleteMappings({ state });

    expect(names(result)).toEqual(['legacyA', 'a', 'b', 'c']);
    expect(attempted).toEqual(['mapping/a', 'mapping/b', 'mapping/c']);
    expect(putConfigEntity).toHaveBeenCalledTimes(1);
    expect(putConfigEntity.mock.calls[0][0].entityData).toEqual({
      mappings: [],
    });
  });

  test('tries every mapping when one fails, and throws one error that names it', async () => {
    failing.add('mapping/b');

    const error: any = await deleteMappings({ state }).catch((e) => e);

    expect(attempted).toEqual(['mapping/a', 'mapping/b', 'mapping/c']);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting mappings');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error deleting mapping mapping/b'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('names every failed mapping, in the order they were tried', async () => {
    failing.add('mapping/a');
    failing.add('mapping/c');

    const error: any = await deleteMappings({ state }).catch((e) => e);

    expect(attempted).toEqual(['mapping/a', 'mapping/b', 'mapping/c']);
    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error deleting mapping mapping/a',
      'Error deleting mapping mapping/c',
    ]);
  });

  test('a failed update of sync.json is one error and the new mappings are still tried', async () => {
    putConfigEntity.mockRejectedValue(failure);

    const error: any = await deleteMappings({ state }).catch((e) => e);

    expect(attempted).toEqual(['mapping/a', 'mapping/b', 'mapping/c']);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting mappings');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error updating legacy mappings'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('a failed update of sync.json and a failed mapping are both reported', async () => {
    putConfigEntity.mockRejectedValue(failure);
    failing.add('mapping/b');

    const error: any = await deleteMappings({ state }).catch((e) => e);

    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error updating legacy mappings',
      'Error deleting mapping mapping/b',
    ]);
  });

  test('a failed read of the mappings is one error and nothing is deleted', async () => {
    readConfigEntity.mockRejectedValue(failure);

    const error: any = await deleteMappings({ state }).catch((e) => e);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting mappings');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe('Error reading mappings');
    expect(rootCause(error)).toBe(failure);
    expect(attempted).toEqual([]);
    expect(putConfigEntity).not.toHaveBeenCalled();
  });
});

/**
 * Two connectors (ldap, csv) and two managed object types (user, role):
 *   in sync.json (legacy):  legacyLdapUser, legacyLdapRole, legacyCsvUser
 *   new-style:              ldapUser, ldapRole, csvUser, csvRole
 */
function setUpFilteredMappings({ withNew = true } = {}) {
  readConfigEntity.mockReset();
  readConfigEntity.mockImplementation(async () => ({
    mappings: [
      mappingOf('legacyLdapUser', 'ldap', 'user'),
      mappingOf('legacyLdapRole', 'ldap', 'role'),
      mappingOf('legacyCsvUser', 'csv', 'user'),
    ],
  }));
  readConfigEntitiesByType.mockReset();
  readConfigEntitiesByType.mockImplementation(async () =>
    withNew
      ? [
          mappingOf('ldapUser', 'ldap', 'user'),
          mappingOf('ldapRole', 'ldap', 'role'),
          mappingOf('csvUser', 'csv', 'user'),
          mappingOf('csvRole', 'csv', 'role'),
        ]
      : []
  );
}

/** The ids written back to sync.json by the one update, or undefined if there was none. */
const writtenToSyncJson = () =>
  putConfigEntity.mock.calls.length === 0
    ? undefined
    : putConfigEntity.mock.calls[0][0].entityData.mappings.map(
        (it: any) => it._id ?? it.name
      );

describe('readMappings, selection by connector and managed object type', () => {
  beforeEach(() => setUpFilteredMappings());

  test('connector only', async () => {
    const result = await readMappings({ connectorId: 'ldap', state });
    expect(names(result).sort()).toEqual(
      ['ldapRole', 'ldapUser', 'legacyLdapRole', 'legacyLdapUser'].sort()
    );
  });

  test('managed object type only', async () => {
    const result = await readMappings({ moType: 'role', state });
    expect(names(result).sort()).toEqual(
      ['csvRole', 'ldapRole', 'legacyLdapRole'].sort()
    );
  });

  test('both: only the mappings that belong to both', async () => {
    const result = await readMappings({
      connectorId: 'ldap',
      moType: 'user',
      state,
    });
    expect(names(result).sort()).toEqual(['ldapUser', 'legacyLdapUser']);
  });
});

describe('deleteMappings, mappings of a connector or a managed object type', () => {
  beforeEach(() => setUpFilteredMappings());

  test('connector: deletes only its new mappings, writes only the other legacy mappings to sync.json and returns only what it deleted', async () => {
    const result = await deleteMappings({ connectorId: 'ldap', state });

    expect(names(result).sort()).toEqual(
      ['ldapRole', 'ldapUser', 'legacyLdapRole', 'legacyLdapUser'].sort()
    );
    // the new mappings of the other connector are left alone
    expect([...attempted].sort()).toEqual([
      'mapping/ldapRole',
      'mapping/ldapUser',
    ]);
    // sync.json gets the legacy mappings that were not selected, and no new-style mapping
    expect(putConfigEntity).toHaveBeenCalledTimes(1);
    expect(writtenToSyncJson()).toEqual(['sync/legacyCsvUser']);
  });

  test('managed object type only: selects the mappings of that type, of every connector', async () => {
    const result = await deleteMappings({ moType: 'role', state });

    expect(names(result).sort()).toEqual(
      ['csvRole', 'ldapRole', 'legacyLdapRole'].sort()
    );
    expect([...attempted].sort()).toEqual([
      'mapping/csvRole',
      'mapping/ldapRole',
    ]);
    expect(writtenToSyncJson()?.sort()).toEqual([
      'sync/legacyCsvUser',
      'sync/legacyLdapUser',
    ]);
  });

  test('connector and managed object type: only the mappings that belong to both', async () => {
    const result = await deleteMappings({
      connectorId: 'ldap',
      moType: 'user',
      state,
    });

    expect(names(result).sort()).toEqual(['ldapUser', 'legacyLdapUser']);
    expect(attempted).toEqual(['mapping/ldapUser']);
    expect(writtenToSyncJson()?.sort()).toEqual([
      'sync/legacyCsvUser',
      'sync/legacyLdapRole',
    ]);
  });

  test('only new mappings selected: sync.json is not written', async () => {
    const result = await deleteMappings({
      connectorId: 'csv',
      moType: 'role',
      state,
    });

    expect(names(result)).toEqual(['csvRole']);
    expect(attempted).toEqual(['mapping/csvRole']);
    expect(putConfigEntity).not.toHaveBeenCalled();
  });

  test('only legacy mappings selected: no new mapping is deleted', async () => {
    setUpFilteredMappings({ withNew: false });

    const result = await deleteMappings({
      connectorId: 'csv',
      moType: 'user',
      state,
    });

    expect(names(result)).toEqual(['legacyCsvUser']);
    expect(attempted).toEqual([]);
    expect(writtenToSyncJson()?.sort()).toEqual([
      'sync/legacyLdapRole',
      'sync/legacyLdapUser',
    ]);
  });

  test('nothing selected: nothing is deleted, sync.json is not written and the result is empty', async () => {
    const result = await deleteMappings({ connectorId: 'unknown', state });

    expect(result).toEqual([]);
    expect(attempted).toEqual([]);
    expect(putConfigEntity).not.toHaveBeenCalled();
  });

  test('tries every selected mapping when one fails, leaves the others alone, and throws one error that names it', async () => {
    failing.add('mapping/ldapRole');

    const error: any = await deleteMappings({
      connectorId: 'ldap',
      state,
    }).catch((e) => e);

    // ldapUser comes after the failed ldapRole in some orders: both were tried; the csv mappings were not
    expect([...attempted].sort()).toEqual([
      'mapping/ldapRole',
      'mapping/ldapUser',
    ]);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting mappings');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error deleting mapping mapping/ldapRole'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('a failed update of sync.json is one error; the selected new mappings are still tried, the others are not', async () => {
    putConfigEntity.mockRejectedValue(failure);

    const error: any = await deleteMappings({
      connectorId: 'ldap',
      state,
    }).catch((e) => e);

    expect([...attempted].sort()).toEqual([
      'mapping/ldapRole',
      'mapping/ldapUser',
    ]);
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error updating legacy mappings'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('a selected legacy mapping that is still in sync.json after the update is reported together with a failed mapping', async () => {
    // sync.json answers the update with a selected mapping still in it
    putConfigEntity.mockImplementation(async () => ({
      mappings: [
        {
          ...mappingOf('legacyLdapUser', 'ldap', 'user'),
          _id: 'sync/legacyLdapUser',
        },
      ],
    }));
    failing.add('mapping/ldapRole');

    const error: any = await deleteMappings({
      connectorId: 'ldap',
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error deleting mappings');
    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error deleting mapping mapping/ldapRole',
      '1 mappings were not deleted from sync.json: sync/legacyLdapUser',
    ]);
  });
});

/**
 * With a result callback, the outcome of every mapping goes to the callback as it happens
 * (a failed delete as an error that names the mapping) and a failed delete does not throw.
 */
describe('deleteMappings, with a result callback', () => {
  /** What the callback was given: 'ok <name>' for a deleted mapping, the message for an error. */
  let reported: string[];
  const resultCallback = (error?: any, result?: any) => {
    reported.push(error ? error.message : `ok ${result.name}`);
  };

  beforeEach(() => {
    reported = [];
  });

  test('every outcome goes to the callback, in the order they were tried, and nothing is thrown', async () => {
    failing.add('mapping/b');

    const result = await deleteMappings({ resultCallback, state });

    expect(attempted).toEqual(['mapping/a', 'mapping/b', 'mapping/c']);
    expect(reported).toEqual([
      'ok legacyA',
      'ok a',
      'Error deleting mapping mapping/b',
      'ok c',
    ]);
    expect(names(result)).toEqual(['legacyA', 'a', 'c']);
  });

  test('every deleted mapping is reported exactly once', async () => {
    const result = await deleteMappings({ resultCallback, state });

    expect(reported).toEqual(['ok legacyA', 'ok a', 'ok b', 'ok c']);
    expect(names(result)).toEqual(['legacyA', 'a', 'b', 'c']);
  });

  test('a deleted new mapping is reported as deleteMapping returned it, the same object as in the result', async () => {
    deleteConfigEntity.mockImplementation(async ({ entityId }: any) => ({
      ...mapping(entityId.split('/')[1]),
      _id: entityId,
      deletedWith: 'the delete response',
    }));
    const results: any[] = [];

    const result = await deleteMappings({
      resultCallback: (_error?: any, deleted?: any) => results.push(deleted),
      state,
    });

    const newMappings = results.filter((it) => it.deletedWith);
    expect(newMappings).toHaveLength(3);
    for (const reportedMapping of newMappings) {
      expect(result).toContain(reportedMapping);
    }
  });

  test('the error passed to the callback carries the cause', async () => {
    failing.add('mapping/a');
    const errors: any[] = [];

    await deleteMappings({
      resultCallback: (error?: any) => {
        if (error) errors.push(error);
      },
      state,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(FrodoError);
    expect(rootCause(errors[0])).toBe(failure);
  });

  test('a failed update of sync.json is one error, the legacy mappings are not reported as deleted and the new mappings are still tried', async () => {
    putConfigEntity.mockRejectedValue(failure);

    const result = await deleteMappings({ resultCallback, state });

    expect(reported).toEqual([
      'Error updating legacy mappings',
      'ok a',
      'ok b',
      'ok c',
    ]);
    expect(names(result)).toEqual(['a', 'b', 'c']);
  });

  test('the facade passes the callback on', async () => {
    failing.add('mapping/b');

    await MappingOps(state).deleteMappings(
      undefined,
      undefined,
      resultCallback
    );

    expect(reported).toEqual([
      'ok legacyA',
      'ok a',
      'Error deleting mapping mapping/b',
      'ok c',
    ]);
  });

  test('a failed read of the mappings still throws and the callback is not called', async () => {
    readConfigEntity.mockRejectedValue(failure);

    const error: any = await deleteMappings({ resultCallback, state }).catch(
      (e) => e
    );

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting mappings');
    expect(rootCause(error)).toBe(failure);
    expect(reported).toEqual([]);
    expect(attempted).toEqual([]);
  });

  test('connector: only the selected mappings are reported, a failed one does not throw', async () => {
    setUpFilteredMappings();
    failing.add('mapping/ldapRole');

    const result = await deleteMappings({
      connectorId: 'ldap',
      resultCallback,
      state,
    });

    expect([...reported].sort()).toEqual(
      [
        'Error deleting mapping mapping/ldapRole',
        'ok ldapUser',
        'ok legacyLdapRole',
        'ok legacyLdapUser',
      ].sort()
    );
    expect(names(result).sort()).toEqual(
      ['ldapUser', 'legacyLdapRole', 'legacyLdapUser'].sort()
    );
    // the csv mappings are neither deleted nor reported
    expect([...attempted].sort()).toEqual([
      'mapping/ldapRole',
      'mapping/ldapUser',
    ]);
  });

  test('nothing selected: nothing is reported', async () => {
    setUpFilteredMappings();

    const result = await deleteMappings({
      connectorId: 'nosuchconnector',
      resultCallback,
      state,
    });

    expect(reported).toEqual([]);
    expect(result).toEqual([]);
  });

  test('a selected legacy mapping that is still in sync.json after the update is reported as an error, not as deleted', async () => {
    setUpFilteredMappings();
    // sync.json answers the update with a selected mapping still in it
    putConfigEntity.mockImplementation(async () => ({
      mappings: [
        {
          ...mappingOf('legacyLdapUser', 'ldap', 'user'),
          _id: 'sync/legacyLdapUser',
        },
      ],
    }));

    const result = await deleteMappings({
      connectorId: 'ldap',
      resultCallback,
      state,
    });

    expect([...reported].sort()).toEqual(
      [
        '1 mappings were not deleted from sync.json: sync/legacyLdapUser',
        'ok ldapRole',
        'ok ldapUser',
        'ok legacyLdapRole',
      ].sort()
    );
    expect(names(result)).not.toContain('legacyLdapUser');
  });
});

describe('deleteMapping, a legacy mapping that is still in sync.json after the update', () => {
  test('names the mapping by its id, not as [object Object]', async () => {
    setUpFilteredMappings();
    putConfigEntity.mockImplementation(async () => ({
      mappings: [
        {
          ...mappingOf('legacyLdapUser', 'ldap', 'user'),
          _id: 'sync/legacyLdapUser',
        },
      ],
    }));

    const error: any = await deleteMapping({
      mappingId: 'sync/legacyLdapUser',
      state,
    }).catch((e) => e);

    expect(rootCause(error).message).toBe(
      'Mapping sync/legacyLdapUser was not deleted from sync.json after successful update.'
    );
  });
});
