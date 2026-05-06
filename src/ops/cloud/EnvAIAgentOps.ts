import { enableAIAgentFeature as _enableAIAgentFeature } from '../../api/cloud/EnvAIAgentApi';
import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

export type EnvAIAgent = {
  /**
   * Enable AI agent feature
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
 * Enable AI agent feature
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
    throw new FrodoError(`Error enabling AI agent feature`, error);
  }
}
