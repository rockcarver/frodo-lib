import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  validateJourneyReferences,
  type JourneyValidationInput,
} from './JourneyValidationUtils';

function validJourney(): JourneyValidationInput {
  return {
    tree: {
      _id: 'Login',
      entryNodeId: 'page',
      nodes: {
        page: { connections: { 'inner-1-outcome': 'node-2' } },
        'node-2': { connections: { done: 'end' } },
      },
      staticNodes: { end: {} },
    },
    nodes: {
      page: {
        _id: 'page',
        _type: { _id: 'PageNode' },
        _outcomes: [{ id: 'inner-1-outcome' }],
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

    expect(validateJourneyReferences(journey)).toMatchObject([
      {
        code: 'UNREACHABLE_NODE',
        severity: 'warning',
        nodeId: 'debug',
      },
    ]);
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
      }
    }
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
