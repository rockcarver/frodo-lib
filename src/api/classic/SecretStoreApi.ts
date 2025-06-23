import util from 'util';

import { State } from '../../shared/State';
import { getConfigPath, getRealmPathGlobal } from '../../utils/ForgeRockUtils';
import {
  AmConfigEntityInterface,
  IdObjectSkeletonInterface,
  PagedResult,
} from '../ApiTypes';
import { generateAmApi } from '../BaseApi';

const secretStoreURLTemplate = '%s/json%s/%s/secrets/stores/%s/%s';
const secretStoresURLTemplate =
  '%s/json%s/%s/secrets/stores?_action=nextdescendents';
const secretStoreMappingURLTemplate = secretStoreURLTemplate + '/mappings/%s';
const secretStoreMappingsURLTemplate =
  secretStoreURLTemplate + '/mappings?_queryFilter=true';

const secretTypesThatIgnoreId = ['EnvironmentAndSystemPropertySecretStore'];

const apiVersion = 'protocol=2.1,resource=%s';
const globalVersion = '1.0';
const realmVersion = '2.0';
const getApiConfig = (globalConfig) => {
  return {
    apiVersion: util.format(
      apiVersion,
      globalConfig ? globalVersion : realmVersion
    ),
  };
};

export type SecretStoreSkeleton = AmConfigEntityInterface;

export type SecretStoreMappingSkeleton = IdObjectSkeletonInterface & {
  secretId: string;
  aliases: string[];
};

/**
 * Get secret store
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to an array of secret store mapping objects
 */
export async function getSecretStore({
  secretStoreId,
  secretStoreTypeId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string;
  globalConfig: boolean;
  state: State;
}): Promise<PagedResult<SecretStoreMappingSkeleton>> {
  const urlString = util.format(
    secretStoreURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    secretStoreTypeId,
    secretStoreId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get all secret stores
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<PagedResult<SecretStoreSkeleton>>} a promise that resolves to an array of secret store objects
 */
export async function getSecretStores({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}): Promise<PagedResult<SecretStoreSkeleton>> {
  const urlString = util.format(
    secretStoresURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).post(urlString, undefined, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get secret store mappings
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreMappingSkeleton[]>} a promise that resolves to an array of secret store mapping objects
 */
export async function getSecretStoreMappings({
  secretStoreId,
  secretStoreTypeId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string;
  globalConfig: boolean;
  state: State;
}): Promise<PagedResult<SecretStoreMappingSkeleton>> {
  const urlString = util.format(
    secretStoreMappingsURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    secretStoreTypeId,
    secretStoreId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put secret store
 * @param {SecretStoreSkeleton} secretStoreData secret store to import
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreSkeleton>} a promise that resolves to a secret store object
 */
export async function putSecretStore({
  secretStoreData,
  globalConfig = false,
  state,
}: {
  secretStoreData: SecretStoreSkeleton;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreSkeleton> {
  const urlString = util.format(
    secretStoreURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    secretStoreData._type._id,
    secretTypesThatIgnoreId.includes(secretStoreData._type._id)
      ? ''
      : secretStoreData._id
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).put(urlString, secretStoreData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put secret store mapping
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {SecretStoreMappingSkeleton} secretStoreMappingData secret store mapping to import
 * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to a secret store mapping object
 */
export async function putSecretStoreMapping({
  secretStoreId,
  secretStoreTypeId,
  secretStoreMappingData,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string;
  secretStoreMappingData: SecretStoreMappingSkeleton;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreMappingSkeleton> {
  const urlString = util.format(
    secretStoreMappingURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    secretStoreTypeId,
    secretStoreId,
    secretStoreMappingData._id
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).put(urlString, secretStoreMappingData, {
    withCredentials: true,
  });
  return data;
}
