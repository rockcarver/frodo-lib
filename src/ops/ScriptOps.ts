import { v4 as uuidv4 } from 'uuid';

import {
  deleteScript as _deleteScript,
  deleteScriptByName as _deleteScriptByName,
  deleteScripts as _deleteScripts,
  getScript as _getScript,
  getScriptByName as _getScriptByName,
  getScripts as _getScripts,
  putScript as _putScript,
  type ScriptSkeleton,
} from '../api/ScriptApi';
import { type ExportMetaData } from '../ops/OpsTypes';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
  verboseMessage,
} from '../utils/Console';
import {
  convertBase64TextToArray,
  convertTextArrayToBase64,
  getMetadata,
} from '../utils/ExportImportUtils';
import { applyNameCollisionPolicy } from '../utils/ForgeRockUtils';
import { isScriptValid } from '../utils/ScriptValidationUtils';

export type Script = {
  /**
   * Create an empty script export template
   * @returns {ScriptExportInterface} an empty script export template
   */
  createScriptExportTemplate(): ScriptExportInterface;
  /**
   * Read all scripts
   * @returns {Promise<ScriptSkeleton[]>} a promise that resolves to an array of script objects
   */
  readScripts(): Promise<ScriptSkeleton[]>;
  /**
   * Read script
   * @param {string} scriptId script id
   * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
   */
  readScript(scriptId: string): Promise<ScriptSkeleton>;
  /**
   * Read script by name
   * @param {string} scriptName name of the script
   * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
   */
  readScriptByName(scriptName: string): Promise<ScriptSkeleton>;
  /**
   * Create script
   * @param {string} scriptId script id
   * @param {string} scriptName name of the script
   * @param {ScriptSkeleton} scriptData script object
   * @returns {Promise<ScriptSkeleton>} a status object
   */
  createScript(
    scriptId: string,
    scriptName: string,
    scriptData: ScriptSkeleton
  ): Promise<ScriptSkeleton>;
  /**
   * Create or update script
   * @param {string} scriptId script id
   * @param {ScriptSkeleton} scriptData script object
   * @returns {Promise<ScriptSkeleton>} a status object
   */
  updateScript(
    scriptId: string,
    scriptData: ScriptSkeleton
  ): Promise<ScriptSkeleton>;
  /**
   * Delete script
   * @param {string} scriptId script id
   * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
   */
  deleteScript(scriptId: string): Promise<ScriptSkeleton>;
  /**
   * Delete script by name
   * @param {String} scriptId script name
   * @returns {Promise<ScriptSkeleton>} a promise that resolves to a script object
   */
  deleteScriptByName(scriptName: string): Promise<ScriptSkeleton>;
  /**
   * Delete all non-default scripts
   * @returns {Promise<ScriptSkeleton[]>>} a promise that resolves to an array of script objects
   */
  deleteScripts(): Promise<ScriptSkeleton[]>;
  /**
   * Export all scripts
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  exportScripts(): Promise<ScriptExportInterface>;
  /**
   * Export script by id
   * @param {string} scriptId script uuid
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  exportScript(scriptId: string): Promise<ScriptExportInterface>;
  /**
   * Export script by name
   * @param {string} scriptName script name
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  exportScriptByName(scriptName: string): Promise<ScriptExportInterface>;
  /**
   * Import scripts
   * @param {string} scriptName Optional name of script. If supplied, only the script of that name is imported
   * @param {ScriptExportInterface} importData Script import data
   * @param {boolean} reUuid true to generate a new uuid for each script on import, false otherwise
   * @returns {Promise<ScriptSkeleton[]>} true if no errors occurred during import, false otherwise
   */
  importScripts(
    scriptName: string,
    importData: ScriptExportInterface,
    reUuid?: boolean,
    validate?: boolean
  ): Promise<ScriptSkeleton[]>;

  // Deprecated

  /**
   * Get all scripts
   * @returns {Promise<ScriptSkeleton[]>} a promise that resolves to an array of script objects
   * @deprecated since v2.0.0 use {@link Script.readScripts | readScripts} instead
   * ```javascript
   * readScripts(): Promise<ScriptSkeleton[]>
   * ```
   * @group Deprecated
   */
  getScripts(): Promise<ScriptSkeleton[]>;
  /**
   * Get script
   * @param {string} scriptId script id
   * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
   * @deprecated since v2.0.0 use {@link Script.readScript | readScript} instead
   * ```javascript
   * readScript(scriptName: string): Promise<ScriptSkeleton>
   * ```
   * @group Deprecated
   */
  getScript(scriptId: string): Promise<ScriptSkeleton>;
  /**
   * Get script by name
   * @param {string} scriptName name of the script
   * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
   * @deprecated since v2.0.0 use {@link Script.readScriptByName | readScriptByName} instead
   * ```javascript
   * readScriptByName(scriptName: string): Promise<ScriptSkeleton>
   * ```
   * @group Deprecated
   */
  getScriptByName(scriptName: string): Promise<ScriptSkeleton>;
  /**
   * Create or update script
   * @param {string} scriptId script uuid
   * @param {ScriptSkeleton} scriptData script object
   * @returns {Promise<ScriptSkeleton>} a status object
   * @deprecated since v2.0.0 use {@link Script.updateScript | updateScript} or {@link Script.createScript | createScript} instead
   * ```javascript
   * updateScript(scriptId: string, scriptData: ScriptSkeleton): Promise<ScriptSkeleton>
   * createScript(scriptId: string, scriptName: string, scriptData: ScriptSkeleton): Promise<ScriptSkeleton>
   * ```
   * @group Deprecated
   */
  putScript(
    scriptId: string,
    scriptData: ScriptSkeleton
  ): Promise<ScriptSkeleton>;
};

export default (state: State): Script => {
  return {
    createScriptExportTemplate(): ScriptExportInterface {
      return createScriptExportTemplate({ state });
    },
    async readScripts(): Promise<ScriptSkeleton[]> {
      return readScripts({ state });
    },
    async readScript(scriptId: string): Promise<ScriptSkeleton> {
      return readScript({ scriptId, state });
    },
    async readScriptByName(scriptName: string): Promise<ScriptSkeleton> {
      return readScriptByName({ scriptName, state });
    },
    async createScript(
      scriptId: string,
      scriptName: string,
      scriptData: ScriptSkeleton
    ): Promise<ScriptSkeleton> {
      return createScript({ scriptId, scriptName, scriptData, state });
    },
    async updateScript(
      scriptId: string,
      scriptData: ScriptSkeleton
    ): Promise<ScriptSkeleton> {
      return updateScript({ scriptId, scriptData, state });
    },
    async deleteScript(scriptId: string): Promise<ScriptSkeleton> {
      return deleteScript({ scriptId, state });
    },
    async deleteScriptByName(scriptName: string): Promise<ScriptSkeleton> {
      return deleteScriptByName({ scriptName, state });
    },
    async deleteScripts(): Promise<ScriptSkeleton[]> {
      return deleteScripts({ state });
    },
    async exportScript(scriptId: string): Promise<ScriptExportInterface> {
      return exportScript({ scriptId, state });
    },
    async exportScriptByName(
      scriptName: string
    ): Promise<ScriptExportInterface> {
      return exportScriptByName({ scriptName, state });
    },
    async exportScripts(): Promise<ScriptExportInterface> {
      return exportScripts({ state });
    },
    async importScripts(
      scriptName: string,
      importData: ScriptExportInterface,
      reUuid = false,
      validate = false
    ): Promise<ScriptSkeleton[]> {
      return importScripts({
        scriptName,
        importData,
        reUuid,
        validate,
        state,
      });
    },

    // Deprecated

    async getScripts(): Promise<ScriptSkeleton[]> {
      return readScripts({ state });
    },
    async getScript(scriptId: string): Promise<ScriptSkeleton> {
      return readScript({ scriptId, state });
    },
    async getScriptByName(scriptName: string): Promise<ScriptSkeleton> {
      return readScriptByName({ scriptName, state });
    },
    async putScript(
      scriptId: string,
      scriptData: ScriptSkeleton
    ): Promise<ScriptSkeleton> {
      return updateScript({ scriptId, scriptData, state });
    },
  };
};

export interface ScriptExportInterface {
  meta?: ExportMetaData;
  script: Record<string, ScriptSkeleton>;
}

/**
 * Create an empty script export template
 * @returns {ScriptExportInterface} an empty script export template
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
export async function readScripts({
  state,
}: {
  state: State;
}): Promise<ScriptSkeleton[]> {
  const { result } = await _getScripts({ state });
  return result;
}

/**
 * Get script
 * @returns {Promise<ScriptSkeleto]>} a promise that resolves to an array of script objects
 */
export async function readScript({
  scriptId,
  state,
}: {
  scriptId: string;
  state: State;
}): Promise<ScriptSkeleton> {
  return _getScript({ scriptId, state });
}

/**
 * Get script by name
 * @param {string} scriptName name of the script
 * @returns {Promise<ScriptSkeleton>} promise that resolves to a script object
 */
export async function readScriptByName({
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
 * Create script
 * @param {ScriptSkeleton} scriptData script object
 * @returns {Promise<ScriptSkeleton>} a promise resolving to a script object
 */
export async function createScript({
  scriptId,
  scriptName,
  scriptData,
  state,
}: {
  scriptId: string;
  scriptName: string;
  scriptData: ScriptSkeleton;
  state: State;
}): Promise<ScriptSkeleton> {
  debugMessage({ message: `ScriptOps.createOAuth2Client: start`, state });
  scriptData._id = scriptId;
  scriptData.name = scriptName;
  try {
    await _getScript({ scriptId, state });
  } catch (error) {
    const result = await updateScript({
      scriptId,
      scriptData,
      state,
    });
    debugMessage({ message: `ScriptOps.createOAuth2Client: end`, state });
    return result;
  }
  throw new Error(`Script ${scriptData._id} already exists!`);
}

/**
 * Create or update script
 * @param {string} scriptId script uuid
 * @param {ScriptSkeleton} scriptData script object
 * @returns {Promise<ScriptSkeleton>} a status object
 */
export async function updateScript({
  scriptId,
  scriptData,
  state,
}: {
  scriptId: string;
  scriptData: ScriptSkeleton;
  state: State;
}): Promise<ScriptSkeleton> {
  let result = null;
  try {
    if (Array.isArray(scriptData.script)) {
      scriptData.script = convertTextArrayToBase64(scriptData.script);
    }
    result = await _putScript({ scriptId, scriptData, state });
  } catch (error) {
    if (error.response?.status === 409) {
      verboseMessage({
        message: `createOrUpdateScript WARNING: script with name ${scriptData.name} already exists, using renaming policy... <name> => <name - imported (n)>`,
        state,
      });
      const newName = applyNameCollisionPolicy(scriptData.name);
      scriptData.name = newName;
      result = await updateScript({ scriptId, scriptData, state });
      verboseMessage({
        message: `Saved script as ${newName}`,
        state,
      });
    } else throw error;
  }
  return result;
}

/**
 * Delete script
 * @param {string} scriptId script uuid
 * @returns {Promise<ScriptSkeleton>} a promise resolving to a script object
 */
export async function deleteScript({
  scriptId,
  state,
}: {
  scriptId: string;
  state: State;
}): Promise<ScriptSkeleton> {
  return _deleteScript({ scriptId, state });
}

/**
 * Delete script by name
 * @param {String} scriptId script name
 * @returns {Promise<ScriptSkeleton>} a promise that resolves to a script object
 */
export async function deleteScriptByName({
  scriptName,
  state,
}: {
  scriptName: string;
  state: State;
}): Promise<ScriptSkeleton> {
  return _deleteScriptByName({ scriptName, state });
}

/**
 * Delete all non-default scripts
 * @returns {Promise<ScriptSkeleton[]>>} a promise that resolves to an array of script objects
 */
export async function deleteScripts({
  state,
}: {
  state: State;
}): Promise<ScriptSkeleton[]> {
  return _deleteScripts({ state });
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
  const scriptData = await _getScript({ scriptId, state });
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
  const scriptData = await readScriptByName({ scriptName, state });
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
  const scriptList = await readScripts({ state });
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
    const scriptData = await readScriptByName({
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
}): Promise<ScriptSkeleton[]> {
  debugMessage({ message: `ScriptOps.importScripts: start`, state });
  const response = [];
  const errors = [];
  const imported = [];
  for (const existingId of Object.keys(importData.script)) {
    try {
      const scriptData = importData.script[existingId];
      let newId = existingId;
      if (reUuid) {
        newId = uuidv4();
        debugMessage({
          message: `ScriptOps.importScripts: Re-uuid-ing script ${scriptData.name} ${existingId} => ${newId}...`,
          state,
        });
        scriptData._id = newId;
      }
      if (scriptName) {
        debugMessage({
          message: `ScriptOps.importScripts: Renaming script ${scriptData.name} => ${scriptName}...`,
          state,
        });
        scriptData.name = scriptName;
      }
      if (validate) {
        if (!isScriptValid({ scriptData, state })) {
          {
            const message = `Error importing script '${scriptData.name}': Script is not valid`;
            printMessage({
              message,
              type: 'error',
              state,
            });
            throw new Error(message);
          }
        }
      }
      try {
        await updateScript({
          scriptId: newId,
          scriptData,
          state,
        });
        imported.push(newId);
      } catch (error) {
        errors.push(error);
      }
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
      .join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo scripts found in import data!`);
  }
  debugMessage({ message: `ScriptOps.importScripts: end`, state });
  return response;
}
