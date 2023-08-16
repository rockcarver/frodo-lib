import util from 'util';

import { State } from '../shared/State';
import { getHostBaseUrl } from '../utils/ForgeRockUtils';
import {
  IdObjectSkeletonInterface,
  NoIdObjectSkeletonInterface,
  PagedResult,
} from './ApiTypes';
import { generateIdmApi } from './BaseApi';

const idmAllConfigURLTemplate = '%s/openidm/config';
const idmConfigURLTemplate = '%s/openidm/config/%s';
const idmConfigEntityQueryTemplate = '%s/openidm/config?_queryFilter=%s';

export type IdmConfigStub = IdObjectSkeletonInterface & {
  _id: string;
  pid: string;
  factoryPid: string | null;
};

export type IdmConfigStubs = IdObjectSkeletonInterface & {
  _id: '';
  configurations: IdmConfigStub[];
};

/**
 * Get all IDM configuration stubs
 * @returns {Promise} a promise that resolves to all IDM configuration stubs
 */
export async function getConfigStubs({
  state,
}: {
  state: State;
}): Promise<IdmConfigStubs> {
  const urlString = util.format(
    idmAllConfigURLTemplate,
    getHostBaseUrl(state.getHost())
  );
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}

/**
 * Get all IDM config entities
 * @returns {Promise} a promise that resolves to all IDM config entities
 */
export async function getConfigEntities({
  state,
}: {
  state: State;
}): Promise<PagedResult<IdObjectSkeletonInterface>> {
  const urlString = util.format(
    idmConfigEntityQueryTemplate,
    getHostBaseUrl(state.getHost()),
    'true'
  );
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}

/**
 * Get IDM config entities by type
 * @param {string} type the desired type of config entity
 * @returns {Promise} a promise that resolves to an object containing all IDM config entities of the desired type
 */
export async function getConfigEntitiesByType({
  type,
  state,
}: {
  type: string;
  state: State;
}): Promise<PagedResult<NoIdObjectSkeletonInterface>> {
  const urlString = util.format(
    idmConfigEntityQueryTemplate,
    getHostBaseUrl(state.getHost()),
    encodeURIComponent(`_id sw '${type}'`)
  );
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}

/**
 * Get an IDM config entity
 * @param {string} entityId the desired config entity
 * @returns {Promise<unknown>} a promise that resolves to an IDM config entity
 */
export async function getConfigEntity({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}) {
  const urlString = util.format(
    idmConfigURLTemplate,
    getHostBaseUrl(state.getHost()),
    entityId
  );
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}

/**
 * Put IDM config entity
 * @param {string} entityId config entity id
 * @param {string} entityData config entity object
 * @param {boolean} failIfExists fail if exists
 * @returns {Promise<unknown>} a promise that resolves to an IDM config entity
 */
export async function putConfigEntity({
  entityId,
  entityData,
  state,
}: {
  entityId: string;
  entityData: string | IdObjectSkeletonInterface;
  state: State;
}) {
  const urlString = util.format(
    idmConfigURLTemplate,
    getHostBaseUrl(state.getHost()),
    entityId
  );
  try {
    const { data } = await generateIdmApi({ state }).put(urlString, entityData);
    return data;
  } catch (error) {
    throw Error(`Error on config entity ${entityId}: ${error}`);
  }
}

/**
 * Delete IDM config entity
 * @param {string} entityId config entity id
 * @returns {Promise<unknown>} a promise that resolves to an IDM config entity
 */
export async function deleteConfigEntity({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}) {
  const urlString = util.format(
    idmConfigURLTemplate,
    getHostBaseUrl(state.getHost()),
    entityId
  );
  const { data } = await generateIdmApi({ state }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
