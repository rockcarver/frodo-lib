import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * ManagedObjectOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: ManagedObjectApi is replaced, there are no recordings and no network.
 */

const actualManagedObjectApi = await import('../api/ManagedObjectApi');
const managedObjectApi = {
  countManagedObjects: jest.fn<(...args: any[]) => Promise<any>>(),
  createManagedObject: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteManagedObject: jest.fn<(...args: any[]) => Promise<any>>(),
  getManagedObject: jest.fn<(...args: any[]) => Promise<any>>(),
  patchManagedObject: jest.fn<(...args: any[]) => Promise<any>>(),
  putManagedObject: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/ManagedObjectApi', () => ({
  ...actualManagedObjectApi,
  ...managedObjectApi,
}));

const ops = await import('./ManagedObjectOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(managedObjectApi)) api.mockReset();
}

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
    name: 'readManagedObject',
    call: () =>
      ops.readManagedObject({
        type: 'alpha_user',
        id: 'u1',
        fields: ['*'],
        state,
      }),
    api: managedObjectApi.getManagedObject,
    message: 'Error reading managed alpha_user object',
  },
  {
    name: 'countManagedObjects',
    call: () => ops.countManagedObjects({ type: 'alpha_user', state }),
    api: managedObjectApi.countManagedObjects,
    message: 'Error counting managed alpha_user objects matching filter "true"',
  },
  {
    name: 'updateManagedObject',
    call: () =>
      ops.updateManagedObject({
        type: 'alpha_user',
        id: 'u1',
        moData: {},
        state,
      }),
    api: managedObjectApi.putManagedObject,
    message: 'Error updating managed alpha_user object (u1)',
  },
  {
    name: 'updateManagedObjectProperties',
    call: () =>
      ops.updateManagedObjectProperties({
        type: 'alpha_user',
        id: 'u1',
        operations: [],
        state,
      }),
    api: managedObjectApi.patchManagedObject,
    message: 'Error updating managed alpha_user object properties (u1)',
  },
  {
    name: 'deleteManagedObject',
    call: () =>
      ops.deleteManagedObject({ type: 'alpha_user', id: 'u1', state }),
    api: managedObjectApi.deleteManagedObject,
    message: 'Error deleting managed alpha_user object (u1)',
  },
  {
    name: 'createManagedObject (with id)',
    call: () =>
      ops.createManagedObject({
        type: 'alpha_user',
        id: 'u1',
        moData: {},
        state,
      }),
    api: managedObjectApi.putManagedObject,
    message: 'Error creating managed alpha_user object (u1)',
  },
  {
    name: 'createManagedObject (without id)',
    call: () =>
      ops.createManagedObject({ type: 'alpha_user', moData: {}, state }),
    api: managedObjectApi.createManagedObject,
    message: 'Error creating managed alpha_user object',
  },
];

describe('ManagedObjectOps: a failed API call ends as a FrodoError', () => {
  beforeEach(resetMocks);

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
