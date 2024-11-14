import { type IdObjectSkeletonInterface } from '../api/ApiTypes';
import {
  createInternalObject,
  deleteInternalObject,
  getInternalObject,
  putInternalObject,
  queryAllInternalObjectsByType,
  queryInternalObjects,
} from '../api/InternalObjectApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { FrodoError } from './FrodoError';
import { type ExportMetaData } from './OpsTypes';

const defaultFields = [
  'condition',
  'description',
  'name',
  'privileges',
  'temporalConstraints',
];

const INTERNAL_ROLE_TYPE = 'role';

export type InternalRole = {
  /**
   * Create an empty internal role export template
   * @returns {InternalRoleExportInterface} an empty internal role export template
   */
  createInternalRoleExportTemplate(): InternalRoleExportInterface;
  /**
   * Create internal role
   * @param {InternalRoleSkeleton} roleData internal role data
   * @returns {Promise<InternalRoleSkeleton>} a promise that resolves to an internal role object
   */
  createInternalRole(
    roleData: InternalRoleSkeleton
  ): Promise<InternalRoleSkeleton>;
  /**
   * Read internal role
   * @param {string} roleId internal role uuid
   * @returns {Promise<InternalRoleSkeleton>} a promise that resolves to an internal role object
   */
  readInternalRole(roleId: string): Promise<InternalRoleSkeleton>;
  /**
   * Read internal role by name
   * @param {string} roleName internal role name
   * @returns {Promise<InternalRoleSkeleton>} a promise that resolves to an internal role object
   */
  readInternalRoleByName(roleName: string): Promise<InternalRoleSkeleton>;
  /**
   * Read all internal roles. Results are sorted aphabetically.
   * @returns {Promise<InternalRoleSkeleton[]>} a promise that resolves to an array of internal role objects
   */
  readInternalRoles(): Promise<InternalRoleSkeleton[]>;
  /**
   * Update internal role
   * @param {string} roleId internal role uuid
   * @param {InternalRoleSkeleton} roleData internal role data
   * @returns {Promise<InternalRoleSkeleton>} a promise that resolves to an internal role object
   */
  updateInternalRole(
    roleId: string,
    roleData: InternalRoleSkeleton
  ): Promise<InternalRoleSkeleton>;
  /**
   * Delete internal role
   * @param {string} roleId internal role uuid
   * @returns {Promise<InternalRoleSkeleton>} a promise that resolves to an internal role object
   */
  deleteInternalRole(
    roleId: string
  ): Promise<InternalRoleSkeleton>;
  /**
   * Delete internal role by name
   * @param {string} roleName internal role name
   * @returns {Promise<InternalRoleSkeleton>} a promise that resolves to an internal role object
   */
  deleteInternalRoleByName(
    roleName: string
  ): Promise<InternalRoleSkeleton>;
  /**
   * Delete all internal roles
   * @returns {Promise<InternalRoleSkeleton[]>} a promise that resolves to an array of internal role objects
   */
  deleteInternalRoles(): Promise<InternalRoleSkeleton[]>;
  /**
   * Query internal roles
   * @param filter CREST search filter
   * @param fields array of fields to return
   */
  queryInternalRoles(
    filter: string,
    fields?: string[]
  ): Promise<InternalRoleSkeleton[]>;
  /**
   * Export internal role. The response can be saved to file as is.
   * @param {string} roleId internal role uuid
   * @returns {Promise<InternalRoleExportInterface} Promise resolving to an InternalRoleExportInterface object.
   */
  exportInternalRole(roleId: string): Promise<InternalRoleExportInterface>;
  /**
   * Export internal role by name. The response can be saved to file as is.
   * @param {string} roleName internal role name
   * @returns {Promise<InternalRoleExportInterface} Promise resolving to an InternalRoleExportInterface object.
   */
  exportInternalRoleByName(
    roleName: string
  ): Promise<InternalRoleExportInterface>;
  /**
   * Export all internal roles. The response can be saved to file as is.
   * @returns {Promise<InternalRoleExportInterface>} Promise resolving to an InternalRoleExportInterface object.
   */
  exportInternalRoles(): Promise<InternalRoleExportInterface>;
  /**
   * Import internal role. The import data is usually read from an internal role export file.
   * @param {string} roleId internal role uuid
   * @param {InternalRoleExportInterface} importData internal role import data.
   * @returns {Promise<InternalRoleSkeleton>} Promise resolving to an internal role object.
   */
  importInternalRole(
    roleId: string,
    importData: InternalRoleExportInterface
  ): Promise<InternalRoleSkeleton>;
  /**
   * Import internal role by name. The import data is usually read from an internal role export file.
   * @param {string} roleName internal role name
   * @param {InternalRoleExportInterface} importData internal role import data.
   * @returns {Promise<InternalRoleSkeleton>} Promise resolving to an internal role object.
   */
  importInternalRoleByName(
    roleName: string,
    importData: InternalRoleExportInterface
  ): Promise<InternalRoleSkeleton>;
  /**
   * Import first internal role. The import data is usually read from an internal role export file.
   * @param {InternalRoleExportInterface} importData internal role import data.
   */
  importFirstInternalRole(
    importData: InternalRoleExportInterface
  ): Promise<InternalRoleSkeleton[]>;
  /**
   * Import internal roles. The import data is usually read from an internal role export file.
   * @param {InternalRoleExportInterface} importData internal role import data.
   */
  importInternalRoles(
    importData: InternalRoleExportInterface
  ): Promise<InternalRoleSkeleton[]>;
};

export default (state: State): InternalRole => {
  return {
    createInternalRoleExportTemplate(): InternalRoleExportInterface {
      return createInternalRoleExportTemplate({ state });
    },
    async createInternalRole(
      roleData: InternalRoleSkeleton
    ): Promise<InternalRoleSkeleton> {
      return createInternalRole({
        roleData,
        state,
      });
    },
    async readInternalRole(
      roleId: string,
      fields = defaultFields
    ): Promise<InternalRoleSkeleton> {
      return readInternalRole({ roleId, fields, state });
    },
    async readInternalRoleByName(
      roleName: string,
      fields = defaultFields
    ): Promise<InternalRoleSkeleton> {
      return readInternalRoleByName({ roleName, fields, state });
    },
    async readInternalRoles(): Promise<InternalRoleSkeleton[]> {
      return readInternalRoles({ state });
    },
    async updateInternalRole(
      roleId: string,
      ioData: InternalRoleSkeleton
    ): Promise<InternalRoleSkeleton> {
      return updateInternalRole({
        roleId,
        roleData: ioData,
        state,
      });
    },
    async deleteInternalRole(roleId: string): Promise<InternalRoleSkeleton> {
      return deleteInternalRole({ roleId, state });
    },
    async deleteInternalRoleByName(
      roleName: string
    ): Promise<InternalRoleSkeleton> {
      return deleteInternalRoleByName({
        roleName,
        state,
      });
    },
    async deleteInternalRoles(): Promise<InternalRoleSkeleton[]> {
      return deleteInternalRoles({ state });
    },
    async queryInternalRoles(
      filter: string,
      fields: string[] = defaultFields
    ): Promise<InternalRoleSkeleton[]> {
      return queryInternalRoles({ filter, fields, state });
    },
    async exportInternalRole(
      roleId: string
    ): Promise<InternalRoleExportInterface> {
      return exportInternalRole({ roleId, state });
    },
    async exportInternalRoleByName(
      roleName: string
    ): Promise<InternalRoleExportInterface> {
      return exportInternalRoleByName({ roleName, state });
    },
    async exportInternalRoles(): Promise<InternalRoleExportInterface> {
      return exportInternalRoles({ state });
    },
    async importInternalRole(
      roleId: string,
      importData: InternalRoleExportInterface
    ): Promise<InternalRoleSkeleton> {
      return importInternalRole({ roleId, importData, state });
    },
    async importInternalRoleByName(
      roleName: string,
      importData: InternalRoleExportInterface
    ): Promise<InternalRoleSkeleton> {
      return importInternalRoleByName({
        roleName,
        importData,
        state,
      });
    },
    async importFirstInternalRole(
      importData: InternalRoleExportInterface
    ): Promise<InternalRoleSkeleton[]> {
      return importInternalRoles({ importData, state });
    },
    async importInternalRoles(
      importData: InternalRoleExportInterface
    ): Promise<InternalRoleSkeleton[]> {
      return importInternalRoles({ importData, state });
    },
  };
};

export type InternalRoleSkeleton = IdObjectSkeletonInterface & {
  condition: string;
  description: string;
  name: string;
  privileges: {
    accessFlags: {
      attribute: string;
      readOnly: boolean;
    }[];
    actions: string[];
    filter: string;
    name: string;
    path: string;
    permissions: string[];
  }[];
  temporalConstraints: { duration: string }[];
};

/**
 * Export format for internal roles
 */
export interface InternalRoleExportInterface {
  /**
   * Metadata
   */
  meta?: ExportMetaData;
  /**
   * Internal roles
   */
  internalRole: Record<string, InternalRoleSkeleton>;
}

export function createInternalRoleExportTemplate({
  state,
}: {
  state: State;
}): InternalRoleExportInterface {
  return {
    meta: getMetadata({ state }),
    internalRole: {},
  } as InternalRoleExportInterface;
}

export async function createInternalRole({
  roleData,
  state,
}: {
  roleData: InternalRoleSkeleton;
  state: State;
}): Promise<InternalRoleSkeleton> {
  try {
    // Due to a bug with the temporal constraint policy, you cannot use empty arrays for temporalConstraints. However, deleting the array entirely before creating achieves the same effect.
    if (
      roleData.temporalConstraints &&
      roleData.temporalConstraints.length === 0
    ) {
      delete roleData.temporalConstraints;
    }
    const role = await createInternalObject({
      ioType: INTERNAL_ROLE_TYPE,
      ioData: roleData,
      state,
    });
    return role as InternalRoleSkeleton;
  } catch (error) {
    throw new FrodoError(`Error creating internal role ${roleData._id}`, error);
  }
}

export async function readInternalRole({
  roleId,
  fields = defaultFields,
  state,
}: {
  roleId: string;
  fields?: string[];
  state: State;
}): Promise<InternalRoleSkeleton> {
  try {
    const role = await getInternalObject({
      type: INTERNAL_ROLE_TYPE,
      id: roleId,
      fields,
      state,
    });
    return role as InternalRoleSkeleton;
  } catch (error) {
    throw new FrodoError(`Error reading internal role ${roleId}`, error);
  }
}

export async function readInternalRoleByName({
  roleName,
  fields = defaultFields,
  state,
}: {
  roleName: string;
  fields?: string[];
  state: State;
}): Promise<InternalRoleSkeleton> {
  try {
    const roles = await queryInternalRoles({
      filter: `name eq '${roleName}'`,
      fields,
      state,
    });
    switch (roles.length) {
      case 1:
        return roles[0];
      case 0:
        throw new Error(`InternalRole '${roleName}' not found`);
      default:
        throw new Error(`${roles.length} internal roles '${roleName}' found`);
    }
  } catch (error) {
    throw new FrodoError(`Error reading internal role ${roleName}`, error);
  }
}

export async function readInternalRoles({
  fields = defaultFields,
  state,
}: {
  fields?: string[];
  state: State;
}): Promise<InternalRoleSkeleton[]> {
  try {
    const { result } = await queryAllInternalObjectsByType({
      type: INTERNAL_ROLE_TYPE,
      fields,
      state,
    });
    return result as InternalRoleSkeleton[];
  } catch (error) {
    throw new FrodoError(`Error reading internal roles`, error);
  }
}

export async function updateInternalRole({
  roleId,
  roleData,
  state,
}: {
  roleId: string;
  roleData: InternalRoleSkeleton;
  state: State;
}): Promise<InternalRoleSkeleton> {
  try {
    // Due to a bug with the temporal constraint policy, you cannot use empty arrays for temporalConstraints. However, deleting the array entirely before updating achieves the same effect.
    if (
      roleData.temporalConstraints &&
      roleData.temporalConstraints.length === 0
    ) {
      delete roleData.temporalConstraints;
    }
    const role = await putInternalObject({
      type: INTERNAL_ROLE_TYPE,
      id: roleId,
      ioData: roleData,
      failIfExists: false,
      state,
    });
    return role as InternalRoleSkeleton;
  } catch (error) {
    throw new FrodoError(`Error updating internal role ${roleId}`, error);
  }
}

export async function deleteInternalRole({
  roleId,
  state,
}: {
  roleId: string;
  state: State;
}): Promise<InternalRoleSkeleton> {
  try {
    debugMessage({
      message: `InternalRoleOps.deleteInternalRole: start`,
      state,
    });
    const roleData: InternalRoleSkeleton = (await deleteInternalObject({
      type: INTERNAL_ROLE_TYPE,
      id: roleId,
      state,
    })) as InternalRoleSkeleton;
    debugMessage({ message: `InternalRoleOps.deleteInternalRole: end`, state });
    return roleData as InternalRoleSkeleton;
  } catch (error) {
    throw new FrodoError(`Error deleting internal role ${roleId}`, error);
  }
}

export async function deleteInternalRoleByName({
  roleName,
  state,
}: {
  roleName: string;
  state: State;
}): Promise<InternalRoleSkeleton> {
  let roles: InternalRoleSkeleton[] = [];
  try {
    roles = await queryInternalRoles({
      filter: `name eq '${roleName}'`,
      fields: ['_id'],
      state,
    });
    if (roles.length == 1) {
      return deleteInternalRole({
        roleId: roles[0]._id,
        state,
      });
    }
  } catch (error) {
    throw new FrodoError(`Error deleting internal role ${roleName}`, error);
  }
  if (roles.length == 0) {
    throw new FrodoError(`InternalRole '${roleName}' not found`);
  }
  if (roles.length > 1) {
    throw new FrodoError(`${roles.length} internal roles '${roleName}' found`);
  }
}

export async function deleteInternalRoles({
  state,
}: {
  state: State;
}): Promise<InternalRoleSkeleton[]> {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `InternalRoleOps.deleteInternalRoles: start`,
      state,
    });
    const roles = await readInternalRoles({
      state,
    });
    const deleted: InternalRoleSkeleton[] = [];
    for (const role of roles) {
      debugMessage({
        message: `InternalRoleOps.deleteInternalRoles: '${role['_id']}'`,
        state,
      });
      try {
        deleted.push(
          await deleteInternalRole({
            roleId: role['_id'],
            state,
          })
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) {
      throw new FrodoError(`Error deleting internal roles`, errors);
    }
    debugMessage({
      message: `InternalRoleOps.deleteInternalRoles: end`,
      state,
    });
    return deleted;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting internal roles`, error);
  }
}

export async function queryInternalRoles({
  filter,
  fields = defaultFields,
  state,
}: {
  filter: string;
  fields?: string[];
  state: State;
}): Promise<InternalRoleSkeleton[]> {
  try {
    const { result } = await queryInternalObjects({
      type: INTERNAL_ROLE_TYPE,
      filter,
      fields,
      state,
    });
    return result as InternalRoleSkeleton[];
  } catch (error) {
    throw new FrodoError(
      `Error querying internal roles with filter ${filter}`,
      error
    );
  }
}

export async function exportInternalRole({
  roleId,
  state,
}: {
  roleId: string;
  state: State;
}): Promise<InternalRoleExportInterface> {
  try {
    debugMessage({
      message: `InternalRoleOps.exportInternalRole: start`,
      state,
    });
    const roleData = await readInternalRole({ roleId, state });
    const exportData = createInternalRoleExportTemplate({ state });
    exportData.internalRole[roleData._id] = roleData;
    debugMessage({ message: `InternalRoleOps.exportInternalRole: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting internal role ${roleId}`, error);
  }
}

export async function exportInternalRoleByName({
  roleName,
  state,
}: {
  roleName: string;
  state: State;
}): Promise<InternalRoleExportInterface> {
  try {
    debugMessage({
      message: `InternalRoleOps.exportInternalRoleByName: start`,
      state,
    });
    const roleData = await readInternalRoleByName({
      roleName,
      state,
    });
    const exportData = createInternalRoleExportTemplate({ state });
    exportData.internalRole[roleData._id] = roleData;
    debugMessage({
      message: `InternalRoleOps.exportInternalRoleByName: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting internal role ${roleName}`, error);
  }
}

export async function exportInternalRoles({
  state,
}: {
  state: State;
}): Promise<InternalRoleExportInterface> {
  const errors: Error[] = [];
  let indicatorId: string;
  try {
    debugMessage({
      message: `InternalRoleOps.exportInternalRole: start`,
      state,
    });
    const exportData = createInternalRoleExportTemplate({ state });
    const roles = await readInternalRoles({ state });
    indicatorId = createProgressIndicator({
      total: roles.length,
      message: 'Exporting internal roles...',
      state,
    });
    for (const roleData of roles) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting internal role ${roleData.name}`,
        state,
      });
      exportData.internalRole[roleData._id] = roleData;
    }
    if (errors.length > 0) {
      stopProgressIndicator({
        id: indicatorId,
        message: `Error exporting internal roles`,
        status: 'fail',
        state,
      });
      throw new FrodoError(`Error exporting internal roles`, errors);
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${roles.length} internal roles`,
      state,
    });
    debugMessage({ message: `InternalRoleOps.exportInternalRole: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting internal roles`,
      status: 'fail',
      state,
    });
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error exporting internal roles`, error);
  }
}

/**
 * Import internal role
 * @param {string} clientId client id
 * @param {InternalRoleExportInterface} importData import data
 * @returns {Promise<InternalRoleSkeleton>} a promise resolving to an oauth2 client
 */
export async function importInternalRole({
  roleId,
  importData,
  state,
}: {
  roleId: string;
  importData: InternalRoleExportInterface;
  state: State;
}): Promise<InternalRoleSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  try {
    for (const id of Object.keys(importData.internalRole)) {
      if (id === roleId) {
        try {
          const roleData = importData.internalRole[id];
          delete roleData._provider;
          delete roleData._rev;
          response = await updateInternalRole({
            roleId,
            roleData,
            state,
          });
          imported.push(id);
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing internal role ${roleId}`, errors);
    }
    if (0 === imported.length) {
      throw new FrodoError(
        `Import error:\n${roleId} not found in import data!`
      );
    }
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0 || imported.length == 0) {
      throw error;
    }
    throw new FrodoError(`Error importing internal role ${roleId}`, error);
  }
}

/**
 * Import internal role
 * @param {string} clientId client id
 * @param {InternalRoleExportInterface} importData import data
 * @returns {Promise<InternalRoleSkeleton>} a promise resolving to an oauth2 client
 */
export async function importInternalRoleByName({
  roleName: roleName,
  importData,
  state,
}: {
  roleName: string;
  importData: InternalRoleExportInterface;
  state: State;
}): Promise<InternalRoleSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  try {
    for (const roleId of Object.keys(importData.internalRole)) {
      if (importData.internalRole[roleId].name === roleName) {
        try {
          const roleData = importData.internalRole[roleId];
          delete roleData._provider;
          delete roleData._rev;
          response = await updateInternalRole({
            roleId,
            roleData,
            state,
          });
          imported.push(roleId);
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing internal role ${roleName}`, errors);
    }
    if (0 === imported.length) {
      throw new FrodoError(
        `Import error:\n${roleName} not found in import data!`
      );
    }
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0 || imported.length == 0) {
      throw error;
    }
    throw new FrodoError(`Error importing internal role ${roleName}`, error);
  }
}

/**
 * Import first internal role
 * @param {InternalRoleExportInterface} importData import data
 * @returns {Promise<InternalRoleSkeleton[]>} a promise resolving to an array of oauth2 clients
 */
export async function importFirstInternalRole({
  importData,
  state,
}: {
  importData: InternalRoleExportInterface;
  state: State;
}): Promise<InternalRoleSkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  try {
    for (const roleId of Object.keys(importData.internalRole)) {
      try {
        const roleData = importData.internalRole[roleId];
        delete roleData._provider;
        delete roleData._rev;
        response = await updateInternalRole({
          roleId,
          roleData,
          state,
        });
        imported.push(roleId);
      } catch (error) {
        errors.push(error);
      }
      break;
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing first internal role`, errors);
    }
    if (0 === imported.length) {
      throw new FrodoError(
        `Import error:\nNo internal roles found in import data!`
      );
    }
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0 || imported.length == 0) {
      throw error;
    }
    throw new FrodoError(`Error importing first internal role`, error);
  }
}

/**
 * Import internal roles
 * @param {InternalRoleExportInterface} importData import data
 * @returns {Promise<InternalRoleSkeleton[]>} a promise resolving to an array of oauth2 clients
 */
export async function importInternalRoles({
  importData,
  state,
}: {
  importData: InternalRoleExportInterface;
  state: State;
}): Promise<InternalRoleSkeleton[]> {
  const response = [];
  const errors = [];
  try {
    for (const roleId of Object.keys(importData.internalRole)) {
      const roleData = importData.internalRole[roleId];
      delete roleData._provider;
      delete roleData._rev;
      try {
        response.push(
          await updateInternalRole({
            roleId,
            roleData,
            state,
          })
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) {
      throw new FrodoError(`Error importing internal roles`, errors);
    }
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing internal roles`, error);
  }
}
