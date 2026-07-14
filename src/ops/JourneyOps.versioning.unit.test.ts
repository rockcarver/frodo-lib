import { jest } from '@jest/globals';

const updateNodeMock: any = jest.fn();
const putTreeMock: any = jest.fn();

jest.unstable_mockModule('../api/TreeApi', () => ({
  deleteTree: jest.fn(),
  getTree: jest.fn(),
  getTrees: jest.fn(),
  getTreesCount: jest.fn(),
  putTree: putTreeMock,
}));

jest.unstable_mockModule('./NodeOps', () => ({
  importCustomNodes: jest.fn(),
  isCloudOnlyNode: jest.fn(() => false),
  isCustomNode: jest.fn(() => false),
  isPremiumNode: jest.fn(() => false),
  readCustomNode: jest.fn(),
  readNode: jest.fn(),
  updateNode: updateNodeMock,
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

jest.unstable_mockModule('../utils/ForgeRockUtils', () => ({
  applyNameCollisionPolicy: jest.fn((name: string) => name),
  getConfigPath: jest.fn(() => 'realm-config'),
  getHostOnlyUrl: jest.fn((url: string) => url),
  getCurrentRealmManagedUser: jest.fn(() => 'alpha_user'),
  getCurrentRealmName: jest.fn(() => 'alpha'),
  getCurrentRealmPath: jest.fn(() => '/realms/root/realms/alpha'),
  getIdmBaseUrl: jest.fn(() => 'https://example.com/openidm'),
  getRealmPath: jest.fn(() => '/realms/root/realms/alpha'),
  getRealmPathGlobal: jest.fn(() => '/realms/root/realms/alpha'),
  getRealmName: jest.fn((realm: string) => realm),
  getRealmsForExport: jest.fn(async () => ['root']),
  getRealmUsingExportFormat: jest.fn((realm: string) => realm),
}));

const JourneyOps = await import('./JourneyOps');

beforeEach(() => {
  jest.clearAllMocks();
  updateNodeMock.mockResolvedValue({});
  putTreeMock.mockImplementation(
    async ({ treeData }: { treeData: any }) => treeData
  );
});

describe('JourneyOps versioning unit coverage', () => {
  test('importJourney forwards nodeTypeVersion from inner nodes and nodes', async () => {
    const state = {
      getVerbose: () => false,
      getDeploymentType: () => 'onprem',
    } as any;

    const importData = {
      tree: {
        _id: 'JourneyVersioningTest',
        enabled: true,
        entryNodeId: 'node-1',
        innerTreeOnly: false,
        uiConfig: {},
        mustRun: false,
        noSession: false,
        nodes: {},
        staticNodes: {},
      },
      innerNodes: {
        'inner-1': {
          _id: 'inner-1',
          _type: {
            _id: 'ValidatedUsernameNode',
            version: '2.0',
          },
          _outcomes: [{ id: 'outcome', displayName: 'Outcome' }],
          usernameAttribute: 'userName',
          validateInput: false,
        },
      },
      nodes: {
        'node-1': {
          _id: 'node-1',
          _type: {
            _id: 'ValidatedPasswordNode',
            version: '3.0',
          },
          _outcomes: [{ id: 'outcome', displayName: 'Outcome' }],
          passwordAttribute: 'password',
          validateInput: false,
        },
      },
    } as any;

    await JourneyOps.importJourney({
      importData,
      options: {
        reUuid: false,
        deps: false,
      },
      state,
    });

    expect(updateNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'inner-1',
        nodeType: 'ValidatedUsernameNode',
        nodeTypeVersion: '2.0',
        state,
      })
    );
    expect(updateNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'node-1',
        nodeType: 'ValidatedPasswordNode',
        nodeTypeVersion: '3.0',
        state,
      })
    );
  });

  test('resolveDependencies treats Backchannel Initialize as a journey dependency', async () => {
    const unresolvedJourneys = {};
    const resolvedJourneys = [];

    await JourneyOps.resolveDependencies(
      [],
      {
        ParentJourney: {
          nodes: {
            'node-1': {
              _id: 'node-1',
              tree: 'ChildJourney',
              _type: {
                _id: 'BackChannelInitNode',
              },
            },
          },
        },
        ChildJourney: {
          nodes: {},
        },
      } as any,
      unresolvedJourneys,
      resolvedJourneys
    );

    expect(resolvedJourneys).toStrictEqual(['ChildJourney', 'ParentJourney']);
    expect(unresolvedJourneys).toStrictEqual({});
  });

  test('resolveInnerTreeDependencies treats Backchannel Initialize as a journey dependency', async () => {
    const unresolvedJourneys = {};
    const resolvedJourneys = [];

    await JourneyOps.resolveInnerTreeDependencies({
      existingJorneys: [],
      candidateJourneys: {
        ParentJourney: {
          nodes: {
            'node-1': {
              _id: 'node-1',
              tree: 'ChildJourney',
              _type: {
                _id: 'BackChannelInitNode',
              },
            },
          },
        },
        ChildJourney: {
          nodes: {},
        },
      } as any,
      unresolvedJourneys,
      resolvedJourneys,
    });

    expect(unresolvedJourneys).toStrictEqual({});
    expect(resolvedJourneys).toStrictEqual(['ChildJourney', 'ParentJourney']);
  });
});
