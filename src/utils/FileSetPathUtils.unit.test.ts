/**
 * Run tests
 *
 *        npm run test:only -- src/utils/FileSetPathUtils
 *
 * A selector (an id or a name that a person types) is an id or a name, never a path. The functions of
 * `src/utils/FileSetPathUtils.ts` turn a selector into the name of a file or a folder of a file set, and a realm into the
 * folder of that realm, without touching the file system: whatever the value says, the result is one name inside the
 * folder it is asked for, or an error. The rules are POSIX rules on every platform, so every test here gives the same
 * answer on every operating system.
 *
 * The rows are the corpus of the functions as they were written for the command line (the same rows, in the same
 * order), moved here with the functions.
 *
 * The expected names are the file names of ids (`/` becomes `%2F`), checked against sanitize-filename 1.6.5: `/ \ ? < > : | "`
 * and control characters become `%XX`, `*` is removed, a name that is only dots or a device name of Windows becomes empty,
 * trailing dots go, and the name is cut at 255 bytes.
 *
 * An id whose name does not fit in a file name (255 bytes with the longest suffix that the type uses) gets a shortened name:
 * the cut, `~` and a checksum of the complete id. The format is on disk and permanent, so the golden table below comes from
 * an independent implementation (Python 3, hashlib), and a differential test against a frozen copy of the previous
 * functions shows that every id that fits keeps the name it had.
 *
 * The differential test at the end runs a deterministic sample of its corpus (a few seconds). `FILE_NAME_FULL_CORPUS=1 npm run
 * test:only -- src/utils/FileSetPathUtils` runs all of it (about 2,300,000 comparisons, about 3 minutes).
 *
 * Hermetic: no file is read or written, no network, no recording.
 */
import { createHash } from 'crypto';
import { posix } from 'path';
import { frodo } from '../index';
import { CAPABILITY_META } from '../mcp/CapabilityMetadata';
import { buildCapabilityInventory } from '../mcp/CapabilityRegistry';
import State from '../shared/State';
import {
  importSpecifiersOf,
  NODE_IO_MODULES,
  UPWARD_PATTERN,
} from '../test/exportFileFormat/importsOf';
import {
  joinWorkingDirectory,
  normalizeFilePath,
} from './ExportFileFormatUtils';
import { getFilePath } from './ExportImportUtils';
import FileSetPathUtils, {
  assertFileSetPath,
  assertInside,
  encodedName,
  fileNameOf,
  isOneSafeSegment,
  nameInFolder,
  nameInStem,
  objectFilePath,
  objectFolderPath,
  realmFolderOf,
  referencedFilePath,
  safeFileName,
  safeFileNameUnderscore,
  sameOnAnyFileSystem,
} from './FileSetPathUtils';

const FOLDER = '/work/set/sync/connectors';

/** The value of a row is a string, or `[character, count]` for a long one. */
const value = (v) => (Array.isArray(v) ? v[0].repeat(v[1]) : v);

/** A character, or a short text, repeated: the long ids and names of the tables are written with it. */
const rep = (text: string, count: number): string => text.repeat(count);

/** [selector, the file name of that id, without the extension] */
const FILE_NAMES = [
  ['x', 'x'],
  ['zion-a', 'zion-a'],
  ['a b', 'a b'],
  ['..', ''],
  ['.', ''],
  ['...', ''],
  ['../x', '..%2Fx'],
  ['x/../../y', 'x%2F..%2F..%2Fy'],
  ['/etc/passwd', '%2Fetc%2Fpasswd'],
  ['a/b', 'a%2Fb'],
  ['a%2Fb', 'a%2Fb'],
  ['a%2fb', 'a%2fb'],
  ['..%2Fx', '..%2Fx'],
  ['..foo', '..foo'],
  ['%2e%2e', '%2e%2e'],
  ['..\\x', '..%5Cx'],
  ['a\\b', 'a%5Cb'],
  ['C:\\x', 'C%3A%5Cx'],
  ['C:x', 'C%3Ax'],
  ['aC:b', 'aC%3Ab'],
  ['a\u0000b', 'a%00b'],
  ['a\nb', 'a%0Ab'],
  ['a\u0085b', 'a%C2%85b'], // a control character of the C1 block
  ['a?b', 'a%3Fb'],
  ['a<b>c', 'a%3Cb%3Ec'],
  ['a*b', 'ab'],
  ['a|b', 'a%7Cb'],
  ['a"b', 'a%22b'],
  ['a:b', 'a%3Ab'],
  ['a.', 'a'],
  ['a ', 'a%20'],
  [' a', ' a'],
  ['.hidden', '.hidden'],
  ['.json', '.json'],
  ['con', ''],
  ['CON', ''],
  ['nul.txt', ''],
  ['com1', ''],
  ['lpt9', ''],
  ['e\u0301', 'e\u0301'], // decomposed stays decomposed: nothing is normalised
  ['\u00e9', '\u00e9'],
  ['\uff0f', '\uff0f'], // a full width slash is not a separator
  ['\uff0e\uff0e', '\uff0e\uff0e'],
  ['a\u202eb', 'a\u202eb'], // the right-to-left override stays as typed
  // an id that does not fit in the 255 bytes of a file name with `.json` is cut at 241 bytes, at a whole character, and
  // gets `~` and the checksum of the complete id: 250 bytes, which leaves room for `.json`
  [['a', 300], 'a'.repeat(241) + '~e8722168'],
  [['é', 200], 'é'.repeat(120) + '~bf52c47b'],
  [['😀', 70], '😀'.repeat(60) + '~4a62e2af'],
  // a name of 250 bytes fits, and one of 251 does not: what the cut leaves at the end does not matter, the checksum ends the name
  ['a'.repeat(250), 'a'.repeat(250)],
  ['a'.repeat(249) + '.b', 'a'.repeat(241) + '~d5d42e11'],
  ['a'.repeat(249) + ' b', 'a'.repeat(241) + '~5c1f4232'],
  ['a'.repeat(248) + '. b', 'a'.repeat(241) + '~5d9f484c'],
];

describe('safeFileName', () => {
  it.each([
    ['plain', 'plain'],
    ['a/b', 'a%2Fb'],
    ['a*b', 'ab'],
    ['con', ''],
    ['..', ''],
    ['a.', 'a'],
    [['a', 300], 'a'.repeat(255)],
  ])('%j gives %j', (selector, expected) => {
    expect(safeFileName(value(selector))).toBe(expected);
  });
});

describe('fileNameOf', () => {
  it.each(FILE_NAMES)('%j is written by pull as %j', (selector, expected) => {
    const name = fileNameOf(value(selector));

    expect(name).toBe(expected);
    expect(Buffer.byteLength(name)).toBeLessThanOrEqual(250);
  });

  it('never leaves a separator, and is the same name when applied again', () => {
    for (const [selector] of FILE_NAMES) {
      const name = fileNameOf(value(selector));

      expect(name).not.toMatch(/[/\\]/);
      expect(fileNameOf(name)).toBe(name);
    }
  });
});

describe('assertInside', () => {
  it.each([
    ['/w/dir', '/w/dir/x.json'],
    ['/w/dir', '/w/dir/a/b.json'],
    // two dots that do not make a segment of their own are a name
    ['/w/dir', '/w/dir/..foo'],
    ['/w/dir', '/w/dir/..%2Fx.json'],
    ['/w/dir', '/w/dir/.hidden'],
    ['sync/mappings', 'sync/mappings/x/x.json'],
    ['/w/dir/', '/w/dir/x'],
  ])('%s holds %s', (root, target) => {
    expect(() => assertInside(root, target)).not.toThrow();
  });

  it.each([
    ['the root itself', '/w/dir', '/w/dir'],
    ['the root with a slash', '/w/dir', '/w/dir/'],
    ['the parent', '/w/dir', '/w'],
    ['a sibling', '/w/dir', '/w/other/x.json'],
    ['a sibling that starts with the same letters', '/w/dir', '/w/dir-evil/x'],
    ['a sibling that continues the name', '/w/dir', '/w/dirs'],
    ['one level up', '/w/dir', '/w/dir/../x.json'],
    ['two levels up', '/w/dir', '/w/dir/../../x.json'],
    ['into and out of the folder', '/w/dir', '/w/dir/a/../../x'],
    ['an absolute path', '/w/dir', '/etc/passwd'],
    ['a relative root, one level up', 'sync/mappings', 'sync/x.json'],
    ['a relative root itself', 'sync/mappings', 'sync/mappings/.'],
  ])('refuses %s', (_, root, target) => {
    expect(() => assertInside(root, target)).toThrow(/not inside/);
  });
});

describe('objectFilePath', () => {
  // a plain name is found as before when it is one safe segment, else the file name of an id
  // is looked for
  it.each([
    ['csv', `${FOLDER}/csv.json`],
    ['a b', `${FOLDER}/a b.json`],
    ['con', `${FOLDER}/con.json`],
    ['a*b', `${FOLDER}/a*b.json`],
    ['a?b', `${FOLDER}/a?b.json`],
    ['a%2Fb', `${FOLDER}/a%2Fb.json`],
    ['..foo', `${FOLDER}/..foo.json`],
    ['...', `${FOLDER}/....json`],
    // an id that is one name but does not fit in a file name gets a shortened name
    [['a', 300], `${FOLDER}/${'a'.repeat(241)}~e8722168.json`],
    ['a/b', `${FOLDER}/a%2Fb.json`],
    ['../x', `${FOLDER}/..%2Fx.json`],
    ['../../x', `${FOLDER}/..%2F..%2Fx.json`],
    ['x/../../y', `${FOLDER}/x%2F..%2F..%2Fy.json`],
    ['/etc/passwd', `${FOLDER}/%2Fetc%2Fpasswd.json`],
    ['..\\x', `${FOLDER}/..%5Cx.json`],
    ['C:\\x', `${FOLDER}/C%3A%5Cx.json`],
    ['a\u0000b', `${FOLDER}/a%00b.json`],
    ['a\nb', `${FOLDER}/a%0Ab.json`],
    // a control character of the C1 block is not part of a plain name either
    ['a\u0085b', `${FOLDER}/a%C2%85b.json`],
    ['a\u009fb', `${FOLDER}/a%C2%9Fb.json`],
  ])('%j is the file %s', (selector, expected) => {
    expect(objectFilePath(FOLDER, value(selector))).toBe(expected);
  });

  it.each([['..'], ['.']])(
    '%j is not the name of an object, as it is not for a folder',
    (selector) => {
      expect(() => objectFilePath(FOLDER, selector)).toThrow(
        `'${selector}' does not name an object: an id or a name is not a path`
      );
    }
  );

  it('puts every file directly into its folder, whatever the selector says', () => {
    for (const [selector] of FILE_NAMES) {
      if (selector === '..' || selector === '.') continue;
      const file = objectFilePath(FOLDER, value(selector));

      expect(posix.dirname(file)).toBe(FOLDER);
      expect(() => assertInside(FOLDER, file)).not.toThrow();
    }
  });

  it('finds the file name of an id when the caller makes the name first (the agent types)', () => {
    for (const [selector, expected] of FILE_NAMES) {
      expect(objectFilePath(FOLDER, fileNameOf(value(selector)))).toBe(
        `${FOLDER}/${expected}.json`
      );
    }
    // `a/b` is found as a%2Fb, a plain `a*b` as ab, and a device name as the file with no name
    expect(objectFilePath(FOLDER, fileNameOf('a/b'))).toBe(
      `${FOLDER}/a%2Fb.json`
    );
    expect(objectFilePath(FOLDER, fileNameOf('a*b'))).toBe(`${FOLDER}/ab.json`);
    expect(objectFilePath(FOLDER, fileNameOf('con'))).toBe(`${FOLDER}/.json`);
  });

  it('leaves room for the longest suffix of the type: a name that fits with `.json` and not with `.onCreate.js` is shortened for both files of the object', () => {
    const id = 'a'.repeat(245);

    expect(objectFilePath(FOLDER, id)).toBe(`${FOLDER}/${id}.json`);
    expect(objectFilePath(FOLDER, id, '.onCreate.js')).toBe(
      `${FOLDER}/${'a'.repeat(234)}~35dceed4.json`
    );
    // the name that was made with the longest suffix is the name of the other files too
    expect(
      objectFilePath(FOLDER, fileNameOf(id, '.onCreate.js'), '.onCreate.js')
    ).toBe(`${FOLDER}/${'a'.repeat(234)}~35dceed4.json`);
  });

  it('keeps a relative folder relative', () => {
    expect(objectFilePath('org-privileges', 'alphaOrgPrivileges')).toBe(
      'org-privileges/alphaOrgPrivileges.json'
    );
    expect(objectFilePath('org-privileges', '../x')).toBe(
      'org-privileges/..%2Fx.json'
    );
  });
});

describe('objectFolderPath', () => {
  const MAPPINGS = '/work/set/sync/mappings';

  it.each([
    ['UserToUserJavascriptSync', `${MAPPINGS}/UserToUserJavascriptSync`],
    ['con', `${MAPPINGS}/con`],
    ['...', `${MAPPINGS}/...`],
    ['..foo', `${MAPPINGS}/..foo`],
    ['a/b', `${MAPPINGS}/a%2Fb`],
    ['../x', `${MAPPINGS}/..%2Fx`],
    ['../../x', `${MAPPINGS}/..%2F..%2Fx`],
    ['/etc/passwd', `${MAPPINGS}/%2Fetc%2Fpasswd`],
    ['..\\x', `${MAPPINGS}/..%5Cx`],
    ['a\u0000b', `${MAPPINGS}/a%00b`],
    ['a\u0085b', `${MAPPINGS}/a%C2%85b`],
    ['a\u009fb', `${MAPPINGS}/a%C2%9Fb`],
  ])('%j is the folder %s', (selector, expected) => {
    expect(objectFolderPath(MAPPINGS, selector)).toBe(expected);
  });

  it.each([['..'], ['.']])(
    '%j is not a folder of the file set: it would be the folder itself or its parent',
    (selector) => {
      expect(() => objectFolderPath(MAPPINGS, selector)).toThrow(
        `'${selector}' does not name an object: an id or a name is not a path`
      );
    }
  );

  it('leaves room for the longest suffix of the type in the name of a folder too', () => {
    const id = 'a'.repeat(245);

    expect(objectFolderPath(MAPPINGS, id)).toBe(`${MAPPINGS}/${id}`);
    expect(objectFolderPath(MAPPINGS, id, '.onCreate.js')).toBe(
      `${MAPPINGS}/${'a'.repeat(234)}~35dceed4`
    );
    expect(objectFolderPath(MAPPINGS, 'a'.repeat(300))).toBe(
      `${MAPPINGS}/${'a'.repeat(241)}~e8722168`
    );
  });

  it('a file in the folder of an object is found with the same name', () => {
    for (const selector of ['x', 'a/b', '../x', 'con', 'a*b']) {
      const folder = objectFolderPath(MAPPINGS, selector);

      expect(posix.dirname(objectFilePath(folder, selector))).toBe(folder);
      expect(posix.basename(objectFilePath(folder, selector))).toBe(
        `${posix.basename(folder)}.json`
      );
    }
  });
});

describe('realmFolderOf', () => {
  it.each([
    ['/', 'root'],
    ['alpha', 'alpha'],
    ['/alpha', 'alpha'],
    ['bravo', 'bravo'],
    ['/parent/child', 'parent/child'],
    ['parent/child', 'parent/child'],
    ['/a//b', 'a/b'],
    ['alpha/', 'alpha'],
    ['zion realm', 'zion realm'],
    ['..foo', '..foo'],
    ['a.b', 'a.b'],
    // a colon is an ordinary character, as long as it is not the `C:` that the library removes
    ['a:b', 'a:b'],
    ['c:x', 'c:x'],
    ['Login:SSO', 'Login:SSO'],
    ['/parent/urn:x:y', 'parent/urn:x:y'],
    ['a::b', 'a::b'],
  ])('the realm %j is the folder %j', (realm, expected) => {
    expect(realmFolderOf(realm)).toBe(expected);
  });

  it.each([
    [''],
    ['//'],
    ['..'],
    ['/..'],
    ['../alpha'],
    ['../../alpha'],
    ['alpha/..'],
    ['alpha/../bravo'],
    ['.'],
    ['./alpha'],
    ['a\\b'],
    ['..\\alpha'],
    ['C:\\x'],
    ['a?b'],
    ['a#b'],
    ['a%2e%2e'],
    ['%2e%2e'],
    ['a\u0000b'],
    ['a\tb'],
    ['a\u007fb'],
    ['..C:'],
    ['.C:.'],
    ['a/..C:'],
    ['/..C:/alpha'],
    ['C:'],
    ['ABC:x'],
    ['CC::'],
  ])('the realm %j is refused', (realm) => {
    expect(() => realmFolderOf(realm)).toThrow(
      `The realm '${realm}' is not '/', a name or a path of names.`
    );
  });
});

describe('isOneSafeSegment', () => {
  it.each([
    ['x'],
    ['zion-a'],
    ['a b'],
    ['a.b'],
    ['..foo'],
    ['foo..'],
    ['a..b'],
    ['...'],
    ['%2e%2e'],
    ['a%2Fb'],
    ['2.2_Agent'],
    ['a?b'],
    ['\u00e9'],
    // a colon is an ordinary character, as long as it is not the `C:` that the library removes
    ['a:b'],
    ['Login:SSO'],
    ['urn:x:y'],
    ['x:'],
    [':x'],
    ['a::b'],
    ['c:x'],
    ['CC'],
    ['C'],
  ])('%j is one safe segment', (candidate) => {
    expect(isOneSafeSegment(candidate)).toBe(true);
  });

  it.each([
    [''],
    ['.'],
    ['..'],
    ['a/b'],
    ['/a'],
    ['a/'],
    ['../x'],
    ['x/..'],
    ['a\\b'],
    ['..\\x'],
    ['a\u0000b'],
    ['a\tb'],
    ['a\nb'],
    ['a\u007fb'],
    ['a\u0085b'],
    // the library removes every `C:` from a path after the check
    ['C:'],
    ['..C:'],
    ['.C:.'],
    ['ABC:x'],
    ['CC::'],
    ['x.C:'],
  ])('%j is not', (candidate) => {
    expect(isOneSafeSegment(candidate)).toBe(false);
  });
});

describe('referencedFilePath', () => {
  // the folder a file reference is relative to, as a mapping keeps its files
  const BASE = '/w/set/sync/mappings/m';

  /** [reference, the path that is read] */
  const INSIDE = [
    ['x.js', `${BASE}/x.js`],
    ['./x.js', `${BASE}/x.js`],
    ['sub/x.js', `${BASE}/sub/x.js`],
    ['sub/../x.js', `${BASE}/x.js`],
    ['a/b/../c.js', `${BASE}/a/c.js`],
    // a path that goes above the folder and comes back is the file that it names
    ['../m/x.js', `${BASE}/x.js`],
    ['sub/../../m/x.js', `${BASE}/x.js`],
    // two dots that do not make a segment of their own are a name
    ['a..b.js', `${BASE}/a..b.js`],
    ['..foo.js', `${BASE}/..foo.js`],
    ['foo..', `${BASE}/foo..`],
    ['...', `${BASE}/...`],
    ['.hidden', `${BASE}/.hidden`],
    ['%2e%2e/x', `${BASE}/%2e%2e/x`],
    ['..%2Fx.js', `${BASE}/..%2Fx.js`],
    // a backslash separates on every platform
    ['sub\\x.js', `${BASE}/sub/x.js`],
    ['.\\x.js', `${BASE}/x.js`],
    // what pull writes
    ['m.source.js', `${BASE}/m.source.js`],
    [
      'scripts-content/AUTHENTICATION_TREE_DECISION_NODE/a%2Fb.js',
      `${BASE}/scripts-content/AUTHENTICATION_TREE_DECISION_NODE/a%2Fb.js`,
    ],
    ['logo/en.html', `${BASE}/logo/en.html`],
    ['welcome.en.html', `${BASE}/welcome.en.html`],
    ['0.1/en.html', `${BASE}/0.1/en.html`],
    // the result is the folder joined to the reference, as before
    ['é.js', `${BASE}/é.js`],
    ['a b.js', `${BASE}/a b.js`],
    // a colon is an ordinary character, as long as the reference does not start with a drive letter and
    // holds no `C:` that the library removes
    ['ab:c.js', `${BASE}/ab:c.js`],
    ['sub/a:b.js', `${BASE}/sub/a:b.js`],
    ['Login:SSO.onCreate.js', `${BASE}/Login:SSO.onCreate.js`],
    ['xy:', `${BASE}/xy:`],
    [':x', `${BASE}/:x`],
    ['x.js:stream', `${BASE}/x.js:stream`],
    ['urn:x:y.js', `${BASE}/urn:x:y.js`],
    ['sub\\a:b.js', `${BASE}/sub/a:b.js`],
    ['sub/c:x.js', `${BASE}/sub/c:x.js`],
    ['Cx.js', `${BASE}/Cx.js`],
  ];

  it.each(INSIDE)('the reference %j is the file %s', (reference, expected) => {
    expect(referencedFilePath(BASE, reference)).toBe(expected);
  });

  it('gives what posix.join gave for a reference that has no backslash', () => {
    for (const [reference] of INSIDE.filter(([r]) => !r.includes('\\'))) {
      expect(referencedFilePath(BASE, reference)).toBe(
        posix.join(BASE, reference)
      );
    }
  });

  it('keeps a relative folder relative, and a folder with a trailing slash', () => {
    expect(
      referencedFilePath('email-templates/welcome', 'welcome.en.html')
    ).toBe('email-templates/welcome/welcome.en.html');
    expect(referencedFilePath(`${BASE}/`, 'x.js')).toBe(`${BASE}/x.js`);
    expect(() => referencedFilePath('email-templates/welcome', '../x')).toThrow(
      "The file reference '../x' must stay inside the config folder."
    );
  });

  /** [what is wrong with the reference, the reference] */
  const REFUSED = [
    ['one level up', '../x.js'],
    ['two levels up', '../../x.js'],
    ['many levels up', '../../../../../../etc/passwd'],
    ['up, after going down', 'a/../../x.js'],
    ['a sibling folder', '../m2/x.js'],
    ['the parent', '..'],
    ['the parent with a slash', '../'],
    ['the folder itself', '.'],
    ['the folder itself with a slash', './'],
    ['the folder itself by way of a sub folder', 'sub/..'],
    ['a backslash for the slash', '..\\x.js'],
    ['two backslashes', '..\\..\\x.js'],
    ['a backslash that starts the path', '\\..\\x.js'],
    ['a backslash after a folder', 'a\\..\\..\\x.js'],
    ['both separators', '..\\../x.js'],
    ['an absolute path', '/etc/passwd'],
    ['an absolute path that names a file of the folder', `${BASE}/x.js`],
    ['a path of the root', '/'],
    ['a network path', '\\\\server\\share\\x.js'],
    ['a network path with slashes', '//server/share/x.js'],
    ['a drive letter and a backslash', 'C:\\x.js'],
    ['a drive letter and a slash', 'C:/x.js'],
    ['a drive letter and a relative name', 'c:x.js'],
    // the library removes every `C:` from a path after the check (and `\\` becomes `/`)
    ['a letter and a colon at the start is a drive letter', 'a:b.js'],
    ['`C:` in a name', 'ABC:x.js'],
    ['`C:` in a folder after a colon', 'a:b/C:x.js'],
    ['`C:` that the removal of another `C:` would leave', 'CC::x.js'],
    ['two dots that become a segment when `C:` is removed', '..C:/x.js'],
    ['the same, three levels deep', '..C:/..C:/..C:/canary.txt'],
    ['one dot, `C:`, one dot', '.C:./x.js'],
    ['`C:` and a backslash', '..C:\\x.js'],
    ['a drive letter before two dots', 'C:..\\x.js'],
    ['a lower case drive letter before two dots', 'c:..\\x.js'],
    ['after a folder', 'a/..C:/x.js'],
    ['an empty reference', ''],
    ['a NUL character', 'x\u0000.js'],
    ['a NUL character after a folder that goes up', '../x\u0000'],
    ['a line feed', 'a\nb.js'],
    ['a tab', 'a\tb.js'],
    ['an escape character', '\u001b[31mx.js'],
    ['a DEL character', 'a\u007fb.js'],
    ['a control character of the C1 block', 'a\u0085b.js'],
  ];

  it.each(REFUSED)('refuses %s: %j', (_, reference) => {
    expect(() => referencedFilePath(BASE, reference)).toThrow(
      /^The file reference '.*' must stay inside the config folder\.$/
    );
  });

  it.each([[undefined], [null], [5], [true], [{ file: 'x.js' }], [['x.js']]])(
    'refuses a reference that is not a string: %j',
    (reference) => {
      expect(() => referencedFilePath(BASE, reference)).toThrow(
        /^The file reference '.*' must stay inside the config folder\.$/
      );
    }
  );

  it('says what it refused: the message holds the reference as it was written', () => {
    expect(() => referencedFilePath(BASE, '../../x.js')).toThrow(
      "The file reference '../../x.js' must stay inside the config folder."
    );
    expect(() => referencedFilePath(BASE, '..\\x.js')).toThrow(
      "The file reference '..\\x.js' must stay inside the config folder."
    );
    expect(() => referencedFilePath(BASE, '')).toThrow(
      "The file reference '' must stay inside the config folder."
    );
    expect(() => referencedFilePath(BASE, undefined)).toThrow(
      "The file reference 'undefined' must stay inside the config folder."
    );
  });

  it('shows a control character as an escape, so that the message cannot carry one', () => {
    let message = '';
    try {
      referencedFilePath(BASE, '../x\u001b[2Jy\u0000');
    } catch (error) {
      message = error.message;
    }

    expect(message).toBe(
      "The file reference '../x\\u001b[2Jy\\u0000' must stay inside the config folder."
    );
    // eslint-disable-next-line no-control-regex
    expect(message).not.toMatch(/[\u0000-\u001f]/);
  });

  it('answers a path inside the folder for every reference it does not refuse', () => {
    const references = [
      ...INSIDE.map(([reference]) => reference),
      'a/./b.js',
      'a//b.js',
      'a/b/c/d/../../e.js',
    ];
    for (const reference of references) {
      expect(() =>
        assertInside(BASE, referencedFilePath(BASE, reference))
      ).not.toThrow();
    }
  });

  it('never answers a path that is outside the folder, for any reference made of these parts', () => {
    const parts = ['..', '.', 'a', '..a', 'a..', '', '\\', '/', 'C:', '%2e%2e'];
    const outside = [];
    let answered = 0;
    let refused = 0;
    for (const first of parts) {
      for (const second of parts) {
        for (const third of parts) {
          for (const separator of ['/', '\\']) {
            const reference = [first, second, third].join(separator);
            let answer;
            try {
              answer = referencedFilePath(BASE, reference);
            } catch {
              refused++;
              continue;
            }
            answered++;
            const relative = posix.relative(BASE, answer);
            if (
              relative === '' ||
              posix.isAbsolute(relative) ||
              relative.split('/')[0] === '..'
            ) {
              outside.push(reference);
            }
          }
        }
      }
    }

    expect(outside).toEqual([]);
    // the table is not empty on either side
    expect(answered).toBeGreaterThan(100);
    expect(refused).toBeGreaterThan(100);
  });
});

/**
 * The library rewrites a path AFTER the check: `getFilePath` turns every `\\` into `/`, removes every
 * `C:` (so `..C:` becomes `..`, and `.C:.` becomes `..`) and puts the working directory in front. A
 * check that judges the text before the rewrite is judged here on the text after it, with the real
 * function of the library: whatever a helper answers, or lets through, must stay inside the
 * folder, folder and answer both put through `getFilePath`.
 */
describe('the paths after the library has rewritten them', () => {
  const WORK = '/w/set';
  const state = State({});
  state.setDirectory(WORK);

  const real = (file: string) =>
    getFilePath({ fileName: file, mkdirs: false, state });
  /** The names of the files that the answer and the folder are in the end, and whether the answer is inside. */
  const staysInside = (folder, answer) => {
    try {
      assertInside(real(folder), real(answer));
      return true;
    } catch {
      return false;
    }
  };

  it('is what the rows below take it to be: `\\` is `/`, `C:` goes, the working directory comes first', () => {
    expect(real('a\\b')).toBe(`${WORK}/a/b`);
    expect(real('a/..C:/b')).toBe(`${WORK}/a/../b`);
    expect(real('.C:./b')).toBe(`${WORK}/../b`);
    expect(real('x:y')).toBe(`${WORK}/x:y`);
    expect(real('c:x')).toBe(`${WORK}/c:x`);
  });

  describe('referencedFilePath', () => {
    const FOLDERS = [
      'email-templates/t1',
      'realms/alpha/scripts',
      `${WORK}/endpoints/e1`,
      'terms-conditions',
    ];
    const REFERENCES = [
      '..C:/x.js',
      '..C:/..C:/x.js',
      '..C:/..C:/..C:/canary.txt',
      '..C:/..C:/..C:/..C:/..C:/canary.txt',
      '.C:./x.js',
      '.C:./.C:./x.js',
      '..C:\\x.js',
      'C:..\\x.js',
      'c:..\\x.js',
      'a/..C:/..C:/x.js',
      'sub/..C:/x.js',
      '..C:',
      '.C:.',
      'C:',
      'a:b.js',
      'ABC:x.js',
      'sub/ABC:x.js',
      'CC::x.js',
    ];

    it.each(FOLDERS.flatMap((folder) => REFERENCES.map((r) => [folder, r])))(
      'in %s the reference %j is refused, so what the library makes of it is never read',
      (folder, reference) => {
        expect(() => referencedFilePath(folder, reference)).toThrow(
          `The file reference '${reference}' must stay inside the config folder.`
        );
      }
    );

    it('answers a path that is inside the folder in the end, for every reference made of these parts', () => {
      const parts = [
        '..',
        '.',
        'a',
        '..a',
        '',
        'C:',
        '..C:',
        '.C:.',
        'c:',
        ':',
        '\\',
        '%2e%2e',
      ];
      const outside = [];
      let answered = 0;
      for (const folder of FOLDERS) {
        for (const first of parts) {
          for (const second of parts) {
            for (const third of parts) {
              for (const separator of ['/', '\\']) {
                const reference = [first, second, third].join(separator);
                let answer;
                try {
                  answer = referencedFilePath(folder, reference);
                } catch {
                  continue;
                }
                answered++;
                if (!staysInside(folder, answer)) {
                  outside.push(`${folder} + ${reference} = ${answer}`);
                }
              }
            }
          }
        }
      }

      expect(outside).toEqual([]);
      expect(answered).toBeGreaterThan(500);
    });
  });

  describe('the names of objects (objectFilePath, objectFolderPath, fileNameOf)', () => {
    const FOLDERS = [
      'sync/mappings',
      `${WORK}/realms/alpha/journeys`,
      'mappings',
    ];
    const NAMES = [
      '..C:',
      '.C:.',
      '..C:..C:',
      'C:',
      'c:',
      'a:b',
      'x..C:',
      '..C:x',
      'C:\\x',
      '..C:/x',
      '../x',
      '..',
      '.',
      'a/b',
    ];

    it.each(FOLDERS.flatMap((folder) => NAMES.map((n) => [folder, n])))(
      'in %s the name %j is a file and a folder of that folder in the end',
      (folder, name) => {
        let folderOfName;
        try {
          folderOfName = objectFolderPath(folder, name);
          expect(staysInside(folder, folderOfName)).toBe(true);
          expect(
            staysInside(folderOfName, objectFilePath(folderOfName, name))
          ).toBe(true);
        } catch (error) {
          // `.` and `..` do not name an object
          expect(error.message).toContain('does not name an object');
        }
        if (name === '..' || name === '.') {
          expect(() => objectFilePath(folder, name)).toThrow(
            'does not name an object'
          );
          return;
        }
        const file = objectFilePath(folder, name);
        expect(staysInside(folder, file)).toBe(true);
        expect(posix.dirname(real(file))).toBe(real(folder).replace(/\/$/, ''));
      }
    );

    it('a name that holds `C:` is looked up as the file name of an id: the colon is written as %3A', () => {
      expect(objectFilePath('sync/mappings', '..C:')).toBe(
        'sync/mappings/..C%3A.json'
      );
      expect(objectFolderPath('sync/mappings', '..C:')).toBe(
        'sync/mappings/..C%3A'
      );
      expect(objectFilePath('sync/mappings', 'ABC:x')).toBe(
        'sync/mappings/ABC%3Ax.json'
      );
    });

    it('any other colon is an ordinary character of a name: the file is the name as it is', () => {
      for (const name of ['a:b', 'Login:SSO', 'urn:x:y', 'x:', ':x', 'c:x']) {
        expect(objectFilePath('sync/mappings', name)).toBe(
          `sync/mappings/${name}.json`
        );
        expect(objectFolderPath('sync/mappings', name)).toBe(
          `sync/mappings/${name}`
        );
        expect(real(objectFilePath('sync/mappings', name))).toBe(
          `${WORK}/sync/mappings/${name}.json`
        );
      }
    });

    it('a file name of an id is the same after the library has rewritten the path', () => {
      for (const value of [
        ...NAMES,
        'a'.repeat(300),
        'é:',
        '\\..C:\\',
        'C:C:C:',
      ]) {
        const name = fileNameOf(value);

        expect(name).not.toMatch(/[:\\/]/);
        expect(real(`d/${name}.json`)).toBe(`${WORK}/d/${name}.json`);
      }
    });
  });

  describe('realmFolderOf', () => {
    it.each([
      ['..C:'],
      ['.C:.'],
      ['a/..C:'],
      ['/..C:/alpha'],
      ['C:'],
      ['ABC:x'],
    ])('the realm %j is refused: the library would make it %s', (realm) => {
      expect(() => realmFolderOf(realm)).toThrow(
        `The realm '${realm}' is not '/', a name or a path of names.`
      );
    });

    it('the folder of every realm that is not refused is a folder of the realms folder in the end', () => {
      const parts = [
        '..',
        '.',
        'a',
        '..a',
        'C:',
        '..C:',
        '.C:.',
        '',
        'b',
        '\\',
      ];
      const outside = [];
      let answered = 0;
      for (const first of parts) {
        for (const second of parts) {
          for (const lead of ['', '/']) {
            const realm = `${lead}${first}/${second}`;
            let folder;
            try {
              folder = realmFolderOf(realm);
            } catch {
              continue;
            }
            answered++;
            if (!staysInside('realms', `realms/${folder}/x`))
              outside.push(realm);
          }
        }
      }

      expect(outside).toEqual([]);
      expect(answered).toBeGreaterThan(10);
    });
  });
});

/**
 * The safety argument as a test, not as a comment. `getFilePath` of the library rewrites a path after
 * a helper has judged it: it reads `\` as `/` and removes every `C:` (case-sensitive), and nothing
 * else. The helpers refuse exactly that, and a plain colon is an ordinary character. A systematic
 * corpus (every concatenation of up to five of the pieces below) is put through the helpers and,
 * for everything that a helper ACCEPTS, through the real function with a temporary folder as the
 * working directory: the library must leave the path as the helper built it (what the helper
 * judged is what is read), and the path must be inside the folder. A change of the library that
 * rewrites more, or a helper that forgets one of the two rewrites, shows up here.
 */
describe('what a helper accepts is what the library reads (the real getFilePath over a corpus)', () => {
  const PIECES = [
    '..',
    '.',
    'C:',
    'c:',
    ':',
    '\\',
    '/',
    '%3A',
    '\uff1a',
    'a',
    'x.js',
    'CC::',
    'C',
  ];
  const MAX_PIECES = 5;

  // a working directory that exists only as text: getFilePath builds a path and touches no file when mkdirs is false
  const dir = '/work/corpus';
  const state = State({});
  state.setDirectory(dir);

  /** Every concatenation of up to `max` pieces, the empty string first. */
  const corpus = function* (max = MAX_PIECES) {
    const walk = function* (prefix, depth) {
      yield prefix;
      if (depth === max) return;
      for (const piece of PIECES) yield* walk(prefix + piece, depth + 1);
    };
    yield* walk('', 0);
  };

  const real = (file: string) =>
    getFilePath({ fileName: file, mkdirs: false, state });
  /** Whether the target is strictly inside the folder (relative to the working directory). */
  const insideOf = (folder, target) => {
    const relative = posix.relative(posix.join(dir, folder), target);
    return (
      relative !== '' &&
      !posix.isAbsolute(relative) &&
      relative.split('/')[0] !== '..'
    );
  };
  /** Whether the library reads the path as it was built, and that path is inside the folder. */
  const readAsBuilt = (folder, built) =>
    real(built) === posix.join(dir, built) && insideOf(folder, real(built));

  /** The accepted and the refused references, and the ones that the library would read differently. */
  const referencesOf = (helper, folder, max = MAX_PIECES) => {
    const violations = [];
    let accepted = 0;
    let refused = 0;
    for (const reference of corpus(max)) {
      let built;
      try {
        built = helper(folder, reference);
      } catch {
        refused++;
        continue;
      }
      accepted++;
      if (!readAsBuilt(folder, built)) violations.push(reference);
    }
    return { accepted, refused, violations };
  };

  it('references: what referencedFilePath accepts is read as it was judged, inside the folder', () => {
    const { accepted, refused, violations } = referencesOf(
      referencedFilePath,
      'email-templates/t1'
    );

    expect(violations.slice(0, 5)).toEqual([]);
    // the corpus has both sorts in it
    expect(accepted).toBeGreaterThan(50000);
    expect(refused).toBeGreaterThan(50000);
  });

  it('references: the same in a deeper folder, up to four pieces', () => {
    const { accepted, violations } = referencesOf(
      referencedFilePath,
      'realms/alpha/themes/t1',
      4
    );

    expect(violations.slice(0, 5)).toEqual([]);
    expect(accepted).toBeGreaterThan(1000);
  });

  it('the corpus can fail: a helper that forgets `C:`, one that forgets the backslash and one that only joins are found', () => {
    /** The helper as it is, without one of its tests. */
    const helperWithout =
      ({ backslash, c }) =>
      (folder, reference) => {
        const text = backslash ? reference.replaceAll('\\', '/') : reference;
        if (/\p{Cc}|^[A-Za-z]:/u.test(text) || text.startsWith('/')) {
          throw new Error('refused');
        }
        if (c && text.includes('C:')) throw new Error('refused');
        const built = posix.join(folder, text);
        assertInside(folder, built);
        return built;
      };
    const folder = 'email-templates/t1';
    const complete = helperWithout({ backslash: true, c: true });

    expect(referencesOf(complete, folder, 3).violations).toEqual([]);
    expect(
      referencesOf(helperWithout({ backslash: true, c: false }), folder, 3)
        .violations
    ).toContain('..C:');
    expect(
      referencesOf(helperWithout({ backslash: false, c: true }), folder, 3)
        .violations
    ).toContain('..\\');
    expect(
      referencesOf((f, r) => posix.join(f, r), folder, 3).violations
    ).toEqual(expect.arrayContaining(['..C:', '..\\']));
  });

  it('names: what isOneSafeSegment accepts is read as it is, and so is every file and folder of objectFilePath and objectFolderPath', () => {
    const folder = 'realms/alpha/scripts/scripts-config';
    const violations = [];
    let safe = 0;
    for (const name of corpus()) {
      if (isOneSafeSegment(name)) {
        safe++;
        if (real(name) !== posix.join(dir, name)) violations.push(name);
      }
    }
    // the file names of ids are slower to make: up to four pieces
    let objects = 0;
    for (const name of corpus(4)) {
      let objectFolder;
      try {
        const file = objectFilePath(folder, name);
        objects++;
        if (!readAsBuilt(folder, file)) violations.push(`file ${name}`);
        objectFolder = objectFolderPath(folder, name);
      } catch {
        // `.` and `..` do not name an object
        continue;
      }
      if (!readAsBuilt(folder, objectFolder)) violations.push(`folder ${name}`);
      // the file in the folder of the object (a journey, a mapping)
      if (!readAsBuilt(objectFolder, objectFilePath(objectFolder, name))) {
        violations.push(`file in folder ${name}`);
      }
    }

    expect(violations.slice(0, 5)).toEqual([]);
    expect(safe).toBeGreaterThan(50000);
    expect(objects).toBeGreaterThan(20000);
  });

  it('realms: the folder of a realm that realmFolderOf accepts is read as it is, inside the realms folder', () => {
    const violations = [];
    let accepted = 0;
    for (const realm of corpus()) {
      let folder;
      try {
        folder = realmFolderOf(realm);
      } catch {
        continue;
      }
      accepted++;
      const built = `realms/${folder}/scripts/scripts-config/x.json`;
      if (!readAsBuilt('realms', built)) violations.push(realm);
      if (folder.split('/').some((part) => part === '.' || part === '..')) {
        violations.push(`dot part ${realm}`);
      }
    }

    expect(violations.slice(0, 5)).toEqual([]);
    expect(accepted).toBeGreaterThan(50000);
  });
});

describe('safeFileNameUnderscore', () => {
  it.each([
    ['plain', 'plain'],
    ['a/b', 'a_b'],
    ['a\\b', 'a_b'],
    ['a:b', 'a_b'],
    ['a?b', 'a_b'],
    ['a<b>c', 'a_b_c'],
    ['a|b', 'a_b'],
    ['a"b', 'a_b'],
    ['a*b', 'a_b'],
    ['a\u0000b', 'a_b'],
    ['a b', 'a b'],
    ['é ü 日本語', 'é ü 日本語'],
    // a device name of Windows, only dots and a trailing dot are written with an underscore, too
    ['con', '_'],
    ['..', '_'],
    ['a.', 'a_'],
    [['a', 300], 'a'.repeat(255)],
  ])('%j gives %j', (selector, expected) => {
    expect(safeFileNameUnderscore(value(selector))).toBe(expected);
  });

  it('gives the same name for two ids that differ only in a character that a file name cannot hold', () => {
    expect(safeFileNameUnderscore('a/b')).toBe(safeFileNameUnderscore('a:b'));
    expect(safeFileName('a/b')).not.toBe(safeFileName('a:b'));
  });
});

describe('assertInside reads both paths as they are written', () => {
  it.each([
    [
      'a relative root and a relative target',
      'sync/mappings',
      'sync/mappings/x.json',
    ],
    ['a root that leads with dots', '../out', '../out/x.json'],
    [
      'a root and a target that lead with the same dots',
      '../../out',
      '../../out/a/b',
    ],
    ['a root of dots only', '..', '../x'],
    ['a root that is the working directory', '.', 'x'],
    ['a root with a `..` that comes back', 'a/../b', 'b/x'],
    ['a target with a `..` that comes back', 'b', 'b/c/../x'],
    ['a root with a double slash', '/w//dir', '/w/dir/x'],
    ['a target with a double slash', '/w/dir', '/w//dir//x'],
    ['a target with dots in the middle', '/w/dir', '/w/dir/./a/./b'],
    ['a path of Windows with slashes', 'C:/cfg', 'C:/cfg/x.json'],
    [
      'a target that starts above the root of the file system, where `..` stays at the root',
      '/w',
      '/../w/x',
    ],
  ])('holds: %s', (_, root, target) => {
    expect(() => assertInside(root, target)).not.toThrow();
  });

  it.each([
    ['a target that goes above a root of dots', '..', '../..'],
    ['a target that goes above a relative root', 'a', '../a/x'],
    [
      'a target that leaves and comes back through another name',
      'a',
      '../b/a/x',
    ],
    ['a relative target of an absolute root', '/w/dir', 'w/dir/x'],
    ['an absolute target of a relative root', 'w/dir', '/w/dir/x'],
    [
      'a path of Windows with backslashes is one name, not a path (POSIX rules)',
      'C:\\cfg',
      'C:\\cfg\\x.json',
    ],
    ['a target that is the working directory', 'a', '.'],
    [
      'a root that is the working directory and a target that leaves it',
      '.',
      '..',
    ],
    [
      'a root that is the working directory and a target that is the root',
      '.',
      '.',
    ],
    ['an empty root and an empty target', '', ''],
  ])('refuses: %s', (_, root, target) => {
    expect(() => assertInside(root, target)).toThrow(/not inside/);
  });

  it('says which path is not inside which', () => {
    expect(() => assertInside('/w/dir', '/w/other')).toThrow(
      "The path '/w/other' is not inside '/w/dir'."
    );
  });

  it('gives the same answer as the usual resolve-and-relate test for absolute paths made of these parts', () => {
    // the test of the command line as it was first written, with the rules of POSIX
    const resolved = (root: string, target: string): boolean => {
      const relative = posix.relative(
        posix.resolve(root),
        posix.resolve(target)
      );
      return !(
        relative === '' ||
        posix.isAbsolute(relative) ||
        relative.split('/')[0] === '..'
      );
    };
    const parts = ['..', '.', 'a', '..a', 'a..', '', '/', 'dir', '%2e%2e'];
    const roots = ['/w/dir', '/w/dir/', '/', '/w', '/w//dir'];
    let compared = 0;
    const different: string[] = [];
    for (const root of roots) {
      for (const first of parts) {
        for (const second of parts) {
          for (const third of parts) {
            const target = `${root}/${first}/${second}/${third}`;
            let actual = true;
            try {
              assertInside(root, target);
            } catch {
              actual = false;
            }
            compared += 1;
            if (actual !== resolved(root, target)) {
              different.push(`${root} ${target}`);
            }
          }
        }
      }
    }
    expect(different.slice(0, 5)).toEqual([]);
    expect(compared).toBe(roots.length * parts.length ** 3);
  });

  it('does not depend on the working directory of the process', () => {
    const before = process.cwd();
    const answers = (): boolean[] =>
      [
        ['a', 'a/x'],
        ['a', '../a/x'],
        ['..', '../..'],
        ['/w', '/w/x'],
      ].map(([root, target]) => {
        try {
          assertInside(root, target);
          return true;
        } catch {
          return false;
        }
      });
    const here = answers();
    process.chdir('/');
    try {
      expect(answers()).toEqual(here);
    } finally {
      process.chdir(before);
    }
    expect(here).toEqual([true, false, false, true]);
  });
});

describe('the pure rewrite and the wrapper give the same path', () => {
  it('normalizeFilePath and joinWorkingDirectory give what getFilePath gives, for every string of 13 pieces up to 5 and every working directory', () => {
    const pieces = [
      '..',
      '.',
      'C:',
      'c:',
      ':',
      '\\',
      '/',
      '%3A',
      '：',
      'a',
      'x.js',
      'CC::',
      'C',
    ];
    const walk = function* (prefix: string, depth: number): Generator<string> {
      yield prefix;
      if (depth === 5) return;
      for (const piece of pieces) yield* walk(prefix + piece, depth + 1);
    };
    let count = 0;
    const different: string[] = [];
    for (const directory of ['/work/corpus', '/work/corpus/', '']) {
      const state = State({});
      state.setDirectory(directory);
      for (const fileName of walk('', 0)) {
        count += 1;
        const pure = joinWorkingDirectory(
          directory,
          normalizeFilePath(fileName)
        );
        if (pure !== getFilePath({ fileName, mkdirs: false, state })) {
          different.push(`${directory} + ${fileName}`);
        }
      }
    }
    expect(different.slice(0, 5)).toEqual([]);
    // 1 + 13 + 13^2 + 13^3 + 13^4 + 13^5 strings, for three working directories
    expect(count).toBe(402234 * 3);
  });
});

describe('nameInFolder and nameInStem', () => {
  // the rows of the functions as the command line had them (the tenant-name record
  // https://github.com/rockcarver/frodo-cli/blob/main/docs/decisions/0063-a-name-that-a-tenant-gives-is-one-name-in-the-config-folder.md, status proposed)
  it.each([
    ['Login', 'Login'],
    ['My Theme', 'My Theme'],
    ['alpha_user', 'alpha_user'],
    ['ünï', 'ünï'],
    ['a:b', 'a:b'],
    ['Login:SSO', 'Login:SSO'],
    ['..foo', '..foo'],
    ['.hidden', '.hidden'],
    ['a.b', 'a.b'],
    ['-x', '-x'],
    ['con', 'con'],
    ['a.', 'a.'],
    ['a/b', 'a%2Fb'],
    ['a\\b', 'a%5Cb'],
    ['../x', '..%2Fx'],
    ['..\\..\\x', '..%5C..%5Cx'],
    ['/etc/x', '%2Fetc%2Fx'],
    ['C:\\x', 'C%3A%5Cx'],
    ['ABC:x', 'ABC%3Ax'],
    ['a\nb', 'a%0Ab'],
    ['a\tb', 'a%09b'],
    ['a\u0000b', 'a%00b'],
    ['a*b/c', 'ab%2Fc'],
  ])('the name %j is the name %j in a folder', (selector, expected) => {
    expect(nameInFolder(selector)).toBe(expected);
  });

  it.each([[''], ['.'], ['..']])(
    '%j leaves no name: it is refused, naming it',
    (selector) => {
      expect(() => nameInFolder(selector)).toThrow(
        `'${selector}' does not name an object: an id or a name is not a path`
      );
      expect(() => nameInStem(selector)).toThrow('does not name an object');
    }
  );

  it('does not cut a long name silently: it keeps the start and adds the checksum, so that two long names never become one', () => {
    // one safe name, as typed, of 255 bytes: it fits with no suffix and not with `.json`
    expect(nameInFolder('n'.repeat(250))).toBe('n'.repeat(250));
    expect(nameInFolder('n'.repeat(300))).toBe(`${'n'.repeat(241)}~cd5124b3`);
    // a name of 255 bytes that holds a slash is 257 bytes once the slash is written as %2F
    expect(nameInFolder(`a/${'n'.repeat(253)}`)).toBe(
      `a%2F${'n'.repeat(237)}~0c8bfa62`
    );
    // 250 bytes fit, 251 do not
    expect(nameInFolder(`a/${'n'.repeat(246)}`)).toBe(`a%2F${'n'.repeat(246)}`);
    expect(nameInFolder(`a/${'n'.repeat(247)}`)).toBe(
      `a%2F${'n'.repeat(237)}~6878efc3`
    );
    // the two ids that the old cut made one name are two names now
    expect(nameInFolder(`a/${'n'.repeat(251)}`)).not.toBe(
      nameInFolder(`a/${'n'.repeat(252)}`)
    );
  });

  it('counts the bytes of the encoded name, and the `*` that the sanitizer sees before it takes it out', () => {
    // 126 characters of two bytes and a slash written as %2F: 256 bytes
    expect(nameInFolder(`a/${'é'.repeat(126)}`)).toBe(
      `a%2F${'é'.repeat(118)}~86870cac`
    );
    // 4 + 123 * 2 = 250 bytes fit
    expect(nameInFolder(`a/${'é'.repeat(123)}`)).toBe(`a%2F${'é'.repeat(123)}`);
    // the sanitizer cuts before it removes a `*`, so a `*` counts as a byte when it decides whether anything is cut
    expect(nameInFolder(`a/${'n'.repeat(251)}*`)).toBe(
      `a%2F${'n'.repeat(237)}~691e0621`
    );
    // the sanitizer cuts nothing of 251 bytes, and what is left of the name is 250 bytes: the name that main gave
    expect(nameInFolder(`a/${'n'.repeat(246)}*`)).toBe(
      `a%2F${'n'.repeat(246)}`
    );
    expect(nameInFolder(`a/${'n'.repeat(245)}*`)).toBe(
      `a%2F${'n'.repeat(245)}`
    );
  });

  it('shows a control character of a refused name as an escape', () => {
    let message = '';
    try {
      nameInFolder('\u001b[31m');
      nameInFolder('.');
    } catch (error) {
      message = error.message;
    }
    expect(message).toBe(
      "'.' does not name an object: an id or a name is not a path"
    );
  });

  it('a long name made of control characters is shortened at a whole escape', () => {
    const name = nameInFolder(`/${'n\u0001'.repeat(200)}`);

    expect(name).toMatch(/^%2Fn%01n%01.*~[0-9a-f]{8}$/);
    expect(name).not.toMatch(/%[0-9A-F]?~/);
    expect(Buffer.byteLength(name)).toBeLessThanOrEqual(250);
  });

  it('turns a number into its text, as a template does', () => {
    expect(nameInFolder(1.5 as unknown as string)).toBe('1.5');
    expect(nameInFolder(7 as unknown as string)).toBe('7');
  });

  it.each([
    ['Login', 'Login'],
    ['Login:SSO', 'Login:SSO'],
    ['a:b', 'a%3Ab'],
    ['C:', 'C%3A'],
    // a drive letter is a letter of either case: `C:` is `C%3A` already by nameInFolder, the others only by the stem
    ['D:x', 'D%3Ax'],
    ['Z:', 'Z%3A'],
    ['z:x', 'z%3Ax'],
    ['X:', 'X%3A'],
    ['x:y:z', 'x%3Ay:z'],
    ['a/b', 'a%2Fb'],
    ['1:2', '1:2'],
  ])(
    'the stem of a file that a file refers to: %j is %j',
    (selector, expected) => {
      expect(nameInStem(selector)).toBe(expected);
    }
  );

  it('a file that is named by a stem is a reference that referencedFilePath accepts, for every name', () => {
    for (const selector of [
      'Login',
      'a:b',
      'Login:SSO',
      'C:',
      'z:',
      'D:x',
      'Z:',
      'a/b',
      '..C:',
      '../x',
      'x\\y',
      'é',
      '.hidden',
    ]) {
      const reference = `${nameInStem(selector)}.onCreate.js`;

      expect(() => referencedFilePath('/w/folder', reference)).not.toThrow();
    }
  });
});

describe('a drive letter of a reference, in either case', () => {
  it.each([['D:x'], ['Z:'], ['d:x'], ['z:'], ['a:b']])(
    'refuses a reference that starts with %j, and accepts the file that nameInStem makes of the name',
    (name) => {
      expect(() =>
        referencedFilePath('/w/folder', `${name}.onCreate.js`)
      ).toThrow('must stay inside the config folder');
      expect(() =>
        referencedFilePath('/w/folder', `${nameInStem(name)}.onCreate.js`)
      ).not.toThrow();
    }
  );
});

describe('encodedName', () => {
  it.each([
    ['Login', 'Login'],
    ['My Script', 'My Script'],
    ['a/b', 'a%2Fb'],
    ['a:b', 'a%3Ab'],
    ['a?b', 'a%3Fb'],
    ['a*b', 'ab'],
    ['a\u0000b', 'a%00b'],
    ['é', 'é'],
    ['..foo', '..foo'],
  ])(
    'the file name of %j is %j: every character of a path is written as %%XX',
    (selector, expected) => {
      expect(encodedName(selector)).toBe(expected);
    }
  );

  it.each([[''], ['.'], ['..'], ['...'], ['con'], ['CON'], ['nul.txt']])(
    '%j leaves no name: it is refused, naming it',
    (selector) => {
      expect(() => encodedName(selector)).toThrow(
        `'${selector}' does not name an object: an id or a name is not a path`
      );
    }
  );

  it('does not cut a name silently: 250 bytes fit with `.json`, more get a checksum', () => {
    expect(encodedName('n'.repeat(250))).toBe('n'.repeat(250));
    expect(encodedName('n'.repeat(251))).toBe(`${'n'.repeat(241)}~3720803a`);
    expect(encodedName('n'.repeat(256))).toBe(`${'n'.repeat(241)}~fda476ec`);
    // bytes, not characters
    expect(encodedName('é'.repeat(125))).toBe('é'.repeat(125));
    expect(encodedName('é'.repeat(128))).toBe(`${'é'.repeat(120)}~79c2c47d`);
    // a slash is three bytes once encoded
    expect(encodedName(`a/${'n'.repeat(253)}`)).toBe(
      `a%2F${'n'.repeat(237)}~0c8bfa62`
    );
  });

  it('is nameInFolder for a name that is not one safe name, and differs for one that is (it always encodes)', () => {
    expect(encodedName('a/b')).toBe(nameInFolder('a/b'));
    expect(encodedName('Login:SSO')).toBe('Login%3ASSO');
    expect(nameInFolder('Login:SSO')).toBe('Login:SSO');
  });
});

describe('sameOnAnyFileSystem', () => {
  it.each([
    ['a case', 'A.json', 'a.json'],
    ['a folder case', 'Themes/Login', 'themes/login'],
    ['two Unicode forms', '\u00e9', 'e\u0301'],
    ['an upper case letter with an accent', '\u00c9', '\u00e9'],
    [
      'two lone surrogates, which a file system writes as U+FFFD',
      '\ud800',
      '\ud801',
    ],
    ['a lone surrogate and U+FFFD', '\ud800', '\ufffd'],
    // the capital sharp s has the sharp s for its lower case form
    ['a capital sharp s and a sharp s', '\u1e9e', '\u00df'],
    // lower casing a T with a diaeresis (two code points) leaves a form that only a second normalisation turns into U+1E97
    [
      'a T with a combining diaeresis and the t with a diaeresis',
      'T\u0308',
      '\u1e97',
    ],
  ])('takes %s for one name', (_what, one, other) => {
    expect(sameOnAnyFileSystem(one)).toBe(sameOnAnyFileSystem(other));
  });

  it.each([
    // the key is the lower case form, as on the command line: the upper case form would take these for one name
    ['a sharp s and two s', '\u00df', 'ss'],
    ['a long s and an s', '\u017f', 's'],
    ['a final sigma and a sigma', '\u03c2', '\u03c3'],
    ['a different letter', 'a', 'b'],
    ['a name that only looks alike', 'a%2Fb', 'a/b'],
    ['an underscore', 'a_', 'a'],
    ['a folder and a file', 'a/b', 'a_b'],
    ['a character and its full width form', 'a', '\uff41'],
  ])('keeps %s apart', (_what, one, other) => {
    expect(sameOnAnyFileSystem(one)).not.toBe(sameOnAnyFileSystem(other));
  });

  it('gives the same name when applied again', () => {
    for (const name of ['A', '\u00c9', 'e\u0301', '\ud800x', 'a/B', '']) {
      const once = sameOnAnyFileSystem(name);

      expect(sameOnAnyFileSystem(once)).toBe(once);
    }
  });
});

describe('assertFileSetPath', () => {
  it.each([
    ['a'],
    ['a/b'],
    ['realms/alpha/journeys/Login/Login.json'],
    ['custom-nodes/nodes/My Node/My Node.js'],
    ['a:b.json'],
    ['x:y'],
    ['..foo.json'],
    ['foo..'],
    ['.hidden/x.json'],
    ['a%2Fb.json'],
    ['C'],
    ['Cx.json'],
    ['c/x'],
    ['a'.repeat(255)],
    [`d/${'n'.repeat(250)}.json`],
    ['é'.repeat(127)],
    ['€'.repeat(85)],
    ['😀'.repeat(63)],
    ['a b/c d.json'],
    ['Login:SSO.onCreate.js'],
  ])('accepts %j', (path) => {
    expect(() => assertFileSetPath(path)).not.toThrow();
  });

  /** [the path, the reason in the message] */
  const REFUSED: [string, string][] = [
    // empty and absolute
    ['/', 'is an absolute path'],
    ['/a', 'is an absolute path'],
    ['/etc/passwd', 'is an absolute path'],
    ['//a', 'is an absolute path'],
    // an empty part
    ['a/', 'has an empty part'],
    ['a//b', 'has an empty part'],
    ['a/b/', 'has an empty part'],
    ['a///b', 'has an empty part'],
    ['realms/', 'has an empty part'],
    ['a/b/c/', 'has an empty part'],
    ['a/ /', 'has an empty part'],
    // `.` and `..` as a part
    ['.', "has '.' as a part"],
    ['./', "has '.' as a part"],
    ['./a', "has '.' as a part"],
    ['a/./b', "has '.' as a part"],
    ['a/.', "has '.' as a part"],
    ['..', "has '..' as a part"],
    ['../x', "has '..' as a part"],
    ['a/..', "has '..' as a part"],
    ['a/../b', "has '..' as a part"],
    ['a/b/../../../x', "has '..' as a part"],
    // a backslash
    ['a\\b', 'holds a backslash'],
    ['..\\x', 'holds a backslash'],
    ['\\a', 'holds a backslash'],
    ['a/b\\', 'holds a backslash'],
    ['\\\\server\\share\\x', 'holds a backslash'],
    // `C:` anywhere
    ['C:\\x', 'holds a backslash'],
    ['..C:/x', "holds 'C:'"],
    ['.C:./x', "holds 'C:'"],
    ['ABC:x.json', "holds 'C:'"],
    ['a/C:', "holds 'C:'"],
    ['a/x.C:', "holds 'C:'"],
    ['CC::x', "holds 'C:'"],
    // a drive letter
    ['C:', 'starts with a drive letter'],
    ['C:/x', 'starts with a drive letter'],
    ['c:/x', 'starts with a drive letter'],
    ['c:', 'starts with a drive letter'],
    ['a:/x', 'starts with a drive letter'],
    ['z:', 'starts with a drive letter'],
    ['C:/', 'starts with a drive letter'],
    ['d:/x/y.json', 'starts with a drive letter'],
    ['Z:/a/b', 'starts with a drive letter'],
    // a control character
    ['a\u0000b', 'holds a control character'],
    ['\u0000', 'holds a control character'],
    ['a\nb', 'holds a control character'],
    ['a\tb', 'holds a control character'],
    ['a/\rb', 'holds a control character'],
    ['a\u007fb', 'holds a control character'],
    ['a\u0085b', 'holds a control character'],
    ['a\u009fb', 'holds a control character'],
    ['a\u001b[31mb', 'holds a control character'],
    // a part of more than 255 bytes
    ['a'.repeat(256), 'has a part of more than 255 bytes'],
    [`d/${'a'.repeat(256)}`, 'has a part of more than 255 bytes'],
    [`${'a'.repeat(256)}/d`, 'has a part of more than 255 bytes'],
    ['é'.repeat(128), 'has a part of more than 255 bytes'],
    ['€'.repeat(86), 'has a part of more than 255 bytes'],
    [`${'€'.repeat(85)}x`, 'has a part of more than 255 bytes'],
    ['😀'.repeat(64), 'has a part of more than 255 bytes'],
    // a character that is not text
    ['\ud800', 'holds a character that is not text'],
    ['a\udc00b', 'holds a character that is not text'],
    ['\ud83d', 'holds a character that is not text'],
    ['x/\udbff', 'holds a character that is not text'],
  ];

  it.each(REFUSED)('refuses %j: it %s', (path, why) => {
    expect(() => assertFileSetPath(path)).toThrow(
      new RegExp(`is not a path inside a file set: it ${why}\\.$`)
    );
  });

  it('has at least sixty refused shapes', () => {
    expect(REFUSED.length).toBeGreaterThanOrEqual(60);
  });

  it.each([[''], [undefined], [null], [42], [{}], [['a']], [true]])(
    'refuses %j: a file needs a path',
    (path) => {
      expect(() => assertFileSetPath(path as unknown as string)).toThrow(
        'A file of a file set needs a path.'
      );
    }
  );

  it('names the path in the message, and writes a control character as an escape so that the message cannot change what a terminal shows', () => {
    expect(() => assertFileSetPath('a\u001b[31mb/..')).toThrow(
      "The path 'a\\u001b[31mb/..' is not a path inside a file set: it holds a control character."
    );
    expect(() => assertFileSetPath('../x')).toThrow(
      "The path '../x' is not a path inside a file set: it has '..' as a part."
    );
  });

  it('cuts a long path in the message', () => {
    expect(() => assertFileSetPath(`${'a'.repeat(300)}`)).toThrow(
      `The path '${'a'.repeat(100)}...' is not a path inside a file set`
    );
  });

  it('accepts exactly 255 bytes and refuses 256, in characters of one, two, three and four bytes', () => {
    for (const [character, bytes] of [
      ['a', 1],
      ['é', 2],
      ['€', 3],
      ['😀', 4],
    ] as [string, number][]) {
      const most = Math.floor(255 / bytes);

      expect(Buffer.byteLength(character.repeat(most))).toBeLessThanOrEqual(
        255
      );
      expect(() => assertFileSetPath(character.repeat(most))).not.toThrow();
      expect(() => assertFileSetPath(character.repeat(most + 1))).toThrow(
        'has a part of more than 255 bytes'
      );
      // the same for a part below a folder: every part has its own 255
      expect(() =>
        assertFileSetPath(`${character.repeat(most)}/${character.repeat(most)}`)
      ).not.toThrow();
    }
  });

  it('is left out of the capability inventory of the MCP server by a reviewed entry', () => {
    expect(CAPABILITY_META['utils.assertFileSetPath']?.excluded).toBe(true);
    expect(
      buildCapabilityInventory(frodo).map((capability) => capability.id)
    ).not.toContain('utils.assertFileSetPath');
  });

  it('is the gate on the facade: frodo.utils.assertFileSetPath says the same', () => {
    expect(() =>
      frodo.utils.assertFileSetPath('realms/root/x.json')
    ).not.toThrow();
    expect(() => frodo.utils.assertFileSetPath('../x')).toThrow(
      "The path '../x' is not a path inside a file set: it has '..' as a part."
    );
    expect(FileSetPathUtils().assertFileSetPath).toEqual(expect.any(Function));
    expect(() => FileSetPathUtils().assertFileSetPath('a//b')).toThrow(
      'has an empty part'
    );
  });
});

/**
 * The safety argument for the gate as a test: the library rewrites a path after it was judged (`\` is `/`, every `C:`
 * goes, the working directory comes first), so whatever the gate lets through must be read as it was judged, and must be
 * inside the working directory. 13 pieces, every concatenation of up to five.
 */
describe('what the gate lets through is what the library reads (a corpus of 402,234 strings)', () => {
  const PIECES = [
    '..',
    '.',
    'C:',
    'c:',
    ':',
    '\\',
    '/',
    '%3A',
    '\uff1a',
    'a',
    'x.js',
    'CC::',
    'C',
  ];
  const WORKING_DIRECTORY = '/work/corpus';

  const corpus = function* (max = 5) {
    const walk = function* (prefix: string, depth: number): Generator<string> {
      yield prefix;
      if (depth === max) return;
      for (const piece of PIECES) yield* walk(prefix + piece, depth + 1);
    };
    yield* walk('', 0);
  };

  /** The strings that the gate lets through and the library reads differently or outside the directory. */
  const violationsOf = (gate: (path: string) => void, max = 5) => {
    const violations: string[] = [];
    let accepted = 0;
    let refused = 0;
    let total = 0;
    for (const path of corpus(max)) {
      total++;
      try {
        gate(path);
      } catch {
        refused++;
        continue;
      }
      accepted++;
      if (normalizeFilePath(path) !== path) {
        violations.push(`rewritten: ${path}`);
        continue;
      }
      try {
        assertInside(
          WORKING_DIRECTORY,
          joinWorkingDirectory(WORKING_DIRECTORY, path)
        );
      } catch {
        violations.push(`outside: ${path}`);
      }
    }
    return { violations, accepted, refused, total };
  };

  it('is unchanged by the rewrite and stays inside the working directory, for every string', () => {
    const { violations, accepted, refused, total } =
      violationsOf(assertFileSetPath);

    expect(violations.slice(0, 5)).toEqual([]);
    // 1 + 13 + 13^2 + 13^3 + 13^4 + 13^5 strings
    expect(total).toBe(402234);
    // the corpus has both sorts in it
    expect(accepted).toBeGreaterThan(10000);
    expect(refused).toBeGreaterThan(300000);
  });

  it('the corpus can fail: a gate that only looks for `..`, one that forgets `C:` and one that forgets the backslash are found', () => {
    /** The gate as it is, without one of its tests. */
    const gateWithout =
      ({
        backslash,
        c,
        dots,
      }: {
        backslash: boolean;
        c: boolean;
        dots: boolean;
      }) =>
      (path: string) => {
        if (path === '' || path.startsWith('/')) throw new Error('refused');
        if (backslash && path.includes('\\')) throw new Error('refused');
        if (c && path.includes('C:')) throw new Error('refused');
        const segments = path.split('/');
        if (segments.includes('.')) throw new Error('refused');
        if (dots && segments.includes('..')) throw new Error('refused');
        if (segments.includes('')) throw new Error('refused');
      };
    const complete = { backslash: true, c: true, dots: true };

    expect(violationsOf(gateWithout(complete), 3).violations).toEqual([]);
    expect(
      violationsOf(gateWithout({ ...complete, c: false }), 3).violations
    ).toContain('rewritten: ..C:');
    expect(
      violationsOf(gateWithout({ ...complete, backslash: false }), 3).violations
    ).toContain('rewritten: ..\\');
    expect(
      violationsOf(gateWithout({ ...complete, dots: false }), 3).violations
    ).toContain('outside: ../a');
  });
});

/**
 * The names of ids that do not fit. A name has to fit in 255 bytes together with the longest suffix that the type uses
 * (`.json` by default). An id that does not fit gets a shortened name: its encoded name cut at a whole character, `~`, and
 * the first 8 hexadecimal characters of the SHA-256 of the complete id as UTF-16 code units. The format is on disk and
 * permanent, so the table below was made by an independent implementation, not by these functions.
 */
describe('a name that does not fit gets a checksum', () => {
  const FUNCTIONS: Record<string, (id: string, suffix?: string) => string> = {
    fileNameOf,
    encodedName,
    nameInFolder,
    nameInStem,
  };

  // Generated by an independent implementation (Python 3, hashlib and urllib); the checksum of a row is
  // sha256(id.encode('utf-16-le', 'surrogatepass')).hexdigest()[:8], the cut is written again from the rule.
  // [function, id, longest suffix, name]; `undefined` is a value that leaves no name (fileNameOf gives '').
  const GOLDEN: [string, string, string, string | undefined][] = [
    ['fileNameOf', rep('a', 300), '.json', rep('a', 241) + '~e8722168'],
    ['encodedName', rep('a', 300), '.json', rep('a', 241) + '~e8722168'],
    ['nameInFolder', rep('a', 300), '.json', rep('a', 241) + '~e8722168'],
    ['nameInStem', rep('a', 300), '.json', rep('a', 241) + '~e8722168'],
    ['fileNameOf', rep('a', 251), '.json', rep('a', 241) + '~d260b91f'],
    ['encodedName', rep('a', 251), '.json', rep('a', 241) + '~d260b91f'],
    ['nameInFolder', rep('a', 251), '.json', rep('a', 241) + '~d260b91f'],
    ['fileNameOf', rep('a', 250), '.json', rep('a', 250)],
    ['encodedName', rep('a', 250), '.json', rep('a', 250)],
    ['nameInFolder', rep('a', 250), '.json', rep('a', 250)],
    ['fileNameOf', rep('a', 255), '', rep('a', 255)],
    ['encodedName', rep('a', 255), '', rep('a', 255)],
    ['nameInFolder', rep('a', 255), '', rep('a', 255)],
    ['fileNameOf', rep('a', 256), '', rep('a', 246) + '~0fe06eea'],
    ['encodedName', rep('a', 256), '', rep('a', 246) + '~0fe06eea'],
    ['nameInFolder', rep('a', 256), '', rep('a', 246) + '~0fe06eea'],
    ['fileNameOf', rep('x', 300) + '-1', '.json', rep('x', 241) + '~bed1c36e'],
    ['encodedName', rep('x', 300) + '-1', '.json', rep('x', 241) + '~bed1c36e'],
    [
      'nameInFolder',
      rep('x', 300) + '-1',
      '.json',
      rep('x', 241) + '~bed1c36e',
    ],
    ['fileNameOf', rep('x', 300) + '-2', '.json', rep('x', 241) + '~001fbd52'],
    ['encodedName', rep('x', 300) + '-2', '.json', rep('x', 241) + '~001fbd52'],
    [
      'nameInFolder',
      rep('x', 300) + '-2',
      '.json',
      rep('x', 241) + '~001fbd52',
    ],
    [
      'fileNameOf',
      rep('a', 300) + '7449',
      '.json',
      rep('a', 241) + '~5b2c45dc',
    ],
    [
      'nameInFolder',
      rep('a', 300) + '7449',
      '.json',
      rep('a', 241) + '~5b2c45dc',
    ],
    [
      'fileNameOf',
      rep('a', 300) + '22501',
      '.json',
      rep('a', 241) + '~5b2c45dc',
    ],
    [
      'nameInFolder',
      rep('a', 300) + '22501',
      '.json',
      rep('a', 241) + '~5b2c45dc',
    ],
    ['fileNameOf', rep('/', 100), '.json', rep('%2F', 80) + '~660c00d4'],
    ['encodedName', rep('/', 100), '.json', rep('%2F', 80) + '~660c00d4'],
    ['nameInFolder', rep('/', 100), '.json', rep('%2F', 80) + '~660c00d4'],
    ['fileNameOf', rep('/', 86), '', rep('%2F', 82) + '~c4d15c2e'],
    ['encodedName', rep('/', 86), '', rep('%2F', 82) + '~c4d15c2e'],
    ['nameInFolder', rep('/', 86), '', rep('%2F', 82) + '~c4d15c2e'],
    ['fileNameOf', rep('/', 85), '', rep('%2F', 85)],
    ['encodedName', rep('/', 85), '', rep('%2F', 85)],
    ['nameInFolder', rep('/', 85), '', rep('%2F', 85)],
    ['fileNameOf', rep('é', 200), '.json', rep('é', 120) + '~bf52c47b'],
    ['encodedName', rep('é', 200), '.json', rep('é', 120) + '~bf52c47b'],
    ['nameInFolder', rep('é', 200), '.json', rep('é', 120) + '~bf52c47b'],
    ['fileNameOf', rep('é', 125), '.json', rep('é', 125)],
    ['nameInFolder', rep('é', 125), '.json', rep('é', 125)],
    ['fileNameOf', rep('€', 100), '.json', rep('€', 80) + '~32776e23'],
    ['nameInFolder', rep('€', 100), '.json', rep('€', 80) + '~32776e23'],
    ['fileNameOf', rep('😀', 70), '.json', rep('😀', 60) + '~4a62e2af'],
    ['encodedName', rep('😀', 70), '.json', rep('😀', 60) + '~4a62e2af'],
    ['nameInFolder', rep('😀', 70), '.json', rep('😀', 60) + '~4a62e2af'],
    [
      'fileNameOf',
      rep('a', 4) + rep('\u0085', 100),
      '.json',
      rep('a', 4) + rep('%C2%85', 39) + '~ddb52c11',
    ],
    [
      'encodedName',
      rep('a', 4) + rep('\u0085', 100),
      '.json',
      rep('a', 4) + rep('%C2%85', 39) + '~ddb52c11',
    ],
    [
      'nameInFolder',
      rep('a', 4) + rep('\u0085', 100),
      '.json',
      rep('a', 4) + rep('%C2%85', 39) + '~ddb52c11',
    ],
    [
      'fileNameOf',
      rep('a', 235) + rep('\u0085', 10),
      '.json',
      rep('a', 235) + '%C2%85~84855dd1',
    ],
    [
      'nameInFolder',
      rep('a', 235) + rep('\u0085', 10),
      '.json',
      rep('a', 235) + '%C2%85~84855dd1',
    ],
    [
      'fileNameOf',
      rep('a', 236) + rep('\u0085', 10),
      '.json',
      rep('a', 236) + '~ac175dcd',
    ],
    [
      'nameInFolder',
      rep('a', 236) + rep('\u0085', 10),
      '.json',
      rep('a', 236) + '~ac175dcd',
    ],
    [
      'fileNameOf',
      rep('a', 237) + rep('\u0085', 10),
      '.json',
      rep('a', 237) + '~c9ca88da',
    ],
    [
      'nameInFolder',
      rep('a', 237) + rep('\u0085', 10),
      '.json',
      rep('a', 237) + '~c9ca88da',
    ],
    [
      'fileNameOf',
      rep('a', 238) + rep('\u0085', 10),
      '.json',
      rep('a', 238) + '~a056027f',
    ],
    [
      'nameInFolder',
      rep('a', 238) + rep('\u0085', 10),
      '.json',
      rep('a', 238) + '~a056027f',
    ],
    [
      'fileNameOf',
      rep('a', 239) + rep('\u0085', 10),
      '.json',
      rep('a', 239) + '~60324612',
    ],
    [
      'nameInFolder',
      rep('a', 239) + rep('\u0085', 10),
      '.json',
      rep('a', 239) + '~60324612',
    ],
    [
      'fileNameOf',
      rep('a', 240) + rep('\u0085', 10),
      '.json',
      rep('a', 240) + '~182db068',
    ],
    [
      'nameInFolder',
      rep('a', 240) + rep('\u0085', 10),
      '.json',
      rep('a', 240) + '~182db068',
    ],
    ['fileNameOf', 'x\ud800', '.json', 'x\ufffd~a7490da1'],
    ['encodedName', 'x\ud800', '.json', 'x\ufffd~a7490da1'],
    ['nameInFolder', 'x\ud800', '.json', 'x\ufffd~a7490da1'],
    ['fileNameOf', 'x\ufffd', '.json', 'x\ufffd'],
    ['encodedName', 'x\ufffd', '.json', 'x\ufffd'],
    ['nameInFolder', 'x\ufffd', '.json', 'x\ufffd'],
    ['fileNameOf', 'x\ud800y', '.json', 'x\ufffdy~2055a8e2'],
    ['nameInFolder', 'x\ud800y', '.json', 'x\ufffdy~2055a8e2'],
    ['fileNameOf', 'x\ud801y', '.json', 'x\ufffdy~9ef5b225'],
    ['nameInFolder', 'x\ud801y', '.json', 'x\ufffdy~9ef5b225'],
    ['fileNameOf', '\ud800', '.json', '\ufffd~205022e3'],
    ['nameInFolder', '\ud800', '.json', '\ufffd~205022e3'],
    ['fileNameOf', '\udc00', '.json', '\ufffd~d63ddb2b'],
    ['nameInFolder', '\udc00', '.json', '\ufffd~d63ddb2b'],
    [
      'fileNameOf',
      rep('x', 254) + '\ud800',
      '.json',
      rep('x', 241) + '~426b50d5',
    ],
    [
      'encodedName',
      rep('x', 254) + '\ud800',
      '.json',
      rep('x', 241) + '~426b50d5',
    ],
    [
      'nameInFolder',
      rep('x', 254) + '\ud800',
      '.json',
      rep('x', 241) + '~426b50d5',
    ],
    [
      'fileNameOf',
      rep('x', 245) + '\ud800',
      '.json',
      rep('x', 241) + '~f5d9cade',
    ],
    [
      'nameInFolder',
      rep('x', 245) + '\ud800',
      '.json',
      rep('x', 241) + '~f5d9cade',
    ],
    ['fileNameOf', rep('x', 254) + '\ud800', '', rep('x', 246) + '~426b50d5'],
    ['nameInFolder', rep('x', 254) + '\ud800', '', rep('x', 246) + '~426b50d5'],
    ['fileNameOf', rep('x', 250) + '\ud800', '', rep('x', 246) + '~ab8d4c46'],
    ['nameInFolder', rep('x', 250) + '\ud800', '', rep('x', 246) + '~ab8d4c46'],
    ['fileNameOf', rep('x', 243), '.onCreate.js', rep('x', 243)],
    ['encodedName', rep('x', 243), '.onCreate.js', rep('x', 243)],
    ['nameInFolder', rep('x', 243), '.onCreate.js', rep('x', 243)],
    ['fileNameOf', rep('a', 244), '.onCreate.js', rep('a', 234) + '~abcb1ecd'],
    ['encodedName', rep('a', 244), '.onCreate.js', rep('a', 234) + '~abcb1ecd'],
    [
      'nameInFolder',
      rep('a', 244),
      '.onCreate.js',
      rep('a', 234) + '~abcb1ecd',
    ],
    ['fileNameOf', rep('a', 245), '.onCreate.js', rep('a', 234) + '~35dceed4'],
    [
      'nameInFolder',
      rep('a', 245),
      '.onCreate.js',
      rep('a', 234) + '~35dceed4',
    ],
    [
      'fileNameOf',
      rep('a', 215),
      '.lllllllllllllllllllllllllllllllllllllll',
      rep('a', 215),
    ],
    [
      'nameInFolder',
      rep('a', 215),
      '.lllllllllllllllllllllllllllllllllllllll',
      rep('a', 215),
    ],
    [
      'fileNameOf',
      rep('a', 216),
      '.lllllllllllllllllllllllllllllllllllllll',
      rep('a', 206) + '~f0ed1300',
    ],
    [
      'nameInFolder',
      rep('a', 216),
      '.lllllllllllllllllllllllllllllllllllllll',
      rep('a', 206) + '~f0ed1300',
    ],
    ['nameInStem', 'a:' + rep('n', 246), '.json', 'a%3A' + rep('n', 246)],
    ['nameInFolder', 'a:' + rep('n', 246), '.json', 'a:' + rep('n', 246)],
    [
      'nameInStem',
      'a:' + rep('n', 247),
      '.json',
      'a%3A' + rep('n', 237) + '~a43dbedc',
    ],
    ['nameInFolder', 'a:' + rep('n', 247), '.json', 'a:' + rep('n', 247)],
    [
      'nameInStem',
      'a:' + rep('n', 247),
      '.onCreate.js',
      'a%3A' + rep('n', 230) + '~a43dbedc',
    ],
    [
      'nameInStem',
      'Z:' + rep('n', 300),
      '.json',
      'Z%3A' + rep('n', 237) + '~c124484a',
    ],
    [
      'fileNameOf',
      rep('x', 200) + rep('*', 100),
      '.json',
      rep('x', 200) + '~d61daa2d',
    ],
    [
      'encodedName',
      rep('x', 200) + rep('*', 100),
      '.json',
      rep('x', 200) + '~d61daa2d',
    ],
    [
      'nameInFolder',
      rep('x', 200) + rep('*', 100),
      '.json',
      rep('x', 200) + rep('*', 41) + '~d61daa2d',
    ],
    ['fileNameOf', rep('*', 300) + 'abc', '.json', undefined],
    [
      'nameInFolder',
      rep('*', 300) + 'abc',
      '.json',
      rep('*', 241) + '~96467f3f',
    ],
    ['fileNameOf', rep('x', 249) + ' ', '.json', rep('x', 241) + '~f7444881'],
    ['encodedName', rep('x', 249) + ' ', '.json', rep('x', 241) + '~f7444881'],
    ['nameInFolder', rep('x', 249) + ' ', '.json', rep('x', 249) + ' '],
    ['fileNameOf', rep('x', 248) + '...', '.json', rep('x', 248)],
    ['encodedName', rep('x', 248) + '...', '.json', rep('x', 248)],
    [
      'nameInFolder',
      rep('x', 248) + '...',
      '.json',
      rep('x', 241) + '~8003d65d',
    ],
    [
      'fileNameOf',
      rep('x', 240) + '%2F' + rep('b', 20),
      '.json',
      rep('x', 240) + '~34119c09',
    ],
    [
      'encodedName',
      rep('x', 240) + '%2F' + rep('b', 20),
      '.json',
      rep('x', 240) + '~34119c09',
    ],
    [
      'nameInFolder',
      rep('x', 240) + '%2F' + rep('b', 20),
      '.json',
      rep('x', 240) + '~34119c09',
    ],
    [
      'fileNameOf',
      rep('x', 239) + '%2F' + rep('b', 20),
      '.json',
      rep('x', 239) + '~9df4543b',
    ],
    [
      'encodedName',
      rep('x', 239) + '%2F' + rep('b', 20),
      '.json',
      rep('x', 239) + '~9df4543b',
    ],
    [
      'nameInFolder',
      rep('x', 239) + '%2F' + rep('b', 20),
      '.json',
      rep('x', 239) + '~9df4543b',
    ],
    ['fileNameOf', rep('%', 300), '.json', rep('%', 240) + '~2291a471'],
    ['encodedName', rep('%', 300), '.json', rep('%', 240) + '~2291a471'],
    ['nameInFolder', rep('%', 300), '.json', rep('%', 240) + '~2291a471'],
    [
      'fileNameOf',
      rep('x', 239) + '%%2' + rep('b', 20),
      '.json',
      rep('x', 239) + '%~49300bdb',
    ],
    [
      'encodedName',
      rep('x', 239) + '%%2' + rep('b', 20),
      '.json',
      rep('x', 239) + '%~49300bdb',
    ],
    [
      'nameInFolder',
      rep('x', 239) + '%%2' + rep('b', 20),
      '.json',
      rep('x', 239) + '%~49300bdb',
    ],
    [
      'fileNameOf',
      rep('x', 238) + '%C2' + rep('b', 20),
      '.json',
      rep('x', 238) + '~91dec88c',
    ],
    [
      'encodedName',
      rep('x', 238) + '%C2' + rep('b', 20),
      '.json',
      rep('x', 238) + '~91dec88c',
    ],
    [
      'nameInFolder',
      rep('x', 238) + '%C2' + rep('b', 20),
      '.json',
      rep('x', 238) + '~91dec88c',
    ],
    [
      'fileNameOf',
      rep('x', 238) + '%c2' + rep('b', 20),
      '.json',
      rep('x', 238) + '~c7e3b8d2',
    ],
    [
      'encodedName',
      rep('x', 238) + '%c2' + rep('b', 20),
      '.json',
      rep('x', 238) + '~c7e3b8d2',
    ],
    [
      'nameInFolder',
      rep('x', 238) + '%c2' + rep('b', 20),
      '.json',
      rep('x', 238) + '~c7e3b8d2',
    ],
    ['fileNameOf', rep('.', 300), '.json', undefined],
    ['encodedName', rep('.', 300), '.json', undefined],
    ['nameInFolder', rep('.', 300), '.json', rep('.', 241) + '~f7071ffd'],
    ['fileNameOf', 'nul.' + rep('x', 300), '.json', undefined],
    ['encodedName', 'nul.' + rep('x', 300), '.json', undefined],
    [
      'nameInFolder',
      'nul.' + rep('x', 300),
      '.json',
      'nul.' + rep('x', 237) + '~bd4e9aff',
    ],
    [
      'fileNameOf',
      'a/' + rep('n', 251),
      '.json',
      'a%2F' + rep('n', 237) + '~a1933937',
    ],
    [
      'encodedName',
      'a/' + rep('n', 251),
      '.json',
      'a%2F' + rep('n', 237) + '~a1933937',
    ],
    [
      'nameInFolder',
      'a/' + rep('n', 251),
      '.json',
      'a%2F' + rep('n', 237) + '~a1933937',
    ],
    [
      'fileNameOf',
      'a/' + rep('n', 250),
      '.json',
      'a%2F' + rep('n', 237) + '~411ed8e6',
    ],
    [
      'encodedName',
      'a/' + rep('n', 250),
      '.json',
      'a%2F' + rep('n', 237) + '~411ed8e6',
    ],
    [
      'nameInFolder',
      'a/' + rep('n', 250),
      '.json',
      'a%2F' + rep('n', 237) + '~411ed8e6',
    ],
    [
      'fileNameOf',
      'a/' + rep('n', 249),
      '.json',
      'a%2F' + rep('n', 237) + '~2643f1c8',
    ],
    [
      'encodedName',
      'a/' + rep('n', 249),
      '.json',
      'a%2F' + rep('n', 237) + '~2643f1c8',
    ],
    [
      'nameInFolder',
      'a/' + rep('n', 249),
      '.json',
      'a%2F' + rep('n', 237) + '~2643f1c8',
    ],
    [
      'fileNameOf',
      'a/' + rep('é', 125),
      '.json',
      'a%2F' + rep('é', 118) + '~c02f1e61',
    ],
    [
      'nameInFolder',
      'a/' + rep('é', 125),
      '.json',
      'a%2F' + rep('é', 118) + '~c02f1e61',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('x', 241),
      '.json',
      'com%C2%B9.' + rep('x', 231) + '~9111d893',
    ],
    [
      'encodedName',
      'com¹.' + rep('x', 241),
      '.json',
      'com%C2%B9.' + rep('x', 231) + '~9111d893',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('x', 236),
      '.json',
      'com%C2%B9.' + rep('x', 236),
    ],
    [
      'encodedName',
      'com¹.' + rep('x', 236),
      '.json',
      'com%C2%B9.' + rep('x', 236),
    ],
    [
      'fileNameOf',
      'lpt².' + rep('x', 246),
      '.json',
      'lpt%C2%B2.' + rep('x', 231) + '~456a8d8a',
    ],
    [
      'encodedName',
      'lpt².' + rep('x', 246),
      '.json',
      'lpt%C2%B2.' + rep('x', 231) + '~456a8d8a',
    ],
    [
      'fileNameOf',
      'COM³.' + rep('é', 120) + 'A',
      '.json',
      'COM%C2%B3.%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9~262ff0ae',
    ],
    [
      'encodedName',
      'COM³.' + rep('é', 120) + 'A',
      '.json',
      'COM%C2%B3.%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9~262ff0ae',
    ],
    [
      'fileNameOf',
      'COM³.' + rep('é', 120) + 'B',
      '.json',
      'COM%C2%B3.%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9~a014630d',
    ],
    [
      'encodedName',
      'COM³.' + rep('é', 120) + 'B',
      '.json',
      'COM%C2%B3.%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9~a014630d',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('é', 120) + 'A',
      '.json',
      'com%C2%B9.%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9~a65c9a4c',
    ],
    [
      'encodedName',
      'com¹.' + rep('é', 120) + 'A',
      '.json',
      'com%C2%B9.%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9%C3%A9~a65c9a4c',
    ],
    ['fileNameOf', 'Com².txt', '.json', 'Com%C2%B2.txt'],
    ['encodedName', 'Com².txt', '.json', 'Com%C2%B2.txt'],
    ['fileNameOf', 'com¹', '.json', 'com%C2%B9'],
    ['encodedName', 'com¹', '.json', 'com%C2%B9'],
    ['nameInFolder', 'com¹', '.json', 'com¹'],
    [
      'fileNameOf',
      'com¹.a/' + rep('x', 240),
      '.json',
      'com%C2%B9.a%252F' + rep('x', 225) + '~29910a65',
    ],
    [
      'encodedName',
      'com¹.a/' + rep('x', 240),
      '.json',
      'com%C2%B9.a%252F' + rep('x', 225) + '~29910a65',
    ],
    [
      'nameInFolder',
      'com¹.a/' + rep('x', 240),
      '.json',
      'com%C2%B9.a%252F' + rep('x', 225) + '~29910a65',
    ],
    [
      'nameInStem',
      'com¹.a/' + rep('x', 240),
      '.json',
      'com%C2%B9.a%252F' + rep('x', 225) + '~29910a65',
    ],
    ['fileNameOf', 'nul.' + rep('x', 240), '.json', undefined],
    ['encodedName', 'nul.' + rep('x', 240), '.json', undefined],
    ['fileNameOf', 'con', '.json', undefined],
    [
      'fileNameOf',
      'com¹.' + rep('a', 220) + rep('é', 50),
      '.json',
      'com%C2%B9.' + rep('a', 220) + '%C3%A9~81a11698',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 221) + rep('é', 50),
      '.json',
      'com%C2%B9.' + rep('a', 221) + '%C3%A9~19eb402e',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 222) + rep('é', 50),
      '.json',
      'com%C2%B9.' + rep('a', 222) + '%C3%A9~c3c963f6',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 223) + rep('é', 50),
      '.json',
      'com%C2%B9.' + rep('a', 223) + '%C3%A9~c230e49a',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 224) + rep('é', 50),
      '.json',
      'com%C2%B9.' + rep('a', 224) + '%C3%A9~7caa15c6',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 225) + rep('é', 50),
      '.json',
      'com%C2%B9.' + rep('a', 225) + '%C3%A9~8a0869b6',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 220) + rep('€', 40),
      '.json',
      'com%C2%B9.' + rep('a', 220) + '%E2%82%AC~b3eba0ba',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 221) + rep('€', 40),
      '.json',
      'com%C2%B9.' + rep('a', 221) + '%E2%82%AC~004e50dc',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 222) + rep('€', 40),
      '.json',
      'com%C2%B9.' + rep('a', 222) + '%E2%82%AC~42b7e9b5',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 223) + rep('€', 40),
      '.json',
      'com%C2%B9.' + rep('a', 223) + '~56fff3f5',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 224) + rep('€', 40),
      '.json',
      'com%C2%B9.' + rep('a', 224) + '~4994a625',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 225) + rep('€', 40),
      '.json',
      'com%C2%B9.' + rep('a', 225) + '~c7056f55',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 226) + rep('€', 40),
      '.json',
      'com%C2%B9.' + rep('a', 226) + '~04466138',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 227) + rep('€', 40),
      '.json',
      'com%C2%B9.' + rep('a', 227) + '~3e10693f',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 228) + rep('€', 40),
      '.json',
      'com%C2%B9.' + rep('a', 228) + '~47f4051f',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 220) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 220) + '~1b91b0e9',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 221) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 221) + '~fe0ec013',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 222) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 222) + '~28d5eb8c',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 223) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 223) + '~8c12034b',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 224) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 224) + '~bd9d0995',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 225) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 225) + '~7fd6594b',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 226) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 226) + '~c681fb5b',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 227) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 227) + '~87514343',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 228) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 228) + '~e30c3848',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 229) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 229) + '~eaea0e5b',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 230) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 230) + '~3ab626f1',
    ],
    [
      'fileNameOf',
      'com¹.' + rep('a', 231) + rep('😀', 30),
      '.json',
      'com%C2%B9.' + rep('a', 231) + '~cd779f2e',
    ],
    [
      'fileNameOf',
      rep('x', 233) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 233) + '~5f545a8f',
    ],
    [
      'nameInFolder',
      rep('x', 233) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 233) + '~5f545a8f',
    ],
    [
      'fileNameOf',
      rep('x', 234) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 234) + '~3b081ab1',
    ],
    [
      'nameInFolder',
      rep('x', 234) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 234) + '~3b081ab1',
    ],
    [
      'fileNameOf',
      rep('x', 235) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 235) + '~cfd43b6e',
    ],
    [
      'nameInFolder',
      rep('x', 235) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 235) + '~cfd43b6e',
    ],
    [
      'fileNameOf',
      rep('x', 236) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 236) + '~d406931a',
    ],
    [
      'nameInFolder',
      rep('x', 236) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 236) + '~d406931a',
    ],
    [
      'fileNameOf',
      rep('x', 237) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 237) + '~b1e1b769',
    ],
    [
      'nameInFolder',
      rep('x', 237) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 237) + '~b1e1b769',
    ],
    [
      'fileNameOf',
      rep('x', 238) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 238) + '~b1b15cd4',
    ],
    [
      'nameInFolder',
      rep('x', 238) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 238) + '~b1b15cd4',
    ],
    [
      'fileNameOf',
      rep('x', 239) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 239) + '~1931c9fc',
    ],
    [
      'nameInFolder',
      rep('x', 239) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 239) + '~1931c9fc',
    ],
    [
      'fileNameOf',
      rep('x', 240) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 240) + '~a78a0330',
    ],
    [
      'nameInFolder',
      rep('x', 240) + '%E2%82%AC' + rep('b', 20),
      '.json',
      rep('x', 240) + '~a78a0330',
    ],
    [
      'fileNameOf',
      rep('x', 229) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 229) + '%F0%9F%98%80~f5f0fcf4',
    ],
    [
      'nameInFolder',
      rep('x', 229) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 229) + '%F0%9F%98%80~f5f0fcf4',
    ],
    [
      'fileNameOf',
      rep('x', 230) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 230) + '~3e14915b',
    ],
    [
      'nameInFolder',
      rep('x', 230) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 230) + '~3e14915b',
    ],
    [
      'fileNameOf',
      rep('x', 231) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 231) + '~d58ae8e7',
    ],
    [
      'nameInFolder',
      rep('x', 231) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 231) + '~d58ae8e7',
    ],
    [
      'fileNameOf',
      rep('x', 232) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 232) + '~d5594cbf',
    ],
    [
      'nameInFolder',
      rep('x', 232) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 232) + '~d5594cbf',
    ],
    [
      'fileNameOf',
      rep('x', 233) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 233) + '~670f726e',
    ],
    [
      'nameInFolder',
      rep('x', 233) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 233) + '~670f726e',
    ],
    [
      'fileNameOf',
      rep('x', 234) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 234) + '~f34847e2',
    ],
    [
      'nameInFolder',
      rep('x', 234) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 234) + '~f34847e2',
    ],
    [
      'fileNameOf',
      rep('x', 235) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 235) + '~7c0fad90',
    ],
    [
      'nameInFolder',
      rep('x', 235) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 235) + '~7c0fad90',
    ],
    [
      'fileNameOf',
      rep('x', 236) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 236) + '~44322be0',
    ],
    [
      'nameInFolder',
      rep('x', 236) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 236) + '~44322be0',
    ],
    [
      'fileNameOf',
      rep('x', 237) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 237) + '~b09d47b1',
    ],
    [
      'nameInFolder',
      rep('x', 237) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 237) + '~b09d47b1',
    ],
    [
      'fileNameOf',
      rep('x', 238) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 238) + '~72ebf47b',
    ],
    [
      'nameInFolder',
      rep('x', 238) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 238) + '~72ebf47b',
    ],
    [
      'fileNameOf',
      rep('x', 239) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 239) + '~9a5eb670',
    ],
    [
      'nameInFolder',
      rep('x', 239) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 239) + '~9a5eb670',
    ],
    [
      'fileNameOf',
      rep('x', 240) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 240) + '~31f9b82e',
    ],
    [
      'nameInFolder',
      rep('x', 240) + '%F0%9F%98%80' + rep('b', 20),
      '.json',
      rep('x', 240) + '~31f9b82e',
    ],
    [
      'fileNameOf',
      rep('x', 239) + '%a' + rep('y', 300),
      '.json',
      rep('x', 239) + '~2ecd2aa7',
    ],
    [
      'encodedName',
      rep('x', 239) + '%a' + rep('y', 300),
      '.json',
      rep('x', 239) + '~2ecd2aa7',
    ],
    [
      'nameInFolder',
      rep('x', 239) + '%a' + rep('y', 300),
      '.json',
      rep('x', 239) + '~2ecd2aa7',
    ],
    [
      'fileNameOf',
      rep('x', 238) + '%e2%82' + rep('y', 300),
      '.json',
      rep('x', 238) + '~a9ffa6b7',
    ],
    [
      'nameInFolder',
      rep('x', 238) + '%e2%82' + rep('y', 300),
      '.json',
      rep('x', 238) + '~a9ffa6b7',
    ],
    ['fileNameOf', 'con.\ud800', '.json', undefined],
    ['encodedName', 'con.\ud800', '.json', undefined],
    ['nameInFolder', 'con.\ud800', '.json', 'con.\ufffd~27d6eb4b'],
    ['fileNameOf', 'nul.x\udc00', '.json', undefined],
    ['encodedName', 'nul.x\udc00', '.json', undefined],
    ['nameInFolder', 'nul.x\udc00', '.json', 'nul.x\ufffd~97ca4acc'],
    ['fileNameOf', 'aux.' + rep('x', 300) + '\ud800', '.json', undefined],
    ['encodedName', 'aux.' + rep('x', 300) + '\ud800', '.json', undefined],
    [
      'nameInFolder',
      'aux.' + rep('x', 300) + '\ud800',
      '.json',
      'aux.' + rep('x', 237) + '~7701b8ae',
    ],
    ['fileNameOf', 'com¹.\ud800', '.json', 'com%C2%B9.%EF%BF%BD~5c5125c6'],
    ['encodedName', 'com¹.\ud800', '.json', 'com%C2%B9.%EF%BF%BD~5c5125c6'],
    ['nameInFolder', 'com¹.\ud800', '.json', 'com¹.\ufffd~5c5125c6'],
    ['fileNameOf', 'a\u007fb', '.json', 'a\ufffdb~c459de40'],
    ['encodedName', 'a\u007fb', '.json', 'a\ufffdb~c459de40'],
    ['nameInFolder', 'a\u007fb', '.json', 'a\ufffdb~c459de40'],
    ['nameInStem', 'a\u007fb', '.json', 'a\ufffdb~c459de40'],
    ['fileNameOf', '\u007f', '.json', '\ufffd~9f3a060c'],
    ['encodedName', '\u007f', '.json', '\ufffd~9f3a060c'],
    ['nameInFolder', '\u007f', '.json', '\ufffd~9f3a060c'],
    [
      'fileNameOf',
      '\u007f' + rep('x', 300),
      '.json',
      '\ufffd' + rep('x', 238) + '~e9539ca3',
    ],
    [
      'encodedName',
      '\u007f' + rep('x', 300),
      '.json',
      '\ufffd' + rep('x', 238) + '~e9539ca3',
    ],
    [
      'nameInFolder',
      '\u007f' + rep('x', 300),
      '.json',
      '\ufffd' + rep('x', 238) + '~e9539ca3',
    ],
    [
      'nameInStem',
      '\u007f' + rep('x', 300),
      '.json',
      '\ufffd' + rep('x', 238) + '~e9539ca3',
    ],
    [
      'fileNameOf',
      rep('x', 250) + '\u007f',
      '.json',
      rep('x', 241) + '~3221f382',
    ],
    [
      'encodedName',
      rep('x', 250) + '\u007f',
      '.json',
      rep('x', 241) + '~3221f382',
    ],
    [
      'nameInFolder',
      rep('x', 250) + '\u007f',
      '.json',
      rep('x', 241) + '~3221f382',
    ],
    ['fileNameOf', 'a/\u007f', '.json', 'a%2F\ufffd~54fbb0a6'],
    ['encodedName', 'a/\u007f', '.json', 'a%2F\ufffd~54fbb0a6'],
    ['nameInFolder', 'a/\u007f', '.json', 'a%2F\ufffd~54fbb0a6'],
    [
      'fileNameOf',
      '\u007f\u007f\u007f',
      '.json',
      '\ufffd\ufffd\ufffd~3bfe2982',
    ],
    [
      'nameInFolder',
      '\u007f\u007f\u007f',
      '.json',
      '\ufffd\ufffd\ufffd~3bfe2982',
    ],
    ['fileNameOf', rep('x', 250) + '*', '.json', rep('x', 250)],
    ['encodedName', rep('x', 250) + '*', '.json', rep('x', 250)],
    ['nameInFolder', rep('x', 250) + '*', '.json', rep('x', 241) + '~a6378e32'],
    ['fileNameOf', rep('x', 250) + '.', '.json', rep('x', 250)],
    ['encodedName', rep('x', 250) + '.', '.json', rep('x', 250)],
    ['nameInFolder', rep('x', 250) + '.', '.json', rep('x', 241) + '~e79fc591'],
    ['fileNameOf', rep('x', 247) + ' .', '.json', rep('x', 247) + '%20'],
    ['encodedName', rep('x', 247) + ' .', '.json', rep('x', 247) + '%20'],
    ['nameInFolder', rep('x', 247) + ' .', '.json', rep('x', 247) + ' .'],
    ['fileNameOf', 'aaa' + rep('*', 248) + 'Z', '.json', 'aaaZ'],
    ['encodedName', 'aaa' + rep('*', 248) + 'Z', '.json', 'aaaZ'],
    [
      'nameInFolder',
      'aaa' + rep('*', 248) + 'Z',
      '.json',
      'aaa' + rep('*', 238) + '~0c181db2',
    ],
    ['fileNameOf', rep('x', 200) + rep('*', 55), '.json', rep('x', 200)],
    ['encodedName', rep('x', 200) + rep('*', 55), '.json', rep('x', 200)],
    [
      'nameInFolder',
      rep('x', 200) + rep('*', 55),
      '.json',
      rep('x', 200) + rep('*', 41) + '~b81f6726',
    ],
    [
      'fileNameOf',
      rep('x', 200) + rep('*', 56),
      '.json',
      rep('x', 200) + '~2f5d1312',
    ],
    [
      'encodedName',
      rep('x', 200) + rep('*', 56),
      '.json',
      rep('x', 200) + '~2f5d1312',
    ],
    [
      'nameInFolder',
      rep('x', 200) + rep('*', 56),
      '.json',
      rep('x', 200) + rep('*', 41) + '~2f5d1312',
    ],
    ['fileNameOf', rep('x', 243) + rep('*', 12), '.onCreate.js', rep('x', 243)],
    [
      'encodedName',
      rep('x', 243) + rep('*', 12),
      '.onCreate.js',
      rep('x', 243),
    ],
    [
      'nameInFolder',
      rep('x', 243) + rep('*', 12),
      '.onCreate.js',
      rep('x', 234) + '~387853ca',
    ],
    [
      'fileNameOf',
      rep('x', 243) + rep('*', 13),
      '.onCreate.js',
      rep('x', 234) + '~bbb024dd',
    ],
    [
      'encodedName',
      rep('x', 243) + rep('*', 13),
      '.onCreate.js',
      rep('x', 234) + '~bbb024dd',
    ],
    [
      'nameInFolder',
      rep('x', 243) + rep('*', 13),
      '.onCreate.js',
      rep('x', 234) + '~bbb024dd',
    ],
    ['fileNameOf', 'a/' + rep('n', 246) + '*', '.json', 'a%2F' + rep('n', 246)],
    [
      'encodedName',
      'a/' + rep('n', 246) + '*',
      '.json',
      'a%2F' + rep('n', 246),
    ],
    [
      'nameInFolder',
      'a/' + rep('n', 246) + '*',
      '.json',
      'a%2F' + rep('n', 246),
    ],
    [
      'fileNameOf',
      rep('*', 100) + rep('a', 300),
      '.json',
      rep('a', 155) + '~0099e8fb',
    ],
    [
      'encodedName',
      rep('*', 100) + rep('a', 300),
      '.json',
      rep('a', 155) + '~0099e8fb',
    ],
    [
      'nameInFolder',
      rep('*', 100) + rep('a', 300),
      '.json',
      rep('*', 100) + rep('a', 141) + '~0099e8fb',
    ],
    [
      'fileNameOf',
      'éééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééé',
      '.json',
      'éééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééée~b6a90f48',
    ],
    [
      'encodedName',
      'éééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééé',
      '.json',
      'éééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééée~b6a90f48',
    ],
    [
      'nameInFolder',
      'éééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééé',
      '.json',
      'éééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééééée~b6a90f48',
    ],
    ['fileNameOf', 'éééééééééééééééééééé', '.json', 'éééééééééééééééééééé'],
    ['encodedName', 'éééééééééééééééééééé', '.json', 'éééééééééééééééééééé'],
    ['nameInFolder', 'éééééééééééééééééééé', '.json', 'éééééééééééééééééééé'],
    ['fileNameOf', rep('a', 252), '.é', rep('a', 252)],
    ['encodedName', rep('a', 252), '.é', rep('a', 252)],
    ['nameInFolder', rep('a', 252), '.é', rep('a', 252)],
    ['fileNameOf', rep('a', 253), '.é', rep('a', 243) + '~c33c0a4d'],
    ['encodedName', rep('a', 253), '.é', rep('a', 243) + '~c33c0a4d'],
    ['nameInFolder', rep('a', 253), '.é', rep('a', 243) + '~c33c0a4d'],
    ['fileNameOf', rep('a', 247), '.é.html', rep('a', 247)],
    ['encodedName', rep('a', 247), '.é.html', rep('a', 247)],
    ['nameInFolder', rep('a', 247), '.é.html', rep('a', 247)],
    ['fileNameOf', rep('a', 248), '.é.html', rep('a', 238) + '~f195ec43'],
    ['encodedName', rep('a', 248), '.é.html', rep('a', 238) + '~f195ec43'],
    ['nameInFolder', rep('a', 248), '.é.html', rep('a', 238) + '~f195ec43'],
    ['fileNameOf', rep('a', 250), '.€', rep('a', 250)],
    ['nameInFolder', rep('a', 250), '.€', rep('a', 250)],
    ['fileNameOf', rep('a', 251), '.€', rep('a', 251)],
    ['nameInFolder', rep('a', 251), '.€', rep('a', 251)],
    [
      'fileNameOf',
      rep('a', 241) + '~e8722168',
      '.json',
      rep('a', 241) + '~e8722168',
    ],
    [
      'encodedName',
      rep('a', 241) + '~e8722168',
      '.json',
      rep('a', 241) + '~e8722168',
    ],
    [
      'nameInFolder',
      rep('a', 241) + '~e8722168',
      '.json',
      rep('a', 241) + '~e8722168',
    ],
  ];

  /** An id, short enough to read in the name of a test. */
  const shown = (id: string): string =>
    id.length > 24
      ? `${JSON.stringify(id.slice(0, 12))}...(${id.length} characters)`
      : JSON.stringify(id);

  it.each(
    GOLDEN.map(([fn, id, suffix, name]) => [
      `${fn}(${shown(id)}, ${JSON.stringify(suffix)})`,
      fn,
      id,
      suffix,
      name,
    ])
  )(
    '%s is as the independent implementation says',
    (_label, fn, id, suffix, expected) => {
      const make = FUNCTIONS[fn as string];

      if (expected === undefined) {
        // a value that leaves no name: the agent types get an empty file name, every other function refuses it
        if (fn === 'fileNameOf')
          expect(make(id as string, suffix as string)).toBe('');
        else {
          expect(() => make(id as string, suffix as string)).toThrow(
            'does not name an object'
          );
        }
        return;
      }
      expect(make(id as string, suffix as string)).toBe(expected);
    }
  );

  it('every row of the table is a name that fits with its suffix, is well-formed and passes the gate', () => {
    let named = 0;
    for (const [, id, suffix, name] of GOLDEN) {
      if (name === undefined) continue;
      named++;
      expect(
        Buffer.byteLength(name) + Buffer.byteLength(suffix)
      ).toBeLessThanOrEqual(255);
      expect(name.isWellFormed()).toBe(true);
      expect(() => assertFileSetPath(`d/${name}${suffix}`)).not.toThrow();
      expect(id.length).toBeGreaterThan(0);
    }
    expect(named).toBeGreaterThan(110);
  });

  it('the table has the traps in it: a lone surrogate, a colon, a cut inside an escape, `*` and a name of 250 bytes', () => {
    const ids = GOLDEN.map(([, id]) => id);

    expect(ids).toContain('x\ud800');
    expect(ids).toContain(`${rep('x', 254)}\ud800`);
    expect(ids).toContain(`a:${rep('n', 247)}`);
    expect(ids).toContain(`aaaa${rep('\u0085', 100)}`);
    expect(ids).toContain(rep('/', 86));
    expect(ids).toContain(`${rep('x', 200)}${rep('*', 100)}`);
    expect(ids).toContain(rep('a', 250));
    // a device name with a superscript digit, which the sanitizer writes out whole as %XX
    expect(ids).toContain(`com\u00b9.${rep('x', 241)}`);
    // a lone surrogate after a device name and a dot, and U+007F
    expect(ids).toContain('con.\ud800');
    expect(ids).toContain('a\u007fb');
    // an id at the boundary that main gave a valid name: a `*` and a trailing dot or space
    expect(ids).toContain(`${rep('x', 250)}*`);
    expect(ids).toContain(`${rep('x', 247)} .`);
    // the clash that is certain: an id shaped like a shortened name
    expect(ids).toContain(`${rep('a', 241)}~e8722168`);
  });

  it('an id of the shape of a shortened name has that name, so the id it was made from clashes with it: the engine reports the later one', () => {
    const shaped = `${rep('a', 241)}~e8722168`;

    // the id fits (250 bytes), so it keeps its name, and the name of `a` repeated 300 times is the same string
    expect(fileNameOf(shaped)).toBe(shaped);
    expect(fileNameOf(rep('a', 300))).toBe(shaped);
    expect(nameInFolder(shaped)).toBe(nameInFolder(rep('a', 300)));
  });

  it('two ids that share a cut and the 8 characters of a checksum (about one pair in four billion that shares a cut) get one name: the engine reports the second', () => {
    const first = `${rep('a', 300)}7449`;
    const second = `${rep('a', 300)}22501`;

    expect(first).not.toBe(second);
    expect(fileNameOf(first)).toBe(fileNameOf(second));
    expect(fileNameOf(first)).toBe(`${rep('a', 241)}~5b2c45dc`);
  });

  describe('the three traps', () => {
    it('the whole encoded name is measured: a long run of slashes is not one name (a sanitizer cut at 255 bytes made them one)', () => {
      const names = new Set<string>();
      for (let count = 80; count <= 120; count++) {
        for (const suffix of ['', '.json']) {
          const id = rep('/', count);
          const name = nameInFolder(id, suffix);

          expect(
            Buffer.byteLength(name) + Buffer.byteLength(suffix)
          ).toBeLessThanOrEqual(255);
          if (suffix === '') names.add(name);
        }
      }
      // 41 different ids, 41 different names with no suffix
      expect(names.size).toBe(41);
      expect(fileNameOf(rep('/', 86), '')).toBe(`${rep('%2F', 82)}~c4d15c2e`);
      expect(fileNameOf(rep('/', 85), '')).toBe(rep('%2F', 85));
    });

    it('a lone surrogate is found in the id, not in the sanitized name (the sanitizer drops it at its own cut)', () => {
      const id = `${rep('x', 254)}\ud800`;

      expect(id.isWellFormed()).toBe(false);
      // the sanitizer drops the surrogate: the name that it makes looks like text
      expect(safeFileName(id).isWellFormed()).toBe(true);
      expect(safeFileName(id)).toBe(rep('x', 254));
      // and the id still gets a checksum of its own, which is not the checksum of the id without it
      expect(fileNameOf(id)).toBe(`${rep('x', 241)}~426b50d5`);
      expect(fileNameOf(id)).not.toBe(fileNameOf(rep('x', 254)));
      expect(fileNameOf(`${rep('x', 254)}\ud801`)).not.toBe(fileNameOf(id));
    });

    it('the colon that nameInStem writes as %3A counts before the name fits, not after', () => {
      const fits = `a:${rep('n', 246)}`;
      const longer = `a:${rep('n', 247)}`;

      expect(nameInStem(fits)).toBe(`a%3A${rep('n', 246)}`);
      expect(Buffer.byteLength(nameInStem(fits)) + 5).toBe(255);
      expect(nameInStem(longer)).toBe(`a%3A${rep('n', 237)}~a43dbedc`);
      // the file that a type makes of the stem is a path that the gate lets through
      expect(() =>
        assertFileSetPath(`d/${nameInStem(longer)}.json`)
      ).not.toThrow();
      expect(() =>
        assertFileSetPath(`d/${nameInStem(fits)}.json`)
      ).not.toThrow();
    });

    it('one name for one object: the name is made once with the longest suffix, and is the same name for every shorter one', () => {
      const id = rep('a', 300);
      const longest = '.onCreate.js';
      const name = fileNameOf(id, longest);

      expect(name).toBe(`${rep('a', 234)}~e8722168`);
      for (const suffix of ['', '.js', '.json', longest]) {
        expect(fileNameOf(name, suffix)).toBe(name);
        expect(encodedName(name, suffix)).toBe(name);
        expect(nameInFolder(name, suffix)).toBe(name);
        expect(nameInStem(name, suffix)).toBe(name);
        expect(objectFilePath('d', name, suffix)).toBe(`d/${name}.json`);
      }
      // a name that is made with the short suffix and then asked for with the long one is shortened again: its checksum
      // is the checksum of the shortened name, not of the id (which is why a type makes the name once)
      expect(fileNameOf(fileNameOf(id), longest)).not.toBe(name);
    });
  });

  describe('the cases of the first review', () => {
    it('a device name with a superscript digit and a dot: the sanitizer writes the whole id out as %XX, and the name is measured as it made it', () => {
      const cases: [string, ((id: string) => string)[]][] = [
        [`com\u00b9.${rep('x', 241)}`, [fileNameOf, encodedName]],
        [`lpt\u00b2.${rep('x', 246)}`, [fileNameOf, encodedName]],
        [`COM\u00b3.${rep('é', 120)}A`, [fileNameOf, encodedName]],
        // an id that is not one safe name goes through the sanitizer in every function
        [
          `Com\u00b9.a/${rep('x', 240)}`,
          [fileNameOf, encodedName, nameInFolder, nameInStem],
        ],
      ];
      for (const [id, makes] of cases) {
        for (const make of makes) {
          const name = make(id);

          // the name is a name that fits: the file is a path that the gate lets through, and asking again changes nothing
          expect(Buffer.byteLength(name)).toBeLessThanOrEqual(250);
          expect(() => assertFileSetPath(`d/${name}.json`)).not.toThrow();
          expect(make(name)).toBe(name);
          expect(name).toMatch(/~[0-9a-f]{8}$/);
        }
      }
      // two different long ids have two names, where the sanitizer cut both at 255 bytes to one
      expect(fileNameOf(`com\u00b9.${rep('é', 120)}A`)).not.toBe(
        fileNameOf(`com\u00b9.${rep('é', 120)}B`)
      );
      // an id that is short enough is the name that the sanitizer made, written out whole
      expect(fileNameOf('com\u00b9.é')).toBe('com%C2%B9.%C3%A9');
      expect(fileNameOf('LPT\u00b2')).toBe('LPT%C2%B2');
      // a device name without a superscript is emptied, whatever its length
      expect(fileNameOf(`com1.${rep('x', 300)}`)).toBe('');
    });

    it('a cut never ends inside an escaped character of the name that the sanitizer wrote out for a device name', () => {
      const bad: string[] = [];
      for (const character of ['é', '€', '😀']) {
        for (let padding = 215; padding <= 245; padding++) {
          const id = `com¹.${rep('a', padding)}${rep(character, 40)}`;
          const name = fileNameOf(id);
          const cut = name.slice(0, -9);

          try {
            decodeURIComponent(cut);
          } catch {
            bad.push(`${character} ${padding}: ${cut.slice(-14)}`);
          }
        }
      }

      expect(bad).toEqual([]);
    });

    it('a lone surrogate after a device name and a dot is no error: the name is clean with a checksum, or none where the device name is emptied', () => {
      // a device name is emptied whatever follows the dot, so it has no name; as typed, in a folder, it is a name like another
      for (const id of [
        'con.\ud800',
        'nul.x\udc00',
        `aux.${rep('x', 300)}\ud800`,
      ]) {
        expect(fileNameOf(id)).toBe('');
        expect(() => encodedName(id)).toThrow('does not name an object');
        expect(nameInFolder(id)).toMatch(/~[0-9a-f]{8}$/);
        expect(nameInFolder(id).slice(-8)).toBe(checksumOf(id));
      }
      // with a superscript digit it is not a device name for the sanitizer, which writes the whole id out
      for (const id of [
        'com\u00b9.\ud800',
        `COM\u00b2.${rep('é', 130)}\udc00`,
      ]) {
        for (const make of [
          fileNameOf,
          encodedName,
          nameInFolder,
          nameInStem,
        ]) {
          const name = make(id);

          expect(name).toMatch(/~[0-9a-f]{8}$/);
          expect(name.isWellFormed()).toBe(true);
          expect(name.slice(-8)).toBe(checksumOf(id));
          expect(() => assertFileSetPath(`d/${name}.json`)).not.toThrow();
        }
      }
    });

    it('U+007F is not text for a file name: it is written as U+FFFD, and the id gets the checksum of its own', () => {
      for (const make of [fileNameOf, encodedName, nameInFolder, nameInStem]) {
        const name = make('a\u007fb');

        expect(name).toBe(`a�b~${checksumOf('a\u007fb')}`);
        expect(() => assertFileSetPath(`d/${name}.json`)).not.toThrow();
        // two ids that differ only in that character, and a lone surrogate, have three names
        expect(new Set([name, make('a�b'), make('a\ud800b')]).size).toBe(3);
        expect(make(`\u007f${rep('x', 300)}`)).toMatch(/^�x+~[0-9a-f]{8}$/);
      }
    });

    it('an id keeps the name that main gave it when that was a valid file name with its suffix: a `*`, a trailing dot or a trailing space at the boundary', () => {
      // these were 251 to 255 bytes only before the sanitizer took a `*` or a trailing run out: main's name is a valid file
      expect(fileNameOf(`${rep('x', 250)}*`)).toBe(rep('x', 250));
      expect(fileNameOf(`${rep('x', 250)}.`)).toBe(rep('x', 250));
      expect(fileNameOf(`aaa${rep('*', 248)}Z`)).toBe('aaaZ');
      expect(fileNameOf(`${rep('x', 247)} .`)).toBe(`${rep('x', 247)}%20`);
      // a name that the sanitizer cut, or that is too long with its suffix, is not: the id is shortened
      expect(fileNameOf(`${rep('x', 200)}${rep('*', 56)}`)).toMatch(
        /~[0-9a-f]{8}$/
      );
      expect(fileNameOf(`${rep('x', 249)} `)).toBe(`${rep('x', 241)}~f7444881`);
      expect(fileNameOf(`${rep('x', 251)}.`)).toMatch(/~[0-9a-f]{8}$/);
    });

    it('a suffix that holds a character of more than one byte is counted in bytes', () => {
      expect(fileNameOf(rep('a', 252), '.é')).toBe(rep('a', 252));
      expect(fileNameOf(rep('a', 253), '.é')).toBe(
        `${rep('a', 243)}~${checksumOf(rep('a', 253))}`
      );
      expect(fileNameOf(rep('a', 247), '.é.html')).toBe(rep('a', 247));
      expect(fileNameOf(rep('a', 248), '.é.html')).toBe(
        `${rep('a', 238)}~${checksumOf(rep('a', 248))}`
      );
    });

    it('a name that was cut as NFD and as NFC has the checksum of the id as it was given', () => {
      const nfc = rep('é', 130);
      const nfd = nfc.normalize('NFD');

      expect(nfd).not.toBe(nfc);
      expect(fileNameOf(nfd).slice(-8)).toBe(checksumOf(nfd));
      expect(fileNameOf(nfd).slice(-8)).not.toBe(fileNameOf(nfc).slice(-8));
    });
  });

  describe('a name of N bytes and a suffix of S bytes', () => {
    // the last two hold a character of two and of three bytes: a suffix is counted in bytes
    const SUFFIXES = [
      '',
      '.json',
      '.onCreate.js',
      `.${rep('l', 39)}`,
      '.é.html',
      '.€',
    ];
    const CHARACTERS: [string, number][] = [
      ['a', 1],
      ['é', 2],
      ['€', 3],
      ['😀', 4],
      ['%41', 3],
    ];

    it.each(
      SUFFIXES.flatMap((suffix) =>
        CHARACTERS.map(([character, bytes]) => [
          JSON.stringify(suffix),
          character,
          bytes,
          suffix,
        ])
      )
    )(
      'with the suffix %s a name made of %s (%d bytes each) is kept up to 255 bytes in all and is shortened one character beyond',
      (_label, character, bytes, suffix) => {
        const room = 255 - Buffer.byteLength(suffix as string);
        const most = Math.floor(room / (bytes as number));
        const kept = rep(character as string, most);
        const beyond = rep(character as string, most + 1);

        for (const make of [nameInFolder, fileNameOf, encodedName]) {
          expect(make(kept, suffix as string)).toBe(kept);
          const shortened = make(beyond, suffix as string);

          expect(shortened).toMatch(/~[0-9a-f]{8}$/);
          expect(
            Buffer.byteLength(shortened) + Buffer.byteLength(suffix as string)
          ).toBeLessThanOrEqual(255);
          // the cut is at a whole character: what is left is a whole number of them
          expect(shortened.slice(0, -9)).toBe(
            rep(
              character as string,
              shortened.slice(0, -9).length / (character as string).length
            )
          );
        }
      }
    );

    it('a character of a path is three bytes once it is written as %XX, and a `*` is counted before the sanitizer takes it out', () => {
      const ESCAPED: [string, string][] = [
        ['/', '%2F'],
        ['\\', '%5C'],
        ['?', '%3F'],
        ['<', '%3C'],
        ['>', '%3E'],
        [':', '%3A'],
        ['|', '%7C'],
        ['"', '%22'],
      ];
      for (const suffix of SUFFIXES) {
        const room = 255 - Buffer.byteLength(suffix);
        const most = Math.floor(room / 3);
        for (const [character, escape] of ESCAPED) {
          expect(fileNameOf(rep(character, most), suffix)).toBe(
            rep(escape, most)
          );
          expect(encodedName(rep(character, most + 1), suffix)).toMatch(
            /~[0-9a-f]{8}$/
          );
        }
        // the sanitizer takes `*` out after it has cut at 255 bytes: `x` and 254 stars are 255 bytes, nothing is cut and the
        // name that is left (`x`) is the name that main gave; one star more and the sanitizer cuts, so the id is shortened
        expect(fileNameOf(`x${rep('*', 254)}`, suffix)).toBe('x');
        expect(fileNameOf(`x${rep('*', 255)}`, suffix)).toBe(
          `x~${checksumOf(`x${rep('*', 255)}`)}`
        );
      }
    });

    it('a suffix that leaves no room for a shortened name is refused, whatever the id', () => {
      const tooLong = `.${rep('s', 246)}`;

      for (const make of [fileNameOf, encodedName, nameInFolder, nameInStem]) {
        expect(() => make('a', tooLong)).toThrow('leaves no room for a name');
      }
      expect(() => objectFilePath('d', 'a', tooLong)).toThrow(
        'leaves no room for a name'
      );
      expect(() => objectFolderPath('d', 'a', tooLong)).toThrow(
        'leaves no room for a name'
      );
      // 246 bytes of suffix leave room for the checksum and nothing else
      const edge = `.${rep('s', 245)}`;

      expect(fileNameOf(rep('a', 300), edge)).toBe(`~e8722168`);
    });
  });
});

/** The first 8 hexadecimal characters of the SHA-256 of an id as UTF-16 code units: the checksum of a shortened name. */
const checksumOf = (id: string): string =>
  createHash('sha256').update(id, 'utf16le').digest('hex').slice(0, 8);

describe('the names that every function makes, over a battery of ids', () => {
  const CHARACTERS = [
    'a',
    'é',
    '€',
    '😀',
    '/',
    '?',
    '*',
    '%',
    '\u0085',
    '\n',
    ' ',
    // the other characters of a path, which the sanitizer writes out as %XX
    '\\',
    ':',
    '<',
    '>',
    '|',
    '"',
    // not text: a lone high and a lone low surrogate, and U+007F
    '\ud800',
    '\udc00',
    '\u007f',
  ];
  const LENGTHS = [
    1, 5, 62, 84, 85, 86, 125, 126, 127, 128, 250, 251, 256, 300,
  ];
  const SUFFIXES = ['', '.json', '.js', '.onCreate.js', `.${rep('l', 39)}`];
  const FUNCTIONS = { fileNameOf, encodedName, nameInFolder, nameInStem };
  const IDS = CHARACTERS.flatMap((character) =>
    LENGTHS.flatMap((length) => [
      rep(character, length),
      `a:${rep(character, length)}`,
      `x${rep(character, length)}`,
      // a device name and a dot, which the sanitizer empties, and with a superscript digit, which it writes out whole
      `con.${rep(character, length)}`,
      `com\u00b9.${rep(character, length)}`,
    ])
  );

  /** What a function makes of an id, or `undefined` for an id that leaves no name. */
  const nameOf = (
    make: (id: string, suffix?: string) => string,
    id: string,
    suffix: string
  ): string | undefined => {
    try {
      const name = make(id, suffix);
      return name === '' ? undefined : name;
    } catch (error) {
      expect(error.message).toContain('does not name an object');
      return undefined;
    }
  };

  it('every name fits with its suffix, is text, passes the gate, and is the same name when it is asked for again with the same or a shorter suffix', () => {
    const bad: string[] = [];
    let named = 0;
    for (const [fn, make] of Object.entries(FUNCTIONS)) {
      for (const suffix of SUFFIXES) {
        for (const id of IDS) {
          const name = nameOf(make, id, suffix);
          if (name === undefined) continue;
          named++;
          try {
            if (!name.isWellFormed()) throw new Error('not text');
            if (Buffer.byteLength(name) + Buffer.byteLength(suffix) > 255) {
              throw new Error('too long');
            }
            assertFileSetPath(`d/${name}${suffix}`);
            for (const shorter of SUFFIXES) {
              if (Buffer.byteLength(shorter) > Buffer.byteLength(suffix)) {
                continue;
              }
              if (make(name, shorter) !== name) throw new Error('not stable');
            }
          } catch (error) {
            bad.push(
              `${fn} ${JSON.stringify(suffix)} ${JSON.stringify(id.slice(0, 20))}(${id.length}): ${error.message}`
            );
          }
        }
      }
    }

    expect(bad.slice(0, 5)).toEqual([]);
    // 20 characters, 14 lengths, 5 shapes, 5 suffixes, 4 functions: 28,000 names, a few of which leave no name
    expect(named).toBeGreaterThan(20000);
  });

  it('a cut never ends inside an escape: what the name function wrote of the id decodes, whole escaped characters only', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const [fn, make] of Object.entries(FUNCTIONS)) {
      for (const suffix of SUFFIXES) {
        for (const id of IDS) {
          // a `%` that the id holds itself is its own character: only the escapes that the name function wrote are looked at
          if (id.includes('%')) continue;
          const name = nameOf(make, id, suffix);
          if (name === undefined || !/~[0-9a-f]{8}$/.test(name)) continue;
          checked++;
          try {
            // a `%` that is not a whole escape, or an escaped character that lacks a byte, is a URIError
            decodeURIComponent(name.slice(0, -9));
          } catch {
            bad.push(
              `${fn} ${JSON.stringify(suffix)} ${JSON.stringify(id.slice(0, 12))}(${id.length}): ${name.slice(-24, -9)}`
            );
          }
        }
      }
    }

    expect(bad.slice(0, 5)).toEqual([]);
    expect(checked).toBeGreaterThan(5000);
  });

  it('two ids that do not fit never share a name', () => {
    const shared: string[] = [];
    let shortened = 0;
    for (const [fn, make] of Object.entries(FUNCTIONS)) {
      for (const suffix of SUFFIXES) {
        const seen = new Map<string, string>();
        for (const id of IDS) {
          const name = nameOf(make, id, suffix);
          // no id of the battery holds a `~`, so a name with a checksum is the name of an id that did not fit
          if (name === undefined || !/~[0-9a-f]{8}$/.test(name)) continue;
          shortened++;
          const first = seen.get(name);
          if (first !== undefined && first !== id) {
            shared.push(
              `${fn} ${JSON.stringify(suffix)}: ${JSON.stringify(first.slice(0, 20))} and ${JSON.stringify(id.slice(0, 20))}`
            );
          }
          seen.set(name, id);
        }
      }
    }

    expect(shared.slice(0, 5)).toEqual([]);
    expect(shortened).toBeGreaterThan(9000);
  });

  it('ids that share a cut get their own checksums', () => {
    const names = new Set<string>();
    for (let index = 0; index < 3000; index++) {
      names.add(fileNameOf(`${rep('a', 300)}${index}`));
    }
    const cuts = new Set([...names].map((name) => name.slice(0, -9)));

    expect(names.size).toBe(3000);
    expect([...cuts]).toEqual([rep('a', 241)]);
  });

  it('the checksum is of the complete id, and the same id has the same name whatever the suffix', () => {
    for (const id of [rep('a', 300), `${rep('é', 150)}`, rep('/', 100)]) {
      for (const make of [fileNameOf, encodedName, nameInFolder]) {
        for (const suffix of SUFFIXES) {
          expect(make(id, suffix).slice(-8)).toBe(checksumOf(id));
        }
      }
    }
    // a lone surrogate keeps its own code unit: two ids that differ only there differ
    expect(checksumOf('\ud800')).not.toBe(checksumOf('\ud801'));
    expect(checksumOf('x\ud800')).not.toBe(checksumOf('x�'));
    expect(fileNameOf('x\ud800')).not.toBe(fileNameOf('x\ud801'));
    expect(fileNameOf('x\ud800')).not.toBe(fileNameOf('x�'));
  });
});

/**
 * An id keeps the name that main gave it exactly when that name was a valid file name with its suffix, as a differential
 * test: a frozen copy of the functions as they were before the checksum (5.0.0-56) is run next to the functions as they are
 * over a generated corpus, and the set of ids whose name differs from the old one is exactly the set of ids that did not fit:
 * those whose old name the sanitizer or the function cut silently, those that were not text, and those whose old name was
 * too long with the suffix for the gate. What "the sanitizer cut it" means is decided by a port of the source of
 * sanitize-filename that is written in this file, not by the functions under test, and the port is shown to give the name
 * that the package gives.
 *
 * The corpus is a deterministic sample (about 150,000 comparisons, a few seconds). `FILE_NAME_FULL_CORPUS=1 npm run
 * test:only -- src/utils/FileSetPathUtils` runs all of it (about 400,000 strings of the gate corpus and 110,000 long ids,
 * 2,300,000 comparisons, about 3 minutes).
 */
describe('an id keeps the name that it had exactly when that was a valid file name', () => {
  const FULL = process.env.FILE_NAME_FULL_CORPUS === '1';

  // ---- a port of the function `sanitize` of sanitize-filename 1.6.5 (its source, as written there) ----
  const PORT_ILLEGAL = /[/?<>\\:*|"]/g;
  // eslint-disable-next-line no-control-regex
  const PORT_CONTROL = /[\x00-\x1f\x80-\x9f]/g;
  const PORT_RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;
  const portStrip = (text: string, replace: boolean): string => {
    let end = text.length;
    while (end > 0 && (text[end - 1] === '.' || text[end - 1] === ' ')) end--;
    if (end === text.length) return text;
    return (
      text.slice(0, end) + (replace ? encodeURIComponent(text.slice(end)) : '')
    );
  };
  const portTruncate = (text: string, limit: number): string => {
    let bytes = 0;
    let end = 0;
    for (const character of text) {
      const size = Buffer.byteLength(character);
      if (bytes + size > limit) break;
      bytes += size;
      end += character.length;
    }
    return text.slice(0, end);
  };
  const portSanitize = (
    input: string,
    replace: boolean
  ): { first: string; out: string } => {
    const rep = (piece: string): string =>
      replace ? encodeURIComponent(piece) : '';
    const first = portStrip(
      input
        .replace(PORT_ILLEGAL, rep)
        .replace(PORT_CONTROL, rep)
        .replace(/^\.+$/, rep)
        .replace(PORT_RESERVED, rep),
      replace
    );
    const out = portStrip(portTruncate(first, 255), false).replace(
      PORT_RESERVED,
      ''
    );
    return { first, out };
  };
  /** What the module's call gives: the name, and the bytes that its first pass had before it was cut. */
  const portName = (text: string): { name: string; firstBytes: number } => {
    const once = portSanitize(text, true);
    return {
      name: portSanitize(once.out, false).out,
      firstBytes: Buffer.byteLength(once.first),
    };
  };

  // ---- the frozen functions of 5.0.0-56 ----
  const bytesOfTheOldFunctions = (text: string): number =>
    Buffer.byteLength(
      text
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u0080-\u009f/?<>\\:|"]/g, (character) =>
          encodeURIComponent(character)
        )
    );
  const refuse = (text: string): never => {
    throw new Error(
      `'${text}' does not name an object: an id or a name is not a path`
    );
  };
  const before: Record<string, (value: string) => string> = {
    fileNameOf: (value) => {
      const name = safeFileName(value);
      if (Buffer.byteLength(name) <= 250) return name;
      return Buffer.from(name)
        .subarray(0, 250)
        .toString('utf8')
        .replace(/�+$/, '')
        .replace(/[. ]+$/, '');
    },
    nameInFolder: (value) => {
      const text = String(value);
      if (isOneSafeSegment(text)) return text;
      if (bytesOfTheOldFunctions(text) > 255) throw new Error('too long');
      const name = safeFileName(text);
      return name === '' ? refuse(text) : name;
    },
    encodedName: (value) => {
      const text = String(value);
      if (bytesOfTheOldFunctions(text) > 255) throw new Error('too long');
      const name = safeFileName(text);
      return name === '' ? refuse(text) : name;
    },
    nameInStem: (value) => {
      const name = before.nameInFolder(value);
      return /^[A-Za-z]:/.test(name) ? `${name[0]}%3A${name.slice(2)}` : name;
    },
  };
  const after: Record<string, (id: string, suffix?: string) => string> = {
    fileNameOf,
    nameInFolder,
    encodedName,
    nameInStem,
  };

  /** What a function gives, as one comparable value: its name, or `refused`, or the text of any other error. */
  const outcome = (
    make: (id: string, suffix?: string) => string,
    id: string,
    suffix?: string
  ): string => {
    try {
      return `name ${make(id, suffix)}`;
    } catch (error) {
      return error.message.includes('does not name an object')
        ? 'refused'
        : `refused ${error.message}`;
    }
  };

  const isText = (id: string): boolean =>
    id.isWellFormed() && !id.includes('\u007f');

  /**
   * Whether the name that main gave to an id was a valid file name with the suffix: the id is text, the name is as long as
   * the sanitizer or the typed id makes it (nothing was cut, not by the sanitizer at 255 bytes and not by the function at
   * 250), it is 255 bytes or less with the suffix, and the gate accepts the file.
   */
  const wasValid = (
    fn: string,
    id: string,
    suffix: string,
    was: string
  ): boolean => {
    if (!isText(id)) return false;
    if (Buffer.byteLength(was) + Buffer.byteLength(suffix) > 255) return false;
    const typed =
      (fn === 'nameInFolder' || fn === 'nameInStem') && isOneSafeSegment(id);
    if (!typed) {
      const port = portName(id);
      if (port.firstBytes > 255 || port.name !== was) return false;
    }
    try {
      assertFileSetPath(`d/${was}${suffix}`);
    } catch {
      return false;
    }
    return true;
  };

  type Counts = { same: number; changed: number; none: number };

  /** Runs one id through the four functions and the suffixes; problems are what the claim does not hold for. */
  const compare = (
    id: string,
    suffixes: string[],
    problems: string[],
    counts: Counts
  ): void => {
    for (const fn of Object.keys(before)) {
      for (const suffix of suffixes) {
        // the old file name was cut at 250 bytes for `.json`: it is no measure for a shorter suffix
        if (fn === 'fileNameOf' && Buffer.byteLength(suffix) < 5) continue;
        const now = outcome(after[fn], id, suffix);
        const was = outcome(before[fn], id);
        const label = `${fn} ${JSON.stringify(suffix)} ${JSON.stringify(id.slice(0, 30))}(${id.length})`;
        if (!was.startsWith('name ') || was === 'name ') {
          // the old function refused the id (a name over 255 bytes, a lone surrogate after a device name), or it was one that
          // the sanitizer empties (an empty name): there is no old name to keep. The new one is a legal name, or no name for
          // a value that the sanitizer empties
          counts.none++;
          const leavesNone =
            portName(id.toWellFormed().replaceAll('\u007f', '\ufffd')).name ===
              '' &&
            !(
              (fn === 'nameInFolder' || fn === 'nameInStem') &&
              isOneSafeSegment(id)
            );
          if (now === 'refused' || now === 'name ') {
            if (!leavesNone)
              problems.push(`${label}: no name for an id that has one`);
          } else {
            const name = now.slice('name '.length);
            try {
              assertFileSetPath(`d/${name}${suffix}`);
              if (
                !name.isWellFormed() ||
                Buffer.byteLength(name) + Buffer.byteLength(suffix) > 255
              ) {
                throw new Error('too long or not text');
              }
            } catch {
              problems.push(
                `${label}: the name ${now.slice(0, 50)} is not a legal name`
              );
            }
          }
          continue;
        }
        const keptName = wasValid(fn, id, suffix, was.slice('name '.length));
        if (keptName) {
          counts.same++;
          if (now !== was) {
            problems.push(
              `${label}: was valid, was ${was.slice(0, 40)} is ${now.slice(0, 40)}`
            );
          }
          continue;
        }
        counts.changed++;
        // an old name that was cut, too long with its suffix, not text or refused by the gate: the name is another one now,
        // a shortened name that fits, is text and passes the gate
        const name = now.slice('name '.length);
        let fine =
          now.startsWith('name ') &&
          now !== was &&
          /~[0-9a-f]{8}$/.test(name) &&
          Buffer.byteLength(name) + Buffer.byteLength(suffix) <= 255 &&
          name.isWellFormed();
        if (fine) {
          try {
            assertFileSetPath(`d/${name}${suffix}`);
          } catch {
            fine = false;
          }
        }
        if (!fine) {
          problems.push(`${label}: was not valid, is ${now.slice(0, 60)}`);
        }
      }
    }
  };

  it('the port of the sanitizer gives the name that the package gives, and the length of its first pass', () => {
    const problems: string[] = [];
    const ids = [
      `com¹.${'x'.repeat(241)}`,
      `lpt².${'é'.repeat(120)}A`,
      `COM³.a/b c${'€'.repeat(30)}`,
      `con.${'x'.repeat(400)}`,
      `nul${'x'.repeat(300)}`,
      `${'x'.repeat(249)} `,
      `${'x'.repeat(100)}${'*'.repeat(300)}${'y'.repeat(100)}`,
      '.'.repeat(300),
      ' ',
      'a .',
      `${'*'.repeat(300)}abc`,
    ];
    for (const piece of ['', 'com¹.', 'LPT²', 'nul.']) {
      for (const body of [
        'a',
        'é',
        '€',
        '😀',
        '/',
        '\\',
        ':',
        '?',
        '*',
        '%',
        '<',
        '>',
        '|',
        '"',
        '\u0085',
        '\n',
        ' ',
        '.',
        '..',
      ]) {
        for (const length of [1, 60, 85, 86, 125, 126, 250, 251, 256, 300]) {
          ids.push(piece + body.repeat(length));
          ids.push(`${piece}x${body.repeat(length)}${body}`);
        }
      }
    }
    for (const id of ids) {
      const port = portName(id);
      if (port.name !== safeFileName(id))
        problems.push(
          `${JSON.stringify(id.slice(0, 30))}(${id.length}): the name`
        );
    }

    expect(problems.slice(0, 5)).toEqual([]);
    expect(ids.length).toBeGreaterThan(1500);
  });

  it('over the strings of the gate corpus every name is the name that it was (all 402,234 with FILE_NAME_FULL_CORPUS=1)', () => {
    const PIECES = [
      '..',
      '.',
      'C:',
      'c:',
      ':',
      '\\',
      '/',
      '%3A',
      '：',
      'a',
      'x.js',
      'CC::',
      'C',
    ];
    const problems: string[] = [];
    const counts: Counts = { same: 0, changed: 0, none: 0 };
    let total = 0;
    let used = 0;
    const walk = (prefix: string, depth: number): void => {
      total++;
      // a deterministic sample: every string of up to three pieces and every 80th of the others
      if (FULL || depth <= 3 || total % 80 === 0) {
        used++;
        compare(prefix, ['.json'], problems, counts);
      }
      if (depth === 5) return;
      for (const piece of PIECES) walk(prefix + piece, depth + 1);
    };
    walk('', 0);

    expect(problems.slice(0, 5)).toEqual([]);
    expect(total).toBe(402234);
    // every one of them fits: the names are the old names
    expect(counts.changed).toBe(0);
    expect(counts.same).toBeGreaterThan(FULL ? 1500000 : 25000);
    expect(used).toBeGreaterThan(FULL ? 402000 : 7000);
  }, 240000);

  it('over long ids around the 255 bytes the ids whose name changed are exactly the ids that did not fit (all of them with FILE_NAME_FULL_CORPUS=1)', () => {
    const PIECES = [
      'a',
      'é',
      '€',
      '😀',
      '/',
      '\\',
      ':',
      '?',
      '*',
      '%',
      '<',
      '>',
      '|',
      '"',
      '\u007f',
      '\u0085',
      '\n',
      'C:',
      '..',
      ' ',
      '.',
    ];
    // a device name with a dot or a superscript digit, which the sanitizer writes out whole, comes first in an id
    const PREFIXES = [
      '',
      'com¹.',
      'LPT².',
      'Nul.',
      'con',
      'COM3.txt',
      'aux.',
      'com³',
    ];
    const SUFFIXES = ['.json', '.onCreate.js', ''];
    const problems: string[] = [];
    const counts: Counts = { same: 0, changed: 0, none: 0 };
    const bodies: [string, number][] = [];
    const walk = (prefix: string, depth: number): void => {
      bodies.push([prefix, depth]);
      if (depth === 2) return;
      for (const piece of PIECES) walk(prefix + piece, depth + 1);
    };
    walk('', 0);
    let serial = 0;
    let used = 0;
    for (const prefix of PREFIXES) {
      const superscript = /[¹²³]/.test(prefix);
      for (const [body, depth] of bodies) {
        for (const measure of [
          portName(prefix + body).firstBytes,
          Buffer.byteLength(prefix + body),
        ]) {
          for (let target = 242; target <= 256; target++) {
            if (target < measure) continue;
            const id = prefix + 'a'.repeat(target - measure) + body;
            serial++;
            // a deterministic sample: every 30th id, and every id of a superscript device name with a short body
            if (FULL || serial % 30 === 0 || (superscript && depth <= 1)) {
              used++;
              compare(id, SUFFIXES, problems, counts);
            }
          }
        }
      }
    }

    expect(problems.slice(0, 5)).toEqual([]);
    expect(used).toBeGreaterThan(FULL ? 100000 : 5000);
    // both sorts are well represented: the old name is kept, or it is another, shortened name
    expect(counts.same).toBeGreaterThan(FULL ? 100000 : 8000);
    expect(counts.changed).toBeGreaterThan(FULL ? 300000 : 20000);
  }, 240000);
});

describe('the module stays pure', () => {
  const imports = importSpecifiersOf('src/utils/FileSetPathUtils.ts');

  it('imports nothing from the api, ops or lib layers or from the package root (layers and dependency direction: https://github.com/rockcarver/frodo-lib/blob/main/decisions/0004-layers-and-dependency-direction.md)', () => {
    expect(imports.filter((s) => UPWARD_PATTERN.test(s))).toEqual([]);
  });

  it('imports no module that reaches the file system, the machine or other processes', () => {
    expect(imports.filter((s) => NODE_IO_MODULES.includes(s))).toEqual([]);
  });

  it('imports only crypto, path and sanitize-filename (crypto is a built-in module that touches neither the file system nor the machine)', () => {
    expect([...imports].sort()).toEqual([
      'crypto',
      'path',
      'sanitize-filename',
    ]);
  });
});
