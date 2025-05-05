import util from 'util';
import { debugMessage } from '../utils/Console';
import { State } from '../shared/State';
import { getRealmPath } from '../utils/ForgeRockUtils';
import { generateAmApi, generateIdmApi } from './BaseApi';

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
export function fillCallbacks({
  response,
  map,
}: {
  response: object;
  map: { [k: string]: string | number | boolean | string[] };
}): object {
  const body = JSON.parse(JSON.stringify(response));
  for (const callback of body.callbacks) {
    callback.input[0].value = map[callback.input[0].name];
  }
  return body;
}

/**
 *
 * @param {any} body POST request body
 * @param {any} config request config
 * @param {string} realm realm
 * @param {string} service name of authentication service/journey
 * @returns Promise resolving to the authentication service response
 */
export async function step({
  body = {},
  config = {},
  realm = '/',
  service = undefined,
  state,
}: {
  body?: object;
  config?: object;
  realm?: string;
  service?: string;
  state: State;
}): Promise<any> {
  const urlString =
    service || state.getAuthenticationService()
      ? util.format(
          authenticateWithServiceUrlTemplate,
          state.getHost(),
          getRealmPath(realm),
          service || state.getAuthenticationService()
        )
      : util.format(
          authenticateUrlTemplate,
          state.getHost(),
          getRealmPath(realm)
        );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, body, config);
  return data;
}


/**
 *
 * @param {any} body POST request body
 * @param {any} config request config
 * @param {string} realm realm
 * @param {string} service name of authentication service/journey
 * @returns Promise resolving to the authentication service response
 */
export async function stepIdm({
  body = {},
  config = {},

  state,
}: {
  body?: object;
  config?: object;
  realm?: string;
  service?: string;
  state: State;
}): Promise<any> {

   debugMessage({
        message: `AuthenticateApi.stepIdm: function start `,
        state,
      })
  const urlString = `${state.getHost()}/authentication?_action=login`;
  const  response  = await generateIdmApi({
    state,
  }).post(urlString, body, config);
  return response;
}
