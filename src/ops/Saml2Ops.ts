import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import {
  createProvider,
  deleteProvider,
  findProviders,
  getProviderByLocationAndId,
  getProviderMetadata,
  getProviderMetadataUrl,
  getProviderRaw,
  getProviders,
  getProvidersRaw,
  putSamlEntity,
} from '../api/Saml2Api';
import { getScript } from '../api/ScriptApi';
import { decode, encode, encodeBase64Url } from '../api/utils/Base64';
import { createOrUpdateScript } from './ScriptOps';
import {
  createObjectTable,
  createProgressIndicator,
  createTable,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from './utils/Console';
import {
  convertBase64TextToArray,
  convertBase64UrlTextToArray,
  convertTextArrayToBase64,
  convertTextArrayToBase64Url,
  getRealmString,
  getTypedFilename,
  saveJsonToFile,
  saveTextToFile,
  saveToFile,
  validateImport,
} from './utils/ExportImportUtils';

export const roleMap = {
  identityProvider: 'IDP',
  serviceProvider: 'SP',
  attributeQueryProvider: 'AttrQuery',
  xacmlPolicyEnforcementPoint: 'XACML PEP',
};

// use a function vs a template variable to avoid problems in loops
function getFileDataTemplate() {
  return {
    meta: {},
    script: {},
    saml: {
      hosted: {},
      remote: {},
      metadata: {},
    },
  };
}

/**
 * List entity providers
 * @param {boolean} long Long list format with details
 */
export async function listSaml2Providers(long = false) {
  const providerList = (await getProviders()).result;
  providerList.sort((a, b) => a._id.localeCompare(b._id));
  if (!long) {
    for (const provider of providerList) {
      printMessage(`${provider.entityId}`, 'data');
    }
  } else {
    const table = createTable([
      'Entity Id'['brightCyan'],
      'Location'['brightCyan'],
      'Role(s)'['brightCyan'],
    ]);
    for (const provider of providerList) {
      table.push([
        provider.entityId,
        provider.location,
        provider.roles.map((role) => roleMap[role]).join(', '),
      ]);
    }
    printMessage(table.toString());
  }
}

/**
 * Deletes the identityprovider provided by the entityId
 * @param {string} entityId The entity id for the entity to be deleted
 */
export async function deleteSamlEntityByEntityId(entityId: string) {
  try {
    await deleteProvider(entityId);
  } catch (error) {
    printMessage(error.message, 'error');
  }
}

/**
 * Include dependencies in the export file
 * @param {Object} providerData Object representing a SAML entity provider
 * @param {Object} fileData File data object to add dependencies to
 */
async function exportDependencies(providerData, fileData) {
  const attrMapperScriptId = _.get(providerData, [
    'identityProvider',
    'assertionProcessing',
    'attributeMapper',
    'attributeMapperScript',
  ]);
  if (attrMapperScriptId && attrMapperScriptId !== '[Empty]') {
    const scriptData = await getScript(attrMapperScriptId);
    scriptData.script = convertBase64TextToArray(scriptData.script);
    // eslint-disable-next-line no-param-reassign
    fileData.script[attrMapperScriptId] = scriptData;
  }
  const idpAdapterScriptId = _.get(providerData, [
    'identityProvider',
    'advanced',
    'idpAdapter',
    'idpAdapterScript',
  ]);
  if (idpAdapterScriptId && idpAdapterScriptId !== '[Empty]') {
    const scriptData = await getScript(idpAdapterScriptId);
    scriptData.script = convertBase64TextToArray(scriptData.script);
    // eslint-disable-next-line no-param-reassign
    fileData.script[idpAdapterScriptId] = scriptData;
  }
  const metaDataResponse = await getProviderMetadata(providerData.entityId);
  // eslint-disable-next-line no-param-reassign
  fileData.saml.metadata[providerData._id] = convertBase64UrlTextToArray(
    encodeBase64Url(metaDataResponse)
  );
}

/**
 * Export a single entity provider to file
 * @param {String} entityId Provider entity id
 * @param {String} file Optional filename
 */
export async function exportSaml2ProviderToFile(entityId, file = null) {
  let fileName = file;
  if (!fileName) {
    fileName = getTypedFilename(entityId, 'saml');
  }
  createProgressIndicator(1, `Exporting provider ${entityId}`);
  try {
    const found = await findProviders(`entityId eq '${entityId}'`, 'location');
    switch (found.resultCount) {
      case 0:
        printMessage(`No provider with entity id '${entityId}' found`, 'error');
        break;
      case 1:
        {
          const { location } = found.result[0];
          const id = found.result[0]._id;
          try {
            const response = await getProviderByLocationAndId(location, id);
            const providerData = response;
            updateProgressIndicator(`Writing file ${fileName}`);
            const fileData = getFileDataTemplate();
            fileData.saml[location][providerData._id] = providerData;
            await exportDependencies(providerData, fileData);
            saveJsonToFile(fileData, fileName);
            stopProgressIndicator(
              `Exported ${entityId.brightCyan} to ${fileName.brightCyan}.`
            );
          } catch (err) {
            stopProgressIndicator(`${err}`);
            printMessage(err, 'error');
          }
        }
        break;
      default:
        printMessage(
          `Multiple providers with entity id '${entityId}' found`,
          'error'
        );
    }
  } catch (error) {
    stopProgressIndicator(`${error}`);
    printMessage(error.message, 'error');
  }
}

/**
 * Exports a RAW SAML entity, which means the raw xml is included.
 * @param {string} entityId Reference to the entity for export
 * @param {string} file Optional filename for the exported file
 */
export async function exportSaml2Raw(entityId, file = null) {
  printMessage(`Exporting SAML application ${entityId}`, 'info');
  let fileName = entityId;
  if (file) {
    fileName = file;
  }
  createProgressIndicator(1, `Exporting raw entity: ${entityId}`);
  getProviderRaw(entityId).then(async (response) => {
    updateProgressIndicator(`Writing file ${fileName}`);
    const rawData = response;
    saveTextToFile(JSON.stringify(rawData, null, 2), fileName);
    stopProgressIndicator(`Exported ${entityId} metadata to ${fileName}.`);
  });
}

/**
 * Export provider metadata to file
 * @param {String} entityId Provider entity id
 * @param {String} file Optional filename
 */
export async function exportSaml2Metadata(entityId, file = null) {
  let fileName = file;
  if (!fileName) {
    fileName = getTypedFilename(entityId, 'metadata', 'xml');
  }
  createProgressIndicator(1, `Exporting metadata for: ${entityId}`);
  getProviderMetadata(entityId)
    .then(async (response) => {
      updateProgressIndicator(`Writing file ${fileName}`);
      // printMessage(response.data, 'error');
      const metaData = response;
      saveTextToFile(metaData, fileName);
      stopProgressIndicator(
        `Exported ${entityId.brightCyan} metadata to ${fileName.brightCyan}.`
      );
    })
    .catch((err) => {
      stopProgressIndicator(`${err}`);
      printMessage(err, 'error');
    });
}

/**
 * Describe an entity provider's configuration
 * @param {String} entityId Provider entity id
 */
export async function describeSaml2Provider(entityId) {
  try {
    const found = await findProviders(
      `entityId eq '${entityId}'`,
      'location,roles'
    );
    switch (found.resultCount) {
      case 0:
        printMessage(`No provider with entity id '${entityId}' found`, 'error');
        break;
      case 1:
        {
          try {
            const { location } = found.result[0];
            const id = found.result[0]._id;
            const roles = found.result[0].roles
              .map((role) => roleMap[role])
              .join(', ');
            const response = await getProviderByLocationAndId(location, id);
            const rawProviderData = response;
            delete rawProviderData._id;
            delete rawProviderData._rev;
            rawProviderData.location = location;
            rawProviderData.roles = roles;
            rawProviderData.metadataUrl = getProviderMetadataUrl(entityId);
            // const fullProviderData = getFileDataTemplate();
            // fullProviderData.saml[location][rawProviderData._id] =
            //   rawProviderData;
            // await exportDependencies(rawProviderData, fullProviderData);
            // describe the provider
            const table = createObjectTable(rawProviderData);
            printMessage(table.toString());
          } catch (err) {
            printMessage(err, 'error');
          }
        }
        break;
      default:
        printMessage(
          `Multiple providers with entity id '${entityId}' found`,
          'error'
        );
    }
  } catch (error) {
    printMessage(error.message, 'error');
  }
}

/**
 * Export all entity providers raw to one file
 * @param {String} file Optional filename
 */
export async function exportSaml2ProvidersRawToFile(file = null) {
  let fileName = file;
  if (!fileName) {
    fileName = getTypedFilename(
      `all${getRealmString()}ProvidersRaw`,
      'samlRaw'
    );
  }
  try {
    const samlApplicationList = await getProvidersRaw();

    saveToFile('application', samlApplicationList, '_id', fileName);
    printMessage(
      `All RAW saml entity providers exported to: ${fileName}`,
      'info'
    );
  } catch (error) {
    printMessage(error.message, 'error');
    printMessage(
      `exportProvidersRawToFile: ${error.response?.status}`,
      'error'
    );
  }
}

/**
 * Export all entity providers to individual files
 */
export async function exportSaml2ProvidersRawToFiles() {
  const samlApplicationList = await getProvidersRaw();
  let hasError = false;
  createProgressIndicator(
    samlApplicationList.length,
    'Exporting RAW providers'
  );
  let exportedAmount = 0;
  for (const item of samlApplicationList) {
    updateProgressIndicator(`Exporting provider ${item.entityId}`);
    try {
      const samlApplicationData = await getProviderRaw(item._id);
      const fileName = getTypedFilename(
        `${item._id}${getRealmString()}ProviderRaw`,
        'samlRaw'
      );
      saveToFile('application', [samlApplicationData], '_id', fileName);
      exportedAmount++;
    } catch (error) {
      hasError = true;
      printMessage(`Unable to export:  ${item._id}`, 'error');
    }
  }
  stopProgressIndicator(`${exportedAmount} providers exported.`);
  if (!hasError) {
    printMessage('All entities exported.', 'info');
  } else {
    printMessage('All other entities exported.', 'info');
  }
}

/**
 * Export all entity providers to one file
 * @param {String} file Optional filename
 */
export async function exportSaml2ProvidersToFile(file = null) {
  let fileName = file;
  if (!fileName) {
    fileName = getTypedFilename(`all${getRealmString()}Providers`, 'saml');
  }
  try {
    const fileData = getFileDataTemplate();
    const found = await getProviders();
    if (found.resultCount > 0) {
      createProgressIndicator(found.resultCount, 'Exporting providers');
      for (const stubData of found.result) {
        updateProgressIndicator(`Exporting provider ${stubData.entityId}`);
        // eslint-disable-next-line no-await-in-loop
        const providerData = await getProviderByLocationAndId(
          stubData.location,
          stubData._id
        );
        // eslint-disable-next-line no-await-in-loop
        await exportDependencies(providerData, fileData);
        fileData.saml[stubData.location][providerData._id] = providerData;
      }
      saveJsonToFile(fileData, fileName);
      stopProgressIndicator(
        `${found.resultCount} providers exported to ${fileName}.`
      );
    } else {
      printMessage('No entity providers found.', 'info');
    }
  } catch (error) {
    printMessage(error.message, 'error');
    printMessage(`exportProvidersToFile: ${error.response?.status}`, 'error');
  }
}

/**
 * Export all entity providers to individual files
 */
export async function exportSaml2ProvidersToFiles() {
  const found = await getProviders();
  if (found.resultCount > 0) {
    createProgressIndicator(found.resultCount, 'Exporting providers');
    for (const stubData of found.result) {
      updateProgressIndicator(`Exporting provider ${stubData.entityId}`);
      const fileName = getTypedFilename(stubData.entityId, 'saml');
      const fileData = getFileDataTemplate();
      // eslint-disable-next-line no-await-in-loop
      const providerData = await getProviderByLocationAndId(
        stubData.location,
        stubData._id
      );
      // eslint-disable-next-line no-await-in-loop
      await exportDependencies(providerData, fileData);
      fileData.saml[stubData.location][providerData._id] = providerData;
      saveJsonToFile(fileData, fileName);
    }
    stopProgressIndicator(`${found.resultCount} providers exported.`);
  } else {
    printMessage('No entity providers found.', 'info');
  }
}

/**
 * Include dependencies from the import file
 * @param {Object} providerData Object representing a SAML entity provider
 * @param {Object} fileData File data object to read dependencies from
 */
async function importDependencies(providerData, fileData) {
  const attrMapperScriptId = _.get(providerData, [
    'identityProvider',
    'assertionProcessing',
    'attributeMapper',
    'attributeMapperScript',
  ]);
  if (attrMapperScriptId && attrMapperScriptId !== '[Empty]') {
    const scriptData = _.get(fileData, ['script', attrMapperScriptId]);
    scriptData.script = convertTextArrayToBase64(scriptData.script);
    await createOrUpdateScript(attrMapperScriptId, scriptData);
  }
  const idpAdapterScriptId = _.get(providerData, [
    'identityProvider',
    'advanced',
    'idpAdapter',
    'idpAdapterScript',
  ]);
  if (idpAdapterScriptId && idpAdapterScriptId !== '[Empty]') {
    const scriptData = _.get(fileData, ['script', idpAdapterScriptId]);
    scriptData.script = convertTextArrayToBase64(scriptData.script);
    await createOrUpdateScript(attrMapperScriptId, scriptData);
  }
}

/**
 * Find provider in import file and return its location
 * @param {String} entityId64 Base64-encoded provider entity id
 * @param {Object} fileData Import file json data
 * @returns {String} 'hosted' or 'remote' if found, undefined otherwise
 */
function getLocation(entityId64, fileData) {
  if (_.get(fileData, ['saml', 'hosted', entityId64])) {
    return 'hosted';
  }
  if (_.get(fileData, ['saml', 'remote', entityId64])) {
    return 'remote';
  }
  return undefined;
}

/**
 * Import a SAML entity provider by entity id from file
 * @param {String} entityId Provider entity id
 * @param {String} file Import file name
 */
export async function importSaml2ProviderFromFile(entityId, file) {
  const entityId64 = encode(entityId, false);
  fs.readFile(file, 'utf8', async (err, data) => {
    if (err) throw err;
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      createProgressIndicator(1, 'Importing provider...');
      const location = getLocation(entityId64, fileData);
      if (location) {
        const providerData = _.get(fileData, ['saml', location, entityId64]);
        updateProgressIndicator(`Importing ${entityId}`);
        await importDependencies(providerData, fileData);
        let metaData = null;
        if (location === 'remote') {
          metaData = convertTextArrayToBase64Url(
            fileData.saml.metadata[entityId64]
          );
        }
        createProvider(location, providerData, metaData)
          .then(() => {
            stopProgressIndicator(
              `Successfully imported provider ${entityId}.`
            );
          })
          .catch((createProviderErr) => {
            printMessage(`\nError importing provider ${entityId}`, 'error');
            printMessage(createProviderErr.response, 'error');
          });
      } else {
        stopProgressIndicator(
          `Provider ${entityId.brightCyan} not found in ${file.brightCyan}!`
        );
      }
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

/**
 * Import first SAML entity provider from file
 * @param {String} file Import file name
 */
export async function importFirstSaml2ProviderFromFile(file) {
  fs.readFile(file, 'utf8', async (err, data) => {
    if (err) throw err;
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      createProgressIndicator(1, 'Importing provider...');
      // find providers in hosted and if none exist in remote
      let location = 'hosted';
      let providerIds = _.keys(fileData.saml[location]);
      if (providerIds.length === 0) {
        location = 'remote';
        providerIds = _.keys(fileData.saml[location]);
        if (providerIds.length === 0) {
          location = null;
        }
      }
      if (location) {
        const entityId64 = providerIds[0];
        const entityId = decode(entityId64);
        const providerData = _.get(fileData, ['saml', location, entityId64]);
        updateProgressIndicator(`Importing ${entityId}`);
        await importDependencies(providerData, fileData);
        let metaData = null;
        if (location === 'remote') {
          metaData = convertTextArrayToBase64Url(
            fileData.saml.metadata[entityId64]
          );
        }
        createProvider(location, providerData, metaData)
          .then(() => {
            stopProgressIndicator(
              `Successfully imported provider ${entityId}.`
            );
          })
          .catch((createProviderErr) => {
            stopProgressIndicator(`Error importing provider ${entityId}`);
            printMessage(`\nError importing provider ${entityId}`, 'error');
            printMessage(createProviderErr.response.data, 'error');
          });
      } else {
        stopProgressIndicator(`No providers found in ${file.brightCyan}!`);
      }
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

/**
 * Imports the RAW provider info from a single file.
 * @param {String} file Import file name
 */
export async function importSaml2RAWProvidersFromFile(file) {
  fs.readFile(file, 'utf8', function (err, data) {
    if (err) throw err;
    const samlEntityData = JSON.parse(data);
    let amountOfEntities = 0;
    for (const id in samlEntityData.application) {
      if (id.length) {
        amountOfEntities++;
      }
    }
    if (validateImport(samlEntityData.meta)) {
      createProgressIndicator(amountOfEntities, 'Importing providers...');
      for (const id in samlEntityData.application) {
        // remove the "_rev" data before PUT
        delete samlEntityData.application[id]._rev;
        putSamlEntity(id, samlEntityData.application[id]).then((result) => {
          if (result === null) {
            printMessage(`Import validation failed for ${id}`, 'error');
          }
        });
        updateProgressIndicator(`Imported ${id}...`);
      }
      stopProgressIndicator(`Import done`);
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

/**
 * Whenever the SAML RAW file were exported using the exportRAW functionality this function
 * is used to read them back in. Only files with the .samlRaw.json extension will be imported.
 * @param {string} directory The directory from which to import the files
 */
export async function importSaml2RawProvidersFromFiles(directory) {
  const files = fs.readdirSync(directory);
  const filesToImport = files.filter(
    (file) => file.indexOf('.samlRaw.json') > -1
  );

  if (filesToImport.length > 0) {
    createProgressIndicator(filesToImport.length, 'Importing providers...');
    filesToImport.forEach((file) => {
      const filePathAbsolute = path.join(directory, file);
      filesToImport.push(file);
      const samlEntityData = JSON.parse(
        fs.readFileSync(filePathAbsolute, 'utf8')
      );
      if (validateImport(samlEntityData.meta)) {
        for (const id in samlEntityData.application) {
          // remove the "_rev" data before PUT
          delete samlEntityData.application[id]._rev;
          putSamlEntity(id, samlEntityData.application[id]).then((result) => {
            if (result === null) {
              printMessage(`Import validation failed for ${id}`, 'error');
            }
          });
          updateProgressIndicator(`Imported ${id}...`);
        }
      } else {
        printMessage('Import validation failed...', 'error');
      }
    });
    stopProgressIndicator(`Import done`);
  } else {
    printMessage(
      'Import failed, no files to import. (check extension to be .samlRaw.json)',
      'warn'
    );
  }
}

/**
 * Imports a raw SAML export file (containing one entity).
 * @param {string} file The import file
 */
export async function importSaml2RawProviderFromFile(file) {
  printMessage(`Importing SAML Entity ${file}...`, 'info');
  if (file.indexOf('.samlRaw.json') > -1) {
    const samlEntityData = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (validateImport(samlEntityData.meta)) {
      for (const id in samlEntityData.application) {
        // remove the "_rev" data before PUT
        delete samlEntityData.application[id]._rev;
        putSamlEntity(id, samlEntityData.application[id]).then((result) => {
          if (result !== null) {
            printMessage(`Imported ${id}`, 'info');
          }
        });
      }
    } else {
      printMessage('Import validation failed...', 'error');
    }
  }
}

/**
 * Deletes all entity providers.
 */
export async function cleanupRawProviders() {
  const applicationList = await getProvidersRaw();
  const deleteApplicationPromises = [];
  applicationList.forEach((item) => {
    printMessage(`Deleting Application ${item._id}`, 'error');
    deleteApplicationPromises.push(deleteSamlEntityByEntityId(item._id));
  });
  const deleteApplicationResult = await Promise.all(deleteApplicationPromises);
  if (deleteApplicationResult.length == applicationList.length) {
    printMessage('SAML Entity cleanup done', 'info');
  }
}

/**
 * Import all SAML entity providers from file
 * @param {String} file Import file name
 */
export async function importSaml2ProvidersFromFile(file) {
  fs.readFile(file, 'utf8', async (err, data) => {
    if (err) throw err;
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      // find providers in hosted and in remote and map locations
      const hostedIds = _.keys(fileData.saml.hosted);
      const remoteIds = _.keys(fileData.saml.remote);
      const providerIds = hostedIds.concat(remoteIds);
      createProgressIndicator(providerIds.length, 'Importing providers...');
      for (const entityId64 of providerIds) {
        const location = hostedIds.includes(entityId64) ? 'hosted' : 'remote';
        const entityId = decode(entityId64);
        const providerData = _.get(fileData, ['saml', location, entityId64]);
        // eslint-disable-next-line no-await-in-loop
        await importDependencies(providerData, fileData);
        let metaData = null;
        if (location === 'remote') {
          metaData = convertTextArrayToBase64Url(
            fileData.saml.metadata[entityId64]
          );
        }
        try {
          // eslint-disable-next-line no-await-in-loop
          await createProvider(location, providerData, metaData);
          updateProgressIndicator(`Imported ${entityId}`);
        } catch (createProviderErr) {
          printMessage(`\nError importing provider ${entityId}`, 'error');
          printMessage(createProviderErr.response.data, 'error');
        }
      }
      stopProgressIndicator(`Providers imported.`);
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

/**
 * Import all SAML entity providers from all *.saml.json files in the current directory
 */
export async function importSaml2ProvidersFromFiles() {
  const names = fs.readdirSync('.');
  const jsonFiles = names.filter((name) =>
    name.toLowerCase().endsWith('.saml.json')
  );
  createProgressIndicator(jsonFiles.length, 'Importing providers...');
  let total = 0;
  let totalErrors = 0;
  for (const file of jsonFiles) {
    const data = fs.readFileSync(file, 'utf8');
    const fileData = JSON.parse(data);
    if (validateImport(fileData.meta)) {
      // find providers in hosted and in remote and map locations
      const hostedIds = _.keys(fileData.saml.hosted);
      const remoteIds = _.keys(fileData.saml.remote);
      const providerIds = hostedIds.concat(remoteIds);
      total += providerIds.length;
      let errors = 0;
      for (const entityId64 of providerIds) {
        const location = hostedIds.includes(entityId64) ? 'hosted' : 'remote';
        const entityId = decode(entityId64);
        const providerData = _.get(fileData, ['saml', location, entityId64]);
        importDependencies(providerData, fileData);
        let metaData = null;
        if (location === 'remote') {
          metaData = convertTextArrayToBase64Url(
            fileData.saml.metadata[entityId64]
          );
        }
        try {
          // eslint-disable-next-line no-await-in-loop
          await createProvider(location, providerData, metaData);
          // updateProgressIndicator(`Imported ${entityId}`);
        } catch (createProviderErr) {
          errors += 1;
          printMessage(`\nError importing provider ${entityId}`, 'error');
          printMessage(createProviderErr.response.data, 'error');
        }
      }
      totalErrors += errors;
      updateProgressIndicator(
        `Imported ${providerIds.length - errors} provider(s) from ${file}`
      );
    } else {
      printMessage(`Validation of ${file} failed!`, 'error');
    }
  }
  stopProgressIndicator(
    `Imported ${total - totalErrors} of ${total} provider(s) from ${
      jsonFiles.length
    } file(s).`
  );
}
