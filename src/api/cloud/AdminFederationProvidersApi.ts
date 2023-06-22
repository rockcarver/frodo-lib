import util from 'util';
import { generateAmApi } from '../BaseApi';
import { deleteDeepByKey, getRealmPath } from '../utils/ApiUtils';
import * as state from '../../shared/State';

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
export async function getAdminFederationProviderTypes() {
  const urlString = util.format(
    getAllProviderTypesURLTemplate,
    state.getHost(),
    getRealmPath('/')
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get admin federation providers by type
 * @param {String} type admin federation provider type
 * @returns {Promise} a promise that resolves to an object containing an array of admin federation providers of the requested type
 */
export async function getAdminFederationProvidersByType(type) {
  const urlString = util.format(
    getProvidersByTypeURLTemplate,
    state.getHost(),
    getRealmPath('/'),
    type
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get all admin federation providers
 * @returns {Promise} a promise that resolves to an object containing an array of admin federation providers
 */
export async function getAdminFederationProviders() {
  const urlString = util.format(
    getAllProvidersURLTemplate,
    state.getHost(),
    getRealmPath('/')
  );
  const { data } = await generateAmApi(getApiConfig()).post(
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
 * @returns {Promise} a promise that resolves to an object containing a admin federation provider
 */
export async function getProviderByTypeAndId(type, id) {
  const urlString = util.format(
    providerByTypeAndIdURLTemplate,
    state.getHost(),
    getRealmPath('/'),
    type,
    id
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get admin federation provider by type and id
 * @param {String} type admin federation provider type
 * @param {String} id admin federation provider id/name
 * @param {Object} providerData a admin federation provider object
 * @returns {Promise} a promise that resolves to an object containing a admin federation provider
 */
export async function putProviderByTypeAndId(type, id, providerData) {
  // until we figure out a way to use transport keys in Frodo,
  // we'll have to drop those encrypted attributes.
  const cleanData = deleteDeepByKey(providerData, '-encrypted');
  const urlString = util.format(
    providerByTypeAndIdURLTemplate,
    state.getHost(),
    getRealmPath('/'),
    type,
    id
  );
  const { data } = await generateAmApi(getApiConfig()).put(
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
 * @returns {Promise<unknown>} a promise that resolves to a admin federation provider
 */
export async function deleteProviderByTypeAndId(
  type: string,
  providerId: string
) {
  const urlString = util.format(
    providerByTypeAndIdURLTemplate,
    state.getHost(),
    getRealmPath('/'),
    type,
    providerId
  );
  const { data } = await generateAmApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
