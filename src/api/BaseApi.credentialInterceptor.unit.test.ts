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
import Constants from '../shared/Constants';

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

/**
 * Mimics axios's own non-2xx handling: a 403 is a *rejected* promise, with
 * an AxiosError-shaped object carrying `.response`/`.config` — not a
 * resolved response with a 403 status (that's what a raw adapter callback
 * would see on the wire, but axios's own response-validation layer, which
 * a custom adapter sits underneath, is what turns it into a rejection by
 * the time an interceptor sees it). Calls the given `respond` function on
 * every attempt so a test can vary the response per call (e.g. 403 first,
 * 200 once escalated).
 */
function scriptedAdapter(
  respond: (
    config: AxiosRequestConfig,
    attempt: number
  ) => { status: number; data?: any }
): any {
  let attempt = 0;
  return async (config: AxiosRequestConfig) => {
    attempt++;
    const { status, data } = respond(config, attempt);
    const response = {
      data: data ?? {},
      status,
      statusText: status === 200 ? 'OK' : 'Forbidden',
      headers: {},
      config,
    };
    if (status >= 200 && status < 300) {
      return response;
    }
    const error: any = new Error(`Request failed with status code ${status}`);
    error.name = 'AxiosError';
    error.isAxiosError = true;
    error.config = config;
    error.response = response;
    throw error;
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

describe('BaseApi credential interceptor — item 1+21 privilege escalation', () => {
  test('10: an insufficient-scope credential escalates via state.getPrivilegeEscalationHandler() and retries with the upgraded credential', async () => {
    const state = StateImpl({});
    state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);
    state.setBearerTokenMeta({
      access_token: 'limited-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:read',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      state.setBearerTokenMeta({
        access_token: 'escalated-bearer',
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 3600,
        expires: Date.now() + 60 * 60 * 1000,
      } as any);
      return true;
    });
    const capture: { config?: AxiosRequestConfig } = {};
    const request = generateIdmApi({
      state,
      requiredScopes: ['fr:idm:write'],
      requestOverride: { adapter: capturingAdapter(capture) },
    });

    await request.get('/whatever');

    expect(escalationCalls).toBe(1);
    expect(headerValue(capture.config, 'Authorization')).toBe(
      'Bearer escalated-bearer'
    );
  });

  test('11: no privilege escalation handler installed — the original InsufficientScopeError surfaces unchanged', async () => {
    const state = StateImpl({});
    state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);
    state.setBearerTokenMeta({
      access_token: 'limited-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:read',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    const capture: { config?: AxiosRequestConfig } = {};
    const request = generateIdmApi({
      state,
      requiredScopes: ['fr:idm:write'],
      requestOverride: { adapter: capturingAdapter(capture) },
    });

    await expect(request.get('/whatever')).rejects.toThrow(
      /requires scope.*fr:idm:write/
    );
    expect(capture.config).toBeUndefined();
  });

  test('12: the handler returning false (nothing left to escalate to) surfaces the original InsufficientScopeError', async () => {
    const state = StateImpl({});
    state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);
    state.setBearerTokenMeta({
      access_token: 'limited-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:read',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      return false;
    });
    const request = generateIdmApi({
      state,
      requiredScopes: ['fr:idm:write'],
      requestOverride: { adapter: capturingAdapter({}) },
    });

    await expect(request.get('/whatever')).rejects.toThrow(
      /requires scope.*fr:idm:write/
    );
    expect(escalationCalls).toBe(1);
  });

  test('13: escalation keeps retrying across multiple insufficient tiers until one is finally sufficient', async () => {
    const state = StateImpl({});
    state.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);
    state.setBearerTokenMeta({
      access_token: 'tier-0-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:read',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      if (escalationCalls === 1) {
        // First escalation: still not enough.
        state.setBearerTokenMeta({
          access_token: 'tier-1-bearer',
          token_type: 'Bearer',
          scope: 'fr:idm:read fr:idm:list',
          expires_in: 3600,
          expires: Date.now() + 60 * 60 * 1000,
        } as any);
        return true;
      }
      // Second escalation: finally sufficient.
      state.setBearerTokenMeta({
        access_token: 'tier-2-bearer',
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 3600,
        expires: Date.now() + 60 * 60 * 1000,
      } as any);
      return true;
    });
    const capture: { config?: AxiosRequestConfig } = {};
    const request = generateIdmApi({
      state,
      requiredScopes: ['fr:idm:write'],
      requestOverride: { adapter: capturingAdapter(capture) },
    });

    await request.get('/whatever');

    expect(escalationCalls).toBe(2);
    expect(headerValue(capture.config, 'Authorization')).toBe(
      'Bearer tier-2-bearer'
    );
  });

  test('14: an unrelated failure (not InsufficientScopeError) is never escalation-eligible and propagates immediately', async () => {
    const state = StateImpl({});
    state.setCookieName('iPlanetDirectoryPro');
    state.setUserSessionTokenMeta({
      tokenId: 'stale-session',
      realm: '/',
      successUrl: '/',
      expires: Date.now() - 1000,
    });
    // A stale session with no refresh handler throws a plain FrodoError
    // (see test 3 above) — confirm that error is never mistaken for an
    // escalation-eligible InsufficientScopeError.
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      return true;
    });
    const request = generateAmApi({
      resource: {},
      requiredScopes: [],
      state,
      requestOverride: { adapter: capturingAdapter({}) },
    });

    await expect(request.get('/whatever')).rejects.toThrow(/expired/);
    expect(escalationCalls).toBe(0);
  });
});

describe('BaseApi credential interceptor — item 1+21 privilege escalation on a live 403', () => {
  test('15: a GET that 403s escalates and retries with the newly-escalated credential', async () => {
    const state = StateImpl({});
    state.setActiveCredentialSource('browser');
    state.setBearerTokenMeta({
      access_token: 'limited-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:read',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      state.setBearerTokenMeta({
        access_token: 'escalated-bearer',
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 3600,
        expires: Date.now() + 60 * 60 * 1000,
      } as any);
      return true;
    });
    const seenAuthHeaders: unknown[] = [];
    const adapter = scriptedAdapter((config, attempt) => {
      seenAuthHeaders.push(headerValue(config, 'Authorization'));
      return attempt === 1 ? { status: 403 } : { status: 200 };
    });
    const request = generateIdmApi({
      state,
      requiredScopes: [],
      requestOverride: { adapter },
    });

    const response = await request.get('/whatever');

    expect(response.status).toBe(200);
    expect(escalationCalls).toBe(1);
    expect(seenAuthHeaders).toEqual([
      'Bearer limited-bearer',
      'Bearer escalated-bearer',
    ]);
  });

  test('16: a write (POST) that 403s never triggers escalation, even with a handler installed — the original 403 propagates unchanged', async () => {
    const state = StateImpl({});
    state.setBearerTokenMeta({
      access_token: 'limited-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:read',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      return true;
    });
    const adapter = scriptedAdapter(() => ({ status: 403 }));
    const request = generateIdmApi({
      state,
      requiredScopes: [],
      requestOverride: { adapter },
    });

    await expect(request.post('/whatever', {})).rejects.toThrow(/403/);
    expect(escalationCalls).toBe(0);
  });

  test('17: a GET 403 with no escalation handler installed propagates the original 403 unchanged', async () => {
    const state = StateImpl({});
    state.setBearerTokenMeta({
      access_token: 'limited-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:read',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    const adapter = scriptedAdapter(() => ({ status: 403 }));
    const request = generateIdmApi({
      state,
      requiredScopes: [],
      requestOverride: { adapter },
    });

    await expect(request.get('/whatever')).rejects.toThrow(/403/);
  });

  test('18: a GET 403 where the escalation handler has nothing left to try propagates the original 403 unchanged', async () => {
    const state = StateImpl({});
    state.setActiveCredentialSource('browser');
    state.setBearerTokenMeta({
      access_token: 'limited-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:read',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      return false;
    });
    const adapter = scriptedAdapter(() => ({ status: 403 }));
    const request = generateIdmApi({
      state,
      requiredScopes: [],
      requestOverride: { adapter },
    });

    await expect(request.get('/whatever')).rejects.toThrow(/403/);
    expect(escalationCalls).toBe(1);
  });

  test('19: a non-403 error (e.g. 500) is never escalation-eligible', async () => {
    const state = StateImpl({});
    state.setBearerTokenMeta({
      access_token: 'limited-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:read',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      return true;
    });
    const adapter = scriptedAdapter(() => ({ status: 500 }));
    const request = generateIdmApi({
      state,
      requiredScopes: [],
      requestOverride: { adapter },
    });

    await expect(request.get('/whatever')).rejects.toThrow(/500/);
    expect(escalationCalls).toBe(0);
  });

  test('20: a GET 403 for a legacy service unavailable on this deployment type never triggers escalation, regardless of product-name wording — a real regression caught via CI', async () => {
    const state = StateImpl({});
    // A browser-login session, so this exercises the message-based
    // exclusion specifically, not the (also-true) starting-tier gate below.
    state.setActiveCredentialSource('browser');
    state.setUseBearerTokenForAmApis(true);
    state.setBearerTokenMeta({
      access_token: 'sufficiently-privileged-bearer',
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      return true;
    });
    const adapter = scriptedAdapter(() => ({
      status: 403,
      data: {
        message: 'This operation is not available in ForgeRock Identity Cloud.',
      },
    }));
    const request = generateAmApi({
      resource: {},
      state,
      requiredScopes: [],
      requestOverride: { adapter },
    });

    await expect(request.get('/whatever')).rejects.toThrow(/403/);
    expect(escalationCalls).toBe(0);
  });

  test('21: the same exclusion matches the current "PingOne Advanced Identity Cloud" wording too', async () => {
    const state = StateImpl({});
    state.setActiveCredentialSource('browser');
    state.setUseBearerTokenForAmApis(true);
    state.setBearerTokenMeta({
      access_token: 'sufficiently-privileged-bearer',
      token_type: 'Bearer',
      scope: 'fr:am:*',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      return true;
    });
    const adapter = scriptedAdapter(() => ({
      status: 403,
      data: {
        message:
          'This operation is not available in PingOne Advanced Identity Cloud.',
      },
    }));
    const request = generateAmApi({
      resource: {},
      state,
      requiredScopes: [],
      requestOverride: { adapter },
    });

    await expect(request.get('/whatever')).rejects.toThrow(/403/);
    expect(escalationCalls).toBe(0);
  });

  test('22: an ordinary 403 with unrelated message text still escalates as before, for a browser-started session — the exclusion is narrow', async () => {
    const state = StateImpl({});
    state.setActiveCredentialSource('browser');
    state.setBearerTokenMeta({
      access_token: 'limited-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:read',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      state.setBearerTokenMeta({
        access_token: 'escalated-bearer',
        token_type: 'Bearer',
        scope: 'fr:idm:*',
        expires_in: 3600,
        expires: Date.now() + 60 * 60 * 1000,
      } as any);
      return true;
    });
    const adapter = scriptedAdapter((_config, attempt) => {
      return attempt === 1
        ? { status: 403, data: { message: 'Not authorized.' } }
        : { status: 200 };
    });
    const request = generateIdmApi({
      state,
      requiredScopes: [],
      requestOverride: { adapter },
    });

    const response = await request.get('/whatever');

    expect(response.status).toBe(200);
    expect(escalationCalls).toBe(1);
  });

  test('23: a GET 403 on a non-browser-started session (service account) never triggers escalation, even for an ordinary/unmatched 403 message — the real regression caught via CI (idm export hitting a routine, already-tolerated per-entity "Access denied" 403)', async () => {
    const state = StateImpl({});
    state.setActiveCredentialSource('svcacct');
    state.setBearerTokenMeta({
      access_token: 'sufficiently-privileged-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      return true;
    });
    const adapter = scriptedAdapter(() => ({
      status: 403,
      data: { message: 'Access denied' },
    }));
    const request = generateIdmApi({
      state,
      requiredScopes: [],
      requestOverride: { adapter },
    });

    await expect(request.get('/whatever')).rejects.toThrow(/403/);
    expect(escalationCalls).toBe(0);
  });

  test('24: a GET 403 with no active credential source recorded at all never triggers escalation (fails closed, same as any other non-browser source)', async () => {
    const state = StateImpl({});
    state.setBearerTokenMeta({
      access_token: 'sufficiently-privileged-bearer',
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 3600,
      expires: Date.now() + 60 * 60 * 1000,
    } as any);
    let escalationCalls = 0;
    state.setPrivilegeEscalationHandler(async () => {
      escalationCalls++;
      return true;
    });
    const adapter = scriptedAdapter(() => ({ status: 403 }));
    const request = generateIdmApi({
      state,
      requiredScopes: [],
      requestOverride: { adapter },
    });

    await expect(request.get('/whatever')).rejects.toThrow(/403/);
    expect(escalationCalls).toBe(0);
  });
});
