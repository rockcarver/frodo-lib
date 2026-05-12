import util from 'util';

import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const enableAIAgentFeatureURLTemplate = '%s/environment/aiagent?_action=enable';

/**
 * Get info about the environment
 * @returns {Promise<any>} a promise that resolves to an empty response if successful
 */
export async function enableAIAgentFeature({
  state,
}: {
  state: State;
}): Promise<any> {
  const urlString = util.format(
    enableAIAgentFeatureURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: {},
    requestOverride: {},
    state,
  }).post(
    urlString,
    {},
    {
      withCredentials: true,
    }
  );
  return data;
}
