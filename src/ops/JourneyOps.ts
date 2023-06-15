import State from '../shared/State';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import {
  convertBase64TextToArray,
  getTypedFilename,
  convertTextArrayToBase64,
  convertTextArrayToBase64Url,
  findFilesByName,
  getMetadata,
} from './utils/ExportImportUtils';
import { getRealmManagedUser, replaceAll } from './utils/OpsUtils';
import {
  getNode,
  putNode,
  deleteNode,
  getNodeTypes,
  getNodesByType,
} from '../api/NodeApi';
import { isCloudOnlyNode, isCustomNode, isPremiumNode } from './NodeOps';
import { getTrees, getTree, putTree, deleteTree } from '../api/TreeApi';
import { getEmailTemplate, putEmailTemplate } from './EmailTemplateOps';
import { getScript } from '../api/ScriptApi';
import * as globalConfig from '../storage/StaticStorage';
import {
  printMessage,
  createProgressIndicator,
  updateProgressIndicator,
  stopProgressIndicator,
  debugMessage,
} from './utils/Console';
import {
  getProviderByLocationAndId,
  getProviders,
  getProviderMetadata,
  createProvider,
  findProviders,
  updateProvider,
} from '../api/Saml2Api';
import {
  createCircleOfTrust,
  getCirclesOfTrust,
  updateCircleOfTrust,
} from '../api/CirclesOfTrustApi';
import {
  decode,
  encode,
  encodeBase64Url,
  isBase64Encoded,
} from '../api/utils/Base64';
import {
  getSocialIdentityProviders,
  putProviderByTypeAndId,
} from '../api/SocialIdentityProvidersApi';
import { getThemes, putThemes } from './ThemeOps';
import { putScript } from './ScriptOps';
import {
  InnerNodeRefSkeletonInterface,
  NodeRefSkeletonInterface,
  NodeSkeleton,
  ThemeSkeleton,
  TreeSkeleton,
} from '../api/ApiTypes';
import {
  JourneyClassificationType,
  TreeExportResolverInterface,
  SingleTreeExportInterface,
  MultiTreeExportInterface,
  TreeDependencyMapInterface,
  TreeExportOptions,
  TreeImportOptions,
} from './OpsTypes';

export default class JourneyOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  /**
   * Create an empty single tree export template
   * @returns {SingleTreeExportInterface} an empty single tree export template
   */
  createSingleTreeExportTemplate(): SingleTreeExportInterface {
    return createSingleTreeExportTemplate({ state: this.state });
  }

  /**
   * Create an empty multi tree export template
   * @returns {MultiTreeExportInterface} an empty multi tree export template
   */
  createMultiTreeExportTemplate(): MultiTreeExportInterface {
    return createMultiTreeExportTemplate({ state: this.state });
  }

  /**
   * Create export data for a tree/journey with all its nodes and dependencies. The export data can be written to a file as is.
   * @param {string} treeId tree id/name
   * @param {TreeExportOptions} options export options
   * @returns {Promise<SingleTreeExportInterface>} a promise that resolves to an object containing the tree and all its nodes and dependencies
   */
  async exportJourney(
    treeId: string,
    options: TreeExportOptions = {
      useStringArrays: true,
      deps: true,
    }
  ): Promise<SingleTreeExportInterface> {
    return exportJourney({ treeId, options, state: this.state });
  }

  /**
   * Get all the journeys/trees without all their nodes and dependencies.
   * @returns {Promise<TreeSkeleton[]>} a promise that resolves to an array of journey objects
   */
  async getJourneys(): Promise<TreeSkeleton[]> {
    return getJourneys({ state: this.state });
  }

  /**
   * Get a journey/tree without all its nodes and dependencies.
   * @param {string} journeyId journey id/name
   * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
   */
  async getJourney(journeyId: string): Promise<TreeSkeleton> {
    return getJourney({ journeyId, state: this.state });
  }

  /**
   * Helper to import a tree with all dependencies from a `SingleTreeExportInterface` object (typically read from a file)
   * @param {SingleTreeExportInterface} treeObject tree object containing tree and all its dependencies
   * @param {TreeImportOptions} options import options
   * @returns {Promise<boolean>} a promise that resolves to true if no errors occurred during import
   */
  async importJourney(
    treeObject: SingleTreeExportInterface,
    options: TreeImportOptions
  ): Promise<boolean> {
    return importJourney({ treeObject, options, state: this.state });
  }

  /**
   * Resolve journey dependencies
   * @param {Map} installedJorneys Map of installed journeys
   * @param {Map} journeyMap Map of journeys to resolve dependencies for
   * @param {string[]} unresolvedJourneys Map to hold the names of unresolved journeys and their dependencies
   * @param {string[]} resolvedJourneys Array to hold the names of resolved journeys
   * @param {int} index Depth of recursion
   */
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
  }

  /**
   * Helper to import multiple trees from a tree map
   * @param {MultiTreeExportInterface} treesMap map of trees object
   * @param {TreeImportOptions} options import options
   */
  async importAllJourneys(
    treesMap: MultiTreeExportInterface,
    options: TreeImportOptions
  ) {
    return importAllJourneys({ treesMap, options, state: this.state });
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
  getNodeRef(
    nodeObj: NodeSkeleton,
    singleTreeExport: SingleTreeExportInterface
  ): NodeRefSkeletonInterface | InnerNodeRefSkeletonInterface {
    return getNodeRef(nodeObj, singleTreeExport);
  }

  /**
   * Default tree export resolver used to resolve a tree id/name to a full export
   * w/o dependencies of that tree from a platform instance.
   * @param {string} treeId id/name of the tree to resolve
   * @returns {TreeExportResolverInterface} tree export
   */
  onlineTreeExportResolver: TreeExportResolverInterface =
    onlineTreeExportResolver;

  /**
   * Tree export resolver used to resolve a tree id/name to a full export
   * of that tree from individual `treename.journey.json` export files.
   * @param {string} treeId id/name of the tree to resolve
   * @returns {TreeExportResolverInterface} tree export
   */
  fileByIdTreeExportResolver: TreeExportResolverInterface =
    fileByIdTreeExportResolver;

  /**
   * Factory that creates a tree export resolver used to resolve a tree id
   * to a full export of that tree from a multi-tree export file.
   * @param {string} file multi-tree export file
   * @returns {TreeExportResolverInterface} tree export resolver
   */
  createFileParamTreeExportResolver(file: string): TreeExportResolverInterface {
    return createFileParamTreeExportResolver(file, this.state);
  }

  /**
   * Get tree dependencies (all descendent inner trees)
   * @param {SingleTreeExportInterface} treeExport single tree export
   * @param {string[]} resolvedTreeIds list of tree ids wich have already been resolved
   * @param {TreeExportResolverInterface} resolveTreeExport tree export resolver callback function
   * @returns {Promise<TreeDependencyMapInterface>} a promise that resolves to a tree dependency map
   */
  async getTreeDescendents(
    treeExport: SingleTreeExportInterface,
    resolveTreeExport: TreeExportResolverInterface,
    resolvedTreeIds: string[] = []
  ): Promise<TreeDependencyMapInterface> {
    return getTreeDescendents({
      treeExport,
      resolveTreeExport,
      resolvedTreeIds,
      state: this.state,
    });
  }

  /**
   * Find all node configuration objects that are no longer referenced by any tree
   * @returns {Promise<unknown[]>} a promise that resolves to an array of orphaned nodes
   */
  async findOrphanedNodes(): Promise<NodeSkeleton[]> {
    return findOrphanedNodes({ state: this.state });
  }

  /**
   * Remove orphaned nodes
   * @param {NodeSkeleton[]} orphanedNodes Pass in an array of orphaned node configuration objects to remove
   * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an array nodes that encountered errors deleting
   */
  async removeOrphanedNodes(orphanedNodes: NodeSkeleton[]): Promise<unknown[]> {
    return removeOrphanedNodes({ orphanedNodes, state: this.state });
  }

  /**
   * Analyze if a journey contains any custom nodes considering the detected or the overridden version.
   * @param {SingleTreeExportInterface} journey Journey/tree configuration object
   * @returns {boolean} True if the journey/tree contains any custom nodes, false otherwise.
   */
  isCustomJourney(journey: SingleTreeExportInterface) {
    return isCustomJourney({ journey, state: this.state });
  }

  /**
   * Analyze if a journey contains any premium nodes considering the detected or the overridden version.
   * @param {SingleTreeExportInterface} journey Journey/tree configuration object
   * @returns {boolean} True if the journey/tree contains any custom nodes, false otherwise.
   */
  isPremiumJourney(journey: SingleTreeExportInterface) {
    return isPremiumJourney(journey);
  }

  /**
   * Analyze if a journey contains any cloud-only nodes considering the detected or the overridden version.
   * @param {SingleTreeExportInterface} journey Journey/tree configuration object
   * @returns {boolean} True if the journey/tree contains any cloud-only nodes, false otherwise.
   */
  isCloudOnlyJourney(journey: SingleTreeExportInterface) {
    return isCloudOnlyJourney(journey);
  }

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
  ): JourneyClassificationType[] {
    return getJourneyClassification({ journey, state: this.state });
  }

  /**
   * Delete a journey
   * @param {string} journeyId journey id/name
   * @param {Object} options deep=true also delete all the nodes and inner nodes, verbose=true print verbose info
   */
  async deleteJourney(
    journeyId: string,
    options: { deep: boolean; verbose: boolean; progress?: boolean }
  ) {
    return deleteJourney({ journeyId, options, state: this.state });
  }

  /**
   * Delete all journeys
   * @param {Object} options deep=true also delete all the nodes and inner nodes, verbose=true print verbose info
   */
  async deleteJourneys(options: { deep: boolean; verbose: boolean }) {
    return deleteJourneys({ options, state: this.state });
  }

  /**
   * Enable a journey
   * @param journeyId journey id/name
   * @returns {Promise<boolean>} true if the operation was successful, false otherwise
   */
  async enableJourney(journeyId: string): Promise<boolean> {
    return enableJourney({ journeyId, state: this.state });
  }

  /**
   * Disable a journey
   * @param journeyId journey id/name
   * @returns {Promise<boolean>} true if the operation was successful, false otherwise
   */
  async disableJourney(journeyId: string): Promise<boolean> {
    return disableJourney({ journeyId, state: this.state });
  }
}

export enum JourneyClassification {
  STANDARD = 'standard',
  CUSTOM = 'custom',
  CLOUD = 'cloud',
  PREMIUM = 'premium',
}

const containerNodes = ['PageNode', 'CustomPageNode'];

const scriptedNodes = [
  'ConfigProviderNode',
  'ScriptedDecisionNode',
  'ClientScriptNode',
  'SocialProviderHandlerNode',
  'CustomScriptNode',
];

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
 * Helper to get all SAML2 dependencies for a given node object
 * @param {Object} nodeObject node object
 * @param {[Object]} allProviders array of all saml2 providers objects
 * @param {[Object]} allCirclesOfTrust array of all circle of trust objects
 * @returns {Promise} a promise that resolves to an object containing a saml2 dependencies
 */
async function getSaml2NodeDependencies(
  nodeObject,
  allProviders,
  allCirclesOfTrust,
  state: State
) {
  const samlProperties = ['metaAlias', 'idpEntityId'];
  const saml2EntityPromises = [];
  for (const samlProperty of samlProperties) {
    // In the following line nodeObject[samlProperty] will look like '/alpha/iSPAzure'.
    const entityId =
      samlProperty === 'metaAlias'
        ? _.last(nodeObject[samlProperty].split('/'))
        : nodeObject[samlProperty];
    const entity = _.find(allProviders, { entityId });
    if (entity) {
      try {
        const providerResponse = await getProviderByLocationAndId({
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
        printMessage({ message: error.message, type: 'error', state });
      }
    }
  }
  try {
    const saml2EntitiesPromisesResults = await Promise.all(saml2EntityPromises);
    const saml2Entities = [];
    for (const saml2Entity of saml2EntitiesPromisesResults) {
      if (saml2Entity) {
        saml2Entities.push(saml2Entity);
      }
    }
    const samlEntityIds = _.map(
      saml2Entities,
      (saml2EntityConfig) => `${saml2EntityConfig.entityId}|saml2`
    );
    const circlesOfTrust = _.filter(allCirclesOfTrust, (circleOfTrust) => {
      let hasEntityId = false;
      for (const trustedProvider of circleOfTrust.trustedProviders) {
        if (!hasEntityId && samlEntityIds.includes(trustedProvider)) {
          hasEntityId = true;
        }
      }
      return hasEntityId;
    });
    const saml2NodeDependencies = {
      saml2Entities,
      circlesOfTrust,
    };
    return saml2NodeDependencies;
  } catch (error) {
    printMessage({ message: error.message, type: 'error', state });
    const saml2NodeDependencies = {
      saml2Entities: [],
      circlesOfTrust: [],
    };
    return saml2NodeDependencies;
  }
}

/**
 * Create export data for a tree/journey with all its nodes and dependencies. The export data can be written to a file as is.
 * @param {string} treeId tree id/name
 * @param {TreeExportOptions} options export options
 * @returns {Promise<SingleTreeExportInterface>} a promise that resolves to an object containing the tree and all its nodes and dependencies
 */
export async function exportJourney({
  treeId,
  options = {
    useStringArrays: true,
    deps: true,
  },
  state,
}: {
  treeId: string;
  options?: TreeExportOptions;
  state: State;
}): Promise<SingleTreeExportInterface> {
  const exportData = createSingleTreeExportTemplate({ state });
  try {
    const treeObject = await getTree({ id: treeId, state });
    const { useStringArrays, deps } = options;
    const verbose = state.getDebug();

    if (verbose)
      printMessage({
        message: `\n- ${treeObject._id}\n`,
        type: 'info',
        newline: false,
        state,
      });

    // Process tree
    if (verbose) printMessage({ message: '  - Flow', state });
    exportData.tree = treeObject;
    if (verbose && treeObject.identityResource)
      printMessage({
        message: `    - identityResource: ${treeObject.identityResource}`,
        state,
        type: 'info',
      });
    if (verbose) printMessage({ message: `    - Done`, type: 'info', state });

    const nodePromises = [];
    const scriptPromises = [];
    const emailTemplatePromises = [];
    const innerNodePromises = [];
    const saml2ConfigPromises = [];
    let socialProviderPromise = null;
    let themePromise = null;
    if (
      deps &&
      state.getDeploymentType() !== globalConfig.CLASSIC_DEPLOYMENT_TYPE_KEY
    ) {
      try {
        themePromise = getThemes({ state });
      } catch (error) {
        printMessage({ message: error, type: 'error', state });
      }
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
    }
    if (verbose && nodePromises.length > 0)
      printMessage({ message: '  - Nodes:', state });
    const nodeObjects = await Promise.all(nodePromises);

    // iterate over every node in tree
    for (const nodeObject of nodeObjects) {
      const nodeId = nodeObject._id;
      const nodeType = nodeObject._type._id;
      if (verbose)
        printMessage({
          message: `    - ${nodeId} (${nodeType})`,
          type: 'info',
          newline: true,
          state,
        });
      exportData.nodes[nodeObject._id] = nodeObject;

      // handle script node types
      if (
        deps &&
        scriptedNodes.includes(nodeType) &&
        nodeObject.script !== emptyScriptPlaceholder
      ) {
        scriptPromises.push(getScript({ scriptId: nodeObject.script, state }));
      }

      // frodo supports email templates in platform deployments
      if (
        (deps &&
          state.getDeploymentType() ===
            globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY) ||
        state.getDeploymentType() === globalConfig.FORGEOPS_DEPLOYMENT_TYPE_KEY
      ) {
        if (emailTemplateNodes.includes(nodeType)) {
          try {
            const emailTemplate = await getEmailTemplate({
              templateId: nodeObject.emailTemplateName,
              state,
            });
            emailTemplatePromises.push(emailTemplate);
          } catch (error) {
            let message = `${error}`;
            if (error.isAxiosError && error.response.status) {
              message = error.response.statusText;
            }
            printMessage({
              message: `\n${message}: Email Template "${nodeObject.emailTemplateName}"`,
              type: 'error',
              state,
            });
          }
        }
      }

      // handle SAML2 node dependencies
      if (deps && nodeType === 'product-Saml2Node') {
        if (!allSaml2Providers) {
          // eslint-disable-next-line no-await-in-loop
          allSaml2Providers = (await getProviders({ state })).result;
        }
        if (!allCirclesOfTrust) {
          // eslint-disable-next-line no-await-in-loop
          allCirclesOfTrust = (await getCirclesOfTrust({ state })).result;
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
        if (
          (deps &&
            state.getDeploymentType() ===
              globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY) ||
          state.getDeploymentType() ===
            globalConfig.FORGEOPS_DEPLOYMENT_TYPE_KEY
        ) {
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
      printMessage({ message: '  - Inner nodes:', state });
    const innerNodeDataResults = await Promise.all(innerNodePromises);
    for (const innerNodeObject of innerNodeDataResults) {
      const innerNodeId = innerNodeObject._id;
      const innerNodeType = innerNodeObject._type._id;
      if (verbose)
        printMessage({
          message: `    - ${innerNodeId} (${innerNodeType})`,
          type: 'info',
          newline: true,
          state,
        });
      exportData.innerNodes[innerNodeId] = innerNodeObject;

      // handle script node types
      if (deps && scriptedNodes.includes(innerNodeType)) {
        scriptPromises.push(
          getScript({ scriptId: innerNodeObject.script, state })
        );
      }

      // frodo supports email templates in platform deployments
      if (
        (deps &&
          state.getDeploymentType() ===
            globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY) ||
        state.getDeploymentType() === globalConfig.FORGEOPS_DEPLOYMENT_TYPE_KEY
      ) {
        if (emailTemplateNodes.includes(innerNodeType)) {
          try {
            const emailTemplate = await getEmailTemplate({
              templateId: innerNodeObject.emailTemplateName,
              state,
            });
            emailTemplatePromises.push(emailTemplate);
          } catch (error) {
            let message = `${error}`;
            if (error.isAxiosError && error.response.status) {
              message = error.response.statusText;
            }
            printMessage({
              message: `\n${message}: Email Template "${innerNodeObject.emailTemplateName}"`,
              type: 'error',
              state,
            });
          }
        }
      }

      // handle SAML2 node dependencies
      if (deps && innerNodeType === 'product-Saml2Node') {
        printMessage({ message: 'SAML2 inner node', type: 'error', state });
        if (!allSaml2Providers) {
          // eslint-disable-next-line no-await-in-loop
          allSaml2Providers = (await getProviders({ state })).result;
        }
        if (!allCirclesOfTrust) {
          // eslint-disable-next-line no-await-in-loop
          allCirclesOfTrust = (await getCirclesOfTrust({ state })).result;
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
    }

    // Process email templates
    if (verbose && emailTemplatePromises.length > 0)
      printMessage({ message: '  - Email templates:', state });
    const settledEmailTemplatePromises = await Promise.allSettled(
      emailTemplatePromises
    );
    for (const settledPromise of settledEmailTemplatePromises) {
      if (settledPromise.status === 'fulfilled' && settledPromise.value) {
        if (verbose)
          printMessage({
            message: `    - ${settledPromise.value._id.split('/')[1]}${
              settledPromise.value.displayName
                ? ` (${settledPromise.value.displayName})`
                : ''
            }`,
            type: 'info',
            newline: true,
            state,
          });
        exportData.emailTemplates[settledPromise.value._id.split('/')[1]] =
          settledPromise.value;
      }
    }

    // Process SAML2 providers and circles of trust
    const saml2NodeDependencies = await Promise.all(saml2ConfigPromises);
    for (const saml2NodeDependency of saml2NodeDependencies) {
      if (saml2NodeDependency) {
        if (verbose)
          printMessage({ message: '  - SAML2 entity providers:', state });
        for (const saml2Entity of saml2NodeDependency.saml2Entities) {
          if (verbose)
            printMessage({
              message: `    - ${saml2Entity.entityLocation} ${saml2Entity.entityId}`,
              type: 'info',
              state,
            });
          exportData.saml2Entities[saml2Entity._id] = saml2Entity;
        }
        if (verbose)
          printMessage({ message: '  - SAML2 circles of trust:', state });
        for (const circleOfTrust of saml2NodeDependency.circlesOfTrust) {
          if (verbose)
            printMessage({
              message: `    - ${circleOfTrust._id}`,
              type: 'info',
              state,
            });
          exportData.circlesOfTrust[circleOfTrust._id] = circleOfTrust;
        }
      }
    }

    // Process socialIdentityProviders
    const socialProviders = await Promise.resolve(socialProviderPromise);
    if (socialProviders) {
      if (verbose)
        printMessage({
          message: '  - OAuth2/OIDC (social) identity providers:',
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
              message: `    - ${socialProvider._id}`,
              type: 'info',
              state,
            });
          scriptPromises.push(
            getScript({ scriptId: socialProvider.transform, state })
          );
          exportData.socialIdentityProviders[socialProvider._id] =
            socialProvider;
        }
      }
    }

    // Process scripts
    if (verbose && scriptPromises.length > 0)
      printMessage({ message: '  - Scripts:', state });
    const scriptObjects = await Promise.all(scriptPromises);
    for (const scriptObject of scriptObjects) {
      if (scriptObject) {
        if (verbose)
          printMessage({
            message: `    - ${scriptObject._id} (${scriptObject.name})`,
            type: 'info',
            newline: true,
            state,
          });
        scriptObject.script = useStringArrays
          ? convertBase64TextToArray(scriptObject.script)
          : JSON.stringify(decode(scriptObject.script));
        exportData.scripts[scriptObject._id] = scriptObject;
      }
    }

    // Process themes
    if (themePromise) {
      if (verbose) printMessage({ message: '  - Themes:', state });
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
                message: `    - ${themeObject._id} (${themeObject.name})`,
                type: 'info',
                state,
              });
            exportData.themes.push(themeObject);
          }
        }
      } catch (error) {
        printMessage({ message: error.response.data, type: 'error', state });
        printMessage({
          message: 'Error handling themes: ' + error.message,
          type: 'error',
          state,
        });
      }
    }
  } catch (error) {
    printMessage({ message: error.response.data, type: 'error', state });
    printMessage({
      message: 'Error exporting tree: ' + treeId + ' - ' + error.message,
      type: 'error',
      state,
    });
  }

  return exportData;
}

/**
 * Get all the journeys/trees without all their nodes and dependencies.
 * @returns {Promise<TreeSkeleton[]>} a promise that resolves to an array of journey objects
 */
export async function getJourneys({
  state,
}: {
  state: State;
}): Promise<TreeSkeleton[]> {
  const { result } = await getTrees({ state });
  result.sort((a, b) => a._id.localeCompare(b._id));
  return result;
}

/**
 * Get a journey/tree without all its nodes and dependencies.
 * @param {string} journeyId journey id/name
 * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
 */
export async function getJourney({
  journeyId,
  state,
}: {
  journeyId: string;
  state: State;
}): Promise<TreeSkeleton> {
  const response = await getTree({ id: journeyId, state });
  return response;
}

/**
 * Helper to import a tree with all dependencies from a `SingleTreeExportInterface` object (typically read from a file)
 * @param {SingleTreeExportInterface} treeObject tree object containing tree and all its dependencies
 * @param {TreeImportOptions} options import options
 * @returns {Promise<boolean>} a promise that resolves to true if no errors occurred during import
 */
export async function importJourney({
  treeObject,
  options,
  state,
}: {
  treeObject: SingleTreeExportInterface;
  options: TreeImportOptions;
  state: State;
}): Promise<boolean> {
  const { reUuid, deps } = options;
  const verbose = state.getDebug();
  if (verbose)
    printMessage({
      message: `\n- ${treeObject.tree._id}\n`,
      type: 'info',
      newline: false,
      state,
    });
  let newUuid = '';
  const uuidMap = {};
  const treeId = treeObject.tree._id;

  // Process scripts
  if (
    deps &&
    treeObject.scripts &&
    Object.entries(treeObject.scripts).length > 0
  ) {
    if (verbose) printMessage({ message: '  - Scripts:', state });
    for (const [scriptId, scriptObject] of Object.entries(treeObject.scripts)) {
      if (verbose)
        printMessage({
          message: `    - ${scriptId} (${scriptObject['name']})`,
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
        scriptObject['script'] = encode(JSON.parse(scriptObject['script']));
      }
      try {
        await putScript({ scriptId, scriptData: scriptObject, state });
      } catch (error) {
        throw new Error(
          `Error importing script ${scriptObject['name']} (${scriptId}) in journey ${treeId}: ${error.message}`
        );
      }
      if (verbose) printMessage({ message: '', state });
    }
  }

  // Process email templates
  if (
    deps &&
    treeObject.emailTemplates &&
    Object.entries(treeObject.emailTemplates).length > 0
  ) {
    if (verbose) printMessage({ message: '  - Email templates:', state });
    for (const [templateId, templateData] of Object.entries(
      treeObject.emailTemplates
    )) {
      if (verbose)
        printMessage({
          message: `    - ${templateId}`,
          type: 'info',
          newline: false,
          state,
        });
      try {
        await putEmailTemplate({ templateId, templateData, state });
      } catch (error) {
        printMessage({ message: error.response.data, type: 'error', state });
        throw new Error(`Error importing email templates: ${error.message}`);
      }
      if (verbose) printMessage({ message: '', state });
    }
  }

  // Process themes
  if (deps && treeObject.themes && treeObject.themes.length > 0) {
    if (verbose) printMessage({ message: '  - Themes:', state });
    const themes: Map<string, ThemeSkeleton> = new Map<string, ThemeSkeleton>();
    for (const theme of treeObject.themes) {
      if (verbose)
        printMessage({
          message: `    - ${theme['_id']} (${theme['name']})`,
          type: 'info',
          state,
        });
      themes[theme['_id']] = theme;
    }
    try {
      await putThemes({ themeMap: themes, state });
    } catch (error) {
      throw new Error(`Error importing themes: ${error.message}`);
    }
  }

  // Process social providers
  if (
    deps &&
    treeObject.socialIdentityProviders &&
    Object.entries(treeObject.socialIdentityProviders).length > 0
  ) {
    if (verbose)
      printMessage({
        message: '  - OAuth2/OIDC (social) identity providers:',
        state,
      });
    for (const [providerId, providerData] of Object.entries(
      treeObject.socialIdentityProviders
    )) {
      if (verbose)
        printMessage({ message: `    - ${providerId}`, type: 'info', state });
      try {
        await putProviderByTypeAndId({
          type: providerData['_type']['_id'],
          id: providerId,
          providerData,
          state,
        });
      } catch (importError) {
        if (
          importError.response?.status === 500 &&
          importError.response?.data?.message ===
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
            printMessage({
              message: importError.response?.data || importError,
              type: 'error',
              state,
            });
            throw new Error(
              `Error importing provider ${providerId} in journey ${treeId}: ${importError}`
            );
          }
        } else {
          printMessage({
            message: importError.response?.data || importError,
            type: 'error',
            state,
          });
          throw new Error(
            `\nError importing provider ${providerId} in journey ${treeId}: ${importError}`
          );
        }
      }
    }
  }

  // Process saml providers
  if (
    deps &&
    treeObject.saml2Entities &&
    Object.entries(treeObject.saml2Entities).length > 0
  ) {
    if (verbose)
      printMessage({ message: '  - SAML2 entity providers:', state });
    for (const [, providerData] of Object.entries(treeObject.saml2Entities)) {
      delete providerData['_rev'];
      const entityId = providerData['entityId'];
      const entityLocation = providerData['entityLocation'];
      if (verbose)
        printMessage({
          message: `    - ${entityLocation} ${entityId}`,
          type: 'info',
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
          await findProviders({
            filter: `entityId eq '${entityId}'`,
            fields: ['location'],
            state,
          })
        ).resultCount === 0
      ) {
        await createProvider({
          location: entityLocation,
          providerData,
          metaData,
          state,
        }).catch((createProviderErr) => {
          printMessage({
            message: createProviderErr.response?.data || createProviderErr,
            type: 'error',
            state,
          });
          throw new Error(`Error creating provider ${entityId}`);
        });
      } else {
        await updateProvider({
          location: entityLocation,
          providerData,
          state,
        }).catch((updateProviderErr) => {
          printMessage({
            message: updateProviderErr.response?.data || updateProviderErr,
            type: 'error',
            state,
          });
          throw new Error(`Error updating provider ${entityId}`);
        });
      }
    }
  }

  // Process circles of trust
  if (
    deps &&
    treeObject.circlesOfTrust &&
    Object.entries(treeObject.circlesOfTrust).length > 0
  ) {
    if (verbose)
      printMessage({ message: '  - SAML2 circles of trust:', state });
    for (const [cotId, cotData] of Object.entries(treeObject.circlesOfTrust)) {
      delete cotData['_rev'];
      if (verbose)
        printMessage({ message: `    - ${cotId}`, type: 'info', state });
      try {
        await createCircleOfTrust({ cotData, state });
      } catch (createCotErr) {
        if (
          createCotErr.response?.status === 409 ||
          createCotErr.response?.status === 500
        ) {
          try {
            await updateCircleOfTrust({ cotId, cotData, state });
          } catch (updateCotErr) {
            printMessage({
              message: createCotErr.response?.data || createCotErr,
              type: 'error',
              state,
            });
            printMessage({
              message: updateCotErr.response?.data || updateCotErr,
              type: 'error',
              state,
            });
            throw new Error(`Error creating/updating circle of trust ${cotId}`);
          }
        } else {
          printMessage({
            message: createCotErr.response?.data || createCotErr,
            type: 'error',
            state,
          });
          throw new Error(`Error creating circle of trust ${cotId}`);
        }
      }
    }
  }

  // Process inner nodes
  let innerNodes = {};
  if (
    treeObject.innerNodes &&
    Object.entries(treeObject.innerNodes).length > 0
  ) {
    innerNodes = treeObject.innerNodes;
  }
  // old export file format
  else if (
    treeObject.innernodes &&
    Object.entries(treeObject.innernodes).length > 0
  ) {
    innerNodes = treeObject.innernodes;
  }
  if (Object.entries(innerNodes).length > 0) {
    if (verbose)
      printMessage({
        message: '  - Inner nodes:',
        type: 'text',
        newline: true,
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
          message: `    - ${newUuid}${reUuid ? '*' : ''} (${nodeType})`,
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
        innerNodeData['identityResource'] === treeObject.tree.identityResource
      ) {
        innerNodeData['identityResource'] = `managed/${getRealmManagedUser({
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
      try {
        await putNode({
          nodeId: newUuid,
          nodeType,
          nodeData: innerNodeData as NodeSkeleton,
          state,
        });
      } catch (nodeImportError) {
        if (
          nodeImportError.response.status === 400 &&
          nodeImportError.response.data.message ===
            'Data validation failed for the attribute, Script'
        ) {
          throw new Error(
            `Missing script ${
              innerNodeData['script']
            } referenced by inner node ${innerNodeId}${
              innerNodeId === newUuid ? '' : ` [${newUuid}]`
            } (${innerNodeData['_type']['_id']}) in journey ${treeId}.`
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
            printMessage({
              message: nodeImportError2.response.data,
              type: 'error',
              state,
            });
            throw new Error(
              `Error importing node ${innerNodeId}${
                innerNodeId === newUuid ? '' : ` [${newUuid}]`
              } in journey ${treeId}`
            );
          }
        } else {
          printMessage({
            message: nodeImportError.response.data,
            type: 'error',
            state,
          });
          throw new Error(
            `Error importing inner node ${innerNodeId}${
              innerNodeId === newUuid ? '' : ` [${newUuid}]`
            } in journey ${treeId}`
          );
        }
      }
      if (verbose) printMessage({ message: '', state });
    }
  }

  // Process nodes
  if (treeObject.nodes && Object.entries(treeObject.nodes).length > 0) {
    if (verbose) printMessage({ message: '  - Nodes:', state });
    // eslint-disable-next-line prefer-const
    for (let [nodeId, nodeData] of Object.entries(treeObject.nodes)) {
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
            replaceAll(JSON.stringify(nodeData), currentId, uuidMap[currentId])
          );
        }
      }

      if (verbose)
        printMessage({
          message: `    - ${newUuid}${reUuid ? '*' : ''} (${nodeType})`,
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
        nodeData.identityResource === treeObject.tree.identityResource
      ) {
        nodeData['identityResource'] = `managed/${getRealmManagedUser({
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
      try {
        await putNode({ nodeId: newUuid, nodeType, nodeData, state });
      } catch (nodeImportError) {
        if (
          nodeImportError.response.status === 400 &&
          nodeImportError.response.data.message ===
            'Data validation failed for the attribute, Script'
        ) {
          throw new Error(
            `Missing script ${nodeData['script']} referenced by node ${nodeId}${
              nodeId === newUuid ? '' : ` [${newUuid}]`
            } (${nodeData['_type']['_id']}) in journey ${treeId}.`
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
            printMessage({
              message: nodeImportError2.response.data,
              type: 'error',
              state,
            });
            throw new Error(
              `Error importing node ${nodeId}${
                nodeId === newUuid ? '' : ` [${newUuid}]`
              } in journey ${treeId}`
            );
          }
        } else {
          printMessage({
            message: nodeImportError.response.data,
            type: 'error',
            state,
          });
          throw new Error(
            `Error importing node ${nodeId}${
              nodeId === newUuid ? '' : ` [${newUuid}]`
            } in journey ${treeId}`
          );
        }
      }
      if (verbose) printMessage({ message: '', state });
    }
  }

  // Process tree
  if (verbose) printMessage({ message: '  - Flow', state });

  if (reUuid) {
    let journeyText = JSON.stringify(treeObject.tree, null, 2);
    for (const [oldId, newId] of Object.entries(uuidMap)) {
      journeyText = replaceAll(journeyText, oldId, newId);
    }
    treeObject.tree = JSON.parse(journeyText);
  }

  // If the tree has an identityResource config setting
  // and the identityResource ends in 'user'
  // Set the identityResource for the tree to the selected resource.
  if (
    (treeObject.tree.identityResource &&
      (treeObject.tree['identityResource'] as string).endsWith('user')) ||
    state.getDeploymentType() === globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY ||
    state.getDeploymentType() === globalConfig.FORGEOPS_DEPLOYMENT_TYPE_KEY
  ) {
    treeObject.tree.identityResource = `managed/${getRealmManagedUser({
      state,
    })}`;
    if (verbose)
      printMessage({
        message: `    - identityResource: ${treeObject.tree.identityResource}`,
        type: 'info',
        newline: false,
        state,
      });
  }

  delete treeObject.tree._rev;
  try {
    await putTree({
      treeId: treeObject.tree._id as string,
      treeData: treeObject.tree,
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
      for (const attribute of Object.keys(treeObject.tree)) {
        if (!validAttributes.includes(attribute)) {
          if (verbose)
            printMessage({
              message: `\n    - Removing invalid attribute: ${attribute}`,
              type: 'warn',
              newline: false,
              state,
            });
          delete treeObject.tree[attribute];
        }
      }
      try {
        await putTree({
          treeId: treeObject.tree._id as string,
          treeData: treeObject.tree,
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
        printMessage({
          message: importError2.response.data,
          type: 'error',
          state,
        });
        throw new Error(`Error importing journey flow ${treeId}`);
      }
    } else {
      printMessage({
        message: importError.response?.data || importError,
        type: 'error',
        state,
      });
      debugMessage({
        message: importError.response?.data || importError,
        state,
      });
      throw new Error(`\nError importing journey flow ${treeId}`);
    }
  }
  return true;
}

/**
 * Resolve journey dependencies
 * @param {Map} installedJorneys Map of installed journeys
 * @param {Map} journeyMap Map of journeys to resolve dependencies for
 * @param {[String]} unresolvedJourneys Map to hold the names of unresolved journeys and their dependencies
 * @param {[String]} resolvedJourneys Array to hold the names of resolved journeys
 * @param {int} index Depth of recursion
 */
export async function resolveDependencies(
  installedJorneys,
  journeyMap,
  unresolvedJourneys,
  resolvedJourneys,
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
 * Helper to import multiple trees from a tree map
 * @param {Object} treesMap map of trees object
 * @param {TreeImportOptions} options import options
 */
export async function importAllJourneys({
  treesMap,
  options,
  state,
}: {
  treesMap: MultiTreeExportInterface;
  options: TreeImportOptions;
  state: State;
}) {
  const installedJourneys = (await getTrees({ state })).result.map(
    (x) => x._id
  );
  const unresolvedJourneys = {};
  const resolvedJourneys = [];
  createProgressIndicator({
    total: undefined,
    message: 'Resolving dependencies',
    type: 'indeterminate',
    state,
  });
  await resolveDependencies(
    installedJourneys,
    treesMap,
    unresolvedJourneys,
    resolvedJourneys
  );
  if (Object.keys(unresolvedJourneys).length === 0) {
    stopProgressIndicator({
      message: `Resolved all dependencies.`,
      status: 'success',
      state,
    });
  } else {
    stopProgressIndicator({
      message: `${
        Object.keys(unresolvedJourneys).length
      } journeys with unresolved dependencies:`,
      status: 'fail',
      state,
    });
    for (const journey of Object.keys(unresolvedJourneys)) {
      printMessage({
        message: `  - ${journey} requires ${unresolvedJourneys[journey]}`,
        type: 'info',
        state,
      });
    }
  }
  createProgressIndicator({
    total: resolvedJourneys.length,
    message: 'Importing',
    state,
  });
  for (const tree of resolvedJourneys) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await importJourney({ treeObject: treesMap[tree], options, state });
      updateProgressIndicator({ message: `${tree}`, state });
    } catch (error) {
      printMessage({ message: `\n${error.message}`, type: 'error', state });
    }
  }
  stopProgressIndicator({ message: 'Done', state });
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
      treeId,
      options: {
        deps: false,
        useStringArrays: false,
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
  async function (treeId: string, state: State) {
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
      debugMessage({
        message: `fileByIdTreeExportResolver: unable to resolve '${treeId}' to a file.`,
        state,
      });
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
        //
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
  debugMessage({
    message: `getTreeDependencies(${
      treeExport.tree._id
    }, [${resolvedTreeIds.join(', ')}])`,
    state,
  });
  if (!resolvedTreeIds.includes(treeExport.tree._id)) {
    resolvedTreeIds.push(treeExport.tree._id);
  }
  const treeDependencyMap: TreeDependencyMapInterface = {
    [treeExport.tree._id]: [],
  };
  const dependencies: TreeDependencyMapInterface[] = [];
  for (const [nodeId, node] of Object.entries(treeExport.tree.nodes)) {
    const innerTreeId = treeExport.nodes[nodeId].tree;
    if (
      node.nodeType === 'InnerTreeEvaluatorNode' &&
      !resolvedTreeIds.includes(innerTreeId)
    ) {
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
  treeDependencyMap[treeExport.tree._id] = dependencies;
  return treeDependencyMap;
}

/**
 * Find all node configuration objects that are no longer referenced by any tree
 * @returns {Promise<unknown[]>} a promise that resolves to an array of orphaned nodes
 */
export async function findOrphanedNodes({
  state,
}: {
  state: State;
}): Promise<NodeSkeleton[]> {
  const allNodes = [];
  const orphanedNodes = [];
  let types = [];
  const allJourneys = (await getTrees({ state })).result;
  let errorMessage = '';
  const errorTypes = [];

  createProgressIndicator({
    total: undefined,
    message: `Counting total nodes...`,
    type: 'indeterminate',
    state,
  });
  try {
    types = (await getNodeTypes({ state })).result;
  } catch (error) {
    printMessage({
      message: 'Error retrieving all available node types:',
      type: 'error',
      state,
    });
    printMessage({ message: error.response.data, type: 'error', state });
    return [];
  }
  for (const type of types) {
    try {
      // eslint-disable-next-line no-await-in-loop, no-loop-func
      const nodes = (await getNodesByType({ nodeType: type._id, state }))
        .result;
      for (const node of nodes) {
        allNodes.push(node);
        updateProgressIndicator({
          message: `${allNodes.length} total nodes${errorMessage}`,
          state,
        });
      }
    } catch (error) {
      errorTypes.push(type._id);
      errorMessage = ` (Skipped type(s): ${errorTypes})`['yellow'];
      updateProgressIndicator({
        message: `${allNodes.length} total nodes${errorMessage}`,
        state,
      });
    }
  }
  if (errorTypes.length > 0) {
    stopProgressIndicator({
      message: `${allNodes.length} total nodes${errorMessage}`,
      state,
      status: 'warn',
    });
  } else {
    stopProgressIndicator({
      message: `${allNodes.length} total nodes`,
      status: 'success',
      state,
    });
  }

  createProgressIndicator({
    total: undefined,
    message: 'Counting active nodes...',
    type: 'indeterminate',
    state,
  });
  const activeNodes = [];
  for (const journey of allJourneys) {
    for (const nodeId in journey.nodes) {
      if ({}.hasOwnProperty.call(journey.nodes, nodeId)) {
        activeNodes.push(nodeId);
        updateProgressIndicator({
          message: `${activeNodes.length} active nodes`,
          state,
        });
        const node = journey.nodes[nodeId];
        if (containerNodes.includes(node.nodeType)) {
          const containerNode = await getNode({
            nodeId,
            nodeType: node.nodeType,
            state,
          });
          for (const innerNode of containerNode.nodes) {
            activeNodes.push(innerNode._id);
            updateProgressIndicator({
              message: `${activeNodes.length} active nodes`,
              state,
            });
          }
        }
      }
    }
  }
  stopProgressIndicator({
    message: `${activeNodes.length} active nodes`,
    status: 'success',
    state,
  });

  createProgressIndicator({
    total: undefined,
    message: 'Calculating orphaned nodes...',
    type: 'indeterminate',
    state,
  });
  const diff = allNodes.filter((x) => !activeNodes.includes(x._id));
  for (const orphanedNode of diff) {
    orphanedNodes.push(orphanedNode);
  }
  stopProgressIndicator({
    message: `${orphanedNodes.length} orphaned nodes`,
    status: 'success',
    state,
  });
  return orphanedNodes;
}

/**
 * Remove orphaned nodes
 * @param {NodeSkeleton[]} orphanedNodes Pass in an array of orphaned node configuration objects to remove
 * @returns {Promise<NodeSkeleton[]>} a promise that resolves to an array nodes that encountered errors deleting
 */
export async function removeOrphanedNodes({
  orphanedNodes,
  state,
}: {
  orphanedNodes: NodeSkeleton[];
  state: State;
}): Promise<NodeSkeleton[]> {
  const errorNodes = [];
  createProgressIndicator({
    total: orphanedNodes.length,
    message: 'Removing orphaned nodes...',
    state,
  });
  for (const node of orphanedNodes) {
    updateProgressIndicator({ message: `Removing ${node['_id']}...`, state });
    try {
      // eslint-disable-next-line no-await-in-loop
      await deleteNode({
        nodeId: node['_id'],
        nodeType: node['_type']['_id'],
        state,
      });
    } catch (deleteError) {
      errorNodes.push(node);
      printMessage({ message: ` ${deleteError}`, type: 'error', state });
    }
  }
  stopProgressIndicator({
    message: `Removed ${orphanedNodes.length} orphaned nodes.`,
    state,
  });
  return errorNodes;
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
}) {
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
export function isPremiumJourney(journey: SingleTreeExportInterface) {
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
export function isCloudOnlyJourney(journey: SingleTreeExportInterface) {
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
}) {
  const { deep, verbose } = options;
  const progress = !('progress' in options) ? true : options.progress;
  const status = { nodes: {} };
  if (progress)
    createProgressIndicator({
      total: undefined,
      message: `Deleting ${journeyId}...`,
      type: 'indeterminate',
      state,
    });
  if (progress && verbose) stopProgressIndicator({ state });
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
              // eslint-disable-next-line no-await-in-loop
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
            message: `Deleted ${journeyId} and ${
              nodeCount - errorCount
            }/${nodeCount} nodes.`,
            status: 'success',
            state,
          });
        } else {
          stopProgressIndicator({
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
  const { verbose } = options;
  const status = {};
  const trees = (await getTrees({ state })).result;
  createProgressIndicator({
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
    updateProgressIndicator({ message: `${tree._id}`, state });
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
    message: `Deleted ${
      journeyCount - journeyErrorCount
    }/${journeyCount} journeys and ${
      nodeCount - nodeErrorCount
    }/${nodeCount} nodes.`,
    state,
  });
  return status;
}

/**
 * Enable a journey
 * @param journeyId journey id/name
 * @returns {Promise<boolean>} true if the operation was successful, false otherwise
 */
export async function enableJourney({
  journeyId,
  state,
}: {
  journeyId: string;
  state: State;
}): Promise<boolean> {
  try {
    const treeObject = await getTree({ id: journeyId, state });
    treeObject['enabled'] = true;
    delete treeObject._rev;
    const newTreeObject = await putTree({
      treeId: journeyId,
      treeData: treeObject,
      state,
    });
    return newTreeObject['enabled'] === true;
  } catch (error) {
    printMessage({ message: error.response.data, type: 'error', state });
    return false;
  }
}

/**
 * Disable a journey
 * @param journeyId journey id/name
 * @returns {Promise<boolean>} true if the operation was successful, false otherwise
 */
export async function disableJourney({
  journeyId,
  state,
}: {
  journeyId: string;
  state: State;
}): Promise<boolean> {
  try {
    const treeObject = await getTree({ id: journeyId, state });
    treeObject['enabled'] = false;
    delete treeObject._rev;
    const newTreeObject = await putTree({
      treeId: journeyId,
      treeData: treeObject,
      state,
    });
    return newTreeObject['enabled'] === false;
  } catch (error) {
    printMessage({ message: error.response.data, type: 'error', state });
    return false;
  }
}
