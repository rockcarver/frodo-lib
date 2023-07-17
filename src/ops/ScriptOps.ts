import { v4 as uuidv4 } from 'uuid';
import { applyNameCollisionPolicy } from '../utils/ForgeRockUtils';
import {
  createProgressIndicator,
  debugMessage,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import {
  getScript,
  getScriptByName as _getScriptByName,
  getScripts as _getScripts,
  putScript as _putScript,
  deleteScript,
} from '../api/ScriptApi';
import {
  convertBase64TextToArray,
  convertTextArrayToBase64,
  getMetadata,
} from '../utils/ExportImportUtils';
import { ScriptSkeleton } from '../api/ApiTypes';
import { ExportMetaData } from '../ops/OpsTypes';
import { validateScriptDecoded } from '../utils/ScriptValidationUtils';
import { State } from '../shared/State';

export type Script = {
  /**
   * Get all scripts
   * @returns {Promise<ScriptSkeleton[]>} a promise that resolves to an array of script objects
   */
  getScripts(): Promise<ScriptSkeleton[]>;
  /**
   * Get script by name
   * @param {string} name name of the script
   * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
   */
  getScriptByName(scriptName: string): Promise<ScriptSkeleton>;
  /**
   * Create or update script
   * @param {string} scriptId script uuid
   * @param {ScriptSkeleton} scriptData script object
   * @returns {Promise<boolean>} a status object
   */
  putScript(scriptId: string, scriptData: ScriptSkeleton): Promise<boolean>;
  /**
   * Export script by id
   * @param {string} scriptId script uuid
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  exportScript(scriptId: string): Promise<ScriptExportInterface>;
  /**
   * Export script by name
   * @param {string} name script name
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  exportScriptByName(scriptName: string): Promise<ScriptExportInterface>;
  /**
   * Export all scripts
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  exportScripts(): Promise<ScriptExportInterface>;
  /**
   * Import scripts
   * @param {string} scriptName Optional name of script. If supplied, only the script of that name is imported
   * @param {ScriptExportInterface} importData Script import data
   * @param {boolean} reUuid true to generate a new uuid for each script on import, false otherwise
   * @returns {Promise<boolean>} true if no errors occurred during import, false otherwise
   */
  importScripts(
    scriptName: string,
    importData: ScriptExportInterface,
    reUuid?: boolean,
    validate?: boolean
  ): Promise<boolean>;
  getScript(scriptId: string): Promise<any>;
  deleteScript(scriptId: string): Promise<any>;
};

export default (state: State): Script => {
  return {
    /**
     * Get all scripts
     * @returns {Promise<ScriptSkeleton[]>} a promise that resolves to an array of script objects
     */
    async getScripts(): Promise<ScriptSkeleton[]> {
      return getScripts({ state });
    },

    /**
     * Get script by name
     * @param {string} name name of the script
     * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
     */
    async getScriptByName(scriptName: string): Promise<ScriptSkeleton> {
      return getScriptByName({ scriptName, state });
    },

    /**
     * Create or update script
     * @param {string} scriptId script uuid
     * @param {ScriptSkeleton} scriptData script object
     * @returns {Promise<boolean>} a status object
     */
    async putScript(
      scriptId: string,
      scriptData: ScriptSkeleton
    ): Promise<boolean> {
      return putScript({ scriptId, scriptData, state });
    },

    /**
     * Export script by id
     * @param {string} scriptId script uuid
     * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
     */
    async exportScript(scriptId: string): Promise<ScriptExportInterface> {
      return exportScript({ scriptId, state });
    },

    /**
     * Export script by name
     * @param {string} name script name
     * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
     */
    async exportScriptByName(
      scriptName: string
    ): Promise<ScriptExportInterface> {
      return exportScriptByName({ scriptName, state });
    },

    /**
     * Export all scripts
     * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
     */
    async exportScripts(): Promise<ScriptExportInterface> {
      return exportScripts({ state });
    },

    /**
     * Import scripts
     * @param {string} scriptName Optional name of script. If supplied, only the script of that name is imported
     * @param {ScriptExportInterface} importData Script import data
     * @param {boolean} reUuid true to generate a new uuid for each script on import, false otherwise
     * @returns {Promise<boolean>} true if no errors occurred during import, false otherwise
     */
    async importScripts(
      scriptName: string,
      importData: ScriptExportInterface,
      reUuid = false,
      validate = false
    ): Promise<boolean> {
      return importScripts({
        scriptName,
        importData,
        reUuid,
        validate,
        state,
      });
    },

    getScript(scriptId: string) {
      return getScript({ scriptId, state });
    },

    deleteScript(scriptId: string) {
      return deleteScript({ scriptId, state });
    },
  };
};

export interface ScriptExportInterface {
  meta?: ExportMetaData;
  script: Record<string, ScriptSkeleton>;
}

/**
 * Create an empty idp export template
 * @returns {ScriptExportInterface} an empty idp export template
 */
export function createScriptExportTemplate({
  state,
}: {
  state: State;
}): ScriptExportInterface {
  return {
    meta: getMetadata({ state }),
    script: {},
  } as ScriptExportInterface;
}

/**
 * Get all scripts
 * @returns {Promise<ScriptSkeleton[]>} a promise that resolves to an array of script objects
 */
export async function getScripts({
  state,
}: {
  state: State;
}): Promise<ScriptSkeleton[]> {
  const { result } = await _getScripts({ state });
  return result;
}

/**
 * Get script by name
 * @param {string} scriptName name of the script
 * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
 */
export async function getScriptByName({
  scriptName,
  state,
}: {
  scriptName: string;
  state: State;
}): Promise<ScriptSkeleton> {
  const { result } = await _getScriptByName({ scriptName, state });
  switch (result.length) {
    case 1:
      return result[0];
    case 0:
      throw new Error(`Script '${scriptName}' not found`);
    default:
      throw new Error(`${result.length} scripts '${scriptName}' found`);
  }
}

/**
 * Create or update script
 * @param {string} scriptId script uuid
 * @param {ScriptSkeleton} scriptData script object
 * @returns {Promise<boolean>} a status object
 */
export async function putScript({
  scriptId,
  scriptData,
  state,
}: {
  scriptId: string;
  scriptData: ScriptSkeleton;
  state: State;
}): Promise<boolean> {
  try {
    if (Array.isArray(scriptData.script)) {
      scriptData.script = convertTextArrayToBase64(scriptData.script);
    }
    const result = await _putScript({ scriptId, scriptData, state });
    return result;
  } catch (error) {
    if (error.response?.status === 409) {
      printMessage({
        message: `createOrUpdateScript WARNING: script with name ${scriptData.name} already exists, using renaming policy... <name> => <name - imported (n)>`,
        type: 'warn',
        state,
      });
      const newName = applyNameCollisionPolicy(scriptData.name);
      scriptData.name = newName;
      const result = await putScript({ scriptId, scriptData, state });
      printMessage({
        message: `Saved script as ${newName}`,
        type: 'warn',
        state,
      });
      return result;
    }
    throw error;
  }
}

/**
 * Export script by id
 * @param {string} scriptId script uuid
 * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
 */
export async function exportScript({
  scriptId,
  state,
}: {
  scriptId: string;
  state: State;
}): Promise<ScriptExportInterface> {
  debugMessage({ message: `ScriptOps.exportScriptById: start`, state });
  const scriptData = await getScript({ scriptId, state });
  scriptData.script = convertBase64TextToArray(scriptData.script);
  const exportData = createScriptExportTemplate({ state });
  exportData.script[scriptData._id] = scriptData;
  debugMessage({ message: `ScriptOps.exportScriptById: end`, state });
  return exportData;
}

/**
 * Export script by name
 * @param {string} scriptName script name
 * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
 */
export async function exportScriptByName({
  scriptName,
  state,
}: {
  scriptName: string;
  state: State;
}): Promise<ScriptExportInterface> {
  debugMessage({ message: `ScriptOps.exportScriptByName: start`, state });
  const scriptData = await getScriptByName({ scriptName, state });
  scriptData.script = convertBase64TextToArray(scriptData.script as string);
  const exportData = createScriptExportTemplate({ state });
  exportData.script[scriptData._id] = scriptData;
  debugMessage({ message: `ScriptOps.exportScriptByName: end`, state });
  return exportData;
}

/**
 * Export all scripts
 * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
 */
export async function exportScripts({
  state,
}: {
  state: State;
}): Promise<ScriptExportInterface> {
  const scriptList = await getScripts({ state });
  const exportData = createScriptExportTemplate({ state });
  createProgressIndicator({
    total: scriptList.length,
    message: `Exporting ${scriptList.length} scripts...`,
    state,
  });
  for (const script of scriptList) {
    updateProgressIndicator({
      message: `Reading script ${script.name}`,
      state,
    });
    const scriptData = await getScriptByName({
      scriptName: script.name,
      state,
    });
    scriptData.script = convertBase64TextToArray(scriptData.script as string);
    exportData.script[scriptData._id] = scriptData;
  }
  stopProgressIndicator({
    message: `Exported ${scriptList.length} scripts.`,
    state,
  });
  return exportData;
}

/**
 * Import scripts
 * @param {string} scriptName Optional name of script. If supplied, only the script of that name is imported
 * @param {ScriptExportInterface} importData Script import data
 * @param {boolean} reUuid true to generate a new uuid for each script on import, false otherwise
 * @returns {Promise<boolean>} true if no errors occurred during import, false otherwise
 */
export async function importScripts({
  scriptName,
  importData,
  reUuid = false,
  validate = false,
  state,
}: {
  scriptName: string;
  importData: ScriptExportInterface;
  reUuid?: boolean;
  validate?: boolean;
  state: State;
}): Promise<boolean> {
  let outcome = true;
  debugMessage({ message: `ScriptOps.importScripts: start`, state });
  for (const existingId of Object.keys(importData.script)) {
    const scriptSkeleton = importData.script[existingId];
    let newId = existingId;
    if (reUuid) {
      newId = uuidv4();
      debugMessage({
        message: `ScriptOps.importScripts: Re-uuid-ing script ${scriptSkeleton.name} ${existingId} => ${newId}...`,
        state,
      });
      scriptSkeleton._id = newId;
    }
    if (scriptName) {
      debugMessage({
        message: `ScriptOps.importScripts: Renaming script ${scriptSkeleton.name} => ${scriptName}...`,
        state,
      });
      scriptSkeleton.name = scriptName;
    }
    if (validate) {
      if (!validateScriptDecoded({ scriptSkeleton, state })) {
        outcome = false;
        printMessage({
          message: `Error importing script '${scriptSkeleton.name}': Script is not valid`,
          type: 'error',
          state,
        });
        continue;
      }
    }
    try {
      await putScript({ scriptId: newId, scriptData: scriptSkeleton, state });
    } catch (error) {
      outcome = false;
      printMessage({
        message: `Error importing script '${scriptSkeleton.name}': ${error.message}`,
        type: 'error',
        state,
      });
      debugMessage({ message: error, state });
    }
    if (scriptName) break;
  }
  debugMessage({ message: `ScriptOps.importScripts: end`, state });
  return outcome;
}

export { getScript, deleteScript };
