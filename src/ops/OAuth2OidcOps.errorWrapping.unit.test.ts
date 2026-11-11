import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * OAuth2OidcOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: OAuth2OIDCApi is replaced, there are no recordings and no network.
 */

const actualOAuth2OIDCApi = await import('../api/OAuth2OIDCApi');
const oAuth2OIDCApi = {
  accessToken: jest.fn<(...args: any[]) => Promise<any>>(),
  authorize: jest.fn<(...args: any[]) => Promise<any>>(),
  getTokenInfo: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/OAuth2OIDCApi', () => ({
  ...actualOAuth2OIDCApi,
  ...oAuth2OIDCApi,
}));

const ops = await import('./OAuth2OidcOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(oAuth2OIDCApi)) api.mockReset();
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
    name: 'authorize',
    call: () =>
      ops.authorize({
        amBaseUrl: 'https://openam-matrix.example.com/am',
        data: 'client_id=client-1',
        config: {},
        state,
      }),
    api: oAuth2OIDCApi.authorize,
    message: 'Error authorizing oauth2 client',
  },
  {
    name: 'accessTokenRfc7523AuthZGrant',
    call: () =>
      ops.accessTokenRfc7523AuthZGrant({
        clientId: 'client-1',
        jwt: 'sample-jwt',
        scope: ['fr:idm:*'],
        state,
      }),
    api: oAuth2OIDCApi.accessToken,
    message: 'Error getting oauth2 access token (RFC7523 AuthZ Grant)',
    wrappers: 2,
  },
  {
    name: 'getTokenInfo',
    call: () =>
      ops.getTokenInfo({
        amBaseUrl: 'https://openam-matrix.example.com/am',
        config: {},
        state,
      }),
    api: oAuth2OIDCApi.getTokenInfo,
    message: 'Error getting oauth2 token info',
  },
];

describe('OAuth2OidcOps: a failed API call ends as a FrodoError', () => {
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
