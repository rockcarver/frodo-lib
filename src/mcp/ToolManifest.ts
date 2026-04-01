/**
 * Converts a flat capability inventory into the reduced MCP tool surface.
 *
 * @remarks
 * The manifest layer is the bridge between the registry (one descriptor per
 * Frodo method) and the MCP runtime (one registered tool per unique operation
 * category). Generic CRUDS-style tools accept `domain` and `objectType`
 * parameters so the full breadth of the library is reachable via a small,
 * stable set of tool names — keeping the exposed surface well under 40 tools
 * by default while special-purpose domain operations are exposed individually.
 *
 * A built-in discovery tool is always present in every manifest, enabling
 * agents to introspect the available operation space without requiring
 * out-of-band documentation.
 *
 * Typical usage:
 * ```typescript
 * const inventory = buildCapabilityInventory(frodo);
 * const filtered  = applyCapabilityPolicy(inventory, MCP_POLICY_PRESETS['standard']);
 * const manifest  = buildToolManifest(filtered);
 * ```
 */

import {
  McpCapabilityDescriptor,
  McpCapabilityOperationType,
  McpCapabilityRiskClass,
  McpToolAnnotations,
} from './CapabilityTypes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Ascending order used to compare risk classes numerically.
 * A higher index means higher risk.
 */
const RISK_ORDER: McpCapabilityRiskClass[] = [
  'low',
  'medium',
  'high',
  'critical',
];

/** Fixed tool name for the built-in introspection/discovery tool. */
const DISCOVERY_TOOL_NAME = 'frodo_discover' as const;

/**
 * Human-readable descriptions keyed by operation type.
 * Used when registering generic tools with an MCP runtime.
 */
const GENERIC_TOOL_DESCRIPTIONS: Record<McpCapabilityOperationType, string> = {
  create:
    'Create a new domain object of the specified type in a Ping AM/IDM domain.',
  count:
    'Count domain objects of a given type in a Ping AM/IDM domain. Use this for exact totals instead of inferring totals from paginated list/search responses.',
  read: 'Read a single domain object by identifier or name from a Ping AM/IDM domain.',
  update: 'Update an existing domain object in a Ping AM/IDM domain.',
  delete:
    'Delete a domain object by identifier or name from a Ping AM/IDM domain.',
  list: 'List domain objects of a given type in a Ping AM/IDM domain. Results may be paginated; do not infer totals from a single response page. Provide explicit realm scoping where supported.',
  search:
    'Search for domain objects matching a query in a Ping AM/IDM domain. Results may be paginated; do not infer totals from a single response page. Provide explicit realm scoping where supported.',
  export:
    'Export domain objects of the specified type to a portable configuration bundle.',
  import:
    'Import domain objects of the specified type from a portable configuration bundle.',
  special:
    'Execute a domain-specific operation that does not map to standard CRUDS semantics.',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * One `(domain, objectType)` combination supported by a generic tool.
 * Each entry corresponds to exactly one backing capability descriptor.
 */
export type McpObjectTypeEntry = {
  /** Domain key the object type lives in, e.g. `'authn'`. */
  domain: string;
  /** Singular PascalCase object type label, e.g. `'Journey'`. */
  objectType: string;
  /** Id of the source {@link McpCapabilityDescriptor} that backs this entry. */
  descriptorId: string;
  /** Risk class of the backing descriptor. */
  riskClass: McpCapabilityRiskClass;
  /** MCP annotations from the backing descriptor. */
  annotations: McpToolAnnotations;
};

/**
 * A single generic CRUDS-style tool in the manifest, parameterized by
 * `domain` and `objectType`. Many source descriptors collapse into one tool.
 */
export type McpGenericTool = {
  /** Stable MCP tool name, e.g. `'frodo_read'`. */
  toolName: string;
  /** Operation type this tool executes. */
  operationType: McpCapabilityOperationType;
  /** Description suitable for MCP tool registration and model guidance. */
  description: string;
  /**
   * Conservative union of MCP annotations across all backed capabilities.
   * - `readOnlyHint`: `true` only when every backed capability is read-only.
   * - `destructiveHint`: `true` if any backed capability is destructive.
   * - `idempotentHint`: `true` only when every backed capability is idempotent.
   * - `openWorldHint`: always `false`.
   */
  annotations: McpToolAnnotations;
  /** Highest risk class present across all backed capabilities. */
  riskClass: McpCapabilityRiskClass;
  /** All `(domain, objectType)` pairs reachable through this tool. */
  supportedObjectTypes: McpObjectTypeEntry[];
};

/**
 * A single domain-special tool, backed by exactly one non-CRUDS descriptor.
 */
export type McpSpecialTool = {
  /** MCP tool name derived from the descriptor's dot-separated path. */
  toolName: string;
  /** Domain the operation belongs to, e.g. `'authn'`. */
  domain: string;
  /** Description suitable for MCP tool registration and model guidance. */
  description: string;
  /** Original capability descriptor that backs this tool. */
  descriptor: McpCapabilityDescriptor;
};

/**
 * Entry for the built-in introspection tool.
 * Agents can invoke this to learn what object types and operations are
 * available without requiring external documentation.
 */
export type McpDiscoveryEntry = {
  /** Fixed tool name — always `'frodo_discover'`. */
  toolName: typeof DISCOVERY_TOOL_NAME;
  /** Description for MCP tool registration. */
  description: string;
  /** Sorted list of all domain keys present in the manifest. */
  domains: string[];
  /**
   * Mapping from domain key to the sorted list of object type labels that
   * are reachable within that domain through generic tools.
   */
  objectTypesByDomain: Record<string, string[]>;
  /**
   * Mapping from operation type to sorted `"domain.ObjectType"` strings,
   * listing every `(domain, objectType)` pair that supports that operation.
   */
  operationsByType: Partial<Record<McpCapabilityOperationType, string[]>>;
};

/**
 * The complete reduced tool surface derived from a policy-filtered capability
 * inventory.
 */
export type McpToolManifest = {
  /** Generic CRUDS tools parameterized by domain and objectType. */
  genericTools: McpGenericTool[];
  /** One-per-descriptor tools for non-standard domain capabilities. */
  specialTools: McpSpecialTool[];
  /** Built-in introspection tool entry describing the available operation space. */
  discoveryTool: McpDiscoveryEntry;
  /** Number of capability descriptors that back this manifest. */
  backingDescriptorCount: number;
  /** Total exposed tool count: `genericTools.length + specialTools.length + 1`. */
  totalToolCount: number;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a reduced MCP tool manifest from a policy-filtered capability
 * inventory.
 *
 * @remarks
 * The caller is responsible for applying policy **before** calling this
 * function. Use {@link applyCapabilityPolicy} from `CapabilityPolicy` to
 * filter the inventory first.
 *
 * Generic capabilities (`kind === 'generic'`) are collapsed by
 * `operationType`, each producing one {@link McpGenericTool} with an
 * enumerated `supportedObjectTypes` list. Special capabilities
 * (`kind === 'special'`) produce one {@link McpSpecialTool} each. A single
 * {@link McpDiscoveryEntry} is always appended and counted in `totalToolCount`.
 *
 * @param capabilities Policy-filtered capability descriptors.
 * @returns Fully populated tool manifest ready for MCP runtime registration.
 */
export function buildToolManifest(
  capabilities: McpCapabilityDescriptor[]
): McpToolManifest {
  const generic = capabilities.filter((c) => c.kind === 'generic');
  const special = capabilities.filter((c) => c.kind === 'special');

  const genericTools = buildGenericTools(generic);
  const specialTools = buildSpecialTools(special);
  const discoveryTool = buildDiscoveryEntry(genericTools, specialTools);

  return {
    genericTools,
    specialTools,
    discoveryTool,
    backingDescriptorCount: capabilities.length,
    totalToolCount: genericTools.length + specialTools.length + 1,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Collapses generic descriptors into one {@link McpGenericTool} per unique
 * operation type.
 *
 * @param descriptors Generic capability descriptors (`kind === 'generic'`).
 * @returns One tool per unique operation type, sorted alphabetically by name.
 */
function buildGenericTools(
  descriptors: McpCapabilityDescriptor[]
): McpGenericTool[] {
  const byOp = new Map<McpCapabilityOperationType, McpCapabilityDescriptor[]>();
  for (const d of descriptors) {
    const group = byOp.get(d.operationType) ?? [];
    group.push(d);
    byOp.set(d.operationType, group);
  }

  const tools: McpGenericTool[] = [];
  for (const [opType, group] of byOp) {
    const supportedObjectTypes: McpObjectTypeEntry[] = group.map((d) => ({
      domain: d.domain,
      objectType: d.objectType,
      descriptorId: d.id,
      riskClass: d.riskClass,
      annotations: d.annotations,
    }));

    tools.push({
      toolName: `frodo_${opType}`,
      operationType: opType,
      description: GENERIC_TOOL_DESCRIPTIONS[opType],
      annotations: mergeAnnotations(group.map((d) => d.annotations)),
      riskClass: mergeRiskClass(group.map((d) => d.riskClass)),
      supportedObjectTypes,
    });
  }

  return tools.sort((a, b) => a.toolName.localeCompare(b.toolName));
}

/**
 * Produces one {@link McpSpecialTool} per special-kind descriptor.
 *
 * @param descriptors Special capability descriptors (`kind === 'special'`).
 * @returns Array of special tools sorted alphabetically by tool name.
 */
function buildSpecialTools(
  descriptors: McpCapabilityDescriptor[]
): McpSpecialTool[] {
  return descriptors
    .map((d) => ({
      toolName: d.toolName,
      domain: d.domain,
      description: buildSpecialDescription(d),
      descriptor: d,
    }))
    .sort((a, b) => a.toolName.localeCompare(b.toolName));
}

/**
 * Builds the discovery tool entry that enumerates the full operation space of
 * the manifest.
 *
 * @param genericTools Populated generic tools from {@link buildGenericTools}.
 * @param specialTools Populated special tools from {@link buildSpecialTools}.
 * @returns A fully populated {@link McpDiscoveryEntry}.
 */
function buildDiscoveryEntry(
  genericTools: McpGenericTool[],
  specialTools: McpSpecialTool[]
): McpDiscoveryEntry {
  const domainSet = new Set<string>();
  const objectTypesByDomain: Record<string, Set<string>> = {};
  const operationsByType: Partial<
    Record<McpCapabilityOperationType, string[]>
  > = {};

  for (const tool of genericTools) {
    operationsByType[tool.operationType] = [];
    for (const entry of tool.supportedObjectTypes) {
      domainSet.add(entry.domain);
      const typeSet = (objectTypesByDomain[entry.domain] ??= new Set<string>());
      typeSet.add(entry.objectType);
      operationsByType[tool.operationType]!.push(
        `${entry.domain}.${entry.objectType}`
      );
    }
  }

  // Special tools contribute their domain to the domains list only.
  for (const tool of specialTools) {
    domainSet.add(tool.domain);
  }

  // Convert sets to sorted arrays.
  const domains = [...domainSet].sort();
  const objectTypesByDomainResult: Record<string, string[]> = {};
  for (const [domain, typeSet] of Object.entries(objectTypesByDomain)) {
    objectTypesByDomainResult[domain] = [...typeSet].sort();
  }
  for (const key of Object.keys(
    operationsByType
  ) as McpCapabilityOperationType[]) {
    operationsByType[key] = operationsByType[key]!.sort();
  }

  return {
    toolName: DISCOVERY_TOOL_NAME,
    description:
      'Discover all Ping AM/IDM domain object types, domains, and operations ' +
      'available in this MCP server instance. Call this tool to learn what ' +
      'object types and domains are supported under the current policy before ' +
      'performing any operation.',
    domains,
    objectTypesByDomain: objectTypesByDomainResult,
    operationsByType,
  };
}

/**
 * Derives a human-readable MCP tool description from a special-kind
 * descriptor by converting the camelCase method name to title-case prose.
 *
 * @example
 * `enableJourney` in domain `authn` → `"Enable Journey (authn domain)."`
 *
 * @param descriptor The special-kind capability descriptor.
 * @returns A short description suitable for MCP tool registration.
 */
function buildSpecialDescription(descriptor: McpCapabilityDescriptor): string {
  const readable = descriptor.methodName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
  return `${readable} (${descriptor.domain} domain).`;
}

/**
 * Merges multiple annotation sets into the most conservative union.
 *
 * @remarks
 * Conservative merge rules:
 * - `readOnlyHint`: `true` only if **every** entry is read-only.
 * - `destructiveHint`: `true` if **any** entry is destructive.
 * - `idempotentHint`: `true` only if **every** entry is idempotent.
 * - `openWorldHint`: always `false`.
 *
 * @param annotations Array of annotation sets to merge.
 * @returns Merged annotation set, or safe defaults for an empty array.
 */
function mergeAnnotations(
  annotations: McpToolAnnotations[]
): McpToolAnnotations {
  if (annotations.length === 0) {
    return {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    };
  }
  return {
    readOnlyHint: annotations.every((a) => a.readOnlyHint),
    destructiveHint: annotations.some((a) => a.destructiveHint),
    idempotentHint: annotations.every((a) => a.idempotentHint),
    openWorldHint: false,
  };
}

/**
 * Returns the highest risk class from an array of risk classes.
 *
 * @param classes Array of risk classes to compare.
 * @returns The highest individual risk class, or `'low'` for an empty array.
 */
function mergeRiskClass(
  classes: McpCapabilityRiskClass[]
): McpCapabilityRiskClass {
  let max: McpCapabilityRiskClass = 'low';
  for (const c of classes) {
    if (RISK_ORDER.indexOf(c) > RISK_ORDER.indexOf(max)) {
      max = c;
    }
  }
  return max;
}
