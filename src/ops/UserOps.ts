import {
  getUser,
  getUserConfig,
  getUserCount,
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
import { ExportMetaData, type ResultCallback } from './OpsTypes';

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
   * Read the users of the active realm, all of them or those matching a filter.
   * @param {string} filter CREST query filter on the AM user attributes, e.g. `username sw "a" or sn sw "a"`. Default: all users.
   * @param {string[]} fields attributes to return, e.g. `['username', 'givenName', 'sn', 'mail']`. Default: the attributes AM returns by default.
   * @returns {Promise<UserSkeleton[]>} a promise that resolves to an array of user objects. AM returns at most the maximum results of the realm's data store (1000 by default), so a list of exactly that size may be cut short: narrow it with a filter.
   */
  readUsers(filter?: string, fields?: string[]): Promise<UserSkeleton[]>;
  /**
   * Count the users of the active realm, all of them or those matching a filter.
   * @param {string} filter CREST query filter on the AM user attributes, e.g. `username sw "a"`. Default: all users.
   * @returns {Promise<number>} exact count when supported by the backing API. AM stops counting at the maximum results of the realm's data store (1000 by default), so a count of exactly that size means "at least".
   */
  countUsers(filter?: string): Promise<number>;
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
   * Import users and their config. Every user is tried: a user that cannot be imported does not stop the others.
   * @param {UserExportInterface} importData user import data
   * @param {string} userId Optional user id. If supplied, only the user of that id is imported.
   * @param {ResultCallback<UserExportSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every user is passed to it as it happens (a failed user as an error that names it, with the cause nested) and a failed user does not throw: the users that could be imported are returned. A user whose config could not be written is a failed user, although the user itself may have been written. Without a callback, the failures are collected and thrown as one error after every user was tried.
   * @returns {Promise<UserExportSkeleton[]>} the imported users
   */
  importUsers(
    importData: UserExportInterface,
    userId?: string,
    resultCallback?: ResultCallback<UserExportSkeleton>
  ): Promise<UserExportSkeleton[]>;
  /**
   * Import user groups. Every user group is tried: a user group that cannot be imported does not stop the others.
   * @param {UserGroupExportInterface} importData user group import data
   * @param {string} groupId Optional user group id. If supplied, only the group of that id is imported.
   * @param {ResultCallback<UserGroupSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every user group is passed to it as it happens (a failed user group as an error that names it, with the cause nested) and a failed user group does not throw: the user groups that could be imported are returned. Without it, the failures are collected and thrown as one error after every user group was tried.
   * @returns {Promise<UserGroupSkeleton[]>} the imported user groups
   */
  importUserGroups(
    importData: UserGroupExportInterface,
    groupId?: string,
    resultCallback?: ResultCallback<UserGroupSkeleton>
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
    async readUsers(
      filter?: string,
      fields?: string[]
    ): Promise<UserSkeleton[]> {
      return readUsers({ filter, fields, state });
    },
    async countUsers(filter?: string): Promise<number> {
      return countUsers({ filter, state });
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
      userId?: string,
      resultCallback?: ResultCallback<UserExportSkeleton>
    ): Promise<UserExportSkeleton[]> {
      return importUsers({
        importData,
        userId,
        resultCallback,
        state,
      });
    },
    importUserGroups(
      importData: UserGroupExportInterface,
      groupId?: string,
      resultCallback?: ResultCallback<UserGroupSkeleton>
    ): Promise<UserGroupSkeleton[]> {
      return importUserGroups({
        importData,
        groupId,
        resultCallback,
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
    return await getUser({ userId, state });
  } catch (error) {
    throw new FrodoError(`Error reading user ${userId}`, error);
  }
}

/**
 * Read the users of the active realm, all of them or those matching a filter.
 * @param {string} filter CREST query filter on the AM user attributes. Default: all users.
 * @param {string[]} fields attributes to return. Default: the attributes AM returns by default.
 * @returns {Promise<UserSkeleton[]>} a promise that resolves to an array of user objects
 */
export async function readUsers({
  filter,
  fields,
  state,
}: {
  filter?: string;
  fields?: string[];
  state: State;
}): Promise<UserSkeleton[]> {
  try {
    debugMessage({
      message: `UserOps.readUsers: start`,
      state,
    });
    const { result } = await getUsers({ filter, fields, state });
    debugMessage({ message: `UserOps.readUsers: end`, state });
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading users`, error);
  }
}

/**
 * Count the users of the active realm, all of them or those matching a filter.
 * @param {string} filter CREST query filter on the AM user attributes. Default: all users.
 * @returns {Promise<number>} exact count when supported by the backing API
 */
export async function countUsers({
  filter,
  state,
}: {
  filter?: string;
  state: State;
}): Promise<number> {
  try {
    debugMessage({
      message: `UserOps.countUsers: start`,
      state,
    });
    const total = await getUserCount({ filter, state });
    debugMessage({
      message: `UserOps.countUsers: end (count=${total})`,
      state,
    });
    return total;
  } catch (error) {
    throw new FrodoError(`Error counting users`, error);
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
    return await getUserGroup({ groupId, state });
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
    const groups = await Promise.all(
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
 * Import users and their config. Every user is tried: a user that cannot be imported does not stop the others.
 * @param {UserExportInterface} importData user import data
 * @param {string} userId Optional user id. If supplied, only the user of that id is imported.
 * @param {ResultCallback<UserExportSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every user is passed to it as it happens (a failed user as an error that names it, with the cause nested) and a failed user does not throw: the users that could be imported are returned. A user whose config could not be written is a failed user, although the user itself may have been written. Without a callback, the failures are collected and thrown as one error after every user was tried.
 * @returns {Promise<UserExportSkeleton[]>} the imported users
 * @throws {FrodoError} If one or more users cannot be imported and there is no result callback. The error carries one nested error per failed user.
 */
export async function importUsers({
  importData,
  userId,
  resultCallback = undefined,
  state,
}: {
  importData: UserExportInterface;
  userId?: string;
  resultCallback?: ResultCallback<UserExportSkeleton>;
  state: State;
}): Promise<UserExportSkeleton[]> {
  const errors = [];
  try {
    debugMessage({ message: `UserOps.importUsers: start`, state });
    const response = [];
    for (const user of Object.values(importData.user)) {
      let imported: UserExportSkeleton;
      let failed = false;
      let failure: unknown;
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
        imported = importedUser as UserExportSkeleton;
      } catch (error) {
        failed = true;
        failure = error;
      }
      // the callback is called outside the try: an exception of the callback
      // must not be taken for a failed import and reported a second time
      if (!failed) {
        response.push(imported);
        if (resultCallback) resultCallback(undefined, imported);
      } else if (resultCallback) {
        resultCallback(
          new FrodoError(`Error importing user ${user?._id}`, failure as Error),
          undefined
        );
      } else {
        errors.push(failure);
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
 * Import user groups. Every user group is tried: a user group that cannot be imported does not stop the others.
 * @param {UserGroupExportInterface} importData user group import data
 * @param {string} groupId Optional user group id. If supplied, only the group of that id is imported.
 * @param {ResultCallback<UserGroupSkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every user group is passed to it as it happens (a failed user group as an error that names it, with the cause nested) and a failed user group does not throw: the user groups that could be imported are returned. Without it, the failures are collected and thrown as one error after every user group was tried.
 * @returns {Promise<UserGroupSkeleton[]>} the imported user groups
 * @throws {FrodoError} If one or more user groups cannot be imported and there is no result callback. The error carries one nested error per failed user group.
 */
export async function importUserGroups({
  importData,
  groupId,
  resultCallback = undefined,
  state,
}: {
  importData: UserGroupExportInterface;
  groupId?: string;
  resultCallback?: ResultCallback<UserGroupSkeleton>;
  state: State;
}): Promise<UserGroupSkeleton[]> {
  const errors = [];
  try {
    debugMessage({ message: `UserOps.importUserGroups: start`, state });
    const response = [];
    for (const group of Object.values(importData.userGroup)) {
      let imported: UserGroupSkeleton;
      let failed = false;
      let failure: unknown;
      try {
        if (groupId && group._id !== groupId) {
          continue;
        }
        imported = await putUserGroup({
          groupData: group,
          state,
        });
      } catch (error) {
        failed = true;
        failure = error;
      }
      // the callback is called outside the try: an exception of the callback
      // must not be taken for a failed import and reported a second time
      if (!failed) {
        response.push(imported);
        if (resultCallback) resultCallback(undefined, imported);
      } else if (resultCallback) {
        resultCallback(
          new FrodoError(
            `Error importing user group ${group?._id}`,
            failure as Error
          ),
          undefined
        );
      } else {
        errors.push(failure);
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
