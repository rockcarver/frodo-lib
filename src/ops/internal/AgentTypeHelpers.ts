import {
  getAgentTypes,
  type AgentType,
  type AgentTypeItem,
} from '../../api/AgentApi';
import { State } from '../../shared/State';
import { debugMessage } from '../../utils/Console';
import { getCurrentRealmName } from '../../utils/ForgeRockUtils';
import { cloneDeep } from '../../utils/JsonUtils';
import { FrodoError } from '../FrodoError';

/**
 * Shared, unfiltered list of the agent types a realm offers.
 *
 * Every ops module that has to know whether a realm offers an agent type asks
 * here. The list is cached per host, realm and deployment type exactly as
 * `readAgentTypes` always did, but it is cached as the server answered it: a
 * type that is on `AgentTypeBlacklist` (a type with its own module) is still in
 * it. The blacklist is applied by the readers of the generic agent code, when
 * they read the list, not when it is stored.
 */

const AgentTypeItemCache = new Map<string, AgentTypeItem[]>();

/**
 * Read all agent type items a realm offers, including the types that the
 * generic agent code does not handle (the types on its blacklist).
 *
 * The answer is cached per host, realm and deployment type. An empty answer is
 * not cached. A realm where the operation does not exist (the root realm of a
 * Cloud tenant answers 403 "This operation is not available in PingOne
 * Advanced Identity Cloud.", a deployment without the endpoint answers 404) has
 * no types: the result is an empty list, not an error.
 * @param {object} params structured and named parameters
 * @param {boolean} params.refreshCache true to ask the server again and replace the cached list. Default: false.
 * @param {State} params.state the state object
 * @returns {Promise<AgentTypeItem[]>} a promise that resolves to a copy of the list of agent type items (the caller may change it)
 */
export async function readAgentTypeItems({
  refreshCache = false,
  state,
}: {
  refreshCache?: boolean;
  state: State;
}): Promise<AgentTypeItem[]> {
  try {
    debugMessage({
      message: `AgentTypeHelpers.readAgentTypeItems: start`,
      state,
    });
    const cacheKey = JSON.stringify([
      state.getHost(),
      state.getRealm(),
      state.getDeploymentType(),
    ]);
    const cachedTypes = AgentTypeItemCache.get(cacheKey);
    let agentTypeItems: AgentTypeItem[] = [];
    if (!refreshCache && cachedTypes?.length > 0) {
      debugMessage({
        message: `AgentTypeHelpers.readAgentTypeItems: using cached agent types`,
        state,
      });
      agentTypeItems = cloneDeep(cachedTypes);
    } else {
      const { result } = await getAgentTypes({ state });
      // Update cache with new values.
      AgentTypeItemCache.set(cacheKey, result);
      agentTypeItems = cloneDeep(result);
    }
    debugMessage({
      message: `AgentTypeHelpers.readAgentTypeItems: end`,
      state,
    });
    return agentTypeItems;
  } catch (error) {
    if (
      (error.response?.status === 403 &&
        error.response?.data?.message ===
          'This operation is not available in PingOne Advanced Identity Cloud.') ||
      error.response?.status === 404
    ) {
      return [];
    } else {
      throw new FrodoError(
        `Error reading ${getCurrentRealmName(state) + ' realm'} agent types`,
        error
      );
    }
  }
}

/**
 * Find out whether the realm offers an agent type.
 *
 * The question is answered from the unfiltered type list, so a type that the
 * generic agent code hides (a type with its own module) and a type that no
 * code knows are found like any other. A deployment that does not list the type
 * is a normal answer (`false`), not an error.
 * @param {object} params structured and named parameters
 * @param {AgentType} params.agentType the agent type id, for example `CIMDProfile`
 * @param {boolean} params.refreshCache true to ask the server again before answering. Default: false.
 * @param {State} params.state the state object
 * @returns {Promise<boolean>} a promise that resolves to true if the realm offers the type and false otherwise
 */
export async function isAgentTypeOffered({
  agentType,
  refreshCache = false,
  state,
}: {
  agentType: AgentType;
  refreshCache?: boolean;
  state: State;
}): Promise<boolean> {
  return (await readAgentTypeItems({ refreshCache, state })).some(
    (item) => item._id === agentType
  );
}
