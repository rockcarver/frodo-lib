import util from 'util';
import { getCurrentRealmPath } from './utils/ApiUtils';
import { generateAmApi } from './BaseApi';
import * as state from '../shared/State';

const queryAllResourceTypesURLTemplate =
  '%s/json%s/resourcetypes?_sortKeys=name&_queryFilter=name+eq+%22%5E(%3F!Delegation%20Service%24).*%22';
const queryResourceTypeByNameURLTemplate =
  '%s/json%s/resourcetypes?_sortKeys=name&_queryFilter=name+eq+%22%s%22+AND+name+eq+%22%5E(%3F!Delegation%20Service%24).*%22';
const resourceTypeURLTemplate = '%s/json%s/resourcetypes/%s';

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
export async function getResourceTypes() {
  const urlString = util.format(
    queryAllResourceTypesURLTemplate,
    state.getHost(),
    getCurrentRealmPath()
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get resource type by uuid
 * @param {String} resourceTypeId resource type uuid
 * @returns {Promise} a promise that resolves to a node object
 */
export async function getResourceType(resourceTypeId: string) {
  const urlString = util.format(
    resourceTypeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    resourceTypeId
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get resource type by name
 * @param {string} resourceTypeName resource type name
 * @returns {Promise} a promise that resolves to a node object
 */
export async function getResourceTypeByName(resourceTypeName: string) {
  const urlString = util.format(
    queryResourceTypeByNameURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    resourceTypeName
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create/update resource type
 * @param {String} resourceTypeId resource type uuid
 * @param {Object} resourceTypeData resource type object
 * @returns {Promise} a promise that resolves to a resource type object
 */
export async function putResourceType(
  resourceTypeId: string,
  resourceTypeData
) {
  const urlString = util.format(
    resourceTypeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    resourceTypeId
  );
  const { data } = await generateAmApi(getApiConfig()).put(
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
 * @param {String} resourceTypeId resource type uuid
 * @returns {Promise} a promise that resolves to an object containing a resource type object
 */
export async function deleteResourceType(resourceTypeId: string) {
  const urlString = util.format(
    resourceTypeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    resourceTypeId
  );
  const { data } = await generateAmApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
