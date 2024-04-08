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
import { FrodoError } from './FrodoError';
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
   * @param {Error[]} collectErrors optional parameters to collect erros instead of having the function throw. Pass an empty array to collect errors and report on them but have the function perform all it can and return the export data even if it encounters errors.
   * @returns {Promise<IdObjectSkeletonInterface>} a promise resolving to a full export object
   */
  exportFullConfiguration(
    options: FullExportOptions,
    collectErrors?: Error[]
  ): Promise<FullExportInterface>;
  /**
   * Import full configuration
   * @param {FullExportInterface} importData import data
   * @param {FullImportOptions} options import options
   * @param {Error[]} collectErrors optional parameters to collect erros instead of having the function throw. Pass an empty array to collect errors and report on them but have the function perform all it can and return the export data even if it encounters errors.
   */
  importFullConfiguration(
    importData: FullExportInterface,
    options: FullImportOptions,
    collectErrors?: Error[]
  ): Promise<void>;
};

export default (state: State): Config => {
  return {
    async exportFullConfiguration(
      options: FullExportOptions = {
        useStringArrays: true,
        noDecode: false,
        coords: true,
        includeDefault: false,
      },
      collectErrors: Error[]
    ) {
      return exportFullConfiguration({ options, collectErrors, state });
    },
    async importFullConfiguration(
      importData: FullExportInterface,
      options: FullImportOptions = {
        reUuidJourneys: false,
        reUuidScripts: false,
        cleanServices: false,
        global: false,
        realm: false,
        includeDefault: false,
      },
      collectErrors: Error[]
    ) {
      return importFullConfiguration({
        importData,
        options,
        collectErrors,
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
  /**
   * Include default scripts in export if true
   */
  includeDefault: boolean;
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
  /**
   * Include default scripts in import if true
   */
  includeDefault: boolean;
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
  options = {
    useStringArrays: true,
    noDecode: false,
    coords: true,
    includeDefault: false,
  },
  collectErrors,
  state,
}: {
  options: FullExportOptions;
  collectErrors?: Error[];
  state: State;
}): Promise<FullExportInterface> {
  let errors: Error[] = [];
  let throwErrors: boolean = true;
  if (collectErrors && Array.isArray(collectErrors)) {
    throwErrors = false;
    errors = collectErrors;
  }
  const { useStringArrays, noDecode, coords, includeDefault } = options;
  const stateObj = { state };
  //Export saml2 providers and circle of trusts
  let saml = (
    (await exportOrImportWithErrorHandling(
      exportSaml2Providers,
      stateObj,
      errors
    )) as CirclesOfTrustExportInterface
  )?.saml;
  const cotExport = await exportOrImportWithErrorHandling(
    exportCirclesOfTrust,
    stateObj,
    errors
  );
  if (saml) {
    saml.cot = cotExport?.saml.cot;
  } else {
    saml = cotExport?.saml;
  }
  //Create full export
  const fullExport = {
    meta: getMetadata(stateObj),
    agents: (
      await exportOrImportWithErrorHandling(exportAgents, stateObj, errors)
    )?.agents,
    application: (
      await exportOrImportWithErrorHandling(
        exportOAuth2Clients,
        {
          options: { deps: false, useStringArrays },
          state,
        },
        errors
      )
    )?.application,
    authentication: (
      await exportOrImportWithErrorHandling(
        exportAuthenticationSettings,
        stateObj,
        errors
      )
    )?.authentication,
    config: (
      await exportOrImportWithErrorHandling(
        exportConfigEntities,
        stateObj,
        errors
      )
    )?.config,
    emailTemplate: (
      await exportOrImportWithErrorHandling(
        exportEmailTemplates,
        stateObj,
        errors
      )
    )?.emailTemplate,
    idp: (
      await exportOrImportWithErrorHandling(
        exportSocialIdentityProviders,
        stateObj,
        errors
      )
    )?.idp,
    managedApplication: (
      await exportOrImportWithErrorHandling(
        exportApplications,
        {
          options: { deps: false, useStringArrays },
          state,
        },
        errors
      )
    )?.managedApplication,
    policy: (
      await exportOrImportWithErrorHandling(
        exportPolicies,
        {
          options: { deps: false, prereqs: false, useStringArrays },
          state,
        },
        errors
      )
    )?.policy,
    policyset: (
      await exportOrImportWithErrorHandling(
        exportPolicySets,
        {
          options: { deps: false, prereqs: false, useStringArrays },
          state,
        },
        errors
      )
    )?.policyset,
    resourcetype: (
      await exportOrImportWithErrorHandling(
        exportResourceTypes,
        stateObj,
        errors
      )
    )?.resourcetype,
    saml,
    script: (
      await exportOrImportWithErrorHandling(
        exportScripts,
        {
          includeDefault,
          state,
        },
        errors
      )
    )?.script,
    secrets: (
      await exportOrImportWithErrorHandling(exportSecrets, stateObj, errors)
    )?.secrets,
    service: {
      ...(
        await exportOrImportWithErrorHandling(
          exportServices,
          {
            globalConfig: true,
            state,
          },
          errors
        )
      )?.service,
      ...(
        await exportOrImportWithErrorHandling(
          exportServices,
          {
            globalConfig: false,
            state,
          },
          errors
        )
      )?.service,
    },
    theme: (
      await exportOrImportWithErrorHandling(exportThemes, stateObj, errors)
    )?.theme,
    trees: (
      await exportOrImportWithErrorHandling(
        exportJourneys,
        {
          options: { deps: false, useStringArrays, coords },
          state,
        },
        errors
      )
    )?.trees,
    variables: (
      await exportOrImportWithErrorHandling(
        exportVariables,
        {
          noDecode,
          state,
        },
        errors
      )
    )?.variables,
  };
  if (throwErrors && errors.length > 0) {
    throw new FrodoError(`Error exporting full config`, errors);
  }
  return fullExport;
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
    includeDefault: false,
  },
  collectErrors,
  state,
}: {
  importData: FullExportInterface;
  options: FullImportOptions;
  collectErrors?: Error[];
  state: State;
}): Promise<void> {
  let errors: Error[] = [];
  let throwErrors: boolean = true;
  if (collectErrors && Array.isArray(collectErrors)) {
    throwErrors = false;
    errors = collectErrors;
  }
  const {
    reUuidJourneys,
    reUuidScripts,
    cleanServices,
    global,
    realm,
    includeDefault,
  } = options;
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
  await exportOrImportWithErrorHandling(
    importScripts,
    {
      scriptName: '',
      importData,
      options: {
        reUuid: reUuidScripts,
        includeDefault,
      },
      validate: false,
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Authentication Settings...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importAuthenticationSettings,
    {
      importData,
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Agents...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importAgents,
    { importData, state },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing IDM Config Entities...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importConfigEntities,
    {
      importData,
      options: { validate: false },
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Email Templates...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importEmailTemplates,
    {
      importData,
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Resource Types...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importResourceTypes,
    {
      importData,
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Circles of Trust...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importCirclesOfTrust,
    {
      importData,
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Services...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importServices,
    {
      importData,
      options: { clean: cleanServices, global, realm },
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Themes...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importThemes,
    {
      importData,
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Saml2 Providers...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importSaml2Providers,
    {
      importData,
      options: { deps: false },
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Social Identity Providers...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importSocialIdentityProviders,
    {
      importData,
      options: { deps: false },
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing OAuth2 Clients...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importOAuth2Clients,
    {
      importData,
      options: { deps: false },
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Applications...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importApplications,
    {
      importData,
      options: { deps: false },
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Policy Sets...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importPolicySets,
    {
      importData,
      options: { deps: false, prereqs: false },
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Policies...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importPolicies,
    {
      importData,
      options: { deps: false, prereqs: false },
      state,
    },
    errors
  );
  updateProgressIndicator({
    id: indicatorId,
    message: `Importing Journeys...`,
    state,
  });
  await exportOrImportWithErrorHandling(
    importJourneys,
    {
      importData,
      options: { deps: false, reUuid: reUuidJourneys },
      state,
    },
    errors
  );
  stopProgressIndicator({
    id: indicatorId,
    message: 'Finished Importing Everything!',
    status: 'success',
    state,
  });
  if (throwErrors && errors.length > 0) {
    throw new FrodoError(`Error importing full config`, errors);
  }
}
