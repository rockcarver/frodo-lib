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
  findFailedRequest: jest.fn(),
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

jest.unstable_mockModule('../utils/ForgeRockUtils', () => ({
  getCurrentRealmName: jest.fn(() => 'alpha'),
}));

const ServiceOps = await import('./ServiceOps');
const { FrodoError } = await import('./FrodoError');
const { printMessage } = await import('../utils/Console');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => undefined,
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
    async ({ serviceId }: { serviceId: string }) =>
      makeService({ _id: serviceId })
  );
  deleteServiceNextDescendentMock.mockResolvedValue(undefined);
  getListOfServicesMock.mockResolvedValue({ result: [] });
  getServiceMock.mockImplementation(
    async ({ serviceId }: { serviceId: string }) =>
      makeService({ _id: serviceId })
  );
  getServiceDescendentsMock.mockResolvedValue([]);
  putServiceMock.mockImplementation(
    async ({
      serviceId,
      serviceData,
    }: {
      serviceId: string;
      serviceData: any;
    }) => ({
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
    expect(putServiceMock.mock.calls[0][0].serviceData).not.toHaveProperty(
      '_rev'
    );
    expect(putServiceMock.mock.calls[0][0].serviceData).not.toHaveProperty(
      'enabled'
    );
    expect(putServiceMock.mock.calls[0][0].serviceData).not.toHaveProperty(
      'location'
    );
    expect(putServiceMock.mock.calls[0][0].serviceData).not.toHaveProperty(
      'nextDescendents'
    );
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

  test('deleteFullServices reports successful deletes when another service fails', async () => {
    getListOfServicesMock.mockResolvedValue({
      result: ['one', 'two', 'three'].map((_id) => makeService({ _id })),
    });
    const failure = new Error('Delete failed');
    deleteServiceMock.mockImplementation(async ({ serviceId }) => {
      if (serviceId === 'two') throw failure;
      return makeService({ _id: serviceId });
    });

    await expect(
      ServiceOps.deleteFullServices({ globalConfig: false, state })
    ).rejects.toMatchObject({
      name: 'FrodoError',
      message: expect.stringContaining('two'),
      // deleteFullService wraps the failed request in a FrodoError of its own (frodo-lib#1033)
      originalErrors: [
        expect.objectContaining({
          message: expect.stringContaining('two'),
          originalErrors: [
            expect.objectContaining({
              message: expect.stringContaining('full service config two'),
              originalErrors: [failure],
            }),
          ],
        }),
      ],
    });
    expect(
      deleteServiceMock.mock.calls.map(([args]) => args.serviceId)
    ).toEqual(['one', 'two', 'three']);
    for (const serviceId of ['one', 'three']) {
      expect(printMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Deleted service '${serviceId}'.`,
          state,
        })
      );
    }
  });

  test.each(['getFullServices', 'deleteFullServices'] as const)(
    '%s waits for every service and names all failures',
    async (method) => {
      getListOfServicesMock.mockResolvedValue({
        result: ['one', 'two', 'three'].map((_id) => makeService({ _id })),
      });
      const failures = {
        one: new Error('First failure'),
        three: new Error('Last failure'),
      };
      const completed: string[] = [];
      const operationMock =
        method === 'getFullServices' ? getServiceMock : deleteServiceMock;
      operationMock.mockImplementation(async ({ serviceId }) => {
        if (serviceId === 'two') {
          await new Promise((resolve) => setTimeout(resolve, 10));
          completed.push(serviceId);
          return makeService({ _id: serviceId });
        }
        throw failures[serviceId];
      });

      await expect(
        ServiceOps[method]({ globalConfig: true, state })
      ).rejects.toMatchObject({
        name: 'FrodoError',
        message: expect.stringMatching(/one.*three|three.*one/),
        originalErrors: expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining('one') }),
          expect.objectContaining({
            message: expect.stringContaining('three'),
          }),
        ]),
      });
      expect(operationMock).toHaveBeenCalledTimes(3);
      expect(completed).toEqual(['two']);
    }
  );

  test.each(['getFullServices', 'exportServices'] as const)(
    '%s rejects rather than returning an incomplete export on a server error',
    async (method) => {
      getListOfServicesMock.mockResolvedValue({
        result: [makeService({ _id: 'broken' })],
      });
      const failure = Object.assign(new Error('Server error'), {
        response: { status: 500, data: { message: 'Server error' } },
      });
      getServiceMock.mockRejectedValue(failure);

      const error = await ServiceOps[method]({
        globalConfig: false,
        state,
      }).catch((error) => error);
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.getCombinedMessage()).toContain('broken');
      expect(error.getCombinedMessage()).toContain('Server error');
    }
  );

  test.each([
    ['getFullServices', getServiceMock],
    ['getFullServices', getServiceDescendentsMock],
    ['deleteFullServices', deleteServiceMock],
    ['deleteFullServices', getServiceDescendentsMock],
  ] as const)(
    '%s skips only unavailable services, including descendant failures',
    async (method, operationMock) => {
      getListOfServicesMock.mockResolvedValue({
        result: ['unavailable', 'available'].map((_id) => makeService({ _id })),
      });
      operationMock.mockImplementation(async ({ serviceId }) => {
        if (serviceId === 'unavailable') {
          throw Object.assign(new Error('Unavailable'), {
            response: {
              status: 403,
              data: {
                message:
                  'This operation is not available in PingOne Advanced Identity Cloud.',
              },
            },
          });
        }
        return operationMock === getServiceDescendentsMock
          ? []
          : makeService({ _id: serviceId });
      });

      await expect(
        ServiceOps[method]({ globalConfig: false, state })
      ).resolves.toEqual([expect.objectContaining({ _id: 'available' })]);
      expect(printMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    }
  );

  test.each(['getFullServices', 'deleteFullServices'] as const)(
    '%s does not skip an ordinary permission error',
    async (method) => {
      getListOfServicesMock.mockResolvedValue({
        result: [makeService({ _id: 'forbidden' })],
      });
      getServiceDescendentsMock.mockRejectedValue(
        Object.assign(new Error('Forbidden'), {
          response: { status: 403, data: { message: 'Permission denied' } },
        })
      );

      await expect(
        ServiceOps[method]({ globalConfig: false, state })
      ).rejects.toMatchObject({
        name: 'FrodoError',
        message: expect.stringContaining('forbidden'),
      });
    }
  );

  test.each([
    [getServiceMock, getServiceDescendentsMock],
    [getServiceDescendentsMock, getServiceMock],
  ])(
    'getFullServices does not let an unavailable read hide a concurrent server error',
    async (unavailableMock, failingMock) => {
      getListOfServicesMock.mockResolvedValue({
        result: [makeService({ _id: 'mixed' })],
      });
      unavailableMock.mockRejectedValue(
        Object.assign(new Error('Unavailable'), {
          response: {
            status: 403,
            data: {
              message:
                'This operation is not available in PingOne Advanced Identity Cloud.',
            },
          },
        })
      );
      const failure = Object.assign(new Error('Server error'), {
        response: { status: 500, data: { message: 'Server error' } },
      });
      failingMock.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw failure;
      });

      const error = await ServiceOps.getFullServices({
        globalConfig: false,
        state,
      }).catch((error) => error);
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.getCombinedMessage()).toContain('mixed');
      expect(error.getCombinedMessage()).toContain('Server error');
      expect(error.getCombinedMessage()).not.toContain('Unavailable');
    }
  );

  test('exportService returns a single-service export with descendants and location', async () => {
    getServiceMock.mockResolvedValue(
      makeService({ _id: 'svc', setting: 'value' })
    );
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
          otherRealmSvc: makeService({
            _id: 'otherRealmSvc',
            location: 'bravo',
          }),
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
      expect.objectContaining({
        serviceId: 'globalSvc',
        globalConfig: true,
        state,
      })
    );
    expect(putServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 'realmSvc',
        globalConfig: false,
        state,
      })
    );
  });
});

describe('getFullServices and exportServices with a result callback', () => {
  type Outcome = { error?: any; result?: any };
  let outcomes: Outcome[];
  const callback = (error?: any, result?: any) =>
    outcomes.push({ error, result });

  beforeEach(() => {
    outcomes = [];
    getListOfServicesMock.mockResolvedValue({
      result: [
        makeService({ _id: 'one' }),
        makeService({ _id: 'broken' }),
        makeService({ _id: 'three' }),
      ],
    });
    getServiceMock.mockImplementation(
      async ({ serviceId }: { serviceId: string }) => {
        if (serviceId === 'broken') {
          throw Object.assign(new Error('Server error'), {
            response: { status: 500, data: { message: 'Server error' } },
          });
        }
        return makeService({
          _id: serviceId,
          _type: { _id: serviceId, name: 'Service', collection: false },
        });
      }
    );
  });

  const ids = (list: any[]) => list.map((it) => it._id).sort();

  test('getFullServices returns the services that could be read and reports each service once', async () => {
    const services = await ServiceOps.getFullServices({
      globalConfig: false,
      resultCallback: callback,
      state,
    });

    expect(ids(services)).toEqual(['one', 'three']);
    expect(outcomes).toHaveLength(3);
    expect(
      ids(outcomes.filter((it) => it.result).map((it) => it.result))
    ).toEqual(['one', 'three']);
    const failures = outcomes.filter((it) => it.error);
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toBeInstanceOf(FrodoError);
    expect(failures[0].error.getCombinedMessage()).toContain('broken');
    expect(failures[0].error.getCombinedMessage()).toContain('Server error');
  });

  test('exportServices exports the services that could be read and reports the others', async () => {
    const response = await ServiceOps.exportServices({
      globalConfig: false,
      resultCallback: callback,
      state,
    });

    expect(Object.keys(response.service).sort()).toEqual(['one', 'three']);
    const failures = outcomes.filter((it) => it.error);
    expect(failures).toHaveLength(1);
    expect(failures[0].error.getCombinedMessage()).toContain('broken');
  });

  test('a service that is not available in the cloud is skipped, not reported', async () => {
    getServiceMock.mockImplementation(
      async ({ serviceId }: { serviceId: string }) => {
        if (serviceId === 'broken') {
          throw Object.assign(new Error('Unavailable'), {
            response: {
              status: 403,
              data: {
                message:
                  'This operation is not available in PingOne Advanced Identity Cloud.',
              },
            },
          });
        }
        return makeService({ _id: serviceId });
      }
    );

    const services = await ServiceOps.getFullServices({
      globalConfig: false,
      resultCallback: callback,
      state,
    });

    expect(ids(services)).toEqual(['one', 'three']);
    expect(outcomes.filter((it) => it.error)).toHaveLength(0);
    expect(outcomes).toHaveLength(2);
  });

  test('a failure to list the services still throws', async () => {
    getListOfServicesMock.mockRejectedValue(
      Object.assign(new Error('Server error'), {
        response: { status: 500, data: { message: 'Server error' } },
      })
    );

    await expect(
      ServiceOps.getFullServices({
        globalConfig: false,
        resultCallback: callback,
        state,
      })
    ).rejects.toBeInstanceOf(FrodoError);
    expect(outcomes).toHaveLength(0);
  });

  test('the facade passes the callback on', async () => {
    const services = await ServiceOps.default({ state }).getFullServices(
      false,
      callback
    );

    expect(ids(services)).toEqual(['one', 'three']);
    expect(outcomes.filter((it) => it.error)).toHaveLength(1);
  });
});
