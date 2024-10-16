import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  deleteConfigEntity,
  getConfigEntity,
  putConfigEntity,
} from '../api/IdmConfigApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { FrodoError } from './FrodoError';
import { readConfigEntitiesByType } from './IdmConfigOps';
import { MappingSkeleton, readMappings, updateMapping } from './MappingOps';
import { ExportMetaData } from './OpsTypes';

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
   * Get all connectors
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
   * @returns {Promise<ConnectorSkeleton[]>} a promise that resolves to an array of connector objects
   */
  deleteConnectors(): Promise<ConnectorSkeleton[]>;
  /**
   * Delete connector
   * @param {string} connectorId id/name of the connector without the type prefix
   * @returns {Promise<ConnectorSkeleton>} a promise that resolves an connector object
   */
  deleteConnector(connectorId: string): Promise<ConnectorSkeleton>;
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
   * Import all connectors
   * @param {ConnectorExportInterface} importData import data
   * @param {ConnectorImportOptions} options import options
   * @returns {Promise<ConnectorSkeleton[]>} a promise resolving to an array of ConnectorSkeleton objects
   */
  importConnectors(
    importData: ConnectorExportInterface,
    options?: ConnectorImportOptions
  ): Promise<ConnectorSkeleton[]>;
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
    async deleteConnectors(): Promise<ConnectorSkeleton[]> {
      return deleteConnectors({ state });
    },
    async deleteConnector(connectorId: string): Promise<ConnectorSkeleton> {
      return deleteConnector({ connectorId, state });
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
      options?: ConnectorImportOptions
    ): Promise<ConnectorSkeleton[]> {
      return importConnectors({ importData, options, state });
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
 * Get all connectors
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
    return connectors as ConnectorSkeleton[];
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
  throw new Error(`Connector ${connectorId} already exists!`);
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
 * @returns {Promise<ConnectorSkeleton[]>} a promise that resolves to an array of connector objects
 */
export async function deleteConnectors({
  state,
}: {
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
        debugMessage({
          message: `ConnectorOps.deleteConnectors: '${connector['_id']}'`,
          state,
        });
        result.push(
          (await deleteConfigEntity({
            entityId: connector['_id'],
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
 * @returns {Promise<ConnectorSkeleton>} a promise that resolves an connector object
 */
export async function deleteConnector({
  connectorId,
  state,
}: {
  connectorId: string;
  state: State;
}): Promise<ConnectorSkeleton> {
  try {
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
 * Import all connectors
 * @param {ConnectorExportInterface} importData import data
 * @param {ConnectorImportOptions} options import options
 * @returns {Promise<ConnectorSkeleton[]>} a promise resolving to an array of ConnectorSkeleton objects
 */
export async function importConnectors({
  importData,
  options = { deps: true },
  state,
}: {
  importData: ConnectorExportInterface;
  options?: ConnectorImportOptions;
  state: State;
}): Promise<ConnectorSkeleton[]> {
  const response = [];
  const errors = [];
  for (const key of Object.keys(importData.connector)) {
    try {
      if (options.deps) {
        //
      }
      response.push(
        await updateConnector({
          connectorId: key,
          connectorData: importData.connector[key],
          state,
        })
      );
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing connectors`, errors);
  }
  return response;
}
