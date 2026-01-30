import util from 'util';

import { State } from '../../../shared/State';
import { getApiSearchAll } from '../../../utils/ExportImportUtils';
import { getHostOnlyUrl } from '../../../utils/ForgeRockUtils';
import { Metadata } from '../../ApiTypes';
import { generateGovernanceApi } from '../../BaseApi';

const requestTypesEndpointURLTemplate = '%s/iga/governance/requestTypes';
const requestTypeURLTemplate = requestTypesEndpointURLTemplate + '/%s';

export type PropertyType = 'text' | 'boolean' | 'object' | 'number';

export interface RequestTypeProperty {
  isRequired: boolean;
  isInternal?: boolean;
  isChangable?: boolean;
  isMultiValue?: boolean;
  lookup?: {
    path: string;
    query: string;
  };
  display?: {
    name: string;
    isVisible: boolean;
    order?: number;
    description?: string;
  };
  text?: {
    defaultValue: string;
  };
}

export interface RequestTypeSchema {
  _meta: {
    type: string;
    display?: string;
    displayName?: string;
    properties: Record<string, RequestTypeProperty>;
  };
  properties: Record<string, { type: PropertyType }>;
}

export interface RequestTypeSchemas {
  common?: (string | RequestTypeSchema)[];
  entitlement?: (string | RequestTypeSchema)[];
  user?: (string | RequestTypeSchema)[];
  entity?: (string | RequestTypeSchema)[];
  custom?: (string | RequestTypeSchema)[];
}

export interface RequestTypeSkeleton {
  id: string;
  _rev?: number;
  displayName: string;
  description?: string;
  notModifiableProperties?: string[];
  workflow?: {
    id?: string | null;
    type?: string;
  };
  schemas?: RequestTypeSchemas;
  custom?: boolean;
  validation?: null | {
    source?: string | string[];
  };
  uniqueKeys?: string[];
  metadata?: Metadata;
  customValidation?: null | {
    source?: string | string[];
  };
}

/**
 * Create request type
 * @param {RequestTypeSkeleton} typeData the request type object
 * @returns {Promise<RequestTypeSkeleton>} a promise that resolves to a request type object
 */
export async function createRequestType({
  typeData,
  state,
}: {
  typeData: RequestTypeSkeleton;
  state: State;
}): Promise<RequestTypeSkeleton> {
  const urlString = util.format(
    requestTypesEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).post(urlString, typeData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get request type
 * @param {string} typeId The request type id
 * @returns {Promise<RequestTypeSkeleton>} A promise that resolves to a request type object
 */
export async function getRequestType({
  typeId,
  state,
}: {
  typeId: string;
  state: State;
}): Promise<RequestTypeSkeleton> {
  const urlString = util.format(
    requestTypeURLTemplate,
    getHostOnlyUrl(state.getHost()),
    typeId
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
 * Query request types
 * @param {string} queryFilter The query filter to query with. Default: 'true'
 * @returns {Promise<RequestTypeSkeleton[]>} A promise that resolves to an array of request type objects
 */
export async function queryRequestTypes({
  queryFilter = 'true',
  state,
}: {
  queryFilter?: string;
  state: State;
}): Promise<RequestTypeSkeleton[]> {
  const urlString = util.format(
    requestTypesEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  return await getApiSearchAll<RequestTypeSkeleton>({
    url: urlString,
    queryFilter,
    state,
  });
}

/**
 * Put request type
 * @param {string} typeId The request type id
 * @param {RequestTypeSkeleton} typeData The request type data
 * @returns {Promise<RequestTypeSkeleton>} A promise that resolves to a request type object
 */
export async function putRequestType({
  typeId,
  typeData,
  state,
}: {
  typeId: string;
  typeData: RequestTypeSkeleton;
  state: State;
}): Promise<RequestTypeSkeleton> {
  const urlString = util.format(
    requestTypeURLTemplate,
    getHostOnlyUrl(state.getHost()),
    typeId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).put(urlString, typeData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete request type
 * @param {string} typeId The request type id
 * @returns {Promise<RequestTypeSkeleton>} A promise that resolves to a request type object
 */
export async function deleteRequestType({
  typeId,
  state,
}: {
  typeId: string;
  state: State;
}): Promise<RequestTypeSkeleton> {
  const urlString = util.format(
    requestTypeURLTemplate,
    getHostOnlyUrl(state.getHost()),
    typeId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
