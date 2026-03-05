import util from 'util';

import { State } from '../shared/State';
import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import {
  IdObjectSkeletonInterface,
  PagedResult,
  PatchOperationInterface,
} from './ApiTypes';
import { generateIdmSystemApi } from './BaseApi';
import { FrodoError } from '../ops/FrodoError';

const createManagedObjectURLTemplate = '%s/managed/%s?_action=create';
const managedObjectByIdURLTemplate = '%s/managed/%s/%s';
const queryAllManagedObjectURLTemplate = `%s/managed/%s?_queryFilter=true&_pageSize=%s`;
const queryManagedObjectURLTemplate = `%s/managed/%s?_queryFilter=%s&_pageSize=%s`;

export const DEFAULT_PAGE_SIZE: number = 1000;

export const MANAGED_SYSTEM_OBJECT_TYPES = ['svcacct', 'teammember'];

/**
 * Get managed system object
 * @param {string} type managed system object type, e.g. svcacct or teammember
 * @param {string} id managed system object id
 * @param {string[]} id array of fields to include
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an ObjectSkeletonInterface
 */
export async function getManagedSystemObject({
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
  if (!MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new FrodoError(
      `Unsupported managed system object type: ${type}. Supported types are: ${MANAGED_SYSTEM_OBJECT_TYPES.join(
        ', '
      )}`
    );
  }
  const fieldsParam = `_fields=${fields.join(',')}`;
  const urlString = util.format(
    `${managedObjectByIdURLTemplate}?${fieldsParam}`,
    getIdmBaseUrl(state),
    type,
    id
  );
  const { data } = await generateIdmSystemApi({
    requestOverride: {},
    state,
  }).get(urlString);
  return data as IdObjectSkeletonInterface;
}

/**
 * Create managed system object with server-generated id
 * @param {string} type managed system object type
 * @param {IdObjectSkeletonInterface} moData managed system object data
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a managed system object
 */
export async function createManagedSystemObject({
  type,
  moData,
  state,
}: {
  type: string;
  moData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  if (!MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new FrodoError(
      `Unsupported managed system object type: ${type}. Supported types are: ${MANAGED_SYSTEM_OBJECT_TYPES.join(
        ', '
      )}`
    );
  }
  const urlString = util.format(
    createManagedObjectURLTemplate,
    getIdmBaseUrl(state),
    type
  );
  const { data } = await generateIdmSystemApi({
    requestOverride: {},
    state,
  }).post(urlString, moData);
  return data;
}

/**
 * Create or update managed system object
 * @param {string} id managed system object id
 * @param {IdObjectSkeletonInterface} moData managed system object
 * @param {boolean} failIfExists fail if exists
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a managed system object
 */
export async function putManagedSystemObject({
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
  if (!MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new FrodoError(
      `Unsupported managed system object type: ${type}. Supported types are: ${MANAGED_SYSTEM_OBJECT_TYPES.join(
        ', '
      )}`
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
  const { data } = await generateIdmSystemApi({ requestOverride, state }).put(
    urlString,
    moData
  );
  return data;
}

/**
 * Partially update a managed system object, with an array of operations.
 * @param {string} type managed system object type
 * @param {string} id managed system object id
 * @param {PatchOperationInterface[]} operations array of operations
 * @param {string} rev revision
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a managed system object
 */
export async function patchManagedSystemObject({
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
  if (!MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new FrodoError(
      `Unsupported managed system object type: ${type}. Supported types are: ${MANAGED_SYSTEM_OBJECT_TYPES.join(
        ', '
      )}`
    );
  }
  const urlString = util.format(
    managedObjectByIdURLTemplate,
    getIdmBaseUrl(state),
    type,
    id
  );
  const requestOverride = rev ? { headers: { 'If-Match': rev } } : {};
  const { data } = await generateIdmSystemApi({ requestOverride, state }).patch(
    urlString,
    operations
  );
  return data;
}

/**
 * Query managed system object
 * @param {string} type managed system object type, e.g. alpha_user or user
 * @param {string} filter CREST search filter
 * @param {string[]} id array of fields to include
 * @param {string} pageCookie paged results cookie
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface[]>} a promise that resolves to an array of managed system objects
 */
export async function queryManagedSystemObjects({
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
  if (!MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new FrodoError(
      `Unsupported managed system object type: ${type}. Supported types are: ${MANAGED_SYSTEM_OBJECT_TYPES.join(
        ', '
      )}`
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
  const { data } = await generateIdmSystemApi({
    requestOverride: {},
    state,
  }).get(urlString);
  return data as PagedResult<IdObjectSkeletonInterface>;
}

/**
 * Query managed system objects by type
 * @param {string} type managed system object type
 * @param {string[]} fields fields to retrieve
 * @param {string} pageCookie paged results cookie
 * @returns {Promise<{result: any[]; resultCount: number; pagedResultsCookie: any; totalPagedResultsPolicy: string; totalPagedResults: number; remainingPagedResults: number;}>} a promise that resolves to managed system objects of the desired type
 */
export async function queryAllManagedSystemObjectsByType({
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
  if (!MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new FrodoError(
      `Unsupported managed system object type: ${type}. Supported types are: ${MANAGED_SYSTEM_OBJECT_TYPES.join(
        ', '
      )}`
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
  const { data } = await generateIdmSystemApi({ state }).get(urlString);
  return data;
}

/**
 * Delete managed system object
 * @param {string} type managed system object type, e.g. alpha_user or user
 * @param {string} id managed system object id
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a managed system object
 */
export async function deleteManagedSystemObject({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  if (!MANAGED_SYSTEM_OBJECT_TYPES.includes(type)) {
    throw new FrodoError(
      `Unsupported managed system object type: ${type}. Supported types are: ${MANAGED_SYSTEM_OBJECT_TYPES.join(
        ', '
      )}`
    );
  }
  const urlString = util.format(
    managedObjectByIdURLTemplate,
    getIdmBaseUrl(state),
    type,
    id
  );
  const { data } = await generateIdmSystemApi({
    requestOverride: {},
    state,
  }).delete(urlString);
  return data;
}
