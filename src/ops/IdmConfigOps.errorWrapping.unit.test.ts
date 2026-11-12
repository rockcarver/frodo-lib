import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * IdmConfigOps: a failed API call ends as a FrodoError (frodo-lib#1033).
 *
 * deleteConfigEntity returns the promise of the API layer from a try block, and importSubConfigEntity and
 * removeSubConfigEntity return the promise of importConfigEntities. Without `await` the promise leaves the
 * try before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with
 * the context of the operation. Mocked unit test: IdmConfigApi is replaced, there are no recordings and no network.
 * The module is replaced as a whole (every export is listed) because loading the real one would load IdmConfigOps
 * first, through EmailTemplateOps, bound to the real API functions.
 */

const idmConfigApi = {
  getConfigStubs: jest.fn<(...args: any[]) => Promise<any>>(),
  getConfigEntities: jest.fn<(...args: any[]) => Promise<any>>(),
  getConfigEntitiesByType: jest.fn<(...args: any[]) => Promise<any>>(),
  getConfigEntity: jest.fn<(...args: any[]) => Promise<any>>(),
  putConfigEntity: jest.fn<(...args: any[]) => Promise<any>>(),
  patchConfigEntity: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteConfigEntity: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/IdmConfigApi', () => idmConfigApi);

const ops = await import('./IdmConfigOps');

const state = StateImpl({});
state.setRealm('alpha');

type Row = {
  name: string;
  call: () => Promise<unknown>;
  api: ReturnType<typeof jest.fn<(...args: any[]) => Promise<any>>>;
  message: string;
  wrappers?: number;
  arrange?: () => void;
};

const cases: Row[] = [
  {
    name: 'deleteConfigEntity',
    call: () => ops.deleteConfigEntity({ entityId: 'sync', state }),
    api: idmConfigApi.deleteConfigEntity,
    message: 'Error deleting config entity sync',
  },
  {
    // the failed write passes through updateConfigEntity and importConfigEntities (the entity, then the combined error), which wrap it first
    name: 'importSubConfigEntity',
    call: () =>
      ops.importSubConfigEntity({
        entityId: 'sync',
        updatedSubConfigEntity: { name: 'mapping-1' },
        options: { entitiesToImport: undefined, validate: false },
        state,
      }),
    api: idmConfigApi.putConfigEntity,
    message: 'Error importing sub config sync',
    wrappers: 4,
    arrange: () => {
      idmConfigApi.getConfigEntity.mockResolvedValue({
        _id: 'sync',
        mappings: [{ name: 'mapping-1' }],
      });
    },
  },
  {
    name: 'removeSubConfigEntity',
    call: () =>
      ops.removeSubConfigEntity({
        entityId: 'sync',
        name: 'mapping-1',
        state,
      }),
    api: idmConfigApi.putConfigEntity,
    message: 'Error removing sub config sync mapping-1',
    wrappers: 4,
    arrange: () => {
      idmConfigApi.getConfigEntity.mockResolvedValue({
        _id: 'sync',
        mappings: [{ name: 'mapping-1' }],
      });
    },
  },
];

describe('IdmConfigOps: a failed API call ends as a FrodoError', () => {
  beforeEach(() => {
    for (const api of Object.values(idmConfigApi)) api.mockReset();
  });

  test.each(cases)(
    '$name',
    async ({ call, api, message, wrappers, arrange }) => {
      const cause = failedRequest(500);
      arrange?.();
      api.mockRejectedValue(cause);
      await expectWrappedFailure(call(), message, cause, wrappers);
      expect(api).toHaveBeenCalledTimes(1);
    }
  );
});
