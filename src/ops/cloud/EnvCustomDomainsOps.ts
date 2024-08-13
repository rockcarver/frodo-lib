import {
  CustomDomains,
  getCustomDomains as _getCustomDomains,
  setCustomDomains as _setCustomDomains,
  verifyCNAME as _verifyCNAME,
} from '../../api/cloud/EnvCustomDomainsApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

export type EnvCustomDomains = {
  /**
   * Verify CNAME
   * @param {string} name CNAME to verify
   * @returns {Promise<boolean>} a promise that resolves to true if successul, false otherwise.
   */
  verifyCNAME(name: string): Promise<boolean>;
  /**
   * Read custom domains
   * @returns {Promise<CustomDomains>} a promise that resolves to a CustomDomains object
   */
  readCustomDomains(): Promise<CustomDomains>;
  /**
   * Update custom domains
   * @param {CustomDomains} domains CustomDomains object
   * @returns {Promise<CustomDomains>} a promise that resolves to a CustomDomains object.
   */
  updateCustomDomains(domains: CustomDomains): Promise<CustomDomains>;
};

export default (state: State): EnvCustomDomains => {
  return {
    async verifyCNAME(name: string): Promise<boolean> {
      return verifyCNAME({ name, state });
    },
    async readCustomDomains(): Promise<CustomDomains> {
      return readCustomDomains({ state });
    },
    async updateCustomDomains(domains: CustomDomains): Promise<CustomDomains> {
      return updateCustomDomains({ domains, state });
    },
  };
};

/**
 * Verify CNAME
 * @param {Object} params Parameters object.
 * @param {string} params.name CNAME to verify
 * @param {State} params.state State object.
 * @returns {Promise<boolean>} a promise that resolves to true if successul, false otherwise.
 */
export async function verifyCNAME({
  name,
  state,
}: {
  name: string;
  state: State;
}): Promise<boolean> {
  try {
    await _verifyCNAME({ name, state });
    return true;
  } catch (error) {
    const frodoError = new FrodoError(
      `Error verifying CNAME for ${name}`,
      error
    );
    if (
      frodoError.httpStatus === 400 &&
      frodoError.httpMessage === 'CNAME validation failed'
    ) {
      return false;
    }
    throw frodoError;
  }
}

/**
 * Read custom domains
 * @returns {Promise<CustomDomains>} a promise that resolves to a CustomDomains object
 */
export async function readCustomDomains({
  state,
}: {
  state: State;
}): Promise<CustomDomains> {
  try {
    const domains = await _getCustomDomains({ state });
    return domains;
  } catch (error) {
    throw new FrodoError(`Error reading custom domains`, error);
  }
}

/**
 * Update custom domains
 * @param {Object} params Parameters object.
 * @param {CustomDomains} params.domains CustomDomains object
 * @param {State} params.state State object.
 * @returns {Promise<CustomDomains>} a promise that resolves to a CustomDomains object.
 */
export async function updateCustomDomains({
  domains,
  state,
}: {
  domains: CustomDomains;
  state: State;
}): Promise<CustomDomains> {
  try {
    const result = await _setCustomDomains({ domains, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error updating custom domains`, error);
  }
}
