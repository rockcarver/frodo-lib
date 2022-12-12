import util from 'util';
import { generateIdmApi } from './BaseApi';
import { getTenantURL } from './utils/ApiUtils';
import * as state from '../shared/State';
import { ObjectSkeletonInterface } from './ApiTypes';

const managedObjectURLTemplate = '%s/openidm/managed/%s';
const createManagedObjectURLTemplate = '%s/openidm/managed/%s?_action=create';
const managedObjectByIdURLTemplate = '%s/openidm/managed/%s/%s';
const managedObjectQueryAllURLTemplate = `${managedObjectURLTemplate}?_queryFilter=true&_pageSize=10000`;

/**
 * Get managed object
 * @param {String} id managed object id
 * @returns {Promise} a promise that resolves to an object containing a managed object
 */
export async function getManagedObject(type, id, fields) {
  const fieldsParam =
    fields.length > 0 ? `_fields=${fields.join(',')}` : '_fields=*';
  const urlString = util.format(
    `${managedObjectByIdURLTemplate}?${fieldsParam}`,
    getTenantURL(state.getHost()),
    type,
    id
  );
  return generateIdmApi().get(urlString);
}

/**
 * Create managed object with server-generated id
 * @param {string} moType managed object type
 * @param {any} moData managed object data
 * @returns {Promise<ObjectSkeletonInterface>} a promise that resolves to an object containing a managed object
 */
export async function createManagedObject(
  moType: string,
  moData
): Promise<ObjectSkeletonInterface> {
  const urlString = util.format(
    createManagedObjectURLTemplate,
    getTenantURL(state.getHost()),
    moType
  );
  const { data } = await generateIdmApi().post(urlString, moData);
  return data;
}

/**
 * Create or update managed object
 * @param {String} id managed object id
 * @param {String} data managed object
 * @returns {Promise} a promise that resolves to an object containing a managed object
 */
export async function putManagedObject(type, id, data) {
  const urlString = util.format(
    managedObjectByIdURLTemplate,
    getTenantURL(state.getHost()),
    type,
    id
  );
  return generateIdmApi().put(urlString, data);
}

/**
 * Query managed objects
 * @param {String} type managed object type
 * @param {String} fields fields to retrieve
 * @param {String} pageCookie paged results cookie
 * @returns {Promise} a promise that resolves to an object containing managed objects of the desired type
 */
export async function queryAllManagedObjectsByType(type, fields, pageCookie) {
  const fieldsParam =
    fields.length > 0 ? `&_fields=${fields.join(',')}` : '&_fields=_id';
  const urlTemplate = pageCookie
    ? `${managedObjectQueryAllURLTemplate}${fieldsParam}&_pagedResultsCookie=${pageCookie}`
    : `${managedObjectQueryAllURLTemplate}${fieldsParam}`;
  const urlString = util.format(
    urlTemplate,
    getTenantURL(state.getHost()),
    type
  );
  return generateIdmApi().get(urlString);
}
