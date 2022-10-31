import util from 'util';
import storage from '../storage/SessionStorage';
import { generateLogApi, generateLogKeysApi } from './BaseApi';
import { getTenantURL } from './utils/ApiUtils';

const logsTailURLTemplate = '%s/monitoring/logs/tail?source=%s';
const logsFetchURLTemplate =
  '%s/monitoring/logs?source=%s&beginTime=%s&endTime=%s';
const logsSourcesURLTemplate = '%s/monitoring/logs/sources';
const logsCreateAPIKeyAndSecretURLTemplate = '%s/keys?_action=create';
const logsGetAPIKeysURLTemplate = '%s/keys';

export async function tail(source, cookie) {
  let urlString = util.format(
    logsTailURLTemplate,
    getTenantURL(storage.session.getTenant()),
    encodeURIComponent(source)
  );
  if (cookie) {
    urlString += `&_pagedResultsCookie=${encodeURIComponent(cookie)}`;
  }
  return generateLogApi().get(urlString);
}

export async function getAPIKeys() {
  const urlString = util.format(
    logsGetAPIKeysURLTemplate,
    getTenantURL(storage.session.getTenant())
  );
  return generateLogKeysApi().get(urlString);
}

export async function getSources() {
  const urlString = util.format(
    logsSourcesURLTemplate,
    getTenantURL(storage.session.getTenant())
  );
  return generateLogApi().get(urlString);
}

export async function createAPIKeyAndSecret(keyName) {
  const urlString = util.format(
    logsCreateAPIKeyAndSecretURLTemplate,
    getTenantURL(storage.session.getTenant())
  );
  return generateLogKeysApi().post(urlString, { name: keyName });
}

export async function fetch(source, startTs, endTs, cookie) {
  let urlString = util.format(
    logsFetchURLTemplate,
    getTenantURL(storage.session.getTenant()),
    encodeURIComponent(source),
    startTs,
    endTs
  );
  if (cookie) {
    urlString += `&_pagedResultsCookie=${encodeURIComponent(cookie)}`;
  }
  return generateLogApi({ timeout: 60000 }).get(urlString);
}
