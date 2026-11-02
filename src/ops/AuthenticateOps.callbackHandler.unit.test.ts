import { jest } from '@jest/globals';
import type { AuthenticateStep } from '../api/AuthenticateApi';
import type { Callback, CallbackHandler } from './CallbackOps';

jest.unstable_mockModule('./ConnectionProfileOps', () => ({
  findSavedConnectionTarget: () => undefined,
  getConnectionProfile: jest.fn(),
  loadConnectionProfile: jest.fn(),
  saveConnectionProfile: jest.fn(),
}));

jest.unstable_mockModule('../api/ServerInfoApi', () => ({
  getServerInfo: jest.fn(async () => ({
    cookieName: 'iPlanetDirectoryPro',
  })),
  getServerVersionInfo: jest.fn(async () => ({
    fullVersion: 'ForgeRock Access Management 7.3.0',
    version: '7.3.0',
  })),
  getIdmServerVersionInfo: jest.fn(),
}));

const step = jest.fn(async (_args?: any): Promise<any> => {
  throw new Error('Unexpected authentication step');
});

jest.unstable_mockModule('../api/AuthenticateApi', () => ({ step }));

jest.unstable_mockModule('./SessionOps', () => ({
  getSessionInfo: jest.fn(async () => ({
    maxIdleExpirationTime: new Date(Date.now() + 60_000).toISOString(),
    maxSessionExpirationTime: new Date(Date.now() + 60_000).toISOString(),
  })),
}));

jest.unstable_mockModule('./UserOps', () => ({
  readUser: jest.fn(async () => ({})),
}));

const { getTokens } = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');
const { FrodoError } = await import('./FrodoError');
const Constants = (await import('../shared/Constants')).default;

describe('AuthenticateOps callback handler through getTokens', () => {
  let challenge: AuthenticateStep;
  let callback: Callback;
  let state: ReturnType<typeof StateImpl>;

  beforeEach(() => {
    callback = {
      type: 'NameCallback',
      output: [{ name: 'prompt', value: 'Enter verification code' }],
      input: [{ name: 'IDToken1', value: '' }],
    };
    challenge = { authId: 'test-auth-id', callbacks: [callback] };
    state = StateImpl({
      host: 'https://openam.example.com/am',
      username: 'test-user',
      password: 'test-password',
      deploymentType: Constants.CLASSIC_DEPLOYMENT_TYPE_KEY,
    });
    state.setUseTokenCache(false);
    step.mockReset();
    step
      .mockResolvedValueOnce(challenge)
      .mockImplementationOnce(async (args) => {
        expect(args.body).toBe(challenge);
        expect(args.body.callbacks[0]).toBe(callback);
        expect(args.body.callbacks[0].input[0].value).toBe('123456');
        return { tokenId: 'test-session', successUrl: '/console', realm: '/' };
      });
  });

  async function login(callbackHandler?: CallbackHandler) {
    return getTokens({ state, autoRefresh: false, callbackHandler });
  }

  async function expectLoginFailure(
    callbackHandler: CallbackHandler | undefined,
    cause: Error | string,
    expectedSteps = 1
  ) {
    const error = await login(callbackHandler).catch((error) => error);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe('Error getting tokens');
    const authenticationError = error.originalErrors[0];
    expect(authenticationError).toBeInstanceOf(FrodoError);
    expect(authenticationError.message).toBe('Error authenticating user');
    if (typeof cause === 'string') {
      expect(authenticationError.originalErrors[0].message).toBe(cause);
    } else {
      expect(authenticationError.originalErrors[0]).toBe(cause);
    }
    expect(step).toHaveBeenCalledTimes(expectedSteps);
    expect(state.getCookieValue()).toBeFalsy();
  }

  test('awaits an asynchronous handler before submitting the original callback', async () => {
    const tokens = await login(async (received) => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      received.input[0].value = '123456';
      return received;
    });

    expect(tokens.userSessionToken.tokenId).toBe('test-session');
    expect(step).toHaveBeenCalledTimes(2);
  });

  test('keeps synchronous in-place handlers working', async () => {
    const tokens = await login((received) => {
      received.input[0].value = '123456';
      return received;
    });

    expect(tokens.userSessionToken.tokenId).toBe('test-session');
    expect(step).toHaveBeenCalledTimes(2);
  });

  test.each([false, true])(
    'ignores a different returned callback (promise: %s)',
    async (asynchronous) => {
      const tokens = await login((received) => {
        received.input[0].value = '123456';
        const replacement: Callback = {
          ...received,
          input: [{ name: 'IDToken1', value: 'ignored' }],
        };
        return asynchronous ? Promise.resolve(replacement) : replacement;
      });

      expect(tokens.userSessionToken.tokenId).toBe('test-session');
      expect(step).toHaveBeenCalledTimes(2);
    }
  );

  test('wraps a rejected handler promise and stops authentication', async () => {
    const cause = new Error('Callback rejected');
    await expectLoginFailure(async () => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      throw cause;
    }, cause);
  });

  test('preserves synchronous throw wrapping', async () => {
    const cause = new Error('Callback threw');
    await expectLoginFailure(() => {
      throw cause;
    }, cause);
  });

  test('preserves the missing handler error', async () => {
    await expectLoginFailure(
      undefined,
      '2fa required but no otpCallback function provided.'
    );
  });

  test('still limits asynchronous 2FA handling to three steps', async () => {
    step.mockReset();
    step.mockImplementation(async () => challenge);
    const handler = jest.fn<CallbackHandler>(async (received) => received);

    await expectLoginFailure(handler, 'Too many 2FA attempts', 4);

    expect(handler).toHaveBeenCalledTimes(3);
    expect(step).toHaveBeenCalledTimes(4);
  });
});
