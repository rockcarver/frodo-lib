/**
 * Run tests
 *
 *        npm run test:only BrowserAuthenticateOps.loopback
 */
import {
  generateStateNonce,
  startLoopbackRedirectListener,
} from './BrowserAuthenticateOps';

describe('BrowserAuthenticateOps loopback listener', () => {
  test('0: Methods are implemented', () => {
    expect(startLoopbackRedirectListener).toBeDefined();
    expect(generateStateNonce).toBeDefined();
  });

  test('1: Binds to an OS-assigned loopback port by default', async () => {
    const listener = await startLoopbackRedirectListener({
      expectedState: generateStateNonce(),
    });
    try {
      expect(listener.port).toBeGreaterThan(0);
      expect(listener.redirectUri).toBe(
        `http://127.0.0.1:${listener.port}/callback`
      );
    } finally {
      listener.close();
    }
  });

  test('2: Resolves with the authorization code when the callback state matches', async () => {
    const expectedState = generateStateNonce();
    const listener = await startLoopbackRedirectListener({ expectedState });
    const callbackPromise = listener.waitForCallback();

    const response = await fetch(
      `${listener.redirectUri}?code=abc123&state=${expectedState}`
    );
    expect(response.status).toBe(200);

    const result = await callbackPromise;
    expect(result).toEqual({
      code: 'abc123',
      state: expectedState,
      error: undefined,
      errorDescription: undefined,
    });
  });

  test('3: Reports state_mismatch and never surfaces the mismatched code when the callback state is wrong', async () => {
    const listener = await startLoopbackRedirectListener({
      expectedState: generateStateNonce(),
    });
    const callbackPromise = listener.waitForCallback();

    const response = await fetch(
      `${listener.redirectUri}?code=abc123&state=someone-elses-state`
    );
    expect(response.status).toBe(400);

    const result = await callbackPromise;
    expect(result.error).toBe('state_mismatch');
    expect(result.code).toBeUndefined();
  });

  test('4: Passes through an authorization-server error without requiring state to match', async () => {
    const listener = await startLoopbackRedirectListener({
      expectedState: generateStateNonce(),
    });
    const callbackPromise = listener.waitForCallback();

    await fetch(
      `${listener.redirectUri}?error=access_denied&error_description=User%20declined`
    );

    const result = await callbackPromise;
    expect(result.error).toBe('access_denied');
    expect(result.errorDescription).toBe('User declined');
  });

  test('5: Rejects a request to any path other than the callback path with 404 and does not resolve the callback', async () => {
    const listener = await startLoopbackRedirectListener({
      expectedState: generateStateNonce(),
    });
    try {
      const response = await fetch(`http://127.0.0.1:${listener.port}/other`);
      expect(response.status).toBe(404);
    } finally {
      listener.close();
    }
  });

  test('6: waitForCallback() rejects once the timeout elapses', async () => {
    const listener = await startLoopbackRedirectListener({
      expectedState: generateStateNonce(),
    });
    await expect(listener.waitForCallback(50)).rejects.toThrow(/Timed out/);
  });

  test('7: Honors a preferred fixed port when provided', async () => {
    const probe = await startLoopbackRedirectListener({
      expectedState: generateStateNonce(),
    });
    const preferredPort = probe.port;
    probe.close();

    const listener = await startLoopbackRedirectListener({
      preferredPort,
      expectedState: generateStateNonce(),
    });
    try {
      expect(listener.port).toBe(preferredPort);
    } finally {
      listener.close();
    }
  });
});
