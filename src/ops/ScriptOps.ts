import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { applyNameCollisionPolicy } from './utils/OpsUtils';
import {
  createProgressIndicator,
  createTable,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from './utils/Console';
import {
  getScriptByName,
  getScripts,
  putScript,
  Script,
} from '../api/ScriptApi';
import wordwrap from './utils/Wordwrap';
import {
  convertBase64TextToArray,
  convertTextArrayToBase64,
  getTypedFilename,
  saveTextToFile,
  saveToFile,
  titleCase,
  validateImport,
} from './utils/ExportImportUtils';
import * as state from '../shared/State';
import { decode, encode } from '../api/utils/Base64';
import chokidar from 'chokidar';

type SavedScript = Omit<Script, 'script'> & { script: string[] };
/**
 * List scripts
 */
export async function listScripts(long = false) {
  try {
    const scripts = (await getScripts()).result;

    scripts.sort((a, b) => a.name.localeCompare(b.name));
    if (long) {
      const table = createTable([
        'Name',
        'UUID',
        'Language',
        'Context',
        'Description',
      ]);
      const langMap = { JAVASCRIPT: 'JS', GROOVY: 'Groovy' };
      scripts.forEach((script) => {
        table.push([
          wordwrap(script.name, 25, '  '),
          script._id,
          langMap[script.language],
          wordwrap(titleCase(script.context.split('_').join(' ')), 25),
          wordwrap(script.description, 30),
        ]);
      });
      printMessage(table.toString(), 'data');
    } else {
      scripts.forEach((script) => {
        printMessage(`${script.name}`, 'data');
      });
    }
  } catch (error) {
    printMessage(`Error listing scripts - ${error}`, 'error');
  }
}

/**
 * Export script to file
 * @param {String} name script name
 * @param {String} file file name
 */
export async function exportScriptByName(name, file) {
  let fileName = getTypedFilename(name, 'script');
  if (file) {
    fileName = file;
  }
  const scriptData = (await getScriptByName(name)).result;
  if (scriptData.length > 1) {
    printMessage(`Multiple scripts with name ${name} found...`, 'error');
  }
  const scriptsToSave: SavedScript[] = scriptData.map((element) => {
    const scriptTextArray = convertBase64TextToArray(element.script);
    // eslint-disable-next-line no-param-reassign

    return {
      ...element,
      script: scriptTextArray,
    };
  });
  saveToFile('script', scriptsToSave, '_id', fileName);
}

/**
 * Export all scripts to single file
 * @param {String} file file name
 */
export async function exportScriptsToFile(file) {
  let fileName = getTypedFilename(`all${state.getRealm()}Scripts`, 'script');
  if (file) {
    fileName = file;
  }
  const scriptList = (await getScripts()).result;
  const allScriptsData: SavedScript[] = [];
  createProgressIndicator(scriptList.length, 'Exporting script');
  for (const item of scriptList) {
    updateProgressIndicator(`Reading script ${item.name}`);
    // eslint-disable-next-line no-await-in-loop
    const scriptData = (await getScriptByName(item.name)).result;
    scriptData.forEach((element) => {
      const scriptTextArray = convertBase64TextToArray(element.script);
      allScriptsData.push({
        ...element,
        script: scriptTextArray,
      });
    });
  }
  stopProgressIndicator('Done');
  saveToFile('script', allScriptsData, '_id', fileName);
}

function assertSingleScript(scripts: Script[]): asserts scripts is [Script] {
  if (scripts.length === 0) {
    throw new Error('No script found');
  }
  if (scripts.length > 1) {
    throw new Error('Multiple scripts found');
  }
}

/**
 * Export all scripts to individual files
 */
export async function exportScriptsToFiles() {
  const scriptList = (await getScripts()).result;
  createProgressIndicator(scriptList.length, 'Exporting script');
  for (const item of scriptList) {
    updateProgressIndicator(`Reading script ${item.name}`);

    const scriptData = (await getScriptByName(item.name)).result;
    assertSingleScript(scriptData);
    exportScript(scriptData[0]);
  }
  stopProgressIndicator('Done');
}

/**
 * Export script to an individual file
 *
 * @param script The script to export
 */
function exportScript(script: Script) {
  const scriptTextArray = convertBase64TextToArray(script.script);

  const scriptWithTextArray = {
    ...script,
    script: scriptTextArray,
  };

  const fileName = getTypedFilename(scriptWithTextArray.name, 'script');

  saveToFile('script', [scriptWithTextArray], '_id', fileName);
}

/**
 * Export all scripts to 2 files: one script file and one metadata file
 */
export async function exportScriptsExtract() {
  const scriptList = (await getScripts()).result;
  createProgressIndicator(scriptList.length, 'Exporting script');
  for (const item of scriptList) {
    updateProgressIndicator(`Reading script ${item.name}`);

    const scriptData = (await getScriptByName(item.name)).result;
    assertSingleScript(scriptData);
    const scriptToExport = scriptData[0];
    exportScriptExtract(scriptToExport);
  }
  stopProgressIndicator('Done');
}

/**
 * Export script to 2 files: one script file and one metadata file
 *
 * @param script The script to export
 */
function exportScriptExtract(script: Script) {
  const fileExtension = script.language === 'JAVASCRIPT' ? 'js' : 'groovy';
  const scriptFileName = getTypedFilename(script.name, 'script', fileExtension);

  const scriptText = decode(script.script);
  script.script = scriptFileName;

  saveTextToFile(scriptText, scriptFileName);
  const fileName = getTypedFilename(script.name, 'meta');
  saveToFile('script', [script], '_id', fileName);
}

/**
 * Import script
 * @param {String} id script uuid
 * @param {Object} data script object
 * @returns {Object} a status object
 */
export async function createOrUpdateScript(
  id: string,
  data: Script
): Promise<any> {
  try {
    await putScript(id, data);
    return { error: false, name: data.name };
  } catch (e) {
    if (e.response?.status === 409) {
      printMessage(
        `createOrUpdateScript WARNING: script with name ${data.name} already exists, using renaming policy... <name> => <name - imported (n)>`,
        'warn'
      );
      const newName = applyNameCollisionPolicy(data.name);
      // console.log(newName);
      printMessage(`Trying to save script as ${newName}`, 'warn');
      // eslint-disable-next-line no-param-reassign
      data.name = newName;
      await createOrUpdateScript(id, data);
      return { error: false, name: data.name };
    }
    printMessage(
      `createOrUpdateScript ERROR: put script error, script ${id} - ${e.message}`,
      'error'
    );
    return { error: true, name: data.name };
  }
}

export async function importScriptsFromFile(name, file, reUuid = false) {
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) throw err;
    const scriptData = JSON.parse(data);
    if (validateImport(scriptData.meta)) {
      createProgressIndicator(Object.keys(scriptData.script).length, '');
      for (const existingId in scriptData.script) {
        if ({}.hasOwnProperty.call(scriptData.script, existingId)) {
          let newId = existingId;
          // console.log(id);
          const encodedScript = convertTextArrayToBase64(
            scriptData.script[existingId].script
          );
          scriptData.script[existingId].script = encodedScript;
          if (reUuid) {
            newId = uuidv4();
            // printMessage(
            //   `Re-uuid-ing script ${scriptData.script[existingId].name} ${existingId} => ${newId}...`
            // );
            scriptData.script[existingId]._id = newId;
          }
          if (name) {
            // printMessage(
            //   `Renaming script ${scriptData.script[existingId].name} => ${options.script}...`
            // );
            scriptData.script[existingId].name = name;
          }
          updateProgressIndicator(
            `Importing ${scriptData.script[existingId].name}`
          );
          // console.log(scriptData.script[id]);
          createOrUpdateScript(newId, scriptData.script[existingId]).then(
            (result) => {
              if (result == null)
                printMessage(
                  `Error importing ${scriptData.script[existingId].name}`,
                  'error'
                );
            }
          );
          if (name) break;
        }
      }
      stopProgressIndicator('Done');
      // printMessage('Done');
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

/**
 * Import extracted scripts.
 *
 * @param watch whether or not to watch for file changes
 */
export async function importExtractedScripts(watch?: boolean) {
  /**
   * Run on file change detection.
   */
  function onChange(path: string, _stats?: fs.Stats): void {
    handleExtractedScriptFileImport(path);
  }

  // We watch both the meta.json files and the script files.

  chokidar
    .watch([`./**/*.json`, `./**/*.js`], {
      persistent: watch,
    })
    .on('add', onChange)
    .on('change', onChange)
    .on('ready', () => {
      if (watch) {
        printMessage('Watching for changes...');
      } else {
        printMessage('Done');
      }
    });
}

async function handleExtractedScriptFileImport(file: string) {
  const script = extractedScriptFileToScript(file);
  await importScript(script);
}

async function importScript(script: Script) {
  await createOrUpdateScript(script._id, script);
}

function extractedScriptFileToScript(metaFile: string) {
  const metaRaw = fs.readFileSync(metaFile, 'utf8');
  const meta = JSON.parse(metaRaw) as Script;
  const scriptFile = meta.script;
  const scriptRaw = fs.readFileSync(scriptFile, 'utf8');
  const script = encode(scriptRaw);
  meta.script = script;
  return meta;
}
