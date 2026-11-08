import { jest } from '@jest/globals';

/**
 * `deleteMappings` tries every mapping. A mapping that cannot be deleted does
 * not stop the others; after all of them were tried the function throws one
 * error that carries one nested error per failed mapping, naming it.
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

const { deleteMappings } = await import('./MappingOps');
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

describe('deleteMappings, mappings of a connector', () => {
  test('deletes them and returns the deleted mappings', async () => {
    const result = await deleteMappings({ connectorId: 'ldap', state });

    expect(names(result)).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect(attempted).toEqual(
      expect.arrayContaining(['mapping/a', 'mapping/b', 'mapping/c'])
    );
    expect(putConfigEntity).toHaveBeenCalledTimes(1);
  });

  test('tries every mapping when one fails, and throws one error that names it', async () => {
    failing.add('mapping/b');

    const error: any = await deleteMappings({
      connectorId: 'ldap',
      state,
    }).catch((e) => e);

    // mapping/c comes after the failed mapping/b
    expect(attempted).toEqual(
      expect.arrayContaining(['mapping/a', 'mapping/b', 'mapping/c'])
    );
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error deleting mappings');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error deleting mapping mapping/b'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('a failed update of sync.json is one error and the new mappings are still tried', async () => {
    putConfigEntity.mockRejectedValue(failure);

    const error: any = await deleteMappings({
      connectorId: 'ldap',
      state,
    }).catch((e) => e);

    expect(attempted).toEqual(
      expect.arrayContaining(['mapping/a', 'mapping/b', 'mapping/c'])
    );
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error updating legacy mappings'
    );
  });

  test('a legacy mapping that is still in sync.json after the update is reported together with a failed mapping', async () => {
    // sync.json answers the update with the mapping still in it
    putConfigEntity.mockImplementation(async () => ({
      mappings: [{ ...mapping('legacyA'), _id: 'sync/legacyA' }],
    }));
    failing.add('mapping/b');

    const error: any = await deleteMappings({
      connectorId: 'ldap',
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error deleting mappings');
    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error deleting mapping mapping/b',
      '1 mappings were not deleted from sync.json: sync/legacyA',
    ]);
  });
});
