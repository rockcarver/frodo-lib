import { FrodoError } from '../..';
import {
  createSpConnection as _createSpConnection,
  getSpConnections as _getSpConnections,
  getSpConnectionById as _getSpConnectionById,
  type WSFedResponseItems,
  type WSFedSpConnection,
  type WSFedAuthenticationPolicy,
  // getAuthenticationPolicies as _getAuthenticationPolicies,
  updateSpConnectionById as _updateSpConnectionById,
  // getAuthenticationPolicyContracts as _getAuthenticationPolicyContracts,
  getAuthenticationPolicyContractById as _getAuthenticationPolicyContractById,
  createAuthenticationPolicyContract as _createAuthenticationPolicyContract,
  updateAuthenticationPolicyContractById as _updateAuthenticationPolicyContractById,
  generateSigningKeyPair as _generateSigningKeyPair,
  getSigningKeyPairById as _getSigningKeyPairById,
  // getSigningKeyPairs as _getSigningKeyPairs,
  updateOrCreateSigningKeyPairById as _updateOrCreateSigningKeyPairById,
  getSigningKeyPairCertificate as _getSigningKeyPairCertificate,
  updateOrCreateSigningKeyPairCertificate as _updateOrCreateSigningKeyPairCertificate,
  deleteSigningKeyPairById as _deleteSigningKeyPairById,
  deleteSigningKeyPairCertificate as _deleteSigningKeyPairCertificate,
  type WSFedAuthenticationPolicyContract,
  type WSFedAuthenticationPolicyContractRequest,
  type WSFedSigningKeyPairRequest,
  type WSFedSigningKeyPair,
  type WSFedFederationInfo,
  getFederationInfo as _getFederationInfo,
  updateFederationInfo as _updateFederationInfo,
  getVirtualHostNames as _getVirtualHostNames,
  type WSFedVirtualHostNames,
  getIdpAdapters as _getIdpAdapters,
  getIdpAdapterById as _getIdpAdapterById,
  type WSFedIdpAdapter,
  updateIdpAdapterById as _updateIdpAdapterById,
  createIdpAdapter as _createIdpAdapter,
  deleteIdpAdapterById as _deleteIdpAdapterById,
  getAuthenticationPolicyById as _getAuthenticationPolicyById,
  createAuthenticationPolicy as _createAuthenticationPolicy,
  updateAuthenticationPolicyById as _updateAuthenticationPolicyById,
  type WSFedAuthenticationPolicyRequest,
  replicate as _replicate,
  WSFedClusterReplicateResponse,
  getSpConnectionById,
} from '../../api/cloud/WSFedApi';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';

// add every method implementation from this file as a type but remove structured params (e.g. { state }) and replace with individual params (e.g. state) to be consistent with other ops files. Also, use read instead of get to be consistent with other ops files.
export type WSFed = {
  /**
   * Read SP connections
   * @returns {Promise<WSFedSpConnection[]>} a promise resolving to an array of SP connection objects
   */
  readSpConnections(): Promise<WSFedSpConnection[]>;
  /**
   * Read SP connection by ID
   * @param {string} id SP connection ID
   */
  readSpConnectionById(id: string): Promise<WSFedSpConnection>;
  /**
   * Create SP connection
   * @param {WSFedSpConnection} spConnection SP connection object
   * @returns {Promise<WSFedSpConnection>} a promise resolving to the created SP connection object
   */
  createSpConnection(
    spConnection: WSFedSpConnection
  ): Promise<WSFedSpConnection>;
  // /**
  //  * Read authentication policies
  //  * @returns {Promise<WSFedAuthenticationPolicy[]>} a promise resolving to an array of authentication policy objects
  //  */
  // readAuthenticationPolicies(): Promise<WSFedAuthenticationPolicy[]>;
  /**
   * Update SP connection
   * @param {string} id SP connection ID
   * @param {WSFedSpConnection} spConnection SP connection object
   * @returns {Promise<WSFedSpConnection>} a promise resolving to the updated SP connection object
   */
  updateSpConnectionById(
    id: string,
    spConnection: WSFedSpConnection
  ): Promise<WSFedSpConnection>;
  // /**
  //  * Read authentication policy contracts
  //  * @returns {Promise<WSFedAuthenticationPolicyContract[]>} a promise resolving to an array of authentication policy contract objects
  //  */
  // readAuthenticationPolicyContracts(): Promise<
  //   WSFedAuthenticationPolicyContract[]
  // >;
  /**
   * Read authentication policy contract by ID
   * @param {string} id authentication policy contract ID
   * @returns {Promise<WSFedAuthenticationPolicyContract>} a promise resolving to the authentication policy contract object
   */
  readAuthenticationPolicyContractById(
    id: string
  ): Promise<WSFedAuthenticationPolicyContract>;
  /**
   * Create authentication policy contract
   * @param {WSFedAuthenticationPolicyContractRequest} authenticationPolicyContractRequest authentication policy contract object
   * @returns {Promise<WSFedAuthenticationPolicyContract>} a promise resolving to the created authentication policy contract object
   */
  createAuthenticationPolicyContract(
    authenticationPolicyContractRequest: WSFedAuthenticationPolicyContractRequest
  ): Promise<WSFedAuthenticationPolicyContract>;
  /**
   * Update authentication policy contract
   * @param {string} id authentication policy contract ID
   * @param {WSFedAuthenticationPolicyContractRequest} authenticationPolicyContractRequest authentication policy contract object
   * @returns {Promise<WSFedAuthenticationPolicyContract>} a promise resolving to the updated authentication policy contract object
   */
  updateAuthenticationPolicyContractById(
    id: string,
    authenticationPolicyContractRequest: WSFedAuthenticationPolicyContractRequest
  ): Promise<WSFedAuthenticationPolicyContract>;
  /**
   * Generate signing key pair
   * add params for key type and key size to be passed to the API. Also, update the return type to be string instead of unknown to be consistent with the rest of the codebase.
   * @param {WSFedSigningKeyPairRequest} params parameters for generating the signing key pair
   * @returns {Promise<string>} a promise resolving to the generated public key
   */
  generateSigningKeyPair(params: WSFedSigningKeyPairRequest): Promise<string>;
  /**
   * Read signing key pair by id
   * @param {string} id signing key pair ID
   * @returns {Promise<string>} a promise resolving to the signing key pair object
   */
  readSigningKeyPairById(id: string): Promise<WSFedSigningKeyPair>;
  // /**
  //  * Read signing key pairs
  //  * @returns {Promise<WSFedResponseItems<WSFedSigningKeyPair>>} a promise resolving to the signing key pair object
  //  */
  // readSigningKeyPairs(): Promise<WSFedSigningKeyPair[]>;
  /**
   * Read signing key pair certificate
   * @param {string} keyPairId signing key pair ID
   * @returns {Promise<string>} a promise resolving to the signing key pair certificate
   */
  readSigningKeyPairCertificate(keyPairId: string): Promise<string>;
  /**
   * Update or create signing key pair certificate
   * @param {string} keyPairId signing key pair ID
   * @param {string} certificate the certificate to update or create for the signing key pair
   * @returns {Promise<string>} a promise resolving to the updated or created signing key pair certificate
   */
  updateOrCreateSigningKeyPairCertificate(
    keyPairId: string,
    certificate: string
  ): Promise<string>;
  /**
   * Delete signing key pair by id
   * @param {string} id signing key pair ID
   * @returns {Promise<void>} a promise that resolves when the signing key pair is deleted
   */
  deleteSigningKeyPairById(id: string): Promise<void>;
  /**
   * Delete signing key pair certificate
   * @param {string} keyPairId signing key pair ID
   * @returns {Promise<void>} a promise that resolves when the signing key pair certificate is deleted
   */
  deleteSigningKeyPairCertificate(keyPairId: string): Promise<void>;
  /**
   * Read federation info
   * @returns {Promise<WSFedFederationInfo>} a promise resolving to the federation info object
   */
  readFederationInfo(): Promise<WSFedFederationInfo>;
  /**
   * Update federation info
   * @param {WSFedFederationInfo} federationInfo federation info object
   * @returns {Promise<WSFedFederationInfo>} a promise resolving to the updated federation info object
   */
  updateFederationInfo(
    federationInfo: WSFedFederationInfo
  ): Promise<WSFedFederationInfo>;
  /**
   * Read virtual host names
   * @returns {Promise<string[]>} a promise resolving to an array of virtual host names
   */
  readVirtualHostNames(): Promise<string[]>;
  /**
   * Read IdP adapters
   * @returns {Promise<WSFedIdpAdapter[]>} a promise resolving to an array of IdP adapter objects
   */
  readIdpAdapters(): Promise<WSFedIdpAdapter[]>;
  /**
   * Read IdP adapter by ID
   * @param {string} id IdP adapter ID
   * @returns {Promise<WSFedIdpAdapter>} a promise resolving to the IdP adapter object
   */
  readIdpAdapterById(id: string): Promise<WSFedIdpAdapter>;
  /**
   * Update IdP adapter by ID
   * @param {string} id IdP adapter ID
   * @param {WSFedIdpAdapter} idpAdapter IdP adapter object
   * @returns {Promise<WSFedIdpAdapter>} a promise resolving to the updated IdP adapter object
   */
  updateIdpAdapterById(
    id: string,
    idpAdapter: WSFedIdpAdapter
  ): Promise<WSFedIdpAdapter>;
  /**
   * Create IdP adapter
   * @param {WSFedIdpAdapter} idpAdapter IdP adapter object
   * @returns {Promise<WSFedIdpAdapter>} a promise resolving to the created IdP adapter object
   */
  createIdpAdapter(idpAdapter: WSFedIdpAdapter): Promise<WSFedIdpAdapter>;
  /**
   * Delete IdP adapter by ID
   * @param {string} id IdP adapter ID
   * @returns {Promise<void>} a promise that resolves when the IdP adapter is deleted
   */
  deleteIdpAdapterById(id: string): Promise<void>;
  /**
   * Read authentication policy by ID
   * @param {string} id Authentication policy ID
   * @returns {Promise<WSFedAuthenticationPolicy>} a promise resolving to the authentication policy object
   */
  readAuthenticationPolicyById(id: string): Promise<WSFedAuthenticationPolicy>;
  /**
   * Create authentication policy
   * @param {WSFedAuthenticationPolicyRequest} authenticationPolicyRequest authentication policy request object
   * @returns {Promise<WSFedAuthenticationPolicy>} a promise resolving to the created authentication policy object
   */
  createAuthenticationPolicy(
    authenticationPolicyRequest: WSFedAuthenticationPolicyRequest
  ): Promise<WSFedAuthenticationPolicy>;
  /**
   * Update authentication policy by ID
   * @param {string} id Authentication policy ID
   * @param {WSFedAuthenticationPolicyRequest} authenticationPolicyRequest authentication policy request object
   * @returns {Promise<WSFedAuthenticationPolicy>} a promise resolving to the updated authentication policy object
   */
  updateAuthenticationPolicyById(
    id: string,
    authenticationPolicyRequest: WSFedAuthenticationPolicyRequest
  ): Promise<WSFedAuthenticationPolicy>;
};

export default (state: State): WSFed => {
  return {
    readSpConnections() {
      return readSpConnections({ state });
    },
    readSpConnectionById(id: string) {
      return getSpConnectionById({ id, state });
    },
    createSpConnection(spConnection: WSFedSpConnection) {
      return createSpConnection({ spConnection, state });
    },
    // readAuthenticationPolicies() {
    //   return readAuthenticationPolicies({ state });
    // },
    updateSpConnectionById(id: string, spConnection: WSFedSpConnection) {
      return updateSpConnectionById({ id, spConnection, state });
    },
    // readAuthenticationPolicyContracts() {
    //   return readAuthenticationPolicyContracts({ state });
    // },
    readAuthenticationPolicyContractById(id: string) {
      return _getAuthenticationPolicyContractById({ id, state });
    },
    createAuthenticationPolicyContract(
      authenticationPolicyContractRequest: WSFedAuthenticationPolicyContractRequest
    ) {
      return createAuthenticationPolicyContract({
        authenticationPolicyContractRequest,
        state,
      });
    },
    updateAuthenticationPolicyContractById(
      id: string,
      authenticationPolicyContractRequest: WSFedAuthenticationPolicyContractRequest
    ) {
      return updateAuthenticationPolicyContractById({
        id,
        authenticationPolicyContractRequest,
        state,
      });
    },
    generateSigningKeyPair(params: WSFedSigningKeyPairRequest) {
      return generateSigningKeyPair({ params, state });
    },
    readSigningKeyPairById(id: string) {
      return readSigningKeyPairById({ id, state });
    },
    // readSigningKeyPairs() {
    //   return readSigningKeyPairs({ state });
    // },
    readSigningKeyPairCertificate(keyPairId: string) {
      return readSigningKeyPairCertificate({ keyPairId, state });
    },
    updateOrCreateSigningKeyPairCertificate(
      keyPairId: string,
      certificate: string
    ) {
      return updateOrCreateSigningKeyPairCertificate({
        keyPairId,
        certificate,
        state,
      });
    },
    deleteSigningKeyPairById(id: string) {
      return deleteSigningKeyPairById({ id, state });
    },
    deleteSigningKeyPairCertificate(keyPairId: string) {
      return deleteSigningKeyPairCertificate({ keyPairId, state });
    },
    readFederationInfo() {
      return readFederationInfo({ state });
    },
    updateFederationInfo(federationInfo: WSFedFederationInfo) {
      return updateFederationInfo({ federationInfo, state });
    },
    readVirtualHostNames() {
      return readVirtualHostNames({ state });
    },
    readIdpAdapters() {
      return readIdpAdapters({ state });
    },
    readIdpAdapterById(id: string) {
      return readIdpAdapterById({ id, state });
    },
    updateIdpAdapterById(id: string, idpAdapter: WSFedIdpAdapter) {
      return updateIdpAdapterById({ id, idpAdapter, state });
    },
    createIdpAdapter(idpAdapter: WSFedIdpAdapter) {
      return createIdpAdapter({ idpAdapter, state });
    },
    deleteIdpAdapterById(id: string) {
      return deleteIdpAdapterById({ id, state });
    },
    readAuthenticationPolicyById(id: string) {
      return readAuthenticationPolicyById({ id, state });
    },
    createAuthenticationPolicy(
      authenticationPolicyRequest: WSFedAuthenticationPolicyRequest
    ) {
      return createAuthenticationPolicy({ authenticationPolicyRequest, state });
    },
    updateAuthenticationPolicyById(
      id: string,
      authenticationPolicyRequest: WSFedAuthenticationPolicyRequest
    ) {
      return updateAuthenticationPolicyById({
        id,
        authenticationPolicyRequest,
        state,
      });
    },
  };
};

// create wrappers for all WSFedApi operations here (import from WSFedApi). See ServiceAccountOps.ts and ServiceAccountApi.ts for examples. Also, use read instead of get to be consistent with other ops files.

/**
 * Read SP connections
 * @param {State} state library state
 * @returns {Promise<WSFedSpConnection[]>} a promise resolving to an array of SP connection objects
 */
export async function readSpConnections({
  state,
}: {
  state: State;
}): Promise<WSFedSpConnection[]> {
  try {
    debugMessage({
      message: `WSFedOps.readSpConnections: start`,
      state,
    });
    const responseItems: WSFedResponseItems<WSFedSpConnection> =
      await _getSpConnections({ state });
    debugMessage({ message: responseItems, state });
    debugMessage({
      message: `WSFedOps.readSpConnections: end`,
      state,
    });
    return responseItems.items as WSFedSpConnection[];
  } catch (error) {
    throw new FrodoError(`Error reading SP connections`, error);
  }
}

/**
 * Read SP connection by ID
 * @param {string} id SP connection ID
 * @param {State} state library state
 * @returns {Promise<WSFedSpConnection>} a promise resolving to the SP connection object
 */
export async function readSpConnectionById({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<WSFedSpConnection> {
  try {
    debugMessage({
      message: `WSFedOps.readSpConnectionById: start`,
      state,
    });
    // rewrite this to use getSpConnectionById from WSFedApi instead of getting all SP connections and finding the one with the matching ID. Also, update the return type to be WSFedSpConnection instead of SpConnection to be consistent with the rest of the codebase.
    const spConnection = await _getSpConnectionById({ id, state });
    debugMessage({
      message: `WSFedOps.readSpConnectionById: end`,
      state,
    });
    if (!spConnection) {
      throw new FrodoError(`SP connection with ID ${id} not found`);
    }
    return spConnection as WSFedSpConnection;
  } catch (error) {
    throw new FrodoError(`Error reading SP connection with ID ${id}`, error);
  }
}

/**
 * Create SP connection
 * @param {WSFedSpConnection} spConnection SP connection object
 * @param {State} state library state
 * @returns {Promise} a promise resolving to the created SP connection object
 */
export async function createSpConnection({
  spConnection,
  state,
}: {
  spConnection: WSFedSpConnection;
  state: State;
}) {
  try {
    debugMessage({
      message: `WSFedOps.createSpConnection: start`,
      state,
    });
    const response = await _createSpConnection({ spConnection, state });
    debugMessage({ message: response, state });
    debugMessage({
      message: `WSFedOps.createSpConnection: end`,
      state,
    });
    return response as WSFedSpConnection;
  } catch (error) {
    throw new FrodoError(`Error creating SP connection`, error);
  }
}

/**
 * Update SP connection
 * @param {string} id SP connection ID
 * @param {WSFedSpConnection} spConnection SP connection object
 * @param {State} state library state
 * @returns {Promise<WSFedSpConnection>} a promise resolving to the updated SP connection object
 */
export async function updateSpConnectionById({
  id,
  spConnection,
  state,
}: {
  id: string;
  spConnection: WSFedSpConnection;
  state: State;
}): Promise<WSFedSpConnection> {
  try {
    debugMessage({
      message: `WSFedOps.updateSpConnectionById: start`,
      state,
    });
    const response = await _updateSpConnectionById({ id, spConnection, state });
    debugMessage({ message: response, state });
    debugMessage({
      message: `WSFedOps.updateSpConnectionById: end`,
      state,
    });
    return response as WSFedSpConnection;
  } catch (error) {
    throw new FrodoError(`Error updating SP connection`, error);
  }
}

// /**
//  * Read authentication policy contracts
//  * @param {State} state library state
//  */
// export async function readAuthenticationPolicyContracts({
//   state,
// }: {
//   state: State;
// }) {
//   try {
//     debugMessage({
//       message: `WSFedOps.readAuthenticationPolicyContracts: start`,
//       state,
//     });
//     const responseItems: WSFedResponseItems<WSFedAuthenticationPolicyContract> =
//       await _getAuthenticationPolicyContracts({ state });
//     debugMessage({
//       message: `WSFedOps.readAuthenticationPolicyContracts: end`,
//       state,
//     });
//     return responseItems.items as WSFedAuthenticationPolicyContract[];
//   } catch (error) {
//     throw new FrodoError(
//       `Error reading authentication policy contracts`,
//       error
//     );
//   }
// }

/**
 * Read authentication policy contracts by ID
 * @param {string} id authentication policy contract ID
 * @param {State} state library state
 */
export async function readAuthenticationPolicyContractById({
  id,
  state,
}: {
  id: string;
  state: State;
}) {
  try {
    debugMessage({
      message: `WSFedOps.readAuthenticationPolicyContractById: start`,
      state,
    });
    const response = await _getAuthenticationPolicyContractById({ id, state });
    debugMessage({
      message: `WSFedOps.readAuthenticationPolicyContractById: end`,
      state,
    });
    if (!response) {
      throw new FrodoError(
        `Authentication policy contract with ID ${id} not found`
      );
    }
    return response as WSFedAuthenticationPolicyContract;
  } catch (error) {
    throw new FrodoError(
      `Error reading authentication policy contract with ID ${id}`,
      error
    );
  }
}

/**
 * Create authentication policy contract
 * @param {WSFedAuthenticationPolicyContractRequest} authenticationPolicyContractRequest authentication policy contract object
 * @param {State} state library state
 * @returns {Promise<WSFedAuthenticationPolicyContract>} a promise resolving to the created authentication policy contract object
 */
export async function createAuthenticationPolicyContract({
  authenticationPolicyContractRequest,
  state,
}: {
  authenticationPolicyContractRequest: WSFedAuthenticationPolicyContractRequest;
  state: State;
}): Promise<WSFedAuthenticationPolicyContract> {
  try {
    debugMessage({
      message: `WSFedOps.createAuthenticationPolicyContract: start`,
      state,
    });
    // rewrite this to use createAuthenticationPolicyContract from WSFedApi instead of getting all authentication policy contracts and finding the one with the matching name. Also, update the return type to be WSFedAuthenticationPolicyContract instead of unknown to be consistent with the rest of the codebase.
    const response = await _createAuthenticationPolicyContract({
      authenticationPolicyContractRequest,
      state,
    });
    debugMessage({
      message: `WSFedOps.createAuthenticationPolicyContract: end`,
      state,
    });
    return response as WSFedAuthenticationPolicyContract;
  } catch (error) {
    throw new FrodoError(
      `Error creating authentication policy contract`,
      error
    );
  }
}

/**
 * Update authentication policy contract
 * @param {string} id authentication policy contract ID
 * @param {WSFedAuthenticationPolicyContractRequest} authenticationPolicyContractRequest authentication policy contract object
 * @param {State} state library state
 * @returns {Promise<WSFedAuthenticationPolicyContract>} a promise resolving to the updated authentication policy contract object
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
  try {
    debugMessage({
      message: `WSFedOps.updateAuthenticationPolicyContractById: start`,
      state,
    });
    // rewrite this to use updateAuthenticationPolicyContractById from WSFedApi instead of getting all authentication policy contracts and finding the one with the matching ID. Also, update the return type to be WSFedAuthenticationPolicyContract instead of unknown to be consistent with the rest of the codebase.
    const response = await _updateAuthenticationPolicyContractById({
      id,
      authenticationPolicyContractRequest,
      state,
    });
    debugMessage({
      message: `WSFedOps.updateAuthenticationPolicyContractById: end`,
      state,
    });
    return response as WSFedAuthenticationPolicyContract;
  } catch (error) {
    throw new FrodoError(
      `Error updating authentication policy contract`,
      error
    );
  }
}

/**
 * Generate signing key pair
 * add params for key type and key size to be passed to the API. Also, update the return type to be string instead of unknown to be consistent with the rest of the codebase.
 * @param {WSFedSigningKeyPairRequest} params parameters for generating the signing key pair
 * @param {State} state library state
 * @returns {Promise<string>} a promise resolving to the generated public key
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
  params: WSFedSigningKeyPairRequest;
  state: State;
}): Promise<string> {
  try {
    debugMessage({
      message: `WSFedOps.generateSigningKeyPair: start`,
      state,
    });
    const jwks = await _generateSigningKeyPair({ params, state });
    debugMessage({
      message: `WSFedOps.generateSigningKeyPair: end`,
      state,
    });
    return JSON.stringify(jwks);
  } catch (error) {
    throw new FrodoError(`Error generating signing key pair`, error);
  }
}

/**
 * Read signing key pair by id
 * @param {string} id signing key pair ID
 * @param {State} state library state
 * @returns {Promise<WSFedSigningKeyPair>} a promise resolving to the signing key pair object
 */
export async function readSigningKeyPairById({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<WSFedSigningKeyPair> {
  try {
    debugMessage({
      message: `WSFedOps.readSigningKeyPairById: start`,
      state,
    });
    const keyPair: WSFedSigningKeyPair = await _getSigningKeyPairById({
      id,
      state,
    });
    debugMessage({
      message: `WSFedOps.readSigningKeyPairById: end`,
      state,
    });
    return keyPair;
  } catch (error) {
    throw new FrodoError(`Error reading signing key pair by id`, error);
  }
}

// /**
//  * Read signing key pairs
//  * @param {State} state library state
//  * @returns {Promise<WSFedSigningKeyPair[]>} a promise resolving to an array of signing key pair objects
//  */
// export async function readSigningKeyPairs({
//   state,
// }: {
//   state: State;
// }): Promise<WSFedSigningKeyPair[]> {
//   try {
//     debugMessage({
//       message: `WSFedOps.readSigningKeyPairs: start`,
//       state,
//     });
//     const responseItems: WSFedResponseItems<WSFedSigningKeyPair> =
//       await _getSigningKeyPairs({ state });
//     debugMessage({
//       message: `WSFedOps.readSigningKeyPairs: end`,
//       state,
//     });
//     return responseItems.items as WSFedSigningKeyPair[];
//   } catch (error) {
//     throw new FrodoError(`Error reading signing key pairs`, error);
//   }
// }

/**
 * Update or create signing key pair by id
 * @param {string} id signing key pair ID
 * @param {WSFedSigningKeyPairRequest} params parameters for generating the signing key pair
 * @param {State} state library state
 * @returns {Promise<WSFedSigningKeyPair>} a promise resolving to the updated or created signing key pair object
 */
export async function updateOrCreateSigningKeyPairById({
  id,
  params,
  state,
}: {
  id: string;
  params: WSFedSigningKeyPairRequest;
  state: State;
}): Promise<WSFedSigningKeyPair> {
  try {
    debugMessage({
      message: `WSFedOps.updateOrCreateSigningKeyPairById: start`,
      state,
    });
    const keyPair: WSFedSigningKeyPair =
      await _updateOrCreateSigningKeyPairById({ id, params, state });
    debugMessage({
      message: `WSFedOps.updateOrCreateSigningKeyPairById: end`,
      state,
    });
    return keyPair;
  } catch (error) {
    throw new FrodoError(
      `Error updating or creating signing key pair by id`,
      error
    );
  }
}

/**
 * Read signing key pair certificate
 * @param {string} keyPairId signing key pair ID
 * @param {State} state library state
 * @returns {Promise<string>} a promise resolving to the signing key pair certificate
 */
export async function readSigningKeyPairCertificate({
  keyPairId,
  state,
}: {
  keyPairId: string;
  state: State;
}): Promise<string> {
  try {
    debugMessage({
      message: `WSFedOps.readSigningKeyPairCertificate: start`,
      state,
    });
    const cert: string = await _getSigningKeyPairCertificate({
      keyPairId,
      state,
    });
    debugMessage({
      message: `WSFedOps.readSigningKeyPairCertificate: end`,
      state,
    });
    return cert;
  } catch (error) {
    throw new FrodoError(`Error reading signing key pair certificate`, error);
  }
}

/**
 * Update or create signing key pair certificate
 * @param {string} keyPairId signing key pair ID
 * @param {string} certificate the certificate to update or create for the signing key pair
 * @param {State} state library state
 * @returns {Promise<string>} a promise resolving to the updated or created signing key pair certificate
 */
export async function updateOrCreateSigningKeyPairCertificate({
  keyPairId,
  certificate,
  state,
}: {
  keyPairId: string;
  certificate: string;
  state: State;
}): Promise<string> {
  try {
    debugMessage({
      message: `WSFedOps.updateOrCreateSigningKeyPairCertificate: start`,
      state,
    });
    const updatedCertificate: string =
      await _updateOrCreateSigningKeyPairCertificate({
        keyPairId,
        certificate,
        state,
      });
    debugMessage({
      message: `WSFedOps.updateOrCreateSigningKeyPairCertificate: end`,
      state,
    });
    return updatedCertificate;
  } catch (error) {
    throw new FrodoError(
      `Error updating or creating signing key pair certificate`,
      error
    );
  }
}

/**
 * Delete signing key pair by id
 * @param {string} id signing key pair ID
 * @param {State} state library state
 * @returns {Promise<void>} a promise that resolves when the signing key pair is deleted
 */
export async function deleteSigningKeyPairById({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<void> {
  try {
    debugMessage({
      message: `WSFedOps.deleteSigningKeyPairById: start`,
      state,
    });
    await _deleteSigningKeyPairById({ id, state });
    debugMessage({
      message: `WSFedOps.deleteSigningKeyPairById: end`,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error deleting signing key pair by id`, error);
  }
}

/**
 * Delete signing key pair certificate
 * @param {string} keyPairId signing key pair ID
 * @param {State} state library state
 * @returns {Promise<void>} a promise that resolves when the signing key pair certificate is deleted
 */
export async function deleteSigningKeyPairCertificate({
  keyPairId,
  state,
}: {
  keyPairId: string;
  state: State;
}): Promise<void> {
  try {
    debugMessage({
      message: `WSFedOps.deleteSigningKeyPairCertificate: start`,
      state,
    });
    await _deleteSigningKeyPairCertificate({ keyPairId, state });
    debugMessage({
      message: `WSFedOps.deleteSigningKeyPairCertificate: end`,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error deleting signing key pair certificate`, error);
  }
}

/**
 * Read federation info
 * @param {State} state library state
 * @returns {Promise<WSFedFederationInfo>} a promise resolving to the federation info object
 */
export async function readFederationInfo({
  state,
}: {
  state: State;
}): Promise<WSFedFederationInfo> {
  try {
    debugMessage({
      message: `WSFedOps.readFederationInfo: start`,
      state,
    });
    const federationInfo: WSFedFederationInfo = await _getFederationInfo({
      state,
    });
    debugMessage({
      message: `WSFedOps.readFederationInfo: end`,
      state,
    });
    return federationInfo;
  } catch (error) {
    throw new FrodoError(`Error reading federation info`, error);
  }
}

/**
 * Update federation info
 * @param {WSFedFederationInfo} federationInfo federation info object
 * @param {State} state library state
 * @returns {Promise<WSFedFederationInfo>} a promise resolving to the updated federation info object
 */
export async function updateFederationInfo({
  federationInfo,
  state,
}: {
  federationInfo: WSFedFederationInfo;
  state: State;
}): Promise<WSFedFederationInfo> {
  try {
    debugMessage({
      message: `WSFedOps.updateFederationInfo: start`,
      state,
    });
    const updatedFederationInfo: WSFedFederationInfo =
      await _updateFederationInfo({ federationInfo, state });
    debugMessage({
      message: `WSFedOps.updateFederationInfo: end`,
      state,
    });
    return updatedFederationInfo;
  } catch (error) {
    throw new FrodoError(`Error updating federation info`, error);
  }
}

/**
 * Read virtual host names
 * @param {State} state library state
 * @returns {Promise<string[]>} a promise resolving to an array of virtual host names
 */
export async function readVirtualHostNames({
  state,
}: {
  state: State;
}): Promise<string[]> {
  try {
    debugMessage({
      message: `WSFedOps.readVirtualHostNames: start`,
      state,
    });
    const response: WSFedVirtualHostNames = await _getVirtualHostNames({
      state,
    });
    debugMessage({
      message: `WSFedOps.readVirtualHostNames: end`,
      state,
    });
    return response.virtualHostNames;
  } catch (error) {
    throw new FrodoError(`Error reading virtual host names`, error);
  }
}

/**
 * Read IdP adapters
 * @param {State} state library state
 * @returns {Promise<WSFedIdpAdapter[]>} a promise resolving to an array of IdP adapter objects
 */
export async function readIdpAdapters({
  state,
}: {
  state: State;
}): Promise<WSFedIdpAdapter[]> {
  try {
    debugMessage({
      message: `WSFedOps.readIdpAdapters: start`,
      state,
    });
    const responseItems: WSFedResponseItems<WSFedIdpAdapter> =
      await _getIdpAdapters({ state });
    debugMessage({
      message: `WSFedOps.readIdpAdapters: end`,
      state,
    });
    return responseItems.items as WSFedIdpAdapter[];
  } catch (error) {
    throw new FrodoError(`Error reading IdP adapters`, error);
  }
}

/**
 * Read IdP adapter by ID
 * @param {string} id IdP adapter ID
 * @param {State} state library state
 * @returns {Promise<WSFedIdpAdapter>} a promise resolving to the IdP adapter object
 */
export async function readIdpAdapterById({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<WSFedIdpAdapter> {
  try {
    debugMessage({
      message: `WSFedOps.readIdpAdapterById: start`,
      state,
    });
    const idpAdapter = await _getIdpAdapterById({ id, state });
    debugMessage({
      message: `WSFedOps.readIdpAdapterById: end`,
      state,
    });
    if (!idpAdapter) {
      throw new FrodoError(`IdP adapter with ID ${id} not found`);
    }
    return idpAdapter as WSFedIdpAdapter;
  } catch (error) {
    throw new FrodoError(`Error reading IdP adapter with ID ${id}`, error);
  }
}

/**
 * Update IdP adapter by ID
 * @param {string} id IdP adapter ID
 * @param {WSFedIdpAdapter} idpAdapter IdP adapter object
 */
export async function updateIdpAdapterById({
  id,
  idpAdapter,
  state,
}: {
  id: string;
  idpAdapter: WSFedIdpAdapter;
  state: State;
}): Promise<WSFedIdpAdapter> {
  try {
    debugMessage({
      message: `WSFedOps.updateIdpAdapterById: start`,
      state,
    });
    const updatedIdpAdapter = await _updateIdpAdapterById({
      id,
      idpAdapter,
      state,
    });
    debugMessage({
      message: `WSFedOps.updateIdpAdapterById: end`,
      state,
    });
    return updatedIdpAdapter as WSFedIdpAdapter;
  } catch (error) {
    throw new FrodoError(`Error updating IdP adapter with ID ${id}`, error);
  }
}

/**
 * Create IdP adapter
 * @param {WSFedIdpAdapter} idpAdapter IdP adapter object
 * @param {State} state library state
 * @returns {Promise<WSFedIdpAdapter>} a promise resolving to the created IdP adapter object
 */
export async function createIdpAdapter({
  idpAdapter,
  state,
}: {
  idpAdapter: WSFedIdpAdapter;
  state: State;
}): Promise<WSFedIdpAdapter> {
  try {
    debugMessage({
      message: `WSFedOps.createIdpAdapter: start`,
      state,
    });
    const createdIdpAdapter = await _createIdpAdapter({ idpAdapter, state });
    debugMessage({
      message: `WSFedOps.createIdpAdapter: end`,
      state,
    });
    return createdIdpAdapter as WSFedIdpAdapter;
  } catch (error) {
    throw new FrodoError(`Error creating IdP adapter`, error);
  }
}

/**
 * Delete IdP adapter by ID
 * @param {string} id IdP adapter ID
 * @param {State} state library state
 * @returns {Promise<void>} a promise resolving when the IdP adapter is deleted
 */
export async function deleteIdpAdapterById({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<void> {
  try {
    debugMessage({
      message: `WSFedOps.deleteIdpAdapterById: start`,
      state,
    });
    await _deleteIdpAdapterById({ id, state });
    debugMessage({
      message: `WSFedOps.deleteIdpAdapterById: end`,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error deleting IdP adapter with ID ${id}`, error);
  }
}

// /**
//  * Read authentication policies
//  * @param {State} state library state
//  * @returns {Promise<WSFedAuthenticationPolicy[]>} a promise resolving to an array of authentication policy objects
//  */
// export async function readAuthenticationPolicies({
//   state,
// }: {
//   state: State;
// }): Promise<WSFedAuthenticationPolicy[]> {
//   try {
//     debugMessage({
//       message: `WSFedOps.readAuthenticationPolicies: start`,
//       state,
//     });
//     const responseItems: WSFedResponseItems<WSFedAuthenticationPolicy> =
//       await _getAuthenticationPolicies({ state });
//     debugMessage({ message: responseItems, state });
//     debugMessage({
//       message: `WSFedOps.readAuthenticationPolicies: end`,
//       state,
//     });
//     return responseItems.items as WSFedAuthenticationPolicy[];
//   } catch (error) {
//     throw new FrodoError(`Error reading authentication policies`, error);
//   }
// }

/**
 * Read authentication policy by ID
 * @param {string} id authentication policy ID
 * @param {State} state library state
 * @returns {Promise<WSFedAuthenticationPolicy>} a promise resolving to the authentication policy object
 */
export async function readAuthenticationPolicyById({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<WSFedAuthenticationPolicy> {
  try {
    debugMessage({
      message: `WSFedOps.readAuthenticationPolicyById: start`,
      state,
    });
    const authenticationPolicy = await _getAuthenticationPolicyById({
      id,
      state,
    });
    debugMessage({
      message: `WSFedOps.readAuthenticationPolicyById: end`,
      state,
    });
    return authenticationPolicy as WSFedAuthenticationPolicy;
  } catch (error) {
    throw new FrodoError(
      `Error reading authentication policy with ID ${id}`,
      error
    );
  }
}

/**
 * Create authentication policy
 * @param {WSFedAuthenticationPolicyRequest} authenticationPolicyRequest authentication policy object
 * @param {State} state library state
 * @returns {Promise<WSFedAuthenticationPolicy>} a promise resolving to the created authentication policy object
 */
export async function createAuthenticationPolicy({
  authenticationPolicyRequest,
  state,
}: {
  authenticationPolicyRequest: WSFedAuthenticationPolicyRequest;
  state: State;
}): Promise<WSFedAuthenticationPolicy> {
  try {
    debugMessage({
      message: `WSFedOps.createAuthenticationPolicy: start`,
      state,
    });
    const createdAuthenticationPolicy = await _createAuthenticationPolicy({
      authenticationPolicyRequest,
      state,
    });
    debugMessage({
      message: `WSFedOps.createAuthenticationPolicy: end`,
      state,
    });
    return createdAuthenticationPolicy as WSFedAuthenticationPolicy;
  } catch (error) {
    throw new FrodoError(`Error creating authentication policy`, error);
  }
}

/**
 * Update authentication policy by ID
 * @param {string} id authentication policy ID
 * @param {WSFedAuthenticationPolicyRequest} authenticationPolicyRequest authentication policy object
 * @param {State} state library state
 * @returns {Promise<WSFedAuthenticationPolicy>} a promise resolving to the updated authentication policy object
 */
export async function updateAuthenticationPolicyById({
  id,
  authenticationPolicyRequest,
  state,
}: {
  id: string;
  authenticationPolicyRequest: WSFedAuthenticationPolicyRequest;
  state: State;
}): Promise<WSFedAuthenticationPolicy> {
  try {
    debugMessage({
      message: `WSFedOps.updateAuthenticationPolicyById: start`,
      state,
    });
    const updatedAuthenticationPolicy = await _updateAuthenticationPolicyById({
      id,
      authenticationPolicyRequest,
      state,
    });
    debugMessage({
      message: `WSFedOps.updateAuthenticationPolicyById: end`,
      state,
    });
    return updatedAuthenticationPolicy as WSFedAuthenticationPolicy;
  } catch (error) {
    throw new FrodoError(
      `Error updating authentication policy with ID ${id}`,
      error
    );
  }
}

/**
 * Replicate cluster configuration
 * @param {State} state library state
 * @returns {Promise<WSFedClusterReplicateResponse>} a promise that resolves to the cluster replicate response
 */
export async function replicate({
  state,
}: {
  state: State;
}): Promise<WSFedClusterReplicateResponse> {
  try {
    debugMessage({
      message: `WSFedOps.replicate: start`,
      state,
    });
    const response = await _replicate({ state });
    debugMessage({
      message: `WSFedOps.replicate: end`,
      state,
    });
    return response as WSFedClusterReplicateResponse;
  } catch (error) {
    throw new FrodoError(`Error replicating cluster configuration`, error);
  }
}
