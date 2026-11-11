import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * OAuth2ProviderOps: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: OAuth2ProviderApi is replaced, there are no recordings and no network.
 */

const actualOAuth2ProviderApi = await import('../api/OAuth2ProviderApi');
const oAuth2ProviderApi = {
  createOAuth2Provider: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteOAuth2Provider: jest.fn<(...args: any[]) => Promise<any>>(),
  putOAuth2Provider: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/OAuth2ProviderApi', () => ({
  ...actualOAuth2ProviderApi,
  ...oAuth2ProviderApi,
}));

const ops = await import('./OAuth2ProviderOps');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(oAuth2ProviderApi)) api.mockReset();
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
    name: 'createOAuth2Provider',
    call: () => ops.createOAuth2Provider({ providerData: {} as any, state }),
    api: oAuth2ProviderApi.createOAuth2Provider,
    message: 'Error creating oauth2 provider',
  },
  {
    name: 'updateOAuth2Provider',
    call: () => ops.updateOAuth2Provider({ providerData: {} as any, state }),
    api: oAuth2ProviderApi.putOAuth2Provider,
    message: 'Error updating oauth2 provider',
  },
  {
    name: 'deleteOAuth2Provider',
    call: () => ops.deleteOAuth2Provider({ state }),
    api: oAuth2ProviderApi.deleteOAuth2Provider,
    message: 'Error deleting oauth2 provider',
  },
];

describe('OAuth2ProviderOps: a failed API call ends as a FrodoError', () => {
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
