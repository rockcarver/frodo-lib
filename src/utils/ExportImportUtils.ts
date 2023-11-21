import fs from 'fs';
import { lstat, readdir } from 'fs/promises';
import { join } from 'path';
import { Reader } from 'properties-reader';
import replaceall from 'replaceall';
import slugify from 'slugify';

import { ExportMetaData } from '../ops/OpsTypes';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  decode,
  decodeBase64Url,
  encode,
  encodeBase64Url,
} from './Base64Utils';
import { debugMessage, printMessage } from './Console';
import { deleteDeepByKey, stringify } from './JsonUtils';

export type ExportImport = {
  getMetadata(): ExportMetaData;
  titleCase(input: string): string;
  getRealmString(): string;
  convertBase64TextToArray(b64text: string): any[];
  convertBase64UrlTextToArray(b64UTF8Text: string): any[];
  convertTextArrayToBase64(textArray: string[]): string;
  convertTextArrayToBase64Url(textArray: string[]): any;
  validateImport(metadata: any): boolean;
  getTypedFilename(name: string, type: string, suffix?: string): string;
  getWorkingDirectory(mkdirs?: boolean): string;
  getFilePath(fileName: string, mkdirs?: boolean): string;
  saveToFile(
    type: string,
    data: object,
    identifier: string,
    filename: string
  ): void;
  /**
   * Save JSON object to file
   * @param {Object} data data object
   * @param {String} filename file name
   * @return {boolean} true if successful, false otherwise
   */
  saveJsonToFile(
    data: object,
    filename: string,
    includeMeta?: boolean
  ): boolean;
  /**
   * Append text data to file
   * @param {String} data text data
   * @param {String} filename file name
   */
  appendTextToFile(data: string, filename: string): void;
  /**
   * Find files by name
   * @param {string} fileName file name to search for
   * @param {boolean} fast return first result and stop search
   * @param {string} path path to directory where to start the search
   * @returns {string[]} array of found file paths relative to starting directory
   */
  findFilesByName(fileName: string, fast?: boolean, path?: string): string[];
  /**
   * find all (nested) files in a directory
   *
   * @param directory directory to search
   * @returns list of files
   */
  readFilesRecursive(directory: string): Promise<string[]>;

  substituteEnvParams(input: string, reader: Reader): string;

  unSubstituteEnvParams(input: string, reader: Reader): string;
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
  parseUrl(href: string): any;
  /**
   * Check if a string is a valid URL
   * @param {string} urlString input string to be evaluated
   * @returns {boolean} true if a valid URL, false otherwise
   */
  isValidUrl(urlString: string): boolean;
};

export default (state: State): ExportImport => {
  return {
    getMetadata(): ExportMetaData {
      return getMetadata({ state });
    },
    titleCase(input: string) {
      return titleCase(input);
    },
    getRealmString() {
      return getRealmString({ state });
    },
    convertBase64TextToArray(b64text: string) {
      return convertBase64TextToArray(b64text);
    },
    convertBase64UrlTextToArray(b64UTF8Text: string) {
      return convertBase64UrlTextToArray(b64UTF8Text);
    },
    convertTextArrayToBase64(textArray: string[]) {
      return convertTextArrayToBase64(textArray);
    },
    convertTextArrayToBase64Url(textArray: string[]) {
      return convertTextArrayToBase64Url(textArray);
    },
    validateImport(metadata): boolean {
      return validateImport(metadata);
    },
    getTypedFilename(name: string, type: string, suffix = 'json') {
      return getTypedFilename(name, type, suffix);
    },
    getWorkingDirectory(mkdirs = false) {
      return getWorkingDirectory({ mkdirs, state });
    },
    getFilePath(fileName: string, mkdirs = false): string {
      return getFilePath({ fileName, mkdirs, state });
    },
    saveToFile(
      type: string,
      data: object,
      identifier: string,
      filename: string
    ) {
      return saveToFile({
        type,
        data,
        identifier,
        filename,
        state,
      });
    },
    saveJsonToFile(
      data: object,
      filename: string,
      includeMeta = true
    ): boolean {
      return saveJsonToFile({ data, filename, includeMeta, state });
    },
    appendTextToFile(data: string, filename: string) {
      return appendTextToFile(data, filename);
    },
    findFilesByName(fileName: string, fast = true, path = './'): string[] {
      return findFilesByName(fileName, fast, path);
    },
    async readFilesRecursive(directory: string): Promise<string[]> {
      return readFilesRecursive(directory);
    },
    substituteEnvParams(input: string, reader: Reader): string {
      return substituteEnvParams(input, reader);
    },
    unSubstituteEnvParams(input: string, reader: Reader): string {
      return unSubstituteEnvParams(input, reader);
    },
    parseUrl(href: string): any {
      return parseUrl(href);
    },
    isValidUrl(urlString: string): boolean {
      return isValidUrl(urlString);
    },
  };
};

export function getMetadata({ state }: { state: State }): ExportMetaData {
  const metadata: ExportMetaData = {
    origin: state.getHost(),
    originAmVersion: state.getAmVersion(),
    exportedBy: state.getUsername(),
    exportDate: new Date().toISOString(),
    exportTool: Constants.FRODO_METADATA_ID,
    exportToolVersion: state.getFrodoVersion(),
  };
  return metadata;
}

/*
 * Output str in title case
 *
 * e.g.: 'ALL UPPERCASE AND all lowercase' = 'All Uppercase And All Lowercase'
 */
export function titleCase(input: string) {
  const str = input.toString();
  const splitStr = str.toLowerCase().split(' ');
  for (let i = 0; i < splitStr.length; i += 1) {
    splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].slice(1);
  }
  return splitStr.join(' ');
}

export function getRealmString({ state }: { state: State }) {
  const realm = state.getRealm();
  return realm
    .split('/')
    .reduce((result, item) => `${result}${titleCase(item)}`, '');
}

export function convertBase64TextToArray(b64text: string) {
  let arrayOut = [];
  let plainText = decode(b64text);
  plainText = plainText.replace(/\t/g, '    ');
  arrayOut = plainText.split('\n');
  return arrayOut;
}

export function convertBase64UrlTextToArray(b64UTF8Text: string) {
  let arrayOut = [];
  let plainText = decodeBase64Url(b64UTF8Text);
  plainText = plainText.replace(/\t/g, '    ');
  arrayOut = plainText.split('\n');
  return arrayOut;
}

export function convertTextArrayToBase64(textArray: string[]) {
  const joinedText = textArray.join('\n');
  const b64encodedScript = encode(joinedText);
  return b64encodedScript;
}

export function convertTextArrayToBase64Url(textArray: string[]) {
  const joinedText = textArray.join('\n');
  const b64encodedScript = encodeBase64Url(joinedText);
  return b64encodedScript;
}

// eslint-disable-next-line no-unused-vars
export function validateImport(metadata): boolean {
  return metadata || true;
}

export function getTypedFilename(name: string, type: string, suffix = 'json') {
  const slug = slugify(name.replace(/^http(s?):\/\//, ''), {
    remove: /[^\w\s$*_+~.()'"!\-@]+/g,
  });
  return `${slug}.${type}.${suffix}`;
}

export function getWorkingDirectory({
  mkdirs = false,
  state,
}: {
  mkdirs: boolean;
  state: State;
}) {
  let wd = '.';
  if (state.getDirectory()) {
    wd = state.getDirectory().replace(/\/$/, '');
    // create directory if it doesn't exist
    if (mkdirs && !fs.existsSync(wd)) {
      debugMessage({
        message: `ExportImportUtils.getWorkingDirectory: creating directory '${wd}'`,
        state,
      });
      fs.mkdirSync(wd, { recursive: true });
    }
  }
  return wd;
}

/**
 * Get the file path to a file in the working directory. If working directory does not exist, it will return the fileName as the file path.
 * @param fileName The file name
 * @param mkdirs If directories to working directory don't exist, makes the directories if true, and if false does not make the directories. Default: false
 * @return The file path to the file in the working directory
 */
export function getFilePath({
  fileName,
  mkdirs = false,
  state,
}: {
  fileName: string;
  mkdirs: boolean;
  state: State;
}): string {
  return state.getDirectory()
    ? `${getWorkingDirectory({ mkdirs, state })}/${fileName}`
    : fileName;
}

export function saveToFile({
  type,
  data,
  identifier,
  filename,
  state,
}: {
  type: string;
  data: object;
  identifier: string;
  filename: string;
  state: State;
}) {
  const exportData = {};
  exportData['meta'] = getMetadata({ state });
  exportData[type] = {};

  if (Array.isArray(data)) {
    data.forEach((element) => {
      exportData[type][element[identifier]] = element;
    });
  } else {
    exportData[type][data[identifier]] = data;
  }
  fs.writeFile(filename, stringify(exportData), (err) => {
    if (err) {
      return printMessage({
        message: `ERROR - can't save ${type} to file`,
        state,
        type: 'error',
      });
    }
    return '';
  });
}

/**
 * Save JSON object to file
 * @param {any} data data object
 * @param {string} filename file name
 * @return {boolean} true if successful, false otherwise
 */
export function saveJsonToFile({
  data,
  filename,
  includeMeta = true,
  state,
}: {
  data: object;
  filename: string;
  includeMeta?: boolean;
  state: State;
}): boolean {
  const exportData = data;
  if (includeMeta) exportData['meta'] = getMetadata({ state });
  deleteDeepByKey(exportData, '_rev');
  try {
    fs.writeFileSync(filename, stringify(exportData));
    return true;
  } catch (err) {
    printMessage({
      message: `ERROR - can't save ${filename}`,
      type: 'error',
      state,
    });
    return false;
  }
}

/**
 * Append text data to file
 * @param {string} data text data
 * @param {string} filename file name
 */
export function appendTextToFile(data: string, filename: string) {
  fs.appendFileSync(filename, data);
}

/**
 * Find files by name
 * @param {string} fileName file name to search for
 * @param {boolean} fast return first result and stop search
 * @param {string} path path to directory where to start the search
 * @returns {string[]} array of found file paths relative to starting directory
 */
export function findFilesByName(
  fileName: string,
  fast = true,
  path = './'
): string[] {
  const entries = fs.readdirSync(path, {
    encoding: 'utf8',
    withFileTypes: true,
  });

  // Get files within the current directory and add a path key to the file objects
  const files: string[] = entries
    .filter((entry) => !entry.isDirectory())
    .filter((file) => file.name === fileName)
    // .map((file) => ({ ...file, path: path + file.name }));
    .map((file) => path + file.name);

  if (fast && files.length > 0) return files;

  // search sub-folders
  const folders = entries.filter((entry) => entry.isDirectory());
  for (const folder of folders)
    files.push(...findFilesByName(fileName, fast, `${path}${folder.name}/`));

  return files;
}

/**
 * find all (nested) files in a directory
 *
 * @param directory directory to search
 * @returns list of files
 */
export async function readFilesRecursive(directory: string): Promise<string[]> {
  const items = await readdir(directory);

  const filePathsNested = await Promise.all(
    items.map(async (entity) => {
      const path = join(directory, entity);
      const isDirectory = (await lstat(path)).isDirectory();

      if (isDirectory) {
        return readFilesRecursive(path);
      }
      return path;
    })
  );

  return filePathsNested.flat();
}

export function substituteEnvParams(input: string, reader: Reader): string {
  reader.each((key, value) => {
    input = replaceall(value, `\${${key}}`, input);
  });
  return input;
}

export function unSubstituteEnvParams(input: string, reader: Reader): string {
  reader.each((key, value) => {
    input = replaceall(`\${${key}}`, value, input);
  });
  return input;
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
export function parseUrl(href: string): any {
  const m = href.match(
      /^(([^:/?#]+):?(?:\/\/((?:([^/?#:]*):([^/?#:]*)@)?([^/?#:]*)(?::([^/?#:]*))?)))?([^?#]*)(\?[^#]*)?(#.*)?$/
    ),
    r = {
      hash: m[10] || '',
      host: m[3] || '',
      hostname: m[6] || '',
      href: m[0] || '',
      origin: m[1] || '',
      pathname: m[8] || (m[1] ? '/' : ''),
      port: m[7] || '',
      protocol: m[2] || '',
      search: m[9] || '',
      username: m[4] || '',
      password: m[5] || '',
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
 * Performs an export given a function with its parameters with custom error handling that will just print the error if one is thrown and return null.
 * @param exportFunction The export function.
 * @param parameters The parameters to call the export function with. By default, it is { state }.
 * @returns {Promise<R | null>} Returns the result of the export function, or null if an error is thrown
 */
export async function exportWithErrorHandling<P extends { state: State }, R>(
  exportFunction: (params: P) => Promise<R>,
  parameters: P
): Promise<R | null> {
  try {
    return await exportFunction(parameters);
  } catch (e) {
    printMessage({
      message: `ERROR: ${e.message}`,
      type: 'error',
      state: parameters.state,
    });
    return null;
  }
}
