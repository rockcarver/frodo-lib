import { type NoIdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  deleteOAuth2TrustedJwtIssuer as _deleteOAuth2TrustedJwtIssuer,
  getOAuth2TrustedJwtIssuer as _getOAuth2TrustedJwtIssuer,
  getOAuth2TrustedJwtIssuers as _getOAuth2TrustedJwtIssuers,
  type OAuth2TrustedJwtIssuerSkeleton,
  putOAuth2TrustedJwtIssuer as _putOAuth2TrustedJwtIssuer,
} from '../api/OAuth2TrustedJwtIssuerApi';
import { State } from '../shared/State';
import { debugMessage, printMessage } from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { ExportMetaData } from './OpsTypes';

export type OAuth2TrustedJwtIssuer = {
  /**
   * Create an empty OAuth2 trusted jwt issuer export template
   * @returns {OAuth2TrustedJwtIssuerExportInterface} an empty OAuth2 trusted jwt issuer export template
   */
  createOAuth2TrustedJwtIssuerExportTemplate(): OAuth2TrustedJwtIssuerExportInterface;
  /**
   * Read all OAuth2 trusted jwt issuers
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an array of trusted jwt issuer objects
   */
  readOAuth2TrustedJwtIssuers(): Promise<OAuth2TrustedJwtIssuerSkeleton[]>;
  /**
   * Read OAuth2 trusted jwt issuer
   * @param {string} issuerId trusted jwt issuer id
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to an trusted jwt issuer object
   */
  readOAuth2TrustedJwtIssuer(
    issuerId: string
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
  /**
   * Create OAuth2 trusted jwt issuer
   * @param {string} issuerId trusted jwt issuer id
   * @param {any} issuerData trusted jwt issuer object
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to an trusted jwt issuer object
   */
  createOAuth2TrustedJwtIssuer(
    issuerId: string,
    issuerData: OAuth2TrustedJwtIssuerSkeleton
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
  /**
   * Update or create OAuth2 trusted jwt issuer
   * @param {string} issuerId trusted jwt issuer id
   * @param {any} issuerData trusted jwt issuer object
   * @returns {Promise<any>} a promise that resolves to an trusted jwt issuer object
   */
  updateOAuth2TrustedJwtIssuer(
    issuerId: string,
    issuerData: OAuth2TrustedJwtIssuerSkeleton
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
  /**
   * Delete all OAuth2 trusted jwt issuers
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an array of trusted jwt issuer objects
   */
  deleteOAuth2TrustedJwtIssuers(): Promise<OAuth2TrustedJwtIssuerSkeleton[]>;
  /**
   * Delete OAuth2 trusted jwt issuer
   * @param {string} issuerId trusted jwt issuer id
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to an trusted jwt issuer object
   */
  deleteOAuth2TrustedJwtIssuer(
    issuerId: string
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
  /**
   * Export all OAuth2 trusted jwt issuers
   * @param {OAuth2TrustedJwtIssuerExportOptions} options export options
   * @returns {OAuth2TrustedJwtIssuerExportInterface} export data
   */
  exportOAuth2TrustedJwtIssuers(
    options?: OAuth2TrustedJwtIssuerExportOptions
  ): Promise<OAuth2TrustedJwtIssuerExportInterface>;
  /**
   * Export OAuth2 trusted jwt issuer by ID
   * @param {string} issuerId oauth2 trusted jwt issuer id
   * @param {OAuth2TrustedJwtIssuerExportOptions} options export options
   * @returns {OAuth2TrustedJwtIssuerExportInterface} export data
   */
  exportOAuth2TrustedJwtIssuer(
    issuerId: string,
    options?: OAuth2TrustedJwtIssuerExportOptions
  ): Promise<OAuth2TrustedJwtIssuerExportInterface>;
  /**
   * Import OAuth2 Client by ID
   * @param {string} issuerId trusted jwt issuer id
   * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
   * @param {OAuth2TrustedJwtIssuerImportOptions} options import options
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise resolving to an oauth2 trusted jwt issuer
   */
  importOAuth2TrustedJwtIssuer(
    issuerId: string,
    importData: OAuth2TrustedJwtIssuerExportInterface,
    options?: OAuth2TrustedJwtIssuerImportOptions
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
  /**
   * Import first OAuth2 Client
   * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
   * @param {OAuth2TrustedJwtIssuerImportOptions} options import options
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise resolving to an oauth2 trusted jwt issuer
   */
  importFirstOAuth2TrustedJwtIssuer(
    importData: OAuth2TrustedJwtIssuerExportInterface,
    options?: OAuth2TrustedJwtIssuerImportOptions
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
  /**
   * Import OAuth2 Clients
   * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
   * @param {OAuth2TrustedJwtIssuerImportOptions} options import options
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise resolving to an array of oauth2 trusted jwt issuers
   */
  importOAuth2TrustedJwtIssuers(
    importData: OAuth2TrustedJwtIssuerExportInterface,
    options?: OAuth2TrustedJwtIssuerImportOptions
  ): Promise<OAuth2TrustedJwtIssuerSkeleton[]>;

  // Deprecated

  /**
   * Get all OAuth2 trusted jwt issuers
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an array of trusted jwt issuer objects
   * @deprecated since v2.0.0 use {@link OAuth2TrustedJwtIssuer.readOAuth2TrustedJwtIssuers | readOAuth2TrustedJwtIssuers} instead
   * ```javascript
   * readOAuth2TrustedJwtIssuers(): Promise<OAuth2TrustedJwtIssuerSkeleton[]>
   * ```
   * @group Deprecated
   */
  getOAuth2TrustedJwtIssuers(): Promise<OAuth2TrustedJwtIssuerSkeleton[]>;
  /**
   * Get OAuth2 trusted jwt issuer
   * @param {string} issuerId trusted jwt issuer id
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to an trusted jwt issuer object
   * @deprecated since v2.0.0 use {@link OAuth2TrustedJwtIssuer.readOAuth2TrustedJwtIssuer | readOAuth2TrustedJwtIssuer} instead
   * ```javascript
   * readOAuth2TrustedJwtIssuer(issuerId: string): Promise<OAuth2TrustedJwtIssuerSkeleton>
   * ```
   * @group Deprecated
   */
  getOAuth2TrustedJwtIssuer(
    issuerId: string
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
  /**
   * Put OAuth2 trusted jwt issuer
   * @param {string} issuerId trusted jwt issuer id
   * @param {OAuth2TrustedJwtIssuerSkeleton} issuerData trusted jwt issuer object
   * @returns {Promise<any>} a promise that resolves to an trusted jwt issuer object
   * @deprecated since v2.0.0 use {@link OAuth2TrustedJwtIssuer.updateOAuth2TrustedJwtIssuer | updateOAuth2TrustedJwtIssuer} or {@link OAuth2TrustedJwtIssuer.createOAuth2TrustedJwtIssuer | createOAuth2TrustedJwtIssuer} instead
   * ```javascript
   * updateOAuth2TrustedJwtIssuer(issuerId: string, issuerData: OAuth2TrustedJwtIssuerSkeleton): Promise<OAuth2TrustedJwtIssuerSkeleton>
   * createOAuth2TrustedJwtIssuer(issuerId: string, issuerData: OAuth2TrustedJwtIssuerSkeleton): Promise<OAuth2TrustedJwtIssuerSkeleton>
   * ```
   * @group Deprecated
   */
  putOAuth2TrustedJwtIssuer(
    issuerId: string,
    issuerData: OAuth2TrustedJwtIssuerSkeleton
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
};

export default (state: State): OAuth2TrustedJwtIssuer => {
  return {
    createOAuth2TrustedJwtIssuerExportTemplate(): OAuth2TrustedJwtIssuerExportInterface {
      return createOAuth2TrustedJwtIssuerExportTemplate({ state });
    },
    async readOAuth2TrustedJwtIssuers(): Promise<
      OAuth2TrustedJwtIssuerSkeleton[]
    > {
      return readOAuth2TrustedJwtIssuers({ state });
    },
    async readOAuth2TrustedJwtIssuer(
      issuerId: string
    ): Promise<OAuth2TrustedJwtIssuerSkeleton> {
      return readOAuth2TrustedJwtIssuer({ issuerId, state });
    },
    async createOAuth2TrustedJwtIssuer(
      issuerId: string,
      issuerData: OAuth2TrustedJwtIssuerSkeleton
    ): Promise<OAuth2TrustedJwtIssuerSkeleton> {
      return createOAuth2TrustedJwtIssuer({ issuerId, issuerData, state });
    },
    async updateOAuth2TrustedJwtIssuer(
      issuerId: string,
      issuerData: OAuth2TrustedJwtIssuerSkeleton
    ): Promise<OAuth2TrustedJwtIssuerSkeleton> {
      return updateOAuth2TrustedJwtIssuer({ issuerId, issuerData, state });
    },
    async deleteOAuth2TrustedJwtIssuers(): Promise<
      OAuth2TrustedJwtIssuerSkeleton[]
    > {
      return deleteOAuth2TrustedJwtIssuers({ state });
    },
    async deleteOAuth2TrustedJwtIssuer(
      issuerId: string
    ): Promise<OAuth2TrustedJwtIssuerSkeleton> {
      return deleteOAuth2TrustedJwtIssuer({ issuerId, state });
    },
    async exportOAuth2TrustedJwtIssuers(
      options: OAuth2TrustedJwtIssuerExportOptions = {
        useStringArrays: true,
        deps: true,
      }
    ): Promise<OAuth2TrustedJwtIssuerExportInterface> {
      return exportOAuth2TrustedJwtIssuers({ options, state });
    },
    async exportOAuth2TrustedJwtIssuer(
      issuerId: string
    ): Promise<OAuth2TrustedJwtIssuerExportInterface> {
      return exportOAuth2TrustedJwtIssuer({ issuerId, state });
    },
    async importOAuth2TrustedJwtIssuer(
      issuerId: string,
      importData: OAuth2TrustedJwtIssuerExportInterface
    ) {
      return importOAuth2TrustedJwtIssuer({
        issuerId,
        importData,
        state,
      });
    },
    async importFirstOAuth2TrustedJwtIssuer(
      importData: OAuth2TrustedJwtIssuerExportInterface
    ) {
      return importFirstOAuth2TrustedJwtIssuer({ importData, state });
    },
    async importOAuth2TrustedJwtIssuers(
      importData: OAuth2TrustedJwtIssuerExportInterface
    ): Promise<OAuth2TrustedJwtIssuerSkeleton[]> {
      return importOAuth2TrustedJwtIssuers({ importData, state });
    },

    // Deprecated

    async getOAuth2TrustedJwtIssuers(): Promise<
      OAuth2TrustedJwtIssuerSkeleton[]
    > {
      return readOAuth2TrustedJwtIssuers({ state });
    },
    async getOAuth2TrustedJwtIssuer(
      issuerId: string
    ): Promise<OAuth2TrustedJwtIssuerSkeleton> {
      return readOAuth2TrustedJwtIssuer({ issuerId, state });
    },
    async putOAuth2TrustedJwtIssuer(
      issuerId: string,
      issuerData: OAuth2TrustedJwtIssuerSkeleton
    ): Promise<OAuth2TrustedJwtIssuerSkeleton> {
      return updateOAuth2TrustedJwtIssuer({ issuerId, issuerData, state });
    },
  };
};

/**
 * OAuth2 trusted jwt issuer export options
 */
export interface OAuth2TrustedJwtIssuerExportOptions {
  /**
   * Use string arrays to store multi-line text in scripts.
   */
  useStringArrays: boolean;
  /**
   * Include any dependencies (scripts).
   */
  deps: boolean;
}

/**
 * OAuth2 trusted jwt issuer import options
 */
export interface OAuth2TrustedJwtIssuerImportOptions {
  /**
   * Include any dependencies (scripts).
   */
  deps: boolean;
}

export interface OAuth2TrustedJwtIssuerExportInterface {
  meta?: ExportMetaData;
  trustedJwtIssuer: Record<string, OAuth2TrustedJwtIssuerSkeleton>;
}

/**
 * Create an empty OAuth2 trusted jwt issuer export template
 * @returns {OAuth2TrustedJwtIssuerExportInterface} an empty OAuth2 trusted jwt issuer export template
 */
export function createOAuth2TrustedJwtIssuerExportTemplate({
  state,
}: {
  state: State;
}): OAuth2TrustedJwtIssuerExportInterface {
  return {
    meta: getMetadata({ state }),
    trustedJwtIssuer: {},
  } as OAuth2TrustedJwtIssuerExportInterface;
}

/**
 * Get all OAuth2 trusted jwt issuers
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an array of trusted jwt issuer objects
 */
export async function readOAuth2TrustedJwtIssuers({
  state,
}: {
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton[]> {
  const issuers = (await _getOAuth2TrustedJwtIssuers({ state })).result;
  return issuers;
}

/**
 * Get OAuth2 trusted jwt issuer
 * @param {string} issuerId trusted jwt issuer id
 * @returns {Promise<any>} a promise that resolves to an trusted jwt issuer object
 */
export async function readOAuth2TrustedJwtIssuer({
  issuerId,
  state,
}: {
  issuerId: string;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton> {
  return _getOAuth2TrustedJwtIssuer({ id: issuerId, state });
}

/**
 * Create OAuth2 trusted jwt issuer
 * @param {string} issuerId trusted jwt issuer id
 * @param {any} issuerData trusted jwt issuer object
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to an trusted jwt issuer object
 */
export async function createOAuth2TrustedJwtIssuer({
  issuerId,
  issuerData,
  state,
}: {
  issuerId: string;
  issuerData: OAuth2TrustedJwtIssuerSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton> {
  debugMessage({
    message: `OAuth2TrustedJwtIssuerOps.createOAuth2TrustedJwtIssuer: start`,
    state,
  });
  try {
    await readOAuth2TrustedJwtIssuer({ issuerId, state });
  } catch (error) {
    const result = await updateOAuth2TrustedJwtIssuer({
      issuerId,
      issuerData,
      state,
    });
    debugMessage({
      message: `OAuth2TrustedJwtIssuerOps.createOAuth2TrustedJwtIssuer: end`,
      state,
    });
    return result;
  }
  throw new Error(`OAuth2 trusted jwt issuer ${issuerId} already exists!`);
}

/**
 * Update or create OAuth2 trusted jwt issuer
 * @param {string} issuerId trusted jwt issuer id
 * @param {any} issuerData trusted jwt issuer object
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to an trusted jwt issuer object
 */
export async function updateOAuth2TrustedJwtIssuer({
  issuerId,
  issuerData,
  state,
}: {
  issuerId: string;
  issuerData: OAuth2TrustedJwtIssuerSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton> {
  debugMessage({
    message: `OAuth2TrustedJwtIssuerOps.putOAuth2TrustedJwtIssuer: start`,
    state,
  });
  try {
    const response = await _putOAuth2TrustedJwtIssuer({
      id: issuerId,
      issuerData,
      state,
    });
    debugMessage({
      message: `OAuth2TrustedJwtIssuerOps.putOAuth2TrustedJwtIssuer: end`,
      state,
    });
    return response;
  } catch (error) {
    if (
      error.response?.status === 400 &&
      error.response?.data?.message === 'Invalid attribute specified.'
    ) {
      const { validAttributes } = error.response.data.detail;
      validAttributes.push('_id');
      for (const key of Object.keys(issuerData)) {
        if (typeof issuerData[key] === 'object') {
          for (const attribute of Object.keys(issuerData[key])) {
            if (!validAttributes.includes(attribute)) {
              if (state.getVerbose() || state.getDebug())
                printMessage({
                  message: `\n- Removing invalid attribute: ${key}.${attribute}`,
                  type: 'warn',
                  state,
                });
              delete issuerData[key][attribute];
            }
          }
        }
      }
      const response = await _putOAuth2TrustedJwtIssuer({
        id: issuerId,
        issuerData,
        state,
      });
      debugMessage({
        message: `OAuth2TrustedJwtIssuerOps.putOAuth2TrustedJwtIssuer: end`,
        state,
      });
      return response;
    } else {
      throw error;
    }
  }
}

/**
 * Delete all OAuth2 trusted jwt issuers
 * @param {string} issuerId trusted jwt issuer id
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an trusted jwt issuer object
 */
export async function deleteOAuth2TrustedJwtIssuers({
  state,
}: {
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton[]> {
  debugMessage({
    message: `OAuth2TrustedJwtIssuerOps.deleteOAuth2TrustedJwtIssuers: start`,
    state,
  });
  const result: OAuth2TrustedJwtIssuerSkeleton[] = [];
  const errors = [];
  try {
    const issuers = await readOAuth2TrustedJwtIssuers({ state });
    for (const issuer of issuers) {
      try {
        debugMessage({
          message: `OAuth2TrustedJwtIssuerOps.deleteOAuth2TrustedJwtIssuers: '${issuer._id}'`,
          state,
        });
        result.push(
          await deleteOAuth2TrustedJwtIssuer({
            issuerId: issuer._id,
            state,
          })
        );
      } catch (error) {
        errors.push(error);
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Delete error:\n${errorMessages}`);
  }
  debugMessage({
    message: `OAuth2TrustedJwtIssuerOps.deleteOAuth2TrustedJwtIssuers: end`,
    state,
  });
  return result;
}

/**
 * Delete OAuth2 trusted jwt issuer
 * @param {string} issuerId trusted jwt issuer id
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to an trusted jwt issuer object
 */
export async function deleteOAuth2TrustedJwtIssuer({
  issuerId,
  state,
}: {
  issuerId: string;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton> {
  return _deleteOAuth2TrustedJwtIssuer({ id: issuerId, state });
}

/**
 * Export all OAuth2 trusted jwt issuers
 * @returns {Promise<OAuth2TrustedJwtIssuerExportInterface>} export data
 */
export async function exportOAuth2TrustedJwtIssuers({
  state,
}: {
  options?: OAuth2TrustedJwtIssuerExportOptions;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerExportInterface> {
  debugMessage({
    message: `OAuth2TrustedJwtIssuerOps.exportOAuth2TrustedJwtIssuers: start`,
    state,
  });
  const exportData = createOAuth2TrustedJwtIssuerExportTemplate({ state });
  const errors = [];
  try {
    const issuers = await readOAuth2TrustedJwtIssuers({ state });
    for (const issuer of issuers) {
      try {
        exportData.trustedJwtIssuer[issuer._id] = issuer;
      } catch (error) {
        errors.push(error);
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({
    message: `OAuth2TrustedJwtIssuerOps.exportOAuth2TrustedJwtIssuers: end`,
    state,
  });
  return exportData;
}

/**
 * Export OAuth2 trusted jwt issuer by ID
 * @param {string} issuerId oauth2 trusted jwt issuer id
 * @param {OAuth2TrustedJwtIssuerExportOptions} options export options
 * @returns {Promise<OAuth2TrustedJwtIssuerExportInterface>} export data
 */
export async function exportOAuth2TrustedJwtIssuer({
  issuerId,
  state,
}: {
  issuerId: string;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerExportInterface> {
  debugMessage({
    message: `OAuth2TrustedJwtIssuerOps.exportOAuth2TrustedJwtIssuer: start`,
    state,
  });
  const exportData = createOAuth2TrustedJwtIssuerExportTemplate({ state });
  const errors = [];
  try {
    const issuerData = await readOAuth2TrustedJwtIssuer({ issuerId, state });
    exportData.trustedJwtIssuer[issuerData._id] = issuerData;
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({
    message: `OAuth2TrustedJwtIssuerOps.exportOAuth2TrustedJwtIssuer: end`,
    state,
  });
  return exportData;
}

/**
 * Import OAuth2 Client by ID
 * @param {string} issuerId trusted jwt issuer id
 * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
 * @param {OAuth2TrustedJwtIssuerImportOptions} options import options
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise resolving to an oauth2 trusted jwt issuer
 */
export async function importOAuth2TrustedJwtIssuer({
  issuerId,
  importData,
  state,
}: {
  issuerId: string;
  importData: OAuth2TrustedJwtIssuerExportInterface;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.trustedJwtIssuer)) {
    if (id === issuerId) {
      try {
        const issuerData = importData.trustedJwtIssuer[id];
        delete issuerData._provider;
        delete issuerData._rev;
        response = await updateOAuth2TrustedJwtIssuer({
          issuerId: id,
          issuerData,
          state,
        });
        imported.push(id);
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\n${issuerId} not found in import data!`);
  }
  return response;
}

/**
 * Import first OAuth2 Client
 * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
 * @param {OAuth2TrustedJwtIssuerImportOptions} options import options
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise resolving to an oauth2 trusted jwt issuer
 */
export async function importFirstOAuth2TrustedJwtIssuer({
  importData,
  state,
}: {
  importData: OAuth2TrustedJwtIssuerExportInterface;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.trustedJwtIssuer)) {
    try {
      const issuerData = importData.trustedJwtIssuer[id];
      delete issuerData._provider;
      delete issuerData._rev;
      response = await updateOAuth2TrustedJwtIssuer({
        issuerId: id,
        issuerData,
        state,
      });
      imported.push(id);
    } catch (error) {
      errors.push(error);
    }
    break;
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(
      `Import error:\nNo trusted jwt issuers found in import data!`
    );
  }
  return response;
}

/**
 * Import OAuth2 Clients
 * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
 * @param {OAuth2TrustedJwtIssuerImportOptions} options import options
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise resolving to an array of oauth2 trusted jwt issuers
 */
export async function importOAuth2TrustedJwtIssuers({
  importData,
  state,
}: {
  importData: OAuth2TrustedJwtIssuerExportInterface;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton[]> {
  const response = [];
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.trustedJwtIssuer)) {
    try {
      const issuerData = importData.trustedJwtIssuer[id];
      delete issuerData._provider;
      delete issuerData._rev;
      response.push(
        await updateOAuth2TrustedJwtIssuer({ issuerId: id, issuerData, state })
      );
      imported.push(id);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(
      `Import error:\nNo trusted jwt issuers found in import data!`
    );
  }
  return response;
}
