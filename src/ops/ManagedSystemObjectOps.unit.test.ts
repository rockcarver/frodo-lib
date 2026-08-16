import { jest } from '@jest/globals';

const getManagedSystemObject = jest.fn(async (_args?: any): Promise<any> => ({}));
const patchManagedSystemObject = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/ManagedSystemObjectApi', () => ({
  countManagedSystemObjects: jest.fn(),
  createManagedSystemObject: jest.fn(),
  DEFAULT_PAGE_SIZE: 1000,
  deleteManagedSystemObject: jest.fn(),
  getManagedSystemObject,
  getManagedSystemObjectSchema: jest.fn(),
  patchManagedSystemObject,
  putManagedSystemObject: jest.fn(),
  queryAllManagedSystemObjectsByType: jest.fn(),
  queryManagedSystemObjects: jest.fn(),
  queryRelatedManagedSystemObjects: jest.fn(),
}));

const { readRelationship, addRelationship, removeRelationship, replaceRelationship } =
  await import('./ManagedSystemObjectOps');

describe('ManagedSystemObjectOps relationship helpers', () => {
  beforeEach(() => {
    getManagedSystemObject.mockReset();
    patchManagedSystemObject.mockReset();
    getManagedSystemObject.mockResolvedValue({});
    patchManagedSystemObject.mockResolvedValue({});
  });

  test('readRelationship reads the field directly off a managed system object, requesting only that field', async () => {
    getManagedSystemObject.mockResolvedValue({
      teamMembers: [{ _ref: 'managed/svcacct/sa-1' }],
    });

    const result = await readRelationship({
      type: 'teammember',
      id: 'admin-1',
      field: 'teamMembers',
      state: {} as any,
    });

    expect(getManagedSystemObject).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'teammember',
        id: 'admin-1',
        fields: ['teamMembers'],
      })
    );
    expect(result).toEqual([{ _ref: 'managed/svcacct/sa-1' }]);
  });

  test('addRelationship uses field "/field/-" (JSON Pointer append) and a bare { _ref, _refProperties } value, target always addressed under managed/', async () => {
    await addRelationship({
      type: 'svcacct',
      id: 'sa-1',
      field: 'scopes',
      target: { type: 'alpha_role', id: 'role-1' },
      state: {} as any,
    });

    expect(patchManagedSystemObject).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'svcacct',
        id: 'sa-1',
        operations: [
          {
            operation: 'add',
            field: '/scopes/-',
            value: {
              _ref: 'managed/alpha_role/role-1',
              _refProperties: {},
            },
          },
        ],
      })
    );
  });

  test('removeRelationship reads the current value first and removes the exact stored element, bare (not array-wrapped), including IDM\'s own _refProperties', async () => {
    const storedElement = {
      _ref: 'managed/alpha_role/role-1',
      _refResourceCollection: 'managed/alpha_role',
      _refResourceId: 'role-1',
      _refProperties: { _id: 'rel-id-1', _rev: 'rel-rev-1' },
    };
    getManagedSystemObject.mockResolvedValue({ scopes: [storedElement] });

    await removeRelationship({
      type: 'svcacct',
      id: 'sa-1',
      field: 'scopes',
      target: { type: 'alpha_role', id: 'role-1' },
      state: {} as any,
    });

    expect(patchManagedSystemObject).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          { operation: 'remove', field: '/scopes', value: storedElement },
        ],
      })
    );
  });

  test('removeRelationship throws rather than silently no-op\'ing when the target is not currently a member', async () => {
    getManagedSystemObject.mockResolvedValue({ scopes: [] });

    await expect(
      removeRelationship({
        type: 'svcacct',
        id: 'sa-1',
        field: 'scopes',
        target: { type: 'alpha_role', id: 'role-1' },
        state: {} as any,
      })
    ).rejects.toThrow(/not currently a member/);
    expect(patchManagedSystemObject).not.toHaveBeenCalled();
  });

  test('replaceRelationship handles null to clear a single-valued field', async () => {
    await replaceRelationship({
      type: 'teammember',
      id: 'admin-1',
      field: 'manager',
      target: null,
      state: {} as any,
    });

    expect(patchManagedSystemObject).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [{ operation: 'replace', field: '/manager', value: null }],
      })
    );
  });
});
