import util from 'util';

import { State } from '../shared/State';
import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import { IdObjectSkeletonInterface, PagedResult } from './ApiTypes';
import { generateIdmApi } from './BaseApi';

const createManagedObjectURLTemplate = '%s/managed/%s?_action=create';
const managedObjectByIdURLTemplate = '%s/managed/%s/%s';
const queryAllManagedObjectURLTemplate = `%s/managed/%s?_queryFilter=true&_pageSize=%s`;
const queryManagedObjectURLTemplate = `%s/managed/%s?_queryFilter=%s&_pageSize=%s`;

export const DEFAULT_PAGE_SIZE: number = 1000;

/**
 * See {@link https://backstage.forgerock.com/docs/idm/7/rest-api-reference/sec-about-crest.html#about-crest-patch}.
 */
export interface ManagedObjectPatchOperationInterface {
  operation:
    | 'add'
    | 'copy'
    | 'increment'
    | 'move'
    | 'remove'
    | 'replace'
    | 'transform';
  field: string;
  value?: any;
  from?: string;
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
 * @param {string} moType managed object type
 * @param {IdObjectSkeletonInterface} moData managed object data
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a managed object
 */
export async function createManagedObject({
  moType,
  moData,
  state,
}: {
  moType: string;
  moData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    createManagedObjectURLTemplate,
    getIdmBaseUrl(state),
    moType
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
 * @param {ManagedObjectPatchOperationInterface[]} operations array of operations
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
  operations: ManagedObjectPatchOperationInterface[];
  rev?: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
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
