import {
  EngineConfigurationSkeleton,
  getScriptingContext,
  getScriptingEngineConfiguration,
  getScriptType,
  getScriptTypes,
  putScriptingEngineConfiguration,
  putScriptType,
  ScriptingContextSkeleton,
  ScriptTypeSkeleton,
} from '../api/ScriptTypeApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { FrodoError } from './FrodoError';
import { ExportMetaData } from './OpsTypes';

export type ScriptType = {
  /**
   * Create an empty scriptType export template
   * @returns {ScriptTypeExportInterface} an empty scriptType export template
   */
  createScriptTypeExportTemplate(): ScriptTypeExportInterface;
  /**
   * Read scriptType by id
   * @param {string} scriptTypeId ScriptType id
   * @returns {Promise<ScriptTypeSkeleton>} a promise that resolves to a scriptType object
   */
  readScriptType(scriptTypeId: string): Promise<ScriptTypeSkeleton>;
  /**
   * Read all scriptTypes.
   * @returns {Promise<ScriptTypeSkeleton[]>} a promise that resolves to an array of scriptType objects
   */
  readScriptTypes(): Promise<ScriptTypeSkeleton[]>;
  /**
   * Export all scriptTypes. The response can be saved to file as is.
   * @returns {Promise<ScriptTypeExportInterface>} Promise resolving to a ScriptTypeExportInterface object.
   */
  exportScriptTypes(): Promise<ScriptTypeExportInterface>;
  /**
   * Update script type
   * @param {string} scriptTypeId script type id
   * @param {ScriptTypeSkeleton} scriptTypeData script type data
   * @returns {Promise<ScriptTypeSkeleton>} a promise resolving to a script type object
   */
  updateScriptType(
    scriptTypeId: string,
    scriptTypeData: ScriptTypeSkeleton
  ): Promise<ScriptTypeSkeleton>;
  /**
   * Import script types
   * @param {ScriptTypeExportInterface} importData script type import data
   * @param {string} scriptTypeId Optional script type id. If supplied, only the script type of that id is imported. Takes priority over scriptTypeUrl if both are provided.
   * @returns {Promise<ScriptTypeSkeleton[]>} the imported script types
   */
  importScriptTypes(
    importData: ScriptTypeExportInterface,
    scriptTypeId?: string
  ): Promise<ScriptTypeSkeleton[]>;
};

export default (state: State): ScriptType => {
  return {
    createScriptTypeExportTemplate(): ScriptTypeExportInterface {
      return createScriptTypeExportTemplate({ state });
    },
    async readScriptType(scriptTypeId: string): Promise<ScriptTypeSkeleton> {
      return readScriptType({ scriptTypeId, state });
    },
    async readScriptTypes(): Promise<ScriptTypeSkeleton[]> {
      return readScriptTypes({ state });
    },
    async exportScriptTypes(): Promise<ScriptTypeExportInterface> {
      return exportScriptTypes({ state });
    },
    async updateScriptType(
      scriptTypeId: string,
      scriptTypeData: ScriptTypeSkeleton
    ): Promise<ScriptTypeSkeleton> {
      return updateScriptType({ scriptTypeId, scriptTypeData, state });
    },
    async importScriptTypes(
      importData: ScriptTypeExportInterface,
      scriptTypeId?: string
    ): Promise<ScriptTypeSkeleton[]> {
      return importScriptTypes({
        scriptTypeId,
        importData,
        state,
      });
    },
  };
};

export type ScriptTypeExportSkeleton = ScriptTypeSkeleton & {
  engineConfiguration: EngineConfigurationSkeleton;
  context: ScriptingContextSkeleton;
};

export interface ScriptTypeExportInterface {
  meta?: ExportMetaData;
  scripttype: Record<string, ScriptTypeExportSkeleton>;
}

/**
 * Create an empty scriptType export template
 * @returns {ScriptTypeExportInterface} an empty scriptType export template
 */
export function createScriptTypeExportTemplate({
  state,
}: {
  state: State;
}): ScriptTypeExportInterface {
  return {
    meta: getMetadata({ state }),
    scripttype: {},
  };
}

/**
 * Read scriptType by id
 * @param {string} scriptTypeId ScriptType id
 * @returns {Promise<ScriptTypeSkeleton>} a promise that resolves to a scriptType object
 */
export async function readScriptType({
  scriptTypeId,
  state,
}: {
  scriptTypeId: string;
  state: State;
}): Promise<ScriptTypeSkeleton> {
  try {
    return getScriptType({ scriptTypeId, state });
  } catch (error) {
    throw new FrodoError(`Error reading scriptType ${scriptTypeId}`, error);
  }
}

/**
 * Read all scriptTypes.
 * @returns {Promise<ScriptTypeSkeleton[]>} a promise that resolves to an array of scriptType objects
 */
export async function readScriptTypes({
  state,
}: {
  state: State;
}): Promise<ScriptTypeSkeleton[]> {
  try {
    debugMessage({
      message: `ScriptTypeOps.readScriptTypes: start`,
      state,
    });
    const { result } = await getScriptTypes({ state });
    debugMessage({ message: `ScriptTypeOps.readScriptTypes: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading scriptTypes`, error);
  }
}

/**
 * Export all scriptTypes. The response can be saved to file as is.
 * @returns {Promise<ScriptTypeExportInterface>} Promise resolving to a ScriptTypeExportInterface object.
 */
export async function exportScriptTypes({
  state,
}: {
  state: State;
}): Promise<ScriptTypeExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `ScriptTypeOps.exportScriptTypes: start`, state });
    const exportData = createScriptTypeExportTemplate({ state });
    const scriptTypes = await readScriptTypes({ state });
    indicatorId = createProgressIndicator({
      total: scriptTypes.length,
      message: 'Exporting scriptTypes...',
      state,
    });
    for (const scriptType of scriptTypes) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting scriptType ${scriptType._id}`,
        state,
      });
      try {
        scriptType.engineConfiguration = await getScriptingEngineConfiguration({
          scriptTypeId: scriptType._id,
          state,
        });
      } catch (e) {
        if (e.httpStatus === 404 || e.response?.status === 404) {
          //Ignore this case since not all script types have engine configurations
        } else {
          printMessage({
            message: `Unable to get engine configuration for script type '${scriptType._id}': ${e.message}`,
            type: 'error',
            state,
          });
        }
      }
      try {
        scriptType.context = await getScriptingContext({
          scriptTypeId: scriptType._id,
          state,
        });
      } catch (e) {
        printMessage({
          message: `Unable to get context for script type '${scriptType._id}': ${e.message}`,
          type: 'error',
          state,
        });
      }
      exportData.scripttype[scriptType._id] =
        scriptType as ScriptTypeExportSkeleton;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${scriptTypes.length} scriptTypes.`,
      state,
    });
    debugMessage({ message: `ScriptTypeOps.exportScriptTypes: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting scriptTypes.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error reading scriptTypes`, error);
  }
}

/**
 * Update script type
 * @param {string} scriptTypeId script type id
 * @param {ScriptTypeSkeleton} scriptTypeData script type config object
 * @returns {Promise<ScriptTypeSkeleton>} a promise that resolves to a script type object
 */
export async function updateScriptType({
  scriptTypeId,
  scriptTypeData,
  state,
}: {
  scriptTypeId: string;
  scriptTypeData: ScriptTypeSkeleton;
  state: State;
}): Promise<ScriptTypeSkeleton> {
  return putScriptType({ scriptTypeId, scriptTypeData, state });
}

/**
 * Import script types
 * @param {string} scriptTypeId Optional script type id. If supplied, only the script type of that id is imported. Takes priority over scriptTypeUrl if both are provided.
 * @param {ScriptTypeExportInterface} importData script type import data
 * @returns {Promise<ScriptTypeExportSkeleton[]>} the imported script types
 */
export async function importScriptTypes({
  scriptTypeId,
  importData,
  state,
}: {
  scriptTypeId?: string;
  importData: ScriptTypeExportInterface;
  state: State;
}): Promise<ScriptTypeExportSkeleton[]> {
  const errors = [];
  try {
    debugMessage({ message: `ScriptTypeOps.importScriptTypes: start`, state });
    const response = [];
    for (const scriptType of Object.values(importData.scripttype)) {
      try {
        if (scriptTypeId && scriptType._id !== scriptTypeId) {
          continue;
        }
        const context = scriptType.context;
        let engineConfiguration;
        if (scriptType.engineConfiguration) {
          engineConfiguration = await putScriptingEngineConfiguration({
            scriptTypeId: scriptType._id,
            engineConfigurationData: scriptType.engineConfiguration,
            state,
          });
        }
        delete scriptType.context;
        delete scriptType.engineConfiguration;
        const result = (await updateScriptType({
          scriptTypeId: scriptType._id,
          scriptTypeData: scriptType,
          state,
        })) as ScriptTypeExportSkeleton;
        result.context = context;
        result.engineConfiguration = engineConfiguration;
        response.push(result);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing script types`, errors);
    }
    debugMessage({ message: `ScriptTypeOps.importScriptTypes: end`, state });
    return response;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing script types`, error);
  }
}
