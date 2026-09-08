/**
 * Run tests
 *
 *        npm run test:only BrowserAuthenticateOps.deviceFlow
 */
import { jest } from '@jest/globals';

const deviceAuthorizationRequest = jest.fn(async (_args?: any): Promise<any> => ({
  device_code: 'device-code-1',
  user_code: 'ABCD-EFGH',
  verification_uri: 'https://openam-example.forgeblocks.com/am/device',
  verification_uri_complete:
    'https://openam-example.forgeblocks.com/am/device?user_code=ABCD-EFGH',
  expires_in: 600,
  interval: 0.01, // keep the test fast; real servers return whole seconds
}));

const accessToken = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('accessToken mock not configured for this call');
});

jest.unstable_mockModule('./OAuth2OidcOps', () => ({
  deviceAuthorizationRequest,
  accessToken,
}));

const { startDeviceAuthorizationFlow } = await import(
  './BrowserAuthenticateOps'
);
const { default: StateImpl } = await import('../shared/State');
const { FrodoError } = await import('./FrodoError');

const noopPromptHandler = jest.fn((): void => undefined);

describe('BrowserAuthenticateOps device-authorization flow', () => {
  const state = StateImpl({
    host: 'https://openam-example.forgeblocks.com/am',
  });

  beforeEach(() => {
    deviceAuthorizationRequest.mockClear();
    accessToken.mockReset();
    noopPromptHandler.mockClear();
  });

  test('0: Method is implemented', () => {
    expect(startDeviceAuthorizationFlow).toBeDefined();
  });

  test('1: Prompts the caller with the user code and verification URI, then returns the token once approved', async () => {
    accessToken.mockResolvedValueOnce({
      access_token: 'at-1',
      token_type: 'Bearer',
      scope: 'openid',
      expires_in: 3600,
      expires: Date.now() + 3600_000,
    });
    const promptHandler = jest.fn((): void => undefined);

    const token = await startDeviceAuthorizationFlow({
      clientId: 'AICMCPClient',
      scope: 'openid fr:am:* fr:idm:*',
      promptHandler,
      state,
    });

    expect(promptHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        userCode: 'ABCD-EFGH',
        verificationUri:
          'https://openam-example.forgeblocks.com/am/device?user_code=ABCD-EFGH',
      })
    );
    expect(token.access_token).toBe('at-1');
    expect(deviceAuthorizationRequest).toHaveBeenCalledTimes(1);
  });

  test('2: Keeps polling through authorization_pending and slow_down before succeeding', async () => {
    const pending = new FrodoError(
      'Error getting oauth2 access token',
      Object.assign(new Error('pending'), {
        name: 'AxiosError',
        response: { data: { error: 'authorization_pending' } },
      })
    );
    const slowDown = new FrodoError(
      'Error getting oauth2 access token',
      Object.assign(new Error('slow down'), {
        name: 'AxiosError',
        response: { data: { error: 'slow_down' } },
      })
    );
    accessToken
      .mockRejectedValueOnce(pending)
      .mockRejectedValueOnce(slowDown)
      .mockResolvedValueOnce({
        access_token: 'at-2',
        token_type: 'Bearer',
        scope: 'openid',
        expires_in: 3600,
        expires: Date.now() + 3600_000,
      });

    const token = await startDeviceAuthorizationFlow({
      clientId: 'AICMCPClient',
      scope: 'openid',
      promptHandler: noopPromptHandler,
      state,
    });

    expect(accessToken).toHaveBeenCalledTimes(3);
    expect(token.access_token).toBe('at-2');
  });

  test('3: Propagates a non-retryable OAuth error immediately instead of continuing to poll', async () => {
    const accessDenied = new FrodoError(
      'Error getting oauth2 access token',
      Object.assign(new Error('denied'), {
        name: 'AxiosError',
        response: { data: { error: 'access_denied' } },
      })
    );
    accessToken.mockRejectedValueOnce(accessDenied);

    await expect(
      startDeviceAuthorizationFlow({
        clientId: 'AICMCPClient',
        scope: 'openid',
        promptHandler: noopPromptHandler,
        state,
      })
    ).rejects.toBe(accessDenied);
    expect(accessToken).toHaveBeenCalledTimes(1);
  });
});
