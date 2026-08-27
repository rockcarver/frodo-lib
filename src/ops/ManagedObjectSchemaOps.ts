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
import { cloneDeep } from '../utils/JsonUtils';
import { FrodoError } from './FrodoError';

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
 */
export async function updateManagedObjectSchemaProperty({
  type,
  propertyName,
  propertyData,
  state,
}: {
  type: string;
  propertyName: string;
  propertyData: ManagedObjectSchemaProperty;
  state: State;
}): Promise<ManagedObjectSchemaProperty> {
  try {
    assertIdmDeploymentForSchemaPropertyApi({ type, state });
    const result = await _putManagedObjectSchemaProperty({
      type,
      propertyName,
      propertyData,
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
 */
export async function removeManagedObjectSchemaProperty({
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
    const result = await _deleteManagedObjectSchemaProperty({
      type,
      propertyName,
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
