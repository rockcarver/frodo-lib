/**
 * Run tests
 *
 *        npm run test:only -- src/utils/FileSetUtils
 *
 * The shapes of a file set, the builder that checks and orders one, and the reader that serves one from memory
 * (`src/utils/FileSetUtils.ts`). Pure: no file is read or written, no network, no recording, no state.
 *
 * The paths that the builder and the reader accept are the paths of `assertFileSetPath` (`FileSetPathUtils.unit.test.ts`
 * holds its table); the rows here show that both call it, for a file, for an owned folder and for a path that is asked for.
 */
import type {
  FileSetEntry,
  FileSetReader,
  VirtualFile,
  VirtualFileSet,
} from '../index';
import {
  importSpecifiersOf,
  NODE_IO_MODULES,
  UPWARD_PATTERN,
} from '../test/exportFileFormat/importsOf';
import { exportsFrom, sourceText } from '../test/utils/SourceText';
import { buildFileSet, createMemoryFileSetReader } from './FileSetUtils';

/** A file set of every sort of path, in an order that is not the sorted one. */
const SCRAMBLED: VirtualFileSet = {
  files: [
    { path: 'realms/bravo/journeys/Login.json', content: '{"b":1}\n' },
    { path: 'top.txt', content: 'top' },
    { path: 'realms/alpha/scripts/lib/a.js', content: 'return 1;\n' },
    { path: 'realms/alpha/journeys/Registration.json', content: '{"r":1}\n' },
    { path: 'realms/alpha/journeys/Login.json', content: '{"l":1}\n' },
  ],
  ownedFolders: ['realms/alpha/journeys', 'empty/folder', 'Realms-extra'],
};

/** Every path of the rows: it is refused as the path of a file and as an owned folder. */
const BAD_PATHS = [
  [''],
  ['.'],
  ['..'],
  ['./a'],
  ['a/..'],
  ['../x'],
  ['/a'],
  ['a/'],
  ['a//b'],
  ['a\\b'],
  ['C:/x'],
  ['c:/x'],
  ['a\u0000b'],
  ['a'.repeat(256)],
  ['\ud800'],
];

describe('the types of a file set are on the package root', () => {
  it('compiles with the four types imported from the index, as a consumer imports them', () => {
    const file: VirtualFile = { path: 'a.json', content: '{}' };
    const entry: FileSetEntry = { name: 'a.json', isDirectory: false };
    const set: VirtualFileSet = { files: [file], ownedFolders: [] };
    const reader: FileSetReader = createMemoryFileSetReader(set);

    expect(entry.name).toBe(file.path);
    expect(typeof reader.listDirectory).toBe('function');
    expect(typeof reader.readFile).toBe('function');
  });

  it('exports the four types from the module of the file sets, as types, and no value', () => {
    expect(exportsFrom('index.ts', './utils/FileSetUtils')).toEqual({
      types: ['FileSetEntry', 'FileSetReader', 'VirtualFile', 'VirtualFileSet'],
      values: [],
    });
  });

  it('declares each of the four where the index says', () => {
    const source = sourceText('utils/FileSetUtils.ts');

    for (const name of ['FileSetEntry', 'VirtualFile', 'VirtualFileSet']) {
      expect(source).toMatch(new RegExp(`export type ${name} = \\{`));
    }
    expect(source).toMatch(/export interface FileSetReader \{/);
  });
});

describe('buildFileSet', () => {
  it('returns a set with the files and the owned folders sorted by ordinal order', () => {
    const set = buildFileSet(SCRAMBLED);

    expect(set.files.map((file) => file.path)).toEqual([
      'realms/alpha/journeys/Login.json',
      'realms/alpha/journeys/Registration.json',
      'realms/alpha/scripts/lib/a.js',
      'realms/bravo/journeys/Login.json',
      'top.txt',
    ]);
    // a capital letter comes before a small one, `-` before `/`, and nothing is a locale's order
    expect(set.ownedFolders).toEqual([
      'Realms-extra',
      'empty/folder',
      'realms/alpha/journeys',
    ]);
  });

  it('sorts by code unit and not by locale', () => {
    // no two names that differ only in case: the builder refuses them
    const paths = ['B', 'a', 'c', 'Z', 'ä', 'é', 'Ö', 'x', '_a', '-a'];
    const set = buildFileSet({
      files: paths.map((path) => ({ path, content: '' })),
      ownedFolders: paths.map((path) => `dir/${path}`),
    });
    const ordinal = [...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    expect(set.files.map((file) => file.path)).toEqual(ordinal);
    expect(set.ownedFolders).toEqual(ordinal.map((path) => `dir/${path}`));
    // the order of a locale puts `a` before `B`, which is not the order here
    expect(set.files.map((file) => file.path).indexOf('B')).toBeLessThan(
      set.files.map((file) => file.path).indexOf('a')
    );
    expect(ordinal.indexOf('x')).toBeLessThan(ordinal.indexOf('ä'));
  });

  it('gives one set for every order the same files are found in', () => {
    const expected = buildFileSet(SCRAMBLED);
    // a fixed shuffle: the same every run
    let seed = 7;
    const next = () => (seed = (seed * 48271) % 2147483647);
    for (let round = 0; round < 25; round++) {
      const files = [...SCRAMBLED.files];
      const ownedFolders = [...SCRAMBLED.ownedFolders];
      for (const list of [files, ownedFolders]) {
        for (let i = list.length - 1; i > 0; i--) {
          const j = next() % (i + 1);
          [list[i], list[j]] = [list[j], list[i]];
        }
      }

      expect(buildFileSet({ files, ownedFolders })).toEqual(expected);
    }
  });

  it('does not change what it is given, and shares nothing with it', () => {
    const input: VirtualFileSet = {
      files: SCRAMBLED.files.map((file) => Object.freeze({ ...file })),
      ownedFolders: [...SCRAMBLED.ownedFolders],
    };
    Object.freeze(input.files);
    Object.freeze(input.ownedFolders);
    Object.freeze(input);
    const before = JSON.stringify(input);

    const set = buildFileSet(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(set).not.toBe(input);
    expect(set.files).not.toBe(input.files);
    expect(set.ownedFolders).not.toBe(input.ownedFolders);
    // the files are new objects: changing the set does not change the input
    set.files[0].content = 'changed';
    set.files.reverse();
    set.ownedFolders.push('added');
    expect(JSON.stringify(input)).toBe(before);
    expect(input.files.map((file) => file.content)).not.toContain('changed');
  });

  it('keeps the text of every file byte for byte', () => {
    const contents = [
      '',
      '{}',
      '{}\n',
      '{}\r\n',
      '\ufeff{"bom":true}',
      'tab\tnul\u0000end',
      'caf\u00e9 and e\u0301 and \ud83d\ude00',
      'a'.repeat(100000),
      '  leading and trailing  ',
    ];
    const set = buildFileSet({
      files: contents.map((content, index) => ({
        path: `f${index}.txt`,
        content,
      })),
    });

    expect(set.files.map((file) => file.content)).toEqual(contents);
  });

  it('accepts an empty set, and no owned folders at all', () => {
    expect(buildFileSet({ files: [], ownedFolders: [] })).toEqual({
      files: [],
      ownedFolders: [],
    });
    expect(buildFileSet({ files: [{ path: 'a', content: 'x' }] })).toEqual({
      files: [{ path: 'a', content: 'x' }],
      ownedFolders: [],
    });
  });

  it('accepts what only looks alike: nested owned folders, a folder named like a file, a name that starts like another', () => {
    const set = buildFileSet({
      files: [
        { path: 'a/b', content: '1' },
        { path: 'a/bc', content: '2' },
        { path: 'ab/c', content: '3' },
        { path: 'a_b', content: '4' },
        { path: 'a b', content: '5' },
      ],
      ownedFolders: ['realms', 'realms/alpha', 'a'],
    });

    expect(set.files).toHaveLength(5);
    expect(set.ownedFolders).toEqual(['a', 'realms', 'realms/alpha']);
  });

  describe.each(BAD_PATHS)('the path %j', (path) => {
    it('is refused for a file', () => {
      expect(() =>
        buildFileSet({ files: [{ path, content: 'x' }], ownedFolders: [] })
      ).toThrow(
        /^(The path '.*' is not a path inside a file set|A file of a file set needs a path)/
      );
    });

    it('is refused for an owned folder', () => {
      expect(() => buildFileSet({ files: [], ownedFolders: [path] })).toThrow(
        /^(The path '.*' is not a path inside a file set|A file of a file set needs a path)/
      );
    });
  });

  it('refuses a path that two files have, naming it', () => {
    expect(() =>
      buildFileSet({
        files: [
          { path: 'a/b.json', content: '1' },
          { path: 'c.json', content: '2' },
          { path: 'a/b.json', content: '1' },
        ],
      })
    ).toThrow("The file set holds the path 'a/b.json' twice.");
  });

  it.each([
    ['a file that differs in case', 'themes/A/A.json', 'themes/a/a.json'],
    ['a name that differs in case', 'esvs/Name.json', 'esvs/name.json'],
    [
      'a folder that differs in case',
      'themes/Login/n.json',
      'themes/login/x.json',
    ],
    ['a name in two Unicode forms', 'x/\u00e9.json', 'x/e\u0301.json'],
    ['a folder in two Unicode forms', '\u00e9/x.json', 'e\u0301/y.json'],
    ['an upper case letter with an accent', 'x/\u00c9.json', 'x/\u00e9.json'],
  ])(
    'refuses %s: a file system that ignores it would keep only one',
    (_what, first, second) => {
      const message = new RegExp(
        `^The paths '.*' and '.*' are the same path on a file system that ignores case or Unicode form\\.$`
      );
      for (const files of [
        [first, second],
        [second, first],
      ]) {
        expect(() =>
          buildFileSet({ files: files.map((path) => ({ path, content: '' })) })
        ).toThrow(message);
      }
    }
  );

  it('names both paths of two that are the same on a file system that ignores case', () => {
    expect(() =>
      buildFileSet({
        files: [
          { path: 'a/B.json', content: '' },
          { path: 'a/b.json', content: '' },
        ],
      })
    ).toThrow(
      "The paths 'a/B.json' and 'a/b.json' are the same path on a file system that ignores case or Unicode form."
    );
  });

  it('refuses an owned folder that is the same as a path of a file on a file system that ignores case', () => {
    expect(() =>
      buildFileSet({
        files: [{ path: 'realms/alpha/x.json', content: '' }],
        ownedFolders: ['Realms/alpha'],
      })
    ).toThrow('are the same path on a file system that ignores case');
  });

  it.each([
    ['a file and a file below it', ['a', 'a/b.json'], []],
    ['a file and a file two folders below it', ['a', 'a/b/c.json'], []],
    ['a file and an owned folder of the same name', ['a'], ['a']],
    ['a file below which an owned folder lies', ['a/b'], ['a/b/c']],
    [
      'a file and an owned folder above, found in the other order',
      ['a/b/c.json', 'a/b'],
      [],
    ],
  ])(
    'refuses %s: a path cannot be a file and a folder',
    (_what, files, ownedFolders) => {
      expect(() =>
        buildFileSet({
          files: files.map((path) => ({ path, content: '' })),
          ownedFolders,
        })
      ).toThrow(
        /^The path '.*' is a file and also a folder of the file set\.$/
      );
    }
  );

  it('refuses a file that is a folder under another spelling, by the case rule', () => {
    expect(() =>
      buildFileSet({
        files: [
          { path: 'A', content: '' },
          { path: 'a/b.json', content: '' },
        ],
      })
    ).toThrow('are the same path on a file system that ignores case');
  });

  it('refuses an owned folder that is listed twice', () => {
    expect(() =>
      buildFileSet({
        files: [],
        ownedFolders: ['realms/alpha', 'x', 'realms/alpha'],
      })
    ).toThrow("The file set lists the owned folder 'realms/alpha' twice.");
  });

  it('refuses two owned folders that are the same on a file system that ignores case', () => {
    expect(() =>
      buildFileSet({ files: [], ownedFolders: ['Realms', 'realms'] })
    ).toThrow(
      "The paths 'Realms' and 'realms' are the same path on a file system that ignores case or Unicode form."
    );
  });

  it('accepts the same folder as an owned folder and as the folder of files', () => {
    const set = buildFileSet({
      files: [{ path: 'realms/alpha/journeys/Login.json', content: '' }],
      ownedFolders: ['realms/alpha/journeys', 'realms'],
    });

    expect(set.ownedFolders).toEqual(['realms', 'realms/alpha/journeys']);
  });
});

describe('createMemoryFileSetReader', () => {
  const reader = () => createMemoryFileSetReader(SCRAMBLED);

  /** [what the row shows, the call, what it gives] */
  const ANSWERS: [string, (r: FileSetReader) => Promise<unknown>, unknown][] = [
    [
      'a directory lists its children, files and directories, sorted by name',
      (r) => r.listDirectory('realms/alpha'),
      [
        { name: 'journeys', isDirectory: true },
        { name: 'scripts', isDirectory: true },
      ],
    ],
    [
      'a directory of files lists the files',
      (r) => r.listDirectory('realms/alpha/journeys'),
      [
        { name: 'Login.json', isDirectory: false },
        { name: 'Registration.json', isDirectory: false },
      ],
    ],
    [
      'only the direct children are listed, never what lies deeper',
      (r) => r.listDirectory('realms'),
      [
        { name: 'alpha', isDirectory: true },
        { name: 'bravo', isDirectory: true },
      ],
    ],
    [
      'a directory that holds a folder and no file lists the folder',
      (r) => r.listDirectory('realms/alpha/scripts'),
      [{ name: 'lib', isDirectory: true }],
    ],
    [
      'an owned folder with no file in it exists and lists as an empty list',
      (r) => r.listDirectory('empty/folder'),
      [],
    ],
    [
      'a folder above an owned folder exists and lists it',
      (r) => r.listDirectory('empty'),
      [{ name: 'folder', isDirectory: true }],
    ],
    [
      'a directory that does not exist is undefined, not an empty list',
      (r) => r.listDirectory('realms/charlie'),
      undefined,
    ],
    [
      'a file is read as its text, byte for byte',
      (r) => r.readFile('realms/alpha/scripts/lib/a.js'),
      'return 1;\n',
    ],
    [
      'a file that does not exist is undefined',
      (r) => r.readFile('realms/alpha/journeys/Missing.json'),
      undefined,
    ],
    [
      'a path is looked up as it is written, in its case',
      (r) => r.readFile('TOP.txt'),
      undefined,
    ],
    [
      'a file below a file is not there',
      (r) => r.readFile('top.txt/x'),
      undefined,
    ],
    [
      'a directory below a file is not there',
      (r) => r.listDirectory('top.txt/x'),
      undefined,
    ],
  ];

  it.each(ANSWERS)('%s', async (_what, call, expected) => {
    await expect(call(reader())).resolves.toEqual(expected);
  });

  it('has twelve rows of the contract', () => {
    expect(ANSWERS).toHaveLength(12);
  });

  it.each([
    [
      'a file asked for as a directory',
      (r: FileSetReader) => r.listDirectory('top.txt'),
      "The path 'top.txt' is a file, not a directory.",
    ],
    [
      'a directory asked for as a file',
      (r: FileSetReader) => r.readFile('realms/alpha'),
      "The path 'realms/alpha' is a directory, not a file.",
    ],
    [
      'an owned folder asked for as a file',
      (r: FileSetReader) => r.readFile('empty/folder'),
      "The path 'empty/folder' is a directory, not a file.",
    ],
  ])('rejects %s', async (_what, call, message) => {
    await expect(call(reader())).rejects.toThrow(message);
  });

  it.each(BAD_PATHS)(
    'rejects the path %j, for a listing and for a file',
    async (path) => {
      await expect(reader().listDirectory(path)).rejects.toThrow(
        /is not a path inside a file set|needs a path/
      );
      await expect(reader().readFile(path)).rejects.toThrow(
        /is not a path inside a file set|needs a path/
      );
    }
  );

  it('reads with forward slashes only: a backslash is no separator', async () => {
    await expect(
      reader().readFile('realms\\alpha\\journeys\\Login.json')
    ).rejects.toThrow('holds a backslash');
    await expect(reader().listDirectory('realms\\alpha')).rejects.toThrow(
      'holds a backslash'
    );
  });

  it('cannot list the root: the empty path is not a path of a file set', async () => {
    await expect(reader().listDirectory('')).rejects.toThrow(
      'A file of a file set needs a path.'
    );
  });

  it('gives a new list every time: changing it changes nothing', async () => {
    const r = reader();
    const first = (await r.listDirectory('realms')) as FileSetEntry[];
    first.pop();
    first[0].name = 'changed';

    await expect(r.listDirectory('realms')).resolves.toEqual([
      { name: 'alpha', isDirectory: true },
      { name: 'bravo', isDirectory: true },
    ]);
  });

  it('serves a copy: changing the set after the reader was made changes nothing', async () => {
    const input: VirtualFileSet = {
      files: [{ path: 'a/b.json', content: 'one' }],
      ownedFolders: [],
    };
    const r = createMemoryFileSetReader(input);
    input.files[0].content = 'two';
    input.files.push({ path: 'a/c.json', content: 'three' });

    await expect(r.readFile('a/b.json')).resolves.toBe('one');
    await expect(r.listDirectory('a')).resolves.toEqual([
      { name: 'b.json', isDirectory: false },
    ]);
  });

  it('lists names in ordinal order, whatever the order of the files', async () => {
    const r = createMemoryFileSetReader({
      files: ['c', 'B', 'a', 'ä', 'z'].map((name) => ({
        path: `d/${name}`,
        content: '',
      })),
      ownedFolders: [],
    });
    const entries = (await r.listDirectory('d')) as FileSetEntry[];

    expect(entries.map((entry) => entry.name)).toEqual([
      'B',
      'a',
      'c',
      'z',
      'ä',
    ]);
  });

  it('lists a folder and a file in the order of their names, not of their paths', async () => {
    // `d/a.json` is before `d/a/x.json` as a path (`.` is before `/`), but the folder `a` is before the file `a.json` as a name
    const r = createMemoryFileSetReader({
      files: [
        { path: 'd/a.json', content: '' },
        { path: 'd/a/x.json', content: '' },
      ],
      ownedFolders: [],
    });

    await expect(r.listDirectory('d')).resolves.toEqual([
      { name: 'a', isDirectory: true },
      { name: 'a.json', isDirectory: false },
    ]);
  });

  it('lists an owned folder that holds no file among the files, in order', async () => {
    const r = createMemoryFileSetReader({
      files: [
        { path: 'd/b.json', content: '' },
        { path: 'd/z.json', content: '' },
      ],
      ownedFolders: ['d/a', 'd/c'],
    });

    await expect(r.listDirectory('d')).resolves.toEqual([
      { name: 'a', isDirectory: true },
      { name: 'b.json', isDirectory: false },
      { name: 'c', isDirectory: true },
      { name: 'z.json', isDirectory: false },
    ]);
  });

  it('refuses a set that the builder refuses, when the reader is made', () => {
    expect(() =>
      createMemoryFileSetReader({
        files: [
          { path: 'a', content: '' },
          { path: 'a/b', content: '' },
        ],
        ownedFolders: [],
      })
    ).toThrow('is a file and also a folder of the file set');
    expect(() =>
      createMemoryFileSetReader({
        files: [{ path: '../x', content: '' }],
        ownedFolders: [],
      })
    ).toThrow("has '..' as a part");
  });

  it('serves the text of a file as the set holds it', async () => {
    const content = '\ufeff{"a":"caf\u00e9"}\r\n\u0000';
    const r = createMemoryFileSetReader({
      files: [{ path: 'x/y.json', content }],
      ownedFolders: [],
    });

    await expect(r.readFile('x/y.json')).resolves.toBe(content);
  });
});

describe('the module stays pure', () => {
  const imports = importSpecifiersOf('src/utils/FileSetUtils.ts');

  it('imports nothing from the api, ops or lib layers or from the package root (layers and dependency direction: https://github.com/rockcarver/frodo-lib/blob/main/decisions/0004-layers-and-dependency-direction.md)', () => {
    expect(imports.filter((s) => UPWARD_PATTERN.test(s))).toEqual([]);
  });

  it('imports no module that reaches the file system, the machine or other processes', () => {
    expect(imports.filter((s) => NODE_IO_MODULES.includes(s))).toEqual([]);
  });

  it('imports only the path rules', () => {
    expect([...imports].sort()).toEqual(['./FileSetPathUtils']);
  });
});
