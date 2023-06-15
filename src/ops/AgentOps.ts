import { debugMessage, printMessage } from './utils/Console';
import {
  getAgentsByType,
  getAgentByTypeAndId as _getAgentByTypeAndId,
  putAgentByTypeAndId,
  findAgentById,
  deleteAgentByTypeAndId,
  findAgentByTypeAndId,
} from '../api/AgentApi';
import { AgentSkeleton, AgentType } from '../api/ApiTypes';
import { AgentExportInterface } from './OpsTypes';
import { validateImport } from './utils/ExportImportUtils';
import State from '../shared/State';

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
  async getAgentByTypeAndId(agentType: AgentType, agentId: string) {
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
 * @returns {Promise} a promise that resolves to an agent object
 */
export async function getAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
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
 * @param {string} agentType agent type (IdentityGatewayAgent, J2EEAgent, WebAgent)
 * @param {string} agentId agent id/name
 * @returns {Promise} a promise that resolves to an agent object
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
  debugMessage({ message: `AgentOps.getAgentByTypeAndId: start`, state });
  const result = await _getAgentByTypeAndId({ agentType, agentId, state });
  debugMessage({ message: `AgentOps.getAgentByTypeAndId: start`, state });
  return result;
}

/**
 * Get identity gateway agents
 * @returns {Promise} a promise that resolves to an array of IdentityGatewayAgent objects
 */
export async function getIdentityGatewayAgents({ state }: { state: State }) {
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
 * @returns {Promise} a promise that resolves to an object containing an IdentityGatewayAgent object
 */
export async function getIdentityGatewayAgent({
  gatewayId,
  state,
}: {
  gatewayId: string;
  state: State;
}) {
  debugMessage({ message: `AgentOps.getIdentityGatewayAgent: start`, state });
  const result = await getAgentByTypeAndId({
    agentType: 'IdentityGatewayAgent',
    agentId: gatewayId,
    state,
  });
  debugMessage({ message: `AgentOps.getIdentityGatewayAgent: end`, state });
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
 * @returns {Promise} a promise that resolves to an array of J2EEAgent objects
 */
export async function getJavaAgents({ state }: { state: State }) {
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
export async function getJavaAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  debugMessage({ message: `AgentOps.getJavaAgent: start`, state });
  const result = await getAgentByTypeAndId({
    agentType: 'J2EEAgent',
    agentId,
    state,
  });
  debugMessage({ message: `AgentOps.getJavaAgent: end`, state });
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
export async function getWebAgents({ state }: { state: State }) {
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
export async function getWebAgent({
  agentId,
  state,
}: {
  agentId: string;
  state: State;
}) {
  debugMessage({ message: `AgentOps.getWebAgent: start`, state });
  const result = await getAgentByTypeAndId({
    agentType: 'WebAgent',
    agentId,
    state,
  });
  debugMessage({ message: `AgentOps.getWebAgent: end`, state });
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
  const agents = await getAgents({ state });
  for (const agent of agents) {
    exportData.agents[agent._id] = agent;
  }
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
  const agents = await getIdentityGatewayAgents({ state });
  for (const agent of agents) {
    exportData.agents[agent._id] = agent;
  }
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
  const agents = await getJavaAgents({ state });
  for (const agent of agents) {
    exportData.agents[agent._id] = agent;
  }
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
  const agents = await getWebAgents({ state });
  for (const agent of agents) {
    exportData.agents[agent._id] = agent;
  }
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
  const agentObject = await getAgent({ agentId, state });
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
  const agentObject = await getIdentityGatewayAgent({
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
  const agentObject = await getJavaAgent({ agentId, state });
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
  const agentObject = await getWebAgent({ agentId, state });
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
  const agents = await getAgents({ state });
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
  const agents = await getIdentityGatewayAgents({ state });
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
  const agents = await getJavaAgents({ state });
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
  const agents = await getWebAgents({ state });
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
