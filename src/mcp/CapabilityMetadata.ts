/**
 * Static capability metadata map for the MCP capability registry.
 *
 * @remarks
 * This map is the single source of truth for deployment affinity, identity surface,
 * and object type routing knowledge that cannot be reliably inferred from method
 * naming conventions alone.
 *
 * **Entry key semantics**
 *
 * Keys are matched against a capability's dot-path `id` (e.g. `"idm.managed.countManagedObjects"`)
 * using a two-pass lookup in {@link resolveCapabilityMeta}:
 *
 * 1. **Exact match** — full id equals the key. Used for per-method overrides.
 * 2. **Module prefix match** — the id starts with `<key>.`. Used to annotate all
 *    methods in a module at once. The longest matching prefix wins.
 *
 * Exact matches always take priority over prefix matches.
 *
 * **Adding entries**
 *
 * Only add entries when the inferred defaults (deploymentTypes: `['any']`, no surface)
 * are wrong or incomplete. The registry merges this map with inferred values so you only
 * need to specify the fields that differ from the defaults.
 */

import { McpDeploymentType, OperationCapabilityMeta } from './CapabilityTypes';

/** Convenience alias — the full supported set of deployment types. */
const ALL_DEPLOYMENTS: McpDeploymentType[] = ['cloud', 'forgeops', 'classic'];

/** Deployments that include the IDM component (and therefore IDM managed objects). */
const IDM_DEPLOYMENTS: McpDeploymentType[] = ['cloud', 'forgeops'];

/**
 * Static map of capability ID prefixes and exact IDs to explicit metadata overrides.
 *
 * For each entry:
 * - Key is either a full capability id **or** a module path prefix (no trailing dot).
 * - Value is a partial {@link OperationCapabilityMeta} — absent fields fall back to
 *   registry-inferred defaults.
 */
export const CAPABILITY_META: Record<string, OperationCapabilityMeta> = {
  // ── Agent-facing MCP contracts for ambiguous operations ─────────────────────
  'authn.journey.readJourney': {
    argumentMode: 'mixed',
    parameters: [
      {
        name: 'journeyId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Journey identifier or name.',
      },
    ],
    supportsRealm: true,
    notes:
      'For MCP callers, prefer namedArgs { journeyId } so the object identifier is explicit.',
  },
  'authn.node.readNode': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'nodeId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Node UUID.',
      },
      {
        name: 'nodeType',
        type: 'string',
        required: true,
        position: 1,
        description: 'Node type, for example PageNode.',
      },
    ],
    supportsRealm: true,
    notes:
      'MCP callers should use namedArgs { nodeId, nodeType } to avoid swapping the required positional arguments.',
  },
  'authn.journey.exportJourney': {
    argumentMode: 'named',
    scope: 'single',
    parameters: [
      {
        name: 'journeyId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Journey identifier or name to export.',
      },
      {
        name: 'options',
        type: 'TreeExportOptions',
        required: false,
        position: 1,
        description:
          'Optional export options such as deps/useStringArrays/coords.',
        defaultValue: {
          deps: false,
          useStringArrays: true,
          coords: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Single-journey export. In MCP, scope="single" defaults to a thin export bundle (deps=false, useStringArrays=true, coords=true). Explicitly request deps=true only when you need dependency bundles.',
  },
  'authn.journey.exportJourneys': {
    argumentMode: 'named',
    scope: 'bulk',
    parameters: [
      {
        name: 'options',
        type: 'TreeExportOptions',
        required: false,
        position: 0,
        description:
          'Optional export options such as deps/useStringArrays/coords.',
        defaultValue: {
          deps: false,
          useStringArrays: true,
          coords: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Bulk journey export. In MCP, scope="bulk" defaults to a thin export bundle (deps=false, useStringArrays=true, coords=true). Request deps=true only when a full dependency bundle is required.',
  },
  'script.readScript': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'scriptId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Script UUID.',
      },
    ],
    supportsRealm: true,
    notes: 'Use this when a node or journey references a script UUID.',
  },
  'script.readScriptByName': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'scriptName',
        type: 'string',
        required: true,
        position: 0,
        description: 'Human-readable script name.',
      },
    ],
    supportsRealm: true,
    notes: 'Use this when you know the script name rather than its UUID.',
  },

  // ── IDM managed objects ─────────────────────────────────────────────────────
  // Covers all idm.managed.* methods (createManagedObject, readManagedObject,
  // readManagedObjects, countManagedObjects, updateManagedObject, etc.)
  // IDM is only present in cloud and forgeops deployments.
  'idm.managed': {
    deploymentTypes: IDM_DEPLOYMENTS,
    preferredDeploymentTypes: IDM_DEPLOYMENTS,
    identitySurface: 'managed',
    objectTypePatterns: [
      '*_user',
      '*_organization',
      '*_application',
      '*_role',
      '*_assignment',
      '*_group',
      '*_device',
    ],
    notes:
      'Operates on IDM managed objects (openidm/managed/). Only available in cloud and forgeops deployments. Use these methods as the preferred way to manage realm-qualified identity objects (e.g. alpha_user).',
  },

  // ── IDM connector system objects ─────────────────────────────────────────────
  // Covers all idm.system.* methods. ICF connector systems are part of IDM.
  'idm.system': {
    deploymentTypes: IDM_DEPLOYMENTS,
    preferredDeploymentTypes: IDM_DEPLOYMENTS,
    identitySurface: 'connector-system',
    notes:
      'Operates on ICF connector system objects (openidm/system/). Only available in cloud and forgeops deployments.',
  },

  // ── AM users ─────────────────────────────────────────────────────────────────
  // Covers all user.* methods (readUser, readUsers, countUsers, etc.)
  // MCP should only route to AM user operations for classic deployments.
  // In cloud/forgeops, user management should flow through idm.managed.*.
  user: {
    deploymentTypes: ['classic'],
    preferredDeploymentTypes: ['classic'],
    identitySurface: 'am-user',
    objectTypePatterns: ['user'],
    notes:
      'Operates on AM realm users via the AM REST API. Exposed for MCP use only in classic deployments. In cloud/forgeops deployments, use idm.managed.* for identity operations.',
  },
};

/**
 * Resolves the most specific {@link OperationCapabilityMeta} entry for a capability id.
 *
 * @remarks
 * Lookup order (first match wins):
 * 1. Exact id match.
 * 2. Longest module-prefix match (key is a strict prefix of `<capabilityId>.`).
 *
 * @param capabilityId Full dot-path capability id, e.g. `"idm.managed.countManagedObjects"`.
 * @returns The matching metadata entry, or `undefined` if no entry covers this id.
 */
export function resolveCapabilityMeta(
  capabilityId: string
): OperationCapabilityMeta | undefined {
  // 1. Exact match.
  if (Object.prototype.hasOwnProperty.call(CAPABILITY_META, capabilityId)) {
    return CAPABILITY_META[capabilityId];
  }

  // 2. Longest prefix match. A key is a valid prefix when the capability id
  //    starts with `<key>.` (the dot ensures we never match 'idm.map' as a
  //    prefix of 'idm.mapping.something').
  let bestKey: string | undefined;
  for (const key of Object.keys(CAPABILITY_META)) {
    if (
      capabilityId.startsWith(`${key}.`) &&
      (bestKey === undefined || key.length > bestKey.length)
    ) {
      bestKey = key;
    }
  }

  return bestKey !== undefined ? CAPABILITY_META[bestKey] : undefined;
}
