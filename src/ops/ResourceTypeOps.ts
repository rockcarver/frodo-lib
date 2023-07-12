import {
  deleteResourceType,
  getResourceTypes as _getResourceTypes,
  getResourceType,
  getResourceTypeByName as _getResourceTypeByName,
  createResourceType,
  putResourceType,
} from '../api/ResourceTypesApi';
import { ExportMetaData } from './OpsTypes';
import { ResourceTypeSkeleton } from '../api/ApiTypes';
import { getMetadata } from './utils/ExportImportUtils';
import { debugMessage } from './utils/Console';
import State from '../shared/State';

export type ResourceType = {
  getResourceType(resourceTypeUuid: string): Promise<any>;
  /**
   * Get all resource types
   * @returns {Promise} a promise that resolves to an array of resource type objects
   */
  getResourceTypes(): Promise<ResourceTypeSkeleton[]>;
  /**
   * Get resource type by name
   * @param {string} resourceTypeName resource type name
   * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
   */
  getResourceTypeByName(
    resourceTypeName: string
  ): Promise<ResourceTypeSkeleton>;
  /**
   * Update resource type
   * @param {string} resourceTypeData resource type id
   * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
   */
  updateResourceType(
    resourceTypeUuid: string,
    resourceTypeData: ResourceTypeSkeleton
  ): Promise<ResourceTypeSkeleton>;
  deleteResourceType(resourceTypeUuid: string): Promise<any>;
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
};

export default (state: State): ResourceType => {
  return {
    async getResourceType(resourceTypeUuid: string) {
      return getResourceType({ resourceTypeUuid, state });
    },

    /**
     * Get all resource types
     * @returns {Promise} a promise that resolves to an array of resource type objects
     */
    async getResourceTypes(): Promise<ResourceTypeSkeleton[]> {
      const { result } = await _getResourceTypes({ state });
      return result;
    },

    /**
     * Get resource type by name
     * @param {string} resourceTypeName resource type name
     * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
     */
    async getResourceTypeByName(
      resourceTypeName: string
    ): Promise<ResourceTypeSkeleton> {
      return getResourceTypeByName({ resourceTypeName, state });
    },

    /**
     * Update resource type
     * @param {string} resourceTypeData resource type id
     * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
     */
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

    /**
     * Delete resource type by name
     * @param {string} resourceTypeName resource type name
     * @returns {Promise<ResourceTypeSkeleton>} Promise resolvig to a resource type object
     */
    async deleteResourceTypeByName(
      resourceTypeName: string
    ): Promise<ResourceTypeSkeleton> {
      return deleteResourceTypeByName({ resourceTypeName, state });
    },

    /**
     * Export resource type
     * @param {string} resourceTypeUuid resource type uuid
     * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
     */
    async exportResourceType(
      resourceTypeUuid: string
    ): Promise<ResourceTypeExportInterface> {
      return exportResourceType({ resourceTypeUuid, state });
    },

    /**
     * Export resource type by name
     * @param {string} resourceTypeName resource type name
     * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
     */
    async exportResourceTypeByName(
      resourceTypeName: string
    ): Promise<ResourceTypeExportInterface> {
      return exportResourceTypeByName({ resourceTypeName, state });
    },

    /**
     * Export resource types
     * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
     */
    async exportResourceTypes(): Promise<ResourceTypeExportInterface> {
      return exportResourceTypes({ state });
    },

    /**
     * Import resource type by uuid
     * @param {string} resourceTypeUuid client uuid
     * @param {ResourceTypeExportInterface} importData import data
     */
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

    /**
     * Import resource type by name
     * @param {string} resourceTypeName client id
     * @param {ResourceTypeExportInterface} importData import data
     */
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

    /**
     * Import first resource type
     * @param {ResourceTypeExportInterface} importData import data
     */
    async importFirstResourceType(importData: ResourceTypeExportInterface) {
      return importFirstResourceType({ importData, state });
    },

    /**
     * Import resource types
     * @param {ResourceTypeExportInterface} importData import data
     */
    async importResourceTypes(importData: ResourceTypeExportInterface) {
      return importResourceTypes({ importData, state });
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
function createResourceTypeExportTemplate({
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

/**
 * Get all resource types
 * @returns {Promise} a promise that resolves to an array of resource type objects
 */
export async function getResourceTypes({
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
export async function getResourceTypeByName({
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
  return putResourceType({ resourceTypeUuid, resourceTypeData, state });
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
    await getResourceTypeByName({ resourceTypeName, state })
  ).uuid;
  return deleteResourceType({ resourceTypeUuid, state });
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
    const resourceTypeData = await getResourceType({
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
    const resourceTypeData = await getResourceTypeByName({
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
    const resourceTypes = await getResourceTypes({ state });
    for (const resourceTypeData of resourceTypes) {
      exportData.resourcetype[resourceTypeData.uuid] = resourceTypeData;
    }
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
          response = await createResourceType({ resourceTypeData, state });
        } catch (createError) {
          if (createError.response?.status === 409)
            response = await putResourceType({
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
          response = await createResourceType({ resourceTypeData, state });
        } catch (createError) {
          if (createError.response?.status === 409)
            response = await putResourceType({
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
        response = await createResourceType({ resourceTypeData, state });
      } catch (createError) {
        if (createError.response?.status === 409)
          response = await putResourceType({
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
        response.push(await createResourceType({ resourceTypeData, state }));
      } catch (createError) {
        if (createError.response?.status === 409)
          response.push(
            await putResourceType({
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

export { getResourceType, createResourceType, deleteResourceType };
