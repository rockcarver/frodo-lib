import util from 'util';

import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const countOfESVsURLTemplate = '%s/environment/count';

const apiVersion = 'resource=2.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

export type EsvCountResponse = {
  secrets: number;
  variables: number;
};

/**
 * Get count of ESV secrets and variables in the environment.
 * @returns {Promise<EsvCountResponse>} a promise that resolves to an object with counts of secrets and variables
 */
export async function getEsvCount({
  state,
}: {
  state: State;
}): Promise<EsvCountResponse> {
  const urlString = util.format(
    countOfESVsURLTemplate,
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
