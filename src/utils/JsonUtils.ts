export type Json = {
  /**
   * Compare two json objects
   * @param {object} obj1 object 1
   * @param {object} obj2 object 2
   * @param {string[]} ignoreKeys array of keys to ignore in comparison
   * @returns {boolean} true if the two json objects have the same length and all the properties have the same value
   */
  isEqualJson(obj1: object, obj2: object, ignoreKeys?: string[]): boolean;
  /**
   * Deep delete keys and their values from an input object. If a key in the object contains the specified key, the key and its value is deleted. With exact, only a key that equals the specified key is deleted.
   * @param {Object} object input object that needs keys removed
   * @param {String} key key to search for
   * @param {boolean} exact true to delete only keys that equal the key, false to also delete keys that contain it (default: false)
   * @returns {any} the modified object without the matching keys and their values
   */
  deleteDeepByKey(object: any, key: string, exact?: boolean): any;
  /**
   * Deep clone object
   * @param {any} obj object to deep clone
   * @returns {any} new object cloned from obj
   */
  cloneDeep(obj: any): any;
  /**
   * Deep merge two objects
   * @param obj1 first object
   * @param obj2 second object
   * @returns merged first and second object
   */
  mergeDeep(obj1: any, obj2: any): any;
  /**
   * Get all paths for an object
   * @param {any} o object
   * @param {string} prefix prefix (path calculated up to this point). Only needed for recursion or to add a global prefix to all paths.
   * @param {string} delim delimiter used to separate elements of the path. Default is '.'.
   * @returns {string[]} an array of paths
   */
  getPaths(o: any, prefix?: string, delim?: string): string[];
  findInArray(objs: any[], predicate: any): any;
  get(obj: any, path: string[], defaultValue?: any): any;
  put(obj: any, value: any, path: string[]): any;
  /**
   * Deterministic stringify
   * @param {any} obj json object to stringify deterministically
   * @returns {string} stringified json object
   */
  stringify(obj: any): string;
};

export default (): Json => {
  return {
    isEqualJson(
      obj1: object,
      obj2: object,
      ignoreKeys: string[] = []
    ): boolean {
      return isEqualJson(obj1, obj2, ignoreKeys);
    },
    deleteDeepByKey(object: any, key: string, exact: boolean = false): any {
      return deleteDeepByKey(object, key, exact);
    },
    cloneDeep(obj: any): any {
      return JSON.parse(JSON.stringify(obj));
    },
    mergeDeep(obj1: any, obj2: any): any {
      return mergeDeep(obj1, obj2);
    },
    getPaths(o: any, prefix = '', delim = '.'): string[] {
      return getPaths(o, prefix, delim);
    },
    findInArray(objs: any[], predicate: any): any {
      return findInArray(objs, predicate);
    },
    get(obj: any, path: string[], defaultValue: any = undefined): any {
      return get(obj, path, defaultValue);
    },
    put(obj: any, value: any, path: string[]): any {
      return put(obj, value, path);
    },
    stringify(obj: any): string {
      return stringify(obj);
    },
  };
};

/**
 * Compare two json objects
 * @param {object} obj1 object 1
 * @param {object} obj2 object 2
 * @param {string[]} ignoreKeys array of keys to ignore in comparison
 * @returns {boolean} true if the two json objects have the same length and all the properties have the same value
 */
export function isEqualJson(
  obj1: object,
  obj2: object,
  ignoreKeys: string[] = []
): boolean {
  const obj1Keys = Object.keys(obj1).filter((key) => !ignoreKeys.includes(key));
  const obj2Keys = Object.keys(obj2).filter((key) => !ignoreKeys.includes(key));

  if (obj1Keys.length !== obj2Keys.length) {
    return false;
  }

  for (const objKey of obj1Keys) {
    if (obj1[objKey] !== obj2[objKey]) {
      if (
        typeof obj1[objKey] === 'object' &&
        typeof obj2[objKey] === 'object'
      ) {
        if (!isEqualJson(obj1[objKey], obj2[objKey], ignoreKeys)) {
          return false;
        }
      } else {
        return false;
      }
    }
  }

  return true;
}

/**
 * Deep delete keys and their values from an input object. If a key in the object contains the specified key, the key and its value are deleted. With exact, only a key that equals the specified key is deleted.
 * @param {object} object input object that needs keys removed
 * @param {string} key key to search for
 * @param {boolean} exact true to delete only keys that equal the key, false to also delete keys that contain it (default: false)
 * @returns {any} the modified object without the matching keys and their values
 */
export function deleteDeepByKey(
  object: object,
  key: string,
  exact: boolean = false
): any {
  return deleteDeepByKeys(object, [key], exact);
}

/**
 * Deep delete keys and their values from an input object. If a key in the object contains any of the specified keys, the key and its value are deleted. With exact, only a key that equals one of the specified keys is deleted.
 * @param {object} object input object that needs keys removed
 * @param {string[]} keys keys to search for
 * @param {boolean} exact true to delete only keys that equal the key, false to also delete keys that contain it (default: false)
 * @returns {any} the modified object without the matching keys and their values
 */
export function deleteDeepByKeys(
  object: object,
  keys: string[],
  exact: boolean = false
): any {
  const obj = object;
  const objectKeys = Object.keys(obj);
  for (const objectKey of objectKeys) {
    for (const key of keys) {
      if (exact ? objectKey === key : objectKey.indexOf(key) > -1) {
        delete obj[objectKey];
        break;
      }
    }
    if (Object(obj[objectKey]) === obj[objectKey]) {
      obj[objectKey] = deleteDeepByKeys(obj[objectKey], keys, exact);
    }
  }
  return obj;
}

/**
 * Deep clone object
 * @param {any} obj object to deep clone
 * @returns {any} new object cloned from obj
 */
export function cloneDeep(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge two objects
 * @param obj1 first object
 * @param obj2 second object
 * @returns merged first and second object
 */
export function mergeDeep(obj1: any, obj2: any): any {
  if (obj1) {
    for (const key of Object.keys(obj2)) {
      // eslint-disable-next-line no-prototype-builtins
      if (!obj1.hasOwnProperty(key) || typeof obj2[key] !== 'object')
        obj1[key] = obj2[key];
      else mergeDeep(obj1[key], obj2[key]);
    }
  }
  return obj1;
}

/**
 * Get all paths for an object
 * This function was explicitly created for the shell command in the Frodo CLI
 * and has some special casing that may not leave it generic enough to be used
 * for what its name implies.
 * @param {any} o object
 * @param {string} prefix prefix (path calculated up to this point). Only needed for recursion or to add a global prefix to all paths.
 * @param {string} delim delimiter used to separate elements of the path. Default is '.'.
 * @returns {string[]} an array of paths
 */
export function getPaths(o: any, prefix = '', delim = '.'): string[] {
  const paths: string[] = [];
  for (const k of Object.keys(o)) {
    // value
    if (Object(o[k]) !== o[k]) {
      const p = prefix + k + delim + o[k];
      paths.push(p);
    }
    // function
    else if (typeof o[k] === 'function') {
      const func: string = o[k].toString().replace(/^(function|async) /g, '');
      const p = prefix + func.substring(0, func.indexOf('{')).trim();
      paths.push(p);
    }
    // object
    else {
      getPaths(o[k], prefix + k + delim, delim).forEach((p) => paths.push(p));
    }
  }
  return paths;
}

export function findInArray(objs: any[], predicate: any): any {
  const results = objs.filter((obj) => {
    for (const [key, value] of Object.entries(predicate)) {
      if (obj[key] !== value) return false;
    }
    return true;
  });
  if (results.length > 0) return results[0];
  return undefined;
}

export function get(
  obj: any,
  path: string[],
  defaultValue: any = undefined
): any {
  let result = obj;
  for (const element of path) {
    result = result[element];
    if (!result) return defaultValue;
  }
  return result;
}

export function put(obj: any, value: any, path: string[]): any {
  let ref = obj;
  for (const [i, element] of path.entries()) {
    if (!ref[element] || !(ref[element] instanceof Object)) ref[element] = {};
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    i < path.length - 1 ? (ref = ref[element]) : (ref[element] = value);
  }
  return obj;
}

/**
 * Replacer function to create deterministic output with JSON.stringify()
 * @param _key not used
 * @param value json object to sort
 * @returns sorted object
 * @see {@link https://gist.github.com/davidfurlong/463a83a33b70a3b6618e97ec9679e490}
 * @example JSON.stringify({c: 1, a: { d: 0, c: 1, e: {a: 0, 1: 4}}}, replacer);
 */
const replacer = (_key: any, value: any) =>
  value instanceof Object && !(value instanceof Array)
    ? Object.keys(value)
        .sort()
        .reduce((sorted, key) => {
          sorted[key] = value[key];
          return sorted;
        }, {})
    : value;

/**
 * Deterministic stringify
 * @param obj json object to stringify deterministically
 * @returns stringified json object
 */
export function stringify(obj: any): string {
  return JSON.stringify(obj, replacer, 2);
}
