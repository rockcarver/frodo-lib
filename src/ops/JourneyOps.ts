import fs from 'fs';
import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  createCircleOfTrust,
  updateCircleOfTrust,
  type CircleOfTrustSkeleton,
} from '../api/CirclesOfTrustApi';
import { VariableSkeleton } from '../api/cloud/VariablesApi';
import {
  type CustomNodeSkeleton,
  type InnerNodeRefSkeletonInterface,
  type NodeRefSkeletonInterface,
  type NodeSkeleton,
  type StaticNodeRefSkeletonInterface,
} from '../api/NodeApi';
import {
  getPolicies,
  type PolicyCondition,
  type PolicySkeleton,
} from '../api/PoliciesApi';
import {
  createProvider,
  getProvider,
  getProviderMetadata,
  queryProviderStubs,
  updateProvider,
  type Saml2ProviderSkeleton,
} from '../api/Saml2Api';
import { type ScriptSkeleton } from '../api/ScriptApi';
import { getService } from '../api/ServiceApi';
import { type SocialIdpSkeleton } from '../api/SocialIdentityProvidersApi';
import {
  deleteTree,
  getTree,
  getTrees,
  getTreesCount,
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
  getResult,
  getTypedFilename,
} from '../utils/ExportImportUtils';
import {
  getCurrentRealmManagedUser,
  getCurrentRealmName,
} from '../utils/ForgeRockUtils';
import { sleep } from '../utils/FrodoUtils';
import {
  JOURNEY_CONTAINER_NODE_TYPES,
  validateJourneyDependencies,
  validateJourneyExportKeys,
  validateJourneyReferences,
  type JourneyValidationCode,
  type JourneyValidationFinding,
} from '../utils/JourneyValidationUtils';
import { findInArray } from '../utils/JsonUtils';
import { readAgentGroups, readAIAgents } from './AgentOps';
import { readAuthenticationSettings } from './AuthenticationSettingsOps';
import { readCirclesOfTrust } from './CirclesOfTrustOps';
import { resolveVariable, updateVariable } from './cloud/VariablesOps';
import {
  readEmailTemplate,
  updateEmailTemplate,
  type EmailTemplateSkeleton,
} from './EmailTemplateOps';
import { FrodoError, getFailedResponse, isNotFoundError } from './FrodoError';
import {
  createSocialIdentityProvider,
  readSocialIdentityProviders,
} from './IdpOps';
import { isAgentTypeOffered } from './internal/AgentTypeHelpers';
import {
  defineReferenceSource as defineSource,
  findReferencesInSources,
  joinReferences,
  type ReferenceReads,
  type ReferenceSource,
} from './internal/ReferenceLookup';
import {
  CustomNodeExportInterface,
  deleteNode,
  importCustomNodes,
  readCustomNode,
  readNode,
  readNodes,
  updateNode,
} from './NodeOps';
import { readCIMDProfiles } from './OAuth2CIMDProfileOps';
import { readOAuth2Clients } from './OAuth2ClientOps';
import { readOAuth2Provider } from './OAuth2ProviderOps';
import {
  ResultCallback,
  type ExportMetaData,
  type ReferenceDependency,
} from './OpsTypes';
import { forEachLeafCondition } from './PolicyOps';
import { readSaml2ProviderStubs } from './Saml2Ops';
import {
  getLibraryScriptNames,
  readScript,
  readScriptByName,
  updateScript,
} from './ScriptOps';
import { readThemes, updateThemes, type ThemeSkeleton } from './ThemeOps';

export type Journey = {
  /**
   * Validate journeys for referential integrity.
   *
   * | `journeyIds` | `journeysExport` | Behavior |
   * | --- | --- | --- |
   * | omitted, `null` or `[]` | omitted | Read and validate all journeys in the realm. |
   * | `['login']` | omitted | Read and validate journey `login` from the realm. |
   * | omitted, `null` or `[]` | supplied | Validate all journeys in the export offline. |
   * | `['login']` | supplied | Validate tree `login` in the export offline. |
   *
   * Duplicate IDs are processed once. Live validation reads each journey once;
   * findings are returned without printing. When verbose, live validation
   * prints the export trace as `exportJourney` does (findings are never
   * printed). Missing, blank, or unreadable journeys are reported together
   * after all requested journeys are processed: without a result callback the
   * function then throws one error that nests one error per failed journey
   * and returns no findings; with one, each journey's outcome is passed to
   * the callback as it happens (the findings of the journey, or an error that
   * names the journey), the function does not throw for a failed journey and
   * returns the findings of all journeys that could be validated.
   * Dependency-completeness warnings are export-only: each non-empty dependency
   * section is checked against that journey's node references. Empty sections
   * are skipped. Live validation reads with `deps: false`, so it performs no
   * dependency checks and does not check resource existence in the tenant.
   * @param {string[]} journeyIds journey names; omit or pass an empty array to validate all journeys
   * @param {MultiTreeExportInterface} journeysExport optional export; when supplied, validation is offline
   * @param {ResultCallback<JourneyValidationFinding[]>} resultCallback Optional callback to process individual results: the findings of one journey (an empty array for a journey without findings) or an error that names the journey that could not be validated. Failing to list the journeys of the realm, and invalid arguments, always throw.
   * @returns {Promise<JourneyValidationFinding[]>} validation findings
   */
  validateJourneys(
    journeyIds?: string[],
    journeysExport?: MultiTreeExportInterface,
    resultCallback?: ResultCallback<JourneyValidationFinding[]>
  ): Promise<JourneyValidationFinding[]>;
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
   * @returns {Promise<MultiTreeExportInterface>} a promise that resolves to an object containing the tree and any exported dependencies
   */
  exportJourney(
    treeId: string,
    options?: TreeExportOptions
  ): Promise<MultiTreeExportInterface>;
  /**
   * Create export data for all trees/journeys with all their nodes and dependencies. The export data can be written to a file as is.
   * @param {TreeExportOptions} options export options
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<MultiTreeExportInterface>} a promise that resolves to an object containing the trees and all their nodes and dependencies
   */
  exportJourneys(
    options?: TreeExportOptions,
    resultCallback?: ResultCallback<SingleTreeExportInterface>
  ): Promise<MultiTreeExportInterface>;
  /**
   * Read all journeys without dependencies.
   * @returns {Promise<TreeSkeleton[]>} a promise that resolves to an array of journey objects
   */
  readJourneys(): Promise<TreeSkeleton[]>;
  /**
   * Count all journeys in the active realm.
   * @returns {Promise<number>} exact count when supported by the backing API
   */
  countJourneys(): Promise<number>;
  /**
   * Find every journey/node that references a given script, by scanning all
   * nodes in the active realm for a matching script id and cross-referencing
   * against every journey's node map. Also resolves references nested inside
   * a container node (e.g. a Page Node), reporting the top-level node a
   * journey actually references alongside the inner node that uses the
   * script.
   * @param {string} scriptId script id to find references to
   * @returns {Promise<ScriptReference[]>} a promise that resolves to every reference found
   */
  findScriptReferences(scriptId: string): Promise<ScriptReference[]>;
  /**
   * Find what in the active realm still names a journey, before you delete it
   * or after you deleted it. It reads these sources:
   * other journeys (an Inner Tree Evaluator or Back Channel Initialize node,
   * also when the node sits inside a Page Node), the default journey and the
   * default administrator journey of the realm (`authentication-settings`),
   * every journey of the self-service settings (`self-service-trees`), the
   * password grant journey of the OAuth2 provider (`oauth2-provider`), OAuth2
   * clients, SAML service providers (remote and hosted), AI agents, agent
   * groups and CIMD profiles that are set to authenticate through the journey,
   * the themes that link it (Cloud and ForgeOps only) and the policies with a
   * condition that authenticates to it (at any nesting depth; the answer
   * carries the policy set). It makes about fifteen requests, plus one for
   * every SAML service provider.
   *
   * What a reference carries: every reference has `source` (which holder it
   * is) and `dependency`. A reference from another journey names the node:
   * `journeyId` (the journey that holds it), `nodeId`, `nodeType`,
   * `nodeDisplayName` and, for a node inside a Page Node, `innerNodeId`; it
   * has no `from`. Every other reference has `from`, the field that holds the
   * name as an Access Management field path. A reference from an object (an
   * OAuth2 client, a SAML service provider, an agent, a group, a profile, a
   * theme or a policy) also has its `id`; a theme and a policy have a `name`,
   * a policy its policy set as `applicationName`. There is one reference per
   * holder and field, however often the field names the journey. An object
   * that only inherits the value (Access Management's `inherited: true`, for
   * example an AI agent whose group sets the journey) is reported on its own,
   * with `inherited: true`, and the group that holds the value is reported as
   * well.
   *
   * Every reference carries a `dependency` flag, in the words of the policy
   * import code. `hard` means the holder breaks at run time without the
   * journey (a journey node, the authentication settings, the self-service
   * settings, the OAuth2 provider, an OAuth2 client, a SAML service provider,
   * an AI agent, an agent group, a CIMD profile, a policy condition). `soft`
   * means the holder works without it (a theme that links the journey stops
   * being applied to it). The flag is a property of the holder and its field,
   * not a check of the tenant, and it says what happens to the holder.
   *
   * The flag is separate from what Access Management does when the journey is
   * deleted: a `hard` holder is not necessarily one that Access Management
   * protects. What was observed (an observation, not a guarantee, and it may
   * differ between versions): in November 2026, on one Cloud development
   * tenant, with throw-away objects, Access Management refused to delete a
   * journey that an OAuth2 client, a SAML remote service provider or a SAML
   * hosted service provider names (it answered with a server error, HTTP 500,
   * that names the type of the holder), and it deleted a journey that an Inner
   * Tree Evaluator node, a Back Channel Initialize node, a policy condition
   * (authentication by service, transaction) or an AI agent names, leaving the
   * holder unchanged and pointing at nothing. Writing the placeholder for no
   * journey (`[Empty]`) as the journey name of the client or of the SAML
   * provider was observed to let the delete through. An AI agent whose journey
   * was deleted could no longer be updated or deleted: Access Management
   * checks the stored journey name on every write to an existing AI agent (a
   * validation error, HTTP 400), and a delete of the agent removed its managed
   * identity first and then failed. Writing the placeholder (in the wrapped
   * form, with `inherited` false) cleared the agent only while the journey
   * still existed; afterwards the journey and the agent could be deleted. So a
   * dangling reference to a deleted journey can block later maintenance of the
   * holder. Not observed: the default journeys of the realm, the self-service
   * journeys, the password grant journey of the OAuth2 provider, themes, agent
   * groups and CIMD profiles. A non-empty answer is not a prediction of a
   * refusal.
   *
   * Read-only: every source is read once, the answer is joined in memory, and
   * nothing is written or printed. The journey does not have to exist, so the
   * same call after a delete lists what now points at nothing. A journey that
   * names itself is not reported. A source that is not there at all (no
   * provider, no self-service settings, an object type that the realm does not
   * offer, settings that Cloud does not offer) counts as none.
   *
   * The answer is "what this library can read", never proof that a journey is
   * unused. An empty array means only that none of the sources above names the
   * journey. Not read, and so not seen: the mapping of authentication context
   * values to journeys of the OAuth2 provider and the `service` part of the
   * "then" clause of an IP or environment policy condition (the format of both
   * has not been seen filled in); a journey that a script chooses at run time
   * (for example through a Configuration Provider node); a journey that an
   * application, an SDK, Amster, a connection profile or a link starts directly
   * by its name; and a journey name inside text (URLs, REST payloads, page
   * text, scripts of IDM endpoints, email templates, login URLs of agents). A
   * node inside a Page Node is seen only if the read of all nodes returns that
   * Page Node (some Page Node versions are missing from it); no node type that
   * names a journey is known to sit inside a Page Node. Do not treat an empty
   * answer as permission to delete.
   *
   * Fails closed: every source is attempted, and if any source cannot be read
   * (including a node of a journey or a policy list that cannot be read in
   * full) the function throws one error that nests one error per source that
   * could not be read and returns no references, so a failed read is never
   * mistaken for "not referenced".
   * @param {string} journeyId journey id/name, the journey that references are looked up for
   * @returns {Promise<JourneyReference[]>} a promise that resolves to every reference found, ordered by source (journeys, authentication settings, self-service journeys, OAuth2 provider, OAuth2 clients, SAML providers, AI agents, agent groups, CIMD profiles, themes, policies) and by id within a source
   */
  findJourneyReferences(journeyId: string): Promise<JourneyReference[]>;
  /**
   * Read journey without dependencies.
   * @param {string} journeyId journey id/name
   * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
   */
  readJourney(journeyId: string): Promise<TreeSkeleton>;
  /**
   * Create journey without dependencies.
   * @param {string} journeyId journey id/name
   * @param {TreeSkeleton} journeyData journey payload object
   * @returns {Promise<TreeSkeleton>} a promise that resolves to a journey object
   */
  createJourney(
    journeyId: string,
    journeyData: TreeSkeleton
  ): Promise<TreeSkeleton>;
  /**
   * Update journey without dependencies.
   * @param {string} journeyId journey id/name
   * @param {TreeSkeleton} journeyData journey payload object
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
   * Resolve journey dependencies: put the journeys of a batch in the order of their dependencies, so that a journey comes after the journeys it needs
   * @param {string[]} installedJorneys Map of installed journeys
   * @param {Record<string, SingleTreeExportInterface>} journeyMap Map of journeys to resolve dependencies for
   * @param {string[]} unresolvedJourneys Map to hold the names of unresolved journeys and their dependencies
   * @param {string[]} resolvedJourneys Array to hold the names of resolved journeys, in the order of their dependencies
   * @param {int} index Number of journeys that were still unresolved after an earlier call, leave it out
   * @remarks A journey that needs a journey of the same batch comes after it, whether that journey is installed or not.
   * A journey that needs a journey outside of the batch needs it to be installed. Journeys that form a circle, or refer to
   * themselves, cannot be ordered: when they are installed they are resolved in the order of the batch, after the journeys
   * that could be ordered; a circle of journeys that are not installed stays unresolved.
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
   * @param {ResultCallback} resultCallback Optional callback to process individual results. When given, the outcome of every journey is passed to it as it happens (the journey, or an error that names the journey) and a failed journey does not throw. Without it, a validation error or a missing dependency rejects the batch before anything is written, and a journey that cannot be written throws. Failing to list the installed journeys always throws.
   * @returns {Promise<TreeSkeleton[]>} a promise that resolves to the journeys that were imported
   * @remarks The journeys are written in the order of their dependencies: a journey that needs another journey of the import
   * data is written after it, whether that journey is installed or not, so an inner journey is written (and a disabled or
   * broken installed copy of it repaired) before the journey that uses it is saved. Journeys that do not need each other keep
   * the order of the import data. Journeys that form a circle, or refer to themselves, cannot be ordered: when they are
   * installed they are written after the journeys that could be ordered, in the order of the import data among themselves.
   *
   * Without a result callback the complete batch is validated before reading installed journeys or
   * writing any journey. If validation fails, the batch is rejected without
   * partially importing valid journeys. With a result callback every journey is an item of its own:
   * a journey that has validation errors, a journey that needs a journey that is neither installed nor in the import data,
   * and a journey that needs a journey of the batch that failed are reported to the callback as failed and are not written;
   * every other journey is imported. A journey is judged when its turn comes, in the order of writing: it is skipped when
   * a journey it needs has failed before. An installed journey that cannot be imported because of its own dependencies
   * still counts as resolved for the journeys that need it, so a journey that needs such a journey can be written before
   * that journey is judged.
   */
  importJourneys(
    importData: MultiTreeExportInterface,
    options: TreeImportOptions,
    resultCallback?: ResultCallback<TreeSkeleton>
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
   * Get tree dependencies (all descendent inner trees). The whole tree is
   * described, to any depth: a sub-journey referenced by several journeys is
   * repeated and expanded in full under every parent. A sub-journey that is
   * already an ancestor on the current path (a cycle), or whose id is in
   * `resolvedTreeIds`, appears as a leaf and is not expanded again. A
   * sub-journey that cannot be resolved appears as a leaf. Each sub-journey is
   * resolved at most once per call.
   * @param {SingleTreeExportInterface} treeExport single tree export
   * @param {TreeExportResolverInterface} resolveTreeExport tree export resolver callback function
   * @param {string[]} resolvedTreeIds list of tree ids that are listed as leaves and not expanded (the list is not modified)
   * @returns {Promise<TreeDependencyMapInterface>} a promise that resolves to a tree dependency map
   */
  getTreeDescendents(
    treeExport: SingleTreeExportInterface,
    resolveTreeExport: TreeExportResolverInterface,
    resolvedTreeIds?: string[]
  ): Promise<TreeDependencyMapInterface>;
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
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   */
  deleteJourneys(
    options: {
      deep: boolean;
      verbose: boolean;
    },
    resultCallback?: ResultCallback<DeleteJourneyStatus>
  ): Promise<DeleteJourneysStatus>;
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
};

export default (state: State): Journey => {
  return {
    createSingleTreeExportTemplate(): SingleTreeExportInterface {
      return createSingleTreeExportTemplate({ state });
    },
    createMultiTreeExportTemplate(): MultiTreeExportInterface {
      return createMultiTreeExportTemplate({ state });
    },
    async validateJourneys(
      journeyIds?: string[],
      journeysExport?: MultiTreeExportInterface,
      resultCallback: ResultCallback<JourneyValidationFinding[]> = undefined
    ): Promise<JourneyValidationFinding[]> {
      return validateJourneys({
        journeyIds,
        journeysExport,
        resultCallback,
        state,
      });
    },
    async exportJourney(
      treeId: string,
      options: TreeExportOptions = {
        useStringArrays: true,
        deps: true,
        coords: true,
      }
    ): Promise<MultiTreeExportInterface> {
      return exportJourney({ journeyId: treeId, options, state });
    },
    async exportJourneys(
      options: TreeExportOptions = {
        useStringArrays: true,
        deps: true,
        coords: true,
      },
      resultCallback = void 0
    ): Promise<MultiTreeExportInterface> {
      return exportJourneys({ options, resultCallback, state });
    },
    async readJourneys(): Promise<TreeSkeleton[]> {
      return readJourneys({ state });
    },
    async countJourneys(): Promise<number> {
      return countJourneys({ state });
    },
    async findScriptReferences(scriptId: string): Promise<ScriptReference[]> {
      return findScriptReferences({ scriptId, state });
    },
    async findJourneyReferences(
      journeyId: string
    ): Promise<JourneyReference[]> {
      return findJourneyReferences({ journeyId, state });
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
      options: TreeImportOptions,
      resultCallback = void 0
    ): Promise<TreeSkeleton[]> {
      return importJourneys({
        importData: treesMap,
        options,
        resultCallback,
        state,
      });
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
    async deleteJourney(
      journeyId: string,
      options: { deep: boolean; verbose: boolean; progress?: boolean }
    ) {
      return deleteJourney({ journeyId, options, state });
    },
    async deleteJourneys(
      options: { deep: boolean; verbose: boolean },
      resultCallback = void 0
    ) {
      return deleteJourneys({ options, resultCallback, state });
    },
    async enableJourney(journeyId: string): Promise<TreeSkeleton> {
      return enableJourney({ journeyId, state });
    },
    async disableJourney(journeyId: string): Promise<TreeSkeleton> {
      return disableJourney({ journeyId, state });
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
   * Include any dependencies specific to AIC (scripts, email templates, SAML entity providers and circles of trust, social identity providers, themes).
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
   * Include any dependencies specific to AIC or Frodo (scripts, email templates, SAML entity providers and circles of trust, social identity providers, themes, custom nodes).
   */
  deps: boolean;
  /**
   * Validate journey node references before import. Defaults to true.
   */
  validate?: boolean;
}

export interface SingleTreeExportInterface {
  meta?: ExportMetaData;
  innerNodes?: Record<string, NodeSkeleton>;
  innernodes?: Record<string, NodeSkeleton>;
  nodeTypes?: Record<string, CustomNodeSkeleton>;
  nodes: Record<string, NodeSkeleton>;
  scripts: Record<string, ScriptSkeleton>;
  emailTemplates: Record<string, EmailTemplateSkeleton>;
  socialIdentityProviders: Record<string, SocialIdpSkeleton>;
  themes: ThemeSkeleton[];
  saml2Entities: Record<string, Saml2ProviderSkeleton>;
  circlesOfTrust: Record<string, CircleOfTrustSkeleton>;
  tree: TreeSkeleton;
  variable: Record<string, VariableSkeleton>;
}

export interface MultiTreeExportInterface {
  meta?: ExportMetaData;
  trees: Record<string, SingleTreeExportInterface>;
}

export interface TreeDependencyMapInterface {
  [k: string]: TreeDependencyMapInterface[];
}

export interface TreeExportResolverInterface {
  (treeId: string, state: State): Promise<SingleTreeExportInterface>;
}

function validateJourneysExport(
  journeys: MultiTreeExportInterface
): JourneyValidationFinding[] {
  return [
    ...Object.values(journeys.trees).flatMap(validateJourneyReferences),
    ...Object.values(journeys.trees).flatMap((journey) =>
      validateJourneyDependencies(journey, hasScriptDependency)
    ),
    ...validateJourneyExportKeys(journeys.trees),
  ];
}

function reportJourneyFindings(
  findings: JourneyValidationFinding[],
  state: State
): void {
  const findingsByJourney = new Map<string, JourneyValidationFinding[]>();
  for (const finding of findings) {
    const journeyFindings = findingsByJourney.get(finding.journeyId) || [];
    journeyFindings.push(finding);
    findingsByJourney.set(finding.journeyId, journeyFindings);
  }
  for (const [journeyId, journeyFindings] of findingsByJourney) {
    const errors = journeyFindings.filter(
      (finding) => finding.severity === 'error'
    ).length;
    const warnings = journeyFindings.length - errors;
    const summary = [
      errors > 0 ? `${errors} error${errors === 1 ? '' : 's'}` : '',
      warnings > 0 ? `${warnings} warning${warnings === 1 ? '' : 's'}` : '',
    ]
      .filter(Boolean)
      .join(' and ');
    printMessage({
      message: `${summary} in journey ${journeyId}`,
      type: 'warn',
      state,
    });
    if (state.getVerbose()) {
      for (const finding of journeyFindings) {
        printMessage({
          message: `[${finding.code}] ${finding.message}`,
          type: 'warn',
          state,
        });
      }
    }
  }
}

/**
 * Short names of the journey validation findings, for the one-line summary of
 * an export of many journeys: `[singular, plural]`.
 */
const JOURNEY_FINDING_LABELS: Record<
  JourneyValidationCode,
  [singular: string, plural: string]
> = {
  MISSING_NODE_DEFINITION: [
    'node without a definition',
    'nodes without a definition',
  ],
  NODE_ID_MISMATCH: ['node ID mismatch', 'node ID mismatches'],
  MISSING_CONNECTION_TARGET: [
    'connection to a missing node',
    'connections to a missing node',
  ],
  MISSING_ENTRY_NODE: ['unresolved entry node', 'unresolved entry nodes'],
  MISSING_INNER_NODE: ['missing inner node', 'missing inner nodes'],
  UNKNOWN_CONNECTION_OUTCOME: [
    'unknown connection outcome',
    'unknown connection outcomes',
  ],
  UNCONNECTED_OUTCOME: ['unconnected outcome', 'unconnected outcomes'],
  UNREACHABLE_NODE: ['unreachable node', 'unreachable nodes'],
  UNREFERENCED_INNER_NODE: [
    'unreferenced inner node',
    'unreferenced inner nodes',
  ],
  UNREPRESENTED_NODE: [
    'node missing from the tree',
    'nodes missing from the tree',
  ],
  PAGE_NODE_OUTCOME_MISMATCH: [
    'page node outcome mismatch',
    'page node outcome mismatches',
  ],
  NO_REACHABLE_TERMINAL: ['without a reachable end', 'without a reachable end'],
  NODE_TYPE_MISMATCH: ['node type mismatch', 'node type mismatches'],
  INNER_NODE_REFERENCED_BY_MULTIPLE_PAGES: [
    'inner node used by several page nodes',
    'inner nodes used by several page nodes',
  ],
  NODE_ID_COLLISION: ['node ID collision', 'node ID collisions'],
  TREE_ID_MISMATCH: ['journey ID mismatch', 'journey ID mismatches'],
  MISSING_SCRIPT_DEPENDENCY: ['missing script', 'missing scripts'],
  MISSING_EMAIL_TEMPLATE_DEPENDENCY: [
    'missing email template',
    'missing email templates',
  ],
  MISSING_THEME_DEPENDENCY: ['missing theme', 'missing themes'],
  MISSING_SOCIAL_IDENTITY_PROVIDER_DEPENDENCY: [
    'missing social identity provider',
    'missing social identity providers',
  ],
  MISSING_SAML_ENTITY_DEPENDENCY: [
    'missing SAML entity',
    'missing SAML entities',
  ],
};

/**
 * Report the findings of an export of many journeys. When the state is
 * verbose: one line per journey and one per finding, as
 * {@link reportJourneyFindings}. Otherwise one line for the whole export, which
 * names how many journeys have findings and how many findings of each kind
 * there are, because a realm of a few hundred journeys would print a line per
 * journey that says nothing about what is wrong. The line states facts only: it
 * never tells the reader how to see more, because how to ask for details is
 * specific to the interface that calls the library.
 * Exported for the unit tests only; it is not part of the `frodo` facade.
 * @param {JourneyValidationFinding[]} findings the findings of all exported journeys
 * @param {number} exportedCount the number of journeys that were exported
 * @param {State} state the state
 */
export function reportJourneyExportFindings(
  findings: JourneyValidationFinding[],
  exportedCount: number,
  state: State
): void {
  if (findings.length === 0) return;
  if (state.getVerbose()) {
    reportJourneyFindings(findings, state);
    return;
  }
  const journeyCount = new Set(findings.map((finding) => finding.journeyId))
    .size;
  const errors = findings.filter(
    (finding) => finding.severity === 'error'
  ).length;
  const warnings = findings.length - errors;
  const countsByCode = new Map<string, number>();
  for (const finding of findings) {
    countsByCode.set(finding.code, (countsByCode.get(finding.code) ?? 0) + 1);
  }
  const kinds = [...countsByCode]
    .map(([code, count]) => {
      const labels = JOURNEY_FINDING_LABELS[code as JourneyValidationCode];
      const label = labels ? labels[count === 1 ? 0 : 1] : code;
      return { count, text: `${count} ${label}` };
    })
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .map(({ text }) => text);
  const severities =
    errors > 0
      ? ` (${[
          `${errors} error${errors === 1 ? '' : 's'}`,
          warnings > 0 ? `${warnings} warning${warnings === 1 ? '' : 's'}` : '',
        ]
          .filter(Boolean)
          .join(' and ')})`
      : '';
  printMessage({
    message: `${journeyCount} of ${exportedCount} ${exportedCount === 1 ? 'journey' : 'journeys'} ${journeyCount === 1 ? 'has' : 'have'} validation findings${severities}: ${kinds.join(', ')}.`,
    type: 'warn',
    state,
  });
}

/**
 * The error for the findings of severity error among the findings that were given, naming the journeys they are about.
 * @returns {FrodoError | undefined} the error, or undefined if there is no finding of severity error
 */
function createJourneyValidationError(
  findings: JourneyValidationFinding[],
  state: State
): FrodoError | undefined {
  const errors = findings.filter((finding) => finding.severity === 'error');
  if (errors.length > 0) {
    const journeyIds = [...new Set(errors.map((finding) => finding.journeyId))];
    const journeyLabel =
      journeyIds.length === 1
        ? `journey '${journeyIds[0]}'`
        : `journeys ${journeyIds.map((journeyId) => `'${journeyId}'`).join(', ')}`;
    return new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} ${journeyLabel}:\n${errors
        .map(
          (finding) =>
            `  - [${finding.code}] ${finding.journeyId}: ${finding.message}`
        )
        .join('\n')}`
    );
  }
  return undefined;
}

function assertNoJourneyErrors(
  findings: JourneyValidationFinding[],
  state: State
): void {
  const error = createJourneyValidationError(findings, state);
  if (error) throw error;
}

const scriptedNodesConditions = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ClientScriptNode: (_nodeConfig: NodeSkeleton): boolean => {
    return true;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ConfigProviderNode: (_nodeConfig: NodeSkeleton): boolean => {
    return true;
  },
  DeviceMatchNode: (nodeConfig: NodeSkeleton): boolean => {
    return nodeConfig.useScript;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  OidcNode: (_nodeConfig: NodeSkeleton): boolean => {
    return true;
  },
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
const treeDependencyNodeTypes = new Set([
  'InnerTreeEvaluatorNode',
  'BackChannelInitNode',
]);

function getTreeDependencyId({
  nodeType,
  nodeConfig,
}: {
  nodeType?: string;
  nodeConfig?: NodeSkeleton;
}): string | undefined {
  const dependencyNodeType = nodeType ?? nodeConfig?._type?._id;
  if (
    !dependencyNodeType ||
    !treeDependencyNodeTypes.has(dependencyNodeType) ||
    typeof nodeConfig?.tree !== 'string'
  ) {
    return undefined;
  }
  return nodeConfig.tree;
}

function collectTreeDependencyIds(
  treeDependencyMap: TreeDependencyMapInterface,
  treeIds: string[] = []
): string[] {
  for (const [treeId, dependencies] of Object.entries(treeDependencyMap)) {
    for (const dependencyMap of dependencies) {
      collectTreeDependencyIds(dependencyMap, treeIds);
    }
    if (!treeIds.includes(treeId)) {
      treeIds.push(treeId);
    }
  }
  return treeIds;
}

function stripExportMetadata(
  exportData: SingleTreeExportInterface
): SingleTreeExportInterface {
  const treeExport = {
    ...exportData,
  };
  delete treeExport.meta;
  return treeExport;
}

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
      NodeRefSkeletonInterface | StaticNodeRefSkeletonInterface
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
        error.message = `Error reading ${getCurrentRealmName(state) + ' realm'} saml2 dependencies: ${
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
    error.message = `Error reading ${getCurrentRealmName(state) + ' realm'} saml2 dependencies: ${
      error.response?.data?.message || error.message
    }`;
    errors.push(error);
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(
      `${getCurrentRealmName(state) + ' realm'} saml2 dependencies error:\n${errorMessages}`
    );
  }
  return saml2NodeDependencies;
}

/**
 * Waits for the reads of the nodes of a journey and returns the nodes that were read. A node that the tenant does not
 * have (a plain 404) is left out; any other failure ends the wait with that failure, as waiting for all of them would.
 * @param {Promise<T>[]} reads the node reads
 * @returns {Promise<T[]>} the nodes that were read
 */
async function settleWithoutMissingNodes<T>(reads: Promise<T>[]): Promise<T[]> {
  const nodes: T[] = [];
  for (const result of await Promise.allSettled(reads)) {
    if (result.status === 'fulfilled') nodes.push(result.value);
    else if (!isNotFoundError(result.reason)) throw result.reason;
  }
  return nodes;
}

/**
 * Create export data for a tree/journey with all its nodes and dependencies. The export data can be written to a file as is.
 * @param {string} journeyId journey id/name
 * @param {TreeExportOptions} options export options
 * @param {boolean} tolerateMissingNodes true to leave out a node that the tenant does not have (a plain 404) instead of failing the export; only the validation of journeys sets it, because it reports such a node as a finding and an export written to a file must be complete. Default: false
 * @returns {Promise<SingleTreeExportInterface>} a promise that resolves to an object containing the tree and all its nodes and dependencies
 */
async function exportSingleJourney({
  journeyId,
  options = {
    useStringArrays: true,
    deps: true,
    coords: true,
  },
  tolerateMissingNodes = false,
  state,
}: {
  journeyId: string;
  options?: TreeExportOptions;
  tolerateMissingNodes?: boolean;
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

    const variables: Record<string, VariableSkeleton> = {};
    const nodePromises = [];
    const scriptPromises = [];
    const customNodePromises = [];
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
        readNode({
          nodeId,
          nodeType: nodeInfo['nodeType'],
          nodeTypeVersion: nodeInfo['version'] || '1.0',
          state,
        })
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
    const nodeObjects = tolerateMissingNodes
      ? await settleWithoutMissingNodes(nodePromises)
      : await Promise.all(nodePromises);

    // iterate over every node in tree
    for (const nodeObject of nodeObjects) {
      const nodeId: string = nodeObject._id;
      const nodeType: string = nodeObject._type._id;
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

      // handle custom node types
      if (
        deps &&
        nodeObject._type?._id &&
        nodeObject._type._id.startsWith('designer-')
      ) {
        customNodePromises.push(
          readCustomNode({
            nodeId: nodeObject._type._id.substring(9) + '-1',
            state,
          })
        );
      }

      // frodo supports email templates in platform deployments
      if (deps && isPlatformDeployment) {
        if (emailTemplateNodes.includes(nodeType)) {
          try {
            const emailTemplate = await readEmailTemplate({
              templateId: await resolveVariable({
                input: nodeObject.emailTemplateName,
                variables,
                state,
              }),
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
        nodeType.startsWith('SocialProviderHandlerNode')
      ) {
        socialProviderPromise = readSocialIdentityProviders({ state });
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
      if (JOURNEY_CONTAINER_NODE_TYPES.includes(nodeType)) {
        for (const innerNode of nodeObject.nodes) {
          debugMessage({
            message: `JourneyOps.exportJourney: reading inner node [node=${innerNode._id}]`,
            state,
          });
          debugMessage({
            message: innerNode,
            state,
          });
          innerNodePromises.push(
            readNode({
              nodeId: innerNode._id,
              nodeType: innerNode.nodeType,
              nodeTypeVersion: innerNode.nodeVersion || '1.0',
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
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
              themeId = false;
            }
            // if the page node's themeId is set the "old way" set themeId accordingly
            if (!themeId && nodeObject.stage.indexOf('themeId=') === 0) {
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
          const innerNodeId: string = innerNodeObject._id;
          const innerNodeType: string = innerNodeObject._type._id;
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

          // handle custom node types
          if (
            deps &&
            innerNodeObject._type?._id &&
            innerNodeObject._type._id.startsWith('designer-')
          ) {
            customNodePromises.push(
              readCustomNode({
                nodeId: innerNodeObject._type._id.substring(9) + '-1',
                state,
              })
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
            innerNodeType.startsWith('SocialProviderHandlerNode')
          ) {
            socialProviderPromise = readSocialIdentityProviders({ state });
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
        } else if (
          settledPromise.status === 'rejected' &&
          !(tolerateMissingNodes && isNotFoundError(settledPromise.reason))
        ) {
          errors.push(new FrodoError(settledPromise.reason));
        }
      }
    } catch (error) {
      errors.push(
        new FrodoError(
          `Error reading ${getCurrentRealmName(state) + ' realm'} inner nodes`,
          error
        )
      );
    }

    // Process variables
    exportData.variable = variables;
    if (verbose && Object.keys(variables).length > 0) {
      printMessage({
        message: '\n  - Variables:',
        newline: false,
        state,
      });
      for (const variable of Object.values(variables)) {
        printMessage({
          message: `\n    - ${variable._id}`,
          type: 'info',
          newline: false,
          state,
        });
      }
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
      errors.push(
        new FrodoError(
          `Error reading ${getCurrentRealmName(state) + ' realm'} saml2 dependencies`,
          error
        )
      );
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
        for (const socialProvider of socialProviders) {
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
        new FrodoError(
          `Error reading ${getCurrentRealmName(state) + ' realm'} social identity providers`,
          error
        )
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
      errors.push(
        new FrodoError(
          `Error reading ${getCurrentRealmName(state) + ' realm'} scripts`,
          error
        )
      );
    }

    // Process custom nodes
    if (verbose && customNodePromises.length > 0)
      printMessage({ message: '\n  - Custom Nodes:', newline: false, state });
    try {
      const customNodeObjects = await Promise.all(customNodePromises);
      for (const customNodeObject of customNodeObjects) {
        if (!customNodeObject) continue;
        if (verbose)
          printMessage({
            message: `\n    - ${customNodeObject._id} (${customNodeObject.displayName})`,
            type: 'info',
            newline: false,
            state,
          });
        if (useStringArrays)
          customNodeObject.script = (customNodeObject.script as string).split(
            '\n'
          );
        if (!exportData.nodeTypes) exportData.nodeTypes = {};
        exportData.nodeTypes[customNodeObject._id] = customNodeObject;
      }
    } catch (error) {
      errors.push(new FrodoError(`Error reading custom nodes`, error));
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
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}`,
      errors
    );
  }
  debugMessage({
    message: `JourneyOps.exportJourney: end [journey=${journeyId}]`,
    state,
  });
  return exportData;
}

/**
 * Validate journeys from an export or from the active tenant. Every requested journey is processed: a journey that is missing, blank or unreadable does not stop the others.
 * A node that the tree names and the tenant does not have (a plain 404 when it is read) is a finding of the journey (MISSING_NODE_DEFINITION for a node of the tree, MISSING_INNER_NODE for a node of a Page Node), not a reason to fail it; any other failure to read a node fails the journey.
 * @param {string[]} journeyIds journey names; omit or pass an empty array to validate all journeys
 * @param {MultiTreeExportInterface} journeysExport optional export; when supplied, validation is offline
 * @param {ResultCallback<JourneyValidationFinding[]>} resultCallback Optional callback to process individual results. When given, the outcome of every journey is passed to it as it happens (the findings of the journey, an empty array when there are none, or an error that names the journey) and a failed journey does not throw. Without it, the failed journeys are collected and thrown as one error after all journeys were processed. Failing to list the journeys of the realm, and invalid arguments, always throw.
 * @returns {Promise<JourneyValidationFinding[]>} a promise that resolves to the findings of all journeys that could be validated
 * @throws {FrodoError} If an argument is invalid or the journeys cannot be listed (always), or if one or more journeys cannot be validated and there is no result callback. The error carries one nested error per failed journey, naming it.
 */
export async function validateJourneys({
  journeyIds,
  journeysExport,
  resultCallback,
  state,
}: {
  journeyIds?: string[];
  journeysExport?: MultiTreeExportInterface;
  resultCallback?: ResultCallback<JourneyValidationFinding[]>;
  state: State;
}): Promise<JourneyValidationFinding[]> {
  const findings: JourneyValidationFinding[] = [];
  const errors: FrodoError[] = [];
  // a validated journey goes to the result and to the callback
  const succeed = (journeyFindings: JourneyValidationFinding[]) => {
    findings.push(...journeyFindings);
    if (resultCallback) resultCallback(undefined, journeyFindings);
  };
  // a failure goes to the callback, or is collected to be thrown after every journey was processed
  const fail = (error: FrodoError) => {
    if (resultCallback) resultCallback(error, undefined);
    else errors.push(error);
  };
  const realm = `${getCurrentRealmName(state)} realm`;
  const errorMessage = `Error validating ${realm} journeys`;
  if (
    journeyIds != null &&
    (!Array.isArray(journeyIds) ||
      !journeyIds.every((journeyId) => typeof journeyId === 'string'))
  ) {
    throw new FrodoError(
      errorMessage,
      new Error('journeyIds must be an array of strings')
    );
  }
  if (
    journeysExport !== undefined &&
    (!journeysExport ||
      typeof journeysExport !== 'object' ||
      !journeysExport.trees ||
      typeof journeysExport.trees !== 'object' ||
      Array.isArray(journeysExport.trees))
  ) {
    throw new FrodoError(
      errorMessage,
      new Error(
        'journeysExport must contain a trees map (a multi-journey export); wrap a single-journey export as { trees: { <id>: export } }'
      )
    );
  }
  const requestedIds = journeyIds?.length
    ? [...new Set(journeyIds)]
    : undefined;
  let ids = requestedIds;

  if (!ids && journeysExport) {
    ids = Object.keys(journeysExport.trees);
  } else if (!ids) {
    try {
      ids = [
        ...new Set((await readJourneys({ state })).map((tree) => tree._id)),
      ];
    } catch (error) {
      errors.push(
        error instanceof FrodoError
          ? error
          : new FrodoError(`Error validating ${realm} journeys`, error)
      );
    }
  }

  for (const journeyId of ids || []) {
    const message = `Error validating ${realm} journey '${journeyId}'`;
    if (typeof journeyId !== 'string' || !journeyId.trim()) {
      fail(new FrodoError(message, new Error('Journey ID must not be blank')));
      continue;
    }

    if (journeysExport) {
      const journey = journeysExport.trees[journeyId];
      if (!journey) {
        fail(
          new FrodoError(
            message,
            new Error(`Journey '${journeyId}' not found in supplied export`)
          )
        );
        continue;
      }
      succeed(validateJourneysExport({ trees: { [journeyId]: journey } }));
      continue;
    }

    let journeyFindings: JourneyValidationFinding[];
    let failure: FrodoError;
    try {
      // a node that the tenant does not have is a finding of the validation
      // (MISSING_NODE_DEFINITION, MISSING_INNER_NODE), not a reason to fail
      const journey = await exportSingleJourney({
        journeyId,
        options: { deps: false, useStringArrays: true, coords: false },
        tolerateMissingNodes: true,
        state,
      });
      journeyFindings = validateJourneyReferences(journey);
    } catch (error) {
      failure = new FrodoError(message, error);
    }
    if (failure) fail(failure);
    else succeed(journeyFindings);
  }

  if (errors.length > 0) {
    throw new FrodoError(`Error validating ${realm} journeys`, errors);
  }
  return findings;
}

/**
 * Create export data for a tree/journey with all its nodes and dependencies. The export data can be written to a file as is.
 * @param {string} journeyId journey id/name
 * @param {TreeExportOptions} options export options
 * @returns {Promise<MultiTreeExportInterface>} a promise that resolves to an object containing the tree and any exported dependencies
 */
export async function exportJourney({
  journeyId,
  options = {
    useStringArrays: true,
    deps: true,
    coords: true,
  },
  resolveTreeExport = onlineTreeExportResolver,
  state,
}: {
  journeyId: string;
  options?: TreeExportOptions;
  resolveTreeExport?: TreeExportResolverInterface;
  state: State;
}): Promise<MultiTreeExportInterface> {
  const exportData = await exportSingleJourney({ journeyId, options, state });
  if (!options.deps) {
    const multiTreeExport = createMultiTreeExportTemplate({ state });
    multiTreeExport.trees[journeyId] = stripExportMetadata(exportData);
    reportJourneyFindings(validateJourneysExport(multiTreeExport), state);
    return multiTreeExport;
  }
  const treeDependencyMap = await getTreeDescendents({
    treeExport: exportData,
    resolveTreeExport,
    resolvedTreeIds: [],
    state,
  });
  const dependencyTreeIds = collectTreeDependencyIds(treeDependencyMap).filter(
    (treeId) => treeId !== journeyId
  );
  const multiTreeExport = createMultiTreeExportTemplate({ state });
  for (const dependencyTreeId of dependencyTreeIds) {
    const dependencyExport =
      resolveTreeExport === onlineTreeExportResolver
        ? await exportSingleJourney({
            journeyId: dependencyTreeId,
            options,
            state,
          })
        : await resolveTreeExport(dependencyTreeId, state);
    multiTreeExport.trees[dependencyTreeId] =
      stripExportMetadata(dependencyExport);
  }
  multiTreeExport.trees[journeyId] = stripExportMetadata(exportData);
  reportJourneyFindings(validateJourneysExport(multiTreeExport), state);
  return multiTreeExport;
}

/**
 * Create export data for all trees/journeys with all their nodes and dependencies. The export data can be written to a file as is.
 * @param {TreeExportOptions} options export options
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 * @returns {Promise<MultiTreeExportInterface>} a promise that resolves to an object containing the trees and all their nodes and dependencies
 */
export async function exportJourneys({
  options = {
    useStringArrays: true,
    deps: true,
    coords: true,
  },
  resultCallback = void 0,
  state,
}: {
  options?: TreeExportOptions;
  resultCallback?: ResultCallback<SingleTreeExportInterface>;
  state: State;
}): Promise<MultiTreeExportInterface> {
  const multiTreeExport = createMultiTreeExportTemplate({ state });
  const trees = await readJourneys({ state });
  const indicatorId = createProgressIndicator({
    total: trees.length,
    message: `Exporting ${getCurrentRealmName(state) + ' realm'} journeys...`,
    state,
  });
  const findings: JourneyValidationFinding[] = [];
  let exportedCount = 0;
  for (const tree of trees) {
    const exportData: SingleTreeExportInterface = await getResult(
      resultCallback,
      `Error exporting the ${getCurrentRealmName(state) + ' realm'} journey ${tree._id}`,
      exportSingleJourney,
      {
        journeyId: tree._id,
        options,
        state,
      }
    );
    if (exportData) {
      findings.push(
        ...validateJourneysExport({ trees: { [tree._id]: exportData } })
      );
      delete exportData.meta;
      multiTreeExport.trees[tree._id] = exportData;
      exportedCount++;
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting ${getCurrentRealmName(state) + ' realm'} journey ${tree._id}`,
        state,
      });
    }
  }
  reportJourneyExportFindings(findings, exportedCount, state);
  stopProgressIndicator({
    id: indicatorId,
    message: `Exported ${
      exportedCount === trees.length
        ? exportedCount
        : `${exportedCount} of ${trees.length}`
    } ${getCurrentRealmName(state) + ' realm'} journeys.`,
    state,
  });
  return multiTreeExport;
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
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} journeys`,
      error
    );
  }
}

/** A single journey/node reference to a script, found by {@link findScriptReferences}. */
export type ScriptReference = {
  journeyId: string;
  /** The top-level node id a journey's own node map actually references. */
  nodeId: string;
  nodeType: string;
  nodeDisplayName?: string;
  /**
   * Present when the script-referencing node is nested inside a container
   * node (e.g. a Page Node) rather than being the top-level node itself —
   * this is the inner node's id, distinct from `nodeId` (the container).
   */
  innerNodeId?: string;
};

/**
 * Finds every journey/node in the active realm that references a given
 * script, via two bulk realm-scoped reads (all nodes, all journeys) and an
 * in-memory join — no per-node fetches, so this stays cheap even on realms
 * with many journeys.
 * @param {string} scriptId script id to find references to
 * @returns {Promise<ScriptReference[]>} a promise that resolves to every reference found
 */
export async function findScriptReferences({
  scriptId,
  state,
}: {
  scriptId: string;
  state: State;
}): Promise<ScriptReference[]> {
  try {
    const [nodes, journeys] = await Promise.all([
      readNodes({ state }),
      readJourneys({ state }),
    ]);

    const matchingNodeIds = new Set(
      nodes.filter((node) => node.script === scriptId).map((node) => node._id)
    );
    if (matchingNodeIds.size === 0) {
      return [];
    }

    // Inner nodes (e.g. inside a Page Node) are real node instances too, but
    // a journey's own node map only ever references the container's id, not
    // the inner node's — resolve inner id -> container id so those matches
    // can still be attributed to the right journey.
    const containerByInnerNodeId = new Map<string, string>();
    for (const node of nodes) {
      for (const inner of node.nodes ?? []) {
        containerByInnerNodeId.set(inner._id, node._id);
      }
    }

    const matchesByTopLevelNodeId = new Map<
      string,
      { innerNodeId?: string }[]
    >();
    for (const matchId of matchingNodeIds) {
      const containerId = containerByInnerNodeId.get(matchId);
      const topLevelId = containerId ?? matchId;
      const existing = matchesByTopLevelNodeId.get(topLevelId) ?? [];
      existing.push(containerId ? { innerNodeId: matchId } : {});
      matchesByTopLevelNodeId.set(topLevelId, existing);
    }

    const references: ScriptReference[] = [];
    for (const journey of journeys) {
      for (const [nodeId, nodeRef] of Object.entries(journey.nodes ?? {})) {
        for (const match of matchesByTopLevelNodeId.get(nodeId) ?? []) {
          references.push({
            journeyId: journey._id,
            nodeId,
            nodeType: nodeRef.nodeType,
            nodeDisplayName: nodeRef.displayName,
            ...(match.innerNodeId && { innerNodeId: match.innerNodeId }),
          });
        }
      }
    }
    return references;
  } catch (error) {
    throw new FrodoError(
      `Error finding references to script ${scriptId}`,
      error
    );
  }
}

/**
 * The `source` values of a {@link JourneyReference}, in one place: the key says
 * what the holder is, the value is what a caller reads in the result. A rename
 * of a value is one edit here (and the places that quote it in text).
 */
export const JOURNEY_REFERENCE_SOURCES = {
  journey: 'journey',
  authenticationSettings: 'authentication-settings',
  selfServiceTrees: 'self-service-trees',
  oauth2Provider: 'oauth2-provider',
  oauth2Client: 'oauth2-client',
  saml2Provider: 'saml2-provider',
  aiAgent: 'ai-agent',
  agentGroup: 'agent-group',
  cimdProfile: 'cimd-profile',
  theme: 'theme',
  policy: 'policy',
} as const;

/**
 * How much a holder depends on the journey it names. The words are the ones of
 * the policy import code: a `hard` dependency breaks the holder at run time
 * without the journey, a `soft` dependency does not (the holder works
 * without it). The flag says what happens to the holder, not what Access
 * Management does when the journey is deleted: a `hard` holder is not
 * necessarily protected (see {@link findJourneyReferences} for what was
 * observed).
 */
export type JourneyReferenceDependency = ReferenceDependency;

/**
 * One place that names a journey, found by {@link findJourneyReferences}.
 * `source` says which holder it is; the other fields say where in that holder
 * the name was found (`from` is the Access Management field path), and
 * `dependency` says how much the holder depends on the journey: `hard` means
 * the holder breaks at run time without it, `soft` means the holder works
 * without it (for example a theme that stops being applied to the journey).
 * The flag is a property of the holder and its field, not a check of the
 * tenant. An empty answer is never proof that a journey is unused, see
 * {@link findJourneyReferences}.
 */
export type JourneyReference = {
  dependency: JourneyReferenceDependency;
} & (
  | {
      /** Another journey: one of its nodes names the journey. */
      source: typeof JOURNEY_REFERENCE_SOURCES.journey;
      /** The journey that holds the reference (not the journey that was looked up). */
      journeyId: string;
      /** The top-level node id a journey's own node map actually references. */
      nodeId: string;
      nodeType: string;
      nodeDisplayName?: string;
      /**
       * Present when the node that names the journey is nested inside a
       * container node (e.g. a Page Node) rather than being the top-level node
       * itself: this is the inner node's id, distinct from `nodeId` (the
       * container).
       */
      innerNodeId?: string;
    }
  | {
      /** A realm setting: the default authentication journeys, the self-service journeys or the OAuth2 provider. */
      source:
        | typeof JOURNEY_REFERENCE_SOURCES.authenticationSettings
        | typeof JOURNEY_REFERENCE_SOURCES.selfServiceTrees
        | typeof JOURNEY_REFERENCE_SOURCES.oauth2Provider;
      /** The field of the setting that holds the name, as a dotted path (for example `core.orgConfig`). */
      from: string;
    }
  | {
      /** An object that names the journey in a field of its own. */
      source:
        | typeof JOURNEY_REFERENCE_SOURCES.oauth2Client
        | typeof JOURNEY_REFERENCE_SOURCES.saml2Provider
        | typeof JOURNEY_REFERENCE_SOURCES.aiAgent
        | typeof JOURNEY_REFERENCE_SOURCES.agentGroup
        | typeof JOURNEY_REFERENCE_SOURCES.cimdProfile
        | typeof JOURNEY_REFERENCE_SOURCES.theme;
      /** The id of the object: the client id, the entity id of the provider, the agent, group, profile or theme id. */
      id: string;
      /** The name of the object, where it has one (themes). */
      name?: string;
      /** The field that holds the name, as a dotted path (for example `advancedOAuth2ClientConfig.treeName` or `linkedTrees`). */
      from: string;
      /**
       * Present, and `true`, when the object does not hold the name itself but
       * inherits it (Access Management's `inherited: true`): an agent whose
       * group sets the journey. The group is reported as well when it holds
       * the value.
       */
      inherited?: true;
    }
  | {
      /** A policy with a condition that names the journey. */
      source: typeof JOURNEY_REFERENCE_SOURCES.policy;
      /** The id of the policy. */
      id: string;
      name?: string;
      /** The policy set of the policy (the `applicationName` of Access Management), the same policy id can be in two sets. */
      applicationName: string;
      /** The condition property that holds the name (for example `condition.authenticateToService`); the condition can be nested. */
      from: string;
    }
);

/**
 * How a property holds journey names: `single` is one name, `list` is an array
 * of names, `map` is an object whose values are names (every value counts,
 * whatever its key).
 */
export type JourneyNameShape = 'single' | 'list' | 'map';

/** A field that holds journey names: its dotted path in the holder (this is also the `from` of a result) and its shape. */
export type JourneyReferenceField = { from: string; shape: JourneyNameShape };

/**
 * A node type whose configuration names a journey, and where. Adding a node
 * type that takes a journey name is adding a row to
 * {@link journeyReferenceNodeRows}.
 */
export type JourneyReferenceNodeRow = {
  /** The node type id, for example `InnerTreeEvaluatorNode`. */
  nodeType: string;
  /** The property of the node configuration that holds the name, as a dotted path. */
  property: string;
  shape: JourneyNameShape;
  /** How much a journey that has such a node depends on the journey the node names. */
  dependency: JourneyReferenceDependency;
};

/**
 * The node types that name a journey in their configuration: the only two of
 * the standard and custom node types of a Cloud tenant that have a journey
 * property. These are also the types that the export of a journey treats as
 * dependencies (`treeDependencyNodeTypes`).
 */
export const journeyReferenceNodeRows: readonly JourneyReferenceNodeRow[] = [
  {
    nodeType: 'InnerTreeEvaluatorNode',
    property: 'tree',
    shape: 'single',
    dependency: 'hard',
  },
  {
    nodeType: 'BackChannelInitNode',
    property: 'tree',
    shape: 'single',
    dependency: 'hard',
  },
];

/**
 * A policy condition type that names a journey, and where. Adding a condition
 * type is adding a row to {@link journeyReferencePolicyConditionRows}.
 */
export type JourneyReferencePolicyConditionRow = {
  /** The condition type, for example `AuthenticateToService`. */
  conditionType: string;
  /** The property of the condition that holds the name. */
  property: string;
  shape: JourneyNameShape;
  /** The condition names a journey only when this property of the condition has this value (other values are not journeys). */
  when?: { property: string; equals: string };
  /** How much the policy depends on the journey the condition names. */
  dependency: JourneyReferenceDependency;
};

/**
 * The policy conditions that name a journey. `AuthenticateToService` holds the
 * journey in `authenticateToService`. `Transaction` holds it in
 * `strategySpecifier` only for the strategy `AuthenticateToTreeConditionAdvice`;
 * the other strategies hold a realm, a level or a module there.
 */
export const journeyReferencePolicyConditionRows: readonly JourneyReferencePolicyConditionRow[] =
  [
    {
      conditionType: 'AuthenticateToService',
      property: 'authenticateToService',
      shape: 'single',
      dependency: 'hard',
    },
    {
      conditionType: 'Transaction',
      property: 'strategySpecifier',
      shape: 'single',
      when: {
        property: 'authenticationStrategy',
        equals: 'AuthenticateToTreeConditionAdvice',
      },
      dependency: 'hard',
    },
  ];

/** The placeholder that a journey picker of Access Management shows for "no journey". */
const NO_JOURNEY = '[Empty]';

/**
 * The one normaliser for what a field holds: a plain string, the wrapped form
 * `{ inherited, value }` that agents, groups, profiles and clients read in, or
 * the placeholder for "no journey". Returns the journey name and whether the
 * holder inherits it (`inherited: true` in the wrapped form), or undefined if
 * the field names none.
 */
function normaliseJourneyName(
  value: unknown
): { name: string; inherited: boolean } | undefined {
  let name = value;
  let inherited = false;
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const wrapped = value as { inherited?: unknown; value?: unknown };
    inherited = wrapped.inherited === true;
    name = wrapped.value;
  }
  return typeof name === 'string' && name !== '' && name !== NO_JOURNEY
    ? { name, inherited }
    : undefined;
}

/**
 * The journey names that a field of a holder names, each with the path of the
 * field it was found in (for a `map`, the path of the value: `path.key`).
 * Anything that is not a name (a missing field, a number, an array where a
 * string is expected, the placeholder) is skipped.
 */
function readJourneyNames(
  holder: unknown,
  path: string,
  shape: JourneyNameShape
): { from: string; name: string; inherited: boolean }[] {
  let value: unknown = holder;
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object') return [];
    value = (value as Record<string, unknown>)[key];
  }
  let entries: [string, unknown][] = [];
  if (shape === 'single') {
    entries = [[path, value]];
  } else if (shape === 'list') {
    entries = Array.isArray(value) ? value.map((item) => [path, item]) : [];
  } else if (
    shape === 'map' &&
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    entries = Object.entries(value).map(([key, item]) => [
      `${path}.${key}`,
      item,
    ]);
  }
  return entries.flatMap(([from, item]) => {
    const named = normaliseJourneyName(item);
    return named === undefined ? [] : [{ from, ...named }];
  });
}

/**
 * The fields of a holder that name a journey, as their paths, in the order of
 * the fields, each once, with whether the holder only inherits the name there
 * (it does if every entry of that path that names the journey is inherited).
 */
function findNamingFields(
  holder: unknown,
  fields: readonly JourneyReferenceField[],
  journeyId: string
): { from: string; inherited: boolean }[] {
  const found = new Map<string, boolean>();
  for (const field of fields) {
    for (const entry of readJourneyNames(holder, field.from, field.shape)) {
      if (entry.name === journeyId) {
        found.set(
          entry.from,
          (found.get(entry.from) ?? true) && entry.inherited
        );
      }
    }
  }
  return [...found].map(([from, inherited]) => ({ from, inherited }));
}

/** The data of the one set of reads that feeds the join: one entry per source. */
export type JourneyReferenceReads = ReferenceReads<JourneyReference['source']>;

/**
 * One source of {@link findJourneyReferences}: what is read, and how the
 * references to one journey are found in it (the shared row of the reference
 * lookups, see `internal/ReferenceLookup.ts`).
 */
export type JourneyReferenceSource = ReferenceSource<
  JourneyReference['source'],
  JourneyReference
>;

/** Make a source row from typed reader and matcher. */
function defineReferenceSource<T>(row: {
  source: JourneyReference['source'];
  label: string;
  appliesTo?: (state: State) => boolean;
  read: (state: State) => Promise<T>;
  find: (data: T, journeyId: string) => JourneyReference[];
}): JourneyReferenceSource {
  return defineSource<JourneyReference['source'], JourneyReference, T>(row);
}

/**
 * A source that reads one realm setting: its row says which fields hold a
 * journey name. Adding a field is a row entry, adding a setting is a row and a
 * reader.
 */
export function defineSettingSource<T>(row: {
  source:
    | typeof JOURNEY_REFERENCE_SOURCES.authenticationSettings
    | typeof JOURNEY_REFERENCE_SOURCES.selfServiceTrees
    | typeof JOURNEY_REFERENCE_SOURCES.oauth2Provider;
  label: string;
  read: (state: State) => Promise<T>;
  fields: readonly JourneyReferenceField[];
  /** How much the realm depends on the journeys these fields name. */
  dependency: JourneyReferenceDependency;
}): JourneyReferenceSource {
  return defineReferenceSource<T>({
    source: row.source,
    label: row.label,
    read: row.read,
    find: (setting, journeyId) =>
      findNamingFields(setting, row.fields, journeyId).map(({ from }) => ({
        source: row.source,
        dependency: row.dependency,
        from,
      })),
  });
}

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

/**
 * A source that reads a list of objects (clients, providers, agents, themes):
 * its row says how to read them, which field is their id and which fields hold
 * a journey name. Adding an object type is a row and a reader.
 */
export function defineHolderSource<T>(row: {
  source:
    | typeof JOURNEY_REFERENCE_SOURCES.oauth2Client
    | typeof JOURNEY_REFERENCE_SOURCES.saml2Provider
    | typeof JOURNEY_REFERENCE_SOURCES.aiAgent
    | typeof JOURNEY_REFERENCE_SOURCES.agentGroup
    | typeof JOURNEY_REFERENCE_SOURCES.cimdProfile
    | typeof JOURNEY_REFERENCE_SOURCES.theme;
  label: string;
  appliesTo?: (state: State) => boolean;
  read: (state: State) => Promise<T[]>;
  idOf: (holder: T) => string;
  nameOf?: (holder: T) => string | undefined;
  fields: readonly JourneyReferenceField[];
  /** How much such an object depends on the journey it names. */
  dependency: JourneyReferenceDependency;
}): JourneyReferenceSource {
  return defineReferenceSource<T[]>({
    source: row.source,
    label: row.label,
    appliesTo: row.appliesTo,
    read: row.read,
    find: (holders, journeyId) =>
      holders
        .flatMap((holder) =>
          findNamingFields(holder, row.fields, journeyId).map(
            ({ from, inherited }) => {
              const name = row.nameOf?.(holder);
              return {
                source: row.source,
                dependency: row.dependency,
                id: row.idOf(holder),
                ...(name !== undefined && { name }),
                from,
                ...(inherited && { inherited: true as const }),
              };
            }
          )
        )
        .sort(byId),
  });
}

type JourneyNodeEdge = {
  /** The journey that the node names. */
  namedJourneyId: string;
  /** The reference to report, if the journey that is looked up is the named one. */
  reference: Extract<
    JourneyReference,
    { source: typeof JOURNEY_REFERENCE_SOURCES.journey }
  >;
};

/**
 * Every (journey, node, named journey) edge of the realm. Pure: it joins the
 * node map of each journey to the node configurations by node id, so a node
 * that no journey references is ignored, and it looks inside container nodes
 * (a Page Node lists its inner nodes) the way `findScriptReferences` does,
 * reporting the top-level node together with the inner node. Which node types
 * and properties name a journey is in `rows`.
 */
function collectJourneyNodeEdges({
  journeys,
  nodes,
  rows,
}: {
  journeys: TreeSkeleton[];
  nodes: NodeSkeleton[];
  rows: readonly JourneyReferenceNodeRow[];
}): JourneyNodeEdge[] {
  const configById = new Map<string, NodeSkeleton>();
  for (const node of nodes) configById.set(node._id, node);
  // one edge per holder and name; if two rows name the same one, hard wins
  const edgeByKey = new Map<string, JourneyNodeEdge>();
  for (const journey of journeys) {
    for (const [nodeId, nodeRef] of Object.entries(journey.nodes ?? {})) {
      const config = configById.get(nodeId);
      // the node itself, then the nodes inside it if it is a container
      const holders: { id: string; type?: string; innerNodeId?: string }[] = [
        { id: nodeId, type: nodeRef.nodeType },
        ...(config?.nodes ?? []).map((inner) => ({
          id: inner._id,
          type: inner.nodeType,
          innerNodeId: inner._id,
        })),
      ];
      for (const holder of holders) {
        const holderConfig = configById.get(holder.id);
        const holderType = holder.type ?? holderConfig?._type?._id;
        for (const row of rows) {
          if (row.nodeType !== holderType) continue;
          for (const { name: namedJourneyId } of readJourneyNames(
            holderConfig,
            row.property,
            row.shape
          )) {
            const key = JSON.stringify([
              journey._id,
              nodeId,
              holder.innerNodeId,
              namedJourneyId,
            ]);
            const known = edgeByKey.get(key);
            if (known) {
              if (row.dependency === 'hard') {
                known.reference.dependency = 'hard';
              }
              continue;
            }
            edgeByKey.set(key, {
              namedJourneyId,
              reference: {
                source: JOURNEY_REFERENCE_SOURCES.journey,
                dependency: row.dependency,
                journeyId: journey._id,
                nodeId,
                nodeType: nodeRef.nodeType,
                nodeDisplayName: nodeRef.displayName,
                ...(holder.innerNodeId && { innerNodeId: holder.innerNodeId }),
              },
            });
          }
        }
      }
    }
  }
  return [...edgeByKey.values()].sort(
    (a, b) =>
      a.reference.journeyId.localeCompare(b.reference.journeyId) ||
      a.reference.nodeId.localeCompare(b.reference.nodeId) ||
      (a.reference.innerNodeId ?? '').localeCompare(
        b.reference.innerNodeId ?? ''
      )
  );
}

/**
 * Read the journeys and the nodes. The bulk node read asks for one version of
 * every node type and does not return every node (some versions are missing),
 * so a node of a type that names a journey that a journey references and the
 * bulk read lacks is read by its id, and so is such a node inside a container
 * node (a Page Node) that the bulk read returned. If such a node cannot be
 * read the source fails (one nested error per node): a node that cannot be
 * read is never skipped, because it could be the one that names the journey.
 * The limit: if the bulk read lacks the container node itself, the nodes inside
 * it are not known and are not read.
 */
async function readJourneysAndNodes({ state }: { state: State }): Promise<{
  journeys: TreeSkeleton[];
  nodes: NodeSkeleton[];
}> {
  const [journeys, nodes] = await Promise.all([
    readJourneys({ state }),
    readNodes({ state }),
  ]);
  const read = new Map(nodes.map((node) => [node._id, node]));
  const namesJourney = (nodeType: string) =>
    journeyReferenceNodeRows.some((row) => row.nodeType === nodeType);
  const lacking = new Map<
    string,
    { journeyId: string; nodeType: string; version: string }
  >();
  for (const journey of journeys) {
    for (const [nodeId, nodeRef] of Object.entries(journey.nodes ?? {})) {
      if (
        !read.has(nodeId) &&
        !lacking.has(nodeId) &&
        namesJourney(nodeRef.nodeType)
      ) {
        lacking.set(nodeId, {
          journeyId: journey._id,
          nodeType: nodeRef.nodeType,
          version: nodeRef['version'] || '1.0',
        });
      }
      // the nodes inside a container that was read (a Page Node) are the same
      for (const inner of read.get(nodeId)?.nodes ?? []) {
        if (
          !read.has(inner._id) &&
          !lacking.has(inner._id) &&
          namesJourney(inner.nodeType)
        ) {
          lacking.set(inner._id, {
            journeyId: journey._id,
            nodeType: inner.nodeType,
            version: inner['nodeVersion'] || inner['version'] || '1.0',
          });
        }
      }
    }
  }
  const ids = [...lacking.keys()];
  const settled = await Promise.allSettled(
    ids.map(async (nodeId) =>
      readNode({
        nodeId,
        nodeType: lacking.get(nodeId).nodeType,
        nodeTypeVersion: lacking.get(nodeId).version,
        state,
      })
    )
  );
  const errors: FrodoError[] = [];
  const found: NodeSkeleton[] = [];
  settled.forEach((result, index) => {
    const { journeyId, nodeType } = lacking.get(ids[index]);
    if (result.status === 'fulfilled') {
      found.push(result.value);
    } else {
      errors.push(
        new FrodoError(
          `Error reading ${nodeType} node ${ids[index]} of journey ${journeyId}`,
          result.reason
        )
      );
    }
  });
  if (errors.length > 0) {
    throw new FrodoError(
      `Error reading the nodes that the bulk node read lacks: ${errors.map((error) => error.message).join('; ')}`,
      errors
    );
  }
  return { journeys, nodes: [...nodes, ...found] };
}

/** A SAML service provider as read, with the entity id of its stub. */
type Saml2ServiceProvider = { entityId: string; [key: string]: unknown };

/**
 * Read the profiles of every SAML service provider. The list of providers is
 * read once; only the entities whose roles include `serviceProvider` are read
 * one by one (a provider that is only an identity provider names no journey).
 * A provider that cannot be read fails the source.
 */
async function readSaml2ServiceProviders({
  state,
}: {
  state: State;
}): Promise<Saml2ServiceProvider[]> {
  const stubs = await readSaml2ProviderStubs({ state });
  const serviceProviders = stubs.filter((stub) =>
    stub.roles?.includes('serviceProvider')
  );
  const settled = await Promise.allSettled(
    serviceProviders.map(async (stub) =>
      getProvider({
        location: stub.location,
        entityId64: stub._id,
        state,
      })
    )
  );
  const errors: FrodoError[] = [];
  const providers: Saml2ServiceProvider[] = [];
  settled.forEach((result, index) => {
    const { entityId } = serviceProviders[index];
    if (result.status === 'fulfilled') {
      providers.push({ ...(result.value as object), entityId });
    } else {
      errors.push(
        new FrodoError(
          `Error reading saml2 provider ${entityId}`,
          result.reason
        )
      );
    }
  });
  if (errors.length > 0) {
    throw new FrodoError(
      `Error reading the saml2 service providers: ${errors.map((error) => error.message).join('; ')}`,
      errors
    );
  }
  return providers;
}

/**
 * Read all policies of the realm. The answer is one list: if Access Management
 * says that more policies remain than the list holds (a paged answer), the
 * source fails, because a policy that was not read could be the one that names
 * the journey.
 */
async function readAllPolicies({
  state,
}: {
  state: State;
}): Promise<PolicySkeleton[]> {
  let answer: {
    result?: PolicySkeleton[];
    pagedResultsCookie?: string | null;
    remainingPagedResults?: number;
  };
  try {
    answer = await getPolicies({ state });
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} policies`,
      error
    );
  }
  if (answer?.pagedResultsCookie || Number(answer?.remainingPagedResults) > 0) {
    throw new FrodoError(
      `The list of ${getCurrentRealmName(state) + ' realm'} policies is paged and only the first page was read, ${answer.remainingPagedResults} more remain`
    );
  }
  return answer?.result ?? [];
}

/**
 * The conditions of a policy that name a journey: the `from` path of the
 * property that holds the name, with the dependency of its row (if two rows
 * give the same path, hard wins).
 */
function findPolicyConditionFields(
  policy: PolicySkeleton,
  journeyId: string
): Map<string, JourneyReferenceDependency> {
  const found = new Map<string, JourneyReferenceDependency>();
  forEachLeafCondition(policy.condition, (leaf: PolicyCondition) => {
    for (const row of journeyReferencePolicyConditionRows) {
      if (leaf.type !== row.conditionType) continue;
      if (
        row.when &&
        (leaf as Record<string, unknown>)[row.when.property] !== row.when.equals
      ) {
        continue;
      }
      if (
        readJourneyNames(leaf, row.property, row.shape).some(
          (entry) => entry.name === journeyId
        )
      ) {
        const from = `condition.${row.property}`;
        if (found.get(from) !== 'hard') found.set(from, row.dependency);
      }
    }
  });
  return found;
}

const isPlatformDeployment = (state: State) =>
  state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY ||
  state.getDeploymentType() === Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;

/**
 * Every source that findJourneyReferences reads, in the order of the result
 * (the first holds the journeys). Adding a realm setting that names a journey
 * is a row here plus its reader; adding a node type that names a journey is a
 * row of {@link journeyReferenceNodeRows}, a policy condition a row of
 * {@link journeyReferencePolicyConditionRows}.
 */
const journeyReferenceSources: readonly JourneyReferenceSource[] = [
  defineReferenceSource<{ journeys: TreeSkeleton[]; nodes: NodeSkeleton[] }>({
    source: JOURNEY_REFERENCE_SOURCES.journey,
    label: 'journeys and their nodes',
    read: async (state) => readJourneysAndNodes({ state }),
    find: ({ journeys, nodes }, journeyId) =>
      collectJourneyNodeEdges({
        journeys,
        nodes,
        rows: journeyReferenceNodeRows,
      })
        // a journey that names itself is not a reference to be told about
        .filter(
          (edge) =>
            edge.namedJourneyId === journeyId &&
            edge.reference.journeyId !== journeyId
        )
        .map((edge) => edge.reference),
  }),
  defineSettingSource({
    source: JOURNEY_REFERENCE_SOURCES.authenticationSettings,
    dependency: 'hard',
    label: 'authentication settings',
    read: async (state) =>
      readAuthenticationSettings({ globalConfig: false, state }),
    fields: [
      { from: 'core.orgConfig', shape: 'single' },
      { from: 'core.adminAuthModule', shape: 'single' },
    ],
  }),
  defineSettingSource({
    source: JOURNEY_REFERENCE_SOURCES.selfServiceTrees,
    dependency: 'hard',
    label: 'self-service journey settings',
    read: async (state) => {
      try {
        return await getService({
          serviceId: 'selfServiceTrees',
          globalConfig: false,
          state,
        });
      } catch (error) {
        // the service is not configured in this realm
        if (isNotFoundError(error)) return null;
        throw error;
      }
    },
    // every value of the map: the four flows and any key added by hand
    fields: [{ from: 'treeMapping', shape: 'map' }],
  }),
  defineSettingSource({
    source: JOURNEY_REFERENCE_SOURCES.oauth2Provider,
    dependency: 'hard',
    label: 'OAuth2 provider settings',
    read: async (state) => readOAuth2Provider({ state }),
    fields: [
      {
        from: 'advancedOAuth2Config.passwordGrantAuthService',
        shape: 'single',
      },
    ],
  }),
  defineHolderSource({
    source: JOURNEY_REFERENCE_SOURCES.oauth2Client,
    dependency: 'hard',
    label: 'OAuth2 clients',
    read: async (state) => readOAuth2Clients({ state }),
    idOf: (client) => client._id,
    fields: [{ from: 'advancedOAuth2ClientConfig.treeName', shape: 'single' }],
  }),
  defineHolderSource({
    source: JOURNEY_REFERENCE_SOURCES.saml2Provider,
    dependency: 'hard',
    label: 'SAML service providers',
    read: async (state) => readSaml2ServiceProviders({ state }),
    idOf: (provider) => provider.entityId,
    fields: [
      // remote service provider
      {
        from: 'serviceProvider.advanced.treeConfiguration.treeName',
        shape: 'single',
      },
      // hosted service provider
      {
        from: 'serviceProvider.assertionProcessing.redirectTreeConfiguration.redirectTreeName',
        shape: 'single',
      },
    ],
  }),
  defineHolderSource({
    source: JOURNEY_REFERENCE_SOURCES.aiAgent,
    dependency: 'hard',
    label: 'AI agents',
    read: async (state) =>
      (await isAgentTypeOffered({ agentType: 'AIAgent', state }))
        ? readAIAgents({ includeAgentIdentity: false, state })
        : [],
    idOf: (agent) => agent._id,
    fields: [{ from: 'advancedOAuth2ClientConfig.treeName', shape: 'single' }],
  }),
  defineHolderSource({
    source: JOURNEY_REFERENCE_SOURCES.agentGroup,
    dependency: 'hard',
    label: 'agent groups',
    read: async (state) => {
      try {
        return await readAgentGroups({ state });
      } catch (error) {
        // the realm has no agent groups
        if (isNotFoundError(error)) return [];
        throw error;
      }
    },
    idOf: (group) => group._id,
    fields: [{ from: 'advancedOAuth2ClientConfig.treeName', shape: 'single' }],
  }),
  defineHolderSource({
    source: JOURNEY_REFERENCE_SOURCES.cimdProfile,
    dependency: 'hard',
    label: 'CIMD profiles',
    read: async (state) => readCIMDProfiles({ state }),
    idOf: (profile) => profile._id,
    fields: [{ from: 'advancedOAuth2ClientConfig.treeName', shape: 'single' }],
  }),
  defineHolderSource({
    source: JOURNEY_REFERENCE_SOURCES.theme,
    dependency: 'soft',
    label: 'themes',
    appliesTo: isPlatformDeployment,
    read: async (state) => readThemes({ state }),
    idOf: (theme) => theme._id,
    nameOf: (theme) => theme.name,
    fields: [{ from: 'linkedTrees', shape: 'list' }],
  }),
  defineReferenceSource<PolicySkeleton[]>({
    source: JOURNEY_REFERENCE_SOURCES.policy,
    label: 'policies',
    read: async (state) => readAllPolicies({ state }),
    find: (policies, journeyId) =>
      policies
        .flatMap((policy) =>
          [...findPolicyConditionFields(policy, journeyId)].map(
            ([from, dependency]) => ({
              source: JOURNEY_REFERENCE_SOURCES.policy,
              dependency,
              id: policy._id,
              name: policy.name,
              applicationName: policy.applicationName,
              from,
            })
          )
        )
        .sort(byId),
  }),
];

/**
 * The pure join of {@link findJourneyReferences}: the references to a journey
 * in one set of reads. Nothing is read here, so the same reads can answer any
 * number of journeys. A source that has no entry in `reads` (for example the
 * themes on a deployment that has none) yields no reference.
 * @param {JourneyReferenceReads} reads what every source returned, keyed by source
 * @param {string} journeyId journey id/name
 * @returns {JourneyReference[]} every reference found, in the order of the sources
 */
export function joinJourneyReferences(
  reads: JourneyReferenceReads,
  journeyId: string
): JourneyReference[] {
  return joinReferences(journeyReferenceSources, reads, journeyId);
}

/**
 * Finds everything in the active realm that still names a journey. Every
 * source is read once, together, and the answer is joined in memory. See the
 * facade method for the sources and for what an empty answer does and does not
 * mean.
 *
 * Fails closed: if any source cannot be read, every source is still
 * attempted, then one error is thrown that nests one error per source that
 * failed. A source that is not there (no OAuth2 provider, no self-service
 * settings, an agent type or a setting that the realm does not offer) is none,
 * not a failure.
 * @param {string} journeyId journey id/name
 * @returns {Promise<JourneyReference[]>} a promise that resolves to every reference found
 */
export async function findJourneyReferences({
  journeyId,
  state,
}: {
  journeyId: string;
  state: State;
}): Promise<JourneyReference[]> {
  const realm = getCurrentRealmName(state) + ' realm';
  if (typeof journeyId !== 'string' || journeyId.trim() === '') {
    // an empty name matches nothing, which would read as "unused"
    throw new FrodoError(
      `Error finding references to a journey in the ${realm}: the journey id is empty`
    );
  }
  return findReferencesInSources({
    sources: journeyReferenceSources,
    state,
    id: journeyId,
    failure: `Error finding references to ${realm} journey ${journeyId}`,
  });
}

/**
 * Count all journeys/trees in the active realm.
 * @returns {Promise<number>} exact count when supported by the backing API
 */
export async function countJourneys({
  state,
}: {
  state: State;
}): Promise<number> {
  try {
    const total = await getTreesCount({ state });
    return total;
  } catch (error) {
    throw new FrodoError(
      `Error counting ${getCurrentRealmName(state) + ' realm'} journeys`,
      error
    );
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
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}`,
      error
    );
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
    if (!isNotFoundError(error)) {
      throw new FrodoError(
        `Error checking if ${getCurrentRealmName(state) + ' realm'} journey ${journeyId} already exists`,
        error
      );
    }
    try {
      const result = await putTree({
        treeId: journeyId,
        treeData: journeyData,
        state,
      });
      debugMessage({ message: `JourneyOps.createJourney: end`, state });
      return result;
    } catch (error) {
      throw new FrodoError(
        `Error creating ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}`,
        error
      );
    }
  }
  throw new FrodoError(
    `${getCurrentRealmName(state) + ' realm'} journey ${journeyId} already exists!`
  );
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
    throw new FrodoError(
      `Error updating ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}`,
      error
    );
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

  if (options.validate !== false) {
    const validationFindings = validateJourneysExport({
      trees: { [importData.tree._id]: importData },
    });
    reportJourneyFindings(
      validationFindings.filter((finding) => finding.severity === 'warning'),
      state
    );
    assertNoJourneyErrors(validationFindings, state);
  }

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

    // Process variables
    if (
      deps &&
      importData.variable &&
      Object.entries(importData.variable).length > 0
    ) {
      if (verbose)
        printMessage({ message: '  - Variables:', newline: false, state });
      for (const [variableId, variableObject] of Object.entries(
        importData.variable
      )) {
        if (verbose)
          printMessage({
            message: `\n    - ${variableId}`,
            type: 'info',
            newline: false,
            state,
          });
        try {
          await updateVariable({
            variableId,
            value: variableObject.value,
            description: variableObject.description,
            expressionType: variableObject.expressionType,
            state,
          });
        } catch (error) {
          errors.push(
            new FrodoError(
              `Error importing variable ${variableId} referenced by journey ${treeId}`,
              error
            )
          );
        }
        if (verbose) printMessage({ message: '', state });
      }
    }

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
              `Error importing ${getCurrentRealmName(state) + ' realm'} script ${scriptObject['name']} (${scriptId}) in journey ${treeId}`,
              error
            )
          );
        }
        if (verbose) printMessage({ message: '', state });
      }
    }

    // Process custom nodes
    if (
      deps &&
      importData.nodeTypes &&
      Object.entries(importData.nodeTypes).length > 0
    ) {
      if (verbose)
        printMessage({ message: '\n  - Custom Nodes:', newline: false, state });
      await importCustomNodes({
        importData: importData as CustomNodeExportInterface,
        options: {
          reUuid: false,
          wait: true,
        },
        resultCallback: (err, node) => {
          if (verbose)
            printMessage({
              message: `\n    - ${node['serviceName']} (${node['displayName']})`,
              type: 'info',
              newline: false,
              state,
            });
          if (err) errors.push(err);
        },
        state,
      });
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
        errors.push(
          new FrodoError(
            `Error importing ${getCurrentRealmName(state) + ' realm'} themes`,
            error
          )
        );
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
        const providerType = providerData['_type']['_id'] + '';
        try {
          await createSocialIdentityProvider({
            providerType,
            providerId,
            providerData,
            errorIfExists: false,
            state,
          });
        } catch (error) {
          errors.push(
            new FrodoError(
              `Error importing ${getCurrentRealmName(state) + ' realm'} provider ${providerId} in journey ${treeId}`,
              error
            )
          );
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
              new FrodoError(
                `Error creating ${getCurrentRealmName(state) + ' realm'} provider ${entityId}`,
                error
              )
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
              new FrodoError(
                `Error updating ${getCurrentRealmName(state) + ' realm'} provider ${entityId}`,
                error
              )
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
                  `Error updating ${getCurrentRealmName(state) + ' realm'} circle of trust ${cotId}`,
                  updateCotErr
                )
              );
            }
          } else {
            errors.push(
              new FrodoError(
                `Error creating ${getCurrentRealmName(state) + ' realm'} circle of trust ${cotId}`,
                error
              )
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
          await updateNode({
            nodeId: newUuid,
            nodeType,
            nodeTypeVersion: innerNodeData['_type']?.['version'] || '1.0',
            nodeData: innerNodeData as NodeSkeleton,
            state,
          });
        } catch (nodeImportError) {
          const nodeImportResponse = getFailedResponse(nodeImportError);
          if (
            nodeImportResponse?.status === 400 &&
            nodeImportResponse?.data?.message ===
              'Data validation failed for the attribute, Script'
          ) {
            throw new FrodoError(
              `Missing ${getCurrentRealmName(state) + ' realm'} script ${
                innerNodeData['script']
              } referenced by inner node ${innerNodeId}${
                innerNodeId === newUuid ? '' : ` [${newUuid}]`
              } (${innerNodeData['_type']['_id']}) in journey ${treeId}`,
              nodeImportError
            );
          } else if (
            nodeImportResponse?.status === 400 &&
            nodeImportResponse?.data?.message === 'Invalid attribute specified.'
          ) {
            const { validAttributes } = nodeImportResponse.data.detail;
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
              await updateNode({
                nodeId: newUuid,
                nodeType,
                nodeTypeVersion: innerNodeData['_type']?.['version'] || '1.0',
                nodeData: innerNodeData as NodeSkeleton,
                state,
              });
            } catch (nodeImportError2) {
              throw new FrodoError(
                `Error importing ${getCurrentRealmName(state) + ' realm'} node ${innerNodeId}${
                  innerNodeId === newUuid ? '' : ` [${newUuid}]`
                } in journey ${treeId}`,
                nodeImportError2
              );
            }
          } else if (nodeImportResponse?.status === 404) {
            throw new FrodoError(
              `Unable to import ${getCurrentRealmName(state) + ' realm'} node ${innerNodeId}${
                innerNodeId === newUuid ? '' : ` [${newUuid}]`
              } in journey ${treeId} because its type ${(innerNodeData as NodeSkeleton)._type._id} doesn't exist in deployment`,
              nodeImportError
            );
          } else {
            throw new FrodoError(
              `Error importing ${getCurrentRealmName(state) + ' realm'} inner node ${innerNodeId}${
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
        const nodeTypeVersion = (nodeData['_type']?.['version'] ||
          '1.0') as string;
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
          await updateNode({
            nodeId: newUuid,
            nodeType,
            nodeTypeVersion,
            nodeData,
            state,
          });
        } catch (nodeImportError) {
          const nodeImportResponse = getFailedResponse(nodeImportError);
          if (
            nodeImportResponse?.status === 400 &&
            nodeImportResponse?.data?.message ===
              'Data validation failed for the attribute, Script'
          ) {
            throw new FrodoError(
              `Missing ${getCurrentRealmName(state) + ' realm'} script ${
                nodeData['script']
              } referenced by node ${nodeId}${
                nodeId === newUuid ? '' : ` [${newUuid}]`
              } (${nodeData['_type']['_id']}) in journey ${treeId}`,
              nodeImportError
            );
          } else if (
            nodeImportResponse?.status === 400 &&
            nodeImportResponse?.data?.message === 'Invalid attribute specified.'
          ) {
            const { validAttributes } = nodeImportResponse.data.detail;
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
              await updateNode({
                nodeId: newUuid,
                nodeType,
                nodeTypeVersion,
                nodeData,
                state,
              });
            } catch (nodeImportError2) {
              throw new FrodoError(
                `Error importing ${getCurrentRealmName(state) + ' realm'} node ${nodeId}${
                  nodeId === newUuid ? '' : ` [${newUuid}]`
                } in journey ${treeId}`,
                nodeImportError2
              );
            }
          } else if (nodeImportResponse?.status === 404) {
            throw new FrodoError(
              `Unable to import ${getCurrentRealmName(state) + ' realm'} node ${nodeId}${
                nodeId === newUuid ? '' : ` [${newUuid}]`
              } in journey ${treeId} because its type ${nodeData._type._id} doesn't exist in deployment`,
              nodeImportError
            );
          } else {
            throw new FrodoError(
              `Error importing ${getCurrentRealmName(state) + ' realm'} node ${nodeId}${
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
              `Error importing ${getCurrentRealmName(state) + ' realm'} journey flow ${treeId}`,
              importError2
            )
          );
        }
      } else {
        errors.push(
          new FrodoError(
            `Error importing ${getCurrentRealmName(state) + ' realm'} journey flow ${treeId}`,
            importError
          )
        );
      }
    }
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 0) {
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} journey${importData && importData.tree && importData.tree._id ? ` '${importData.tree._id}'` : ''}`,
      errors
    );
  }
  return response;
}

/**
 * Resolve inner tree dependencies: put the candidate journeys in the order of their dependencies, with the same rule
 * as `resolveDependencies`.
 * @param {string[]} existingJorneys Array of existing journey names
 * @param {MultiTreeExportInterface} candidateJourneys Map of journeys to resolve dependencies for
 * @param {{ [k: string]: string[] }} unresolvedJourneys Map of unresolved journey names and their dependencies
 * @param {string[]} resolvedJourneys Array of resolved journey names
 * @param {number} index Number of journeys that were still unresolved after an earlier call, leave it out
 * @returns {Promise<{unresolvedJourneys: { [k: string]: string[] }; resolvedJourneys: string[];}>} a promise resolving to a dependency status object
 */
export async function resolveInnerTreeDependencies({
  existingJorneys,
  candidateJourneys,
  unresolvedJourneys = {},
  resolvedJourneys = [],
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
  resolveJourneyOrder({
    installedJourneys: existingJorneys,
    // the map of journeys by name is what the callers pass
    journeyMap: candidateJourneys as unknown as Record<
      string,
      SingleTreeExportInterface
    >,
    unresolvedJourneys,
    resolvedJourneys,
    index,
  });
  return { unresolvedJourneys, resolvedJourneys };
}

/**
 * Get the journeys that a journey needs: the ones its inner journey nodes (and back channel initialization nodes) refer to.
 * @param {SingleTreeExportInterface} journey the export of the journey
 * @returns {string[]} the names of the journeys the journey needs, in the order of its nodes
 */
function getJourneyDependencies(journey: SingleTreeExportInterface): string[] {
  const dependencies: string[] = [];
  for (const node in journey.nodes) {
    const dependency = getTreeDependencyId({ nodeConfig: journey.nodes[node] });
    if (dependency) {
      dependencies.push(dependency);
    }
  }
  return dependencies;
}

/**
 * Put the journeys of a batch in the order of their dependencies: a journey comes after every journey it needs. This is
 * the one ordering loop behind `resolveDependencies` and `resolveInnerTreeDependencies`.
 *
 * First, a journey that needs a journey of the same batch comes after it, whether that journey is installed in the
 * realm or not, so that an inner journey is written (and a disabled or broken installed copy of it repaired) before
 * the journey that evaluates it is saved. A journey that needs a journey outside of the batch needs it to be installed.
 *
 * Then, the journeys that are left because they are part of a circle, or refer to themselves, are ordered by the rule
 * that applied before frodo-lib#1122: an installed journey counts as resolved. Those come after the journeys that could
 * be ordered, in the order of the batch among themselves, and a circle of journeys that are not installed stays
 * unresolved. So the set of resolved and unresolved journeys is what it always was; only the order of the resolved
 * ones changes.
 * @param {string[]} installedJourneys Names of the installed journeys
 * @param {Record<string, SingleTreeExportInterface>} journeyMap Map of journeys to resolve dependencies for
 * @param {{ [k: string]: string[] }} unresolvedJourneys Map to hold the names of unresolved journeys and their dependencies
 * @param {string[]} resolvedJourneys Array to hold the names of resolved journeys, in the order of their dependencies
 * @param {number} index Number of journeys that were unresolved before the first pass, -1 for none
 */
function resolveJourneyOrder({
  installedJourneys,
  journeyMap,
  unresolvedJourneys,
  resolvedJourneys,
  index = -1,
}: {
  installedJourneys: string[];
  journeyMap: Record<string, SingleTreeExportInterface>;
  unresolvedJourneys: { [k: string]: string[] };
  resolvedJourneys: string[];
  index?: number;
}): void {
  for (const strict of [true, false]) {
    // the number of unresolved journeys after the previous pass, -1 before the first one
    let before = strict ? index : -1;
    for (;;) {
      for (const tree of Object.keys(journeyMap)) {
        const dependencies = getJourneyDependencies(journeyMap[tree]);
        const allResolved = dependencies.every(
          (dependency) =>
            resolvedJourneys.includes(dependency) ||
            (installedJourneys.includes(dependency) &&
              !(strict && {}.hasOwnProperty.call(journeyMap, dependency)))
        );
        if (allResolved) {
          if (resolvedJourneys.indexOf(tree) === -1)
            resolvedJourneys.push(tree);
          delete unresolvedJourneys[tree];
        } else {
          unresolvedJourneys[tree] = dependencies;
        }
      }
      const after = Object.keys(unresolvedJourneys).length;
      // done, or no progress since the last pass
      if (after === 0 || (before !== -1 && after === before)) break;
      before = after;
    }
    if (Object.keys(unresolvedJourneys).length === 0) return;
  }
}

/**
 * Resolve journey dependencies: put the journeys of a batch in the order of their dependencies, so that a journey comes
 * after the journeys it needs. A journey that needs a journey of the same batch comes after it, whether that journey is
 * installed or not. A journey that needs a journey outside of the batch needs it to be installed. Journeys that form a
 * circle, or refer to themselves, come after the journeys that could be ordered when they are installed, in the order
 * of the batch among themselves.
 * @param {string[]} installedJorneys Map of installed journeys
 * @param {Record<string, SingleTreeExportInterface>} journeyMap Map of journeys to resolve dependencies for
 * @param {string[]} unresolvedJourneys Map to hold the names of unresolved journeys and their dependencies
 * @param {string[]} resolvedJourneys Array to hold the names of resolved journeys, in the order of their dependencies
 * @param {number} index Number of journeys that were still unresolved after an earlier call, leave it out
 */
export async function resolveDependencies(
  installedJorneys: string[],
  journeyMap: Record<string, SingleTreeExportInterface>,
  unresolvedJourneys: { [k: string]: string[] },
  resolvedJourneys: string[],
  index = -1
) {
  resolveJourneyOrder({
    installedJourneys: installedJorneys,
    journeyMap,
    unresolvedJourneys,
    resolvedJourneys,
    index,
  });
}

/**
 * Import journeys, in the order of their dependencies.
 *
 * A journey that needs another journey of the import data is written after it, whether that journey is installed or
 * not, so that an inner journey is written (and a disabled or broken installed copy of it repaired) before the
 * journey that uses it is saved. Journeys that do not need each other keep the order of the import data. Journeys that
 * form a circle, or refer to themselves, cannot be ordered: when they are installed they are written after the
 * journeys that could be ordered, in the order of the import data among themselves.
 *
 * Without a result callback the complete batch is validated and its dependencies are resolved before any journey
 * is written, so an invalid journey or a missing dependency rejects the batch without partially importing valid
 * journeys, and a journey that cannot be written ends the import with an error.
 *
 * With a result callback every journey is an item of its own and the outcome of every one is passed to the callback
 * as it happens: the journey as imported, or an error that names the journey. A journey that has validation errors, a
 * journey that needs a journey that is neither installed nor importable from the import data, and a journey that needs
 * a journey of the batch that failed (for any of these reasons or because it could not be written) fail without being
 * written, and every other journey is imported. A journey is judged when its turn comes, in the order of writing: it is
 * skipped when a journey it needs has failed before. An installed journey that cannot be imported because of its own
 * dependencies still counts as resolved for the journeys that need it, so a journey that needs such a journey can be
 * written before that journey is judged. Warnings are reported as without a callback.
 * @param {MultiTreeExportInterface} importData map of trees object
 * @param {TreeImportOptions} options import options
 * @param {ResultCallback} resultCallback Optional callback to process individual results. When given, the outcome of every journey is passed to it as it happens (the journey, or an error that names the journey) and a failed journey does not throw. Without it, a validation error or a missing dependency rejects the batch before anything is written, and a journey that cannot be written throws. Failing to list the installed journeys always throws.
 * @returns {Promise<TreeSkeleton[]>} a promise that resolves to the journeys that were imported
 */
export async function importJourneys({
  importData,
  options,
  resultCallback = void 0,
  state,
}: {
  importData: MultiTreeExportInterface;
  options: TreeImportOptions;
  resultCallback?: ResultCallback<TreeSkeleton>;
  state: State;
}): Promise<TreeSkeleton[]> {
  const response = [];
  // with a result callback: the journeys that are not imported, by name, with the error that names them
  const blockedJourneys = new Map<string, FrodoError>();
  if (options.validate !== false) {
    const validationFindings = validateJourneysExport(importData);
    reportJourneyFindings(
      validationFindings.filter((finding) => finding.severity === 'warning'),
      state
    );
    if (resultCallback) {
      // each journey on its own, so that the findings are those of its key in the import data
      for (const [journeyId, journey] of Object.entries(importData.trees)) {
        const validationError = createJourneyValidationError(
          validateJourneysExport({ trees: { [journeyId]: journey } }),
          state
        );
        if (validationError) {
          blockedJourneys.set(
            journeyId,
            new FrodoError(
              `Error importing the ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}`,
              validationError
            )
          );
        }
      }
    } else {
      assertNoJourneyErrors(validationFindings, state);
    }
  }

  const installedJourneys = (await readJourneys({ state })).map((x) => x._id);
  const unresolvedJourneys: {
    [k: string]: string[];
  } = {};
  const resolvedJourneys = [];
  let indicatorId = createProgressIndicator({
    total: undefined,
    message: `Resolving ${getCurrentRealmName(state) + ' realm'} dependencies`,
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
      message: `Resolved all ${getCurrentRealmName(state) + ' realm'} dependencies.`,
      status: 'success',
      state,
    });
  } else {
    stopProgressIndicator({
      id: indicatorId,
      message: `${
        Object.keys(unresolvedJourneys).length
      } ${getCurrentRealmName(state) + ' realm'} journeys with unresolved dependencies`,
      status: 'fail',
      state,
    });
    if (!resultCallback) {
      const message: string[] = [
        `${
          Object.keys(unresolvedJourneys).length
        } ${getCurrentRealmName(state) + ' realm'} journeys with unresolved dependencies:`,
      ];
      for (const journey of Object.keys(unresolvedJourneys)) {
        message.push(`  - ${journey} requires ${unresolvedJourneys[journey]}`);
      }
      throw new FrodoError(message.join('\n'));
    }
    for (const journey of Object.keys(unresolvedJourneys)) {
      // a journey with validation errors is reported for those
      if (blockedJourneys.has(journey)) continue;
      const missing = unresolvedJourneys[journey].filter(
        (dependency) =>
          !installedJourneys.includes(dependency) &&
          !resolvedJourneys.includes(dependency)
      );
      blockedJourneys.set(
        journey,
        new FrodoError(
          `Error importing the ${getCurrentRealmName(state) + ' realm'} journey ${journey}`,
          new FrodoError(
            `Journey ${journey} requires ${missing.join(', ')}, which ${missing.length === 1 ? 'is' : 'are'} not installed and cannot be imported from the import data`
          )
        )
      );
    }
  }
  // the journeys that are known before anything is written to be unfit are reported first, in the order of the import data
  if (resultCallback) {
    for (const journey of Object.keys(importData.trees)) {
      if (blockedJourneys.has(journey)) {
        resultCallback(blockedJourneys.get(journey), undefined);
      }
    }
  }
  indicatorId = createProgressIndicator({
    total: resolvedJourneys.length,
    message: `Importing into ${getCurrentRealmName(state) + ' realm'}`,
    state,
  });
  // the journeys that did not get imported: a journey that needs one of them is not imported either
  const failedJourneys = new Set(blockedJourneys.keys());
  for (const tree of resolvedJourneys) {
    if (blockedJourneys.has(tree)) continue;
    if (resultCallback) {
      const failedDependencies = getJourneyDependencies(
        importData.trees[tree]
      ).filter((dependency) => failedJourneys.has(dependency));
      if (failedDependencies.length > 0) {
        failedJourneys.add(tree);
        resultCallback(
          new FrodoError(
            `Error importing the ${getCurrentRealmName(state) + ' realm'} journey ${tree}`,
            new FrodoError(
              `Journey ${tree} requires ${failedDependencies.join(', ')}, which could not be imported`
            )
          ),
          undefined
        );
        continue;
      }
    }
    const result = await getResult(
      resultCallback,
      `Error importing the ${getCurrentRealmName(state) + ' realm'} journey ${tree}`,
      importJourney,
      {
        importData: importData.trees[tree],
        options: { ...options, validate: false },
        state,
      }
    );
    if (result) {
      response.push(result);
      updateProgressIndicator({ id: indicatorId, message: `${tree}`, state });
    } else {
      failedJourneys.add(tree);
    }
  }
  stopProgressIndicator({
    id: indicatorId,
    message: `Finished importing ${getCurrentRealmName(state) + ' realm'} journeys`,
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
      if (JOURNEY_CONTAINER_NODE_TYPES.includes(node._type._id)) {
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
    return await exportSingleJourney({
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
 * Get tree dependencies (all descendent inner trees). The whole tree is
 * described, to any depth: a sub-journey referenced by several journeys is
 * repeated and expanded in full under every parent. A sub-journey that is
 * already an ancestor on the current path (a cycle), or whose id is in
 * `resolvedTreeIds`, appears as a leaf and is not expanded again. A sub-journey
 * that cannot be resolved appears as a leaf. Each sub-journey is resolved at
 * most once per call.
 * @param {SingleTreeExportInterface} treeExport single tree export
 * @param {string[]} resolvedTreeIds list of tree ids that are listed as leaves and not expanded (the list is not modified)
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
  const treeExportCache = new Map<string, Promise<SingleTreeExportInterface>>();
  treeExportCache.set(treeExport.tree._id + '', Promise.resolve(treeExport));
  const resolveOnce = (treeId: string): Promise<SingleTreeExportInterface> => {
    if (!treeExportCache.has(treeId)) {
      treeExportCache.set(
        treeId,
        Promise.resolve().then(() => resolveTreeExport(treeId, state))
      );
    }
    return treeExportCache.get(treeId);
  };
  return walkTreeDescendents({
    treeExport,
    resolveOnce,
    excludedTreeIds: new Set(resolvedTreeIds),
    state,
  });
}

async function walkTreeDescendents({
  treeExport,
  resolveOnce,
  excludedTreeIds,
  state,
}: {
  treeExport: SingleTreeExportInterface;
  resolveOnce: (treeId: string) => Promise<SingleTreeExportInterface>;
  excludedTreeIds: Set<string>;
  state: State;
}): Promise<TreeDependencyMapInterface> {
  const treeId = treeExport.tree._id + '';
  debugMessage({
    message: `getTreeDependencies(${treeId}, [${[...excludedTreeIds].join(', ')}])`,
    state,
  });
  // the ids on the current path, which must not be expanded again
  const pathTreeIds = new Set(excludedTreeIds).add(treeId);
  const dependencies: TreeDependencyMapInterface[] = [];
  for (const [nodeId, node] of Object.entries(treeExport.tree.nodes)) {
    let innerTreeId: string;
    try {
      innerTreeId = getTreeDependencyId({
        nodeType: node.nodeType,
        nodeConfig: treeExport.nodes[nodeId],
      });
      if (!innerTreeId) continue;
      if (pathTreeIds.has(innerTreeId)) {
        dependencies.push({ [innerTreeId]: [] });
        continue;
      }
      const innerTreeExport = await resolveOnce(innerTreeId);
      debugMessage({
        message: `resolved inner tree: ${innerTreeExport.tree._id}`,
        state,
      });
      dependencies.push(
        await walkTreeDescendents({
          treeExport: innerTreeExport,
          resolveOnce,
          excludedTreeIds: pathTreeIds,
          state,
        })
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      if (innerTreeId) {
        const unresolvableMap: TreeDependencyMapInterface = {
          [innerTreeId]: [],
        };
        dependencies.push(unresolvableMap);
      }
    }
  }
  return { [treeId]: dependencies };
}

export type DeleteJourneyStatus = {
  status: string;
  nodes: { status?: string };
};

type DeleteJourneyTask = {
  key: string;
  reportError: (error: unknown) => void;
  run: () => Promise<void>;
  lastError?: unknown;
};

function isConnectedNodeDeleteError(error: unknown): boolean {
  if (error instanceof FrodoError && error.getOriginalErrors().length > 0) {
    return isConnectedNodeDeleteError(error.getOriginalErrors()[0]);
  }
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 400 &&
    error.response?.data?.message ===
      'Cannot delete a node that is connected in a tree.'
  );
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
}): Promise<DeleteJourneyStatus> {
  const { deep, verbose } = options;
  const progress = !('progress' in options) ? true : options.progress;
  const status: DeleteJourneyStatus = { status: 'unknown', nodes: {} };
  let indicatorId: string | undefined;
  let progressIndicatorVisible = false;
  if (progress)
    indicatorId = createProgressIndicator({
      total: undefined,
      message: `Deleting ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}...`,
      type: 'indeterminate',
      state,
    });
  if (progress) {
    progressIndicatorVisible = true;
  }
  if (progress && verbose) {
    stopProgressIndicator({ id: indicatorId, state });
    progressIndicatorVisible = false;
  }
  try {
    const deleteTreeResponse = await deleteTree({ treeId: journeyId, state });
    try {
      await getTree({ id: journeyId, state });
      throw new FrodoError(
        `Delete endpoint returned success but ${getCurrentRealmName(state) + ' realm'} journey ${journeyId} still exists`
      );
    } catch (error) {
      if (
        !(axios.isAxiosError(error) && error.response?.status === 404) &&
        !(error instanceof FrodoError)
      ) {
        throw error;
      }
      if (error instanceof FrodoError) {
        throw error;
      }
    }
    status['status'] = 'success';
    const deleteTasks: DeleteJourneyTask[] = [];
    if (verbose && deep)
      printMessage({
        message: `Deleted journey ${journeyId}`,
        type: 'info',
        state,
      });
    if (deep) {
      for (const [nodeId, nodeObject] of Object.entries(
        deleteTreeResponse.nodes
      )) {
        // delete inner nodes (nodes inside container nodes)
        if (JOURNEY_CONTAINER_NODE_TYPES.includes(nodeObject['nodeType'])) {
          try {
            const containerNode = await readNode({
              nodeId,
              nodeType: nodeObject['nodeType'],
              nodeTypeVersion: nodeObject['version'] || '1.0',
              state,
            });
            if (verbose)
              printMessage({
                message: `Read ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}`,
                type: 'info',
                state,
              });
            for (const innerNodeObject of containerNode.nodes) {
              deleteTasks.push({
                key: innerNodeObject._id,
                reportError: (error: unknown) => {
                  status.nodes[innerNodeObject._id] = {
                    status: 'error',
                    error,
                  };
                  if (verbose)
                    printMessage({
                      message: `Error deleting inner node ${innerNodeObject._id} (${innerNodeObject.nodeType}) from ${journeyId}: ${
                        error instanceof Error ? error.message : String(error)
                      }`,
                      type: 'error',
                      state,
                    });
                },
                run: async () => {
                  await deleteNode({
                    nodeId: innerNodeObject._id,
                    nodeType: innerNodeObject.nodeType,
                    state,
                  });
                  status.nodes[innerNodeObject._id] = { status: 'success' };
                  if (verbose)
                    printMessage({
                      message: `Deleted ${innerNodeObject._id} (${innerNodeObject.nodeType}) from ${journeyId}`,
                      type: 'info',
                      state,
                    });
                },
              });
            }
            deleteTasks.push({
              key: containerNode._id,
              reportError: (error: unknown) => {
                status.nodes[containerNode._id] = {
                  status: 'error',
                  error,
                };
                if (verbose)
                  printMessage({
                    message: `Error deleting container node ${containerNode._id} (${containerNode['_type']['_id']}) from ${journeyId}: ${
                      error instanceof Error ? error.message : String(error)
                    }`,
                    type: 'error',
                    state,
                  });
              },
              run: async () => {
                try {
                  await deleteNode({
                    nodeId: containerNode._id,
                    nodeType: containerNode['_type']['_id'],
                    state,
                  });
                  status.nodes[containerNode._id] = { status: 'success' };
                  if (verbose)
                    printMessage({
                      message: `Deleted ${containerNode._id} (${containerNode['_type']['_id']}) from ${journeyId}`,
                      type: 'info',
                      state,
                    });
                } catch (error) {
                  const failed = getFailedResponse(error);
                  if (
                    failed?.data?.code === 500 &&
                    failed.data.message ===
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
                    throw error;
                  }
                }
              },
            });
          } catch (error) {
            if (verbose)
              printMessage({
                message: `Error getting container node ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}: ${
                  error instanceof Error ? error.message : String(error)
                }`,
                type: 'error',
                state,
              });
          }
        } else {
          // delete the node
          deleteTasks.push({
            key: nodeId,
            reportError: (error: unknown) => {
              status.nodes[nodeId] = { status: 'error', error };
              if (verbose)
                printMessage({
                  message: `Error deleting node ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                  type: 'error',
                  state,
                });
            },
            run: async () => {
              await deleteNode({
                nodeId,
                nodeType: nodeObject['nodeType'],
                state,
              });
              status.nodes[nodeId] = { status: 'success' };
              if (verbose)
                printMessage({
                  message: `Deleted ${nodeId} (${nodeObject['nodeType']}) from ${journeyId}`,
                  type: 'info',
                  state,
                });
            },
          });
        }
      }
    }
    let pendingTasks = deleteTasks;
    while (pendingTasks.length > 0) {
      const nextPendingTasks: DeleteJourneyTask[] = [];
      let deletedInPass = 0;
      const settledTasks = await Promise.all(
        pendingTasks.map(async (task) => {
          try {
            await task.run();
            return { task, success: true as const };
          } catch (error) {
            return { task, success: false as const, error };
          }
        })
      );
      for (const settledTask of settledTasks) {
        if (settledTask.success) {
          deletedInPass += 1;
          continue;
        }
        const { task, error } = settledTask;
        task.lastError = error;
        if (isConnectedNodeDeleteError(error)) {
          nextPendingTasks.push(task);
        } else {
          task.reportError(error);
        }
      }
      if (nextPendingTasks.length === 0) {
        break;
      }
      if (deletedInPass === 0) {
        for (const task of nextPendingTasks) {
          task.reportError(task.lastError);
        }
        break;
      }
      pendingTasks = nextPendingTasks;
    }

    // report status
    let nodeCount = 0;
    let errorCount = 0;
    for (const node of Object.keys(status.nodes)) {
      nodeCount += 1;
      if (status.nodes[node].status === 'error') errorCount += 1;
    }
    const summaryMessage = deep
      ? `Deleted ${getCurrentRealmName(state) + ' realm'} journey ${journeyId} and ${
          nodeCount - errorCount
        }/${nodeCount} nodes.`
      : `Deleted ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}.`;
    if (progress && indicatorId && progressIndicatorVisible) {
      stopProgressIndicator({
        id: indicatorId,
        message: summaryMessage,
        status: errorCount === 0 ? 'success' : 'fail',
        state,
      });
    } else if (verbose) {
      printMessage({
        message: summaryMessage,
        type: errorCount === 0 ? 'info' : 'error',
        state,
      });
    }
    return status;
  } catch (error) {
    status['status'] = 'error';
    status['error'] = new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}`,
      error
    );
    const errorMessage = `Error deleting ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}.`;
    if (progress && indicatorId && progressIndicatorVisible) {
      stopProgressIndicator({
        id: indicatorId,
        message: errorMessage,
        status: 'fail',
        state,
      });
    }
    if (verbose)
      printMessage({
        message: `Error deleting ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        type: 'error',
        state,
      });
    return status;
  }
}

export type DeleteJourneysStatus = {
  [k: string]: DeleteJourneyStatus;
};

/**
 * Delete all journeys
 * @param {Object} options deep=true also delete all the nodes and inner nodes, verbose=true print verbose info
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 */
export async function deleteJourneys({
  options,
  resultCallback = void 0,
  state,
}: {
  options?: {
    deep: boolean;
    verbose: boolean;
  };
  resultCallback: ResultCallback<DeleteJourneyStatus>;
  state: State;
}) {
  const { verbose } = options;
  const status: DeleteJourneysStatus = {};
  const trees = (await getTrees({ state })).result;
  const indicatorId = createProgressIndicator({
    total: trees.length,
    message: `Deleting ${getCurrentRealmName(state) + ' realm'} journeys...`,
    state,
  });
  for (const tree of trees) {
    try {
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
      if (verbose) await sleep(100);
    } catch (e) {
      if (resultCallback) {
        resultCallback(e, undefined);
      } else {
        throw new FrodoError(
          `Error deleting the ${getCurrentRealmName(state) + ' realm'} journey ${tree._id}`,
          e
        );
      }
    }
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
    if (resultCallback) {
      resultCallback(undefined, status[journey]);
    }
  }
  stopProgressIndicator({
    id: indicatorId,
    message: options.deep
      ? `Deleted ${
          journeyCount - journeyErrorCount
        }/${journeyCount} ${getCurrentRealmName(state) + ' realm'} journeys and ${
          nodeCount - nodeErrorCount
        }/${nodeCount} nodes.`
      : `Deleted ${
          journeyCount - journeyErrorCount
        }/${journeyCount} ${getCurrentRealmName(state) + ' realm'} journeys.`,
    state,
  });
  return status;
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
    throw new FrodoError(
      `Error enabling ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}`,
      error
    );
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
    throw new FrodoError(
      `Error disabling ${getCurrentRealmName(state) + ' realm'} journey ${journeyId}`,
      error
    );
  }
}
