import {
  getAllConfigEntities as getAllConfigEntitiesRaw,
  getConfigEntity as getConfigEntityRaw,
  putConfigEntity as putConfigEntityRaw,
  getConfigEntitiesByType as getConfigEntitiesByTypeRaw,
  queryAllManagedObjectsByType as queryAllManagedObjectsByTypeRaw,
} from '../api/IdmConfigApi';

/**
 * Get all IDM config entities
 * @returns {Promise} a promise that resolves to all IDM config entities
 */
export async function getAllConfigEntities() {
  return getAllConfigEntitiesRaw();
}

/**
 * Get IDM config entities by type
 * @param {String} type the desired type of config entity
 * @returns {Promise} a promise that resolves to an object containing all IDM config entities of the desired type
 */
export async function getConfigEntitiesByType(type) {
  return getConfigEntitiesByTypeRaw(type);
}

/**
 * Get an IDM config entity
 * @param {string} entityId the desired config entity
 * @returns {Promise<unknown>} a promise that resolves to an IDM config entity
 */
export async function getConfigEntity(entityId) {
  return getConfigEntityRaw(entityId);
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
  return putConfigEntityRaw(entityId, entityData);
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
  return queryAllManagedObjectsByTypeRaw(type, fields, pageCookie);
}
