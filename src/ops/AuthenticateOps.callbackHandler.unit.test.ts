import { jest } from '@jest/globals';
import type {
  AuthenticateResponse,
  AuthenticateStep,
} from '../api/AuthenticateApi';
import type { Callback, CallbackHandler } from './CallbackOps';

const step =
  jest.fn<
    (args: {
      body: AuthenticateStep | Record<string, never>;
    }) => Promise<AuthenticateResponse>
  >();

jest.unstable_mockModule('../api/AuthenticateApi', () => ({ step }));

jest.unstable_mockModule('../api/ServerInfoApi', () => ({
  getServerInfo: jest.fn(async () => ({ cookieName: 'iPlanetDirectoryPro' })),
  getServerVersionInfo: jest.fn(async () => ({})),
  getIdmServerVersionInfo: jest.fn(),
}));

jest.unstable_mockModule('./SessionOps', () => ({
  getSessionInfo: jest.fn(async () => ({
    maxIdleExpirationTime: new Date(Date.now() + 60_000).toISOString(),
    maxSessionExpirationTime: new Date(Date.now() + 120_000).toISOString(),
  })),
}));

jest.unstable_mockModule('./ConnectionProfileOps', () => ({
  findSavedConnectionTarget: () => undefined,
  getConnectionProfile: jest.fn(),
  loadConnectionProfile: jest.fn(),
  saveConnectionProfile: jest.fn(),
}));

const { getTokens } = await import('./AuthenticateOps');
const { default: StateImpl } = await import('../shared/State');
const { FrodoError } = await import('./FrodoError');

function otpStep(): AuthenticateStep {
  return {
    authId: 'mock-auth-id',
    callbacks: [
      {
        type: 'NameCallback',
        output: [{ name: 'prompt', value: 'Enter verification code' }],
        input: [{ name: 'IDToken1', value: '' }],
      },
    ],
  };
}

function login(callbackHandler?: CallbackHandler) {
  const state = StateImpl({ host: 'https://am.example.com/am' });
  state.setUsername('mock-user');
  state.setPassword('mock-password');
  state.setUseTokenCache(false);
  state.setDeploymentType('classic');
  state.setIsIGA(false);
  state.setIsPingFed(false);
  return getTokens({ callbackHandler, autoRefresh: false, state });
}

async function expectLoginError(
  promise: ReturnType<typeof login>,
  cause: Error | string
) {
  const error = await promise.catch((error: unknown) => error);
  expect(error).toBeInstanceOf(FrodoError);
  expect((error as InstanceType<typeof FrodoError>).message).toBe(
    'Error getting tokens'
  );
  const authenticationError = (error as InstanceType<typeof FrodoError>)
    .originalErrors[0] as InstanceType<typeof FrodoError>;
  expect(authenticationError).toBeInstanceOf(FrodoError);
  expect(authenticationError.message).toBe('Error authenticating user');
  if (typeof cause === 'string') {
    expect(authenticationError.originalErrors[0].message).toBe(cause);
  } else {
    expect(authenticationError.originalErrors[0]).toBe(cause);
  }
}

describe('AuthenticateOps callback handler through getTokens', () => {
  let challenge: AuthenticateStep;

  beforeEach(() => {
    challenge = otpStep();
    step.mockReset();
    step.mockResolvedValueOnce(challenge).mockResolvedValueOnce({
      tokenId: 'mock-session-token',
      successUrl: '',
      realm: '/',
    });
  });

  test('waits for a promise before submitting the callback filled in place', async () => {
    let submittedValue: string;
    step.mockReset();
    step
      .mockResolvedValueOnce(challenge)
      .mockImplementationOnce(async ({ body }) => {
        submittedValue = (body as AuthenticateStep).callbacks[0].input[0].value;
        return {
          tokenId: 'mock-session-token',
          successUrl: '',
          realm: '/',
        };
      });
    const handler = jest.fn(async (callback: Callback) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      callback.input[0].value = '123456';
      return callback;
    });

    const result = login(handler);

    expect((await result).userSessionToken?.tokenId).toBe('mock-session-token');
    expect(handler).toHaveBeenCalledWith(challenge.callbacks[0]);
    expect(step.mock.calls[1][0].body).toBe(challenge);
    expect(submittedValue).toBe('123456');
  });

  test('keeps synchronous in-place handlers working unchanged', async () => {
    const handler = jest.fn((callback: Callback) => {
      callback.input[0].value = '123456';
      return callback;
    });

    expect((await login(handler)).userSessionToken?.tokenId).toBe(
      'mock-session-token'
    );
    expect(step.mock.calls[1][0].body).toBe(challenge);
    expect(challenge.callbacks[0].input[0].value).toBe('123456');
  });

  test.each([false, true])(
    'ignores a different returned callback (async: %s)',
    async (asynchronous) => {
      const different: Callback = {
        ...challenge.callbacks[0],
        input: [{ name: 'IDToken1', value: 'ignored' }],
      };
      const handler: CallbackHandler = (callback) => {
        callback.input[0].value = '123456';
        return asynchronous ? Promise.resolve(different) : different;
      };

      await login(handler);

      const submitted = step.mock.calls[1][0].body as AuthenticateStep;
      expect(submitted.callbacks[0]).toBe(challenge.callbacks[0]);
      expect(submitted.callbacks[0].input[0].value).toBe('123456');
    }
  );

  test('wraps a handler rejection and does not submit another step', async () => {
    const cause = new Error('async prompt failed');
    await expectLoginError(
      login(async () => {
        throw cause;
      }),
      cause
    );
    expect(step).toHaveBeenCalledTimes(1);
  });

  test('preserves wrapping of a synchronous throw', async () => {
    const cause = new Error('sync prompt failed');
    await expectLoginError(
      login(() => {
        throw cause;
      }),
      cause
    );
    expect(step).toHaveBeenCalledTimes(1);
  });

  test('preserves the missing OTP handler error', async () => {
    await expectLoginError(
      login(),
      '2fa required but no otpCallback function provided.'
    );
    expect(step).toHaveBeenCalledTimes(1);
  });

  test('still limits authentication to three handled steps', async () => {
    step.mockReset().mockImplementation(async () => otpStep());
    const handler = jest.fn(async (callback: Callback) => {
      callback.input[0].value = '123456';
      return callback;
    });

    await expectLoginError(login(handler), 'Too many 2FA attempts');

    expect(handler).toHaveBeenCalledTimes(3);
    expect(step).toHaveBeenCalledTimes(4);
  });
});
