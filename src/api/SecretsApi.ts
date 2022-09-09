import util from 'util';
import { encode } from './utils/Base64';
import { getTenantURL } from './utils/ApiUtils';
import { generateESVApi } from './BaseApi';
import storage from '../storage/SessionStorage';

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
 * Get all secrets
 * @returns {Promise<unknown[]>} a promise that resolves to an array of secrets
 */
export async function getSecrets() {
  const urlString = util.format(
    secretsListURLTemplate,
    getTenantURL(storage.session.getTenant())
  );
  const { data } = await generateESVApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get secret
 * @param secretId secret id/name
 * @returns {Promise<unknown>} a promise that resolves to a secret
 */
export async function getSecret(secretId) {
  const urlString = util.format(
    secretURLTemplate,
    getTenantURL(storage.session.getTenant()),
    secretId
  );
  const { data } = await generateESVApi(getApiConfig()).get(urlString, {
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
 * @returns {Promise<unknown>} a promise that resolves to a secret
 */
export async function putSecret(
  secretId,
  value,
  description,
  encoding = 'generic',
  useInPlaceholders = true
) {
  if (encoding !== 'generic')
    throw new Error(`Unsupported encoding: ${encoding}`);
  const secretData = {
    valueBase64: encode(value),
    description,
    encoding,
    useInPlaceholders,
  };
  const urlString = util.format(
    secretURLTemplate,
    getTenantURL(storage.session.getTenant()),
    secretId
  );
  const { data } = await generateESVApi(getApiConfig()).put(
    urlString,
    secretData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Set secret description
 * @param {string} secretId secret id/name
 * @param {string} description secret description
 * @returns {Promise<unknown>} a promise that resolves to a status object
 */
export async function setSecretDescription(secretId, description) {
  const urlString = util.format(
    secretSetDescriptionURLTemplate,
    getTenantURL(storage.session.getTenant()),
    secretId
  );
  const { data } = await generateESVApi(getApiConfig()).post(
    urlString,
    { description },
    { withCredentials: true }
  );
  return data;
}

/**
 * Delete secret
 * @param {string} secretId secret id/name
 * @returns {Promise<unknown>} a promise that resolves to a secret object
 */
export async function deleteSecret(secretId) {
  const urlString = util.format(
    secretURLTemplate,
    getTenantURL(storage.session.getTenant()),
    secretId
  );
  const { data } = await generateESVApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get secret versions
 * @param {string} secretId secret id/name
 * @returns {Promise<unknown>} a promise that resolves to an array of secret versions
 */
export async function getSecretVersions(secretId) {
  const urlString = util.format(
    secretListVersionsURLTemplate,
    getTenantURL(storage.session.getTenant()),
    secretId
  );
  const { data } = await generateESVApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create new secret version
 * @param {string} secretId secret id/name
 * @param {string} value secret value
 * @returns {Promise<unknown>} a promise that resolves to a version object
 */
export async function createNewVersionOfSecret(secretId, value) {
  const urlString = util.format(
    secretCreateNewVersionURLTemplate,
    getTenantURL(storage.session.getTenant()),
    secretId
  );
  const { data } = await generateESVApi(getApiConfig()).post(
    urlString,
    { valueBase64: encode(value) },
    { withCredentials: true }
  );
  return data;
}

/**
 * Get version of secret
 * @param {string} secretId secret id/name
 * @param {string} version secret version
 * @returns {Promise<unknown>} a promise that resolves to a version object
 */
export async function getVersionOfSecret(secretId, version) {
  const urlString = util.format(
    secretGetVersionURLTemplate,
    getTenantURL(storage.session.getTenant()),
    secretId,
    version
  );
  const { data } = await generateESVApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

export enum VersionOfSecretStatus {
  DISABLED = 'DISABLED',
  ENABLED = 'ENABLED',
}

/**
 * Update the status of a version of a secret
 * @param {string} secretId secret id/name
 * @param {string} version secret version
 * @param {VersionOfSecretStatus} status status
 * @returns {Promise<unknown>} a promise that resolves to a status object
 */
export async function setStatusOfVersionOfSecret(
  secretId: string,
  version: string,
  status: VersionOfSecretStatus
) {
  const urlString = util.format(
    secretVersionStatusURLTemplate,
    getTenantURL(storage.session.getTenant()),
    secretId,
    version
  );
  const { data } = await generateESVApi(getApiConfig()).post(
    urlString,
    { status },
    { withCredentials: true }
  );
  return data;
}

/**
 * Delete version of secret
 * @param {string} secretId secret id/name
 * @param {string} version secret version
 * @returns {Promise<unknown>} a promise that resolves to a version object
 */
export async function deleteVersionOfSecret(secretId, version) {
  const urlString = util.format(
    secretGetVersionURLTemplate,
    getTenantURL(storage.session.getTenant()),
    secretId,
    version
  );
  const { data } = await generateESVApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
