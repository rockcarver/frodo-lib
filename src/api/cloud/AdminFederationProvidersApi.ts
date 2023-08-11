import util from 'util';
import { generateAmApi } from '../BaseApi';
import { getRealmPath } from '../../utils/ForgeRockUtils';
import { deleteDeepByKey } from '../../utils/JsonUtils';
import { State } from '../../shared/State';
import { AmServiceType, PagedResult } from '../ApiTypes';
import { SocialIdpSkeleton } from '../SocialIdentityProvidersApi';

const getAllProviderTypesURLTemplate =
  '%s/json%s/realm-config/services/SocialIdentityProviders?_action=getAllTypes';
const providerByTypeAndIdURLTemplate =
  '%s/json%s/realm-config/services/SocialIdentityProviders/%s/%s';
const getAllProvidersURLTemplate =
  '%s/json%s/realm-config/services/SocialIdentityProviders?_action=nextdescendents';
const getProvidersByTypeURLTemplate =
  '%s/json%s/realm-config/services/SocialIdentityProviders/%s?_queryFilter=true';
const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  const configPath = getRealmPath('/');
  return {
    path: `${configPath}/realm-config/services/SocialIdentityProviders`,
    apiVersion,
  };
};

/**
 * Get admin federation provider types
 * @returns {Promise} a promise that resolves to an object containing an array of admin federation provider types
 */
export async function getAdminFederationProviderTypes({
  state,
}: {
  state: State;
}): Promise<PagedResult<AmServiceType>> {
  const urlString = util.format(
    getAllProviderTypesURLTemplate,
    state.getHost(),
    getRealmPath('/')
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
 * Get admin federation providers by type
 * @param {String} providerType admin federation provider type
 * @returns {Promise<PagedResult<SocialIdpSkeleton>>} a promise that resolves to an object containing an array of admin federation providers of the requested type
 */
export async function getAdminFederationProvidersByType({
  providerType,
  state,
}: {
  providerType: string;
  state: State;
}): Promise<PagedResult<SocialIdpSkeleton>> {
  const urlString = util.format(
    getProvidersByTypeURLTemplate,
    state.getHost(),
    getRealmPath('/'),
    providerType
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
 * Get all admin federation providers
 * @returns {Promise<PagedResult<SocialIdpSkeleton>>} a promise that resolves to an object containing an array of admin federation providers
 */
export async function getAdminFederationProviders({
  state,
}: {
  state: State;
}): Promise<PagedResult<SocialIdpSkeleton>> {
  const urlString = util.format(
    getAllProvidersURLTemplate,
    state.getHost(),
    getRealmPath('/')
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).post(
    urlString,
    {},
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get admin federation provider by type and id
 * @param {*} type admin federation provider type
 * @param {*} id admin federation provider id/name
 * @returns {Promise<SocialIdpSkeleton>} a promise that resolves to an object containing a admin federation provider
 */
export async function getProviderByTypeAndId({
  providerType,
  providerId,
  state,
}: {
  providerType: string;
  providerId: string;
  state: State;
}): Promise<SocialIdpSkeleton> {
  const urlString = util.format(
    providerByTypeAndIdURLTemplate,
    state.getHost(),
    getRealmPath('/'),
    providerType,
    providerId
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
 * Get admin federation provider by type and id
 * @param {String} providerType admin federation provider type
 * @param {String} providerId admin federation provider id/name
 * @param {Object} providerData a admin federation provider object
 * @returns {Promise<SocialIdpSkeleton>} a promise that resolves to an object containing a admin federation provider
 */
export async function putProviderByTypeAndId({
  providerType,
  providerId,
  providerData,
  state,
}: {
  providerType: string;
  providerId: string;
  providerData: SocialIdpSkeleton;
  state: State;
}): Promise<SocialIdpSkeleton> {
  // until we figure out a way to use transport keys in Frodo,
  // we'll have to drop those encrypted attributes.
  const cleanData = deleteDeepByKey(providerData, '-encrypted');
  const urlString = util.format(
    providerByTypeAndIdURLTemplate,
    state.getHost(),
    getRealmPath('/'),
    providerType,
    providerId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    cleanData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete admin federation provider by type and id
 * @param {string} providerId provider type
 * @param {string} providerId provider id
 * @returns {Promise<SocialIdpSkeleton>} a promise that resolves to a admin federation provider
 */
export async function deleteProviderByTypeAndId({
  providerType,
  providerId,
  state,
}: {
  providerType: string;
  providerId: string;
  state: State;
}): Promise<SocialIdpSkeleton> {
  const urlString = util.format(
    providerByTypeAndIdURLTemplate,
    state.getHost(),
    getRealmPath('/'),
    providerType,
    providerId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
