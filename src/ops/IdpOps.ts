import {
  deleteProviderByTypeAndId,
  getSocialIdentityProviders as _getSocialIdentityProviders,
  putProviderByTypeAndId as _putProviderByTypeAndId,
} from '../api/SocialIdentityProvidersApi';
import { getScript } from '../api/ScriptApi';
import { putScript } from './ScriptOps';
import {
  convertBase64TextToArray,
  convertTextArrayToBase64,
} from './utils/ExportImportUtils';
import {
  printMessage,
  createProgressIndicator,
  updateProgressIndicator,
  stopProgressIndicator,
} from './utils/Console';
import { ExportMetaData } from './OpsTypes';
import {
  NoIdObjectSkeletonInterface,
  ScriptSkeleton,
  SocialIdpSkeleton,
} from '../api/ApiTypes';
import { getMetadata } from './utils/ExportImportUtils';
import { State } from '../shared/State';
import { debugMessage } from './utils/Console';

export type Idp = {
  /**
   * Get all social identity providers
   * @returns {Promise} a promise that resolves to an object containing an array of social identity providers
   */
  getSocialIdentityProviders(): Promise<any>;
  /**
   * Get social identity provider by id
   * @param {String} providerId social identity provider id/name
   * @returns {Promise} a promise that resolves a social identity provider object
   */
  getSocialProvider(providerId: string): Promise<any>;
  putProviderByTypeAndId(
    providerType: string,
    providerId: string,
    providerData: SocialIdpSkeleton
  ): Promise<any>;
  /**
   * Delete social identity provider by id
   * @param {String} providerId social identity provider id/name
   * @returns {Promise} a promise that resolves a social identity provider object
   */
  deleteSocialProvider(providerId: string): Promise<unknown>;
  /**
   * Export social provider by id
   * @param {string} providerId provider id/name
   * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   */
  exportSocialProvider(
    providerId: string
  ): Promise<SocialProviderExportInterface>;
  /**
   * Export all providers
   * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   */
  exportSocialProviders(): Promise<SocialProviderExportInterface>;
  /**
   * Import provider by id/name
   * @param {string} providerId provider id/name
   * @param {SocialProviderExportInterface} importData import data
   */
  importSocialProvider(
    providerId: string,
    importData: SocialProviderExportInterface
  ): Promise<boolean>;
  /**
   * Import first provider
   * @param {SocialProviderExportInterface} importData import data
   */
  importFirstSocialProvider(
    importData: SocialProviderExportInterface
  ): Promise<boolean>;
  /**
   * Import all providers
   * @param {SocialProviderExportInterface} importData import data
   */
  importSocialProviders(
    importData: SocialProviderExportInterface
  ): Promise<boolean>;
};

export default (state: State): Idp => {
  return {
    /**
     * Get all social identity providers
     * @returns {Promise} a promise that resolves to an object containing an array of social identity providers
     */
    async getSocialIdentityProviders() {
      return getSocialIdentityProviders({ state });
    },

    /**
     * Get social identity provider by id
     * @param {String} providerId social identity provider id/name
     * @returns {Promise} a promise that resolves a social identity provider object
     */
    async getSocialProvider(providerId: string) {
      return getSocialProvider({ providerId, state });
    },

    async putProviderByTypeAndId(
      providerType: string,
      providerId: string,
      providerData: SocialIdpSkeleton
    ) {
      return putProviderByTypeAndId({
        providerType,
        providerId,
        providerData,
        state,
      });
    },

    /**
     * Delete social identity provider by id
     * @param {String} providerId social identity provider id/name
     * @returns {Promise} a promise that resolves a social identity provider object
     */
    async deleteSocialProvider(providerId: string): Promise<unknown> {
      return deleteSocialProvider({ providerId, state });
    },

    /**
     * Export social provider by id
     * @param {string} providerId provider id/name
     * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
     */
    async exportSocialProvider(
      providerId: string
    ): Promise<SocialProviderExportInterface> {
      return exportSocialProvider({ providerId, state });
    },

    /**
     * Export all providers
     * @returns {Promise<SocialProviderExportInterface>} a promise that resolves to a SocialProviderExportInterface object
     */
    async exportSocialProviders(): Promise<SocialProviderExportInterface> {
      return exportSocialProviders({ state });
    },

    /**
     * Import provider by id/name
     * @param {string} providerId provider id/name
     * @param {SocialProviderExportInterface} importData import data
     */
    async importSocialProvider(
      providerId: string,
      importData: SocialProviderExportInterface
    ): Promise<boolean> {
      return importSocialProvider({ providerId, importData, state });
    },

    /**
     * Import first provider
     * @param {SocialProviderExportInterface} importData import data
     */
    async importFirstSocialProvider(
      importData: SocialProviderExportInterface
    ): Promise<boolean> {
      return importFirstSocialProvider({ importData, state });
    },

    /**
     * Import all providers
     * @param {SocialProviderExportInterface} importData import data
     */
    async importSocialProviders(
      importData: SocialProviderExportInterface
    ): Promise<boolean> {
      return importSocialProviders({ importData, state });
    },
  };
};

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
export async function getSocialIdentityProviders({ state }: { state: State }) {
  const { result } = await _getSocialIdentityProviders({ state });
  return result;
}

/**
 * Get social identity provider by id
 * @param {String} providerId social identity provider id/name
 * @returns {Promise} a promise that resolves a social identity provider object
 */
export async function getSocialProvider({
  providerId,
  state,
}: {
  providerId: string;
  state: State;
}) {
  const response = await getSocialIdentityProviders({ state });
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

export async function putProviderByTypeAndId({
  providerType,
  providerId,
  providerData,
  state,
}: {
  providerType: string;
  providerId: string;
  providerData: SocialIdpSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}) {
  debugMessage({ message: `IdpOps.putProviderByTypeAndId: start`, state });
  try {
    const response = await _putProviderByTypeAndId({
      type: providerType,
      id: providerId,
      providerData,
      state,
    });
    debugMessage({ message: `IdpOps.putProviderByTypeAndId: end`, state });
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
        message: `IdpOps.putProviderByTypeAndId: end (after retry)`,
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
 * Delete social identity provider by id
 * @param {String} providerId social identity provider id/name
 * @returns {Promise} a promise that resolves a social identity provider object
 */
export async function deleteSocialProvider({
  providerId,
  state,
}: {
  providerId: string;
  state: State;
}): Promise<unknown> {
  const response = await getSocialIdentityProviders({ state });
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
export async function exportSocialProvider({
  providerId,
  state,
}: {
  providerId: string;
  state: State;
}): Promise<SocialProviderExportInterface> {
  debugMessage({ message: `IdpOps.exportSocialProvider: start`, state });
  const idpData = await getSocialProvider({ providerId, state });
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
export async function exportSocialProviders({
  state,
}: {
  state: State;
}): Promise<SocialProviderExportInterface> {
  const exportData = createIdpExportTemplate({ state });
  const allIdpsData = await getSocialIdentityProviders({ state });
  createProgressIndicator({
    total: allIdpsData.length,
    message: 'Exporting providers',
    state,
  });
  for (const idpData of allIdpsData) {
    updateProgressIndicator({
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
    message: `${allIdpsData.length} providers exported.`,
    state,
  });
  return exportData;
}

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
        await putScript({ scriptId, scriptData, state });
      }
      await putProviderByTypeAndId({
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
      await putScript({ scriptId, scriptData, state });
    }
    await putProviderByTypeAndId({
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
        await putScript({ scriptId, scriptData, state });
      }
      await putProviderByTypeAndId({
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
