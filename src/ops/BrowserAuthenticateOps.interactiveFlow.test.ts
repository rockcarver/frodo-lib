/**
 * Run tests
 *
 *        npm run test:only BrowserAuthenticateOps.interactiveFlow
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

const { runInteractiveAuthorizationCodeFlow } = await import(
  './BrowserAuthenticateOps'
);
const { default: StateImpl } = await import('../shared/State');

describe('BrowserAuthenticateOps.runInteractiveAuthorizationCodeFlow', () => {
  const state = StateImpl({
    host: 'https://openam-example.forgeblocks.com/am',
  });

  beforeEach(() => {
    accessToken.mockReset();
  });

  test('0: Method is implemented', () => {
    expect(runInteractiveAuthorizationCodeFlow).toBeDefined();
  });

  test('1: Presents the authorize URL with PKCE/state params, then exchanges the resulting code for a token', async () => {
    accessToken.mockResolvedValueOnce({
      access_token: 'at-1',
      token_type: 'Bearer',
      scope: 'openid fr:am:* fr:idm:*',
      expires_in: 3600,
      expires: Date.now() + 3600_000,
    });

    let capturedAuthorizeUrl: URL;
    const promptHandler = jest.fn(async (prompt: { authorizeUrl?: string }) => {
      capturedAuthorizeUrl = new URL(prompt.authorizeUrl);
      // simulate the real browser completing login and following the
      // authorization server's redirect back to our loopback listener
      const redirectUri = capturedAuthorizeUrl.searchParams.get('redirect_uri');
      const authState = capturedAuthorizeUrl.searchParams.get('state');
      await fetch(
        `${redirectUri}?code=simulated-code&state=${encodeURIComponent(authState)}`
      );
    });

    const token = await runInteractiveAuthorizationCodeFlow({
      clientId: 'AICMCPClient',
      scope: 'openid fr:am:* fr:idm:*',
      redirectHost: 'localhost',
      callbackPath: '',
      preferredPort: 0,
      promptHandler,
      state,
    });

    expect(token.access_token).toBe('at-1');
    expect(capturedAuthorizeUrl.pathname).toBe('/am/oauth2/authorize');
    expect(capturedAuthorizeUrl.searchParams.get('client_id')).toBe(
      'AICMCPClient'
    );
    expect(capturedAuthorizeUrl.searchParams.get('code_challenge_method')).toBe(
      'S256'
    );
    expect(capturedAuthorizeUrl.searchParams.get('redirect_uri')).toMatch(
      /^http:\/\/localhost:\d+$/
    );

    expect(accessToken).toHaveBeenCalledTimes(1);
    const call = accessToken.mock.calls[0][0] as {
      amBaseUrl: string;
      data: string;
    };
    expect(call.amBaseUrl).toBe('https://openam-example.forgeblocks.com/am');
    expect(call.data).toContain('grant_type=authorization_code');
    expect(call.data).toContain('code=simulated-code');
    expect(call.data).toContain('code_verifier=');
  });

  test('2: Throws with the authorization server error when the callback carries one, without attempting a token exchange', async () => {
    const promptHandler = jest.fn(async (prompt: { authorizeUrl?: string }) => {
      const url = new URL(prompt.authorizeUrl);
      const redirectUri = url.searchParams.get('redirect_uri');
      await fetch(
        `${redirectUri}?error=access_denied&error_description=User%20declined`
      );
    });

    await expect(
      runInteractiveAuthorizationCodeFlow({
        clientId: 'AICMCPClient',
        scope: 'openid',
        promptHandler,
        state,
      })
    ).rejects.toThrow(/access_denied/);
    expect(accessToken).not.toHaveBeenCalled();
  });
});
