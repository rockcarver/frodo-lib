import { jest } from '@jest/globals';
import StateImpl from '../../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../../test/utils/ErrorWrapping';

/**
 * ServerOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: ServerApi is replaced, there are no recordings and no network.
 */

const actualServerApi = await import('../../api/classic/ServerApi');
const serverApi = {
  getServer: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../../api/classic/ServerApi', () => ({
  ...actualServerApi,
  ...serverApi,
}));

const ops = await import('./ServerOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(serverApi)) api.mockReset();
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
    name: 'readServer',
    call: () => ops.readServer({ serverId: '01', state }),
    api: serverApi.getServer,
    message: 'Error reading server 01',
  },
];

describe('ServerOps: a failed API call ends as a FrodoError', () => {
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
