import {
  IdObjectSkeletonInterface,
  NoIdObjectSkeletonInterface,
  PagedResult,
} from '../api/ApiTypes';
import {
  getAllConfigEntities,
  getConfigEntity,
  putConfigEntity,
  getConfigEntitiesByType,
} from '../api/IdmConfigApi';
import {
  testConnectorServers as _testConnectorServers,
  ConnectorServerStatusInterface,
} from '../api/IdmSystemApi';
import { queryAllManagedObjectsByType } from '../api/ManagedObjectApi';
import { State } from '../shared/State';

export type Idm = {
  getAllConfigEntities(): Promise<any>;
  getConfigEntitiesByType(type: string): Promise<any>;
  getConfigEntity(entityId: string): Promise<any>;
  putConfigEntity(
    entityId: string,
    entityData: NoIdObjectSkeletonInterface | string
  ): Promise<any>;
  /**
   * Query managed objects
   * @param {string} type managed object type
   * @param {string[]} fields fields to retrieve
   * @param {string} pageCookie paged results cookie
   * @returns {Promise<PagedResult<IdObjectSkeletonInterface>>} a promise that resolves to managed objects of the desired type
   */
  queryAllManagedObjectsByType(
    type: string,
    fields: string[],
    pageCookie: string
  ): Promise<PagedResult<IdObjectSkeletonInterface>>;
  /**
   * Test connector servers
   * @returns {Promise<ConnectorServerStatusInterface[]>} a promise that resolves to an array of ConnectorServerStatusInterface objects
   */
  testConnectorServers(): Promise<ConnectorServerStatusInterface[]>;
};

export default (state: State): Idm => {
  return {
    getAllConfigEntities() {
      return getAllConfigEntities({ state });
    },

    getConfigEntitiesByType(type: string) {
      return getConfigEntitiesByType({ type, state });
    },

    getConfigEntity(entityId: string) {
      return getConfigEntity({ entityId, state });
    },

    putConfigEntity(
      entityId: string,
      entityData: NoIdObjectSkeletonInterface | string
    ) {
      return putConfigEntity({ entityId, entityData, state });
    },

    /**
     * Query managed objects
     * @param {string} type managed object type
     * @param {string[]} fields fields to retrieve
     * @param {string} pageCookie paged results cookie
     * @returns {Promise<PagedResult<IdObjectSkeletonInterface>>} a promise that resolves to managed objects of the desired type
     */
    queryAllManagedObjectsByType(
      type: string,
      fields: string[],
      pageCookie: string
    ): Promise<PagedResult<IdObjectSkeletonInterface>> {
      return queryAllManagedObjectsByType({
        type,
        fields,
        pageCookie,
        state,
      });
    },

    /**
     * Test connector servers
     * @returns {Promise<ConnectorServerStatusInterface[]>} a promise that resolves to an array of ConnectorServerStatusInterface objects
     */
    async testConnectorServers(): Promise<ConnectorServerStatusInterface[]> {
      return testConnectorServers({ state });
    },
  };
};

export {
  getAllConfigEntities,
  getConfigEntitiesByType,
  getConfigEntity,
  putConfigEntity,
  queryAllManagedObjectsByType,
};

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
