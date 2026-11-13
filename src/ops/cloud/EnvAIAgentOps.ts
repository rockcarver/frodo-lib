import { enableAIAgentFeature as _enableAIAgentFeature } from '../../api/cloud/EnvAIAgentApi';
import { State } from '../../shared/State';
import { FrodoError, getTransactionId } from '../FrodoError';

export type EnvAIAgent = {
  /**
   * Enable the AI agent feature of the environment (`POST /environment/aiagent?_action=enable`), the action behind the
   * "enable" button of the Admin UI.
   *
   * What it does, as far as it was observed on Advanced Identity Cloud tenants (frodo-lib#1060): the platform installs
   * the IDM feature `aiagent` internally, then writes the OAuth 2.0 provider of every realm (alpha and bravo) with
   * the AI agent settings. AM validates that write, so the action fails with a generic HTTP 500, which says nothing
   * about the reason, if a realm has no OAuth 2.0 provider or a provider has no password grant authentication
   * service. The effect on AM (the agent type `AIAgent`, until then answering `501 OAuth 2.0 for AI Agents is not
   * enabled`) can take minutes after the action answered 200: poll before judging the result.
   *
   * Do not call it on a tenant whose definitions of the feature are present but not equal to the original (the
   * registry reads `installedVersion: null` although the feature was installed before): the internal install would
   * add them a second time. `diagnoseIdmFeature('aiagent')` finds out whether that is the case, and
   * `repairIdmFeature` runs this action when it is safe.
   *
   * On failure the error is a `FrodoError` that keeps the HTTP status (`httpStatus`) and the
   * `x-forgerock-transactionid` of the response (`httpTransactionId`), which finds the request in the platform's
   * logs.
   * @returns {Promise<any>} a promise that resolves to an empty result object if successful
   */
  enableAIAgentFeature(): Promise<any>;
};

export default (state: State): EnvAIAgent => {
  return {
    async enableAIAgentFeature(): Promise<any> {
      return enableAIAgentFeature({ state });
    },
  };
};

/**
 * Enable the AI agent feature of the environment. See {@link EnvAIAgent.enableAIAgentFeature} for what the action does
 * and when it must not be called.
 * @returns {Promise<any>} a promise that resolves to an empty result object if successful
 */
export async function enableAIAgentFeature({
  state,
}: {
  state: State;
}): Promise<any> {
  try {
    const result = await _enableAIAgentFeature({ state });
    return result;
  } catch (error) {
    const wrapped = new FrodoError(`Error enabling AI agent feature`, error);
    const transactionId = getTransactionId(error);
    if (transactionId) wrapped.httpTransactionId = transactionId;
    throw wrapped;
  }
}
