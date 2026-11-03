import { jest } from '@jest/globals';

const getTreeMock: any = jest.fn();
const readNodeMock: any = jest.fn();

jest.unstable_mockModule('../api/TreeApi', () => ({
  deleteTree: jest.fn(),
  getTree: getTreeMock,
  getTrees: jest.fn(),
  getTreesCount: jest.fn(),
  putTree: jest.fn(),
}));

jest.unstable_mockModule('./NodeOps', () => ({
  importCustomNodes: jest.fn(),
  readCustomNode: jest.fn(),
  readNode: readNodeMock,
  readNodes: jest.fn(),
  updateNode: jest.fn(),
  deleteNode: jest.fn(),
}));

jest.unstable_mockModule('../utils/Console', () => ({
  createProgressIndicator: jest.fn(),
  debugMessage: jest.fn(),
  printMessage: jest.fn(),
  printError: jest.fn(),
  verboseMessage: jest.fn(),
  curlirizeMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

const { getTreeDescendents, exportJourney } = await import('./JourneyOps');

function mockState(): any {
  return {
    getVerbose: () => false,
    getDeploymentType: () => 'onprem',
    getHost: () => 'https://example.com/am',
    getAmVersion: () => '9.0.0',
    getUsername: () => 'alpha_user',
    getFrodoVersion: () => 'v4.0.0-test',
    getRealm: () => 'alpha',
  };
}

/**
 * Build a single tree export whose nodes are inner tree evaluators that
 * reference the given sub-journeys, in order.
 */
function treeExport(treeId: string, innerTreeIds: string[] = []): any {
  const nodes: Record<string, any> = {};
  const nodeConfigs: Record<string, any> = {};
  innerTreeIds.forEach((innerTreeId, index) => {
    const nodeId = `${treeId}-node-${index}`;
    nodes[nodeId] = {
      nodeType: 'InnerTreeEvaluatorNode',
      version: '1.0',
      connections: {},
    };
    nodeConfigs[nodeId] = {
      _id: nodeId,
      tree: innerTreeId,
      _outcomes: [],
      _type: { _id: 'InnerTreeEvaluatorNode' },
    };
  });
  return {
    tree: {
      _id: treeId,
      enabled: true,
      entryNodeId: Object.keys(nodes)[0] ?? 'none',
      innerTreeOnly: false,
      mustRun: false,
      noSession: false,
      uiConfig: {},
      nodes,
      staticNodes: {},
    },
    nodes: nodeConfigs,
    innerNodes: {},
    scripts: {},
    emailTemplates: {},
    socialIdentityProviders: {},
    themes: [],
    saml2Entities: {},
    circlesOfTrust: {},
    variables: {},
  };
}

function resolverFor(graph: Record<string, string[]>) {
  return jest.fn(async (treeId: string): Promise<any> => {
    if (!(treeId in graph)) {
      throw new Error(`cannot resolve ${treeId}`);
    }
    return treeExport(treeId, graph[treeId]);
  });
}

describe('getTreeDescendents', () => {
  test('expands a shared sub-journey in full under every parent', async () => {
    const graph = {
      Root: ['WebAuthN', 'Password'],
      WebAuthN: ['Password', 'Push'],
      Password: ['Reset'],
      Reset: [],
      Push: [],
    };
    const resolver = resolverFor(graph);

    const result = await getTreeDescendents({
      treeExport: treeExport('Root', graph.Root),
      resolveTreeExport: resolver,
      resolvedTreeIds: [],
      state: mockState(),
    });

    expect(result).toStrictEqual({
      Root: [
        {
          WebAuthN: [{ Password: [{ Reset: [] }] }, { Push: [] }],
        },
        { Password: [{ Reset: [] }] },
      ],
    });
  });

  test('describes a sub-journey the same alone and under its parent', async () => {
    const graph = {
      Root: ['A', 'B'],
      A: ['Shared'],
      B: ['Shared'],
      Shared: ['Leaf'],
      Leaf: [],
    };
    const state = mockState();
    const inParent = await getTreeDescendents({
      treeExport: treeExport('Root', graph.Root),
      resolveTreeExport: resolverFor(graph),
      resolvedTreeIds: [],
      state,
    });
    const alone = await getTreeDescendents({
      treeExport: treeExport('B', graph.B),
      resolveTreeExport: resolverFor(graph),
      resolvedTreeIds: [],
      state,
    });

    expect(inParent.Root[1]).toStrictEqual(alone);
  });

  test('describes a diamond with the bottom sub-journey under both sides', async () => {
    const graph = {
      Top: ['Left', 'Right'],
      Left: ['Bottom'],
      Right: ['Bottom'],
      Bottom: [],
    };

    const result = await getTreeDescendents({
      treeExport: treeExport('Top', graph.Top),
      resolveTreeExport: resolverFor(graph),
      resolvedTreeIds: [],
      state: mockState(),
    });

    expect(result).toStrictEqual({
      Top: [{ Left: [{ Bottom: [] }] }, { Right: [{ Bottom: [] }] }],
    });
  });

  test('ends a cycle at a leaf', async () => {
    const graph = { A: ['B'], B: ['A'] };

    const result = await getTreeDescendents({
      treeExport: treeExport('A', graph.A),
      resolveTreeExport: resolverFor(graph),
      resolvedTreeIds: [],
      state: mockState(),
    });

    expect(result).toStrictEqual({ A: [{ B: [{ A: [] }] }] });
  });

  test('ends a self reference at a leaf', async () => {
    const result = await getTreeDescendents({
      treeExport: treeExport('A', ['A']),
      resolveTreeExport: resolverFor({}),
      resolvedTreeIds: [],
      state: mockState(),
    });

    expect(result).toStrictEqual({ A: [{ A: [] }] });
  });

  test('lists an unresolvable inner tree as a leaf', async () => {
    const graph = { Root: ['Missing', 'Child'], Child: ['AlsoMissing'] };

    const result = await getTreeDescendents({
      treeExport: treeExport('Root', graph.Root),
      resolveTreeExport: resolverFor(graph),
      resolvedTreeIds: [],
      state: mockState(),
    });

    expect(result).toStrictEqual({
      Root: [{ Missing: [] }, { Child: [{ AlsoMissing: [] }] }],
    });
  });

  test('lists an inner tree the resolver returns nothing for as a leaf', async () => {
    const resolver = jest.fn(async (): Promise<any> => undefined);

    const result = await getTreeDescendents({
      treeExport: treeExport('Root', ['Nothing']),
      resolveTreeExport: resolver,
      resolvedTreeIds: [],
      state: mockState(),
    });

    expect(result).toStrictEqual({ Root: [{ Nothing: [] }] });
  });

  test('resolves each sub-journey export once per walk', async () => {
    const graph = {
      Root: ['A', 'B', 'Missing'],
      A: ['Shared', 'Missing'],
      B: ['Shared', 'Missing'],
      Shared: ['Leaf'],
      Leaf: [],
    };
    const resolver = resolverFor(graph);

    await getTreeDescendents({
      treeExport: treeExport('Root', graph.Root),
      resolveTreeExport: resolver,
      resolvedTreeIds: [],
      state: mockState(),
    });

    const calls = resolver.mock.calls.map(([treeId]) => treeId);
    expect(calls.sort()).toStrictEqual(['A', 'B', 'Leaf', 'Missing', 'Shared']);
  });

  test('lists the ids in resolvedTreeIds as leaves without changing the list', async () => {
    const graph = { Root: ['A', 'B'], A: ['C'], B: [], C: [] };
    const resolver = resolverFor(graph);
    const resolvedTreeIds = ['A'];

    const result = await getTreeDescendents({
      treeExport: treeExport('Root', graph.Root),
      resolveTreeExport: resolver,
      resolvedTreeIds,
      state: mockState(),
    });

    expect(result).toStrictEqual({ Root: [{ A: [] }, { B: [] }] });
    expect(resolvedTreeIds).toStrictEqual(['A']);
    expect(resolver.mock.calls.map(([treeId]) => treeId)).toStrictEqual(['B']);
  });
});

describe('exportJourney with shared sub-journeys', () => {
  test('exports each dependency once', async () => {
    const graph = {
      Parent: ['Left', 'Right'],
      Left: ['Bottom'],
      Right: ['Bottom'],
      Bottom: [],
    };
    const parent = treeExport('Parent', graph.Parent);
    getTreeMock.mockImplementation(async () => ({
      ...parent.tree,
      nodes: { ...parent.tree.nodes },
    }));
    readNodeMock.mockImplementation(async ({ nodeId }: { nodeId: string }) => ({
      ...parent.nodes[nodeId],
    }));
    const resolver = resolverFor(graph);

    const response = await exportJourney({
      journeyId: 'Parent',
      options: { deps: true, useStringArrays: true, coords: true },
      resolveTreeExport: resolver,
      state: mockState(),
    });

    expect(Object.keys(response.trees)).toStrictEqual([
      'Bottom',
      'Left',
      'Right',
      'Parent',
    ]);
  });
});
