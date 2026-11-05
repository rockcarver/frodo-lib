/**
 * Run tests
 *
 *        npm run test:only AuthenticateApi.anonymous
 *
 * Regression test for frodo-lib#897: step() sends the session cookie the state
 * holds unless it is asked to be anonymous. The real step() and the real
 * request interceptors run; only the transport is replaced by an adapter that
 * records the headers of the request that would have gone out.
 */
import { jest } from '@jest/globals';
import type { AxiosRequestConfig } from 'axios';

const sent: Record<string, unknown>[] = [];
const adapter = async (config: AxiosRequestConfig) => {
  sent.push({ ...(config.headers as object) });
  return {
    data: { tokenId: 'issued', successUrl: '/', realm: '/' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
};

const actualBaseApi = await import('./BaseApi');
jest.unstable_mockModule('./BaseApi', () => ({
  ...actualBaseApi,
  generateAmAuthApi: (args: any) =>
    actualBaseApi.generateAmAuthApi({
      ...args,
      requestOverride: { adapter },
    }),
}));

const { step } = await import('./AuthenticateApi');
const { default: StateImpl } = await import('../shared/State');

function stateWithSession() {
  const state = StateImpl({
    host: 'https://openam-example.example.com/am',
    deploymentType: 'classic',
  });
  state.setCookieName('iPlanetDirectoryPro');
  state.setUserSessionTokenMeta({
    tokenId: 'existing-token-id',
    successUrl: '/',
    realm: '/',
    expires: Date.now() + 30 * 60 * 1000,
  });
  return state;
}

describe('AuthenticateApi.step() and the session the state holds', () => {
  beforeEach(() => {
    sent.length = 0;
  });

  test('0: Method is implemented', () => {
    expect(step).toBeDefined();
  });

  test('1: Sends the session cookie by default', async () => {
    await step({ state: stateWithSession() });
    expect(sent).toHaveLength(1);
    expect(sent[0]['Cookie']).toBe('iPlanetDirectoryPro=existing-token-id');
  });

  test('2: Sends no session cookie when anonymous', async () => {
    await step({ anonymous: true, state: stateWithSession() });
    expect(sent).toHaveLength(1);
    expect(sent[0]['Cookie']).toBeUndefined();
    expect(sent[0]['Authorization']).toBeUndefined();
  });
});
