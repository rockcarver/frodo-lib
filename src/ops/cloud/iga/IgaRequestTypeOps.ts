import { PatchOperationInterface } from '../../../api/ApiTypes';
import {
  createRequestType as _createRequestType,
  deleteRequestType as _deleteRequestType,
  getRequestType,
  patchRequestType,
  putRequestType,
  queryRequestTypes,
  RequestTypeSchema,
  RequestTypeSkeleton,
} from '../../../api/cloud/iga/IgaRequestTypeApi';
import { State } from '../../../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../../../utils/Console';
import {
  getErrorCallback,
  getMetadata,
  getResult,
} from '../../../utils/ExportImportUtils';
import { FrodoError } from '../../FrodoError';
import { ExportMetaData, ResultCallback } from '../../OpsTypes';
import { deleteOrphanedRequestFormAssignments } from './IgaRequestFormOps';

export type RequestType = {
  /**
   * Create request type
   * @param {RequestTypeSkeleton} typeData the request type object
   * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
   */
  createRequestType(
    typeData: RequestTypeSkeleton
  ): Promise<RequestTypeSkeleton>;
  /**
   * Read request type
   * @param {string} typeId the request type id
   * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
   */
  readRequestType(typeId: string): Promise<RequestTypeSkeleton>;
  /**
   * Read request type by its display name
   * @param {string} typeName the request type display name
   * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
   */
  readRequestTypeByName(typeName: string): Promise<RequestTypeSkeleton>;
  /**
   * Read all request types
   * @returns {Promise<RequestTypeSkeleton[]>} a promise that resolves to an array of request type objects
   */
  readRequestTypes(): Promise<RequestTypeSkeleton[]>;
  /**
   * Export request type
   * @param {string} typeId the request type id
   * @param {RequestTypeExportOptions} options export options
   * @returns {Promise<RequestTypeExportInterface>} a promise that resolves to a request type export object
   */
  exportRequestType(
    typeId: string,
    options?: RequestTypeExportOptions
  ): Promise<RequestTypeExportInterface>;
  /**
   * Export request type by its display name
   * @param {string} typeName the request type display name
   * @param {RequestTypeExportOptions} options export options
   * @returns {Promise<RequestTypeExportInterface>} a promise that resolves to a request type export object
   */
  exportRequestTypeByName(
    typeName: string,
    options?: RequestTypeExportOptions
  ): Promise<RequestTypeExportInterface>;
  /**
   * Export all request types
   * @param {RequestTypeExportOptions} options export options
   * @returns {Promise<RequestTypeExportInterface>} a promise that resolves to a request type export object
   */
  exportRequestTypes(
    options?: RequestTypeExportOptions
  ): Promise<RequestTypeExportInterface>;
  /**
   * Update request type
   * @param {string} typeId the request type id
   * @param {RequestTypeSkeleton} typeData the request type object
   * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
   */
  updateRequestType(
    typeId: string,
    typeData: RequestTypeSkeleton
  ): Promise<RequestTypeSkeleton>;
  /**
   * Import request types
   * @param {string} typeId The request type id. If supplied, only the request type of that id is imported. Takes priority over typeName if they are all provided.
   * @param {string} typeName The request type display name. If supplied, only the request type of that display name is imported.
   * @param {RequestTypeExportInterface} importData request type import data
   * @param {RequestTypeImportOptions} options import options
   * @param {ResultCallback<RequestTypeSkeleton>} resultCallback Optional callback to process individual results
   * @returns {Promise<RequestTypeSkeleton[]>} the imported request types
   */
  importRequestTypes(
    importData: RequestTypeExportInterface,
    typeId?: string,
    typeName?: string,
    options?: RequestTypeImportOptions,
    resultCallback?: ResultCallback<RequestTypeSkeleton>
  ): Promise<RequestTypeSkeleton[]>;
  /**
   * Delete request type
   * @param {string} typeId the request type id
   * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
   */
  deleteRequestType(typeId: string): Promise<RequestTypeSkeleton>;
  /**
   * Delete request type by its display name
   * @param {string} typeName the request type display name
   * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
   */
  deleteRequestTypeByName(typeName: string): Promise<RequestTypeSkeleton>;
  /**
   * Delete request types
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<RequestTypeSkeleton[]>} promise that resolves to an array of request type objects
   */
  deleteRequestTypes(
    resultCallback?: ResultCallback<RequestTypeSkeleton>
  ): Promise<RequestTypeSkeleton[]>;
};

export default (state: State): RequestType => {
  return {
    createRequestType(
      typeData: RequestTypeSkeleton
    ): Promise<RequestTypeSkeleton> {
      return createRequestType({
        typeData,
        state,
      });
    },
    readRequestType(typeId: string): Promise<RequestTypeSkeleton> {
      return readRequestType({
        typeId,
        state,
      });
    },
    readRequestTypeByName(typeName: string): Promise<RequestTypeSkeleton> {
      return readRequestTypeByName({
        typeName,
        state,
      });
    },
    readRequestTypes(): Promise<RequestTypeSkeleton[]> {
      return readRequestTypes({
        state,
      });
    },
    exportRequestType(
      typeId: string,
      options: RequestTypeExportOptions = {
        onlyCustom: false,
        useStringArrays: true,
      }
    ): Promise<RequestTypeExportInterface> {
      return exportRequestType({
        typeId,
        options,
        state,
      });
    },
    exportRequestTypeByName(
      typeName: string,
      options: RequestTypeExportOptions = {
        onlyCustom: false,
        useStringArrays: true,
      }
    ): Promise<RequestTypeExportInterface> {
      return exportRequestTypeByName({
        typeName,
        options,
        state,
      });
    },
    exportRequestTypes(
      options: RequestTypeExportOptions = {
        onlyCustom: false,
        useStringArrays: true,
      }
    ): Promise<RequestTypeExportInterface> {
      return exportRequestTypes({
        options,
        state,
      });
    },
    updateRequestType(
      typeId: string,
      typeData: RequestTypeSkeleton
    ): Promise<RequestTypeSkeleton> {
      return updateRequestType({
        typeId,
        typeData,
        state,
      });
    },
    importRequestTypes(
      importData: RequestTypeExportInterface,
      typeId?: string,
      typeName?: string,
      options: RequestTypeImportOptions = { onlyCustom: false },
      resultCallback: ResultCallback<RequestTypeSkeleton> = void 0
    ): Promise<RequestTypeSkeleton[]> {
      return importRequestTypes({
        typeId,
        typeName,
        importData,
        options,
        resultCallback,
        state,
      });
    },
    deleteRequestType(typeId: string): Promise<RequestTypeSkeleton> {
      return deleteRequestType({
        typeId,
        state,
      });
    },
    deleteRequestTypeByName(typeName: string): Promise<RequestTypeSkeleton> {
      return deleteRequestTypeByName({
        typeName,
        state,
      });
    },
    deleteRequestTypes(
      resultCallback: ResultCallback<RequestTypeSkeleton> = void 0
    ): Promise<RequestTypeSkeleton[]> {
      return deleteRequestTypes({
        resultCallback,
        state,
      });
    },
  };
};

export interface RequestTypeExportInterface {
  meta?: ExportMetaData;
  requestType: Record<string, RequestTypeSkeleton>;
}

/**
 * Request type import options
 */
export interface RequestTypeImportOptions {
  /**
   * Include only custom request types in import if true.
   * Note that non-custom request type imports will only modify the workflow ID as in the UI.
   */
  onlyCustom: boolean;
}

/**
 * Request type export options
 */
export interface RequestTypeExportOptions {
  /**
   * Include only custom request types in export if true
   */
  onlyCustom: boolean;
  /**
   * Use string arrays to store script code
   */
  useStringArrays: boolean;
}

/**
 * Create an empty request type export template
 * @returns {RequestTypeExportInterface} an empty request type export template
 */
export function createRequestTypeExportTemplate({
  state,
}: {
  state: State;
}): RequestTypeExportInterface {
  return {
    meta: getMetadata({ state }),
    requestType: {},
  };
}

/**
 * Create request type
 * @param {RequestTypeSkeleton} typeData the request type object
 * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
 */
export async function createRequestType({
  typeData,
  state,
}: {
  typeData: RequestTypeSkeleton;
  state: State;
}): Promise<RequestTypeSkeleton> {
  try {
    typeData = prepareRequestTypeForImport(typeData);
    return await _createRequestType({ typeData, state });
  } catch (error) {
    throw new FrodoError(
      `Error creating request type ${typeData.displayName}`,
      error
    );
  }
}

/**
 * Read request type
 * @param {string} typeId the request type id
 * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
 */
export async function readRequestType({
  typeId,
  state,
}: {
  typeId: string;
  state: State;
}): Promise<RequestTypeSkeleton> {
  try {
    return await getRequestType({ typeId, state });
  } catch (error) {
    throw new FrodoError(`Error reading request type ${typeId}`, error);
  }
}

/**
 * Read request type by its display name
 * @param {string} typeName the request type display name
 * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
 */
export async function readRequestTypeByName({
  typeName,
  state,
}: {
  typeName: string;
  state: State;
}): Promise<RequestTypeSkeleton> {
  try {
    const types = await queryRequestTypes({
      queryFilter: `displayName eq "${typeName}"`,
      state,
    });
    if (types.length !== 1) {
      throw new FrodoError(
        `Expected to find a single request type named '${typeName}', but ${types.length} were found.`
      );
    }
    return types[0];
  } catch (error) {
    throw new FrodoError(`Error reading request type ${typeName}`, error);
  }
}

/**
 * Read all request types
 * @returns {Promise<RequestTypeSkeleton[]>} a promise that resolves to an array of request type objects
 */
export async function readRequestTypes({
  state,
}: {
  state: State;
}): Promise<RequestTypeSkeleton[]> {
  try {
    return await queryRequestTypes({ state });
  } catch (error) {
    throw new FrodoError(`Error reading request types`, error);
  }
}

/**
 * Export request type
 * @param {string} typeId the request type id
 * @param {RequestTypeExportOptions} options export options
 * @returns {Promise<RequestTypeExportInterface>} a promise that resolves to a request type export object
 */
export async function exportRequestType({
  typeId,
  options = { onlyCustom: false, useStringArrays: true },
  state,
}: {
  typeId: string;
  options: RequestTypeExportOptions;
  state: State;
}): Promise<RequestTypeExportInterface> {
  try {
    debugMessage({
      message: `IgaRequestTypeOps.exportRequestType: start`,
      state,
    });
    const type = await readRequestType({
      typeId,
      state,
    });
    const exportData = prepareRequestTypeForExport({
      typeData: type,
      options,
      state,
    });
    debugMessage({
      message: `IgaRequestTypeOps.exportRequestType: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting request type ${typeId}`, error);
  }
}

/**
 * Export request type by its display name
 * @param {string} typeName the request type display name
 * @param {RequestTypeExportOptions} options export options
 * @returns {Promise<RequestTypeExportInterface>} a promise that resolves to a request type export object
 */
export async function exportRequestTypeByName({
  typeName,
  options = { onlyCustom: false, useStringArrays: true },
  state,
}: {
  typeName: string;
  options: RequestTypeExportOptions;
  state: State;
}): Promise<RequestTypeExportInterface> {
  try {
    debugMessage({
      message: `IgaRequestTypeOps.exportRequestTypeByName: start`,
      state,
    });
    const exportData = createRequestTypeExportTemplate({ state });
    const type = await readRequestTypeByName({
      typeName,
      state,
    });
    if (
      options.useStringArrays &&
      type.validation &&
      typeof type.validation.source === 'string'
    ) {
      type.validation.source = type.validation.source.split('\n');
    }
    exportData.requestType[type.id] = type;
    debugMessage({
      message: `IgaRequestTypeOps.exportRequestTypeByName: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting request type ${typeName}`, error);
  }
}

/**
 * Export all request types
 * @param {RequestTypeExportOptions} options export options
 * @returns {Promise<RequestTypeExportInterface>} a promise that resolves to a request type export object
 */
export async function exportRequestTypes({
  options = { onlyCustom: false, useStringArrays: true },
  state,
}: {
  options?: RequestTypeExportOptions;
  state: State;
}): Promise<RequestTypeExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `IgaRequestTypeOps.exportRequestTypes: start`,
      state,
    });
    const exportData = createRequestTypeExportTemplate({ state });
    const requestTypes = (await readRequestTypes({ state })).filter(
      (t) => !options.onlyCustom || t.custom
    );
    indicatorId = createProgressIndicator({
      total: requestTypes.length,
      message: 'Exporting request types...',
      state,
    });
    for (const requestType of requestTypes) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting request type ${requestType.displayName}...`,
        state,
      });
      const typeExport = prepareRequestTypeForExport({
        typeData: requestType,
        options,
        state,
      });
      Object.assign(exportData.requestType, typeExport.requestType);
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${requestTypes.length} request types`,
      status: 'success',
      state,
    });
    debugMessage({
      message: `IgaRequestTypeOps.exportRequestTypes: end`,
      state,
    });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting request types`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting request types`, error);
  }
}

/**
 * Update request type
 * @param {string} typeId the request type id
 * @param {RequestTypeSkeleton} typeData the request type object
 * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
 */
export async function updateRequestType({
  typeId,
  typeData,
  state,
}: {
  typeId: string;
  typeData: RequestTypeSkeleton;
  state: State;
}): Promise<RequestTypeSkeleton> {
  try {
    typeData = prepareRequestTypeForImport(typeData);
    return await putRequestType({
      typeId,
      typeData,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error updating request type '${typeId}'`, error);
  }
}

/**
 * Import request types
 * @param {string} typeId The request type id. If supplied, only the request type of that id is imported. Takes priority over typeName if they are all provided.
 * @param {string} typeName The request type display name. If supplied, only the request type of that display name is imported.
 * @param {RequestTypeExportInterface} importData request type import data
 * @param {RequestTypeImportOptions} options import options
 * @param {ResultCallback<RequestTypeSkeleton>} resultCallback Optional callback to process individual results
 * @returns {Promise<RequestTypeSkeleton[]>} the imported request types
 */
export async function importRequestTypes({
  typeId,
  typeName,
  importData,
  options = { onlyCustom: false },
  resultCallback = void 0,
  state,
}: {
  typeId?: string;
  typeName?: string;
  importData: RequestTypeExportInterface;
  options?: RequestTypeImportOptions;
  resultCallback?: ResultCallback<RequestTypeSkeleton>;
  state: State;
}): Promise<RequestTypeSkeleton[]> {
  debugMessage({
    message: `IgaRequestTypeOps.importRequestTypes: start`,
    state,
  });
  const response = [];
  for (const existingId of Object.keys(importData.requestType)) {
    const requestType = importData.requestType[existingId];
    const shouldNotImport =
      (typeId && typeId !== requestType.id) ||
      (typeName && typeName !== requestType.displayName) ||
      (!typeId && !typeName && options.onlyCustom && !requestType.custom);
    if (shouldNotImport) continue;
    let result;
    if (requestType.custom) {
      // createRequestType can also be used as updateRequestType to replace existing configuration, so we use this method instead since updateRequestType can't be used to create configuration
      result = await getResult(
        resultCallback,
        `Error importing request type ${requestType.displayName}`,
        createRequestType,
        {
          typeData: requestType,
          state,
        }
      );
    } else if (!options.onlyCustom) {
      // Check if the request type exists or not first. If not, import it before we attempt to patch it
      try {
        await getRequestType({
          typeId: requestType.id,
          state,
        });
      } catch (e) {
        if (
          e.response?.status === 404 &&
          e.response?.data?.message === "Request Type Id doesn't exist"
        ) {
          await getResult(
            getErrorCallback(resultCallback),
            `Error creating request type ${requestType.displayName}`,
            createRequestType,
            {
              typeData: requestType,
              state,
            }
          );
        } else if (resultCallback) {
          resultCallback(e);
        } else {
          throw new FrodoError(
            `Error reading request type ${requestType.displayName}`,
            e
          );
        }
      }
      const ops: PatchOperationInterface[] = [
        // For some reason the UI will patch customValidation to null during an update on a non-custom request type, so we do the same here just to be safe
        {
          operation: 'replace',
          field: '/customValidation',
          value: null,
        },
        // We want to remove any custom schema if applicable since it's not a custom request type
        {
          operation: 'remove',
          field: '/schemas/custom',
        },
        // We want to set the custom field to false since it's not a custom request type (removing the field doesn't work)
        {
          operation: 'replace',
          field: '/custom',
          value: false,
        },
      ];
      if (requestType.workflow?.id) {
        ops.push({
          operation: 'replace',
          field: '/workflow/id',
          value: requestType.workflow.id,
        });
      }
      result = await getResult(
        resultCallback,
        `Error importing request type ${requestType.displayName}`,
        patchRequestType,
        {
          typeId: requestType.id,
          ops,
          // Must use low level api to patch non-custom request types
          useLowLevelApi: true,
          state,
        }
      );
    }
    if (result) {
      response.push(result);
    }
  }
  debugMessage({ message: `IgaRequestTypeOps.importRequestTypes: end`, state });
  return response;
}

/**
 * Delete request type
 * @param {string} typeId the request type id
 * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
 */
export async function deleteRequestType({
  typeId,
  state,
}: {
  typeId: string;
  state: State;
}): Promise<RequestTypeSkeleton> {
  try {
    const deletedRequestType = await _deleteRequestType({ typeId, state });
    await deleteOrphanedRequestFormAssignments({
      requestTypeId: typeId,
      state,
    });
    return deletedRequestType;
  } catch (error) {
    throw new FrodoError(`Error deleting request type ${typeId}`, error);
  }
}

/**
 * Delete request type by its display name
 * @param {string} typeName the request type display name
 * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
 */
export async function deleteRequestTypeByName({
  typeName,
  state,
}: {
  typeName: string;
  state: State;
}): Promise<RequestTypeSkeleton> {
  try {
    const requestType = await readRequestTypeByName({
      typeName,
      state,
    });
    return await deleteRequestType({
      typeId: requestType.id,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error deleting request type ${typeName}`, error);
  }
}

/**
 * Delete request types
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<RequestTypeSkeleton[]>} promise that resolves to an array of request type objects
 */
export async function deleteRequestTypes({
  resultCallback = void 0,
  state,
}: {
  resultCallback?: ResultCallback<RequestTypeSkeleton>;
  state: State;
}): Promise<RequestTypeSkeleton[]> {
  const result = await readRequestTypes({ state });
  // Unable to delete non-custom request types, so filter them out
  const requestTypes = result.filter((s) => s.custom);
  const deletedRequestTypes = [];
  for (const requestType of requestTypes) {
    const result = await getResult(
      resultCallback,
      `Error deleting request type ${requestType.id}`,
      deleteRequestType,
      { typeId: requestType.id, state }
    );
    if (result) {
      deletedRequestTypes.push(result);
    }
  }
  return deletedRequestTypes;
}

/**
 * Helper that prepares a request type for export
 * @param {RequestTypeSkeleton} typeData the request type data
 * @param {RequestTypeExportOptions} options export options
 * @returns {RequestTypeExportInterface} the request type export object
 */
function prepareRequestTypeForExport({
  typeData,
  options,
  state,
}: {
  typeData: RequestTypeSkeleton;
  options: RequestTypeExportOptions;
  state: State;
}): RequestTypeExportInterface {
  const exportData = createRequestTypeExportTemplate({ state });
  if (
    options.useStringArrays &&
    typeData.validation &&
    typeof typeData.validation.source === 'string'
  ) {
    typeData.validation.source = typeData.validation.source.split('\n');
  }
  exportData.requestType[typeData.id] = typeData;
  return exportData;
}

/**
 * Helper that prepares a request type for import
 * @param {RequestTypeSkeleton} typeData the request type data
 * @returns {RequestTypeSkeleton} the updated request type data
 */
function prepareRequestTypeForImport(
  typeData: RequestTypeSkeleton
): RequestTypeSkeleton {
  if (Array.isArray(typeData.validation?.source)) {
    typeData.validation.source = typeData.validation.source.join('\n');
  }
  // There is a bug with the import endpoint (both PUT and POST, as of AIC version 20814.0) where if the common array has an object, but the custom array doesn't have one at the first position,
  // it will throw a 500 error, so we add in an empty object to the custom array so that on import it will import successfully.
  if (
    Array.isArray(typeData.schemas?.common) &&
    typeData.schemas.common.some(
      (o) => typeof o === 'object' && !Array.isArray(o) && o !== null
    )
  ) {
    if (
      !Array.isArray(typeData.schemas.custom) ||
      typeData.schemas.custom.length === 0
    ) {
      typeData.schemas.custom = [{}] as RequestTypeSchema[];
    } else if (
      typeof typeData.schemas.custom[0] !== 'object' ||
      typeData.schemas.custom[0] === null
    ) {
      typeData.schemas.custom.unshift({} as RequestTypeSchema);
    }
  }
  return typeData;
}
