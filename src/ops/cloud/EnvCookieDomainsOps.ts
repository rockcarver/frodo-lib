import {
  CookieDomains,
  getCookieDomains as _getCookieDomains,
  setCookieDomains as _setCookieDomains,
} from '../../api/cloud/EnvCookieDomainsApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

export type EnvCookieDomains = {
  /**
   * Read cookie domains
   * @returns {Promise<ContentSecurityPolicy>} a promise that resolves to a CookieDomains object
   */
  readCookieDomains(): Promise<CookieDomains>;
  /**
   * Update cookie domains
   * @param {CookieDomains} domains CookieDomains object
   * @returns {Promise<CookieDomains>} a promise that resolves to a CookieDomains object.
   */
  updateCookieDomains(domains: CookieDomains): Promise<CookieDomains>;
};

export default (state: State): EnvCookieDomains => {
  return {
    async readCookieDomains(): Promise<CookieDomains> {
      return readCookieDomains({ state });
    },
    async updateCookieDomains(policy: CookieDomains): Promise<CookieDomains> {
      return updateCookieDomains({ domains: policy, state });
    },
  };
};

/**
 * Read cookie domains
 * @returns {Promise<CookieDomains>} a promise that resolves to a CookieDomains object
 */
export async function readCookieDomains({
  state,
}: {
  state: State;
}): Promise<CookieDomains> {
  try {
    const domains = await _getCookieDomains({ state });
    return domains;
  } catch (error) {
    throw new FrodoError(`Error reading cookie domains`, error);
  }
}

/**
 * Update cookie domains
 * @param {Object} params Parameters object.
 * @param {CookieDomains} params.domains CookieDomains object
 * @param {State} params.state State object.
 * @returns {Promise<CookieDomains>} a promise that resolves to a CookieDomains object.
 */
export async function updateCookieDomains({
  domains,
  state,
}: {
  domains: CookieDomains;
  state: State;
}): Promise<CookieDomains> {
  try {
    const result = await _setCookieDomains({ domains, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error updating cookie domains`, error);
  }
}
