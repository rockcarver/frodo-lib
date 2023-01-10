import util from 'util';
import { generateAmApi } from './BaseApi';
import * as state from '../shared/State';

const serverInfoUrlTemplate = '%s/json/serverinfo/%s';

const serverInfoApiVersion = 'resource=1.1';
const getServerInfoApiConfig = () => ({
  apiVersion: serverInfoApiVersion,
});

const serverVersionoApiVersion = 'resource=1.0';
const getServerVersionApiConfig = () => ({
  apiVersion: serverVersionoApiVersion,
});

/**
 * Get server info
 * @returns {Promise} a promise that resolves to an object containing a server info object
 */
export async function getServerInfo() {
  const urlString = util.format(serverInfoUrlTemplate, state.getHost(), '*');
  const { data } = await generateAmApi(getServerInfoApiConfig()).get(
    urlString,
    {}
  );
  return data;
}

/**
 * Get server version info
 * @returns {Promise} a promise that resolves to an object containing a server version info object
 */
export async function getServerVersionInfo() {
  const urlString = util.format(
    serverInfoUrlTemplate,
    state.getHost(),
    'version'
  );
  const { data } = await generateAmApi(getServerVersionApiConfig()).get(
    urlString,
    {}
  );
  return data;
}
