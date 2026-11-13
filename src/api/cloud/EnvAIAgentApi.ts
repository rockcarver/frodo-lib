import util from 'util';
import Constants from '../../shared/Constants';
import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { generateEnvApi } from '../BaseApi';

const enableAIAgentFeatureURLTemplate = '%s/environment/aiagent?_action=enable';

/**
 * Enable the AI agent feature of the environment (`POST /environment/aiagent?_action=enable`). The platform installs the
 * IDM feature `aiagent` internally and rewrites the OAuth 2.0 provider of every realm.
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
    requiredScopes: [Constants.AVAILABLE_SCOPES.AmFullScope],
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
