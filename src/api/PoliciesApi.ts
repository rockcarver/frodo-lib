import util from 'util';

import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import {
  type IdObjectSkeletonInterface,
  type NoIdObjectSkeletonInterface,
} from './ApiTypes';
import { generateAmApi } from './BaseApi';

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

export type PolicyConditionType =
  | 'Script'
  | 'AMIdentityMembership'
  | 'IPv6'
  | 'IPv4'
  | 'SimpleTime'
  | 'LEAuthLevel'
  | 'LDAPFilter'
  | 'AuthScheme'
  | 'Session'
  | 'AND'
  | 'AuthenticateToRealm'
  | 'ResourceEnvIP'
  | 'Policy'
  | 'OAuth2Scope'
  | 'SessionProperty'
  | 'OR'
  | 'Transaction'
  | 'NOT'
  | 'AuthLevel'
  | 'AuthenticateToService';

export type PolicyCondition = NoIdObjectSkeletonInterface & {
  type: PolicyConditionType;
  condition?: PolicyCondition;
  conditions?: PolicyCondition[];
};

export type PolicySkeleton = IdObjectSkeletonInterface & {
  name: string;
  applicationName: string;
  condition?: PolicyCondition;
  resourceTypeUuid: string;
};

/**
 * Get all policies
 * @returns {Promise} a promise that resolves to an object containing an array of policy objects
 */
export async function getPolicies({ state }: { state: State }) {
  const urlString = util.format(
    queryAllPoliciesURLTemplate,
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
 * Get policies by policy set
 * @param {string} policySetId policy set id/name
 * @returns {Promise} a promise that resolves to an object containing an array of policy objects
 */
export async function getPoliciesByPolicySet({
  policySetId,
  state,
}: {
  policySetId: string;
  state: State;
}) {
  const urlString = util.format(
    queryPoliciesByPolicySetURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    policySetId
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
 * Get policy
 * @param {String} policyId policy id/name
 * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
 */
export async function getPolicy({
  policyId,
  state,
}: {
  policyId: string;
  state: State;
}): Promise<PolicySkeleton> {
  const urlString = util.format(
    policyURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    policyId
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
 * Put policy
 * @param {String} policyId policy id/name
 * @param {Object} policyData policy object
 * @returns {Promise} a promise that resolves to a policy object
 */
export async function putPolicy({
  policyId,
  policyData,
  state,
}: {
  policyId: string;
  policyData: PolicySkeleton;
  state: State;
}) {
  const urlString = util.format(
    policyURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    policyId
  );
  const { data } = await generateAmApi({ resource: getApiConfig(), state }).put(
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
export async function deletePolicy({
  policyId,
  state,
}: {
  policyId: string;
  state: State;
}) {
  const urlString = util.format(
    policyURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    policyId
  );
  const { data } = await generateAmApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
