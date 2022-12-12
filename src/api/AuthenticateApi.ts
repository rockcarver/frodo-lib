import util from 'util';
import { generateAmApi } from './BaseApi';
import * as state from '../shared/State';

const authenticateUrlTemplate = '%s/json%s/authenticate';
const authenticateWithServiceUrlTemplate = `${authenticateUrlTemplate}?authIndexType=service&authIndexValue=%s`;

const apiVersion = 'resource=2.0, protocol=1.0';
const getApiConfig = () => ({
  apiVersion,
});

const realmPathTemplate = '/realms/%s';

export function getRealmUrl(realm) {
  let localRealm = realm;
  if (localRealm.startsWith('/') && localRealm.length > 1) {
    localRealm = localRealm.substring(1);
  }
  let realmPath = util.format(realmPathTemplate, 'root');
  if (localRealm !== '/') {
    realmPath += util.format(realmPathTemplate, localRealm);
  }
  return realmPath;
}

export async function step(body = {}, config = {}) {
  const urlString = state.getAuthenticationService()
    ? util.format(
        authenticateWithServiceUrlTemplate,
        state.getHost(),
        getRealmUrl('/'),
        state.getAuthenticationService()
      )
    : util.format(authenticateUrlTemplate, state.getHost(), getRealmUrl('/'));
  const { data } = await generateAmApi(getApiConfig()).post(
    urlString,
    body,
    config
  );
  return data;
}
