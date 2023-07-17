import util from 'util';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { State } from '../shared/State';

const oauthProviderServiceURLTemplate =
  '%s/json%s/realm-config/services/oauth-oidc';

const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Get OAuth2 Provider
 * @returns {Promise} a promise that resolves to an OAuth2Provider object
 */
export async function getOAuth2Provider({ state }: { state: State }) {
  const urlString = util.format(
    oauthProviderServiceURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}
