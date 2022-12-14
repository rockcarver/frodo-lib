import fs from 'fs';
import _ from 'lodash';
import {
  createTable,
  printMessage,
  createProgressIndicator,
  updateProgressIndicator,
  stopProgressIndicator,
} from './utils/Console';
import {
  getCirclesOfTrust,
  getCircleOfTrust,
  createCircleOfTrust,
} from '../api/CirclesOfTrustApi';
import {
  getRealmString,
  getTypedFilename,
  saveJsonToFile,
  validateImport,
} from './utils/ExportImportUtils';

// use a function vs a template variable to avoid problems in loops
function getFileDataTemplate() {
  return {
    meta: {},
    script: {},
    saml: {
      hosted: {},
      remote: {},
      metadata: {},
      cot: {},
    },
  };
}

/**
 * List entity providers
 * @param {String} long Long list format with details
 */
export async function listCirclesOfTrust(long = false) {
  let cotList = [];
  try {
    cotList = (await getCirclesOfTrust()).result;
  } catch (error) {
    printMessage(`getCirclesOfTrust ERROR: ${error}`, 'error');
    printMessage(error, 'data');
  }
  cotList.sort((a, b) => a._id.localeCompare(b._id));
  if (!long) {
    cotList.forEach((cot) => {
      printMessage(`${cot._id}`, 'data');
    });
  } else {
    const table = createTable([
      'Name'['brightCyan'],
      'Description'['brightCyan'],
      'Status'['brightCyan'],
      'Trusted Providers'['brightCyan'],
    ]);
    cotList.forEach((cot) => {
      table.push([
        cot._id,
        cot.description,
        cot.status,
        cot.trustedProviders
          .map((provider) => provider.split('|')[0])
          .join('\n'),
      ]);
    });
    printMessage(table.toString());
  }
}

/**
 * Include dependencies in the export file
 * @param {Object} cotData Object representing a SAML circle of trust
 * @param {Object} fileData File data object to add dependencies to
 */
async function exportDependencies(cotData, fileData) {
  // TODO: Export dependencies
  return [cotData, fileData];
}

/**
 * Export a single circle of trust to file
 * @param {String} cotId circle of trust id/name
 * @param {String} file Optional filename
 */
export async function exportCircleOfTrust(cotId, file = null) {
  let fileName = file;
  if (!fileName) {
    fileName = getTypedFilename(cotId, 'cot.saml');
  }
  createProgressIndicator(1, `Exporting circle of trust ${cotId}`);
  try {
    const cotData = _.cloneDeep(getCircleOfTrust(cotId));
    delete cotData['_rev'];
    updateProgressIndicator(`Exporting ${cotId}`);
    const fileData = getFileDataTemplate();
    fileData.saml.cot[cotId] = cotData;
    await exportDependencies(cotData, fileData);
    saveJsonToFile(fileData, fileName);
    stopProgressIndicator(
      `Exported ${cotId.brightCyan} to ${fileName.brightCyan}.`
    );
  } catch (err) {
    stopProgressIndicator(`${err}`);
    printMessage(err, 'error');
  }
}

/**
 * Export all circles of trust to one file
 * @param {String} file Optional filename
 */
export async function exportCirclesOfTrustToFile(file = null) {
  let fileName = file;
  if (!fileName) {
    fileName = getTypedFilename(
      `all${getRealmString()}CirclesOfTrust`,
      'cot.saml'
    );
  }
  const fileData = getFileDataTemplate();
  let allCotData = [];
  try {
    allCotData = _.cloneDeep((await getCirclesOfTrust()).result);
    createProgressIndicator(allCotData.length, 'Exporting circles of trust');
    for (const cotData of allCotData) {
      delete cotData._rev;
      updateProgressIndicator(`Exporting circle of trust ${cotData._id}`);
      // eslint-disable-next-line no-await-in-loop
      await exportDependencies(cotData, fileData);
      fileData.saml.cot[cotData._id] = cotData;
    }
    saveJsonToFile(fileData, fileName);
    stopProgressIndicator(
      `${allCotData.length} circle(s) of trust exported to ${fileName}.`
    );
  } catch (error) {
    printMessage(`getCirclesOfTrust ERROR: ${error}`, 'error');
    printMessage(error, 'data');
  }
}

/**
 * Export all circles of trust to individual files
 */
export async function exportCirclesOfTrustToFiles() {
  let allCotData = [];
  try {
    allCotData = _.cloneDeep((await getCirclesOfTrust()).result);
    createProgressIndicator(allCotData.length, 'Exporting circles of trust');
    for (const cotData of allCotData) {
      delete cotData._rev;
      updateProgressIndicator(`Exporting circle of trust ${cotData._id}`);
      const fileName = getTypedFilename(cotData._id, 'cot.saml');
      const fileData = getFileDataTemplate();
      // eslint-disable-next-line no-await-in-loop
      await exportDependencies(cotData, fileData);
      fileData.saml.cot[cotData._id] = cotData;
      saveJsonToFile(fileData, fileName);
    }
    stopProgressIndicator(`${allCotData.length} providers exported.`);
  } catch (error) {
    printMessage(`getCirclesOfTrust ERROR: ${error}`, 'error');
    printMessage(error, 'data');
  }
}

/**
 * Include dependencies from the import file
 * @param {Object} cotData Object representing a SAML circle of trust
 * @param {Object} fileData File data object to read dependencies from
 */
async function importDependencies(cotData, fileData) {
  // TODO: Import dependencies
  return [cotData, fileData];
}

/**
 * Import a SAML circle of trust by id/name from file
 * @param {String} cotId Circle of trust id/name
 * @param {String} file Import file name
 */
export async function importCircleOfTrust(cotId, file) {
  fs.readFile(file, 'utf8', async (err, data) => {
    if (err) throw err;
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      createProgressIndicator(1, 'Importing circle of trust...');
      const cotData = _.get(fileData, ['saml', 'cot', cotId]);
      if (cotData) {
        updateProgressIndicator(`Importing ${cotId}`);
        await importDependencies(cotData, fileData);
        try {
          await createCircleOfTrust(cotData);
          stopProgressIndicator(`Successfully imported ${cotId}.`);
        } catch (createProviderErr) {
          stopProgressIndicator(`Error importing ${cotId}.`);
          printMessage(`Error importing ${cotId}`, 'error');
          printMessage(createProviderErr.response.data, 'error');
        }
      } else {
        stopProgressIndicator(
          `Circle of trust ${cotId.brightCyan} not found in ${file.brightCyan}!`
        );
      }
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

/**
 * Import first SAML circle of trust from file
 * @param {String} file Import file name
 */
export async function importFirstCircleOfTrust(file) {
  fs.readFile(file, 'utf8', async (err, data) => {
    if (err) throw err;
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      createProgressIndicator(1, 'Importing circle of trust...');
      for (const cotId in fileData.saml.cot) {
        if ({}.hasOwnProperty.call(fileData.saml.cot, cotId)) {
          const cotData = _.cloneDeep(fileData.saml.cot[cotId]);
          updateProgressIndicator(`Importing ${cotId}`);
          // eslint-disable-next-line no-await-in-loop
          await importDependencies(cotData, fileData);
          try {
            await createCircleOfTrust(cotData);
            stopProgressIndicator(`Successfully imported ${cotId}.`);
          } catch (createCircleOfTrustErr) {
            stopProgressIndicator(`Error importing ${cotId}.`);
            printMessage(`Error importing ${cotId}`, 'error');
            printMessage(createCircleOfTrustErr.response.data, 'error');
          }
          break;
        }
      }
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

/**
 * Import all SAML circles of trust from file
 * @param {String} file Import file name
 */
export async function importCirclesOfTrustFromFile(file) {
  fs.readFile(file, 'utf8', async (err, data) => {
    if (err) throw err;
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      createProgressIndicator(
        Object.keys(fileData.saml.cot).length,
        'Importing circles of trust...'
      );
      for (const cotId in fileData.saml.cot) {
        if ({}.hasOwnProperty.call(fileData.saml.cot, cotId)) {
          const cotData = _.cloneDeep(fileData.saml.cot[cotId]);
          // eslint-disable-next-line no-await-in-loop
          await importDependencies(cotData, fileData);
          try {
            // eslint-disable-next-line no-await-in-loop
            await createCircleOfTrust(cotData);
            updateProgressIndicator(`Imported ${cotId}`);
          } catch (createCircleOfTrustErr) {
            printMessage(`\nError importing ${cotId}`, 'error');
            printMessage(createCircleOfTrustErr.response.data, 'error');
          }
        }
      }
      stopProgressIndicator(`Circles of trust imported.`);
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

/**
 * Import all SAML circles of trust from all *.cot.saml.json files in the current directory
 */
export async function importCirclesOfTrustFromFiles() {
  const names = fs.readdirSync('.');
  const jsonFiles = names.filter((name) =>
    name.toLowerCase().endsWith('.cot.saml.json')
  );
  createProgressIndicator(jsonFiles.length, 'Importing circles or trust...');
  let total = 0;
  let totalErrors = 0;
  for (const file of jsonFiles) {
    const data = fs.readFileSync(file, 'utf8');
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      total += _.keys(fileData.saml.cot).length;
      let errors = 0;
      for (const cotId in fileData.saml.cot) {
        if ({}.hasOwnProperty.call(fileData.saml.cot, cotId)) {
          const cotData = _.cloneDeep(fileData.saml.cot[cotId]);
          // eslint-disable-next-line no-await-in-loop
          await importDependencies(cotData, fileData);
          try {
            // eslint-disable-next-line no-await-in-loop
            await createCircleOfTrust(cotData);
            // updateProgressIndicator(`Imported ${cotId}`);
          } catch (createCircleOfTrustErr) {
            errors += 1;
            printMessage(`\nError importing ${cotId}`, 'error');
            printMessage(createCircleOfTrustErr.response.data, 'error');
          }
        }
      }
      totalErrors += errors;
      updateProgressIndicator(
        `Imported ${
          _.keys(fileData.saml.cot).length - errors
        } circle(s) of trust from ${file}`
      );
    } else {
      printMessage(`Validation of ${file} failed!`, 'error');
    }
  }
  stopProgressIndicator(
    `Imported ${total - totalErrors} of ${total} circle(s) of trust from ${
      jsonFiles.length
    } file(s).`
  );
}
