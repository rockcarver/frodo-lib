import util from 'util';

import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import {
  getConfigPath,
  getCurrentRealmPath,
  getRealmPathGlobal,
} from '../utils/ForgeRockUtils';
import { deleteDeepByKey } from '../utils/JsonUtils';
import {
  type AmConfigEntityInterface,
  EntityType,
  PagedResult,
} from './ApiTypes';
import { generateAmApi } from './BaseApi';

const getAgentTypesURLTemplate =
  '%s/json%s/realm-config/agents?_action=getAllTypes';
const getAllAgentsURLTemplate = '%s/json%s/%s/agents?_action=nextdescendents';
const queryAgentURLTemplate =
  "%s/json%s/realm-config/agents?_queryFilter=_id+eq+'%s'";
const queryAgentByTypeURLTemplate =
  "%s/json%s/realm-config/agents/%s?_queryFilter=_id+eq+'%s'";
const agentURLTemplate = '%s/json%s/%s/agents/%s/%s';
const agentListURLTemplate =
  '%s/json%s/realm-config/agents/%s?_queryFilter=true';
const agentGroupURLTemplate = '%s/json%s/realm-config/agents/groups/%s/%s';
const agentGroupsURLTemplate =
  '%s/json%s/realm-config/agents/groups?_action=nextdescendents';

const apiVersion = 'protocol=2.1,resource=%s';
const globalVersion = '1.0';
const realmVersion = '1.0';

const getApiConfig = (globalConfig) => {
  return {
    apiVersion: util.format(
      apiVersion,
      globalConfig ? globalVersion : realmVersion
    ),
  };
};

export type PolicyAgentType = '2.2_Agent';
export type GatewayAgentType = 'IdentityGatewayAgent';
export type JavaAgentType = 'J2EEAgent';
export type OAuth2ThingType = 'OAuth2Thing';
export type RemoteConsentAgentType = 'RemoteConsentAgent';
export type SharedAgentType = 'SharedAgent';
export type SoapSTSAgentType = 'SoapSTSAgent';
export type SoftwarePublisherType = 'SoftwarePublisher';
export type WebAgentType = 'WebAgent';

export type AgentType =
  | PolicyAgentType
  | GatewayAgentType
  | JavaAgentType
  | OAuth2ThingType
  | RemoteConsentAgentType
  | SharedAgentType
  | SoapSTSAgentType
  | SoftwarePublisherType
  | WebAgentType
  | EntityType;

export type AgentSkeleton = AmConfigEntityInterface;

export type AgentGroupSkeleton = AmConfigEntityInterface;

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
    resource: getApiConfig(false),
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
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent, etc.)
 * @returns {Promise<PagedResult<AgentSkeleton>>} a promise that resolves to an object containing an array of agent objects of the specified type
 */
export async function getAgentsByType({
  agentType,
  state,
}: {
  agentType: AgentType;
  state: State;
}): Promise<PagedResult<AgentSkeleton>> {
  debugMessage({ message: `AgentApi.getAgentsByType: start`, state });
  const urlString = util.format(
    agentListURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    agentType
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(false),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  debugMessage({ message: `AgentApi.getAgentsByType: end`, state });
  return data;
}

/**
 * Get all agents
 * @param {boolean} globalConfig true if the global agents is the target of the operation, false otherwise. default: false
 * @returns {Promise<PagedResult<AgentSkeleton>>} a promise that resolves to an object containing an array of agent objects
 */
export async function getAgents({
  state,
  globalConfig = false,
}: {
  state: State;
  globalConfig?: boolean;
}): Promise<PagedResult<AgentSkeleton>> {
  debugMessage({ message: `AgentApi.getAgents: start`, state });
  const urlString = util.format(
    getAllAgentsURLTemplate,
    state.getHost(),
    getRealmPathGlobal(globalConfig, state),
    getConfigPath(globalConfig)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
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
 * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array with one or zero agent objects
 */
export async function findAgentById({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}): Promise<AgentSkeleton[]> {
  debugMessage({ message: `AgentApi.findAgentById: start`, state });
  const urlString = util.format(
    queryAgentURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    agentId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(false),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  debugMessage({ message: `AgentApi.findAgentById: end`, state });
  return data.result;
}

/**
 * Find agent by id
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent, etc.)
 * @param {string} agentId agent id
 * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array with one or zero agent objects
 */
export async function findAgentByTypeAndId({
  agentType,
  agentId,
  state,
}: {
  agentType: AgentType;
  agentId: string;
  state: State;
}): Promise<AgentSkeleton[]> {
  debugMessage({ message: `AgentApi.findAgentById: start`, state });
  const urlString = util.format(
    queryAgentByTypeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    agentType,
    agentId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(false),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  debugMessage({ message: `AgentApi.findAgentById: end`, state });
  return data.result;
}

/**
 * Get agent
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent, etc.)
 * @param {string} agentId agent id
 * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an agent object of the specified type
 */
export async function getAgentByTypeAndId({
  agentType,
  agentId,
  globalConfig = false,
  state,
}: {
  agentType: AgentType;
  agentId: string;
  globalConfig: boolean;
  state: State;
}) {
  debugMessage({ message: `AgentApi.getAgentByTypeAndId: start`, state });
  const urlString = util.format(
    agentURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    getConfigPath(globalConfig),
    globalConfig ? agentId : agentType,
    globalConfig ? '' : agentId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  debugMessage({ message: `AgentApi.getAgentByTypeAndId: end`, state });
  return data;
}

/**
 * Put agent
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent, etc.)
 * @param {string} agentId agent id
 * @param {AgentSkeleton} agentData agent object
 * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an agent object
 */
export async function putAgentByTypeAndId({
  agentType,
  agentId,
  agentData,
  globalConfig = false,
  state,
}: {
  agentType: AgentType;
  agentId: string;
  agentData: AgentSkeleton;
  globalConfig: boolean;
  state: State;
}): Promise<AgentSkeleton> {
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
    getConfigPath(globalConfig),
    globalConfig ? agentId : agentType,
    globalConfig ? '' : agentId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(globalConfig),
    state,
  }).put(urlString, agent, {
    withCredentials: true,
  });
  debugMessage({ message: `AgentApi.putAgentByTypeAndId: end`, state });
  return data;
}

/**
 * Put agent group
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent, etc.)
 * @param {string} agentGroupId agent group id
 * @param {AgentGroupSkeleton} agentGroupData agent group object
 * @returns {Promise<AgentGroupSkeleton>} a promise that resolves to an object containing an agent group object
 */
export async function putAgentGroupByTypeAndId({
  agentType,
  agentGroupId,
  agentGroupData,
  state,
}: {
  agentType: AgentType;
  agentGroupId: string;
  agentGroupData: AgentGroupSkeleton;
  state: State;
}): Promise<AgentGroupSkeleton> {
  debugMessage({ message: `AgentApi.putAgentGroupByTypeAndId: start`, state });
  const urlString = util.format(
    agentGroupURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    agentType,
    agentGroupId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(false),
    state,
  }).put(urlString, agentGroupData, {
    withCredentials: true,
  });
  debugMessage({ message: `AgentApi.putAgentGroupByTypeAndId: end`, state });
  return data;
}

/**
 * Delete agent
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent, etc.)
 * @param {string} agentId agent id
 * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an agent object
 */
export async function deleteAgentByTypeAndId({
  agentType,
  agentId,
  state,
}: {
  agentType: AgentType;
  agentId: string;
  state: State;
}): Promise<AgentSkeleton> {
  debugMessage({ message: `AgentApi.deleteAgentByTypeAndId: start`, state });
  const urlString = util.format(
    agentURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    getConfigPath(false),
    agentType,
    agentId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(false),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  debugMessage({ message: `AgentApi.deleteAgentByTypeAndId: end`, state });
  return data;
}

/**
 * Get all agent groups
 * @returns {Promise<PagedResult<AgentGroupSkeleton>>} a promise that resolves to an object containing an array of agent group objects
 */
export async function getAgentGroups({
  state,
}: {
  state: State;
}): Promise<PagedResult<AgentGroupSkeleton>> {
  debugMessage({ message: `AgentApi.getAgentGroups: start`, state });
  const urlString = util.format(
    agentGroupsURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(false),
    state,
  }).post(
    urlString,
    {},
    {
      withCredentials: true,
    }
  );
  debugMessage({ message: `AgentApi.getAgentGroups: end`, state });
  return data;
}
