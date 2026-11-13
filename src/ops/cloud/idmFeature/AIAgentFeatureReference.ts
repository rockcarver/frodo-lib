/**
 * The definitions that version "1" of the IDM feature `aiagent` writes into a tenant, as data.
 *
 * @remarks
 * Installing the feature applies 26 operations to two configuration objects: it appends four managed object
 * definitions (`<realm>_aiagent` and `<realm>_aiagentprivilege` for the realms alpha and bravo) and adds properties
 * to the managed objects `<realm>_user`, `<realm>_group` and `<realm>_application` in `config/managed`, and it adds
 * four explicit and four generic mappings to `config/repo.ds`. The registry (`GET /openidm/feature/aiagent`) is not a
 * stored object: `installedVersion` is "1" exactly when every one of these definitions equals the original, so a
 * trailing newline, a changed title or one extra mapping property makes it read null. This module is what a tenant is
 * compared with to find out why.
 *
 * Derived on 2026-11-13 from a tenant whose registry reads "1" (all 26 operations "already present" in
 * `validate`), and cross-checked against two further tenants after their repairs: the definitions of both equal this data
 * once trailing whitespace is ignored, apart from the differences that were repaired on purpose (two titles
 * and one leftover mapping property). The data holds no tenant identifier, host name or secret.
 *
 * Addressing is by object name and path, never by array index of `config/managed`, because the index of an object
 * differs between tenants. The one array index in a path (`resourceCollection`, 0) is part of the feature's own
 * operation.
 *
 * A different feature version needs different data: the diagnosis refuses to compare a tenant with this reference
 * unless the version is "1".
 */

/** A JSON object whose values are not typed further. */
export type AIAgentFeatureJsonObject = { [key: string]: unknown };

/** A property the feature adds at `path` of the managed object `object` (a number in the path is an array index). */
export type AIAgentFeatureSchemaAddition = {
  object: string;
  path: (string | number)[];
  value: unknown;
};

/** A value the feature appends to the array at `path` of the managed object `object`. */
export type AIAgentFeatureOrderAddition = {
  object: string;
  path: string[];
  value: string;
};

/** A property the feature adds to the `properties` of the generic repo.ds mapping `mapping`. */
export type AIAgentFeatureGenericMappingProperty = {
  mapping: string;
  property: string;
  value: unknown;
};

/** The definitions of one version of the feature. */
export type AIAgentFeatureReference = {
  /** The feature version these definitions belong to. */
  version: string;
  /** The managed object definitions the feature appends to `config/managed`, by object name. */
  managedObjects: Record<string, AIAgentFeatureJsonObject>;
  /** The properties the feature adds to existing managed objects. */
  schemaAdditions: AIAgentFeatureSchemaAddition[];
  /** The values the feature appends to the `schema.order` of existing managed objects. */
  orderAdditions: AIAgentFeatureOrderAddition[];
  /** The explicit mappings the feature adds to `config/repo.ds`, by mapping key (`managed/<object>`). */
  explicitMappings: Record<string, AIAgentFeatureJsonObject>;
  /** The properties the feature adds to generic mappings of `config/repo.ds`. */
  genericMappingProperties: AIAgentFeatureGenericMappingProperty[];
};

/** The realms the feature is installed for. */
export const AI_AGENT_FEATURE_REALMS = ['alpha', 'bravo'];

/** The id of the feature in the IDM feature registry. */
export const AI_AGENT_FEATURE_ID = 'aiagent';

/** The version of the feature the reference below describes. */
export const AI_AGENT_FEATURE_REFERENCE_VERSION = '1';

export const AI_AGENT_FEATURE_REFERENCE: AIAgentFeatureReference = {
  version: '1',
  managedObjects: {
    alpha_aiagent: {
      name: 'alpha_aiagent',
      onDelete: {
        source:
          "require('ai/aiagentCleanup').deleteOrphanedPrivileges(object, resourceName, request);",
        type: 'text/javascript',
      },
      schema: {
        $schema: 'http://forgerock.org/json-schema#',
        icon: 'fa-android',
        order: [
          '_id',
          'name',
          'description',
          'oauth2ClientId',
          'owners',
          'privileges',
          'customAttributes',
        ],
        properties: {
          _id: {
            description: 'Agent ID',
            searchable: false,
            type: 'string',
            userEditable: false,
            viewable: true,
          },
          customAttributes: {
            description: 'JSON object for arbitrary attributes',
            order: [],
            properties: {},
            searchable: false,
            title: 'Custom Attributes',
            type: 'object',
            userEditable: true,
            viewable: true,
          },
          description: {
            description: 'Agent Description',
            searchable: false,
            title: 'Description',
            type: 'string',
            userEditable: true,
            viewable: true,
          },
          name: {
            description: 'Agent Name',
            searchable: false,
            title: 'Agent Name',
            type: 'string',
            userEditable: true,
            viewable: true,
          },
          oauth2ClientId: {
            description: "ID of the agent's OAuth2 client",
            returnByDefault: false,
            searchable: false,
            title: 'OAuth2 Client ID',
            type: 'string',
            userEditable: false,
            viewable: true,
          },
          owners: {
            description: 'Agent Owners',
            items: {
              id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgent:owners:items',
              notifySelf: false,
              properties: {
                _ref: {
                  description:
                    'References a relationship from a managed object',
                  type: 'string',
                },
                _refProperties: {
                  description: 'Supports metadata within the relationship',
                  properties: {
                    _id: {
                      description: '_refProperties object ID',
                      propName: '_id',
                      required: false,
                      type: 'string',
                    },
                  },
                  title: 'Agent Owners Items _refProperties',
                  type: 'object',
                },
              },
              resourceCollection: [
                {
                  label: 'User',
                  notify: false,
                  path: 'managed/alpha_user',
                  query: {
                    fields: ['userName', 'givenName', 'sn'],
                    queryFilter: 'true',
                    sortKeys: [],
                  },
                },
              ],
              reverseRelationship: false,
              title: 'Agent Owners Items',
              type: 'relationship',
              validate: true,
            },
            returnByDefault: false,
            searchable: false,
            title: 'Agent Owners',
            type: 'array',
            userEditable: false,
            viewable: true,
          },
          privileges: {
            description: 'Agent Privileges',
            items: {
              id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgent:privileges:items',
              notifySelf: false,
              properties: {
                _ref: {
                  description:
                    'References a relationship from a managed object',
                  type: 'string',
                },
                _refProperties: {
                  description: 'Supports metadata within the relationship',
                  properties: {
                    _id: {
                      description: '_refProperties object ID',
                      propName: '_id',
                      required: false,
                      type: 'string',
                    },
                  },
                  title: 'Agent Privileges Items _refProperties',
                  type: 'object',
                },
              },
              resourceCollection: [
                {
                  label: 'Agent Privilege',
                  notify: true,
                  path: 'managed/alpha_aiagentprivilege',
                  query: {
                    fields: ['_id'],
                    queryFilter: 'true',
                    sortKeys: [],
                  },
                },
              ],
              reversePropertyName: 'agent',
              reverseRelationship: true,
              title: 'Agent Privileges Items',
              type: 'relationship',
              validate: true,
            },
            returnByDefault: false,
            searchable: false,
            title: 'Privileges',
            type: 'array',
            userEditable: false,
            viewable: true,
          },
        },
        required: ['name', 'oauth2ClientId'],
        title: 'Alpha realm - AI Agent',
        type: 'object',
      },
    },
    alpha_aiagentprivilege: {
      name: 'alpha_aiagentprivilege',
      schema: {
        $schema: 'http://forgerock.org/json-schema#',
        icon: 'fa-unlock-alt',
        order: [
          '_id',
          'description',
          'agentID',
          'agentOAuth2ClientId',
          'agent',
          'resource',
          'resourceData',
          'subjects',
          'subjectGroups',
          'subjectIDs',
          'permissions',
        ],
        properties: {
          _id: {
            description: 'Agent Privilege ID',
            searchable: false,
            type: 'string',
            userEditable: false,
            viewable: true,
          },
          agent: {
            description: 'Agent',
            id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgentPrivilege:agent',
            notifySelf: true,
            properties: {
              _ref: {
                description: 'References a relationship from a managed object',
                type: 'string',
              },
              _refProperties: {
                description: 'Supports metadata within the relationship',
                properties: {
                  _id: {
                    description: '_refProperties object ID',
                    propName: '_id',
                    required: false,
                    type: 'string',
                  },
                },
                title: 'Agent Privilege Agent _refProperties',
                type: 'object',
              },
            },
            resourceCollection: [
              {
                label: 'Agent',
                notify: false,
                path: 'managed/alpha_aiagent',
                query: {
                  fields: ['_id'],
                  queryFilter: 'true',
                  sortKeys: [],
                },
              },
            ],
            returnByDefault: false,
            reversePropertyName: 'privileges',
            reverseRelationship: true,
            searchable: false,
            title: 'Agent',
            type: 'relationship',
            userEditable: false,
            validate: true,
            viewable: true,
          },
          agentID: {
            description: 'ID of the associated AI Agent',
            isVirtual: true,
            queryConfig: {
              flattenProperties: true,
              referencedObjectFields: ['_id'],
              referencedRelationshipFields: ['agent'],
            },
            returnByDefault: true,
            searchable: true,
            title: 'Agent ID',
            type: 'string',
            userEditable: false,
            viewable: true,
          },
          agentOAuth2ClientId: {
            description: 'OAuth2 Client ID of the associated AI Agent',
            isVirtual: true,
            queryConfig: {
              flattenProperties: true,
              referencedObjectFields: ['oauth2ClientId'],
              referencedRelationshipFields: ['agent'],
            },
            returnByDefault: true,
            searchable: true,
            title: 'Agent OAuth2 Client ID',
            type: 'string',
            userEditable: false,
            viewable: true,
          },
          description: {
            description: 'Privilege Description',
            searchable: false,
            title: 'Description',
            type: 'string',
            userEditable: true,
            viewable: true,
          },
          permissions: {
            description: 'Permission grants for this privilege',
            items: {
              order: ['type', 'values'],
              properties: {
                type: {
                  description: 'Type of permission',
                  searchable: false,
                  title: 'Permission Type',
                  type: 'string',
                  userEditable: true,
                  viewable: true,
                },
                values: {
                  description: 'Permission values',
                  items: {
                    type: 'string',
                  },
                  searchable: false,
                  title: 'Values',
                  type: 'array',
                  userEditable: true,
                  viewable: true,
                },
              },
              required: ['type', 'values'],
              title: 'Permission',
              type: 'object',
            },
            searchable: false,
            title: 'Permissions',
            type: 'array',
            userEditable: true,
            viewable: true,
          },
          resource: {
            description: 'The resource this privilege applies to',
            id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgentPrivilege:resource',
            notifySelf: true,
            properties: {
              _ref: {
                description: 'References a relationship from a managed object',
                type: 'string',
              },
              _refProperties: {
                description: 'Supports metadata within the relationship',
                properties: {
                  _id: {
                    description: '_refProperties object ID',
                    propName: '_id',
                    required: false,
                    type: 'string',
                  },
                },
                title: 'Agent Privilege Resource _refProperties',
                type: 'object',
              },
            },
            resourceCollection: [
              {
                label: 'Application',
                notify: true,
                path: 'managed/alpha_application',
                query: {
                  fields: ['name'],
                  queryFilter: 'true',
                  sortKeys: [],
                },
              },
            ],
            returnByDefault: false,
            reversePropertyName: 'aiagentprivileges',
            reverseRelationship: true,
            searchable: false,
            title: 'Resource',
            type: 'relationship',
            userEditable: false,
            validate: true,
            viewable: true,
          },
          resourceData: {
            description:
              'Resource identifiers for querying privileges by application',
            isVirtual: true,
            queryConfig: {
              referencedObjectFields: ['_id', 'ssoEntities'],
              referencedRelationshipFields: ['resource'],
            },
            returnByDefault: true,
            searchable: true,
            title: 'Resource Data',
            type: 'object',
            userEditable: false,
            viewable: true,
          },
          subjectGroups: {
            description:
              'Group of subjects participating in this privilege, on whose behalf the agent can operate',
            items: {
              id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgentPrivilege:subjectGroups:items',
              notifySelf: true,
              properties: {
                _ref: {
                  description:
                    'References a relationship from a managed object',
                  type: 'string',
                },
                _refProperties: {
                  description: 'Supports metadata within the relationship',
                  properties: {
                    _id: {
                      description: '_refProperties object ID',
                      propName: '_id',
                      required: false,
                      type: 'string',
                    },
                  },
                  title: 'Agent Privilege Subject Groups Items _refProperties',
                  type: 'object',
                },
              },
              resourceCollection: [
                {
                  label: 'Group',
                  notify: false,
                  path: 'managed/alpha_group',
                  query: {
                    fields: ['name'],
                    queryFilter: 'true',
                    sortKeys: [],
                  },
                },
              ],
              reversePropertyName: 'aiagentprivileges',
              reverseRelationship: true,
              title: 'Agent Privilege Subject Groups Items',
              type: 'relationship',
              validate: true,
            },
            returnByDefault: false,
            searchable: false,
            title: 'Subject Groups',
            type: 'array',
            userEditable: false,
            viewable: true,
          },
          subjectIDs: {
            description: 'IDs of the subjects',
            isVirtual: true,
            items: {
              type: 'string',
            },
            queryConfig: {
              flattenProperties: true,
              referencedObjectFields: ['_id'],
              referencedRelationshipFields: [
                ['subjectGroups', 'members'],
                ['subjects'],
              ],
            },
            returnByDefault: true,
            searchable: true,
            title: 'Subject IDs',
            type: 'array',
            userEditable: false,
            viewable: true,
          },
          subjects: {
            description:
              'The subjects participating in this privilege, on whose behalf the agent can operate',
            items: {
              id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgentPrivilege:subjects:items',
              notifySelf: true,
              properties: {
                _ref: {
                  description:
                    'References a relationship from a managed object',
                  type: 'string',
                },
                _refProperties: {
                  description: 'Supports metadata within the relationship',
                  properties: {
                    _id: {
                      description: '_refProperties object ID',
                      propName: '_id',
                      required: false,
                      type: 'string',
                    },
                  },
                  title: 'Agent Privilege Subjects Items _refProperties',
                  type: 'object',
                },
              },
              resourceCollection: [
                {
                  label: 'User',
                  notify: false,
                  path: 'managed/alpha_user',
                  query: {
                    fields: ['userName'],
                    queryFilter: 'true',
                    sortKeys: [],
                  },
                },
              ],
              reverseRelationship: false,
              title: 'Agent Privilege Subjects Items',
              type: 'relationship',
              validate: true,
            },
            returnByDefault: false,
            searchable: false,
            title: 'Subjects',
            type: 'array',
            userEditable: false,
            viewable: true,
          },
        },
        required: ['agent'],
        title: 'Alpha realm - AI Agent Privilege',
        type: 'object',
      },
    },
    bravo_aiagent: {
      name: 'bravo_aiagent',
      onDelete: {
        source:
          "require('ai/aiagentCleanup').deleteOrphanedPrivileges(object, resourceName, request);",
        type: 'text/javascript',
      },
      schema: {
        $schema: 'http://forgerock.org/json-schema#',
        icon: 'fa-android',
        order: [
          '_id',
          'name',
          'description',
          'oauth2ClientId',
          'owners',
          'privileges',
          'customAttributes',
        ],
        properties: {
          _id: {
            description: 'Agent ID',
            searchable: false,
            type: 'string',
            userEditable: false,
            viewable: true,
          },
          customAttributes: {
            description: 'JSON object for arbitrary attributes',
            order: [],
            properties: {},
            searchable: false,
            title: 'Custom Attributes',
            type: 'object',
            userEditable: true,
            viewable: true,
          },
          description: {
            description: 'Agent Description',
            searchable: false,
            title: 'Description',
            type: 'string',
            userEditable: true,
            viewable: true,
          },
          name: {
            description: 'Agent Name',
            searchable: false,
            title: 'Agent Name',
            type: 'string',
            userEditable: true,
            viewable: true,
          },
          oauth2ClientId: {
            description: "ID of the agent's OAuth2 client",
            returnByDefault: false,
            searchable: false,
            title: 'OAuth2 Client ID',
            type: 'string',
            userEditable: false,
            viewable: true,
          },
          owners: {
            description: 'Agent Owners',
            items: {
              id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgent:owners:items',
              notifySelf: false,
              properties: {
                _ref: {
                  description:
                    'References a relationship from a managed object',
                  type: 'string',
                },
                _refProperties: {
                  description: 'Supports metadata within the relationship',
                  properties: {
                    _id: {
                      description: '_refProperties object ID',
                      propName: '_id',
                      required: false,
                      type: 'string',
                    },
                  },
                  title: 'Agent Owners Items _refProperties',
                  type: 'object',
                },
              },
              resourceCollection: [
                {
                  label: 'User',
                  notify: false,
                  path: 'managed/bravo_user',
                  query: {
                    fields: ['userName', 'givenName', 'sn'],
                    queryFilter: 'true',
                    sortKeys: [],
                  },
                },
              ],
              reverseRelationship: false,
              title: 'Agent Owners Items',
              type: 'relationship',
              validate: true,
            },
            returnByDefault: false,
            searchable: false,
            title: 'Agent Owners',
            type: 'array',
            userEditable: false,
            viewable: true,
          },
          privileges: {
            description: 'Agent Privileges',
            items: {
              id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgent:privileges:items',
              notifySelf: false,
              properties: {
                _ref: {
                  description:
                    'References a relationship from a managed object',
                  type: 'string',
                },
                _refProperties: {
                  description: 'Supports metadata within the relationship',
                  properties: {
                    _id: {
                      description: '_refProperties object ID',
                      propName: '_id',
                      required: false,
                      type: 'string',
                    },
                  },
                  title: 'Agent Privileges Items _refProperties',
                  type: 'object',
                },
              },
              resourceCollection: [
                {
                  label: 'Agent Privilege',
                  notify: true,
                  path: 'managed/bravo_aiagentprivilege',
                  query: {
                    fields: ['_id'],
                    queryFilter: 'true',
                    sortKeys: [],
                  },
                },
              ],
              reversePropertyName: 'agent',
              reverseRelationship: true,
              title: 'Agent Privileges Items',
              type: 'relationship',
              validate: true,
            },
            returnByDefault: false,
            searchable: false,
            title: 'Privileges',
            type: 'array',
            userEditable: false,
            viewable: true,
          },
        },
        required: ['name', 'oauth2ClientId'],
        title: 'Bravo realm - AI Agent',
        type: 'object',
      },
    },
    bravo_aiagentprivilege: {
      name: 'bravo_aiagentprivilege',
      schema: {
        $schema: 'http://forgerock.org/json-schema#',
        icon: 'fa-unlock-alt',
        order: [
          '_id',
          'description',
          'agentID',
          'agentOAuth2ClientId',
          'agent',
          'resource',
          'resourceData',
          'subjects',
          'subjectGroups',
          'subjectIDs',
          'permissions',
        ],
        properties: {
          _id: {
            description: 'Agent Privilege ID',
            searchable: false,
            type: 'string',
            userEditable: false,
            viewable: true,
          },
          agent: {
            description: 'Agent',
            id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgentPrivilege:agent',
            notifySelf: true,
            properties: {
              _ref: {
                description: 'References a relationship from a managed object',
                type: 'string',
              },
              _refProperties: {
                description: 'Supports metadata within the relationship',
                properties: {
                  _id: {
                    description: '_refProperties object ID',
                    propName: '_id',
                    required: false,
                    type: 'string',
                  },
                },
                title: 'Agent Privilege Agent _refProperties',
                type: 'object',
              },
            },
            resourceCollection: [
              {
                label: 'Agent',
                notify: false,
                path: 'managed/bravo_aiagent',
                query: {
                  fields: ['_id'],
                  queryFilter: 'true',
                  sortKeys: [],
                },
              },
            ],
            returnByDefault: false,
            reversePropertyName: 'privileges',
            reverseRelationship: true,
            searchable: false,
            title: 'Agent',
            type: 'relationship',
            userEditable: false,
            validate: true,
            viewable: true,
          },
          agentID: {
            description: 'ID of the associated AI Agent',
            isVirtual: true,
            queryConfig: {
              flattenProperties: true,
              referencedObjectFields: ['_id'],
              referencedRelationshipFields: ['agent'],
            },
            returnByDefault: true,
            searchable: true,
            title: 'Agent ID',
            type: 'string',
            userEditable: false,
            viewable: true,
          },
          agentOAuth2ClientId: {
            description: 'OAuth2 Client ID of the associated AI Agent',
            isVirtual: true,
            queryConfig: {
              flattenProperties: true,
              referencedObjectFields: ['oauth2ClientId'],
              referencedRelationshipFields: ['agent'],
            },
            returnByDefault: true,
            searchable: true,
            title: 'Agent OAuth2 Client ID',
            type: 'string',
            userEditable: false,
            viewable: true,
          },
          description: {
            description: 'Privilege Description',
            searchable: false,
            title: 'Description',
            type: 'string',
            userEditable: true,
            viewable: true,
          },
          permissions: {
            description: 'Permission grants for this privilege',
            items: {
              order: ['type', 'values'],
              properties: {
                type: {
                  description: 'Type of permission',
                  searchable: false,
                  title: 'Permission Type',
                  type: 'string',
                  userEditable: true,
                  viewable: true,
                },
                values: {
                  description: 'Permission values',
                  items: {
                    type: 'string',
                  },
                  searchable: false,
                  title: 'Values',
                  type: 'array',
                  userEditable: true,
                  viewable: true,
                },
              },
              required: ['type', 'values'],
              title: 'Permission',
              type: 'object',
            },
            searchable: false,
            title: 'Permissions',
            type: 'array',
            userEditable: true,
            viewable: true,
          },
          resource: {
            description: 'The resource this privilege applies to',
            id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgentPrivilege:resource',
            notifySelf: true,
            properties: {
              _ref: {
                description: 'References a relationship from a managed object',
                type: 'string',
              },
              _refProperties: {
                description: 'Supports metadata within the relationship',
                properties: {
                  _id: {
                    description: '_refProperties object ID',
                    propName: '_id',
                    required: false,
                    type: 'string',
                  },
                },
                title: 'Agent Privilege Resource _refProperties',
                type: 'object',
              },
            },
            resourceCollection: [
              {
                label: 'Application',
                notify: true,
                path: 'managed/bravo_application',
                query: {
                  fields: ['name'],
                  queryFilter: 'true',
                  sortKeys: [],
                },
              },
            ],
            returnByDefault: false,
            reversePropertyName: 'aiagentprivileges',
            reverseRelationship: true,
            searchable: false,
            title: 'Resource',
            type: 'relationship',
            userEditable: false,
            validate: true,
            viewable: true,
          },
          resourceData: {
            description:
              'Resource identifiers for querying privileges by application',
            isVirtual: true,
            queryConfig: {
              referencedObjectFields: ['_id', 'ssoEntities'],
              referencedRelationshipFields: ['resource'],
            },
            returnByDefault: true,
            searchable: true,
            title: 'Resource Data',
            type: 'object',
            userEditable: false,
            viewable: true,
          },
          subjectGroups: {
            description:
              'Group of subjects participating in this privilege, on whose behalf the agent can operate',
            items: {
              id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgentPrivilege:subjectGroups:items',
              notifySelf: true,
              properties: {
                _ref: {
                  description:
                    'References a relationship from a managed object',
                  type: 'string',
                },
                _refProperties: {
                  description: 'Supports metadata within the relationship',
                  properties: {
                    _id: {
                      description: '_refProperties object ID',
                      propName: '_id',
                      required: false,
                      type: 'string',
                    },
                  },
                  title: 'Agent Privilege Subject Groups Items _refProperties',
                  type: 'object',
                },
              },
              resourceCollection: [
                {
                  label: 'Group',
                  notify: false,
                  path: 'managed/bravo_group',
                  query: {
                    fields: ['name'],
                    queryFilter: 'true',
                    sortKeys: [],
                  },
                },
              ],
              reversePropertyName: 'aiagentprivileges',
              reverseRelationship: true,
              title: 'Agent Privilege Subject Groups Items',
              type: 'relationship',
              validate: true,
            },
            returnByDefault: false,
            searchable: false,
            title: 'Subject Groups',
            type: 'array',
            userEditable: false,
            viewable: true,
          },
          subjectIDs: {
            description: 'IDs of the subjects',
            isVirtual: true,
            items: {
              type: 'string',
            },
            queryConfig: {
              flattenProperties: true,
              referencedObjectFields: ['_id'],
              referencedRelationshipFields: [
                ['subjectGroups', 'members'],
                ['subjects'],
              ],
            },
            returnByDefault: true,
            searchable: true,
            title: 'Subject IDs',
            type: 'array',
            userEditable: false,
            viewable: true,
          },
          subjects: {
            description:
              'The subjects participating in this privilege, on whose behalf the agent can operate',
            items: {
              id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgentPrivilege:subjects:items',
              notifySelf: true,
              properties: {
                _ref: {
                  description:
                    'References a relationship from a managed object',
                  type: 'string',
                },
                _refProperties: {
                  description: 'Supports metadata within the relationship',
                  properties: {
                    _id: {
                      description: '_refProperties object ID',
                      propName: '_id',
                      required: false,
                      type: 'string',
                    },
                  },
                  title: 'Agent Privilege Subjects Items _refProperties',
                  type: 'object',
                },
              },
              resourceCollection: [
                {
                  label: 'User',
                  notify: false,
                  path: 'managed/bravo_user',
                  query: {
                    fields: ['userName'],
                    queryFilter: 'true',
                    sortKeys: [],
                  },
                },
              ],
              reverseRelationship: false,
              title: 'Agent Privilege Subjects Items',
              type: 'relationship',
              validate: true,
            },
            returnByDefault: false,
            searchable: false,
            title: 'Subjects',
            type: 'array',
            userEditable: false,
            viewable: true,
          },
        },
        required: ['agent'],
        title: 'Bravo realm - AI Agent Privilege',
        type: 'object',
      },
    },
  },
  schemaAdditions: [
    {
      object: 'alpha_group',
      path: ['schema', 'properties', 'aiagentprivileges'],
      value: {
        description: 'AI Agent Privileges assigned to this group',
        items: {
          id: 'urn:jsonschema:org:forgerock:openidm:managed:api:Group:aiagentprivileges:items',
          notifySelf: false,
          properties: {
            _ref: {
              description: 'References a relationship from a managed object',
              type: 'string',
            },
            _refProperties: {
              description: 'Supports metadata within the relationship',
              properties: {
                _id: {
                  description: '_refProperties object ID',
                  type: 'string',
                },
              },
              title: 'Group Members Items _refProperties',
              type: 'object',
            },
          },
          resourceCollection: [
            {
              label: 'AI Agent Privilege',
              notify: true,
              path: 'managed/alpha_aiagentprivilege',
              query: {
                fields: ['description', 'agentID'],
                queryFilter: 'true',
              },
            },
          ],
          reversePropertyName: 'subjectGroups',
          reverseRelationship: true,
          title: 'Group Agent Privilege Items',
          type: 'relationship',
          validate: true,
        },
        policies: [],
        returnByDefault: false,
        searchable: false,
        title: 'Agent Privileges',
        type: 'array',
        userEditable: false,
        viewable: true,
      },
    },
    {
      object: 'alpha_group',
      path: ['schema', 'properties', 'members', 'notifyRelationships'],
      value: ['aiagentprivileges'],
    },
    {
      object: 'alpha_group',
      path: ['schema', 'properties', 'members', 'items', 'notifySelf'],
      value: true,
    },
    {
      object: 'alpha_application',
      path: ['schema', 'properties', 'aiagentprivileges'],
      value: {
        description: 'AI Agent Privileges targeting this application',
        items: {
          id: 'urn:jsonschema:org:forgerock:openidm:managed:api:Application:aiagentprivileges:items',
          notifySelf: false,
          properties: {
            _ref: {
              description: 'References a relationship from a managed object',
              type: 'string',
            },
            _refProperties: {
              description: 'Supports metadata within the relationship',
              properties: {
                _id: {
                  description: '_refProperties object ID',
                  type: 'string',
                },
              },
              title: 'Application AI Agent Privileges Items _refProperties',
              type: 'object',
            },
          },
          resourceCollection: [
            {
              label: 'AI Agent Privilege',
              notify: true,
              path: 'managed/alpha_aiagentprivilege',
              query: {
                fields: ['_id'],
                queryFilter: 'true',
                sortKeys: [],
              },
            },
          ],
          reversePropertyName: 'resource',
          reverseRelationship: true,
          title: 'Application AI Agent Privileges Items',
          type: 'relationship',
          validate: true,
        },
        returnByDefault: false,
        searchable: false,
        title: 'AI Agent Privileges',
        type: 'array',
        userEditable: false,
        viewable: true,
      },
    },
    {
      object: 'alpha_application',
      path: ['schema', 'properties', 'ssoEntities', 'notifyRelationships'],
      value: ['aiagentprivileges'],
    },
    {
      object: 'alpha_user',
      path: [
        'schema',
        'properties',
        'groups',
        'items',
        'resourceCollection',
        0,
        'notify',
      ],
      value: true,
    },
    {
      object: 'bravo_group',
      path: ['schema', 'properties', 'aiagentprivileges'],
      value: {
        description: 'AI Agent Privileges assigned to this group',
        items: {
          id: 'urn:jsonschema:org:forgerock:openidm:managed:api:Group:aiagentprivileges:items',
          notifySelf: false,
          properties: {
            _ref: {
              description: 'References a relationship from a managed object',
              type: 'string',
            },
            _refProperties: {
              description: 'Supports metadata within the relationship',
              properties: {
                _id: {
                  description: '_refProperties object ID',
                  type: 'string',
                },
              },
              title: 'Group Members Items _refProperties',
              type: 'object',
            },
          },
          resourceCollection: [
            {
              label: 'AI Agent Privilege',
              notify: true,
              path: 'managed/bravo_aiagentprivilege',
              query: {
                fields: ['description', 'agentID'],
                queryFilter: 'true',
              },
            },
          ],
          reversePropertyName: 'subjectGroups',
          reverseRelationship: true,
          title: 'Group Agent Privilege Items',
          type: 'relationship',
          validate: true,
        },
        policies: [],
        returnByDefault: false,
        searchable: false,
        title: 'Agent Privileges',
        type: 'array',
        userEditable: false,
        viewable: true,
      },
    },
    {
      object: 'bravo_group',
      path: ['schema', 'properties', 'members', 'notifyRelationships'],
      value: ['aiagentprivileges'],
    },
    {
      object: 'bravo_group',
      path: ['schema', 'properties', 'members', 'items', 'notifySelf'],
      value: true,
    },
    {
      object: 'bravo_application',
      path: ['schema', 'properties', 'aiagentprivileges'],
      value: {
        description: 'AI Agent Privileges targeting this application',
        items: {
          id: 'urn:jsonschema:org:forgerock:openidm:managed:api:Application:aiagentprivileges:items',
          notifySelf: false,
          properties: {
            _ref: {
              description: 'References a relationship from a managed object',
              type: 'string',
            },
            _refProperties: {
              description: 'Supports metadata within the relationship',
              properties: {
                _id: {
                  description: '_refProperties object ID',
                  type: 'string',
                },
              },
              title: 'Application AI Agent Privileges Items _refProperties',
              type: 'object',
            },
          },
          resourceCollection: [
            {
              label: 'AI Agent Privilege',
              notify: true,
              path: 'managed/bravo_aiagentprivilege',
              query: {
                fields: ['_id'],
                queryFilter: 'true',
                sortKeys: [],
              },
            },
          ],
          reversePropertyName: 'resource',
          reverseRelationship: true,
          title: 'Application AI Agent Privileges Items',
          type: 'relationship',
          validate: true,
        },
        returnByDefault: false,
        searchable: false,
        title: 'AI Agent Privileges',
        type: 'array',
        userEditable: false,
        viewable: true,
      },
    },
    {
      object: 'bravo_application',
      path: ['schema', 'properties', 'ssoEntities', 'notifyRelationships'],
      value: ['aiagentprivileges'],
    },
    {
      object: 'bravo_user',
      path: [
        'schema',
        'properties',
        'groups',
        'items',
        'resourceCollection',
        0,
        'notify',
      ],
      value: true,
    },
  ],
  orderAdditions: [
    {
      object: 'alpha_group',
      path: ['schema', 'order'],
      value: 'aiagentprivileges',
    },
    {
      object: 'bravo_group',
      path: ['schema', 'order'],
      value: 'aiagentprivileges',
    },
  ],
  explicitMappings: {
    'managed/alpha_aiagent': {
      dnTemplate: 'ou=aiagents,o=alpha,o=root,ou=identities',
      namingStrategy: {
        dnAttribute: 'fr-idm-uuid',
        type: 'clientDnNaming',
      },
      objectClasses: ['fr-idm-agent'],
      properties: {
        _id: {
          ldapAttribute: 'fr-idm-uuid',
          primaryKey: true,
          type: 'simple',
        },
        customAttributes: {
          ldapAttribute: 'fr-idm-custom-attrs',
          type: 'json',
        },
        description: {
          ldapAttribute: 'description',
          type: 'simple',
        },
        name: {
          isRequired: true,
          ldapAttribute: 'displayName',
          type: 'simple',
        },
        oauth2ClientId: {
          isRequired: true,
          ldapAttribute: 'fr-idm-oauth2-client-id',
          type: 'simple',
        },
        owners: {
          isMultiValued: true,
          ldapAttribute: 'fr-idm-owners-reference',
          primaryKey: 'uid',
          resourcePath: 'managed/alpha_user',
          type: 'reference',
        },
        privileges: {
          isMultiValued: true,
          propertyName: 'agent',
          resourcePath: 'managed/alpha_aiagentprivilege',
          type: 'reverseReference',
        },
      },
    },
    'managed/alpha_aiagentprivilege': {
      dnTemplate: 'ou=aiagentprivilege,o=alpha,o=root,ou=identities',
      namingStrategy: {
        dnAttribute: 'fr-idm-uuid',
        type: 'clientDnNaming',
      },
      objectClasses: ['fr-idm-agent-privilege'],
      properties: {
        _id: {
          ldapAttribute: 'fr-idm-uuid',
          primaryKey: true,
          type: 'simple',
        },
        agent: {
          ldapAttribute: 'fr-idm-agent-reference',
          primaryKey: 'fr-idm-uuid',
          resourcePath: 'managed/alpha_aiagent',
          type: 'reference',
        },
        agentID: {
          ldapAttribute: 'fr-idm-agent-id',
          type: 'simple',
        },
        agentOAuth2ClientId: {
          ldapAttribute: 'fr-idm-agent-oauth2-client-id',
          type: 'simple',
        },
        description: {
          ldapAttribute: 'description',
          type: 'simple',
        },
        permissions: {
          isMultiValued: true,
          ldapAttribute: 'fr-idm-permission',
          type: 'json',
        },
        resource: {
          ldapAttribute: 'fr-idm-resource-reference',
          primaryKey: 'uid',
          resourcePath: 'managed/alpha_application',
          type: 'reference',
        },
        resourceData: {
          ldapAttribute: 'fr-idm-resourcedata',
          type: 'json',
        },
        subjectGroups: {
          isMultiValued: true,
          ldapAttribute: 'fr-idm-subjectgroup-reference',
          primaryKey: 'cn',
          resourcePath: 'managed/alpha_group',
          type: 'reference',
        },
        subjectIDs: {
          isMultiValued: true,
          ldapAttribute: 'fr-idm-subject-id',
          type: 'simple',
        },
        subjects: {
          isMultiValued: true,
          ldapAttribute: 'fr-idm-subject-reference',
          primaryKey: 'uid',
          resourcePath: 'managed/alpha_user',
          type: 'reference',
        },
      },
    },
    'managed/bravo_aiagent': {
      dnTemplate: 'ou=aiagents,o=bravo,o=root,ou=identities',
      namingStrategy: {
        dnAttribute: 'fr-idm-uuid',
        type: 'clientDnNaming',
      },
      objectClasses: ['fr-idm-agent'],
      properties: {
        _id: {
          ldapAttribute: 'fr-idm-uuid',
          primaryKey: true,
          type: 'simple',
        },
        customAttributes: {
          ldapAttribute: 'fr-idm-custom-attrs',
          type: 'json',
        },
        description: {
          ldapAttribute: 'description',
          type: 'simple',
        },
        name: {
          isRequired: true,
          ldapAttribute: 'displayName',
          type: 'simple',
        },
        oauth2ClientId: {
          isRequired: true,
          ldapAttribute: 'fr-idm-oauth2-client-id',
          type: 'simple',
        },
        owners: {
          isMultiValued: true,
          ldapAttribute: 'fr-idm-owners-reference',
          primaryKey: 'uid',
          resourcePath: 'managed/bravo_user',
          type: 'reference',
        },
        privileges: {
          isMultiValued: true,
          propertyName: 'agent',
          resourcePath: 'managed/bravo_aiagentprivilege',
          type: 'reverseReference',
        },
      },
    },
    'managed/bravo_aiagentprivilege': {
      dnTemplate: 'ou=aiagentprivilege,o=bravo,o=root,ou=identities',
      namingStrategy: {
        dnAttribute: 'fr-idm-uuid',
        type: 'clientDnNaming',
      },
      objectClasses: ['fr-idm-agent-privilege'],
      properties: {
        _id: {
          ldapAttribute: 'fr-idm-uuid',
          primaryKey: true,
          type: 'simple',
        },
        agent: {
          ldapAttribute: 'fr-idm-agent-reference',
          primaryKey: 'fr-idm-uuid',
          resourcePath: 'managed/bravo_aiagent',
          type: 'reference',
        },
        agentID: {
          ldapAttribute: 'fr-idm-agent-id',
          type: 'simple',
        },
        agentOAuth2ClientId: {
          ldapAttribute: 'fr-idm-agent-oauth2-client-id',
          type: 'simple',
        },
        description: {
          ldapAttribute: 'description',
          type: 'simple',
        },
        permissions: {
          isMultiValued: true,
          ldapAttribute: 'fr-idm-permission',
          type: 'json',
        },
        resource: {
          ldapAttribute: 'fr-idm-resource-reference',
          primaryKey: 'uid',
          resourcePath: 'managed/bravo_application',
          type: 'reference',
        },
        resourceData: {
          ldapAttribute: 'fr-idm-resourcedata',
          type: 'json',
        },
        subjectGroups: {
          isMultiValued: true,
          ldapAttribute: 'fr-idm-subjectgroup-reference',
          primaryKey: 'cn',
          resourcePath: 'managed/bravo_group',
          type: 'reference',
        },
        subjectIDs: {
          isMultiValued: true,
          ldapAttribute: 'fr-idm-subject-id',
          type: 'simple',
        },
        subjects: {
          isMultiValued: true,
          ldapAttribute: 'fr-idm-subject-reference',
          primaryKey: 'uid',
          resourcePath: 'managed/bravo_user',
          type: 'reference',
        },
      },
    },
  },
  genericMappingProperties: [
    {
      mapping: 'managed/alpha_group',
      property: 'aiagentprivileges',
      value: {
        isMultiValued: true,
        propertyName: 'subjectGroups',
        resourcePath: 'managed/alpha_aiagentprivilege',
        type: 'reverseReference',
      },
    },
    {
      mapping: 'managed/alpha_application',
      property: 'aiagentprivileges',
      value: {
        isMultiValued: true,
        propertyName: 'resource',
        resourcePath: 'managed/alpha_aiagentprivilege',
        type: 'reverseReference',
      },
    },
    {
      mapping: 'managed/bravo_group',
      property: 'aiagentprivileges',
      value: {
        isMultiValued: true,
        propertyName: 'subjectGroups',
        resourcePath: 'managed/bravo_aiagentprivilege',
        type: 'reverseReference',
      },
    },
    {
      mapping: 'managed/bravo_application',
      property: 'aiagentprivileges',
      value: {
        isMultiValued: true,
        propertyName: 'resource',
        resourcePath: 'managed/bravo_aiagentprivilege',
        type: 'reverseReference',
      },
    },
  ],
};
