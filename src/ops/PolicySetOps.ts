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
import { FrodoError } from './FrodoError';
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
   * @returns {any[]} The imported policy sets
   */
  importPolicySets(
    importData: PolicySetExportInterface,
    options?: PolicySetImportOptions
  ): Promise<any[]>;

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
  try {
    const { result } = await _getPolicySets({ state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading policy sets`, error);
  }
}

export async function readPolicySet({
  policySetName,
  state,
}: {
  policySetName: string;
  state: State;
}) {
  try {
    const response = await _getPolicySet({ policySetName, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error reading policy set ${policySetName}`, error);
  }
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
  try {
    if (!policySetName) {
      const response = await _createPolicySet({ policySetData, state });
      return response;
    }
    const response = await _updatePolicySet({
      policySetName,
      policySetData,
      state,
    });
    return response;
  } catch (error) {
    throw new FrodoError(`Error creating policy set ${policySetName}`, error);
  }
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
  try {
    const response = await _updatePolicySet({
      policySetName,
      policySetData,
      state,
    });
    return response;
  } catch (error) {
    throw new FrodoError(`Error updating policy set ${policySetName}`, error);
  }
}

export async function deletePolicySet({
  policySetName,
  state,
}: {
  policySetName: string;
  state: State;
}) {
  try {
    const response = await _deletePolicySet({ policySetName, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error deleting policy set ${policySetName}`, error);
  }
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
      errors.push(
        new FrodoError(
          `Error retrieving resource type ${resourceTypeUuid} for policy set ${policySetData.name}`,
          error
        )
      );
    }
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error exporting policy set prerequisites`, errors);
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
    if (errors.length > 0) {
      throw new FrodoError(
        `Error exporting policy set ${policySetData.name} dependencies`
      );
    }
    debugMessage({
      message: `PolicySetOps.exportPolicySetDependencies: end`,
      state,
    });
  } catch (error) {
    // re-throw previously caught error
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error exporting policy set ${policySetData.name} dependencies`,
      error
    );
  }
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
    if (errors.length > 0) {
      throw new FrodoError(
        `Error exporting policy set ${policySetName}`,
        errors
      );
    }
    debugMessage({ message: `PolicySetOps.exportPolicySet: end`, state });
    return exportData;
  } catch (error) {
    // re-throw previously caught error
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error exporting policy set ${policySetName}`, error);
  }
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
  let indicatorId: string;
  try {
    const policySets = await readPolicySets({ state });
    indicatorId = createProgressIndicator({
      total: policySets.length,
      message: 'Exporting policy sets...',
      state,
    });
    for (const policySetData of policySets) {
      updateProgressIndicator({
        id: indicatorId,
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
      id: indicatorId,
      message: `Exported ${policySets.length} policy sets.`,
      state,
    });
    if (errors.length > 0) {
      throw new FrodoError(`Error exporting policy sets`, errors);
    }
    debugMessage({ message: `PolicySetOps.exportPolicySet: end`, state });
    return exportData;
  } catch (error) {
    // re-throw previously caught error
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error exporting policy sets`, error);
  }
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
          errors.push(error);
        }
      } else {
        errors.push(
          new FrodoError(
            `No resource type definition with id ${resourceTypeUuid} found in import data.`
          )
        );
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing hard dependencies for policy set ${policySetData.name}`,
        errors
      );
    }
    debugMessage({
      message: `PolicySetOps.importPolicySetHardDependencies: end`,
      state,
    });
  } catch (error) {
    // re-throw previously caught error
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing hard dependencies for policy set ${policySetData.name}`,
      error
    );
  }
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
        errors.push(
          new FrodoError(
            `Error importing policy ${policyData._id} in policy set ${policySetData.name}`,
            error
          )
        );
      }
      // scripts
      const scriptUuids = findScriptUuids(policyData.condition);
      for (const scriptUuid of scriptUuids) {
        try {
          const scriptData = exportData.script[scriptUuid];
          debugMessage({ message: `Importing script ${scriptUuid}`, state });
          await updateScript({ scriptId: scriptUuid, scriptData, state });
        } catch (error) {
          errors.push(
            new FrodoError(
              `Error importing script ${scriptUuid} for policy ${policyData._id} in policy set ${policySetData.name}`,
              error
            )
          );
        }
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing soft dependencies for policy set ${policySetData.name}`,
        errors
      );
    }
    debugMessage({
      message: `PolicySetOps.importPolicySetSoftDependencies: end`,
      state,
    });
  } catch (error) {
    // re-throw previously caught error
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing soft dependencies for policy set ${policySetData.name}`,
      error
    );
  }
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
  if (errors.length > 0) {
    throw new FrodoError(`Error importing policy set ${policySetName}`, errors);
  }
  if (0 === imported.length) {
    throw new FrodoError(
      `Policy set ${policySetName} not found in import data`
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
  if (errors.length > 0) {
    throw new FrodoError(`Error importing first policy set`, errors);
  }
  if (0 === imported.length) {
    throw new FrodoError(`No policy sets found in import data`);
  }
  return response;
}

/**
 * Import policy sets
 * @param {PolicySetExportInterface} importData import data
 * @param {PolicySetImportOptions} options import options
 * @returns {any[]} The imported policy sets
 */
export async function importPolicySets({
  importData,
  options = { deps: true, prereqs: false },
  state,
}: {
  importData: PolicySetExportInterface;
  options?: PolicySetImportOptions;
  state: State;
}): Promise<any[]> {
  const response: any[] = [];
  const errors = [];
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
        response.push(await _createPolicySet({ policySetData, state }));
      } catch (error) {
        if (error.response?.status === 409) {
          response.push(await _updatePolicySet({ policySetData, state }));
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
  if (errors.length > 0) {
    throw new FrodoError(`Error importing policy sets`, errors);
  }
  return response;
}
