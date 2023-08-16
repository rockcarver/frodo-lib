import util from 'util';

import { State } from '../shared/State';
import { getHostBaseUrl } from '../utils/ForgeRockUtils';
import { IdObjectSkeletonInterface, PagedResult } from './ApiTypes';
import { generateAmApi } from './BaseApi';

const realmsListURLTemplate = '%s/json/global-config/realms/?_queryFilter=true';
const realmURLTemplate = '%s/json/global-config/realms/%s';
const createRealmURLTemplate = '%s/json/global-config/realms?_action=create';

const apiVersion = 'protocol=2.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

export type RealmSkeleton = IdObjectSkeletonInterface & {
  parentPath: string;
  active: boolean;
  name: string;
  aliases: string[];
};

/**
 * Get all realms
 * @returns {Promise<PagedResult<RealmSkeleton>>} a promise that resolves to an object containing an array of realm objects
 */
export async function getRealms({
  state,
}: {
  state: State;
}): Promise<PagedResult<RealmSkeleton>> {
  const urlString = util.format(realmsListURLTemplate, state.getHost());
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get realm by id
 * @param {string} realmId realm id
 * @returns {Promise} a promise that resolves to an object containing a realm object
 */
export async function getRealm({
  realmId,
  state,
}: {
  realmId: string;
  state: State;
}): Promise<RealmSkeleton> {
  const urlString = util.format(realmURLTemplate, state.getHost(), realmId);
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

const realmTemplate: RealmSkeleton = {
  name: '',
  active: true,
  parentPath: '/',
  aliases: [],
};

/**
 * Create realm
 * @param {RealmSkeleton} realmData (optional) realm data
 * @returns {Promise<RealmSkeleton>} a promise that resolves to a realm object
 */
export async function createRealm({
  realmData = realmTemplate,
  state,
}: {
  realmData?: RealmSkeleton;
  state: State;
}): Promise<RealmSkeleton> {
  const urlString = util.format(createRealmURLTemplate, state.getHost());
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, realmData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put realm
 * @param {string} realmId realm id
 * @param {RealmSkeleton} realmData realm config object
 * @returns {Promise<RealmSkeleton>} a promise that resolves to a realm object
 */
export async function putRealm({
  realmId,
  realmData,
  state,
}: {
  realmId: string;
  realmData: RealmSkeleton;
  state: State;
}): Promise<RealmSkeleton> {
  const urlString = util.format(realmURLTemplate, state.getHost(), realmId);
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    realmData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete realm
 * @param {string} realmId realm id
 * @returns {Promise<RealmSkeleton>} a promise that resolves to an object containing a realm object
 */
export async function deleteRealm({
  realmId,
  state,
}: {
  realmId: string;
  state: State;
}): Promise<RealmSkeleton> {
  const urlString = util.format(
    realmURLTemplate,
    getHostBaseUrl(state.getHost()),
    realmId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
