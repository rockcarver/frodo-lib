/**
 * Run tests
 *
 *        npm run test:only BrowserAuthenticateOps.refreshBrowserBearerToken
 */
import { jest } from '@jest/globals';

const accessToken = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('accessToken mock not configured for this call');
});
const deviceAuthorizationRequest = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('deviceAuthorizationRequest mock not configured for this call');
});

jest.unstable_mockModule('./OAuth2OidcOps', () => ({
  accessToken,
  deviceAuthorizationRequest,
}));

const { refreshBrowserBearerToken } = await import('./BrowserAuthenticateOps');
const { default: StateImpl } = await import('../shared/State');

describe('BrowserAuthenticateOps.refreshBrowserBearerToken', () => {
  const state = StateImpl({
    host: 'https://openam-example.forgeblocks.com/am',
  });

  beforeEach(() => {
    accessToken.mockReset();
    state.setRefreshToken(undefined);
    state.setBrowserLoginClientId(undefined);
  });

  test('0: Method is implemented', () => {
    expect(refreshBrowserBearerToken).toBeDefined();
  });

  test('1: Throws when the session has no refresh token', async () => {
    state.setBrowserLoginClientId('AICMCPClient');
    await expect(refreshBrowserBearerToken({ state })).rejects.toThrow(
      /no refresh token is available/
    );
    expect(accessToken).not.toHaveBeenCalled();
  });

  test('2: Performs a public-client refresh_token grant using the stored client id and refresh token', async () => {
    state.setRefreshToken('stored-refresh-token');
    state.setBrowserLoginClientId('AICMCPClient');
    accessToken.mockResolvedValueOnce({
      access_token: 'new-access-token',
      refresh_token: 'rotated-refresh-token',
      token_type: 'Bearer',
      scope: 'fr:am:* fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });

    const token = await refreshBrowserBearerToken({ state });

    expect(token.access_token).toBe('new-access-token');
    expect(accessToken).toHaveBeenCalledTimes(1);
    const call = accessToken.mock.calls[0][0] as {
      amBaseUrl: string;
      data: string;
    };
    expect(call.amBaseUrl).toBe('https://openam-example.forgeblocks.com/am');
    expect(call.data).toBe(
      'grant_type=refresh_token&refresh_token=stored-refresh-token&client_id=AICMCPClient'
    );
  });
});
