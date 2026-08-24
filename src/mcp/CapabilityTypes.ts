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
 * Lightweight JSON-schema-style contract for a structured MCP parameter value.
 *
 * @remarks
 * This intentionally supports only the subset needed for agent guidance and
 * runtime validation.
 */
export type McpCapabilityParameterSchema = {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: unknown[];
  properties?: Record<string, McpCapabilityParameterSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: McpCapabilityParameterSchema;
};

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
  /** Optional schema contract for structured or enum-like parameter values. */
  schema?: McpCapabilityParameterSchema;
  /** Optional example values surfaced in discovery and validation errors. */
  examples?: unknown[];
};

/**
 * Per-parameter annotation overlay applied on top of an auto-derived
 * parameter (see {@link OperationCapabilityMeta.parameterOverrides}).
 *
 * @remarks
 * Deliberately excludes `name` and `position`: which parameters exist, in
 * which order, always comes from the auto-derived signature (Help.ts,
 * falling back to name-based inference) so it can't silently drift from the
 * real bound method. `type` and `required` may be set here too, but only
 * for refinements the type system can't express on its own (e.g. narrowing
 * a `number` to a JSON-Schema `integer`, or documenting an MCP-dispatch-
 * layer default that makes an otherwise-required parameter effectively
 * optional at the call site) — not as a general-purpose escape hatch.
 */
export type McpCapabilityParameterOverlay = Partial<
  Pick<
    McpCapabilityParameter,
    'type' | 'required' | 'description' | 'defaultValue' | 'schema' | 'examples'
  >
>;

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
  /** Curated natural-language phrases used to retrieve this capability. */
  semanticAliases?: string[];
  /**
   * A credential beyond the standard AM/IDM bearer token this capability
   * requires. When set, the runtime verifies it's present on the dispatching
   * Frodo instance's state before invoking the descriptor, and fails fast with
   * an actionable error instead of letting the underlying API call 401.
   * Set from {@link OperationCapabilityMeta.requiredCredential} when available.
   */
  requiredCredential?: McpRequiredCredential;
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
  /** Optional allow-list of capability module/id path prefixes. */
  allowCapabilityPathPrefixes?: string[];
  /** Optional deny-list of capability module/id path prefixes. */
  denyCapabilityPathPrefixes?: string[];
  includeSpecial?: boolean;
};

/**
 * Built-in policy preset names recognized by the baseline MCP capability layer.
 */
export type McpCapabilityPolicyPresetName =
  | 'read-only'
  | 'agentic'
  | 'standard'
  | 'admin';

/**
 * Identifies the identity data surface a capability operates on.
 *
 * @remarks
 * - `managed` — IDM managed objects accessed via `openidm/managed/` (cloud + forgeops only)
 * - `am-user` — AM realm users accessed via the AM REST API (classic only)
 * - `connector-system` — Objects in an ICF connector system via `openidm/system/` (cloud + forgeops only)
 * - `unknown` — Surface not classified
 */
export type McpIdentitySurface =
  | 'managed'
  | 'am-user'
  | 'connector-system'
  | 'unknown';

/**
 * Identifies a credential a capability needs beyond the standard AM/IDM bearer
 * token, which the MCP runtime should verify is present before dispatching.
 *
 * @remarks
 * - `logApi` — a Log API key/secret (`state.getLogApiKey()`/`getLogApiSecret()`),
 *   used by the Identity Cloud debug/audit log endpoints, which authenticate
 *   with `X-API-Key`/`X-API-Secret` rather than the AM session bearer token.
 */
export type McpRequiredCredential = 'logApi';

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
   * A credential beyond the standard AM/IDM bearer token this capability
   * requires. See {@link McpRequiredCredential}.
   */
  requiredCredential?: McpRequiredCredential;

  /**
   * Glob-style object type patterns this capability applies to.
   * Used by discovery to map object names (e.g. `alpha_user`) to the preferred domain.
   * Examples: `['*_user', '*_organization', '*_application']`
   */
  objectTypePatterns?: string[];

  /** Optional human-readable note surfaced in discovery tool output. */
  notes?: string;

  /** Curated natural-language phrases used for capability retrieval. */
  semanticAliases?: string[];

  /** Explicit MCP-facing argument mode override for the capability. */
  argumentMode?: McpCapabilityArgumentMode;

  /**
   * Per-parameter annotation overlay, keyed by the parameter's auto-derived
   * name (from Help.ts, falling back to name-based inference). Only fields
   * present in {@link McpCapabilityParameterOverlay} may be set — the
   * auto-derived parameter list (which parameters exist, their order) is
   * always the baseline, so an entry here can annotate a real parameter but
   * can never fabricate one, silently reorder one, or hide a signature
   * change. Use {@link excludeParameters} to hide a parameter entirely.
   */
  parameterOverrides?: Record<string, McpCapabilityParameterOverlay>;

  /**
   * Names of auto-derived parameters to exclude from this capability's
   * advertised parameter contract — e.g. a trailing `resultCallback` (a JS
   * function reference an MCP JSON payload can never carry).
   */
  excludeParameters?: string[];

  /** Optional selector value used to distinguish single vs bulk semantics, etc. */
  scope?: McpCapabilityScope;

  /** Whether the capability supports MCP realm override controls. */
  supportsRealm?: boolean;

  /** Whether the capability supports MCP paging controls. */
  supportsPaging?: boolean;

  /** Whether the capability supports MCP includeTotal hints. */
  supportsIncludeTotal?: boolean;

  /**
   * Explicit operation-type override for capabilities whose method name doesn't
   * follow the CRUD naming convention `inferOperationType` relies on (e.g. `fetch`,
   * `tail`). When set, this wins over naming-convention inference and also drives
   * the derived `kind` (`'special'` iff `operationType === 'special'`).
   */
  operationType?: McpCapabilityOperationType;

  /**
   * Explicit object-type override for capabilities whose method name doesn't carry
   * an inferable object-type suffix (e.g. `fetch` → `LogEvent`). When set, this wins
   * over naming-convention inference.
   */
  objectType?: string;

  /**
   * Explicit mutating override. Naming-convention inference only recognizes
   * `create`/`update`/`delete`/`import` as mutating, so any capability that writes
   * state under a different verb (including one classified `operationType: 'special'`)
   * needs this set explicitly rather than relying on the permissive `false` default.
   */
  mutating?: boolean;

  /**
   * Explicit destructive-hint override, analogous to {@link mutating}.
   */
  destructive?: boolean;

  /**
   * Explicit risk-class override. Naming-convention inference only escalates risk
   * for `delete`/`import`/`export`/`create`/`update` and secret-ish keyword matches,
   * so non-CRUD capabilities that warrant elevated caution need this set explicitly.
   */
  riskClass?: McpCapabilityRiskClass;

  /**
   * When `true`, this capability is dropped from the inventory entirely instead of
   * becoming a descriptor. Intended for methods that make no tenant/API call (pure
   * local helpers) and therefore aren't remote operations at all.
   */
  excluded?: boolean;
};
