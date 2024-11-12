import {
  createRealm as _createRealm,
  deleteRealm as _deleteRealm,
  getRealm as _getRealm,
  getRealms as _getRealms,
  putRealm as _putRealm,
  RealmSkeleton,
} from '../api/RealmApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { getRealmName } from '../utils/ForgeRockUtils';
import { FrodoError } from './FrodoError';
import { ExportMetaData } from './OpsTypes';

export type Realm = {
  /**
   * Read all realms
   * @returns {Promise<RealmSkeleton[]>} a promise resolving to an array of realm objects
   */
  readRealms(): Promise<RealmSkeleton[]>;
  /**
   * Read realm
   * @param {string} realmId realm id
   * @returns {Promise<RealmSkeleton>} a promise resolving to a realm object
   */
  readRealm(realmId: string): Promise<RealmSkeleton>;
  /**
   * Read realm by name
   * @param {string} realmName realm name
   * @returns {Promise<RealmSkeleton>} a promise resolving to a realm object
   */
  readRealmByName(realmName: string): Promise<RealmSkeleton>;
  /**
   * Export all realms. The response can be saved to file as is.
   * @returns {Promise<RealmExportInterface>} Promise resolving to a RealmExportInterface object.
   */
  exportRealms(): Promise<RealmExportInterface>;
  /**
   * Create realm
   * @param {string} realmName realm name
   * @param {RealmSkeleton} realmData realm data
   * @returns {Promise<RealmSkeleton>} a promise resolving to a realm object
   */
  createRealm(
    realmName: string,
    realmData?: RealmSkeleton
  ): Promise<RealmSkeleton>;
  /**
   * Update realm
   * @param {string} realmId realm id
   * @param {RealmSkeleton} realmData realm data
   * @returns {Promise<RealmSkeleton>} a promise resolving to a realm object
   */
  updateRealm(
    realmId: string,
    realmData: RealmSkeleton
  ): Promise<RealmSkeleton>;
  /**
   * Import realms
   * @param {RealmExportInterface} importData realm import data
   * @param {string} realmId Optional realm id. If supplied, only the realm of that id is imported. Takes priority over realmName if both are provided.
   * @param {string} realmName Optional realm name. If supplied, only the realm of that name is imported.
   * @returns {Promise<RealmSkeleton[]>} the imported realms
   */
  importRealms(
    importData: RealmExportInterface,
    realmId?: string,
    realmName?: string
  ): Promise<RealmSkeleton[]>;
  /**
   * Delete realm
   * @param {string} realmId realm id
   * @returns {Promise<RealmSkeleton>} a promise resolving to a realm object
   */
  deleteRealm(realmId: string): Promise<RealmSkeleton>;
  /**
   * Delete realm by name
   * @param {string} realmName realm name
   * @returns {Promise<RealmSkeleton>} a promise resolving to a realm object
   */
  deleteRealmByName(realmName: string): Promise<RealmSkeleton>;
  /**
   * Add custom DNS domain name (realm DNS alias)
   * @param {string} realmName realm name
   * @param {string} domain domain name
   * @returns {Promise<RealmSkeleton>} a promise resolving to a realm object
   */
  addCustomDomain(realmName: string, domain: string): Promise<RealmSkeleton>;
  /**
   * Remove custom DNS domain name (realm DNS alias)
   * @param {string} realmName realm name
   * @param {string} domain domain name
   * @returns {Promise<RealmSkeleton>} a promise resolving to a realm object
   */
  removeCustomDomain(realmName: string, domain: string): Promise<RealmSkeleton>;

  // Deprecated

  /**
   * Get all realms
   * @returns {Promise<RealmSkeleton[]>} a promise resolving to an array of realm objects
   * @deprecated since v2.0.0 use {@link Realm.readRealms | readRealms} instead
   * ```javascript
   * readRealms(): Promise<RealmSkeleton[]>
   * ```
   * @group Deprecated
   */
  getRealms(): Promise<RealmSkeleton[]>;
  /**
   * Get realm by name
   * @param {string} realmName realm name
   * @returns {Promise<RealmSkeleton>} a promise resolving to a realm object
   * @deprecated since v2.0.0 use {@link Realm.readRealmByName | readRealmByName} instead
   * ```javascript
   * readRealmByName(realmName: string): Promise<RealmSkeleton>
   * ```
   * @group Deprecated
   */
  getRealmByName(realmName: string): Promise<RealmSkeleton>;
  /**
   * Update realm
   * @param {string} realmId realm id
   * @param {RealmSkeleton} realmData realm data
   * @returns {Promise<RealmSkeleton>} a promise resolving to a realm object
   * @deprecated since v2.0.0 use {@link Realm.updateRealm | updateRealm} or {@link Realm.createRealm | createRealm} instead
   * ```javascript
   * updateRealm(realmId: string, realmData: RealmSkeleton): Promise<RealmSkeleton>
   * createRealm(realmName: string, realmData: RealmSkeleton): Promise<RealmSkeleton>
   * ```
   * @group Deprecated
   */
  putRealm(realmId: string, realmData: RealmSkeleton): Promise<RealmSkeleton>;
};

export default (state: State): Realm => {
  return {
    readRealms(): Promise<RealmSkeleton[]> {
      return getRealms({ state });
    },
    readRealm(realmId: string): Promise<RealmSkeleton> {
      return getRealm({ realmId, state });
    },
    readRealmByName(realmName: string): Promise<RealmSkeleton> {
      return getRealmByName({ realmName, state });
    },
    exportRealms(): Promise<RealmExportInterface> {
      return exportRealms({ state });
    },
    createRealm(
      realmName: string,
      realmData?: RealmSkeleton
    ): Promise<RealmSkeleton> {
      return createRealm({ realmName, realmData, state });
    },
    updateRealm(
      realmId: string,
      realmData: RealmSkeleton
    ): Promise<RealmSkeleton> {
      return updateRealm({ realmId, realmData, state });
    },
    importRealms(
      importData: RealmExportInterface,
      realmId?: string,
      realmName?: string
    ): Promise<RealmSkeleton[]> {
      return importRealms({ realmId, realmName, importData, state });
    },
    deleteRealm(realmId: string): Promise<RealmSkeleton> {
      return deleteRealm({ realmId, state });
    },
    deleteRealmByName(realmName: string): Promise<RealmSkeleton> {
      return deleteRealmByName({ realmName, state });
    },
    async addCustomDomain(
      realmName: string,
      domain: string
    ): Promise<RealmSkeleton> {
      return addCustomDomain({ realmName, domain, state });
    },
    async removeCustomDomain(
      realmName: string,
      domain: string
    ): Promise<RealmSkeleton> {
      return removeCustomDomain({ realmName, domain, state });
    },

    // Deprecated

    getRealms(): Promise<RealmSkeleton[]> {
      return getRealms({ state });
    },
    getRealmByName(realmName: string): Promise<RealmSkeleton> {
      return getRealmByName({ realmName, state });
    },
    putRealm(
      realmId: string,
      realmData: RealmSkeleton
    ): Promise<RealmSkeleton> {
      return updateRealm({ realmId, realmData, state });
    },
  };
};

export interface RealmExportInterface {
  meta?: ExportMetaData;
  realm: Record<string, RealmSkeleton>;
}

/**
 * Create an empty realm export template
 * @returns {RealmExportInterface} an empty realm export template
 */
export function createRealmExportTemplate({
  state,
}: {
  state: State;
}): RealmExportInterface {
  return {
    meta: getMetadata({ state }),
    realm: {},
  };
}

/**
 * Get all realms
 * @returns {Promise} a promise that resolves to an object containing an array of realm objects
 */
export async function getRealms({ state }: { state: State }) {
  const { result } = await _getRealms({ state });
  return result;
}

/**
 * Export all realms. The response can be saved to file as is.
 * @returns {Promise<RealmExportInterface>} Promise resolving to a RealmExportInterface object.
 */
export async function exportRealms({
  state,
}: {
  state: State;
}): Promise<RealmExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `RealmOps.exportRealms: start`, state });
    const exportData = createRealmExportTemplate({ state });
    const realms = await getRealms({ state });
    indicatorId = createProgressIndicator({
      total: realms.length,
      message: 'Exporting realms...',
      state,
    });
    for (const realm of realms) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting realm ${realm.name}`,
        state,
      });
      // For root realm, it will export with null parent path, which on import causes an HTTP 500 error. With '' parent path, no 500 error is thrown on import while still meaning the same thing, so we use '' instead.
      if (realm.parentPath === null) {
        realm.parentPath = '';
      }
      exportData.realm[realm._id] = realm;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${realms.length} realms.`,
      state,
    });
    debugMessage({ message: `RealmOps.exportRealms: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting realms.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error reading realms`, error);
  }
}

/**
 * Create realm
 * @param {string} realmName realm name
 * @param {RealmSkeleton} realmData realm data
 * @returns {Promise<RealmSkeleton>} a promise resolving to a realm object
 */
export async function createRealm({
  realmName,
  realmData = undefined,
  state,
}: {
  realmName: string;
  realmData?: RealmSkeleton;
  state: State;
}): Promise<RealmSkeleton> {
  realmData.name = realmName;
  return _createRealm({ realmData, state });
}

/**
 * Update realm
 * @param {string} realmId realm id
 * @param {RealmSkeleton} realmData realm config object
 * @returns {Promise<RealmSkeleton>} a promise that resolves to a realm object
 */
export async function updateRealm({
  realmId,
  realmData,
  state,
}: {
  realmId: string;
  realmData: RealmSkeleton;
  state: State;
}): Promise<RealmSkeleton> {
  return _putRealm({ realmId, realmData, state });
}

/**
 * Import realms
 * @param {string} realmId Optional realm id. If supplied, only the realm of that id is imported. Takes priority over realmName if both are provided.
 * @param {string} realmName Optional realm name. If supplied, only the realm of that name is imported.
 * @param {RealmExportInterface} importData realm import data
 * @returns {Promise<RealmSkeleton[]>} the imported realms
 */
export async function importRealms({
  realmId,
  realmName,
  importData,
  state,
}: {
  realmId?: string;
  realmName?: string;
  importData: RealmExportInterface;
  state: State;
}): Promise<RealmSkeleton[]> {
  const errors = [];
  try {
    debugMessage({ message: `RealmOps.importRealms: start`, state });
    const response = [];
    for (const realm of Object.values(importData.realm)) {
      try {
        if (
          (realmId && realm._id !== realmId) ||
          (realmName && realm.name !== realmName)
        ) {
          continue;
        }
        const result = await updateRealm({
          realmId: realm._id,
          realmData: realm,
          state,
        });
        response.push(result);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing realms`, errors);
    }
    debugMessage({ message: `RealmOps.importRealms: end`, state });
    return response;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing realms`, error);
  }
}

/**
 * Get realm
 * @param {String} realmId realm id
 * @returns {Promise<RealmSkeleton>} a promise that resolves to a realm object
 */
export async function getRealm({
  realmId,
  state,
}: {
  realmId: string;
  state: State;
}): Promise<RealmSkeleton> {
  return _getRealm({ realmId, state });
}

/**
 * Get realm by name
 * @param {string} realmName realm name
 * @returns {Promise<RealmSkeleton>} a promise that resolves to a realm object
 */
export async function getRealmByName({
  realmName,
  state,
}: {
  realmName: string;
  state: State;
}): Promise<RealmSkeleton> {
  const realms = await getRealms({ state });
  for (const realm of realms) {
    if (getRealmName(realmName) === realm.name) {
      return realm;
    }
  }
  throw new Error(`Realm ${realmName} not found!`);
}

/**
 * Delete realm
 * @param {string} realmId realm id
 * @returns {Promise<RealmSkeleton>} a promise that resolves to an object containing a realm object
 */
export async function deleteRealm({
  realmId,
  state,
}: {
  realmId: string;
  state: State;
}): Promise<RealmSkeleton> {
  return _deleteRealm({ realmId, state });
}

/**
 * Delete realm by name
 * @param {string} realmName realm name
 * @returns {Promise<RealmSkeleton>} a promise that resolves to a realm object
 */
export async function deleteRealmByName({
  realmName,
  state,
}: {
  realmName: string;
  state: State;
}): Promise<RealmSkeleton> {
  const realms = await getRealms({ state });
  for (const realm of realms) {
    if (getRealmName(realmName) === realm.name) {
      return deleteRealm({ realmId: realm._id, state });
    }
  }
  throw new Error(`Realm ${realmName} not found!`);
}

/**
 * Add custom DNS domain name (realm DNS alias)
 * @param {string} realm realm name
 * @param {string} domain domain name
 * @returns {Promise<RealmSkeleton>} a promise that resolves to a realm object
 */
export async function addCustomDomain({
  realmName,
  domain,
  state,
}: {
  realmName: string;
  domain: string;
  state: State;
}): Promise<RealmSkeleton> {
  try {
    let realmData = await getRealmByName({ realmName, state });
    let exists = false;
    realmData.aliases.forEach((alias: string) => {
      if (domain.toLowerCase() === alias.toLowerCase()) {
        exists = true;
      }
    });
    if (!exists) {
      try {
        realmData.aliases.push(domain.toLowerCase());
        realmData = await _putRealm({
          realmId: realmData._id,
          realmData: realmData,
          state,
        });
        return realmData;
      } catch (error) {
        error.message = `Error adding custom domain ${domain} to realm ${realmName}: ${error.message}`;
        throw error;
      }
    }
  } catch (error) {
    error.message = `Error reading realm ${realmName}: ${error.message}`;
    throw error;
  }
}

/**
 * Remove custom DNS domain name (realm DNS alias)
 * @param {String} realm realm name
 * @param {String} domain domain name
 * @returns {Promise<RealmSkeleton>} a promise that resolves to a realm object
 */
export async function removeCustomDomain({
  realmName,
  domain,
  state,
}: {
  realmName: string;
  domain: string;
  state: State;
}): Promise<RealmSkeleton> {
  try {
    let realmData = await getRealmByName({ realmName, state });
    const aliases = realmData.aliases.filter(
      (alias: string) => domain.toLowerCase() !== alias.toLowerCase()
    );
    if (aliases.length < realmData.aliases.length) {
      try {
        realmData.aliases = aliases;
        realmData = await _putRealm({
          realmId: realmData._id,
          realmData: realmData,
          state,
        });
        return realmData;
      } catch (error) {
        error.message = `Error removing custom domain ${domain} from realm ${realmName}: ${error.message}`;
        throw error;
      }
    }
  } catch (error) {
    error.message = `Error reading realm ${realmName}: ${error.message}`;
    throw error;
  }
}
