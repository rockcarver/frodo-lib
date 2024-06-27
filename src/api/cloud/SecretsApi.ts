import util from 'util';

import { State } from '../../shared/State';
import { getHostBaseUrl } from '../../utils/ForgeRockUtils';
import { IdObjectSkeletonInterface, PagedResult } from '../ApiTypes';
import { generateEnvApi } from '../BaseApi';

const secretsListURLTemplate = '%s/environment/secrets';
const secretListVersionsURLTemplate = '%s/environment/secrets/%s/versions';
const secretCreateNewVersionURLTemplate = `${secretListVersionsURLTemplate}?_action=create`;
const secretGetVersionURLTemplate = `${secretListVersionsURLTemplate}/%s`;
const secretVersionStatusURLTemplate = `${secretGetVersionURLTemplate}?_action=changestatus`;
const secretURLTemplate = '%s/environment/secrets/%s';
const secretSetDescriptionURLTemplate = `${secretURLTemplate}?_action=setDescription`;

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => ({
  path: `/environment/secrets`,
  apiVersion,
});

/**
 * Secret encoding
 *
 * @summary
 * You can use the encoding parameter to set an encoding format when you create an ESV secret.
 * You can only choose an encoding format using the API. The UI currently creates secrets only
 * with the generic encoding format.
 *
 * @see
 * {@link https://backstage.forgerock.com/docs/idcloud/latest/tenants/esvs.html#encoding_format | ForgeRock Documentation}
 */
export type SecretEncodingType = 'generic' | 'pem' | 'base64hmac' | 'base64aes';

/**
 * Secret object skeleton
 */
export type SecretSkeleton = IdObjectSkeletonInterface & {
  description: string;
  encoding: SecretEncodingType;
  lastChangedBy?: string;
  lastChangeDate?: string;
  useInPlaceholders: boolean;
  loaded?: boolean;
  loadedVersion?: string;
  activeVersion?: string;
  activeValue?: any;
};

export type VersionOfSecretStatus = 'DISABLED' | 'ENABLED' | 'DESTROYED';

/**
 * Secret version skeleton
 */
export type VersionOfSecretSkeleton = IdObjectSkeletonInterface & {
  /**
   * Base64-encoded value. Only used when creating a new version of a secret
   */
  valueBase64?: string;
  /**
   * Version string. Returned when reading a version of a secret
   */
  version?: string;
  /**
   * Date string. Returned when reading a version of a secret
   */
  createDate?: string;
  /**
   * True if loaded, false otherwise. Returned when reading a version of a secret
   */
  loaded?: boolean;
  /**
   * Status string. Returned when reading a version of a secret
   */
  status?: VersionOfSecretStatus;
};

/**
 * Get all secrets
 * @returns {Promise<PagedResult<SecretSkeleton>>} a promise that resolves to an array of secrets
 */
export async function getSecrets({
  state,
}: {
  state: State;
}): Promise<PagedResult<SecretSkeleton>> {
  const urlString = util.format(
    secretsListURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get secret
 * @param secretId secret id/name
 * @returns {Promise<SecretSkeleton>} a promise that resolves to a secret
 */
export async function getSecret({
  secretId,
  state,
}: {
  secretId: string;
  state: State;
}): Promise<SecretSkeleton> {
  const urlString = util.format(
    secretURLTemplate,
    getHostBaseUrl(state.getHost()),
    secretId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create secret
 * @param {string} secretId secret id/name
 * @param {string} value secret value
 * @param {string} description secret description
 * @param {string} encoding secret encoding (only `generic` is supported)
 * @param {boolean} useInPlaceholders flag indicating if the secret can be used in placeholders
 * @returns {Promise<SecretSkeleton>} a promise that resolves to a secret
 */
export async function putSecret({
  secretId,
  value,
  description,
  encoding = 'generic',
  useInPlaceholders = true,
  state,
}: {
  secretId: string;
  value: string;
  description: string;
  encoding?: string;
  useInPlaceholders?: boolean;
  state: State;
}): Promise<SecretSkeleton> {
  const secretData = {
    valueBase64: value,
    description,
    encoding,
    useInPlaceholders,
  };
  const urlString = util.format(
    secretURLTemplate,
    getHostBaseUrl(state.getHost()),
    secretId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, secretData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Set secret description
 * @param {string} secretId secret id/name
 * @param {string} description secret description
 * @returns {Promise<any>} a promise that resolves to an empty string
 */
export async function setSecretDescription({
  secretId,
  description,
  state,
}: {
  secretId: string;
  description: string;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    secretSetDescriptionURLTemplate,
    getHostBaseUrl(state.getHost()),
    secretId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, { description }, { withCredentials: true });
  return data;
}

/**
 * Delete secret
 * @param {string} secretId secret id/name
 * @returns {Promise<unknown>} a promise that resolves to a secret object
 */
export async function deleteSecret({
  secretId,
  state,
}: {
  secretId: string;
  state: State;
}) {
  const urlString = util.format(
    secretURLTemplate,
    getHostBaseUrl(state.getHost()),
    secretId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get secret versions
 * @param {string} secretId secret id/name
 * @returns {Promise<VersionOfSecretSkeleton[]>} a promise that resolves to an array of secret versions
 */
export async function getSecretVersions({
  secretId,
  state,
}: {
  secretId: string;
  state: State;
}): Promise<VersionOfSecretSkeleton[]> {
  const urlString = util.format(
    secretListVersionsURLTemplate,
    getHostBaseUrl(state.getHost()),
    secretId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create new secret version
 * @param {string} secretId secret id/name
 * @param {string} value secret value
 * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a version object
 */
export async function createNewVersionOfSecret({
  secretId,
  value,
  state,
}: {
  secretId: string;
  value: string;
  state: State;
}): Promise<VersionOfSecretSkeleton> {
  const urlString = util.format(
    secretCreateNewVersionURLTemplate,
    getHostBaseUrl(state.getHost()),
    secretId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, { valueBase64: value }, { withCredentials: true });
  return data;
}

/**
 * Get version of secret
 * @param {string} secretId secret id/name
 * @param {string} version secret version
 * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a version object
 */
export async function getVersionOfSecret({
  secretId,
  version,
  state,
}: {
  secretId: string;
  version: string;
  state: State;
}): Promise<VersionOfSecretSkeleton> {
  const urlString = util.format(
    secretGetVersionURLTemplate,
    getHostBaseUrl(state.getHost()),
    secretId,
    version
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Update the status of a version of a secret
 * @param {string} secretId secret id/name
 * @param {string} version secret version
 * @param {VersionOfSecretStatus} status status
 * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a status object
 */
export async function setStatusOfVersionOfSecret({
  secretId,
  version,
  status,
  state,
}: {
  secretId: string;
  version: string;
  status: VersionOfSecretStatus;
  state: State;
}): Promise<VersionOfSecretSkeleton> {
  const urlString = util.format(
    secretVersionStatusURLTemplate,
    getHostBaseUrl(state.getHost()),
    secretId,
    version
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, { status }, { withCredentials: true });
  return data;
}

/**
 * Delete version of secret
 * @param {string} secretId secret id/name
 * @param {string} version secret version
 * @returns {Promise<VersionOfSecretSkeleton>} a promise that resolves to a version object
 */
export async function deleteVersionOfSecret({
  secretId,
  version,
  state,
}: {
  secretId: string;
  version: string;
  state: State;
}): Promise<VersionOfSecretSkeleton> {
  const urlString = util.format(
    secretGetVersionURLTemplate,
    getHostBaseUrl(state.getHost()),
    secretId,
    version
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
