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
  test('accepts valid tree, node, static node, and Page Node references', () => {
    expect(validateJourneyReferences(validJourney())).toEqual([]);
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

    expect(findingCodes(journey)).toContain('UNKNOWN_CONNECTION_OUTCOME');
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
});
