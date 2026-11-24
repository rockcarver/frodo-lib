import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  deleteConfigEntity,
  getConfigEntitiesByType,
  getConfigEntity,
  patchConfigEntity,
  putConfigEntity,
} from '../api/IdmConfigApi';
import { readSystemStatus } from '../api/IdmSystemApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { FrodoError, isNotFoundError } from './FrodoError';
import { readConfigEntitiesByType } from './IdmConfigOps';
import { getManagedApplicationTypeOfRealm } from './internal/ManagedApplicationType';
import {
  defineReferenceSource,
  findReferencesForIds,
  type ReferenceLookupResult,
  type ReferenceSource,
} from './internal/ReferenceLookup';
import { readManagedObjects } from './ManagedObjectOps';
import {
  deleteMapping,
  MappingSkeleton,
  readMappings,
  updateMapping,
} from './MappingOps';
import {
  ExportMetaData,
  type ObjectReference,
  type ResultCallback,
} from './OpsTypes';
import { getRealms } from './RealmOps';

export type Connector = {
  /**
   * Connector type key used to build the IDM id: '<type>/<id>'
   */
  CONNECTOR_TYPE: string;
  /**
   * Create an empty connector export template
   * @returns {ConnectorExportInterface} an empty connector export template
   */
  createConnectorExportTemplate(): ConnectorExportInterface;
  /**
   * Get all connectors with ids starting with `provisioner.openicf/`,
   * excluding non-connector configurations such as the connector info provider.
   * @returns {Promise<ConnectorSkeleton[]>} a promise that resolves to an array of connector objects
   */
  readConnectors(): Promise<ConnectorSkeleton[]>;
  /**
   * Get connector
   * @param {string} connectorId id/name of the connector without the type prefix
   * @returns {Promise<ConnectorSkeleton>} a promise that resolves an connector object
   */
  readConnector(connectorId: string): Promise<ConnectorSkeleton>;
  /**
   * Create connector
   * @param {string} connectorId id/name of the connector without the type prefix
   * @param {ConnectorSkeleton} connectorData connector object
   * @returns {Promise<ConnectorSkeleton>} a promise that resolves to an connector object
   */
  createConnector(
    connectorId: string,
    connectorData: ConnectorSkeleton
  ): Promise<ConnectorSkeleton>;
  /**
   * Update or create connector
   * @param {string} connectorId id/name of the connector without the type prefix
   * @param {ConnectorSkeleton} connectorData connector object
   * @returns {Promise<ConnectorSkeleton>} a promise that resolves to an connector object
   */
  updateConnector(
    connectorId: string,
    connectorData: ConnectorSkeleton
  ): Promise<ConnectorSkeleton>;
  /**
   * Delete all connectors
   * @param {boolean} deep deep delete (remove dependencies)
   * @returns {Promise<ConnectorSkeleton[]>} a promise that resolves to an array of connector objects
   */
  deleteConnectors(deep?: boolean): Promise<ConnectorSkeleton[]>;
  /**
   * Delete connector
   * @param {string} connectorId id/name of the connector without the type prefix
   * @param {boolean} deep deep delete (remove dependencies)
   * @returns {Promise<ConnectorSkeleton>} a promise that resolves an connector object
   */
  deleteConnector(
    connectorId: string,
    deep?: boolean
  ): Promise<ConnectorSkeleton>;
  /**
   * Export connector
   * @param {string} connectorId id/name of the connector without the type prefix
   * @param {ConnectorExportOptions} options export options
   * @returns {Promise<ConnectorExportInterface>} a promise that resolves to a ConnectorExportInterface object
   */
  exportConnector(
    connectorId: string,
    options?: ConnectorExportOptions
  ): Promise<ConnectorExportInterface>;
  /**
   * Export all connectors
   * @returns {Promise<ConnectorExportInterface>} a promise that resolves to a ConnectorExportInterface object
   */
  exportConnectors(): Promise<ConnectorExportInterface>;
  /**
   * Import connector
   * @param {string} connectorId id/name of the connector without the type prefix
   * @param {ConnectorExportInterface} importData import data
   * @param {ConnectorImportOptions} options import options
   * @returns {Promise<ConnectorSkeleton>} a promise resolving to a ConnectorSkeleton object
   */
  importConnector(
    connectorId: string,
    importData: ConnectorExportInterface,
    options?: ConnectorImportOptions
  ): Promise<ConnectorSkeleton>;
  /**
   * Import first connector
   * @param {ConnectorExportInterface} importData import data
   * @param {ConnectorImportOptions} options import options
   * @returns {Promise<ConnectorSkeleton>} a promise resolving to a ConnectorSkeleton object
   */
  importFirstConnector(
    importData: ConnectorExportInterface,
    options?: ConnectorImportOptions
  ): Promise<ConnectorSkeleton>;
  /**
   * Import all connectors. Every connector is tried: a connector that cannot be imported does not stop the others.
   * @param {ConnectorExportInterface} importData import data
   * @param {ConnectorImportOptions} options import options
   * @param {ResultCallback<ConnectorSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every connector is passed to it as it happens (a failed connector as an error that names it, with the cause nested) and a failed connector does not throw: the connectors that could be imported are returned. Without it, the failures are collected and thrown as one error after every connector was tried.
   * @returns {Promise<ConnectorSkeleton[]>} a promise resolving to an array of ConnectorSkeleton objects
   */
  importConnectors(
    importData: ConnectorExportInterface,
    options?: ConnectorImportOptions,
    resultCallback?: ResultCallback<ConnectorSkeleton>
  ): Promise<ConnectorSkeleton[]>;
  /**
   * Enable a connector, the way the Admin UI does it, and wait until the connector answers its connection test. A connector that is enabled already is left alone (`changed` is false) but is still waited for. A connector that is enabled but does not answer in time is not an error: `ready` is false and `error` holds the last answer of the test.
   * @param {string} connectorId id/name of the connector without the type prefix
   * @param {ConnectorEnableOptions} options how long to wait for the connector to answer (milliseconds)
   * @returns {Promise<ConnectorStateResult>} a promise that resolves to the connector configuration after the change and whether the connector answers
   */
  enableConnector(
    connectorId: string,
    options?: ConnectorEnableOptions
  ): Promise<ConnectorStateResult>;
  /**
   * Disable a connector, the way the Admin UI does it. A connector that is disabled already is left alone (`changed` is false). A disabled connector is not a registered system any more, so there is nothing to wait for.
   * @param {string} connectorId id/name of the connector without the type prefix
   * @returns {Promise<ConnectorStateResult>} a promise that resolves to the connector configuration after the change
   */
  disableConnector(connectorId: string): Promise<ConnectorStateResult>;
  /**
   * Check if a connector is enabled. A configuration without an `enabled` flag counts as enabled, as it does in IDM.
   * @param {string} connectorId id/name of the connector without the type prefix
   * @returns {Promise<boolean>} a promise that resolves to true if the connector is enabled, false if it is disabled
   */
  isConnectorEnabled(connectorId: string): Promise<boolean>;
  /**
   * Read whether each connector is enabled, in one request
   * @returns {Promise<Record<string, boolean>>} a promise that resolves to an object that maps the id/name of each connector (without the type prefix) to whether it is enabled
   */
  readConnectorEnabledStates(): Promise<Record<string, boolean>>;
  /**
   * Find what still names a connector definition, in the whole tenant, before it is deleted. Every source is read once, together, and the answer is joined in memory: the mappings (a `source` or `target` that starts with `system/<id>/`, in the `sync` configuration and in the `mapping/` configurations; a mapping that is stored in both is one reference per field, not two), the applications of every realm (`connectorId`), the schedules (`invokeContext.source`) and the login configuration (a `queryOnResource` or `passthroughAuth` value, the key compared ignoring case). That is about seven requests on Cloud with two realms (one more for each further realm) however many ids are looked up. The connector does not have to exist, so the same call after a delete lists what now points at nothing. Each reference has a source (`mapping`, `application`, `schedule` or `authentication-module`; one reference per module name and field), a dependency flag (all four are `hard`: the holder breaks at run time without the connector), the id of the holder and `from`, the field that holds the name; an application also has its realm. The answer is ordered by source, then by id and field. Not read, and so not seen: connector names inside script text, route patterns of the access configuration, link tables, running reconciliations, governance applications, other tenants and environments, and clients that call `system/<id>/` over REST; also an entry of the `sync` configuration that has no `name` (it cannot be addressed, so it is left out even when its `source` or `target` names the connector). An empty list is never proof that a connector is unused: it means only that none of those sources names it. Fails closed: if any source cannot be read in full, every source is still attempted and one error is thrown that names each source that failed; there is no partial list. A source that is not there (no `sync` configuration, no `authentication` configuration, a realm without applications) is none, not a failure. Read-only; it does not say what the platform does when the connector is deleted. A caller that holds a value that is either one id or a list calls the form that fits it (`Array.isArray` tells which): the two forms answer differently, so there is no single signature for the union.
   * @param {string} connectorId id/name of the connector without the type prefix
   * @returns {Promise<ConnectorReference[]>} a promise that resolves to every reference found
   */
  findConnectorReferences(connectorId: string): Promise<ConnectorReference[]>;
  /**
   * The same lookup for a list of connectors, with one set of reads whatever the number of ids. This form does not fail when a source cannot be read: it answers with what it found and names the sources it could not read in `unreadable`, so that a caller can list the holders it found and say what it could not check (an empty `unreadable` means every source was read). `references` is an object with one entry per distinct id, and an id that nothing names has an empty list; read it by key, because an object does not promise the order of its keys (JavaScript lists keys that look like integers first). It has no prototype, so an id such as `__proto__` is a plain key. An empty list is answered with an empty result and no request. A blank or non-string id in the list throws before anything is read. Everything the single form says about what is read and not seen holds here too, and an empty list for an id is never proof that the connector is unused.
   * @param {string[]} connectorIds ids/names of the connectors without the type prefix
   * @returns {Promise<object>} a promise that resolves to an object with `references` (the references to each id, as the single form returns them) and `unreadable` (the sources that could not be read)
   */
  findConnectorReferences(
    connectorIds: string[]
  ): Promise<
    ReferenceLookupResult<ConnectorReference['source'], ConnectorReference>
  >;
  /**
   * Find what still names a connector server, that is an entry of `remoteConnectorClients` of the `provisioner.openicf.connectorinfoprovider` configuration, by its name. Both sources are read once, together, and the answer is joined in memory: the server clusters (`remoteConnectorClientsGroups`: a cluster whose `serversList` has an entry with the name) and the connector definitions (`connectorRef.connectorHostRef` equal to the name). That is two requests however many names are looked up. The server does not have to exist, so the same call after a delete lists what now points at nothing. Each reference has a source and a dependency flag: `server-cluster` is `soft` (the cluster works with its other servers) and `connector` is `hard` (the connector cannot reach its system without the server), the id of the holder (the cluster name, or the connector name without the type prefix) and `from`, the field that holds the name (`serversList`, `connectorRef.connectorHostRef`). One reference per cluster, however often it lists the name. The answer is ordered by source, then by id. A connector that names a server cluster is not reported as a holder of the servers in that cluster, and the entries of `remoteConnectorServers` and `remoteConnectorServersGroups` (the platform as the client) are not read. Not read, and so not seen: the connector server process itself, any OAuth2 client that a platform keeps for a connector server, script text, other tenants and environments. An empty list is never proof that a server is unused: it means only that none of those sources names it. Fails closed: if any source cannot be read in full, every source is still attempted and one error is thrown that names each source that failed; there is no partial list. A source that is not there (no cluster list, no `provisioner.openicf.connectorinfoprovider` configuration) is none, not a failure. Read-only; it does not say what the platform does when the server is deleted. A caller that holds a value that is either one name or a list calls the form that fits it (`Array.isArray` tells which): the two forms answer differently, so there is no single signature for the union.
   * @param {string} serverName name of the connector server
   * @returns {Promise<ConnectorServerReference[]>} a promise that resolves to every reference found
   */
  findConnectorServerReferences(
    serverName: string
  ): Promise<ConnectorServerReference[]>;
  /**
   * The same lookup for a list of connector servers, with one set of reads whatever the number of names. This form does not fail when a source cannot be read: it answers with what it found and names the sources it could not read in `unreadable`, so that a caller can list the holders it found and say what it could not check (an empty `unreadable` means every source was read). `references` is an object with one entry per distinct name, and a name that nothing names has an empty list; read it by key, because an object does not promise the order of its keys (JavaScript lists keys that look like integers first). It has no prototype, so a name such as `__proto__` is a plain key. An empty list is answered with an empty result and no request. A blank or non-string name in the list throws before anything is read. Everything the single form says about what is read and not seen holds here too, and an empty list for a name is never proof that the server is unused.
   * @param {string[]} serverNames names of the connector servers
   * @returns {Promise<object>} a promise that resolves to an object with `references` (the references to each name, as the single form returns them) and `unreadable` (the sources that could not be read)
   */
  findConnectorServerReferences(
    serverNames: string[]
  ): Promise<
    ReferenceLookupResult<
      ConnectorServerReference['source'],
      ConnectorServerReference
    >
  >;
};

export default (state: State): Connector => {
  return {
    CONNECTOR_TYPE,
    createConnectorExportTemplate(): ConnectorExportInterface {
      return createConnectorExportTemplate({ state });
    },
    async readConnectors(): Promise<ConnectorSkeleton[]> {
      return readConnectors({ state });
    },
    async readConnector(connectorId: string): Promise<ConnectorSkeleton> {
      return readConnector({ connectorId, state });
    },
    async createConnector(
      connectorId: string,
      connectorData: ConnectorSkeleton
    ): Promise<ConnectorSkeleton> {
      return createConnector({
        connectorId,
        connectorData,
        state,
      });
    },
    async updateConnector(
      connectorId: string,
      connectorData: ConnectorSkeleton
    ): Promise<ConnectorSkeleton> {
      return updateConnector({
        connectorId,
        connectorData,
        state,
      });
    },
    async deleteConnectors(deep = false): Promise<ConnectorSkeleton[]> {
      return deleteConnectors({ deep, state });
    },
    async deleteConnector(
      connectorId: string,
      deep = false
    ): Promise<ConnectorSkeleton> {
      return deleteConnector({ connectorId, deep, state });
    },
    async exportConnector(
      connectorId: string,
      options: ConnectorExportOptions = { deps: true, useStringArrays: true }
    ): Promise<ConnectorExportInterface> {
      return exportConnector({ connectorId, options, state });
    },
    async exportConnectors(): Promise<ConnectorExportInterface> {
      return exportConnectors({ state });
    },
    async importConnector(
      connectorId: string,
      importData: ConnectorExportInterface,
      options?: ConnectorImportOptions
    ): Promise<ConnectorSkeleton> {
      return importConnector({ connectorId, importData, options, state });
    },
    async importFirstConnector(
      importData: ConnectorExportInterface,
      options?: ConnectorImportOptions
    ): Promise<ConnectorSkeleton> {
      return importFirstConnector({ importData, options, state });
    },
    async importConnectors(
      importData: ConnectorExportInterface,
      options?: ConnectorImportOptions,
      resultCallback?: ResultCallback<ConnectorSkeleton>
    ): Promise<ConnectorSkeleton[]> {
      return importConnectors({ importData, options, resultCallback, state });
    },
    async enableConnector(
      connectorId: string,
      options?: ConnectorEnableOptions
    ): Promise<ConnectorStateResult> {
      return enableConnector({ connectorId, options, state });
    },
    async disableConnector(connectorId: string): Promise<ConnectorStateResult> {
      return disableConnector({ connectorId, state });
    },
    async isConnectorEnabled(connectorId: string): Promise<boolean> {
      return isConnectorEnabled({ connectorId, state });
    },
    async readConnectorEnabledStates(): Promise<Record<string, boolean>> {
      return readConnectorEnabledStates({ state });
    },
    // one id answers a list, a list of ids answers an object: the overloads of
    // the type say which, this delegates both to the one function
    findConnectorReferences: (async (connectorIds: string | string[]) =>
      findConnectorReferences({
        connectorIds,
        state,
      })) as Connector['findConnectorReferences'],
    findConnectorServerReferences: (async (serverNames: string | string[]) =>
      findConnectorServerReferences({
        serverNames,
        state,
      })) as Connector['findConnectorServerReferences'],
  };
};

/**
 * Connector type key used to build the IDM id: '\<type>/\<id>'
 */
export const CONNECTOR_TYPE = 'provisioner.openicf';

export type ObjectPropertyFlag =
  | 'NOT_CREATABLE'
  | 'NOT_READABLE'
  | 'NOT_RETURNED_BY_DEFAULT'
  | 'NOT_UPDATEABLE';

export type ObjectPropertyType = 'array' | 'boolean' | 'string';

export type ObjectPropertyNativeType =
  | 'array'
  | 'boolean'
  | 'string'
  | 'JAVA_TYPE_BIGDECIMAL'
  | 'JAVA_TYPE_BIGINTEGER'
  | 'JAVA_TYPE_BYTE'
  | 'JAVA_TYPE_BYTE_ARRAY'
  | 'JAVA_TYPE_CHAR'
  | 'JAVA_TYPE_CHARACTER'
  | 'JAVA_TYPE_DATE'
  | 'JAVA_TYPE_DOUBLE'
  | 'JAVA_TYPE_FILE'
  | 'JAVA_TYPE_FLOAT'
  | 'JAVA_TYPE_GUARDEDBYTEARRAY'
  | 'JAVA_TYPE_GUARDEDSTRING'
  | 'JAVA_TYPE_INT'
  | 'JAVA_TYPE_INTEGER'
  | 'JAVA_TYPE_LONG'
  | 'JAVA_TYPE_OBJECT'
  | 'JAVA_TYPE_PRIMITIVE_BOOLEAN'
  | 'JAVA_TYPE_PRIMITIVE_BYTE'
  | 'JAVA_TYPE_PRIMITIVE_DOUBLE'
  | 'JAVA_TYPE_PRIMITIVE_FLOAT'
  | 'JAVA_TYPE_PRIMITIVE_LONG'
  | 'JAVA_TYPE_STRING';

export type ObjectPropertySkeleton = {
  flags?: ObjectPropertyFlag[];
  nativeName: string;
  nativeType: ObjectPropertyNativeType;
  type: ObjectPropertyType;
  runAsUser?: boolean;
  required?: boolean;
  items?: {
    nativeType: ObjectPropertyNativeType;
    type: ObjectPropertyType;
  };
};

export type ObjectTypeSkeleton = {
  $schema: string;
  id: string;
  nativeType: string;
  properties: Record<string, ObjectPropertySkeleton>;
  type: 'object';
};

export type ConnectorSkeleton = IdObjectSkeletonInterface & {
  configurationProperties: any;
  connectorRef: {
    bundleName: string;
    bundleVersion: string;
    connectorHostRef: string;
    connectorName: string;
    displayName: string;
    systemType: 'provisioner.openicf';
  };
  enabled: boolean;
  objectTypes: Record<string, ObjectTypeSkeleton>;
};

/**
 * Connector export options
 */
export interface ConnectorExportOptions {
  /**
   * Use string arrays to store multi-line text in scripts.
   */
  useStringArrays: boolean;
  /**
   * Include any dependencies (mappings).
   */
  deps: boolean;
}

/**
 * Connector import options
 */
export interface ConnectorImportOptions {
  /**
   * Include any dependencies (mappings).
   */
  deps: boolean;
}

/**
 * Options of enabling a connector
 */
export interface ConnectorEnableOptions {
  /**
   * How long to wait, in milliseconds, for the connector to answer its connection test after it was enabled. 0 tests once. Default: 30000
   */
  timeout?: number;
  /**
   * How long to wait, in milliseconds, between two connection tests. Default: 500
   */
  interval?: number;
}

/**
 * The result of enabling or disabling a connector
 */
export interface ConnectorStateResult {
  /**
   * id/name of the connector without the type prefix
   */
  connectorId: string;
  /**
   * The connector configuration after the call
   */
  connector: ConnectorSkeleton;
  /**
   * Whether the connector is enabled after the call
   */
  enabled: boolean;
  /**
   * False if the connector was in the requested state already and nothing was written
   */
  changed: boolean;
  /**
   * Enabling only: whether the connector answered its connection test within the timeout
   */
  ready?: boolean;
  /**
   * Enabling only: the last answer of the connection test, if the connector did not answer within the timeout
   */
  error?: string;
}

export interface ConnectorExportInterface {
  meta?: ExportMetaData;
  connector: Record<string, ConnectorSkeleton>;
  mapping?: Record<string, MappingSkeleton>;
}

export function createConnectorExportTemplate({
  state,
}: {
  state: State;
}): ConnectorExportInterface {
  return {
    meta: getMetadata({ state }),
    connector: {},
    mapping: {},
  } as ConnectorExportInterface;
}

/**
 * Get all connectors with ids starting with `provisioner.openicf/`,
 * excluding non-connector configurations such as the connector info provider.
 * @returns {Promise<ConnectorSkeleton[]>} a promise that resolves to an array of connector objects
 */
export async function readConnectors({
  state,
}: {
  state: State;
}): Promise<ConnectorSkeleton[]> {
  try {
    const connectors = await readConfigEntitiesByType({
      type: CONNECTOR_TYPE,
      state,
    });
    return connectors.filter(
      (connector) =>
        typeof connector._id === 'string' &&
        connector._id.startsWith(`${CONNECTOR_TYPE}/`)
    ) as ConnectorSkeleton[];
  } catch (error) {
    throw new FrodoError(`Error reading connectors`, error);
  }
}

/**
 * Get connector
 * @param {string} connectorId id/name of the connector without the type prefix
 * @returns {Promise<ConnectorSkeleton>} a promise that resolves an connector object
 */
export async function readConnector({
  connectorId,
  state,
}: {
  connectorId: string;
  state: State;
}): Promise<ConnectorSkeleton> {
  try {
    debugMessage({
      message: `ConnectorOps.readConnector: start [connector=${connectorId}]`,
      state,
    });
    const entityId = `${CONNECTOR_TYPE}/${connectorId}`;
    debugMessage({
      message: `ConnectorOps.readConnector: use entity id: ${entityId}`,
      state,
    });
    const connectorData = await getConfigEntity({
      entityId,
      state,
    });
    debugMessage({
      message: `ConnectorOps.readConnector: end [connector=${connectorId}]`,
      state,
    });
    return connectorData;
  } catch (error) {
    throw new FrodoError(`Error reading connector ${connectorId}`, error);
  }
}

/**
 * Create connector
 * @param {string} connectorId id/name of the connector without the type prefix
 * @param {ConnectorSkeleton} connectorData connector object
 * @returns {Promise<ConnectorSkeleton>} a promise that resolves to an connector object
 */
export async function createConnector({
  connectorId,
  connectorData,
  state,
}: {
  connectorId: string;
  connectorData: ConnectorSkeleton;
  state: State;
}): Promise<ConnectorSkeleton> {
  debugMessage({
    message: `ConnectorOps.createConnector: start`,
    state,
  });
  try {
    await readConnector({
      connectorId: connectorId,
      state,
    });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw new FrodoError(
        `Error checking if connector ${connectorId} already exists`,
        error
      );
    }
    try {
      const result = await putConfigEntity({
        entityId: `${CONNECTOR_TYPE}/${connectorId}`,
        entityData: connectorData,
        state,
      });
      debugMessage({
        message: `ConnectorOps.createConnector: end`,
        state,
      });
      return result as ConnectorSkeleton;
    } catch (error) {
      throw new FrodoError(`Error creating connector ${connectorId}`, error);
    }
  }
  throw new FrodoError(`Connector ${connectorId} already exists!`);
}

/**
 * Update or create connector
 * @param {string} connectorId id/name of the connector without the type prefix
 * @param {ConnectorSkeleton} connectorData connector object
 * @returns {Promise<ConnectorSkeleton>} a promise that resolves to an connector object
 */
export async function updateConnector({
  connectorId,
  connectorData,
  state,
}: {
  connectorId: string;
  connectorData: ConnectorSkeleton;
  state: State;
}): Promise<ConnectorSkeleton> {
  try {
    const connector = await putConfigEntity({
      entityId: `${CONNECTOR_TYPE}/${connectorId}`,
      entityData: connectorData,
      state,
    });
    return connector as ConnectorSkeleton;
  } catch (error) {
    throw new FrodoError(`Error updating connector ${connectorId}`, error);
  }
}

/**
 * Delete all connectors
 * @param {boolean} deep deep delete (remove dependencies)
 * @returns {Promise<ConnectorSkeleton[]>} a promise that resolves to an array of connector objects
 */
export async function deleteConnectors({
  deep = false,
  state,
}: {
  deep?: boolean;
  state: State;
}): Promise<ConnectorSkeleton[]> {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `ConnectorOps.deleteConnectors: start`,
      state,
    });
    const result: ConnectorSkeleton[] = [];
    const connectors = await readConnectors({ state });
    for (const connector of connectors) {
      try {
        const connectorId = connector._id;
        debugMessage({
          message: `ConnectorOps.deleteConnectors: '${connectorId}'`,
          state,
        });
        if (deep) {
          const mappings = await readMappings({ connectorId, state });
          for (const mapping of mappings) {
            await deleteMapping({
              mappingId: mapping._id,
              state,
            });
          }
        }
        result.push(
          (await deleteConfigEntity({
            entityId: connectorId,
            state,
          })) as ConnectorSkeleton
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting connectors`, errors);
    }
    debugMessage({
      message: `ConnectorOps.deleteConnectors: end`,
      state,
    });
    return result;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting connectors`, error);
  }
}

/**
 * Delete connector
 * @param {string} connectorId id/name of the connector without the type prefix
 * @param {boolean} deep deep delete (remove dependencies)
 * @returns {Promise<ConnectorSkeleton>} a promise that resolves an connector object
 */
export async function deleteConnector({
  connectorId,
  deep = false,
  state,
}: {
  connectorId: string;
  deep?: boolean;
  state: State;
}): Promise<ConnectorSkeleton> {
  try {
    if (deep) {
      const mappings = await readMappings({ connectorId, state });
      for (const mapping of mappings) {
        await deleteMapping({
          mappingId: mapping._id,
          state,
        });
      }
    }
    const connector = await deleteConfigEntity({
      entityId: `${CONNECTOR_TYPE}/${connectorId}`,
      state,
    });
    return connector as ConnectorSkeleton;
  } catch (error) {
    throw new FrodoError(`Error deleting connector ${connectorId}`, error);
  }
}

/**
 * Export connector
 * @param {string} connectorId id/name of the connector without the type prefix
 * @returns {Promise<ConnectorExportInterface>} a promise that resolves to a ConnectorExportInterface object
 */
export async function exportConnector({
  connectorId,
  options = { deps: true, useStringArrays: true },
  state,
}: {
  connectorId: string;
  options?: ConnectorExportOptions;
  state: State;
}): Promise<ConnectorExportInterface> {
  try {
    debugMessage({
      message: `ConnectorOps.exportConnector: start [connector=${connectorId}]`,
      state,
    });
    const connectorData = await readConnector({ connectorId, state });
    const exportData = createConnectorExportTemplate({ state });
    exportData.connector[connectorId] = connectorData;
    if (options.deps) {
      const mappings = await readMappings({ connectorId, state });
      for (const mapping of mappings) {
        exportData.mapping[mapping.name] = mapping;
      }
    }
    debugMessage({ message: `ConnectorOps.exportConnector: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting connector ${connectorId}`, error);
  }
}

/**
 * Export all connectors
 * @returns {Promise<ConnectorExportInterface>} a promise that resolves to a ConnectorExportInterface object
 */
export async function exportConnectors({
  state,
}: {
  state: State;
}): Promise<ConnectorExportInterface> {
  try {
    const exportData = createConnectorExportTemplate({ state });
    const allConnectorsData = await readConnectors({ state });
    const indicatorId = createProgressIndicator({
      total: allConnectorsData.length,
      message: 'Exporting connectors',
      state,
    });
    for (const connectorData of allConnectorsData) {
      const connectorId = connectorData._id.split('/')[1];
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting connector ${connectorId}`,
        state,
      });
      exportData.connector[connectorId] = connectorData;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `${allConnectorsData.length} connectors exported.`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting connectors`, error);
  }
}

/**
 * Import connector
 * @param {string} connectorId id/name of the connector without the type prefix
 * @param {ConnectorExportInterface} importData import data
 * @param {ConnectorImportOptions} options import options
 * @returns {Promise<ConnectorSkeleton>} a promise resolving to a ConnectorSkeleton object
 */
export async function importConnector({
  connectorId,
  importData,
  options = { deps: true },
  state,
}: {
  connectorId: string;
  importData: ConnectorExportInterface;
  options?: ConnectorImportOptions;
  state: State;
}): Promise<ConnectorSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const key of Object.keys(importData.connector)) {
    if (key === connectorId) {
      try {
        response = await updateConnector({
          connectorId,
          connectorData: importData.connector[connectorId],
          state,
        });
        if (options.deps) {
          for (const connKey of Object.keys(importData.mapping)) {
            response = await updateMapping({
              mappingId: importData.mapping[connKey]._id,
              mappingData: importData.mapping[connKey],
              state,
            });
          }
        }
        imported.push(key);
      } catch (error) {
        errors.push(error);
      }
      break;
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing connector ${connectorId}`, errors);
  }
  if (0 === imported.length) {
    throw new FrodoError(`Connector ${connectorId} not found in import data!`);
  }
  return response;
}

/**
 * Import first connector
 * @param {ConnectorExportInterface} importData import data
 * @param {ConnectorImportOptions} options import options
 * @returns {Promise<ConnectorSkeleton>} a promise resolving to a ConnectorSkeleton object
 */
export async function importFirstConnector({
  importData,
  options = { deps: true },
  state,
}: {
  importData: ConnectorExportInterface;
  options?: ConnectorImportOptions;
  state: State;
}): Promise<ConnectorSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const key of Object.keys(importData.connector)) {
    try {
      if (options.deps) {
        //
      }
      response = await updateConnector({
        connectorId: key,
        connectorData: importData.connector[key],
        state,
      });
      imported.push(key);
    } catch (error) {
      errors.push(error);
    }
    break;
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing first connector`, errors);
  }
  if (0 === imported.length) {
    throw new FrodoError(`No connectors not found in import data!`);
  }
  return response;
}

/**
 * Import all connectors. Every connector is tried: a connector that cannot be imported does not stop the others.
 * @param {ConnectorExportInterface} importData import data
 * @param {ConnectorImportOptions} options import options
 * @param {ResultCallback<ConnectorSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every connector is passed to it as it happens (a failed connector as an error that names it, with the cause nested) and a failed connector does not throw: the connectors that could be imported are returned. Without it, the failures are collected and thrown as one error after every connector was tried.
 * @returns {Promise<ConnectorSkeleton[]>} a promise resolving to an array of ConnectorSkeleton objects
 * @throws {FrodoError} If one or more connectors cannot be imported and there is no result callback. The error carries one nested error per failed connector.
 */
export async function importConnectors({
  importData,
  options = { deps: true },
  resultCallback = undefined,
  state,
}: {
  importData: ConnectorExportInterface;
  options?: ConnectorImportOptions;
  resultCallback?: ResultCallback<ConnectorSkeleton>;
  state: State;
}): Promise<ConnectorSkeleton[]> {
  const response = [];
  const errors = [];
  for (const key of Object.keys(importData.connector)) {
    let imported: ConnectorSkeleton;
    let failed = false;
    let failure: unknown;
    try {
      if (options.deps) {
        //
      }
      imported = await updateConnector({
        connectorId: key,
        connectorData: importData.connector[key],
        state,
      });
    } catch (error) {
      failed = true;
      failure = error;
    }
    // the callback is called outside the try: an exception of the callback
    // must not be taken for a failed import and reported a second time
    if (!failed) {
      response.push(imported);
      if (resultCallback) resultCallback(undefined, imported);
    } else if (resultCallback) {
      resultCallback(
        new FrodoError(`Error importing connector ${key}`, failure as Error),
        undefined
      );
    } else {
      errors.push(failure);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing connectors`, errors);
  }
  return response;
}

/**
 * How long to wait for an enabled connector to answer its connection test: milliseconds
 */
const DEFAULT_READY_TIMEOUT = 30000;

/**
 * How long to wait between two connection tests of an enabled connector: milliseconds
 */
const DEFAULT_READY_INTERVAL = 500;

/**
 * Whether a connector configuration is enabled. IDM treats a configuration without the flag as enabled.
 * @param {ConnectorSkeleton} connector connector configuration
 * @returns {boolean} true if the connector is enabled
 */
function isEnabledConfiguration(connector: ConnectorSkeleton): boolean {
  return connector.enabled !== false;
}

/**
 * Switch the `enabled` flag of a connector the way the Admin UI does: one patch of `/enabled` that waits for IDM to have consumed it. A connector that is in the requested state already is not written.
 * @param {string} connectorId id/name of the connector without the type prefix
 * @param {boolean} enabled the requested state
 * @returns {Promise<{ connector: ConnectorSkeleton; changed: boolean }>} the connector configuration after the call, and whether anything was written
 */
async function setConnectorEnabled({
  connectorId,
  enabled,
  state,
}: {
  connectorId: string;
  enabled: boolean;
  state: State;
}): Promise<{ connector: ConnectorSkeleton; changed: boolean }> {
  const current = await readConnector({ connectorId, state });
  if (isEnabledConfiguration(current) === enabled) {
    debugMessage({
      message: `ConnectorOps.setConnectorEnabled: connector ${connectorId} is ${enabled ? 'enabled' : 'disabled'} already`,
      state,
    });
    return { connector: current, changed: false };
  }
  const connector = await patchConfigEntity({
    entityId: `${CONNECTOR_TYPE}/${connectorId}`,
    operations: [{ operation: 'replace', field: '/enabled', value: enabled }],
    wait: true,
    state,
  });
  return { connector: connector as ConnectorSkeleton, changed: true };
}

/**
 * Repeat the connection test of a connector until it answers ok. Right after a connector was enabled the first answers are `connector not available` (or the system is not registered yet), so a failed test is not an error until the timeout has passed.
 * @param {string} connectorId id/name of the connector without the type prefix
 * @param {number} timeout how long to wait in milliseconds
 * @param {number} interval how long to wait between two tests in milliseconds
 * @returns {Promise<{ ready: boolean; error?: string }>} whether the connector answered ok and, if not, the last answer
 */
async function waitForConnector({
  connectorId,
  timeout,
  interval,
  state,
}: {
  connectorId: string;
  timeout: number;
  interval: number;
  state: State;
}): Promise<{ ready: boolean; error?: string }> {
  const pause = Math.max(1, interval);
  const deadline = Date.now() + Math.max(0, timeout);
  let error: string | undefined;
  for (;;) {
    try {
      const status = await readSystemStatus({ systemName: connectorId, state });
      if (status?.ok) {
        return { ready: true };
      }
      error = status?.error ?? 'the connection test did not succeed';
    } catch (testError) {
      error = testError instanceof Error ? testError.message : `${testError}`;
    }
    if (Date.now() + pause > deadline) {
      return { ready: false, error };
    }
    debugMessage({
      message: `ConnectorOps.waitForConnector: connector ${connectorId} does not answer yet: ${error}`,
      state,
    });
    await new Promise((resolve) => setTimeout(resolve, pause));
  }
}

/**
 * Enable a connector, the way the Admin UI does it, and wait until the connector answers its connection test. A connector that is enabled already is left alone (`changed` is false) but is still waited for. A connector that is enabled but does not answer in time is not an error: `ready` is false and `error` holds the last answer of the test.
 * @param {string} connectorId id/name of the connector without the type prefix
 * @param {ConnectorEnableOptions} options how long to wait for the connector to answer (milliseconds)
 * @returns {Promise<ConnectorStateResult>} a promise that resolves to the connector configuration after the change and whether the connector answers
 */
export async function enableConnector({
  connectorId,
  options = {},
  state,
}: {
  connectorId: string;
  options?: ConnectorEnableOptions;
  state: State;
}): Promise<ConnectorStateResult> {
  const { timeout = DEFAULT_READY_TIMEOUT, interval = DEFAULT_READY_INTERVAL } =
    options;
  try {
    debugMessage({
      message: `ConnectorOps.enableConnector: start [connector=${connectorId}]`,
      state,
    });
    const { connector, changed } = await setConnectorEnabled({
      connectorId,
      enabled: true,
      state,
    });
    const { ready, error } = await waitForConnector({
      connectorId,
      timeout,
      interval,
      state,
    });
    debugMessage({
      message: `ConnectorOps.enableConnector: end [connector=${connectorId}, changed=${changed}, ready=${ready}]`,
      state,
    });
    return {
      connectorId,
      connector,
      enabled: true,
      changed,
      ready,
      ...(error !== undefined && { error }),
    };
  } catch (error) {
    throw new FrodoError(`Error enabling connector ${connectorId}`, error);
  }
}

/**
 * Disable a connector, the way the Admin UI does it. A connector that is disabled already is left alone (`changed` is false). A disabled connector is not a registered system any more, so there is nothing to wait for.
 * @param {string} connectorId id/name of the connector without the type prefix
 * @returns {Promise<ConnectorStateResult>} a promise that resolves to the connector configuration after the change
 */
export async function disableConnector({
  connectorId,
  state,
}: {
  connectorId: string;
  state: State;
}): Promise<ConnectorStateResult> {
  try {
    debugMessage({
      message: `ConnectorOps.disableConnector: start [connector=${connectorId}]`,
      state,
    });
    const { connector, changed } = await setConnectorEnabled({
      connectorId,
      enabled: false,
      state,
    });
    debugMessage({
      message: `ConnectorOps.disableConnector: end [connector=${connectorId}, changed=${changed}]`,
      state,
    });
    return { connectorId, connector, enabled: false, changed };
  } catch (error) {
    throw new FrodoError(`Error disabling connector ${connectorId}`, error);
  }
}

/**
 * Check if a connector is enabled. A configuration without an `enabled` flag counts as enabled, as it does in IDM.
 * @param {string} connectorId id/name of the connector without the type prefix
 * @returns {Promise<boolean>} a promise that resolves to true if the connector is enabled, false if it is disabled
 */
export async function isConnectorEnabled({
  connectorId,
  state,
}: {
  connectorId: string;
  state: State;
}): Promise<boolean> {
  return isEnabledConfiguration(await readConnector({ connectorId, state }));
}

/**
 * Read whether each connector is enabled, in one request. Configurations that are not connectors or have no `enabled` flag (for example `provisioner.openicf.connectorinfoprovider`) are left out.
 * @returns {Promise<Record<string, boolean>>} a promise that resolves to an object that maps the id/name of each connector (without the type prefix) to whether it is enabled
 */
export async function readConnectorEnabledStates({
  state,
}: {
  state: State;
}): Promise<Record<string, boolean>> {
  try {
    const { result } = await getConfigEntitiesByType({
      type: CONNECTOR_TYPE,
      fields: ['enabled'],
      state,
    });
    const prefix = `${CONNECTOR_TYPE}/`;
    const states: Record<string, boolean> = {};
    for (const entity of result as unknown as {
      _id?: string;
      enabled?: unknown;
    }[]) {
      if (
        entity._id?.startsWith(prefix) &&
        typeof entity.enabled === 'boolean'
      ) {
        states[entity._id.substring(prefix.length)] = entity.enabled;
      }
    }
    return states;
  } catch (error) {
    throw new FrodoError(
      `Error reading the enabled state of connectors`,
      error
    );
  }
}

/**
 * One place that names a connector definition, found by
 * {@link findConnectorReferences}: a mapping, an application, a schedule or an
 * authentication module (the login configuration). All four are `hard`: the
 * holder breaks at run time without the connector. `id` is the id of the
 * holder (`mapping/<name>`, or `sync/<name>` where the mapping is only in the
 * `sync` configuration; the id of the application, with its `realm`;
 * `schedule/<name>`; the name of the module, or `authentication`), `from` is
 * the field that holds the connector id. An empty answer is never proof that a
 * connector is unused, see {@link findConnectorReferences}.
 */
export type ConnectorReference = ObjectReference<
  'mapping' | 'application' | 'schedule' | 'authentication-module'
>;

/**
 * One place that names a connector server, found by
 * {@link findConnectorServerReferences}: a server cluster that lists it (`soft`:
 * the cluster works with its other servers) or a connector definition that
 * names it as its host (`hard`). `id` is the cluster name, or the connector
 * name without the type prefix; `from` is `serversList` or
 * `connectorRef.connectorHostRef`. An empty answer is never proof that a server
 * is unused, see {@link findConnectorServerReferences}.
 */
export type ConnectorServerReference = ObjectReference<
  'server-cluster' | 'connector'
>;

const MAPPING_PREFIX = 'mapping/';
const SCHEDULE_PREFIX = 'schedule/';
const CONNECTOR_INFO_PROVIDER = 'provisioner.openicf.connectorinfoprovider';
/**
 * The fields of the login configuration that name a resource of the system, in
 * lower case: a key is compared ignoring its case, because the spelling of
 * `passthroughAuth` is not fixed by anything this library has read (a holder
 * that is missed is a false negative, a key that is read too widely only a
 * reference more).
 */
const AUTHENTICATION_RESOURCE_FIELDS = ['queryonresource', 'passthroughauth'];
/** The id of an authentication holder that has no module name. */
const AUTHENTICATION_CONFIG_ID = 'authentication';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a configuration entity; one that is not there is none (null). */
async function readConfigEntityOrNone(
  entityId: string,
  state: State
): Promise<unknown> {
  try {
    return await getConfigEntity({ entityId, state });
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

const byIdThenFrom = (a: ObjectReference<string>, b: ObjectReference<string>) =>
  a.id.localeCompare(b.id) || a.from.localeCompare(b.from);

/** What the mapping source reads: the `sync` configuration and the `mapping/` configurations. */
type MappingStores = { sync: unknown; mappings: unknown };

/**
 * The mappings that name a connector. A mapping that is stored in both the
 * `sync` configuration and as `mapping/<name>` is one reference per field: the
 * id is `mapping/<name>` when that store holds a match for the field, else
 * `sync/<name>`. A `sync` entry without a name cannot be addressed and is left
 * out.
 */
function findMappingReferences(
  stores: MappingStores,
  connectorId: string
): ConnectorReference[] {
  const prefix = `system/${connectorId}/`;
  const folded = new Map<
    string,
    { name: string; from: 'source' | 'target'; id: string }
  >();
  const note = (
    name: string,
    from: 'source' | 'target',
    id: string | undefined
  ) => {
    // the sync store is noted first, so a note with an id (the mapping
    // configuration) replaces the legacy id of the same mapping and field
    folded.set(JSON.stringify([name, from]), {
      name,
      from,
      id: id ?? `sync/${name}`,
    });
  };
  const syncMappings =
    isRecord(stores.sync) && Array.isArray(stores.sync.mappings)
      ? stores.sync.mappings
      : [];
  for (const entry of syncMappings) {
    if (!isRecord(entry) || typeof entry.name !== 'string') continue;
    for (const from of ['source', 'target'] as const) {
      const value = entry[from];
      if (typeof value === 'string' && value.startsWith(prefix)) {
        note(entry.name, from, undefined);
      }
    }
  }
  for (const entry of Array.isArray(stores.mappings) ? stores.mappings : []) {
    if (
      !isRecord(entry) ||
      typeof entry._id !== 'string' ||
      !entry._id.startsWith(MAPPING_PREFIX)
    )
      continue;
    const name =
      typeof entry.name === 'string'
        ? entry.name
        : entry._id.substring(MAPPING_PREFIX.length);
    for (const from of ['source', 'target'] as const) {
      const value = entry[from];
      if (typeof value === 'string' && value.startsWith(prefix)) {
        note(name, from, entry._id);
      }
    }
  }
  return [...folded.values()]
    .map(({ name, from, id }) => ({
      source: 'mapping' as const,
      dependency: 'hard' as const,
      id,
      name,
      from,
    }))
    .sort(byIdThenFrom);
}

/** The application records of every realm, each with the realm it belongs to (when the type says so). */
type ApplicationRecords = { realm?: string; application: unknown }[];

/**
 * Reads the application records of every realm without switching the active
 * realm. Every distinct application type is read once. On Cloud the root realm
 * has no applications. A type that does not exist has no applications.
 */
async function readApplicationsOfAllRealms(
  state: State
): Promise<ApplicationRecords> {
  const realms = await getRealms({ state });
  const realmsByType = new Map<string, string[]>();
  for (const realm of Array.isArray(realms) ? realms : []) {
    if (typeof realm?.name !== 'string') continue;
    if (
      state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY &&
      realm.name === '/'
    ) {
      continue;
    }
    const type = getManagedApplicationTypeOfRealm({
      realmName: realm.name,
      state,
    });
    realmsByType.set(type, [...(realmsByType.get(type) ?? []), realm.name]);
  }
  const perType = await Promise.all(
    [...realmsByType].map(async ([type, realmNames]) => {
      try {
        const applications = await readManagedObjects({
          type,
          fields: ['name', 'connectorId'],
          state,
        });
        // a type that several realms share does not say which realm an application is in
        return applications.map((application) => ({
          ...(realmNames.length === 1 && { realm: realmNames[0] }),
          application,
        }));
      } catch (error) {
        if (isNotFoundError(error)) {
          return [];
        }
        throw error;
      }
    })
  );
  return perType.flat();
}

function findApplicationReferences(
  records: ApplicationRecords,
  connectorId: string
): ConnectorReference[] {
  return records
    .flatMap(({ realm, application }) => {
      if (
        !isRecord(application) ||
        typeof application._id !== 'string' ||
        application.connectorId !== connectorId
      ) {
        return [];
      }
      return [
        {
          source: 'application' as const,
          dependency: 'hard' as const,
          id: application._id,
          ...(typeof application.name === 'string' && {
            name: application.name,
          }),
          ...(realm !== undefined && { realm }),
          from: 'connectorId',
        },
      ];
    })
    .sort(byIdThenFrom);
}

function findScheduleReferences(
  schedules: unknown,
  connectorId: string
): ConnectorReference[] {
  const prefix = `system/${connectorId}/`;
  return (Array.isArray(schedules) ? schedules : [])
    .flatMap((schedule) => {
      if (
        !isRecord(schedule) ||
        typeof schedule._id !== 'string' ||
        !schedule._id.startsWith(SCHEDULE_PREFIX) ||
        !isRecord(schedule.invokeContext) ||
        typeof schedule.invokeContext.source !== 'string' ||
        !schedule.invokeContext.source.startsWith(prefix)
      ) {
        return [];
      }
      return [
        {
          source: 'schedule' as const,
          dependency: 'hard' as const,
          id: schedule._id,
          from: 'invokeContext.source',
        },
      ];
    })
    .sort(byIdThenFrom);
}

/**
 * The authentication modules that name a connector: the login configuration is
 * walked whole, and every `queryOnResource` or `passthroughAuth` property
 * (the key is compared ignoring case) whose value starts with `system/<id>/`
 * is one reference. The id is the `name` of the nearest enclosing object that
 * has one (the module), else `authentication`; `from` is the dotted path
 * without list indexes. Entries that repeat both the id and the path are one
 * reference.
 */
function findAuthenticationReferences(
  authentication: unknown,
  connectorId: string
): ConnectorReference[] {
  const prefix = `system/${connectorId}/`;
  // one reference per module name and field: entries that repeat both are one
  const found = new Map<string, ConnectorReference>();
  const walk = (value: unknown, path: string[], holder: string) => {
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, path, holder));
      return;
    }
    if (!isRecord(value)) return;
    const name =
      typeof value.name === 'string' && value.name !== '' ? value.name : holder;
    for (const [key, child] of Object.entries(value)) {
      if (
        AUTHENTICATION_RESOURCE_FIELDS.includes(key.toLowerCase()) &&
        typeof child === 'string' &&
        child.startsWith(prefix)
      ) {
        const from = [...path, key].join('.');
        found.set(JSON.stringify([name, from]), {
          source: 'authentication-module',
          dependency: 'hard',
          id: name,
          from,
        });
      } else {
        walk(child, [...path, key], name);
      }
    }
  };
  walk(authentication, [], AUTHENTICATION_CONFIG_ID);
  return [...found.values()].sort(byIdThenFrom);
}

/**
 * Every source that findConnectorReferences reads, in the order of the result.
 * Adding a holder is a row here.
 */
const connectorReferenceSources: readonly ReferenceSource<
  ConnectorReference['source'],
  ConnectorReference
>[] = [
  defineReferenceSource<
    ConnectorReference['source'],
    ConnectorReference,
    MappingStores
  >({
    source: 'mapping',
    label: 'mappings',
    read: async (state) => {
      const [sync, mappings] = await Promise.all([
        readConfigEntityOrNone('sync', state),
        readConfigEntitiesByType({ type: 'mapping', state }),
      ]);
      return { sync, mappings };
    },
    find: findMappingReferences,
  }),
  defineReferenceSource<
    ConnectorReference['source'],
    ConnectorReference,
    ApplicationRecords
  >({
    source: 'application',
    label: 'applications',
    read: readApplicationsOfAllRealms,
    find: findApplicationReferences,
  }),
  defineReferenceSource<
    ConnectorReference['source'],
    ConnectorReference,
    unknown
  >({
    source: 'schedule',
    label: 'schedules',
    read: async (state) =>
      readConfigEntitiesByType({ type: 'schedule', state }),
    find: findScheduleReferences,
  }),
  defineReferenceSource<
    ConnectorReference['source'],
    ConnectorReference,
    unknown
  >({
    source: 'authentication-module',
    label: 'authentication modules',
    read: async (state) => readConfigEntityOrNone('authentication', state),
    find: findAuthenticationReferences,
  }),
];

/**
 * Find what still names a connector definition, in the whole tenant. See the
 * facade method for the sources, for what is not seen and for what an empty
 * answer does and does not mean.
 *
 * For one id the lookup fails closed: if any source cannot be read, every source
 * is still attempted, then one error is thrown that nests one error per source
 * that failed. For a list of ids the same reads answer every id, and a source
 * that cannot be read is named in `unreadable` instead of failing the call.
 * @param {string | string[]} connectorIds id/name of the connector without the type prefix, or a list of them
 * @returns {Promise<ConnectorReference[] | object>} a promise that resolves to every reference found for one id, or to `{ references, unreadable }` for a list
 */
export function findConnectorReferences(params: {
  connectorIds: string;
  state: State;
}): Promise<ConnectorReference[]>;
export function findConnectorReferences(params: {
  connectorIds: string[];
  state: State;
}): Promise<
  ReferenceLookupResult<ConnectorReference['source'], ConnectorReference>
>;
export function findConnectorReferences(params: {
  connectorIds: string | string[];
  state: State;
}): Promise<
  | ConnectorReference[]
  | ReferenceLookupResult<ConnectorReference['source'], ConnectorReference>
>;
export async function findConnectorReferences({
  connectorIds,
  state,
}: {
  connectorIds: string | string[];
  state: State;
}) {
  return findReferencesForIds({
    sources: connectorReferenceSources,
    state,
    ids: connectorIds,
    subject: 'connector',
  });
}

function findServerClusterReferences(
  connectorInfo: unknown,
  serverName: string
): ConnectorServerReference[] {
  if (
    !isRecord(connectorInfo) ||
    !Array.isArray(connectorInfo.remoteConnectorClientsGroups)
  ) {
    return [];
  }
  return connectorInfo.remoteConnectorClientsGroups
    .flatMap((cluster) => {
      if (
        !isRecord(cluster) ||
        typeof cluster.name !== 'string' ||
        !Array.isArray(cluster.serversList) ||
        !cluster.serversList.some(
          (server) => isRecord(server) && server.name === serverName
        )
      ) {
        return [];
      }
      return [
        {
          source: 'server-cluster' as const,
          dependency: 'soft' as const,
          id: cluster.name,
          from: 'serversList',
        },
      ];
    })
    .sort(byIdThenFrom);
}

/** The connectors come from readConnectors: every id starts with the type prefix. */
function findConnectorHostReferences(
  connectors: unknown[],
  serverName: string
): ConnectorServerReference[] {
  const prefix = `${CONNECTOR_TYPE}/`;
  return connectors
    .flatMap((connector) => {
      if (
        !isRecord(connector) ||
        typeof connector._id !== 'string' ||
        !isRecord(connector.connectorRef) ||
        connector.connectorRef.connectorHostRef !== serverName
      ) {
        return [];
      }
      return [
        {
          source: 'connector' as const,
          dependency: 'hard' as const,
          id: connector._id.substring(prefix.length),
          from: 'connectorRef.connectorHostRef',
        },
      ];
    })
    .sort(byIdThenFrom);
}

/**
 * Every source that findConnectorServerReferences reads, in the order of the
 * result.
 */
const connectorServerReferenceSources: readonly ReferenceSource<
  ConnectorServerReference['source'],
  ConnectorServerReference
>[] = [
  defineReferenceSource<
    ConnectorServerReference['source'],
    ConnectorServerReference,
    unknown
  >({
    source: 'server-cluster',
    label: 'server clusters',
    read: async (state) =>
      readConfigEntityOrNone(CONNECTOR_INFO_PROVIDER, state),
    find: findServerClusterReferences,
  }),
  defineReferenceSource<
    ConnectorServerReference['source'],
    ConnectorServerReference,
    unknown[]
  >({
    source: 'connector',
    label: 'connectors',
    read: async (state) => readConnectors({ state }),
    find: findConnectorHostReferences,
  }),
];

/**
 * Find what still names a connector server. See the facade method for the
 * sources, for what is not seen and for what an empty answer does and does not
 * mean.
 *
 * For one name the lookup fails closed: if any source cannot be read, every
 * source is still attempted, then one error is thrown that nests one error per
 * source that failed. For a list of names the same reads answer every name, and
 * a source that cannot be read is named in `unreadable` instead of failing the
 * call.
 * @param {string | string[]} serverNames name of the connector server, or a list of them
 * @returns {Promise<ConnectorServerReference[] | object>} a promise that resolves to every reference found for one name, or to `{ references, unreadable }` for a list
 */
export function findConnectorServerReferences(params: {
  serverNames: string;
  state: State;
}): Promise<ConnectorServerReference[]>;
export function findConnectorServerReferences(params: {
  serverNames: string[];
  state: State;
}): Promise<
  ReferenceLookupResult<
    ConnectorServerReference['source'],
    ConnectorServerReference
  >
>;
export function findConnectorServerReferences(params: {
  serverNames: string | string[];
  state: State;
}): Promise<
  | ConnectorServerReference[]
  | ReferenceLookupResult<
      ConnectorServerReference['source'],
      ConnectorServerReference
    >
>;
export async function findConnectorServerReferences({
  serverNames,
  state,
}: {
  serverNames: string | string[];
  state: State;
}) {
  return findReferencesForIds({
    sources: connectorServerReferenceSources,
    state,
    ids: serverNames,
    subject: 'connector server',
  });
}
