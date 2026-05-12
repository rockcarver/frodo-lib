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
  'authn.journey.createJourney': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'journeyId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Journey identifier or name to create.',
        examples: ['Example Journey'],
      },
      {
        name: 'journeyData',
        type: 'TreeSkeleton',
        required: true,
        position: 1,
        description: 'Journey payload object.',
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Create a journey with namedArgs { journeyId, journeyData } so the target id and payload are explicit.',
  },
  'authn.journey.updateJourney': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'journeyId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Journey identifier or name to update.',
        examples: ['Example Journey'],
      },
      {
        name: 'journeyData',
        type: 'TreeSkeleton',
        required: true,
        position: 1,
        description: 'Journey payload object.',
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Update a journey with namedArgs { journeyId, journeyData } to avoid positional ambiguity.',
  },
  'authn.journey.deleteJourney': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'journeyId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Journey identifier or name to delete.',
        examples: ['Example Journey'],
      },
      {
        name: 'options',
        type: 'DeleteJourneyOptions',
        required: true,
        position: 1,
        description:
          'Delete options controlling deep node cleanup, verbosity, and progress display.',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            deep: { type: 'boolean' },
            verbose: { type: 'boolean' },
            progress: { type: 'boolean' },
          },
        },
        examples: [{ deep: false, verbose: false }],
      },
    ],
    supportsRealm: true,
    notes:
      'Delete a journey with namedArgs { journeyId, options }. Set options.deep=true only when you intend to remove journey nodes as well.',
  },
  'authn.node.createNode': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'nodeType',
        type: 'string',
        required: true,
        position: 0,
        description: 'Node type, for example PageNode.',
        examples: ['PageNode'],
      },
      {
        name: 'nodeData',
        type: 'NodeSkeleton',
        required: true,
        position: 1,
        description: 'Node payload object.',
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Create a node with namedArgs { nodeType, nodeData } so node type and payload are explicit.',
  },
  'authn.node.updateNode': {
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
      {
        name: 'nodeData',
        type: 'NodeSkeleton',
        required: true,
        position: 2,
        description: 'Updated node payload object.',
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Update a node with namedArgs { nodeId, nodeType, nodeData } to preserve the UUID/type ordering.',
  },
  'authn.node.deleteNode': {
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
      'Delete a node with namedArgs { nodeId, nodeType } to avoid swapping the required positional arguments.',
  },
  'authn.node.readCustomNode': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'nodeId',
        type: 'string',
        required: false,
        position: 0,
        description:
          'Custom node id or service name. Takes priority over nodeName when both are provided.',
        examples: ['custom-node-service'],
      },
      {
        name: 'nodeName',
        type: 'string',
        required: false,
        position: 1,
        description: 'Custom node display name.',
        examples: ['My Custom Node'],
      },
    ],
    supportsRealm: true,
    notes:
      'Read a custom node with either namedArgs { nodeId } or { nodeName }. If both are provided, nodeId wins.',
  },
  'authn.node.updateCustomNode': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'nodeId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Custom node id or service name.',
        examples: ['custom-node-service'],
      },
      {
        name: 'nodeData',
        type: 'CustomNodeSkeleton',
        required: true,
        position: 1,
        description: 'Custom node payload object.',
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes: 'Update a custom node with namedArgs { nodeId, nodeData }.',
  },
  'authn.node.deleteCustomNode': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'nodeId',
        type: 'string',
        required: false,
        position: 0,
        description:
          'Custom node id or service name. Takes priority over nodeName when both are provided.',
        examples: ['custom-node-service'],
      },
      {
        name: 'nodeName',
        type: 'string',
        required: false,
        position: 1,
        description: 'Custom node display name.',
        examples: ['My Custom Node'],
      },
    ],
    supportsRealm: true,
    notes:
      'Delete a custom node with either namedArgs { nodeId } or { nodeName }. If both are provided, nodeId wins.',
  },
  'authn.settings.updateAuthenticationSettings': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'settings',
        type: 'AuthenticationSettingsSkeleton',
        required: true,
        position: 0,
        description: 'Authentication settings payload object.',
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
      {
        name: 'globalConfig',
        type: 'boolean',
        required: false,
        position: 1,
        description:
          'Set true to target global authentication settings instead of the active realm.',
        defaultValue: false,
        examples: [false, true],
      },
    ],
    supportsRealm: true,
    notes:
      'Update authentication settings with namedArgs { settings, globalConfig }. globalConfig defaults to false.',
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
  'idm.config.createConfigEntity': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'entityId',
        type: 'string',
        required: true,
        position: 0,
        description: 'IDM config entity id to create.',
        examples: ['provisioner.openicf/ldap'],
      },
      {
        name: 'entityData',
        type: 'IdObjectSkeletonInterface',
        required: true,
        position: 1,
        description: 'IDM config entity payload object.',
        schema: { type: 'object', additionalProperties: true },
      },
      {
        name: 'wait',
        type: 'boolean',
        required: false,
        position: 2,
        description: 'Wait for async processing to complete when supported.',
        defaultValue: false,
        examples: [false, true],
      },
    ],
    supportsRealm: true,
    notes:
      'Create a config entity with namedArgs { entityId, entityData, wait }. wait defaults to false.',
  },
  'idm.config.readSubConfigEntity': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'entityId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Parent IDM config entity id.',
        examples: ['provisioner.openicf/ldap'],
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        position: 1,
        description: 'Sub-entity name to read from the parent entity.',
        examples: ['configurationProperties'],
      },
      {
        name: 'options',
        type: 'ConfigEntityExportOptions',
        required: false,
        position: 2,
        description: 'Optional export/read shaping options.',
        schema: { type: 'object', additionalProperties: true },
      },
    ],
    supportsRealm: true,
    notes:
      'Read a named sub-entity with namedArgs { entityId, name, options }.',
  },
  'idm.config.updateConfigEntity': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'entityId',
        type: 'string',
        required: true,
        position: 0,
        description: 'IDM config entity id to update.',
        examples: ['provisioner.openicf/ldap'],
      },
      {
        name: 'entityData',
        type: 'IdObjectSkeletonInterface',
        required: true,
        position: 1,
        description: 'Updated IDM config entity payload object.',
        schema: { type: 'object', additionalProperties: true },
      },
      {
        name: 'wait',
        type: 'boolean',
        required: false,
        position: 2,
        description: 'Wait for async processing to complete when supported.',
        defaultValue: false,
        examples: [false, true],
      },
    ],
    supportsRealm: true,
    notes:
      'Update a config entity with namedArgs { entityId, entityData, wait }. wait defaults to false.',
  },
  'idm.connector.createConnector': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'connectorId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Connector id to create.',
        examples: ['provisioner.openicf/ldap'],
      },
      {
        name: 'connectorData',
        type: 'ConnectorSkeleton',
        required: true,
        position: 1,
        description: 'Connector payload object.',
        schema: { type: 'object', additionalProperties: true },
      },
    ],
    supportsRealm: true,
    notes: 'Create a connector with namedArgs { connectorId, connectorData }.',
  },
  'idm.connector.updateConnector': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'connectorId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Connector id to update.',
        examples: ['provisioner.openicf/ldap'],
      },
      {
        name: 'connectorData',
        type: 'ConnectorSkeleton',
        required: true,
        position: 1,
        description: 'Updated connector payload object.',
        schema: { type: 'object', additionalProperties: true },
      },
    ],
    supportsRealm: true,
    notes: 'Update a connector with namedArgs { connectorId, connectorData }.',
  },
  'idm.managed.createManagedObject': {
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
        name: 'id',
        type: 'string',
        required: false,
        position: 1,
        description: 'Optional managed object id. Omit to let IDM assign one.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'moData',
        type: 'IdObjectSkeletonInterface',
        required: true,
        position: 2,
        description: 'Managed object payload object.',
        schema: { type: 'object', additionalProperties: true },
      },
    ],
    supportsRealm: true,
    notes:
      'Create a managed object with namedArgs { type, id, moData }. id is optional.',
  },
  'idm.managed.readManagedObject': {
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
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed object id to read.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
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
    ],
    supportsRealm: true,
    notes: 'Read a managed object with namedArgs { type, id, fields }.',
  },
  'idm.managed.updateManagedObject': {
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
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed object id to update.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'moData',
        type: 'IdObjectSkeletonInterface',
        required: true,
        position: 2,
        description: 'Updated managed object payload object.',
        schema: { type: 'object', additionalProperties: true },
      },
    ],
    supportsRealm: true,
    notes: 'Update a managed object with namedArgs { type, id, moData }.',
  },
  'idm.managed.updateManagedObjectProperties': {
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
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed object id to patch.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'operations',
        type: 'PatchOperationInterface[]',
        required: true,
        position: 2,
        description: 'JSON patch-style operations for the target object.',
        schema: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
        examples: [
          [{ operation: 'replace', field: '/mail', value: 'a@example.com' }],
        ],
      },
      {
        name: 'rev',
        type: 'string',
        required: false,
        position: 3,
        description: 'Optional optimistic concurrency revision token.',
      },
    ],
    supportsRealm: true,
    notes:
      'Patch one managed object with namedArgs { type, id, operations, rev }.',
  },
  'idm.managed.updateManagedObjectsProperties': {
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
        required: true,
        position: 1,
        description: 'IDM query filter selecting the objects to patch.',
        examples: ['userName sw "a"'],
      },
      {
        name: 'operations',
        type: 'PatchOperationInterface[]',
        required: true,
        position: 2,
        description:
          'JSON patch-style operations applied to all matching objects.',
        schema: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
        examples: [
          [{ operation: 'replace', field: '/mail', value: 'a@example.com' }],
        ],
      },
      {
        name: 'rev',
        type: 'string',
        required: false,
        position: 3,
        description: 'Optional optimistic concurrency revision token.',
      },
      {
        name: 'pageSize',
        type: 'integer',
        required: false,
        position: 4,
        description: 'Optional batch page size for large updates.',
        defaultValue: 1000,
        examples: [100, 1000],
      },
    ],
    supportsRealm: true,
    supportsPaging: true,
    notes:
      'Patch multiple managed objects with namedArgs { type, filter, operations, rev, pageSize }.',
  },
  'idm.managed.deleteManagedObject': {
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
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed object id to delete.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
    ],
    supportsRealm: true,
    notes: 'Delete a managed object with namedArgs { type, id }.',
  },
  'idm.managed.deleteManagedObjects': {
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
        required: true,
        position: 1,
        description: 'IDM query filter selecting the objects to delete.',
        examples: ['userName sw "a"'],
      },
    ],
    supportsRealm: true,
    notes: 'Delete multiple managed objects with namedArgs { type, filter }.',
  },
  'idm.mapping.createMapping': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'mappingId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Mapping id to create.',
        examples: ['managedUser_systemLdapAccounts'],
      },
      {
        name: 'mappingData',
        type: 'MappingSkeleton',
        required: true,
        position: 1,
        description: 'Mapping payload object.',
        schema: { type: 'object', additionalProperties: true },
      },
    ],
    supportsRealm: true,
    notes: 'Create a mapping with namedArgs { mappingId, mappingData }.',
  },
  'idm.mapping.updateMapping': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'mappingId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Mapping id to update.',
        examples: ['managedUser_systemLdapAccounts'],
      },
      {
        name: 'mappingData',
        type: 'MappingSkeleton',
        required: true,
        position: 1,
        description: 'Updated mapping payload object.',
        schema: { type: 'object', additionalProperties: true },
      },
    ],
    supportsRealm: true,
    notes: 'Update a mapping with namedArgs { mappingId, mappingData }.',
  },
  'idm.system.readSystemObject': {
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
        name: 'systemObjectId',
        type: 'string',
        required: true,
        position: 2,
        description: 'Connector object id to read.',
        examples: ['uid=test,ou=people,dc=example,dc=com'],
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
    ],
    supportsRealm: true,
    notes:
      'Read a connector object with namedArgs { systemName, systemObjectType, systemObjectId, fields }.',
  },
  'idm.system.createSystemObject': {
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
        name: 'systemObjectData',
        type: 'IdObjectSkeletonInterface',
        required: true,
        position: 2,
        description: 'Connector object payload.',
        schema: { type: 'object', additionalProperties: true },
      },
    ],
    supportsRealm: true,
    notes:
      'Create a connector object with namedArgs { systemName, systemObjectType, systemObjectData }.',
  },
  'idm.system.updateSystemObject': {
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
        name: 'systemObjectId',
        type: 'string',
        required: true,
        position: 2,
        description: 'Connector object id to update.',
        examples: ['uid=test,ou=people,dc=example,dc=com'],
      },
      {
        name: 'systemObjectData',
        type: 'IdObjectSkeletonInterface',
        required: true,
        position: 3,
        description: 'Updated connector object payload.',
        schema: { type: 'object', additionalProperties: true },
      },
      {
        name: 'failIfExists',
        type: 'boolean',
        required: false,
        position: 4,
        description:
          'Set true to fail instead of upserting when the object already exists.',
        defaultValue: false,
        examples: [false, true],
      },
    ],
    supportsRealm: true,
    notes:
      'Update a connector object with namedArgs { systemName, systemObjectType, systemObjectId, systemObjectData, failIfExists }.',
  },
  'idm.system.updateSystemObjectProperties': {
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
        name: 'systemObjectId',
        type: 'string',
        required: true,
        position: 2,
        description: 'Connector object id to patch.',
        examples: ['uid=test,ou=people,dc=example,dc=com'],
      },
      {
        name: 'operations',
        type: 'SystemObjectPatchOperationInterface[]',
        required: true,
        position: 3,
        description:
          'JSON patch-style operations for the target connector object.',
        schema: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
        examples: [
          [{ operation: 'replace', field: '/mail', value: 'a@example.com' }],
        ],
      },
    ],
    supportsRealm: true,
    notes:
      'Patch a connector object with namedArgs { systemName, systemObjectType, systemObjectId, operations }.',
  },
  'idm.system.deleteSystemObject': {
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
        name: 'systemObjectId',
        type: 'string',
        required: true,
        position: 2,
        description: 'Connector object id to delete.',
        examples: ['uid=test,ou=people,dc=example,dc=com'],
      },
    ],
    supportsRealm: true,
    notes:
      'Delete a connector object with namedArgs { systemName, systemObjectType, systemObjectId }.',
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
  'oauth2oidc.client.createOAuth2Client': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'clientId',
        type: 'string',
        required: true,
        position: 0,
        description: 'OAuth2 client id to create.',
        examples: ['my-test-client'],
      },
      {
        name: 'clientData',
        type: 'OAuth2ClientSkeleton',
        required: true,
        position: 1,
        description:
          'OAuth2 client payload object including core/advanced override configuration.',
        schema: {
          type: 'object',
          properties: {
            coreOAuth2ClientConfig: { type: 'object' },
            advancedOAuth2ClientConfig: { type: 'object' },
            overrideOAuth2ClientConfig: { type: 'object' },
            signEncOAuth2ClientConfig: { type: 'object' },
            coreOpenIDClientConfig: { type: 'object' },
            coreUmaClientConfig: { type: 'object' },
          },
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Create an OAuth2 client. Prefer namedArgs { clientId, clientData } so the target id and payload are explicit.',
  },
  'oauth2oidc.client.updateOAuth2Client': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'clientId',
        type: 'string',
        required: true,
        position: 0,
        description: 'OAuth2 client id to update.',
        examples: ['my-test-client'],
      },
      {
        name: 'clientData',
        type: 'OAuth2ClientSkeleton',
        required: true,
        position: 1,
        description:
          'OAuth2 client payload object including core/advanced override configuration.',
        schema: {
          type: 'object',
          properties: {
            coreOAuth2ClientConfig: { type: 'object' },
            advancedOAuth2ClientConfig: { type: 'object' },
            overrideOAuth2ClientConfig: { type: 'object' },
            signEncOAuth2ClientConfig: { type: 'object' },
            coreOpenIDClientConfig: { type: 'object' },
            coreUmaClientConfig: { type: 'object' },
          },
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Update or upsert an OAuth2 client. Prefer namedArgs { clientId, clientData } to avoid positional ambiguity.',
  },
  'oauth2oidc.external.createSocialIdentityProvider': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'providerType',
        type: 'string',
        required: true,
        position: 0,
        description:
          'Social identity provider type, for example Google or Facebook.',
        examples: ['Google'],
      },
      {
        name: 'providerId',
        type: 'string',
        required: true,
        position: 1,
        description: 'Identity provider id or name to create.',
        examples: ['my-google-idp'],
      },
      {
        name: 'providerData',
        type: 'SocialIdpSkeleton',
        required: true,
        position: 2,
        description: 'Social identity provider payload object.',
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Create a social identity provider. Prefer namedArgs { providerType, providerId, providerData }.',
  },
  'oauth2oidc.external.updateSocialIdentityProvider': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'providerType',
        type: 'string',
        required: true,
        position: 0,
        description:
          'Social identity provider type, for example Google or Facebook.',
        examples: ['Google'],
      },
      {
        name: 'providerId',
        type: 'string',
        required: true,
        position: 1,
        description: 'Identity provider id or name to update.',
        examples: ['my-google-idp'],
      },
      {
        name: 'providerData',
        type: 'SocialIdpSkeleton',
        required: true,
        position: 2,
        description: 'Social identity provider payload object.',
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Update or upsert a social identity provider. Prefer namedArgs { providerType, providerId, providerData }.',
  },
  'oauth2oidc.issuer.createOAuth2TrustedJwtIssuer': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'issuerId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Trusted JWT issuer id to create.',
        examples: ['my-trusted-issuer'],
      },
      {
        name: 'issuerData',
        type: 'OAuth2TrustedJwtIssuerSkeleton',
        required: true,
        position: 1,
        description: 'Trusted JWT issuer payload object.',
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Create a trusted JWT issuer. Prefer namedArgs { issuerId, issuerData }.',
  },
  'oauth2oidc.issuer.updateOAuth2TrustedJwtIssuer': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'issuerId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Trusted JWT issuer id to update.',
        examples: ['my-trusted-issuer'],
      },
      {
        name: 'issuerData',
        type: 'OAuth2TrustedJwtIssuerSkeleton',
        required: true,
        position: 1,
        description: 'Trusted JWT issuer payload object.',
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Update or upsert a trusted JWT issuer. Prefer namedArgs { issuerId, issuerData }.',
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
