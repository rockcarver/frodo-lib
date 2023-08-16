import util from 'util';

import { IdObjectSkeletonInterface } from '../../api/ApiTypes';
import { State } from '../../shared/State';
import { getHostBaseUrl } from '../../utils/ForgeRockUtils';
import { generateAmApi } from '../BaseApi';

const envInfoURLTemplate = '%s/feature?_queryFilter=true';

const getApiConfig = () => ({
  path: `/feature`,
});

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
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}
