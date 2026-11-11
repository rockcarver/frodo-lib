import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * UserOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: UserApi is replaced, there are no recordings and no network.
 */

const actualUserApi = await import('../api/UserApi');
const userApi = {
  getUser: jest.fn<(...args: any[]) => Promise<any>>(),
  getUserGroup: jest.fn<(...args: any[]) => Promise<any>>(),
  getUserGroups: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/UserApi', () => ({
  ...actualUserApi,
  ...userApi,
}));

const ops = await import('./UserOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(userApi)) api.mockReset();
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
    name: 'readUser',
    call: () => ops.readUser({ userId: 'user-1', state }),
    api: userApi.getUser,
    message: 'Error reading user user-1',
  },
  {
    name: 'readUserGroup',
    call: () => ops.readUserGroup({ groupId: 'group-1', state }),
    api: userApi.getUserGroup,
    message: 'Error reading user group group-1',
  },
  {
    name: 'readUserGroups',
    call: () => ops.readUserGroups({ state }),
    api: userApi.getUserGroup,
    message: 'Error reading user groups',
    wrappers: 2,
    arrange: () => {
      userApi.getUserGroups.mockResolvedValue({ result: [{ _id: 'group-1' }] });
    },
  },
];

describe('UserOps: a failed API call ends as a FrodoError', () => {
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
