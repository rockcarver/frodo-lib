import util from 'util';

import { State } from '../shared/State';
import { getCurrentRealmPath } from '../utils/ForgeRockUtils';
import { deleteDeepByKey } from '../utils/JsonUtils';
import {
  AmConfigEntityInterface,
  type IdObjectSkeletonInterface,
  type NoIdObjectSkeletonInterface,
  type PagedResult,
  type QueryResult,
} from './ApiTypes';
import { generateAmApi } from './BaseApi';

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
const customNodeTypeURLTemplate = '%s/json/node-designer/node-type';
const queryAllCustomNodesURLTemplate =
  customNodeTypeURLTemplate + '?_queryFilter=true';
const customNodeURLTemplate = customNodeTypeURLTemplate + '/%s';
const journeyUsageCustomNodesURLTemplate =
  customNodeURLTemplate + '?_action=journeys';

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

export type CustomNodeProperty = {
  title: string;
  description: string;
  type: 'NUMBER' | 'STRING' | 'OBJECT' | 'BOOLEAN';
  required: boolean;
  defaultValue?:
    | string
    | number
    | boolean
    | Record<string, string>
    | string[]
    | number[];
  multivalued: boolean;
  options?: Record<string, string>;
};

export type CustomNodeSkeleton = IdObjectSkeletonInterface & {
  serviceName: string;
  displayName: string;
  description: string;
  outcomes: string[];
  outputs: string[];
  inputs: string[];
  script: string | string[];
  errorOutcome: boolean;
  tags: string[];
  properties: Record<string, CustomNodeProperty>;
};

export type NodeSkeleton = AmConfigEntityInterface & {
  nodes?: InnerNodeRefSkeletonInterface[];
  tree?: string;
  identityResource?: string;
  script?: string;
  emailTemplateName?: string;
  filteredProviders?: string[];
  useScript?: boolean;
  useFilterScript?: boolean;
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
 * Object that is layed out as follows: <realm-path>.<journey-name> = array of nodes where custom node type is used in the journey in the specified realm
 */
export type CustomNodeUsage = Record<string, Record<string, string[]>>;

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

/**
 * Create custom node
 * @param {CustomNodeSkeleton} nodeData custom node object
 * @returns {Promise<CustomNodeSkeleton>} a promise that resolves to an object containing a custom node object
 */
export async function createCustomNode({
  nodeData,
  state,
}: {
  nodeData: CustomNodeSkeleton;
  state: State;
}): Promise<CustomNodeSkeleton> {
  const urlString = util.format(customNodeTypeURLTemplate, state.getHost());
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).post(urlString, nodeData, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get all custom nodes
 * @returns {Promise} a promise that resolves to an object containing an array of custom node objects
 */
export async function getCustomNodes({
  state,
}: {
  state: State;
}): Promise<QueryResult<CustomNodeSkeleton>> {
  const urlString = util.format(
    queryAllCustomNodesURLTemplate,
    state.getHost()
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
 * Get custom node by uuid
 * @param {string} nodeId custom node uuid
 * @returns {Promise<CustomNodeSkeleton>} a promise that resolves to a custom node object
 */
export async function getCustomNode({
  nodeId,
  state,
}: {
  nodeId: string;
  state: State;
}): Promise<CustomNodeSkeleton> {
  const urlString = util.format(customNodeURLTemplate, state.getHost(), nodeId);
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put custom node by uuid.
 * NOTE: due to a bug in the current version of AIC (19646.0), you cannot create a custom node using PUT unless you don't include the if-match header,
 * which header is required to make updates to an existing custom node. Use createCustomNode if you want to create a new custom node.
 * @param {string} nodeId custom node uuid
 * @param {CustomNodeSkeleton} nodeData custom node object
 * @returns {Promise<CustomNodeSkeleton>} a promise that resolves to an object containing a custom node object
 */
export async function putCustomNode({
  nodeId,
  nodeData,
  state,
}: {
  nodeId: string;
  nodeData: CustomNodeSkeleton;
  state: State;
}): Promise<CustomNodeSkeleton> {
  const urlString = util.format(customNodeURLTemplate, state.getHost(), nodeId);
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).put(urlString, nodeData, {
    withCredentials: true,
    headers: {
      'If-Match': '*',
    },
  });
  return data;
}

/**
 * Delete custom node by uuid
 * @param {String} nodeId custom node uuid
 * @returns {Promise<CustomNodeSkeleton>} a promise that resolves to an object containing a custom node object
 */
export async function deleteCustomNode({
  nodeId,
  state,
}: {
  nodeId: string;
  state: State;
}): Promise<CustomNodeSkeleton> {
  const urlString = util.format(customNodeURLTemplate, state.getHost(), nodeId);
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).delete(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Get custom node usage by uuid
 * @param {String} nodeId custom node uuid
 * @returns {Promise<CustomNodeUsage>} a promise that resolves to an object containing a custom node usage object
 */
export async function getCustomNodeUsage({
  nodeId,
  state,
}: {
  nodeId: string;
  state: State;
}): Promise<CustomNodeUsage> {
  const urlString = util.format(
    journeyUsageCustomNodesURLTemplate,
    state.getHost(),
    nodeId
  );
  const { data } = await generateAmApi({
    resource: getNodeApiConfig(),
    state,
  }).post(urlString, undefined, {
    withCredentials: true,
  });
  return data;
}
