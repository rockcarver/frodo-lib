import _ from 'lodash';
import {
  Saml2ProiderLocation,
  Saml2ProviderSkeleton,
  Saml2ProviderStub,
} from '../api/ApiTypes';
import {
  createProvider,
  deleteRawProvider,
  findProviders,
  getProviderByLocationAndId as _getProviderByLocationAndId,
  getProviderMetadata as _getProviderMetadata,
  getProviderMetadataUrl as _getProviderMetadataUrl,
  getRawProvider as _getRawProvider,
  getProviders,
  getRawProviders as _getRawProviders,
  putRawProvider as _putRawProvider,
  deleteProviderByLocationAndId,
} from '../api/Saml2Api';
import { getScript } from '../api/ScriptApi';
import {
  decode,
  decodeBase64Url,
  encode,
  encodeBase64Url,
} from '../api/utils/Base64';
import { MultiOpStatusInterface, Saml2ExportInterface } from './OpsTypes';
import { putScript } from './ScriptOps';
import {
  createProgressIndicator,
  debugMessage,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from './utils/Console';
import {
  convertBase64TextToArray,
  convertBase64UrlTextToArray,
  convertTextArrayToBase64,
  convertTextArrayToBase64Url,
  getMetadata,
} from './utils/ExportImportUtils';

export const roleMap = {
  identityProvider: 'IDP',
  serviceProvider: 'SP',
  attributeQueryProvider: 'AttrQuery',
  xacmlPolicyEnforcementPoint: 'XACML PEP',
};

// use a function vs a template variable to avoid problems in loops
export function createSaml2ExportTemplate(): Saml2ExportInterface {
  return {
    meta: getMetadata(),
    script: {},
    saml: {
      hosted: {},
      remote: {},
      metadata: {},
    },
  } as Saml2ExportInterface;
}

/**
 * Get SAML2 entity provider stubs
 * @returns {Promise<Saml2ProviderStub[]>} a promise that resolves to an array of saml2 entity stubs
 */
export async function getSaml2ProviderStubs(): Promise<Saml2ProviderStub[]> {
  const { result } = await getProviders();
  return result;
}

/**
 * Geta SAML2 entity provider by location and id
 * @param {string} location Entity provider location (hosted or remote)
 * @param {string} entityId64 Base64-encoded-without-padding provider entity id
 * @returns {Promise} a promise that resolves to a saml2 entity provider object
 */
export async function getProviderByLocationAndId(
  location: string,
  entityId64: string
) {
  return _getProviderByLocationAndId(location, entityId64);
}

/**
 * Get a SAML2 entity provider's metadata URL by entity id
 * @param {string} entityId SAML2 entity id
 * @returns {string} the URL to get the metadata from
 */
export function getProviderMetadataUrl(entityId: string): string {
  return _getProviderMetadataUrl(entityId);
}

/**
 * Get a SAML2 entity provider's metadata by entity id
 * @param {string} entityId SAML2 entity id
 * @returns {Promise<object>} a promise that resolves to an object containing a SAML2 metadata
 */
export async function getProviderMetadata(entityId) {
  return _getProviderMetadata(entityId);
}

/**
 * Include dependencies in the export file
 * @param {object} providerData Object representing a SAML entity provider
 * @param {object} fileData File data object to add dependencies to
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
 *
 * @param {string} entityId Provider entity id
 * @returns {Promise<Saml2ProviderStub>} Promise resolving to a Saml2ExportInterface object.
 */
export async function getSaml2ProviderStub(
  entityId: string
): Promise<Saml2ProviderStub> {
  debugMessage(`Saml2Ops.getSaml2ProviderStub: start [entityId=${entityId}]`);
  const found = await findProviders(`entityId eq '${entityId}'`);
  switch (found.resultCount) {
    case 0:
      throw new Error(`No provider with entity id '${entityId}' found`);
    case 1: {
      debugMessage(`Saml2Ops.getSaml2ProviderStub: end [entityId=${entityId}]`);
      return found.result[0];
    }
    default:
      throw new Error(`Multiple providers with entity id '${entityId}' found`);
  }
}

/**
 * Export a single entity provider. The response can be saved to file as is.
 * @param {string} entityId Provider entity id
 * @returns {Promise<Saml2ProviderSkeleton>} Promise resolving to a Saml2ExportInterface object.
 */
export async function getSaml2Provider(
  entityId: string
): Promise<Saml2ProviderSkeleton> {
  debugMessage(`Saml2Ops.getSaml2Provider: start [entityId=${entityId}]`);
  const stub = await getSaml2ProviderStub(entityId);
  const { location } = stub;
  const id = stub._id;
  const providerData = await getProviderByLocationAndId(location, id);
  debugMessage(`Saml2Ops.getSaml2Provider: end [entityId=${entityId}]`);
  return providerData;
}

/**
 * Delete an entity provider. The response can be saved to file as is.
 * @param {string} entityId Provider entity id
 * @returns {Promise<Saml2ProviderSkeleton>} Promise resolving to a Saml2ExportInterface object.
 */
export async function deleteSaml2Provider(
  entityId: string
): Promise<Saml2ProviderSkeleton> {
  debugMessage(`Saml2Ops.deleteSaml2Provider: start [entityId=${entityId}]`);
  const stub = await getSaml2ProviderStub(entityId);
  const { location } = stub;
  const id = stub._id;
  const providerData = await deleteProviderByLocationAndId(location, id);
  debugMessage(`Saml2Ops.deleteSaml2Provider: end [entityId=${entityId}]`);
  return providerData;
}

/**
 * Delete all entity providers.
 * @returns {Promise<Saml2ProviderSkeleton[]>} Promise resolving to an array of Saml2ProviderSkeleton objects.
 */
export async function deleteSaml2Providers(): Promise<Saml2ProviderSkeleton[]> {
  debugMessage(`Saml2Ops.deleteSaml2Providers: start`);
  const providers: Saml2ProviderSkeleton[] = [];
  const stubs = await getSaml2ProviderStubs();
  for (const stub of stubs) {
    const provider = await deleteProviderByLocationAndId(
      stub.location,
      stub._id
    );
    providers.push(provider);
  }
  debugMessage(
    `Saml2Ops.deleteSaml2Providers: end [deleted ${providers.length} providers]`
  );
  return providers;
}

/**
 * Export a single entity provider. The response can be saved to file as is.
 * @param {string} entityId Provider entity id
 * @returns {Promise<Saml2ExportInterface>} Promise resolving to a Saml2ExportInterface object.
 */
export async function exportSaml2Provider(
  entityId: string
): Promise<Saml2ExportInterface> {
  debugMessage(`Saml2Ops.exportSaml2Provider: start [entityId=${entityId}]`);
  const exportData = createSaml2ExportTemplate();
  const stub = await getSaml2ProviderStub(entityId);
  const { location } = stub;
  const id = stub._id;
  const providerData = await getProviderByLocationAndId(location, id);
  exportData.saml[stub.location][providerData._id] = providerData;
  await exportDependencies(providerData, exportData);
  debugMessage(`Saml2Ops.exportSaml2Provider: end [entityId=${entityId}]`);
  return exportData;
}

/**
 * Export all entity providers. The response can be saved to file as is.
 * @returns {Promise<Saml2ExportInterface>} Promise resolving to a Saml2ExportInterface object.
 */
export async function exportSaml2Providers(): Promise<Saml2ExportInterface> {
  const fileData = createSaml2ExportTemplate();
  const stubs = await getSaml2ProviderStubs();
  for (const stub of stubs) {
    const providerData = await getProviderByLocationAndId(
      stub.location,
      stub._id
    );
    await exportDependencies(providerData, fileData);
    fileData.saml[stub.location][providerData._id] = providerData;
  }
  return fileData;
}

/**
 * Include dependencies from the import file
 * @param {object} providerData Object representing a SAML entity provider
 * @param {object} fileData File data object to read dependencies from
 */
async function importDependencies(providerData, fileData) {
  debugMessage(`Saml2Ops.importDependencies: start`);
  const attrMapperScriptId = _.get(providerData, [
    'identityProvider',
    'assertionProcessing',
    'attributeMapper',
    'attributeMapperScript',
  ]);
  if (attrMapperScriptId && attrMapperScriptId !== '[Empty]') {
    debugMessage(
      `Saml2Ops.importDependencies: attributeMapperScript=${attrMapperScriptId}`
    );
    const scriptData = _.get(fileData, ['script', attrMapperScriptId]);
    scriptData.script = convertTextArrayToBase64(scriptData.script);
    await putScript(attrMapperScriptId, scriptData);
  }
  const idpAdapterScriptId = _.get(providerData, [
    'identityProvider',
    'advanced',
    'idpAdapter',
    'idpAdapterScript',
  ]);
  if (idpAdapterScriptId && idpAdapterScriptId !== '[Empty]') {
    debugMessage(
      `Saml2Ops.importDependencies: idpAdapterScript=${idpAdapterScriptId}`
    );
    const scriptData = _.get(fileData, ['script', idpAdapterScriptId]);
    scriptData.script = convertTextArrayToBase64(scriptData.script);
    await putScript(idpAdapterScriptId, scriptData);
  }
  debugMessage(`Saml2Ops.importDependencies: end`);
}

/**
 * Find provider in import file and return its location
 * @param {string} entityId64 Base64-encoded provider entity id
 * @param {Saml2ExportInterface} data Import file json data
 * @returns {string} 'hosted' or 'remote' if found, undefined otherwise
 */
function getLocation(
  entityId64: string,
  data: Saml2ExportInterface
): Saml2ProiderLocation {
  if (data.saml.hosted[entityId64]) {
    return Saml2ProiderLocation.HOSTED;
  }
  if (data.saml.remote[entityId64]) {
    return Saml2ProiderLocation.REMOTE;
  }
  return undefined;
}

/**
 * Import a SAML entity provider
 * @param {string} entityId Provider entity id
 * @param {Saml2ExportInterface} importData Import data
 */
export async function importSaml2Provider(
  entityId: string,
  importData: Saml2ExportInterface
): Promise<boolean> {
  debugMessage(`Saml2Ops.importSaml2Provider: start`);
  const entityId64 = encode(entityId, false);
  const location = getLocation(entityId64, importData);
  if (location) {
    const providerData = importData.saml[location][entityId64];
    await importDependencies(providerData, importData);
    let metaData = null;
    if (location === Saml2ProiderLocation.REMOTE) {
      metaData = convertTextArrayToBase64Url(
        importData.saml.metadata[entityId64]
      );
    }
    await createProvider(location, providerData, metaData);
  } else {
    throw new Error(`Provider ${entityId} not found in import data!`);
  }
  debugMessage(`Saml2Ops.importSaml2Provider: end`);
  return true;
}

/**
 * Import SAML entity providers
 * @param {Saml2ExportInterface} importData Import data
 */
export async function importSaml2Providers(
  importData: Saml2ExportInterface
): Promise<MultiOpStatusInterface> {
  debugMessage(`Saml2Ops.importSaml2Providers: start`);
  const myStatus: MultiOpStatusInterface = {
    total: 0,
    successes: 0,
    warnings: 0,
    failures: 0,
  };
  try {
    // find providers in hosted and in remote and map locations
    const hostedIds = Object.keys(importData.saml.hosted);
    const remoteIds = Object.keys(importData.saml.remote);
    const providerIds = hostedIds.concat(remoteIds);
    myStatus.total = providerIds.length;
    createProgressIndicator(providerIds.length, 'Importing providers...');
    for (const entityId64 of providerIds) {
      debugMessage(
        `Saml2Ops.importSaml2Providers: entityId=${decodeBase64Url(entityId64)}`
      );
      const location = hostedIds.includes(entityId64)
        ? Saml2ProiderLocation.HOSTED
        : Saml2ProiderLocation.REMOTE;
      const entityId = decode(entityId64);
      const providerData = importData.saml[location][entityId64];
      try {
        await importDependencies(providerData, importData);
      } catch (importDependenciesErr) {
        myStatus.warnings += 1;
        printMessage(
          `\nWarning importing dependencies for ${entityId}`,
          'warn'
        );
        printMessage(importDependenciesErr.response.data, 'error');
      }
      let metaData = null;
      if (location === Saml2ProiderLocation.REMOTE) {
        metaData = convertTextArrayToBase64Url(
          importData.saml.metadata[entityId64]
        );
      }
      try {
        await createProvider(location, providerData, metaData);
        myStatus.successes += 1;
        updateProgressIndicator(`Imported ${entityId}`);
      } catch (createProviderErr) {
        myStatus.failures += 1;
        printMessage(`\nError importing provider ${entityId}`, 'error');
        printMessage(createProviderErr, 'error');
      }
    }
    myStatus.message = `${myStatus.successes}/${myStatus.total} providers imported.`;
    stopProgressIndicator(myStatus.message);
  } catch (error) {
    myStatus.failures += 1;
    printMessage(`\nError importing providers ${error.message}`, 'error');
  }
  debugMessage(`Saml2Ops.importSaml2Providers: end`);
  return myStatus;
}

// Contributions using legacy APIs. Need to investigate if those will be deprecated in the future

/**
 * Deletes entity provider
 * @param {string} entityId The entity id for the entity to be deleted
 * @returns {Promise<Saml2ProviderSkeleton>} Promise resolving to a Saml2ExportInterface object.
 */
export async function deleteRawSaml2Provider(
  entityId: string
): Promise<Saml2ProviderSkeleton> {
  debugMessage(`Saml2Ops.deleteSaml2Provider: start [entityId=${entityId}]`);
  const response = await deleteRawProvider(entityId);
  debugMessage(`Saml2Ops.deleteSaml2Provider: end [entityId=${entityId}]`);
  return response;
}

/**
 * Deletes all entity providers.
 */
export async function deleteRawSaml2Providers(): Promise<
  Saml2ProviderSkeleton[]
> {
  const applicationList = (await getRawSaml2Providers()).result;
  const deleteApplicationPromises = [];
  applicationList.forEach((item) => {
    printMessage(`Deleting Application ${item._id}`, 'error');
    deleteApplicationPromises.push(deleteRawProvider(item._id));
  });
  const deleteApplicationResult = await Promise.all(deleteApplicationPromises);
  if (deleteApplicationResult.length == applicationList.length) {
    printMessage('SAML Entity cleanup done', 'info');
  }
  return deleteApplicationResult;
}

/**
 * Retrieves all entity providers using the legacy federation enpoints.
 * @returns {Promise} a promise that resolves to an object containing an array of providers
 */
export async function getRawSaml2Providers() {
  return _getRawProviders();
}

/**
 * Retrieves all entity providers using the legacy federation enpoints.
 * @param {string} entityId The entity provider id
 * @returns {Promise} a promise that resolves to an object containing an array of providers
 */
export async function getRawSaml2Provider(entityId: string) {
  return _getRawProvider(entityId);
}

/**
 * Stores a new SAML2 entity provider
 * @param {string} entityId The entity provider id
 * @param {string} entityData The actual data containing the entity provider configuration
 * @returns {Promise} Promise that resolves to a provider object
 */
export async function putRawSaml2Provider(entityId: string, entityData) {
  return _putRawProvider(entityId, entityData);
}
