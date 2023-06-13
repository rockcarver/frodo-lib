import fs from 'fs';
import { lstat, readdir } from 'fs/promises';
import { join } from 'path';
import slugify from 'slugify';
import {
  decode,
  decodeBase64Url,
  encode,
  encodeBase64Url,
} from '../../api/utils/Base64';
import State from '../../shared/State';
import { FRODO_METADATA_ID } from '../../storage/StaticStorage';
import { ExportMetaData } from '../OpsTypes';
import { debugMessage, printMessage } from './Console';

export default (state: State) => {
  return {
    getMetadata(): ExportMetaData {
      return getMetadata({ state });
    },

    /*
     * Output str in title case
     *
     * e.g.: 'ALL UPPERCASE AND all lowercase' = 'All Uppercase And All Lowercase'
     */
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

    getWorkingDirectory() {
      return getWorkingDirectory({ state });
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

    /**
     * Save JSON object to file
     * @param {Object} data data object
     * @param {String} filename file name
     * @return {boolean} true if successful, false otherwise
     */
    saveJsonToFile(
      data: object,
      filename: string,
      includeMeta = true
    ): boolean {
      return saveJsonToFile({ data, filename, includeMeta, state });
    },

    /**
     * Append text data to file
     * @param {String} data text data
     * @param {String} filename file name
     */
    appendTextToFile(data: string, filename: string) {
      return appendTextToFile(data, filename);
    },

    /**
     * Find files by name
     * @param {string} fileName file name to search for
     * @param {boolean} fast return first result and stop search
     * @param {string} path path to directory where to start the search
     * @returns {string[]} array of found file paths relative to starting directory
     */
    findFilesByName(fileName: string, fast = true, path = './'): string[] {
      return findFilesByName(fileName, fast, path);
    },

    /**
     * find all (nested) files in a directory
     *
     * @param directory directory to search
     * @returns list of files
     */
    async readFilesRecursive(directory: string): Promise<string[]> {
      return readFilesRecursive(directory);
    },
  };
};

export function getMetadata({ state }: { state: State }): ExportMetaData {
  const metadata: ExportMetaData = {
    origin: state.getHost(),
    originAmVersion: state.getAmVersion(),
    exportedBy: state.getUsername(),
    exportDate: new Date().toISOString(),
    exportTool: FRODO_METADATA_ID,
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

export function getWorkingDirectory({ state }: { state: State }) {
  let wd = '.';
  if (state.getDirectory()) {
    wd = state.getDirectory().replace(/\/$/, '');
    // create directory if it doesn't exist
    if (!fs.existsSync(wd)) {
      debugMessage({
        message: `ExportImportUtils.getWorkingDirectory: creating directory '${wd}'`,
        state,
      });
      fs.mkdirSync(wd, { recursive: true });
    }
  }
  return wd;
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
  fs.writeFile(filename, JSON.stringify(exportData, null, 2), (err) => {
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
 * @param {Object} data data object
 * @param {String} filename file name
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
  try {
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
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
 * @param {String} data text data
 * @param {String} filename file name
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
