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
import { getMetadata } from '../../utils/ExportImportUtils';
import { debugMessage } from '../../utils/Console';
import { getConfigEntity, putConfigEntity } from '../../api/IdmConfigApi';
import { State } from '../../shared/State';

export type AdminFederation = {
  /**
   * Create an empty idp export template
   * @returns {AdminFederationExportInterface} an empty idp export template
   */
  createAdminFederationExportTemplate(): AdminFederationExportInterface;
  /**
   * Read all admin federation providers
   * @returns {Promise} a promise that resolves to an object containing an array of admin federation providers
   */
  readAdminFederationProviders(): Promise<SocialIdpSkeleton[]>;
  /**
   * Read admin federation provider
   * @param {string} providerId social identity provider id/name
   * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social admin federation object
   */
  readAdminFederationProvider(providerId: string): Promise<SocialIdpSkeleton>;
  /**
   * Create admin federation provider
   * @param {string} providerType social identity provider type
   * @param {string} providerId social identity provider id/name
   * @param {SocialIdpSkeleton} providerData social identity provider data
   * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social admin federation object
   */
  createAdminFederationProvider(
    providerType: string,
    providerData: SocialIdpSkeleton,
    providerId?: string
  ): Promise<SocialIdpSkeleton>;
  /**
   * Update or create admin federation provider
   * @param {string} providerType social identity provider type
   * @param {string} providerId social identity provider id/name
   * @param {SocialIdpSkeleton} providerData social identity provider data
   * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social admin federation object
   */
  updateAdminFederationProvider(
    providerType: string,
    providerId: string,
    providerData: SocialIdpSkeleton
  ): Promise<SocialIdpSkeleton>;
  /**
   * Delete admin federation provider by id
   * @param {String} providerId admin federation provider id/name
   * @returns {Promise} a promise that resolves to an admin federation provider object
   */
  deleteAdminFederationProvider(providerId: string): Promise<SocialIdpSkeleton>;
  /**
   * Export admin federation provider by id
   * @param {string} providerId provider id/name
   * @returns {Promise<AdminFederationExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   */
  exportAdminFederationProvider(
    providerId: string
  ): Promise<AdminFederationExportInterface>;
  /**
   * Export all providers
   * @returns {Promise<AdminFederationExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   */
  exportAdminFederationProviders(): Promise<AdminFederationExportInterface>;
  /**
   * Import admin federation provider by id/name
   * @param {string} providerId provider id/name
   * @param {AdminFederationExportInterface} importData import data
   */
  importAdminFederationProvider(
    providerId: string,
    importData: AdminFederationExportInterface
  ): Promise<SocialIdpSkeleton>;
  /**
   * Import first provider
   * @param {AdminFederationExportInterface} importData import data
   */
  importFirstAdminFederationProvider(
    importData: AdminFederationExportInterface
  ): Promise<SocialIdpSkeleton>;
  /**
   * Import all providers
   * @param {AdminFederationExportInterface} importData import data
   */
  importAdminFederationProviders(
    importData: AdminFederationExportInterface
  ): Promise<SocialIdpSkeleton[]>;

  // Deprecated

  /**
   * Get all admin federation providers
   * @returns {Promise<SocialIdpSkeleton[]>} a promise that resolves to an object containing an array of admin federation providers
   * @deprecated since v2.0.0 use {@link AdminFederation.readAdminFederationProviders | readAdminFederationProviders} instead
   * ```javascript
   * readAdminFederationProviders(): Promise<SocialIdpSkeleton[]>
   * ```
   * @group Deprecated
   */
  getAdminFederationProviders(): Promise<SocialIdpSkeleton[]>;
  /**
   * Get admin federation provider
   * @param {String} providerId social identity provider id/name
   * @returns {Promise} a promise that resolves a social admin federation object
   * @deprecated since v2.0.0 use {@link AdminFederation.readAdminFederationProvider | readAdminFederationProvider} instead
   * ```javascript
   * readAdminFederationProvider(providerId: string): Promise<SocialIdpSkeleton>
   * ```
   * @group Deprecated
   */
  getAdminFederationProvider(providerId: string): Promise<SocialIdpSkeleton>;
  /**
   * Update or create admin federation provider
   * @param {string} providerType social identity provider type
   * @param {string} providerId social identity provider id/name
   * @param {SocialIdpSkeleton} providerData social identity provider data
   * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social admin federation object
   * @deprecated since v2.0.0 use {@link AdminFederation.updateAdminFederationProvider | updateAdminFederationProvider} instead
   * ```javascript
   * updateAdminFederationProvider(providerType: string, providerId: string, providerData: SocialIdpSkeleton): Promise<SocialIdpSkeleton>
   * ```
   * @group Deprecated
   */
  putProviderByTypeAndId(
    providerType: string,
    providerId: string,
    providerData: SocialIdpSkeleton
  ): Promise<SocialIdpSkeleton>;
};

export default (state: State): AdminFederation => {
  return {
    createAdminFederationExportTemplate(): AdminFederationExportInterface {
      return createAdminFederationExportTemplate({ state });
    },
    async readAdminFederationProviders(): Promise<SocialIdpSkeleton[]> {
      return readAdminFederationProviders({ state });
    },
    async readAdminFederationProvider(
      providerId: string
    ): Promise<SocialIdpSkeleton> {
      return readAdminFederationProvider({ providerId, state });
    },
    async createAdminFederationProvider(
      providerType: string,
      providerData: SocialIdpSkeleton,
      providerId?: string
    ): Promise<SocialIdpSkeleton> {
      return createAdminFederationProvider({
        providerType,
        providerId,
        providerData,
        state,
      });
    },
    async updateAdminFederationProvider(
      providerType: string,
      providerId: string,
      providerData: SocialIdpSkeleton
    ): Promise<SocialIdpSkeleton> {
      return updateAdminFederationProvider({
        providerType,
        providerId,
        providerData,
        state,
      });
    },
    async deleteAdminFederationProvider(
      providerId: string
    ): Promise<SocialIdpSkeleton> {
      return deleteAdminFederationProvider({ providerId, state });
    },
    async exportAdminFederationProvider(
      providerId: string
    ): Promise<AdminFederationExportInterface> {
      return exportAdminFederationProvider({ providerId, state });
    },
    async exportAdminFederationProviders(): Promise<AdminFederationExportInterface> {
      return exportAdminFederationProviders({ state });
    },
    async importAdminFederationProvider(
      providerId: string,
      importData: AdminFederationExportInterface
    ): Promise<SocialIdpSkeleton> {
      return importAdminFederationProvider({
        providerId,
        importData,
        state,
      });
    },
    async importFirstAdminFederationProvider(
      importData: AdminFederationExportInterface
    ): Promise<SocialIdpSkeleton> {
      return importFirstAdminFederationProvider({
        importData,
        state,
      });
    },
    async importAdminFederationProviders(
      importData: AdminFederationExportInterface
    ): Promise<SocialIdpSkeleton[]> {
      return importAdminFederationProviders({ importData, state });
    },

    // Deprecated

    async getAdminFederationProviders(): Promise<SocialIdpSkeleton[]> {
      return readAdminFederationProviders({ state });
    },
    async getAdminFederationProvider(
      providerId: string
    ): Promise<SocialIdpSkeleton> {
      return readAdminFederationProvider({ providerId, state });
    },
    async putProviderByTypeAndId(
      providerType: string,
      providerId: string,
      providerData: SocialIdpSkeleton
    ): Promise<SocialIdpSkeleton> {
      return updateAdminFederationProvider({
        providerType,
        providerId,
        providerData,
        state,
      });
    },
  };
};

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
 * @returns {Promise<SocialIdpSkeleton[]>} a promise that resolves to an object containing an array of admin federation providers
 */
export async function readAdminFederationProviders({
  state,
}: {
  state: State;
}): Promise<SocialIdpSkeleton[]> {
  const { result } = await _getAdminFederationProviders({ state });
  return result;
}

/**
 * Get admin federation provider by id
 * @param {String} providerId social identity provider id/name
 * @returns {Promise<SocialIdpSkeleton>} a promise that resolves a social admin federation object
 */
export async function readAdminFederationProvider({
  providerId,
  state,
}: {
  providerId: string;
  state: State;
}): Promise<SocialIdpSkeleton> {
  const response = await readAdminFederationProviders({ state });
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

export async function createAdminFederationProvider({
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
    message: `AdminFederationOps.createAdminFederationProvider: start`,
    state,
  });
  try {
    await readAdminFederationProvider({ providerId, state });
  } catch (error) {
    const result = await updateAdminFederationProvider({
      providerType,
      providerId,
      providerData,
      state,
    });
    debugMessage({
      message: `AdminFederationOps.createAdminFederationProvider: end`,
      state,
    });
    return result;
  }
  throw new Error(`Provider ${providerId} already exists!`);
}

export async function updateAdminFederationProvider({
  providerType,
  providerId,
  providerData,
  state,
}: {
  providerType: string;
  providerId: string;
  providerData: SocialIdpSkeleton;
  state: State;
}): Promise<SocialIdpSkeleton> {
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
  const response = await readAdminFederationProviders({ state });
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
    const idpData = await readAdminFederationProvider({ providerId, state });
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
    const allIdpsData = await readAdminFederationProviders({ state });
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
        response = await updateAdminFederationProvider({
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
      response = await updateAdminFederationProvider({
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
        await updateAdminFederationProvider({
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
