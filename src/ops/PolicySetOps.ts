import { type PolicySkeleton } from '../api/PoliciesApi';
import {
  createPolicySet as _createPolicySet,
  deletePolicySet as _deletePolicySet,
  getPolicySet as _getPolicySet,
  getPolicySets as _getPolicySets,
  updatePolicySet as _updatePolicySet,
} from '../api/PolicySetApi';
import { type PolicySetSkeleton } from '../api/PolicySetApi';
import { getResourceType, putResourceType } from '../api/ResourceTypesApi';
import { type ResourceTypeSkeleton } from '../api/ResourceTypesApi';
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
import { ExportMetaData } from './OpsTypes';
import {
  findScriptUuids,
  getScripts,
  readPoliciesByPolicySet,
  updatePolicy,
} from './PolicyOps';
import { updateScript } from './ScriptOps';

export type PolicySet = {
  /**
   * Create policy export template
   * @returns {PolicySetExportInterface} policy export interface
   */
  createPolicySetExportTemplate(): PolicySetExportInterface;
  /**
   * Read all policy sets
   * @returns {Promise<PolicySetSkeleton[]>} a promise that resolves to an array of policy set objects
   */
  readPolicySets(): Promise<PolicySetSkeleton[]>;
  /**
   * Read policy set
   * @param {string} policySetName policy set name
   * @returns {Promise<PolicySetSkeleton>} a promise that resolves to a policy set object
   */
  readPolicySet(policySetName: string): Promise<PolicySetSkeleton>;
  createPolicySet(
    policySetData: PolicySetSkeleton,
    policySetName?: string
  ): Promise<PolicySetSkeleton>;
  updatePolicySet(
    policySetData: PolicySetSkeleton,
    policySetName?: string
  ): Promise<PolicySetSkeleton>;
  deletePolicySet(policySetName: string): Promise<PolicySetSkeleton>;
  /**
   * Export policy set
   * @param {string} policySetName policy set name
   * @param {PolicySetExportOptions} options export options
   * @returns {Promise<PolicySetExportInterface>} a promise that resolves to an PolicySetExportInterface object
   */
  exportPolicySet(
    policySetName: string,
    options?: PolicySetExportOptions
  ): Promise<PolicySetExportInterface>;
  /**
   * Export policy sets
   * @param {PolicySetExportOptions} options export options
   * @returns {Promise<PolicySetExportInterface>} a promise that resolves to an PolicySetExportInterface object
   */
  exportPolicySets(
    options?: PolicySetExportOptions
  ): Promise<PolicySetExportInterface>;
  /**
   * Import policy set
   * @param {string} policySetName policy set name
   * @param {PolicySetExportInterface} importData import data
   * @param {PolicySetImportOptions} options import options
   */
  importPolicySet(
    policySetName: string,
    importData: PolicySetExportInterface,
    options?: PolicySetImportOptions
  ): Promise<any>;
  /**
   * Import first policy set
   * @param {PolicySetExportInterface} importData import data
   * @param {PolicySetImportOptions} options import options
   */
  importFirstPolicySet(
    importData: PolicySetExportInterface,
    options?: PolicySetImportOptions
  ): Promise<any>;
  /**
   * Import policy sets
   * @param {PolicySetExportInterface} importData import data
   * @param {PolicySetImportOptions} options import options
   */
  importPolicySets(
    importData: PolicySetExportInterface,
    options?: PolicySetImportOptions
  ): Promise<any>;

  // Deprecated

  /**
   * Get all policy sets
   * @returns {Promise<PolicySetSkeleton[]>} a promise that resolves to an array of policy set objects
   * @deprecated since v2.0.0 use {@link Policy.readPolicySets | readPolicySets} instead
   * ```javascript
   * readPolicySets(): Promise<PolicySetSkeleton[]>
   * ```
   * @group Deprecated
   */
  getPolicySets(): Promise<PolicySetSkeleton[]>;
  /**
   * Get policy set
   * @param {string} policySetName policy set name
   * @returns {Promise<PolicySetSkeleton>} a promise that resolves to a policy set object
   * @deprecated since v2.0.0 use {@link Policy.readPolicySet | readPolicySet} instead
   * ```javascript
   * readPolicySet(policySetName: string): Promise<PolicySetSkeleton>
   * ```
   * @group Deprecated
   */
  getPolicySet(policySetName: string): Promise<PolicySetSkeleton>;
};

export default (state: State): PolicySet => {
  return {
    createPolicySetExportTemplate(): PolicySetExportInterface {
      return createPolicySetExportTemplate({ state });
    },
    async readPolicySets(): Promise<PolicySetSkeleton[]> {
      return readPolicySets({ state });
    },
    async readPolicySet(policySetName: string) {
      return readPolicySet({ policySetName, state });
    },
    async createPolicySet(
      policySetData: PolicySetSkeleton,
      policySetName = undefined
    ) {
      return createPolicySet({ policySetData, policySetName, state });
    },
    async updatePolicySet(
      policySetData: PolicySetSkeleton,
      policySetName = undefined
    ) {
      return updatePolicySet({ policySetData, policySetName, state });
    },
    async deletePolicySet(policySetName: string) {
      return deletePolicySet({ policySetName, state });
    },
    async exportPolicySet(
      policySetName: string,
      options: PolicySetExportOptions = {
        deps: true,
        prereqs: false,
        useStringArrays: true,
      }
    ): Promise<PolicySetExportInterface> {
      return exportPolicySet({ policySetName, options, state });
    },
    async exportPolicySets(
      options: PolicySetExportOptions = {
        deps: true,
        prereqs: false,
        useStringArrays: true,
      }
    ): Promise<PolicySetExportInterface> {
      return exportPolicySets({ options, state });
    },
    async importPolicySet(
      policySetName: string,
      importData: PolicySetExportInterface,
      options: PolicySetImportOptions = { deps: true, prereqs: false }
    ) {
      return importPolicySet({
        policySetName,
        importData,
        options,
        state,
      });
    },
    async importFirstPolicySet(
      importData: PolicySetExportInterface,
      options: PolicySetImportOptions = { deps: true, prereqs: false }
    ) {
      return importFirstPolicySet({ importData, options, state });
    },
    async importPolicySets(
      importData: PolicySetExportInterface,
      options: PolicySetImportOptions = { deps: true, prereqs: false }
    ) {
      return importPolicySets({ importData, options, state });
    },

    // Deprecated

    async getPolicySets(): Promise<PolicySetSkeleton[]> {
      return readPolicySets({ state });
    },
    async getPolicySet(policySetName: string) {
      return _getPolicySet({ policySetName, state });
    },
  };
};

export interface PolicySetExportInterface {
  meta?: ExportMetaData;
  script: Record<string, ScriptSkeleton>;
  resourcetype: Record<string, ResourceTypeSkeleton>;
  policy: Record<string, PolicySkeleton>;
  policyset: Record<string, PolicySetSkeleton>;
}

/**
 * Application/policy set export options
 */
export interface PolicySetExportOptions {
  /**
   * Include any dependencies (policies, scripts, resource types).
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
 * Policy set import options
 */
export interface PolicySetImportOptions {
  /**
   * Include any dependencies (policies, scripts, resource types).
   */
  deps: boolean;
  /**
   * Include any prerequisites (policy sets, resource types).
   */
  prereqs: boolean;
}

/**
 * Create an empty export template
 * @returns {PolicySetExportInterface} an empty export template
 */
export function createPolicySetExportTemplate({
  state,
}: {
  state: State;
}): PolicySetExportInterface {
  return {
    meta: getMetadata({ state }),
    script: {},
    policy: {},
    resourcetype: {},
    policyset: {},
  } as PolicySetExportInterface;
}

/**
 * Get all policy sets
 * @returns {Promise} a promise that resolves to an array of policy set objects
 */
export async function readPolicySets({
  state,
}: {
  state: State;
}): Promise<PolicySetSkeleton[]> {
  const { result } = await _getPolicySets({ state });
  return result;
}

export async function readPolicySet({
  policySetName,
  state,
}: {
  policySetName: string;
  state: State;
}) {
  return _getPolicySet({ policySetName, state });
}

export async function createPolicySet({
  policySetName = undefined,
  policySetData,
  state,
}: {
  policySetName?: string;
  policySetData: PolicySetSkeleton;
  state: State;
}) {
  if (!policySetName) return _createPolicySet({ policySetData, state });
  return _updatePolicySet({ policySetName, policySetData, state });
}

export async function updatePolicySet({
  policySetName = undefined,
  policySetData,
  state,
}: {
  policySetName?: string;
  policySetData: PolicySetSkeleton;
  state: State;
}) {
  return _updatePolicySet({ policySetName, policySetData, state });
}

export async function deletePolicySet({
  policySetName,
  state,
}: {
  policySetName: string;
  state: State;
}) {
  return _deletePolicySet({ policySetName, state });
}

/**
 * Helper function to export prerequisites of a policy set
 * @param {PolicySetSkeleton} policySetData policy set object
 * @param {PolicySetExportInterface} exportData export data
 */
async function exportPolicySetPrerequisites({
  policySetData,
  exportData,
  state,
}: {
  policySetData: PolicySetSkeleton;
  exportData: PolicySetExportInterface;
  state: State;
}) {
  debugMessage({
    message: `PolicySetOps.exportPolicySetPrerequisites: start [policySet=${policySetData['name']}]`,
    state,
  });
  const errors = [];
  // resource types
  for (const resourceTypeUuid of policySetData.resourceTypeUuids) {
    try {
      const resourceType = await getResourceType({ resourceTypeUuid, state });
      exportData.resourcetype[resourceTypeUuid] = resourceType;
    } catch (error) {
      error.message = `Error retrieving resource type ${resourceTypeUuid} for policy set ${policySetData.name}: ${error.message}`;
      errors.push(error);
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export dependencies error:\n${errorMessages}`);
  }
  debugMessage({
    message: `PolicySetOps.exportPolicySetPrerequisites: end`,
    state,
  });
}

/**
 * Helper function to export dependencies of a policy set
 * @param {PolicySetSkeleton} policySetData policy set object
 * @param {PolicySetExportOptions} options export options
 * @param {PolicySetExportInterface} exportData export data
 */
async function exportPolicySetDependencies({
  policySetData,
  options,
  exportData,
  state,
}: {
  policySetData: PolicySetSkeleton;
  options: PolicySetExportOptions;
  exportData: PolicySetExportInterface;
  state: State;
}) {
  debugMessage({
    message: `PolicySetOps.exportPolicySetDependencies: start [policySet=${policySetData['name']}]`,
    state,
  });
  const errors = [];
  // policies
  try {
    const policies = await readPoliciesByPolicySet({
      policySetId: policySetData.name,
      state,
    });
    for (const policy of policies) {
      exportData.policy[policy.name] = policy;
      // scripts
      try {
        const scripts = await getScripts({ policyData: policy, state });
        for (const scriptData of scripts) {
          if (options.useStringArrays) {
            scriptData.script = convertBase64TextToArray(
              scriptData.script as string
            );
          }
          exportData.script[scriptData._id] = scriptData;
        }
      } catch (error) {
        errors.push(error);
      }
    }
  } catch (error) {
    error.message = `Error retrieving policies in policy set ${policySetData.name}: ${error.message}`;
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export dependencies error:\n${errorMessages}`);
  }
  debugMessage({
    message: `PolicySetOps.exportPolicySetDependencies: end`,
    state,
  });
}

/**
 * Export policy set
 * @param {string} policySetName policy set name
 * @param {PolicySetExportOptions} options export options
 * @returns {Promise<PolicySetExportInterface>} a promise that resolves to an PolicySetExportInterface object
 */
export async function exportPolicySet({
  policySetName,
  options = {
    deps: true,
    prereqs: false,
    useStringArrays: true,
  },
  state,
}: {
  policySetName: string;
  options?: PolicySetExportOptions;
  state: State;
}): Promise<PolicySetExportInterface> {
  debugMessage({ message: `PolicySetOps.exportPolicySet: start`, state });
  const exportData = createPolicySetExportTemplate({ state });
  const errors = [];
  try {
    const policySetData = await _getPolicySet({ policySetName, state });
    exportData.policyset[policySetData.name] = policySetData;
    if (options.prereqs) {
      try {
        await exportPolicySetPrerequisites({
          policySetData,
          exportData,
          state,
        });
      } catch (error) {
        errors.push(error);
      }
    }
    if (options.deps) {
      try {
        await exportPolicySetDependencies({
          policySetData,
          options,
          exportData,
          state,
        });
      } catch (error) {
        errors.push(error);
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({ message: `PolicySetOps.exportPolicySet: end`, state });
  return exportData;
}

/**
 * Export policy sets
 * @param {PolicySetExportOptions} options export options
 * @returns {Promise<PolicySetExportInterface>} a promise that resolves to an PolicySetExportInterface object
 */
export async function exportPolicySets({
  options = {
    deps: true,
    prereqs: false,
    useStringArrays: true,
  },
  state,
}: {
  options: PolicySetExportOptions;
  state: State;
}): Promise<PolicySetExportInterface> {
  debugMessage({ message: `PolicySetOps.exportPolicySet: start`, state });
  const exportData = createPolicySetExportTemplate({ state });
  const errors = [];
  try {
    const policySets = await readPolicySets({ state });
    createProgressIndicator({
      total: policySets.length,
      message: 'Exporting policy sets...',
      state,
    });
    for (const policySetData of policySets) {
      updateProgressIndicator({
        message: `Exporting policy set ${policySetData._id}`,
        state,
      });
      exportData.policyset[policySetData.name] = policySetData;
      if (options.prereqs) {
        try {
          await exportPolicySetPrerequisites({
            policySetData,
            exportData,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
      if (options.deps) {
        try {
          await exportPolicySetDependencies({
            policySetData,
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
      message: `Exported ${policySets.length} policy sets.`,
      state,
    });
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage({ message: `PolicySetOps.exportPolicySet: end`, state });
  return exportData;
}

/**
 * Helper function to import prerequisites of a policy set (resource types)
 * @param {PolicySetSkeleton} policySetData policy set data
 * @param {PolicySetExportInterface} exportData export data
 */
async function importPolicySetPrerequisites({
  policySetData,
  exportData,
  state,
}: {
  policySetData: PolicySetSkeleton;
  exportData: PolicySetExportInterface;
  state: State;
}) {
  debugMessage({
    message: `PolicySetOps.importPolicySetHardDependencies: start [policySet=${policySetData['name']}]`,
    state,
  });
  const errors = [];
  try {
    // resource types
    for (const resourceTypeUuid of policySetData.resourceTypeUuids) {
      if (exportData.resourcetype[resourceTypeUuid]) {
        try {
          debugMessage({
            message: `Importing resource type ${resourceTypeUuid}`,
            state,
          });
          await putResourceType({
            resourceTypeUuid,
            resourceTypeData: exportData.resourcetype[resourceTypeUuid],
            state,
          });
        } catch (error) {
          debugMessage({ message: error.response?.data, state });
          errors.push(error);
        }
      } else {
        errors.push(
          new Error(
            `No resource type definition with id ${resourceTypeUuid} found in import data.`
          )
        );
      }
    }
  } catch (error) {
    error.message = `Error importing hard dependencies for policy set ${policySetData.name}: ${error.message}`;
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import hard dependencies error:\n${errorMessages}`);
  }
  debugMessage({
    message: `PolicySetOps.importPolicySetHardDependencies: end`,
    state,
  });
}

/**
 * Helper function to import dependencies of a policy set (policies and scripts)
 * @param {PolicySetSkeleton} policySetData policy set data
 * @param {PolicySetExportInterface} exportData export data
 */
async function importPolicySetDependencies({
  policySetData,
  exportData,
  state,
}: {
  policySetData: PolicySetSkeleton;
  exportData: PolicySetExportInterface;
  state: State;
}) {
  debugMessage({
    message: `PolicySetOps.importPolicySetSoftDependencies: start [policySet=${policySetData['name']}]`,
    state,
  });
  const errors = [];
  try {
    // policies
    try {
      const policies = Object.values(exportData.policy).filter(
        (policy) => policy.applicationName === policySetData.name
      );
      for (const policyData of policies) {
        try {
          debugMessage({
            message: `Importing policy ${policyData._id}`,
            state,
          });
          await updatePolicy({ policyId: policyData._id, policyData, state });
        } catch (error) {
          debugMessage({ message: error.response?.data, state });
          error.message = `Error importing policy ${policyData._id} in policy set ${policySetData.name}: ${error.message}`;
          errors.push(error);
        }
        // scripts
        const scriptUuids = findScriptUuids(policyData.condition);
        for (const scriptUuid of scriptUuids) {
          try {
            const scriptData = exportData.script[scriptUuid];
            debugMessage({ message: `Importing script ${scriptUuid}`, state });
            await updateScript({ scriptId: scriptUuid, scriptData, state });
          } catch (error) {
            debugMessage({ message: error.response?.data, state });
            error.message = `Error importing script ${scriptUuid} for policy ${policyData._id} in policy set ${policySetData.name}: ${error.message}`;
            errors.push(error);
          }
        }
      }
    } catch (error) {
      error.message = `Error importing policies in policy set ${policySetData.name}: ${error.message}`;
      errors.push(error);
    }
  } catch (error) {
    error.message = `Error importing soft dependencies for policy set ${policySetData.name}: ${error.message}`;
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import soft dependencies error:\n${errorMessages}`);
  }
  debugMessage({
    message: `PolicySetOps.importPolicySetSoftDependencies: end`,
    state,
  });
}

/**
 * Import policy set
 * @param {string} policySetName policy set name
 * @param {PolicySetExportInterface} importData import data
 * @param {PolicySetImportOptions} options import options
 */
export async function importPolicySet({
  policySetName,
  importData,
  options = { deps: true, prereqs: false },
  state,
}: {
  policySetName: string;
  importData: PolicySetExportInterface;
  options?: PolicySetImportOptions;
  state: State;
}) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.policyset)) {
    if (id === policySetName) {
      try {
        const policySetData = importData.policyset[id];
        delete policySetData._rev;
        if (options.prereqs) {
          try {
            await importPolicySetPrerequisites({
              policySetData,
              exportData: importData,
              state,
            });
          } catch (error) {
            errors.push(error);
          }
        }
        try {
          response = await _createPolicySet({ policySetData, state });
          imported.push(id);
        } catch (error) {
          if (error.response?.status === 409) {
            response = await _updatePolicySet({ policySetData, state });
            imported.push(id);
          } else throw error;
        }
        if (options.deps) {
          try {
            await importPolicySetDependencies({
              policySetData,
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
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(
      `Import error:\n${policySetName} not found in import data!`
    );
  }
  return response;
}

/**
 * Import first policy set
 * @param {PolicySetExportInterface} importData import data
 * @param {PolicySetImportOptions} options import options
 */
export async function importFirstPolicySet({
  importData,
  options = { deps: true, prereqs: false },
  state,
}: {
  importData: PolicySetExportInterface;
  options?: PolicySetImportOptions;
  state: State;
}) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.policyset)) {
    try {
      const policySetData = importData.policyset[id];
      delete policySetData._provider;
      delete policySetData._rev;
      if (options.prereqs) {
        try {
          await importPolicySetPrerequisites({
            policySetData,
            exportData: importData,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        response = await _createPolicySet({ policySetData, state });
        imported.push(id);
      } catch (error) {
        if (error.response?.status === 409) {
          response = await _updatePolicySet({ policySetData, state });
          imported.push(id);
        } else throw error;
      }
      if (options.deps) {
        try {
          await importPolicySetDependencies({
            policySetData,
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
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo policy sets found in import data!`);
  }
  return response;
}

/**
 * Import policy sets
 * @param {PolicySetExportInterface} importData import data
 * @param {PolicySetImportOptions} options import options
 */
export async function importPolicySets({
  importData,
  options = { deps: true, prereqs: false },
  state,
}: {
  importData: PolicySetExportInterface;
  options?: PolicySetImportOptions;
  state: State;
}) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.policyset)) {
    try {
      const policySetData = importData.policyset[id];
      delete policySetData._rev;
      if (options.prereqs) {
        try {
          await importPolicySetPrerequisites({
            policySetData,
            exportData: importData,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        response = await _createPolicySet({ policySetData, state });
        imported.push(id);
      } catch (error) {
        if (error.response?.status === 409) {
          response = await _updatePolicySet({ policySetData, state });
          imported.push(id);
        } else throw error;
      }
      if (options.deps) {
        try {
          await importPolicySetDependencies({
            policySetData,
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
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Import error:\n${errorMessages}`);
  }
  if (0 === imported.length) {
    throw new Error(`Import error:\nNo policy sets found in import data!`);
  }
  return response;
}
