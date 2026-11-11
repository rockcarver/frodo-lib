import {
  deleteProviderByTypeAndId as _deleteProviderByTypeAndId,
  getAdminFederationProviders as _getAdminFederationProviders,
  putProviderByTypeAndId as _putProviderByTypeAndId,
  type AdminFederationConfigSkeleton,
} from '../../api/cloud/AdminFederationProvidersApi';
import { getConfigEntity, putConfigEntity } from '../../api/IdmConfigApi';
import { SocialIdpSkeleton } from '../../api/SocialIdentityProvidersApi';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';
import { getMetadata } from '../../utils/ExportImportUtils';
import { FrodoError } from '../FrodoError';
import { ExportMetaData, ResultCallback } from '../OpsTypes';

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
   * @param {ResultCallback<SocialIdpSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every provider is passed to it as it happens: a provider that was exported with its configuration as the provider, a provider that cannot be exported as an error that names the provider and carries the cause. Such a provider is left out of the export and does not stop the others, and the function does not throw for it. Without it, the failures are collected and thrown as one error after every provider was tried. Failing to read the providers always throws.
   * @returns {Promise<AdminFederationExportInterface>} a promise that resolves to a SocialProviderExportInterface object
   */
  exportAdminFederationProviders(
    resultCallback?: ResultCallback<SocialIdpSkeleton>
  ): Promise<AdminFederationExportInterface>;
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
   * @param {ResultCallback<SocialIdpSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every provider is passed to it once, as it happens: a provider that was imported with its configuration as the provider, a provider that cannot be imported, or whose configuration cannot be imported, as one error that names the provider and carries the cause. Such a provider is not part of the result and does not stop the others, and the function does not throw for it. Without it, the failures are collected and thrown as one error after every provider was tried.
   */
  importAdminFederationProviders(
    importData: AdminFederationExportInterface,
    resultCallback?: ResultCallback<SocialIdpSkeleton>
  ): Promise<SocialIdpSkeleton[]>;
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
    async exportAdminFederationProviders(
      resultCallback: ResultCallback<SocialIdpSkeleton> = void 0
    ): Promise<AdminFederationExportInterface> {
      return exportAdminFederationProviders({ resultCallback, state });
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
      importData: AdminFederationExportInterface,
      resultCallback: ResultCallback<SocialIdpSkeleton> = void 0
    ): Promise<SocialIdpSkeleton[]> {
      return importAdminFederationProviders({
        importData,
        resultCallback,
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
  try {
    const { result } = await _getAdminFederationProviders({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading admin federation providers.`, error);
  }
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
      throw new FrodoError(
        `Admin federation provider '${providerId}' not found`
      );
    default:
      throw new FrodoError(
        `${foundProviders.length} admin federation providers '${providerId}' found`
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  throw new FrodoError(
    `Admin federation provider ${providerId} already exists!`
  );
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
      throw new FrodoError(
        `Error updating admin federation provider`,
        importError
      );
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
      return await _deleteProviderByTypeAndId({
        providerType: foundProviders[0]._type._id,
        providerId: foundProviders[0]._id,
        state,
      });
    case 0:
      throw new FrodoError(`Provider '${providerId}' not found`);
    default:
      throw new FrodoError(
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
    throw new FrodoError(
      `Error exporting admin federation provider ${providerId}`,
      errors
    );
  }
  debugMessage({
    message: `AdminFederationOps.exportAdminFederationProvider: end`,
    state,
  });
  return exportData;
}

/**
 * Export all providers
 * @param {ResultCallback<SocialIdpSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every provider is passed to it as it happens: a provider that was exported with its configuration as the provider, a provider that cannot be exported as an error that names the provider and carries the cause. Such a provider is left out of the export and does not stop the others, and the function does not throw for it. Without it, the failures are collected and thrown as one error after every provider was tried. Failing to read the providers always throws.
 * @returns {Promise<AdminFederationExportInterface>} a promise that resolves to a SocialProviderExportInterface object
 */
export async function exportAdminFederationProviders({
  resultCallback = void 0,
  state,
}: {
  resultCallback?: ResultCallback<SocialIdpSkeleton>;
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
      let failure: Error;
      try {
        const idpConfig = await getConfigEntity({
          entityId: `${ADMIN_FED_CONFIG_ID_PREFIX}${idpData._id}`,
          state,
        });
        // a provider without its configuration is not a complete export of the provider
        exportData.idp[idpData._id] = idpData;
        exportData.config[idpConfig._id] = idpConfig;
      } catch (error) {
        failure = error;
      }
      if (!failure) {
        if (resultCallback) resultCallback(undefined, idpData);
      } else if (resultCallback) {
        // the caller reports the failure: name the provider and keep the cause
        resultCallback(
          new FrodoError(
            `Error exporting admin federation provider ${idpData._id}`,
            failure
          )
        );
      } else {
        errors.push(failure);
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    throw new FrodoError(`Error exporting admin federation providers`, errors);
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
    throw new FrodoError(
      `Error importing admin federation provider ${providerId}`,
      errors
    );
  }
  if (0 === imported.length) {
    throw new FrodoError(
      `Admin federation provider ${providerId} not found in import data!`
    );
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
    throw new FrodoError(
      `Error importing first admin federation provider`,
      errors
    );
  }
  if (0 === imported.length) {
    throw new FrodoError(`No admin federation providers found in import data`);
  }
  return response;
}

/**
 * Import all providers
 * @param {AdminFederationExportInterface} importData import data
 * @param {ResultCallback<SocialIdpSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every provider is passed to it once, as it happens: a provider that was imported with its configuration as the provider, a provider that cannot be imported, or whose configuration cannot be imported, as one error that names the provider and carries the cause. Such a provider is not part of the result and does not stop the others, and the function does not throw for it. Without it, the failures are collected and thrown as one error after every provider was tried.
 */
export async function importAdminFederationProviders({
  importData,
  resultCallback = void 0,
  state,
}: {
  importData: AdminFederationExportInterface;
  resultCallback?: ResultCallback<SocialIdpSkeleton>;
  state: State;
}): Promise<SocialIdpSkeleton[]> {
  const response = [];
  const errors = [];
  for (const idpId of Object.keys(importData.idp)) {
    let imported: SocialIdpSkeleton;
    let failure: Error;
    try {
      imported = await updateAdminFederationProvider({
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
    } catch (error) {
      failure = error;
    }
    if (failure) {
      if (!resultCallback) {
        errors.push(failure);
      } else {
        // the caller reports the failure: name the provider and keep the cause
        resultCallback(
          new FrodoError(
            `Error importing admin federation provider ${idpId}`,
            failure
          )
        );
      }
    } else {
      // the provider is part of the result only if its configuration was imported too
      response.push(imported);
      if (resultCallback) resultCallback(undefined, imported);
    }
  }
  if (errors.length) {
    throw new FrodoError(`Error importing admin federation providers`, errors);
  }
  return response;
}
