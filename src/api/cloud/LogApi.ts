import util from 'util';
import { generateLogApi, generateLogKeysApi } from '../BaseApi';
import { getTenantURL } from '../utils/ApiUtils';
import * as state from '../../shared/State';
import { LogApiKey, LogEventSkeleton, PagedResult } from '../ApiTypes';

const logsTailURLTemplate = '%s/monitoring/logs/tail?source=%s';
const logsFetchURLTemplate =
  '%s/monitoring/logs?source=%s&beginTime=%s&endTime=%s';
const logsSourcesURLTemplate = '%s/monitoring/logs/sources';
const logsCreateAPIKeyAndSecretURLTemplate = '%s/keys?_action=create';
const logsGetAPIKeysURLTemplate = '%s/keys';

/**
 * Get available API keys
 * @returns {Promise<PagedResult<LogApiKey>>} a promise resolving to a paged log api key results object
 */
export async function getAPIKeys(): Promise<PagedResult<LogApiKey>> {
  const urlString = util.format(
    logsGetAPIKeysURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateLogKeysApi().get(urlString);
  return data;
}

/**
 * Get available log sources
 * @returns {Promise<PagedResult<string>>} a promise resolving to a paged string results object
 */
export async function getSources(): Promise<PagedResult<string>> {
  const urlString = util.format(
    logsSourcesURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateLogApi().get(urlString);
  return data;
}

export async function createAPIKeyAndSecret(keyName: string) {
  const urlString = util.format(
    logsCreateAPIKeyAndSecretURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateLogKeysApi().post(urlString, {
    name: keyName,
  });
  return data;
}

/**
 * Tail logs
 * @param {string} source log source(s) to tail
 * @param {string} cookie paged results cookie
 * @returns {Promise<PagedResult<LogEventSkeleton>>} promise resolving to paged log event result
 */
export async function tail(
  source: string,
  cookie: string
): Promise<PagedResult<LogEventSkeleton>> {
  let urlString = util.format(
    logsTailURLTemplate,
    getTenantURL(state.getHost()),
    encodeURIComponent(source)
  );
  if (cookie) {
    urlString += `&_pagedResultsCookie=${encodeURIComponent(cookie)}`;
  }
  const { data } = await generateLogApi().get(urlString);
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
export async function fetch(
  source: string,
  startTs: string,
  endTs: string,
  cookie: string
): Promise<PagedResult<LogEventSkeleton>> {
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
  const { data } = await generateLogApi({ timeout: 60000 }).get(urlString);
  return data as PagedResult<LogEventSkeleton>;
}
