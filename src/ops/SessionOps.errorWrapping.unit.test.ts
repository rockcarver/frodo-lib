import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * SessionOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: SessionApi is replaced, there are no recordings and no network.
 */

const actualSessionApi = await import('../api/SessionApi');
const sessionApi = {
  getSessionInfo: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/SessionApi', () => ({
  ...actualSessionApi,
  ...sessionApi,
}));

const ops = await import('./SessionOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(sessionApi)) api.mockReset();
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
    name: 'getSessionInfo',
    call: () => ops.getSessionInfo({ tokenId: 'sample-token-id', state }),
    api: sessionApi.getSessionInfo,
    message: 'Error getting session info',
  },
];

describe('SessionOps: a failed API call ends as a FrodoError', () => {
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
