import Constants from '../shared/Constants';
import { State } from '../shared/State';

/**
 * Get new name when names collide
 * @param {string} name to apply policy to
 * @returns {string} new name according to policy
 */
export function applyNameCollisionPolicy(name: string): string {
  const capturingRegex = /(.* - imported) \(([0-9]+)\)/;
  const found = name.match(capturingRegex);
  if (found && found.length > 0 && found.length === 3) {
    // already renamed one or more times
    // return the next number
    return `${found[1]} (${parseInt(found[2], 10) + 1})`;
  }
  // first time
  return `${name} - imported (1)`;
}

/**
 * Get realm path
 * @param {string} realm realm
 * @returns {string} a CREST-compliant realm path, e.g. /realms/root/realms/alpha
 */
export function getRealmPath(realm: string) {
  if (realm.startsWith('/')) {
    realm = realm.substring(1);
  }
  const elements = ['root'].concat(
    realm.split('/').filter((element) => element !== '')
  );
  const realmPath = `/realms/${elements.join('/realms/')}`;
  return realmPath;
}

/**
 * Get current realm path
 * @returns {string} a CREST-compliant realm path, e.g. /realms/root/realms/alpha
 */
export function getCurrentRealmPath(state: State) {
  return getRealmPath(state.getRealm());
}

/**
 * Get current realm name
 * @returns {String} name of the current realm. /alpha -> alpha
 */
export function getCurrentRealmName(state: State) {
  const realm = state.getRealm();
  const components = realm.split('/');
  let realmName = '/';
  if (components.length > 0 && realmName !== realm) {
    realmName = components[components.length - 1];
  }
  return realmName;
}

/**
 * Get the name of the managed user object for the current realm
 * @returns {string} the name of the managed user object for the current realm
 */
export function getRealmManagedUser({ state }: { state: State }): string {
  let realmManagedUser = 'user';
  if (state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY) {
    realmManagedUser = `${getCurrentRealmName(state)}_user`;
  }
  return realmManagedUser;
}

/**
 * Get current realm name
 * @param {String} realm realm
 * @returns {String} name of the realm. /alpha -> alpha
 */
export function getRealmName(realm) {
  const components = realm.split('/');
  let realmName = '/';
  if (components.length > 0 && realmName !== realm) {
    realmName = components[components.length - 1];
  }
  return realmName;
}

/**
 * Get tenant base URL
 * @param {String} tenant tenant URL with path and query params
 * @returns {String} tenant base URL without path and query params
 */
export function getTenantURL(tenant) {
  const parsedUrl = new URL(tenant);
  return `${parsedUrl.protocol}//${parsedUrl.host}`;
}
