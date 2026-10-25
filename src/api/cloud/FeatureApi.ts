import util from 'util';
import { IdObjectSkeletonInterface } from '../../api/ApiTypes';
import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { generateAmApi } from '../BaseApi';

const envInfoURLTemplate = '%s/feature?_queryFilter=true';

const getApiConfig = () => ({});

export interface FeatureInterface extends IdObjectSkeletonInterface {
  installedVersion: string;
  availableVersions: string[];
}

/**
 * Get all features
 * @returns {Promise<{ result: FeatureInterface[]; }>} a promise that resolves to an object containing an array of feature objects
 */
export async function getFeatures({ state }: { state: State }): Promise<{
  result: FeatureInterface[];
}> {
  const urlString = util.format(
    envInfoURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  // An AM-domain endpoint: a session login sends its cookie, and a browser
  // login needs the token exchanged for fr:am:* (the exchange's default when
  // no scope is named). Asking for fr:idm:* here, as this call once did, or
  // sending the browser login's primary token, is answered 401 and the
  // feature list came back empty. No scope is asserted for a bearer token.
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    requiredScopes: [],
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}
