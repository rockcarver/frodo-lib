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
import { type AgentExportInterface } from './AgentOps';
import { FrodoError, isNotFoundError } from './FrodoError';
import { routeAgentSection } from './internal/AgentSectionRouting';
import { type ExportMetaData, type ResultCallback } from './OpsTypes';

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
   * Delete all OAuth2 trusted jwt issuers. Every issuer is tried: an issuer that cannot be deleted does not stop the others.
   * @param {ResultCallback<OAuth2TrustedJwtIssuerSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every issuer is passed to it as it happens (a failed issuer as an error that names it) and a failed issuer does not throw. Without it, the failures are collected and thrown as one error after every issuer was tried. Failing to read the issuers always throws.
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an array of the deleted trusted jwt issuers
   */
  deleteOAuth2TrustedJwtIssuers(
    resultCallback?: ResultCallback<OAuth2TrustedJwtIssuerSkeleton>
  ): Promise<OAuth2TrustedJwtIssuerSkeleton[]>;
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
   * @param {ResultCallback<OAuth2TrustedJwtIssuerSkeleton>} resultCallback Optional callback to process individual results. When given, every issuer that is part of the export is passed to it as it happens. Failing to read the issuers always throws.
   * @returns {Promise<OAuth2TrustedJwtIssuerExportInterface>} a promise that resolves to the export data
   */
  exportOAuth2TrustedJwtIssuers(
    options?: OAuth2TrustedJwtIssuerExportOptions,
    resultCallback?: ResultCallback<OAuth2TrustedJwtIssuerSkeleton>
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
   * @param {OAuth2TrustedJwtIssuerImportData} importData import data: an export of trusted jwt issuers, or an agent export (4.x) that holds trusted jwt issuers in its agent section
   * @param {OAuth2TrustedJwtIssuerImportOptions} options deprecated, has no effect: a trusted jwt issuer has no scripts
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to the imported trusted jwt issuer
   */
  importOAuth2TrustedJwtIssuer(
    issuerId: string,
    importData: OAuth2TrustedJwtIssuerImportData,
    options?: OAuth2TrustedJwtIssuerImportOptions
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
  /**
   * Import first OAuth2 trusted jwt issuer. The import data is not modified.
   * @param {OAuth2TrustedJwtIssuerImportData} importData import data: an export of trusted jwt issuers, or an agent export (4.x) that holds trusted jwt issuers in its agent section
   * @param {OAuth2TrustedJwtIssuerImportOptions} options deprecated, has no effect: a trusted jwt issuer has no scripts
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to the imported trusted jwt issuer
   */
  importFirstOAuth2TrustedJwtIssuer(
    importData: OAuth2TrustedJwtIssuerImportData,
    options?: OAuth2TrustedJwtIssuerImportOptions
  ): Promise<OAuth2TrustedJwtIssuerSkeleton>;
  /**
   * Import OAuth2 trusted jwt issuers. The import data is not modified. Every issuer is tried: an issuer that cannot be imported does not stop the others. Import data without issuers is an empty import.
   * @param {OAuth2TrustedJwtIssuerImportData} importData import data: an export of trusted jwt issuers, or an agent export (4.x) that holds trusted jwt issuers in its agent section
   * @param {OAuth2TrustedJwtIssuerImportOptions} options deprecated, has no effect: a trusted jwt issuer has no scripts
   * @param {ResultCallback<OAuth2TrustedJwtIssuerSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every issuer is passed to it as it happens (a failed issuer as an error that names it) and a failed issuer does not throw. Without it, the failures are collected and thrown as one error after every issuer was tried.
   * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an array of the imported trusted jwt issuers
   */
  importOAuth2TrustedJwtIssuers(
    importData: OAuth2TrustedJwtIssuerImportData,
    options?: OAuth2TrustedJwtIssuerImportOptions,
    resultCallback?: ResultCallback<OAuth2TrustedJwtIssuerSkeleton>
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
    async deleteOAuth2TrustedJwtIssuers(
      resultCallback?: ResultCallback<OAuth2TrustedJwtIssuerSkeleton>
    ): Promise<OAuth2TrustedJwtIssuerSkeleton[]> {
      return deleteOAuth2TrustedJwtIssuers({ resultCallback, state });
    },
    async deleteOAuth2TrustedJwtIssuer(
      issuerId: string
    ): Promise<OAuth2TrustedJwtIssuerSkeleton> {
      return deleteOAuth2TrustedJwtIssuer({ issuerId, state });
    },
    async exportOAuth2TrustedJwtIssuers(
      options?: OAuth2TrustedJwtIssuerExportOptions,
      resultCallback?: ResultCallback<OAuth2TrustedJwtIssuerSkeleton>
    ): Promise<OAuth2TrustedJwtIssuerExportInterface> {
      return exportOAuth2TrustedJwtIssuers({ options, resultCallback, state });
    },
    async exportOAuth2TrustedJwtIssuer(
      issuerId: string
    ): Promise<OAuth2TrustedJwtIssuerExportInterface> {
      return exportOAuth2TrustedJwtIssuer({ issuerId, state });
    },
    async importOAuth2TrustedJwtIssuer(
      issuerId: string,
      importData: OAuth2TrustedJwtIssuerImportData
    ) {
      return importOAuth2TrustedJwtIssuer({
        issuerId,
        importData,
        state,
      });
    },
    async importFirstOAuth2TrustedJwtIssuer(
      importData: OAuth2TrustedJwtIssuerImportData
    ) {
      return importFirstOAuth2TrustedJwtIssuer({ importData, state });
    },
    async importOAuth2TrustedJwtIssuers(
      importData: OAuth2TrustedJwtIssuerImportData,
      _options?: OAuth2TrustedJwtIssuerImportOptions,
      resultCallback?: ResultCallback<OAuth2TrustedJwtIssuerSkeleton>
    ): Promise<OAuth2TrustedJwtIssuerSkeleton[]> {
      return importOAuth2TrustedJwtIssuers({
        importData,
        resultCallback,
        state,
      });
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
 * The data of a trusted jwt issuer import: an export of trusted jwt issuers, or
 * an agent export (the `agent export` file of the 4.x line) that holds trusted
 * jwt issuers in its `agent` section.
 */
export type OAuth2TrustedJwtIssuerImportData =
  OAuth2TrustedJwtIssuerExportInterface | AgentExportInterface;

/**
 * The trusted jwt issuers an import reads: those of the `trustedJwtIssuer`
 * section, extended with those of the `agent` section that the first section
 * does not have (a copy in the `trustedJwtIssuer` section wins). The import data
 * is not modified.
 * @param {OAuth2TrustedJwtIssuerImportData} importData the import data
 * @returns {Record<string, OAuth2TrustedJwtIssuerSkeleton>} the issuers by id
 */
function getIssuersToImport(
  importData: OAuth2TrustedJwtIssuerImportData
): Record<string, OAuth2TrustedJwtIssuerSkeleton> {
  return routeAgentSection(importData).routed.trustedJwtIssuer ?? {};
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
 * Report the outcome of one issuer: to the result callback if there is one, otherwise a failure is collected.
 * @param {object} params structured and named parameters
 * @param {OAuth2TrustedJwtIssuerSkeleton} params.issuer the issuer that was processed (undefined if it failed)
 * @param {FrodoError} params.failure the error that names the issuer (undefined if it succeeded)
 * @param {FrodoError[]} params.errors where the failures are collected when there is no result callback
 * @param {ResultCallback<OAuth2TrustedJwtIssuerSkeleton>} params.resultCallback Optional callback to process individual results
 */
function _reportIssuerResult({
  issuer,
  failure,
  errors,
  resultCallback,
}: {
  issuer?: OAuth2TrustedJwtIssuerSkeleton;
  failure?: FrodoError;
  errors: FrodoError[];
  resultCallback?: ResultCallback<OAuth2TrustedJwtIssuerSkeleton>;
}) {
  if (failure) {
    if (resultCallback) {
      resultCallback(failure, undefined);
    } else {
      errors.push(failure);
    }
  } else if (resultCallback) {
    resultCallback(undefined, issuer);
  }
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
 * Every issuer is tried: an issuer that cannot be deleted does not stop the others.
 * @param {object} params structured and named parameters
 * @param {ResultCallback<OAuth2TrustedJwtIssuerSkeleton>} params.resultCallback Optional callback to process individual results. When given, the outcome of every issuer is passed to it as it happens (a failed issuer as an error that names it) and a failed issuer does not throw. Without it, the failures are collected and thrown as one error after every issuer was tried. Failing to read the issuers always throws.
 * @param {State} params.state state object
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an array of the deleted trusted jwt issuers
 * @throws {FrodoError} If the issuers cannot be read (always), or if one or more issuers cannot be deleted and there is no result callback.
 */
export async function deleteOAuth2TrustedJwtIssuers({
  resultCallback,
  state,
}: {
  resultCallback?: ResultCallback<OAuth2TrustedJwtIssuerSkeleton>;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton[]> {
  const errors: FrodoError[] = [];
  try {
    debugMessage({
      message: `OAuth2TrustedJwtIssuerOps.deleteOAuth2TrustedJwtIssuers: start`,
      state,
    });
    const result: OAuth2TrustedJwtIssuerSkeleton[] = [];
    const issuers = await readOAuth2TrustedJwtIssuers({ state });
    for (const issuer of issuers) {
      let failure: FrodoError | undefined;
      try {
        debugMessage({
          message: `OAuth2TrustedJwtIssuerOps.deleteOAuth2TrustedJwtIssuers: '${issuer._id}'`,
          state,
        });
        await _deleteOAuth2TrustedJwtIssuer({ id: issuer._id, state });
      } catch (error) {
        failure = new FrodoError(
          `Error deleting ${getCurrentRealmName(state) + ' realm'} trusted issuer ${issuer._id}`,
          error
        );
      }
      if (!failure) result.push(issuer);
      _reportIssuerResult({ issuer, failure, errors, resultCallback });
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
 * @param {object} params structured and named parameters
 * @param {OAuth2TrustedJwtIssuerExportOptions} params.options deprecated, has no effect: a trusted jwt issuer has no scripts
 * @param {ResultCallback<OAuth2TrustedJwtIssuerSkeleton>} params.resultCallback Optional callback to process individual results. When given, every issuer that is part of the export is passed to it as it happens. Failing to read the issuers always throws.
 * @param {State} params.state state object
 * @returns {Promise<OAuth2TrustedJwtIssuerExportInterface>} a promise that resolves to the export data
 */
export async function exportOAuth2TrustedJwtIssuers({
  resultCallback,
  state,
}: {
  options?: OAuth2TrustedJwtIssuerExportOptions;
  resultCallback?: ResultCallback<OAuth2TrustedJwtIssuerSkeleton>;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerExportInterface> {
  try {
    debugMessage({
      message: `OAuth2TrustedJwtIssuerOps.exportOAuth2TrustedJwtIssuers: start`,
      state,
    });
    const exportData = createOAuth2TrustedJwtIssuerExportTemplate({ state });
    const issuers = await readOAuth2TrustedJwtIssuers({ state });
    // The list carries the whole objects, so there is no per-issuer failure
    // here: every issuer is part of the export and is reported as such.
    for (const issuer of issuers) {
      exportData.trustedJwtIssuer[issuer._id] = issuer;
      if (resultCallback) resultCallback(undefined, issuer);
    }
    debugMessage({
      message: `OAuth2TrustedJwtIssuerOps.exportOAuth2TrustedJwtIssuers: end`,
      state,
    });
    return exportData;
  } catch (error) {
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
 * @param {OAuth2TrustedJwtIssuerImportData} importData import data: an export of trusted jwt issuers, or an agent export (4.x) that holds trusted jwt issuers in its agent section
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to the imported trusted jwt issuer
 */
export async function importOAuth2TrustedJwtIssuer({
  issuerId,
  importData,
  state,
}: {
  issuerId: string;
  importData: OAuth2TrustedJwtIssuerImportData;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  const issuers = getIssuersToImport(importData);
  for (const id of Object.keys(issuers)) {
    if (id === issuerId) {
      try {
        const issuerData = cloneDeep(issuers[id]);
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
 * @param {OAuth2TrustedJwtIssuerImportData} importData import data: an export of trusted jwt issuers, or an agent export (4.x) that holds trusted jwt issuers in its agent section
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton>} a promise that resolves to the imported trusted jwt issuer
 */
export async function importFirstOAuth2TrustedJwtIssuer({
  importData,
  state,
}: {
  importData: OAuth2TrustedJwtIssuerImportData;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  const issuers = getIssuersToImport(importData);
  for (const id of Object.keys(issuers)) {
    try {
      const issuerData = cloneDeep(issuers[id]);
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
 * Every issuer is tried: an issuer that cannot be imported does not stop the others. Import data without issuers is an empty import.
 * @param {object} params structured and named parameters
 * @param {OAuth2TrustedJwtIssuerImportData} params.importData import data: an export of trusted jwt issuers, or an agent export (4.x) that holds trusted jwt issuers in its agent section
 * @param {ResultCallback<OAuth2TrustedJwtIssuerSkeleton>} params.resultCallback Optional callback to process individual results. When given, the outcome of every issuer is passed to it as it happens (a failed issuer as an error that names it) and a failed issuer does not throw. Without it, the failures are collected and thrown as one error after every issuer was tried.
 * @param {State} params.state state object
 * @returns {Promise<OAuth2TrustedJwtIssuerSkeleton[]>} a promise that resolves to an array of the imported trusted jwt issuers
 * @throws {FrodoError} If one or more issuers cannot be imported and there is no result callback.
 */
export async function importOAuth2TrustedJwtIssuers({
  importData,
  resultCallback,
  state,
}: {
  importData: OAuth2TrustedJwtIssuerImportData;
  resultCallback?: ResultCallback<OAuth2TrustedJwtIssuerSkeleton>;
  state: State;
}): Promise<OAuth2TrustedJwtIssuerSkeleton[]> {
  const response: OAuth2TrustedJwtIssuerSkeleton[] = [];
  const errors: FrodoError[] = [];
  debugMessage({
    message: `OAuth2TrustedJwtIssuerOps.importOAuth2TrustedJwtIssuers: start`,
    state,
  });
  const issuers = getIssuersToImport(importData);
  for (const id of Object.keys(issuers)) {
    let issuer: OAuth2TrustedJwtIssuerSkeleton | undefined;
    let failure: FrodoError | undefined;
    try {
      const issuerData = cloneDeep(issuers[id]);
      delete issuerData._provider;
      delete issuerData._rev;
      issuer = await updateOAuth2TrustedJwtIssuer({
        issuerId: id,
        issuerData,
        state,
      });
    } catch (error) {
      failure = new FrodoError(
        `Error importing ${getCurrentRealmName(state) + ' realm'} trusted issuer ${id}`,
        error
      );
    }
    if (!failure) response.push(issuer);
    _reportIssuerResult({ issuer, failure, errors, resultCallback });
  }
  if (errors.length > 0) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} trusted issuers`,
      errors
    );
  }
  debugMessage({
    message: `OAuth2TrustedJwtIssuerOps.importOAuth2TrustedJwtIssuers: end`,
    state,
  });
  return response;
}
