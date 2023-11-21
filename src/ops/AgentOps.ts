import {
  type AgentSkeleton,
  type AgentType,
  deleteAgentByTypeAndId,
  findAgentById,
  findAgentByTypeAndId,
  getAgentByTypeAndId as _getAgentByTypeAndId,
  getAgentsByType,
  putAgentByTypeAndId,
} from '../api/AgentApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { validateImport } from '../utils/ExportImportUtils';
import { type ExportMetaData } from './OpsTypes';

export type Agent = {
  /**
   * Create an empty agent export template
   * @returns {AgentExportInterface} an empty agent export template
   */
  createAgentExportTemplate(): AgentExportInterface;
  /**
   * Read all agents.
   * @returns {Promise<TreeSkeleton[]>} a promise that resolves to an array of agent objects
   */
  readAgents(): Promise<AgentSkeleton[]>;
  /**
   * Read agent
   * @param {string} agentId agent id/name
   * @returns {Promise<AgentSkeleton>} a promise that resolves to an agent object
   */
  readAgent(agentId: string): Promise<AgentSkeleton>;
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
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  exportAgents(): Promise<AgentExportInterface>;
  /**
   * Export all identity gateway agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  exportIdentityGatewayAgents(): Promise<AgentExportInterface>;
  /**
   * Export all java agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  exportJavaAgents(): Promise<AgentExportInterface>;
  /**
   * Export all web agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  exportWebAgents(): Promise<AgentExportInterface>;
  /**
   * Export agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  exportAgent(agentId: string): Promise<AgentExportInterface>;
  /**
   * Export identity gateway agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  exportIdentityGatewayAgent(agentId: string): Promise<AgentExportInterface>;
  /**
   * Export java agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  exportJavaAgent(agentId: string): Promise<AgentExportInterface>;
  /**
   * Export web agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  exportWebAgent(agentId: string): Promise<AgentExportInterface>;
  /**
   * Import agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   */
  importAgents(importData: AgentExportInterface): Promise<void>;
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
   * @returns {Promise} Promise resolving to an agent object.
   */
  importAgent(agentId: string, importData: AgentExportInterface): Promise<any>;
  /**
   * Import identity gateway agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise} Promise resolving to an agent object.
   */
  importIdentityGatewayAgent(
    agentId: string,
    importData: AgentExportInterface
  ): Promise<any>;
  /**
   * Import java agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise} Promise resolving to an agent object.
   */
  importJavaAgent(
    agentId: string,
    importData: AgentExportInterface
  ): Promise<any>;
  /**
   * Import java agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise} Promise resolving to an agent object.
   */
  importWebAgent(
    agentId: string,
    importData: AgentExportInterface
  ): Promise<any>;
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
   * @returns {Promise<TreeSkeleton[]>} a promise that resolves to an array of agent objects
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
      return createAgentExportTemplate();
    },
    async readAgents(): Promise<AgentSkeleton[]> {
      return readAgents({ state });
    },
    async readAgent(agentId: string): Promise<AgentSkeleton> {
      return readAgent({ agentId, state });
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
    async exportAgents(): Promise<AgentExportInterface> {
      return exportAgents({ state });
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
    async exportAgent(agentId: string): Promise<AgentExportInterface> {
      return exportAgent({ agentId, state });
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
    async importAgents(importData: AgentExportInterface): Promise<void> {
      return importAgents({ importData, state });
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
    async importAgent(agentId: string, importData: AgentExportInterface) {
      return importAgent({ agentId, importData, state });
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
      return readAgents({ state });
    },
    async getAgent(agentId: string) {
      return readAgent({ agentId, state });
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
  meta?: Record<string, ExportMetaData>;
  agents: Record<string, AgentSkeleton>;
}

/**
 * Create an empty agent export template
 * @returns {AgentExportInterface} an empty agent export template
 */
export function createAgentExportTemplate(): AgentExportInterface {
  return {
    meta: {},
    agents: {},
  } as AgentExportInterface;
}

/**
 * Get all agents. Results are sorted aphabetically.
 * @returns {Promise<TreeSkeleton[]>} a promise that resolves to an array of agent objects
 */
export async function readAgents({
  state,
}: {
  state: State;
}): Promise<AgentSkeleton[]> {
  debugMessage({ message: `AgentOps.getAgents: start`, state });
  let agents = [];
  try {
    const resolved = await Promise.all([
      getAgentsByType({ agentType: 'IdentityGatewayAgent', state }),
      getAgentsByType({ agentType: 'J2EEAgent', state }),
      getAgentsByType({ agentType: 'WebAgent', state }),
    ]);
    agents = agents.concat(resolved[0].result);
    agents = agents.concat(resolved[1].result);
    agents = agents.concat(resolved[2].result);
  } catch (error) {
    printMessage({ message: `${error.message}`, type: 'error', state });
    printMessage({ message: error.response.data, type: 'error', state });
  }
  agents.sort((a, b) => a._id.localeCompare(b._id));
  debugMessage({ message: `AgentOps.getAgents: end`, state });
  return agents;
}

/**
 * Get agent
 * @param {string} agentId agent id/name
 * @returns {Promise<AgentSkeleton>} a promise that resolves to an agent object
 */
export async function readAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}): Promise<AgentSkeleton> {
  debugMessage({ message: `AgentOps.getAgent: start`, state });
  const agents = await findAgentById({ agentId, state });
  if (agents.length === 1) {
    const result = await _getAgentByTypeAndId({
      agentType: agents[0]._type,
      agentId: agents[0]._id,
      state,
    });
    debugMessage({ message: `AgentOps.getAgent: end`, state });
    return result;
  } else if (agents.length === 0) {
    throw new Error(`Agent '${agentId}' not found`);
  } else {
    throw new Error(`${agents.length} agents '${agentId}' found`);
  }
}

/**
 * Get agent by type and id
 * @param {AgentType} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
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
  debugMessage({ message: `AgentOps.getAgentByTypeAndId: start`, state });
  const result = await _getAgentByTypeAndId({ agentType, agentId, state });
  debugMessage({ message: `AgentOps.getAgentByTypeAndId: start`, state });
  return result;
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
  debugMessage({ message: `AgentOps.getIdentityGatewayAgents: start`, state });
  const { result } = await getAgentsByType({
    agentType: 'IdentityGatewayAgent',
    state,
  });
  debugMessage({ message: `AgentOps.getIdentityGatewayAgents: end`, state });
  return result;
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
  debugMessage({ message: `AgentOps.getIdentityGatewayAgent: start`, state });
  const result = await readAgentByTypeAndId({
    agentType: 'IdentityGatewayAgent',
    agentId: gatewayId,
    state,
  });
  debugMessage({ message: `AgentOps.getIdentityGatewayAgent: end`, state });
  return result;
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
  } catch (error) {
    const result = await putAgentByTypeAndId({
      agentType: 'IdentityGatewayAgent',
      agentId: gatewayId,
      agentData: gatewayData,
      state,
    });
    debugMessage({
      message: `AgentOps.createIdentityGatewayAgent: end`,
      state,
    });
    return result;
  }
  throw new Error(`Agent ${gatewayId} already exists!`);
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
  debugMessage({ message: `AgentOps.putIdentityGatewayAgent: start`, state });
  const result = await putAgentByTypeAndId({
    agentType: 'IdentityGatewayAgent',
    agentId: gatewayId,
    agentData: gatewayData,
    state,
  });
  debugMessage({ message: `AgentOps.putIdentityGatewayAgent: end`, state });
  return result;
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
  debugMessage({ message: `AgentOps.getJavaAgents: start`, state });
  const { result } = await getAgentsByType({
    agentType: 'J2EEAgent',
    state,
  });
  debugMessage({ message: `AgentOps.getJavaAgents: end`, state });
  return result;
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
  debugMessage({ message: `AgentOps.getJavaAgent: start`, state });
  const result = await readAgentByTypeAndId({
    agentType: 'J2EEAgent',
    agentId,
    state,
  });
  debugMessage({ message: `AgentOps.getJavaAgent: end`, state });
  return result;
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
  } catch (error) {
    const result = await putAgentByTypeAndId({
      agentType: 'J2EEAgent',
      agentId,
      agentData,
      state,
    });
    debugMessage({
      message: `AgentOps.createJavaAgent: end`,
      state,
    });
    return result;
  }
  throw new Error(`Agent ${agentId} already exists!`);
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
  debugMessage({ message: `AgentOps.putJavaAgent: start`, state });
  const result = await putAgentByTypeAndId({
    agentType: 'J2EEAgent',
    agentId,
    agentData,
    state,
  });
  debugMessage({ message: `AgentOps.putJavaAgent: end`, state });
  return result;
}

/**
 * Get web agents
 * @returns {Promise} a promise that resolves to an array of WebAgent objects
 */
export async function readWebAgents({ state }: { state: State }) {
  debugMessage({ message: `AgentOps.getWebAgents: start`, state });
  const { result } = await getAgentsByType({
    agentType: 'WebAgent',
    state,
  });
  debugMessage({ message: `AgentOps.getWebAgents: end`, state });
  return result;
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
  debugMessage({ message: `AgentOps.getWebAgent: start`, state });
  const result = await readAgentByTypeAndId({
    agentType: 'WebAgent',
    agentId,
    state,
  });
  debugMessage({ message: `AgentOps.getWebAgent: end`, state });
  return result;
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
  } catch (error) {
    const result = await putAgentByTypeAndId({
      agentType: 'WebAgent',
      agentId,
      agentData,
      state,
    });
    debugMessage({
      message: `AgentOps.createWebAgent: end`,
      state,
    });
    return result;
  }
  throw new Error(`Agent ${agentId} already exists!`);
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
  debugMessage({ message: `AgentOps.putWebAgent: start`, state });
  const result = await putAgentByTypeAndId({
    agentType: 'WebAgent',
    agentId,
    agentData,
    state,
  });
  debugMessage({ message: `AgentOps.putWebAgent: end`, state });
  return result;
}

/**
 * Export all agents. The response can be saved to file as is.
 * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
 */
export async function exportAgents({
  state,
}: {
  state: State;
}): Promise<AgentExportInterface> {
  debugMessage({ message: `AgentOps.exportAgents: start`, state });
  const exportData = createAgentExportTemplate();
  const agents = await readAgents({ state });
  createProgressIndicator({
    total: agents.length,
    message: 'Exporting agents...',
    state,
  });
  for (const agent of agents) {
    updateProgressIndicator({
      message: `Exporting agent ${agent._id}`,
      state,
    });
    exportData.agents[agent._id] = agent;
  }
  stopProgressIndicator({
    message: `Exported ${agents.length} agents.`,
    state,
  });
  debugMessage({ message: `AgentOps.exportAgents: end`, state });
  return exportData;
}

/**
 * Export all identity gateway agents. The response can be saved to file as is.
 * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
 */
export async function exportIdentityGatewayAgents({
  state,
}: {
  state: State;
}): Promise<AgentExportInterface> {
  debugMessage({
    message: `AgentOps.exportIdentityGatewayAgents: start`,
    state,
  });
  const exportData = createAgentExportTemplate();
  const agents = await readIdentityGatewayAgents({ state });
  createProgressIndicator({
    total: agents.length,
    message: 'Exporting IG agents...',
    state,
  });
  for (const agent of agents) {
    updateProgressIndicator({
      message: `Exporting IG agent ${agent._id}`,
      state,
    });
    exportData.agents[agent._id] = agent;
  }
  stopProgressIndicator({
    message: `Exported ${agents.length} IG agents.`,
    state,
  });
  debugMessage({ message: `AgentOps.exportIdentityGatewayAgents: end`, state });
  return exportData;
}

/**
 * Export all java agents. The response can be saved to file as is.
 * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
 */
export async function exportJavaAgents({
  state,
}: {
  state: State;
}): Promise<AgentExportInterface> {
  debugMessage({ message: `AgentOps.exportJavaAgents: start`, state });
  const exportData = createAgentExportTemplate();
  const agents = await readJavaAgents({ state });
  createProgressIndicator({
    total: agents.length,
    message: 'Exporting Java agents...',
    state,
  });
  for (const agent of agents) {
    updateProgressIndicator({
      message: `Exporting Java agent ${agent._id}`,
      state,
    });
    exportData.agents[agent._id] = agent;
  }
  stopProgressIndicator({
    message: `Exported ${agents.length} Java agents.`,
    state,
  });
  debugMessage({ message: `AgentOps.exportJavaAgents: end`, state });
  return exportData;
}

/**
 * Export all web agents. The response can be saved to file as is.
 * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
 */
export async function exportWebAgents({
  state,
}: {
  state: State;
}): Promise<AgentExportInterface> {
  debugMessage({ message: `AgentOps.exportWebAgents: start`, state });
  const exportData = createAgentExportTemplate();
  const agents = await readWebAgents({ state });
  createProgressIndicator({
    total: agents.length,
    message: 'Exporting web agents...',
    state,
  });
  for (const agent of agents) {
    updateProgressIndicator({
      message: `Exporting web agent ${agent._id}`,
      state,
    });
    exportData.agents[agent._id] = agent;
  }
  stopProgressIndicator({
    message: `Exported ${agents.length} web agents.`,
    state,
  });
  debugMessage({ message: `AgentOps.exportWebAgents: end`, state });
  return exportData;
}

/**
 * Export agent. The response can be saved to file as is.
 * @param agentId agent id/name
 * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
 */
export async function exportAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}): Promise<AgentExportInterface> {
  debugMessage({ message: `AgentOps.exportAgent: start`, state });
  const exportData = createAgentExportTemplate();
  const agentObject = await readAgent({ agentId, state });
  exportData.agents[agentId] = agentObject;
  debugMessage({ message: `AgentOps.exportAgent: end`, state });
  return exportData;
}

/**
 * Export identity gateway agent. The response can be saved to file as is.
 * @param agentId agent id/name
 * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
 */
export async function exportIdentityGatewayAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}): Promise<AgentExportInterface> {
  debugMessage({
    message: `AgentOps.exportIdentityGatewayAgent: start`,
    state,
  });
  const exportData = createAgentExportTemplate();
  const agentObject = await readIdentityGatewayAgent({
    gatewayId: agentId,
    state,
  });
  exportData.agents[agentId] = agentObject;
  debugMessage({ message: `AgentOps.exportIdentityGatewayAgent: end`, state });
  return exportData;
}

/**
 * Export java agent. The response can be saved to file as is.
 * @param agentId agent id/name
 * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
 */
export async function exportJavaAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}): Promise<AgentExportInterface> {
  debugMessage({ message: `AgentOps.exportJavaAgent: start`, state });
  const exportData = createAgentExportTemplate();
  const agentObject = await readJavaAgent({ agentId, state });
  exportData.agents[agentId] = agentObject;
  debugMessage({ message: `AgentOps.exportJavaAgent: end`, state });
  return exportData;
}

/**
 * Export web agent. The response can be saved to file as is.
 * @param agentId agent id/name
 * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
 */
export async function exportWebAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}): Promise<AgentExportInterface> {
  debugMessage({ message: `AgentOps.exportWebAgent: start`, state });
  const exportData = createAgentExportTemplate();
  const agentObject = await readWebAgent({ agentId, state });
  exportData.agents[agentId] = agentObject;
  debugMessage({ message: `AgentOps.exportWebAgent: end`, state });
  return exportData;
}

/**
 * Import agents. The import data is usually read from an agent export file.
 * @param {AgentExportInterface} importData agent import data.
 */
export async function importAgents({
  importData,
  state,
}: {
  importData: AgentExportInterface;
  state: State;
}): Promise<void> {
  debugMessage({ message: `AgentOps.importAgents: start`, state });
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id as AgentType;
      debugMessage({
        message: `AgentOps.importAgents: ${agentId} [${agentType}]`,
        state,
      });
      await putAgentByTypeAndId({
        agentType,
        agentId,
        agentData: importData.agents[agentId],
        state,
      });
    }
  } else {
    throw new Error('Invalid meta data.');
  }
  debugMessage({ message: `AgentOps.importAgents: end`, state });
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
  debugMessage({
    message: `AgentOps.importIdentityGatewayAgents: start`,
    state,
  });
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id as AgentType;
      if (agentType !== 'IdentityGatewayAgent')
        throw new Error(
          `Wrong agent type! Expected 'IdentityGatewayAgent' but got '${agentType}'.`
        );
      await putAgentByTypeAndId({
        agentType,
        agentId,
        agentData: importData.agents[agentId],
        state,
      });
    }
  } else {
    throw new Error('Invalid meta data.');
  }
  debugMessage({ message: `AgentOps.importIdentityGatewayAgents: end`, state });
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
  debugMessage({ message: `AgentOps.importJavaAgents: start`, state });
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id as AgentType;
      if (agentType !== 'J2EEAgent')
        throw new Error(
          `Wrong agent type! Expected 'J2EEAgent' but got '${agentType}'.`
        );
      await putAgentByTypeAndId({
        agentType,
        agentId,
        agentData: importData.agents[agentId],
        state,
      });
    }
  } else {
    throw new Error('Invalid meta data.');
  }
  debugMessage({ message: `AgentOps.importJavaAgents: end`, state });
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
  debugMessage({ message: `AgentOps.importWebAgents: start`, state });
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id as AgentType;
      if (agentType !== 'WebAgent')
        throw new Error(
          `Wrong agent type! Expected 'WebAgent' but got '${agentType}'.`
        );
      await putAgentByTypeAndId({
        agentType,
        agentId,
        agentData: importData.agents[agentId],
        state,
      });
    }
  } else {
    throw new Error('Invalid meta data.');
  }
  debugMessage({ message: `AgentOps.importWebAgents: end`, state });
}

/**
 * Import agent. The import data is usually read from an agent export file.
 * @param {string} agentId agent id/name
 * @param {AgentExportInterface} importData agent import data.
 * @returns {Promise} Promise resolving to an agent object.
 */
export async function importAgent({
  agentId,
  importData,
  state,
}: {
  agentId: string;
  importData: AgentExportInterface;
  state: State;
}) {
  debugMessage({ message: `AgentOps.importAgent: start`, state });
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id as AgentType;
    const result = await putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agents[agentId],
      state,
    });
    debugMessage({ message: `AgentOps.importAgent: end`, state });
    return result;
  } else {
    throw new Error('Invalid meta data.');
  }
}

/**
 * Import identity gateway agent. The import data is usually read from an agent export file.
 * @param {string} agentId agent id/name
 * @param {AgentExportInterface} importData agent import data.
 * @returns {Promise} Promise resolving to an agent object.
 */
export async function importIdentityGatewayAgent({
  agentId,
  importData,
  state,
}: {
  agentId: string;
  importData: AgentExportInterface;
  state: State;
}) {
  debugMessage({
    message: `AgentOps.importIdentityGatewayAgent: start`,
    state,
  });
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id as AgentType;
    if (agentType !== 'IdentityGatewayAgent')
      throw new Error(
        `Wrong agent type! Expected 'IdentityGatewayAgent' but got '${agentType}'.`
      );
    const result = await putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agents[agentId],
      state,
    });
    debugMessage({
      message: `AgentOps.importIdentityGatewayAgent: end`,
      state,
    });
    return result;
  } else {
    throw new Error('Invalid meta data.');
  }
}

/**
 * Import java agent. The import data is usually read from an agent export file.
 * @param {string} agentId agent id/name
 * @param {AgentExportInterface} importData agent import data.
 * @returns {Promise} Promise resolving to an agent object.
 */
export async function importJavaAgent({
  agentId,
  importData,
  state,
}: {
  agentId: string;
  importData: AgentExportInterface;
  state: State;
}) {
  debugMessage({ message: `AgentOps.importJavaAgent: start`, state });
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id as AgentType;
    if (agentType !== 'J2EEAgent')
      throw new Error(
        `Wrong agent type! Expected 'J2EEAgent' but got '${agentType}'.`
      );
    const result = await putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agents[agentId],
      state,
    });
    debugMessage({ message: `AgentOps.importJavaAgent: end`, state });
    return result;
  } else {
    throw new Error('Invalid meta data.');
  }
}

/**
 * Import java agent. The import data is usually read from an agent export file.
 * @param {string} agentId agent id/name
 * @param {AgentExportInterface} importData agent import data.
 * @returns {Promise} Promise resolving to an agent object.
 */
export async function importWebAgent({
  agentId,
  importData,
  state,
}: {
  agentId: string;
  importData: AgentExportInterface;
  state: State;
}) {
  debugMessage({ message: `AgentOps.importWebAgent: start`, state });
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id as AgentType;
    if (agentType !== 'WebAgent')
      throw new Error(
        `Wrong agent type! Expected 'WebAgent' but got '${agentType}'.`
      );
    const result = await putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agents[agentId],
      state,
    });
    debugMessage({ message: `AgentOps.importWebAgent: end`, state });
    return result;
  } else {
    throw new Error('Invalid meta data.');
  }
}

/**
 * Delete all agents
 */
export async function deleteAgents({ state }: { state: State }) {
  debugMessage({ message: `AgentOps.deleteAgents: start`, state });
  const agents = await readAgents({ state });
  for (const agent of agents) {
    debugMessage({ message: `AgentOps.deleteAgent: '${agent['_id']}'`, state });
    await deleteAgentByTypeAndId({
      agentType: agent['_type']['_id'] as AgentType,
      agentId: agent['_id'],
      state,
    });
  }
  debugMessage({ message: `AgentOps.deleteAgents: end`, state });
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
  debugMessage({ message: `AgentOps.deleteAgent: start`, state });
  const agents = await findAgentById({ agentId, state });
  if (agents.length) {
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
  } else {
    throw new Error(`Agent '${agentId}' not found!`);
  }
  debugMessage({ message: `AgentOps.deleteAgent: end`, state });
}

/**
 * Delete all identity gateway agents
 */
export async function deleteIdentityGatewayAgents({ state }: { state: State }) {
  debugMessage({
    message: `AgentOps.deleteIdentityGatewayAgents: start`,
    state,
  });
  const agents = await readIdentityGatewayAgents({ state });
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
  debugMessage({ message: `AgentOps.deleteIdentityGatewayAgents: end`, state });
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
  debugMessage({
    message: `AgentOps.deleteIdentityGatewayAgent: start`,
    state,
  });
  const agents = await findAgentByTypeAndId({
    agentType: 'IdentityGatewayAgent',
    agentId,
    state,
  });
  if (agents.length) {
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteIdentityGatewayAgent: '${agent['_id']}'`,
        state,
      });
      await deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'],
        agentId: agent['_id'],
        state,
      });
    }
  } else {
    throw new Error(`Identity gateway agent '${agentId}' not found!`);
  }
  debugMessage({ message: `AgentOps.deleteIdentityGatewayAgent: end`, state });
}

/**
 * Delete all java agents
 */
export async function deleteJavaAgents({ state }: { state: State }) {
  debugMessage({ message: `AgentOps.deleteJavaAgents: start`, state });
  const agents = await readJavaAgents({ state });
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
  debugMessage({ message: `AgentOps.deleteJavaAgents: end`, state });
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
  debugMessage({ message: `AgentOps.deleteJavaAgent: start`, state });
  const agents = await findAgentByTypeAndId({
    agentType: 'J2EEAgent',
    agentId,
    state,
  });
  if (agents.length) {
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteJavaAgent: '${agent['_id']}'`,
        state,
      });
      await deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'],
        agentId: agent['_id'],
        state,
      });
    }
  } else {
    throw new Error(`Java agent '${agentId}' not found!`);
  }
  debugMessage({ message: `AgentOps.deleteJavaAgent: end`, state });
}

/**
 * Delete all web agents
 */
export async function deleteWebAgents({ state }: { state: State }) {
  debugMessage({ message: `AgentOps.deleteWebAgents: start`, state });
  const agents = await readWebAgents({ state });
  for (const agent of agents) {
    debugMessage({
      message: `AgentOps.deleteWebAgent: '${agent['_id']}'`,
      state,
    });
    await deleteAgentByTypeAndId({
      agentType: agent['_type']['_id'],
      agentId: agent['_id'],
      state,
    });
  }
  debugMessage({ message: `AgentOps.deleteWebAgents: end`, state });
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
  debugMessage({ message: `AgentOps.deleteWebAgent: start`, state });
  const agents = await findAgentByTypeAndId({
    agentType: 'WebAgent',
    agentId,
    state,
  });
  if (agents.length) {
    for (const agent of agents) {
      debugMessage({
        message: `AgentOps.deleteWebAgent: '${agent['_id']}'`,
        state,
      });
      await deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'],
        agentId: agent['_id'],
        state,
      });
    }
  } else {
    throw new Error(`Web agent '${agentId}' not found!`);
  }
  debugMessage({ message: `AgentOps.deleteWebAgent: end`, state });
}
