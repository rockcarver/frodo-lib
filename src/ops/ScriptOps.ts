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
import { getScriptByName, getScripts, putScript } from '../api/ScriptApi';
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
import { ScriptSkeleton } from '../api/ApiTypes';
import { validateScript } from './utils/ValidationUtils';
import { ScriptExportInterface } from './OpsTypes';

type ScriptWithScriptArray = Omit<ScriptSkeleton, 'script'> & {
  script: string[];
};

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
 * @param name script name
 * @param file file name
 */
export async function exportScriptByName(name: string, file: string) {
  let fileName = getTypedFilename(name, 'script');
  if (file) {
    fileName = file;
  }
  const scriptData = (await getScriptByName(name)).result;
  if (scriptData.length > 1) {
    printMessage(`Multiple scripts with name ${name} found...`, 'error');
  }
  const scriptsToSave: ScriptWithScriptArray[] = scriptData.map((element) => {
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
 * @param file file name
 */
export async function exportScriptsToFile(file: string): Promise<void> {
  let fileName = getTypedFilename(`all${state.getRealm()}Scripts`, 'script');
  if (file) {
    fileName = file;
  }
  const scriptList = (await getScripts()).result;
  const allScriptsData: ScriptWithScriptArray[] = [];
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

/**
 * Export all scripts to multiple files
 */
export async function exportScriptsToFiles(extract?: boolean) {
  const scriptList = (await getScripts()).result;
  createProgressIndicator(scriptList.length, 'Exporting script');
  for (const item of scriptList) {
    updateProgressIndicator(`Reading script ${item.name}`);

    const scriptData = (await getScriptByName(item.name)).result;
    assertSingleScript(scriptData);
    exportScript(scriptData[0], extract);
  }
  stopProgressIndicator('Done');
}

function assertSingleScript(
  scripts: ScriptSkeleton[]
): asserts scripts is [ScriptSkeleton] {
  if (scripts.length === 0) {
    throw new Error('No script found');
  }
  if (scripts.length > 1) {
    throw new Error('Multiple scripts found');
  }
}

/**
 * Export script to file(s)
 *
 * @param script The script to export
 */
function exportScript(script: ScriptSkeleton, extract = false) {
  if (extract) {
    exportScriptExtract(script);
  } else {
    exportScriptWithTextArray(script);
  }
}

function exportScriptWithTextArray(script: ScriptSkeleton): void {
  const scriptTextArray = convertBase64TextToArray(script.script);

  const scriptWithTextArray = {
    ...script,
    script: scriptTextArray,
  };

  const fileName = getTypedFilename(scriptWithTextArray.name, 'script');

  saveToFile('script', [scriptWithTextArray], '_id', fileName);
}

/**
 * Export script to 2 files: one script file and one metadata file
 *
 * @param script The script to export
 */
function exportScriptExtract(script: ScriptSkeleton) {
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
  data: ScriptSkeleton
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

export async function importScriptsFromFile(
  name: string,
  file: string,
  reUuid = false
) {
  const data = fs.readFileSync(file, 'utf8');

  const scriptData = JSON.parse(data);
  if (!validateImport(scriptData.meta)) {
    printMessage('Import validation failed...', 'error');
    return;
  }

  createProgressIndicator(Object.keys(scriptData.script).length, '');
  for (const existingId in scriptData.script) {
    if (!{}.hasOwnProperty.call(scriptData.script, existingId)) {
      continue;
    }

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
    updateProgressIndicator(`Importing ${scriptData.script[existingId].name}`);
    // console.log(scriptData.script[id]);
    const result = await createOrUpdateScript(
      newId,
      scriptData.script[existingId]
    );

    if (result == null) {
      printMessage(
        `Error importing ${scriptData.script[existingId].name}`,
        'error'
      );
    }

    if (name) {
      break;
    }
  }
  stopProgressIndicator('Done');
  // printMessage('Done');
}

/**
 * Import extracted scripts.
 *
 * @param watch whether or not to watch for file changes
 */
export async function importScriptsFromFiles(watch?: boolean) {
  /**
   * Run on file change detection, as well as on initial run.
   */
  function onChange(path: string, _stats?: fs.Stats): void {
    handleScriptFileImport(path);
  }

  // We watch json files and script files.
  chokidar
    .watch([`./**/*.json`, `./**/*.js`, `./**/*.groovy`], {
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

async function handleScriptFileImport(file: string) {
  const script = getScriptByPath(file);
  if (validateScript(script)) {
    await importScript(script);
    printMessage(`Imported script: ${file}`);
  } else {
    printMessage(`Invalid script: ${file}, skipped`, 'error');
  }
}

async function importScript(script: ScriptSkeleton) {
  await createOrUpdateScript(script._id, script);
}

function getScriptByPath(file: string): ScriptSkeleton {
  if (file.endsWith('.meta.json')) {
    return getScriptByMetaFile(file);
  } else if (file.endsWith('.json')) {
    return getScriptByJsonFile(file);
  }
  // Assume this is a script file.
  return getScriptByScriptFile(file);
}

function getScriptByMetaFile(metaFile: string): ScriptSkeleton {
  const scriptData = getScriptData(metaFile);
  const scriptFile = scriptData.script;

  const scriptRaw = fs.readFileSync(scriptFile, 'utf8');
  const script = encode(scriptRaw);
  scriptData.script = script;
  return scriptData;
}

function getScriptByScriptFile(scriptFile: string): ScriptSkeleton {
  // Anything that ends with .script.js or .script.groovy is a script file.
  const metaFile = scriptFile.replace(/\.script\.[^.]+$/, '.meta.json');
  const scriptData = getScriptData(metaFile);

  if (scriptData.script !== scriptFile) {
    throw new Error(
      `Expected script file ${scriptData.script}, found ${scriptFile}`
    );
  }

  const scriptRaw = fs.readFileSync(scriptFile, 'utf8');
  const script = encode(scriptRaw);
  scriptData.script = script;
  return scriptData;
}

function getScriptByJsonFile(jsonFile: string): ScriptSkeleton {
  const scriptData = getScriptData(jsonFile);
  return scriptData;
}

function getScriptData(file: string): ScriptSkeleton {
  const scriptExportRaw = fs.readFileSync(file, 'utf8');
  const scriptExport = JSON.parse(scriptExportRaw) as ScriptExportInterface;

  const scriptIds = Object.keys(scriptExport.script);

  if (scriptIds.length !== 1) {
    throw new Error(`Expected 1 script in ${file}, found ${scriptIds.length}`);
  }
  const scriptId = scriptIds[0];
  const scriptData = scriptExport.script[scriptId];

  return scriptData;
}
