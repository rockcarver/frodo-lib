import axios, {
  AxiosError,
  AxiosInstance,
  AxiosProxyConfig,
  AxiosRequestConfig,
} from 'axios';
import axiosRetry from 'axios-retry';
import { randomUUID } from 'crypto';
import { ProxyAgent } from 'proxy-agent';

import _curlirize from '../ext/axios-curlirize/curlirize';
import StateImpl, { State } from '../shared/State';
import { getUserAgent } from '../shared/Version';
import { curlirizeMessage, printMessage } from '../utils/Console';
import { mergeDeep } from '../utils/JsonUtils';
import { setupPollyForFrodoLib } from '../utils/SetupPollyForFrodoLib';

export type ResourceConfig = { apiVersion?: string };

if (process.env.FRODO_MOCK) {
  setupPollyForFrodoLib({ state: StateImpl({}) });
}

// all agents
const timeout = 30000;

// agentkeepalive
const maxSockets = 100;
const maxFreeSockets = 10;
const keepAlive = false;

const userAgent = getUserAgent();
const transactionId = `frodo-${randomUUID()}`;
let httpAgent, httpsAgent;

function getHttpAgent(): ProxyAgent {
  if (httpAgent) return httpAgent;
  httpAgent = new ProxyAgent({
    maxSockets,
    maxFreeSockets,
    timeout,
    keepAlive,
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
  if (httpsAgent && shareAgent) return httpsAgent;
  const options = {
    rejectUnauthorized: !allowInsecureConnection,
  };
  const agent = new ProxyAgent({
    ...options,
    maxSockets,
    maxFreeSockets,
    timeout,
    keepAlive,
  });
  if (shareAgent) httpsAgent = agent;
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
 * Generates an AM Axios API instance
 * @param {object} params Params object
 * @param {ResourceConfig} params.resource Takes an object takes a resource object. example:
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either
 * add on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateAmApi({
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
 * Generates an OAuth2 Axios API instance
 * @param {object} params Params object
 * @param {ResourceConfig} params.resource Resource config object.
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
  let headers: { [key: string]: any } = {
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
  if (requestOverride['headers']) {
    headers = {
      ...headers,
      ...requestOverride['headers'],
    };
  }

  const requestConfig = {
    // baseURL: `${storage.session.getTenant()}/json${resource.path}`,
    timeout,
    ...requestOverride,
    headers: {
      ...headers,
      ...state.getAuthenticationHeaderOverrides(),
    },
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
    proxy: getProxy(),
  };

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
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateIdmApi({
  requestOverride = {},
  state,
}: {
  requestOverride?: AxiosRequestConfig;
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
        // only add authorization header if we have a bearer token
        ...(state.getBearerToken() && {
          Authorization: `Bearer ${state.getBearerToken()}`,
        }),
      },
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
 * Generates an Axios instance for the Identity Cloud Environment API
 * @param {object} params Params object
 * @param {ResourceConfig} params.resource Resource config object.
 * @param {AxiosRequestConfig} params.requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateEnvApi({
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
    'Content-Type': 'application/json',
    // only add API version if we have it
    ...(resource.apiVersion && { 'Accept-API-Version': resource.apiVersion }),
    // only add authorization header if we have a bearer token
    ...(state.getBearerToken() && {
      Authorization: `Bearer ${state.getBearerToken()}`,
    }),
  };
  const requestConfig = {
    // baseURL: getTenantURL(storage.session.getTenant()),
    timeout,
    headers,
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
    proxy: getProxy(),
  };

  const request = createAxiosInstance(state, requestConfig);

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
 * @param {State} params.state State object
 *
 * @returns {AxiosInstance} Returns a reaady to use Axios instance
 */
export function generateGovernanceApi({
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
    'Content-Type': 'application/json',
    // only add API version if we have it
    ...(resource.apiVersion && { 'Accept-API-Version': resource.apiVersion }),
    // only add authorization header if we have a bearer token
    ...(state.getBearerToken() && {
      Authorization: `Bearer ${state.getBearerToken()}`,
    }),
  };
  const requestConfig = {
    timeout,
    headers,
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
    proxy: getProxy(),
  };

  const request = createAxiosInstance(state, requestConfig);

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
  const requestConfig = {
    baseURL: baseUrl,
    timeout,
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
    },
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(false, false),
    proxy: getProxy(),
  };

  const request = createAxiosInstance(state, requestConfig);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}
