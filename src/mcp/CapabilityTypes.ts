/**
 * Defines the canonical type contracts used by the MCP capability layer.
 *
 * @remarks
 * This module is intentionally declarative. It provides the shared vocabulary for
 * capability discovery, policy filtering, and runtime registration so each layer
 * can evolve independently without breaking shape compatibility.
 */

/**
 * Normalized operation kinds inferred from Frodo methods or explicitly supplied by
 * metadata in future registry manifests.
 */
export type McpCapabilityOperationType =
  | 'create'
  | 'count'
  | 'read'
  | 'update'
  | 'delete'
  | 'search'
  | 'list'
  | 'export'
  | 'import'
  | 'special';

/**
 * Risk classification used by policy presets and launch-time exposure controls.
 */
export type McpCapabilityRiskClass = 'low' | 'medium' | 'high' | 'critical';

/**
 * High-level classification of whether a capability maps to the generic MCP tool
 * surface or must be exposed as a domain-specific operation.
 */
export type McpCapabilityKind = 'generic' | 'special';

/**
 * Deployment families that can be used to constrain capability exposure.
 */
export type McpDeploymentType = 'cloud' | 'classic' | 'forgeops' | 'any';

/**
 * MCP tool behavior hints that clients and models may use during tool selection.
 */
export type McpToolAnnotations = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

/**
 * Argument-shape contract surfaced to MCP callers for a capability.
 */
export type McpCapabilityArgumentMode =
  | 'none'
  | 'positional'
  | 'named'
  | 'mixed';

/**
 * Parameter definition for a capability exposed through discovery metadata.
 */
export type McpCapabilityParameter = {
  name: string;
  type: string;
  required?: boolean;
  position?: number;
  description?: string;
  /** Optional MCP-side default applied when the caller omits this parameter. */
  defaultValue?: unknown;
};

/**
 * Optional selector that disambiguates multiple capabilities sharing the same
 * generic `(operationType, domain, objectType)` tuple.
 */
export type McpCapabilityScope = 'single' | 'bulk';

/**
 * Canonical capability descriptor produced by inventory/registry builders.
 */
export type McpCapabilityDescriptor = {
  id: string;
  toolName: string;
  methodName: string;
  modulePath: string[];
  domain: string;
  objectType: string;
  operationType: McpCapabilityOperationType;
  /** Optional MCP-facing argument contract for this capability. */
  argumentMode?: McpCapabilityArgumentMode;
  /** Optional ordered/named parameter metadata for this capability. */
  parameters?: McpCapabilityParameter[];
  /** Optional selector value used to disambiguate generic capabilities. */
  scope?: McpCapabilityScope;
  /** Whether the generic tool supports realm override for this capability. */
  supportsRealm?: boolean;
  /** Whether the generic tool supports paging hints for this capability. */
  supportsPaging?: boolean;
  /** Whether the generic tool supports includeTotal for this capability. */
  supportsIncludeTotal?: boolean;
  kind: McpCapabilityKind;
  riskClass: McpCapabilityRiskClass;
  mutating: boolean;
  destructive: boolean;
  /** Deployment families where this capability is functional. Defaults to `['any']`. */
  deploymentTypes: McpDeploymentType[];
  /**
   * Deployment families where this capability is the preferred/optimal choice.
   * Set from {@link OperationCapabilityMeta.preferredDeploymentTypes} when available;
   * absent when no explicit preference has been declared.
   */
  preferredDeploymentTypes?: McpDeploymentType[];
  /**
   * Identity surface this capability operates on.
   * Set from {@link OperationCapabilityMeta.identitySurface} when available.
   */
  identitySurface?: McpIdentitySurface;
  /**
   * Glob-style object type patterns this capability applies to.
   * Set from {@link OperationCapabilityMeta.objectTypePatterns} when available.
   */
  objectTypePatterns?: string[];
  /** Optional human-readable note surfaced in discovery and validation output. */
  notes?: string;
  requiredScopes: string[];
  annotations: McpToolAnnotations;
};

/**
 * Controls for capability inventory generation.
 */
export type McpCapabilityInventoryOptions = {
  includeTopLevelDomains?: string[];
  excludeTopLevelDomains?: string[];
  includeUtils?: boolean;
};

/**
 * Policy model used to include or exclude capabilities before registration.
 */
export type McpCapabilityPolicy = {
  name: string;
  allowOperationTypes?: McpCapabilityOperationType[];
  denyOperationTypes?: McpCapabilityOperationType[];
  allowRiskClasses?: McpCapabilityRiskClass[];
  denyRiskClasses?: McpCapabilityRiskClass[];
  allowDomains?: string[];
  denyDomains?: string[];
  includeSpecial?: boolean;
};

/**
 * Built-in policy preset names recognized by the baseline MCP capability layer.
 */
export type McpCapabilityPolicyPresetName = 'read-only' | 'standard' | 'admin';

/**
 * Identifies the identity data surface a capability operates on.
 *
 * @remarks
 * - `managed` — IDM managed objects accessed via `openidm/managed/` (cloud + forgeops only)
 * - `am-user` — AM realm users accessed via the AM REST API (all deployment types)
 * - `connector-system` — Objects in an ICF connector system via `openidm/system/` (cloud + forgeops only)
 * - `unknown` — Surface not classified
 */
export type McpIdentitySurface =
  | 'managed'
  | 'am-user'
  | 'connector-system'
  | 'unknown';

/**
 * Explicit capability metadata entry stored in the static {@link CAPABILITY_META} map.
 *
 * @remarks
 * Entries in the static map are keyed by a capability ID (exact dot-path match, e.g.
 * `"idm.managed.countManagedObjects"`) or by a module prefix (e.g. `"idm.managed"`) that
 * covers all capabilities whose IDs start with that prefix. Exact matches take priority
 * over prefix matches. All fields are optional — only overrides need to be specified; the
 * registry falls back to inferred defaults for absent fields.
 */
export type OperationCapabilityMeta = {
  /**
   * Explicit complete list of deployment types where this capability is functional.
   * When set, overrides the default `['any']` inferred by the registry.
   */
  deploymentTypes?: McpDeploymentType[];

  /**
   * Subset of `deploymentTypes` indicating the deployment(s) where this capability
   * is the optimal/recommended choice for the given object surface. Used by
   * `frodo_discover` to produce routing hints for agents.
   */
  preferredDeploymentTypes?: McpDeploymentType[];

  /**
   * The identity data surface this capability operates on.
   * Enables discovery tools to recommend the right domain for a given object type.
   */
  identitySurface?: McpIdentitySurface;

  /**
   * Glob-style object type patterns this capability applies to.
   * Used by discovery to map object names (e.g. `alpha_user`) to the preferred domain.
   * Examples: `['*_user', '*_organization', '*_application']`
   */
  objectTypePatterns?: string[];

  /** Optional human-readable note surfaced in discovery tool output. */
  notes?: string;

  /** Explicit MCP-facing argument mode override for the capability. */
  argumentMode?: McpCapabilityArgumentMode;

  /** Explicit ordered parameter metadata used for discovery and validation. */
  parameters?: McpCapabilityParameter[];

  /** Optional selector value used to distinguish single vs bulk semantics, etc. */
  scope?: McpCapabilityScope;

  /** Whether the capability supports MCP realm override controls. */
  supportsRealm?: boolean;

  /** Whether the capability supports MCP paging controls. */
  supportsPaging?: boolean;

  /** Whether the capability supports MCP includeTotal hints. */
  supportsIncludeTotal?: boolean;
};
