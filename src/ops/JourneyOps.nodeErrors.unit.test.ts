/**
 * Run tests
 *
 *        npm run test:only JourneyOps.nodeErrors
 *
 * The journey import and delete read the answer of the server from the error of a node operation (frodo-lib#1033):
 *
 * - a node that AM refuses with "Invalid attribute specified." is sent again without the attributes AM does not know,
 * - "Data validation failed for the attribute, Script" is reported as a missing script,
 * - a node type that does not exist (404) is reported as such,
 * - deleting a container node that AM answers with "Unable to read SMS config: Node did not exist" counts as deleted.
 *
 * The node operations are ops functions (updateNode, deleteNode) that wrap a failed request in a FrodoError, so the
 * answer must be read from the wrapped error. The mocked node operations throw what the real ones throw: a FrodoError
 * that wraps the error axios raised.
 *
 * Mocked unit test: no recordings, no tenant.
 */
import { jest } from '@jest/globals';
import { FrodoError } from './FrodoError';

const getTree = jest.fn(async (_args?: any): Promise<any> => ({}));
const deleteTree = jest.fn(async (_args?: any): Promise<any> => ({}));
const putTree = jest.fn(async (_args?: any): Promise<any> => ({}));
const updateNode = jest.fn(async (_args?: any): Promise<any> => ({}));
const deleteNode = jest.fn(async (_args?: any): Promise<any> => ({}));
const readNode = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/TreeApi', () => ({
  deleteTree,
  getTree,
  getTrees: jest.fn(async () => ({ result: [] })),
  getTreesCount: jest.fn(),
  putTree,
}));

jest.unstable_mockModule('./NodeOps', () => ({
  importCustomNodes: jest.fn(),
  readCustomNode: jest.fn(),
  readNode,
  readNodes: jest.fn(),
  updateNode,
  deleteNode,
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

const { importJourney, deleteJourney } = await import('./JourneyOps');

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

/** What a node operation throws for an answer of the server: a FrodoError that wraps the error axios raised. */
function wrappedAnswer(status: number, data: Record<string, unknown>) {
  const answer: any = new Error(`Request failed with status code ${status}`);
  answer.name = 'AxiosError';
  answer.response = { status, data };
  return new FrodoError('Error updating node', answer);
}

/** A journey with one node, and optionally one inner node, both with an attribute AM does not know. */
function journeyExport(withInnerNode: boolean): any {
  return {
    tree: {
      _id: 'Sample',
      entryNodeId: 'node',
      nodes: {
        node: {
          nodeType: 'DecisionNode',
          version: '1.0',
          connections: { done: TERMINAL },
        },
      },
      staticNodes: {},
    },
    nodes: {
      node: {
        _id: 'node',
        _type: { _id: 'DecisionNode', version: '1.0' },
        _outcomes: [{ id: 'done' }],
        script: 'sample-script',
        unknownAttribute: true,
      },
    },
    innerNodes: withInnerNode
      ? {
          inner: {
            _id: 'inner',
            _type: { _id: 'PageNodeChild', version: '1.0' },
            script: 'sample-script',
            unknownAttribute: true,
          },
        }
      : {},
  };
}

/** The node whose update is refused: the inner node when there is one, otherwise the only node. */
const refusedNodeId = (withInnerNode: boolean) =>
  withInnerNode ? 'inner' : 'node';

beforeEach(() => {
  for (const mock of [
    getTree,
    deleteTree,
    putTree,
    updateNode,
    deleteNode,
    readNode,
  ])
    mock.mockReset();
  putTree.mockImplementation(async ({ treeData }: any) => treeData);
  updateNode.mockResolvedValue({});
});

describe.each([
  ['a node', false],
  ['an inner node', true],
])('importJourney: %s whose update is refused', (_name, withInnerNode) => {
  test('1: "Invalid attribute specified." sends the node again without the unknown attributes', async () => {
    // the import removes the attributes from the object it sent: keep what was sent
    const sent: any[] = [];
    updateNode.mockImplementation(async ({ nodeId, nodeData }: any) => {
      if (nodeId !== refusedNodeId(withInnerNode)) return nodeData;
      sent.push(JSON.parse(JSON.stringify(nodeData)));
      if ('unknownAttribute' in nodeData)
        throw wrappedAnswer(400, {
          message: 'Invalid attribute specified.',
          detail: { validAttributes: ['_type', 'script'] },
        });
      return nodeData;
    });

    await importJourney({
      importData: journeyExport(withInnerNode),
      options: { reUuid: false, deps: false },
      state,
    });

    expect(sent).toHaveLength(2);
    expect(sent[0]).toHaveProperty('unknownAttribute');
    expect(sent[1]).not.toHaveProperty('unknownAttribute');
    expect(sent[1]).toHaveProperty('script', 'sample-script');
  });

  test('2: "Data validation failed for the attribute, Script" is reported as a missing script', async () => {
    updateNode.mockRejectedValue(
      wrappedAnswer(400, {
        message: 'Data validation failed for the attribute, Script',
      })
    );

    await expect(
      importJourney({
        importData: journeyExport(withInnerNode),
        options: { reUuid: false, deps: false },
        state,
      })
    ).rejects.toMatchObject({
      name: 'FrodoError',
      originalErrors: [
        expect.objectContaining({
          message: expect.stringMatching(
            /Missing alpha realm script sample-script referenced by/
          ),
        }),
      ],
    });
  });

  test('3: a node type that does not exist (404) is reported as such', async () => {
    updateNode.mockRejectedValue(wrappedAnswer(404, { message: 'Not Found' }));

    await expect(
      importJourney({
        importData: journeyExport(withInnerNode),
        options: { reUuid: false, deps: false },
        state,
      })
    ).rejects.toMatchObject({
      name: 'FrodoError',
      originalErrors: [
        expect.objectContaining({
          message: expect.stringMatching(/doesn't exist in deployment/),
        }),
      ],
    });
  });
});

describe('deleteJourney with deep', () => {
  const containerNodeId = 'container';

  function arrangeContainer() {
    // the journey is gone after the delete: the check that it is gone gets a 404
    const notFound: any = new Error('Request failed with status code 404');
    notFound.name = 'AxiosError';
    notFound.isAxiosError = true;
    notFound.response = { status: 404, data: {} };
    getTree.mockRejectedValue(notFound);
    deleteTree.mockResolvedValue({
      nodes: { [containerNodeId]: { nodeType: 'PageNode', version: '1.0' } },
    });
    readNode.mockResolvedValue({
      _id: containerNodeId,
      _type: { _id: 'PageNode' },
      nodes: [],
    });
  }

  test('4: "Unable to read SMS config: Node did not exist" counts as deleted', async () => {
    arrangeContainer();
    deleteNode.mockRejectedValue(
      wrappedAnswer(500, {
        code: 500,
        message: 'Unable to read SMS config: Node did not exist',
      })
    );

    const status = await deleteJourney({
      journeyId: 'Sample',
      options: { deep: true, verbose: false, progress: false },
      state,
    });

    expect(status.nodes[containerNodeId]).toEqual({ status: 'success' });
  });

  test('5: any other failure to delete the container node is an error of the node', async () => {
    arrangeContainer();
    deleteNode.mockRejectedValue(
      wrappedAnswer(500, { code: 500, message: 'Something else' })
    );

    const status = await deleteJourney({
      journeyId: 'Sample',
      options: { deep: true, verbose: false, progress: false },
      state,
    });

    expect(status.nodes[containerNodeId]).toMatchObject({ status: 'error' });
  });
});
