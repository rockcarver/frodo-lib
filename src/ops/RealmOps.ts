import { getRealmByName, getRealms, putRealm } from '../api/RealmApi';
import State from '../shared/State';

export default class RealmOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  getRealmByName(realmName: string) {
    return getRealmByName({ realmName, state: this.state });
  }

  getRealms() {
    return getRealms({ state: this.state });
  }

  putRealm(realmId: string, realmData: object) {
    return putRealm({ realmId, realmData, state: this.state });
  }

  /**
   * Add custom DNS domain name (realm DNS alias)
   * @param {string} realm realm name
   * @param {string} domain domain name
   */
  async addCustomDomain(realmName: string, domain: string) {
    return addCustomDomain({ realmName, domain, state: this.state });
  }

  /**
   * Remove custom DNS domain name (realm DNS alias)
   * @param {String} realm realm name
   * @param {String} domain domain name
   */
  async removeCustomDomain(realmName: string, domain: string) {
    return removeCustomDomain({ realmName, domain, state: this.state });
  }
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

export { getRealmByName, getRealms, putRealm };
