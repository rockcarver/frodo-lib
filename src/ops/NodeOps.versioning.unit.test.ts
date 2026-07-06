import { jest } from '@jest/globals';

const getNodeTypesMock: any = jest.fn();
const getNodesByTypeMock: any = jest.fn();
const requireVersionMock: any = jest.fn();

jest.unstable_mockModule('../api/NodeApi', () => ({
  createCustomNode: jest.fn(),
  createNode: jest.fn(),
  deleteCustomNode: jest.fn(),
  deleteNode: jest.fn(),
  getCustomNode: jest.fn(),
  getCustomNodes: jest.fn(),
  getCustomNodeSchema: jest.fn(),
  getCustomNodeUsage: jest.fn(),
  getNode: jest.fn(),
  getNodes: jest.fn(),
  getNodesByType: getNodesByTypeMock,
  getNodeType: jest.fn(),
  getNodeTypes: getNodeTypesMock,
  putCustomNode: jest.fn(),
  putNode: jest.fn(),
  requireVersion: requireVersionMock,
}));

const NodeOps = await import('./NodeOps');

const state = {} as any;

const makeNode = (nodeType: string, nodeTypeVersion = '1.0') => ({
  _id: `${nodeType}-${nodeTypeVersion}`,
  _type: {
    _id: nodeType,
    name: nodeType,
    collection: true,
    version: nodeTypeVersion,
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  requireVersionMock.mockReturnValue(true);
  getNodesByTypeMock.mockImplementation(
    async ({
      nodeType,
      nodeTypeVersion,
    }: {
      nodeType: string;
      nodeTypeVersion?: string;
    }) => ({
      result: [makeNode(nodeType, nodeTypeVersion)],
    })
  );
});

describe('NodeOps readNodesByVersion unit coverage', () => {
  test('method is implemented', () => {
    expect(NodeOps.readNodesByVersion).toBeDefined();
  });

  test('reads nodes by exact version 2.0', async () => {
    getNodeTypesMock.mockResolvedValue({
      result: [
        { _id: 'PageNode', versions: ['1.0', '2.0'] },
        { _id: 'ValidatedUsernameNode', versions: ['2.0'] },
      ],
    });

    const response = await NodeOps.readNodesByVersion({
      nodeVersionFilter: { eq: '2.0' },
      state,
    });

    expect(response).toHaveLength(2);
    expect(response.map((node: any) => node._id).sort()).toEqual([
      'PageNode-2.0',
      'ValidatedUsernameNode-2.0',
    ]);
  });

  test('reads nodes by version range [2.0, 3.0)', async () => {
    getNodeTypesMock.mockResolvedValue({
      result: [
        { _id: 'PageNode', versions: ['1.0', '2.0'] },
        { _id: 'ValidatedUsernameNode', versions: ['2.0'] },
        { _id: 'LegacyNode', versions: ['0.9'] },
      ],
    });

    const response = await NodeOps.readNodesByVersion({
      nodeVersionFilter: { gte: '2.0', lt: '3.0' },
      state,
    });

    expect(response).toHaveLength(2);
    expect(response.map((node: any) => node._id).sort()).toEqual([
      'PageNode-2.0',
      'ValidatedUsernameNode-2.0',
    ]);
  });

  test('returns empty set when versioned API is unavailable and filter excludes 1.0', async () => {
    requireVersionMock.mockReturnValue(false);
    getNodeTypesMock.mockResolvedValue({
      result: [
        { _id: 'PageNode', versions: ['1.0', '2.0'] },
        { _id: 'ValidatedUsernameNode', versions: ['2.0'] },
      ],
    });

    const response = await NodeOps.readNodesByVersion({
      nodeVersionFilter: { eq: '2.0' },
      state,
    });

    expect(response).toEqual([]);
    expect(getNodesByTypeMock).not.toHaveBeenCalled();
  });

  test('continues when one type-version request fails', async () => {
    getNodeTypesMock.mockResolvedValue({
      result: [
        { _id: 'PageNode', versions: ['2.0'] },
        { _id: 'BrokenNode', versions: ['2.0'] },
      ],
    });
    getNodesByTypeMock.mockImplementation(
      async ({
        nodeType,
        nodeTypeVersion,
      }: {
        nodeType: string;
        nodeTypeVersion?: string;
      }) => {
        if (nodeType === 'BrokenNode') {
          throw new Error('boom');
        }
        return {
          result: [makeNode(nodeType, nodeTypeVersion)],
        };
      }
    );

    const response = await NodeOps.readNodesByVersion({
      nodeVersionFilter: { eq: '2.0' },
      state,
    });

    expect(response).toHaveLength(1);
    expect(response[0]._id).toBe('PageNode-2.0');
  });

  test('normalizes object-map type payloads and trims blank versions', async () => {
    getNodeTypesMock.mockResolvedValue({
      result: {
        one: { _id: 'PageNode', versions: [' 2.0 ', ''] },
      },
    });

    const response = await NodeOps.readNodesByVersion({
      nodeVersionFilter: { eq: '2.0.0' },
      state,
    });

    expect(response).toHaveLength(1);
    expect(getNodesByTypeMock).toHaveBeenCalledWith({
      nodeType: 'PageNode',
      nodeTypeVersion: '2.0',
      state,
    });
  });
});
