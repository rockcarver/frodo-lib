import util from 'util';
import { generateIdmApi } from './BaseApi';
import { getTenantURL } from './utils/ApiUtils';
import * as state from '../shared/State';

const idmAllConfigURLTemplate = '%s/openidm/config';
const idmConfigURLTemplate = '%s/openidm/config/%s';
const idmConfigEntityQueryTemplate = '%s/openidm/config?_queryFilter=%s';
const idmManagedObjectURLTemplate =
  '%s/openidm/managed/%s?_queryFilter=true&_pageSize=10000';
const idmSystemURLTemplate = '%s/openidm/system?_action=testConnectorServers';

/**
 * Get all connector servers
 * @returns {Promise} a promise that resolves to status of all IDM RCS
 */
export async function getAllConnectorServers() {
  const urlString = util.format(
    idmSystemURLTemplate,
    getTenantURL(storage.session.getTenant())
  );

  try {
    const { data } = await generateIdmApi().post(urlString);
    return data;
  } catch (error) {
    throw Error(`Unable to test connector server status: ${error}`);
  }
}

/**
 * Get all IDM config entities
 * @returns {Promise} a promise that resolves to all IDM config entities
 */
export async function getAllConfigEntities() {
  const urlString = util.format(
    idmAllConfigURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateIdmApi().get(urlString);
  return data;
}

/**
 * Get IDM config entities by type
 * @param {string} type the desired type of config entity
 * @returns {Promise} a promise that resolves to an object containing all IDM config entities of the desired type
 */
export async function getConfigEntitiesByType(type) {
  const urlString = util.format(
    idmConfigEntityQueryTemplate,
    getTenantURL(state.getHost()),
    encodeURIComponent(`_id sw '${type}'`)
  );
  const { data } = await generateIdmApi().get(urlString);
  return data;
}

/**
 * Get an IDM config entity
 * @param {string} entityId the desired config entity
 * @returns {Promise<unknown>} a promise that resolves to an IDM config entity
 */
export async function getConfigEntity(entityId) {
  const urlString = util.format(
    idmConfigURLTemplate,
    getTenantURL(state.getHost()),
    entityId
  );
  const { data } = await generateIdmApi().get(urlString);
  return data;
}

/**
 * Put IDM config entity
 * @param {string} entityId config entity id
 * @param {string} entityData config entity object
 * @returns {Promise<unknown>} a promise that resolves to an IDM config entity
 */
export async function putConfigEntity(
  entityId: string,
  entityData: string | object
) {
  const urlString = util.format(
    idmConfigURLTemplate,
    getTenantURL(state.getHost()),
    entityId
  );
  try {
    const { data } = await generateIdmApi().put(urlString, entityData);
    return data;
  } catch (error) {
    throw Error(`Could not put config entity ${entityId}: ${error}`);
  }
}

/**
 * Delete IDM config entity
 * @param {string} entityId config entity id
 * @returns {Promise<unknown>} a promise that resolves to an IDM config entity
 */
export async function deleteConfigEntity(entityId: string) {
  const urlString = util.format(
    idmConfigURLTemplate,
    getTenantURL(state.getHost()),
    entityId
  );
  const { data } = await generateIdmApi().delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Query managed objects
 * @param {string} type managed object type
 * @param {string[]} fields fields to retrieve
 * @param {string} pageCookie paged results cookie
 * @returns {Promise<{result: any[]; resultCount: number; pagedResultsCookie: any; totalPagedResultsPolicy: string; totalPagedResults: number; remainingPagedResults: number;}>} a promise that resolves to managed objects of the desired type
 */
export async function queryAllManagedObjectsByType(
  type: string,
  fields: string[],
  pageCookie: string
): Promise<{
  result: unknown[];
  resultCount: number;
  pagedResultsCookie: string;
  totalPagedResultsPolicy: string;
  totalPagedResults: number;
  remainingPagedResults: number;
}> {
  const fieldsParam =
    fields.length > 0 ? `&_fields=${fields.join(',')}` : '&_fields=_id';
  const urlTemplate = pageCookie
    ? `${idmManagedObjectURLTemplate}${fieldsParam}&_pagedResultsCookie=${encodeURIComponent(
        pageCookie
      )}`
    : `${idmManagedObjectURLTemplate}${fieldsParam}`;
  const urlString = util.format(
    urlTemplate,
    getTenantURL(state.getHost()),
    type
  );
  const { data } = await generateIdmApi().get(urlString);
  return data;
}
