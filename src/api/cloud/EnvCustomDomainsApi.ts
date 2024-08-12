import util from 'util';

import { State } from '../../shared/State';
import {
  getCurrentRealmName,
  getHostBaseUrl,
} from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const customDomainsURLTemplate = '%s/environment/custom-domains/%s';
const verifyCNAMEURLTemplate = '%s/environment/custom-domains?_action=verify';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Custom Domains object
 */
export type CustomDomains = {
  domains: string[];
};

/**
 * Verify CNAME
 * @param {Object} params Parameters object.
 * @param {string} params.name CustomDomains object
 * @param {State} params.state State object.
 * @returns {Promise<''>} a promise that resolves to an empty string response.
 */
export async function verifyCNAME({
  name,
  state,
}: {
  name: string;
  state: State;
}): Promise<''> {
  const urlString = util.format(
    verifyCNAMEURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, { name }, { withCredentials: true });
  return data;
}

/**
 * Get custom domains
 * @returns {Promise<CustomDomains>} a promise that resolves to a CustomDomains object
 */
export async function getCustomDomains({
  state,
}: {
  state: State;
}): Promise<CustomDomains> {
  const urlString = util.format(
    customDomainsURLTemplate,
    getHostBaseUrl(state.getHost()),
    getCurrentRealmName(state)
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
 * Set custom domains
 * @param {Object} params Parameters object.
 * @param {CustomDomains} params.domains CustomDomains object
 * @param {State} params.state State object.
 * @returns {Promise<CustomDomains>} a promise that resolves to a CustomDomains object.
 */
export async function setCustomDomains({
  domains,
  state,
}: {
  domains: CustomDomains;
  state: State;
}): Promise<CustomDomains> {
  const urlString = util.format(
    customDomainsURLTemplate,
    getHostBaseUrl(state.getHost()),
    getCurrentRealmName(state)
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, domains, { withCredentials: true });
  return data;
}
