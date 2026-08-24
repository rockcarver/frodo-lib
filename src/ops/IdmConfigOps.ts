import replaceall from 'replaceall';

import {
  IdObjectSkeletonInterface,
  NoIdObjectSkeletonInterface,
} from '../api/ApiTypes';
import {
  deleteConfigEntity as _deleteConfigEntity,
  getConfigEntities as _getConfigEntities,
  getConfigEntitiesByType as _getConfigEntitiesByType,
  getConfigStubs as _getConfigEntityStubs,
  putConfigEntity as _putConfigEntity,
  getConfigEntity,
  IdmConfigStub,
} from '../api/IdmConfigApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import {
  getErrorCallback,
  getMetadata,
  getResult,
} from '../utils/ExportImportUtils';
import { stringify } from '../utils/JsonUtils';
import { areScriptHooksValid } from '../utils/ScriptValidationUtils';
import { FrodoError, isNotFoundError } from './FrodoError';
import { ExportMetaData, ResultCallback } from './OpsTypes';

export type IdmConfig = {
  /** Read configured managed-object type names. */
  readManagedObjectTypes(): Promise<string[]>;
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
   * @param {boolean} includeDefault Include default email templates if true, false to exclude them. Default: false
   * @returns {IdObjectSkeletonInterface[]} promise resolving to an array of config entities of a type
   */
  readConfigEntitiesByType(
    type: string,
    includeDefault?: boolean
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Read config entity
   * @param {string} entityId config entity id/name
   * @returns {IdObjectSkeletonInterface} promise resolving to a config entity
   */
  readConfigEntity(entityId: string): Promise<IdObjectSkeletonInterface>;
  /**
   * Export a single IDM config entity
   * @param {string} entityId config entity id
   * @returns {ConfigEntityExportInterface} promise resolving to a ConfigEntityExportInterface object
   */
  exportConfigEntity(entityId: string): Promise<ConfigEntityExportInterface>;
  /**
   * Export all IDM config entities
   * @param {ConfigEntityExportOptions} options export options
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {ConfigEntityExportInterface} promise resolving to a ConfigEntityExportInterface object
   */
  exportConfigEntities(
    options?: ConfigEntityExportOptions,
    resultCallback?: ResultCallback<IdObjectSkeletonInterface>
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
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<IdObjectSkeletonInterface[]>} a promise resolving to an array of config entity objects
   */
  importConfigEntities(
    importData: ConfigEntityExportInterface,
    entityId?: string,
    options?: ConfigEntityImportOptions,
    resultCallback?: ResultCallback<IdObjectSkeletonInterface>
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Delete all config entities
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {IdObjectSkeletonInterface[]} promise reolving to an array of config entities
   */
  deleteConfigEntities(
    resultCallback?: ResultCallback<IdObjectSkeletonInterface>
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Delete all config entities of a type
   * @param {string} type config entity type
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {IdObjectSkeletonInterface[]} promise resolving to an array of config entities of a type
   */
  deleteConfigEntitiesByType(
    type: string,
    resultCallback?: ResultCallback<IdObjectSkeletonInterface>
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Delete config entity
   * @param {string} entityId config entity id/name
   * @returns {IdObjectSkeletonInterface} promise resolving to a config entity
   */
  deleteConfigEntity(entityId: string): Promise<IdObjectSkeletonInterface>;
  /**
   * Read a idm sub config entity.
   * @param {string} entityId entity id for the parent config entity of the sub config entity that is being read
   * @param {string} name name of the sub config entity that is being read
   * @returns {Promise<IdObjectSkeletonInterface>} a promise resolving to a sub config entity object
   */
  readSubConfigEntity(
    entityId: string,
    name: string
  ): Promise<NoIdObjectSkeletonInterface>;
  /**
   * Import a idm sub config entity.
   * @param {string} entityId entity id for parent config entity of the sub config that is being updated
   * @param {NoIdObjectSkeletonInterface} updatedSubConfigEntity the updated sub config entity
   * @param {ConfigEntityImportOptions} options import options
   * @returns {Promise<IdObjectSkeletonInterface[]>} a promise resolving to an array of config entity objects
   */
  importSubConfigEntity(
    entityId: string,
    updatedSubConfigEntity: IdObjectSkeletonInterface,
    options?: ConfigEntityImportOptions
  ): Promise<IdObjectSkeletonInterface[]>;
};

export default (state: State): IdmConfig => {
  return {
    async readManagedObjectTypes(): Promise<string[]> {
      return readManagedObjectTypes({ state });
    },
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
      type: string,
      includeDefault: boolean = false
    ): Promise<IdObjectSkeletonInterface[]> {
      return readConfigEntitiesByType({ type, includeDefault, state });
    },
    async readConfigEntity(
      entityId: string
    ): Promise<IdObjectSkeletonInterface> {
      return readConfigEntity({ entityId, state });
    },
    async exportConfigEntity(
      entityId: string
    ): Promise<ConfigEntityExportInterface> {
      return exportConfigEntity({ entityId, state });
    },
    async exportConfigEntities(
      options: ConfigEntityExportOptions = {
        entitiesToExport: undefined,
      },
      resultCallback: ResultCallback<IdObjectSkeletonInterface> = void 0
    ): Promise<ConfigEntityExportInterface> {
      return exportConfigEntities({ options, resultCallback, state });
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
      options: ConfigEntityImportOptions = { validate: false },
      resultCallback: ResultCallback<IdObjectSkeletonInterface> = void 0
    ): Promise<IdObjectSkeletonInterface[]> {
      return importConfigEntities({
        entityId,
        importData,
        options,
        resultCallback,
        state,
      });
    },
    async deleteConfigEntities(
      resultCallback: ResultCallback<IdObjectSkeletonInterface> = void 0
    ): Promise<IdObjectSkeletonInterface[]> {
      return deleteConfigEntities({ resultCallback, state });
    },
    async deleteConfigEntitiesByType(
      type: string,
      resultCallback: ResultCallback<IdObjectSkeletonInterface> = void 0
    ): Promise<IdObjectSkeletonInterface[]> {
      return deleteConfigEntitiesByType({ type, resultCallback, state });
    },
    async deleteConfigEntity(
      entityId: string
    ): Promise<IdObjectSkeletonInterface> {
      return deleteConfigEntity({ entityId, state });
    },
    async readSubConfigEntity(
      entityId: string,
      name: string
    ): Promise<NoIdObjectSkeletonInterface> {
      return readSubConfigEntity({
        entityId,
        name,
        state,
      });
    },
    async importSubConfigEntity(
      entityId: string,
      updatedSubConfigEntity: IdObjectSkeletonInterface,
      options: ConfigEntityImportOptions = { validate: false }
    ): Promise<IdObjectSkeletonInterface[]> {
      return importSubConfigEntity({
        entityId,
        updatedSubConfigEntity,
        options,
        state,
      });
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
  includeDefault = false,
  state,
}: {
  type: string;
  includeDefault?: boolean;
  state: State;
}): Promise<NoIdObjectSkeletonInterface[]> {
  try {
    const { result } = await _getConfigEntitiesByType({
      type,
      includeDefault,
      state,
    });
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

/**
 * Reads the tenant's configured managed-object type names.
 */
export async function readManagedObjectTypes({
  state,
}: {
  state: State;
}): Promise<string[]> {
  const entity = await readConfigEntity({ entityId: 'managed', state });
  return extractManagedObjectTypes(entity);
}

/** Extracts validated, unique managed-object names from a managed config. */
export function extractManagedObjectTypes(entity: unknown): string[] {
  if (!entity || typeof entity !== 'object') return [];
  const objects = (entity as { objects?: unknown }).objects;
  if (!Array.isArray(objects)) return [];
  return [
    ...new Set(
      objects.flatMap((object) => {
        if (!object || typeof object !== 'object') return [];
        const name = (object as { name?: unknown }).name;
        return typeof name === 'string' && name.trim() ? [name.trim()] : [];
      })
    ),
  ].sort((left, right) => left.localeCompare(right));
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
 * @returns {ConfigEntityExportInterface} promise resolving to a ConfigEntityExportInterface object
 */
export async function exportConfigEntity({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<ConfigEntityExportInterface> {
  try {
    const exportData = createConfigEntityExportTemplate({ state });
    const entity = substituteEntityWithEnv(
      await readConfigEntity({ entityId, state }),
      state
    );
    if (!entity) {
      throw new FrodoError(`Error getting config entity ${entityId}`);
    }
    exportData.idm[entity._id] = entity;
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error getting config entity ${entityId}`, error);
  }
}

/**
 * Export all IDM config entities
 * @param {ConfigEntityExportOptions} options export options
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {ConfigEntityExportInterface} promise resolving to a ConfigEntityExportInterface object
 */
export async function exportConfigEntities({
  options = { entitiesToExport: undefined },
  resultCallback = void 0,
  state,
}: {
  options?: ConfigEntityExportOptions;
  resultCallback?: ResultCallback<IdObjectSkeletonInterface>;
  state: State;
}): Promise<ConfigEntityExportInterface> {
  const exportData = createConfigEntityExportTemplate({ state });
  let configurations = await readConfigEntities({ state });
  if (options.entitiesToExport && options.entitiesToExport.length > 0) {
    configurations = configurations.filter((c) =>
      options.entitiesToExport.includes(c._id)
    );
  }
  const indicatorId = createProgressIndicator({
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
      getResult(
        getErrorCallback(
          resultCallback,
          (error) =>
            !(
              // operation is not available in PingOne Advanced Identity Cloud
              (
                error.httpStatus === 403 &&
                error.httpMessage ===
                  'This operation is not available in PingOne Advanced Identity Cloud.'
              )
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
        ),
        `Error exporting idm config entity ${configEntity._id}`,
        readConfigEntity,
        { entityId: configEntity._id, state }
      )
    );
  }
  (await Promise.all(entityPromises))
    .filter((c) => c)
    .forEach((entity) => {
      if (entity) {
        const substitutedEntity = substituteEntityWithEnv(
          entity as IdObjectSkeletonInterface,
          state
        );
        exportData.idm[(entity as IdObjectSkeletonInterface)._id] =
          substitutedEntity;
        if (resultCallback) {
          resultCallback(undefined, substitutedEntity);
        }
      }
    });
  stopProgressIndicator({
    id: indicatorId,
    message: `Exported ${configurations.length} config entities.`,
    state,
  });
  return exportData;
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
    if (!isNotFoundError(error)) {
      throw new FrodoError(
        `Error checking if config entity ${entityId} already exists`,
        error
      );
    }
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
    entitiesToImport: undefined,
    validate: false,
  },
  resultCallback = void 0,
  state,
}: {
  entityId?: string;
  importData: ConfigEntityExportInterface;
  options: ConfigEntityImportOptions;
  resultCallback?: ResultCallback<IdObjectSkeletonInterface>;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  debugMessage({ message: `IdmConfigOps.importConfigEntities: start`, state });
  const response = [];
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
      const entityData = unSubstituteEntityWithEnv(importData.idm[id], state);
      if (
        options.validate &&
        !areScriptHooksValid({ jsonData: entityData, state })
      ) {
        throw new FrodoError(
          `Invalid script hook in the config object '${id}'`
        );
      }
      const result = await updateConfigEntity({
        entityId: id,
        entityData,
        state,
      });
      response.push(result);
      if (resultCallback) {
        resultCallback(undefined, result);
      }
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
        if (resultCallback) {
          resultCallback(error, undefined);
        } else {
          throw new FrodoError(
            `Error importing idm config entity ${id}`,
            error
          );
        }
      }
    }
  }
  debugMessage({ message: `IdmConfigOps.importConfigEntities: end`, state });
  return response;
}

export async function deleteConfigEntities({
  resultCallback = void 0,
  state,
}: {
  resultCallback?: ResultCallback<IdObjectSkeletonInterface>;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  debugMessage({
    message: `IdmConfigOps.deleteConfigEntities: start`,
    state,
  });
  const results: IdObjectSkeletonInterface[] = [];
  const configEntityStubs = await readConfigEntityStubs({ state });
  for (const configEntityStub of configEntityStubs) {
    debugMessage({
      message: `IdmConfigOps.deleteConfigEntities: '${configEntityStub['_id']}'`,
      state,
    });
    const result: IdObjectSkeletonInterface = await getResult(
      resultCallback,
      `Error deleting idm config entity ${configEntityStub._id}`,
      _deleteConfigEntity,
      {
        entityId: configEntityStub['_id'],
        state,
      }
    );
    if (result) {
      results.push(result);
    }
  }
  debugMessage({
    message: `IdmConfigOps.deleteConfigEntities: end`,
    state,
  });
  return results;
}

export async function deleteConfigEntitiesByType({
  type,
  resultCallback = void 0,
  state,
}: {
  type: string;
  resultCallback?: ResultCallback<IdObjectSkeletonInterface>;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  debugMessage({
    message: `IdmConfigOps.deleteConfigEntitiesByType: start`,
    state,
  });
  const results: IdObjectSkeletonInterface[] = [];
  const configEntities = await readConfigEntitiesByType({ type, state });
  for (const configEntity of configEntities) {
    debugMessage({
      message: `IdmConfigOps.deleteConfigEntitiesByType: '${configEntity['_id']}'`,
      state,
    });
    const result: IdObjectSkeletonInterface = await getResult(
      resultCallback,
      `Error deleting idm config entity ${configEntity._id}`,
      _deleteConfigEntity,
      {
        entityId: configEntity['_id'] as string,
        state,
      }
    );
    if (result) {
      results.push(result);
    }
  }
  debugMessage({
    message: `IdmConfigOps.deleteConfigEntitiesByType: end`,
    state,
  });
  return results;
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

export async function readSubConfigEntity({
  entityId,
  name,
  state,
}: {
  entityId: string;
  name: string;
  state: State;
}): Promise<NoIdObjectSkeletonInterface> {
  try {
    const entity = substituteEntityWithEnv(
      await readConfigEntity({ entityId, state }),
      state
    );

    const subEntityKey = Object.keys(entity).find((key) => key !== '_id');

    if (!Array.isArray(entity[subEntityKey])) {
      throw new FrodoError(`Error reading sub config ${entityId} ${name}`);
    }

    const subEntity = (
      entity[subEntityKey] as NoIdObjectSkeletonInterface[]
    ).find((item) => item.name === name);

    if (!subEntity) {
      throw new FrodoError(`Error reading sub config ${entityId} ${name}`);
    }
    return subEntity;
  } catch (error) {
    throw new FrodoError(`Error reading sub config ${entityId} ${name}`, error);
  }
}

export async function importSubConfigEntity({
  entityId,
  updatedSubConfigEntity,
  options = {
    entitiesToImport: undefined,
    validate: false,
  },
  state,
}: {
  entityId: string;
  updatedSubConfigEntity: IdObjectSkeletonInterface;
  options: ConfigEntityImportOptions;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  try {
    const entityExport = await exportConfigEntity({
      entityId,
      state,
    });

    const subEntityKey = Object.keys(entityExport.idm?.[entityId]).find(
      (key) => key !== '_id'
    );

    if (!Array.isArray(entityExport.idm?.[entityId]?.[subEntityKey])) {
      throw new FrodoError(`Error importing sub config of ${entityId}`);
    }

    const existingSubEntityIndex = (
      entityExport.idm?.[entityId]?.[
        subEntityKey
      ] as NoIdObjectSkeletonInterface[]
    ).findIndex((item) => item.name === updatedSubConfigEntity.name);

    if (existingSubEntityIndex !== -1) {
      (
        entityExport.idm[entityId][
          subEntityKey
        ] as NoIdObjectSkeletonInterface[]
      )[existingSubEntityIndex] = updatedSubConfigEntity;
    } else {
      (
        entityExport.idm[entityId][
          subEntityKey
        ] as NoIdObjectSkeletonInterface[]
      ).push(updatedSubConfigEntity);
    }

    return importConfigEntities({
      entityId,
      importData: entityExport,
      options,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error importing sub config ${entityId}`, error);
  }
}

function substituteEntityWithEnv(
  entity: IdObjectSkeletonInterface,
  state: State
): IdObjectSkeletonInterface {
  const envReplaceParams = Object.entries(state.getEnvs());
  if (!entity || envReplaceParams.length === 0) {
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
  state: State
): IdObjectSkeletonInterface {
  const envReplaceParams = Object.entries(state.getEnvs());
  if (!entity || envReplaceParams.length === 0) {
    return entity;
  }
  let configEntityString = stringify(entity);
  envReplaceParams.forEach(([key, value]) => {
    configEntityString = replaceall(`\${${key}}`, value, configEntityString);
  });
  return JSON.parse(configEntityString);
}
