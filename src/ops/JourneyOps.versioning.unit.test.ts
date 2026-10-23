import { jest } from '@jest/globals';

const getTreeMock: any = jest.fn();
const getTreesMock: any = jest.fn();
const readNodeMock: any = jest.fn();
const updateNodeMock: any = jest.fn();
const putTreeMock: any = jest.fn();
const printMessageMock: any = jest.fn();

jest.unstable_mockModule('../api/TreeApi', () => ({
  deleteTree: jest.fn(),
  getTree: getTreeMock,
  getTrees: getTreesMock,
  getTreesCount: jest.fn(),
  putTree: putTreeMock,
}));

jest.unstable_mockModule('./NodeOps', () => ({
  importCustomNodes: jest.fn(),
  readCustomNode: jest.fn(),
  readNode: readNodeMock,
  readNodes: jest.fn(),
  updateNode: updateNodeMock,
  deleteNode: jest.fn(),
}));

jest.unstable_mockModule('../utils/Console', () => ({
  createProgressIndicator: jest.fn(),
  debugMessage: jest.fn(),
  printMessage: printMessageMock,
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

function validationState(): any {
  return {
    getVerbose: () => false,
    getDeploymentType: () => 'onprem',
    getHost: () => 'https://example.com/am',
    getAmVersion: () => '9.0.0',
    getUsername: () => 'alpha_user',
    getFrodoVersion: () => 'v4.0.0-test',
  };
}

function journeyExport(
  journeyId: string,
  targetNodeId: string = '70e691a5-1e33-4ac3-a356-e7b6d60d92e0'
): any {
  return {
    tree: {
      _id: journeyId,
      entryNodeId: 'node',
      nodes: {
        node: {
          nodeType: 'DecisionNode',
          version: '1.0',
          connections: { done: targetNodeId },
        },
      },
      staticNodes: {},
    },
    nodes: {
      node: {
        _id: 'node',
        _type: { _id: 'DecisionNode', version: '1.0' },
        _outcomes: [{ id: 'done' }],
      },
    },
    innerNodes: {},
  };
}

function multiJourneyExport(): any {
  return {
    trees: {
      HealthyJourney: journeyExport('HealthyJourney'),
      BrokenJourney: journeyExport('BrokenJourney', 'missing-target'),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getTreeMock.mockReset();
  getTreesMock.mockReset();
  readNodeMock.mockReset();
  updateNodeMock.mockResolvedValue({});
  putTreeMock.mockImplementation(
    async ({ treeData }: { treeData: any }) => treeData
  );
});

describe('JourneyOps versioning unit coverage', () => {
  test('importJourney rejects invalid references before writing nodes or trees', async () => {
    const state = {
      getVerbose: () => false,
      getDeploymentType: () => 'onprem',
    } as any;
    const importData = {
      tree: {
        _id: 'InvalidJourney',
        entryNodeId: 'missing-entry',
        nodes: {},
        staticNodes: {},
      },
      nodes: {},
      innerNodes: {},
    } as any;

    let caughtError: any;
    try {
      await JourneyOps.importJourney({
        importData,
        options: { reUuid: false, deps: false },
        state,
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError.toString()).toContain('[MISSING_ENTRY_NODE]');
    expect(updateNodeMock).not.toHaveBeenCalled();
    expect(putTreeMock).not.toHaveBeenCalled();
  });

  test('importJourney can skip validation for a known imperfect journey', async () => {
    const state = {
      getVerbose: () => false,
      getDeploymentType: () => 'onprem',
    } as any;
    const importData = {
      tree: {
        _id: 'KnownImperfectJourney',
        entryNodeId: 'missing-entry',
        nodes: {},
        staticNodes: {},
      },
      nodes: {},
      innerNodes: {},
    } as any;

    await JourneyOps.importJourney({
      importData,
      options: { reUuid: false, deps: false, validate: false },
      state,
    });

    expect(putTreeMock).toHaveBeenCalled();
  });

  test('importJourney and importJourneys summarize warnings consistently', async () => {
    const state = {
      getVerbose: () => false,
      getDeploymentType: () => 'onprem',
    } as any;
    const journey = {
      tree: {
        _id: 'WarnedJourney',
        entryNodeId: 'missing-entry',
        nodes: {
          node: { connections: {} },
        },
        staticNodes: {},
      },
      nodes: {
        node: {
          _id: 'node',
          _type: { _id: 'DecisionNode' },
          _outcomes: [{ id: 'unconnected' }],
        },
      },
      innerNodes: {},
    } as any;
    const options = { reUuid: false, deps: false };

    await expect(
      JourneyOps.importJourney({ importData: journey, options, state })
    ).rejects.toThrow("Error importing alpha realm journey 'WarnedJourney'");
    const singleImportMessage = printMessageMock.mock.calls.find(
      ([args]: any[]) => args.message === '2 warnings in journey WarnedJourney'
    )?.[0];

    printMessageMock.mockClear();
    await expect(
      JourneyOps.importJourneys({
        importData: { trees: { WarnedJourney: journey } },
        options,
        state,
      })
    ).rejects.toThrow(
      "Error importing alpha realm journey 'WarnedJourney':\n  - [MISSING_ENTRY_NODE]"
    );
    const bulkImportMessage = printMessageMock.mock.calls.find(
      ([args]: any[]) => args.message === '2 warnings in journey WarnedJourney'
    )?.[0];

    expect(singleImportMessage).toMatchObject({ type: 'warn' });
    expect(bulkImportMessage).toMatchObject({ type: 'warn' });
  });

  test('importJourneys warns when an export key differs from the tree _id', async () => {
    const state = {
      getVerbose: () => false,
      getDeploymentType: () => 'onprem',
    } as any;
    const journey = journeyExport('RealId');
    journey.tree.entryNodeId = 'missing-entry';

    await expect(
      JourneyOps.importJourneys({
        importData: { trees: { WrongKey: journey } },
        options: { reUuid: false, deps: false },
        state,
      })
    ).rejects.toThrow('[MISSING_ENTRY_NODE]');

    expect(printMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '1 warning in journey WrongKey',
        type: 'warn',
      })
    );
  });

  test('importJourneys names all journeys with validation errors', async () => {
    const invalidJourney = (journeyId: string) => ({
      tree: {
        _id: journeyId,
        entryNodeId: 'missing-entry',
        nodes: {},
        staticNodes: {},
      },
      nodes: {},
      innerNodes: {},
    });

    await expect(
      JourneyOps.importJourneys({
        importData: {
          trees: {
            FirstJourney: invalidJourney('FirstJourney'),
            SecondJourney: invalidJourney('SecondJourney'),
          },
        },
        options: { reUuid: false, deps: false },
        state: {
          getVerbose: () => false,
          getDeploymentType: () => 'onprem',
        } as any,
      })
    ).rejects.toThrow(
      "Error importing alpha realm journeys 'FirstJourney', 'SecondJourney':"
    );
    expect(getTreesMock).not.toHaveBeenCalled();
  });

  test('validateJourneys reads all live journeys and returns findings silently', async () => {
    getTreesMock.mockResolvedValue({
      result: [{ _id: 'HealthyJourney' }, { _id: 'BrokenJourney' }],
    });
    getTreeMock.mockImplementation(
      async ({ id }: { id: string }) =>
        journeyExport(
          id,
          id === 'BrokenJourney' ? 'missing-target' : 'startNode'
        ).tree
    );
    readNodeMock.mockImplementation(
      async ({ nodeId }: { nodeId: string }) =>
        journeyExport('ignored').nodes[nodeId]
    );

    const result = JourneyOps.validateJourneys({
      state: validationState(),
    });
    expect(result).toBeInstanceOf(Promise);
    const findings = await result;

    expect(findings).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_CONNECTION_TARGET',
        severity: 'error',
        journeyId: 'BrokenJourney',
        targetNodeId: 'missing-target',
      })
    );
    expect(getTreesMock).toHaveBeenCalledTimes(1);
    expect(getTreeMock).toHaveBeenCalledTimes(2);
    expect(printMessageMock).not.toHaveBeenCalled();
  });

  test('validateJourneys reads only requested live journeys and removes duplicate IDs', async () => {
    getTreeMock.mockImplementation(
      async ({ id }: { id: string }) => journeyExport(id, 'missing-target').tree
    );
    readNodeMock.mockImplementation(
      async ({ nodeId }: { nodeId: string }) =>
        journeyExport('ignored').nodes[nodeId]
    );

    const findings = await JourneyOps.validateJourneys({
      journeyIds: ['BrokenJourney', 'BrokenJourney'],
      state: validationState(),
    });

    expect(
      findings.filter((finding) => finding.code === 'MISSING_CONNECTION_TARGET')
    ).toHaveLength(1);
    expect(getTreesMock).not.toHaveBeenCalled();
    expect(getTreeMock).toHaveBeenCalledTimes(1);
    expect(printMessageMock).not.toHaveBeenCalled();
  });

  test.each([undefined, null, []])(
    'validateJourneys treats %s as all journeys in offline mode',
    async (journeyIds) => {
      const findings = await JourneyOps.validateJourneys({
        journeyIds: journeyIds as string[] | undefined,
        journeysExport: multiJourneyExport(),
        state: validationState(),
      });

      expect(findings).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_CONNECTION_TARGET',
          journeyId: 'BrokenJourney',
        })
      );
      expect(getTreesMock).not.toHaveBeenCalled();
      expect(getTreeMock).not.toHaveBeenCalled();
      expect(readNodeMock).not.toHaveBeenCalled();
      expect(printMessageMock).not.toHaveBeenCalled();
    }
  );

  test('validateJourneys validates only requested journeys in an export', async () => {
    const findings = await JourneyOps.validateJourneys({
      journeyIds: ['BrokenJourney', 'BrokenJourney'],
      journeysExport: multiJourneyExport(),
      state: validationState(),
    });

    expect(
      findings.filter((finding) => finding.code === 'MISSING_CONNECTION_TARGET')
    ).toHaveLength(1);
    expect(findings).toContainEqual(
      expect.objectContaining({ journeyId: 'BrokenJourney' })
    );
    expect(findings).not.toContainEqual(
      expect.objectContaining({ journeyId: 'HealthyJourney' })
    );
    expect(getTreesMock).not.toHaveBeenCalled();
    expect(getTreeMock).not.toHaveBeenCalled();
    expect(printMessageMock).not.toHaveBeenCalled();
  });

  test('validateJourneys reports tree IDs that do not match export keys', async () => {
    const journeys = multiJourneyExport();
    journeys.trees.HealthyJourney.tree._id = 'DifferentJourneyId';

    const selectedFindings = await JourneyOps.validateJourneys({
      journeyIds: ['HealthyJourney'],
      journeysExport: journeys,
      state: validationState(),
    });

    expect(selectedFindings).toContainEqual(
      expect.objectContaining({
        code: 'TREE_ID_MISMATCH',
        severity: 'warning',
        journeyId: 'HealthyJourney',
      })
    );

    const unselectedFindings = await JourneyOps.validateJourneys({
      journeyIds: ['BrokenJourney'],
      journeysExport: journeys,
      state: validationState(),
    });
    expect(
      unselectedFindings.filter(
        (finding) => finding.code === 'TREE_ID_MISMATCH'
      )
    ).toEqual([]);
  });

  test('validateJourneys ignores malformed unselected export entries', async () => {
    const journeys = multiJourneyExport();
    journeys.trees.UnselectedMalformedJourney = {};

    const findings = await JourneyOps.validateJourneys({
      journeyIds: ['HealthyJourney'],
      journeysExport: journeys,
      state: validationState(),
    });

    expect(findings).toEqual([]);
  });

  test('validateJourneys aggregates missing and blank offline IDs', async () => {
    await expect(
      JourneyOps.validateJourneys({
        journeyIds: ['MissingJourney', ' '],
        journeysExport: multiJourneyExport(),
        state: validationState(),
      })
    ).rejects.toMatchObject({
      name: 'FrodoError',
      message: 'Error validating alpha realm journeys',
      originalErrors: [
        { message: "Error validating alpha realm journey 'MissingJourney'" },
        { message: "Error validating alpha realm journey ' '" },
      ],
    });
    expect(getTreeMock).not.toHaveBeenCalled();
    expect(printMessageMock).not.toHaveBeenCalled();
  });

  test.each(['BrokenJourney', 1, { id: 'BrokenJourney' }])(
    'validateJourneys rejects invalid journeyIds %p before API access',
    async (journeyIds) => {
      await expect(
        JourneyOps.validateJourneys({
          journeyIds: journeyIds as any,
          state: validationState(),
        })
      ).rejects.toMatchObject({
        name: 'FrodoError',
        message: 'Error validating alpha realm journeys',
        originalErrors: [{ message: 'journeyIds must be an array of strings' }],
      });
      expect(getTreesMock).not.toHaveBeenCalled();
      expect(getTreeMock).not.toHaveBeenCalled();
      expect(readNodeMock).not.toHaveBeenCalled();
    }
  );

  test.each([{ tree: {} }, {}, { trees: null }])(
    'validateJourneys rejects malformed journeysExport %p',
    async (journeysExport) => {
      await expect(
        JourneyOps.validateJourneys({
          journeysExport: journeysExport as any,
          state: validationState(),
        })
      ).rejects.toMatchObject({
        name: 'FrodoError',
        message: 'Error validating alpha realm journeys',
        originalErrors: [
          {
            message:
              'journeysExport must contain a trees map (a multi-journey export); wrap a single-journey export as { trees: { <id>: export } }',
          },
        ],
      });
      expect(getTreesMock).not.toHaveBeenCalled();
      expect(getTreeMock).not.toHaveBeenCalled();
      expect(readNodeMock).not.toHaveBeenCalled();
    }
  );

  test('validateJourneys processes remaining live journeys before aggregating lookup failures', async () => {
    getTreeMock.mockImplementation(async ({ id }: { id: string }) => {
      if (id === 'MissingJourney') throw new Error('Journey not found');
      return journeyExport(id, 'missing-target').tree;
    });
    readNodeMock.mockImplementation(
      async ({ nodeId }: { nodeId: string }) =>
        journeyExport('ignored').nodes[nodeId]
    );

    await expect(
      JourneyOps.validateJourneys({
        journeyIds: ['MissingJourney', 'BrokenJourney'],
        state: validationState(),
      })
    ).rejects.toMatchObject({
      name: 'FrodoError',
      message: 'Error validating alpha realm journeys',
      originalErrors: [
        {
          message: "Error validating alpha realm journey 'MissingJourney'",
        },
      ],
    });
    expect(getTreeMock).toHaveBeenCalledTimes(2);
    expect(readNodeMock).toHaveBeenCalledTimes(1);
  });

  test('validateJourneys treats empty and blank live IDs as lookup failures', async () => {
    getTreeMock.mockResolvedValue(journeyExport('HealthyJourney').tree);
    readNodeMock.mockResolvedValue(journeyExport('HealthyJourney').nodes.node);

    await expect(
      JourneyOps.validateJourneys({
        journeyIds: ['', ' ', 'HealthyJourney'],
        state: validationState(),
      })
    ).rejects.toMatchObject({
      name: 'FrodoError',
      message: 'Error validating alpha realm journeys',
      originalErrors: [
        { message: "Error validating alpha realm journey ''" },
        { message: "Error validating alpha realm journey ' '" },
      ],
    });
    expect(getTreesMock).not.toHaveBeenCalled();
    expect(getTreeMock).toHaveBeenCalledTimes(1);
  });

  test('validateJourneys treats null, undefined and empty IDs alike in live mode', async () => {
    for (const journeyIds of [undefined, null, []]) {
      getTreesMock.mockResolvedValue({
        result: [{ _id: 'HealthyJourney' }, { _id: 'BrokenJourney' }],
      });
      getTreeMock.mockImplementation(
        async ({ id }: { id: string }) => journeyExport(id).tree
      );
      readNodeMock.mockImplementation(
        async ({ nodeId }: { nodeId: string }) =>
          journeyExport('ignored').nodes[nodeId]
      );

      await expect(
        JourneyOps.validateJourneys({
          journeyIds: journeyIds as string[] | undefined,
          state: validationState(),
        })
      ).resolves.toEqual([]);
      expect(getTreeMock).toHaveBeenCalledTimes(2);
      getTreeMock.mockClear();
    }
  });

  test('exportJourney includes a tree with invalid references', async () => {
    const state = {
      getVerbose: () => false,
      getDeploymentType: () => 'onprem',
      getHost: () => 'https://example.com/am',
      getAmVersion: () => '9.0.0',
      getUsername: () => 'alpha_user',
      getFrodoVersion: () => 'v4.0.0-test',
    } as any;
    getTreeMock.mockResolvedValue({
      _id: 'InvalidJourney',
      entryNodeId: 'missing-entry',
      nodes: {},
      staticNodes: {},
    });

    const exportData = await JourneyOps.exportJourney({
      journeyId: 'InvalidJourney',
      options: { deps: false, useStringArrays: true, coords: true },
      state,
    });

    expect(exportData.trees.InvalidJourney.tree.entryNodeId).toBe(
      'missing-entry'
    );
    expect(printMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '1 error in journey InvalidJourney',
        type: 'warn',
      })
    );
  });

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
        nodes: {
          'node-1': {
            connections: {},
            displayName: 'Password',
            nodeType: 'ValidatedPasswordNode',
            x: 0,
            y: 0,
          },
        },
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

  test('exportJourney bundles Backchannel Initialize tree dependencies', async () => {
    const state = {
      getVerbose: () => false,
      getDeploymentType: () => 'onprem',
      getHost: () => 'https://example.com/am',
      getAmVersion: () => '9.0.0',
      getUsername: () => 'alpha_user',
      getFrodoVersion: () => 'v4.0.0-test',
    } as any;
    const treeMap: Record<string, any> = {
      ParentJourney: {
        _id: 'ParentJourney',
        enabled: true,
        entryNodeId: 'node-1',
        innerTreeOnly: false,
        mustRun: false,
        noSession: false,
        uiConfig: {},
        nodes: {
          'node-1': {
            nodeType: 'BackChannelInitNode',
            version: '1.0',
          },
        },
        staticNodes: {},
      },
      ChildJourney: {
        _id: 'ChildJourney',
        enabled: true,
        entryNodeId: 'node-2',
        innerTreeOnly: false,
        mustRun: false,
        noSession: false,
        uiConfig: {},
        nodes: {},
        staticNodes: { 'node-2': {} },
      },
    };
    const nodeMap: Record<string, any> = {
      'node-1': {
        _id: 'node-1',
        tree: 'ChildJourney',
        _outcomes: [],
        _type: {
          _id: 'BackChannelInitNode',
        },
      },
    };
    getTreeMock.mockImplementation(async ({ id }: { id: string }) => ({
      ...treeMap[id],
      nodes: { ...treeMap[id].nodes },
      staticNodes: { ...treeMap[id].staticNodes },
    }));
    readNodeMock.mockImplementation(async ({ nodeId }: { nodeId: string }) => ({
      ...nodeMap[nodeId],
    }));

    const response = await JourneyOps.exportJourney({
      journeyId: 'ParentJourney',
      options: {
        deps: true,
        useStringArrays: true,
        coords: true,
      },
      state,
    });

    expect(response).toMatchObject({
      meta: expect.any(Object),
      trees: {
        ChildJourney: {
          tree: { _id: 'ChildJourney' },
        },
        ParentJourney: {
          tree: { _id: 'ParentJourney' },
          nodes: {
            'node-1': {
              tree: 'ChildJourney',
              _type: {
                _id: 'BackChannelInitNode',
              },
            },
          },
        },
      },
    });
    expect(Object.keys((response as any).trees)).toStrictEqual([
      'ChildJourney',
      'ParentJourney',
    ]);
  });

  test('exportJourney bundles InnerTreeEvaluatorNode dependencies', async () => {
    const state = {
      getVerbose: () => false,
      getDeploymentType: () => 'onprem',
      getHost: () => 'https://example.com/am',
      getAmVersion: () => '9.0.0',
      getUsername: () => 'alpha_user',
      getFrodoVersion: () => 'v4.0.0-test',
    } as any;
    const treeMap: Record<string, any> = {
      ParentJourney: {
        _id: 'ParentJourney',
        enabled: true,
        entryNodeId: 'node-1',
        innerTreeOnly: false,
        mustRun: false,
        noSession: false,
        uiConfig: {},
        nodes: {
          'node-1': {
            nodeType: 'InnerTreeEvaluatorNode',
            version: '1.0',
          },
        },
        staticNodes: {},
      },
      ChildJourney: {
        _id: 'ChildJourney',
        enabled: true,
        entryNodeId: 'node-2',
        innerTreeOnly: false,
        mustRun: false,
        noSession: false,
        uiConfig: {},
        nodes: {},
        staticNodes: { 'node-2': {} },
      },
    };
    const nodeMap: Record<string, any> = {
      'node-1': {
        _id: 'node-1',
        tree: 'ChildJourney',
        _outcomes: [],
        _type: {
          _id: 'InnerTreeEvaluatorNode',
        },
      },
    };
    getTreeMock.mockImplementation(async ({ id }: { id: string }) => ({
      ...treeMap[id],
      nodes: { ...treeMap[id].nodes },
      staticNodes: { ...treeMap[id].staticNodes },
    }));
    readNodeMock.mockImplementation(async ({ nodeId }: { nodeId: string }) => ({
      ...nodeMap[nodeId],
    }));

    const response = await JourneyOps.exportJourney({
      journeyId: 'ParentJourney',
      options: {
        deps: true,
        useStringArrays: true,
        coords: true,
      },
      state,
    });

    expect(response).toMatchObject({
      meta: expect.any(Object),
      trees: {
        ChildJourney: {
          tree: { _id: 'ChildJourney' },
        },
        ParentJourney: {
          tree: { _id: 'ParentJourney' },
          nodes: {
            'node-1': {
              tree: 'ChildJourney',
              _type: {
                _id: 'InnerTreeEvaluatorNode',
              },
            },
          },
        },
      },
    });
    expect(Object.keys((response as any).trees)).toStrictEqual([
      'ChildJourney',
      'ParentJourney',
    ]);
  });
});
