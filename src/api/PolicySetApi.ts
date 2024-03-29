import util from 'util';

import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { cloneDeep } from '../utils/JsonUtils';
import { type NoIdObjectSkeletonInterface } from './ApiTypes';
import { generateAmApi } from './BaseApi';

const queryAllPolicySetURLTemplate =
  '%s/json%s/applications?_sortKeys=name&_queryFilter=name+eq+%22%5E(%3F!sunAMDelegationService%24).*%22';
const policySetURLTemplate = '%s/json%s/applications/%s';
const createApplicationURLTemplate = '%s/json%s/applications/?_action=create';

const apiVersion = 'protocol=1.0,resource=2.1';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

export type PolicySetSkeleton = NoIdObjectSkeletonInterface & {
  name: string;
  resourceTypeUuids: string[];
};

/**
 * Get all policy sets
 * @returns {Promise} a promise that resolves to an object containing an array of policy set objects
 */
export async function getPolicySets({ state }: { state: State }) {
  const urlString = util.format(
    queryAllPolicySetURLTemplate,
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
 * Get policy set
 * @param {string} policySetName policy set name
 * @returns {Promise<PolicySetSkeleton>} a promise that resolves to an object containing an array of policy set objects
 */
export async function getPolicySet({
  policySetName,
  state,
}: {
  policySetName: string;
  state: State;
}): Promise<PolicySetSkeleton> {
  const urlString = util.format(
    policySetURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    policySetName
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
 * Create a policy set
 * @param {Object} policySetData Object representing an policy set
 * @returns {Promise} a promise that resolves to a policy set object
 */
export async function createPolicySet({
  policySetData,
  state,
}: {
  policySetData: PolicySetSkeleton;
  state: State;
}) {
  const postData = cloneDeep(policySetData);
  const urlString = util.format(
    createApplicationURLTemplate,
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
 * Update policy set
 * @param {Object} policySetData Object representing a policy set
 * @returns {Promise} a promise that resolves to a policy set object
 */
export async function updatePolicySet({
  policySetName = undefined,
  policySetData,
  state,
}: {
  policySetName?: string;
  policySetData: PolicySetSkeleton;
  state: State;
}) {
  const appData = cloneDeep(policySetData);
  if (policySetName) appData.name = policySetName;
  const urlString = util.format(
    policySetURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    appData.name
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
    urlString,
    appData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete policy set
 * @param {Object} policySetName policy set name
 * @returns {Promise} a promise that resolves to a policy set object
 */
export async function deletePolicySet({
  policySetName,
  state,
}: {
  policySetName: string;
  state: State;
}) {
  const urlString = util.format(
    policySetURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    policySetName
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
