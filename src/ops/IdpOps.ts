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
import { ScriptSkeleton, SocialIdpSkeleton } from '../api/ApiTypes';
import { getMetadata } from './utils/ExportImportUtils';
import State from '../shared/State';
import { debugMessage } from './utils/Console';

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
  providerData: SocialIdpSkeleton;
  state: State;
}) {
  debugMessage(`IdpOps.putProviderByTypeAndId: start`);
  try {
    const response = await _putProviderByTypeAndId({
      type: providerType,
      id: providerId,
      providerData,
      state,
    });
    debugMessage(`IdpOps.putProviderByTypeAndId: end`);
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
            printMessage(
              `\nRemoving invalid attribute: ${attribute}`,
              'warn',
              false
            );
          delete providerData[attribute];
        }
      }
      if (state.getVerbose()) printMessage('\n', 'warn', false);
      const response = await _putProviderByTypeAndId({
        type: providerType,
        id: providerId,
        providerData,
        state,
      });
      debugMessage(`IdpOps.putProviderByTypeAndId: end (after retry)`);
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
  debugMessage(`IdpOps.exportSocialProvider: start`);
  const idpData = await getSocialProvider({ providerId, state });
  const exportData = createIdpExportTemplate({ state });
  exportData.idp[idpData._id] = idpData;
  if (idpData.transform) {
    const scriptData = await getScript({ scriptId: idpData.transform, state });
    scriptData.script = convertBase64TextToArray(scriptData.script);
    exportData.script[idpData.transform] = scriptData;
  }
  debugMessage(`IdpOps.exportSocialProvider: end`);
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
  createProgressIndicator(allIdpsData.length, 'Exporting providers');
  for (const idpData of allIdpsData) {
    updateProgressIndicator(`Exporting provider ${idpData._id}`);
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
  stopProgressIndicator(`${allIdpsData.length} providers exported.`);
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
      printMessage(error.response?.data || error, 'error');
      printMessage(`\nError importing provider ${idpId}`, 'error');
      outcome = false;
    }
  }
  return outcome;
}
