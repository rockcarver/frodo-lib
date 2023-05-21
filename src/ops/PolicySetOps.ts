import {
  deletePolicySet as _deletePolicySet,
  getPolicySets as _getPolicySets,
  getPolicySet as _getPolicySet,
  createPolicySet as _createPolicySet,
  updatePolicySet as _updatePolicySet,
} from '../api/PolicySetApi';
import { putScript } from './ScriptOps';
import { convertBase64TextToArray } from './utils/ExportImportUtils';
import { ExportMetaData } from './OpsTypes';
import {
  PolicySetSkeleton,
  PolicySkeleton,
  ResourceTypeSkeleton,
  ScriptSkeleton,
} from '../api/ApiTypes';
import { getMetadata } from './utils/ExportImportUtils';
import { debugMessage } from './utils/Console';
import { getResourceType, putResourceType } from '../api/ResourceTypesApi';
import {
  findScriptUuids,
  getPoliciesByPolicySet,
  getScripts,
  putPolicy,
} from './PolicyOps';

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
   * Use string arrays to store multi-line text in scripts.
   */
  useStringArrays: boolean;
  /**
   * Include any dependencies (policies, scripts, resource types).
   */
  deps: boolean;
}

/**
 * Policy set import options
 */
export interface PolicySetImportOptions {
  /**
   * Include any dependencies (policies, scripts, resource types).
   */
  deps: boolean;
}

/**
 * Create an empty export template
 * @returns {PolicySetExportInterface} an empty export template
 */
function createPolicySetExportTemplate(): PolicySetExportInterface {
  return {
    meta: getMetadata(),
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
export async function getPolicySets(): Promise<PolicySetSkeleton[]> {
  const { result } = await _getPolicySets();
  return result;
}

/**
 * Get policy set
 * @param {string} policySetId policy set id/name
 * @returns {Promise<PolicySetSkeleton>} a promise that resolves to a policy set object
 */
export async function getPolicySet(
  policySetId: string
): Promise<PolicySetSkeleton> {
  return _getPolicySet(policySetId);
}

/**
 * Create policy set
 * @param {PolicySetSkeleton} policySetData policy set object
 * @returns {Promise<PolicySetSkeleton>} a promise that resolves to a policy set object
 */
export async function createPolicySet(
  policySetData: PolicySetSkeleton
): Promise<PolicySetSkeleton> {
  return _createPolicySet(policySetData);
}

/**
 * Update policy set
 * @param {PolicySetSkeleton} policySetData policy set object
 * @returns {Promise<PolicySetSkeleton>} a promise that resolves to a policy set object
 */
export async function updatePolicySet(
  policySetData: PolicySetSkeleton
): Promise<PolicySetSkeleton> {
  return _updatePolicySet(policySetData);
}

/**
 * Delete policy set
 * @param {string} policySetId policy set id/name
 * @returns {Promise<PolicySetSkeleton>} Promise resolvig to a policy set object
 */
export async function deletePolicySet(
  policySetId: string
): Promise<PolicySetSkeleton> {
  return _deletePolicySet(policySetId);
}

/**
 * Helper function to export dependencies of a policy set
 * @param {unknown} policySetData policy set data
 * @param {PolicySetExportOptions} options export options
 * @param {PolicySetExportInterface} exportData export data
 */
async function exportPolicySetDependencies(
  policySetData: PolicySetSkeleton,
  options: PolicySetExportOptions,
  exportData: PolicySetExportInterface
) {
  debugMessage(
    `PolicySetOps.exportPolicySetDependencies: start [policySet=${policySetData['name']}]`
  );
  const errors = [];
  // resource types
  for (const resourceTypeUuid of policySetData.resourceTypeUuids) {
    try {
      const resourceType = await getResourceType(resourceTypeUuid);
      exportData.resourcetype[resourceTypeUuid] = resourceType;
    } catch (error) {
      error.message = `Error retrieving resource type ${resourceTypeUuid} for policy set ${policySetData.name}: ${error.message}`;
      errors.push(error);
    }
  }
  // policies
  try {
    const policies = await getPoliciesByPolicySet(policySetData.name);
    for (const policy of policies) {
      exportData.policy[policy.name] = policy;
      // scripts
      try {
        const scripts = await getScripts(policy);
        for (const scriptData of scripts) {
          if (options.useStringArrays) {
            scriptData.script = convertBase64TextToArray(scriptData.script);
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
  debugMessage(`PolicySetOps.exportPolicySetDependencies: end`);
}

/**
 * Export policy set
 * @param {string} policySetId policy set id
 * @param {PolicySetExportOptions} options export options
 * @returns {Promise<PolicySetExportInterface>} a promise that resolves to an PolicySetExportInterface object
 */
export async function exportPolicySet(
  policySetId: string,
  options: PolicySetExportOptions
): Promise<PolicySetExportInterface> {
  debugMessage(`PolicySetOps.exportPolicySet: start`);
  const exportData = createPolicySetExportTemplate();
  const errors = [];
  try {
    const policySetData = await getPolicySet(policySetId);
    exportData.policyset[policySetData.name] = policySetData;
    if (options.deps) {
      await exportPolicySetDependencies(policySetData, options, exportData);
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Export error:\n${errorMessages}`);
  }
  debugMessage(`PolicySetOps.exportPolicySet: end`);
  return exportData;
}

/**
 * Export policy sets
 * @param {PolicySetExportOptions} options export options
 * @returns {Promise<PolicySetExportInterface>} a promise that resolves to an PolicySetExportInterface object
 */
export async function exportPolicySets(
  options: PolicySetExportOptions
): Promise<PolicySetExportInterface> {
  debugMessage(`PolicySetOps.exportPolicySet: start`);
  const exportData = createPolicySetExportTemplate();
  const errors = [];
  try {
    const policySets = await getPolicySets();
    for (const policySetData of policySets) {
      exportData.policyset[policySetData.name] = policySetData;
      if (options.deps) {
        try {
          await exportPolicySetDependencies(policySetData, options, exportData);
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
  debugMessage(`PolicySetOps.exportPolicySet: end`);
  return exportData;
}

/**
 * Helper function to import hard dependencies of a policy set
 * @param {PolicySetSkeleton} policySetData policy set data
 * @param {PolicySetExportInterface} exportData export data
 */
async function importPolicySetHardDependencies(
  policySetData: PolicySetSkeleton,
  exportData: PolicySetExportInterface
) {
  debugMessage(
    `PolicySetOps.importPolicySetHardDependencies: start [policySet=${policySetData['name']}]`
  );
  const errors = [];
  try {
    // resource types
    for (const resourceTypeUuid of policySetData.resourceTypeUuids) {
      if (exportData.resourcetype[resourceTypeUuid]) {
        try {
          debugMessage(`Importing resource type ${resourceTypeUuid}`);
          await putResourceType(
            resourceTypeUuid,
            exportData.resourcetype[resourceTypeUuid]
          );
        } catch (error) {
          debugMessage(error.response?.data);
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
  debugMessage(`PolicySetOps.importPolicySetHardDependencies: end`);
}

/**
 * Helper function to import soft dependencies of a policy set
 * @param {PolicySetSkeleton} policySetData policy set data
 * @param {PolicySetExportInterface} exportData export data
 */
async function importPolicySetSoftDependencies(
  policySetData: PolicySetSkeleton,
  exportData: PolicySetExportInterface
) {
  debugMessage(
    `PolicySetOps.importPolicySetSoftDependencies: start [policySet=${policySetData['name']}]`
  );
  const errors = [];
  try {
    // policies
    try {
      const policies = Object.values(exportData.policy).filter(
        (policy) => policy.applicationName === policySetData.name
      );
      for (const policyData of policies) {
        try {
          debugMessage(`Importing policy ${policyData._id}`);
          await putPolicy(policyData._id, policyData);
        } catch (error) {
          debugMessage(error.response?.data);
          error.message = `Error importing policy ${policyData._id} in policy set ${policySetData.name}: ${error.message}`;
          errors.push(error);
        }
        // scripts
        const scriptUuids = findScriptUuids(policyData.condition);
        for (const scriptUuid of scriptUuids) {
          try {
            const scriptData = exportData.script[scriptUuid];
            debugMessage(`Importing script ${scriptUuid}`);
            await putScript(scriptUuid, scriptData);
          } catch (error) {
            debugMessage(error.response?.data);
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
  debugMessage(`PolicySetOps.importPolicySetSoftDependencies: end`);
}

/**
 * Import policy set
 * @param {string} policySetId client id
 * @param {PolicySetExportInterface} importData import data
 * @param {PolicySetImportOptions} options import options
 */
export async function importPolicySet(
  policySetId: string,
  importData: PolicySetExportInterface,
  options: PolicySetImportOptions = { deps: true }
) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.policyset)) {
    if (id === policySetId) {
      try {
        const policySetData = importData.policyset[id];
        delete policySetData._rev;
        if (options.deps) {
          try {
            await importPolicySetHardDependencies(policySetData, importData);
          } catch (error) {
            errors.push(error);
          }
        }
        try {
          response = await createPolicySet(policySetData);
          imported.push(id);
        } catch (error) {
          if (error.response?.status === 409) {
            response = await updatePolicySet(policySetData);
            imported.push(id);
          } else throw error;
        }
        if (options.deps) {
          try {
            await importPolicySetSoftDependencies(policySetData, importData);
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
    throw new Error(`Import error:\n${policySetId} not found in import data!`);
  }
  return response;
}

/**
 * Import first policy set
 * @param {PolicySetExportInterface} importData import data
 * @param {PolicySetImportOptions} options import options
 */
export async function importFirstPolicySet(
  importData: PolicySetExportInterface,
  options: PolicySetImportOptions = { deps: true }
) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.policyset)) {
    try {
      const policySetData = importData.policyset[id];
      delete policySetData._provider;
      delete policySetData._rev;
      if (options.deps) {
        try {
          await importPolicySetHardDependencies(policySetData, importData);
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        response = await createPolicySet(policySetData);
        imported.push(id);
      } catch (error) {
        if (error.response?.status === 409) {
          response = await updatePolicySet(policySetData);
          imported.push(id);
        } else throw error;
      }
      if (options.deps) {
        try {
          await importPolicySetSoftDependencies(policySetData, importData);
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
export async function importPolicySets(
  importData: PolicySetExportInterface,
  options: PolicySetImportOptions = { deps: true }
) {
  let response = null;
  const errors = [];
  const imported = [];
  for (const id of Object.keys(importData.policyset)) {
    try {
      const policySetData = importData.policyset[id];
      delete policySetData._rev;
      if (options.deps) {
        try {
          await importPolicySetHardDependencies(policySetData, importData);
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        response = await createPolicySet(policySetData);
        imported.push(id);
      } catch (error) {
        if (error.response?.status === 409) {
          response = await updatePolicySet(policySetData);
          imported.push(id);
        } else throw error;
      }
      if (options.deps) {
        try {
          await importPolicySetSoftDependencies(policySetData, importData);
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
