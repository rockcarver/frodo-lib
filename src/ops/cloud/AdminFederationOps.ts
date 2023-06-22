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
import State from '../../shared/State';

export default class AdminFederationOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  /**
   * Create an empty idp export template
   * @returns {AdminFederationExportInterface} an empty idp export template
   */
  createAdminFederationExportTemplate(): AdminFederationExportInterface {
    return createAdminFederationExportTemplate({ state: this.state });
  }

  /**
   * Get all admin federation providers
   * @returns {Promise} a promise that resolves to an object containing an array of admin federation providers
   */
  async getAdminFederationProviders() {
    return getAdminFederationProviders({ state: this.state });
  }

  /**
   * Get admin federation provider by id
   * @param {String} providerId social identity provider id/name
   * @returns {Promise} a promise that resolves a social admin federation object
   */
  async getAdminFederationProvider(providerId: string) {
    return getAdminFederationProvider({ providerId, state: this.state });
  }

  async putProviderByTypeAndId(
    providerType: string,
    providerId: string,
    providerData: SocialIdpSkeleton
  ) {
    return putProviderByTypeAndId({
      providerType,
      providerId,
      providerData,
      state: this.state,
    });
  }

  /**
   * Delete admin federation provider by id
   * @param {String} providerId admin federation provider id/name
   * @returns {Promise} a promise that resolves to an admin federation provider object
   */
  async deleteAdminFederationProvider(
    providerId: string
  ): Promise<SocialIdpSkeleton> {
    return deleteAdminFederationProvider({ providerId, state: this.state });
  }

  /**
   * Export admin federation provider by id
   * @param {string} providerId provider id/name
   * @returns {Promise<AdminFederationExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   */
  async exportAdminFederationProvider(
    providerId: string
  ): Promise<AdminFederationExportInterface> {
    return exportAdminFederationProvider({ providerId, state: this.state });
  }

  /**
   * Export all providers
   * @returns {Promise<AdminFederationExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   */
  async exportAdminFederationProviders(): Promise<AdminFederationExportInterface> {
    return exportAdminFederationProviders({ state: this.state });
  }

  /**
   * Import admin federation provider by id/name
   * @param {string} providerId provider id/name
   * @param {AdminFederationExportInterface} importData import data
   */
  async importAdminFederationProvider(
    providerId: string,
    importData: AdminFederationExportInterface
  ): Promise<SocialIdpSkeleton> {
    return importAdminFederationProvider({
      providerId,
      importData,
      state: this.state,
    });
  }

  /**
   * Import first provider
   * @param {AdminFederationExportInterface} importData import data
   */
  async importFirstAdminFederationProvider(
    importData: AdminFederationExportInterface
  ): Promise<SocialIdpSkeleton> {
    return importFirstAdminFederationProvider({
      importData,
      state: this.state,
    });
  }

  /**
   * Import all providers
   * @param {AdminFederationExportInterface} importData import data
   */
  async importAdminFederationProviders(
    importData: AdminFederationExportInterface
  ): Promise<SocialIdpSkeleton[]> {
    return importAdminFederationProviders({ importData, state: this.state });
  }
}

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
export function createAdminFederationExportTemplate({
  state,
}: {
  state: State;
}): AdminFederationExportInterface {
  return {
    meta: getMetadata({ state }),
    config: {},
    idp: {},
  } as AdminFederationExportInterface;
}

/**
 * Get all admin federation providers
 * @returns {Promise} a promise that resolves to an object containing an array of admin federation providers
 */
export async function getAdminFederationProviders({ state }: { state: State }) {
  const { result } = await _getAdminFederationProviders({ state });
  return result;
}

/**
 * Get admin federation provider by id
 * @param {String} providerId social identity provider id/name
 * @returns {Promise} a promise that resolves a social admin federation object
 */
export async function getAdminFederationProvider({
  providerId,
  state,
}: {
  providerId: string;
  state: State;
}) {
  const response = await getAdminFederationProviders({ state });
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

export async function putProviderByTypeAndId({
  providerType,
  providerId,
  providerData,
  state,
}: {
  providerType: string;
  providerId: string;
  providerData: SocialIdpSkeleton;
  state: State;
}) {
  debugMessage({
    message: `AdminFederationOps.putProviderByTypeAndId: start`,
    state,
  });
  try {
    const response = await _putProviderByTypeAndId({
      providerType,
      providerId,
      providerData,
      state,
    });
    debugMessage({
      message: `AdminFederationOps.putProviderByTypeAndId: end`,
      state,
    });
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
          debugMessage({
            message: `Removing invalid attribute: ${attribute}`,
            state,
          });
          delete providerData[attribute];
        }
      }
      const response = await _putProviderByTypeAndId({
        providerType,
        providerId,
        providerData,
        state,
      });
      debugMessage({
        message: `AdminFederationOps.putProviderByTypeAndId: end (after retry)`,
        state,
      });
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
 * @returns {Promise<SocialIdpSkeleton>} a promise that resolves to an admin federation provider object
 */
export async function deleteAdminFederationProvider({
  providerId,
  state,
}: {
  providerId: string;
  state: State;
}): Promise<SocialIdpSkeleton> {
  const response = await getAdminFederationProviders({ state });
  const foundProviders = response.filter(
    (provider) => provider._id === providerId
  );
  switch (foundProviders.length) {
    case 1:
      return await deleteProviderByTypeAndId({
        providerType: foundProviders[0]._type._id,
        providerId: foundProviders[0]._id,
        state,
      });
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
export async function exportAdminFederationProvider({
  providerId,
  state,
}: {
  providerId: string;
  state: State;
}): Promise<AdminFederationExportInterface> {
  debugMessage({
    message: `AdminFederationOps.exportAdminFederationProvider: start`,
    state,
  });
  const exportData = createAdminFederationExportTemplate({ state });
  const errors = [];
  try {
    const idpData = await getAdminFederationProvider({ providerId, state });
    exportData.idp[idpData._id] = idpData;
    const idpConfig = await getConfigEntity({
      entityId: `${ADMIN_FED_CONFIG_ID_PREFIX}${providerId}`,
      state,
    });
    exportData.config[idpConfig._id] = idpConfig;
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({
    message: `AdminFederationOps.exportAdminFederationProvider: end`,
    state,
  });
  return exportData;
}

/**
 * Export all providers
 * @returns {Promise<AdminFederationExportInterface>} a promise that resolves to a SocialProviderExportInterface object
 */
export async function exportAdminFederationProviders({
  state,
}: {
  state: State;
}): Promise<AdminFederationExportInterface> {
  debugMessage({
    message: `AdminFederationOps.exportAdminFederationProviders: start`,
    state,
  });
  const exportData = createAdminFederationExportTemplate({ state });
  const errors = [];
  try {
    const allIdpsData = await getAdminFederationProviders({ state });
    for (const idpData of allIdpsData) {
      try {
        exportData.idp[idpData._id] = idpData;
        const idpConfig = await getConfigEntity({
          entityId: `${ADMIN_FED_CONFIG_ID_PREFIX}${idpData._id}`,
          state,
        });
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
  debugMessage({
    message: `AdminFederationOps.exportAdminFederationProviders: end`,
    state,
  });
  return exportData;
}

/**
 * Import admin federation provider by id/name
 * @param {string} providerId provider id/name
 * @param {AdminFederationExportInterface} importData import data
 */
export async function importAdminFederationProvider({
  providerId,
  importData,
  state,
}: {
  providerId: string;
  importData: AdminFederationExportInterface;
  state: State;
}): Promise<SocialIdpSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const idpId of Object.keys(importData.idp)) {
    if (idpId === providerId) {
      try {
        response = await putProviderByTypeAndId({
          providerType: importData.idp[idpId]._type._id,
          providerId: idpId,
          providerData: importData.idp[idpId],
          state,
        });
        const configId = `${ADMIN_FED_CONFIG_ID_PREFIX}${idpId}`;
        if (importData.config[configId]) {
          await putConfigEntity({
            entityId: configId,
            entityData: importData.config[configId],
            state,
          });
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
export async function importFirstAdminFederationProvider({
  importData,
  state,
}: {
  importData: AdminFederationExportInterface;
  state: State;
}): Promise<SocialIdpSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const idpId of Object.keys(importData.idp)) {
    try {
      response = await putProviderByTypeAndId({
        providerType: importData.idp[idpId]._type._id,
        providerId: idpId,
        providerData: importData.idp[idpId],
        state,
      });
      const configId = `${ADMIN_FED_CONFIG_ID_PREFIX}${idpId}`;
      if (importData.config[configId]) {
        await putConfigEntity({
          entityId: configId,
          entityData: importData.config[configId],
          state,
        });
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
export async function importAdminFederationProviders({
  importData,
  state,
}: {
  importData: AdminFederationExportInterface;
  state: State;
}): Promise<SocialIdpSkeleton[]> {
  const response = [];
  const errors = [];
  const imported = [];
  for (const idpId of Object.keys(importData.idp)) {
    try {
      response.push(
        await putProviderByTypeAndId({
          providerType: importData.idp[idpId]._type._id,
          providerId: idpId,
          providerData: importData.idp[idpId],
          state,
        })
      );
      const configId = `${ADMIN_FED_CONFIG_ID_PREFIX}${idpId}`;
      if (importData.config[configId]) {
        await putConfigEntity({
          entityId: configId,
          entityData: importData.config[configId],
          state,
        });
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
