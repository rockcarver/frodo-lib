import util from 'util';

import { State } from '../shared/State';
import { getConfigPath, getRealmPathGlobal } from '../utils/ForgeRockUtils';
import { AmConfigEntityInterface, PagedResult } from './ApiTypes';
import { generateAmApi } from './BaseApi';

const secretStoreURLTemplate = '%s/json%s/%s/secrets/stores/%s/%s';
const secretStoreSchemaURLTemplate =
  '%s/json%s/%s/secrets/stores/%s?_action=schema';
const secretStoresURLTemplate =
  '%s/json%s/%s/secrets/stores?_action=nextdescendents';
const secretStoreMappingURLTemplate = secretStoreURLTemplate + '/mappings/%s';
const createSecretStoreMappingURLTemplate =
  secretStoreURLTemplate + '/mappings?_action=create';
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

export type SecretStoreSkeleton =
  | KeyStoreSecretStoreSkeleton
  | HsmSecretStoreSkeleton
  | FileSystemSecretStoreSkeleton
  | GoogleKeyManagementServiceSecretStoreSkeleton
  | GoogleSecretManagerSecretStoreProviderSkeleton
  | EnvironmentAndSystemPropertySecretStoreSkeleton;

export type SecretStoreMappingSkeleton = AmConfigEntityInterface & {
  secretId: string;
  aliases: string[];
};

export type SecretStoreSchemaSkeleton = {
  type: string;
  properties: Record<
    string,
    {
      title: string;
      description: string;
      propertyOrder: number;
      required: boolean;
      type: string;
      exampleValue: string;
    }
  >;
};

export type KeyStoreSecretStoreSkeleton = AmConfigEntityInterface & {
  storePassword: string;
  file: string;
  leaseExpiryDuration: number;
  providerName: string;
  storetype: string;
  keyEntryPassword: string;
};

export type HsmSecretStoreSkeleton = AmConfigEntityInterface & {
  file: string;
  leaseExpiryDuration: number;
  storePassword: string;
  providerGuiceKey: string;
};

export type FileSystemSecretStoreSkeleton = AmConfigEntityInterface & {
  suffix: string;
  versionSuffix: string;
  directory: string;
  format: string;
};

export type GoogleKeyManagementServiceSecretStoreSkeleton =
  AmConfigEntityInterface & {
    publicKeyCacheMaxSize: number;
    keyRing: string;
    publicKeyCacheDuration: number;
    project: string;
    location: string;
  };

export type GoogleSecretManagerSecretStoreProviderSkeleton =
  AmConfigEntityInterface & {
    expiryDurationSeconds: number;
    secretFormat: string;
    project: string;
    serviceAccount: string;
  };

export type EnvironmentAndSystemPropertySecretStoreSkeleton =
  AmConfigEntityInterface & {
    format: string;
  };

/**
 * Get secret store
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreSkeleton>} a promise that resolves to an array of secret store mapping objects
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
}): Promise<SecretStoreSkeleton> {
  const urlString = util.format(
    secretStoreURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    secretStoreTypeId,
    secretTypesThatIgnoreId.includes(secretStoreTypeId) ? '' : secretStoreId
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
 * Get secret store schema
 * @param {string} secretStoreTypeId Secret store type id
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreSchemaSkeleton>} a promise that resolves to a secret store schema object
 */
export async function getSecretStoreSchema({
  secretStoreTypeId,
  globalConfig = false,
  state,
}: {
  secretStoreTypeId: string;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreSchemaSkeleton> {
  const urlString = util.format(
    secretStoreSchemaURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    secretStoreTypeId
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
 * Get secret store mapping
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {string} secretId Secret store mapping label
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to an array of secret store mapping objects
 */
export async function getSecretStoreMapping({
  secretStoreId,
  secretStoreTypeId,
  secretId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string;
  secretId: string;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreMappingSkeleton> {
  const urlString = util.format(
    secretStoreMappingURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    secretStoreTypeId,
    secretTypesThatIgnoreId.includes(secretStoreTypeId) ? '' : secretStoreId,
    secretId
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
 * Get secret store mappings
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<PagedResult<SecretStoreMappingSkeleton>>} a promise that resolves to an array of secret store mapping objects
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
    secretTypesThatIgnoreId.includes(secretStoreTypeId) ? '' : secretStoreId
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
 * Create secret store mapping
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {SecretStoreMappingSkeleton} secretStoreMappingData The secret store mapping data,
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to a secret store mapping object of the mapping created
 */
export async function createSecretStoreMapping({
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
    createSecretStoreMappingURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    secretStoreTypeId,
    secretTypesThatIgnoreId.includes(secretStoreTypeId) ? '' : secretStoreId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).post(urlString, secretStoreMappingData, {
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
    secretTypesThatIgnoreId.includes(secretStoreTypeId) ? '' : secretStoreId,
    secretStoreMappingData.secretId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).put(urlString, secretStoreMappingData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete secret store by id
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreSkeleton>} a promise that resolves to a secret store object
 */
export async function deleteSecretStore({
  secretStoreId,
  secretStoreTypeId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreSkeleton> {
  const urlString = util.format(
    secretStoreURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    secretStoreTypeId,
    secretTypesThatIgnoreId.includes(secretStoreTypeId) ? '' : secretStoreId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete secret store mapping
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {string} secretId Secret store mapping label
 * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to a secret store mapping object
 */
export async function deleteSecretStoreMapping({
  secretStoreId,
  secretStoreTypeId,
  secretId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string;
  secretId: string;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreMappingSkeleton> {
  const urlString = util.format(
    secretStoreMappingURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig),
    secretStoreTypeId,
    secretTypesThatIgnoreId.includes(secretStoreTypeId) ? '' : secretStoreId,
    secretId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
