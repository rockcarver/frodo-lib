import util from 'util';

import { State } from '../../shared/State';
import { getHostBaseUrl } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const cookieDomainsURLTemplate = '%s/environment/cookie-domains';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Cookie Domains object
 */
export type CookieDomains = {
  domains: string[];
};

/**
 * Get cookie domains
 * @returns {Promise<CookieDomains>} a promise that resolves to a CookieDomains object
 */
export async function getCookieDomains({
  state,
}: {
  state: State;
}): Promise<CookieDomains> {
  const urlString = util.format(
    cookieDomainsURLTemplate,
    getHostBaseUrl(state.getHost())
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
 * Set cookie domains
 * @param {Object} params Parameters object.
 * @param {CookieDomains} params.domains CookieDomains object
 * @param {State} params.state State object.
 * @returns {Promise<CookieDomains>} a promise that resolves to a CookieDomains object.
 */
export async function setCookieDomains({
  domains,
  state,
}: {
  domains: CookieDomains;
  state: State;
}): Promise<CookieDomains> {
  const urlString = util.format(
    cookieDomainsURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, domains, { withCredentials: true });
  return data;
}
