import util from 'util';
import { encode } from './utils/Base64';
import { getTenantURL, getCurrentRealmPath } from './utils/ApiUtils';
import { generateESVApi } from './BaseApi';
import storage from '../storage/SessionStorage';

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
 * @returns {Promise} a promise that resolves to an object containing an array of variable objects
 */
export async function getVariables() {
  const urlString = util.format(
    variablesListURLTemplate,
    getTenantURL(storage.session.getTenant())
  );
  const { data } = await generateESVApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data.result;
}

/**
 * Get variable by id/name
 * @param {String} variableId variable id/name
 * @returns {Promise} a promise that resolves to an object containing a variable object
 */
export async function getVariable(variableId) {
  const urlString = util.format(
    variableURLTemplate,
    getTenantURL(storage.session.getTenant()),
    variableId
  );
  const { data } = await generateESVApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put variable by id/name
 * @param {String} variableId variable id/name
 * @param {String} value variable value
 * @param {String} description variable description
 * @returns {Promise} a promise that resolves to an object containing a variable object
 */
export async function putVariable(variableId, value, description) {
  const variableData = {};
  if (value) variableData['valueBase64'] = encode(value);
  if (description) variableData['description'] = description;
  const urlString = util.format(
    variableURLTemplate,
    getTenantURL(storage.session.getTenant()),
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
 * @param {*} variableId variable id/name
 * @param {*} description variable description
 * @returns {Promise} a promise that resolves to an object containing a status object
 */
export async function setVariableDescription(variableId, description) {
  const urlString = util.format(
    variableSetDescriptionURLTemplate,
    getTenantURL(storage.session.getTenant()),
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
 * @param {String} variableId variable id/name
 * @returns {Promise} a promise that resolves to an object containing a variable object
 */
export async function deleteVariable(variableId) {
  const urlString = util.format(
    variableURLTemplate,
    getTenantURL(storage.session.getTenant()),
    variableId
  );
  const { data } = await generateESVApi(getApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
