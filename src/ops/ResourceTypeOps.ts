import {
  deleteResourceType as _deleteResourceType,
  getResourceTypes as _getResourceTypes,
  getResourceType as _getResourceType,
  getResourceTypeByName as _getResourceTypeByName,
  putResourceType,
} from '../api/ResourceTypesApi';
import { ExportMetaData } from './OpsTypes';
import { ResourceTypeSkeleton } from '../api/ApiTypes';
import { getMetadata } from './utils/ExportImportUtils';
import { debugMessage } from './utils/Console';

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
 * Get resource type
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
      throw new Error(`Resource type '${resourceTypeName}' not found`);
    default:
      throw new Error(
        `${result.length} resource types '${resourceTypeName}' found`
      );
  }
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
 * Export resource type
 * @param {string} resourceTypeId resource type id
 * @returns {Promise<ResourceTypeExportInterface>} a promise that resolves to an ResourceTypeExportInterface object
 */
export async function exportResourceType(
  resourceTypeId: string
): Promise<ResourceTypeExportInterface> {
  debugMessage(`ResourceTypeOps.exportResourceType: start`);
  const exportData = createResourceTypeExportTemplate();
  const errors = [];
  try {
    const resourceTypeData = await getResourceType(resourceTypeId);
    exportData.resourcetype[resourceTypeData.uuid] = resourceTypeData;
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
 * Import resource type
 * @param {string} resourceTypeId client id
 * @param {ResourceTypeExportInterface} importData import data
 */
export async function importResourceType(
  resourceTypeId: string,
  importData: ResourceTypeExportInterface
) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.resourcetype)) {
    if (id === resourceTypeId) {
      try {
        const resourceTypeData = importData.resourcetype[id];
        delete resourceTypeData._rev;
        response = await putResourceType(id, resourceTypeData);
        imported.push(id);
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(
      `Import error:\n${resourceTypeId} not found in import data!`
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
      response = await putResourceType(id, resourceTypeData);
      imported.push(id);
    } catch (error) {
      errors.push(error);
    }
    break;
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
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
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.resourcetype)) {
    try {
      const resourceTypeData = importData.resourcetype[id];
      delete resourceTypeData._rev;
      response = await putResourceType(id, resourceTypeData);
      imported.push(id);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo resource types found in import data!`);
  }
  return response;
}
