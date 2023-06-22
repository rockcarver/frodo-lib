import {
  deleteProviderByTypeAndId,
  getAdminFederationProviders as _getAdminFederationProviders,
  putProviderByTypeAndId as _putProviderByTypeAndId,
} from '../../api/cloud/AdminFederationProvidersApi';
import { ExportMetaData } from '../OpsTypes';
import {
  AdminFederationConfigSkeleton,
  SocialIdpSkeleton,
} from '../../api/ApiTypes';
import { getMetadata } from '../utils/ExportImportUtils';
import { debugMessage } from '../utils/Console';
import { getConfigEntity, putConfigEntity } from '../../api/IdmConfigApi';

export interface AdminFederationExportInterface {
  meta?: ExportMetaData;
  config: Record<string, AdminFederationConfigSkeleton>;
  idp: Record<string, SocialIdpSkeleton>;
}

const ADMIN_FED_CONFIG_ID_PREFIX = 'fidc/federation-';

/**
 * Create an empty idp export template
 * @returns {AdminFederationExportInterface} an empty idp export template
 */
function createAdminFederationExportTemplate(): AdminFederationExportInterface {
  return {
    meta: getMetadata(),
    config: {},
    idp: {},
  } as AdminFederationExportInterface;
}

/**
 * Get all admin federation providers
 * @returns {Promise} a promise that resolves to an object containing an array of admin federation providers
 */
export async function getAdminFederationProviders() {
  const { result } = await _getAdminFederationProviders();
  return result;
}

/**
 * Get admin federation provider by id
 * @param {String} providerId social identity provider id/name
 * @returns {Promise} a promise that resolves a social admin federation object
 */
export async function getAdminFederationProvider(providerId) {
  const response = await getAdminFederationProviders();
  const foundProviders = response.filter(
    (provider) => provider._id === providerId
  );
  switch (foundProviders.length) {
    case 1:
      return foundProviders[0];
    case 0:
      throw new Error(`Provider '${providerId}' not found`);
    default:
      throw new Error(
        `${foundProviders.length} providers '${providerId}' found`
      );
  }
}

export async function putProviderByTypeAndId(
  providerType: string,
  providerId: string,
  providerData: object
) {
  debugMessage(`AdminFederationOps.putProviderByTypeAndId: start`);
  try {
    const response = await _putProviderByTypeAndId(
      providerType,
      providerId,
      providerData
    );
    debugMessage(`AdminFederationOps.putProviderByTypeAndId: end`);
    return response;
  } catch (importError) {
    if (
      importError.response?.status === 400 &&
      importError.response?.data?.message === 'Invalid attribute specified.'
    ) {
      const { validAttributes } = importError.response.data.detail;
      validAttributes.push('_id', '_type');
      for (const attribute of Object.keys(providerData)) {
        if (!validAttributes.includes(attribute)) {
          debugMessage(`Removing invalid attribute: ${attribute}`);
          delete providerData[attribute];
        }
      }
      const response = await _putProviderByTypeAndId(
        providerType,
        providerId,
        providerData
      );
      debugMessage(
        `AdminFederationOps.putProviderByTypeAndId: end (after retry)`
      );
      return response;
    } else {
      // re-throw unhandleable error
      throw importError;
    }
  }
}

/**
 * Delete admin federation provider by id
 * @param {String} providerId admin federation provider id/name
 * @returns {Promise} a promise that resolves to an admin federation provider object
 */
export async function deleteAdminFederationProvider(
  providerId: string
): Promise<unknown> {
  const response = await getAdminFederationProviders();
  const foundProviders = response.filter(
    (provider) => provider._id === providerId
  );
  switch (foundProviders.length) {
    case 1:
      return await deleteProviderByTypeAndId(
        foundProviders[0]._type._id,
        foundProviders[0]._id
      );
    case 0:
      throw new Error(`Provider '${providerId}' not found`);
    default:
      throw new Error(
        `${foundProviders.length} providers '${providerId}' found`
      );
  }
}

/**
 * Export admin federation provider by id
 * @param {string} providerId provider id/name
 * @returns {Promise<AdminFederationExportInterface>} a promise that resolves to a SocialProviderExportInterface object
 */
export async function exportAdminFederationProvider(
  providerId: string
): Promise<AdminFederationExportInterface> {
  debugMessage(`AdminFederationOps.exportAdminFederationProvider: start`);
  const exportData = createAdminFederationExportTemplate();
  const errors = [];
  try {
    const idpData = await getAdminFederationProvider(providerId);
    exportData.idp[idpData._id] = idpData;
    const idpConfig = await getConfigEntity(
      `${ADMIN_FED_CONFIG_ID_PREFIX}${providerId}`
    );
    exportData.config[idpConfig._id] = idpConfig;
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage(`AdminFederationOps.exportAdminFederationProvider: end`);
  return exportData;
}

/**
 * Export all providers
 * @returns {Promise<AdminFederationExportInterface>} a promise that resolves to a SocialProviderExportInterface object
 */
export async function exportAdminFederationProviders(): Promise<AdminFederationExportInterface> {
  debugMessage(`AdminFederationOps.exportAdminFederationProviders: start`);
  const exportData = createAdminFederationExportTemplate();
  const errors = [];
  try {
    const allIdpsData = await getAdminFederationProviders();
    for (const idpData of allIdpsData) {
      try {
        exportData.idp[idpData._id] = idpData;
        const idpConfig = await getConfigEntity(
          `${ADMIN_FED_CONFIG_ID_PREFIX}${idpData._id}`
        );
        exportData.config[idpConfig._id] = idpConfig;
      } catch (error) {
        errors.push(error);
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage(`AdminFederationOps.exportAdminFederationProviders: end`);
  return exportData;
}

/**
 * Import admin federation provider by id/name
 * @param {string} providerId provider id/name
 * @param {AdminFederationExportInterface} importData import data
 */
export async function importAdminFederationProvider(
  providerId: string,
  importData: AdminFederationExportInterface
): Promise<SocialIdpSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const idpId of Object.keys(importData.idp)) {
    if (idpId === providerId) {
      try {
        response = await putProviderByTypeAndId(
          importData.idp[idpId]._type._id,
          idpId,
          importData.idp[idpId]
        );
        const configId = `${ADMIN_FED_CONFIG_ID_PREFIX}${idpId}`;
        if (importData.config[configId]) {
          await putConfigEntity(configId, importData.config[configId]);
        }
        imported.push(idpId);
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
    throw new Error(`Import error:\n${providerId} not found in import data!`);
  }
  return response;
}

/**
 * Import first provider
 * @param {AdminFederationExportInterface} importData import data
 */
export async function importFirstAdminFederationProvider(
  importData: AdminFederationExportInterface
): Promise<SocialIdpSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const idpId of Object.keys(importData.idp)) {
    try {
      response = await putProviderByTypeAndId(
        importData.idp[idpId]._type._id,
        idpId,
        importData.idp[idpId]
      );
      const configId = `${ADMIN_FED_CONFIG_ID_PREFIX}${idpId}`;
      if (importData.config[configId]) {
        await putConfigEntity(configId, importData.config[configId]);
      }
      imported.push(idpId);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo providers found in import data!`);
  }
  return response;
}

/**
 * Import all providers
 * @param {AdminFederationExportInterface} importData import data
 */
export async function importAdminFederationProviders(
  importData: AdminFederationExportInterface
): Promise<SocialIdpSkeleton[]> {
  const response = [];
  const errors = [];
  const imported = [];
  for (const idpId of Object.keys(importData.idp)) {
    try {
      response.push(
        await putProviderByTypeAndId(
          importData.idp[idpId]._type._id,
          idpId,
          importData.idp[idpId]
        )
      );
      const configId = `${ADMIN_FED_CONFIG_ID_PREFIX}${idpId}`;
      if (importData.config[configId]) {
        await putConfigEntity(configId, importData.config[configId]);
      }
      imported.push(idpId);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo providers found in import data!`);
  }
  return response;
}
