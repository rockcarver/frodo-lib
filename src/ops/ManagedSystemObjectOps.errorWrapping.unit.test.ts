import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * ManagedSystemObjectOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: ManagedSystemObjectApi is replaced, there are no recordings and no network.
 */

const actualManagedSystemObjectApi =
  await import('../api/ManagedSystemObjectApi');
const managedSystemObjectApi = {
  countManagedSystemObjects: jest.fn<(...args: any[]) => Promise<any>>(),
  createManagedSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteManagedSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
  getManagedSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
  patchManagedSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
  putManagedSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/ManagedSystemObjectApi', () => ({
  ...actualManagedSystemObjectApi,
  ...managedSystemObjectApi,
}));

const ops = await import('./ManagedSystemObjectOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(managedSystemObjectApi)) api.mockReset();
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
    name: 'readManagedSystemObject',
    call: () =>
      ops.readManagedSystemObject({
        type: 'system/ldap/account',
        id: 'u1',
        fields: ['*'],
        state,
      }),
    api: managedSystemObjectApi.getManagedSystemObject,
    message: 'Error reading managed system/ldap/account object',
  },
  {
    name: 'countManagedSystemObjects',
    call: () =>
      ops.countManagedSystemObjects({ type: 'system/ldap/account', state }),
    api: managedSystemObjectApi.countManagedSystemObjects,
    message:
      'Error counting managed system/ldap/account objects matching filter "true"',
  },
  {
    name: 'updateManagedSystemObject',
    call: () =>
      ops.updateManagedSystemObject({
        type: 'system/ldap/account',
        id: 'u1',
        moData: {},
        state,
      }),
    api: managedSystemObjectApi.putManagedSystemObject,
    message: 'Error updating managed system/ldap/account object (u1)',
  },
  {
    name: 'updateManagedSystemObjectProperties',
    call: () =>
      ops.updateManagedSystemObjectProperties({
        type: 'system/ldap/account',
        id: 'u1',
        operations: [],
        state,
      }),
    api: managedSystemObjectApi.patchManagedSystemObject,
    message:
      'Error updating managed system/ldap/account object properties (u1)',
  },
  {
    name: 'deleteManagedSystemObject',
    call: () =>
      ops.deleteManagedSystemObject({
        type: 'system/ldap/account',
        id: 'u1',
        state,
      }),
    api: managedSystemObjectApi.deleteManagedSystemObject,
    message: 'Error deleting managed system/ldap/account object (u1)',
  },
  {
    name: 'createManagedSystemObject (with id)',
    call: () =>
      ops.createManagedSystemObject({
        type: 'system/ldap/account',
        id: 'u1',
        moData: {},
        state,
      }),
    api: managedSystemObjectApi.putManagedSystemObject,
    message: 'Error creating managed system/ldap/account object (u1)',
  },
  {
    name: 'createManagedSystemObject (without id)',
    call: () =>
      ops.createManagedSystemObject({
        type: 'system/ldap/account',
        moData: {},
        state,
      }),
    api: managedSystemObjectApi.createManagedSystemObject,
    message: 'Error creating managed system/ldap/account object',
  },
];

describe('ManagedSystemObjectOps: a failed API call ends as a FrodoError', () => {
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
