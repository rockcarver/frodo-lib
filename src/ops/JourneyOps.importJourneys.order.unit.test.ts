import { jest } from '@jest/globals';

/**
 * `importJourneys` writes the journeys of a batch in the order of their dependencies, whether the journeys are
 * installed in the realm or not (frodo-lib#1122): an inner journey is written before the journey that needs it, so
 * that a broken inner journey of the realm is repaired before the journey that evaluates it is saved.
 *
 * Mocked unit test: no recordings, no tenant. The fake realm refuses to save a journey that uses an inner journey
 * which is missing or disabled in the realm at that moment, as the reporter saw AM do (HTTP 500).
 */

const realm = new Map<string, { enabled: boolean }>();
const nodeConfigs = new Map<string, any>();
const getTreesMock: any = jest.fn();
const putTreeMock: any = jest.fn();
const updateNodeMock: any = jest.fn();

jest.unstable_mockModule('../api/TreeApi', () => ({
  deleteTree: jest.fn(),
  getTree: jest.fn(),
  getTrees: getTreesMock,
  getTreesCount: jest.fn(),
  putTree: putTreeMock,
}));

jest.unstable_mockModule('./NodeOps', () => ({
  importCustomNodes: jest.fn(),
  readCustomNode: jest.fn(),
  readNode: jest.fn(),
  readNodes: jest.fn(),
  updateNode: updateNodeMock,
  deleteNode: jest.fn(),
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage: jest.fn(),
  printMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
  verboseMessage: jest.fn(),
}));

const { importJourneys, resolveDependencies, resolveInnerTreeDependencies } =
  await import('./JourneyOps');

const options = { reUuid: false, deps: false };
const state: any = {
  getRealm: () => 'alpha',
  getVerbose: () => false,
  getDeploymentType: () => 'onprem',
  getHost: () => 'https://example.com/am',
  getAmVersion: () => '9.0.0',
  getUsername: () => 'alpha_user',
  getFrodoVersion: () => 'v5.0.0-test',
};

const TERMINAL = '70e691a5-1e33-4ac3-a356-e7b6d60d92e0';

/** A journey without findings that needs the given journeys, by way of an inner journey node each. */
function journeyExport(
  journeyId: string,
  needs: string[] = [],
  enabled = true
): any {
  const nodes: Record<string, any> = {
    [`${journeyId}-node`]: {
      nodeType: 'DecisionNode',
      version: '1.0',
      connections: { done: TERMINAL },
    },
  };
  const configs: Record<string, any> = {
    [`${journeyId}-node`]: {
      _id: `${journeyId}-node`,
      _type: { _id: 'DecisionNode', version: '1.0' },
      _outcomes: [{ id: 'done' }],
    },
  };
  needs.forEach((dependency, index) => {
    const nodeId = `${journeyId}-inner-${index}`;
    nodes[nodeId] = {
      nodeType: 'InnerTreeEvaluatorNode',
      version: '1.0',
      connections: { true: TERMINAL, false: TERMINAL },
    };
    configs[nodeId] = {
      _id: nodeId,
      _type: { _id: 'InnerTreeEvaluatorNode', version: '1.0' },
      _outcomes: [{ id: 'true' }, { id: 'false' }],
      tree: dependency,
    };
  });
  return {
    tree: {
      _id: journeyId,
      enabled,
      entryNodeId: `${journeyId}-node`,
      nodes,
      staticNodes: {},
    },
    nodes: configs,
    innerNodes: {},
  };
}

/** Journeys that are installed in the realm before the import. */
function install(...journeyIds: string[]) {
  journeyIds.forEach((journeyId) => realm.set(journeyId, { enabled: true }));
}

const written = () =>
  putTreeMock.mock.calls.map(([args]: any[]) => args.treeId);

function recorder() {
  const outcomes: string[] = [];
  const resultCallback = jest.fn((error?: any, result?: any) => {
    outcomes.push(error ? `!${error.message}` : result._id);
  });
  return { outcomes, resultCallback };
}

beforeEach(() => {
  jest.clearAllMocks();
  realm.clear();
  nodeConfigs.clear();
  getTreesMock.mockReset();
  getTreesMock.mockImplementation(async () => ({
    result: [...realm.keys()].map((_id) => ({ _id })),
  }));
  updateNodeMock.mockReset();
  updateNodeMock.mockImplementation(async ({ nodeId, nodeData }: any) => {
    nodeConfigs.set(nodeId, nodeData);
    return {};
  });
  putTreeMock.mockReset();
  putTreeMock.mockImplementation(
    async ({ treeId, treeData }: { treeId: string; treeData: any }) => {
      for (const nodeId of Object.keys(treeData.nodes ?? {})) {
        const inner = nodeConfigs.get(nodeId);
        if (
          inner?._type?._id === 'InnerTreeEvaluatorNode' &&
          !realm.get(inner.tree)?.enabled
        ) {
          throw Object.assign(new Error('HTTP 500'), {
            response: {
              status: 500,
              data: {
                message: 'Unable to save SMS config: Could not evaluate tree',
              },
            },
          });
        }
      }
      realm.set(treeId, { enabled: treeData.enabled !== false });
      return treeData;
    }
  );
});

describe('importJourneys writes the journeys in the order of their dependencies', () => {
  test('journeys that are all installed: the inner journey is written before the journey that needs it', async () => {
    install('A', 'B');

    await importJourneys({
      importData: {
        trees: { A: journeyExport('A', ['B']), B: journeyExport('B') },
      },
      options,
      state,
    });

    expect(written()).toEqual(['B', 'A']);
  });

  test('the journey that needs the inner journey is new, the inner journey is installed', async () => {
    install('B');

    await importJourneys({
      importData: {
        trees: { A: journeyExport('A', ['B']), B: journeyExport('B') },
      },
      options,
      state,
    });

    expect(written()).toEqual(['B', 'A']);
  });

  test('three levels of installed journeys', async () => {
    install('Top', 'Middle', 'Bottom');

    await importJourneys({
      importData: {
        trees: {
          Top: journeyExport('Top', ['Middle']),
          Middle: journeyExport('Middle', ['Bottom']),
          Bottom: journeyExport('Bottom'),
        },
      },
      options,
      state,
    });

    expect(written()).toEqual(['Bottom', 'Middle', 'Top']);
  });

  test('only the middle journey is installed', async () => {
    install('Middle');

    await importJourneys({
      importData: {
        trees: {
          Top: journeyExport('Top', ['Middle']),
          Middle: journeyExport('Middle', ['Bottom']),
          Bottom: journeyExport('Bottom'),
        },
      },
      options,
      state,
    });

    expect(written()).toEqual(['Bottom', 'Middle', 'Top']);
  });

  test('journeys that do not need each other keep the order of the import data', async () => {
    install('R', 'P', 'Q');

    await importJourneys({
      importData: {
        trees: {
          R: journeyExport('R'),
          P: journeyExport('P'),
          Q: journeyExport('Q'),
        },
      },
      options,
      state,
    });

    expect(written()).toEqual(['R', 'P', 'Q']);
  });

  test('an inner journey that is only installed (not in the import data) needs no ordering', async () => {
    install('B');

    await importJourneys({
      importData: { trees: { A: journeyExport('A', ['B']) } },
      options,
      state,
    });

    expect(written()).toEqual(['A']);
  });

  test('a circle of installed journeys is still imported, in the order of the import data (unchanged)', async () => {
    install('X', 'Y', 'Z');

    await importJourneys({
      importData: {
        trees: {
          Z: journeyExport('Z', ['X']),
          X: journeyExport('X', ['Y']),
          Y: journeyExport('Y', ['X']),
        },
      },
      options,
      state,
    });

    expect(written()).toEqual(['Z', 'X', 'Y']);
  });

  test('a journey that needs itself is still imported when it is installed (unchanged)', async () => {
    install('Self');

    await importJourneys({
      importData: { trees: { Self: journeyExport('Self', ['Self']) } },
      options,
      state,
    });

    expect(written()).toEqual(['Self']);
  });

  test('a circle of journeys that are not installed is still rejected (unchanged)', async () => {
    await expect(
      importJourneys({
        importData: {
          trees: {
            X: journeyExport('X', ['Y']),
            Y: journeyExport('Y', ['X']),
          },
        },
        options,
        state,
      })
    ).rejects.toThrow('journeys with unresolved dependencies');
    expect(putTreeMock).not.toHaveBeenCalled();
  });

  test('frodo-lib#1122: an installed inner journey that is disabled is enabled again before the journey that needs it is saved', async () => {
    realm.set('B', { enabled: false });
    realm.set('A', { enabled: true });
    nodeConfigs.set('A-inner-0', {
      _type: { _id: 'InnerTreeEvaluatorNode' },
      tree: 'B',
    });

    await importJourneys({
      importData: {
        trees: { A: journeyExport('A', ['B']), B: journeyExport('B') },
      },
      options,
      state,
    });

    expect(written()).toEqual(['B', 'A']);
    expect(realm.get('B')?.enabled).toBe(true);
  });

  test('with a result callback: a journey that needs an installed inner journey that could not be written is not attempted', async () => {
    install('A', 'B');
    const original = putTreeMock.getMockImplementation();
    putTreeMock.mockImplementation(async (args: any) => {
      if (args.treeId === 'B') throw new Error('HTTP 500');
      return original(args);
    });
    const { outcomes, resultCallback } = recorder();

    await importJourneys({
      importData: {
        trees: { A: journeyExport('A', ['B']), B: journeyExport('B') },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey B',
      '!Error importing the alpha realm journey A',
    ]);
    expect(written()).toEqual(['B']);
  });

  test('with a result callback: the results come in the order of the dependencies of installed journeys', async () => {
    install('A', 'B');
    const { outcomes, resultCallback } = recorder();

    await importJourneys({
      importData: {
        trees: { A: journeyExport('A', ['B']), B: journeyExport('B') },
      },
      options,
      resultCallback,
      state,
    });

    expect(outcomes).toEqual(['B', 'A']);
    expect(written()).toEqual(['B', 'A']);
  });

  test('with a result callback: a journey is judged when its turn comes, so one that needs an installed journey that cannot be imported can be written first (the example of MIGRATION.md)', async () => {
    install('A', 'B', 'G');
    const { outcomes, resultCallback } = recorder();

    await importJourneys({
      importData: {
        trees: {
          G: journeyExport('G', ['E', 'A']),
          B: journeyExport('B', ['Nowhere']),
          A: journeyExport('A', ['B']),
          E: journeyExport('E'),
        },
      },
      options,
      resultCallback,
      state,
    });

    // B needs a journey that exists nowhere and is not written; A is skipped because B failed; G is written before A
    // is judged, because an installed journey that cannot be imported still counts as resolved for the journeys that
    // need it
    expect(written()).toEqual(['E', 'G']);
    expect(outcomes).toEqual([
      '!Error importing the alpha realm journey B',
      'E',
      'G',
      '!Error importing the alpha realm journey A',
    ]);
  });

  test('an inner journey that is neither installed nor in the import data still rejects the batch (unchanged)', async () => {
    install('Other');

    await expect(
      importJourneys({
        importData: {
          trees: {
            Other: journeyExport('Other'),
            A: journeyExport('A', ['Nowhere']),
          },
        },
        options,
        state,
      })
    ).rejects.toThrow('A requires Nowhere');
    expect(putTreeMock).not.toHaveBeenCalled();
  });
});

/** The map of journeys that the functions take, with the journeys that each one needs. */
function journeyMap(needs: Record<string, string[]>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(needs).map(([journeyId, dependencies]) => [
      journeyId,
      journeyExport(journeyId, dependencies),
    ])
  );
}

/** What each of the two functions that order journeys leaves in the arguments they are given, for the same input. */
async function order(
  installed: string[],
  needs: Record<string, string[]>
): Promise<{ resolved: string[]; unresolved: Record<string, string[]> }[]> {
  const first = {
    resolved: [] as string[],
    unresolved: {} as Record<string, string[]>,
  };
  await resolveDependencies(
    installed,
    journeyMap(needs),
    first.unresolved,
    first.resolved
  );
  const second = {
    resolved: [] as string[],
    unresolved: {} as Record<string, string[]>,
  };
  await resolveInnerTreeDependencies({
    existingJorneys: installed,
    candidateJourneys: journeyMap(needs) as any,
    unresolvedJourneys: second.unresolved,
    resolvedJourneys: second.resolved,
  });
  return [first, second];
}

describe('resolveDependencies and resolveInnerTreeDependencies order the journeys the same way', () => {
  test.each([
    {
      name: 'installed journeys of the batch come after the journeys they need',
      installed: ['A', 'B', 'C'],
      needs: { A: ['B'], B: ['C'], C: [] },
      resolved: ['C', 'B', 'A'],
      unresolved: {},
    },
    {
      name: 'a journey that needs an installed journey outside of the batch is not moved',
      installed: ['Outside'],
      needs: { A: ['Outside'], B: [] },
      resolved: ['A', 'B'],
      unresolved: {},
    },
    {
      name: 'a diamond of installed journeys',
      installed: ['Top', 'Left', 'Right', 'Base'],
      needs: {
        Top: ['Left', 'Right'],
        Left: ['Base'],
        Right: ['Base'],
        Base: [],
      },
      resolved: ['Base', 'Left', 'Right', 'Top'],
      unresolved: {},
    },
    {
      name: 'a circle of installed journeys is resolved in the order of the batch',
      installed: ['X', 'Y'],
      needs: { X: ['Y'], Y: ['X'] },
      resolved: ['X', 'Y'],
      unresolved: {},
    },
    {
      name: 'a circle of journeys that are not installed stays unresolved',
      installed: [],
      needs: { X: ['Y'], Y: ['X'], Free: [] },
      resolved: ['Free'],
      unresolved: { X: ['Y'], Y: ['X'] },
    },
    {
      name: 'a journey that needs itself is unresolved unless it is installed',
      installed: [],
      needs: { Self: ['Self'] },
      resolved: [],
      unresolved: { Self: ['Self'] },
    },
    {
      name: 'a journey that needs a journey that is nowhere stays unresolved, and what needs it is resolved as before',
      installed: ['A'],
      needs: { A: ['Nowhere'], B: ['A'] },
      resolved: ['B'],
      unresolved: { A: ['Nowhere'] },
    },
  ])('$name', async ({ installed, needs, resolved, unresolved }) => {
    for (const result of await order(installed, needs)) {
      expect(result.resolved).toEqual(resolved);
      expect(result.unresolved).toEqual(unresolved);
    }
  });

  test('resolveInnerTreeDependencies returns the status that it documents', async () => {
    const result = await resolveInnerTreeDependencies({
      existingJorneys: ['A', 'B'],
      candidateJourneys: journeyMap({ A: ['B'], B: [] }) as any,
    });

    expect(result).toEqual({
      resolvedJourneys: ['B', 'A'],
      unresolvedJourneys: {},
    });
  });

  test('resolveInnerTreeDependencies returns the journeys that stay unresolved, with what they need', async () => {
    const result = await resolveInnerTreeDependencies({
      existingJorneys: [],
      candidateJourneys: journeyMap({ X: ['Y'], Y: ['X'], Free: [] }) as any,
    });

    expect(result).toEqual({
      resolvedJourneys: ['Free'],
      unresolvedJourneys: { X: ['Y'], Y: ['X'] },
    });
  });

  test('index is the number of journeys that were unresolved after an earlier pass: a first pass that leaves that many ends the ordering by dependencies, and the old rule takes over', async () => {
    const installed = ['X', 'Y', 'Z'];
    const needs = { Z: ['Y'], Y: ['X'], X: [] };

    // left out: ordered by the dependencies
    const ordered: string[] = [];
    await resolveDependencies(installed, journeyMap(needs), {}, ordered);
    expect(ordered).toEqual(['X', 'Y', 'Z']);

    // the first pass leaves two journeys (Z and Y) unresolved, as many as the index says: no progress
    const afterIndex: string[] = [];
    await resolveDependencies(installed, journeyMap(needs), {}, afterIndex, 2);
    expect(afterIndex).toEqual(['X', 'Z', 'Y']);

    const innerAfterIndex = await resolveInnerTreeDependencies({
      existingJorneys: installed,
      candidateJourneys: journeyMap(needs) as any,
      index: 2,
    });
    expect(innerAfterIndex.resolvedJourneys).toEqual(['X', 'Z', 'Y']);
  });
});
