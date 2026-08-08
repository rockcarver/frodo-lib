import { McpCapabilityDescriptor, McpDeploymentType } from './CapabilityTypes';

export type McpCapabilityRoutingStatus =
  | 'preferred'
  | 'compatible'
  | 'unknown'
  | 'incompatible';

export type McpCapabilityRouting = {
  status: McpCapabilityRoutingStatus;
  reason: string;
};

export function rankCapabilitiesForDeployment(
  capabilities: McpCapabilityDescriptor[],
  deploymentType?: McpDeploymentType,
  query?: string
): McpCapabilityDescriptor[] {
  return [...capabilities].sort((left, right) => {
    const deploymentDifference =
      getDeploymentRank(left, deploymentType) -
      getDeploymentRank(right, deploymentType);
    if (deploymentDifference !== 0) {
      return deploymentDifference;
    }

    const relevanceDifference =
      getIdentityRelevanceRank(left, query) -
      getIdentityRelevanceRank(right, query);
    if (relevanceDifference !== 0) {
      return relevanceDifference;
    }

    return left.id.localeCompare(right.id);
  });
}

export function describeCapabilityRouting(
  capability: McpCapabilityDescriptor,
  deploymentType?: McpDeploymentType
): McpCapabilityRouting {
  if (!deploymentType || deploymentType === 'any') {
    return {
      status: 'unknown',
      reason: 'Deployment type is not resolved.',
    };
  }

  if (capability.preferredDeploymentTypes?.includes(deploymentType)) {
    return {
      status: 'preferred',
      reason: `Preferred for ${deploymentType} deployments.`,
    };
  }

  if (
    capability.deploymentTypes.length === 0 ||
    capability.deploymentTypes.includes('any') ||
    capability.deploymentTypes.includes(deploymentType)
  ) {
    return {
      status: 'compatible',
      reason: `Compatible with ${deploymentType} deployments.`,
    };
  }

  return {
    status: 'incompatible',
    reason: `Not supported for ${deploymentType}; supported deployments: ${capability.deploymentTypes.join(', ')}.`,
  };
}

function getDeploymentRank(
  capability: McpCapabilityDescriptor,
  deploymentType?: McpDeploymentType
): number {
  const status = describeCapabilityRouting(capability, deploymentType).status;
  switch (status) {
    case 'preferred':
      return 0;
    case 'compatible':
      return 1;
    case 'unknown':
      return 2;
    case 'incompatible':
      return 3;
  }
}

function getIdentityRelevanceRank(
  capability: McpCapabilityDescriptor,
  query?: string
): number {
  if (!query || !/\b(users?|identit(?:y|ies))\b/i.test(query)) {
    return 1;
  }

  return capability.identitySurface === 'managed' ||
    capability.identitySurface === 'am-user' ||
    capability.objectTypePatterns?.some((pattern) => pattern.includes('user'))
    ? 0
    : 1;
}
