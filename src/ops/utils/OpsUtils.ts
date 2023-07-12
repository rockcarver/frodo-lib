import { State } from '../../shared/State';
import Constants from '../../shared/Constants';
import {
  getCurrentRealmName,
  getRealmName as _getRealmName,
} from '../../api/utils/ApiUtils';
import { lstat, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Reader } from 'properties-reader';
import replaceall from 'replaceall';
import * as Base64 from '../../api/utils/Base64';

export type Utils = {
  encodeB64(input: string, padding: boolean): string;
  decodeB64(input: string): string;
  encodeB64Url(input: string): string;
  decodeB64Url(input: string): string;
  /**
   * Get new name when names collide
   * @param {string} name to apply policy to
   * @returns {string} new name according to policy
   */
  applyNameCollisionPolicy(name: string): string;
  /**
   * Get the name of the managed user object for the current realm
   * @returns {string} the name of the managed user object for the current realm
   */
  getRealmManagedUser(): string;
  /**
   * Compare two json objects
   * @param {object} obj1 object 1
   * @param {object} obj2 object 2
   * @param {string[]} ignoreKeys array of keys to ignore in comparison
   * @returns {boolean} true if the two json objects have the same length and all the properties have the same value
   */
  isEqualJson(obj1: object, obj2: object, ignoreKeys?: string[]): boolean;
  /**
   * Get current realm name
   * @param {string} realm realm
   * @returns {string} name of the realm. /alpha -> alpha
   */
  getRealmName(realm: string): string;
  /**
   * find all (nested) files in a directory
   *
   * @param baseDirectory directory to search
   * @param childDirectory subdirectory to search
   * @returns list of files
   */
  readFiles(
    baseDirectory: string,
    childDirectory?: string
  ): Promise<
    {
      path: string;
      content: string;
    }[]
  >;
  substituteEnvParams(input: string, reader: Reader): string;
  unSubstituteEnvParams(input: string, reader: Reader): string;
  /**
   * Check if a string is a valid URL
   * @param {string} urlString input string to be evaluated
   * @returns {boolean} true if a valid URL, false otherwise
   */
  isValidUrl(urlString: string): boolean;
  /**
   * Deep clone object
   * @param {object} obj object to deep clone
   * @returns {object} new object cloned from obj
   */
  cloneDeep(obj: object): object;
};

export default (state: State): Utils => {
  return {
    encodeB64(input: string, padding = true): string {
      return Base64.encode(input, padding);
    },

    decodeB64(input: string): string {
      return Base64.decode(input);
    },

    encodeB64Url(input: string): string {
      return Base64.encodeBase64Url(input);
    },

    decodeB64Url(input: string): string {
      return Base64.decodeBase64Url(input);
    },

    /**
     * Get new name when names collide
     * @param {string} name to apply policy to
     * @returns {string} new name according to policy
     */
    applyNameCollisionPolicy(name: string): string {
      return applyNameCollisionPolicy(name);
    },

    /**
     * Get the name of the managed user object for the current realm
     * @returns {string} the name of the managed user object for the current realm
     */
    getRealmManagedUser(): string {
      return getRealmManagedUser({ state });
    },

    /**
     * Compare two json objects
     * @param {object} obj1 object 1
     * @param {object} obj2 object 2
     * @param {string[]} ignoreKeys array of keys to ignore in comparison
     * @returns {boolean} true if the two json objects have the same length and all the properties have the same value
     */
    isEqualJson(
      obj1: object,
      obj2: object,
      ignoreKeys: string[] = []
    ): boolean {
      return isEqualJson(obj1, obj2, ignoreKeys);
    },

    /**
     * Get current realm name
     * @param {string} realm realm
     * @returns {string} name of the realm. /alpha -> alpha
     */
    getRealmName(realm: string): string {
      return getRealmName(realm);
    },

    /**
     * find all (nested) files in a directory
     *
     * @param baseDirectory directory to search
     * @param childDirectory subdirectory to search
     * @returns list of files
     */
    async readFiles(
      baseDirectory: string,
      childDirectory = ''
    ): Promise<
      {
        path: string;
        content: string;
      }[]
    > {
      return readFiles(baseDirectory, childDirectory);
    },

    substituteEnvParams(input: string, reader: Reader) {
      return substituteEnvParams(input, reader);
    },

    unSubstituteEnvParams(input: string, reader: Reader) {
      return unSubstituteEnvParams(input, reader);
    },

    /**
     * Check if a string is a valid URL
     * @param {string} urlString input string to be evaluated
     * @returns {boolean} true if a valid URL, false otherwise
     */
    isValidUrl(urlString: string): boolean {
      return isValidUrl(urlString);
    },

    /**
     * Deep clone object
     * @param {object} obj object to deep clone
     * @returns {object} new object cloned from obj
     */
    cloneDeep(obj: object): object {
      return cloneDeep(obj);
    },
  };
};

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
 * Get current realm name
 * @param {string} realm realm
 * @returns {string} name of the realm. /alpha -> alpha
 */
export function getRealmName(realm: string): string {
  return _getRealmName(realm);
}

/**
 * find all (nested) files in a directory
 *
 * @param baseDirectory directory to search
 * @param childDirectory subdirectory to search
 * @returns list of files
 */
export async function readFiles(
  baseDirectory: string,
  childDirectory = ''
): Promise<
  {
    path: string;
    content: string;
  }[]
> {
  const targetDirectory = join(baseDirectory, childDirectory);
  const directoryItems = await readdir(targetDirectory);
  const childPaths = directoryItems.map((item) => join(childDirectory, item));

  const filePathsNested = await Promise.all(
    childPaths.map(async (childPath) => {
      const path = join(baseDirectory, childPath);
      const isDirectory = (await lstat(path)).isDirectory();

      if (isDirectory) {
        return readFiles(baseDirectory, childPath);
      }

      return {
        path: childPath,
        content: await readFile(path, 'utf8'),
      };
    })
  );

  return filePathsNested.flat();
}

export function substituteEnvParams(input: string, reader: Reader) {
  reader.each((key, value) => {
    input = replaceall(value, `\${${key}}`, input);
  });
  return input;
}

export function unSubstituteEnvParams(input: string, reader: Reader) {
  reader.each((key, value) => {
    input = replaceall(`\${${key}}`, value, input);
  });
  return input;
}

/**
 * Check if a string is a valid URL
 * @param {string} urlString input string to be evaluated
 * @returns {boolean} true if a valid URL, false otherwise
 */
export function isValidUrl(urlString: string): boolean {
  try {
    return Boolean(new URL(urlString));
  } catch (error) {
    return false;
  }
}

/**
 * Deep clone object
 * @param {object} obj object to deep clone
 * @returns {object} new object cloned from obj
 */
export function cloneDeep(obj: object): object {
  return JSON.parse(JSON.stringify(obj));
}
