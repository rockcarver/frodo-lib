import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  deleteConfigEntity,
  getConfigEntity,
  putConfigEntity,
} from '../api/IdmConfigApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { getHostOnlyUrl } from '../utils/ForgeRockUtils';
import { FrodoError, isNotFoundError } from './FrodoError';
import { readConfigEntitiesByType } from './IdmConfigOps';
import { ExportMetaData } from './OpsTypes';

export type RemoteProxy = {
  /**
   * Remote proxy type key used to build the IDM id: 'external.idm/<id>'
   */
  REMOTE_PROXY_TYPE: string;
  /**
   * Get the IDM base URL that routes IDM REST calls through a remote proxy to
   * the receiving tenant: `<host>/openidm/external/idm/<proxyId>`. Every IDM
   * REST call (managed objects, config, ...) addressed below it is made on the
   * receiving tenant by the mapped user of the proxy.
   * @param {string} proxyId id/name of the remote proxy without the type prefix
   * @returns {string} the IDM base URL of the remote proxy
   */
  getRemoteProxyBaseUrl(proxyId: string): string;
  /**
   * Create an empty remote proxy export template
   * @returns {RemoteProxyExportInterface} an empty remote proxy export template
   */
  createRemoteProxyExportTemplate(): RemoteProxyExportInterface;
  /**
   * Read all remote proxies
   * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of remote proxy objects
   */
  readRemoteProxies(): Promise<RemoteProxySkeleton[]>;
  /**
   * Read remote proxy
   * @param {string} proxyId id/name of the remote proxy (the name of the receiving tenant) without the type prefix
   * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
   */
  readRemoteProxy(proxyId: string): Promise<RemoteProxySkeleton>;
  /**
   * Export remote proxy. The response can be saved to file as is.
   * @param {string} proxyId id/name of the remote proxy without the type prefix
   * @returns {Promise<RemoteProxyExportInterface>} a promise that resolves to a RemoteProxyExportInterface object
   */
  exportRemoteProxy(proxyId: string): Promise<RemoteProxyExportInterface>;
  /**
   * Export all remote proxies. The response can be saved to file as is.
   * @returns {Promise<RemoteProxyExportInterface>} a promise that resolves to a RemoteProxyExportInterface object
   */
  exportRemoteProxies(): Promise<RemoteProxyExportInterface>;
  /**
   * Create remote proxy. Fails if it already exists.
   * @param {string} proxyId id/name of the remote proxy without the type prefix
   * @param {RemoteProxySkeleton} proxyData remote proxy object
   * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
   */
  createRemoteProxy(
    proxyId: string,
    proxyData: RemoteProxySkeleton
  ): Promise<RemoteProxySkeleton>;
  /**
   * Update or create remote proxy
   * @param {string} proxyId id/name of the remote proxy without the type prefix
   * @param {RemoteProxySkeleton} proxyData remote proxy object
   * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
   */
  updateRemoteProxy(
    proxyId: string,
    proxyData: RemoteProxySkeleton
  ): Promise<RemoteProxySkeleton>;
  /**
   * Import remote proxies
   * @param {RemoteProxyExportInterface} importData import data
   * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of remote proxy objects
   */
  importRemoteProxies(
    importData: RemoteProxyExportInterface
  ): Promise<RemoteProxySkeleton[]>;
  /**
   * Delete all remote proxies
   * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of the deleted remote proxy objects
   */
  deleteRemoteProxies(): Promise<RemoteProxySkeleton[]>;
  /**
   * Delete remote proxy
   * @param {string} proxyId id/name of the remote proxy without the type prefix
   * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to the deleted remote proxy object
   */
  deleteRemoteProxy(proxyId: string): Promise<RemoteProxySkeleton>;
};

export default (state: State): RemoteProxy => {
  return {
    REMOTE_PROXY_TYPE,
    getRemoteProxyBaseUrl(proxyId: string): string {
      return getRemoteProxyBaseUrl({ proxyId, state });
    },
    createRemoteProxyExportTemplate(): RemoteProxyExportInterface {
      return createRemoteProxyExportTemplate({ state });
    },
    async readRemoteProxies(): Promise<RemoteProxySkeleton[]> {
      return readRemoteProxies({ state });
    },
    async readRemoteProxy(proxyId: string): Promise<RemoteProxySkeleton> {
      return readRemoteProxy({ proxyId, state });
    },
    async exportRemoteProxy(
      proxyId: string
    ): Promise<RemoteProxyExportInterface> {
      return exportRemoteProxy({ proxyId, state });
    },
    async exportRemoteProxies(): Promise<RemoteProxyExportInterface> {
      return exportRemoteProxies({ state });
    },
    async createRemoteProxy(
      proxyId: string,
      proxyData: RemoteProxySkeleton
    ): Promise<RemoteProxySkeleton> {
      return createRemoteProxy({ proxyId, proxyData, state });
    },
    async updateRemoteProxy(
      proxyId: string,
      proxyData: RemoteProxySkeleton
    ): Promise<RemoteProxySkeleton> {
      return updateRemoteProxy({ proxyId, proxyData, state });
    },
    async importRemoteProxies(
      importData: RemoteProxyExportInterface
    ): Promise<RemoteProxySkeleton[]> {
      return importRemoteProxies({ importData, state });
    },
    async deleteRemoteProxies(): Promise<RemoteProxySkeleton[]> {
      return deleteRemoteProxies({ state });
    },
    async deleteRemoteProxy(proxyId: string): Promise<RemoteProxySkeleton> {
      return deleteRemoteProxy({ proxyId, state });
    },
  };
};

/**
 * Remote proxy type key used to build the IDM id: 'external.idm/<id>'
 */
export const REMOTE_PROXY_TYPE = 'external.idm';

/**
 * A remote proxy configuration: the connection from this tenant to a
 * receiving tenant. The id is the name of the receiving tenant.
 */
export type RemoteProxySkeleton = IdObjectSkeletonInterface & {
  enabled?: boolean;
  authType: 'basic' | 'bearer';
  /**
   * URL of the receiving tenant's IDM, with a trailing slash
   */
  instanceUrl: string;
  // authType 'basic'
  userName?: string;
  password?: string;
  // authType 'bearer'
  clientId?: string;
  clientSecret?: string;
  tokenEndpoint?: string;
  tokenEndpointAuthMethod?: string;
  scope?: string[];
  scopeDelimiter?: string;
};

export interface RemoteProxyExportInterface {
  meta?: ExportMetaData;
  remoteProxy: Record<string, RemoteProxySkeleton>;
}

/**
 * Properties each authentication type needs
 */
const REQUIRED_PROPERTIES: Record<string, string[]> = {
  basic: ['userName', 'password'],
  bearer: ['clientId', 'clientSecret', 'tokenEndpoint'],
};

/**
 * Check a remote proxy before it is sent to the tenant
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @param {RemoteProxySkeleton} proxyData remote proxy object
 */
function validateRemoteProxy(
  proxyId: string,
  proxyData: RemoteProxySkeleton
): void {
  const authType = proxyData?.authType;
  if (!Object.keys(REQUIRED_PROPERTIES).includes(authType)) {
    throw new FrodoError(
      `Remote proxy ${proxyId} has authType '${authType}'; expected 'basic' or 'bearer'`
    );
  }
  if (
    typeof proxyData.instanceUrl !== 'string' ||
    !proxyData.instanceUrl.endsWith('/')
  ) {
    throw new FrodoError(
      `Remote proxy ${proxyId} needs an instanceUrl that ends with a trailing slash`
    );
  }
  const missing = REQUIRED_PROPERTIES[authType].filter(
    (property) => !proxyData[property]
  );
  if (missing.length > 0) {
    throw new FrodoError(
      `Remote proxy ${proxyId} with authType '${authType}' is missing ${missing.join(', ')}`
    );
  }
}

/**
 * Get the IDM base URL that routes IDM REST calls through a remote proxy to
 * the receiving tenant: `<host>/openidm/external/idm/<proxyId>`.
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @returns {string} the IDM base URL of the remote proxy
 */
export function getRemoteProxyBaseUrl({
  proxyId,
  state,
}: {
  proxyId: string;
  state: State;
}): string {
  return `${getHostOnlyUrl(state.getHost())}/openidm/external/idm/${proxyId}`;
}

export function createRemoteProxyExportTemplate({
  state,
}: {
  state: State;
}): RemoteProxyExportInterface {
  return {
    meta: getMetadata({ state }),
    remoteProxy: {},
  } as RemoteProxyExportInterface;
}

/**
 * Read all remote proxies
 * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of remote proxy objects
 */
export async function readRemoteProxies({
  state,
}: {
  state: State;
}): Promise<RemoteProxySkeleton[]> {
  try {
    const proxies = await readConfigEntitiesByType({
      type: `${REMOTE_PROXY_TYPE}/`,
      state,
    });
    return proxies as RemoteProxySkeleton[];
  } catch (error) {
    throw new FrodoError(`Error reading remote proxies`, error);
  }
}

/**
 * Read remote proxy
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
 */
export async function readRemoteProxy({
  proxyId,
  state,
}: {
  proxyId: string;
  state: State;
}): Promise<RemoteProxySkeleton> {
  try {
    return (await getConfigEntity({
      entityId: `${REMOTE_PROXY_TYPE}/${proxyId}`,
      state,
    })) as RemoteProxySkeleton;
  } catch (error) {
    throw new FrodoError(`Error reading remote proxy ${proxyId}`, error);
  }
}

/**
 * Export remote proxy. The response can be saved to file as is.
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @returns {Promise<RemoteProxyExportInterface>} a promise that resolves to a RemoteProxyExportInterface object
 */
export async function exportRemoteProxy({
  proxyId,
  state,
}: {
  proxyId: string;
  state: State;
}): Promise<RemoteProxyExportInterface> {
  try {
    debugMessage({
      message: `RemoteProxyOps.exportRemoteProxy: start [proxyId=${proxyId}]`,
      state,
    });
    const exportData = createRemoteProxyExportTemplate({ state });
    exportData.remoteProxy[proxyId] = await readRemoteProxy({
      proxyId,
      state,
    });
    debugMessage({
      message: `RemoteProxyOps.exportRemoteProxy: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting remote proxy ${proxyId}`, error);
  }
}

/**
 * Export all remote proxies. The response can be saved to file as is.
 * @returns {Promise<RemoteProxyExportInterface>} a promise that resolves to a RemoteProxyExportInterface object
 */
export async function exportRemoteProxies({
  state,
}: {
  state: State;
}): Promise<RemoteProxyExportInterface> {
  try {
    debugMessage({
      message: `RemoteProxyOps.exportRemoteProxies: start`,
      state,
    });
    const exportData = createRemoteProxyExportTemplate({ state });
    const remoteProxies = await readRemoteProxies({ state });
    const indicatorId = createProgressIndicator({
      total: remoteProxies.length,
      message: 'Exporting remote proxies...',
      state,
    });
    for (const remoteProxy of remoteProxies) {
      const proxyId = remoteProxy._id.replace(`${REMOTE_PROXY_TYPE}/`, '');
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting remote proxy ${proxyId}`,
        state,
      });
      exportData.remoteProxy[proxyId] = remoteProxy;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${remoteProxies.length} remote proxies.`,
      state,
    });
    debugMessage({
      message: `RemoteProxyOps.exportRemoteProxies: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting remote proxies`, error);
  }
}

/**
 * Create remote proxy. Fails if it already exists.
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @param {RemoteProxySkeleton} proxyData remote proxy object
 * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
 */
export async function createRemoteProxy({
  proxyId,
  proxyData,
  state,
}: {
  proxyId: string;
  proxyData: RemoteProxySkeleton;
  state: State;
}): Promise<RemoteProxySkeleton> {
  debugMessage({
    message: `RemoteProxyOps.createRemoteProxy: start`,
    state,
  });
  validateRemoteProxy(proxyId, proxyData);
  try {
    await readRemoteProxy({ proxyId, state });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw new FrodoError(
        `Error checking if remote proxy ${proxyId} already exists`,
        error
      );
    }
    try {
      const result = await putConfigEntity({
        entityId: `${REMOTE_PROXY_TYPE}/${proxyId}`,
        entityData: proxyData,
        state,
      });
      debugMessage({
        message: `RemoteProxyOps.createRemoteProxy: end`,
        state,
      });
      return result as RemoteProxySkeleton;
    } catch (error) {
      throw new FrodoError(`Error creating remote proxy ${proxyId}`, error);
    }
  }
  throw new FrodoError(`Remote proxy ${proxyId} already exists!`);
}

/**
 * Update or create remote proxy
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @param {RemoteProxySkeleton} proxyData remote proxy object
 * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to a remote proxy object
 */
export async function updateRemoteProxy({
  proxyId,
  proxyData,
  state,
}: {
  proxyId: string;
  proxyData: RemoteProxySkeleton;
  state: State;
}): Promise<RemoteProxySkeleton> {
  validateRemoteProxy(proxyId, proxyData);
  try {
    const remoteProxy = await putConfigEntity({
      entityId: `${REMOTE_PROXY_TYPE}/${proxyId}`,
      entityData: proxyData,
      state,
    });
    return remoteProxy as RemoteProxySkeleton;
  } catch (error) {
    throw new FrodoError(`Error updating remote proxy ${proxyId}`, error);
  }
}

/**
 * Import remote proxies
 * @param {RemoteProxyExportInterface} importData import data
 * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of remote proxy objects
 */
export async function importRemoteProxies({
  importData,
  state,
}: {
  importData: RemoteProxyExportInterface;
  state: State;
}): Promise<RemoteProxySkeleton[]> {
  debugMessage({
    message: `RemoteProxyOps.importRemoteProxies: start`,
    state,
  });
  const response: RemoteProxySkeleton[] = [];
  const errors = [];
  for (const proxyId of Object.keys(importData.remoteProxy)) {
    try {
      debugMessage({
        message: `RemoteProxyOps.importRemoteProxies: ${proxyId}`,
        state,
      });
      response.push(
        await updateRemoteProxy({
          proxyId,
          proxyData: importData.remoteProxy[proxyId],
          state,
        })
      );
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error importing remote proxies`, errors);
  }
  debugMessage({
    message: `RemoteProxyOps.importRemoteProxies: end`,
    state,
  });
  return response;
}

/**
 * Delete all remote proxies
 * @returns {Promise<RemoteProxySkeleton[]>} a promise that resolves to an array of the deleted remote proxy objects
 */
export async function deleteRemoteProxies({
  state,
}: {
  state: State;
}): Promise<RemoteProxySkeleton[]> {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `RemoteProxyOps.deleteRemoteProxies: start`,
      state,
    });
    const result: RemoteProxySkeleton[] = [];
    const remoteProxies = await readRemoteProxies({ state });
    for (const remoteProxy of remoteProxies) {
      try {
        debugMessage({
          message: `RemoteProxyOps.deleteRemoteProxies: '${remoteProxy._id}'`,
          state,
        });
        result.push(
          (await deleteConfigEntity({
            entityId: remoteProxy._id,
            state,
          })) as RemoteProxySkeleton
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting remote proxies`, errors);
    }
    debugMessage({
      message: `RemoteProxyOps.deleteRemoteProxies: end`,
      state,
    });
    return result;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting remote proxies`, error);
  }
}

/**
 * Delete remote proxy
 * @param {string} proxyId id/name of the remote proxy without the type prefix
 * @returns {Promise<RemoteProxySkeleton>} a promise that resolves to the deleted remote proxy object
 */
export async function deleteRemoteProxy({
  proxyId,
  state,
}: {
  proxyId: string;
  state: State;
}): Promise<RemoteProxySkeleton> {
  try {
    const remoteProxy = await deleteConfigEntity({
      entityId: `${REMOTE_PROXY_TYPE}/${proxyId}`,
      state,
    });
    return remoteProxy as RemoteProxySkeleton;
  } catch (error) {
    throw new FrodoError(`Error deleting remote proxy ${proxyId}`, error);
  }
}
