import { AgentSkeleton } from '../api/AgentApi';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import { AuthenticationSettingsSkeleton } from '../api/AuthenticationSettingsApi';
import { CircleOfTrustSkeleton } from '../api/CirclesOfTrustApi';
import { SecretSkeleton } from '../api/cloud/SecretsApi';
import { VariableSkeleton } from '../api/cloud/VariablesApi';
import { OAuth2ClientSkeleton } from '../api/OAuth2ClientApi';
import { PolicySkeleton } from '../api/PoliciesApi';
import { PolicySetSkeleton } from '../api/PolicySetApi';
import { ResourceTypeSkeleton } from '../api/ResourceTypesApi';
import { Saml2ProviderSkeleton } from '../api/Saml2Api';
import { ScriptSkeleton } from '../api/ScriptApi';
import { AmServiceSkeleton } from '../api/ServiceApi';
import { SocialIdpSkeleton } from '../api/SocialIdentityProvidersApi';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  stopProgressIndicator,
  updateProgressIndicator,
} from '../utils/Console';
import {
  exportOrImportWithErrorHandling,
  getMetadata,
} from '../utils/ExportImportUtils';
import { exportAgents, importAgents } from './AgentOps';
import {
  ApplicationSkeleton,
  exportApplications,
  importApplications,
} from './ApplicationOps';
import {
  exportAuthenticationSettings,
  importAuthenticationSettings,
} from './AuthenticationSettingsOps';
import {
  CirclesOfTrustExportInterface,
  exportCirclesOfTrust,
  importCirclesOfTrust,
} from './CirclesOfTrustOps';
import { exportSecrets } from './cloud/SecretsOps';
import { exportVariables } from './cloud/VariablesOps';
import {
  EmailTemplateSkeleton,
  exportEmailTemplates,
  importEmailTemplates,
} from './EmailTemplateOps';
import { exportConfigEntities, importConfigEntities } from './IdmConfigOps';
import {
  exportSocialIdentityProviders,
  importSocialIdentityProviders,
} from './IdpOps';
import {
  exportJourneys,
  importJourneys,
  SingleTreeExportInterface,
} from './JourneyOps';
import { exportOAuth2Clients, importOAuth2Clients } from './OAuth2ClientOps';
import { ExportMetaData } from './OpsTypes';
import { exportPolicies, importPolicies } from './PolicyOps';
import { exportPolicySets, importPolicySets } from './PolicySetOps';
import { exportResourceTypes, importResourceTypes } from './ResourceTypeOps';
import { exportSaml2Providers, importSaml2Providers } from './Saml2Ops';
import { exportScripts, importScripts } from './ScriptOps';
import { exportServices, importServices } from './ServiceOps';
import { exportThemes, importThemes, ThemeSkeleton } from './ThemeOps';

export type Config = {
  /**
   * Export full configuration
   * @param {FullExportOptions} options export options
   * @returns {Promise<IdObjectSkeletonInterface>} a promise resolving to a full export object
   */
  exportFullConfiguration(
    options: FullExportOptions
  ): Promise<FullExportInterface>;
  /**
   * Import full configuration
   * @param {FullExportInterface} importData import data
   * @param {FullImportOptions} options import options
   */
  importFullConfiguration(
    importData: FullExportInterface,
    options: FullImportOptions
  ): Promise<void>;
};

export default (state: State): Config => {
  return {
    async exportFullConfiguration(
      options: FullExportOptions = {
        useStringArrays: true,
        noDecode: false,
        coords: true,
      }
    ) {
      return exportFullConfiguration({ options, state });
    },
    async importFullConfiguration(
      importData: FullExportInterface,
      options: FullImportOptions = {
        reUuidJourneys: false,
        reUuidScripts: false,
        cleanServices: false,
        global: false,
        realm: false,
      }
    ) {
      return importFullConfiguration({
        importData,
        options,
        state,
      });
    },
  };
};

/**
 * Full export options
 */
export interface FullExportOptions {
  /**
   * Use string arrays to store multi-line text in scripts.
   */
  useStringArrays: boolean;
  /**
   * Do not include decoded variable value in export
   */
  noDecode: boolean;
  /**
   * Include x and y coordinate positions of the journey/tree nodes.
   */
  coords: boolean;
}

/**
 * Full import options
 */
export interface FullImportOptions {
  /**
   * Generate new UUIDs for all journey nodes during import.
   */
  reUuidJourneys: boolean;
  /**
   * Generate new UUIDs for all scripts during import.
   */
  reUuidScripts: boolean;
  /**
   * Indicates whether to remove previously existing services of the same id before importing
   */
  cleanServices: boolean;
  /**
   * Indicates whether to import service(s) as global services
   */
  global: boolean;
  /**
   * Indicates whether to import service(s) to the current realm
   */
  realm: boolean;
}

export interface FullExportInterface {
  meta?: ExportMetaData;
  agents: Record<string, AgentSkeleton> | undefined;
  application: Record<string, OAuth2ClientSkeleton> | undefined;
  authentication: AuthenticationSettingsSkeleton | undefined;
  config: Record<string, IdObjectSkeletonInterface> | undefined;
  emailTemplate: Record<string, EmailTemplateSkeleton> | undefined;
  idp: Record<string, SocialIdpSkeleton> | undefined;
  managedApplication: Record<string, ApplicationSkeleton> | undefined;
  policy: Record<string, PolicySkeleton> | undefined;
  policyset: Record<string, PolicySetSkeleton> | undefined;
  resourcetype: Record<string, ResourceTypeSkeleton> | undefined;
  saml:
    | {
        hosted: Record<string, Saml2ProviderSkeleton>;
        remote: Record<string, Saml2ProviderSkeleton>;
        metadata: Record<string, string[]>;
        cot: Record<string, CircleOfTrustSkeleton> | undefined;
      }
    | undefined;
  script: Record<string, ScriptSkeleton> | undefined;
  secrets: Record<string, SecretSkeleton> | undefined;
  service: Record<string, AmServiceSkeleton> | undefined;
  theme: Record<string, ThemeSkeleton> | undefined;
  trees: Record<string, SingleTreeExportInterface> | undefined;
  variables: Record<string, VariableSkeleton> | undefined;
}

/**
 * Export full configuration
 * @param {FullExportOptions} options export options
 */
export async function exportFullConfiguration({
  options = { useStringArrays: true, noDecode: false, coords: true },
  state,
}: {
  options: FullExportOptions;
  state: State;
}): Promise<FullExportInterface> {
  const { useStringArrays, noDecode, coords } = options;
  const stateObj = { state };
  //Export saml2 providers and circle of trusts
  let saml = (
    (await exportOrImportWithErrorHandling(
      exportSaml2Providers,
      stateObj
    )) as CirclesOfTrustExportInterface
  )?.saml;
  const cotExport = await exportOrImportWithErrorHandling(
    exportCirclesOfTrust,
    stateObj
  );
  if (saml) {
    saml.cot = cotExport?.saml.cot;
  } else {
    saml = cotExport?.saml;
  }
  //Create full export
  return {
    meta: getMetadata(stateObj),
    agents: (await exportOrImportWithErrorHandling(exportAgents, stateObj))
      ?.agents,
    application: (
      await exportOrImportWithErrorHandling(exportOAuth2Clients, {
        options: { deps: false, useStringArrays },
        state,
      })
    )?.application,
    authentication: (
      await exportOrImportWithErrorHandling(
        exportAuthenticationSettings,
        stateObj
      )
    )?.authentication,
    config: (
      await exportOrImportWithErrorHandling(exportConfigEntities, stateObj)
    )?.config,
    emailTemplate: (
      await exportOrImportWithErrorHandling(exportEmailTemplates, stateObj)
    )?.emailTemplate,
    idp: (
      await exportOrImportWithErrorHandling(
        exportSocialIdentityProviders,
        stateObj
      )
    )?.idp,
    managedApplication: (
      await exportOrImportWithErrorHandling(exportApplications, {
        options: { deps: false, useStringArrays },
        state,
      })
    )?.managedApplication,
    policy: (
      await exportOrImportWithErrorHandling(exportPolicies, {
        options: { deps: false, prereqs: false, useStringArrays },
        state,
      })
    )?.policy,
    policyset: (
      await exportOrImportWithErrorHandling(exportPolicySets, {
        options: { deps: false, prereqs: false, useStringArrays },
        state,
      })
    )?.policyset,
    resourcetype: (
      await exportOrImportWithErrorHandling(exportResourceTypes, stateObj)
    )?.resourcetype,
    saml,
    script: (await exportOrImportWithErrorHandling(exportScripts, stateObj))
      ?.script,
    secrets: (await exportOrImportWithErrorHandling(exportSecrets, stateObj))
      ?.secrets,
    service: {
      ...(
        await exportOrImportWithErrorHandling(exportServices, {
          globalConfig: true,
          state,
        })
      )?.service,
      ...(
        await exportOrImportWithErrorHandling(exportServices, {
          globalConfig: false,
          state,
        })
      )?.service,
    },
    theme: (await exportOrImportWithErrorHandling(exportThemes, stateObj))
      ?.theme,
    trees: (
      await exportOrImportWithErrorHandling(exportJourneys, {
        options: { deps: false, useStringArrays, coords },
        state,
      })
    )?.trees,
    variables: (
      await exportOrImportWithErrorHandling(exportVariables, {
        noDecode,
        state,
      })
    )?.variables,
  };
}

/**
 * Import full configuration
 * @param {FullExportInterface} importData import data
 * @param {FullImportOptions} options import options
 */
export async function importFullConfiguration({
  importData,
  options = {
    reUuidJourneys: false,
    reUuidScripts: false,
    cleanServices: false,
    global: false,
    realm: false,
  },
  state,
}: {
  importData: FullExportInterface;
  options: FullImportOptions;
  state: State;
}): Promise<void> {
  const { reUuidJourneys, reUuidScripts, cleanServices, global, realm } =
    options;
  const indicatorId = createProgressIndicator({
    total: 16,
    message: 'Importing everything...',
    state,
  });
  // Order of imports matter here since we want dependencies to be imported first. For example, journeys depend on a lot of things, so they are last, and many things depend on scripts, so they are first.
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Scripts...`,
    state,
  });
  await exportOrImportWithErrorHandling(importScripts, {
    scriptName: '',
    importData,
    reUuid: reUuidScripts,
    validate: false,
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Authentication Settings...`,
    state,
  });
  await exportOrImportWithErrorHandling(importAuthenticationSettings, {
    importData,
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Agents...`,
    state,
  });
  await exportOrImportWithErrorHandling(importAgents, { importData, state });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing IDM Config Entities...`,
    state,
  });
  await exportOrImportWithErrorHandling(importConfigEntities, {
    importData,
    options: { validate: false },
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Email Templates...`,
    state,
  });
  await exportOrImportWithErrorHandling(importEmailTemplates, {
    importData,
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Resource Types...`,
    state,
  });
  await exportOrImportWithErrorHandling(importResourceTypes, {
    importData,
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Circles of Trust...`,
    state,
  });
  await exportOrImportWithErrorHandling(importCirclesOfTrust, {
    importData,
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Services...`,
    state,
  });
  await exportOrImportWithErrorHandling(importServices, {
    importData,
    options: { clean: cleanServices, global, realm },
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Themes...`,
    state,
  });
  await exportOrImportWithErrorHandling(importThemes, {
    importData,
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Saml2 Providers...`,
    state,
  });
  await exportOrImportWithErrorHandling(importSaml2Providers, {
    importData,
    options: { deps: false },
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Social Identity Providers...`,
    state,
  });
  await exportOrImportWithErrorHandling(importSocialIdentityProviders, {
    importData,
    options: { deps: false },
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing OAuth2 Clients...`,
    state,
  });
  await exportOrImportWithErrorHandling(importOAuth2Clients, {
    importData,
    options: { deps: false },
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Applications...`,
    state,
  });
  await exportOrImportWithErrorHandling(importApplications, {
    importData,
    options: { deps: false },
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Policy Sets...`,
    state,
  });
  await exportOrImportWithErrorHandling(importPolicySets, {
    importData,
    options: { deps: false, prereqs: false },
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Policies...`,
    state,
  });
  await exportOrImportWithErrorHandling(importPolicies, {
    importData,
    options: { deps: false, prereqs: false },
    state,
  });
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Journeys...`,
    state,
  });
  await exportOrImportWithErrorHandling(importJourneys, {
    importData,
    options: { deps: false, reUuid: reUuidJourneys },
    state,
  });
  stopProgressIndicator({
    id: indicatorId,
    message: 'Finished Importing Everything!',
    status: 'success',
    state,
  });
}
