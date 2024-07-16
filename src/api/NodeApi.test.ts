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

const ctx = autoSetupPolly();

describe('NodeApi', () => {
  const node1 = {
    type: 'ValidatedUsernameNode',
    node: {
      _id: '67693475-3a58-4e38-bcc6-037b3fe46a58',
      usernameAttribute: 'userName',
      validateInput: false,
      _type: {
        _id: 'ValidatedUsernameNode',
        name: 'Platform Username',
        collection: true,
      },
      _outcomes: [
        {
          id: 'outcome',
          displayName: 'Outcome',
        },
      ],
    },
  };
  const node2 = {
    id: '18ffdd4b-41b7-41b3-8248-f4fdfd68423f',
    type: 'ValidatedPasswordNode',
    node: {
      validateInput: false,
      passwordAttribute: 'password',
      _type: {
        _id: 'ValidatedPasswordNode',
        name: 'Platform Password',
        collection: true,
      },
      _outcomes: [
        {
          id: 'outcome',
          displayName: 'Outcome',
        },
      ],
    },
  };
  const node3 = {
    id: 'b726262c-641e-4fa5-b276-98e129b44cd9',
    type: 'PatchObjectNode',
    node: {
      identityResource: 'managed/user',
      patchAsObject: false,
      ignoredFields: [],
      identityAttribute: 'userName',
      _type: {
        _id: 'PatchObjectNode',
        name: 'Patch Object',
        collection: true,
      },
      _outcomes: [
        {
          id: 'PATCHED',
          displayName: 'Patched',
        },
        {
          id: 'FAILURE',
          displayName: 'Failed',
        },
      ],
    },
  };
  const node4 = {
    type: 'CreateObjectNode',
    node: {
      _id: '23bab9d4-1663-450f-8a4b-680f44f54fd6',
      identityResource: 'managed/user',
      _type: {
        _id: 'CreateObjectNode',
        name: 'Create Object',
        collection: true,
      },
      _outcomes: [
        {
          id: 'CREATED',
          displayName: 'Created',
        },
        {
          id: 'FAILURE',
          displayName: 'Failed',
        },
      ],
    },
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup node1 - delete if exists, then create
      try {
        await NodeApi.getNode({
          nodeId: node1.node._id,
          nodeType: node1.type,
          state,
        });
        await NodeApi.deleteNode({
          nodeId: node1.node._id,
          nodeType: node1.type,
          state,
        });
      } catch (error) {
        // ignore
      } finally {
        await NodeApi.putNode({
          nodeId: node1.node._id,
          nodeType: node1.type,
          nodeData: node1.node,
          state,
        });
      }
      // setup node2 - delete if exists
      try {
        await NodeApi.getNode({
          nodeId: node2.id,
          nodeType: node2.type,
          state,
        });
        await NodeApi.deleteNode({
          nodeId: node2.id,
          nodeType: node2.type,
          state,
        });
      } catch (error) {
        // ignore
      } finally {
        await NodeApi.putNode({
          nodeId: node2.id,
          nodeType: node2.type,
          nodeData: node2.node,
          state,
        });
      }
      // setup node3 - delete if exists, then create
      try {
        await NodeApi.getNode({
          nodeId: node3.id,
          nodeType: node3.type,
          state,
        });
        await NodeApi.deleteNode({
          nodeId: node3.id,
          nodeType: node3.type,
          state,
        });
      } catch (error) {
        // ignore
      } finally {
        await NodeApi.putNode({
          nodeId: node3.id,
          nodeType: node3.type,
          nodeData: node3.node,
          state,
        });
      }
      // setup node4 - delete if exists, then create
      try {
        await NodeApi.getNode({
          nodeId: node4.node._id,
          nodeType: node4.type,
          state,
        });
        await NodeApi.deleteNode({
          nodeId: node4.node._id,
          nodeType: node4.type,
          state,
        });
      } catch (error) {
        // ignore
      } finally {
        await NodeApi.putNode({
          nodeId: node4.node._id,
          nodeType: node4.type,
          nodeData: node4.node,
          state,
        });
      }
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      try {
        await NodeApi.getNode({
          nodeId: node1.node._id,
          nodeType: node1.type,
          state,
        });
        await NodeApi.deleteNode({
          nodeId: node1.node._id,
          nodeType: node1.type,
          state,
        });
      } catch (error) {
        // ignore
      }
      try {
        await NodeApi.getNode({
          nodeId: node2.id,
          nodeType: node2.type,
          state,
        });
        await NodeApi.deleteNode({
          nodeId: node2.id,
          nodeType: node2.type,
          state,
        });
      } catch (error) {
        // ignore
      }
      try {
        await NodeApi.getNode({
          nodeId: node3.id,
          nodeType: node3.type,
          state,
        });
        await NodeApi.deleteNode({
          nodeId: node3.id,
          nodeType: node3.type,
          state,
        });
      } catch (error) {
        // ignore
      }
      try {
        await NodeApi.getNode({
          nodeId: node4.node._id,
          nodeType: node4.type,
          state,
        });
        await NodeApi.deleteNode({
          nodeId: node4.node._id,
          nodeType: node4.type,
          state,
        });
      } catch (error) {
        // ignore
      }
    }
  });
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

    test(`1: Get existing node [${node1.node._id} - ${node1.type}]`, async () => {
      const response = await NodeApi.getNode({
        nodeId: node1.node._id,
        nodeType: node1.type,
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

  describe('putNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.putNode).toBeDefined();
    });

    test(`1: Create new node [${node2.id} - ${node2.type}]`, async () => {
      const response = await NodeApi.putNode({
        nodeId: node2.id,
        nodeType: node2.type,
        nodeData: node2.node,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Update existing node [${node3.id} - ${node3.type}]`, async () => {
      const node = await NodeApi.putNode({
        nodeId: node3.id,
        nodeType: node3.type,
        nodeData: node3.node,
        state,
      });
      expect(node).toMatchSnapshot();
    });
  });

  describe('deleteNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeApi.deleteNode).toBeDefined();
    });

    test(`1: Delete existing node [${node4.node._id} - ${node4.type}]`, async () => {
      const node = await NodeApi.deleteNode({
        nodeId: node4.node._id,
        nodeType: node4.type,
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
});
