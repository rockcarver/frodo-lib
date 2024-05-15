import Agent from 'agentkeepalive';
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosProxyConfig,
  AxiosRequestConfig,
} from 'axios';
import axiosRetry from 'axios-retry';
import { randomUUID } from 'crypto';
import HttpsProxyAgent from 'https-proxy-agent';

import _curlirize from '../ext/axios-curlirize/curlirize';
import StateImpl, { State } from '../shared/State';
import { getUserAgent } from '../shared/Version';
import { curlirizeMessage, printMessage } from '../utils/Console';
import { mergeDeep } from '../utils/JsonUtils';
import { setupPollyForFrodoLib } from '../utils/SetupPollyForFrodoLib';

if (process.env.FRODO_MOCK) {
  setupPollyForFrodoLib({ state: StateImpl({}) });
}

axiosRetry(axios, {
  retries: 3,
  shouldResetTimeout: true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  retryCondition: (_error) => true, // retry no matter what
});

// all agents
const timeout = 30000;

// agentkeepalive
const maxSockets = 100;
const maxFreeSockets = 10;
const freeSocketTimeout = 30000;

const userAgent = getUserAgent();
const transactionId = `frodo-${randomUUID()}`;
let httpAgent, httpsAgent;

function getHttpAgent() {
  if (httpAgent) return httpAgent;
  httpAgent = new Agent({
    maxSockets,
    maxFreeSockets,
    timeout,
    freeSocketTimeout,
  });
  return httpAgent;
}

/**
 * Helper method to create properly configured httpsAgent
 * @returns {Agent.HttpsAgent} appropriate httpsAgent
 */
function getHttpsAgent(allowInsecureConnection: boolean): Agent.HttpsAgent {
  if (httpsAgent) return httpsAgent;
  const options = {
    rejectUnauthorized: !allowInsecureConnection,
  };
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (httpsProxy) {
    // https://github.com/axios/axios/issues/3459
    // eslint-disable-next-line no-console
    console.error(`Using proxy ${httpsProxy}`['yellow']);
    const parsed = new URL(httpsProxy);
    options['host'] = parsed.hostname;
    options['port'] = parsed.port;
    options['protocol'] = parsed.protocol;
    options.rejectUnauthorized = !allowInsecureConnection;
    httpsAgent = HttpsProxyAgent(options);
    return httpsAgent;
  }
  httpsAgent = new Agent.HttpsAgent({
    ...options,
    maxSockets,
    maxFreeSockets,
    timeout,
    freeSocketTimeout,
  });
  return httpsAgent;
}

/**
 * Get Proxy config
 * @returns {AxiosProxyConfig | false} axios proxy config or false
 */
function getProxy(): AxiosProxyConfig | false {
  if (process.env.HTTPS_PROXY || process.env.https_proxy) return false;
  return null;
}

/**
 * Customize curlirize output
 * @param request axios request object
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
          }`,
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
 * @param {object} resource Takes an object takes a resource object. example:
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either
 * add on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateAmApi({
  resource,
  requestOverride = {},
  state,
}: {
  resource;
  requestOverride?;
  state: State;
}) {
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

  const requestDetails = mergeDeep(
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

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates an OAuth2 Axios API instance
 * @param {object} resource Takes a resource object. example:
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either
 * add on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateOauth2Api({
  resource,
  requestOverride = {},
  authenticate = true,
  state,
}: {
  resource: { apiVersion: string };
  requestOverride?: AxiosRequestConfig;
  authenticate?: boolean;
  state: State;
}) {
  let headers = {
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

  const requestDetails = {
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

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates an IDM Axios API instance
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateIdmApi({
  requestOverride = {},
  state,
}: {
  requestOverride?: any;
  state: State;
}) {
  const requestDetails = mergeDeep(
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

  // if (storage.session.getBearerToken()) {
  //   requestDetails.headers[
  //     'Authorization'
  //   ] = `Bearer ${storage.session.getBearerToken()}`;
  // }

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates a LogKeys API Axios instance
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateLogKeysApi({
  requestOverride = {},
  state,
}: {
  requestOverride?;
  state: State;
}) {
  const headers = {
    'User-Agent': userAgent,
    'Content-Type': 'application/json',
    // only add authorization header if we have a bearer token
    ...(state.getBearerToken() && {
      Authorization: `Bearer ${state.getBearerToken()}`,
    }),
  };
  const requestDetails = mergeDeep(
    {
      timeout,
      headers,
      httpAgent: getHttpAgent(),
      httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
      proxy: getProxy(),
    },
    requestOverride
  );

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates a Log API Axios instance
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateLogApi({
  requestOverride = {},
  state,
}: {
  requestOverride?;
  state: State;
}) {
  const headers = {
    'User-Agent': userAgent,
    'X-API-Key': state.getLogApiKey(),
    'X-API-Secret': state.getLogApiSecret(),
  };
  const requestDetails = mergeDeep(
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

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates an Axios instance for the Identity Cloud Environment API
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateEnvApi({
  resource,
  requestOverride = {},
  state,
}: {
  resource: { apiVersion: string };
  requestOverride?: object;
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
  const requestDetails = {
    // baseURL: getTenantURL(storage.session.getTenant()),
    timeout,
    headers,
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}

/**
 * Generates a release (Github or Npm) Axios API instance
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateReleaseApi({
  baseUrl,
  requestOverride = {},
  state,
}: {
  baseUrl: string;
  requestOverride?: object;
  state: State;
}): AxiosInstance {
  const requestDetails = {
    baseURL: baseUrl,
    timeout,
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
    },
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(state.getAllowInsecureConnection()),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request, state);
  }

  return request;
}
