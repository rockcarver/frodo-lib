import State from '../shared/State';
import {
  getNode,
  deleteNode,
  getNodeTypes,
  getNodesByType,
} from '../api/NodeApi';
import { getTrees } from '../api/TreeApi';
import {
  printMessage,
  createProgressIndicator,
  updateProgressIndicator,
  stopProgressIndicator,
} from './utils/Console';
import { NodeClassificationType } from './OpsTypes';
import { NodeSkeleton } from '../api/ApiTypes';

export default class NodeOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  /**
   * Find all node configuration objects that are no longer referenced by any tree
   * @returns {Promise<unknown[]>} a promise that resolves to an array of orphaned nodes
   */
  async findOrphanedNodes(): Promise<unknown[]> {
    return findOrphanedNodes({ state: this.state });
  }

  /**
   * Remove orphaned nodes
   * @param {NodeSkeleton[]} orphanedNodes Pass in an array of orphaned node configuration objects to remove
   * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an array nodes that encountered errors deleting
   */
  async removeOrphanedNodes(
    orphanedNodes: NodeSkeleton[]
  ): Promise<NodeSkeleton[]> {
    return removeOrphanedNodes({ orphanedNodes, state: this.state });
  }

  /**
   * Analyze if a node is a premium node.
   * @param {string} nodeType Node type
   * @returns {boolean} True if the node type is premium, false otherwise.
   */
  isPremiumNode(nodeType: string): boolean {
    return isPremiumNode(nodeType);
  }

  /**
   * Analyze if a node is a cloud-only node.
   * @param {string} nodeType Node type
   * @returns {boolean} True if the node type is cloud-only, false otherwise.
   */
  isCloudOnlyNode(nodeType: string): boolean {
    return isCloudOnlyNode(nodeType);
  }

  /**
   * Analyze if a node is custom.
   * @param {string} nodeType Node type
   * @returns {boolean} True if the node type is custom, false otherwise.
   */
  isCustomNode(nodeType: string): boolean {
    return isCustomNode({ nodeType, state: this.state });
  }

  /**
   * Get a node's classifications, which can be one or multiple of:
   * - standard: can run on any instance of a ForgeRock platform
   * - cloud: utilize nodes, which are exclusively available in the ForgeRock Identity Cloud
   * - premium: utilizes nodes, which come at a premium
   * @param {string} nodeType Node type
   * @returns {NodeClassificationType[]} an array of one or multiple classifications
   */
  getNodeClassification(nodeType: string): NodeClassificationType[] {
    return getNodeClassification({ nodeType, state: this.state });
  }
}

export enum NodeClassification {
  STANDARD = 'standard',
  CUSTOM = 'custom',
  CLOUD = 'cloud',
  PREMIUM = 'premium',
}

const containerNodes = ['PageNode', 'CustomPageNode'];

/**
 * Find all node configuration objects that are no longer referenced by any tree
 * @returns {Promise<unknown[]>} a promise that resolves to an array of orphaned nodes
 */
export async function findOrphanedNodes({
  state,
}: {
  state: State;
}): Promise<unknown[]> {
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
    types = (await getNodeTypes({ state })).result;
  } catch (error) {
    printMessage({
      message: 'Error retrieving all available node types:',
      type: 'error',
      state,
    });
    printMessage({ message: error.response.data, type: 'error', state });
    return [];
  }
  for (const type of types) {
    try {
      // eslint-disable-next-line no-await-in-loop, no-loop-func
      const nodes = (await getNodesByType({ nodeType: type._id, state }))
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
          const containerNode = await getNode({
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
