import { types } from 'util';

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
   * Deep merge the second object into the first. The first object is changed and returned. A first
   * argument that is null, undefined or otherwise falsy is returned as it is; a first argument that
   * is truthy and not an object, a frozen first object and a property of the first object that has
   * only a getter throw a TypeError. A second argument that is null, undefined or not an object
   * changes nothing. Every own enumerable string key of the second object is applied to the first
   * object, except the key __proto__, which is never copied (symbol keys are ignored). Two arrays
   * are merged by index, and the first array is never shortened. Two objects are merged key by key
   * when the value of the first object is a plain object (the value of the second object may be a
   * plain object or a class instance: an AxiosHeaders instance merges into the plain headers of the
   * first object), or when both are instances of the same class. A class instance of the first
   * object is never changed by a value of another class, a plain object included: the value of the
   * second object replaces it (a plain object given as httpsAgent replaces the shared default agent
   * and is not merged into it). The built-in value types are never merged, because their own
   * enumerable keys are not their value: a Date, RegExp, Error, Map, Set, WeakMap, WeakSet,
   * Promise, ArrayBuffer, SharedArrayBuffer, typed array, DataView, Buffer or boxed primitive
   * replaces the other value and is replaced by it. In every other case the value of the second
   * object replaces the value of the first object, whatever the type of either: a scalar replaces
   * an object or an array, an object or an array replaces a scalar (also 0, an empty string, false,
   * null and undefined), null replaces anything, an array replaces an object, an object replaces an
   * array, and a function replaces and is replaced. A key whose value is undefined in the second
   * object is assigned too. Values that are assigned are shared with the second object, not copied.
   * @param obj1 first object, changed by the merge
   * @param obj2 second object, merged into the first and not changed
   * @returns the first object, with the second object merged into it
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
 * Deep merge the second object into the first. The first object is changed and returned. A first argument that is
 * null, undefined or otherwise falsy is returned as it is; a first argument that is truthy and not an object, a frozen
 * first object and a property of the first object that has only a getter throw a TypeError. A second argument that is
 * null, undefined or not an object changes nothing.
 *
 * Every own enumerable string key of the second object is applied to the first object (symbol keys are ignored), except
 * the key `__proto__`, which is never copied. With `source` the value of the second object and `target` the own value
 * of the first object under the same key, what happens is:
 *
 * | source | target | result |
 * | --- | --- | --- |
 * | array | array | merged by index; the first array is never shortened |
 * | plain object | plain object | merged key by key |
 * | plain object | class instance | the source replaces the target (a plain object given as `httpsAgent` replaces the shared default agent and is never merged into it) |
 * | class instance | plain object | merged: the own enumerable string keys of the instance are added to the plain object (an `AxiosHeaders` instance merges into the default headers) |
 * | class instance | instance of the same class | merged key by key |
 * | class instance | instance of another class | the source replaces the target (an `https.Agent` replaces the shared default agent and is never merged into it) |
 * | Date, RegExp, Error, Map, Set, WeakMap, WeakSet, Promise, ArrayBuffer, SharedArrayBuffer, typed array, DataView, Buffer or boxed primitive | anything | the source replaces the target: the own enumerable keys of these are not their value |
 * | anything | one of those built-in value types | the source replaces the target |
 * | array | object that is not an array | the source replaces the target |
 * | object that is not an array | array | the source replaces the target |
 * | scalar, null, undefined or function | anything | the source replaces the target (also when the target is 0, an empty string, false, null or undefined) |
 * | object or array | scalar, null, undefined or function | the source replaces the target |
 *
 * A plain object is an object whose prototype is `Object.prototype` or null. A key whose value is undefined in the
 * second object is assigned too. A value that is assigned is shared with the second object, not copied.
 * @param obj1 first object, changed by the merge
 * @param obj2 second object, merged into the first and not changed
 * @returns the first object, with the second object merged into it
 */
export function mergeDeep(obj1: any, obj2: any): any {
  if (!obj1 || obj2 === null || typeof obj2 !== 'object') return obj1;
  for (const key of Object.keys(obj2)) {
    if (key === '__proto__') continue;
    const source = obj2[key];
    const target = Object.prototype.hasOwnProperty.call(obj1, key)
      ? obj1[key]
      : undefined;
    if (
      (Array.isArray(source) && Array.isArray(target)) ||
      canMergeObjects(source, target)
    )
      mergeDeep(target, source);
    else obj1[key] = source;
  }
  return obj1;
}

/**
 * Check if a value is a plain object: an object whose prototype is Object.prototype or null. SensitiveDataUtils keeps a
 * private copy of this check that is also a type predicate.
 * @param value value to check
 * @returns true if the value is a plain object, false otherwise (null, scalars, arrays, class instances and functions)
 */
function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Check if a value is one of the built-in value types: objects whose own enumerable keys are not their value, so that
 * merging keys into them makes no sense
 * @param value value to check
 * @returns true if the value is a Date, RegExp, Error, Map, Set, WeakMap, WeakSet, Promise, ArrayBuffer,
 * SharedArrayBuffer, typed array, DataView, Buffer or boxed primitive, false otherwise
 */
function isBuiltInValue(value: any): boolean {
  return (
    types.isDate(value) ||
    types.isRegExp(value) ||
    // util.types.isNativeError is deprecated and Error.isError needs Node.js 24: an Error, subclasses included, has this tag
    Object.prototype.toString.call(value) === '[object Error]' ||
    types.isMap(value) ||
    types.isSet(value) ||
    types.isWeakMap(value) ||
    types.isWeakSet(value) ||
    types.isPromise(value) ||
    types.isAnyArrayBuffer(value) ||
    types.isArrayBufferView(value) ||
    types.isBoxedPrimitive(value)
  );
}

/**
 * Check if a value is an object that can take keys by a merge: an object that is not an array and not a built-in value
 * @param value value to check
 * @returns true if the value is such an object, false otherwise
 */
function isMergeableObject(value: any): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !isBuiltInValue(value)
  );
}

/**
 * Check if the keys of a value of the second object are to be merged into the value of the first object: both are
 * mergeable objects, and the value of the first object is a plain object or an instance of the same class as the value
 * of the second object. A class instance of the first object is never changed by a source of another class (a plain
 * object included): the source replaces it.
 * @param source value of the second object
 * @param target value of the first object
 * @returns true to merge key by key, false to replace the target by the source
 */
function canMergeObjects(source: any, target: any): boolean {
  return (
    isMergeableObject(source) &&
    isMergeableObject(target) &&
    (isPlainObject(target) ||
      Object.getPrototypeOf(source) === Object.getPrototypeOf(target))
  );
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
