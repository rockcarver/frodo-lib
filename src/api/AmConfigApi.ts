import { FrodoError } from '../ops/FrodoError';
import { State } from '../shared/State';
import { getRealmPathGlobal } from '../utils/ForgeRockUtils';
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

const DEFAULT_PROTOCOL = '2.1';

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
    throw new FrodoError(
      `Error getting config entity from resource path '${urlString}'`,
      error
    );
  }
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
    throw new FrodoError(
      `Error putting config entity at resource path '${urlString}'`,
      error
    );
  }
}
