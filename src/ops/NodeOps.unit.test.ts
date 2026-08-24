import { jest } from '@jest/globals';

const getNodeSchema = jest.fn(async (_args?: any): Promise<any> => ({}));
const getCustomNodeSchema = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/NodeApi', () => ({
  createCustomNode: jest.fn(),
  createNode: jest.fn(),
  deleteCustomNode: jest.fn(),
  deleteNode: jest.fn(),
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
  getNodeSchema,
  getCustomNodeSchema,
  requireVersion: jest.fn(() => false),
}));

const { readNodeSchema, readCustomNodeSchema } = await import('./NodeOps');

function mockState() {
  return {
    getDeploymentType: () => 'cloud',
    getDebugHandler: () => undefined,
  } as any;
}

describe('readNodeSchema', () => {
  beforeEach(() => {
    getNodeSchema.mockReset();
    getNodeSchema.mockResolvedValue({ type: 'object', properties: {} });
  });

  test('fetches and caches schema per nodeType/version', async () => {
    const state = mockState();

    const first = await readNodeSchema({
      nodeType: 'PasswordCollectorNode',
      nodeTypeVersion: '2.0',
      state,
    });
    const second = await readNodeSchema({
      nodeType: 'PasswordCollectorNode',
      nodeTypeVersion: '2.0',
      state,
    });

    expect(first).toEqual({ type: 'object', properties: {} });
    expect(second).toEqual(first);
    expect(getNodeSchema).toHaveBeenCalledTimes(1);
    expect(getNodeSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeType: 'PasswordCollectorNode',
        nodeTypeVersion: '2.0',
      })
    );
  });

  test('refreshCache bypasses the cache and re-fetches', async () => {
    const state = mockState();

    await readNodeSchema({ nodeType: 'UsernameCollectorNode', state });
    await readNodeSchema({
      nodeType: 'UsernameCollectorNode',
      refreshCache: true,
      state,
    });

    expect(getNodeSchema).toHaveBeenCalledTimes(2);
  });

  test('wraps API errors in a FrodoError', async () => {
    getNodeSchema.mockRejectedValue(new Error('boom'));

    await expect(
      readNodeSchema({ nodeType: 'BrokenNode', state: mockState() })
    ).rejects.toThrow(/Error reading schema for node type BrokenNode/);
  });
});

describe('readCustomNodeSchema', () => {
  beforeEach(() => {
    getCustomNodeSchema.mockReset();
    getCustomNodeSchema.mockResolvedValue({ type: 'object', properties: {} });
  });

  test('fetches and caches schema per custom node service name', async () => {
    const state = mockState();

    await readCustomNodeSchema({ serviceName: 'my-custom-node', state });
    await readCustomNodeSchema({ serviceName: 'my-custom-node', state });

    expect(getCustomNodeSchema).toHaveBeenCalledTimes(1);
    expect(getCustomNodeSchema).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: 'my-custom-node' })
    );
  });

  test('wraps API errors in a FrodoError', async () => {
    getCustomNodeSchema.mockRejectedValue(new Error('boom'));

    await expect(
      readCustomNodeSchema({ serviceName: 'broken-node', state: mockState() })
    ).rejects.toThrow(/Error reading schema for custom node broken-node/);
  });
});
