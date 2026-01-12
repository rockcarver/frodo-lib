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
import { state } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { filterRecording } from '../utils/PollyUtils';

import * as TestData from '../test/setup/NodeSetup';

const ctx = autoSetupPolly();

describe('NodeApi', () => {

  TestData.setup();
  
  beforeEach(async () => {
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
      expect(response).toMatchSnapshot();
    });
  });

  describe('getNodes()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getNodes).toBeDefined();
    });

    test('1: Get all nodes', async () => {
      const response = await NodeApi.getNodes({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getNodesByType()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getNodesByType).toBeDefined();
    });

    test('1: Get all page nodes', async () => {
      const response = await NodeApi.getNodesByType({
        nodeType: 'PageNode',
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getNode).toBeDefined();
    });

    test(`1: Get existing node [${TestData.node1._id} - ${TestData.node1._type._id}]`, async () => {
      const response = await NodeApi.getNode({
        nodeId: TestData.node1._id,
        nodeType: TestData.node1._type._id,
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
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe ('createNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.createNode).toBeDefined();
    });

    test(`1: Create new node [${TestData.node5._id} - ${TestData.node5._type._id}]`, async () => {
      const response = await NodeApi.putNode({
        nodeId: TestData.node5._id,
        nodeType: TestData.node5._type._id,
        nodeData: TestData.node5,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  })

  describe('putNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.putNode).toBeDefined();
    });

    test(`1: Create new node [${TestData.node2._id} - ${TestData.node2._type._id}]`, async () => {
      const response = await NodeApi.putNode({
        nodeId: TestData.node2._id,
        nodeType: TestData.node2._type._id,
        nodeData: TestData.node2,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Update existing node [${TestData.node3._id} - ${TestData.node3._type._id}]`, async () => {
      const node = await NodeApi.putNode({
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
      expect(NodeApi.deleteNode).toBeDefined();
    });

    test(`1: Delete existing node [${TestData.node4._id} - ${TestData.node4._type._id}]`, async () => {
      const node = await NodeApi.deleteNode({
        nodeId: TestData.node4._id,
        nodeType: TestData.node4._type._id,
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
        expect(error.response.data).toMatchSnapshot();
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
      expect(response).toMatchSnapshot();
    });
  });

  describe('getCustomNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getCustomNode).toBeDefined();
    });

    test(`1: Get existing custom node [${TestData.customNode1._id}]`, async () => {
      const response = await NodeApi.getCustomNode({
        nodeId: TestData.customNode1._id,
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
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('putCustomNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.putCustomNode).toBeDefined();
    });

    test(`1: Update existing custom node [${TestData.customNode2._id}]`, async () => {
      const response = await NodeApi.putCustomNode({
        nodeId: TestData.customNode2._id,
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

    test(`1: Delete existing custom node [${TestData.customNode4._id}]`, async () => {
      const node = await NodeApi.deleteCustomNode({
        nodeId: TestData.customNode4._id,
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
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('getCustomNodeUsage()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.getCustomNodeUsage).toBeDefined();
    });

    test(`1: Get custom node usage [${TestData.customNode1._id}]`, async () => {
      const response = await NodeApi.getCustomNodeUsage({
        nodeId: TestData.customNode1._id,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
