import _ from 'lodash';
import util from 'util';
import State from '../shared/State';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from './utils/ApiUtils';
import { Saml2ProviderSkeleton } from './ApiTypes';

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
const samlApplicationQueryURLTemplateRaw =
  '%s/json%s/realm-config/federation/entityproviders/saml2?_queryFilter=true';
const samlApplicationByEntityIdURLTemplate =
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
export async function getProviders({ state }: { state: State }) {
  const urlString = util.format(
    queryAllProvidersURLTemplate,
    state.getHost(),
    getCurrentRealmPath()
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
 * Find all providers matching the filter and return the requested fields
 * @param {string} filter CREST filter string, eg "entityId+eq+'${entityId}'" or "true" for all providers
 * @param {string[]} fields array of field names to include in the response
 * @returns {Promise} a promise that resolves to an object containing an array of saml2 entities
 */
export async function findProviders({
  filter = 'true',
  fields = ['*'],
  state,
}: {
  filter?: string;
  fields?: string[];
  state: State;
}) {
  const urlString = util.format(
    queryProvidersByEntityIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    encodeURIComponent(filter),
    fields.join(',')
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
 * Geta SAML2 entity provider by location and id
 * @param {string} location Entity provider location (hosted or remote)
 * @param {string} entityId64 Base64-encoded provider entity id
 * @returns {Promise} a promise that resolves to a saml2 entity provider object
 */
export async function getProviderByLocationAndId({
  location,
  entityId64,
  state,
}: {
  location: string;
  entityId64: string;
  state: State;
}) {
  const urlString = util.format(
    providerByLocationAndIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    location,
    entityId64
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
 * Geta SAML2 entity provider by location and id
 * @param {string} location Entity provider location (hosted or remote)
 * @param {string} entityId64 Base64-encoded provider entity id
 * @returns {Promise} a promise that resolves to a saml2 entity provider object
 */
export async function deleteProviderByLocationAndId({
  location,
  entityId64,
  state,
}: {
  location: string;
  entityId64: string;
  state: State;
}) {
  const urlString = util.format(
    providerByLocationAndIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    location,
    entityId64
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get a SAML2 entity provider's metadata URL by entity id
 * @param {string} entityId SAML2 entity id
 * @returns {string} the URL to get the metadata from
 */
export function getProviderMetadataUrl({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): string {
  return util.format(
    metadataByEntityIdURLTemplate,
    state.getHost(),
    encodeURIComponent(entityId),
    state.getRealm()
  );
}

/**
 * Get a SAML2 entity provider's metadata by entity id
 * @param {String} entityId SAML2 entity id
 * @returns {Promise} a promise that resolves to an object containing a SAML2 metadata
 */
export async function getProviderMetadata({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}) {
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    getProviderMetadataUrl({ entityId, state }),
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
export async function createProvider({
  location,
  providerData,
  metaData,
  state,
}: {
  location: string;
  providerData: Saml2ProviderSkeleton | object;
  metaData: string;
  state: State;
}) {
  let postData = _.cloneDeep(providerData);
  let urlString = util.format(
    createHostedProviderURLTemplate,
    state.getHost(),
    getCurrentRealmPath()
  );

  if (location === 'remote') {
    /**
     * Remote entity providers must be created using XML metadata
     */
    urlString = util.format(
      createRemoteProviderURLTemplate,
      state.getHost(),
      getCurrentRealmPath()
    );
    postData = {
      standardMetadata: metaData,
    };
  }

  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, postData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Update SAML2 entity provider
 * @param {String} location Entity provider location (hosted or remote)
 * @param {Object} providerData Object representing a SAML entity provider
 * @returns {Promise} a promise that resolves to a saml2 entity provider object
 */
export async function updateProvider({
  location,
  providerData,
  state,
}: {
  location: string;
  providerData: Saml2ProviderSkeleton;
  state: State;
}) {
  const urlString = util.format(
    providerByLocationAndIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    location,
    providerData._id
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    providerData,
    {
      withCredentials: true,
    }
  );
  return data;
}

// Contributions using legacy APIs. Need to investigate if those will be deprecated in the future

/**
 * Deletes a SAML2 entity provider by entity id
 * @param {string} entityId Provider entity id
 * @returns {Promise} a promise that resolves to a provider object
 */
export async function deleteRawProvider({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}) {
  const urlString = util.format(
    samlApplicationByEntityIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    entityId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Retrieves all entity providers using the legacy federation enpoints.
 * @returns {Promise} a promise that resolves to an object containing an array of providers
 */
export async function getRawProviders({ state }: { state: State }) {
  const urlString = util.format(
    samlApplicationQueryURLTemplateRaw,
    state.getHost(),
    getCurrentRealmPath()
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
 * Gets the data for an entity provider including the raw XML.
 * @param {string} entityId The entity provider id
 * @returns Promise that when resolved includes the configuration and raw xml for a SAML entity provider
 */
export async function getRawProvider({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}) {
  const urlString = util.format(
    samlApplicationByEntityIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    encodeURIComponent(entityId)
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
 * Stores a new SAML2 entity provider
 * @param {string} entityId The entity provider id
 * @param {string} entityData The actual data containing the entity provider configuration
 * @returns {Promise} Promise that resolves to a provider object
 */
export async function putRawProvider({
  entityId,
  entityData,
  state,
}: {
  entityId: string;
  entityData: Saml2ProviderSkeleton;
  state: State;
}) {
  const urlString = util.format(
    samlApplicationByEntityIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    encodeURIComponent(entityId)
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    entityData,
    {
      withCredentials: true,
    }
  );
  return data;
}
