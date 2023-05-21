import util from 'util';
import { getCurrentRealmPath } from './utils/ApiUtils';
import { generateAmApi } from './BaseApi';
import * as state from '../shared/State';
import { PolicySkeleton } from './ApiTypes';

// const queryAllPoliciesByApplicationURLTemplate =
//   '%s/json%s/policies?_sortKeys=name&_queryFilter=applicationName+eq+%22%s%22';
const queryAllPoliciesURLTemplate = '%s/json%s/policies?_queryFilter=true';
const queryPoliciesByPolicySetURLTemplate =
  '%s/json%s/policies?_queryFilter=applicationName+eq+%22%s%22';
const policyURLTemplate = '%s/json%s/policies/%s';

const apiVersion = 'resource=2.1';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Get all policies
 * @returns {Promise} a promise that resolves to an object containing an array of policy objects
 */
export async function getPolicies() {
  const urlString = util.format(
    queryAllPoliciesURLTemplate,
    state.getHost(),
    getCurrentRealmPath()
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get policies by policy set
 * @param {string} policySetId policy set id/name
 * @returns {Promise} a promise that resolves to an object containing an array of policy objects
 */
export async function getPoliciesByPolicySet(policySetId: string) {
  const urlString = util.format(
    queryPoliciesByPolicySetURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    policySetId
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get policy
 * @param {String} policyId policy id/name
 * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
 */
export async function getPolicy(policyId: string): Promise<PolicySkeleton> {
  const urlString = util.format(
    policyURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    policyId
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put policy
 * @param {String} policyId policy id/name
 * @param {Object} policyData policy object
 * @returns {Promise} a promise that resolves to a policy object
 */
export async function putPolicy(policyId: string, policyData: PolicySkeleton) {
  const urlString = util.format(
    policyURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    policyId
  );
  const { data } = await generateAmApi(getApiConfig()).put(
    urlString,
    policyData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete policy
 * @param {Object} policyId policy id/name
 * @returns {Promise} a promise that resolves to a policy object
 */
export async function deletePolicy(policyId: string) {
  const urlString = util.format(
    policyURLTemplate,
    state.getHost(),
    getCurrentRealmPath(),
    policyId
  );
  const { data } = await generateAmApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
