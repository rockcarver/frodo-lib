import { jest } from '@jest/globals';

/**
 * A journey whose tree names nodes that the tenant does not have (a plain 404
 * when the node is read): the validation reports each one as a finding
 * (MISSING_NODE_DEFINITION for a node of the tree, MISSING_INNER_NODE for a node
 * of a Page Node) and validates the rest, where it used to fail with the error
 * of the export. Any other failure still fails the journey, and the export of
 * a journey (which is written to a file) is as strict as before.
 */

const getTreeMock: any = jest.fn();
const getTreesMock: any = jest.fn();
const readNodeMock: any = jest.fn();
const printMessageMock: any = jest.fn();

jest.unstable_mockModule('./IdpOps', () => ({
  createSocialIdentityProvider: jest.fn(),
  readSocialIdentityProviders: jest.fn(),
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
  putTree: jest.fn(),
}));

jest.unstable_mockModule('./NodeOps', () => ({
  importCustomNodes: jest.fn(),
  readCustomNode: jest.fn(),
  readNode: readNodeMock,
  readNodes: jest.fn(),
  updateNode: jest.fn(),
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
const { FrodoError } = await import('./FrodoError');

const SUCCESS_NODE = '70e691a5-1e33-4ac3-a356-e7b6d60d92e0';

function state(): any {
  return {
    getVerbose: () => false,
    getDeploymentType: () => 'cloud',
    getHost: () => 'https://example.com/am',
    getAmVersion: () => '9.0.0',
    getUsername: () => 'alpha_user',
    getFrodoVersion: () => 'v4.0.0-test',
  };
}

/** What a node read answers when the tenant does not have the node: the error of the read, wrapping the 404. */
function notFound(what: string): any {
  return new FrodoError(
    `Error reading ${what}`,
    Object.assign(new Error('Request failed with status code 404'), {
      name: 'AxiosError',
      response: { status: 404 },
    })
  );
}

/** What a node read answers when the tenant fails: the error of the read, wrapping the 500. */
function serverError(what: string): any {
  return new FrodoError(
    `Error reading ${what}`,
    Object.assign(new Error('Request failed with status code 500'), {
      name: 'AxiosError',
      response: { status: 500 },
    })
  );
}

/**
 * A journey of a page that holds one inner node and a decision node. The
 * nodes by id are what the tenant answers; an id mapped to an error is a read
 * that fails with it.
 */
function journey(
  nodes: Record<string, any>,
  tree: Record<string, any> = {}
): void {
  getTreeMock.mockResolvedValue({
    _id: 'BrokenJourney',
    entryNodeId: 'page',
    nodes: {
      page: {
        nodeType: 'PageNode',
        version: '1.0',
        connections: { outcome: 'decision' },
      },
      decision: {
        nodeType: 'DecisionNode',
        version: '1.0',
        connections: { done: SUCCESS_NODE },
      },
    },
    staticNodes: {},
    ...tree,
  });
  readNodeMock.mockImplementation(async ({ nodeId }: { nodeId: string }) => {
    const answer = nodes[nodeId];
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

const page = {
  _id: 'page',
  _type: { _id: 'PageNode', version: '1.0' },
  _outcomes: [{ id: 'outcome' }],
  nodes: [
    {
      _id: 'inner',
      nodeType: 'MessageNode',
      nodeVersion: '1.0',
      displayName: 'Message',
    },
  ],
};
const decision = {
  _id: 'decision',
  _type: { _id: 'DecisionNode', version: '1.0' },
  _outcomes: [{ id: 'done' }],
};
const inner = {
  _id: 'inner',
  _type: { _id: 'MessageNode', version: '1.0' },
  _outcomes: [{ id: 'outcome' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  getTreeMock.mockReset();
  getTreesMock.mockReset();
  readNodeMock.mockReset();
});

describe('validateJourneys on a journey with nodes the tenant does not have', () => {
  test('1: a Page Node whose inner node is not there is a MISSING_INNER_NODE finding, not an error', async () => {
    journey({ page, decision, inner: notFound('MessageNode node inner') });

    const findings = await JourneyOps.validateJourneys({
      journeyIds: ['BrokenJourney'],
      state: state(),
    });

    expect(findings).toEqual([
      expect.objectContaining({
        code: 'MISSING_INNER_NODE',
        severity: 'error',
        journeyId: 'BrokenJourney',
        nodeId: 'page',
        targetNodeId: 'inner',
        message:
          "Page Node 'page' references missing inner node 'inner' (MessageNode)",
      }),
    ]);
    expect(printMessageMock).not.toHaveBeenCalled();
  });

  test('2: a node of the tree that is not there is a MISSING_NODE_DEFINITION finding, and the rest is validated', async () => {
    journey(
      { page: notFound('PageNode node page'), decision },
      {
        nodes: {
          page: {
            nodeType: 'PageNode',
            version: '1.0',
            connections: { outcome: 'decision' },
          },
          decision: {
            nodeType: 'DecisionNode',
            version: '1.0',
            connections: { done: 'no-such-target' },
          },
        },
      }
    );

    const findings = await JourneyOps.validateJourneys({
      journeyIds: ['BrokenJourney'],
      state: state(),
    });

    expect(findings).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_NODE_DEFINITION',
        severity: 'error',
        nodeId: 'page',
        message: "Tree node 'page' has no node definition (PageNode)",
      })
    );
    // the nodes that were read are still checked
    expect(findings).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_CONNECTION_TARGET',
        targetNodeId: 'no-such-target',
      })
    );
  });

  test('3: every missing inner node of every page is reported, with its type', async () => {
    const twoPages = {
      page: {
        ...page,
        nodes: [
          { _id: 'one', nodeType: 'MessageNode', nodeVersion: '1.0' },
          { _id: 'two', nodeType: 'ValidatedPasswordNode', nodeVersion: '1.0' },
        ],
      },
      decision,
      one: notFound('MessageNode node one'),
      two: notFound('ValidatedPasswordNode node two'),
    };
    journey(twoPages);

    const findings = await JourneyOps.validateJourneys({
      journeyIds: ['BrokenJourney'],
      state: state(),
    });

    expect(findings.map((finding) => finding.code)).toEqual([
      'MISSING_INNER_NODE',
      'MISSING_INNER_NODE',
    ]);
    expect(findings.map((finding) => finding.message)).toEqual([
      "Page Node 'page' references missing inner node 'one' (MessageNode)",
      "Page Node 'page' references missing inner node 'two' (ValidatedPasswordNode)",
    ]);
  });

  test('4: a failure that is not a 404 still fails the journey', async () => {
    journey({ page, decision, inner: serverError('MessageNode node inner') });

    await expect(
      JourneyOps.validateJourneys({
        journeyIds: ['BrokenJourney'],
        state: state(),
      })
    ).rejects.toThrow(/Error validating alpha realm journeys/);
  });

  test('5: a node of the tree that fails with a server error still fails the journey', async () => {
    journey({
      page: serverError('PageNode node page'),
      decision,
    });

    await expect(
      JourneyOps.validateJourneys({
        journeyIds: ['BrokenJourney'],
        state: state(),
      })
    ).rejects.toThrow(/Error validating alpha realm journeys/);
  });

  test('6: a journey that is not there is still an error', async () => {
    getTreeMock.mockRejectedValue(notFound('journey BrokenJourney'));

    await expect(
      JourneyOps.validateJourneys({
        journeyIds: ['BrokenJourney'],
        state: state(),
      })
    ).rejects.toThrow(/Error validating alpha realm journeys/);
  });

  test('7: the result callback gets the findings of the journey, not an error', async () => {
    journey({ page, decision, inner: notFound('MessageNode node inner') });
    const results: any[] = [];

    await JourneyOps.validateJourneys({
      journeyIds: ['BrokenJourney'],
      resultCallback: (error, result) => results.push({ error, result }),
      state: state(),
    });

    expect(results).toHaveLength(1);
    expect(results[0].error).toBeUndefined();
    expect(results[0].result).toEqual([
      expect.objectContaining({ code: 'MISSING_INNER_NODE' }),
    ]);
  });
});

describe('exporting a journey is as strict as before', () => {
  test('8: an export with an inner node that is not there fails, it is not written without it', async () => {
    journey({ page, decision, inner: notFound('MessageNode node inner') });

    await expect(
      JourneyOps.exportJourney({
        journeyId: 'BrokenJourney',
        options: { deps: false, useStringArrays: true, coords: false },
        state: state(),
      })
    ).rejects.toThrow(/Error exporting alpha realm journey BrokenJourney/);
  });

  test('9: an export with a node of the tree that is not there fails', async () => {
    journey({ page: notFound('PageNode node page'), decision });

    await expect(
      JourneyOps.exportJourney({
        journeyId: 'BrokenJourney',
        options: { deps: false, useStringArrays: true, coords: false },
        state: state(),
      })
    ).rejects.toThrow();
  });
});
