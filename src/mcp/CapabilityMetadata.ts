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
        examples: ['Azure'],
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
        examples: ['313597f3-2e86-4476-b899-17a0209f0386'],
      },
      {
        name: 'nodeType',
        type: 'string',
        required: true,
        position: 1,
        description: 'Node type, for example PageNode.',
        examples: ['PageNode'],
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
        examples: ['Azure'],
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
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            deps: {
              type: 'boolean',
              description:
                'Include dependent objects such as scripts, themes, and templates.',
            },
            useStringArrays: {
              type: 'boolean',
              description:
                'Normalize multi-value fields into plain string arrays for agent-friendly output.',
            },
            coords: {
              type: 'boolean',
              description:
                'Include journey node canvas coordinates in the export.',
            },
          },
        },
        examples: [
          {
            deps: false,
            useStringArrays: true,
            coords: true,
          },
          {
            deps: true,
            useStringArrays: true,
            coords: true,
          },
        ],
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
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            deps: {
              type: 'boolean',
              description:
                'Include dependent objects such as scripts, themes, and templates.',
            },
            useStringArrays: {
              type: 'boolean',
              description:
                'Normalize multi-value fields into plain string arrays for agent-friendly output.',
            },
            coords: {
              type: 'boolean',
              description:
                'Include journey node canvas coordinates in the export.',
            },
          },
        },
        examples: [
          {
            deps: false,
            useStringArrays: true,
            coords: true,
          },
          {
            deps: true,
            useStringArrays: true,
            coords: true,
          },
        ],
      },
    ],
    supportsRealm: true,
    notes:
      'Bulk journey export. In MCP, scope="bulk" defaults to a thin export bundle (deps=false, useStringArrays=true, coords=true). Request deps=true only when a full dependency bundle is required.',
  },
  'app.queryApplications': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'filter',
        type: 'string',
        required: true,
        position: 0,
        description: 'CREST search filter, for example name co "HR".',
        examples: ['name co "HR"'],
      },
      {
        name: 'fields',
        type: 'string[]',
        required: false,
        position: 1,
        description: 'Optional list of fields to return.',
        schema: {
          type: 'array',
          items: { type: 'string' },
        },
        examples: [['name', '_id']],
      },
    ],
    supportsRealm: true,
    notes:
      'Search applications with a CREST filter. Prefer namedArgs { filter, fields } so the query intent is explicit.',
  },
  'role.queryInternalRoles': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'filter',
        type: 'string',
        required: true,
        position: 0,
        description: 'CREST search filter, for example name eq "helpdesk".',
        examples: ['name eq "helpdesk"'],
      },
      {
        name: 'fields',
        type: 'string[]',
        required: false,
        position: 1,
        description: 'Optional list of fields to return.',
        schema: {
          type: 'array',
          items: { type: 'string' },
        },
        examples: [['name', '_id']],
      },
    ],
    supportsRealm: true,
    notes:
      'Search internal roles with a CREST filter. Prefer namedArgs { filter, fields } for clarity.',
  },
  'idm.managed.queryManagedObjects': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed object type, for example alpha_user.',
        examples: ['alpha_user'],
      },
      {
        name: 'filter',
        type: 'string',
        required: false,
        position: 1,
        description: 'Optional IDM query filter such as userName sw "a".',
        examples: ['userName sw "a"'],
      },
      {
        name: 'fields',
        type: 'string[]',
        required: false,
        position: 2,
        description: 'Optional list of fields to return.',
        schema: {
          type: 'array',
          items: { type: 'string' },
        },
        examples: [['userName', 'mail']],
      },
      {
        name: 'pageSize',
        type: 'integer',
        required: false,
        position: 3,
        description:
          'Optional page size hint forwarded from the generic pageSize control.',
        examples: [100, 250],
      },
      {
        name: 'pageCookie',
        type: 'string',
        required: false,
        position: 4,
        description:
          'Paged-results cookie. The generic pageToken control maps to this parameter.',
        examples: ['opaque-cookie-token'],
      },
    ],
    supportsRealm: true,
    supportsPaging: true,
    supportsIncludeTotal: true,
    notes:
      'Search managed objects with explicit type + filter. Generic pageSize and pageToken are forwarded to the underlying IDM query.',
  },
  'idm.managed.countManagedObjects': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed object type, for example alpha_user.',
        examples: ['alpha_user'],
      },
      {
        name: 'filter',
        type: 'string',
        required: false,
        position: 1,
        description: 'Optional IDM query filter such as userName sw "a".',
        examples: ['userName sw "a"'],
      },
    ],
    supportsRealm: true,
    notes:
      'Count managed objects with explicit type and optional filter. For exact totals in cloud/forgeops deployments, prefer this over AM user counting.',
  },
  'idm.system.queryAllSystemObjectIds': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'systemName',
        type: 'string',
        required: true,
        position: 0,
        description: 'Connector/system name, for example ldap.',
        examples: ['ldap'],
      },
      {
        name: 'systemObjectType',
        type: 'string',
        required: true,
        position: 1,
        description: 'Connector object type, for example account.',
        examples: ['account'],
      },
      {
        name: 'pageSize',
        type: 'integer',
        required: false,
        position: 2,
        description:
          'Optional page size hint forwarded from the generic pageSize control.',
        examples: [100, 250],
      },
      {
        name: 'pageCookie',
        type: 'string',
        required: false,
        position: 3,
        description:
          'Paged-results cookie. The generic pageToken control maps to this parameter.',
        examples: ['opaque-cookie-token'],
      },
    ],
    supportsRealm: true,
    supportsPaging: true,
    notes:
      'Enumerate connector object ids. Use namedArgs { systemName, systemObjectType } and generic pageToken/pageSize for pagination.',
  },
  'idm.system.querySystemObjects': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'systemName',
        type: 'string',
        required: true,
        position: 0,
        description: 'Connector/system name, for example ldap.',
        examples: ['ldap'],
      },
      {
        name: 'systemObjectType',
        type: 'string',
        required: true,
        position: 1,
        description: 'Connector object type, for example account.',
        examples: ['account'],
      },
      {
        name: 'filter',
        type: 'string',
        required: true,
        position: 2,
        description: 'Connector query filter, for example uid sw "a".',
        examples: ['uid sw "a"'],
      },
      {
        name: 'fields',
        type: 'string[]',
        required: false,
        position: 3,
        description: 'Optional list of fields to return.',
        schema: {
          type: 'array',
          items: { type: 'string' },
        },
        examples: [['uid', 'mail']],
      },
      {
        name: 'pageSize',
        type: 'integer',
        required: false,
        position: 4,
        description:
          'Optional page size hint forwarded from the generic pageSize control.',
        examples: [100, 250],
      },
      {
        name: 'pageCookie',
        type: 'string',
        required: false,
        position: 5,
        description:
          'Paged-results cookie. The generic pageToken control maps to this parameter.',
        examples: ['opaque-cookie-token'],
      },
    ],
    supportsRealm: true,
    supportsPaging: true,
    notes:
      'Search connector objects with explicit systemName/systemObjectType/filter. Generic pageSize and pageToken are forwarded to the underlying IDM query.',
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
        examples: ['8e03eb43-ed5d-4c12-9e15-2051cc9be578'],
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
        examples: ['Process SAML Data'],
      },
    ],
    supportsRealm: true,
    notes: 'Use this when you know the script name rather than its UUID.',
  },
  'script.createScript': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'scriptId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Script UUID to create.',
        examples: ['8e03eb43-ed5d-4c12-9e15-2051cc9be578'],
      },
      {
        name: 'scriptName',
        type: 'string',
        required: false,
        position: 1,
        description:
          'Optional script display name. If omitted, MCP defaults it to scriptId.',
        examples: ['My OAUTH2_MAY_ACT Script'],
      },
      {
        name: 'scriptData',
        type: 'ScriptSkeleton',
        required: true,
        position: 2,
        description:
          'Script payload object. For JavaScript, provide script as plain text or base64 and set context/language.',
        schema: {
          type: 'object',
          properties: {
            context: { type: 'string' },
            language: { type: 'string' },
            script: { type: 'string' },
            description: { type: 'string' },
          },
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Create a script by id. Prefer namedArgs { scriptId, scriptData } and optionally scriptName.',
  },
  'script.updateScript': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'scriptId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Script UUID to update.',
        examples: ['8e03eb43-ed5d-4c12-9e15-2051cc9be578'],
      },
      {
        name: 'scriptData',
        type: 'ScriptSkeleton',
        required: true,
        position: 1,
        description:
          'Script payload object. For JavaScript, provide script as plain text or base64 and set context/language.',
        schema: {
          type: 'object',
          properties: {
            context: { type: 'string' },
            language: { type: 'string' },
            script: { type: 'string' },
            description: { type: 'string' },
          },
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Update (or upsert) a script by id. Prefer namedArgs { scriptId, scriptData }.',
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
