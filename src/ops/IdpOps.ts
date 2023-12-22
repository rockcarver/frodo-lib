import { type NoIdObjectSkeletonInterface } from '../api/ApiTypes';
import { getScript, type ScriptSkeleton } from '../api/ScriptApi';
import {
  deleteProviderByTypeAndId,
  getSocialIdentityProviders as _getSocialIdentityProviders,
  putProviderByTypeAndId as _putProviderByTypeAndId,
  type SocialIdpSkeleton,
} from '../api/SocialIdentityProvidersApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import {
  convertBase64TextToArray,
  convertTextArrayToBase64,
  getMetadata,
} from '../utils/ExportImportUtils';
import { type ExportMetaData } from './OpsTypes';
import { updateScript } from './ScriptOps';

export type Idp = {
  /**
   * Read all social identity providers
   * @returns {Promise<SocialIdpSkeleton[]>} a promise that resolves to an array of social identity providers
   */
  readSocialIdentityProviders(): Promise<SocialIdpSkeleton[]>;
  /**
   * Read social identity provider
   * @param {string} providerId identity provider id/name
   * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social identity provider object
   */
  readSocialIdentityProvider(providerId: string): Promise<SocialIdpSkeleton>;
  /**
   * Create social identity provider
   * @param {string} providerType identity provider type
   * @param {string} providerId identity provider id/name
   * @param {SocialIdpSkeleton} providerData identity provider data
   * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social identity provider object
   */
  createSocialIdentityProvider(
    providerType: string,
    providerId: string,
    providerData: SocialIdpSkeleton
  ): Promise<SocialIdpSkeleton>;
  /**
   * Update or create social identity provider
   * @param {string} providerType identity provider type
   * @param {string} providerId identity provider id/name
   * @param {SocialIdpSkeleton} providerData identity provider data
   * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social identity provider object
   */
  updateSocialIdentityProvider(
    providerType: string,
    providerId: string,
    providerData: SocialIdpSkeleton
  ): Promise<SocialIdpSkeleton>;
  /**
   * Delete all social identity providers
   * @returns {Promise<SocialIdpSkeleton[]>} a promise that resolves to an array of social identity provider objects
   */
  deleteSocialIdentityProviders(): Promise<SocialIdpSkeleton[]>;
  /**
   * Delete social identity provider
   * @param {string} providerId social identity provider id/name
   * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social identity provider object
   */
  deleteSocialIdentityProvider(providerId: string): Promise<SocialIdpSkeleton>;
  /**
   * Export social identity provider
   * @param {string} providerId provider id/name
   * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   */
  exportSocialIdentityProvider(
    providerId: string
  ): Promise<SocialProviderExportInterface>;
  /**
   * Export all social identity providers
   * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   */
  exportSocialIdentityProviders(): Promise<SocialProviderExportInterface>;
  /**
   * Import social identity provider
   * @param {string} providerId provider id/name
   * @param {SocialProviderExportInterface} importData import data
   * @param {SocialIdentityProviderImportOptions} options import options
   * @returns {Promise<SocialIdpSkeleton>} a promise resolving to a social identity provider object
   */
  importSocialIdentityProvider(
    providerId: string,
    importData: SocialProviderExportInterface,
    options: SocialIdentityProviderImportOptions
  ): Promise<SocialIdpSkeleton>;
  /**
   * Import first social identity provider
   * @param {SocialProviderExportInterface} importData import data
   * @param {SocialIdentityProviderImportOptions} options import options
   * @returns {Promise<SocialIdpSkeleton>} a promise resolving to a social identity provider object
   */
  importFirstSocialIdentityProvider(
    importData: SocialProviderExportInterface,
    options: SocialIdentityProviderImportOptions
  ): Promise<SocialIdpSkeleton>;
  /**
   * Import all social identity providers
   * @param {SocialProviderExportInterface} importData import data
   * @param {SocialIdentityProviderImportOptions} options import options
   * @returns {Promise<SocialIdpSkeleton[]>} a promise resolving to an array of social identity provider objects
   */
  importSocialIdentityProviders(
    importData: SocialProviderExportInterface,
    options: SocialIdentityProviderImportOptions
  ): Promise<SocialIdpSkeleton[]>;

  // Deprecated

  /**
   * Get all social identity providers
   * @returns {Promise<SocialIdpSkeleton[]>} a promise that resolves to an array of social identity providers
   * @deprecated since v2.0.0 use {@link Idp.readSocialIdentityProviders | readSocialIdentityProviders} instead
   * ```javascript
   * readSocialIdentityProviders(): Promise<SocialIdpSkeleton[]>
   * ```
   * @group Deprecated
   */
  getSocialIdentityProviders(): Promise<SocialIdpSkeleton[]>;
  /**
   * Get social identity provider by id
   * @param {string} providerId identity provider id/name
   * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social identity provider object
   * @deprecated since v2.0.0 use {@link Idp.readSocialIdentityProvider | readSocialIdentityProvider} instead
   * ```javascript
   * readSocialIdentityProvider(providerId: string): Promise<SocialIdpSkeleton>
   * ```
   * @group Deprecated
   */
  getSocialProvider(providerId: string): Promise<SocialIdpSkeleton>;
  /**
   * Update or create identity provider
   * @param {string} providerType identity provider type
   * @param {string} providerId identity provider id/name
   * @param {SocialIdpSkeleton} providerData identity provider data
   * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social identity provider object
   * @deprecated since v2.0.0 use {@link Idp.updateSocialIdentityProvider | updateSocialIdentityProvider} or {@link Idp.createSocialIdentityProvider | createSocialIdentityProvider} instead
   * ```javascript
   * updateSocialIdentityProvider(providerType: string, providerId: string, providerData: SocialIdpSkeleton): Promise<SocialIdpSkeleton>
   * createSocialIdentityProvider(providerType: string, providerId: string, providerData: SocialIdpSkeleton): Promise<SocialIdpSkeleton>
   * ```
   * @group Deprecated
   */
  putProviderByTypeAndId(
    providerType: string,
    providerId: string,
    providerData: SocialIdpSkeleton
  ): Promise<SocialIdpSkeleton>;
  /**
   * Delete social identity provider
   * @param {string} providerId social identity provider id/name
   * @returns {Promise<SocialIdpSkeleton>} a promise that resolves to a social identity provider object
   * @deprecated since v2.0.0 use {@link Idp.deleteSocialIdentityProvider | deleteSocialIdentityProvider} instead
   * ```javascript
   * deleteSocialIdentityProvider(providerId: string): Promise<SocialIdpSkeleton>
   * ```
   * @group Deprecated
   */
  deleteSocialProvider(providerId: string): Promise<SocialIdpSkeleton>;
  /**
   * Export social identity provider
   * @param {string} providerId provider id/name
   * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   * @deprecated since v2.0.0 use {@link Idp.exportSocialIdentityProvider | exportSocialIdentityProvider} instead
   * ```javascript
   * exportSocialIdentityProvider(providerId: string): Promise<SocialProviderExportInterface>
   * ```
   * @group Deprecated
   */
  exportSocialProvider(
    providerId: string
  ): Promise<SocialProviderExportInterface>;
  /**
   * Export all social identity providers
   * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   * @deprecated since v2.0.0 use {@link Idp.exportSocialIdentityProviders | exportSocialIdentityProviders} instead
   * ```javascript
   * exportSocialIdentityProviders(): Promise<SocialProviderExportInterface[]>
   * ```
   * @group Deprecated
   */
  exportSocialProviders(): Promise<SocialProviderExportInterface>;
  /**
   * Import social identity provider
   * @param {string} providerId provider id/name
   * @param {SocialProviderExportInterface} importData import data
   * @deprecated since v2.0.0 use {@link Idp.importSocialIdentityProvider | importSocialIdentityProvider} instead
   * ```javascript
   * importSocialIdentityProvider(providerId: string, importData: SocialProviderExportInterface): Promise<SocialIdpSkeleton>
   * ```
   * @group Deprecated
   */
  importSocialProvider(
    providerId: string,
    importData: SocialProviderExportInterface
  ): Promise<boolean>;
  /**
   * Import first social identity provider
   * @param {SocialProviderExportInterface} importData import data
   * @deprecated since v2.0.0 use {@link Idp.importFirstSocialIdentityProvider | importFirstSocialIdentityProvider} instead
   * ```javascript
   * importFirstSocialIdentityProvider(importData: SocialProviderExportInterface): Promise<SocialIdpSkeleton>
   * ```
   * @group Deprecated
   */
  importFirstSocialProvider(
    importData: SocialProviderExportInterface
  ): Promise<boolean>;
  /**
   * Import all social identity providers
   * @param {SocialProviderExportInterface} importData import data
   * @deprecated since v2.0.0 use {@link Idp.importFirstSocialIdentityProviders | importFirstSocialIdentityProviders} instead
   * ```javascript
   * importFirstSocialIdentityProviders(importData: SocialProviderExportInterface): Promise<SocialIdpSkeleton[]>
   * ```
   * @group Deprecated
   */
  importSocialProviders(
    importData: SocialProviderExportInterface
  ): Promise<boolean>;
};

export default (state: State): Idp => {
  return {
    async readSocialIdentityProviders() {
      return readSocialIdentityProviders({ state });
    },
    async readSocialIdentityProvider(providerId: string) {
      return readSocialIdentityProvider({ providerId, state });
    },
    async createSocialIdentityProvider(
      providerType: string,
      providerId: string,
      providerData: SocialIdpSkeleton
    ) {
      return createSocialIdentityProvider({
        providerType,
        providerId,
        providerData,
        state,
      });
    },
    async updateSocialIdentityProvider(
      providerType: string,
      providerId: string,
      providerData: SocialIdpSkeleton
    ) {
      return updateSocialIdentityProvider({
        providerType,
        providerId,
        providerData,
        state,
      });
    },
    async deleteSocialIdentityProviders(): Promise<SocialIdpSkeleton[]> {
      return deleteSocialIdentityProviders({ state });
    },
    async deleteSocialIdentityProvider(
      providerId: string
    ): Promise<SocialIdpSkeleton> {
      return deleteSocialIdentityProvider({ providerId, state });
    },
    async exportSocialIdentityProvider(
      providerId: string
    ): Promise<SocialProviderExportInterface> {
      return exportSocialIdentityProvider({ providerId, state });
    },
    async exportSocialIdentityProviders(): Promise<SocialProviderExportInterface> {
      return exportSocialIdentityProviders({ state });
    },
    async importSocialIdentityProvider(
      providerId: string,
      importData: SocialProviderExportInterface,
      options: SocialIdentityProviderImportOptions = { deps: true }
    ): Promise<SocialIdpSkeleton> {
      return importSocialIdentityProvider({
        providerId,
        importData,
        options,
        state,
      });
    },
    async importFirstSocialIdentityProvider(
      importData: SocialProviderExportInterface,
      options: SocialIdentityProviderImportOptions = { deps: true }
    ): Promise<SocialIdpSkeleton> {
      return importFirstSocialIdentityProvider({ importData, options, state });
    },
    async importSocialIdentityProviders(
      importData: SocialProviderExportInterface,
      options: SocialIdentityProviderImportOptions = { deps: true }
    ): Promise<SocialIdpSkeleton[]> {
      return importSocialIdentityProviders({ importData, options, state });
    },

    // Deprecated

    async getSocialIdentityProviders() {
      return readSocialIdentityProviders({ state });
    },
    async getSocialProvider(providerId: string) {
      return readSocialIdentityProvider({ providerId, state });
    },
    async putProviderByTypeAndId(
      providerType: string,
      providerId: string,
      providerData: SocialIdpSkeleton
    ) {
      return updateSocialIdentityProvider({
        providerType,
        providerId,
        providerData,
        state,
      });
    },
    async deleteSocialProvider(providerId: string): Promise<SocialIdpSkeleton> {
      return deleteSocialIdentityProvider({ providerId, state });
    },
    async exportSocialProvider(
      providerId: string
    ): Promise<SocialProviderExportInterface> {
      return exportSocialIdentityProvider({ providerId, state });
    },
    async exportSocialProviders(): Promise<SocialProviderExportInterface> {
      return exportSocialIdentityProviders({ state });
    },
    async importSocialProvider(
      providerId: string,
      importData: SocialProviderExportInterface
    ): Promise<boolean> {
      return importSocialProvider({ providerId, importData, state });
    },
    async importFirstSocialProvider(
      importData: SocialProviderExportInterface
    ): Promise<boolean> {
      return importFirstSocialProvider({ importData, state });
    },
    async importSocialProviders(
      importData: SocialProviderExportInterface
    ): Promise<boolean> {
      return importSocialProviders({ importData, state });
    },
  };
};

/**
 * Social identity provider export options
 */
export interface SocialIdentityProviderExportOptions {
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
 * Social identity provider import options
 */
export interface SocialIdentityProviderImportOptions {
  /**
   * Include any dependencies (scripts).
   */
  deps: boolean;
}

export interface SocialProviderExportInterface {
  meta?: ExportMetaData;
  script: Record<string, ScriptSkeleton>;
  idp: Record<string, SocialIdpSkeleton>;
}

/**
 * Create an empty idp export template
 * @returns {SocialProviderExportInterface} an empty idp export template
 */
function createIdpExportTemplate({
  state,
}: {
  state: State;
}): SocialProviderExportInterface {
  return {
    meta: getMetadata({ state }),
    script: {},
    idp: {},
  } as SocialProviderExportInterface;
}

/**
 * Get all social identity providers
 * @returns {Promise} a promise that resolves to an object containing an array of social identity providers
 */
export async function readSocialIdentityProviders({
  state,
}: {
  state: State;
}): Promise<SocialIdpSkeleton[]> {
  const { result } = await _getSocialIdentityProviders({ state });
  return result;
}

/**
 * Read social identity provider
 * @param {string} providerId social identity provider id/name
 * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social identity provider object
 */
export async function readSocialIdentityProvider({
  providerId,
  state,
}: {
  providerId: string;
  state: State;
}): Promise<SocialIdpSkeleton> {
  const response = await readSocialIdentityProviders({ state });
  const foundProviders = response.filter(
    (provider) => provider._id === providerId
  );
  switch (foundProviders.length) {
    case 1:
      return foundProviders[0];
    case 0:
      throw new Error(`Provider '${providerId}' not found`);
    default:
      throw new Error(
        `${foundProviders.length} providers '${providerId}' found`
      );
  }
}

export async function createSocialIdentityProvider({
  providerType,
  providerId,
  providerData,
  state,
}: {
  providerType: string;
  providerId: string;
  providerData: SocialIdpSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}): Promise<SocialIdpSkeleton> {
  debugMessage({
    message: `IdpOps.createSocialIdentityProvider: start`,
    state,
  });
  try {
    await readSocialIdentityProvider({ providerId, state });
  } catch (error) {
    const result = await updateSocialIdentityProvider({
      providerType,
      providerId,
      providerData,
      state,
    });
    debugMessage({
      message: `IdpOps.createSocialIdentityProvider: end`,
      state,
    });
    return result;
  }
  throw new Error(`Provider ${providerId} already exists!`);
}

export async function updateSocialIdentityProvider({
  providerType,
  providerId,
  providerData,
  state,
}: {
  providerType: string;
  providerId: string;
  providerData: SocialIdpSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}): Promise<SocialIdpSkeleton> {
  debugMessage({
    message: `IdpOps.updateSocialIdentityProvider: start`,
    state,
  });
  try {
    const response = await _putProviderByTypeAndId({
      type: providerType,
      id: providerId,
      providerData,
      state,
    });
    debugMessage({
      message: `IdpOps.updateSocialIdentityProvider: end`,
      state,
    });
    return response;
  } catch (importError) {
    if (
      importError.response?.status === 400 &&
      importError.response?.data?.message === 'Invalid attribute specified.'
    ) {
      const { validAttributes } = importError.response.data.detail;
      validAttributes.push('_id', '_type');
      for (const attribute of Object.keys(providerData)) {
        if (!validAttributes.includes(attribute)) {
          if (state.getVerbose())
            printMessage({
              message: `\nRemoving invalid attribute: ${attribute}`,
              type: 'warn',
              newline: false,
              state,
            });
          delete providerData[attribute];
        }
      }
      if (state.getVerbose())
        printMessage({ message: '\n', type: 'warn', newline: false, state });
      const response = await _putProviderByTypeAndId({
        type: providerType,
        id: providerId,
        providerData,
        state,
      });
      debugMessage({
        message: `IdpOps.updateSocialIdentityProvider: end (after retry)`,
        state,
      });
      return response;
    } else {
      // re-throw unhandleable error
      throw importError;
    }
  }
}

/**
 * Delete all social identity providers
 * @returns {Promise<SocialIdpSkeleton[]>} a promise that resolves to an array of social identity provider objects
 */
export async function deleteSocialIdentityProviders({
  state,
}: {
  state: State;
}): Promise<SocialIdpSkeleton[]> {
  debugMessage({
    message: `IdpOps.deleteSocialProviders: start`,
    state,
  });
  const result: SocialIdpSkeleton[] = [];
  const errors = [];
  try {
    const providers = await readSocialIdentityProviders({ state });
    for (const provider of providers) {
      try {
        debugMessage({
          message: `IdpOps.deleteSocialProviders: '${provider._id}'`,
          state,
        });
        result.push(
          await deleteSocialIdentityProvider({
            providerId: provider._id,
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
    message: `IdpOps.deleteSocialProviders: end`,
    state,
  });
  return result;
}

/**
 * Delete social identity provider by id
 * @param {String} providerId social identity provider id/name
 * @returns {Promise} a promise that resolves a social identity provider object
 */
export async function deleteSocialIdentityProvider({
  providerId,
  state,
}: {
  providerId: string;
  state: State;
}): Promise<SocialIdpSkeleton> {
  const response = await readSocialIdentityProviders({ state });
  const foundProviders = response.filter(
    (provider) => provider._id === providerId
  );
  switch (foundProviders.length) {
    case 1:
      return await deleteProviderByTypeAndId({
        type: foundProviders[0]._type._id,
        providerId: foundProviders[0]._id,
        state,
      });
    case 0:
      throw new Error(`Provider '${providerId}' not found`);
    default:
      throw new Error(
        `${foundProviders.length} providers '${providerId}' found`
      );
  }
}

/**
 * Export social provider by id
 * @param {string} providerId provider id/name
 * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
 */
export async function exportSocialIdentityProvider({
  providerId,
  state,
}: {
  providerId: string;
  state: State;
}): Promise<SocialProviderExportInterface> {
  debugMessage({ message: `IdpOps.exportSocialProvider: start`, state });
  const idpData = await readSocialIdentityProvider({ providerId, state });
  const exportData = createIdpExportTemplate({ state });
  exportData.idp[idpData._id] = idpData;
  if (idpData.transform) {
    const scriptData = await getScript({ scriptId: idpData.transform, state });
    scriptData.script = convertBase64TextToArray(scriptData.script);
    exportData.script[idpData.transform] = scriptData;
  }
  debugMessage({ message: `IdpOps.exportSocialProvider: end`, state });
  return exportData;
}

/**
 * Export all providers
 * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
 */
export async function exportSocialIdentityProviders({
  state,
}: {
  state: State;
}): Promise<SocialProviderExportInterface> {
  const exportData = createIdpExportTemplate({ state });
  const allIdpsData = await readSocialIdentityProviders({ state });
  const indicatorId = createProgressIndicator({
    total: allIdpsData.length,
    message: 'Exporting providers',
    state,
  });
  for (const idpData of allIdpsData) {
    updateProgressIndicator({
      id: indicatorId,
      message: `Exporting provider ${idpData._id}`,
      state,
    });
    exportData.idp[idpData._id] = idpData;
    if (idpData.transform) {
      const scriptData = await getScript({
        scriptId: idpData.transform,
        state,
      });
      scriptData.script = convertBase64TextToArray(scriptData.script);
      exportData.script[idpData.transform] = scriptData;
    }
  }
  stopProgressIndicator({
    id: indicatorId,
    message: `${allIdpsData.length} providers exported.`,
    state,
  });
  return exportData;
}

/**
 * Import social identity provider
 * @param {string} providerId provider id/name
 * @param {SocialProviderExportInterface} importData import data
 * @param {SocialIdentityProviderImportOptions} options import options
 * @returns {Promise<SocialIdpSkeleton>} a promise resolving to a social identity provider object
 */
export async function importSocialIdentityProvider({
  providerId,
  importData,
  options = { deps: true },
  state,
}: {
  providerId: string;
  importData: SocialProviderExportInterface;
  options?: SocialIdentityProviderImportOptions;
  state: State;
}): Promise<SocialIdpSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const idpId of Object.keys(importData.idp)) {
    if (idpId === providerId) {
      try {
        if (options.deps) {
          const scriptId = importData.idp[idpId].transform as string;
          const scriptData = importData.script[scriptId as string];
          if (scriptId && scriptData) {
            scriptData.script = convertTextArrayToBase64(
              scriptData.script as string[]
            );
            await updateScript({ scriptId, scriptData, state });
          }
        }
        response = await updateSocialIdentityProvider({
          providerType: importData.idp[idpId]._type._id,
          providerId: idpId,
          providerData: importData.idp[idpId],
          state,
        });
        imported.push(idpId);
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
    throw new Error(`Import error:\n${providerId} not found in import data!`);
  }
  return response;
}

/**
 * Import first social identity provider
 * @param {SocialProviderExportInterface} importData import data
 * @param {SocialIdentityProviderImportOptions} options import options
 * @returns {Promise<SocialIdpSkeleton>} a promise resolving to a social identity provider object
 */
export async function importFirstSocialIdentityProvider({
  importData,
  options = { deps: true },
  state,
}: {
  importData: SocialProviderExportInterface;
  options?: SocialIdentityProviderImportOptions;
  state: State;
}): Promise<SocialIdpSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const idpId of Object.keys(importData.idp)) {
    try {
      if (options.deps) {
        const scriptId = importData.idp[idpId].transform as string;
        const scriptData = importData.script[scriptId as string];
        if (scriptId && scriptData) {
          scriptData.script = convertTextArrayToBase64(
            scriptData.script as string[]
          );
          await updateScript({ scriptId, scriptData, state });
        }
      }
      response = await updateSocialIdentityProvider({
        providerType: importData.idp[idpId]._type._id,
        providerId: idpId,
        providerData: importData.idp[idpId],
        state,
      });
      imported.push(idpId);
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
    throw new Error(`Import error:\nNo providers found in import data!`);
  }
  return response;
}

/**
 * Import all social identity providers
 * @param {SocialProviderExportInterface} importData import data
 * @param {SocialIdentityProviderImportOptions} options import options
 * @returns {Promise<SocialIdpSkeleton[]>} a promise resolving to an array of social identity provider objects
 */
export async function importSocialIdentityProviders({
  importData,
  options = { deps: true },
  state,
}: {
  importData: SocialProviderExportInterface;
  options?: SocialIdentityProviderImportOptions;
  state: State;
}): Promise<SocialIdpSkeleton[]> {
  const response = [];
  const errors = [];
  const imported = [];
  for (const idpId of Object.keys(importData.idp)) {
    try {
      if (options.deps) {
        const scriptId = importData.idp[idpId].transform as string;
        const scriptData = { ...importData.script[scriptId as string] };
        if (scriptId && scriptData) {
          scriptData.script = convertTextArrayToBase64(
            scriptData.script as string[]
          );
          await updateScript({ scriptId, scriptData, state });
        }
      }
      response.push(
        await updateSocialIdentityProvider({
          providerType: importData.idp[idpId]._type._id,
          providerId: idpId,
          providerData: importData.idp[idpId],
          state,
        })
      );
      imported.push(idpId);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo providers found in import data!`);
  }
  return response;
}

// Deprecated

/**
 * Import provider by id/name
 * @param {string} providerId provider id/name
 * @param {SocialProviderExportInterface} importData import data
 */
export async function importSocialProvider({
  providerId,
  importData,
  state,
}: {
  providerId: string;
  importData: SocialProviderExportInterface;
  state: State;
}): Promise<boolean> {
  for (const idpId of Object.keys(importData.idp)) {
    if (idpId === providerId) {
      const scriptId = importData.idp[idpId].transform as string;
      const scriptData = importData.script[scriptId as string];
      if (scriptId && scriptData) {
        scriptData.script = convertTextArrayToBase64(
          scriptData.script as string[]
        );
        await updateScript({ scriptId, scriptData, state });
      }
      await updateSocialIdentityProvider({
        providerType: importData.idp[idpId]._type._id,
        providerId: idpId,
        providerData: importData.idp[idpId],
        state,
      });
      return true;
    }
  }
  return false;
}

/**
 * Import first provider
 * @param {SocialProviderExportInterface} importData import data
 */
export async function importFirstSocialProvider({
  importData,
  state,
}: {
  importData: SocialProviderExportInterface;
  state: State;
}): Promise<boolean> {
  for (const idpId of Object.keys(importData.idp)) {
    const scriptId = importData.idp[idpId].transform as string;
    const scriptData = importData.script[scriptId as string];
    if (scriptId && scriptData) {
      scriptData.script = convertTextArrayToBase64(
        scriptData.script as string[]
      );
      await updateScript({ scriptId, scriptData, state });
    }
    await updateSocialIdentityProvider({
      providerType: importData.idp[idpId]._type._id,
      providerId: idpId,
      providerData: importData.idp[idpId],
      state,
    });
    return true;
  }
  return false;
}

/**
 * Import all providers
 * @param {SocialProviderExportInterface} importData import data
 */
export async function importSocialProviders({
  importData,
  state,
}: {
  importData: SocialProviderExportInterface;
  state: State;
}): Promise<boolean> {
  let outcome = true;
  for (const idpId of Object.keys(importData.idp)) {
    try {
      const scriptId = importData.idp[idpId].transform as string;
      const scriptData = { ...importData.script[scriptId as string] };
      if (scriptId && scriptData) {
        scriptData.script = convertTextArrayToBase64(
          scriptData.script as string[]
        );
        await updateScript({ scriptId, scriptData, state });
      }
      await updateSocialIdentityProvider({
        providerType: importData.idp[idpId]._type._id,
        providerId: idpId,
        providerData: importData.idp[idpId],
        state,
      });
    } catch (error) {
      printMessage({
        message: error.response?.data || error,
        type: 'error',
        state,
      });
      printMessage({
        message: `\nError importing provider ${idpId}`,
        type: 'error',
        state,
      });
      outcome = false;
    }
  }
  return outcome;
}
