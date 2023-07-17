import util from 'util';
import { generateIdmApi } from './BaseApi';
import { getHostBaseUrl } from '../utils/ForgeRockUtils';
import { State } from '../shared/State';
import { IdObjectSkeletonInterface, PagedResult } from './ApiTypes';

const idmAllConfigURLTemplate = '%s/openidm/config';
const idmConfigURLTemplate = '%s/openidm/config/%s';
const idmConfigEntityQueryTemplate = '%s/openidm/config?_queryFilter=%s';
const idmManagedObjectURLTemplate =
  '%s/openidm/managed/%s?_queryFilter=true&_pageSize=10000';

/**
 * Get all IDM config entities
 * @returns {Promise} a promise that resolves to all IDM config entities
 */
export async function getAllConfigEntities({ state }: { state: State }) {
  const urlString = util.format(
    idmAllConfigURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}

/**
 * Get IDM config entities by type
 * @param {string} type the desired type of config entity
 * @returns {Promise} a promise that resolves to an object containing all IDM config entities of the desired type
 */
export async function getConfigEntitiesByType({
  type,
  state,
}: {
  type: string;
  state: State;
}) {
  const urlString = util.format(
    idmConfigEntityQueryTemplate,
    getHostBaseUrl(state.getHost()),
    encodeURIComponent(`_id sw '${type}'`)
  );
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}

/**
 * Get an IDM config entity
 * @param {string} entityId the desired config entity
 * @returns {Promise<unknown>} a promise that resolves to an IDM config entity
 */
export async function getConfigEntity({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}) {
  const urlString = util.format(
    idmConfigURLTemplate,
    getHostBaseUrl(state.getHost()),
    entityId
  );
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}

/**
 * Put IDM config entity
 * @param {string} entityId config entity id
 * @param {string} entityData config entity object
 * @returns {Promise<unknown>} a promise that resolves to an IDM config entity
 */
export async function putConfigEntity({
  entityId,
  entityData,
  state,
}: {
  entityId: string;
  entityData: string | object;
  state: State;
}) {
  const urlString = util.format(
    idmConfigURLTemplate,
    getHostBaseUrl(state.getHost()),
    entityId
  );
  try {
    const { data } = await generateIdmApi({ state }).put(urlString, entityData);
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
export async function deleteConfigEntity({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}) {
  const urlString = util.format(
    idmConfigURLTemplate,
    getHostBaseUrl(state.getHost()),
    entityId
  );
  const { data } = await generateIdmApi({ state }).delete(urlString, {
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
export async function queryAllManagedObjectsByType({
  type,
  fields = [],
  pageCookie = undefined,
  state,
}: {
  type: string;
  fields?: string[];
  pageCookie?: string;
  state: State;
}): Promise<PagedResult<IdObjectSkeletonInterface>> {
  const fieldsParam =
    fields.length > 0 ? `&_fields=${fields.join(',')}` : '&_fields=_id';
  const urlTemplate = pageCookie
    ? `${idmManagedObjectURLTemplate}${fieldsParam}&_pagedResultsCookie=${encodeURIComponent(
        pageCookie
      )}`
    : `${idmManagedObjectURLTemplate}${fieldsParam}`;
  const urlString = util.format(
    urlTemplate,
    getHostBaseUrl(state.getHost()),
    type
  );
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}
