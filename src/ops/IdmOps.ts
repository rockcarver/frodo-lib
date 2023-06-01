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
