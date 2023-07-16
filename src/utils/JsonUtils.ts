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

/**
 * Deep clone object
 * @param {any} obj object to deep clone
 * @returns {any} new object cloned from obj
 */
export function cloneDeep(obj: any): any {
  return JSON.parse(JSON.stringify(obj));
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
