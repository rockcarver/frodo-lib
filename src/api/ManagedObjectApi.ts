import util from 'util';

import { State } from '../shared/State';
import { getHostBaseUrl } from '../utils/ForgeRockUtils';
import { IdObjectSkeletonInterface, PagedResult } from './ApiTypes';
import { generateIdmApi } from './BaseApi';

const createManagedObjectURLTemplate = '%s/openidm/managed/%s?_action=create';
const managedObjectByIdURLTemplate = '%s/openidm/managed/%s/%s';
const managedObjectQueryAllURLTemplate = `%s/openidm/managed/%s?_queryFilter=true&_pageSize=10000`;
const findManagedObjectURLTemplate = `%s/openidm/managed/%s?_queryFilter=%s&_pageSize=10000`;

/**
 * See {@link https://backstage.forgerock.com/docs/idm/7/rest-api-reference/sec-about-crest.html#about-crest-patch}.
 */
export interface ManagedObjectPatchOperationInterface {
  operation: string;
  field: string;
  value: string | Array<string>;
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
    getHostBaseUrl(state.getHost()),
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
    getHostBaseUrl(state.getHost()),
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
    getHostBaseUrl(state.getHost()),
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
 * Partially update a managed object, with a collection of operations.
 * @param {string} type managed object type, e.g. alpha_user or user
 * @param {string} id managed object id
 * @param {ManagedObjectPatchOperationInterface[]} operations collection of patch operations to perform on the object
 * @param state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to the updated managed object
 */
export async function patchManagedObject({
  type,
  id,
  operations,
  state,
}: {
  type: string;
  id: string;
  operations: ManagedObjectPatchOperationInterface[];
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    managedObjectByIdURLTemplate,
    getHostBaseUrl(state.getHost()),
    type,
    id
  );

  const { data } = await generateIdmApi({ state }).patch(urlString, operations);
  return data;
}

/**
 * Query managed object
 * @param {string} type managed object type, e.g. alpha_user or user
 * @param {string} filter CREST search filter
 * @param {string[]} id array of fields to include
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface[]>} a promise that resolves to an ObjectSkeletonInterface
 */
export async function queryManagedObjects({
  type,
  filter,
  fields = ['*'],
  state,
}: {
  type: string;
  filter: string;
  fields: string[];
  state: State;
}): Promise<PagedResult<IdObjectSkeletonInterface>> {
  const fieldsParam = `_fields=${fields.join(',')}`;
  const urlString = util.format(
    `${findManagedObjectURLTemplate}&${fieldsParam}`,
    getHostBaseUrl(state.getHost()),
    type,
    filter
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
  pageCookie = undefined,
  state,
}: {
  type: string;
  fields?: string[];
  pageCookie?: string;
  state: State;
}): Promise<PagedResult<IdObjectSkeletonInterface>> {
  const fieldsParam =
    fields.length > 0 ? `&_fields=${fields.join(',')}` : '&_fields=_id';
  const urlTemplate = pageCookie
    ? `${managedObjectQueryAllURLTemplate}${fieldsParam}&_pagedResultsCookie=${encodeURIComponent(
        pageCookie
      )}`
    : `${managedObjectQueryAllURLTemplate}${fieldsParam}`;
  const urlString = util.format(
    urlTemplate,
    getHostBaseUrl(state.getHost()),
    type
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
    getHostBaseUrl(state.getHost()),
    type,
    id
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).delete(
    urlString
  );
  return data;
}
