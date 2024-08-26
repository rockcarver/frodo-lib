import util from 'util';

import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const ssoCookieConfigURLTemplate = '%s/environment/sso-cookie';
const resetSsoCookieConfigURLTemplate = `${ssoCookieConfigURLTemplate}?_action=reset`;

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * SSO Cookie Configuration object
 */
export type SSOCookieConfig = {
  name: string;
};

/**
 * Get SSO cookie configuration
 * @returns {Promise<SSOCookieConfig>} a promise that resolves to a SSOCookieConfig object
 */
export async function getSSOCookieConfig({
  state,
}: {
  state: State;
}): Promise<SSOCookieConfig> {
  const urlString = util.format(
    ssoCookieConfigURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Reset SSO cookie configuration
 * @param {Object} params Parameters object.
 * @param {State} params.state State object.
 * @returns {Promise<SSOCookieConfig>} a promise that resolves to an empty string response.
 */
export async function resetSSOCookieConfig({
  state,
}: {
  state: State;
}): Promise<SSOCookieConfig> {
  const urlString = util.format(
    resetSsoCookieConfigURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, null, { withCredentials: true });
  return data;
}

/**
 * Set SSO cookie configuration
 * @param {Object} params Parameters object.
 * @param {SSOCookieConfig} params.domains SSOCookieConfig object
 * @param {State} params.state State object.
 * @returns {Promise<SSOCookieConfig>} a promise that resolves to a SSOCookieConfig object.
 */
export async function setSSOCookieConfig({
  config,
  state,
}: {
  config: SSOCookieConfig;
  state: State;
}): Promise<SSOCookieConfig> {
  const urlString = util.format(
    ssoCookieConfigURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, config, { withCredentials: true });
  return data;
}
