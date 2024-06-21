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
   * Deep delete keys and their values from an input object. If a key in object contains substring, the key an its value is deleted.
   * @param {Object} object input object that needs keys removed
   * @param {String} substring substring to search for in key
   * @returns the modified object without the matching keys and their values
   */
  deleteDeepByKey(object: any, substring: any): any;
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
    deleteDeepByKey(object, substring) {
      return deleteDeepByKey(object, substring);
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
 * Deep delete keys and their values from an input object. If a key in object contains or equals substring, the key an its value is deleted.
 * @param {Object} object input object that needs keys removed
 * @param {String} substring substring to search for in key
 * @returns the modified object without the matching keys and their values
 */
export function deleteDeepByKey(object: any, substring: string) {
  const obj = object;
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (key.indexOf(substring) > -1) {
      delete obj[key];
    } else if (Object(obj[key]) === obj[key]) {
      obj[key] = deleteDeepByKey(obj[key], substring);
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
    i < path.length - 1 ? (ref = ref[element]) : (ref[element] = value);
  }
  ref = value;
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
