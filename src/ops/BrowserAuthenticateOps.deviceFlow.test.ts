/**
 * Run tests
 *
 *        npm run test:only BrowserAuthenticateOps.deviceFlow
 */
import { jest } from '@jest/globals';

const deviceAuthorizationRequest = jest.fn(
  async (_args?: any): Promise<any> => ({
    device_code: 'device-code-1',
    user_code: 'ABCD-EFGH',
    verification_uri: 'https://openam-example.forgeblocks.com/am/device',
    verification_uri_complete:
      'https://openam-example.forgeblocks.com/am/device?user_code=ABCD-EFGH',
    expires_in: 600,
    interval: 0.01, // keep the test fast; real servers return whole seconds
  })
);

const accessToken = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('accessToken mock not configured for this call');
});

jest.unstable_mockModule('./OAuth2OidcOps', () => ({
  deviceAuthorizationRequest,
  accessToken,
}));

const { startDeviceAuthorizationFlow } =
  await import('./BrowserAuthenticateOps');
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

  // The server error after the approval, as measured on Cloud development tenants (2026-11-13 and
  // 2026-11-14): `POST .../access_token` answers `500 server_error: Failed to issue access token`.
  function serverError(headers: Record<string, unknown> = {}) {
    return new FrodoError(
      'Error getting oauth2 access token',
      Object.assign(new Error('Request failed with status code 500'), {
        name: 'AxiosError',
        response: {
          status: 500,
          data: {
            error: 'server_error',
            error_description: 'Failed to issue access token',
          },
          headers,
        },
      })
    );
  }

  test('4: A 500 server_error after the approval is explained, with client, scope, transaction id and the original error attached', async () => {
    const original = serverError({
      'x-forgerock-transactionid': 'frodo-test-tx-1',
    });
    accessToken.mockRejectedValueOnce(original);

    const error = await startDeviceAuthorizationFlow({
      clientId: 'AICMCPClient',
      scope: 'fr:am:* fr:idm:*',
      promptHandler: noopPromptHandler,
      state,
    }).then(
      () => {
        throw new Error('Expected the flow to fail');
      },
      (e: unknown) => e as InstanceType<typeof FrodoError>
    );

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.code).toBe('DEVICE_LOGIN_TOKEN_NOT_ISSUED');
    expect(error.originalErrors[0]).toBe(original);
    expect(error.message).toContain('approved');
    expect(error.message).toContain('HTTP 500 server_error');
    expect(error.message).toContain('Failed to issue access token');
    expect(error.message).toContain('Client: AICMCPClient');
    expect(error.message).toContain('Requested scope: [fr:am:* fr:idm:*]');
    expect(error.message).toContain('Transaction id: frodo-test-tx-1');
    // asked for fr:am:*: says what was measured and what works instead
    expect(error.message).toContain('did not complete');
    expect(error.message).toContain('without fr:am:*');
    expect(error.message).toContain(
      'browser (authorization code) login or a service account'
    );
    // the library names no interface of a caller
    expect(error.message).not.toMatch(/--[a-z]|frodo |conn save|FRODO_/);
    expect(accessToken).toHaveBeenCalledTimes(1);
  });

  test('5: A 500 server_error for a request without fr:am:* is explained too, without the advice about that scope', async () => {
    accessToken.mockRejectedValueOnce(serverError());

    const error = await startDeviceAuthorizationFlow({
      clientId: 'AICMCPClient',
      scope: 'fr:idm:* fr:idc:esv:read',
      promptHandler: noopPromptHandler,
      state,
    }).then(
      () => {
        throw new Error('Expected the flow to fail');
      },
      (e: unknown) => e as InstanceType<typeof FrodoError>
    );

    expect(error.code).toBe('DEVICE_LOGIN_TOKEN_NOT_ISSUED');
    expect(error.message).toContain(
      'Requested scope: [fr:idm:* fr:idc:esv:read]'
    );
    expect(error.message).not.toContain('Transaction id');
    expect(error.message).not.toContain('did not complete');
  });

  test('6: A 500 that is not an OAuth server_error, and other statuses, pass through unchanged', async () => {
    const htmlError = new FrodoError(
      'Error getting oauth2 access token',
      Object.assign(new Error('Request failed with status code 500'), {
        name: 'AxiosError',
        response: { status: 500, data: '<html>boom</html>', headers: {} },
      })
    );
    accessToken.mockRejectedValueOnce(htmlError);
    await expect(
      startDeviceAuthorizationFlow({
        clientId: 'AICMCPClient',
        scope: 'fr:am:* fr:idm:*',
        promptHandler: noopPromptHandler,
        state,
      })
    ).rejects.toBe(htmlError);

    const badGateway = new FrodoError(
      'Error getting oauth2 access token',
      Object.assign(new Error('Request failed with status code 502'), {
        name: 'AxiosError',
        response: {
          status: 502,
          data: { error: 'server_error' },
          headers: {},
        },
      })
    );
    accessToken.mockRejectedValueOnce(badGateway);
    await expect(
      startDeviceAuthorizationFlow({
        clientId: 'AICMCPClient',
        scope: 'fr:am:* fr:idm:*',
        promptHandler: noopPromptHandler,
        state,
      })
    ).rejects.toBe(badGateway);
  });
});
