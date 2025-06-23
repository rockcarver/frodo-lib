import util from 'util';

import { State } from '../shared/State';
import { getHostOnlyUrl, getIdmBaseUrl } from '../utils/ForgeRockUtils';
import { generateAmApi, generateEnvApi, generateIdmApi } from './BaseApi';

const amTemplate: string = '%s/%s';
const idmTemplate: string = '%s/%s';
const envTemplate: string = '%s/environment/%s';

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
    state,
  }).get(urlString, { withCredentials: true });

  return data;
}

/**
 * Performs a get request against the specified IDM endpoint
 * @param {string} endpoint The IDM endpoint (e.g. if full URL is https://<tenant-host>/openidm/<endpoint>, <endpoint> is the value to pass in)
 * @returns {Promise<any>} The response data from the endpoint
 */
export async function getRawIdm({
  endpoint,
  state,
}: {
  endpoint: string;
  state: State;
}): Promise<any> {
  const urlString = util.format(idmTemplate, getIdmBaseUrl(state), endpoint);
  const { data } = await generateIdmApi({ state }).get(urlString);

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
    state,
  }).get(urlString, { withCredentials: true });

  return data;
}
