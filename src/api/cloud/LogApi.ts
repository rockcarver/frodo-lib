import util from 'util';
import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import {
  parseLogApiRateLimit,
  type LogApiRateLimit,
} from '../../utils/LogApiRateLimitUtils';
import {
  type NoIdObjectSkeletonInterface,
  type PagedResult,
} from '../ApiTypes';
import { generateLogApi, generateLogKeysApi } from '../BaseApi';

const logsTailURLTemplate = '%s/monitoring/logs/tail?source=%s';
const logsFetchURLTemplate = '%s/monitoring/logs?source=%s';
const logsSourcesURLTemplate = '%s/monitoring/logs/sources';
const logsCreateAPIKeyAndSecretURLTemplate = '%s/keys?_action=create';
const logsGetAPIKeysURLTemplate = '%s/keys';
const logsAPIKeyURLTemplate = '%s/keys/%s';

export type LogApiKey = {
  name: string;
  api_key_id: string;
  api_key_secret?: string;
  created_at: string;
};

export type LogEventPayloadSkeleton = NoIdObjectSkeletonInterface & {
  context: string;
  level: string;
  logger: string;
  mdc: {
    transactionId: string;
  };
  message: string;
  thread: string;
  timestamp: string;
  transactionId: string;
};

export type LogEventSkeleton = NoIdObjectSkeletonInterface & {
  payload: string | LogEventPayloadSkeleton;
  timestamp: string;
  type: string;
  source: string;
};

/**
 * A page of log events as `tail` and `fetch` return it: the paged result of the API plus the rate limit state that
 * the same answer reported.
 */
export type LogEventsPage = PagedResult<LogEventSkeleton> & {
  /**
   * The rate limit of the Log API as the answer to this request reported it. Absent if the answer did not carry
   * the `X-RateLimit-*` headers.
   */
  rateLimit?: LogApiRateLimit;
};

export type { LogApiRateLimit };

/**
 * Adds the rate limit state of an answer to its data.
 * @param {unknown} data the body of the response
 * @param {unknown} headers the headers of the response
 * @returns {LogEventsPage} the body, with `rateLimit` when the headers carry it
 */
function withRateLimit(data: unknown, headers: unknown): LogEventsPage {
  const rateLimit = parseLogApiRateLimit(headers);
  if (!rateLimit || !data || typeof data !== 'object') {
    return data as LogEventsPage;
  }
  return { ...(data as PagedResult<LogEventSkeleton>), rateLimit };
}

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
    getHostOnlyUrl(state.getHost()),
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
    getHostOnlyUrl(state.getHost())
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
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateLogApi({ state }).get(urlString);
  return data;
}

/**
 * Validate log API key
 * @param {string} keyId log api key id
 * @param {string} secret log api secret
 * @returns {Promise<boolean>} a promise resolving to true if the key is valid, false otherwise
 */
export async function isLogApiKeyValid({
  keyId,
  secret,
  state,
}: {
  keyId: string;
  secret: string;
  state: State;
}): Promise<boolean> {
  try {
    const requestOverride = {
      headers: {
        'X-API-Key': keyId,
        'X-API-Secret': secret,
      },
    };
    const urlString = util.format(
      logsSourcesURLTemplate,
      getHostOnlyUrl(state.getHost())
    );
    await generateLogApi({ requestOverride, state }).get(urlString);
    return true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return false;
  }
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
    getHostOnlyUrl(state.getHost())
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
    getHostOnlyUrl(state.getHost()),
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
 * @returns {Promise<LogEventsPage>} promise resolving to paged log event result, with the rate limit state of the answer
 */
export async function tail({
  source,
  cookie,
  state,
}: {
  source: string;
  cookie: string;
  state: State;
}): Promise<LogEventsPage> {
  let urlString = util.format(
    logsTailURLTemplate,
    getHostOnlyUrl(state.getHost()),
    encodeURIComponent(source)
  );
  if (cookie) {
    urlString += `&_pagedResultsCookie=${encodeURIComponent(cookie)}`;
  }
  const { data, headers } = await generateLogApi({ state }).get(urlString);
  return withRateLimit(data, headers);
}

/**
 * Fetch logs
 * @param {string} source log source(s) to tail
 * @param {string} startTs start timestamp
 * @param {string} endTs end timestamp
 * @param {string} cookie paged results cookie
 * @param {string} transactionId transaction id
 * @param {string} queryFilter query filter
 * @returns {Promise<LogEventsPage>} promise resolving to paged log event result, with the rate limit state of the answer
 */
export async function fetch({
  source,
  startTs,
  endTs,
  cookie,
  txid,
  filter,
  state,
}: {
  source: string;
  startTs: string;
  endTs: string;
  cookie: string;
  txid: string;
  filter: string;
  state: State;
}): Promise<LogEventsPage> {
  let urlString = util.format(
    logsFetchURLTemplate,
    getHostOnlyUrl(state.getHost()),
    encodeURIComponent(source)
  );
  if (startTs && endTs) {
    urlString += `&beginTime=${startTs}&endTime=${endTs}`;
  }
  if (txid) {
    urlString += `&transactionId=${txid}`;
  }
  if (filter) {
    const filterParam = `_queryFilter=${encodeURIComponent(filter)}`;
    urlString += `&${filterParam}`;
  }
  if (cookie) {
    urlString += `&_pagedResultsCookie=${encodeURIComponent(cookie)}`;
  }
  const { data, headers } = await generateLogApi({
    state,
    requestOverride: { timeout: 60000 },
  }).get(urlString);
  return withRateLimit(data, headers);
}
