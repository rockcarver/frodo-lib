/**
 * Canonical, deployment- and consumer-agnostic classification of what kind
 * of operation a frodo-lib ops-layer function performs.
 *
 * @remarks
 * This lives in `shared/` (core library, no dependency on `mcp/`) precisely
 * so that both ordinary ops modules (e.g. each module's `getRequiredScopes()`
 * — see `ops/RequiredScopesOps.ts`) and the MCP capability layer
 * (`mcp/CapabilityTypes.ts`'s `McpCapabilityOperationType`, which is a type
 * alias of this one) can share one vocabulary. Core library code must never
 * import from `mcp/` — dependencies only ever flow the other way.
 */
export type OperationType =
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
