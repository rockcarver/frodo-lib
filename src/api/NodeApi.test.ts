/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=volker-dev npm run test:record NodeApi
 *
 *    The above command assumes that you have a connection profile for
 *    'volker-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update NodeApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test NodeApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { jest } from '@jest/globals';
import { NodeRaw } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

// Increase timeout for this test as pipeline keeps failing with error:
// Timeout - Async callback was not invoked within the 5000 ms timeout specified by jest.setTimeout.
jest.setTimeout(30000);

autoSetupPolly();

describe('NodeApi', () => {
  const node1 = {
    id: '67693475-3a58-4e38-bcc6-037b3fe46a58',
    type: 'ValidatedUsernameNode',
    node: {
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
    id: '23bab9d4-1663-450f-8a4b-680f44f54fd6',
    type: 'CreateObjectNode',
    node: {
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
        await NodeRaw.getNode(node1.id, node1.type);
        await NodeRaw.deleteNode(node1.id, node1.type);
      } catch (error) {
        // ignore
      } finally {
        await NodeRaw.putNode(node1.id, node1.type, node1.node);
      }
      // setup node2 - delete if exists
      try {
        await NodeRaw.getNode(node2.id, node2.type);
        await NodeRaw.deleteNode(node2.id, node2.type);
      } catch (error) {
        // ignore
      } finally {
        await NodeRaw.putNode(node2.id, node2.type, node2.node);
      }
      // setup node3 - delete if exists, then create
      try {
        await NodeRaw.getNode(node3.id, node3.type);
        await NodeRaw.deleteNode(node3.id, node3.type);
      } catch (error) {
        // ignore
      } finally {
        await NodeRaw.putNode(node3.id, node3.type, node3.node);
      }
      // setup node4 - delete if exists, then create
      try {
        await NodeRaw.getNode(node4.id, node4.type);
        await NodeRaw.deleteNode(node4.id, node4.type);
      } catch (error) {
        // ignore
      } finally {
        await NodeRaw.putNode(node4.id, node4.type, node4.node);
      }
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      try {
        await NodeRaw.getNode(node1.id, node1.type);
        await NodeRaw.deleteNode(node1.id, node1.type);
      } catch (error) {
        // ignore
      }
      try {
        await NodeRaw.getNode(node2.id, node2.type);
        await NodeRaw.deleteNode(node2.id, node2.type);
      } catch (error) {
        // ignore
      }
      try {
        await NodeRaw.getNode(node3.id, node3.type);
        await NodeRaw.deleteNode(node3.id, node3.type);
      } catch (error) {
        // ignore
      }
      try {
        await NodeRaw.getNode(node4.id, node4.type);
        await NodeRaw.deleteNode(node4.id, node4.type);
      } catch (error) {
        // ignore
      }
    }
  });

  describe('getNodeTypes()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeRaw.getNodeTypes).toBeDefined();
    });

    test('1: Get all node types', async () => {
      const response = await NodeRaw.getNodeTypes();
      expect(response).toMatchSnapshot();
    });
  });

  describe('getNodes()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeRaw.getNodes).toBeDefined();
    });

    test('1: Get all nodes', async () => {
      const response = await NodeRaw.getNodes();
      expect(response).toMatchSnapshot();
    });
  });

  describe('getNodesByType()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeRaw.getNodesByType).toBeDefined();
    });

    test('1: Get all page nodes', async () => {
      const response = await NodeRaw.getNodesByType('PageNode');
      expect(response).toMatchSnapshot();
    });
  });

  describe('getNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeRaw.getNode).toBeDefined();
    });

    test(`1: Get existing node [${node1.id} - ${node1.type}]`, async () => {
      const response = await NodeRaw.getNode(node1.id, node1.type);
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing node [00000000-0000-0000-0000-000000000000 - PageNode]', async () => {
      expect.assertions(1);
      try {
        await NodeRaw.getNode(
          '00000000-0000-0000-0000-000000000000',
          'PageNode'
        );
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('putNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeRaw.putNode).toBeDefined();
    });

    test(`1: Create new node [${node2.id} - ${node2.type}]`, async () => {
      const response = await NodeRaw.putNode(node2.id, node2.type, node2.node);
      expect(response).toMatchSnapshot();
    });

    test(`2: Update existing node [${node3.id} - ${node3.type}]`, async () => {
      const node = await NodeRaw.putNode(node3.id, node3.type, node3.node);
      expect(node).toMatchSnapshot();
    });
  });

  describe('deleteNode()', () => {
    test('0: Method is implemented', async () => {
      expect(NodeRaw.deleteNode).toBeDefined();
    });

    test(`1: Delete existing node [${node4.id} - ${node4.type}]`, async () => {
      const node = await NodeRaw.deleteNode(node4.id, node4.type);
      expect(node).toMatchSnapshot();
    });

    test('2: Delete non-existing node [00000000-0000-0000-0000-000000000000 - PageNode]', async () => {
      expect.assertions(1);
      try {
        await NodeRaw.deleteNode(
          '00000000-0000-0000-0000-000000000000',
          'PageNode'
        );
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });
});
