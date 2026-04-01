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
  buildCapabilityInventory,
  inferObjectType,
  inferOperationType,
  inferRiskClass,
} from './CapabilityRegistry';
export {
  McpDiscoveryEntry,
  McpGenericTool,
  McpObjectTypeEntry,
  McpSpecialTool,
  McpToolManifest,
  buildToolManifest,
} from './ToolManifest';
export {
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
