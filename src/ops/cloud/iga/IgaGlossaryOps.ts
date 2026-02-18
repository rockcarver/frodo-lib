import {
  createGlossarySchema as _createGlossarySchema,
  deleteGlossarySchema as _deleteGlossarySchema,
  getGlossarySchema,
  GlossaryObjectType,
  GlossarySchemaItemSkeleton,
  putGlossarySchema,
  searchGlossarySchemas,
} from '../../../api/cloud/iga/IgaGlossaryApi';
import { State } from '../../../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../../../utils/Console';
import { getMetadata, getResult } from '../../../utils/ExportImportUtils';
import { FrodoError } from '../../FrodoError';
import { ExportMetaData, ResultCallback } from '../../OpsTypes';

export type Glossary = {
  /**
   * Create glossary schema
   * @param {GlossarySchemaItemSkeleton} glossarySchemaData the glossary schema object
   * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
   */
  createGlossarySchema(
    glossarySchemaData: GlossarySchemaItemSkeleton<any>
  ): Promise<GlossarySchemaItemSkeleton<any>>;
  /**
   * Read glossary schema
   * @param {string} glossaryId the glossary schema id
   * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
   */
  readGlossarySchema(
    glossaryId: string
  ): Promise<GlossarySchemaItemSkeleton<any>>;
  /**
   * Read glossary schema by its name and object type
   * @param {string} glossaryName the glossary schema name
   * @param {GlossaryObjectType} objectType the glossary schema object type
   * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
   */
  readGlossarySchemaByNameAndObjectType(
    glossaryName: string,
    objectType: GlossaryObjectType
  ): Promise<GlossarySchemaItemSkeleton<any>>;
  /**
   * Read all glossary schemas
   * @returns {Promise<GlossarySchemaItemSkeleton[]>} a promise that resolves to an array of glossary schema objects
   */
  readGlossarySchemas(): Promise<GlossarySchemaItemSkeleton<any>[]>;
  /**
   * Export glossary schema
   * @param {string} glossaryId the glossary schema id
   * @returns {Promise<GlossarySchemaExportInterface>} a promise that resolves to a glossary schema export object
   */
  exportGlossarySchema(
    glossaryId: string
  ): Promise<GlossarySchemaExportInterface>;
  /**
   * Export glossary schema by its name and object type
   * @param {string} glossaryName the glossary schema name
   * @param {GlossaryObjectType} objectType the glossary schema object type
   * @returns {Promise<GlossarySchemaExportInterface>} a promise that resolves to a glossary schema export object
   */
  exportGlossarySchemaByNameAndObjectType(
    glossaryName: string,
    objectType: GlossaryObjectType
  ): Promise<GlossarySchemaExportInterface>;
  /**
   * Export all glossary schemas
   * @param {GlossarySchemaExportOptions} options export options
   * @returns {Promise<GlossarySchemaExportInterface>} a promise that resolves to a glossary schema export object
   */
  exportGlossarySchemas(
    options?: GlossarySchemaExportOptions
  ): Promise<GlossarySchemaExportInterface>;
  /**
   * Update glossary schema
   * @param {string} glossaryId the glossary schema id
   * @param {GlossarySchemaItemSkeleton} glossarySchemaData the glossary schema object
   * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
   */
  updateGlossarySchema(
    glossaryId: string,
    glossarySchemaData: GlossarySchemaItemSkeleton<any>
  ): Promise<GlossarySchemaItemSkeleton<any>>;
  /**
   * Import glossary schemas
   * @param {string} glossaryId The glossary schema id.  If supplied, only the glossary schema of that id is imported. Takes priority over glossaryName/objectType if they are all provided.
   * @param {string} glossaryName The glossary schema name. If supplied along with the objectType, only the glossary schema of that name/objectType is imported.
   * @param {GlossaryObjectType} objectType the glossary schema object type
   * @param {GlossarySchemaExportInterface} importData glossary schema import data
   * @param {GlossarySchemaImportOptions} options import options
   * @param {ResultCallback<GlossarySchemaItemSkeleton>} resultCallback Optional callback to process individual results
   * @returns {Promise<GlossarySchemaItemSkeleton[]>} the imported glossary schemas
   */
  importGlossarySchemas(
    importData: GlossarySchemaExportInterface,
    glossaryId?: string,
    glossaryName?: string,
    objectType?: GlossaryObjectType,
    options?: GlossarySchemaImportOptions,
    resultCallback?: ResultCallback<GlossarySchemaItemSkeleton<any>>
  ): Promise<GlossarySchemaItemSkeleton<any>[]>;
  /**
   * Delete glossary schema
   * @param {string} glossaryId the glossary schema id
   * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
   */
  deleteGlossarySchema(
    glossaryId: string
  ): Promise<GlossarySchemaItemSkeleton<any>>;
  /**
   * Delete glossary schema by its name and object type
   * @param {string} glossaryName the glossary schema name
   * @param {GlossaryObjectType} objectType the glossary schema object type
   * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
   */
  deleteGlossarySchemaByNameAndObjectType(
    glossaryName: string,
    objectType: GlossaryObjectType
  ): Promise<GlossarySchemaItemSkeleton<any>>;
  /**
   * Delete glossary schemas
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<GlossarySchemaItemSkeleton[]>} promise that resolves to an array of glossary schema objects
   */
  deleteGlossarySchemas(
    resultCallback?: ResultCallback<GlossarySchemaItemSkeleton<any>>
  ): Promise<GlossarySchemaItemSkeleton<any>[]>;
};

export default (state: State): Glossary => {
  return {
    createGlossarySchema(
      glossarySchemaData: GlossarySchemaItemSkeleton<any>
    ): Promise<GlossarySchemaItemSkeleton<any>> {
      return createGlossarySchema({ glossarySchemaData, state });
    },
    readGlossarySchema(
      glossaryId: string
    ): Promise<GlossarySchemaItemSkeleton<any>> {
      return readGlossarySchema({
        glossaryId,
        state,
      });
    },
    readGlossarySchemaByNameAndObjectType(
      glossaryName: string,
      objectType: GlossaryObjectType
    ): Promise<GlossarySchemaItemSkeleton<any>> {
      return readGlossarySchemaByNameAndObjectType({
        glossaryName,
        objectType,
        state,
      });
    },
    readGlossarySchemas(): Promise<GlossarySchemaItemSkeleton<any>[]> {
      return readGlossarySchemas({
        state,
      });
    },
    exportGlossarySchema(
      glossaryId: string
    ): Promise<GlossarySchemaExportInterface> {
      return exportGlossarySchema({
        glossaryId,
        state,
      });
    },
    exportGlossarySchemaByNameAndObjectType(
      glossaryName: string,
      objectType: GlossaryObjectType
    ): Promise<GlossarySchemaExportInterface> {
      return exportGlossarySchemaByNameAndObjectType({
        glossaryName,
        objectType,
        state,
      });
    },
    exportGlossarySchemas(
      options: GlossarySchemaExportOptions = { includeInternal: false }
    ): Promise<GlossarySchemaExportInterface> {
      return exportGlossarySchemas({
        options,
        state,
      });
    },
    updateGlossarySchema(
      glossaryId: string,
      glossarySchemaData: GlossarySchemaItemSkeleton<any>
    ): Promise<GlossarySchemaItemSkeleton<any>> {
      return updateGlossarySchema({
        glossaryId,
        glossarySchemaData,
        state,
      });
    },
    importGlossarySchemas(
      importData: GlossarySchemaExportInterface,
      glossaryId?: string,
      glossaryName?: string,
      objectType?: GlossaryObjectType,
      options: GlossarySchemaImportOptions = { includeInternal: false },
      resultCallback: ResultCallback<GlossarySchemaItemSkeleton<any>> = void 0
    ): Promise<GlossarySchemaItemSkeleton<any>[]> {
      return importGlossarySchemas({
        glossaryId,
        glossaryName,
        objectType,
        importData,
        options,
        resultCallback,
        state,
      });
    },
    deleteGlossarySchema(
      glossaryId: string
    ): Promise<GlossarySchemaItemSkeleton<any>> {
      return deleteGlossarySchema({
        glossaryId,
        state,
      });
    },
    deleteGlossarySchemaByNameAndObjectType(
      glossaryName: string,
      objectType: GlossaryObjectType
    ): Promise<GlossarySchemaItemSkeleton<any>> {
      return deleteGlossarySchemaByNameAndObjectType({
        glossaryName,
        objectType,
        state,
      });
    },
    deleteGlossarySchemas(
      resultCallback: ResultCallback<GlossarySchemaItemSkeleton<any>> = void 0
    ): Promise<GlossarySchemaItemSkeleton<any>[]> {
      return deleteGlossarySchemas({
        resultCallback,
        state,
      });
    },
  };
};

export interface GlossarySchemaExportInterface {
  meta?: ExportMetaData;
  glossarySchema: Record<string, GlossarySchemaItemSkeleton<any>>;
}

/**
 * Glossary schema import options
 */
export interface GlossarySchemaImportOptions {
  /**
   * Include internal glossary schema in import if true
   */
  includeInternal: boolean;
}

/**
 * Glossary schema export options
 */
export interface GlossarySchemaExportOptions {
  /**
   * Include internal glossary schema in export if true
   */
  includeInternal: boolean;
}

/**
 * Create an empty glossary schema export template
 * @returns {GlossarySchemaExportInterface} an empty glossary schema export template
 */
export function createGlossarySchemaExportTemplate({
  state,
}: {
  state: State;
}): GlossarySchemaExportInterface {
  return {
    meta: getMetadata({ state }),
    glossarySchema: {},
  };
}

/**
 * Create glossary schema
 * @param {GlossarySchemaItemSkeleton} glossarySchemaData the glossary schema object
 * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
 */
export async function createGlossarySchema({
  glossarySchemaData,
  state,
}: {
  glossarySchemaData: GlossarySchemaItemSkeleton<any>;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>> {
  try {
    return await _createGlossarySchema({ glossarySchemaData, state });
  } catch (error) {
    throw new FrodoError(
      `Error creating glossary schema ${glossarySchemaData.name}`,
      error
    );
  }
}

/**
 * Read glossary schema
 * @param {string} glossaryId the glossary schema id
 * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
 */
export async function readGlossarySchema({
  glossaryId,
  state,
}: {
  glossaryId: string;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>> {
  try {
    return await getGlossarySchema({ glossaryId, state });
  } catch (error) {
    throw new FrodoError(`Error reading glossary schema ${glossaryId}`, error);
  }
}

/**
 * Read glossary schema by its name and object type
 * @param {string} glossaryName the glossary schema name
 * @param {GlossaryObjectType} objectType the glossary schema object type
 * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
 */
export async function readGlossarySchemaByNameAndObjectType({
  glossaryName,
  objectType,
  state,
}: {
  glossaryName: string;
  objectType: GlossaryObjectType;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>> {
  try {
    const schemas = await searchGlossarySchemas({
      targetFilter: {
        operator: 'AND',
        operand: [
          {
            operator: 'EQUALS',
            operand: {
              targetName: 'name',
              targetValue: glossaryName,
            },
          },
          {
            operator: 'EQUALS',
            operand: {
              targetName: 'objectType',
              targetValue: objectType,
            },
          },
        ],
      },
      state,
    });
    if (schemas.length !== 1) {
      throw new FrodoError(
        `Expected to find a glossary schema of object type ${objectType} with name ${glossaryName}, but ${schemas.length} were found.`
      );
    }
    return schemas[0];
  } catch (error) {
    throw new FrodoError(
      `Error reading glossary schema ${glossaryName}`,
      error
    );
  }
}

/**
 * Read all glossary schemas
 * @returns {Promise<GlossarySchemaItemSkeleton[]>} a promise that resolves to an array of glossary schema objects
 */
export async function readGlossarySchemas({
  state,
}: {
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>[]> {
  try {
    return await searchGlossarySchemas({ state });
  } catch (error) {
    throw new FrodoError(`Error reading glossary schemas`, error);
  }
}

/**
 * Export glossary schema
 * @param {string} glossaryId the glossary schema id
 * @returns {Promise<GlossarySchemaExportInterface>} a promise that resolves to a glossary schema export object
 */
export async function exportGlossarySchema({
  glossaryId,
  state,
}: {
  glossaryId: string;
  state: State;
}): Promise<GlossarySchemaExportInterface> {
  try {
    debugMessage({
      message: `IgaGlossaryOps.exportGlossarySchema: start`,
      state,
    });
    const exportData = createGlossarySchemaExportTemplate({ state });
    const schema = await readGlossarySchema({
      glossaryId,
      state,
    });
    exportData.glossarySchema[schema.id] = schema;
    debugMessage({
      message: `IgaGlossaryOps.exportGlossarySchema: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting glossary schema ${glossaryId}`,
      error
    );
  }
}

/**
 * Export glossary schema by its name and object type
 * @param {string} glossaryName the glossary schema name
 * @param {GlossaryObjectType} objectType the glossary schema object type
 * @returns {Promise<GlossarySchemaExportInterface>} a promise that resolves to a glossary schema export object
 */
export async function exportGlossarySchemaByNameAndObjectType({
  glossaryName,
  objectType,
  state,
}: {
  glossaryName: string;
  objectType: GlossaryObjectType;
  state: State;
}): Promise<GlossarySchemaExportInterface> {
  try {
    debugMessage({
      message: `IgaGlossaryOps.exportGlossarySchemaByNameAndObjectType: start`,
      state,
    });
    const exportData = createGlossarySchemaExportTemplate({ state });
    const glossarySchema = await readGlossarySchemaByNameAndObjectType({
      glossaryName,
      objectType,
      state,
    });
    exportData.glossarySchema[glossarySchema.id] = glossarySchema;
    debugMessage({
      message: `IgaGlossaryOps.exportGlossarySchemaByNameAndObjectType: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting glossary schema ${glossaryName}`,
      error
    );
  }
}

/**
 * Export all glossary schemas
 * @param {GlossarySchemaExportOptions} options export options
 * @returns {Promise<GlossarySchemaExportInterface>} a promise that resolves to a glossary schema export object
 */
export async function exportGlossarySchemas({
  options = { includeInternal: false },
  state,
}: {
  options?: GlossarySchemaExportOptions;
  state: State;
}): Promise<GlossarySchemaExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `IgaGlossaryOps.exportGlossarySchemas: start`,
      state,
    });
    const exportData = createGlossarySchemaExportTemplate({ state });
    const glossarySchemas = (await readGlossarySchemas({ state })).filter(
      (g) => options.includeInternal || g.isInternal !== true
    );
    indicatorId = createProgressIndicator({
      total: glossarySchemas.length,
      message: 'Exporting glossary schemas...',
      state,
    });
    for (const glossarySchema of glossarySchemas) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting glossary schema ${glossarySchema.id}...`,
        state,
      });
      exportData.glossarySchema[glossarySchema.id] = glossarySchema;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${glossarySchemas.length} glossary schemas`,
      status: 'success',
      state,
    });
    debugMessage({
      message: `IgaGlossaryOps.exportGlossarySchemas: end`,
      state,
    });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting glossary schemas`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting glossary schemas`, error);
  }
}

/**
 * Update glossary schema
 * @param {string} glossaryId the glossary schema id
 * @param {GlossarySchemaItemSkeleton} glossarySchemaData the glossary schema object
 * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
 */
export async function updateGlossarySchema({
  glossaryId,
  glossarySchemaData,
  state,
}: {
  glossaryId: string;
  glossarySchemaData: GlossarySchemaItemSkeleton<any>;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>> {
  try {
    return await putGlossarySchema({
      glossaryId,
      glossarySchemaData,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error updating glossary schema '${glossaryId}'`,
      error
    );
  }
}

/**
 * Import glossary schemas
 * @param {string} glossaryId The glossary schema id.  If supplied, only the glossary schema of that id is imported. Takes priority over glossaryName/objectType if they are all provided.
 * @param {string} glossaryName The glossary schema name. If supplied along with the objectType, only the glossary schema of that name/objectType is imported.
 * @param {GlossaryObjectType} objectType the glossary schema object type
 * @param {GlossarySchemaExportInterface} importData glossary schema import data
 * @param {GlossarySchemaImportOptions} options import options
 * @param {ResultCallback<GlossarySchemaItemSkeleton>} resultCallback Optional callback to process individual results
 * @returns {Promise<GlossarySchemaItemSkeleton[]>} the imported glossary schemas
 */
export async function importGlossarySchemas({
  glossaryId,
  glossaryName,
  objectType,
  importData,
  options = { includeInternal: false },
  resultCallback = void 0,
  state,
}: {
  glossaryId?: string;
  glossaryName?: string;
  objectType?: GlossaryObjectType;
  importData: GlossarySchemaExportInterface;
  options?: GlossarySchemaImportOptions;
  resultCallback?: ResultCallback<GlossarySchemaItemSkeleton<any>>;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>[]> {
  debugMessage({
    message: `IgaGlossaryOps.importGlossarySchemas: start`,
    state,
  });
  const response = [];
  for (const existingId of Object.keys(importData.glossarySchema)) {
    try {
      const glossarySchema = importData.glossarySchema[existingId];
      const shouldNotImport =
        (glossaryId && glossaryId !== glossarySchema.id) ||
        (glossaryName &&
          objectType &&
          (glossaryName !== glossarySchema.name ||
            objectType !== glossarySchema.objectType)) ||
        (!options.includeInternal && glossarySchema.isInternal === true);
      if (shouldNotImport) continue;
      let result;
      try {
        result = await putGlossarySchema({
          glossaryId: glossarySchema.id,
          glossarySchemaData: glossarySchema,
          state,
        });
      } catch (error) {
        // Due to bug in AIC, PUT does not allow for creating schema, so if we run into a scenario where the schema doesn't exist, we will attempt to create it
        if (
          error.response?.status === 500 &&
          error.response?.data?.message ===
            `Cannot read properties of undefined (reading '_source')`
        ) {
          result = await createGlossarySchema({
            glossarySchemaData: glossarySchema,
            state,
          });
        } else {
          throw error;
        }
      }
      if (resultCallback) {
        resultCallback(undefined, result);
      }
      response.push(result);
    } catch (e) {
      if (resultCallback) {
        resultCallback(e, undefined);
      } else {
        throw new FrodoError(
          `Error importing glossary schema '${importData.glossarySchema[existingId].name}'`,
          e
        );
      }
    }
  }
  debugMessage({ message: `IgaGlossaryOps.importGlossarySchemas: end`, state });
  return response;
}

/**
 * Delete glossary schema
 * @param {string} glossaryId the glossary schema id
 * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
 */
export async function deleteGlossarySchema({
  glossaryId,
  state,
}: {
  glossaryId: string;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>> {
  try {
    return await _deleteGlossarySchema({ glossaryId, state });
  } catch (error) {
    throw new FrodoError(`Error deleting glossary schema ${glossaryId}`, error);
  }
}

/**
 * Delete glossary schema by its name and object type
 * @param {string} glossaryName the glossary schema name
 * @param {GlossaryObjectType} objectType the glossary schema object type
 * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
 */
export async function deleteGlossarySchemaByNameAndObjectType({
  glossaryName,
  objectType,
  state,
}: {
  glossaryName: string;
  objectType: GlossaryObjectType;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>> {
  try {
    const glossarySchema = await readGlossarySchemaByNameAndObjectType({
      glossaryName,
      objectType,
      state,
    });
    return await _deleteGlossarySchema({
      glossaryId: glossarySchema.id,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error deleting glossary schema ${glossaryName}`,
      error
    );
  }
}

/**
 * Delete glossary schemas
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<GlossarySchemaItemSkeleton[]>} promise that resolves to an array of glossary schema objects
 */
export async function deleteGlossarySchemas({
  resultCallback = void 0,
  state,
}: {
  resultCallback?: ResultCallback<GlossarySchemaItemSkeleton<any>>;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>[]> {
  const result = await readGlossarySchemas({ state });
  //Unable to delete internal schemas, so filter them out
  const glossarySchemas = result.filter((s) => !s.isInternal);
  const deletedGlossarySchemas = [];
  for (const glossarySchema of glossarySchemas) {
    const result = await getResult(
      resultCallback,
      `Error deleting glossary schema ${glossarySchema.id}`,
      deleteGlossarySchema,
      { glossaryId: glossarySchema.id, state }
    );
    if (result) {
      deletedGlossarySchemas.push(result);
    }
  }
  return deletedGlossarySchemas;
}
