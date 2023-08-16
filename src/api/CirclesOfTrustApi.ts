import util from 'util';

import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { cloneDeep } from '../utils/JsonUtils';
import { type IdObjectSkeletonInterface, type PagedResult } from './ApiTypes';
import { generateAmApi } from './BaseApi';
import { type AmServiceType } from './ServiceApi';

const circleOfTrustByIdURLTemplate =
  '%s/json%s/realm-config/federation/circlesoftrust/%s';
const createCircleOfTrustURLTemplate =
  '%s/json%s/realm-config/federation/circlesoftrust/?_action=create';
const queryAllCirclesOfTrustURLTemplate =
  '%s/json%s/realm-config/federation/circlesoftrust?_queryFilter=true';
const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

export type CircleOfTrustSkeleton = IdObjectSkeletonInterface & {
  status?: string;
  trustedProviders?: string[];
  _type?: AmServiceType;
};

/**
 * Get all circles of trust
 * @returns {Promise<PagedResult<CircleOfTrustSkeleton>>} a promise that resolves to an array of circles of trust objects
 */
export async function getCirclesOfTrust({
  state,
}: {
  state: State;
}): Promise<PagedResult<CircleOfTrustSkeleton>> {
  const urlString = util.format(
    queryAllCirclesOfTrustURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get circle of trust by id/name
 * @param {string} cotId circle of trust id/name
 * @returns {Promise<CircleOfTrustSkeleton>} a promise that resolves to a saml2 circle of trust object
 */
export async function getCircleOfTrust({
  cotId,
  state,
}: {
  cotId: string;
  state: State;
}): Promise<CircleOfTrustSkeleton> {
  const urlString = util.format(
    circleOfTrustByIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    cotId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).get(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Create a circle of trust
 * @param {string} cotId circle of trust id/name
 * @param {CircleOfTrustSkeleton} cotData Object representing a SAML circle of trust
 * @returns {Promise<CircleOfTrustSkeleton>} a promise that resolves to a saml2 circle of trust object
 */
export async function createCircleOfTrust({
  cotData,
  state,
}: {
  cotData: CircleOfTrustSkeleton;
  state: State;
}): Promise<CircleOfTrustSkeleton> {
  const postData = cloneDeep(cotData);
  const urlString = util.format(
    createCircleOfTrustURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, postData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Update circle of trust
 * @param {string} cotId circle of trust id/name
 * @param {CircleOfTrustSkeleton} cotData Object representing a circle of trust
 * @returns {Promise<CircleOfTrustSkeleton>} a promise that resolves to a saml2 circle of trust object
 */
export async function updateCircleOfTrust({
  cotId,
  cotData,
  state,
}: {
  cotId: string;
  cotData: CircleOfTrustSkeleton;
  state: State;
}): Promise<CircleOfTrustSkeleton> {
  delete cotData._id;
  delete cotData._rev;
  const urlString = util.format(
    circleOfTrustByIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    cotId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    cotData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete circle of trust
 * @param {string} realmId realm id
 * @returns {Promise<CircleOfTrustSkeleton>} a promise that resolves to an object containing a realm object
 */
export async function deleteCircleOfTrust({
  cotId,
  state,
}: {
  cotId: string;
  state: State;
}): Promise<CircleOfTrustSkeleton> {
  const urlString = util.format(
    circleOfTrustByIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    cotId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
