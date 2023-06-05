import util from 'util';
import State from '../shared/State';
import { AmServiceSkeleton, PagedResult } from './ApiTypes';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from './utils/ApiUtils';

const serviceURLTemplate = '%s/json%s/%s/services/%s';
const serviceURLNextDescendentsTemplate =
  '%s/json%s/%s/services/%s?_action=nextdescendents';
const serviceURLNextDescendentTemplate = '%s/json%s/%s/services/%s/%s/%s';
const serviceListURLTemplate = '%s/json%s/%s/services?_queryFilter=true';
const apiVersion = 'protocol=2.0,resource=1.0';

function getApiConfig() {
  return {
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
function getRealmPath(globalConfig: boolean, state: State): string {
  if (globalConfig) return '';
  return getCurrentRealmPath(state);
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
export async function getListOfServices({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}): Promise<PagedResult<ServiceListItem>> {
  const urlString = util.format(
    serviceListURLTemplate,
    state.getHost(),
    getRealmPath(globalConfig, state),
    getConfigPath(globalConfig)
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get<
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
export async function getService({
  serviceId,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  globalConfig?: boolean;
  state: State;
}): Promise<AmServiceSkeleton> {
  const urlString = util.format(
    serviceURLTemplate,
    state.getHost(),
    getRealmPath(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).get<AmServiceSkeleton>(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get a service's decendents (applicable for structured services only, e.g. SocialIdentityProviders)
 * @param {string} serviceId service id
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<ServiceNextDescendent[]>} a promise resolving to an array of the service's next decendents
 */
export async function getServiceDescendents({
  serviceId,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  globalConfig?: boolean;
  state: State;
}): Promise<ServiceNextDescendent[]> {
  const urlString = util.format(
    serviceURLNextDescendentsTemplate,
    state.getHost(),
    getRealmPath(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).post<ServiceNextDescendentResponse>(urlString, {
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
export async function putService({
  serviceId,
  serviceData,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  serviceData: AmServiceSkeleton;
  globalConfig?: boolean;
  state: State;
}): Promise<AmServiceSkeleton> {
  const urlString = util.format(
    serviceURLTemplate,
    state.getHost(),
    getRealmPath(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
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
export async function putServiceNextDescendent({
  serviceId,
  serviceType,
  serviceNextDescendentId,
  serviceNextDescendentData,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  serviceType: string;
  serviceNextDescendentId: string;
  serviceNextDescendentData: ServiceNextDescendent;
  globalConfig?: boolean;
  state: State;
}): Promise<ServiceNextDescendent> {
  const urlString = util.format(
    serviceURLNextDescendentTemplate,
    state.getHost(),
    getRealmPath(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId,
    serviceType,
    serviceNextDescendentId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
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
export async function deleteService({
  serviceId,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  globalConfig?: boolean;
  state: State;
}): Promise<AmServiceSkeleton> {
  const urlString = util.format(
    serviceURLTemplate,
    state.getHost(),
    getRealmPath(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
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
export async function deleteServiceNextDescendent({
  serviceId,
  serviceType,
  serviceNextDescendentId,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  serviceType: string;
  serviceNextDescendentId: string;
  globalConfig?: boolean;
  state: State;
}): Promise<ServiceNextDescendent> {
  const urlString = util.format(
    serviceURLNextDescendentTemplate,
    state.getHost(),
    getRealmPath(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId,
    serviceType,
    serviceNextDescendentId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
