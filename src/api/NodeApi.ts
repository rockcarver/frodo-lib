import util from 'util';
import { deleteDeepByKey, getCurrentRealmPath } from './utils/ApiUtils';
import { generateAmApi } from './BaseApi';
import storage from '../storage/SessionStorage';

const queryAllNodeTypesURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/nodes?_action=getAllTypes';
const queryAllNodesByTypeURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/nodes/%s?_queryFilter=true';
const queryAllNodesURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/nodes?_action=nextdescendents';
const nodeURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/nodes/%s/%s';

const apiVersion = 'protocol=2.1,resource=1.0';
const getNodeApiConfig = () => {
  const configPath = getCurrentRealmPath();
  return {
    path: `${configPath}/authentication/authenticationtrees`,
    apiVersion,
  };
};

/**
 * Get all node types
 * @returns {Promise} a promise that resolves to an array of node type objects
 */
export async function getNodeTypes() {
  const urlString = util.format(
    queryAllNodeTypesURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath()
  );
  const response = await generateAmApi(getNodeApiConfig()).post(
    urlString,
    {},
    {
      withCredentials: true,
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    }
  );
  return response.data.result;
}

/**
 * Get all nodes
 * @returns {Promise} a promise that resolves to an array of node objects
 */
export async function getNodes() {
  const urlString = util.format(
    queryAllNodesURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath()
  );
  const response = await generateAmApi(getNodeApiConfig()).post(
    urlString,
    {},
    {
      withCredentials: true,
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    }
  );
  return response.data.result;
}

/**
 * Get all nodes by type
 * @param {string} nodeType node type
 * @returns {Promise} a promise that resolves to an array of node objects of the requested type
 */
export async function getNodesByType(nodeType: string) {
  const urlString = util.format(
    queryAllNodesByTypeURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    nodeType
  );
  const response = await generateAmApi(getNodeApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return response.data.result;
}

/**
 * Get node by uuid and type
 * @param {String} nodeId node uuid
 * @param {String} nodeType node type
 * @returns {Promise} a promise that resolves to a node object
 */
export async function getNode(nodeId: string, nodeType: string) {
  const urlString = util.format(
    nodeURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    nodeType,
    nodeId
  );
  const { data } = await generateAmApi(getNodeApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put node by uuid and type
 * @param {String} nodeId node uuid
 * @param {String} nodeType node type
 * @param {Object} nodeData node object
 * @returns {Promise} a promise that resolves to an object containing a node object
 */
export async function putNode(nodeId: string, nodeType: string, nodeData) {
  // until we figure out a way to use transport keys in Frodo,
  // we'll have to drop those encrypted attributes.
  const cleanData = deleteDeepByKey(nodeData, '-encrypted');
  const urlString = util.format(
    nodeURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    nodeType,
    nodeId
  );
  const { data } = await generateAmApi(getNodeApiConfig()).put(
    urlString,
    cleanData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete node by uuid and type
 * @param {String} nodeId node uuid
 * @param {String} nodeType node type
 * @returns {Promise} a promise that resolves to an object containing a node object
 */
export async function deleteNode(nodeId: string, nodeType: string) {
  const urlString = util.format(
    nodeURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    nodeType,
    nodeId
  );
  const { data } = await generateAmApi(getNodeApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
