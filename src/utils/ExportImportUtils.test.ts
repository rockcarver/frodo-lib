import { state } from '../index';
import { resolve } from 'path';
import { rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import {
  convertTextArrayToBase64,
  convertBase64TextToArray,
  saveToFile,
  validateImport,
  readJsonFile,
  replaceEnvSpecificValues,
  escapePlaceholders,
  unescapePlaceholders,
} from './ExportImportUtils';
// Warning! implimentation file contains non determinisitc functions which are either; not reasonable to test or imposible
// Cause: date based non overidable functions
// Not tested: getCurrentTimestamp

const FS_TMP_DIR = resolve('.', 'test', 'fs_tmp');
const PATH_TO_ARTIFACT = resolve(FS_TMP_DIR, 'export.json');

test('convertBase64TextToArray returns an array of text lines in base64 encoding', () => {
  // Arrange
  const originalScript = `
    function frodo() {
      return 'ring to mt doom';
    }
  `;
  const base64Script = Buffer.from(originalScript).toString('base64');
  // Act
  const result = convertBase64TextToArray(base64Script);
  // Assert
  expect(result).toEqual(originalScript.split('\n'));
});

test('convertTextArrayToBase64', () => {
  // Arrange
  const originalArrayOfScriptLines = `
    function frodo() {
      return 'ring to mt doom';
    }
  `;
  const expected = Buffer.from(originalArrayOfScriptLines).toString('base64');
  // Act
  const result = convertTextArrayToBase64(
    originalArrayOfScriptLines.split('\n')
  );
  // Assert
  expect(result).toEqual(expected);
});

test('validateImport should always return true', () => {
  expect(validateImport(null)).not.toBe(false);
});

test('readJsonFile reads and parses a JSON file', () => {
  // Arrange
  if (!existsSync(FS_TMP_DIR)) {
    mkdirSync(FS_TMP_DIR, { recursive: true });
  }

  const content = { test: 'value' };
  writeFileSync(PATH_TO_ARTIFACT, JSON.stringify(content));

  // Act
  const result = readJsonFile({filePath: PATH_TO_ARTIFACT, state} );

  // Assert
  expect(result).toEqual(content);
});

test('readJsonFile reads and replaces environment variables in a JSON file', () => {
  // Arrange
  if (!existsSync(FS_TMP_DIR)) {
    mkdirSync(FS_TMP_DIR, { recursive: true });
  }

  state.setEnv('TEST_VALUE_ONE', 'frodo')
  state.setEnv('TEST_VALUE_TWO', 'sam')
  state.setEnv('TEST_VALUE_ESCAPED', 'gollum')
  state.setEnv('TEST_VALUE_BASE64', Buffer.from('ring bearer').toString('base64'))

  const content = {
    first: '${TEST_VALUE_ONE}',
    second: '${TEST_VALUE_TWO}',
    escaped: '\\${TEST_VALUE_ESCAPED}',
    encoded: '${BASE64:TEST_VALUE_BASE64}'
  }

  const expected = {
    first: 'frodo',
    second: 'sam',
    escaped: '${TEST_VALUE_ESCAPED}',
    encoded: 'ring bearer'
  }

  writeFileSync(PATH_TO_ARTIFACT, JSON.stringify(content))

  // Act
  const result = readJsonFile({filePath: PATH_TO_ARTIFACT, state})

  // Assert
  expect(result).toEqual(expected)

});

test('readJsonFile throws an error for an unknown placeholder', () => {
  // Arrange
  if (!existsSync(FS_TMP_DIR)) {
    mkdirSync(FS_TMP_DIR, { recursive: true });
  }

  const content = { test: '${UNKNOWN}' };
  writeFileSync(PATH_TO_ARTIFACT, JSON.stringify(content));

  // Act
  const readFile = () => readJsonFile({filePath: PATH_TO_ARTIFACT, state});

  // Assert
  expect(readFile).toThrow('No value found for placeholder "UNKNOWN"');
});

test('replaceEnvSpecificValues replaces environment placeholders', () => {
  // Arrange
  state.setEnv('TEST_VALUE', 'frodo');
  const content = '{"value":"${TEST_VALUE}"}';

  // Act
  const result = replaceEnvSpecificValues({content, state});

  // Assert
  expect(result).toEqual('{"value":"frodo"}');
});

test('escapePlaceholders escapes placeholders', () => {
  // Arrange
  const content = {
    value: '${TEST_VALUE}',
  };

  // Act
  const result = escapePlaceholders(content);

  // Assert
  expect(result).toEqual({
    value: '\\${TEST_VALUE}',
  });
});

test('unescapePlaceholders unescapes placeholders', () => {
  // Arrange
  const content = '\\\\${TEST_VALUE}';

  // Act
  const result = unescapePlaceholders(content);

  // Assert
  expect(result).toEqual('${TEST_VALUE}');
});