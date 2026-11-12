import { jest } from '@jest/globals';

/**
 * `importRealms` tries every realm. Without a result callback the failures are
 * collected and thrown as one combined error; with one, every outcome is
 * reported to it as it happens (a failed realm as an error that names it, with
 * the cause nested), a failed realm does not throw and is not part of the
 * result, and the realms that were imported are returned. A realm that the
 * filter leaves out is not reported. Mocked unit test: no recordings.
 */

const putRealm = jest.fn(async (args?: any): Promise<any> => ({
  _id: args?.realmId,
  name: args?.realmData?.name,
}));
jest.unstable_mockModule('../api/RealmApi', () => ({
  createRealm: jest.fn(),
  deleteRealm: jest.fn(),
  getRealm: jest.fn(),
  getRealms: jest.fn(),
  putRealm,
}));

const { default: RealmOps, importRealms } = await import('./RealmOps');

const state = {
  getRealm: () => 'alpha',
  getDebugHandler: () => undefined,
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

/** the keys and ids differ from the names */
function importData(): any {
  return {
    realm: {
      'id-1': { _id: 'id-1', name: 'alpha', active: true },
      'id-2': { _id: 'id-2', name: 'bravo', active: true },
      'id-3': { _id: 'id-3', name: 'charlie', active: true },
    },
  };
}

let failure: Error;

/** the write of the realm is rejected */
const failRealm = (realmId: string, error: Error = failure) =>
  putRealm.mockImplementation(async (args: any) => {
    if (args.realmId === realmId) throw error;
    return { _id: args.realmId, name: args.realmData.name };
  });

const ids = (realms: any[]) => realms.map((it) => it._id);

beforeEach(() => {
  failure = new Error('HTTP 400');
  jest.clearAllMocks();
  putRealm.mockReset();
  putRealm.mockImplementation(async (args: any) => ({
    _id: args.realmId,
    name: args.realmData.name,
  }));
});

describe('importRealms', () => {
  test('imports every realm, with and without a callback', async () => {
    const plain = await importRealms({ importData: importData(), state });
    const reported: any[] = [];
    const withCallback = await importRealms({
      importData: importData(),
      resultCallback: (error, realm) => reported.push([error, realm]),
      state,
    });

    expect(ids(plain)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(ids(withCallback)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ids(reported.map(([, realm]) => realm))).toEqual([
      'id-1',
      'id-2',
      'id-3',
    ]);
  });

  test('with a callback a failed realm is reported by name, with its cause, and the others are imported', async () => {
    failRealm('id-2');
    const outcomes: any[] = [];

    const result = await importRealms({
      importData: importData(),
      resultCallback: (error, realm) => outcomes.push([error, realm]),
      state,
    });

    expect(ids(result)).toEqual(['id-1', 'id-3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('id-1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe('Error importing realm bravo');
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('id-3');
    expect(putRealm).toHaveBeenCalledTimes(3);
  });

  test('a realm without a name is named by its id', async () => {
    const data = importData();
    delete data.realm['id-2'].name;
    failRealm('id-2');
    const outcomes: any[] = [];

    await importRealms({
      importData: data,
      resultCallback: (error, realm) => outcomes.push([error, realm]),
      state,
    });

    expect(outcomes[1][0].message).toBe('Error importing realm id-2');
  });

  test('with a callback and every realm failing nothing is thrown and nothing is returned', async () => {
    putRealm.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const result = await importRealms({
      importData: importData(),
      resultCallback: (error, realm) => outcomes.push([error, realm]),
      state,
    });

    expect(result).toEqual([]);
    expect(outcomes.map(([error]) => error.message)).toEqual([
      'Error importing realm alpha',
      'Error importing realm bravo',
      'Error importing realm charlie',
    ]);
    expect(outcomes.every(([, realm]) => realm === undefined)).toBe(true);
  });

  test('without a callback every realm is tried, then one combined error is thrown with the error of each failure', async () => {
    putRealm.mockImplementation(async (args: any) => {
      if (args.realmId !== 'id-2') throw failure;
      return { _id: args.realmId };
    });

    const error: any = await importRealms({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing realms');
    // the errors as the write raised them: no wrapper that names the item
    expect(error.originalErrors).toHaveLength(2);
    expect(error.originalErrors[0]).toBe(failure);
    expect(error.originalErrors[1]).toBe(failure);
    expect(putRealm).toHaveBeenCalledTimes(3);
  });

  test('the filter by id leaves the others out, and they are not reported', async () => {
    const outcomes: any[] = [];

    const result = await importRealms({
      importData: importData(),
      realmId: 'id-2',
      resultCallback: (error, realm) => outcomes.push([error, realm]),
      state,
    });

    expect(ids(result)).toEqual(['id-2']);
    expect(outcomes).toHaveLength(1);
    expect(putRealm).toHaveBeenCalledTimes(1);
  });

  test('the filter by name leaves the others out, and they are not reported', async () => {
    const outcomes: any[] = [];

    const result = await importRealms({
      importData: importData(),
      realmName: 'charlie',
      resultCallback: (error, realm) => outcomes.push([error, realm]),
      state,
    });

    expect(ids(result)).toEqual(['id-3']);
    expect(outcomes).toHaveLength(1);
    expect(putRealm).toHaveBeenCalledTimes(1);
  });

  test('a filter that matches nothing reports nothing and returns nothing', async () => {
    const callback = jest.fn();

    const result = await importRealms({
      importData: importData(),
      realmId: 'unknown',
      resultCallback: callback,
      state,
    });

    expect(result).toEqual([]);
    expect(callback).not.toHaveBeenCalled();
    expect(putRealm).not.toHaveBeenCalled();
  });

  test('every realm is reported exactly once, in order, also when the callback throws', async () => {
    failRealm('id-2');
    const calls: string[] = [];
    const boom = new Error('callback failed');

    const error: any = await importRealms({
      importData: importData(),
      resultCallback: (failed, realm) => {
        calls.push(failed ? failed.message : realm._id);
        if (realm?._id === 'id-1') throw boom;
      },
      state,
    }).catch((e) => e);

    // the exception of the callback ends the run; it is not reported back as
    // a failed realm
    expect(calls).toEqual(['id-1']);
    expect(rootCause(error)).toBe(boom);
    expect(putRealm).toHaveBeenCalledTimes(1);
  });

  test('import data without realms still throws, with a callback too', async () => {
    const callback = jest.fn();

    await expect(
      importRealms({
        importData: {} as any,
        resultCallback: callback,
        state,
      })
    ).rejects.toBeDefined();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('importRealms on the facade', () => {
  test('passes the result callback on', async () => {
    failRealm('id-2');
    const callback = jest.fn();

    const result = await RealmOps(state).importRealms(
      importData(),
      undefined,
      undefined,
      callback
    );

    expect(ids(result)).toEqual(['id-1', 'id-3']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect((callback.mock.calls[1][0] as any).message).toBe(
      'Error importing realm bravo'
    );
  });

  test('passes the filter on', async () => {
    const result = await RealmOps(state).importRealms(
      importData(),
      undefined,
      'alpha'
    );

    expect(ids(result)).toEqual(['id-1']);
  });

  test('without a callback it throws one combined error as before', async () => {
    failRealm('id-2');

    const error: any = await RealmOps(state)
      .importRealms(importData())
      .catch((e) => e);

    expect(error.message).toBe('Error importing realms');
    expect(putRealm).toHaveBeenCalledTimes(3);
  });
});
