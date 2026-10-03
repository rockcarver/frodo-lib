/**
 * Public entrypoint for MCP capability-building primitives in frodo-lib.
 *
 * @remarks
 * This barrel keeps MCP-related contracts and helper functions grouped under a
 * single module namespace for downstream runtime and CLI integration.
 */

export {
  type McpCapabilityDescriptor,
  type McpCapabilityInventoryOptions,
  type McpCapabilityKind,
  type McpCapabilityOperationType,
  type McpCapabilityPolicy,
  type McpCapabilityPolicyPresetName,
  type McpCapabilityRiskClass,
  type McpDeploymentType,
  type McpToolAnnotations,
} from './CapabilityTypes';
export { MCP_POLICY_PRESETS, applyCapabilityPolicy } from './CapabilityPolicy';
export {
  type McpCapabilityRouting,
  type McpCapabilityRoutingStatus,
  describeCapabilityRouting,
  rankCapabilitiesForDeployment,
} from './CapabilityRouting';
export {
  type McpDiscoveryHydrationCatalog,
  type McpDiscoveryHydrationEvent,
  type McpDiscoveryHydrationOptions,
  hydrateMcpDiscoveryContext,
} from './DiscoveryHydration';
export {
  MCP_AMBIGUOUS_OBJECT_CONCEPTS,
  MCP_SEMANTIC_OBJECT_SYNONYMS,
  type McpManagedObjectFamilyMatch,
  type McpSemanticObjectFamily,
  type McpSemanticObjectFamilyResolution,
  descriptorPatternsSupportFamily,
  discoverManagedObjectFamilies,
  matchManagedObjectFamily,
  normalizeSemanticObjectFamily,
  resolveSemanticObjectFamily,
} from './SemanticObjectFamilies';
export {
  MCP_SEMANTIC_TERM_SYNONYMS,
  type McpSemanticIdentifierMatch,
  matchSemanticIdentifiers,
  normalizeSemanticIdentifier,
} from './SemanticIdentifiers';
export {
  capabilityMatchesAnyProfile,
  capabilityMatchesDisabled,
  getMcpProfileDefinition,
  listAllMcpProfiles,
  listMcpProfiles,
  resolveMcpProfileSelection,
} from './ProfileRegistry';
export {
  FORGEOPS_DOMAIN_PRODUCT_MAP,
  type McpDocsContext,
  type McpDocsContextForgeops,
  type McpDocsContextUnresolved,
  type McpDocsDomainProduct,
  type McpDocsProduct,
  classifyDomainProduct,
  parseAmDocsVersion,
  parseIdmDocsVersion,
  resolveDocsContext,
} from './DocsContext';
export {
  buildCapabilityInventory,
  inferObjectType,
  inferOperationType,
  inferRiskClass,
} from './CapabilityRegistry';
export {
  type McpCanonicalTool,
  type McpCatalogHydrationStatus,
  type McpDiscoveryContext,
  type McpDiscoveryEntry,
  type McpDiscoveryTarget,
  type McpManagedObjectHydrationStatus,
  type McpGenericTool,
  type McpObjectTypeEntry,
  type McpToolManifest,
  buildToolManifest,
} from './ToolManifest';
export {
  type McpDiscoverArguments,
  type McpExecutionPaginationMetadata,
  type McpExecutionScopeMetadata,
  type McpGenericExecutionArguments,
  type McpRuntimeAdminAccountAuth,
  type McpRuntimeAuth,
  type McpRuntimeRequestContext,
  type McpRuntimeServiceAccountAuth,
  type McpRuntimeStateAuth,
  type McpSpecialExecutionArguments,
  type McpToolExecutionRequest,
  type McpToolExecutionResult,
  type McpToolExecutionMetadata,
  type McpToolRuntime,
  type McpToolRuntimeOptions,
  type McpToolRuntimeTraceCandidate,
  type McpToolRuntimeTraceCriteria,
  type McpToolRuntimeTraceEvent,
  type McpToolRuntimeTraceHandler,
  createToolRuntime,
  getRealmFromContext,
  resolveRequestScopedFrodo,
} from './ToolRuntime';
export {
  type McpService,
  type McpServiceOptions,
  type McpServiceToolDefinition,
  composeCapabilityPolicy,
  createMcpService,
} from './McpService';
