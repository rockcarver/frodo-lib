import util from 'util';
import { getCurrentRealmPath } from './utils/ApiUtils';
import { generateAmApi } from './BaseApi';
import * as state from '../shared/State';
import { cloneDeep } from '../ops/utils/OpsUtils';
import { PolicySetSkeleton } from './ApiTypes';

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

/**
 * Get all policy sets
 * @returns {Promise} a promise that resolves to an object containing an array of policy set objects
 */
export async function getPolicySets() {
  const urlString = util.format(
    queryAllPolicySetURLTemplate,
    state.getHost(),
    getCurrentRealmPath()
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get policy set
 * @param {string} policySetName policy set name
 * @returns {Promise<PolicySetSkeleton>} a promise that resolves to an object containing an array of policy set objects
 */
export async function getPolicySet(
  policySetName: string
): Promise<PolicySetSkeleton> {
  const urlString = util.format(
    policySetURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    policySetName
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create a policy set
 * @param {Object} policySetData Object representing an policy set
 * @returns {Promise} a promise that resolves to a policy set object
 */
export async function createPolicySet(policySetData) {
  const postData = cloneDeep(policySetData);
  const urlString = util.format(
    createApplicationURLTemplate,
    state.getHost(),
    getCurrentRealmPath()
  );

  const { data } = await generateAmApi(getApiConfig()).post(
    urlString,
    postData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Update policy set
 * @param {Object} policySetData Object representing a policy set
 * @returns {Promise} a promise that resolves to a policy set object
 */
export async function updatePolicySet(policySetData) {
  const appData = cloneDeep(policySetData);
  const urlString = util.format(
    policySetURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    policySetData.name
  );
  const { data } = await generateAmApi(getApiConfig()).put(urlString, appData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete policy set
 * @param {Object} policySetName policy set name
 * @returns {Promise} a promise that resolves to a policy set object
 */
export async function deletePolicySet(policySetName: string) {
  const urlString = util.format(
    policySetURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    policySetName
  );
  const { data } = await generateAmApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
