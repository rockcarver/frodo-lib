import util from 'util';

import { EMAIL_TEMPLATE_TYPE } from '../ops/EmailTemplateOps';
import { State } from '../shared/State';
import { getIdmBaseUrl } from '../utils/ForgeRockUtils';
import {
  IdObjectSkeletonInterface,
  NoIdObjectSkeletonInterface,
  PagedResult,
} from './ApiTypes';
import { generateIdmApi } from './BaseApi';

const idmAllConfigURLTemplate = '%s/config';
const idmConfigURLTemplate = '%s/config/%s';
const idmConfigEntityQueryTemplate = '%s/config?_queryFilter=%s';

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
  const urlString = util.format(idmAllConfigURLTemplate, getIdmBaseUrl(state));
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
    getIdmBaseUrl(state),
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
  onlyVisibleTemplates,
}: {
  type: string;
  state: State;
  onlyVisibleTemplates?: boolean;
}): Promise<PagedResult<NoIdObjectSkeletonInterface>> {
  // Due to a bug (as of Ping IDM 7.5.0) with the query filter for email templates (it happens using both sw or co), in order to get all the email templates you need to use 'emailTemplat' instead.
  if (type === EMAIL_TEMPLATE_TYPE && !onlyVisibleTemplates) {
    type = EMAIL_TEMPLATE_TYPE.substring(0, EMAIL_TEMPLATE_TYPE.length - 1);
  }
  const urlString = util.format(
    idmConfigEntityQueryTemplate,
    getIdmBaseUrl(state),
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
    getIdmBaseUrl(state),
    entityId
  );
  const { data } = await generateIdmApi({ state }).get(urlString);
  return data;
}

/**
 * Put IDM config entity
 * @param {object} params config parameters
 * @param {string} params.entityId config entity id
 * @param {string} params.entityData config entity object
 * @param {boolean} params.wait delay the response until an OSGi service event confirms the change has been consumed by the corresponding service or the request times out.
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IDM config entity
 */
export async function putConfigEntity({
  entityId,
  entityData,
  wait = false,
  state,
}: {
  entityId: string;
  entityData: string | IdObjectSkeletonInterface;
  wait?: boolean;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    idmConfigURLTemplate,
    getIdmBaseUrl(state),
    wait ? `${entityId}?waitForCompletion=true` : entityId
  );
  const { data } = await generateIdmApi({ state }).put(urlString, entityData);
  return data;
}

/**
 * Delete IDM config entity
 * @param {string} entityId config entity id
 * @returns {Promise<IdObjectSkeletonInterface>} a promise that resolves to an IDM config entity
 */
export async function deleteConfigEntity({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  const urlString = util.format(
    idmConfigURLTemplate,
    getIdmBaseUrl(state),
    entityId
  );
  const { data } = await generateIdmApi({ state }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
