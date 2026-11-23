/**
 * Run tests
 *
 *        npm run test:only -- src/utils/ExportFileFormatUtils
 *
 * The pure functions of the export file format: text from data (`serializeExportJson`), data from text
 * (`parseExportJson`, `resolvePlaceholders`), the envelope of a saved list (`buildExportEnvelope`) and the rules for
 * names and paths (`getTypedFilename`, `normalizeFilePath`, `joinWorkingDirectory`, `withTrailingNewline`). The module
 * touches no file, reads no state and prints nothing, so no test here needs a tenant, a recording or a file.
 *
 * `src/test/exportFileFormat/frozenOutputs.json` holds what the functions of `ExportImportUtils.ts` produced at commit
 * 6a1d26043, before they were split: every case is compared with it byte for byte.
 */
import {
  combinationId,
  differentialCases,
  FILE_PATH_NAMES,
  FIXED_METADATA,
  loadFrozenOutputs,
  makeFixedState,
  MODIFIED_KEYS,
  OPTION_COMBINATIONS,
  PLACEHOLDER_CONTENTS,
  PLACEHOLDER_STATE_VALUES,
  SAVE_TO_FILE_CASES,
  SAVE_TO_FILE_OPTIONS,
  TYPED_FILENAME_CASES,
  WORKING_DIRECTORIES,
} from '../test/exportFileFormat/differentialCases';
import {
  importSpecifiersOf,
  NODE_IO_MODULES,
  UPWARD_PATTERN,
} from '../test/exportFileFormat/importsOf';
import {
  buildExportEnvelope,
  escapePlaceholders,
  getTypedFilename,
  joinWorkingDirectory,
  normalizeFilePath,
  parseExportJson,
  resolvePlaceholders,
  serializeExportJson,
  unescapePlaceholders,
  withTrailingNewline,
} from './ExportFileFormatUtils';

const frozen = loadFrozenOutputs();

/**
 * A deep copy that stays in the realm of the test (a `structuredClone` copy has the `Object` of another realm, and the
 * deterministic stringify sorts only objects that are an `instanceof` of its own).
 * @param {unknown} value the value
 * @returns {unknown} the copy
 */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('serializeExportJson', () => {
  const cases = differentialCases();

  test('the differential corpus has at least 200 cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(200);
    expect(Object.keys(frozen.saveJsonToFile.cases)).toHaveLength(cases.length);
  });

  test('every case, with every combination of the three switches, is byte-identical to the text that was frozen', () => {
    const mismatches: string[] = [];
    let compared = 0;
    for (const { id, data } of cases) {
      for (const options of OPTION_COMBINATIONS) {
        const text = serializeExportJson({
          data,
          metadata: FIXED_METADATA,
          ...options,
        });
        const expected =
          frozen.saveJsonToFile.texts[
            frozen.saveJsonToFile.cases[id][combinationId(options)]
          ];
        compared += 1;
        if (text !== expected)
          mismatches.push(`${id} [${combinationId(options)}]`);
      }
    }
    expect(mismatches).toEqual([]);
    expect(compared).toBe(cases.length * 8);
  });

  test('never changes its input: not the data, not the metadata', () => {
    const metadata = copy(FIXED_METADATA);
    const changed: string[] = [];
    for (const { id, data } of differentialCases()) {
      const before = JSON.stringify(data);
      for (const options of OPTION_COMBINATIONS) {
        serializeExportJson({ data, metadata, ...options });
        if (JSON.stringify(data) !== before) {
          changed.push(`${id} [${combinationId(options)}]`);
        }
      }
    }
    expect({ count: changed.length, first: changed.slice(0, 5) }).toEqual({
      count: 0,
      first: [],
    });
    expect(metadata).toEqual(FIXED_METADATA);
  });

  test('does not change the metadata even when the metadata holds a key that is removed', () => {
    const metadata = { origin: 'x', _rev: '1', lastModifiedBy: 'u' };
    const text = serializeExportJson({ data: { a: 1 }, metadata });
    expect(JSON.parse(text).meta).toEqual({ origin: 'x' });
    expect(metadata).toEqual({ origin: 'x', _rev: '1', lastModifiedBy: 'u' });
  });

  test('without options: the meta header is added, _rev and the modified keys are removed', () => {
    const text = serializeExportJson({
      data: { b: 1, a: { _rev: '1', modified: 2, keep: 3 } },
      metadata: { origin: 'o' },
    });
    expect(text).toBe(
      '{\n  "a": {\n    "keep": 3\n  },\n  "b": 1,\n  "meta": {\n    "origin": "o"\n  }\n}\n'
    );
  });

  test('keys are sorted at every depth, in arrays of objects too, and the text is indented by two spaces', () => {
    const text = serializeExportJson({
      data: { z: 1, a: [{ y: 1, b: 2 }], m: { z: 1, a: 2 } },
      metadata: {},
      includeMeta: false,
    });
    expect(text).toBe(
      JSON.stringify(
        { a: [{ b: 2, y: 1 }], m: { a: 2, z: 1 }, z: 1 },
        null,
        2
      ) + '\n'
    );
  });

  test.each([
    ['an object', { a: 1 }],
    ['an empty object', {}],
    ['an array', [1, 2]],
    ['a nested value', { a: { b: [{ c: 1 }] } }],
  ])('ends with exactly one newline: %s', (_, data) => {
    const text = serializeExportJson({
      data,
      metadata: {},
      includeMeta: false,
    });
    expect(text.endsWith('}\n') || text.endsWith(']\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  test.each(['_rev', ...MODIFIED_KEYS])(
    'removes %s at every depth when its switch is off, and keeps it when its switch is on',
    (key) => {
      const data = { [key]: 1, a: { [key]: 2, b: [{ [key]: 3, keep: true }] } };
      const isRev = key === '_rev';
      const removed = serializeExportJson({
        data,
        metadata: {},
        includeMeta: false,
      });
      expect(removed).not.toContain(key);
      expect(removed).toContain('"keep": true');
      const kept = serializeExportJson({
        data,
        metadata: {},
        includeMeta: false,
        keepRev: isRev,
        keepModifiedProperties: !isRev,
      });
      expect(kept.match(new RegExp(`"${key}"`, 'g'))).toHaveLength(3);
    }
  );

  test('removes a key that equals one of the eleven, and no key that merely contains one', () => {
    const text = serializeExportJson({
      data: { _rev: 1, _rev2: 2, xmodified: 3, modified: 4, Modified: 5 },
      metadata: {},
      includeMeta: false,
    });
    expect(JSON.parse(text)).toEqual({ _rev2: 2, xmodified: 3, Modified: 5 });
  });

  describe('the meta header', () => {
    const envelope = {
      origin: 'https://openam-zion.example.com/am',
      exportTool: 'frodo',
    };
    const parse = (text: string) => JSON.parse(text);

    test('is added when the data has none and includeMeta is on (the default)', () => {
      const text = serializeExportJson({
        data: { a: 1 },
        metadata: FIXED_METADATA,
      });
      expect(parse(text).meta).toEqual(FIXED_METADATA);
    });

    test.each([
      ['null', null],
      ['an empty string', ''],
      ['zero', 0],
      ['false', false],
    ])('is added when the data has a meta that is %s', (_, meta) => {
      const text = serializeExportJson({
        data: { meta, a: 1 },
        metadata: FIXED_METADATA,
      });
      expect(parse(text).meta).toEqual(FIXED_METADATA);
    });

    test.each([
      ['an envelope', envelope],
      ['an empty object', {}],
      ['an array', []],
      ['a string', 'text'],
      ['another object', { relationships: { owner: 'x' } }],
    ])('is kept as it is when the data has a meta that is %s', (_, meta) => {
      const text = serializeExportJson({
        data: { meta, a: 1 },
        metadata: FIXED_METADATA,
      });
      expect(parse(text).meta).toEqual(meta);
    });

    test.each([
      ['an envelope', envelope],
      ['the empty placeholder', {}],
    ])('is removed when includeMeta is off and the meta is %s', (_, meta) => {
      const text = serializeExportJson({
        data: { meta, a: 1 },
        metadata: FIXED_METADATA,
        includeMeta: false,
      });
      expect(parse(text)).toEqual({ a: 1 });
    });

    test.each([
      ['relationship configuration', { relationships: { owner: 'x' } }],
      ['an exportTool that is not a string', { exportTool: 5 }],
      ['an array', [1]],
      ['null', null],
      ['a string', 'text'],
    ])(
      'survives when includeMeta is off and the meta is %s (real data of a managed object, not an envelope)',
      (_, meta) => {
        const text = serializeExportJson({
          data: { meta, a: 1 },
          metadata: FIXED_METADATA,
          includeMeta: false,
        });
        expect(parse(text).meta).toEqual(meta);
      }
    );

    test('only the top level meta is an envelope: a nested meta is data', () => {
      const text = serializeExportJson({
        data: { a: { meta: envelope } },
        metadata: FIXED_METADATA,
        includeMeta: false,
      });
      expect(parse(text)).toEqual({ a: { meta: envelope } });
    });
  });
});

describe('serializeExportJson with values that are not plain JSON', () => {
  const written = (data: object, options = {}) =>
    serializeExportJson({ data, metadata: {}, includeMeta: false, ...options });

  test('a property whose value is a function is written as an empty object, as it always was', () => {
    expect(written({ f() {}, a: 1, _rev: 'x' })).toBe(
      '{\n  "a": 1,\n  "f": {}\n}\n'
    );
  });

  test('the keys that are left out are left out of what toJSON or a getter returns, too', () => {
    expect(
      written({ o: { toJSON: () => ({ _rev: 'x', modified: 1, v: 1 }) } })
    ).toBe('{\n  "o": {\n    "v": 1\n  }\n}\n');
    expect(
      written({
        get g() {
          return { _rev: 'x', v: 1 };
        },
      })
    ).toBe('{\n  "g": {\n    "v": 1\n  }\n}\n');
  });

  test('a circular reference throws a RangeError and leaves the data as it was', () => {
    const data: Record<string, unknown> = { a: 1, _rev: 'x' };
    data.self = data;
    expect(() => written(data)).toThrow(RangeError);
    expect(data._rev).toBe('x');
    expect(Object.keys(data)).toEqual(['a', '_rev', 'self']);
  });

  test('a BigInt throws a TypeError', () => {
    expect(() => written({ a: 1n })).toThrow(TypeError);
  });

  test('frozen data is written, and stays as it is', () => {
    const data = Object.freeze({ z: 1, a: 2, _rev: 'x' });
    expect(written(data)).toBe('{\n  "a": 2,\n  "z": 1\n}\n');
    expect(data._rev).toBe('x');
  });

  test('an object without a prototype is written in its own order, at the top and nested, as it always was', () => {
    const bare = () => Object.assign(Object.create(null), { z: 1, a: 2 });
    expect(written(bare())).toBe('{\n  "z": 1,\n  "a": 2\n}\n');
    expect(written({ n: bare() })).toBe(
      '{\n  "n": {\n    "z": 1,\n    "a": 2\n  }\n}\n'
    );
  });

  test('the metadata is added to an object without a prototype at the end of its own order', () => {
    const bare = Object.assign(Object.create(null), { z: 1 });
    expect(serializeExportJson({ data: bare, metadata: { m: 1 } })).toBe(
      '{\n  "z": 1,\n  "meta": {\n    "m": 1\n  }\n}\n'
    );
  });
});

describe('parseExportJson', () => {
  test.each([
    [
      'an object',
      '{"a":1,"b":[1,2,{"c":null}]}',
      { a: 1, b: [1, 2, { c: null }] },
    ],
    ['an array', '[1,"two",{"three":3}]', [1, 'two', { three: 3 }]],
    ['unicode', '{"name":"é ü 日本語 😀"}', { name: 'é ü 日本語 😀' }],
    ['whitespace around the value', '  \n{"a":1}\n\n', { a: 1 }],
    [
      'a text that serializeExportJson wrote',
      serializeExportJson({
        data: { a: [1] },
        metadata: {},
        includeMeta: false,
      }),
      { a: [1] },
    ],
  ])('turns %s into data', (_, text, expected) => {
    expect(parseExportJson(text)).toEqual(expected);
  });

  test.each([
    ['an empty text', ''],
    ['an unfinished object', '{"a":'],
    ['single quotes', "{'a':1}"],
    ['a trailing comma', '{"a":1,}'],
    ['text that is not JSON', 'not json'],
  ])('throws a SyntaxError for %s', (_, text) => {
    expect(() => parseExportJson(text)).toThrow(SyntaxError);
  });

  test('does not read placeholders: a placeholder is an ordinary string', () => {
    expect(parseExportJson('{"a":"${NAME}"}')).toEqual({ a: '${NAME}' });
  });

  test('gives back what serializeExportJson wrote: writing the parsed text again gives the same text', () => {
    const mismatches: string[] = [];
    for (const { id, data } of differentialCases()) {
      const options = {
        metadata: FIXED_METADATA,
        keepRev: true,
        keepModifiedProperties: true,
      };
      const text = serializeExportJson({ data, ...options });
      const again = serializeExportJson({
        data: parseExportJson(text),
        ...options,
      });
      if (again !== text) mismatches.push(id);
    }
    expect(mismatches).toEqual([]);
  });
});

describe('resolvePlaceholders', () => {
  const lookupOf =
    (values: Record<string, string>) =>
    (name: string): string | undefined =>
      Object.prototype.hasOwnProperty.call(values, name)
        ? values[name]
        : undefined;

  test('fills a placeholder with the value that the lookup gives for its name', () => {
    expect(
      resolvePlaceholders({
        content: '{"a":"${ONE}","b":"x${TWO}y"}',
        lookup: lookupOf({ ONE: '1', TWO: '2' }),
      })
    ).toBe('{"a":"1","b":"x2y"}');
  });

  test('fills every occurrence of a placeholder', () => {
    expect(
      resolvePlaceholders({
        content: '${A}-${A}-${A}',
        lookup: lookupOf({ A: 'x' }),
      })
    ).toBe('x-x-x');
  });

  test('an empty value is a value', () => {
    expect(
      resolvePlaceholders({ content: '[${A}]', lookup: lookupOf({ A: '' }) })
    ).toBe('[]');
  });

  test('decodes the value of a BASE64: placeholder and asks the lookup for the name without the prefix', () => {
    const asked: string[] = [];
    const result = resolvePlaceholders({
      content: '${BASE64:SECRET}',
      lookup: (name) => {
        asked.push(name);
        return Buffer.from('é 日本語', 'utf8').toString('base64');
      },
    });
    expect(result).toBe('é 日本語');
    expect(asked).toEqual(['SECRET']);
  });

  test('an escaped placeholder (two backslashes) is not looked up and is written without the backslashes', () => {
    const asked: string[] = [];
    const result = resolvePlaceholders({
      content: '{"a":"\\\\${X}","b":"${Y}"}',
      lookup: (name) => {
        asked.push(name);
        return 'v';
      },
    });
    expect(result).toBe('{"a":"${X}","b":"v"}');
    expect(asked).toEqual(['Y']);
  });

  test('a placeholder with no closing brace is not a placeholder: the content is returned as it is', () => {
    const asked: string[] = [];
    // the escape and the opening are in the text, and no closing brace anywhere after them
    const content = 'text \\\\${OPEN';
    expect(
      resolvePlaceholders({
        content,
        lookup: (name) => {
          asked.push(name);
          return 'x';
        },
      })
    ).toBe(content);
    expect(asked).toEqual([]);
  });

  test('a content without a placeholder is returned as it is and the lookup is not called', () => {
    const asked: string[] = [];
    expect(
      resolvePlaceholders({
        content: 'plain $ { }',
        lookup: (name) => {
          asked.push(name);
          return 'x';
        },
      })
    ).toBe('plain $ { }');
    expect(asked).toEqual([]);
  });

  test('asks the lookup in the order of the placeholders, once for each occurrence', () => {
    const asked: string[] = [];
    resolvePlaceholders({
      content: '${B} ${A} ${B}',
      lookup: (name) => {
        asked.push(name);
        return 'v';
      },
    });
    expect(asked).toEqual(['B', 'A', 'B']);
  });

  test('a name with no value throws an Error that names the placeholder and not its value', () => {
    expect(() =>
      resolvePlaceholders({
        content: '${A} ${MISSING}',
        lookup: lookupOf({ A: 'secret-value' }),
      })
    ).toThrow('No value found for placeholder "MISSING"');
  });

  test('a BASE64: name with no value names the placeholder without the prefix', () => {
    expect(() =>
      resolvePlaceholders({ content: '${BASE64:GONE}', lookup: lookupOf({}) })
    ).toThrow('No value found for placeholder "GONE"');
  });

  test('every content of the frozen table gives the frozen result or the frozen error (values of the state, no process environment)', () => {
    const state = makeFixedState();
    state.setEnvs(PLACEHOLDER_STATE_VALUES);
    const rows = frozen.replaceEnvSpecificValues.filter((r) => !r.useProcess);
    expect(rows).toHaveLength(PLACEHOLDER_CONTENTS.length);
    const mismatches: string[] = [];
    for (const row of rows) {
      let result: string | null = null;
      let error: string | null = null;
      try {
        result = resolvePlaceholders({
          content: PLACEHOLDER_CONTENTS[row.case],
          lookup: (name) => state.getEnv(name),
        });
      } catch (e) {
        error = (e as Error).message;
      }
      // the rows that read the process environment have no value in the state: compared in the wrapper test
      const usesProcessOnly = /PROC_|\$\{SHARED\}/.test(
        PLACEHOLDER_CONTENTS[row.case]
      );
      if (!usesProcessOnly && (result !== row.result || error !== row.error)) {
        mismatches.push(`case ${row.case}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('buildExportEnvelope', () => {
  test('puts one object under its identifier, under the type', () => {
    expect(
      buildExportEnvelope({
        type: 'script',
        identifier: '_id',
        data: { _id: 'a', name: 'A' },
      })
    ).toEqual({ script: { a: { _id: 'a', name: 'A' } } });
  });

  test('puts every element of a list under its identifier, in the order of the list', () => {
    const envelope = buildExportEnvelope({
      type: 'script',
      identifier: 'name',
      data: [
        { _id: 'b', name: 'B' },
        { _id: 'a', name: 'A' },
      ],
    });
    expect(envelope).toEqual({
      script: {
        B: { _id: 'b', name: 'B' },
        A: { _id: 'a', name: 'A' },
      },
    });
    expect(Object.keys(envelope.script)).toEqual(['B', 'A']);
  });

  test('an empty list gives the type with no entry', () => {
    expect(
      buildExportEnvelope({ type: 't', identifier: '_id', data: [] })
    ).toEqual({
      t: {},
    });
  });

  test('a later element with the same identifier replaces the earlier one', () => {
    expect(
      buildExportEnvelope({
        type: 't',
        identifier: '_id',
        data: [
          { _id: 'dup', v: 1 },
          { _id: 'dup', v: 2 },
        ],
      })
    ).toEqual({ t: { dup: { _id: 'dup', v: 2 } } });
  });

  test('an object without the identifier is put under the key "undefined", as it always was', () => {
    expect(
      buildExportEnvelope({ type: 't', identifier: 'missing', data: { a: 1 } })
    ).toEqual({ t: { undefined: { a: 1 } } });
  });

  test('does not change the data', () => {
    const data = [{ _id: 'a', _rev: '1' }];
    buildExportEnvelope({ type: 't', identifier: '_id', data });
    expect(data).toEqual([{ _id: 'a', _rev: '1' }]);
  });

  test('every case and switch, serialized, is byte-identical to the text that was frozen', () => {
    const mismatches: string[] = [];
    let compared = 0;
    SAVE_TO_FILE_CASES.forEach(([type, identifier, original], index) => {
      for (const [
        includeMeta,
        keepModifiedProperties,
      ] of SAVE_TO_FILE_OPTIONS) {
        const data = copy(original);
        const text = serializeExportJson({
          data: buildExportEnvelope({ type, identifier, data }),
          metadata: FIXED_METADATA,
          includeMeta,
          keepModifiedProperties,
        });
        const entry = frozen.saveToFile.find(
          (e) =>
            e.case === index &&
            e.includeMeta === includeMeta &&
            e.keepModifiedProperties === keepModifiedProperties
        );
        compared += 1;
        if (text !== entry?.text) mismatches.push(`case ${index}`);
        expect(data).toEqual(original);
      }
    });
    expect(mismatches).toEqual([]);
    expect(compared).toBe(frozen.saveToFile.length);
  });
});

describe('withTrailingNewline', () => {
  test.each([
    ['', '\n'],
    ['text', 'text\n'],
    ['text\n', 'text\n'],
    ['text\n\n', 'text\n\n'],
    ['\n', '\n'],
    ['line one\nline two', 'line one\nline two\n'],
    ['ends with a carriage return\r', 'ends with a carriage return\r\n'],
  ])('%j gives %j', (text, expected) => {
    expect(withTrailingNewline(text)).toBe(expected);
  });
});

describe('normalizeFilePath', () => {
  test.each([
    ['file.json', 'file.json'],
    ['a/b/file.json', 'a/b/file.json'],
    ['a\\b\\file.json', 'a/b/file.json'],
    ['a\\b/c\\file.json', 'a/b/c/file.json'],
    ['C:\\x\\file.json', '/x/file.json'],
    ['C:/x/file.json', '/x/file.json'],
    ['a/..C:/b', 'a/../b'],
    ['..C:', '..'],
    ['.C:.', '..'],
    ['CC::', 'C:'],
    ['C:C:', ''],
    ['ABC:x', 'ABx'],
    // only the capital C is a drive letter that is removed
    ['c:x', 'c:x'],
    ['x:y', 'x:y'],
    ['Login:SSO.json', 'Login:SSO.json'],
    ['', ''],
  ])('%j gives %j', (fileName, expected) => {
    expect(normalizeFilePath(fileName)).toBe(expected);
  });
});

describe('joinWorkingDirectory', () => {
  test.each([
    ['', 'file.json', 'file.json'],
    ['/tmp/work', 'file.json', '/tmp/work/file.json'],
    ['/tmp/work/', 'file.json', '/tmp/work/file.json'],
    ['/tmp/work//', 'file.json', '/tmp/work//file.json'],
    ['relative/dir', 'a/b.json', 'relative/dir/a/b.json'],
    ['.', 'file.json', './file.json'],
    ['/', 'file.json', '/file.json'],
    ['C:/work', 'file.json', 'C:/work/file.json'],
  ])(
    'the working directory %j and the name %j give %j',
    (directory, fileName, expected) => {
      expect(joinWorkingDirectory(directory, fileName)).toBe(expected);
    }
  );

  test('with normalizeFilePath, gives the frozen path of getFilePath for every working directory and file name', () => {
    expect(frozen.getFilePath).toHaveLength(
      WORKING_DIRECTORIES.length * FILE_PATH_NAMES.length
    );
    const mismatches = frozen.getFilePath.filter(
      (row) =>
        joinWorkingDirectory(row.directory, normalizeFilePath(row.fileName)) !==
        row.result
    );
    expect(mismatches).toEqual([]);
  });
});

describe('getTypedFilename', () => {
  test('gives the frozen name for every case', () => {
    expect(frozen.getTypedFilename).toHaveLength(TYPED_FILENAME_CASES.length);
    const mismatches = frozen.getTypedFilename.filter((row) => {
      const actual =
        row.suffix === null
          ? getTypedFilename(row.name, row.type)
          : getTypedFilename(row.name, row.type, row.suffix);
      return actual !== row.result;
    });
    expect(mismatches).toEqual([]);
  });

  test.each([
    // the two authentication modules whose names differ only in case get different files on a file system that ignores case
    [
      'Federation',
      'authenticationModules',
      'federation.authenticationModules.json',
    ],
    [
      'federation',
      'authenticationModules',
      'federation_.authenticationModules.json',
    ],
    [
      'FEDERATION',
      'authenticationModules',
      'FEDERATION.authenticationModules.json',
    ],
    ['Federation', 'journey', 'Federation.journey.json'],
    ['federation', 'journey', 'federation.journey.json'],
    // a name becomes a slug of the characters that a file name keeps
    ['My Script', 'script', 'My-Script.script.json'],
    [
      'https://openam-matrix.example.com/am',
      'idp',
      'openam-matrix.example.comam.idp.json',
    ],
    ['http://host', 'idp', 'host.idp.json'],
  ])('%j of type %j is %j', (name, type, expected) => {
    expect(getTypedFilename(name, type)).toBe(expected);
  });

  test('the suffix is json unless one is given', () => {
    expect(getTypedFilename('a', 'script')).toBe('a.script.json');
    expect(getTypedFilename('a', 'script', 'js')).toBe('a.script.js');
  });
});

describe('escapePlaceholders and unescapePlaceholders', () => {
  test('escapePlaceholders puts a backslash in front of every ${ in the values of an object, and returns a new object', () => {
    const content = { a: '${X}', b: ['${Y} and ${Z}'], c: 'none' };
    const escaped = escapePlaceholders(content);
    // one backslash in the value (two in the text of the file, where JSON writes each backslash as two)
    expect(escaped).toEqual({
      a: '\\${X}',
      b: ['\\${Y} and \\${Z}'],
      c: 'none',
    });
    expect(escaped).not.toBe(content);
    expect(content.a).toBe('${X}');
  });

  test('unescapePlaceholders removes the two backslashes in front of ${', () => {
    expect(unescapePlaceholders('\\\\${X} and \\\\${Y}')).toBe('${X} and ${Y}');
    expect(unescapePlaceholders('\\${X}')).toBe('\\${X}');
    expect(unescapePlaceholders('${X}')).toBe('${X}');
    expect(unescapePlaceholders('')).toBe('');
  });

  test('a placeholder that escapePlaceholders escaped is not filled by resolvePlaceholders and is written back as it was', () => {
    const asked: string[] = [];
    const content = JSON.stringify(escapePlaceholders({ a: '${KEEP}' }));
    expect(
      resolvePlaceholders({
        content,
        lookup: (name) => {
          asked.push(name);
          return 'never';
        },
      })
    ).toBe('{"a":"${KEEP}"}');
    expect(asked).toEqual([]);
  });
});

describe('the module stays pure', () => {
  const imports = importSpecifiersOf('src/utils/ExportFileFormatUtils.ts');

  test('imports nothing from the api, ops or lib layers or from the package root (layers and dependency direction: https://github.com/rockcarver/frodo-lib/blob/main/decisions/0004-layers-and-dependency-direction.md)', () => {
    expect(imports.filter((s) => UPWARD_PATTERN.test(s))).toEqual([]);
  });

  test('imports no module that reaches the file system, the machine or other processes', () => {
    expect(imports.filter((s) => NODE_IO_MODULES.includes(s))).toEqual([]);
  });

  test('imports only slugify', () => {
    expect(imports).toEqual(['slugify']);
  });
});
