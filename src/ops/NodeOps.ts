import {
  createNode as _createNode,
  deleteNode as _deleteNode,
  getNode as _getNode,
  getNodes as _getNodes,
  getNodesByType as _getNodesByType,
  getNodeTypes as _getNodeTypes,
  type NodeSkeleton,
  type NodeTypeSkeleton,
  putNode as _putNode,
} from '../api/NodeApi';
import { getTrees } from '../api/TreeApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';

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
   * Analyze if a node is a premium node.
   * @param {string} nodeType Node type
   * @returns {boolean} True if the node type is premium, false otherwise.
   */
  isPremiumNode(nodeType: string): boolean;
  /**
   * Analyze if a node is a cloud-only node.
   * @param {string} nodeType Node type
   * @returns {boolean} True if the node type is cloud-only, false otherwise.
   */
  isCloudOnlyNode(nodeType: string): boolean;
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
    isCustomNode(nodeType: string): boolean {
      return isCustomNode({ nodeType, state });
    },
    getNodeClassification(nodeType: string): NodeClassificationType[] {
      return getNodeClassification({ nodeType, state });
    },
  };
};

export type NodeClassificationType =
  | 'standard'
  | 'custom'
  | 'cloud'
  | 'premium';

export enum NodeClassification {
  STANDARD = 'standard',
  CUSTOM = 'custom',
  CLOUD = 'cloud',
  PREMIUM = 'premium',
}

const containerNodes = ['PageNode', 'CustomPageNode'];

/**
 * Read all node types
 * @returns {Promise<NodeTypeSkeleton[]>} a promise that resolves to an array of node type objects
 */
export async function readNodeTypes({
  state,
}: {
  state: State;
}): Promise<NodeTypeSkeleton[]> {
  const { result } = await _getNodeTypes({ state });
  return result;
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
  const { result } = await _getNodes({ state });
  return result;
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
  const { result } = await _getNodesByType({ nodeType, state });
  return result;
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
  return _getNode({ nodeId, nodeType, state });
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
  if (nodeId) {
    try {
      await readNode({ nodeId, nodeType, state });
    } catch (error) {
      const result = await updateNode({ nodeId, nodeType, nodeData, state });
      return result;
    }
    throw new Error(`Node ${nodeId} already exists!`);
  }
  return _createNode({ nodeType, nodeData, state });
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
  return _putNode({ nodeId, nodeType, nodeData, state });
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
  return _deleteNode({ nodeId, nodeType, state });
}

/**
 * Find all node configuration objects that are no longer referenced by any tree
 * @returns {Promise<unknown[]>} a promise that resolves to an array of orphaned nodes
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

  createProgressIndicator({
    total: undefined,
    message: `Counting total nodes...`,
    type: 'indeterminate',
    state,
  });
  try {
    types = (await _getNodeTypes({ state })).result;
  } catch (error) {
    error.message = `Error retrieving all available node types: ${
      error.response?.data?.message || error.message
    }`;
    throw error;
  }
  for (const type of types) {
    try {
      const nodes = (await _getNodesByType({ nodeType: type._id, state }))
        .result;
      for (const node of nodes) {
        allNodes.push(node);
        updateProgressIndicator({
          message: `${allNodes.length} total nodes${errorMessage}`,
          state,
        });
      }
    } catch (error) {
      errorTypes.push(type._id);
      errorMessage = ` (Skipped type(s): ${errorTypes})`['yellow'];
      updateProgressIndicator({
        message: `${allNodes.length} total nodes${errorMessage}`,
        state,
      });
    }
  }
  if (errorTypes.length > 0) {
    stopProgressIndicator({
      message: `${allNodes.length} total nodes${errorMessage}`,
      state,
      status: 'warn',
    });
  } else {
    stopProgressIndicator({
      message: `${allNodes.length} total nodes`,
      status: 'success',
      state,
    });
  }

  createProgressIndicator({
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
              message: `${activeNodes.length} active nodes`,
              state,
            });
          }
        }
      }
    }
  }
  stopProgressIndicator({
    message: `${activeNodes.length} active nodes`,
    status: 'success',
    state,
  });

  createProgressIndicator({
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
  createProgressIndicator({
    total: orphanedNodes.length,
    message: 'Removing orphaned nodes...',
    state,
  });
  for (const node of orphanedNodes) {
    updateProgressIndicator({ message: `Removing ${node['_id']}...`, state });
    try {
      await deleteNode({
        nodeId: node['_id'],
        nodeType: node['_type']['_id'],
        state,
      });
    } catch (deleteError) {
      errorNodes.push(node);
      printMessage({ message: ` ${deleteError}`, type: 'error', state });
    }
  }
  stopProgressIndicator({
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
  'TimeSinceDecisionNode',
  'TimerStartNode',
  'TimerStopNode',
  'UsernameCollectorNode',
  'ValidatedPasswordNode',
  'ValidatedUsernameNode',
  'WebAuthnAuthenticationNode',
  'WebAuthnDeviceStorageNode',
  'WebAuthnRegistrationNode',
  'ZeroPageLoginNode',
  'product-CertificateCollectorNode',
  'product-CertificateUserExtractorNode',
  'product-CertificateValidationNode',
  'product-KerberosNode',
  'product-ReCaptchaNode',
  'product-Saml2Node',
  'product-WriteFederationInformationNode',
];

const OOTB_NODE_TYPES_7_1 = [
  'PushRegistrationNode',
  'GetAuthenticatorAppNode',
  'MultiFactorRegistrationOptionsNode',
  'OptOutMultiFactorAuthenticationNode',
].concat(OOTB_NODE_TYPES_7);

const OOTB_NODE_TYPES_7_2 = [
  'OathRegistrationNode',
  'OathTokenVerifierNode',
  'PassthroughAuthenticationNode',
  'ConfigProviderNode',
  'DebugNode',
].concat(OOTB_NODE_TYPES_7_1);

const OOTB_NODE_TYPES_7_3 = [].concat(OOTB_NODE_TYPES_7_2);

const OOTB_NODE_TYPES_7_4 = [].concat(OOTB_NODE_TYPES_7_3);

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
    case '7.1.0':
      ootbNodeTypes = OOTB_NODE_TYPES_7_1.slice(0);
      break;
    case '7.2.0':
      ootbNodeTypes = OOTB_NODE_TYPES_7_2.slice(0);
      break;
    case '7.3.0':
      ootbNodeTypes = OOTB_NODE_TYPES_7_3.slice(0);
      break;
    case '7.4.0':
      ootbNodeTypes = OOTB_NODE_TYPES_7_4.slice(0);
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
  if (custom) {
    classifications.push(NodeClassification.CUSTOM);
  } else if (cloud) {
    classifications.push(NodeClassification.CLOUD);
  } else {
    classifications.push(NodeClassification.STANDARD);
  }
  if (premium) classifications.push(NodeClassification.PREMIUM);
  return classifications;
}
