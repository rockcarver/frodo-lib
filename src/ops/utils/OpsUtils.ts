import State from '../../shared/State';
import * as globalConfig from '../../storage/StaticStorage';
import {
  getCurrentRealmName,
  getRealmName as _getRealmName,
} from '../../api/utils/ApiUtils';
import { lstat, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Reader } from 'properties-reader';
import replaceall from 'replaceall';

// TODO: do we really need this? if yes: document
export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// TODO: do we really need this? if yes: document
export function replaceAll(str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

/**
 * Get new name when names collide
 * @param {String} name to apply policy to
 * @returns {String} new name according to policy
 */
export function applyNameCollisionPolicy(name) {
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
 * @returns {String} the name of the managed user object for the current realm
 */
export function getRealmManagedUser({ state }: { state: State }) {
  let realmManagedUser = 'user';
  if (state.getDeploymentType() === globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY) {
    realmManagedUser = `${getCurrentRealmName()}_user`;
  }
  return realmManagedUser;
}

/**
 * Compare two json objects
 * @param {Object} obj1 object 1
 * @param {Object} obj2 object 2
 * @param {[String]} ignoreKeys array of keys to ignore in comparison
 * @returns {boolean} true if the two json objects have the same length and all the properties have the same value
 */
export function isEqualJson(obj1, obj2, ignoreKeys: string[] = []) {
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
 * @param {String} realm realm
 * @returns {String} name of the realm. /alpha -> alpha
 */
export function getRealmName(realm) {
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
export function isValidUrl(urlString: string) {
  try {
    return Boolean(new URL(urlString));
  } catch (error) {
    return false;
  }
}

/**
 * Deep clone object
 * @param {any} obj object to deep clone
 * @returns {any} new object cloned from obj
 */
export function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}
