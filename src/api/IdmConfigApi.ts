import util from 'util';
import { generateIdmApi } from './BaseApi';
import { getTenantURL } from './utils/ApiUtils';
import storage from '../storage/SessionStorage';

const idmAllConfigURLTemplate = '%s/openidm/config';
const idmConfigURLTemplate = '%s/openidm/config/%s';
const idmConfigEntityQueryTemplate = '%s/openidm/config?_queryFilter=%s';
const idmManagedObjectURLTemplate =
  '%s/openidm/managed/%s?_queryFilter=true&_pageSize=10000';

/**
 * Get all IDM config entities
 * @returns {Promise} a promise that resolves to all IDM config entities
 */
export async function getAllConfigEntities() {
  const urlString = util.format(
    idmAllConfigURLTemplate,
    getTenantURL(storage.session.getTenant())
  );
  const { data } = await generateIdmApi().get(urlString);
  return data;
}

/**
 * Get IDM config entities by type
 * @param {String} type the desired type of config entity
 * @returns {Promise} a promise that resolves to an object containing all IDM config entities of the desired type
 */
export async function getConfigEntitiesByType(type) {
  const urlString = util.format(
    idmConfigEntityQueryTemplate,
    getTenantURL(storage.session.getTenant()),
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
    getTenantURL(storage.session.getTenant()),
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
    getTenantURL(storage.session.getTenant()),
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
 * Query managed objects
 * @param {String} type managed object type
 * @param {[String]} fields fields to retrieve
 * @param {String} pageCookie paged results cookie
 * @returns {Promise<{result: any[]; resultCount: number; pagedResultsCookie: any; totalPagedResultsPolicy: string; totalPagedResults: number; remainingPagedResults: number;}>} a promise that resolves to managed objects of the desired type
 */
export async function queryAllManagedObjectsByType(
  type,
  fields,
  pageCookie
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
    getTenantURL(storage.session.getTenant()),
    type
  );
  const { data } = await generateIdmApi().get(urlString);
  return data;
}
