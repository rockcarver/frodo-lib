export type JourneyValidationSeverity = 'error' | 'warning';

/**
 * `MISSING_NODE_DEFINITION`, `NODE_ID_MISMATCH`, `MISSING_CONNECTION_TARGET`,
 * `MISSING_ENTRY_NODE`, and `MISSING_INNER_NODE` are errors. All other codes
 * are warnings: `UNKNOWN_CONNECTION_OUTCOME`, `UNCONNECTED_OUTCOME`,
 * `UNREACHABLE_NODE`, `UNREFERENCED_INNER_NODE`, `UNREPRESENTED_NODE`, and
 * `PAGE_NODE_OUTCOME_MISMATCH`.
 */
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

export interface JourneyValidationFinding {
  code: JourneyValidationCode;
  severity: JourneyValidationSeverity;
  journeyId: string;
  message: string;
  nodeId?: string;
  targetNodeId?: string;
  outcome?: string;
}

interface JourneyNodeDefinition {
  _id?: string;
  _type?: { _id?: string };
  _outcomes?: { id?: string }[];
  nodes?: { _id?: string }[];
}

interface JourneyNodeReference {
  connections?: Record<string, string>;
}

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

export function validateJourneyReferences(
  journey: JourneyValidationInput
): JourneyValidationFinding[] {
  const tree = journey.tree;
  const journeyId = tree._id || '<unknown>';
  const treeNodes = tree.nodes || {};
  const staticNodes = tree.staticNodes || {};
  const nodeDefinitions = journey.nodes || {};
  const innerNodeDefinitions =
    journey.innerNodes && Object.keys(journey.innerNodes).length > 0
      ? journey.innerNodes
      : journey.innernodes || journey.innerNodes || {};
  const findings: JourneyValidationFinding[] = [];
  const builtInGraphNodeIds = [
    '70e691a5-1e33-4ac3-a356-e7b6d60d92e0',
    'e301438c-0bd0-429c-ab0c-66126501069a',
    'startNode',
  ];

  const addFinding = (
    code: JourneyValidationCode,
    severity: JourneyValidationSeverity,
    message: string,
    details: Pick<
      JourneyValidationFinding,
      'nodeId' | 'targetNodeId' | 'outcome'
    > = {}
  ) => {
    findings.push({ code, severity, journeyId, message, ...details });
  };

  for (const [nodeId, nodeReference] of Object.entries(treeNodes)) {
    const definition = nodeDefinitions[nodeId];
    if (!definition) {
      addFinding(
        'MISSING_NODE_DEFINITION',
        'error',
        `Tree node '${nodeId}' has no node definition`,
        { nodeId }
      );
      continue;
    }
    const declaredOutcomes = outcomeIds(definition);
    for (const outcome of Object.keys(nodeReference.connections || {})) {
      if (!declaredOutcomes.has(outcome)) {
        addFinding(
          'UNKNOWN_CONNECTION_OUTCOME',
          'warning',
          `Connection outcome '${outcome}' is not declared by node '${nodeId}'`,
          { nodeId, outcome }
        );
      }
    }
    for (const outcome of declaredOutcomes) {
      if (!hasOwnKey(nodeReference.connections || {}, outcome)) {
        addFinding(
          'UNCONNECTED_OUTCOME',
          'warning',
          `Declared outcome '${outcome}' on node '${nodeId}' has no connection`,
          { nodeId, outcome }
        );
      }
    }
  }

  for (const [nodeId, definition] of Object.entries(nodeDefinitions)) {
    if (definition._id !== nodeId) {
      addFinding(
        'NODE_ID_MISMATCH',
        'error',
        `Node definition key '${nodeId}' does not match _id '${definition._id}'`,
        { nodeId }
      );
    }
    if (!hasOwnKey(treeNodes, nodeId)) {
      addFinding(
        'UNREPRESENTED_NODE',
        'warning',
        `Node definition '${nodeId}' is not represented in tree.nodes`,
        { nodeId }
      );
    }
  }

  for (const [innerNodeId, definition] of Object.entries(
    innerNodeDefinitions
  )) {
    if (definition._id !== innerNodeId) {
      addFinding(
        'NODE_ID_MISMATCH',
        'error',
        `Inner node definition key '${innerNodeId}' does not match _id '${definition._id}'`,
        { nodeId: innerNodeId }
      );
    }
  }

  const graphNodeIds = new Set([
    ...builtInGraphNodeIds,
    ...Object.keys(treeNodes),
    ...Object.keys(staticNodes),
  ]);
  const entryNodeId = tree.entryNodeId;
  if (!entryNodeId || !graphNodeIds.has(entryNodeId)) {
    addFinding(
      'MISSING_ENTRY_NODE',
      'error',
      `Entry node '${entryNodeId || ''}' does not resolve to a graph node`,
      { nodeId: entryNodeId }
    );
  }

  for (const [nodeId, nodeReference] of Object.entries(treeNodes)) {
    for (const targetNodeId of Object.values(nodeReference.connections || {})) {
      if (!graphNodeIds.has(targetNodeId)) {
        addFinding(
          'MISSING_CONNECTION_TARGET',
          'error',
          `Connection from node '${nodeId}' targets missing graph node '${targetNodeId}'`,
          { nodeId, targetNodeId }
        );
      }
    }
  }

  const reachableNodeIds = new Set<string>();
  if (entryNodeId && graphNodeIds.has(entryNodeId)) {
    const pendingNodeIds = [entryNodeId];
    while (pendingNodeIds.length > 0) {
      const nodeId = pendingNodeIds.pop();
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
  for (const nodeId of Object.keys(treeNodes)) {
    if (!reachableNodeIds.has(nodeId)) {
      addFinding(
        'UNREACHABLE_NODE',
        'warning',
        `Tree node '${nodeId}' is not reachable from the entry node`,
        { nodeId }
      );
    }
  }

  const referencedInnerNodeIds = new Set<string>();
  for (const [nodeId, definition] of Object.entries(nodeDefinitions)) {
    if (
      definition._type?._id !== 'PageNode' &&
      definition._type?._id !== 'CustomPageNode'
    ) {
      continue;
    }

    const exposedOutcomeIds = new Set<string>();
    for (const innerNodeReference of definition.nodes || []) {
      const innerNodeId = innerNodeReference._id;
      if (!innerNodeId) {
        continue;
      }
      referencedInnerNodeIds.add(innerNodeId);
      const innerNode = innerNodeDefinitions[innerNodeId];
      if (!innerNode) {
        addFinding(
          'MISSING_INNER_NODE',
          'error',
          `Page Node '${nodeId}' references missing inner node '${innerNodeId}'`,
          { nodeId, targetNodeId: innerNodeId }
        );
        continue;
      }
      for (const outcome of outcomeIds(innerNode)) {
        exposedOutcomeIds.add(`${innerNode._id}-${outcome}`);
      }
    }

    for (const outcome of outcomeIds(definition)) {
      if (!exposedOutcomeIds.has(outcome)) {
        addFinding(
          'PAGE_NODE_OUTCOME_MISMATCH',
          'warning',
          `Page Node '${nodeId}' outcome '${outcome}' is not exposed by its inner nodes`,
          { nodeId, outcome }
        );
      }
    }
  }

  for (const innerNodeId of Object.keys(innerNodeDefinitions)) {
    if (!referencedInnerNodeIds.has(innerNodeId)) {
      addFinding(
        'UNREFERENCED_INNER_NODE',
        'warning',
        `Inner node '${innerNodeId}' is not referenced by a Page Node`,
        { nodeId: innerNodeId }
      );
    }
  }

  return findings;
}
