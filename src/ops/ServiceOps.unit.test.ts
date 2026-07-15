import { jest } from '@jest/globals';

const deleteServiceMock: any = jest.fn();
const deleteServiceNextDescendentMock: any = jest.fn();
const getListOfServicesMock: any = jest.fn();
const getServiceMock: any = jest.fn();
const getServiceDescendentsMock: any = jest.fn();
const putServiceMock: any = jest.fn();
const putServiceNextDescendentMock: any = jest.fn();

jest.unstable_mockModule('../api/ServiceApi', () => ({
  deleteService: deleteServiceMock,
  deleteServiceNextDescendent: deleteServiceNextDescendentMock,
  getListOfServices: getListOfServicesMock,
  getService: getServiceMock,
  getServiceDescendents: getServiceDescendentsMock,
  putService: putServiceMock,
  putServiceNextDescendent: putServiceNextDescendentMock,
}));

jest.unstable_mockModule('../utils/Console', () => ({
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage: jest.fn(),
  printMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

jest.unstable_mockModule('../utils/ForgeRockUtils', () => ({
  getCurrentRealmName: jest.fn(() => 'alpha'),
}));

const ServiceOps = await import('./ServiceOps');

const state = {
  getRealm: () => 'alpha',
} as any;

const makeService = (overrides: Record<string, unknown> = {}) =>
  ({
    _id: 'svc',
    _type: {
      _id: 'svc',
      name: 'Service',
      collection: false,
    },
    ...overrides,
  }) as any;

const makeDescendent = (overrides: Record<string, unknown> = {}) =>
  ({
    _id: 'child',
    _type: {
      _id: 'childType',
      name: 'Child type',
      collection: true,
    },
    ...overrides,
  }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  deleteServiceMock.mockImplementation(
    async ({ serviceId }: { serviceId: string }) => makeService({ _id: serviceId })
  );
  deleteServiceNextDescendentMock.mockResolvedValue(undefined);
  getListOfServicesMock.mockResolvedValue({ result: [] });
  getServiceMock.mockImplementation(
    async ({ serviceId }: { serviceId: string }) => makeService({ _id: serviceId })
  );
  getServiceDescendentsMock.mockResolvedValue([]);
  putServiceMock.mockImplementation(
    async ({ serviceId, serviceData }: { serviceId: string; serviceData: any }) => ({
      ...makeService({ _id: serviceId }),
      ...serviceData,
    })
  );
  putServiceNextDescendentMock.mockImplementation(
    async ({
      serviceNextDescendentId,
      serviceNextDescendentData,
    }: {
      serviceNextDescendentId: string;
      serviceNextDescendentData: any;
    }) => ({
      _id: serviceNextDescendentId,
      ...serviceNextDescendentData,
    })
  );
});

describe('ServiceOps unit coverage for AM service management', () => {
  test('putFullService clones input, strips metadata, and imports descendants', async () => {
    const nextDescendent = makeDescendent({ custom: true });
    const fullServiceData = makeService({
      _rev: '7',
      enabled: true,
      location: 'alpha',
      config: 'value',
      nextDescendents: [nextDescendent],
    });
    const original = JSON.parse(JSON.stringify(fullServiceData));

    const response = await ServiceOps.putFullService({
      serviceId: 'svc',
      fullServiceData,
      clean: false,
      globalConfig: false,
      state,
    });

    expect(fullServiceData).toEqual(original);
    expect(putServiceMock).toHaveBeenCalledWith({
      serviceId: 'svc',
      serviceData: expect.objectContaining({
        _id: 'svc',
        _type: expect.any(Object),
        config: 'value',
      }),
      globalConfig: false,
      state,
    });
    expect(putServiceMock.mock.calls[0][0].serviceData).not.toHaveProperty('_rev');
    expect(putServiceMock.mock.calls[0][0].serviceData).not.toHaveProperty('enabled');
    expect(putServiceMock.mock.calls[0][0].serviceData).not.toHaveProperty('location');
    expect(putServiceMock.mock.calls[0][0].serviceData).not.toHaveProperty('nextDescendents');
    expect(putServiceNextDescendentMock).toHaveBeenCalledWith({
      serviceId: 'svc',
      serviceType: 'childType',
      serviceNextDescendentId: 'child',
      serviceNextDescendentData: expect.objectContaining({
        _id: 'child',
        custom: true,
      }),
      globalConfig: false,
      state,
    });
    expect(response.nextDescendents).toEqual([
      expect.objectContaining({
        _id: 'child',
        custom: true,
      }),
    ]);
  });

  test('putFullServices can import the same payload into global and realm configs', async () => {
    const serviceEntries = [
      [
        'svc',
        makeService({
          location: 'global',
          nextDescendents: [makeDescendent()],
        }),
      ],
    ] as any;

    await ServiceOps.putFullServices({
      serviceEntries,
      clean: false,
      globalConfig: true,
      realmConfig: true,
      state,
    });

    expect(putServiceMock).toHaveBeenCalledTimes(2);
    expect(putServiceNextDescendentMock).toHaveBeenCalledTimes(2);
    expect(putServiceMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ globalConfig: true, state })
    );
    expect(putServiceMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ globalConfig: false, state })
    );
  });

  test('deleteFullService removes descendants before deleting the service', async () => {
    getServiceDescendentsMock.mockResolvedValue([
      makeDescendent({ _id: 'first-child', _type: { _id: 'firstType' } }),
      makeDescendent({ _id: 'second-child', _type: { _id: 'secondType' } }),
    ]);

    await ServiceOps.deleteFullService({
      serviceId: 'svc',
      globalConfig: false,
      state,
    });

    expect(deleteServiceNextDescendentMock).toHaveBeenCalledTimes(2);
    expect(deleteServiceMock).toHaveBeenCalledWith({
      serviceId: 'svc',
      globalConfig: false,
      state,
    });
    const parentDeleteOrder = deleteServiceMock.mock.invocationCallOrder[0];
    deleteServiceNextDescendentMock.mock.invocationCallOrder.forEach(
      (descendentDeleteOrder: number) => {
        expect(descendentDeleteOrder).toBeLessThan(parentDeleteOrder);
      }
    );
  });

  test('deleteFullServices deletes every listed service', async () => {
    getListOfServicesMock.mockResolvedValue({
      result: [makeService({ _id: 'one' }), makeService({ _id: 'two' })],
    });

    const response = await ServiceOps.deleteFullServices({
      globalConfig: true,
      state,
    });

    expect(deleteServiceMock).toHaveBeenCalledTimes(2);
    expect(deleteServiceMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ serviceId: 'one', globalConfig: true, state })
    );
    expect(deleteServiceMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ serviceId: 'two', globalConfig: true, state })
    );
    expect(response).toEqual([
      expect.objectContaining({ _id: 'one' }),
      expect.objectContaining({ _id: 'two' }),
    ]);
  });

  test('exportService returns a single-service export with descendants and location', async () => {
    getServiceMock.mockResolvedValue(makeService({ _id: 'svc', setting: 'value' }));
    getServiceDescendentsMock.mockResolvedValue([makeDescendent()]);

    const response = await ServiceOps.exportService({
      serviceId: 'svc',
      globalConfig: false,
      state,
    });

    expect(response).toEqual({
      meta: { exportedBy: 'jest' },
      service: {
        svc: expect.objectContaining({
          _id: 'svc',
          setting: 'value',
          location: 'alpha',
          nextDescendents: [expect.objectContaining({ _id: 'child' })],
        }),
      },
    });
  });

  test('importService routes global services to global config', async () => {
    await ServiceOps.importService({
      serviceId: 'svc',
      importData: {
        service: {
          svc: makeService({ location: 'global' }),
        },
      },
      options: {
        clean: true,
        global: false,
        realm: false,
      },
      state,
    });

    expect(putServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 'svc',
        globalConfig: true,
        state,
      })
    );
  });

  test('importService routes current-realm services to realm config', async () => {
    await ServiceOps.importService({
      serviceId: 'svc',
      importData: {
        service: {
          svc: makeService({ location: 'alpha' }),
        },
      },
      options: {
        clean: false,
        global: false,
        realm: false,
      },
      state,
    });

    expect(putServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 'svc',
        globalConfig: false,
        state,
      })
    );
  });

  test('importService rejects mismatched realm imports with a helpful error', async () => {
    await expect(
      ServiceOps.importService({
        serviceId: 'svc',
        importData: {
          service: {
            svc: makeService({ location: 'bravo' }),
          },
        },
        options: {
          clean: false,
          global: false,
          realm: false,
        },
        state,
      })
    ).rejects.toMatchObject({
      message: 'Error importing service svc',
      originalErrors: [
        expect.objectContaining({
          message: expect.stringContaining(
            'Nothing to do! If the service you are attempting to import is a global service'
          ),
        }),
      ],
    });
    expect(putServiceMock).not.toHaveBeenCalled();
  });

  test('importServices imports global and current-realm services from one export', async () => {
    await ServiceOps.importServices({
      importData: {
        service: {
          globalSvc: makeService({ _id: 'globalSvc', location: 'global' }),
          realmSvc: makeService({ _id: 'realmSvc', location: 'alpha' }),
          otherRealmSvc: makeService({ _id: 'otherRealmSvc', location: 'bravo' }),
        },
      },
      options: {
        clean: false,
        global: false,
        realm: false,
      },
      state,
    });

    expect(putServiceMock).toHaveBeenCalledTimes(2);
    expect(putServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 'globalSvc', globalConfig: true, state })
    );
    expect(putServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 'realmSvc', globalConfig: false, state })
    );
  });
});
