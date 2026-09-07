/**
 * Unit tests for the per-request credential-resolution interceptor added to
 * generateAmApi()/generateIdmApi()/generateEnvApi().
 *
 * Run with:
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent BaseApi.credentialInterceptor
 *
 * Regression coverage for the token-cache staleness race (see the memory
 * note `frodo-token-cache-staleness-race.md`): credentials used to be baked
 * into the axios instance's headers once, synchronously, at construction
 * time — these cells prove credentials are instead resolved at actual send
 * time, that a stale cached token triggers (and awaits) an on-demand
 * refresh via `state.getTokenRefreshHandler()`, that concurrent stale
 * requests de-duplicate into a single refresh, that a stale token with no
 * refresh path throws a clear error instead of being sent, and that cloud
 * browser-login's per-call RFC 8693 exchange (`state.getAmCredentialProvider()`)
 * takes over entirely for AM-domain calls.
 *
 * Uses a custom axios adapter (no real network, no Polly) that captures the
 * fully-resolved request config — i.e. after every interceptor has run —
 * and returns a canned response.
 */
import type { AxiosRequestConfig } from 'axios';

import { generateAmApi, generateEnvApi, generateIdmApi } from './BaseApi';
import StateImpl from '../shared/State';

function capturingAdapter(capture: { config?: AxiosRequestConfig }): any {
  return async (config: AxiosRequestConfig) => {
    capture.config = config;
    return {
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
}

function headerValue(config: AxiosRequestConfig, name: string): unknown {
  const headers = config.headers as any;
  return typeof headers?.get === 'function' ? headers.get(name) : headers[name];
}

describe('BaseApi credential interceptor — generateAmApi (session cookie)', () => {
  test('1: Resolves the session cookie at send time', async () => {
    const state = StateImpl({});
    state.setCookieName('iPlanetDirectoryPro');
    state.setUserSessionTokenMeta({
      tokenId: 'fresh-session',
      realm: '/',
      successUrl: '/',
      expires: Date.now() + 60 * 60 * 1000,
    });
    const capture: { config?: AxiosRequestConfig } = {};
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: { adapter: capturingAdapter(capture) },
    });

    await request.get('/whatever');

    expect(headerValue(capture.config, 'Cookie')).toBe(
      'iPlanetDirectoryPro=fresh-session'
    );
  });

  test('2: A stale session with a refresh handler is refreshed before the request is sent', async () => {
    const state = StateImpl({});
    state.setCookieName('iPlanetDirectoryPro');
    state.setUserSessionTokenMeta({
      tokenId: 'stale-session',
      realm: '/',
      successUrl: '/',
      expires: Date.now() - 1000,
    });
    let refreshCalls = 0;
    state.setTokenRefreshHandler(async () => {
      refreshCalls++;
      state.setUserSessionTokenMeta({
        tokenId: 'refreshed-session',
        realm: '/',
        successUrl: '/',
        expires: Date.now() + 60 * 60 * 1000,
      });
    });
    const capture: { config?: AxiosRequestConfig } = {};
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: { adapter: capturingAdapter(capture) },
    });

    await request.get('/whatever');

    expect(refreshCalls).toBe(1);
    expect(headerValue(capture.config, 'Cookie')).toBe(
      'iPlanetDirectoryPro=refreshed-session'
    );
  });

  test('3: A stale session with no refresh handler throws instead of sending the request', async () => {
    const state = StateImpl({});
    state.setCookieName('iPlanetDirectoryPro');
    state.setUserSessionTokenMeta({
      tokenId: 'stale-session',
      realm: '/',
      successUrl: '/',
      expires: Date.now() - 1000,
    });
    const capture: { config?: AxiosRequestConfig } = {};
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: { adapter: capturingAdapter(capture) },
    });

    await expect(request.get('/whatever')).rejects.toThrow(/expired/);
    expect(capture.config).toBeUndefined();
  });

  test('4: Concurrent requests against a stale session de-duplicate into a single refresh', async () => {
    const state = StateImpl({});
    state.setCookieName('iPlanetDirectoryPro');
    state.setUserSessionTokenMeta({
      tokenId: 'stale-session',
      realm: '/',
      successUrl: '/',
      expires: Date.now() - 1000,
    });
    let refreshCalls = 0;
    state.setTokenRefreshHandler(async () => {
      refreshCalls++;
      await new Promise((r) => setTimeout(r, 20));
      state.setUserSessionTokenMeta({
        tokenId: 'refreshed-session',
        realm: '/',
        successUrl: '/',
        expires: Date.now() + 60 * 60 * 1000,
      });
    });
    const captureA: { config?: AxiosRequestConfig } = {};
    const captureB: { config?: AxiosRequestConfig } = {};
    const requestA = generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: { adapter: capturingAdapter(captureA) },
    });
    const requestB = generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: { adapter: capturingAdapter(captureB) },
    });

    await Promise.all([requestA.get('/a'), requestB.get('/b')]);

    expect(refreshCalls).toBe(1);
    expect(headerValue(captureA.config, 'Cookie')).toBe(
      'iPlanetDirectoryPro=refreshed-session'
    );
    expect(headerValue(captureB.config, 'Cookie')).toBe(
      'iPlanetDirectoryPro=refreshed-session'
    );
  });

  test('5: An explicit authentication header override always wins over the derived cookie', async () => {
    const state = StateImpl({});
    state.setCookieName('iPlanetDirectoryPro');
    state.setUserSessionTokenMeta({
      tokenId: 'fresh-session',
      realm: '/',
      successUrl: '/',
      expires: Date.now() + 60 * 60 * 1000,
    });
    state.setAuthenticationHeaderOverrides({ Authorization: 'Bearer custom' });
    const capture: { config?: AxiosRequestConfig } = {};
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: { adapter: capturingAdapter(capture) },
    });

    await request.get('/whatever');

    expect(headerValue(capture.config, 'Authorization')).toBe('Bearer custom');
    expect(headerValue(capture.config, 'Cookie')).toBeFalsy();
  });
});

describe('BaseApi credential interceptor — generateAmApi (bearer / browser mode)', () => {
  test('6: Resolves the bearer token at send time when instructed to use it for AM APIs', async () => {
    const state = StateImpl({});
    state.setUseBearerTokenForAmApis(true);
    state.setBearerTokenMeta({
      access_token: 'fresh-bearer',
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    const capture: { config?: AxiosRequestConfig } = {};
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: { adapter: capturingAdapter(capture) },
    });

    await request.get('/whatever');

    expect(headerValue(capture.config, 'Authorization')).toBe(
      'Bearer fresh-bearer'
    );
  });

  test('7: A browser-mode credential provider overrides the normal cookie/bearer resolution entirely', async () => {
    const state = StateImpl({});
    // Even though a stale session is cached, the provider (set by cloud
    // browser-login mode) takes over completely — no staleness check, no
    // refresh handler involved, matching the mint-and-discard RFC 8693
    // exchange design (see BrowserAuthenticateOps.ts's exchangeTokenForScope).
    state.setUserSessionTokenMeta({
      tokenId: 'stale-session',
      realm: '/',
      successUrl: '/',
      expires: Date.now() - 1000,
    });
    let seenScopes: string[] | undefined;
    state.setAmCredentialProvider(async (requiredScopes) => {
      seenScopes = requiredScopes;
      return { header: 'Authorization', value: 'Bearer exchanged-token' };
    });
    const capture: { config?: AxiosRequestConfig } = {};
    const request = generateAmApi({
      resource: {},
      state,
      requiredScopes: ['fr:am:*'],
      requestOverride: { adapter: capturingAdapter(capture) },
    });

    await request.get('/whatever');

    expect(headerValue(capture.config, 'Authorization')).toBe(
      'Bearer exchanged-token'
    );
    expect(seenScopes).toEqual(['fr:am:*']);
  });
});

describe('BaseApi credential interceptor — generateIdmApi / generateEnvApi (bearer only)', () => {
  test('8: generateIdmApi resolves the bearer token at send time', async () => {
    const state = StateImpl({});
    state.setBearerTokenMeta({
      access_token: 'fresh-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    const capture: { config?: AxiosRequestConfig } = {};
    const request = generateIdmApi({
      state,
      requiredScopes: [],
      requestOverride: { adapter: capturingAdapter(capture) },
    });

    await request.get('/whatever');

    expect(headerValue(capture.config, 'Authorization')).toBe(
      'Bearer fresh-bearer'
    );
  });

  test('9: generateEnvApi refreshes a stale bearer token before sending', async () => {
    const state = StateImpl({});
    state.setBearerTokenMeta({
      access_token: 'stale-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 3600,
      expires: Date.now() - 1000,
    } as any);
    let refreshCalls = 0;
    state.setTokenRefreshHandler(async () => {
      refreshCalls++;
      state.setBearerTokenMeta({
        access_token: 'refreshed-bearer',
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 3600,
        expires: Date.now() + 60 * 60 * 1000,
      } as any);
    });
    const capture: { config?: AxiosRequestConfig } = {};
    const request = generateEnvApi({
      resource: {},
      state,
      requiredScopes: [],
      requestOverride: { adapter: capturingAdapter(capture) },
    });

    await request.get('/whatever');

    expect(refreshCalls).toBe(1);
    expect(headerValue(capture.config, 'Authorization')).toBe(
      'Bearer refreshed-bearer'
    );
  });
});
