import { state } from '../index';
import { resolve } from 'path';
import { rmSync, existsSync, readFileSync } from 'fs';
import {
  convertTextArrayToBase64,
  convertBase64TextToArray,
  saveToFile,
  validateImport,
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
