import {
  createSecretStoreMapping as _createSecretStoreMapping,
  deleteSecretStore as _deleteSecretStore,
  deleteSecretStoreMapping as _deleteSecretStoreMapping,
  getSecretStore,
  getSecretStoreMapping,
  getSecretStoreMappings,
  getSecretStores,
  getSecretStoreSchema,
  putSecretStore,
  putSecretStoreMapping,
  SecretStoreMappingSkeleton,
  SecretStoreSchemaSkeleton,
  SecretStoreSkeleton,
} from '../api/SecretStoreApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata, getResult } from '../utils/ExportImportUtils';
import { getCurrentRealmName } from '../utils/ForgeRockUtils';
import { FrodoError } from './FrodoError';
import { ExportMetaData, ResultCallback } from './OpsTypes';

export type SecretStore = {
  /**
   * Create an empty secret store export template
   * @returns {SecretStoreExportInterface} an empty secret store export template
   */
  createSecretStoreExportTemplate(): SecretStoreExportInterface;
  /**
   * Create secret store mapping. Will throw if type is not defined and multiple secret stores with the same id are found.
   * @param {string} secretStoreId Secret store id
   * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
   * @param {SecretStoreMappingSkeleton} secretStoreMappingData The secret store mapping data,
   * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
   * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to a secret store mapping object of the mapping created
   */
  createSecretStoreMapping(
    secretStoreId: string,
    secretStoreTypeId: string | undefined,
    secretStoreMappingData: SecretStoreMappingSkeleton,
    globalConfig: boolean
  ): Promise<SecretStoreMappingSkeleton>;
  /**
   * Read secret store by id. Will throw if type is not defined and multiple secret stores with the same id are found.
   * @param {string} secretStoreId Secret store id
   * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
   * @param {boolean} globalConfig true if global secret store is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<SecretStoreSkeleton>} a promise that resolves to a secret store object
   */
  readSecretStore(
    secretStoreId: string,
    secretStoreTypeId: string | undefined,
    globalConfig: boolean
  ): Promise<SecretStoreSkeleton>;
  /**
   * Read secret store schema
   * @param {string} secretStoreTypeId Secret store type id
   * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
   * @returns {Promise<SecretStoreSchemaSkeleton>} a promise that resolves to a secret store schema object
   */
  readSecretStoreSchema(
    secretStoreTypeId: string,
    globalConfig: boolean
  ): Promise<SecretStoreSchemaSkeleton>;
  /**
   * Read all secret stores.
   * @param {boolean} globalConfig true if global secret stores are the target of the operation, false otherwise. Default: false.
   * @returns {Promise<SecretStoreSkeleton[]>} a promise that resolves to an array of secret store objects
   */
  readSecretStores(globalConfig: boolean): Promise<SecretStoreSkeleton[]>;
  /**
   * Read secret store mapping. Will throw if type is not defined and multiple secret stores with the same id are found.
   * @param {string} secretStoreId Secret store id
   * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
   * @param {string} secretId Secret store mapping label
   * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
   * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to an array of secret store mapping objects
   */
  readSecretStoreMapping(
    secretStoreId: string,
    secretStoreTypeId: string | undefined,
    secretId: string,
    globalConfig: boolean
  ): Promise<SecretStoreMappingSkeleton>;
  /**
   * Read secret store mappings. Will throw if type is not defined and multiple secret stores with the same id are found.
   * @param {string} secretStoreId Secret store id
   * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
   * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
   * @returns {Promise<SecretStoreMappingSkeleton[]>} a promise that resolves to an array of secret store mapping objects
   */
  readSecretStoreMappings(
    secretStoreId: string,
    secretStoreTypeId: string | undefined,
    globalConfig: boolean
  ): Promise<SecretStoreMappingSkeleton[]>;
  /**
   * Export a single secret store by id. The response can be saved to file as is. Will throw if type is not defined and multiple secret stores with the same id are found.
   * @param {string} secretStoreId Secret store id
   * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
   * @param {boolean} globalConfig true if global secret store is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<SecretStoreExportInterface>} Promise resolving to a SecretStoreExportInterface object.
   */
  exportSecretStore(
    secretStoreId: string,
    secretStoreTypeId: string | undefined,
    globalConfig: boolean
  ): Promise<SecretStoreExportInterface>;
  /**
   * Export all secret stores. The response can be saved to file as is.
   * @param {boolean} globalConfig true if global secret stores are the target of the operation, false otherwise. Default: false.
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<SecretStoreExportInterface>} Promise resolving to a SecretStoreExportInterface object.
   */
  exportSecretStores(
    globalConfig: boolean,
    resultCallback?: ResultCallback<SecretStoreSkeleton>
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
   * Update secret store mapping. Will throw if type is not defined and multiple secret stores with the same id are found.
   * @param {string} secretStoreId Secret store id
   * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
   * @param {SecretStoreMappingSkeleton} secretStoreMappingData secret store mapping to import
   * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
   * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to a secret store mapping object
   */
  updateSecretStoreMapping(
    secretStoreId: string,
    secretStoreTypeId: string | undefined,
    secretStoreMappingData: SecretStoreMappingSkeleton,
    globalConfig: boolean
  ): Promise<SecretStoreMappingSkeleton>;
  /**
   * Import secret stores and mappings
   * @param {SecretStoreExportInterface} importData secret store import data
   * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
   * @param {string} secretStoreId optional secret store id. If supplied, only the secret store of that id is imported.
   * @param {string} secretStoreTypeId optional secret store type id
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<SecretStoreExportSkeleton[]>} the imported secret stores and mappings
   */
  importSecretStores(
    importData: SecretStoreExportInterface,
    globalConfig: boolean,
    secretStoreId?: string,
    secretStoreTypeId?: string,
    resultCallback?: ResultCallback<SecretStoreSkeleton>
  ): Promise<SecretStoreExportSkeleton[]>;
  /**
   * Delete secret store by id
   * @param {string} secretStoreId Secret store id
   * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
   * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
   * @returns {Promise<SecretStoreSkeleton>} a promise that resolves to a secret store object
   */
  deleteSecretStore(
    secretStoreId: string,
    secretStoreTypeId: string | undefined,
    globalConfig: boolean
  ): Promise<SecretStoreSkeleton>;
  /**
   * Delete all secret stores
   * @param {boolean} globalConfig true if the secret store mappings are global, false otherwise. Default: false.
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<SecretStoreSkeleton[]>} a promise that resolves to an array of secret store objects
   */
  deleteSecretStores(
    globalConfig: boolean,
    resultCallback?: ResultCallback<SecretStoreSkeleton>
  ): Promise<SecretStoreSkeleton[]>;
  /**
   * Delete secret store mapping
   * @param {string} secretStoreId Secret store id
   * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
   * @param {string} secretId Secret store mapping label
   * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
   * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to a secret store mapping object
   */
  deleteSecretStoreMapping(
    secretStoreId: string,
    secretStoreTypeId: string | undefined,
    secretId: string,
    globalConfig: boolean
  ): Promise<SecretStoreMappingSkeleton>;
  /**
   * Delete secret store mappings
   * @param {string} secretStoreId Secret store id
   * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
   * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<SecretStoreMappingSkeleton[]>} a promise that resolves to a secret store mapping object
   */
  deleteSecretStoreMappings(
    secretStoreId: string,
    secretStoreTypeId: string | undefined,
    globalConfig: boolean,
    resultCallback?: ResultCallback<SecretStoreMappingSkeleton>
  ): Promise<SecretStoreMappingSkeleton[]>;
  /**
   * Function that returns true if the given secret store type can have mappings, false otherwise
   * @param secretStoreTypeId The secret store type
   * @returns true if the given secret store type can have mappings, false otherwise
   */
  canSecretStoreHaveMappings(secretStoreTypeId: string): boolean;
};

export default (state: State): SecretStore => {
  return {
    createSecretStoreExportTemplate(): SecretStoreExportInterface {
      return createSecretStoreExportTemplate({ state });
    },
    async createSecretStoreMapping(
      secretStoreId: string,
      secretStoreTypeId: string | undefined,
      secretStoreMappingData: SecretStoreMappingSkeleton,
      globalConfig: boolean
    ): Promise<SecretStoreMappingSkeleton> {
      return createSecretStoreMapping({
        secretStoreId,
        secretStoreTypeId,
        secretStoreMappingData,
        globalConfig,
        state,
      });
    },
    async readSecretStore(
      secretStoreId: string,
      secretStoreTypeId: string | undefined,
      globalConfig: boolean = false
    ): Promise<SecretStoreSkeleton> {
      return readSecretStore({
        secretStoreId,
        secretStoreTypeId,
        globalConfig,
        state,
      });
    },
    readSecretStoreSchema(
      secretStoreTypeId: string,
      globalConfig: boolean = false
    ): Promise<SecretStoreSchemaSkeleton> {
      return readSecretStoreSchema({
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
    async readSecretStoreMapping(
      secretStoreId: string,
      secretStoreTypeId: string | undefined,
      secretId: string,
      globalConfig: boolean = false
    ): Promise<SecretStoreMappingSkeleton> {
      return readSecretStoreMapping({
        secretStoreId,
        secretStoreTypeId,
        secretId,
        globalConfig,
        state,
      });
    },
    async readSecretStoreMappings(
      secretStoreId: string,
      secretStoreTypeId: string | undefined,
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
      secretStoreTypeId: string | undefined,
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
      globalConfig: boolean = false,
      resultCallback: ResultCallback<SecretStoreSkeleton> = void 0
    ): Promise<SecretStoreExportInterface> {
      return exportSecretStores({ globalConfig, resultCallback, state });
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
      secretStoreTypeId: string | undefined,
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
      secretStoreId?: string,
      secretStoreTypeId?: string,
      resultCallback: ResultCallback<SecretStoreSkeleton> = void 0
    ): Promise<SecretStoreExportSkeleton[]> {
      return importSecretStores({
        importData,
        globalConfig,
        secretStoreId,
        secretStoreTypeId,
        resultCallback,
        state,
      });
    },
    async deleteSecretStore(
      secretStoreId: string,
      secretStoreTypeId: string | undefined,
      globalConfig: boolean = false
    ): Promise<SecretStoreSkeleton> {
      return deleteSecretStore({
        secretStoreId,
        secretStoreTypeId,
        globalConfig,
        state,
      });
    },
    async deleteSecretStores(
      globalConfig: boolean = false,
      resultCallback?: ResultCallback<SecretStoreSkeleton>
    ): Promise<SecretStoreSkeleton[]> {
      return deleteSecretStores({
        globalConfig,
        resultCallback,
        state,
      });
    },
    async deleteSecretStoreMapping(
      secretStoreId: string,
      secretStoreTypeId: string | undefined,
      secretId: string,
      globalConfig: boolean = false
    ): Promise<SecretStoreMappingSkeleton> {
      return deleteSecretStoreMapping({
        secretStoreId,
        secretStoreTypeId,
        secretId,
        globalConfig,
        state,
      });
    },
    deleteSecretStoreMappings(
      secretStoreId: string,
      secretStoreTypeId: string | undefined,
      globalConfig: boolean = false,
      resultCallback?: ResultCallback<SecretStoreMappingSkeleton>
    ): Promise<SecretStoreMappingSkeleton[]> {
      return deleteSecretStoreMappings({
        secretStoreId,
        secretStoreTypeId,
        globalConfig,
        resultCallback,
        state,
      });
    },
    canSecretStoreHaveMappings,
  };
};

export const SECRET_STORES_WITH_NO_MAPPINGS = [
  'EnvironmentAndSystemPropertySecretStore',
  'FileSystemSecretStore',
];

export type SecretStoreExportSkeleton = SecretStoreSkeleton & {
  mappings?: SecretStoreMappingSkeleton[];
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
 * Create secret store mapping. Will throw if type is not defined and multiple secret stores with the same id are found.
 * @param {string} secretStoreId Secret store id
 * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
 * @param {SecretStoreMappingSkeleton} secretStoreMappingData The secret store mapping data,
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to a secret store mapping object of the mapping created
 */
export async function createSecretStoreMapping({
  secretStoreId,
  secretStoreTypeId,
  secretStoreMappingData,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string | undefined;
  secretStoreMappingData: SecretStoreMappingSkeleton;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreMappingSkeleton> {
  try {
    debugMessage({
      message: `SecretStoreOps.createSecretStoreMapping: start`,
      state,
    });
    if (!secretStoreTypeId)
      secretStoreTypeId = (
        await findSecretStore({ secretStoreId, globalConfig, state })
      )._type._id;
    if (!canSecretStoreHaveMappings(secretStoreTypeId))
      throw new FrodoError(
        `Cannot create mappings for the ${getCurrentRealmName(state) + ' realm'} secret store type '${secretStoreTypeId}'`
      );
    const mapping = await _createSecretStoreMapping({
      secretStoreId,
      secretStoreTypeId,
      secretStoreMappingData,
      globalConfig,
      state,
    });
    debugMessage({
      message: `SecretStoreOps.createSecretStoreMapping: end`,
      state,
    });
    return mapping;
  } catch (error) {
    throw new FrodoError(
      `Error creating mapping '${secretStoreMappingData.secretId}' for the ${getCurrentRealmName(state) + ' realm'} secret store '${secretStoreId}'`,
      error
    );
  }
}

/**
 * Read secret store by id. Will throw if type is not defined and multiple secret stores with the same id are found.
 * @param {string} secretStoreId Secret store id
 * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
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
  secretStoreTypeId: string | undefined;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreSkeleton> {
  try {
    return secretStoreTypeId
      ? await getSecretStore({
          secretStoreId,
          secretStoreTypeId,
          globalConfig,
          state,
        })
      : await findSecretStore({ secretStoreId, globalConfig, state });
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} secret store ${secretStoreId} of type ${secretStoreTypeId}`,
      error
    );
  }
}

/**
 * Read secret store schema
 * @param {string} secretStoreTypeId Secret store type id
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreSchemaSkeleton>} a promise that resolves to a secret store schema object
 */
export async function readSecretStoreSchema({
  secretStoreTypeId,
  globalConfig = false,
  state,
}: {
  secretStoreTypeId: string;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreSchemaSkeleton> {
  try {
    debugMessage({
      message: `SecretStoreOps.readSecretStoreSchema: start`,
      state,
    });
    const result = await getSecretStoreSchema({
      secretStoreTypeId,
      globalConfig,
      state,
    });
    debugMessage({
      message: `SecretStoreOps.readSecretStoreSchema: end`,
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} secret store schema for type ${secretStoreTypeId}`,
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
    const isCloudDeployment =
      state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
    const result = isCloudDeployment
      ? [
          await getSecretStore({
            secretStoreId: 'ESV',
            secretStoreTypeId: 'GoogleSecretManagerSecretStoreProvider',
            globalConfig,
            state,
          }),
        ]
      : (await getSecretStores({ globalConfig, state })).result;
    debugMessage({ message: `SecretStoreOps.readSecretStores: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} secret stores`,
      error
    );
  }
}

/**
 * Read secret store mapping. Will throw if type is not defined and multiple secret stores with the same id are found.
 * @param {string} secretStoreId Secret store id
 * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
 * @param {string} secretId Secret store mapping label
 * @param {boolean} globalConfig true if the secret store is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to an array of secret store mapping objects
 */
export async function readSecretStoreMapping({
  secretStoreId,
  secretStoreTypeId,
  secretId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string | undefined;
  secretId: string;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreMappingSkeleton> {
  try {
    debugMessage({
      message: `SecretStoreOps.readSecretStoreMapping: start`,
      state,
    });
    if (!secretStoreTypeId)
      secretStoreTypeId = (
        await findSecretStore({ secretStoreId, globalConfig, state })
      )._type._id;
    if (!canSecretStoreHaveMappings(secretStoreTypeId))
      throw new FrodoError(
        `No mappings exist for the ${getCurrentRealmName(state) + ' realm'} secret store type '${secretStoreTypeId}'`
      );
    const mapping = await getSecretStoreMapping({
      secretStoreId,
      secretStoreTypeId,
      secretId,
      globalConfig,
      state,
    });
    debugMessage({
      message: `SecretStoreOps.readSecretStoreMapping: end`,
      state,
    });
    return mapping;
  } catch (error) {
    throw new FrodoError(
      `Error reading secret store mapping '${secretId}' for the ${getCurrentRealmName(state) + ' realm'} secret store '${secretStoreId}'`,
      error
    );
  }
}

/**
 * Read secret store mappings. Will throw if type is not defined and multiple secret stores with the same id are found.
 * @param {string} secretStoreId Secret store id
 * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
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
  secretStoreTypeId: string | undefined;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreMappingSkeleton[]> {
  try {
    debugMessage({
      message: `SecretStoreOps.readSecretStoreMappings: start`,
      state,
    });
    if (!secretStoreTypeId)
      secretStoreTypeId = (
        await findSecretStore({ secretStoreId, globalConfig, state })
      )._type._id;
    if (!canSecretStoreHaveMappings(secretStoreTypeId))
      throw new FrodoError(
        `No mappings exist for the ${getCurrentRealmName(state) + ' realm'} secret store type '${secretStoreTypeId}'`
      );
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
    throw new FrodoError(
      `Error reading secret store mappings for the ${getCurrentRealmName(state) + ' realm'} secret store '${secretStoreId}'`,
      error
    );
  }
}

/**
 * Export a single secret store by id. The response can be saved to file as is. Will throw if type is not defined and multiple secret stores with the same id are found.
 * @param {string} secretStoreId Secret store id
 * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
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
  secretStoreTypeId: string | undefined;
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
    if (canSecretStoreHaveMappings(secretStoreTypeId)) {
      secretStore.mappings = await readSecretStoreMappings({
        secretStoreId,
        secretStoreTypeId: secretStore._type._id,
        globalConfig,
        state,
      });
    }
    const exportData = createSecretStoreExportTemplate({ state });
    exportData.secretstore[secretStoreId] =
      secretStore as SecretStoreExportSkeleton;
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} secret store ${secretStoreId}`,
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
  resultCallback = void 0,
  state,
}: {
  globalConfig: boolean;
  resultCallback?: ResultCallback<SecretStoreSkeleton>;
  state: State;
}): Promise<SecretStoreExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `SecretStoreOps.exportSecretStores: start`,
      state,
    });
    const exportData = createSecretStoreExportTemplate({ state });
    const secretStores = await readSecretStores({ globalConfig, state });
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
      if (canSecretStoreHaveMappings(secretStore._type._id)) {
        try {
          secretStore.mappings = await readSecretStoreMappings({
            secretStoreId: secretStore._id,
            secretStoreTypeId: secretStore._type._id,
            globalConfig,
            state,
          });
        } catch (e) {
          if (resultCallback) resultCallback(e);
        }
      }
      exportData.secretstore[secretStore._id] =
        secretStore as SecretStoreExportSkeleton;
      if (resultCallback) resultCallback(undefined, secretStore);
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
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} secret stores`,
      error
    );
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
 * Update secret store mapping. Will throw if type is not defined and multiple secret stores with the same id are found.
 * @param {string} secretStoreId Secret store id
 * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
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
  secretStoreTypeId: string | undefined;
  secretStoreMappingData: SecretStoreMappingSkeleton;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreMappingSkeleton> {
  if (!secretStoreTypeId)
    secretStoreTypeId = (
      await findSecretStore({ secretStoreId, globalConfig, state })
    )._type._id;
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
 * @param {string} secretStoreTypeId optional secret store type id
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<SecretStoreExportSkeleton[]>} the imported secret stores and mappings
 */
export async function importSecretStores({
  importData,
  globalConfig,
  secretStoreId,
  secretStoreTypeId,
  resultCallback = void 0,
  state,
}: {
  importData: SecretStoreExportInterface;
  globalConfig: boolean;
  secretStoreId?: string;
  secretStoreTypeId?: string;
  resultCallback?: ResultCallback<SecretStoreSkeleton>;
  state: State;
}): Promise<SecretStoreExportSkeleton[]> {
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
      if (secretStoreId && !secretStoreTypeId)
        secretStoreTypeId =
          secretStore._type?._id ||
          (await findSecretStore({ secretStoreId, globalConfig, state }))._type
            ._id;
      const isCloudDeployment =
        state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
      let result = secretStore;
      const secretStoreMappings = secretStore.mappings;
      // Do secret store import first in case it doesn't exist
      if (!isCloudDeployment || secretStore._id !== 'ESV') {
        delete secretStore.mappings;
        result = (await updateSecretStore({
          secretStoreData: secretStore,
          globalConfig,
          state,
        })) as SecretStoreExportSkeleton;
      }
      secretStore.mappings = secretStoreMappings;
      // Do mapping imports next
      if (secretStoreMappings) {
        try {
          result.mappings = [];
          for (const mapping of secretStoreMappings) {
            result.mappings.push(
              await updateSecretStoreMapping({
                secretStoreId: secretStore._id,
                secretStoreTypeId: secretStore._type._id,
                secretStoreMappingData: mapping,
                globalConfig,
                state,
              })
            );
          }
        } catch (e) {
          if (resultCallback) resultCallback(e);
        }
      }
      response.push(result);
      if (resultCallback) resultCallback(undefined, result);
    } catch (error) {
      if (resultCallback) resultCallback(error);
    }
  }
  debugMessage({ message: `SecretStoreOps.importSecretStores: end`, state });
  return response;
}

/**
 * Delete secret store by id
 * @param {string} secretStoreId Secret store id
 * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
 * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreSkeleton>} a promise that resolves to a secret store object
 */
export async function deleteSecretStore({
  secretStoreId,
  secretStoreTypeId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string | undefined;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreSkeleton> {
  if (state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY) {
    throw new Error(
      'Delete operation is not available in PingOne Advanced Identity Cloud.'
    );
  }
  try {
    debugMessage({ message: `SecretStoreOps.deleteSecretStore: start`, state });
    if (!secretStoreTypeId)
      secretStoreTypeId = (
        await findSecretStore({ secretStoreId, globalConfig, state })
      )._type._id;
    const store = await _deleteSecretStore({
      secretStoreId,
      secretStoreTypeId,
      globalConfig,
      state,
    });
    debugMessage({ message: `SecretStoreOps.deleteSecretStore: end`, state });
    return store;
  } catch (e) {
    throw new FrodoError(
      `Error deleting the ${getCurrentRealmName(state) + ' realm'} secret store ${secretStoreId}`,
      e
    );
  }
}

/**
 * Delete all secret stores
 * @param {boolean} globalConfig true if the secret store mappings are global, false otherwise. Default: false.
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<SecretStoreSkeleton[]>} a promise that resolves to an array of secret store objects
 */
export async function deleteSecretStores({
  globalConfig = false,
  resultCallback = void 0,
  state,
}: {
  globalConfig: boolean;
  resultCallback?: ResultCallback<SecretStoreSkeleton>;
  state: State;
}): Promise<SecretStoreSkeleton[]> {
  if (state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY) {
    throw new Error(
      'Delete operation is not available in PingOne Advanced Identity Cloud.'
    );
  }
  try {
    debugMessage({
      message: `SecretStoreOps.deleteSecretStores: start`,
      state,
    });
    const deleted = [];
    for (const store of await readSecretStores({ globalConfig, state })) {
      const result = await getResult(
        resultCallback,
        undefined,
        deleteSecretStore,
        {
          secretStoreId: store._id,
          secretStoreTypeId: store._type._id,
          globalConfig,
          state,
        }
      );
      deleted.push(result);
    }
    debugMessage({ message: `SecretStoreOps.deleteSecretStores: end`, state });
    return deleted.filter((s) => s);
  } catch (e) {
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} secret stores`,
      e
    );
  }
}

/**
 * Delete secret store mapping
 * @param {string} secretStoreId Secret store id
 * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
 * @param {string} secretId Secret store mapping label
 * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreMappingSkeleton>} a promise that resolves to a secret store mapping object
 */
export async function deleteSecretStoreMapping({
  secretStoreId,
  secretStoreTypeId,
  secretId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string | undefined;
  secretId: string;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreMappingSkeleton> {
  try {
    debugMessage({
      message: `SecretStoreOps.deleteSecretStoreMapping: start`,
      state,
    });
    if (!secretStoreTypeId)
      secretStoreTypeId = (
        await findSecretStore({ secretStoreId, globalConfig, state })
      )._type._id;
    const store = await _deleteSecretStoreMapping({
      secretStoreId,
      secretStoreTypeId,
      secretId,
      globalConfig,
      state,
    });
    debugMessage({
      message: `SecretStoreOps.deleteSecretStoreMapping: end`,
      state,
    });
    return store;
  } catch (e) {
    throw new FrodoError(
      `Error deleting the secret store mapping ${secretId} from the ${getCurrentRealmName(state) + ' realm'} secret store ${secretStoreId}`,
      e
    );
  }
}

/**
 * Delete secret store mappings
 * @param {string} secretStoreId Secret store id
 * @param {string | undefined} secretStoreTypeId Secret store type id (optional)
 * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<SecretStoreMappingSkeleton[]>} a promise that resolves to a secret store mapping object
 */
export async function deleteSecretStoreMappings({
  secretStoreId,
  secretStoreTypeId,
  globalConfig = false,
  resultCallback = void 0,
  state,
}: {
  secretStoreId: string;
  secretStoreTypeId: string | undefined;
  globalConfig: boolean;
  resultCallback?: ResultCallback<SecretStoreMappingSkeleton>;
  state: State;
}): Promise<SecretStoreMappingSkeleton[]> {
  try {
    debugMessage({
      message: `SecretStoreOps.deleteSecretStoreMappings: start`,
      state,
    });
    if (!secretStoreTypeId)
      secretStoreTypeId = (
        await findSecretStore({ secretStoreId, globalConfig, state })
      )._type._id;
    const deleted = [];
    for (const mapping of await readSecretStoreMappings({
      secretStoreId,
      secretStoreTypeId,
      globalConfig,
      state,
    })) {
      const result = await getResult(
        resultCallback,
        undefined,
        deleteSecretStoreMapping,
        {
          secretStoreId,
          secretStoreTypeId,
          secretId: mapping._id,
          globalConfig,
          state,
        }
      );
      deleted.push(result);
    }
    debugMessage({
      message: `SecretStoreOps.deleteSecretStoreMappings: end`,
      state,
    });
    return deleted.filter((s) => s);
  } catch (e) {
    throw new FrodoError(
      `Error deleting the secret store mappings from the ${getCurrentRealmName(state) + ' realm'} secret store ${secretStoreId}`,
      e
    );
  }
}

/**
 * Function that returns true if the given secret store type can have mappings, false otherwise
 * @param secretStoreTypeId The secret store type
 * @returns true if the given secret store type can have mappings, false otherwise
 */
export function canSecretStoreHaveMappings(secretStoreTypeId: string): boolean {
  return !SECRET_STORES_WITH_NO_MAPPINGS.includes(secretStoreTypeId);
}

/**
 * Helper to find a secret store with a specified id. Throws if none or multiple secret stores with the same id are found across different secret store types.
 * @param {string} secretStoreId Secret store id
 * @param {boolean} globalConfig true if the secret store mapping is global, false otherwise. Default: false.
 * @returns {Promise<SecretStoreSkeleton>} a promise that resolves to a secret store mapping object
 */
async function findSecretStore({
  secretStoreId,
  globalConfig = false,
  state,
}: {
  secretStoreId: string;
  globalConfig: boolean;
  state: State;
}): Promise<SecretStoreSkeleton> {
  const stores = (
    await readSecretStores({
      globalConfig,
      state,
    })
  ).filter((s) => s._id === secretStoreId);
  if (stores.length === 0) {
    throw new FrodoError(
      `${getCurrentRealmName(state) + ' realm'} secret store with id '${secretStoreId} not found!'`
    );
  }
  if (stores.length > 1) {
    throw new FrodoError(
      `Multiple ${getCurrentRealmName(state) + ' realm'} secret stores with id '${secretStoreId} found! Try specifying the secret store type as well.'`
    );
  }
  return stores[0];
}
