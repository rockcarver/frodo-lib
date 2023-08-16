import util from 'util';

import { State } from '../shared/State';
import { generateAmApi } from './BaseApi';

const serverInfoUrlTemplate = '%s/json/serverinfo/%s';

const serverInfoApiVersion = 'resource=1.1';
const serverVersionoApiVersion = 'resource=1.0';

const getServerInfoApiConfig = () => ({
  apiVersion: serverInfoApiVersion,
});

const getServerVersionApiConfig = () => ({
  apiVersion: serverVersionoApiVersion,
});

/**
 * Get server info
 * @param {State} state library state
 * @returns {Promise} a promise that resolves to an object containing a server info object
 */
export async function getServerInfo({ state }: { state: State }) {
  const urlString = util.format(serverInfoUrlTemplate, state.getHost(), '*');
  const { data } = await generateAmApi({
    resource: getServerInfoApiConfig(),
    requestOverride: {},
    state,
  }).get(urlString, {});
  return data;
}

/**
 * Get server version info
 * @param {State} state library state
 * @returns {Promise} a promise that resolves to an object containing a server version info object
 */
export async function getServerVersionInfo({ state }: { state: State }) {
  const urlString = util.format(
    serverInfoUrlTemplate,
    state.getHost(),
    'version'
  );
  const { data } = await generateAmApi({
    resource: getServerVersionApiConfig(),
    requestOverride: {},
    state,
  }).get(urlString, {});
  return data;
}
