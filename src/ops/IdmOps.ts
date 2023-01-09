import {
  getAllConfigEntities as _getAllConfigEntities,
  getConfigEntity as _getConfigEntity,
  putConfigEntity as _putConfigEntity,
  getConfigEntitiesByType as _getConfigEntitiesByType,
  queryAllManagedObjectsByType as _queryAllManagedObjectsByType,
} from '../api/IdmConfigApi';
import {
  testConnectorServers as _testConnectorServers,
  ConnectorServerStatusInterface,
} from '../api/IdmSystemApi';

/**
 * Get all IDM config entities
 * @returns {Promise} a promise that resolves to all IDM config entities
 */
export async function getAllConfigEntities() {
  return _getAllConfigEntities();
}

/**
 * Get IDM config entities by type
 * @param {String} type the desired type of config entity
 * @returns {Promise} a promise that resolves to an object containing all IDM config entities of the desired type
 */
export async function getConfigEntitiesByType(type) {
  return _getConfigEntitiesByType(type);
}

/**
 * Get an IDM config entity
 * @param {string} entityId the desired config entity
 * @returns {Promise<unknown>} a promise that resolves to an IDM config entity
 */
export async function getConfigEntity(entityId) {
  return _getConfigEntity(entityId);
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
  return _putConfigEntity(entityId, entityData);
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
  fields: string[] = [],
  pageCookie: string = undefined
): Promise<{
  result: unknown[];
  resultCount: number;
  pagedResultsCookie: string;
  totalPagedResultsPolicy: string;
  totalPagedResults: number;
  remainingPagedResults: number;
}> {
  return _queryAllManagedObjectsByType(type, fields, pageCookie);
}

/**
 * Test connector servers
 * @returns {Promise<ConnectorServerStatusInterface[]>} a promise that resolves to an array of ConnectorServerStatusInterface objects
 */
export async function testConnectorServers(): Promise<
  ConnectorServerStatusInterface[]
> {
  const response = await _testConnectorServers();
  return response.openicf;
}
