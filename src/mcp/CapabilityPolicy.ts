/**
 * Defines baseline policy presets and filtering behavior for MCP capabilities.
 *
 * @remarks
 * The intent of this module is to provide safe defaults that can be composed with
 * CLI launch profiles and explicit allow/deny overrides without changing the
 * descriptor model itself.
 */

import {
  McpCapabilityDescriptor,
  McpCapabilityPolicy,
  McpCapabilityPolicyPresetName,
} from './CapabilityTypes';

/**
 * Built-in policy presets representing common launch safety postures.
 */
export const MCP_POLICY_PRESETS: Record<
  McpCapabilityPolicyPresetName,
  McpCapabilityPolicy
> = {
  'read-only': {
    name: 'read-only',
    allowOperationTypes: ['count', 'read', 'search', 'list'],
    denyOperationTypes: ['create', 'update', 'delete', 'import'],
    includeSpecial: false,
  },
  agentic: {
    name: 'agentic',
    allowOperationTypes: [
      'create',
      'count',
      'read',
      'update',
      'search',
      'list',
    ],
    denyOperationTypes: ['delete', 'import', 'export'],
    denyRiskClasses: ['critical'],
    includeSpecial: true,
  },
  standard: {
    name: 'standard',
    allowOperationTypes: [
      'create',
      'count',
      'read',
      'update',
      'search',
      'list',
      'export',
    ],
    denyOperationTypes: ['delete', 'import'],
    denyRiskClasses: ['critical'],
    includeSpecial: true,
  },
  admin: {
    name: 'admin',
    includeSpecial: true,
  },
};

/**
 * Applies capability exposure rules to a descriptor set.
 *
 * @param capabilities Candidate capabilities.
 * @param policy Policy rules used to include or exclude capabilities.
 * @returns Filtered capability set.
 */
export function applyCapabilityPolicy(
  capabilities: McpCapabilityDescriptor[],
  policy: McpCapabilityPolicy
): McpCapabilityDescriptor[] {
  return capabilities.filter((capability) => {
    if (policy.includeSpecial === false && capability.kind === 'special') {
      return false;
    }

    if (
      policy.allowOperationTypes &&
      !policy.allowOperationTypes.includes(capability.operationType)
    ) {
      return false;
    }

    if (
      policy.denyOperationTypes &&
      policy.denyOperationTypes.includes(capability.operationType)
    ) {
      return false;
    }

    if (
      policy.allowRiskClasses &&
      !policy.allowRiskClasses.includes(capability.riskClass)
    ) {
      return false;
    }

    if (
      policy.denyRiskClasses &&
      policy.denyRiskClasses.includes(capability.riskClass)
    ) {
      return false;
    }

    if (
      policy.allowDomains &&
      !policy.allowDomains.includes(capability.domain)
    ) {
      return false;
    }

    if (policy.denyDomains && policy.denyDomains.includes(capability.domain)) {
      return false;
    }

    return true;
  });
}
