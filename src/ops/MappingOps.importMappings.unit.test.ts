import { jest } from '@jest/globals';

/**
 * `importMappings` tries every mapping. Without a result callback a mapping
 * that cannot be imported does not stop the others and the function throws one
 * error after all of them were tried. With a result callback the outcome of
 * every mapping is passed to it as it happens (a failed mapping as an error that
 * names it and carries the cause), nothing is thrown for a failed mapping and
 * the mappings that were imported are returned.
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

const { default: MappingOps, importMappings } = await import('./MappingOps');
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

const newMapping = (name: string) => ({
  _id: `mapping/${name}`,
  name,
  source: 'system/ldap/account',
  target: 'managed/user',
});

const legacyMapping = (name: string) => ({
  _id: `sync/${name}`,
  name,
  source: 'system/ldap/account',
  target: 'managed/user',
});

/** Import data with the given new-style and legacy mappings. */
function importDataOf(news: string[], legacies: string[] = []): any {
  return {
    mapping: Object.fromEntries(
      news.map((name) => [`mapping/${name}`, newMapping(name)])
    ),
    sync: { _id: 'sync', mappings: legacies.map(legacyMapping) },
  };
}

let written: string[];
let failure: Error;
/** entity ids (new-style) and legacy mapping names (sync.json) that fail to be written */
let failingEntities: Set<string>;
let failingLegacy: Set<string>;
let syncJson: any[];

beforeEach(() => {
  jest.clearAllMocks();
  written = [];
  failure = new Error('HTTP 500');
  failingEntities = new Set();
  failingLegacy = new Set();
  syncJson = [];
  readConfigEntity.mockReset();
  readConfigEntity.mockImplementation(async () => ({
    _id: 'sync',
    // fresh objects on every call: the code adds an _id to what it reads
    mappings: syncJson.map((it) => ({ ...it })),
  }));
  putConfigEntity.mockReset();
  putConfigEntity.mockImplementation(async ({ entityId, entityData }: any) => {
    if (entityId === 'sync') {
      const bad = entityData.mappings.find((it: any) =>
        failingLegacy.has(it.name)
      );
      if (bad) {
        written.push(`sync(${bad.name} failed)`);
        throw failure;
      }
      syncJson = entityData.mappings;
      written.push(
        `sync(${entityData.mappings.map((it: any) => it.name).join(',')})`
      );
      return { mappings: entityData.mappings };
    }
    written.push(entityId);
    if (failingEntities.has(entityId)) throw failure;
    return { ...entityData, _id: entityId };
  });
});

const ids = (result: any[]) => result.map((it) => it._id ?? `sync/${it.name}`);

describe('importMappings, without a result callback', () => {
  test('imports the new and the legacy mappings and returns them', async () => {
    const result = await importMappings({
      importData: importDataOf(['a', 'b'], ['x']),
      state,
    });

    expect(ids(result)).toEqual(['mapping/a', 'mapping/b', 'sync/x']);
    expect(written).toEqual(['mapping/a', 'mapping/b', 'sync(x)']);
  });

  test('tries every mapping when one fails, then throws one error with one nested error per failed mapping', async () => {
    failingEntities.add('mapping/b');

    const error: any = await importMappings({
      importData: importDataOf(['a', 'b', 'c'], ['x']),
      state,
    }).catch((e) => e);

    expect(written).toEqual(['mapping/a', 'mapping/b', 'mapping/c', 'sync(x)']);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error importing mappings');
    expect(error.originalErrors).toHaveLength(1);
    expect(error.originalErrors[0].message).toBe(
      'Error updating mapping mapping/b'
    );
    expect(rootCause(error)).toBe(failure);
  });

  test('names every failed mapping, in the order they were tried', async () => {
    failingEntities.add('mapping/a');
    failingLegacy.add('x');

    const error: any = await importMappings({
      importData: importDataOf(['a', 'b'], ['x', 'y']),
      state,
    }).catch((e) => e);

    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error updating mapping mapping/a',
      'Error updating sync mapping sync/x',
    ]);
  });

  test('throws for every mapping when all fail', async () => {
    failingEntities.add('mapping/a');
    failingEntities.add('mapping/b');

    const error: any = await importMappings({
      importData: importDataOf(['a', 'b']),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing mappings');
    expect(error.originalErrors).toHaveLength(2);
  });

  test('imports nothing and does not throw for import data without mappings', async () => {
    expect(await importMappings({ importData: {} as any, state })).toEqual([]);
    expect(written).toEqual([]);
  });
});

describe('importMappings, with a result callback', () => {
  test('passes every imported mapping to it, once and in order, and returns them', async () => {
    const callback = jest.fn();

    const result = await importMappings({
      importData: importDataOf(['a', 'b'], ['x']),
      resultCallback: callback,
      state,
    });

    expect(ids(result)).toEqual(['mapping/a', 'mapping/b', 'sync/x']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect(callback.mock.calls.map((call) => call[0])).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(callback.mock.calls.map((call: any[]) => ids([call[1]])[0])).toEqual(
      ['mapping/a', 'mapping/b', 'sync/x']
    );
  });

  test('a failed mapping goes to it as an error that names it, the others are imported and returned, nothing is thrown', async () => {
    failingEntities.add('mapping/b');
    const callback = jest.fn();

    const result = await importMappings({
      importData: importDataOf(['a', 'b', 'c'], ['x']),
      resultCallback: callback,
      state,
    });

    expect(written).toEqual(['mapping/a', 'mapping/b', 'mapping/c', 'sync(x)']);
    expect(ids(result)).toEqual(['mapping/a', 'mapping/c', 'sync/x']);
    expect(callback).toHaveBeenCalledTimes(4);
    const [okA, failed, okC, okX] = callback.mock.calls as any[];
    expect(okA[0]).toBeUndefined();
    expect(okA[1]._id).toBe('mapping/a');
    expect(failed[1]).toBeUndefined();
    expect(failed[0]).toBeInstanceOf(FrodoError);
    expect(failed[0].message).toBe('Error importing mapping mapping/b');
    expect(failed[0].originalErrors[0].message).toBe(
      'Error updating mapping mapping/b'
    );
    expect(rootCause(failed[0])).toBe(failure);
    expect(okC[0]).toBeUndefined();
    expect(okC[1]._id).toBe('mapping/c');
    expect(okX[0]).toBeUndefined();
  });

  test('a legacy mapping that fails goes to it as an error that names it and the others are imported', async () => {
    failingLegacy.add('x');
    const callback = jest.fn();

    const result = await importMappings({
      importData: importDataOf(['a'], ['x', 'y']),
      resultCallback: callback,
      state,
    });

    expect(ids(result)).toEqual(['mapping/a', 'sync/y']);
    expect(callback).toHaveBeenCalledTimes(3);
    const failed: any = callback.mock.calls[1][0];
    expect(failed.message).toBe('Error importing mapping sync/x');
    expect(failed.originalErrors[0].message).toBe(
      'Error updating sync mapping sync/x'
    );
    expect(rootCause(failed)).toBe(failure);
    expect(callback.mock.calls[1][1]).toBeUndefined();
    expect(callback.mock.calls[2][0]).toBeUndefined();
  });

  test('a failed read of sync.json fails the legacy mappings, and the new mappings are still imported', async () => {
    readConfigEntity.mockRejectedValue(failure);
    const callback = jest.fn();

    const result = await importMappings({
      importData: importDataOf(['a', 'b'], ['x']),
      resultCallback: callback,
      state,
    });

    expect(ids(result)).toEqual(['mapping/a', 'mapping/b']);
    expect(callback).toHaveBeenCalledTimes(3);
    const failed: any = callback.mock.calls[2][0];
    expect(failed.message).toBe('Error importing mapping sync/x');
    expect(failed.originalErrors[0].message).toBe(
      'Error updating sync mapping sync/x'
    );
    expect(rootCause(failed)).toBe(failure);
    expect(written).toEqual(['mapping/a', 'mapping/b']);
  });

  test('reports every mapping as failed and returns nothing when all fail', async () => {
    failingEntities.add('mapping/a');
    failingEntities.add('mapping/b');
    const callback = jest.fn();

    const result = await importMappings({
      importData: importDataOf(['a', 'b']),
      resultCallback: callback,
      state,
    });

    expect(result).toEqual([]);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls.map((call: any[]) => call[0].message)).toEqual([
      'Error importing mapping mapping/a',
      'Error importing mapping mapping/b',
    ]);
    expect(callback.mock.calls.every((call) => call[1] === undefined)).toBe(
      true
    );
  });

  test('names a mapping with an invalid id by its name, or by its position when it has no name', async () => {
    const callback = jest.fn();
    const importData = importDataOf(['a']);
    importData.mapping.noId = { name: 'noId', source: 's', target: 't' };
    importData.mapping.nothing = { source: 's', target: 't' };

    const result = await importMappings({
      importData,
      resultCallback: callback,
      state,
    });

    expect(ids(result)).toEqual(['mapping/a']);
    expect(callback.mock.calls.map((call: any[]) => call[0]?.message)).toEqual([
      undefined,
      'Error importing mapping noId',
      'Error importing mapping at position 3',
    ]);
    // the invalid ones never reached the tenant
    expect(written).toEqual(['mapping/a']);
  });

  test('an exception of the callback is not taken for a failed import and not reported a second time', async () => {
    const callback = jest.fn((_error?: any, _result?: any) => {
      throw new Error('callback failed');
    });

    await expect(
      importMappings({
        importData: importDataOf(['a', 'b']),
        resultCallback: callback,
        state,
      })
    ).rejects.toThrow('callback failed');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeUndefined();
    expect(written).toEqual(['mapping/a']);
  });
});

describe('importMappings on the facade', () => {
  test('passes the result callback on', async () => {
    failingEntities.add('mapping/a');
    const callback = jest.fn();

    const result = await MappingOps(state).importMappings(
      importDataOf(['a', 'b']),
      undefined,
      callback
    );

    expect(ids(result)).toEqual(['mapping/b']);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[0][0].message).toBe(
      'Error importing mapping mapping/a'
    );
  });

  test('without a callback it throws one combined error as before', async () => {
    failingEntities.add('mapping/a');

    const error: any = await MappingOps(state)
      .importMappings(importDataOf(['a', 'b']))
      .catch((e) => e);

    expect(error.message).toBe('Error importing mappings');
    expect(written).toEqual(['mapping/a', 'mapping/b']);
  });
});
