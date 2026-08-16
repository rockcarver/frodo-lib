import { jest } from '@jest/globals';

const getManagedObject = jest.fn(async (_args?: any): Promise<any> => ({}));
const getManagedSystemObject = jest.fn(
  async (_args?: any): Promise<any> => ({})
);

jest.unstable_mockModule('../api/ManagedObjectApi', () => ({
  countManagedObjects: jest.fn(),
  createManagedObject: jest.fn(),
  DEFAULT_PAGE_SIZE: 1000,
  deleteManagedObject: jest.fn(),
  getManagedObject,
  getManagedObjectSchema: jest.fn(),
  patchManagedObject: jest.fn(),
  putManagedObject: jest.fn(),
  queryAllManagedObjectsByType: jest.fn(),
  queryManagedObjects: jest.fn(),
  queryRelatedManagedObjects: jest.fn(),
}));
jest.unstable_mockModule('../api/ManagedSystemObjectApi', () => ({
  getManagedSystemObject,
}));

const { resolveIdentity } = await import('./ManagedObjectOps');

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
