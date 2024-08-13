import util from 'util';

import { State } from '../../shared/State';
import { getHostBaseUrl } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const federationEnforcementURLTemplate =
  '%s/environment/federation/enforcement';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Federation Enforcement object
 */
export type FederationEnforcement = {
  groups: 'none' | 'non-global' | 'all';
};

/**
 * Get federation enforcement configuration
 * @returns {Promise<FederationEnforcement>} a promise that resolves to a FederationEnforcement object
 */
export async function getFederationEnforcement({
  state,
}: {
  state: State;
}): Promise<FederationEnforcement> {
  const urlString = util.format(
    federationEnforcementURLTemplate,
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
 * Set federation enforcement configuration
 * @param {Object} params Parameters object.
 * @param {FederationEnforcement} params.config FederationEnforcement object
 * @param {State} params.state State object.
 * @returns {Promise<FederationEnforcement>} a promise that resolves to a FederationEnforcement object.
 */
export async function setFederationEnforcement({
  config,
  state,
}: {
  config: FederationEnforcement;
  state: State;
}): Promise<FederationEnforcement> {
  const urlString = util.format(
    federationEnforcementURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, config, { withCredentials: true });
  return data;
}
