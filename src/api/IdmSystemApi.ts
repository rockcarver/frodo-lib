import util from 'util';

import { State } from '../shared/State';
import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import { IdObjectSkeletonInterface, PagedResult } from './ApiTypes';
import { generateIdmApi } from './BaseApi';

const systemActionsUrlTemplate = '%s/system?_action=%s';
const systemTestUrlTemplate = '%s/system/%s?_action=test';
const systemObjectActionsUrlTemplate = '%s/system/%s/%s?_action=%s';
const systemRunScriptUrlTemplate =
  '%s/system/%s?_action=script&scriptId=%s&scriptExecuteMode=resource';
const systemQueryAllUrlTemplate = '%s/system/%s/%s?_queryId=query-all-ids';
const systemQueryByFilterUrlTemplate = '%s/system/%s/%s?_queryFilter=%s';
const systemObjectUrlTemplate = '%s/system/%s/%s/%s';

export const DEFAULT_PAGE_SIZE: number = 1000;

export interface ConnectorServerStatusInterface {
  name: string;
  type: string;
  ok: boolean;
}

export interface TestConnectorServersInterface {
  openicf: ConnectorServerStatusInterface[];
}

export interface SystemStatusInterface {
  name: string;
  enabled: boolean;
  config: string;
  connectorRef: {
    connectorHostRef: string;
    bundleVersion: string;
    bundleName: string;
    connectorName: string;
  };
  displayName: string;
  objectTypes: string[];
  ok: boolean;
}

/**
 * Test connector servers
 * @returns {Promise<TestConnectorServersInterface>} a promise that resolves to a TestConnectorServersInterface object
 */
export async function testConnectorServers({
  state,
}: {
  state: State;
}): Promise<TestConnectorServersInterface> {
  const urlString = util.format(
    systemActionsUrlTemplate,
    getIdmBaseUrl(state),
    'testConnectorServers'
  );
  const { data } = await generateIdmApi({ state, requestOverride: {} }).post(
    urlString
  );
  return data as TestConnectorServersInterface;
}

export async function readAvailableSystems({
  state,
}: {
  state: State;
}): Promise<SystemStatusInterface[]> {
  const urlString = util.format(
    systemActionsUrlTemplate,
    getIdmBaseUrl(state),
    'test'
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).post(
    urlString
  );
  return data;
}

export async function readSystemStatus({
  systemName,
  state,
}: {
  systemName: string;
  state: State;
}): Promise<SystemStatusInterface> {
  const urlString = util.format(
    systemTestUrlTemplate,
    getIdmBaseUrl(state),
    systemName
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).post(
    urlString
  );
  return data;
}

export async function authenticateSystemObject({
  systemName,
  systemObjectType,
  username,
  password,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  username: string;
  password: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    systemObjectActionsUrlTemplate,
    getIdmBaseUrl(state),
    systemName,
    systemObjectType,
    'authenticate'
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).post(
    urlString,
    { username, password }
  );
  return data;
}

export async function runSystemScript({
  systemName,
  scriptName,
  state,
}: {
  systemName: string;
  scriptName: string;
  state: State;
}) {
  const urlString = util.format(
    systemRunScriptUrlTemplate,
    getIdmBaseUrl(state),
    systemName,
    scriptName
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).post(
    urlString
  );
  return data;
}

//?_queryId=query-all-ids&_pageSize=/lmextuserCustomer sw '6'&_totalPagedResultsPolicy=EXACT
export async function queryAllSystemObjectIds({
  systemName,
  systemObjectType,
  pageSize = DEFAULT_PAGE_SIZE,
  pageCookie = undefined,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  pageSize?: number;
  pageCookie?: string;
  state: State;
}): Promise<PagedResult<IdObjectSkeletonInterface>> {
  const pagingParams = pageSize
    ? `&_pageSize=${pageSize}&_totalPagedResultsPolicy=EXACT`
    : '';
  const urlTemplate = pageCookie
    ? `${systemQueryAllUrlTemplate}${pagingParams}&_pagedResultsCookie=${pageCookie}`
    : `${systemQueryAllUrlTemplate}${pagingParams}`;
  const urlString = util.format(
    urlTemplate,
    getIdmBaseUrl(state),
    systemName,
    systemObjectType
  );
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}

export async function querySystemObjects({
  systemName,
  systemObjectType,
  filter,
  fields = ['*'],
  pageSize = DEFAULT_PAGE_SIZE,
  pageCookie = undefined,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  filter: string;
  fields: string[];
  pageSize?: number;
  pageCookie?: string;
  state: State;
}): Promise<PagedResult<IdObjectSkeletonInterface>> {
  const fieldsParam = fields.length > 0 ? `&_fields=${fields.join(',')}` : '';
  const pagingParams = pageSize
    ? `&_pageSize=${pageSize}&_totalPagedResultsPolicy=EXACT`
    : '';
  const urlTemplate = pageCookie
    ? `${systemQueryByFilterUrlTemplate}${pagingParams}${fieldsParam}&_pagedResultsCookie=${pageCookie}`
    : `${systemQueryByFilterUrlTemplate}${pagingParams}${fieldsParam}`;
  const urlString = util.format(
    urlTemplate,
    getIdmBaseUrl(state),
    systemName,
    systemObjectType,
    decodeURIComponent(filter) === filter ? encodeURIComponent(filter) : filter
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).get(
    urlString
  );
  return data as PagedResult<IdObjectSkeletonInterface>;
}

export async function getSystemObject({
  systemName,
  systemObjectType,
  systemObjectId,
  fields = ['*'],
  state,
}: {
  systemName: string;
  systemObjectType: string;
  systemObjectId: string;
  fields?: string[];
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const fieldsParam = `_fields=${fields.join(',')}`;
  const urlString = util.format(
    `${systemObjectUrlTemplate}?${fieldsParam}`,
    getIdmBaseUrl(state),
    systemName,
    systemObjectType,
    systemObjectId
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).get(
    urlString
  );
  return data as IdObjectSkeletonInterface;
}

export async function createSystemObject({
  systemName,
  systemObjectType,
  systemObjectData,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  systemObjectData: IdObjectSkeletonInterface;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    systemObjectActionsUrlTemplate,
    getIdmBaseUrl(state),
    systemName,
    systemObjectType,
    'create'
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).post(
    urlString,
    systemObjectData
  );
  return data;
}

export async function putSystemObject({
  systemName,
  systemObjectType,
  systemObjectId,
  systemObjectData,
  failIfExists = false,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  systemObjectId: string;
  systemObjectData: IdObjectSkeletonInterface;
  failIfExists?: boolean;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    systemObjectUrlTemplate,
    getIdmBaseUrl(state),
    systemName,
    systemObjectType,
    systemObjectId
  );
  const requestOverride = failIfExists
    ? { headers: { 'If-None-Match': '*' } }
    : { headers: { 'If-Match': '*' } };
  const { data } = await generateIdmApi({ requestOverride, state }).put(
    urlString,
    systemObjectData
  );
  return data;
}

export interface SystemObjectPatchOperationInterface {
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

export async function patchSystemObject({
  systemName,
  systemObjectType,
  systemObjectId,
  operations,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  systemObjectId: string;
  operations: SystemObjectPatchOperationInterface[];
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    systemObjectUrlTemplate,
    getIdmBaseUrl(state),
    systemName,
    systemObjectType,
    systemObjectId
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).patch(
    urlString,
    operations
  );
  return data;
}

export async function deleteSystemObject({
  systemName,
  systemObjectType,
  systemObjectId,
  state,
}: {
  systemName: string;
  systemObjectType: string;
  systemObjectId: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    systemObjectUrlTemplate,
    getIdmBaseUrl(state),
    systemName,
    systemObjectType,
    systemObjectId
  );
  const { data } = await generateIdmApi({ requestOverride: {}, state }).delete(
    urlString
  );
  return data;
}
