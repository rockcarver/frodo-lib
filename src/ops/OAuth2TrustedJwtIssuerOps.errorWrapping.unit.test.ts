import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * OAuth2TrustedJwtIssuerOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: OAuth2TrustedJwtIssuerApi is replaced, there are no recordings and no network.
 */

const actualOAuth2TrustedJwtIssuerApi =
  await import('../api/OAuth2TrustedJwtIssuerApi');
const oAuth2TrustedJwtIssuerApi = {
  deleteOAuth2TrustedJwtIssuer: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/OAuth2TrustedJwtIssuerApi', () => ({
  ...actualOAuth2TrustedJwtIssuerApi,
  ...oAuth2TrustedJwtIssuerApi,
}));

const ops = await import('./OAuth2TrustedJwtIssuerOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(oAuth2TrustedJwtIssuerApi)) api.mockReset();
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
    name: 'deleteOAuth2TrustedJwtIssuer',
    call: () =>
      ops.deleteOAuth2TrustedJwtIssuer({ issuerId: 'issuer-1', state }),
    api: oAuth2TrustedJwtIssuerApi.deleteOAuth2TrustedJwtIssuer,
    message: 'Error deleting alpha realm trusted issuer issuer-1',
  },
];

describe('OAuth2TrustedJwtIssuerOps: a failed API call ends as a FrodoError', () => {
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
