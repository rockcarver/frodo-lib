import util from 'util';

import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const releaseURLTemplate = '%s/environment/release';

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Release object
 */
export type Release = {
  currentVersion: string;
  nextUpgrade: string;
};

/**
 * Get release information
 * @returns {Promise<Release>} a promise that resolves to a Release object
 */
export async function getRelease({
  state,
}: {
  state: State;
}): Promise<Release> {
  const urlString = util.format(
    releaseURLTemplate,
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
