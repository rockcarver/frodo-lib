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
import Constants from '../shared/Constants';
import * as TestData from '../test/setup/NodeSetup';
import { snapshotResultCallback } from '../test/utils/TestUtils';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { filterRecording } from '../utils/PollyUtils';
import * as NodeOps from './NodeOps';

const ctx = autoSetupPolly();
type SnapshotRecord = Record<string, any> & { _id?: string };
const stableNodeTypeIds = [
  TestData.node4._type!._id as string,
  'PageNode',
  TestData.node2._type!._id as string,
  TestData.node1._type!._id as string,
];
const stableNodeIds = [
  TestData.node1._id as string,
  TestData.node3._id as string,
  TestData.node4._id as string,
];
const stableCustomNodeIds = [
  TestData.customNode1._id as string,
  TestData.customNode2._id as string,
  TestData.customNode4._id as string,
];
const versionedNodeType = 'ValidatedUsernameNode';
const versionedNodeTypeVersion = '2.0';
const legacyAmVersion = '7.5.0';

function sortById<T extends SnapshotRecord>(items: T[]): T[] {
  return [...items].sort((left, right) =>
    (left._id ?? '').localeCompare(right._id ?? '')
  );
}

function summarizeNodeTypes(result: SnapshotRecord[]) {
  return sortById(
    result.filter(
      (type): type is SnapshotRecord & { _id: string } =>
        typeof type._id === 'string' && stableNodeTypeIds.includes(type._id)
    )
  ).map(({ _id, name, versions }) => ({
    _id,
    name,
    versions: versions ?? [],
  }));
}

function summarizeNodes(
  nodes: SnapshotRecord[],
  includedIds: string[] = stableNodeIds
) {
  return sortById(
    nodes.filter(
      (node): node is SnapshotRecord & { _id: string } =>
        typeof node._id === 'string' && includedIds.includes(node._id)
    )
  ).map(
    ({
      _id,
      _rev,
      _type,
      autocompleteValues,
      identityResource,
      passwordAttribute,
      prepopulate,
      usernameAttribute,
      validateInput,
    }) => ({
      _id,
      _rev,
      _type,
      ...(autocompleteValues ? { autocompleteValues } : {}),
      ...(identityResource ? { identityResource } : {}),
      ...(passwordAttribute ? { passwordAttribute } : {}),
      ...(prepopulate !== undefined ? { prepopulate } : {}),
      ...(usernameAttribute ? { usernameAttribute } : {}),
      ...(validateInput !== undefined ? { validateInput } : {}),
    })
  );
}

function summarizeCustomNodes(result: SnapshotRecord[]) {
  return sortById(
    result.filter(
      (node): node is SnapshotRecord & { _id: string } =>
        typeof node._id === 'string' && stableCustomNodeIds.includes(node._id)
    )
  ).map(({ _id, serviceName, displayName, tags, version }) => ({
    _id,
    serviceName,
    displayName,
    tags,
    ...(version !== undefined ? { version } : {}),
  }));
}

async function withAmVersion<T>(amVersion: string, callback: () => Promise<T>) {
  const previousAmVersion = state.getAmVersion();
  state.setAmVersion(amVersion);
  try {
    return await callback();
  } finally {
    state.setAmVersion(previousAmVersion);
  }
}

async function getExistingVersionedNodeId(nodeType: string) {
  const response = await withAmVersion('8.1.0', async () =>
    NodeOps.readNodesByType({
      nodeType,
      nodeTypeVersion: versionedNodeTypeVersion,
      state,
    })
  );
  const existingNodeId = response?.[0]?._id;
  expect(existingNodeId).toBeDefined();
  return existingNodeId as string;
}

describe('NodeOps', () => {
  TestData.setup();

  beforeEach(async () => {
    state.setAmVersion(legacyAmVersion);
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
        expect(summarizeNodeTypes(response)).toMatchSnapshot();
      });
    });

    describe('version-aware node reads', () => {
      test(`1: Read versioned node type [${versionedNodeType} v${versionedNodeTypeVersion}]`, async () => {
        const response = await withAmVersion('8.1.0', async () =>
          NodeOps.readNodeType({
            nodeType: versionedNodeType,
            nodeTypeVersion: versionedNodeTypeVersion,
            state,
          })
        );
        expect(response).toMatchSnapshot();
      });

      test(`2: Read versioned nodes by type [${versionedNodeType} v${versionedNodeTypeVersion}]`, async () => {
        const versionedNodeId =
          await getExistingVersionedNodeId(versionedNodeType);
        const response = await withAmVersion('8.1.0', async () =>
          NodeOps.readNodesByType({
            nodeType: versionedNodeType,
            nodeTypeVersion: versionedNodeTypeVersion,
            state,
          })
        );
        expect(summarizeNodes(response, [versionedNodeId])).toMatchSnapshot();
      });

      test(`3: Read existing versioned node [${versionedNodeType} v${versionedNodeTypeVersion}]`, async () => {
        const versionedNodeId =
          await getExistingVersionedNodeId(versionedNodeType);
        const response = await withAmVersion('8.1.0', async () =>
          NodeOps.readNode({
            nodeId: versionedNodeId,
            nodeType: versionedNodeType,
            nodeTypeVersion: versionedNodeTypeVersion,
            state,
          })
        );
        expect(response).toMatchSnapshot();
      });
    });

    describe('readNodes()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.readNodes).toBeDefined();
      });

      test('1: Read nodes', async () => {
        const response = await NodeOps.readNodes({ state });
        expect(summarizeNodes(response)).toMatchSnapshot();
      });
    });

    describe('readNodesByType()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.readNodesByType).toBeDefined();
      });

      test('1: Read nodes of type ValidatedUsernameNode', async () => {
        const response = await NodeOps.readNodesByType({
          nodeType: TestData.node1._type!._id as string,
          state,
        });
        expect(
          summarizeNodes(response, [TestData.node1._id as string])
        ).toMatchSnapshot();
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
          expect(error.originalErrors[0].response.data).toMatchSnapshot();
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

      test(`2: Create new node without id`, async () => {
        await TestData.stageNode(TestData.node5);
        const response = await NodeOps.createNode({
          nodeType: TestData.node5._type._id,
          nodeData: TestData.node5,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`3: Create existing node by id`, async () => {
        await TestData.stageNode(TestData.node5, true);
        await expect(
          NodeOps.createNode({
            nodeId: TestData.node5._id,
            nodeType: TestData.node5._type._id,
            nodeData: TestData.node5,
            state,
          })
        ).rejects.toThrow(
          'Error creating SetStateNode node ' + TestData.node5._id
        );
      });

      test(`4: Create existing node without id`, async () => {
        await TestData.stageNode(TestData.node5, true);
        await expect(
          NodeOps.createNode({
            nodeType: TestData.node5._type._id,
            nodeData: TestData.node5,
            state,
          })
        ).rejects.toThrow('Request failed with status code 409');
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
        await expect(
          NodeOps.deleteNode({
            nodeId: '00000000-0000-0000-0000-000000000000',
            nodeType: 'PageNode',
            state,
          })
        ).rejects.toThrow('Request failed with status code 404');
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
        await expect(
          NodeOps.readCustomNode({
            nodeId: '11111111111111111111111111111111-1',
            state,
          })
        ).rejects.toThrow(
          'Error reading custom node 11111111111111111111111111111111-1'
        );
      });

      test(`3: Read existing custom node by name`, async () => {
        const response = await NodeOps.readCustomNode({
          nodeName: TestData.customNode1.displayName,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`4: Read without name or id`, async () => {
        await expect(
          NodeOps.readCustomNode({
            state,
          })
        ).rejects.toThrow('No custom node ID or display name provided.');
      });
    });

    describe('readCustomNodes()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.readCustomNodes).toBeDefined();
      });

      test('1: Read custom nodes', async () => {
        const response = await NodeOps.readCustomNodes({ state });
        expect(summarizeCustomNodes(response)).toMatchSnapshot();
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
        await expect(
          NodeOps.exportCustomNode({
            nodeId: '11111111111111111111111111111111-1',
            state,
          })
        ).rejects.toThrow(
          'Error exporting custom node 11111111111111111111111111111111-1'
        );
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
        await expect(
          NodeOps.exportCustomNode({
            state,
          })
        ).rejects.toThrow('No custom node ID or display name provided.');
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
        await expect(
          NodeOps.updateCustomNode({
            nodeId: TestData.customNode2._id,
            nodeData: TestData.customNode2,
            state,
          })
        ).rejects.toThrow('Error updating custom node');
      });
    });

    describe('importCustomNodes()', () => {
      const importData = NodeOps.createCustomNodeExportTemplate({ state });
      importData.nodeTypes = {
        [TestData.customNode2._id]: TestData.customNode2,
        // We want to also test importing with array scripts, so make this script an array
        [TestData.customNode3._id]: {
          ...TestData.customNode3,
          script: (TestData.customNode3.script as string).split('\n'),
        },
        [TestData.customNode4._id]: TestData.customNode4,
      };

      test('0: Method is implemented', async () => {
        expect(NodeOps.importCustomNodes).toBeDefined();
      });

      test('1: Import None', async () => {
        const response = await NodeOps.importCustomNodes({
          importData: NodeOps.createCustomNodeExportTemplate({ state }),
          options: {
            reUuid: false,
            wait: false,
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
            reUuid: false,
            wait: false,
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
            reUuid: false,
            wait: false,
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
            reUuid: false,
            wait: false,
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
        await expect(
          NodeOps.deleteCustomNode({
            nodeId: '11111111111111111111111111111111-1',
            state,
          })
        ).rejects.toThrow(
          'Error deleting custom node 11111111111111111111111111111111-1'
        );
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
        await expect(
          NodeOps.deleteCustomNode({
            state,
          })
        ).rejects.toThrow('No custom node ID or display name provided.');
      });
    });

    describe('findOrphanedNodes()', () => {
      test('0: Method is implemented', async () => {
        expect(NodeOps.findOrphanedNodes).toBeDefined();
      });
      //TODO: Create tests
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
        expect(NodeOps.getCustomNodeId(TestData.customNode1.serviceName)).toBe(
          TestData.customNode1._id
        );
      });

      test(`2: Return input when falsey or in format]`, async () => {
        expect(NodeOps.getCustomNodeId(undefined)).toBeUndefined();
        expect(NodeOps.getCustomNodeId(null)).toBeNull();
        expect(NodeOps.getCustomNodeId('')).toBe('');
        expect(NodeOps.getCustomNodeId(TestData.customNode1._id)).toBe(
          TestData.customNode1._id
        );
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
