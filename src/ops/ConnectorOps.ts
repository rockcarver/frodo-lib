import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  deleteConfigEntity,
  getConfigEntitiesByType,
  getConfigEntity,
  patchConfigEntity,
  putConfigEntity,
} from '../api/IdmConfigApi';
import { readSystemStatus } from '../api/IdmSystemApi';
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
import {
  deleteMapping,
  MappingSkeleton,
  readMappings,
  updateMapping,
} from './MappingOps';
import { ExportMetaData, type ResultCallback } from './OpsTypes';

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
