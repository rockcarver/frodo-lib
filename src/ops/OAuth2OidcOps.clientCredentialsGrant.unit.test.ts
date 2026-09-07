/**
 * Run tests
 *
 *        npm run test:only OAuth2OidcOps.clientCredentialsGrant
 *
 * Regression test for a real bug: clientCredentialsGrant() computed
 * `expires` as `Date.now() + expires_in` (treating a seconds value as
 * milliseconds), unlike its sibling accessToken() which correctly does
 * `Date.now() + expires_in * 1000`.
 */
import { jest } from '@jest/globals';

const clientCredentialsGrant = jest.fn(async (_args?: any): Promise<any> => ({
  access_token: 'fake-access-token',
  token_type: 'Bearer',
  scope: 'fr:idm:*',
  expires_in: 3600,
}));

jest.unstable_mockModule('../api/OAuth2OIDCApi', () => ({
  authorize: jest.fn(),
  accessToken: jest.fn(),
  accessTokenRfc7523AuthZGrant: jest.fn(),
  deviceAuthorizationRequest: jest.fn(),
  getTokenInfo: jest.fn(),
  clientCredentialsGrant,
}));

const { clientCredentialsGrant: clientCredentialsGrantOp } = await import(
  './OAuth2OidcOps'
);
const { default: StateImpl } = await import('../shared/State');

describe('OAuth2OidcOps.clientCredentialsGrant', () => {
  const state = StateImpl({
    host: 'https://openam-example.forgeblocks.com/am',
  });

  test('0: Method is implemented', () => {
    expect(clientCredentialsGrantOp).toBeDefined();
  });

  test('1: Computes expires in milliseconds from now, correctly converting expires_in seconds', async () => {
    const before = Date.now();
    const token = await clientCredentialsGrantOp({
      amBaseUrl: state.getHost(),
      clientId: 'client-1',
      clientSecret: 'secret-1',
      scope: 'fr:idm:*',
      state,
    });
    const after = Date.now();

    // expires_in is 3600 seconds == 3,600,000 ms — well outside a plausible
    // "seconds mistaken for ms" result (which would be ~3.6 seconds out).
    expect(token.expires).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(token.expires).toBeLessThanOrEqual(after + 3600 * 1000);
  });
});
