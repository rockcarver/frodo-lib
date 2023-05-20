import {
  deleteResourceType as _deleteResourceType,
  getResourceTypes as _getResourceTypes,
  getResourceType as _getResourceType,
  getResourceTypeByName as _getResourceTypeByName,
  createResourceType as _createResourceType,
  putResourceType,
} from '../api/ResourceTypesApi';
import { ExportMetaData } from './OpsTypes';
import { ResourceTypeSkeleton } from '../api/ApiTypes';
import { getMetadata } from './utils/ExportImportUtils';
import { debugMessage } from './utils/Console';
import { state } from '..';

export interface ResourceTypeExportInterface {
  meta?: ExportMetaData;
  resourcetype: Record<string, ResourceTypeSkeleton>;
}

/**
 * Create an empty export template
 * @returns {ResourceTypeExportInterface} an empty export template
 */
function createResourceTypeExportTemplate(): ResourceTypeExportInterface {
  return {
    meta: getMetadata(),
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
export async function getResourceTypes(): Promise<ResourceTypeSkeleton[]> {
  const { result } = await _getResourceTypes();
  return result;
}

/**
 * Get resource type
 * @param {string} resourceTypeId resource type id
 * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
 */
export async function getResourceType(
  resourceTypeId: string
): Promise<ResourceTypeSkeleton> {
  return _getResourceType(resourceTypeId);
}

/**
 * Get resource type by name
 * @param {string} resourceTypeName resource type name
 * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
 */
export async function getResourceTypeByName(
  resourceTypeName: string
): Promise<ResourceTypeSkeleton> {
  const { result } = await _getResourceTypeByName(resourceTypeName);
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
 * Create resource type
 * @param {string} resourceTypeData resource type id
 * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
 */
export async function createResourceType(
  resourceTypeData: ResourceTypeSkeleton
): Promise<ResourceTypeSkeleton> {
  return _createResourceType(resourceTypeData);
}

/**
 * Update resource type
 * @param {string} resourceTypeData resource type id
 * @returns {Promise<ResourceTypeSkeleton>} a promise that resolves to a resource type object
 */
export async function updateResourceType(
  resourceTypeUuid: string,
  resourceTypeData: ResourceTypeSkeleton
): Promise<ResourceTypeSkeleton> {
  return putResourceType(resourceTypeUuid, resourceTypeData);
}

/**
 * Delete resource type
 * @param {string} resourceTypeId resource type id
 * @returns {Promise<ResourceTypeSkeleton>} Promise resolvig to a resource type object
 */
export async function deleteResourceType(
  resourceTypeId: string
): Promise<ResourceTypeSkeleton> {
  return _deleteResourceType(resourceTypeId);
}

/**
 * Delete resource type by name
 * @param {string} resourceTypeName resource type name
 * @returns {Promise<ResourceTypeSkeleton>} Promise resolvig to a resource type object
 */
export async function deleteResourceTypeByName(
  resourceTypeName: string
): Promise<ResourceTypeSkeleton> {
  const resourceTypeUuid = (await getResourceTypeByName(resourceTypeName)).uuid;
  return _deleteResourceType(resourceTypeUuid);
}

/**
 * Export resource type
 * @param {string} resourceTypeUuid resource type uuid
 * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
 */
export async function exportResourceType(
  resourceTypeUuid: string
): Promise<ResourceTypeExportInterface> {
  debugMessage(`ResourceTypeOps.exportResourceType: start`);
  const exportData = createResourceTypeExportTemplate();
  const errors = [];
  try {
    const resourceTypeData = await getResourceType(resourceTypeUuid);
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
  debugMessage(`ResourceTypeOps.exportResourceType: end`);
  return exportData;
}

/**
 * Export resource type by name
 * @param {string} resourceTypeName resource type name
 * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
 */
export async function exportResourceTypeByName(
  resourceTypeName: string
): Promise<ResourceTypeExportInterface> {
  debugMessage(`ResourceTypeOps.exportResourceTypeByName: start`);
  const exportData = createResourceTypeExportTemplate();
  const errors = [];
  try {
    const resourceTypeData = await getResourceTypeByName(resourceTypeName);
    exportData.resourcetype[resourceTypeData.uuid] = resourceTypeData;
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage(`ResourceTypeOps.exportResourceTypeByName: end`);
  return exportData;
}

/**
 * Export resource types
 * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
 */
export async function exportResourceTypes(): Promise<ResourceTypeExportInterface> {
  debugMessage(`ResourceTypeOps.exportResourceType: start`);
  const exportData = createResourceTypeExportTemplate();
  const errors = [];
  try {
    const resourceTypes = await getResourceTypes();
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
  debugMessage(`ResourceTypeOps.exportResourceType: end`);
  return exportData;
}

/**
 * Import resource type by uuid
 * @param {string} resourceTypeUuid client uuid
 * @param {ResourceTypeExportInterface} importData import data
 */
export async function importResourceType(
  resourceTypeUuid: string,
  importData: ResourceTypeExportInterface
) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.resourcetype)) {
    if (id === resourceTypeUuid) {
      try {
        const resourceTypeData = importData.resourcetype[id];
        delete resourceTypeData._rev;
        try {
          response = await createResourceType(resourceTypeData);
        } catch (createError) {
          if (createError.response?.status === 409)
            response = await putResourceType(id, resourceTypeData);
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
export async function importResourceTypeByName(
  resourceTypeName: string,
  importData: ResourceTypeExportInterface
) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.resourcetype)) {
    if (importData.resourcetype[id].name === resourceTypeName) {
      try {
        const resourceTypeData = importData.resourcetype[id];
        delete resourceTypeData._rev;
        try {
          response = await createResourceType(resourceTypeData);
        } catch (createError) {
          if (createError.response?.status === 409)
            response = await putResourceType(id, resourceTypeData);
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
export async function importFirstResourceType(
  importData: ResourceTypeExportInterface
) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.resourcetype)) {
    try {
      const resourceTypeData = importData.resourcetype[id];
      delete resourceTypeData._provider;
      delete resourceTypeData._rev;
      try {
        response = await createResourceType(resourceTypeData);
      } catch (createError) {
        if (createError.response?.status === 409)
          response = await putResourceType(id, resourceTypeData);
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
export async function importResourceTypes(
  importData: ResourceTypeExportInterface
) {
  const response = [];
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.resourcetype)) {
    try {
      const resourceTypeData = importData.resourcetype[id];
      delete resourceTypeData._rev;
      try {
        response.push(await createResourceType(resourceTypeData));
      } catch (createError) {
        if (createError.response?.status === 409)
          response.push(await putResourceType(id, resourceTypeData));
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
