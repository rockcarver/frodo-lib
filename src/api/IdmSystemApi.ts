import util from 'util';
import Constants from '../shared/Constants';
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
  /** The reason a connection test failed, for example `connector not available` right after a connector was enabled. */
  error?: string;
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
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    state,
    requestOverride: {},
  }).post(urlString);
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
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).post(urlString);
  return data;
}

export async function readAvailableConnectors({
  state,
}: {
  state: State;
}): Promise<SystemStatusInterface[]> {
  const urlString = util.format(
    systemActionsUrlTemplate,
    getIdmBaseUrl(state),
    'availableConnectors'
  );
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).post(urlString);
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
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).post(urlString);
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
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).post(urlString, { username, password });
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
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).post(urlString);
  return data;
}

/**
 * The paged results cookie of a system query as the value of a query string
 * parameter.
 *
 * @remarks
 * What it assumes: IDM answers a connector query with a cookie that is
 * already percent-encoded (`...%3D%3A0`), and the next request has to carry it
 * as it came, so an escape that is there is kept, in upper or lower case. The
 * cookie of a managed object query is not like that: it comes back raw (plain
 * base64) and `ManagedObjectApi` encodes it itself, so this function is not
 * used there. Every other character that is not safe in a query value, and a
 * `%` that does not start an escape, is encoded, so that a cookie cannot
 * change or add a parameter of the request.
 *
 * Two limits follow from the fact that an escape cannot be told from text that
 * looks like one: a raw cookie that literally contains an escape such as `%41`
 * is sent as that escape, and a form-encoded `+` that stands for a space is
 * sent as `%2B`. Neither is supported; the cookies that IDM has been recorded
 * to issue contain neither.
 *
 * @param {string} cookie paged results cookie
 * @returns {string} the cookie, safe in a query string
 */
function encodePagedResultsCookie(cookie: string): string {
  return cookie.replace(
    /%(?![0-9A-Fa-f]{2})|[^A-Za-z0-9\-._~%]/gu,
    (character) => {
      try {
        return encodeURIComponent(character);
      } catch {
        // a lone surrogate cannot be encoded: replace it
        return '%EF%BF%BD';
      }
    }
  );
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
  // the cookie is added after the format: it must not be read as a format
  const urlString =
    util.format(
      `${systemQueryAllUrlTemplate}${pagingParams}`,
      getIdmBaseUrl(state),
      systemName,
      systemObjectType
    ) +
    (pageCookie
      ? `&_pagedResultsCookie=${encodePagedResultsCookie(pageCookie)}`
      : '');
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    state,
  }).get(urlString);
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
  // the cookie is added after the format: it must not be read as a format
  const urlString =
    util.format(
      `${systemQueryByFilterUrlTemplate}${pagingParams}${fieldsParam}`,
      getIdmBaseUrl(state),
      systemName,
      systemObjectType,
      decodeURIComponent(filter) === filter
        ? encodeURIComponent(filter)
        : filter
    ) +
    (pageCookie
      ? `&_pagedResultsCookie=${encodePagedResultsCookie(pageCookie)}`
      : '');
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).get(urlString);
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
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).get(urlString);
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
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).post(urlString, systemObjectData);
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
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride,
    state,
  }).put(urlString, systemObjectData);
  return data;
}

export interface SystemObjectPatchOperationInterface {
  operation:
    'add' | 'copy' | 'increment' | 'move' | 'remove' | 'replace' | 'transform';
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
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).patch(urlString, operations);
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
  const { data } = await generateIdmApi({
    requiredScopes: [Constants.AVAILABLE_SCOPES.IdmFullScope],
    requestOverride: {},
    state,
  }).delete(urlString);
  return data;
}
