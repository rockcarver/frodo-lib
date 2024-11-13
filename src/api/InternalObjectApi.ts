import util from 'util';

import { State } from '../shared/State';
import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import {
  IdObjectSkeletonInterface,
  PagedResult,
  PatchOperationInterface,
} from './ApiTypes';
import { generateIdmApi } from './BaseApi';

const createInternalObjectURLTemplate = '%s/internal/%s?_action=create';
const internalObjectByIdURLTemplate = '%s/internal/%s/%s';
const queryAllInternalObjectURLTemplate = `%s/internal/%s?_queryFilter=true&_pageSize=%s`;
const queryInternalObjectURLTemplate = `%s/internal/%s?_queryFilter=%s&_pageSize=%s`;

export const DEFAULT_PAGE_SIZE: number = 1000;

/**
 * Get internal object
 * @param {string} type internal object type, e.g. alpha_user or user
 * @param {string} id internal object id
 * @param {string[]} id array of fields to include
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an ObjectSkeletonInterface
 */
export async function getInternalObject({
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
    `${internalObjectByIdURLTemplate}?${fieldsParam}`,
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
 * Create internal object with server-generated id
 * @param {string} ioType internal object type
 * @param {IdObjectSkeletonInterface} ioData internal object data
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a internal object
 */
export async function createInternalObject({
  ioType,
  ioData,
  state,
}: {
  ioType: string;
  ioData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    createInternalObjectURLTemplate,
    getIdmBaseUrl(state),
    ioType
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).post(
    urlString,
    ioData
  );
  return data;
}

/**
 * Create or update internal object
 * @param {string} id internal object id
 * @param {IdObjectSkeletonInterface} ioData internal object
 * @param {boolean} failIfExists fail if exists
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a internal object
 */
export async function putInternalObject({
  type,
  id,
  ioData,
  failIfExists = false,
  state,
}: {
  type: string;
  id: string;
  ioData: IdObjectSkeletonInterface;
  failIfExists?: boolean;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    internalObjectByIdURLTemplate,
    getIdmBaseUrl(state),
    type,
    id
  );
  const requestOverride = failIfExists
    ? { headers: { 'If-None-Match': '*' } }
    : {};
  const { data } = await generateIdmApi({ requestOverride, state }).put(
    urlString,
    ioData
  );
  return data;
}

/**
 * Partially update an internal object, with an array of operations.
 * @param {string} type internal object type
 * @param {string} id internal object id
 * @param {PatchOperationInterface[]} operations array of operations
 * @param {string} rev revision
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing an internal object
 */
export async function patchInternalObject({
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
  const urlString = util.format(
    internalObjectByIdURLTemplate,
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
 * Query internal object
 * @param {string} type internal object type, e.g. alpha_user or user
 * @param {string} filter CREST search filter
 * @param {string[]} id array of fields to include
 * @param {string} pageCookie paged results cookie
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface[]>} a promise that resolves to an ObjectSkeletonInterface
 */
export async function queryInternalObjects({
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
      ? `${queryInternalObjectURLTemplate}&${fieldsParam}&_pagedResultsCookie=${encodeURIComponent(
          pageCookie
        )}`
      : `${queryInternalObjectURLTemplate}&${fieldsParam}`,
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
 * Query internal objects
 * @param {string} type internal object type
 * @param {string[]} fields fields to retrieve
 * @param {string} pageCookie paged results cookie
 * @returns {Promise<{result: any[]; resultCount: number; pagedResultsCookie: any; totalPagedResultsPolicy: string; totalPagedResults: number; remainingPagedResults: number;}>} a promise that resolves to internal objects of the desired type
 */
export async function queryAllInternalObjectsByType({
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
    ? `${queryAllInternalObjectURLTemplate}${fieldsParam}&_pagedResultsCookie=${encodeURIComponent(
        pageCookie
      )}`
    : `${queryAllInternalObjectURLTemplate}${fieldsParam}`;
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
 * Delete internal object
 * @param {string} id internal object id
 * @param {State} state library state
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an object containing a internal object
 */
export async function deleteInternalObject({
  type,
  id,
  state,
}: {
  type: string;
  id: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    internalObjectByIdURLTemplate,
    getIdmBaseUrl(state),
    type,
    id
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).delete(
    urlString
  );
  return data;
}
