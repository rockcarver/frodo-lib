import util from 'util';
import { encode } from '../../utils/Base64';
import { getTenantURL } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';
import { State } from '../../shared/State';
import { VersionOfSecretStatus } from '../ApiTypes';

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
export async function getSecrets({ state }: { state: State }) {
  const urlString = util.format(
    secretsListURLTemplate,
    getTenantURL(state.getHost())
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
 * @returns {Promise<unknown>} a promise that resolves to a secret
 */
export async function getSecret({
  secretId,
  state,
}: {
  secretId: string;
  state: State;
}) {
  const urlString = util.format(
    secretURLTemplate,
    getTenantURL(state.getHost()),
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
 * @returns {Promise<unknown>} a promise that resolves to a secret
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
}) {
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
    getTenantURL(state.getHost()),
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
 * @returns {Promise<unknown>} a promise that resolves to a status object
 */
export async function setSecretDescription({
  secretId,
  description,
  state,
}: {
  secretId: string;
  description: string;
  state: State;
}) {
  const urlString = util.format(
    secretSetDescriptionURLTemplate,
    getTenantURL(state.getHost()),
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
    getTenantURL(state.getHost()),
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
 * @returns {Promise<unknown>} a promise that resolves to an array of secret versions
 */
export async function getSecretVersions({
  secretId,
  state,
}: {
  secretId: string;
  state: State;
}) {
  const urlString = util.format(
    secretListVersionsURLTemplate,
    getTenantURL(state.getHost()),
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
 * @returns {Promise<unknown>} a promise that resolves to a version object
 */
export async function createNewVersionOfSecret({
  secretId,
  value,
  state,
}: {
  secretId: string;
  value: string;
  state: State;
}) {
  const urlString = util.format(
    secretCreateNewVersionURLTemplate,
    getTenantURL(state.getHost()),
    secretId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, { valueBase64: encode(value) }, { withCredentials: true });
  return data;
}

/**
 * Get version of secret
 * @param {string} secretId secret id/name
 * @param {string} version secret version
 * @returns {Promise<unknown>} a promise that resolves to a version object
 */
export async function getVersionOfSecret({
  secretId,
  version,
  state,
}: {
  secretId: string;
  version: string;
  state: State;
}) {
  const urlString = util.format(
    secretGetVersionURLTemplate,
    getTenantURL(state.getHost()),
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
 * @returns {Promise<unknown>} a promise that resolves to a status object
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
}) {
  const urlString = util.format(
    secretVersionStatusURLTemplate,
    getTenantURL(state.getHost()),
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
 * @returns {Promise<unknown>} a promise that resolves to a version object
 */
export async function deleteVersionOfSecret({
  secretId,
  version,
  state,
}: {
  secretId: string;
  version: string;
  state: State;
}) {
  const urlString = util.format(
    secretGetVersionURLTemplate,
    getTenantURL(state.getHost()),
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
