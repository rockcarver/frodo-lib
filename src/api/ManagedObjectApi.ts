import util from 'util';

import { State } from '../shared/State';
import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import {
  IdObjectSkeletonInterface,
  PagedResult,
  PatchOperationInterface,
} from './ApiTypes';
import { generateIdmApi } from './BaseApi';
import { MANAGED_SYSTEM_OBJECT_TYPES } from './ManagedSystemObjectApi';

const managedObjectSchemaURLTemplate = '%s/schema/managed/%s';
const createManagedObjectURLTemplate = '%s/managed/%s?_action=create';
const managedObjectByIdURLTemplate = '%s/managed/%s/%s';
const queryAllManagedObjectURLTemplate = `%s/managed/%s?_queryFilter=true&_pageSize=%s`;
const queryManagedObjectURLTemplate = `%s/managed/%s?_queryFilter=%s&_pageSize=%s`;
const countManagedObjectURLTemplate = `%s/managed/%s?_queryFilter=%s&_pageSize=0&_totalPagedResultsPolicy=EXACT`;

export const DEFAULT_PAGE_SIZE: number = 1000;

export type ManagedObjectSchemaPropertyType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'relationship'
  | 'object';

export type ManagedObjectSchemaLeafPropertyType = Extract<
  ManagedObjectSchemaPropertyType,
  'string' | 'number' | 'integer' | 'boolean'
>;

export type ManagedObjectSchemaPropertyBase = {
  description?: string;
  title?: string;
  searchable?: boolean;
  userEditable?: boolean;
  viewable?: boolean;
  returnByDefault?: boolean;
};

export interface ManagedObjectSchemaLeafProperty extends ManagedObjectSchemaPropertyBase {
  type: ManagedObjectSchemaLeafPropertyType;
  propName?: string;
  required?: boolean;
}

export interface ManagedObjectSchemaObjectProperty extends ManagedObjectSchemaPropertyBase {
  type: Extract<ManagedObjectSchemaPropertyType, 'object'>;
  order?: string[];
  properties?: Record<string, ManagedObjectSchemaProperty>;
}

export type ManagedObjectSchemaRelationshipResourceQuery = {
  fields: string[];
  queryFilter: string;
  sortKeys: string[];
};

export type ManagedObjectSchemaRelationshipResourceCollectionItem = {
  label: string;
  notify: boolean;
  path: string;
  query: ManagedObjectSchemaRelationshipResourceQuery;
};

export interface ManagedObjectSchemaRelationshipProperty extends ManagedObjectSchemaPropertyBase {
  id: string;
  notifySelf: boolean;
  properties: Record<string, ManagedObjectSchemaProperty>;
  resourceCollection: ManagedObjectSchemaRelationshipResourceCollectionItem[];
  reverseRelationship: boolean;
  reversePropertyName?: string;
  title: string;
  type: Extract<ManagedObjectSchemaPropertyType, 'relationship'>;
  validate: boolean;
}

export interface ManagedObjectSchemaArrayProperty<
  TItem extends ManagedObjectSchemaProperty = ManagedObjectSchemaProperty,
> extends ManagedObjectSchemaPropertyBase {
  type: Extract<ManagedObjectSchemaPropertyType, 'array'>;
  items: TItem;
}

export type ManagedObjectSchemaProperty =
  | ManagedObjectSchemaLeafProperty
  | ManagedObjectSchemaObjectProperty
  | ManagedObjectSchemaRelationshipProperty
  | ManagedObjectSchemaArrayProperty;

export type ManagedObjectSchema<
  TProperties extends Record<string, ManagedObjectSchemaProperty> = Record<
    string,
    ManagedObjectSchemaProperty
  >,
> = {
  $schema: string;
  icon?: string;
  order: Array<keyof TProperties & string>;
  properties: TProperties;
  required: Array<keyof TProperties & string>;
  title: string;
  type: 'object';
  resourceCollection: string;
};

/**
 * Get managed object
 * @param {string} type managed object type, e.g. alpha_user or user
 * @param {State} state library state
 * @returns {Promise<ManagedObjectSchema>} a promise that resolves to an ObjectSkeletonInterface
 */
export async function getManagedObjectSchema({
  type,
  state,
}: {
  type: string;
  state: State;
}): Promise<ManagedObjectSchema> {
  if (MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new Error(
      `${type} is a managed system object type. Use the ManagedSystemObjectApi for this type.`
    );
  }
  const urlString = util.format(
    `${managedObjectSchemaURLTemplate}`,
    getIdmBaseUrl(state),
    type
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).get(
    urlString
  );
  return data as ManagedObjectSchema;
}

/**
 * Get managed object
 * @param {string} type managed object type, e.g. alpha_user or user
 * @param {string} id managed object id
 * @param {string[]} id array of fields to include
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an ObjectSkeletonInterface
 */
export async function getManagedObject({
  type,
  id,
  fields = ['*'],
  state,
}: {
  type: string;
  id: string;
  fields: string[];
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  if (MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new Error(
      `${type} is a managed system object type. Use the ManagedSystemObjectApi for this type.`
    );
  }
  const fieldsParam = `_fields=${fields.join(',')}`;
  const urlString = util.format(
    `${managedObjectByIdURLTemplate}?${fieldsParam}`,
    getIdmBaseUrl(state),
    type,
    id
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).get(
    urlString
  );
  return data as IdObjectSkeletonInterface;
}

/**
 * Create managed object with server-generated id
 * @param {string} type managed object type
 * @param {IdObjectSkeletonInterface} moData managed object data
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a managed object
 */
export async function createManagedObject({
  type,
  moData,
  state,
}: {
  type: string;
  moData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  if (MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new Error(
      `${type} is a managed system object type. Use the ManagedSystemObjectApi for this type.`
    );
  }
  const urlString = util.format(
    createManagedObjectURLTemplate,
    getIdmBaseUrl(state),
    type
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).post(
    urlString,
    moData
  );
  return data;
}

/**
 * Create or update managed object
 * @param {string} id managed object id
 * @param {IdObjectSkeletonInterface} moData managed object
 * @param {boolean} failIfExists fail if exists
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a managed object
 */
export async function putManagedObject({
  type,
  id,
  moData,
  failIfExists = false,
  state,
}: {
  type: string;
  id: string;
  moData: IdObjectSkeletonInterface;
  failIfExists?: boolean;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  if (MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new Error(
      `${type} is a managed system object type. Use the ManagedSystemObjectApi for this type.`
    );
  }
  const urlString = util.format(
    managedObjectByIdURLTemplate,
    getIdmBaseUrl(state),
    type,
    id
  );
  const requestOverride = failIfExists
    ? { headers: { 'If-None-Match': '*' } }
    : {};
  const { data } = await generateIdmApi({ requestOverride, state }).put(
    urlString,
    moData
  );
  return data;
}

/**
 * Partially update a managed object, with an array of operations.
 * @param {string} type managed object type
 * @param {string} id managed object id
 * @param {PatchOperationInterface[]} operations array of operations
 * @param {string} rev revision
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a managed object
 */
export async function patchManagedObject({
  type,
  id,
  operations: operations,
  rev = null,
  state,
}: {
  type: string;
  id: string;
  operations: PatchOperationInterface[];
  rev?: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  if (MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new Error(
      `${type} is a managed system object type. Use the ManagedSystemObjectApi for this type.`
    );
  }
  const urlString = util.format(
    managedObjectByIdURLTemplate,
    getIdmBaseUrl(state),
    type,
    id
  );
  const requestOverride = rev ? { headers: { 'If-Match': rev } } : {};
  const { data } = await generateIdmApi({ requestOverride, state }).patch(
    urlString,
    operations
  );
  return data;
}

/**
 * Query managed object
 * @param {string} type managed object type, e.g. alpha_user or user
 * @param {string} filter CREST search filter
 * @param {string[]} id array of fields to include
 * @param {string} pageCookie paged results cookie
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface[]>} a promise that resolves to an ObjectSkeletonInterface
 */
export async function queryManagedObjects({
  type,
  filter,
  fields = ['*'],
  pageSize = DEFAULT_PAGE_SIZE,
  pageCookie,
  state,
}: {
  type: string;
  filter: string;
  fields?: string[];
  pageSize?: number;
  pageCookie?: string;
  state: State;
}): Promise<PagedResult<IdObjectSkeletonInterface>> {
  if (MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new Error(
      `${type} is a managed system object type. Use the ManagedSystemObjectApi for this type.`
    );
  }
  const fieldsParam = `_fields=${fields.join(',')}`;
  const urlString = util.format(
    pageCookie
      ? `${queryManagedObjectURLTemplate}&${fieldsParam}&_pagedResultsCookie=${encodeURIComponent(
          pageCookie
        )}`
      : `${queryManagedObjectURLTemplate}&${fieldsParam}`,
    getIdmBaseUrl(state),
    type,
    encodeURIComponent(filter),
    pageSize
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).get(
    urlString
  );
  return data as PagedResult<IdObjectSkeletonInterface>;
}

/**
 * Count managed objects matching a filter.
 *
 * @param {string} type managed object type, e.g. alpha_user or user
 * @param {string} filter CREST search filter
 * @param {State} state library state
 * @returns {Promise<number>} a promise that resolves to an exact total when available
 */
export async function countManagedObjects({
  type,
  filter = 'true',
  state,
}: {
  type: string;
  filter?: string;
  state: State;
}): Promise<number> {
  if (MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new Error(
      `${type} is a managed system object type. Use the ManagedSystemObjectApi for this type.`
    );
  }

  const urlString = util.format(
    countManagedObjectURLTemplate,
    getIdmBaseUrl(state),
    type,
    encodeURIComponent(filter)
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).get(
    urlString
  );

  if (
    typeof data?.totalPagedResults === 'number' &&
    data.totalPagedResults >= 0
  ) {
    return data.totalPagedResults;
  }
  if (typeof data?.resultCount === 'number' && data.resultCount >= 0) {
    return data.resultCount;
  }
  return Array.isArray(data?.result) ? data.result.length : 0;
}

/**
 * Query managed objects
 * @param {string} type managed object type
 * @param {string[]} fields fields to retrieve
 * @param {string} pageCookie paged results cookie
 * @returns {Promise<{result: any[]; resultCount: number; pagedResultsCookie: any; totalPagedResultsPolicy: string; totalPagedResults: number; remainingPagedResults: number;}>} a promise that resolves to managed objects of the desired type
 */
export async function queryAllManagedObjectsByType({
  type,
  fields = [],
  pageSize = DEFAULT_PAGE_SIZE,
  pageCookie = undefined,
  state,
}: {
  type: string;
  fields?: string[];
  pageSize?: number;
  pageCookie?: string;
  state: State;
}): Promise<PagedResult<IdObjectSkeletonInterface>> {
  if (MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new Error(
      `${type} is a managed system object type. Use the ManagedSystemObjectApi for this type.`
    );
  }
  const fieldsParam =
    fields.length > 0 ? `&_fields=${fields.join(',')}` : '&_fields=_id';
  const urlTemplate = pageCookie
    ? `${queryAllManagedObjectURLTemplate}${fieldsParam}&_pagedResultsCookie=${encodeURIComponent(
        pageCookie
      )}`
    : `${queryAllManagedObjectURLTemplate}${fieldsParam}`;
  const urlString = util.format(
    urlTemplate,
    getIdmBaseUrl(state),
    type,
    pageSize
  );
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}

/**
 * Delete managed object
 * @param {string} id managed object id
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a managed object
 */
export async function deleteManagedObject({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  if (MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new Error(
      `${type} is a managed system object type. Use the ManagedSystemObjectApi for this type.`
    );
  }
  const urlString = util.format(
    managedObjectByIdURLTemplate,
    getIdmBaseUrl(state),
    type,
    id
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).delete(
    urlString
  );
  return data;
}
