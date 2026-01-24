import { v4 as uuidv4 } from 'uuid';

import {
  createCustomNode,
  createNode as _createNode,
  CustomNodeSkeleton,
  CustomNodeUsage,
  deleteCustomNode as _deleteCustomNode,
  deleteNode as _deleteNode,
  getCustomNode,
  getCustomNodes,
  getCustomNodeUsage as _getCustomNodeUsage,
  getNode as _getNode,
  getNodes as _getNodes,
  getNodesByType as _getNodesByType,
  getNodeTypes as _getNodeTypes,
  type NodeSkeleton,
  type NodeTypeSkeleton,
  putCustomNode,
  putNode as _putNode,
} from '../api/NodeApi';
import { getTrees } from '../api/TreeApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  printError,
  stopProgressIndicator,
  updateProgressIndicator,
  verboseMessage,
} from '../utils/Console';
import { getMetadata, getResult } from '../utils/ExportImportUtils';
import { applyNameCollisionPolicy } from '../utils/ForgeRockUtils';
import { FrodoError } from './FrodoError';
import { ExportMetaData, ResultCallback } from './OpsTypes';

export type Node = {
  /**
   * Read all node types
   * @returns {Promise<any>} a promise that resolves to an array of node type objects
   */
  readNodeTypes(): Promise<any>;
  /**
   * Read all nodes
   * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an object containing an array of node objects
   */
  readNodes(): Promise<NodeSkeleton[]>;
  /**
   * Read all nodes by type
   * @param {string} nodeType node type
   * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an object containing an array of node objects of the requested type
   */
  readNodesByType(nodeType: string): Promise<NodeSkeleton[]>;
  /**
   * Read node by uuid and type
   * @param {string} nodeId node uuid
   * @param {string} nodeType node type
   * @returns {Promise<NodeSkeleton>} a promise that resolves to a node object
   */
  readNode(nodeId: string, nodeType: string): Promise<NodeSkeleton>;
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
   * Analyze if a node type is premium.
   * @param {string} nodeType Node type
   * @returns {boolean} True if the node type is premium, false otherwise.
   */
  isPremiumNode(nodeType: string): boolean;
  /**
   * Analyze if a node type is a cloud-only node.
   * @param {string} nodeType Node type
   * @returns {boolean} True if the node type is cloud-only, false otherwise.
   */
  isCloudOnlyNode(nodeType: string): boolean;
  /**
   * Analyze if a node type is a cloud-excluded node. Cloud excluded nodes are OOTB nodes in self-hosted AM deployments but have been excluded in cloud.
   * @param {string} nodeType node type.
   * @returns {boolean} True if node type is cloud-excluded, false otherwise.
   */
  isCloudExcludedNode(nodeType: string): boolean;
  /**
   * Analyze if a node type has been deprecated
   * @param {string} nodeType node type.
   * @returns {boolean} True if node type is deprecated, false otherwise.
   */
  isDeprecatedNode(nodeType: string): boolean;
  /**
   * Analyze if a node is custom.
   * @param {string} nodeType Node type
   * @returns {boolean} True if the node type is custom, false otherwise.
   */
  isCustomNode(nodeType: string): boolean;
  /**
   * Get a node's classifications, which can be one or multiple of:
   * - standard: can run on any instance of a ForgeRock platform
   * - cloud: utilize nodes, which are exclusively available in the ForgeRock Identity Cloud
   * - premium: utilizes nodes, which come at a premium
   * @param {string} nodeType Node type
   * @returns {NodeClassificationType[]} an array of one or multiple classifications
   */
  getNodeClassification(nodeType: string): NodeClassificationType[];
  /**
   * Get custom node usage by ID
   * @param {String} nodeId ID or service name of the custom node
   * @returns {Promise<CustomNodeUsage>} a promise that resolves to an object containing a custom node usage object
   */
  getCustomNodeUsage(nodeId: string): Promise<CustomNodeUsage>;
};

export default (state: State): Node => {
  return {
    readNodeTypes(): Promise<any> {
      return readNodeTypes({ state });
    },
    async readNodes(): Promise<NodeSkeleton[]> {
      return readNodes({ state });
    },
    async readNodesByType(nodeType: string): Promise<NodeSkeleton[]> {
      return readNodesByType({ nodeType, state });
    },
    async readNode(nodeId: string, nodeType: string): Promise<NodeSkeleton> {
      return readNode({ nodeId, nodeType, state });
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
    readCustomNode(
      nodeId?: string,
      nodeName?: string
    ): Promise<CustomNodeSkeleton> {
      return readCustomNode({
        nodeId,
        nodeName,
        state,
      });
    },
    readCustomNodes(): Promise<CustomNodeSkeleton[]> {
      return readCustomNodes({
        state,
      });
    },
    exportCustomNode(
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
    updateCustomNode(
      nodeId: string,
      nodeData: CustomNodeSkeleton
    ): Promise<CustomNodeSkeleton> {
      return updateCustomNode({
        nodeId,
        nodeData,
        state,
      });
    },
    importCustomNodes(
      nodeId: string,
      nodeName: string,
      importData: CustomNodeExportInterface,
      options: CustomNodeImportOptions = {
        reUuid: false,
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
    deleteCustomNode(
      nodeId?: string,
      nodeName?: string
    ): Promise<CustomNodeSkeleton> {
      return deleteCustomNode({
        nodeId,
        nodeName,
        state,
      });
    },
    deleteCustomNodes(
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
    isPremiumNode(nodeType: string): boolean {
      return isPremiumNode(nodeType);
    },
    isCloudOnlyNode(nodeType: string): boolean {
      return isCloudOnlyNode(nodeType);
    },
    isCloudExcludedNode(nodeType: string): boolean {
      return isCloudExcludedNode({ nodeType, state });
    },
    isDeprecatedNode(nodeType: string): boolean {
      return isDeprecatedNode({ nodeType, state });
    },
    isCustomNode(nodeType: string): boolean {
      return isCustomNode({ nodeType, state });
    },
    getNodeClassification(nodeType: string): NodeClassificationType[] {
      return getNodeClassification({ nodeType, state });
    },
    getCustomNodeUsage(nodeId: string): Promise<CustomNodeUsage> {
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

export type NodeClassificationType =
  | 'standard'
  | 'custom'
  | 'cloud'
  | 'excluded'
  | 'premium'
  | 'deprecated';

export enum NodeClassification {
  STANDARD = 'standard',
  CUSTOM = 'custom',
  CLOUD = 'cloud',
  EXCLUDED = 'excluded',
  PREMIUM = 'premium',
  DEPRECATED = 'deprecated',
}

const containerNodes = ['PageNode', 'CustomPageNode'];

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
 * Read all nodes by type
 * @param {string} nodeType node type
 * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an object containing an array of node objects of the requested type
 */
export async function readNodesByType({
  nodeType,
  state,
}: {
  nodeType: string;
  state: State;
}): Promise<NodeSkeleton[]> {
  try {
    const { result } = await _getNodesByType({ nodeType, state });
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
  state,
}: {
  nodeId: string;
  nodeType: string;
  state: State;
}): Promise<NodeSkeleton> {
  try {
    return _getNode({ nodeId, nodeType, state });
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
  nodeData,
  state,
}: {
  nodeId?: string;
  nodeType: string;
  nodeData: NodeSkeleton;
  state: State;
}): Promise<NodeSkeleton> {
  try {
    if (nodeId) {
      try {
        await readNode({ nodeId, nodeType, state });
      } catch (error) {
        const result = await updateNode({ nodeId, nodeType, nodeData, state });
        return result;
      }
      throw new FrodoError(`Node ${nodeId} already exists!`);
    }
    return _createNode({ nodeType, nodeData, state });
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
  nodeData,
  state,
}: {
  nodeId: string;
  nodeType: string;
  nodeData: NodeSkeleton;
  state: State;
}): Promise<NodeSkeleton> {
  try {
    return _putNode({ nodeId, nodeType, nodeData, state });
  } catch (error) {
    throw new FrodoError(`Error updating ${nodeType} node ${nodeId}`, error);
  }
}

/**
 * Delete node by uuid and type
 * @param {String} nodeId node uuid
 * @param {String} nodeType node type
 * @returns {Promise} a promise that resolves to an object containing a node object
 */
export async function deleteNode({
  nodeId,
  nodeType,
  state,
}: {
  nodeId: string;
  nodeType: string;
  state: State;
}): Promise<NodeSkeleton> {
  try {
    return _deleteNode({ nodeId, nodeType, state });
  } catch (error) {
    throw new FrodoError(`Error deleting ${nodeType} node ${nodeId}`, error);
  }
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
  let result = null;
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
  const response = [];
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
  const orphanedNodes = [];
  let types = [];
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
    try {
      const nodes = (await _getNodesByType({ nodeType: type._id, state }))
        .result;
      for (const node of nodes) {
        allNodes.push(node);
        updateProgressIndicator({
          id: indicatorId,
          message: `${allNodes.length} total nodes${errorMessage}`,
          state,
        });
      }
    } catch (error) {
      errorTypes.push(type._id);
      errorMessage = ` (Skipped type(s): ${errorTypes})`['yellow'];
      updateProgressIndicator({
        id: indicatorId,
        message: `${allNodes.length} total nodes${errorMessage}`,
        state,
      });
    }
  }
  if (errorTypes.length > 0) {
    stopProgressIndicator({
      id: indicatorId,
      message: `${allNodes.length} total nodes${errorMessage}`,
      state,
      status: 'warn',
    });
  } else {
    stopProgressIndicator({
      id: indicatorId,
      message: `${allNodes.length} total nodes`,
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
  for (const journey of allJourneys) {
    for (const nodeId in journey.nodes) {
      if ({}.hasOwnProperty.call(journey.nodes, nodeId)) {
        activeNodes.push(nodeId);
        updateProgressIndicator({
          id: indicatorId2,
          message: `${activeNodes.length} active nodes`,
          state,
        });
        const node = journey.nodes[nodeId];
        if (containerNodes.includes(node.nodeType)) {
          const containerNode = await _getNode({
            nodeId,
            nodeType: node.nodeType,
            state,
          });
          for (const innerNode of containerNode.nodes) {
            activeNodes.push(innerNode._id);
            updateProgressIndicator({
              id: indicatorId2,
              message: `${activeNodes.length} active nodes`,
              state,
            });
          }
        }
      }
    }
  }
  stopProgressIndicator({
    id: indicatorId2,
    message: `${activeNodes.length} active nodes`,
    status: 'success',
    state,
  });

  const indicatorId3 = createProgressIndicator({
    total: undefined,
    message: 'Calculating orphaned nodes...',
    type: 'indeterminate',
    state,
  });
  const diff = allNodes.filter((x) => !activeNodes.includes(x._id));
  for (const orphanedNode of diff) {
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
  const indicatorId = createProgressIndicator({
    total: orphanedNodes.length,
    message: 'Removing orphaned nodes...',
    state,
  });
  for (const node of orphanedNodes) {
    updateProgressIndicator({
      id: indicatorId,
      message: `Removing ${node['_id']}...`,
      state,
    });
    try {
      await deleteNode({
        nodeId: node['_id'],
        nodeType: node['_type']['_id'],
        state,
      });
    } catch (deleteError) {
      errorNodes.push(node);
      printError(deleteError);
    }
  }
  stopProgressIndicator({
    id: indicatorId,
    message: `Removed ${orphanedNodes.length} orphaned nodes.`,
    state,
  });
  return errorNodes;
}

const OOTB_NODE_TYPES_7 = [
  'AcceptTermsAndConditionsNode',
  'AccountActiveDecisionNode',
  'AccountLockoutNode',
  'AgentDataStoreDecisionNode',
  'AnonymousSessionUpgradeNode',
  'AnonymousUserNode',
  'AttributeCollectorNode',
  'AttributePresentDecisionNode',
  'AttributeValueDecisionNode',
  'AuthLevelDecisionNode',
  'ChoiceCollectorNode',
  'ConsentNode',
  'CookiePresenceDecisionNode',
  'CreateObjectNode',
  'CreatePasswordNode',
  'DataStoreDecisionNode',
  'DeviceGeoFencingNode',
  'DeviceLocationMatchNode',
  'DeviceMatchNode',
  'DeviceProfileCollectorNode',
  'DeviceSaveNode',
  'DeviceTamperingVerificationNode',
  'DisplayUserNameNode',
  'EmailSuspendNode',
  'EmailTemplateNode',
  'IdentifyExistingUserNode',
  'IncrementLoginCountNode',
  'InnerTreeEvaluatorNode',
  'IotAuthenticationNode',
  'IotRegistrationNode',
  'KbaCreateNode',
  'KbaDecisionNode',
  'KbaVerifyNode',
  'LdapDecisionNode',
  'LoginCountDecisionNode',
  'MessageNode',
  'MetadataNode',
  'MeterNode',
  'ModifyAuthLevelNode',
  'OneTimePasswordCollectorDecisionNode',
  'OneTimePasswordGeneratorNode',
  'OneTimePasswordSmsSenderNode',
  'OneTimePasswordSmtpSenderNode',
  'PageNode',
  'PasswordCollectorNode',
  'PatchObjectNode',
  'PersistentCookieDecisionNode',
  'PollingWaitNode',
  'product-CertificateCollectorNode',
  'product-CertificateUserExtractorNode',
  'product-CertificateValidationNode',
  'product-KerberosNode',
  'product-ReCaptchaNode',
  'product-Saml2Node',
  'product-WriteFederationInformationNode',
  'ProfileCompletenessDecisionNode',
  'ProvisionDynamicAccountNode',
  'ProvisionIdmAccountNode',
  'PushAuthenticationSenderNode',
  'PushResultVerifierNode',
  'QueryFilterDecisionNode',
  'RecoveryCodeCollectorDecisionNode',
  'RecoveryCodeDisplayNode',
  'RegisterLogoutWebhookNode',
  'RemoveSessionPropertiesNode',
  'RequiredAttributesDecisionNode',
  'RetryLimitDecisionNode',
  'ScriptedDecisionNode',
  'SelectIdPNode',
  'SessionDataNode',
  'SetFailureUrlNode',
  'SetPersistentCookieNode',
  'SetSessionPropertiesNode',
  'SetSuccessUrlNode',
  'SocialFacebookNode',
  'SocialGoogleNode',
  'SocialNode',
  'SocialOAuthIgnoreProfileNode',
  'SocialOpenIdConnectNode',
  'SocialProviderHandlerNode',
  'TermsAndConditionsDecisionNode',
  'TimerStartNode',
  'TimerStopNode',
  'TimeSinceDecisionNode',
  'UsernameCollectorNode',
  'ValidatedPasswordNode',
  'ValidatedUsernameNode',
  'WebAuthnAuthenticationNode',
  'WebAuthnDeviceStorageNode',
  'WebAuthnRegistrationNode',
  'ZeroPageLoginNode',
];

const DEPRECATED_NODE_TYPES_7 = [];

const OOTB_NODE_TYPES_7_1 = [
  'GetAuthenticatorAppNode',
  'MultiFactorRegistrationOptionsNode',
  'OptOutMultiFactorAuthenticationNode',
  'PushRegistrationNode',
].concat(OOTB_NODE_TYPES_7);

const DEPRECATED_NODE_TYPES_7_1 = [].concat(DEPRECATED_NODE_TYPES_7);

const OOTB_NODE_TYPES_7_2 = [
  'ConfigProviderNode',
  'DebugNode',
  'OathRegistrationNode',
  'OathTokenVerifierNode',
  'PassthroughAuthenticationNode',
  'product-CaptchaNode',
  'PushWaitNode',
  'SetCustomCookieNode',
].concat(OOTB_NODE_TYPES_7_1);

const DEPRECATED_NODE_TYPES_7_2 = ['product-ReCaptchaNode'].concat(
  DEPRECATED_NODE_TYPES_7_1
);

const OOTB_NODE_TYPES_7_3 = [
  'CombinedMultiFactorRegistrationNode',
  'OathDeviceStorageNode',
  'OidcNode',
].concat(OOTB_NODE_TYPES_7_2);

const DEPRECATED_NODE_TYPES_7_3 = [].concat(DEPRECATED_NODE_TYPES_7_2);

const OOTB_NODE_TYPES_7_4 = ['QueryParameterNode'].concat(OOTB_NODE_TYPES_7_3);

const DEPRECATED_NODE_TYPES_7_4 = [].concat(DEPRECATED_NODE_TYPES_7_3);

const OOTB_NODE_TYPES_7_5 = [
  'DeviceBindingNode',
  'DeviceBindingStorageNode',
  'DeviceSigningVerifierNode',
].concat(OOTB_NODE_TYPES_7_4);

const DEPRECATED_NODE_TYPES_7_5 = ['SocialProviderHandlerNode'].concat(
  DEPRECATED_NODE_TYPES_7_4
);

// move above 7 release nodes once 8 becomes a release version
const OOTB_NODE_TYPES_8 = [].concat(OOTB_NODE_TYPES_7_5);

// move above 7 release nodes once 8 becomes a release version
const DEPRECATED_NODE_TYPES_8 = [].concat(DEPRECATED_NODE_TYPES_7_5);

const OOTB_NODE_TYPES_6_5 = [
  'AbstractSocialAuthLoginNode',
  'AccountLockoutNode',
  'AgentDataStoreDecisionNode',
  'AnonymousUserNode',
  'AuthLevelDecisionNode',
  'ChoiceCollectorNode',
  'CookiePresenceDecisionNode',
  'CreatePasswordNode',
  'DataStoreDecisionNode',
  'InnerTreeEvaluatorNode',
  'LdapDecisionNode',
  'MessageNode',
  'MetadataNode',
  'MeterNode',
  'ModifyAuthLevelNode',
  'OneTimePasswordCollectorDecisionNode',
  'OneTimePasswordGeneratorNode',
  'OneTimePasswordSmsSenderNode',
  'OneTimePasswordSmtpSenderNode',
  'PageNode',
  'PasswordCollectorNode',
  'PersistentCookieDecisionNode',
  'PollingWaitNode',
  'ProvisionDynamicAccountNode',
  'ProvisionIdmAccountNode',
  'PushAuthenticationSenderNode',
  'PushResultVerifierNode',
  'RecoveryCodeCollectorDecisionNode',
  'RecoveryCodeDisplayNode',
  'RegisterLogoutWebhookNode',
  'RemoveSessionPropertiesNode',
  'RetryLimitDecisionNode',
  'ScriptedDecisionNode',
  'SessionDataNode',
  'SetFailureUrlNode',
  'SetPersistentCookieNode',
  'SetSessionPropertiesNode',
  'SetSuccessUrlNode',
  'SocialFacebookNode',
  'SocialGoogleNode',
  'SocialNode',
  'SocialOAuthIgnoreProfileNode',
  'SocialOpenIdConnectNode',
  'TimerStartNode',
  'TimerStopNode',
  'UsernameCollectorNode',
  'WebAuthnAuthenticationNode',
  'WebAuthnRegistrationNode',
  'ZeroPageLoginNode',
];

const OOTB_NODE_TYPES_6 = [
  'AbstractSocialAuthLoginNode',
  'AccountLockoutNode',
  'AgentDataStoreDecisionNode',
  'AnonymousUserNode',
  'AuthLevelDecisionNode',
  'ChoiceCollectorNode',
  'CookiePresenceDecisionNode',
  'CreatePasswordNode',
  'DataStoreDecisionNode',
  'InnerTreeEvaluatorNode',
  'LdapDecisionNode',
  'MessageNode',
  'MetadataNode',
  'MeterNode',
  'ModifyAuthLevelNode',
  'OneTimePasswordCollectorDecisionNode',
  'OneTimePasswordGeneratorNode',
  'OneTimePasswordSmsSenderNode',
  'OneTimePasswordSmtpSenderNode',
  'PageNode',
  'PasswordCollectorNode',
  'PersistentCookieDecisionNode',
  'PollingWaitNode',
  'ProvisionDynamicAccountNode',
  'ProvisionIdmAccountNode',
  'PushAuthenticationSenderNode',
  'PushResultVerifierNode',
  'RecoveryCodeCollectorDecisionNode',
  'RecoveryCodeDisplayNode',
  'RegisterLogoutWebhookNode',
  'RemoveSessionPropertiesNode',
  'RetryLimitDecisionNode',
  'ScriptedDecisionNode',
  'SessionDataNode',
  'SetFailureUrlNode',
  'SetPersistentCookieNode',
  'SetSessionPropertiesNode',
  'SetSuccessUrlNode',
  'SocialFacebookNode',
  'SocialGoogleNode',
  'SocialNode',
  'SocialOAuthIgnoreProfileNode',
  'SocialOpenIdConnectNode',
  'TimerStartNode',
  'TimerStopNode',
  'UsernameCollectorNode',
  'WebAuthnAuthenticationNode',
  'WebAuthnRegistrationNode',
  'ZeroPageLoginNode',
];

const CLOUD_EXCLUDED_NODE_TYPES = [
  'CreatePasswordNode',
  'ProvisionDynamicAccountNode',
  'ProvisionIdmAccountNode',
  'SocialFacebookNode',
  'SocialGoogleNode',
  'SocialNode',
  'SocialOAuthIgnoreProfileNode',
  'SocialOpenIdConnectNode',
];

const CLOUD_ONLY_NODE_TYPES = [
  'IdentityStoreDecisionNode',
  'AutonomousAccessSignalNode',
  'AutonomousAccessDecisionNode',
  'AutonomousAccessResultNode',
];

const PREMIUM_NODE_TYPES = [
  'AutonomousAccessSignalNode',
  'AutonomousAccessDecisionNode',
  'AutonomousAccessResultNode',
];

/**
 * Analyze if a node is a premium node.
 * @param {string} nodeType Node type
 * @returns {boolean} True if the node type is premium, false otherwise.
 */
export function isPremiumNode(nodeType: string): boolean {
  return PREMIUM_NODE_TYPES.includes(nodeType);
}

/**
 * Analyze if a node is a cloud-only node.
 * @param {string} nodeType Node type
 * @returns {boolean} True if the node type is cloud-only, false otherwise.
 */
export function isCloudOnlyNode(nodeType: string): boolean {
  return CLOUD_ONLY_NODE_TYPES.includes(nodeType);
}

/**
 * Analyze if a node is a cloud-excluded node. Cloud excluded nodes are OOTB nodes in self-hosted AM deployments but have been excluded in cloud.
 * @param {{string, State}} param0 object containing node type and state.
 * @returns {boolean} True if node type is cloud-excluded, false otherwise.
 */
export function isCloudExcludedNode({
  nodeType,
  state,
}: {
  nodeType: string;
  state: State;
}): boolean {
  return (
    state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY &&
    CLOUD_EXCLUDED_NODE_TYPES.includes(nodeType)
  );
}

/**
 * Analyze if node has been deprecated
 * @param {{string, State}} param0 object containing node type and state.
 * @returns {boolean} True if node type is deprecated, false otherwise.
 */
export function isDeprecatedNode({
  nodeType,
  state,
}: {
  nodeType: string;
  state: State;
}): boolean {
  let deprecatedNodeTypes = [];
  switch (state.getAmVersion()) {
    case '8.0.0':
      deprecatedNodeTypes = DEPRECATED_NODE_TYPES_8.slice(0);
      break;
    case '7.1.0':
    case '7.1.1':
    case '7.1.2':
    case '7.1.3':
    case '7.1.4':
      deprecatedNodeTypes = DEPRECATED_NODE_TYPES_7_1.slice(0);
      break;
    case '7.2.0':
    case '7.2.1':
      deprecatedNodeTypes = DEPRECATED_NODE_TYPES_7_2.slice(0);
      break;
    case '7.3.0':
      deprecatedNodeTypes = DEPRECATED_NODE_TYPES_7_3.slice(0);
      break;
    case '7.4.0':
      deprecatedNodeTypes = DEPRECATED_NODE_TYPES_7_4.slice(0);
      break;
    case '7.5.0':
      deprecatedNodeTypes = DEPRECATED_NODE_TYPES_7_5.slice(0);
      break;
    case '7.0.0':
    case '7.0.1':
    case '7.0.2':
      deprecatedNodeTypes = DEPRECATED_NODE_TYPES_7.slice(0);
      break;
    default:
      return false;
  }
  return deprecatedNodeTypes.includes(nodeType);
}

/**
 * Analyze if a node is custom.
 * @param {string} nodeType Node type
 * @returns {boolean} True if the node type is custom, false otherwise.
 */
export function isCustomNode({
  nodeType,
  state,
}: {
  nodeType: string;
  state: State;
}): boolean {
  let ootbNodeTypes = [];
  switch (state.getAmVersion()) {
    case '8.0.0':
      ootbNodeTypes = OOTB_NODE_TYPES_8.slice(0);
      break;
    case '7.1.0':
    case '7.1.1':
    case '7.1.2':
    case '7.1.3':
    case '7.1.4':
      ootbNodeTypes = OOTB_NODE_TYPES_7_1.slice(0);
      break;
    case '7.2.0':
    case '7.2.1':
      ootbNodeTypes = OOTB_NODE_TYPES_7_2.slice(0);
      break;
    case '7.3.0':
      ootbNodeTypes = OOTB_NODE_TYPES_7_3.slice(0);
      break;
    case '7.4.0':
      ootbNodeTypes = OOTB_NODE_TYPES_7_4.slice(0);
      break;
    case '7.5.0':
      ootbNodeTypes = OOTB_NODE_TYPES_7_5.slice(0);
      break;
    case '7.0.0':
    case '7.0.1':
    case '7.0.2':
      ootbNodeTypes = OOTB_NODE_TYPES_7.slice(0);
      break;
    case '6.5.3':
    case '6.5.2.3':
    case '6.5.2.2':
    case '6.5.2.1':
    case '6.5.2':
    case '6.5.1':
    case '6.5.0.2':
    case '6.5.0.1':
      ootbNodeTypes = OOTB_NODE_TYPES_6_5.slice(0);
      break;
    case '6.0.0.7':
    case '6.0.0.6':
    case '6.0.0.5':
    case '6.0.0.4':
    case '6.0.0.3':
    case '6.0.0.2':
    case '6.0.0.1':
    case '6.0.0':
      ootbNodeTypes = OOTB_NODE_TYPES_6.slice(0);
      break;
    default:
      return true;
  }
  return (
    !ootbNodeTypes.includes(nodeType) &&
    !isPremiumNode(nodeType) &&
    !isCloudOnlyNode(nodeType)
  );
}

/**
 * Get a node's classifications, which can be one or multiple of:
 * - standard: can run on any instance of a ForgeRock platform
 * - cloud: utilize nodes, which are exclusively available in the ForgeRock Identity Cloud
 * - premium: utilizes nodes, which come at a premium
 * @param {string} nodeType Node type
 * @returns {NodeClassification[]} an array of one or multiple classifications
 */
export function getNodeClassification({
  nodeType,
  state,
}: {
  nodeType: string;
  state: State;
}): NodeClassificationType[] {
  const classifications: NodeClassificationType[] = [];
  const premium = isPremiumNode(nodeType);
  const custom = isCustomNode({ nodeType, state });
  const cloud = isCloudOnlyNode(nodeType);
  const excluded = isCloudExcludedNode({ nodeType, state });
  const deprecated = isDeprecatedNode({ nodeType, state });
  if (custom) {
    classifications.push(NodeClassification.CUSTOM);
  } else if (cloud) {
    classifications.push(NodeClassification.CLOUD);
  } else if (excluded) {
    classifications.push(NodeClassification.EXCLUDED);
  } else {
    classifications.push(NodeClassification.STANDARD);
  }
  if (premium) classifications.push(NodeClassification.PREMIUM);
  if (deprecated) classifications.push(NodeClassification.DEPRECATED);
  return classifications;
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
