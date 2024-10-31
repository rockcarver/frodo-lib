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
import { decode, encode, isBase64Encoded } from '../utils/Base64Utils';
import {
  createProgressIndicator,
  debugMessage,
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
import { FrodoError } from './FrodoError';

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
   * Get the names of library scripts required by the input script object
   *
   * @param {ScriptSkeleton} scriptObj the script object
   * @returns an array of required library script names
   */
  getLibraryScriptNames(scriptObj: ScriptSkeleton): string[];
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
   * @param {String} scriptName script name
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
   * @param {ScriptExportOptions} options script export options
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  exportScripts(options?: ScriptExportOptions): Promise<ScriptExportInterface>;
  /**
   * Export script by id
   * @param {string} scriptId script uuid
   * @param {ScriptExportOptions} options script export options
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  exportScript(
    scriptId: string,
    options?: ScriptExportOptions
  ): Promise<ScriptExportInterface>;
  /**
   * Export script by name
   * @param {string} scriptName script name
   * @param {ScriptExportOptions} options script export options
   * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
   */
  exportScriptByName(
    scriptName: string,
    options?: ScriptExportOptions
  ): Promise<ScriptExportInterface>;
  /**
   * Import scripts
   * @param {string} scriptId Optional id of script. If supplied, only the script of that id is imported. Takes priority over scriptName if both are provided.
   * @param {string} scriptName Optional name of script. If supplied, only the script of that name is imported
   * @param {ScriptExportInterface} importData Script import data
   * @param {ScriptImportOptions} options Script import options
   * @param {boolean} validate If true, validates Javascript scripts to ensure no errors exist in them. Default: false
   * @returns {Promise<ScriptSkeleton[]>} the imported scripts
   */
  importScripts(
    scriptId: string,
    scriptName: string,
    importData: ScriptExportInterface,
    options?: ScriptImportOptions,
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
    getLibraryScriptNames(scriptObj: ScriptSkeleton): string[] {
      return getLibraryScriptNames(scriptObj);
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
    async exportScript(
      scriptId: string,
      options: ScriptExportOptions = {
        deps: true,
        includeDefault: true,
        useStringArrays: true,
      }
    ): Promise<ScriptExportInterface> {
      return exportScript({ scriptId, options, state });
    },
    async exportScriptByName(
      scriptName: string,
      options: ScriptExportOptions = {
        deps: true,
        includeDefault: true,
        useStringArrays: true,
      }
    ): Promise<ScriptExportInterface> {
      return exportScriptByName({ scriptName, options, state });
    },
    async exportScripts(
      options: ScriptExportOptions = {
        deps: true,
        includeDefault: false,
        useStringArrays: true,
      }
    ): Promise<ScriptExportInterface> {
      return exportScripts({ options, state });
    },
    async importScripts(
      scriptId: string,
      scriptName: string,
      importData: ScriptExportInterface,
      options = {
        deps: true,
        reUuid: false,
        includeDefault: false,
      },
      validate = false
    ): Promise<ScriptSkeleton[]> {
      return importScripts({
        scriptId,
        scriptName,
        importData,
        options,
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
 * Script import options
 */
export interface ScriptImportOptions {
  /**
   * Include dependency (library) scripts in export
   */
  deps: boolean;
  /**
   * Generate new UUIDs for all scripts during import.
   */
  reUuid: boolean;
  /**
   * Include default scripts in import if true
   */
  includeDefault: boolean;
}

/**
 * Script export options
 */
export interface ScriptExportOptions {
  /**
   * Include dependency (library) scripts in export
   */
  deps: boolean;
  /**
   * Include default scripts in export if true
   */
  includeDefault: boolean;
  /**
   * Use string arrays to store script code
   */
  useStringArrays: boolean;
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
  try {
    const { result } = await _getScripts({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading scripts`, error);
  }
}

/**
 * Get the names of library scripts required by the input script object
 *
 * @param {ScriptSkeleton} scriptObj the script object
 * @returns {string[]} an array of required library script names
 */
export function getLibraryScriptNames(scriptObj: ScriptSkeleton): string[] {
  const script = Array.isArray(scriptObj.script)
    ? scriptObj.script.join('\n')
    : decode(scriptObj.script as string);
  const regex = /require\(['|"](.+?)['|"]\)/g;
  const matches = [...script.matchAll(regex)];
  return matches.map((m) => String(m[1]));
}

/**
 * Gets all library scripts for a given script recursively
 *
 * @param {ScriptSkeleton} scriptData the script object
 * @returns {ScriptSkeleton[]} all the library scripts needed for the given script
 */
export async function getLibraryScripts({
  scriptData,
  state,
}: {
  scriptData: ScriptSkeleton;
  state: State;
}): Promise<ScriptSkeleton[]> {
  const scripts = await getLibraryScriptsRecurse({
    scriptData,
    scripts: {},
    state,
  });
  return Object.values(scripts);
}

/**
 * Recursive helper method for getting library scripts
 *
 * @param {ScriptSkeleton} scriptData the script object
 */
async function getLibraryScriptsRecurse({
  scriptData,
  scripts = {},
  state,
}: {
  scriptData: ScriptSkeleton;
  scripts: Record<string, ScriptSkeleton>;
  state: State;
}): Promise<Record<string, ScriptSkeleton>> {
  const scriptNames = getLibraryScriptNames(scriptData);
  const scriptObjs = await Promise.all(
    scriptNames
      // Filter is necessary here to prevent infinite recursion if there is a circular dependency
      .filter((scriptName) => !(scriptName in scripts))
      .map((scriptName) => readScriptByName({ scriptName, state }))
  );
  for (const scriptObj of scriptObjs) {
    scripts[scriptObj.name] = scriptObj;
  }
  for (const scriptObj of scriptObjs) {
    await getLibraryScriptsRecurse({
      scriptData: scriptObj,
      scripts,
      state,
    });
  }
  return scripts;
}

/**
 * Get script
 *
 * @param {string} scriptId the script id
 * @returns {Promise<ScriptSkeleton>} a promise that resolves to an array of script objects
 */
export async function readScript({
  scriptId,
  state,
}: {
  scriptId: string;
  state: State;
}): Promise<ScriptSkeleton> {
  try {
    return await _getScript({ scriptId, state });
  } catch (error) {
    throw new FrodoError(`Error reading script ${scriptId}`, error);
  }
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
  try {
    const { result } = await _getScriptByName({ scriptName, state });
    switch (result.length) {
      case 1:
        return result[0];
      case 0:
        throw new FrodoError(`Script '${scriptName}' not found`);
      default:
        throw new FrodoError(`${result.length} scripts '${scriptName}' found`);
    }
  } catch (error) {
    throw new FrodoError(`Error reading script ${scriptName}`, error);
  }
}

/**
 * Create script
 * @param {string} scriptId the script id
 * @param {string} scriptName the script name
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
    try {
      const result = await updateScript({
        scriptId,
        scriptData,
        state,
      });
      debugMessage({ message: `ScriptOps.createOAuth2Client: end`, state });
      return result;
    } catch (error) {
      throw new FrodoError(`Error creating script`, error);
    }
  }
  throw new FrodoError(`Script ${scriptData._id} already exists!`);
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
    } else if (!isBase64Encoded(scriptData.script)) {
      scriptData.script = encode(scriptData.script);
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
    } else throw new FrodoError(`Error updating script`, error);
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
  try {
    return _deleteScript({ scriptId, state });
  } catch (error) {
    throw new FrodoError(`Error deleting script ${scriptId}`, error);
  }
}

/**
 * Delete script by name
 * @param {String} scriptName script name
 * @returns {Promise<ScriptSkeleton>} a promise that resolves to a script object
 */
export async function deleteScriptByName({
  scriptName,
  state,
}: {
  scriptName: string;
  state: State;
}): Promise<ScriptSkeleton> {
  try {
    return _deleteScriptByName({ scriptName, state });
  } catch (error) {
    throw new FrodoError(`Error deleting script ${scriptName}`, error);
  }
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
  try {
    return _deleteScripts({ state });
  } catch (error) {
    throw new FrodoError(`Error deleting scripts`, error);
  }
}

/**
 * Export script by id
 *
 * @param {string} scriptId script uuid
 * @param {ScriptExportOptions} options script export options
 * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
 */
export async function exportScript({
  scriptId,
  options = {
    deps: true,
    includeDefault: true,
    useStringArrays: true,
  },
  state,
}: {
  scriptId: string;
  options?: ScriptExportOptions;
  state: State;
}): Promise<ScriptExportInterface> {
  try {
    debugMessage({ message: `ScriptOps.exportScriptById: start`, state });
    const scriptData = await readScript({ scriptId, state });
    const exportData = prepareScriptExport({ scriptData, options, state });
    debugMessage({ message: `ScriptOps.exportScriptById: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting script ${scriptId}`, error);
  }
}

/**
 * Export script by name
 *
 * @param {string} scriptName script name
 * @param {ScriptExportOptions} options script export options
 * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
 */
export async function exportScriptByName({
  scriptName,
  options = {
    deps: true,
    includeDefault: true,
    useStringArrays: true,
  },
  state,
}: {
  scriptName: string;
  options?: ScriptExportOptions;
  state: State;
}): Promise<ScriptExportInterface> {
  try {
    debugMessage({ message: `ScriptOps.exportScriptByName: start`, state });
    const scriptData = await readScriptByName({ scriptName, state });
    const exportData = prepareScriptExport({ scriptData, options, state });
    debugMessage({ message: `ScriptOps.exportScriptByName: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting script ${scriptName}`, error);
  }
}

/**
 * Export all scripts
 *
 * @param {ScriptExportOptions} options script export options
 * @returns {Promise<ScriptExportInterface>} a promise that resolved to a ScriptExportInterface object
 */
export async function exportScripts({
  options = {
    deps: true,
    includeDefault: false,
    useStringArrays: true,
  },
  state,
}: {
  options?: ScriptExportOptions;
  state: State;
}): Promise<ScriptExportInterface> {
  const errors: Error[] = [];
  let indicatorId: string;
  try {
    const { includeDefault, useStringArrays } = options;
    let scriptList = await readScripts({ state });
    if (!includeDefault)
      scriptList = scriptList.filter((script) => !script.default);
    const exportData = createScriptExportTemplate({ state });
    indicatorId = createProgressIndicator({
      total: scriptList.length,
      message: `Exporting ${scriptList.length} scripts...`,
      state,
    });
    for (const scriptData of scriptList) {
      try {
        updateProgressIndicator({
          id: indicatorId,
          message: `Reading script ${scriptData.name}`,
          state,
        });
        exportData.script[scriptData._id] = prepareScriptForExport({
          scriptData,
          useStringArrays,
        });
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(``, errors);
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${scriptList.length} scripts.`,
      state,
    });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting scripts`,
      status: 'fail',
      state,
    });
    // re-throw previously caught error
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error exporting scripts`, error);
  }
}

/**
 * Import scripts
 * @param {string} scriptId Optional id of script. If supplied, only the script of that id is imported. Takes priority over scriptName if both are provided.
 * @param {string} scriptName Optional name of script. If supplied, only the script of that name is imported
 * @param {ScriptExportInterface} importData Script import data
 * @param {ScriptImportOptions} options Script import options
 * @param {boolean} validate If true, validates Javascript scripts to ensure no errors exist in them. Default: false
 * @returns {Promise<ScriptSkeleton[]>} the imported scripts
 */
export async function importScripts({
  scriptId,
  scriptName,
  importData,
  options = {
    deps: true,
    reUuid: false,
    includeDefault: false,
  },
  validate = false,
  state,
}: {
  scriptId?: string;
  scriptName?: string;
  importData: ScriptExportInterface;
  options?: ScriptImportOptions;
  validate?: boolean;
  state: State;
}): Promise<ScriptSkeleton[]> {
  const errors = [];
  try {
    debugMessage({ message: `ScriptOps.importScripts: start`, state });
    const response = [];
    for (const existingId of Object.keys(importData.script)) {
      try {
        const scriptData = importData.script[existingId];
        const isDefault = !options.includeDefault && scriptData.default;
        // Only import script if the scriptName matches the current script. Note this only applies if we are not importing dependencies since if there are dependencies then we want to import all the scripts in the file.
        const shouldNotImportScript =
          !options.deps &&
          ((scriptId && scriptId !== scriptData._id) ||
            (!scriptId && scriptName && scriptName !== scriptData.name));
        if (isDefault || shouldNotImportScript) continue;
        let newId = existingId;
        if (options.reUuid) {
          newId = uuidv4();
          debugMessage({
            message: `ScriptOps.importScripts: Re-uuid-ing script ${scriptData.name} ${existingId} => ${newId}...`,
            state,
          });
          scriptData._id = newId;
        }
        if (validate) {
          if (!isScriptValid({ scriptData, state })) {
            errors.push(
              new FrodoError(
                `Error importing script '${scriptData.name}': Script is not valid`
              )
            );
          }
        }
        const result = await updateScript({
          scriptId: newId,
          scriptData,
          state,
        });
        response.push(result);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing scripts`, errors);
    }
    debugMessage({ message: `ScriptOps.importScripts: end`, state });
    return response;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing scripts`, error);
  }
}

/**
 * Helper to export a single script (along with any library scripts if applicable)
 *
 * @param {ScriptSkeleton} scriptData The script data to export
 * @param {ScriptExportOptions} options script export options
 * @returns {Promise<ScriptExportInterface>} the script export
 */
async function prepareScriptExport({
  scriptData,
  options = {
    deps: true,
    includeDefault: true,
    useStringArrays: true,
  },
  state,
}: {
  scriptData: ScriptSkeleton;
  options?: ScriptExportOptions;
  state: State;
}): Promise<ScriptExportInterface> {
  const { deps, useStringArrays } = options;
  const exportData = createScriptExportTemplate({ state });
  exportData.script[scriptData._id] = prepareScriptForExport({
    scriptData,
    useStringArrays,
  });
  // handle library scripts
  if (deps) {
    for (const script of await getLibraryScripts({ scriptData, state })) {
      exportData.script[script._id] = prepareScriptForExport({
        scriptData: script,
        useStringArrays,
      });
    }
  }
  return exportData;
}

/**
 * Helper to prepare a single script for export
 *
 * @param {ScriptSkeleton} scriptData the script data to prepare for export
 * @param {ScriptExportOptions} options script export options
 * @returns {ScriptSkeleton} the prepared script data
 */
function prepareScriptForExport({
  scriptData,
  useStringArrays,
}: {
  scriptData: ScriptSkeleton;
  useStringArrays: boolean;
}): ScriptSkeleton {
  scriptData.script = convertBase64TextToArray(scriptData.script as string);
  if (!useStringArrays) {
    scriptData.script = scriptData.script.join('\n');
  }
  return scriptData;
}
