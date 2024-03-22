import {
  IdObjectSkeletonInterface,
  NoIdObjectSkeletonInterface,
} from '../api/ApiTypes';
import {
  deleteConfigEntity as _deleteConfigEntity,
  getConfigEntities as _getConfigEntities,
  getConfigEntitiesByType as _getConfigEntitiesByType,
  getConfigEntity as _getConfigEntity,
  getConfigEntity,
  getConfigStubs as _getConfigEntityStubs,
  IdmConfigStub,
  putConfigEntity as _putConfigEntity,
} from '../api/IdmConfigApi';
import { ConnectorServerStatusInterface } from '../api/IdmSystemApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  printError,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { areScriptHooksValid } from '../utils/ScriptValidationUtils';
import { FrodoError } from './FrodoError';
import { testConnectorServers as _testConnectorServers } from './IdmSystemOps';
import { ExportMetaData } from './OpsTypes';

export type IdmConfig = {
  /**
   * Read available config entity types
   * @returns {string[]} promise resolving to an array of config entity types
   */
  readConfigEntityTypes(): Promise<string[]>;
  /**
   * Read all config entity stubs. For full entities use {@link IdmConfig.readConfigEntities | readConfigEntities}.
   * @returns {IdmConfigStub[]} promise resolving to an array of config entity stubs
   */
  readConfigEntityStubs(): Promise<IdmConfigStub[]>;
  /**
   * Read all config entities
   * @returns {IdObjectSkeletonInterface[]} promise reolving to an array of config entities
   */
  readConfigEntities(): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Read all config entities of a type
   * @param {string} type config entity type
   * @returns {IdObjectSkeletonInterface[]} promise resolving to an array of config entities of a type
   */
  readConfigEntitiesByType(type: string): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Read config entity
   * @param {string} entityId config entity id/name
   * @returns {IdObjectSkeletonInterface} promise resolving to a config entity
   */
  readConfigEntity(entityId: string): Promise<IdObjectSkeletonInterface>;
  /**
   * Export all IDM config entities
   * @returns {ConfigEntityExportInterface} promise resolving to a ConfigEntityExportInterface object
   */
  exportConfigEntities(): Promise<ConfigEntityExportInterface>;
  /**
   * Create config entity
   * @param {string} entityId config entity id/name
   * @param {IdObjectSkeletonInterface} entityData config entity data
   * @returns {IdObjectSkeletonInterface} promise resolving to a config entity
   */
  createConfigEntity(
    entityId: string,
    entityData: IdObjectSkeletonInterface
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Update or create config entity
   * @param {string} entityId config entity id/name
   * @param {IdObjectSkeletonInterface} entityData config entity data
   * @returns {IdObjectSkeletonInterface} promise resolving to a config entity
   */
  updateConfigEntity(
    entityId: string,
    entityData: IdObjectSkeletonInterface
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Import idm config entities.
   * @param {ConfigEntityExportInterface} importData idm config entity import data.
   * @param {ConfigEntityImportOptions} options import options
   * @returns {Promise<IdObjectSkeletonInterface[]>} a promise resolving to an array of config entity objects
   */
  importConfigEntities(
    importData: ConfigEntityExportInterface,
    options: ConfigEntityImportOptions
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Delete all config entities
   * @returns {IdObjectSkeletonInterface[]} promise reolving to an array of config entities
   */
  deleteConfigEntities(): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Delete all config entities of a type
   * @param {string} type config entity type
   * @returns {IdObjectSkeletonInterface[]} promise resolving to an array of config entities of a type
   */
  deleteConfigEntitiesByType(
    type: string
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Delete config entity
   * @param {string} entityId config entity id/name
   * @returns {IdObjectSkeletonInterface} promise resolving to a config entity
   */
  deleteConfigEntity(entityId: string): Promise<IdObjectSkeletonInterface>;

  // Deprecated

  /**
   * Get available config entity types
   * @returns {string[]} promise resolving to an array of config entity types
   * @deprecated since v2.0.0 use {@link IdmConfig.readConfigEntityTypes | readConfigEntityTypes} instead
   * ```javascript
   * readConfigEntityTypes(): Promise<string[]>
   * ```
   * @group Deprecated
   */
  getConfigEntityTypes(): Promise<string[]>;
  /**
   * Get all config entities
   * @returns {IdObjectSkeletonInterface[]} promise reolving to an array of config entities
   * @deprecated since v2.0.0 use {@link IdmConfig.readConfigEntities | readConfigEntities} instead
   * ```javascript
   * readConfigEntities(): Promise<IdObjectSkeletonInterface[]>
   * ```
   * @group Deprecated
   */
  getAllConfigEntities(): Promise<IdmConfigStub[]>;
  /**
   * Get all config entities of a type
   * @param {string} type config entity type
   * @returns {IdObjectSkeletonInterface[]} promise resolving to an array of config entities of a type
   * @deprecated since v2.0.0 use {@link IdmConfig.readConfigEntitiesByType | readConfigEntitiesByType} instead
   * ```javascript
   * readConfigEntitiesByType(type: string): Promise<IdObjectSkeletonInterface[]>
   * ```
   * @group Deprecated
   */
  getConfigEntitiesByType(type: string): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Get config entity
   * @param {string} entityId config entity id/name
   * @returns {IdObjectSkeletonInterface} promise resolving to a config entity
   * @deprecated since v2.0.0 use {@link IdmConfig.readConfigEntity | readConfigEntity} instead
   * ```javascript
   * readConfigEntity(entityId: string): Promise<IdObjectSkeletonInterface>
   * ```
   * @group Deprecated
   */
  getConfigEntity(entityId: string): Promise<IdObjectSkeletonInterface>;
  /**
   * Put config entity
   * @param {string} entityId config entity id/name
   * @param {IdObjectSkeletonInterface} entityData config entity data
   * @returns {IdObjectSkeletonInterface} promise resolving to a config entity
   * @deprecated since v2.0.0 use {@link IdmConfig.updateConfigEntity | updateConfigEntity} or {@link IdmConfig.createConfigEntity | createConfigEntity} instead
   * ```javascript
   * updateConfigEntity(entityId: string, entityData: IdObjectSkeletonInterface): Promise<IdObjectSkeletonInterface>
   * createConfigEntity(entityId: string, entityData: IdObjectSkeletonInterface): Promise<IdObjectSkeletonInterface>
   * ```
   * @group Deprecated
   */
  putConfigEntity(
    entityId: string,
    entityData: IdObjectSkeletonInterface
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Test connector servers
   * @deprecated since v2.0.0-42 use {@link IdmSystem.testConnectorServers | testConnectorServers} or {@link IdmSystem.testConnectorServers | testConnectorServers} instead
   * @returns {Promise<ConnectorServerStatusInterface[]>} a promise that resolves to an array of ConnectorServerStatusInterface objects
   */
  testConnectorServers(): Promise<ConnectorServerStatusInterface[]>;
};

export default (state: State): IdmConfig => {
  return {
    async readConfigEntityTypes(): Promise<string[]> {
      return readConfigEntityTypes({ state });
    },
    async readConfigEntityStubs(): Promise<IdmConfigStub[]> {
      return readConfigEntityStubs({ state });
    },
    async readConfigEntities(): Promise<IdObjectSkeletonInterface[]> {
      return readConfigEntities({ state });
    },
    async readConfigEntitiesByType(
      type: string
    ): Promise<IdObjectSkeletonInterface[]> {
      return readConfigEntitiesByType({ type, state });
    },
    async readConfigEntity(
      entityId: string
    ): Promise<IdObjectSkeletonInterface> {
      return readConfigEntity({ entityId, state });
    },
    async exportConfigEntities(): Promise<ConfigEntityExportInterface> {
      return exportConfigEntities({ state });
    },
    async createConfigEntity(
      entityId: string,
      entityData: IdObjectSkeletonInterface
    ): Promise<IdObjectSkeletonInterface> {
      return createConfigEntity({ entityId, entityData, state });
    },
    async updateConfigEntity(
      entityId: string,
      entityData: IdObjectSkeletonInterface
    ): Promise<IdObjectSkeletonInterface> {
      return updateConfigEntity({ entityId, entityData, state });
    },
    async importConfigEntities(
      importData: ConfigEntityExportInterface,
      options: ConfigEntityImportOptions = { validate: false }
    ): Promise<IdObjectSkeletonInterface[]> {
      return importConfigEntities({ importData, options, state });
    },
    async deleteConfigEntities(): Promise<IdObjectSkeletonInterface[]> {
      return deleteConfigEntities({ state });
    },
    async deleteConfigEntitiesByType(
      type: string
    ): Promise<IdObjectSkeletonInterface[]> {
      return deleteConfigEntitiesByType({ type, state });
    },
    async deleteConfigEntity(
      entityId: string
    ): Promise<IdObjectSkeletonInterface> {
      return deleteConfigEntity({ entityId, state });
    },

    // Deprecated

    async getConfigEntityTypes(): Promise<string[]> {
      return readConfigEntityTypes({ state });
    },
    async getAllConfigEntities(): Promise<IdmConfigStub[]> {
      return readConfigEntityStubs({ state });
    },
    async getConfigEntitiesByType(
      type: string
    ): Promise<IdObjectSkeletonInterface[]> {
      return readConfigEntitiesByType({ type, state });
    },
    async getConfigEntity(
      entityId: string
    ): Promise<IdObjectSkeletonInterface> {
      return _getConfigEntity({ entityId, state });
    },
    async putConfigEntity(
      entityId: string,
      entityData: NoIdObjectSkeletonInterface | string
    ): Promise<IdObjectSkeletonInterface> {
      return _putConfigEntity({ entityId, entityData, state });
    },
    async testConnectorServers(): Promise<ConnectorServerStatusInterface[]> {
      return _testConnectorServers({ state });
    },
  };
};

/**
 * Config entity import options
 */
export interface ConfigEntityImportOptions {
  /**
   * validate script hooks
   */
  validate: boolean;
}

export interface ConfigEntityExportInterface {
  meta?: ExportMetaData;
  config: Record<string, IdObjectSkeletonInterface>;
}

/**
 * Create an empty config entity export template
 * @returns {ConfigEntityExportInterface} an empty config entity export template
 */
export function createConfigEntityExportTemplate({
  state,
}: {
  state: State;
}): ConfigEntityExportInterface {
  return {
    meta: getMetadata({ state }),
    config: {},
  } as ConfigEntityExportInterface;
}

export async function readConfigEntityStubs({
  state,
}: {
  state: State;
}): Promise<IdmConfigStub[]> {
  try {
    const { configurations } = await _getConfigEntityStubs({ state });
    return configurations;
  } catch (error) {
    throw new FrodoError(`Error reading config entity stubs`, error);
  }
}

export async function readConfigEntityTypes({
  state,
}: {
  state: State;
}): Promise<string[]> {
  try {
    const types: string[] = [];
    const stubs = await readConfigEntityStubs({ state });
    for (const stub of stubs) {
      if (stub._id.split('/').length > 0) {
        const type = stub._id.split('/')[0];
        if (!types.includes(type)) types.push(type);
      }
    }
    return types;
  } catch (error) {
    throw new FrodoError(`Error reading config entity types`, error);
  }
}

export async function readConfigEntities({
  state,
}: {
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  try {
    const { result } = await _getConfigEntities({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading config entities`, error);
  }
}

export async function readConfigEntitiesByType({
  type,
  state,
}: {
  type: string;
  state: State;
}): Promise<NoIdObjectSkeletonInterface[]> {
  try {
    const { result } = await _getConfigEntitiesByType({ type, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading config entities by type`, error);
  }
}

export async function readConfigEntity({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return getConfigEntity({ entityId, state });
  } catch (error) {
    throw new FrodoError(`Error reading config entity ${entityId}`, error);
  }
}

/**
 * Export all IDM config entities
 * @returns {ConfigEntityExportInterface} promise resolving to a ConfigEntityExportInterface object
 */
export async function exportConfigEntities({
  state,
}: {
  state: State;
}): Promise<ConfigEntityExportInterface> {
  let indicatorId: string;
  try {
    const configurations = await readConfigEntities({ state });
    indicatorId = createProgressIndicator({
      total: configurations.length,
      message: 'Exporting config entities...',
      state,
    });
    const entityPromises = [];
    for (const configEntity of configurations) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting config entity ${configEntity._id}`,
        state,
      });
      entityPromises.push(
        readConfigEntity({ entityId: configEntity._id, state }).catch(
          (readConfigEntityError) => {
            if (
              !(
                readConfigEntityError.response?.status === 403 &&
                readConfigEntityError.response?.data?.message ===
                  'This operation is not available in ForgeRock Identity Cloud.'
              ) &&
              !(
                // list of config entities, which do not exist by default or ever.
                (
                  [
                    'script',
                    'notificationFactory',
                    'apiVersion',
                    'metrics',
                    'repo.init',
                    'endpoint/validateQueryFilter',
                    'endpoint/oauthproxy',
                    'external.rest',
                    'scheduler',
                    'org.apache.felix.fileinstall/openidm',
                    'cluster',
                    'endpoint/mappingDetails',
                    'fieldPolicy/teammember',
                  ].includes(configEntity._id) &&
                  readConfigEntityError.response?.status === 404 &&
                  readConfigEntityError.response?.data?.reason === 'Not Found'
                )
              ) &&
              // https://bugster.forgerock.org/jira/browse/OPENIDM-18270
              !(
                readConfigEntityError.response?.status === 404 &&
                readConfigEntityError.response?.data?.message ===
                  'No configuration exists for id org.apache.felix.fileinstall/openidm'
              )
            ) {
              printMessage({
                message: readConfigEntityError.response?.data,
                type: 'error',
                state,
              });
              printMessage({
                message: `Error getting config entity ${configEntity._id}: ${readConfigEntityError}`,
                type: 'error',
                state,
              });
            }
          }
        )
      );
    }
    const results = await Promise.all(entityPromises);
    const exportData = createConfigEntityExportTemplate({ state });
    for (const result of results) {
      if (result != null) {
        exportData.config[result._id] = result;
      }
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${configurations.length} config entities.`,
      status: 'success',
      state,
    });
    return exportData;
  } catch (error) {
    printError(error);
  }
}

export async function createConfigEntity({
  entityId,
  entityData,
  state,
}: {
  entityId: string;
  entityData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  debugMessage({ message: `IdmConfigOps.createConfigEntity: start`, state });
  try {
    await readConfigEntity({ entityId, state });
  } catch (error) {
    try {
      const result = await updateConfigEntity({
        entityId,
        entityData,
        state,
      });
      debugMessage({ message: `IdmConfigOps.createConfigEntity: end`, state });
      return result;
    } catch (error) {
      throw new FrodoError(`Error creating config entity ${entityId}`, error);
    }
  }
  throw new FrodoError(`Config entity ${entityId} already exists!`);
}

export async function updateConfigEntity({
  entityId,
  entityData,
  state,
}: {
  entityId: string;
  entityData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _putConfigEntity({ entityId, entityData, state });
  } catch (error) {
    throw new FrodoError(`Error updating config entity ${entityId}`, error);
  }
}

export async function importConfigEntities({
  importData,
  options = { validate: false },
  state,
}: {
  importData: ConfigEntityExportInterface;
  options: ConfigEntityImportOptions;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  debugMessage({ message: `IdmConfigOps.importConfigEntities: start`, state });
  const response = [];
  const errors = [];
  const imported = [];
  for (const entityId of Object.keys(importData.config)) {
    try {
      debugMessage({
        message: `IdmConfigOps.importConfigEntities: ${entityId}`,
        state,
      });
      const entityData = importData.config[entityId];
      if (
        options.validate &&
        !areScriptHooksValid({ jsonData: entityData, state })
      ) {
        errors.push(
          Error(`Invalid script hook in the config object '${entityId}'`)
        );
      } else {
        const result: IdObjectSkeletonInterface | PromiseRejectedResult =
          await updateConfigEntity({ entityId, entityData, state });
        if (result.status === 'rejected') {
          errors.push(Error(`- ${result.reason}`));
        } else {
          response.push(result);
        }
      }
      imported.push(entityId);
    } catch (e) {
      errors.push(e);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing config entities`, errors);
  }
  if (0 === imported.length) {
    throw new FrodoError(`No config entities found in import data!`);
  }
  debugMessage({ message: `IdmConfigOps.importConfigEntities: end`, state });
  return response;
}

export async function deleteConfigEntities({
  state,
}: {
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  debugMessage({
    message: `IdmConfigOps.deleteConfigEntities: start`,
    state,
  });
  const result: IdObjectSkeletonInterface[] = [];
  const errors = [];
  try {
    const configEntityStubs = await readConfigEntityStubs({ state });
    for (const configEntityStub of configEntityStubs) {
      try {
        debugMessage({
          message: `IdmConfigOps.deleteConfigEntities: '${configEntityStub['_id']}'`,
          state,
        });
        result.push(
          await _deleteConfigEntity({
            entityId: configEntityStub['_id'],
            state,
          })
        );
      } catch (error) {
        errors.push(error);
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error deleting config entities`, errors);
  }
  debugMessage({
    message: `IdmConfigOps.deleteConfigEntities: end`,
    state,
  });
  return result;
}

export async function deleteConfigEntitiesByType({
  type,
  state,
}: {
  type: string;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  debugMessage({
    message: `IdmConfigOps.deleteConfigEntitiesByType: start`,
    state,
  });
  const result: IdObjectSkeletonInterface[] = [];
  const errors: Error[] = [];
  try {
    const configEntities = await readConfigEntitiesByType({ type, state });
    for (const configEntity of configEntities) {
      try {
        debugMessage({
          message: `IdmConfigOps.deleteConfigEntitiesByType: '${configEntity['_id']}'`,
          state,
        });
        result.push(
          await _deleteConfigEntity({
            entityId: configEntity['_id'] as string,
            state,
          })
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting config entities by type`, errors);
    }
    debugMessage({
      message: `IdmConfigOps.deleteConfigEntitiesByType: end`,
      state,
    });
    return result;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting config entities by type`, error);
  }
}

export async function deleteConfigEntity({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _deleteConfigEntity({ entityId, state });
  } catch (error) {
    throw new FrodoError(`Error deleting config entity ${entityId}`, error);
  }
}
