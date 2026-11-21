import { jest } from '@jest/globals';

/**
 * `findJourneyReferences` reads every source that can name a journey once, and
 * joins the answers in memory. Mocked unit test: the api layer is replaced, so
 * the real readers (null on "not available", 404 as none) and the real policy
 * walker run. No recordings.
 */

const getTrees = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getTree = jest.fn(async (_args?: any): Promise<any> => ({}));
const putTree = jest.fn(async (_args?: any): Promise<any> => ({}));
const deleteTree = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualTreeApi = await import('../api/TreeApi');
jest.unstable_mockModule('../api/TreeApi', () => ({
  ...actualTreeApi,
  deleteTree,
  getTree,
  getTrees,
  putTree,
}));

const readNodesMock = jest.fn(async (_args?: any): Promise<any[]> => []);
const actualNodeOps = await import('./NodeOps');
jest.unstable_mockModule('./NodeOps', () => ({
  ...actualNodeOps,
  readNodes: readNodesMock,
}));

const getAuthenticationSettings = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const actualAuthenticationSettingsApi =
  await import('../api/AuthenticationSettingsApi');
jest.unstable_mockModule('../api/AuthenticationSettingsApi', () => ({
  ...actualAuthenticationSettingsApi,
  getAuthenticationSettings,
}));

const getService = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualServiceApi = await import('../api/ServiceApi');
jest.unstable_mockModule('../api/ServiceApi', () => ({
  ...actualServiceApi,
  getService,
}));

const getOAuth2Provider = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualOAuth2ProviderApi = await import('../api/OAuth2ProviderApi');
jest.unstable_mockModule('../api/OAuth2ProviderApi', () => ({
  ...actualOAuth2ProviderApi,
  getOAuth2Provider,
}));

const getConfigEntity = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualIdmConfigApi = await import('../api/IdmConfigApi');
jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  ...actualIdmConfigApi,
  getConfigEntity,
}));

const getPolicies = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const actualPoliciesApi = await import('../api/PoliciesApi');
jest.unstable_mockModule('../api/PoliciesApi', () => ({
  ...actualPoliciesApi,
  getPolicies,
}));

const printMessage = jest.fn();
const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  printMessage,
}));

const {
  findJourneyReferences,
  joinJourneyReferences,
  journeyReferenceNodeRows,
} = await import('./JourneyOps');
const { FrodoError } = await import('./FrodoError');

const TARGET = 'Target';

function mockState(deploymentType = 'cloud') {
  return {
    getRealm: () => 'alpha',
    getDeploymentType: () => deploymentType,
  } as any;
}

function tree(id: string, nodes: Record<string, any> = {}) {
  return { _id: id, entryNodeId: 'start', nodes };
}

function nodeRef(nodeType: string, displayName = nodeType) {
  return { nodeType, displayName, connections: {}, x: 0, y: 0 };
}

/** A node configuration as the bulk node read returns it. */
function node(id: string, nodeType: string, properties: Record<string, any>) {
  return { _id: id, _type: { _id: nodeType }, ...properties };
}

function innerTreeNode(id: string, treeId: string) {
  return node(id, 'InnerTreeEvaluatorNode', { tree: treeId });
}

/** The error of a request that the server answered with a status. */
function httpError(status: number, message = 'failed') {
  return Object.assign(new Error(message), {
    response: { status, data: { message } },
  });
}

const NOT_AVAILABLE_IN_CLOUD =
  'This operation is not available in PingOne Advanced Identity Cloud.';

/** A policy with one condition. */
function policy(id: string, condition?: any) {
  return { _id: id, name: id, applicationName: 'policySet', condition };
}

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string[] {
  return [
    error?.message,
    ...(error?.originalErrors ?? []).flatMap(messagesOf),
  ].filter(Boolean);
}

/** Put the realm in the state that every source answers "nothing names it". */
function resetReads() {
  getTrees.mockReset().mockResolvedValue({ result: [] });
  readNodesMock.mockReset().mockResolvedValue([]);
  getAuthenticationSettings.mockReset().mockResolvedValue({
    core: { orgConfig: 'Login', adminAuthModule: 'Login' },
  });
  getService.mockReset().mockResolvedValue({
    treeMapping: {
      forgottenUsername: 'ForgottenUsername',
      registration: 'Registration',
      resetPassword: 'ResetPassword',
      updatePassword: 'UpdatePassword',
    },
  });
  getOAuth2Provider.mockReset().mockResolvedValue({
    advancedOAuth2Config: { passwordGrantAuthService: 'Login' },
  });
  getConfigEntity.mockReset().mockResolvedValue({
    realm: { alpha: [{ _id: 'theme-1', name: 'Starter', linkedTrees: [] }] },
  });
  getPolicies.mockReset().mockResolvedValue({ result: [] });
  getTree.mockReset();
  putTree.mockReset();
  deleteTree.mockReset();
  printMessage.mockReset();
}

async function find(journeyId = TARGET, state = mockState()) {
  return findJourneyReferences({ journeyId, state });
}

describe('findJourneyReferences', () => {
  beforeEach(resetReads);

  describe('other journeys (node rows)', () => {
    test('finds nothing when no journey calls the journey', async () => {
      getTrees.mockResolvedValue({
        result: [tree('Login', { n1: nodeRef('InnerTreeEvaluatorNode') })],
      });
      readNodesMock.mockResolvedValue([innerTreeNode('n1', 'Other')]);

      expect(await find()).toEqual([]);
    });

    test('finds the node of a parent journey that evaluates the journey', async () => {
      getTrees.mockResolvedValue({
        result: [
          tree('Login', {
            n1: nodeRef('InnerTreeEvaluatorNode', 'Run target'),
          }),
        ],
      });
      readNodesMock.mockResolvedValue([innerTreeNode('n1', TARGET)]);

      expect(await find()).toEqual([
        {
          source: 'journey',
          journeyId: 'Login',
          nodeId: 'n1',
          nodeType: 'InnerTreeEvaluatorNode',
          nodeDisplayName: 'Run target',
        },
      ]);
    });

    test('finds two parents, ordered by journey id then node id', async () => {
      // the map order and the node ids go against the order of the answer
      getTrees.mockResolvedValue({
        result: [
          tree('Registration', { a1: nodeRef('InnerTreeEvaluatorNode') }),
          tree('Login', {
            z2: nodeRef('InnerTreeEvaluatorNode'),
            z1: nodeRef('InnerTreeEvaluatorNode'),
          }),
        ],
      });
      readNodesMock.mockResolvedValue([
        innerTreeNode('z1', TARGET),
        innerTreeNode('z2', TARGET),
        innerTreeNode('a1', TARGET),
      ]);

      const result = await find();

      expect(result.map((r: any) => `${r.journeyId}/${r.nodeId}`)).toEqual([
        'Login/z1',
        'Login/z2',
        'Registration/a1',
      ]);
    });

    test('finds a Back Channel Initialize node that names the journey', async () => {
      getTrees.mockResolvedValue({
        result: [tree('Login', { n1: nodeRef('BackChannelInitNode') })],
      });
      readNodesMock.mockResolvedValue([
        node('n1', 'BackChannelInitNode', { tree: TARGET }),
      ]);

      expect(await find()).toEqual([
        expect.objectContaining({
          source: 'journey',
          journeyId: 'Login',
          nodeId: 'n1',
          nodeType: 'BackChannelInitNode',
        }),
      ]);
    });

    test('ignores a property that is not a string', async () => {
      getTrees.mockResolvedValue({
        result: [tree('Login', { n1: nodeRef('InnerTreeEvaluatorNode') })],
      });
      readNodesMock.mockResolvedValue([
        node('n1', 'InnerTreeEvaluatorNode', { tree: [TARGET] }),
      ]);

      expect(await find()).toEqual([]);
    });

    test('ignores a node that no journey references (an orphan)', async () => {
      getTrees.mockResolvedValue({ result: [tree('Login')] });
      readNodesMock.mockResolvedValue([innerTreeNode('orphan', TARGET)]);

      expect(await find()).toEqual([]);
    });

    test('ignores a node type that is not in the rows, even with a `tree` property', async () => {
      getTrees.mockResolvedValue({
        result: [tree('Login', { n1: nodeRef('ScriptedDecisionNode') })],
      });
      readNodesMock.mockResolvedValue([
        node('n1', 'ScriptedDecisionNode', { tree: TARGET }),
      ]);

      expect(await find()).toEqual([]);
    });

    test('skips a node of a journey whose configuration was not read', async () => {
      getTrees.mockResolvedValue({
        result: [
          tree('Login', {
            missing: nodeRef('InnerTreeEvaluatorNode'),
            n2: nodeRef('InnerTreeEvaluatorNode'),
          }),
        ],
      });
      readNodesMock.mockResolvedValue([innerTreeNode('n2', TARGET)]);

      const result = await find();

      expect(result.map((r: any) => r.nodeId)).toEqual(['n2']);
    });

    test('matches the journey id exactly', async () => {
      getTrees.mockResolvedValue({
        result: [
          tree('A', { n1: nodeRef('InnerTreeEvaluatorNode') }),
          tree('B', { n2: nodeRef('InnerTreeEvaluatorNode') }),
          tree('C', { n3: nodeRef('InnerTreeEvaluatorNode') }),
        ],
      });
      readNodesMock.mockResolvedValue([
        innerTreeNode('n1', 'Login2'),
        innerTreeNode('n2', 'login'),
        innerTreeNode('n3', 'Login'),
      ]);

      const result = await find('Login');

      expect(result.map((r: any) => r.journeyId)).toEqual(['C']);
    });

    test('does not report a journey that names itself', async () => {
      getTrees.mockResolvedValue({
        result: [
          tree(TARGET, { n1: nodeRef('InnerTreeEvaluatorNode') }),
          tree('Login', { n2: nodeRef('InnerTreeEvaluatorNode') }),
        ],
      });
      readNodesMock.mockResolvedValue([
        innerTreeNode('n1', TARGET),
        innerTreeNode('n2', TARGET),
      ]);

      const result = await find();

      expect(result.map((r: any) => r.journeyId)).toEqual(['Login']);
    });

    test('ends on a cycle: each journey of the cycle references the other once', async () => {
      getTrees.mockResolvedValue({
        result: [
          tree('A', { n1: nodeRef('InnerTreeEvaluatorNode') }),
          tree('B', { n2: nodeRef('InnerTreeEvaluatorNode') }),
        ],
      });
      readNodesMock.mockResolvedValue([
        innerTreeNode('n1', 'B'),
        innerTreeNode('n2', 'A'),
      ]);

      expect((await find('A')).map((r: any) => r.journeyId)).toEqual(['B']);
      expect((await find('B')).map((r: any) => r.journeyId)).toEqual(['A']);
    });

    test('answers for a journey that is not in the realm, without reading it', async () => {
      getTrees.mockResolvedValue({
        result: [tree('Login', { n1: nodeRef('InnerTreeEvaluatorNode') })],
      });
      readNodesMock.mockResolvedValue([innerTreeNode('n1', 'Deleted')]);

      const result = await find('Deleted');

      expect(result).toEqual([
        expect.objectContaining({ source: 'journey', journeyId: 'Login' }),
      ]);
      expect(getTrees).toHaveBeenCalledTimes(1);
      expect(getTree).not.toHaveBeenCalled();
    });

    test('reports the top-level node and the inner node for a node inside a Page Node', async () => {
      getTrees.mockResolvedValue({
        result: [tree('Login', { page: nodeRef('PageNode', 'Page') })],
      });
      readNodesMock.mockResolvedValue([
        node('page', 'PageNode', {
          nodes: [
            {
              _id: 'inner-1',
              displayName: 'Username',
              nodeType: 'UsernameCollectorNode',
            },
            {
              _id: 'inner-2',
              displayName: 'Evaluate',
              nodeType: 'InnerTreeEvaluatorNode',
            },
          ],
        }),
        node('inner-1', 'UsernameCollectorNode', {}),
        innerTreeNode('inner-2', TARGET),
      ]);

      expect(await find()).toEqual([
        {
          source: 'journey',
          journeyId: 'Login',
          nodeId: 'page',
          nodeType: 'PageNode',
          nodeDisplayName: 'Page',
          innerNodeId: 'inner-2',
        },
      ]);
    });

    test('ignores a node inside a Page Node that no journey reaches', async () => {
      getTrees.mockResolvedValue({ result: [tree('Login')] });
      readNodesMock.mockResolvedValue([
        node('page', 'PageNode', {
          nodes: [
            {
              _id: 'inner-2',
              displayName: 'Evaluate',
              nodeType: 'InnerTreeEvaluatorNode',
            },
          ],
        }),
        innerTreeNode('inner-2', TARGET),
      ]);

      expect(await find()).toEqual([]);
    });

    test('orders the nodes inside a Page Node by id', async () => {
      getTrees.mockResolvedValue({
        result: [tree('Login', { page: nodeRef('PageNode') })],
      });
      readNodesMock.mockResolvedValue([
        node('page', 'PageNode', {
          nodes: [
            {
              _id: 'inner-b',
              displayName: 'B',
              nodeType: 'InnerTreeEvaluatorNode',
            },
            {
              _id: 'inner-a',
              displayName: 'A',
              nodeType: 'InnerTreeEvaluatorNode',
            },
          ],
        }),
        innerTreeNode('inner-b', TARGET),
        innerTreeNode('inner-a', TARGET),
      ]);

      const result = await find();

      expect(result.map((r: any) => r.innerNodeId)).toEqual([
        'inner-a',
        'inner-b',
      ]);
    });

    describe.each(journeyReferenceNodeRows.map((row) => [row.nodeType, row]))(
      'row %s',
      (_nodeType, row) => {
        // the value of the property for a given journey name, in the shape of the row
        const valueFor = (name: string) =>
          row.shape === 'list' ? [name, 'Other'] : name;
        const nodeWith = (id: string, name: string) => {
          const config: any = node(id, row.nodeType, {});
          let holder = config;
          const path = row.property.split('.');
          for (const key of path.slice(0, -1)) {
            holder[key] = {};
            holder = holder[key];
          }
          holder[path[path.length - 1]] = valueFor(name);
          return config;
        };

        test('names the journey from its property in a top-level node', async () => {
          getTrees.mockResolvedValue({
            result: [tree('Login', { n1: nodeRef(row.nodeType) })],
          });
          readNodesMock.mockResolvedValue([nodeWith('n1', TARGET)]);

          expect(await find()).toEqual([
            expect.objectContaining({
              source: 'journey',
              journeyId: 'Login',
              nodeId: 'n1',
              nodeType: row.nodeType,
            }),
          ]);
        });

        test('names the journey from its property in a node inside a Page Node', async () => {
          getTrees.mockResolvedValue({
            result: [tree('Login', { page: nodeRef('PageNode') })],
          });
          readNodesMock.mockResolvedValue([
            node('page', 'PageNode', {
              nodes: [
                { _id: 'inner', displayName: 'Inner', nodeType: row.nodeType },
              ],
            }),
            nodeWith('inner', TARGET),
          ]);

          expect(await find()).toEqual([
            expect.objectContaining({
              journeyId: 'Login',
              nodeId: 'page',
              innerNodeId: 'inner',
            }),
          ]);
        });

        test('does not name another journey', async () => {
          getTrees.mockResolvedValue({
            result: [tree('Login', { n1: nodeRef(row.nodeType) })],
          });
          readNodesMock.mockResolvedValue([nodeWith('n1', 'Elsewhere')]);

          expect(await find()).toEqual([]);
        });
      }
    );

    describe('a row added to the table', () => {
      const added: any[] = [];
      afterEach(() => {
        for (const row of added.splice(0)) {
          const rows = journeyReferenceNodeRows as any[];
          rows.splice(rows.indexOf(row), 1);
        }
      });
      function addRow(row: any) {
        (journeyReferenceNodeRows as any[]).push(row);
        added.push(row);
      }

      test('a list property names every journey in it', async () => {
        addRow({ nodeType: 'FutureNode', property: 'journeys', shape: 'list' });
        getTrees.mockResolvedValue({
          result: [tree('Login', { n1: nodeRef('FutureNode') })],
        });
        readNodesMock.mockResolvedValue([
          node('n1', 'FutureNode', { journeys: ['Other', TARGET, 7] }),
        ]);

        expect(await find()).toEqual([
          expect.objectContaining({ journeyId: 'Login', nodeId: 'n1' }),
        ]);
        expect(await find('Other')).toHaveLength(1);
        expect(await find('Absent')).toEqual([]);
      });

      test('a dotted path is followed into the node configuration', async () => {
        addRow({
          nodeType: 'FutureNode',
          property: 'config.target',
          shape: 'single',
        });
        getTrees.mockResolvedValue({
          result: [tree('Login', { n1: nodeRef('FutureNode') })],
        });
        readNodesMock.mockResolvedValue([
          node('n1', 'FutureNode', { config: { target: TARGET } }),
        ]);

        expect(await find()).toHaveLength(1);
      });

      test('a path that is not there names nothing', async () => {
        addRow({
          nodeType: 'FutureNode',
          property: 'config.target',
          shape: 'single',
        });
        getTrees.mockResolvedValue({
          result: [tree('Login', { n1: nodeRef('FutureNode') })],
        });
        readNodesMock.mockResolvedValue([
          node('n1', 'FutureNode', { config: null }),
        ]);

        expect(await find()).toEqual([]);
      });
    });
  });

  describe('authentication settings', () => {
    test.each([
      ['core.orgConfig', { orgConfig: TARGET, adminAuthModule: 'Login' }],
      ['core.adminAuthModule', { orgConfig: 'Login', adminAuthModule: TARGET }],
    ])('reports %s', async (from, core) => {
      getAuthenticationSettings.mockResolvedValue({ core });

      expect(await find()).toEqual([
        { source: 'authentication-settings', from },
      ]);
    });

    test('reports both fields when both name the journey', async () => {
      getAuthenticationSettings.mockResolvedValue({
        core: { orgConfig: TARGET, adminAuthModule: TARGET },
      });

      expect(await find()).toEqual([
        { source: 'authentication-settings', from: 'core.orgConfig' },
        { source: 'authentication-settings', from: 'core.adminAuthModule' },
      ]);
    });

    test('is none when the settings are not available in the Cloud', async () => {
      getAuthenticationSettings.mockRejectedValue(
        httpError(403, NOT_AVAILABLE_IN_CLOUD)
      );

      expect(await find()).toEqual([]);
    });

    test('is none when the settings have no `core` section', async () => {
      getAuthenticationSettings.mockResolvedValue({ general: {} });

      expect(await find()).toEqual([]);
    });
  });

  describe('self-service journeys', () => {
    test.each([
      'forgottenUsername',
      'registration',
      'resetPassword',
      'updatePassword',
    ])('reports treeMapping.%s', async (flow) => {
      getService.mockResolvedValue({ treeMapping: { [flow]: TARGET } });

      expect(await find()).toEqual([
        { source: 'self-service-trees', from: `treeMapping.${flow}` },
      ]);
    });

    test('reads the selfServiceTrees service of the realm', async () => {
      await find();

      expect(getService).toHaveBeenCalledTimes(1);
      expect(getService).toHaveBeenCalledWith(
        expect.objectContaining({ serviceId: 'selfServiceTrees' })
      );
    });

    test('is none when the realm has no such service (404)', async () => {
      getService.mockRejectedValue(httpError(404, 'Not Found'));

      expect(await find()).toEqual([]);
    });
  });

  describe('OAuth2 provider', () => {
    test('reports the password grant journey', async () => {
      getOAuth2Provider.mockResolvedValue({
        advancedOAuth2Config: { passwordGrantAuthService: TARGET },
      });

      expect(await find()).toEqual([
        {
          source: 'oauth2-provider',
          from: 'advancedOAuth2Config.passwordGrantAuthService',
        },
      ]);
    });

    test('does not report the empty placeholder', async () => {
      getOAuth2Provider.mockResolvedValue({
        advancedOAuth2Config: { passwordGrantAuthService: '[Empty]' },
      });

      expect(await find()).toEqual([]);
    });

    test('is none when the realm has no provider (404)', async () => {
      getOAuth2Provider.mockRejectedValue(httpError(404, 'Not Found'));

      expect(await find()).toEqual([]);
    });
  });

  describe('themes', () => {
    test('reports a theme that links the journey', async () => {
      getConfigEntity.mockResolvedValue({
        realm: {
          alpha: [
            { _id: 'theme-2', name: 'Dark', linkedTrees: ['Login', TARGET] },
            { _id: 'theme-1', name: 'Starter', linkedTrees: ['Login'] },
            { _id: 'theme-0', name: 'Light', linkedTrees: [TARGET] },
          ],
          bravo: [
            { _id: 'theme-9', name: 'Other realm', linkedTrees: [TARGET] },
          ],
        },
      });

      expect(await find()).toEqual([
        { source: 'theme', id: 'theme-0', name: 'Light', from: 'linkedTrees' },
        { source: 'theme', id: 'theme-2', name: 'Dark', from: 'linkedTrees' },
      ]);
    });

    test('ignores a theme without linked journeys', async () => {
      getConfigEntity.mockResolvedValue({
        realm: { alpha: [{ _id: 'theme-1', name: 'Starter' }] },
      });

      expect(await find()).toEqual([]);
    });

    test('is not read on Classic, which has no themes', async () => {
      expect(await find(TARGET, mockState('classic'))).toEqual([]);

      expect(getConfigEntity).not.toHaveBeenCalled();
      expect(getPolicies).toHaveBeenCalledTimes(1);
    });

    test('is read on ForgeOps', async () => {
      await find(TARGET, mockState('forgeops'));

      expect(getConfigEntity).toHaveBeenCalledTimes(1);
    });
  });

  describe('policies', () => {
    test('reports a condition that authenticates to the journey, at any depth', async () => {
      getPolicies.mockResolvedValue({
        result: [
          policy('P1', {
            type: 'AND',
            conditions: [
              { type: 'Script', scriptId: 'script-1' },
              {
                type: 'OR',
                conditions: [
                  { type: 'Session', maxSessionTime: 5 },
                  {
                    type: 'NOT',
                    condition: {
                      type: 'AuthenticateToService',
                      authenticateToService: TARGET,
                    },
                  },
                ],
              },
            ],
          }),
        ],
      });

      expect(await find()).toEqual([
        {
          source: 'policy',
          id: 'P1',
          name: 'P1',
          from: 'condition.authenticateToService',
        },
      ]);
    });

    test('reports a condition that is the policy condition itself', async () => {
      getPolicies.mockResolvedValue({
        result: [
          policy('P1', {
            type: 'AuthenticateToService',
            authenticateToService: TARGET,
          }),
        ],
      });

      expect(await find()).toHaveLength(1);
    });

    test('ignores a condition that authenticates to another journey', async () => {
      getPolicies.mockResolvedValue({
        result: [
          policy('P1', {
            type: 'AND',
            conditions: [
              {
                type: 'AuthenticateToService',
                authenticateToService: 'Elsewhere',
              },
            ],
          }),
        ],
      });

      expect(await find()).toEqual([]);
    });

    test('ignores a leaf of another type, and a policy without a condition', async () => {
      getPolicies.mockResolvedValue({
        result: [
          policy('P1'),
          policy('P2', { type: 'Script', authenticateToService: TARGET }),
        ],
      });

      expect(await find()).toEqual([]);
    });

    test('gives one reference for a policy that names the journey twice', async () => {
      getPolicies.mockResolvedValue({
        result: [
          policy('P1', {
            type: 'OR',
            conditions: [
              { type: 'AuthenticateToService', authenticateToService: TARGET },
              { type: 'AuthenticateToService', authenticateToService: TARGET },
            ],
          }),
        ],
      });

      expect(await find()).toHaveLength(1);
    });
  });

  describe('policy order', () => {
    test('orders the policies by id', async () => {
      const names = {
        type: 'AuthenticateToService',
        authenticateToService: TARGET,
      };
      getPolicies.mockResolvedValue({
        result: [policy('P2', names), policy('P1', names)],
      });

      expect((await find()).map((r: any) => r.id)).toEqual(['P1', 'P2']);
    });
  });

  describe('the whole call', () => {
    function populateEverySource() {
      getTrees.mockResolvedValue({
        result: [tree('Login', { n1: nodeRef('InnerTreeEvaluatorNode') })],
      });
      readNodesMock.mockResolvedValue([innerTreeNode('n1', TARGET)]);
      getAuthenticationSettings.mockResolvedValue({
        core: { orgConfig: TARGET, adminAuthModule: 'Login' },
      });
      getService.mockResolvedValue({ treeMapping: { registration: TARGET } });
      getOAuth2Provider.mockResolvedValue({
        advancedOAuth2Config: { passwordGrantAuthService: TARGET },
      });
      getConfigEntity.mockResolvedValue({
        realm: { alpha: [{ _id: 't', name: 'T', linkedTrees: [TARGET] }] },
      });
      getPolicies.mockResolvedValue({
        result: [
          policy('P', {
            type: 'AuthenticateToService',
            authenticateToService: TARGET,
          }),
        ],
      });
    }

    test('reads every source once and orders the answer: journeys, settings, self-service, provider, themes, policies', async () => {
      populateEverySource();

      const result = await find();

      expect(result.map((r: any) => r.source)).toEqual([
        'journey',
        'authentication-settings',
        'self-service-trees',
        'oauth2-provider',
        'theme',
        'policy',
      ]);
      for (const reader of [
        getTrees,
        readNodesMock,
        getAuthenticationSettings,
        getService,
        getOAuth2Provider,
        getConfigEntity,
        getPolicies,
      ]) {
        expect(reader).toHaveBeenCalledTimes(1);
      }
    });

    test('joins one set of reads for any number of journeys', async () => {
      const reads = {
        journey: {
          journeys: [
            tree('P1', { n1: nodeRef('InnerTreeEvaluatorNode') }),
            tree('P2', { n2: nodeRef('InnerTreeEvaluatorNode') }),
          ],
          nodes: [innerTreeNode('n1', 'A'), innerTreeNode('n2', 'B')],
        },
        'authentication-settings': { core: { orgConfig: 'C' } },
        'self-service-trees': null,
        'oauth2-provider': null,
        theme: [{ _id: 't', name: 'T', linkedTrees: ['A'] }],
        policy: [],
      };

      expect(
        joinJourneyReferences(reads, 'A').map((r: any) => r.source)
      ).toEqual(['journey', 'theme']);
      expect(
        joinJourneyReferences(reads, 'B').map((r: any) => r.source)
      ).toEqual(['journey']);
      expect(
        joinJourneyReferences(reads, 'C').map((r: any) => r.source)
      ).toEqual(['authentication-settings']);
      expect(joinJourneyReferences(reads, 'D')).toEqual([]);
    });

    test('a source that was not read yields nothing', () => {
      expect(joinJourneyReferences({}, TARGET)).toEqual([]);
    });

    test('fails closed: one unreadable source is one error that names it, and no array', async () => {
      populateEverySource();
      getService.mockRejectedValue(httpError(403, 'Forbidden'));

      const error: any = await find().catch((e) => e);

      expect(error).toBeInstanceOf(FrodoError);
      expect(Array.isArray(error)).toBe(false);
      expect(error.originalErrors).toHaveLength(1);
      expect(error.originalErrors[0]).toBeInstanceOf(FrodoError);
      expect(error.originalErrors[0].message).toMatch(/self-service/);
      // every other source was still read
      for (const reader of [
        getTrees,
        readNodesMock,
        getAuthenticationSettings,
        getOAuth2Provider,
        getConfigEntity,
        getPolicies,
      ]) {
        expect(reader).toHaveBeenCalledTimes(1);
      }
    });

    test('fails closed for a source that fails, even when the others name the journey', async () => {
      populateEverySource();
      getPolicies.mockRejectedValue(httpError(500, 'Internal error'));

      await expect(find()).rejects.toThrow(/policies/);
    });

    test('nests one error per failed source', async () => {
      getTrees.mockRejectedValue(httpError(500, 'boom'));
      getConfigEntity.mockRejectedValue(httpError(403, 'denied'));

      const error: any = await find().catch((e) => e);

      expect(error.originalErrors).toHaveLength(2);
      const messages = messagesOf(error).join(' | ');
      expect(messages).toMatch(/journeys and their nodes/);
      expect(messages).toMatch(/themes/);
    });

    test('a failed read of the nodes fails the call too', async () => {
      readNodesMock.mockRejectedValue(httpError(500, 'boom'));

      await expect(find()).rejects.toBeInstanceOf(FrodoError);
    });

    test('a source that is not there is none, not a failure', async () => {
      getAuthenticationSettings.mockRejectedValue(
        httpError(403, NOT_AVAILABLE_IN_CLOUD)
      );
      getService.mockRejectedValue(httpError(404, 'Not Found'));
      getOAuth2Provider.mockRejectedValue(httpError(404, 'Not Found'));

      expect(await find()).toEqual([]);
    });

    test.each(['', '   ', undefined])(
      'refuses a blank journey id (%p) and reads nothing',
      async (journeyId) => {
        await expect(
          findJourneyReferences({
            journeyId: journeyId as any,
            state: mockState(),
          })
        ).rejects.toBeInstanceOf(FrodoError);

        expect(getTrees).not.toHaveBeenCalled();
        expect(getPolicies).not.toHaveBeenCalled();
      }
    );

    test('writes nothing and prints nothing', async () => {
      populateEverySource();

      await find();

      expect(putTree).not.toHaveBeenCalled();
      expect(deleteTree).not.toHaveBeenCalled();
      expect(printMessage).not.toHaveBeenCalled();
    });
  });
});
