import { jest } from '@jest/globals';

/**
 * `importInternalRoles` tries every role. Without a result callback the
 * failures are collected and thrown as one combined error; with one, every
 * outcome is reported to it as it happens (a failed role as an error that
 * names it, with the cause nested), a failed role does not throw and is not
 * part of the result, and the roles that were imported are returned.
 * Mocked unit test: no recordings.
 */

const putInternalObject = jest.fn(async (args?: any): Promise<any> => ({
  _id: args?.id,
}));
const actualApi = await import('../api/InternalObjectApi');
jest.unstable_mockModule('../api/InternalObjectApi', () => ({
  ...actualApi,
  putInternalObject,
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  debugMessage: jest.fn(),
}));

const { default: InternalRoleOps, importInternalRoles } =
  await import('./InternalRoleOps');

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

/** the keys are the ids of the roles, which differ from their names */
function importData(): any {
  return {
    internalRole: {
      'id-1': {
        _id: 'id-1',
        _provider: { _id: 'provider' },
        _rev: '1',
        name: 'role-one',
        temporalConstraints: [],
      },
      'id-2': { _id: 'id-2', name: 'role-two' },
      'id-3': { _id: 'id-3', name: 'role-three' },
    },
  };
}

let failure: Error;

/** the write of the role is rejected */
const failRole = (roleId: string, error: Error = failure) =>
  putInternalObject.mockImplementation(async (args: any) => {
    if (args.id === roleId) throw error;
    return { _id: args.id };
  });

const ids = (roles: any[]) => roles.map((it) => it._id);

beforeEach(() => {
  failure = new Error('HTTP 400');
  jest.clearAllMocks();
  putInternalObject.mockReset();
  putInternalObject.mockImplementation(async (args: any) => ({
    _id: args.id,
  }));
});

describe('importInternalRoles', () => {
  test('imports every role, with and without a callback', async () => {
    const plain = await importInternalRoles({
      importData: importData(),
      state,
    });
    const reported: any[] = [];
    const withCallback = await importInternalRoles({
      importData: importData(),
      resultCallback: (error, role) => reported.push([error, role]),
      state,
    });

    expect(ids(plain)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(ids(withCallback)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ids(reported.map(([, role]) => role))).toEqual([
      'id-1',
      'id-2',
      'id-3',
    ]);
  });

  test('writes the role without provider and revision', async () => {
    await importInternalRoles({ importData: importData(), state });

    const written = putInternalObject.mock.calls.map(([args]) => args);
    expect(written.map((args) => args.id)).toEqual(['id-1', 'id-2', 'id-3']);
    expect(written[0].ioData._provider).toBeUndefined();
    expect(written[0].ioData._rev).toBeUndefined();
    expect(written[0].ioData.temporalConstraints).toBeUndefined();
  });

  test('with a callback a failed role is reported by name, with its cause, and the others are imported', async () => {
    failRole('id-2');
    const outcomes: any[] = [];

    const result = await importInternalRoles({
      importData: importData(),
      resultCallback: (error, role) => outcomes.push([error, role]),
      state,
    });

    expect(ids(result)).toEqual(['id-1', 'id-3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('id-1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe(
      'Error importing internal role role-two'
    );
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('id-3');
    expect(putInternalObject).toHaveBeenCalledTimes(3);
  });

  test('a role without a name is named by its id', async () => {
    const data = importData();
    delete data.internalRole['id-2'].name;
    failRole('id-2');
    const outcomes: any[] = [];

    await importInternalRoles({
      importData: data,
      resultCallback: (error, role) => outcomes.push([error, role]),
      state,
    });

    expect(outcomes[1][0].message).toBe('Error importing internal role id-2');
  });

  test('with a callback and every role failing nothing is thrown and nothing is returned', async () => {
    putInternalObject.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const result = await importInternalRoles({
      importData: importData(),
      resultCallback: (error, role) => outcomes.push([error, role]),
      state,
    });

    expect(result).toEqual([]);
    expect(outcomes.map(([error]) => error.message)).toEqual([
      'Error importing internal role role-one',
      'Error importing internal role role-two',
      'Error importing internal role role-three',
    ]);
    expect(outcomes.every(([, role]) => role === undefined)).toBe(true);
  });

  test('without a callback every role is tried, then one combined error is thrown with the error of each failure', async () => {
    putInternalObject.mockImplementation(async (args: any) => {
      if (args.id === 'id-1' || args.id === 'id-3') throw failure;
      return { _id: args.id };
    });

    const error: any = await importInternalRoles({
      importData: importData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing internal roles');
    // the errors as the write raised them: no wrapper that names the role
    expect(error.originalErrors.map((e: any) => e.message)).toEqual([
      'Error updating internal role id-1',
      'Error updating internal role id-3',
    ]);
    expect(rootCause(error.originalErrors[0])).toBe(failure);
    expect(rootCause(error.originalErrors[1])).toBe(failure);
    expect(putInternalObject).toHaveBeenCalledTimes(3);
  });

  test('every role is reported exactly once, in order, also when the callback throws', async () => {
    failRole('id-2');
    const calls: string[] = [];
    const boom = new Error('callback failed');

    const error: any = await importInternalRoles({
      importData: importData(),
      resultCallback: (failed, role) => {
        calls.push(failed ? failed.message : role._id);
        if (role?._id === 'id-1') throw boom;
      },
      state,
    }).catch((e) => e);

    // the exception of the callback ends the run; it is not reported back as
    // a failed role
    expect(calls).toEqual(['id-1']);
    expect(rootCause(error)).toBe(boom);
    expect(putInternalObject).toHaveBeenCalledTimes(1);
  });

  test('import data without roles still throws, with a callback too', async () => {
    const callback = jest.fn();

    await expect(
      importInternalRoles({
        importData: {} as any,
        resultCallback: callback,
        state,
      })
    ).rejects.toBeDefined();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('importInternalRoles on the facade', () => {
  test('passes the result callback on', async () => {
    failRole('id-2');
    const callback = jest.fn();

    const result = await InternalRoleOps(state).importInternalRoles(
      importData(),
      callback
    );

    expect(ids(result)).toEqual(['id-1', 'id-3']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect((callback.mock.calls[1][0] as any).message).toBe(
      'Error importing internal role role-two'
    );
  });

  test('without a callback it throws one combined error as before', async () => {
    failRole('id-2');

    const error: any = await InternalRoleOps(state)
      .importInternalRoles(importData())
      .catch((e) => e);

    expect(error.message).toBe('Error importing internal roles');
    expect(putInternalObject).toHaveBeenCalledTimes(3);
  });
});
