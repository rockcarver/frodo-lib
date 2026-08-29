/**
 * Subject-oriented MCP profile registry.
 *
 * @remarks
 * This is the single source of truth for profile names, human-readable profile
 * descriptions, and subtree mappings used by MCP surface selection.
 *
 * `all` is derived dynamically from the non-disabled profile universe.
 */

import {
  McpCapabilityDescriptor,
  McpCapabilityInventoryOptions,
  McpCapabilityPolicy,
  McpCapabilityPolicyPresetName,
} from './CapabilityTypes';

export type McpProfileName =
  | 'all'
  | 'authentication'
  | 'journey-dev'
  | 'authorization'
  | 'federation'
  | 'iga'
  | 'apps'
  | 'managed-objects'
  | 'platform-admin'
  | 'disabled';

export type McpProfileDefinition = {
  name: McpProfileName;
  description: string;
  /** Prefixes in FrodoLib object-graph terms, e.g. `oauth2oidc` or `authn.journey`. */
  includePathPrefixes?: string[];
  /** Internal exclusion prefixes that are never exposed by any profile. */
  excludePathPrefixes?: string[];
  /** Optional default policy posture for the profile. */
  policyPreset?: McpCapabilityPolicyPresetName;
  /** Hidden/internal profile entries should not be shown in user-facing lists. */
  hidden?: boolean;
  /** True for the derived `all` profile. */
  derived?: boolean;
};

const DISABLED_PATH_PREFIXES = ['factory', 'utils'];

const SUBJECT_PROFILE_DEFINITIONS: Record<
  Exclude<McpProfileName, 'all' | 'disabled'>,
  McpProfileDefinition
> = {
  authentication: {
    name: 'authentication',
    description:
      'Broad authentication surface, including journeys, nodes, OAuth/OIDC, login, and sessions.',
    includePathPrefixes: ['authn', 'oauth2oidc', 'login', 'session'],
  },
  'journey-dev': {
    name: 'journey-dev',
    description:
      'Focused journey-engineering surface for authn journey/node/settings work.',
    includePathPrefixes: ['authn.journey', 'authn.node', 'authn.settings'],
  },
  authorization: {
    name: 'authorization',
    description:
      'Authorization, access-control, policy, policy-set, resource-type, role, and user-adjacent operations.',
    includePathPrefixes: ['authz', 'role', 'user'],
  },
  federation: {
    name: 'federation',
    description:
      'Federation and trust/config interoperability operations across SAML, WS-Fed, and admin federation.',
    includePathPrefixes: ['saml2', 'cloud.adminFed', 'cloud.wsfed'],
  },
  iga: {
    name: 'iga',
    description:
      'Identity governance operations for certifications, events, glossary, request forms/types, and workflows.',
    includePathPrefixes: ['cloud.iga'],
  },
  apps: {
    name: 'apps',
    description:
      'Application lifecycle and access-app workflows, including SSO/provisioning app paths and AI-agent-related app workflows.',
    includePathPrefixes: [
      'app',
      'cloud.env.enableAIAgentFeature',
      'cloud.feature',
    ],
  },
  'managed-objects': {
    name: 'managed-objects',
    description:
      'IDM object model and lifecycle operations, including managed objects, mappings, recon, connectors, organization, config, system, and script.',
    includePathPrefixes: [
      'idm.managed',
      'idm.managedSystem',
      'idm.mapping',
      'idm.recon',
      'idm.connector',
      'idm.organization',
      'idm.config',
      'idm.system',
      'idm.script',
    ],
  },
  'platform-admin': {
    name: 'platform-admin',
    description:
      'Internal platform administration and supporting operations that span the remaining top-level FrodoLib surface.',
    includePathPrefixes: [
      'admin',
      'agent',
      'am.config',
      'cache',
      'cloud.env',
      'cloud.esvCount',
      'cloud.getEsvCount',
      'cloud.idmFeature',
      'cloud.log',
      'cloud.secret',
      'cloud.serviceAccount',
      'cloud.startup',
      'cloud.variable',
      'config',
      'conn',
      'idm.crypto',
      'email',
      'info',
      'rawConfig',
      'realm',
      'script',
      'scriptType',
      'server',
      'service',
      'secretStore',
      'site',
      'theme',
      'user',
    ],
    hidden: true,
  },
};

const DISABLED_PROFILE_DEFINITION: McpProfileDefinition = {
  name: 'disabled',
  description:
    'Internal exclusion bucket. Any capability mapped here is unavailable to every profile, including all.',
  includePathPrefixes: DISABLED_PATH_PREFIXES,
  hidden: true,
};

/**
 * Returns a stable list of user-facing profiles plus derived `all`.
 */
export function listMcpProfiles(): McpProfileDefinition[] {
  return [
    getAllProfileDefinition(),
    SUBJECT_PROFILE_DEFINITIONS.authentication,
    SUBJECT_PROFILE_DEFINITIONS['journey-dev'],
    SUBJECT_PROFILE_DEFINITIONS.authorization,
    SUBJECT_PROFILE_DEFINITIONS.federation,
    SUBJECT_PROFILE_DEFINITIONS.iga,
    SUBJECT_PROFILE_DEFINITIONS.apps,
    SUBJECT_PROFILE_DEFINITIONS['managed-objects'],
  ];
}

/**
 * Returns a stable list of all profile definitions, including hidden/internal ones.
 */
export function listAllMcpProfiles(): McpProfileDefinition[] {
  return [
    ...listMcpProfiles(),
    SUBJECT_PROFILE_DEFINITIONS['platform-admin'],
    DISABLED_PROFILE_DEFINITION,
  ];
}

/**
 * Returns a single profile definition by name.
 */
export function getMcpProfileDefinition(
  name: McpProfileName
): McpProfileDefinition {
  if (name === 'all') {
    return getAllProfileDefinition();
  }
  if (name === 'disabled') {
    return DISABLED_PROFILE_DEFINITION;
  }
  return SUBJECT_PROFILE_DEFINITIONS[name];
}

/**
 * Creates a profile-scoped policy overlay and inventory scope for service composition.
 */
export function resolveMcpProfileSelection(name: McpProfileName): {
  profile: McpProfileDefinition;
  inventoryOptions?: McpCapabilityInventoryOptions;
  policyOverride?: Partial<McpCapabilityPolicy>;
  policyPreset?: McpCapabilityPolicyPresetName;
} {
  const profile = getMcpProfileDefinition(name);
  const includeTopLevelDomains = profile.includePathPrefixes
    ? uniqueTopLevelDomains(profile.includePathPrefixes)
    : undefined;

  return {
    profile,
    ...(includeTopLevelDomains && {
      inventoryOptions: {
        includeTopLevelDomains,
      },
    }),
    ...(profile.includePathPrefixes && {
      policyOverride: {
        allowCapabilityPathPrefixes: profile.includePathPrefixes,
        denyCapabilityPathPrefixes: DISABLED_PATH_PREFIXES,
      },
    }),
    ...(profile.policyPreset && {
      policyPreset: profile.policyPreset,
    }),
  };
}

/**
 * Returns true if the capability matches any known profile prefix.
 */
export function capabilityMatchesAnyProfile(
  capability: McpCapabilityDescriptor
): boolean {
  const capabilityPath = capability.modulePath.join('.');
  return listMcpProfiles()
    .flatMap((profile) => profile.includePathPrefixes ?? [])
    .some((prefix) => matchesPathPrefix(capability.id, capabilityPath, prefix));
}

/**
 * Returns true if the capability is explicitly disabled.
 */
export function capabilityMatchesDisabled(
  capability: McpCapabilityDescriptor
): boolean {
  const capabilityPath = capability.modulePath.join('.');
  return DISABLED_PROFILE_DEFINITION.includePathPrefixes!.some((prefix) =>
    matchesPathPrefix(capability.id, capabilityPath, prefix)
  );
}

function getAllProfileDefinition(): McpProfileDefinition {
  const prefixes = new Set<string>();
  for (const profile of listAllMcpProfilesRaw()) {
    if (profile.name === 'all' || profile.name === 'disabled') {
      continue;
    }
    for (const prefix of profile.includePathPrefixes ?? []) {
      if (!DISABLED_PATH_PREFIXES.includes(prefix)) {
        prefixes.add(prefix);
      }
    }
  }

  return {
    name: 'all',
    description:
      'Derived full capability universe composed from all non-disabled profile prefixes.',
    includePathPrefixes: [...prefixes].sort(),
    derived: true,
  };
}

function listAllMcpProfilesRaw(): McpProfileDefinition[] {
  return [
    { name: 'all', description: 'derived', derived: true },
    ...Object.values(SUBJECT_PROFILE_DEFINITIONS),
    DISABLED_PROFILE_DEFINITION,
  ];
}

function uniqueTopLevelDomains(prefixes: string[]): string[] {
  return [
    ...new Set(prefixes.map((prefix) => prefix.split('.')[0] || prefix)),
  ].sort();
}

function matchesPathPrefix(
  capabilityId: string,
  capabilityPath: string,
  prefix: string
): boolean {
  return (
    capabilityId === prefix ||
    capabilityId.startsWith(`${prefix}.`) ||
    capabilityPath === prefix ||
    capabilityPath.startsWith(`${prefix}.`)
  );
}
