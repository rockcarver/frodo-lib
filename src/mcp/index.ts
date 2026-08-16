/**
 * Public entrypoint for MCP capability-building primitives in frodo-lib.
 *
 * @remarks
 * This barrel keeps MCP-related contracts and helper functions grouped under a
 * single module namespace for downstream runtime and CLI integration.
 */

export {
  McpCapabilityDescriptor,
  McpCapabilityInventoryOptions,
  McpCapabilityKind,
  McpCapabilityOperationType,
  McpCapabilityPolicy,
  McpCapabilityPolicyPresetName,
  McpCapabilityRiskClass,
  McpDeploymentType,
  McpToolAnnotations,
} from './CapabilityTypes';
export { MCP_POLICY_PRESETS, applyCapabilityPolicy } from './CapabilityPolicy';
export {
  McpCapabilityRouting,
  McpCapabilityRoutingStatus,
  describeCapabilityRouting,
  rankCapabilitiesForDeployment,
} from './CapabilityRouting';
export {
  McpDiscoveryHydrationCatalog,
  McpDiscoveryHydrationEvent,
  McpDiscoveryHydrationOptions,
  hydrateMcpDiscoveryContext,
} from './DiscoveryHydration';
export {
  MCP_AMBIGUOUS_OBJECT_CONCEPTS,
  MCP_SEMANTIC_OBJECT_SYNONYMS,
  McpManagedObjectFamilyMatch,
  McpSemanticObjectFamily,
  McpSemanticObjectFamilyResolution,
  descriptorPatternsSupportFamily,
  discoverManagedObjectFamilies,
  matchManagedObjectFamily,
  normalizeSemanticObjectFamily,
  resolveSemanticObjectFamily,
} from './SemanticObjectFamilies';
export {
  MCP_SEMANTIC_TERM_SYNONYMS,
  McpSemanticIdentifierMatch,
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
  McpDocsContext,
  McpDocsContextUnresolved,
  McpDocsProduct,
  parseAmDocsVersion,
  resolveDocsContext,
} from './DocsContext';
export {
  buildCapabilityInventory,
  inferObjectType,
  inferOperationType,
  inferRiskClass,
} from './CapabilityRegistry';
export {
  McpCanonicalTool,
  McpCatalogHydrationStatus,
  McpDiscoveryContext,
  McpDiscoveryEntry,
  McpDiscoveryTarget,
  McpManagedObjectHydrationStatus,
  McpGenericTool,
  McpObjectTypeEntry,
  McpToolManifest,
  buildToolManifest,
} from './ToolManifest';
export {
  McpDiscoverArguments,
  McpExecutionPaginationMetadata,
  McpExecutionScopeMetadata,
  McpGenericExecutionArguments,
  McpRuntimeAdminAccountAuth,
  McpRuntimeAuth,
  McpRuntimeRequestContext,
  McpRuntimeServiceAccountAuth,
  McpRuntimeStateAuth,
  McpSpecialExecutionArguments,
  McpToolExecutionRequest,
  McpToolExecutionResult,
  McpToolExecutionMetadata,
  McpToolRuntime,
  McpToolRuntimeOptions,
  McpToolRuntimeTraceCandidate,
  McpToolRuntimeTraceCriteria,
  McpToolRuntimeTraceEvent,
  McpToolRuntimeTraceHandler,
  createToolRuntime,
  resolveRequestScopedFrodo,
} from './ToolRuntime';
export {
  McpService,
  McpServiceOptions,
  McpServiceToolDefinition,
  composeCapabilityPolicy,
  createMcpService,
} from './McpService';
