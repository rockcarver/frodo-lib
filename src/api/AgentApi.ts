import util from 'util';

import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { deleteDeepByKey } from '../utils/JsonUtils';
import { type IdObjectSkeletonInterface } from './ApiTypes';
import { generateAmApi } from './BaseApi';
import { type AmServiceType } from './ServiceApi';

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

export type GatewayAgentType = 'IdentityGatewayAgent';
export type JavaAgentType = 'J2EEAgent';
export type WebAgentType = 'WebAgent';
export type AgentType = GatewayAgentType | JavaAgentType | WebAgentType;

export type AgentSkeleton = IdObjectSkeletonInterface & {
  _type: AmServiceType;
};

/**
 * Get agent types
 * @returns {Promise} a promise that resolves to an object containing an array of agent types
 */
export async function getAgentTypes({ state }: { state: State }) {
  debugMessage({ message: `AgentApi.getAgentTypes: start`, state });
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
  debugMessage({ message: `AgentApi.getAgentTypes: end`, state });
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
  agentType: AgentType;
  state: State;
}) {
  debugMessage({ message: `AgentApi.getAgentsByType: start`, state });
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
  debugMessage({ message: `AgentApi.getAgentsByType: end`, state });
  return data;
}

/**
 * Get all agents
 * @returns {Promise} a promise that resolves to an object containing an array of agent objects
 */
export async function getAgents({ state }: { state: State }) {
  debugMessage({ message: `AgentApi.getAgents: start`, state });
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
  debugMessage({ message: `AgentApi.getAgents: end`, state });
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
  debugMessage({ message: `AgentApi.findAgentById: start`, state });
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
  debugMessage({ message: `AgentApi.findAgentById: end`, state });
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
  agentType: AgentType;
  agentId: string;
  state: State;
}) {
  debugMessage({ message: `AgentApi.findAgentById: start`, state });
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
  debugMessage({ message: `AgentApi.findAgentById: end`, state });
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
  agentType: AgentType;
  agentId: string;
  state: State;
}) {
  debugMessage({ message: `AgentApi.getAgentByTypeAndId: start`, state });
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
  debugMessage({ message: `AgentApi.getAgentByTypeAndId: end`, state });
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
  agentType: AgentType;
  agentId: string;
  agentData: AgentSkeleton;
  state: State;
}) {
  debugMessage({ message: `AgentApi.putAgentByTypeAndId: start`, state });
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
  debugMessage({ message: `AgentApi.putAgentByTypeAndId: end`, state });
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
  agentType: AgentType;
  agentId: string;
  state: State;
}) {
  debugMessage({ message: `AgentApi.deleteAgentByTypeAndId: start`, state });
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
  debugMessage({ message: `AgentApi.deleteAgentByTypeAndId: end`, state });
  return data;
}
