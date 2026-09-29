import util from 'util';

import { State } from '../../../shared/State';
import { getApiSearchAll } from '../../../utils/ExportImportUtils';
import { getHostOnlyUrl } from '../../../utils/ForgeRockUtils';
import { Metadata, SearchResult } from '../../ApiTypes';
import { generateGovernanceApi } from '../../BaseApi';

const sodPolicyEndpointURLTemplate = '%s/iga/governance/policy';
const sodPolicyURLTemplate = sodPolicyEndpointURLTemplate + '/%s';
const createSodPolicyURLTemplate =
  sodPolicyEndpointURLTemplate + '?_action=create';

export interface PolicyOwner {
  givenName: string;
  id: string;
  mail: string;
  sn: string;
  userName: string;
}

export interface PolicySkeleton {
  name: string;
  description: string;
  policyOwner: PolicyOwner;
  policyRuleIds: string[];
  policyRuleNames?: string[];
  active: boolean;
  id: string;
  scheduleId?: string | null;
  metadata?: Metadata;
}

/**
 * Get a SOD policy by id
 * @param id the Policy id
 * @returns {Promise<PolicySkeleton>}
 */
export async function getSodPolicy({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<PolicySkeleton> {
  const urlString = util.format(
    sodPolicyURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get all SOD policies
 * @returns {Promise<SearchResult<PolicySkeleton> >} a promise that resolves to a policy object
 */
export async function getPolicies({
  state,
}: {
  state: State;
}): Promise<SearchResult<PolicySkeleton>> {
  const urlString = util.format(
    sodPolicyEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create SOD policy
 * @param {PolicySkeleton} policyData the policy object
 * @returns {Promise<PolicySkeleton>} a promise that resolves to a policy object
 */
export async function createPolicy({
  policyData,
  state,
}: {
  policyData: PolicySkeleton;
  state: State;
}): Promise<PolicySkeleton> {
  const urlString = util.format(
    createSodPolicyURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).post(urlString, policyData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Query SOD Policies
 * @param {string} queryFilter The query filter to query with. Default: 'true'
 * @param {string[]} fields Fields array to specify which fields to return. By default it will return all fields
 * @returns { Promise<PolicySkeleton[]> } A promise that resolves to an array of policy objects
 */
export async function queryPolicies({
  queryFilter = 'true',
  fields = [],
  state,
}: {
  queryFilter?: string;
  fields?: string[];
  state: State;
}): Promise<PolicySkeleton[]> {
  const urlString = util.format(
    sodPolicyEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  return await getApiSearchAll<PolicySkeleton>({
    url: urlString,
    queryFilter,
    fields,
    state,
  });
}

/**
 * Update an SOD Policy
 * @param {string} id The policy id
 * @param {PolicySkeleton} policyData The policy data
 * @returns {Promise<PolicySkeleton>} A promise that resolves to a policy object
 */
export async function putPolicy({
  id,
  policyData,
  state,
}: {
  id: string;
  policyData: PolicySkeleton;
  state: State;
}): Promise<PolicySkeleton> {
  const urlString = util.format(
    sodPolicyURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).put(urlString, policyData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete SOD policy
 * @param {string} id The policy id
 * @returns {Promise<PolicySkeleton>} A promise that resolves to a policy object
 */
export async function deletePolicy({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<PolicySkeleton> {
  const urlString = util.format(
    sodPolicyURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
