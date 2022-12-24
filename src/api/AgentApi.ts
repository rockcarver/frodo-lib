import util from 'util';
import { generateAmApi } from './BaseApi';
import { deleteDeepByKey, getCurrentRealmPath } from './utils/ApiUtils';
import * as state from '../shared/State';
import { debugMessage } from '../ops/utils/Console';

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
  const configPath = getCurrentRealmPath();
  return {
    path: `${configPath}/realm-config/agents`,
    apiVersion,
  };
};

/**
 * Get agent types
 * @returns {Promise} a promise that resolves to an object containing an array of agent types
 */
export async function getAgentTypes() {
  debugMessage(`AgentApi.getAgentTypes: start`);
  const urlString = util.format(
    getAgentTypesURLTemplate,
    state.getHost(),
    getCurrentRealmPath()
  );
  const { data } = await generateAmApi(getApiConfig()).post(
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
export async function getAgentsByType(agentType: string) {
  debugMessage(`AgentApi.getAgentsByType: start`);
  const urlString = util.format(
    agentListURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    agentType
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  debugMessage(`AgentApi.getAgentsByType: end`);
  return data;
}

/**
 * Get all agents
 * @returns {Promise} a promise that resolves to an object containing an array of agent objects
 */
export async function getAgents() {
  debugMessage(`AgentApi.getAgents: start`);
  const urlString = util.format(
    getAllAgentsURLTemplate,
    state.getHost(),
    getCurrentRealmPath()
  );
  const { data } = await generateAmApi(getApiConfig()).post(
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
export async function findAgentById(agentId: string) {
  debugMessage(`AgentApi.findAgentById: start`);
  const urlString = util.format(
    queryAgentURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    agentId
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  debugMessage(`AgentApi.findAgentById: end`);
  return data.result;
}

/**
 * Find agent by id
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
 * @param {string} agentId agent id
 * @returns {Promise} a promise that resolves to an array with one or zero agent objects
 */
export async function findAgentByTypeAndId(agentType: string, agentId: string) {
  debugMessage(`AgentApi.findAgentById: start`);
  const urlString = util.format(
    queryAgentByTypeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    agentType,
    agentId
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  debugMessage(`AgentApi.findAgentById: end`);
  return data.result;
}

/**
 * Get agent
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
 * @param {string} agentId agent id
 * @returns {Promise} a promise that resolves to an object containing an agent object of the specified type
 */
export async function getAgentByTypeAndId(agentType: string, agentId: string) {
  debugMessage(`AgentApi.getAgentByTypeAndId: start`);
  const urlString = util.format(
    agentURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    agentType,
    agentId
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
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
export async function putAgentByTypeAndId(
  agentType: string,
  agentId: string,
  agentData
) {
  debugMessage(`AgentApi.putAgentByTypeAndId: start`);
  // until we figure out a way to use transport keys in Frodo,
  // we'll have to drop those encrypted attributes.
  const agent = deleteDeepByKey(agentData, '-encrypted');
  delete agent._provider;
  delete agent._rev;
  const urlString = util.format(
    agentURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    agentType,
    agentId
  );
  const { data } = await generateAmApi(getApiConfig()).put(urlString, agent, {
    withCredentials: true,
  });
  debugMessage(`AgentApi.putAgentByTypeAndId: end`);
  return data;
}

/**
 * Delete agent
 * @param agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
 * @param agentId agent id
 * @returns a promise that resolves to an object containing an agent object
 */
export async function deleteAgentByTypeAndId(
  agentType: string,
  agentId: string
) {
  debugMessage(`AgentApi.deleteAgentByTypeAndId: start`);
  const urlString = util.format(
    agentURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    agentType,
    agentId
  );
  const { data } = await generateAmApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  debugMessage(`AgentApi.deleteAgentByTypeAndId: end`);
  return data;
}
