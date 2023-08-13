import util from 'util';
import { State } from '../shared/State';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { cloneDeep } from '../utils/JsonUtils';
import { IdObjectSkeletonInterface, PagedResult } from './ApiTypes';

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
const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

export type Saml2ProiderLocation = 'hosted' | 'remote';

export type Saml2ProviderStub = IdObjectSkeletonInterface & {
  entityId: string;
  location: Saml2ProiderLocation;
  roles: string[];
};

export type Saml2ProviderSkeleton = IdObjectSkeletonInterface & {
  entityId: string;
  entityLocation: Saml2ProiderLocation;
  serviceProvider: unknown;
  identityProvider: {
    assertionProcessing?: {
      attributeMapper?: {
        attributeMapperScript?: string;
      };
    };
    advanced?: {
      idpAdapter?: {
        idpAdapterScript?: string;
      };
    };
  };
  attributeQueryProvider: unknown;
  xacmlPolicyEnforcementPoint: unknown;
};

/**
 * Get all SAML2 entity providers
 * @returns {Promise<PagedResult<Saml2ProviderStub>>} a promise that resolves to an array of saml2 entity stubs
 */
export async function getProviderStubs({
  state,
}: {
  state: State;
}): Promise<PagedResult<Saml2ProviderStub>> {
  const urlString = util.format(
    queryAllProvidersURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
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
 * Query providers matching the filter and return the requested fields
 * @param {string} filter CREST filter string, eg "entityId+eq+'${entityId}'" or "true" for all providers
 * @param {string[]} fields array of field names to include in the response
 * @returns {Promise<PagedResult<Saml2ProviderStub>>} a promise that resolves to an object containing an array of saml2 entities
 */
export async function queryProviderStubs({
  filter = 'true',
  fields = ['*'],
  state,
}: {
  filter?: string;
  fields?: string[];
  state: State;
}): Promise<PagedResult<Saml2ProviderStub>> {
  const urlString = util.format(
    queryProvidersByEntityIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
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
 * @param {Saml2ProiderLocation} location Entity provider location
 * @param {string} entityId64 Base64-encoded, unpadded provider entity id
 * @returns {Promise<Saml2ProviderSkeleton>} a promise that resolves to a saml2 entity provider object
 */
export async function getProvider({
  location,
  entityId64,
  state,
}: {
  location: Saml2ProiderLocation;
  entityId64: string;
  state: State;
}): Promise<Saml2ProviderSkeleton> {
  const urlString = util.format(
    providerByLocationAndIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
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
 * @param {Saml2ProiderLocation} location Entity provider location (hosted or remote)
 * @param {string} entityId64 Base64-encoded provider entity id
 * @returns {Promise<Saml2ProviderSkeleton>} a promise that resolves to a saml2 entity provider object
 */
export async function deleteProvider({
  location,
  entityId64,
  state,
}: {
  location: Saml2ProiderLocation;
  entityId64: string;
  state: State;
}): Promise<Saml2ProviderSkeleton> {
  const urlString = util.format(
    providerByLocationAndIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
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
 * @param {string} entityId SAML2 entity id
 * @returns {Promise<string>} a promise that resolves to an object containing a SAML2 metadata
 */
export async function getProviderMetadata({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<string> {
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
 * @param {Saml2ProiderLocation} location 'hosted' or 'remote'
 * @param {Saml2ProviderSkeleton} providerData Object representing a SAML entity provider
 * @param {string} metaData Base64-encoded metadata XML. Only required for remote providers
 * @returns {Promise<Saml2ProviderSkeleton>} a promise that resolves to a saml2 entity provider object
 */
export async function createProvider({
  location,
  providerData,
  metaData,
  state,
}: {
  location: Saml2ProiderLocation;
  providerData: Saml2ProviderSkeleton;
  metaData?: string;
  state: State;
}): Promise<Saml2ProviderSkeleton> {
  let postData = cloneDeep(providerData);
  let urlString = util.format(
    createHostedProviderURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );

  /**
   * Remote entity providers must be created using XML metadata
   */
  if (location === 'remote') {
    if (!metaData)
      throw new Error(`Missing metadata for remote entity provider.`);
    urlString = util.format(
      createRemoteProviderURLTemplate,
      state.getHost(),
      getCurrentRealmPath(state)
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
 * @param {Saml2ProiderLocation} location Entity provider location (hosted or remote)
 * @param {string} entityId SAML2 entity id
 * @param {Saml2ProviderSkeleton} providerData Object representing a SAML entity provider
 * @returns {Promise<Saml2ProviderSkeleton>} a promise that resolves to a saml2 entity provider object
 */
export async function updateProvider({
  location,
  entityId = undefined,
  providerData,
  state,
}: {
  location: Saml2ProiderLocation;
  entityId?: string;
  providerData: Saml2ProviderSkeleton;
  state: State;
}): Promise<Saml2ProviderSkeleton> {
  const urlString = util.format(
    providerByLocationAndIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    location,
    entityId || providerData._id
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
