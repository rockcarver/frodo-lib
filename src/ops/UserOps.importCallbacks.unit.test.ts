import { jest } from '@jest/globals';

/**
 * `importUsers` and `importUserGroups` try every item. Without a result
 * callback the failures are collected and thrown as one combined error; with
 * one, every outcome is reported to it as it happens (a failed user or group
 * as an error that names it, with the cause nested), a failed item does not
 * throw and is not part of the result, and the items that were imported are
 * returned. An item that the filter leaves out is not reported. Mocked unit
 * test: no recordings.
 */

const putUser = jest.fn(async (args?: any): Promise<any> => ({
  _id: args?.userData?._id,
}));
const putUserConfig = jest.fn(
  async (args?: any): Promise<any> => args?.configData
);
const putUserGroup = jest.fn(async (args?: any): Promise<any> => ({
  _id: args?.groupData?._id,
}));

jest.unstable_mockModule('../api/UserApi', () => ({
  getUser: jest.fn(),
  getUserConfig: jest.fn(),
  getUserCount: jest.fn(),
  getUserGroup: jest.fn(),
  getUserGroups: jest.fn(),
  getUsers: jest.fn(),
  putUser,
  putUserConfig,
  putUserGroup,
}));

const {
  default: UserOps,
  importUsers,
  importUserGroups,
} = await import('./UserOps');

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

function userData(): any {
  return {
    user: {
      'user-1': { _id: 'user-1', config: { theme: 'one' } },
      'user-2': { _id: 'user-2', config: { theme: 'two' } },
      'user-3': { _id: 'user-3', config: { theme: 'three' } },
    },
  };
}

function groupData(): any {
  return {
    userGroup: {
      'group-1': { _id: 'group-1' },
      'group-2': { _id: 'group-2' },
      'group-3': { _id: 'group-3' },
    },
  };
}

let failure: Error;

const ids = (items: any[]) => items.map((it) => it._id);

beforeEach(() => {
  failure = new Error('HTTP 400');
  jest.clearAllMocks();
  putUser.mockReset();
  putUser.mockImplementation(async (args: any) => ({
    _id: args.userData._id,
  }));
  putUserConfig.mockReset();
  putUserConfig.mockImplementation(async (args: any) => args.configData);
  putUserGroup.mockReset();
  putUserGroup.mockImplementation(async (args: any) => ({
    _id: args.groupData._id,
  }));
});

describe('importUsers', () => {
  /** the write of the user is rejected */
  const failUser = (userId: string, error: Error = failure) =>
    putUser.mockImplementation(async (args: any) => {
      if (args.userData._id === userId) throw error;
      return { _id: args.userData._id };
    });

  test('imports every user with its config, with and without a callback', async () => {
    const plain = await importUsers({ importData: userData(), state });
    const reported: any[] = [];
    const withCallback = await importUsers({
      importData: userData(),
      resultCallback: (error, user) => reported.push([error, user]),
      state,
    });

    expect(ids(plain)).toEqual(['user-1', 'user-2', 'user-3']);
    expect(plain[0].config).toEqual({ theme: 'one' });
    expect(ids(withCallback)).toEqual(['user-1', 'user-2', 'user-3']);
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ids(reported.map(([, user]) => user))).toEqual([
      'user-1',
      'user-2',
      'user-3',
    ]);
    expect(reported[1][1].config).toEqual({ theme: 'two' });
  });

  test('with a callback a failed user is reported by name, with its cause, and the others are imported', async () => {
    failUser('user-2');
    const outcomes: any[] = [];

    const result = await importUsers({
      importData: userData(),
      resultCallback: (error, user) => outcomes.push([error, user]),
      state,
    });

    expect(ids(result)).toEqual(['user-1', 'user-3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('user-1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe('Error importing user user-2');
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('user-3');
    expect(putUser).toHaveBeenCalledTimes(3);
    // the config of a user that could not be written is not written either
    expect(putUserConfig).toHaveBeenCalledTimes(2);
  });

  test('a user whose config cannot be written is a failed user, reported once', async () => {
    putUserConfig.mockImplementation(async (args: any) => {
      if (args.userId === 'user-2') throw failure;
      return args.configData;
    });
    const outcomes: any[] = [];

    const result = await importUsers({
      importData: userData(),
      resultCallback: (error, user) => outcomes.push([error, user]),
      state,
    });

    expect(ids(result)).toEqual(['user-1', 'user-3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[1][0].message).toBe('Error importing user user-2');
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[1][1]).toBeUndefined();
    expect(putUser).toHaveBeenCalledTimes(3);
  });

  test('with a callback and every user failing nothing is thrown and nothing is returned', async () => {
    putUser.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const result = await importUsers({
      importData: userData(),
      resultCallback: (error, user) => outcomes.push([error, user]),
      state,
    });

    expect(result).toEqual([]);
    expect(outcomes.map(([error]) => error.message)).toEqual([
      'Error importing user user-1',
      'Error importing user user-2',
      'Error importing user user-3',
    ]);
    expect(outcomes.every(([, user]) => user === undefined)).toBe(true);
  });

  test('without a callback every user is tried, then one combined error is thrown with the error of each failure', async () => {
    putUser.mockImplementation(async (args: any) => {
      if (args.userData._id !== 'user-2') throw failure;
      return { _id: args.userData._id };
    });

    const error: any = await importUsers({
      importData: userData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing users');
    // the errors as the write raised them: no wrapper that names the item
    expect(error.originalErrors).toHaveLength(2);
    expect(error.originalErrors[0]).toBe(failure);
    expect(error.originalErrors[1]).toBe(failure);
    expect(putUser).toHaveBeenCalledTimes(3);
  });

  test('the filter by id leaves the others out, and they are not reported', async () => {
    const outcomes: any[] = [];

    const result = await importUsers({
      importData: userData(),
      userId: 'user-3',
      resultCallback: (error, user) => outcomes.push([error, user]),
      state,
    });

    expect(ids(result)).toEqual(['user-3']);
    expect(outcomes).toHaveLength(1);
    expect(putUser).toHaveBeenCalledTimes(1);
  });

  test('every user is reported exactly once, in order, also when the callback throws', async () => {
    failUser('user-2');
    const calls: string[] = [];
    const boom = new Error('callback failed');

    const error: any = await importUsers({
      importData: userData(),
      resultCallback: (failed, user) => {
        calls.push(failed ? failed.message : user._id);
        if (user?._id === 'user-1') throw boom;
      },
      state,
    }).catch((e) => e);

    // the exception of the callback ends the run; it is not reported back as
    // a failed user
    expect(calls).toEqual(['user-1']);
    expect(rootCause(error)).toBe(boom);
    expect(putUser).toHaveBeenCalledTimes(1);
  });

  test('import data without users still throws, with a callback too', async () => {
    const callback = jest.fn();

    await expect(
      importUsers({
        importData: {} as any,
        resultCallback: callback,
        state,
      })
    ).rejects.toBeDefined();
    expect(callback).not.toHaveBeenCalled();
  });

  test('on the facade it passes the result callback on', async () => {
    failUser('user-2');
    const callback = jest.fn();

    const result = await UserOps(state).importUsers(
      userData(),
      undefined,
      callback
    );

    expect(ids(result)).toEqual(['user-1', 'user-3']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect((callback.mock.calls[1][0] as any).message).toBe(
      'Error importing user user-2'
    );
  });

  test('on the facade, without a callback it throws one combined error as before', async () => {
    failUser('user-2');

    const error: any = await UserOps(state)
      .importUsers(userData())
      .catch((e) => e);

    expect(error.message).toBe('Error importing users');
    expect(putUser).toHaveBeenCalledTimes(3);
  });
});

describe('importUserGroups', () => {
  /** the write of the group is rejected */
  const failGroup = (groupId: string, error: Error = failure) =>
    putUserGroup.mockImplementation(async (args: any) => {
      if (args.groupData._id === groupId) throw error;
      return { _id: args.groupData._id };
    });

  test('imports every group, with and without a callback', async () => {
    const plain = await importUserGroups({ importData: groupData(), state });
    const reported: any[] = [];
    const withCallback = await importUserGroups({
      importData: groupData(),
      resultCallback: (error, group) => reported.push([error, group]),
      state,
    });

    expect(ids(plain)).toEqual(['group-1', 'group-2', 'group-3']);
    expect(ids(withCallback)).toEqual(['group-1', 'group-2', 'group-3']);
    expect(reported.map(([error]) => error)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(ids(reported.map(([, group]) => group))).toEqual([
      'group-1',
      'group-2',
      'group-3',
    ]);
  });

  test('with a callback a failed group is reported by name, with its cause, and the others are imported', async () => {
    failGroup('group-2');
    const outcomes: any[] = [];

    const result = await importUserGroups({
      importData: groupData(),
      resultCallback: (error, group) => outcomes.push([error, group]),
      state,
    });

    expect(ids(result)).toEqual(['group-1', 'group-3']);
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0][0]).toBeUndefined();
    expect(outcomes[0][1]._id).toBe('group-1');
    expect(outcomes[1][1]).toBeUndefined();
    expect(outcomes[1][0].message).toBe('Error importing user group group-2');
    expect(rootCause(outcomes[1][0])).toBe(failure);
    expect(outcomes[2][0]).toBeUndefined();
    expect(outcomes[2][1]._id).toBe('group-3');
    expect(putUserGroup).toHaveBeenCalledTimes(3);
  });

  test('with a callback and every group failing nothing is thrown and nothing is returned', async () => {
    putUserGroup.mockRejectedValue(failure);
    const outcomes: any[] = [];

    const result = await importUserGroups({
      importData: groupData(),
      resultCallback: (error, group) => outcomes.push([error, group]),
      state,
    });

    expect(result).toEqual([]);
    expect(outcomes.map(([error]) => error.message)).toEqual([
      'Error importing user group group-1',
      'Error importing user group group-2',
      'Error importing user group group-3',
    ]);
    expect(outcomes.every(([, group]) => group === undefined)).toBe(true);
  });

  test('without a callback every group is tried, then one combined error is thrown with the error of each failure', async () => {
    putUserGroup.mockImplementation(async (args: any) => {
      if (args.groupData._id !== 'group-2') throw failure;
      return { _id: args.groupData._id };
    });

    const error: any = await importUserGroups({
      importData: groupData(),
      state,
    }).catch((e) => e);

    expect(error.message).toBe('Error importing user groups');
    // the errors as the write raised them: no wrapper that names the item
    expect(error.originalErrors).toHaveLength(2);
    expect(error.originalErrors[0]).toBe(failure);
    expect(error.originalErrors[1]).toBe(failure);
    expect(putUserGroup).toHaveBeenCalledTimes(3);
  });

  test('the filter by id leaves the others out, and they are not reported', async () => {
    const outcomes: any[] = [];

    const result = await importUserGroups({
      importData: groupData(),
      groupId: 'group-2',
      resultCallback: (error, group) => outcomes.push([error, group]),
      state,
    });

    expect(ids(result)).toEqual(['group-2']);
    expect(outcomes).toHaveLength(1);
    expect(putUserGroup).toHaveBeenCalledTimes(1);
  });

  test('every group is reported exactly once, in order, also when the callback throws', async () => {
    failGroup('group-2');
    const calls: string[] = [];
    const boom = new Error('callback failed');

    const error: any = await importUserGroups({
      importData: groupData(),
      resultCallback: (failed, group) => {
        calls.push(failed ? failed.message : group._id);
        if (group?._id === 'group-1') throw boom;
      },
      state,
    }).catch((e) => e);

    expect(calls).toEqual(['group-1']);
    expect(rootCause(error)).toBe(boom);
    expect(putUserGroup).toHaveBeenCalledTimes(1);
  });

  test('import data without groups still throws, with a callback too', async () => {
    const callback = jest.fn();

    await expect(
      importUserGroups({
        importData: {} as any,
        resultCallback: callback,
        state,
      })
    ).rejects.toBeDefined();
    expect(callback).not.toHaveBeenCalled();
  });

  test('on the facade it passes the result callback on', async () => {
    failGroup('group-2');
    const callback = jest.fn();

    const result = await UserOps(state).importUserGroups(
      groupData(),
      undefined,
      callback
    );

    expect(ids(result)).toEqual(['group-1', 'group-3']);
    expect(callback).toHaveBeenCalledTimes(3);
    expect((callback.mock.calls[1][0] as any).message).toBe(
      'Error importing user group group-2'
    );
  });

  test('on the facade, without a callback it throws one combined error as before', async () => {
    failGroup('group-2');

    const error: any = await UserOps(state)
      .importUserGroups(groupData())
      .catch((e) => e);

    expect(error.message).toBe('Error importing user groups');
    expect(putUserGroup).toHaveBeenCalledTimes(3);
  });
});
