import util from 'util';

import { State } from '../../../shared/State';
import { getApiSearchAll } from '../../../utils/ExportImportUtils';
import { getHostOnlyUrl } from '../../../utils/ForgeRockUtils';
import { Metadata, SearchResult } from '../../ApiTypes';
import { generateGovernanceApi } from '../../BaseApi';

const sodPolicyRuleEndpointURLTemplate = '%s/iga/governance/policy/rule';
const sodPolicyRuleURLTemplate = sodPolicyRuleEndpointURLTemplate + '/%s';
const createSodPolicyRuleURLTemplate =
  sodPolicyRuleEndpointURLTemplate + '?_action=create';

export type PolicyFilterNode =
  | { operator: 'AND' | 'OR' | 'ALL'; operand: PolicyFilterNode[] }
  | {
      operator: 'EQUALS' | 'CONTAINS';
      operand: { targetName: string; targetValue: string };
    };

export interface PolicyOwner {
  givenName: string;
  id: string;
  mail: string;
  sn: string;
  userName: string;
}

export interface ScanTypes {
  preventative: boolean;
  detective: boolean;
}

export interface Remediation {
  schemas: string[];
}

export interface DecisionOptions {
  exception: boolean;
  allow: boolean;
  remediate: boolean;
}

export interface RuleDefinition {
  type: string[];
  operator: 'AND' | 'OR' | 'ALL';
  operand: PolicyFilterNode[];
}

export interface ViolationLifecycle {
  workflow: {
    action: string;
  };
  expiration: {
    expires: boolean;
    action?: string;
    duration?: number;
  };
  exception: {
    justificationCheck: boolean;
  };
}

export interface WorkflowRef {
  id: string;
  type: string;
}

export interface PolicyRuleSkeleton {
  name: string;
  description: string;
  active: boolean;
  id: string;
  policyRuleOwner: PolicyOwner;
  scanTypes: ScanTypes;
  decisionOptions: DecisionOptions;
  maxExceptionDuration: number;
  remediation: Remediation;
  mitigatingControl: string;
  correctionAdvice: string;
  documentationUrl: string;
  violationOwner: PolicyOwner;
  violationLifecycle: ViolationLifecycle;
  violationOwnerType: string;
  userFilter: PolicyFilterNode;
  ruleDefinition: RuleDefinition[];
  workflow?: WorkflowRef;
  riskScore: number;
  ruleDefinitionTags: string[];
  metadata?: Metadata;
}

/**
 * Get a SOD policy rule by id
 * @param id the Policy rule id
 * @returns {Promise<PolicyRuleSkeleton>}
 */
export async function getPolicyRule({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<PolicyRuleSkeleton> {
  const urlString = util.format(
    sodPolicyRuleURLTemplate,
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
 * Get all SOD policy rules
 * @returns {Promise<SearchResult<PolicyRuleSkeleton> >} a promise that resolves to a policy rule object
 */
export async function getPolicyRules({
  state,
}: {
  state: State;
}): Promise<SearchResult<PolicyRuleSkeleton>> {
  const urlString = util.format(
    sodPolicyRuleURLTemplate,
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
 * Create SOD policy rule
 * @param {PolicyRuleSkeleton} policyRuleData the policy object rule
 * @returns {Promise<PolicyRuleSkeleton>} a promise that resolves to a policy rule object
 */
export async function createPolicyRule({
  policyRuleData,
  state,
}: {
  policyRuleData: PolicyRuleSkeleton;
  state: State;
}): Promise<PolicyRuleSkeleton> {
  const urlString = util.format(
    createSodPolicyRuleURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).post(urlString, policyRuleData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Query SOD Policy rules
 * @param {string} queryFilter The query filter to query with. Default: 'true'
 * @param {string[]} fields Fields array to specify which fields to return. By default it will return all fields
 * @returns { Promise<PolicyRuleSkeleton[]> } A promise that resolves to an array of policy objects
 */
export async function queryPolicyRules({
  queryFilter = 'true',
  fields = [],
  state,
}: {
  queryFilter?: string;
  fields?: string[];
  state: State;
}): Promise<PolicyRuleSkeleton[]> {
  const urlString = util.format(
    sodPolicyRuleEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  return await getApiSearchAll<PolicyRuleSkeleton>({
    url: urlString,
    queryFilter,
    fields,
    state,
  });
}

/**
 * Update an SOD Policy rules
 * @param {string} id The policy rule id
 * @param {PolicyRuleSkeleton} policyRuleData The policy rule data
 * @returns {Promise<PolicyRuleSkeleton>} A promise that resolves to a policy rule object
 */
export async function putPolicyRule({
  id,
  policyRuleData,
  state,
}: {
  id: string;
  policyRuleData: PolicyRuleSkeleton;
  state: State;
}): Promise<PolicyRuleSkeleton> {
  const urlString = util.format(
    sodPolicyRuleURLTemplate,
    getHostOnlyUrl(state.getHost()),
    id
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).put(urlString, policyRuleData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete SOD policy rule
 * @param {string} id The policy rule id
 * @returns {Promise<PolicyRuleSkeleton>} A promise that resolves to a policy object
 */
export async function deletePolicyRule({
  id,
  state,
}: {
  id: string;
  state: State;
}): Promise<PolicyRuleSkeleton> {
  const urlString = util.format(
    sodPolicyRuleURLTemplate,
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
