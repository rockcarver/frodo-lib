/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    This step breaks down into 4 phases:
 *
 *    Phase 1: Record Non-destructive tests
 *    Phase 2: Record Group 1 of DESTRUCTIVE tests - Deletes by ID
 *    Phase 3: Record Group 2 of DESTRUCTIVE tests - Deletes by tag
 *    Phase 4: Record Group 3 of DESTRUCTIVE tests - Delete all
 *
 *    Because destructive tests interfere with the recording of non-destructive
 *    tests and also interfere among themselves, they have to be run in groups
 *    of non-interfering tests.
 *
 *    To record and update snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record NodeOps
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE JOURNEYS!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record NodeOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=3 FRODO_HOST=frodo-dev npm run test:record NodeOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=4 FRODO_HOST=frodo-dev npm run test:record NodeOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update NodeOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only NodeOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { frodo, state } from '../index';
import * as NodeOps from './NodeOps';
import { autoSetupPolly, filterRecording } from '../utils/AutoSetupPolly';
import Constants from '../shared/Constants';

const ctx = autoSetupPolly();
const stateCloud750 = frodo.createInstance({
  amVersion: '7.5.0',
  deploymentType: Constants.CLOUD_DEPLOYMENT_TYPE_KEY,
}).state;

stateCloud750.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('NodeOps', () => {
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // stage test data
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // clean-up test data
    }
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });
  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    /*
      TODO: Create tests for the following functions

      readNodeTypes(): Promise<any>;
      readNodes(): Promise<NodeSkeleton[]>;
      readNodesByType(nodeType: string): Promise<NodeSkeleton[]>;
      readNode(nodeId: string, nodeType: string): Promise<NodeSkeleton>;
      createNode(nodeType: string, nodeData: NodeSkeleton): Promise<NodeSkeleton>;
      updateNode(
        nodeId: string,
        nodeType: string,
        nodeData: NodeSkeleton
      ): Promise<NodeSkeleton>;
      deleteNode(nodeId: string, nodeType: string): Promise<NodeSkeleton>;
      findOrphanedNodes(): Promise<NodeSkeleton[]>;
      removeOrphanedNodes(orphanedNodes: NodeSkeleton[]): Promise<NodeSkeleton[]>;
    */
    describe('isPremiumNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.isPremiumNode).toBeDefined();
      });

      test('1: PageNode is not a premium node', async () => {
        expect(NodeOps.isPremiumNode('PageNode')).toMatchSnapshot();
      });

      test('2: AutonomousAccessDecisionNode is a premium node', async () => {
        expect(
          NodeOps.isPremiumNode('AutonomousAccessDecisionNode')
        ).toMatchSnapshot();
      });

      test('3: AutonomousAccessResultNode is a premium node', async () => {
        expect(
          NodeOps.isPremiumNode('AutonomousAccessResultNode')
        ).toMatchSnapshot();
      });

      test('4: AutonomousAccessSignalNode is a premium node', async () => {
        expect(
          NodeOps.isPremiumNode('AutonomousAccessSignalNode')
        ).toMatchSnapshot();
      });
    });

    describe('isCloudOnlyNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.isCloudOnlyNode).toBeDefined();
      });

      test('1: LdapDecisionNode is not a cloud-only node', async () => {
        expect(NodeOps.isCloudOnlyNode('LdapDecisionNode')).toMatchSnapshot();
      });

      test('2: AutonomousAccessDecisionNode is a cloud-only node', async () => {
        expect(
          NodeOps.isCloudOnlyNode('AutonomousAccessDecisionNode')
        ).toMatchSnapshot();
      });

      test('3: AutonomousAccessResultNode is a cloud-only node', async () => {
        expect(
          NodeOps.isCloudOnlyNode('AutonomousAccessResultNode')
        ).toMatchSnapshot();
      });

      test('4: AutonomousAccessSignalNode is a cloud-only node', async () => {
        expect(
          NodeOps.isCloudOnlyNode('AutonomousAccessSignalNode')
        ).toMatchSnapshot();
      });

      test('5: IdentityStoreDecisionNode is a cloud-only node', async () => {
        expect(
          NodeOps.isCloudOnlyNode('IdentityStoreDecisionNode')
        ).toMatchSnapshot();
      });
    });

    describe('isCloudExcludedNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.isCloudExcludedNode).toBeDefined();
      });

      test('1: LdapDecisionNode is not a cloud-excluded node', async () => {
        expect(
          NodeOps.isCloudExcludedNode({
            nodeType: 'LdapDecisionNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });
      test('2: CreatePasswordNode is a cloud-excluded node', async () => {
        expect(
          NodeOps.isCloudExcludedNode({
            nodeType: 'CreatePasswordNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });

      test('3: ProvisionDynamicAccountNode is a cloud-excluded node', async () => {
        expect(
          NodeOps.isCloudExcludedNode({
            nodeType: 'ProvisionDynamicAccountNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });

      test('4: ProvisionIdmAccountNode is a cloud-excluded node', async () => {
        expect(
          NodeOps.isCloudExcludedNode({
            nodeType: 'ProvisionIdmAccountNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });

      test('5: SocialFacebookNode is a cloud-excluded node', async () => {
        expect(
          NodeOps.isCloudExcludedNode({
            nodeType: 'SocialFacebookNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });

      test('6: SocialGoogleNode is a cloud-excluded node', async () => {
        expect(
          NodeOps.isCloudExcludedNode({
            nodeType: 'SocialGoogleNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });

      test('7: SocialNode is a cloud-excluded node', async () => {
        expect(
          NodeOps.isCloudExcludedNode({
            nodeType: 'SocialNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });

      test('8: SocialOAuthIgnoreProfileNode is a cloud-excluded node', async () => {
        expect(
          NodeOps.isCloudExcludedNode({
            nodeType: 'SocialOAuthIgnoreProfileNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });

      test('9: SocialOpenIdConnectNode is a cloud-excluded node', async () => {
        expect(
          NodeOps.isCloudExcludedNode({
            nodeType: 'SocialOpenIdConnectNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });
    });

    describe('isDeprecatedNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.isDeprecatedNode).toBeDefined();
      });

      test('1: PageNode is not a deprecated node', async () => {
        expect(
          NodeOps.isDeprecatedNode({
            nodeType: 'PageNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });

      test('2: SocialProviderHandlerNode is a deprecated node', async () => {
        expect(
          NodeOps.isDeprecatedNode({
            nodeType: 'SocialProviderHandlerNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });

      test('3: product-ReCaptchaNode is a deprecated node', async () => {
        expect(
          NodeOps.isDeprecatedNode({
            nodeType: 'product-ReCaptchaNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });
    });

    describe('isCustomNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.isCustomNode).toBeDefined();
      });

      test('1: PageNode is not a custom node', async () => {
        expect(
          NodeOps.isCustomNode({ nodeType: 'PageNode', state: stateCloud750 })
        ).toMatchSnapshot();
      });

      test('2: CustomNode is a custom node', async () => {
        expect(
          NodeOps.isCustomNode({
            nodeType: 'CustomNode',
            state: stateCloud750,
          })
        ).toMatchSnapshot();
      });
    });

    describe('getNodeClassification()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.getNodeClassification).toBeDefined();
      });

      // standard
      test('1: Classification of "PageNode" is "standard"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'PageNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      // cloud, premium
      test('2: Classification of "AutonomousAccessSignalNode" is "cloud, premium"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'AutonomousAccessSignalNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });
      test('3: Classification of "AutonomousAccessDecisionNode" is "cloud, premium"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'AutonomousAccessDecisionNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });
      test('4: Classification of "AutonomousAccessResultNode" is "cloud, premium"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'AutonomousAccessResultNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      // cloud
      test('5: Classification of "IdentityStoreDecisionNode" is "cloud"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'IdentityStoreDecisionNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      // excluded
      test('6: Classification of "CreatePasswordNode" is "excluded"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'CreatePasswordNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      test('7: Classification of "ProvisionDynamicAccountNode" is "excluded"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'ProvisionDynamicAccountNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      test('8: Classification of "ProvisionIdmAccountNode" is "excluded"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'ProvisionIdmAccountNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      test('9: Classification of "SocialFacebookNode" is "excluded"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'SocialFacebookNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      test('10: Classification of "SocialGoogleNode" is "excluded"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'SocialGoogleNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      test('11: Classification of "SocialNode" is "excluded"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'SocialNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      test('12: Classification of "SocialOAuthIgnoreProfileNode" is "excluded"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'SocialOAuthIgnoreProfileNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      test('13: Classification of "SocialOpenIdConnectNode" is "excluded"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'SocialOpenIdConnectNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      // deprecated
      test('14: Classification of "SocialProviderHandlerNode" is "standard, deprecated"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'SocialProviderHandlerNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      test('15: Classification of "product-ReCaptchaNode" is "standard, deprecated"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'product-ReCaptchaNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });

      // custom
      test('16: Classification of "CustomNode" is "custom"', async () => {
        const classification = NodeOps.getNodeClassification({
          nodeType: 'CustomNode',
          state: stateCloud750,
        });
        expect(classification).toMatchSnapshot();
      });
    });
  }
});
