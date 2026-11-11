import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * IdmSystemOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: IdmSystemApi is replaced, there are no recordings and no network.
 */

const actualIdmSystemApi = await import('../api/IdmSystemApi');
const idmSystemApi = {
  authenticateSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
  createSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
  getSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
  patchSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
  putSystemObject: jest.fn<(...args: any[]) => Promise<any>>(),
  queryAllSystemObjectIds: jest.fn<(...args: any[]) => Promise<any>>(),
  querySystemObjects: jest.fn<(...args: any[]) => Promise<any>>(),
  readAvailableConnectors: jest.fn<(...args: any[]) => Promise<any>>(),
  readAvailableSystems: jest.fn<(...args: any[]) => Promise<any>>(),
  readSystemStatus: jest.fn<(...args: any[]) => Promise<any>>(),
  runSystemScript: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/IdmSystemApi', () => ({
  ...actualIdmSystemApi,
  ...idmSystemApi,
}));

const ops = await import('./IdmSystemOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(idmSystemApi)) api.mockReset();
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
    name: 'readAvailableSystems',
    call: () => ops.readAvailableSystems({ state }),
    api: idmSystemApi.readAvailableSystems,
    message: 'Error reading available systems',
  },
  {
    name: 'readAvailableConnectors',
    call: () => ops.readAvailableConnectors({ state }),
    api: idmSystemApi.readAvailableConnectors,
    message: 'Error reading available connectors',
  },
  {
    name: 'readSystemStatus',
    call: () => ops.readSystemStatus({ systemName: 'ldap', state }),
    api: idmSystemApi.readSystemStatus,
    message: 'Error reading system status',
  },
  {
    name: 'authenticateSystemObject',
    call: () =>
      ops.authenticateSystemObject({
        systemName: 'ldap',
        systemObjectType: 'account',
        username: 'bjensen',
        password: 'sample-password',
        state,
      }),
    api: idmSystemApi.authenticateSystemObject,
    message: 'Error authenticating account bjensen in system ldap',
  },
  {
    name: 'runSystemScript',
    call: () =>
      ops.runSystemScript({
        systemName: 'ldap',
        scriptName: 'sync-users',
        state,
      }),
    api: idmSystemApi.runSystemScript,
    message: 'Error running script sync-users in system ldap',
  },
  {
    name: 'queryAllSystemObjectIds',
    call: () =>
      ops.queryAllSystemObjectIds({
        systemName: 'ldap',
        systemObjectType: 'account',
        state,
      }),
    api: idmSystemApi.queryAllSystemObjectIds,
    message: 'Error querying all account IDs in system ldap',
  },
  {
    name: 'querySystemObjects',
    call: () =>
      ops.querySystemObjects({
        systemName: 'ldap',
        systemObjectType: 'account',
        filter: 'true',
        state,
      }),
    api: idmSystemApi.querySystemObjects,
    message:
      'Error querying account objects in system ldap matching filter "true"',
  },
  {
    name: 'readSystemObject',
    call: () =>
      ops.readSystemObject({
        systemName: 'ldap',
        systemObjectType: 'account',
        systemObjectId: 'u1',
        state,
      }),
    api: idmSystemApi.getSystemObject,
    message: 'Error reading account u1 in system ldap',
  },
  {
    name: 'createSystemObject',
    call: () =>
      ops.createSystemObject({
        systemName: 'ldap',
        systemObjectType: 'account',
        systemObjectData: {},
        state,
      }),
    api: idmSystemApi.createSystemObject,
    message: 'Error creating account object in system ldap',
  },
  {
    name: 'updateSystemObject',
    call: () =>
      ops.updateSystemObject({
        systemName: 'ldap',
        systemObjectType: 'account',
        systemObjectId: 'u1',
        systemObjectData: {},
        state,
      }),
    api: idmSystemApi.putSystemObject,
    message: 'Error updating account u1 in system ldap',
  },
  {
    name: 'updateSystemObjectProperties',
    call: () =>
      ops.updateSystemObjectProperties({
        systemName: 'ldap',
        systemObjectType: 'account',
        systemObjectId: 'u1',
        operations: [],
        state,
      }),
    api: idmSystemApi.patchSystemObject,
    message: 'Error updating account u1 properties in system ldap',
  },
  {
    name: 'deleteSystemObject',
    call: () =>
      ops.deleteSystemObject({
        systemName: 'ldap',
        systemObjectType: 'account',
        systemObjectId: 'u1',
        state,
      }),
    api: idmSystemApi.deleteSystemObject,
    message: 'Error deleting account u1 from system ldap',
  },
];

describe('IdmSystemOps: a failed API call ends as a FrodoError', () => {
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
