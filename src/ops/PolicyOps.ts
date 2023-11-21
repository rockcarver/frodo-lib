import {
  deletePolicy as _deletePolicy,
  getPolicies as _getPolicies,
  getPoliciesByPolicySet as _getPoliciesByPolicySet,
  getPolicy as _getPolicy,
  type PolicyCondition,
  type PolicySkeleton,
  putPolicy as _putPolicy,
} from '../api/PoliciesApi';
import { type PolicySetSkeleton } from '../api/PolicySetApi';
import {
  getResourceType,
  type ResourceTypeSkeleton,
} from '../api/ResourceTypesApi';
import { type ScriptSkeleton } from '../api/ScriptApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import {
  convertBase64TextToArray,
  getMetadata,
} from '../utils/ExportImportUtils';
import { type ExportMetaData } from './OpsTypes';
import {
  createPolicySet,
  readPolicySet,
  updatePolicySet,
} from './PolicySetOps';
import {
  createResourceType as _createResourceType,
  updateResourceType,
} from './ResourceTypeOps';
import { readScript, updateScript } from './ScriptOps';

export type Policy = {
  /**
   * Create policy export template
   */
  createPolicyExportTemplate(): PolicyExportInterface;
  /**
   * Read all policies
   * @returns {Promise<PolicySkeleton>} a promise that resolves to an array of policy set objects
   */
  readPolicies(): Promise<PolicySkeleton[]>;
  /**
   * Get policies by policy set
   * @param {string} policySetId policy set id/name
   * @returns {Promise<PolicySkeleton[]>} a promise resolving to an array of policy objects
   */
  readPoliciesByPolicySet(policySetId: string): Promise<PolicySkeleton[]>;
  /**
   * Get policy
   * @param {string} policyId policy id/name
   * @returns {Promise<PolicySkeleton>} promise resolving to a policy object
   */
  readPolicy(policyId: string): Promise<PolicySkeleton>;
  /**
   * Update or create policy
   * @param {string} policyId policy id/name
   * @param {PolicySkeleton} policyData policy object
   * @returns {Promise<PolicySkeleton>} promise resolving to a policy object
   */
  createPolicy(
    policyId: string,
    policyData: PolicySkeleton
  ): Promise<PolicySkeleton>;
  /**
   * Update or create policy
   * @param {string} policyId policy id/name
   * @param {PolicySkeleton} policyData policy object
   * @returns {Promise<PolicySkeleton>} promise resolving to a policy object
   */
  updatePolicy(
    policyId: string,
    policyData: PolicySkeleton
  ): Promise<PolicySkeleton>;
  /**
   * Delete policy
   * @param {string} policyId policy id/name
   * @returns {Promise<PolicySkeleton>} promise resolving to a policy object
   */
  deletePolicy(policyId: string): Promise<any>;
  /**
   * Export policy
   * @param {string} policyId policy id/name
   * @returns {Promise<PolicyExportInterface>} a promise that resolves to a PolicyExportInterface object
   */
  exportPolicy(
    policyId: string,
    options?: PolicyExportOptions
  ): Promise<PolicyExportInterface>;
  /**
   * Export policies
   * @param {PolicyExportOptions} options export options
   * @returns {Promise<PolicyExportInterface>} a promise that resolves to an PolicyExportInterface object
   */
  exportPolicies(options?: PolicyExportOptions): Promise<PolicyExportInterface>;
  /**
   * Export policies by policy set
   * @param {string} policySetName policy set id/name
   * @param {PolicyExportOptions} options export options
   * @returns {Promise<PolicyExportInterface>} a promise that resolves to an PolicyExportInterface object
   */
  exportPoliciesByPolicySet(
    policySetName: string,
    options?: PolicyExportOptions
  ): Promise<PolicyExportInterface>;
  /**
   * Import policy by id
   * @param {string} policyId policy id
   * @param {PolicyExportInterface} importData import data
   * @param {PolicyImportOptions} options import options
   * @returns {Promise<PolicySkeleton>} imported policy object
   */
  importPolicy(
    policyId: string,
    importData: PolicyExportInterface,
    options?: PolicyImportOptions
  ): Promise<PolicySkeleton>;
  /**
   * Import first policy
   * @param {PolicyExportInterface} importData import data
   * @param {PolicyImportOptions} options import options
   * @returns {Promise<PolicySkeleton>} imported policy object
   */
  importFirstPolicy(
    importData: PolicyExportInterface,
    options?: PolicyImportOptions
  ): Promise<PolicySkeleton>;
  /**
   * Import policies
   * @param {PolicyExportInterface} importData import data
   * @param {PolicyImportOptions} options import options
   * @returns {Promise<PolicySkeleton[]>} array of imported policy objects
   */
  importPolicies(
    importData: PolicyExportInterface,
    options?: PolicyImportOptions
  ): Promise<PolicySkeleton[]>;

  // Deprecated

  /**
   * Get all policies
   * @returns {Promise<PolicySkeleton>} a promise that resolves to an array of policy set objects
   * @deprecated since v2.0.0 use {@link Agent.readPolicies | readPolicies} instead
   * ```javascript
   * readPolicies(): Promise<PolicySkeleton[]>
   * ```
   * @group Deprecated
   */
  getPolicies(): Promise<PolicySkeleton[]>;
  /**
   * Get policies by policy set
   * @param {string} policySetId policy set id/name
   * @returns {Promise<PolicySkeleton[]>} a promise resolving to an array of policy objects
   * @deprecated since v2.0.0 use {@link Agent.readPoliciesByPolicySet | readPoliciesByPolicySet} instead
   * ```javascript
   * readPoliciesByPolicySet(policySetId: string): Promise<PolicySkeleton[]>
   * ```
   * @group Deprecated
   */
  getPoliciesByPolicySet(policySetId: string): Promise<PolicySkeleton[]>;
  /**
   * Get policy
   * @param {string} policyId policy id/name
   * @returns {Promise<PolicySkeleton>} promise resolving to a policy object
   * @deprecated since v2.0.0 use {@link Agent.readPolicy | readPolicy} instead
   * ```javascript
   * readPolicy(policyId: string): Promise<PolicySkeleton>
   * ```
   * @group Deprecated
   */
  getPolicy(policyId: string): Promise<PolicySkeleton>;
  /**
   * Update or create policy
   * @param {string} policyId policy id/name
   * @param {PolicySkeleton} policyData policy object
   * @returns {Promise<PolicySkeleton>} promise resolving to a policy object
   * @deprecated since v2.0.0 use {@link Agent.updatePolicy | updatePolicy} or {@link Agent.createPolicy | createPolicy} instead
   * ```javascript
   * updatePolicy(policyId: string, policyData: PolicySkeleton): Promise<PolicySkeleton>
   * createPolicy(policyId: string, policyData: PolicySkeleton): Promise<PolicySkeleton>
   * ```
   * @group Deprecated
   */
  putPolicy(
    policyId: string,
    policyData: PolicySkeleton
  ): Promise<PolicySkeleton>;
};

export default (state: State): Policy => {
  return {
    createPolicyExportTemplate(): PolicyExportInterface {
      return createPolicyExportTemplate({ state });
    },
    async readPolicies(): Promise<PolicySkeleton[]> {
      return readPolicies({ state });
    },
    async readPoliciesByPolicySet(
      policySetId: string
    ): Promise<PolicySkeleton[]> {
      return readPoliciesByPolicySet({ policySetId, state });
    },
    async readPolicy(policyId: string) {
      return readPolicy({ policyId, state });
    },
    async createPolicy(policyId: string, policyData: PolicySkeleton) {
      return createPolicy({ policyId, policyData, state });
    },
    async updatePolicy(policyId: string, policyData: PolicySkeleton) {
      return updatePolicy({ policyId, policyData, state });
    },
    async deletePolicy(policyId: string) {
      return deletePolicy({ policyId, state });
    },
    async exportPolicy(
      policyId: string,
      options: PolicyExportOptions = {
        deps: true,
        prereqs: false,
        useStringArrays: true,
      }
    ): Promise<PolicyExportInterface> {
      return exportPolicy({ policyId, options, state });
    },
    async exportPolicies(
      options: PolicyExportOptions = {
        deps: true,
        prereqs: false,
        useStringArrays: true,
      }
    ): Promise<PolicyExportInterface> {
      return exportPolicies({ options, state });
    },
    async exportPoliciesByPolicySet(
      policySetName: string,
      options: PolicyExportOptions = {
        deps: true,
        prereqs: false,
        useStringArrays: true,
      }
    ): Promise<PolicyExportInterface> {
      return exportPoliciesByPolicySet({
        policySetName,
        options,
        state,
      });
    },
    async importPolicy(
      policyId: string,
      importData: PolicyExportInterface,
      options: PolicyImportOptions = { deps: true, prereqs: false }
    ): Promise<PolicySkeleton> {
      return importPolicy({ policyId, importData, options, state });
    },
    async importFirstPolicy(
      importData: PolicyExportInterface,
      options: PolicyImportOptions = { deps: true, prereqs: false }
    ): Promise<PolicySkeleton> {
      return importFirstPolicy({ importData, options, state });
    },
    async importPolicies(
      importData: PolicyExportInterface,
      options: PolicyImportOptions = { deps: true, prereqs: false }
    ): Promise<PolicySkeleton[]> {
      return importPolicies({ importData, options, state });
    },

    // Deprecated

    async getPolicies(): Promise<PolicySkeleton[]> {
      return readPolicies({ state });
    },
    async getPoliciesByPolicySet(
      policySetId: string
    ): Promise<PolicySkeleton[]> {
      return readPoliciesByPolicySet({ policySetId, state });
    },
    async getPolicy(policyId: string) {
      return readPolicy({ policyId, state });
    },
    async putPolicy(policyId: string, policyData: PolicySkeleton) {
      return updatePolicy({ policyId, policyData, state });
    },
  };
};

export interface PolicyExportInterface {
  meta?: ExportMetaData;
  script: Record<string, ScriptSkeleton>;
  resourcetype: Record<string, ResourceTypeSkeleton>;
  policy: Record<string, PolicySkeleton>;
  policyset: Record<string, PolicySetSkeleton>;
}

/**
 * Policy export options
 */
export interface PolicyExportOptions {
  /**
   * Include any dependencies (scripts).
   */
  deps: boolean;
  /**
   * Include any prerequisites (policy sets, resource types).
   */
  prereqs: boolean;
  /**
   * Use string arrays to store multi-line text in scripts.
   */
  useStringArrays: boolean;
}

/**
 * Policy import options
 */
export interface PolicyImportOptions {
  /**
   * Include any dependencies (scripts).
   */
  deps: boolean;
  /**
   * Include any prerequisites (policy sets, resource types).
   */
  prereqs: boolean;
  /**
   * Import policies into different policy set
   */
  policySetName?: string;
}

/**
 * Create an empty export template
 * @returns {PolicyExportInterface} an empty export template
 */
export function createPolicyExportTemplate({
  state,
}: {
  state: State;
}): PolicyExportInterface {
  return {
    meta: getMetadata({ state }),
    script: {},
    policy: {},
    resourcetype: {},
    policyset: {},
  } as PolicyExportInterface;
}

/**
 * Get all policies
 * @returns {Promise<PolicySkeleton>} a promise that resolves to an array of policy set objects
 */
export async function readPolicies({
  state,
}: {
  state: State;
}): Promise<PolicySkeleton[]> {
  const { result } = await _getPolicies({ state });
  return result;
}

export async function readPolicy({
  policyId,
  state,
}: {
  policyId: string;
  state: State;
}) {
  return _getPolicy({ policyId, state });
}

export async function deletePolicy({
  policyId,
  state,
}: {
  policyId: string;
  state: State;
}) {
  return _deletePolicy({ policyId, state });
}

/**
 * Get policies by policy set
 * @param {string} policySetId policy set id/name
 * @returns {Promise<PolicySkeleton[]>} a promise resolving to an array of policy objects
 */
export async function readPoliciesByPolicySet({
  policySetId,
  state,
}: {
  policySetId: string;
  state: State;
}): Promise<PolicySkeleton[]> {
  const data = await _getPoliciesByPolicySet({ policySetId, state });
  return data.result;
}

export async function createPolicy({
  policyId,
  policyData,
  state,
}: {
  policyId: string;
  policyData: PolicySkeleton;
  state: State;
}) {
  debugMessage({ message: `PolicyOps.createPolicy: start`, state });
  try {
    await _getPolicy({ policyId, state });
  } catch (error) {
    const result = await _putPolicy({
      policyId,
      policyData,
      state,
    });
    debugMessage({
      message: `PolicyOps.createPolicy: end`,
      state,
    });
    return result;
  }
  throw new Error(`Policy ${policyId} already exists!`);
}

export async function updatePolicy({
  policyId,
  policyData,
  state,
}: {
  policyId: string;
  policyData: PolicySkeleton;
  state: State;
}) {
  return _putPolicy({ policyId, policyData, state });
}

/**
 * Find all script references in a deeply-nested policy condition object
 * @param {PolicyCondition} condition condition object
 * @returns {string[]} array of script UUIDs
 * 
 * Sample condition block:
 * 
      "condition": {
        "type": "AND",
        "conditions": [
          {
            "type": "Script",
            "scriptId": "62f18ede-e5e7-4a7b-8b73-1b02fcbd241a"
          },
          {
            "type": "AuthenticateToService",
            "authenticateToService": "TxAuthz"
          },
          {
            "type": "OR",
            "conditions": [
              {
                "type": "Session",
                "maxSessionTime": 5,
                "terminateSession": false
              },
              {
                "type": "OAuth2Scope",
                "requiredScopes": [
                  "openid"
                ]
              },
              {
                "type": "NOT",
                "condition": {
                  "type": "Script",
                  "scriptId": "729ee140-a4e9-43af-b358-d60eeda13cc3"
                }
              }
            ]
          }
        ]
      },
*/
export function findScriptUuids(condition: PolicyCondition): string[] {
  let scriptUuids: string[] = [];
  if (!condition) return scriptUuids;
  if (
    condition.type === 'AND' ||
    condition.type === 'OR' ||
    condition.type === 'NOT'
  ) {
    // single condition
    if (condition.condition) {
      scriptUuids.push(...findScriptUuids(condition.condition));
    }
    // array of conditions
    if (condition.conditions) {
      for (const cond of condition.conditions) {
        scriptUuids.push(...findScriptUuids(cond));
      }
    }
  } else if (condition.type === 'Script') {
    scriptUuids.push(condition.scriptId as string);
  }
  // de-duplicate
  scriptUuids = [...new Set(scriptUuids)];
  return scriptUuids;
}

/**
 * Get scripts for a policy object
 * @param {PolicySkeleton} policyData policy object
 * @returns {Promise<ScriptSkeleton[]>} a promise that resolves to an array of script objects
 */
export async function getScripts({
  policyData,
  state,
}: {
  policyData: PolicySkeleton;
  state: State;
}): Promise<ScriptSkeleton[]> {
  debugMessage({
    message: `PolicyOps.getScripts: start [policy=${policyData['name']}]`,
    state,
  });
  const errors = [];
  const scripts = [];
  try {
    const scriptUuids = findScriptUuids(policyData.condition);
    debugMessage({ message: `found scripts: ${scriptUuids}`, state });
    for (const scriptUuid of scriptUuids) {
      try {
        const script = await readScript({ scriptId: scriptUuid, state });
        scripts.push(script);
      } catch (error) {
        error.message = `Error retrieving script ${scriptUuid} referenced in policy ${policyData['name']}: ${error.message}`;
        errors.push(error);
      }
    }
  } catch (error) {
    error.message = `Error finding scripts in policy ${policyData['name']}: ${error.message}`;
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({ message: `PolicySetOps.getScripts: end`, state });
  return scripts;
}

/**
 * Helper function to export dependencies of a policy set
 * @param {PolicySkeleton} policyData policy set data
 * @param {PolicyExportInterface} exportData export data
 */
async function exportPolicyPrerequisites({
  policyData,
  exportData,
  state,
}: {
  policyData: PolicySkeleton;
  exportData: PolicyExportInterface;
  state: State;
}) {
  debugMessage({
    message: `PolicyOps.exportPolicyPrerequisites: start [policy=${policyData['name']}]`,
    state,
  });
  // resource types
  if (policyData.resourceTypeUuid) {
    const resourceType = await getResourceType({
      resourceTypeUuid: policyData.resourceTypeUuid,
      state,
    });
    exportData.resourcetype[policyData.resourceTypeUuid] = resourceType;
  }
  // policy set
  if (policyData.applicationName) {
    const policySet = await readPolicySet({
      policySetName: policyData.applicationName,
      state,
    });
    exportData.policyset[policyData.applicationName] = policySet;
  }
  debugMessage({
    message: `PolicySetOps.exportPolicyPrerequisites: end`,
    state,
  });
}

/**
 * Helper function to export dependencies of a policy set
 * @param {unknown} policyData policy set data
 * @param {PolicyExportOptions} options export options
 * @param {PolicyExportInterface} exportData export data
 */
async function exportPolicyDependencies({
  policyData,
  options,
  exportData,
  state,
}: {
  policyData: PolicySkeleton;
  options: PolicyExportOptions;
  exportData: PolicyExportInterface;
  state: State;
}) {
  debugMessage({
    message: `PolicyOps.exportPolicyDependencies: start [policy=${policyData['name']}]`,
    state,
  });
  // scripts
  const scripts = await getScripts({ policyData, state });
  for (const scriptData of scripts) {
    if (options.useStringArrays) {
      scriptData.script = convertBase64TextToArray(scriptData.script as string);
    }
    exportData.script[scriptData._id] = scriptData;
  }
  debugMessage({
    message: `PolicySetOps.exportPolicySetDependencies: end`,
    state,
  });
}

/**
 * Export policy
 * @param {string} policyId policy id/name
 * @returns {Promise<PolicyExportInterface>} a promise that resolves to a PolicyExportInterface object
 */
export async function exportPolicy({
  policyId,
  options = {
    deps: true,
    prereqs: false,
    useStringArrays: true,
  },
  state,
}: {
  policyId: string;
  options?: PolicyExportOptions;
  state: State;
}): Promise<PolicyExportInterface> {
  debugMessage({ message: `PolicyOps.exportPolicy: start`, state });
  const policyData = await _getPolicy({ policyId, state });
  const exportData = createPolicyExportTemplate({ state });
  exportData.policy[policyData._id] = policyData;
  if (options.prereqs) {
    await exportPolicyPrerequisites({ policyData, exportData, state });
  }
  if (options.deps) {
    await exportPolicyDependencies({ policyData, options, exportData, state });
  }
  debugMessage({ message: `PolicyOps.exportPolicy: end`, state });
  return exportData;
}

/**
 * Export policies
 * @param {PolicyExportOptions} options export options
 * @returns {Promise<PolicyExportInterface>} a promise that resolves to an PolicyExportInterface object
 */
export async function exportPolicies({
  options = {
    deps: true,
    prereqs: false,
    useStringArrays: true,
  },
  state,
}: {
  options?: PolicyExportOptions;
  state: State;
}): Promise<PolicyExportInterface> {
  debugMessage({ message: `PolicyOps.exportPolicies: start`, state });
  const exportData = createPolicyExportTemplate({ state });
  const errors = [];
  try {
    const policies = await readPolicies({ state });
    createProgressIndicator({
      total: policies.length,
      message: 'Exporting policies...',
      state,
    });
    for (const policyData of policies) {
      updateProgressIndicator({
        message: `Exporting policy ${policyData._id}`,
        state,
      });
      exportData.policy[policyData._id] = policyData;
      if (options.prereqs) {
        try {
          await exportPolicyPrerequisites({ policyData, exportData, state });
        } catch (error) {
          errors.push(error);
        }
      }
      if (options.deps) {
        try {
          await exportPolicyDependencies({
            policyData,
            options,
            exportData,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
    }
    stopProgressIndicator({
      message: `Exported ${policies.length} policies.`,
      state,
    });
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({ message: `PolicyOps.exportPolicies: end`, state });
  return exportData;
}

/**
 * Export policies by policy set
 * @param {string} policySetName policy set id/name
 * @param {PolicyExportOptions} options export options
 * @returns {Promise<PolicyExportInterface>} a promise that resolves to an PolicyExportInterface object
 */
export async function exportPoliciesByPolicySet({
  policySetName,
  options = {
    deps: true,
    prereqs: false,
    useStringArrays: true,
  },
  state,
}: {
  policySetName: string;
  options?: PolicyExportOptions;
  state: State;
}): Promise<PolicyExportInterface> {
  debugMessage({ message: `PolicyOps.exportPolicies: start`, state });
  const exportData = createPolicyExportTemplate({ state });
  const errors = [];
  try {
    const policies = await readPoliciesByPolicySet({
      policySetId: policySetName,
      state,
    });
    for (const policyData of policies) {
      exportData.policy[policyData._id] = policyData;
      if (options.prereqs) {
        try {
          await exportPolicyPrerequisites({ policyData, exportData, state });
        } catch (error) {
          errors.push(error);
        }
      }
      if (options.deps) {
        try {
          await exportPolicyDependencies({
            policyData,
            options,
            exportData,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({ message: `PolicyOps.exportPolicies: end`, state });
  return exportData;
}

/**
 * Helper function to import hard dependencies of a policy
 * @param {PolicySkeleton} policyData policy object
 * @param {PolicyExportInterface} exportData export data
 */
async function importPolicyPrerequisites({
  policyData,
  exportData,
  state,
}: {
  policyData: PolicySkeleton;
  exportData: PolicyExportInterface;
  state: State;
}) {
  debugMessage({
    message: `PolicyOps.importPolicyHardDependencies: start [policy=${policyData._id}]`,
    state,
  });
  const errors = [];
  try {
    // resource type
    if (exportData.resourcetype[policyData.resourceTypeUuid]) {
      try {
        debugMessage({
          message: `Importing resource type ${policyData.resourceTypeUuid}`,
          state,
        });
        await _createResourceType({
          resourceTypeData:
            exportData.resourcetype[policyData.resourceTypeUuid],
          state,
        });
      } catch (error) {
        if (error.response?.status === 409)
          await updateResourceType({
            resourceTypeUuid: policyData.resourceTypeUuid,
            resourceTypeData:
              exportData.resourcetype[policyData.resourceTypeUuid],
            state,
          });
        else throw error;
      }
    }
    // policy set
    if (exportData.policyset[policyData.applicationName]) {
      try {
        debugMessage({
          message: `Importing policy set ${policyData.applicationName}`,
          state,
        });
        await createPolicySet({
          policySetData: exportData.policyset[policyData.applicationName],
          state,
        });
      } catch (error) {
        if (error.response?.status === 409)
          await updatePolicySet({
            policySetData: exportData.policyset[policyData.applicationName],
            state,
          });
        else throw error;
      }
    }
  } catch (error) {
    error.message = `Error importing hard dependencies for policy ${
      policyData._id
    }: ${error.response?.data?.message || error.message}`;
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
      .join('\n');
    throw new Error(`Import hard dependencies error:\n${errorMessages}`);
  }
  debugMessage({
    message: `PolicyOps.importPolicyHardDependencies: end`,
    state,
  });
}

/**
 * Helper function to import soft dependencies of a policy
 * @param {PolicySkeleton} policyData policy object
 * @param {PolicyExportInterface} exportData export data
 */
async function importPolicyDependencies({
  policyData,
  exportData,
  state,
}: {
  policyData: PolicySkeleton;
  exportData: PolicyExportInterface;
  state: State;
}) {
  debugMessage({
    message: `PolicyOps.importPolicySoftDependencies: start [policy=${policyData._id}]`,
    state,
  });
  const errors = [];
  try {
    // scripts
    const scriptUuids = findScriptUuids(policyData.condition);
    for (const scriptUuid of scriptUuids) {
      try {
        const scriptData = exportData.script[scriptUuid];
        debugMessage({ message: `Importing script ${scriptUuid}`, state });
        await updateScript({ scriptId: scriptUuid, scriptData, state });
      } catch (error) {
        debugMessage({ message: error.response?.data, state });
        error.message = `Error importing script ${scriptUuid} for policy ${
          policyData._id
        }: ${error.response?.data?.message || error.message}`;
        errors.push(error);
      }
    }
  } catch (error) {
    error.message = `Error importing soft dependencies for policy ${
      policyData._id
    }: ${error.response?.data?.message || error.message}`;
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
      .join('\n');
    throw new Error(`Import soft dependencies error:\n${errorMessages}`);
  }
  debugMessage({
    message: `PolicyOps.importPolicySoftDependencies: end`,
    state,
  });
}

/**
 * Import policy by id
 * @param {string} policyId policy id
 * @param {PolicyExportInterface} importData import data
 * @param {PolicyImportOptions} options import options
 * @returns {Promise<PolicySkeleton>} imported policy object
 */
export async function importPolicy({
  policyId,
  importData,
  options = { deps: true, prereqs: false },
  state,
}: {
  policyId: string;
  importData: PolicyExportInterface;
  options?: PolicyImportOptions;
  state: State;
}): Promise<PolicySkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.policy)) {
    if (id === policyId) {
      try {
        const policyData = importData.policy[id];
        delete policyData._rev;
        if (options.policySetName) {
          policyData.applicationName = options.policySetName;
        }
        if (options.prereqs) {
          try {
            await importPolicyPrerequisites({
              policyData,
              exportData: importData,
              state,
            });
          } catch (error) {
            errors.push(error);
          }
        }
        try {
          response = await updatePolicy({
            policyId: policyData._id,
            policyData,
            state,
          });
          imported.push(id);
        } catch (error) {
          errors.push(error);
        }
        if (options.deps) {
          try {
            await importPolicyDependencies({
              policyData,
              exportData: importData,
              state,
            });
          } catch (error) {
            errors.push(error);
          }
        }
      } catch (error) {
        errors.push(error);
      }
    }
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
      .join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\n${policyId} not found in import data!`);
  }
  return response;
}

/**
 * Import first policy
 * @param {PolicyExportInterface} importData import data
 * @param {PolicyImportOptions} options import options
 * @returns {Promise<PolicySkeleton>} imported policy object
 */
export async function importFirstPolicy({
  importData,
  options = { deps: true, prereqs: false },
  state,
}: {
  importData: PolicyExportInterface;
  options?: PolicyImportOptions;
  state: State;
}): Promise<PolicySkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.policy)) {
    try {
      const policyData = importData.policy[id];
      delete policyData._rev;
      if (options.policySetName) {
        policyData.applicationName = options.policySetName;
      }
      if (options.prereqs) {
        try {
          await importPolicyPrerequisites({
            policyData,
            exportData: importData,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        response = await updatePolicy({
          policyId: policyData._id,
          policyData,
          state,
        });
        imported.push(id);
      } catch (error) {
        errors.push(error);
      }
      if (options.deps) {
        try {
          await importPolicyDependencies({
            policyData,
            exportData: importData,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
    } catch (error) {
      errors.push(error);
    }
    break;
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
      .join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo policy found in import data!`);
  }
  return response;
}

/**
 * Import policies
 * @param {PolicyExportInterface} importData import data
 * @param {PolicyImportOptions} options import options
 * @returns {Promise<PolicySkeleton[]>} array of imported policy objects
 */
export async function importPolicies({
  importData,
  options = { deps: true, prereqs: false },
  state,
}: {
  importData: PolicyExportInterface;
  options?: PolicyImportOptions;
  state: State;
}): Promise<PolicySkeleton[]> {
  const response = [];
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.policy)) {
    try {
      const policyData = importData.policy[id];
      delete policyData._rev;
      if (options.policySetName) {
        policyData.applicationName = options.policySetName;
      }
      if (options.prereqs) {
        try {
          await importPolicyPrerequisites({
            policyData,
            exportData: importData,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        response.push(
          await updatePolicy({ policyId: policyData._id, policyData, state })
        );
        imported.push(id);
      } catch (error) {
        errors.push(error);
      }
      if (options.deps) {
        try {
          await importPolicyDependencies({
            policyData,
            exportData: importData,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    const errorMessages = errors
      .map((error) => error.response?.data?.message || error.message)
      .join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo policies found in import data!`);
  }
  return response;
}
