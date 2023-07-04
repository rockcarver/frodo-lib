import util from 'util';
import { encode } from '../utils/Base64';
import { getTenantURL, getCurrentRealmPath } from '../utils/ApiUtils';
import { generateEnvApi } from '../BaseApi';
import * as state from '../../shared/State';

const variablesListURLTemplate = '%s/environment/variables';
const variableURLTemplate = '%s/environment/variables/%s';
const variableSetDescriptionURLTemplate = `${variableURLTemplate}?_action=setDescription`;

const apiVersion = 'protocol=1.0,resource=1.0';

/**
 * Get the API config for secrets - exported to allow external calls into variable APIs
 * @returns the API config for secrets
 */
export const getApiConfig = () => {
  const configPath = getCurrentRealmPath();
  return {
    path: `${configPath}/environment/secrets`,
    apiVersion,
  };
};

/**
 * Get all variables
 * @returns {Promise<unknown[]>} a promise that resolves to an array of variable objects
 */
export async function getVariables() {
  const urlString = util.format(
    variablesListURLTemplate,
    getTenantURL(state.getHost())
  );
  const { data } = await generateEnvApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get variable by id/name
 * @param {string} variableId variable id/name
 * @returns {Promise<unknown>} a promise that resolves to a variable object
 */
export async function getVariable(variableId) {
  const urlString = util.format(
    variableURLTemplate,
    getTenantURL(state.getHost()),
    variableId
  );
  const { data } = await generateEnvApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

export type ExpressionType =
  | 'string'
  | 'list'
  | 'array'
  | 'object'
  | 'bool'
  | 'int'
  | 'number'
  | 'base64encodedinlined'
  | 'keyvaluelist';

export type PutVariableRequest = {
  variableId: string;
  value?: string;
  description?: string;
  expressionType?: ExpressionType;
};

/**
 * Put variable by request
 * @param {PutVariableRequest} request with the chosen parameters
 * @returns {Promise<unknown>} a promise that resolves to a variable object
 */
export async function putVariableByRequest({
  variableId,
  value,
  description,
  expressionType,
}: PutVariableRequest) {
  const variableData: {
    valueBase64?: string;
    description?: string;
    expressionType?: string;
  } = {};
  if (value) {
    variableData.valueBase64 = encode(value);
  }
  if (description) {
    variableData.description = description;
  }
  if (expressionType) {
    variableData.expressionType = expressionType;
  }
  const urlString = util.format(
    variableURLTemplate,
    getTenantURL(state.getHost()),
    variableId
  );
  const { data } = await generateEnvApi(getApiConfig()).put(
    urlString,
    variableData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Put variable by id/name
 * @deprecated use putVariableByRequest and provide an expression type
 * @param {string} variableId variable id/name
 * @param {string} value variable value
 * @param {string} description variable description
 * @returns {Promise<unknown>} a promise that resolves to a variable object
 */
export async function putVariable(
  variableId: string,
  value?: string,
  description?: string
) {
  return putVariableByRequest({ variableId, value, description });
}

/**
 * Set variable description
 * @param {string} variableId variable id/name
 * @param {string} description variable description
 * @returns {Promise<unknown>} a promise that resolves to a status object
 */
export async function setVariableDescription(variableId, description) {
  const urlString = util.format(
    variableSetDescriptionURLTemplate,
    getTenantURL(state.getHost()),
    variableId
  );
  const { data } = await generateEnvApi(getApiConfig()).post(
    urlString,
    { description },
    { withCredentials: true }
  );
  return data;
}

/**
 * Delete variable by id/name
 * @param {string} variableId variable id/name
 * @returns {Promise<unknown>} a promise that resolves to a variable object
 */
export async function deleteVariable(variableId) {
  const urlString = util.format(
    variableURLTemplate,
    getTenantURL(state.getHost()),
    variableId
  );
  const { data } = await generateEnvApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
