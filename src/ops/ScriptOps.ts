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
  getScript as _getScript,
  getScriptByName as _getScriptByName,
  getScripts as _getScripts,
  putScript as _putScript,
  deleteScript as _deleteScript,
} from '../api/ScriptApi';
import {
  convertBase64TextToArray,
  convertTextArrayToBase64,
  getMetadata,
} from './utils/ExportImportUtils';
import { ScriptSkeleton } from '../api/ApiTypes';
import { ExportMetaData } from '../ops/OpsTypes';
import { validateScript } from './utils/ValidationUtils';

export interface ScriptExportInterface {
  meta?: ExportMetaData;
  script: Record<string, ScriptSkeleton>;
}

/**
 * Create an empty idp export template
 * @returns {ScriptExportInterface} an empty idp export template
 */
export function createScriptExportTemplate(): ScriptExportInterface {
  return {
    meta: getMetadata(),
    script: {},
  } as ScriptExportInterface;
}

/**
 * Get all scripts
 * @returns {Promise<ScriptSkeleton[]>} a promise that resolves to an array of script objects
 */
export async function getScripts(): Promise<ScriptSkeleton[]> {
  const { result } = await _getScripts();
  return result;
}

/**
 * Get script by id
 * @param {string} scriptId script uuid
 * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
 */
export async function getScript(scriptId: string): Promise<ScriptSkeleton> {
  const response = await _getScript(scriptId);
  return response;
}

/**
 * Get script by name
 * @param {string} name name of the script
 * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
 */
export async function getScriptByName(name: string): Promise<ScriptSkeleton> {
  const { result } = await _getScriptByName(name);
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
export async function putScript(
  scriptId: string,
  scriptData: ScriptSkeleton
): Promise<boolean> {
  try {
    if (Array.isArray(scriptData.script)) {
      scriptData.script = convertTextArrayToBase64(scriptData.script);
    }
    const result = await _putScript(scriptId, scriptData);
    return result;
  } catch (error) {
    if (error.response?.status === 409) {
      printMessage(
        `createOrUpdateScript WARNING: script with name ${scriptData.name} already exists, using renaming policy... <name> => <name - imported (n)>`,
        'warn'
      );
      const newName = applyNameCollisionPolicy(scriptData.name);
      scriptData.name = newName;
      const result = await putScript(scriptId, scriptData);
      printMessage(`Saved script as ${newName}`, 'warn');
      return result;
    }
    throw error;
  }
}

/**
 * Delete script by id
 * @param {string} scriptId script uuid
 * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
 */
export async function deleteScript(scriptId: string): Promise<ScriptSkeleton> {
  const response = await _deleteScript(scriptId);
  return response;
}

/**
 * Export script by id
 * @param {string} scriptId script uuid
 * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
 */
export async function exportScript(
  scriptId: string
): Promise<ScriptExportInterface> {
  debugMessage(`ScriptOps.exportScriptById: start`);
  const scriptData = await _getScript(scriptId);
  scriptData.script = convertBase64TextToArray(scriptData.script);
  const exportData = createScriptExportTemplate();
  exportData.script[scriptData._id] = scriptData;
  debugMessage(`ScriptOps.exportScriptById: end`);
  return exportData;
}

/**
 * Export script by name
 * @param {string} name script name
 * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
 */
export async function exportScriptByName(
  name: string
): Promise<ScriptExportInterface> {
  debugMessage(`ScriptOps.exportScriptByName: start`);
  const scriptData = await getScriptByName(name);
  scriptData.script = convertBase64TextToArray(scriptData.script);
  const exportData = createScriptExportTemplate();
  exportData.script[scriptData._id] = scriptData;
  debugMessage(`ScriptOps.exportScriptByName: end`);
  return exportData;
}

/**
 * Export all scripts
 * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
 */
export async function exportScripts(): Promise<ScriptExportInterface> {
  const scriptList = await getScripts();
  const exportData = createScriptExportTemplate();
  createProgressIndicator(
    scriptList.length,
    `Exporting ${scriptList.length} scripts...`
  );
  for (const script of scriptList) {
    updateProgressIndicator(`Reading script ${script.name}`);
    const scriptData = await getScriptByName(script.name);
    scriptData.script = convertBase64TextToArray(scriptData.script);
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
export async function importScripts(
  name: string,
  importData: ScriptExportInterface,
  reUuid = false,
  shouldValidateScript = false
): Promise<boolean> {
  let outcome = true;
  debugMessage(`ScriptOps.importScriptsFromFile: start`);
  createProgressIndicator(
    Object.keys(importData.script).length,
    'Importing scripts...'
  );
  for (const existingId of Object.keys(importData.script)) {
    const scriptSkeleton = importData.script[existingId];
    let newId = existingId;
    if (reUuid) {
      newId = uuidv4();
      debugMessage(
        `ScriptOps.importScriptsFromFile: Re-uuid-ing script ${scriptSkeleton.name} ${existingId} => ${newId}...`
      );
      scriptSkeleton._id = newId;
    }
    if (name) {
      debugMessage(
        `ScriptOps.importScriptsFromFile: Renaming script ${scriptSkeleton.name} => ${name}...`
      );
      scriptSkeleton.name = name;
    }
    if (shouldValidateScript) {
      if (!validateScript(scriptSkeleton)) {
        outcome = false;
        printMessage(
          `Error importing script '${scriptSkeleton.name}': Script is not valid`,
          'error'
        );
        continue;
      }
    }
    try {
      await putScript(newId, scriptSkeleton);
      updateProgressIndicator(`Imported ${scriptSkeleton.name}`);
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
  stopProgressIndicator('Done');
  debugMessage(`ScriptOps.importScriptsFromFile: end`);
  return outcome;
}
