import util from 'util';
import storage from '../storage/SessionStorage';
import { AmServiceSkeleton, PagedResult } from './ApiTypes';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from './utils/ApiUtils';

const serviceURLTemplate = '%s/json%s/realm-config/services/%s';
const serviceURLNextDescendentsTemplate =
  '%s/json%s/realm-config/services/%s?_action=nextdescendents';
const serviceURLNextDescendentTemplate =
  '%s/json%s/realm-config/services/%s/%s/%s';
const serviceListURLTemplate =
  '%s/json%s/realm-config/services?_queryFilter=true';
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
 * Get a list of services
 * @returns {Promise<ServiceListItem[]>} a promise resolving to an array of service list items.
 */
export async function getListOfServices(): Promise<
  PagedResult<ServiceListItem>
> {
  const urlString = util.format(
    serviceListURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath()
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
 * @returns {Promise<AmService>} a promise resolving to a service object
 */
export async function getService(
  serviceId: string
): Promise<AmServiceSkeleton> {
  const urlString = util.format(
    serviceURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
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
 * @returns {Promise<ServiceNextDescendent[]>} a promise resolving to an array of the service's next decendents
 */
export async function getServiceDescendents(
  serviceId: string
): Promise<ServiceNextDescendent[]> {
  const urlString = util.format(
    serviceURLNextDescendentsTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
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
 * @returns {Promise<AmService>} a promise resolving to a service object
 */
export async function putService(
  serviceId: string,
  serviceData: AmServiceSkeleton
): Promise<AmServiceSkeleton> {
  const urlString = util.format(
    serviceURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
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
 * @returns {Promise<ServiceNextDescendent>} a promise resolving to a service next descendent
 */
export async function putServiceNextDescendent(
  serviceId: string,
  serviceType: string,
  serviceNextDescendentId: string,
  serviceNextDescendentData: ServiceNextDescendent
): Promise<ServiceNextDescendent> {
  const urlString = util.format(
    serviceURLNextDescendentTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
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
 * @returns {Promise<AmService>} a promise resolving to a service object
 */
export async function deleteService(
  serviceId: string
): Promise<AmServiceSkeleton> {
  const urlString = util.format(
    serviceURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
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
 * @returns {Promise<ServiceNextDescendent>} a promise resolving to a service next descendent
 */
export async function deleteServiceNextDescendent(
  serviceId: string,
  serviceType: string,
  serviceNextDescendentId: string
): Promise<ServiceNextDescendent> {
  const urlString = util.format(
    serviceURLNextDescendentTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    serviceId,
    serviceType,
    serviceNextDescendentId
  );
  const { data } = await generateAmApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
