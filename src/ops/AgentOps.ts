import {
  type AgentGroupSkeleton,
  type AgentSkeleton,
  type AgentType,
  deleteAgentByTypeAndId as _deleteAgentByTypeAndId,
  findAgentById as _findAgentById,
  findAgentByTypeAndId as _findAgentByTypeAndId,
  getAgentByTypeAndId as _getAgentByTypeAndId,
  getAgentGroups as _getAgentGroups,
  getAgents as _getAgents,
  getAgentsByType as _getAgentsByType,
  putAgentByTypeAndId as _putAgentByTypeAndId,
  putAgentGroupByTypeAndId as _putAgentGroupByTypeAndId,
  getAgentTypes as _getAgentTypes,
  AgentTypeItem as _AgentTypeItem,
} from '../api/AgentApi';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { getCurrentRealmName } from '../utils/ForgeRockUtils';
import { cloneDeep } from '../utils/JsonUtils';
import { FrodoError } from './FrodoError';
import {
  createManagedObject,
  queryManagedObjects,
  queryRelatedManagedObjects,
  readManagedObject,
  readManagedObjects,
  readManagedObjectSchema,
  updateManagedObjectProperties,
} from './ManagedObjectOps';
import { type ExportMetaData } from './OpsTypes';

export type Agent = {
  /**
   * Read all agent types.
   * @returns {Promise<AgentType[]>} a promise that resolves to an array of agent type strings
   */
  readAgentTypes(): Promise<AgentType[]>;
  /**
   * Read agent by type and id
   * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
   * @param {string} agentId agent id/name
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an agent object
   */
  readAgentByTypeAndId(
    agentType: AgentType,
    agentId: string
  ): Promise<AgentSkeleton>;
  /**
   * Read all agents.
   * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array of agent objects
   */
  readAgents(globalConfig: boolean): Promise<AgentSkeleton[]>;
  /**
   * Read agent
   * @param {string} agentId agent id/name
   * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an agent object
   */
  readAgent(agentId: string, globalConfig: boolean): Promise<AgentSkeleton>;
  /**
   * Delete all agents
   */
  deleteAgents(): Promise<void>;
  /**
   * Delete agent
   * @param agentId agent id/name
   */
  deleteAgent(agentId: string): Promise<void>;
  /**
   * Export all agents. The response can be saved to file as is.
   * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportAgents(globalConfig: boolean): Promise<AgentExportInterface>;
  /**
   * Export agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportAgent(
    agentId: string,
    globalConfig: boolean
  ): Promise<AgentExportInterface>;
  /**
   * Import agents. The import data is usually read from an agent export file.
   * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise<AgentSkeleton[]>} The agents that were imported.
   */
  importAgents(
    importData: AgentExportInterface,
    globalConfig: boolean
  ): Promise<AgentSkeleton[]>;
  /**
   * Import agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<AgentSkeleton>} Promise resolving to an agent object.
   */
  importAgent(
    agentId: string,
    importData: AgentExportInterface,
    globalConfig: boolean
  ): Promise<AgentSkeleton>;
  // IdentityGatewayAgent
  /**
   * Read identity gateway agents
   * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array of IdentityGatewayAgent objects
   */
  readIdentityGatewayAgents(): Promise<AgentSkeleton[]>;
  /**
   * Read identity gateway agent
   * @param {string} gatewayId gateway id
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an IdentityGatewayAgent object
   */
  readIdentityGatewayAgent(gatewayId: string): Promise<AgentSkeleton>;
  /**
   * Create identity gateway agent
   * @param {string} gatewayId gateway id
   * @param {AgentSkeleton} gatewayData IdentityGatewayAgent object
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an IdentityGatewayAgent object
   */
  createIdentityGatewayAgent(
    gatewayId: string,
    gatewayData: AgentSkeleton
  ): Promise<AgentSkeleton>;
  /**
   * Update or create identity gateway agent
   * @param {string} gatewayId gateway id
   * @param {AgentSkeleton} gatewayData IdentityGatewayAgent object
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an IdentityGatewayAgent object
   */
  updateIdentityGatewayAgent(
    gatewayId: string,
    gatewayData: AgentSkeleton
  ): Promise<AgentSkeleton>;
  /**
   * Delete all identity gateway agents
   */
  deleteIdentityGatewayAgents(): Promise<void>;
  /**
   * Delete identity gateway agent
   * @param agentId agent id/name
   */
  deleteIdentityGatewayAgent(agentId: string): Promise<void>;
  /**
   * Export all identity gateway agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportIdentityGatewayAgents(): Promise<AgentExportInterface>;
  /**
   * Export identity gateway agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportIdentityGatewayAgent(agentId: string): Promise<AgentExportInterface>;
  /**
   * Import identity gateway agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   */
  importIdentityGatewayAgents(importData: AgentExportInterface): Promise<void>;
  /**
   * Import identity gateway agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise<AgentSkeleton>} Promise resolving to an agent object.
   */
  importIdentityGatewayAgent(
    agentId: string,
    importData: AgentExportInterface
  ): Promise<AgentSkeleton>;
  // J2EEAgent
  /**
   * Read java agents
   * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array of J2EEAgent objects
   */
  readJavaAgents(): Promise<AgentSkeleton[]>;
  /**
   * Read java agent
   * @param {string} agentId java agent id
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an J2EEAgent object
   */
  readJavaAgent(agentId: string): Promise<AgentSkeleton>;
  /**
   * Create java agent
   * @param {string} agentId java agent id
   * @param {AgentSkeleton} agentData java agent object
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an java agent object
   */
  createJavaAgent(
    agentId: string,
    agentData: AgentSkeleton
  ): Promise<AgentSkeleton>;
  /**
   * Update or create java agent
   * @param {string} agentId java agent id
   * @param {AgentSkeleton} agentData java agent object
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an java agent object
   */
  updateJavaAgent(
    agentId: string,
    agentData: AgentSkeleton
  ): Promise<AgentSkeleton>;
  /**
   * Delete all java agents
   */
  deleteJavaAgents(): Promise<void>;
  /**
   * Delete java agent
   * @param agentId agent id/name
   */
  deleteJavaAgent(agentId: string): Promise<void>;
  /**
   * Export all java agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportJavaAgents(): Promise<AgentExportInterface>;
  /**
   * Export java agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportJavaAgent(agentId: string): Promise<AgentExportInterface>;
  /**
   * Import java agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   */
  importJavaAgents(importData: AgentExportInterface): Promise<void>;
  /**
   * Import java agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise<AgentSkeleton>} Promise resolving to an agent object.
   */
  importJavaAgent(
    agentId: string,
    importData: AgentExportInterface
  ): Promise<AgentSkeleton>;
  // WebAgent
  /**
   * Read web agents
   * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array of WebAgent objects
   */
  readWebAgents(): Promise<AgentSkeleton[]>;
  /**
   * Read web agent
   * @param {string} agentId web agent id
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an WebAgent object
   */
  readWebAgent(agentId: string): Promise<AgentSkeleton>;
  /**
   * Create web agent
   * @param {string} agentId web agent id
   * @param {AgentSkeleton} agentData WebAgent object
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an WebAgent object
   */
  createWebAgent(
    agentId: string,
    agentData: AgentSkeleton
  ): Promise<AgentSkeleton>;
  /**
   * Update or create web agent
   * @param {string} agentId web agent id
   * @param {AgentSkeleton} agentData WebAgent object
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an WebAgent object
   */
  updateWebAgent(
    agentId: string,
    agentData: AgentSkeleton
  ): Promise<AgentSkeleton>;
  /**
   * Delete all web agents
   */
  deleteWebAgents(): Promise<void>;
  /**
   * Delete web agent
   * @param agentId agent id/name
   */
  deleteWebAgent(agentId: string): Promise<void>;
  /**
   * Export all web agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportWebAgents(): Promise<AgentExportInterface>;
  /**
   * Export web agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportWebAgent(agentId: string): Promise<AgentExportInterface>;
  /**
   * Import web agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   */
  importWebAgents(importData: AgentExportInterface): Promise<void>;
  /**
   * Import web agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise<AgentSkeleton>} Promise resolving to an agent object.
   */
  importWebAgent(
    agentId: string,
    importData: AgentExportInterface
  ): Promise<AgentSkeleton>;
  // AIAgent
  /**
   * Read AI agents
   * @param {boolean} includeAgentIdentity whether to include related AI agent identity details
   * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array of AIAgent objects
   */
  readAIAgents(includeAgentIdentity?: boolean): Promise<AgentSkeleton[]>;
  /**
   * Read AI agent
   * @param {string} agentId AI agent id
   * @param {boolean} includeAgentIdentity whether to include related AI agent identity details
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an AIAgent object
   */
  readAIAgent(
    agentId: string,
    includeAgentIdentity?: boolean
  ): Promise<AgentSkeleton>;
  /**
   * Create AI agent
   * @param {string} agentId AI agent id
   * @param {AgentSkeleton} agentData AIAgent object
   * @param {boolean} includeAgentIdentity whether to create related AI agent identity objects
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an AIAgent object
   */
  createAIAgent(
    agentId: string,
    agentData: AgentSkeleton,
    includeAgentIdentity?: boolean
  ): Promise<AgentSkeleton>;
  /**
   * Update or create AI agent
   * @param {string} agentId AI agent id
   * @param {AgentSkeleton} agentData AIAgent object
   * @param {boolean} includeAgentIdentity whether to update related AI agent identity objects
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an AIAgent object
   */
  updateAIAgent(
    agentId: string,
    agentData: AgentSkeleton,
    includeAgentIdentity?: boolean
  ): Promise<AgentSkeleton>;
  /**
   * Delete all AI agents and their agent identity and privileges
   */
  deleteAIAgents(): Promise<void>;
  /**
   * Delete AI agent and agent identity and privileges
   * @param {string} agentId agent id/name
   */
  deleteAIAgent(agentId: string): Promise<void>;
  /**
   * Export all AI agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportAIAgents(): Promise<AgentExportInterface>;
  /**
   * Export AI agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @param {boolean} includeAgentIdentity whether to export related AI agent identity details
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportAIAgent(
    agentId: string,
    includeAgentIdentity?: boolean
  ): Promise<AgentExportInterface>;
  /**
   * Import AI agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   * @param {boolean} includeAgentIdentity whether to import related AI agent identity objects
   */
  importAIAgents(
    importData: AgentExportInterface,
    includeAgentIdentity?: boolean
  ): Promise<void>;
  /**
   * Import AI agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @param {boolean} includeAgentIdentity whether to import related AI agent identity objects
   * @returns {Promise<AgentSkeleton>} Promise resolving to an agent object.
   */
  importAIAgent(
    agentId: string,
    importData: AgentExportInterface,
    includeAgentIdentity?: boolean
  ): Promise<AgentSkeleton>;
  // Agent Groups
  /**
   * Read agent group by id
   * @param {string} groupId Group id
   * @returns {Promise<AgentGroupSkeleton>} a promise that resolves to a agent group object
   */
  readAgentGroup(groupId: string): Promise<AgentGroupSkeleton>;
  /**
   * Read all agent groups.
   * @returns {Promise<AgentGroupSkeleton[]>} a promise that resolves to an array of agent group objects
   */
  readAgentGroups(): Promise<AgentGroupSkeleton[]>;
  /**
   * Export a single agent group by id. The response can be saved to file as is.
   * @param {string} groupId Group id
   * @returns {Promise<AgentGroupExportInterface>} Promise resolving to a AgentGroupExportInterface object.
   */
  exportAgentGroup(groupId: string): Promise<AgentGroupExportInterface>;
  /**
   * Export all agent groups. The response can be saved to file as is.
   * @returns {Promise<AgentGroupExportInterface>} Promise resolving to a AgentGroupExportInterface object.
   */
  exportAgentGroups(): Promise<AgentGroupExportInterface>;
  /**
   * Import agents groups. The import data is usually read from an agent group export file.
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise<AgentGroupSkeleton[]>} The agent groups that were imported.
   */
  importAgentGroups(
    importData: AgentGroupExportInterface
  ): Promise<AgentGroupSkeleton[]>;
  /**
   * Import agent group. The import data is usually read from an agent group export file.
   * @param {string} agentGroupId agent group id/name
   * @param {AgentGroupExportInterface} importData agent group import data.
   * @returns {Promise<AgentGroupSkeleton>} Promise resolving to an agent group object.
   */
  importAgentGroup(
    agentGroupId: string,
    importData: AgentGroupExportInterface
  ): Promise<AgentGroupSkeleton>;
  // Export template
  /**
   * Create an empty agent export template
   * @returns {AgentExportInterface} an empty agent export template
   */
  createAgentExportTemplate(): AgentExportInterface;
  /**
   * Create an empty agent group export template
   * @returns {AgentGroupExportInterface} an empty agent export template
   */
  createAgentGroupExportTemplate(): AgentGroupExportInterface;
};

export default (state: State): Agent => {
  if (state.getDeploymentType() !== Constants.CLASSIC_DEPLOYMENT_TYPE_KEY) {
    AgentTypeBlacklist.push('SoapSTSAgent');
  }
  return {
    // General
    async readAgentTypes() {
      return readAgentTypes({ state });
    },
    async readAgentByTypeAndId(agentType, agentId) {
      return readAgentByTypeAndId({ agentType, agentId, state });
    },
    async readAgents(globalConfig = false) {
      return readAgents({ state, globalConfig });
    },
    async readAgent(agentId, globalConfig = false) {
      return readAgent({ agentId, globalConfig, state });
    },
    async deleteAgents() {
      return deleteAgents({ state });
    },
    async deleteAgent(agentId) {
      return deleteAgent({ agentId, state });
    },
    async exportAgents(globalConfig = false) {
      return exportAgents({ state, globalConfig });
    },
    async exportAgent(agentId, globalConfig = false) {
      return exportAgent({ agentId, globalConfig, state });
    },
    async importAgents(importData, globalConfig = false) {
      return importAgents({ importData, globalConfig, state });
    },
    async importAgent(agentId, importData, globalConfig = false) {
      return importAgent({ agentId, importData, globalConfig, state });
    },

    // IdentityGatewayAgent
    async readIdentityGatewayAgents() {
      return readIdentityGatewayAgents({ state });
    },
    async readIdentityGatewayAgent(gatewayId) {
      return readIdentityGatewayAgent({ gatewayId, state });
    },
    async createIdentityGatewayAgent(gatewayId, gatewayData) {
      return createIdentityGatewayAgent({ gatewayId, gatewayData, state });
    },
    async updateIdentityGatewayAgent(gatewayId, gatewayData) {
      return updateIdentityGatewayAgent({ gatewayId, gatewayData, state });
    },
    async deleteIdentityGatewayAgents() {
      return deleteIdentityGatewayAgents({ state });
    },
    async deleteIdentityGatewayAgent(agentId) {
      return deleteIdentityGatewayAgent({ agentId, state });
    },
    async exportIdentityGatewayAgents() {
      return exportIdentityGatewayAgents({ state });
    },
    async exportIdentityGatewayAgent(agentId) {
      return exportIdentityGatewayAgent({ agentId, state });
    },
    async importIdentityGatewayAgents(importData) {
      return importIdentityGatewayAgents({ importData, state });
    },
    async importIdentityGatewayAgent(agentId, importData) {
      return importIdentityGatewayAgent({ agentId, importData, state });
    },

    // J2EEAgent
    async readJavaAgents() {
      return readJavaAgents({ state });
    },
    async readJavaAgent(agentId) {
      return readJavaAgent({ agentId, state });
    },
    async createJavaAgent(agentId, agentData) {
      return createJavaAgent({ agentId, agentData, state });
    },
    async updateJavaAgent(agentId, agentData) {
      return updateJavaAgent({ agentId, agentData, state });
    },
    async deleteJavaAgents() {
      return deleteJavaAgents({ state });
    },
    async deleteJavaAgent(agentId) {
      return deleteJavaAgent({ agentId, state });
    },
    async exportJavaAgents() {
      return exportJavaAgents({ state });
    },
    async exportJavaAgent(agentId) {
      return exportJavaAgent({ agentId, state });
    },
    async importJavaAgents(importData) {
      return importJavaAgents({ importData, state });
    },
    async importJavaAgent(agentId, importData) {
      return importJavaAgent({ agentId, importData, state });
    },

    // WebAgent
    async readWebAgents() {
      return readWebAgents({ state });
    },
    async readWebAgent(agentId) {
      return readWebAgent({ agentId, state });
    },
    async createWebAgent(agentId, agentData) {
      return createWebAgent({ agentId, agentData, state });
    },
    async updateWebAgent(agentId, agentData) {
      return updateWebAgent({ agentId, agentData, state });
    },
    async deleteWebAgents() {
      return deleteWebAgents({ state });
    },
    async deleteWebAgent(agentId) {
      return deleteWebAgent({ agentId, state });
    },
    async exportWebAgents() {
      return exportWebAgents({ state });
    },
    async exportWebAgent(agentId) {
      return exportWebAgent({ agentId, state });
    },
    async importWebAgents(importData) {
      return importWebAgents({ importData, state });
    },
    async importWebAgent(agentId, importData) {
      return importWebAgent({ agentId, importData, state });
    },

    // AIAgent
    async readAIAgents(includeAgentIdentity = true) {
      return readAIAgents({ includeAgentIdentity, state });
    },
    async readAIAgent(agentId, includeAgentIdentity = true) {
      return readAIAgent({ agentId, includeAgentIdentity, state });
    },
    async createAIAgent(agentId, agentData, includeAgentIdentity = true) {
      return createAIAgent({ agentId, agentData, includeAgentIdentity, state });
    },
    async updateAIAgent(agentId, agentData, includeAgentIdentity = true) {
      return updateAIAgent({ agentId, agentData, includeAgentIdentity, state });
    },
    async deleteAIAgents() {
      return deleteAIAgents({ state });
    },
    async deleteAIAgent(agentId) {
      return deleteAIAgent({ agentId, state });
    },
    async exportAIAgents(includeAgentIdentity = true) {
      return exportAIAgents({ includeAgentIdentity, state });
    },
    async exportAIAgent(agentId, includeAgentIdentity = true) {
      return exportAIAgent({ agentId, includeAgentIdentity, state });
    },
    async importAIAgents(importData, includeAgentIdentity = true) {
      return importAIAgents({ importData, includeAgentIdentity, state });
    },
    async importAIAgent(agentId, importData, includeAgentIdentity = true) {
      return importAIAgent({
        agentId,
        importData,
        includeAgentIdentity,
        state,
      });
    },

    // Agent Groups
    async readAgentGroup(groupId) {
      return readAgentGroup({ groupId, state });
    },
    async readAgentGroups() {
      return readAgentGroups({ state });
    },
    async exportAgentGroup(groupId) {
      return exportAgentGroup({ groupId, state });
    },
    async exportAgentGroups() {
      return exportAgentGroups({ state });
    },
    async importAgentGroups(importData) {
      return importAgentGroups({ importData, state });
    },
    async importAgentGroup(agentGroupId, importData) {
      return importAgentGroup({ agentGroupId, importData, state });
    },

    // Export template
    createAgentExportTemplate() {
      return createAgentExportTemplate({ state });
    },
    createAgentGroupExportTemplate() {
      return createAgentGroupExportTemplate({ state });
    },
  };
};

export interface AgentExportInterface {
  meta?: ExportMetaData;
  agent: Record<string, AgentSkeleton>;
}

export interface AgentGroupExportInterface {
  meta?: ExportMetaData;
  agentGroup: Record<string, AgentGroupSkeleton>;
}

const AgentTypeItemCache: _AgentTypeItem[] = [];
const AgentTypeBlacklist: AgentType[] = ['OAuth2Client'];

/**
 * Read all available agent types.
 * @returns {Promise<AgentType[]>} a promise that resolves to an array of agent type items
 */
export async function readAgentTypes({
  refreshCache = false,
  state,
}: {
  refreshCache?: boolean;
  state: State;
}): Promise<AgentType[]> {
  try {
    debugMessage({ message: `AgentOps.readAgentTypes: start`, state });
    let agentTypeItems: _AgentTypeItem[] = [];
    if (!refreshCache && AgentTypeItemCache.length > 0) {
      debugMessage({
        message: `AgentOps.readAgentTypes: using cached agent types`,
        state,
      });
      agentTypeItems = cloneDeep(AgentTypeItemCache);
    } else {
      const { result } = await _getAgentTypes({ state });
      agentTypeItems = result.filter(
        (item) => !AgentTypeBlacklist.includes(item._id)
      );
      // Update cache with new values.
      AgentTypeItemCache.splice(
        0,
        AgentTypeItemCache.length,
        ...agentTypeItems
      );
    }
    debugMessage({ message: `AgentOps.readAgentTypes: end`, state });
    return agentTypeItems.map((item) => item._id);
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
 * Get all agents. Results are sorted alphabetically.
 * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array of agent objects
 */
export async function readAgents({
  state,
  globalConfig = false,
}: {
  state: State;
  globalConfig: boolean;
}): Promise<AgentSkeleton[]> {
  try {
    debugMessage({ message: `AgentOps.readAgents: start`, state });
    let agents = [];
    if (globalConfig) {
      const resolved = await _getAgents({ state, globalConfig });
      agents = agents.concat(resolved.result);
    } else {
      const agentTypes = await readAgentTypes({ state });
      const resolved = await Promise.all(
        agentTypes
          .filter((t) => !AgentTypeBlacklist.includes(t))
          .map((agentType) =>
            _getAgentsByType({ agentType, state }).catch(() => {
              return { result: [] };
            })
          )
      );
      agents = agents.concat(...resolved.map((response) => response.result));
    }
    agents.sort((a, b) => a._id.localeCompare(b._id));
    debugMessage({ message: `AgentOps.readAgents: end`, state });
    return agents;
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
        `Error reading ${getCurrentRealmName(state) + ' realm'} agents`,
        error
      );
    }
  }
}

/**
 * Get agent
 * @param {string} agentId agent id/name
 * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AgentSkeleton>} a promise that resolves to an agent object
 */
export async function readAgent({
  agentId,
  globalConfig = false,
  state,
}: {
  agentId: string;
  globalConfig: boolean;
  state: State;
}): Promise<AgentSkeleton> {
  let agents: AgentSkeleton[] = [];
  try {
    debugMessage({ message: `AgentOps.readAgent: start`, state });
    agents = (await readAgents({ globalConfig, state })).filter(
      (a) => a._id === agentId
    );
    if (agents.length === 1) {
      debugMessage({ message: `AgentOps.readAgent: end`, state });
      return agents[0];
    }
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} agent ${agentId}`,
      error
    );
  }
  if (agents.length === 0) {
    throw new FrodoError(
      `${getCurrentRealmName(state) + ' realm'} agent '${agentId}' not found`
    );
  } else {
    throw new FrodoError(
      `${agents.length} ${getCurrentRealmName(state) + ' realm'} agents '${agentId}' found`
    );
  }
}

/**
 * Delete all agents
 */
export async function deleteAgents({ state }: { state: State }) {
  const errors: Error[] = [];
  try {
    debugMessage({ message: `AgentOps.deleteAgents: start`, state });
    const agents = await readAgents({ state, globalConfig: false });
    for (const agent of agents) {
      try {
        debugMessage({
          message: `AgentOps.deleteAgents: '${agent['_id']}'`,
          state,
        });
        await _deleteAgentByTypeAndId({
          agentType: agent['_type']['_id'] as AgentType,
          agentId: agent['_id'],
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error deleting ${getCurrentRealmName(state) + ' realm'} agent ${agent['_id']} of type ${agent['_type']['_id']}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting agents`, errors);
    }
    debugMessage({ message: `AgentOps.deleteAgents: end`, state });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting agents`, error);
  }
}

/**
 * Delete agent
 * @param agentId agent id/name
 */
export async function deleteAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  try {
    debugMessage({ message: `AgentOps.deleteAgent: start`, state });
    const agents = await _findAgentById({ agentId, state });
    if (agents.length == 0) {
      throw new FrodoError(
        `${getCurrentRealmName(state) + ' realm'} agent '${agentId}' not found!`
      );
    }
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteAgent: '${agent['_id']}'`,
        state,
      });
      await _deleteAgentByTypeAndId({
        agentType: agent['_type'],
        agentId: agent['_id'],
        state,
      });
    }
    debugMessage({ message: `AgentOps.deleteAgent: end`, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} agent ${agentId}`,
      error
    );
  }
}

/**
 * Export all agents. The response can be saved to file as is.
 * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
 */
export async function exportAgents({
  state,
  globalConfig = false,
}: {
  state: State;
  globalConfig: boolean;
}): Promise<AgentExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `AgentOps.exportAgents: start`, state });
    const exportData = createAgentExportTemplate({ state });
    const agents = await readAgents({ state, globalConfig });
    indicatorId = createProgressIndicator({
      total: agents.length,
      message: `Exporting ${getCurrentRealmName(state) + ' realm'} agents...`,
      state,
    });
    for (const agent of agents) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting ${getCurrentRealmName(state) + ' realm'} agent ${agent._id}`,
        state,
      });
      exportData.agent[agent._id] = agent;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${agents.length} ${getCurrentRealmName(state) + ' realm'} agents.`,
      state,
    });
    debugMessage({ message: `AgentOps.exportAgents: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting ${getCurrentRealmName(state) + ' realm'} agents`,
      status: 'fail',
      state,
    });
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} agents`,
      error
    );
  }
}

/**
 * Export agent. The response can be saved to file as is.
 * @param agentId agent id/name
 * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
 */
export async function exportAgent({
  agentId,
  globalConfig = false,
  state,
}: {
  agentId: string;
  globalConfig: boolean;
  state: State;
}): Promise<AgentExportInterface> {
  try {
    debugMessage({ message: `AgentOps.exportAgent: start`, state });
    const exportData = createAgentExportTemplate({ state });
    const agentObject = await readAgent({ agentId, globalConfig, state });
    exportData.agent[agentId] = agentObject;
    debugMessage({ message: `AgentOps.exportAgent: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} agent ${agentId}`,
      error
    );
  }
}

/**
 * Import agents. The import data is usually read from an agent export file.
 * @param {AgentExportInterface} importData agent import data.
 * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AgentSkeleton[]>} The agents that were imported.
 */
export async function importAgents({
  importData,
  globalConfig = false,
  state,
}: {
  importData: AgentExportInterface;
  globalConfig: boolean;
  state: State;
}): Promise<AgentSkeleton[]> {
  const response: AgentSkeleton[] = [];
  const errors: Error[] = [];
  try {
    debugMessage({ message: `AgentOps.importAgents: start`, state });
    for (const agentId of Object.keys(importData.agent)) {
      let agentType: AgentType;
      try {
        agentType = importData.agent[agentId]._type._id as AgentType;
        debugMessage({
          message: `AgentOps.importAgents: ${agentId} [${agentType}]`,
          state,
        });
        if (
          agentType === 'SoapSTSAgent' &&
          state.getDeploymentType() !== Constants.CLASSIC_DEPLOYMENT_TYPE_KEY
        ) {
          throw new FrodoError(
            `Can't import Soap STS agents for '${state.getDeploymentType()}' deployment type.`
          );
        }
        response.push(
          await _putAgentByTypeAndId({
            agentType,
            agentId,
            agentData: importData.agent[agentId],
            globalConfig,
            state,
          })
        );
      } catch (error) {
        if (error.httpStatus !== 501 && error.response?.status !== 501) {
          errors.push(
            new FrodoError(
              `Error importing ${getCurrentRealmName(state) + ' realm'} agent ${agentId} of type ${agentType}`,
              error
            )
          );
        }
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing ${getCurrentRealmName(state) + ' realm'} agents`,
        errors
      );
    }
    debugMessage({ message: `AgentOps.importAgents: end`, state });
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} agents`,
      error
    );
  }
}

/**
 * Import agent. The import data is usually read from an agent export file.
 * @param {string} agentId agent id/name
 * @param {AgentExportInterface} importData agent import data.
 * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AgentSkeleton>} Promise resolving to an agent object.
 */
export async function importAgent({
  agentId,
  importData,
  globalConfig = false,
  state,
}: {
  agentId: string;
  importData: AgentExportInterface;
  globalConfig: boolean;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({ message: `AgentOps.importAgent: start`, state });
    const agentType = importData.agent[agentId]?._type._id as AgentType;
    if (
      agentType === 'SoapSTSAgent' &&
      state.getDeploymentType() !== Constants.CLASSIC_DEPLOYMENT_TYPE_KEY
    ) {
      throw new FrodoError(
        `Can't import Soap STS agents for '${state.getDeploymentType()}' deployment type.`
      );
    }
    const result = await _putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agent[agentId],
      globalConfig,
      state,
    });
    debugMessage({ message: `AgentOps.importAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} agent ${agentId}`,
      error
    );
  }
}

/**
 * Get agent by type and id
 * @param {AgentType} agentType agent type
 * @param {string} agentId agent id/name
 * @returns {Promise<AgentSkeleton>} a promise that resolves to an agent object
 */
export async function readAgentByTypeAndId({
  agentType,
  agentId,
  state,
}: {
  agentType: AgentType;
  agentId: string;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({ message: `AgentOps.readAgentByTypeAndId: start`, state });
    const result = await _getAgentByTypeAndId({
      agentType,
      agentId,
      globalConfig: false,
      state,
    });
    debugMessage({ message: `AgentOps.readAgentByTypeAndId: start`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} agent ${agentId} of type ${agentType}`,
      error
    );
  }
}

/**
 * Get identity gateway agents
 * @returns {: Promise<AgentSkeleton[]>} a promise that resolves to an array of IdentityGatewayAgent objects
 */
export async function readIdentityGatewayAgents({
  state,
}: {
  state: State;
}): Promise<AgentSkeleton[]> {
  try {
    debugMessage({
      message: `AgentOps.readIdentityGatewayAgents: start`,
      state,
    });
    const { result } = await _getAgentsByType({
      agentType: 'IdentityGatewayAgent',
      state,
    });
    debugMessage({ message: `AgentOps.readIdentityGatewayAgents: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} identity gateway agents`,
      error
    );
  }
}

/**
 * Get identity gateway agent
 * @param {string} gatewayId gateway id
 * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an IdentityGatewayAgent object
 */
export async function readIdentityGatewayAgent({
  gatewayId,
  state,
}: {
  gatewayId: string;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({
      message: `AgentOps.readIdentityGatewayAgent: start`,
      state,
    });
    const result = await readAgentByTypeAndId({
      agentType: 'IdentityGatewayAgent',
      agentId: gatewayId,
      state,
    });
    debugMessage({ message: `AgentOps.readIdentityGatewayAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} identity gateway agent ${gatewayId}`,
      error
    );
  }
}

/**
 * Create identity gateway agent
 * @param {string} gatewayId gateway id
 * @param {AgentSkeleton} gatewayData IdentityGatewayAgent object
 * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an IdentityGatewayAgent object
 */
export async function createIdentityGatewayAgent({
  gatewayId,
  gatewayData,
  state,
}: {
  gatewayId: string;
  gatewayData: AgentSkeleton;
  state: State;
}): Promise<AgentSkeleton> {
  debugMessage({
    message: `AgentOps.createIdentityGatewayAgent: start`,
    state,
  });
  try {
    await readIdentityGatewayAgent({ gatewayId, state });
    throw new FrodoError(`Agent ${gatewayId} already exists!`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    try {
      const result = await _putAgentByTypeAndId({
        agentType: 'IdentityGatewayAgent',
        agentId: gatewayId,
        agentData: gatewayData,
        globalConfig: false,
        state,
      });
      debugMessage({
        message: `AgentOps.createIdentityGatewayAgent: end`,
        state,
      });
      return result;
    } catch (error) {
      throw new FrodoError(
        `Error creating ${getCurrentRealmName(state) + ' realm'} identity gateway agent ${gatewayId}`,
        error
      );
    }
  }
}

/**
 * Update or create identity gateway agent
 * @param {string} gatewayId gateway id
 * @param {AgentSkeleton} gatewayData IdentityGatewayAgent object
 * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an IdentityGatewayAgent object
 */
export async function updateIdentityGatewayAgent({
  gatewayId,
  gatewayData,
  state,
}: {
  gatewayId: string;
  gatewayData: AgentSkeleton;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({
      message: `AgentOps.updateIdentityGatewayAgent: start`,
      state,
    });
    const result = await _putAgentByTypeAndId({
      agentType: 'IdentityGatewayAgent',
      agentId: gatewayId,
      agentData: gatewayData,
      globalConfig: false,
      state,
    });
    debugMessage({
      message: `AgentOps.updateIdentityGatewayAgent: end`,
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error updating ${getCurrentRealmName(state) + ' realm'} identity gateway agent ${gatewayId}`,
      error
    );
  }
}

/**
 * Delete all identity gateway agents
 */
export async function deleteIdentityGatewayAgents({ state }: { state: State }) {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `AgentOps.deleteIdentityGatewayAgents: start`,
      state,
    });
    const agents = await readIdentityGatewayAgents({ state });
    for (const agent of agents) {
      try {
        debugMessage({
          message: `AgentOps.deleteIdentityGatewayAgent: '${agent['_id']}'`,
          state,
        });
        await _deleteAgentByTypeAndId({
          agentType: agent['_type']['_id'] as AgentType,
          agentId: agent['_id'],
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error deleting ${getCurrentRealmName(state) + ' realm'} agent ${agent['_id']} of type ${agent['_type']['_id']}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting identity gateway agents`, errors);
    }
    debugMessage({
      message: `AgentOps.deleteIdentityGatewayAgents: end`,
      state,
    });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting identity gateway agents`, error);
  }
}

/**
 * Delete identity gateway agent
 * @param agentId agent id/name
 */
export async function deleteIdentityGatewayAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  try {
    debugMessage({
      message: `AgentOps.deleteIdentityGatewayAgent: start`,
      state,
    });
    const agents = await _findAgentByTypeAndId({
      agentType: 'IdentityGatewayAgent',
      agentId,
      state,
    });
    if (agents.length == 0) {
      throw new FrodoError(
        `${getCurrentRealmName(state) + ' realm'} identity gateway agent '${agentId}' not found!`
      );
    }
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteIdentityGatewayAgent: '${agent['_id']}'`,
        state,
      });
      await _deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'] as AgentType,
        agentId: agent['_id'],
        state,
      });
    }
    debugMessage({
      message: `AgentOps.deleteIdentityGatewayAgent: end`,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} identity gateway agent ${agentId}`,
      error
    );
  }
}

/**
 * Export all identity gateway agents. The response can be saved to file as is.
 * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
 */
export async function exportIdentityGatewayAgents({
  state,
}: {
  state: State;
}): Promise<AgentExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `AgentOps.exportIdentityGatewayAgents: start`,
      state,
    });
    const exportData = createAgentExportTemplate({ state });
    const agents = await readIdentityGatewayAgents({ state });
    indicatorId = createProgressIndicator({
      total: agents.length,
      message: `Exporting ${getCurrentRealmName(state) + ' realm'} identity gateway agents...`,
      state,
    });
    for (const agent of agents) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting ${getCurrentRealmName(state) + ' realm'} identity gateway agent ${agent._id}`,
        state,
      });
      exportData.agent[agent._id] = agent;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${agents.length} ${getCurrentRealmName(state) + ' realm'} identity gateway agents.`,
      state,
    });
    debugMessage({
      message: `AgentOps.exportIdentityGatewayAgents: end`,
      state,
    });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting ${getCurrentRealmName(state) + ' realm'} identity gateway agents`,
      status: 'fail',
      state,
    });
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} identity gateway agents`,
      error
    );
  }
}

/**
 * Export identity gateway agent. The response can be saved to file as is.
 * @param agentId agent id/name
 * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
 */
export async function exportIdentityGatewayAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}): Promise<AgentExportInterface> {
  try {
    debugMessage({
      message: `AgentOps.exportIdentityGatewayAgent: start`,
      state,
    });
    const exportData = createAgentExportTemplate({ state });
    const agentObject = await readIdentityGatewayAgent({
      gatewayId: agentId,
      state,
    });
    exportData.agent[agentId] = agentObject;
    debugMessage({
      message: `AgentOps.exportIdentityGatewayAgent: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} identity gateway agent ${agentId}`,
      error
    );
  }
}

/**
 * Import identity gateway agents. The import data is usually read from an agent export file.
 * @param {AgentExportInterface} importData agent import data.
 */
export async function importIdentityGatewayAgents({
  importData,
  state,
}: {
  importData: AgentExportInterface;
  state: State;
}): Promise<void> {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `AgentOps.importIdentityGatewayAgents: start`,
      state,
    });
    for (const agentId of Object.keys(importData.agent)) {
      let agentType: AgentType;
      try {
        agentType = importData.agent[agentId]._type._id as AgentType;
        if (agentType !== 'IdentityGatewayAgent')
          throw new FrodoError(
            `Wrong agent type! Expected 'IdentityGatewayAgent' but got '${agentType}'.`
          );
        await _putAgentByTypeAndId({
          agentType,
          agentId,
          agentData: importData.agent[agentId],
          globalConfig: false,
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error importing ${getCurrentRealmName(state) + ' realm'} agent ${agentId} of type ${agentType}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing ${getCurrentRealmName(state) + ' realm'} identity gateway agents`,
        errors
      );
    }
    debugMessage({
      message: `AgentOps.importIdentityGatewayAgents: end`,
      state,
    });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} identity gateway agents`,
      error
    );
  }
}

/**
 * Import identity gateway agent. The import data is usually read from an agent export file.
 * @param {string} agentId agent id/name
 * @param {AgentExportInterface} importData agent import data.
 * @returns {Promise<AgentSkeleton>} Promise resolving to an agent object.
 */
export async function importIdentityGatewayAgent({
  agentId,
  importData,
  state,
}: {
  agentId: string;
  importData: AgentExportInterface;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({
      message: `AgentOps.importIdentityGatewayAgent: start`,
      state,
    });
    const agentType = importData.agent[agentId]?._type._id as AgentType;
    if (agentType !== 'IdentityGatewayAgent')
      throw new FrodoError(
        `Wrong agent type! Expected 'IdentityGatewayAgent' but got '${agentType}'.`
      );
    const result = await _putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agent[agentId],
      globalConfig: false,
      state,
    });
    debugMessage({
      message: `AgentOps.importIdentityGatewayAgent: end`,
      state,
    });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} identity gateway agent ${agentId}`,
      error
    );
  }
}

/**
 * Get java agents
 * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array of J2EEAgent objects
 */
export async function readJavaAgents({
  state,
}: {
  state: State;
}): Promise<AgentSkeleton[]> {
  try {
    debugMessage({ message: `AgentOps.readJavaAgents: start`, state });
    const { result } = await _getAgentsByType({
      agentType: 'J2EEAgent',
      state,
    });
    debugMessage({ message: `AgentOps.readJavaAgents: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} java agents`,
      error
    );
  }
}

/**
 * Get java agent
 * @param {string} agentId java agent id
 * @returns {Promise} a promise that resolves to an object containing an J2EEAgent object
 */
export async function readJavaAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({ message: `AgentOps.readJavaAgent: start`, state });
    const result = await readAgentByTypeAndId({
      agentType: 'J2EEAgent',
      agentId,
      state,
    });
    debugMessage({ message: `AgentOps.readJavaAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} java agent ${agentId}`,
      error
    );
  }
}

/**
 * Create java agent
 * @param {string} agentId java agent id
 * @param {Object} agentData java agent object
 * @returns {Promise} a promise that resolves to an object containing an java agent object
 */
export async function createJavaAgent({
  agentId,
  agentData,
  state,
}: {
  agentId: string;
  agentData: AgentSkeleton;
  state: State;
}): Promise<AgentSkeleton> {
  debugMessage({ message: `AgentOps.createJavaAgent: start`, state });
  try {
    await readJavaAgent({ agentId, state });
    throw new FrodoError(`Agent ${agentId} already exists!`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    try {
      const result = await _putAgentByTypeAndId({
        agentType: 'J2EEAgent',
        agentId,
        agentData,
        globalConfig: false,
        state,
      });
      debugMessage({
        message: `AgentOps.createJavaAgent: end`,
        state,
      });
      return result;
    } catch (error) {
      throw new FrodoError(
        `Error creating ${getCurrentRealmName(state) + ' realm'} java agent ${agentId}`,
        error
      );
    }
  }
}

/**
 * Update or create java agent
 * @param {string} agentId java agent id
 * @param {Object} agentData java agent object
 * @returns {Promise} a promise that resolves to an object containing an java agent object
 */
export async function updateJavaAgent({
  agentId,
  agentData,
  state,
}: {
  agentId: string;
  agentData: AgentSkeleton;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({ message: `AgentOps.updateJavaAgent: start`, state });
    const result = await _putAgentByTypeAndId({
      agentType: 'J2EEAgent',
      agentId,
      agentData,
      globalConfig: false,
      state,
    });
    debugMessage({ message: `AgentOps.updateJavaAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error updating ${getCurrentRealmName(state) + ' realm'} java agent ${agentId}`,
      error
    );
  }
}

/**
 * Delete all java agents
 */
export async function deleteJavaAgents({ state }: { state: State }) {
  const errors: Error[] = [];
  try {
    debugMessage({ message: `AgentOps.deleteJavaAgents: start`, state });
    const agents = await readJavaAgents({ state });
    for (const agent of agents) {
      try {
        debugMessage({
          message: `AgentOps.deleteJavaAgent: '${agent['_id']}'`,
          state,
        });
        await _deleteAgentByTypeAndId({
          agentType: agent['_type']['_id'] as AgentType,
          agentId: agent['_id'],
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error deleting ${getCurrentRealmName(state) + ' realm'} agent ${agent['_id']} of type ${agent['_type']['_id']}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error deleting ${getCurrentRealmName(state) + ' realm'} java agents`,
        errors
      );
    }
    debugMessage({ message: `AgentOps.deleteJavaAgents: end`, state });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} java agents`,
      error
    );
  }
}

/**
 * Delete java agent
 * @param agentId agent id/name
 */
export async function deleteJavaAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  try {
    debugMessage({ message: `AgentOps.deleteJavaAgent: start`, state });
    const agents = await _findAgentByTypeAndId({
      agentType: 'J2EEAgent',
      agentId,
      state,
    });
    if (agents.length == 0) {
      throw new FrodoError(
        `${getCurrentRealmName(state) + ' realm'} java agent '${agentId}' not found!`
      );
    }
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteJavaAgent: '${agent['_id']}'`,
        state,
      });
      await _deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'] as AgentType,
        agentId: agent['_id'],
        state,
      });
    }
    debugMessage({ message: `AgentOps.deleteJavaAgent: end`, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} java agent ${agentId}`,
      error
    );
  }
}

/**
 * Export all java agents. The response can be saved to file as is.
 * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
 */
export async function exportJavaAgents({
  state,
}: {
  state: State;
}): Promise<AgentExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `AgentOps.exportJavaAgents: start`, state });
    const exportData = createAgentExportTemplate({ state });
    const agents = await readJavaAgents({ state });
    indicatorId = createProgressIndicator({
      total: agents.length,
      message: `Exporting ${getCurrentRealmName(state) + ' realm'} Java agents...`,
      state,
    });
    for (const agent of agents) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting ${getCurrentRealmName(state) + ' realm'} Java agent ${agent._id}`,
        state,
      });
      exportData.agent[agent._id] = agent;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${agents.length} ${getCurrentRealmName(state) + ' realm'} Java agents.`,
      state,
    });
    debugMessage({ message: `AgentOps.exportJavaAgents: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting ${getCurrentRealmName(state) + ' realm'} java agents`,
      status: 'fail',
      state,
    });
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} java agents`,
      error
    );
  }
}

/**
 * Export java agent. The response can be saved to file as is.
 * @param agentId agent id/name
 * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
 */
export async function exportJavaAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}): Promise<AgentExportInterface> {
  try {
    debugMessage({ message: `AgentOps.exportJavaAgent: start`, state });
    const exportData = createAgentExportTemplate({ state });
    const agentObject = await readJavaAgent({ agentId, state });
    exportData.agent[agentId] = agentObject;
    debugMessage({ message: `AgentOps.exportJavaAgent: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} java agent ${agentId}`,
      error
    );
  }
}

/**
 * Import java agents. The import data is usually read from an agent export file.
 * @param {AgentExportInterface} importData agent import data.
 */
export async function importJavaAgents({
  importData,
  state,
}: {
  importData: AgentExportInterface;
  state: State;
}): Promise<void> {
  const errors: Error[] = [];
  try {
    debugMessage({ message: `AgentOps.importJavaAgents: start`, state });
    for (const agentId of Object.keys(importData.agent)) {
      let agentType: AgentType;
      try {
        agentType = importData.agent[agentId]._type._id as AgentType;
        if (agentType !== 'J2EEAgent')
          throw new FrodoError(
            `Wrong agent type! Expected 'J2EEAgent' but got '${agentType}'.`
          );
        await _putAgentByTypeAndId({
          agentType,
          agentId,
          agentData: importData.agent[agentId],
          globalConfig: false,
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error importing ${getCurrentRealmName(state) + ' realm'} agent ${agentId} of type ${agentType}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing ${getCurrentRealmName(state) + ' realm'} java agents`,
        errors
      );
    }
    debugMessage({ message: `AgentOps.importJavaAgents: end`, state });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} java agents`,
      error
    );
  }
}

/**
 * Import java agent. The import data is usually read from an agent export file.
 * @param {string} agentId agent id/name
 * @param {AgentExportInterface} importData agent import data.
 * @returns {Promise<AgentSkeleton>} Promise resolving to an agent object.
 */
export async function importJavaAgent({
  agentId,
  importData,
  state,
}: {
  agentId: string;
  importData: AgentExportInterface;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({ message: `AgentOps.importJavaAgent: start`, state });
    const agentType = importData.agent[agentId]?._type._id as AgentType;
    if (agentType !== 'J2EEAgent')
      throw new FrodoError(
        `Wrong agent type! Expected 'J2EEAgent' but got '${agentType}'.`
      );
    const result = await _putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agent[agentId],
      globalConfig: false,
      state,
    });
    debugMessage({ message: `AgentOps.importJavaAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} java agent ${agentId}`,
      error
    );
  }
}

/**
 * Get web agents
 * @returns {Promise} a promise that resolves to an array of WebAgent objects
 */
export async function readWebAgents({ state }: { state: State }) {
  try {
    debugMessage({ message: `AgentOps.readWebAgents: start`, state });
    const { result } = await _getAgentsByType({
      agentType: 'WebAgent',
      state,
    });
    debugMessage({ message: `AgentOps.readWebAgents: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} web agents`,
      error
    );
  }
}

/**
 * Get web agent
 * @param {string} agentId web agent id
 * @returns {Promise} a promise that resolves to an object containing an WebAgent object
 */
export async function readWebAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  try {
    debugMessage({ message: `AgentOps.readWebAgent: start`, state });
    const result = await readAgentByTypeAndId({
      agentType: 'WebAgent',
      agentId,
      state,
    });
    debugMessage({ message: `AgentOps.readWebAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} web agent ${agentId}`,
      error
    );
  }
}

/**
 * Create web agent
 * @param {string} agentId java agent id
 * @param {Object} agentData java agent object
 * @returns {Promise} a promise that resolves to an object containing an java agent object
 */
export async function createWebAgent({
  agentId,
  agentData,
  state,
}: {
  agentId: string;
  agentData: AgentSkeleton;
  state: State;
}): Promise<AgentSkeleton> {
  debugMessage({ message: `AgentOps.createWebAgent: start`, state });
  try {
    await readWebAgent({ agentId, state });
    throw new FrodoError(`Agent ${agentId} already exists!`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    try {
      const result = await _putAgentByTypeAndId({
        agentType: 'WebAgent',
        agentId,
        agentData,
        globalConfig: false,
        state,
      });
      debugMessage({
        message: `AgentOps.createWebAgent: end`,
        state,
      });
      return result;
    } catch (error) {
      throw new FrodoError(
        `Error creating ${getCurrentRealmName(state) + ' realm'} web agent ${agentId}`,
        error
      );
    }
  }
}

/**
 * Update or create web agent
 * @param {string} agentId web agent id
 * @param {Object} agentData WebAgent object
 * @returns {Promise} a promise that resolves to an object containing an WebAgent object
 */
export async function updateWebAgent({
  agentId,
  agentData,
  state,
}: {
  agentId: string;
  agentData: AgentSkeleton;
  state: State;
}) {
  try {
    debugMessage({ message: `AgentOps.updateWebAgent: start`, state });
    const result = await _putAgentByTypeAndId({
      agentType: 'WebAgent',
      agentId,
      agentData,
      globalConfig: false,
      state,
    });
    debugMessage({ message: `AgentOps.updateWebAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error updating ${getCurrentRealmName(state) + ' realm'} web agent ${agentId}`,
      error
    );
  }
}

/**
 * Delete all web agents
 */
export async function deleteWebAgents({ state }: { state: State }) {
  const errors: Error[] = [];
  try {
    debugMessage({ message: `AgentOps.deleteWebAgents: start`, state });
    const agents = await readWebAgents({ state });
    for (const agent of agents) {
      try {
        debugMessage({
          message: `AgentOps.deleteWebAgent: '${agent['_id']}'`,
          state,
        });
        await _deleteAgentByTypeAndId({
          agentType: agent['_type']['_id'] as AgentType,
          agentId: agent['_id'],
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error deleting ${getCurrentRealmName(state) + ' realm'} agent ${agent['_id']} of type ${agent['_type']['_id']}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error deleting ${getCurrentRealmName(state) + ' realm'} web agents`,
        errors
      );
    }
    debugMessage({ message: `AgentOps.deleteWebAgents: end`, state });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} web agents`,
      error
    );
  }
}

/**
 * Delete web agent
 * @param agentId agent id/name
 */
export async function deleteWebAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  try {
    debugMessage({ message: `AgentOps.deleteWebAgent: start`, state });
    const agents = await _findAgentByTypeAndId({
      agentType: 'WebAgent',
      agentId,
      state,
    });
    if (agents.length == 0) {
      throw new FrodoError(
        `${getCurrentRealmName(state) + ' realm'} web agent '${agentId}' not found!`
      );
    }
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteWebAgent: '${agent['_id']}'`,
        state,
      });
      await _deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'] as AgentType,
        agentId: agent['_id'],
        state,
      });
    }
    debugMessage({ message: `AgentOps.deleteWebAgent: end`, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} web agent ${agentId}`,
      error
    );
  }
}

/**
 * Export all web agents. The response can be saved to file as is.
 * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
 */
export async function exportWebAgents({
  state,
}: {
  state: State;
}): Promise<AgentExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({ message: `AgentOps.exportWebAgents: start`, state });
    const exportData = createAgentExportTemplate({ state });
    const agents = await readWebAgents({ state });
    indicatorId = createProgressIndicator({
      total: agents.length,
      message: `Exporting ${getCurrentRealmName(state) + ' realm'} web agents...`,
      state,
    });
    for (const agent of agents) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting ${getCurrentRealmName(state) + ' realm'} web agent ${agent._id}`,
        state,
      });
      exportData.agent[agent._id] = agent;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${agents.length} ${getCurrentRealmName(state) + ' realm'} web agents.`,
      state,
    });
    debugMessage({ message: `AgentOps.exportWebAgents: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting ${getCurrentRealmName(state) + ' realm'} web agents`,
      status: 'fail',
      state,
    });
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} web agents`,
      error
    );
  }
}

/**
 * Export web agent. The response can be saved to file as is.
 * @param agentId agent id/name
 * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
 */
export async function exportWebAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}): Promise<AgentExportInterface> {
  try {
    debugMessage({ message: `AgentOps.exportWebAgent: start`, state });
    const exportData = createAgentExportTemplate({ state });
    const agentObject = await readWebAgent({ agentId, state });
    exportData.agent[agentId] = agentObject;
    debugMessage({ message: `AgentOps.exportWebAgent: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} web agent ${agentId}`,
      error
    );
  }
}

/**
 * Import web agents. The import data is usually read from an agent export file.
 * @param {AgentExportInterface} importData agent import data.
 */
export async function importWebAgents({
  importData,
  state,
}: {
  importData: AgentExportInterface;
  state: State;
}): Promise<void> {
  const errors: Error[] = [];
  try {
    debugMessage({ message: `AgentOps.importWebAgents: start`, state });
    for (const agentId of Object.keys(importData.agent)) {
      let agentType: AgentType;
      try {
        agentType = importData.agent[agentId]._type._id as AgentType;
        if (agentType !== 'WebAgent')
          throw new FrodoError(
            `Wrong agent type! Expected 'WebAgent' but got '${agentType}'.`
          );
        await _putAgentByTypeAndId({
          agentType,
          agentId,
          agentData: importData.agent[agentId],
          globalConfig: false,
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error importing ${getCurrentRealmName(state) + ' realm'} agent ${agentId} of type ${agentType}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing ${getCurrentRealmName(state) + ' realm'} web agents`,
        errors
      );
    }
    debugMessage({ message: `AgentOps.importWebAgents: end`, state });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} web agents`,
      error
    );
  }
}

/**
 * Import java agent. The import data is usually read from an agent export file.
 * @param {string} agentId agent id/name
 * @param {AgentExportInterface} importData agent import data.
 * @returns {Promise<AgentSkeleton>} Promise resolving to an agent object.
 */
export async function importWebAgent({
  agentId,
  importData,
  state,
}: {
  agentId: string;
  importData: AgentExportInterface;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({ message: `AgentOps.importWebAgent: start`, state });
    const agentType = importData.agent[agentId]?._type._id as AgentType;
    if (agentType !== 'WebAgent')
      throw new FrodoError(
        `Wrong agent type! Expected 'WebAgent' but got '${agentType}'.`
      );
    const result = await _putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agent[agentId],
      globalConfig: false,
      state,
    });
    debugMessage({ message: `AgentOps.importWebAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} web agent ${agentId}`,
      error
    );
  }
}

/**
 * Get AI agents
 * @param {object} params structured and named parameters
 * @param {boolean} [params.includeAgentIdentity=true] whether to also read agent identity and privileges and merge into result (only for cloud/ForgeOps)
 * @param {State} params.state state object
 * @returns {Promise} a promise that resolves to an array of AIAgent objects
 */
export async function readAIAgents({
  includeAgentIdentity = true,
  state,
}: {
  includeAgentIdentity?: boolean;
  state: State;
}): Promise<AgentSkeleton[]> {
  try {
    debugMessage({ message: `AgentOps.readAIAgents: start`, state });
    const { result } = await _getAgentsByType({
      agentType: 'AIAgent',
      state,
    });
    if (includeAgentIdentity) {
      switch (state.getDeploymentType()) {
        case Constants.CLOUD_DEPLOYMENT_TYPE_KEY:
        case Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY: {
          // also read agent identity and privileges from IDM and merge into result
          const aiAgentIdentitySchema = await readManagedObjectSchema({
            type: `${getCurrentRealmName(state)}_aiagent`,
            state,
          });
          const aiAgentIdentities = await readManagedObjects({
            type: `${getCurrentRealmName(state)}_aiagent`,
            fields: aiAgentIdentitySchema
              ? Object.keys(aiAgentIdentitySchema.properties)
              : ['*'],
            state,
          });
          const aiAgentPrivilegeSchema = await readManagedObjectSchema({
            type: `${getCurrentRealmName(state)}_aiagentprivilege`,
            state,
          });
          const aiAgentPrivileges = await queryManagedObjects({
            type: `${getCurrentRealmName(state)}_aiagentprivilege`,
            fields: aiAgentPrivilegeSchema
              ? Object.keys(aiAgentPrivilegeSchema.properties)
              : ['*'],
            state,
          });
          const aiAgentPrivilegesByAgentIdentityUid: Record<
            string,
            IdObjectSkeletonInterface[]
          > = {};
          for (const privilege of aiAgentPrivileges) {
            const agentId = privilege['agentID'] as string;
            if (agentId) {
              if (!aiAgentPrivilegesByAgentIdentityUid[agentId]) {
                aiAgentPrivilegesByAgentIdentityUid[agentId] =
                  [] as IdObjectSkeletonInterface[];
              }
              aiAgentPrivilegesByAgentIdentityUid[agentId].push(
                privilege as IdObjectSkeletonInterface
              );
            }
          }
          for (const aiAgentIdentity of aiAgentIdentities) {
            const privileges =
              aiAgentPrivilegesByAgentIdentityUid[aiAgentIdentity._id] || [];
            aiAgentIdentity._privileges = privileges;
          }
          for (const agent of result) {
            if (agent['aiAgentIdentityUid']) {
              const aiAgentIdentity = aiAgentIdentities.find(
                (i) => i._id === agent['aiAgentIdentityUid']
              );
              if (aiAgentIdentity) {
                agent._aiAgentIdentity = aiAgentIdentity;
              }
            }
          }
          break;
        }
        case Constants.CLASSIC_DEPLOYMENT_TYPE_KEY:
        default:
          break;
      }
    }
    debugMessage({ message: `AgentOps.readAIAgents: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} AI agents`,
      error
    );
  }
}

/**
 * Get AI agent
 * @param {object} params structured and named parameters
 * @param {string} params.agentId AI agent id
 * @param {boolean} [params.includeAgentIdentity=true] whether to also read agent identity and privileges and merge into result (only for cloud/ForgeOps)
 * @param {State} params.state state object
 * @returns {Promise} a promise that resolves to an object containing an AIAgent object
 */
export async function readAIAgent({
  agentId,
  includeAgentIdentity = true,
  state,
}: {
  agentId: string;
  includeAgentIdentity?: boolean;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({ message: `AgentOps.readAIAgent: start`, state });
    const result = await readAgentByTypeAndId({
      agentType: 'AIAgent',
      agentId,
      state,
    });
    if (includeAgentIdentity) {
      switch (state.getDeploymentType()) {
        case Constants.CLOUD_DEPLOYMENT_TYPE_KEY:
        case Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY: {
          // also read agent identity and privileges from IDM and merge into result
          if (
            result['aiAgentIdentityUid'] &&
            result['aiAgentIdentityUid']['value']
          ) {
            const aiAgentIdentitySchema = await readManagedObjectSchema({
              type: `${getCurrentRealmName(state)}_aiagent`,
              state,
            });
            const aiAgentPrivilegeSchema = await readManagedObjectSchema({
              type: `${getCurrentRealmName(state)}_aiagentprivilege`,
              state,
            });
            const aiAgentIdentity = await readManagedObject({
              type: `${getCurrentRealmName(state)}_aiagent`,
              id: result['aiAgentIdentityUid']['value'] as string,
              fields: aiAgentIdentitySchema
                ? Object.keys(aiAgentIdentitySchema.properties)
                : ['*'],
              state,
            });
            const aiAgentPrivileges = await queryRelatedManagedObjects({
              type: `${getCurrentRealmName(state)}_aiagent`,
              id: `${result['aiAgentIdentityUid']['value']}`,
              relationship: 'privileges',
              fields: aiAgentPrivilegeSchema
                ? Object.keys(aiAgentPrivilegeSchema.properties)
                : ['*'],
              state,
            });
            aiAgentIdentity._privileges = aiAgentPrivileges;
            result._aiAgentIdentity = aiAgentIdentity;
          }
          break;
        }
        case Constants.CLASSIC_DEPLOYMENT_TYPE_KEY:
        default:
          break;
      }
    }
    debugMessage({ message: `AgentOps.readAIAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} AI agent ${agentId}`,
      error
    );
  }
}

/**
 * Create AI agent
 * @param {object} params structured and named parameters
 * @param {string} params.agentId AI agent id
 * @param {Object} params.agentData AI agent object
 * @param {boolean} [params.includeAgentIdentity=true] whether to also read agent identity and privileges and merge into result (only for cloud/ForgeOps)
 * @param {State} params.state state object
 * @returns {Promise} a promise that resolves to an object containing an AI agent object
 */
export async function createAIAgent({
  agentId,
  agentData,
  includeAgentIdentity = true,
  state,
}: {
  agentId: string;
  agentData: AgentSkeleton;
  includeAgentIdentity?: boolean;
  state: State;
}): Promise<AgentSkeleton> {
  debugMessage({ message: `AgentOps.createAIAgent: start`, state });
  try {
    await readAIAgent({ agentId, state });
    throw new FrodoError(`Agent ${agentId} already exists!`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    try {
      // clone ai agent identity data and remove it from agent data before creating the AI agent
      let aiAgentIdentity: IdObjectSkeletonInterface;
      if (includeAgentIdentity) {
        aiAgentIdentity = cloneDeep(agentData._aiAgentIdentity);
      }
      delete agentData._aiAgentIdentity;

      // create the ai agent first before creating the agent identity and privileges
      const result = await _putAgentByTypeAndId({
        agentType: 'AIAgent',
        agentId,
        agentData,
        globalConfig: false,
        state,
      });

      // if includeAgentIdentity is true, create agent identity and privileges for the AI agent
      if (includeAgentIdentity) {
        const errors: FrodoError[] = [];
        // clone privileges array and remove it from the ai agent identity before creating the ai agent identity
        const privileges = cloneDeep(
          aiAgentIdentity._privileges
        ) as IdObjectSkeletonInterface[];
        delete aiAgentIdentity._privileges;
        try {
          // create skeleton managed object for the ai agent identity
          debugMessage({
            message: `AgentOps.createAIAgent: Creating AI agent skeleton identity ${aiAgentIdentity._id}`,
            state,
          });
          // create skeleton managed object for the ai agent identity
          const identitySkeleton: IdObjectSkeletonInterface =
            cloneDeep(aiAgentIdentity);
          const identitySkeletonSchema = await readManagedObjectSchema({
            type: `${getCurrentRealmName(state)}_aiagent`,
            options: {
              excludeVirtual: true,
              excludeRelationships: true,
            },
            state,
          });
          for (const prop of Object.keys(identitySkeleton)) {
            if (!identitySkeletonSchema.properties[prop]) {
              delete identitySkeleton[prop];
            }
          }
          await createManagedObject({
            type: `${getCurrentRealmName(state)}_aiagent`,
            id: identitySkeleton._id,
            moData: identitySkeleton,
            state,
          });
          debugMessage({
            message: `AgentOps.createAIAgent: Finished creating AI agent skeleton identity ${identitySkeleton._id}`,
            state,
          });

          // create skeleton managed objects for privileges
          debugMessage({
            message: `AgentOps.createAIAgent: Creating privileges for AI agent identity ${aiAgentIdentity._id}`,
            state,
          });
          for (const privilege of privileges) {
            try {
              {
                // create skeleton managed object for each privilege and persist it before creating the AI agent identity itself,
                // otherwise the privileges won't be properly linked to the identity
                const privilegeSkeleton: IdObjectSkeletonInterface =
                  cloneDeep(privilege);
                const privilegeSkeletonSchema = await readManagedObjectSchema({
                  type: `${getCurrentRealmName(state)}_aiagentprivilege`,
                  options: {
                    excludeVirtual: true,
                    excludeRelationships: true,
                  },
                  state,
                });
                for (const prop of Object.keys(privilegeSkeleton)) {
                  if (!privilegeSkeletonSchema.properties[prop]) {
                    delete privilegeSkeleton[prop];
                  }
                }
                await createManagedObject({
                  type: `${getCurrentRealmName(state)}_aiagentprivilege`,
                  id: privilegeSkeleton._id,
                  moData: privilegeSkeleton,
                  state,
                });
              }

              // Link privilege to agent identity and create reverse link from agent identity to privilege
              try {
                // Link privilege to agent identity
                await updateManagedObjectProperties({
                  type: `${getCurrentRealmName(state)}_aiagentprivilege`,
                  id: privilege._id,
                  operations: [
                    {
                      operation: 'replace',
                      field: '/agent',
                      value: {
                        _ref: `managed/${getCurrentRealmName(state)}_aiagent/${identitySkeleton._id}`,
                        _refResourceCollection: `managed/${getCurrentRealmName(state)}_aiagent`,
                        _refResourceId: identitySkeleton._id,
                      },
                    },
                  ],
                  state,
                });
                // create reverse link from agent identity to privilege
                await updateManagedObjectProperties({
                  type: `${getCurrentRealmName(state)}_aiagent`,
                  id: identitySkeleton._id,
                  operations: [
                    {
                      operation: 'add',
                      field: '/privileges',
                      value: {
                        _ref: `managed/${getCurrentRealmName(state)}_aiagentprivilege/${privilege._id}`,
                        _refResourceCollection: `managed/${getCurrentRealmName(state)}_aiagentprivilege`,
                        _refResourceId: privilege._id,
                      },
                    },
                  ],
                  state,
                });
              } catch (error) {
                errors.push(
                  new FrodoError(
                    `Error linking privilege ${privilege._id} to AI agent identity ${aiAgentIdentity._id}`,
                    error
                  )
                );
              }

              // Link privilege to application and create reverse link from application to privilege
              if (
                privilege['resource'] &&
                privilege['resource']['_refResourceId']
              ) {
                try {
                  // Link privilege to application
                  await updateManagedObjectProperties({
                    type: `${getCurrentRealmName(state)}_aiagentprivilege`,
                    id: privilege._id,
                    operations: [
                      {
                        operation: 'replace',
                        field: '/resource',
                        value: {
                          _ref: `managed/${getCurrentRealmName(state)}_application/${privilege['resource']['_refResourceId']}`,
                          _refResourceCollection: `managed/${getCurrentRealmName(state)}_application`,
                          _refResourceId:
                            privilege['resource']['_refResourceId'],
                        },
                      },
                    ],
                    state,
                  });
                  // create reverse link from application to privilege
                  await updateManagedObjectProperties({
                    type: `${getCurrentRealmName(state)}_application`,
                    id: privilege['resource']['_refResourceId'] as string,
                    operations: [
                      {
                        operation: 'add',
                        field: '/aiagentprivileges',
                        value: {
                          _ref: `managed/${getCurrentRealmName(state)}_aiagentprivilege/${privilege._id}`,
                          _refResourceCollection: `managed/${getCurrentRealmName(state)}_aiagentprivilege`,
                          _refResourceId: privilege._id,
                        },
                      },
                    ],
                    state,
                  });
                } catch (error) {
                  errors.push(
                    new FrodoError(
                      `Error linking privilege ${privilege._id} to AI agent identity ${aiAgentIdentity._id}`,
                      error
                    )
                  );
                }
              }

              // Link privileges to subject groups and create reverse link from subject groups to privileges
              if (
                privilege['subjectGroups'] &&
                Array.isArray(privilege['subjectGroups']) &&
                privilege['subjectGroups'].length > 0
              ) {
                try {
                  // Link privilege to subject groups
                  const subjectGroups = [];
                  for (const group of privilege['subjectGroups']) {
                    subjectGroups.push({
                      _ref: `managed/${getCurrentRealmName(state)}_group/${group['_refResourceId']}`,
                      _refResourceCollection: `managed/${getCurrentRealmName(state)}_group`,
                      _refResourceId: group['_refResourceId'],
                    });
                  }
                  await updateManagedObjectProperties({
                    type: `${getCurrentRealmName(state)}_aiagentprivilege`,
                    id: privilege._id,
                    operations: [
                      {
                        operation: 'replace',
                        field: '/subjectGroups',
                        value: subjectGroups,
                      },
                    ],
                    state,
                  });
                  // create reverse link from subject groups to privilege
                  for (const group of privilege['subjectGroups']) {
                    try {
                      await updateManagedObjectProperties({
                        type: `${getCurrentRealmName(state)}_group`,
                        id: group['_refResourceId'] as string,
                        operations: [
                          {
                            operation: 'add',
                            field: '/aiagentprivileges',
                            value: {
                              _ref: `managed/${getCurrentRealmName(state)}_aiagentprivilege/${privilege._id}`,
                              _refResourceCollection: `managed/${getCurrentRealmName(state)}_aiagentprivilege`,
                              _refResourceId: privilege._id,
                            },
                          },
                        ],
                        state,
                      });
                    } catch (error) {
                      errors.push(
                        new FrodoError(
                          `Error linking privilege ${privilege._id} to subject group ${group['_refResourceId']} for AI agent identity ${aiAgentIdentity._id}`,
                          error
                        )
                      );
                    }
                  }
                } catch (error) {
                  errors.push(
                    new FrodoError(
                      `Error linking privilege ${privilege._id} to subject groups for AI agent identity ${aiAgentIdentity._id}`,
                      error
                    )
                  );
                }
              }

              // Link privileges to subjects (users)
              if (
                privilege['subjects'] &&
                Array.isArray(privilege['subjects']) &&
                privilege['subjects'].length > 0
              ) {
                try {
                  // Link privilege to subjects
                  const subjects = [];
                  for (const subject of privilege['subjects']) {
                    subjects.push({
                      _ref: `managed/${getCurrentRealmName(state)}_user/${subject['_refResourceId']}`,
                      _refResourceCollection: `managed/${getCurrentRealmName(state)}_user`,
                      _refResourceId: subject['_refResourceId'],
                    });
                  }
                  await updateManagedObjectProperties({
                    type: `${getCurrentRealmName(state)}_aiagentprivilege`,
                    id: privilege._id,
                    operations: [
                      {
                        operation: 'replace',
                        field: '/subjects',
                        value: subjects,
                      },
                    ],
                    state,
                  });
                } catch (error) {
                  errors.push(
                    new FrodoError(
                      `Error linking privilege ${privilege._id} to user subjects for AI agent identity ${aiAgentIdentity._id}`,
                      error
                    )
                  );
                }
              }
            } catch (error) {
              errors.push(
                new FrodoError(
                  `Error creating privilege ${privilege._id} for AI agent identity ${aiAgentIdentity._id}`,
                  error
                )
              );
            }
          }
          debugMessage({
            message: `AgentOps.createAIAgent: Finished creating privileges for AI agent identity ${aiAgentIdentity._id}`,
            state,
          });
        } catch (error) {
          errors.push(
            new FrodoError(
              `Error creating AI agent identity ${aiAgentIdentity._id}`,
              error
            )
          );
        }

        // Link ai agent to owners (users)
        if (
          aiAgentIdentity['owners'] &&
          Array.isArray(aiAgentIdentity['owners']) &&
          aiAgentIdentity['owners'].length > 0
        ) {
          try {
            const owners = [];
            for (const owner of aiAgentIdentity['owners']) {
              owners.push({
                _ref: `managed/${getCurrentRealmName(state)}_user/${owner['_refResourceId']}`,
                _refResourceCollection: `managed/${getCurrentRealmName(state)}_user`,
                _refResourceId: owner['_refResourceId'],
              });
            }
            await updateManagedObjectProperties({
              type: `${getCurrentRealmName(state)}_aiagent`,
              id: aiAgentIdentity._id,
              operations: [
                {
                  operation: 'replace',
                  field: '/owners',
                  value: owners,
                },
              ],
              state,
            });
          } catch (error) {
            errors.push(
              new FrodoError(
                `Error linking AI agent identity ${aiAgentIdentity._id} to owners for AI agent ${agentId}`,
                error
              )
            );
          }
        }

        if (errors.length > 0) {
          throw new FrodoError(
            'Error creating AI agent identity and privileges',
            errors
          );
        }
      }
      debugMessage({
        message: `AgentOps.createAIAgent: end`,
        state,
      });
      return result;
    } catch (error) {
      throw new FrodoError(
        `Error creating ${getCurrentRealmName(state) + ' realm'} AI agent ${agentId}`,
        error
      );
    }
  }
}

/**
 * Update or create AI agent
 * @param {object} params structured and named parameters
 * @param {string} params.agentId AI agent id
 * @param {Object} params.agentData AIAgent object
 * @param {boolean} [params.includeAgentIdentity=true] whether to also read agent identity and privileges and merge into result (only for cloud/ForgeOps)
 * @param {State} params.state state object
 * @returns {Promise} a promise that resolves to an object containing an AIAgent object
 */
export async function updateAIAgent({
  agentId,
  agentData,
  includeAgentIdentity = true,
  state,
}: {
  agentId: string;
  agentData: AgentSkeleton;
  includeAgentIdentity?: boolean;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({
      message: `AgentOps.updateAIAgent: start [includeAgentIdentity=${includeAgentIdentity}]`,
      state,
    });
    const result = await _putAgentByTypeAndId({
      agentType: 'AIAgent',
      agentId,
      agentData,
      globalConfig: false,
      state,
    });
    debugMessage({ message: `AgentOps.updateAIAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error updating ${getCurrentRealmName(state) + ' realm'} AI agent ${agentId}`,
      error
    );
  }
}

/**
 * Delete all AI agents
 * @param {object} params structured and named parameters
 * @param {State} params.state state object
 */
export async function deleteAIAgents({ state }: { state: State }) {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `AgentOps.deleteAIAgents: start`,
      state,
    });
    const agents = await readAIAgents({ includeAgentIdentity: false, state });
    for (const agent of agents) {
      try {
        debugMessage({
          message: `AgentOps.deleteAIAgents: '${agent['_id']}'`,
          state,
        });
        await deleteAIAgent({ agentId: agent['_id'], state });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error deleting ${getCurrentRealmName(state) + ' realm'} AI agent ${agent['_id']}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error deleting ${getCurrentRealmName(state) + ' realm'} AI agents`,
        errors
      );
    }
    debugMessage({ message: `AgentOps.deleteAIAgents: end`, state });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} AI agents`,
      error
    );
  }
}

/**
 * Delete AI agent and agent identity and privileges (only for cloud/ForgeOps)
 * @param {object} params structured and named parameters
 * @param {string} params.agentId agent id/name
 * @param {State} params.state state object
 */
export async function deleteAIAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  try {
    debugMessage({
      message: `AgentOps.deleteAIAgent: start`,
      state,
    });
    const agents = await _findAgentByTypeAndId({
      agentType: 'AIAgent',
      agentId,
      state,
    });
    if (agents.length == 0) {
      throw new FrodoError(
        `${getCurrentRealmName(state) + ' realm'} AI agent '${agentId}' not found!`
      );
    }
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteAIAgent: '${agent['_id']}'`,
        state,
      });
      await _deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'] as AgentType,
        agentId: agent['_id'],
        state,
      });
    }
    debugMessage({ message: `AgentOps.deleteAIAgent: end`, state });
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} AI agent ${agentId}`,
      error
    );
  }
}

/**
 * Export all AI agents. The response can be saved to file as is.
 * @param {object} params structured and named parameters
 * @param {boolean} [params.includeAgentIdentity=true] whether to also read agent identity and privileges and merge into result (only for cloud/ForgeOps)
 * @param {State} params.state state object
 * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
 */
export async function exportAIAgents({
  includeAgentIdentity = true,
  state,
}: {
  includeAgentIdentity?: boolean;
  state: State;
}): Promise<AgentExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `AgentOps.exportAIAgents: start [includeAgentIdentity=${includeAgentIdentity}]`,
      state,
    });
    const exportData = createAgentExportTemplate({ state });
    const agents = await readAIAgents({ state });
    indicatorId = createProgressIndicator({
      total: agents.length,
      message: `Exporting ${getCurrentRealmName(state) + ' realm'} AI agents...`,
      state,
    });
    for (const agent of agents) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting ${getCurrentRealmName(state) + ' realm'} AI agent ${agent._id}`,
        state,
      });
      exportData.agent[agent._id] = agent;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${agents.length} ${getCurrentRealmName(state) + ' realm'} AI agents.`,
      state,
    });
    debugMessage({ message: `AgentOps.exportAIAgents: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting ${getCurrentRealmName(state) + ' realm'} AI agents`,
      status: 'fail',
      state,
    });
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} AI agents`,
      error
    );
  }
}

/**
 * Export AI agent. The response can be saved to file as is.
 * @param {object} params structured and named parameters
 * @param {string} params.agentId agent id/name
 * @param {boolean} [params.includeAgentIdentity=true] whether to also read agent identity and privileges and merge into result (only for cloud/ForgeOps)
 * @param {State} params.state state object
 * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
 */
export async function exportAIAgent({
  agentId,
  includeAgentIdentity = true,
  state,
}: {
  agentId: string;
  includeAgentIdentity?: boolean;
  state: State;
}): Promise<AgentExportInterface> {
  try {
    debugMessage({
      message: `AgentOps.exportAIAgent: start [includeAgentIdentity=${includeAgentIdentity}]`,
      state,
    });
    const exportData = createAgentExportTemplate({ state });
    const agentObject = await readAIAgent({ agentId, state });
    exportData.agent[agentId] = agentObject;
    debugMessage({ message: `AgentOps.exportAIAgent: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} AI agent ${agentId}`,
      error
    );
  }
}

/**
 * Import AI agents. The import data is usually read from an agent export file.
 * @param {object} params structured and named parameters
 * @param {AgentExportInterface} params.importData agent import data.
 * @param {boolean} [params.includeAgentIdentity=true] whether to also import agent identity and privileges (only for cloud/ForgeOps)
 * @param {State} params.state state object
 */
export async function importAIAgents({
  importData,
  includeAgentIdentity = true,
  state,
}: {
  importData: AgentExportInterface;
  includeAgentIdentity?: boolean;
  state: State;
}): Promise<void> {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `AgentOps.importAIAgents: start [includeAgentIdentity=${includeAgentIdentity}]`,
      state,
    });
    for (const agentId of Object.keys(importData.agent)) {
      let agentType: AgentType;
      try {
        agentType = importData.agent[agentId]._type._id as AgentType;
        if (agentType !== 'AIAgent')
          throw new FrodoError(
            `Wrong agent type! Expected 'AIAgent' but got '${agentType}'.`
          );
        await _putAgentByTypeAndId({
          agentType,
          agentId,
          agentData: importData.agent[agentId],
          globalConfig: false,
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error importing ${getCurrentRealmName(state) + ' realm'} agent ${agentId} of type ${agentType}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing ${getCurrentRealmName(state) + ' realm'} AI agents`,
        errors
      );
    }
    debugMessage({ message: `AgentOps.importAIAgents: end`, state });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} AI agents`,
      error
    );
  }
}

/**
 * Import AI agent. The import data is usually read from an agent export file.
 * @param {object} params structured and named parameters
 * @param {string} params.agentId agent id/name
 * @param {AgentExportInterface} params.importData agent import data.
 * @param {boolean} [params.includeAgentIdentity=true] whether to also import agent identity and privileges (only for cloud/ForgeOps)
 * @param {State} params.state state object
 * @returns {Promise<AgentSkeleton>} Promise resolving to an agent object.
 */
export async function importAIAgent({
  agentId,
  importData,
  includeAgentIdentity = true,
  state,
}: {
  agentId: string;
  importData: AgentExportInterface;
  includeAgentIdentity?: boolean;
  state: State;
}): Promise<AgentSkeleton> {
  try {
    debugMessage({
      message: `AgentOps.importAIAgent: start [includeAgentIdentity=${includeAgentIdentity}]`,
      state,
    });
    const agentType = importData.agent[agentId]?._type._id as AgentType;
    if (agentType !== 'AIAgent') {
      throw new FrodoError(
        `Wrong agent type! Expected 'AIAgent' but got '${agentType}'.`
      );
    }
    const result = await _putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agent[agentId],
      globalConfig: false,
      state,
    });
    debugMessage({ message: `AgentOps.importAIAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} AI agent ${agentId}`,
      error
    );
  }
}

/**
 * Read agent group by id
 * @param {string} groupId Agent group id
 * @returns {Promise<AgentGroupSkeleton>} a promise that resolves to a agent group object
 */
export async function readAgentGroup({
  groupId,
  state,
}: {
  groupId: string;
  state: State;
}): Promise<AgentGroupSkeleton> {
  const groups = await readAgentGroups({ state });
  for (const group of groups) {
    if (group._id === groupId) {
      return group;
    }
  }
  throw new FrodoError(
    `${getCurrentRealmName(state) + ' realm'} agent group with id '${groupId}' does not exist.`
  );
}

/**
 * Read all agent groups.
 * @returns {Promise<AgentGroupSkeleton[]>} a promise that resolves to an array of agent group objects
 */
export async function readAgentGroups({
  state,
}: {
  state: State;
}): Promise<AgentGroupSkeleton[]> {
  try {
    const { result } = await _getAgentGroups({ state });
    return result;
  } catch (error) {
    if (
      error.response?.status === 403 &&
      error.response?.data?.message ===
        'This operation is not available in PingOne Advanced Identity Cloud.'
    ) {
      return [];
    } else {
      throw new FrodoError(
        `Error reading ${getCurrentRealmName(state) + ' realm'} agent groups`,
        error
      );
    }
  }
}

/**
 * Export a single agent group by id. The response can be saved to file as is.
 * @param {string} groupId Agent group id
 * @returns {Promise<AgentGroupExportInterface>} Promise resolving to a AgentGroupExportInterface object.
 */
export async function exportAgentGroup({
  groupId,
  state,
}: {
  groupId: string;
  state: State;
}): Promise<AgentGroupExportInterface> {
  try {
    const group = await readAgentGroup({
      groupId,
      state,
    });
    const exportData = createAgentGroupExportTemplate({ state });
    exportData.agentGroup[groupId] = group;
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} agent group ${groupId}`,
      error
    );
  }
}

/**
 * Export all agent groups. The response can be saved to file as is.
 * @returns {Promise<AgentGroupExportInterface>} Promise resolving to a AgentGroupExportInterface object.
 */
export async function exportAgentGroups({
  state,
}: {
  state: State;
}): Promise<AgentGroupExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `AgentOps.exportAgentGroups: start`,
      state,
    });
    const exportData = createAgentGroupExportTemplate({ state });
    const groups = await readAgentGroups({ state });
    indicatorId = createProgressIndicator({
      total: groups.length,
      message: `Exporting ${getCurrentRealmName(state) + ' realm'} agent groups...`,
      state,
    });
    for (const group of groups) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting ${getCurrentRealmName(state) + ' realm'} agent group ${group._id}`,
        state,
      });
      exportData.agentGroup[group._id] = group;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${groups.length} ${getCurrentRealmName(state) + ' realm'} agent groups.`,
      state,
    });
    debugMessage({ message: `AgentOps.exportAgentGroups: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting ${getCurrentRealmName(state) + ' realm'} agent groups.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} agent groups`,
      error
    );
  }
}

/**
 * Import agent groups. The import data is usually read from an agent group export file.
 * @param {AgentGroupExportInterface} importData agent group import data.
 * @returns {Promise<AgentGroupSkeleton[]>} The agent groups that were imported.
 */
export async function importAgentGroups({
  importData,
  state,
}: {
  importData: AgentGroupExportInterface;
  state: State;
}): Promise<AgentGroupSkeleton[]> {
  const response: AgentGroupSkeleton[] = [];
  const errors: Error[] = [];
  try {
    debugMessage({ message: `AgentOps.importAgentGroups: start`, state });
    for (const agentGroupId of Object.keys(importData.agentGroup)) {
      let agentType: AgentType;
      try {
        agentType = importData.agentGroup[agentGroupId]._type._id as AgentType;
        debugMessage({
          message: `AgentOps.importAgentGroups: ${agentGroupId} [${agentType}]`,
          state,
        });
        if (
          agentType === 'SoapSTSAgent' &&
          state.getDeploymentType() !== Constants.CLASSIC_DEPLOYMENT_TYPE_KEY
        ) {
          throw new FrodoError(
            `Can't import ${getCurrentRealmName(state) + ' realm'} Soap STS agent groups for '${state.getDeploymentType()}' deployment type.`
          );
        }
        response.push(
          await _putAgentGroupByTypeAndId({
            agentType,
            agentGroupId,
            agentGroupData: importData.agentGroup[agentGroupId],
            state,
          })
        );
      } catch (error) {
        if (error.httpStatus !== 501 && error.response?.status !== 501) {
          errors.push(
            new FrodoError(
              `Error importing ${getCurrentRealmName(state) + ' realm'} agent group ${agentGroupId} of type ${agentType}`,
              error
            )
          );
        }
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing ${getCurrentRealmName(state) + ' realm'} agent groups`,
        errors
      );
    }
    debugMessage({ message: `AgentOps.importAgentGroups: end`, state });
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} agent groups`,
      error
    );
  }
}

/**
 * Import agent group. The import data is usually read from an agent group export file.
 * @param {string} agentGroupId agent group id/name
 * @param {AgentGroupExportInterface} importData agent group import data.
 * @returns {Promise<AgentGroupSkeleton>} Promise resolving to an agent object.
 */
export async function importAgentGroup({
  agentGroupId,
  importData,
  state,
}: {
  agentGroupId: string;
  importData: AgentGroupExportInterface;
  state: State;
}): Promise<AgentGroupSkeleton> {
  try {
    debugMessage({ message: `AgentOps.importAgentGroup: start`, state });
    const agentType = importData.agentGroup[agentGroupId]?._type
      ._id as AgentType;
    if (
      agentType === 'SoapSTSAgent' &&
      state.getDeploymentType() !== Constants.CLASSIC_DEPLOYMENT_TYPE_KEY
    ) {
      throw new FrodoError(
        `Can't import Soap STS agent groups for '${state.getDeploymentType()}' deployment type.`
      );
    }
    const result = await _putAgentGroupByTypeAndId({
      agentType,
      agentGroupId,
      agentGroupData: importData.agentGroup[agentGroupId],
      state,
    });
    debugMessage({ message: `AgentOps.importAgentGroup: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} agent group ${agentGroupId}`,
      error
    );
  }
}

/**
 * Create an empty agent export template
 * @returns {AgentExportInterface} an empty agent export template
 */
export function createAgentExportTemplate({
  state,
}: {
  state: State;
}): AgentExportInterface {
  return {
    meta: getMetadata({ state }),
    agent: {},
  } as AgentExportInterface;
}

/**
 * Create an empty agent export template
 * @returns {AgentGroupExportInterface} an empty agent export template
 */
export function createAgentGroupExportTemplate({
  state,
}: {
  state: State;
}): AgentGroupExportInterface {
  return {
    meta: getMetadata({ state }),
    agentGroup: {},
  } as AgentGroupExportInterface;
}
