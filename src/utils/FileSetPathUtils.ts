import { createHash } from 'crypto';
import { posix } from 'path';
import sanitize from 'sanitize-filename';

/**
 * Where an object, or a realm, lives in a file set. A selector (an id or a name that a person types) is an id or a name,
 * never a path: whatever it says, these functions give one name inside the folder they are asked for, or throw. They are
 * pure (no file system, no state, no clock) and follow POSIX rules on every platform: a path is made of `/`, and a
 * backslash is an ordinary character that {@link referencedFilePath} and {@link realmFolderOf} refuse and that
 * {@link safeFileName} writes as `%5C`. {@link assertFileSetPath} is the one gate that every path of a file set passes.
 * Every command, every pull and push and every test can share them.
 *
 * A name has to fit in a file name: at most 255 bytes together with the longest suffix that the type puts after it (the
 * extension `.json` when no suffix is named). An id keeps exactly the name that it had when that name was a valid file name
 * with its suffix: the id is text, the sanitizer cut nothing of it, and the name and the suffix are 255 bytes or less. Any
 * other id gets a shortened name: the start of its name, cut at a whole character, then `~` and a checksum (the first 8
 * hexadecimal characters of the SHA-256 of the complete id, as UTF-16 little-endian code units). The checksum tells ids that
 * start alike apart, and two ids can still share a name, on a clash of the 8 characters (about one pair in four billion that
 * shares a start) and when an id is itself written like a shortened name: a consumer reports the later one and writes nothing
 * for it. The format is written to disk and is permanent. A type makes the name of an object once, with the longest suffix
 * that it uses, and gives that name to every file of the object.
 */

/** The longest name of one file or folder, in bytes, on the file systems that a file set is written to. */
const MAX_PATH_SEGMENT_BYTES = 255;

/** The suffix that a name leaves room for when the caller names none: the extension of the file of an object. */
const DEFAULT_SUFFIX = '.json';

/** What stands between the cut and the checksum of a shortened name. */
const CHECKSUM_SEPARATOR = '~';

/** How many hexadecimal characters of the checksum a shortened name holds. */
const CHECKSUM_LENGTH = 8;

/** The start of an escape that a cut left at its end: a `%` with one hexadecimal digit, or with none. */
const PARTIAL_ESCAPE = /%[0-9A-Fa-f]?$/;

/**
 * The last escaped character of a cut when it is not whole: a lead escape from `%C2` to `%F7` followed by fewer of the
 * continuation escapes (`%80` to `%BF`) than its character has bytes (an `é` is `%C3%A9`, a `€` is `%E2%82%AC`). The
 * sanitizer writes a whole name out like this for a device name with a superscript digit (`com\u00b9.`), and the control
 * characters of the C1 block are `%C2%80` to `%C2%9F`.
 */
const PARTIAL_ESCAPED_CHARACTER =
  /%(?:[CD][0-9A-F]|E[0-9A-F](?:%[89AB][0-9A-F])?|F[0-7](?:%[89AB][0-9A-F]){0,2})$/i;

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
 * The checksum of an id: the first 8 lowercase hexadecimal characters of the SHA-256 of the complete id, read as UTF-16 code
 * units (a lone surrogate keeps its own code unit, so two ids that differ only there have two checksums). The id is hashed
 * as it was given, never its name: a name that was shortened once is not shortened again.
 * @param {string} id the complete id
 * @returns {string} the checksum
 */
function checksumOf(id: string): string {
  return createHash('sha256')
    .update(id, 'utf16le')
    .digest('hex')
    .slice(0, CHECKSUM_LENGTH);
}

/**
 * How many bytes a suffix leaves for the cut of a shortened name: 255, less the suffix, the separator and the checksum.
 * @param {string} suffix the longest suffix that the name is used with
 * @returns {number} the bytes for the cut, which may be 0
 * @throws {Error} if the suffix is so long that not even the separator and the checksum fit with it
 */
function roomForCut(suffix: string): number {
  const room =
    MAX_PATH_SEGMENT_BYTES -
    Buffer.byteLength(suffix) -
    CHECKSUM_SEPARATOR.length -
    CHECKSUM_LENGTH;
  if (room < 0) {
    throw new Error(
      `The suffix '${shownInMessage(suffix)}' leaves no room for a name: a name and its suffix are at most ${MAX_PATH_SEGMENT_BYTES} bytes, and a shortened name needs ${CHECKSUM_SEPARATOR.length + CHECKSUM_LENGTH} of them.`
    );
  }
  return room;
}

/**
 * The start of a name, cut to a number of bytes: at a whole character, then, if it ends in the middle of an escape, without
 * that escape. Two steps, each once, in this order, whether or not the text is an escape that a name function wrote (a `%` that
 * an id holds itself is read the same): a trailing `%` with one hexadecimal digit or none goes (`...%2` becomes `...`, and of
 * `...%%` one `%` goes), then a trailing escaped character that is not whole goes (`...%C3` and `...%E2%82` become `...`).
 * @param {string} name the name, which is text
 * @param {number} room how many bytes the cut may have
 * @returns {string} the cut
 */
function cutName(name: string, room: number): string {
  let end = 0;
  let bytes = 0;
  for (const character of name) {
    const size = Buffer.byteLength(character);
    if (bytes + size > room) break;
    bytes += size;
    end += character.length;
  }
  return name
    .slice(0, end)
    .replace(PARTIAL_ESCAPE, '')
    .replace(PARTIAL_ESCAPED_CHARACTER, '');
}

/**
 * Whether an id is text for a file name: no lone surrogate, and no U+007F (DEL), which a file system takes for a control
 * character and the gate refuses, but the sanitizer leaves in a name. The other control characters are written as `%XX`.
 * @param {string} id the id
 * @returns {boolean} true if the id is text
 */
function isTextForName(id: string): boolean {
  return id.isWellFormed() && !id.includes('\u007f');
}

/**
 * The text of an id that is not text, made text: a lone surrogate and a U+007F are written as U+FFFD.
 * @param {string} id the id
 * @returns {string} the id as text
 */
function cleanText(id: string): string {
  return id.toWellFormed().replaceAll('\u007f', '\ufffd');
}

/**
 * The shortened name of an id: the start of its name, `~`, and the checksum of the complete id. What is not text in the name
 * is written as U+FFFD, so the name is text, and the checksum still tells two such ids apart.
 * @param {string} id the complete id, which the checksum is made of
 * @param {string} name the name that did not fit
 * @param {number} room how many bytes the cut may have
 * @returns {string} the shortened name
 */
function shortenedName(id: string, name: string, room: number): string {
  return `${cutName(cleanText(name), room)}${CHECKSUM_SEPARATOR}${checksumOf(id)}`;
}

/**
 * What the sanitizer makes of a text, and how many bytes the encoded name had before the sanitizer took out its `*` and its
 * trailing dots and spaces and cut it at 255 bytes. The length is measured on the real call: every piece of text that the
 * sanitizer replaces (a character of a path, a control character, a device name or a name of only dots, a trailing run) goes
 * through this function once, and what it makes of the piece is how much longer or shorter the name becomes. A device name with
 * a superscript digit and a dot (`com\u00b9.x`) is written out whole, and its length is what the sanitizer made of it.
 * @param {string} text the text, which has no lone surrogate
 * @returns {{ name: string; bytes: number }} the name, and the length of the encoded name before the sanitizer shortened it
 */
function measuredName(text: string): { name: string; bytes: number } {
  let added = 0;
  const name = sanitize(text, {
    replacement: (piece) => {
      const encoded = encodeURIComponent(piece);
      added += Buffer.byteLength(encoded) - Buffer.byteLength(piece);
      return encoded;
    },
  });
  return { name, bytes: Buffer.byteLength(text) + added };
}

/**
 * The name of an id that a file system can hold as it is, or its shortened name: the file name of an id that
 * {@link safeFileName} makes, which is empty for a value that leaves no name. The name is the name as it was when that was a
 * valid file name with the suffix: the id is text, the sanitizer cut nothing of it (its encoded name is 255 bytes or less
 * before the sanitizer takes out a `*` and the trailing dots and spaces), and the name and the suffix are 255 bytes or less.
 * @param {string} value the id or the name
 * @param {string} suffix the longest suffix that the name is used with
 * @returns {string} the name without the suffix, which is empty for a value that leaves no name
 */
function encodedNameWithin(value: string, suffix: string): string {
  if (typeof value !== 'string') throw new Error('Input must be string');
  const room = roomForCut(suffix);
  const text = isTextForName(value);
  const { name, bytes } = measuredName(text ? value : cleanText(value));
  if (name === '') return '';
  if (
    text &&
    bytes <= MAX_PATH_SEGMENT_BYTES &&
    Buffer.byteLength(name) + Buffer.byteLength(suffix) <=
      MAX_PATH_SEGMENT_BYTES
  ) {
    return name;
  }
  return shortenedName(value, name, room);
}

/**
 * The name of an id that is one safe name, as it was typed (with the stem's colon written, if it was asked for): the name
 * as it is when the id is text and the name fits with the suffix, else its shortened name.
 * @param {string} id the complete id
 * @param {string} name the name as it would be written
 * @param {string} suffix the longest suffix that the name is used with
 * @returns {string} the name without the suffix
 */
function typedNameWithin(id: string, name: string, suffix: string): string {
  const room = roomForCut(suffix);
  if (
    isTextForName(id) &&
    Buffer.byteLength(name) + Buffer.byteLength(suffix) <=
      MAX_PATH_SEGMENT_BYTES
  ) {
    return name;
  }
  return shortenedName(id, name, room);
}

/**
 * The file name (without the extension) of an object: its id made safe for a file system by {@link safeFileName}. The
 * servers accept ids of thousands of characters, and a file name holds 255 bytes with its extension. An id keeps exactly the
 * name that it had when that was a valid file name with the suffix. Any other id gets a shortened name, the start of the name,
 * `~` and the checksum of the id (`a` repeated 300 times is `a` repeated 241 times and `~e8722168`): an id whose name the
 * sanitizer cut, or was cut at 250 bytes, or is more than 255 bytes with the suffix, and an id that is not text (a lone
 * surrogate, U+007F), which is written with U+FFFD. The checksum is of the complete id, so ids that start alike have their own
 * names.
 * @param {string} value the id or the name of the object
 * @param {string} suffix Optional. The longest suffix that the type puts after the name (`.onCreate.js`); the default is `.json`. Make the name once, with the longest suffix, and use it for every file of the object
 * @returns {string} the file name without the extension, which may be empty (a name of only dots, a device name of Windows)
 * @throws {Error} if the suffix is so long that a shortened name does not fit with it
 */
export function fileNameOf(
  value: string,
  suffix: string = DEFAULT_SUFFIX
): string {
  return encodedNameWithin(value, suffix);
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
 * writes the characters of a path as `%XX` (`a/b` is `a%2Fb`). A name that was a valid file name with the suffix is returned
 * as it was. Any other name, and an id that is not text (a lone surrogate, U+007F), gets a shortened name, the start of the
 * name, `~` and the checksum of the complete id: two long names that start alike have their own names.
 *
 * Make the name once, with the longest suffix that the type uses, and give that name to every file of the object: a name
 * that is shortened with a short suffix and asked for again with a longer one is shortened again, from its own text.
 * @param {string} value the id or the name
 * @param {string} suffix Optional. The longest suffix that the type puts after the name; the default is `.json`
 * @returns {string} the name without the extension
 * @throws {Error} if the value leaves no name (`.`, `..`, empty), or the suffix is so long that a shortened name does not fit with it
 */
export function nameInFolder(
  value: string,
  suffix: string = DEFAULT_SUFFIX
): string {
  const text = String(value);
  return isOneSafeSegment(text)
    ? typedNameWithin(text, text, suffix)
    : namedOrRefused(text, suffix);
}

/**
 * The name of an id that is always written as an encoded name, or an error for a value that leaves no name.
 * @param {string} text the id or the name
 * @param {string} suffix the longest suffix that the name is used with
 * @returns {string} the name without the suffix
 * @throws {Error} if the value leaves no name, or the suffix leaves no room
 */
function namedOrRefused(text: string, suffix: string): string {
  const name = encodedNameWithin(text, suffix);
  if (name === '') {
    throw new Error(
      `'${shownInMessage(text)}' does not name an object: an id or a name is not a path`
    );
  }
  return name;
}

/**
 * The file name of a name that a file is always named after in its encoded form (the script of a pull is `<name>.js`,
 * with `:`, `?` and the other characters of a path written as `%XX`). It is {@link fileNameOf} that is not empty: it refuses
 * a name that leaves nothing (`.`, `..`, a run of dots, a device name of Windows) and gives a shortened name to a name that
 * was not a valid file name with the suffix (cut by the sanitizer, or more than 255 bytes with the suffix), and to a value that
 * is not text, so that long names that start alike have their own names. Like {@link nameInFolder} it looks at the name
 * only, not at the path that the name ends up in.
 * @param {string} value the name
 * @param {string} suffix Optional. The longest suffix that the type puts after the name (`.onCreate.js`); the default is `.json`
 * @returns {string} the file name without the extension
 * @throws {Error} if the value leaves no name, or the suffix is so long that a shortened name does not fit with it
 */
export function encodedName(
  value: string,
  suffix: string = DEFAULT_SUFFIX
): string {
  return namedOrRefused(String(value), suffix);
}

/**
 * The name that an id or a name has as the start of a file name that a file of the set refers to (`<name>.<key>.js`,
 * `<name>.<language>.html`): {@link nameInFolder}, and a name that starts with a letter and a colon (`a:b`) writes that
 * colon as `%3A`, because a reference that starts so is a drive letter, which {@link referencedFilePath} refuses. Any
 * other colon (`Login:SSO`) stays. The colon counts as the three bytes of `%3A` before the name is fitted, not after: a name
 * that fits only with the colon as it was typed is shortened.
 * @param {string} value the id or the name
 * @param {string} suffix Optional. The longest suffix that the type puts after the name (`.onCreate.js`); the default is `.json`
 * @returns {string} the start of the file name
 * @throws {Error} if the value leaves no name (`.`, `..`, empty), or the suffix is so long that a shortened name does not fit with it
 */
export function nameInStem(
  value: string,
  suffix: string = DEFAULT_SUFFIX
): string {
  const text = String(value);
  if (!isOneSafeSegment(text)) return namedOrRefused(text, suffix);
  const name = /^[A-Za-z]:/.test(text) ? `${text[0]}%3A${text.slice(2)}` : text;
  return typedNameWithin(text, name, suffix);
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
 * is one name, else the file name of an id, and a shortened name (see {@link nameInFolder}) when it does not fit. A caller
 * that wants only the file name of an id (the three agent types) passes `fileNameOf(id)`, which is empty for a name that a
 * file system cannot have (`con`): an empty value is that name, made already, and its file is `.json`. A name that was
 * made with a suffix is passed as it is: it fits again. An id or a name that is `.` or `..` is not a name.
 * @param {string} folder the folder of the type
 * @param {string} value the id or the name of the object
 * @param {string} suffix Optional. The longest suffix that the type puts after the name of this object, which the name leaves room for; the default is `.json`
 * @returns {string} the path of the file
 * @throws {Error} if the value is `.` or `..`, or the file would not be inside the folder, or the suffix leaves no room
 */
export function objectFilePath(
  folder: string,
  value: string,
  suffix: string = DEFAULT_SUFFIX
): string {
  const name = value === '' ? '' : nameInFolder(value, suffix);
  return inside(folder, value, `${folder}/${name}.json`);
}

/**
 * The folder of an object that has a folder of its own: `<folder>/<name>`. The name is the id or the name as typed when
 * that is one name, else the file name of an id, and a shortened name when it does not fit. The folder is never the folder
 * itself or its parent.
 * @param {string} folder the folder of the type
 * @param {string} value the id or the name of the object
 * @param {string} suffix Optional. The longest suffix that the type puts after the name of this object, which the name leaves room for; the default is `.json`
 * @returns {string} the path of the folder of the object
 * @throws {Error} if the folder would not be inside the folder of the type (`..`, `.`), or the suffix leaves no room
 */
export function objectFolderPath(
  folder: string,
  value: string,
  suffix: string = DEFAULT_SUFFIX
): string {
  return inside(folder, value, `${folder}/${nameInFolder(value, suffix)}`);
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
