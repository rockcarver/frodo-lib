import { jest } from '@jest/globals';
import StateImpl from '../../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../../test/utils/ErrorWrapping';

/**
 * LogOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: LogApi is replaced, there are no recordings and no network.
 */

const actualLogApi = await import('../../api/cloud/LogApi');
const logApi = {
  createLogApiKey: jest.fn<(...args: any[]) => Promise<any>>(),
  fetch: jest.fn<(...args: any[]) => Promise<any>>(),
  getLogApiKey: jest.fn<(...args: any[]) => Promise<any>>(),
  isLogApiKeyValid: jest.fn<(...args: any[]) => Promise<any>>(),
  tail: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../../api/cloud/LogApi', () => ({
  ...actualLogApi,
  ...logApi,
}));

const ops = await import('./LogOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(logApi)) api.mockReset();
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
    name: 'getLogApiKey',
    call: () => ops.getLogApiKey({ keyId: 'key-1', state }),
    api: logApi.getLogApiKey,
    message: 'Error getting log api key key-1',
  },
  {
    name: 'isLogApiKeyValid',
    call: () =>
      ops.isLogApiKeyValid({ keyId: 'key-1', secret: 'sample-secret', state }),
    api: logApi.isLogApiKeyValid,
    message: 'Error validating log api key key-1',
  },
  {
    name: 'createLogApiKey',
    call: () => ops.createLogApiKey({ keyName: 'matrix-key', state }),
    api: logApi.createLogApiKey,
    message: 'Error creating log api key matrix-key',
  },
  {
    name: 'tail',
    call: () =>
      ops.tail({ source: 'am-everything', cookie: 'sample-cookie', state }),
    api: logApi.tail,
    message: 'Error tailing logs',
  },
  {
    name: 'fetch',
    call: () =>
      ops.fetch({
        source: 'am-everything',
        startTs: '2026-01-01T00:00:00Z',
        endTs: '2026-01-01T01:00:00Z',
        cookie: 'sample-cookie',
        txid: 'txid-1',
        filter: 'sample-filter',
        state,
      }),
    api: logApi.fetch,
    message: 'Error fetching logs',
  },
];

describe('LogOps: a failed API call ends as a FrodoError', () => {
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
