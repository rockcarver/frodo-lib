import util from 'util';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { getHostOnlyUrl, getIdmBaseUrl } from '../utils/ForgeRockUtils';
import { IdObjectSkeletonInterface } from './ApiTypes';
import {
  generateAmApi,
  generateEnvApi,
  generateGovernanceApi,
  generateIdmApi,
  generateLogApi,
  generateLogKeysApi,
  generateWSFedApi,
  ResourceConfig,
} from './BaseApi';

const amTemplate: string = '%s/%s';
const idmTemplate: string = '%s/%s';
const envTemplate: string = '%s/environment/%s';
// the roots below sit at the root of the host, the endpoint is the whole path including the root
const hostRootTemplate: string = '%s/%s';

export type ApiVersion = {
  protocol: string;
  resource: string;
};

function getApiConfig(
  apiVersion: ApiVersion = {
    protocol: '2.0',
    resource: '1.0',
  }
): { apiVersion: string } {
  return {
    apiVersion: `protocol=${apiVersion.protocol},resource=${apiVersion.resource}`,
  };
}

/**
 * The version header of a request that sends one only when the caller names a version
 * @param {ApiVersion} apiVersion The API version to send, if any
 * @returns {ResourceConfig | undefined} The resource config with the version, or undefined to send no version
 */
function getOptionalApiConfig(
  apiVersion?: ApiVersion
): ResourceConfig | undefined {
  return apiVersion ? getApiConfig(apiVersion) : undefined;
}

/**
 * Performs a get request against the specified AM endpoint
 * @param {string} endpoint The AM endpoint (e.g. if full URL is https://<tenant-host>/am/<endpoint>, <endpoint> is the value to pass in)
 * @param {ApiVersion} apiVersion The API version to use. Defaults to 2.0 for protocol and 1.0 for resource.
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
  const urlString = util.format(amTemplate, state.getHost(), endpoint);
  const { data } = await generateAmApi({
    resource: getApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).get(urlString, { withCredentials: true });

  return data;
}

/**
 * Performs a get request against the specified IDM endpoint
 * @param {string} endpoint The IDM endpoint (e.g. if full URL is https://<tenant-host>/openidm/<endpoint>, <endpoint> is the value to pass in)
 * @param {ApiVersion} apiVersion The API version to send. Without it, no version header is sent.
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
  const urlString = util.format(idmTemplate, getIdmBaseUrl(state), endpoint);
  const { data } = await generateIdmApi({
    resource: getOptionalApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    state,
  }).get(urlString);

  return data;
}

/**
 * Performs a get request against the specified Environment endpoint
 * @param {string} endpoint The Environment endpoint (e.g. if full URL is https://<tenant-host>/environment/<endpoint>, <endpoint> is the value to pass in)
 * @param {ApiVersion} apiVersion The API version to use. Defaults to 2.0 for protocol and 1.0 for resource.
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
    envTemplate,
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
 * Performs a get request against the specified IGA (governance) endpoint
 * @param {string} endpoint The IGA path including its root (e.g. if full URL is https://<tenant-host>/iga/governance/<path>, `iga/governance/<path>` is the value to pass in)
 * @param {ApiVersion} apiVersion The API version to use. Defaults to 2.0 for protocol and 1.0 for resource.
 * @returns {Promise<any>} The response data from the endpoint
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
    hostRootTemplate,
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
 * Performs a get request against the specified log API key endpoint
 * @param {string} endpoint The log keys path including its root (e.g. if full URL is https://<tenant-host>/keys, `keys` is the value to pass in)
 * @param {ApiVersion} apiVersion The API version to send. Without it, no version header is sent.
 * @returns {Promise<any>} The response data from the endpoint
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
    hostRootTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateLogKeysApi({
    resource: getOptionalApiConfig(apiVersion),
    state,
  }).get(urlString);

  return data;
}

/**
 * Performs a get request against the specified monitoring (log) endpoint
 * @param {string} endpoint The monitoring path including its root (e.g. if full URL is https://<tenant-host>/monitoring/logs?source=am-core, `monitoring/logs?source=am-core` is the value to pass in)
 * @param {ApiVersion} apiVersion The API version to send. Without it, no version header is sent.
 * @returns {Promise<any>} The response data from the endpoint
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
    hostRootTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateLogApi({
    resource: getOptionalApiConfig(apiVersion),
    state,
  }).get(urlString);

  return data;
}

/**
 * Performs a get request against the specified WS-Federation administration endpoint
 * @param {string} endpoint The WS-Federation path including its root (e.g. if full URL is https://<tenant-host>/ws/<path>, `ws/<path>` is the value to pass in)
 * @param {ApiVersion} apiVersion The API version to send. Without it, no version header is sent.
 * @returns {Promise<any>} The response data from the endpoint
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
    hostRootTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateWSFedApi({
    resource: getOptionalApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.WSFedAdminScope],
    state,
  }).get(urlString, { withCredentials: true });

  return data;
}

/**
 * Performs a put request against the specified AM endpoint
 * @param {string} endpoint The AM endpoint (e.g. if full URL is https://<tenant-host>/am/<endpoint>, <endpoint> is the value to pass in)
 * @param {IdObjectSkeletonInterface} payload The AM object data to write to the specified endpoint
 * @param {ApiVersion} apiVersion The API version to use. Defaults to 2.0 for protocol and 1.0 for resource.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function putRawAm({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: IdObjectSkeletonInterface;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(amTemplate, state.getHost(), endpoint);
  const { data } = await generateAmApi({
    resource: getApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).put(urlString, payload, { withCredentials: true });
  return data;
}

/**
 * Performs a put request against the specified IDM endpoint
 * @param {string} endpoint The IDM endpoint (e.g. if full URL is https://<tenant-host>/openidm/<endpoint>, <endpoint> is the value to pass in)
 * @param {IdObjectSkeletonInterface} payload The IDM object data to write to the specified endpoint
 * @param {ApiVersion} apiVersion The API version to send. Without it, no version header is sent.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function putRawIdm({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: IdObjectSkeletonInterface;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(idmTemplate, getIdmBaseUrl(state), endpoint);
  const { data } = await generateIdmApi({
    resource: getOptionalApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    state,
  }).put(urlString, payload);
  return data;
}

/**
 * Performs a put request against the specified Environment endpoint
 * @param {string} endpoint The Environment endpoint (e.g. if full URL is https://<tenant-host>/environment/<endpoint>, <endpoint> is the value to pass in)
 * @param {IdObjectSkeletonInterface} payload The object data to write to the specified endpoint
 * @param {ApiVersion} apiVersion The API version to use. Defaults to 2.0 for protocol and 1.0 for resource.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function putRawEnv({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: IdObjectSkeletonInterface;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    envTemplate,
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
 * Performs a put request against the specified IGA (governance) endpoint
 * @param {string} endpoint The IGA path including its root (e.g. if full URL is https://<tenant-host>/iga/governance/<path>, `iga/governance/<path>` is the value to pass in)
 * @param {IdObjectSkeletonInterface} payload The object data to write to the specified endpoint
 * @param {ApiVersion} apiVersion The API version to use. Defaults to 2.0 for protocol and 1.0 for resource.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function putRawIga({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: IdObjectSkeletonInterface;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    hostRootTemplate,
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
 * Performs a put request against the specified log API key endpoint
 * @param {string} endpoint The log keys path including its root (e.g. if full URL is https://<tenant-host>/keys, `keys` is the value to pass in)
 * @param {IdObjectSkeletonInterface} payload The object data to write to the specified endpoint
 * @param {ApiVersion} apiVersion The API version to send. Without it, no version header is sent.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function putRawKeys({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: IdObjectSkeletonInterface;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    hostRootTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateLogKeysApi({
    resource: getOptionalApiConfig(apiVersion),
    state,
  }).put(urlString, payload, { withCredentials: true });

  return data;
}

/**
 * Performs a put request against the specified monitoring (log) endpoint
 * @param {string} endpoint The monitoring path including its root (e.g. if full URL is https://<tenant-host>/monitoring/<path>, `monitoring/<path>` is the value to pass in)
 * @param {IdObjectSkeletonInterface} payload The object data to write to the specified endpoint
 * @param {ApiVersion} apiVersion The API version to send. Without it, no version header is sent.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function putRawMonitoringLogs({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: IdObjectSkeletonInterface;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    hostRootTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateLogApi({
    resource: getOptionalApiConfig(apiVersion),
    state,
  }).put(urlString, payload);

  return data;
}

/**
 * Performs a put request against the specified WS-Federation administration endpoint
 * @param {string} endpoint The WS-Federation path including its root (e.g. if full URL is https://<tenant-host>/ws/<path>, `ws/<path>` is the value to pass in)
 * @param {IdObjectSkeletonInterface} payload The object data to write to the specified endpoint
 * @param {ApiVersion} apiVersion The API version to send. Without it, no version header is sent.
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function putRawWs({
  endpoint,
  payload,
  apiVersion,
  state,
}: {
  endpoint: string;
  payload: IdObjectSkeletonInterface;
  apiVersion?: ApiVersion;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    hostRootTemplate,
    getHostOnlyUrl(state.getHost()),
    endpoint
  );
  const { data } = await generateWSFedApi({
    resource: getOptionalApiConfig(apiVersion),
    requiredScopes: [Constants.AVAILABLE_SCOPES.WSFedAdminScope],
    state,
  }).put(urlString, payload, { withCredentials: true });

  return data;
}
