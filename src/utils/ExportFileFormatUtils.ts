import slugify from 'slugify';
import { deleteDeepByKeys, stringify } from './JsonUtils';

/**
 * The format of the files that the library writes and reads: the JSON text of an export, the names of its files and
 * the placeholders in it. Everything here is a pure function (text from data, data from text, names from names): it
 * reads no file, no state and no clock, prints nothing and throws plain errors. `ExportImportUtils.ts` wraps these
 * functions with the file system and the state (and with `FrodoError`); a file set builds on them without the file
 * system.
 */

/** The key under which the export envelope (the metadata of an export) is kept. */
const META_KEY = 'meta';

/** The keys that `serializeExportJson` removes unless `keepRev` is set. */
const REV_KEYS = ['_rev'];

/** The keys that `serializeExportJson` removes unless `keepModifiedProperties` is set. */
const MODIFIED_PROPERTY_KEYS = [
  'lastModifiedBy',
  'lastModifiedDate',
  'modified',
  'modifiedDate',
  'lastChangeDate',
  'lastChangedBy',
  'lastChanged',
  'createdBy',
  'creationDate',
  'createdDate',
];

/** The prefix of a placeholder name whose value is Base64 encoded: `${BASE64:NAME}`. */
const BASE64_PRE_ENCODED_PREFIX = 'BASE64:';

/**
 * Gives the value for the name of a placeholder, or undefined if there is none (an empty string is a value).
 */
export type PlaceholderLookup = (name: string) => string | undefined;

/**
 * Whether a value is the export envelope: the metadata of an export (it names the tool that wrote it), or the empty
 * `{}` placeholder that a caller puts in a file template before the envelope is filled in.
 * @param {unknown} value value to check
 * @returns {boolean} true if the value is an export envelope, false otherwise
 */
function isExportEnvelope(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as { exportTool?: unknown };
  return (
    Object.keys(candidate).length === 0 ||
    typeof candidate.exportTool === 'string'
  );
}

/**
 * Turn data into the text of an export file: a copy of the data with the envelope handled, `_rev` and the modified
 * properties removed at every depth, the keys sorted at every depth, indented by two spaces, with one newline at the
 * end. The data and the metadata are never changed; the work is done on copies.
 *
 * The envelope (the top level `meta` key): with `includeMeta`, the metadata given is added unless the data already has a
 * `meta` that is not empty (null, an empty string, zero and false count as empty); without `includeMeta`, a top level
 * `meta` is removed only if it is the export envelope (it has an `exportTool` that is a string, or it is the empty
 * object). Any other top level `meta` is data, for example the `meta` relationship configuration of an IGA managed
 * object, and stays.
 *
 * `_rev` is removed unless `keepRev` is set. These ten keys are removed unless `keepModifiedProperties` is set:
 * `lastModifiedBy`, `lastModifiedDate`, `modified`, `modifiedDate`, `lastChangeDate`, `lastChangedBy`, `lastChanged`,
 * `createdBy`, `creationDate` and `createdDate`. A key is removed when it equals one of these exactly, whatever its
 * value, and its value goes with it.
 * @param {object} data the data to write; not changed
 * @param {object} metadata the metadata header to add (origin, versions, date and so on); not changed
 * @param {boolean} includeMeta true to include the metadata header, false to remove the envelope. Default: true
 * @param {boolean} keepRev true to keep the `_rev` keys. Default: false
 * @param {boolean} keepModifiedProperties true to keep the modified properties. Default: false
 * @returns {string} the text of the file
 * @throws {TypeError} if the data cannot be turned into JSON (a circular reference, a BigInt)
 */
export function serializeExportJson({
  data,
  metadata,
  includeMeta = true,
  keepRev = false,
  keepModifiedProperties = false,
}: {
  data: object;
  metadata: object;
  includeMeta?: boolean;
  keepRev?: boolean;
  keepModifiedProperties?: boolean;
}): string {
  const exportData = JSON.parse(JSON.stringify(data));
  if (includeMeta && !exportData[META_KEY]) {
    exportData[META_KEY] = JSON.parse(JSON.stringify(metadata));
  }
  if (!includeMeta && isExportEnvelope(exportData[META_KEY])) {
    delete exportData[META_KEY];
  }
  const keysToDelete = [
    ...(keepRev ? [] : REV_KEYS),
    ...(keepModifiedProperties ? [] : MODIFIED_PROPERTY_KEYS),
  ];
  if (keysToDelete.length) {
    deleteDeepByKeys(exportData, keysToDelete, true);
  }
  return withTrailingNewline(stringify(exportData));
}

/**
 * Turn the text of an export file into data. Placeholders are not touched: resolve them first with
 * {@link resolvePlaceholders} if they are to be filled.
 * @param {string} content the text of the file
 * @returns {object} the data
 * @throws {SyntaxError} if the text is not JSON
 */
export function parseExportJson(content: string): object {
  return JSON.parse(content);
}

/**
 * Fill the placeholders of a text. A placeholder is `${NAME}`: it is replaced, everywhere it occurs, by the value that
 * the lookup gives for NAME. For `${BASE64:NAME}` the lookup is asked for NAME and the value it gives is decoded from
 * Base64 (UTF-8) before it is used. A placeholder that is escaped with two backslashes in front (`\\${NAME}`) is not
 * filled and is written without them (`${NAME}`). The lookup is asked once for each placeholder, in the order they
 * appear in the text, and not at all if the text has none. A `${` that is never closed with a `}` is not a placeholder
 * and the text is then returned as it is.
 * @param {string} content the text
 * @param {PlaceholderLookup} lookup gives the value for a name
 * @returns {string} the text with the placeholders filled and the escaped placeholders unescaped
 * @throws {Error} if the lookup gives no value for a name; the message names the placeholder, never a value
 */
export function resolvePlaceholders({
  content,
  lookup,
}: {
  content: string;
  lookup: PlaceholderLookup;
}): string {
  let newContent = content;
  const placeholders = content.match(/\\*?\${.*?}/g);
  if (!placeholders) {
    return newContent;
  }
  const resolvable = placeholders.filter((p) => !p.startsWith('\\\\'));
  for (const placeholder of resolvable) {
    let placeholderName = placeholder.replace(/\${(.*)}/, '$1');
    let decodeValue = false;
    if (placeholderName.startsWith(BASE64_PRE_ENCODED_PREFIX)) {
      decodeValue = true;
      placeholderName = placeholderName.substring(
        BASE64_PRE_ENCODED_PREFIX.length
      );
    }
    const value = lookup(placeholderName);
    if (value === undefined) {
      throw new Error(`No value found for placeholder "${placeholderName}"`);
    }
    const resolvedValue = decodeValue
      ? Buffer.from(value, 'base64').toString('utf-8')
      : value;

    newContent = newContent.replaceAll(placeholder, resolvedValue);
  }
  return unescapePlaceholders(newContent);
}

/**
 * Put a list of objects, or one object, into the envelope of an export file: `{ [type]: { [id]: object } }`, where the
 * id of an object is the value of its `identifier` key. An object without that key is put under the key `undefined`, and
 * a later object with the same id replaces an earlier one. The objects are not copied and not changed.
 * @param {string} type the type, the key of the envelope (`script`, `trees`, ...)
 * @param {object} data one object, or a list of objects
 * @param {string} identifier the key of an object that holds its id
 * @returns {Record<string, Record<string, object>>} the envelope, a new object
 */
export function buildExportEnvelope({
  type,
  data,
  identifier,
}: {
  type: string;
  data: object;
  identifier: string;
}): Record<string, Record<string, object>> {
  const exportData: Record<string, Record<string, object>> = {};
  exportData[type] = {};

  if (Array.isArray(data)) {
    data.forEach((element) => {
      exportData[type][element[identifier]] = element;
    });
  } else {
    exportData[type][data[identifier]] = data;
  }
  return exportData;
}

/**
 * Make sure a text ends with a newline: add one if it does not end with one, and add nothing if it does.
 * @param {string} text the text
 * @returns {string} the text, ending with a newline
 */
export function withTrailingNewline(text: string): string {
  return text + (text.endsWith('\n') ? '' : '\n');
}

/**
 * The name of the file for an object: `<name>.<type>.<suffix>`, where the name is made a slug (an `http://` or `https://`
 * at its start is dropped; only letters, digits, whitespace and `$*_+~.()'"!-@` are kept; whitespace becomes `-`).
 * Two authentication modules whose names differ only in case (`Federation` and `federation`) must not meet on a file
 * system that ignores case: `Federation` gives `federation.authenticationModules.json` and `federation` gives
 * `federation_.authenticationModules.json` (the case applies to the type `authenticationModules` only, and to these two
 * spellings only).
 * @param {string} name the name of the object
 * @param {string} type the type of the object
 * @param {string} suffix the suffix. Default: json
 * @returns {string} the file name
 */
export function getTypedFilename(
  name: string,
  type: string,
  suffix = 'json'
): string {
  // Special case: Handle both "Federation" and "federation" authentication modules
  // to avoid filename conflicts in case-insensitive filesystems
  if (type === 'authenticationModules' && name.toLowerCase() === 'federation') {
    if (name === 'Federation') {
      return `federation.${type}.${suffix}`;
    }
    if (name === 'federation') {
      return `federation_.${type}.${suffix}`;
    }
  }

  const slug = slugify(name.replace(/^http(s?):\/\//, ''), {
    remove: /[^\w\s$*_+~.()'"!\-@]+/g,
  });
  return `${slug}.${type}.${suffix}`;
}

/**
 * The file name as the library reads it after it has been built: every backslash is read as a slash, and every `C:` (a
 * capital C and a colon, anywhere in the name) is removed. What this function gives is what the file system sees, so a
 * check of a path has to be made on its result, not on the text before it (`..C:` becomes `..`).
 * @param {string} fileName the file name
 * @returns {string} the file name with slashes and without `C:`
 */
export function normalizeFilePath(fileName: string): string {
  return fileName.replaceAll('\\', '/').replaceAll('C:', '');
}

/**
 * Put the working directory in front of a file name: `<directory>/<fileName>`, with one trailing slash of the directory
 * dropped. Without a working directory (an empty string) the file name is the path.
 * @param {string} directory the working directory, or an empty string for none
 * @param {string} fileName the file name, as {@link normalizeFilePath} gives it
 * @returns {string} the path of the file
 */
export function joinWorkingDirectory(
  directory: string,
  fileName: string
): string {
  return directory ? `${directory.replace(/\/$/, '')}/${fileName}` : fileName;
}

/**
 * Escape any placeholders so they are not resolved as environment placeholders
 *
 * @param {object} content the object to escape placeholders in
 * @returns {object} a new object with all `${` sequences escaped
 */
export function escapePlaceholders(content: object): object {
  return JSON.parse(JSON.stringify(content).replace(/\$\{/g, '\\\\${'));
}

/**
 * Unescape any escaped placeholders back to their original form
 *
 * @param {string} content the raw content to unescape
 * @returns {string} the content with all escaped placeholders restored
 */
export function unescapePlaceholders(content: string): string {
  return content.replace(/\\\\\${/g, '${');
}
