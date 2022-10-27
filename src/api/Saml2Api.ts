import _ from 'lodash';
import util from 'util';
import storage from '../storage/SessionStorage';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from './utils/ApiUtils';

const providerByLocationAndIdURLTemplate = '%s/json%s/realm-config/saml2/%s/%s';
const createHostedProviderURLTemplate =
  '%s/json%s/realm-config/saml2/hosted/?_action=create';
const createRemoteProviderURLTemplate =
  '%s/json%s/realm-config/saml2/remote/?_action=importEntity';
const queryAllProvidersURLTemplate =
  '%s/json%s/realm-config/saml2?_queryFilter=true';
const queryProvidersByEntityIdURLTemplate =
  '%s/json%s/realm-config/saml2?_queryFilter=%s&_fields=%s';
const metadataByEntityIdURLTemplate =
  '%s/saml2/jsp/exportmetadata.jsp?entityid=%s&realm=%s';
const samlApplicationListURLTemplateEntityIdRaw =
  '%s/json%s/realm-config/federation/entityproviders/saml2/%s';
const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  const configPath = getCurrentRealmPath();
  return {
    path: `${configPath}/realm-config/saml2`,
    apiVersion,
  };
};

/**
 * Get all SAML2 entity providers
 * @returns {Promise} a promise that resolves to an array of saml2 entity stubs
 */
export async function getProviders() {
  const urlString = util.format(
    queryAllProvidersURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath()
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Find all providers matching the filter and return the requested fields
 * @param {string} filter CREST filter string, eg "entityId+eq+'${entityId}'" or "true" for all providers
 * @param {string} fields Comma-delimited list of fields to include in the response
 * @returns {Promise} a promise that resolves to an object containing an array of saml2 entities
 */
export async function findProviders(filter = 'true', fields = '*') {
  const urlString = util.format(
    queryProvidersByEntityIdURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    encodeURIComponent(filter),
    fields
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Geta SAML2 entity provider by location and id
 * @param {string} location Entity provider location (hosted or remote)
 * @param {string} entityId64 Base64-encoded provider entity id
 * @returns {Promise} a promise that resolves to a saml2 entity provider object
 */
export async function getProviderByLocationAndId(
  location: string,
  entityId64: string
) {
  const urlString = util.format(
    providerByLocationAndIdURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    location,
    entityId64
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get SAML2 entity provider by entity id
 * @param {string} entityId Provider entity id
 * @returns {Promise} a promise that resolves to a saml2 entity provider object or null
 */
export async function getProvider(entityId) {
  const response = await findProviders(`entityId eq '${entityId}'`, 'location');
  switch (response.resultCount) {
    case 0:
      throw new Error(`No provider with entity id '${entityId}' found`);
    case 1: {
      const { location } = response.result[0];
      const id = response.result[0]._id;
      return getProviderByLocationAndId(location, id);
    }
    default:
      throw new Error(`Multiple providers with entity id '${entityId}' found`);
  }
}

export async function deleteProvider(entityId) {
  try {
    const urlString = util.format(
      samlApplicationListURLTemplateEntityIdRaw,
      storage.session.getTenant(),
      getCurrentRealmPath(),
      entityId
    );
    const response = await generateAmApi(getApiConfig()).delete(urlString, {
      withCredentials: true,
    });
    if (response.status < 200 || response.status > 399) {
      throw new Error(
        `deleteSamlEntityByEntityId ERROR: get Saml entity call returned %d, possible cause: application not found`
      );
    }
    return response.data;
  } catch (e) {
    throw new Error(e.message);
  }
}

/**
 * Get a SAML2 entity provider's metadata URL by entity id
 * @param {string} entityId SAML2 entity id
 * @returns {string} the URL to get the metadata from
 */
export function getProviderMetadataUrl(entityId) {
  return util.format(
    metadataByEntityIdURLTemplate,
    storage.session.getTenant(),
    encodeURIComponent(entityId),
    storage.session.getRealm()
  );
}

/**
 * Get a SAML2 entity provider's metadata by entity id
 * @param {String} entityId SAML2 entity id
 * @returns {Promise} a promise that resolves to an object containing a SAML2 metadata
 */
export async function getProviderMetadata(entityId) {
  const { data } = await generateAmApi(getApiConfig()).get(
    getProviderMetadataUrl(entityId),
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Create a SAML2 entity provider
 * @param {String} location 'hosted' or 'remote'
 * @param {Object} providerData Object representing a SAML entity provider
 * @param {String} metaData Base64-encoded metadata XML. Only required for remote providers
 * @returns {Promise} a promise that resolves to a saml2 entity provider object
 */
export async function createProvider(location, providerData, metaData) {
  let postData = _.cloneDeep(providerData);
  let urlString = util.format(
    createHostedProviderURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath()
  );

  if (location === 'remote') {
    /**
     * Remote entity providers must be created using XML metadata
     */
    urlString = util.format(
      createRemoteProviderURLTemplate,
      storage.session.getTenant(),
      getCurrentRealmPath()
    );
    postData = {
      standardMetadata: metaData,
    };
  }

  const { data } = await generateAmApi(getApiConfig()).post(
    urlString,
    postData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Update SAML2 entity provider
 * @param {String} location Entity provider location (hosted or remote)
 * @param {Object} providerData Object representing a SAML entity provider
 * @returns {Promise} a promise that resolves to a saml2 entity provider object
 */
export async function updateProvider(location, providerData) {
  const urlString = util.format(
    providerByLocationAndIdURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    location,
    providerData._id
  );
  const { data } = await generateAmApi(getApiConfig()).put(
    urlString,
    providerData,
    {
      withCredentials: true,
    }
  );
  return data;
}
