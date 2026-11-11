import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * OAuth2ClientOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: OAuth2ClientApi is replaced, there are no recordings and no network.
 */

const actualOAuth2ClientApi = await import('../api/OAuth2ClientApi');
const oAuth2ClientApi = {
  deleteOAuth2Client: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/OAuth2ClientApi', () => ({
  ...actualOAuth2ClientApi,
  ...oAuth2ClientApi,
}));

const ops = await import('./OAuth2ClientOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(oAuth2ClientApi)) api.mockReset();
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
    name: 'deleteOAuth2Client',
    call: () => ops.deleteOAuth2Client({ clientId: 'client-1', state }),
    api: oAuth2ClientApi.deleteOAuth2Client,
    message: 'Error deleting alpha realm oauth2 client client-1',
  },
];

describe('OAuth2ClientOps: a failed API call ends as a FrodoError', () => {
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
