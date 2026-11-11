import { jest } from '@jest/globals';

/**
 * `removeOrphanedNodes` tries every orphaned node: a node that cannot be deleted does not
 * stop the others, and the nodes that failed are returned.
 * Without a result callback the error of a failed node is printed (through the error handler
 * of the state). With one, the outcome of every node is passed to it as it happens, a failed
 * node as an error that names the node and carries the cause, and nothing is printed.
 * Origin: frodo-cli#1099 (record 0040), where `journey prune` and `promote` need the reason a
 * node failed for their summary.
 * Mocked unit test: no recordings.
 */

const deleteNode = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/NodeApi', () => ({
  createCustomNode: jest.fn(),
  createNode: jest.fn(),
  deleteCustomNode: jest.fn(),
  deleteNode,
  getCustomNode: jest.fn(),
  getCustomNodes: jest.fn(),
  getCustomNodeUsage: jest.fn(),
  getNode: jest.fn(),
  getNodes: jest.fn(),
  getNodesByType: jest.fn(),
  getNodeTypes: jest.fn(),
  getNodeType: jest.fn(),
  putCustomNode: jest.fn(),
  putNode: jest.fn(),
  getNodeSchema: jest.fn(),
  getCustomNodeSchema: jest.fn(),
  requireVersion: jest.fn(() => false),
}));

const { default: NodeOps, removeOrphanedNodes } = await import('./NodeOps');
const { FrodoError } = await import('./FrodoError');
const { default: State } = await import('../shared/State');

const node = (id: string, type = 'ScriptedDecisionNode'): any => ({
  _id: id,
  _type: { _id: type },
});

function setup() {
  const state = State({});
  const errorHandler = jest.fn();
  state.setErrorHandler(errorHandler as any);
  return { state, errorHandler };
}

/** Make the delete of the given node ids fail, with an error that carries the failed request. */
function failFor(...ids: string[]) {
  deleteNode.mockImplementation(async (args: any) => {
    if (ids.includes(args.nodeId)) {
      throw Object.assign(new Error(`delete of ${args.nodeId} refused`), {
        config: { url: `https://example.com/am/json/node/${args.nodeId}` },
      });
    }
    return {};
  });
}

describe('removeOrphanedNodes', () => {
  beforeEach(() => {
    deleteNode.mockReset();
    deleteNode.mockResolvedValue({});
  });

  describe('without a result callback', () => {
    test('tries every node, prints the error of the failed one and returns it', async () => {
      const { state, errorHandler } = setup();
      failFor('b');
      const nodes = [node('a'), node('b'), node('c')];

      const failed = await removeOrphanedNodes({
        orphanedNodes: nodes,
        state,
      });

      expect(failed).toEqual([nodes[1]]);
      expect(
        deleteNode.mock.calls.map(([args]) => (args as any).nodeId)
      ).toEqual(['a', 'b', 'c']);
      expect(errorHandler).toHaveBeenCalledTimes(1);
      const [error, message] = errorHandler.mock.calls[0] as [Error, string];
      // deleteNode wraps the failed request in a FrodoError (frodo-lib#1033)
      expect(error.message).toBe('Error deleting ScriptedDecisionNode node b');
      expect((error as any).originalErrors[0].message).toBe(
        'delete of b refused'
      );
      expect(message).toContain(
        'Failed to delete orphaned node b (ScriptedDecisionNode v1.0)'
      );
      expect(message).toContain(
        'Request URL: https://example.com/am/json/node/b'
      );
    });

    test('returns an empty array and prints nothing when every node was deleted', async () => {
      const { state, errorHandler } = setup();

      const failed = await removeOrphanedNodes({
        orphanedNodes: [node('a'), node('b')],
        state,
      });

      expect(failed).toEqual([]);
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('with a result callback', () => {
    test('reports every node as it happens: successes with the node, failures as an error that names it', async () => {
      const { state, errorHandler } = setup();
      failFor('b');
      const nodes = [node('a'), node('b'), node('c')];
      const resultCallback = jest.fn();

      const failed = await removeOrphanedNodes({
        orphanedNodes: nodes,
        resultCallback,
        state,
      });

      expect(failed).toEqual([nodes[1]]);
      expect(resultCallback).toHaveBeenCalledTimes(3);
      expect(resultCallback).toHaveBeenNthCalledWith(1, undefined, nodes[0]);
      expect(resultCallback).toHaveBeenNthCalledWith(3, undefined, nodes[2]);
      const [error, result] = resultCallback.mock.calls[1] as [any, unknown];
      expect(result).toBeUndefined();
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe(
        'Failed to delete orphaned node b (ScriptedDecisionNode v1.0)'
      );
      // deleteNode wraps the failed request in a FrodoError (frodo-lib#1033)
      expect(error.originalErrors[0].message).toBe(
        'Error deleting ScriptedDecisionNode node b'
      );
      expect(error.originalErrors[0].originalErrors[0].message).toBe(
        'delete of b refused'
      );
    });

    test('does not print the error of a failed node', async () => {
      const { state, errorHandler } = setup();
      failFor('a', 'b');

      const failed = await removeOrphanedNodes({
        orphanedNodes: [node('a'), node('b')],
        resultCallback: jest.fn(),
        state,
      });

      expect(failed).toHaveLength(2);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    test('does not report a failed node a second time as a success', async () => {
      const { state } = setup();
      failFor('a');
      const resultCallback = jest.fn();

      await removeOrphanedNodes({
        orphanedNodes: [node('a')],
        resultCallback,
        state,
      });

      expect(resultCallback).toHaveBeenCalledTimes(1);
      expect(resultCallback.mock.calls[0][1]).toBeUndefined();
    });
  });

  test('the facade passes the callback on', async () => {
    const { state, errorHandler } = setup();
    failFor('a');
    const resultCallback = jest.fn();

    const failed = await NodeOps(state).removeOrphanedNodes(
      [node('a'), node('b')],
      resultCallback
    );

    expect(failed).toHaveLength(1);
    expect(resultCallback).toHaveBeenCalledTimes(2);
    expect(errorHandler).not.toHaveBeenCalled();
  });

  test('deletes the nodes in the same order with and without a callback: page nodes last, duplicates once', async () => {
    const nodes = [node('page', 'PageNode'), node('a'), node('a'), node('b')];
    for (const resultCallback of [undefined, jest.fn()]) {
      deleteNode.mockClear();
      const { state } = setup();

      await removeOrphanedNodes({
        orphanedNodes: nodes,
        resultCallback,
        state,
      });

      expect(
        deleteNode.mock.calls.map(([args]) => (args as any).nodeId)
      ).toEqual(['a', 'b', 'page']);
    }
  });
});
