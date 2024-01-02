import util from 'util';

import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { deleteDeepByKey } from '../utils/JsonUtils';
import {
  type IdObjectSkeletonInterface,
  type NoIdObjectSkeletonInterface,
  type PagedResult,
  type QueryResult,
} from './ApiTypes';
import { generateAmApi } from './BaseApi';
import { type AmServiceType } from './ServiceApi';

const queryAllNodeTypesURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/nodes?_action=getAllTypes';
const queryAllNodesByTypeURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/nodes/%s?_queryFilter=true';
const queryAllNodesURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/nodes?_action=nextdescendents';
const nodeURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/nodes/%s/%s';
const createNodeURLTemplate =
  '%s/json%s/realm-config/authentication/authenticationtrees/nodes/%s?_action=create';

const apiVersion = 'protocol=2.1,resource=1.0';
const getNodeApiConfig = () => {
  return {
    apiVersion,
  };
};

export interface NodeRefSkeletonInterface {
  connections: Record<string, string>;
  displayName: string;
  nodeType: string;
  x: number;
  y: number;
}

export interface StaticNodeRefSkeletonInterface {
  x: number;
  y: number;
}

export interface InnerNodeRefSkeletonInterface {
  _id: string;
  displayName: string;
  nodeType: string;
}

export type NodeSkeleton = IdObjectSkeletonInterface & {
  _type: AmServiceType;
  nodes?: InnerNodeRefSkeletonInterface[];
  tree?: string;
  identityResource?: string;
  script?: string;
  emailTemplateName?: string;
  filteredProviders?: string[];
  useScript?: boolean;
};

export type NodeTypeSkeleton = IdObjectSkeletonInterface & {
  name: string;
  collection: boolean;
  tags: string[];
  metadata: {
    tags: string[];
    [k: string]: string | number | boolean | string[];
  };
  help: string;
};

/**
 * Get all node types
 * @returns {Promise<QueryResult<NodeTypeSkeleton>>} a promise that resolves to an array of node type objects
 */
export async function getNodeTypes({
  state,
}: {
  state: State;
}): Promise<QueryResult<NodeTypeSkeleton>> {
  const urlString = util.format(
    queryAllNodeTypesURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).post(
    urlString,
    {},
    {
      withCredentials: true,
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    }
  );
  return data;
}

/**
 * Get all nodes
 * @returns {Promise} a promise that resolves to an object containing an array of node objects
 */
export async function getNodes({
  state,
}: {
  state: State;
}): Promise<QueryResult<NodeSkeleton>> {
  const urlString = util.format(
    queryAllNodesURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state)
  );
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).post(
    urlString,
    {},
    {
      withCredentials: true,
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    }
  );
  return data;
}

/**
 * Get all nodes by type
 * @param {string} nodeType node type
 * @returns {Promise<PagedResult<NodeSkeleton>>} a promise that resolves to an object containing an array of node objects of the requested type
 */
export async function getNodesByType({
  nodeType,
  state,
}: {
  nodeType: string;
  state: State;
}): Promise<PagedResult<NodeSkeleton>> {
  const urlString = util.format(
    queryAllNodesByTypeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    nodeType
  );
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get node by uuid and type
 * @param {string} nodeId node uuid
 * @param {string} nodeType node type
 * @returns {Promise<NodeSkeleton>} a promise that resolves to a node object
 */
export async function getNode({
  nodeId,
  nodeType,
  state,
}: {
  nodeId: string;
  nodeType: string;
  state: State;
}): Promise<NodeSkeleton> {
  const urlString = util.format(
    nodeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    nodeType,
    nodeId
  );
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Create node by type
 * @param {string} nodeType node type
 * @param {object} nodeData node object
 * @returns {Promise<NodeSkeleton>} a promise that resolves to a node object
 */
export async function createNode({
  nodeType,
  nodeData,
  state,
}: {
  nodeType: string;
  nodeData: NodeSkeleton;
  state: State;
}): Promise<NodeSkeleton> {
  const urlString = util.format(
    createNodeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    nodeType
  );
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).post(urlString, nodeData, {
    withCredentials: true,
    headers: { 'Accept-Encoding': 'gzip, deflate, br' },
  });
  return data;
}

/**
 * Put node by uuid and type
 * @param {string} nodeId node uuid
 * @param {string} nodeType node type
 * @param {object} nodeData node object
 * @returns {Promise} a promise that resolves to an object containing a node object
 */
export async function putNode({
  nodeId,
  nodeType,
  nodeData,
  state,
}: {
  nodeId: string;
  nodeType: string;
  nodeData: NodeSkeleton | NoIdObjectSkeletonInterface;
  state: State;
}) {
  // until we figure out a way to use transport keys in Frodo,
  // we'll have to drop those encrypted attributes.
  const cleanData = deleteDeepByKey(nodeData, '-encrypted');
  const urlString = util.format(
    nodeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    nodeType,
    nodeId
  );
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).put(urlString, cleanData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Delete node by uuid and type
 * @param {String} nodeId node uuid
 * @param {String} nodeType node type
 * @returns {Promise} a promise that resolves to an object containing a node object
 */
export async function deleteNode({
  nodeId,
  nodeType,
  state,
}: {
  nodeId: string;
  nodeType: string;
  state: State;
}) {
  const urlString = util.format(
    nodeURLTemplate,
    state.getHost(),
    getCurrentRealmPath(state),
    nodeType,
    nodeId
  );
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}
