/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update snapshots
 *
 *    This step breaks down into 2 phases:
 *
 *    Phase 1: Record Non-destructive tests
 *    Phase 2: Record DESTRUCTIVE tests
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
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { filterRecording } from '../utils/PollyUtils';
import Constants from '../shared/Constants';

import * as TestData from '../test/setup/NodeSetup';
import { snapshotResultCallback } from '../test/utils/TestUtils';

const ctx = autoSetupPolly();
const stateCloud750 = frodo.createInstance({
  amVersion: '7.5.0',
  deploymentType: Constants.CLOUD_DEPLOYMENT_TYPE_KEY,
}).state;

stateCloud750.setDeploymentType(Constants.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('NodeOps', () => {

  TestData.setup();

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
    describe('createNodeExportTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.createNodeExportTemplate).toBeDefined();
      });

      test('1: Create Node Export Template', async () => {
        const response = NodeOps.createNodeExportTemplate({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('createCustomNodeExportTemplate()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.createCustomNodeExportTemplate).toBeDefined();
      });

      test('1: Create Custom Node Export Template', async () => {
        const response = NodeOps.createCustomNodeExportTemplate({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('readNodeTypes()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.readNodeTypes).toBeDefined();
      });

      test('1: Read node types', async () => {
        const response = await NodeOps.readNodeTypes({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readNodes()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.readNodes).toBeDefined();
      });

      test('1: Read nodes', async () => {
        const response = await NodeOps.readNodes({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readNodesByType()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.readNodesByType).toBeDefined();
      });

      test('1: Read nodes of type SelectIdPNode', async () => {
        const response = await NodeOps.readNodesByType({ nodeType: 'SelectIdPNode', state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.readNode).toBeDefined();
      });

      test(`1: Read existing node`, async () => {
        const response = await NodeOps.readNode({
          nodeId: TestData.node1._id,
          nodeType: TestData.node1._type._id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing node', async () => {
        expect.assertions(1);
        try {
          await NodeOps.readNode({
            nodeId: '00000000-0000-0000-0000-000000000000',
            nodeType: 'PageNode',
            state,
          });
        } catch (error) {
          expect(error.response.data).toMatchSnapshot();
        }
      });
    });

    describe('exportNodes()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.exportNodes).toBeDefined();
      });

      test('1: Export nodes', async () => {
        const response = await NodeOps.exportNodes({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('createNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.createNode).toBeDefined();
      });
      
      test(`1: Create new node with id`, async () => {
        await TestData.stageNode(TestData.node5);
        const response = await NodeOps.createNode({
          nodeId: TestData.node5._id,
          nodeType: TestData.node5._type._id,
          nodeData: TestData.node5,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Create new node without id`, async() => {
        await TestData.stageNode(TestData.node5);
        const response = await NodeOps.createNode({
          nodeType: TestData.node5._type._id,
          nodeData: TestData.node5,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`3: Create existing node by id`, async() => {
        await TestData.stageNode(TestData.node5, true);
        await expect(NodeOps.createNode({
          nodeId: TestData.node5._id,
          nodeType: TestData.node5._type._id,
          nodeData: TestData.node5,
          state,
        })).rejects.toThrow('Error creating SetStateNode node ' + TestData.node5._id);
      });

      test(`4: Create existing node without id`, async() => {
        await TestData.stageNode(TestData.node5, true);
        await expect(NodeOps.createNode({
          nodeType: TestData.node5._type._id,
          nodeData: TestData.node5,
          state,
        })).rejects.toThrow('Request failed with status code 409');
      });
    });

    describe('updateNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.updateNode).toBeDefined();
      });
      
      test(`1: Update existing node`, async () => {
        await TestData.stageNode(TestData.node3, true);
        const node = await NodeOps.updateNode({
          nodeId: TestData.node3._id,
          nodeType: TestData.node3._type._id,
          nodeData: TestData.node3,
          state,
        });
        expect(node).toMatchSnapshot();
      });

      test(`2: Update non-existing node`, async () => {
        await TestData.stageNode(TestData.node3);
        const node = await NodeOps.updateNode({
          nodeId: TestData.node3._id,
          nodeType: TestData.node3._type._id,
          nodeData: TestData.node3,
          state,
        });
        expect(node).toMatchSnapshot();
      });
    });

    describe('deleteNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.deleteNode).toBeDefined();
      });
      
      test(`1: Delete existing node`, async () => {
        const node = await NodeOps.deleteNode({
          nodeId: TestData.node4._id,
          nodeType: TestData.node4._type._id,
          state,
        });
        expect(node).toMatchSnapshot();
      });
  
      test('2: Delete non-existing node', async () => {
        await expect(NodeOps.deleteNode({
          nodeId: '00000000-0000-0000-0000-000000000000',
          nodeType: 'PageNode',
          state,
        })).rejects.toThrow('Request failed with status code 404');
      });
    });

    describe('readCustomNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.readCustomNode).toBeDefined();
      });
      
      test(`1: Read existing custom node by ID`, async () => {
        const response = await NodeOps.readCustomNode({
          nodeId: TestData.customNode1.serviceName,
          state,
        });
        expect(response).toMatchSnapshot();
      });
  
      test('2: Read non-existing custom node', async () => {
        await expect(NodeOps.readCustomNode({
          nodeId: '11111111111111111111111111111111-1',
          state,
        })).rejects.toThrow('Error reading custom node 11111111111111111111111111111111-1');
      });

      test(`3: Read existing custom node by name`, async () => {
        const response = await NodeOps.readCustomNode({
          nodeName: TestData.customNode1.displayName,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`4: Read without name or id`, async () => {
        await expect(NodeOps.readCustomNode({
          state,
        })).rejects.toThrow('No custom node ID or display name provided.');
      });
    });

    describe('readCustomNodes()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.readCustomNodes).toBeDefined();
      });

      test('1: Read custom nodes', async () => {
        const response = await NodeOps.readCustomNodes({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportCustomNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.exportCustomNode).toBeDefined();
      });

      test(`1: Export existing custom node by ID`, async () => {
        const response = await NodeOps.exportCustomNode({
          nodeId: TestData.customNode1.serviceName,
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
  
      test('2: Export non-existing custom node', async () => {
        await expect(NodeOps.exportCustomNode({
          nodeId: '11111111111111111111111111111111-1',
          state,
        })).rejects.toThrow('Error exporting custom node 11111111111111111111111111111111-1');
      });

      test(`3: Export existing custom node by name`, async () => {
        const response = await NodeOps.exportCustomNode({
          nodeName: TestData.customNode1.displayName,
          state,
        });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });

      test(`4: Export without name or id`, async () => {
        await expect(NodeOps.exportCustomNode({
          state,
        })).rejects.toThrow('No custom node ID or display name provided.');
      });
    });

    describe('exportCustomNodes()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.exportCustomNodes).toBeDefined();
      });
      
      test('1: Export custom nodes', async () => {
        const response = await NodeOps.exportCustomNodes({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

    describe('updateCustomNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.updateCustomNode).toBeDefined();
      });
      
      test(`1: Update existing custom node`, async () => {
        await TestData.stageCustomNode(TestData.customNode2, true);
        const response = await NodeOps.updateCustomNode({
          nodeId: TestData.customNode2.serviceName,
          nodeData: TestData.customNode2,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Update non-existing custom node`, async () => {
        await TestData.stageCustomNode(TestData.customNode2);
        await expect(NodeOps.updateCustomNode({
          nodeId: TestData.customNode2._id,
          nodeData: TestData.customNode2,
          state,
        })).rejects.toThrow('Error updating custom node');
      });
    });

    describe('importCustomNodes()', () => {
      
      const importData = NodeOps.createCustomNodeExportTemplate({ state });
      importData.nodeTypes = {
        [TestData.customNode2._id]: TestData.customNode2,
        // We want to also test importing with array scripts, so make this script an array
        [TestData.customNode3._id]: {...TestData.customNode3, script: (TestData.customNode3.script as string).split('\n')},
        [TestData.customNode4._id]: TestData.customNode4,
      }

      test('0: Method is implemented', async () => {
        expect(NodeOps.importCustomNodes).toBeDefined();
      });

      test('1: Import None', async () => {
        const response = await NodeOps.importCustomNodes({
          importData: NodeOps.createCustomNodeExportTemplate({ state }),
          options: {
            reUuid: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Import by ID', async () => {
        const response = await NodeOps.importCustomNodes({
          nodeId: TestData.customNode3.serviceName,
          importData,
          options: {
            reUuid: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('3: Import by Name', async () => {
        const response = await NodeOps.importCustomNodes({
          nodeName: TestData.customNode3.displayName,
          importData,
          options: {
            reUuid: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('4: Import all', async () => {
        const response = await NodeOps.importCustomNodes({
          importData,
          options: {
            reUuid: false
          },
          resultCallback: snapshotResultCallback,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test.todo('5: Import re-uuid');
    });

    describe('deleteCustomNode()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.deleteCustomNode).toBeDefined();
      });
      
      test(`1: Delete existing custom node by id`, async () => {
        await TestData.stageCustomNode(TestData.customNode4, true);
        const node = await NodeOps.deleteCustomNode({
          nodeId: TestData.customNode4.serviceName,
          state,
        });
        expect(node).toMatchSnapshot();
      });
  
      test('2: Delete non-existing custom node', async () => {
        await expect(NodeOps.deleteCustomNode({
          nodeId: '11111111111111111111111111111111-1',
          state,
        })).rejects.toThrow('Error deleting custom node 11111111111111111111111111111111-1');
      });

      test(`3: Delete existing custom node by name`, async () => {
        await TestData.stageCustomNode(TestData.customNode4, true);
        const node = await NodeOps.deleteCustomNode({
          nodeName: TestData.customNode4.displayName,
          state,
        });
        expect(node).toMatchSnapshot();
      });
  
      test('4: Delete without name or id', async () => {
        await expect(NodeOps.deleteCustomNode({
          state,
        })).rejects.toThrow('No custom node ID or display name provided.');
      });
    });

    describe('findOrphanedNodes()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.findOrphanedNodes).toBeDefined();
      });
      //TODO: Create tests
    });

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

    describe('getCustomNodeUsage()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.getCustomNodeUsage).toBeDefined();
      });
  
      test(`1: Get custom node usage [${TestData.customNode1._id}]`, async () => {
        const response = await NodeOps.getCustomNodeUsage({
          nodeId: TestData.customNode1.serviceName,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('getCustomNodeId()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.getCustomNodeId).toBeDefined();
      });
  
      test(`1: Get custom node id of service name]`, async () => {
        expect(NodeOps.getCustomNodeId(TestData.customNode1.serviceName)).toBe(TestData.customNode1._id);
      });

      test(`2: Return input when falsey or in format]`, async () => {
        expect(NodeOps.getCustomNodeId(undefined)).toBeUndefined();
        expect(NodeOps.getCustomNodeId(null)).toBeNull();
        expect(NodeOps.getCustomNodeId('')).toBe('');
        expect(NodeOps.getCustomNodeId(TestData.customNode1._id)).toBe(TestData.customNode1._id);
      });
    });
  }
  // Phase 2
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2')
  ) {
    describe('deleteCustomNodes()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.deleteCustomNodes).toBeDefined();
      });
      //TODO: Create tests
    });

    describe('removeOrphanedNodes()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.removeOrphanedNodes).toBeDefined();
      });
      //TODO: Create tests
    });
  }
});
