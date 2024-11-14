import {
  createServer as _createServer,
  getDefaultServerProperties,
  getServer,
  getServerProperties,
  getServers,
  putDefaultServerProperties,
  putServerProperties,
  ServerPropertiesSkeleton,
  ServerSkeleton,
} from '../../api/classic/ServerApi';
import { State } from '../../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../../utils/Console';
import { getMetadata } from '../../utils/ExportImportUtils';
import { FrodoError } from '../FrodoError';
import { ExportMetaData } from '../OpsTypes';

export type Server = {
  /**
   * Create an empty server export template
   * @returns {ServerExportInterface} an empty server export template
   */
  createServerExportTemplate(): ServerExportInterface;
  /**
   * Read server by id
   * @param {string} serverId Server id
   * @returns {Promise<ServerSkeleton>} a promise that resolves to a server object
   */
  readServer(serverId: string): Promise<ServerSkeleton>;
  /**
   * Read server by url
   * @param {string} serverUrl Server url
   * @returns {Promise<ServerSkeleton>} a promise that resolves to a server object
   */
  readServerByUrl(serverUrl: string): Promise<ServerSkeleton>;
  /**
   * Read all servers.
   * @returns {Promise<ServerSkeleton[]>} a promise that resolves to an array of server objects
   */
  readServers(): Promise<ServerSkeleton[]>;
  /**
   * Export a single server by id. The response can be saved to file as is.
   * @param {string} serverId Server id
   * @param {ServerExportOptions} options Server export options
   * @returns {Promise<ServerExportInterface>} Promise resolving to a ServerExportInterface object.
   */
  exportServer(
    serverId: string,
    options: ServerExportOptions
  ): Promise<ServerExportInterface>;
  /**
   * Export a single server by url. The response can be saved to file as is.
   * @param {string} serverUrl Server url
   * @param {ServerExportOptions} options Server export options
   * @returns {Promise<ServerExportInterface>} Promise resolving to a ServerExportInterface object.
   */
  exportServerByUrl(
    serverUrl: string,
    options: ServerExportOptions
  ): Promise<ServerExportInterface>;
  /**
   * Export all servers. The response can be saved to file as is.
   * @param {ServerExportOptions} options Server export options
   * @returns {Promise<ServerExportInterface>} Promise resolving to a ServerExportInterface object.
   */
  exportServers(options: ServerExportOptions): Promise<ServerExportInterface>;
  /**
   * Creates a server
   * @param {ServerSkeleton} serverData server object
   * @returns {Promise<ServerSkeleton>} a promise that resolves to a server object
   */
  createServer(serverData: ServerSkeleton): Promise<ServerSkeleton>;
  /**
   * Imports the first server from the importData
   * @param importData server import data
   * @param options server import options
   */
  importFirstServer(
    importData: ServerExportInterface,
    options: ServerImportOptions
  ): Promise<ServerExportInterface>;
  /**
   * Imports servers along with their properties
   * @param {ServerExportInterface} importData server import data
   * @param {ServerImportOptions} options server import options
   * @param {string} serverId Optional server id. If supplied, only the server (and its properties) of that id is imported. Takes priority over serverUrl if both are provided.
   * @param {string} serverUrl Optional server url. If supplied, only the server of that url is imported.
   * @returns {Promise<ServerExportInterface>} a promise that resolves to a server export object
   */
  importServers(
    importData: ServerExportInterface,
    options: ServerImportOptions,
    serverId?: string,
    serverUrl?: string
  ): Promise<ServerExportInterface>;
};

export default (state: State): Server => {
  return {
    createServerExportTemplate(): ServerExportInterface {
      return createServerExportTemplate({ state });
    },
    async readServer(serverId: string): Promise<ServerSkeleton> {
      return readServer({ serverId, state });
    },
    async readServerByUrl(serverUrl: string): Promise<ServerSkeleton> {
      return readServerByUrl({ serverUrl, state });
    },
    async readServers(): Promise<ServerSkeleton[]> {
      return readServers({ state });
    },
    async exportServer(
      serverId: string,
      options: ServerExportOptions = { includeDefault: false }
    ): Promise<ServerExportInterface> {
      return exportServer({ serverId, options, state });
    },
    async exportServerByUrl(
      serverUrl: string,
      options: ServerExportOptions = { includeDefault: false }
    ): Promise<ServerExportInterface> {
      return exportServerByUrl({ options, serverUrl, state });
    },
    async exportServers(
      options: ServerExportOptions = { includeDefault: false }
    ): Promise<ServerExportInterface> {
      return exportServers({ options, state });
    },
    async createServer(serverData: ServerSkeleton): Promise<ServerSkeleton> {
      return createServer({
        serverData,
        state,
      });
    },
    async importFirstServer(
      importData: ServerExportInterface,
      options: ServerImportOptions = {
        includeDefault: false,
      }
    ): Promise<ServerExportInterface> {
      return importFirstServer({
        importData,
        options,
        state,
      });
    },
    async importServers(
      importData: ServerExportInterface,
      options: ServerImportOptions = {
        includeDefault: false,
      },
      serverId?: string,
      serverUrl?: string
    ): Promise<ServerExportInterface> {
      return importServers({
        importData,
        options,
        serverId,
        serverUrl,
        state,
      });
    },
  };
};

/**
 * Server export options
 */
export interface ServerExportOptions {
  /**
   * True to export the default server properties, false otherwise
   */
  includeDefault: boolean;
}

/**
 * Server import options
 */
export interface ServerImportOptions {
  /**
   * True to import the default server properties, false otherwise
   */
  includeDefault: boolean;
}

export type ServerExportSkeleton = ServerSkeleton & {
  properties: ServerPropertiesSkeleton;
};

export interface ServerExportInterface {
  meta?: ExportMetaData;
  server: Record<string, ServerExportSkeleton>;
  defaultProperties: ServerPropertiesSkeleton;
}

/**
 * Create an empty server export template
 * @returns {ServerExportInterface} an empty server export template
 */
export function createServerExportTemplate({
  state,
}: {
  state: State;
}): ServerExportInterface {
  return {
    meta: getMetadata({ state }),
    server: {},
    defaultProperties: {} as ServerPropertiesSkeleton,
  };
}

/**
 * Read server by id
 * @param {string} serverId Server id
 * @returns {Promise<ServerSkeleton>} a promise that resolves to a server object
 */
export async function readServer({
  serverId,
  state,
}: {
  serverId: string;
  state: State;
}): Promise<ServerSkeleton> {
  try {
    return getServer({ serverId, state });
  } catch (error) {
    throw new FrodoError(`Error reading server ${serverId}`, error);
  }
}

/**
 * Read server by url
 * @param {string} serverUrl Server url
 * @returns {Promise<ServerSkeleton>} a promise that resolves to a server object
 */
export async function readServerByUrl({
  serverUrl,
  state,
}: {
  serverUrl: string;
  state: State;
}): Promise<ServerSkeleton> {
  try {
    const servers = await readServers({ state });
    const found = servers.filter((server) => server.url.includes(serverUrl));
    if (found.length === 1) {
      return found[0];
    }
    if (found.length > 1) {
      throw new Error(`Multiple servers with the url '${serverUrl}' found!`);
    }
    throw new Error(`Server '${serverUrl}' not found!`);
  } catch (error) {
    throw new FrodoError(`Error reading server ${serverUrl}`, error);
  }
}

/**
 * Read all servers.
 * @returns {Promise<ServerSkeleton[]>} a promise that resolves to an array of server objects
 */
export async function readServers({
  state,
}: {
  state: State;
}): Promise<ServerSkeleton[]> {
  try {
    debugMessage({
      message: `ServerOps.readServers: start`,
      state,
    });
    const { result } = await getServers({ state });
    debugMessage({ message: `ServerOps.readServers: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading servers`, error);
  }
}

/**
 * Export a single server by id. The response can be saved to file as is.
 * @param {string} serverId Server id
 * @param {ServerExportOptions} options Server export options
 * @returns {Promise<ServerExportInterface>} Promise resolving to a ServerExportInterface object.
 */
export async function exportServer({
  serverId,
  options = {
    includeDefault: false,
  },
  state,
}: {
  serverId: string;
  options: ServerExportOptions;
  state: State;
}): Promise<ServerExportInterface> {
  try {
    const server = (await readServer({
      serverId,
      state,
    })) as ServerExportSkeleton;
    server.properties = await getServerProperties({ serverId, state });
    const exportData = createServerExportTemplate({ state });
    exportData.server[serverId] = server as ServerExportSkeleton;
    if (options.includeDefault) {
      exportData.defaultProperties = await getDefaultServerProperties({
        state,
      });
    }
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting server ${serverId}`, error);
  }
}

/**
 * Export a single server by url. The response can be saved to file as is.
 * @param {string} serverUrl Server url
 * @param {ServerExportOptions} options Server export options
 * @returns {Promise<ServerExportInterface>} Promise resolving to a ServerExportInterface object.
 */
export async function exportServerByUrl({
  serverUrl,
  options = {
    includeDefault: false,
  },
  state,
}: {
  serverUrl: string;
  options: ServerExportOptions;
  state: State;
}): Promise<ServerExportInterface> {
  try {
    const server = (await readServerByUrl({
      serverUrl,
      state,
    })) as ServerExportSkeleton;
    server.properties = await getServerProperties({
      serverId: server._id,
      state,
    });
    const exportData = createServerExportTemplate({ state });
    exportData.server[server._id] = server as ServerExportSkeleton;
    if (options.includeDefault) {
      exportData.defaultProperties = await getDefaultServerProperties({
        state,
      });
    }
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting server ${serverUrl}`, error);
  }
}

/**
 * Export all servers. The response can be saved to file as is.
 * @param {ServerExportOptions} options Server export options
 * @returns {Promise<ServerExportInterface>} Promise resolving to a ServerExportInterface object.
 */
export async function exportServers({
  options = {
    includeDefault: false,
  },
  state,
}: {
  options: ServerExportOptions;
  state: State;
}): Promise<ServerExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `ServerOps.exportServers: start`, state });
    const exportData = createServerExportTemplate({ state });
    const servers = await readServers({ state });
    indicatorId = createProgressIndicator({
      total: servers.length,
      message: 'Exporting servers...',
      state,
    });
    for (const server of servers) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting server ${server.url}`,
        state,
      });
      server.properties = await getServerProperties({
        serverId: server._id,
        state,
      });
      exportData.server[server._id] = server as ServerExportSkeleton;
    }
    if (options.includeDefault) {
      exportData.defaultProperties = await getDefaultServerProperties({
        state,
      });
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${servers.length} servers.`,
      state,
    });
    debugMessage({ message: `ServerOps.exportServers: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting servers.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error reading servers`, error);
  }
}

/**
 * Creates a server
 * @param {ServerSkeleton} serverData server object
 * @returns {Promise<ServerSkeleton>} a promise that resolves to a server object
 */
export async function createServer({
  serverData,
  state,
}: {
  serverData: ServerSkeleton;
  state;
}): Promise<ServerSkeleton> {
  try {
    return await _createServer({ serverData, state });
  } catch (error) {
    throw new FrodoError(
      `Error creating server with id '${serverData._id}' and URL '${serverData.url}'`,
      error
    );
  }
}

/**
 * Import first server
 * @param {ServerExportInterface} importData import data
 * @param {ServerImportOptions} options import options
 * @returns {Promise<ServerExportInterface>} a promise that resolves to a server export object
 */
export async function importFirstServer({
  importData,
  options = {
    includeDefault: true,
  },
  state,
}: {
  importData: ServerExportInterface;
  options?: ServerImportOptions;
  state: State;
}): Promise<ServerExportInterface> {
  debugMessage({ message: `ServerOps.importFirstServer: start`, state });
  const response = createServerExportTemplate({ state });
  delete response.meta;
  const server = Object.values(importData.server)[0];
  if (!server) {
    throw new FrodoError(`No servers found in import data!`);
  }
  importServers({
    serverId: server._id,
    importData,
    options,
    state,
  });
  debugMessage({ message: `ServerOps.importFirstServer: end`, state });
  return response;
}

/**
 * Imports servers along with their properties
 * @param {string} serverId Optional server id. If supplied, only the server (and its properties) of that id is imported. Takes priority over serverUrl if both are provided.
 * @param {string} serverUrl Optional server url. If supplied, only the server of that url is imported.
 * @param {ServerExportInterface} importData server import data
 * @param {ServerImportOptions} options server import options
 * @returns {Promise<ServerExportInterface>} a promise that resolves to a server export object
 */
export async function importServers({
  serverId,
  serverUrl,
  importData,
  options = {
    includeDefault: false,
  },
  state,
}: {
  serverId?: string;
  serverUrl?: string;
  importData: ServerExportInterface;
  options: ServerImportOptions;
  state;
}): Promise<ServerExportInterface> {
  const errors = [];
  try {
    debugMessage({ message: `ServerOps.importServers: start`, state });
    const response = createServerExportTemplate({ state });
    delete response.meta;
    for (const server of Object.values(importData.server)) {
      const serverProperties = server.properties;
      delete server.properties;
      try {
        if (
          (serverId && server._id !== serverId) ||
          (serverUrl && server.url !== serverUrl)
        ) {
          continue;
        }
        // Attempt to create server in case it doesn't exist
        let serverResult;
        try {
          serverResult = await _createServer({
            serverData: server,
            state,
          });
        } catch (e) {
          // If server exists, ignore the error
          if (
            e.response?.status !== 400 ||
            e.response?.data?.message !== 'Update not supported'
          ) {
            throw new FrodoError(
              `Error creating server with id '${server._id}' and URL '${server.url}'`,
              e
            );
          }
          serverResult = server;
        }
        // Import server properties
        serverResult.properties = await putServerProperties({
          serverId: server._id,
          serverPropertiesData: serverProperties,
          state,
        });
        response.server[server._id] = serverResult;
      } catch (error) {
        errors.push(error);
      }
    }
    // Import default server properties
    if (options.includeDefault) {
      response.defaultProperties = await putDefaultServerProperties({
        defaultServerPropertiesData: importData.defaultProperties,
        state,
      });
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing servers`, errors);
    }
    debugMessage({ message: `ServerOps.importServers: end`, state });
    return response;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing servers`, error);
  }
}
