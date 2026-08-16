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
  'authn.node.readNodeType': {
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
        name: 'nodeTypeVersion',
        type: 'string',
        required: false,
        position: 1,
        description: 'Node type version.',
        defaultValue: '1.0',
        examples: ['1.0', '2.0'],
      },
    ],
    supportsRealm: true,
    notes:
      'Read a node type with namedArgs { nodeType, nodeTypeVersion }. nodeTypeVersion defaults to 1.0.',
  },
  'authn.node.readNodesByType': {
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
        name: 'nodeTypeVersion',
        type: 'string',
        required: false,
        position: 1,
        description: 'Node type version.',
        defaultValue: '1.0',
        examples: ['1.0', '2.0'],
      },
    ],
    supportsRealm: true,
    notes:
      'Read nodes by type with namedArgs { nodeType, nodeTypeVersion }. nodeTypeVersion defaults to 1.0.',
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
  'idm.config.readConfigEntitiesByType': {
    argumentMode: 'named',
    scope: 'bulk',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'IDM config entity type.',
      },
      {
        name: 'includeDefault',
        type: 'boolean',
        required: false,
        position: 1,
        description:
          'Include default email templates when reading emailTemplate entities.',
        defaultValue: false,
        examples: [false, true],
      },
    ],
    supportsRealm: false,
    semanticAliases: [
      'all password policies',
      'password policies',
      'field policies',
    ],
    notes: 'Read config entities of one type with namedArgs { type }.',
  },
  'idm.config.readConfigEntity': {
    argumentMode: 'named',
    scope: 'single',
    parameters: [
      {
        name: 'entityId',
        type: 'string',
        required: true,
        position: 0,
        description: 'IDM config entity id.',
      },
    ],
    supportsRealm: false,
    semanticAliases: [
      'realm password policy',
      'password policy',
      'field policy',
    ],
    notes: 'Read one config entity with namedArgs { entityId }.',
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
        name: 'moData',
        type: 'IdObjectSkeletonInterface',
        required: true,
        position: 1,
        description: 'Managed object payload object.',
        schema: { type: 'object', additionalProperties: true },
      },
      {
        name: 'id',
        type: 'string',
        required: false,
        position: 2,
        description: 'Optional managed object id. Omit to let IDM assign one.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
    ],
    supportsRealm: true,
    notes:
      "Create a managed object with namedArgs { type, id, moData }. id is optional. A relationship field can be set at creation time too, by including it directly in moData with the same ref-shaped value idm.managed.updateManagedObjectProperties's notes describe — see that skill for the full relationship-write pattern (discovering fields via schema, single- vs many-valued, add/remove/replace).",
  },
  'idm.managed.readManagedObjectSchema': {
    notes:
      "Read a type's schema — the way to discover its relationship fields before writing to them. A property with type 'relationship' is a relationship field; resourceCollection.path (nested under items for a many-valued field, directly on the property for a single-valued one) is the target type to reference. See idm.managed.updateManagedObjectProperties's notes for the actual write pattern.",
  },
  'idm.managed.readRelationship': {
    operationType: 'read',
    objectType: 'Relationship',
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
        description: 'Managed object id.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'field',
        type: 'string',
        required: true,
        position: 2,
        description:
          "Relationship field name, e.g. 'manager' or 'roles'. Use idm.managed.readManagedObjectSchema to discover a type's relationship fields.",
        examples: ['manager', 'roles'],
      },
    ],
    supportsRealm: true,
    mutating: false,
    riskClass: 'low',
    notes:
      "Reads the current value of a relationship field directly off a managed object with namedArgs { type, id, field } — the forward direction (e.g. an alpha_user's own 'manager' or 'roles'). Returns a single { _ref, ... } object for a single-valued field, an array of them for a many-valued field, or null/undefined if unset. For the reverse direction (e.g. an alpha_role's members) use idm.managed.queryRelatedManagedObjects instead — reverse relationships aren't stored as a field on the object at all.",
  },
  'idm.managed.addRelationship': {
    operationType: 'update',
    objectType: 'Relationship',
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed object type of the object being patched.',
        examples: ['alpha_user'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed object id being patched.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'field',
        type: 'string',
        required: true,
        position: 2,
        description: 'Many-valued relationship field name to add a member to.',
        examples: ['roles'],
      },
      {
        name: 'target',
        type: 'RelationshipTarget',
        required: true,
        position: 3,
        description:
          "The object to add, as plain { type, id } — no _ref/_refResourceCollection plumbing required, this skill builds it. type is the target's own managed object type (from the field's schema resourceCollection, e.g. alpha_role for alpha_user's roles field), not the source object's type.",
        schema: {
          type: 'object',
          properties: { type: { type: 'string' }, id: { type: 'string' } },
          required: ['type', 'id'],
        },
        examples: [
          { type: 'alpha_role', id: '1234abcd-0000-1111-2222-abcdefabcdef' },
        ],
      },
      {
        name: 'rev',
        type: 'string',
        required: false,
        position: 4,
        description: 'Optional optimistic concurrency revision token.',
      },
    ],
    supportsRealm: true,
    notes:
      'Adds one target to a many-valued relationship field without disturbing any existing members — the safe way to "add a member". Builds the exact request shape captured from AIC\'s own admin UI performing this action and verified live — field addressed as "/field/-" (JSON Pointer append-to-array syntax) with a bare { _ref, _refProperties: {} } value — so you don\'t have to know that shape yourself. Use idm.managed.replaceRelationship instead only when you actually mean to overwrite the whole field. Discover a field\'s name and target type via idm.managed.readManagedObjectSchema first (a relationship property with items present is many-valued).',
  },
  'idm.managed.removeRelationship': {
    operationType: 'update',
    objectType: 'Relationship',
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed object type of the object being patched.',
        examples: ['alpha_user'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed object id being patched.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'field',
        type: 'string',
        required: true,
        position: 2,
        description:
          'Many-valued relationship field name to remove a member from.',
        examples: ['roles'],
      },
      {
        name: 'target',
        type: 'RelationshipTarget',
        required: true,
        position: 3,
        description:
          "The object to remove, as plain { type, id } — same shape as addRelationship's target.",
        schema: {
          type: 'object',
          properties: { type: { type: 'string' }, id: { type: 'string' } },
          required: ['type', 'id'],
        },
        examples: [
          { type: 'alpha_role', id: '1234abcd-0000-1111-2222-abcdefabcdef' },
        ],
      },
      {
        name: 'rev',
        type: 'string',
        required: false,
        position: 4,
        description: 'Optional optimistic concurrency revision token.',
      },
    ],
    supportsRealm: true,
    riskClass: 'medium',
    notes:
      "Removes one target from a many-valued relationship field without disturbing any other members. Revokes access/membership — for example removing a role grants the tenant admin who ran it just took away, or a group membership — so treated as a step above the plain-read/add-a-member default. Builds the exact request shape captured from AIC's own admin UI performing this action and verified live: reads the field's current value first to find the exact stored element (including an internal _refProperties block IDM itself generates for the relationship, distinct from the referenced object's own id — a freshly-built ref without it silently matches nothing and removes nothing, no error), then removes that exact object as a bare (not array-wrapped) value — a different shape from what \"add\" needs, not a variation of it. Throws a clear error rather than silently doing nothing if the target isn't currently a member.",
  },
  'idm.managed.replaceRelationship': {
    operationType: 'update',
    objectType: 'Relationship',
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed object type of the object being patched.',
        examples: ['alpha_user'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed object id being patched.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'field',
        type: 'string',
        required: true,
        position: 2,
        description: 'Relationship field name to replace entirely.',
        examples: ['manager', 'roles'],
      },
      {
        name: 'target',
        type: 'RelationshipTarget | RelationshipTarget[] | null',
        required: true,
        position: 3,
        description:
          "The new value: a single { type, id } (or null to clear it) for a single-valued field like 'manager'; an array of { type, id } for a many-valued field like 'roles' — replacing the whole array, not adding to it. Use addRelationship/removeRelationship instead to change one member of a many-valued field without disturbing the rest.",
        examples: [
          { type: 'alpha_user', id: '1234abcd-0000-1111-2222-abcdefabcdef' },
          null,
        ],
      },
      {
        name: 'rev',
        type: 'string',
        required: false,
        position: 4,
        description: 'Optional optimistic concurrency revision token.',
      },
    ],
    supportsRealm: true,
    riskClass: 'medium',
    notes:
      "Replaces the entire value of a relationship field — a destructive overwrite of a many-valued field's whole membership list, not an incremental change, so treated as a step above add/read. Prefer addRelationship/removeRelationship for changing one member.",
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
        description:
          "JSON patch-style operations for the target object. Also the mechanism for writing relationships (adding/removing a member, setting a manager, etc.) — see this skill's notes for the exact shape; there is no separate relationship-write skill.",
        schema: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
        examples: [
          [{ operation: 'replace', field: '/mail', value: 'a@example.com' }],
          [
            {
              operation: 'add',
              field: '/roles/-',
              value: {
                _ref: 'managed/alpha_role/1234abcd-0000-1111-2222-abcdefabcdef',
                _refProperties: {},
              },
            },
          ],
          [
            {
              operation: 'remove',
              field: '/roles',
              value: {
                _ref: 'managed/alpha_role/1234abcd-0000-1111-2222-abcdefabcdef',
                _refResourceCollection: 'managed/alpha_role',
                _refResourceId: '1234abcd-0000-1111-2222-abcdefabcdef',
                _refProperties: {
                  _id: 'internal-relationship-id',
                  _rev: '...',
                },
              },
            },
          ],
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
      'Patch one managed object with namedArgs { type, id, operations, rev }. This is also the underlying mechanism relationships are written through — a relationship field is just a regular field from a PATCH point of view. Prefer the dedicated idm.managed.readRelationship/addRelationship/removeRelationship/replaceRelationship skills instead of raw operations here for relationship work — they take a plain { type, id } target and build the correct value shape for you, including two real gotchas verified live this session (and confirmed against the exact request shape AIC\'s own admin UI sends): "add" and "remove" each need a different, specific value shape that neither guessing nor generalizing from the other gets right.\n' +
      '\n' +
      "To find a type's relationship fields and what they target, call idm.managed.readManagedObjectSchema first: a property with type 'relationship' is a relationship field. A single-valued one (e.g. alpha_user's 'manager', targeting managed/alpha_user, reverse property 'reports') has resourceCollection directly on the property; a many-valued one (e.g. alpha_user's 'roles', targeting managed/alpha_role) has it nested under items instead — that items/no-items distinction is exactly what tells you whether the field holds one relationship or an array of them.\n" +
      '\n' +
      'If you do use raw operations here for a many-valued relationship: to add one member without disturbing the rest, address the field as "/field/-" (JSON Pointer append-to-array syntax) with operation "add" and a bare value of just { _ref: "<resourceCollection.path>/<id>", _refProperties: {} } — not array-wrapped, and no _refResourceCollection/_refResourceId (as in the second example above). To remove one member, address the field as "/field" (no index) with operation "remove" and a bare value that exactly matches the currently-stored element, including its _refProperties (an internal id/rev IDM itself generates for the relationship, distinct from the referenced object\'s own id) — read the field first (idm.managed.readRelationship) to get that exact stored element, since a freshly-built ref without the real _refProperties silently matches nothing and removes nothing, with no error (as in the third example above; the _refProperties values there are illustrative — always use the real ones from a fresh read, never fabricate them). For a single-valued relationship (like \'manager\'), use "replace" with a single (unwrapped) ref-shaped value { _ref, _refResourceCollection, _refResourceId }, or null to clear it — resourceCollection.path comes straight from the schema (e.g. "managed/alpha_role"), never guess or hardcode a realm prefix into it.',
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

  'idm.managedSystem.readManagedSystemObject': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description:
          'Managed system object type: teammember (tenant admin) or svcacct (service account). Distinct from regular managed object types like alpha_user — use idm.managed.readManagedObject for those.',
        examples: ['teammember', 'svcacct'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed system object id (UUID) to read.',
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
        examples: [['givenName', 'sn', 'userName']],
      },
    ],
    supportsRealm: false,
    riskClass: 'critical',
    notes:
      'Read a managed system object (teammember or svcacct) with namedArgs { type, id, fields }. A 403/permission error here — as opposed to a 404 — means the caller\'s own credential lacks visibility into that type (for example, a service-account-authenticated session typically cannot read teammember), not that the object doesn\'t exist; distinguish the two rather than treating both as "not found".',
  },
  'idm.managedSystem.readManagedSystemObjects': {
    riskClass: 'critical',
    notes:
      'List all managed system objects of a type (teammember or svcacct) — reveals the full tenant-admin or service-account roster. Admin-only regardless of read-only intent.',
  },
  'idm.managedSystem.readManagedSystemObjectSchema': {
    riskClass: 'critical',
  },
  'idm.managedSystem.queryManagedSystemObjects': {
    riskClass: 'critical',
    notes:
      'Search managed system objects of a type (teammember or svcacct) — can reveal tenant-admin or service-account membership. Admin-only regardless of read-only intent.',
  },
  'idm.managedSystem.countManagedSystemObjects': {
    riskClass: 'critical',
  },
  'idm.managedSystem.createManagedSystemObject': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed system object type: teammember or svcacct.',
        examples: ['teammember', 'svcacct'],
      },
      {
        name: 'moData',
        type: 'IdObjectSkeletonInterface',
        required: true,
        position: 1,
        description: 'Managed system object payload object.',
        schema: { type: 'object', additionalProperties: true },
      },
      {
        name: 'id',
        type: 'string',
        required: false,
        position: 2,
        description:
          'Optional managed system object id. Omit to let IDM assign one.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
    ],
    supportsRealm: false,
    riskClass: 'critical',
    notes:
      'Create a managed system object (teammember or svcacct) with namedArgs { type, moData, id }. teammember creation grants tenant-admin access — treat as critical regardless of type.',
  },
  'idm.managedSystem.updateManagedSystemObject': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed system object type: teammember or svcacct.',
        examples: ['teammember', 'svcacct'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed system object id to update.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'moData',
        type: 'IdObjectSkeletonInterface',
        required: true,
        position: 2,
        description: 'Updated managed system object payload object.',
        schema: { type: 'object', additionalProperties: true },
      },
    ],
    supportsRealm: false,
    riskClass: 'critical',
    notes:
      'Update a managed system object (teammember or svcacct) with namedArgs { type, id, moData }. Can change tenant-admin privileges — treat as critical regardless of type.',
  },
  'idm.managedSystem.updateManagedSystemObjectProperties': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed system object type: teammember or svcacct.',
        examples: ['teammember', 'svcacct'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed system object id to patch.',
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
          [{ operation: 'replace', field: '/description', value: 'updated' }],
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
    supportsRealm: false,
    riskClass: 'critical',
    notes:
      'Patch one managed system object (teammember or svcacct) with namedArgs { type, id, operations, rev }. Can change tenant-admin privileges — treat as critical regardless of type.',
  },
  'idm.managedSystem.updateManagedSystemObjectsProperties': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed system object type: teammember or svcacct.',
        examples: ['teammember', 'svcacct'],
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
          [{ operation: 'replace', field: '/description', value: 'updated' }],
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
    supportsRealm: false,
    supportsPaging: true,
    riskClass: 'critical',
    notes:
      'Patch multiple managed system objects (teammember or svcacct) with namedArgs { type, filter, operations, rev, pageSize }. Can change tenant-admin privileges — treat as critical regardless of type.',
  },
  'idm.managedSystem.deleteManagedSystemObject': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed system object type: teammember or svcacct.',
        examples: ['teammember', 'svcacct'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed system object id to delete.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
    ],
    supportsRealm: false,
    riskClass: 'critical',
    notes:
      'Delete a managed system object (teammember or svcacct) with namedArgs { type, id }. Deleting a teammember revokes tenant-admin access — treat as critical regardless of type.',
  },
  'idm.managedSystem.deleteManagedSystemObjects': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed system object type: teammember or svcacct.',
        examples: ['teammember', 'svcacct'],
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
    supportsRealm: false,
    riskClass: 'critical',
    notes:
      'Delete multiple managed system objects (teammember or svcacct) with namedArgs { type, filter }. Deleting a teammember revokes tenant-admin access — treat as critical regardless of type.',
  },
  'idm.managedSystem.queryRelatedManagedSystemObjects': {
    operationType: 'search',
    objectType: 'RelatedManagedSystemObject',
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed system object type: teammember or svcacct.',
        examples: ['teammember', 'svcacct'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed system object id.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'relationship',
        type: 'string',
        required: true,
        position: 2,
        description:
          'Name of the relationship to query, the reverse direction.',
      },
    ],
    supportsRealm: false,
    riskClass: 'critical',
    notes:
      'Query the reverse direction of a relationship on a managed system object (teammember or svcacct) with namedArgs { type, id, relationship, fields, pageSize }. Admin-only regardless of read-only intent, same as the rest of idm.managedSystem.*.',
  },
  'idm.managedSystem.readRelationship': {
    operationType: 'read',
    objectType: 'Relationship',
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed system object type: teammember or svcacct.',
        examples: ['teammember', 'svcacct'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed system object id.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'field',
        type: 'string',
        required: true,
        position: 2,
        description:
          "Relationship field name. Use idm.managedSystem.readManagedSystemObjectSchema to discover a type's relationship fields.",
      },
    ],
    supportsRealm: false,
    riskClass: 'critical',
    notes:
      'Reads the current value of a relationship field directly off a managed system object (teammember or svcacct) with namedArgs { type, id, field } — the forward direction. Admin-only regardless of read-only intent, same as the rest of idm.managedSystem.*.',
  },
  'idm.managedSystem.addRelationship': {
    operationType: 'update',
    objectType: 'Relationship',
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed system object type of the object being patched.',
        examples: ['teammember', 'svcacct'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed system object id being patched.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'field',
        type: 'string',
        required: true,
        position: 2,
        description: 'Many-valued relationship field name to add a member to.',
      },
      {
        name: 'target',
        type: 'RelationshipTarget',
        required: true,
        position: 3,
        description:
          'The object to add, as plain { type, id } — no _ref/_refResourceCollection plumbing required.',
        schema: {
          type: 'object',
          properties: { type: { type: 'string' }, id: { type: 'string' } },
          required: ['type', 'id'],
        },
      },
      {
        name: 'rev',
        type: 'string',
        required: false,
        position: 4,
        description: 'Optional optimistic concurrency revision token.',
      },
    ],
    supportsRealm: false,
    riskClass: 'critical',
    notes:
      "Adds one target to a many-valued relationship field on a managed system object (teammember or svcacct) without disturbing any existing members. Admin-only regardless of write intent, same as the rest of idm.managedSystem.*. See idm.managed.addRelationship's notes for the exact request shape this skill builds for you (captured from AIC's own admin UI, verified live).",
  },
  'idm.managedSystem.removeRelationship': {
    operationType: 'update',
    objectType: 'Relationship',
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed system object type of the object being patched.',
        examples: ['teammember', 'svcacct'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed system object id being patched.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'field',
        type: 'string',
        required: true,
        position: 2,
        description:
          'Many-valued relationship field name to remove a member from.',
      },
      {
        name: 'target',
        type: 'RelationshipTarget',
        required: true,
        position: 3,
        description: 'The object to remove, as plain { type, id }.',
        schema: {
          type: 'object',
          properties: { type: { type: 'string' }, id: { type: 'string' } },
          required: ['type', 'id'],
        },
      },
      {
        name: 'rev',
        type: 'string',
        required: false,
        position: 4,
        description: 'Optional optimistic concurrency revision token.',
      },
    ],
    supportsRealm: false,
    riskClass: 'critical',
    notes:
      "Removes one target from a many-valued relationship field on a managed system object (teammember or svcacct) without disturbing any other members. See idm.managed.removeRelationship's notes for the exact request shape this skill builds for you — reads the field's current value first to match IDM's own internal _refProperties on the exact stored element, then removes it as a bare value.",
  },
  'idm.managedSystem.replaceRelationship': {
    operationType: 'update',
    objectType: 'Relationship',
    argumentMode: 'named',
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: true,
        position: 0,
        description: 'Managed system object type of the object being patched.',
        examples: ['teammember', 'svcacct'],
      },
      {
        name: 'id',
        type: 'string',
        required: true,
        position: 1,
        description: 'Managed system object id being patched.',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
      {
        name: 'field',
        type: 'string',
        required: true,
        position: 2,
        description: 'Relationship field name to replace entirely.',
      },
      {
        name: 'target',
        type: 'RelationshipTarget | RelationshipTarget[] | null',
        required: true,
        position: 3,
        description:
          'The new value: a single { type, id } (or null to clear it) for a single-valued field, an array for a many-valued field.',
      },
      {
        name: 'rev',
        type: 'string',
        required: false,
        position: 4,
        description: 'Optional optimistic concurrency revision token.',
      },
    ],
    supportsRealm: false,
    riskClass: 'critical',
    notes:
      'Replaces the entire value of a relationship field on a managed system object (teammember or svcacct) — a destructive overwrite of the whole field, not an incremental change. Prefer addRelationship/removeRelationship for changing one member.',
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
  'script.deleteScripts': {
    argumentMode: 'named',
    parameters: [
      {
        name: 'resultCallback',
        type: 'ResultCallback<ScriptSkeleton>',
        required: false,
        position: 0,
        description:
          'Optional callback to process each deleted script as it is removed.',
      },
      {
        name: 'filter',
        type: 'ScriptFilter',
        required: false,
        position: 1,
        description:
          'Optional script filter selecting which non-default scripts to delete.',
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    ],
    supportsRealm: true,
    notes:
      'Prefer namedArgs { filter } for MCP callers. resultCallback is primarily intended for in-process library usage.',
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
    objectTypePatterns: ['*'],
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

  // ── Cloud log operations ──────────────────────────────────────────────────────
  // LogOps methods are named after the debug/audit log domain vocabulary (tail,
  // fetch, sources) rather than the create/read/update/delete/list/search naming
  // convention buildDescriptor infers operationType from, so most of them land as
  // operationType 'special' by default even though several are plain reads. These
  // entries give the true CRUD identity explicitly instead of renaming the
  // underlying LogOps methods.
  'cloud.log.getLogSources': {
    operationType: 'list',
    objectType: 'LogSource',
    argumentMode: 'none',
    parameters: [],
    supportsPaging: false,
    supportsIncludeTotal: false,
    requiredCredential: 'logApi',
    notes:
      'Returns the full set of available log source identifiers for this tenant. Pass one or more as the source parameter to fetch/tail. Sources split into two kinds: DEBUG sources (am-core, idm-core, ws-core — no audit events, troubleshooting only, e.g. authentication script output) and AUDIT sources (everything else — structured events with timestamps, transaction ids, and identity attribution). Each family has its own aggregate: am-everything covers only am-access/am-activity/am-authentication/am-config/am-core; idm-everything and ws-everything are scoped the same way to their own family — there is no single source spanning AM and IDM together. See cloud.log.fetch for the verified per-source event taxonomy. Requires a Log API key/secret — see cloud.log.createLogApiKey.',
  },
  'cloud.log.getLogApiKey': {
    operationType: 'read',
    objectType: 'LogApiKey',
    argumentMode: 'positional',
    parameters: [
      {
        name: 'keyId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Log API key id.',
      },
    ],
  },
  'cloud.log.getLogApiKeys': {
    operationType: 'list',
    objectType: 'LogApiKey',
    argumentMode: 'none',
    parameters: [],
  },
  'cloud.log.isLogApiKeyValid': {
    // Not a resource read: validates a key id + secret pair and returns a boolean.
    // Stays 'special' rather than being forced into 'read' semantics, but gets an
    // explicit non-mutating classification so it isn't gated by the CRUD allow list.
    mutating: false,
    destructive: false,
    riskClass: 'low',
    argumentMode: 'positional',
    requiredCredential: 'logApi',
    parameters: [
      {
        name: 'keyId',
        type: 'string',
        required: true,
        position: 0,
        description: 'Log API key id.',
      },
      {
        name: 'secret',
        type: 'string',
        required: true,
        position: 1,
        description: 'Log API key secret.',
      },
    ],
    notes: 'Validates a log API key id/secret pair; returns a boolean.',
  },
  'cloud.log.tail': {
    operationType: 'list',
    objectType: 'LogEvent',
    argumentMode: 'positional',
    requiredCredential: 'logApi',
    parameters: [
      {
        name: 'source',
        type: 'string',
        required: true,
        position: 0,
        description:
          'Log source(s) to tail, comma-separated. am-core/idm-core/ws-core are DEBUG sources (no audit events); everything else is an AUDIT source. See cloud.log.getLogSources and cloud.log.fetch for the full taxonomy.',
        examples: ['am-core', 'am-authentication,idm-core'],
      },
      {
        name: 'cookie',
        type: 'string',
        required: false,
        position: 1,
        description: 'Paged-results cookie from a previous tail call.',
      },
    ],
    supportsPaging: true,
    supportsIncludeTotal: false,
    notes:
      'Reads the next batch of log events from a live cursor position for the given source(s). No time range or filter; use cloud.log.fetch for bounded/filtered queries and for the event/source taxonomy (identity events, session-granted signal, config-change attribution) documented on that skill. Requires a Log API key/secret — see cloud.log.createLogApiKey.',
  },
  'cloud.log.fetch': {
    operationType: 'search',
    objectType: 'LogEvent',
    argumentMode: 'named',
    requiredCredential: 'logApi',
    parameters: [
      {
        name: 'source',
        type: 'string',
        required: true,
        position: 0,
        description:
          "Log source(s) to query, comma-separated. am-core/idm-core/ws-core are DEBUG sources (no audit events); everything else is an AUDIT source. See the source taxonomy in this method's notes, and cloud.log.getLogSources for the live list.",
        examples: ['am-core', 'am-authentication,idm-core'],
      },
      {
        name: 'startTs',
        type: 'string',
        required: false,
        position: 1,
        description: 'Start timestamp (ISO 8601), inclusive.',
        examples: ['2026-08-14T00:00:00Z'],
      },
      {
        name: 'endTs',
        type: 'string',
        required: false,
        position: 2,
        description: 'End timestamp (ISO 8601), exclusive.',
        examples: ['2026-08-15T00:00:00Z'],
      },
      {
        name: 'cookie',
        type: 'string',
        required: false,
        position: 3,
        description: 'Paged-results cookie from a previous fetch call.',
      },
      {
        name: 'txid',
        type: 'string',
        required: false,
        position: 4,
        description: 'Optional transaction id to narrow the query to.',
      },
      {
        name: 'filter',
        type: 'string',
        required: false,
        position: 5,
        description:
          'CREST _queryFilter syntax: a leading-slash field path against the log payload, e.g. /payload/eventName eq "AM-TREE-LOGIN-COMPLETED". Operators: eq, co (contains), sw (starts with), pr (present); combine multiple with "and". Field paths WITHOUT the leading slash (payload.eventName, payload/eventName) or an unprefixed field both fail with an opaque 500 — the leading slash is not optional. Prefer filtering server-side over fetching unfiltered and post-filtering: results are capped by an inline size limit and returned oldest-first within the window, so an unfiltered fetch over a noisy tenant truncates before reaching what you want.',
        examples: [
          '/payload/eventName eq "AM-TREE-LOGIN-COMPLETED"',
          '/payload/eventName eq "AM-TREE-LOGIN-COMPLETED" and /payload/userId co "o=alpha"',
          '/payload/transactionId sw "83da4a26-4156-4d1a-85a8-64ee5b719f1d"',
        ],
      },
    ],
    supportsPaging: true,
    supportsIncludeTotal: false,
    notes:
      'Queries log events by source, time range, transaction id, and/or filter — the operation for bounded questions like "what were the last N logins" or "who changed journey X". Source taxonomy below combines Ping\'s documented source descriptions (docs.pingidentity.com/pingoneaic/tenants/audit-debug-log-sources.html) with event-level shapes verified live against a real tenant this session — the AM-side entries are directly observed; the IDM-side entries are documented but not yet independently verified against live IDM events, so treat their event-name specifics as provisional until checked.\n' +
      '\n' +
      'Time window limit: startTs..endTs spans wider than ~24 hours fail with an opaque 400, verified live against two different sources (am-config, am-authentication) both with and without a filter — this is a Log API-wide limit, not specific to one source or to filtering. Split any wider question into consecutive ~24h calls yourself using this skill directly, or use cloud.log.searchEvents instead, which does that chunking automatically.\n' +
      '\n' +
      'DEBUG sources — no audit events, troubleshooting only. am-core and idm-core are DEBUG-level in dev/sandbox tenants, WARNING-and-above in staging/production; am-core specifically is where authentication SCRIPT logging output shows up (relevant for "why did this script do X" questions, not identity/change questions). Shape is raw application log lines (`context`/`logger`/`message`/`thread`/`mdc.transactionId`), not the structured audit payload described below. ws-core is the WS-Federation equivalent.\n' +
      '\n' +
      'AUDIT sources, AM side (verified live):\n' +
      '- am-authentication (topic authentication): identity/login events. AM-TREE-LOGIN-COMPLETED fires once per completed journey, human or service, carrying `result` and — only on completion — a resolved `userId`; this is the event to filter on. AM-LOGIN-COMPLETED / AM-LOGIN-MODULE-COMPLETED only fire for legacy module-class auth (service/agent bindings), not tree-based human logins. AM-NODE-LOGIN-COMPLETED fires per node and is too granular for identity queries.\n' +
      '- am-access (topic access): "who, what, when, and the output for every access request" per Ping\'s docs — REST-level ATTEMPT/OUTCOME pairs. Redundant with AM-TREE-LOGIN-COMPLETED for identity purposes.\n' +
      "- am-activity (topic activity): state changes to objects created/updated/deleted by end users — sessions, user profiles, device profiles per Ping's docs. `operation`: CREATE/UPDATE/DELETE against a typed `component`. AM-SESSION-CREATED here is the only reliable signal that a session was actually granted — AM-TREE-LOGIN-COMPLETED and the am-access OUTCOME both report a plain SUCCESSFUL/200 even for a noSession=true journey that grants no session at all, with no other difference in either event.\n" +
      "- am-config (topic config): AM configuration changes with timestamp and user attribution per Ping's docs — documented as available in DEVELOPMENT ENVIRONMENTS ONLY, so don't assume this exists on staging/production tenants without checking cloud.log.getLogSources first. AM-CONFIG-CHANGE events cover admin-console config edits (journeys, nodes, scripts, services) — `objectId` is the changed resource's DN, `changedFields` lists which fields changed (names only, not before/after values), `operation` is CREATE/UPDATE/DELETE. Attribution caveat: script/service-level changes carry the real editor's `userId`, but authentication-tree and node changes are attributed to an internal directory-service account (`dsameuser`) instead of the admin who made them — recover the real identity by following the event's `trackingIds` to a correlated am-activity AM-SESSION-CREATED event for the same session.\n" +
      '- am-everything: aggregates am-access/am-activity/am-authentication/am-config/am-core only — AM side, not IDM. The fastest way to explore an unfamiliar AM-side question: scope tightly by transaction id (filter: /payload/transactionId sw "<txid>") or a narrow recent window, rather than guessing which individual source holds the answer.\n' +
      '\n' +
      "AUDIT sources, IDM side (per Ping's docs, event-name specifics not yet independently verified this session):\n" +
      '- idm-authentication: when and how a user authenticated through IDM.\n' +
      '- idm-access: IDM access calls as audit events, same who/what/when/output shape as am-access.\n' +
      '- idm-activity: state changes to objects created/updated/deleted by IDM end users — the likely IDM-side equivalent of am-activity, not yet confirmed to carry the same session-granted signal.\n' +
      '- idm-config: IDM configuration changes with timestamp and by whom — the likely place to look for changes to IDM-managed objects (users, roles) analogous to what am-config covers for AM config, not yet confirmed live.\n' +
      '- idm-recon / idm-sync: reconciliation and synchronization events; no verified event shape yet.\n' +
      '- idm-everything: aggregates the idm-* sources above only — not AM. Query both am-everything and idm-everything (or the specific sources on each side) for a question that could touch either.\n' +
      '\n' +
      'Identity: a resolved `userId` DN under a realm segment (...,o=<realm>,ou=services,ou=am-config) is a genuine managed user; a DN directly under root ou=am-config (whether it says ou=agent or, misleadingly, ou=user) is an AM-internal identity. Extract the uuid from the DN and resolve it with idm.managed.resolveUserName(<realm>_user, uuid).\n' +
      '\n' +
      'Requires a Log API key/secret — see cloud.log.createLogApiKey.',
  },
  'cloud.log.searchEvents': {
    operationType: 'search',
    objectType: 'LogEvent',
    argumentMode: 'named',
    requiredCredential: 'logApi',
    parameters: [
      {
        name: 'source',
        type: 'string',
        required: true,
        position: 0,
        description:
          'Log source(s) to search, comma-separated. Same source taxonomy as cloud.log.fetch.',
        examples: ['am-authentication', 'am-everything'],
      },
      {
        name: 'startTs',
        type: 'string',
        required: true,
        position: 1,
        description: 'Start timestamp (ISO 8601), inclusive.',
        examples: ['2026-08-14T00:00:00Z'],
      },
      {
        name: 'endTs',
        type: 'string',
        required: true,
        position: 2,
        description: 'End timestamp (ISO 8601), exclusive.',
        examples: ['2026-08-15T00:00:00Z'],
      },
      {
        name: 'eventNames',
        type: 'string[]',
        required: false,
        position: 3,
        description:
          'Optional event names to match, OR\'d together server-side (e.g. ["AM-TREE-LOGIN-COMPLETED"]). Omit to match every event in the source/window.',
        schema: { type: 'array', items: { type: 'string' } },
        examples: [['AM-TREE-LOGIN-COMPLETED'], ['AM-CONFIG-CHANGE']],
      },
      {
        name: 'principal',
        type: 'string',
        required: false,
        position: 4,
        description:
          'Optional substring matched against payload.userId (co). A realm-qualified substring like "o=alpha" scopes to genuine managed users in that realm; the DN-realm heuristic in cloud.log.fetch\'s notes explains why.',
        examples: ['o=alpha'],
      },
      {
        name: 'maxEvents',
        type: 'integer',
        required: false,
        position: 5,
        description:
          'Safety cap on total events fetched across auto-paginated pages.',
        defaultValue: 1000,
        examples: [200, 1000],
      },
      {
        name: 'dedupeByTransactionId',
        type: 'boolean',
        required: false,
        position: 6,
        description:
          'Collapse multiple events sharing a transaction id (e.g. a failed login attempt immediately followed by a successful retry) down to the last one seen, the actual outcome. Set false to see every raw event.',
        defaultValue: true,
        examples: [true, false],
      },
    ],
    supportsPaging: false,
    supportsIncludeTotal: false,
    notes:
      'Composed primitive over cloud.log.fetch: builds the correct server-side _queryFilter from structured eventNames/principal inputs (see cloud.log.fetch\'s notes for the underlying CREST syntax and event/source taxonomy — this skill assumes that context), and handles the two constraints that make wide-range questions like "activities of user X over 2 weeks" fail if called against cloud.log.fetch directly: it auto-chunks startTs..endTs into consecutive ~24h windows (the Log API 400s past that span — see cloud.log.fetch\'s notes), and auto-paginates within each, all while respecting the ~1 request/second rate limit between every call, chunk boundaries included. Dedupes by transaction id client-side (CREST filters cannot express "collapse retries of the same transaction", so this has to happen after fetching). Prefer this over cloud.log.fetch directly for "how many/which X happened" questions scoped by event name and/or identity, especially over wide time ranges; use cloud.log.fetch directly only when you need raw pagination control or a transaction-id-scoped lookup.',
  },
  'cloud.log.resolveLevel': { excluded: true },
  'cloud.log.resolvePayloadLevel': { excluded: true },
  'cloud.log.getDefaultNoiseFilter': { excluded: true },

  // ── Special-capability audit (library-wide) ───────────────────────────────────
  //
  // Every method below was classified `kind: 'special'` by naming-convention
  // inference alone, which only recognizes create/update/delete/import as mutating
  // and only escalates risk for names matching /secret|password|token|credential|
  // serviceAccount/i. That leaves a permissive default (mutating: false, low risk)
  // for anything named outside those conventions — including real mutations like
  // `disableJourney` or `removeOrphanedNodes`. This section gives each one an
  // explicit, reviewed classification instead of inheriting that default, so
  // policy presets with `includeSpecial: true` expose only what's actually been
  // checked. New special-kind methods should get an entry here (or be covered by
  // the `contract-gap-baseline.json` guardrail test) before a permissive preset
  // can reach them.
  //
  // A few entries also carry an `operationType` override where the method is
  // genuinely CRUD-shaped and just fails the naming regex (e.g. `disableJourney`
  // → `update`, `removeOrphanedNodes` → `delete`), following the same reasoning
  // as the cloud.log remap above. Parameter/argument-contract authoring for the
  // newly-reachable operations is a separate follow-up, not covered here.

  'admin.executeRfc7523AuthZGrantFlow': {
    mutating: true,
    riskClass: 'critical',
    notes:
      'Executes a live RFC 7523 JWT-bearer authorization grant against the tenant, obtaining a real access token. Treat as credential issuance.',
  },
  'admin.generateRfc7523AuthZGrantArtefacts': {
    mutating: false,
    riskClass: 'high',
    notes:
      'Generates local JWT-bearer grant artefacts (assertions/keys). No tenant call, but produces auth material.',
  },
  'admin.generateRfc7523ClientAuthNArtefacts': {
    mutating: false,
    riskClass: 'high',
    notes:
      'Generates local client-authentication artefacts. No tenant call, but produces auth material.',
  },
  'admin.trainAA': {
    mutating: true,
    riskClass: 'high',
    notes:
      'Best-effort classification: assumed to trigger Autonomous Access model training on the tenant, a real and potentially long-running operation. Confirm against product docs before relying on this.',
  },

  'app.getRealmManagedApplication': {
    operationType: 'read',
    objectType: 'ManagedApplication',
    mutating: false,
    riskClass: 'low',
  },

  'authn.journey.disableJourney': {
    operationType: 'update',
    objectType: 'Journey',
    mutating: true,
    riskClass: 'medium',
    notes: 'Deactivates a journey.',
  },
  'authn.journey.enableJourney': {
    operationType: 'update',
    objectType: 'Journey',
    mutating: true,
    riskClass: 'medium',
    notes: 'Activates a journey.',
  },
  'authn.journey.findScriptReferences': {
    operationType: 'search',
    objectType: 'ScriptReference',
    argumentMode: 'positional',
    parameters: [
      {
        name: 'scriptId',
        type: 'string',
        required: true,
        position: 0,
        description:
          'Script id to find journey/node references to (the same id used by authn.journey/authz.* script fields, script.script.readScript, etc.).',
        examples: ['1234abcd-0000-1111-2222-abcdefabcdef'],
      },
    ],
    mutating: false,
    riskClass: 'low',
    notes:
      'Answers "which journey uses this script?" — a config dependency question no other skill can answer, since the reference only lives on individual node objects (node.script), not on the journey itself or the script. Implemented as a full-realm scan (bulk-reads every node and every journey once, then joins in memory — no per-node fetches), so it stays cheap even on realms with many journeys. Each result reports the journey and the top-level node it actually references; when the script is used by a node nested inside a container node (e.g. a Page Node), the result also carries innerNodeId for the specific nested node, since a journey\'s own node map only ever points at the container. Returns an empty array, not an error, when nothing references the script.',
  },
  'authn.journey.getJourneyClassification': {
    operationType: 'read',
    objectType: 'JourneyClassification',
    mutating: false,
    riskClass: 'low',
  },
  'authn.journey.getNodeRef': {
    // Takes a full NodeSkeleton + SingleTreeExportInterface as input, not a
    // simple identifier — internal plumbing used while processing an export
    // already in hand, not a standalone operation an agent could call.
    excluded: true,
  },
  'authn.journey.getTreeDescendents': {
    operationType: 'list',
    objectType: 'Journey',
    mutating: false,
    riskClass: 'low',
  },
  'authn.journey.resolveDependencies': {
    operationType: 'list',
    objectType: 'JourneyDependency',
    mutating: false,
    riskClass: 'low',
  },
  'authn.journey.isCloudOnlyJourney': { mutating: false, riskClass: 'low' },
  'authn.journey.isCustomJourney': { mutating: false, riskClass: 'low' },
  'authn.journey.isPremiumJourney': { mutating: false, riskClass: 'low' },
  'authn.journey.fileByIdTreeExportResolver': {
    excluded: true, // internal resolver used by exportJourney, not a standalone operation
  },
  'authn.journey.onlineTreeExportResolver': {
    excluded: true, // internal resolver used by exportJourney, not a standalone operation
  },

  'authn.node.findOrphanedNodes': {
    operationType: 'list',
    objectType: 'OrphanedNode',
    mutating: false,
    riskClass: 'low',
  },
  'authn.node.getCustomNodeUsage': {
    operationType: 'read',
    objectType: 'NodeUsage',
    mutating: false,
    riskClass: 'low',
  },
  'authn.node.getNodeClassification': {
    operationType: 'read',
    objectType: 'NodeClassification',
    mutating: false,
    riskClass: 'low',
  },
  'authn.node.removeOrphanedNodes': {
    operationType: 'delete',
    objectType: 'OrphanedNode',
    mutating: true,
    destructive: true,
    riskClass: 'high',
    notes: 'Bulk-deletes orphaned node configuration objects.',
  },
  'authn.node.isCloudExcludedNode': { mutating: false, riskClass: 'low' },
  'authn.node.isCloudOnlyNode': { mutating: false, riskClass: 'low' },
  'authn.node.isCustomNode': { mutating: false, riskClass: 'low' },
  'authn.node.isDeprecatedNode': { mutating: false, riskClass: 'low' },
  'authn.node.isPremiumNode': { mutating: false, riskClass: 'low' },

  // Local SDK plumbing, not tenant capabilities. `cache` is frodo's local
  // encrypted token-cache bookkeeping; `conn` is frodo's local connection-profile
  // store, which holds saved login credentials for every environment a user has
  // ever configured frodo against — not scoped to the active MCP session's
  // tenant. Exposing either as an agent-callable skill risks credential
  // disclosure across environments the current session has no business
  // touching, so both are excluded outright rather than risk-ranked per method.
  cache: { excluded: true },
  conn: { excluded: true },

  'cloud.env.abortDirectConfigurationSession': {
    mutating: true,
    riskClass: 'medium',
    notes: 'Cancels a staged direct-configuration session.',
  },
  'cloud.env.initDirectConfigurationSession': {
    mutating: true,
    riskClass: 'medium',
    notes: 'Opens a staged direct-configuration session.',
  },
  'cloud.env.applyDirectConfigurationSession': {
    mutating: true,
    destructive: true,
    riskClass: 'critical',
    notes: 'Commits a staged direct-configuration session to the live tenant.',
  },
  'cloud.env.cert.activateCertificate': { mutating: true, riskClass: 'high' },
  'cloud.env.cert.deactivateCertificate': {
    mutating: true,
    destructive: true,
    riskClass: 'high',
  },
  'cloud.env.cert.isCertificateActive': { mutating: false, riskClass: 'low' },
  'cloud.env.cert.isCertificateLive': { mutating: false, riskClass: 'low' },
  'cloud.env.enableAIAgentFeature': { mutating: true, riskClass: 'medium' },
  'cloud.env.enforceFederationFor': {
    mutating: true,
    destructive: true,
    riskClass: 'high',
    notes:
      'Enforces federated login for a target, which can lock out password-based access.',
  },
  'cloud.env.promotion.lockEnvironment': {
    mutating: true,
    riskClass: 'medium',
  },
  'cloud.env.promotion.unlockEnvironment': {
    mutating: true,
    riskClass: 'medium',
  },
  'cloud.env.promotion.promoteConfiguration': {
    mutating: true,
    destructive: true,
    riskClass: 'critical',
    notes: 'Promotes staged configuration to the live tenant.',
  },
  'cloud.env.promotion.rollbackPromotion': {
    mutating: true,
    destructive: true,
    riskClass: 'critical',
    notes: 'Reverts a prior promotion on the live tenant.',
  },
  'cloud.env.promotion.runProvisionalPromotionReport': {
    mutating: false,
    riskClass: 'low',
    notes: 'Dry-run preview; does not apply changes.',
  },
  'cloud.env.promotion.runProvisionalRollbackReport': {
    mutating: false,
    riskClass: 'low',
    notes: 'Dry-run preview; does not apply changes.',
  },
  'cloud.env.resetSSOCookieConfig': {
    mutating: true,
    destructive: true,
    riskClass: 'high',
    notes:
      'Resets tenant-wide SSO cookie configuration; can invalidate active sessions.',
  },
  'cloud.env.verifyCNAME': { mutating: false, riskClass: 'low' },

  'cloud.esvCount.getEsvCount': {
    operationType: 'count',
    objectType: 'Esv',
    mutating: false,
    riskClass: 'low',
  },
  'cloud.getEsvCount': {
    operationType: 'count',
    objectType: 'Esv',
    mutating: false,
    riskClass: 'low',
  },

  'cloud.feature.hasFeature': { mutating: false, riskClass: 'low' },

  'cloud.iga.workflow.publishWorkflow': {
    mutating: true,
    riskClass: 'medium',
    notes: 'Publishes a workflow definition, making it active.',
  },

  'cloud.secret.disableVersionOfSecret': { mutating: true, destructive: true },
  'cloud.secret.enableVersionOfSecret': { mutating: true },

  'cloud.serviceAccount.getServiceAccount': {
    operationType: 'read',
    objectType: 'ServiceAccount',
    mutating: false,
    // riskClass intentionally left to inference: "ServiceAccount" already
    // matches the credential-keyword regex and infers 'critical'.
  },
  'cloud.serviceAccount.isServiceAccountsFeatureAvailable': {
    mutating: false,
    riskClass: 'low',
    notes:
      'Feature-availability flag only; does not touch service account data. Explicit override corrects the keyword-based critical default.',
  },
  'cloud.serviceAccount.validateServiceAccount': {
    mutating: false,
    // riskClass intentionally left to inference (critical): validates
    // credential material.
  },

  'cloud.startup.checkForUpdates': { mutating: false, riskClass: 'low' },
  'cloud.startup.applyUpdates': {
    mutating: true,
    destructive: true,
    riskClass: 'critical',
    notes: 'Applies platform updates to the environment.',
  },

  'cloud.variable.getVariable': {
    operationType: 'read',
    objectType: 'Variable',
    mutating: false,
    riskClass: 'medium',
    notes: 'ESV variables may hold sensitive-but-unclassified config values.',
  },
  'cloud.variable.getVariables': {
    operationType: 'list',
    objectType: 'Variable',
    mutating: false,
    riskClass: 'medium',
  },
  'cloud.variable.resolveVariable': {
    operationType: 'read',
    objectType: 'Variable',
    mutating: false,
    riskClass: 'medium',
  },
  'cloud.variable.putVariable': {
    operationType: 'update',
    objectType: 'Variable',
    mutating: true,
    riskClass: 'medium',
  },
  'cloud.variable.setVariableDescription': {
    operationType: 'update',
    objectType: 'Variable',
    mutating: true,
    riskClass: 'low',
  },

  'cloud.wsfed.generateSigningKeyPair': {
    mutating: true,
    destructive: true,
    riskClass: 'high',
    notes:
      'Generates and persists a new WS-Fed signing key pair; can supersede/invalidate prior signatures.',
  },

  'idm.crypto.decrypt': {
    mutating: false,
    riskClass: 'critical',
    notes:
      'Decryption oracle — treat as a secret-disclosure risk even though it does not mutate state.',
  },
  'idm.crypto.decryptMap': {
    mutating: false,
    riskClass: 'critical',
    notes:
      'Decryption oracle — treat as a secret-disclosure risk even though it does not mutate state.',
  },
  'idm.crypto.encrypt': { mutating: false, riskClass: 'medium' },
  'idm.crypto.encryptMap': { mutating: false, riskClass: 'medium' },
  'idm.crypto.isEncrypted': { mutating: false, riskClass: 'low' },

  'idm.managed.resolveFullName': {
    operationType: 'read',
    objectType: 'ManagedObjectName',
    argumentMode: 'positional',
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
        description: 'Managed object id (UUID).',
      },
    ],
    mutating: false,
    riskClass: 'low',
  },
  'idm.managed.resolveIdentity': {
    operationType: 'read',
    objectType: 'ManagedObjectName',
    argumentMode: 'positional',
    parameters: [
      {
        name: 'idOrDn',
        type: 'string',
        required: true,
        position: 0,
        description:
          "A managed/system object uuid, or a full userId DN (e.g. from an audit log event's userId field). A DN qualified under a realm (...,o=<realm>,ou=services,ou=am-config) resolves as that realm's managed user; a DN with no realm segment (...,ou=am-config) is AM-internal and is checked against service-account and tenant-admin managed system object types instead.",
        examples: [
          'id=03f4f90e-d1fa-433d-bc67-6349a8a6ca77,ou=user,o=alpha,ou=services,ou=am-config',
          'a2245410-33a6-4442-9f3b-453c9aaf158a',
        ],
      },
      {
        name: 'realm',
        type: 'string',
        required: false,
        position: 1,
        description:
          'Realm override, only consulted when idOrDn is a bare uuid with no DN to derive a realm from. Ignored if idOrDn is a DN that already carries its own realm segment.',
        examples: ['alpha'],
      },
    ],
    mutating: false,
    // Unlike idm.managedSystem.* (arbitrary-field reads on raw teammember/
    // svcacct objects, critical/admin-only), this always requests a fixed,
    // narrow field set and returns a bounded {kind, username, displayName}
    // shape — never arbitrary fields, never anything credential-adjacent.
    // Same disclosure category as resolveUserName/resolveFullName (low),
    // which it's the structured, realm-general, honestly-uncertain successor
    // to. Needs to stay broadly available: it's the load-bearing primitive
    // behind ordinary audit-attribution questions like "who modified journey
    // X" and "which tenant admin logged in", which must work under the
    // default agentic policy, not just admin.
    riskClass: 'low',
    notes:
      'Resolves a DN or bare uuid to a structured identity: { id, kind: "user"|"service"|"admin"|"admin-unconfirmed"|"unknown", realm?, username?, displayName?, resolvedVia?, note? }. Replaces the old resolvePerpetratorUuid (which returned an opaque formatted string and hardcoded alpha_user/bravo_user as the only realms). "admin-unconfirmed" means the calling credential got a 403 (not a 404) checking the tenant-admin managed object type directly — common for service-account-authenticated sessions, which typically cannot read teammember — so admin status is inferred by elimination rather than independently confirmed; treat it as likely-but-unverified. Only cloud partitions managed users per realm (alpha_user, bravo_user, ...); forgeops and classic both resolve realm-qualified DNs against a single flat "user" type — verified live against a real forgeops tenant, whose IDM managed object families reported no realm prefix at all.',
  },
  'idm.managed.resolveUserName': {
    operationType: 'read',
    objectType: 'ManagedObjectName',
    argumentMode: 'positional',
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
        description: 'Managed object id (UUID).',
      },
    ],
    mutating: false,
    riskClass: 'low',
  },

  'idm.mapping.isLegacyMapping': { mutating: false, riskClass: 'low' },

  'idm.organization.getRealmManagedOrganization': {
    operationType: 'read',
    objectType: 'ManagedOrganization',
    mutating: false,
    riskClass: 'low',
  },

  'idm.recon.startRecon': {
    mutating: true,
    riskClass: 'high',
    notes:
      'Starts a reconciliation run, which can create/update/delete managed objects as a side effect.',
  },
  'idm.recon.startReconById': {
    mutating: true,
    riskClass: 'high',
    notes:
      'Starts a reconciliation run, which can create/update/delete managed objects as a side effect.',
  },
  'idm.recon.cancelRecon': { mutating: true, riskClass: 'medium' },

  'idm.script.evaluateScript': {
    mutating: true,
    destructive: true,
    riskClass: 'critical',
    notes:
      'Executes arbitrary script against the tenant — equivalent to a remote code execution capability.',
  },
  'idm.script.compileScript': {
    mutating: false,
    riskClass: 'medium',
    notes: 'Syntax-checks a script without executing it.',
  },

  'idm.system.runSystemScript': {
    mutating: true,
    destructive: true,
    riskClass: 'critical',
    notes:
      'Executes arbitrary script in a connector/system context — equivalent to a remote code execution capability.',
  },
  'idm.system.authenticateSystemObject': {
    mutating: false,
    riskClass: 'high',
    notes:
      'Authenticates against an external connected system using stored credentials.',
  },
  'idm.system.testConnectorServers': { mutating: false, riskClass: 'low' },

  'info.getInfo': {
    operationType: 'read',
    objectType: 'Info',
    mutating: false,
    riskClass: 'low',
  },

  'login.getTokens': {
    mutating: false,
    riskClass: 'critical',
    notes:
      'Returns live bearer/session tokens for the current identity. Kept in the inventory at critical risk rather than excluded; only reachable under policies that do not deny critical risk (e.g. admin).',
  },

  'oauth2oidc.endpoint.accessToken': { mutating: true },
  'oauth2oidc.endpoint.accessTokenRfc7523AuthZGrant': { mutating: true },
  'oauth2oidc.endpoint.clientCredentialsGrant': { mutating: true },
  'oauth2oidc.endpoint.getTokenInfo': { mutating: false },
  'oauth2oidc.endpoint.authorize': {
    mutating: true,
    riskClass: 'high',
    notes:
      'Initiates a live OAuth2 authorization request against the tenant. Explicit override — the method name does not match the credential-keyword inference.',
  },

  'realm.addCustomDomain': {
    operationType: 'create',
    objectType: 'CustomDomain',
    mutating: true,
    riskClass: 'medium',
  },
  'realm.removeCustomDomain': {
    operationType: 'delete',
    objectType: 'CustomDomain',
    mutating: true,
    destructive: true,
    riskClass: 'high',
  },

  'saml2.entityProvider.getSaml2ProviderMetadata': {
    operationType: 'read',
    objectType: 'Saml2ProviderMetadata',
    mutating: false,
    riskClass: 'low',
  },
  'saml2.entityProvider.getSaml2ProviderMetadataUrl': {
    operationType: 'read',
    objectType: 'Saml2ProviderMetadata',
    mutating: false,
    riskClass: 'low',
  },

  'script.getLibraryScriptNames': {
    operationType: 'list',
    objectType: 'ScriptName',
    mutating: false,
    riskClass: 'low',
  },

  'secretStore.canSecretStoreHaveMappings': {
    mutating: false,
    riskClass: 'low',
    notes:
      'Capability flag only; explicit override corrects the keyword-based critical default triggered by "Secret" in the method name.',
  },

  'session.getSessionInfo': {
    operationType: 'read',
    objectType: 'SessionInfo',
    mutating: false,
    riskClass: 'medium',
  },
};

/**
 * Resolves the most specific {@link OperationCapabilityMeta} entry for a capability id.
 *
 * @remarks
 * Matching module-prefix metadata is composed from least to most specific,
 * then exact operation metadata is applied last. This lets exact argument
 * contracts inherit deployment and identity-surface metadata from their module.
 *
 * @param capabilityId Full dot-path capability id, e.g. `"idm.managed.countManagedObjects"`.
 * @returns The matching metadata entry, or `undefined` if no entry covers this id.
 */
export function resolveCapabilityMeta(
  capabilityId: string
): OperationCapabilityMeta | undefined {
  const matchingPrefixes = Object.keys(CAPABILITY_META)
    .filter((key) => capabilityId.startsWith(`${key}.`))
    .sort((left, right) => left.length - right.length);
  const exactMeta = Object.prototype.hasOwnProperty.call(
    CAPABILITY_META,
    capabilityId
  )
    ? CAPABILITY_META[capabilityId]
    : undefined;

  if (matchingPrefixes.length === 0 && exactMeta === undefined) {
    return undefined;
  }

  return Object.assign(
    {},
    ...matchingPrefixes.map((key) => CAPABILITY_META[key]),
    exactMeta ?? {}
  );
}
