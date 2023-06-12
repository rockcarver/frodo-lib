import { state } from '../../index';
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

// This function has no way to determine when its asnyc task is complete, suggest using callback or promises to allow for testing
describe.skip('file system based tests', () => {
  afterAll(() => {
    if (existsSync(PATH_TO_ARTIFACT)) {
      rmSync(PATH_TO_ARTIFACT);
    }
  });

  test('saveToFile should save a file to specified tmp directory with expected data format', async () => {
    // Arrange
    const id = `id-3021`;
    const data = [
      {
        id,
        location: 'The Shire',
        character: 'Gandalf',
        words: 1064,
      },
    ];

    const expected = {
      lotr: {
        'id-3021': {
          id: 'id-3021',
          location: 'The Shire',
          character: 'Gandalf',
          words: 1064,
        },
      },
    };
    // Act
    saveToFile({
      type: 'lotr',
      data,
      identifier: 'id',
      filename: PATH_TO_ARTIFACT,
      state,
    });
    const resultingJSON = JSON.parse(readFileSync(PATH_TO_ARTIFACT, 'utf8'));
    // Assert
    expect(resultingJSON.lotr).toEqual(expected.lotr);
  });

  test('saveToFile should save a file with metadata', async () => {
    // Arrange
    const id = `id-3021`;
    const data = [
      {
        id,
        location: 'The Shire',
        character: 'Gandalf',
        words: 1064,
      },
    ];
    // Act
    saveToFile({
      type: 'lotr',
      data,
      identifier: 'id',
      filename: PATH_TO_ARTIFACT,
      state,
    });
    const resultingJSON = JSON.parse(readFileSync(PATH_TO_ARTIFACT, 'utf8'));
    // Assert
    expect(Object.keys(resultingJSON.meta)).toEqual([
      'origin',
      'exportedBy',
      'exportDate',
      'exportTool',
      'exportToolVersion',
    ]);
  });
});
