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

export const AGENT_TYPE_IG = 'IdentityGatewayAgent';
export const AGENT_TYPE_JAVA = 'J2EEAgent';
export const AGENT_TYPE_WEB = 'WebAgent';

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
export async function getAgents(): Promise<AgentSkeleton[]> {
  debugMessage(`AgentOps.getAgents: start`);
  let agents = [];
  try {
    const resolved = await Promise.all([
      getAgentsByType('IdentityGatewayAgent'),
      getAgentsByType('J2EEAgent'),
      getAgentsByType('WebAgent'),
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
export async function getAgent(agentId) {
  debugMessage(`AgentOps.getAgent: start`);
  const agents = await findAgentById(agentId);
  if (agents.length === 1) {
    const result = await _getAgentByTypeAndId(agents[0]._type, agents[0]._id);
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
export async function getAgentByTypeAndId(agentType, agentId) {
  debugMessage(`AgentOps.getAgentByTypeAndId: start`);
  const result = await _getAgentByTypeAndId(agentType, agentId);
  debugMessage(`AgentOps.getAgentByTypeAndId: start`);
  return result;
}

/**
 * Get identity gateway agents
 * @returns {Promise} a promise that resolves to an array of IdentityGatewayAgent objects
 */
export async function getIdentityGatewayAgents() {
  debugMessage(`AgentOps.getIdentityGatewayAgents: start`);
  const { result } = await getAgentsByType(AGENT_TYPE_IG);
  debugMessage(`AgentOps.getIdentityGatewayAgents: end`);
  return result;
}

/**
 * Get identity gateway agent
 * @param {string} gatewayId gateway id
 * @returns {Promise} a promise that resolves to an object containing an IdentityGatewayAgent object
 */
export async function getIdentityGatewayAgent(gatewayId: string) {
  debugMessage(`AgentOps.getIdentityGatewayAgent: start`);
  const result = await getAgentByTypeAndId(AGENT_TYPE_IG, gatewayId);
  debugMessage(`AgentOps.getIdentityGatewayAgent: end`);
  return result;
}

/**
 * Put identity gateway agent
 * @param {string} gatewayId gateway id
 * @param {Object} gatewayData IdentityGatewayAgent object
 * @returns {Promise} a promise that resolves to an object containing an IdentityGatewayAgent object
 */
export async function putIdentityGatewayAgent(gatewayId: string, gatewayData) {
  debugMessage(`AgentOps.putIdentityGatewayAgent: start`);
  const result = await putAgentByTypeAndId(
    AGENT_TYPE_IG,
    gatewayId,
    gatewayData
  );
  debugMessage(`AgentOps.putIdentityGatewayAgent: end`);
  return result;
}

/**
 * Get java agents
 * @returns {Promise} a promise that resolves to an array of J2EEAgent objects
 */
export async function getJavaAgents() {
  debugMessage(`AgentOps.getJavaAgents: start`);
  const { result } = await getAgentsByType(AGENT_TYPE_JAVA);
  debugMessage(`AgentOps.getJavaAgents: end`);
  return result;
}

/**
 * Get java agent
 * @param {string} agentId java agent id
 * @returns {Promise} a promise that resolves to an object containing an J2EEAgent object
 */
export async function getJavaAgent(agentId: string) {
  debugMessage(`AgentOps.getJavaAgent: start`);
  const result = await getAgentByTypeAndId(AGENT_TYPE_JAVA, agentId);
  debugMessage(`AgentOps.getJavaAgent: end`);
  return result;
}

/**
 * Put java agent
 * @param {string} agentId java agent id
 * @param {Object} agentData java agent object
 * @returns {Promise} a promise that resolves to an object containing an java agent object
 */
export async function putJavaAgent(agentId: string, agentData) {
  debugMessage(`AgentOps.putJavaAgent: start`);
  const result = await putAgentByTypeAndId(AGENT_TYPE_JAVA, agentId, agentData);
  debugMessage(`AgentOps.putJavaAgent: end`);
  return result;
}

/**
 * Get web agents
 * @returns {Promise} a promise that resolves to an array of WebAgent objects
 */
export async function getWebAgents() {
  debugMessage(`AgentOps.getWebAgents: start`);
  const { result } = await getAgentsByType(AGENT_TYPE_WEB);
  debugMessage(`AgentOps.getWebAgents: end`);
  return result;
}

/**
 * Get web agent
 * @param {string} agentId web agent id
 * @returns {Promise} a promise that resolves to an object containing an WebAgent object
 */
export async function getWebAgent(agentId: string) {
  debugMessage(`AgentOps.getWebAgent: start`);
  const result = await getAgentByTypeAndId(AGENT_TYPE_WEB, agentId);
  debugMessage(`AgentOps.getWebAgent: end`);
  return result;
}

/**
 * Put web agent
 * @param {string} agentId web agent id
 * @param {Object} agentData WebAgent object
 * @returns {Promise} a promise that resolves to an object containing an WebAgent object
 */
export async function putWebAgent(agentId: string, agentData) {
  debugMessage(`AgentOps.putWebAgent: start`);
  const result = await putAgentByTypeAndId(AGENT_TYPE_WEB, agentId, agentData);
  debugMessage(`AgentOps.putWebAgent: end`);
  return result;
}

/**
 * Export all agents. The response can be saved to file as is.
 * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
 */
export async function exportAgents(): Promise<AgentExportInterface> {
  debugMessage(`AgentOps.exportAgents: start`);
  const exportData = createAgentExportTemplate();
  const agents = await getAgents();
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
export async function exportIdentityGatewayAgents(): Promise<AgentExportInterface> {
  debugMessage(`AgentOps.exportIdentityGatewayAgents: start`);
  const exportData = createAgentExportTemplate();
  const agents = await getIdentityGatewayAgents();
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
export async function exportJavaAgents(): Promise<AgentExportInterface> {
  debugMessage(`AgentOps.exportJavaAgents: start`);
  const exportData = createAgentExportTemplate();
  const agents = await getJavaAgents();
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
export async function exportWebAgents(): Promise<AgentExportInterface> {
  debugMessage(`AgentOps.exportWebAgents: start`);
  const exportData = createAgentExportTemplate();
  const agents = await getWebAgents();
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
export async function exportAgent(agentId): Promise<AgentExportInterface> {
  debugMessage(`AgentOps.exportAgent: start`);
  const exportData = createAgentExportTemplate();
  const agentObject = await getAgent(agentId);
  exportData.agents[agentId] = agentObject;
  debugMessage(`AgentOps.exportAgent: end`);
  return exportData;
}

/**
 * Export identity gateway agent. The response can be saved to file as is.
 * @param agentId agent id/name
 * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
 */
export async function exportIdentityGatewayAgent(
  agentId
): Promise<AgentExportInterface> {
  debugMessage(`AgentOps.exportIdentityGatewayAgent: start`);
  const exportData = createAgentExportTemplate();
  const agentObject = await getIdentityGatewayAgent(agentId);
  exportData.agents[agentId] = agentObject;
  debugMessage(`AgentOps.exportIdentityGatewayAgent: end`);
  return exportData;
}

/**
 * Export java agent. The response can be saved to file as is.
 * @param agentId agent id/name
 * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
 */
export async function exportJavaAgent(agentId): Promise<AgentExportInterface> {
  debugMessage(`AgentOps.exportJavaAgent: start`);
  const exportData = createAgentExportTemplate();
  const agentObject = await getJavaAgent(agentId);
  exportData.agents[agentId] = agentObject;
  debugMessage(`AgentOps.exportJavaAgent: end`);
  return exportData;
}

/**
 * Export web agent. The response can be saved to file as is.
 * @param agentId agent id/name
 * @returns {Promise<AgentExportInterface} Promise resolving to an AgentExportInterface object.
 */
export async function exportWebAgent(agentId): Promise<AgentExportInterface> {
  debugMessage(`AgentOps.exportWebAgent: start`);
  const exportData = createAgentExportTemplate();
  const agentObject = await getWebAgent(agentId);
  exportData.agents[agentId] = agentObject;
  debugMessage(`AgentOps.exportWebAgent: end`);
  return exportData;
}

/**
 * Import agents. The import data is usually read from an agent export file.
 * @param {AgentExportInterface} importData agent import data.
 */
export async function importAgents(
  importData: AgentExportInterface
): Promise<void> {
  debugMessage(`AgentOps.importAgents: start`);
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id;
      debugMessage(`AgentOps.importAgents: ${agentId} [${agentType}]`);
      await putAgentByTypeAndId(agentType, agentId, importData.agents[agentId]);
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
export async function importIdentityGatewayAgents(
  importData: AgentExportInterface
): Promise<void> {
  debugMessage(`AgentOps.importIdentityGatewayAgents: start`);
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id;
      if (agentType !== AGENT_TYPE_IG)
        throw new Error(
          `Wrong agent type! Expected '${AGENT_TYPE_IG}' but got '${agentType}'.`
        );
      await putAgentByTypeAndId(agentType, agentId, importData.agents[agentId]);
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
export async function importJavaAgents(
  importData: AgentExportInterface
): Promise<void> {
  debugMessage(`AgentOps.importJavaAgents: start`);
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id;
      if (agentType !== AGENT_TYPE_JAVA)
        throw new Error(
          `Wrong agent type! Expected '${AGENT_TYPE_JAVA}' but got '${agentType}'.`
        );
      await putAgentByTypeAndId(agentType, agentId, importData.agents[agentId]);
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
export async function importWebAgents(
  importData: AgentExportInterface
): Promise<void> {
  debugMessage(`AgentOps.importWebAgents: start`);
  if (validateImport(importData.meta)) {
    for (const agentId of Object.keys(importData.agents)) {
      const agentType = importData.agents[agentId]._type._id;
      if (agentType !== AGENT_TYPE_WEB)
        throw new Error(
          `Wrong agent type! Expected '${AGENT_TYPE_WEB}' but got '${agentType}'.`
        );
      await putAgentByTypeAndId(agentType, agentId, importData.agents[agentId]);
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
export async function importAgent(agentId, importData: AgentExportInterface) {
  debugMessage(`AgentOps.importAgent: start`);
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id;
    const result = await putAgentByTypeAndId(
      agentType,
      agentId,
      importData.agents[agentId]
    );
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
export async function importIdentityGatewayAgent(
  agentId,
  importData: AgentExportInterface
) {
  debugMessage(`AgentOps.importIdentityGatewayAgent: start`);
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id;
    if (agentType !== AGENT_TYPE_IG)
      throw new Error(
        `Wrong agent type! Expected '${AGENT_TYPE_IG}' but got '${agentType}'.`
      );
    const result = await putAgentByTypeAndId(
      agentType,
      agentId,
      importData.agents[agentId]
    );
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
export async function importJavaAgent(
  agentId,
  importData: AgentExportInterface
) {
  debugMessage(`AgentOps.importJavaAgent: start`);
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id;
    if (agentType !== AGENT_TYPE_JAVA)
      throw new Error(
        `Wrong agent type! Expected '${AGENT_TYPE_JAVA}' but got '${agentType}'.`
      );
    const result = await putAgentByTypeAndId(
      agentType,
      agentId,
      importData.agents[agentId]
    );
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
export async function importWebAgent(
  agentId,
  importData: AgentExportInterface
) {
  debugMessage(`AgentOps.importWebAgent: start`);
  if (validateImport(importData.meta)) {
    const agentType = importData.agents[agentId]?._type._id;
    if (agentType !== AGENT_TYPE_WEB)
      throw new Error(
        `Wrong agent type! Expected '${AGENT_TYPE_WEB}' but got '${agentType}'.`
      );
    const result = await putAgentByTypeAndId(
      agentType,
      agentId,
      importData.agents[agentId]
    );
    debugMessage(`AgentOps.importWebAgent: end`);
    return result;
  } else {
    throw new Error('Invalid meta data.');
  }
}

/**
 * Delete all agents
 */
export async function deleteAgents() {
  debugMessage(`AgentOps.deleteAgents: start`);
  const agents = await getAgents();
  for (const agent of agents) {
    debugMessage(`AgentOps.deleteAgent: '${agent['_id']}'`);
    await deleteAgentByTypeAndId(agent['_type']['_id'], agent['_id']);
  }
  debugMessage(`AgentOps.deleteAgents: end`);
}

/**
 * Delete agent
 * @param agentId agent id/name
 */
export async function deleteAgent(agentId: string) {
  debugMessage(`AgentOps.deleteAgent: start`);
  const agents = await findAgentById(agentId);
  if (agents.length) {
    for (const agent of agents) {
      debugMessage(`AgentOps.deleteAgent: '${agent['_id']}'`);
      await deleteAgentByTypeAndId(agent['_type'], agent['_id']);
    }
  } else {
    throw new Error(`Agent '${agentId}' not found!`);
  }
  debugMessage(`AgentOps.deleteAgent: end`);
}

/**
 * Delete all identity gateway agents
 */
export async function deleteIdentityGatewayAgents() {
  debugMessage(`AgentOps.deleteIdentityGatewayAgents: start`);
  const agents = await getIdentityGatewayAgents();
  for (const agent of agents) {
    debugMessage(`AgentOps.deleteIdentityGatewayAgent: '${agent['_id']}'`);
    await deleteAgentByTypeAndId(agent['_type']['_id'], agent['_id']);
  }
  debugMessage(`AgentOps.deleteIdentityGatewayAgents: end`);
}

/**
 * Delete identity gateway agent
 * @param agentId agent id/name
 */
export async function deleteIdentityGatewayAgent(agentId: string) {
  debugMessage(`AgentOps.deleteIdentityGatewayAgent: start`);
  const agents = await findAgentByTypeAndId(AGENT_TYPE_IG, agentId);
  if (agents.length) {
    for (const agent of agents) {
      debugMessage(`AgentOps.deleteIdentityGatewayAgent: '${agent['_id']}'`);
      await deleteAgentByTypeAndId(agent['_type']['_id'], agent['_id']);
    }
  } else {
    throw new Error(`Identity gateway agent '${agentId}' not found!`);
  }
  debugMessage(`AgentOps.deleteIdentityGatewayAgent: end`);
}

/**
 * Delete all java agents
 */
export async function deleteJavaAgents() {
  debugMessage(`AgentOps.deleteJavaAgents: start`);
  const agents = await getJavaAgents();
  for (const agent of agents) {
    debugMessage(`AgentOps.deleteJavaAgent: '${agent['_id']}'`);
    await deleteAgentByTypeAndId(agent['_type']['_id'], agent['_id']);
  }
  debugMessage(`AgentOps.deleteJavaAgents: end`);
}

/**
 * Delete java agent
 * @param agentId agent id/name
 */
export async function deleteJavaAgent(agentId: string) {
  debugMessage(`AgentOps.deleteJavaAgent: start`);
  const agents = await findAgentByTypeAndId(AGENT_TYPE_JAVA, agentId);
  if (agents.length) {
    for (const agent of agents) {
      debugMessage(`AgentOps.deleteJavaAgent: '${agent['_id']}'`);
      await deleteAgentByTypeAndId(agent['_type']['_id'], agent['_id']);
    }
  } else {
    throw new Error(`Java agent '${agentId}' not found!`);
  }
  debugMessage(`AgentOps.deleteJavaAgent: end`);
}

/**
 * Delete all web agents
 */
export async function deleteWebAgents() {
  debugMessage(`AgentOps.deleteWebAgents: start`);
  const agents = await getWebAgents();
  for (const agent of agents) {
    debugMessage(`AgentOps.deleteWebAgent: '${agent['_id']}'`);
    await deleteAgentByTypeAndId(agent['_type']['_id'], agent['_id']);
  }
  debugMessage(`AgentOps.deleteWebAgents: end`);
}

/**
 * Delete web agent
 * @param agentId agent id/name
 */
export async function deleteWebAgent(agentId: string) {
  debugMessage(`AgentOps.deleteWebAgent: start`);
  const agents = await findAgentByTypeAndId(AGENT_TYPE_WEB, agentId);
  if (agents.length) {
    for (const agent of agents) {
      debugMessage(`AgentOps.deleteWebAgent: '${agent['_id']}'`);
      await deleteAgentByTypeAndId(agent['_type']['_id'], agent['_id']);
    }
  } else {
    throw new Error(`Web agent '${agentId}' not found!`);
  }
  debugMessage(`AgentOps.deleteWebAgent: end`);
}
