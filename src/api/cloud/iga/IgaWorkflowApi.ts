import util from 'util';

import { State } from '../../../shared/State';
import { getHostOnlyUrl } from '../../../utils/ForgeRockUtils';
import { generateGovernanceApi } from '../../BaseApi';
import { StaticNodeRefSkeletonInterface } from '../../NodeApi';
import { governanceApiSearchAll } from '../../../utils/ExportImportUtils';

const allWorkflowsURLTemplate = '%s/iga/governance/workflow';
const workflowURLTemplate = allWorkflowsURLTemplate + '/%s';
const draftWorkflowURLTemplate = workflowURLTemplate + '/draft';
const publishedWorkflowURLTemplate = workflowURLTemplate + '/published';
const publishWorkflowURLTemplate = allWorkflowsURLTemplate + '?_action=publish';

// The orchestration endpoints are what the admin UI use instead for workflow operations
const allOrchestrationsURLTemplate = '%s/auto/orchestration/definition';
const orchestrationURLTemplate = allOrchestrationsURLTemplate + '/%s';
const publishedOrchestrationURLTemplate =
  orchestrationURLTemplate + '/published';

export type StepType =
  | 'scriptTask'
  | 'violationTask'
  | 'fulfillmentTask'
  | 'emailTask'
  | 'waitTask'
  | 'approvalTask';

export type ApprovalMode = 'any';

export interface TaskConfiguration {
  nextStep: {
    // Condition is a script expression
    condition: null | string;
    outcome: string;
    step: null | string;
  }[];
}

export interface ScriptTask extends TaskConfiguration {
  language: 'javascript';
  script: string;
  gatewayType?: 'inclusive';
}

export interface ViolationTask extends TaskConfiguration {
  approvalMode: ApprovalMode;
  actors: WorkflowExpression | WorkflowActor[];
  events: {
    assignment?: WorkflowNotification;
    reassign?: WorkflowNotification;
    reminder?: WorkflowNotification;
    escalation?: WorkflowNotification;
    expiration?: WorkflowNotification;
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FulfillmentTask extends ViolationTask {} // Same as ViolationTask

export interface EmailTask extends TaskConfiguration {
  to: string | WorkflowExpression;
  cc: string | WorkflowExpression;
  bcc: string | WorkflowExpression;
  object: Record<string, string | number | boolean>;
  templateName: string;
}

export interface WaitTask extends TaskConfiguration {
  resumeDate: WorkflowExpression;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApprovalTask extends ViolationTask {} // Same as ViolationTask

export interface WorkflowActor {
  id: string | WorkflowExpression;
  permissions?: {
    approve?: boolean;
    fulfill?: boolean;
    allow?: boolean;
    reject?: boolean;
    deny?: boolean;
    exception?: boolean;
    remediate?: boolean;
    modify?: boolean;
    reassign: boolean;
    comment: boolean;
  };
  type?:
    | 'user'
    | 'role'
    | 'applicationOwner'
    | 'manager'
    | 'entitlementOwner'
    | 'roleOwner';
}

export interface WorkflowExpression {
  isExpression?: boolean;
  value: string;
}

export interface WorkflowNotification {
  action?: 'reassign';
  notification?: string;
  frequency?: number;
  date?: WorkflowExpression;
  actors?: WorkflowActor[];
}

export interface WorkflowSkeleton {
  id: string;
  name: string;
  displayName: string;
  description: string;
  type?: string;
  childType: boolean;
  _rev: number;
  steps: WorkflowStep[];
  staticNodes: {
    startNode: WorkflowStaticNode;
    endNode: WorkflowStaticNode;
    uiConfig: Record<string, StepStaticNode>;
  };
  status: 'published' | 'draft';
  mutable: boolean;
}

export type WorkflowStep = {
  [s in StepType]?:
    | ApprovalTask
    | ViolationTask
    | FulfillmentTask
    | ScriptTask
    | WaitTask
    | EmailTask;
} & {
  name: string;
  displayName: string;
  type: StepType;
  approvalMode?: ApprovalMode;
};

export interface WorkflowStaticNode extends StaticNodeRefSkeletonInterface {
  id: string;
  connections: null | {
    start?: string;
  };
  name?: string;
  nodeType?: string;
  displayType?: string;
  isDroppable?: boolean;
  isDeleteable?: boolean;
  isEditable?: boolean;
  isHovered?: boolean;
  hasError?: boolean;
  displayDetails?: {
    icon: string;
    variant: string;
    value: string;
  };
  _outcomes?: { id: string; displayName: string }[];
  template?: null;
  schema?: null;
}

export interface StepStaticNode extends StaticNodeRefSkeletonInterface {
  actors?: WorkflowExpression | WorkflowActor[];
  events?: {
    resumeDateType?: string;
    resumeDateNumber?: number;
    resumeDateTimeSpan?: string;
    escalationDate?: number;
    escalationTimeSpan?: string;
    escalationType?: string;
    expirationDate?: number;
    expirationTimeSpan?: string;
    reminderDate?: number;
    reminderTimeSpan?: string;
    expirationDateType?: string;
    expirationDateVariable?: string;
    reassignedActors?: WorkflowActor[];
    resumeDateRequestProperty?: string;
    resumeDateVariable?: string;
  };
}

/**
 * Get draft workflow
 * @param {string} workflowId the workflow id
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
 */
export async function getDraftWorkflow({
  workflowId,
  state,
}: {
  workflowId: string;
  state: State;
}): Promise<WorkflowSkeleton> {
  const urlString = util.format(
    draftWorkflowURLTemplate,
    getHostOnlyUrl(state.getHost()),
    workflowId
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
 * Get published workflow
 * @param {string} workflowId the workflow id
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
 */
export async function getPublishedWorkflow({
  workflowId,
  state,
}: {
  workflowId: string;
  state: State;
}): Promise<WorkflowSkeleton> {
  const urlString = util.format(
    publishedWorkflowURLTemplate,
    getHostOnlyUrl(state.getHost()),
    workflowId
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
 * Query all workflows
 * @param {string} queryString The query string that matches name, displayName, and description keys. Default is '' which returns all workflows (see https://docs.pingidentity.com/pingoneaic/identity-governance/rest-api/endpoints/rest-iga.html#rest-api-workflow)
 * @returns {Promise<WorkflowSkeleton[]>} a promise that resolves to an object containing an array of workflow objects
 */
export async function queryWorkflows({
  queryString = '',
  state,
}: {
  queryString?: string;
  state: State;
}): Promise<WorkflowSkeleton[]> {
  const urlString = util.format(
    allWorkflowsURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  return await governanceApiSearchAll({
    url: urlString,
    pageOffsetStrategy: 'PAGE',
    pageSize: 10000,
    // The page offset starts at 1 instead of 0 for workflows, so we need to add one to it
    queryParamBuilder: (size, offset) =>
      `_queryString=${queryString}&_pageSize=${size}&_pagedResultsOffset=${offset + 1}`,
    state,
  });
}

/**
 * Put workflow
 * @param {string} workflowId the workflow id
 * @param {WorkflowSkeleton} workflowData the workflow object
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
 */
export async function putWorkflow({
  workflowId,
  workflowData,
  state,
}: {
  workflowId: string;
  workflowData: WorkflowSkeleton;
  state: State;
}): Promise<WorkflowSkeleton> {
  const urlString = util.format(
    workflowURLTemplate,
    getHostOnlyUrl(state.getHost()),
    workflowId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).put(urlString, workflowData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete draft workflow
 * @param {string} workflowId the workflow id
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
 */
export async function deleteDraftWorkflow({
  workflowId,
  state,
}: {
  workflowId: string;
  state: State;
}): Promise<WorkflowSkeleton> {
  const urlString = util.format(
    draftWorkflowURLTemplate,
    getHostOnlyUrl(state.getHost()),
    workflowId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete published workflow
 * @param {string} workflowId the workflow id
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
 */
export async function deletePublishedWorkflow({
  workflowId,
  state,
}: {
  workflowId: string;
  state: State;
}): Promise<WorkflowSkeleton> {
  const urlString = util.format(
    // Need to use orchestration endpoint here instead due to a bug with the workflow endpoint that returns a 500 error in some cases when you try to delete a published workflow (as of AIC version 20679.0).
    publishedOrchestrationURLTemplate,
    getHostOnlyUrl(state.getHost()),
    workflowId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Publish workflow
 * @param {WorkflowSkeleton} workflowData the workflow object
 * @returns {Promise<WorkflowSkeleton>} a promise that resolves to a workflow object
 */
export async function publishWorkflow({
  workflowData,
  state,
}: {
  workflowData: WorkflowSkeleton;
  state: State;
}): Promise<WorkflowSkeleton> {
  const urlString = util.format(
    publishWorkflowURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).post(urlString, workflowData, {
    withCredentials: true,
  });
  return data;
}
