import { debugMessage, printMessage } from './utils/Console';
import {
  getAgentsByType,
  getAgentByTypeAndId as _getAgentByTypeAndId,
  putAgentByTypeAndId,
  findAgentById,
  deleteAgentByTypeAndId,
  findAgentByTypeAndId,
} from '../api/AgentApi';
import { AgentSkeleton } from '../api/ApiTypes';
import { AgentExportInterface } from './OpsTypes';
import { validateImport } from './utils/ExportImportUtils';
import State from '../shared/State';

export const AGENT_TYPE_IG = 'IdentityGatewayAgent';
export const AGENT_TYPE_JAVA = 'J2EEAgent';
export const AGENT_TYPE_WEB = 'WebAgent';

export default class AgentOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  /**
   * Create an empty agent export template
   * @returns {AgentExportInterface} an empty agent export template
   */
  createAgentExportTemplate(): AgentExportInterface {
    return createAgentExportTemplate();
  }

  /**
   * Get all agents. Results are sorted aphabetically.
   * @returns {Promise<TreeSkeleton[]>} a promise that resolves to an array of agent objects
   */
  async getAgents(): Promise<AgentSkeleton[]> {
    return getAgents({ state: this.state });
  }

  /**
   * Get agent
   * @param {string} agentId agent id/name
   * @returns {Promise} a promise that resolves to an agent object
   */
  async getAgent(agentId: string) {
    return getAgent({ agentId, state: this.state });
  }

  /**
   * Get agent by type and id
   * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
   * @param {string} agentId agent id/name
   * @returns {Promise} a promise that resolves to an agent object
   */
  async getAgentByTypeAndId(agentType: string, agentId: string) {
    return getAgentByTypeAndId({ agentType, agentId, state: this.state });
  }

  /**
   * Get identity gateway agents
   * @returns {Promise} a promise that resolves to an array of IdentityGatewayAgent objects
   */
  async getIdentityGatewayAgents() {
    return getIdentityGatewayAgents({ state: this.state });
  }

  /**
   * Get identity gateway agent
   * @param {string} gatewayId gateway id
   * @returns {Promise} a promise that resolves to an object containing an IdentityGatewayAgent object
   */
  async getIdentityGatewayAgent(gatewayId: string) {
    return getIdentityGatewayAgent({ gatewayId, state: this.state });
  }

  /**
   * Put identity gateway agent
   * @param {string} gatewayId gateway id
   * @param {Object} gatewayData IdentityGatewayAgent object
   * @returns {Promise} a promise that resolves to an object containing an IdentityGatewayAgent object
   */
  async putIdentityGatewayAgent(gatewayId: string, gatewayData: AgentSkeleton) {
    return putIdentityGatewayAgent({
      gatewayId,
      gatewayData,
      state: this.state,
    });
  }

  /**
   * Get java agents
   * @returns {Promise} a promise that resolves to an array of J2EEAgent objects
   */
  async getJavaAgents() {
    return getJavaAgents({ state: this.state });
  }

  /**
   * Get java agent
   * @param {string} agentId java agent id
   * @returns {Promise} a promise that resolves to an object containing an J2EEAgent object
   */
  async getJavaAgent(agentId: string) {
    return getJavaAgent({ agentId, state: this.state });
  }

  /**
   * Put java agent
   * @param {string} agentId java agent id
   * @param {Object} agentData java agent object
   * @returns {Promise} a promise that resolves to an object containing an java agent object
   */
  async putJavaAgent(agentId: string, agentData: AgentSkeleton) {
    return putJavaAgent({ agentId, agentData, state: this.state });
  }

  /**
   * Get web agents
   * @returns {Promise} a promise that resolves to an array of WebAgent objects
   */
  async getWebAgents() {
    return getWebAgents({ state: this.state });
  }

  /**
   * Get web agent
   * @param {string} agentId web agent id
   * @returns {Promise} a promise that resolves to an object containing an WebAgent object
   */
  async getWebAgent(agentId: string) {
    return getWebAgent({ agentId, state: this.state });
  }

  /**
   * Put web agent
   * @param {string} agentId web agent id
   * @param {Object} agentData WebAgent object
   * @returns {Promise} a promise that resolves to an object containing an WebAgent object
   */
  async putWebAgent(agentId: string, agentData: AgentSkeleton) {
    return putWebAgent({ agentId, agentData, state: this.state });
  }

  /**
   * Export all agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface>} Promise resolving to an AgentExportInterface object.
   */
  async exportAgents(): Promise<AgentExportInterface> {
    return exportAgents({ state: this.state });
  }

  /**
   * Export all identity gateway agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  async exportIdentityGatewayAgents(): Promise<AgentExportInterface> {
    return exportIdentityGatewayAgents({ state: this.state });
  }

  /**
   * Export all java agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  async exportJavaAgents(): Promise<AgentExportInterface> {
    return exportJavaAgents({ state: this.state });
  }

  /**
   * Export all web agents. The response can be saved to file as is.
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  async exportWebAgents(): Promise<AgentExportInterface> {
    return exportWebAgents({ state: this.state });
  }

  /**
   * Export agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  async exportAgent(agentId: string): Promise<AgentExportInterface> {
    return exportAgent({ agentId, state: this.state });
  }

  /**
   * Export identity gateway agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  async exportIdentityGatewayAgent(
    agentId: string
  ): Promise<AgentExportInterface> {
    return exportIdentityGatewayAgent({ agentId, state: this.state });
  }

  /**
   * Export java agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  async exportJavaAgent(agentId: string): Promise<AgentExportInterface> {
    return exportJavaAgent({ agentId, state: this.state });
  }

  /**
   * Export web agent. The response can be saved to file as is.
   * @param agentId agent id/name
   * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
   */
  async exportWebAgent(agentId: string): Promise<AgentExportInterface> {
    return exportWebAgent({ agentId, state: this.state });
  }

  /**
   * Import agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   */
  async importAgents(importData: AgentExportInterface): Promise<void> {
    return importAgents({ importData, state: this.state });
  }

  /**
   * Import identity gateway agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   */
  async importIdentityGatewayAgents(
    importData: AgentExportInterface
  ): Promise<void> {
    return importIdentityGatewayAgents({ importData, state: this.state });
  }

  /**
   * Import java agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   */
  async importJavaAgents(importData: AgentExportInterface): Promise<void> {
    return importJavaAgents({ importData, state: this.state });
  }

  /**
   * Import web agents. The import data is usually read from an agent export file.
   * @param {AgentExportInterface} importData agent import data.
   */
  async importWebAgents(importData: AgentExportInterface): Promise<void> {
    return importWebAgents({ importData, state: this.state });
  }

  /**
   * Import agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise} Promise resolving to an agent object.
   */
  async importAgent(agentId: string, importData: AgentExportInterface) {
    return importAgent({ agentId, importData, state: this.state });
  }

  /**
   * Import identity gateway agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise} Promise resolving to an agent object.
   */
  async importIdentityGatewayAgent(
    agentId: string,
    importData: AgentExportInterface
  ) {
    return importIdentityGatewayAgent({
      agentId,
      importData,
      state: this.state,
    });
  }

  /**
   * Import java agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise} Promise resolving to an agent object.
   */
  async importJavaAgent(agentId: string, importData: AgentExportInterface) {
    return importJavaAgent({ agentId, importData, state: this.state });
  }

  /**
   * Import java agent. The import data is usually read from an agent export file.
   * @param {string} agentId agent id/name
   * @param {AgentExportInterface} importData agent import data.
   * @returns {Promise} Promise resolving to an agent object.
   */
  async importWebAgent(agentId: string, importData: AgentExportInterface) {
    return importWebAgent({ agentId, importData, state: this.state });
  }

  /**
   * Delete all agents
   */
  async deleteAgents() {
    return deleteAgents({ state: this.state });
  }

  /**
   * Delete agent
   * @param agentId agent id/name
   */
  async deleteAgent(agentId: string) {
    return deleteAgent({ agentId, state: this.state });
  }

  /**
   * Delete all identity gateway agents
   */
  async deleteIdentityGatewayAgents() {
    return deleteIdentityGatewayAgents({ state: this.state });
  }

  /**
   * Delete identity gateway agent
   * @param agentId agent id/name
   */
  async deleteIdentityGatewayAgent(agentId: string) {
    return deleteIdentityGatewayAgent({ agentId, state: this.state });
  }

  /**
   * Delete all java agents
   */
  async deleteJavaAgents() {
    return deleteJavaAgents({ state: this.state });
  }

  /**
   * Delete java agent
   * @param agentId agent id/name
   */
  async deleteJavaAgent(agentId: string) {
    return deleteJavaAgent({ agentId, state: this.state });
  }

  /**
   * Delete all web agents
   */
  async deleteWebAgents() {
    return deleteWebAgents({ state: this.state });
  }

  /**
   * Delete web agent
   * @param agentId agent id/name
   */
  async deleteWebAgent(agentId: string) {
    return deleteWebAgent({ agentId, state: this.state });
  }
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
export async function getAgents({
  state,
}: {
  state: State;
}): Promise<AgentSkeleton[]> {
  debugMessage(`AgentOps.getAgents: start`);
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
    printMessage(`${error.message}`, 'error');
    printMessage(error.response.data, 'error');
  }
  agents.sort((a, b) => a._id.localeCompare(b._id));
  debugMessage(`AgentOps.getAgents: end`);
  return agents;
}

/**
 * Get agent
 * @param {string} agentId agent id/name
 * @returns {Promise} a promise that resolves to an agent object
 */
export async function getAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  debugMessage(`AgentOps.getAgent: start`);
  const agents = await findAgentById({ agentId, state });
  if (agents.length === 1) {
    const result = await _getAgentByTypeAndId({
      agentType: agents[0]._type,
      agentId: agents[0]._id,
      state,
    });
    debugMessage(`AgentOps.getAgent: end`);
    return result;
  } else if (agents.length === 0) {
    throw new Error(`Agent '${agentId}' not found`);
  } else {
    throw new Error(`${agents.length} agents '${agentId}' found`);
  }
}

/**
 * Get agent by type and id
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
 * @param {string} agentId agent id/name
 * @returns {Promise} a promise that resolves to an agent object
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
  debugMessage(`AgentOps.getAgentByTypeAndId: start`);
  const result = await _getAgentByTypeAndId({ agentType, agentId, state });
  debugMessage(`AgentOps.getAgentByTypeAndId: start`);
  return result;
}

/**
 * Get identity gateway agents
 * @returns {Promise} a promise that resolves to an array of IdentityGatewayAgent objects
 */
export async function getIdentityGatewayAgents({ state }: { state: State }) {
  debugMessage(`AgentOps.getIdentityGatewayAgents: start`);
  const { result } = await getAgentsByType({ agentType: AGENT_TYPE_IG, state });
  debugMessage(`AgentOps.getIdentityGatewayAgents: end`);
  return result;
}

/**
 * Get identity gateway agent
 * @param {string} gatewayId gateway id
 * @returns {Promise} a promise that resolves to an object containing an IdentityGatewayAgent object
 */
export async function getIdentityGatewayAgent({
  gatewayId,
  state,
}: {
  gatewayId: string;
  state: State;
}) {
  debugMessage(`AgentOps.getIdentityGatewayAgent: start`);
  const result = await getAgentByTypeAndId({
    agentType: AGENT_TYPE_IG,
    agentId: gatewayId,
    state,
  });
  debugMessage(`AgentOps.getIdentityGatewayAgent: end`);
  return result;
}

/**
 * Put identity gateway agent
 * @param {string} gatewayId gateway id
 * @param {Object} gatewayData IdentityGatewayAgent object
 * @returns {Promise} a promise that resolves to an object containing an IdentityGatewayAgent object
 */
export async function putIdentityGatewayAgent({
  gatewayId,
  gatewayData,
  state,
}: {
  gatewayId: string;
  gatewayData: AgentSkeleton;
  state: State;
}) {
  debugMessage(`AgentOps.putIdentityGatewayAgent: start`);
  const result = await putAgentByTypeAndId({
    agentType: AGENT_TYPE_IG,
    agentId: gatewayId,
    agentData: gatewayData,
    state,
  });
  debugMessage(`AgentOps.putIdentityGatewayAgent: end`);
  return result;
}

/**
 * Get java agents
 * @returns {Promise} a promise that resolves to an array of J2EEAgent objects
 */
export async function getJavaAgents({ state }: { state: State }) {
  debugMessage(`AgentOps.getJavaAgents: start`);
  const { result } = await getAgentsByType({
    agentType: AGENT_TYPE_JAVA,
    state,
  });
  debugMessage(`AgentOps.getJavaAgents: end`);
  return result;
}

/**
 * Get java agent
 * @param {string} agentId java agent id
 * @returns {Promise} a promise that resolves to an object containing an J2EEAgent object
 */
export async function getJavaAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  debugMessage(`AgentOps.getJavaAgent: start`);
  const result = await getAgentByTypeAndId({
    agentType: AGENT_TYPE_JAVA,
    agentId,
    state,
  });
  debugMessage(`AgentOps.getJavaAgent: end`);
  return result;
}

/**
 * Put java agent
 * @param {string} agentId java agent id
 * @param {Object} agentData java agent object
 * @returns {Promise} a promise that resolves to an object containing an java agent object
 */
export async function putJavaAgent({
  agentId,
  agentData,
  state,
}: {
  agentId: string;
  agentData: AgentSkeleton;
  state: State;
}) {
  debugMessage(`AgentOps.putJavaAgent: start`);
  const result = await putAgentByTypeAndId({
    agentType: AGENT_TYPE_JAVA,
    agentId,
    agentData,
    state,
  });
  debugMessage(`AgentOps.putJavaAgent: end`);
  return result;
}

/**
 * Get web agents
 * @returns {Promise} a promise that resolves to an array of WebAgent objects
 */
export async function getWebAgents({ state }: { state: State }) {
  debugMessage(`AgentOps.getWebAgents: start`);
  const { result } = await getAgentsByType({
    agentType: AGENT_TYPE_WEB,
    state,
  });
  debugMessage(`AgentOps.getWebAgents: end`);
  return result;
}

/**
 * Get web agent
 * @param {string} agentId web agent id
 * @returns {Promise} a promise that resolves to an object containing an WebAgent object
 */
export async function getWebAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  debugMessage(`AgentOps.getWebAgent: start`);
  const result = await getAgentByTypeAndId({
    agentType: AGENT_TYPE_WEB,
    agentId,
    state,
  });
  debugMessage(`AgentOps.getWebAgent: end`);
  return result;
}

/**
 * Put web agent
 * @param {string} agentId web agent id
 * @param {Object} agentData WebAgent object
 * @returns {Promise} a promise that resolves to an object containing an WebAgent object
 */
export async function putWebAgent({
  agentId,
  agentData,
  state,
}: {
  agentId: string;
  agentData: AgentSkeleton;
  state: State;
}) {
  debugMessage(`AgentOps.putWebAgent: start`);
  const result = await putAgentByTypeAndId({
    agentType: AGENT_TYPE_WEB,
    agentId,
    agentData,
    state,
  });
  debugMessage(`AgentOps.putWebAgent: end`);
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
  debugMessage(`AgentOps.exportAgents: start`);
  const exportData = createAgentExportTemplate();
  const agents = await getAgents({ state });
  for (const agent of agents) {
    exportData.agents[agent._id] = agent;
  }
  debugMessage(`AgentOps.exportAgents: end`);
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
  debugMessage(`AgentOps.exportIdentityGatewayAgents: start`);
  const exportData = createAgentExportTemplate();
  const agents = await getIdentityGatewayAgents({ state });
  for (const agent of agents) {
    exportData.agents[agent._id] = agent;
  }
  debugMessage(`AgentOps.exportIdentityGatewayAgents: end`);
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
  debugMessage(`AgentOps.exportJavaAgents: start`);
  const exportData = createAgentExportTemplate();
  const agents = await getJavaAgents({ state });
  for (const agent of agents) {
    exportData.agents[agent._id] = agent;
  }
  debugMessage(`AgentOps.exportJavaAgents: end`);
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
  debugMessage(`AgentOps.exportWebAgents: start`);
  const exportData = createAgentExportTemplate();
  const agents = await getWebAgents({ state });
  for (const agent of agents) {
    exportData.agents[agent._id] = agent;
  }
  debugMessage(`AgentOps.exportWebAgents: end`);
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
  debugMessage(`AgentOps.exportAgent: start`);
  const exportData = createAgentExportTemplate();
  const agentObject = await getAgent({ agentId, state });
  exportData.agents[agentId] = agentObject;
  debugMessage(`AgentOps.exportAgent: end`);
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
  debugMessage(`AgentOps.exportIdentityGatewayAgent: start`);
  const exportData = createAgentExportTemplate();
  const agentObject = await getIdentityGatewayAgent({
    gatewayId: agentId,
    state,
  });
  exportData.agents[agentId] = agentObject;
  debugMessage(`AgentOps.exportIdentityGatewayAgent: end`);
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
  debugMessage(`AgentOps.exportJavaAgent: start`);
  const exportData = createAgentExportTemplate();
  const agentObject = await getJavaAgent({ agentId, state });
  exportData.agents[agentId] = agentObject;
  debugMessage(`AgentOps.exportJavaAgent: end`);
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
  debugMessage(`AgentOps.exportWebAgent: start`);
  const exportData = createAgentExportTemplate();
  const agentObject = await getWebAgent({ agentId, state });
  exportData.agents[agentId] = agentObject;
  debugMessage(`AgentOps.exportWebAgent: end`);
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
  debugMessage(`AgentOps.importAgents: start`);
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id;
      debugMessage(`AgentOps.importAgents: ${agentId} [${agentType}]`);
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
  debugMessage(`AgentOps.importAgents: end`);
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
  debugMessage(`AgentOps.importIdentityGatewayAgents: start`);
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id;
      if (agentType !== AGENT_TYPE_IG)
        throw new Error(
          `Wrong agent type! Expected '${AGENT_TYPE_IG}' but got '${agentType}'.`
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
  debugMessage(`AgentOps.importIdentityGatewayAgents: end`);
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
  debugMessage(`AgentOps.importJavaAgents: start`);
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id;
      if (agentType !== AGENT_TYPE_JAVA)
        throw new Error(
          `Wrong agent type! Expected '${AGENT_TYPE_JAVA}' but got '${agentType}'.`
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
  debugMessage(`AgentOps.importJavaAgents: end`);
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
  debugMessage(`AgentOps.importWebAgents: start`);
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id;
      if (agentType !== AGENT_TYPE_WEB)
        throw new Error(
          `Wrong agent type! Expected '${AGENT_TYPE_WEB}' but got '${agentType}'.`
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
  debugMessage(`AgentOps.importWebAgents: end`);
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
  debugMessage(`AgentOps.importAgent: start`);
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id;
    const result = await putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agents[agentId],
      state,
    });
    debugMessage(`AgentOps.importAgent: end`);
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
  debugMessage(`AgentOps.importIdentityGatewayAgent: start`);
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id;
    if (agentType !== AGENT_TYPE_IG)
      throw new Error(
        `Wrong agent type! Expected '${AGENT_TYPE_IG}' but got '${agentType}'.`
      );
    const result = await putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agents[agentId],
      state,
    });
    debugMessage(`AgentOps.importIdentityGatewayAgent: end`);
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
  debugMessage(`AgentOps.importJavaAgent: start`);
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id;
    if (agentType !== AGENT_TYPE_JAVA)
      throw new Error(
        `Wrong agent type! Expected '${AGENT_TYPE_JAVA}' but got '${agentType}'.`
      );
    const result = await putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agents[agentId],
      state,
    });
    debugMessage(`AgentOps.importJavaAgent: end`);
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
  debugMessage(`AgentOps.importWebAgent: start`);
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id;
    if (agentType !== AGENT_TYPE_WEB)
      throw new Error(
        `Wrong agent type! Expected '${AGENT_TYPE_WEB}' but got '${agentType}'.`
      );
    const result = await putAgentByTypeAndId({
      agentType,
      agentId,
      agentData: importData.agents[agentId],
      state,
    });
    debugMessage(`AgentOps.importWebAgent: end`);
    return result;
  } else {
    throw new Error('Invalid meta data.');
  }
}

/**
 * Delete all agents
 */
export async function deleteAgents({ state }: { state: State }) {
  debugMessage(`AgentOps.deleteAgents: start`);
  const agents = await getAgents({ state });
  for (const agent of agents) {
    debugMessage(`AgentOps.deleteAgent: '${agent['_id']}'`);
    await deleteAgentByTypeAndId({
      agentType: agent['_type']['_id'],
      agentId: agent['_id'],
      state,
    });
  }
  debugMessage(`AgentOps.deleteAgents: end`);
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
  debugMessage(`AgentOps.deleteAgent: start`);
  const agents = await findAgentById({ agentId, state });
  if (agents.length) {
    for (const agent of agents) {
      debugMessage(`AgentOps.deleteAgent: '${agent['_id']}'`);
      await deleteAgentByTypeAndId({
        agentType: agent['_type'],
        agentId: agent['_id'],
        state,
      });
    }
  } else {
    throw new Error(`Agent '${agentId}' not found!`);
  }
  debugMessage(`AgentOps.deleteAgent: end`);
}

/**
 * Delete all identity gateway agents
 */
export async function deleteIdentityGatewayAgents({ state }: { state: State }) {
  debugMessage(`AgentOps.deleteIdentityGatewayAgents: start`);
  const agents = await getIdentityGatewayAgents({ state });
  for (const agent of agents) {
    debugMessage(`AgentOps.deleteIdentityGatewayAgent: '${agent['_id']}'`);
    await deleteAgentByTypeAndId({
      agentType: agent['_type']['_id'],
      agentId: agent['_id'],
      state,
    });
  }
  debugMessage(`AgentOps.deleteIdentityGatewayAgents: end`);
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
  debugMessage(`AgentOps.deleteIdentityGatewayAgent: start`);
  const agents = await findAgentByTypeAndId({
    agentType: AGENT_TYPE_IG,
    agentId,
    state,
  });
  if (agents.length) {
    for (const agent of agents) {
      debugMessage(`AgentOps.deleteIdentityGatewayAgent: '${agent['_id']}'`);
      await deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'],
        agentId: agent['_id'],
        state,
      });
    }
  } else {
    throw new Error(`Identity gateway agent '${agentId}' not found!`);
  }
  debugMessage(`AgentOps.deleteIdentityGatewayAgent: end`);
}

/**
 * Delete all java agents
 */
export async function deleteJavaAgents({ state }: { state: State }) {
  debugMessage(`AgentOps.deleteJavaAgents: start`);
  const agents = await getJavaAgents({ state });
  for (const agent of agents) {
    debugMessage(`AgentOps.deleteJavaAgent: '${agent['_id']}'`);
    await deleteAgentByTypeAndId({
      agentType: agent['_type']['_id'],
      agentId: agent['_id'],
      state,
    });
  }
  debugMessage(`AgentOps.deleteJavaAgents: end`);
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
  debugMessage(`AgentOps.deleteJavaAgent: start`);
  const agents = await findAgentByTypeAndId({
    agentType: AGENT_TYPE_JAVA,
    agentId,
    state,
  });
  if (agents.length) {
    for (const agent of agents) {
      debugMessage(`AgentOps.deleteJavaAgent: '${agent['_id']}'`);
      await deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'],
        agentId: agent['_id'],
        state,
      });
    }
  } else {
    throw new Error(`Java agent '${agentId}' not found!`);
  }
  debugMessage(`AgentOps.deleteJavaAgent: end`);
}

/**
 * Delete all web agents
 */
export async function deleteWebAgents({ state }: { state: State }) {
  debugMessage(`AgentOps.deleteWebAgents: start`);
  const agents = await getWebAgents({ state });
  for (const agent of agents) {
    debugMessage(`AgentOps.deleteWebAgent: '${agent['_id']}'`);
    await deleteAgentByTypeAndId({
      agentType: agent['_type']['_id'],
      agentId: agent['_id'],
      state,
    });
  }
  debugMessage(`AgentOps.deleteWebAgents: end`);
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
  debugMessage(`AgentOps.deleteWebAgent: start`);
  const agents = await findAgentByTypeAndId({
    agentType: AGENT_TYPE_WEB,
    agentId,
    state,
  });
  if (agents.length) {
    for (const agent of agents) {
      debugMessage(`AgentOps.deleteWebAgent: '${agent['_id']}'`);
      await deleteAgentByTypeAndId({
        agentType: agent['_type']['_id'],
        agentId: agent['_id'],
        state,
      });
    }
  } else {
    throw new Error(`Web agent '${agentId}' not found!`);
  }
  debugMessage(`AgentOps.deleteWebAgent: end`);
}
