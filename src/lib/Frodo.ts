import FrodoLib from './FrodoLib';
import { StateInterface } from '../shared/State';

const frodo = FrodoLib();
const state = frodo.state;

/**
 * Factory helper to create a frodo instance ready for logging in with a service account
 * @param {string} host host base URL, e.g. 'https://openam-my-tenant.forgeblocks.com/am'
 * @param {string} serviceAccountId service account uuid
 * @param {string} serviceAccountJwkStr service account JWK as stringified JSON
 * @param {string} realm (optional) override default realm
 * @param {string} deploymentType (optional) override deployment type ('cloud', 'forgeops', or 'classic')
 * @param {boolean} allowInsecureConnection (optional) allow insecure connection
 * @param {boolean} debug (optional) enable debug output
 * @param {boolean} curlirize (optional) enable output of all library REST calls as curl commands
 * @returns FrodoLib instance
 */
function createInstanceWithServiceAccount(
  host: string,
  serviceAccountId: string,
  serviceAccountJwkStr: string,
  realm: string = undefined,
  deploymentType: string = undefined,
  allowInsecureConnection = false,
  debug = false,
  curlirize = false
) {
  const config: StateInterface = {
    host,
    serviceAccountId,
    serviceAccountJwk: JSON.parse(serviceAccountJwkStr),
    realm,
    deploymentType,
    allowInsecureConnection,
    debug,
    curlirize,
  };
  const frodo = FrodoLib(config);
  return frodo;
}

/**
 * Factory helper to create a frodo instance ready for logging in with an admin user account
 * @param {string} host host base URL, e.g. 'https://openam-my-tenant.forgeblocks.com/am'
 * @param {string} username admin account username
 * @param {string} password admin account password
 * @param {string} realm (optional) override default realm
 * @param {string} deploymentType (optional) override deployment type ('cloud', 'forgeops', or 'classic')
 * @param {boolean} allowInsecureConnection (optional) allow insecure connection
 * @param {boolean} debug (optional) enable debug output
 * @param {boolean} curlirize (optional) enable output of all library REST calls as curl commands
 * @returns FrodoLib instance
 */
function createInstanceWithAdminAccount(
  host: string,
  username: string,
  password: string,
  realm: string = undefined,
  deploymentType: string = undefined,
  allowInsecureConnection = false,
  debug = false,
  curlirize = false
) {
  const config: StateInterface = {
    host,
    username,
    password,
    realm,
    deploymentType,
    allowInsecureConnection,
    debug,
    curlirize,
  };
  const frodo = FrodoLib(config);
  return frodo;
}

export {
  frodo,
  state,
  FrodoLib,
  createInstanceWithAdminAccount,
  createInstanceWithServiceAccount,
};
