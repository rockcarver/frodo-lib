import util from 'util';

import { State } from '../../shared/State';
import { getHostOnlyUrl } from '../../utils/ForgeRockUtils';
import { IdObjectSkeletonInterface, PagedResult } from '../ApiTypes';
import { generateEnvApi } from '../BaseApi';

const variablesListURLTemplate = '%s/environment/variables';
const variableURLTemplate = '%s/environment/variables/%s';
const variableSetDescriptionURLTemplate = `${variableURLTemplate}?_action=setDescription`;

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Variable types
 *
 * @summary
 * You can use the expressionType parameter to set a type when you create an ESV variable.
 * This lets Identity Cloud correctly transform the value of the ESV
 * to match the configuration property type when substituting it into configuration.
 *
 * The type is set when the ESV is created, and cannot be modified after creation.
 * If you do not specify a type, it will default to string.
 *
 * Before the expressionType parameter was introduced, it was only possible to set types
 * from within configuration, using expression level syntax; for example,
 * {"$int": "&{esv.journey.ldap.port|1389}"}.
 * The expressionType parameter supplements this expression level syntax and allows the
 * ESV type to be identified without inspecting configuration.
 *
 * @see
 * {@link https://backstage.forgerock.com/docs/idcloud/latest/tenants/esvs.html#variable_types | ForgeRock Documentation}
 */
export type VariableExpressionType =
  | 'array'
  | 'base64encodedinlined'
  | 'bool'
  | 'int'
  | 'keyvaluelist'
  | 'list'
  | 'number'
  | 'object'
  | 'string';

/**
 * Variable object skeleton
 */
export type VariableSkeleton = IdObjectSkeletonInterface & {
  valueBase64?: string;
  value?: string;
  description?: string;
  loaded?: boolean;
  lastChangedBy?: string;
  lastChangeDate?: string;
  expressionType?: VariableExpressionType;
};

/**
 * Get all variables
 * @returns {Promise<PagedResult<VariableSkeleton>>} a promise that resolves to an array of variable objects
 */
export async function getVariables({
  state,
}: {
  state: State;
}): Promise<PagedResult<VariableSkeleton>> {
  const urlString = util.format(
    variablesListURLTemplate,
    getHostOnlyUrl(state.getHost())
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get variable by id/name
 * @param {string} variableId variable id/name
 * @returns {Promise<VariableSkeleton>} a promise that resolves to a variable object
 */
export async function getVariable({
  variableId,
  state,
}: {
  variableId: string;
  state: State;
}): Promise<VariableSkeleton> {
  const urlString = util.format(
    variableURLTemplate,
    getHostOnlyUrl(state.getHost()),
    variableId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create or update variable by id/name
 * @param {string} variableId variable id/name
 * @param {string} valueBase64 base64-encoded variable value
 * @param {string} description variable description
 * @returns {Promise<unknown>} a promise that resolves to a variable object
 */
export async function putVariable({
  variableId,
  valueBase64,
  description = '',
  expressionType = 'string',
  state,
}: {
  variableId: string;
  valueBase64: string;
  description?: string;
  expressionType?: VariableExpressionType;
  state: State;
}): Promise<VariableSkeleton> {
  const variableData: VariableSkeleton = {
    valueBase64,
    description,
    expressionType,
  };
  const urlString = util.format(
    variableURLTemplate,
    getHostOnlyUrl(state.getHost()),
    variableId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).put(urlString, variableData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Set variable description
 * @param {string} variableId variable id/name
 * @param {string} description variable description
 * @returns {Promise<any>} a promise that resolves to an empty string.
 */
export async function setVariableDescription({
  variableId,
  description,
  state,
}: {
  variableId: string;
  description: string;
  state: State;
}): Promise<any> {
  const urlString = util.format(
    variableSetDescriptionURLTemplate,
    getHostOnlyUrl(state.getHost()),
    variableId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).post(urlString, { description }, { withCredentials: true });
  return data;
}

/**
 * Delete variable by id/name
 * @param {string} variableId variable id/name
 * @returns {Promise<VariableSkeleton>} a promise that resolves to a variable object
 */
export async function deleteVariable({
  variableId,
  state,
}: {
  variableId: string;
  state: State;
}): Promise<VariableSkeleton> {
  const urlString = util.format(
    variableURLTemplate,
    getHostOnlyUrl(state.getHost()),
    variableId
  );
  const { data } = await generateEnvApi({
    resource: getApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
