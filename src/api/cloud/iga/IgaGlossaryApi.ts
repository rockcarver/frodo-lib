import util from 'util';

import { State } from '../../../shared/State';
import { postApiSearchAll } from '../../../utils/ExportImportUtils';
import { getHostOnlyUrl } from '../../../utils/ForgeRockUtils';
import { Metadata, SearchTargetFilterOperation } from '../../ApiTypes';
import { generateGovernanceApi } from '../../BaseApi';

const glossarySchemaEndpointURLTemplate = '%s/iga/commons/glossary/schema';
const glossarySchemaURLTemplate = glossarySchemaEndpointURLTemplate + '/%s';
const searchGlossarySchemaURLTemplate =
  glossarySchemaEndpointURLTemplate + '/search';
const applicationGlossaryURLTemplate =
  '%s/iga/governance/application/%s/glossary';

export type GlossaryObjectType =
  | '/openidm/managed/role'
  | '/openidm/managed/assignment'
  | '/openidm/managed/application'
  | '/iga/governance/account';
export type GlossaryItemType =
  | 'string'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'date'
  | 'managedObject';
export type GlossaryManagedObjectType =
  | '/openidm/managed/user'
  | '/openidm/managed/role'
  | '/openidm/managed/organization'
  | null;

export interface GlossarySchemaItemSkeleton<T extends string | number> {
  name: string;
  id: string;
  description: string;
  displayName: string;
  type: GlossaryItemType;
  objectType: GlossaryObjectType;
  isMultiValue: boolean;
  // Type of T is either string or number if type is "string" or "integer" respectively, otherwise it's an empty array
  enumeratedValues: {
    text: T;
    value: T;
  }[];
  // Only populated if type is "managedObject"
  managedObjectType?: GlossaryManagedObjectType;
  searchable: boolean;
  // Flattened array containing the values from "enumeratedValues"
  allowedValues: T[];
  // Only shows up for internal glossary schema
  isInternal?: boolean;
  isIndexed?: boolean;
  metadata?: Metadata;
}

export type GlossarySkeleton = Record<
  string,
  string | boolean | number | string[] | number[]
>;

/**
 * Get glossary schema
 * @param {string} glossaryId the glossary id
 * @returns {Promise<GlossarySchemaItem>} a promise that resolves to a glossary schema object
 */
export async function getGlossarySchema({
  glossaryId,
  state,
}: {
  glossaryId: string;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>> {
  const urlString = util.format(
    glossarySchemaURLTemplate,
    getHostOnlyUrl(state.getHost()),
    glossaryId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get application glossary
 * @param {string} applicationId the application id
 * @returns {Promise<GlossarySkeleton>} a promise that resolves to a glossary object
 */
export async function getApplicationGlossary({
  applicationId,
  state,
}: {
  applicationId: string;
  state: State;
}): Promise<GlossarySkeleton> {
  const urlString = util.format(
    applicationGlossaryURLTemplate,
    getHostOnlyUrl(state.getHost()),
    applicationId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Search all glossary schemas
 * @param {SearchTargetFilterOperation} targetFilter Optional filter to filter the search results. If no filter supplied, will return all
 * @returns {Promise<GlossarySchemaItem[]>} a promise that resolves to an object containing an array of glossary schema objects
 */
export async function searchGlossarySchemas({
  targetFilter,
  state,
}: {
  targetFilter?: SearchTargetFilterOperation;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>[]> {
  const urlString = util.format(
    searchGlossarySchemaURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  return await postApiSearchAll({
    url: urlString,
    targetFilter,
    state,
  });
}

/**
 * Create glossary schema
 * @param {GlossarySchemaItemSkeleton} glossarySchemaData the glossary schema object
 * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
 */
export async function createGlossarySchema({
  glossarySchemaData,
  state,
}: {
  glossarySchemaData: GlossarySchemaItemSkeleton<any>;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>> {
  const urlString = util.format(
    glossarySchemaEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).post(urlString, glossarySchemaData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put glossary schema
 * NOTE: due to a bug in the current version of AIC (20185.0), you cannot create a glossary schema using PUT. Use createGlossarySchema if you want to create a new glossary schema.
 * @param {string} glossaryId the glossary schema id
 * @param {GlossarySchemaItemSkeleton} glossarySchemaData the glossary schema object
 * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
 */
export async function putGlossarySchema({
  glossaryId,
  glossarySchemaData,
  state,
}: {
  glossaryId: string;
  glossarySchemaData: GlossarySchemaItemSkeleton<any>;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>> {
  const urlString = util.format(
    glossarySchemaURLTemplate,
    getHostOnlyUrl(state.getHost()),
    glossaryId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).put(urlString, glossarySchemaData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put application glossary
 * @param {string} applicationId the application id
 * @param {GlossarySkeleton} glossaryData the glossary object
 * @returns {Promise<GlossarySkeleton>} a promise that resolves to a glossary object
 */
export async function putApplicationGlossary({
  applicationId,
  glossaryData,
  state,
}: {
  applicationId: string;
  glossaryData: GlossarySkeleton;
  state: State;
}): Promise<GlossarySkeleton> {
  const urlString = util.format(
    applicationGlossaryURLTemplate,
    getHostOnlyUrl(state.getHost()),
    applicationId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).put(urlString, glossaryData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete glossary schema
 * @param {string} glossaryId the glossary schema id
 * @returns {Promise<GlossarySchemaItemSkeleton>} a promise that resolves to a glossary schema object
 */
export async function deleteGlossarySchema({
  glossaryId,
  state,
}: {
  glossaryId: string;
  state: State;
}): Promise<GlossarySchemaItemSkeleton<any>> {
  const urlString = util.format(
    glossarySchemaURLTemplate,
    getHostOnlyUrl(state.getHost()),
    glossaryId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete application glossary
 * @param {string} applicationId the application id
 * @returns {Promise<GlossarySkeleton>} a promise that resolves to a glossary object
 */
export async function deleteApplicationGlossary({
  applicationId,
  state,
}: {
  applicationId: string;
  state: State;
}): Promise<GlossarySkeleton> {
  const urlString = util.format(
    applicationGlossaryURLTemplate,
    getHostOnlyUrl(state.getHost()),
    applicationId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
