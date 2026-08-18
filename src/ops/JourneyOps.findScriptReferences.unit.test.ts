import { jest } from '@jest/globals';

const getTrees = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const readNodesMock = jest.fn(async (_args?: any): Promise<any[]> => []);

jest.unstable_mockModule('../api/TreeApi', () => ({
  deleteTree: jest.fn(),
  getTree: jest.fn(),
  getTrees,
  getTreesCount: jest.fn(),
  putTree: jest.fn(),
}));

jest.unstable_mockModule('./NodeOps', () => ({
  importCustomNodes: jest.fn(),
  isCloudOnlyNode: jest.fn(() => false),
  isCustomNode: jest.fn(() => false),
  isPremiumNode: jest.fn(() => false),
  readCustomNode: jest.fn(),
  readNode: jest.fn(),
  readNodes: readNodesMock,
  updateNode: jest.fn(),
  deleteNode: jest.fn(),
}));

const { findScriptReferences } = await import('./JourneyOps');

function mockState() {
  return {} as any;
}

function tree(id: string, nodes: Record<string, any>) {
  return { _id: id, entryNodeId: 'start', nodes };
}

function nodeRef(nodeType: string, displayName = nodeType) {
  return { nodeType, displayName, connections: {}, x: 0, y: 0 };
}

describe('findScriptReferences', () => {
  beforeEach(() => {
    getTrees.mockReset();
    readNodesMock.mockReset();
    getTrees.mockResolvedValue({ result: [] });
    readNodesMock.mockResolvedValue([]);
  });

  test('returns an empty array, not an error, when nothing references the script', async () => {
    readNodesMock.mockResolvedValue([{ _id: 'node-1', script: 'other-script' }]);
    getTrees.mockResolvedValue({
      result: [tree('Login', { 'node-1': nodeRef('ScriptedDecisionNode') })],
    });

    const result = await findScriptReferences({
      scriptId: 'target-script',
      state: mockState(),
    });

    expect(result).toEqual([]);
  });

  test('finds a top-level node that directly references the script', async () => {
    readNodesMock.mockResolvedValue([
      { _id: 'node-1', script: 'target-script' },
    ]);
    getTrees.mockResolvedValue({
      result: [
        tree('Login', {
          'node-1': nodeRef('ScriptedDecisionNode', 'Check risk'),
        }),
      ],
    });

    const result = await findScriptReferences({
      scriptId: 'target-script',
      state: mockState(),
    });

    expect(result).toEqual([
      {
        journeyId: 'Login',
        nodeId: 'node-1',
        nodeType: 'ScriptedDecisionNode',
        nodeDisplayName: 'Check risk',
      },
    ]);
  });

  test('finds a script used by a node nested inside a container node, reporting both ids', async () => {
    readNodesMock.mockResolvedValue([
      {
        _id: 'page-node-1',
        nodes: [
          { _id: 'inner-node-1', displayName: 'Username', nodeType: 'UsernameCollectorNode' },
          { _id: 'inner-node-2', displayName: 'Check risk', nodeType: 'ScriptedDecisionNode' },
        ],
      },
      { _id: 'inner-node-2', script: 'target-script' },
    ]);
    getTrees.mockResolvedValue({
      result: [tree('Login', { 'page-node-1': nodeRef('PageNode', 'Page') })],
    });

    const result = await findScriptReferences({
      scriptId: 'target-script',
      state: mockState(),
    });

    expect(result).toEqual([
      {
        journeyId: 'Login',
        nodeId: 'page-node-1',
        nodeType: 'PageNode',
        nodeDisplayName: 'Page',
        innerNodeId: 'inner-node-2',
      },
    ]);
  });

  test('finds references across multiple journeys', async () => {
    readNodesMock.mockResolvedValue([
      { _id: 'node-1', script: 'target-script' },
      { _id: 'node-2', script: 'target-script' },
    ]);
    getTrees.mockResolvedValue({
      result: [
        tree('Login', { 'node-1': nodeRef('ScriptedDecisionNode') }),
        tree('Registration', { 'node-2': nodeRef('ScriptedDecisionNode') }),
      ],
    });

    const result = await findScriptReferences({
      scriptId: 'target-script',
      state: mockState(),
    });

    expect(result.map((r: any) => r.journeyId).sort()).toEqual([
      'Login',
      'Registration',
    ]);
  });

  test('does not fetch node details individually — only two bulk reads regardless of realm size', async () => {
    readNodesMock.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({ _id: `node-${i}` }))
    );
    getTrees.mockResolvedValue({
      result: Array.from({ length: 20 }, (_, i) =>
        tree(`Journey-${i}`, { [`node-${i}`]: nodeRef('PageNode') })
      ),
    });

    await findScriptReferences({ scriptId: 'target-script', state: mockState() });

    expect(readNodesMock).toHaveBeenCalledTimes(1);
    expect(getTrees).toHaveBeenCalledTimes(1);
  });

  test('ignores an orphaned node that references the script but is not attached to any journey', async () => {
    readNodesMock.mockResolvedValue([
      { _id: 'orphaned-node', script: 'target-script' },
    ]);
    getTrees.mockResolvedValue({ result: [tree('Login', {})] });

    const result = await findScriptReferences({
      scriptId: 'target-script',
      state: mockState(),
    });

    expect(result).toEqual([]);
  });
});
