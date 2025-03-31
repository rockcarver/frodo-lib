import axios, { AxiosError } from 'axios';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import {
  type CircleOfTrustSkeleton,
  createCircleOfTrust,
  updateCircleOfTrust,
} from '../api/CirclesOfTrustApi';
import {
  deleteNode,
  getNode,
  type InnerNodeRefSkeletonInterface,
  type NodeRefSkeletonInterface,
  type NodeSkeleton,
  putNode,
  type StaticNodeRefSkeletonInterface,
} from '../api/NodeApi';
import {
  createProvider,
  getProvider,
  getProviderMetadata,
  queryProviderStubs,
  type Saml2ProviderSkeleton,
  updateProvider,
} from '../api/Saml2Api';
import { type ScriptSkeleton } from '../api/ScriptApi';
import {
  getSocialIdentityProviders,
  putProviderByTypeAndId,
  type SocialIdpSkeleton,
} from '../api/SocialIdentityProvidersApi';
import {
  deleteTree,
  getTree,
  getTrees,
  putTree,
  type TreeSkeleton,
} from '../api/TreeApi';
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  decode,
  encode,
  encodeBase64Url,
  isBase64Encoded,
} from '../utils/Base64Utils';
import {
  createProgressIndicator,
  debugMessage,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import {
  convertBase64TextToArray,
  convertTextArrayToBase64,
  convertTextArrayToBase64Url,
  findFilesByName,
  getMetadata,
  getTypedFilename,
} from '../utils/ExportImportUtils';
import {
  getCurrentRealmManagedUser,
  getCurrentRealmName,
} from '../utils/ForgeRockUtils';
import { findInArray } from '../utils/JsonUtils';
import { readCirclesOfTrust } from './CirclesOfTrustOps';
import {
  type EmailTemplateSkeleton,
  readEmailTemplate,
  updateEmailTemplate,
} from './EmailTemplateOps';
import { FrodoError } from './FrodoError';
import {
  findOrphanedNodes as _findOrphanedNodes,
  isCloudOnlyNode,
  isCustomNode,
  isPremiumNode,
  removeOrphanedNodes as _removeOrphanedNodes,
} from './NodeOps';
import { type ExportMetaData } from './OpsTypes';
import { readSaml2ProviderStubs } from './Saml2Ops';
import {
  getLibraryScriptNames,
  readScript,
  readScriptByName,
  updateScript,
} from './ScriptOps';
import { readThemes, type ThemeSkeleton, updateThemes } from './ThemeOps';

export type Journey = {
  /**
   * Create an empty single tree export template
   * @returns {SingleTreeExportInterface} an empty single tree export template
   */
  createSingleTreeExportTemplate(): SingleTreeExportInterface;
  /**
   * Create an empty multi tree export template
   * @returns {MultiTreeExportInterface} an empty multi tree export template
   */
  createMultiTreeExportTemplate(): MultiTreeExportInterface;
  /**
   * Create export data for a tree/journey with all its nodes and dependencies. The export data can be written to a file as is.
   * @param {string} treeId tree id/name
   * @param {TreeExportOptions} options export options
   * @returns {Promise<SingleTreeExportInterface>} a promise that resolves to an object containing the tree and all its nodes and dependencies
   */
  exportJourney(
    treeId: string,
    options?: TreeExportOptions
  ): Promise<SingleTreeExportInterface>;
  /**
   * Create export data for all trees/journeys with all their nodes and dependencies. The export data can be written to a file as is.
   * @param {TreeExportOptions} options export options
   * @returns {Promise<MultiTreeExportInterface>} a promise that resolves to an object containing the trees and all their nodes and dependencies
   */
  exportJourneys(
    options?: TreeExportOptions
  ): Promise<MultiTreeExportInterface>;
  /**
   * Read all journeys without dependencies.
   * @returns {Promise<TreeSkeleton[]>} a promise that resolves to an array of journey objects
   */
  readJourneys(): Promise<TreeSkeleton[]>;
  /**
   * Read journey without dependencies.
   * @param {string} journeyId journey id/name
   * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
   */
  readJourney(journeyId: string): Promise<TreeSkeleton>;
  /**
   * Create journey without dependencies.
   * @param {string} journeyId journey id/name
   * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
   */
  createJourney(
    journeyId: string,
    journeyData: TreeSkeleton
  ): Promise<TreeSkeleton>;
  /**
   * Update journey without dependencies.
   * @param {string} journeyId journey id/name
   * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
   */
  updateJourney(
    journeyId: string,
    journeyData: TreeSkeleton
  ): Promise<TreeSkeleton>;
  /**
   * Import journey
   * @param {SingleTreeExportInterface} treeObject tree object containing tree and all its dependencies
   * @param {TreeImportOptions} options import options
   * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
   */
  importJourney(
    treeObject: SingleTreeExportInterface,
    options: TreeImportOptions
  ): Promise<TreeSkeleton>;
  /**
   * Resolve journey dependencies
   * @param {string[]} installedJorneys Map of installed journeys
   * @param {Record<string, SingleTreeExportInterface>} journeyMap Map of journeys to resolve dependencies for
   * @param {string[]} unresolvedJourneys Map to hold the names of unresolved journeys and their dependencies
   * @param {string[]} resolvedJourneys Array to hold the names of resolved journeys
   * @param {int} index Depth of recursion
   */
  resolveDependencies(
    installedJorneys: any,
    journeyMap: any,
    unresolvedJourneys: any,
    resolvedJourneys: any,
    index?: number
  ): Promise<void>;
  /**
   * Import journeys
   * @param {MultiTreeExportInterface} importData map of trees object
   * @param {TreeImportOptions} options import options
   */
  importJourneys(
    importData: MultiTreeExportInterface,
    options: TreeImportOptions
  ): Promise<TreeSkeleton[]>;
  /**
   * Get the node reference obbject for a node object. Node reference objects
   * are used in a tree flow definition and within page nodes to reference
   * nodes. Among other things, node references contain all the non-configuration
   * meta data that exists for readaility, like the x/y coordinates of the node
   * and the display name chosen by the tree designer. The dislay name is the
   * only intuitive link between the graphical representation of the tree and
   * the node configurations that make up the tree.
   * @param nodeObj node object to retrieve the node reference object for
   * @param singleTreeExport tree export with or without dependencies
   * @returns {NodeRefSkeletonInterface | InnerNodeRefSkeletonInterface} node reference object
   */
  getNodeRef(
    nodeObj: NodeSkeleton,
    singleTreeExport: SingleTreeExportInterface
  ): NodeRefSkeletonInterface | InnerNodeRefSkeletonInterface;
  /**
   * Default tree export resolver used to resolve a tree id/name to a full export
   * w/o dependencies of that tree from a platform instance.
   * @param {string} treeId id/name of the tree to resolve
   * @returns {TreeExportResolverInterface} tree export
   */
  onlineTreeExportResolver: TreeExportResolverInterface;
  /**
   * Tree export resolver used to resolve a tree id/name to a full export
   * of that tree from individual `treename.journey.json` export files.
   * @param {string} treeId id/name of the tree to resolve
   * @returns {TreeExportResolverInterface} tree export
   */
  fileByIdTreeExportResolver: TreeExportResolverInterface;
  /**
   * Factory that creates a tree export resolver used to resolve a tree id
   * to a full export of that tree from a multi-tree export file.
   * @param {string} file multi-tree export file
   * @returns {TreeExportResolverInterface} tree export resolver
   */
  createFileParamTreeExportResolver(file: string): TreeExportResolverInterface;
  /**
   * Get tree dependencies (all descendent inner trees)
   * @param {SingleTreeExportInterface} treeExport single tree export
   * @param {string[]} resolvedTreeIds list of tree ids wich have already been resolved
   * @param {TreeExportResolverInterface} resolveTreeExport tree export resolver callback function
   * @returns {Promise<TreeDependencyMapInterface>} a promise that resolves to a tree dependency map
   */
  getTreeDescendents(
    treeExport: SingleTreeExportInterface,
    resolveTreeExport: TreeExportResolverInterface,
    resolvedTreeIds?: string[]
  ): Promise<TreeDependencyMapInterface>;
  /**
   * Analyze if a journey contains any custom nodes considering the detected or the overridden version.
   * @param {SingleTreeExportInterface} journey Journey/tree configuration object
   * @returns {boolean} True if the journey/tree contains any custom nodes, false otherwise.
   */
  isCustomJourney(journey: SingleTreeExportInterface): boolean;
  /**
   * Analyze if a journey contains any premium nodes considering the detected or the overridden version.
   * @param {SingleTreeExportInterface} journey Journey/tree configuration object
   * @returns {boolean} True if the journey/tree contains any custom nodes, false otherwise.
   */
  isPremiumJourney(journey: SingleTreeExportInterface): boolean;
  /**
   * Analyze if a journey contains any cloud-only nodes considering the detected or the overridden version.
   * @param {SingleTreeExportInterface} journey Journey/tree configuration object
   * @returns {boolean} True if the journey/tree contains any cloud-only nodes, false otherwise.
   */
  isCloudOnlyJourney(journey: SingleTreeExportInterface): boolean;
  /**
   * Get a journey's classifications, which can be one or multiple of:
   * - standard: can run on any instance of a ForgeRock platform
   * - cloud: utilize nodes, which are exclusively available in the ForgeRock Identity Cloud
   * - premium: utilizes nodes, which come at a premium
   * - custom: utilizes nodes not included in the ForgeRock platform release
   * @param {SingleTreeExportInterface} journey journey export data
   * @returns {JourneyClassificationType[]} an array of one or multiple classifications
   */
  getJourneyClassification(
    journey: SingleTreeExportInterface
  ): JourneyClassificationType[];
  /**
   * Delete a journey
   * @param {string} journeyId journey id/name
   * @param {Object} options deep=true also delete all the nodes and inner nodes, verbose=true print verbose info
   */
  deleteJourney(
    journeyId: string,
    options: {
      deep: boolean;
      verbose: boolean;
      progress?: boolean;
    }
  ): Promise<DeleteJourneyStatus>;
  /**
   * Delete all journeys
   * @param {Object} options deep=true also delete all the nodes and inner nodes, verbose=true print verbose info
   */
  deleteJourneys(options: {
    deep: boolean;
    verbose: boolean;
  }): Promise<DeleteJourneysStatus>;
  /**
   * Enable a journey
   * @param journeyId journey id/name
   * @returns {Promise<TreeSkeleton>} the updated tree/journey object
   */
  enableJourney(journeyId: string): Promise<TreeSkeleton>;
  /**
   * Disable a journey
   * @param journeyId journey id/name
   * @returns {Promise<TreeSkeleton>} the updated tree/journey object
   */
  disableJourney(journeyId: string): Promise<TreeSkeleton>;

  // Deprecated

  /**
   * Get all the journeys/trees without all their nodes and dependencies.
   * @returns {Promise<TreeSkeleton[]>} a promise that resolves to an array of journey objects
   * @deprecated since v2.0.0 use {@link Journey.readJourneys | readJourneys} instead
   * ```javascript
   * readJourneys(): Promise<TreeSkeleton[]>
   * ```
   * @group Deprecated
   */
  getJourneys(): Promise<TreeSkeleton[]>;
  /**
   * Get a journey/tree without all its nodes and dependencies.
   * @param {string} journeyId journey id/name
   * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
   * @deprecated since v2.0.0 use {@link Journey.readJourney | readJourney} instead
   * ```javascript
   * readJourney(journeyId: string): Promise<TreeSkeleton>
   * ```
   * @group Deprecated
   */
  getJourney(journeyId: string): Promise<TreeSkeleton>;
  /**
   * Import journeys
   * @param {MultiTreeExportInterface} importData map of trees object
   * @param {TreeImportOptions} options import options
   * @deprecated since v2.0.0 use {@link Journey.importJourneys | importJourneys} instead
   * ```javascript
   * importJourneys(importData: MultiTreeExportInterface, options: TreeImportOptions): Promise<TreeSkeleton[]>
   * ```
   * @group Deprecated
   */
  importAllJourneys(
    importData: MultiTreeExportInterface,
    options: TreeImportOptions
  ): Promise<TreeSkeleton[]>;
  /**
   * Find all node configuration objects that are no longer referenced by any tree
   * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an array of orphaned nodes
   * @deprecated since v2.0.0 use {@link Node.findOrphanedNodes | findOrphanedNodes} in the {@link Node} module instead
   * @group Deprecated
   */
  findOrphanedNodes(): Promise<NodeSkeleton[]>;
  /**
   * Remove orphaned nodes
   * @param {NodeSkeleton[]} orphanedNodes Pass in an array of orphaned node configuration objects to remove
   * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an array nodes that encountered errors deleting
   * @deprecated since v2.0.0 use {@link Node.removeOrphanedNodes | removeOrphanedNodes} in the {@link Node} module instead
   * @group Deprecated
   */
  removeOrphanedNodes(orphanedNodes: NodeSkeleton[]): Promise<NodeSkeleton[]>;
};

export default (state: State): Journey => {
  return {
    createSingleTreeExportTemplate(): SingleTreeExportInterface {
      return createSingleTreeExportTemplate({ state });
    },
    createMultiTreeExportTemplate(): MultiTreeExportInterface {
      return createMultiTreeExportTemplate({ state });
    },
    async exportJourney(
      treeId: string,
      options: TreeExportOptions = {
        useStringArrays: true,
        deps: true,
        coords: true,
      }
    ): Promise<SingleTreeExportInterface> {
      return exportJourney({ journeyId: treeId, options, state });
    },
    async exportJourneys(
      options: TreeExportOptions = {
        useStringArrays: true,
        deps: true,
        coords: true,
      }
    ): Promise<MultiTreeExportInterface> {
      return exportJourneys({ options, state });
    },
    async readJourneys(): Promise<TreeSkeleton[]> {
      return readJourneys({ state });
    },
    async readJourney(journeyId: string): Promise<TreeSkeleton> {
      return readJourney({ journeyId, state });
    },
    async createJourney(
      journeyId: string,
      journeyData: TreeSkeleton
    ): Promise<TreeSkeleton> {
      return createJourney({ journeyId, journeyData, state });
    },
    async updateJourney(
      journeyId: string,
      journeyData: TreeSkeleton
    ): Promise<TreeSkeleton> {
      return updateJourney({ journeyId, journeyData, state });
    },
    async importJourney(
      treeObject: SingleTreeExportInterface,
      options: TreeImportOptions
    ): Promise<TreeSkeleton> {
      return importJourney({ importData: treeObject, options, state });
    },
    async resolveDependencies(
      installedJorneys,
      journeyMap,
      unresolvedJourneys,
      resolvedJourneys,
      index = -1
    ) {
      return resolveDependencies(
        installedJorneys,
        journeyMap,
        unresolvedJourneys,
        resolvedJourneys,
        index
      );
    },
    async importJourneys(
      treesMap: MultiTreeExportInterface,
      options: TreeImportOptions
    ): Promise<TreeSkeleton[]> {
      return importJourneys({ importData: treesMap, options, state });
    },
    getNodeRef(
      nodeObj: NodeSkeleton,
      singleTreeExport: SingleTreeExportInterface
    ): NodeRefSkeletonInterface | InnerNodeRefSkeletonInterface {
      return getNodeRef(nodeObj, singleTreeExport);
    },
    onlineTreeExportResolver,
    fileByIdTreeExportResolver,
    createFileParamTreeExportResolver(
      file: string
    ): TreeExportResolverInterface {
      return createFileParamTreeExportResolver(file, state);
    },
    async getTreeDescendents(
      treeExport: SingleTreeExportInterface,
      resolveTreeExport: TreeExportResolverInterface,
      resolvedTreeIds: string[] = []
    ): Promise<TreeDependencyMapInterface> {
      return getTreeDescendents({
        treeExport,
        resolveTreeExport,
        resolvedTreeIds,
        state,
      });
    },
    isCustomJourney(journey: SingleTreeExportInterface) {
      return isCustomJourney({ journey, state });
    },
    isPremiumJourney(journey: SingleTreeExportInterface) {
      return isPremiumJourney(journey);
    },
    isCloudOnlyJourney(journey: SingleTreeExportInterface) {
      return isCloudOnlyJourney(journey);
    },
    getJourneyClassification(
      journey: SingleTreeExportInterface
    ): JourneyClassificationType[] {
      return getJourneyClassification({ journey, state });
    },
    async deleteJourney(
      journeyId: string,
      options: { deep: boolean; verbose: boolean; progress?: boolean }
    ) {
      return deleteJourney({ journeyId, options, state });
    },
    async deleteJourneys(options: { deep: boolean; verbose: boolean }) {
      return deleteJourneys({ options, state });
    },
    async enableJourney(journeyId: string): Promise<TreeSkeleton> {
      return enableJourney({ journeyId, state });
    },
    async disableJourney(journeyId: string): Promise<TreeSkeleton> {
      return disableJourney({ journeyId, state });
    },

    // Deprecated

    async getJourneys(): Promise<TreeSkeleton[]> {
      return readJourneys({ state });
    },
    async getJourney(journeyId: string): Promise<TreeSkeleton> {
      return readJourney({ journeyId, state });
    },
    async importAllJourneys(
      treesMap: MultiTreeExportInterface,
      options: TreeImportOptions
    ): Promise<TreeSkeleton[]> {
      return importJourneys({ importData: treesMap, options, state });
    },
    async findOrphanedNodes(): Promise<NodeSkeleton[]> {
      return _findOrphanedNodes({ state });
    },
    async removeOrphanedNodes(
      orphanedNodes: NodeSkeleton[]
    ): Promise<NodeSkeleton[]> {
      return _removeOrphanedNodes({ orphanedNodes, state });
    },
  };
};

/**
 * Tree export options
 */
export interface TreeExportOptions {
  /**
   * Where applicable, use string arrays to store multi-line text (e.g. scripts).
   */
  useStringArrays: boolean;
  /**
   * Include any dependencies (scripts, email templates, SAML entity providers and circles of trust, social identity providers, themes).
   */
  deps: boolean;
  /**
   * Include x and y coordinate positions of the journey/tree nodes.
   */
  coords: boolean;
}

/**
 * Tree import options
 */
export interface TreeImportOptions {
  /**
   * Generate new UUIDs for all nodes during import.
   */
  reUuid: boolean;
  /**
   * Include any dependencies (scripts, email templates, SAML entity providers and circles of trust, social identity providers, themes).
   */
  deps: boolean;
}

export interface SingleTreeExportInterface {
  meta?: ExportMetaData;
  innerNodes?: Record<string, NodeSkeleton>;
  innernodes?: Record<string, NodeSkeleton>;
  nodes: Record<string, NodeSkeleton>;
  scripts: Record<string, ScriptSkeleton>;
  emailTemplates: Record<string, EmailTemplateSkeleton>;
  socialIdentityProviders: Record<string, SocialIdpSkeleton>;
  themes: ThemeSkeleton[];
  saml2Entities: Record<string, Saml2ProviderSkeleton>;
  circlesOfTrust: Record<string, CircleOfTrustSkeleton>;
  tree: TreeSkeleton;
}

export interface MultiTreeExportInterface {
  meta?: ExportMetaData;
  trees: Record<string, SingleTreeExportInterface>;
}

export type JourneyClassificationType =
  | 'standard'
  | 'custom'
  | 'cloud'
  | 'premium';

export enum JourneyClassification {
  STANDARD = 'standard',
  CUSTOM = 'custom',
  CLOUD = 'cloud',
  PREMIUM = 'premium',
}

export interface TreeDependencyMapInterface {
  [k: string]: TreeDependencyMapInterface[];
}

export interface TreeExportResolverInterface {
  (treeId: string, state: State): Promise<SingleTreeExportInterface>;
}

const containerNodes = ['PageNode', 'CustomPageNode'];

const scriptedNodesConditions = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ClientScriptNode: (_nodeConfig: NodeSkeleton): boolean => {
    return true;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ConfigProviderNode: (_nodeConfig: NodeSkeleton): boolean => {
    return true;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  DeviceMatchNode: (nodeConfig: NodeSkeleton): boolean => {
    return nodeConfig.useScript;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  PingOneVerifyCompletionDecisionNode: (nodeConfig: NodeSkeleton): boolean => {
    return nodeConfig.useFilterScript;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ScriptedDecisionNode: (_nodeConfig: NodeSkeleton): boolean => {
    return true;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SocialProviderHandlerNode: (_nodeConfig: NodeSkeleton): boolean => {
    return true;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SocialProviderHandlerNodeV2: (_nodeConfig: NodeSkeleton): boolean => {
    return true;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CustomScriptNode: (_nodeConfig: NodeSkeleton): boolean => {
    return true;
  },
};

export function hasScriptDependency(nodeConfig: NodeSkeleton): boolean {
  if (Object.keys(scriptedNodesConditions).includes(nodeConfig._type._id)) {
    const handler: any = scriptedNodesConditions[nodeConfig._type._id];
    return handler(nodeConfig);
  }
  return false;
}

const emailTemplateNodes = ['EmailSuspendNode', 'EmailTemplateNode'];

const emptyScriptPlaceholder = '[Empty]';

/**
 * Create an empty single tree export template
 * @returns {SingleTreeExportInterface} an empty single tree export template
 */
function createSingleTreeExportTemplate({
  state,
}: {
  state: State;
}): SingleTreeExportInterface {
  return {
    meta: getMetadata({ state }),
    innerNodes: {},
    nodes: {},
    scripts: {},
    emailTemplates: {},
    socialIdentityProviders: {},
    themes: [],
    saml2Entities: {},
    circlesOfTrust: {},
    tree: {},
  } as SingleTreeExportInterface;
}

/**
 * Create an empty multi tree export template
 * @returns {MultiTreeExportInterface} an empty multi tree export template
 */
function createMultiTreeExportTemplate({
  state,
}: {
  state: State;
}): MultiTreeExportInterface {
  return {
    meta: getMetadata({ state }),
    trees: {},
  } as MultiTreeExportInterface;
}

/**
 * Updates coordinates of the nodes in a tree to the same as the nodes on the server if the nodes on the tree do not exist.
 * @param {TreeSkeleton} tree The tree being imported
 * @param {string} nodesAttributeName The name (key) of the attribute on the tree that has nodes
 * @param {TreeSkeleton} serverTree The current tree on the server
 * @returns {TreeSkeleton} The current tree on the server
 */
export async function updateCoordinates({
  tree,
  nodesAttributeName,
  serverTree,
  state,
}: {
  tree: TreeSkeleton;
  nodesAttributeName: string;
  serverTree: TreeSkeleton | null;
  state: State;
}): Promise<TreeSkeleton | null> {
  if (!tree[nodesAttributeName]) {
    return serverTree;
  }
  const nodeEntries = Object.entries(
    tree[nodesAttributeName] as
      | NodeRefSkeletonInterface
      | StaticNodeRefSkeletonInterface
  ).filter(
    ([, nodeInfo]) => nodeInfo.x === undefined || nodeInfo.y === undefined
  );
  if (nodeEntries.length === 0) {
    return serverTree;
  }
  if (serverTree === null) {
    try {
      serverTree = await getTree({ id: tree._id, state: state });
    } catch (e) {
      if (!axios.isAxiosError(e) || (e as AxiosError).response.status !== 404) {
        throw e;
      }
    }
  }
  nodeEntries.forEach(([nodeId, nodeInfo]) => {
    const coords =
      serverTree == undefined ||
      serverTree[nodesAttributeName] == undefined ||
      serverTree[nodesAttributeName][nodeId] == undefined
        ? {
            x: 0,
            y: 0,
          }
        : serverTree[nodesAttributeName][nodeId];
    nodeInfo.x =
      nodeInfo.x === undefined
        ? coords.x == undefined
          ? 0
          : coords.x
        : nodeInfo.x;
    nodeInfo.y =
      nodeInfo.y === undefined
        ? coords.y == undefined
          ? 0
          : coords.y
        : nodeInfo.y;
  });
  return serverTree;
}

/**
 * Helper to get all SAML2 dependencies for a given node object
 * @param {Object} nodeObject node object
 * @param {[Object]} allProviders array of all saml2 providers objects
 * @param {[Object]} allCirclesOfTrust array of all circle of trust objects
 * @returns {Promise} a promise that resolves to an object containing a saml2 dependencies
 */
async function getSaml2NodeDependencies(
  nodeObject: any,
  allProviders: any[],
  allCirclesOfTrust: any[],
  state: State
) {
  const samlProperties = ['metaAlias', 'idpEntityId'];
  const saml2EntityPromises = [];
  const saml2Entities = [];
  let circlesOfTrust = [];
  let saml2NodeDependencies = {
    saml2Entities,
    circlesOfTrust,
  };
  const errors = [];
  for (const samlProperty of samlProperties) {
    // In the following line nodeObject[samlProperty] will look like '/alpha/iSPAzure'.
    const entityId =
      samlProperty === 'metaAlias'
        ? nodeObject[samlProperty].split('/').pop()
        : nodeObject[samlProperty];
    const entity = findInArray(allProviders, { entityId });
    if (entity) {
      try {
        const providerResponse = await getProvider({
          location: entity.location,
          entityId64: entity._id,
          state,
        });
        /**
         * Adding entityLocation here to the entityResponse because the import tool
         * needs to know whether the saml2 entity is remote or not (this will be removed
         * from the config before importing see updateSaml2Entity and createSaml2Entity functions).
         * Importing a remote saml2 entity is a slightly different request (see createSaml2Entity).
         */
        providerResponse.entityLocation = entity.location;

        if (entity.location === 'remote') {
          // get the xml representation of this entity and add it to the entityResponse;
          const metaDataResponse = await getProviderMetadata({
            entityId: providerResponse.entityId,
            state,
          });
          providerResponse.base64EntityXML = encodeBase64Url(metaDataResponse);
        }
        saml2EntityPromises.push(providerResponse);
      } catch (error) {
        error.message = `Error reading saml2 dependencies: ${
          error.response?.data?.message || error.message
        }`;
        errors.push(error);
      }
    }
  }
  try {
    const saml2EntitiesPromisesResults = await Promise.all(saml2EntityPromises);
    for (const saml2Entity of saml2EntitiesPromisesResults) {
      if (saml2Entity) {
        saml2Entities.push(saml2Entity);
      }
    }
    const samlEntityIds = saml2Entities.map(
      (saml2EntityConfig) => `${saml2EntityConfig.entityId}|saml2`
    );
    circlesOfTrust = allCirclesOfTrust.filter((circleOfTrust) => {
      let hasEntityId = false;
      for (const trustedProvider of circleOfTrust.trustedProviders) {
        if (!hasEntityId && samlEntityIds.includes(trustedProvider)) {
          hasEntityId = true;
        }
      }
      return hasEntityId;
    });
    saml2NodeDependencies = {
      saml2Entities,
      circlesOfTrust,
    };
  } catch (error) {
    error.message = `Error reading saml2 dependencies: ${
      error.response?.data?.message || error.message
    }`;
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Saml2 dependencies error:\n${errorMessages}`);
  }
  return saml2NodeDependencies;
}

/**
 * Create export data for a tree/journey with all its nodes and dependencies. The export data can be written to a file as is.
 * @param {string} journeyId journey id/name
 * @param {TreeExportOptions} options export options
 * @returns {Promise<SingleTreeExportInterface>} a promise that resolves to an object containing the tree and all its nodes and dependencies
 */
export async function exportJourney({
  journeyId,
  options = {
    useStringArrays: true,
    deps: true,
    coords: true,
  },
  state,
}: {
  journeyId: string;
  options?: TreeExportOptions;
  state: State;
}): Promise<SingleTreeExportInterface> {
  debugMessage({
    message: `JourneyOps.exportJourney: start [journey=${journeyId}]`,
    state,
  });
  const exportData = createSingleTreeExportTemplate({ state });
  const errors = [];
  try {
    const treeObject = await getTree({ id: journeyId, state });
    const { useStringArrays, deps, coords } = options;
    const verbose = state.getVerbose();

    if (verbose)
      printMessage({
        message: `- ${treeObject._id}`,
        type: 'info',
        newline: false,
        state,
      });

    // Process tree
    if (verbose) printMessage({ message: '\n  - Flow', newline: false, state });
    exportData.tree = treeObject;
    if (verbose && treeObject.identityResource)
      printMessage({
        message: `\n    - identityResource: ${treeObject.identityResource}`,
        type: 'info',
        newline: false,
        state,
      });
    if (verbose)
      printMessage({
        message: `\n    - Done`,
        newline: false,
        type: 'info',
        state,
      });

    const nodePromises = [];
    const scriptPromises = [];
    const emailTemplatePromises = [];
    const innerNodePromises = [];
    const saml2ConfigPromises = [];
    let socialProviderPromise = null;
    let themePromise = null;
    const isPlatformDeployment =
      state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY ||
      state.getDeploymentType() === Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;
    if (deps && isPlatformDeployment) {
      themePromise = readThemes({ state });
    }

    let allSaml2Providers = null;
    let allCirclesOfTrust = null;
    let filteredSocialProviders = null;
    const themes = [];

    // get all the nodes
    for (const [nodeId, nodeInfo] of Object.entries(treeObject.nodes)) {
      nodePromises.push(
        getNode({ nodeId, nodeType: nodeInfo['nodeType'], state })
      );
      if (!coords) {
        delete nodeInfo['x'];
        delete nodeInfo['y'];
      }
    }
    if (!coords && treeObject.staticNodes) {
      for (const [, nodeInfo] of Object.entries(treeObject.staticNodes)) {
        delete nodeInfo['x'];
        delete nodeInfo['y'];
      }
    }
    if (verbose && nodePromises.length > 0)
      printMessage({ message: '\n  - Nodes:', newline: false, state });
    const nodeObjects = await Promise.all(nodePromises);

    // iterate over every node in tree
    for (const nodeObject of nodeObjects) {
      const nodeId = nodeObject._id;
      const nodeType = nodeObject._type._id;
      if (verbose)
        printMessage({
          message: `\n    - ${nodeId} (${nodeType})`,
          type: 'info',
          newline: false,
          state,
        });
      exportData.nodes[nodeObject._id] = nodeObject;

      // handle script node types
      if (
        deps &&
        hasScriptDependency(nodeObject) &&
        nodeObject.script !== emptyScriptPlaceholder
      ) {
        scriptPromises.push(readScript({ scriptId: nodeObject.script, state }));
      }

      // frodo supports email templates in platform deployments
      if (deps && isPlatformDeployment) {
        if (emailTemplateNodes.includes(nodeType)) {
          try {
            const emailTemplate = await readEmailTemplate({
              templateId: nodeObject.emailTemplateName,
              state,
            });
            emailTemplatePromises.push(emailTemplate);
          } catch (error) {
            error.message = `Error reading email template ${
              nodeObject.emailTemplateName
            }: ${error.response?.data?.message || error.message}`;
            errors.push(error);
          }
        }
      }

      // handle SAML2 node dependencies
      if (deps && nodeType === 'product-Saml2Node') {
        if (!allSaml2Providers) {
          try {
            allSaml2Providers = await readSaml2ProviderStubs({ state });
          } catch (error) {
            errors.push(new FrodoError(`Error reading saml2 providers`, error));
          }
        }
        if (!allCirclesOfTrust) {
          try {
            allCirclesOfTrust = await readCirclesOfTrust({ state });
          } catch (error) {
            errors.push(
              new FrodoError(`Error reading circles of trust`, error)
            );
          }
        }
        saml2ConfigPromises.push(
          getSaml2NodeDependencies(
            nodeObject,
            allSaml2Providers,
            allCirclesOfTrust,
            state
          )
        );
      }

      // If this is a SocialProviderHandlerNode get each enabled social identity provider.
      if (
        deps &&
        !socialProviderPromise &&
        nodeType === 'SocialProviderHandlerNode'
      ) {
        socialProviderPromise = getSocialIdentityProviders({ state });
      }

      // If this is a SelectIdPNode and filteredProviters is not already set to empty array set filteredSocialProviers.
      if (deps && !filteredSocialProviders && nodeType === 'SelectIdPNode') {
        filteredSocialProviders = filteredSocialProviders || [];
        for (const filteredProvider of nodeObject.filteredProviders) {
          if (!filteredSocialProviders.includes(filteredProvider)) {
            filteredSocialProviders.push(filteredProvider);
          }
        }
      }

      // get inner nodes (nodes inside container nodes)
      if (containerNodes.includes(nodeType)) {
        for (const innerNode of nodeObject.nodes) {
          innerNodePromises.push(
            getNode({
              nodeId: innerNode._id,
              nodeType: innerNode.nodeType,
              state,
            })
          );
        }
        // frodo supports themes in platform deployments
        if (deps && isPlatformDeployment) {
          let themeId = false;

          if (nodeObject.stage) {
            // see if themeId is part of the stage object
            try {
              themeId = JSON.parse(nodeObject.stage).themeId;
            } catch (e) {
              themeId = false;
            }
            // if the page node's themeId is set the "old way" set themeId accordingly
            if (!themeId && nodeObject.stage.indexOf('themeId=') === 0) {
              // eslint-disable-next-line prefer-destructuring
              themeId = nodeObject.stage.split('=')[1];
            }
          }

          if (themeId) {
            if (!themes.includes(themeId)) themes.push(themeId);
          }
        }
      }
    }

    // Process inner nodes
    if (verbose && innerNodePromises.length > 0)
      printMessage({ message: '\n  - Inner nodes:', newline: false, state });
    try {
      const settledPromises = await Promise.allSettled(innerNodePromises);
      for (const settledPromise of settledPromises) {
        if (settledPromise.status === 'fulfilled' && settledPromise.value) {
          const innerNodeObject = settledPromise.value as NodeSkeleton;
          const innerNodeId = innerNodeObject._id;
          const innerNodeType = innerNodeObject._type._id;
          if (verbose)
            printMessage({
              message: `\n    - ${innerNodeId} (${innerNodeType})`,
              type: 'info',
              newline: false,
              state,
            });
          exportData.innerNodes[innerNodeId] = innerNodeObject;

          // handle script node types
          if (deps && hasScriptDependency(innerNodeObject)) {
            scriptPromises.push(
              readScript({ scriptId: innerNodeObject.script, state })
            );
          }

          // frodo supports email templates in platform deployments
          if (deps && isPlatformDeployment) {
            if (emailTemplateNodes.includes(innerNodeType)) {
              try {
                const emailTemplate = await readEmailTemplate({
                  templateId: innerNodeObject.emailTemplateName,
                  state,
                });
                emailTemplatePromises.push(emailTemplate);
              } catch (error) {
                errors.push(
                  new FrodoError(`Error reading email template`, error)
                );
              }
            }
          }

          // handle SAML2 node dependencies
          if (deps && innerNodeType === 'product-Saml2Node') {
            if (!allSaml2Providers) {
              try {
                allSaml2Providers = await readSaml2ProviderStubs({ state });
              } catch (error) {
                errors.push(
                  new FrodoError(`Error reading saml2 providers`, error)
                );
              }
            }
            if (!allCirclesOfTrust) {
              try {
                allCirclesOfTrust = await readCirclesOfTrust({ state });
              } catch (error) {
                errors.push(
                  new FrodoError(`Error reading circles of trust`, error)
                );
              }
            }
            saml2ConfigPromises.push(
              getSaml2NodeDependencies(
                innerNodeObject,
                allSaml2Providers,
                allCirclesOfTrust,
                state
              )
            );
          }

          // If this is a SocialProviderHandlerNode get each enabled social identity provider.
          if (
            deps &&
            !socialProviderPromise &&
            innerNodeType === 'SocialProviderHandlerNode'
          ) {
            socialProviderPromise = getSocialIdentityProviders({ state });
          }

          // If this is a SelectIdPNode and filteredProviters is not already set to empty array set filteredSocialProviers.
          if (
            deps &&
            !filteredSocialProviders &&
            innerNodeType === 'SelectIdPNode' &&
            innerNodeObject.filteredProviders
          ) {
            filteredSocialProviders = filteredSocialProviders || [];
            for (const filteredProvider of innerNodeObject.filteredProviders) {
              if (!filteredSocialProviders.includes(filteredProvider)) {
                filteredSocialProviders.push(filteredProvider);
              }
            }
          }
        } else if (settledPromise.status === 'rejected') {
          errors.push(new FrodoError(settledPromise.reason));
        }
      }
    } catch (error) {
      errors.push(new FrodoError(`Error reading inner nodes`, error));
    }

    // Process email templates
    if (verbose && emailTemplatePromises.length > 0)
      printMessage({
        message: '\n  - Email templates:',
        newline: false,
        state,
      });
    try {
      const settledEmailTemplatePromises = await Promise.allSettled(
        emailTemplatePromises
      );
      for (const settledPromise of settledEmailTemplatePromises) {
        if (settledPromise.status === 'fulfilled' && settledPromise.value) {
          if (verbose)
            printMessage({
              message: `\n    - ${settledPromise.value._id.split('/')[1]}${
                settledPromise.value.displayName
                  ? ` (${settledPromise.value.displayName})`
                  : ''
              }`,
              type: 'info',
              newline: false,
              state,
            });
          exportData.emailTemplates[settledPromise.value._id.split('/')[1]] =
            settledPromise.value;
        }
      }
    } catch (error) {
      errors.push(new FrodoError(`Error reading email templates`, error));
    }

    // Process SAML2 providers and circles of trust
    try {
      const saml2NodeDependencies = await Promise.all(saml2ConfigPromises);
      for (const saml2NodeDependency of saml2NodeDependencies) {
        if (saml2NodeDependency) {
          if (verbose)
            printMessage({
              message: '\n  - SAML2 entity providers:',
              newline: false,
              state,
            });
          for (const saml2Entity of saml2NodeDependency.saml2Entities) {
            if (verbose)
              printMessage({
                message: `\n    - ${saml2Entity.entityLocation} ${saml2Entity.entityId}`,
                type: 'info',
                newline: false,
                state,
              });
            exportData.saml2Entities[saml2Entity._id] = saml2Entity;
          }
          if (verbose)
            printMessage({
              message: '\n  - SAML2 circles of trust:',
              newline: false,
              state,
            });
          for (const circleOfTrust of saml2NodeDependency.circlesOfTrust) {
            if (verbose)
              printMessage({
                message: `\n    - ${circleOfTrust._id}`,
                type: 'info',
                newline: false,
                state,
              });
            exportData.circlesOfTrust[circleOfTrust._id] = circleOfTrust;
          }
        }
      }
    } catch (error) {
      errors.push(new FrodoError(`Error reading saml2 dependencies`, error));
    }

    // Process socialIdentityProviders
    try {
      const socialProviders = await Promise.resolve(socialProviderPromise);
      if (socialProviders) {
        if (verbose)
          printMessage({
            message: '\n  - OAuth2/OIDC (social) identity providers:',
            newline: false,
            state,
          });
        for (const socialProvider of socialProviders.result) {
          // If the list of socialIdentityProviders needs to be filtered based on the
          // filteredProviders property of a SelectIdPNode do it here.
          if (
            socialProvider &&
            (!filteredSocialProviders ||
              filteredSocialProviders.length === 0 ||
              filteredSocialProviders.includes(socialProvider._id))
          ) {
            if (verbose)
              printMessage({
                message: `\n    - ${socialProvider._id}`,
                type: 'info',
                newline: false,
                state,
              });
            scriptPromises.push(
              readScript({ scriptId: socialProvider.transform, state })
            );
            exportData.socialIdentityProviders[socialProvider._id] =
              socialProvider;
          }
        }
      }
    } catch (error) {
      errors.push(
        new FrodoError(`Error reading social identity providers`, error)
      );
    }

    // Process scripts
    if (verbose && scriptPromises.length > 0)
      printMessage({ message: '\n  - Scripts:', newline: false, state });
    try {
      const scriptObjects = await Promise.all(scriptPromises);
      const name2uuid: { [key: string]: string } = {};
      for (const scriptObject of scriptObjects) {
        if (scriptObject) {
          if (verbose)
            printMessage({
              message: `\n    - ${scriptObject._id} (${scriptObject.name})`,
              type: 'info',
              newline: false,
              state,
            });
          scriptObject.script = useStringArrays
            ? convertBase64TextToArray(scriptObject.script)
            : // Stringify necessary to export journey scripts in the same format as Ping AIC
              JSON.stringify(decode(scriptObject.script));
          exportData.scripts[scriptObject._id] = scriptObject;

          // handle library scripts
          const scriptNames = getLibraryScriptNames(scriptObject);
          for (const scriptName of scriptNames) {
            if (name2uuid[scriptName] === undefined) {
              const libScriptObject = await readScriptByName({
                scriptName,
                state,
              });
              name2uuid[scriptName] = libScriptObject._id;
              libScriptObject.script = useStringArrays
                ? convertBase64TextToArray(libScriptObject.script as string)
                : // Stringify necessary to export journey scripts in the same format as Ping AIC
                  JSON.stringify(decode(scriptObject.script));
              exportData.scripts[libScriptObject._id] = libScriptObject;
            }
          }
        }
      }
    } catch (error) {
      errors.push(new FrodoError(`Error reading scripts`, error));
    }

    // Process themes
    if (themePromise) {
      if (verbose)
        printMessage({ message: '\n  - Themes:', newline: false, state });
      try {
        const themePromiseResults = await Promise.resolve(themePromise);
        for (const themeObject of themePromiseResults) {
          if (
            themeObject &&
            // has the theme been specified by id or name in a page node?
            (themes.includes(themeObject._id) ||
              themes.includes(themeObject.name) ||
              // has this journey been linked to a theme?
              themeObject.linkedTrees?.includes(treeObject._id))
          ) {
            if (verbose)
              printMessage({
                message: `\n    - ${themeObject._id} (${themeObject.name})`,
                type: 'info',
                newline: false,
                state,
              });
            exportData.themes.push(themeObject);
          }
        }
      } catch (error) {
        errors.push(new FrodoError(`Error reading themes`, error));
      }
    }
    if (verbose)
      printMessage({
        message: `\n`,
        type: 'info',
        newline: false,
        state,
      });
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 0) {
    throw new FrodoError(`Error exporting journey ${journeyId}`, errors);
  }
  debugMessage({
    message: `JourneyOps.exportJourney: end [journey=${journeyId}]`,
    state,
  });
  return exportData;
}

/**
 * Create export data for all trees/journeys with all their nodes and dependencies. The export data can be written to a file as is.
 * @param {TreeExportOptions} options export options
 * @returns {Promise<MultiTreeExportInterface>} a promise that resolves to an object containing the trees and all their nodes and dependencies
 */
export async function exportJourneys({
  options = {
    useStringArrays: true,
    deps: true,
    coords: true,
  },
  state,
}: {
  options?: TreeExportOptions;
  state: State;
}): Promise<MultiTreeExportInterface> {
  const errors: Error[] = [];
  let indicatorId: string;
  try {
    const trees = await readJourneys({ state });
    const multiTreeExport = createMultiTreeExportTemplate({ state });
    indicatorId = createProgressIndicator({
      total: trees.length,
      message: 'Exporting journeys...',
      state,
    });
    for (const tree of trees) {
      try {
        updateProgressIndicator({
          id: indicatorId,
          message: `Exporting journey ${tree._id}`,
          state,
        });
        const exportData: SingleTreeExportInterface = await exportJourney({
          journeyId: tree._id,
          options,
          state,
        });
        delete exportData.meta;
        multiTreeExport.trees[tree._id] = exportData;
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error exporting journeys`, errors);
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${trees.length} journeys.`,
      state,
    });
    return multiTreeExport;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting journeys.`,
      status: 'fail',
      state,
    });
    // re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error exporting journeys`, error);
  }
}

/**
 * Get all the journeys/trees without all their nodes and dependencies.
 * @returns {Promise<TreeSkeleton[]>} a promise that resolves to an array of journey objects
 */
export async function readJourneys({
  state,
}: {
  state: State;
}): Promise<TreeSkeleton[]> {
  try {
    const { result } = await getTrees({ state });
    result.sort((a, b) => a._id.localeCompare(b._id));
    return result;
  } catch (error) {
    throw new FrodoError(`Error reading journeys`, error);
  }
}

/**
 * Get a journey/tree without all its nodes and dependencies.
 * @param {string} journeyId journey id/name
 * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
 */
export async function readJourney({
  journeyId,
  state,
}: {
  journeyId: string;
  state: State;
}): Promise<TreeSkeleton> {
  try {
    const response = await getTree({ id: journeyId, state });
    return response;
  } catch (error) {
    throw new FrodoError(`Error reading journey ${journeyId}`, error);
  }
}

/**
 * Create journey without dependencies.
 * @param {string} journeyId journey id/name
 * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
 */
export async function createJourney({
  journeyId,
  journeyData,
  state,
}: {
  journeyId: string;
  journeyData: TreeSkeleton;
  state: State;
}): Promise<TreeSkeleton> {
  debugMessage({ message: `JourneyOps.createJourney: start`, state });
  try {
    await readJourney({ journeyId, state });
  } catch (error) {
    try {
      const result = await putTree({
        treeId: journeyId,
        treeData: journeyData,
        state,
      });
      debugMessage({ message: `JourneyOps.createJourney: end`, state });
      return result;
    } catch (error) {
      throw new FrodoError(`Error creating journey ${journeyId}`, error);
    }
  }
  throw new FrodoError(`Journey ${journeyId} already exists!`);
}

/**
 * Update or create journey without dependencies.
 * @param {string} journeyId journey id/name
 * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
 */
export async function updateJourney({
  journeyId,
  journeyData,
  state,
}: {
  journeyId: string;
  journeyData: TreeSkeleton;
  state: State;
}): Promise<TreeSkeleton> {
  try {
    const response = await putTree({
      treeId: journeyId,
      treeData: journeyData,
      state,
    });
    return response;
  } catch (error) {
    throw new FrodoError(`Error updating journey ${journeyId}`, error);
  }
}

/**
 * Import a tree with all dependencies from a `SingleTreeExportInterface` object (typically read from a file)
 * @param {SingleTreeExportInterface} importData tree object containing tree and all its dependencies
 * @param {TreeImportOptions} options import options
 * @returns {Promise<TreeSkeleton>} a promise that resolves to true if no errors occurred during import
 */
export async function importJourney({
  importData,
  options,
  state,
}: {
  importData: SingleTreeExportInterface;
  options: TreeImportOptions;
  state: State;
}): Promise<TreeSkeleton> {
  let response = null;
  const errors = [];

  try {
    const { reUuid, deps } = options;
    const verbose = state.getVerbose();
    if (verbose)
      printMessage({
        message: `- ${importData.tree._id}\n`,
        type: 'info',
        newline: false,
        state,
      });
    let newUuid = '';
    const uuidMap: { [k: string]: string } = {};
    const treeId = importData.tree._id;

    // Process scripts
    if (
      deps &&
      importData.scripts &&
      Object.entries(importData.scripts).length > 0
    ) {
      if (verbose)
        printMessage({ message: '  - Scripts:', newline: false, state });
      for (const [scriptId, scriptObject] of Object.entries(
        importData.scripts
      )) {
        if (verbose)
          printMessage({
            message: `\n    - ${scriptId} (${scriptObject['name']})`,
            type: 'info',
            newline: false,
            state,
          });
        // is the script stored as an array of strings or just b64 blob?
        if (Array.isArray(scriptObject['script'])) {
          scriptObject['script'] = convertTextArrayToBase64(
            scriptObject['script']
          );
        } else if (!isBase64Encoded(scriptObject['script'])) {
          // JSON.parse is necessary to import scripts, otherwise it imports them as a single string
          scriptObject['script'] = encode(JSON.parse(scriptObject['script']));
        }
        try {
          await updateScript({ scriptId, scriptData: scriptObject, state });
        } catch (error) {
          errors.push(
            new FrodoError(
              `Error importing script ${scriptObject['name']} (${scriptId}) in journey ${treeId}`,
              error
            )
          );
        }
        if (verbose) printMessage({ message: '', state });
      }
    }

    // Process email templates
    if (
      deps &&
      importData.emailTemplates &&
      Object.entries(importData.emailTemplates).length > 0
    ) {
      if (verbose)
        printMessage({
          message: '\n  - Email templates:',
          newline: false,
          state,
        });
      for (const [templateId, templateData] of Object.entries(
        importData.emailTemplates
      )) {
        if (verbose)
          printMessage({
            message: `\n    - ${templateId}`,
            type: 'info',
            newline: false,
            state,
          });
        try {
          await updateEmailTemplate({ templateId, templateData, state });
        } catch (error) {
          errors.push(new FrodoError(`Error importing email templates`, error));
        }
        if (verbose) printMessage({ message: '', state });
      }
    }

    // Process themes
    if (deps && importData.themes && importData.themes.length > 0) {
      if (verbose)
        printMessage({ message: '\n  - Themes:', newline: false, state });
      const themes: Record<string, ThemeSkeleton> = {};
      for (const theme of importData.themes) {
        if (verbose)
          printMessage({
            message: `\n    - ${theme['_id']} (${theme['name']})`,
            type: 'info',
            newline: false,
            state,
          });
        themes[theme['_id']] = theme;
      }
      try {
        await updateThemes({ themeMap: themes, state });
      } catch (error) {
        errors.push(new FrodoError(`Error importing themes`, error));
      }
    }

    // Process social providers
    if (
      deps &&
      importData.socialIdentityProviders &&
      Object.entries(importData.socialIdentityProviders).length > 0
    ) {
      if (verbose)
        printMessage({
          message: '\n  - OAuth2/OIDC (social) identity providers:',
          newline: false,
          state,
        });
      for (const [providerId, providerData] of Object.entries(
        importData.socialIdentityProviders
      )) {
        if (verbose)
          printMessage({
            message: `\n    - ${providerId}`,
            type: 'info',
            newline: false,
            state,
          });
        try {
          await putProviderByTypeAndId({
            type: providerData['_type']['_id'],
            id: providerId,
            providerData,
            state,
          });
        } catch (error) {
          if (
            error.response?.status === 500 &&
            error.response?.data?.message ===
              'Unable to update SMS config: Data validation failed for the attribute, Redirect after form post URL'
          ) {
            providerData['redirectAfterFormPostURI'] = '';
            try {
              await putProviderByTypeAndId({
                type: providerData['_type']['_id'],
                id: providerId,
                providerData,
                state,
              });
            } catch (importError2) {
              throw new FrodoError(
                `Error importing provider ${providerId} in journey ${treeId}`,
                importError2
              );
            }
          } else {
            errors.push(
              new FrodoError(
                `Error importing provider ${providerId} in journey ${treeId}`,
                error
              )
            );
          }
        }
      }
    }

    // Process saml providers
    if (
      deps &&
      importData.saml2Entities &&
      Object.entries(importData.saml2Entities).length > 0
    ) {
      if (verbose)
        printMessage({
          message: '\n  - SAML2 entity providers:',
          newline: false,
          state,
        });
      for (const [, providerData] of Object.entries(importData.saml2Entities)) {
        delete providerData['_rev'];
        const entityId = providerData['entityId'];
        const entityLocation = providerData['entityLocation'];
        if (verbose)
          printMessage({
            message: `\n    - ${entityLocation} ${entityId}`,
            type: 'info',
            newline: false,
            state,
          });
        let metaData = null;
        if (entityLocation === 'remote') {
          if (Array.isArray(providerData['base64EntityXML'])) {
            metaData = convertTextArrayToBase64Url(
              providerData['base64EntityXML']
            );
          } else {
            metaData = providerData['base64EntityXML'];
          }
        }
        delete providerData['entityLocation'];
        delete providerData['base64EntityXML'];
        // create the provider if it doesn't already exist, or just update it
        if (
          (
            await queryProviderStubs({
              filter: `entityId eq '${entityId}'`,
              fields: ['location'],
              state,
            })
          ).resultCount === 0
        ) {
          try {
            await createProvider({
              location: entityLocation,
              providerData,
              metaData,
              state,
            });
          } catch (error) {
            errors.push(
              new FrodoError(`Error creating provider ${entityId}`, error)
            );
          }
        } else {
          try {
            await updateProvider({
              location: entityLocation,
              providerData,
              state,
            });
          } catch (error) {
            errors.push(
              new FrodoError(`Error updating provider ${entityId}`, error)
            );
          }
        }
      }
    }

    // Process circles of trust
    if (
      deps &&
      importData.circlesOfTrust &&
      Object.entries(importData.circlesOfTrust).length > 0
    ) {
      if (verbose)
        printMessage({
          message: '\n  - SAML2 circles of trust:',
          newline: false,
          state,
        });
      for (const [cotId, cotData] of Object.entries(
        importData.circlesOfTrust
      )) {
        delete cotData['_rev'];
        if (verbose)
          printMessage({
            message: `\n    - ${cotId}`,
            type: 'info',
            newline: false,
            state,
          });
        try {
          await createCircleOfTrust({ cotData, state });
        } catch (error) {
          if (
            error.response?.status === 409 ||
            error.response?.status === 500
          ) {
            try {
              await updateCircleOfTrust({ cotId, cotData, state });
            } catch (updateCotErr) {
              errors.push(
                new FrodoError(
                  `Error updating circle of trust ${cotId}`,
                  updateCotErr
                )
              );
            }
          } else {
            errors.push(
              new FrodoError(`Error creating circle of trust ${cotId}`, error)
            );
          }
        }
      }
    }

    // Process inner nodes
    let innerNodes = {};
    if (
      importData.innerNodes &&
      Object.entries(importData.innerNodes).length > 0
    ) {
      innerNodes = importData.innerNodes;
    }
    // old export file format
    else if (
      importData.innernodes &&
      Object.entries(importData.innernodes).length > 0
    ) {
      innerNodes = importData.innernodes;
    }
    if (Object.entries(innerNodes).length > 0) {
      if (verbose)
        printMessage({
          message: '\n  - Inner nodes:',
          type: 'text',
          newline: false,
          state,
        });
      for (const [innerNodeId, innerNodeData] of Object.entries(innerNodes)) {
        delete innerNodeData['_rev'];
        const nodeType = innerNodeData['_type']['_id'];
        if (!reUuid) {
          newUuid = innerNodeId;
        } else {
          newUuid = uuidv4();
          uuidMap[innerNodeId] = newUuid;
        }
        innerNodeData['_id'] = newUuid;

        if (verbose)
          printMessage({
            message: `\n    - ${newUuid}${reUuid ? '*' : ''} (${nodeType})`,
            type: 'info',
            newline: false,
            state,
          });

        // If the node has an identityResource config setting
        // and the identityResource ends in 'user'
        // and the node's identityResource is the same as the tree's identityResource
        // change it to the current realm managed user identityResource otherwise leave it alone.
        if (
          innerNodeData['identityResource'] &&
          innerNodeData['identityResource'].endsWith('user') &&
          innerNodeData['identityResource'] === importData.tree.identityResource
        ) {
          innerNodeData['identityResource'] =
            `managed/${getCurrentRealmManagedUser({
              state,
            })}`;
          if (verbose)
            printMessage({
              message: `\n      - identityResource: ${innerNodeData['identityResource']}`,
              type: 'info',
              newline: false,
              state,
            });
        }
        //special case nodes referencing PingOne Service
        if (innerNodeData['tntpPingOneConfigName']) {
          const p1ServiceName = (
            innerNodeData['tntpPingOneConfigName'] as string
          ).replace(
            /(.+?\[\/)(.+?)(])/g,
            '$1' + getCurrentRealmName(state) + '$3'
          );
          innerNodeData['tntpPingOneConfigName'] = p1ServiceName;
          if (verbose)
            printMessage({
              message: `\n      - tntpPingOneConfigName: ${p1ServiceName}`,
              type: 'info',
              newline: false,
              state,
            });
        }
        try {
          await putNode({
            nodeId: newUuid,
            nodeType,
            nodeData: innerNodeData as NodeSkeleton,
            state,
          });
        } catch (nodeImportError) {
          if (
            nodeImportError.response?.status === 400 &&
            nodeImportError.response?.data?.message ===
              'Data validation failed for the attribute, Script'
          ) {
            throw new FrodoError(
              `Missing script ${
                innerNodeData['script']
              } referenced by inner node ${innerNodeId}${
                innerNodeId === newUuid ? '' : ` [${newUuid}]`
              } (${innerNodeData['_type']['_id']}) in journey ${treeId}`,
              nodeImportError
            );
          } else if (
            nodeImportError.response?.status === 400 &&
            nodeImportError.response?.data?.message ===
              'Invalid attribute specified.'
          ) {
            const { validAttributes } = nodeImportError.response.data.detail;
            validAttributes.push('_id');
            for (const attribute of Object.keys(innerNodeData)) {
              if (!validAttributes.includes(attribute)) {
                if (verbose)
                  printMessage({
                    message: `\n      - Removing invalid attribute: ${attribute}`,
                    type: 'warn',
                    newline: false,
                    state,
                  });
                delete innerNodeData[attribute];
              }
            }
            try {
              await putNode({
                nodeId: newUuid,
                nodeType,
                nodeData: innerNodeData as NodeSkeleton,
                state,
              });
            } catch (nodeImportError2) {
              throw new FrodoError(
                `Error importing node ${innerNodeId}${
                  innerNodeId === newUuid ? '' : ` [${newUuid}]`
                } in journey ${treeId}`,
                nodeImportError2
              );
            }
          } else if (nodeImportError.response?.status === 404) {
            throw new FrodoError(
              `Unable to import node ${innerNodeId}${
                innerNodeId === newUuid ? '' : ` [${newUuid}]`
              } in journey ${treeId} because its type ${(innerNodeData as NodeSkeleton)._type._id} doesn't exist in deployment`,
              nodeImportError
            );
          } else {
            throw new FrodoError(
              `Error importing inner node ${innerNodeId}${
                innerNodeId === newUuid ? '' : ` [${newUuid}]`
              } in journey ${treeId}`,
              nodeImportError
            );
          }
        }
        if (verbose) printMessage({ message: '', state });
      }
    }

    // Process nodes
    if (importData.nodes && Object.entries(importData.nodes).length > 0) {
      if (verbose)
        printMessage({ message: '\n  - Nodes:', newline: false, state });
      // eslint-disable-next-line prefer-const
      for (let [nodeId, nodeData] of Object.entries(importData.nodes)) {
        delete nodeData['_rev'];
        const nodeType = nodeData['_type']['_id'];
        if (!reUuid) {
          newUuid = nodeId;
        } else {
          newUuid = uuidv4();
          uuidMap[nodeId] = newUuid;
        }
        nodeData['_id'] = newUuid;

        if (nodeType === 'PageNode' && reUuid) {
          for (const [, inPageNodeData] of Object.entries(nodeData['nodes'])) {
            const currentId = inPageNodeData['_id'];
            nodeData = JSON.parse(
              JSON.stringify(nodeData).replaceAll(currentId, uuidMap[currentId])
            );
          }
        }

        if (verbose)
          printMessage({
            message: `\n    - ${newUuid}${reUuid ? '*' : ''} (${nodeType})`,
            type: 'info',
            newline: false,
            state,
          });

        // If the node has an identityResource config setting
        // and the identityResource ends in 'user'
        // and the node's identityResource is the same as the tree's identityResource
        // change it to the current realm managed user identityResource otherwise leave it alone.
        if (
          nodeData.identityResource &&
          nodeData.identityResource.endsWith('user') &&
          nodeData.identityResource === importData.tree.identityResource
        ) {
          nodeData['identityResource'] = `managed/${getCurrentRealmManagedUser({
            state,
          })}`;
          if (verbose)
            printMessage({
              message: `\n      - identityResource: ${nodeData['identityResource']}`,
              type: 'info',
              newline: false,
              state,
            });
        }
        //special case nodes referencing PingOne Service
        if (nodeData['tntpPingOneConfigName']) {
          const p1ServiceName = (
            nodeData['tntpPingOneConfigName'] as string
          ).replace(
            /(.+?\[\/)(.+?)(])/g,
            '$1' + getCurrentRealmName(state) + '$3'
          );
          nodeData['tntpPingOneConfigName'] = p1ServiceName;
          if (verbose)
            printMessage({
              message: `\n      - tntpPingOneConfigName: ${p1ServiceName}`,
              type: 'info',
              newline: false,
              state,
            });
        }
        try {
          await putNode({ nodeId: newUuid, nodeType, nodeData, state });
        } catch (nodeImportError) {
          if (
            nodeImportError.response?.status === 400 &&
            nodeImportError.response?.data?.message ===
              'Data validation failed for the attribute, Script'
          ) {
            throw new FrodoError(
              `Missing script ${
                nodeData['script']
              } referenced by node ${nodeId}${
                nodeId === newUuid ? '' : ` [${newUuid}]`
              } (${nodeData['_type']['_id']}) in journey ${treeId}`,
              nodeImportError
            );
          } else if (
            nodeImportError.response?.status === 400 &&
            nodeImportError.response?.data?.message ===
              'Invalid attribute specified.'
          ) {
            const { validAttributes } = nodeImportError.response.data.detail;
            validAttributes.push('_id');
            for (const attribute of Object.keys(nodeData)) {
              if (!validAttributes.includes(attribute)) {
                if (verbose)
                  printMessage({
                    message: `\n      - Removing invalid attribute: ${attribute}`,
                    type: 'warn',
                    newline: false,
                    state,
                  });
                delete nodeData[attribute];
              }
            }
            try {
              await putNode({ nodeId: newUuid, nodeType, nodeData, state });
            } catch (nodeImportError2) {
              throw new FrodoError(
                `Error importing node ${nodeId}${
                  nodeId === newUuid ? '' : ` [${newUuid}]`
                } in journey ${treeId}`,
                nodeImportError2
              );
            }
          } else if (nodeImportError.response?.status === 404) {
            throw new FrodoError(
              `Unable to import node ${nodeId}${
                nodeId === newUuid ? '' : ` [${newUuid}]`
              } in journey ${treeId} because its type ${nodeData._type._id} doesn't exist in deployment`,
              nodeImportError
            );
          } else {
            throw new FrodoError(
              `Error importing node ${nodeId}${
                nodeId === newUuid ? '' : ` [${newUuid}]`
              } in journey ${treeId}`,
              nodeImportError
            );
          }
        }
        if (verbose) printMessage({ message: '', state });
      }
    }

    // Process tree
    if (verbose) printMessage({ message: '\n  - Flow', newline: false, state });

    if (reUuid) {
      let journeyText = JSON.stringify(importData.tree, null, 2);
      for (const [oldId, newId] of Object.entries(uuidMap)) {
        journeyText = journeyText.replaceAll(oldId, newId);
      }
      importData.tree = JSON.parse(journeyText);
    }

    // If the tree has an identityResource config setting
    // and the identityResource ends in 'user'
    // Set the identityResource for the tree to the selected resource.
    if (
      (importData.tree.identityResource &&
        (importData.tree['identityResource'] as string).endsWith('user')) ||
      state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY ||
      state.getDeploymentType() === Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY
    ) {
      importData.tree.identityResource = `managed/${getCurrentRealmManagedUser({
        state,
      })}`;
      if (verbose)
        printMessage({
          message: `\n    - identityResource: ${importData.tree.identityResource}`,
          type: 'info',
          newline: false,
          state,
        });
    }

    // Process tree nodes
    const serverTreeObject = await updateCoordinates({
      tree: importData.tree,
      nodesAttributeName: 'nodes',
      serverTree: null,
      state: state,
    });
    // Process tree static nodes
    await updateCoordinates({
      tree: importData.tree,
      nodesAttributeName: 'staticNodes',
      serverTree: serverTreeObject,
      state: state,
    });

    delete importData.tree._rev;
    try {
      response = await putTree({
        treeId,
        treeData: importData.tree,
        state,
      });
      if (verbose)
        printMessage({
          message: `\n    - Done`,
          type: 'info',
          newline: true,
          state,
        });
    } catch (importError) {
      if (
        importError.response?.status === 400 &&
        importError.response?.data?.message === 'Invalid attribute specified.'
      ) {
        const { validAttributes } = importError.response.data.detail;
        validAttributes.push('_id');
        for (const attribute of Object.keys(importData.tree)) {
          if (!validAttributes.includes(attribute)) {
            if (verbose)
              printMessage({
                message: `\n    - Removing invalid attribute: ${attribute}`,
                type: 'warn',
                newline: false,
                state,
              });
            delete importData.tree[attribute];
          }
        }
        try {
          response = await putTree({
            treeId,
            treeData: importData.tree,
            state,
          });
          if (verbose)
            printMessage({
              message: `\n    - Done`,
              type: 'info',
              newline: true,
              state,
            });
        } catch (importError2) {
          errors.push(
            new FrodoError(
              `Error importing journey flow ${treeId}`,
              importError2
            )
          );
        }
      } else {
        errors.push(
          new FrodoError(`Error importing journey flow ${treeId}`, importError)
        );
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 0) {
    throw new FrodoError(
      `Error importing journey${importData && importData.tree && importData.tree._id ? ` '${importData.tree._id}'` : ''}`,
      errors
    );
  }
  return response;
}

/**
 * Resolve inner tree dependencies
 * @param {string[]} existingJorneys Array of existing journey names
 * @param {MultiTreeExportInterface} candidateJourneys Map of journeys to resolve dependencies for
 * @param {{ [k: string]: string[] }} unresolvedJourneys Map of unresolved journey names and their dependencies
 * @param {string[]} resolvedJourneys Array of resolved journey names
 * @param {number} index Depth of recursion
 * @returns {Promise<{unresolvedJourneys: { [k: string]: string[] }; resolvedJourneys: string[];}>} a promise resolving to a dependency status object
 */
export async function resolveInnerTreeDependencies({
  existingJorneys,
  candidateJourneys,
  unresolvedJourneys,
  resolvedJourneys,
  index = -1,
}: {
  existingJorneys: string[];
  candidateJourneys: MultiTreeExportInterface;
  unresolvedJourneys?: { [k: string]: string[] };
  resolvedJourneys?: string[];
  index?: number;
}): Promise<{
  unresolvedJourneys: { [k: string]: string[] };
  resolvedJourneys: string[];
}> {
  let before = -1;
  let after = index;
  if (index !== -1) {
    before = index;
  }

  for (const tree in candidateJourneys) {
    if ({}.hasOwnProperty.call(candidateJourneys, tree)) {
      const dependencies = [];
      for (const node in candidateJourneys[tree].nodes) {
        if (
          candidateJourneys[tree].nodes[node]._type._id ===
          'InnerTreeEvaluatorNode'
        ) {
          dependencies.push(candidateJourneys[tree].nodes[node].tree);
        }
      }
      let allResolved = true;
      for (const dependency of dependencies) {
        if (
          !resolvedJourneys.includes(dependency) &&
          !existingJorneys.includes(dependency)
        ) {
          allResolved = false;
        }
      }
      if (allResolved) {
        if (resolvedJourneys.indexOf(tree) === -1) resolvedJourneys.push(tree);
        delete unresolvedJourneys[tree];
      } else {
        unresolvedJourneys[tree] = dependencies;
      }
    }
  }
  after = Object.keys(unresolvedJourneys).length;
  if (index !== -1 && after === before) {
    // This is the end, no progress was made since the last recursion
    return {
      unresolvedJourneys,
      resolvedJourneys,
    };
  } else if (after > 0) {
    resolveInnerTreeDependencies({
      existingJorneys: existingJorneys,
      candidateJourneys: candidateJourneys,
      unresolvedJourneys,
      resolvedJourneys,
      index: after,
    });
  }
}

/**
 * Resolve journey dependencies
 * @param {string[]} installedJorneys Map of installed journeys
 * @param {Record<string, SingleTreeExportInterface>} journeyMap Map of journeys to resolve dependencies for
 * @param {string[]} unresolvedJourneys Map to hold the names of unresolved journeys and their dependencies
 * @param {string[]} resolvedJourneys Array to hold the names of resolved journeys
 * @param {number} index Depth of recursion
 */
export async function resolveDependencies(
  installedJorneys: string[],
  journeyMap: Record<string, SingleTreeExportInterface>,
  unresolvedJourneys: { [k: string]: string[] },
  resolvedJourneys: string[],
  index = -1
) {
  let before = -1;
  let after = index;
  if (index !== -1) {
    before = index;
  }

  for (const tree in journeyMap) {
    if ({}.hasOwnProperty.call(journeyMap, tree)) {
      const dependencies = [];
      for (const node in journeyMap[tree].nodes) {
        if (
          journeyMap[tree].nodes[node]._type._id === 'InnerTreeEvaluatorNode'
        ) {
          dependencies.push(journeyMap[tree].nodes[node].tree);
        }
      }
      let allResolved = true;
      for (const dependency of dependencies) {
        if (
          !resolvedJourneys.includes(dependency) &&
          !installedJorneys.includes(dependency)
        ) {
          allResolved = false;
        }
      }
      if (allResolved) {
        if (resolvedJourneys.indexOf(tree) === -1) resolvedJourneys.push(tree);
        // remove from unresolvedJourneys array
        // for (let i = 0; i < unresolvedJourneys.length; i += 1) {
        //   if (unresolvedJourneys[i] === tree) {
        //     unresolvedJourneys.splice(i, 1);
        //     i -= 1;
        //   }
        // }
        delete unresolvedJourneys[tree];
        // } else if (!unresolvedJourneys.includes(tree)) {
      } else {
        // unresolvedJourneys.push(tree);
        unresolvedJourneys[tree] = dependencies;
      }
    }
  }
  after = Object.keys(unresolvedJourneys).length;
  if (index !== -1 && after === before) {
    // This is the end, no progress was made since the last recursion
    // printMessage(
    //   `Journeys with unresolved dependencies: ${unresolvedJourneys}`,
    //   'error'
    // );
  } else if (after > 0) {
    resolveDependencies(
      installedJorneys,
      journeyMap,
      unresolvedJourneys,
      resolvedJourneys,
      after
    );
  }
}

/**
 * Import journeys
 * @param {MultiTreeExportInterface} importData map of trees object
 * @param {TreeImportOptions} options import options
 */
export async function importJourneys({
  importData,
  options,
  state,
}: {
  importData: MultiTreeExportInterface;
  options: TreeImportOptions;
  state: State;
}): Promise<TreeSkeleton[]> {
  const response = [];
  const errors = [];
  const installedJourneys = (await readJourneys({ state })).map((x) => x._id);
  const unresolvedJourneys: {
    [k: string]: string[];
  } = {};
  const resolvedJourneys = [];
  let indicatorId = createProgressIndicator({
    total: undefined,
    message: 'Resolving dependencies',
    type: 'indeterminate',
    state,
  });
  await resolveDependencies(
    installedJourneys,
    importData.trees,
    unresolvedJourneys,
    resolvedJourneys
  );
  if (Object.keys(unresolvedJourneys).length === 0) {
    // no unresolved journeys
    stopProgressIndicator({
      id: indicatorId,
      message: `Resolved all dependencies.`,
      status: 'success',
      state,
    });
  } else {
    stopProgressIndicator({
      id: indicatorId,
      message: `${
        Object.keys(unresolvedJourneys).length
      } journeys with unresolved dependencies`,
      status: 'fail',
      state,
    });
    const message: string[] = [
      `${
        Object.keys(unresolvedJourneys).length
      } journeys with unresolved dependencies:`,
    ];
    for (const journey of Object.keys(unresolvedJourneys)) {
      message.push(`  - ${journey} requires ${unresolvedJourneys[journey]}`);
    }
    throw new FrodoError(message.join('\n'));
  }
  indicatorId = createProgressIndicator({
    total: resolvedJourneys.length,
    message: 'Importing',
    state,
  });
  for (const tree of resolvedJourneys) {
    try {
      response.push(
        await importJourney({
          importData: importData.trees[tree],
          options,
          state,
        })
      );
      updateProgressIndicator({ id: indicatorId, message: `${tree}`, state });
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    stopProgressIndicator({
      id: indicatorId,
      message: 'Error importing journeys',
      state,
    });
    throw new FrodoError(`Error importing journeys`, errors);
  }
  stopProgressIndicator({
    id: indicatorId,
    message: 'Finished importing journeys',
    state,
  });
  return response;
}

/**
 * Get the node reference obbject for a node object. Node reference objects
 * are used in a tree flow definition and within page nodes to reference
 * nodes. Among other things, node references contain all the non-configuration
 * meta data that exists for readaility, like the x/y coordinates of the node
 * and the display name chosen by the tree designer. The dislay name is the
 * only intuitive link between the graphical representation of the tree and
 * the node configurations that make up the tree.
 * @param nodeObj node object to retrieve the node reference object for
 * @param singleTreeExport tree export with or without dependencies
 * @returns {NodeRefSkeletonInterface | InnerNodeRefSkeletonInterface} node reference object
 */
export function getNodeRef(
  nodeObj: NodeSkeleton,
  singleTreeExport: SingleTreeExportInterface
): NodeRefSkeletonInterface | InnerNodeRefSkeletonInterface {
  if (singleTreeExport.tree.nodes[nodeObj._id]) {
    return singleTreeExport.tree.nodes[nodeObj._id];
  } else {
    for (const node of Object.values(singleTreeExport.nodes)) {
      if (containerNodes.includes(node._type._id)) {
        for (const nodeRef of node.nodes) {
          if (nodeRef._id === nodeObj._id) {
            return nodeRef;
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Default tree export resolver used to resolve a tree id/name to a full export
 * w/o dependencies of that tree from a platform instance.
 * @param {string} treeId id/name of the tree to resolve
 * @returns {TreeExportResolverInterface} tree export
 */
export const onlineTreeExportResolver: TreeExportResolverInterface =
  async function (treeId: string, state: State) {
    debugMessage({ message: `onlineTreeExportResolver(${treeId})`, state });
    return await exportJourney({
      journeyId: treeId,
      options: {
        deps: false,
        useStringArrays: false,
        coords: true,
      },
      state,
    });
  };

/**
 * Tree export resolver used to resolve a tree id/name to a full export
 * of that tree from individual `treename.journey.json` export files.
 * @param {string} treeId id/name of the tree to resolve
 * @returns {TreeExportResolverInterface} tree export
 */
export const fileByIdTreeExportResolver: TreeExportResolverInterface =
  async function (
    treeId: string,
    state: State
  ): Promise<SingleTreeExportInterface> {
    debugMessage({ message: `fileByIdTreeExportResolver(${treeId})`, state });
    let treeExport = createSingleTreeExportTemplate({ state });
    const files = findFilesByName(getTypedFilename(`${treeId}`, 'journey'));
    try {
      const file = files.pop();
      const jsonData = JSON.parse(fs.readFileSync(file, 'utf8'));
      debugMessage({
        message: `fileByIdTreeExportResolver: resolved '${treeId}' to ${file}`,
        state,
      });
      // did we resolve the tree we were asked to resolved?
      if (jsonData.tree?._id === treeId) {
        treeExport = jsonData;
      }
      // check if this is a file with multiple trees and get journey by id
      else if (jsonData.trees && jsonData.trees[treeId]) {
        treeExport = jsonData.trees[treeId];
      }
    } catch (error) {
      throw new FrodoError(`Unable to resolve '${treeId}' to a file`, error);
    }
    return treeExport;
  };

/**
 * Factory that creates a tree export resolver used to resolve a tree id
 * to a full export of that tree from a multi-tree export file.
 * @param {string} file multi-tree export file
 * @returns {TreeExportResolverInterface} tree export resolver
 */
export function createFileParamTreeExportResolver(
  file: string,
  state: State
): TreeExportResolverInterface {
  const fileParamTreeExportResolver: TreeExportResolverInterface =
    async function (treeId: string) {
      debugMessage({
        message: `fileParamTreeExportResolver(${treeId})`,
        state,
      });
      let treeExport: SingleTreeExportInterface =
        createSingleTreeExportTemplate({ state });
      try {
        const jsonData = JSON.parse(fs.readFileSync(file, 'utf8'));
        // did we resolve the tree we were asked to resolved?
        if (jsonData.tree?._id === treeId) {
          treeExport = jsonData;
        }
        // check if this is a file with multiple trees and get journey by id
        else if (jsonData.trees && jsonData.trees[treeId]) {
          treeExport = jsonData.trees[treeId];
        }
        // fall back to fileByIdTreeExportResolver
        else {
          treeExport = await fileByIdTreeExportResolver(treeId, state);
        }
      } catch (error) {
        debugMessage({ message: error.message, state });
      }
      return treeExport;
    };
  debugMessage({ message: `fileParamTreeExportResolver: file=${file}`, state });
  return fileParamTreeExportResolver;
}

/**
 * Get tree dependencies (all descendent inner trees)
 * @param {SingleTreeExportInterface} treeExport single tree export
 * @param {string[]} resolvedTreeIds list of tree ids wich have already been resolved
 * @param {TreeExportResolverInterface} resolveTreeExport tree export resolver callback function
 * @returns {Promise<TreeDependencyMapInterface>} a promise that resolves to a tree dependency map
 */
export async function getTreeDescendents({
  treeExport,
  resolveTreeExport = onlineTreeExportResolver,
  resolvedTreeIds = [],
  state,
}: {
  treeExport: SingleTreeExportInterface;
  resolveTreeExport: TreeExportResolverInterface;
  resolvedTreeIds: string[];
  state: State;
}): Promise<TreeDependencyMapInterface> {
  const treeId = treeExport.tree._id + '';
  debugMessage({
    message: `getTreeDependencies(${treeId}, [${resolvedTreeIds.join(', ')}])`,
    state,
  });
  if (!resolvedTreeIds.includes(treeId)) {
    resolvedTreeIds.push(treeId);
  }
  const treeDependencyMap: TreeDependencyMapInterface = {
    [treeId]: [],
  };
  const dependencies: TreeDependencyMapInterface[] = [];
  for (const [nodeId, node] of Object.entries(treeExport.tree.nodes)) {
    let innerTreeId: string;
    try {
      if (node.nodeType === 'InnerTreeEvaluatorNode') {
        innerTreeId = treeExport.nodes[nodeId].tree;
        if (!resolvedTreeIds.includes(innerTreeId)) {
          const innerTreeExport = await resolveTreeExport(innerTreeId, state);
          debugMessage({
            message: `resolved inner tree: ${innerTreeExport.tree._id}`,
            state,
          });
          // resolvedTreeIds.push(innerTreeId);
          dependencies.push(
            await getTreeDescendents({
              treeExport: innerTreeExport,
              resolveTreeExport,
              resolvedTreeIds,
              state,
            })
          );
        }
      }
    } catch (error) {
      if (innerTreeId) {
        const unresolvableMap: TreeDependencyMapInterface = {
          [innerTreeId]: [],
        };
        dependencies.push(unresolvableMap);
      }
    }
  }
  treeDependencyMap[treeId] = dependencies;
  return treeDependencyMap;
}

/**
 * Analyze if a journey contains any custom nodes considering the detected or the overridden version.
 * @param {SingleTreeExportInterface} journey Journey/tree configuration object
 * @returns {boolean} True if the journey/tree contains any custom nodes, false otherwise.
 */
export function isCustomJourney({
  journey,
  state,
}: {
  journey: SingleTreeExportInterface;
  state: State;
}): boolean {
  debugMessage({ message: `JourneyOps.isCustomJourney: start`, state });
  const nodeList = Object.values(journey.nodes).concat(
    Object.values(journey.innerNodes)
  );
  for (const node of nodeList) {
    if (isCustomNode({ nodeType: node['_type']['_id'], state })) {
      debugMessage({
        message: `JourneyOps.isCustomJourney: Custom node: ${node['_type']['_id']}`,
        state,
      });
      return true;
    }
  }
  debugMessage({ message: `JourneyOps.isCustomJourney: end [false]`, state });
  return false;
}

/**
 * Analyze if a journey contains any premium nodes considering the detected or the overridden version.
 * @param {SingleTreeExportInterface} journey Journey/tree configuration object
 * @returns {boolean} True if the journey/tree contains any custom nodes, false otherwise.
 */
export function isPremiumJourney(journey: SingleTreeExportInterface): boolean {
  const nodeList = Object.values(journey.nodes).concat(
    Object.values(journey.innerNodes)
  );
  for (const node of nodeList) {
    if (isPremiumNode(node['_type']['_id'])) {
      return true;
    }
  }
  return false;
}

/**
 * Analyze if a journey contains any cloud-only nodes considering the detected or the overridden version.
 * @param {SingleTreeExportInterface} journey Journey/tree configuration object
 * @returns {boolean} True if the journey/tree contains any cloud-only nodes, false otherwise.
 */
export function isCloudOnlyJourney(
  journey: SingleTreeExportInterface
): boolean {
  const nodeList = Object.values(journey.nodes).concat(
    Object.values(journey.innerNodes)
  );
  for (const node of nodeList) {
    if (isCloudOnlyNode(node['_type']['_id'])) {
      return true;
    }
  }
  return false;
}

/**
 * Get a journey's classifications, which can be one or multiple of:
 * - standard: can run on any instance of a ForgeRock platform
 * - cloud: utilize nodes, which are exclusively available in the ForgeRock Identity Cloud
 * - premium: utilizes nodes, which come at a premium
 * - custom: utilizes nodes not included in the ForgeRock platform release
 * @param {SingleTreeExportInterface} journey journey export data
 * @returns {JourneyClassification[]} an array of one or multiple classifications
 */
export function getJourneyClassification({
  journey,
  state,
}: {
  journey: SingleTreeExportInterface;
  state: State;
}): JourneyClassificationType[] {
  const classifications: JourneyClassification[] = [];
  const premium = isPremiumJourney(journey);
  const custom = isCustomJourney({ journey, state });
  const cloud = isCloudOnlyJourney(journey);
  if (custom) {
    classifications.push(JourneyClassification.CUSTOM);
  } else if (cloud) {
    classifications.push(JourneyClassification.CLOUD);
  } else {
    classifications.push(JourneyClassification.STANDARD);
  }
  if (premium) classifications.push(JourneyClassification.PREMIUM);
  return classifications;
}

export type DeleteJourneyStatus = {
  status: string;
  nodes: { status?: string };
};

/**
 * Delete a journey
 * @param {string} journeyId journey id/name
 * @param {Object} options deep=true also delete all the nodes and inner nodes, verbose=true print verbose info
 */
export async function deleteJourney({
  journeyId,
  options,
  state,
}: {
  journeyId: string;
  options: { deep: boolean; verbose: boolean; progress?: boolean };
  state: State;
}): Promise<DeleteJourneyStatus> {
  const { deep, verbose } = options;
  const progress = !('progress' in options) ? true : options.progress;
  const status: DeleteJourneyStatus = { status: 'unknown', nodes: {} };
  let indicatorId: string;
  if (progress)
    indicatorId = createProgressIndicator({
      total: undefined,
      message: `Deleting ${journeyId}...`,
      type: 'indeterminate',
      state,
    });
  if (progress && verbose) stopProgressIndicator({ id: indicatorId, state });
  return deleteTree({ treeId: journeyId, state })
    .then(async (deleteTreeResponse) => {
      status['status'] = 'success';
      const nodePromises = [];
      if (verbose)
        printMessage({
          message: `Deleted ${journeyId} (tree)`,
          type: 'info',
          state,
        });
      if (deep) {
        for (const [nodeId, nodeObject] of Object.entries(
          deleteTreeResponse.nodes
        )) {
          // delete inner nodes (nodes inside container nodes)
          if (containerNodes.includes(nodeObject['nodeType'])) {
            try {
              const containerNode = await getNode({
                nodeId,
                nodeType: nodeObject['nodeType'],
                state,
              });
              if (verbose)
                printMessage({
                  message: `Read ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}`,
                  type: 'info',
                  state,
                });
              for (const innerNodeObject of containerNode.nodes) {
                nodePromises.push(
                  deleteNode({
                    nodeId: innerNodeObject._id,
                    nodeType: innerNodeObject.nodeType,
                    state,
                  })
                    .then((response2) => {
                      status.nodes[innerNodeObject._id] = { status: 'success' };
                      if (verbose)
                        printMessage({
                          message: `Deleted ${innerNodeObject._id} (${innerNodeObject.nodeType}) from ${journeyId}`,
                          type: 'info',
                          state,
                        });
                      return response2;
                    })
                    .catch((error) => {
                      status.nodes[innerNodeObject._id] = {
                        status: 'error',
                        error,
                      };
                      if (verbose)
                        printMessage({
                          message: `Error deleting inner node ${innerNodeObject._id} (${innerNodeObject.nodeType}) from ${journeyId}: ${error}`,
                          type: 'error',
                          state,
                        });
                    })
                );
              }
              // finally delete the container node
              nodePromises.push(
                deleteNode({
                  nodeId: containerNode._id,
                  nodeType: containerNode['_type']['_id'],
                  state,
                })
                  .then((response2) => {
                    status.nodes[containerNode._id] = { status: 'success' };
                    if (verbose)
                      printMessage({
                        message: `Deleted ${containerNode._id} (${containerNode['_type']['_id']}) from ${journeyId}`,
                        type: 'info',
                        state,
                      });
                    return response2;
                  })
                  .catch((error) => {
                    if (
                      error?.response?.data?.code === 500 &&
                      error.response.data.message ===
                        'Unable to read SMS config: Node did not exist'
                    ) {
                      status.nodes[containerNode._id] = { status: 'success' };
                      if (verbose)
                        printMessage({
                          message: `Deleted ${containerNode._id} (${containerNode['_type']['_id']}) from ${journeyId}`,
                          type: 'info',
                          state,
                        });
                    } else {
                      status.nodes[containerNode._id] = {
                        status: 'error',
                        error,
                      };
                      if (verbose)
                        printMessage({
                          message: `Error deleting container node ${containerNode._id} (${containerNode['_type']['_id']}) from ${journeyId}: ${error.response.data.message}`,
                          type: 'error',
                          state,
                        });
                    }
                  })
              );
            } catch (error) {
              if (verbose)
                printMessage({
                  message: `Error getting container node ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}: ${error}`,
                  type: 'error',
                  state,
                });
            }
          } else {
            // delete the node
            nodePromises.push(
              deleteNode({ nodeId, nodeType: nodeObject['nodeType'], state })
                .then((response) => {
                  status.nodes[nodeId] = { status: 'success' };
                  if (verbose)
                    printMessage({
                      message: `Deleted ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}`,
                      type: 'info',
                      state,
                    });
                  return response;
                })
                .catch((error) => {
                  status.nodes[nodeId] = { status: 'error', error };
                  if (verbose)
                    printMessage({
                      message: `Error deleting node ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}: ${error}`,
                      type: 'error',
                      state,
                    });
                })
            );
          }
        }
      }
      // wait until all the node calls are complete
      await Promise.allSettled(nodePromises);

      // report status
      if (progress) {
        let nodeCount = 0;
        let errorCount = 0;
        for (const node of Object.keys(status.nodes)) {
          nodeCount += 1;
          if (status.nodes[node].status === 'error') errorCount += 1;
        }
        if (errorCount === 0) {
          stopProgressIndicator({
            id: indicatorId,
            message: `Deleted ${journeyId} and ${
              nodeCount - errorCount
            }/${nodeCount} nodes.`,
            status: 'success',
            state,
          });
        } else {
          stopProgressIndicator({
            id: indicatorId,
            message: `Deleted ${journeyId} and ${
              nodeCount - errorCount
            }/${nodeCount} nodes.`,
            status: 'fail',
            state,
          });
        }
      }
      return status;
    })
    .catch((error) => {
      status['status'] = 'error';
      status['error'] = error;
      stopProgressIndicator({
        id: indicatorId,
        message: `Error deleting ${journeyId}.`,
        status: 'fail',
        state,
      });
      if (verbose)
        printMessage({
          message: `Error deleting tree ${journeyId}: ${error}`,
          type: 'error',
          state,
        });
      return status;
    });
}

export type DeleteJourneysStatus = {
  [k: string]: DeleteJourneyStatus;
};

/**
 * Delete all journeys
 * @param {Object} options deep=true also delete all the nodes and inner nodes, verbose=true print verbose info
 */
export async function deleteJourneys({
  options,
  state,
}: {
  options?: {
    deep: boolean;
    verbose: boolean;
  };
  state: State;
}) {
  let indicatorId: string;
  try {
    const { verbose } = options;
    const status: DeleteJourneysStatus = {};
    const trees = (await getTrees({ state })).result;
    indicatorId = createProgressIndicator({
      total: trees.length,
      message: 'Deleting journeys...',
      state,
    });
    for (const tree of trees) {
      if (verbose) printMessage({ message: '', state });
      options['progress'] = false;
      status[tree._id] = await deleteJourney({
        journeyId: tree._id,
        options,
        state,
      });
      updateProgressIndicator({
        id: indicatorId,
        message: `${tree._id}`,
        state,
      });
      // introduce a 100ms wait to allow the progress bar to update before the next verbose message prints from the async function
      if (verbose)
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => {
          setTimeout(r, 100);
        });
    }
    let journeyCount = 0;
    let journeyErrorCount = 0;
    let nodeCount = 0;
    let nodeErrorCount = 0;
    for (const journey of Object.keys(status)) {
      journeyCount += 1;
      if (status[journey].status === 'error') journeyErrorCount += 1;
      for (const node of Object.keys(status[journey].nodes)) {
        nodeCount += 1;
        if (status[journey].nodes[node].status === 'error') nodeErrorCount += 1;
      }
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Deleted ${
        journeyCount - journeyErrorCount
      }/${journeyCount} journeys and ${
        nodeCount - nodeErrorCount
      }/${nodeCount} nodes.`,
      state,
    });
    return status;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error deleting journeys`,
      status: 'fail',
      state,
    });
    throw new FrodoError(`Error deleting journeys`, error);
  }
}

/**
 * Enable a journey
 * @param journeyId journey id/name
 * @returns {Promise<TreeSkeleton>} updated tree/journey object
 */
export async function enableJourney({
  journeyId,
  state,
}: {
  journeyId: string;
  state: State;
}): Promise<TreeSkeleton> {
  try {
    const treeObject = await getTree({ id: journeyId, state });
    treeObject['enabled'] = true;
    delete treeObject._rev;
    const newTreeObject = await putTree({
      treeId: journeyId,
      treeData: treeObject,
      state,
    });
    return newTreeObject;
  } catch (error) {
    throw new FrodoError(`Error enabling journey ${journeyId}`, error);
  }
}

/**
 * Disable a journey
 * @param journeyId journey id/name
 * @returns {Promise<TreeSkeleton>} true if the operation was successful, false otherwise
 */
export async function disableJourney({
  journeyId,
  state,
}: {
  journeyId: string;
  state: State;
}): Promise<TreeSkeleton> {
  try {
    const treeObject = await getTree({ id: journeyId, state });
    treeObject['enabled'] = false;
    delete treeObject._rev;
    const newTreeObject = await putTree({
      treeId: journeyId,
      treeData: treeObject,
      state,
    });
    return newTreeObject;
  } catch (error) {
    throw new FrodoError(`Error disabling journey ${journeyId}`, error);
  }
}
