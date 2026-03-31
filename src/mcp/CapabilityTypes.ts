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
  kind: McpCapabilityKind;
  riskClass: McpCapabilityRiskClass;
  mutating: boolean;
  destructive: boolean;
  deploymentTypes: McpDeploymentType[];
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
