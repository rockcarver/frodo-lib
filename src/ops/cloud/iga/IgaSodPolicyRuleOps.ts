import {
  getPolicyRule,
  createPolicyRule as _createPolicyRule,
  putPolicyRule,
  queryPolicyRules,
  deletePolicyRule as _deletePolicyRule,
  PolicyRuleSkeleton,
} from '../../../api/cloud/iga/IgaSodPolicyRulesApi';
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

export type SodPolicyRule = {
  /**
   * Create policy rule
   * @param {PolicyRuleSkeleton} policyData the policy rule object
   * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
   */
  createPolicyRule(
    policyRuleData: PolicyRuleSkeleton
  ): Promise<PolicyRuleSkeleton>;
  /**
   * Read policy rule
   * @param {string} id the policy rule id
   * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
   */
  readPolicyRule(id: string): Promise<PolicyRuleSkeleton>;
  /**
   * Read policy rule by its display name
   * @param {string} name the policy rule display name
   * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
   */
  readPolicyRuleByName(name: string): Promise<PolicyRuleSkeleton>;
  /**
   * Read all policy rules
   * @returns {Promise<PolicyRuleSkeleton[]>} a promise that resolves to an array of policy objects
   */
  readPolicyRules(): Promise<PolicyRuleSkeleton[]>;
  /**
   * Export policy rule
   * @param {string} id the policy rule id
   * @returns {Promise<PolicyRuleExportInterface>} a promise that resolves to a policy rule export object
   */
  exportPolicyRule(id: string): Promise<PolicyRuleExportInterface>;
  /**
   * Export policy rule by its display name
   * @param {string} name the policy display name
   * @returns {Promise<PolicyRuleExportInterface>} a promise that resolves to a policy rule export object
   */
  exportPolicyRuleByName(name: string): Promise<PolicyRuleExportInterface>;
  /**
   * Export all policy rules
   * @returns {Promise<PolicyRuleExportInterface>} a promise that resolves to a policy rule export object
   */
  exportPolicyRules(
    resultCallback?: ResultCallback<PolicyRuleExportInterface>
  ): Promise<PolicyRuleExportInterface>;
  /**
   * Update policy rule
   * @param {string} id the policy rule id
   * @param {PolicyRuleSkeleton} policyData the policy rule object
   * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
   */
  updatePolicyRule(
    id: string,
    policyData: PolicyRuleSkeleton
  ): Promise<PolicyRuleSkeleton>;
  /**
   * Import policy policy rule
   * @param {string} id The policy rule id.
   * @param {string} name The policy display name.
   * @param {PolicyRuleExportInterface} importData policy rule import data
   * @param {ResultCallback<PolicyRuleSkeleton>} resultCallback Optional callback to process individual results
   * @returns {Promise<PolicyRuleSkeleton[]>} the imported policy rule rules
   */
  importPolicyRule(
    importData: PolicyRuleExportInterface,
    id?: string,
    name?: string,
    resultCallback?: ResultCallback<PolicyRuleSkeleton>
  ): Promise<PolicyRuleSkeleton[]>;
  /**
   * Delete policy rule
   * @param {string} id the policy rule id
   * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
   */
  deletePolicyRule(id: string): Promise<PolicyRuleSkeleton>;
  /**
   * Delete policy rule by its display name
   * @param {string} name the policy rule display name
   * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
   */
  deletePolicyRuleByName(name: string): Promise<PolicyRuleSkeleton>;
};

export default (state: State): SodPolicyRule => {
  return {
    createPolicyRule(
      policyRuleData: PolicyRuleSkeleton
    ): Promise<PolicyRuleSkeleton> {
      return _createPolicyRule({
        policyRuleData,
        state,
      });
    },
    readPolicyRule(id: string): Promise<PolicyRuleSkeleton> {
      return getPolicyRule({
        id,
        state,
      });
    },
    readPolicyRuleByName(name: string): Promise<PolicyRuleSkeleton> {
      return readPolicyRuleByName({
        name,
        state,
      });
    },
    readPolicyRules(): Promise<PolicyRuleSkeleton[]> {
      return queryPolicyRules({
        state,
      });
    },

    exportPolicyRules(): Promise<PolicyRuleExportInterface> {
      return exportPolicyRules({ state });
    },
    exportPolicyRule(id: string): Promise<PolicyRuleExportInterface> {
      return exportPolicyRule({
        id,
        state,
      });
    },
    exportPolicyRuleByName(name: string): Promise<PolicyRuleExportInterface> {
      return exportPolicyRuleByName({
        name,
        state,
      });
    },
    updatePolicyRule(
      id: string,
      policyRuleData: PolicyRuleSkeleton
    ): Promise<PolicyRuleSkeleton> {
      return putPolicyRule({
        id,
        policyRuleData,
        state,
      });
    },
    importPolicyRule(
      importData: PolicyRuleExportInterface,
      id?: string,
      name?: string,
      resultCallback: ResultCallback<PolicyRuleSkeleton> = void 0
    ): Promise<PolicyRuleSkeleton[]> {
      return importPolicyRule({
        id,
        name,
        importData,
        resultCallback,
        state,
      });
    },
    deletePolicyRule(id: string): Promise<PolicyRuleSkeleton> {
      return _deletePolicyRule({
        id,
        state,
      });
    },
    deletePolicyRuleByName(name: string): Promise<PolicyRuleSkeleton> {
      return deletePolicyRuleByName({
        name,
        state,
      });
    },
  };
};

export interface PolicyRuleExportInterface {
  meta?: ExportMetaData;
  policyRule: Record<string, PolicyRuleSkeleton>;
}

/**
 * Create an empty policy rule export template
 * @returns {PolicyRuleExportInterface} an empty policy rule export template
 */
export function createPolicyRuleExportTemplate({
  state,
}: {
  state: State;
}): PolicyRuleExportInterface {
  return {
    meta: getMetadata({ state }),
    policyRule: {},
  };
}

/**
 * Create policy rule
 * @param {PolicyRuleSkeleton} policyRuleData the policy rule object
 * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
 */
export async function createPolicyRule({
  policyRuleData,
  state,
}: {
  policyRuleData: PolicyRuleSkeleton;
  state: State;
}): Promise<PolicyRuleSkeleton> {
  try {
    return await _createPolicyRule({ policyRuleData, state });
  } catch (error) {
    throw new FrodoError(`Error creating policy ${policyRuleData.name}`, error);
  }
}

/**
 * Read policy rule
 * @param {string} id the policy rule id
 * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
 */
export async function readPolicyRule({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<PolicyRuleSkeleton> {
  try {
    return await getPolicyRule({ id, state });
  } catch (error) {
    throw new FrodoError(`Error reading policy ${id}`, error);
  }
}

/**
 * Read policy rule by its  name
 * @param {string} name the policy rule  name
 * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
 */
export async function readPolicyRuleByName({
  name,
  state,
}: {
  name: string;
  state: State;
}): Promise<PolicyRuleSkeleton> {
  try {
    const policyRules = await queryPolicyRules({
      queryFilter: `name eq "${name}"`,
      state,
    });
    if (policyRules.length !== 1) {
      throw new FrodoError(
        `Expected to find a single policy named '${name}', but ${policyRules.length} were found.`
      );
    }
    return policyRules[0];
  } catch (error) {
    throw new FrodoError(`Error reading policy ${name}`, error);
  }
}

/**
 * Read all policy rules
 * @returns {Promise<PolicyRuleSkeleton[]>} a promise that resolves to an array of policy rule objects
 */
export async function readPolicyRules({
  state,
}: {
  state: State;
}): Promise<PolicyRuleSkeleton[]> {
  try {
    return await queryPolicyRules({ state });
  } catch (error) {
    throw new FrodoError(`Error reading policy rules`, error);
  }
}

/**
 * Export policy rule
 * @param {string} id the policy rule id
 * @returns {Promise<PolicyRuleExportInterface>} a promise that resolves to a policy rule export object
 */
export async function exportPolicyRule({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<PolicyRuleExportInterface> {
  try {
    debugMessage({
      message: `IgaSodPolicyRule.exportPolicyRule: start`,
      state,
    });
    const exportData = createPolicyRuleExportTemplate({ state });
    const type = await readPolicyRule({
      id,
      state,
    });

    exportData.policyRule[type.id] = type;
    debugMessage({
      message: `IgaSodPolicyRule.exportPolicyRule: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting policy rule ${id}`, error);
  }
}

/**
 * Export policy rule by its display name
 * @param {string} name the policy rule display name
 * @returns {Promise<PolicyRuleExportInterface>} a promise that resolves to a policy export object
 */
export async function exportPolicyRuleByName({
  name,
  state,
}: {
  name: string;
  state: State;
}): Promise<PolicyRuleExportInterface> {
  try {
    debugMessage({
      message: `IgaSodPolicyRule.exportPolicyRuleByName: start`,
      state,
    });
    const exportData = createPolicyRuleExportTemplate({ state });
    const type = await readPolicyRuleByName({
      name,
      state,
    });
    exportData.policyRule[type.id] = type;
    debugMessage({
      message: `IgaSodPolicyRule.exportPolicyRuleByName: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting policy ${name}`, error);
  }
}

/**
 * Export all policy rules
 * @returns {Promise<PolicyRuleExportInterface>} a promise that resolves to a policy rule export object
 */
export async function exportPolicyRules({
  state,
}: {
  state: State;
}): Promise<PolicyRuleExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `IgapolicyOps.exportPolicyRules: start`,
      state,
    });
    const exportData = createPolicyRuleExportTemplate({ state });
    const policyRules = await readPolicyRules({ state });
    indicatorId = createProgressIndicator({
      total: policyRules.length,
      message: 'Exporting policy...',
      state,
    });
    for (const policy of policyRules) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting policy ${policy.name}...`,
        state,
      });

      exportData.policyRule[policy.id] = policy;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${policyRules.length} policy rules`,
      status: 'success',
      state,
    });
    debugMessage({
      message: `IgaSodPolicyRule.exportPolicyRules: end`,
      state,
    });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting policy rules`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error exporting policy rules`, error);
  }
}

/**
 * Update policy rule
 * @param {string} id the policy rule id
 * @param {PolicyRuleSkeleton} policyRuleData the policy rule object
 * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
 */
export async function updatePolicyRules({
  id,
  policyRuleData,
  state,
}: {
  id: string;
  policyRuleData: PolicyRuleSkeleton;
  state: State;
}): Promise<PolicyRuleSkeleton> {
  try {
    return await putPolicyRule({
      id,
      policyRuleData,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error updating policy '${id}'`, error);
  }
}

/**
 * Import policy rules
 * @param {string} id The policy rule id.
 * @param {string} name The policy rule display name.
 * @param {PolicyRuleExportInterface} importData policy rule import data
 * @param {ResultCallback<PolicyRuleSkeleton>} resultCallback Optional callback to process individual results
 * @returns {Promise<PolicyRuleSkeleton[]>} the imported policy rule rules
 */
export async function importPolicyRule({
  id,
  name,
  importData,
  resultCallback = void 0,
  state,
}: {
  id?: string;
  name?: string;
  importData: PolicyRuleExportInterface;
  resultCallback?: ResultCallback<PolicyRuleSkeleton>;
  state: State;
}): Promise<PolicyRuleSkeleton[]> {
  debugMessage({
    message: `IgaSodPolicyRule.importPolicyRule: start`,
    state,
  });
  const response = [];
  for (const existingId of Object.keys(importData.policyRule)) {
    const policy = importData.policyRule[existingId];
    const shouldNotImport =
      (id && id !== policy.id) || (name && name !== policy.name);
    if (shouldNotImport) continue;
    const result = await getResult(
      resultCallback,
      `Error importing policy rule ${policy.name}`,
      createPolicyRule,
      {
        policyRuleData: policy,
        state,
      }
    );
    if (result) {
      response.push(result);
    }
  }
  debugMessage({ message: `IgaSodPolicyRule.importPolicyRule: end`, state });
  return response;
}

/**
 * Delete policy rule
 * @param {string} id the policy rule id
 * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
 */
export async function deletePolicyRule({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<PolicyRuleSkeleton> {
  try {
    const deletedPolicy = await _deletePolicyRule({ id, state });
    return deletedPolicy;
  } catch (error) {
    throw new FrodoError(`Error deleting policy rule ${id}`, error);
  }
}

/**
 * Delete policy rule by its display name
 * @param {string} name the policy rule display name
 * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
 */
export async function deletePolicyRuleByName({
  name,
  state,
}: {
  name: string;
  state: State;
}): Promise<PolicyRuleSkeleton> {
  try {
    const policy = await readPolicyRuleByName({
      name,
      state,
    });
    return await _deletePolicyRule({
      id: policy.id,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error deleting policy ${name}`, error);
  }
}
