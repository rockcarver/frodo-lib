import { v4 as uuidv4 } from 'uuid';
import { applyNameCollisionPolicy } from './utils/OpsUtils';
import {
  createProgressIndicator,
  debugMessage,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from './utils/Console';
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
} from './utils/ExportImportUtils';
import { ScriptSkeleton } from '../api/ApiTypes';
import { ExportMetaData } from '../ops/OpsTypes';
import { validateScriptDecoded } from './utils/ScriptValidationUtils';
import State from '../shared/State';

export default class ScriptOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  /**
   * Get all scripts
   * @returns {Promise<ScriptSkeleton[]>} a promise that resolves to an array of script objects
   */
  async getScripts(): Promise<ScriptSkeleton[]> {
    return getScripts({ state: this.state });
  }

  /**
   * Get script by name
   * @param {string} name name of the script
   * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
   */
  async getScriptByName(scriptName: string): Promise<ScriptSkeleton> {
    return getScriptByName({ scriptName, state: this.state });
  }

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
    return putScript({ scriptId, scriptData, state: this.state });
  }

  /**
   * Export script by id
   * @param {string} scriptId script uuid
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  async exportScript(scriptId: string): Promise<ScriptExportInterface> {
    return exportScript({ scriptId, state: this.state });
  }

  /**
   * Export script by name
   * @param {string} name script name
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  async exportScriptByName(scriptName: string): Promise<ScriptExportInterface> {
    return exportScriptByName({ scriptName, state: this.state });
  }

  /**
   * Export all scripts
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  async exportScripts(): Promise<ScriptExportInterface> {
    return exportScripts({ state: this.state });
  }

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
      state: this.state,
    });
  }

  getScript(scriptId: string) {
    return getScript({ scriptId, state: this.state });
  }

  deleteScript(scriptId: string) {
    return deleteScript({ scriptId, state: this.state });
  }
}

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
      printMessage(
        `createOrUpdateScript WARNING: script with name ${scriptData.name} already exists, using renaming policy... <name> => <name - imported (n)>`,
        'warn'
      );
      const newName = applyNameCollisionPolicy(scriptData.name);
      scriptData.name = newName;
      const result = await putScript({ scriptId, scriptData, state });
      printMessage(`Saved script as ${newName}`, 'warn');
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
  debugMessage(`ScriptOps.exportScriptById: start`);
  const scriptData = await getScript({ scriptId, state });
  scriptData.script = convertBase64TextToArray(scriptData.script);
  const exportData = createScriptExportTemplate({ state });
  exportData.script[scriptData._id] = scriptData;
  debugMessage(`ScriptOps.exportScriptById: end`);
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
  debugMessage(`ScriptOps.exportScriptByName: start`);
  const scriptData = await getScriptByName({ scriptName, state });
  scriptData.script = convertBase64TextToArray(scriptData.script as string);
  const exportData = createScriptExportTemplate({ state });
  exportData.script[scriptData._id] = scriptData;
  debugMessage(`ScriptOps.exportScriptByName: end`);
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
  createProgressIndicator(
    scriptList.length,
    `Exporting ${scriptList.length} scripts...`
  );
  for (const script of scriptList) {
    updateProgressIndicator(`Reading script ${script.name}`);
    const scriptData = await getScriptByName({
      scriptName: script.name,
      state,
    });
    scriptData.script = convertBase64TextToArray(scriptData.script as string);
    exportData.script[scriptData._id] = scriptData;
  }
  stopProgressIndicator(`Exported ${scriptList.length} scripts.`);
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
  debugMessage(`ScriptOps.importScripts: start`);
  for (const existingId of Object.keys(importData.script)) {
    const scriptSkeleton = importData.script[existingId];
    let newId = existingId;
    if (reUuid) {
      newId = uuidv4();
      debugMessage(
        `ScriptOps.importScripts: Re-uuid-ing script ${scriptSkeleton.name} ${existingId} => ${newId}...`
      );
      scriptSkeleton._id = newId;
    }
    if (scriptName) {
      debugMessage(
        `ScriptOps.importScripts: Renaming script ${scriptSkeleton.name} => ${scriptName}...`
      );
      scriptSkeleton.name = scriptName;
    }
    if (validate) {
      if (!validateScriptDecoded(scriptSkeleton)) {
        outcome = false;
        printMessage(
          `Error importing script '${scriptSkeleton.name}': Script is not valid`,
          'error'
        );
        continue;
      }
    }
    try {
      await putScript({ scriptId: newId, scriptData: scriptSkeleton, state });
    } catch (error) {
      outcome = false;
      printMessage(
        `Error importing script '${scriptSkeleton.name}': ${error.message}`,
        'error'
      );
      debugMessage(error);
    }
    if (scriptName) break;
  }
  debugMessage(`ScriptOps.importScripts: end`);
  return outcome;
}

export { getScript, deleteScript };
