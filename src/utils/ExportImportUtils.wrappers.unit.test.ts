/**
 * Run tests
 *
 *        npm run test:only -- src/utils/ExportImportUtils.wrappers
 *
 * The functions of `ExportImportUtils.ts` that read or write a file, or take the values of a state, are wrappers
 * around the pure functions of `ExportFileFormatUtils.ts`. These tests prove that the wrappers still write and read
 * the bytes that they wrote and read before the split: `src/test/exportFileFormat/frozenOutputs.json` holds the text
 * that the unchanged functions produced at commit 6a1d26043 for the inputs of
 * `src/test/exportFileFormat/differentialCases.ts` (a fixed clock, a fixed state), and every case is compared byte for
 * byte. They also prove the one change: `saveJsonToFile` and `saveToFile` no longer change the object they are given.
 *
 * Hermetic: no network; files go to a temporary directory that is removed afterwards.
 */
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { jest } from '@jest/globals';
import { FrodoError } from '../ops/FrodoError';
import {
  combinationId,
  differentialCases,
  FILE_PATH_NAMES,
  FIXED_METADATA,
  FIXED_NOW,
  loadFrozenOutputs,
  makeFixedState,
  OPTION_COMBINATIONS,
  PLACEHOLDER_CONTENTS,
  PLACEHOLDER_STATE_VALUES,
  PROCESS_ENV_VALUES,
  SAVE_TO_FILE_CASES,
  SAVE_TO_FILE_OPTIONS,
  TYPED_FILENAME_CASES,
  WORKING_DIRECTORIES,
} from '../test/exportFileFormat/differentialCases';
import * as format from './ExportFileFormatUtils';
import {
  escapePlaceholders,
  getFilePath,
  getMetadata,
  getTypedFilename,
  readJsonFile,
  replaceEnvSpecificValues,
  saveJsonToFile,
  saveTextToFile,
  saveToFile,
  unescapePlaceholders,
} from './ExportImportUtils';

const frozen = loadFrozenOutputs();

let dir: string;
let counter = 0;

/**
 * A new file name in the temporary directory.
 * @returns {string} the path
 */
function nextFile(): string {
  counter += 1;
  return join(dir, `out-${counter}.json`);
}

beforeAll(() => {
  dir = fs.mkdtempSync(join(tmpdir(), 'frodo-lib-wrappers-'));
  jest.useFakeTimers({
    now: new Date(FIXED_NOW),
    doNotFake: [
      'nextTick',
      'setImmediate',
      'setTimeout',
      'setInterval',
      'queueMicrotask',
    ],
  });
});

afterAll(() => {
  jest.useRealTimers();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('the fixed state', () => {
  test('gives the metadata header that the frozen outputs hold', () => {
    expect(getMetadata({ state: makeFixedState() })).toEqual(FIXED_METADATA);
  });
});

describe('saveJsonToFile writes the bytes it wrote before the split', () => {
  const cases = differentialCases();

  test('the differential corpus has at least 200 cases and every case is in the frozen outputs', () => {
    expect(cases.length).toBeGreaterThanOrEqual(200);
    expect(Object.keys(frozen.saveJsonToFile.cases).sort()).toEqual(
      cases.map((c) => c.id).sort()
    );
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  test('every case, with every combination of includeMeta, keepRev and keepModifiedProperties, is byte-identical to the frozen text', () => {
    const state = makeFixedState();
    const mismatches: string[] = [];
    let compared = 0;
    for (const { id, data } of differentialCases()) {
      for (const options of OPTION_COMBINATIONS) {
        const file = nextFile();
        // a fresh copy for every combination: this test compares bytes, whatever the function does to its input
        saveJsonToFile({
          data: JSON.parse(JSON.stringify(data)),
          filename: file,
          ...options,
          state,
        });
        const expected =
          frozen.saveJsonToFile.texts[
            frozen.saveJsonToFile.cases[id][combinationId(options)]
          ];
        compared += 1;
        if (fs.readFileSync(file, 'utf8') !== expected) {
          mismatches.push(`${id} [${combinationId(options)}]`);
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(compared).toBe(cases.length * OPTION_COMBINATIONS.length);
  });

  test('the object that is saved is not changed: no meta added, no _rev or modified key removed', () => {
    const state = makeFixedState();
    const changed: string[] = [];
    for (const { id, data } of differentialCases()) {
      const before = differentialCases().find((c) => c.id === id)?.data;
      for (const options of OPTION_COMBINATIONS) {
        saveJsonToFile({ data, filename: nextFile(), ...options, state });
        if (JSON.stringify(data) !== JSON.stringify(before)) {
          changed.push(`${id} [${combinationId(options)}]`);
        }
      }
    }
    expect({ count: changed.length, first: changed.slice(0, 5) }).toEqual({
      count: 0,
      first: [],
    });
  });

  test('saving an object twice gives the same bytes twice and leaves the object as it was', () => {
    const state = makeFixedState();
    const data = { _rev: '1', name: 'a', modified: 1 };
    const first = nextFile();
    const second = nextFile();
    saveJsonToFile({ data, filename: first, state });
    saveJsonToFile({ data, filename: second, state });
    expect(fs.readFileSync(first, 'utf8')).toBe(
      fs.readFileSync(second, 'utf8')
    );
    expect(data).toEqual({ _rev: '1', name: 'a', modified: 1 });
  });

  test('an unwritable path throws a FrodoError that names the file and carries the original error', () => {
    const state = makeFixedState();
    const blocking = join(dir, 'blocking-file');
    fs.writeFileSync(blocking, 'not a directory');
    const filename = join(blocking, 'sub', 'out.json');
    const save = () => saveJsonToFile({ data: { a: 1 }, filename, state });
    expect(save).toThrow(FrodoError);
    expect(save).toThrow(
      expect.objectContaining({
        message: `Error saving ${filename}`,
        originalErrors: [expect.objectContaining({ syscall: 'mkdir' })],
      })
    );
  });

  test('data that cannot be turned into JSON throws, not a FrodoError, and writes nothing', () => {
    const state = makeFixedState();
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    const filename = nextFile();
    let thrown: unknown;
    try {
      saveJsonToFile({ data: circular, filename, state });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeDefined();
    expect(thrown).not.toBeInstanceOf(FrodoError);
    expect(fs.existsSync(filename)).toBe(false);
  });
});

describe('saveToFile writes the bytes it wrote before the split', () => {
  test('every case and switch is byte-identical to the frozen text', () => {
    const state = makeFixedState();
    const mismatches: string[] = [];
    let compared = 0;
    SAVE_TO_FILE_CASES.forEach(([type, identifier], index) => {
      for (const [
        includeMeta,
        keepModifiedProperties,
      ] of SAVE_TO_FILE_OPTIONS) {
        const data = JSON.parse(JSON.stringify(SAVE_TO_FILE_CASES[index][2]));
        const file = nextFile();
        saveToFile({
          type,
          data,
          identifier,
          filename: file,
          includeMeta,
          keepModifiedProperties,
          state,
        });
        const entry = frozen.saveToFile.find(
          (e) =>
            e.case === index &&
            e.includeMeta === includeMeta &&
            e.keepModifiedProperties === keepModifiedProperties
        );
        compared += 1;
        if (fs.readFileSync(file, 'utf8') !== entry?.text) {
          mismatches.push(
            `case ${index} [meta ${includeMeta}, modified ${keepModifiedProperties}]`
          );
        }
      }
    });
    expect(mismatches).toEqual([]);
    expect(compared).toBe(frozen.saveToFile.length);
  });

  test('the object that is saved is not changed, for an object and for an array', () => {
    const state = makeFixedState();
    const changed: number[] = [];
    SAVE_TO_FILE_CASES.forEach(([type, identifier, original], index) => {
      for (const [
        includeMeta,
        keepModifiedProperties,
      ] of SAVE_TO_FILE_OPTIONS) {
        const data = JSON.parse(JSON.stringify(original));
        saveToFile({
          type,
          data,
          identifier,
          filename: nextFile(),
          includeMeta,
          keepModifiedProperties,
          state,
        });
        if (JSON.stringify(data) !== JSON.stringify(original)) {
          changed.push(index);
        }
      }
    });
    expect({ count: changed.length, first: changed.slice(0, 5) }).toEqual({
      count: 0,
      first: [],
    });
  });

  test('an unwritable path throws a FrodoError that names the file', () => {
    const state = makeFixedState();
    const blocking = join(dir, 'blocking-file-2');
    fs.writeFileSync(blocking, 'not a directory');
    const filename = join(blocking, 'sub', 'out.json');
    expect(() =>
      saveToFile({
        type: 'script',
        data: { _id: 'a' },
        identifier: '_id',
        filename,
        state,
      })
    ).toThrow(expect.objectContaining({ message: `Error saving ${filename}` }));
  });
});

describe('saveTextToFile', () => {
  test('adds one newline to text that has none and none to text that has one', () => {
    const state = makeFixedState();
    const first = nextFile();
    const second = nextFile();
    saveTextToFile({ data: 'text', filename: first, state });
    saveTextToFile({ data: 'text\n', filename: second, state });
    expect(fs.readFileSync(first, 'utf8')).toBe('text\n');
    expect(fs.readFileSync(second, 'utf8')).toBe('text\n');
  });
});

describe('getTypedFilename', () => {
  test('is the function of the pure module (one definition)', () => {
    expect(getTypedFilename).toBe(format.getTypedFilename);
    expect(escapePlaceholders).toBe(format.escapePlaceholders);
    expect(unescapePlaceholders).toBe(format.unescapePlaceholders);
  });

  test('gives the frozen name for every case', () => {
    expect(frozen.getTypedFilename).toHaveLength(TYPED_FILENAME_CASES.length);
    const mismatches = frozen.getTypedFilename.filter((entry) => {
      const actual =
        entry.suffix === null
          ? getTypedFilename(entry.name, entry.type)
          : getTypedFilename(entry.name, entry.type, entry.suffix);
      return actual !== entry.result;
    });
    expect(mismatches).toEqual([]);
  });
});

describe('getFilePath', () => {
  test('gives the frozen path for every working directory and file name', () => {
    expect(frozen.getFilePath).toHaveLength(
      WORKING_DIRECTORIES.length * FILE_PATH_NAMES.length
    );
    const mismatches: string[] = [];
    for (const entry of frozen.getFilePath) {
      const state = makeFixedState();
      state.setDirectory(entry.directory);
      const actual = getFilePath({
        fileName: entry.fileName,
        mkdirs: false,
        state,
      });
      if (actual !== entry.result) {
        mismatches.push(`${entry.directory} + ${entry.fileName}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  test('creates the working directory and the folders of the file name when mkdirs is true, and only then', () => {
    const state = makeFixedState();
    const wd = join(dir, 'work', 'nested');
    state.setDirectory(wd);

    const noMkdirs = getFilePath({
      fileName: 'a/b/file.json',
      mkdirs: false,
      state,
    });
    expect(noMkdirs).toBe(`${wd}/a/b/file.json`);
    expect(fs.existsSync(wd)).toBe(false);

    const withMkdirs = getFilePath({
      fileName: 'a\\b\\file.json',
      mkdirs: true,
      state,
    });
    expect(withMkdirs).toBe(`${wd}/a/b/file.json`);
    expect(fs.existsSync(join(wd, 'a', 'b'))).toBe(true);
    expect(fs.existsSync(withMkdirs)).toBe(false);
  });

  test('creates the folders of the file name without a working directory', () => {
    const state = makeFixedState();
    const folder = join(dir, 'no-wd');
    const result = getFilePath({
      fileName: `${folder}/sub/file.json`,
      mkdirs: true,
      state,
    });
    expect(result).toBe(`${folder}/sub/file.json`);
    expect(fs.existsSync(join(folder, 'sub'))).toBe(true);
  });
});

describe('replaceEnvSpecificValues and readJsonFile', () => {
  afterEach(() => {
    for (const name of Object.keys(PROCESS_ENV_VALUES)) {
      delete process.env[name];
    }
  });

  test('every content gives the frozen result or the frozen error, with the process switch off and on', () => {
    for (const [name, value] of Object.entries(PROCESS_ENV_VALUES)) {
      process.env[name] = value;
    }
    expect(frozen.replaceEnvSpecificValues).toHaveLength(
      PLACEHOLDER_CONTENTS.length * 2
    );
    const mismatches: string[] = [];
    for (const entry of frozen.replaceEnvSpecificValues) {
      const state = makeFixedState();
      state.setEnvs(PLACEHOLDER_STATE_VALUES);
      state.setUseProcessEnvironmentForPlaceholders(entry.useProcess);
      let result: string | null = null;
      let error: string | null = null;
      try {
        result = replaceEnvSpecificValues({
          content: PLACEHOLDER_CONTENTS[entry.case],
          state,
        });
      } catch (e) {
        error = (e as Error).message;
      }
      if (result !== entry.result || error !== entry.error) {
        mismatches.push(`case ${entry.case} (process ${entry.useProcess})`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  test('a placeholder without a value is a FrodoError with the message and no cause', () => {
    const state = makeFixedState();
    let thrown: unknown;
    try {
      replaceEnvSpecificValues({ content: '"${UNKNOWN}"', state });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(FrodoError);
    expect((thrown as FrodoError).message).toBe(
      'No value found for placeholder "UNKNOWN"'
    );
    expect((thrown as FrodoError).originalErrors).toEqual([]);
  });

  test('readJsonFile gives the frozen result or the frozen error, with placeholders resolved and left alone', () => {
    const state = makeFixedState();
    state.setEnvs(PLACEHOLDER_STATE_VALUES);
    const mismatches: string[] = [];
    for (const entry of frozen.readJsonFile) {
      const file = nextFile();
      fs.writeFileSync(file, PLACEHOLDER_CONTENTS[entry.case]);
      let result: unknown = null;
      let error: string | null = null;
      try {
        result =
          readJsonFile({
            filePath: file,
            resolvePlaceholders: entry.resolvePlaceholders,
            state,
          }) ?? null;
      } catch (e) {
        error = (e as Error).message.replace(file, '<file>');
      }
      if (
        JSON.stringify(result) !== JSON.stringify(entry.result) ||
        error !== entry.error
      ) {
        mismatches.push(
          `case ${entry.case} (resolve ${entry.resolvePlaceholders})`
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  test('a file that cannot be read is a FrodoError that names the file and carries the original error', () => {
    const state = makeFixedState();
    const missing = join(dir, 'missing.json');
    let thrown: unknown;
    try {
      readJsonFile({ filePath: missing, state });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(FrodoError);
    expect((thrown as FrodoError).message).toBe(
      `Error reading file ${missing}`
    );
    expect((thrown as FrodoError).originalErrors).toEqual([
      expect.objectContaining({ code: 'ENOENT' }),
    ]);
  });

  test('a file that is not JSON is a FrodoError that names the file and carries the parse error', () => {
    const state = makeFixedState();
    const file = nextFile();
    fs.writeFileSync(file, '{not json');
    let thrown: unknown;
    try {
      readJsonFile({ filePath: file, state });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(FrodoError);
    expect((thrown as FrodoError).message).toBe(
      `Error parsing JSON from ${file}`
    );
    expect((thrown as FrodoError).originalErrors).toEqual([
      expect.any(SyntaxError),
    ]);
  });
});
