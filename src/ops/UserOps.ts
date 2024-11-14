import {
  getUser,
  getUserConfig,
  getUserGroup,
  getUserGroups,
  getUsers,
  putUser,
  putUserConfig,
  putUserGroup,
  UserConfigSkeleton,
  UserGroupSkeleton,
  UserSkeleton,
} from '../api/UserApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { FrodoError } from './FrodoError';
import { ExportMetaData } from './OpsTypes';

export type User = {
  /**
   * Create an empty user export template
   * @returns {UserExportInterface} an empty user export template
   */
  createUserExportTemplate(): UserExportInterface;
  /**
   * Read user by id
   * @param {string} userId User id
   * @returns {Promise<UserSkeleton>} a promise that resolves to a user object
   */
  readUser(userId: string): Promise<UserSkeleton>;
  /**
   * Read all users.
   * @returns {Promise<UserSkeleton[]>} a promise that resolves to an array of user objects
   */
  readUsers(): Promise<UserSkeleton[]>;
  /**
   * Export a single user by id. The response can be saved to file as is.
   * @param {string} userId User id
   * @returns {Promise<UserExportInterface>} Promise resolving to a UserExportInterface object.
   */
  exportUser(userId: string): Promise<UserExportInterface>;
  /**
   * Export all users. The response can be saved to file as is.
   * @returns {Promise<UserExportInterface>} Promise resolving to a UserExportInterface object.
   */
  exportUsers(): Promise<UserExportInterface>;
  /**
   * Create an empty user group export template
   * @returns {UserGroupExportInterface} an empty user group export template
   */
  createUserGroupExportTemplate(): UserGroupExportInterface;
  /**
   * Read user group by id
   * @param {string} groupId Group id
   * @returns {Promise<UserGroupSkeleton>} a promise that resolves to a user group object
   */
  readUserGroup(groupId: string): Promise<UserGroupSkeleton>;
  /**
   * Read all user groups.
   * @returns {Promise<UserGroupSkeleton[]>} a promise that resolves to an array of user group objects
   */
  readUserGroups(): Promise<UserGroupSkeleton[]>;
  /**
   * Export a single user group by id. The response can be saved to file as is.
   * @param {string} groupId Group id
   * @returns {Promise<UserGroupExportInterface>} Promise resolving to a UserGroupExportInterface object.
   */
  exportUserGroup(groupId: string): Promise<UserGroupExportInterface>;
  /**
   * Export all user groups. The response can be saved to file as is.
   * @returns {Promise<UserGroupExportInterface>} Promise resolving to a UserGroupExportInterface object.
   */
  exportUserGroups(): Promise<UserGroupExportInterface>;
  /**
   * Import users and their config
   * @param {UserExportInterface} importData user import data
   * @param {string} userId Optional user id. If supplied, only the user of that id is imported.
   * @returns {Promise<UserExportSkeleton[]>} the imported users
   */
  importUsers(
    importData: UserExportInterface,
    userId?: string
  ): Promise<UserExportSkeleton[]>;
  /**
   * Import user groups
   * @param {UserGroupExportInterface} importData user group import data
   * @param {string} groupId Optional user group id. If supplied, only the group of that id is imported.
   * @returns {Promise<UserGroupSkeleton[]>} the imported user groups
   */
  importUserGroups(
    importData: UserGroupExportInterface,
    groupId?: string
  ): Promise<UserGroupSkeleton[]>;
};

export default (state: State): User => {
  return {
    createUserExportTemplate(): UserExportInterface {
      return createUserExportTemplate({ state });
    },
    async readUser(userId: string): Promise<UserSkeleton> {
      return readUser({ userId, state });
    },
    async readUsers(): Promise<UserSkeleton[]> {
      return readUsers({ state });
    },
    async exportUser(userId: string): Promise<UserExportInterface> {
      return exportUser({ userId, state });
    },
    async exportUsers(): Promise<UserExportInterface> {
      return exportUsers({ state });
    },
    createUserGroupExportTemplate(): UserGroupExportInterface {
      return createUserGroupExportTemplate({ state });
    },
    async readUserGroup(groupId: string): Promise<UserGroupSkeleton> {
      return readUserGroup({ groupId, state });
    },
    async readUserGroups(): Promise<UserGroupSkeleton[]> {
      return readUserGroups({ state });
    },
    async exportUserGroup(groupId: string): Promise<UserGroupExportInterface> {
      return exportUserGroup({ groupId, state });
    },
    async exportUserGroups(): Promise<UserGroupExportInterface> {
      return exportUserGroups({ state });
    },
    importUsers(
      importData: UserExportInterface,
      userId?: string
    ): Promise<UserExportSkeleton[]> {
      return importUsers({
        importData,
        userId,
        state,
      });
    },
    importUserGroups(
      importData: UserGroupExportInterface,
      groupId?: string
    ): Promise<UserGroupSkeleton[]> {
      return importUserGroups({
        importData,
        groupId,
        state,
      });
    },
  };
};

export type UserExportSkeleton = UserSkeleton & {
  config: UserConfigSkeleton;
};

export interface UserExportInterface {
  meta?: ExportMetaData;
  user: Record<string, UserExportSkeleton>;
}

export interface UserGroupExportInterface {
  meta?: ExportMetaData;
  userGroup: Record<string, UserGroupSkeleton>;
}

/**
 * Create an empty user export template
 * @returns {UserExportInterface} an empty user export template
 */
export function createUserExportTemplate({
  state,
}: {
  state: State;
}): UserExportInterface {
  return {
    meta: getMetadata({ state }),
    user: {},
  };
}

/**
 * Read user by id
 * @param {string} userId User id
 * @returns {Promise<UserSkeleton>} a promise that resolves to a user object
 */
export async function readUser({
  userId,
  state,
}: {
  userId: string;
  state: State;
}): Promise<UserSkeleton> {
  try {
    return getUser({ userId, state });
  } catch (error) {
    throw new FrodoError(`Error reading user ${userId}`, error);
  }
}

/**
 * Read all users.
 * @returns {Promise<UserSkeleton[]>} a promise that resolves to an array of user objects
 */
export async function readUsers({
  state,
}: {
  state: State;
}): Promise<UserSkeleton[]> {
  try {
    debugMessage({
      message: `UserOps.readUsers: start`,
      state,
    });
    const { result } = await getUsers({ state });
    debugMessage({ message: `UserOps.readUsers: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading users`, error);
  }
}

/**
 * Export a single user by id. The response can be saved to file as is.
 * @param {string} userId User id
 * @returns {Promise<UserExportInterface>} Promise resolving to a UserExportInterface object.
 */
export async function exportUser({
  userId,
  state,
}: {
  userId: string;
  state: State;
}): Promise<UserExportInterface> {
  try {
    const user = (await readUser({
      userId,
      state,
    })) as UserExportSkeleton;
    user.config = await getUserConfig({ userId, state });
    const exportData = createUserExportTemplate({ state });
    exportData.user[userId] = user;
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting user ${userId}`, error);
  }
}

/**
 * Export all users. The response can be saved to file as is.
 * @returns {Promise<UserExportInterface>} Promise resolving to a UserExportInterface object.
 */
export async function exportUsers({
  state,
}: {
  state: State;
}): Promise<UserExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `UserOps.exportUsers: start`,
      state,
    });
    const exportData = createUserExportTemplate({ state });
    const users = await readUsers({ state });
    indicatorId = createProgressIndicator({
      total: users.length,
      message: 'Exporting users...',
      state,
    });
    for (const user of users) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting user ${user._id}`,
        state,
      });
      user.config = await getUserConfig({ userId: user._id, state });
      exportData.user[user._id] = user as UserExportSkeleton;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${users.length} users.`,
      state,
    });
    debugMessage({ message: `UserOps.exportUsers: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting users.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error reading users`, error);
  }
}

/**
 * Create an empty user group export template
 * @returns {UserGroupExportInterface} an empty user group export template
 */
export function createUserGroupExportTemplate({
  state,
}: {
  state: State;
}): UserGroupExportInterface {
  return {
    meta: getMetadata({ state }),
    userGroup: {},
  };
}

/**
 * Read user group by id
 * @param {string} groupId User group id
 * @returns {Promise<UserGroupSkeleton>} a promise that resolves to a user group object
 */
export async function readUserGroup({
  groupId,
  state,
}: {
  groupId: string;
  state: State;
}): Promise<UserGroupSkeleton> {
  try {
    return getUserGroup({ groupId, state });
  } catch (error) {
    throw new FrodoError(`Error reading user group ${groupId}`, error);
  }
}

/**
 * Read all user groups.
 * @returns {Promise<UserGroupSkeleton[]>} a promise that resolves to an array of user group objects
 */
export async function readUserGroups({
  state,
}: {
  state: State;
}): Promise<UserGroupSkeleton[]> {
  try {
    debugMessage({
      message: `UserOps.readUserGroups: start`,
      state,
    });
    const { result } = await getUserGroups({ state });
    // getUserGroups doesn't return groups with the privileges attribute, so request each group individually
    const groups = Promise.all(
      result.map((g) => readUserGroup({ groupId: g._id, state }))
    );
    debugMessage({ message: `UserOps.readUserGroups: end`, state });
    return groups;
  } catch (error) {
    throw new FrodoError(`Error reading user groups`, error);
  }
}

/**
 * Export a single user group by id. The response can be saved to file as is.
 * @param {string} groupId User group id
 * @returns {Promise<UserGroupExportInterface>} Promise resolving to a UserGroupExportInterface object.
 */
export async function exportUserGroup({
  groupId,
  state,
}: {
  groupId: string;
  state: State;
}): Promise<UserGroupExportInterface> {
  try {
    const group = await readUserGroup({
      groupId,
      state,
    });
    const exportData = createUserGroupExportTemplate({ state });
    exportData.userGroup[groupId] = group;
    return exportData;
  } catch (error) {
    throw new FrodoError(`Error exporting user group ${groupId}`, error);
  }
}

/**
 * Export all user groups. The response can be saved to file as is.
 * @returns {Promise<UserGroupExportInterface>} Promise resolving to a UserGroupExportInterface object.
 */
export async function exportUserGroups({
  state,
}: {
  state: State;
}): Promise<UserGroupExportInterface> {
  let indicatorId: string;
  try {
    debugMessage({
      message: `UserOps.exportUserGroups: start`,
      state,
    });
    const exportData = createUserGroupExportTemplate({ state });
    const groups = await readUserGroups({ state });
    indicatorId = createProgressIndicator({
      total: groups.length,
      message: 'Exporting user groups...',
      state,
    });
    for (const group of groups) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting user group ${group._id}`,
        state,
      });
      exportData.userGroup[group._id] = group;
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${groups.length} user groups.`,
      state,
    });
    debugMessage({ message: `UserOps.exportUserGroups: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting user groups.`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error reading user groups`, error);
  }
}

/**
 * Import users and their config
 * @param {UserExportInterface} importData user import data
 * @param {string} userId Optional user id. If supplied, only the user of that id is imported.
 * @returns {Promise<UserExportSkeleton[]>} the imported users
 */
export async function importUsers({
  importData,
  userId,
  state,
}: {
  importData: UserExportInterface;
  userId?: string;
  state: State;
}): Promise<UserExportSkeleton[]> {
  const errors = [];
  try {
    debugMessage({ message: `UserOps.importUsers: start`, state });
    const response = [];
    for (const user of Object.values(importData.user)) {
      try {
        if (userId && user._id !== userId) {
          continue;
        }
        const config = user.config;
        delete user.config;
        const importedUser = await putUser({
          userData: user,
          state,
        });
        importedUser.config = await putUserConfig({
          userId: user._id,
          configData: config,
          state,
        });
        response.push(importedUser);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing users`, errors);
    }
    debugMessage({ message: `UserOps.importUsers: end`, state });
    return response;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing users`, error);
  }
}

/**
 * Import user groups
 * @param {UserGroupExportInterface} importData user group import data
 * @param {string} groupId Optional user group id. If supplied, only the group of that id is imported.
 * @returns {Promise<UserGroupSkeleton[]>} the imported user groups
 */
export async function importUserGroups({
  importData,
  groupId,
  state,
}: {
  importData: UserGroupExportInterface;
  groupId?: string;
  state: State;
}): Promise<UserGroupSkeleton[]> {
  const errors = [];
  try {
    debugMessage({ message: `UserOps.importUserGroups: start`, state });
    const response = [];
    for (const group of Object.values(importData.userGroup)) {
      try {
        if (groupId && group._id !== groupId) {
          continue;
        }
        const result = await putUserGroup({
          groupData: group,
          state,
        });
        response.push(result);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing user groups`, errors);
    }
    debugMessage({ message: `UserOps.importUserGroups: end`, state });
    return response;
  } catch (error) {
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing user groups`, error);
  }
}
