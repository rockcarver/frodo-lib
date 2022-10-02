import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import {
  convertBase64TextToArray,
  getTypedFilename,
  saveJsonToFile,
  getRealmString,
  convertTextArrayToBase64,
  convertTextArrayToBase64Url,
} from './utils/ExportImportUtils';
import { getRealmManagedUser, replaceAll } from './utils/OpsUtils';
import storage from '../storage/SessionStorage';
import {
  getNode,
  putNode,
  deleteNode,
  getNodeTypes,
  getNodesByType,
} from '../api/NodeApi';
import { isCloudOnlyNode, isCustomNode, isPremiumNode } from './NodeOps';
import { getTrees, getTree, putTree, deleteTree } from '../api/TreeApi';
import { getEmailTemplate, putEmailTemplate } from '../api/EmailTemplateApi';
import { getScript } from '../api/ScriptApi';
import * as global from '../storage/StaticStorage';
import {
  printMessage,
  createProgressIndicator,
  updateProgressIndicator,
  stopProgressIndicator,
  createTable,
  debugMessage,
} from './utils/Console';
import wordwrap from './utils/Wordwrap';
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
import { getThemes, putThemes } from '../api/ThemeApi';
import { createOrUpdateScript } from './ScriptOps';
import { JourneyClassification, TreeExportResolverInterface } from './OpsTypes';
import {
  InnerNodeRefSkeletonInterface,
  NodeRefSkeletonInterface,
  NodeSkeleton,
} from '../api/ApiTypes';
import {
  SingleTreeExportInterface,
  MultiTreeExportInterface,
  TreeDependencyMapInterface,
  TreeExportOptions,
  TreeImportOptions,
} from './OpsTypes';

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
export function createSingleTreeExportTemplate(): SingleTreeExportInterface {
  return {
    meta: {},
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
export function createMultiTreeExportTemplate(): MultiTreeExportInterface {
  return {
    meta: {},
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
  allCirclesOfTrust
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
        const providerResponse = await getProviderByLocationAndId(
          entity.location,
          entity._id
        );
        /**
         * Adding entityLocation here to the entityResponse because the import tool
         * needs to know whether the saml2 entity is remote or not (this will be removed
         * from the config before importing see updateSaml2Entity and createSaml2Entity functions).
         * Importing a remote saml2 entity is a slightly different request (see createSaml2Entity).
         */
        providerResponse.entityLocation = entity.location;

        if (entity.location === 'remote') {
          // get the xml representation of this entity and add it to the entityResponse;
          const metaDataResponse = await getProviderMetadata(
            providerResponse.entityId
          );
          providerResponse.base64EntityXML = encodeBase64Url(metaDataResponse);
        }
        saml2EntityPromises.push(providerResponse);
      } catch (error) {
        printMessage(error.message, 'error');
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
    printMessage(error.message, 'error');
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
export async function exportJourney(
  treeId: string,
  options: TreeExportOptions = {
    useStringArrays: true,
    deps: true,
    verbose: false,
  }
): Promise<SingleTreeExportInterface> {
  const treeObject = await getTree(treeId);
  const exportData = createSingleTreeExportTemplate();
  const { useStringArrays, deps, verbose } = options;

  if (verbose) printMessage(`\n- ${treeObject._id}\n`, 'info', false);

  // Process tree
  if (verbose) printMessage('  - Flow');
  exportData.tree = treeObject;
  if (verbose && treeObject.identityResource)
    printMessage(
      `    - identityResource: ${treeObject.identityResource}`,
      'info'
    );
  if (verbose) printMessage(`    - Done`, 'info');

  const nodePromises = [];
  const scriptPromises = [];
  const emailTemplatePromises = [];
  const innerNodePromises = [];
  const saml2ConfigPromises = [];
  let socialProviderPromise = null;
  const themePromise =
    deps &&
    storage.session.getDeploymentType() !== global.CLASSIC_DEPLOYMENT_TYPE_KEY
      ? getThemes().catch((error) => {
          printMessage(error, 'error');
        })
      : null;

  let allSaml2Providers = null;
  let allCirclesOfTrust = null;
  let filteredSocialProviders = null;
  const themes = [];

  // get all the nodes
  for (const [nodeId, nodeInfo] of Object.entries(treeObject.nodes)) {
    nodePromises.push(getNode(nodeId, nodeInfo['nodeType']));
  }
  if (verbose && nodePromises.length > 0) printMessage('  - Nodes:');
  const nodeObjects = await Promise.all(nodePromises);

  // iterate over every node in tree
  for (const nodeObject of nodeObjects) {
    const nodeId = nodeObject._id;
    const nodeType = nodeObject._type._id;
    if (verbose) printMessage(`    - ${nodeId} (${nodeType})`, 'info', true);
    exportData.nodes[nodeObject._id] = nodeObject;

    // handle script node types
    if (
      deps &&
      scriptedNodes.includes(nodeType) &&
      nodeObject.script !== emptyScriptPlaceholder
    ) {
      scriptPromises.push(getScript(nodeObject.script));
    }

    // frodo supports email templates in platform deployments
    if (
      (deps &&
        storage.session.getDeploymentType() ===
          global.CLOUD_DEPLOYMENT_TYPE_KEY) ||
      storage.session.getDeploymentType() ===
        global.FORGEOPS_DEPLOYMENT_TYPE_KEY
    ) {
      if (emailTemplateNodes.includes(nodeType)) {
        try {
          const emailTemplate = await getEmailTemplate(
            nodeObject.emailTemplateName
          );
          emailTemplatePromises.push(emailTemplate);
        } catch (error) {
          let message = `${error}`;
          if (error.isAxiosError && error.response.status) {
            message = error.response.statusText;
          }
          printMessage(
            `\n${message}: Email Template "${nodeObject.emailTemplateName}"`,
            'error'
          );
        }
      }
    }

    // handle SAML2 node dependencies
    if (deps && nodeType === 'product-Saml2Node') {
      if (!allSaml2Providers) {
        // eslint-disable-next-line no-await-in-loop
        allSaml2Providers = (await getProviders()).result;
      }
      if (!allCirclesOfTrust) {
        // eslint-disable-next-line no-await-in-loop
        allCirclesOfTrust = (await getCirclesOfTrust()).result;
      }
      saml2ConfigPromises.push(
        getSaml2NodeDependencies(
          nodeObject,
          allSaml2Providers,
          allCirclesOfTrust
        )
      );
    }

    // If this is a SocialProviderHandlerNode get each enabled social identity provider.
    if (
      deps &&
      !socialProviderPromise &&
      nodeType === 'SocialProviderHandlerNode'
    ) {
      socialProviderPromise = getSocialIdentityProviders();
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
        innerNodePromises.push(getNode(innerNode._id, innerNode.nodeType));
      }
      // frodo supports themes in platform deployments
      if (
        (deps &&
          storage.session.getDeploymentType() ===
            global.CLOUD_DEPLOYMENT_TYPE_KEY) ||
        storage.session.getDeploymentType() ===
          global.FORGEOPS_DEPLOYMENT_TYPE_KEY
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
  if (verbose && innerNodePromises.length > 0) printMessage('  - Inner nodes:');
  const innerNodeDataResults = await Promise.all(innerNodePromises);
  for (const innerNodeObject of innerNodeDataResults) {
    const innerNodeId = innerNodeObject._id;
    const innerNodeType = innerNodeObject._type._id;
    if (verbose)
      printMessage(`    - ${innerNodeId} (${innerNodeType})`, 'info', true);
    exportData.innerNodes[innerNodeId] = innerNodeObject;

    // handle script node types
    if (deps && scriptedNodes.includes(innerNodeType)) {
      scriptPromises.push(getScript(innerNodeObject.script));
    }

    // frodo supports email templates in platform deployments
    if (
      (deps &&
        storage.session.getDeploymentType() ===
          global.CLOUD_DEPLOYMENT_TYPE_KEY) ||
      storage.session.getDeploymentType() ===
        global.FORGEOPS_DEPLOYMENT_TYPE_KEY
    ) {
      if (emailTemplateNodes.includes(innerNodeType)) {
        try {
          const emailTemplate = await getEmailTemplate(
            innerNodeObject.emailTemplateName
          );
          emailTemplatePromises.push(emailTemplate);
        } catch (error) {
          let message = `${error}`;
          if (error.isAxiosError && error.response.status) {
            message = error.response.statusText;
          }
          printMessage(
            `\n${message}: Email Template "${innerNodeObject.emailTemplateName}"`,
            'error'
          );
        }
      }
    }

    // handle SAML2 node dependencies
    if (deps && innerNodeType === 'product-Saml2Node') {
      printMessage('SAML2 inner node', 'error');
      if (!allSaml2Providers) {
        // eslint-disable-next-line no-await-in-loop
        allSaml2Providers = (await getProviders()).result;
      }
      if (!allCirclesOfTrust) {
        // eslint-disable-next-line no-await-in-loop
        allCirclesOfTrust = (await getCirclesOfTrust()).result;
      }
      saml2ConfigPromises.push(
        getSaml2NodeDependencies(
          innerNodeObject,
          allSaml2Providers,
          allCirclesOfTrust
        )
      );
    }

    // If this is a SocialProviderHandlerNode get each enabled social identity provider.
    if (
      deps &&
      !socialProviderPromise &&
      innerNodeType === 'SocialProviderHandlerNode'
    ) {
      socialProviderPromise = getSocialIdentityProviders();
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
    printMessage('  - Email templates:');
  const settledEmailTemplatePromises = await Promise.allSettled(
    emailTemplatePromises
  );
  for (const settledPromise of settledEmailTemplatePromises) {
    if (settledPromise.status === 'fulfilled' && settledPromise.value) {
      if (verbose)
        printMessage(
          `    - ${settledPromise.value._id.split('/')[1]}${
            settledPromise.value.displayName
              ? ` (${settledPromise.value.displayName})`
              : ''
          }`,
          'info',
          true
        );
      exportData.emailTemplates[settledPromise.value._id.split('/')[1]] =
        settledPromise.value;
    }
  }

  // Process SAML2 providers and circles of trust
  const saml2NodeDependencies = await Promise.all(saml2ConfigPromises);
  for (const saml2NodeDependency of saml2NodeDependencies) {
    if (saml2NodeDependency) {
      if (verbose) printMessage('  - SAML2 entity providers:');
      for (const saml2Entity of saml2NodeDependency.saml2Entities) {
        if (verbose)
          printMessage(
            `    - ${saml2Entity.entityLocation} ${saml2Entity.entityId}`,
            'info'
          );
        exportData.saml2Entities[saml2Entity._id] = saml2Entity;
      }
      if (verbose) printMessage('  - SAML2 circles of trust:');
      for (const circleOfTrust of saml2NodeDependency.circlesOfTrust) {
        if (verbose) printMessage(`    - ${circleOfTrust._id}`, 'info');
        exportData.circlesOfTrust[circleOfTrust._id] = circleOfTrust;
      }
    }
  }

  // Process socialIdentityProviders
  const socialProviders = await Promise.resolve(socialProviderPromise);
  if (socialProviders) {
    if (verbose) printMessage('  - OAuth2/OIDC (social) identity providers:');
    for (const socialProvider of socialProviders.result) {
      // If the list of socialIdentityProviders needs to be filtered based on the
      // filteredProviders property of a SelectIdPNode do it here.
      if (
        socialProvider &&
        (!filteredSocialProviders ||
          filteredSocialProviders.length === 0 ||
          filteredSocialProviders.includes(socialProvider._id))
      ) {
        if (verbose) printMessage(`    - ${socialProvider._id}`, 'info');
        scriptPromises.push(getScript(socialProvider.transform));
        exportData.socialIdentityProviders[socialProvider._id] = socialProvider;
      }
    }
  }

  // Process scripts
  if (verbose && scriptPromises.length > 0) printMessage('  - Scripts:');
  const scriptObjects = await Promise.all(scriptPromises);
  for (const scriptObject of scriptObjects) {
    if (scriptObject) {
      if (verbose)
        printMessage(
          `    - ${scriptObject._id} (${scriptObject.name})`,
          'info',
          true
        );
      scriptObject.script = useStringArrays
        ? convertBase64TextToArray(scriptObject.script)
        : JSON.stringify(decode(scriptObject.script));
      exportData.scripts[scriptObject._id] = scriptObject;
    }
  }

  // Process themes
  if (themePromise) {
    if (verbose) printMessage('  - Themes:');
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
            printMessage(
              `    - ${themeObject._id} (${themeObject.name})`,
              'info'
            );
          exportData.themes.push(themeObject);
        }
      }
    } catch (error) {
      printMessage(error, 'error');
      printMessage('Error handling themes: ' + error.message, 'error');
    }
  }

  return exportData;
}

/**
 * Get all the journeys/trees without all their nodes and dependencies.
 * @returns {Promise<unknown[]>} a promise that resolves to an array of journey objects
 */
export async function getJourneys(): Promise<unknown[]> {
  let journeys = [];
  try {
    journeys = (await getTrees()).result;
  } catch (error) {
    printMessage(`${error.message}`, 'error');
    printMessage(error.response.data, 'error');
  }
  journeys.sort((a, b) => a._id.localeCompare(b._id));
  return journeys;
}

/**
 * Export journey by id/name to file
 * @param {string} journeyId journey id/name
 * @param {string} file optional export file name
 * @param {TreeExportOptions} options export options
 */
export async function exportJourneyToFile(
  journeyId: string,
  file: string,
  options: TreeExportOptions
): Promise<void> {
  const { verbose } = options;
  let fileName = file;
  if (!fileName) {
    fileName = getTypedFilename(journeyId, 'journey');
  }
  if (!verbose)
    createProgressIndicator(undefined, `${journeyId}`, 'indeterminate');
  try {
    const fileData: SingleTreeExportInterface = await exportJourney(
      journeyId,
      options
    );
    if (verbose)
      createProgressIndicator(undefined, `${journeyId}`, 'indeterminate');
    saveJsonToFile(fileData, fileName);
    stopProgressIndicator(
      `Exported ${journeyId['brightCyan']} to ${fileName['brightCyan']}.`,
      'success'
    );
  } catch (error) {
    if (verbose)
      createProgressIndicator(undefined, `${journeyId}`, 'indeterminate');
    stopProgressIndicator(
      `Error exporting journey ${journeyId}: ${error}`,
      'fail'
    );
  }
}

/**
 * Export all journeys to file
 * @param {string} file optional export file name
 * @param {TreeExportOptions} options export options
 */
export async function exportJourneysToFile(
  file: string,
  options: TreeExportOptions = {
    deps: false,
    useStringArrays: false,
    verbose: false,
  }
): Promise<void> {
  let fileName = file;
  if (!fileName) {
    fileName = getTypedFilename(`all${getRealmString()}Journeys`, 'journeys');
  }
  const trees = (await getTrees()).result;
  const fileData: MultiTreeExportInterface = createMultiTreeExportTemplate();
  createProgressIndicator(trees.length, 'Exporting journeys...');
  for (const tree of trees) {
    updateProgressIndicator(`${tree._id}`);
    try {
      const exportData = await exportJourney(tree._id, options);
      delete exportData.meta;
      fileData.trees[tree._id] = exportData;
    } catch (error) {
      printMessage(`Error exporting journey ${tree._id}: ${error}`, 'error');
    }
  }
  saveJsonToFile(fileData, fileName);
  stopProgressIndicator(`Exported to ${fileName}`);
}

/**
 * Export all journeys to separate files
 * @param {TreeExportOptions} options export options
 */
export async function exportJourneysToFiles(
  options: TreeExportOptions
): Promise<void> {
  const trees = (await getTrees()).result;
  createProgressIndicator(trees.length, 'Exporting journeys...');
  for (const tree of trees) {
    updateProgressIndicator(`${tree._id}`);
    const fileName = getTypedFilename(`${tree._id}`, 'journey');
    try {
      const exportData: SingleTreeExportInterface = await exportJourney(
        tree._id,
        options
      );
      saveJsonToFile(exportData, fileName);
    } catch (error) {
      // do we need to report status here?
    }
  }
  stopProgressIndicator('Done');
}

/**
 * Helper to import a tree with all dependencies from an import data object (typically read from a file)
 * @param {SingleTreeExportInterface} treeObject tree object containing tree and all its dependencies
 * @param {TreeImportOptions} options import options
 */
export async function importJourney(
  treeObject: SingleTreeExportInterface,
  options: TreeImportOptions
): Promise<void> {
  const { reUuid, deps, verbose } = options;
  if (verbose) printMessage(`\n- ${treeObject.tree._id}\n`, 'info', false);
  let newUuid = '';
  const uuidMap = {};
  const treeId = treeObject.tree._id;

  // Process scripts
  if (
    deps &&
    treeObject.scripts &&
    Object.entries(treeObject.scripts).length > 0
  ) {
    if (verbose) printMessage('  - Scripts:');
    for (const [scriptId, scriptObject] of Object.entries(treeObject.scripts)) {
      if (verbose)
        printMessage(
          `    - ${scriptId} (${scriptObject['name']})`,
          'info',
          false
        );
      // is the script stored as an array of strings or just b64 blob?
      if (Array.isArray(scriptObject['script'])) {
        scriptObject['script'] = convertTextArrayToBase64(
          scriptObject['script']
        );
      } else if (!isBase64Encoded(scriptObject['script'])) {
        scriptObject['script'] = encode(JSON.parse(scriptObject['script']));
      }
      if ((await createOrUpdateScript(scriptId, scriptObject)) == null) {
        throw new Error(
          `Error importing script ${scriptObject['name']} (${scriptId}) in journey ${treeId}`
        );
      }
      if (verbose) printMessage('');
    }
  }

  // Process email templates
  if (
    deps &&
    treeObject.emailTemplates &&
    Object.entries(treeObject.emailTemplates).length > 0
  ) {
    if (verbose) printMessage('  - Email templates:');
    for (const [templateId, templateData] of Object.entries(
      treeObject.emailTemplates
    )) {
      if (verbose) printMessage(`    - ${templateId}`, 'info', false);
      try {
        await putEmailTemplate(templateId, templateData);
      } catch (error) {
        printMessage(error.response.data, 'error');
        throw new Error(`Error importing email templates: ${error.message}`);
      }
      if (verbose) printMessage('');
    }
  }

  // Process themes
  if (deps && treeObject.themes && treeObject.themes.length > 0) {
    if (verbose) printMessage('  - Themes:');
    const themes = {};
    for (const theme of treeObject.themes) {
      if (verbose)
        printMessage(`    - ${theme['_id']} (${theme['name']})`, 'info');
      themes[theme['_id']] = theme;
    }
    try {
      await putThemes(themes);
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
    if (verbose) printMessage('  - OAuth2/OIDC (social) identity providers:');
    for (const [providerId, providerData] of Object.entries(
      treeObject.socialIdentityProviders
    )) {
      if (verbose) printMessage(`    - ${providerId}`, 'info');
      try {
        await putProviderByTypeAndId(
          providerData['_type']['_id'],
          providerId,
          providerData
        );
      } catch (importError) {
        if (
          importError.response?.status === 500 &&
          importError.response?.data?.message ===
            'Unable to update SMS config: Data validation failed for the attribute, Redirect after form post URL'
        ) {
          providerData['redirectAfterFormPostURI'] = '';
          try {
            await putProviderByTypeAndId(
              providerData['_type']['_id'],
              providerId,
              providerData
            );
          } catch (importError2) {
            printMessage(importError.response?.data || importError, 'error');
            throw new Error(
              `Error importing provider ${providerId} in journey ${treeId}: ${importError}`
            );
          }
        } else {
          printMessage(importError.response?.data || importError, 'error');
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
    if (verbose) printMessage('  - SAML2 entity providers:');
    for (const [, providerData] of Object.entries(treeObject.saml2Entities)) {
      delete providerData['_rev'];
      const entityId = providerData['entityId'];
      const entityLocation = providerData['entityLocation'];
      if (verbose) printMessage(`    - ${entityLocation} ${entityId}`, 'info');
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
        (await findProviders(`entityId eq '${entityId}'`, 'location'))
          .resultCount === 0
      ) {
        await createProvider(entityLocation, providerData, metaData).catch(
          (createProviderErr) => {
            printMessage(
              createProviderErr.response?.data || createProviderErr,
              'error'
            );
            throw new Error(`Error creating provider ${entityId}`);
          }
        );
      } else {
        await updateProvider(entityLocation, providerData).catch(
          (updateProviderErr) => {
            printMessage(
              updateProviderErr.response?.data || updateProviderErr,
              'error'
            );
            throw new Error(`Error updating provider ${entityId}`);
          }
        );
      }
    }
  }

  // Process circles of trust
  if (
    deps &&
    treeObject.circlesOfTrust &&
    Object.entries(treeObject.circlesOfTrust).length > 0
  ) {
    if (verbose) printMessage('  - SAML2 circles of trust:');
    for (const [cotId, cotData] of Object.entries(treeObject.circlesOfTrust)) {
      delete cotData['_rev'];
      if (verbose) printMessage(`    - ${cotId}`, 'info');
      try {
        await createCircleOfTrust(cotData);
      } catch (createCotErr) {
        if (
          createCotErr.response?.status === 409 ||
          createCotErr.response?.status === 500
        ) {
          try {
            await updateCircleOfTrust(cotId, cotData);
          } catch (updateCotErr) {
            printMessage(createCotErr.response?.data || createCotErr, 'error');
            printMessage(updateCotErr.response?.data || updateCotErr, 'error');
            throw new Error(`Error creating/updating circle of trust ${cotId}`);
          }
        } else {
          printMessage(createCotErr.response?.data || createCotErr, 'error');
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
    if (verbose) printMessage('  - Inner nodes:', 'text', true);
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
        printMessage(
          `    - ${newUuid}${reUuid ? '*' : ''} (${nodeType})`,
          'info',
          false
        );

      // If the node has an identityResource config setting
      // and the identityResource ends in 'user'
      // and the node's identityResource is the same as the tree's identityResource
      // change it to the current realm managed user identityResource otherwise leave it alone.
      if (
        innerNodeData['identityResource'] &&
        innerNodeData['identityResource'].endsWith('user') &&
        innerNodeData['identityResource'] === treeObject.tree.identityResource
      ) {
        innerNodeData['identityResource'] = `managed/${getRealmManagedUser()}`;
        if (verbose)
          printMessage(
            `\n      - identityResource: ${innerNodeData['identityResource']}`,
            'info',
            false
          );
      }
      try {
        await putNode(newUuid, nodeType, innerNodeData);
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
                printMessage(
                  `\n      - Removing invalid attribute: ${attribute}`,
                  'warn',
                  false
                );
              delete innerNodeData[attribute];
            }
          }
          try {
            await putNode(newUuid, nodeType, innerNodeData);
          } catch (nodeImportError2) {
            printMessage(nodeImportError2.response.data, 'error');
            throw new Error(
              `Error importing node ${innerNodeId}${
                innerNodeId === newUuid ? '' : ` [${newUuid}]`
              } in journey ${treeId}`
            );
          }
        } else {
          printMessage(nodeImportError.response.data, 'error');
          throw new Error(
            `Error importing inner node ${innerNodeId}${
              innerNodeId === newUuid ? '' : ` [${newUuid}]`
            } in journey ${treeId}`
          );
        }
      }
      if (verbose) printMessage('');
    }
  }

  // Process nodes
  if (treeObject.nodes && Object.entries(treeObject.nodes).length > 0) {
    if (verbose) printMessage('  - Nodes:');
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
        printMessage(
          `    - ${newUuid}${reUuid ? '*' : ''} (${nodeType})`,
          'info',
          false
        );

      // If the node has an identityResource config setting
      // and the identityResource ends in 'user'
      // and the node's identityResource is the same as the tree's identityResource
      // change it to the current realm managed user identityResource otherwise leave it alone.
      if (
        nodeData.identityResource &&
        nodeData.identityResource.endsWith('user') &&
        nodeData.identityResource === treeObject.tree.identityResource
      ) {
        nodeData['identityResource'] = `managed/${getRealmManagedUser()}`;
        if (verbose)
          printMessage(
            `\n      - identityResource: ${nodeData['identityResource']}`,
            'info',
            false
          );
      }
      try {
        await putNode(newUuid, nodeType, nodeData);
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
                printMessage(
                  `\n      - Removing invalid attribute: ${attribute}`,
                  'warn',
                  false
                );
              delete nodeData[attribute];
            }
          }
          try {
            await putNode(newUuid, nodeType, nodeData);
          } catch (nodeImportError2) {
            printMessage(nodeImportError2.response.data, 'error');
            throw new Error(
              `Error importing node ${nodeId}${
                nodeId === newUuid ? '' : ` [${newUuid}]`
              } in journey ${treeId}`
            );
          }
        } else {
          printMessage(nodeImportError.response.data, 'error');
          throw new Error(
            `Error importing node ${nodeId}${
              nodeId === newUuid ? '' : ` [${newUuid}]`
            } in journey ${treeId}`
          );
        }
      }
      if (verbose) printMessage('');
    }
  }

  // Process tree
  if (verbose) printMessage('  - Flow');

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
    storage.session.getDeploymentType() === global.CLOUD_DEPLOYMENT_TYPE_KEY ||
    storage.session.getDeploymentType() === global.FORGEOPS_DEPLOYMENT_TYPE_KEY
  ) {
    treeObject.tree.identityResource = `managed/${getRealmManagedUser()}`;
    if (verbose)
      printMessage(
        `    - identityResource: ${treeObject.tree.identityResource}`,
        'info',
        false
      );
  }

  delete treeObject.tree._rev;
  try {
    await putTree(treeObject.tree._id as string, treeObject.tree);
    if (verbose) printMessage(`\n    - Done`, 'info', true);
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
            printMessage(
              `\n    - Removing invalid attribute: ${attribute}`,
              'warn',
              false
            );
          delete treeObject.tree[attribute];
        }
      }
      try {
        await putTree(treeObject.tree._id as string, treeObject.tree);
        if (verbose) printMessage(`\n    - Done`, 'info', true);
      } catch (importError2) {
        printMessage(importError2.response.data, 'error');
        throw new Error(`Error importing journey flow ${treeId}`);
      }
    } else {
      printMessage(importError.response?.data || importError, 'error');
      debugMessage(importError.response?.data || importError);
      throw new Error(`\nError importing journey flow ${treeId}`);
    }
  }
}

/**
 * Resolve journey dependencies
 * @param {Map} installedJorneys Map of installed journeys
 * @param {Map} journeyMap Map of journeys to resolve dependencies for
 * @param {[String]} unresolvedJourneys Map to hold the names of unresolved journeys and their dependencies
 * @param {[String]} resolvedJourneys Array to hold the names of resolved journeys
 * @param {int} index Depth of recursion
 */
async function resolveDependencies(
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
 * Import a journey from file
 * @param {string} journeyId journey id/name
 * @param {string} file import file name
 * @param {TreeImportOptions} options import options
 */
export async function importJourneyFromFile(
  journeyId: string,
  file: string,
  options: TreeImportOptions
) {
  const { verbose } = options;
  fs.readFile(file, 'utf8', async (err, data) => {
    if (err) throw err;
    let journeyData = JSON.parse(data);
    // check if this is a file with multiple trees and get journey by id
    if (journeyData.trees && journeyData.trees[journeyId]) {
      journeyData = journeyData.trees[journeyId];
    } else if (journeyData.trees) {
      journeyData = null;
    }

    // if a journeyId was specified, only import the matching journey
    if (journeyData && journeyId === journeyData.tree._id) {
      // attempt dependency resolution for single tree import
      const installedJourneys = (await getTrees()).result.map((x) => x._id);
      const unresolvedJourneys = {};
      const resolvedJourneys = [];
      createProgressIndicator(
        undefined,
        'Resolving dependencies',
        'indeterminate'
      );
      await resolveDependencies(
        installedJourneys,
        { [journeyId]: journeyData },
        unresolvedJourneys,
        resolvedJourneys
      );
      if (Object.keys(unresolvedJourneys).length === 0) {
        stopProgressIndicator(`Resolved all dependencies.`, 'success');

        if (!verbose)
          createProgressIndicator(
            undefined,
            `Importing ${journeyId}...`,
            'indeterminate'
          );
        importJourney(journeyData, options)
          .then(() => {
            if (verbose)
              createProgressIndicator(
                undefined,
                `Importing ${journeyId}...`,
                'indeterminate'
              );
            stopProgressIndicator(`Imported ${journeyId}.`, 'success');
          })
          .catch((importError) => {
            if (verbose)
              createProgressIndicator(
                undefined,
                `Importing ${journeyId}...`,
                'indeterminate'
              );
            stopProgressIndicator(`${importError}`, 'fail');
          });
      } else {
        stopProgressIndicator(`Unresolved dependencies:`, 'fail');
        for (const journey of Object.keys(unresolvedJourneys)) {
          printMessage(
            `  ${journey} requires ${unresolvedJourneys[journey]}`,
            'error'
          );
        }
      }
      // end dependency resolution for single tree import
    } else {
      createProgressIndicator(
        undefined,
        `Importing ${journeyId}...`,
        'indeterminate'
      );
      stopProgressIndicator(`${journeyId} not found!`, 'fail');
    }
  });
}

/**
 * Import first journey from file
 * @param {string} file import file name
 * @param {TreeImportOptions} options import options
 */
export async function importFirstJourneyFromFile(
  file: string,
  options: TreeImportOptions
) {
  const { verbose } = options;
  fs.readFile(file, 'utf8', async (err, data) => {
    if (err) throw err;
    let journeyData = _.cloneDeep(JSON.parse(data));
    let journeyId = null;
    // single tree
    if (journeyData.tree) {
      journeyId = _.cloneDeep(journeyData.tree._id);
    }
    // multiple trees, so get the first tree
    else if (journeyData.trees) {
      for (const treeId in journeyData.trees) {
        if (Object.hasOwnProperty.call(journeyData.trees, treeId)) {
          journeyId = treeId;
          journeyData = journeyData.trees[treeId];
          break;
        }
      }
    }

    // if a journeyId was specified, only import the matching journey
    if (journeyData && journeyId) {
      // attempt dependency resolution for single tree import
      const installedJourneys = (await getTrees()).result.map((x) => x._id);
      const unresolvedJourneys = {};
      const resolvedJourneys = [];
      createProgressIndicator(
        undefined,
        'Resolving dependencies',
        'indeterminate'
      );
      await resolveDependencies(
        installedJourneys,
        { [journeyId]: journeyData },
        unresolvedJourneys,
        resolvedJourneys
      );
      if (Object.keys(unresolvedJourneys).length === 0) {
        stopProgressIndicator(`Resolved all dependencies.`, 'success');

        if (!verbose)
          createProgressIndicator(
            undefined,
            `Importing ${journeyId}...`,
            'indeterminate'
          );
        importJourney(journeyData, options)
          .then(() => {
            if (verbose)
              createProgressIndicator(
                undefined,
                `Importing ${journeyId}...`,
                'indeterminate'
              );
            stopProgressIndicator(`Imported ${journeyId}.`, 'success');
          })
          .catch((importError) => {
            if (verbose)
              createProgressIndicator(
                undefined,
                `Importing ${journeyId}...`,
                'indeterminate'
              );
            stopProgressIndicator(`${importError}`, 'fail');
          });
      } else {
        stopProgressIndicator(`Unresolved dependencies:`, 'fail');
        for (const journey of Object.keys(unresolvedJourneys)) {
          printMessage(
            `  ${journey} requires ${unresolvedJourneys[journey]}`,
            'error'
          );
        }
      }
    } else {
      createProgressIndicator(undefined, `Importing...`, 'indeterminate');
      stopProgressIndicator(`No journeys found!`, 'fail');
    }
    // end dependency resolution for single tree import
  });
}

/**
 * Helper to import multiple trees from a tree map
 * @param {Object} treesMap map of trees object
 * @param {TreeImportOptions} options import options
 */
async function importAllJourneys(
  treesMap: MultiTreeExportInterface,
  options: TreeImportOptions
) {
  const installedJourneys = (await getTrees()).result.map((x) => x._id);
  const unresolvedJourneys = {};
  const resolvedJourneys = [];
  createProgressIndicator(undefined, 'Resolving dependencies', 'indeterminate');
  await resolveDependencies(
    installedJourneys,
    treesMap,
    unresolvedJourneys,
    resolvedJourneys
  );
  if (Object.keys(unresolvedJourneys).length === 0) {
    stopProgressIndicator(`Resolved all dependencies.`, 'success');
  } else {
    stopProgressIndicator(
      `${
        Object.keys(unresolvedJourneys).length
      } journeys with unresolved dependencies:`,
      'fail'
    );
    for (const journey of Object.keys(unresolvedJourneys)) {
      printMessage(
        `  - ${journey} requires ${unresolvedJourneys[journey]}`,
        'info'
      );
    }
  }
  createProgressIndicator(resolvedJourneys.length, 'Importing');
  for (const tree of resolvedJourneys) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await importJourney(treesMap[tree], options);
      updateProgressIndicator(`${tree}`);
    } catch (error) {
      printMessage(`\n${error.message}`, 'error');
    }
  }
  stopProgressIndicator('Done');
}

/**
 * Import all journeys from file
 * @param {string} file import file name
 * @param {TreeImportOptions} options import options
 */
export async function importJourneysFromFile(
  file: string,
  options: TreeImportOptions
) {
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) throw err;
    const fileData = JSON.parse(data);
    importAllJourneys(fileData.trees, options);
  });
}

/**
 * Import all journeys from separate files
 * @param {TreeImportOptions} options import options
 */
export async function importJourneysFromFiles(options: TreeImportOptions) {
  const names = fs.readdirSync('.');
  const jsonFiles = names.filter((name) =>
    name.toLowerCase().endsWith('.journey.json')
  );
  const allJourneysData = { trees: {} };
  for (const file of jsonFiles) {
    const journeyData = JSON.parse(fs.readFileSync(file, 'utf8'));
    allJourneysData.trees[journeyData.tree._id] = journeyData;
  }
  importAllJourneys(allJourneysData.trees as MultiTreeExportInterface, options);
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
  async function (treeId: string) {
    debugMessage(`onlineTreeExportResolver(${treeId})`);
    return await exportJourney(treeId, {
      deps: false,
      useStringArrays: false,
      verbose: false,
    });
  };

/**
 * Tree export resolver used to resolve a tree id/name to a full export
 * of that tree from individual `treename.journey.json` export files.
 * @param {string} treeId id/name of the tree to resolve
 * @returns {TreeExportResolverInterface} tree export
 */
export const fileByIdTreeExportResolver: TreeExportResolverInterface =
  async function (treeId: string) {
    debugMessage(`fileByIdTreeExportResolver(${treeId})`);
    let treeExport = createSingleTreeExportTemplate();
    const file = getTypedFilename(`${treeId}`, 'journey');
    debugMessage(
      `fileByIdTreeExportResolver: resolving '${treeId}' to ${file}`
    );
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
    } catch (error) {
      //
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
  file: string
): TreeExportResolverInterface {
  const fileParamTreeExportResolver: TreeExportResolverInterface =
    async function (treeId: string) {
      debugMessage(`fileParamTreeExportResolver(${treeId})`);
      let treeExport: SingleTreeExportInterface =
        createSingleTreeExportTemplate();
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
          treeExport = await fileByIdTreeExportResolver(treeId);
        }
      } catch (error) {
        //
      }
      return treeExport;
    };
  debugMessage('fileParamTreeExportResolver:');
  debugMessage(fileParamTreeExportResolver);
  return fileParamTreeExportResolver;
}

/**
 * Get tree dependencies (all descendent inner trees)
 * @param {SingleTreeExportInterface} treeExport single tree export
 * @param {string[]} resolvedTreeIds list of tree ids wich have already been resolved
 * @param {TreeExportResolverInterface} resolveTreeExport tree export resolver callback function
 * @returns {Promise<TreeDependencyMapInterface>} a promise that resolves to a tree dependency map
 */
export async function getTreeDescendents(
  treeExport: SingleTreeExportInterface,
  resolveTreeExport: TreeExportResolverInterface = onlineTreeExportResolver,
  resolvedTreeIds: string[] = []
): Promise<TreeDependencyMapInterface> {
  debugMessage(
    `getTreeDependencies(${treeExport.tree._id}, [${resolvedTreeIds.join(
      ', '
    )}])`
  );
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
      const innerTreeExport = await resolveTreeExport(innerTreeId);
      debugMessage(`resolved inner tree: ${innerTreeExport.tree._id}`);
      // resolvedTreeIds.push(innerTreeId);
      dependencies.push(
        await getTreeDescendents(
          innerTreeExport,
          resolveTreeExport,
          resolvedTreeIds
        )
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
export async function findOrphanedNodes(): Promise<unknown[]> {
  const allNodes = [];
  const orphanedNodes = [];
  let types = [];
  const allJourneys = (await getTrees()).result;
  let errorMessage = '';
  const errorTypes = [];

  createProgressIndicator(
    undefined,
    `Counting total nodes...`,
    'indeterminate'
  );
  try {
    types = (await getNodeTypes()).result;
  } catch (error) {
    printMessage('Error retrieving all available node types:', 'error');
    printMessage(error.response.data, 'error');
    return [];
  }
  for (const type of types) {
    try {
      // eslint-disable-next-line no-await-in-loop, no-loop-func
      const nodes = (await getNodesByType(type._id)).result;
      for (const node of nodes) {
        allNodes.push(node);
        updateProgressIndicator(
          `${allNodes.length} total nodes${errorMessage}`
        );
      }
    } catch (error) {
      errorTypes.push(type._id);
      errorMessage = ` (Skipped type(s): ${errorTypes})`['yellow'];
      updateProgressIndicator(`${allNodes.length} total nodes${errorMessage}`);
    }
  }
  if (errorTypes.length > 0) {
    stopProgressIndicator(
      `${allNodes.length} total nodes${errorMessage}`,
      'warn'
    );
  } else {
    stopProgressIndicator(`${allNodes.length} total nodes`, 'success');
  }

  createProgressIndicator(
    undefined,
    'Counting active nodes...',
    'indeterminate'
  );
  const activeNodes = [];
  for (const journey of allJourneys) {
    for (const nodeId in journey.nodes) {
      if ({}.hasOwnProperty.call(journey.nodes, nodeId)) {
        activeNodes.push(nodeId);
        updateProgressIndicator(`${activeNodes.length} active nodes`);
        const node = journey.nodes[nodeId];
        if (containerNodes.includes(node.nodeType)) {
          const containerNode = await getNode(nodeId, node.nodeType);
          for (const innerNode of containerNode.nodes) {
            activeNodes.push(innerNode._id);
            updateProgressIndicator(`${activeNodes.length} active nodes`);
          }
        }
      }
    }
  }
  stopProgressIndicator(`${activeNodes.length} active nodes`, 'success');

  createProgressIndicator(
    undefined,
    'Calculating orphaned nodes...',
    'indeterminate'
  );
  const diff = allNodes.filter((x) => !activeNodes.includes(x._id));
  for (const orphanedNode of diff) {
    orphanedNodes.push(orphanedNode);
  }
  stopProgressIndicator(`${orphanedNodes.length} orphaned nodes`, 'success');
  return orphanedNodes;
}

/**
 * Remove orphaned nodes
 * @param {[Object]} orphanedNodes Pass in an array of orphaned node configuration objects to remove
 * @returns {Promise<unknown[]>} a promise that resolves to an array nodes that encountered errors deleting
 */
export async function removeOrphanedNodes(
  orphanedNodes: unknown[]
): Promise<unknown[]> {
  const errorNodes = [];
  createProgressIndicator(orphanedNodes.length, 'Removing orphaned nodes...');
  for (const node of orphanedNodes) {
    updateProgressIndicator(`Removing ${node['_id']}...`);
    try {
      // eslint-disable-next-line no-await-in-loop
      await deleteNode(node['_id'], node['_type']['_id']);
    } catch (deleteError) {
      errorNodes.push(node);
      printMessage(` ${deleteError}`, 'error');
    }
  }
  stopProgressIndicator(`Removed ${orphanedNodes.length} orphaned nodes.`);
  return errorNodes;
}

/**
 * Analyze if a journey contains any custom nodes considering the detected or the overridden version.
 * @param {SingleTreeExportInterface} journey Journey/tree configuration object
 * @returns {boolean} True if the journey/tree contains any custom nodes, false otherwise.
 */
export function isCustomJourney(journey: SingleTreeExportInterface) {
  const nodeList = Object.values(journey.nodes).concat(
    Object.values(journey.innerNodes)
  );
  for (const node of nodeList) {
    if (isCustomNode(node['_type']['_id'])) {
      return true;
    }
  }
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
 * @param {SingleTreeExportInterface} journey journey export data
 * @returns {JourneyClassification[]} an array of one or multiple classifications
 */
export function getJourneyClassification(
  journey: SingleTreeExportInterface
): JourneyClassification[] {
  const classifications: JourneyClassification[] = [];
  const premium = isPremiumJourney(journey);
  const custom = isCustomJourney(journey);
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
 * List all the journeys/trees
 * @param {boolean} long Long version, all the fields
 * @param {boolean} analyze Analyze journeys/trees for custom nodes (expensive)
 * @returns {Promise<unknown[]>} a promise that resolves to an array journey objects
 */
export async function listJourneys(
  long = false,
  analyze = false
): Promise<unknown[]> {
  let journeys = [];
  journeys = await getJourneys();
  if (!long && !analyze) {
    for (const journeyStub of journeys) {
      printMessage(`${journeyStub['_id']}`, 'data');
    }
  } else {
    if (!analyze) {
      const table = createTable(['Name', 'Status', 'Tags']);
      for (const journeyStub of journeys) {
        table.push([
          `${journeyStub._id}`,
          journeyStub.enabled === false
            ? 'disabled'['brightRed']
            : 'enabled'['brightGreen'],
          journeyStub.uiConfig?.categories
            ? wordwrap(
                JSON.parse(journeyStub.uiConfig.categories).join(', '),
                60
              )
            : '',
        ]);
      }
      printMessage(table.toString(), 'data');
    } else {
      createProgressIndicator(
        0,
        'Retrieving details of all journeys...',
        'indeterminate'
      );
      const exportPromises = [];
      for (const journeyStub of journeys) {
        exportPromises.push(
          exportJourney(journeyStub['_id'], {
            useStringArrays: false,
            deps: false,
            verbose: false,
          })
        );
      }
      const journeyExports = await Promise.all(exportPromises);
      stopProgressIndicator('Retrieved details of all journeys.', 'success');
      const table = createTable(['Name', 'Status', 'Classification', 'Tags']);
      for (const journeyExport of journeyExports) {
        table.push([
          `${journeyExport.tree._id}`,
          journeyExport.tree.enabled === false
            ? 'disabled'['brightRed']
            : 'enabled'['brightGreen'],
          getJourneyClassification(journeyExport).join(', '),
          journeyExport.tree.uiConfig?.categories
            ? wordwrap(
                JSON.parse(journeyExport.tree.uiConfig.categories).join(', '),
                60
              )
            : '',
        ]);
      }
      printMessage(table.toString(), 'data');
    }
  }
  return journeys;
}

/**
 * Delete a journey
 * @param {string} journeyId journey id/name
 * @param {Object} options deep=true also delete all the nodes and inner nodes, verbose=true print verbose info
 */
export async function deleteJourney(
  journeyId: string,
  options,
  progress = true
) {
  const { deep } = options;
  const { verbose } = options;
  const status = { nodes: {} };
  if (progress)
    createProgressIndicator(
      undefined,
      `Deleting ${journeyId}...`,
      'indeterminate'
    );
  if (progress && verbose) stopProgressIndicator();
  return deleteTree(journeyId)
    .then(async (deleteTreeResponse) => {
      status['status'] = 'success';
      const nodePromises = [];
      if (verbose) printMessage(`Deleted ${journeyId} (tree)`, 'info');
      if (deep) {
        for (const [nodeId, nodeObject] of Object.entries(
          deleteTreeResponse.nodes
        )) {
          // delete inner nodes (nodes inside container nodes)
          if (containerNodes.includes(nodeObject['nodeType'])) {
            try {
              // eslint-disable-next-line no-await-in-loop
              const containerNode = await getNode(
                nodeId,
                nodeObject['nodeType']
              );
              if (verbose)
                printMessage(
                  `Read ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}`,
                  'info'
                );
              for (const innerNodeObject of containerNode.nodes) {
                nodePromises.push(
                  deleteNode(innerNodeObject._id, innerNodeObject.nodeType)
                    .then((response2) => {
                      status.nodes[innerNodeObject._id] = { status: 'success' };
                      if (verbose)
                        printMessage(
                          `Deleted ${innerNodeObject._id} (${innerNodeObject.nodeType}) from ${journeyId}`,
                          'info'
                        );
                      return response2;
                    })
                    .catch((error) => {
                      status.nodes[innerNodeObject._id] = {
                        status: 'error',
                        error,
                      };
                      if (verbose)
                        printMessage(
                          `Error deleting inner node ${innerNodeObject._id} (${innerNodeObject.nodeType}) from ${journeyId}: ${error}`,
                          'error'
                        );
                    })
                );
              }
              // finally delete the container node
              nodePromises.push(
                deleteNode(containerNode._id, containerNode['_type']['_id'])
                  .then((response2) => {
                    status.nodes[containerNode._id] = { status: 'success' };
                    if (verbose)
                      printMessage(
                        `Deleted ${containerNode._id} (${containerNode['_type']['_id']}) from ${journeyId}`,
                        'info'
                      );
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
                        printMessage(
                          `Deleted ${containerNode._id} (${containerNode['_type']['_id']}) from ${journeyId}`,
                          'info'
                        );
                    } else {
                      status.nodes[containerNode._id] = {
                        status: 'error',
                        error,
                      };
                      if (verbose)
                        printMessage(
                          `Error deleting container node ${containerNode._id} (${containerNode['_type']['_id']}) from ${journeyId}: ${error.response.data.message}`,
                          'error'
                        );
                    }
                  })
              );
            } catch (error) {
              if (verbose)
                printMessage(
                  `Error getting container node ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}: ${error}`,
                  'error'
                );
            }
          } else {
            // delete the node
            nodePromises.push(
              deleteNode(nodeId, nodeObject['nodeType'])
                .then((response) => {
                  status.nodes[nodeId] = { status: 'success' };
                  if (verbose)
                    printMessage(
                      `Deleted ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}`,
                      'info'
                    );
                  return response;
                })
                .catch((error) => {
                  status.nodes[nodeId] = { status: 'error', error };
                  if (verbose)
                    printMessage(
                      `Error deleting node ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}: ${error}`,
                      'error'
                    );
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
          stopProgressIndicator(
            `Deleted ${journeyId} and ${
              nodeCount - errorCount
            }/${nodeCount} nodes.`,
            'success'
          );
        } else {
          stopProgressIndicator(
            `Deleted ${journeyId} and ${
              nodeCount - errorCount
            }/${nodeCount} nodes.`,
            'fail'
          );
        }
      }
      return status;
    })
    .catch((error) => {
      status['status'] = 'error';
      status['error'] = error;
      stopProgressIndicator(`Error deleting ${journeyId}.`, 'fail');
      if (verbose)
        printMessage(`Error deleting tree ${journeyId}: ${error}`, 'error');
      return status;
    });
}

/**
 * Delete all journeys
 * @param {Object} options deep=true also delete all the nodes and inner nodes, verbose=true print verbose info
 */
export async function deleteJourneys(options) {
  const { verbose } = options;
  const status = {};
  const trees = (await getTrees()).result;
  createProgressIndicator(trees.length, 'Deleting journeys...');
  for (const tree of trees) {
    if (verbose) printMessage('');
    // eslint-disable-next-line no-await-in-loop
    status[tree._id] = await deleteJourney(tree._id, options, false);
    updateProgressIndicator(`${tree._id}`);
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
  stopProgressIndicator(
    `Deleted ${journeyCount - journeyErrorCount}/${journeyCount} journeys and ${
      nodeCount - nodeErrorCount
    }/${nodeCount} nodes.`
  );
  return status;
}
