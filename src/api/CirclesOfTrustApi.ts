import util from 'util';
import _ from 'lodash';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from './utils/ApiUtils';
import { State } from '../shared/State';
import { CircleOfTrustSkeleton } from './ApiTypes';

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

/**
 * Get all SAML2 circles of trust
 * @returns {Promise} a promise that resolves to an array of circles of trust objects
 */
export async function getCirclesOfTrust({ state }: { state: State }) {
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
 * Get SAML2 circle of trust by id/name
 * @param {String} cotId Circle of trust id/name
 * @returns {Promise} a promise that resolves to a saml2 circle of trust object
 */
export async function getCircleOfTrust({
  cotId,
  state,
}: {
  cotId: string;
  state: State;
}) {
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
 * Create a SAML2 circle of trust
 * @param {CircleOfTrustSkeleton} cotData Object representing a SAML circle of trust
 * @returns {Promise} a promise that resolves to a saml2 circle of trust object
 */
export async function createCircleOfTrust({
  cotData,
  state,
}: {
  cotData: CircleOfTrustSkeleton;
  state: State;
}) {
  const postData = _.cloneDeep(cotData);
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
 * Update SAML2 circle of trust
 * @param {string} cotId Entity provider location (hosted or remote)
 * @param {CircleOfTrustSkeleton} cotData Object representing a SAML2 circle of trust
 * @returns {Promise} a promise that resolves to a saml2 circle of trust object
 */
export async function updateCircleOfTrust({
  cotId,
  cotData,
  state,
}: {
  cotId: string;
  cotData: CircleOfTrustSkeleton;
  state: State;
}) {
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
