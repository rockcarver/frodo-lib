import util from 'util';
import { getTenantURL } from '../utils/ApiUtils';
import { generateAmApi } from '../BaseApi';
import * as state from '../../shared/State';
import { ObjectSkeletonInterface } from '../../api/ApiTypes';

const envInfoURLTemplate = '%s/feature?_queryFilter=true';

const getApiConfig = () => ({
  path: `/feature`,
});

export interface FeatureInterface extends ObjectSkeletonInterface {
  installedVersion: string;
  availableVersions: string[];
}

/**
 * Get all features
 * @returns {Promise<{ result: FeatureInterface[]; }>} a promise that resolves to an object containing an array of feature objects
 */
export async function getFeatures(): Promise<{
  result: FeatureInterface[];
}> {
  const urlString = util.format(
    envInfoURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}
