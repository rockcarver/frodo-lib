import {
  getOAuth2Client as _getOAuth2Client,
  getOAuth2Clients as _getOAuth2Clients,
  putOAuth2Client as _putOAuth2Client,
  deleteOAuth2Client as _deleteOAuth2Client,
} from '../api/OAuth2ClientApi';
import { ExportMetaData } from './OpsTypes';
import {
  NoIdObjectSkeletonInterface,
  OAuth2ClientSkeleton,
  ScriptSkeleton,
} from '../api/ApiTypes';
import { getMetadata } from './utils/ExportImportUtils';
import { debugMessage, printMessage } from './utils/Console';
import { convertBase64TextToArray } from './utils/ExportImportUtils';
import { getOAuth2Provider } from './OAuth2ProviderOps';
import State from '../shared/State';
import { getScript, putScript } from './ScriptOps';

export default class OAuth2ClientOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  /**
   * Get all OAuth2 clients
   * @returns {Promise<any[]>} a promise that resolves to an array of oauth2client objects
   */
  async getOAuth2Clients() {
    return getOAuth2Clients({ state: this.state });
  }

  /**
   * Get OAuth2 client
   * @param {string} clientId client id
   * @returns {Promise<any>} a promise that resolves to an oauth2client object
   */
  async getOAuth2Client(clientId: string) {
    return getOAuth2Client({ clientId, state: this.state });
  }

  /**
   * Put OAuth2 client
   * @param {string} clientId client id
   * @param {any} clientData oauth2client object
   * @returns {Promise<any>} a promise that resolves to an oauth2client object
   */
  async putOAuth2Client(clientId: string, clientData: OAuth2ClientSkeleton) {
    return putOAuth2Client({ clientId, clientData, state: this.state });
  }

  /**
   * Delete OAuth2 client
   * @param {string} clientId client id
   * @returns {Promise<any>} a promise that resolves to an oauth2client object
   */
  async deleteOAuth2Client(clientId: string) {
    return deleteOAuth2Client({ clientId, state: this.state });
  }

  /**
   * Export all OAuth2 clients
   * @param {OAuth2ClientExportOptions} options export options
   * @returns {OAuth2ClientExportInterface} export data
   */
  async exportOAuth2Clients(
    options: OAuth2ClientExportOptions = { useStringArrays: true, deps: true }
  ): Promise<OAuth2ClientExportInterface> {
    return exportOAuth2Clients({ options, state: this.state });
  }

  /**
   * Export OAuth2 client by ID
   * @param {string} clientId oauth2 client id
   * @param {OAuth2ClientExportOptions} options export options
   * @returns {OAuth2ClientExportInterface} export data
   */
  async exportOAuth2Client(
    clientId: string,
    options: OAuth2ClientExportOptions = { useStringArrays: true, deps: true }
  ): Promise<OAuth2ClientExportInterface> {
    return exportOAuth2Client({ clientId, options, state: this.state });
  }

  /**
   * Import OAuth2 Client by ID
   * @param {string} clientId client id
   * @param {OAuth2ClientExportInterface} importData import data
   * @param {OAuth2ClientImportOptions} options import options
   */
  async importOAuth2Client(
    clientId: string,
    importData: OAuth2ClientExportInterface,
    options: OAuth2ClientImportOptions = { deps: true }
  ) {
    return importOAuth2Client({
      clientId,
      importData,
      options,
      state: this.state,
    });
  }

  /**
   * Import first OAuth2 Client
   * @param {OAuth2ClientExportInterface} importData import data
   * @param {OAuth2ClientImportOptions} options import options
   */
  async importFirstOAuth2Client(
    importData: OAuth2ClientExportInterface,
    options: OAuth2ClientImportOptions = { deps: true }
  ) {
    return importFirstOAuth2Client({ importData, options, state: this.state });
  }

  /**
   * Import OAuth2 Clients
   * @param {OAuth2ClientExportInterface} importData import data
   * @param {OAuth2ClientImportOptions} options import options
   * @returns {Promise<unknown[]>} array of imported oauth2 clients
   */
  async importOAuth2Clients(
    importData: OAuth2ClientExportInterface,
    options: OAuth2ClientImportOptions = { deps: true }
  ): Promise<unknown[]> {
    return importOAuth2Clients({ importData, options, state: this.state });
  }
}

/**
 * OAuth2 client export options
 */
export interface OAuth2ClientExportOptions {
  /**
   * Use string arrays to store multi-line text in scripts.
   */
  useStringArrays: boolean;
  /**
   * Include any dependencies (scripts).
   */
  deps: boolean;
}

/**
 * OAuth2 client import options
 */
export interface OAuth2ClientImportOptions {
  /**
   * Include any dependencies (scripts).
   */
  deps: boolean;
}

export interface OAuth2ClientExportInterface {
  meta?: ExportMetaData;
  script: Record<string, ScriptSkeleton>;
  application: Record<string, OAuth2ClientSkeleton>;
}

/**
 * Create an empty OAuth2 client export template
 * @returns {OAuth2ClientExportInterface} an empty OAuth2 client export template
 */
function createOAuth2ClientExportTemplate({
  state,
}: {
  state: State;
}): OAuth2ClientExportInterface {
  return {
    meta: getMetadata({ state }),
    script: {},
    application: {},
  } as OAuth2ClientExportInterface;
}

/**
 * Get all OAuth2 clients
 * @returns {Promise<any[]>} a promise that resolves to an array of oauth2client objects
 */
export async function getOAuth2Clients({ state }: { state: State }) {
  const clients = (await _getOAuth2Clients({ state })).result;
  return clients;
}

/**
 * Get OAuth2 client
 * @param {string} clientId client id
 * @returns {Promise<any>} a promise that resolves to an oauth2client object
 */
export async function getOAuth2Client({
  clientId,
  state,
}: {
  clientId: string;
  state: State;
}) {
  return _getOAuth2Client({ id: clientId, state });
}

/**
 * Put OAuth2 client
 * @param {string} clientId client id
 * @param {any} clientData oauth2client object
 * @returns {Promise<any>} a promise that resolves to an oauth2client object
 */
export async function putOAuth2Client({
  clientId,
  clientData,
  state,
}: {
  clientId: string;
  clientData: OAuth2ClientSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}) {
  debugMessage(`OAuth2ClientOps.putOAuth2Client: start`);
  try {
    const response = await _putOAuth2Client({
      id: clientId,
      clientData,
      state,
    });
    debugMessage(`OAuth2ClientOps.putOAuth2Client: end`);
    return response;
  } catch (error) {
    if (
      error.response?.status === 400 &&
      error.response?.data?.message === 'Invalid attribute specified.'
    ) {
      const { validAttributes } = error.response.data.detail;
      validAttributes.push('_id');
      for (const key of Object.keys(clientData)) {
        if (typeof clientData[key] === 'object') {
          for (const attribute of Object.keys(clientData[key])) {
            if (!validAttributes.includes(attribute)) {
              if (state.getVerbose())
                printMessage(
                  `\n- Removing invalid attribute: ${key}.${attribute}`,
                  'warn'
                );
              delete clientData[key][attribute];
            }
          }
        }
      }
      const response = await _putOAuth2Client({
        id: clientId,
        clientData,
        state,
      });
      debugMessage(`OAuth2ClientOps.putOAuth2Client: end`);
      return response;
    } else {
      throw error;
    }
  }
}

/**
 * Delete OAuth2 client
 * @param {string} clientId client id
 * @returns {Promise<any>} a promise that resolves to an oauth2client object
 */
export async function deleteOAuth2Client({
  clientId,
  state,
}: {
  clientId: string;
  state: State;
}) {
  return _deleteOAuth2Client({ id: clientId, state });
}

/**
 * Helper function to export dependencies of an OAuth2 Client
 * @param {unknown} clientData oauth2 client data
 * @param {OAuth2ClientExportOptions} options export options
 * @param {OAuth2ClientExportInterface} exportData export data
 */
async function exportOAuth2ClientDependencies(
  clientData: unknown,
  options: OAuth2ClientExportOptions,
  exportData: OAuth2ClientExportInterface,
  state: State
) {
  debugMessage(
    `OAuth2ClientOps.exportOAuth2ClientDependencies: start [client=${clientData['_id']}]`
  );
  if (clientData['overrideOAuth2ClientConfig']) {
    for (const key of Object.keys(clientData['overrideOAuth2ClientConfig'])) {
      if (key.endsWith('Script')) {
        const scriptId = clientData['overrideOAuth2ClientConfig'][key];
        if (scriptId !== '[Empty]' && !exportData.script[scriptId]) {
          try {
            debugMessage(`- ${scriptId} referenced by ${clientData['_id']}`);
            const scriptData = await getScript({ scriptId, state });
            if (options.useStringArrays)
              scriptData.script = convertBase64TextToArray(
                scriptData.script as string
              );
            exportData.script[scriptId] = scriptData;
          } catch (error) {
            if (
              !(
                error.response?.status === 403 &&
                error.response?.data?.message ===
                  'This operation is not available in ForgeRock Identity Cloud.'
              )
            ) {
              error.message = `Error retrieving script ${scriptId} referenced by ${key} key in client ${clientData['_id']}: ${error.message}`;
              throw error;
            }
          }
        }
      }
    }
  }
  debugMessage(`OAuth2ClientOps.exportOAuth2ClientDependencies: end`);
}

/**
 * Export all OAuth2 clients
 * @param {OAuth2ClientExportOptions} options export options
 * @returns {OAuth2ClientExportInterface} export data
 */
export async function exportOAuth2Clients({
  options = { useStringArrays: true, deps: true },
  state,
}: {
  options?: OAuth2ClientExportOptions;
  state: State;
}): Promise<OAuth2ClientExportInterface> {
  debugMessage(`OAuth2ClientOps.exportOAuth2Clients: start`);
  const exportData = createOAuth2ClientExportTemplate({ state });
  const errors = [];
  try {
    const provider = await getOAuth2Provider({ state });
    const clients = await getOAuth2Clients({ state });
    for (const client of clients) {
      try {
        client._provider = provider;
        exportData.application[client._id] = client;
        if (options.deps) {
          await exportOAuth2ClientDependencies(
            client,
            options,
            exportData,
            state
          );
        }
      } catch (error) {
        errors.push(error);
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage(`OAuth2ClientOps.exportOAuth2Clients: end`);
  return exportData;
}

/**
 * Export OAuth2 client by ID
 * @param {string} clientId oauth2 client id
 * @param {OAuth2ClientExportOptions} options export options
 * @returns {OAuth2ClientExportInterface} export data
 */
export async function exportOAuth2Client({
  clientId,
  options = { useStringArrays: true, deps: true },
  state,
}: {
  clientId: string;
  options?: OAuth2ClientExportOptions;
  state: State;
}): Promise<OAuth2ClientExportInterface> {
  debugMessage(`OAuth2ClientOps.exportOAuth2Client: start`);
  const exportData = createOAuth2ClientExportTemplate({ state });
  const errors = [];
  try {
    const clientData = await getOAuth2Client({ clientId, state });
    clientData._provider = await getOAuth2Provider({ state });
    exportData.application[clientData._id] = clientData;
    if (options.deps) {
      await exportOAuth2ClientDependencies(
        clientData,
        options,
        exportData,
        state
      );
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage(`OAuth2ClientOps.exportOAuth2Client: end`);
  return exportData;
}

/**
 * Helper function to export dependencies of an OAuth2 Client
 * @param {unknown} clientData oauth2 client data
 * @param {OAuth2ClientExportInterface} importData import data
 */
async function importOAuth2ClientDependencies(
  clientData: unknown,
  importData: OAuth2ClientExportInterface,
  state: State
) {
  for (const key of Object.keys(clientData['overrideOAuth2ClientConfig'])) {
    if (key.endsWith('Script')) {
      const scriptId = clientData['overrideOAuth2ClientConfig'][key];
      if (scriptId !== '[Empty]' && importData.script[scriptId]) {
        const scriptData: ScriptSkeleton = importData.script[scriptId];
        await putScript({ scriptId, scriptData, state });
      }
    }
  }
}

/**
 * Import OAuth2 Client by ID
 * @param {string} clientId client id
 * @param {OAuth2ClientExportInterface} importData import data
 * @param {OAuth2ClientImportOptions} options import options
 */
export async function importOAuth2Client({
  clientId,
  importData,
  options = { deps: true },
  state,
}: {
  clientId: string;
  importData: OAuth2ClientExportInterface;
  options?: OAuth2ClientImportOptions;
  state: State;
}) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.application)) {
    if (id === clientId) {
      try {
        const clientData = importData.application[id];
        delete clientData._provider;
        delete clientData._rev;
        if (options.deps) {
          await importOAuth2ClientDependencies(clientData, importData, state);
        }
        response = await putOAuth2Client({ clientId: id, clientData, state });
        imported.push(id);
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\n${clientId} not found in import data!`);
  }
  return response;
}

/**
 * Import first OAuth2 Client
 * @param {OAuth2ClientExportInterface} importData import data
 * @param {OAuth2ClientImportOptions} options import options
 */
export async function importFirstOAuth2Client({
  importData,
  options = { deps: true },
  state,
}: {
  importData: OAuth2ClientExportInterface;
  options?: OAuth2ClientImportOptions;
  state: State;
}) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.application)) {
    try {
      const clientData = importData.application[id];
      delete clientData._provider;
      delete clientData._rev;
      if (options.deps) {
        await importOAuth2ClientDependencies(clientData, importData, state);
      }
      response = await putOAuth2Client({ clientId: id, clientData, state });
      imported.push(id);
    } catch (error) {
      errors.push(error);
    }
    break;
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo clients found in import data!`);
  }
  return response;
}

/**
 * Import OAuth2 Clients
 * @param {OAuth2ClientExportInterface} importData import data
 * @param {OAuth2ClientImportOptions} options import options
 * @returns {Promise<unknown[]>} array of imported oauth2 clients
 */
export async function importOAuth2Clients({
  importData,
  options = { deps: true },
  state,
}: {
  importData: OAuth2ClientExportInterface;
  options?: OAuth2ClientImportOptions;
  state: State;
}): Promise<unknown[]> {
  const response = [];
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.application)) {
    try {
      const clientData = importData.application[id];
      delete clientData._provider;
      delete clientData._rev;
      if (options.deps) {
        await importOAuth2ClientDependencies(clientData, importData, state);
      }
      response.push(await putOAuth2Client({ clientId: id, clientData, state }));
      imported.push(id);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo clients found in import data!`);
  }
  return response;
}
