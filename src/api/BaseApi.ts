import axios, { AxiosProxyConfig } from 'axios';
import Agent from 'agentkeepalive';
import axiosRetry from 'axios-retry';
import HttpsProxyAgent from 'https-proxy-agent';
import url from 'url';
import fs from 'fs';
import * as state from '../shared/State';
import path from 'path';
import { fileURLToPath } from 'url';
import { curlirizeMessage, printMessage } from '../ops/utils/Console';
import _curlirize from '../ext/axios-curlirize/curlirize';
import { randomUUID } from 'crypto';
import { setupPollyForFrodoLib } from '../utils/SetupPollyForFrodoLib';

if (process.env.FRODO_MOCK) {
  setupPollyForFrodoLib();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
);

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

const userAgent = `${pkg.name}/${pkg.version}`;
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
 * @returns {any} appropriate httpsAgent
 */
function getHttpsAgent() {
  if (httpsAgent) return httpsAgent;
  const options = {
    rejectUnauthorized: !state.getAllowInsecureConnection(),
  };
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (httpsProxy) {
    // https://github.com/axios/axios/issues/3459
    console.error(`Using proxy ${httpsProxy}`['yellow']);
    const parsed = url.parse(httpsProxy);
    options['host'] = parsed.hostname;
    options['port'] = parsed.port;
    options['protocol'] = parsed.protocol;
    options.rejectUnauthorized = !state.getAllowInsecureConnection();
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
function curlirize(request) {
  _curlirize(request, (result, err) => {
    const { command } = result;
    if (err) {
      printMessage(err, 'error');
    } else {
      curlirizeMessage(command);
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
export function generateAmApi(resource, requestOverride = {}) {
  let headers = {
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
  if (requestOverride['headers']) {
    headers = {
      ...headers,
      ...requestOverride['headers'],
    };
  }

  const requestDetails = {
    // baseURL: `${storage.session.getTenant()}/json`,
    timeout,
    ...requestOverride,
    headers: {
      ...headers,
      ...state.getAuthenticationHeaderOverrides(),
    },
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request);
  }

  return request;
}

/**
 * Generates an OAuth2 Axios API instance
 * @param {object} resource Takes an object takes a resource object. example:
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either
 * add on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateOauth2Api(resource, requestOverride = {}) {
  let headers = {
    'User-Agent': userAgent,
    'X-ForgeRock-TransactionId': transactionId,
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
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request);
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
export function generateIdmApi(requestOverride = {}) {
  const requestDetails = {
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
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  // if (storage.session.getBearerToken()) {
  //   requestDetails.headers[
  //     'Authorization'
  //   ] = `Bearer ${storage.session.getBearerToken()}`;
  // }

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request);
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
export function generateLogKeysApi(requestOverride = {}) {
  const headers = {
    'User-Agent': userAgent,
    'Content-Type': 'application/json',
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
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request);
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
export function generateLogApi(requestOverride = {}) {
  const headers = {
    'User-Agent': userAgent,
    'X-API-Key': state.getLogApiKey(),
    'X-API-Secret': state.getLogApiSecret(),
  };
  const requestDetails = {
    // baseURL: getTenantURL(storage.session.getTenant()),
    timeout,
    headers,
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request);
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
export function generateEnvApi(resource, requestOverride = {}) {
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
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request);
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
export function generateReleaseApi(baseUrl, requestOverride = {}) {
  const requestDetails = {
    baseURL: baseUrl,
    timeout,
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
    },
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (state.getCurlirize()) {
    curlirize(request);
  }

  return request;
}
