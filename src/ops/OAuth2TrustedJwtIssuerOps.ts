import { type NoIdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  deleteOAuth2TrustedJwtIssuer as _deleteOAuth2TrustedJwtIssuer,
  getOAuth2TrustedJwtIssuer as _getOAuth2TrustedJwtIssuer,
  getOAuth2TrustedJwtIssuers as _getOAuth2TrustedJwtIssuers,
  putOAuth2TrustedJwtIssuer as _putOAuth2TrustedJwtIssuer,
  type OAuth2TrustedJwtIssuerSkeleton,
} from '../api/OAuth2TrustedJwtIssuerApi';
import { State } from '../shared/State';
import { debugMessage, printMessage } from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { getCurrentRealmName } from '../utils/ForgeRockUtils';
import { cloneDeep } from '../utils/JsonUtils';
import { FrodoError, isNotFoundError } from './FrodoError';
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
   * @param {OAuth2TrustedJwtIssuerExportOptions} options deprecated, has no effect: a trusted jwt issuer has no scripts
   * @returns {Promise<OAuth2TrustedJwtIssuerExportInterface>} a promise that resolves to the export data
   */
  exportOAuth2TrustedJwtIssuers(
    options?: OAuth2TrustedJwtIssuerExportOptions
  ): Promise<OAuth2TrustedJwtIssuerExportInterface>;
  /**
   * Export OAuth2 trusted jwt issuer by ID
   * @param {string} issuerId oauth2 trusted jwt issuer id
   * @param {OAuth2TrustedJwtIssuerExportOptions} options deprecated, has no effect: a trusted jwt issuer has no scripts
   * @returns {Promise<OAuth2TrustedJwtIssuerExportInterface>} a promise that resolves to the export data
   */
  exportOAuth2TrustedJwtIssuer(
    issuerId: string,
    options?: OAuth2TrustedJwtIssuerExportOptions
  ): Promise<OAuth2TrustedJwtIssuerExportInterface>;
  /**
   * Import OAuth2 trusted jwt issuer by ID. The import data is not modified.
   * @param {string} issuerId trusted jwt issuer id
   * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
   * @param {OAuth2TrustedJwtIssuerImportOptions} options deprecated, has no effect: a trusted jwt issuer has no scripts
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to the imported trusted jwt issuer
   */
  importOAuth2TrustedJwtIssuer(
    issuerId: string,
    importData: OAuth2TrustedJwtIssuerExportInterface,
    options?: OAuth2TrustedJwtIssuerImportOptions
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
  /**
   * Import first OAuth2 trusted jwt issuer. The import data is not modified.
   * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
   * @param {OAuth2TrustedJwtIssuerImportOptions} options deprecated, has no effect: a trusted jwt issuer has no scripts
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to the imported trusted jwt issuer
   */
  importFirstOAuth2TrustedJwtIssuer(
    importData: OAuth2TrustedJwtIssuerExportInterface,
    options?: OAuth2TrustedJwtIssuerImportOptions
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
  /**
   * Import OAuth2 trusted jwt issuers. The import data is not modified.
   * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
   * @param {OAuth2TrustedJwtIssuerImportOptions} options deprecated, has no effect: a trusted jwt issuer has no scripts
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an array of the imported trusted jwt issuers
   */
  importOAuth2TrustedJwtIssuers(
    importData: OAuth2TrustedJwtIssuerExportInterface,
    options?: OAuth2TrustedJwtIssuerImportOptions
  ): Promise<OAuth2TrustedJwtIssuerSkeleton[]>;
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
      options?: OAuth2TrustedJwtIssuerExportOptions
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
  };
};

/**
 * OAuth2 trusted jwt issuer export options
 * @deprecated The options have no effect: a trusted jwt issuer has no scripts. The parameter is kept so that no caller breaks; it will be removed in the next major version.
 */
export interface OAuth2TrustedJwtIssuerExportOptions {
  /**
   * @deprecated Has no effect.
   */
  useStringArrays?: boolean;
  /**
   * @deprecated Has no effect.
   */
  deps?: boolean;
}

/**
 * OAuth2 trusted jwt issuer import options
 * @deprecated The options have no effect: a trusted jwt issuer has no scripts. The parameter is kept so that no caller breaks; it will be removed in the next major version.
 */
export interface OAuth2TrustedJwtIssuerImportOptions {
  /**
   * @deprecated Has no effect.
   */
  deps?: boolean;
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
  try {
    const issuers = (await _getOAuth2TrustedJwtIssuers({ state })).result;
    return issuers;
  } catch (error) {
    if (
      error.response?.status === 403 &&
      error.response?.data?.message ===
        'This operation is not available in PingOne Advanced Identity Cloud.'
    ) {
      return [];
    } else {
      throw new FrodoError(
        `Error reading ${getCurrentRealmName(state) + ' realm'} trusted issuers`,
        error
      );
    }
  }
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
  try {
    return await _getOAuth2TrustedJwtIssuer({ id: issuerId, state });
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} trusted issuer ${issuerId}`,
      error
    );
  }
}

/**
 * Create OAuth2 trusted jwt issuer
 * @param {string} issuerId trusted jwt issuer id
 * @param {OAuth2TrustedJwtIssuerSkeleton | NoIdObjectSkeletonInterface} issuerData trusted jwt issuer object
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
    if (!isNotFoundError(error)) {
      throw new FrodoError(
        `Error checking if ${getCurrentRealmName(state) + ' realm'} trusted issuer ${issuerId} already exists`,
        error
      );
    }
    try {
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
    } catch (error) {
      throw new FrodoError(
        `Error creating ${getCurrentRealmName(state) + ' realm'} trusted issuer ${issuerId}`,
        error
      );
    }
  }
  throw new FrodoError(
    `${getCurrentRealmName(state) + ' realm'} trusted issuer ${issuerId} already exists!`
  );
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
      try {
        // Work on a copy: the object of the caller keeps what the server
        // rejected.
        const retryData = cloneDeep(issuerData);
        const validAttributes = [
          ...error.response.data.detail.validAttributes,
          '_id',
        ];
        for (const key of Object.keys(retryData)) {
          const value = retryData[key];
          // Only an object has attributes of its own: the elements of an array
          // (allowedSubjects) are values, not attributes, and a null has none.
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            for (const attribute of Object.keys(value)) {
              if (!validAttributes.includes(attribute)) {
                printMessage({
                  message: `\n- Removing invalid attribute from trusted issuer ${issuerId}: ${key}.${attribute}`,
                  type: 'warn',
                  state,
                });
                delete value[attribute];
              }
            }
          }
        }
        const response = await _putOAuth2TrustedJwtIssuer({
          id: issuerId,
          issuerData: retryData,
          state,
        });
        debugMessage({
          message: `OAuth2TrustedJwtIssuerOps.putOAuth2TrustedJwtIssuer: end`,
          state,
        });
        return response;
      } catch (error) {
        throw new FrodoError(
          `Error updating ${getCurrentRealmName(state) + ' realm'} trusted issuer ${issuerId}`,
          error
        );
      }
    } else {
      throw new FrodoError(
        `Error updating ${getCurrentRealmName(state) + ' realm'} trusted issuer ${issuerId}`,
        error
      );
    }
  }
}

/**
 * Delete all OAuth2 trusted jwt issuers
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an array of the deleted trusted jwt issuers
 */
export async function deleteOAuth2TrustedJwtIssuers({
  state,
}: {
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton[]> {
  const errors = [];
  try {
    debugMessage({
      message: `OAuth2TrustedJwtIssuerOps.deleteOAuth2TrustedJwtIssuers: start`,
      state,
    });
    const result: OAuth2TrustedJwtIssuerSkeleton[] = [];
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
    if (errors.length > 0) {
      throw new FrodoError(
        `Error deleting ${getCurrentRealmName(state) + ' realm'} trusted issuers`,
        errors
      );
    }
    debugMessage({
      message: `OAuth2TrustedJwtIssuerOps.deleteOAuth2TrustedJwtIssuers: end`,
      state,
    });
    return result;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} trusted issuers`,
      error
    );
  }
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
  try {
    return await _deleteOAuth2TrustedJwtIssuer({ id: issuerId, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} trusted issuer ${issuerId}`,
      error
    );
  }
}

/**
 * Export all OAuth2 trusted jwt issuers
 * @returns {Promise<OAuth2TrustedJwtIssuerExportInterface>} a promise that resolves to the export data
 */
export async function exportOAuth2TrustedJwtIssuers({
  state,
}: {
  options?: OAuth2TrustedJwtIssuerExportOptions;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerExportInterface> {
  const errors = [];
  try {
    debugMessage({
      message: `OAuth2TrustedJwtIssuerOps.exportOAuth2TrustedJwtIssuers: start`,
      state,
    });
    const exportData = createOAuth2TrustedJwtIssuerExportTemplate({ state });
    const issuers = await readOAuth2TrustedJwtIssuers({ state });
    for (const issuer of issuers) {
      try {
        exportData.trustedJwtIssuer[issuer._id] = issuer;
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error exporting ${getCurrentRealmName(state) + ' realm'} trusted issuers`,
        errors
      );
    }
    debugMessage({
      message: `OAuth2TrustedJwtIssuerOps.exportOAuth2TrustedJwtIssuers: end`,
      state,
    });
    return exportData;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} trusted issuers`,
      error
    );
  }
}

/**
 * Export OAuth2 trusted jwt issuer by ID
 * @param {string} issuerId oauth2 trusted jwt issuer id
 * @returns {Promise<OAuth2TrustedJwtIssuerExportInterface>} a promise that resolves to the export data
 */
export async function exportOAuth2TrustedJwtIssuer({
  issuerId,
  state,
}: {
  issuerId: string;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerExportInterface> {
  try {
    debugMessage({
      message: `OAuth2TrustedJwtIssuerOps.exportOAuth2TrustedJwtIssuer: start`,
      state,
    });
    const exportData = createOAuth2TrustedJwtIssuerExportTemplate({ state });
    const issuerData = await readOAuth2TrustedJwtIssuer({ issuerId, state });
    exportData.trustedJwtIssuer[issuerData._id] = issuerData;
    debugMessage({
      message: `OAuth2TrustedJwtIssuerOps.exportOAuth2TrustedJwtIssuer: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} trusted issuer ${issuerId}`,
      error
    );
  }
}

/**
 * Import OAuth2 trusted jwt issuer by ID. The import data is not modified.
 * @param {string} issuerId trusted jwt issuer id
 * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to the imported trusted jwt issuer
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
        const issuerData = cloneDeep(importData.trustedJwtIssuer[id]);
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
  if (errors.length > 0) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} trusted issuer ${issuerId}`,
      errors
    );
  }
  if (0 === imported.length) {
    throw new FrodoError(
      `Trusted issuer ${issuerId} not found in import data!`
    );
  }
  return response;
}

/**
 * Import first OAuth2 trusted jwt issuer. The import data is not modified.
 * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to the imported trusted jwt issuer
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
      const issuerData = cloneDeep(importData.trustedJwtIssuer[id]);
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
  if (errors.length > 0) {
    throw new FrodoError(
      `Error importing first ${getCurrentRealmName(state) + ' realm'} trusted issuer`,
      errors
    );
  }
  if (0 === imported.length) {
    throw new FrodoError(`No trusted issuers found in import data!`);
  }
  return response;
}

/**
 * Import OAuth2 trusted jwt issuers. The import data is not modified.
 * @param {OAuth2TrustedJwtIssuerExportInterface} importData import data
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an array of the imported trusted jwt issuers
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
  for (const id of Object.keys(importData.trustedJwtIssuer)) {
    try {
      const issuerData = cloneDeep(importData.trustedJwtIssuer[id]);
      delete issuerData._provider;
      delete issuerData._rev;
      response.push(
        await updateOAuth2TrustedJwtIssuer({ issuerId: id, issuerData, state })
      );
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} trusted issuers`,
      errors
    );
  }
  return response;
}
