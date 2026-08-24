import { jest } from '@jest/globals';

const getManagedObject = jest.fn(async (_args?: any): Promise<any> => ({}));
const getManagedSystemObject = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const patchManagedObject = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const createManagedObjectApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const queryManagedObjectsApi = jest.fn(
  async (_args?: any): Promise<any> => ({
    result: [],
    resultCount: 0,
    pagedResultsCookie: null,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  })
);

const getManagedObjectSchemaApi = jest.fn(
  async (_args?: any): Promise<any> => ({ properties: {} })
);
const getManagedObjectSchemaPropertyApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const putManagedObjectSchemaPropertyApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const deleteManagedObjectSchemaPropertyApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);

jest.unstable_mockModule('../api/ManagedObjectApi', () => ({
  countManagedObjects: jest.fn(),
  createManagedObject: createManagedObjectApi,
  DEFAULT_PAGE_SIZE: 1000,
  deleteManagedObject: jest.fn(),
  deleteManagedObjectSchemaProperty: deleteManagedObjectSchemaPropertyApi,
  getManagedObject,
  getManagedObjectSchema: getManagedObjectSchemaApi,
  getManagedObjectSchemaProperty: getManagedObjectSchemaPropertyApi,
  patchManagedObject,
  putManagedObject: jest.fn(),
  putManagedObjectSchemaProperty: putManagedObjectSchemaPropertyApi,
  queryAllManagedObjectsByType: jest.fn(),
  queryManagedObjects: queryManagedObjectsApi,
  queryRelatedManagedObjects: jest.fn(),
}));
jest.unstable_mockModule('../api/ManagedSystemObjectApi', () => ({
  getManagedSystemObject,
}));

const {
  resolveIdentity,
  readRelationship,
  addRelationship,
  removeRelationship,
  replaceRelationship,
  findOrCreateManagedObject,
  readManagedObjectSchema,
  readManagedObjectSchemaProperty,
  updateManagedObjectSchemaProperty,
  removeManagedObjectSchemaProperty,
} = await import('./ManagedObjectOps');

function mockState(deploymentType: string) {
  return { getDeploymentType: () => deploymentType } as any;
}

function forbidden() {
  const error: any = new Error('Forbidden');
  error.response = { status: 403 };
  return error;
}

function notFound() {
  const error: any = new Error('Not Found');
  error.response = { status: 404 };
  return error;
}

describe('resolveIdentity', () => {
  beforeEach(() => {
    getManagedObject.mockReset();
    getManagedSystemObject.mockReset();
  });

  test('resolves a realm-qualified DN as that realm\'s managed user', async () => {
    getManagedObject.mockResolvedValue({
      givenName: 'Amos',
      sn: 'Burton',
      userName: 'amos',
    });

    const result = await resolveIdentity({
      idOrDn:
        'id=03f4f90e-d1fa-433d-bc67-6349a8a6ca77,ou=user,o=alpha,ou=services,ou=am-config',
      state: mockState('cloud'),
    });

    expect(getManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alpha_user',
        id: '03f4f90e-d1fa-433d-bc67-6349a8a6ca77',
      })
    );
    expect(result).toEqual({
      id: '03f4f90e-d1fa-433d-bc67-6349a8a6ca77',
      kind: 'user',
      realm: 'alpha',
      username: 'amos',
      displayName: 'Amos Burton',
      resolvedVia: 'alpha_user',
    });
    expect(getManagedSystemObject).not.toHaveBeenCalled();
  });

  test('uses an explicit realm override for a bare uuid', async () => {
    getManagedObject.mockResolvedValue({
      givenName: 'Naomi',
      sn: 'Nagata',
      userName: 'naomi',
    });

    const result = await resolveIdentity({
      idOrDn: 'bare-uuid',
      realm: 'bravo',
      state: mockState('cloud'),
    });

    expect(getManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'bravo_user', id: 'bare-uuid' })
    );
    expect(result.kind).toBe('user');
    expect(result.realm).toBe('bravo');
  });

  test('resolves a root-qualified DN as a service account when svcacct is found', async () => {
    getManagedSystemObject.mockImplementation(async ({ type }: any) => {
      if (type === 'svcacct') {
        return { name: 'Frodo-SA-1', description: "owner's service account" };
      }
      throw notFound();
    });

    const result = await resolveIdentity({
      idOrDn: 'id=a2245410-33a6-4442-9f3b-453c9aaf158a,ou=user,ou=am-config',
      state: mockState('cloud'),
    });

    expect(result).toEqual({
      id: 'a2245410-33a6-4442-9f3b-453c9aaf158a',
      kind: 'service',
      username: 'Frodo-SA-1',
      displayName: "owner's service account",
      resolvedVia: 'svcacct',
    });
  });

  test('resolves a root-qualified DN as a tenant admin when teammember is found', async () => {
    getManagedSystemObject.mockImplementation(async ({ type }: any) => {
      if (type === 'teammember') {
        return { givenName: 'Volker', sn: 'Scheuber', userName: 'volker' };
      }
      throw notFound();
    });

    const result = await resolveIdentity({
      idOrDn: 'id=63dce142-2ade-4311-a43f-165d8705c236,ou=user,ou=am-config',
      state: mockState('cloud'),
    });

    expect(result).toEqual({
      id: '63dce142-2ade-4311-a43f-165d8705c236',
      kind: 'admin',
      username: 'volker',
      displayName: 'Volker Scheuber',
      resolvedVia: 'teammember',
    });
  });

  test('treats a 403 on teammember (not 404) as presumed admin, unconfirmed', async () => {
    getManagedSystemObject.mockImplementation(async ({ type }: any) => {
      if (type === 'svcacct') throw notFound();
      if (type === 'teammember') throw forbidden();
      throw notFound();
    });

    const result = await resolveIdentity({
      idOrDn: 'id=63dce142-2ade-4311-a43f-165d8705c236,ou=user,ou=am-config',
      state: mockState('cloud'),
    });

    expect(result.kind).toBe('admin-unconfirmed');
    expect(result.id).toBe('63dce142-2ade-4311-a43f-165d8705c236');
    expect(result.note).toContain('403');
  });

  test('does not conflate a clean double-404 with a permission-blocked lookup', async () => {
    getManagedSystemObject.mockImplementation(async () => {
      throw notFound();
    });

    const result = await resolveIdentity({
      idOrDn: 'id=deadbeef-0000-0000-0000-000000000000,ou=user,ou=am-config',
      state: mockState('cloud'),
    });

    expect(result.kind).toBe('unknown');
    expect(result.note).not.toContain('403');
  });

  test('classic deployment has no service-account/tenant-admin concept to fall back to', async () => {
    const result = await resolveIdentity({
      idOrDn: 'id=deadbeef-0000-0000-0000-000000000000,ou=user,ou=am-config',
      state: mockState('classic'),
    });

    expect(result.kind).toBe('unknown');
    expect(getManagedSystemObject).not.toHaveBeenCalled();
  });

  test('classic deployment resolves a realm-qualified DN via the generic "user" type', async () => {
    getManagedObject.mockResolvedValue({
      givenName: 'Classic',
      sn: 'User',
      userName: 'classicuser',
    });

    const result = await resolveIdentity({
      idOrDn:
        'id=03f4f90e-d1fa-433d-bc67-6349a8a6ca77,ou=user,o=alpha,ou=services,ou=am-config',
      state: mockState('classic'),
    });

    expect(getManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'user' })
    );
    expect(result.kind).toBe('user');
    expect(result.resolvedVia).toBe('user');
  });

  test('forgeops deployment resolves a realm-qualified DN via the generic "user" type, not a realm-prefixed one — verified live against a real forgeops tenant, whose IDM managed object families are flat with no realm prefix, unlike cloud', async () => {
    getManagedObject.mockResolvedValue({
      givenName: 'ForgeOps',
      sn: 'User',
      userName: 'forgeopsuser',
    });

    const result = await resolveIdentity({
      idOrDn:
        'id=03f4f90e-d1fa-433d-bc67-6349a8a6ca77,ou=user,o=customRealm,ou=services,ou=am-config',
      state: mockState('forgeops'),
    });

    expect(getManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'user' })
    );
    expect(result.kind).toBe('user');
    expect(result.realm).toBe('customRealm');
    expect(result.resolvedVia).toBe('user');
  });
});

describe('relationship helpers', () => {
  beforeEach(() => {
    getManagedObject.mockReset();
    patchManagedObject.mockReset();
    getManagedObject.mockResolvedValue({});
    patchManagedObject.mockResolvedValue({});
  });

  test('readRelationship reads the field directly off the object, requesting only that field', async () => {
    getManagedObject.mockResolvedValue({ manager: { _ref: 'managed/alpha_user/mgr-1' } });

    const result = await readRelationship({
      type: 'alpha_user',
      id: 'user-1',
      field: 'manager',
      state: {} as any,
    });

    expect(getManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alpha_user',
        id: 'user-1',
        fields: ['manager'],
      })
    );
    expect(result).toEqual({ _ref: 'managed/alpha_user/mgr-1' });
  });

  test('addRelationship uses field "/field/-" (JSON Pointer append) and a bare { _ref, _refProperties } value — the exact request shape captured from AIC\'s own admin UI, verified live', async () => {
    await addRelationship({
      type: 'alpha_user',
      id: 'user-1',
      field: 'roles',
      target: { type: 'alpha_role', id: 'role-1' },
      state: {} as any,
    });

    expect(patchManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alpha_user',
        id: 'user-1',
        operations: [
          {
            operation: 'add',
            field: '/roles/-',
            value: {
              _ref: 'managed/alpha_role/role-1',
              _refProperties: {},
            },
          },
        ],
      })
    );
  });

  test('removeRelationship reads the current value first and removes the exact stored element (bare, not array-wrapped, including IDM\'s own _refProperties) — the exact request shape captured from AIC\'s own admin UI, verified live', async () => {
    const storedElement = {
      _ref: 'managed/alpha_role/role-1',
      _refResourceCollection: 'managed/alpha_role',
      _refResourceId: 'role-1',
      _refProperties: { _id: 'rel-id-1', _rev: 'rel-rev-1' },
    };
    getManagedObject.mockResolvedValue({ roles: [storedElement] });

    await removeRelationship({
      type: 'alpha_user',
      id: 'user-1',
      field: 'roles',
      target: { type: 'alpha_role', id: 'role-1' },
      state: {} as any,
    });

    expect(getManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'alpha_user', id: 'user-1', fields: ['roles'] })
    );
    expect(patchManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            operation: 'remove',
            field: '/roles',
            value: storedElement,
          },
        ],
      })
    );
  });

  test('removeRelationship finds and removes the correct element when other members are present', async () => {
    const targetElement = {
      _ref: 'managed/alpha_role/role-1',
      _refResourceCollection: 'managed/alpha_role',
      _refResourceId: 'role-1',
    };
    const otherElement = {
      _ref: 'managed/alpha_role/role-2',
      _refResourceCollection: 'managed/alpha_role',
      _refResourceId: 'role-2',
    };
    getManagedObject.mockResolvedValue({ roles: [targetElement, otherElement] });

    await removeRelationship({
      type: 'alpha_user',
      id: 'user-1',
      field: 'roles',
      target: { type: 'alpha_role', id: 'role-1' },
      state: {} as any,
    });

    expect(patchManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          { operation: 'remove', field: '/roles', value: targetElement },
        ],
      })
    );
  });

  test('removeRelationship throws rather than silently no-op\'ing when the target is not currently a member', async () => {
    getManagedObject.mockResolvedValue({ roles: [] });

    await expect(
      removeRelationship({
        type: 'alpha_user',
        id: 'user-1',
        field: 'roles',
        target: { type: 'alpha_role', id: 'role-1' },
        state: {} as any,
      })
    ).rejects.toThrow(/not currently a member/);
    expect(patchManagedObject).not.toHaveBeenCalled();
  });

  test('removeRelationship handles a single-valued (non-array) current value', async () => {
    const storedElement = {
      _ref: 'managed/alpha_user/mgr-1',
      _refResourceCollection: 'managed/alpha_user',
      _refResourceId: 'mgr-1',
      _refProperties: { _id: 'rel-id-2', _rev: 'rel-rev-2' },
    };
    getManagedObject.mockResolvedValue({ manager: storedElement });

    await removeRelationship({
      type: 'alpha_user',
      id: 'user-1',
      field: 'manager',
      target: { type: 'alpha_user', id: 'mgr-1' },
      state: {} as any,
    });

    expect(patchManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            operation: 'remove',
            field: '/manager',
            value: storedElement,
          },
        ],
      })
    );
  });

  test('replaceRelationship builds a single ref value for a single-valued field', async () => {
    await replaceRelationship({
      type: 'alpha_user',
      id: 'user-1',
      field: 'manager',
      target: { type: 'alpha_user', id: 'mgr-1' },
      state: {} as any,
    });

    expect(patchManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            operation: 'replace',
            field: '/manager',
            value: {
              _ref: 'managed/alpha_user/mgr-1',
              _refResourceCollection: 'managed/alpha_user',
              _refResourceId: 'mgr-1',
            },
          },
        ],
      })
    );
  });

  test('replaceRelationship builds an array of ref values for a many-valued field', async () => {
    await replaceRelationship({
      type: 'alpha_user',
      id: 'user-1',
      field: 'roles',
      target: [
        { type: 'alpha_role', id: 'role-1' },
        { type: 'alpha_role', id: 'role-2' },
      ],
      state: {} as any,
    });

    expect(patchManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          expect.objectContaining({
            operation: 'replace',
            field: '/roles',
            value: [
              expect.objectContaining({ _refResourceId: 'role-1' }),
              expect.objectContaining({ _refResourceId: 'role-2' }),
            ],
          }),
        ],
      })
    );
  });

  test('replaceRelationship passes null through directly to clear a field', async () => {
    await replaceRelationship({
      type: 'alpha_user',
      id: 'user-1',
      field: 'manager',
      target: null,
      state: {} as any,
    });

    expect(patchManagedObject).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [{ operation: 'replace', field: '/manager', value: null }],
      })
    );
  });
});

describe('findOrCreateManagedObject', () => {
  beforeEach(() => {
    createManagedObjectApi.mockReset();
    createManagedObjectApi.mockResolvedValue({});
    queryManagedObjectsApi.mockReset();
    queryManagedObjectsApi.mockResolvedValue({
      result: [],
      resultCount: 0,
      pagedResultsCookie: null,
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });
  });

  test('returns the existing object without creating one when exactly one match is found', async () => {
    const existing = { _id: 'user-1', custom_merchantCustomerId: 'cust-1' };
    queryManagedObjectsApi.mockResolvedValue({
      result: [existing],
      resultCount: 1,
      pagedResultsCookie: null,
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    const result = await findOrCreateManagedObject({
      type: 'alpha_user',
      filter: 'custom_merchantCustomerId eq "cust-1"',
      moData: { custom_merchantCustomerId: 'cust-1' },
      state: {} as any,
    });

    expect(result).toEqual({ object: existing, created: false });
    expect(createManagedObjectApi).not.toHaveBeenCalled();
  });

  test('creates a new object with a server-generated id when no match is found', async () => {
    const created = { _id: 'user-2', custom_merchantCustomerId: 'cust-2' };
    createManagedObjectApi.mockResolvedValue(created);

    const result = await findOrCreateManagedObject({
      type: 'alpha_user',
      filter: 'custom_merchantCustomerId eq "cust-2"',
      moData: { custom_merchantCustomerId: 'cust-2' },
      state: {} as any,
    });

    expect(result).toEqual({ object: created, created: true });
    expect(createManagedObjectApi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alpha_user',
        moData: { custom_merchantCustomerId: 'cust-2' },
      })
    );
  });

  test('throws when the filter matches more than one object', async () => {
    queryManagedObjectsApi.mockResolvedValue({
      result: [{ _id: 'user-1' }, { _id: 'user-2' }],
      resultCount: 2,
      pagedResultsCookie: null,
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    });

    let caught: any;
    try {
      await findOrCreateManagedObject({
        type: 'alpha_user',
        filter: 'custom_merchantCustomerId eq "cust-3"',
        moData: {},
        state: {} as any,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect(caught.originalErrors[0].message).toMatch(
      /matched 2 alpha_user objects/
    );
    expect(createManagedObjectApi).not.toHaveBeenCalled();
  });
});

function mockStateWithDebug(deploymentType: string) {
  return {
    getDeploymentType: () => deploymentType,
    getDebugHandler: () => undefined,
  } as any;
}

describe('managed object schema property CRUD (Cloud-only v2 schema API)', () => {
  beforeEach(() => {
    getManagedObjectSchemaPropertyApi.mockReset();
    getManagedObjectSchemaPropertyApi.mockResolvedValue({
      type: 'string',
    });
    putManagedObjectSchemaPropertyApi.mockReset();
    putManagedObjectSchemaPropertyApi.mockResolvedValue({ type: 'string' });
    deleteManagedObjectSchemaPropertyApi.mockReset();
    deleteManagedObjectSchemaPropertyApi.mockResolvedValue({
      type: 'string',
    });
    getManagedObjectSchemaApi.mockReset();
  });

  test('readManagedObjectSchemaProperty calls the v2 API on Cloud', async () => {
    const state = mockStateWithDebug('cloud');
    const result = await readManagedObjectSchemaProperty({
      type: 'alpha_user',
      propertyName: 'custom_merchantId',
      state,
    });
    expect(result).toEqual({ type: 'string' });
    expect(getManagedObjectSchemaPropertyApi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alpha_user',
        propertyName: 'custom_merchantId',
      })
    );
  });

  test.each(['forgeops', 'classic'])(
    'readManagedObjectSchemaProperty refuses on %s without calling the API',
    async (deploymentType) => {
      const state = mockStateWithDebug(deploymentType);
      await expect(
        readManagedObjectSchemaProperty({
          type: 'alpha_user',
          propertyName: 'custom_merchantId',
          state,
        })
      ).rejects.toMatchObject({
        originalErrors: [expect.objectContaining({ message: expect.stringMatching(/Cloud/) })],
      });
      expect(getManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
    }
  );

  test('updateManagedObjectSchemaProperty writes on Cloud and invalidates the schema cache', async () => {
    const state = mockStateWithDebug('cloud');
    getManagedObjectSchemaApi.mockResolvedValueOnce({
      properties: { custom_merchantId: { type: 'string', version: 1 } },
    });
    const before = await readManagedObjectSchema({
      type: 'alpha_user_update_cache_test',
      state,
    });
    expect(before.properties['custom_merchantId']).toEqual({
      type: 'string',
      version: 1,
    });

    await updateManagedObjectSchemaProperty({
      type: 'alpha_user_update_cache_test',
      propertyName: 'custom_merchantId',
      propertyData: { type: 'string' },
      state,
    });
    expect(putManagedObjectSchemaPropertyApi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alpha_user_update_cache_test',
        propertyName: 'custom_merchantId',
        propertyData: { type: 'string' },
      })
    );

    // Cache must be invalidated: a subsequent readManagedObjectSchema call
    // re-fetches instead of returning the pre-update cached value.
    getManagedObjectSchemaApi.mockResolvedValueOnce({
      properties: { custom_merchantId: { type: 'string', version: 2 } },
    });
    const after = await readManagedObjectSchema({
      type: 'alpha_user_update_cache_test',
      refreshCache: false,
      state,
    });
    expect(after.properties['custom_merchantId']).toEqual({
      type: 'string',
      version: 2,
    });
    expect(getManagedObjectSchemaApi).toHaveBeenCalledTimes(2);
  });

  test.each(['forgeops', 'classic'])(
    'updateManagedObjectSchemaProperty refuses on %s without calling the API',
    async (deploymentType) => {
      const state = mockStateWithDebug(deploymentType);
      await expect(
        updateManagedObjectSchemaProperty({
          type: 'alpha_user',
          propertyName: 'custom_merchantId',
          propertyData: { type: 'string' },
          state,
        })
      ).rejects.toMatchObject({
        originalErrors: [expect.objectContaining({ message: expect.stringMatching(/Cloud/) })],
      });
      expect(putManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
    }
  );

  test('removeManagedObjectSchemaProperty writes on Cloud and invalidates the schema cache', async () => {
    const state = mockStateWithDebug('cloud');
    getManagedObjectSchemaApi.mockResolvedValueOnce({
      properties: { custom_merchantId: { type: 'string', version: 1 } },
    });
    await readManagedObjectSchema({ type: 'alpha_user_remove_cache_test', state });

    await removeManagedObjectSchemaProperty({
      type: 'alpha_user_remove_cache_test',
      propertyName: 'custom_merchantId',
      state,
    });
    expect(deleteManagedObjectSchemaPropertyApi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alpha_user_remove_cache_test',
        propertyName: 'custom_merchantId',
      })
    );

    getManagedObjectSchemaApi.mockResolvedValueOnce({ properties: {} });
    await readManagedObjectSchema({ type: 'alpha_user_remove_cache_test', state });
    expect(getManagedObjectSchemaApi).toHaveBeenCalledTimes(2);
  });

  test.each(['forgeops', 'classic'])(
    'removeManagedObjectSchemaProperty refuses on %s without calling the API',
    async (deploymentType) => {
      const state = mockStateWithDebug(deploymentType);
      await expect(
        removeManagedObjectSchemaProperty({
          type: 'alpha_user',
          propertyName: 'custom_merchantId',
          state,
        })
      ).rejects.toMatchObject({
        originalErrors: [expect.objectContaining({ message: expect.stringMatching(/Cloud/) })],
      });
      expect(deleteManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
    }
  );
});
