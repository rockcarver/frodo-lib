import {
  getSodPolicy,
  putPolicy,
  createPolicy as _createPolicy,
  queryPolicies,
  deletePolicy as _deletePolicy,
  PolicySkeleton,
} from '../../../api/cloud/iga/IgaSodPolicyApi';
import { readPolicyRule } from './IgaSodPolicyRuleOps';
import { State } from '../../../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../../../utils/Console';
import { getMetadata, getResult } from '../../../utils/ExportImportUtils';
import { FrodoError } from '../../FrodoError';
import { ExportMetaData, ResultCallback } from '../../OpsTypes';

export type SodPolicy = {
  /**
   * Create policy
   * @param {PolicySkeleton} policyData the policy object
   * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
   */
  createPolicy(policyData: PolicySkeleton): Promise<PolicySkeleton>;
  /**
   * Read policy
   * @param {string} id the policy id
   * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
   */
  readPolicy(id: string): Promise<PolicySkeleton>;
  /**
   * Read policy by its display name
   * @param {string} name the policy display name
   * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
   */
  readPolicyByName(name: string): Promise<PolicySkeleton>;
  /**
   * Read all policies
   * @returns {Promise<PolicySkeleton[]>} a promise that resolves to an array of policy objects
   */
  readPolicies(): Promise<PolicySkeleton[]>;
  /**
   * Export policy
   * @param {string} id the policy id
   * @returns {Promise<PolicyExportInterface>} a promise that resolves to a policy export object
   */
  exportPolicy(id: string): Promise<PolicyExportInterface>;
  /**
   * Export policy by its display name
   * @param {string} name the policy display name
   * @returns {Promise<PolicyExportInterface>} a promise that resolves to a policy export object
   */
  exportPoliciesByName(name: string): Promise<PolicyExportInterface>;
  /**
   * Export all policies
   * @returns {Promise<PolicyExportInterface>} a promise that resolves to a policy export object
   */
  exportPolicies(
    resultCallback?: ResultCallback<PolicyExportInterface>
  ): Promise<PolicyExportInterface>;
  /**
   * Update policy
   * @param {string} id the policy id
   * @param {PolicySkeleton} policyData the policy object
   * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
   */
  updatePolicies(
    id: string,
    policyData: PolicySkeleton
  ): Promise<PolicySkeleton>;
  /**
   * Import policies
   * @param {string} id The policy id. If supplied, only the policy of that id is imported. Takes priority over name if they are all provided.
   * @param {string} name The policy display name. If supplied, only the policy of that display name is imported.
   * @param {PolicyExportInterface} importData policy import data
   * @param {ResultCallback<PolicySkeleton>} resultCallback Optional callback to process individual results
   * @returns {Promise<PolicySkeleton[]>} the imported policies
   */
  importPolicy(
    importData: PolicyExportInterface,
    id?: string,
    name?: string,
    resultCallback?: ResultCallback<PolicySkeleton>
  ): Promise<PolicySkeleton[]>;
  /**
   * Delete policy
   * @param {string} id the policy id
   * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
   */
  deletePolicy(id: string): Promise<PolicySkeleton>;
  /**
   * Delete policy by its display name
   * @param {string} name the policy display name
   * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
   */
  deletePolicyByName(name: string): Promise<PolicySkeleton>;
};

export default (state: State): SodPolicy => {
  return {
    createPolicy(policyData: PolicySkeleton): Promise<PolicySkeleton> {
      return _createPolicy({
        policyData,
        state,
      });
    },
    readPolicy(id: string): Promise<PolicySkeleton> {
      return getSodPolicy({
        id,
        state,
      });
    },
    readPolicyByName(name: string): Promise<PolicySkeleton> {
      return readPolicyByName({
        name,
        state,
      });
    },
    readPolicies(): Promise<PolicySkeleton[]> {
      return readPolicies({
        state,
      });
    },

    exportPolicies(): Promise<PolicyExportInterface> {
      return exportPolicies({ state });
    },
    exportPolicy(id: string): Promise<PolicyExportInterface> {
      return exportPolicy({
        id,
        state,
      });
    },
    exportPoliciesByName(name: string): Promise<PolicyExportInterface> {
      return exportPoliciesByName({
        name,
        state,
      });
    },
    updatePolicies(
      id: string,
      policyData: PolicySkeleton
    ): Promise<PolicySkeleton> {
      return updatePolicies({
        id,
        policyData,
        state,
      });
    },
    importPolicy(
      importData: PolicyExportInterface,
      id?: string,
      name?: string,
      resultCallback: ResultCallback<PolicySkeleton> = void 0
    ): Promise<PolicySkeleton[]> {
      return importPolicy({
        id,
        name,
        importData,
        resultCallback,
        state,
      });
    },
    deletePolicy(id: string): Promise<PolicySkeleton> {
      return _deletePolicy({
        id,
        state,
      });
    },
    deletePolicyByName(name: string): Promise<PolicySkeleton> {
      return deletePolicyByName({
        name,
        state,
      });
    },
  };
};

export interface PolicyExportInterface {
  meta?: ExportMetaData;
  policy: Record<string, PolicySkeleton>;
}

/**
 * Create an empty policy export template
 * @returns {PolicyExportInterface} an empty policy export template
 */
export function createPolicyExportTemplate({
  state,
}: {
  state: State;
}): PolicyExportInterface {
  return {
    meta: getMetadata({ state }),
    policy: {},
  };
}

/**
 * Map Rule Names
 * @param {string} policy the policy that the policy rule is being mapped to
 *
 */
async function mapRuleNames({
  policy,
  state,
}: {
  policy: PolicySkeleton;
  state: State;
}): Promise<PolicySkeleton> {
  const names: string[] = [];
  for (const ruleId of policy.policyRuleIds) {
    const rule = await readPolicyRule({ id: ruleId, state });
    names.push(rule.name);
  }
  return { ...policy, policyRuleNames: names };
}
/**
 * Create policy
 * @param {PolicySkeleton} policyData the policy object
 * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
 */
export async function createPolicy({
  policyData,
  state,
}: {
  policyData: PolicySkeleton;
  state: State;
}): Promise<PolicySkeleton> {
  try {
    return await _createPolicy({ policyData, state });
  } catch (error) {
    throw new FrodoError(`Error creating policy ${policyData.name}`, error);
  }
}

/**
 * Read policy
 * @param {string} id the policy id
 * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
 */
export async function readPolicy({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<PolicySkeleton> {
  try {
    return await getSodPolicy({ id, state });
  } catch (error) {
    throw new FrodoError(`Error reading policy ${id}`, error);
  }
}

/**
 * Read policy by its  name
 * @param {string} name the policy  name
 * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
 */
export async function readPolicyByName({
  name,
  state,
}: {
  name: string;
  state: State;
}): Promise<PolicySkeleton> {
  try {
    const policies = await queryPolicies({
      queryFilter: `name eq "${name}"`,
      state,
    });
    if (policies.length !== 1) {
      throw new FrodoError(
        `Expected to find a single policy named '${name}', but ${policies.length} were found.`
      );
    }
    return policies[0];
  } catch (error) {
    throw new FrodoError(`Error reading policy ${name}`, error);
  }
}

/**
 * Read all policies
 * @returns {Promise<PolicySkeleton[]>} a promise that resolves to an array of policy objects
 */
export async function readPolicies({
  state,
}: {
  state: State;
}): Promise<PolicySkeleton[]> {
  try {
    return await queryPolicies({ state });
  } catch (error) {
    throw new FrodoError(`Error reading policies`, error);
  }
}

/**
 * Export policy
 * @param {string} id the policy id
 * @returns {Promise<PolicyExportInterface>} a promise that resolves to a policy export object
 */
export async function exportPolicy({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<PolicyExportInterface> {
  try {
    debugMessage({
      message: `IgaSodPolicyOps.exportPolicy: start`,
      state,
    });
    const exportData = createPolicyExportTemplate({ state });
    const policy = await mapRuleNames({
      policy: await readPolicy({ id, state }),
      state,
    });
    exportData.policy[policy.id] = policy;
    debugMessage({
      message: `IgaSodPolicyOps.exportPolicy: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting policy ${id}`, error);
  }
}
/**
 * Export policy by its display name
 * @param {string} name the policy display name
 * @returns {Promise<PolicyExportInterface>} a promise that resolves to a policy export object
 */
export async function exportPoliciesByName({
  name,
  state,
}: {
  name: string;
  state: State;
}): Promise<PolicyExportInterface> {
  try {
    debugMessage({
      message: `IgaSodPolicyOps.exportPoliciesByName: start`,
      state,
    });
    const exportData = createPolicyExportTemplate({ state });
    const policy = await mapRuleNames({
      policy: await readPolicyByName({ name, state }),
      state,
    });
    exportData.policy[policy.id] = policy;
    debugMessage({
      message: `IgaSodPolicyOps.exportPoliciesByName: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting policy ${name}`, error);
  }
}

/**
 * Export all policies
 * @returns {Promise<PolicyExportInterface>} a promise that resolves to a policy export object
 */
export async function exportPolicies({
  state,
}: {
  state: State;
}): Promise<PolicyExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `IgaSodPolicyOps.exportPolicies: start`,
      state,
    });
    const exportData = createPolicyExportTemplate({ state });
    const policies = await readPolicies({ state });
    indicatorId = createProgressIndicator({
      total: policies.length,
      message: 'Exporting policy...',
      state,
    });
    for (const policy of policies) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting policy ${policy.name}...`,
        state,
      });
      exportData.policy[policy.id] = await mapRuleNames({ policy, state });
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${policies.length} policies`,
      status: 'success',
      state,
    });
    debugMessage({
      message: `IgaSodPolicyOps.exportPolicies: end`,
      state,
    });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting policies`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting policies`, error);
  }
}
/**
 * Update policy
 * @param {string} id the policyid
 * @param {PolicySkeleton} policyData the policy object
 * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
 */
export async function updatePolicies({
  id,
  policyData,
  state,
}: {
  id: string;
  policyData: PolicySkeleton;
  state: State;
}): Promise<PolicySkeleton> {
  try {
    return await putPolicy({
      id,
      policyData,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error updating policy '${id}'`, error);
  }
}

/**
 * Import policies
 * @param {string} id The policy id. If supplied, only the policy of that id is imported. Takes priority over name if they are all provided.
 * @param {string} name The policy display name. If supplied, only the policy of that display name is imported.
 * @param {PolicyExportInterface} importData policy import data
 * @param {ResultCallback<PolicySkeleton>} resultCallback Optional callback to process individual results
 * @returns {Promise<PolicySkeleton[]>} the imported policies
 */
export async function importPolicy({
  id,
  name,
  importData,
  resultCallback = void 0,
  state,
}: {
  id?: string;
  name?: string;
  importData: PolicyExportInterface;
  resultCallback?: ResultCallback<PolicySkeleton>;
  state: State;
}): Promise<PolicySkeleton[]> {
  debugMessage({
    message: `IgaSodPolicyOps.importPolicy: start`,
    state,
  });
  const response = [];
  for (const existingId of Object.keys(importData.policy)) {
    const policy = importData.policy[existingId];
    const shouldNotImport =
      (id && id !== policy.id) || (name && name !== policy.name);
    if (shouldNotImport) continue;
    const result = await getResult(
      resultCallback,
      `Error importing policy ${policy.name}`,
      createPolicy,
      {
        policyData: policy,
        state,
      }
    );
    if (result) {
      response.push(result);
    }
  }
  debugMessage({ message: `IgaSodPolicyOps.importPolicy: end`, state });
  return response;
}

/**
 * Delete policy
 * @param {string} id the policy id
 * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
 */
export async function deletePolicy({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<PolicySkeleton> {
  try {
    const deletedPolicy = await _deletePolicy({ id, state });
    return deletedPolicy;
  } catch (error) {
    throw new FrodoError(`Error deleting policy ${id}`, error);
  }
}

/**
 * Delete policy by its display name
 * @param {string} name the policy display name
 * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
 */
export async function deletePolicyByName({
  name,
  state,
}: {
  name: string;
  state: State;
}): Promise<PolicySkeleton> {
  try {
    const policy = await readPolicyByName({
      name,
      state,
    });
    return await _deletePolicy({
      id: policy.id,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error deleting policy ${name}`, error);
  }
}
