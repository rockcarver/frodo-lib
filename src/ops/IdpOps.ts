import fs from 'fs';
import {
  getSocialIdentityProviders,
  putProviderByTypeAndId,
} from '../api/SocialIdentityProvidersApi';
import { getScript } from '../api/ScriptApi';
import { createOrUpdateScript } from './ScriptOps';
import {
  convertBase64TextToArray,
  convertTextArrayToBase64,
  getRealmString,
  getTypedFilename,
  saveJsonToFile,
  validateImport,
} from './utils/ExportImportUtils';
import {
  printMessage,
  createProgressIndicator,
  updateProgressIndicator,
  stopProgressIndicator,
} from './utils/Console';

// use a function vs a template variable to avoid problems in loops
function getFileDataTemplate() {
  return {
    meta: {},
    script: {},
    idp: {},
  };
}

/**
 * List providers
 */
export async function listSocialProviders() {
  try {
    const providers = await getSocialIdentityProviders();
    providers.result.sort((a, b) => a._id.localeCompare(b._id));
    providers.result.forEach((socialIdentityProvider) => {
      printMessage(`${socialIdentityProvider._id}`, 'data');
    });
  } catch (err) {
    printMessage(`listSocialProviders ERROR: ${err.message}`, 'error');
    printMessage(err, 'error');
  }
}

/**
 * Get social identity provider by id
 * @param {String} providerId social identity provider id/name
 * @returns {Promise} a promise that resolves a social identity provider object
 */
export async function getSocialProvider(providerId) {
  return getSocialIdentityProviders().then((response) => {
    const foundProviders = response.result.filter(
      (provider) => provider._id === providerId
    );
    switch (foundProviders.length) {
      case 1:
        return foundProviders[0];
      case 0:
        throw new Error(`Provider '${providerId}' not found`);
      default:
        throw new Error(
          `${foundProviders.length} providers '${providerId}' found`
        );
    }
  });
}

/**
 * Export provider by id
 * @param {String} providerId provider id/name
 * @param {String} file optional export file name
 */
export async function exportSocialProviderToFile(providerId, file = '') {
  let fileName = file;
  if (!fileName) {
    fileName = getTypedFilename(providerId, 'idp');
  }
  createProgressIndicator(1, `Exporting ${providerId}`);
  try {
    const idpData = await getSocialProvider(providerId);
    updateProgressIndicator(`Writing file ${fileName}`);
    const fileData = getFileDataTemplate();
    fileData.idp[idpData._id] = idpData;
    if (idpData.transform) {
      const scriptData = await getScript(idpData.transform);
      scriptData.script = convertBase64TextToArray(scriptData.script);
      fileData.script[idpData.transform] = scriptData;
    }
    saveJsonToFile(fileData, fileName);
    stopProgressIndicator(
      `Exported ${providerId['brightCyan']} to ${fileName['brightCyan']}.`
    );
  } catch (err) {
    stopProgressIndicator(`${err}`);
    printMessage(`${err}`, 'error');
  }
}

/**
 * Export all providers
 * @param {String} file optional export file name
 */
export async function exportSocialProvidersToFile(file) {
  let fileName = file;
  if (!fileName) {
    fileName = getTypedFilename(`all${getRealmString()}Providers`, 'idp');
  }
  const fileData = getFileDataTemplate();
  const allIdpsData = (await getSocialIdentityProviders()).result;
  createProgressIndicator(allIdpsData.length, 'Exporting providers');
  for (const idpData of allIdpsData) {
    updateProgressIndicator(`Exporting provider ${idpData._id}`);
    fileData.idp[idpData._id] = idpData;
    if (idpData.transform) {
      // eslint-disable-next-line no-await-in-loop
      const scriptData = await getScript(idpData.transform);
      scriptData.script = convertBase64TextToArray(scriptData.script);
      fileData.script[idpData.transform] = scriptData;
    }
  }
  saveJsonToFile(fileData, fileName);
  stopProgressIndicator(
    `${allIdpsData.length} providers exported to ${fileName}.`
  );
}

/**
 * Export all providers to individual files
 */
export async function exportSocialProvidersToFiles() {
  const allIdpsData = await (await getSocialIdentityProviders()).result;
  // printMessage(allIdpsData, 'data');
  createProgressIndicator(allIdpsData.length, 'Exporting providers');
  for (const idpData of allIdpsData) {
    updateProgressIndicator(`Writing provider ${idpData._id}`);
    const fileName = getTypedFilename(idpData._id, 'idp');
    const fileData = getFileDataTemplate();
    fileData.idp[idpData._id] = idpData;
    if (idpData.transform) {
      // eslint-disable-next-line no-await-in-loop
      const scriptData = await getScript(idpData.transform);
      scriptData.script = convertBase64TextToArray(scriptData.script);
      fileData.script[idpData.transform] = scriptData;
    }
    saveJsonToFile(fileData, fileName);
  }
  stopProgressIndicator(`${allIdpsData.length} providers exported.`);
}

/**
 * Import provider by id/name
 * @param {String} providerId provider id/name
 * @param {String} file import file name
 */
export async function importSocialProviderFromFile(providerId, file) {
  fs.readFile(file, 'utf8', async (err, data) => {
    if (err) throw err;
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      createProgressIndicator(1, 'Importing provider...');
      let found = false;
      for (const idpId in fileData.idp) {
        if ({}.hasOwnProperty.call(fileData.idp, idpId)) {
          if (idpId === providerId) {
            found = true;
            updateProgressIndicator(`Importing ${fileData.idp[idpId]._id}`);
            const scriptId = fileData.idp[idpId].transform;
            const scriptData = fileData.script[scriptId];
            if (scriptId && scriptData) {
              scriptData.script = convertTextArrayToBase64(scriptData.script);
              // eslint-disable-next-line no-await-in-loop
              await createOrUpdateScript(
                fileData.idp[idpId].transform,
                fileData.script[fileData.idp[idpId].transform]
              );
            }
            putProviderByTypeAndId(
              fileData.idp[idpId]._type._id,
              idpId,
              fileData.idp[idpId]
            )
              .then(() => {
                stopProgressIndicator(
                  `Successfully imported provider ${providerId}.`
                );
              })
              .catch((importProviderErr) => {
                stopProgressIndicator(
                  `Error importing provider ${fileData.idp[idpId]._id}`
                );
                printMessage(
                  `\nError importing provider ${providerId}`,
                  'error'
                );
                printMessage(importProviderErr.response.data, 'error');
              });
            break;
          }
        }
      }
      if (!found) {
        stopProgressIndicator(
          `Provider ${providerId.brightCyan} not found in ${file.brightCyan}!`
        );
      }
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

/**
 * Import first provider from file
 * @param {String} file import file name
 */
export async function importFirstSocialProviderFromFile(file) {
  fs.readFile(file, 'utf8', async (err, data) => {
    if (err) throw err;
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      createProgressIndicator(1, 'Importing provider...');
      for (const idpId in fileData.idp) {
        if ({}.hasOwnProperty.call(fileData.idp, idpId)) {
          updateProgressIndicator(`Importing ${fileData.idp[idpId]._id}`);
          const scriptId = fileData.idp[idpId].transform;
          const scriptData = fileData.script[scriptId];
          if (scriptId && scriptData) {
            scriptData.script = convertTextArrayToBase64(scriptData.script);
            // eslint-disable-next-line no-await-in-loop
            await createOrUpdateScript(
              fileData.idp[idpId].transform,
              fileData.script[fileData.idp[idpId].transform]
            );
          }
          putProviderByTypeAndId(
            fileData.idp[idpId]._type._id,
            idpId,
            fileData.idp[idpId]
          ).then((result) => {
            if (result == null) {
              stopProgressIndicator(
                `Error importing provider ${fileData.idp[idpId]._id}`
              );
              printMessage(
                `Error importing provider ${fileData.idp[idpId]._id}`,
                'error'
              );
            } else {
              stopProgressIndicator(
                `Successfully imported provider ${fileData.idp[idpId]._id}.`
              );
            }
          });
          break;
        }
      }
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

/**
 * Import all providers from file
 * @param {String} file import file name
 */
export async function importSocialProvidersFromFile(file) {
  fs.readFile(file, 'utf8', async (err, data) => {
    if (err) throw err;
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      createProgressIndicator(
        Object.keys(fileData.idp).length,
        'Importing providers...'
      );
      for (const idpId in fileData.idp) {
        if ({}.hasOwnProperty.call(fileData.idp, idpId)) {
          const scriptId = fileData.idp[idpId].transform;
          const scriptData = fileData.script[scriptId];
          if (scriptId && scriptData) {
            scriptData.script = convertTextArrayToBase64(scriptData.script);
            // eslint-disable-next-line no-await-in-loop
            await createOrUpdateScript(
              fileData.idp[idpId].transform,
              fileData.script[fileData.idp[idpId].transform]
            );
          }
          // eslint-disable-next-line no-await-in-loop
          const result = await putProviderByTypeAndId(
            fileData.idp[idpId]._type._id,
            idpId,
            fileData.idp[idpId]
          );
          if (!result) {
            updateProgressIndicator(
              `Successfully imported ${fileData.idp[idpId].name}`
            );
          }
        }
      }
      stopProgressIndicator(`Providers imported.`);
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

/**
 * Import providers from *.idp.json files in current working directory
 */
export async function importSocialProvidersFromFiles() {
  const names = fs.readdirSync('.');
  const jsonFiles = names.filter((name) =>
    name.toLowerCase().endsWith('.idp.json')
  );

  createProgressIndicator(jsonFiles.length, 'Importing providers...');
  let total = 0;
  for (const file of jsonFiles) {
    const data = fs.readFileSync(file, 'utf8');
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      const count = Object.keys(fileData.idp).length;
      total += count;
      for (const idpId in fileData.idp) {
        if ({}.hasOwnProperty.call(fileData.idp, idpId)) {
          // eslint-disable-next-line no-await-in-loop
          const result = await putProviderByTypeAndId(
            fileData.idp[idpId]._type._id,
            idpId,
            fileData.idp[idpId]
          );
          if (result == null) {
            printMessage(
              `Error importing ${count} providers from ${file}`,
              'error'
            );
          }
        }
      }
      updateProgressIndicator(`Imported ${count} provider(s) from ${file}`);
    } else {
      printMessage(`Validation of ${file} failed!`, 'error');
    }
  }
  stopProgressIndicator(
    `Finished importing ${total} provider(s) from ${jsonFiles.length} file(s).`
  );
}
