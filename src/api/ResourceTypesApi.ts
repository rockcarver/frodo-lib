import util from 'util';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { generateAmApi } from './BaseApi';
import { State } from '../shared/State';
import { ResourceTypeSkeleton } from './ApiTypes';

const queryAllResourceTypesURLTemplate =
  '%s/json%s/resourcetypes?_sortKeys=name&_queryFilter=name+eq+%22%5E(%3F!Delegation%20Service%24).*%22';
const queryResourceTypeByNameURLTemplate =
  '%s/json%s/resourcetypes?_sortKeys=name&_queryFilter=name+eq+%22%s%22+AND+name+eq+%22%5E(%3F!Delegation%20Service%24).*%22';
const resourceTypeURLTemplate = '%s/json%s/resourcetypes/%s';
const createResourceTypeURLTemplate = '%s/json%s/resourcetypes?_action=create';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Get all resource types
 * @returns {Promise} a promise that resolves to an object containing an array of resource type objects
 */
export async function getResourceTypes({ state }: { state: State }) {
  const urlString = util.format(
    queryAllResourceTypesURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get resource type by uuid
 * @param {String} resourceTypeUuid resource type uuid
 * @returns {Promise} a promise that resolves to a node object
 */
export async function getResourceType({
  resourceTypeUuid,
  state,
}: {
  resourceTypeUuid: string;
  state: State;
}) {
  const urlString = util.format(
    resourceTypeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    resourceTypeUuid
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get resource type by name
 * @param {string} resourceTypeName resource type name
 * @returns {Promise} a promise that resolves to a node object
 */
export async function getResourceTypeByName({
  resourceTypeName,
  state,
}: {
  resourceTypeName: string;
  state: State;
}) {
  const urlString = util.format(
    queryResourceTypeByNameURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    resourceTypeName
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Create resource type by uuid
 * @param {string} resourceTypeUuid resource type uuid
 * @param {Object} resourceTypeData resource type object
 * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
 */
export async function createResourceType({
  resourceTypeData,
  state,
}: {
  resourceTypeData: ResourceTypeSkeleton;
  state: State;
}): Promise<ResourceTypeSkeleton> {
  const urlString = util.format(
    createResourceTypeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, resourceTypeData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Update resource type by uuid
 * @param {string} resourceTypeUuid resource type uuid
 * @param {ResourceTypeSkeleton} resourceTypeData resource type object
 * @returns {Promise} a promise that resolves to a resource type object
 */
export async function putResourceType({
  resourceTypeUuid,
  resourceTypeData,
  state,
}: {
  resourceTypeUuid: string;
  resourceTypeData: ResourceTypeSkeleton;
  state: State;
}) {
  const urlString = util.format(
    resourceTypeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    resourceTypeUuid
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    resourceTypeData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete resource type
 * @param {String} resourceTypeUuid resource type uuid
 * @returns {Promise} a promise that resolves to an object containing a resource type object
 */
export async function deleteResourceType({
  resourceTypeUuid,
  state,
}: {
  resourceTypeUuid: string;
  state: State;
}) {
  const urlString = util.format(
    resourceTypeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    resourceTypeUuid
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
