import util from 'util';

import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { printMessage } from '../utils/Console';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { IdObjectSkeletonInterface, PagedResult } from './ApiTypes';
import { generateAmApi } from './BaseApi';

const userURLTemplate = '%s/json%s/users/%s';
const usersURLTemplate = '%s/json%s/users?_queryFilter=true';
const userServiceURLTemplate = '%s/json%s/users/%s/services/%s';
const userServicesURLTemplate =
  '%s/json%s/users/%s/services?_action=nextdescendents';
const userConfigURL = '%s/json%s/users/%s/%s?_queryFilter=true';
const userConfigPaths = [
  'devices/2fa/binding',
  'devices/2fa/oath',
  'devices/2fa/push',
  'devices/2fa/webauthn',
  'devices/profile',
  'devices/trusted',
  'groups',
  'oauth2/applications',
  'oauth2/resources/labels',
  'oauth2/resources/sets',
  'policies',
  'uma/auditHistory',
  'uma/pendingrequests',
  'uma/policies',
];
const groupURLTemplate = '%s/json%s/groups/%s';
const groupsURLTemplate = '%s/json%s/groups?_queryFilter=true';

const configApiVersion = 'protocol=2.0,resource=1.0';
const identityApiVersion = 'protocol=2.0,resource=4.0';

function getConfigApiConfig() {
  return {
    apiVersion: configApiVersion,
  };
}

function getIdentityApiConfig() {
  return {
    apiVersion: identityApiVersion,
  };
}

export type UserSkeleton = IdObjectSkeletonInterface & {
  realm: string;
  username: string;
  mail: string[];
  givenName: string[];
  objectClass: string[];
  dn: string[];
  cn: string[];
  createTimestamp: string[];
  employeeNumber: string[];
  uid: string[];
  universalid: string[];
  inetUserStatus: string[];
  sn: string[];
  telephoneNumber?: string[];
  modifyTimestamp?: string[];
  postalAddress?: string[];
};

export type UserConfigSkeleton = {
  devices: {
    profile: Record<string, IdObjectSkeletonInterface>;
    trusted: Record<string, IdObjectSkeletonInterface>;
    '2fa': {
      binding: Record<string, IdObjectSkeletonInterface>;
      oath: Record<string, IdObjectSkeletonInterface>;
      push: Record<string, IdObjectSkeletonInterface>;
      webauthn: Record<string, IdObjectSkeletonInterface>;
    };
  };
  groups: Record<string, IdObjectSkeletonInterface>;
  oauth2: {
    applications: Record<string, IdObjectSkeletonInterface>;
    resources: {
      labels: Record<string, IdObjectSkeletonInterface>;
      sets: Record<string, IdObjectSkeletonInterface>;
    };
  };
  policies: Record<string, IdObjectSkeletonInterface>;
  services: Record<string, IdObjectSkeletonInterface>;
  uma: {
    auditHistory: Record<string, IdObjectSkeletonInterface>;
    pendingrequests: Record<string, IdObjectSkeletonInterface>;
    policies: Record<string, IdObjectSkeletonInterface>;
  };
};

export type UserGroupSkeleton = IdObjectSkeletonInterface & {
  username: string;
  realm: string;
  universalid: string[];
  members: {
    uniqueMember: string[];
  };
  dn: string[];
  cn: string[];
  objectclass: string[];
  privileges: Record<string, boolean>[];
};

/**
 * Get user by id
 * @param {string} userId the user id
 * @returns {Promise<UserSkeleton>} a promise that resolves to a user object
 */
export async function getUser({
  userId,
  state,
}: {
  userId: string;
  state: State;
}): Promise<UserSkeleton> {
  const urlString = util.format(
    userURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    userId
  );
  const { data } = await generateAmApi({
    resource: getIdentityApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get all users
 * @returns {Promise<PagedResult<UserSkeleton>>} a promise that resolves to an array of user objects
 */
export async function getUsers({
  state,
}: {
  state: State;
}): Promise<PagedResult<UserSkeleton>> {
  const urlString = util.format(
    usersURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getIdentityApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get user configurations
 * @param {string} userId the user id
 * @returns {Promise<UserConfigSkeleton>} a promise that resolves to an object containing all the user configuration
 */
export async function getUserConfig({
  userId,
  state,
}: {
  userId: string;
  state: State;
}): Promise<UserConfigSkeleton> {
  const userConfig = {} as UserConfigSkeleton;
  //Get user services
  const serviceUrlString = util.format(
    userServicesURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    userId
  );
  try {
    const { data } = await generateAmApi({
      resource: getConfigApiConfig(),
      state,
    }).post(serviceUrlString, undefined, {
      withCredentials: true,
    });
    userConfig.services = data.result;
  } catch (e) {
    printMessage({
      message: `Error exporting service config for user with id '${userId}' from url '${serviceUrlString}': ${e.message}`,
      type: 'error',
      state,
    });
  }
  //Get the rest of the config
  for (const configPath of userConfigPaths) {
    // policies configuration has forbidden access in cloud platform deployments, so only export it when exporting from classic deployments.
    if (
      configPath === 'policies' &&
      state.getDeploymentType() !== Constants.CLASSIC_DEPLOYMENT_TYPE_KEY
    ) {
      continue;
    }
    const urlString = util.format(
      userConfigURL,
      state.getHost(),
      getCurrentRealmPath(state),
      userId,
      configPath
    );
    try {
      const { data } = await generateAmApi({
        resource: getConfigApiConfig(),
        state,
      }).get(urlString, {
        withCredentials: true,
      });
      const pathParts = configPath.split('/');
      let current = userConfig;
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (i === pathParts.length - 1) {
          current[part] = data.result;
          break;
        }
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
    } catch (e) {
      if (e.httpStatus === 404 || e.response?.status === 404) {
        //Ignore this case, since some user config does not exist in certain realms. For example, the UMA config does not exist when UMA is not supported for a given realm, resulting in a 404 error.
      } else {
        printMessage({
          message: `Error exporting config for user with id '${userId}' from url '${urlString}': ${e.message}`,
          type: 'error',
          state,
        });
      }
    }
  }
  return userConfig;
}

/**
 * Get user group by id
 * @param {string} groupId the group id
 * @returns {Promise<UserGroupSkeleton>} a promise that resolves to a group object
 */
export async function getUserGroup({
  groupId,
  state,
}: {
  groupId: string;
  state: State;
}): Promise<UserGroupSkeleton> {
  const urlString = util.format(
    groupURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    groupId
  );
  const { data } = await generateAmApi({
    resource: getIdentityApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get all user groups
 * @returns {Promise<PagedResult<UserGroupSkeleton>>} a promise that resolves to an array of group objects
 */
export async function getUserGroups({
  state,
}: {
  state: State;
}): Promise<PagedResult<UserGroupSkeleton>> {
  const urlString = util.format(
    groupsURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getIdentityApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put user
 * @param {UserSkeleton} userData the user data
 * @returns {Promise<UserSkeleton>} a promise that resolves to a user object
 */
export async function putUser({
  userData,
  state,
}: {
  userData: UserSkeleton;
  state: State;
}): Promise<UserSkeleton> {
  const urlString = util.format(
    userURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    userData._id
  );
  const { data } = await generateAmApi({
    resource: getIdentityApiConfig(),
    state,
  }).put(urlString, userData, {
    withCredentials: true,
    headers: { 'If-Match': '*' },
  });
  return data;
}

/**
 * Put user configurations
 * @param {string} userId the user id
 * @param {UserConfigSkeleton} configData the user config data
 * @returns {Promise<UserConfigSkeleton>} a promise that resolves to an object containing all the user configuration
 */
export async function putUserConfig({
  userId,
  configData,
  state,
}: {
  userId: string;
  configData: UserConfigSkeleton;
  state: State;
}): Promise<UserConfigSkeleton> {
  const userConfig = {} as UserConfigSkeleton;
  //Put user services
  for (const [id, service] of Object.entries(configData.services)) {
    const serviceUrlString = util.format(
      userServiceURLTemplate,
      state.getHost(),
      getCurrentRealmPath(state),
      userId,
      id
    );
    try {
      const { data } = await generateAmApi({
        resource: getConfigApiConfig(),
        state,
      }).put(serviceUrlString, service, {
        withCredentials: true,
      });
      userConfig.services[id] = data;
    } catch (e) {
      printMessage({
        message: `Error importing service config for user with id '${userId}' from url '${serviceUrlString}': ${e.message}`,
        type: 'error',
        state,
      });
    }
  }
  // TODO: Put the rest of the config
  return { ...configData, ...userConfig };
}

/**
 * Put user group by id
 * @param {UserGroupSkeleton} groupData the group data
 * @returns {Promise<UserGroupSkeleton>} a promise that resolves to a group object
 */
export async function putUserGroup({
  groupData,
  state,
}: {
  groupData: UserGroupSkeleton;
  state: State;
}): Promise<UserGroupSkeleton> {
  const urlString = util.format(
    groupURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    groupData._id
  );
  const { data } = await generateAmApi({
    resource: getIdentityApiConfig(),
    state,
  }).put(urlString, groupData, {
    withCredentials: true,
  });
  return data;
}
