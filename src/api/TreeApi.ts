import util from 'util';
import { getCurrentRealmPath } from './utils/ApiUtils';
import { generateAmApi } from './BaseApi';
import State from '../shared/State';
import { TreeSkeleton } from './ApiTypes';

const treeByIdURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/trees/%s';
const queryAllTreesURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/trees?_queryFilter=true';

const apiVersion = 'protocol=2.1,resource=1.0';
const getTreeApiConfig = () => {
  return {
    apiVersion,
  };
};

/**
 * Get all trees
 * @returns {Promise<unknown[]>} a promise that resolves to an array of tree objects
 */
export async function getTrees({ state }: { state: State }) {
  const urlString = util.format(
    queryAllTreesURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getTreeApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get tree by id/name
 * @param {String} id tree id/name
 * @returns {Promise} a promise that resolves to a tree object
 */
export async function getTree({ id, state }: { id: string; state: State }) {
  const urlString = util.format(
    treeByIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    id
  );
  const { data } = await generateAmApi({
    resource: getTreeApiConfig(),
    state,
  }).get(urlString, {
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
export async function putTree({
  treeId,
  treeData,
  state,
}: {
  treeId: string;
  treeData: TreeSkeleton;
  state: State;
}) {
  const urlString = util.format(
    treeByIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    treeId
  );
  const { data } = await generateAmApi({
    resource: getTreeApiConfig(),
    state,
  }).put(urlString, treeData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete tree by id/name
 * @param {String} treeId tree id/name
 * @returns {Promise} a promise that resolves to a tree object
 */
export async function deleteTree({
  treeId,
  state,
}: {
  treeId: string;
  state: State;
}) {
  const urlString = util.format(
    treeByIdURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    treeId
  );
  const { data } = await generateAmApi({
    resource: getTreeApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
