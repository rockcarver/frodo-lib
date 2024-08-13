import {
  getSSOCookieConfig as _getSSOCookieConfig,
  resetSSOCookieConfig as _resetSSOCookieConfig,
  setSSOCookieConfig as _setSSOCookieConfig,
  SSOCookieConfig,
} from '../../api/cloud/EnvSSOCookieConfigApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

export type EnvSSOCookieConfig = {
  /**
   * Read SSO cookie configuration
   * @returns {Promise<SSOCookieConfig>} a promise that resolves to an SSOCookieConfig object.
   */
  readSSOCookieConfig(): Promise<SSOCookieConfig>;
  /**
   * Reset SSO cookie configuration
   * @returns {Promise<SSOCookieConfig>} a promise that resolves to an SSOCookieConfig object.
   */
  resetSSOCookieConfig(): Promise<SSOCookieConfig>;
  /**
   * Update SSO cookie configuration
   * @param {SSOCookieConfig} config SSOCookieConfig object
   * @returns {Promise<SSOCookieConfig>} a promise that resolves to an SSOCookieConfig object.
   */
  updateSSOCookieConfig(config: SSOCookieConfig): Promise<SSOCookieConfig>;
};

export default (state: State): EnvSSOCookieConfig => {
  return {
    async readSSOCookieConfig(): Promise<SSOCookieConfig> {
      return readSSOCookieConfig({ state });
    },
    async resetSSOCookieConfig(): Promise<SSOCookieConfig> {
      return resetSSOCookieConfig({ state });
    },
    async updateSSOCookieConfig(
      config: SSOCookieConfig
    ): Promise<SSOCookieConfig> {
      return updateSSOCookieConfig({ config, state });
    },
  };
};

/**
 * Read SSO cookie configuration
 * @returns {Promise<SSOCookieConfig>} a promise that resolves to a SSOCookieConfig object
 */
export async function readSSOCookieConfig({
  state,
}: {
  state: State;
}): Promise<SSOCookieConfig> {
  try {
    const domains = await _getSSOCookieConfig({ state });
    return domains;
  } catch (error) {
    throw new FrodoError(`Error reading SSO cookie configuration`, error);
  }
}

/**
 * Verify CNAME
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<SSOCookieConfig>} a promise that resolves to an SSOCookieConfig object.
 */
export async function resetSSOCookieConfig({
  state,
}: {
  state: State;
}): Promise<SSOCookieConfig> {
  try {
    const config = await _resetSSOCookieConfig({ state });
    return config;
  } catch (error) {
    throw new FrodoError(`Error resetting SSO cookie configuration`, error);
  }
}

/**
 * Update SSO cookie configuration
 * @param {Object} params Parameters object.
 * @param {SSOCookieConfig} params.config SSOCookieConfig object
 * @param {State} params.state State object.
 * @returns {Promise<SSOCookieConfig>} a promise that resolves to a SSOCookieConfig object.
 */
export async function updateSSOCookieConfig({
  config,
  state,
}: {
  config: SSOCookieConfig;
  state: State;
}): Promise<SSOCookieConfig> {
  try {
    const result = await _setSSOCookieConfig({ config, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error updating SSO cookie configuration`, error);
  }
}
