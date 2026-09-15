import util from 'util';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { getHostOnlyUrl } from '../utils/ForgeRockUtils';
import {
  ApiVersion,
  generateAmApi,
  generateEnvApi,
  generateGovernanceApi,
  generateIdmApi,
  generateLogApi,
  generateLogKeysApi,
  generateWSFedApi,
  getApiConfig,
} from './BaseApi';

const urlTemplate: string = '%s/%s';

/**
 * Performs a get request against the specified AM endpoint
 * @param {string} endpoint The AM endpoint
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function getRawAm({
  endpoint,
  apiVersion,
  state,
}: {
  endpoint: string;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).get(urlString, { withCredentials: true });

  return data;
}

/**
 * Performs a get request against the specified IDM endpoint
 * @param {string} endpoint The IDM endpoint
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function getRawIdm({
  endpoint,
  apiVersion,
  state,
}: {
  endpoint: string;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateIdmApi({
    resource: getApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    state,
  }).get(urlString);

  return data;
}

/**
 * Retrieves raw IGA data from the specified endpoint.
 * @param {string} endpoint - The endpoint to send the GET request to.
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns A promise that resolves to the raw API response data.
 */

export async function getRawIga({
  endpoint,
  apiVersion,
  state,
}: {
  endpoint: string;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateGovernanceApi({
    resource: getApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.IGAFullScope],
    state,
  }).get(urlString, { withCredentials: true });

  return data;
}

/**
 * Retrieves raw log key data from the specified endpoint.
 * @param {string} endpoint - The endpoint to send the GET request to.
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns A promise that resolves to the raw API response data.
 */
export async function getRawKeys({
  endpoint,
  apiVersion,
  state,
}: {
  endpoint: string;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateLogKeysApi({
    resource: getApiConfig(apiVersion),
    state,
  }).get(urlString);

  return data;
}

/**
 * Retrieves raw monitoring log data from the specified endpoint.
 * @param {string} endpoint - The endpoint to send the GET request to.
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns A promise that resolves to the raw monitoring log response data.
 */
export async function getRawMonitoringLogs({
  endpoint,
  apiVersion,
  state,
}: {
  endpoint: string;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateLogApi({
    resource: getApiConfig(apiVersion),
    state,
  }).get(urlString);

  return data;
}

/**
 * Retrieves raw WS-Federation data from the specified endpoint.
 * @param {string} endpoint - The endpoint to send the GET request to.
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns A promise that resolves to the raw API response data.
 */
export async function getRawWs({
  endpoint,
  apiVersion,
  state,
}: {
  endpoint: string;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateWSFedApi({
    resource: getApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.WSFedAdminScope],
    state,
  }).get(urlString, { withCredentials: true });

  return data;
}

/**
 * Performs a get request against the specified Environment endpoint
 * @param {string} endpoint The Environment endpoint
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function getRawEnv({
  endpoint,
  apiVersion,
  state,
}: {
  endpoint: string;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(apiVersion),
    // No single umbrella scope covers arbitrary cloud environment paths —
    // deliberately empty, meaning "nothing to check", not an oversight.
    requiredScopes: [],
    state,
  }).get(urlString, { withCredentials: true });

  return data;
}

/**
 * Performs a put request against the specified AM endpoint
 * @param {string} endpoint The AM endpoint
 * @param {object} payload The AM object data to write to the specified endpoint
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function putRawAm({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: object;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).put(urlString, payload, { withCredentials: true });
  return data;
}

/**
 * Performs a put request against the specified IDM endpoint
 * @param {string} endpoint The IDM endpoint
 * @param {object} payload The IDM object data to write to the specified endpoint
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function putRawIdm({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: object;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateIdmApi({
    resource: getApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    state,
  }).put(urlString, payload);
  return data;
}

/**
 * Performs a put request against the specified Environment endpoint
 * @param {string} endpoint The Environment endpoint
 * @param {object} payload The object data to write to the specified endpoint
 * @param {ApiVersion} apiVersion Optional API version.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function putRawEnv({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: object;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(apiVersion),
    // No single umbrella scope covers arbitrary cloud environment paths —
    // deliberately empty, meaning "nothing to check", not an oversight.
    requiredScopes: [],
    state,
  }).put(urlString, payload, { withCredentials: true });
  return data;
}

/**
 * Updates IGA data at the specified endpoint using a PUT request.
 * @param {string} endpoint - The endpoint to send the PUT request to.
 * @param {object} payload - The data to include in the request body.
 * @param {ApiVersion} apiVersion - Optional API version.
 * @returns A promise that resolves to the raw API response data.
 */
export async function putRawIga({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: object;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateGovernanceApi({
    resource: getApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.IGAFullScope],
    state,
  }).put(urlString, payload, { withCredentials: true });

  return data;
}

/**
 * Updates log key data at the specified endpoint using a PUT request.
 * @param {string} endpoint - The endpoint to send the PUT request to.
 * @param {object} payload - The data to include in the request body.
 * @param {ApiVersion} apiVersion - Optional API version.
 * @returns A promise that resolves to the raw API response data.
 */
export async function putRawKeys({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: object;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateLogKeysApi({
    resource: getApiConfig(apiVersion),
    state,
  }).put(urlString, payload, { withCredentials: true });

  return data;
}

/**
 * Updates monitoring log data at the specified endpoint using a PUT request.
 * @param {string} endpoint - The endpoint to send the PUT request to.
 * @param {object} payload - The data to include in the request body.
 * @param {ApiVersion} apiVersion - Optional API version.
 * @returns A promise that resolves to the raw monitoring log response data.
 */
export async function putRawMonitoringLogs({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: object;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateLogApi({
    resource: getApiConfig(apiVersion),
    state,
  }).put(urlString, payload);

  return data;
}

/**
 * Updates WS-Fed data at the specified endpoint using a PUT request.
 * @param {string} endpoint - The endpoint to send the PUT request to.
 * @param {object} payload - The data to include in the request body.
 * @param {ApiVersion} apiVersion - Optional API version.
 * @returns A promise that resolves to the raw API response data.
 */
export async function putRawWs({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: object;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    urlTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateWSFedApi({
    resource: getApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.WSFedAdminScope],
    state,
  }).put(urlString, payload, { withCredentials: true });

  return data;
}
