import { getScript, type ScriptSkeleton } from '../api/ScriptApi';
import {
  deleteProviderByTypeAndId,
  getSocialIdentityProviders as _getSocialIdentityProviders,
  putProviderByTypeAndId as _putProviderByTypeAndId,
  type SocialIdpSkeleton,
} from '../api/SocialIdentityProvidersApi';
import Constants from '../shared/Constants';
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
import { getCurrentRealmName } from '../utils/ForgeRockUtils';
import { FrodoError } from './FrodoError';
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
   * @param {SocialIdentityProviderExportOptions} options export options
   * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   */
  exportSocialIdentityProviders(
    options?: SocialIdentityProviderExportOptions
  ): Promise<SocialProviderExportInterface>;
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
    async exportSocialIdentityProviders(
      options: SocialIdentityProviderExportOptions = {
        deps: true,
        useStringArrays: true,
      }
    ): Promise<SocialProviderExportInterface> {
      return exportSocialIdentityProviders({ options, state });
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
  try {
    const { result } = await _getSocialIdentityProviders({ state });
    return result;
  } catch (error) {
    if (
      // service accounts don't have access to social idps in root realm in AIC
      (state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY &&
        error.response?.status === 403 &&
        state.getUseBearerTokenForAmApis() &&
        getCurrentRealmName(state) === '/') ||
      // hm... not sure if this clause ever tiggers
      (error.response?.status === 403 &&
        error.response?.data?.message ===
          'This operation is not available in PingOne Advanced Identity Cloud.')
    ) {
      return [];
    } else {
      throw new FrodoError(
        `Error reading ${getCurrentRealmName(state) + ' realm'} providers`,
        error
      );
    }
  }
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
  try {
    const response = await readSocialIdentityProviders({ state });
    const foundProviders = response.filter(
      (provider) => provider._id === providerId
    );
    switch (foundProviders.length) {
      case 1:
        return foundProviders[0];
      case 0:
        throw new FrodoError(`Not found`);
      default:
        throw new FrodoError(`Multiple providers found`);
    }
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} provider ${providerId}`,
      error
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
  providerData: SocialIdpSkeleton;
  state: State;
}): Promise<SocialIdpSkeleton> {
  debugMessage({
    message: `IdpOps.createSocialIdentityProvider: start`,
    state,
  });
  try {
    await readSocialIdentityProvider({ providerId, state });
  } catch (error) {
    try {
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
    } catch (error) {
      throw new FrodoError(
        `Error creating ${getCurrentRealmName(state) + ' realm'} provider ${providerId}`,
        error
      );
    }
  }
  throw new FrodoError(
    `${getCurrentRealmName(state) + ' realm'} provider ${providerId} already exists`
  );
}

export async function updateSocialIdentityProvider({
  providerType,
  providerId,
  providerData,
  state,
}: {
  providerType: string;
  providerId: string;
  providerData: SocialIdpSkeleton;
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
  } catch (error) {
    if (
      error.response?.status === 400 &&
      error.response?.data?.message === 'Invalid attribute specified.'
    ) {
      const { validAttributes } = error.response.data.detail;
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
      // unhandleable error
      throw new FrodoError(
        `Error updating ${getCurrentRealmName(state) + ' realm'} provider ${providerId}`,
        error
      );
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
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting providers`, errors);
    }
    debugMessage({
      message: `IdpOps.deleteSocialProviders: end`,
      state,
    });
    return result;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} providers`,
      error
    );
  }
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
  try {
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
        throw new Error(`Not found`);
      default:
        throw new Error(`Multiple providers found`);
    }
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} provider ${providerId}`,
      error
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
  try {
    debugMessage({ message: `IdpOps.exportSocialProvider: start`, state });
    const idpData = await readSocialIdentityProvider({ providerId, state });
    const exportData = createIdpExportTemplate({ state });
    exportData.idp[idpData._id] = idpData;
    if (idpData.transform) {
      try {
        const scriptData = await getScript({
          scriptId: idpData.transform,
          state,
        });
        scriptData.script = convertBase64TextToArray(
          scriptData.script as string
        );
        exportData.script[idpData.transform] = scriptData;
      } catch (error) {
        throw new FrodoError(
          `Error reading ${getCurrentRealmName(state) + ' realm'} script ${idpData.transform}`
        );
      }
    }
    debugMessage({ message: `IdpOps.exportSocialProvider: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} provider ${providerId}`,
      error
    );
  }
}

/**
 * Export all providers
 * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
 */
export async function exportSocialIdentityProviders({
  options = { deps: true, useStringArrays: true },
  state,
}: {
  options?: SocialIdentityProviderExportOptions;
  state: State;
}): Promise<SocialProviderExportInterface> {
  const errors: Error[] = [];
  let indicatorId: string;
  try {
    const exportData = createIdpExportTemplate({ state });
    const allIdpsData = await readSocialIdentityProviders({ state });
    indicatorId = createProgressIndicator({
      total: allIdpsData.length,
      message: `Exporting ${getCurrentRealmName(state) + ' realm'} providers`,
      state,
    });
    for (const idpData of allIdpsData) {
      try {
        updateProgressIndicator({
          id: indicatorId,
          message: `Exporting ${getCurrentRealmName(state) + ' realm'} provider ${idpData._id}`,
          state,
        });
        exportData.idp[idpData._id] = idpData;
        if (options.deps && idpData.transform) {
          const scriptData = await getScript({
            scriptId: idpData.transform,
            state,
          });
          if (options.useStringArrays) {
            scriptData.script = convertBase64TextToArray(
              scriptData.script as string
            );
          }
          exportData.script[idpData.transform] = scriptData;
        }
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error exporting ${getCurrentRealmName(state) + ' realm'} dependencies`,
        errors
      );
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `${allIdpsData.length} ${getCurrentRealmName(state) + ' realm'} providers exported.`,
      state,
    });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting ${getCurrentRealmName(state) + ' realm'} providers`,
      status: 'fail',
      state,
    });
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} providers`,
      error
    );
  }
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
        if (options.deps && importData.idp[idpId].transform) {
          try {
            const scriptId = importData.idp[idpId].transform as string;
            const scriptData = importData.script[scriptId as string];
            if (scriptId && scriptData) {
              scriptData.script = convertTextArrayToBase64(
                scriptData.script as string[]
              );
              await updateScript({ scriptId, scriptData, state });
            }
          } catch (error) {
            errors.push(error);
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
  if (errors.length > 0) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} provider ${providerId}`,
      errors
    );
  }
  if (0 === imported.length) {
    throw new FrodoError(
      `${getCurrentRealmName(state) + ' realm'} provider ${providerId} not found in import data`
    );
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
      if (options.deps && importData.idp[idpId].transform) {
        try {
          const scriptId = importData.idp[idpId].transform as string;
          const scriptData = importData.script[scriptId as string];
          if (scriptId && scriptData) {
            scriptData.script = convertTextArrayToBase64(
              scriptData.script as string[]
            );
            await updateScript({ scriptId, scriptData, state });
          }
        } catch (error) {
          errors.push(error);
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
  if (errors.length > 0) {
    throw new FrodoError(
      `Error importing first ${getCurrentRealmName(state) + ' realm'} provider`,
      errors
    );
  }
  if (0 === imported.length) {
    throw new FrodoError(`No providers found in import data`);
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
  for (const idpId of Object.keys(importData.idp)) {
    try {
      if (
        options.deps &&
        importData.idp[idpId].transform &&
        importData.script
      ) {
        try {
          const scriptId = importData.idp[idpId].transform as string;
          const scriptData = { ...importData.script[scriptId as string] };
          if (scriptId && scriptData) {
            scriptData.script = convertTextArrayToBase64(
              scriptData.script as string[]
            );
            await updateScript({ scriptId, scriptData, state });
          }
        } catch (error) {
          errors.push(error);
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
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} providers`,
      errors
    );
  }
  return response;
}

// Deprecated

/**
 * Import provider by id/name
 * @param {string} providerId provider id/name
 * @param {SocialProviderExportInterface} importData import data
 * @returns {Promise<boolean>} a promise resolving to true if successful, false otherwise
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
 * @returns {Promise<boolean>} a promise resolving to true if successful, false otherwise
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
 * @returns {Promise<boolean>} a promise resolving to true if successful, false otherwise
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
      outcome = false;
    }
  }
  return outcome;
}
