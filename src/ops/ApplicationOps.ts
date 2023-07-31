import {
  IdObjectSkeletonInterface,
  OAuth2ClientSkeleton,
  ScriptSkeleton,
} from '../api/ApiTypes';
import { State } from '../shared/State';
import { debugMessage } from '../utils/Console';
import { getMetadata } from '../utils/ExportImportUtils';
import { get, mergeDeep } from '../utils/JsonUtils';
import {
  createManagedObject,
  readManagedObject,
  readManagedObjects,
  updateManagedObject,
  deleteManagedObject,
  findManagedObjects,
} from './ManagedObjectOps';
import { exportOAuth2Client } from './OAuth2ClientOps';
import { ExportMetaData } from './OpsTypes';
import { exportSaml2Provider } from './Saml2Ops';
import constants from '../shared/Constants';
import { decode } from '../utils/Base64Utils';
import { exportCirclesOfTrust } from './CirclesOfTrustOps';

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
   * @param {ApplicationSkeleton} moData application data
   * @returns {Promise<ApplicationSkeleton>} a promise that resolves to an application object
   */
  createApplication(
    applicationId: string,
    moData: ApplicationSkeleton
  ): Promise<ApplicationSkeleton>;
  /**
   * Read application
   * @param {string} applicationId application uuid
   * @returns {Promise<ApplicationSkeleton>} a promise that resolves to an application object
   */
  readApplication(applicationId: string): Promise<ApplicationSkeleton>;
  /**
   * Read all applications. Results are sorted aphabetically.
   * @returns {Promise<ApplicationSkeleton[]>} a promise that resolves to an array of application objects
   */
  readApplications(): Promise<ApplicationSkeleton[]>;
  /**
   * Update application
   * @param {string} applicationId application uuid
   * @param {ApplicationSkeleton} moData application data
   * @returns {Promise<ApplicationSkeleton>} a promise that resolves to an application object
   */
  updateApplication(
    applicationId: string,
    moData: IdObjectSkeletonInterface
  ): Promise<ApplicationSkeleton>;
  /**
   * Delete application
   * @param applicationId application uuid
   * @returns {Promise<ApplicationSkeleton>} a promise that resolves to an application object
   */
  deleteApplication(applicationId: string): Promise<ApplicationSkeleton>;
  /**
   * Delete all applications
   * @returns {Promise<ApplicationSkeleton[]>} a promise that resolves to an array of application objects
   */
  deleteApplications(): Promise<ApplicationSkeleton[]>;
  /**
   * Find applications
   * @param filter CREST search filter
   * @param fields array of fields to return
   */
  findApplications(
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
  // /**
  //  * Export all applications. The response can be saved to file as is.
  //  * @returns {Promise<ApplicationExportInterface>} Promise resolving to an ApplicationExportInterface object.
  //  */
  // exportApplications(): Promise<ApplicationExportInterface>;
  // /**
  //  * Import application. The import data is usually read from an application export file.
  //  * @param {string} applicationId application id/name
  //  * @param {ApplicationExportInterface} importData application import data.
  //  * @returns {Promise} Promise resolving to an application object.
  //  */
  // importApplication(
  //   applicationId: string,
  //   importData: ApplicationExportInterface
  // ): Promise<any>;
  // /**
  //  * Import applications. The import data is usually read from an application export file.
  //  * @param {ApplicationExportInterface} importData application import data.
  //  */
  // importApplications(importData: ApplicationExportInterface): Promise<void>;
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
      moData: IdObjectSkeletonInterface
    ): Promise<ApplicationSkeleton> {
      return createApplication({ applicationId, moData, state });
    },
    async readApplication(
      applicationId: string,
      fields = defaultFields
    ): Promise<ApplicationSkeleton> {
      return readApplication({ applicationId, fields, state });
    },
    async readApplications(): Promise<ApplicationSkeleton[]> {
      return readApplications({ state });
    },
    async updateApplication(
      applicationId: string,
      moData: IdObjectSkeletonInterface
    ): Promise<ApplicationSkeleton> {
      return updateApplication({ applicationId, moData, state });
    },
    async deleteApplication(
      applicationId: string
    ): Promise<ApplicationSkeleton> {
      return deleteApplication({ applicationId, state });
    },
    async deleteApplications(): Promise<ApplicationSkeleton[]> {
      return deleteApplications({ state });
    },
    async findApplications(
      filter: string,
      fields: string[] = defaultFields
    ): Promise<ApplicationSkeleton[]> {
      return findApplications({ filter, fields, state });
    },
    async exportApplication(
      applicationId: string,
      options: ApplicationExportOptions
    ): Promise<ApplicationExportInterface> {
      return exportApplication({ applicationId, options, state });
    },
    // async exportApplication(
    //   applicationId: string
    // ): Promise<ApplicationExportInterface> {},
    // async importApplications(
    //   importData: ApplicationExportInterface
    // ): Promise<void> {},
    // async importApplication(
    //   applicationId: string,
    //   importData: ApplicationExportInterface
    // ): Promise<any> {},
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

export interface ApplicationExportInterface {
  meta?: ExportMetaData;
  application: Record<string, ApplicationSkeleton>;
  script: Record<string, ScriptSkeleton>;
  oauth2client: Record<string, OAuth2ClientSkeleton>;
}

/**
 * Application export options
 */
export type ApplicationExportOptions = {
  /**
   * Include any dependencies (scripts).
   */
  deps: boolean;
  /**
   * Use string arrays to store multi-line text in scripts.
   */
  useStringArrays: boolean;
};

export function createApplicationExportTemplate({
  state,
}: {
  state: State;
}): ApplicationExportInterface {
  return {
    meta: getMetadata({ state }),
    application: {},
    oauth2client: {},
  } as ApplicationExportInterface;
}

export function getRealmManagedApplication({ state }: { state: State }) {
  let realmManagedOrg = 'application';
  if (state.getDeploymentType() === constants.CLOUD_DEPLOYMENT_TYPE_KEY) {
    realmManagedOrg = `${state.getRealm()}_application`;
  }
  return realmManagedOrg;
}

export async function createApplication({
  applicationId,
  moData,
  state,
}: {
  applicationId: string;
  moData: IdObjectSkeletonInterface;
  state: State;
}): Promise<ApplicationSkeleton> {
  const application = await createManagedObject({
    type: getRealmManagedApplication({ state }),
    id: applicationId,
    moData,
    state,
  });
  return application as ApplicationSkeleton;
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
  const application = await readManagedObject({
    type: getRealmManagedApplication({ state }),
    id: applicationId,
    fields,
    state,
  });
  return application as ApplicationSkeleton;
}

export async function readApplications({
  fields = defaultFields,
  state,
}: {
  fields?: string[];
  state: State;
}): Promise<ApplicationSkeleton[]> {
  const applications = await readManagedObjects({
    type: getRealmManagedApplication({ state }),
    fields,
    state,
  });
  return applications as ApplicationSkeleton[];
}

export async function updateApplication({
  applicationId,
  moData,
  state,
}: {
  applicationId: string;
  moData: IdObjectSkeletonInterface;
  state: State;
}): Promise<ApplicationSkeleton> {
  const application = await updateManagedObject({
    type: getRealmManagedApplication({ state }),
    id: applicationId,
    moData,
    state,
  });
  return application as ApplicationSkeleton;
}

export async function deleteApplication({
  applicationId,
  state,
}: {
  applicationId: string;
  state: State;
}): Promise<ApplicationSkeleton> {
  const application = await deleteManagedObject({
    type: getRealmManagedApplication({ state }),
    id: applicationId,
    state,
  });
  return application as ApplicationSkeleton;
}

export async function deleteApplications({
  state,
}: {
  state: State;
}): Promise<ApplicationSkeleton[]> {
  debugMessage({ message: `ApplicationOps.deleteApplications: start`, state });
  const applications = await readApplications({
    state,
  });
  const deleted: ApplicationSkeleton[] = [];
  const errors = [];
  for (const application of applications) {
    debugMessage({
      message: `ApplicationOps.deleteApplications: '${application['_id']}'`,
      state,
    });
    try {
      deleted.push(
        await deleteApplication({
          applicationId: application['_id'],
          state,
        })
      );
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) {
    const errorMessages = errors.map((error) => error.message).join('\n');
    throw new Error(`Error deleting applications:\n${errorMessages}`);
  }
  debugMessage({ message: `ApplicationOps.deleteApplications: end`, state });
  return deleted;
}

export async function findApplications({
  filter,
  fields = defaultFields,
  state,
}: {
  filter: string;
  fields?: string[];
  state: State;
}): Promise<ApplicationSkeleton[]> {
  const application = await findManagedObjects({
    type: getRealmManagedApplication({ state }),
    filter,
    fields,
    state,
  });
  return application as ApplicationSkeleton[];
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

async function exportApplicationDependencies({
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
  debugMessage({
    message: `ApplicationOps.exportApplicationDependencies: start [application=${applicationData['name']}]`,
    state,
  });
  // oauth2clients
  if (isOidcApplication(applicationData)) {
    const clientId = getOAuth2ClientId(applicationData);
    const clientData = await exportOAuth2Client({
      clientId,
      options: { deps: options.deps, useStringArrays: options.useStringArrays },
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
      state,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    exportData = mergeDeep(exportData, cotData);
  }
  debugMessage({
    message: `ApplicationOps.exportApplicationDependencies: end`,
    state,
  });
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
  debugMessage({ message: `ApplicationOps.exportApplication: start`, state });
  const applicationData = await readApplication({ applicationId, state });
  const exportData = createApplicationExportTemplate({ state });
  exportData.application[applicationData._id] = applicationData;
  if (options.deps) {
    await exportApplicationDependencies({
      applicationData: applicationData,
      options,
      exportData,
      state,
    });
  }
  debugMessage({ message: `ApplicationOps.exportApplication: end`, state });
  return exportData;
}

// export async function exportApplications(): Promise<ApplicationExportInterface>;
// export async function importApplications(
//   importData: ApplicationExportInterface
// ): Promise<void>;
// export async function importApplication(
//   applicationId: string,
//   importData: ApplicationExportInterface
// ): Promise<any>;
