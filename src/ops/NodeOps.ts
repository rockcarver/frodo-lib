import { v4 as uuidv4 } from 'uuid';
import {
  createNode as _createNode,
  deleteCustomNode as _deleteCustomNode,
  deleteNode as _deleteNode,
  getCustomNodeSchema as _getCustomNodeSchema,
  getCustomNodeUsage as _getCustomNodeUsage,
  getNode as _getNode,
  getNodes as _getNodes,
  getNodesByType as _getNodesByType,
  getNodeSchema as _getNodeSchema,
  getNodeType as _getNodeType,
  getNodeTypes as _getNodeTypes,
  putNode as _putNode,
  createCustomNode,
  CustomNodeSkeleton,
  CustomNodeUsage,
  getCustomNode,
  getCustomNodes,
  putCustomNode,
  requireVersion,
  type NodeSkeleton,
  type NodeTypeSkeleton,
} from '../api/NodeApi';
import { getTrees } from '../api/TreeApi';
import { State } from '../shared/State';
import { theme } from '../utils/ColorTheme';
import {
  createProgressIndicator,
  debugMessage,
  printError,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
  verboseMessage,
} from '../utils/Console';
import { getMetadata, getResult } from '../utils/ExportImportUtils';
import { applyNameCollisionPolicy } from '../utils/ForgeRockUtils';
import { eq, gt, lt } from '../utils/SemverUtils';
import { FrodoError, isNotFoundError } from './FrodoError';
import { ExportMetaData, ResultCallback } from './OpsTypes';

/**
 * Semver-style filter used by readNodesByVersion to select node type versions.
 *
 * Supported comparisons:
 * - `eq`: exact version match
 * - `gt` / `gte`: greater than / greater than or equal
 * - `lt` / `lte`: less than / less than or equal
 * - `from` / `to`: inclusive range bounds by default
 * - `includeFrom` / `includeTo`: override range bound inclusivity
 */
export type NodeVersionFilter = {
  /** Exact version match. */
  eq?: string;
  /** Strictly greater than the supplied version. */
  gt?: string;
  /** Greater than or equal to the supplied version. */
  gte?: string;
  /** Strictly less than the supplied version. */
  lt?: string;
  /** Less than or equal to the supplied version. */
  lte?: string;
  /** Range lower bound. Inclusive unless includeFrom is set to false. */
  from?: string;
  /** Range upper bound. Inclusive unless includeTo is set to false. */
  to?: string;
  /** Whether the from bound is inclusive. Defaults to true. */
  includeFrom?: boolean;
  /** Whether the to bound is inclusive. Defaults to true. */
  includeTo?: boolean;
};

export type Node = {
  /**
   * Read all node types
   * @returns {Promise<any>} a promise that resolves to an array of node type objects
   */
  readNodeTypes(): Promise<any>;
  /**
   * Read a specific node type
   * @param {string} nodeType node type
   * @param {string} nodeTypeVersion node type version
   * @returns {Promise<any>} a promise that resolves to a node type object
   */
  readNodeType(nodeType: string, nodeTypeVersion?: string): Promise<any>;
  /**
   * Read a node type's configurable-property schema (the schema an agent or UI
   * needs to construct valid node config before creating/updating a node instance).
   * @param {string} nodeType node type
   * @param {string} nodeTypeVersion node type version
   * @param {boolean} refreshCache whether to refresh the schema cache for the specified node type/version
   * @returns {Promise<NodeSkeleton>} a promise that resolves to a node schema object
   */
  readNodeSchema(
    nodeType: string,
    nodeTypeVersion?: string,
    refreshCache?: boolean
  ): Promise<NodeSkeleton>;
  /**
   * Read all nodes
   * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an object containing an array of node objects
   */
  readNodes(): Promise<NodeSkeleton[]>;
  /**
   * Read all nodes across types and versions with optional version filtering.
   * @param {NodeVersionFilter} nodeVersionFilter optional node version filter
   * @returns {Promise<NodeSkeleton[]>} matched node instances
   */
  readNodesByVersion(
    nodeVersionFilter?: NodeVersionFilter
  ): Promise<NodeSkeleton[]>;
  /**
   * Read all nodes by type
   * @param {string} nodeType node type
   * @param {string} nodeTypeVersion node type version
   * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an object containing an array of node objects of the requested type
   */
  readNodesByType(
    nodeType: string,
    nodeTypeVersion?: string
  ): Promise<NodeSkeleton[]>;
  /**
   * Read node by uuid and type
   * @param {string} nodeId node uuid
   * @param {string} nodeType node type
   * @param {string} nodeTypeVersion node type version
   * @returns {Promise<NodeSkeleton>} a promise that resolves to a node object
   */
  readNode(
    nodeId: string,
    nodeType: string,
    nodeTypeVersion?: string
  ): Promise<NodeSkeleton>;
  /**
   * Export all nodes
   * @returns {Promise<NodeExportInterface>} a promise that resolves to an array of node objects
   */
  exportNodes(): Promise<NodeExportInterface>;
  /**
   * Create node by type
   * @param {string} nodeType node type
   * @param {NodeSkeleton} nodeData node object
   * @returns {Promise<NodeSkeleton>} a promise that resolves to an object containing a node object
   */
  createNode(nodeType: string, nodeData: NodeSkeleton): Promise<NodeSkeleton>;
  /**
   * Update or create node by uuid and type
   * @param {string} nodeId node uuid
   * @param {string} nodeType node type
   * @param {NodeSkeleton} nodeData node object
   * @returns {Promise<NodeSkeleton>} a promise that resolves to an object containing a node object
   */
  updateNode(
    nodeId: string,
    nodeType: string,
    nodeData: NodeSkeleton
  ): Promise<NodeSkeleton>;
  /**
   * Delete node by uuid and type
   * @param {string} nodeId node uuid
   * @param {string} nodeType node type
   * @returns {Promise<NodeSkeleton>} a promise that resolves to an object containing a node object
   */
  deleteNode(nodeId: string, nodeType: string): Promise<NodeSkeleton>;
  /**
   * Read custom node. Either ID or name must be provided.
   * @param {string} nodeId ID or service name of custom node. Takes priority over node display name if both are provided.
   * @param {string} nodeName Display name of custom node.
   * @returns {Promise<CustomNodeSkeleton>} a promise that resolves to a custom node object
   */
  readCustomNode(
    nodeId?: string,
    nodeName?: string
  ): Promise<CustomNodeSkeleton>;
  /**
   * Read all custom nodes
   * @returns {Promise<CustomNodeSkeleton[]>} a promise that resolves to an array of custom nodes objects
   */
  readCustomNodes(): Promise<CustomNodeSkeleton[]>;
  /**
   * Read a custom node's configurable-property schema.
   * @param {string} serviceName custom node service name (not the '_id' and without the 'designer-' prefix)
   * @param {boolean} refreshCache whether to refresh the schema cache for the specified custom node
   * @returns {Promise<NodeSkeleton>} a promise that resolves to a node schema object
   */
  readCustomNodeSchema(
    serviceName: string,
    refreshCache?: boolean
  ): Promise<NodeSkeleton>;
  /**
   * Export custom node. Either ID or name must be provided.
   * @param {string} nodeId ID or service name of custom node. Takes priority over node display name if both are provided.
   * @param {string} nodeName Display name of custom node.
   * @param {CustomNodeExportOptions} options Custom node export options
   * @returns {Promise<CustomNodeExportInterface>} a promise that resolves to a custom node export object
   */
  exportCustomNode(
    nodeId?: string,
    nodeName?: string,
    options?: CustomNodeExportOptions
  ): Promise<CustomNodeExportInterface>;
  /**
   * Export all custom nodes
   * @param {CustomNodeExportOptions} options Custom node export options
   * @returns {Promise<CustomNodeExportInterface>} a promise that resolves to a custom node export object
   */
  exportCustomNodes(
    options?: CustomNodeExportOptions
  ): Promise<CustomNodeExportInterface>;
  /**
   * Update custom node by ID
   * @param {string} nodeId ID or service name of custom node.
   * @param {CustomNodeSkeleton} nodeData node object
   * @returns {Promise<CustomNodeSkeleton>} a promise that resolves to a custom node object
   */
  updateCustomNode(
    nodeId: string,
    nodeData: CustomNodeSkeleton
  ): Promise<CustomNodeSkeleton>;
  /**
   * Import custom nodes
   * @param {string} nodeId ID or service name of custom node. If supplied, only the custom node of that id is imported. Takes priority over node display name if both are provided.
   * @param {string} nodeName Display name of custom node. If supplied, only the custom node of that name is imported
   * @param {CustomNodeExportInterface} importData Custom node import data
   * @param {CustomNodeImportOptions} options Custom node import options
   * @param {ResultCallback<CustomNodeSkeleton>} resultCallback Optional callback to process individual results
   * @returns {Promise<CustomNodeSkeleton[]>} the imported custom nodes
   */
  importCustomNodes(
    nodeId: string,
    nodeName: string,
    importData: CustomNodeExportInterface,
    options?: CustomNodeImportOptions,
    resultCallback?: ResultCallback<CustomNodeSkeleton>
  ): Promise<CustomNodeSkeleton[]>;
  /**
   * Delete custom node. Either ID or name must be provided.
   * @param {string} nodeId ID or service name of custom node. Takes priority over node display name if both are provided.
   * @param {string} nodeName Display name of custom node.
   * @returns {Promise<CustomNodeSkeleton>} promise that resolves to a custom node object
   */
  deleteCustomNode(
    nodeId?: string,
    nodeName?: string
  ): Promise<CustomNodeSkeleton>;
  /**
   * Delete custom nodes
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<CustomNodeSkeleton[]>} promise that resolves to an array of custom node objects
   */
  deleteCustomNodes(
    resultCallback?: ResultCallback<CustomNodeSkeleton>
  ): Promise<CustomNodeSkeleton[]>;
  /**
   * Find all node configuration objects that are no longer referenced by any tree
   * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an array of orphaned nodes
   */
  findOrphanedNodes(): Promise<NodeSkeleton[]>;
  /**
   * Remove orphaned nodes
   * @param {NodeSkeleton[]} orphanedNodes Pass in an array of orphaned node configuration objects to remove
   * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an array nodes that encountered errors deleting
   */
  removeOrphanedNodes(orphanedNodes: NodeSkeleton[]): Promise<NodeSkeleton[]>;
  /**
   * Get custom node usage by ID
   * @param {String} nodeId ID or service name of the custom node
   * @returns {Promise<CustomNodeUsage>} a promise that resolves to an object containing a custom node usage object
   */
  getCustomNodeUsage(nodeId: string): Promise<CustomNodeUsage>;
};

export default (state: State): Node => {
  return {
    async readNodeTypes(): Promise<any> {
      return readNodeTypes({ state });
    },
    async readNodeType(
      nodeType: string,
      nodeTypeVersion?: string
    ): Promise<any> {
      return readNodeType({ nodeType, nodeTypeVersion, state });
    },
    async readNodeSchema(
      nodeType: string,
      nodeTypeVersion?: string,
      refreshCache = false
    ): Promise<NodeSkeleton> {
      return readNodeSchema({ nodeType, nodeTypeVersion, refreshCache, state });
    },
    async readNodes(): Promise<NodeSkeleton[]> {
      return readNodes({ state });
    },
    async readNodesByVersion(
      nodeVersionFilter?: NodeVersionFilter
    ): Promise<NodeSkeleton[]> {
      return readNodesByVersion({ nodeVersionFilter, state });
    },
    async readNodesByType(
      nodeType: string,
      nodeTypeVersion?: string
    ): Promise<NodeSkeleton[]> {
      return readNodesByType({ nodeType, nodeTypeVersion, state });
    },
    async readNode(
      nodeId: string,
      nodeType: string,
      nodeTypeVersion?: string
    ): Promise<NodeSkeleton> {
      return readNode({ nodeId, nodeType, nodeTypeVersion, state });
    },
    async exportNodes(): Promise<NodeExportInterface> {
      return exportNodes({ state });
    },
    async createNode(
      nodeType: string,
      nodeData: NodeSkeleton
    ): Promise<NodeSkeleton> {
      return createNode({ nodeType, nodeData, state });
    },
    async updateNode(
      nodeId: string,
      nodeType: string,
      nodeData: NodeSkeleton
    ): Promise<NodeSkeleton> {
      return updateNode({ nodeId, nodeType, nodeData, state });
    },
    async deleteNode(nodeId: string, nodeType: string): Promise<NodeSkeleton> {
      return deleteNode({ nodeId, nodeType, state });
    },
    async readCustomNode(
      nodeId?: string,
      nodeName?: string
    ): Promise<CustomNodeSkeleton> {
      return readCustomNode({
        nodeId,
        nodeName,
        state,
      });
    },
    async readCustomNodes(): Promise<CustomNodeSkeleton[]> {
      return readCustomNodes({
        state,
      });
    },
    async readCustomNodeSchema(
      serviceName: string,
      refreshCache = false
    ): Promise<NodeSkeleton> {
      return readCustomNodeSchema({ serviceName, refreshCache, state });
    },
    async exportCustomNode(
      nodeId?: string,
      nodeName?: string,
      options: CustomNodeExportOptions = {
        useStringArrays: true,
      }
    ): Promise<CustomNodeExportInterface> {
      return exportCustomNode({
        nodeId,
        nodeName,
        options,
        state,
      });
    },
    exportCustomNodes(
      options: CustomNodeExportOptions = {
        useStringArrays: true,
      }
    ): Promise<CustomNodeExportInterface> {
      return exportCustomNodes({
        options,
        state,
      });
    },
    async updateCustomNode(
      nodeId: string,
      nodeData: CustomNodeSkeleton
    ): Promise<CustomNodeSkeleton> {
      return updateCustomNode({
        nodeId,
        nodeData,
        state,
      });
    },
    async importCustomNodes(
      nodeId: string,
      nodeName: string,
      importData: CustomNodeExportInterface,
      options: CustomNodeImportOptions = {
        reUuid: false,
        wait: false,
      },
      resultCallback?: ResultCallback<CustomNodeSkeleton>
    ): Promise<CustomNodeSkeleton[]> {
      return importCustomNodes({
        nodeId,
        nodeName,
        importData,
        options,
        resultCallback,
        state,
      });
    },
    async deleteCustomNode(
      nodeId?: string,
      nodeName?: string
    ): Promise<CustomNodeSkeleton> {
      return deleteCustomNode({
        nodeId,
        nodeName,
        state,
      });
    },
    async deleteCustomNodes(
      resultCallback?: ResultCallback<CustomNodeSkeleton>
    ): Promise<CustomNodeSkeleton[]> {
      return deleteCustomNodes({
        resultCallback,
        state,
      });
    },
    async findOrphanedNodes(): Promise<NodeSkeleton[]> {
      return findOrphanedNodes({ state });
    },
    async removeOrphanedNodes(
      orphanedNodes: NodeSkeleton[]
    ): Promise<NodeSkeleton[]> {
      return removeOrphanedNodes({ orphanedNodes, state });
    },
    async getCustomNodeUsage(nodeId: string): Promise<CustomNodeUsage> {
      return getCustomNodeUsage({
        nodeId,
        state,
      });
    },
  };
};

export interface NodeExportInterface {
  meta?: ExportMetaData;
  node: Record<string, NodeSkeleton>;
}

export interface CustomNodeExportInterface {
  meta?: ExportMetaData;
  // Use nodeTypes since this is how AIC exports them
  nodeTypes: Record<string, CustomNodeSkeleton>;
}

/**
 * Custom node import options
 */
export interface CustomNodeImportOptions {
  /**
   * Generate new UUIDs and service names for all custom nodes during import.
   */
  reUuid: boolean;
  /**
   * Wait for AM to load new custom nodes before returning.
   */
  wait: boolean;
}

/**
 * Custom node export options
 */
export interface CustomNodeExportOptions {
  /**
   * Use string arrays to store script code
   */
  useStringArrays: boolean;
}

const containerNodes = ['PageNode', 'CustomPageNode'];

// Node objects in different API contexts expose version under different keys.
// Prefer explicit type version when present, then fallback to node-level keys.
function resolveNodeTypeVersion({
  node,
  state,
}: {
  node: any;
  state: State;
}): string {
  if (!requireVersion(state)) {
    return '1.0';
  }
  return (node?._type?.version ||
    node?.version ||
    node?.nodeVersion ||
    '1.0') as string;
}

/**
 * Create an empty node export template
 * @returns {NodeExportInterface} an empty node export template
 */
export function createNodeExportTemplate({
  state,
}: {
  state: State;
}): NodeExportInterface {
  return {
    meta: getMetadata({ state }),
    node: {},
  };
}

/**
 * Create an empty custom node export template
 * @returns {CustomNodeExportInterface} an empty custom node export template
 */
export function createCustomNodeExportTemplate({
  state,
}: {
  state: State;
}): CustomNodeExportInterface {
  return {
    meta: getMetadata({ state }),
    nodeTypes: {},
  };
}

/**
 * Read all node types
 * @returns {Promise<NodeTypeSkeleton[]>} a promise that resolves to an array of node type objects
 */
export async function readNodeTypes({
  state,
}: {
  state: State;
}): Promise<NodeTypeSkeleton[]> {
  try {
    const { result } = await _getNodeTypes({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading node types`, error);
  }
}

/**
 * Read a specific node type
 * @param {string} nodeType node type
 * @param {string} nodeTypeVersion node type version
 * @param {State} state state object
 * @returns {Promise<NodeTypeSkeleton[]>} a promise that resolves to an array of node type objects
 */
export async function readNodeType({
  nodeType,
  nodeTypeVersion = '1.0',
  state,
}: {
  nodeType: string;
  nodeTypeVersion?: string;
  state: State;
}): Promise<NodeTypeSkeleton> {
  try {
    const result = await _getNodeType({ nodeType, nodeTypeVersion, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading node type ${nodeType}`, error);
  }
}

const NodeSchemaCache: Record<string, NodeSkeleton> = {};

/**
 * Read a node type's configurable-property schema.
 * @param {string} nodeType node type
 * @param {string} nodeTypeVersion node type version
 * @param {boolean} refreshCache whether to refresh the schema cache for the specified node type/version
 * @param {State} state state object
 * @returns {Promise<NodeSkeleton>} a promise that resolves to a node schema object
 */
export async function readNodeSchema({
  nodeType,
  nodeTypeVersion = '1.0',
  refreshCache = false,
  state,
}: {
  nodeType: string;
  nodeTypeVersion?: string;
  refreshCache?: boolean;
  state: State;
}): Promise<NodeSkeleton> {
  const cacheKey = `${nodeType}:${nodeTypeVersion}`;
  try {
    if (!refreshCache && NodeSchemaCache[cacheKey]) {
      debugMessage({
        message: `NodeOps.readNodeSchema: Using cached schema for node type "${nodeType}" version "${nodeTypeVersion}"`,
        state,
      });
      return NodeSchemaCache[cacheKey];
    }
    const schema = await _getNodeSchema({ nodeType, nodeTypeVersion, state });
    NodeSchemaCache[cacheKey] = schema;
    return schema;
  } catch (error) {
    throw new FrodoError(
      `Error reading schema for node type ${nodeType}`,
      error
    );
  }
}

/**
 * Read a custom node's configurable-property schema.
 * @param {string} serviceName custom node service name (not the '_id' and without the 'designer-' prefix)
 * @param {boolean} refreshCache whether to refresh the schema cache for the specified custom node
 * @param {State} state state object
 * @returns {Promise<NodeSkeleton>} a promise that resolves to a node schema object
 */
export async function readCustomNodeSchema({
  serviceName,
  refreshCache = false,
  state,
}: {
  serviceName: string;
  refreshCache?: boolean;
  state: State;
}): Promise<NodeSkeleton> {
  const cacheKey = `designer-${serviceName}`;
  try {
    if (!refreshCache && NodeSchemaCache[cacheKey]) {
      debugMessage({
        message: `NodeOps.readCustomNodeSchema: Using cached schema for custom node "${serviceName}"`,
        state,
      });
      return NodeSchemaCache[cacheKey];
    }
    const schema = await _getCustomNodeSchema({ serviceName, state });
    NodeSchemaCache[cacheKey] = schema;
    return schema;
  } catch (error) {
    throw new FrodoError(
      `Error reading schema for custom node ${serviceName}`,
      error
    );
  }
}

/**
 * Get all nodes
 * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an object containing an array of node objects
 */
export async function readNodes({
  state,
}: {
  state: State;
}): Promise<NodeSkeleton[]> {
  try {
    const { result } = await _getNodes({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading nodes`, error);
  }
}

/**
 * Read all nodes across types and versions with optional version filtering.
 * @param {NodeVersionFilter} nodeVersionFilter optional node version filter
 * @returns {Promise<NodeSkeleton[]>} matched node instances
 */
export async function readNodesByVersion({
  nodeVersionFilter,
  state,
}: {
  nodeVersionFilter?: NodeVersionFilter;
  state: State;
}): Promise<NodeSkeleton[]> {
  const normalizeSemver = (value: string): string => {
    const trimmed = value.trim();
    const match = trimmed.match(/^[vV]?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!match) {
      return trimmed;
    }
    const major = Number(match[1]);
    const minor = Number(match[2] ?? '0');
    const patch = Number(match[3] ?? '0');
    return `${major}.${minor}.${patch}`;
  };

  const matchesNodeVersionFilter = (
    version: string,
    filter: NodeVersionFilter
  ): boolean => {
    const normalizedVersion = normalizeSemver(version);

    if (filter.eq && !eq(normalizedVersion, normalizeSemver(filter.eq))) {
      return false;
    }
    if (filter.gt && !gt(normalizedVersion, normalizeSemver(filter.gt))) {
      return false;
    }
    if (
      filter.gte &&
      !(
        gt(normalizedVersion, normalizeSemver(filter.gte)) ||
        eq(normalizedVersion, normalizeSemver(filter.gte))
      )
    ) {
      return false;
    }
    if (filter.lt && !lt(normalizedVersion, normalizeSemver(filter.lt))) {
      return false;
    }
    if (
      filter.lte &&
      !(
        lt(normalizedVersion, normalizeSemver(filter.lte)) ||
        eq(normalizedVersion, normalizeSemver(filter.lte))
      )
    ) {
      return false;
    }

    if (filter.from) {
      const from = normalizeSemver(filter.from);
      const includeFrom = filter.includeFrom ?? true;
      const fromOk = includeFrom
        ? gt(normalizedVersion, from) || eq(normalizedVersion, from)
        : gt(normalizedVersion, from);
      if (!fromOk) {
        return false;
      }
    }

    if (filter.to) {
      const to = normalizeSemver(filter.to);
      const includeTo = filter.includeTo ?? true;
      const toOk = includeTo
        ? lt(normalizedVersion, to) || eq(normalizedVersion, to)
        : lt(normalizedVersion, to);
      if (!toOk) {
        return false;
      }
    }

    return true;
  };

  try {
    const typeResult = await readNodeTypes({ state });
    const types = Array.isArray(typeResult)
      ? typeResult
      : (Object.values(typeResult || {}) as NodeTypeSkeleton[]);
    const nodes: NodeSkeleton[] = [];
    for (const type of types) {
      const versions =
        requireVersion(state) && type.versions && type.versions.length > 0
          ? type.versions
              .map((version) =>
                typeof version === 'string' ? version.trim() : ''
              )
              .filter((version) => version.length > 0)
          : ['1.0'];
      for (const version of versions) {
        if (
          nodeVersionFilter &&
          !matchesNodeVersionFilter(version, nodeVersionFilter)
        ) {
          continue;
        }
        try {
          const byType = await _getNodesByType({
            nodeType: type._id,
            nodeTypeVersion: version,
            state,
          });
          nodes.push(...byType.result);
        } catch {
          // Ignore types/versions that are not queryable in the current environment.
        }
      }
    }
    return nodes;
  } catch (error) {
    throw new FrodoError(`Error reading nodes by version`, error);
  }
}

/**
 * Read all nodes by type
 * @param {string} nodeType node type
 * @param {string} nodeTypeVersion node type version
 * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an object containing an array of node objects of the requested type
 */
export async function readNodesByType({
  nodeType,
  nodeTypeVersion = '1.0',
  state,
}: {
  nodeType: string;
  nodeTypeVersion?: string;
  state: State;
}): Promise<NodeSkeleton[]> {
  try {
    const { result } = await _getNodesByType({
      nodeType,
      nodeTypeVersion,
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading ${nodeType} nodes`, error);
  }
}

/**
 * Read node
 * @param {String} nodeId node uuid
 * @param {String} nodeType node type
 * @returns {Promise} a promise that resolves to a node object
 */
export async function readNode({
  nodeId,
  nodeType,
  nodeTypeVersion = '1.0',
  state,
}: {
  nodeId: string;
  nodeType: string;
  nodeTypeVersion?: string;
  state: State;
}): Promise<NodeSkeleton> {
  try {
    return await _getNode({ nodeId, nodeType, nodeTypeVersion, state });
  } catch (error) {
    throw new FrodoError(`Error reading ${nodeType} node ${nodeId}`, error);
  }
}

/**
 * Export all nodes
 * @returns {Promise<NodeExportInterface>} a promise that resolves to an array of node objects
 */
export async function exportNodes({
  state,
}: {
  state: State;
}): Promise<NodeExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `NodeOps.exportNodes: start`, state });
    const exportData = createNodeExportTemplate({ state });
    const nodes = await readNodes({ state });
    indicatorId = createProgressIndicator({
      total: nodes.length,
      message: 'Exporting nodes...',
      state,
    });
    for (const node of nodes) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting node ${node._id}`,
        state,
      });
      exportData.node[node._id] = node;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${nodes.length} nodes.`,
      state,
    });
    debugMessage({ message: `NodeOps.exportNodes: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting nodes.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error reading nodes`, error);
  }
}

/**
 * Create node
 * @param {string} nodeId node uuid
 * @param {string} nodeType node type
 * @param {NodeSkeleton} nodeData node object
 * @returns {Promise<NodeSkeleton>} a promise that resolves to an object containing a node object
 */
export async function createNode({
  nodeId,
  nodeType,
  nodeTypeVersion = '1.0',
  nodeData,
  state,
}: {
  nodeId?: string;
  nodeType: string;
  nodeTypeVersion?: string;
  nodeData: NodeSkeleton;
  state: State;
}): Promise<NodeSkeleton> {
  try {
    if (nodeId) {
      try {
        await readNode({ nodeId, nodeType, nodeTypeVersion, state });
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
        const result = await updateNode({
          nodeId,
          nodeType,
          nodeTypeVersion,
          nodeData,
          state,
        });
        return result;
      }
      throw new FrodoError(`Node ${nodeId} already exists!`);
    }
    return _createNode({ nodeType, nodeTypeVersion, nodeData, state });
  } catch (error) {
    throw new FrodoError(`Error creating ${nodeType} node ${nodeId}`, error);
  }
}

/**
 * Put node by uuid and type
 * @param {string} nodeId node uuid
 * @param {string} nodeType node type
 * @param {object} nodeData node object
 * @returns {Promise} a promise that resolves to an object containing a node object
 */
export async function updateNode({
  nodeId,
  nodeType,
  nodeTypeVersion = '1.0',
  nodeData,
  state,
}: {
  nodeId: string;
  nodeType: string;
  nodeTypeVersion?: string;
  nodeData: NodeSkeleton;
  state: State;
}): Promise<NodeSkeleton> {
  try {
    return _putNode({ nodeId, nodeType, nodeTypeVersion, nodeData, state });
  } catch (error) {
    throw new FrodoError(`Error updating ${nodeType} node ${nodeId}`, error);
  }
}

/**
 * Delete node by uuid and type
 * @param {String} nodeId node uuid
 * @param {String} nodeType node type
 * @param {String} nodeTypeVersion node type version
 * @returns {Promise} a promise that resolves to an object containing a node object
 */
export async function deleteNode({
  nodeId,
  nodeType,
  nodeTypeVersion = '1.0',
  state,
}: {
  nodeId: string;
  nodeType: string;
  nodeTypeVersion?: string;
  state: State;
}): Promise<NodeSkeleton> {
  try {
    return _deleteNode({ nodeId, nodeType, nodeTypeVersion, state });
  } catch (error) {
    throw new FrodoError(`Error deleting ${nodeType} node ${nodeId}`, error);
  }
}

/**
 * Get custom node usage by ID
 * @param {String} nodeId ID or service name of the custom node
 * @returns {Promise<CustomNodeUsage>} a promise that resolves to an object containing a custom node usage object
 */
export async function getCustomNodeUsage({
  nodeId,
  state,
}: {
  nodeId: string;
  state: State;
}): Promise<CustomNodeUsage> {
  try {
    return await _getCustomNodeUsage({
      nodeId: getCustomNodeId(nodeId),
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error getting custom node usage`, error);
  }
}

/**
 * Helper that normalized a service name to custom node id if needed
 * @param nodeId The custom node id or service name
 * @returns nodeId if falsey or in id format, otherwise returns nodeId in id format
 */
export function getCustomNodeId(nodeId?: string): string | undefined | null {
  return !nodeId || nodeId.endsWith('-1') ? nodeId : nodeId + '-1';
}

/**
 * Read custom node. Either ID or name must be provided.
 * @param {string} nodeId ID or service name of custom node. Takes priority over node display name if both are provided.
 * @param {string} nodeName Display name of custom node.
 * @returns {Promise<CustomNodeSkeleton>} a promise that resolves to a custom node object
 */
export async function readCustomNode({
  nodeId,
  nodeName,
  state,
}: {
  nodeId?: string;
  nodeName?: string;
  state: State;
}): Promise<CustomNodeSkeleton> {
  nodeId = getCustomNodeId(nodeId);
  if (!nodeId && !nodeName) {
    throw new FrodoError(`No custom node ID or display name provided.`);
  }
  try {
    if (nodeId) {
      return await getCustomNode({ nodeId, state });
    }
    const nodes = await readCustomNodes({ state });
    for (const node of nodes) {
      if (node.displayName === nodeName) {
        return node;
      }
    }
    throw new FrodoError(`Custom node '${nodeName}' not found`);
  } catch (error) {
    throw new FrodoError(
      `Error reading custom node ${nodeName || nodeId}`,
      error
    );
  }
}

/**
 * Read all custom nodes
 * @returns {Promise<CustomNodeSkeleton[]>} a promise that resolves to an array of custom nodes objects
 */
export async function readCustomNodes({
  state,
}: {
  state: State;
}): Promise<CustomNodeSkeleton[]> {
  try {
    const { result } = await getCustomNodes({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading custom nodes`, error);
  }
}

/**
 * Export custom node. Either ID or name must be provided.
 * @param {string} nodeId ID or service name of custom node. Takes priority over node display name if both are provided.
 * @param {string} nodeName Display name of custom node.
 * @param {CustomNodeExportOptions} options Custom node export options
 * @returns {Promise<CustomNodeExportInterface>} a promise that resolves to a custom node export object
 */
export async function exportCustomNode({
  nodeId,
  nodeName,
  options = {
    useStringArrays: true,
  },
  state,
}: {
  nodeId?: string;
  nodeName?: string;
  options?: CustomNodeExportOptions;
  state: State;
}): Promise<CustomNodeExportInterface> {
  nodeId = getCustomNodeId(nodeId);
  if (!nodeId && !nodeName) {
    throw new FrodoError(`No custom node ID or display name provided.`);
  }
  try {
    debugMessage({ message: `NodeOps.exportCustomNode: start`, state });
    const exportData = createCustomNodeExportTemplate({ state });
    const node = await readCustomNode({ nodeId, nodeName, state });
    if (options.useStringArrays) {
      node.script = (node.script as string).split('\n');
    }
    exportData.nodeTypes[node._id] = node;
    debugMessage({ message: `NodeOps.exportCustomNode: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting custom node ${nodeName || nodeId}`,
      error
    );
  }
}

/**
 * Export all custom nodes
 * @param {CustomNodeExportOptions} options Custom node export options
 * @returns {Promise<CustomNodeExportInterface>} a promise that resolves to a custom node export object
 */
export async function exportCustomNodes({
  options = {
    useStringArrays: true,
  },
  state,
}: {
  options?: CustomNodeExportOptions;
  state: State;
}): Promise<CustomNodeExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `NodeOps.exportCustomNodes: start`, state });
    const exportData = createCustomNodeExportTemplate({ state });
    const nodes = await readCustomNodes({ state });
    indicatorId = createProgressIndicator({
      total: nodes.length,
      message: 'Exporting custom nodes...',
      state,
    });
    for (const node of nodes) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting custom node ${node.displayName}`,
        state,
      });
      if (options.useStringArrays) {
        node.script = (node.script as string).split('\n');
      }
      exportData.nodeTypes[node._id] = node;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${nodes.length} custom nodes.`,
      state,
    });
    debugMessage({ message: `NodeOps.exportCustomNodes: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting custom nodes.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting custom nodes`, error);
  }
}

/**
 * Update custom node by ID
 * @param {string} nodeId ID or service name of custom node.
 * @param {CustomNodeSkeleton} nodeData node object
 * @returns {Promise<CustomNodeSkeleton>} a promise that resolves to a custom node object
 */
export async function updateCustomNode({
  nodeId,
  nodeData,
  state,
}: {
  nodeId: string;
  nodeData: CustomNodeSkeleton;
  state: State;
}): Promise<CustomNodeSkeleton> {
  nodeId = getCustomNodeId(nodeId);
  let result;
  try {
    if (Array.isArray(nodeData.script)) {
      nodeData.script = nodeData.script.join('\n');
    }
    result = await putCustomNode({ nodeId, nodeData, state });
  } catch (error) {
    if (
      error.response?.status === 409 &&
      error.response?.data.message.startsWith('Node Type with display name') &&
      error.response?.data.message.endsWith('already exists')
    ) {
      verboseMessage({
        message: `updateCustomNode WARNING: custom node with display name ${nodeData.displayName} already exists, using renaming policy... <name> => <name - imported (n)>`,
        state,
      });
      const newName = applyNameCollisionPolicy(nodeData.displayName);
      nodeData.displayName = newName;
      result = await updateCustomNode({ nodeId, nodeData, state });
      verboseMessage({
        message: `Saved custom node as ${newName}`,
        state,
      });
    } else {
      throw new FrodoError(`Error updating custom node`, error);
    }
  }
  return result;
}

/**
 * Import custom nodes
 * @param {string} nodeId ID or service name of custom node. If supplied, only the custom node of that id is imported. Takes priority over node display name if both are provided.
 * @param {string} nodeName Display name of custom node. If supplied, only the custom node of that name is imported
 * @param {CustomNodeExportInterface} importData Custom node import data
 * @param {CustomNodeImportOptions} options Custom node import options
 * @param {ResultCallback<CustomNodeSkeleton>} resultCallback Optional callback to process individual results
 * @returns {Promise<CustomNodeSkeleton[]>} the imported custom nodes
 */
export async function importCustomNodes({
  nodeId,
  nodeName,
  importData,
  options = {
    reUuid: false,
    wait: false,
  },
  resultCallback,
  state,
}: {
  nodeId?: string;
  nodeName?: string;
  importData: CustomNodeExportInterface;
  options: CustomNodeImportOptions;
  resultCallback?: ResultCallback<CustomNodeSkeleton>;
  state: State;
}): Promise<CustomNodeSkeleton[]> {
  nodeId = getCustomNodeId(nodeId);
  debugMessage({ message: `NodeOps.importCustomNodes: start`, state });
  const response: CustomNodeSkeleton[] = [];
  for (const existingId of Object.keys(importData.nodeTypes)) {
    try {
      const nodeData = importData.nodeTypes[existingId];
      const shouldNotImportCustomNode =
        (nodeId && nodeId !== nodeData._id) ||
        (!nodeId && nodeName && nodeName !== nodeData.displayName);
      if (shouldNotImportCustomNode) continue;
      debugMessage({
        message: `NodeOps.importCustomNodes: Importing custom node ${nodeData.displayName} (${existingId})`,
        state,
      });
      let newId = existingId;
      if (options.reUuid) {
        newId = uuidv4().replaceAll('-', '');
        debugMessage({
          message: `NodeOps.importCustomNodes: Re-uuid-ing custom node ${nodeData.displayName} ${existingId} => ${newId}-1...`,
          state,
        });
        nodeData._id = newId + '-1';
        nodeData.serviceName = newId;
      }
      if (Array.isArray(nodeData.script))
        nodeData.script = nodeData.script.join('\n');
      // First attempt to create the node. If it fails, try updating it
      let result;
      try {
        result = await createCustomNode({ nodeData, state });
      } catch (error) {
        debugMessage({
          message: `NodeOps.importCustomNodes: Custom node ${nodeData.displayName} (${existingId}) already exists, attempting to update...`,
          state,
        });
        if (error.response?.status === 409) {
          result = await updateCustomNode({
            nodeId: newId,
            nodeData,
            state,
          });
        } else throw error;
      }
      if (resultCallback) {
        resultCallback(undefined, result);
      }
      response.push(result);
    } catch (e) {
      debugMessage({
        message: `NodeOps.importCustomNodes: Error importing custom node ${importData.nodeTypes[existingId].displayName} (${existingId})\n${e}\n${e.stack}`,
        state,
      });
      if (resultCallback) {
        resultCallback(e, undefined);
      } else {
        throw new FrodoError(
          `Error importing custom node '${importData.nodeTypes[existingId].displayName}'`,
          e
        );
      }
    }
  }
  if (options.wait) {
    debugMessage({
      message: `NodeOps.importCustomNodes: Waiting for AM to load new custom nodes...`,
      state,
    });
    for (const customNode of response) {
      let loaded = false;
      let retries = 3;
      do {
        try {
          await _getCustomNodeSchema({
            serviceName: customNode.serviceName,
            state,
          });
          loaded = true;
          debugMessage({
            message: `NodeOps.importCustomNodes: Custom node ${customNode.displayName} loaded successfully.`,
            state,
          });
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          debugMessage({
            message: `NodeOps.importCustomNodes: Custom node ${customNode.displayName} not loaded yet. Retrying...`,
            state,
          });
        }
        // wait 100 milliseconds before retrying
        if (!loaded) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } while (!loaded && retries-- > 0);
    }
  }
  debugMessage({ message: `NodeOps.importCustomNodes: end`, state });
  return response;
}

/**
 * Delete custom node. Either ID or name must be provided.
 * @param {string} nodeId ID or service name of custom node. Takes priority over node display name if both are provided.
 * @param {string} nodeName Display name of custom node.
 * @returns {Promise<CustomNodeSkeleton>} promise that resolves to a custom node object
 */
export async function deleteCustomNode({
  nodeId,
  nodeName,
  state,
}: {
  nodeId?: string;
  nodeName?: string;
  state: State;
}): Promise<CustomNodeSkeleton> {
  nodeId = getCustomNodeId(nodeId);
  if (!nodeId && !nodeName) {
    throw new FrodoError(`No custom node ID or display name provided.`);
  }
  try {
    let id = nodeId;
    if (!id) {
      const node = await readCustomNode({ nodeId, nodeName, state });
      id = node._id;
    }
    return await _deleteCustomNode({ nodeId: id, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting custom node ${nodeName || nodeId}`,
      error
    );
  }
}

/**
 * Delete custom nodes
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<CustomNodeSkeleton[]>} promise that resolves to an array of custom node objects
 */
export async function deleteCustomNodes({
  resultCallback,
  state,
}: {
  resultCallback: ResultCallback<CustomNodeSkeleton>;
  state: State;
}): Promise<CustomNodeSkeleton[]> {
  const nodes = await readCustomNodes({ state });
  const deletedNodes = [];
  for (const node of nodes) {
    const result: CustomNodeSkeleton = await getResult(
      resultCallback,
      `Error deleting custom node ${node.displayName}`,
      deleteCustomNode,
      {
        nodeId: node._id,
        nodeName: node.displayName,
        state,
      }
    );
    if (result) {
      deletedNodes.push(result);
    }
  }
  return deletedNodes;
}

/**
 * Find all node configuration objects that are no longer referenced by any tree
 * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an array of orphaned nodes
 */
export async function findOrphanedNodes({
  state,
}: {
  state: State;
}): Promise<NodeSkeleton[]> {
  const allNodes = [];
  const allNodeMap = new Map<string, NodeSkeleton>();
  const orphanedNodes = [];
  let types: NodeTypeSkeleton[];
  const allJourneys = (await getTrees({ state })).result;
  let errorMessage = '';
  const errorTypes = [];

  const indicatorId = createProgressIndicator({
    total: undefined,
    message: `Counting total nodes...`,
    type: 'indeterminate',
    state,
  });
  try {
    types = await readNodeTypes({ state });
  } catch (error) {
    throw new FrodoError(`Error retrieving all available node types`, error);
  }
  for (const type of types) {
    if (requireVersion(state) && type.versions && type.versions.length > 0) {
      for (const version of type.versions) {
        try {
          const nodes = (
            await _getNodesByType({
              nodeType: type._id,
              nodeTypeVersion: version,
              state,
            })
          ).result;
          for (const node of nodes) {
            allNodes.push(node);
            if (!allNodeMap.has(node._id)) {
              allNodeMap.set(node._id, node);
            }
            updateProgressIndicator({
              id: indicatorId,
              message: `${allNodeMap.size} total nodes${errorMessage}`,
              state,
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          errorTypes.push(`${type._id} v${version}`);
          errorMessage = theme(state).warning(
            ` (Skipped type(s): ${errorTypes})`
          );
          updateProgressIndicator({
            id: indicatorId,
            message: `${allNodeMap.size} total nodes${errorMessage}`,
            state,
          });
        }
      }
    } else {
      try {
        const nodes = (await _getNodesByType({ nodeType: type._id, state }))
          .result;
        for (const node of nodes) {
          allNodes.push(node);
          if (!allNodeMap.has(node._id)) {
            allNodeMap.set(node._id, node);
          }
          updateProgressIndicator({
            id: indicatorId,
            message: `${allNodeMap.size} total nodes${errorMessage}`,
            state,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        errorTypes.push(type._id);
        errorMessage = theme(state).warning(
          ` (Skipped type(s): ${errorTypes})`
        );
        updateProgressIndicator({
          id: indicatorId,
          message: `${allNodeMap.size} total nodes${errorMessage}`,
          state,
        });
      }
    }
  }
  if (errorTypes.length > 0) {
    printMessage({
      message:
        `Warning: skipped ${errorTypes.length} node type/version scan(s) while counting total nodes. ` +
        `Results may be partial for this run.`,
      type: 'warn',
      state,
    });
    stopProgressIndicator({
      id: indicatorId,
      message: `${allNodeMap.size} total nodes${errorMessage}`,
      state,
      status: 'warn',
    });
  } else {
    stopProgressIndicator({
      id: indicatorId,
      message: `${allNodeMap.size} total nodes`,
      status: 'success',
      state,
    });
  }

  const indicatorId2 = createProgressIndicator({
    total: undefined,
    message: 'Counting active nodes...',
    type: 'indeterminate',
    state,
  });
  const activeNodes = [];
  const activeNodeSet = new Set<string>();
  const activeNodeSetInTotal = new Set<string>();
  const activeNodeErrorNodes = [];

  for (const journey of allJourneys) {
    for (const nodeId in journey.nodes) {
      if ({}.hasOwnProperty.call(journey.nodes, nodeId)) {
        activeNodes.push(nodeId);
        activeNodeSet.add(nodeId);
        if (allNodeMap.has(nodeId)) {
          activeNodeSetInTotal.add(nodeId);
        }
        updateProgressIndicator({
          id: indicatorId2,
          message: `${activeNodeSetInTotal.size} active nodes`,
          state,
        });
        const node = journey.nodes[nodeId];
        if (containerNodes.includes(node.nodeType)) {
          const nodeTypeVersion = resolveNodeTypeVersion({ node, state });
          try {
            const containerNode = await _getNode({
              nodeId,
              nodeType: node.nodeType,
              nodeTypeVersion,
              state,
            });
            for (const innerNode of containerNode.nodes) {
              activeNodes.push(innerNode._id);
              activeNodeSet.add(innerNode._id);
              if (allNodeMap.has(innerNode._id)) {
                activeNodeSetInTotal.add(innerNode._id);
              }
              updateProgressIndicator({
                id: indicatorId2,
                message: `${activeNodeSetInTotal.size} active nodes`,
                state,
              });
            }
          } catch (error) {
            activeNodeErrorNodes.push(
              `${nodeId} (${node.nodeType} v${nodeTypeVersion})`
            );
            printError({
              error: error as Error,
              message:
                `Failed to inspect container node ${nodeId} ` +
                `(${node.nodeType} v${nodeTypeVersion}); continuing.\n`,
              state,
            });
          }
        }
      }
    }
  }
  stopProgressIndicator({
    id: indicatorId2,
    message:
      activeNodeErrorNodes.length > 0
        ? `${activeNodeSetInTotal.size} active nodes (skipped ${activeNodeErrorNodes.length} container node(s))`
        : `${activeNodeSetInTotal.size} active nodes`,
    status: activeNodeErrorNodes.length > 0 ? 'warn' : 'success',
    state,
  });
  if (activeNodeErrorNodes.length > 0) {
    printMessage({
      message:
        `Warning: ${activeNodeErrorNodes.length} container node(s) could not be inspected while counting active nodes. ` +
        `Continuing with partial active-node data may overestimate orphaned nodes for this run.`,
      type: 'warn',
      state,
    });
    debugMessage({
      message: `Skipped container nodes: ${activeNodeErrorNodes.join(', ')}`,
      state,
    });
  }

  const indicatorId3 = createProgressIndicator({
    total: undefined,
    message: 'Calculating orphaned nodes...',
    type: 'indeterminate',
    state,
  });
  const orphanedNodeMap = new Map<string, NodeSkeleton>();
  const diff = Array.from(allNodeMap.values()).filter(
    (x) => !activeNodeSetInTotal.has(x._id)
  );
  for (const node of diff) {
    if (!orphanedNodeMap.has(node._id)) {
      orphanedNodeMap.set(node._id, node);
    }
  }
  for (const orphanedNode of orphanedNodeMap.values()) {
    orphanedNodes.push(orphanedNode);
  }
  stopProgressIndicator({
    id: indicatorId3,
    message: `${orphanedNodes.length} orphaned nodes`,
    status: 'success',
    state,
  });
  return orphanedNodes;
}

/**
 * Remove orphaned nodes
 * @param {NodeSkeleton[]} orphanedNodes Pass in an array of orphaned node configuration objects to remove
 * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an array nodes that encountered errors deleting
 */
export async function removeOrphanedNodes({
  orphanedNodes,
  state,
}: {
  orphanedNodes: NodeSkeleton[];
  state: State;
}): Promise<NodeSkeleton[]> {
  const errorNodes = [];
  const errorNodeIds = new Set<string>();

  const orphanedNodeMap = new Map<string, NodeSkeleton>();
  for (const node of orphanedNodes) {
    if (!orphanedNodeMap.has(node._id)) {
      orphanedNodeMap.set(node._id, node);
    }
  }
  const uniqueOrphanedNodes = Array.from(orphanedNodeMap.values());
  const orderedOrphanedNodes = uniqueOrphanedNodes.sort((a, b) => {
    const aIsContainer = containerNodes.includes(a['_type']?._id);
    const bIsContainer = containerNodes.includes(b['_type']?._id);
    if (aIsContainer === bIsContainer) {
      return 0;
    }
    return aIsContainer ? 1 : -1;
  });

  const getFailedRequestUrl = (error: any): string | undefined => {
    return (
      error?.config?.url ||
      error?.originalErrors?.[0]?.config?.url ||
      error?.originalErrors?.find?.((e: any) => e?.config?.url)?.config?.url
    );
  };

  const indicatorId = createProgressIndicator({
    total: orderedOrphanedNodes.length,
    message: 'Removing orphaned nodes...',
    state,
  });
  for (const node of orderedOrphanedNodes) {
    const nodeTypeVersion = resolveNodeTypeVersion({ node, state });
    updateProgressIndicator({
      id: indicatorId,
      message: `Removing ${node['_id']}...`,
      state,
    });
    try {
      await deleteNode({
        nodeId: node['_id'],
        nodeType: node['_type']['_id'],
        nodeTypeVersion,
        state,
      });
    } catch (deleteError) {
      if (!errorNodeIds.has(node._id)) {
        errorNodeIds.add(node._id);
        errorNodes.push(node);
      }
      const failedRequestUrl = getFailedRequestUrl(deleteError);
      const nodeContext =
        `Failed to delete orphaned node ${node['_id']} ` +
        `(${node['_type']['_id']} v${nodeTypeVersion})`;
      const details = failedRequestUrl
        ? `\n  Request URL: ${failedRequestUrl}`
        : '';
      printError({
        error: deleteError as Error,
        message: `${nodeContext}${details}\n`,
        state,
      });
    }
  }

  const removedCount = orderedOrphanedNodes.length - errorNodes.length;
  const failedCount = errorNodes.length;
  stopProgressIndicator({
    id: indicatorId,
    message:
      failedCount > 0
        ? `Removed ${removedCount} orphaned nodes (${failedCount} failed).`
        : `Removed ${removedCount} orphaned nodes.`,
    status: failedCount > 0 ? 'warn' : 'success',
    state,
  });
  return errorNodes;
}
