/**
 * Run tests
 *
 *        npm run test:only -- src/utils/ExportImportUtils.processEnvironment
 *
 * Placeholders `${NAME}` in the files that the library reads are filled from the values of the state. With
 * `state.setUseProcessEnvironmentForPlaceholders(true)` a name that the state holds no value for is filled from the
 * environment variable of that name in the process (frodo-lib#1109); with the switch off, which is the default, nothing
 * changes for any caller. These tests prove both, with made-up variable names that are removed after every test.
 *
 * Hermetic: no network; the file test writes to a temporary directory of its own.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import State from '../shared/State';
import { readJsonFile, replaceEnvSpecificValues } from './ExportImportUtils';

const VARIABLES = [
  'FRODO_TEST_PE_ONE',
  'FRODO_TEST_PE_TWO',
  'FRODO_TEST_PE_ENCODED',
  'FRODO_TEST_PE_EMPTY',
  'FRODO_TEST_PE_ESCAPED',
  'FRODO_TEST_PE_BOTH',
];

let state: ReturnType<typeof State>;

beforeEach(() => {
  state = State({});
});

afterEach(() => {
  for (const name of VARIABLES) delete process.env[name];
});

describe('switch off (the default)', () => {
  test('1: a name that only the process environment has is not filled, and the error names it', () => {
    process.env.FRODO_TEST_PE_ONE = 'made-up-process-value';
    expect(() =>
      replaceEnvSpecificValues({
        content: '{"value":"${FRODO_TEST_PE_ONE}"}',
        state,
      })
    ).toThrow('No value found for placeholder "FRODO_TEST_PE_ONE"');
  });

  test('2: a value of the state is used as before', () => {
    state.setEnv('FRODO_TEST_PE_ONE', 'made-up-state-value');
    expect(
      replaceEnvSpecificValues({
        content: '{"value":"${FRODO_TEST_PE_ONE}"}',
        state,
      })
    ).toBe('{"value":"made-up-state-value"}');
  });

  test('3: the switch of another state does not leak into this one', () => {
    process.env.FRODO_TEST_PE_ONE = 'made-up-process-value';
    const other = State({});
    other.setUseProcessEnvironmentForPlaceholders(true);
    expect(() =>
      replaceEnvSpecificValues({
        content: '"${FRODO_TEST_PE_ONE}"',
        state,
      })
    ).toThrow('No value found for placeholder "FRODO_TEST_PE_ONE"');
  });
});

describe('switch on', () => {
  beforeEach(() => {
    state.setUseProcessEnvironmentForPlaceholders(true);
  });

  test('4: a name that only the process environment has is filled from it', () => {
    process.env.FRODO_TEST_PE_ONE = 'made-up-process-value';
    expect(
      replaceEnvSpecificValues({
        content: '{"value":"${FRODO_TEST_PE_ONE}"}',
        state,
      })
    ).toBe('{"value":"made-up-process-value"}');
  });

  test('5: the value of the state wins over the process environment', () => {
    process.env.FRODO_TEST_PE_BOTH = 'made-up-process-value';
    state.setEnv('FRODO_TEST_PE_BOTH', 'made-up-state-value');
    expect(
      replaceEnvSpecificValues({
        content: '{"value":"${FRODO_TEST_PE_BOTH}"}',
        state,
      })
    ).toBe('{"value":"made-up-state-value"}');
  });

  test('6: names from the state and from the process environment can be mixed in one file', () => {
    process.env.FRODO_TEST_PE_ONE = 'process-one';
    state.setEnv('FRODO_TEST_PE_TWO', 'state-two');
    expect(
      replaceEnvSpecificValues({
        content: '{"a":"${FRODO_TEST_PE_ONE}","b":"${FRODO_TEST_PE_TWO}"}',
        state,
      })
    ).toBe('{"a":"process-one","b":"state-two"}');
  });

  test('7: the BASE64 form decodes a value of the process environment', () => {
    process.env.FRODO_TEST_PE_ENCODED =
      Buffer.from('made up secret').toString('base64');
    expect(
      replaceEnvSpecificValues({
        content: '{"value":"${BASE64:FRODO_TEST_PE_ENCODED}"}',
        state,
      })
    ).toBe('{"value":"made up secret"}');
  });

  test('8: an empty variable is a value', () => {
    process.env.FRODO_TEST_PE_EMPTY = '';
    expect(
      replaceEnvSpecificValues({
        content: '{"value":"${FRODO_TEST_PE_EMPTY}"}',
        state,
      })
    ).toBe('{"value":""}');
  });

  test('9: a name that has no value anywhere still fails with an error that names it and holds no other value', () => {
    process.env.FRODO_TEST_PE_ONE = 'must-not-appear-in-a-message';
    let message = '';
    try {
      replaceEnvSpecificValues({
        content: '{"value":"${FRODO_TEST_PE_TWO}"}',
        state,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe('No value found for placeholder "FRODO_TEST_PE_TWO"');
    expect(message).not.toContain('must-not-appear-in-a-message');
  });

  test('10: a name of Object.prototype is no variable of the process: it fails like any unknown name', () => {
    // The map of values of a real state is a plain object and answers a name such as `constructor` itself (a quirk
    // that is older than the switch and unchanged by it), so the guard against the process environment is proven with
    // a state that holds no value at all.
    const empty = {
      getEnv: () => undefined,
      getUseProcessEnvironmentForPlaceholders: () => true,
    } as unknown as ReturnType<typeof State>;
    for (const name of [
      'constructor',
      'toString',
      'hasOwnProperty',
      'valueOf',
    ]) {
      expect(() =>
        replaceEnvSpecificValues({
          content: `{"value":"\${${name}}"}`,
          state: empty,
        })
      ).toThrow(`No value found for placeholder "${name}"`);
    }
  });

  test('11: an escaped placeholder stays literal although the process has a variable of that name', () => {
    process.env.FRODO_TEST_PE_ESCAPED = 'must-not-be-used';
    expect(
      replaceEnvSpecificValues({
        content: JSON.stringify({ value: '\\${FRODO_TEST_PE_ESCAPED}' }),
        state,
      })
    ).toBe('{"value":"${FRODO_TEST_PE_ESCAPED}"}');
  });

  test('12: a file is read with the fallback (readJsonFile)', () => {
    process.env.FRODO_TEST_PE_ONE = 'made-up-process-value';
    const directory = mkdtempSync(join(tmpdir(), 'frodo-placeholders-'));
    try {
      const file = join(directory, 'file.json');
      writeFileSync(file, JSON.stringify({ value: '${FRODO_TEST_PE_ONE}' }));
      expect(readJsonFile({ filePath: file, state })).toEqual({
        value: 'made-up-process-value',
      });
      // the file is not resolved when the caller says so
      expect(
        readJsonFile({ filePath: file, resolvePlaceholders: false, state })
      ).toEqual({ value: '${FRODO_TEST_PE_ONE}' });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('13: a state without the switch (a partial test double) means off', () => {
    process.env.FRODO_TEST_PE_ONE = 'made-up-process-value';
    const partial = { getEnv: () => undefined } as unknown as ReturnType<
      typeof State
    >;
    expect(() =>
      replaceEnvSpecificValues({
        content: '"${FRODO_TEST_PE_ONE}"',
        state: partial,
      })
    ).toThrow('No value found for placeholder "FRODO_TEST_PE_ONE"');
  });
});
