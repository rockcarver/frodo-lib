import util from 'util';
import * as state from '../shared/State';
import { AmServiceSkeleton, PagedResult } from './ApiTypes';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from './utils/ApiUtils';

export const serviceURLTemplate = '%s/json%s/%s/services/%s';
const serviceURLNextDescendentsTemplate =
  '%s/json%s/%s/services/%s?_action=nextdescendents';
export const serviceURLNextDescendentTemplate =
  '%s/json%s/%s/services/%s/%s/%s';
const serviceListURLTemplate = '%s/json%s/%s/services?_queryFilter=true';
const apiVersion = 'protocol=2.0,resource=1.0';

function getApiConfig() {
  const configPath = getCurrentRealmPath();
  return {
    path: `${configPath}/realm-config/services`,
    apiVersion,
  };
}

export interface ServiceListItem {
  /**
   * The identifier for the service - used to construct the subpath for the service
   */
  _id: string;
  /**
   * The user-facing name of the service
   */
  name: string;
  /**
   * The revision number of the service
   */
  _rev: string;
}

// export interface AmService {
//   _id: '';
//   _rev: string;
//   _type: {
//     _id: string;
//     name: string;
//     collection: boolean;
//   };
//   [key: string]: any;
// }

export interface ServiceNextDescendentResponse {
  result: ServiceNextDescendent;
}

export interface ServiceNextDescendent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Helper function to get the realm path required for the API call considering if the request
 * should obtain the realm config or the global config of the service in question
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise.
 * @returns {string} The realm path to be used for the request
 */
function getRealmPath(globalConfig: boolean): string {
  if (globalConfig) return '';
  return getCurrentRealmPath();
}

/**
 * Helper function to get the config path required for the API call considering if the request
 * should obtain the realm config or the global config of the service in question
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise.
 * @returns {string} The config path to be used for the request
 */
function getConfigPath(globalConfig: boolean): string {
  if (globalConfig) return 'global-config';
  return 'realm-config';
}

/**
 * Get a list of services
 * @param {boolean} globalConfig true if the global list of services is requested, false otherwise. Default: false.
 * @returns {Promise<ServiceListItem[]>} a promise resolving to an array of service list items.
 */
export async function getListOfServices(
  globalConfig = false
): Promise<PagedResult<ServiceListItem>> {
  const urlString = util.format(
    serviceListURLTemplate,
    state.getHost(),
    getRealmPath(globalConfig),
    getConfigPath(globalConfig)
  );
  const { data } = await generateAmApi(getApiConfig()).get<
    PagedResult<ServiceListItem>
  >(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get service
 * @param {string} serviceId servide id
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AmService>} a promise resolving to a service object
 */
export async function getService(
  serviceId: string,
  globalConfig = false
): Promise<AmServiceSkeleton> {
  const urlString = util.format(
    serviceURLTemplate,
    state.getHost(),
    getRealmPath(globalConfig),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi(getApiConfig()).get<AmServiceSkeleton>(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get a service's decendents (applicable for structured services only, e.g. SocialIdentityProviders)
 * @param {string} serviceId service id
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<ServiceNextDescendent[]>} a promise resolving to an array of the service's next decendents
 */
export async function getServiceDescendents(
  serviceId: string,
  globalConfig = false
): Promise<ServiceNextDescendent[]> {
  const urlString = util.format(
    serviceURLNextDescendentsTemplate,
    state.getHost(),
    getRealmPath(globalConfig),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi(
    getApiConfig()
  ).post<ServiceNextDescendentResponse>(urlString, {
    withCredentials: true,
  });
  return data.result as ServiceNextDescendent[];
}

/**
 * Create or update a service
 * @param {string} serviceId service id
 * @param {AmService} serviceData service configuration
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AmService>} a promise resolving to a service object
 */
export async function putService(
  serviceId: string,
  serviceData: AmServiceSkeleton,
  globalConfig = false
): Promise<AmServiceSkeleton> {
  const urlString = util.format(
    serviceURLTemplate,
    state.getHost(),
    getRealmPath(globalConfig),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi(getApiConfig()).put(
    urlString,
    serviceData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Create or update a service next descendent instance
 * @param {string} serviceId service id
 * @param {string} serviceType service type
 * @param {string} serviceNextDescendentId service instance id
 * @param {ServiceNextDescendent} serviceNextDescendentData service next descendent configuration
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<ServiceNextDescendent>} a promise resolving to a service next descendent
 */
export async function putServiceNextDescendent(
  serviceId: string,
  serviceType: string,
  serviceNextDescendentId: string,
  serviceNextDescendentData: ServiceNextDescendent,
  globalConfig = false
): Promise<ServiceNextDescendent> {
  const urlString = util.format(
    serviceURLNextDescendentTemplate,
    state.getHost(),
    getRealmPath(globalConfig),
    getConfigPath(globalConfig),
    serviceId,
    serviceType,
    serviceNextDescendentId
  );
  const { data } = await generateAmApi(getApiConfig()).put(
    urlString,
    serviceNextDescendentData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete service
 * @param {string} serviceId service id
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AmService>} a promise resolving to a service object
 */
export async function deleteService(
  serviceId: string,
  globalConfig = false
): Promise<AmServiceSkeleton> {
  const urlString = util.format(
    serviceURLTemplate,
    state.getHost(),
    getRealmPath(globalConfig),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete service next descendent
 * @param {string} serviceId service id
 * @param {string} serviceType service type
 * @param {string} serviceNextDescendentId service instance id
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<ServiceNextDescendent>} a promise resolving to a service next descendent
 */
export async function deleteServiceNextDescendent(
  serviceId: string,
  serviceType: string,
  serviceNextDescendentId: string,
  globalConfig = false
): Promise<ServiceNextDescendent> {
  const urlString = util.format(
    serviceURLNextDescendentTemplate,
    state.getHost(),
    getRealmPath(globalConfig),
    getConfigPath(globalConfig),
    serviceId,
    serviceType,
    serviceNextDescendentId
  );
  const { data } = await generateAmApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
