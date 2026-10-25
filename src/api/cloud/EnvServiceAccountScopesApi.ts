import util from 'util';
import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { generateAmApi } from '../BaseApi';

const serviceAccountScopes = '%s/environment/scopes/service-accounts';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Service Account Scopes object
 */
export type ServiceAccountScope = {
  scope: string;
  description?: string;
  childScopes?: ServiceAccountScope[];
};

/**
 * Get available service account scopes
 * @returns {Promise<ServiceAccountScope>} a promise that resolves to an array of ServiceAccountScope objects
 */
export async function getServiceAccountScopes({
  state,
}: {
  state: State;
}): Promise<ServiceAccountScope[]> {
  const urlString = util.format(
    serviceAccountScopes,
    getHostOnlyUrl(state.getHost())
  );
  // Not a public endpoint: without a credential it answers 401, and so does
  // a browser login's primary token. It is an AM-domain call: a session
  // login sends its cookie, a browser login the token exchanged for fr:am:*
  // (the exchange's default when no scope is named). Before any credential
  // exists (a service account's first login) no header is sent, as before.
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    requiredScopes: [],
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}
