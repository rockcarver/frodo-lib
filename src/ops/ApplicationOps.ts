import { type IdObjectSkeletonInterface } from '../api/ApiTypes';
import { CircleOfTrustSkeleton } from '../api/CirclesOfTrustApi';
import { type OAuth2ClientSkeleton } from '../api/OAuth2ClientApi';
import { Saml2ProviderSkeleton } from '../api/Saml2Api';
import { type ScriptSkeleton } from '../api/ScriptApi';
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
import { get, mergeDeep } from '../utils/JsonUtils';
import {
  CirclesOfTrustExportInterface,
  exportCirclesOfTrust,
  importCirclesOfTrust,
  readCirclesOfTrust,
  updateCircleOfTrust,
} from './CirclesOfTrustOps';
import {
  ConnectorExportInterface,
  ConnectorSkeleton,
  exportConnector,
  importConnector,
} from './ConnectorOps';
import { FrodoError } from './FrodoError';
import {
  createManagedObject,
  deleteManagedObject,
  queryManagedObjects,
  readManagedObject,
  readManagedObjects,
  updateManagedObject,
} from './ManagedObjectOps';
import { MappingSkeleton } from './MappingOps';
import {
  deleteOAuth2Client,
  exportOAuth2Client,
  importOAuth2Client,
  OAuth2ClientExportInterface,
} from './OAuth2ClientOps';
import { type ExportMetaData } from './OpsTypes';
import {
  deleteSaml2Provider,
  exportSaml2Provider,
  importSaml2Provider,
  Saml2ExportInterface,
} from './Saml2Ops';

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
   * @param {ApplicationSkeleton} applicationData application data
   * @returns {Promise<ApplicationSkeleton>} a promise that resolves to an application object
   */
  createApplication(
    applicationId: string,
    applicationData: ApplicationSkeleton
  ): Promise<ApplicationSkeleton>;
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
   * @returns {Promise<ApplicationSkeleton>} a promise that resolves to an application object
   */
  deleteApplication(
    applicationId: string,
    deep?: boolean
  ): Promise<ApplicationSkeleton>;
  /**
   * Delete application by name
   * @param {string} applicationName application name
   * @param {boolean} deep deep delete (remove dependencies)
   * @returns {Promise<ApplicationSkeleton>} a promise that resolves to an application object
   */
  deleteApplicationByName(
    applicationName: string,
    deep?: boolean
  ): Promise<ApplicationSkeleton>;
  /**
   * Delete all applications
   * @param {boolean} deep deep delete (remove dependencies)
   * @returns {Promise<ApplicationSkeleton[]>} a promise that resolves to an array of application objects
   */
  deleteApplications(deep?: boolean): Promise<ApplicationSkeleton[]>;
  /**
   * Query applications
   * @param filter CREST search filter
   * @param fields array of fields to return
   */
  queryApplications(
    filter: string,
    fields?: string[]
  ): Promise<ApplicationSkeleton[]>;
  /**
   * Export application. The response can be saved to file as is.
   * @param {string} applicationId application uuid
   * @param {ApplicationExportOptions} options export options
   * @returns {Promise<ApplicationExportInterface} Promise resolving to an ApplicationExportInterface object.
   */
  exportApplication(
    applicationId: string,
    options: ApplicationExportOptions
  ): Promise<ApplicationExportInterface>;
  /**
   * Export application by name. The response can be saved to file as is.
   * @param {string} applicationName application name
   * @param {ApplicationExportOptions} options export options
   * @returns {Promise<ApplicationExportInterface} Promise resolving to an ApplicationExportInterface object.
   */
  exportApplicationByName(
    applicationName: string,
    options: ApplicationExportOptions
  ): Promise<ApplicationExportInterface>;
  /**
   * Export all applications. The response can be saved to file as is.
   * @returns {Promise<ApplicationExportInterface>} Promise resolving to an ApplicationExportInterface object.
   */
  exportApplications(
    options?: ApplicationExportOptions
  ): Promise<ApplicationExportInterface>;
  /**
   * Import application. The import data is usually read from an application export file.
   * @param {string} applicationId application uuid
   * @param {ApplicationExportInterface} importData application import data.
   * @returns {Promise<ApplicationSkeleton>} Promise resolving to an application object.
   */
  importApplication(
    applicationId: string,
    importData: ApplicationExportInterface,
    options: ApplicationImportOptions
  ): Promise<ApplicationSkeleton>;
  /**
   * Import application by name. The import data is usually read from an application export file.
   * @param {string} applicationName application name
   * @param {ApplicationExportInterface} importData application import data.
   * @returns {Promise<ApplicationSkeleton>} Promise resolving to an application object.
   */
  importApplicationByName(
    applicationName: string,
    importData: ApplicationExportInterface,
    options: ApplicationImportOptions
  ): Promise<ApplicationSkeleton>;
  /**
   * Import first application. The import data is usually read from an application export file.
   * @param {ApplicationExportInterface} importData application import data.
   */
  importFirstApplication(
    importData: ApplicationExportInterface,
    options: ApplicationImportOptions
  ): Promise<ApplicationSkeleton[]>;
  /**
   * Import applications. The import data is usually read from an application export file.
   * @param {ApplicationExportInterface} importData application import data.
   */
  importApplications(
    importData: ApplicationExportInterface,
    options: ApplicationImportOptions
  ): Promise<ApplicationSkeleton[]>;
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
      applicationData: ApplicationSkeleton
    ): Promise<ApplicationSkeleton> {
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
    ): Promise<ApplicationSkeleton> {
      return deleteApplication({ applicationId, options: { deep }, state });
    },
    async deleteApplicationByName(
      applicationName: string,
      deep = true
    ): Promise<ApplicationSkeleton> {
      return deleteApplicationByName({
        applicationName,
        options: { deep },
        state,
      });
    },
    async deleteApplications(deep = true): Promise<ApplicationSkeleton[]> {
      return deleteApplications({ options: { deep }, state });
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
      options: ApplicationExportOptions = { deps: true, useStringArrays: true }
    ): Promise<ApplicationExportInterface> {
      return exportApplications({ options, state });
    },
    async importApplication(
      applicationId: string,
      importData: ApplicationExportInterface,
      options: ApplicationImportOptions
    ): Promise<ApplicationSkeleton> {
      return importApplication({ applicationId, importData, options, state });
    },
    async importApplicationByName(
      applicationName: string,
      importData: ApplicationExportInterface,
      options: ApplicationImportOptions
    ): Promise<ApplicationSkeleton> {
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
    ): Promise<ApplicationSkeleton[]> {
      return importApplications({ importData, options, state });
    },
    async importApplications(
      importData: ApplicationExportInterface,
      options: ApplicationImportOptions
    ): Promise<ApplicationSkeleton[]> {
      return importApplications({ importData, options, state });
    },
  };
};

export type ApplicationSkeleton = IdObjectSkeletonInterface & {
  authoritative: boolean;
  connectorId: string;
  description: string;
  icon: string;
  mappingNames: string[];
  members;
  name: string;
  owners;
  roles;
  ssoEntities: {
    idpLocation: string;
    idpPrivateId: string;
    spLocation: string;
    spPrivate: string;
  };
  templateName: string;
  templateVersion: string;
  uiConfig: object;
  url: string;
};

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
  managedApplication: Record<string, ApplicationSkeleton>;
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
}

/**
 * Application export options
 */
export type ApplicationExportOptions = {
  /**
   * Include any dependencies (scripts, oauth2 clients, saml providers, circles of trust, etc).
   */
  deps: boolean;
  /**
   * Use string arrays to store multi-line text in scripts.
   */
  useStringArrays: boolean;
};

/**
 * Application export options
 */
export type ApplicationImportOptions = {
  /**
   * Import any dependencies (scripts).
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
    application: {},
  } as ApplicationExportInterface;
}

export function getRealmManagedApplication({ state }: { state: State }) {
  let realmManagedApp = 'application';
  if (
    state.getDeploymentType() === constants.CLOUD_DEPLOYMENT_TYPE_KEY ||
    state.getUseRealmPrefixOnManagedObjects() === true
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
  applicationData: ApplicationSkeleton;
  state: State;
}): Promise<ApplicationSkeleton> {
  try {
    const application = await createManagedObject({
      type: getRealmManagedApplication({ state }),
      id: applicationId,
      moData: applicationData,
      state,
    });
    return application as ApplicationSkeleton;
  } catch (error) {
    throw new FrodoError(`Error creating application ${applicationId}`, error);
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
    throw new FrodoError(`Error reading application ${applicationId}`, error);
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
        throw new Error(`Application '${applicationName}' not found`);
      default:
        throw new Error(
          `${applications.length} applications '${applicationName}' found`
        );
    }
  } catch (error) {
    throw new FrodoError(`Error reading application ${applicationName}`, error);
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
    const applications = await readManagedObjects({
      type: getRealmManagedApplication({ state }),
      fields,
      state,
    });
    return applications as ApplicationSkeleton[];
  } catch (error) {
    throw new FrodoError(`Error reading applications`, error);
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
    throw new FrodoError(`Error updating application ${applicationId}`, error);
  }
}

function isOidcApplication(applicationData: ApplicationSkeleton): boolean {
  return get(applicationData, ['ssoEntities', 'oidcId']) ? true : false;
}

function getOAuth2ClientId(applicationData): string {
  return get(applicationData, ['ssoEntities', 'oidcId']);
}

function isSaml2Application(applicationData: ApplicationSkeleton): boolean {
  return get(applicationData, ['ssoEntities', 'idpPrivateId']) ? true : false;
}

function getSaml2IdpEntityId(applicationData: ApplicationSkeleton): string {
  return decode(get(applicationData, ['ssoEntities', 'idpPrivateId']));
}

function getSaml2SpEntityId(applicationData: ApplicationSkeleton): string {
  return decode(get(applicationData, ['ssoEntities', 'spPrivateId']));
}

function isProvisioningApplication(
  applicationData: ApplicationSkeleton
): boolean {
  return get(applicationData, ['connectorId']) ? true : false;
}

function getConnectorId(applicationData: ApplicationSkeleton): string {
  return get(applicationData, ['connectorId']);
}

async function exportDependencies({
  applicationData,
  options,
  exportData,
  state,
}: {
  applicationData: ApplicationSkeleton;
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        exportData = mergeDeep(exportData, saml2IdpData);
      }
      // saml SPs
      const saml2SpId = getSaml2SpEntityId(applicationData);
      if (saml2SpId) {
        const saml2SpData = await exportSaml2Provider({
          entityId: saml2SpId,
          state,
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        exportData = mergeDeep(exportData, saml2SpData);
      }
      // circles of trust
      const cotData = await exportCirclesOfTrust({
        entityProviders: [saml2IdpId, saml2SpId],
        options: { indicateProgress: false },
        state,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        exportData = mergeDeep(exportData, connectorData);
      }
    }
    debugMessage({
      message: `ApplicationOps.exportDependencies: end`,
      state,
    });
  } catch (error) {
    throw new FrodoError(`Error exporting dependencies`, error);
  }
}

async function importDependencies({
  applicationData,
  importData,
  state,
}: {
  applicationData: ApplicationSkeleton;
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
    if (errors.length) {
      throw new FrodoError(`Error importing dependencies`, errors);
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
    throw new FrodoError(`Error importing dependencies`, error);
  }
}

async function deleteDependencies({
  applicationData,
  state,
}: {
  applicationData: ApplicationSkeleton;
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
    if (errors.length > 0) {
      throw new FrodoError(`Error deleting dependencies`, errors);
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
    throw new FrodoError(`Error deleting dependencies`, error);
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
}): Promise<ApplicationSkeleton> {
  try {
    debugMessage({ message: `ApplicationOps.deleteApplication: start`, state });
    const { deep } = options;
    const applicationData: ApplicationSkeleton = (await deleteManagedObject({
      type: getRealmManagedApplication({ state }),
      id: applicationId,
      state,
    })) as ApplicationSkeleton;
    if (deep) {
      await deleteDependencies({ applicationData, state });
    }
    debugMessage({ message: `ApplicationOps.deleteApplication: end`, state });
    return applicationData as ApplicationSkeleton;
  } catch (error) {
    throw new FrodoError(`Error deleting application ${applicationId}`, error);
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
}): Promise<ApplicationSkeleton> {
  let applications: ApplicationSkeleton[] = [];
  try {
    applications = await queryApplications({
      filter: `name eq '${applicationName}'`,
      fields: ['_id'],
      state,
    });
    if (applications.length == 1) {
      return deleteApplication({
        applicationId: applications[0]._id,
        options,
        state,
      });
    }
  } catch (error) {
    throw new FrodoError(
      `Error deleting application ${applicationName}`,
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
}): Promise<ApplicationSkeleton[]> {
  const errors: Error[] = [];
  try {
    debugMessage({
      message: `ApplicationOps.deleteApplications: start`,
      state,
    });
    const applications = await readApplications({
      state,
    });
    const deleted: ApplicationSkeleton[] = [];
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
      throw new FrodoError(`Error deleting applications`, errors);
    }
    debugMessage({ message: `ApplicationOps.deleteApplications: end`, state });
    return deleted;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error deleting applications`, error);
  }
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
      `Error querying applications with filter ${filter}`,
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
    const applicationData = await readApplication({ applicationId, state });
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
    throw new FrodoError(`Error exporting application ${applicationId}`, error);
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
    const applicationData = await readApplicationByName({
      applicationName,
      state,
    });
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
      `Error exporting application ${applicationName}`,
      error
    );
  }
}

export async function exportApplications({
  options,
  state,
}: {
  options: ApplicationExportOptions;
  state: State;
}): Promise<ApplicationExportInterface> {
  const errors: Error[] = [];
  let indicatorId: string;
  try {
    debugMessage({ message: `ApplicationOps.exportApplication: start`, state });
    const exportData = createApplicationExportTemplate({ state });
    const applications = await readApplications({ state });
    indicatorId = createProgressIndicator({
      total: applications.length,
      message: 'Exporting applications...',
      state,
    });
    for (const applicationData of applications) {
      updateProgressIndicator({
        id: indicatorId,
        message: `Exporting application ${applicationData.name}`,
        state,
      });
      exportData.managedApplication[applicationData._id] = applicationData;
      if (options.deps) {
        try {
          await exportDependencies({
            applicationData: applicationData,
            options,
            exportData,
            state,
          });
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length > 0) {
      stopProgressIndicator({
        id: indicatorId,
        message: `Error exporting applications`,
        status: 'fail',
        state,
      });
      throw new FrodoError(`Error exporting applications`, errors);
    }
    stopProgressIndicator({
      id: indicatorId,
      message: `Exported ${applications.length} applications`,
      state,
    });
    debugMessage({ message: `ApplicationOps.exportApplication: end`, state });
    return exportData;
  } catch (error) {
    stopProgressIndicator({
      id: indicatorId,
      message: `Error exporting applications`,
      status: 'fail',
      state,
    });
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error exporting applications`, error);
  }
}

/**
 * Import application
 * @param {string} clientId client id
 * @param {ApplicationExportInterface} importData import data
 * @param {ApplicationImportOptions} options import options
 * @returns {Promise<ApplicationSkeleton>} a promise resolving to an oauth2 client
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
}): Promise<ApplicationSkeleton> {
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
          response = await updateApplication({
            applicationId,
            applicationData,
            state,
          });
          imported.push(id);
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing application ${applicationId}`,
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
    throw new FrodoError(`Error importing application ${applicationId}`, error);
  }
}

/**
 * Import application
 * @param {string} clientId client id
 * @param {ApplicationExportInterface} importData import data
 * @param {ApplicationImportOptions} options import options
 * @returns {Promise<ApplicationSkeleton>} a promise resolving to an oauth2 client
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
}): Promise<ApplicationSkeleton> {
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
          response = await updateApplication({
            applicationId,
            applicationData,
            state,
          });
          imported.push(applicationId);
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length > 0) {
      throw new FrodoError(
        `Error importing application ${applicationName}`,
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
      `Error importing application ${applicationName}`,
      error
    );
  }
}

/**
 * Import first application
 * @param {ApplicationExportInterface} importData import data
 * @param {ApplicationImportOptions} options import options
 * @returns {Promise<ApplicationSkeleton[]>} a promise resolving to an array of oauth2 clients
 */
export async function importFirstApplication({
  importData,
  options = { deps: true },
  state,
}: {
  importData: ApplicationExportInterface;
  options?: ApplicationImportOptions;
  state: State;
}): Promise<ApplicationSkeleton> {
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
        response = await updateApplication({
          applicationId,
          applicationData,
          state,
        });
        imported.push(applicationId);
      } catch (error) {
        errors.push(error);
      }
      break;
    }
    if (errors.length > 0) {
      throw new FrodoError(`Error importing first application`, errors);
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
    throw new FrodoError(`Error importing first application`, error);
  }
}

/**
 * Import applications
 * @param {ApplicationExportInterface} importData import data
 * @param {ApplicationImportOptions} options import options
 * @returns {Promise<ApplicationSkeleton[]>} a promise resolving to an array of oauth2 clients
 */
export async function importApplications({
  importData,
  options = { deps: true },
  state,
}: {
  importData: ApplicationExportInterface;
  options?: ApplicationImportOptions;
  state: State;
}): Promise<ApplicationSkeleton[]> {
  const response = [];
  const errors = [];
  try {
    for (const applicationId of Object.keys(importData.managedApplication)) {
      const applicationData = importData.managedApplication[applicationId];
      delete applicationData._provider;
      delete applicationData._rev;
      if (options.deps) {
        try {
          await importDependencies({ applicationData, importData, state });
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        response.push(
          await updateApplication({
            applicationId,
            applicationData,
            state,
          })
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) {
      throw new FrodoError(`Error importing applications`, errors);
    }
    return response;
  } catch (error) {
    // just re-throw previously caught errors
    if (errors.length > 0) {
      throw error;
    }
    throw new FrodoError(`Error importing applications`, error);
  }
}
