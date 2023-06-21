import util from 'util';
import { generateLogApi, generateLogKeysApi } from '../BaseApi';
import { getTenantURL } from '../utils/ApiUtils';
import State from '../../shared/State';
import { LogApiKey, LogEventSkeleton, PagedResult } from '../ApiTypes';

const logsTailURLTemplate = '%s/monitoring/logs/tail?source=%s';
const logsFetchURLTemplate =
  '%s/monitoring/logs?source=%s&beginTime=%s&endTime=%s';
const logsSourcesURLTemplate = '%s/monitoring/logs/sources';
const logsCreateAPIKeyAndSecretURLTemplate = '%s/keys?_action=create';
const logsGetAPIKeysURLTemplate = '%s/keys';
const logsAPIKeyURLTemplate = '%s/keys/%s';

/**
 * Get log API key
 * @returns {Promise<PagedResult<LogApiKey>>} a promise resolving to a log api key object
 */
export async function getLogApiKey({
  keyId,
  state,
}: {
  keyId: string;
  state: State;
}): Promise<LogApiKey> {
  const urlString = util.format(
    logsAPIKeyURLTemplate,
    getTenantURL(state.getHost()),
    keyId
  );
  const { data } = await generateLogKeysApi({ state }).get(urlString);
  return data;
}

/**
 * Get available API keys
 * @returns {Promise<PagedResult<LogApiKey>>} a promise resolving to a paged log api key results object
 */
export async function getLogApiKeys({
  state,
}: {
  state: State;
}): Promise<PagedResult<LogApiKey>> {
  const urlString = util.format(
    logsGetAPIKeysURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateLogKeysApi({ state }).get(urlString);
  return data;
}

/**
 * Get available log sources
 * @returns {Promise<PagedResult<string>>} a promise resolving to a paged string results object
 */
export async function getSources({
  state,
}: {
  state: State;
}): Promise<PagedResult<string>> {
  const urlString = util.format(
    logsSourcesURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateLogApi({ state }).get(urlString);
  return data;
}

/**
 * Create API key
 * @param {keyName: string, state: State} params keyName, state
 * @returns {Promise<LogApiKey>} new API key and secret
 */
export async function createLogApiKey({
  keyName,
  state,
}: {
  keyName: string;
  state: State;
}): Promise<LogApiKey> {
  const urlString = util.format(
    logsCreateAPIKeyAndSecretURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateLogKeysApi({ state }).post(urlString, {
    name: keyName,
  });
  return data;
}

/**
 * Delete log API key
 * @param {string} keyId key id
 * @returns {Promise<unknown>} a promise that resolves to a log api key object
 */
export async function deleteLogApiKey({
  keyId,
  state,
}: {
  keyId: string;
  state: State;
}): Promise<unknown> {
  const urlString = util.format(
    logsAPIKeyURLTemplate,
    getTenantURL(state.getHost()),
    keyId
  );
  const { data } = await generateLogKeysApi({ state }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Tail logs
 * @param {string} source log source(s) to tail
 * @param {string} cookie paged results cookie
 * @returns {Promise<PagedResult<LogEventSkeleton>>} promise resolving to paged log event result
 */
export async function tail({
  source,
  cookie,
  state,
}: {
  source: string;
  cookie: string;
  state: State;
}): Promise<PagedResult<LogEventSkeleton>> {
  let urlString = util.format(
    logsTailURLTemplate,
    getTenantURL(state.getHost()),
    encodeURIComponent(source)
  );
  if (cookie) {
    urlString += `&_pagedResultsCookie=${encodeURIComponent(cookie)}`;
  }
  const { data } = await generateLogApi({ state }).get(urlString);
  return data as PagedResult<LogEventSkeleton>;
}

/**
 * Fetch logs
 * @param {string} source log source(s) to tail
 * @param {string} startTs start timestamp
 * @param {string} endTs end timestamp
 * @param {string} cookie paged results cookie
 * @returns {Promise<PagedResult<LogEventSkeleton>>} promise resolving to paged log event result
 */
export async function fetch({
  source,
  startTs,
  endTs,
  cookie,
  state,
}: {
  source: string;
  startTs: string;
  endTs: string;
  cookie: string;
  state: State;
}): Promise<PagedResult<LogEventSkeleton>> {
  let urlString = util.format(
    logsFetchURLTemplate,
    getTenantURL(state.getHost()),
    encodeURIComponent(source),
    startTs,
    endTs
  );
  if (cookie) {
    urlString += `&_pagedResultsCookie=${encodeURIComponent(cookie)}`;
  }
  const { data } = await generateLogApi({
    state,
    requestOverride: { timeout: 60000 },
  }).get(urlString);
  return data as PagedResult<LogEventSkeleton>;
}
