/**
 * Unit tests for deleting the next descendents of a service
 * (`deleteServiceNextDescendent`, `deleteServiceNextDescendents`) and for
 * `deleteFullService`, which is built on them.
 *
 * Run with:
 *
 *        npm run test:only src/ops/ServiceOps.nextDescendents
 *
 * The api layer (`ServiceApi`) is replaced by fakes, so nothing here needs a
 * tenant or a recording. `ServiceApi.nextDescendent.unit.test.ts` shows the
 * requests that the real api layer sends for the same calls.
 */
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

const UNAVAILABLE = {
  status: 403,
  data: {
    message:
      'This operation is not available in PingOne Advanced Identity Cloud.',
  },
};

/** an error as the api layer throws it: the answer of the server is on `response` */
const requestError = (message: string, response: Record<string, unknown>) =>
  Object.assign(new Error(message), { response });

const service = (_id: string) => ({
  _id,
  _type: { _id, name: 'Service', collection: false },
});

const descendent = (_id: string, type = 'CorsConfiguration') => ({
  _id,
  _type: { _id: type, name: type, collection: true },
});

const deletedIds = () =>
  deleteServiceNextDescendentMock.mock.calls.map(
    ([args]: any[]) => args.serviceNextDescendentId
  );

beforeEach(() => {
  jest.clearAllMocks();
  deleteServiceMock.mockImplementation(async ({ serviceId }: any) =>
    service(serviceId)
  );
  deleteServiceNextDescendentMock.mockImplementation(
    async ({ serviceNextDescendentId, serviceType }: any) => ({
      _id: serviceNextDescendentId,
      _type: { _id: serviceType },
    })
  );
  getListOfServicesMock.mockResolvedValue({ result: [] });
  getServiceDescendentsMock.mockResolvedValue([]);
});

describe('deleteServiceNextDescendent', () => {
  beforeEach(() => {
    getServiceDescendentsMock.mockResolvedValue([
      descendent('cors'),
      descendent('azure', 'AzureConfiguration'),
    ]);
  });

  test('deletes the listed descendent with its listed type and id, and nothing else', async () => {
    const response = await ServiceOps.deleteServiceNextDescendent({
      serviceId: 'CorsService',
      nextDescendentName: 'azure',
      globalConfig: true,
      state,
    });

    expect(getServiceDescendentsMock).toHaveBeenCalledTimes(1);
    expect(getServiceDescendentsMock).toHaveBeenCalledWith({
      serviceId: 'CorsService',
      globalConfig: true,
      state,
    });
    expect(deleteServiceNextDescendentMock).toHaveBeenCalledTimes(1);
    expect(deleteServiceNextDescendentMock).toHaveBeenCalledWith({
      serviceId: 'CorsService',
      serviceType: 'AzureConfiguration',
      serviceNextDescendentId: 'azure',
      globalConfig: true,
      state,
    });
    expect(response).toEqual({
      _id: 'azure',
      _type: { _id: 'AzureConfiguration' },
    });
    // the service itself stays
    expect(deleteServiceMock).not.toHaveBeenCalled();
  });

  test.each([true, false])(
    'passes globalConfig=%s to the read and to the delete',
    async (globalConfig) => {
      await ServiceOps.deleteServiceNextDescendent({
        serviceId: 'CorsService',
        nextDescendentName: 'cors',
        globalConfig,
        state,
      });

      expect(getServiceDescendentsMock).toHaveBeenCalledWith(
        expect.objectContaining({ globalConfig })
      );
      expect(deleteServiceNextDescendentMock).toHaveBeenCalledWith(
        expect.objectContaining({ globalConfig })
      );
    }
  );

  test('works on the realm services when globalConfig is left out', async () => {
    await ServiceOps.deleteServiceNextDescendent({
      serviceId: 'CorsService',
      nextDescendentName: 'cors',
      state,
    });

    expect(getServiceDescendentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ globalConfig: false })
    );
    expect(deleteServiceNextDescendentMock).toHaveBeenCalledWith(
      expect.objectContaining({ globalConfig: false })
    );
  });

  test.each([
    ['another case', 'Azure'],
    ['a leading space', ' azure'],
    ['a trailing slash', 'azure/'],
    ['a part of an id', 'azur'],
    ['an id that contains it', 'azure-2'],
    ['nothing', ''],
  ])(
    'a name that is not a listed id (%s) throws one error that names the descendent and the service, and sends no delete',
    async (_label, name) => {
      const error = await ServiceOps.deleteServiceNextDescendent({
        serviceId: 'CorsService',
        nextDescendentName: name,
        globalConfig: true,
        state,
      }).catch((error) => error);

      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe(
        `Error deleting descendent '${name}' of service 'CorsService'`
      );
      expect(error.getCombinedMessage()).toContain(
        `Descendent '${name}' not found`
      );
      expect(deleteServiceNextDescendentMock).not.toHaveBeenCalled();
      expect(deleteServiceMock).not.toHaveBeenCalled();
    }
  );

  test('a failed delete throws an error that names the descendent and the service and keeps the cause', async () => {
    const cause = requestError('Server error', { status: 500 });
    deleteServiceNextDescendentMock.mockRejectedValue(cause);

    const error = await ServiceOps.deleteServiceNextDescendent({
      serviceId: 'CorsService',
      nextDescendentName: 'cors',
      globalConfig: true,
      state,
    }).catch((error) => error);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      "Error deleting descendent 'cors' of service 'CorsService'"
    );
    expect(error.originalErrors).toEqual([cause]);
  });

  test('a failure to read the descendents throws and sends no delete', async () => {
    getServiceDescendentsMock.mockRejectedValue(
      requestError('Server error', { status: 500 })
    );

    await expect(
      ServiceOps.deleteServiceNextDescendent({
        serviceId: 'CorsService',
        nextDescendentName: 'cors',
        globalConfig: true,
        state,
      })
    ).rejects.toBeInstanceOf(FrodoError);
    expect(deleteServiceNextDescendentMock).not.toHaveBeenCalled();
  });

  test.each([
    ['a dot', '.'],
    ['two dots', '..'],
    ['an empty id', ''],
    ['a blank id', '   '],
  ])(
    'a listed descendent whose id is %s is refused: one error names it and no delete is sent',
    async (_label, id) => {
      getServiceDescendentsMock.mockResolvedValue([descendent(id)]);

      const error = await ServiceOps.deleteServiceNextDescendent({
        serviceId: 'CorsService',
        nextDescendentName: id,
        globalConfig: true,
        state,
      }).catch((error) => error);

      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe(
        `Error deleting descendent '${id}' of service 'CorsService'`
      );
      expect(error.getCombinedMessage()).toContain(
        'cannot be used in a request path'
      );
      expect(deleteServiceNextDescendentMock).not.toHaveBeenCalled();
    }
  );

  test('a listed descendent whose type is not a name is refused, too', async () => {
    getServiceDescendentsMock.mockResolvedValue([descendent('cors', '..')]);

    const error = await ServiceOps.deleteServiceNextDescendent({
      serviceId: 'CorsService',
      nextDescendentName: 'cors',
      globalConfig: true,
      state,
    }).catch((error) => error);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.getCombinedMessage()).toContain(
      'cannot be used in a request path'
    );
    expect(deleteServiceNextDescendentMock).not.toHaveBeenCalled();
  });

  test('an id with a character that needs encoding is sent as listed, the api layer encodes it', async () => {
    getServiceDescendentsMock.mockResolvedValue([descendent('a#b?c/d%e')]);

    await ServiceOps.deleteServiceNextDescendent({
      serviceId: 'CorsService',
      nextDescendentName: 'a#b?c/d%e',
      globalConfig: true,
      state,
    });

    expect(deleteServiceNextDescendentMock).toHaveBeenCalledWith(
      expect.objectContaining({ serviceNextDescendentId: 'a#b?c/d%e' })
    );
  });

  test('the facade passes its arguments on', async () => {
    const response = await ServiceOps.default(
      state
    ).deleteServiceNextDescendent('CorsService', 'cors', true);

    expect(response).toEqual(expect.objectContaining({ _id: 'cors' }));
    expect(deleteServiceNextDescendentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 'CorsService',
        serviceNextDescendentId: 'cors',
        globalConfig: true,
      })
    );
  });
});

describe('deleteServiceNextDescendents', () => {
  type Outcome = { error?: any; result?: any };
  let outcomes: Outcome[];
  const callback = (error?: any, result?: any) =>
    outcomes.push({ error, result });

  const failure = requestError('Server error', { status: 500 });

  beforeEach(() => {
    outcomes = [];
    getServiceDescendentsMock.mockResolvedValue([
      descendent('one'),
      descendent('two', 'OtherConfiguration'),
      descendent('three'),
    ]);
  });

  test('deletes every descendent by its listed type and id, returns them in the order of the list and leaves the service', async () => {
    deleteServiceNextDescendentMock.mockImplementation(
      async ({ serviceNextDescendentId, serviceType }: any) => {
        // the first one finishes last
        await new Promise((resolve) =>
          setTimeout(resolve, serviceNextDescendentId === 'one' ? 20 : 0)
        );
        return { _id: serviceNextDescendentId, _type: { _id: serviceType } };
      }
    );

    const response = await ServiceOps.deleteServiceNextDescendents({
      serviceId: 'CorsService',
      globalConfig: true,
      state,
    });

    expect(getServiceDescendentsMock).toHaveBeenCalledWith({
      serviceId: 'CorsService',
      globalConfig: true,
      state,
    });
    expect(deleteServiceNextDescendentMock.mock.calls).toEqual([
      [
        {
          serviceId: 'CorsService',
          serviceType: 'CorsConfiguration',
          serviceNextDescendentId: 'one',
          globalConfig: true,
          state,
        },
      ],
      [
        {
          serviceId: 'CorsService',
          serviceType: 'OtherConfiguration',
          serviceNextDescendentId: 'two',
          globalConfig: true,
          state,
        },
      ],
      [
        {
          serviceId: 'CorsService',
          serviceType: 'CorsConfiguration',
          serviceNextDescendentId: 'three',
          globalConfig: true,
          state,
        },
      ],
    ]);
    expect(response.map((it) => it._id)).toEqual(['one', 'two', 'three']);
    expect(deleteServiceMock).not.toHaveBeenCalled();
  });

  test('returns an empty list and sends no delete when the service has no descendents', async () => {
    getServiceDescendentsMock.mockResolvedValue([]);

    await expect(
      ServiceOps.deleteServiceNextDescendents({
        serviceId: 'CorsService',
        globalConfig: true,
        state,
      })
    ).resolves.toEqual([]);
    expect(deleteServiceNextDescendentMock).not.toHaveBeenCalled();
  });

  test('works on the realm services when globalConfig is left out', async () => {
    await ServiceOps.deleteServiceNextDescendents({
      serviceId: 'CorsService',
      state,
    });

    expect(getServiceDescendentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ globalConfig: false })
    );
    expect(deleteServiceNextDescendentMock).toHaveBeenCalledTimes(3);
    expect(deleteServiceNextDescendentMock).toHaveBeenCalledWith(
      expect.objectContaining({ globalConfig: false })
    );
  });

  test('with a callback every result reaches it, a failed delete does not stop the others, and nothing is thrown', async () => {
    deleteServiceNextDescendentMock.mockImplementation(
      async ({ serviceNextDescendentId }: any) => {
        if (serviceNextDescendentId === 'two') throw failure;
        return { _id: serviceNextDescendentId };
      }
    );

    const response = await ServiceOps.deleteServiceNextDescendents({
      serviceId: 'CorsService',
      globalConfig: true,
      resultCallback: callback,
      state,
    });

    expect(deletedIds().sort()).toEqual(['one', 'three', 'two']);
    expect(response.map((it) => it._id)).toEqual(['one', 'three']);
    expect(outcomes).toHaveLength(3);
    expect(
      outcomes
        .filter((it) => it.result)
        .map((it) => it.result._id)
        .sort()
    ).toEqual(['one', 'three']);
    const failures = outcomes.filter((it) => it.error);
    expect(failures).toHaveLength(1);
    expect(failures[0].result).toBeUndefined();
    expect(failures[0].error).toBeInstanceOf(FrodoError);
    expect(failures[0].error.message).toBe(
      "Error deleting descendent 'two' of service 'CorsService'"
    );
    expect(failures[0].error.originalErrors).toEqual([failure]);
  });

  test('with a callback, when every delete fails, every failure reaches it and nothing is thrown', async () => {
    deleteServiceNextDescendentMock.mockRejectedValue(failure);

    await expect(
      ServiceOps.deleteServiceNextDescendents({
        serviceId: 'CorsService',
        globalConfig: true,
        resultCallback: callback,
        state,
      })
    ).resolves.toEqual([]);

    expect(outcomes.filter((it) => it.error)).toHaveLength(3);
    expect(outcomes.filter((it) => it.result)).toHaveLength(0);
  });

  test('without a callback every descendent is attempted, then one error names each failed descendent', async () => {
    const completed: string[] = [];
    deleteServiceNextDescendentMock.mockImplementation(
      async ({ serviceNextDescendentId }: any) => {
        if (serviceNextDescendentId === 'two') {
          // still running when the failures of the others are known
          await new Promise((resolve) => setTimeout(resolve, 10));
          completed.push(serviceNextDescendentId);
          return { _id: serviceNextDescendentId };
        }
        throw failure;
      }
    );

    const error = await ServiceOps.deleteServiceNextDescendents({
      serviceId: 'CorsService',
      globalConfig: true,
      state,
    }).catch((error) => error);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toContain("service 'CorsService'");
    expect(error.message).toContain("descendent 'one'");
    expect(error.message).toContain("descendent 'three'");
    expect(error.message).not.toContain("descendent 'two'");
    expect(error.originalErrors).toHaveLength(2);
    expect(error.originalErrors.map((it: any) => it.originalErrors)).toEqual([
      [failure],
      [failure],
    ]);
    // all three were attempted, and the slow one was waited for
    expect(deletedIds().sort()).toEqual(['one', 'three', 'two']);
    expect(completed).toEqual(['two']);
  });

  test('without a callback the error names the failed descendents in the order they were listed, not in the order they failed', async () => {
    // listed one, two, three; they fail in the order two, three, one
    const delays: Record<string, number> = { one: 30, two: 0, three: 10 };
    const causes: Record<string, Error> = {
      one: requestError('Failure of one', { status: 500 }),
      two: requestError('Failure of two', { status: 500 }),
      three: requestError('Failure of three', { status: 500 }),
    };
    const failedInOrder: string[] = [];
    deleteServiceNextDescendentMock.mockImplementation(
      async ({ serviceNextDescendentId }: any) => {
        await new Promise((resolve) =>
          setTimeout(resolve, delays[serviceNextDescendentId])
        );
        failedInOrder.push(serviceNextDescendentId);
        throw causes[serviceNextDescendentId];
      }
    );

    const error = await ServiceOps.deleteServiceNextDescendents({
      serviceId: 'CorsService',
      globalConfig: true,
      state,
    }).catch((error) => error);

    expect(failedInOrder).toEqual(['two', 'three', 'one']);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      "Error deleting descendents of service 'CorsService': " +
        "Error deleting descendent 'one' of service 'CorsService'; " +
        "Error deleting descendent 'two' of service 'CorsService'; " +
        "Error deleting descendent 'three' of service 'CorsService'"
    );
    expect(error.originalErrors.map((it: any) => it.originalErrors[0])).toEqual(
      [causes.one, causes.two, causes.three]
    );
  });

  test('a failure to read the descendents throws, with or without a callback, and nothing is deleted or reported', async () => {
    getServiceDescendentsMock.mockRejectedValue(failure);

    for (const resultCallback of [undefined, callback]) {
      const error = await ServiceOps.deleteServiceNextDescendents({
        serviceId: 'CorsService',
        globalConfig: true,
        resultCallback,
        state,
      }).catch((error) => error);
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe(
        "Error deleting descendents of service 'CorsService'"
      );
      expect(error.originalErrors).toEqual([failure]);
    }
    expect(deleteServiceNextDescendentMock).not.toHaveBeenCalled();
    expect(outcomes).toHaveLength(0);
  });

  test('a listed descendent whose id is not a name is refused: it is reported like a failed delete, the others are deleted', async () => {
    getServiceDescendentsMock.mockResolvedValue([
      descendent('one'),
      descendent('..'),
      descendent('.'),
      descendent(''),
      descendent('three'),
    ]);

    const response = await ServiceOps.deleteServiceNextDescendents({
      serviceId: 'CorsService',
      globalConfig: true,
      resultCallback: callback,
      state,
    });

    expect(deletedIds()).toEqual(['one', 'three']);
    expect(response.map((it) => it._id)).toEqual(['one', 'three']);
    const failures = outcomes.filter((it) => it.error);
    expect(failures.map((it) => it.error.message)).toEqual([
      "Error deleting descendent '..' of service 'CorsService'",
      "Error deleting descendent '.' of service 'CorsService'",
      "Error deleting descendent '' of service 'CorsService'",
    ]);
    for (const { error } of failures) {
      expect(error.getCombinedMessage()).toContain(
        'cannot be used in a request path'
      );
    }
  });

  test('without a callback a refused descendent makes the error name it', async () => {
    getServiceDescendentsMock.mockResolvedValue([
      descendent('one'),
      descendent('..'),
    ]);

    const error = await ServiceOps.deleteServiceNextDescendents({
      serviceId: 'CorsService',
      globalConfig: true,
      state,
    }).catch((error) => error);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toContain("descendent '..'");
    expect(deletedIds()).toEqual(['one']);
  });

  test('the facade passes the callback on and works without one', async () => {
    const response = await ServiceOps.default(
      state
    ).deleteServiceNextDescendents('CorsService', true, callback);

    expect(response).toHaveLength(3);
    expect(outcomes).toHaveLength(3);
    expect(getServiceDescendentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 'CorsService', globalConfig: true })
    );

    outcomes = [];
    await ServiceOps.default(state).deleteServiceNextDescendents('CorsService');
    expect(outcomes).toHaveLength(0);
    expect(getServiceDescendentsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ globalConfig: false })
    );
  });
});

describe('deleteFullService and deleteFullServices on top of the descendents', () => {
  test('deleteFullService deletes the descendents first and the service last', async () => {
    getServiceDescendentsMock.mockResolvedValue([
      descendent('one'),
      descendent('two'),
    ]);

    const response = await ServiceOps.deleteFullService({
      serviceId: 'svc',
      globalConfig: true,
      state,
    });

    expect(response).toEqual(expect.objectContaining({ _id: 'svc' }));
    expect(deleteServiceNextDescendentMock).toHaveBeenCalledTimes(2);
    expect(deleteServiceMock).toHaveBeenCalledTimes(1);
    expect(deleteServiceMock).toHaveBeenCalledWith({
      serviceId: 'svc',
      globalConfig: true,
      state,
    });
    for (const order of deleteServiceNextDescendentMock.mock
      .invocationCallOrder) {
      expect(order).toBeLessThan(deleteServiceMock.mock.invocationCallOrder[0]);
    }
  });

  test('deleteFullService tries every descendent, names the ones that failed, and leaves the service', async () => {
    getServiceDescendentsMock.mockResolvedValue([
      descendent('one'),
      descendent('two'),
      descendent('three'),
    ]);
    deleteServiceNextDescendentMock.mockImplementation(
      async ({ serviceNextDescendentId }: any) => {
        if (serviceNextDescendentId !== 'two') {
          throw requestError('Server error', { status: 500 });
        }
        return { _id: serviceNextDescendentId };
      }
    );

    const error = await ServiceOps.deleteFullService({
      serviceId: 'svc',
      globalConfig: true,
      state,
    }).catch((error) => error);

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.getCombinedMessage()).toContain("descendent 'one'");
    expect(error.getCombinedMessage()).toContain("descendent 'three'");
    expect(deletedIds().sort()).toEqual(['one', 'three', 'two']);
    expect(deleteServiceMock).not.toHaveBeenCalled();
  });

  describe('a service that Cloud does not offer is skipped, however deep the error is wrapped', () => {
    beforeEach(() => {
      getListOfServicesMock.mockResolvedValue({
        result: ['unavailable', 'available'].map(service),
      });
    });

    test('the descendents cannot be read: the answer of the server is behind two wrappers', async () => {
      getServiceDescendentsMock.mockImplementation(
        async ({ serviceId }: any) => {
          if (serviceId === 'unavailable') {
            throw requestError('Unavailable', UNAVAILABLE);
          }
          return [];
        }
      );

      await expect(
        ServiceOps.deleteFullServices({ globalConfig: false, state })
      ).resolves.toEqual([expect.objectContaining({ _id: 'available' })]);
      expect(deleteServiceMock).toHaveBeenCalledTimes(1);
      expect(printMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });

    test('a descendent cannot be deleted: the answer of the server is behind three wrappers', async () => {
      getServiceDescendentsMock.mockImplementation(
        async ({ serviceId }: any) =>
          serviceId === 'unavailable' ? [descendent('child')] : []
      );
      deleteServiceNextDescendentMock.mockRejectedValue(
        requestError('Unavailable', UNAVAILABLE)
      );

      await expect(
        ServiceOps.deleteFullServices({ globalConfig: false, state })
      ).resolves.toEqual([expect.objectContaining({ _id: 'available' })]);
      expect(deleteServiceMock).toHaveBeenCalledTimes(1);
      expect(deleteServiceMock).toHaveBeenCalledWith(
        expect.objectContaining({ serviceId: 'available' })
      );
    });

    test('the same 403 with another message is a failure that names the service', async () => {
      getServiceDescendentsMock.mockImplementation(
        async ({ serviceId }: any) =>
          serviceId === 'unavailable' ? [descendent('child')] : []
      );
      deleteServiceNextDescendentMock.mockRejectedValue(
        requestError('Forbidden', {
          status: 403,
          data: { message: 'Permission denied' },
        })
      );

      const error = await ServiceOps.deleteFullServices({
        globalConfig: false,
        state,
      }).catch((error) => error);

      expect(error).toBeInstanceOf(FrodoError);
      expect(error.getCombinedMessage()).toContain("service 'unavailable'");
      expect(error.getCombinedMessage()).toContain("descendent 'child'");
    });

    test('another status with the message of an unavailable service is a failure, too', async () => {
      getServiceDescendentsMock.mockRejectedValue(
        requestError('Server error', {
          status: 500,
          data: UNAVAILABLE.data,
        })
      );

      await expect(
        ServiceOps.deleteFullServices({ globalConfig: false, state })
      ).rejects.toBeInstanceOf(FrodoError);
    });
  });
});
