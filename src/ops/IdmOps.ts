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
  queryAllManagedObjectsByType,
} from '../api/IdmConfigApi';
import {
  testConnectorServers as _testConnectorServers,
  ConnectorServerStatusInterface,
} from '../api/IdmSystemApi';
import State from '../shared/State';

export default class IdmOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  getAllConfigEntities() {
    return getAllConfigEntities({ state: this.state });
  }

  getConfigEntitiesByType(type: string) {
    return getConfigEntitiesByType({ type, state: this.state });
  }

  getConfigEntity(entityId: string) {
    return getConfigEntity({ entityId, state: this.state });
  }

  putConfigEntity(entityId: string, entityData: NoIdObjectSkeletonInterface) {
    return putConfigEntity({ entityId, entityData, state: this.state });
  }

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
      state: this.state,
    });
  }

  /**
   * Test connector servers
   * @returns {Promise<ConnectorServerStatusInterface[]>} a promise that resolves to an array of ConnectorServerStatusInterface objects
   */
  async testConnectorServers(): Promise<ConnectorServerStatusInterface[]> {
    return testConnectorServers({ state: this.state });
  }
}

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
