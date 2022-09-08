import util from 'util';
import { getCurrentRealmPath } from './utils/ApiUtils';
import { generateAmApi } from './BaseApi';
import storage from '../storage/SessionStorage';

const treeByIdURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/trees/%s';
const queryAllTreesURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/trees?_queryFilter=true';

const apiVersion = 'protocol=2.1,resource=1.0';
const getTreeApiConfig = () => {
  const configPath = getCurrentRealmPath();
  return {
    path: `${configPath}/authentication/authenticationtrees`,
    apiVersion,
  };
};

/**
 * Get all trees
 * @returns {Promise<unknown[]>} a promise that resolves to an array of tree objects
 */
export async function getTrees() {
  const urlString = util.format(
    queryAllTreesURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath()
  );
  const { data } = await generateAmApi(getTreeApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data.result;
}

/**
 * Get tree by id/name
 * @param {String} id tree id/name
 * @returns {Promise} a promise that resolves to a tree object
 */
export async function getTree(id) {
  const urlString = util.format(
    treeByIdURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    id
  );
  const { data } = await generateAmApi(getTreeApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put tree by id/name
 * @param {String} treeId tree id/name
 * @param {Object} treeData tree object
 * @returns {Promise} a promise that resolves to a tree object
 */
export async function putTree(treeId: string, treeData) {
  const urlString = util.format(
    treeByIdURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    treeId
  );
  const { data } = await generateAmApi(getTreeApiConfig()).put(
    urlString,
    treeData,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Delete tree by id/name
 * @param {String} treeId tree id/name
 * @returns {Promise} a promise that resolves to a tree object
 */
export async function deleteTree(treeId) {
  const urlString = util.format(
    treeByIdURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    treeId
  );
  const { data } = await generateAmApi(getTreeApiConfig()).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
