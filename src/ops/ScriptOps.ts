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
import { validateScriptDecoded } from './utils/ValidationUtils';
import State from '../shared/State';

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
 * @param {string} name name of the script
 * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
 */
export async function getScriptByName({
  name,
  state,
}: {
  name: string;
  state: State;
}): Promise<ScriptSkeleton> {
  const { result } = await _getScriptByName({ scriptName: name, state });
  switch (result.length) {
    case 1:
      return result[0];
    case 0:
      throw new Error(`Script '${name}' not found`);
    default:
      throw new Error(`${result.length} scripts '${name}' found`);
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
 * @param {string} name script name
 * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
 */
export async function exportScriptByName({
  name,
  state,
}: {
  name: string;
  state: State;
}): Promise<ScriptExportInterface> {
  debugMessage(`ScriptOps.exportScriptByName: start`);
  const scriptData = await getScriptByName({ name, state });
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
    const scriptData = await getScriptByName({ name: script.name, state });
    scriptData.script = convertBase64TextToArray(scriptData.script as string);
    exportData.script[scriptData._id] = scriptData;
  }
  stopProgressIndicator(`Exported ${scriptList.length} scripts.`);
  return exportData;
}

/**
 * Import scripts
 * @param {string} name Optional name of script. If supplied, only the script of that name is imported
 * @param {ScriptExportInterface} importData Script import data
 * @param {boolean} reUuid true to generate a new uuid for each script on import, false otherwise
 * @returns {Promise<boolean>} true if no errors occurred during import, false otherwise
 */
export async function importScripts({
  name,
  importData,
  reUuid = false,
  validate = false,
  state,
}: {
  name: string;
  importData: ScriptExportInterface;
  reUuid: boolean;
  validate: boolean;
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
    if (name) {
      debugMessage(
        `ScriptOps.importScripts: Renaming script ${scriptSkeleton.name} => ${name}...`
      );
      scriptSkeleton.name = name;
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
    if (name) break;
  }
  debugMessage(`ScriptOps.importScripts: end`);
  return outcome;
}

export { getScript, deleteScript };
