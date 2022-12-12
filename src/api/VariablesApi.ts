import util from 'util';
import { encode } from './utils/Base64';
import { getTenantURL, getCurrentRealmPath } from './utils/ApiUtils';
import { generateESVApi } from './BaseApi';
import * as state from '../shared/State';

const variablesListURLTemplate = '%s/environment/variables';
const variableURLTemplate = '%s/environment/variables/%s';
const variableSetDescriptionURLTemplate = `${variableURLTemplate}?_action=setDescription`;

const apiVersion = 'protocol=1.0,resource=1.0';
const getApiConfig = () => {
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
  const { data } = await generateESVApi(getApiConfig()).get(urlString, {
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
  const { data } = await generateESVApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put variable by id/name
 * @param {string} variableId variable id/name
 * @param {string} value variable value
 * @param {string} description variable description
 * @returns {Promise<unknown>} a promise that resolves to a variable object
 */
export async function putVariable(variableId, value, description) {
  const variableData = {};
  if (value) variableData['valueBase64'] = encode(value);
  if (description) variableData['description'] = description;
  const urlString = util.format(
    variableURLTemplate,
    getTenantURL(state.getHost()),
    variableId
  );
  const { data } = await generateESVApi(getApiConfig()).put(
    urlString,
    variableData,
    {
      withCredentials: true,
    }
  );
  return data;
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
  const { data } = await generateESVApi(getApiConfig()).post(
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
  const { data } = await generateESVApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
