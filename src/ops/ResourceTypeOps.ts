import {
  createResourceType as _createResourceType,
  deleteResourceType as _deleteResourceType,
  getResourceType as _getResourceType,
  getResourceTypeByName as _getResourceTypeByName,
  getResourceTypes as _getResourceTypes,
  putResourceType as _putResourceType,
  type ResourceTypeSkeleton,
} from '../api/ResourceTypesApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { ExportMetaData } from './OpsTypes';

export type ResourceType = {
  /**
   * Read resource type
   * @param resourceTypeUuid resource type uuid
   * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
   */
  readResourceType(resourceTypeUuid: string): Promise<ResourceTypeSkeleton>;
  /**
   * Read all resource types
   * @returns {Promise<ResourceTypeSkeleton[]>} a promise that resolves to an array of resource type objects
   */
  readResourceTypes(): Promise<ResourceTypeSkeleton[]>;
  /**
   * Read resource type by name
   * @param {string} resourceTypeName resource type name
   * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
   */
  readResourceTypeByName(
    resourceTypeName: string
  ): Promise<ResourceTypeSkeleton>;
  /**
   * Create resource type
   * @param resourceTypeData resource type data
   * @param resourceTypeUuid resource type uuid
   * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
   */
  createResourceType(
    resourceTypeData: ResourceTypeSkeleton,
    resourceTypeUuid?: string
  ): Promise<ResourceTypeSkeleton>;
  /**
   * Update resource type
   * @param {string} resourceTypeData resource type data
   * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
   */
  updateResourceType(
    resourceTypeUuid: string,
    resourceTypeData: ResourceTypeSkeleton
  ): Promise<ResourceTypeSkeleton>;
  /**
   * Delete resource type
   * @param {string} resourceTypeUuid resource type uuid
   * @returns {Promise<ResourceTypeSkeleton>} Promise resolvig to a resource type object
   */
  deleteResourceType(resourceTypeUuid: string): Promise<ResourceTypeSkeleton>;
  /**
   * Delete resource type by name
   * @param {string} resourceTypeName resource type name
   * @returns {Promise<ResourceTypeSkeleton>} Promise resolvig to a resource type object
   */
  deleteResourceTypeByName(
    resourceTypeName: string
  ): Promise<ResourceTypeSkeleton>;
  /**
   * Export resource type
   * @param {string} resourceTypeUuid resource type uuid
   * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
   */
  exportResourceType(
    resourceTypeUuid: string
  ): Promise<ResourceTypeExportInterface>;
  /**
   * Export resource type by name
   * @param {string} resourceTypeName resource type name
   * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
   */
  exportResourceTypeByName(
    resourceTypeName: string
  ): Promise<ResourceTypeExportInterface>;
  /**
   * Export resource types
   * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
   */
  exportResourceTypes(): Promise<ResourceTypeExportInterface>;
  /**
   * Import resource type by uuid
   * @param {string} resourceTypeUuid client uuid
   * @param {ResourceTypeExportInterface} importData import data
   */
  importResourceType(
    resourceTypeUuid: string,
    importData: ResourceTypeExportInterface
  ): Promise<any>;
  /**
   * Import resource type by name
   * @param {string} resourceTypeName client id
   * @param {ResourceTypeExportInterface} importData import data
   */
  importResourceTypeByName(
    resourceTypeName: string,
    importData: ResourceTypeExportInterface
  ): Promise<any>;
  /**
   * Import first resource type
   * @param {ResourceTypeExportInterface} importData import data
   */
  importFirstResourceType(
    importData: ResourceTypeExportInterface
  ): Promise<any>;
  /**
   * Import resource types
   * @param {ResourceTypeExportInterface} importData import data
   */
  importResourceTypes(importData: ResourceTypeExportInterface): Promise<any[]>;

  // Deprecated

  /**
   * Get resource type
   * @param resourceTypeUuid resource type uuid
   * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
   * @deprecated since v2.0.0 use {@link Agent.readResourceType | readResourceType} instead
   * ```javascript
   * readResourceType(resourceTypeUuid: string): Promise<ResourceTypeSkeleton>
   * ```
   * @group Deprecated
   */
  getResourceType(resourceTypeUuid: string): Promise<ResourceTypeSkeleton>;
  /**
   * Get all resource types
   * @returns {Promise<ResourceTypeSkeleton[]>} a promise that resolves to an array of resource type objects
   * @deprecated since v2.0.0 use {@link Agent.readResourceTypes | readResourceTypes} instead
   * ```javascript
   * readResourceTypes(): Promise<ResourceTypeSkeleton[]>
   * ```
   * @group Deprecated
   */
  getResourceTypes(): Promise<ResourceTypeSkeleton[]>;
  /**
   * Get resource type by name
   * @param {string} resourceTypeName resource type name
   * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
   * @deprecated since v2.0.0 use {@link Agent.readResourceTypeByName | readResourceTypeByName} instead
   * ```javascript
   * readResourceTypeByName(resourceTypeName: string): Promise<ResourceTypeSkeleton>
   * ```
   * @group Deprecated
   */
  getResourceTypeByName(
    resourceTypeName: string
  ): Promise<ResourceTypeSkeleton>;
};

export default (state: State): ResourceType => {
  return {
    async readResourceType(resourceTypeUuid: string) {
      return readResourceType({ resourceTypeUuid, state });
    },
    async readResourceTypes(): Promise<ResourceTypeSkeleton[]> {
      return readResourceTypes({ state });
    },
    async readResourceTypeByName(
      resourceTypeName: string
    ): Promise<ResourceTypeSkeleton> {
      return readResourceTypeByName({ resourceTypeName, state });
    },
    async createResourceType(
      resourceTypeData: ResourceTypeSkeleton,
      resourceTypeUuid: string = undefined
    ): Promise<ResourceTypeSkeleton> {
      return createResourceType({ resourceTypeData, resourceTypeUuid, state });
    },
    async updateResourceType(
      resourceTypeUuid: string,
      resourceTypeData: ResourceTypeSkeleton
    ): Promise<ResourceTypeSkeleton> {
      return updateResourceType({
        resourceTypeUuid,
        resourceTypeData,
        state,
      });
    },
    async deleteResourceType(resourceTypeUuid: string) {
      return deleteResourceType({ resourceTypeUuid, state });
    },
    async deleteResourceTypeByName(
      resourceTypeName: string
    ): Promise<ResourceTypeSkeleton> {
      return deleteResourceTypeByName({ resourceTypeName, state });
    },
    async exportResourceType(
      resourceTypeUuid: string
    ): Promise<ResourceTypeExportInterface> {
      return exportResourceType({ resourceTypeUuid, state });
    },
    async exportResourceTypeByName(
      resourceTypeName: string
    ): Promise<ResourceTypeExportInterface> {
      return exportResourceTypeByName({ resourceTypeName, state });
    },
    async exportResourceTypes(): Promise<ResourceTypeExportInterface> {
      return exportResourceTypes({ state });
    },
    async importResourceType(
      resourceTypeUuid: string,
      importData: ResourceTypeExportInterface
    ) {
      return importResourceType({
        resourceTypeUuid,
        importData,
        state,
      });
    },
    async importResourceTypeByName(
      resourceTypeName: string,
      importData: ResourceTypeExportInterface
    ) {
      return importResourceTypeByName({
        resourceTypeName,
        importData,
        state,
      });
    },
    async importFirstResourceType(importData: ResourceTypeExportInterface) {
      return importFirstResourceType({ importData, state });
    },
    async importResourceTypes(importData: ResourceTypeExportInterface) {
      return importResourceTypes({ importData, state });
    },

    // Deprecated

    async getResourceType(resourceTypeUuid: string) {
      return readResourceType({ resourceTypeUuid, state });
    },
    async getResourceTypes(): Promise<ResourceTypeSkeleton[]> {
      return readResourceTypes({ state });
    },
    async getResourceTypeByName(
      resourceTypeName: string
    ): Promise<ResourceTypeSkeleton> {
      return readResourceTypeByName({ resourceTypeName, state });
    },
  };
};

export interface ResourceTypeExportInterface {
  meta?: ExportMetaData;
  resourcetype: Record<string, ResourceTypeSkeleton>;
}

/**
 * Create an empty export template
 * @returns {ResourceTypeExportInterface} an empty export template
 */
export function createResourceTypeExportTemplate({
  state,
}: {
  state: State;
}): ResourceTypeExportInterface {
  return {
    meta: getMetadata({ state }),
    script: {},
    policy: {},
    policyset: {},
    resourcetype: {},
  } as ResourceTypeExportInterface;
}

export async function readResourceType({
  resourceTypeUuid,
  state,
}: {
  resourceTypeUuid: string;
  state: State;
}) {
  return _getResourceType({ resourceTypeUuid, state });
}

/**
 * Get all resource types
 * @returns {Promise} a promise that resolves to an array of resource type objects
 */
export async function readResourceTypes({
  state,
}: {
  state: State;
}): Promise<ResourceTypeSkeleton[]> {
  const { result } = await _getResourceTypes({ state });
  return result;
}

/**
 * Get resource type by name
 * @param {string} resourceTypeName resource type name
 * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
 */
export async function readResourceTypeByName({
  resourceTypeName,
  state,
}: {
  resourceTypeName: string;
  state: State;
}): Promise<ResourceTypeSkeleton> {
  const { result } = await _getResourceTypeByName({ resourceTypeName, state });
  switch (result.length) {
    case 1:
      return result[0];
    case 0:
      throw new Error(
        `Resource Type with name ${resourceTypeName} does not exist in realm ${state.getRealm()}`
      );
    default:
      throw new Error(
        `${result.length} resource types '${resourceTypeName}' found`
      );
  }
}

/**
 * Update resource type
 * @param {string} resourceTypeData resource type id
 * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
 */
export async function updateResourceType({
  resourceTypeUuid,
  resourceTypeData,
  state,
}: {
  resourceTypeUuid: string;
  resourceTypeData: ResourceTypeSkeleton;
  state: State;
}): Promise<ResourceTypeSkeleton> {
  return _putResourceType({ resourceTypeUuid, resourceTypeData, state });
}

export async function deleteResourceType({
  resourceTypeUuid,
  state,
}: {
  resourceTypeUuid: string;
  state: State;
}) {
  return _deleteResourceType({ resourceTypeUuid, state });
}

/**
 * Delete resource type by name
 * @param {string} resourceTypeName resource type name
 * @returns {Promise<ResourceTypeSkeleton>} Promise resolvig to a resource type object
 */
export async function deleteResourceTypeByName({
  resourceTypeName,
  state,
}: {
  resourceTypeName: string;
  state: State;
}): Promise<ResourceTypeSkeleton> {
  const resourceTypeUuid = (
    await readResourceTypeByName({ resourceTypeName, state })
  ).uuid;
  return _deleteResourceType({ resourceTypeUuid, state });
}

/**
 * Export resource type
 * @param {string} resourceTypeUuid resource type uuid
 * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
 */
export async function exportResourceType({
  resourceTypeUuid,
  state,
}: {
  resourceTypeUuid: string;
  state: State;
}): Promise<ResourceTypeExportInterface> {
  debugMessage({ message: `ResourceTypeOps.exportResourceType: start`, state });
  const exportData = createResourceTypeExportTemplate({ state });
  const errors = [];
  try {
    const resourceTypeData = await _getResourceType({
      resourceTypeUuid,
      state,
    });
    exportData.resourcetype[resourceTypeData.uuid] = resourceTypeData;
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => {
        if (error.response?.status === 404) {
          return `Resource Type with uuid ${resourceTypeUuid} does not exist in realm ${state.getRealm()}`;
        } else {
          return error.response?.data?.message || error.message;
        }
      })
      .join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({ message: `ResourceTypeOps.exportResourceType: end`, state });
  return exportData;
}

/**
 * Export resource type by name
 * @param {string} resourceTypeName resource type name
 * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
 */
export async function exportResourceTypeByName({
  resourceTypeName,
  state,
}: {
  resourceTypeName: string;
  state: State;
}): Promise<ResourceTypeExportInterface> {
  debugMessage({
    message: `ResourceTypeOps.exportResourceTypeByName: start`,
    state,
  });
  const exportData = createResourceTypeExportTemplate({ state });
  const errors = [];
  try {
    const resourceTypeData = await readResourceTypeByName({
      resourceTypeName,
      state,
    });
    exportData.resourcetype[resourceTypeData.uuid] = resourceTypeData;
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({
    message: `ResourceTypeOps.exportResourceTypeByName: end`,
    state,
  });
  return exportData;
}

/**
 * Export resource types
 * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
 */
export async function exportResourceTypes({
  state,
}: {
  state: State;
}): Promise<ResourceTypeExportInterface> {
  debugMessage({ message: `ResourceTypeOps.exportResourceType: start`, state });
  const exportData = createResourceTypeExportTemplate({ state });
  const errors = [];
  try {
    const resourceTypes = await readResourceTypes({ state });
    createProgressIndicator({
      total: resourceTypes.length,
      message: 'Exporting resource types...',
      state,
    });
    for (const resourceTypeData of resourceTypes) {
      updateProgressIndicator({
        message: `Exporting resource type ${resourceTypeData._id}`,
        state,
      });
      exportData.resourcetype[resourceTypeData.uuid] = resourceTypeData;
    }
    stopProgressIndicator({
      message: `Exported ${resourceTypes.length} resource types.`,
      state,
    });
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({ message: `ResourceTypeOps.exportResourceType: end`, state });
  return exportData;
}

/**
 * Import resource type by uuid
 * @param {string} resourceTypeUuid client uuid
 * @param {ResourceTypeExportInterface} importData import data
 */
export async function importResourceType({
  resourceTypeUuid,
  importData,
  state,
}: {
  resourceTypeUuid: string;
  importData: ResourceTypeExportInterface;
  state: State;
}) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.resourcetype)) {
    if (id === resourceTypeUuid) {
      try {
        const resourceTypeData = importData.resourcetype[id];
        delete resourceTypeData._rev;
        try {
          response = await _createResourceType({ resourceTypeData, state });
        } catch (createError) {
          if (createError.response?.status === 409)
            response = await _putResourceType({
              resourceTypeUuid: id,
              resourceTypeData,
              state,
            });
          else throw createError;
        }
        imported.push(id);
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
      .join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(
      `Import error:\n${resourceTypeUuid} not found in import data!`
    );
  }
  return response;
}

/**
 * Import resource type by name
 * @param {string} resourceTypeName client id
 * @param {ResourceTypeExportInterface} importData import data
 */
export async function importResourceTypeByName({
  resourceTypeName,
  importData,
  state,
}: {
  resourceTypeName: string;
  importData: ResourceTypeExportInterface;
  state: State;
}) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.resourcetype)) {
    if (importData.resourcetype[id].name === resourceTypeName) {
      try {
        const resourceTypeData = importData.resourcetype[id];
        delete resourceTypeData._rev;
        try {
          response = await _createResourceType({ resourceTypeData, state });
        } catch (createError) {
          if (createError.response?.status === 409)
            response = await _putResourceType({
              resourceTypeUuid: id,
              resourceTypeData,
              state,
            });
          else throw createError;
        }
        imported.push(id);
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
      .join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(
      `Import error:\n${resourceTypeName} not found in import data!`
    );
  }
  return response;
}

/**
 * Import first resource type
 * @param {ResourceTypeExportInterface} importData import data
 */
export async function importFirstResourceType({
  importData,
  state,
}: {
  importData: ResourceTypeExportInterface;
  state: State;
}) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.resourcetype)) {
    try {
      const resourceTypeData = importData.resourcetype[id];
      delete resourceTypeData._provider;
      delete resourceTypeData._rev;
      try {
        response = await _createResourceType({ resourceTypeData, state });
      } catch (createError) {
        if (createError.response?.status === 409)
          response = await _putResourceType({
            resourceTypeUuid: id,
            resourceTypeData,
            state,
          });
        else throw createError;
      }
      imported.push(id);
    } catch (error) {
      errors.push(error);
    }
    break;
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
      .join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo resource types found in import data!`);
  }
  return response;
}

/**
 * Import resource types
 * @param {ResourceTypeExportInterface} importData import data
 */
export async function importResourceTypes({
  importData,
  state,
}: {
  importData: ResourceTypeExportInterface;
  state: State;
}) {
  const response = [];
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.resourcetype)) {
    try {
      const resourceTypeData = importData.resourcetype[id];
      delete resourceTypeData._rev;
      try {
        response.push(await _createResourceType({ resourceTypeData, state }));
      } catch (createError) {
        if (createError.response?.status === 409)
          response.push(
            await _putResourceType({
              resourceTypeUuid: id,
              resourceTypeData,
              state,
            })
          );
        else throw createError;
      }
      imported.push(id);
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
    throw new Error(`Import error:\nNo resource types found in import data!`);
  }
  return response;
}

export async function createResourceType({
  resourceTypeData,
  resourceTypeUuid,
  state,
}: {
  resourceTypeData: ResourceTypeSkeleton;
  resourceTypeUuid?: string;
  state: State;
}): Promise<ResourceTypeSkeleton> {
  if (resourceTypeUuid)
    return _putResourceType({
      resourceTypeUuid,
      resourceTypeData,
      failIfExists: true,
      state,
    });
  return _createResourceType({ resourceTypeData, state });
}
