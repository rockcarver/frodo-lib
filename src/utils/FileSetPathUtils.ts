import { posix } from 'path';
import sanitize from 'sanitize-filename';

/**
 * Where an object, or a realm, lives in a file set. A selector (an id or a name that a person types) is an id or a name,
 * never a path: whatever it says, these functions give one name inside the folder they are asked for, or throw. They are
 * pure (no file system, no state, no clock) and follow POSIX rules on every platform: a path is made of `/`, and a
 * backslash is an ordinary character that {@link referencedFilePath} and {@link realmFolderOf} refuse and that
 * {@link safeFileName} writes as `%5C`. {@link assertFileSetPath} is the one gate that every path of a file set passes.
 * Every command, every pull and push and every test can share them.
 */

/** The longest name of one file or folder, in bytes, on the file systems that a file set is written to. */
const MAX_PATH_SEGMENT_BYTES = 255;

/** The longest file name, 255 bytes on the usual file systems, less the extension `.json`. */
const MAX_FILE_NAME_BYTES = 250;

/**
 * An id or a name made safe for a file system: a character that a file name cannot hold is percent-encoded (`/` becomes
 * `%2F`, a backslash `%5C`), the characters `*` are removed, and a name that is only dots, or a device name of Windows
 * (`con`, `nul.txt`), becomes empty. The name is cut at 255 bytes.
 * @param {string} filename the id or the name
 * @returns {string} the file name, which may be empty (a name of only dots, a device name of Windows)
 */
export function safeFileName(filename: string): string {
  return sanitize(filename, {
    replacement: (character) => encodeURIComponent(character),
  });
}

/**
 * An id or a name made safe for a file system, with an underscore for every character that a file name cannot hold
 * (`a/b` becomes `a_b`). A name that is only dots, a device name of Windows (`con`) or a name that ends with a dot or a
 * space gets an underscore in its place or at its end (`con` becomes `_`, `a.` becomes `a_`). Two different ids may give
 * the same name. The name is cut at 255 bytes.
 * @param {string} filename the id or the name
 * @returns {string} the file name
 */
export function safeFileNameUnderscore(filename: string): string {
  return sanitize(filename, {
    replacement: '_',
  });
}

/**
 * The file name (without the extension) of an object: its id made safe for a file system by {@link safeFileName}, and cut
 * to what a file name can hold. The servers accept ids of thousands of characters, and `safeFileName` cuts at 255 bytes,
 * which leaves no room for the extension `.json`: this name is cut at 250 bytes, at a whole character, and does not end
 * with a dot or a space.
 * @param {string} value the id or the name of the object
 * @returns {string} the file name without the extension, which may be empty
 */
export function fileNameOf(value: string): string {
  const name = safeFileName(value);
  if (Buffer.byteLength(name) <= MAX_FILE_NAME_BYTES) return name;
  // cut at a byte count, then drop the half character the cut may leave and what a file name cannot end with
  return Buffer.from(name)
    .subarray(0, MAX_FILE_NAME_BYTES)
    .toString('utf8')
    .replace(/\uFFFD+$/, '')
    .replace(/[. ]+$/, '');
}

/**
 * The segments of a path, as a path is read without a file system: the path is normalized (`.` and `a/..` go, `//`
 * becomes `/`) and split. A relative path keeps the `..` that lead it, because there is no working directory to resolve
 * them against.
 * @param {string} path the path
 * @returns {{ absolute: boolean; segments: string[] }} whether the path starts at the root, and its segments
 */
function segmentsOf(path: string): { absolute: boolean; segments: string[] } {
  const normalized = posix.normalize(path);
  return {
    absolute: normalized.startsWith('/'),
    segments: normalized.split('/').filter((s) => s !== '' && s !== '.'),
  };
}

/**
 * Throws unless the target is strictly inside the root. The test is on the segments of the path from the root to the
 * target (a name that starts with two dots, `..foo`, is inside; a string prefix test would take `/set/alpha-evil` for a
 * part of `/set/alpha`). Both paths are read as they are written: a relative root and a relative target are compared with
 * each other and are never resolved against a working directory, and an absolute path is never inside a relative one, or
 * the other way round.
 *
 * The rules are POSIX rules on every platform: `/` separates and a backslash is an ordinary character. A path of Windows
 * with backslashes is therefore one name, not a path: `assertInside('C:\\cfg', 'C:\\cfg\\x.json')` throws, while
 * `assertInside('C:/cfg', 'C:/cfg/x.json')` does not. A caller that holds such a path hands it over with `/` (the rewrite of
 * `getFilePath` of `ExportImportUtils` does the same before it reads a path). The tests of this module run on Linux
 * only: the cross-platform job of the pipeline runs a short list of other files.
 * @param {string} root the folder
 * @param {string} target the path that has to be inside it
 * @throws {Error} if the target is the root itself, or outside it
 */
export function assertInside(root: string, target: string): void {
  const from = segmentsOf(root);
  const to = segmentsOf(target);
  const inside =
    from.absolute === to.absolute &&
    to.segments.length > from.segments.length &&
    from.segments.every((segment, index) => to.segments[index] === segment) &&
    to.segments
      .slice(from.segments.length)
      .every((segment) => segment !== '..');
  if (!inside) {
    throw new Error(`The path '${target}' is not inside '${root}'.`);
  }
}

/**
 * Whether a value is one name that a file or a folder of a file set can have: it is not empty, it is not `.` or `..`, and it
 * holds no `/`, no `\`, no control character and no `C:`. `getFilePath` of `ExportImportUtils` rewrites a path after it is
 * built (it reads `\` as `/` and removes every `C:`, so `..C:` becomes `..`): what it rewrites is not a name, and a caller
 * that needs a file for such a value uses {@link fileNameOf}, which writes the colon as `%3A`. Any other colon
 * (`Login:SSO`) is an ordinary character of a name.
 * @param {string} value the id or the name
 * @returns {boolean} true if the value is one safe segment of a path
 */
export function isOneSafeSegment(value: string): boolean {
  return (
    value !== '' &&
    value !== '.' &&
    value !== '..' &&
    !/[/\\\p{Cc}]|C:/u.test(value)
  );
}

/**
 * The name that an id or a name has in a folder of a file set. A value that is one name (no separator, no `C:`, not `.`
 * or `..`, no control character) is that name, as typed; any other value is turned into the file name of an id, which
 * writes the characters of a path as `%XX` (`a/b` is `a%2Fb`). The name is not cut: a name that a file system cannot hold
 * fails where it is written, so that two long names never become one.
 *
 * This function looks at the name only, not at the path that the name ends up in. A name of 251 to 255 bytes passes here
 * and its file, `<name>.json`, has a part of more than 255 bytes; a value that is one long safe name is returned as it is;
 * a lone surrogate passes here. `assertFileSetPath` refuses each of these paths, and so does `buildFileSet`, for the whole
 * set: a caller that wants such an id to fail alone checks its path first.
 * @param {string} value the id or the name
 * @returns {string} the name without the extension
 * @throws {Error} if the value leaves no name (`.`, `..`, empty), or is longer than a file name can be once encoded
 */
export function nameInFolder(value: string): string {
  const text = String(value);
  if (isOneSafeSegment(text)) return text;
  // the function that writes the characters of a path as `%XX` cuts a name at 255 bytes, silently
  if (encodedBytes(text) > MAX_PATH_SEGMENT_BYTES) throw nameTooLong(text);
  const name = safeFileName(text);
  if (name === '') {
    throw new Error(
      `'${shownInMessage(text)}' does not name an object: an id or a name is not a path`
    );
  }
  return name;
}

/**
 * How many bytes the file name of an id has when the function that makes it cuts it (at 255 bytes, silently): the
 * characters of a path written as `%XX`, and a `*` still in it, because the cut is made before the `*` is removed.
 * @param {string} text the id or the name
 * @returns {number} the length in bytes
 */
function encodedBytes(text: string): number {
  return Buffer.byteLength(
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u0080-\u009f/?<>\\:|"]/g, (character) =>
        encodeURIComponent(character)
      )
  );
}

/**
 * The error for a name that is longer than a file name can be.
 * @param {string} name the name
 * @returns {Error} the error, which names the name
 */
function nameTooLong(name: string): Error {
  return new Error(
    `The name '${shownInMessage(name)}' is longer than ${MAX_PATH_SEGMENT_BYTES} bytes once encoded, so it cannot be the name of a file.`
  );
}

/**
 * The file name of a name that a file is always named after in its encoded form (the script of a pull is `<name>.js`,
 * with `:`, `?` and the other characters of a path written as `%XX`). It is {@link safeFileName} that does not cut and is
 * not empty: where `safeFileName` cuts a name at 255 bytes without a word, and {@link fileNameOf} (the agent types) cuts it
 * at 250, this function refuses a name that leaves nothing (`.`, `..`, a run of dots, a device name of Windows) or that is
 * more than 255 bytes once encoded, naming it, so that two long names never become one. Like {@link nameInFolder} it looks at
 * the name only: a name of 251 to 255 bytes passes, and its file `<name>.json` is refused by `assertFileSetPath` (and by
 * `buildFileSet`, for the whole set).
 * @param {string} value the name
 * @returns {string} the file name without the extension
 * @throws {Error} if the value leaves no name, or is longer than a file name can be
 */
export function encodedName(value: string): string {
  const text = String(value);
  if (encodedBytes(text) > MAX_PATH_SEGMENT_BYTES) throw nameTooLong(text);
  const name = safeFileName(text);
  if (name === '') {
    throw new Error(
      `'${shownInMessage(text)}' does not name an object: an id or a name is not a path`
    );
  }
  return name;
}

/**
 * The name that an id or a name has as the start of a file name that a file of the set refers to (`<name>.<key>.js`,
 * `<name>.<language>.html`): {@link nameInFolder}, and a name that starts with a letter and a colon (`a:b`) writes that
 * colon as `%3A`, because a reference that starts so is a drive letter, which {@link referencedFilePath} refuses. Any
 * other colon (`Login:SSO`) stays.
 * @param {string} value the id or the name
 * @returns {string} the start of the file name
 * @throws {Error} if the value leaves no name (`.`, `..`, empty)
 */
export function nameInStem(value: string): string {
  const name = nameInFolder(value);
  return /^[A-Za-z]:/.test(name) ? `${name[0]}%3A${name.slice(2)}` : name;
}

/**
 * A value as a message shows it: a control character is written as `\u0001`, so that it cannot change what a terminal
 * shows, and a long value is cut.
 * @param {string} text the value
 * @returns {string} the value for a message
 */
function shownInMessage(text: string): string {
  const escaped = String(text).replace(
    /\p{Cc}/gu,
    (character) =>
      `\\u${(character.codePointAt(0) as number).toString(16).padStart(4, '0')}`
  );
  return escaped.length > 100 ? `${escaped.slice(0, 100)}...` : escaped;
}

/**
 * The path that `candidate` names inside `folder`, or an error that says the value is not a name.
 * @param {string} folder the folder
 * @param {string} value the id or the name that the candidate was made from
 * @param {string} candidate the path
 * @returns {string} the candidate
 */
function inside(folder: string, value: string, candidate: string): string {
  try {
    assertInside(folder, candidate);
  } catch {
    throw new Error(
      `'${value}' does not name an object: an id or a name is not a path`
    );
  }
  return candidate;
}

/**
 * The file of an object: `<folder>/<name>.json`, directly in the folder. The name is the id or the name as typed when that
 * is one name, else the file name of an id. A caller that wants only the file name of an id (the three agent types)
 * passes `fileNameOf(id)`, which is empty for a name that a file system cannot have (`con`): an empty value is that name,
 * made already, and its file is `.json`. An id or a name that is `.` or `..` is not a name.
 * @param {string} folder the folder of the type
 * @param {string} value the id or the name of the object
 * @returns {string} the path of the file
 * @throws {Error} if the value is `.` or `..`, or the file would not be inside the folder
 */
export function objectFilePath(folder: string, value: string): string {
  const name = value === '' ? '' : nameInFolder(value);
  return inside(folder, value, `${folder}/${name}.json`);
}

/**
 * The folder of an object that has a folder of its own: `<folder>/<name>`. The name is the id or the name as typed when
 * that is one name, else the file name of an id. The folder is never the folder itself or its parent.
 * @param {string} folder the folder of the type
 * @param {string} value the id or the name of the object
 * @returns {string} the path of the folder of the object
 * @throws {Error} if the folder would not be inside the folder of the type (`..`, `.`)
 */
export function objectFolderPath(folder: string, value: string): string {
  return inside(folder, value, `${folder}/${nameInFolder(value)}`);
}

/**
 * The folder of a realm in a file set: `root` for the root realm, the name of the realm otherwise, and a sub-realm
 * `/parent/child` in a folder `parent/child` (a leading `/` and empty parts go). A realm is a name or a path of names,
 * never a path of the file system.
 * @param {string} realm the realm, as a person or the state names it
 * @returns {string} the folder, relative to the `realms` folder
 * @throws {Error} if the realm is empty, or a part of it is `.` or `..` or holds a backslash, `C:`, a control character, `?`, `#` or `%`
 */
export function realmFolderOf(realm: string): string {
  if (realm === '/') return 'root';
  const parts = realm.split('/').filter((part) => part !== '');
  if (
    parts.length === 0 ||
    parts.some(
      (part) => part === '.' || part === '..' || /[\\?#%\p{Cc}]|C:/u.test(part)
    )
  ) {
    throw new Error(
      `The realm '${realm}' is not '/', a name or a path of names.`
    );
  }
  return parts.join('/');
}

/**
 * The path of the file that a file reference in a file of the set names: the reference joined to the folder it is relative
 * to (a script, a theme field, an email template, a mapping). A reference is a relative path of the folder it is found in,
 * and the file it names is in that folder or below it: a reference that leaves the folder (`..` as a segment that goes
 * above it), is empty, is an absolute path, starts with a drive letter (`C:\x`, `c:x`), holds `C:` anywhere or holds a
 * control character is not a file of the folder. `getFilePath` of `ExportImportUtils` rewrites a path after it is built (it
 * reads `\` as `/` and removes every `C:`, so `..C:/x` would become `../x`), so the test is made on the reference with `\`
 * read as `/`, and a `C:` is refused anywhere: what is read is what was tested. Any other colon (`sub/a:b.js`) is an
 * ordinary character. The test is on the text of the path, so a file system link is not followed or looked at. A name that
 * merely holds two dots (`a..b.js`, `..foo.js`) is a name.
 * @param {string} folder the folder that the reference is relative to
 * @param {string} reference the reference, as the file holds it (`./x`, `sub/x.js`, `scripts-content/<context>/<name>.js`)
 * @returns {string} the path of the file, `folder` joined to the reference
 * @throws {Error} if the reference is not a string, or does not name a file inside the folder
 */
export function referencedFilePath(folder: string, reference: string): string {
  const refused = (): Error => {
    const shown =
      typeof reference === 'string'
        ? reference.replace(
            /\p{Cc}/gu,
            (character) =>
              `\\u${(character.codePointAt(0) as number).toString(16).padStart(4, '0')}`
          )
        : (JSON.stringify(reference) ?? String(reference));
    return new Error(
      `The file reference '${shown}' must stay inside the config folder.`
    );
  };
  if (typeof reference !== 'string') throw refused();
  const text = reference.replaceAll('\\', '/');
  if (/\p{Cc}|C:|^[A-Za-z]:/u.test(text) || text.startsWith('/')) {
    throw refused();
  }
  const candidate = posix.join(folder, text);
  try {
    assertInside(folder, candidate);
  } catch {
    throw refused();
  }
  return candidate;
}

/**
 * What two names share when a file system takes them for one: case and Unicode form do not count (`A.json` and `a.json`,
 * or a name in two Unicode forms, are one file on a file system that ignores the difference, and a character that is not
 * text, a lone surrogate, is written as U+FFFD, so two of them are one name). A file set that holds two paths with the
 * same value here would lose one of them on such a file system.
 * @param {string} name the name or the path
 * @returns {string} the name in one form
 */
export function sameOnAnyFileSystem(name: string): string {
  return name.toWellFormed().normalize('NFC').toLowerCase().normalize('NFC');
}

/**
 * Why a value is not one name of a file or a folder (see {@link isOneSafeSegment}), in the words of a message.
 * @param {string} segment the part of a path that {@link isOneSafeSegment} refused
 * @returns {string} the reason, to follow "it"
 */
function whyNotOneName(segment: string): string {
  if (segment === '') return 'has an empty part';
  if (segment === '.' || segment === '..') {
    return `has '${segment}' as a part`;
  }
  if (/\p{Cc}/u.test(segment)) return 'holds a control character';
  if (segment.includes('\\')) return 'holds a backslash';
  if (segment.includes('C:')) return "holds 'C:'";
  return 'has a part that is not a name';
}

/**
 * The one gate that every path of a file set passes, for a file and for a folder: the path is relative to the root of the
 * file set, its parts are separated by `/`, and every part is one name. It throws for a path that is empty, starts with
 * `/` (absolute) or with a drive letter (`c:/x`, `c:`), has an empty part (`a//b`, `a/`), has `.` or `..` as a part,
 * holds a backslash, a control character or `C:` (the library rewrites a path after it is built: it reads `\` as `/` and
 * removes every `C:`, so what it writes is not what was checked), holds a character that is not text (a lone surrogate),
 * or has a part of more than 255 bytes. Any other colon (`a:b.json`) and a name that holds dots (`..foo.json`) are
 * ordinary. It looks at the text only: it knows no file system, so it cannot see a link, and it cannot see that two paths
 * are one file on a file system that ignores case; {@link sameOnAnyFileSystem} is the key for that.
 * @param {string} path the path of a file or of a folder, relative to the root of the file set
 * @throws {Error} if the path is not a path inside a file set; the message holds the path (a control character is written as an escape) and the reason
 */
export function assertFileSetPath(path: string): void {
  if (typeof path !== 'string' || path === '') {
    throw new Error('A file of a file set needs a path.');
  }
  const refused = (why: string): Error =>
    new Error(
      `The path '${shownInMessage(path)}' is not a path inside a file set: it ${why}.`
    );
  if (!path.isWellFormed()) throw refused('holds a character that is not text');
  if (path.startsWith('/')) throw refused('is an absolute path');
  const segments = path.split('/');
  if (/^[A-Za-z]:$/.test(segments[0])) {
    throw refused('starts with a drive letter');
  }
  for (const segment of segments) {
    if (!isOneSafeSegment(segment)) throw refused(whyNotOneName(segment));
    if (Buffer.byteLength(segment) > MAX_PATH_SEGMENT_BYTES) {
      throw refused(`has a part of more than ${MAX_PATH_SEGMENT_BYTES} bytes`);
    }
  }
}

export type FileSetPaths = {
  /**
   * Check that a path can be the path of a file or of a folder of a file set: it is relative to the root of the file set, its parts are separated by `/`, and every part is one name. A consumer that writes a file set to a file system, or reads one from it, calls this for every path, so that a path that would leave the folder, or that the library would read as another path, is refused before anything is written or read.
   * @param {string} path the path of a file or of a folder, relative to the root of the file set
   * @throws {Error} if the path is empty, absolute, starts with a drive letter, has an empty part, `.` or `..` as a part, holds a backslash, a control character, `C:` or a character that is not text, or has a part of more than 255 bytes
   */
  assertFileSetPath(path: string): void;
};

export default (): FileSetPaths => {
  return {
    assertFileSetPath(path: string): void {
      assertFileSetPath(path);
    },
  };
};
