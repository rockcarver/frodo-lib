import { getRealms as _getRealms, putRealm } from '../api/RealmApi';
import { State } from '../shared/State';
import { getRealmName } from './utils/OpsUtils';

export type Realm = {
  getRealms(): Promise<any>;
  getRealmByName(realmName: string): Promise<any>;
  putRealm(realmId: string, realmData: object): Promise<any>;
  /**
   * Add custom DNS domain name (realm DNS alias)
   * @param {string} realm realm name
   * @param {string} domain domain name
   */
  addCustomDomain(realmName: string, domain: string): Promise<any>;
  /**
   * Remove custom DNS domain name (realm DNS alias)
   * @param {String} realm realm name
   * @param {String} domain domain name
   */
  removeCustomDomain(realmName: string, domain: string): Promise<any>;
};

export default (state: State): Realm => {
  return {
    getRealms() {
      return getRealms({ state });
    },

    getRealmByName(realmName: string) {
      return getRealmByName({ realmName, state });
    },

    putRealm(realmId: string, realmData: object) {
      return putRealm({ realmId, realmData, state });
    },

    /**
     * Add custom DNS domain name (realm DNS alias)
     * @param {string} realm realm name
     * @param {string} domain domain name
     */
    async addCustomDomain(realmName: string, domain: string) {
      return addCustomDomain({ realmName, domain, state });
    },

    /**
     * Remove custom DNS domain name (realm DNS alias)
     * @param {String} realm realm name
     * @param {String} domain domain name
     */
    async removeCustomDomain(realmName: string, domain: string) {
      return removeCustomDomain({ realmName, domain, state });
    },
  };
};

/**
 * Get all realms
 * @returns {Promise} a promise that resolves to an object containing an array of realm objects
 */
export async function getRealms({ state }: { state: State }) {
  const { result } = await _getRealms({ state });
  return result;
}

/**
 * Get realm by name
 * @param {String} realmName realm name
 * @returns {Promise} a promise that resolves to a realm object
 */
export async function getRealmByName({
  realmName,
  state,
}: {
  realmName: string;
  state: State;
}) {
  const realms = await getRealms({ state });
  for (const realm of realms) {
    if (getRealmName(realmName) === realm.name) {
      return realm;
    }
  }
  throw new Error(`Realm ${realmName} not found!`);
}

/**
 * Add custom DNS domain name (realm DNS alias)
 * @param {string} realm realm name
 * @param {string} domain domain name
 */
export async function addCustomDomain({
  realmName,
  domain,
  state,
}: {
  realmName: string;
  domain: string;
  state: State;
}) {
  try {
    let realmConfig = await getRealmByName({ realmName, state });
    let exists = false;
    realmConfig.aliases.forEach((alias: string) => {
      if (domain.toLowerCase() === alias.toLowerCase()) {
        exists = true;
      }
    });
    if (!exists) {
      try {
        realmConfig.aliases.push(domain.toLowerCase());
        realmConfig = await putRealm({
          realmId: realmConfig._id,
          realmData: realmConfig,
          state,
        });
        return realmConfig;
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
 */
export async function removeCustomDomain({
  realmName,
  domain,
  state,
}: {
  realmName: string;
  domain: string;
  state: State;
}) {
  try {
    let realmConfig = await getRealmByName({ realmName, state });
    const aliases = realmConfig.aliases.filter(
      (alias: string) => domain.toLowerCase() !== alias.toLowerCase()
    );
    if (aliases.length < realmConfig.aliases.length) {
      try {
        realmConfig.aliases = aliases;
        realmConfig = await putRealm({
          realmId: realmConfig._id,
          realmData: realmConfig,
          state,
        });
        return realmConfig;
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

export { putRealm };
