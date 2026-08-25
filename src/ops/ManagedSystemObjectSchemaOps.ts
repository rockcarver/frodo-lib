import { getManagedSystemObjectSchema as _getManagedSystemObjectSchema } from '../api/ManagedSystemObjectApi';
import { type ManagedObjectSchema } from '../api/ManagedObjectApi';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { cloneDeep } from '../utils/JsonUtils';
import { FrodoError } from './FrodoError';
import { type ManagedObjectSchemaOptions } from './ManagedObjectSchemaOps';

export type { ManagedObjectSchemaOptions } from './ManagedObjectSchemaOps';

/**
 * Read-only counterpart to `ManagedObjectSchemaOps.ts`, for managed
 * *system* object types (`svcacct`, `teammember`) instead of regular/custom
 * managed object types. Split out from `ManagedSystemObjectOps.ts` the same
 * way `ManagedObjectSchemaOps.ts` was split from `ManagedObjectOps.ts`, to
 * keep every managed-system-object capability under the same admin-only
 * risk posture (see `CapabilityMetadata.ts`'s `idm.managedSystem.*`
 * entries, all explicitly `riskClass: 'critical'`).
 *
 * There is deliberately no write capability here yet. Regular managed
 * objects have a confirmed, documented per-property mutation path (IDM's
 * dedicated v2 relationship-schema API — see `ManagedObjectSchemaOps.ts`'s
 * header comment), but `svcacct`/`teammember` are fixed, Ping-defined
 * system types; whether that same v2 API accepts a managed-system-object
 * type at all has not been verified against a live tenant. Add
 * `updateManagedSystemObjectSchemaProperty` /
 * `removeManagedSystemObjectSchemaProperty` here only after confirming that
 * live, not by assuming symmetry with the regular-object case.
 */
export type ManagedSystemObjectSchemaOps = {
  /**
   * Read managed system object schema
   * @param {string} type managed system object type, e.g. svcacct or teammember
   * @param {boolean} refreshCache whether to refresh the schema cache for the specified type
   * @param {ManagedObjectSchemaOptions} options options to filter the returned schema
   * @returns {Promise<ManagedObjectSchema>} a promise that resolves to a managed system object schema
   */
  readManagedSystemObjectSchema(
    type: string,
    refreshCache?: boolean,
    options?: ManagedObjectSchemaOptions
  ): Promise<ManagedObjectSchema>;
};

export default (state: State): ManagedSystemObjectSchemaOps => {
  return {
    async readManagedSystemObjectSchema(
      type: string,
      refreshCache: boolean = false,
      options: ManagedObjectSchemaOptions = {}
    ): Promise<ManagedObjectSchema> {
      return readManagedSystemObjectSchema({
        type,
        refreshCache,
        options,
        state,
      });
    },
  };
};

const ManagedSystemObjectSchemaCache: Record<string, ManagedObjectSchema> = {};

export async function readManagedSystemObjectSchema({
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
      message: `ManagedSystemObjectSchemaOps.readManagedSystemObjectSchema: start`,
      state,
    });
    let schema: ManagedObjectSchema;
    if (!refreshCache && ManagedSystemObjectSchemaCache[type]) {
      debugMessage({
        message: `ManagedSystemObjectSchemaOps.readManagedSystemObjectSchema: Using cached schema for type "${type}"`,
        state,
      });
      schema = cloneDeep(ManagedSystemObjectSchemaCache[type]);
    } else {
      debugMessage({
        message: `ManagedSystemObjectSchemaOps.readManagedSystemObjectSchema: Fetching schema for type "${type}" from API`,
        state,
      });
      schema = await _getManagedSystemObjectSchema({ type, state });
      ManagedSystemObjectSchemaCache[type] = cloneDeep(schema);
    }
    // Apply schema options
    if (options.excludeVirtual) {
      for (const prop in schema.properties) {
        if (schema.properties[prop]['isVirtual']) {
          debugMessage({
            message: `ManagedSystemObjectSchemaOps.readManagedSystemObjectSchema: Excluding virtual property "${prop}" from schema for type "${type}"`,
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
          const resourcePath =
            schema.properties[prop]['resourceCollection']?.[0]?.['path'];
          debugMessage({
            message: `ManagedSystemObjectSchemaOps.readManagedSystemObjectSchema: Found relationship property "${prop}" with resource path "${resourcePath}" in schema for type "${type}"`,
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
              message: `ManagedSystemObjectSchemaOps.readManagedSystemObjectSchema: Excluding relationship property "${prop}" from schema for type "${type}"`,
              state,
            });
            delete schema.properties[prop];
          }
        }
      }
    }
    debugMessage({
      message: `ManagedSystemObjectSchemaOps.readManagedSystemObjectSchema: end`,
      state,
    });
    return schema;
  } catch (error) {
    throw new FrodoError(`Error reading managed ${type} schema`, error);
  }
}
