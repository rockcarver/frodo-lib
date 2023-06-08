/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=volker-dev npm run test:record TreeApi
 *
 *    The above command assumes that you have a connection profile for
 *    'volker-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update TreeApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test TreeApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as TreeApi from './TreeApi';
import { state } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

autoSetupPolly();

describe('TreeApi', () => {
  const tree1 = {
    name: 'FrodoTestTree1',
    tree: {
      identityResource: 'managed/alpha_user',
      uiConfig: {
        categories: '["Authentication","Frodo"]',
      },
      entryNodeId: 'e301438c-0bd0-429c-ab0c-66126501069a',
      nodes: {},
      staticNodes: {
        startNode: {
          x: 70,
          y: 80,
        },
        '70e691a5-1e33-4ac3-a356-e7b6d60d92e0': {
          x: 70,
          y: 230,
        },
        'e301438c-0bd0-429c-ab0c-66126501069a': {
          x: 210,
          y: 80,
        },
      },
      description: 'Frodo Test Tree One',
      enabled: true,
    },
  };
  const tree2 = {
    name: 'FrodoTestTree2',
    tree: {
      identityResource: 'managed/alpha_user',
      uiConfig: {
        categories: '["Authentication","Frodo"]',
      },
      entryNodeId: 'f19e5458-6c2e-43e6-9273-84d66f4a8f46',
      nodes: {},
      staticNodes: {
        startNode: {
          x: 70,
          y: 80,
        },
        'c904b319-0bb0-454e-b408-08ade91469cf': {
          x: 70,
          y: 230,
        },
        '97704adc-c3a0-469a-9f6a-c07325890232': {
          x: 210,
          y: 80,
        },
      },
      description: 'Frodo Test Tree Two',
      enabled: true,
    },
  };
  const tree3 = {
    name: 'FrodoTestTree3',
    tree: {
      identityResource: 'managed/alpha_user',
      uiConfig: {
        categories: '["Authentication","Frodo"]',
      },
      entryNodeId: 'b320a71e-ddac-4180-a106-e6690ac775ca',
      nodes: {},
      staticNodes: {
        startNode: {
          x: 70,
          y: 80,
        },
        '1edf4a79-6103-48ee-af91-75af47f85870': {
          x: 70,
          y: 230,
        },
        '4bb0250d-40fe-4ab8-9ea4-77e901615736': {
          x: 210,
          y: 80,
        },
      },
      description: 'Frodo Test Tree Three',
      enabled: true,
    },
  };
  const tree4 = {
    name: 'FrodoTestTree4',
    tree: {
      identityResource: 'managed/alpha_user',
      uiConfig: {
        categories: '["Authentication","Frodo"]',
      },
      entryNodeId: 'f3bea587-d5ad-476b-80bb-b288ab45bc52',
      nodes: {},
      staticNodes: {
        startNode: {
          x: 70,
          y: 80,
        },
        'e6b2ead4-7cb2-4f6f-b9ef-f2086a3814dd': {
          x: 70,
          y: 230,
        },
        'be2da6e2-ca86-4c4a-9252-5df7ea0551be': {
          x: 210,
          y: 80,
        },
      },
      description: 'Frodo Test Tree Four',
      enabled: true,
    },
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup tree1 - delete if exists, then create
      try {
        await TreeApi.getTree({ id: tree1.name, state });
        await TreeApi.deleteTree({ treeId: tree1.name, state });
      } catch (error) {
        // ignore
      } finally {
        await TreeApi.putTree({
          treeId: tree1.name,
          treeData: tree1.tree,
          state,
        });
      }
      // setup tree2 - delete if exists, then create
      try {
        await TreeApi.getTree({ id: tree2.name, state });
        await TreeApi.deleteTree({ treeId: tree2.name, state });
      } catch (error) {
        // ignore
      } finally {
        await TreeApi.putTree({
          treeId: tree2.name,
          treeData: tree2.tree,
          state,
        });
      }
      // setup tree3 - delete if exists, then create
      try {
        await TreeApi.getTree({ id: tree3.name, state });
        await TreeApi.deleteTree({ treeId: tree3.name, state });
      } catch (error) {
        // ignore
      } finally {
        await TreeApi.putTree({
          treeId: tree3.name,
          treeData: tree3.tree,
          state,
        });
      }
      // setup tree4 - delete if exists
      try {
        await TreeApi.getTree({ id: tree4.name, state });
        await TreeApi.deleteTree({ treeId: tree4.name, state });
      } catch (error) {
        // ignore
      }
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      try {
        await TreeApi.getTree({ id: tree1.name, state });
        await TreeApi.deleteTree({ treeId: tree1.name, state });
      } catch (error) {
        // ignore
      }
      try {
        await TreeApi.getTree({ id: tree2.name, state });
        await TreeApi.deleteTree({ treeId: tree2.name, state });
      } catch (error) {
        // ignore
      }
      try {
        await TreeApi.getTree({ id: tree3.name, state });
        await TreeApi.deleteTree({ treeId: tree3.name, state });
      } catch (error) {
        // ignore
      }
      try {
        await TreeApi.getTree({ id: tree4.name, state });
        await TreeApi.deleteTree({ treeId: tree4.name, state });
      } catch (error) {
        // ignore
      }
    }
  });

  describe('getTrees()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeApi.getTrees).toBeDefined();
    });

    test('1: Get all trees', async () => {
      const response = await TreeApi.getTrees({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getTree()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeApi.getTree).toBeDefined();
    });

    test(`1: Get existing tree ${tree1.name}`, async () => {
      const response = await TreeApi.getTree({ id: tree1.name, state });
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing tree DoesNotExist', async () => {
      expect.assertions(1);
      try {
        await TreeApi.getTree({ id: 'DoesNotExist', state });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('putTree()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeApi.putTree).toBeDefined();
    });

    test(`1: Put valid tree ${tree4.name}`, async () => {
      const response = await TreeApi.putTree({
        treeId: tree4.name,
        treeData: tree4.tree,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Put invalid tree [trailing data]', async () => {
      expect.assertions(1);
      const treeData =
        JSON.stringify({
          entryNodeId: 'e301438c-0bd0-429c-ab0c-66126501069a',
          nodes: {},
          staticNodes: {},
          description: 'invalid tree def',
          identityResource: 'managed/alpha_user',
          uiConfig: {
            categories: '[]',
          },
        }) + '\ntrailing data';
      try {
        await TreeApi.putTree({ treeId: 'Invalid', treeData, state });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });

    test('3: Put invalid tree [invalid attribute]', async () => {
      expect.assertions(1);
      const treeData = JSON.parse(
        JSON.stringify({
          entryNodeId: 'e301438c-0bd0-429c-ab0c-66126501069a',
          nodes2: {},
          staticNodes: {},
          description: 'invalid tree def',
          identityResource: 'managed/alpha_user',
          uiConfig: {
            categories: '[]',
          },
        })
      );
      try {
        await TreeApi.putTree({ treeId: 'Invalid', treeData, state });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });

    test('4: Put invalid tree [no entry node]', async () => {
      expect.assertions(1);
      const treeData = JSON.parse(
        JSON.stringify({
          nodes: {},
          staticNodes: {},
          description: 'invalid tree def',
          identityResource: 'managed/alpha_user',
          uiConfig: {
            categories: '[]',
          },
        })
      );
      try {
        await TreeApi.putTree({ treeId: 'Invalid', treeData, state });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });

    test('5: Put invalid tree [invalid nodes]', async () => {
      expect.assertions(1);
      const treeData = JSON.parse(
        JSON.stringify({
          entryNodeId: 'e301438c-0bd0-429c-ab0c-66126501069a',
          nodes: {
            invalid: 'bad data',
          },
          staticNodes: {},
          description: 'invalid tree def',
          identityResource: 'managed/alpha_user',
          uiConfig: {
            categories: '[]',
          },
        })
      );
      try {
        await TreeApi.putTree({ treeId: 'Invalid', treeData, state });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('deleteTree()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeApi.deleteTree).toBeDefined();
    });

    test(`1: Delete existing tree ${tree2.name}`, async () => {
      const response = await TreeApi.deleteTree({ treeId: tree2.name, state });
      expect(response).toMatchSnapshot();
    });

    test('2: Delete non-existing tree DoesNotExist', async () => {
      expect.assertions(1);
      try {
        await TreeApi.deleteTree({ treeId: 'DoesNotExist', state });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });
});
