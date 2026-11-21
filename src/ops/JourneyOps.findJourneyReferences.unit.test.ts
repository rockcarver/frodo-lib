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
const readNodeMock = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualNodeOps = await import('./NodeOps');
jest.unstable_mockModule('./NodeOps', () => ({
  ...actualNodeOps,
  readNode: readNodeMock,
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

const getOAuth2Clients = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const actualOAuth2ClientApi = await import('../api/OAuth2ClientApi');
jest.unstable_mockModule('../api/OAuth2ClientApi', () => ({
  ...actualOAuth2ClientApi,
  getOAuth2Clients,
}));

const getProviderStubs = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getProvider = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualSaml2Api = await import('../api/Saml2Api');
jest.unstable_mockModule('../api/Saml2Api', () => ({
  ...actualSaml2Api,
  getProvider,
  getProviderStubs,
}));

const getAgentsByType = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const getAgentGroups = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const actualAgentApi = await import('../api/AgentApi');
jest.unstable_mockModule('../api/AgentApi', () => ({
  ...actualAgentApi,
  getAgentGroups,
  getAgentsByType,
}));

const isAgentTypeOffered = jest.fn(
  async (_args?: any): Promise<boolean> => true
);
const actualAgentTypeHelpers = await import('./internal/AgentTypeHelpers');
jest.unstable_mockModule('./internal/AgentTypeHelpers', () => ({
  ...actualAgentTypeHelpers,
  isAgentTypeOffered,
}));

const getCIMDProfiles = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const actualCIMDProfileApi = await import('../api/OAuth2CIMDProfileApi');
jest.unstable_mockModule('../api/OAuth2CIMDProfileApi', () => ({
  ...actualCIMDProfileApi,
  getCIMDProfiles,
}));

const printMessage = jest.fn();
const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  printMessage,
}));

const {
  JOURNEY_REFERENCE_SOURCES,
  findJourneyReferences,
  joinJourneyReferences,
  journeyReferenceNodeRows,
  journeyReferencePolicyConditionRows,
} = await import('./JourneyOps');
const { FrodoError } = await import('./FrodoError');

const TARGET = 'Target';

/**
 * The dependency of every row, stated here on purpose and not read from the
 * code: flipping a row in the code means changing its line here, and a new row
 * fails its guard test until it has a line. `hard`: the holder breaks at run
 * time without the journey, `soft`: it works without it.
 */
const EXPECTED_NODE_ROW_DEPENDENCY: Record<string, 'hard' | 'soft'> = {
  InnerTreeEvaluatorNode: 'hard',
  BackChannelInitNode: 'hard',
};
const EXPECTED_POLICY_ROW_DEPENDENCY: Record<string, 'hard' | 'soft'> = {
  AuthenticateToService: 'hard',
  Transaction: 'hard',
};
const EXPECTED_SOURCE_DEPENDENCY: Record<string, 'hard' | 'soft'> = {
  journey: 'hard',
  'authentication-settings': 'hard',
  'self-service-trees': 'hard',
  'oauth2-provider': 'hard',
  'oauth2-client': 'hard',
  'saml2-provider': 'hard',
  'ai-agent': 'hard',
  'agent-group': 'hard',
  'cimd-profile': 'hard',
  theme: 'soft',
  policy: 'hard',
};

function mockState(deploymentType = 'cloud') {
  return {
    getRealm: () => 'alpha',
    getDeploymentType: () => deploymentType,
    getDebugHandler: () => undefined,
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
  getPolicies.mockReset().mockResolvedValue({
    result: [],
    pagedResultsCookie: null,
    remainingPagedResults: 0,
  });
  // a node that the bulk read lacks cannot be read, unless a test says so
  readNodeMock.mockReset().mockRejectedValue(httpError(404, 'Not Found'));
  getOAuth2Clients.mockReset().mockResolvedValue({ result: [] });
  getProviderStubs.mockReset().mockResolvedValue({ result: [] });
  getProvider.mockReset().mockResolvedValue({});
  getAgentsByType.mockReset().mockResolvedValue({ result: [] });
  getAgentGroups.mockReset().mockResolvedValue({ result: [] });
  isAgentTypeOffered.mockReset().mockResolvedValue(true);
  getCIMDProfiles.mockReset().mockResolvedValue({ result: [] });
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
          dependency: 'hard',
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
          dependency: 'hard',
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

    describe('a node that the bulk node read lacks', () => {
      test('is read by its id and counts', async () => {
        getTrees.mockResolvedValue({
          result: [tree('Login', { n1: nodeRef('InnerTreeEvaluatorNode') })],
        });
        readNodesMock.mockResolvedValue([]);
        readNodeMock.mockResolvedValue(innerTreeNode('n1', TARGET));

        const result = await find();

        expect(result).toEqual([
          expect.objectContaining({ journeyId: 'Login', nodeId: 'n1' }),
        ]);
        expect(readNodeMock).toHaveBeenCalledTimes(1);
        expect(readNodeMock).toHaveBeenCalledWith(
          expect.objectContaining({
            nodeId: 'n1',
            nodeType: 'InnerTreeEvaluatorNode',
            nodeTypeVersion: '1.0',
          })
        );
      });

      test('is not read again when the bulk read has it', async () => {
        getTrees.mockResolvedValue({
          result: [tree('Login', { n1: nodeRef('InnerTreeEvaluatorNode') })],
        });
        readNodesMock.mockResolvedValue([innerTreeNode('n1', TARGET)]);

        await find();

        expect(readNodeMock).not.toHaveBeenCalled();
      });

      test('is not read when its type does not name a journey', async () => {
        getTrees.mockResolvedValue({
          result: [
            tree('Login', {
              page: nodeRef('PageNode'),
              script: nodeRef('ScriptedDecisionNode'),
            }),
          ],
        });
        readNodesMock.mockResolvedValue([]);

        expect(await find()).toEqual([]);
        expect(readNodeMock).not.toHaveBeenCalled();
      });

      test('fails the call, naming the node, when it cannot be read (never skipped)', async () => {
        getTrees.mockResolvedValue({
          result: [
            tree('Login', {
              missing: nodeRef('InnerTreeEvaluatorNode'),
              n2: nodeRef('InnerTreeEvaluatorNode'),
            }),
          ],
        });
        readNodesMock.mockResolvedValue([innerTreeNode('n2', TARGET)]);
        readNodeMock.mockRejectedValue(httpError(404, 'Not Found'));

        const error: any = await find().catch((e) => e);

        expect(error).toBeInstanceOf(FrodoError);
        const messages = messagesOf(error).join(' | ');
        expect(messages).toMatch(/node missing of journey Login/);
        expect(messages).toMatch(/journeys and their nodes/);
      });

      test('fails the call for a node of the Back Channel Initialize type too', async () => {
        getTrees.mockResolvedValue({
          result: [tree('Login', { b1: nodeRef('BackChannelInitNode') })],
        });
        readNodeMock.mockRejectedValue(httpError(500, 'boom'));

        const error: any = await find().catch((e) => e);

        expect(error).toBeInstanceOf(FrodoError);
        expect(messagesOf(error).join(' | ')).toMatch(
          /BackChannelInitNode node b1/
        );
      });

      test('is read once when two journeys list it', async () => {
        getTrees.mockResolvedValue({
          result: [
            tree('A', { n1: nodeRef('InnerTreeEvaluatorNode') }),
            tree('B', { n1: nodeRef('InnerTreeEvaluatorNode') }),
          ],
        });
        readNodeMock.mockResolvedValue(innerTreeNode('n1', 'Other'));

        await find();

        expect(readNodeMock).toHaveBeenCalledTimes(1);
      });
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
          dependency: 'hard',
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
              dependency: 'hard',
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

        test(`carries the dependency ${EXPECTED_NODE_ROW_DEPENDENCY[row.nodeType]} of its row`, async () => {
          expect(EXPECTED_NODE_ROW_DEPENDENCY[row.nodeType]).toBeDefined();
          getTrees.mockResolvedValue({
            result: [tree('Login', { n1: nodeRef(row.nodeType) })],
          });
          readNodesMock.mockResolvedValue([nodeWith('n1', TARGET)]);

          expect(await find()).toEqual([
            expect.objectContaining({
              dependency: EXPECTED_NODE_ROW_DEPENDENCY[row.nodeType],
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
        addRow({
          nodeType: 'FutureNode',
          property: 'journeys',
          shape: 'list',
          dependency: 'hard',
        });
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
          dependency: 'hard',
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
          dependency: 'hard',
        });
        getTrees.mockResolvedValue({
          result: [tree('Login', { n1: nodeRef('FutureNode') })],
        });
        readNodesMock.mockResolvedValue([
          node('n1', 'FutureNode', { config: null }),
        ]);

        expect(await find()).toEqual([]);
      });

      test('a soft row gives a soft reference', async () => {
        addRow({
          nodeType: 'FutureNode',
          property: 'journey',
          shape: 'single',
          dependency: 'soft',
        });
        getTrees.mockResolvedValue({
          result: [tree('Login', { n1: nodeRef('FutureNode') })],
        });
        readNodesMock.mockResolvedValue([
          node('n1', 'FutureNode', { journey: TARGET }),
        ]);

        expect(await find()).toEqual([
          expect.objectContaining({ dependency: 'soft' }),
        ]);
      });

      test('hard wins when a soft and a hard row name the same property', async () => {
        for (const dependency of ['soft', 'hard', 'soft']) {
          addRow({
            nodeType: 'FutureNode',
            property: 'journey',
            shape: 'single',
            dependency,
          });
        }
        getTrees.mockResolvedValue({
          result: [tree('Login', { n1: nodeRef('FutureNode') })],
        });
        readNodesMock.mockResolvedValue([
          node('n1', 'FutureNode', { journey: TARGET }),
        ]);

        expect(await find()).toEqual([
          expect.objectContaining({ dependency: 'hard' }),
        ]);
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
        { source: 'authentication-settings', dependency: 'hard', from },
      ]);
    });

    test('reports both fields when both name the journey', async () => {
      getAuthenticationSettings.mockResolvedValue({
        core: { orgConfig: TARGET, adminAuthModule: TARGET },
      });

      expect(await find()).toEqual([
        {
          source: 'authentication-settings',
          dependency: 'hard',
          from: 'core.orgConfig',
        },
        {
          source: 'authentication-settings',
          dependency: 'hard',
          from: 'core.adminAuthModule',
        },
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
        {
          source: 'self-service-trees',
          dependency: 'hard',
          from: `treeMapping.${flow}`,
        },
      ]);
    });

    test('reports a key that was added by hand', async () => {
      getService.mockResolvedValue({
        treeMapping: { registration: 'Registration', connectSocial: TARGET },
      });

      expect(await find()).toEqual([
        {
          source: 'self-service-trees',
          dependency: 'hard',
          from: 'treeMapping.connectSocial',
        },
      ]);
    });

    test('reports every key that maps to the journey', async () => {
      getService.mockResolvedValue({
        treeMapping: { registration: TARGET, resetPassword: TARGET },
      });

      expect((await find()).map((reference: any) => reference.from)).toEqual([
        'treeMapping.registration',
        'treeMapping.resetPassword',
      ]);
    });

    test('ignores empty and non-string values of the mapping', async () => {
      getService.mockResolvedValue({
        treeMapping: { a: '[Empty]', b: '', c: 7, d: null, e: [TARGET] },
      });

      expect(await find()).toEqual([]);
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
          dependency: 'hard',
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
        {
          source: 'theme',
          dependency: 'soft',
          id: 'theme-0',
          name: 'Light',
          from: 'linkedTrees',
        },
        {
          source: 'theme',
          dependency: 'soft',
          id: 'theme-2',
          name: 'Dark',
          from: 'linkedTrees',
        },
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
          dependency: 'hard',
          id: 'P1',
          name: 'P1',
          applicationName: 'policySet',
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

  describe('policy conditions that name a journey', () => {
    const transaction = (strategy: string, journey: string) => ({
      type: 'Transaction',
      authenticationStrategy: strategy,
      strategySpecifier: journey,
    });

    test('reports a transaction condition with the strategy that authenticates to a journey, and its policy set', async () => {
      getPolicies.mockResolvedValue({
        result: [
          {
            ...policy(
              'P1',
              transaction('AuthenticateToTreeConditionAdvice', TARGET)
            ),
            applicationName: 'setA',
          },
        ],
      });

      expect(await find()).toEqual([
        {
          source: 'policy',
          dependency: 'hard',
          id: 'P1',
          name: 'P1',
          applicationName: 'setA',
          from: 'condition.strategySpecifier',
        },
      ]);
    });

    test.each([
      'AuthenticateToRealmConditionAdvice',
      'AuthSchemeConditionAdvice',
      '',
    ])(
      'does not read the specifier of a transaction condition with the strategy %p as a journey',
      async (strategy) => {
        getPolicies.mockResolvedValue({
          result: [policy('P1', transaction(strategy, TARGET))],
        });

        expect(await find()).toEqual([]);
      }
    );

    test('reports a transaction condition nested under AND, OR and NOT', async () => {
      getPolicies.mockResolvedValue({
        result: [
          policy('P1', {
            type: 'AND',
            conditions: [
              { type: 'Session', maxSessionTime: 5 },
              {
                type: 'OR',
                conditions: [
                  {
                    type: 'NOT',
                    condition: transaction(
                      'AuthenticateToTreeConditionAdvice',
                      TARGET
                    ),
                  },
                ],
              },
            ],
          }),
        ],
      });

      expect(await find()).toHaveLength(1);
    });

    test('keeps the same policy id in two policy sets apart', async () => {
      const condition = {
        type: 'AuthenticateToService',
        authenticateToService: TARGET,
      };
      getPolicies.mockResolvedValue({
        result: [
          { ...policy('P', condition), applicationName: 'setA' },
          { ...policy('P', condition), applicationName: 'setB' },
        ],
      });

      expect(
        (await find()).map((reference: any) => reference.applicationName)
      ).toEqual(['setA', 'setB']);
    });

    describe.each(
      journeyReferencePolicyConditionRows.map((row) => [row.conditionType, row])
    )('row %s', (_conditionType, row) => {
      const conditionFor = (name: string) => ({
        type: row.conditionType,
        ...(row.when && { [row.when.property]: row.when.equals }),
        [row.property]: name,
      });

      test('names the journey from its property, nested', async () => {
        getPolicies.mockResolvedValue({
          result: [
            policy('P1', { type: 'AND', conditions: [conditionFor(TARGET)] }),
          ],
        });

        expect(await find()).toEqual([
          expect.objectContaining({
            source: 'policy',
            dependency: 'hard',
            id: 'P1',
            from: `condition.${row.property}`,
          }),
        ]);
      });

      test(`carries the dependency ${EXPECTED_POLICY_ROW_DEPENDENCY[row.conditionType]} of its row`, async () => {
        expect(EXPECTED_POLICY_ROW_DEPENDENCY[row.conditionType]).toBeDefined();
        getPolicies.mockResolvedValue({
          result: [policy('P1', conditionFor(TARGET))],
        });

        expect(await find()).toEqual([
          expect.objectContaining({
            dependency: EXPECTED_POLICY_ROW_DEPENDENCY[row.conditionType],
          }),
        ]);
      });

      test('does not name another journey', async () => {
        getPolicies.mockResolvedValue({
          result: [policy('P1', conditionFor('Elsewhere'))],
        });

        expect(await find()).toEqual([]);
      });
    });

    describe('a policy condition row added to the table', () => {
      afterEach(() => {
        (journeyReferencePolicyConditionRows as any[]).pop();
      });

      test('is read with no code change, and its `when` is honoured', async () => {
        (journeyReferencePolicyConditionRows as any[]).push({
          conditionType: 'FutureCondition',
          property: 'journeys',
          shape: 'list',
          when: { property: 'mode', equals: 'journey' },
          dependency: 'soft',
        });
        getPolicies.mockResolvedValue({
          result: [
            policy('P1', {
              type: 'FutureCondition',
              mode: 'journey',
              journeys: ['Other', TARGET],
            }),
            policy('P2', {
              type: 'FutureCondition',
              mode: 'realm',
              journeys: [TARGET],
            }),
          ],
        });

        expect(await find()).toEqual([
          expect.objectContaining({ id: 'P1', dependency: 'soft' }),
        ]);
      });

      test('hard wins when a soft and a hard row name the same property', async () => {
        for (const dependency of ['soft', 'hard']) {
          (journeyReferencePolicyConditionRows as any[]).push({
            conditionType: 'FutureCondition',
            property: 'journey',
            shape: 'single',
            dependency,
          });
        }
        getPolicies.mockResolvedValue({
          result: [policy('P1', { type: 'FutureCondition', journey: TARGET })],
        });

        expect(await find()).toEqual([
          expect.objectContaining({ id: 'P1', dependency: 'hard' }),
        ]);
        // the second row is removed by the next afterEach, the first here
        (journeyReferencePolicyConditionRows as any[]).pop();
      });
    });
  });

  describe('policy paging', () => {
    test('fails closed when Access Management says that more policies remain', async () => {
      getPolicies.mockResolvedValue({
        result: [],
        pagedResultsCookie: null,
        remainingPagedResults: 3,
      });

      await expect(find()).rejects.toThrow(/policies/);
    });

    test('fails closed when the answer carries a cookie for the next page', async () => {
      getPolicies.mockResolvedValue({
        result: [],
        pagedResultsCookie: 'next',
        remainingPagedResults: -1,
      });

      await expect(find()).rejects.toThrow(/policies/);
    });

    test('accepts a complete answer (no cookie, nothing remaining, total unknown)', async () => {
      getPolicies.mockResolvedValue({
        result: [],
        pagedResultsCookie: null,
        remainingPagedResults: 0,
        totalPagedResults: -1,
      });

      expect(await find()).toEqual([]);
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

  describe('objects that carry the journey in `advancedOAuth2ClientConfig.treeName`', () => {
    const treeNameOf = (id: string, treeName: unknown) => ({
      _id: id,
      advancedOAuth2ClientConfig: { treeName },
    });
    // one row per source: how its reader is made to answer, and how a type that the realm does not offer is made
    const sources: {
      source: string;
      dependency: 'hard' | 'soft';
      serve: (holders: any[]) => void;
      reader: any;
      type?: string;
    }[] = [
      {
        source: 'oauth2-client',
        dependency: 'hard',
        serve: (holders) =>
          getOAuth2Clients.mockResolvedValue({ result: holders }),
        reader: getOAuth2Clients,
      },
      {
        source: 'ai-agent',
        dependency: 'hard',
        serve: (holders) =>
          getAgentsByType.mockResolvedValue({ result: holders }),
        reader: getAgentsByType,
        type: 'AIAgent',
      },
      {
        source: 'agent-group',
        dependency: 'hard',
        serve: (holders) =>
          getAgentGroups.mockResolvedValue({ result: holders }),
        reader: getAgentGroups,
      },
      {
        source: 'cimd-profile',
        dependency: 'hard',
        serve: (holders) =>
          getCIMDProfiles.mockResolvedValue({ result: holders }),
        reader: getCIMDProfiles,
        type: 'CIMDProfile',
      },
    ];

    describe.each(sources.map((row) => [row.source, row]))(
      'source %s',
      (_source, row) => {
        const expected = (id: string) => ({
          source: row.source,
          dependency: row.dependency,
          id,
          from: 'advancedOAuth2ClientConfig.treeName',
        });

        test('reports an object with the journey as a plain string', async () => {
          row.serve([treeNameOf('a', 'Other'), treeNameOf('b', TARGET)]);

          expect(await find()).toEqual([expected('b')]);
        });

        test('reports an object with the journey in the wrapped form', async () => {
          row.serve([treeNameOf('a', { inherited: false, value: TARGET })]);

          expect(await find()).toEqual([expected('a')]);
        });

        test('reads the placeholder for no journey, in both forms, as none', async () => {
          row.serve([
            treeNameOf('a', '[Empty]'),
            treeNameOf('b', { inherited: true, value: '[Empty]' }),
            treeNameOf('c', ''),
            treeNameOf('d', undefined),
            { _id: 'e' },
          ]);

          expect(await find('[Empty]')).toEqual([]);
          expect(await find()).toEqual([]);
        });

        test('does not report an object with another journey', async () => {
          row.serve([
            treeNameOf('a', { inherited: false, value: 'Elsewhere' }),
          ]);

          expect(await find()).toEqual([]);
        });

        test('orders the objects by id', async () => {
          row.serve([treeNameOf('b', TARGET), treeNameOf('a', TARGET)]);

          expect((await find()).map((reference: any) => reference.id)).toEqual([
            'a',
            'b',
          ]);
        });

        test('reads once', async () => {
          row.serve([]);

          await find();

          expect(row.reader).toHaveBeenCalledTimes(1);
        });

        if (row.type) {
          test('is none, and not read, where the realm does not offer the type', async () => {
            row.serve([treeNameOf('a', TARGET)]);
            isAgentTypeOffered.mockImplementation(
              async ({ agentType }: any) => agentType !== row.type
            );

            expect(await find()).toEqual([]);
            expect(row.reader).not.toHaveBeenCalled();
          });
        }

        test('fails the call when it cannot be read', async () => {
          row.reader.mockRejectedValue(httpError(500, 'boom'));

          await expect(find()).rejects.toBeInstanceOf(FrodoError);
        });
      }
    );

    test('the OAuth2 clients that the Cloud does not offer are none', async () => {
      getOAuth2Clients.mockRejectedValue(
        httpError(403, NOT_AVAILABLE_IN_CLOUD)
      );

      expect(await find()).toEqual([]);
    });

    test('a realm without agent groups is none', async () => {
      getAgentGroups.mockRejectedValue(httpError(404, 'Not Found'));

      expect(await find()).toEqual([]);
    });
  });

  describe('SAML service providers', () => {
    const stub = (entityId: string, location: string, roles: string[]) => ({
      _id: `${entityId}-64`,
      entityId,
      location,
      roles,
    });
    const remoteSp = (treeName: unknown) => ({
      serviceProvider: { advanced: { treeConfiguration: { treeName } } },
    });
    const hostedSp = (redirectTreeName: unknown) => ({
      serviceProvider: {
        assertionProcessing: {
          redirectTreeConfiguration: { redirectTreeName },
        },
      },
    });
    function serve(entries: [ReturnType<typeof stub>, any][]) {
      getProviderStubs.mockResolvedValue({
        result: entries.map(([entry]) => entry),
      });
      getProvider.mockImplementation(async ({ entityId64 }: any) => {
        const found = entries.find(([entry]) => entry._id === entityId64);
        if (!found) throw httpError(404, 'Not Found');
        return found[1];
      });
    }

    test('reports a remote service provider, from its tree configuration', async () => {
      serve([
        [stub('sp-remote', 'remote', ['serviceProvider']), remoteSp(TARGET)],
      ]);

      expect(await find()).toEqual([
        {
          source: 'saml2-provider',
          dependency: 'hard',
          id: 'sp-remote',
          from: 'serviceProvider.advanced.treeConfiguration.treeName',
        },
      ]);
    });

    test('reports a hosted service provider, from its redirect tree configuration', async () => {
      serve([
        [stub('sp-hosted', 'hosted', ['serviceProvider']), hostedSp(TARGET)],
      ]);

      expect(await find()).toEqual([
        {
          source: 'saml2-provider',
          dependency: 'hard',
          id: 'sp-hosted',
          from: 'serviceProvider.assertionProcessing.redirectTreeConfiguration.redirectTreeName',
        },
      ]);
    });

    test.each([
      [
        'an empty tree configuration',
        { serviceProvider: { advanced: { treeConfiguration: {} } } },
      ],
      ['the placeholder for no journey', remoteSp('[Empty]')],
      ['another journey', remoteSp('Elsewhere')],
      ['no service provider section', {}],
    ])('does not report a provider with %s', async (_what, provider) => {
      serve([[stub('sp', 'remote', ['serviceProvider']), provider]]);

      expect(await find()).toEqual([]);
    });

    test('reads only the entities whose roles include the service provider, by location and id', async () => {
      serve([
        [stub('sp-remote', 'remote', ['serviceProvider']), remoteSp('Other')],
        [stub('idp-remote', 'remote', ['identityProvider']), remoteSp(TARGET)],
        [
          stub('both-hosted', 'hosted', [
            'identityProvider',
            'serviceProvider',
          ]),
          hostedSp('Other'),
        ],
      ]);

      expect(await find()).toEqual([]);

      expect(getProviderStubs).toHaveBeenCalledTimes(1);
      expect(getProvider).toHaveBeenCalledTimes(2);
      expect(getProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'remote',
          entityId64: 'sp-remote-64',
        })
      );
      expect(getProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'hosted',
          entityId64: 'both-hosted-64',
        })
      );
    });

    test('orders the providers by entity id', async () => {
      serve([
        [stub('b', 'remote', ['serviceProvider']), remoteSp(TARGET)],
        [stub('a', 'remote', ['serviceProvider']), remoteSp(TARGET)],
      ]);

      expect((await find()).map((reference: any) => reference.id)).toEqual([
        'a',
        'b',
      ]);
    });

    test('fails the call, naming the provider, when one cannot be read', async () => {
      serve([
        [stub('ok', 'remote', ['serviceProvider']), remoteSp('Other')],
        [stub('broken', 'remote', ['serviceProvider']), remoteSp(TARGET)],
      ]);
      getProvider.mockImplementation(async ({ entityId64 }: any) => {
        if (entityId64 === 'broken-64') throw httpError(500, 'boom');
        return remoteSp('Other');
      });

      const error: any = await find().catch((e) => e);

      expect(error).toBeInstanceOf(FrodoError);
      expect(messagesOf(error).join(' | ')).toMatch(/saml2 provider broken/);
    });

    test('is none when the realm has no providers or does not offer them', async () => {
      getProviderStubs.mockRejectedValue(
        httpError(403, NOT_AVAILABLE_IN_CLOUD)
      );

      expect(await find()).toEqual([]);
      expect(getProvider).not.toHaveBeenCalled();
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
      getOAuth2Clients.mockResolvedValue({
        result: [
          { _id: 'client', advancedOAuth2ClientConfig: { treeName: TARGET } },
        ],
      });
      getProviderStubs.mockResolvedValue({
        result: [
          {
            _id: 'sp-64',
            entityId: 'sp',
            location: 'remote',
            roles: ['serviceProvider'],
          },
        ],
      });
      getProvider.mockResolvedValue({
        serviceProvider: {
          advanced: { treeConfiguration: { treeName: TARGET } },
        },
      });
      getAgentsByType.mockResolvedValue({
        result: [
          {
            _id: 'agent',
            advancedOAuth2ClientConfig: {
              treeName: { inherited: false, value: TARGET },
            },
          },
        ],
      });
      getAgentGroups.mockResolvedValue({
        result: [
          {
            _id: 'group',
            advancedOAuth2ClientConfig: {
              treeName: { inherited: false, value: TARGET },
            },
          },
        ],
      });
      getCIMDProfiles.mockResolvedValue({
        result: [
          { _id: 'profile', advancedOAuth2ClientConfig: { treeName: TARGET } },
        ],
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

    const everyReader = () => [
      getTrees,
      readNodesMock,
      getAuthenticationSettings,
      getService,
      getOAuth2Provider,
      getOAuth2Clients,
      getProviderStubs,
      getAgentsByType,
      getAgentGroups,
      getCIMDProfiles,
      getConfigEntity,
      getPolicies,
    ];

    test('reads every source once and orders the answer by source', async () => {
      populateEverySource();

      const result = await find();

      expect(result.map((r: any) => r.source)).toEqual([
        'journey',
        'authentication-settings',
        'self-service-trees',
        'oauth2-provider',
        'oauth2-client',
        'saml2-provider',
        'ai-agent',
        'agent-group',
        'cimd-profile',
        'theme',
        'policy',
      ]);
      for (const reader of everyReader()) {
        expect(reader).toHaveBeenCalledTimes(1);
      }
      expect(getProvider).toHaveBeenCalledTimes(1);
    });

    describe('the dependency flag', () => {
      test('every reference carries hard or soft', async () => {
        populateEverySource();

        const result = await find();

        expect(result).toHaveLength(
          Object.keys(EXPECTED_SOURCE_DEPENDENCY).length
        );
        for (const reference of result) {
          expect(['hard', 'soft']).toContain(reference.dependency);
        }
      });

      test('has an expectation for every source of the result type, and no other', () => {
        expect(Object.keys(EXPECTED_SOURCE_DEPENDENCY).sort()).toEqual(
          Object.values(JOURNEY_REFERENCE_SOURCES).sort()
        );
      });

      test.each(Object.entries(EXPECTED_SOURCE_DEPENDENCY))(
        'source %s is %s',
        async (source, dependency) => {
          populateEverySource();

          const result = await find();

          expect(
            result.filter((reference: any) => reference.source === source)
          ).toEqual([expect.objectContaining({ dependency })]);
        }
      );
    });

    test('the source values are the ones that callers read', () => {
      expect(JOURNEY_REFERENCE_SOURCES).toEqual({
        journey: 'journey',
        authenticationSettings: 'authentication-settings',
        selfServiceTrees: 'self-service-trees',
        oauth2Provider: 'oauth2-provider',
        oauth2Client: 'oauth2-client',
        saml2Provider: 'saml2-provider',
        aiAgent: 'ai-agent',
        agentGroup: 'agent-group',
        cimdProfile: 'cimd-profile',
        theme: 'theme',
        policy: 'policy',
      });
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
      for (const reader of everyReader().filter((r) => r !== getService)) {
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
