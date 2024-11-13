import {
  AgentGroupSkeleton,
  type AgentSkeleton,
  type AgentType,
  deleteAgentByTypeAndId,
  findAgentById,
  findAgentByTypeAndId,
  getAgentByTypeAndId as _getAgentByTypeAndId,
  getAgentGroups,
  getAgents,
  getAgentsByType,
  putAgentByTypeAndId,
  putAgentGroupByTypeAndId,
} from '../api/AgentApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { FrodoError } from './FrodoError';
import { type ExportMetaData } from './OpsTypes';

export type Agent = {
  /**
   * Create an empty agent export template
   * @returns {AgentExportInterface} an empty agent export template
   */
  createAgentExportTemplate(): AgentExportInterface;
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
   * Create an empty agent group export template
   * @returns {AgentGroupExportInterface} an empty agent export template
   */
  createAgentGroupExportTemplate(): AgentGroupExportInterface;
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
   * Put java agent
   * @param {string} agentId java agent id
   * @param {AgentSkeleton} agentData java agent object
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an java agent object
   */
  createJavaAgent(
    agentId: string,
    agentData: AgentSkeleton
  ): Promise<AgentSkeleton>;
  /**
   * Put java agent
   * @param {string} agentId java agent id
   * @param {AgentSkeleton} agentData java agent object
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an java agent object
   */
  updateJavaAgent(
    agentId: string,
    agentData: AgentSkeleton
  ): Promise<AgentSkeleton>;
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
   * Export all agents. The response can be saved to file as is.
   * @param {boolean} globalConfig true if global agent is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportAgents(globalConfig: boolean): Promise<AgentExportInterface>;
  /**
   * Export all identity gateway agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportIdentityGatewayAgents(): Promise<AgentExportInterface>;
  /**
   * Export all java agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportJavaAgents(): Promise<AgentExportInterface>;
  /**
   * Export all web agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportWebAgents(): Promise<AgentExportInterface>;
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
   * Export identity gateway agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportIdentityGatewayAgent(agentId: string): Promise<AgentExportInterface>;
  /**
   * Export java agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportJavaAgent(agentId: string): Promise<AgentExportInterface>;
  /**
   * Export web agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportWebAgent(agentId: string): Promise<AgentExportInterface>;
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
   * Import agents groups. The import data is usually read from an agent group export file.
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise<AgentGroupSkeleton[]>} The agent groups that were imported.
   */
  importAgentGroups(
    importData: AgentGroupExportInterface
  ): Promise<AgentGroupSkeleton[]>;
  /**
   * Import identity gateway agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   */
  importIdentityGatewayAgents(importData: AgentExportInterface): Promise<void>;
  /**
   * Import java agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   */
  importJavaAgents(importData: AgentExportInterface): Promise<void>;
  /**
   * Import web agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   */
  importWebAgents(importData: AgentExportInterface): Promise<void>;
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
  /**
   * Import java agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise<AgentSkeleton>} Promise resolving to an agent object.
   */
  importWebAgent(
    agentId: string,
    importData: AgentExportInterface
  ): Promise<AgentSkeleton>;
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
   * Delete all identity gateway agents
   */
  deleteIdentityGatewayAgents(): Promise<void>;
  /**
   * Delete identity gateway agent
   * @param agentId agent id/name
   */
  deleteIdentityGatewayAgent(agentId: string): Promise<void>;
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
   * Delete all web agents
   */
  deleteWebAgents(): Promise<void>;
  /**
   * Delete web agent
   * @param agentId agent id/name
   */
  deleteWebAgent(agentId: string): Promise<void>;

  // Deprecated

  /**
   * Get all agents.
   * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array of agent objects
   * @deprecated since v2.0.0 use {@link Agent.readAgents | readAgents} instead
   * ```javascript
   * readAgents(): Promise<AgentSkeleton[]>
   * ```
   * @group Deprecated
   */
  getAgents(): Promise<AgentSkeleton[]>;
  /**
   * Get agent
   * @param {string} agentId agent id/name
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an agent object
   * @deprecated since v2.0.0 use {@link Agent.readAgent | readAgent} instead
   * ```javascript
   * readAgent(agentId: string): Promise<AgentSkeleton>
   * ```
   * @group Deprecated
   */
  getAgent(agentId: string): Promise<AgentSkeleton>;
  /**
   * Get agent by type and id
   * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
   * @param {string} agentId agent id/name
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an agent object
   * @deprecated since v2.0.0 use {@link Agent.readAgentByTypeAndId | readAgentByTypeAndId} instead
   * ```javascript
   * readAgentByTypeAndId(agentType: AgentType, agentId: string): Promise<AgentSkeleton>
   * ```
   * @group Deprecated
   */
  getAgentByTypeAndId(
    agentType: AgentType,
    agentId: string
  ): Promise<AgentSkeleton>;
  /**
   * Get identity gateway agents
   * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array of IdentityGatewayAgent objects
   * @deprecated since v2.0.0 use {@link Agent.readIdentityGatewayAgents | readIdentityGatewayAgents} instead
   * ```javascript
   * readIdentityGatewayAgents(): Promise<AgentSkeleton[]>
   * ```
   * @group Deprecated
   */
  getIdentityGatewayAgents(): Promise<AgentSkeleton[]>;
  /**
   * Get identity gateway agent
   * @param {string} gatewayId gateway id
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an IdentityGatewayAgent object
   * @deprecated since v2.0.0 use {@link Agent.readIdentityGatewayAgent | readIdentityGatewayAgent} instead
   * ```javascript
   * readIdentityGatewayAgent(gatewayId: string): Promise<AgentSkeleton>
   * ```
   * @group Deprecated
   */
  getIdentityGatewayAgent(gatewayId: string): Promise<AgentSkeleton>;
  /**
   * Update or create identity gateway agent
   * @param {string} gatewayId gateway id
   * @param {AgentSkeleton} gatewayData IdentityGatewayAgent object
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an IdentityGatewayAgent object
   * @deprecated since v2.0.0 use {@link Agent.updateIdentityGatewayAgent | updateIdentityGatewayAgent} or {@link Agent.createIdentityGatewayAgent | createIdentityGatewayAgent} instead
   * ```javascript
   * updateIdentityGatewayAgent(gatewayId: string, gatewayData: AgentSkeleton): Promise<AgentSkeleton>
   * createIdentityGatewayAgent(gatewayId: string, gatewayData: AgentSkeleton): Promise<AgentSkeleton>
   * ```
   * @group Deprecated
   */
  putIdentityGatewayAgent(
    gatewayId: string,
    gatewayData: AgentSkeleton
  ): Promise<AgentSkeleton>;
  /**
   * Get java agents
   * @returns {romise<AgentSkeleton[]>} a promise that resolves to an array of J2EEAgent objects
   * @deprecated since v2.0.0 use {@link Agent.readJavaAgents | readJavaAgents} instead
   * ```javascript
   * readJavaAgents(): Promise<AgentSkeleton[]>
   * ```
   * @group Deprecated
   */
  getJavaAgents(): Promise<AgentSkeleton[]>;
  /**
   * Get java agent
   * @param {string} agentId java agent id
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an J2EEAgent object
   * @deprecated since v2.0.0 use {@link Agent.readJavaAgent | readJavaAgent} instead
   * ```javascript
   * readJavaAgent(agentId: string): Promise<AgentSkeleton>
   * ```
   * @group Deprecated
   */
  getJavaAgent(agentId: string): Promise<AgentSkeleton>;
  /**
   * Update or create java agent
   * @param {string} agentId java agent id
   * @param {AgentSkeleton} agentData java agent object
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an java agent object
   * @deprecated since v2.0.0 use {@link Agent.updateJavaAgent | updateJavaAgent} or {@link Agent.createJavaAgent | createJavaAgent} instead
   * ```javascript
   * updateJavaAgent(agentId: string, agentData: AgentSkeleton): Promise<AgentSkeleton>
   * createJavaAgent(agentId: string, agentData: AgentSkeleton): Promise<AgentSkeleton>
   * ```
   * @group Deprecated
   */
  putJavaAgent(
    agentId: string,
    agentData: AgentSkeleton
  ): Promise<AgentSkeleton>;
  /**
   * Get web agents
   * @returns {Promise<AgentSkeleton[]>} a promise that resolves to an array of WebAgent objects
   * @deprecated since v2.0.0 use {@link Agent.readWebAgents | readWebAgents} instead
   * ```javascript
   * readWebAgents(): Promise<AgentSkeleton[]>
   * ```
   * @group Deprecated
   */
  getWebAgents(): Promise<AgentSkeleton[]>;
  /**
   * Get web agent
   * @param {string} agentId web agent id
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an WebAgent object
   * @deprecated since v2.0.0 use {@link Agent.readWebAgent | readWebAgent} instead
   * ```javascript
   * readWebAgent(agentId: string): Promise<AgentSkeleton>
   * ```
   * @group Deprecated
   */
  getWebAgent(agentId: string): Promise<AgentSkeleton>;
  /**
   * Update or create web agent
   * @param {string} agentId web agent id
   * @param {AgentSkeleton} agentData WebAgent object
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an object containing an WebAgent object
   * @deprecated since v2.0.0 use {@link Agent.updateWebAgent | updateWebAgent} or {@link Agent.createWebAgent | createWebAgent} instead
   * ```javascript
   * updateWebAgent(agentId: string, agentData: AgentSkeleton): Promise<AgentSkeleton>
   * createWebAgent(agentId: string, agentData: AgentSkeleton): Promise<AgentSkeleton>
   * ```
   * @group Deprecated
   */
  putWebAgent(
    agentId: string,
    agentData: AgentSkeleton
  ): Promise<AgentSkeleton>;
};

export default (state: State): Agent => {
  return {
    createAgentExportTemplate(): AgentExportInterface {
      return createAgentExportTemplate({ state });
    },
    async readAgents(globalConfig = false): Promise<AgentSkeleton[]> {
      return readAgents({ state, globalConfig });
    },
    async readAgent(
      agentId: string,
      globalConfig = false
    ): Promise<AgentSkeleton> {
      return readAgent({ agentId, globalConfig, state });
    },
    createAgentGroupExportTemplate(): AgentGroupExportInterface {
      return createAgentGroupExportTemplate({ state });
    },
    async readAgentGroup(groupId: string): Promise<AgentGroupSkeleton> {
      return readAgentGroup({ groupId, state });
    },
    async readAgentGroups(): Promise<AgentGroupSkeleton[]> {
      return readAgentGroups({ state });
    },
    async exportAgentGroup(
      groupId: string
    ): Promise<AgentGroupExportInterface> {
      return exportAgentGroup({ groupId, state });
    },
    async exportAgentGroups(): Promise<AgentGroupExportInterface> {
      return exportAgentGroups({ state });
    },
    async readAgentByTypeAndId(
      agentType: AgentType,
      agentId: string
    ): Promise<AgentSkeleton> {
      return readAgentByTypeAndId({ agentType, agentId, state });
    },
    async readIdentityGatewayAgents(): Promise<AgentSkeleton[]> {
      return readIdentityGatewayAgents({ state });
    },
    async readIdentityGatewayAgent(gatewayId: string): Promise<AgentSkeleton> {
      return readIdentityGatewayAgent({ gatewayId, state });
    },
    async createIdentityGatewayAgent(
      gatewayId: string,
      gatewayData: AgentSkeleton
    ): Promise<AgentSkeleton> {
      return createIdentityGatewayAgent({
        gatewayId,
        gatewayData,
        state,
      });
    },
    async updateIdentityGatewayAgent(
      gatewayId: string,
      gatewayData: AgentSkeleton
    ): Promise<AgentSkeleton> {
      return updateIdentityGatewayAgent({
        gatewayId,
        gatewayData,
        state,
      });
    },
    async readJavaAgents(): Promise<AgentSkeleton[]> {
      return readJavaAgents({ state });
    },
    async readJavaAgent(agentId: string): Promise<AgentSkeleton> {
      return readJavaAgent({ agentId, state });
    },
    async createJavaAgent(
      agentId: string,
      agentData: AgentSkeleton
    ): Promise<AgentSkeleton> {
      return createJavaAgent({ agentId, agentData, state });
    },
    async updateJavaAgent(
      agentId: string,
      agentData: AgentSkeleton
    ): Promise<AgentSkeleton> {
      return updateJavaAgent({ agentId, agentData, state });
    },
    async readWebAgents(): Promise<AgentSkeleton[]> {
      return readWebAgents({ state });
    },
    async readWebAgent(agentId: string): Promise<AgentSkeleton> {
      return readWebAgent({ agentId, state });
    },
    async createWebAgent(
      agentId: string,
      agentData: AgentSkeleton
    ): Promise<AgentSkeleton> {
      return createWebAgent({ agentId, agentData, state });
    },
    async updateWebAgent(
      agentId: string,
      agentData: AgentSkeleton
    ): Promise<AgentSkeleton> {
      return updateWebAgent({ agentId, agentData, state });
    },
    async exportAgents(globalConfig = false): Promise<AgentExportInterface> {
      return exportAgents({ state, globalConfig });
    },
    async exportIdentityGatewayAgents(): Promise<AgentExportInterface> {
      return exportIdentityGatewayAgents({ state });
    },
    async exportJavaAgents(): Promise<AgentExportInterface> {
      return exportJavaAgents({ state });
    },
    async exportWebAgents(): Promise<AgentExportInterface> {
      return exportWebAgents({ state });
    },
    async exportAgent(
      agentId: string,
      globalConfig = false
    ): Promise<AgentExportInterface> {
      return exportAgent({ agentId, globalConfig, state });
    },
    async exportIdentityGatewayAgent(
      agentId: string
    ): Promise<AgentExportInterface> {
      return exportIdentityGatewayAgent({ agentId, state });
    },
    async exportJavaAgent(agentId: string): Promise<AgentExportInterface> {
      return exportJavaAgent({ agentId, state });
    },
    async exportWebAgent(agentId: string): Promise<AgentExportInterface> {
      return exportWebAgent({ agentId, state });
    },
    async importAgents(
      importData: AgentExportInterface,
      globalConfig: boolean = false
    ): Promise<AgentSkeleton[]> {
      return importAgents({ importData, globalConfig, state });
    },
    async importAgentGroups(
      importData: AgentGroupExportInterface
    ): Promise<AgentGroupSkeleton[]> {
      return importAgentGroups({ importData, state });
    },
    async importIdentityGatewayAgents(
      importData: AgentExportInterface
    ): Promise<void> {
      return importIdentityGatewayAgents({ importData, state });
    },
    async importJavaAgents(importData: AgentExportInterface): Promise<void> {
      return importJavaAgents({ importData, state });
    },
    async importWebAgents(importData: AgentExportInterface): Promise<void> {
      return importWebAgents({ importData, state });
    },
    async importAgent(
      agentId: string,
      importData: AgentExportInterface,
      globalConfig: boolean = false
    ) {
      return importAgent({ agentId, importData, globalConfig, state });
    },
    async importAgentGroup(
      agentGroupId: string,
      importData: AgentGroupExportInterface
    ) {
      return importAgentGroup({ agentGroupId, importData, state });
    },
    async importIdentityGatewayAgent(
      agentId: string,
      importData: AgentExportInterface
    ) {
      return importIdentityGatewayAgent({
        agentId,
        importData,
        state,
      });
    },
    async importJavaAgent(agentId: string, importData: AgentExportInterface) {
      return importJavaAgent({ agentId, importData, state });
    },
    async importWebAgent(agentId: string, importData: AgentExportInterface) {
      return importWebAgent({ agentId, importData, state });
    },
    async deleteAgents() {
      return deleteAgents({ state });
    },
    async deleteAgent(agentId: string) {
      return deleteAgent({ agentId, state });
    },
    async deleteIdentityGatewayAgents() {
      return deleteIdentityGatewayAgents({ state });
    },
    async deleteIdentityGatewayAgent(agentId: string) {
      return deleteIdentityGatewayAgent({ agentId, state });
    },
    async deleteJavaAgents() {
      return deleteJavaAgents({ state });
    },
    async deleteJavaAgent(agentId: string) {
      return deleteJavaAgent({ agentId, state });
    },
    async deleteWebAgents() {
      return deleteWebAgents({ state });
    },
    async deleteWebAgent(agentId: string) {
      return deleteWebAgent({ agentId, state });
    },

    // Deprecated

    async getAgents(): Promise<AgentSkeleton[]> {
      return readAgents({ state, globalConfig: false });
    },
    async getAgent(agentId: string) {
      return readAgent({ agentId, globalConfig: false, state });
    },
    async getAgentByTypeAndId(agentType: AgentType, agentId: string) {
      return readAgentByTypeAndId({ agentType, agentId, state });
    },
    async getIdentityGatewayAgents() {
      return readIdentityGatewayAgents({ state });
    },
    async getIdentityGatewayAgent(gatewayId: string) {
      return readIdentityGatewayAgent({ gatewayId, state });
    },
    async putIdentityGatewayAgent(
      gatewayId: string,
      gatewayData: AgentSkeleton
    ) {
      return updateIdentityGatewayAgent({
        gatewayId,
        gatewayData,
        state,
      });
    },
    async getJavaAgents() {
      return readJavaAgents({ state });
    },
    async getJavaAgent(agentId: string) {
      return readJavaAgent({ agentId, state });
    },
    async putJavaAgent(
      agentId: string,
      agentData: AgentSkeleton
    ): Promise<AgentSkeleton> {
      return updateJavaAgent({ agentId, agentData, state });
    },
    async getWebAgents(): Promise<AgentSkeleton[]> {
      return readWebAgents({ state });
    },
    async getWebAgent(agentId: string): Promise<AgentSkeleton> {
      return readWebAgent({ agentId, state });
    },
    async putWebAgent(
      agentId: string,
      agentData: AgentSkeleton
    ): Promise<AgentSkeleton> {
      return updateWebAgent({ agentId, agentData, state });
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

const agentTypes: AgentType[] = [
  '2.2_Agent',
  'IdentityGatewayAgent',
  'J2EEAgent',
  'OAuth2Thing',
  'RemoteConsentAgent',
  'SharedAgent',
  'SoapSTSAgent',
  'SoftwarePublisher',
  'WebAgent',
];

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
      const resolved = await getAgents({ state, globalConfig });
      agents = agents.concat(resolved.result);
    } else {
      const resolved = await Promise.all(
        agentTypes
          .filter(
            (t) =>
              t !== 'SoapSTSAgent' ||
              state.getDeploymentType() ===
                Constants.CLASSIC_DEPLOYMENT_TYPE_KEY
          )
          .map((agentType) =>
            getAgentsByType({ agentType, state }).catch((err) => {
              if (err.httpStatus !== 501 && err.response?.status !== 501) {
                throw err;
              } else {
                return { result: [] };
              }
            })
          )
      );
      agents = agents.concat(...resolved.map((response) => response.result));
    }
    agents.sort((a, b) => a._id.localeCompare(b._id));
    debugMessage({ message: `AgentOps.readAgents: end`, state });
    return agents;
  } catch (error) {
    throw new FrodoError(`Error reading agents`, error);
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
  let agents = [];
  try {
    debugMessage({ message: `AgentOps.readAgent: start`, state });
    if (globalConfig) {
      agents = (await readAgents({ globalConfig, state })).filter(
        (a) => a._id === agentId
      );
    } else {
      agents = await findAgentById({ agentId, state });
    }
    if (agents.length === 1) {
      const result = await _getAgentByTypeAndId({
        agentType: agents[0]._type,
        agentId: agents[0]._id,
        globalConfig,
        state,
      });
      debugMessage({ message: `AgentOps.readAgent: end`, state });
      return result;
    }
  } catch (error) {
    throw new FrodoError(`Error reading agent ${agentId}`, error);
  }
  if (agents.length === 0) {
    throw new FrodoError(`Agent '${agentId}' not found`);
  } else {
    throw new FrodoError(`${agents.length} agents '${agentId}' found`);
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
  throw new FrodoError(`Agent group with id '${groupId}' does not exist.`);
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
    const { result } = await getAgentGroups({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading agent groups`, error);
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
    throw new FrodoError(`Error exporting agent group ${groupId}`, error);
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
      message: 'Exporting agent groups...',
      state,
    });
    for (const group of groups) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting agent group ${group._id}`,
        state,
      });
      exportData.agentGroup[group._id] = group;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${groups.length} agent groups.`,
      state,
    });
    debugMessage({ message: `AgentOps.exportAgentGroups: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting agent groups.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error reading agent groups`, error);
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
      `Error reading agent ${agentId} of type ${agentType}`,
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
    const { result } = await getAgentsByType({
      agentType: 'IdentityGatewayAgent',
      state,
    });
    debugMessage({ message: `AgentOps.readIdentityGatewayAgents: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading identity gateway agents`, error);
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
      `Error reading identity gateway agent ${gatewayId}`,
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
  } catch (error) {
    try {
      const result = await putAgentByTypeAndId({
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
        `Error creating identity gateway agent ${gatewayId}`,
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
    const result = await putAgentByTypeAndId({
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
      `Error updating identity gateway agent ${gatewayId}`,
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
    const { result } = await getAgentsByType({
      agentType: 'J2EEAgent',
      state,
    });
    debugMessage({ message: `AgentOps.readJavaAgents: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading java agents`, error);
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
    throw new FrodoError(`Error reading java agent ${agentId}`, error);
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
  } catch (error) {
    try {
      const result = await putAgentByTypeAndId({
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
      throw new FrodoError(`Error creating java agent ${agentId}`, error);
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
    const result = await putAgentByTypeAndId({
      agentType: 'J2EEAgent',
      agentId,
      agentData,
      globalConfig: false,
      state,
    });
    debugMessage({ message: `AgentOps.updateJavaAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error updating java agent ${agentId}`, error);
  }
}

/**
 * Get web agents
 * @returns {Promise} a promise that resolves to an array of WebAgent objects
 */
export async function readWebAgents({ state }: { state: State }) {
  try {
    debugMessage({ message: `AgentOps.readWebAgents: start`, state });
    const { result } = await getAgentsByType({
      agentType: 'WebAgent',
      state,
    });
    debugMessage({ message: `AgentOps.readWebAgents: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading web agents`, error);
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
    throw new FrodoError(`Error reading web agent ${agentId}`, error);
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
  } catch (error) {
    try {
      const result = await putAgentByTypeAndId({
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
      throw new FrodoError(`Error creating web agent ${agentId}`, error);
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
    const result = await putAgentByTypeAndId({
      agentType: 'WebAgent',
      agentId,
      agentData,
      globalConfig: false,
      state,
    });
    debugMessage({ message: `AgentOps.updateWebAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error updating web agent ${agentId}`, error);
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
      message: 'Exporting agents...',
      state,
    });
    for (const agent of agents) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting agent ${agent._id}`,
        state,
      });
      exportData.agent[agent._id] = agent;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${agents.length} agents.`,
      state,
    });
    debugMessage({ message: `AgentOps.exportAgents: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting agents`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting agents`, error);
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
      message: 'Exporting IG agents...',
      state,
    });
    for (const agent of agents) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting IG agent ${agent._id}`,
        state,
      });
      exportData.agent[agent._id] = agent;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${agents.length} IG agents.`,
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
      message: `Error exporting identity gateway agents`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting identity gateway agents`, error);
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
      message: 'Exporting Java agents...',
      state,
    });
    for (const agent of agents) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting Java agent ${agent._id}`,
        state,
      });
      exportData.agent[agent._id] = agent;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${agents.length} Java agents.`,
      state,
    });
    debugMessage({ message: `AgentOps.exportJavaAgents: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting java agents`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting java agents`, error);
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
      message: 'Exporting web agents...',
      state,
    });
    for (const agent of agents) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting web agent ${agent._id}`,
        state,
      });
      exportData.agent[agent._id] = agent;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${agents.length} web agents.`,
      state,
    });
    debugMessage({ message: `AgentOps.exportWebAgents: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting web agents`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting web agents`, error);
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
    throw new FrodoError(`Error exporting agent ${agentId}`, error);
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
      `Error exporting identity gateway agent ${agentId}`,
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
    throw new FrodoError(`Error exporting java agent ${agentId}`, error);
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
    throw new FrodoError(`Error exporting web agent ${agentId}`, error);
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
          await putAgentByTypeAndId({
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
              `Error importing agent ${agentId} of type ${agentType}`,
              error
            )
          );
        }
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing agents`, errors);
    }
    debugMessage({ message: `AgentOps.importAgents: end`, state });
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing agents`, error);
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
            `Can't import Soap STS agent groups for '${state.getDeploymentType()}' deployment type.`
          );
        }
        response.push(
          await putAgentGroupByTypeAndId({
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
              `Error importing agent group ${agentGroupId} of type ${agentType}`,
              error
            )
          );
        }
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing agent groups`, errors);
    }
    debugMessage({ message: `AgentOps.importAgentGroups: end`, state });
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing agent groups`, error);
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
        await putAgentByTypeAndId({
          agentType,
          agentId,
          agentData: importData.agent[agentId],
          globalConfig: false,
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error importing agent ${agentId} of type ${agentType}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing identity gateway agents`, errors);
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
    throw new FrodoError(`Error importing identity gateway agents`, error);
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
        await putAgentByTypeAndId({
          agentType,
          agentId,
          agentData: importData.agent[agentId],
          globalConfig: false,
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error importing agent ${agentId} of type ${agentType}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing java agents`, errors);
    }
    debugMessage({ message: `AgentOps.importJavaAgents: end`, state });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing java agents`, error);
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
        await putAgentByTypeAndId({
          agentType,
          agentId,
          agentData: importData.agent[agentId],
          globalConfig: false,
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error importing agent ${agentId} of type ${agentType}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing web agents`, errors);
    }
    debugMessage({ message: `AgentOps.importWebAgents: end`, state });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing web agents`, error);
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
    const result = await putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agent[agentId],
      globalConfig,
      state,
    });
    debugMessage({ message: `AgentOps.importAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error importing agent ${agentId}`, error);
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
    const result = await putAgentGroupByTypeAndId({
      agentType,
      agentGroupId,
      agentGroupData: importData.agentGroup[agentGroupId],
      state,
    });
    debugMessage({ message: `AgentOps.importAgentGroup: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error importing agent group ${agentGroupId}`, error);
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
    const result = await putAgentByTypeAndId({
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
      `Error importing identity gateway agent ${agentId}`,
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
    const result = await putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agent[agentId],
      globalConfig: false,
      state,
    });
    debugMessage({ message: `AgentOps.importJavaAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error importing java agent ${agentId}`, error);
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
    const result = await putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agent[agentId],
      globalConfig: false,
      state,
    });
    debugMessage({ message: `AgentOps.importWebAgent: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error importing web agent ${agentId}`, error);
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
        await deleteAgentByTypeAndId({
          agentType: agent['_type']['_id'] as AgentType,
          agentId: agent['_id'],
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error deleting agent ${agent['_id']} of type ${agent['_type']['_id']}`,
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
        await deleteAgentByTypeAndId({
          agentType: agent['_type']['_id'] as AgentType,
          agentId: agent['_id'],
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error deleting agent ${agent['_id']} of type ${agent['_type']['_id']}`,
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
        await deleteAgentByTypeAndId({
          agentType: agent['_type']['_id'] as AgentType,
          agentId: agent['_id'],
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error deleting agent ${agent['_id']} of type ${agent['_type']['_id']}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting java agents`, errors);
    }
    debugMessage({ message: `AgentOps.deleteJavaAgents: end`, state });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting java agents`, error);
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
        await deleteAgentByTypeAndId({
          agentType: agent['_type']['_id'] as AgentType,
          agentId: agent['_id'],
          state,
        });
      } catch (error) {
        errors.push(
          new FrodoError(
            `Error deleting agent ${agent['_id']} of type ${agent['_type']['_id']}`,
            error
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting web agents`, errors);
    }
    debugMessage({ message: `AgentOps.deleteWebAgents: end`, state });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting web agents`, error);
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
    const agents = await findAgentById({ agentId, state });
    if (agents.length == 0) {
      throw new FrodoError(`Agent '${agentId}' not found!`);
    }
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteAgent: '${agent['_id']}'`,
        state,
      });
      await deleteAgentByTypeAndId({
        agentType: agent['_type'],
        agentId: agent['_id'],
        state,
      });
    }
    debugMessage({ message: `AgentOps.deleteAgent: end`, state });
  } catch (error) {
    throw new FrodoError(`Error deleting agent ${agentId}`, error);
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
    const agents = await findAgentByTypeAndId({
      agentType: 'IdentityGatewayAgent',
      agentId,
      state,
    });
    if (agents.length == 0) {
      throw new FrodoError(`Identity gateway agent '${agentId}' not found!`);
    }
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteIdentityGatewayAgent: '${agent['_id']}'`,
        state,
      });
      await deleteAgentByTypeAndId({
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
      `Error deleting identity gateway agent ${agentId}`,
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
    const agents = await findAgentByTypeAndId({
      agentType: 'J2EEAgent',
      agentId,
      state,
    });
    if (agents.length == 0) {
      throw new FrodoError(`Java agent '${agentId}' not found!`);
    }
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteJavaAgent: '${agent['_id']}'`,
        state,
      });
      await deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'] as AgentType,
        agentId: agent['_id'],
        state,
      });
    }
    debugMessage({ message: `AgentOps.deleteJavaAgent: end`, state });
  } catch (error) {
    throw new FrodoError(`Error deleting java agent ${agentId}`, error);
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
    const agents = await findAgentByTypeAndId({
      agentType: 'WebAgent',
      agentId,
      state,
    });
    if (agents.length == 0) {
      throw new FrodoError(`Web agent '${agentId}' not found!`);
    }
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteWebAgent: '${agent['_id']}'`,
        state,
      });
      await deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'] as AgentType,
        agentId: agent['_id'],
        state,
      });
    }
    debugMessage({ message: `AgentOps.deleteWebAgent: end`, state });
  } catch (error) {
    throw new FrodoError(`Error deleting web agent ${agentId}`, error);
  }
}
