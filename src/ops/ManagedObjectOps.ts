import {
  IdObjectSkeletonInterface,
  PagedResult,
  PatchOperationInterface,
} from '../api/ApiTypes';
import {
  countManagedObjects as _countManagedObjects,
  createManagedObject as _createManagedObject,
  DEFAULT_PAGE_SIZE,
  deleteManagedObject as _deleteManagedObject,
  getManagedObject as _getManagedObject,
  getManagedObjectSchema as _getManagedObjectSchema,
  type ManagedObjectSchema,
  patchManagedObject as _patchManagedObject,
  putManagedObject as _putManagedObject,
  queryAllManagedObjectsByType,
  queryManagedObjects as _queryManagedObjects,
  queryRelatedManagedObjects as _queryRelatedManagedObjects,
} from '../api/ManagedObjectApi';
import { getManagedSystemObject as _getManagedSystemObject } from '../api/ManagedSystemObjectApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { cloneDeep } from '../utils/JsonUtils';
import { FrodoError } from './FrodoError';

export type ManagedObject = {
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
   * Create managed object
   * @param {string} type managed object type, e.g. teammember or alpha_user
   * @param {IdObjectSkeletonInterface} moData managed object data
   * @param {string} id managed object _id
   */
  createManagedObject(
    type: string,
    moData: IdObjectSkeletonInterface,
    id?: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Read managed object
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} id managed object id
   * @param {string[]} fields array of fields to include
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  readManagedObject(
    type: string,
    id: string,
    fields?: string[]
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Read all managed object of the specified type
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string[]} fields array of fields to return
   * @returns {Promise<IdObjectSkeletonInterface[]>} a promise that resolves to an array of IdObjectSkeletonInterfaces
   */
  readManagedObjects(
    type: string,
    fields?: string[]
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Count managed objects of the specified type.
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} filter CREST search filter
   * @returns {Promise<number>} a promise that resolves to the object count
   */
  countManagedObjects(type: string, filter?: string): Promise<number>;
  /**
   * Update managed object
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} id managed object id
   * @param {IdObjectSkeletonInterface} moData managed object data
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  updateManagedObject(
    type: string,
    id: string,
    moData: IdObjectSkeletonInterface
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Partially update managed object through a collection of patch operations.
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} id managed object id
   * @param {PatchOperationInterface[]} operations collection of patch operations to perform on the object
   * @param {string} rev managed object revision
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  updateManagedObjectProperties(
    type: string,
    id: string,
    operations: PatchOperationInterface[],
    rev?: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Partially update multiple managed object through a collection of patch operations.
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} filter CREST search filter
   * @param {PatchOperationInterface[]} operations collection of patch operations to perform on the object
   * @param {string} rev managed object revision
   * @param {number} pageSize page size
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  updateManagedObjectsProperties(
    type: string,
    filter: string,
    operations: PatchOperationInterface[],
    rev?: string,
    pageSize?: number
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Delete managed object
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} id managed object id
   * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IdObjectSkeletonInterface
   */
  deleteManagedObject(
    type: string,
    id: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Delete managed objects by filter
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} filter filter
   * @returns {Promise<number>} a promise that resolves the number of deleted objects
   */
  deleteManagedObjects(type: string, filter: string): Promise<number>;
  /**
   * Query managed objects
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} filter CREST search filter
   * @param {string[]} fields array of fields to return
   * @return {Promise<IdObjectSkeletonInterface[]>} a promise resolving to an array of managed objects
   */
  queryManagedObjects(
    type: string,
    filter?: string,
    fields?: string[],
    pageSize?: number
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Query related managed objects
   * @param {string} type managed object type, e.g. alpha_user or user
   * @param {string} id managed object id
   * @param {string} relationship name of the relationship to query, e.g. "members" for team membership relationships
   * @param {string[]} fields array of fields to return
   * @return {Promise<IdObjectSkeletonInterface[]>} a promise resolving to an array of managed objects
   */
  queryRelatedManagedObjects(
    type: string,
    id: string,
    relationship: string,
    fields?: string[],
    pageSize?: number
  ): Promise<IdObjectSkeletonInterface[]>;
  /**
   * Read the current value of a relationship field directly off a managed
   * object (the forward direction, e.g. an alpha_user's own `manager` or
   * `roles` field). For the reverse direction use queryRelatedManagedObjects.
   * @param {string} type managed object type, e.g. alpha_user
   * @param {string} id managed object id
   * @param {string} field relationship field name, e.g. 'manager' or 'roles'
   * @returns {Promise<unknown>} the field's current value: a single ref object, an array of them, or null/undefined if unset
   */
  readRelationship(type: string, id: string, field: string): Promise<unknown>;
  /**
   * Add one target to a many-valued relationship field without disturbing
   * any existing members.
   * @param {string} type managed object type, e.g. alpha_user
   * @param {string} id managed object id
   * @param {string} field relationship field name, e.g. 'roles'
   * @param {RelationshipTarget} target the object to add, as plain { type, id }
   * @param {string} rev optional optimistic concurrency revision token
   * @returns {Promise<IdObjectSkeletonInterface>} the patched object
   */
  addRelationship(
    type: string,
    id: string,
    field: string,
    target: RelationshipTarget,
    rev?: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Remove one target from a many-valued relationship field without
   * disturbing any other members.
   * @param {string} type managed object type, e.g. alpha_user
   * @param {string} id managed object id
   * @param {string} field relationship field name, e.g. 'roles'
   * @param {RelationshipTarget} target the object to remove, as plain { type, id }
   * @param {string} rev optional optimistic concurrency revision token
   * @returns {Promise<IdObjectSkeletonInterface>} the patched object
   */
  removeRelationship(
    type: string,
    id: string,
    field: string,
    target: RelationshipTarget,
    rev?: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Replace the entire value of a relationship field: a single target (or
   * null to clear it) for a single-valued field like 'manager', or an array
   * of targets for a many-valued field like 'roles'. Replaces the whole
   * field — use addRelationship/removeRelationship to change one member of
   * a many-valued field without disturbing the rest.
   * @param {string} type managed object type, e.g. alpha_user
   * @param {string} id managed object id
   * @param {string} field relationship field name, e.g. 'manager' or 'roles'
   * @param {RelationshipTarget | RelationshipTarget[] | null} target the new value
   * @param {string} rev optional optimistic concurrency revision token
   * @returns {Promise<IdObjectSkeletonInterface>} the patched object
   */
  replaceRelationship(
    type: string,
    id: string,
    field: string,
    target: RelationshipTarget | RelationshipTarget[] | null,
    rev?: string
  ): Promise<IdObjectSkeletonInterface>;
  /**
   * Resolve a managed object's uuid to a human readable username
   * @param {string} type managed object type, e.g. teammember or alpha_user
   * @param {string} id managed object _id
   * @returns {Promise<string>} resolved username or uuid if any error occurs during reslution
   */
  resolveUserName(type: string, id: string): Promise<string>;
  /**
   * Resolve a managed object's uuid to a human readable full name
   * @param {string} type managed object type, e.g. teammember or alpha_user
   * @param {string} id managed object _id
   * @returns {Promise<string>} resolved full name or uuid if any error occurs during reslution
   */
  resolveFullName(type: string, id: string): Promise<string>;
  /**
   * Resolve a DN or bare uuid to a structured identity: what kind of principal it is
   * (managed user, service account, tenant admin, or unknown/unconfirmed) and its
   * display name, without the caller needing to already know its managed object type.
   * @param {string} idOrDn a managed/system object uuid, or a full userId DN (e.g. from an audit log event)
   * @param {string} realm optional realm override; only consulted when idOrDn is a bare uuid (a DN's own realm segment, if present, always wins)
   * @returns {Promise<ResolvedIdentity>} the resolved identity
   */
  resolveIdentity(idOrDn: string, realm?: string): Promise<ResolvedIdentity>;
};

export default (state: State): ManagedObject => {
  return {
    async readManagedObjectSchema(
      type: string,
      refreshCache: boolean = false,
      options: ManagedObjectSchemaOptions = {}
    ): Promise<ManagedObjectSchema> {
      return readManagedObjectSchema({ type, refreshCache, options, state });
    },
    async createManagedObject(
      type: string,
      moData: IdObjectSkeletonInterface,
      id: string = undefined
    ): Promise<IdObjectSkeletonInterface> {
      return createManagedObject({ type, id, moData, state });
    },
    async readManagedObject(
      type: string,
      id: string,
      fields: string[]
    ): Promise<IdObjectSkeletonInterface> {
      return readManagedObject({ type, id, fields, state });
    },
    async readManagedObjects(
      type: string,
      fields: string[]
    ): Promise<IdObjectSkeletonInterface[]> {
      return readManagedObjects({ type, fields, state });
    },
    async countManagedObjects(
      type: string,
      filter: string = 'true'
    ): Promise<number> {
      return countManagedObjects({ type, filter, state });
    },
    async updateManagedObject(
      type: string,
      id: string,
      moData: IdObjectSkeletonInterface
    ): Promise<IdObjectSkeletonInterface> {
      return updateManagedObject({ type, id, moData, state });
    },
    async updateManagedObjectProperties(
      type: string,
      id: string,
      operations: PatchOperationInterface[],
      rev?: string
    ): Promise<IdObjectSkeletonInterface> {
      return updateManagedObjectProperties({
        type,
        id,
        operations,
        rev,
        state,
      });
    },
    async updateManagedObjectsProperties(
      type: string,
      filter: string,
      operations: PatchOperationInterface[],
      rev?: string,
      pageSize: number = DEFAULT_PAGE_SIZE
    ): Promise<IdObjectSkeletonInterface[]> {
      return updateManagedObjectsProperties({
        type,
        filter,
        operations,
        rev,
        pageSize,
        state,
      });
    },
    async deleteManagedObject(
      type: string,
      id: string
    ): Promise<IdObjectSkeletonInterface> {
      return deleteManagedObject({ type, id, state });
    },
    async deleteManagedObjects(type: string, filter: string): Promise<number> {
      return deleteManagedObjects({ type, filter, state });
    },
    async queryManagedObjects(
      type: string,
      filter: string = undefined,
      fields: string[] = [],
      pageSize: number = DEFAULT_PAGE_SIZE
    ): Promise<IdObjectSkeletonInterface[]> {
      return queryManagedObjects({ type, filter, fields, pageSize, state });
    },
    async queryRelatedManagedObjects(
      type: string,
      id: string,
      relationship: string,
      fields: string[] = [],
      pageSize: number = DEFAULT_PAGE_SIZE
    ): Promise<IdObjectSkeletonInterface[]> {
      return queryRelatedManagedObjects({
        type,
        id,
        relationship,
        fields,
        pageSize,
        state,
      });
    },
    async readRelationship(
      type: string,
      id: string,
      field: string
    ): Promise<unknown> {
      return readRelationship({ type, id, field, state });
    },
    async addRelationship(
      type: string,
      id: string,
      field: string,
      target: RelationshipTarget,
      rev?: string
    ): Promise<IdObjectSkeletonInterface> {
      return addRelationship({ type, id, field, target, rev, state });
    },
    async removeRelationship(
      type: string,
      id: string,
      field: string,
      target: RelationshipTarget,
      rev?: string
    ): Promise<IdObjectSkeletonInterface> {
      return removeRelationship({ type, id, field, target, rev, state });
    },
    async replaceRelationship(
      type: string,
      id: string,
      field: string,
      target: RelationshipTarget | RelationshipTarget[] | null,
      rev?: string
    ): Promise<IdObjectSkeletonInterface> {
      return replaceRelationship({ type, id, field, target, rev, state });
    },
    async resolveUserName(type: string, id: string) {
      return resolveUserName({ type, id, state });
    },
    async resolveFullName(type: string, id: string) {
      return resolveFullName({ type, id, state });
    },
    async resolveIdentity(
      idOrDn: string,
      realm?: string
    ): Promise<ResolvedIdentity> {
      return resolveIdentity({ idOrDn, realm, state });
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
      message: `ManagedObjectOps.readManagedObjectSchema: start`,
      state,
    });
    let schema: ManagedObjectSchema;
    if (!refreshCache && ManagedObjectSchemaCache[type]) {
      debugMessage({
        message: `ManagedObjectOps.readManagedObjectSchema: Using cached schema for type "${type}"`,
        state,
      });
      schema = cloneDeep(ManagedObjectSchemaCache[type]);
    } else {
      debugMessage({
        message: `ManagedObjectOps.readManagedObjectSchema: Fetching schema for type "${type}" from API`,
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
            message: `ManagedObjectOps.readManagedObjectSchema: Excluding virtual property "${prop}" from schema for type "${type}"`,
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
            message: `ManagedObjectOps.readManagedObjectSchema: Found relationship property "${prop}" with resource path "${resourcePath}" in schema for type "${type}"`,
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
              message: `ManagedObjectOps.readManagedObjectSchema: Excluding relationship property "${prop}" from schema for type "${type}"`,
              state,
            });
            delete schema.properties[prop];
          }
        }
      }
    }
    debugMessage({
      message: `ManagedObjectOps.readManagedObjectSchema: end`,
      state,
    });
    return schema;
  } catch (error) {
    throw new FrodoError(`Error reading managed ${type} schema`, error);
  }
}

export async function createManagedObject({
  type,
  id,
  moData,
  state,
}: {
  type: string;
  id?: string;
  moData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    if (id)
      return _putManagedObject({ type, id, moData, failIfExists: true, state });
    return _createManagedObject({ type, moData, state });
  } catch (error) {
    throw new FrodoError(
      `Error creating managed ${type} object${id ? ' (' + id + ')' : ''}`,
      error
    );
  }
}

export async function readManagedObject({
  type,
  id,
  fields,
  state,
}: {
  type: string;
  id: string;
  fields: string[];
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _getManagedObject({ type, id, fields, state });
  } catch (error) {
    throw new FrodoError(`Error reading managed ${type} object`, error);
  }
}

export async function readManagedObjects({
  type,
  fields,
  state,
}: {
  type: string;
  fields: string[];
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  try {
    let managedObjects: IdObjectSkeletonInterface[] = [];
    let result = {
      result: [],
      resultCount: 0,
      pagedResultsCookie: null,
      totalPagedResultsPolicy: 'NONE',
      totalPagedResults: -1,
      remainingPagedResults: -1,
    };
    do {
      result = await queryAllManagedObjectsByType({
        type,
        fields,
        pageCookie: result.pagedResultsCookie,
        state,
      });
      managedObjects = managedObjects.concat(result.result);
    } while (result.pagedResultsCookie);
    return managedObjects;
  } catch (error) {
    throw new FrodoError(`Error reading managed ${type} objects`, error);
  }
}

export async function countManagedObjects({
  type,
  filter = 'true',
  state,
}: {
  type: string;
  filter?: string;
  state: State;
}): Promise<number> {
  try {
    return _countManagedObjects({ type, filter, state });
  } catch (error) {
    throw new FrodoError(
      `Error counting managed ${type} objects matching filter "${filter}"`,
      error
    );
  }
}

export async function updateManagedObject({
  type,
  id,
  moData,
  state,
}: {
  type: string;
  id: string;
  moData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _putManagedObject({ type, id, moData, state });
  } catch (error) {
    throw new FrodoError(
      `Error updating managed ${type} object (${id})`,
      error
    );
  }
}

export async function updateManagedObjectProperties({
  type,
  id,
  operations,
  rev = null,
  state,
}: {
  type: string;
  id: string;
  operations: PatchOperationInterface[];
  rev?: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _patchManagedObject({ type, id, operations, rev, state });
  } catch (error) {
    throw new FrodoError(
      `Error updating managed ${type} object properties (${id})`,
      error
    );
  }
}

export async function updateManagedObjectsProperties({
  type,
  filter,
  operations,
  rev = null,
  pageSize = DEFAULT_PAGE_SIZE,
  state,
}: {
  type: string;
  filter: string;
  operations: PatchOperationInterface[];
  rev?: string;
  pageSize?: number;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  const result: IdObjectSkeletonInterface[] = [];
  const errors = [];
  let page: PagedResult<IdObjectSkeletonInterface> = {
    result: [],
    resultCount: 0,
    pagedResultsCookie: null,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  };
  do {
    try {
      page = await _queryManagedObjects({
        type,
        filter,
        fields: [],
        pageSize,
        pageCookie: page.pagedResultsCookie,
        state,
      });
      for (const obj of page.result) {
        try {
          result.push(
            await _patchManagedObject({
              type,
              id: obj._id,
              operations,
              rev,
              state,
            })
          );
        } catch (error) {
          errors.push(error);
        }
      }
    } catch (error) {
      errors.push(error);
    }
  } while (page.pagedResultsCookie);
  if (errors.length > 0) {
    throw new FrodoError(
      `Error patching "${type}" objects matching filter "${filter}"`,
      errors
    );
  }
  return result;
}

export async function deleteManagedObject({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  try {
    return _deleteManagedObject({ type, id, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting managed ${type} object (${id})`,
      error
    );
  }
}

export async function deleteManagedObjects({
  type,
  filter,
  state,
}: {
  type: string;
  filter: string;
  state: State;
}): Promise<number> {
  let count = 0;
  const errors = [];
  let result: PagedResult<IdObjectSkeletonInterface> = {
    result: [],
    resultCount: 0,
    pagedResultsCookie: null,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  };
  do {
    try {
      result = await _queryManagedObjects({
        type,
        filter,
        fields: ['_id'],
        pageCookie: result.pagedResultsCookie,
        state,
      });
      for (const obj of result.result) {
        await deleteManagedObject({ type, id: obj._id, state });
        count++;
      }
    } catch (error) {
      errors.push(error);
    }
  } while (result.pagedResultsCookie);
  if (errors.length > 0) {
    throw new FrodoError(
      `Error deleting "${type}" objects matching filter "${filter}". Successfully deleted ${count} objects.`,
      errors
    );
  }
  return count;
}

export async function queryManagedObjects({
  type,
  filter = 'true',
  fields = ['*'],
  pageSize = DEFAULT_PAGE_SIZE,
  state,
}: {
  type: string;
  filter?: string;
  fields?: string[];
  pageSize?: number;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  const result: IdObjectSkeletonInterface[] = [];
  const errors = [];
  let page: PagedResult<IdObjectSkeletonInterface> = {
    result: [],
    resultCount: 0,
    pagedResultsCookie: null,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  };
  do {
    try {
      page = await _queryManagedObjects({
        type,
        filter,
        fields,
        pageSize,
        pageCookie: page.pagedResultsCookie,
        state,
      });
      result.push(...page.result);
    } catch (error) {
      errors.push(error);
    }
  } while (page.pagedResultsCookie);
  if (errors.length > 0) {
    throw new FrodoError(
      `Error querying "${type}" objects matching filter "${filter}"`,
      errors
    );
  }
  return result;
}

/**
 * Query related managed object
 * @param {object} params structured and named parameters
 * @param {string} params.type managed system object type, e.g. svcacct or teammember
 * @param {string} params.id managed system object id
 * @param {string} params.relationship relationship name
 * @param {string[]} params.fields array of fields to include
 * @param {string} params.pageCookie paged results cookie
 * @param {State} params.state library state
 * @returns {Promise<IdObjectSkeletonInterface[]>} a promise that resolves to an array of managed system objects
 */
export async function queryRelatedManagedObjects({
  type,
  id,
  relationship,
  fields = ['*'],
  pageSize = DEFAULT_PAGE_SIZE,
  state,
}: {
  type: string;
  id: string;
  relationship: string;
  fields?: string[];
  pageSize?: number;
  state: State;
}): Promise<IdObjectSkeletonInterface[]> {
  const result: IdObjectSkeletonInterface[] = [];
  const errors = [];
  let page: PagedResult<IdObjectSkeletonInterface> = {
    result: [],
    resultCount: 0,
    pagedResultsCookie: null,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  };
  do {
    try {
      page = await _queryRelatedManagedObjects({
        type,
        id,
        relationship,
        fields,
        pageSize,
        pageCookie: page.pagedResultsCookie,
        state,
      });
      result.push(...page.result);
    } catch (error) {
      errors.push(error);
    }
  } while (page.pagedResultsCookie);
  if (errors.length > 0) {
    throw new FrodoError(
      `Error querying relationship "${relationship}" for "${type}" with id "${id}"`,
      errors
    );
  }
  return result;
}

/** A relationship target: the managed object type and id it points to, without any of the underlying _ref plumbing. */
export type RelationshipTarget = {
  type: string;
  id: string;
};

/**
 * Builds the underlying { _ref, _refResourceCollection, _refResourceId }
 * shape IDM expects for a relationship reference in a "replace" operation,
 * so callers of replaceRelationship only ever need to think in plain
 * { type, id } terms.
 */
function buildRelationshipRefValue({ type, id }: RelationshipTarget): {
  _ref: string;
  _refResourceCollection: string;
  _refResourceId: string;
} {
  return {
    _ref: `managed/${type}/${id}`,
    _refResourceCollection: `managed/${type}`,
    _refResourceId: id,
  };
}

/**
 * Builds the minimal { _ref, _refProperties } shape an "add" operation
 * needs — captured directly from a real request AIC's own admin UI sends
 * for "add a role to this user", and verified live to work exactly as
 * shown. Deliberately not reusing buildRelationshipRefValue's shape:
 * "add" and "replace" turned out to want different value shapes, not
 * variations of the same one.
 */
function buildAddRelationshipValue({ type, id }: RelationshipTarget): {
  _ref: string;
  _refProperties: Record<string, never>;
} {
  return { _ref: `managed/${type}/${id}`, _refProperties: {} };
}

/**
 * Reads the current value of a relationship field directly off a managed
 * object — the forward direction (e.g. an alpha_user's own `manager` or
 * `roles` field). For the reverse direction (e.g. an alpha_role's members),
 * use queryRelatedManagedObjects instead; reverse relationships aren't
 * stored as a field on the object at all, so there's nothing here to read.
 */
export async function readRelationship({
  type,
  id,
  field,
  state,
}: {
  type: string;
  id: string;
  field: string;
  state: State;
}): Promise<unknown> {
  const object = await readManagedObject({ type, id, fields: [field], state });
  return object[field];
}

/**
 * Adds one target to a many-valued relationship field without disturbing
 * any existing members — the safe way to "add a member" (use
 * replaceRelationship instead only when you actually mean to overwrite the
 * whole field).
 *
 * @remarks
 * Uses the exact request shape captured from AIC's own admin UI performing
 * this action and verified live: field addressed as `/field/-` (JSON
 * Pointer append-to-array syntax, RFC 6902) with a bare (not array-wrapped)
 * { _ref, _refProperties: {} } value — not the field's own resourceCollection
 * fields.
 */
export async function addRelationship({
  type,
  id,
  field,
  target,
  rev,
  state,
}: {
  type: string;
  id: string;
  field: string;
  target: RelationshipTarget;
  rev?: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  return updateManagedObjectProperties({
    type,
    id,
    operations: [
      {
        operation: 'add',
        field: `/${field}/-`,
        value: buildAddRelationshipValue(target),
      },
    ],
    rev,
    state,
  });
}

/** True if a stored relationship element refers to the given { type, id } target. */
function matchesRelationshipTarget(
  item: unknown,
  target: RelationshipTarget
): boolean {
  return (
    typeof item === 'object' &&
    item !== null &&
    (item as Record<string, unknown>)._refResourceCollection ===
      `managed/${target.type}` &&
    (item as Record<string, unknown>)._refResourceId === target.id
  );
}

/**
 * Removes one target from a many-valued relationship field without
 * disturbing any other members.
 *
 * @remarks
 * Reads the field's current value first to find the exact stored element,
 * then removes that exact object (not array-wrapped) — the request shape
 * captured directly from AIC's own admin UI performing this action and
 * verified live. Two things this gets exactly right that a naively-built
 * request gets wrong: the value must be the object matching what's
 * actually stored, _refProperties (an internal id/rev IDM itself generates
 * for the relationship, distinct from the referenced object's own id)
 * included — a freshly-built ref without it doesn't match and the request
 * is silently ignored; and unlike "add" (which needs its value array-
 * wrapped), "remove" needs a bare object, not an array containing one.
 * Throws if the target isn't currently a member, rather than silently
 * doing nothing the way a raw PATCH with a non-matching value would.
 */
export async function removeRelationship({
  type,
  id,
  field,
  target,
  rev,
  state,
}: {
  type: string;
  id: string;
  field: string;
  target: RelationshipTarget;
  rev?: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const currentValue = await readRelationship({ type, id, field, state });
  const currentArray = Array.isArray(currentValue)
    ? currentValue
    : currentValue
      ? [currentValue]
      : [];
  const matchingElement = currentArray.find((item) =>
    matchesRelationshipTarget(item, target)
  );
  if (!matchingElement) {
    throw new FrodoError(
      `Error removing relationship: ${target.type}/${target.id} is not currently a member of ${type}/${id}'s "${field}" field.`
    );
  }
  return updateManagedObjectProperties({
    type,
    id,
    operations: [
      {
        operation: 'remove',
        field: `/${field}`,
        value: matchingElement,
      },
    ],
    rev,
    state,
  });
}

/**
 * Replaces the entire value of a relationship field: a single target (or
 * null to clear it) for a single-valued field like 'manager', or an array
 * of targets for a many-valued field like 'roles' — replacing the whole
 * array, not adding to it. Use addRelationship/removeRelationship instead
 * when you only want to change one member of a many-valued field.
 */
export async function replaceRelationship({
  type,
  id,
  field,
  target,
  rev,
  state,
}: {
  type: string;
  id: string;
  field: string;
  target: RelationshipTarget | RelationshipTarget[] | null;
  rev?: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const value =
    target === null
      ? null
      : Array.isArray(target)
        ? target.map(buildRelationshipRefValue)
        : buildRelationshipRefValue(target);
  return updateManagedObjectProperties({
    type,
    id,
    operations: [
      {
        operation: 'replace',
        field: `/${field}`,
        value,
      },
    ],
    rev,
    state,
  });
}

export async function resolveUserName({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}): Promise<string> {
  try {
    return (
      await _getManagedObject({
        type,
        id,
        fields: ['userName'],
        state,
      })
    ).userName as string;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  }
  return id;
}

export async function resolveFullName({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}): Promise<string> {
  try {
    const managedObject = await _getManagedObject({
      type,
      id,
      fields: ['givenName', 'sn'],
      state,
    });
    return `${managedObject.givenName} ${managedObject.sn}`;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore
  }
  return id;
}

/** What kind of principal a resolved identity turned out to be. */
export type ResolvedIdentityKind =
  | 'user'
  | 'service'
  | 'admin'
  | 'admin-unconfirmed'
  | 'unknown';

export type ResolvedIdentity = {
  /** The uuid that was resolved (extracted from the DN, if one was given). */
  id: string;
  kind: ResolvedIdentityKind;
  /** Realm the identity belongs to. Only set for kind 'user'. */
  realm?: string;
  username?: string;
  displayName?: string;
  /** The managed/system object type the identity was actually found under, e.g. 'alpha_user', 'svcacct', 'teammember'. */
  resolvedVia?: string;
  /** Present for 'admin-unconfirmed'/'unknown': why a definitive kind couldn't be determined. */
  note?: string;
};

const DN_UUID_REGEX = /^id=([^,]+),/;
const DN_REALM_REGEX = /,o=([^,]+),/;

/**
 * Extracts the uuid and, if present, the realm segment from a userId-style DN
 * (e.g. "id=<uuid>,ou=user,o=<realm>,ou=services,ou=am-config"). A DN with no
 * o=<realm> segment (e.g. "id=<uuid>,ou=user,ou=am-config") is AM-internal —
 * either a service account or tenant admin, never a realm-scoped managed user.
 * @see the DN-realm-qualification heuristic established across this session's
 *   audit-log identity resolution work.
 */
function parseIdentityDn(
  idOrDn: string
): { uuid: string; realm?: string } | undefined {
  const uuidMatch = idOrDn.match(DN_UUID_REGEX);
  if (!uuidMatch) return undefined;
  const realmMatch = idOrDn.match(DN_REALM_REGEX);
  return { uuid: uuidMatch[1], realm: realmMatch ? realmMatch[1] : undefined };
}

async function tryReadManagedSystemObject({
  type,
  id,
  fields,
  state,
}: {
  type: string;
  id: string;
  fields: string[];
  state: State;
}): Promise<
  | { status: 'found'; object: IdObjectSkeletonInterface }
  | { status: 'not-found' }
  | { status: 'forbidden' }
> {
  try {
    const object = await _getManagedSystemObject({ type, id, fields, state });
    return { status: 'found', object };
  } catch (error) {
    if (error?.['response']?.status === 403) {
      return { status: 'forbidden' };
    }
    return { status: 'not-found' };
  }
}

/**
 * Resolves a DN or bare uuid to a structured identity, without the caller
 * needing to already know its managed object type. Replaces the older
 * resolvePerpetratorUuid, which returned an opaque formatted string, hardcoded
 * 'alpha_user'/'bravo_user' as the only realms, and couldn't distinguish "not
 * found" from "found but the calling credential lacks visibility" — a real
 * distinction: a service-account-authenticated session can read svcacct
 * objects but gets a 403, not a 404, on teammember.
 */
export async function resolveIdentity({
  idOrDn,
  realm,
  state,
}: {
  idOrDn: string;
  realm?: string;
  state: State;
}): Promise<ResolvedIdentity> {
  const parsedDn = parseIdentityDn(idOrDn);
  const uuid = parsedDn?.uuid ?? idOrDn;
  const effectiveRealm = parsedDn?.realm ?? realm;
  const isCloud =
    state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
  const isCloudOrForgeops =
    isCloud ||
    state.getDeploymentType() === Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;

  // A realm-qualified DN (or an explicit realm override) means this is a
  // genuine realm-scoped managed user — resolve it directly, no need to
  // consider service-account/admin at all. Only cloud partitions managed
  // users per realm (alpha_user, bravo_user, ...) — verified live this
  // session against a real forgeops tenant, whose IDM managed object
  // families are a flat, deployment-wide 'user' with no realm prefix at
  // all, same as classic.
  if (effectiveRealm) {
    const userType = isCloud ? `${effectiveRealm}_user` : 'user';
    try {
      const user = await _getManagedObject({
        type: userType,
        id: uuid,
        fields: ['givenName', 'sn', 'userName'],
        state,
      });
      return {
        id: uuid,
        kind: 'user',
        realm: effectiveRealm,
        username: user.userName as string,
        displayName: `${user.givenName ?? ''} ${user.sn ?? ''}`.trim(),
        resolvedVia: userType,
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return {
        id: uuid,
        kind: 'unknown',
        note: `Not found as ${userType} in realm ${effectiveRealm}.`,
      };
    }
  }

  // No realm segment: AM-internal identity. Cloud/forgeops distinguishes
  // service account from tenant admin via two managed system object types;
  // classic has neither concept, so an unqualified DN there is unresolvable.
  if (!isCloudOrForgeops) {
    return {
      id: uuid,
      kind: 'unknown',
      note: 'No realm segment in the DN and this deployment type has no service-account/tenant-admin managed object types to check.',
    };
  }

  const svcacct = await tryReadManagedSystemObject({
    type: 'svcacct',
    id: uuid,
    fields: ['name', 'description'],
    state,
  });
  if (svcacct.status === 'found') {
    return {
      id: uuid,
      kind: 'service',
      username: svcacct.object.name as string,
      displayName: svcacct.object.description as string,
      resolvedVia: 'svcacct',
    };
  }

  const teammember = await tryReadManagedSystemObject({
    type: 'teammember',
    id: uuid,
    fields: ['givenName', 'sn', 'userName'],
    state,
  });
  if (teammember.status === 'found') {
    return {
      id: uuid,
      kind: 'admin',
      username: teammember.object.userName as string,
      displayName:
        `${teammember.object.givenName ?? ''} ${teammember.object.sn ?? ''}`.trim(),
      resolvedVia: 'teammember',
    };
  }

  if (teammember.status === 'forbidden') {
    return {
      id: uuid,
      kind: 'admin-unconfirmed',
      note: 'Not a service account, and the calling credential lacks permission to check teammember directly (403, not 404) — service accounts typically cannot read teammember. By elimination this is presumed to be a tenant admin, but it could not be independently confirmed with this credential.',
    };
  }

  if (svcacct.status === 'forbidden') {
    return {
      id: uuid,
      kind: 'unknown',
      note: 'Not a tenant admin (teammember lookup succeeded and found nothing), but the calling credential lacks permission to check svcacct directly (403, not 404), so service-account status could not be confirmed either.',
    };
  }

  return {
    id: uuid,
    kind: 'unknown',
    note: 'No realm segment in the DN, and not found as svcacct or teammember — an AM-internal identity of an unrecognized kind (e.g. an agent).',
  };
}
