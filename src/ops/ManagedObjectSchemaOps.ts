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
 * There are two ways to *mutate* a type's schema, and they are not
 * interchangeable:
 * 1. `readManagedObjectSchemaProperty` / `updateManagedObjectSchemaProperty` /
 *    `removeManagedObjectSchemaProperty` below use IDM's dedicated v2 schema
 *    API, which is specifically for **relationship-property definitions**,
 *    one at a time, in place, with no whole-blob read-modify-write. This is
 *    Cloud (PingOne Advanced Identity Cloud) only — see
 *    [rockcarver/frodo-lib#388](https://github.com/rockcarver/frodo-lib/issues/388)
 *    for the design discussion this followed.
 * 2. For every other case — any non-relationship property on any deployment,
 *    relationship properties on ForgeOps/classic (managed the regular way,
 *    like any other property type), and whole-type schema changes on any
 *    deployment — use `IdmConfigOps.ts`'s `readSubConfigEntity('managed', type)`
 *    / `importSubConfigEntity('managed', ...)` to read-modify-write the
 *    entire type definition (edit `.schema.properties` on the object you
 *    read before writing it back). This is the general-purpose path; #1 above
 *    is a narrow, Cloud-specific optimization for one particular case, not
 *    the default.
 *
 * Neither path touches the underlying repository's index/persistence-layer
 * definitions (e.g. DS's `repo.ds` on ForgeOps/classic) — Frodo has no
 * support for reading or writing `repo.ds` today, so adding a genuinely new
 * custom relationship property on ForgeOps/classic still requires a manual,
 * Frodo-unassisted edit to that file outside either API above.
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
   * Read a single managed object relationship-property definition. Cloud
   * (PingOne Advanced Identity Cloud) only — uses IDM's dedicated v2
   * relationship-schema API to read one relationship-property definition
   * without fetching the type's entire schema. For any non-relationship
   * property, or for any property (including relationships) on
   * ForgeOps/classic, use readSubConfigEntity('managed', type) and read the
   * property off the returned schema.properties instead.
   * @param {string} type managed object type, e.g. alpha_user
   * @param {string} propertyName schema property name, e.g. custom_merchantId
   * @returns {Promise<ManagedObjectSchemaProperty>} a promise that resolves to the property definition
   */
  readManagedObjectSchemaProperty(
    type: string,
    propertyName: string
  ): Promise<ManagedObjectSchemaProperty>;
  /**
   * Create or update a single managed object relationship-property
   * definition, leaving the rest of the type's schema untouched. Cloud
   * only — see {@link readManagedObjectSchemaProperty}. For any
   * non-relationship property, or for any property on ForgeOps/classic, use
   * importSubConfigEntity('managed', ...) with the full updated type
   * definition instead.
   * @param {string} type managed object type, e.g. alpha_user
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
   * the rest of the type's schema untouched. Cloud only — see
   * {@link readManagedObjectSchemaProperty}.
   * @param {string} type managed object type, e.g. alpha_user
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
 * Throws unless the current deployment is Cloud (PingOne Advanced Identity
 * Cloud). The dedicated v2 relationship-schema API these helpers wrap is
 * only documented under Ping's Cloud product family, and its realm-qualified
 * type examples match Cloud's per-realm managed-object partitioning — on
 * ForgeOps/classic, `ManagedObjectOps.ts`'s `resolveIdentity` own isCloud
 * check documents that managed types are flat (no realm prefix), so the same
 * v2 paths wouldn't resolve the same way there even if reachable. This gate
 * is specific to this relationship-schema API; it does not mean schema
 * property CRUD in general is Cloud-only — every other case (any
 * non-relationship property, or any property including relationships on
 * ForgeOps/classic) is handled the regular way via
 * readSubConfigEntity/importSubConfigEntity instead, which is
 * deployment-agnostic.
 */
function assertCloudDeploymentForSchemaPropertyApi({
  type,
  state,
}: {
  type: string;
  state: State;
}): void {
  if (state.getDeploymentType() !== Constants.CLOUD_DEPLOYMENT_TYPE_KEY) {
    throw new FrodoError(
      `The dedicated relationship-schema v2 API for managed type "${type}" requires the Cloud (PingOne Advanced Identity Cloud) deployment. On any other deployment, read/modify/write the whole type definition instead via readSubConfigEntity('managed', '${type}') and importSubConfigEntity('managed', ...) — this is the regular path for relationship properties there too, not just non-relationship ones.`
    );
  }
}

/**
 * Read a single managed object relationship-property definition. Cloud
 * only — see {@link assertCloudDeploymentForSchemaPropertyApi}.
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
    assertCloudDeploymentForSchemaPropertyApi({ type, state });
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
 * definition, leaving the rest of the type's schema untouched. Cloud
 * only — see {@link assertCloudDeploymentForSchemaPropertyApi}. Invalidates
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
    assertCloudDeploymentForSchemaPropertyApi({ type, state });
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
 * the rest of the type's schema untouched. Cloud only — see
 * {@link assertCloudDeploymentForSchemaPropertyApi}. Invalidates the cached
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
    assertCloudDeploymentForSchemaPropertyApi({ type, state });
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
