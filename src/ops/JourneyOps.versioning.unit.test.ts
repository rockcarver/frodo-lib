import { jest } from '@jest/globals';

const getTreeMock: any = jest.fn();
const getTreesMock: any = jest.fn();
const readNodeMock: any = jest.fn();
const updateNodeMock: any = jest.fn();
const putTreeMock: any = jest.fn();
const printMessageMock: any = jest.fn();
const stopProgressIndicatorMock: any = jest.fn();
const readSocialIdentityProvidersMock: any = jest.fn();

jest.unstable_mockModule('./IdpOps', () => ({
  createSocialIdentityProvider: jest.fn(),
  readSocialIdentityProviders: readSocialIdentityProvidersMock,
}));

jest.unstable_mockModule('./ScriptOps', () => ({
  getLibraryScriptNames: jest.fn(() => []),
  readScript: jest.fn(async () => undefined),
  readScriptByName: jest.fn(),
  updateScript: jest.fn(),
}));

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
  stopProgressIndicator: stopProgressIndicatorMock,
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

  test('importJourneys reports the failed journey name and continues importing', async () => {
    getTreesMock.mockResolvedValue({ result: [] });
    putTreeMock.mockImplementation(async ({ treeData }: { treeData: any }) => {
      if (treeData._id === 'FailedJourney') {
        throw new Error('Import failed');
      }
      return treeData;
    });
    const resultCallback = jest.fn();

    const results = await JourneyOps.importJourneys({
      importData: {
        trees: {
          FirstJourney: journeyExport('FirstJourney'),
          FailedJourney: journeyExport('FailedJourney'),
          LastJourney: journeyExport('LastJourney'),
        },
      },
      options: { reUuid: false, deps: false },
      resultCallback,
      state: validationState(),
    });

    expect(resultCallback).toHaveBeenCalledTimes(3);
    expect(resultCallback).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        message: 'Error importing the alpha realm journey FailedJourney',
      }),
      undefined
    );
    expect(results.map((tree) => tree._id)).toEqual([
      'FirstJourney',
      'LastJourney',
    ]);
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

  test('validateJourneys skips dependency and export-key checks in live mode without extra reads', async () => {
    const journey = journeyExport('ReturnedJourney');
    journey.tree.nodes.node.nodeType = 'ScriptedDecisionNode';
    journey.nodes.node._type._id = 'ScriptedDecisionNode';
    journey.nodes.node.script = 'not-exported';
    getTreeMock.mockResolvedValue(journey.tree);
    readNodeMock.mockResolvedValue(journey.nodes.node);

    expect(
      await JourneyOps.validateJourneys({
        journeyIds: ['LiveJourney'],
        state: validationState(),
      })
    ).toEqual([]);
    expect(getTreeMock).toHaveBeenCalledTimes(1);
    expect(readNodeMock).toHaveBeenCalledTimes(1);
    expect(printMessageMock).not.toHaveBeenCalled();
  });

  test('validateJourneys checks dependencies per journey, using the ops script predicate', async () => {
    const journey = journeyExport('HealthyJourney');
    journey.tree.nodes.node.nodeType = 'DeviceMatchNode';
    Object.assign(journey.nodes.node, {
      _type: { _id: 'DeviceMatchNode' },
      script: 'missing-script',
      useScript: true,
    });
    journey.scripts = { other: {} };
    const sibling = journeyExport('SiblingJourney');
    sibling.scripts = { 'missing-script': {} };
    const journeysExport = {
      trees: { HealthyJourney: journey, SiblingJourney: sibling },
    };

    expect(
      await JourneyOps.validateJourneys({
        journeysExport,
        state: validationState(),
      })
    ).toEqual([
      expect.objectContaining({
        code: 'MISSING_SCRIPT_DEPENDENCY',
        severity: 'warning',
        journeyId: 'HealthyJourney',
        dependencyId: 'missing-script',
      }),
    ]);

    journey.nodes.node.useScript = false;
    expect(
      await JourneyOps.validateJourneys({
        journeysExport,
        state: validationState(),
      })
    ).toEqual([]);
    expect(getTreeMock).not.toHaveBeenCalled();
    expect(readNodeMock).not.toHaveBeenCalled();
  });

  test('dependency warnings do not prevent import and are reported by export', async () => {
    const journey = journeyExport('WarnedJourney');
    journey.tree.nodes.node.nodeType = 'EmailTemplateNode';
    journey.nodes.node._type._id = 'EmailTemplateNode';
    journey.nodes.node.emailTemplateName = 'missing-template';
    journey.emailTemplates = { other: {} };
    const state = validationState();

    await JourneyOps.importJourney({
      importData: journey,
      options: { reUuid: false, deps: false },
      state,
    });
    expect(putTreeMock).toHaveBeenCalledTimes(1);
    expect(printMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warn',
        message: '1 warning in journey WarnedJourney',
      })
    );

    printMessageMock.mockClear();
    journey.tree.nodes.node.nodeType = 'SelectIdPNode';
    journey.nodes.node._type._id = 'SelectIdPNode';
    journey.nodes.node.filteredProviders = ['existing', 'missing'];
    journey.tree.nodes.handler = {
      nodeType: 'SocialProviderHandlerNode',
      version: '1.0',
      connections: { done: '70e691a5-1e33-4ac3-a356-e7b6d60d92e0' },
    };
    journey.tree.nodes.node.connections.done = 'handler';
    journey.nodes.handler = {
      _id: 'handler',
      _type: { _id: 'SocialProviderHandlerNode' },
      _outcomes: [{ id: 'done' }],
      script: '[Empty]',
    };
    getTreeMock.mockResolvedValue(journey.tree);
    readNodeMock.mockImplementation(
      async ({ nodeId }: { nodeId: string }) => journey.nodes[nodeId]
    );
    readSocialIdentityProvidersMock.mockResolvedValue([{ _id: 'existing' }]);
    await JourneyOps.exportJourney({
      journeyId: 'WarnedJourney',
      options: { deps: true, useStringArrays: true, coords: false },
      state,
    });
    expect(printMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warn',
        message: '1 warning in journey WarnedJourney',
      })
    );
  });

  test('exportJourneys prints dependency warnings when exporting all journeys', async () => {
    const journey = journeyExport('WarnedJourney');
    journey.tree.nodes.node.nodeType = 'SelectIdPNode';
    journey.tree.nodes.node.connections.done = 'handler';
    Object.assign(journey.nodes.node, {
      _type: { _id: 'SelectIdPNode' },
      filteredProviders: ['existing', 'missing'],
    });
    journey.tree.nodes.handler = {
      nodeType: 'SocialProviderHandlerNode',
      version: '1.0',
      connections: { done: '70e691a5-1e33-4ac3-a356-e7b6d60d92e0' },
    };
    journey.nodes.handler = {
      _id: 'handler',
      _type: { _id: 'SocialProviderHandlerNode' },
      _outcomes: [{ id: 'done' }],
      script: '[Empty]',
    };
    getTreesMock.mockResolvedValue({ result: [journey.tree] });
    getTreeMock.mockResolvedValue(journey.tree);
    readNodeMock.mockImplementation(
      async ({ nodeId }: { nodeId: string }) => journey.nodes[nodeId]
    );
    readSocialIdentityProvidersMock.mockResolvedValue([{ _id: 'existing' }]);

    const exported = await JourneyOps.exportJourneys({
      options: { deps: true, useStringArrays: true, coords: false },
      state: validationState(),
    });

    expect(exported.trees.WarnedJourney).toBeDefined();
    expect(printMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'warn',
        message:
          '1 of 1 journey has validation findings: 1 missing social identity provider. Use verbose output to list them.',
      })
    );
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

/**
 * With a result callback, validateJourneys passes the outcome of every journey to it as it
 * happens (the findings of the journey, or an error that names it) and returns the findings
 * of all journeys that could be validated, instead of throwing one error that loses them.
 * Origin: frodo-cli#1099 (record 0040): `journey validate` called the function once per
 * journey because one unreadable journey threw away the findings of all the others.
 */
describe('validateJourneys with a result callback', () => {
  function liveJourneys(failing: string[] = []) {
    getTreeMock.mockImplementation(async ({ id }: { id: string }) => {
      if (failing.includes(id)) throw new Error('Journey not found');
      return id === 'BrokenJourney'
        ? journeyExport(id, 'missing-target').tree
        : journeyExport(id).tree;
    });
    readNodeMock.mockImplementation(
      async ({ nodeId }: { nodeId: string }) =>
        journeyExport('ignored').nodes[nodeId]
    );
  }

  test('offline: returns the findings of the journeys that could be validated and reports each journey', async () => {
    const resultCallback = jest.fn();

    const findings = await JourneyOps.validateJourneys({
      journeyIds: ['BrokenJourney', 'MissingJourney', 'HealthyJourney'],
      journeysExport: multiJourneyExport(),
      resultCallback,
      state: validationState(),
    });

    expect(findings).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_CONNECTION_TARGET',
        journeyId: 'BrokenJourney',
      })
    );
    expect(resultCallback).toHaveBeenCalledTimes(3);
    const [brokenError, brokenFindings] = resultCallback.mock.calls[0] as any[];
    expect(brokenError).toBeUndefined();
    expect(brokenFindings).toEqual(findings);
    const [missingError, missingFindings] = resultCallback.mock
      .calls[1] as any[];
    expect(missingError).toMatchObject({
      name: 'FrodoError',
      message: "Error validating alpha realm journey 'MissingJourney'",
    });
    expect(missingFindings).toBeUndefined();
    expect(resultCallback).toHaveBeenNthCalledWith(3, undefined, []);
  });

  test('live: a journey that cannot be read does not lose the findings of the others', async () => {
    liveJourneys(['MissingJourney']);
    const resultCallback = jest.fn();

    const findings = await JourneyOps.validateJourneys({
      journeyIds: ['MissingJourney', 'BrokenJourney', 'HealthyJourney'],
      resultCallback,
      state: validationState(),
    });

    // only the journey that could be read and is broken has findings, and none is lost
    expect(findings.map((finding) => finding.journeyId)).toEqual([
      'BrokenJourney',
      'BrokenJourney',
    ]);
    expect(findings).toContainEqual(
      expect.objectContaining({ code: 'MISSING_CONNECTION_TARGET' })
    );
    expect(getTreeMock).toHaveBeenCalledTimes(3);
    expect(resultCallback).toHaveBeenCalledTimes(3);
    const [error, result] = resultCallback.mock.calls[0] as any[];
    expect(error).toMatchObject({
      name: 'FrodoError',
      message: "Error validating alpha realm journey 'MissingJourney'",
    });
    expect(error.originalErrors).toHaveLength(1);
    expect(result).toBeUndefined();
    expect(resultCallback).toHaveBeenNthCalledWith(2, undefined, findings);
    expect(resultCallback).toHaveBeenNthCalledWith(3, undefined, []);
  });

  test('a blank journey ID is reported to the callback and does not throw', async () => {
    liveJourneys();
    const resultCallback = jest.fn();

    const findings = await JourneyOps.validateJourneys({
      journeyIds: ['', 'HealthyJourney'],
      resultCallback,
      state: validationState(),
    });

    expect(findings).toEqual([]);
    expect(resultCallback).toHaveBeenCalledTimes(2);
    expect(resultCallback.mock.calls[0][0]).toMatchObject({
      message: "Error validating alpha realm journey ''",
    });
    expect(resultCallback).toHaveBeenNthCalledWith(2, undefined, []);
  });

  test('reports a journey once: a failed journey is not also reported as validated', async () => {
    liveJourneys(['MissingJourney']);
    const resultCallback = jest.fn();

    await JourneyOps.validateJourneys({
      journeyIds: ['MissingJourney'],
      resultCallback,
      state: validationState(),
    });

    expect(resultCallback).toHaveBeenCalledTimes(1);
    expect(resultCallback.mock.calls[0][1]).toBeUndefined();
  });

  test('failing to list the journeys of the realm still throws, and reports no journey', async () => {
    getTreesMock.mockRejectedValue(new Error('cannot list'));
    const resultCallback = jest.fn();

    await expect(
      JourneyOps.validateJourneys({ resultCallback, state: validationState() })
    ).rejects.toMatchObject({
      name: 'FrodoError',
      message: 'Error validating alpha realm journeys',
    });
    expect(resultCallback).not.toHaveBeenCalled();
  });

  test('invalid arguments still throw before API access', async () => {
    const resultCallback = jest.fn();

    await expect(
      JourneyOps.validateJourneys({
        journeyIds: 'Login' as unknown as string[],
        resultCallback,
        state: validationState(),
      })
    ).rejects.toMatchObject({ name: 'FrodoError' });
    expect(getTreesMock).not.toHaveBeenCalled();
    expect(getTreeMock).not.toHaveBeenCalled();
    expect(resultCallback).not.toHaveBeenCalled();
  });

  test('the facade passes the callback on', async () => {
    const resultCallback = jest.fn();

    const findings = await JourneyOps.default(
      validationState()
    ).validateJourneys(
      ['BrokenJourney', 'MissingJourney'],
      multiJourneyExport(),
      resultCallback
    );

    expect(findings.length).toBeGreaterThan(0);
    expect(resultCallback).toHaveBeenCalledTimes(2);
  });

  test('without a callback a failed journey still throws and the findings are not returned', async () => {
    liveJourneys(['MissingJourney']);

    await expect(
      JourneyOps.validateJourneys({
        journeyIds: ['MissingJourney', 'BrokenJourney'],
        state: validationState(),
      })
    ).rejects.toMatchObject({
      name: 'FrodoError',
      message: 'Error validating alpha realm journeys',
      originalErrors: [
        { message: "Error validating alpha realm journey 'MissingJourney'" },
      ],
    });
  });
});

describe('exportJourneys summarises the validation findings of all journeys', () => {
  const successNode = '70e691a5-1e33-4ac3-a356-e7b6d60d92e0';

  interface FakeJourney {
    tree: any;
    nodes: Record<string, any>;
  }

  /**
   * A journey of one decision node. `unconnected` adds declared outcomes with no
   * connection, `unreachable` adds nodes nobody leads to, `brokenTarget` leads the
   * only connection to a node that does not exist.
   */
  function fakeJourney(
    journeyId: string,
    {
      unconnected = 0,
      unreachable = 0,
      brokenTarget = false,
    }: {
      unconnected?: number;
      unreachable?: number;
      brokenTarget?: boolean;
    } = {}
  ): FakeJourney {
    const nodeId = `${journeyId}-node`;
    const type = { _id: 'DecisionNode', version: '1.0' };
    const tree: any = {
      _id: journeyId,
      entryNodeId: nodeId,
      nodes: {
        [nodeId]: {
          nodeType: 'DecisionNode',
          version: '1.0',
          connections: { done: brokenTarget ? 'missing-target' : successNode },
        },
      },
      staticNodes: {},
    };
    const outcomes = [{ id: 'done' }];
    for (let i = 0; i < unconnected; i++) outcomes.push({ id: `extra${i}` });
    const nodes: Record<string, any> = {
      [nodeId]: { _id: nodeId, _type: type, _outcomes: outcomes },
    };
    for (let i = 0; i < unreachable; i++) {
      const orphanId = `${journeyId}-orphan${i}`;
      tree.nodes[orphanId] = {
        nodeType: 'DecisionNode',
        version: '1.0',
        connections: { done: successNode },
      };
      nodes[orphanId] = {
        _id: orphanId,
        _type: type,
        _outcomes: [{ id: 'done' }],
      };
    }
    return { tree, nodes };
  }

  /** Serve the journeys; the ones in `failing` cannot be read. */
  function serve(journeys: FakeJourney[], failing: string[] = []) {
    getTreesMock.mockResolvedValue({ result: journeys.map((j) => j.tree) });
    getTreeMock.mockImplementation(async ({ id }: { id: string }) => {
      if (failing.includes(id)) throw new Error(`cannot read ${id}`);
      return journeys.find((j) => j.tree._id === id).tree;
    });
    readNodeMock.mockImplementation(async ({ nodeId }: { nodeId: string }) =>
      journeys.map((j) => j.nodes[nodeId]).find(Boolean)
    );
  }

  const exportOptions = { deps: false, useStringArrays: true, coords: false };

  function warnMessages(): string[] {
    return printMessageMock.mock.calls
      .map(([args]: any[]) => args)
      .filter((args: any) => args.type === 'warn')
      .map((args: any) => args.message);
  }

  test('prints one line with the count of every kind instead of a line per journey', async () => {
    serve([
      fakeJourney('A', { unconnected: 3, unreachable: 1 }),
      fakeJourney('B', { unreachable: 1 }),
      fakeJourney('C'),
    ]);

    const exported = await JourneyOps.exportJourneys({
      options: exportOptions,
      state: validationState(),
    });

    expect(Object.keys(exported.trees)).toEqual(['A', 'B', 'C']);
    expect(warnMessages()).toEqual([
      '2 of 3 journeys have validation findings: 3 unconnected outcomes, 2 unreachable nodes. Use verbose output to list them.',
    ]);
  });

  test('prints nothing when no journey has a finding', async () => {
    serve([fakeJourney('A'), fakeJourney('B')]);

    await JourneyOps.exportJourneys({
      options: exportOptions,
      state: validationState(),
    });

    expect(warnMessages()).toEqual([]);
  });

  test('verbose output keeps one line per journey and one per finding', async () => {
    serve([
      fakeJourney('A', { unconnected: 2, unreachable: 1 }),
      fakeJourney('B', { unreachable: 1 }),
      fakeJourney('C'),
    ]);
    const state = { ...validationState(), getVerbose: () => true };

    await JourneyOps.exportJourneys({ options: exportOptions, state });

    const lines = warnMessages();
    expect(lines).toContain('3 warnings in journey A');
    expect(lines).toContain('1 warning in journey B');
    expect(
      lines.filter((line) => line.startsWith('[UNCONNECTED_OUTCOME]'))
    ).toHaveLength(2);
    expect(
      lines.filter((line) => line.startsWith('[UNREACHABLE_NODE]'))
    ).toHaveLength(2);
    expect(lines.some((line) => line.includes('validation findings'))).toBe(
      false
    );
    expect(lines.some((line) => line.includes('journey C'))).toBe(false);
  });

  test('names the errors when there are any', async () => {
    serve([fakeJourney('A', { brokenTarget: true }), fakeJourney('B')]);

    await JourneyOps.exportJourneys({
      options: exportOptions,
      state: validationState(),
    });

    expect(warnMessages()).toEqual([
      '1 of 2 journeys has validation findings (1 error and 1 warning): 1 connection to a missing node, 1 without a reachable end. Use verbose output to list them.',
    ]);
  });

  test('says "journey" and "has" for one journey with one finding', async () => {
    serve([fakeJourney('A', { unconnected: 1 })]);

    await JourneyOps.exportJourneys({
      options: exportOptions,
      state: validationState(),
    });

    expect(warnMessages()).toEqual([
      '1 of 1 journey has validation findings: 1 unconnected outcome. Use verbose output to list them.',
    ]);
  });

  test('counts only the journeys that were exported, and says when some were not', async () => {
    serve(
      [
        fakeJourney('A', { unconnected: 1 }),
        fakeJourney('B', { unconnected: 1 }),
        fakeJourney('C'),
      ],
      ['B']
    );
    const resultCallback = jest.fn();

    const exported = await JourneyOps.exportJourneys({
      options: exportOptions,
      resultCallback,
      state: validationState(),
    });

    expect(Object.keys(exported.trees)).toEqual(['A', 'C']);
    expect(resultCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Error exporting the alpha realm journey B',
      }),
      undefined
    );
    expect(warnMessages()).toEqual([
      '1 of 2 journeys has validation findings: 1 unconnected outcome. Use verbose output to list them.',
    ]);
    expect(stopProgressIndicatorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Exported 2 of 3 alpha realm journeys.',
      })
    );
  });

  test('the end message is the plain count when every journey was exported', async () => {
    serve([fakeJourney('A'), fakeJourney('B')]);

    await JourneyOps.exportJourneys({
      options: exportOptions,
      state: validationState(),
    });

    expect(stopProgressIndicatorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Exported 2 alpha realm journeys.' })
    );
  });

  test('a code without a label is named by the code', () => {
    JourneyOps.reportJourneyExportFindings(
      [
        {
          code: 'SOMETHING_NEW',
          severity: 'warning',
          journeyId: 'A',
          message: 'm',
        },
        {
          code: 'SOMETHING_NEW',
          severity: 'warning',
          journeyId: 'B',
          message: 'm',
        },
        {
          code: 'UNREACHABLE_NODE',
          severity: 'warning',
          journeyId: 'B',
          message: 'm',
        },
      ] as any,
      5,
      validationState()
    );

    expect(warnMessages()).toEqual([
      '2 of 5 journeys have validation findings: 2 SOMETHING_NEW, 1 unreachable node. Use verbose output to list them.',
    ]);
  });
});
