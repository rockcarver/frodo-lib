import util from 'util';

import { State } from '../../../shared/State';
import { getApiSearchAll } from '../../../utils/ExportImportUtils';
import { getHostOnlyUrl } from '../../../utils/ForgeRockUtils';
import { Metadata } from '../../ApiTypes';
import { generateGovernanceApi } from '../../BaseApi';

const requestFormsEndpointURLTemplate = '%s/iga/governance/requestForms';
const requestFormURLTemplate = requestFormsEndpointURLTemplate + '/%s';
const requestFormAssignmentsEndpointURLTemplate =
  '%s/iga/governance/requestFormAssignments';
const assignRequestFormAssignmentsEndpointURLTemplate =
  requestFormAssignmentsEndpointURLTemplate + '?_action=assign';
const unassignRequestFormAssignmentsEndpointURLTemplate =
  requestFormAssignmentsEndpointURLTemplate + '?_action=unassign';

export type RequestFormType = 'lcmRequest' | 'request' | 'applicationRequest';
export type RequestFormOperationType = 'create' | 'update' | 'delete';
export type Field =
  | TextField
  | TextAreaField
  | CheckboxField
  | SelectField
  | MultiSelectField
  | DateField
  | FormTextField
  | SectionField;
export type FieldType =
  | 'string'
  | 'textarea'
  | 'checkbox'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'section'
  | 'formText';
export type SelectFieldObjectType =
  | 'entitlement'
  | 'application'
  | 'organization'
  | 'role'
  | 'user';

export interface RequestFormEvent {
  type?: 'script';
  script?: string | string[];
}

export interface FieldRow {
  id: string;
  fields: Field[];
}

export interface RequestFormField {
  id: string;
  type: FieldType;
  customSlot: 'formText' | false;
  validation: {
    required?: boolean;
    regex?: {
      pattern?: string;
      message?: string;
    };
  };
  layout: {
    columns: number;
    offset: number;
  };
}

export interface CustomFormField extends RequestFormField {
  model: string;
  label: string;
  description?: string;
  readOnly: boolean;
  onChangeEvent: RequestFormEvent;
}

export interface TextField extends CustomFormField {
  defaultValue: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TextAreaField extends TextField {} // Same as TextField

export interface CheckboxField extends CustomFormField {
  defaultValue: boolean;
}

export interface SelectField extends CustomFormField {
  options:
    | {
        object: SelectFieldObjectType;
        queryFilter?: string;
      }
    | {
        value: string;
        label: string;
        selectedByDefault?: boolean;
      }[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MultiSelectField extends SelectField {} // Same as SelectField

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DateField extends CustomFormField {} // Same as CustomFormField

export interface FormTextField extends RequestFormField {
  formText: string;
}

export interface SectionField extends RequestFormField {
  model: string;
  header: string;
  footer: string;
  fields: FieldRow[];
}

export interface RequestFormForm {
  fields?: FieldRow[];
  events?: {
    onLoad?: RequestFormEvent;
  };
}

export interface RequestFormSkeleton {
  name: string;
  type: RequestFormType;
  id: string;
  description: string;
  categories: {
    applicationType: string | null;
    objectType: string | null;
    operation: RequestFormOperationType;
    lcmType?: string | null;
    requestType?: string;
  };
  form: RequestFormForm;
  _rev?: number;
  metadata?: Metadata;
  // This is a field we use when exporting to include any references to configuration that depends on the request form (such as workflows, request types, or applications)
  assignments?: RequestFormAssignment[];
}

export interface RequestFormAssignment {
  formId: string;
  /**
   * objectId looks different depending on the request form type, but uses data from the categories if it's the first assignment:
   *
   * Applications: application/<applicationType>/<objectType>/<operation>
   * LCM: lcm/<lcmType>/<operation>
   * Custom Request: requestType/<requestType>
   */
  objectId: string;
  metadata?: Metadata;
}

/**
 * Get request form
 * @param {string} formId The request form id
 * @returns {Promise<RequestFormSkeleton>} A promise that resolves to a request form object
 */
export async function getRequestForm({
  formId,
  state,
}: {
  formId: string;
  state: State;
}): Promise<RequestFormSkeleton> {
  const urlString = util.format(
    requestFormURLTemplate,
    getHostOnlyUrl(state.getHost()),
    formId
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
 * Query request forms
 * @param {string} queryFilter The query filter to query with. Default: 'true'
 * @param {string[]} fields Fields array to specify which fields to return. By default it will return all fields
 * @returns {Promise<RequestFormSkeleton[]>} A promise that resolves to an array of request form objects
 */
export async function queryRequestForms({
  queryFilter = 'true',
  fields = [],
  state,
}: {
  queryFilter?: string;
  fields?: string[];
  state: State;
}): Promise<RequestFormSkeleton[]> {
  const urlString = util.format(
    requestFormsEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  return await getApiSearchAll<RequestFormSkeleton>({
    url: urlString,
    queryFilter,
    fields,
    state,
  });
}

/**
 * Get request form assignments. If no id(s) are provided, it will return all existing form assignments.
 * @param {string} formId The optional request form id. If specified, gets assignments for the specified form.
 * @param {string} workflowId The optional workflow id. If specified, gets assignments for the specified workflow.
 * @param {string} applicationId The optional application id. If specified, gets assignments for the specified application.
 * @param {string} requestTypeId The optional request type id. If specified, gets assignments for the specified request type.
 * @param {boolean} onlyWorkflow Optional flag to return only workflow related assignments. Default: false
 * @returns {Promise<RequestFormAssignment[]>} A promise that resolves to an array of request form assignment objects
 */
export async function getRequestFormAssignments({
  formId,
  workflowId,
  applicationId,
  requestTypeId,
  onlyWorkflow = false,
  state,
}: {
  formId?: string;
  workflowId?: string;
  applicationId?: string;
  requestTypeId?: string;
  onlyWorkflow?: boolean;
  state: State;
}): Promise<RequestFormAssignment[]> {
  const urlString = util.format(
    requestFormAssignmentsEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const andExpressions = [];
  const orExpressions = [];
  if (formId) {
    andExpressions.push(`formId eq "${formId}"`);
  }
  if (onlyWorkflow) {
    andExpressions.push('objectId sw "workflow"');
  }
  if (workflowId) {
    orExpressions.push(`objectId sw "workflow/${workflowId}"`);
  }
  if (applicationId) {
    orExpressions.push(`objectId sw "application/${applicationId}"`);
  }
  if (requestTypeId) {
    orExpressions.push(`objectId sw "requestType/${requestTypeId}"`);
  }
  if (orExpressions.length) {
    andExpressions.push(`(${orExpressions.join(' or ')})`);
  }
  return await getApiSearchAll<RequestFormAssignment>({
    url: urlString,
    queryFilter: andExpressions.length ? andExpressions.join(' and ') : 'true',
    state,
  });
}

/**
 * Put request form
 * @param {string} formId The request form id
 * @param {RequestFormSkeleton} formData The request form data
 * @returns {Promise<RequestFormSkeleton>} A promise that resolves to a request form object
 */
export async function putRequestForm({
  formId,
  formData,
  state,
}: {
  formId: string;
  formData: RequestFormSkeleton;
  state: State;
}): Promise<RequestFormSkeleton> {
  const urlString = util.format(
    requestFormURLTemplate,
    getHostOnlyUrl(state.getHost()),
    formId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).put(urlString, formData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Assign request form to an object
 * @param {string} formId The request form id
 * @param {string} objectId The object id
 * @returns {Promise<RequestFormAssignment>} A promise that resolves to a request form assignment object
 */
export async function assignRequestForm({
  formId,
  objectId,
  state,
}: {
  formId: string;
  objectId: string;
  state: State;
}): Promise<RequestFormAssignment> {
  const urlString = util.format(
    assignRequestFormAssignmentsEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).post(
    urlString,
    {
      formId,
      objectId,
    },
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Unassign request form from an object
 * @param {string} formId The request form id
 * @param {string} objectId The object id
 * @returns {Promise<RequestFormAssignment>} A promise that resolves to a request form assignment object
 */
export async function unassignRequestForm({
  formId,
  objectId,
  state,
}: {
  formId: string;
  objectId: string;
  state: State;
}): Promise<RequestFormAssignment> {
  const urlString = util.format(
    unassignRequestFormAssignmentsEndpointURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).post(
    urlString,
    {
      formId,
      objectId,
    },
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete request form
 * @param {string} formId The request form id
 * @returns {Promise<RequestFormSkeleton>} A promise that resolves to a request form object
 */
export async function deleteRequestForm({
  formId,
  state,
}: {
  formId: string;
  state: State;
}): Promise<RequestFormSkeleton> {
  const urlString = util.format(
    requestFormURLTemplate,
    getHostOnlyUrl(state.getHost()),
    formId
  );
  const { data } = await generateGovernanceApi({
    resource: {},
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
