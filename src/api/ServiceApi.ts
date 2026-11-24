import util from 'util';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { getConfigPath, getRealmPathGlobal } from '../utils/ForgeRockUtils';
import { AmConfigEntityInterface, PagedResult } from './ApiTypes';
import { generateAmApi } from './BaseApi';

const serviceURLTemplate = '%s/json%s/%s/services/%s';
const serviceURLNextDescendentsTemplate =
  '%s/json%s/%s/services/%s?_action=nextdescendents';
const serviceURLNextDescendentTemplate = '%s/json%s/%s/services/%s/%s/%s';
//Use _action=nextdescendents since it works on all deployments
const serviceListURLTemplate = '%s/json%s/%s/services?_action=nextdescendents';
const apiVersion = 'protocol=2.0,resource=%s';
const globalVersion = '1.0';
const realmVersion = '1.0';

/**
 * True for a value that cannot be one segment of a request path that names an object: not a string, blank, `.` or `..`.
 * Encoding does not help here: `.` and `..` encode to themselves and are resolved to the parent or to the collection.
 */
function isUnusablePathSegment(segment: unknown): boolean {
  return (
    typeof segment !== 'string' ||
    segment.trim() === '' ||
    segment === '.' ||
    segment === '..'
  );
}

const getApiConfig = (globalConfig: boolean) => {
  return {
    apiVersion: util.format(
      apiVersion,
      globalConfig ? globalVersion : realmVersion
    ),
  };
};

export type AmServiceSkeleton = AmConfigEntityInterface & {
  [key: string]: any;
};

export interface ServiceNextDescendentResponse {
  result: ServiceNextDescendent;
}

export interface ServiceNextDescendent {
  [key: string]: any;
}

export interface FullService extends AmServiceSkeleton {
  nextDescendents?: ServiceNextDescendent[];
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
}): Promise<PagedResult<AmServiceSkeleton>> {
  const urlString = util.format(
    serviceListURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).post<PagedResult<AmServiceSkeleton>>(urlString, undefined, {
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
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
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
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).post<ServiceNextDescendentResponse>(urlString, undefined, {
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
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).put(urlString, serviceData, {
    withCredentials: true,
    headers: serviceId.startsWith('federation/') ? { 'If-Match': '*' } : {},
  });
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
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId,
    serviceType,
    serviceNextDescendentId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).put(urlString, serviceNextDescendentData, {
    withCredentials: true,
    headers: serviceId.startsWith('federation/') ? { 'If-Match': '*' } : {},
  });
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
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete service next descendent
 *
 * The service type and the instance id are two segments of the request path and are encoded, so that an id with `#`,
 * `?`, `/` or `%` names the object it says and no other. An id that is blank, `.` or `..` cannot be encoded to
 * anything that names an object (the path would be resolved to its parent or to the collection): the function throws
 * and sends no request.
 * @param {string} serviceId service id
 * @param {string} serviceType service type
 * @param {string} serviceNextDescendentId service instance id
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<ServiceNextDescendent>} a promise resolving to a service next descendent
 * @throws {Error} if the service type or the instance id is blank, `.` or `..`
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
  for (const [what, segment] of [
    ['service type', serviceType],
    ['service instance id', serviceNextDescendentId],
  ]) {
    if (isUnusablePathSegment(segment)) {
      throw new Error(
        `Cannot delete a service next descendent: the ${what} '${segment}' cannot be used in a request path`
      );
    }
  }
  const urlString = util.format(
    serviceURLNextDescendentTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    serviceId,
    encodeURIComponent(serviceType),
    encodeURIComponent(serviceNextDescendentId)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
