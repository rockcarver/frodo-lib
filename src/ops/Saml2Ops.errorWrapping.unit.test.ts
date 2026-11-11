import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  expectWrappedFailure,
  failedRequest,
} from '../test/utils/ErrorWrapping';

/**
 * Saml2Ops: a failed call ends as a FrodoError (frodo-lib#1033).
 *
 * These functions return the promise of the API layer from a try block. Without `await` the promise leaves the try
 * before it settles, the catch never runs, and the caller gets the raw AxiosError instead of the FrodoError with the
 * context of the operation. Every row makes the API function reject and checks the message of the FrodoError and
 * the cause in its originalErrors.
 * Mocked unit test: Saml2Api is replaced, there are no recordings and no network.
 */

const actualSaml2Api = await import('../api/Saml2Api');
const saml2Api = {
  createProvider: jest.fn<(...args: any[]) => Promise<any>>(),
  getProviderMetadata: jest.fn<(...args: any[]) => Promise<any>>(),
  updateProvider: jest.fn<(...args: any[]) => Promise<any>>(),
};
jest.unstable_mockModule('../api/Saml2Api', () => ({
  ...actualSaml2Api,
  ...saml2Api,
}));

const ops = await import('./Saml2Ops');

const state = StateImpl({});
state.setRealm('alpha');

function resetMocks() {
  for (const api of Object.values(saml2Api)) api.mockReset();
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
    name: 'getSaml2ProviderMetadata',
    call: () =>
      ops.getSaml2ProviderMetadata({ entityId: 'urn:matrix:sp', state }),
    api: saml2Api.getProviderMetadata,
    message: 'Error getting metadata for saml2 provider urn:matrix:sp',
  },
  {
    name: 'createSaml2Provider',
    call: () =>
      ops.createSaml2Provider({
        location: 'hosted',
        providerData: {} as any,
        state,
      }),
    api: saml2Api.createProvider,
    message: 'Error creating alpha realm saml2 provider',
  },
  {
    name: 'updateSaml2Provider',
    call: () =>
      ops.updateSaml2Provider({
        location: 'hosted',
        entityId: 'urn:matrix:sp',
        providerData: {} as any,
        state,
      }),
    api: saml2Api.updateProvider,
    message: 'Error updating alpha realm saml2 provider',
  },
];

describe('Saml2Ops: a failed API call ends as a FrodoError', () => {
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
