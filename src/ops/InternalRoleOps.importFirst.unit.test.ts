import { jest } from '@jest/globals';

/**
 * The facade method `importFirstInternalRole` imports the first role of the
 * import data only, as its name says and as the module function of the same
 * name does. It used to call `importInternalRoles` and so imported every role
 * of the file. The facade still returns an array (its declared type), with
 * the one role in it.
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

const { default: InternalRoleOps, importFirstInternalRole } =
  await import('./InternalRoleOps');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'cloud',
} as any;

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

beforeEach(() => {
  jest.clearAllMocks();
  putInternalObject.mockReset();
  putInternalObject.mockImplementation(async (args: any) => ({
    _id: args.id,
  }));
});

describe('the importFirstInternalRole facade method', () => {
  test('writes the first role only and returns an array of one', async () => {
    const result =
      await InternalRoleOps(state).importFirstInternalRole(importData());

    expect(putInternalObject).toHaveBeenCalledTimes(1);
    expect(putInternalObject.mock.calls[0][0]).toMatchObject({ id: 'id-1' });
    expect(Array.isArray(result)).toBe(true);
    expect(result.map((it) => it._id)).toEqual(['id-1']);
  });

  test('does not go on to the second role when the first fails', async () => {
    putInternalObject.mockImplementation(async () => {
      throw new Error('HTTP 400');
    });

    await expect(
      InternalRoleOps(state).importFirstInternalRole(importData())
    ).rejects.toThrow();
    expect(putInternalObject).toHaveBeenCalledTimes(1);
  });

  test('agrees with the module function of the same name', async () => {
    const viaFacade =
      await InternalRoleOps(state).importFirstInternalRole(importData());
    const viaFunction = await importFirstInternalRole({
      importData: importData(),
      state,
    });

    expect(viaFacade).toEqual([viaFunction]);
  });

  test('fails on an empty import file as the module function does', async () => {
    const empty = () => ({ internalRole: {} }) as any;
    const fromFunction = await importFirstInternalRole({
      importData: empty(),
      state,
    }).catch((error) => error);

    await expect(
      InternalRoleOps(state).importFirstInternalRole(empty())
    ).rejects.toThrow(fromFunction.message);
    expect(putInternalObject).not.toHaveBeenCalled();
  });
});
