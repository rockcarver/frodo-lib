import { type IdObjectSkeletonInterface } from '../api/ApiTypes';
import { CircleOfTrustSkeleton } from '../api/CirclesOfTrustApi';
import {
  deleteApplicationGlossary,
  getApplicationGlossary,
  GlossarySchemaItemSkeleton,
  GlossarySkeleton,
  putApplicationGlossary,
} from '../api/cloud/iga/IgaGlossaryApi';
import {
  getRequestFormAssignments,
  RequestFormSkeleton,
} from '../api/cloud/iga/IgaRequestFormApi';
import { RequestTypeSkeleton } from '../api/cloud/iga/IgaRequestTypeApi';
import { type OAuth2ClientSkeleton } from '../api/OAuth2ClientApi';
import { Saml2ProviderSkeleton } from '../api/Saml2Api';
import { getScriptByName, type ScriptSkeleton } from '../api/ScriptApi';
import constants from '../shared/Constants';
import { State } from '../shared/State';
import { decode } from '../utils/Base64Utils';
import {
  createProgressIndicator,
  debugMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { getCurrentRealmName } from '../utils/ForgeRockUtils';
import { mergeDeep } from '../utils/JsonUtils';
import {
  CirclesOfTrustExportInterface,
  exportCirclesOfTrust,
  importCirclesOfTrust,
  readCirclesOfTrust,
  updateCircleOfTrust,
} from './CirclesOfTrustOps';
import {
  deleteGlossarySchemaByNameAndObjectType,
  exportGlossarySchemaByNameAndObjectType,
  GlossarySchemaExportInterface,
  importGlossarySchemas,
  readGlossarySchemas,
} from './cloud/iga/IgaGlossaryOps';
import {
  deleteOrphanedRequestFormAssignments,
  deleteRequestForm,
  exportRequestForm,
  importRequestForms,
  readRequestForm,
} from './cloud/iga/IgaRequestFormOps';
import {
  deleteRequestType,
  readRequestType,
} from './cloud/iga/IgaRequestTypeOps';
import {
  ConnectorEnableOptions,
  ConnectorExportInterface,
  ConnectorSkeleton,
  deleteConnector,
  disableConnector,
  enableConnector,
  exportConnector,
  importConnector,
  isConnectorEnabled,
  readConnector,
  readConnectorEnabledStates,
} from './ConnectorOps';
import { FrodoError, isNotFoundError } from './FrodoError';
import {
  createManagedObject,
  deleteManagedObject,
  queryManagedObjects,
  readManagedObject,
  readManagedObjects,
  updateManagedObject,
} from './ManagedObjectOps';
import { deleteMapping, MappingSkeleton, readMappings } from './MappingOps';
import {
  deleteOAuth2Client,
  exportOAuth2Client,
  getOAuth2ClientScriptReferences,
  importOAuth2Client,
  OAuth2ClientExportInterface,
  readOAuth2Client,
} from './OAuth2ClientOps';
import { type ExportMetaData, type ResultCallback } from './OpsTypes';
import {
  deleteSaml2Provider,
  exportSaml2Provider,
  getSaml2ProviderScriptReferences,
  importSaml2Provider,
  readSaml2EntityIds,
  readSaml2Provider,
  Saml2ExportInterface,
} from './Saml2Ops';
import { getLibraryScriptNames, readScript } from './ScriptOps';

const defaultFields = [
  'authoritative',
  'connectorId',
  'description',
  'icon',
  'mappingNames',
  'name',
  'ssoEntities',
  'templateName',
  'templateVersion',
  'uiConfig',
  'url',
];

// const allFields = defaultFields.concat(['members', 'owners', 'roles']);

export type Application = {
  /**
   * Create an empty application export template
   * @returns {ApplicationExportInterface} an empty application export template
   */
  createApplicationExportTemplate(): ApplicationExportInterface;
  /**
   * Get application managed object type
   * @returns {String} application managed object type in this realm
   */
  getRealmManagedApplication(): string;
  /**
   * Create application
   * @param {string} applicationId application id/name
   * @param {ApplicationGlossarySkeleton} applicationData application data
   * @returns {Promise<ApplicationGlossarySkeleton>} a promise that resolves to an application object
   */
  createApplication(
    applicationId: string,
    applicationData: ApplicationGlossarySkeleton
  ): Promise<ApplicationGlossarySkeleton>;
  /**
   * Read application
   * @param {string} applicationId application uuid
   * @returns {Promise<ApplicationSkeleton>} a promise that resolves to an application object
   */
  readApplication(applicationId: string): Promise<ApplicationSkeleton>;
  /**
   * Read application by name
   * @param {string} applicationName application name
   * @returns {Promise<ApplicationSkeleton>} a promise that resolves to an application object
   */
  readApplicationByName(applicationName: string): Promise<ApplicationSkeleton>;
  /**
   * Read all applications. Results are sorted aphabetically.
   * @returns {Promise<ApplicationSkeleton[]>} a promise that resolves to an array of application objects
   */
  readApplications(): Promise<ApplicationSkeleton[]>;
  /**
   * Update application
   * @param {string} applicationId application uuid
   * @param {ApplicationSkeleton} applicationData application data
   * @returns {Promise<ApplicationSkeleton>} a promise that resolves to an application object
   */
  updateApplication(
    applicationId: string,
    applicationData: ApplicationSkeleton
  ): Promise<ApplicationSkeleton>;
  /**
   * Delete application
   * @param {string} applicationId application uuid
   * @param {boolean} deep deep delete (remove dependencies)
   * @returns {Promise<ApplicationGlossarySkeleton>} a promise that resolves to an application object
   */
  deleteApplication(
    applicationId: string,
    deep?: boolean
  ): Promise<ApplicationGlossarySkeleton>;
  /**
   * Delete application by name
   * @param {string} applicationName application name
   * @param {boolean} deep deep delete (remove dependencies)
   * @returns {Promise<ApplicationGlossarySkeleton>} a promise that resolves to an application object
   */
  deleteApplicationByName(
    applicationName: string,
    deep?: boolean
  ): Promise<ApplicationGlossarySkeleton>;
  /**
   * Delete all applications
   * @param {boolean} deep deep delete (remove dependencies)
   * @returns {Promise<ApplicationGlossarySkeleton[]>} a promise that resolves to an array of application objects
   */
  deleteApplications(deep?: boolean): Promise<ApplicationGlossarySkeleton[]>;
  /**
   * Delete the objects an application owns: the OAuth2 client, the SAML entity providers (and their membership in circles of trust), the mappings and the connector that its record names. The record itself is not deleted (delete it first, with `deep` off, and pass the record that comes back), and the objects an application only shares (scripts, circles of trust, glossary schemas, request forms, request types) are never touched. An object that another application still names is kept. Every object is reported to the result callback once; a failure of one object does not stop the others and is not thrown.
   * @param {ApplicationSkeleton} applicationData the application record
   * @param {ApplicationOwnedDeleteOptions} options the ownership index to use (read once if not given) and the result callback
   * @returns {Promise<ApplicationOwnedObjectResult[]>} a promise that resolves to what happened to each owned object
   */
  deleteApplicationOwnedObjects(
    applicationData: ApplicationSkeleton,
    options?: ApplicationOwnedDeleteOptions
  ): Promise<ApplicationOwnedObjectResult[]>;
  /**
   * Delete the objects an application owns, by application id. The application is read first, so it must still exist: to delete the record first, pass the record that deleteApplication returns to deleteApplicationOwnedObjects.
   * @param {string} applicationId application uuid
   * @param {ApplicationOwnedDeleteOptions} options the ownership index to use (read once if not given) and the result callback
   * @returns {Promise<ApplicationOwnedObjectResult[]>} a promise that resolves to what happened to each owned object
   */
  deleteApplicationOwnedObjectsById(
    applicationId: string,
    options?: ApplicationOwnedDeleteOptions
  ): Promise<ApplicationOwnedObjectResult[]>;
  /**
   * Delete the objects an application owns, by application name. The application is read first, so it must still exist: to delete the record first, pass the record that deleteApplicationByName returns to deleteApplicationOwnedObjects.
   * @param {string} applicationName application name
   * @param {ApplicationOwnedDeleteOptions} options the ownership index to use (read once if not given) and the result callback
   * @returns {Promise<ApplicationOwnedObjectResult[]>} a promise that resolves to what happened to each owned object
   */
  deleteApplicationOwnedObjectsByName(
    applicationName: string,
    options?: ApplicationOwnedDeleteOptions
  ): Promise<ApplicationOwnedObjectResult[]>;
  /**
   * Query applications
   * @param {string} filter CREST search filter
   * @param {string[]} fields array of fields to return
   */
  queryApplications(
    filter: string,
    fields?: string[]
  ): Promise<ApplicationSkeleton[]>;
  /**
   * Export application. The response can be saved to file as is.
   * @param {string} applicationId application uuid
   * @param {ApplicationExportOptions} options export options
   * @returns {Promise<ApplicationExportInterface>} Promise resolving to an ApplicationExportInterface object.
   */
  exportApplication(
    applicationId: string,
    options: ApplicationExportOptions
  ): Promise<ApplicationExportInterface>;
  /**
   * Export application by name. The response can be saved to file as is.
   * @param {string} applicationName application name
   * @param {ApplicationExportOptions} options export options
   * @returns {Promise<ApplicationExportInterface>} Promise resolving to an ApplicationExportInterface object.
   */
  exportApplicationByName(
    applicationName: string,
    options: ApplicationExportOptions
  ): Promise<ApplicationExportInterface>;
  /**
   * Export all applications. The response can be saved to file as is.
   * @param {ApplicationExportOptions} options export options
   * @param {ResultCallback<ApplicationGlossarySkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every application is passed to it as it happens (a failed application as an error that names it, with the reasons nested) and a failed application does not throw: the applications that could be exported are returned. The dependencies of a failed application that were read before it failed may still be in the export. Without it, the failures are collected and thrown as one error after every application was tried. Failing to read the applications always throws.
   * @returns {Promise<ApplicationExportInterface>} Promise resolving to an ApplicationExportInterface object.
   */
  exportApplications(
    options?: ApplicationExportOptions,
    resultCallback?: ResultCallback<ApplicationGlossarySkeleton>
  ): Promise<ApplicationExportInterface>;
  /**
   * Import application. The import data is usually read from an application export file. The import writes the configuration fields of the application with a PUT. A PUT that does not carry `members`, `owners` and `roles` leaves them as they are, so an import does not remove who has access.
   * @param {string} applicationId application uuid
   * @param {ApplicationExportInterface} importData application import data.
   * @param {ApplicationImportOptions} options import options (`deps`: also import the dependencies of the application)
   * @returns {Promise<ApplicationGlossarySkeleton>} Promise resolving to an application object.
   */
  importApplication(
    applicationId: string,
    importData: ApplicationExportInterface,
    options: ApplicationImportOptions
  ): Promise<ApplicationGlossarySkeleton>;
  /**
   * Import application by name. The import data is usually read from an application export file. The import writes the configuration fields of the application with a PUT. A PUT that does not carry `members`, `owners` and `roles` leaves them as they are, so an import does not remove who has access.
   * @param {string} applicationName application name
   * @param {ApplicationExportInterface} importData application import data.
   * @param {ApplicationImportOptions} options import options (`deps`: also import the dependencies of the application)
   * @returns {Promise<ApplicationGlossarySkeleton>} Promise resolving to an application object.
   */
  importApplicationByName(
    applicationName: string,
    importData: ApplicationExportInterface,
    options: ApplicationImportOptions
  ): Promise<ApplicationGlossarySkeleton>;
  /**
   * Import first application. The import data is usually read from an application export file. Only the first application of the import data is imported. The import writes the configuration fields of the application with a PUT. A PUT that does not carry `members`, `owners` and `roles` leaves them as they are, so an import does not remove who has access.
   * @param {ApplicationExportInterface} importData application import data.
   * @param {ApplicationImportOptions} options import options (`deps`: also import the dependencies of the application)
   * @returns {Promise<ApplicationGlossarySkeleton[]>} a promise resolving to an array that holds the imported application
   * @throws {FrodoError} If the import data holds no application, or the first application cannot be imported.
   */
  importFirstApplication(
    importData: ApplicationExportInterface,
    options: ApplicationImportOptions
  ): Promise<ApplicationGlossarySkeleton[]>;
  /**
   * Import applications. The import data is usually read from an application export file. The import writes the configuration fields of the application with a PUT. A PUT that does not carry `members`, `owners` and `roles` leaves them as they are, so an import does not remove who has access. Every application is tried: an application that cannot be imported does not stop the others.
   * @param {ApplicationExportInterface} importData application import data.
   * @param {ApplicationImportOptions} options import options (`deps`: also import the dependencies of the application)
   * @param {ResultCallback<ApplicationGlossarySkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every application is passed to it as it happens (a failed application as an error that names it, with the reasons nested) and a failed application does not throw: the applications that could be imported are returned. An application whose dependencies or glossary could not be imported is a failed application, although the application itself may have been written. Without it, the failures are collected and thrown as one error after every application was tried.
   */
  importApplications(
    importData: ApplicationExportInterface,
    options: ApplicationImportOptions,
    resultCallback?: ResultCallback<ApplicationGlossarySkeleton>
  ): Promise<ApplicationGlossarySkeleton[]>;
  /**
   * Read what an application is made of: every object that its record points to, and the scripts, circles of trust and (on Identity Governance tenants) glossary schemas, request forms and request types that those objects use.
   * Every reference says what it points to, whether the application owns it (it exists because of the application) or shares it (other applications can use it too), and where the reference comes from. References that could not be followed (the object does not exist, or could not be read) are listed as problems; they do not make the call fail.
   * @param {string} applicationId application uuid
   * @returns {Promise<ApplicationReferences>} a promise that resolves to the references of the application
   */
  readApplicationReferences(
    applicationId: string
  ): Promise<ApplicationReferences>;
  /**
   * Read what an application is made of, by application name. See readApplicationReferences.
   * @param {string} applicationName application name
   * @returns {Promise<ApplicationReferences>} a promise that resolves to the references of the application
   */
  readApplicationReferencesByName(
    applicationName: string
  ): Promise<ApplicationReferences>;
  /**
   * List the references that an application record holds itself: the OAuth2 client, the SAML entity providers, the connector and the mappings it names, all of them owned by the application. Nothing is read, so this works on a record that comes from a file as well as on one read from a tenant.
   * @param {ApplicationSkeleton} applicationData application record
   * @returns {ApplicationReference[]} the references in the record
   */
  getApplicationRecordReferences(
    applicationData: ApplicationSkeleton
  ): ApplicationReference[];
  /**
   * Build the ownership index from application records that you already have (read from a tenant or from files). Nothing is read. See readApplicationOwnership.
   * @param {ApplicationSkeleton[]} applications application records
   * @returns {ApplicationOwnership} which application owns which OAuth2 client, SAML provider, connector and mapping
   */
  getApplicationOwnership(
    applications: ApplicationSkeleton[]
  ): ApplicationOwnership;
  /**
   * Find the applications that own an object in an ownership index.
   * @param {ApplicationOwnership} ownership the ownership index
   * @param {ApplicationOwnedKind} kind what kind of object it is
   * @param {string} id the OAuth2 client id, the SAML entity id (decoded), the connector name or the mapping name
   * @returns {ApplicationOwner[]} the applications that name the object, empty if none does
   */
  getApplicationOwners(
    ownership: ApplicationOwnership,
    kind: ApplicationOwnedKind,
    id: string
  ): ApplicationOwner[];
  /**
   * Read which application owns which object in the current realm: every OAuth2 client, SAML provider, connector and mapping that an application record names. Reads the applications once and nothing else, because the owned objects are named in the records. An object that two applications name lists both of them as owners; what that means is up to the caller. Objects that applications only share (scripts, circles of trust and the like) are not indexed.
   * @returns {Promise<ApplicationOwnership>} a promise that resolves to the ownership index
   */
  readApplicationOwnership(): Promise<ApplicationOwnership>;
  /**
   * Validate an application: check that every object its record refers to, and every script, circle of trust and (on Identity Governance tenants) glossary schema, request form and request type that those objects use, exists. Reads only; no template is needed. One finding is returned for every reference that does not resolve or could not be checked.
   * @param {string} applicationId application uuid
   * @returns {Promise<ApplicationValidationFinding[]>} validation findings, empty if every reference resolves
   */
  validateApplication(
    applicationId: string
  ): Promise<ApplicationValidationFinding[]>;
  /**
   * Validate an application by name. See validateApplication.
   * @param {string} applicationName application name
   * @returns {Promise<ApplicationValidationFinding[]>} validation findings, empty if every reference resolves
   */
  validateApplicationByName(
    applicationName: string
  ): Promise<ApplicationValidationFinding[]>;
  /**
   * Validate all applications of the realm. See validateApplication. A reference that cannot be followed in one application does not stop the validation of the others.
   * @returns {Promise<ApplicationValidationFinding[]>} validation findings of all applications, empty if every reference resolves
   */
  validateApplications(): Promise<ApplicationValidationFinding[]>;
  /**
   * Read the status of an application. Only a provisioning application, one with a connector, has a status, and it is the state of its connector: `active` if the connector is enabled, `inactive` if it is disabled. Every other application, and one whose connector configuration does not exist, has status `none`.
   * @param {string} applicationId application uuid
   * @returns {Promise<ApplicationStatusResult>} a promise that resolves to the status of the application
   */
  readApplicationStatus(
    applicationId: string
  ): Promise<ApplicationStatusResult>;
  /**
   * Read the status of an application by name. See readApplicationStatus.
   * @param {string} applicationName application name
   * @returns {Promise<ApplicationStatusResult>} a promise that resolves to the status of the application
   */
  readApplicationStatusByName(
    applicationName: string
  ): Promise<ApplicationStatusResult>;
  /**
   * Read the status of every application of the realm: the applications are read once and the enabled state of all connectors in one more request. See readApplicationStatus.
   * @returns {Promise<ApplicationStatusResult[]>} a promise that resolves to the status of every application
   */
  readApplicationStatuses(): Promise<ApplicationStatusResult[]>;
  /**
   * Enable an application: enable its connector and wait until the connector answers its connection test (see ConnectorOps.enableConnector). An application without a connector has no status to change and is an error.
   * @param {string} applicationId application uuid
   * @param {ConnectorEnableOptions} options how long to wait for the connector to answer (milliseconds)
   * @returns {Promise<ApplicationStatusChangeResult>} a promise that resolves to the status of the application after the change
   */
  enableApplication(
    applicationId: string,
    options?: ConnectorEnableOptions
  ): Promise<ApplicationStatusChangeResult>;
  /**
   * Enable an application by name. See enableApplication.
   * @param {string} applicationName application name
   * @param {ConnectorEnableOptions} options how long to wait for the connector to answer (milliseconds)
   * @returns {Promise<ApplicationStatusChangeResult>} a promise that resolves to the status of the application after the change
   */
  enableApplicationByName(
    applicationName: string,
    options?: ConnectorEnableOptions
  ): Promise<ApplicationStatusChangeResult>;
  /**
   * Disable an application: disable its connector. An application without a connector has no status to change and is an error.
   * @param {string} applicationId application uuid
   * @returns {Promise<ApplicationStatusChangeResult>} a promise that resolves to the status of the application after the change
   */
  disableApplication(
    applicationId: string
  ): Promise<ApplicationStatusChangeResult>;
  /**
   * Disable an application by name. See disableApplication.
   * @param {string} applicationName application name
   * @returns {Promise<ApplicationStatusChangeResult>} a promise that resolves to the status of the application after the change
   */
  disableApplicationByName(
    applicationName: string
  ): Promise<ApplicationStatusChangeResult>;
};

export default (state: State): Application => {
  return {
    createApplicationExportTemplate(): ApplicationExportInterface {
      return createApplicationExportTemplate({ state });
    },
    getRealmManagedApplication() {
      return getRealmManagedApplication({ state });
    },
    async createApplication(
      applicationId: string,
      applicationData: ApplicationGlossarySkeleton
    ): Promise<ApplicationGlossarySkeleton> {
      return createApplication({
        applicationId,
        applicationData,
        state,
      });
    },
    async readApplication(
      applicationId: string,
      fields = defaultFields
    ): Promise<ApplicationSkeleton> {
      return readApplication({ applicationId, fields, state });
    },
    async readApplicationByName(
      applicationName: string,
      fields = defaultFields
    ): Promise<ApplicationSkeleton> {
      return readApplicationByName({ applicationName, fields, state });
    },
    async readApplications(): Promise<ApplicationSkeleton[]> {
      return readApplications({ state });
    },
    async updateApplication(
      applicationId: string,
      moData: IdObjectSkeletonInterface
    ): Promise<ApplicationSkeleton> {
      return updateApplication({
        applicationId,
        applicationData: moData,
        state,
      });
    },
    async deleteApplication(
      applicationId: string,
      deep = true
    ): Promise<ApplicationGlossarySkeleton> {
      return deleteApplication({ applicationId, options: { deep }, state });
    },
    async deleteApplicationByName(
      applicationName: string,
      deep = true
    ): Promise<ApplicationGlossarySkeleton> {
      return deleteApplicationByName({
        applicationName,
        options: { deep },
        state,
      });
    },
    async deleteApplications(
      deep = true
    ): Promise<ApplicationGlossarySkeleton[]> {
      return deleteApplications({ options: { deep }, state });
    },
    async deleteApplicationOwnedObjects(
      applicationData: ApplicationSkeleton,
      options: ApplicationOwnedDeleteOptions = {}
    ): Promise<ApplicationOwnedObjectResult[]> {
      return deleteApplicationOwnedObjects({
        applicationData,
        ownership: options.ownership,
        resultCallback: options.resultCallback,
        state,
      });
    },
    async deleteApplicationOwnedObjectsById(
      applicationId: string,
      options: ApplicationOwnedDeleteOptions = {}
    ): Promise<ApplicationOwnedObjectResult[]> {
      return deleteApplicationOwnedObjectsById({
        applicationId,
        ownership: options.ownership,
        resultCallback: options.resultCallback,
        state,
      });
    },
    async deleteApplicationOwnedObjectsByName(
      applicationName: string,
      options: ApplicationOwnedDeleteOptions = {}
    ): Promise<ApplicationOwnedObjectResult[]> {
      return deleteApplicationOwnedObjectsByName({
        applicationName,
        ownership: options.ownership,
        resultCallback: options.resultCallback,
        state,
      });
    },
    async queryApplications(
      filter: string,
      fields: string[] = defaultFields
    ): Promise<ApplicationSkeleton[]> {
      return queryApplications({ filter, fields, state });
    },
    async exportApplication(
      applicationId: string,
      options: ApplicationExportOptions
    ): Promise<ApplicationExportInterface> {
      return exportApplication({ applicationId, options, state });
    },
    async exportApplicationByName(
      applicationName: string,
      options: ApplicationExportOptions
    ): Promise<ApplicationExportInterface> {
      return exportApplicationByName({ applicationName, options, state });
    },
    async exportApplications(
      options: ApplicationExportOptions = { deps: true, useStringArrays: true },
      resultCallback?: ResultCallback<ApplicationGlossarySkeleton>
    ): Promise<ApplicationExportInterface> {
      return exportApplications({ options, resultCallback, state });
    },
    async importApplication(
      applicationId: string,
      importData: ApplicationExportInterface,
      options: ApplicationImportOptions
    ): Promise<ApplicationGlossarySkeleton> {
      return importApplication({ applicationId, importData, options, state });
    },
    async importApplicationByName(
      applicationName: string,
      importData: ApplicationExportInterface,
      options: ApplicationImportOptions
    ): Promise<ApplicationGlossarySkeleton> {
      return importApplicationByName({
        applicationName,
        importData,
        options,
        state,
      });
    },
    async importFirstApplication(
      importData: ApplicationExportInterface,
      options: ApplicationImportOptions
    ): Promise<ApplicationGlossarySkeleton[]> {
      return [await importFirstApplication({ importData, options, state })];
    },
    async importApplications(
      importData: ApplicationExportInterface,
      options: ApplicationImportOptions,
      resultCallback?: ResultCallback<ApplicationGlossarySkeleton>
    ): Promise<ApplicationGlossarySkeleton[]> {
      return importApplications({ importData, options, resultCallback, state });
    },
    async readApplicationReferences(
      applicationId: string
    ): Promise<ApplicationReferences> {
      return readApplicationReferences({ applicationId, state });
    },
    async readApplicationReferencesByName(
      applicationName: string
    ): Promise<ApplicationReferences> {
      return readApplicationReferencesByName({ applicationName, state });
    },
    getApplicationRecordReferences(
      applicationData: ApplicationSkeleton
    ): ApplicationReference[] {
      return getApplicationRecordReferences(applicationData);
    },
    getApplicationOwnership(
      applications: ApplicationSkeleton[]
    ): ApplicationOwnership {
      return getApplicationOwnership(applications);
    },
    getApplicationOwners(
      ownership: ApplicationOwnership,
      kind: ApplicationOwnedKind,
      id: string
    ): ApplicationOwner[] {
      return getApplicationOwners(ownership, kind, id);
    },
    async readApplicationOwnership(): Promise<ApplicationOwnership> {
      return readApplicationOwnership({ state });
    },
    async validateApplication(
      applicationId: string
    ): Promise<ApplicationValidationFinding[]> {
      return validateApplication({ applicationId, state });
    },
    async validateApplicationByName(
      applicationName: string
    ): Promise<ApplicationValidationFinding[]> {
      return validateApplicationByName({ applicationName, state });
    },
    async validateApplications(): Promise<ApplicationValidationFinding[]> {
      return validateApplications({ state });
    },
    async readApplicationStatus(
      applicationId: string
    ): Promise<ApplicationStatusResult> {
      return readApplicationStatus({ applicationId, state });
    },
    async readApplicationStatusByName(
      applicationName: string
    ): Promise<ApplicationStatusResult> {
      return readApplicationStatusByName({ applicationName, state });
    },
    async readApplicationStatuses(): Promise<ApplicationStatusResult[]> {
      return readApplicationStatuses({ state });
    },
    async enableApplication(
      applicationId: string,
      options?: ConnectorEnableOptions
    ): Promise<ApplicationStatusChangeResult> {
      return enableApplication({ applicationId, options, state });
    },
    async enableApplicationByName(
      applicationName: string,
      options?: ConnectorEnableOptions
    ): Promise<ApplicationStatusChangeResult> {
      return enableApplicationByName({ applicationName, options, state });
    },
    async disableApplication(
      applicationId: string
    ): Promise<ApplicationStatusChangeResult> {
      return disableApplication({ applicationId, state });
    },
    async disableApplicationByName(
      applicationName: string
    ): Promise<ApplicationStatusChangeResult> {
      return disableApplicationByName({ applicationName, state });
    },
  };
};

/**
 * A relationship of an application to a managed object, such as a user.
 * The runtime access data (`members`, `owners`, `roles`) are references by id: they differ per environment.
 */
export type ApplicationRelationship = {
  _ref: string;
  _refResourceCollection: string;
  _refResourceId: string;
  _refProperties?: {
    _id?: string;
    _rev?: string;
    [key: string]: unknown;
  };
};

/**
 * The pointers from an application to the objects that implement its sign-on. Which keys are present depends on the
 * template type of the application; provisioning and bookmark applications have none.
 */
export type ApplicationSsoEntities = {
  /** OIDC (web, native, service): id of the OAuth2 client of the application */
  oidcId?: string;
  /** OIDC (usually), SAML and WS-Fed */
  idpLoginUrl?: string;
  /** SAML and WS-Fed */
  domain?: string;
  /** SAML */
  idpLocation?: string;
  /** SAML: entity id of the identity provider, base64 encoded without padding */
  idpPrivateId?: string;
  /** SAML */
  key?: string;
  /** SAML */
  spLocation?: string;
  /** SAML: entity id of the service provider, base64 encoded without padding */
  spPrivateId?: string;
  /** WS-Fed */
  pfApcId?: string;
  /** WS-Fed */
  pfIdpAdapterId?: string;
  /** WS-Fed */
  pfPolicyId?: string;
  /** WS-Fed */
  pfSigningCertId?: string;
  /** WS-Fed */
  pfSpConnectionId?: string;
  /**
   * @deprecated No application record has this key; the service provider entity id is `spPrivateId`. Kept so code that
   * names it still compiles.
   */
  spPrivate?: string;
};

export type ApplicationSkeleton = IdObjectSkeletonInterface & {
  authoritative: boolean;
  connectorId: string;
  description: string;
  icon: string;
  mappingNames: string[];
  /** Not read by default: the fields are only returned when asked for */
  members?: ApplicationRelationship[];
  name: string;
  /** Not read by default: the fields are only returned when asked for */
  owners?: ApplicationRelationship[];
  /** Not read by default: the fields are only returned when asked for */
  roles?: ApplicationRelationship[];
  ssoEntities?: ApplicationSsoEntities;
  templateName: string;
  templateVersion: string;
  uiConfig: object;
  url: string;
};

export type ApplicationGlossarySkeleton = ApplicationSkeleton & {
  glossary?: GlossarySkeleton;
};

/**
 * The kinds of object an application can refer to.
 */
export type ApplicationReferenceKind =
  | 'oauth2Client'
  | 'saml2Provider'
  | 'circleOfTrust'
  | 'connector'
  | 'mapping'
  | 'script'
  | 'glossarySchema'
  | 'requestForm'
  | 'requestType';

/**
 * A reference that points to something that exists because of the application
 * is `owned`; a reference to something other applications can use as well is
 * `shared`.
 */
export type ApplicationReferenceOwnership = 'owned' | 'shared';

/**
 * One thing an application is made of.
 */
export interface ApplicationReference {
  /** What kind of object the reference points to. */
  kind: ApplicationReferenceKind;
  /**
   * How the object is addressed: the OAuth2 client id, the SAML entity id, the circle of trust id, the connector name, the mapping name, the script id, the glossary schema name, the request form id or the request type id. A library script that could not be found is addressed by the name it is required by.
   */
  id: string;
  /** The name of the object, where it is not the id and was read (scripts). */
  name?: string;
  /** For scripts: whether it is one of the default scripts of the platform. */
  isDefault?: boolean;
  /**
   * `owned`: the object exists because of the application (the OAuth2 client of an OIDC application, the SAML entity providers, the connector and the mappings of the record). `shared`: other applications can use it as well (scripts, circles of trust, glossary schemas, request forms, request types).
   */
  ownership: ApplicationReferenceOwnership;
  /**
   * Where the reference comes from: the field of the application record (`ssoEntities.oidcId`, `ssoEntities.idpPrivateId`, `ssoEntities.spPrivateId`, `connectorId`, `mappingNames`), or the field or lookup of the object it was found in (`overrideOAuth2ClientConfig.accessTokenModificationScript`, `identityProvider.advanced.idpAdapter.idpAdapterScript`, `trustedProviders`, `require`, `glossary`, `requestFormAssignments`).
   */
  from: string;
  /** The reference this one was found through. Not set for the references in the application record. */
  via?: { kind: ApplicationReferenceKind; id: string };
}

/**
 * A reference that could not be followed.
 */
export interface ApplicationReferenceProblem {
  /** The reference that could not be followed. Not set when a whole class of references could not be listed (for example the circles of trust). */
  reference?: ApplicationReference;
  /** The kind of object that was not found or could not be read. */
  kind: ApplicationReferenceKind;
  /** `missing`: the object does not exist. `unreadable`: it could not be read, so nothing is known about it or about what it refers to. */
  reason: 'missing' | 'unreadable';
  /** The error, for `unreadable`. */
  error?: FrodoError;
}

/**
 * What an application is made of.
 */
export interface ApplicationReferences {
  /** Application uuid. */
  applicationId: string;
  /** Application name. */
  applicationName: string;
  /** Every thing the application refers to, directly or through another object, without duplicates. The ones in the application record come first. */
  references: ApplicationReference[];
  /** The references that could not be followed. */
  problems: ApplicationReferenceProblem[];
}

/**
 * The kinds of object an application owns: they exist because of the application, and its record names them. The
 * kinds an application only shares (scripts, circles of trust, glossary schemas, request forms and request types)
 * are not owned by any one application.
 */
export type ApplicationOwnedKind = Extract<
  ApplicationReferenceKind,
  'oauth2Client' | 'saml2Provider' | 'connector' | 'mapping'
>;

/**
 * An application that owns an object.
 */
export interface ApplicationOwner {
  /** Application uuid. Not set for a record without `_id`, such as a record read from a file. */
  applicationId?: string;
  /** Application name: the identity of an application across environments. */
  applicationName: string;
}

/**
 * An owned object and the applications that name it.
 */
export interface ApplicationOwnershipEntry {
  /** What kind of object it is. */
  kind: ApplicationOwnedKind;
  /** How the object is addressed: the OAuth2 client id, the SAML entity id (decoded), the connector name or the mapping name. */
  id: string;
  /**
   * Every application whose record names the object, ordered by name. Normally one. The library does not decide what it
   * means when there are several: that is up to the caller.
   */
  owners: ApplicationOwner[];
}

/**
 * Which application owns which object: every OAuth2 client, SAML provider, connector and mapping that an application
 * record names. An object that no application names is not in the index.
 */
export interface ApplicationOwnership {
  /** The owned objects, ordered by kind and id. */
  entries: ApplicationOwnershipEntry[];
}

/**
 * What happened to one object that an application owns when its owned objects were deleted:
 * `deleted`, `kept` because another application still names it, or `failed`.
 */
export type ApplicationOwnedObjectOutcome = 'deleted' | 'kept' | 'failed';

/**
 * The result for one owned object.
 */
export interface ApplicationOwnedObjectResult {
  /** What kind of object it is. */
  kind: ApplicationOwnedKind;
  /** How the object is addressed: the OAuth2 client id, the SAML entity id (decoded), the connector name or the mapping name. */
  id: string;
  /** What happened to it. */
  outcome: ApplicationOwnedObjectOutcome;
  /** `kept` only: the other applications that still name the object. */
  owners?: ApplicationOwner[];
  /** `failed` only: what went wrong. */
  error?: FrodoError;
}

/**
 * Options of deleting the objects an application owns.
 */
export interface ApplicationOwnedDeleteOptions {
  /**
   * Which application owns which object, as read by readApplicationOwnership. An object that an application other than the one being deleted names is kept. If it is not given, the ownership is read once for the realm, so that the safe behaviour is the default.
   */
  ownership?: ApplicationOwnership;
  /**
   * Called once for every owned object, in the order they are deleted: `(undefined, result)` for a deleted or kept object, `(error, result)` for a failed one (the result names the object), so that a caller can run every removal as one operation.
   */
  resultCallback?: ResultCallback<ApplicationOwnedObjectResult>;
}

/**
 * Stable validation codes of applications.
 *
 * | Code | The application refers to... |
 * | --- | --- |
 * | MISSING_OAUTH2_CLIENT | an OAuth2 client that does not exist. |
 * | MISSING_SAML2_PROVIDER | a SAML entity provider that does not exist. |
 * | MISSING_CONNECTOR | a connector that does not exist. |
 * | MISSING_MAPPING | a mapping that does not exist. |
 * | MISSING_SCRIPT | a script that does not exist, directly or as a library script. |
 * | MISSING_GLOSSARY_SCHEMA | a glossary schema that does not exist (Identity Governance). |
 * | MISSING_REQUEST_FORM | a request form that does not exist (Identity Governance). |
 * | MISSING_REQUEST_TYPE | a request type that does not exist (Identity Governance). |
 * | UNREADABLE_REFERENCE | something that could not be read, so it could not be checked. |
 */
export type ApplicationValidationCode =
  | 'MISSING_OAUTH2_CLIENT'
  | 'MISSING_SAML2_PROVIDER'
  | 'MISSING_CONNECTOR'
  | 'MISSING_MAPPING'
  | 'MISSING_SCRIPT'
  | 'MISSING_GLOSSARY_SCHEMA'
  | 'MISSING_REQUEST_FORM'
  | 'MISSING_REQUEST_TYPE'
  | 'UNREADABLE_REFERENCE';

/**
 * An application validation result.
 */
export interface ApplicationValidationFinding {
  /** Stable identifier for the validation rule that produced this finding. */
  code: ApplicationValidationCode;
  /** `error`: the application will not work as configured. */
  severity: 'error' | 'warning';
  /** Application uuid. */
  applicationId: string;
  /** Application name. */
  applicationName: string;
  /** Human-readable explanation. */
  message: string;
  /** The kind of object that was not found or could not be read. Not set when the application as a whole could not be validated. */
  referenceKind?: ApplicationReferenceKind;
  /** The id of the reference, when there is one (see {@link ApplicationReference.id}). */
  referenceId?: string;
  /** Where the reference comes from (see {@link ApplicationReference.from}). */
  from?: string;
}

/**
 * Export format for applications
 */
export interface ApplicationExportInterface {
  /**
   * Metadata
   */
  meta?: ExportMetaData;
  /**
   * Managed applications
   */
  managedApplication: Record<string, ApplicationGlossarySkeleton>;
  /**
   * Scripts
   */
  script?: Record<string, ScriptSkeleton>;
  /**
   * OAuth2 clients
   */
  application?: Record<string, OAuth2ClientSkeleton>;
  /**
   * Saml providers, circles of trust, and metadata
   */
  saml?: {
    hosted?: Record<string, Saml2ProviderSkeleton>;
    remote?: Record<string, Saml2ProviderSkeleton>;
    metadata?: Record<string, string[]>;
    cot?: Record<string, CircleOfTrustSkeleton>;
  };
  /**
   * connectors
   */
  connector?: Record<string, ConnectorSkeleton>;
  /**
   * mappings
   */
  mapping?: Record<string, MappingSkeleton>;
  /**
   * Glossary Schema
   */
  glossarySchema?: Record<string, GlossarySchemaItemSkeleton<any>>;
  /*
   * Request forms
   */
  requestForm?: Record<string, RequestFormSkeleton>;
  /*
   * Request types
   */
  requestType?: Record<string, RequestTypeSkeleton>;
}

/**
 * Application export options
 */
export type ApplicationExportOptions = {
  /**
   * Include the dependencies of the application: scripts, OAuth2 clients, SAML providers and circles of trust,
   * connectors and mappings, and on Identity Governance tenants the glossary schema, request forms and request types.
   */
  deps: boolean;
  /**
   * Use string arrays to store multi-line text in scripts.
   */
  useStringArrays: boolean;
};

/**
 * Application import options
 */
export type ApplicationImportOptions = {
  /**
   * Import the dependencies of the application: scripts, OAuth2 clients, SAML providers and circles of trust,
   * connectors and mappings, and on Identity Governance tenants the glossary schema, request forms and request types.
   */
  deps: boolean;
};

export function createApplicationExportTemplate({
  state,
}: {
  state: State;
}): ApplicationExportInterface {
  return {
    meta: getMetadata({ state }),
    managedApplication: {},
  } as ApplicationExportInterface;
}

export function getRealmManagedApplication({ state }: { state: State }) {
  let realmManagedApp = 'application';
  if (
    state.getDeploymentType() === constants.CLOUD_DEPLOYMENT_TYPE_KEY ||
    (state.getUseRealmPrefixOnManagedObjects() === true &&
      getCurrentRealmName(state) !== '/')
  ) {
    realmManagedApp = `${getCurrentRealmName(state)}_application`;
    debugMessage({
      message: `DeploymentType === cloud or UseRealmPrefixOnManagedObjects is true, returning '${realmManagedApp}'`,
      state: state,
    });
  }
  return realmManagedApp;
}

export async function createApplication({
  applicationId,
  applicationData,
  state,
}: {
  applicationId: string;
  applicationData: ApplicationGlossarySkeleton;
  state: State;
}): Promise<ApplicationGlossarySkeleton> {
  try {
    const glossary = applicationData.glossary;
    const moData = { ...applicationData };
    delete moData.glossary;
    const application = (await createManagedObject({
      type: getRealmManagedApplication({ state }),
      id: applicationId,
      moData,
      state,
    })) as ApplicationGlossarySkeleton;
    if (glossary && state.getIsIGA()) {
      application.glossary = await putApplicationGlossary({
        applicationId,
        glossaryData: glossary,
        state,
      });
    }
    return application;
  } catch (error) {
    throw new FrodoError(
      `Error creating ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
      error
    );
  }
}

export async function readApplication({
  applicationId,
  fields = defaultFields,
  state,
}: {
  applicationId: string;
  fields?: string[];
  state: State;
}): Promise<ApplicationSkeleton> {
  try {
    const application = await readManagedObject({
      type: getRealmManagedApplication({ state }),
      id: applicationId,
      fields,
      state,
    });
    return application as ApplicationSkeleton;
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
      error
    );
  }
}

export async function readApplicationByName({
  applicationName,
  fields = defaultFields,
  state,
}: {
  applicationName: string;
  fields?: string[];
  state: State;
}): Promise<ApplicationSkeleton> {
  try {
    const applications = await queryApplications({
      filter: `name eq '${applicationName}'`,
      fields,
      state,
    });
    switch (applications.length) {
      case 1:
        return applications[0];
      case 0:
        throw new Error(
          `${getCurrentRealmName(state) + ' realm'} application '${applicationName}' not found`
        );
      default:
        throw new Error(
          `${applications.length} ${getCurrentRealmName(state) + ' realm'} applications '${applicationName}' found`
        );
    }
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} application ${applicationName}`,
      error
    );
  }
}

export async function readApplications({
  fields = defaultFields,
  state,
}: {
  fields?: string[];
  state: State;
}): Promise<ApplicationSkeleton[]> {
  try {
    if (
      // there are no application objects in the root realm in an AIC deployment
      state.getDeploymentType() === constants.CLOUD_DEPLOYMENT_TYPE_KEY &&
      getCurrentRealmName(state) === '/'
    ) {
      return [];
    } else {
      const applications = await readManagedObjects({
        type: getRealmManagedApplication({ state }),
        fields,
        state,
      });
      return applications as ApplicationSkeleton[];
    }
  } catch (error) {
    throw new FrodoError(
      `Error reading ${getCurrentRealmName(state) + ' realm'} applications`,
      error
    );
  }
}

export async function updateApplication({
  applicationId,
  applicationData,
  state,
}: {
  applicationId: string;
  applicationData: IdObjectSkeletonInterface;
  state: State;
}): Promise<ApplicationSkeleton> {
  try {
    const application = await updateManagedObject({
      type: getRealmManagedApplication({ state }),
      id: applicationId,
      moData: applicationData,
      state,
    });
    return application as ApplicationSkeleton;
  } catch (error) {
    throw new FrodoError(
      `Error updating ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
      error
    );
  }
}

function isOidcApplication(applicationData: ApplicationSkeleton): boolean {
  return applicationData.ssoEntities?.oidcId ? true : false;
}

function getOAuth2ClientId(applicationData: ApplicationSkeleton): string {
  return applicationData.ssoEntities?.oidcId;
}

function isSaml2Application(applicationData: ApplicationSkeleton): boolean {
  return applicationData.ssoEntities?.idpPrivateId ? true : false;
}

function getSaml2IdpEntityId(applicationData: ApplicationSkeleton): string {
  return decode(applicationData.ssoEntities?.idpPrivateId);
}

function getSaml2SpEntityId(applicationData: ApplicationSkeleton): string {
  return decode(applicationData.ssoEntities?.spPrivateId);
}

function getGlossarySchemaNames(
  applicationData: ApplicationGlossarySkeleton
): string[] {
  return Object.keys(applicationData.glossary);
}

async function getRequestFormIds(
  applicationData: ApplicationGlossarySkeleton,
  state?: State,
  importData?: ApplicationExportInterface
): Promise<string[]> {
  if (importData) {
    return Object.values(importData.requestForm)
      .filter(
        (f) =>
          f.assignments &&
          f.assignments.some((a) =>
            a.objectId.startsWith(`application/${applicationData._id}`)
          )
      )
      .map((f) => f.id);
  } else if (state) {
    return (
      await getRequestFormAssignments({
        applicationId: applicationData._id,
        state,
      })
    ).map((a) => a.formId);
  } else {
    return [];
  }
}

function isProvisioningApplication(
  applicationData: ApplicationSkeleton
): boolean {
  return applicationData.connectorId ? true : false;
}

function getConnectorId(applicationData: ApplicationSkeleton): string {
  return applicationData.connectorId;
}

async function exportDependencies({
  applicationData,
  options,
  exportData,
  state,
}: {
  applicationData: ApplicationGlossarySkeleton;
  options: ApplicationExportOptions;
  exportData: ApplicationExportInterface;
  state: State;
}) {
  try {
    debugMessage({
      message: `ApplicationOps.exportDependencies: start [application=${applicationData['name']}]`,
      state,
    });
    // oauth2clients
    if (isOidcApplication(applicationData)) {
      const clientId = getOAuth2ClientId(applicationData);
      const clientData = await exportOAuth2Client({
        clientId,
        options: {
          deps: options.deps,
          useStringArrays: options.useStringArrays,
        },
        state,
      });
      exportData = mergeDeep(exportData, clientData);
    }
    // saml entity providers and circles of trust
    if (isSaml2Application(applicationData)) {
      // saml IDPs
      const saml2IdpId = getSaml2IdpEntityId(applicationData);
      if (saml2IdpId) {
        const saml2IdpData = await exportSaml2Provider({
          entityId: saml2IdpId,
          state,
        });
        exportData = mergeDeep(exportData, saml2IdpData);
      }
      // saml SPs
      const saml2SpId = getSaml2SpEntityId(applicationData);
      if (saml2SpId) {
        const saml2SpData = await exportSaml2Provider({
          entityId: saml2SpId,
          state,
        });
        exportData = mergeDeep(exportData, saml2SpData);
      }
      // circles of trust
      const cotData = await exportCirclesOfTrust({
        entityProviders: [saml2IdpId, saml2SpId],
        options: { indicateProgress: false },
        state,
      });
      exportData = mergeDeep(exportData, cotData);
    }
    // connectors and mappings
    if (isProvisioningApplication(applicationData)) {
      const connectorId = getConnectorId(applicationData);
      if (connectorId) {
        debugMessage({
          message: `ApplicationOps.exportDependencies: application=${applicationData['name']}, connector=${connectorId}`,
          state,
        });
        const connectorData = await exportConnector({
          connectorId,
          options: { deps: true, useStringArrays: true },
          state,
        });
        exportData = mergeDeep(exportData, connectorData);
      }
    }
    // glossary schema
    if (state.getIsIGA() && applicationData.glossary) {
      const names = getGlossarySchemaNames(applicationData);
      for (const glossaryName of names) {
        exportData = mergeDeep(
          exportData,
          await exportGlossarySchemaByNameAndObjectType({
            glossaryName,
            objectType: constants.GLOSSARY_APPLICATION_OBJECT_TYPE,
            state,
          })
        );
      }
    }
    // request types/forms
    if (state.getIsIGA()) {
      const ids = await getRequestFormIds(applicationData, state);
      for (const formId of ids) {
        exportData = mergeDeep(
          exportData,
          await exportRequestForm({
            formId,
            options: { deps: true, useStringArrays: options.useStringArrays },
            state,
          })
        );
      }
    }
    debugMessage({
      message: `ApplicationOps.exportDependencies: end`,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} dependencies`,
      error
    );
  }
}

async function importDependencies({
  applicationData,
  importData,
  state,
}: {
  applicationData: ApplicationGlossarySkeleton;
  importData: ApplicationExportInterface;
  state: State;
}) {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `ApplicationOps.importDependencies: start [application=${applicationData['name']}]`,
      state,
    });
    // oauth2clients
    if (isOidcApplication(applicationData)) {
      const clientId = getOAuth2ClientId(applicationData);
      try {
        await importOAuth2Client({
          clientId,
          importData: importData as OAuth2ClientExportInterface,
          options: { deps: true },
          state,
        });
      } catch (error) {
        errors.push(error);
      }
    }
    // saml entity providers and circles of trust
    if (isSaml2Application(applicationData)) {
      // saml IDPs
      const saml2IdpId = getSaml2IdpEntityId(applicationData);
      if (saml2IdpId) {
        try {
          await importSaml2Provider({
            entityId: saml2IdpId,
            importData: importData as Saml2ExportInterface,
            options: { deps: true },
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
      // saml SPs
      const saml2SpId = getSaml2SpEntityId(applicationData);
      if (saml2SpId) {
        try {
          await importSaml2Provider({
            entityId: saml2SpId,
            importData: importData as Saml2ExportInterface,
            options: { deps: true },
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
      // circles of trust
      try {
        await importCirclesOfTrust({
          entityProviders: [saml2IdpId, saml2SpId],
          importData: importData as CirclesOfTrustExportInterface,
          state,
        });
      } catch (error) {
        errors.push(error);
      }
    }
    // connectors and mappings
    if (isProvisioningApplication(applicationData)) {
      const connectorId = getConnectorId(applicationData);
      if (connectorId && importData.connector) {
        try {
          await importConnector({
            connectorId,
            importData: importData as ConnectorExportInterface,
            options: { deps: true },
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
    }
    // glossary schema
    if (state.getIsIGA() && importData.glossarySchema) {
      const names = getGlossarySchemaNames(applicationData);
      for (const glossaryName of names) {
        try {
          await importGlossarySchemas({
            glossaryName,
            objectType: constants.GLOSSARY_APPLICATION_OBJECT_TYPE,
            importData: importData as GlossarySchemaExportInterface,
            options: {
              includeInternal: false,
            },
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
    }
    // request forms/types
    if (state.getIsIGA() && importData.requestForm) {
      const ids = await getRequestFormIds(applicationData, state, importData);
      for (const formId of ids) {
        try {
          await importRequestForms({
            formId,
            //@ts-expect-error Since we ensure requestForm exists before this, we can ignore the error
            importData,
            options: { deps: true },
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length) {
      throw new FrodoError(
        `Error importing ${getCurrentRealmName(state) + ' realm'} dependencies`,
        errors
      );
    }
    debugMessage({
      message: `ApplicationOps.importDependencies: end`,
      state,
    });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} dependencies`,
      error
    );
  }
}

async function deleteDependencies({
  applicationData,
  state,
}: {
  applicationData: ApplicationGlossarySkeleton;
  state: State;
}) {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `ApplicationOps.deleteDependencies: start [application=${applicationData['name']}]`,
      state,
    });
    // oauth2clients
    if (isOidcApplication(applicationData)) {
      const clientId = getOAuth2ClientId(applicationData);
      if (clientId) {
        try {
          await deleteOAuth2Client({
            clientId,
            state,
          });
          debugMessage({
            message: `ApplicationOps.deleteDependencies: Deleted oauth2 client '${clientId}'.`,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
    }
    // saml entity providers and circles of trust
    if (isSaml2Application(applicationData)) {
      // saml IDPs
      const saml2IdpId = getSaml2IdpEntityId(applicationData);
      try {
        if (saml2IdpId) {
          await deleteSaml2Provider({
            entityId: saml2IdpId,
            state,
          });
          debugMessage({
            message: `ApplicationOps.deleteDependencies: Deleted saml2 idp '${saml2IdpId}'.`,
            state,
          });
        }
      } catch (error) {
        errors.push(error);
      }
      // saml SPs
      const saml2SpId = getSaml2SpEntityId(applicationData);
      try {
        if (saml2SpId) {
          await deleteSaml2Provider({
            entityId: saml2SpId,
            state,
          });
          debugMessage({
            message: `ApplicationOps.deleteDependencies: Deleted saml2 sp '${saml2SpId}'.`,
            state,
          });
        }
      } catch (error) {
        errors.push(error);
      }
      // circles of trust
      // only remove providers from circle of trust, don't delete the cot object
      try {
        const cots = await readCirclesOfTrust({
          entityProviders: [saml2IdpId, saml2SpId],
          state,
        });
        for (const cot of cots) {
          // remove providers before saving modified cot
          debugMessage({
            message: `ApplicationOps.deleteDependencies: Existing trusted providers for ${
              cot._id
            }:\n${cot.trustedProviders
              .map((it) => it.split('|')[0])
              .join('\n')}.`,
            state,
          });
          const providers = cot.trustedProviders.filter(
            (provider) =>
              provider !== `${saml2IdpId}|saml2` &&
              provider !== `${saml2SpId}|saml2`
          );
          cot.trustedProviders = providers;
          debugMessage({
            message: `ApplicationOps.deleteDependencies: Updated trusted providers for ${
              cot._id
            }:\n${cot.trustedProviders
              .map((it) => it.split('|')[0])
              .join('\n')}.`,
            state,
          });
          await updateCircleOfTrust({ cotId: cot._id, cotData: cot, state });
        }
      } catch (error) {
        errors.push(error);
      }
    }
    // connectors and mappings
    if (isProvisioningApplication(applicationData)) {
      const connectorId = getConnectorId(applicationData);
      if (connectorId) {
        try {
          await deleteConnector({
            connectorId,
            deep: true,
            state,
          });
          debugMessage({
            message: `ApplicationOps.deleteDependencies: Deleted connector '${connectorId}' and its mappings.`,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
    }
    // glossary schema
    if (state.getIsIGA() && applicationData.glossary) {
      const names = getGlossarySchemaNames(applicationData);
      for (const glossaryName of names) {
        try {
          await deleteGlossarySchemaByNameAndObjectType({
            glossaryName,
            objectType: constants.GLOSSARY_APPLICATION_OBJECT_TYPE,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
    }
    // request forms/types
    if (state.getIsIGA()) {
      const ids = await getRequestFormIds(applicationData, state);
      for (const formId of ids) {
        // Get request types of the request form
        const requestTypeIds = (
          await getRequestFormAssignments({ formId, state })
        )
          .filter((a) => a.objectId.startsWith('requestType/'))
          .map((a) => a.objectId.split('/').pop());
        // Delete request types
        for (const typeId of requestTypeIds) {
          try {
            await deleteRequestType({ typeId, state });
          } catch (error) {
            errors.push(error);
          }
        }
        // Delete request form
        try {
          await deleteRequestForm({ formId, state });
        } catch (error) {
          errors.push(error);
        }
      }
      // Clean up any remaining orphaned assignments related to the application (they should've all been deleted when the request forms were, but just to be safe)
      try {
        await deleteOrphanedRequestFormAssignments({
          applicationId: applicationData._id,
          state,
        });
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error deleting ${getCurrentRealmName(state) + ' realm'} dependencies`,
        errors
      );
    }
    debugMessage({
      message: `ApplicationOps.deleteDependencies: end`,
      state,
    });
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} dependencies`,
      error
    );
  }
}

export async function deleteApplication({
  applicationId,
  options = { deep: true },
  state,
}: {
  applicationId: string;
  options?: { deep: boolean };
  state: State;
}): Promise<ApplicationGlossarySkeleton> {
  try {
    debugMessage({ message: `ApplicationOps.deleteApplication: start`, state });
    const { deep } = options;
    let glossary;
    if (state.getIsIGA()) {
      glossary = await deleteApplicationGlossary({
        applicationId,
        state,
      });
    }
    const applicationData: ApplicationGlossarySkeleton =
      (await deleteManagedObject({
        type: getRealmManagedApplication({ state }),
        id: applicationId,
        state,
      })) as ApplicationGlossarySkeleton;
    if (glossary) {
      applicationData.glossary = glossary;
    }
    if (deep) {
      await deleteDependencies({ applicationData, state });
    }
    debugMessage({ message: `ApplicationOps.deleteApplication: end`, state });
    return applicationData as ApplicationGlossarySkeleton;
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
      error
    );
  }
}

export async function deleteApplicationByName({
  applicationName,
  options = { deep: true },
  state,
}: {
  applicationName: string;
  options?: { deep: boolean };
  state: State;
}): Promise<ApplicationGlossarySkeleton> {
  let applications: ApplicationGlossarySkeleton[];
  try {
    applications = await queryApplications({
      filter: `name eq '${applicationName}'`,
      fields: ['_id'],
      state,
    });
    if (applications.length == 1) {
      return await deleteApplication({
        applicationId: applications[0]._id,
        options,
        state,
      });
    }
  } catch (error) {
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} application ${applicationName}`,
      error
    );
  }
  if (applications.length == 0) {
    throw new FrodoError(`Application '${applicationName}' not found`);
  }
  if (applications.length > 1) {
    throw new FrodoError(
      `${applications.length} applications '${applicationName}' found`
    );
  }
}

export async function deleteApplications({
  options = { deep: true },
  state,
}: {
  options?: { deep: boolean };
  state: State;
}): Promise<ApplicationGlossarySkeleton[]> {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `ApplicationOps.deleteApplications: start`,
      state,
    });
    const applications = await readApplications({
      state,
    });
    const deleted: ApplicationGlossarySkeleton[] = [];
    for (const application of applications) {
      debugMessage({
        message: `ApplicationOps.deleteApplications: '${application['_id']}'`,
        state,
      });
      try {
        deleted.push(
          await deleteApplication({
            applicationId: application['_id'],
            options,
            state,
          })
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) {
      throw new FrodoError(
        `Error deleting ${getCurrentRealmName(state) + ' realm'} applications`,
        errors
      );
    }
    debugMessage({ message: `ApplicationOps.deleteApplications: end`, state });
    return deleted;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error deleting ${getCurrentRealmName(state) + ' realm'} applications`,
      error
    );
  }
}

/**
 * The order in which owned objects are deleted: the OAuth2 client, the SAML
 * providers, the mappings, then the connector they belong to.
 */
const OWNED_DELETE_ORDER: ApplicationOwnedKind[] = [
  'oauth2Client',
  'saml2Provider',
  'mapping',
  'connector',
];

/**
 * Whether an owner of an object is the application that is being deleted
 * @param {ApplicationOwner} owner an owner from the ownership index
 * @param {ApplicationSkeleton} applicationData the application record
 * @returns {boolean} true if the owner is that application
 */
function isSameApplication(
  owner: ApplicationOwner,
  applicationData: ApplicationSkeleton
): boolean {
  if (owner.applicationId && applicationData._id) {
    return owner.applicationId === applicationData._id;
  }
  return owner.applicationName === applicationData.name;
}

/**
 * Delete one owned object
 * @param {ApplicationOwnedKind} kind what kind of object it is
 * @param {string} id the OAuth2 client id, the SAML entity id (decoded), the connector name or the mapping name
 * @param {Map<string, string> | FrodoError} mappingIds the ids of the mappings by name, read once for all mappings, or the error of reading them
 */
async function deleteOwnedObject({
  kind,
  id,
  mappingIds,
  state,
}: {
  kind: ApplicationOwnedKind;
  id: string;
  mappingIds: Map<string, string> | FrodoError;
  state: State;
}): Promise<void> {
  switch (kind) {
    case 'oauth2Client':
      await deleteOAuth2Client({ clientId: id, state });
      break;
    case 'saml2Provider': {
      await deleteSaml2Provider({ entityId: id, state });
      // only take the provider out of its circles of trust, never delete a circle of trust
      try {
        const cots = await readCirclesOfTrust({
          entityProviders: [id],
          state,
        });
        for (const cot of cots) {
          cot.trustedProviders = cot.trustedProviders.filter(
            (provider) => provider !== `${id}|saml2`
          );
          await updateCircleOfTrust({ cotId: cot._id, cotData: cot, state });
        }
      } catch (error) {
        throw new FrodoError(
          `SAML provider ${id} was deleted, but it could not be removed from its circles of trust`,
          error
        );
      }
      break;
    }
    case 'mapping': {
      if (mappingIds instanceof FrodoError) {
        throw new FrodoError(
          `Mapping ${id} could not be looked up, because the mappings could not be read`,
          mappingIds
        );
      }
      const mappingId = mappingIds.get(id);
      if (!mappingId) {
        throw new FrodoError(`Mapping ${id} not found`);
      }
      await deleteMapping({ mappingId, state });
      break;
    }
    case 'connector':
      // the mappings that the record names are deleted one by one, so that every one is reported and
      // kept when another application names it: no deep delete, which removes every mapping of the connector
      await deleteConnector({ connectorId: id, deep: false, state });
      break;
  }
}

/**
 * Delete the objects an application owns: the OAuth2 client, the SAML entity
 * providers (and their membership in circles of trust), the mappings and the
 * connector that its record names. The record itself is not deleted (delete it
 * first, with `deep` off, and pass the record that comes back), and the objects
 * an application only shares (scripts, circles of trust, glossary schemas,
 * request forms, request types) are never touched. An object that another
 * application still names is kept. Every object is reported to the result
 * callback once; a failure of one object does not stop the others and is not
 * thrown.
 * @param {ApplicationSkeleton} applicationData the application record
 * @param {ApplicationOwnership} ownership which application owns which object. Default: read once for the realm
 * @param {ResultCallback<ApplicationOwnedObjectResult>} resultCallback called once for every owned object: `(undefined, result)` for a deleted or kept object, `(error, result)` for a failed one
 * @returns {Promise<ApplicationOwnedObjectResult[]>} a promise that resolves to what happened to each owned object, in the order they were handled
 * @throws {FrodoError} if the ownership has to be read and cannot be
 */
export async function deleteApplicationOwnedObjects({
  applicationData,
  ownership,
  resultCallback,
  state,
}: {
  applicationData: ApplicationSkeleton;
  ownership?: ApplicationOwnership;
  resultCallback?: ResultCallback<ApplicationOwnedObjectResult>;
  state: State;
}): Promise<ApplicationOwnedObjectResult[]> {
  try {
    debugMessage({
      message: `ApplicationOps.deleteApplicationOwnedObjects: start [application=${applicationData.name}]`,
      state,
    });
    const references = getApplicationRecordReferences(applicationData)
      .filter((reference) => isOwnedKind(reference.kind))
      .sort(
        (a, b) =>
          OWNED_DELETE_ORDER.indexOf(a.kind as ApplicationOwnedKind) -
          OWNED_DELETE_ORDER.indexOf(b.kind as ApplicationOwnedKind)
      );
    const results: ApplicationOwnedObjectResult[] = [];
    if (references.length === 0) {
      return results;
    }
    const index = ownership ?? (await readApplicationOwnership({ state }));
    // the mappings are named in the record, but deleted by id: read the ids once
    let mappingIds: Map<string, string> | FrodoError = new Map();
    if (references.some((reference) => reference.kind === 'mapping')) {
      try {
        const ids = new Map<string, string>();
        for (const mapping of await readMappings({ state })) {
          ids.set(mapping.name, mapping._id);
        }
        mappingIds = ids;
      } catch (error) {
        // every mapping that has to be deleted is then reported as failed by name
        mappingIds =
          error instanceof FrodoError
            ? error
            : new FrodoError('Error reading mappings', error);
      }
    }
    for (const reference of references) {
      const kind = reference.kind as ApplicationOwnedKind;
      const others = getApplicationOwners(index, kind, reference.id).filter(
        (owner) => !isSameApplication(owner, applicationData)
      );
      let result: ApplicationOwnedObjectResult;
      if (others.length > 0) {
        result = { kind, id: reference.id, outcome: 'kept', owners: others };
      } else {
        try {
          await deleteOwnedObject({
            kind,
            id: reference.id,
            mappingIds,
            state,
          });
          result = { kind, id: reference.id, outcome: 'deleted' };
        } catch (error) {
          result = {
            kind,
            id: reference.id,
            outcome: 'failed',
            error:
              error instanceof FrodoError
                ? error
                : new FrodoError(
                    `Error deleting ${kind} ${reference.id}`,
                    error
                  ),
          };
        }
      }
      results.push(result);
      if (resultCallback) {
        resultCallback(result.error, result);
      }
    }
    debugMessage({
      message: `ApplicationOps.deleteApplicationOwnedObjects: end`,
      state,
    });
    return results;
  } catch (error) {
    throw new FrodoError(
      `Error deleting the objects owned by ${getCurrentRealmName(state) + ' realm'} application ${applicationData.name}`,
      error
    );
  }
}

/**
 * Delete the objects an application owns, by application id. The application
 * is read first, so it must still exist: to delete the record first, pass the
 * record that `deleteApplication` returns to `deleteApplicationOwnedObjects`.
 * @param {string} applicationId application uuid
 * @param {ApplicationOwnership} ownership which application owns which object. Default: read once for the realm
 * @param {ResultCallback<ApplicationOwnedObjectResult>} resultCallback called once for every owned object
 * @returns {Promise<ApplicationOwnedObjectResult[]>} a promise that resolves to what happened to each owned object
 */
export async function deleteApplicationOwnedObjectsById({
  applicationId,
  ownership,
  resultCallback,
  state,
}: {
  applicationId: string;
  ownership?: ApplicationOwnership;
  resultCallback?: ResultCallback<ApplicationOwnedObjectResult>;
  state: State;
}): Promise<ApplicationOwnedObjectResult[]> {
  const applicationData = await readApplication({ applicationId, state });
  return deleteApplicationOwnedObjects({
    applicationData,
    ownership,
    resultCallback,
    state,
  });
}

/**
 * Delete the objects an application owns, by application name. The
 * application is read first, so it must still exist: to delete the record
 * first, pass the record that `deleteApplicationByName` returns to
 * `deleteApplicationOwnedObjects`.
 * @param {string} applicationName application name
 * @param {ApplicationOwnership} ownership which application owns which object. Default: read once for the realm
 * @param {ResultCallback<ApplicationOwnedObjectResult>} resultCallback called once for every owned object
 * @returns {Promise<ApplicationOwnedObjectResult[]>} a promise that resolves to what happened to each owned object
 */
export async function deleteApplicationOwnedObjectsByName({
  applicationName,
  ownership,
  resultCallback,
  state,
}: {
  applicationName: string;
  ownership?: ApplicationOwnership;
  resultCallback?: ResultCallback<ApplicationOwnedObjectResult>;
  state: State;
}): Promise<ApplicationOwnedObjectResult[]> {
  const applicationData = await readApplicationByName({
    applicationName,
    state,
  });
  return deleteApplicationOwnedObjects({
    applicationData,
    ownership,
    resultCallback,
    state,
  });
}

export async function queryApplications({
  filter,
  fields = defaultFields,
  state,
}: {
  filter: string;
  fields?: string[];
  state: State;
}): Promise<ApplicationSkeleton[]> {
  try {
    const application = await queryManagedObjects({
      type: getRealmManagedApplication({ state }),
      filter,
      fields,
      state,
    });
    return application as ApplicationSkeleton[];
  } catch (error) {
    throw new FrodoError(
      `Error querying ${getCurrentRealmName(state) + ' realm'} applications with filter ${filter}`,
      error
    );
  }
}

export async function exportApplication({
  applicationId,
  options = {
    deps: true,
    useStringArrays: true,
  },
  state,
}: {
  applicationId: string;
  options: ApplicationExportOptions;
  state: State;
}): Promise<ApplicationExportInterface> {
  try {
    debugMessage({ message: `ApplicationOps.exportApplication: start`, state });
    const applicationData = (await readApplication({
      applicationId,
      state,
    })) as ApplicationGlossarySkeleton;
    if (state.getIsIGA()) {
      applicationData.glossary = await readApplicationGlossary({
        applicationId: applicationData._id,
        state,
      });
    }
    const exportData = createApplicationExportTemplate({ state });
    exportData.managedApplication[applicationData._id] = applicationData;
    if (options.deps) {
      await exportDependencies({
        applicationData: applicationData,
        options,
        exportData,
        state,
      });
    }
    debugMessage({ message: `ApplicationOps.exportApplication: end`, state });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
      error
    );
  }
}

export async function exportApplicationByName({
  applicationName,
  options = {
    deps: true,
    useStringArrays: true,
  },
  state,
}: {
  applicationName: string;
  options: ApplicationExportOptions;
  state: State;
}): Promise<ApplicationExportInterface> {
  try {
    debugMessage({
      message: `ApplicationOps.exportApplicationByName: start`,
      state,
    });
    const applicationData = (await readApplicationByName({
      applicationName,
      state,
    })) as ApplicationGlossarySkeleton;
    if (state.getIsIGA()) {
      applicationData.glossary = await readApplicationGlossary({
        applicationId: applicationData._id,
        state,
      });
    }
    const exportData = createApplicationExportTemplate({ state });
    exportData.managedApplication[applicationData._id] = applicationData;
    if (options.deps) {
      await exportDependencies({
        applicationData: applicationData,
        options,
        exportData,
        state,
      });
    }
    debugMessage({
      message: `ApplicationOps.exportApplicationByName: end`,
      state,
    });
    return exportData;
  } catch (error) {
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} application ${applicationName}`,
      error
    );
  }
}

/**
 * Export all applications. The response can be saved to file as is.
 * Every application is tried: an application that cannot be exported does not stop the others.
 * @param {ApplicationExportOptions} options export options
 * @param {ResultCallback<ApplicationGlossarySkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every application is passed to it as it happens (a failed application as an error that names it, with the reasons nested) and a failed application does not throw: the applications that could be exported are returned. The dependencies of a failed application that were read before it failed may still be in the export. Without it, the failures are collected and thrown as one error after every application was tried. Failing to read the applications always throws.
 * @returns {Promise<ApplicationExportInterface>} Promise resolving to an ApplicationExportInterface object.
 */
export async function exportApplications({
  options,
  resultCallback = void 0,
  state,
}: {
  options: ApplicationExportOptions;
  resultCallback?: ResultCallback<ApplicationGlossarySkeleton>;
  state: State;
}): Promise<ApplicationExportInterface> {
  const errors: Error[] = [];
  let indicatorId: string;
  try {
    debugMessage({ message: `ApplicationOps.exportApplication: start`, state });
    const exportData = createApplicationExportTemplate({ state });
    const applications = (await readApplications({
      state,
    })) as ApplicationGlossarySkeleton[];
    indicatorId = createProgressIndicator({
      total: applications.length,
      message: `Exporting ${getCurrentRealmName(state) + ' realm'} applications...`,
      state,
    });
    for (const applicationData of applications) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting ${getCurrentRealmName(state) + ' realm'} application ${applicationData.name}`,
        state,
      });
      // what went wrong with this application
      const failures: Error[] = [];
      if (state.getIsIGA()) {
        try {
          applicationData.glossary = await readApplicationGlossary({
            applicationId: applicationData._id,
            state,
          });
        } catch (error) {
          failures.push(error);
        }
      }
      if (options.deps) {
        try {
          await exportDependencies({
            applicationData: applicationData,
            options,
            exportData,
            state,
          });
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length === 0) {
        exportData.managedApplication[applicationData._id] = applicationData;
        if (resultCallback) resultCallback(undefined, applicationData);
      } else if (resultCallback) {
        resultCallback(
          new FrodoError(
            `Error exporting ${getCurrentRealmName(state) + ' realm'} application ${applicationData.name}`,
            failures
          ),
          undefined
        );
      } else {
        errors.push(...failures);
      }
    }
    if (errors.length > 0) {
      stopProgressIndicator({
        id: indicatorId,
        message: `Error exporting ${getCurrentRealmName(state) + ' realm'} applications`,
        status: 'fail',
        state,
      });
      throw new FrodoError(
        `Error exporting ${getCurrentRealmName(state) + ' realm'} applications`,
        errors
      );
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${applications.length} ${getCurrentRealmName(state) + ' realm'} applications`,
      state,
    });
    debugMessage({ message: `ApplicationOps.exportApplication: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting ${getCurrentRealmName(state) + ' realm'} applications`,
      status: 'fail',
      state,
    });
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error exporting ${getCurrentRealmName(state) + ' realm'} applications`,
      error
    );
  }
}

/**
 * Import application. The import writes the configuration fields of the application with a PUT. A PUT that does not carry `members`, `owners` and `roles` leaves them as they are, so an import does not remove who has access.
 * @param {string} applicationId application uuid
 * @param {ApplicationExportInterface} importData import data
 * @param {ApplicationImportOptions} options import options
 * @returns {Promise<ApplicationGlossarySkeleton>} a promise resolving to an application object
 */
export async function importApplication({
  applicationId,
  importData,
  options = { deps: true },
  state,
}: {
  applicationId: string;
  importData: ApplicationExportInterface;
  options?: ApplicationImportOptions;
  state: State;
}): Promise<ApplicationGlossarySkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  try {
    for (const id of Object.keys(importData.managedApplication)) {
      if (id === applicationId) {
        try {
          const applicationData = importData.managedApplication[id];
          delete applicationData._provider;
          delete applicationData._rev;
          if (options.deps) {
            await importDependencies({ applicationData, importData, state });
          }
          let glossary;
          if (state.getIsIGA() && applicationData.glossary) {
            glossary = await putApplicationGlossary({
              applicationId,
              glossaryData: applicationData.glossary,
              state,
            });
          }
          delete applicationData.glossary;
          response = await updateApplication({
            applicationId,
            applicationData,
            state,
          });
          if (glossary) {
            response.glossary = glossary;
          }
          imported.push(id);
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
        errors
      );
    }
    if (0 === imported.length) {
      throw new FrodoError(
        `Import error:\n${applicationId} not found in import data!`
      );
    }
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0 || imported.length == 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
      error
    );
  }
}

/**
 * Import application by name. The import writes the configuration fields of the application with a PUT. A PUT that does not carry `members`, `owners` and `roles` leaves them as they are, so an import does not remove who has access.
 * @param {string} applicationName application name
 * @param {ApplicationExportInterface} importData import data
 * @param {ApplicationImportOptions} options import options
 * @returns {Promise<ApplicationGlossarySkeleton>} a promise resolving to an application object
 */
export async function importApplicationByName({
  applicationName: applicationName,
  importData,
  options = { deps: true },
  state,
}: {
  applicationName: string;
  importData: ApplicationExportInterface;
  options?: ApplicationImportOptions;
  state: State;
}): Promise<ApplicationGlossarySkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  try {
    for (const applicationId of Object.keys(importData.managedApplication)) {
      if (
        importData.managedApplication[applicationId].name === applicationName
      ) {
        try {
          const applicationData = importData.managedApplication[applicationId];
          delete applicationData._provider;
          delete applicationData._rev;
          if (options.deps) {
            await importDependencies({ applicationData, importData, state });
          }
          let glossary;
          if (state.getIsIGA() && applicationData.glossary) {
            glossary = await putApplicationGlossary({
              applicationId,
              glossaryData: applicationData.glossary,
              state,
            });
          }
          delete applicationData.glossary;
          response = await updateApplication({
            applicationId,
            applicationData,
            state,
          });
          if (glossary) {
            response.glossary = glossary;
          }
          imported.push(applicationId);
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing ${getCurrentRealmName(state) + ' realm'} application ${applicationName}`,
        errors
      );
    }
    if (0 === imported.length) {
      throw new FrodoError(
        `Import error:\n${applicationName} not found in import data!`
      );
    }
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0 || imported.length == 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} application ${applicationName}`,
      error
    );
  }
}

/**
 * Import first application. Only the first application of the import data is imported. The import writes the configuration fields of the application with a PUT. A PUT that does not carry `members`, `owners` and `roles` leaves them as they are, so an import does not remove who has access.
 * @param {ApplicationExportInterface} importData import data
 * @param {ApplicationImportOptions} options import options
 * @returns {Promise<ApplicationGlossarySkeleton>} a promise resolving to the imported application
 * @throws {FrodoError} If the import data holds no application, or the first application cannot be imported.
 */
export async function importFirstApplication({
  importData,
  options = { deps: true },
  state,
}: {
  importData: ApplicationExportInterface;
  options?: ApplicationImportOptions;
  state: State;
}): Promise<ApplicationGlossarySkeleton> {
  let response = null;
  const errors = [];
  const imported = [];
  try {
    for (const applicationId of Object.keys(importData.managedApplication)) {
      try {
        const applicationData = importData.managedApplication[applicationId];
        delete applicationData._provider;
        delete applicationData._rev;
        if (options.deps) {
          await importDependencies({ applicationData, importData, state });
        }
        let glossary;
        if (state.getIsIGA() && applicationData.glossary) {
          glossary = await putApplicationGlossary({
            applicationId,
            glossaryData: applicationData.glossary,
            state,
          });
        }
        delete applicationData.glossary;
        response = await updateApplication({
          applicationId,
          applicationData,
          state,
        });
        if (glossary) {
          response.glossary = glossary;
        }
        imported.push(applicationId);
      } catch (error) {
        errors.push(error);
      }
      break;
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing first ${getCurrentRealmName(state) + ' realm'} application`,
        errors
      );
    }
    if (0 === imported.length) {
      throw new FrodoError(
        `Import error:\nNo applications found in import data!`
      );
    }
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0 || imported.length == 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing first ${getCurrentRealmName(state) + ' realm'} application`,
      error
    );
  }
}

/**
 * Import applications. The import writes the configuration fields of the application with a PUT. A PUT that does not carry `members`, `owners` and `roles` leaves them as they are, so an import does not remove who has access. Every application is tried: an application that cannot be imported does not stop the others.
 * @param {ApplicationExportInterface} importData import data
 * @param {ApplicationImportOptions} options import options
 * @param {ResultCallback<ApplicationGlossarySkeleton>} resultCallback Optional callback to process individual results. When given, the outcome of every application is passed to it as it happens (a failed application as an error that names it, with the reasons nested) and a failed application does not throw: the applications that could be imported are returned. An application whose dependencies or glossary could not be imported is a failed application, although the application itself may have been written. Without it, the failures are collected and thrown as one error after every application was tried.
 * @returns {Promise<ApplicationGlossarySkeleton[]>} a promise resolving to an array of application objects
 * @throws {FrodoError} If one or more applications cannot be imported and there is no result callback. The error carries the nested errors of the failed applications.
 */
export async function importApplications({
  importData,
  options = { deps: true },
  resultCallback = undefined,
  state,
}: {
  importData: ApplicationExportInterface;
  options?: ApplicationImportOptions;
  resultCallback?: ResultCallback<ApplicationGlossarySkeleton>;
  state: State;
}): Promise<ApplicationGlossarySkeleton[]> {
  const response = [];
  const errors = [];
  try {
    for (const applicationId of Object.keys(importData.managedApplication)) {
      const applicationData = importData.managedApplication[applicationId];
      delete applicationData._provider;
      delete applicationData._rev;
      // what went wrong with this application: the dependencies, the glossary,
      // then the application itself
      const failures: Error[] = [];
      if (options.deps) {
        try {
          await importDependencies({ applicationData, importData, state });
        } catch (error) {
          failures.push(error);
        }
      }
      let glossary;
      if (state.getIsIGA() && applicationData.glossary) {
        try {
          glossary = await putApplicationGlossary({
            applicationId,
            glossaryData: applicationData.glossary,
            state,
          });
        } catch (error) {
          failures.push(error);
        }
      }
      delete applicationData.glossary;
      let updatedApplication: ApplicationGlossarySkeleton;
      try {
        updatedApplication = await updateApplication({
          applicationId,
          applicationData,
          state,
        });
        if (glossary) {
          updatedApplication.glossary = glossary;
        }
      } catch (error) {
        failures.push(error);
      }
      // the callback is called outside the try: an exception of the callback
      // must not be taken for a failed import and reported a second time
      if (failures.length === 0) {
        response.push(updatedApplication);
        if (resultCallback) resultCallback(undefined, updatedApplication);
      } else if (resultCallback) {
        resultCallback(
          new FrodoError(
            `Error importing ${getCurrentRealmName(state) + ' realm'} application ${applicationData.name ?? applicationId}`,
            failures
          ),
          undefined
        );
      } else {
        errors.push(...failures);
      }
    }
    if (errors.length) {
      throw new FrodoError(
        `Error importing ${getCurrentRealmName(state) + ' realm'} applications`,
        errors
      );
    }
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(
      `Error importing ${getCurrentRealmName(state) + ' realm'} applications`,
      error
    );
  }
}

/**
 * Helper function that attempts to read an application's glossary, or returns null if it doesn't exist
 * @param applicationId The application id
 * @returns The application glossary, or null if it doesn't exist
 */
async function readApplicationGlossary({
  applicationId,
  state,
}: {
  applicationId: string;
  state: State;
}): Promise<GlossarySkeleton | null> {
  try {
    return await getApplicationGlossary({
      applicationId,
      state,
    });
  } catch (error) {
    if (error.response?.status !== 404) {
      throw error;
    }
  }
  return null;
}

const REFERENCE_KIND_LABELS: Record<ApplicationReferenceKind, string> = {
  oauth2Client: 'OAuth2 client',
  saml2Provider: 'SAML entity provider',
  circleOfTrust: 'circle of trust',
  connector: 'connector',
  mapping: 'mapping',
  script: 'script',
  glossarySchema: 'glossary schema',
  requestForm: 'request form',
  requestType: 'request type',
};

const MISSING_REFERENCE_CODES: Partial<
  Record<ApplicationReferenceKind, ApplicationValidationCode>
> = {
  oauth2Client: 'MISSING_OAUTH2_CLIENT',
  saml2Provider: 'MISSING_SAML2_PROVIDER',
  connector: 'MISSING_CONNECTOR',
  mapping: 'MISSING_MAPPING',
  script: 'MISSING_SCRIPT',
  glossarySchema: 'MISSING_GLOSSARY_SCHEMA',
  requestForm: 'MISSING_REQUEST_FORM',
  requestType: 'MISSING_REQUEST_TYPE',
};

/**
 * The references an application record holds itself: the OAuth2 client, the
 * SAML entity providers, the connector and the mappings. Nothing is read, so
 * it works on a record from a file as well as on one read from a tenant.
 * @param {ApplicationSkeleton} applicationData application record
 * @returns {ApplicationReference[]} the references in the record
 */
export function getApplicationRecordReferences(
  applicationData: ApplicationSkeleton
): ApplicationReference[] {
  const references: ApplicationReference[] = [];
  if (isOidcApplication(applicationData)) {
    references.push({
      kind: 'oauth2Client',
      id: getOAuth2ClientId(applicationData),
      ownership: 'owned',
      from: 'ssoEntities.oidcId',
    });
  }
  if (isSaml2Application(applicationData)) {
    references.push({
      kind: 'saml2Provider',
      id: getSaml2IdpEntityId(applicationData),
      ownership: 'owned',
      from: 'ssoEntities.idpPrivateId',
    });
    if (applicationData.ssoEntities?.spPrivateId) {
      references.push({
        kind: 'saml2Provider',
        id: getSaml2SpEntityId(applicationData),
        ownership: 'owned',
        from: 'ssoEntities.spPrivateId',
      });
    }
  }
  if (isProvisioningApplication(applicationData)) {
    references.push({
      kind: 'connector',
      id: getConnectorId(applicationData),
      ownership: 'owned',
      from: 'connectorId',
    });
  }
  for (const mappingName of applicationData.mappingNames ?? []) {
    references.push({
      kind: 'mapping',
      id: mappingName,
      ownership: 'owned',
      from: 'mappingNames',
    });
  }
  return references;
}

const OWNED_KINDS: ApplicationReferenceKind[] = [
  'oauth2Client',
  'saml2Provider',
  'connector',
  'mapping',
];

function isOwnedKind(
  kind: ApplicationReferenceKind
): kind is ApplicationOwnedKind {
  return OWNED_KINDS.includes(kind);
}

/**
 * Build the ownership index from application records: for every OAuth2 client,
 * SAML provider, connector and mapping that a record names, the applications
 * that name it. Nothing is read, so the records can come from a tenant or from
 * files. An object that several applications name lists all of them; an
 * application that names an object twice is listed once.
 * @param {ApplicationSkeleton[]} applications application records
 * @returns {ApplicationOwnership} which application owns which object
 */
export function getApplicationOwnership(
  applications: ApplicationSkeleton[]
): ApplicationOwnership {
  const entries = new Map<string, ApplicationOwnershipEntry>();
  for (const application of applications) {
    for (const reference of getApplicationRecordReferences(application)) {
      if (!isOwnedKind(reference.kind)) continue;
      const key = `${reference.kind}\u0000${reference.id}`;
      let entry = entries.get(key);
      if (!entry) {
        entry = { kind: reference.kind, id: reference.id, owners: [] };
        entries.set(key, entry);
      }
      const named = entry.owners.some(
        (owner) =>
          owner.applicationName === application.name &&
          owner.applicationId === application._id
      );
      if (!named) {
        const owner: ApplicationOwner = { applicationName: application.name };
        if (application._id) owner.applicationId = application._id;
        entry.owners.push(owner);
      }
    }
  }
  const kindOrder = (kind: ApplicationOwnedKind) => OWNED_KINDS.indexOf(kind);
  return {
    entries: [...entries.values()]
      .map((entry) => ({
        ...entry,
        owners: [...entry.owners].sort(
          (a, b) =>
            a.applicationName.localeCompare(b.applicationName) ||
            (a.applicationId ?? '').localeCompare(b.applicationId ?? '')
        ),
      }))
      .sort(
        (a, b) =>
          kindOrder(a.kind) - kindOrder(b.kind) || a.id.localeCompare(b.id)
      ),
  };
}

/**
 * Find the applications that own an object in an ownership index.
 * @param {ApplicationOwnership} ownership the ownership index
 * @param {ApplicationOwnedKind} kind what kind of object it is
 * @param {string} id the OAuth2 client id, the SAML entity id (decoded), the connector name or the mapping name
 * @returns {ApplicationOwner[]} the applications that name the object, empty if none does
 */
export function getApplicationOwners(
  ownership: ApplicationOwnership,
  kind: ApplicationOwnedKind,
  id: string
): ApplicationOwner[] {
  const entry = ownership.entries.find((e) => e.kind === kind && e.id === id);
  return entry ? entry.owners.map((owner) => ({ ...owner })) : [];
}

/**
 * The message of the error at the bottom of a chain of errors
 * @param {unknown} error error
 * @returns {string} the message of the root cause
 */
function describeCause(error: unknown): string {
  let current = error as Error;
  while ((current as FrodoError)?.originalErrors?.length) {
    current = (current as FrodoError).originalErrors[0];
  }
  return current?.message ?? String(error);
}

function asFrodoError(error: unknown, message: string): FrodoError {
  return error instanceof FrodoError
    ? error
    : new FrodoError(message, error as Error);
}

/**
 * Find everything an application is made of, and check that it exists.
 * Reads the objects the record points to (they are needed to find the scripts
 * they use), and lists the circles of trust, mappings and glossary schemas
 * once. Never throws: what cannot be followed is returned as a problem.
 * @param {ApplicationSkeleton} applicationData application record
 * @returns {Promise<ApplicationReferences>} the references and the problems
 */
async function resolveApplicationReferences({
  applicationData,
  state,
}: {
  applicationData: ApplicationSkeleton;
  state: State;
}): Promise<ApplicationReferences> {
  const references: ApplicationReference[] = [];
  const problems: ApplicationReferenceProblem[] = [];
  const seen = new Set<string>();
  const realm = getCurrentRealmName(state) + ' realm';
  const add = (reference: ApplicationReference): boolean => {
    const key = `${reference.kind}:${reference.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    references.push(reference);
    return true;
  };
  const missing = (reference: ApplicationReference) => {
    problems.push({ reference, kind: reference.kind, reason: 'missing' });
  };
  const unreadable = (
    kind: ApplicationReferenceKind,
    error: unknown,
    reference?: ApplicationReference
  ) => {
    problems.push({
      reference,
      kind,
      reason: 'unreadable',
      error: asFrodoError(
        error,
        `Error reading ${realm} ${REFERENCE_KIND_LABELS[kind]}${reference ? ' ' + reference.id : 's'}`
      ),
    });
  };
  const attempt = async <T>(
    reference: ApplicationReference,
    read: () => Promise<T>
  ): Promise<T | undefined> => {
    try {
      return await read();
    } catch (error) {
      if (isNotFoundError(error)) {
        missing(reference);
      } else {
        unreadable(reference.kind, error, reference);
      }
      return undefined;
    }
  };
  const viaOf = (reference: ApplicationReference) => ({
    kind: reference.kind,
    id: reference.id,
  });

  // scripts, and the library scripts they require
  const lookedUp = new Set<string>();
  const followLibraryScripts = async (
    script: ScriptSkeleton,
    via: ApplicationReference
  ) => {
    for (const scriptName of getLibraryScriptNames(script)) {
      if (lookedUp.has(scriptName)) continue;
      lookedUp.add(scriptName);
      const required: ApplicationReference = {
        kind: 'script',
        id: scriptName,
        name: scriptName,
        ownership: 'shared',
        from: 'require',
        via: viaOf(via),
      };
      let found: ScriptSkeleton[];
      try {
        found = (await getScriptByName({ scriptName, state })).result;
      } catch (error) {
        if (add(required)) unreadable('script', error, required);
        continue;
      }
      if (found.length === 1) {
        const library: ApplicationReference = {
          ...required,
          id: found[0]._id,
          name: found[0].name,
          isDefault: found[0].default,
        };
        if (add(library)) await followLibraryScripts(found[0], library);
      } else if (add(required)) {
        if (found.length === 0) {
          missing(required);
        } else {
          unreadable(
            'script',
            new FrodoError(
              `${found.length} ${realm} scripts named '${scriptName}' found`
            ),
            required
          );
        }
      }
    }
  };
  const followScript = async (
    scriptId: string,
    from: string,
    via: ApplicationReference
  ) => {
    const reference: ApplicationReference = {
      kind: 'script',
      id: scriptId,
      ownership: 'shared',
      from,
      via: viaOf(via),
    };
    if (!add(reference)) return;
    const script = await attempt(reference, () =>
      readScript({ scriptId, state })
    );
    if (script) {
      reference.name = script.name;
      reference.isDefault = script.default;
      await followLibraryScripts(script, reference);
    }
  };

  // the references in the record come first
  const direct = getApplicationRecordReferences(applicationData);
  direct.forEach(add);

  // OAuth2 client
  for (const reference of direct.filter((r) => r.kind === 'oauth2Client')) {
    const client = await attempt(reference, () =>
      readOAuth2Client({ clientId: reference.id, state })
    );
    if (client) {
      for (const { key, scriptId } of getOAuth2ClientScriptReferences(client)) {
        await followScript(
          scriptId,
          `overrideOAuth2ClientConfig.${key}`,
          reference
        );
      }
    }
  }

  // SAML entity providers, then the circles of trust that list them
  const providers = direct.filter((r) => r.kind === 'saml2Provider');
  if (providers.length > 0) {
    let entityIds: string[];
    try {
      entityIds = await readSaml2EntityIds({ state });
    } catch (error) {
      providers.forEach((reference) =>
        unreadable('saml2Provider', error, reference)
      );
    }
    const found: ApplicationReference[] = [];
    if (entityIds) {
      for (const reference of providers) {
        if (!entityIds.includes(reference.id)) {
          missing(reference);
          continue;
        }
        const provider = await attempt(reference, () =>
          readSaml2Provider({ entityId: reference.id, state })
        );
        if (provider) {
          found.push(reference);
          for (const { field, scriptId } of getSaml2ProviderScriptReferences(
            provider
          )) {
            await followScript(scriptId, field, reference);
          }
        }
      }
    }
    if (found.length > 0) {
      try {
        const cots = await readCirclesOfTrust({
          entityProviders: found.map((r) => r.id),
          state,
        });
        for (const cot of cots) {
          const provider = found.find((r) =>
            cot.trustedProviders?.includes(`${r.id}|saml2`)
          );
          add({
            kind: 'circleOfTrust',
            id: cot._id,
            ownership: 'shared',
            from: 'trustedProviders',
            via: provider ? viaOf(provider) : undefined,
          });
        }
      } catch (error) {
        unreadable('circleOfTrust', error);
      }
    }
  }

  // connector
  for (const reference of direct.filter((r) => r.kind === 'connector')) {
    await attempt(reference, () =>
      readConnector({ connectorId: reference.id, state })
    );
  }

  // mappings
  const mappings = direct.filter((r) => r.kind === 'mapping');
  if (mappings.length > 0) {
    let names: Set<string>;
    try {
      names = new Set((await readMappings({ state })).map((m) => m.name));
    } catch (error) {
      mappings.forEach((reference) => unreadable('mapping', error, reference));
    }
    if (names) {
      mappings.filter((r) => !names.has(r.id)).forEach(missing);
    }
  }

  // Identity Governance: glossary schemas, request forms and request types
  if (state.getIsIGA()) {
    try {
      const glossary = await readApplicationGlossary({
        applicationId: applicationData._id,
        state,
      });
      const schemas = Object.keys(glossary ?? {}).map(
        (name): ApplicationReference => ({
          kind: 'glossarySchema',
          id: name,
          ownership: 'shared',
          from: 'glossary',
        })
      );
      schemas.forEach(add);
      if (schemas.length > 0) {
        let defined: Set<string>;
        try {
          defined = new Set(
            (await readGlossarySchemas({ state }))
              .filter(
                (s) =>
                  s.objectType === constants.GLOSSARY_APPLICATION_OBJECT_TYPE
              )
              .map((s) => s.name)
          );
        } catch (error) {
          schemas.forEach((reference) =>
            unreadable('glossarySchema', error, reference)
          );
        }
        if (defined) {
          schemas.filter((r) => !defined.has(r.id)).forEach(missing);
        }
      }
    } catch (error) {
      unreadable('glossarySchema', error);
    }
    try {
      const formIds = [
        ...new Set(
          (
            await getRequestFormAssignments({
              applicationId: applicationData._id,
              state,
            })
          ).map((a) => a.formId)
        ),
      ];
      for (const formId of formIds) {
        const form: ApplicationReference = {
          kind: 'requestForm',
          id: formId,
          ownership: 'shared',
          from: 'requestFormAssignments',
        };
        if (!add(form)) continue;
        const skeleton = await attempt(form, () =>
          readRequestForm({ formId, state })
        );
        if (skeleton) {
          form.name = skeleton.name;
          // as in the export, only a request form of type request has request types
          if (skeleton.type === 'request') {
            try {
              const typeIds = (
                await getRequestFormAssignments({ formId, state })
              )
                .filter((a) => a.objectId.startsWith('requestType/'))
                .map((a) => a.objectId.split('/').pop());
              for (const typeId of new Set(typeIds)) {
                const type: ApplicationReference = {
                  kind: 'requestType',
                  id: typeId,
                  ownership: 'shared',
                  from: 'requestFormAssignments',
                  via: viaOf(form),
                };
                if (add(type)) {
                  await attempt(type, () => readRequestType({ typeId, state }));
                }
              }
            } catch (error) {
              unreadable('requestType', error);
            }
          }
        }
      }
    } catch (error) {
      unreadable('requestForm', error);
    }
  }

  return {
    applicationId: applicationData._id,
    applicationName: applicationData.name,
    references,
    problems,
  };
}

/**
 * The findings for the references of an application that could not be followed
 * @param {ApplicationReferences} applicationReferences the references and problems of an application
 * @returns {ApplicationValidationFinding[]} one finding per problem
 */
function getApplicationFindings({
  applicationReferences,
  state,
}: {
  applicationReferences: ApplicationReferences;
  state: State;
}): ApplicationValidationFinding[] {
  const { applicationId, applicationName } = applicationReferences;
  const subject = `${getCurrentRealmName(state) + ' realm'} application '${applicationName}'`;
  return applicationReferences.problems.map((problem) => {
    const label = REFERENCE_KIND_LABELS[problem.kind];
    const reference = problem.reference;
    const code =
      problem.reason === 'missing'
        ? (MISSING_REFERENCE_CODES[problem.kind] ?? 'UNREADABLE_REFERENCE')
        : 'UNREADABLE_REFERENCE';
    const message =
      problem.reason === 'missing'
        ? `${subject} refers to ${label} '${reference?.id}' (${reference?.from}), which does not exist`
        : reference
          ? `${subject}: unable to check ${label} '${reference.id}' (${reference.from}): ${describeCause(problem.error)}`
          : `${subject}: unable to read its ${label} references: ${describeCause(problem.error)}`;
    return {
      code,
      severity: 'error',
      applicationId,
      applicationName,
      message,
      referenceKind: problem.kind,
      referenceId: reference?.id,
      from: reference?.from,
    };
  });
}

/**
 * Read what an application is made of
 * @param {string} applicationId application uuid
 * @returns {Promise<ApplicationReferences>} a promise that resolves to the references of the application
 */
export async function readApplicationReferences({
  applicationId,
  state,
}: {
  applicationId: string;
  state: State;
}): Promise<ApplicationReferences> {
  try {
    const applicationData = await readApplication({ applicationId, state });
    return await resolveApplicationReferences({ applicationData, state });
  } catch (error) {
    throw new FrodoError(
      `Error reading references of ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
      error
    );
  }
}

/**
 * Read what an application is made of, by application name
 * @param {string} applicationName application name
 * @returns {Promise<ApplicationReferences>} a promise that resolves to the references of the application
 */
export async function readApplicationReferencesByName({
  applicationName,
  state,
}: {
  applicationName: string;
  state: State;
}): Promise<ApplicationReferences> {
  try {
    const applicationData = await readApplicationByName({
      applicationName,
      state,
    });
    return await resolveApplicationReferences({ applicationData, state });
  } catch (error) {
    throw new FrodoError(
      `Error reading references of ${getCurrentRealmName(state) + ' realm'} application ${applicationName}`,
      error
    );
  }
}

/**
 * Read which application owns which object in the current realm. Reads the
 * applications once and nothing else, because the owned objects are named in
 * the records.
 * @returns {Promise<ApplicationOwnership>} a promise that resolves to the ownership index
 */
export async function readApplicationOwnership({
  state,
}: {
  state: State;
}): Promise<ApplicationOwnership> {
  try {
    const applications = await readApplications({ state });
    return getApplicationOwnership(applications);
  } catch (error) {
    throw new FrodoError(
      `Error reading ownership of ${getCurrentRealmName(state) + ' realm'} applications`,
      error
    );
  }
}

/**
 * Validate an application: check that everything it refers to exists
 * @param {string} applicationId application uuid
 * @returns {Promise<ApplicationValidationFinding[]>} validation findings, empty if every reference resolves
 */
export async function validateApplication({
  applicationId,
  state,
}: {
  applicationId: string;
  state: State;
}): Promise<ApplicationValidationFinding[]> {
  try {
    const applicationData = await readApplication({ applicationId, state });
    return getApplicationFindings({
      applicationReferences: await resolveApplicationReferences({
        applicationData,
        state,
      }),
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error validating ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
      error
    );
  }
}

/**
 * Validate an application by name: check that everything it refers to exists
 * @param {string} applicationName application name
 * @returns {Promise<ApplicationValidationFinding[]>} validation findings, empty if every reference resolves
 */
export async function validateApplicationByName({
  applicationName,
  state,
}: {
  applicationName: string;
  state: State;
}): Promise<ApplicationValidationFinding[]> {
  try {
    const applicationData = await readApplicationByName({
      applicationName,
      state,
    });
    return getApplicationFindings({
      applicationReferences: await resolveApplicationReferences({
        applicationData,
        state,
      }),
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error validating ${getCurrentRealmName(state) + ' realm'} application ${applicationName}`,
      error
    );
  }
}

/**
 * Validate all applications of the realm: check that everything they refer to exists
 * @returns {Promise<ApplicationValidationFinding[]>} validation findings of all applications, empty if every reference resolves
 */
export async function validateApplications({
  state,
}: {
  state: State;
}): Promise<ApplicationValidationFinding[]> {
  try {
    const findings: ApplicationValidationFinding[] = [];
    for (const applicationData of await readApplications({ state })) {
      try {
        findings.push(
          ...getApplicationFindings({
            applicationReferences: await resolveApplicationReferences({
              applicationData,
              state,
            }),
            state,
          })
        );
      } catch (error) {
        // never lose the findings of the other applications
        findings.push({
          code: 'UNREADABLE_REFERENCE',
          severity: 'error',
          applicationId: applicationData._id,
          applicationName: applicationData.name,
          message: `${getCurrentRealmName(state) + ' realm'} application '${applicationData.name}': unable to validate: ${describeCause(error)}`,
        });
      }
    }
    return findings;
  } catch (error) {
    throw new FrodoError(
      `Error validating ${getCurrentRealmName(state) + ' realm'} applications`,
      error
    );
  }
}

/**
 * The status of an application. Only a provisioning application has one, and it is the state of its connector: `active` if the connector is enabled, `inactive` if it is disabled. `none` is every other application, and a provisioning application whose connector configuration does not exist.
 */
export type ApplicationStatus = 'active' | 'inactive' | 'none';

/**
 * The status of an application
 */
export type ApplicationStatusResult = {
  /** Application uuid. */
  applicationId: string;
  /** Application name. */
  applicationName: string;
  /** The connector of a provisioning application. Not set for the other applications. */
  connectorId?: string;
  /** The status of the application. */
  status: ApplicationStatus;
};

/**
 * The result of enabling or disabling an application
 */
export type ApplicationStatusChangeResult = ApplicationStatusResult & {
  /** False if the application was in the requested state already and nothing was written. */
  changed: boolean;
  /** Enabling only: whether the connector answered its connection test within the timeout. */
  ready?: boolean;
  /** Enabling only: the last answer of the connection test, if the connector did not answer within the timeout. */
  error?: string;
};

function getApplicationStatusResult(
  applicationData: ApplicationSkeleton,
  status: ApplicationStatus
): ApplicationStatusResult {
  return {
    applicationId: applicationData._id,
    applicationName: applicationData.name,
    ...(isProvisioningApplication(applicationData) && {
      connectorId: getConnectorId(applicationData),
    }),
    status,
  };
}

async function resolveApplicationStatus({
  applicationData,
  state,
}: {
  applicationData: ApplicationSkeleton;
  state: State;
}): Promise<ApplicationStatusResult> {
  if (!isProvisioningApplication(applicationData)) {
    return getApplicationStatusResult(applicationData, 'none');
  }
  try {
    const enabled = await isConnectorEnabled({
      connectorId: getConnectorId(applicationData),
      state,
    });
    return getApplicationStatusResult(
      applicationData,
      enabled ? 'active' : 'inactive'
    );
  } catch (error) {
    // the connector configuration the application names does not exist
    if (isNotFoundError(error)) {
      return getApplicationStatusResult(applicationData, 'none');
    }
    throw error;
  }
}

async function setApplicationStatus({
  applicationData,
  enabled,
  options,
  state,
}: {
  applicationData: ApplicationSkeleton;
  enabled: boolean;
  options?: ConnectorEnableOptions;
  state: State;
}): Promise<ApplicationStatusChangeResult> {
  if (!isProvisioningApplication(applicationData)) {
    throw new Error(
      `${getCurrentRealmName(state) + ' realm'} application '${applicationData.name}' has no connector, so it has no status to change`
    );
  }
  const connectorId = getConnectorId(applicationData);
  if (enabled) {
    const { changed, ready, error } = await enableConnector({
      connectorId,
      options,
      state,
    });
    return {
      ...getApplicationStatusResult(applicationData, 'active'),
      changed,
      ready,
      ...(error !== undefined && { error }),
    };
  }
  const { changed } = await disableConnector({ connectorId, state });
  return {
    ...getApplicationStatusResult(applicationData, 'inactive'),
    changed,
  };
}

/**
 * Read the status of an application. Only a provisioning application, one with a connector, has a status, and it is the state of its connector: `active` if the connector is enabled, `inactive` if it is disabled. Every other application, and one whose connector configuration does not exist, has status `none`.
 * @param {string} applicationId application uuid
 * @returns {Promise<ApplicationStatusResult>} a promise that resolves to the status of the application
 */
export async function readApplicationStatus({
  applicationId,
  state,
}: {
  applicationId: string;
  state: State;
}): Promise<ApplicationStatusResult> {
  try {
    return await resolveApplicationStatus({
      applicationData: await readApplication({ applicationId, state }),
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error reading the status of ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
      error
    );
  }
}

/**
 * Read the status of an application by name. See readApplicationStatus.
 * @param {string} applicationName application name
 * @returns {Promise<ApplicationStatusResult>} a promise that resolves to the status of the application
 */
export async function readApplicationStatusByName({
  applicationName,
  state,
}: {
  applicationName: string;
  state: State;
}): Promise<ApplicationStatusResult> {
  try {
    return await resolveApplicationStatus({
      applicationData: await readApplicationByName({ applicationName, state }),
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error reading the status of ${getCurrentRealmName(state) + ' realm'} application ${applicationName}`,
      error
    );
  }
}

/**
 * Read the status of every application of the realm: the applications are read once and the enabled state of all connectors in one more request. See readApplicationStatus.
 * @returns {Promise<ApplicationStatusResult[]>} a promise that resolves to the status of every application
 */
export async function readApplicationStatuses({
  state,
}: {
  state: State;
}): Promise<ApplicationStatusResult[]> {
  try {
    const applications = await readApplications({ state });
    const states = applications.some((application) =>
      isProvisioningApplication(application)
    )
      ? await readConnectorEnabledStates({ state })
      : {};
    return applications.map((application) => {
      const enabled = isProvisioningApplication(application)
        ? states[getConnectorId(application)]
        : undefined;
      return getApplicationStatusResult(
        application,
        enabled === undefined ? 'none' : enabled ? 'active' : 'inactive'
      );
    });
  } catch (error) {
    throw new FrodoError(
      `Error reading the status of ${getCurrentRealmName(state) + ' realm'} applications`,
      error
    );
  }
}

/**
 * Enable an application: enable its connector and wait until the connector answers its connection test (see ConnectorOps.enableConnector). An application without a connector has no status to change and is an error.
 * @param {string} applicationId application uuid
 * @param {ConnectorEnableOptions} options how long to wait for the connector to answer (milliseconds)
 * @returns {Promise<ApplicationStatusChangeResult>} a promise that resolves to the status of the application after the change
 */
export async function enableApplication({
  applicationId,
  options,
  state,
}: {
  applicationId: string;
  options?: ConnectorEnableOptions;
  state: State;
}): Promise<ApplicationStatusChangeResult> {
  try {
    return await setApplicationStatus({
      applicationData: await readApplication({ applicationId, state }),
      enabled: true,
      options,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error enabling ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
      error
    );
  }
}

/**
 * Enable an application by name. See enableApplication.
 * @param {string} applicationName application name
 * @param {ConnectorEnableOptions} options how long to wait for the connector to answer (milliseconds)
 * @returns {Promise<ApplicationStatusChangeResult>} a promise that resolves to the status of the application after the change
 */
export async function enableApplicationByName({
  applicationName,
  options,
  state,
}: {
  applicationName: string;
  options?: ConnectorEnableOptions;
  state: State;
}): Promise<ApplicationStatusChangeResult> {
  try {
    return await setApplicationStatus({
      applicationData: await readApplicationByName({ applicationName, state }),
      enabled: true,
      options,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error enabling ${getCurrentRealmName(state) + ' realm'} application ${applicationName}`,
      error
    );
  }
}

/**
 * Disable an application: disable its connector. An application without a connector has no status to change and is an error.
 * @param {string} applicationId application uuid
 * @returns {Promise<ApplicationStatusChangeResult>} a promise that resolves to the status of the application after the change
 */
export async function disableApplication({
  applicationId,
  state,
}: {
  applicationId: string;
  state: State;
}): Promise<ApplicationStatusChangeResult> {
  try {
    return await setApplicationStatus({
      applicationData: await readApplication({ applicationId, state }),
      enabled: false,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error disabling ${getCurrentRealmName(state) + ' realm'} application ${applicationId}`,
      error
    );
  }
}

/**
 * Disable an application by name. See disableApplication.
 * @param {string} applicationName application name
 * @returns {Promise<ApplicationStatusChangeResult>} a promise that resolves to the status of the application after the change
 */
export async function disableApplicationByName({
  applicationName,
  state,
}: {
  applicationName: string;
  state: State;
}): Promise<ApplicationStatusChangeResult> {
  try {
    return await setApplicationStatus({
      applicationData: await readApplicationByName({ applicationName, state }),
      enabled: false,
      state,
    });
  } catch (error) {
    throw new FrodoError(
      `Error disabling ${getCurrentRealmName(state) + ' realm'} application ${applicationName}`,
      error
    );
  }
}
