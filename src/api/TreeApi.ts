import util from 'util';

import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import type { IdObjectSkeletonInterface } from './ApiTypes';
import { generateAmApi } from './BaseApi';
import { type NodeRefSkeletonInterface } from './NodeApi';

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

export interface UiConfigInterface {
  categories: string;
}

export type TreeSkeleton = IdObjectSkeletonInterface & {
  entryNodeId: string;
  nodes: Record<string, NodeRefSkeletonInterface>;
  identityResource?: string;
  uiConfig?: UiConfigInterface;
  enabled?: boolean;
  innerTreeOnly?: boolean;
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
  treeData: TreeSkeleton | string;
  state: State;
}): Promise<TreeSkeleton> {
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
