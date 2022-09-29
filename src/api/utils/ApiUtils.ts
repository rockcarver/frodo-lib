import storage from '../../storage/SessionStorage';

/**
 * Get current realm path
 * @returns {String} a CREST-compliant realm path, e.g. /realms/root/realms/alpha
 */
export function getCurrentRealmPath() {
  let realm = storage.session.getRealm();
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
 * Get current realm name
 * @returns {String} name of the current realm. /alpha -> alpha
 */
export function getCurrentRealmName() {
  const realm = storage.session.getRealm();
  const components = realm.split('/');
  let realmName = '/';
  if (components.length > 0 && realmName !== realm) {
    realmName = components[components.length - 1];
  }
  return realmName;
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

/**
 * Deep delete keys and their values from an input object. If a key in object contains substring, the key an its value is deleted.
 * @param {Object} object input object that needs keys removed
 * @param {String} substring substring to search for in key
 * @returns the modified object without the matching keys and their values
 */
export function deleteDeepByKey(object, substring) {
  const obj = object;
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (key.indexOf(substring) > 0) {
      delete obj[key];
    } else if (Object(obj[key]) === obj[key]) {
      obj[key] = deleteDeepByKey(obj[key], substring);
    }
  }
  return obj;
}

/*
 * Parse a URL into its components and make them easily accessible by name
 *
 * Use in a Scripte Decision Node Script as follows:
 * var referer = parseUrl(requestHeaders.get("referer").get(0));
 * var origin = referer.origin;
 *
 * e.g.: https://openam-volker-dev.forgeblocks.com/am/XUI/?realm=/bravo&authIndexType=service&authIndexValue=InitiateOwnerClaim#/
 * {
 *     hash: '#/',
 *     host: 'openam-volker-dev.forgeblocks.com',
 *     hostname: 'openam-volker-dev.forgeblocks.com',
 *     href: 'https://openam-volker-dev.forgeblocks.com/am/XUI/?realm=/bravo&authIndexType=service&authIndexValue=InitiateOwnerClaim#/',
 *     origin: 'https://openam-volker-dev.forgeblocks.com',
 *     pathname: '/am/XUI/',
 *     port: '',
 *     protocol: 'https',
 *     search: '?realm=/bravo&authIndexType=service&authIndexValue=InitiateOwnerClaim',
 *     username: '',
 *     password: '',
 *     searchParam: {
 *         realm: '/bravo',
 *         authIndexType: 'service',
 *         authIndexValue: 'InitiateOwnerClaim'
 *     }
 * }
 */
export function parseUrl(href) {
  const m = href.match(
      /^(([^:/?#]+):?(?:\/\/((?:([^/?#:]*):([^/?#:]*)@)?([^/?#:]*)(?::([^/?#:]*))?)))?([^?#]*)(\?[^#]*)?(#.*)?$/
    ),
    r = {
      hash: m[10] || '', // #/
      host: m[3] || '', // openam-volker-dev.forgeblocks.com
      hostname: m[6] || '', // openam-volker-dev.forgeblocks.com
      href: m[0] || '', // https://openam-volker-dev.forgeblocks.com/am/XUI/?realm=/bravo&authIndexType=service&authIndexValue=InitiateOwnerClaim#/
      origin: m[1] || '', // https://openam-volker-dev.forgeblocks.com
      pathname: m[8] || (m[1] ? '/' : ''), // /am/XUI/
      port: m[7] || '', //
      protocol: m[2] || '', // https
      search: m[9] || '', // ?realm=/bravo&authIndexType=service&authIndexValue=InitiateOwnerClaim
      username: m[4] || '', //
      password: m[5] || '', //
      searchParam: {}, // { realm: '/bravo',
      //   authIndexType: 'service',
      //   authIndexValue: 'InitiateOwnerClaim' }
    };
  if (r.protocol.length == 2) {
    r.protocol = 'file:///' + r.protocol.toUpperCase();
    r.origin = r.protocol + '//' + r.host;
  }
  if (r.search.length > 2) {
    const query = r.search.indexOf('?') === 0 ? r.search.substr(1) : r.search;
    const vars = query.split('&');
    for (let i = 0; i < vars.length; i++) {
      const pair = vars[i].split('=');
      r.searchParam[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }
  }
  r.href = r.origin + r.pathname + r.search + r.hash;
  return r;
}
