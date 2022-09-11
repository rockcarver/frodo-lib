import util from 'util';
import _ from 'lodash';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from './utils/ApiUtils';
import storage from '../storage/SessionStorage';

const circleOfTrustByIdURLTemplate =
  '%s/json%s/realm-config/federation/circlesoftrust/%s';
const createCircleOfTrustURLTemplate =
  '%s/json%s/realm-config/federation/circlesoftrust/?_action=create';
const queryAllCirclesOfTrustURLTemplate =
  '%s/json%s/realm-config/federation/circlesoftrust?_queryFilter=true';
const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  return {
    path: `/json${getCurrentRealmPath()}/realm-config/federation/circlesoftrust`,
    apiVersion,
  };
};

/**
 * Get all SAML2 circles of trust
 * @returns {Promise} a promise that resolves to an array of circles of trust objects
 */
export async function getCirclesOfTrust() {
  const urlString = util.format(
    queryAllCirclesOfTrustURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath()
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get SAML2 circle of trust by id/name
 * @param {String} cotId Circle of trust id/name
 * @returns {Promise} a promise that resolves to a saml2 circle of trust object
 */
export async function getCircleOfTrust(cotId) {
  const urlString = util.format(
    circleOfTrustByIdURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    cotId
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create a SAML2 circle of trust
 * @param {Object} cotData Object representing a SAML circle of trust
 * @returns {Promise} a promise that resolves to a saml2 circle of trust object
 */
export async function createCircleOfTrust(cotData) {
  const postData = _.cloneDeep(cotData);
  const urlString = util.format(
    createCircleOfTrustURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath()
  );
  const { data } = await generateAmApi(getApiConfig()).post(
    urlString,
    postData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Update SAML2 circle of trust
 * @param {String} cotId Entity provider location (hosted or remote)
 * @param {Object} cotData Object representing a SAML2 circle of trust
 * @returns {Promise} a promise that resolves to a saml2 circle of trust object
 */
export async function updateCircleOfTrust(cotId, cotData) {
  const urlString = util.format(
    circleOfTrustByIdURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    cotId
  );
  const { data } = await generateAmApi(getApiConfig()).put(urlString, cotData, {
    withCredentials: true,
  });
  return data;
}
