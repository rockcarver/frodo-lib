import {
  getSecretStore,
  getSecretStoreMappings,
  getSecretStores,
  putSecretStore,
  putSecretStoreMapping,
  SecretStoreMappingSkeleton,
  SecretStoreSkeleton,
} from '../../api/classic/SecretStoreApi';
import Constants from '../../shared/Constants';
import { State } from '../../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../../utils/Console';
import { getMetadata } from '../../utils/ExportImportUtils';
import { FrodoError } from '../FrodoError';
import { ExportMetaData } from '../OpsTypes';

export type SecretStore = {
  /**
   * Create an empty secret store export template
   * @returns {SecretStoreExportInterface} an empty secret store export template
   */
  createSecretStoreExportTemplate(): SecretStoreExportInterface;
  /**
   * Read secret store by id
   * @param {string} secretStoreId Secret store id
   * @param {string} secretStoreTypeId Secret store type id
   * @param {boolean} globalConfig true if global secret store is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<SecretStoreSkeleton>} a promise that resolves to a secret store object
   */
  readSecretStore(
    secretStoreId: string,
    secretStoreTypeId: string,
    globalConfig: boolean
  ): Promise<SecretStoreSkeleton>;
  /**
   * Read all secret stores.
   * @param {boolean} globalConfig true if global secret stores are the target of the operation, false otherwise. Default: false.
   * @returns {Promise<SecretStoreSkeleton[]>} a promise that resolves to an array of secret store objects
   */
  readSecretStores(globalConfig: boolean): Promise<SecretStoreSkeleton[]>;
  /**
   * Read secret store mappings
   * @param {string} secretStoreId Secret store id
   * @param {string} secretStoreTypeId Secret store type id
   * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
   * @returns {Promise<SecretStoreMappingSkeleton[]>} a promise that resolves to an array of secret store mapping objects
   */
  readSecretStoreMappings(
    secretStoreId: string,
    secretStoreTypeId: string,
    globalConfig: boolean
  ): Promise<SecretStoreMappingSkeleton[]>;
  /**
   * Export a single secret store by id. The response can be saved to file as is.
   * @param {string} secretStoreId Secret store id
   * @param {string} secretStoreTypeId Secret store type id
   * @param {boolean} globalConfig true if global secret store is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<SecretStoreExportInterface>} Promise resolving to a SecretStoreExportInterface object.
   */
  exportSecretStore(
    secretStoreId: string,
    secretStoreTypeId: string,
    globalConfig: boolean
  ): Promise<SecretStoreExportInterface>;
  /**
   * Export all secret stores. The response can be saved to file as is.
   * @param {boolean} globalConfig true if global secret stores are the target of the operation, false otherwise. Default: false.
   * @returns {Promise<SecretStoreExportInterface>} Promise resolving to a SecretStoreExportInterface object.
   */
  exportSecretStores(
    globalConfig: boolean
  ): Promise<SecretStoreExportInterface>;
  /**
   * Update secret store
   * @param {SecretStoreSkeleton} secretStoreData secret store to import
   * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
   * @returns {Promise<SecretStoreSkeleton>} a promise that resolves to a secret store object
   */
  updateSecretStore(
    secretStoreData: SecretStoreSkeleton,
    globalConfig: boolean
  ): Promise<SecretStoreSkeleton>;
  /**
   * Update secret store mapping
   * @param {string} secretStoreId Secret store id
   * @param {string} secretStoreTypeId Secret store type id
   * @param {SecretStoreMappingSkeleton} secretStoreMappingData secret store mapping to import
   * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
   * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to a secret store mapping object
   */
  updateSecretStoreMapping(
    secretStoreId: string,
    secretStoreTypeId: string,
    secretStoreMappingData: SecretStoreMappingSkeleton,
    globalConfig: boolean
  ): Promise<SecretStoreMappingSkeleton>;
  /**
   * Import secret stores and mappings
   * @param {SecretStoreExportInterface} importData secret store import data
   * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
   * @param {string} secretStoreId optional secret store id. If supplied, only the secret store of that id is imported.
   * @returns {Promise<SecretStoreExportSkeleton[]>} the imported secret stores and mappings
   */
  importSecretStores(
    importData: SecretStoreExportInterface,
    globalConfig: boolean,
    secretStoreId?: string
  ): Promise<SecretStoreExportSkeleton[]>;
};

export default (state: State): SecretStore => {
  return {
    createSecretStoreExportTemplate(): SecretStoreExportInterface {
      return createSecretStoreExportTemplate({ state });
    },
    async readSecretStore(
      secretStoreId: string,
      secretStoreTypeId: string,
      globalConfig: boolean = false
    ): Promise<SecretStoreSkeleton> {
      return readSecretStore({
        secretStoreId,
        secretStoreTypeId,
        globalConfig,
        state,
      });
    },
    async readSecretStores(
      globalConfig: boolean = false
    ): Promise<SecretStoreSkeleton[]> {
      return readSecretStores({ globalConfig, state });
    },
    async readSecretStoreMappings(
      secretStoreId: string,
      secretStoreTypeId: string,
      globalConfig: boolean = false
    ): Promise<SecretStoreMappingSkeleton[]> {
      return readSecretStoreMappings({
        secretStoreId,
        secretStoreTypeId,
        globalConfig,
        state,
      });
    },
    async exportSecretStore(
      secretStoreId: string,
      secretStoreTypeId: string,
      globalConfig: boolean = false
    ): Promise<SecretStoreExportInterface> {
      return exportSecretStore({
        secretStoreId,
        secretStoreTypeId,
        globalConfig,
        state,
      });
    },
    async exportSecretStores(
      globalConfig: boolean = false
    ): Promise<SecretStoreExportInterface> {
      return exportSecretStores({ globalConfig, state });
    },
    async updateSecretStore(
      secretStoreData: SecretStoreSkeleton,
      globalConfig: boolean = false
    ): Promise<SecretStoreSkeleton> {
      return updateSecretStore({
        secretStoreData,
        globalConfig,
        state,
      });
    },
    async updateSecretStoreMapping(
      secretStoreId: string,
      secretStoreTypeId: string,
      secretStoreMappingData: SecretStoreMappingSkeleton,
      globalConfig: boolean = false
    ): Promise<SecretStoreMappingSkeleton> {
      return updateSecretStoreMapping({
        secretStoreId,
        secretStoreTypeId,
        secretStoreMappingData,
        globalConfig,
        state,
      });
    },
    async importSecretStores(
      importData: SecretStoreExportInterface,
      globalConfig: boolean = false,
      secretStoreId?: string
    ): Promise<SecretStoreExportSkeleton[]> {
      return importSecretStores({
        importData,
        globalConfig,
        secretStoreId,
        state,
      });
    },
  };
};

export type SecretStoreExportSkeleton = SecretStoreSkeleton & {
  mappings: SecretStoreMappingSkeleton[];
};

export interface SecretStoreExportInterface {
  meta?: ExportMetaData;
  secretstore: Record<string, SecretStoreExportSkeleton>;
}

/**
 * Create an empty secret store export template
 * @returns {SecretStoreExportInterface} an empty secret store export template
 */
export function createSecretStoreExportTemplate({
  state,
}: {
  state: State;
}): SecretStoreExportInterface {
  return {
    meta: getMetadata({ state }),
    secretstore: {},
  };
}

/**
 * Read secret store by id
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {boolean} globalConfig true if global secret store is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<SecretStoreSkeleton>} a promise that resolves to a secret store object
 */
export async function readSecretStore({
  secretStoreId,
  secretStoreTypeId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreSkeleton> {
  try {
    return await getSecretStore({
      secretStoreId,
      secretStoreTypeId,
      globalConfig,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error reading secret store ${secretStoreId} of type ${secretStoreTypeId}`,
      error
    );
  }
}

/**
 * Read all secret stores.
 * @param {boolean} globalConfig true if global secret stores are the target of the operation, false otherwise. Default: false.
 * @returns {Promise<SecretStoreSkeleton[]>} a promise that resolves to an array of secret store objects
 */
export async function readSecretStores({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreSkeleton[]> {
  try {
    debugMessage({
      message: `SecretStoreOps.readSecretStores: start`,
      state,
    });
    const { result } = await getSecretStores({ globalConfig, state });
    debugMessage({ message: `SecretStoreOps.readSecretStores: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading secret stores`, error);
  }
}

/**
 * Read secret store mappings
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreMappingSkeleton[]>} a promise that resolves to an array of secret store mapping objects
 */
export async function readSecretStoreMappings({
  secretStoreId,
  secretStoreTypeId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreMappingSkeleton[]> {
  try {
    debugMessage({
      message: `SecretStoreOps.readSecretStoreMappings: start`,
      state,
    });
    const { result } = await getSecretStoreMappings({
      secretStoreId,
      secretStoreTypeId,
      globalConfig,
      state,
    });
    debugMessage({
      message: `SecretStoreOps.readSecretStoreMappings: end`,
      state,
    });
    return result;
  } catch (error) {
    if (error.httpStatus === 404 || error.response?.status === 404) {
      //Ignore this case since not all secret stores have mappings
    } else {
      throw new FrodoError(
        `Error reading secret store mappings for the secret store '${secretStoreId}'`,
        error
      );
    }
  }
}

/**
 * Export a single secret store by id. The response can be saved to file as is.
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {boolean} globalConfig true if global secret store is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<SecretStoreExportInterface>} Promise resolving to a SecretStoreExportInterface object.
 */
export async function exportSecretStore({
  secretStoreId,
  secretStoreTypeId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreExportInterface> {
  try {
    const secretStore = (await readSecretStore({
      secretStoreId,
      secretStoreTypeId,
      globalConfig,
      state,
    })) as SecretStoreExportSkeleton;
    secretStore.mappings = await readSecretStoreMappings({
      secretStoreId,
      secretStoreTypeId: secretStore._type._id,
      globalConfig,
      state,
    });
    const exportData = createSecretStoreExportTemplate({ state });
    exportData.secretstore[secretStoreId] =
      secretStore as SecretStoreExportSkeleton;
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting secret store ${secretStoreId}`,
      error
    );
  }
}

/**
 * Export all secret stores. The response can be saved to file as is.
 * @param {boolean} globalConfig true if global secret stores are the target of the operation, false otherwise. Default: false.
 * @returns {Promise<SecretStoreExportInterface>} Promise resolving to a SecretStoreExportInterface object.
 */
export async function exportSecretStores({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `SecretStoreOps.exportSecretStores: start`,
      state,
    });
    const isCloudDeployment =
      state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
    const exportData = createSecretStoreExportTemplate({ state });
    if (isCloudDeployment && globalConfig) {
      return exportData;
    }
    const secretStores = isCloudDeployment
      ? [
          await readSecretStore({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            globalConfig,
            state,
          }),
        ]
      : await readSecretStores({ globalConfig, state });
    indicatorId = createProgressIndicator({
      total: secretStores.length,
      message: 'Exporting secret stores...',
      state,
    });
    for (const secretStore of secretStores) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting secret store ${secretStore._id}`,
        state,
      });
      try {
        secretStore.mappings = await readSecretStoreMappings({
          secretStoreId: secretStore._id,
          secretStoreTypeId: secretStore._type._id,
          globalConfig,
          state,
        });
      } catch (e) {
        printMessage({
          message: `Unable to export mapping for secret store with id '${secretStore._id}': ${e.message}`,
          type: 'error',
          state,
        });
      }
      exportData.secretstore[secretStore._id] =
        secretStore as SecretStoreExportSkeleton;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${secretStores.length} secret stores.`,
      state,
    });
    debugMessage({ message: `SecretStoreOps.exportSecretStores: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting secret stores.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error reading secret stores`, error);
  }
}

/**
 * Update secret store
 * @param {SecretStoreSkeleton} secretStoreData secret store to import
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreSkeleton>} a promise that resolves to a secret store object
 */
export async function updateSecretStore({
  secretStoreData,
  globalConfig,
  state,
}: {
  secretStoreData: SecretStoreSkeleton;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreSkeleton> {
  return putSecretStore({
    secretStoreData,
    globalConfig,
    state,
  });
}

/**
 * Update secret store mapping
 * @param {string} secretStoreId Secret store id
 * @param {string} secretStoreTypeId Secret store type id
 * @param {SecretStoreMappingSkeleton} secretStoreMappingData secret store mapping to import
 * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to a secret store mapping object
 */
export async function updateSecretStoreMapping({
  secretStoreId,
  secretStoreTypeId,
  secretStoreMappingData,
  globalConfig,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string;
  secretStoreMappingData: SecretStoreMappingSkeleton;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreMappingSkeleton> {
  return putSecretStoreMapping({
    secretStoreId,
    secretStoreTypeId,
    secretStoreMappingData,
    globalConfig,
    state,
  });
}
/**
 * Import secret stores and mappings
 * @param {SecretStoreExportInterface} importData secret store import data
 * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
 * @param {string} secretStoreId optional secret store id. If supplied, only the secret store of that id is imported.
 * @returns {Promise<SecretStoreExportSkeleton[]>} the imported secret stores and mappings
 */
export async function importSecretStores({
  importData,
  globalConfig,
  secretStoreId,
  state,
}: {
  importData: SecretStoreExportInterface;
  globalConfig: boolean;
  secretStoreId?: string;
  state: State;
}): Promise<SecretStoreExportSkeleton[]> {
  const errors = [];
  try {
    debugMessage({
      message: `SecretStoreOps.importSecretStores: start`,
      state,
    });
    const response = [];
    for (const secretStore of Object.values(importData.secretstore)) {
      try {
        if (secretStoreId && secretStore._id !== secretStoreId) {
          continue;
        }
        let mappings;
        if (secretStore.mappings) {
          mappings = [];
          for (const mapping of secretStore.mappings) {
            mappings.push(
              updateSecretStoreMapping({
                secretStoreId: secretStore._id,
                secretStoreTypeId: secretStore._type._id,
                secretStoreMappingData: mapping,
                globalConfig,
                state,
              })
            );
          }
          mappings = await Promise.all(mappings);
        }
        const isCloudDeployment =
          state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
        let result = secretStore;
        if (!isCloudDeployment) {
          delete secretStore.mappings;
          result = (await updateSecretStore({
            secretStoreData: secretStore,
            globalConfig,
            state,
          })) as SecretStoreExportSkeleton;
          result.mappings = mappings;
        }
        response.push(result);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing secret stores`, errors);
    }
    debugMessage({ message: `SecretStoreOps.importSecretStores: end`, state });
    return response;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing secret stores`, error);
  }
}
