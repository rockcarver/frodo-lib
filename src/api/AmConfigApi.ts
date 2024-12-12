import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { printError, printMessage } from '../utils/Console';
import {
  getRealmPathGlobal,
  getRealmsForExport,
  getRealmUsingExportFormat,
} from '../utils/ForgeRockUtils';
import { AmConfigEntityInterface, PagedResult } from './ApiTypes';
import { generateAmApi } from './BaseApi';

export interface AmConfigEntitiesInterface {
  applicationTypes: AmConfigEntityInterface;
  authenticationChains: AmConfigEntityInterface;
  authenticationModules: AmConfigEntityInterface;
  authenticationTreesConfiguration: AmConfigEntityInterface;
  conditionTypes: AmConfigEntityInterface;
  decisionCombiners: AmConfigEntityInterface;
  secrets: AmConfigEntityInterface;
  serverInformation: AmConfigEntityInterface;
  serverVersion: AmConfigEntityInterface;
  subjectAttributes: AmConfigEntityInterface;
  subjectTypes: AmConfigEntityInterface;
  webhookService: AmConfigEntityInterface;
  wsEntity: AmConfigEntityInterface;
}

const ALL_DEPLOYMENTS = [
  Constants.CLASSIC_DEPLOYMENT_TYPE_KEY,
  Constants.CLOUD_DEPLOYMENT_TYPE_KEY,
  Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY,
];
const CLASSIC_DEPLOYMENT = [Constants.CLASSIC_DEPLOYMENT_TYPE_KEY];

const NEXT_DESCENDENTS_ACTION = 'nextdescendents';
const TRUE_QUERY_FILTER = 'true';

const DEFAULT_PROTOCOL = '2.1';

/**
 * Consists of all AM entities that are not currently being exported elsewhere in Frodo.
 * Endpoints and resource versions were scraped directly from the Amster entity reference documentation: https://backstage.forgerock.com/docs/amster/7.5/entity-reference/preface.html
 */
const AM_ENTITIES: Record<string, EntityInfo> = {
  applicationTypes: {
    realm: { path: '/applicationtypes', version: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
    readonly: true,
  },
  authenticationChains: {
    realm: {
      path: '/realm-config/authentication/chains',
      version: '2.0',
      importWithId: true,
      queryFilter: TRUE_QUERY_FILTER,
    },
    global: {
      path: '/global-config/authentication/chains',
      version: '1.0',
      deployments: CLASSIC_DEPLOYMENT,
    },
    deployments: ALL_DEPLOYMENTS,
  },
  authenticationModules: {
    realm: { path: '/realm-config/authentication/modules', version: '2.0' },
    global: {
      path: '/global-config/authentication/modules',
      version: '1.0',
      deployments: CLASSIC_DEPLOYMENT,
    },
    deployments: ALL_DEPLOYMENTS,
    action: NEXT_DESCENDENTS_ACTION,
    readonly: true,
  },
  authenticationTreesConfiguration: {
    global: {
      path: '/global-config/authentication/authenticationtrees',
      version: '1.0',
    },
    deployments: CLASSIC_DEPLOYMENT,
  },
  conditionTypes: {
    realm: { path: '/conditiontypes', version: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
    readonly: true,
  },
  decisionCombiners: {
    realm: { path: '/decisioncombiners', version: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
    readonly: true,
  },
  secrets: {
    realm: { path: '/realm-config/secrets', version: '2.0' },
    global: {
      path: '/global-config/secrets',
      version: '1.0',
      deployments: CLASSIC_DEPLOYMENT,
    },
    deployments: ALL_DEPLOYMENTS,
    action: NEXT_DESCENDENTS_ACTION,
    readonly: true,
  },
  serverInformation: {
    // Note: Amster documentation says to do this by realm, but it really should be global (the API explorer does it this way and it makes more sense)
    global: { path: '/serverinfo/*', version: '2.0' },
    deployments: ALL_DEPLOYMENTS,
    readonly: true,
  },
  serverVersion: {
    // Note: Amster documentation says to do this by realm, but it really should be global (the API explorer does it this way and it makes more sense)
    global: { path: '/serverinfo/version', version: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    readonly: true,
  },
  subjectAttributes: {
    // Due to a bug with this endpoint, protocol 1.0 is the only way for it to work as of version 7.5.0.
    realm: { path: '/subjectattributes', version: '1.0', protocol: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
    readonly: true,
  },
  subjectTypes: {
    realm: { path: '/subjecttypes', version: '1.0' },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
    readonly: true,
  },
  webhookService: {
    realm: {
      path: '/realm-config/webhooks',
      version: '2.0',
      importWithId: true,
      queryFilter: TRUE_QUERY_FILTER,
    },
    global: {
      path: '/global-config/webhooks',
      version: '1.0',
      ifMatch: '*',
      deployments: CLASSIC_DEPLOYMENT,
    },
    deployments: ALL_DEPLOYMENTS,
  },
  wsEntity: {
    realm: {
      path: '/realm-config/federation/entityproviders/ws',
      version: '2.0',
      importWithId: true,
    },
    deployments: ALL_DEPLOYMENTS,
    queryFilter: TRUE_QUERY_FILTER,
  },
};

function getApiConfig(protocol: string, version: string) {
  return {
    apiVersion: `protocol=${protocol},resource=${version}`,
  };
}

export type ConfigSkeleton = {
  global: AmConfigEntitiesInterface;
  realm: Record<string, AmConfigEntitiesInterface>;
};

/**
 * Contains information about how to get a config entity.
 */
export type EntityInfo = {
  realm?: EntitySubInfo;
  global?: EntitySubInfo;
  deployments?: string[];
  queryFilter?: string;
  action?: string;
  readonly?: boolean;
};

/**
 * Contains realm or global specific information about how to get a config entity. Settings like deployments, queryFilter, and action will override the values contained in the parent EntityInfo object if they are provided.
 */
export type EntitySubInfo = {
  path: string;
  version: string;
  protocol?: string;
  ifMatch?: string;
  importWithId?: boolean;
  deployments?: string[];
  queryFilter?: string;
  action?: string;
};

export type ConfigEntitySkeleton =
  | PagedResult<AmConfigEntityInterface>
  | AmConfigEntityInterface
  | undefined;

/**
 * Gets a single am config entity at the given realm and path
 * @param {string} path path to the entity
 * @param {string} version the api resource version
 * @param {string} protocol the api protocol version
 * @param {string} realm realm that the entity is in (or leave undefined to get global entity)
 * @param {string} queryFilter the query filter
 * @param {string} action the action
 * @returns {Promise<ConfigEntitySkeleton>} the config entity data
 */
export async function getConfigEntity({
  state,
  path,
  version,
  protocol,
  realm,
  queryFilter,
  action,
}: {
  state: State;
  path: string;
  version: string;
  protocol?: string;
  realm?: string;
  queryFilter?: string;
  action?: string;
}): Promise<ConfigEntitySkeleton> {
  const currentRealm = state.getRealm();
  if (realm) {
    state.setRealm(realm);
  }
  const urlString = `${state.getHost()}/json${getRealmPathGlobal(
    !realm,
    state
  )}${path}${queryFilter ? `?_queryFilter=${queryFilter}` : ''}${
    action ? `${queryFilter ? '&' : '?'}_action=${action}` : ''
  }`;
  try {
    const axios = generateAmApi({
      resource: getApiConfig(protocol ? protocol : DEFAULT_PROTOCOL, version),
      state,
    });
    let data;
    if (action) {
      data = (
        await axios.post(
          urlString,
          {},
          {
            withCredentials: true,
          }
        )
      ).data;
    } else {
      data = (
        await axios.get(urlString, {
          withCredentials: true,
        })
      ).data;
    }
    state.setRealm(currentRealm);
    return data;
  } catch (error) {
    printError({
      error,
      message: `Error getting config entity from resource path '${urlString}'`,
      state,
    });
  }
}

/**
 * Get all other AM config entities
 * @param {boolean} includeReadOnly Include read only config in the export
 * @param {boolean} onlyRealm Get config only from the active realm. If onlyGlobal is also active, then it will also get the global config.
 * @param {boolean} onlyGlobal Get global config only. If onlyRealm is also active, then it will also get the active realm config.
 * @returns {Promise<ConfigSkeleton>} a promise that resolves to a config object containing global and realm config entities
 */
export async function getConfigEntities({
  includeReadOnly = false,
  onlyRealm = false,
  onlyGlobal = false,
  state,
}: {
  includeReadOnly: boolean;
  onlyRealm: boolean;
  onlyGlobal: boolean;
  state: State;
}): Promise<ConfigSkeleton> {
  const realms = await getRealmsForExport({ state });
  const stateRealms = realms.map(getRealmUsingExportFormat);
  const entities = {
    global: {},
    realm: Object.fromEntries(realms.map((r) => [r, {}])),
  } as ConfigSkeleton;
  for (const [key, entityInfo] of Object.entries(AM_ENTITIES)) {
    if (!includeReadOnly && entityInfo.readonly) {
      continue;
    }
    const deploymentAllowed =
      entityInfo.deployments &&
      entityInfo.deployments.includes(state.getDeploymentType());
    if (
      (onlyGlobal || !onlyRealm) &&
      entityInfo.global &&
      ((entityInfo.global.deployments &&
        entityInfo.global.deployments.includes(state.getDeploymentType())) ||
        (entityInfo.global.deployments == undefined && deploymentAllowed))
    ) {
      try {
        entities.global[key] = await getConfigEntity({
          state,
          path: entityInfo.global.path,
          version: entityInfo.global.version,
          protocol: entityInfo.global.protocol,
          queryFilter: entityInfo.global.queryFilter
            ? entityInfo.global.queryFilter
            : entityInfo.queryFilter,
          action: entityInfo.global.action
            ? entityInfo.global.action
            : entityInfo.action,
        });
      } catch (e) {
        printMessage({
          message: `Error getting '${key}' from resource path '${entityInfo.global.path}': ${e.message}`,
          type: 'error',
          state,
        });
      }
    }
    if (
      (!onlyGlobal || onlyRealm) &&
      entityInfo.realm &&
      ((entityInfo.realm.deployments &&
        entityInfo.realm.deployments.includes(state.getDeploymentType())) ||
        (entityInfo.realm.deployments == undefined && deploymentAllowed))
    ) {
      const activeRealm = state.getRealm();
      for (let i = 0; i < realms.length; i++) {
        if (
          onlyRealm &&
          (activeRealm.startsWith('/') ? activeRealm : '/' + activeRealm) !==
            stateRealms[i]
        ) {
          continue;
        }
        try {
          entities.realm[realms[i]][key] = await getConfigEntity({
            state,
            path: entityInfo.realm.path,
            version: entityInfo.realm.version,
            protocol: entityInfo.realm.protocol,
            realm: stateRealms[i],
            queryFilter: entityInfo.realm.queryFilter
              ? entityInfo.realm.queryFilter
              : entityInfo.queryFilter,
            action: entityInfo.realm.action
              ? entityInfo.realm.action
              : entityInfo.action,
          });
        } catch (e) {
          printMessage({
            message: `Error getting '${key}' from resource path '${entityInfo.realm.path}': ${e.message}`,
            type: 'error',
            state,
          });
        }
      }
    }
  }
  return entities;
}

/**
 * Puts a single am config entity at the given realm and path
 * @param {ConfigEntitySkeleton} entityData config entity object. If it's not provided, no import is performed.
 * @param {string} path path to the entity
 * @param {string} version the api resource version
 * @param {string} protocol the api protocol version
 * @param {string} ifMatch the if match condition
 * @param {string} realm realm that the entity is in (or leave undefined to get global entity)
 * @returns {Promise<ConfigEntitySkeleton>} the config entity object
 */
export async function putConfigEntity({
  state,
  entityData,
  path,
  version,
  protocol,
  ifMatch,
  realm,
}: {
  state: State;
  entityData?: ConfigEntitySkeleton;
  path: string;
  version: string;
  protocol?: string;
  ifMatch?: string;
  realm?: string;
}): Promise<ConfigEntitySkeleton> {
  if (!entityData) {
    return entityData;
  }
  const currentRealm = state.getRealm();
  if (realm) {
    state.setRealm(realm);
  }
  const urlString = `${state.getHost()}/json${getRealmPathGlobal(
    !realm,
    state
  )}${path}`;
  try {
    const { data } = await generateAmApi({
      resource: getApiConfig(protocol ? protocol : DEFAULT_PROTOCOL, version),
      state,
    }).put(urlString, entityData, {
      withCredentials: true,
      headers: ifMatch ? { 'If-Match': ifMatch } : {},
    });
    state.setRealm(currentRealm);
    return data;
  } catch (error) {
    printError({
      error,
      message: `Error putting config entity at resource path '${urlString}'`,
      state,
    });
  }
}

/**
 * Put all other AM config entities
 * @param {ConfigSkeleton} config the config object containing global and realm config entities
 * @returns {Promise<ConfigSkeleton>} a promise that resolves to a config object containing global and realm config entities
 */
export async function putConfigEntities({
  config,
  state,
}: {
  config: ConfigSkeleton;
  state: State;
}): Promise<ConfigSkeleton> {
  const realms = config.realm ? Object.keys(config.realm) : [];
  const stateRealms = realms.map(getRealmUsingExportFormat);
  const entities = {
    global: {},
    realm: Object.fromEntries(realms.map((r) => [r, {}])),
  } as ConfigSkeleton;
  for (const [key, entityInfo] of Object.entries(AM_ENTITIES)) {
    if (entityInfo.readonly) {
      continue;
    }
    const deploymentAllowed =
      entityInfo.deployments &&
      entityInfo.deployments.includes(state.getDeploymentType());
    if (
      entityInfo.global &&
      ((entityInfo.global.deployments &&
        entityInfo.global.deployments.includes(state.getDeploymentType())) ||
        (entityInfo.global.deployments == undefined && deploymentAllowed)) &&
      config.global &&
      config.global[key]
    ) {
      try {
        for (const [id, entityData] of Object.entries(config.global[key])) {
          if (!entities.global[key]) {
            entities.global[key] = {};
          }
          entities.global[key][id] = await putConfigEntity({
            state,
            entityData: entityData as ConfigEntitySkeleton,
            path:
              entityInfo.global.path +
              (entityInfo.global.importWithId ? `/${id}` : ''),
            version: entityInfo.global.version,
            protocol: entityInfo.global.protocol,
            ifMatch: entityInfo.global.ifMatch,
          });
        }
      } catch (e) {
        printMessage({
          message: `Error putting '${key}' from resource path '${entityInfo.global.path}': ${e.message}`,
          type: 'error',
          state,
        });
      }
    }
    if (
      entityInfo.realm &&
      ((entityInfo.realm.deployments &&
        entityInfo.realm.deployments.includes(state.getDeploymentType())) ||
        (entityInfo.realm.deployments == undefined && deploymentAllowed))
    ) {
      for (let i = 0; i < realms.length; i++) {
        if (!config.realm[realms[i]][key]) {
          continue;
        }
        try {
          for (const [id, entityData] of Object.entries(
            config.realm[realms[i]][key]
          )) {
            if (!entities.realm[realms[i]][key]) {
              entities.realm[realms[i]][key] = {};
            }
            entities.realm[realms[i]][key][id] = await putConfigEntity({
              state,
              entityData: entityData as ConfigEntitySkeleton,
              path:
                entityInfo.realm.path +
                (entityInfo.realm.importWithId ? `/${id}` : ''),
              version: entityInfo.realm.version,
              protocol: entityInfo.realm.protocol,
              ifMatch: entityInfo.realm.ifMatch,
              realm: stateRealms[i],
            });
          }
        } catch (e) {
          printMessage({
            message: `Error putting '${key}' from resource path '${entityInfo.realm.path}': ${e.message}`,
            type: 'error',
            state,
          });
        }
      }
    }
  }
  return entities;
}
