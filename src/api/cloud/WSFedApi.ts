import util from 'util';

import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { NoIdObjectSkeletonInterface } from '../ApiTypes';
import { generateWSFedApi } from '../BaseApi';

const spConnectionsURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/idp/spConnections';
const spConnectionByIdURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/idp/spConnections/%s';

const authenticationPolicyContractsURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/authenticationPolicyContracts';
const authenticationPolicyContractByIdURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/authenticationPolicyContracts/%s';

const generateSigningKeyPairURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/keyPairs/signing/generate';
const signingKeyPairsURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/keyPairs/signing';
const signingKeyPairByIdURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/keyPairs/signing/%s';
const signingKeyPairCertificateByIdURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/keyPairs/signing/%s/certificate';

const federationInfoURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/serverSettings/federationInfo';

const virtualHostNamesURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/virtualHostNames';

const idpAdaptersURLTemplate = '%s/ws/admin/pf-admin-api/v1/idp/adapters';
const idpAdapterByIdURLTemplate = '%s/ws/admin/pf-admin-api/v1/idp/adapters/%s';

// const authenticationPoliciesURLTemplate =
//   '%s/ws/admin/pf-admin-api/v1/authenticationPolicies';
const authenticationPolicyURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/authenticationPolicies/policy';
const authenticationPolicyByIdURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/authenticationPolicies/policy/%s';

const clusterReplicateURLTemplate =
  '%s/ws/admin/pf-admin-api/v1/cluster/replicate';

export type WSFedResponseItems<T> = {
  items: T[];
};

/**
 * SpConnection object skeleton
 */
export type WSFedSpConnection = NoIdObjectSkeletonInterface & {
  type: 'SP';
  id: string;
  name: string;
  entityId: string;
  active: boolean;
  contactInfo: object;
  loggingMode: string;
  defaultVirtualEntityId: string;
  virtualEntityIds: string[];
  credentials: {
    certs: [];
    signingSettings: {
      signingKeyPairRef: {
        id: string;
        location: string;
      };
      algorithm: string;
      includeRawKeyInSignature: boolean;
    };
  };
  modificationDate: string;
  creationDate: string;
  replicationStatus: string;
  spBrowserSso: {
    protocol: string;
    alwaysSignArtifactResponse: boolean;
    ssoServiceEndpoints: [
      {
        url: string;
      },
    ];
    spWsFedIdentityMapping: string;
    assertionLifetime: {
      minutesBefore: number;
      minutesAfter: number;
    };
    attributeContract: {
      coreAttributes: [
        {
          name: string;
        },
      ];
      extendedAttributes: [
        {
          name: string;
          nameFormat: string;
        },
      ];
    };
    adapterMappings: [];
    authenticationPolicyContractAssertionMappings: [
      {
        attributeSources: [];
        attributeContractFulfillment: {
          SAML_SUBJECT: {
            source: {
              type: string;
            };
            value: string;
          };
          SAML_NAME_FORMAT: {
            source: {
              type: string;
            };
            value: string;
          };
        };
        issuanceCriteria: {
          conditionalCriteria: [];
        };
        authenticationPolicyContractRef: {
          id: string;
          location: string;
        };
        restrictVirtualEntityIds: boolean;
        restrictedVirtualEntityIds: string[];
        abortSsoTransactionAsFailSafe: boolean;
      },
    ];
    wsFedTokenType: string;
    wsTrustVersion: string;
  };
  connectionTargetType: string;
};

/**
 * Get all sp connections
 * @returns {Promise<WSFedResponseItems<WSFedSpConnection>>} a promise that resolves to a WSFedResponseItems object containing an array of WSFedSpConnection objects
 */
export async function getSpConnections({
  state,
}: {
  state: State;
}): Promise<WSFedResponseItems<WSFedSpConnection>> {
  const urlString = util.format(
    spConnectionsURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create sp connection
 * @param {WSFedSpConnection} spConnection - the sp connection object to create
 * @returns {Promise<WSFedSpConnection>} a promise that resolves to the created SpConnection object
 */
export async function createSpConnection({
  state,
  spConnection,
}: {
  state: State;
  spConnection: WSFedSpConnection;
}): Promise<WSFedSpConnection> {
  const urlString = util.format(
    spConnectionsURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).post(urlString, spConnection, {
    withCredentials: true,
  });
  return data;
}

/**
 * Update sp connection
 * @param {string} id - the id of the sp connection to update
 * @param {WSFedSpConnection} spConnection - the sp connection object to update
 * @returns {Promise<WSFedSpConnection>} a promise that resolves to the updated SpConnection object
 */
export async function updateSpConnectionById({
  state,
  id,
  spConnection,
}: {
  state: State;
  id: string;
  spConnection: WSFedSpConnection;
}): Promise<WSFedSpConnection> {
  const urlString = util.format(
    spConnectionByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateWSFedApi({
    state,
  }).put(urlString, spConnection, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get sp connection by id
 * @param {string} id - the id of the sp connection to retrieve
 * @returns {Promise<WSFedSpConnection>} a promise that resolves to a SpConnection object
 */
export async function getSpConnectionById({
  state,
  id,
}: {
  state: State;
  id: string;
}): Promise<WSFedSpConnection> {
  const urlString = util.format(
    spConnectionByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

export type WSFedAuthenticationPolicyContractAttribute = {
  name: string;
};

export type WSFedAuthenticationPolicyContract = {
  id: string;
  name: string;
  coreAttributes: WSFedAuthenticationPolicyContractAttribute[];
  extendedAttributes: WSFedAuthenticationPolicyContractAttribute[];
  lastModified?: string;
};

export type WSFedAuthenticationPolicyContractRequest = Omit<
  WSFedAuthenticationPolicyContract,
  'id' | 'lastModified'
> &
  Partial<Pick<WSFedAuthenticationPolicyContract, 'id' | 'lastModified'>>;

/**
 * Get all authentication policy contracts
 * @returns {Promise<WSFedResponseItems<WSFedAuthenticationPolicyContract>>} a promise that resolves to a ResponseItems object containing an array of authentication policy contracts
 */
export async function getAuthenticationPolicyContracts({
  state,
}: {
  state: State;
}): Promise<WSFedResponseItems<WSFedAuthenticationPolicyContract>> {
  const urlString = util.format(
    authenticationPolicyContractsURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/** 
 * Get authentication policy contracts by id
 * @param {string} id - the id of the authentication policy contract to retrieve
 * @param {State} state - library state
 * @returns {Promise<WSFedAuthenticationPolicyContract>} a promise that resolves to the authentication policy contract object
 */
export async function getAuthenticationPolicyContractById({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<WSFedAuthenticationPolicyContract> {
  const urlString = util.format(
    authenticationPolicyContractByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create authentication policy contract
 * @param {WSFedAuthenticationPolicyContractRequest} authenticationPolicyContract - the authentication policy contract object to create
 * @returns {Promise<WSFedAuthenticationPolicyContract>} a promise that resolves to the created authentication policy contract object
 */
export async function createAuthenticationPolicyContract({
  authenticationPolicyContractRequest,
  state,
}: {
  authenticationPolicyContractRequest: WSFedAuthenticationPolicyContractRequest;
  state: State;
}): Promise<WSFedAuthenticationPolicyContract> {
  const urlString = util.format(
    authenticationPolicyContractsURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).post(urlString, authenticationPolicyContractRequest, {
    withCredentials: true,
  });
  return data;
}

/** Update authentication policy contract by id
 * @param {string} id - the id of the authentication policy contract to update
 * @param {WSFedAuthenticationPolicyContractRequest} authenticationPolicyContractRequest - the authentication policy contract object to update
 * @param {State} state - library state
 * @returns {Promise<WSFedAuthenticationPolicyContract>} a promise that resolves to the updated authentication policy contract object
 */
export async function updateAuthenticationPolicyContractById({
  id,
  authenticationPolicyContractRequest,
  state,
}: {
  id: string;
  authenticationPolicyContractRequest: WSFedAuthenticationPolicyContractRequest;
  state: State;
}): Promise<WSFedAuthenticationPolicyContract> {
  const urlString = util.format(
    authenticationPolicyContractByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateWSFedApi({
    state,
  }).put(urlString, authenticationPolicyContractRequest, {
    withCredentials: true,
  });
  return data;
}

export type WSFedSigningKeyPairRequest = {
  commonName: string;
  organization: string;
  country: string;
  validDays: number;
  keyAlgorithm: string;
  keySize: number;
  signatureAlgorithm: string;
};

export type WSFedSigningKeyPair = {
  id: string;
  serialNumber: string;
  subjectDN: string;
  subjectAlternativeNames: string[];
  issuerDN: string;
  validFrom: string;
  expires: string;
  keyAlgorithm: string;
  keySize: number;
  signatureAlgorithm: string;
  version: number;
  sha1Fingerprint: string;
  sha256Fingerprint: string;
  status: string;
};

/**
 * Get signing key pair generation endpoint
 * @param {WSFedSigningKeyPairRequest} params - optional parameters for generating a signing key pair, default values will be used if not provided
 * @returns {Promise<WSFedSigningKeyPair>} a promise that resolves to the signing key pair generation response
 */
export async function generateSigningKeyPair({
  params = {
    commonName: 'wssigningkey',
    organization: 'Ping Identity',
    country: 'US',
    validDays: 3650,
    keyAlgorithm: 'RSA',
    keySize: 2048,
    signatureAlgorithm: 'SHA256withRSA',
  },
  state,
}: {
  params?: WSFedSigningKeyPairRequest;
  state: State;
}): Promise<WSFedSigningKeyPair> {
  const urlString = util.format(
    generateSigningKeyPairURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).post(urlString, params, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get signing key pair by id
 * @param {string} id - the id of the signing key pair to retrieve
 * @returns {Promise<WSFedSigningKeyPair>} a promise that resolves to a signing key pair object
 */
export async function getSigningKeyPairById({
  state,
  id,
}: {
  state: State;
  id: string;
}): Promise<WSFedSigningKeyPair> {
  const urlString = util.format(
    signingKeyPairByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get signing key pairs
 * @param {State} state library state
 * @returns {Promise<WSFedResponseItems<WSFedSigningKeyPair>>} a promise that resolves to a ResponseItems object containing an array of signing key pair objects
 */
export async function getSigningKeyPairs({
  state,
}: {
  state: State;
}): Promise<WSFedResponseItems<WSFedSigningKeyPair>> {
  const urlString = util.format(
    signingKeyPairsURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Update or create signing key pair by id
 * @param {string} id - the id of the signing key pair to update or create
 * @param {WSFedSigningKeyPairRequest} params - parameters for updating or creating the signing key pair
 * @returns {Promise<WSFedSigningKeyPair>} a promise that resolves to the updated or created signing key pair object
 */
export async function updateOrCreateSigningKeyPairById({
  state,
  id,
  params,
}: {
  state: State;
  id: string;
  params: WSFedSigningKeyPairRequest;
}): Promise<WSFedSigningKeyPair> {
  const urlString = util.format(
    signingKeyPairByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateWSFedApi({
    state,
  }).put(urlString, params, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get signing key pair certificate
 * @param {string} keyPairId - the id of the signing key pair to retrieve the certificate for
 * @returns {Promise<string>} a promise that resolves to a signing key pair certificate
 */
export async function getSigningKeyPairCertificate({
  state,
  keyPairId,
}: {
  state: State;
  keyPairId: string;
}): Promise<string> {
  const urlString = util.format(
    signingKeyPairCertificateByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    keyPairId
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Update or create signing key pair certificate
 * @param {string} keyPairId - the id of the signing key pair to update or create the certificate for
 * @param {string} certificate - the certificate to update or create for the signing key pair
 * @returns {Promise<string>} a promise that resolves to the updated or created signing key pair certificate
 */
export async function updateOrCreateSigningKeyPairCertificate({
  state,
  keyPairId,
  certificate,
}: {
  state: State;
  keyPairId: string;
  certificate: string;
}): Promise<string> {
  const urlString = util.format(
    signingKeyPairCertificateByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    keyPairId
  );
  const { data } = await generateWSFedApi({
    state,
  }).put(
    urlString,
    { certificate },
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete signing key pair by id
 * @param {string} id - the id of the signing key pair to delete
 * @returns {Promise<void>} a promise that resolves when the signing key pair is deleted
 */
export async function deleteSigningKeyPairById({
  state,
  id,
}: {
  state: State;
  id: string;
}): Promise<void> {
  const urlString = util.format(
    signingKeyPairByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  await generateWSFedApi({
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
}

/**
 * Delete signing key pair certificate by id
 * @param {string} keyPairId - the id of the signing key pair to delete the certificate for
 * @returns {Promise<void>} a promise that resolves when the signing key pair certificate is deleted
 */
export async function deleteSigningKeyPairCertificate({
  state,
  keyPairId,
}: {
  state: State;
  keyPairId: string;
}): Promise<void> {
  const urlString = util.format(
    signingKeyPairCertificateByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    keyPairId
  );
  await generateWSFedApi({
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
}

export type WSFedFederationInfo = {
  baseUrl: string;
  saml2EntityId: string;
  saml1xIssuerId: string;
  saml1xSourceId: string;
  wsfedRealm: string;
  [key: string]: unknown;
};

/**
 * Get federation info
 * @returns {Promise<WSFedFederationInfo>} a promise that resolves to a federation info object
 */
export async function getFederationInfo({
  state,
}: {
  state: State;
}): Promise<WSFedFederationInfo> {
  const urlString = util.format(
    federationInfoURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Update federation info
 * @param {WSFedFederationInfo} federationInfo - the federation info object to update
 * @returns {Promise<WSFedFederationInfo>} a promise that resolves to the updated federation info object
 */
export async function updateFederationInfo({
  state,
  federationInfo,
}: {
  state: State;
  federationInfo: WSFedFederationInfo;
}): Promise<WSFedFederationInfo> {
  const urlString = util.format(
    federationInfoURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).put(urlString, federationInfo, {
    withCredentials: true,
  });
  return data;
}

export type WSFedVirtualHostNames = {
  virtualHostNames: string[];
};

/**
 * Get all virtual host names
 * @returns {Promise<WSFedVirtualHostNames>} a promise that resolves to a ResponseItems object containing an array of virtual host names
 */
export async function getVirtualHostNames({
  state,
}: {
  state: State;
}): Promise<WSFedVirtualHostNames> {
  const urlString = util.format(
    virtualHostNamesURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

export type WSFedIdpAdapterConfigTable = {
  name: string;
  rows: WSFedIdpAdapterConfigTableRow[];
};

export type WSFedIdpAdapterConfigField = {
  name: string;
  value: string;
};

export type WSFedIdpAdapterConfigTableRow = {
  fields: WSFedIdpAdapterConfigField[];
  defaultRow: boolean;
};

export type WSFedIdpAdapterAttribute = {
  name: string;
  masked: boolean;
  pseudonym: boolean;
};

export type WSFedIdpAdapterPluginDescriptorRef = {
  id: string;
  location: string;
};

export type WSFedIdpAdapterAttributeContractFulfillment = {
  subject: {
    source: {
      type: string;
    };
    value: string;
  };
};

export type WSFedIdpAdapter = {
  id: string;
  name: string;
  pluginDescriptorRef: WSFedIdpAdapterPluginDescriptorRef;
  configuration: {
    tables: WSFedIdpAdapterConfigTable[];
    fields: WSFedIdpAdapterConfigField[];
  };
  attributeContract: {
    coreAttributes: WSFedIdpAdapterAttribute[];
    extendedAttributes: WSFedIdpAdapterAttribute[];
    uniqueUserKeyAttribute: string;
    maskOgnlValues: boolean;
  };
  attributeMapping: {
    attributeContractFulfillment: WSFedIdpAdapterAttributeContractFulfillment;
  };
  [key: string]: unknown;
};

/**
 * Get all IDP adapters
 * @returns {Promise<WSFedResponseItems<WSFedIdpAdapter>>} a promise that resolves to a ResponseItems object containing an array of IDP adapters
 */
export async function getIdpAdapters({
  state,
}: {
  state: State;
}): Promise<WSFedResponseItems<WSFedIdpAdapter>> {
  const urlString = util.format(
    idpAdaptersURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get IDP adapter by id
 * @param {string} id - the id of the IDP adapter to retrieve
 * @returns {Promise<WSFedIdpAdapter>} a promise that resolves to an IDP adapter object
 */
export async function getIdpAdapterById({
  state,
  id,
}: {
  state: State;
  id: string;
}): Promise<WSFedIdpAdapter> {
  const urlString = util.format(
    idpAdapterByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Update IDP adapter by id
 * @param {string} id - the id of the IDP adapter to update
 * @param {WSFedIdpAdapter} idpAdapter - the IDP adapter object to update
 * @returns {Promise<WSFedIdpAdapter>} a promise that resolves to the updated IDP adapter object
 */
export async function updateIdpAdapterById({
  state,
  id,
  idpAdapter,
}: {
  state: State;
  id: string;
  idpAdapter: WSFedIdpAdapter;
}): Promise<WSFedIdpAdapter> {
  const urlString = util.format(
    idpAdapterByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateWSFedApi({
    state,
  }).put(urlString, idpAdapter, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create IDP adapter
 * @param {WSFedIdpAdapter} idpAdapter - the IDP adapter object to create
 * @returns {Promise<WSFedIdpAdapter>} a promise that resolves to the created IDP adapter object
 */
export async function createIdpAdapter({
  state,
  idpAdapter,
}: {
  state: State;
  idpAdapter: WSFedIdpAdapter;
}): Promise<WSFedIdpAdapter> {
  const urlString = util.format(
    idpAdaptersURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).post(urlString, idpAdapter, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete IDP adapter by id
 * @param {string} id - the id of the IDP adapter to delete
 * @returns {Promise<void>} a promise that resolves when the IDP adapter is deleted
 */
export async function deleteIdpAdapterById({
  state,
  id,
}: {
  state: State;
  id: string;
}): Promise<void> {
  const urlString = util.format(
    idpAdapterByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  await generateWSFedApi({
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
}

export type WSFedAuthenticationAction = {
  type: string;
  authenticationSource?: {
    type: string;
    sourceRef: {
      id: string;
    };
  };
  inputUserIdMapping?: {
    source: {
      type: string;
    };
    value: string;
  };
  userIdAuthenticated?: boolean;
  authenticationPolicyContractRef?: {
    id: string;
    location: string;
  };
  attributeMapping?: {
    attributeSources: [];
    attributeContractFulfillment: {
      subject: {
        source: {
          type: string;
          id: string;
        };
        value: string;
      };
    };
    issuanceCriteria: { conditionalCriteria: [] };
  };
  context?: string;
  [key: string]: unknown;
};

export type WSFedAuthenticationPolicyNode = {
  action: WSFedAuthenticationAction;
  children: WSFedAuthenticationPolicyNode[];
};

export type WSFedAuthenticationPolicy = {
  id: string;
  name: string;
  enabled: boolean;
  rootNode: WSFedAuthenticationPolicyNode;
  handleFailuresLocally: boolean;
  [key: string]: unknown;
};

// derive WSFedAuthenticationPolicyRequest from WSFedAuthenticationPolicy by making all properties except name optional and removing id
export type WSFedAuthenticationPolicyRequest = Omit<
  Partial<WSFedAuthenticationPolicy>,
  'id'
> &
  Pick<WSFedAuthenticationPolicy, 'name'>;

// /**
//  * Get authentication policies
//  * @returns {Promise<WSFedResponseItems<WSFedAuthenticationPolicy>>} a promise that resolves to a WSFedResponseItems object containing an array of authentication policy objects
//  */
// export async function getAuthenticationPolicies({
//   state,
// }: {
//   state: State;
// }): Promise<WSFedResponseItems<WSFedAuthenticationPolicy>> {
//   const urlString = util.format(
//     authenticationPoliciesURLTemplate,
//     getHostOnlyUrl(state.getHost())
//   );
//   const { data } = await generateWSFedApi({
//     state,
//   }).get(urlString, {
//     withCredentials: true,
//   });
//   return data;
// }

/**
 * Get authentication policy by id
 * @param {string} id - the id of the authentication policy to retrieve
 * @returns {Promise<WSFedAuthenticationPolicy>} a promise that resolves to an authentication policy object
 */
export async function getAuthenticationPolicyById({
  state,
  id,
}: {
  state: State;
  id: string;
}): Promise<WSFedAuthenticationPolicy> {
  const urlString = util.format(
    authenticationPolicyByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateWSFedApi({
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create authentication policy
 * @param {WSFedAuthenticationPolicyRequest} authenticationPolicy - the authentication policy object to create
 * @returns {Promise<WSFedAuthenticationPolicy>} a promise that resolves to the created authentication policy object
 */
export async function createAuthenticationPolicy({
  state,
  authenticationPolicyRequest,
}: {
  state: State;
  authenticationPolicyRequest: WSFedAuthenticationPolicyRequest;
}): Promise<WSFedAuthenticationPolicy> {
  const urlString = util.format(
    authenticationPolicyURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).post(urlString, authenticationPolicyRequest, {
    withCredentials: true,
  });
  return data;
}

/**
 * Update authentication policy by id
 * @param {string} id - the id of the authentication policy to update
 * @param {WSFedAuthenticationPolicyRequest} authenticationPolicy - the authentication policy object to update
 * @returns {Promise<WSFedAuthenticationPolicy>} a promise that resolves to the updated authentication policy object
 */
export async function updateAuthenticationPolicyById({
  state,
  id,
  authenticationPolicyRequest,
}: {
  state: State;
  id: string;
  authenticationPolicyRequest: WSFedAuthenticationPolicyRequest;
}): Promise<WSFedAuthenticationPolicy> {
  const urlString = util.format(
    authenticationPolicyByIdURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateWSFedApi({
    state,
  }).put(urlString, authenticationPolicyRequest, {
    withCredentials: true,
  });
  return data;
}

export type WSFedClusterReplicateResponse = {
  resultId: string;
  message: string;
};

/**
 * Replicate configuration across all nodes in the cluster
 * @returns {Promise<WSFedClusterReplicateResponse>} a promise that resolves to the cluster replicate response
 */
export async function replicate({
  state,
}: {
  state: State;
}): Promise<WSFedClusterReplicateResponse> {
  const urlString = util.format(
    clusterReplicateURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateWSFedApi({
    state,
  }).post(urlString, null, {
    withCredentials: true,
  });
  return data;
}
