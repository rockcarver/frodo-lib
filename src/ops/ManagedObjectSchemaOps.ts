import { type IdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  deleteManagedObjectSchemaProperty as _deleteManagedObjectSchemaProperty,
  getManagedObjectSchema as _getManagedObjectSchema,
  getManagedObjectSchemaProperty as _getManagedObjectSchemaProperty,
  type ManagedObjectSchema,
  type ManagedObjectSchemaProperty,
  putManagedObjectSchemaProperty as _putManagedObjectSchemaProperty,
} from '../api/ManagedObjectApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { titleCase } from '../utils/ExportImportUtils';
import { cloneDeep } from '../utils/JsonUtils';
import { FrodoError, isNotFoundError } from './FrodoError';
import {
  importSubConfigEntity,
  readConfigEntity,
  readSubConfigEntity,
  removeSubConfigEntity,
} from './IdmConfigOps';

/**
 * A managed-object type's **schema** is its resolved property/relationship
 * definitions, readable in full via `readManagedObjectSchema` below — a
 * read-only projection of the same underlying configuration
 * `IdmConfigOps.ts`'s `readSubConfigEntity('managed', type)` /
 * `importSubConfigEntity('managed', ...)` read and write as a whole
 * document. See `ManagedObjectOps.ts`'s own header comment for how schema
 * relates to managed-object *records* and *configuration*, the other two
 * things this domain covers.
 *
 * Neither path is available on classic (AM-only) deployments at all — there
 * is no IDM instance there, so neither the dedicated v2 API nor the generic
 * config path below has anything to talk to. Both require a deployment that
 * actually runs IDM (Cloud or ForgeOps); see
 * {@link assertIdmDeploymentForSchemaPropertyApi}.
 *
 * There are two ways to *mutate* a type's schema on a deployment that does
 * run IDM, and they are not interchangeable:
 * 1. `readManagedObjectSchemaProperty` / `updateManagedObjectSchemaProperty` /
 *    `removeManagedObjectSchemaProperty` below use IDM's dedicated v2 schema
 *    API, which is specifically for **relationship-property definitions**,
 *    one at a time, in place, with no whole-blob read-modify-write. This is
 *    a standard IDM REST API, introduced in **IDM 7.5.0** (confirmed
 *    directly in IDM 7.5.0's own "New features" release notes, which link
 *    to this same endpoint) and present unchanged through IDM 8.1 — not
 *    Cloud-only, contrary to an earlier version of this comment, which
 *    wrongly assumed the API was Cloud-specific. Confirmed by directly
 *    comparing Ping's self-hosted PingIDM REST API reference (7.5 and 8.1)
 *    against the PingOne Advanced Identity Cloud REST API reference:
 *    identical endpoint (`/openidm/schema/managed/{type}/
 *    properties/{propertyName}`), identical `Accept-API-Version: resource=2.0`
 *    header, identical field shape (including `reverseProperty`), and no
 *    deployment restriction stated on either side. So this path specifically
 *    requires IDM 7.5+ (Cloud always qualifies; a ForgeOps deployment on an
 *    older IDM version would not, though Frodo has no way to detect that and
 *    doesn't attempt to — the deployment-type gate alone can't distinguish
 *    IDM versions within ForgeOps). See
 *    [rockcarver/frodo-lib#388](https://github.com/rockcarver/frodo-lib/issues/388)
 *    for the original feature request (which itself doesn't claim Cloud-only
 *    either).
 * 2. For every other case — any non-relationship property, relationship
 *    properties on an IDM version that predates 7.5, and whole-type schema
 *    changes — use `IdmConfigOps.ts`'s `readSubConfigEntity('managed', type)`
 *    / `importSubConfigEntity('managed', ...)` to read-modify-write the
 *    entire type definition (edit `.schema.properties` on the object you
 *    read before writing it back). This is the general-purpose path,
 *    available on any IDM version; #1 above is an optimization for one
 *    particular case on a sufficiently recent one, not the default.
 *
 * Neither path touches the underlying repository's index/persistence-layer
 * definitions (e.g. DS's `repo.ds` on ForgeOps) — Frodo has no support for
 * reading or writing `repo.ds` today, so adding a genuinely new custom
 * relationship property on ForgeOps still requires a manual, Frodo-unassisted
 * edit to that file outside either API above.
 */
export type ManagedObjectSchemaOps = {
  /**
   * Read managed object schema
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {boolean} refreshCache whether to refresh the schema cache for the specified type
   * @param {ManagedObjectSchemaOptions} options options to filter the returned schema
   * @returns {Promise<ManagedObjectSchema>} a promise that resolves to a managed object schema
   */
  readManagedObjectSchema(
    type: string,
    refreshCache?: boolean,
    options?: ManagedObjectSchemaOptions
  ): Promise<ManagedObjectSchema>;
  /**
   * Read a single managed object relationship-property definition. Requires
   * IDM 7.5+ (Cloud always qualifies) — uses IDM's dedicated v2
   * relationship-schema API to read one relationship-property definition
   * without fetching the type's entire schema. For any non-relationship
   * property, or on an IDM version that predates 7.5, use
   * readSubConfigEntity('managed', type) and read the property off the
   * returned schema.properties instead. Neither path is reachable on
   * classic (AM-only, no IDM at all).
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} propertyName schema property name, e.g. custom_merchantId
   * @returns {Promise<ManagedObjectSchemaProperty>} a promise that resolves to the property definition
   */
  readManagedObjectSchemaProperty(
    type: string,
    propertyName: string
  ): Promise<ManagedObjectSchemaProperty>;
  /**
   * Create or update a single managed object relationship-property
   * definition, leaving the rest of the type's schema untouched. Requires
   * IDM 7.5+ — see {@link readManagedObjectSchemaProperty}. For any
   * non-relationship property, or on an IDM version that predates 7.5, use
   * importSubConfigEntity('managed', ...) with the full updated type
   * definition instead. Neither path is reachable on classic.
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} propertyName schema property name, e.g. custom_merchantId
   * @param {ManagedObjectSchemaProperty} propertyData the property definition to write
   * @returns {Promise<ManagedObjectSchemaProperty>} a promise that resolves to the written property definition
   */
  updateManagedObjectSchemaProperty(
    type: string,
    propertyName: string,
    propertyData: ManagedObjectSchemaProperty
  ): Promise<ManagedObjectSchemaProperty>;
  /**
   * Remove a single managed object relationship-property definition, leaving
   * the rest of the type's schema untouched. Requires IDM 7.5+ — see
   * {@link readManagedObjectSchemaProperty}.
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} propertyName schema property name, e.g. custom_merchantId
   * @returns {Promise<ManagedObjectSchemaProperty>} a promise that resolves to the removed property definition
   */
  removeManagedObjectSchemaProperty(
    type: string,
    propertyName: string
  ): Promise<ManagedObjectSchemaProperty>;
  /**
   * Create a flat (non-relationship) schema property on a managed object
   * type -- or, with `subProperty`, nested inside an existing `type: object`
   * property, as a dot-path relative to `propertyName`. Available on any
   * deployment that runs IDM (Cloud and ForgeOps) -- unlike
   * {@link updateManagedObjectSchemaProperty}, this goes through the generic
   * `readSubConfigEntity`/`importSubConfigEntity` whole-type path, not the
   * dedicated (relationship-only) v2 schema API, so it has no IDM 7.5+
   * requirement. Refuses (throws `FrodoError`) if the property already
   * exists at that path -- use
   * {@link ManagedObjectSchemaOps.updateManagedObjectSchemaFlatProperty}
   * instead.
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} propertyName schema property name, e.g. custom_merchantId
   * @param {ManagedObjectSchemaPropertyFields} fields the property's field values
   * @param {string} [subProperty] dot-path to nest the new property under an existing object property beneath propertyName, e.g. "address.street"
   * @returns {Promise<Record<string, unknown>>} a promise that resolves to the written property definition
   */
  createManagedObjectSchemaFlatProperty(
    type: string,
    propertyName: string,
    fields: ManagedObjectSchemaPropertyFields,
    subProperty?: string
  ): Promise<Record<string, unknown>>;
  /**
   * Update an existing flat (non-relationship) schema property on a managed
   * object type -- or, with `subProperty`, a nested property reached via
   * that dot-path. Only the fields present in `changedFields` change;
   * everything else keeps its current value. See
   * {@link ManagedObjectSchemaOps.createManagedObjectSchemaFlatProperty} for
   * the deployment/API-path notes. Refuses (throws `FrodoError`) if the
   * property doesn't exist at that path -- use
   * {@link ManagedObjectSchemaOps.createManagedObjectSchemaFlatProperty}
   * instead.
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} propertyName schema property name, e.g. custom_merchantId
   * @param {Partial<ManagedObjectSchemaPropertyFields>} changedFields only the field overrides to apply
   * @param {string} [subProperty] dot-path to a nested property beneath propertyName, e.g. "address.street"
   * @returns {Promise<{ current: Record<string, unknown>; propertyData: Record<string, unknown> }>} a promise that resolves to the property's prior and newly-written definitions
   */
  updateManagedObjectSchemaFlatProperty(
    type: string,
    propertyName: string,
    changedFields: Partial<ManagedObjectSchemaPropertyFields>,
    subProperty?: string
  ): Promise<{
    current: Record<string, unknown>;
    propertyData: Record<string, unknown>;
  }>;
  /**
   * Remove a flat (non-relationship) schema property from a managed object
   * type -- or, with `subProperty`, a nested property reached via that
   * dot-path. See
   * {@link ManagedObjectSchemaOps.createManagedObjectSchemaFlatProperty} for
   * the deployment/API-path notes. Refuses (throws `FrodoError`) if the
   * property doesn't exist at that path.
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} propertyName schema property name, e.g. custom_merchantId
   * @param {string} [subProperty] dot-path to a nested property beneath propertyName, e.g. "address.street"
   * @returns {Promise<Record<string, unknown>>} a promise that resolves to the removed property definition
   */
  removeManagedObjectSchemaFlatProperty(
    type: string,
    propertyName: string,
    subProperty?: string
  ): Promise<Record<string, unknown>>;
  /**
   * Create a new managed object type. Refuses (throws `FrodoError`) if a
   * type with that name already exists -- use
   * {@link ManagedObjectSchemaOps.updateManagedObjectType} instead. Seeds a
   * minimal schema (just the `_id` property, a populated `order` array, and
   * a default icon if `fields.icon` isn't given); custom properties/
   * relationships are added afterward via the flat-property/relationship-
   * property paths, which already keep `order`/`required` in sync as they
   * go.
   * @param {string} type managed object type, e.g. alpha_widget
   * @param {ManagedObjectTypeFields} fields the new type's field values (title required)
   * @returns {Promise<Record<string, unknown>>} a promise that resolves to the written type schema
   */
  createManagedObjectType(
    type: string,
    fields: ManagedObjectTypeFields
  ): Promise<Record<string, unknown>>;
  /**
   * Update an existing managed object type's own metadata (title/icon/
   * description). Only the fields present in `changedFields` change;
   * everything else keeps its current value. Refuses (throws `FrodoError`)
   * if the type doesn't exist -- use
   * {@link ManagedObjectSchemaOps.createManagedObjectType} instead.
   * @param {string} type managed object type, e.g. alpha_widget
   * @param {Partial<ManagedObjectTypeFields>} changedFields only the field overrides to apply
   * @returns {Promise<{ current: ManagedObjectTypeFields; proposed: ManagedObjectTypeFields }>} a promise that resolves to the type's prior and newly-written metadata
   */
  updateManagedObjectType(
    type: string,
    changedFields: Partial<ManagedObjectTypeFields>
  ): Promise<{
    current: ManagedObjectTypeFields;
    proposed: ManagedObjectTypeFields;
  }>;
  /**
   * Remove a managed object type's entire definition (schema included). No
   * separate existence pre-check -- the underlying config write already
   * throws its own not-found error if the type is missing, so a second read
   * here would be a redundant round trip.
   * @param {string} type managed object type, e.g. alpha_widget
   * @returns {Promise<void>} a promise that resolves when the type has been removed
   */
  removeManagedObjectType(type: string): Promise<void>;
  /**
   * Create a new relationship schema property, via IDM's dedicated v2
   * schema API (requires IDM 7.5+; Cloud always qualifies). Refuses
   * (throws `FrodoError`) if a property with that name already exists --
   * use {@link ManagedObjectSchemaOps.updateManagedObjectSchemaRelationshipProperty}
   * instead. When `reverse` is given, the reverse side on
   * `fields.targetObject` is auto-created by the server in the same write.
   * @param {string} type managed object type, e.g. alpha_aiagentprivilege
   * @param {string} propertyName relationship property name, e.g. agent
   * @param {ManagedObjectSchemaRelationshipPropertyFields} fields the forward side's field values
   * @param {ManagedObjectSchemaRelationshipReverseFields} [reverse] the reverse side's field values, if creating both sides
   * @returns {Promise<Record<string, unknown>>} a promise that resolves to the written forward-side definition
   */
  createManagedObjectSchemaRelationshipProperty(
    type: string,
    propertyName: string,
    fields: ManagedObjectSchemaRelationshipPropertyFields,
    reverse?: ManagedObjectSchemaRelationshipReverseFields
  ): Promise<Record<string, unknown>>;
  /**
   * Update an existing relationship schema property, via IDM's dedicated
   * v2 schema API. Refuses (throws `FrodoError`) if the property doesn't
   * exist -- use
   * {@link ManagedObjectSchemaOps.createManagedObjectSchemaRelationshipProperty}
   * instead. Only the fields present in `changedFields` change; everything
   * else keeps its current value. A configured reverse side's descriptor is
   * always re-supplied (required by the v2 API on every write of a
   * bidirectional property), regardless of `withReverse`; `withReverse`
   * additionally applies `changedFields`' overrides to the reverse side
   * itself and writes it as a second, separate call -- if that second call
   * fails after the forward write already succeeded, the thrown error says
   * so explicitly; there is no automatic rollback.
   * @param {string} type managed object type, e.g. alpha_aiagentprivilege
   * @param {string} propertyName relationship property name, e.g. agent
   * @param {Partial<ManagedObjectSchemaRelationshipPropertyFields>} changedFields only the field overrides to apply
   * @param {boolean} [withReverse] true to also update the inferred reverse side
   * @returns {Promise<{ forward: Record<string, unknown>; reverse?: { type: string; propertyName: string; propertyData: Record<string, unknown> } }>} a promise that resolves to the written definition(s)
   */
  updateManagedObjectSchemaRelationshipProperty(
    type: string,
    propertyName: string,
    changedFields: Partial<ManagedObjectSchemaRelationshipPropertyFields>,
    withReverse?: boolean
  ): Promise<{
    forward: Record<string, unknown>;
    reverse?: {
      type: string;
      propertyName: string;
      propertyData: Record<string, unknown>;
    };
  }>;
  /**
   * Remove a relationship schema property, via IDM's dedicated v2 schema
   * API. `withReverse` infers the reverse side from the forward property's
   * own current definition and deletes it first, then the forward side.
   * Deleting the reverse side of a bidirectionally-auto-created pair
   * cascades and removes the forward side too, confirmed live -- a 404 on
   * the forward-side delete immediately after a `withReverse` reverse-side
   * delete means the desired end state (both sides gone) was already
   * reached, and is treated as success, not surfaced as an error.
   * @param {string} type managed object type, e.g. alpha_aiagentprivilege
   * @param {string} propertyName relationship property name, e.g. agent
   * @param {boolean} [withReverse] true to also delete the inferred reverse side
   * @returns {Promise<{ current: Record<string, unknown>; reverse?: { type: string; propertyName: string; current: Record<string, unknown> } }>} a promise that resolves to the removed definition(s)
   */
  removeManagedObjectSchemaRelationshipProperty(
    type: string,
    propertyName: string,
    withReverse?: boolean
  ): Promise<{
    current: Record<string, unknown>;
    reverse?: {
      type: string;
      propertyName: string;
      current: Record<string, unknown>;
    };
  }>;
  /**
   * Read a single relationship schema property, returning `null` (rather
   * than throwing) if it doesn't exist. A confirmed 404 from the dedicated
   * v2 API reliably means the property itself doesn't exist; any other
   * failure propagates rather than being silently treated as "not found".
   * @param {string} type managed object type, e.g. alpha_aiagentprivilege
   * @param {string} propertyName relationship property name, e.g. agent
   * @returns {Promise<Record<string, unknown> | null>} a promise that resolves to the property definition, or null if not found
   */
  readManagedObjectSchemaRelationshipPropertyOrNull(
    type: string,
    propertyName: string
  ): Promise<Record<string, unknown> | null>;
};

export default (state: State): ManagedObjectSchemaOps => {
  return {
    async readManagedObjectSchema(
      type: string,
      refreshCache: boolean = false,
      options: ManagedObjectSchemaOptions = {}
    ): Promise<ManagedObjectSchema> {
      return readManagedObjectSchema({ type, refreshCache, options, state });
    },
    async readManagedObjectSchemaProperty(
      type: string,
      propertyName: string
    ): Promise<ManagedObjectSchemaProperty> {
      return readManagedObjectSchemaProperty({ type, propertyName, state });
    },
    async updateManagedObjectSchemaProperty(
      type: string,
      propertyName: string,
      propertyData: ManagedObjectSchemaProperty
    ): Promise<ManagedObjectSchemaProperty> {
      return updateManagedObjectSchemaProperty({
        type,
        propertyName,
        propertyData,
        state,
      });
    },
    async removeManagedObjectSchemaProperty(
      type: string,
      propertyName: string
    ): Promise<ManagedObjectSchemaProperty> {
      return removeManagedObjectSchemaProperty({ type, propertyName, state });
    },
    async createManagedObjectSchemaFlatProperty(
      type: string,
      propertyName: string,
      fields: ManagedObjectSchemaPropertyFields,
      subProperty?: string
    ): Promise<Record<string, unknown>> {
      return createManagedObjectSchemaFlatProperty({
        type,
        propertyName,
        fields,
        subProperty,
        state,
      });
    },
    async updateManagedObjectSchemaFlatProperty(
      type: string,
      propertyName: string,
      changedFields: Partial<ManagedObjectSchemaPropertyFields>,
      subProperty?: string
    ): Promise<{
      current: Record<string, unknown>;
      propertyData: Record<string, unknown>;
    }> {
      return updateManagedObjectSchemaFlatProperty({
        type,
        propertyName,
        changedFields,
        subProperty,
        state,
      });
    },
    async removeManagedObjectSchemaFlatProperty(
      type: string,
      propertyName: string,
      subProperty?: string
    ): Promise<Record<string, unknown>> {
      return removeManagedObjectSchemaFlatProperty({
        type,
        propertyName,
        subProperty,
        state,
      });
    },
    async createManagedObjectType(
      type: string,
      fields: ManagedObjectTypeFields
    ): Promise<Record<string, unknown>> {
      return createManagedObjectType({ type, fields, state });
    },
    async updateManagedObjectType(
      type: string,
      changedFields: Partial<ManagedObjectTypeFields>
    ): Promise<{
      current: ManagedObjectTypeFields;
      proposed: ManagedObjectTypeFields;
    }> {
      return updateManagedObjectType({ type, changedFields, state });
    },
    async removeManagedObjectType(type: string): Promise<void> {
      return removeManagedObjectType({ type, state });
    },
    async createManagedObjectSchemaRelationshipProperty(
      type: string,
      propertyName: string,
      fields: ManagedObjectSchemaRelationshipPropertyFields,
      reverse?: ManagedObjectSchemaRelationshipReverseFields
    ): Promise<Record<string, unknown>> {
      return createManagedObjectSchemaRelationshipProperty({
        type,
        propertyName,
        fields,
        reverse,
        state,
      });
    },
    async updateManagedObjectSchemaRelationshipProperty(
      type: string,
      propertyName: string,
      changedFields: Partial<ManagedObjectSchemaRelationshipPropertyFields>,
      withReverse: boolean = false
    ): Promise<{
      forward: Record<string, unknown>;
      reverse?: {
        type: string;
        propertyName: string;
        propertyData: Record<string, unknown>;
      };
    }> {
      return updateManagedObjectSchemaRelationshipProperty({
        type,
        propertyName,
        changedFields,
        withReverse,
        state,
      });
    },
    async removeManagedObjectSchemaRelationshipProperty(
      type: string,
      propertyName: string,
      withReverse: boolean = false
    ): Promise<{
      current: Record<string, unknown>;
      reverse?: {
        type: string;
        propertyName: string;
        current: Record<string, unknown>;
      };
    }> {
      return removeManagedObjectSchemaRelationshipProperty({
        type,
        propertyName,
        withReverse,
        state,
      });
    },
    async readManagedObjectSchemaRelationshipPropertyOrNull(
      type: string,
      propertyName: string
    ): Promise<Record<string, unknown> | null> {
      return readManagedObjectSchemaRelationshipPropertyOrNull({
        type,
        propertyName,
        state,
      });
    },
  };
};

const ManagedObjectSchemaCache: Record<string, ManagedObjectSchema> = {};

export type ManagedObjectSchemaOptions = {
  /**
   * Whether to exclude virtual properties from the returned schema.
   * Virtual properties are non-persisted properties that are calculated
   * or derived at runtime.
   * */
  excludeVirtual?: boolean;
  /**
   * Whether to exclude relationship properties from the returned schema.
   */
  excludeRelationships?: boolean;
  /**
   * If specified, only relationship properties whose resourceCollection
   * path matches any of the values in this array will be included in the
   * returned schema when excludeRelationships is true. This option is
   * ignored if excludeRelationships is false.
   */
  includeRelationshipsFilter?: string[];
};

export async function readManagedObjectSchema({
  type,
  refreshCache = false,
  options = {
    excludeVirtual: false,
    excludeRelationships: false,
    includeRelationshipsFilter: undefined,
  },
  state,
}: {
  type: string;
  refreshCache?: boolean;
  options?: ManagedObjectSchemaOptions;
  state: State;
}): Promise<ManagedObjectSchema> {
  try {
    debugMessage({
      message: `ManagedObjectSchemaOps.readManagedObjectSchema: start`,
      state,
    });
    let schema: ManagedObjectSchema;
    if (!refreshCache && ManagedObjectSchemaCache[type]) {
      debugMessage({
        message: `ManagedObjectSchemaOps.readManagedObjectSchema: Using cached schema for type "${type}"`,
        state,
      });
      schema = cloneDeep(ManagedObjectSchemaCache[type]);
    } else {
      debugMessage({
        message: `ManagedObjectSchemaOps.readManagedObjectSchema: Fetching schema for type "${type}" from API`,
        state,
      });
      schema = await _getManagedObjectSchema({ type, state });
      ManagedObjectSchemaCache[type] = cloneDeep(schema);
    }
    // Apply schema options
    if (options.excludeVirtual) {
      for (const prop in schema.properties) {
        if (schema.properties[prop]['isVirtual']) {
          debugMessage({
            message: `ManagedObjectSchemaOps.readManagedObjectSchema: Excluding virtual property "${prop}" from schema for type "${type}"`,
            state,
          });
          delete schema.properties[prop];
        }
      }
    }
    if (options.excludeRelationships) {
      for (const prop in schema.properties) {
        if (
          schema.properties[prop]['type'] === 'relationship' ||
          (schema.properties[prop]['type'] === 'array' &&
            schema.properties[prop]['items'] &&
            schema.properties[prop]['items']['type'] === 'relationship')
        ) {
          // apply relationship type filter if specified
          // sample relationship property definition:
          // agent: {
          //   description: 'Agent',
          //   id: 'urn:jsonschema:org:forgerock:openidm:managed:api:AIAgentPrivilege:agent',
          //   notifySelf: true,
          //   properties: {
          //     _ref: {
          //       description: 'References a relationship from a managed object',
          //       type: 'string'
          //     },
          //     _refProperties: {
          //       description: 'Supports metadata within the relationship',
          //       properties: {
          //         _id: {
          //           description: '_refProperties object ID',
          //           propName: '_id',
          //           required: false,
          //           type: 'string'
          //         }
          //       },
          //       title: 'Agent Privilege Agent _refProperties',
          //       type: 'object'
          //     }
          //   },
          //   resourceCollection: [
          //     {
          //       label: 'Agent',
          //       notify: false,
          //       path: 'managed/alpha_aiagent',
          //       query: { fields: [ '_id' ], queryFilter: 'true', sortKeys: [] }
          //     }
          //   ],
          //   returnByDefault: false,
          //   reversePropertyName: 'privileges',
          //   reverseRelationship: true,
          //   searchable: false,
          //   title: 'Agent',
          //   type: 'relationship',
          //   userEditable: false,
          //   validate: true,
          //   viewable: true
          // }
          const resourcePath =
            schema.properties[prop]['resourceCollection']?.[0]?.['path'];
          debugMessage({
            message: `ManagedObjectSchemaOps.readManagedObjectSchema: Found relationship property "${prop}" with resource path "${resourcePath}" in schema for type "${type}"`,
            state,
          });
          if (
            !options.includeRelationshipsFilter ||
            options.includeRelationshipsFilter.length === 0 ||
            !resourcePath ||
            !options.includeRelationshipsFilter.includes(
              resourcePath.split('/')[1]
            )
          ) {
            debugMessage({
              message: `ManagedObjectSchemaOps.readManagedObjectSchema: Excluding relationship property "${prop}" from schema for type "${type}"`,
              state,
            });
            delete schema.properties[prop];
          }
        }
      }
    }
    debugMessage({
      message: `ManagedObjectSchemaOps.readManagedObjectSchema: end`,
      state,
    });
    return schema;
  } catch (error) {
    throw new FrodoError(`Error reading managed ${type} schema`, error);
  }
}

/**
 * Throws if the current deployment is classic (AM-only, no IDM at all) —
 * the only deployment type this dedicated v2 relationship-schema API
 * genuinely can't reach, since there's no IDM instance to serve it. Note
 * this gate cannot check the IDM *version* on ForgeOps (this API needs IDM
 * 7.5+ — see the module header comment) — it only distinguishes "runs IDM
 * at all" from "doesn't."
 *
 * This was previously gated to Cloud only, on the assumption the API was
 * Cloud-specific. That assumption was wrong: directly comparing Ping's
 * self-hosted PingIDM REST API reference (confirmed present, identically
 * shaped, in both the 7.5 and 8.1 self-hosted doc snapshots -- the oldest
 * and newest publicly reachable ones; everything between has been moved to
 * an unreachable archive) against the PingOne Advanced Identity Cloud REST
 * API reference shows the identical endpoint
 * (`/openidm/schema/managed/{type}/properties/{propertyName}`), identical
 * `Accept-API-Version: resource=2.0` header, and identical field shape on
 * both sides, with no deployment restriction stated on either. It's a
 * standard IDM REST API (introduced in IDM 7.5.0, confirmed via that
 * release's own release notes), available wherever IDM itself runs (Cloud
 * and ForgeOps) -- not gated on which product family, only on whether IDM
 * is present at all. Not independently live-verified against a real
 * ForgeOps deployment (no working ForgeOps tenant credentials were
 * available at the time this was corrected) -- this reclassification rests
 * on the documentation comparison above, not a live round trip.
 *
 * This gate is specific to this relationship-schema API; it does not mean
 * generic schema property CRUD is available on classic either. Every other
 * case (any non-relationship property, or a relationship property on an
 * IDM version that predates 7.5) is handled the regular way via
 * readSubConfigEntity/importSubConfigEntity instead -- but that path also
 * requires IDM, so it's equally unreachable on classic. Classic simply has
 * no managed-object schema surface at all, through either path.
 */
function assertIdmDeploymentForSchemaPropertyApi({
  type,
  state,
}: {
  type: string;
  state: State;
}): void {
  if (state.getDeploymentType() === Constants.CLASSIC_DEPLOYMENT_TYPE_KEY) {
    throw new FrodoError(
      `The dedicated relationship-schema v2 API for managed type "${type}" requires a deployment that runs IDM (Cloud or ForgeOps, IDM 7.5+); classic deployments have no IDM instance to serve it, so there is no schema-property path available for this type at all on classic.`
    );
  }
}

/**
 * Read a single managed object relationship-property definition. Available
 * on any deployment that runs IDM (Cloud and ForgeOps) — see
 * {@link assertIdmDeploymentForSchemaPropertyApi}.
 */
export async function readManagedObjectSchemaProperty({
  type,
  propertyName,
  state,
}: {
  type: string;
  propertyName: string;
  state: State;
}): Promise<ManagedObjectSchemaProperty> {
  try {
    assertIdmDeploymentForSchemaPropertyApi({ type, state });
    return await _getManagedObjectSchemaProperty({ type, propertyName, state });
  } catch (error) {
    throw new FrodoError(
      `Error reading managed ${type} schema property ${propertyName}`,
      error
    );
  }
}

/**
 * Create or update a single managed object relationship-property
 * definition, leaving the rest of the type's schema untouched. Available
 * on any deployment that runs IDM (Cloud and ForgeOps) — see
 * {@link assertIdmDeploymentForSchemaPropertyApi}. Invalidates
 * (rather than eagerly re-fetching) the cached whole-type schema
 * readManagedObjectSchema uses, so the next read for this type picks up the
 * change without an extra round-trip here.
 * @param {boolean} wait wait for the config change to fully propagate before returning. Defaults to true — see {@link putManagedObjectSchemaProperty}.
 */
export async function updateManagedObjectSchemaProperty({
  type,
  propertyName,
  propertyData,
  wait = true,
  state,
}: {
  type: string;
  propertyName: string;
  propertyData: ManagedObjectSchemaProperty;
  wait?: boolean;
  state: State;
}): Promise<ManagedObjectSchemaProperty> {
  try {
    assertIdmDeploymentForSchemaPropertyApi({ type, state });
    const result = await _putManagedObjectSchemaProperty({
      type,
      propertyName,
      propertyData,
      wait,
      state,
    });
    delete ManagedObjectSchemaCache[type];
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error updating managed ${type} schema property ${propertyName}`,
      error
    );
  }
}

/**
 * Remove a single managed object relationship-property definition, leaving
 * the rest of the type's schema untouched. Available on any deployment that
 * runs IDM (Cloud and ForgeOps) — see
 * {@link assertIdmDeploymentForSchemaPropertyApi}. Invalidates the cached
 * whole-type schema; see {@link updateManagedObjectSchemaProperty}.
 * @param {boolean} wait wait for the config change to fully propagate before returning. Defaults to true — see {@link putManagedObjectSchemaProperty}.
 */
export async function removeManagedObjectSchemaProperty({
  type,
  propertyName,
  wait = true,
  state,
}: {
  type: string;
  propertyName: string;
  wait?: boolean;
  state: State;
}): Promise<ManagedObjectSchemaProperty> {
  try {
    assertIdmDeploymentForSchemaPropertyApi({ type, state });
    const result = await _deleteManagedObjectSchemaProperty({
      type,
      propertyName,
      wait,
      state,
    });
    delete ManagedObjectSchemaCache[type];
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error removing managed ${type} schema property ${propertyName}`,
      error
    );
  }
}

/**
 * ---------------------------------------------------------------------
 * Flat (non-relationship) schema property support.
 * ---------------------------------------------------------------------
 * Everything below this point supports `createManagedObjectSchemaFlatProperty`
 * / `updateManagedObjectSchemaFlatProperty` /
 * `removeManagedObjectSchemaFlatProperty` — the generic, always-available
 * (path 2 in this file's module header) read-modify-write of a single flat
 * property definition, via `readSubConfigEntity`/`importSubConfigEntity`.
 * Unlike the dedicated v2 relationship-property API above, this path has no
 * IDM-version requirement and is not limited to relationship properties, but
 * it is also not atomic against a concurrent writer of the same type — the
 * same tradeoff `readSubConfigEntity`/`importSubConfigEntity` always carry.
 */

type ManagedObjectTypeConfig = IdObjectSkeletonInterface & {
  name: string;
  schema?: ManagedObjectSchema;
};

/** A schema property container: a managed-object type's own schema, or a nested `type: object` property's own sub-schema — both shapes carry the same `properties`/`order`/`required` triad. */
export type PropertyContainer = {
  properties?: Record<string, Record<string, unknown>>;
  order?: string[];
  required?: string[];
};

/**
 * Sets or replaces a schema property definition within a property container
 * (a managed-object type's own schema, or — via a sub-property path — a
 * nested `type: object` property's own sub-schema), keeping that container's
 * own order/required arrays in sync.
 */
export function setSchemaProperty(
  container: PropertyContainer,
  propertyName: string,
  propertyData: Record<string, unknown>
): void {
  container.properties = {
    ...container.properties,
    [propertyName]: propertyData,
  };
  const required = new Set(container.required || []);
  if ((propertyData as { required?: boolean }).required) {
    required.add(propertyName);
  } else {
    required.delete(propertyName);
  }
  container.required = Array.from(required);
  if (!(container.order || []).includes(propertyName)) {
    container.order = [...(container.order || []), propertyName];
  }
}

/**
 * Removes a schema property definition (and its required/order bookkeeping)
 * from a property container — see {@link setSchemaProperty}.
 */
export function removeSchemaProperty(
  container: PropertyContainer,
  propertyName: string
): void {
  const properties = { ...container.properties };
  delete properties[propertyName];
  container.properties = properties;
  container.required = (container.required || []).filter(
    (name) => name !== propertyName
  );
  container.order = (container.order || []).filter(
    (name) => name !== propertyName
  );
}

/** Splits a sub-property dot-path (e.g. `"address.geo.lat"`) into segments; `undefined`/empty yields no segments. */
export function parseSubPropertyPath(subProperty?: string): string[] {
  return subProperty
    ? subProperty.split('.').filter((segment) => segment.length > 0)
    : [];
}

/**
 * Walks a property path (e.g. `["profile", "address"]`) starting from the
 * type's own schema, down through `type: object` (or array-of-object)
 * properties, requiring every segment to already exist and be `type:
 * object`. Returns the resulting container — itself a valid target for
 * `setSchemaProperty`/`removeSchemaProperty`/further navigation, since a
 * nested object property's own body has the same
 * `properties`/`order`/`required` shape as the type's top-level schema.
 */
export function navigateToPropertyContainer(
  schema: PropertyContainer,
  path: string[]
): PropertyContainer {
  let container: PropertyContainer = schema;
  for (let i = 0; i < path.length; i++) {
    const segmentLabel = path.slice(0, i + 1).join('.');
    const property = container.properties?.[path[i]];
    if (!property) {
      throw new FrodoError(`Property "${segmentLabel}" not found.`);
    }
    const core = (
      property.type === 'array' ? property.items : property
    ) as Record<string, unknown>;
    if (core.type !== 'object') {
      throw new FrodoError(
        `"${segmentLabel}" is not an object property; a sub-property path requires each level to be type object.`
      );
    }
    container = core as PropertyContainer;
  }
  return container;
}

/**
 * Walks a property path (e.g. `["profile", "address", "street"]`, where
 * `"profile"` is the top-level property name and `["address", "street"]`
 * came from a sub-property path) down to its leaf. Every segment except the
 * last must already exist and be `type: object`. Returns the immediate
 * parent container (whose `.properties`/`.order`/`.required` the caller
 * reads/writes) and the leaf property name, so the same read/write logic
 * works identically whether the target is top-level or nested.
 */
export function navigatePropertyPath(
  schema: PropertyContainer,
  path: string[]
): { container: PropertyContainer; propertyName: string } {
  return {
    container: navigateToPropertyContainer(schema, path.slice(0, -1)),
    propertyName: path[path.length - 1],
  };
}

/**
 * Every schema property type the Admin UI's own property-type picker offers
 * (confirmed live against a hand-built managed-object type). Single source
 * of truth feeding both frodo-cli's `--property-type` CLI `.choices()`/help
 * text and this module's own {@link buildManagedObjectSchemaPropertyPayload}
 * validation: add a type here once IDM's picker offers it, and every
 * consumer picks it up automatically, instead of drifting out of sync as
 * separately-maintained lists.
 */
export const MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES = [
  'string',
  'number',
  'boolean',
  'date',
  'time',
  'datetime',
  'duration',
  'object',
] as const;

export type ManagedObjectSchemaCreatablePropertyType =
  (typeof MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES)[number];

/**
 * Field values for a flat (non-relationship) schema property. Used both for
 * create (fully specified) and update (only the explicitly-changed subset,
 * merged onto the property's current definition via
 * {@link extractManagedObjectSchemaPropertyFields}).
 */
export type ManagedObjectSchemaPropertyFields = {
  type?: ManagedObjectSchemaCreatablePropertyType;
  array?: boolean;
  title?: string;
  description?: string;
  required?: boolean;
  searchable?: boolean;
  userEditable?: boolean;
  notViewable?: boolean;
  returnByDefault?: boolean;
  defaultValue?: unknown;
  enumValues?: string[];
  enumTitles?: string[];
  /** JS source (already read from the file a caller's --on-retrieve-script points at), not a file path. */
  onRetrieveScript?: string;
  /** JS source (already read from the file a caller's --on-store-script points at), not a file path. */
  onStoreScript?: string;
  /** Relationship property name(s) this RDVP derives its value through — IDM's `queryConfig.referencedRelationshipFields`. */
  deriveFromRelationship?: string[];
  /** Fields to pull from each referenced object — IDM's `queryConfig.referencedObjectFields`. */
  deriveFields?: string[];
  flatten?: boolean;
};

/**
 * Turns a property name like "widgetSize" or "custom_merchantId" into a
 * human-readable default title ("Widget Size", "Custom Merchant Id") when
 * the caller didn't pass an explicit title.
 */
function humanizePropertyName(propertyName: string): string {
  const spaced = propertyName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return titleCase(spaced);
}

/**
 * Assembles a schema-property payload (a leaf type, or an array of that
 * type) from resolved field values, validating `type` and the
 * `enumValues`/`enumTitles` pairing along the way (throws `FrodoError`).
 * `date`/`time`/`datetime`/`duration` are all `type: "string"` with a
 * `format` field under the hood — confirmed against a type created via the
 * Admin UI's own property-type picker (which offers exactly these four
 * alongside String/Number/Boolean/Object), including the exact `format`
 * values (`"date"`, `"time"`, `"datetime"` — not the more common
 * `"date-time"` — and `"duration"`). `object` is always written as a bare
 * `{ type: "object" }` with no `properties`/`order`, matching a live example
 * of an empty object property — a *structured* object property (its own
 * nested set of sub-properties) is a deliberate scope choice, not a
 * technical limitation of the property itself: these fields only cover a
 * flat property definition, so a structured object needs a verbatim
 * `readSubConfigEntity`/`importSubConfigEntity` round trip instead, which
 * writes the definition as-is and has no such restriction.
 *
 * `default`/`enum`/`enumTitles` sit on the leaf type node (so they land on
 * `items` for an array property, constraining each element) — confirmed
 * against a live `enum` property. `isVirtual`/`onRetrieve`/`onStore`/
 * `queryConfig` sit at the top level instead, confirmed against two live
 * managed-object examples: a pure RDVP (relationship-derived virtual
 * property, `queryConfig` only, no script), and a script-derived virtual
 * property (`onRetrieve` only, no `queryConfig`) — both live entirely inside
 * `schema.properties`, the same place create/update already read and write,
 * so no new API surface was needed for either.
 *
 * Note on the `type` validation below: it runs against whatever ends up in
 * `fields.type`, including a value merely carried through unchanged from an
 * existing property's current definition during an update (see
 * {@link extractManagedObjectSchemaPropertyFields}) — so updating so much as
 * the title of a property whose type isn't one of
 * {@link MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES} (e.g. one
 * hand-crafted outside this flat-property path) fails here too. That's a
 * deliberate tradeoff for a single, consistently-enforced source of truth
 * rather than validating only caller-supplied overrides; a property in that
 * situation still has the unrestricted `readSubConfigEntity`/
 * `importSubConfigEntity` verbatim round trip available as an escape hatch.
 */
export function buildManagedObjectSchemaPropertyPayload(
  propertyName: string,
  fields: ManagedObjectSchemaPropertyFields
): Record<string, unknown> {
  if (
    fields.type !== undefined &&
    !(
      MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES as readonly string[]
    ).includes(fields.type)
  ) {
    throw new FrodoError(
      `Invalid property type "${fields.type}". Valid types: ${MANAGED_OBJECT_SCHEMA_CREATABLE_PROPERTY_TYPES.join(', ')}.`
    );
  }
  if (
    fields.enumTitles &&
    fields.enumValues &&
    fields.enumTitles.length !== fields.enumValues.length
  ) {
    throw new FrodoError(
      `enumTitles must have the same number of entries as enumValues (got ${fields.enumTitles.length} titles for ${fields.enumValues.length} values).`
    );
  }
  const title = fields.title || humanizePropertyName(propertyName);
  const typeCore: Record<string, unknown> =
    fields.type === 'date' ||
    fields.type === 'time' ||
    fields.type === 'datetime' ||
    fields.type === 'duration'
      ? { type: 'string', format: fields.type }
      : { type: fields.type };
  if (fields.defaultValue !== undefined) {
    typeCore.default = fields.defaultValue;
  }
  if (fields.enumValues && fields.enumValues.length > 0) {
    typeCore.enum = fields.enumValues;
  }
  if (fields.enumTitles && fields.enumTitles.length > 0) {
    typeCore.enumTitles = fields.enumTitles;
  }
  const isVirtual = !!(
    fields.onRetrieveScript ||
    fields.onStoreScript ||
    fields.deriveFromRelationship
  );
  const baseFields: Record<string, unknown> = {
    title,
    ...(fields.description && { description: fields.description }),
    viewable: !fields.notViewable,
    userEditable: !!fields.userEditable,
    returnByDefault: !!fields.returnByDefault,
    ...(isVirtual && { isVirtual: true }),
    ...(fields.onRetrieveScript && {
      onRetrieve: {
        type: 'text/javascript',
        globals: {},
        source: fields.onRetrieveScript,
      },
    }),
    ...(fields.onStoreScript && {
      onStore: {
        type: 'text/javascript',
        globals: {},
        source: fields.onStoreScript,
      },
    }),
    ...(fields.deriveFromRelationship && {
      queryConfig: {
        flattenProperties: !!fields.flatten,
        referencedObjectFields: fields.deriveFields || [],
        referencedRelationshipFields: fields.deriveFromRelationship,
      },
    }),
    ...(fields.searchable !== undefined && { searchable: fields.searchable }),
    ...(fields.required !== undefined && { required: fields.required }),
  };
  if (!fields.array) {
    return { ...typeCore, ...baseFields };
  }
  return { type: 'array', ...baseFields, items: typeCore };
}

/**
 * Reverse-parses a live schema property definition back into
 * {@link ManagedObjectSchemaPropertyFields}, so update can merge only the
 * explicitly-changed overrides onto the property's actual current state
 * rather than create-time defaults.
 */
export function extractManagedObjectSchemaPropertyFields(
  current: Record<string, unknown>
): ManagedObjectSchemaPropertyFields {
  const array = current.type === 'array';
  const core = (array ? current.items : current) as Record<string, unknown>;
  const type = (
    core.type === 'string' && typeof core.format === 'string'
      ? core.format
      : core.type
  ) as ManagedObjectSchemaCreatablePropertyType;
  const onRetrieve = current.onRetrieve as { source?: string } | undefined;
  const onStore = current.onStore as { source?: string } | undefined;
  const queryConfig = current.queryConfig as
    | {
        flattenProperties?: boolean;
        referencedObjectFields?: string[];
        referencedRelationshipFields?: string[];
      }
    | undefined;
  return {
    type,
    array,
    title: current.title as string | undefined,
    description: current.description as string | undefined,
    required: current.required as boolean | undefined,
    searchable: current.searchable as boolean | undefined,
    userEditable: !!current.userEditable,
    notViewable: current.viewable === false,
    returnByDefault: !!current.returnByDefault,
    defaultValue: core.default,
    enumValues: core.enum as string[] | undefined,
    enumTitles: core.enumTitles as string[] | undefined,
    onRetrieveScript: onRetrieve?.source,
    onStoreScript: onStore?.source,
    deriveFromRelationship: queryConfig?.referencedRelationshipFields,
    deriveFields: queryConfig?.referencedObjectFields,
    flatten: queryConfig?.flattenProperties,
  };
}

/** Drops keys whose value is `undefined`, so a partial overrides object only overrides what was actually set. */
function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

/**
 * Throws (`FrodoError`) unless every name in `relationshipNames` is an
 * existing top-level property on `schema` whose type (unwrapping an array
 * property's `items`) is `relationship` — the constraint a relationship-
 * derived virtual property's `deriveFromRelationship` must satisfy.
 */
function assertRelationshipPropertiesExist(
  schema: PropertyContainer,
  relationshipNames: string[],
  type: string
): void {
  for (const name of relationshipNames) {
    const candidate = schema.properties?.[name];
    const core = (candidate?.type === 'array' ? candidate.items : candidate) as
      | Record<string, unknown>
      | undefined;
    if (!candidate || core?.type !== 'relationship') {
      throw new FrodoError(
        `"${name}" is not a relationship property on managed object type "${type}"; deriveFromRelationship must name an existing relationship property.`
      );
    }
  }
}

/**
 * Create a flat (non-relationship) schema property. See
 * {@link ManagedObjectSchemaOps.createManagedObjectSchemaFlatProperty} for
 * the full doc comment.
 */
export async function createManagedObjectSchemaFlatProperty({
  type,
  propertyName,
  fields,
  subProperty,
  state,
}: {
  type: string;
  propertyName: string;
  fields: ManagedObjectSchemaPropertyFields;
  subProperty?: string;
  state: State;
}): Promise<Record<string, unknown>> {
  const path = [propertyName, ...parseSubPropertyPath(subProperty)];
  const leafName = path[path.length - 1];
  try {
    const propertyData = buildManagedObjectSchemaPropertyPayload(
      leafName,
      fields
    );
    const typeConfig = (await readSubConfigEntity({
      entityId: 'managed',
      name: type,
      state,
    })) as ManagedObjectTypeConfig;
    if (!typeConfig.schema) {
      throw new FrodoError(
        `Managed object type "${type}" has no schema definition.`
      );
    }
    if (fields.deriveFromRelationship) {
      assertRelationshipPropertiesExist(
        typeConfig.schema as unknown as PropertyContainer,
        fields.deriveFromRelationship,
        type
      );
    }
    const { container } = navigatePropertyPath(
      typeConfig.schema as unknown as PropertyContainer,
      path
    );
    if (container.properties?.[leafName]) {
      throw new FrodoError(
        `Property "${path.join('.')}" already exists on managed object type "${type}". Use update instead.`
      );
    }
    setSchemaProperty(container, leafName, propertyData);
    await importSubConfigEntity({
      entityId: 'managed',
      updatedSubConfigEntity: typeConfig,
      options: { validate: false },
      state,
    });
    delete ManagedObjectSchemaCache[type];
    return propertyData;
  } catch (error) {
    throw new FrodoError(
      `Error creating property "${path.join('.')}" on managed object type "${type}"`,
      error
    );
  }
}

/**
 * Update a flat (non-relationship) schema property. See
 * {@link ManagedObjectSchemaOps.updateManagedObjectSchemaFlatProperty} for
 * the full doc comment.
 */
export async function updateManagedObjectSchemaFlatProperty({
  type,
  propertyName,
  changedFields,
  subProperty,
  state,
}: {
  type: string;
  propertyName: string;
  changedFields: Partial<ManagedObjectSchemaPropertyFields>;
  subProperty?: string;
  state: State;
}): Promise<{
  current: Record<string, unknown>;
  propertyData: Record<string, unknown>;
}> {
  const path = [propertyName, ...parseSubPropertyPath(subProperty)];
  const leafName = path[path.length - 1];
  try {
    const typeConfig = (await readSubConfigEntity({
      entityId: 'managed',
      name: type,
      state,
    })) as ManagedObjectTypeConfig;
    if (!typeConfig.schema) {
      throw new FrodoError(
        `Managed object type "${type}" has no schema definition.`
      );
    }
    const { container } = navigatePropertyPath(
      typeConfig.schema as unknown as PropertyContainer,
      path
    );
    const current = container.properties?.[leafName];
    if (!current) {
      throw new FrodoError(
        `Property "${path.join('.')}" not found on managed object type "${type}". Use create instead.`
      );
    }
    const overrides = pruneUndefined(changedFields);
    const mergedFields = {
      ...extractManagedObjectSchemaPropertyFields(current),
      ...overrides,
    };
    if (mergedFields.deriveFromRelationship) {
      assertRelationshipPropertiesExist(
        typeConfig.schema as unknown as PropertyContainer,
        mergedFields.deriveFromRelationship,
        type
      );
    }
    const propertyData = buildManagedObjectSchemaPropertyPayload(
      leafName,
      mergedFields
    );
    setSchemaProperty(container, leafName, propertyData);
    await importSubConfigEntity({
      entityId: 'managed',
      updatedSubConfigEntity: typeConfig,
      options: { validate: false },
      state,
    });
    delete ManagedObjectSchemaCache[type];
    return { current, propertyData };
  } catch (error) {
    throw new FrodoError(
      `Error updating property "${path.join('.')}" on managed object type "${type}"`,
      error
    );
  }
}

/**
 * Remove a flat (non-relationship) schema property. See
 * {@link ManagedObjectSchemaOps.removeManagedObjectSchemaFlatProperty} for
 * the full doc comment.
 */
export async function removeManagedObjectSchemaFlatProperty({
  type,
  propertyName,
  subProperty,
  state,
}: {
  type: string;
  propertyName: string;
  subProperty?: string;
  state: State;
}): Promise<Record<string, unknown>> {
  const path = [propertyName, ...parseSubPropertyPath(subProperty)];
  const leafName = path[path.length - 1];
  try {
    const typeConfig = (await readSubConfigEntity({
      entityId: 'managed',
      name: type,
      state,
    })) as ManagedObjectTypeConfig;
    if (!typeConfig.schema) {
      throw new FrodoError(
        `Managed object type "${type}" has no schema definition.`
      );
    }
    const { container } = navigatePropertyPath(
      typeConfig.schema as unknown as PropertyContainer,
      path
    );
    const current = container.properties?.[leafName];
    if (!current) {
      throw new FrodoError(
        `Property "${path.join('.')}" not found on managed object type "${type}".`
      );
    }
    removeSchemaProperty(container, leafName);
    await importSubConfigEntity({
      entityId: 'managed',
      updatedSubConfigEntity: typeConfig,
      options: { validate: false },
      state,
    });
    delete ManagedObjectSchemaCache[type];
    return current;
  } catch (error) {
    throw new FrodoError(
      `Error removing property "${path.join('.')}" from managed object type "${type}"`,
      error
    );
  }
}

/**
 * ---------------------------------------------------------------------
 * Managed-object type-level create/update/remove support.
 * ---------------------------------------------------------------------
 * Everything below this point supports `createManagedObjectType` /
 * `updateManagedObjectType` / `removeManagedObjectType` -- creating,
 * renaming/re-iconing/re-describing, and removing a managed-object type's
 * own definition (as opposed to one of its schema properties, above). Uses
 * the same `readSubConfigEntity`/`importSubConfigEntity`/
 * `removeSubConfigEntity` path as the flat-property functions, since a
 * type's own metadata (title/icon/description) lives on the same
 * `schema` object as its `properties`.
 */

/**
 * Default icon written for a new managed-object type when `fields.icon`
 * isn't given. A Material Design Icon name (not a Font Awesome name) --
 * confirmed via PingIDM's docs that `icon` only applies to standalone IDM,
 * while `mat-icon` is what the Ping Identity Platform's own Admin UI reads,
 * and managed-object type create/update only ever target Cloud/ForgeOps
 * (Platform deployments), never standalone IDM.
 */
export const MANAGED_OBJECT_TYPE_DEFAULT_ICON = 'widgets';

/**
 * A managed-object type's own metadata, as resolved from caller-supplied
 * field values. Used both for create (title required) and update (only the
 * explicitly-changed subset, merged onto the type's current definition).
 */
export type ManagedObjectTypeFields = {
  title?: string;
  icon?: string;
  description?: string;
};

/**
 * Assembles a minimal managed-object type definition from resolved field
 * values -- just the type's own identity/metadata, no custom properties
 * (those are added afterward via the flat-property/relationship-property
 * paths, which already keep `schema.order`/`schema.required` in sync as
 * they go). Always writes a populated `order` array (`['_id']`) and a
 * `mat-icon`, even when `fields.icon` isn't given -- a type whose schema
 * lacks a populated `order` array has been observed to cause the v2
 * relationship-property API to fail later, so an icon is kept as a paired
 * default rather than risking that failure mode.
 *
 * Cast via `unknown`: the real API doesn't require `resourceCollection` on
 * the whole-type schema (absent in every real fixture confirmed this
 * session), even though `ManagedObjectSchema`'s type declares it required;
 * `mat-icon`/`description` aren't in `ManagedObjectSchema`'s type at all
 * (frodo-lib only declares `icon`), same reason.
 */
export function buildManagedObjectTypeSchema(
  type: string,
  fields: ManagedObjectTypeFields
): ManagedObjectTypeConfig {
  const schema = {
    $schema: 'http://json-schema.org/draft-04/schema#',
    title: fields.title,
    'mat-icon': fields.icon || MANAGED_OBJECT_TYPE_DEFAULT_ICON,
    ...(fields.description && { description: fields.description }),
    type: 'object',
    properties: { _id: { type: 'string', title: 'Id' } },
    order: ['_id'],
    required: [] as string[],
  } as unknown as ManagedObjectSchema;
  return { name: type, schema };
}

/**
 * Create a managed object type. See
 * {@link ManagedObjectSchemaOps.createManagedObjectType} for the full doc
 * comment.
 */
export async function createManagedObjectType({
  type,
  fields,
  state,
}: {
  type: string;
  fields: ManagedObjectTypeFields;
  state: State;
}): Promise<Record<string, unknown>> {
  try {
    const typeConfig = buildManagedObjectTypeSchema(type, fields);
    const managedConfig = (await readConfigEntity({
      entityId: 'managed',
      state,
    })) as IdObjectSkeletonInterface & {
      objects?: { name: string }[];
    };
    if ((managedConfig.objects || []).some((object) => object.name === type)) {
      throw new FrodoError(
        `Managed object type "${type}" already exists. Use update instead.`
      );
    }
    await importSubConfigEntity({
      entityId: 'managed',
      updatedSubConfigEntity: typeConfig,
      options: { validate: false },
      state,
    });
    return typeConfig.schema as unknown as Record<string, unknown>;
  } catch (error) {
    throw new FrodoError(`Error creating managed object type "${type}"`, error);
  }
}

/**
 * Update a managed object type. See
 * {@link ManagedObjectSchemaOps.updateManagedObjectType} for the full doc
 * comment.
 */
export async function updateManagedObjectType({
  type,
  changedFields,
  state,
}: {
  type: string;
  changedFields: Partial<ManagedObjectTypeFields>;
  state: State;
}): Promise<{
  current: ManagedObjectTypeFields;
  proposed: ManagedObjectTypeFields;
}> {
  try {
    const typeConfig = (await readSubConfigEntity({
      entityId: 'managed',
      name: type,
      state,
    })) as ManagedObjectTypeConfig;
    if (!typeConfig.schema) {
      throw new FrodoError(
        `Managed object type "${type}" not found. Use create instead.`
      );
    }
    const schemaRecord = typeConfig.schema as unknown as Record<
      string,
      unknown
    >;
    const current: ManagedObjectTypeFields = {
      title: typeConfig.schema.title,
      icon: schemaRecord['mat-icon'] as string | undefined,
      description: schemaRecord.description as string | undefined,
    };
    const overrides = pruneUndefinedFields(changedFields);
    const proposed: ManagedObjectTypeFields = { ...current, ...overrides };
    typeConfig.schema.title = proposed.title;
    schemaRecord['mat-icon'] = proposed.icon;
    schemaRecord.description = proposed.description;
    await importSubConfigEntity({
      entityId: 'managed',
      updatedSubConfigEntity: typeConfig,
      options: { validate: false },
      state,
    });
    return { current, proposed };
  } catch (error) {
    throw new FrodoError(`Error updating managed object type "${type}"`, error);
  }
}

/** Drops keys whose value is `undefined`, so a partial overrides object only overrides what was actually set. */
function pruneUndefinedFields<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

/**
 * Remove a managed object type. See
 * {@link ManagedObjectSchemaOps.removeManagedObjectType} for the full doc
 * comment.
 */
export async function removeManagedObjectType({
  type,
  state,
}: {
  type: string;
  state: State;
}): Promise<void> {
  try {
    await removeSubConfigEntity({
      entityId: 'managed',
      name: type,
      options: { validate: false },
      state,
    });
    delete ManagedObjectSchemaCache[type];
  } catch (error) {
    throw new FrodoError(`Error removing managed object type "${type}"`, error);
  }
}

/**
 * ---------------------------------------------------------------------
 * Relationship-property create/update/remove support.
 * ---------------------------------------------------------------------
 * Everything below this point supports
 * `createManagedObjectSchemaRelationshipProperty` /
 * `updateManagedObjectSchemaRelationshipProperty` /
 * `removeManagedObjectSchemaRelationshipProperty` -- unlike the flat-
 * property and type-level functions above, these go through the dedicated
 * v2 relationship-schema API (`readManagedObjectSchemaProperty` /
 * `updateManagedObjectSchemaProperty` / `removeManagedObjectSchemaProperty`,
 * already defined earlier in this file), not the generic
 * `readSubConfigEntity`/`importSubConfigEntity` whole-type path -- see this
 * file's own module header for why. A bidirectional relationship has a
 * forward and a reverse side, each its own separate property on (usually)
 * two different managed-object types; creation can auto-create both sides
 * in one write (the server does this), but update/remove of an existing
 * bidirectional pair always requires two separate API calls, one per side,
 * with no cross-call transaction -- the ordering and partial-failure
 * handling below exists specifically to keep that reality honest rather
 * than pretending it's atomic.
 */

/** Field values for a relationship (or array-of-relationship) schema property, as resolved from caller-supplied values. */
export type ManagedObjectSchemaRelationshipPropertyFields = {
  targetObject?: string;
  many?: boolean;
  queryFields?: string[];
  title?: string;
  description?: string;
  label?: string;
  queryFilter?: string;
  sortKeys?: string[];
  notify?: boolean;
  notifySelf?: boolean;
  searchable?: boolean;
  userEditable?: boolean;
  notViewable?: boolean;
  notValidate?: boolean;
  returnByDefault?: boolean;
  reversePropertyName?: string;
};

/** Field values for the reverse side of a bidirectional relationship, embedded in the forward side's own write. */
export type ManagedObjectSchemaRelationshipReverseFields = {
  propertyName: string;
  many: boolean;
  queryFields: string[];
  title?: string;
  description?: string;
};

/** The `_ref`/`_refProperties` sub-schema every relationship property carries -- structurally identical (only the `_refProperties.title` label varies, derived from the property's own title) across every relationship property surveyed live. */
function buildRelationshipRefProperties(
  effectiveTitle: string
): Record<string, unknown> {
  return {
    _ref: {
      type: 'string',
      description: 'References a relationship from a managed object',
    },
    _refProperties: {
      type: 'object',
      description: 'Supports metadata within the relationship',
      title: `${effectiveTitle} _refProperties`,
      properties: {
        _id: { type: 'string', description: '_refProperties object ID' },
      },
    },
  };
}

/**
 * Describes the reverse side for the v2 API's single-call bidirectional
 * auto-creation mechanism: embedding this descriptor in the forward side's
 * own `resourceCollection[0].reverseProperty` makes the server create the
 * reverse property itself, in the same write that creates the forward
 * side -- live-confirmed to work for all four single/many combinations on
 * both sides (this is also the definitive, live-confirmed answer to
 * whether the v2 API auto-creates the reverse side: yes, given this
 * descriptor; without it, `reverseRelationship: true` is rejected outright
 * with a 400, "field is required"). The server does NOT honor a custom
 * title/description here -- the auto-created property always gets the raw
 * property name for both, live-confirmed -- but they're still passed
 * through for forward compatibility in case that changes.
 */
function buildReversePropertyDescriptor(
  reverse: ManagedObjectSchemaRelationshipReverseFields
): Record<string, unknown> {
  return {
    type: reverse.many ? 'array' : 'relationship',
    ...(reverse.title && { title: reverse.title }),
    ...(reverse.description && { description: reverse.description }),
    validate: true,
    resourceCollection: {
      notify: false,
      query: { fields: reverse.queryFields, queryFilter: 'true' },
    },
  };
}

function buildRelationshipResourceCollectionItem(
  fields: ManagedObjectSchemaRelationshipPropertyFields,
  reverse?: ManagedObjectSchemaRelationshipReverseFields
): Record<string, unknown> {
  return {
    label: fields.label || humanizePropertyName(fields.targetObject),
    notify: !!fields.notify,
    path: `managed/${fields.targetObject}`,
    ...(reverse && {
      reverseProperty: buildReversePropertyDescriptor(reverse),
    }),
    query: {
      fields: fields.queryFields,
      queryFilter: fields.queryFilter || 'true',
      ...(fields.sortKeys ? { sortKeys: fields.sortKeys } : {}),
    },
  };
}

/**
 * Assembles a full relationship (or array-of-relationship) schema-property
 * payload from resolved field values: `validate`/`viewable` default true,
 * `userEditable`/`returnByDefault`/`notifySelf`/resourceCollection `notify`
 * default false, `queryFilter` defaults `'true'`, and `searchable`/
 * `sortKeys` are omitted entirely unless explicitly given. `reverse`, when
 * given (create, or update re-supplying an existing bidirectional
 * property's required descriptor), embeds a reverse-property descriptor --
 * see {@link buildReversePropertyDescriptor}.
 *
 * Built as a plain object and cast at the call site rather than typed as
 * `ManagedObjectSchemaProperty` throughout: the real IDM v2 API is more
 * lenient than that type declares (`sortKeys`/`searchable` in particular
 * are routinely absent from real property definitions returned by the
 * server).
 */
export function buildManagedObjectSchemaRelationshipPropertyPayload(
  propertyName: string,
  fields: ManagedObjectSchemaRelationshipPropertyFields,
  reverse?: ManagedObjectSchemaRelationshipReverseFields
): Record<string, unknown> {
  const title = fields.title || humanizePropertyName(propertyName);
  const itemsTitle = `${title} Items`;
  const effectiveTitle = fields.many ? itemsTitle : title;

  const relationshipCore: Record<string, unknown> = {
    id: propertyName,
    type: 'relationship',
    ...(fields.many && { title: itemsTitle }),
    properties: buildRelationshipRefProperties(effectiveTitle),
    resourceCollection: [
      buildRelationshipResourceCollectionItem(fields, reverse),
    ],
    reverseRelationship: !!fields.reversePropertyName,
    ...(fields.reversePropertyName && {
      reversePropertyName: fields.reversePropertyName,
    }),
    validate: !fields.notValidate,
    notifySelf: !!fields.notifySelf,
  };

  const baseFields: Record<string, unknown> = {
    title,
    ...(fields.description && { description: fields.description }),
    viewable: !fields.notViewable,
    userEditable: !!fields.userEditable,
    returnByDefault: !!fields.returnByDefault,
    ...(fields.searchable !== undefined && { searchable: fields.searchable }),
  };

  if (!fields.many) {
    return { ...relationshipCore, ...baseFields };
  }
  return { type: 'array', ...baseFields, items: relationshipCore };
}

/**
 * Reverse-parses a live relationship (or array-of-relationship) property
 * definition back into {@link ManagedObjectSchemaRelationshipPropertyFields},
 * so update can merge only the explicitly-changed overrides onto the
 * property's actual current state rather than create-time defaults.
 */
export function extractManagedObjectSchemaRelationshipPropertyFields(
  current: Record<string, unknown>
): ManagedObjectSchemaRelationshipPropertyFields {
  const many = current.type === 'array';
  const rel = (many ? current.items : current) as Record<string, unknown>;
  const base = many ? current : rel;
  const resourceCollection = (
    rel.resourceCollection as Array<Record<string, unknown>>
  )?.[0];
  const query = resourceCollection?.query as
    | Record<string, unknown>
    | undefined;
  const path = resourceCollection?.path as string | undefined;
  return {
    targetObject: path?.startsWith('managed/')
      ? path.slice('managed/'.length)
      : undefined,
    many,
    queryFields: (query?.fields as string[]) || [],
    title: base.title as string | undefined,
    description: base.description as string | undefined,
    label: resourceCollection?.label as string | undefined,
    queryFilter: query?.queryFilter as string | undefined,
    sortKeys: query?.sortKeys as string[] | undefined,
    notify: !!resourceCollection?.notify,
    notifySelf: !!rel.notifySelf,
    searchable: base.searchable as boolean | undefined,
    userEditable: !!base.userEditable,
    notViewable: base.viewable === false,
    notValidate: rel.validate === false,
    returnByDefault: !!base.returnByDefault,
    reversePropertyName: rel.reversePropertyName as string | undefined,
  };
}

/**
 * Turns an already-fetched relationship property's extracted fields into
 * the descriptor shape {@link buildManagedObjectSchemaRelationshipPropertyPayload}'s
 * `reverse` parameter expects. Used on update: the v2 API requires a
 * `resourceCollection[0].reverseProperty` descriptor on *every* write of a
 * property that has `reverseRelationship: true` set, not just its initial
 * creation -- live-confirmed via a 400 ("field is required") when updating
 * an already-bidirectional property without one -- so any update to a
 * property with a configured reverse side must re-supply this descriptor
 * even when the caller isn't touching the reverse side's own fields.
 */
export function toManagedObjectSchemaRelationshipReverseFields(
  propertyName: string,
  fields: ManagedObjectSchemaRelationshipPropertyFields
): ManagedObjectSchemaRelationshipReverseFields {
  return {
    propertyName,
    many: !!fields.many,
    queryFields: fields.queryFields || [],
    title: fields.title,
    description: fields.description,
  };
}

/**
 * Infers a relationship property's reverse side (type + property name) from
 * its own definition -- the source of truth `withReverse` reads from on
 * update/remove, needing no separate identity parameters.
 */
export function inferManagedObjectSchemaRelationshipReverseIdentity(
  property: Record<string, unknown>
): { type: string; propertyName: string } | null {
  const rel = (property.type === 'array' ? property.items : property) as Record<
    string,
    unknown
  >;
  const reversePropertyName = rel?.reversePropertyName as string | undefined;
  const resourceCollection = (
    rel?.resourceCollection as Array<Record<string, unknown>>
  )?.[0];
  const path = resourceCollection?.path as string | undefined;
  if (!reversePropertyName || !path?.startsWith('managed/')) {
    return null;
  }
  return {
    type: path.slice('managed/'.length),
    propertyName: reversePropertyName,
  };
}

/**
 * Read a relationship schema property. See
 * {@link ManagedObjectSchemaOps.readManagedObjectSchemaRelationshipPropertyOrNull}
 * for the full doc comment.
 */
export async function readManagedObjectSchemaRelationshipPropertyOrNull({
  type,
  propertyName,
  state,
}: {
  type: string;
  propertyName: string;
  state: State;
}): Promise<Record<string, unknown> | null> {
  try {
    const property = await readManagedObjectSchemaProperty({
      type,
      propertyName,
      state,
    });
    return property as unknown as Record<string, unknown>;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a relationship schema property. See
 * {@link ManagedObjectSchemaOps.createManagedObjectSchemaRelationshipProperty}
 * for the full doc comment.
 */
export async function createManagedObjectSchemaRelationshipProperty({
  type,
  propertyName,
  fields,
  reverse,
  state,
}: {
  type: string;
  propertyName: string;
  fields: ManagedObjectSchemaRelationshipPropertyFields;
  reverse?: ManagedObjectSchemaRelationshipReverseFields;
  state: State;
}): Promise<Record<string, unknown>> {
  try {
    const existingForward =
      await readManagedObjectSchemaRelationshipPropertyOrNull({
        type,
        propertyName,
        state,
      });
    if (existingForward) {
      throw new FrodoError(
        `Relationship "${propertyName}" already exists on managed object type "${type}". Use update instead.`
      );
    }
    if (reverse) {
      const existingReverse =
        await readManagedObjectSchemaRelationshipPropertyOrNull({
          type: fields.targetObject,
          propertyName: reverse.propertyName,
          state,
        });
      if (existingReverse) {
        throw new FrodoError(
          `Relationship "${reverse.propertyName}" already exists on managed object type "${fields.targetObject}". Use update instead.`
        );
      }
    }
    const forwardPayload = buildManagedObjectSchemaRelationshipPropertyPayload(
      propertyName,
      {
        ...fields,
        reversePropertyName: reverse
          ? reverse.propertyName
          : fields.reversePropertyName,
      },
      reverse
    );
    await updateManagedObjectSchemaProperty({
      type,
      propertyName,
      propertyData: forwardPayload as unknown as ManagedObjectSchemaProperty,
      state,
    });
    return forwardPayload;
  } catch (error) {
    throw new FrodoError(
      `Error creating relationship "${propertyName}" on managed object type "${type}"`,
      error
    );
  }
}

/**
 * Update a relationship schema property. See
 * {@link ManagedObjectSchemaOps.updateManagedObjectSchemaRelationshipProperty}
 * for the full doc comment.
 */
export async function updateManagedObjectSchemaRelationshipProperty({
  type,
  propertyName,
  changedFields,
  withReverse = false,
  state,
}: {
  type: string;
  propertyName: string;
  changedFields: Partial<ManagedObjectSchemaRelationshipPropertyFields>;
  withReverse?: boolean;
  state: State;
}): Promise<{
  forward: Record<string, unknown>;
  reverse?: {
    type: string;
    propertyName: string;
    propertyData: Record<string, unknown>;
  };
}> {
  try {
    const current = await readManagedObjectSchemaRelationshipPropertyOrNull({
      type,
      propertyName,
      state,
    });
    if (!current) {
      throw new FrodoError(
        `Relationship "${propertyName}" not found on managed object type "${type}". Use create instead.`
      );
    }
    // A configured reverse side's descriptor must be re-supplied on every
    // write, not just when withReverse asks to also change its fields --
    // see toManagedObjectSchemaRelationshipReverseFields. So the reverse
    // side is fetched whenever one exists, regardless of withReverse.
    const reverseIdentity =
      inferManagedObjectSchemaRelationshipReverseIdentity(current);
    if (withReverse && !reverseIdentity) {
      throw new FrodoError(
        `Relationship "${propertyName}" on managed object type "${type}" has no reverse relationship configured; withReverse cannot be used.`
      );
    }
    let reverseCurrent: Record<string, unknown> | null = null;
    if (reverseIdentity) {
      reverseCurrent = await readManagedObjectSchemaRelationshipPropertyOrNull({
        type: reverseIdentity.type,
        propertyName: reverseIdentity.propertyName,
        state,
      });
      if (!reverseCurrent) {
        throw new FrodoError(
          `Reverse relationship "${reverseIdentity.propertyName}" not found on managed object type "${reverseIdentity.type}".`
        );
      }
    }
    const overrides = pruneUndefinedFields(changedFields);
    const mergedForwardFields = {
      ...extractManagedObjectSchemaRelationshipPropertyFields(current),
      ...overrides,
    };
    const mergedReverseFields =
      reverseCurrent && reverseIdentity
        ? withReverse
          ? {
              ...extractManagedObjectSchemaRelationshipPropertyFields(
                reverseCurrent
              ),
              ...overrides,
            }
          : extractManagedObjectSchemaRelationshipPropertyFields(reverseCurrent)
        : undefined;
    const forwardPayload = buildManagedObjectSchemaRelationshipPropertyPayload(
      propertyName,
      mergedForwardFields,
      mergedReverseFields && reverseIdentity
        ? toManagedObjectSchemaRelationshipReverseFields(
            reverseIdentity.propertyName,
            mergedReverseFields
          )
        : undefined
    );
    let reversePayload: Record<string, unknown> | undefined;
    if (withReverse && mergedReverseFields && reverseIdentity) {
      reversePayload = buildManagedObjectSchemaRelationshipPropertyPayload(
        reverseIdentity.propertyName,
        mergedReverseFields,
        toManagedObjectSchemaRelationshipReverseFields(
          propertyName,
          mergedForwardFields
        )
      );
    }
    await updateManagedObjectSchemaProperty({
      type,
      propertyName,
      propertyData: forwardPayload as unknown as ManagedObjectSchemaProperty,
      state,
    });
    if (withReverse && reversePayload && reverseIdentity) {
      try {
        await updateManagedObjectSchemaProperty({
          type: reverseIdentity.type,
          propertyName: reverseIdentity.propertyName,
          propertyData:
            reversePayload as unknown as ManagedObjectSchemaProperty,
          state,
        });
      } catch (error) {
        throw new FrodoError(
          `Updated relationship "${propertyName}" on "${type}", but failed to update its reverse relationship "${reverseIdentity.type}.${reverseIdentity.propertyName}"`,
          error
        );
      }
      return {
        forward: forwardPayload,
        reverse: {
          type: reverseIdentity.type,
          propertyName: reverseIdentity.propertyName,
          propertyData: reversePayload,
        },
      };
    }
    return { forward: forwardPayload };
  } catch (error) {
    throw new FrodoError(
      `Error updating relationship "${propertyName}" on managed object type "${type}"`,
      error
    );
  }
}

/**
 * Remove a relationship schema property. See
 * {@link ManagedObjectSchemaOps.removeManagedObjectSchemaRelationshipProperty}
 * for the full doc comment.
 */
export async function removeManagedObjectSchemaRelationshipProperty({
  type,
  propertyName,
  withReverse = false,
  state,
}: {
  type: string;
  propertyName: string;
  withReverse?: boolean;
  state: State;
}): Promise<{
  current: Record<string, unknown>;
  reverse?: {
    type: string;
    propertyName: string;
    current: Record<string, unknown>;
  };
}> {
  try {
    const current = await readManagedObjectSchemaRelationshipPropertyOrNull({
      type,
      propertyName,
      state,
    });
    if (!current) {
      throw new FrodoError(
        `Relationship "${propertyName}" not found on managed object type "${type}"`
      );
    }
    let reverseIdentity: { type: string; propertyName: string } | null = null;
    let reverseCurrent: Record<string, unknown> | null = null;
    if (withReverse) {
      reverseIdentity =
        inferManagedObjectSchemaRelationshipReverseIdentity(current);
      if (!reverseIdentity) {
        throw new FrodoError(
          `Relationship "${propertyName}" on managed object type "${type}" has no reverse relationship configured; withReverse cannot be used.`
        );
      }
      reverseCurrent = await readManagedObjectSchemaRelationshipPropertyOrNull({
        type: reverseIdentity.type,
        propertyName: reverseIdentity.propertyName,
        state,
      });
      if (!reverseCurrent) {
        throw new FrodoError(
          `Reverse relationship "${reverseIdentity.propertyName}" not found on managed object type "${reverseIdentity.type}".`
        );
      }
    }
    if (withReverse && reverseIdentity) {
      try {
        await removeManagedObjectSchemaProperty({
          type: reverseIdentity.type,
          propertyName: reverseIdentity.propertyName,
          state,
        });
      } catch (error) {
        throw new FrodoError(
          `Error deleting reverse relationship "${reverseIdentity.propertyName}" from "${reverseIdentity.type}". Forward relationship "${type}.${propertyName}" was left untouched.`,
          error
        );
      }
    }
    try {
      await removeManagedObjectSchemaProperty({ type, propertyName, state });
    } catch (error) {
      // Deleting a relationship property auto-created via the bidirectional
      // create mechanism (see buildReversePropertyDescriptor) cascades:
      // removing the reverse side already removed this forward side too --
      // live-confirmed. A 404 here right after a withReverse deletion means
      // the end state we wanted (both sides gone) was already reached, not
      // a failure.
      if (!(withReverse && isNotFoundError(error))) {
        throw error;
      }
    }
    return {
      current,
      ...(reverseIdentity && reverseCurrent
        ? {
            reverse: {
              type: reverseIdentity.type,
              propertyName: reverseIdentity.propertyName,
              current: reverseCurrent,
            },
          }
        : {}),
    };
  } catch (error) {
    throw new FrodoError(
      `Error removing relationship "${propertyName}" from managed object type "${type}"`,
      error
    );
  }
}
