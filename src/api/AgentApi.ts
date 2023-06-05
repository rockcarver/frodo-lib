import util from 'util';
import { generateAmApi } from './BaseApi';
import { deleteDeepByKey, getCurrentRealmPath } from './utils/ApiUtils';
import State from '../shared/State';
import { debugMessage } from '../ops/utils/Console';
import { AgentSkeleton } from './ApiTypes';

const getAgentTypesURLTemplate =
  '%s/json%s/realm-config/agents?_action=getAllTypes';
const getAllAgentsURLTemplate =
  '%s/json%s/realm-config/agents?_action=nextdescendents';
const queryAgentURLTemplate =
  "%s/json%s/realm-config/agents?_queryFilter=_id+eq+'%s'";
const queryAgentByTypeURLTemplate =
  "%s/json%s/realm-config/agents/%s?_queryFilter=_id+eq+'%s'";
const agentURLTemplate = '%s/json%s/realm-config/agents/%s/%s';
const agentListURLTemplate =
  '%s/json%s/realm-config/agents/%s?_queryFilter=true';
const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Get agent types
 * @returns {Promise} a promise that resolves to an object containing an array of agent types
 */
export async function getAgentTypes({ state }: { state: State }) {
  debugMessage(`AgentApi.getAgentTypes: start`);
  const urlString = util.format(
    getAgentTypesURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).post(
    urlString,
    {},
    {
      withCredentials: true,
    }
  );
  debugMessage(`AgentApi.getAgentTypes: end`);
  return data;
}

/**
 * Get agents
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
 * @returns {Promise} a promise that resolves to an object containing an array of agent objects of the specified type
 */
export async function getAgentsByType({
  agentType,
  state,
}: {
  agentType: string;
  state: State;
}) {
  debugMessage(`AgentApi.getAgentsByType: start`);
  const urlString = util.format(
    agentListURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    agentType
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  debugMessage(`AgentApi.getAgentsByType: end`);
  return data;
}

/**
 * Get all agents
 * @returns {Promise} a promise that resolves to an object containing an array of agent objects
 */
export async function getAgents({ state }: { state: State }) {
  debugMessage(`AgentApi.getAgents: start`);
  const urlString = util.format(
    getAllAgentsURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).post(
    urlString,
    {},
    {
      withCredentials: true,
    }
  );
  debugMessage(`AgentApi.getAgents: end`);
  return data;
}

/**
 * Find agent by id
 * @param {string} agentId agent id
 * @returns {Promise} a promise that resolves to an array with one or zero agent objects
 */
export async function findAgentById({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  debugMessage(`AgentApi.findAgentById: start`);
  const urlString = util.format(
    queryAgentURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    agentId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  debugMessage(`AgentApi.findAgentById: end`);
  return data.result;
}

/**
 * Find agent by id
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
 * @param {string} agentId agent id
 * @returns {Promise} a promise that resolves to an array with one or zero agent objects
 */
export async function findAgentByTypeAndId({
  agentType,
  agentId,
  state,
}: {
  agentType: string;
  agentId: string;
  state: State;
}) {
  debugMessage(`AgentApi.findAgentById: start`);
  const urlString = util.format(
    queryAgentByTypeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    agentType,
    agentId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  debugMessage(`AgentApi.findAgentById: end`);
  return data.result;
}

/**
 * Get agent
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
 * @param {string} agentId agent id
 * @returns {Promise} a promise that resolves to an object containing an agent object of the specified type
 */
export async function getAgentByTypeAndId({
  agentType,
  agentId,
  state,
}: {
  agentType: string;
  agentId: string;
  state: State;
}) {
  debugMessage(`AgentApi.getAgentByTypeAndId: start`);
  const urlString = util.format(
    agentURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    agentType,
    agentId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  debugMessage(`AgentApi.getAgentByTypeAndId: end`);
  return data;
}

/**
 * Put agent
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
 * @param {string} agentId agent id
 * @param {Object} agentData agent object
 * @returns {Promise} a promise that resolves to an object containing an agent object
 */
export async function putAgentByTypeAndId({
  agentType,
  agentId,
  agentData,
  state,
}: {
  agentType: string;
  agentId: string;
  agentData: AgentSkeleton;
  state: State;
}) {
  debugMessage(`AgentApi.putAgentByTypeAndId: start`);
  // until we figure out a way to use transport keys in Frodo,
  // we'll have to drop those encrypted attributes.
  const agent = deleteDeepByKey(agentData, '-encrypted');
  delete agent._provider;
  delete agent._rev;
  const urlString = util.format(
    agentURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    agentType,
    agentId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    agent,
    {
      withCredentials: true,
    }
  );
  debugMessage(`AgentApi.putAgentByTypeAndId: end`);
  return data;
}

/**
 * Delete agent
 * @param agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
 * @param agentId agent id
 * @returns a promise that resolves to an object containing an agent object
 */
export async function deleteAgentByTypeAndId({
  agentType,
  agentId,
  state,
}: {
  agentType: string;
  agentId: string;
  state: State;
}) {
  debugMessage(`AgentApi.deleteAgentByTypeAndId: start`);
  const urlString = util.format(
    agentURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    agentType,
    agentId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  debugMessage(`AgentApi.deleteAgentByTypeAndId: end`);
  return data;
}
