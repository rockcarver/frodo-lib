import util from 'util';
import { generateIdmApi } from './BaseApi';
import { IdObjectSkeletonInterface } from './ApiTypes';
import State from '../shared/State';

const managedObjectURLTemplate = '%s/openidm/managed/%s';
const createManagedObjectURLTemplate = '%s/openidm/managed/%s?_action=create';
const managedObjectByIdURLTemplate = '%s/openidm/managed/%s/%s';
const managedObjectQueryAllURLTemplate = `${managedObjectURLTemplate}?_queryFilter=true&_pageSize=10000`;

/**
 * Get managed object
 * @param {string} baseUrl tenant base URL
 * @param {string} type managed object type, e.g. alpha_user or user
 * @param {string} id managed object id
 * @param {string[]} id array of fields to include
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an ObjectSkeletonInterface
 */
export async function getManagedObject({
  baseUrl,
  type,
  id,
  fields = ['*'],
  state,
}: {
  baseUrl: string;
  type: string;
  id: string;
  fields: string[];
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const fieldsParam = `_fields=${fields.join(',')}`;
  const urlString = util.format(
    `${managedObjectByIdURLTemplate}?${fieldsParam}`,
    baseUrl,
    type,
    id
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).get(
    urlString
  );
  return data as IdObjectSkeletonInterface;
}

/**
 * Create managed object with server-generated id
 * @param {string} baseUrl tenant base URL
 * @param {string} moType managed object type
 * @param {any} moData managed object data
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a managed object
 */
export async function createManagedObject(
  baseUrl: string,
  moType: string,
  moData,
  state: State
): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    createManagedObjectURLTemplate,
    baseUrl,
    moType
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).post(
    urlString,
    moData
  );
  return data;
}

/**
 * Create or update managed object
 * @param {string} baseUrl tenant base URL
 * @param {string} id managed object id
 * @param {string} moData managed object
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a managed object
 */
export async function putManagedObject(
  baseUrl: string,
  type: string,
  id: string,
  moData: IdObjectSkeletonInterface,
  state: State
): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    managedObjectByIdURLTemplate,
    baseUrl,
    type,
    id
  );
  return generateIdmApi({ requestOverride: {}, state }).put(urlString, moData);
}

/**
 * Query managed objects
 * @param {string} baseUrl tenant base URL
 * @param {string} type managed object type
 * @param {string} fields fields to retrieve
 * @param {string} pageCookie paged results cookie
 * @param {State} state library state
 * @returns {Promise} a promise that resolves to an object containing managed objects of the desired type
 */
export async function queryAllManagedObjectsByType(
  baseUrl: string,
  type: string,
  fields: string[],
  pageCookie: string,
  state: State
) {
  const fieldsParam =
    fields.length > 0 ? `&_fields=${fields.join(',')}` : '&_fields=_id';
  const urlTemplate = pageCookie
    ? `${managedObjectQueryAllURLTemplate}${fieldsParam}&_pagedResultsCookie=${pageCookie}`
    : `${managedObjectQueryAllURLTemplate}${fieldsParam}`;
  const urlString = util.format(urlTemplate, baseUrl, type);
  return generateIdmApi({ requestOverride: {}, state }).get(urlString);
}
