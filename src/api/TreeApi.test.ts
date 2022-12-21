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
import { TreeRaw } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

autoSetupPolly();

describe('TreeApi', () => {
  describe('getTrees()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeRaw.getTrees).toBeDefined();
    });

    test('1: Get all trees', async () => {
      const response = await TreeRaw.getTrees();
      expect(response).toMatchSnapshot();
    });
  });

  describe('getTree()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeRaw.getTree).toBeDefined();
    });

    test('1: Get existing tree', async () => {
      const response = await TreeRaw.getTree('FrodoTest');
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing tree', async () => {
      try {
        await TreeRaw.getTree('DoesNotExist');
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('putTree()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeRaw.putTree).toBeDefined();
    });

    test('1: Put valid tree', async () => {
      const treeData = JSON.parse(
        JSON.stringify({
          identityResource: 'managed/alpha_user',
          uiConfig: {
            categories: '[]',
          },
          entryNodeId: 'e2c39477-847a-4df2-9c5d-b449a752638b',
          nodes: {
            '278bf084-9eea-46fe-8ce9-2600dde3b046': {
              connections: {
                localAuthentication: 'fc7e47cd-c679-4211-8e05-a36654f23c67',
                socialAuthentication: 'd5cc2d52-6ce4-452d-85ea-3a5b50218b67',
              },
              displayName: 'Login Page',
              nodeType: 'PageNode',
              x: 444,
              y: 273.015625,
            },
            '64157fca-bd5b-4405-a4c8-64ffd98a5461': {
              connections: {
                ACCOUNT_EXISTS: '70e691a5-1e33-4ac3-a356-e7b6d60d92e0',
                NO_ACCOUNT: 'e301438c-0bd0-429c-ab0c-66126501069a',
              },
              displayName: 'SAML2 Authentication',
              nodeType: 'product-Saml2Node',
              x: 1168,
              y: 188.015625,
            },
            '731c5810-020b-45c8-a7fc-3c21903ae2b3': {
              connections: {
                localAuthentication: 'fc7e47cd-c679-4211-8e05-a36654f23c67',
                socialAuthentication: 'd5cc2d52-6ce4-452d-85ea-3a5b50218b67',
              },
              displayName: 'Login Page',
              nodeType: 'PageNode',
              x: 443,
              y: 26.015625,
            },
            'bf153f37-83dd-4f39-aa0c-74135430242e': {
              connections: {
                EMAIL_NOT_SENT: 'e301438c-0bd0-429c-ab0c-66126501069a',
                EMAIL_SENT: '64157fca-bd5b-4405-a4c8-64ffd98a5461',
              },
              displayName: 'Email Template Node',
              nodeType: 'EmailTemplateNode',
              x: 910,
              y: 224.015625,
            },
            'd5cc2d52-6ce4-452d-85ea-3a5b50218b67': {
              connections: {
                ACCOUNT_EXISTS: '70e691a5-1e33-4ac3-a356-e7b6d60d92e0',
                NO_ACCOUNT: 'bf153f37-83dd-4f39-aa0c-74135430242e',
              },
              displayName: 'Social Login',
              nodeType: 'SocialProviderHandlerNode',
              x: 702,
              y: 116.015625,
            },
            'e2c39477-847a-4df2-9c5d-b449a752638b': {
              connections: {
                known: '731c5810-020b-45c8-a7fc-3c21903ae2b3',
                unknown: '278bf084-9eea-46fe-8ce9-2600dde3b046',
              },
              displayName: 'Check Username',
              nodeType: 'ScriptedDecisionNode',
              x: 200,
              y: 235.015625,
            },
            'fc7e47cd-c679-4211-8e05-a36654f23c67': {
              connections: {
                CANCELLED: '70e691a5-1e33-4ac3-a356-e7b6d60d92e0',
                EXPIRED: '70e691a5-1e33-4ac3-a356-e7b6d60d92e0',
                FALSE: 'e301438c-0bd0-429c-ab0c-66126501069a',
                LOCKED: 'e301438c-0bd0-429c-ab0c-66126501069a',
                TRUE: '70e691a5-1e33-4ac3-a356-e7b6d60d92e0',
              },
              displayName: 'Validate Creds',
              nodeType: 'IdentityStoreDecisionNode',
              x: 702,
              y: 292.015625,
            },
          },
          staticNodes: {
            '70e691a5-1e33-4ac3-a356-e7b6d60d92e0': {
              x: 1434,
              y: 60,
            },
            'e301438c-0bd0-429c-ab0c-66126501069a': {
              x: 1433,
              y: 459,
            },
            startNode: {
              x: 63,
              y: 252,
            },
          },
          enabled: true,
        })
      );
      const response = await TreeRaw.putTree('FrodoTest', treeData);
      expect(response).toMatchSnapshot();
    });

    test('2: Put invalid tree [trailing data]', async () => {
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
        await TreeRaw.putTree('Invalid', treeData);
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });

    test('3: Put invalid tree [invalid attribute]', async () => {
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
        await TreeRaw.putTree('Invalid', treeData);
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });

    test('4: Put invalid tree [no entry node]', async () => {
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
        await TreeRaw.putTree('Invalid', treeData);
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });

    test('5: Put invalid tree [invalid nodes]', async () => {
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
        await TreeRaw.putTree('Invalid', treeData);
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('deleteTree()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeRaw.deleteTree).toBeDefined();
    });

    test('1: Delete existing tree', async () => {
      const response = await TreeRaw.deleteTree('FrodoTest');
      expect(response).toMatchSnapshot();
    });

    test('2: Delete non-existing tree', async () => {
      try {
        await TreeRaw.deleteTree('DoesNotExist');
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });
});
