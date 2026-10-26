/**
 * Run tests
 *
 *        npm run test:only BrowserAuthenticateOps.loopback
 */
import http from 'http';
import {
  generateStateNonce,
  startLoopbackRedirectListener,
} from './BrowserAuthenticateOps';

/**
 * Send a request with full control over method and headers (`fetch` treats
 * `Referer` and `Origin` as managed by the runtime).
 */
function send(
  url: string,
  {
    method = 'GET',
    headers = {},
  }: { method?: string; headers?: http.OutgoingHttpHeaders } = {}
): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode ?? 0));
    });
    req.on('error', reject);
    req.end();
  });
}

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

  test('3: Answers a callback with the wrong state with 400, never surfaces its code, and keeps waiting for the real redirect', async () => {
    const expectedState = generateStateNonce();
    const listener = await startLoopbackRedirectListener({ expectedState });
    const callbackPromise = listener.waitForCallback();

    const stale = await fetch(
      `${listener.redirectUri}?code=stale&state=someone-elses-state`
    );
    expect(stale.status).toBe(400);

    const genuine = await fetch(
      `${listener.redirectUri}?code=abc123&state=${expectedState}`
    );
    expect(genuine.status).toBe(200);

    const result = await callbackPromise;
    expect(result.code).toBe('abc123');
    expect(result.error).toBeUndefined();
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

  // The redirect to the loopback URL comes from the login page, so a browser
  // sends the tenant (or an external identity provider) as Referer. A login
  // with no session in the browser failed with state_mismatch because of it.
  test.each([
    ['the tenant as Referer', { Referer: 'https://tenant.example.com/' }],
    [
      'another identity provider as Referer',
      { Referer: 'https://idp.example.org/login?x=1' },
    ],
    ['an opaque Origin', { Origin: 'null' }],
  ])(
    '8: Accepts a callback with the right state that carries %s',
    async (_name, headers) => {
      const expectedState = generateStateNonce();
      const listener = await startLoopbackRedirectListener({ expectedState });
      const callbackPromise = listener.waitForCallback();

      const status = await send(
        `${listener.redirectUri}?code=abc123&state=${expectedState}`,
        { headers }
      );
      expect(status).toBe(200);

      const result = await callbackPromise;
      expect(result.code).toBe('abc123');
      expect(result.error).toBeUndefined();
    }
  );

  test('9: Answers a non-GET request with 405 and keeps waiting for the real redirect', async () => {
    const expectedState = generateStateNonce();
    const listener = await startLoopbackRedirectListener({ expectedState });
    const callbackPromise = listener.waitForCallback();
    const url = `${listener.redirectUri}?code=forged&state=${expectedState}`;

    expect(await send(url, { method: 'POST' })).toBe(405);

    expect(
      await send(`${listener.redirectUri}?code=abc123&state=${expectedState}`)
    ).toBe(200);
    const result = await callbackPromise;
    expect(result.code).toBe('abc123');
  });

  test('10: Answers a request without a state with 400 and keeps waiting for the real redirect', async () => {
    const expectedState = generateStateNonce();
    const listener = await startLoopbackRedirectListener({ expectedState });
    const callbackPromise = listener.waitForCallback();

    expect(await send(listener.redirectUri)).toBe(400);

    expect(
      await send(`${listener.redirectUri}?code=abc123&state=${expectedState}`)
    ).toBe(200);
    const result = await callbackPromise;
    expect(result.code).toBe('abc123');
  });

  test('11: The timeout error lists the requests that were ignored', async () => {
    const listener = await startLoopbackRedirectListener({
      expectedState: generateStateNonce(),
    });
    const timedOut = expect(listener.waitForCallback(300)).rejects.toThrow(
      /Timed out.*state_mismatch \(2\), method_not_allowed \(1\)/
    );

    await send(`${listener.redirectUri}?code=a&state=wrong`);
    await send(`${listener.redirectUri}?code=b&state=wrong`);
    await send(listener.redirectUri, { method: 'POST' });

    await timedOut;
  });

  test('12: The timeout error does not mention ignored requests when there were none', async () => {
    const listener = await startLoopbackRedirectListener({
      expectedState: generateStateNonce(),
    });
    await expect(listener.waitForCallback(50)).rejects.toThrow(
      /^.*Timed out after 0s waiting for the browser login to complete\.$/
    );
  });
});
