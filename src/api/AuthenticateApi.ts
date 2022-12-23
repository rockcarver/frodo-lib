import util from 'util';
import { generateAmApi } from './BaseApi';
import * as state from '../shared/State';
import { getRealmPath } from './utils/ApiUtils';

const authenticateUrlTemplate = '%s/json%s/authenticate';
const authenticateWithServiceUrlTemplate = `${authenticateUrlTemplate}?authIndexType=service&authIndexValue=%s`;

const apiVersion = 'resource=2.0, protocol=1.0';
const getApiConfig = () => ({
  apiVersion,
});

/**
 * Fill callbacks from a map
 * Just a start
 * @param {object} response json response from a call to /authenticate
 * @param {{ [k: string]: string | number | boolean | string[] }} map name/value map
 * @returns filled response body so it can be used as input to another call to /authenticate
 */
export function fillCallbacks(
  response: object,
  map: { [k: string]: string | number | boolean | string[] }
): object {
  const body = JSON.parse(JSON.stringify(response));
  for (const callback of body.callbacks) {
    callback.input[0].value = map[callback.input[0].name];
  }
  return body;
}

export async function step(body = {}, config = {}, realm = '/') {
  const urlString = state.getAuthenticationService()
    ? util.format(
        authenticateWithServiceUrlTemplate,
        state.getHost(),
        getRealmPath(realm),
        state.getAuthenticationService()
      )
    : util.format(
        authenticateUrlTemplate,
        state.getHost(),
        getRealmPath(realm)
      );
  const { data } = await generateAmApi(getApiConfig()).post(
    urlString,
    body,
    config
  );
  return data;
}
