import replaceall from 'replaceall';

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
import Constants from '../shared/Constants';
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
import { stringify } from '../utils/JsonUtils';
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
   * Export a single IDM config entity
   * @param {string} entityId config entity id
   * @param {ConfigEntityExportOptions} options export options
   * @returns {ConfigEntityExportInterface} promise resolving to a ConfigEntityExportInterface object
   */
  exportConfigEntity(
    entityId: string,
    options?: ConfigEntityExportOptions
  ): Promise<ConfigEntityExportInterface>;
  /**
   * Export all IDM config entities
   * @param {ConfigEntityExportOptions} options export options
   * @returns {ConfigEntityExportInterface} promise resolving to a ConfigEntityExportInterface object
   */
  exportConfigEntities(
    options?: ConfigEntityExportOptions
  ): Promise<ConfigEntityExportInterface>;
  /**
   * Create config entity
   * @param {string} entityId config entity id/name
   * @param {IdObjectSkeletonInterface} entityData config entity data
   * @param {boolean} wait delay the response until an OSGi service event confirms the change has been consumed by the corresponding service or the request times out.
   * @returns {IdObjectSkeletonInterface} promise resolving to a config entity
   */
  createConfigEntity(
    entityId: string,
    entityData: IdObjectSkeletonInterface,
    wait?: boolean
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Update or create config entity
   * @param {string} entityId config entity id/name
   * @param {IdObjectSkeletonInterface} entityData config entity data
   * @param {boolean} wait delay the response until an OSGi service event confirms the change has been consumed by the corresponding service or the request times out.
   * @returns {IdObjectSkeletonInterface} promise resolving to a config entity
   */
  updateConfigEntity(
    entityId: string,
    entityData: IdObjectSkeletonInterface,
    wait?: boolean
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Import idm config entities.
   * @param {ConfigEntityExportInterface} importData idm config entity import data.
   * @param {string} entityId Optional entity id that, when provided, will only import the entity of that id from the importData
   * @param {ConfigEntityImportOptions} options import options
   * @returns {Promise<IdObjectSkeletonInterface[]>} a promise resolving to an array of config entity objects
   */
  importConfigEntities(
    importData: ConfigEntityExportInterface,
    entityId?: string,
    options?: ConfigEntityImportOptions
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
    async exportConfigEntity(
      entityId: string,
      options: ConfigEntityExportOptions = {
        envReplaceParams: undefined,
        entitiesToExport: undefined,
      }
    ): Promise<ConfigEntityExportInterface> {
      return exportConfigEntity({ entityId, options, state });
    },
    async exportConfigEntities(
      options: ConfigEntityExportOptions = {
        envReplaceParams: undefined,
        entitiesToExport: undefined,
      }
    ): Promise<ConfigEntityExportInterface> {
      return exportConfigEntities({ options, state });
    },
    async createConfigEntity(
      entityId: string,
      entityData: IdObjectSkeletonInterface,
      wait: boolean = false
    ): Promise<IdObjectSkeletonInterface> {
      return createConfigEntity({ entityId, entityData, wait, state });
    },
    async updateConfigEntity(
      entityId: string,
      entityData: IdObjectSkeletonInterface,
      wait: boolean = false
    ): Promise<IdObjectSkeletonInterface> {
      return updateConfigEntity({ entityId, entityData, wait, state });
    },
    async importConfigEntities(
      importData: ConfigEntityExportInterface,
      entityId?: string,
      options: ConfigEntityImportOptions = { validate: false }
    ): Promise<IdObjectSkeletonInterface[]> {
      return importConfigEntities({ entityId, importData, options, state });
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
 * Idm export options
 */
export interface ConfigEntityExportOptions {
  /**
   * Gives a list of entities to export. If undefined or empty, it will export all entities.
   */
  entitiesToExport?: string[];
  /**
   * Gives the list of key-value pairs of env replacements. Replaces each occurrence of the value with '${key}', where key is the correspond key to the value.
   */
  envReplaceParams?: string[][];
}

/**
 * Config entity import options
 */
export interface ConfigEntityImportOptions {
  /**
   * Gives a list of entities to import. If undefined or empty, it will import all entities.
   */
  entitiesToImport?: string[];
  /**
   * Gives the list of key-value pairs of env replacements. Replaces each occurrence of '${key}' with its value.
   */
  envReplaceParams?: string[][];
  /**
   * validate script hooks
   */
  validate: boolean;
}

export interface ConfigEntityExportInterface {
  meta?: ExportMetaData;
  idm: Record<string, IdObjectSkeletonInterface>;
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
    idm: {},
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
    const result = await getConfigEntity({ entityId, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading config entity ${entityId}`, error);
  }
}

export const AIC_PROTECTED_ENTITIES: string[] = [
  'emailTemplate/frEmailUpdated',
  'emailTemplate/frForgotUsername',
  'emailTemplate/frOnboarding',
  'emailTemplate/frPasswordUpdated',
  'emailTemplate/frProfileUpdated',
  'emailTemplate/frResetPassword',
  'emailTemplate/frUsernameUpdated',
];

const IDM_UNAVAILABLE_ENTITIES = [
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
];

/**
 * Export a single IDM config entity
 * @param {string} entityId config entity id
 * @param {ConfigEntityExportOptions} options export options
 * @returns {ConfigEntityExportInterface} promise resolving to a ConfigEntityExportInterface object
 */
export async function exportConfigEntity({
  entityId,
  options = { envReplaceParams: undefined, entitiesToExport: undefined },
  state,
}: {
  entityId: string;
  options?: ConfigEntityExportOptions;
  state: State;
}): Promise<ConfigEntityExportInterface> {
  try {
    const exportData = createConfigEntityExportTemplate({ state });
    const entity = substituteEntityWithEnv(
      await readConfigEntity({ entityId, state }),
      options.envReplaceParams
    );
    if (!entity) {
      throw new FrodoError(`Error getting config entity ${entityId}`);
    }
    exportData.idm[entity._id] = entity;
    return exportData;
  } catch (error) {
    printError(error);
  }
}

/**
 * Export all IDM config entities
 * @param {ConfigEntityExportOptions} options export options
 * @returns {ConfigEntityExportInterface} promise resolving to a ConfigEntityExportInterface object
 */
export async function exportConfigEntities({
  options = { envReplaceParams: undefined, entitiesToExport: undefined },
  state,
}: {
  options?: ConfigEntityExportOptions;
  state: State;
}): Promise<ConfigEntityExportInterface> {
  let indicatorId: string;
  try {
    let configurations = await readConfigEntities({ state });
    if (options.entitiesToExport && options.entitiesToExport.length > 0) {
      configurations = configurations.filter((c) =>
        options.entitiesToExport.includes(c._id)
      );
    }
    indicatorId = createProgressIndicator({
      total: configurations.length,
      message: 'Exporting config entities...',
      state,
    });
    const entityPromises: Promise<void | IdObjectSkeletonInterface>[] = [];
    for (const configEntity of configurations) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting config entity ${configEntity._id}`,
        state,
      });
      entityPromises.push(
        readConfigEntity({ entityId: configEntity._id, state }).catch(
          (readConfigEntityError) => {
            const error: FrodoError = readConfigEntityError;
            if (
              // operation is not available in PingOne Advanced Identity Cloud
              !(
                error.httpStatus === 403 &&
                error.httpMessage ===
                  'This operation is not available in PingOne Advanced Identity Cloud.'
              ) &&
              // list of config entities, which do not exist by default or ever.
              !(
                IDM_UNAVAILABLE_ENTITIES.includes(configEntity._id) &&
                error.httpStatus === 404 &&
                error.httpErrorReason === 'Not Found'
              ) &&
              // https://bugster.forgerock.org/jira/browse/OPENIDM-18270
              !(
                error.httpStatus === 404 &&
                error.httpMessage ===
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
    const exportData = createConfigEntityExportTemplate({ state });
    (await Promise.all(entityPromises))
      .filter((c) => c)
      .forEach((entity) => {
        exportData.idm[(entity as IdObjectSkeletonInterface)._id] =
          substituteEntityWithEnv(
            entity as IdObjectSkeletonInterface,
            options.envReplaceParams
          );
      });
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
  wait = false,
  state,
}: {
  entityId: string;
  entityData: IdObjectSkeletonInterface;
  wait?: boolean;
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
        wait,
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
  wait = false,
  state,
}: {
  entityId: string;
  entityData: IdObjectSkeletonInterface;
  wait?: boolean;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    const result = await _putConfigEntity({
      entityId,
      entityData,
      wait,
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(`Error updating config entity ${entityId}`, error);
  }
}

export async function importConfigEntities({
  entityId,
  importData,
  options = {
    envReplaceParams: undefined,
    entitiesToImport: undefined,
    validate: false,
  },
  state,
}: {
  entityId?: string;
  importData: ConfigEntityExportInterface;
  options: ConfigEntityImportOptions;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  debugMessage({ message: `IdmConfigOps.importConfigEntities: start`, state });
  const response = [];
  const errors = [];
  let ids = Object.keys(importData.idm);
  if (options.entitiesToImport && options.entitiesToImport.length > 0) {
    ids = ids.filter((id) => options.entitiesToImport.includes(id));
  }
  for (const id of ids) {
    try {
      if (entityId && id !== entityId) {
        continue;
      }
      debugMessage({
        message: `IdmConfigOps.importConfigEntities: ${id}`,
        state,
      });
      const entityData = unSubstituteEntityWithEnv(
        importData.idm[id],
        options.envReplaceParams
      );
      if (
        options.validate &&
        !areScriptHooksValid({ jsonData: entityData, state })
      ) {
        throw new FrodoError(
          `Invalid script hook in the config object '${id}'`
        );
      }
      try {
        const result = await updateConfigEntity({
          entityId: id,
          entityData,
          state,
        });
        response.push(result);
      } catch (error) {
        if (
          // protected entities (e.g. root realm email templates)
          !(
            state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY &&
            AIC_PROTECTED_ENTITIES.includes(id) &&
            error.httpStatus === 403 &&
            error.httpCode === 'ERR_BAD_REQUEST'
          )
        ) {
          throw error;
        }
      }
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing config entities`, errors);
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

function substituteEntityWithEnv(
  entity: IdObjectSkeletonInterface,
  envReplaceParams: string[][]
): IdObjectSkeletonInterface {
  if (!entity || !envReplaceParams || envReplaceParams.length === 0) {
    return entity;
  }
  let configEntityString = stringify(entity);
  envReplaceParams.forEach(([key, value]) => {
    configEntityString = replaceall(value, `\${${key}}`, configEntityString);
  });
  return JSON.parse(configEntityString);
}

function unSubstituteEntityWithEnv(
  entity: IdObjectSkeletonInterface,
  envReplaceParams: string[][]
): IdObjectSkeletonInterface {
  if (!entity || !envReplaceParams || envReplaceParams.length === 0) {
    return entity;
  }
  let configEntityString = stringify(entity);
  envReplaceParams.forEach(([key, value]) => {
    configEntityString = replaceall(`\${${key}}`, value, configEntityString);
  });
  return JSON.parse(configEntityString);
}
