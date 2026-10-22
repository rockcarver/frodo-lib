export type JourneyValidationSeverity = 'error' | 'warning';

export type JourneyValidationCode =
  | 'MISSING_NODE_DEFINITION'
  | 'NODE_ID_MISMATCH'
  | 'MISSING_CONNECTION_TARGET'
  | 'MISSING_ENTRY_NODE'
  | 'MISSING_INNER_NODE'
  | 'UNKNOWN_CONNECTION_OUTCOME'
  | 'UNCONNECTED_OUTCOME'
  | 'UNREACHABLE_NODE'
  | 'UNREFERENCED_INNER_NODE'
  | 'UNREPRESENTED_NODE'
  | 'PAGE_NODE_OUTCOME_MISMATCH';

/**
 * A journey validation result. `severity` indicates whether the finding blocks
 * import; `journeyId` identifies the affected journey, and optional node and
 * outcome fields identify the related graph reference.
 */
export interface JourneyValidationFinding {
  /** Stable identifier for the validation rule that produced this finding. */
  code: JourneyValidationCode;
  /** Whether the finding blocks journey import or is informational only. */
  severity: JourneyValidationSeverity;
  /** Journey name or ID associated with the finding. */
  journeyId: string;
  /** Human-readable explanation of the invalid or suspicious reference. */
  message: string;
  /** Node associated with the finding, when applicable. */
  nodeId?: string;
  /** Referenced node associated with the finding, when applicable. */
  targetNodeId?: string;
  /** Connection or declared outcome associated with the finding, when applicable. */
  outcome?: string;
}

interface JourneyNodeDefinition {
  _id?: string;
  _type?: { _id?: string; version?: string };
  _outcomes?: { id?: string }[];
  nodes?: { _id?: string }[];
}

interface JourneyNodeReference {
  connections?: Record<string, string>;
}

/**
 * Minimal journey export shape consumed by the referential-integrity checks.
 * The legacy lowercase `innernodes` property is supported for older exports.
 */
export interface JourneyValidationInput {
  tree: {
    _id?: string;
    entryNodeId?: string;
    nodes?: Record<string, JourneyNodeReference>;
    staticNodes?: Record<string, unknown>;
  };
  nodes?: Record<string, JourneyNodeDefinition>;
  innerNodes?: Record<string, JourneyNodeDefinition>;
  innernodes?: Record<string, JourneyNodeDefinition>;
}

const JOURNEY_VALIDATION_SEVERITY: Record<
  JourneyValidationCode,
  JourneyValidationSeverity
> = {
  MISSING_NODE_DEFINITION: 'error',
  NODE_ID_MISMATCH: 'error',
  MISSING_CONNECTION_TARGET: 'error',
  MISSING_ENTRY_NODE: 'error',
  MISSING_INNER_NODE: 'error',
  UNKNOWN_CONNECTION_OUTCOME: 'warning',
  UNCONNECTED_OUTCOME: 'warning',
  UNREACHABLE_NODE: 'warning',
  UNREFERENCED_INNER_NODE: 'warning',
  UNREPRESENTED_NODE: 'warning',
  PAGE_NODE_OUTCOME_MISMATCH: 'warning',
};

const BUILT_IN_GRAPH_NODE_IDS = [
  '70e691a5-1e33-4ac3-a356-e7b6d60d92e0',
  'e301438c-0bd0-429c-ab0c-66126501069a',
  'startNode',
];

export const JOURNEY_CONTAINER_NODE_TYPES = ['PageNode', 'CustomPageNode'];

function hasOwnKey(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function outcomeIds(node: JourneyNodeDefinition): Set<string> {
  return new Set(
    (node._outcomes || [])
      .map((outcome) => outcome.id)
      .filter((id): id is string => typeof id === 'string')
  );
}

function getInnerNodeDefinitions(
  journey: JourneyValidationInput
): Record<string, JourneyNodeDefinition> {
  if (journey.innerNodes && Object.keys(journey.innerNodes).length > 0) {
    return journey.innerNodes;
  }
  return journey.innernodes || journey.innerNodes || {};
}

function finding(
  journey: JourneyValidationInput,
  code: JourneyValidationCode,
  message: string,
  details: Pick<
    JourneyValidationFinding,
    'nodeId' | 'targetNodeId' | 'outcome'
  > = {}
): JourneyValidationFinding {
  return {
    code,
    severity: JOURNEY_VALIDATION_SEVERITY[code],
    journeyId: journey.tree._id || '<unknown>',
    message,
    ...details,
  };
}

function checkTreeNodeDefinitions(
  journey: JourneyValidationInput
): JourneyValidationFinding[] {
  const findings: JourneyValidationFinding[] = [];
  const treeNodes = journey.tree.nodes || {};
  const nodeDefinitions = journey.nodes || {};

  for (const [nodeId, nodeReference] of Object.entries(treeNodes)) {
    const definition = nodeDefinitions[nodeId];
    if (!definition) {
      findings.push(
        finding(
          journey,
          'MISSING_NODE_DEFINITION',
          `Tree node '${nodeId}' has no node definition`,
          { nodeId }
        )
      );
      continue;
    }

    const declaredOutcomes = outcomeIds(definition);
    for (const outcome of Object.keys(nodeReference.connections || {})) {
      if (!declaredOutcomes.has(outcome)) {
        findings.push(
          finding(
            journey,
            'UNKNOWN_CONNECTION_OUTCOME',
            `Connection outcome '${outcome}' is not declared by node '${nodeId}'`,
            { nodeId, outcome }
          )
        );
      }
    }
    for (const outcome of declaredOutcomes) {
      if (!hasOwnKey(nodeReference.connections || {}, outcome)) {
        findings.push(
          finding(
            journey,
            'UNCONNECTED_OUTCOME',
            `Declared outcome '${outcome}' on node '${nodeId}' has no connection`,
            { nodeId, outcome }
          )
        );
      }
    }
  }

  return findings;
}

function checkNodeDefinitionKeys(
  journey: JourneyValidationInput
): JourneyValidationFinding[] {
  const findings: JourneyValidationFinding[] = [];
  const treeNodes = journey.tree.nodes || {};
  const nodeDefinitions = journey.nodes || {};

  for (const [nodeId, definition] of Object.entries(nodeDefinitions)) {
    if (definition._id !== nodeId) {
      findings.push(
        finding(
          journey,
          'NODE_ID_MISMATCH',
          `Node definition key '${nodeId}' does not match _id '${definition._id}'`,
          { nodeId }
        )
      );
    }
    if (!hasOwnKey(treeNodes, nodeId)) {
      findings.push(
        finding(
          journey,
          'UNREPRESENTED_NODE',
          `Node definition '${nodeId}' is not represented in tree.nodes`,
          { nodeId }
        )
      );
    }
  }

  for (const [innerNodeId, definition] of Object.entries(
    getInnerNodeDefinitions(journey)
  )) {
    if (definition._id !== innerNodeId) {
      findings.push(
        finding(
          journey,
          'NODE_ID_MISMATCH',
          `Inner node definition key '${innerNodeId}' does not match _id '${definition._id}'`,
          { nodeId: innerNodeId }
        )
      );
    }
  }

  return findings;
}

function checkNodeDefinitions(
  journey: JourneyValidationInput
): JourneyValidationFinding[] {
  return [
    ...checkTreeNodeDefinitions(journey),
    ...checkNodeDefinitionKeys(journey),
  ];
}

function checkEntryAndConnections(
  journey: JourneyValidationInput,
  graphNodeIds: Set<string>
): JourneyValidationFinding[] {
  const findings: JourneyValidationFinding[] = [];
  const treeNodes = journey.tree.nodes || {};
  const entryNodeId = journey.tree.entryNodeId;

  if (!entryNodeId || !graphNodeIds.has(entryNodeId)) {
    findings.push(
      finding(
        journey,
        'MISSING_ENTRY_NODE',
        `Entry node '${entryNodeId || ''}' does not resolve to a graph node`,
        { nodeId: entryNodeId }
      )
    );
  }

  for (const [nodeId, nodeReference] of Object.entries(treeNodes)) {
    for (const targetNodeId of Object.values(nodeReference.connections || {})) {
      if (!graphNodeIds.has(targetNodeId)) {
        findings.push(
          finding(
            journey,
            'MISSING_CONNECTION_TARGET',
            `Connection from node '${nodeId}' targets missing graph node '${targetNodeId}'`,
            { nodeId, targetNodeId }
          )
        );
      }
    }
  }

  return findings;
}

function findUnreachableNodes(
  journey: JourneyValidationInput,
  graphNodeIds: Set<string>
): JourneyValidationFinding[] {
  const treeNodes = journey.tree.nodes || {};
  const entryNodeId = journey.tree.entryNodeId;
  const reachableNodeIds = new Set<string>();

  if (entryNodeId && graphNodeIds.has(entryNodeId)) {
    const pendingNodeIds = [entryNodeId];
    while (pendingNodeIds.length > 0) {
      const nodeId = pendingNodeIds.pop()!;
      if (reachableNodeIds.has(nodeId)) {
        continue;
      }
      reachableNodeIds.add(nodeId);
      for (const targetNodeId of Object.values(
        treeNodes[nodeId]?.connections || {}
      )) {
        if (graphNodeIds.has(targetNodeId)) {
          pendingNodeIds.push(targetNodeId);
        }
      }
    }
  }

  return Object.keys(treeNodes)
    .filter((nodeId) => !reachableNodeIds.has(nodeId))
    .map((nodeId) =>
      finding(
        journey,
        'UNREACHABLE_NODE',
        `Tree node '${nodeId}' is not reachable from the entry node`,
        { nodeId }
      )
    );
}

function checkInnerNodeReferences(
  journey: JourneyValidationInput,
  pageNodeId: string,
  references: { _id?: string }[],
  innerNodeDefinitions: Record<string, JourneyNodeDefinition>,
  referencedInnerNodeIds: Set<string>
): JourneyValidationFinding[] {
  const findings: JourneyValidationFinding[] = [];
  for (const reference of references) {
    const innerNodeId = reference._id;
    if (!innerNodeId) {
      continue;
    }
    referencedInnerNodeIds.add(innerNodeId);
    if (!innerNodeDefinitions[innerNodeId]) {
      findings.push(
        finding(
          journey,
          'MISSING_INNER_NODE',
          `Page Node '${pageNodeId}' references missing inner node '${innerNodeId}'`,
          { nodeId: pageNodeId, targetNodeId: innerNodeId }
        )
      );
    }
  }
  return findings;
}

function outcomeDifference(
  actual: Set<string>,
  expected: Set<string>
): { extra: string[]; missing: string[] } {
  return {
    extra: [...actual].filter((outcome) => !expected.has(outcome)),
    missing: [...expected].filter((outcome) => !actual.has(outcome)),
  };
}

function getPageOutcomeDifference(
  pageNode: JourneyNodeDefinition,
  innerNode: JourneyNodeDefinition
): { extra: string[]; missing: string[] } {
  const outcomes = outcomeIds(pageNode);
  const innerOutcomes = outcomeIds(innerNode);
  const prefixedOutcomes = new Set(
    [...innerOutcomes].map((outcome) => `${innerNode._id}-${outcome}`)
  );
  const version = pageNode._type?.version || '';
  const candidates = version.startsWith('2')
    ? [prefixedOutcomes]
    : version.startsWith('1') || !version
      ? [innerOutcomes]
      : [innerOutcomes, prefixedOutcomes];

  return candidates
    .map((expected) => ({
      expected,
      difference: outcomeDifference(outcomes, expected),
    }))
    .reduce((closest, candidate) => {
      const differenceSize =
        candidate.difference.extra.length + candidate.difference.missing.length;
      const closestDifferenceSize =
        closest.difference.extra.length + closest.difference.missing.length;
      return differenceSize < closestDifferenceSize ? candidate : closest;
    }).difference;
}

function checkPageNodeOutcomes(
  journey: JourneyValidationInput,
  pageNodeId: string,
  pageNode: JourneyNodeDefinition,
  lastInnerNode: JourneyNodeDefinition | undefined
): JourneyValidationFinding[] {
  if (!lastInnerNode) {
    return [];
  }

  const { extra, missing } = getPageOutcomeDifference(pageNode, lastInnerNode);
  const findings: JourneyValidationFinding[] = [];
  for (const outcome of extra) {
    findings.push(
      finding(
        journey,
        'PAGE_NODE_OUTCOME_MISMATCH',
        `Page Node '${pageNodeId}' outcome '${outcome}' does not match the last inner node's outcomes`,
        { nodeId: pageNodeId, outcome }
      )
    );
  }
  for (const outcome of missing) {
    findings.push(
      finding(
        journey,
        'PAGE_NODE_OUTCOME_MISMATCH',
        `Page Node '${pageNodeId}' is missing exposed outcome '${outcome}'`,
        { nodeId: pageNodeId, outcome }
      )
    );
  }
  return findings;
}

function checkPageNodes(
  journey: JourneyValidationInput,
  innerNodeDefinitions: Record<string, JourneyNodeDefinition>
): JourneyValidationFinding[] {
  const findings: JourneyValidationFinding[] = [];
  const referencedInnerNodeIds = new Set<string>();

  for (const [nodeId, definition] of Object.entries(journey.nodes || {})) {
    if (!JOURNEY_CONTAINER_NODE_TYPES.includes(definition._type?._id || '')) {
      continue;
    }
    const innerNodeReferences = definition.nodes || [];
    findings.push(
      ...checkInnerNodeReferences(
        journey,
        nodeId,
        innerNodeReferences,
        innerNodeDefinitions,
        referencedInnerNodeIds
      )
    );
    const lastInnerNodeId =
      innerNodeReferences[innerNodeReferences.length - 1]?._id;
    findings.push(
      ...checkPageNodeOutcomes(
        journey,
        nodeId,
        definition,
        lastInnerNodeId ? innerNodeDefinitions[lastInnerNodeId] : undefined
      )
    );
  }

  for (const innerNodeId of Object.keys(innerNodeDefinitions)) {
    if (!referencedInnerNodeIds.has(innerNodeId)) {
      findings.push(
        finding(
          journey,
          'UNREFERENCED_INNER_NODE',
          `Inner node '${innerNodeId}' is not referenced by a Page Node`,
          { nodeId: innerNodeId }
        )
      );
    }
  }

  return findings;
}

/**
 * Validate journey graph references. Structural errors are marked as errors;
 * graph hygiene and outcome inconsistencies are reported as warnings.
 *
 * @param journey A single journey export.
 * @returns Findings associated with the journey.
 */
export function validateJourneyReferences(
  journey: JourneyValidationInput
): JourneyValidationFinding[] {
  const tree = journey.tree;
  const graphNodeIds = new Set([
    ...BUILT_IN_GRAPH_NODE_IDS,
    ...Object.keys(tree.nodes || {}),
    ...Object.keys(tree.staticNodes || {}),
  ]);
  const innerNodeDefinitions = getInnerNodeDefinitions(journey);

  return [
    ...checkNodeDefinitions(journey),
    ...checkEntryAndConnections(journey, graphNodeIds),
    ...findUnreachableNodes(journey, graphNodeIds),
    ...checkPageNodes(journey, innerNodeDefinitions),
  ];
}
