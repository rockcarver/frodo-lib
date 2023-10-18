import { IdObjectSkeletonInterface, PagedResult } from '../api/ApiTypes';
import {
  authenticateSystemObject as _authenticateSystemObject,
  ConnectorServerStatusInterface,
  createSystemObject as _createSystemObject,
  DEFAULT_PAGE_SIZE,
  deleteSystemObject as _deleteSystemObject,
  getSystemObject as _getSystemObject,
  patchSystemObject as _patchSystemObject,
  putSystemObject as _putSystemObject,
  queryAllSystemObjectIds as _queryAllSystemObjectIds,
  querySystemObjects as _querySystemObjects,
  readAvailableSystems as _readAvailableSystems,
  readSystemStatus as _readSystemStatus,
  runSystemScript as _runSystemScript,
  SystemObjectPatchOperationInterface,
  SystemStatusInterface,
  testConnectorServers as _testConnectorServers,
} from '../api/IdmSystemApi';
import { State } from '../shared/State';

export type IdmSystem = {
  /**
   * Test connector servers
   * @returns {Promise<ConnectorServerStatusInterface[]>} a promise that resolves to an array of ConnectorServerStatusInterface objects
   */
  testConnectorServers(): Promise<ConnectorServerStatusInterface[]>;
  /**
   * Read available systems/connectors status
   * @returns {Promise<SystemStatusInterface[]>} a promise resolving to an array of system status objects
   */
  readAvailableSystems(): Promise<SystemStatusInterface[]>;
  /**
   * Read system/connector status
   * @returns {Promise<SystemStatusInterface>} a promise resolving to a system status object
   */
  readSystemStatus(systemName: string): Promise<SystemStatusInterface>;
  /**
   * Authenticate a system object using username and password (pass-through authentication)
   * @param {string} systemName name of system/connector
   * @param {string} systemObjectType type of system object
   * @param {string} username system object username
   * @param {string} password system object password
   * @returns {Promise<IdObjectSkeletonInterface>} a promise resolving to an IdObjectSkeletonInterface object containing only the _id
   */
  authenticateSystemObject(
    systemName: string,
    systemObjectType: string,
    username: string,
    password: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Run system script
   * @param {string} systemName name of system/connector
   * @param {string} scriptName name of script
   * @returns {Promise<any>} a promise resolving to a status object
   */
  runSystemScript(systemName: string, scriptName: string): Promise<any>;
  /**
   * Query all system object ids
   * @param {string} systemName name of system/connector
   * @param {string} systemObjectType type of system object
   * @param {number} pageSize page size (default value: 1000)
   * @param {string} pageCookie paged results cookie
   * @returns {Promise<PagedResult<IdObjectSkeletonInterface>>} a promise resolving to an array of IdObjectSkeletonInterface objects
   */
  queryAllSystemObjectIds(
    systemName: string,
    systemObjectType: string,
    pageSize?: number,
    pageCookie?: string
  ): Promise<PagedResult<IdObjectSkeletonInterface>>;
  /**
   * Query system objects using a search filter
   * @param {string} systemName name of system/connector
   * @param {string} systemObjectType type of system object
   * @param {string} filter search filter
   * @param {string[]} fields array of fields to return
   * @param {number} pageSize page size (default value: 1000)
   * @param {string} pageCookie paged results cookie
   * @returns {Promise<PagedResult<IdObjectSkeletonInterface>>} a promise resolving to an array of IdObjectSkeletonInterface objects
   */
  querySystemObjects(
    systemName: string,
    systemObjectType: string,
    filter: string,
    fields: string[],
    pageSize?: number,
    pageCookie?: string
  ): Promise<PagedResult<IdObjectSkeletonInterface>>;
  /**
   * Read system object
   * @param {string} systemName name of system/connector
   * @param {string} systemObjectType type of system object
   * @param {string} systemObjectId id of system object
   * @param {string[]} fields array of fields to return
   * @returns {Promise<IdObjectSkeletonInterface>} a promise resolving to an IdObjectSkeletonInterface object
   */
  readSystemObject(
    systemName: string,
    systemObjectType: string,
    systemObjectId: string,
    fields: string[]
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Create system object
   * @param {string} systemName name of system/connector
   * @param {string} systemObjectType type of system object
   * @param {IdObjectSkeletonInterface} systemObjectData system object data
   * @returns {Promise<IdObjectSkeletonInterface>} a promise resolving to an IdObjectSkeletonInterface object
   */
  createSystemObject(
    systemName: string,
    systemObjectType: string,
    systemObjectData: IdObjectSkeletonInterface
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Update or create system object
   * @param {string} systemName name of system/connector
   * @param {string} systemObjectType type of system object
   * @param {string} systemObjectId id of system object
   * @param {IdObjectSkeletonInterface} systemObjectData system object data
   * @param {boolean} failIfExists fail if object exists (default value: false)
   * @returns {Promise<IdObjectSkeletonInterface>} a promise resolving to an IdObjectSkeletonInterface object
   */
  updateSystemObject(
    systemName: string,
    systemObjectType: string,
    systemObjectId: string,
    systemObjectData: IdObjectSkeletonInterface,
    failIfExists?: boolean
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Partially update system object through a collection of patch operations.
   * @param {string} systemName name of system/connector
   * @param {string} systemObjectType type of system object
   * @param {string} systemObjectId id of system object
   * @param {SystemObjectPatchOperationInterface[]} operations collection of patch operations to perform on the object
   * @returns {Promise<IdObjectSkeletonInterface>} a promise resolving to an IdObjectSkeletonInterface object
   */
  updateSystemObjectProperties(
    systemName: string,
    systemObjectType: string,
    systemObjectId: string,
    operations: SystemObjectPatchOperationInterface[]
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Delete system object
   * @param {string} systemName name of system/connector
   * @param {string} systemObjectType type of system object
   * @param {string} systemObjectId id of system object
   * @returns {Promise<IdObjectSkeletonInterface>} a promise resolving to an IdObjectSkeletonInterface object
   */
  deleteSystemObject(
    systemName: string,
    systemObjectType: string,
    systemObjectId: string
  ): Promise<IdObjectSkeletonInterface>;
};

export default (state: State): IdmSystem => {
  return {
    async testConnectorServers(): Promise<ConnectorServerStatusInterface[]> {
      return testConnectorServers({ state });
    },
    async readAvailableSystems(): Promise<SystemStatusInterface[]> {
      return readAvailableSystems({ state });
    },
    async readSystemStatus(systemName: string): Promise<SystemStatusInterface> {
      return readSystemStatus({ systemName, state });
    },
    async authenticateSystemObject(
      systemName: string,
      systemObjectType: string,
      username: string,
      password: string
    ): Promise<IdObjectSkeletonInterface> {
      return authenticateSystemObject({
        systemName,
        systemObjectType,
        username,
        password,
        state,
      });
    },
    async runSystemScript(
      systemName: string,
      scriptName: string
    ): Promise<any> {
      return runSystemScript({ systemName, scriptName, state });
    },
    async queryAllSystemObjectIds(
      systemName: string,
      systemObjectType: string,
      pageSize: number = DEFAULT_PAGE_SIZE,
      pageCookie?: string
    ): Promise<PagedResult<IdObjectSkeletonInterface>> {
      return queryAllSystemObjectIds({
        systemName,
        systemObjectType,
        pageSize,
        pageCookie,
        state,
      });
    },
    async querySystemObjects(
      systemName: string,
      systemObjectType: string,
      filter: string = 'true',
      fields: string[] = ['*'],
      pageSize: number = DEFAULT_PAGE_SIZE,
      pageCookie: string = undefined
    ): Promise<PagedResult<IdObjectSkeletonInterface>> {
      return querySystemObjects({
        systemName,
        systemObjectType,
        filter,
        fields,
        pageSize,
        pageCookie,
        state,
      });
    },
    async readSystemObject(
      systemName: string,
      systemObjectType: string,
      systemObjectId: string,
      fields: string[]
    ): Promise<IdObjectSkeletonInterface> {
      return readSystemObject({
        systemName,
        systemObjectType,
        systemObjectId,
        fields,
        state,
      });
    },
    async createSystemObject(
      systemName: string,
      systemObjectType: string,
      systemObjectData: IdObjectSkeletonInterface
    ): Promise<IdObjectSkeletonInterface> {
      return createSystemObject({
        systemName,
        systemObjectType,
        systemObjectData,
        state,
      });
    },
    async updateSystemObject(
      systemName: string,
      systemObjectType: string,
      systemObjectId: string,
      systemObjectData: IdObjectSkeletonInterface,
      failIfExists = false
    ): Promise<IdObjectSkeletonInterface> {
      return updateSystemObject({
        systemName,
        systemObjectType,
        systemObjectId,
        systemObjectData,
        failIfExists,
        state,
      });
    },
    async updateSystemObjectProperties(
      systemName: string,
      systemObjectType: string,
      systemObjectId: string,
      operations: SystemObjectPatchOperationInterface[]
    ): Promise<IdObjectSkeletonInterface> {
      return updateSystemObjectProperties({
        systemName,
        systemObjectType,
        systemObjectId,
        operations,
        state,
      });
    },
    async deleteSystemObject(
      systemName: string,
      systemObjectType: string,
      systemObjectId: string
    ): Promise<IdObjectSkeletonInterface> {
      return deleteSystemObject({
        systemName,
        systemObjectType,
        systemObjectId,
        state,
      });
    },
  };
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

export async function readAvailableSystems({
  state,
}: {
  state: State;
}): Promise<SystemStatusInterface[]> {
  return _readAvailableSystems({ state });
}

export async function readSystemStatus({
  systemName,
  state,
}: {
  systemName: string;
  state: State;
}): Promise<SystemStatusInterface> {
  return _readSystemStatus({ systemName, state });
}

export async function authenticateSystemObject({
  systemName,
  systemObjectType,
  username,
  password,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  username: string;
  password: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  return _authenticateSystemObject({
    systemName,
    systemObjectType,
    username,
    password,
    state,
  });
}

export async function runSystemScript({
  systemName,
  scriptName,
  state,
}: {
  systemName: string;
  scriptName: string;
  state: State;
}) {
  return _runSystemScript({ systemName, scriptName, state });
}

export async function queryAllSystemObjectIds({
  systemName,
  systemObjectType,
  pageSize = DEFAULT_PAGE_SIZE,
  pageCookie = undefined,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  pageSize?: number;
  pageCookie?: string;
  state: State;
}): Promise<PagedResult<IdObjectSkeletonInterface>> {
  return _queryAllSystemObjectIds({
    systemName,
    systemObjectType,
    pageSize,
    pageCookie,
    state,
  });
}

export async function querySystemObjects({
  systemName,
  systemObjectType,
  filter,
  fields = ['*'],
  pageSize = DEFAULT_PAGE_SIZE,
  pageCookie = undefined,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  filter: string;
  fields: string[];
  pageSize?: number;
  pageCookie?: string;
  state: State;
}): Promise<PagedResult<IdObjectSkeletonInterface>> {
  return _querySystemObjects({
    systemName,
    systemObjectType,
    filter,
    fields,
    pageSize,
    pageCookie,
    state,
  });
}

export async function readSystemObject({
  systemName,
  systemObjectType,
  systemObjectId,
  fields = ['*'],
  state,
}: {
  systemName: string;
  systemObjectType: string;
  systemObjectId: string;
  fields: string[];
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  return _getSystemObject({
    systemName,
    systemObjectType,
    systemObjectId,
    fields,
    state,
  });
}

export async function createSystemObject({
  systemName,
  systemObjectType,
  systemObjectData,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  systemObjectData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  return _createSystemObject({
    systemName,
    systemObjectType,
    systemObjectData,
    state,
  });
}

export async function updateSystemObject({
  systemName,
  systemObjectType,
  systemObjectId,
  systemObjectData,
  failIfExists = false,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  systemObjectId: string;
  systemObjectData: IdObjectSkeletonInterface;
  failIfExists?: boolean;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  return _putSystemObject({
    systemName,
    systemObjectType,
    systemObjectId,
    systemObjectData,
    failIfExists,
    state,
  });
}

export async function updateSystemObjectProperties({
  systemName,
  systemObjectType,
  systemObjectId,
  operations,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  systemObjectId: string;
  operations: SystemObjectPatchOperationInterface[];
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  return _patchSystemObject({
    systemName,
    systemObjectType,
    systemObjectId,
    operations,
    state,
  });
}

export async function deleteSystemObject({
  systemName,
  systemObjectType,
  systemObjectId,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  systemObjectId: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  return _deleteSystemObject({
    systemName,
    systemObjectType,
    systemObjectId,
    state,
  });
}
