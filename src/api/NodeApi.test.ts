/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record NodeApi
 *
 *    The above command assumes that you have a connection profile for
 *    'volker-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update NodeApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only NodeApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as NodeApi from './NodeApi';
import { frodo } from '../index';
import { state } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { filterRecording } from '../utils/PollyUtils';

import * as TestData from '../test/setup/NodeSetup';

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

function createVersionedState(amVersion: string) {
  const versionedState = frodo.createInstance({
    host: 'https://example.com/am',
    realm: 'employees',
  }).state;
  versionedState.setAmVersion(amVersion);
  return versionedState;
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

function createStateWithoutAmVersion() {
  return frodo.createInstance({
    host: 'https://example.com/am',
    realm: 'employees',
  }).state;
}

async function getExistingVersionedNodeId(nodeType: string) {
  const response = await withAmVersion('8.1.0', async () =>
    NodeApi.getNodesByType({
      nodeType,
      nodeTypeVersion: versionedNodeTypeVersion,
      state,
    })
  );
  const existingNodeId = response.result?.[0]?._id;
  expect(existingNodeId).toBeDefined();
  return existingNodeId as string;
}

const versionedNodeType = 'ValidatedUsernameNode';
const versionedNodeTypeVersion = '2.0';
const versionedContainerNodeType = 'PageNode';
const legacyAmVersion = '7.5.0';

describe('NodeApi', () => {
  TestData.setup();

  beforeEach(async () => {
    state.setAmVersion(legacyAmVersion);
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('getNodeTypes()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getNodeTypes).toBeDefined();
    });

    test('1: Get all node types', async () => {
      const response = await NodeApi.getNodeTypes({ state });
      expect(summarizeNodeTypes(response.result)).toMatchSnapshot();
    });
  });

  describe('requireVersion()', () => {
    test('returns false below 8.1.0 and true at or above 8.1.0', async () => {
      expect(NodeApi.requireVersion(createVersionedState('7.5.0'))).toBe(false);
      expect(NodeApi.requireVersion(createVersionedState('8.1.0'))).toBe(true);
      expect(NodeApi.requireVersion(createVersionedState('8.1.1'))).toBe(true);
    });

    test('returns false when AM version is unset', async () => {
      expect(NodeApi.requireVersion(createStateWithoutAmVersion())).toBe(false);
    });
  });

  describe('version-aware node api', () => {
    test('returns expected path segment across versions and inputs', async () => {
      const testCases = [
        {
          name: 'unset nodeTypeVersion defaults to 1.0 at 8.1.0',
          state: createVersionedState('8.1.0'),
          expected: '/1.0',
        },
        {
          name: 'explicit nodeTypeVersion is included at 8.1.0',
          state: createVersionedState('8.1.0'),
          nodeTypeVersion: '2.0',
          expected: '/2.0',
        },
        {
          name: 'explicit nodeTypeVersion is included above 8.1.0',
          state: createVersionedState('8.2.3'),
          nodeTypeVersion: '3.1',
          expected: '/3.1',
        },
        {
          name: 'nodeTypeVersion is ignored below 8.1.0',
          state: createVersionedState('8.0.9'),
          nodeTypeVersion: '2.0',
          expected: '',
        },
        {
          name: 'nodeTypeVersion is ignored when AM version is unset',
          state: createStateWithoutAmVersion(),
          nodeTypeVersion: '2.0',
          expected: '',
        },
      ];

      for (const testCase of testCases) {
        const actual = NodeApi.getNodeVersionPathSegment({
          nodeTypeVersion: testCase.nodeTypeVersion,
          state: testCase.state,
        });
        expect(actual).toBe(testCase.expected);
      }
    });

    test('ignores nodeTypeVersion below AM 8.1.0', async () => {
      const oldState = createVersionedState('7.5.0');

      expect(
        NodeApi.getNodeVersionPathSegment({
          nodeTypeVersion: '2.0',
          state: oldState,
        })
      ).toBe('');
    });

    test('includes nodeTypeVersion at AM 8.1.0 and above', async () => {
      const newState = createVersionedState('8.1.0');

      expect(
        NodeApi.getNodeVersionPathSegment({
          nodeTypeVersion: '2.0',
          state: newState,
        })
      ).toBe('/2.0');
      expect(
        NodeApi.getNodeVersionPathSegment({
          nodeTypeVersion: '2.0',
          state: createVersionedState('8.1.1'),
        })
      ).toBe('/2.0');
    });

    test(`reads versioned node type [${versionedNodeType} v${versionedNodeTypeVersion}]`, async () => {
      const response = await withAmVersion('8.1.0', async () =>
        NodeApi.getNodeType({
          nodeType: versionedNodeType,
          nodeTypeVersion: versionedNodeTypeVersion,
          state,
        })
      );
      expect(response).toMatchSnapshot();
    });

    test(`reads versioned node schema [${versionedNodeType} v${versionedNodeTypeVersion}]`, async () => {
      const response = await withAmVersion('8.1.0', async () =>
        NodeApi.getNodeSchema({
          nodeType: versionedNodeType,
          nodeTypeVersion: versionedNodeTypeVersion,
          state,
        })
      );
      expect(response).toMatchSnapshot();
    });

    test(`reads versioned nodes by type [${versionedNodeType} v${versionedNodeTypeVersion}]`, async () => {
      const response = await withAmVersion('8.1.0', async () =>
        NodeApi.getNodesByType({
          nodeType: versionedNodeType,
          nodeTypeVersion: versionedNodeTypeVersion,
          state,
        })
      );
      expect(response).toMatchSnapshot();
    });

    test(`reads versioned container nodes by type [${versionedContainerNodeType} v${versionedNodeTypeVersion}]`, async () => {
      const response = await withAmVersion('8.1.0', async () =>
        NodeApi.getNodesByType({
          nodeType: versionedContainerNodeType,
          nodeTypeVersion: versionedNodeTypeVersion,
          state,
        })
      );
      expect(response).toMatchSnapshot();
    });

    test(`reads existing versioned node [${versionedNodeType} v${versionedNodeTypeVersion}]`, async () => {
      const versionedNodeId =
        await getExistingVersionedNodeId(versionedNodeType);
      const response = await withAmVersion('8.1.0', async () =>
        NodeApi.getNode({
          nodeId: versionedNodeId,
          nodeType: versionedNodeType,
          nodeTypeVersion: versionedNodeTypeVersion,
          state,
        })
      );
      expect(response).toMatchSnapshot();
    });

    test(`reads existing versioned container node [${versionedContainerNodeType} v${versionedNodeTypeVersion}]`, async () => {
      const versionedContainerNodeId = await getExistingVersionedNodeId(
        versionedContainerNodeType
      );
      const response = await withAmVersion('8.1.0', async () =>
        NodeApi.getNode({
          nodeId: versionedContainerNodeId,
          nodeType: versionedContainerNodeType,
          nodeTypeVersion: versionedNodeTypeVersion,
          state,
        })
      );
      expect(response).toMatchSnapshot();
    });
  });

  describe('getNodes()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getNodes).toBeDefined();
    });

    test('1: Get all nodes', async () => {
      const response = await NodeApi.getNodes({ state });
      expect(summarizeNodes(response.result)).toMatchSnapshot();
    });
  });

  describe('getNodesByType()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getNodesByType).toBeDefined();
    });

    test('1: Get all ValidatedUsernameNode nodes', async () => {
      const response = await NodeApi.getNodesByType({
        nodeType: TestData.node1._type!._id as string,
        state,
      });
      expect(
        summarizeNodes(response.result, [TestData.node1._id as string])
      ).toMatchSnapshot();
    });
  });

  describe('getNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getNode).toBeDefined();
    });

    test(`1: Get existing node [${TestData.node1?._id} - ${TestData.node1?._type?._id}]`, async () => {
      const response = await NodeApi.getNode({
        nodeId: TestData.node1?._id as string,
        nodeType: TestData.node1?._type?._id as string,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing node [00000000-0000-0000-0000-000000000000 - PageNode]', async () => {
      expect.assertions(1);
      try {
        await NodeApi.getNode({
          nodeId: '00000000-0000-0000-0000-000000000000',
          nodeType: 'PageNode',
          state,
        });
      } catch (error) {
        expect((error as any).response.data).toMatchSnapshot();
      }
    });
  });

  describe('createNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.createNode).toBeDefined();
    });

    test(`1: Create new node [${TestData.node5?._id} - ${TestData.node5?._type?._id}]`, async () => {
      const response = await NodeApi.putNode({
        nodeId: TestData.node5?._id as string,
        nodeType: TestData.node5?._type?._id as string,
        nodeData: TestData.node5,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('putNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.putNode).toBeDefined();
    });

    test(`1: Create new node [${TestData.node2?._id} - ${TestData.node2?._type?._id}]`, async () => {
      const response = await NodeApi.putNode({
        nodeId: TestData.node2?._id as string,
        nodeType: TestData.node2?._type?._id as string,
        nodeData: TestData.node2,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Update existing node [${TestData.node3?._id} - ${TestData.node3?._type?._id}]`, async () => {
      const node = await NodeApi.putNode({
        nodeId: TestData.node3?._id as string,
        nodeType: TestData.node3?._type?._id as string,
        nodeData: TestData.node3,
        state,
      });
      expect(node).toMatchSnapshot();
    });
  });

  describe('deleteNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.deleteNode).toBeDefined();
    });

    test(`1: Delete existing node [${TestData.node4?._id} - ${TestData.node4?._type?._id}]`, async () => {
      const node = await NodeApi.deleteNode({
        nodeId: TestData.node4?._id as string,
        nodeType: TestData.node4?._type?._id as string,
        state,
      });
      expect(node).toMatchSnapshot();
    });

    test('2: Delete non-existing node [00000000-0000-0000-0000-000000000000 - PageNode]', async () => {
      expect.assertions(1);
      try {
        await NodeApi.deleteNode({
          nodeId: '00000000-0000-0000-0000-000000000000',
          nodeType: 'PageNode',
          state,
        });
      } catch (error) {
        expect((error as any).response.data).toMatchSnapshot();
      }
    });
  });

  describe('createCustomNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.createCustomNode).toBeDefined();
    });

    test('1: Create custom node', async () => {
      const response = await NodeApi.createCustomNode({
        nodeData: TestData.customNode3,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getCustomNodes()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getCustomNodes).toBeDefined();
    });

    test('1: Get all custom nodes', async () => {
      const response = await NodeApi.getCustomNodes({ state });
      expect(summarizeCustomNodes(response.result)).toMatchSnapshot();
    });
  });

  describe('getCustomNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getCustomNode).toBeDefined();
    });

    test(`1: Get existing custom node [${TestData.customNode1?._id}]`, async () => {
      const response = await NodeApi.getCustomNode({
        nodeId: TestData.customNode1?._id as string,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing custom node [11111111111111111111111111111111-1]', async () => {
      expect.assertions(1);
      try {
        await NodeApi.getCustomNode({
          nodeId: '11111111111111111111111111111111-1',
          state,
        });
      } catch (error) {
        expect((error as any).response.data).toMatchSnapshot();
      }
    });
  });

  describe('putCustomNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.putCustomNode).toBeDefined();
    });

    test(`1: Update existing custom node [${TestData.customNode2?._id}]`, async () => {
      const response = await NodeApi.putCustomNode({
        nodeId: TestData.customNode2?._id as string,
        nodeData: TestData.customNode2,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('deleteCustomNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.deleteCustomNode).toBeDefined();
    });

    test(`1: Delete existing custom node [${TestData.customNode4?._id}]`, async () => {
      const node = await NodeApi.deleteCustomNode({
        nodeId: TestData.customNode4?._id as string,
        state,
      });
      expect(node).toMatchSnapshot();
    });

    test('2: Delete non-existing custom node [11111111111111111111111111111111-1]', async () => {
      expect.assertions(1);
      try {
        await NodeApi.deleteCustomNode({
          nodeId: '11111111111111111111111111111111-1',
          state,
        });
      } catch (error) {
        expect((error as any).response.data).toMatchSnapshot();
      }
    });
  });

  describe('getCustomNodeUsage()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getCustomNodeUsage).toBeDefined();
    });

    test(`1: Get custom node usage [${TestData.customNode1?._id}]`, async () => {
      const response = await NodeApi.getCustomNodeUsage({
        nodeId: TestData.customNode1?._id as string,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
