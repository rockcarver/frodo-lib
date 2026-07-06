import { jest } from '@jest/globals';

const getMock: any = jest.fn();
const postMock: any = jest.fn();
const putMock: any = jest.fn();
const deleteMock: any = jest.fn();

const generateAmApiMock = jest.fn(() => ({
  get: getMock,
  post: postMock,
  put: putMock,
  delete: deleteMock,
}));

jest.unstable_mockModule('./BaseApi', () => ({
  generateAmApi: generateAmApiMock,
}));

jest.unstable_mockModule('../utils/ForgeRockUtils', () => ({
  getCurrentRealmPath: () => '/realms/root/realms/alpha',
}));

jest.unstable_mockModule('../utils/JsonUtils', () => ({
  deleteDeepByKey: (value: unknown) => value,
}));

const NodeApi = await import('./NodeApi');

const makeState = (amVersion?: string) =>
  ({
    getHost: () => 'https://example.com/am',
    getAmVersion: () => amVersion,
  }) as any;

const nodeType = 'PageNode';
const nodeId = 'node-id-123';
const nodeData = { _id: nodeId, _type: { _id: nodeType } } as any;

// Coverage note:
// - AM < 8.1.0 and unset AM version must use resource 1.0 and unversioned URLs.
// - AM >= 8.1.0 must use resource 3.0 and include /{nodeTypeVersion} in version-aware node URLs.
// - This suite covers every NodeApi function that changed when version support was introduced.

beforeEach(() => {
  jest.clearAllMocks();

  getMock.mockResolvedValue({ data: {} });
  postMock.mockResolvedValue({ data: {} });
  putMock.mockResolvedValue({ data: {} });
  deleteMock.mockResolvedValue({ data: {} });
});

describe('NodeApi versioning unit coverage', () => {
  test('requireVersion covers unset, below, equal and above threshold', () => {
    expect(NodeApi.requireVersion(makeState(undefined))).toBe(false);
    expect(NodeApi.requireVersion(makeState('8.0.9'))).toBe(false);
    expect(NodeApi.requireVersion(makeState('8.1.0'))).toBe(true);
    expect(NodeApi.requireVersion(makeState('8.1.1'))).toBe(true);
  });

  test('getNodeVersionPathSegment covers explicit and default version paths', () => {
    expect(
      NodeApi.getNodeVersionPathSegment({
        nodeTypeVersion: '2.0',
        state: makeState('8.1.0'),
      })
    ).toBe('/2.0');
    expect(
      NodeApi.getNodeVersionPathSegment({
        state: makeState('8.1.0'),
      })
    ).toBe('/1.0');
    expect(
      NodeApi.getNodeVersionPathSegment({
        nodeTypeVersion: '2.0',
        state: makeState('8.0.9'),
      })
    ).toBe('');
    expect(
      NodeApi.getNodeVersionPathSegment({
        nodeTypeVersion: '2.0',
        state: makeState(undefined),
      })
    ).toBe('');
  });

  test('getNodeTypes uses resource 1.0 below threshold and 3.0 at/above threshold', async () => {
    await NodeApi.getNodeTypes({ state: makeState('8.0.9') });
    await NodeApi.getNodeTypes({ state: makeState('8.1.0') });

    expect(generateAmApiMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        resource: { apiVersion: 'protocol=2.1,resource=1.0' },
      })
    );
    expect(generateAmApiMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        resource: { apiVersion: 'protocol=2.1,resource=3.0' },
      })
    );
  });

  test('getNodeType covers explicit and default nodeTypeVersion path', async () => {
    await NodeApi.getNodeType({
      nodeType,
      nodeTypeVersion: '2.0',
      state: makeState('8.1.0'),
    });
    await NodeApi.getNodeType({
      nodeType,
      state: makeState('8.1.0'),
    });

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/2.0?_action=getType',
      {},
      expect.any(Object)
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/1.0?_action=getType',
      {},
      expect.any(Object)
    );
  });

  test('getNodesByType includes version path only when version support is enabled', async () => {
    await NodeApi.getNodesByType({
      nodeType,
      nodeTypeVersion: '2.0',
      state: makeState('8.1.0'),
    });
    await NodeApi.getNodesByType({
      nodeType,
      nodeTypeVersion: '2.0',
      state: makeState('8.0.9'),
    });

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/2.0?_queryFilter=true',
      expect.any(Object)
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode?_queryFilter=true',
      expect.any(Object)
    );
  });

  test('getNode includes version path only when version support is enabled', async () => {
    await NodeApi.getNode({
      nodeId,
      nodeType,
      nodeTypeVersion: '2.0',
      state: makeState('8.1.0'),
    });
    await NodeApi.getNode({
      nodeId,
      nodeType,
      nodeTypeVersion: '2.0',
      state: makeState('8.0.9'),
    });

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/2.0/node-id-123',
      expect.any(Object)
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/node-id-123',
      expect.any(Object)
    );
  });

  test('createNode includes version path only when version support is enabled', async () => {
    await NodeApi.createNode({
      nodeType,
      nodeTypeVersion: '2.0',
      nodeData,
      state: makeState('8.1.0'),
    });
    await NodeApi.createNode({
      nodeType,
      nodeTypeVersion: '2.0',
      nodeData,
      state: makeState('8.0.9'),
    });

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/2.0?_action=create',
      nodeData,
      expect.any(Object)
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode?_action=create',
      nodeData,
      expect.any(Object)
    );
  });

  test('getNodeSchema includes version path only when version support is enabled', async () => {
    await NodeApi.getNodeSchema({
      nodeType,
      nodeTypeVersion: '2.0',
      state: makeState('8.1.0'),
    });
    await NodeApi.getNodeSchema({
      nodeType,
      nodeTypeVersion: '2.0',
      state: makeState('8.0.9'),
    });

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/2.0?_action=schema',
      {},
      expect.any(Object)
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode?_action=schema',
      {},
      expect.any(Object)
    );
  });

  test('putNode includes version path only when version support is enabled', async () => {
    await NodeApi.putNode({
      nodeId,
      nodeType,
      nodeTypeVersion: '2.0',
      nodeData,
      state: makeState('8.1.0'),
    });
    await NodeApi.putNode({
      nodeId,
      nodeType,
      nodeTypeVersion: '2.0',
      nodeData,
      state: makeState('8.0.9'),
    });

    expect(putMock).toHaveBeenNthCalledWith(
      1,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/2.0/node-id-123',
      nodeData,
      expect.any(Object)
    );
    expect(putMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/node-id-123',
      nodeData,
      expect.any(Object)
    );
  });

  test('deleteNode includes version path only when version support is enabled', async () => {
    await NodeApi.deleteNode({
      nodeId,
      nodeType,
      nodeTypeVersion: '2.0',
      state: makeState('8.1.0'),
    });
    await NodeApi.deleteNode({
      nodeId,
      nodeType,
      nodeTypeVersion: '2.0',
      state: makeState('8.0.9'),
    });

    expect(deleteMock).toHaveBeenNthCalledWith(
      1,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/2.0/node-id-123',
      expect.any(Object)
    );
    expect(deleteMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/node-id-123',
      expect.any(Object)
    );
  });

  test('getCustomNodeSchema delegates to getNodeSchema with version 1.0', async () => {
    await NodeApi.getCustomNodeSchema({
      serviceName: 'my-service',
      state: makeState('8.1.0'),
    });

    expect(postMock).toHaveBeenCalledWith(
      'https://example.com/am/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/designer-my-service/1.0?_action=schema',
      {},
      expect.any(Object)
    );
  });
});
