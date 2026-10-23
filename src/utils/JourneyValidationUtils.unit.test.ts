import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  validateJourneyExportKeys,
  validateJourneyReferences,
  type JourneyValidationInput,
} from './JourneyValidationUtils';

function validJourney(): JourneyValidationInput {
  return {
    tree: {
      _id: 'Login',
      entryNodeId: 'page',
      nodes: {
        page: { connections: { outcome: 'node-2' } },
        'node-2': { connections: { done: 'end' } },
      },
      staticNodes: { end: {} },
    },
    nodes: {
      page: {
        _id: 'page',
        _type: { _id: 'PageNode' },
        _outcomes: [{ id: 'outcome' }],
        nodes: [{ _id: 'inner-1' }],
      },
      'node-2': {
        _id: 'node-2',
        _type: { _id: 'DecisionNode' },
        _outcomes: [{ id: 'done' }],
      },
    },
    innerNodes: {
      'inner-1': {
        _id: 'inner-1',
        _outcomes: [{ id: 'outcome' }],
      },
    },
  };
}

function findingCodes(journey: JourneyValidationInput): string[] {
  return validateJourneyReferences(journey).map((finding) => finding.code);
}

describe('validateJourneyReferences', () => {
  test('accepts a normal Page Node outcome derived from its inner node', () => {
    expect(validateJourneyReferences(validJourney())).toEqual([]);
  });

  test('exposes only the last inner node outcomes for a v1 Page Node', () => {
    const journey = validJourney();
    journey.nodes.page.nodes = [{ _id: 'inner-1' }, { _id: 'inner-2' }];
    journey.nodes.page._outcomes = [{ id: 'last' }];
    journey.tree.nodes.page.connections = { last: 'node-2' };
    journey.innerNodes['inner-2'] = {
      _id: 'inner-2',
      _outcomes: [{ id: 'last' }],
    };

    expect(validateJourneyReferences(journey)).toEqual([]);
  });

  test('accepts prefixed outcomes for a v2 Page Node', () => {
    const journey = validJourney();
    journey.nodes.page._type.version = '2.0';
    journey.nodes.page._outcomes = [{ id: 'inner-1-outcome' }];
    journey.tree.nodes.page.connections = { 'inner-1-outcome': 'node-2' };

    expect(validateJourneyReferences(journey)).toEqual([]);
  });

  test('accepts either outcome form for an unknown Page Node version', () => {
    const journey = validJourney();
    journey.nodes.page._type.version = '3.0';
    journey.nodes.page._outcomes = [{ id: 'inner-1-outcome' }];
    journey.tree.nodes.page.connections = { 'inner-1-outcome': 'node-2' };

    expect(validateJourneyReferences(journey)).toEqual([]);
  });

  test('reports an outcome from a non-last inner node as stale', () => {
    const journey = validJourney();
    journey.nodes.page.nodes = [{ _id: 'inner-1' }, { _id: 'inner-2' }];
    journey.nodes.page._outcomes = [{ id: 'old' }, { id: 'last' }];
    journey.tree.nodes.page.connections = {
      old: 'node-2',
      last: 'node-2',
    };
    journey.innerNodes['inner-1']._outcomes = [{ id: 'old' }];
    journey.innerNodes['inner-2'] = {
      _id: 'inner-2',
      _outcomes: [{ id: 'last' }],
    };

    expect(
      validateJourneyReferences(journey).filter(
        (finding) => finding.code === 'PAGE_NODE_OUTCOME_MISMATCH'
      )
    ).toMatchObject([
      {
        severity: 'warning',
        nodeId: 'page',
        outcome: 'old',
      },
    ]);
  });

  test('reports missing outcomes exposed by the last inner node', () => {
    const journey = validJourney();
    journey.nodes.page._outcomes = [];

    expect(validateJourneyReferences(journey)).toContainEqual(
      expect.objectContaining({
        code: 'PAGE_NODE_OUTCOME_MISMATCH',
        severity: 'warning',
        outcome: 'outcome',
      })
    );
  });

  test('accepts classic connections to built-in graph nodes without staticNodes', () => {
    const journey: JourneyValidationInput = {
      tree: {
        _id: 'ClassicJourney',
        entryNodeId: 'decision',
        nodes: {
          decision: {
            connections: {
              success: '70e691a5-1e33-4ac3-a356-e7b6d60d92e0',
              failure: 'e301438c-0bd0-429c-ab0c-66126501069a',
              start: 'startNode',
            },
          },
        },
      },
      nodes: {
        decision: {
          _id: 'decision',
          _outcomes: [{ id: 'success' }, { id: 'failure' }, { id: 'start' }],
        },
      },
    };

    expect(validateJourneyReferences(journey)).toEqual([]);
  });

  test.each([
    '70e691a5-1e33-4ac3-a356-e7b6d60d92e0',
    'e301438c-0bd0-429c-ab0c-66126501069a',
  ])('accepts a path to static terminal node %s', (terminalNodeId) => {
    const journey: JourneyValidationInput = {
      tree: {
        _id: 'TerminalJourney',
        entryNodeId: 'decision',
        nodes: { decision: { connections: { done: terminalNodeId } } },
        staticNodes: { [terminalNodeId]: {} },
      },
      nodes: {
        decision: {
          _id: 'decision',
          _type: { _id: 'DecisionNode' },
          _outcomes: [{ id: 'done' }],
        },
      },
    };

    expect(
      validateJourneyReferences(journey).filter(
        (finding) => finding.code === 'NO_REACHABLE_TERMINAL'
      )
    ).toEqual([]);
  });

  test('warns when the entry node has no connection to a terminal', () => {
    const journey = validJourney();
    journey.tree.nodes.page.connections = {};

    expect(validateJourneyReferences(journey)).toContainEqual(
      expect.objectContaining({
        code: 'NO_REACHABLE_TERMINAL',
        severity: 'warning',
        nodeId: 'page',
      })
    );
  });

  test('warns when the only exit from a journey is a loop', () => {
    const journey = validJourney();
    journey.tree.nodes['node-2'].connections.done = 'page';

    expect(validateJourneyReferences(journey)).toContainEqual(
      expect.objectContaining({
        code: 'NO_REACHABLE_TERMINAL',
        severity: 'warning',
        nodeId: 'page',
      })
    );
  });

  test('warns when tree and inner node references declare incorrect node types', () => {
    const journey = validJourney();
    journey.tree.nodes.page.nodeType = 'DecisionNode';
    journey.nodes.page._type._id = 'PageNode';
    journey.nodes.page.nodes[0].nodeType = 'WrongInnerNode';
    journey.innerNodes['inner-1']._type = { _id: 'InnerNode' };

    expect(
      validateJourneyReferences(journey).filter(
        (finding) => finding.code === 'NODE_TYPE_MISMATCH'
      )
    ).toMatchObject([
      { severity: 'warning', nodeId: 'page' },
      { severity: 'warning', nodeId: 'page', targetNodeId: 'inner-1' },
    ]);
  });

  test('warns when an inner node is reused or its ID collides with a node ID', () => {
    const journey = validJourney();
    journey.nodes.otherPage = {
      _id: 'otherPage',
      _type: { _id: 'PageNode' },
      nodes: [{ _id: 'inner-1' }],
    };
    journey.nodes['inner-1'] = { _id: 'inner-1' };

    expect(
      validateJourneyReferences(journey)
        .filter(
          (finding) =>
            finding.code === 'INNER_NODE_REFERENCED_BY_MULTIPLE_PAGES' ||
            finding.code === 'NODE_ID_COLLISION'
        )
        .map((finding) => finding.code)
    ).toEqual(
      expect.arrayContaining([
        'INNER_NODE_REFERENCED_BY_MULTIPLE_PAGES',
        'NODE_ID_COLLISION',
      ])
    );
  });

  test('healthy cloud-style and classic journeys have no new graph warnings', () => {
    const newCodes = [
      'NO_REACHABLE_TERMINAL',
      'NODE_TYPE_MISMATCH',
      'INNER_NODE_REFERENCED_BY_MULTIPLE_PAGES',
      'NODE_ID_COLLISION',
      'TREE_ID_MISMATCH',
    ];
    const classicJourney: JourneyValidationInput = {
      tree: {
        _id: 'ClassicJourney',
        entryNodeId: 'decision',
        nodes: {
          decision: {
            connections: {
              success: '70e691a5-1e33-4ac3-a356-e7b6d60d92e0',
            },
            nodeType: 'DecisionNode',
          },
        },
      },
      nodes: {
        decision: {
          _id: 'decision',
          _type: { _id: 'DecisionNode' },
          _outcomes: [{ id: 'success' }],
        },
      },
    };

    for (const journey of [validJourney(), classicJourney]) {
      expect(
        validateJourneyReferences(journey).filter((finding) =>
          newCodes.includes(finding.code)
        )
      ).toEqual([]);
    }
  });

  test('supports the legacy lowercase innernodes export property', () => {
    const journey = validJourney();
    journey.innernodes = journey.innerNodes;
    delete journey.innerNodes;

    expect(validateJourneyReferences(journey)).toEqual([]);
  });

  test('reports a missing node definition', () => {
    const journey = validJourney();
    delete journey.nodes.page;

    expect(findingCodes(journey)).toContain('MISSING_NODE_DEFINITION');
  });

  test('reports mismatched node and inner-node map keys', () => {
    const journey = validJourney();
    journey.nodes.page._id = 'different-page';
    journey.innerNodes['inner-1']._id = 'different-inner';

    expect(
      findingCodes(journey).filter((code) => code === 'NODE_ID_MISMATCH')
    ).toHaveLength(2);
  });

  test('reports a dangling target after an incomplete Page Node ID remap', () => {
    const journey = validJourney();
    const pageReference = journey.tree.nodes.page;
    delete journey.tree.nodes.page;
    journey.tree.nodes['new-page'] = pageReference;
    journey.tree.entryNodeId = 'new-page';
    journey.nodes['new-page'] = {
      ...journey.nodes.page,
      _id: 'new-page',
    };
    delete journey.nodes.page;
    journey.tree.nodes['node-2'].connections.done = 'page';

    const finding = validateJourneyReferences(journey).find(
      (result) => result.code === 'MISSING_CONNECTION_TARGET'
    );
    expect(finding).toMatchObject({
      journeyId: 'Login',
      nodeId: 'node-2',
      targetNodeId: 'page',
    });
  });

  test('reports a missing entry node and missing Page Node child', () => {
    const journey = validJourney();
    journey.tree.entryNodeId = 'missing-entry';
    journey.nodes.page.nodes[0]._id = 'missing-inner';

    expect(findingCodes(journey)).toEqual(
      expect.arrayContaining(['MISSING_ENTRY_NODE', 'MISSING_INNER_NODE'])
    );
  });

  test('reports connection keys that are not declared outcomes', () => {
    const journey = validJourney();
    journey.tree.nodes.page.connections.unknown = 'end';

    expect(validateJourneyReferences(journey)).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_CONNECTION_OUTCOME',
        severity: 'warning',
      })
    );
  });

  test('reports non-blocking graph and outcome inconsistencies', () => {
    const journey = validJourney();
    journey.tree.nodes.unreachable = { connections: {} };
    journey.nodes.unreachable = { _id: 'unreachable', _outcomes: [] };
    journey.nodes.unrepresented = { _id: 'unrepresented', _outcomes: [] };
    journey.innerNodes.orphan = { _id: 'orphan', _outcomes: [] };
    journey.nodes.page._outcomes.push({ id: 'not-exposed' });
    journey.nodes['node-2']._outcomes.push({ id: 'not-connected' });

    const findings = validateJourneyReferences(journey);
    expect(
      findings
        .filter((finding) => finding.severity === 'warning')
        .map((f) => f.code)
    ).toEqual(
      expect.arrayContaining([
        'UNCONNECTED_OUTCOME',
        'UNREACHABLE_NODE',
        'UNREFERENCED_INNER_NODE',
        'UNREPRESENTED_NODE',
        'PAGE_NODE_OUTCOME_MISMATCH',
      ])
    );
    expect(findings.every((finding) => finding.journeyId === 'Login')).toBe(
      true
    );
  });

  test('reports one warning for an orphaned debug node and no errors', () => {
    const journey = validJourney();
    journey.tree.nodes.debug = { connections: {} };
    journey.nodes.debug = { _id: 'debug', _outcomes: [] };

    const findings = validateJourneyReferences(journey);
    expect(findings).toHaveLength(1);
    expect(findings).toMatchObject([
      {
        code: 'UNREACHABLE_NODE',
        severity: 'warning',
        nodeId: 'debug',
      },
    ]);
    expect(findings.filter((finding) => finding.severity === 'error')).toEqual(
      []
    );
  });

  test('accepts all checked-in journey import fixtures without blocking errors', () => {
    const fixtureDirectory = join(
      process.cwd(),
      'src/test/mocks/JourneyOps/importJourney'
    );
    const fixtureFiles = readdirSync(fixtureDirectory).filter((file) =>
      file.endsWith('.journey.json')
    );

    for (const file of fixtureFiles) {
      const exportData = JSON.parse(
        readFileSync(join(fixtureDirectory, file), 'utf8')
      );
      const journeys: JourneyValidationInput[] = exportData.tree
        ? [exportData]
        : Object.values(exportData.trees);

      for (const journey of journeys) {
        const errors = validateJourneyReferences(journey).filter(
          (finding) => finding.severity === 'error'
        );
        expect(errors).toEqual([]);
        expect(
          validateJourneyReferences(journey).filter(
            (finding) => finding.code === 'PAGE_NODE_OUTCOME_MISMATCH'
          )
        ).toEqual([]);
      }
    }
  });

  test('checked-in journey fixtures have no new warnings except known incomplete journeys', () => {
    const fixtureDirectory = join(
      process.cwd(),
      'src/test/mocks/JourneyOps/importJourney'
    );
    const allowedIncompleteFixtures = [
      'FrodoTestJourney10.journey.json',
      'FrodoTestJourney10NoCoords.journey.json',
      'FrodoTestJourney11.journey.json',
    ];
    const newCodes = new Set([
      'NO_REACHABLE_TERMINAL',
      'NODE_TYPE_MISMATCH',
      'INNER_NODE_REFERENCED_BY_MULTIPLE_PAGES',
      'NODE_ID_COLLISION',
      'TREE_ID_MISMATCH',
    ]);
    const warnings: { fixture: string; code: string }[] = [];

    for (const file of readdirSync(fixtureDirectory)
      .filter((candidate) => candidate.endsWith('.journey.json'))
      .sort()) {
      const exportData = JSON.parse(
        readFileSync(join(fixtureDirectory, file), 'utf8')
      );
      if (!exportData.tree) {
        for (const result of validateJourneyExportKeys(exportData.trees)) {
          if (newCodes.has(result.code)) {
            warnings.push({ fixture: file, code: result.code });
          }
        }
      }
      const journeys: JourneyValidationInput[] = exportData.tree
        ? [exportData]
        : Object.values(exportData.trees);
      for (const journey of journeys) {
        for (const result of validateJourneyReferences(journey)) {
          if (newCodes.has(result.code)) {
            warnings.push({ fixture: file, code: result.code });
          }
        }
      }
    }

    expect(
      warnings.sort((left, right) => left.fixture.localeCompare(right.fixture))
    ).toEqual(
      allowedIncompleteFixtures
        .map((fixture) => ({ fixture, code: 'NO_REACHABLE_TERMINAL' }))
        .sort((left, right) => left.fixture.localeCompare(right.fixture))
    );
  });

  test('reports only the missing entry error for the known imperfect journey', () => {
    const journey: JourneyValidationInput = {
      tree: {
        _id: 'test',
        entryNodeId: 'missing-entry',
        nodes: {},
      },
      nodes: {},
    };
    const errors = validateJourneyReferences(journey)
      .filter((finding) => finding.severity === 'error')
      .map((finding) => finding.code);

    expect(errors).toEqual(['MISSING_ENTRY_NODE']);
  });
});
