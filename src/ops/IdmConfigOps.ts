import {
  IdObjectSkeletonInterface,
  NoIdObjectSkeletonInterface,
} from '../api/ApiTypes';
import {
  IdmConfigStub,
  getConfigStubs as _getConfigEntityStubs,
  getConfigEntity as _getConfigEntity,
  putConfigEntity as _putConfigEntity,
  getConfigEntitiesByType as _getConfigEntitiesByType,
  getConfigEntities as _getConfigEntities,
  getConfigEntity,
  deleteConfigEntity as _deleteConfigEntity,
} from '../api/IdmConfigApi';
import {
  testConnectorServers as _testConnectorServers,
  ConnectorServerStatusInterface,
} from '../api/IdmSystemApi';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';

export type IdmConfig = {
  /**
   * Get available config entity types
   * @returns {string[]} promise resolving to an array of config entity types
   */
  getConfigEntityTypes(): Promise<string[]>;
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
  /**
   * Test connector servers
   * @returns {Promise<ConnectorServerStatusInterface[]>} a promise that resolves to an array of ConnectorServerStatusInterface objects
   */
  testConnectorServers(): Promise<ConnectorServerStatusInterface[]>;

  // Deprecated

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
};

export default (state: State): IdmConfig => {
  return {
    async getConfigEntityTypes(): Promise<string[]> {
      return getConfigEntityTypes({ state });
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
    async testConnectorServers(): Promise<ConnectorServerStatusInterface[]> {
      return testConnectorServers({ state });
    },

    // Deprecated

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
  };
};

export async function readConfigEntityStubs({
  state,
}: {
  state: State;
}): Promise<IdmConfigStub[]> {
  const { configurations } = await _getConfigEntityStubs({ state });
  return configurations;
}

export async function getConfigEntityTypes({
  state,
}: {
  state: State;
}): Promise<string[]> {
  const types: string[] = [];
  const stubs = await readConfigEntityStubs({ state });
  for (const stub of stubs) {
    if (stub._id.split('/').length > 0) {
      const type = stub._id.split('/')[0];
      if (!types.includes(type)) types.push(type);
    }
  }
  return types;
}

export async function readConfigEntities({
  state,
}: {
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  const { result } = await _getConfigEntities({ state });
  return result;
}

export async function readConfigEntitiesByType({
  type,
  state,
}: {
  type: string;
  state: State;
}): Promise<NoIdObjectSkeletonInterface[]> {
  const { result } = await _getConfigEntitiesByType({ type, state });
  return result;
}

export async function readConfigEntity({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  return getConfigEntity({ entityId, state });
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
    const result = await updateConfigEntity({
      entityId,
      entityData,
      state,
    });
    debugMessage({ message: `IdmConfigOps.createConfigEntity: end`, state });
    return result;
  }
  throw new Error(`Config entity ${entityId} already exists!`);
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
  return _putConfigEntity({ entityId, entityData, state });
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
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Delete error:\n${errorMessages}`);
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
  const configEntities = await readConfigEntitiesByType({ type, state });
  for (const configEntity of configEntities) {
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
  }
  debugMessage({
    message: `IdmConfigOps.deleteConfigEntitiesByType: end`,
    state,
  });
  return result;
}

export async function deleteConfigEntity({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  return _deleteConfigEntity({ entityId, state });
}

/**
 * Test connector servers
 * @returns {Promise<ConnectorServerStatusInterface[]>} a promise that resolves to an array of ConnectorServerStatusInterface objects
 */
export async function testConnectorServers({
  state,
}: {
  state: State;
}): Promise<ConnectorServerStatusInterface[]> {
  const response = await _testConnectorServers({ state });
  return response.openicf;
}
