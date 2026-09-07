import { randomUUID } from 'crypto';

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosProxyConfig,
  AxiosRequestConfig,
} from 'axios';
import axiosRetry from 'axios-retry';
import { ProxyAgent, ProxyAgentOptions } from 'proxy-agent';

import _curlirize from '../ext/axios-curlirize/curlirize';
import { FrodoError } from '../ops/FrodoError';
import { assertHasRequiredScope } from '../ops/RequiredScopesOps';
import Constants from '../shared/Constants';
import StateImpl, { AmCredentialOverride, State } from '../shared/State';
import { getUserAgent } from '../shared/Version';
import { curlirizeMessage, printMessage } from '../utils/Console';
import { mergeDeep } from '../utils/JsonUtils';
import { setupPollyForFrodoLib } from '../utils/SetupPollyForFrodoLib';

export type ResourceConfig = { apiVersion?: string };

export type RetryNothingStrategy = 'nothing';
export type RetryNetworkStrategy = 'network';
export type RetryEverythingStrategy = 'everything';
export type RetryStrategy =
  | RetryNothingStrategy
  | RetryNetworkStrategy
  | RetryEverythingStrategy;

if (process.env.FRODO_MOCK) {
  setupPollyForFrodoLib({ state: StateImpl({}) });
}

// all agents
const timeout = 30000;

// agentkeepalive
// Reuse outbound TCP/TLS connections between axios calls. Free (idle) sockets
// are kept open up to maxFreeSockets; set FRODO_NO_KEEPALIVE=1 to restore the
// old behavior (a fresh TCP+TLS handshake per request) for exotic environments
// or proxies that don't tolerate connection reuse. Note: on current Node
// versions (verified on v24), free keep-alive sockets do NOT keep a short-lived
// process (e.g. one-shot CLI commands) alive — the event loop drains and the
// process exits promptly.
const noKeepAlive = ['1', 'true', 'yes'].includes(
  (process.env.FRODO_NO_KEEPALIVE || '').toLowerCase()
);
const keepAlive = !noKeepAlive;
const maxSockets = 500;
const maxFreeSockets = 16;
const keepAliveMsecs = 1000;
const scheduling: 'fifo' | 'lifo' = 'lifo';

const userAgent = getUserAgent();
const transactionId = `frodo-${randomUUID()}`;
let httpAgent, httpsAgent, httpsInsecureAgent;

function getHttpAgent(): ProxyAgent {
  if (httpAgent) return httpAgent;
  httpAgent = new ProxyAgent({
    maxSockets,
    maxFreeSockets,
    timeout,
    keepAlive,
    keepAliveMsecs,
    scheduling,
  });
  return httpAgent;
}

/**
 * Helper method to create properly configured httpsAgent
 * @returns {Agent.HttpsAgent} appropriate httpsAgent
 */
function getHttpsAgent(
  allowInsecureConnection: boolean,
  shareAgent: boolean = true
): ProxyAgent {
  if (allowInsecureConnection) {
    if (httpsInsecureAgent && shareAgent) return httpsInsecureAgent;
  } else {
    if (httpsAgent && shareAgent) return httpsAgent;
  }
  const options: ProxyAgentOptions = {
    rejectUnauthorized: !allowInsecureConnection,
  };
  const agent = new ProxyAgent({
    ...options,
    maxSockets,
    maxFreeSockets,
    timeout,
    keepAlive,
    keepAliveMsecs,
    scheduling,
  });
  if (allowInsecureConnection) {
    // Also inject rejectUnauthorized:false into the per-connection options that
    // agent-base passes through addRequest. This is required when routing via a
    // proxy (HTTPS_PROXY): https-proxy-agent creates the TLS tunnel to the
    // target using tls.connect({...opts, socket}) where opts are the
    // per-request connection options — NOT the agent constructor options.
    // Without this, the target TLS still enforces certificate validation even
    // when rejectUnauthorized:false is set on the ProxyAgent constructor.
    const agentAny = agent as any;
    const origAddRequest = agentAny.addRequest.bind(agentAny);
    agentAny.addRequest = (req: any, opts: any) =>
      origAddRequest(req, { ...opts, rejectUnauthorized: false });
  }
  if (shareAgent) {
    if (allowInsecureConnection) httpsInsecureAgent = agent;
    else httpsAgent = agent;
  }
  return agent;
}

/**
 * Get Proxy config
 * @returns {AxiosProxyConfig | false} axios proxy config or false
 */
function getProxy(): AxiosProxyConfig | false {
  return false;
}

/**
 * Creates an Axios instance and if retry config is set either on the global state or the request config, then
 * interceptors are applied.
 *
 * Request config takes precedence over any global config. Config is applied in its entirety and not merged.
 * @param {State} state State object
 * @param {AxiosRequestConfig} requestConfig Axios request object
 */
function createAxiosInstance(
  state: State,
  requestConfig: AxiosRequestConfig
): AxiosInstance {
  const axiosInstance = axios.create(requestConfig);

  const globalRetryConfig = state.getAxiosRetryConfig();
  const requestRetryConfig = requestConfig['axios-retry'];
  if (!!globalRetryConfig || !!requestRetryConfig) {
    axiosRetry(axiosInstance, requestRetryConfig ?? globalRetryConfig);
  }

  return axiosInstance;
}

function isStale(meta?: { expires?: number }): boolean {
  if (!meta || typeof meta.expires !== 'number') return false;
  return meta.expires - Date.now() <= Constants.TOKEN_FRESHNESS_BUFFER_MS;
}

/**
 * Throws the "can't silently refresh" error a stale credential with no
 * refresh path hits. For browser-login sessions specifically, also flags
 * `state.getNeedsReauthentication()` so a caller (frodo-cli, the MCP server)
 * can proactively detect "this session needs a fresh interactive login"
 * without having to parse the thrown error — there is no unattended way to
 * redo a real browser round trip, unlike every other auth mode's silent
 * background re-login.
 */
function throwCannotSilentlyRefresh(
  state: State,
  credentialLabel: string
): never {
  if (state.getAuthMode() === 'interactive') {
    state.setNeedsReauthentication(true);
  }
  throw new FrodoError(
    `Cached ${credentialLabel} has expired and cannot be silently refreshed (auto-refresh is off, or this session's auth mode has no unattended refresh path). Re-authenticate to continue.`
  );
}

/**
 * Resolves the credential header to send with an AM-domain request, at
 * actual send time rather than at axios-instance construction time.
 *
 * @remarks
 * This is what closes the token-cache staleness race: previously,
 * `generateAmApi()` read `state`'s cookie/bearer token once, synchronously,
 * when the axios instance was constructed, with no re-check between then
 * and the request actually going out — fine for one isolated call, but a
 * real gap across the many sequential/parallel calls a single long-running
 * command (or a shell script's several separate `frodo` invocations) can
 * make, since nothing re-validated freshness for calls later in that
 * sequence. Every AM-domain call now re-resolves its own credential here,
 * immediately before it's sent.
 *
 * Browser-login mode (`state.getAmCredentialProvider()`) is handled
 * separately from every other auth mode: cloud browser-mode mints a fresh,
 * short-lived RFC 8693-exchanged token per call rather than reusing a
 * cached one, so it neither participates in nor needs the staleness check
 * below.
 */
async function resolveAmRequestCredential(
  state: State,
  requiredScopes: string[]
): Promise<AmCredentialOverride | null> {
  // Browser-login mode short-circuits everything below: it mints a fresh,
  // short-lived RFC 8693-exchanged token per call rather than reusing a
  // cached one, so there is no cached-meta staleness to check and nothing
  // to refresh — the provider itself performs the exchange (gated by
  // `resolveAvailableScope()` against the exchange client's allow-list) and
  // hands back the header to use.
  const provider = state.getAmCredentialProvider();
  if (provider) {
    return provider(requiredScopes);
  }

  // Every other auth mode reuses one cached credential for the life of the
  // session: a session cookie by default, or a bearer token when the
  // session was told to use bearer tokens for AM APIs (e.g. a cloud/forgeops
  // service account). Which one applies decides which cached metadata
  // (and later, which header) is relevant for the rest of this function.
  const useBearer = state.getUseBearerTokenForAmApis();
  const meta = useBearer
    ? state.getBearerTokenMeta()
    : state.getUserSessionTokenMeta();

  // This is the actual fix for the staleness race: re-check freshness here,
  // immediately before the request goes out, instead of trusting whatever
  // was true whenever the token was last read from cache. A stale token
  // triggers an on-demand refresh (de-duplicated centrally by
  // `state.setTokenRefreshHandler`, so a burst of concurrent stale requests
  // only causes one real refresh) when a refresh path exists. When it
  // doesn't — auto-refresh disabled, or an auth mode with no unattended
  // refresh path — surface a clear error now rather than sending a request
  // that's doomed to fail with a bare, confusing 401 from AM.
  if (isStale(meta)) {
    const refresh = state.getTokenRefreshHandler();
    if (refresh) {
      await refresh();
    } else {
      throwCannotSilentlyRefresh(
        state,
        useBearer ? 'bearer token' : 'session token'
      );
    }
  }

  // Read the (possibly just-refreshed) credential fresh from state — never
  // from `meta` above, which may now be stale data from before the refresh
  // — and shape it into the header this request should actually carry. A
  // plain admin session cookie carries no OAuth2 scope concept at all, so
  // the scope gate only ever applies on the bearer-token branch.
  if (useBearer) {
    assertHasRequiredScope({
      requiredScopes,
      grantedScope: state.getBearerTokenMeta()?.scope,
      state,
    });
    const token = state.getBearerToken();
    return token ? { header: 'Authorization', value: `Bearer ${token}` } : null;
  }
  const cookieName = state.getCookieName();
  const cookieValue = state.getCookieValue();
  return cookieName && cookieValue
    ? { header: 'Cookie', value: `${cookieName}=${cookieValue}` }
    : null;
}

/**
 * Resolves the `Authorization: Bearer` header for an IDM/environment/
 * governance-domain request, at actual send time — see
 * `resolveAmRequestCredential`'s remarks for why this matters. These domains
 * never need browser-mode's per-call token exchange (they're genuine OAuth2
 * resource servers that accept browser login's primary token directly), so
 * this only ever does the staleness check and the scope gate, never a
 * credential-provider override.
 */
async function resolveBearerRequestCredential(
  state: State,
  requiredScopes: string[]
): Promise<AmCredentialOverride | null> {
  const meta = state.getBearerTokenMeta();

  if (isStale(meta)) {
    const refresh = state.getTokenRefreshHandler();
    if (refresh) {
      await refresh();
    } else {
      throwCannotSilentlyRefresh(state, 'bearer token');
    }
  }

  assertHasRequiredScope({
    requiredScopes,
    grantedScope: state.getBearerTokenMeta()?.scope,
    state,
  });
  const token = state.getBearerToken();
  return token ? { header: 'Authorization', value: `Bearer ${token}` } : null;
}

/**
 * Resolves the `Authorization: Bearer` header for a PingFederate-domain
 * (WS-Fed admin) request, at actual send time. Same shape as
 * `resolveBearerRequestCredential`, but keyed to the separate PingFederate
 * bearer token (`state.getPfBearerToken()`), not the main one.
 */
async function resolvePfBearerRequestCredential(
  state: State,
  requiredScopes: string[]
): Promise<AmCredentialOverride | null> {
  const meta = state.getPfBearerTokenMeta();

  if (isStale(meta)) {
    const refresh = state.getTokenRefreshHandler();
    if (refresh) {
      await refresh();
    } else {
      throwCannotSilentlyRefresh(state, 'PingFederate bearer token');
    }
  }

  assertHasRequiredScope({
    requiredScopes,
    grantedScope: state.getPfBearerTokenMeta()?.scope,
    state,
  });
  const token = state.getPfBearerToken();
  return token ? { header: 'Authorization', value: `Bearer ${token}` } : null;
}

/**
 * Attaches a request interceptor that injects the resolved credential
 * header immediately before each request is sent. Never overwrites a
 * same-named header the caller (or `state.getAuthenticationHeaderOverrides()`,
 * already merged into the instance's static headers at construction time)
 * set explicitly — an explicit override always wins over the derived token,
 * exactly as it did before this credential resolution moved to send time.
 */
function attachCredentialInterceptor(
  axiosInstance: AxiosInstance,
  resolve: () => Promise<AmCredentialOverride | null>
) {
  axiosInstance.interceptors.request.use(async (config) => {
    if (config.headers.has('Authorization') || config.headers.has('Cookie')) {
      return config;
    }
    const credential = await resolve();
    if (credential) {
      config.headers.set(credential.header, credential.value);
    }
    return config;
  });
}

/**
 * Customize curlirize output
 * @param {object} params Params object
 * @param params.request axios request object
 * @param {State} params.state State object
 */
function curlirize(request, state: State) {
  _curlirize(request, (result, err: Error | AxiosError) => {
    if (err) {
      if (axios.isAxiosError(err)) {
        // Access to config, request, and response
        printMessage({
          message: `${err.response?.status}${
            err.response?.data['reason']
              ? ' ' + err.response?.data['reason']
              : ''
          }${
            err.response?.data['message']
              ? ' - ' + err.response?.data['message']
              : ''
          }${
            err.response?.data['error']
              ? ' - ' + err.response?.data['error']
              : ''
          }${
            err.response?.data['error_description']
              ? ' - ' + err.response?.data['error_description']
              : ''
          }`,
          type: 'error',
          state,
        });
        printMessage({
          message: err.response?.headers ? err.response.headers : '',
          type: 'error',
          state,
        });
      } else {
        // Just a stock error
        printMessage({ message: err, type: 'error', state });
      }
    } else if (result.command) {
      curlirizeMessage({ message: result.command, state });
    } else if (result.response) {
      printMessage({
        message: `${result.response.status} ${result.response.statusText}`,
        type: 'info',
        state,
      });
    }
  });
}

/**
 * Generates an AM Axios API instance specifically for AM configuration endpoints
 * @param {object} params Params object
 * @param {ResourceConfig} params.resource Takes a resource object. example: { apiVersion: 'protocol=2.1,resource=1.0' }
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either
 * add on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {string[]} params.requiredScopes OAuth2 scope(s) this specific endpoint requires, For cloud browser-login
 * mode this drives the per-call RFC 8693 token exchange; for every other auth mode it's checked against
 * the current session's already-granted scope (see `ops/RequiredScopesOps.ts`'s `assertHasRequiredScope`),
 * a no-op outside cloud deployments.
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateAmApi({
  resource,
  requestOverride = {},
  requiredScopes,
  state,
}: {
  resource: ResourceConfig;
  requestOverride?: AxiosRequestConfig;
  requiredScopes: string[];
  state: State;
}): AxiosInstance {
  const headers = {
    'User-Agent': userAgent,
    'X-ForgeRock-TransactionId': transactionId,
    'Content-Type': 'application/json',
    // only add API version if we have it
    ...(resource.apiVersion && { 'Accept-API-Version': resource.apiVersion }),
  };

  const requestConfig = mergeDeep(
    {
      // baseURL: `${storage.session.getTenant()}/json`,
      timeout,
      headers: {
        ...headers,
        ...state.getAuthenticationHeaderOverrides(),
        ...state.getConfigurationHeaderOverrides(),
      },
      ...(process.env.FRODO_MOCK !== 'record' &&
        process.env.FRODO_POLLY_MODE !== 'record' && {
          httpAgent: getHttpAgent(),
          httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
        }),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = createAxiosInstance(state, requestConfig);

  // resolve the actual credential (session cookie, bearer token, or — for
  // cloud browser-login mode — a freshly RFC 8693-exchanged token) right
  // before this request is sent, not once at construction time. See
  // `resolveAmRequestCredential`'s remarks for why this matters.
  attachCredentialInterceptor(request, () =>
    resolveAmRequestCredential(state, requiredScopes)
  );

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates an AM Axios API instance specifically for authentication endpoints
 * @param {object} params Params object
 * @param {ResourceConfig} params.resource Takes a resource object. example: { apiVersion: 'protocol=2.1,resource=1.0' }
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either
 * add on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateAmAuthApi({
  resource,
  requestOverride = {},
  state,
}: {
  resource: ResourceConfig;
  requestOverride?: AxiosRequestConfig;
  state: State;
}): AxiosInstance {
  const headers = {
    'User-Agent': userAgent,
    'X-ForgeRock-TransactionId': transactionId,
    'Content-Type': 'application/json',
    // only add API version if we have it
    ...(resource.apiVersion && { 'Accept-API-Version': resource.apiVersion }),
    // only send session cookie if we know its name and value and we are not instructed to use the bearer token for AM APIs
    ...(!state.getUseBearerTokenForAmApis() &&
      state.getCookieName() &&
      state.getCookieValue() && {
        Cookie: `${state.getCookieName()}=${state.getCookieValue()}`,
      }),
    // only add authorization header if we have a bearer token and are instructed to use it for AM APIs
    ...(state.getUseBearerTokenForAmApis() &&
      state.getBearerToken() && {
        Authorization: `Bearer ${state.getBearerToken()}`,
      }),
  };

  const requestConfig = mergeDeep(
    {
      // baseURL: `${storage.session.getTenant()}/json`,
      timeout,
      headers: {
        ...headers,
        ...state.getAuthenticationHeaderOverrides(),
      },
      ...(process.env.FRODO_MOCK !== 'record' &&
        process.env.FRODO_POLLY_MODE !== 'record' && {
          httpAgent: getHttpAgent(),
          httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
        }),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = createAxiosInstance(state, requestConfig);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates an OAuth2 Axios API instance
 * @param {object} params Params object
 * @param {ResourceConfig} params.resource Resource config object. Example: { apiVersion: 'protocol=2.1,resource=1.0' }
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either
 * add on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateOauth2Api({
  resource,
  requestOverride = {},
  authenticate = true,
  state,
}: {
  resource: ResourceConfig;
  requestOverride?: AxiosRequestConfig;
  authenticate?: boolean;
  state: State;
}): AxiosInstance {
  const headers: { [key: string]: any } = {
    'User-Agent': userAgent,
    'X-ForgeRock-TransactionId': transactionId,
    // only add API version if we have it
    ...(resource.apiVersion && { 'Accept-API-Version': resource.apiVersion }),
    // only send session cookie if we know its name and value and we are not instructed to use the bearer token for AM APIs
    ...(authenticate &&
      !state.getUseBearerTokenForAmApis() &&
      state.getCookieName() &&
      state.getCookieValue() && {
        Cookie: `${state.getCookieName()}=${state.getCookieValue()}`,
      }),
    // only add authorization header if we have a bearer token and are instructed to use it for AM APIs
    ...(authenticate &&
      state.getUseBearerTokenForAmApis() &&
      state.getBearerToken() && {
        Authorization: `Bearer ${state.getBearerToken()}`,
      }),
  };

  const requestConfig = mergeDeep(
    {
      // baseURL: `${storage.session.getTenant()}/json${resource.path}`,
      timeout,
      headers: {
        ...headers,
        ...state.getAuthenticationHeaderOverrides(),
      },
      ...(process.env.FRODO_MOCK !== 'record' &&
        process.env.FRODO_POLLY_MODE !== 'record' && {
          httpAgent: getHttpAgent(),
          httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
        }),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = createAxiosInstance(state, requestConfig);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates an IDM Axios API instance
 * @param {object} params Params object
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {string[]} params.requiredScopes OAuth2 scope(s) this specific endpoint requires.
 * Checked against the current session's already-granted scope (a no-op outside cloud deployments).
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateIdmApi({
  requestOverride = {},
  requiredScopes,
  state,
}: {
  requestOverride?: AxiosRequestConfig;
  requiredScopes: string[];
  state: State;
}): AxiosInstance {
  const requestConfig = mergeDeep(
    {
      // baseURL: getTenantURL(storage.session.getTenant()),
      timeout,
      headers: {
        'User-Agent': userAgent,
        'X-ForgeRock-TransactionId': transactionId,
        'Content-Type': 'application/json',
        ...state.getAuthenticationHeaderOverrides(),
        ...state.getConfigurationHeaderOverrides(),
      },
      ...(process.env.FRODO_MOCK !== 'record' &&
        process.env.FRODO_POLLY_MODE !== 'record' && {
          httpAgent: getHttpAgent(),
          httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
        }),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = createAxiosInstance(state, requestConfig);

  // resolve the bearer token right before this request is sent, not once at
  // construction time — see `resolveAmRequestCredential`'s remarks (applies
  // equally here).
  attachCredentialInterceptor(request, () =>
    resolveBearerRequestCredential(state, requiredScopes)
  );

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates an IDM Axios API instance. Use this instance for IDM API calls that are related to
 * the Identity Cloud Environment. This will ensure that any environment specific configuration
 * is applied and custom configuration header overrides are not applied.
 * @param {object} params Params object
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {string[]} params.requiredScopes OAuth2 scope(s) this specific endpoint requires.
 * Checked against the current session's already-granted scope (a no-op outside cloud deployments).
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateIdmSystemApi({
  requestOverride = {},
  requiredScopes,
  state,
}: {
  requestOverride?: AxiosRequestConfig;
  requiredScopes: string[];
  state: State;
}): AxiosInstance {
  const requestConfig = mergeDeep(
    {
      // baseURL: getTenantURL(storage.session.getTenant()),
      timeout,
      headers: {
        'User-Agent': userAgent,
        'X-ForgeRock-TransactionId': transactionId,
        'Content-Type': 'application/json',
        ...state.getAuthenticationHeaderOverrides(),
      },
      ...(process.env.FRODO_MOCK !== 'record' &&
        process.env.FRODO_POLLY_MODE !== 'record' && {
          httpAgent: getHttpAgent(),
          httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
        }),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = createAxiosInstance(state, requestConfig);

  // resolve the bearer token right before this request is sent, not once at
  // construction time — see `resolveAmRequestCredential`'s remarks (applies
  // equally here).
  attachCredentialInterceptor(request, () =>
    resolveBearerRequestCredential(state, requiredScopes)
  );

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates a LogKeys API Axios instance
 * @param {object} params Params object
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateLogKeysApi({
  requestOverride = {},
  state,
}: {
  requestOverride?: AxiosRequestConfig;
  state: State;
}): AxiosInstance {
  const headers = {
    'User-Agent': userAgent,
    'Content-Type': 'application/json',
    ...state.getAuthenticationHeaderOverrides(),
    // only add authorization header if we have a bearer token
    ...(state.getBearerToken() && {
      Authorization: `Bearer ${state.getBearerToken()}`,
    }),
  };
  const requestConfig = mergeDeep(
    {
      timeout,
      headers,
      httpAgent: getHttpAgent(),
      httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = createAxiosInstance(state, requestConfig);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates a Log API Axios instance
 * @param {object} params Params object
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateLogApi({
  requestOverride = {},
  state,
}: {
  requestOverride?: AxiosRequestConfig;
  state: State;
}): AxiosInstance {
  const headers = {
    'User-Agent': userAgent,
    'X-API-Key': state.getLogApiKey(),
    'X-API-Secret': state.getLogApiSecret(),
  };
  const requestConfig = mergeDeep(
    {
      // baseURL: getTenantURL(storage.session.getTenant()),
      timeout,
      headers,
      ...(process.env.FRODO_MOCK !== 'record' &&
        process.env.FRODO_POLLY_MODE !== 'record' && {
          httpAgent: getHttpAgent(),
          httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
        }),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = createAxiosInstance(state, requestConfig);

  // add a response interceptor for HTTP 429 errors from log API
  request.interceptors.response.use(
    (response) => {
      // If the response is successful, simply return it
      return response;
    },
    async (error) => {
      const originalRequest = error.config;
      const status = error.response ? error.response.status : null;

      // Check if the error is a 429 Too Many Requests
      // and if the Retry-After header is present
      if (
        status === 429 &&
        error.response.headers['retry-after'] &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true; // Mark the request as retried to prevent infinite loops

        const retryAfterSeconds = parseInt(
          error.response.headers['retry-after'],
          10
        );
        const delayMs = (retryAfterSeconds + 1) * 1000;

        // Wait for the specified duration
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        // Retry the original request
        return request(originalRequest);
      }

      // For other errors, or if no Retry-After header is found,
      // or if the request has already been retried, reject the promise
      return Promise.reject(error);
    }
  );
  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates an Axios instance for the Identity Cloud Environment API
 * @param {object} params Params object
 * @param {ResourceConfig} params.resource Resource config object.
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {string[]} params.requiredScopes OAuth2 scope(s) this specific endpoint requires.
 * Checked against the current session's already-granted scope (a no-op outside cloud deployments).
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateEnvApi({
  resource,
  requestOverride = {},
  requiredScopes,
  state,
}: {
  resource: ResourceConfig;
  requestOverride?: AxiosRequestConfig;
  requiredScopes: string[];
  state: State;
}): AxiosInstance {
  const headers = {
    'User-Agent': userAgent,
    'Content-Type': 'application/json',
    ...state.getAuthenticationHeaderOverrides(),
    // only add API version if we have it
    ...(resource.apiVersion && { 'Accept-API-Version': resource.apiVersion }),
  };
  const requestConfig = mergeDeep(
    {
      // baseURL: getTenantURL(storage.session.getTenant()),
      timeout,
      headers,
      ...(process.env.FRODO_MOCK !== 'record' &&
        process.env.FRODO_POLLY_MODE !== 'record' && {
          httpAgent: getHttpAgent(),
          httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
        }),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = createAxiosInstance(state, requestConfig);

  // resolve the bearer token right before this request is sent, not once at
  // construction time — see `resolveAmRequestCredential`'s remarks (applies
  // equally here).
  attachCredentialInterceptor(request, () =>
    resolveBearerRequestCredential(state, requiredScopes)
  );

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates an Axios instance for the Identity Cloud Governance API
 * @param {object} params Params object
 * @param {ResourceConfig} params.resource Resource config object.
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {string[]} params.requiredScopes OAuth2 scope(s) this specific endpoint requires.
 * Checked against the current session's already-granted scope (a no-op outside cloud deployments).
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateGovernanceApi({
  resource,
  requestOverride = {},
  requiredScopes,
  state,
}: {
  resource: ResourceConfig;
  requestOverride?: AxiosRequestConfig;
  requiredScopes: string[];
  state: State;
}): AxiosInstance {
  const headers = {
    'User-Agent': userAgent,
    'Content-Type': 'application/json',
    ...state.getAuthenticationHeaderOverrides(),
    ...state.getConfigurationHeaderOverrides(),
    // only add API version if we have it
    ...(resource.apiVersion && { 'Accept-API-Version': resource.apiVersion }),
  };
  const requestConfig = mergeDeep(
    {
      timeout,
      headers,
      ...(process.env.FRODO_MOCK !== 'record' &&
        process.env.FRODO_POLLY_MODE !== 'record' && {
          httpAgent: getHttpAgent(),
          httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
        }),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = createAxiosInstance(state, requestConfig);

  // resolve the bearer token right before this request is sent, not once at
  // construction time — see `resolveAmRequestCredential`'s remarks (applies
  // equally here).
  attachCredentialInterceptor(request, () =>
    resolveBearerRequestCredential(state, requiredScopes)
  );

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates an Axios instance for the Identity Cloud WS-Fed API
 * @param {object} params Params object
 * @param {ResourceConfig} params.resource Resource config object.
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {string[]} params.requiredScopes OAuth2 scope(s) this specific endpoint requires.
 * Checked against the PingFederate bearer token's already-granted scope (a no-op outside cloud deployments).
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateWSFedApi({
  requestOverride = {},
  requiredScopes,
  state,
}: {
  requestOverride?: AxiosRequestConfig;
  requiredScopes: string[];
  state: State;
}): AxiosInstance {
  const headers = {
    'User-Agent': userAgent,
    'Content-Type': 'application/json',
    'x-xsrf-header': 'PingFederate',
    ...state.getAuthenticationHeaderOverrides(),
    ...state.getConfigurationHeaderOverrides(),
  };
  const requestConfig = mergeDeep(
    {
      timeout,
      headers,
      ...(process.env.FRODO_MOCK !== 'record' &&
        process.env.FRODO_POLLY_MODE !== 'record' && {
          httpAgent: getHttpAgent(),
          httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
        }),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = createAxiosInstance(state, requestConfig);

  // resolve the PingFederate bearer token right before this request is
  // sent, not once at construction time — see `resolveAmRequestCredential`'s
  // remarks (applies equally here).
  attachCredentialInterceptor(request, () =>
    resolvePfBearerRequestCredential(state, requiredScopes)
  );

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates a release (Github or Npm) Axios API instance
 * @param {object} params Params object
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateReleaseApi({
  baseUrl,
  requestOverride = {},
  state,
}: {
  baseUrl: string;
  requestOverride?: AxiosRequestConfig;
  state: State;
}): AxiosInstance {
  const requestConfig = mergeDeep(
    {
      baseURL: baseUrl,
      timeout,
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
      },
      ...(process.env.FRODO_MOCK !== 'record' &&
        process.env.FRODO_POLLY_MODE !== 'record' && {
          httpAgent: getHttpAgent(),
          httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
        }),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = createAxiosInstance(state, requestConfig);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}
