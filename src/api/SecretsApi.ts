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

export async function getSecrets() {
  const urlString = util.format(
    secretsListURLTemplate,
    getTenantURL(storage.session.getTenant())
  );
  const { data } = await generateESVApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data.result;
}

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

export async function setStatusOfVersionOfSecret(secretId, version, status) {
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
