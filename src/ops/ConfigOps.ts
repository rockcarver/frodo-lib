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
import Constants from '../shared/Constants';
import { State } from '../shared/State';
import {
  createProgressIndicator,
  stopProgressIndicator,
} from '../utils/Console';
import {
  exportWithErrorHandling,
  getMetadata,
  importWithErrorHandling,
} from '../utils/ExportImportUtils';
import {
  getRealmsForExport,
  getRealmUsingExportFormat,
} from '../utils/ForgeRockUtils';
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
import { exportSecrets, importSecrets } from './cloud/SecretsOps';
import { exportVariables, importVariables } from './cloud/VariablesOps';
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
import {
  exportMappings,
  importMappings,
  MappingSkeleton,
  SyncSkeleton,
} from './MappingOps';
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
   * @param {Error[]} collectErrors optional parameter to collect errors instead of having the function throw. Pass an empty array to collect errors and report on them but have the function perform all it can and return the export data even if it encounters errors.
   * @returns {Promise<FullExportInterface>} a promise resolving to a full export object
   */
  exportFullConfiguration(
    options: FullExportOptions,
    collectErrors?: Error[]
  ): Promise<FullExportInterface>;
  /**
   * Import full configuration
   * @param {FullExportInterface} importData import data
   * @param {FullImportOptions} options import options
   * @param {Error[]} collectErrors optional parameter to collect errors instead of having the function throw. Pass an empty array to collect errors and report on them but have the function perform all it can and return the export data even if it encounters errors.
   */
  importFullConfiguration(
    importData: FullExportInterface,
    options: FullImportOptions,
    collectErrors?: Error[]
  ): Promise<(object | any[])[]>;
};

export default (state: State): Config => {
  return {
    async exportFullConfiguration(
      options: FullExportOptions = {
        useStringArrays: true,
        noDecode: false,
        coords: true,
        includeDefault: false,
        includeActiveValues: true,
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
        includeDefault: false,
        includeActiveValues: true,
      },
      collectErrors: Error[]
    ): Promise<(object | any[])[]> {
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
  /**
   * Include active and loaded secret values
   */
  includeActiveValues: boolean;
  /**
   * Host URL of target environment to encrypt secret values for
   */
  target?: string;
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
   * Include default scripts in import if true
   */
  includeDefault: boolean;
  /**
   * Include active secret values
   */
  includeActiveValues: boolean;
  /**
   * Host URL of source environment to decrypt secret values from
   */
  source?: string;
}

export interface FullExportInterface {
  meta?: ExportMetaData;
  global: FullGlobalExportInterface;
  realm: Record<string, FullRealmExportInterface>;
}

export interface FullGlobalExportInterface {
  emailTemplate: Record<string, EmailTemplateSkeleton> | undefined;
  idm: Record<string, IdObjectSkeletonInterface> | undefined;
  mapping: Record<string, MappingSkeleton> | undefined;
  secret: Record<string, SecretSkeleton> | undefined;
  service: Record<string, AmServiceSkeleton> | undefined;
  sync: SyncSkeleton | undefined;
  variable: Record<string, VariableSkeleton> | undefined;
}

export interface FullRealmExportInterface {
  agent: Record<string, AgentSkeleton> | undefined;
  application: Record<string, OAuth2ClientSkeleton> | undefined;
  authentication: AuthenticationSettingsSkeleton | undefined;
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
  service: Record<string, AmServiceSkeleton> | undefined;
  theme: Record<string, ThemeSkeleton> | undefined;
  trees: Record<string, SingleTreeExportInterface> | undefined;
}

/**
 * Export full configuration
 * @param {FullExportOptions} options export options
 * @param {Error[]} collectErrors optional parameter to collect errors instead of having the function throw. Pass an empty array to collect errors and report on them but have the function perform all it can and return the export data even if it encounters errors.
 */
export async function exportFullConfiguration({
  options = {
    useStringArrays: true,
    noDecode: false,
    coords: true,
    includeDefault: false,
    includeActiveValues: true,
    target: '',
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
  const {
    useStringArrays,
    noDecode,
    coords,
    includeDefault,
    includeActiveValues,
    target,
  } = options;
  const stateObj = { state };
  const globalStateObj = { globalConfig: true, state };
  const realmStateObj = { globalConfig: false, state };
  const isCloudDeployment =
    state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
  const isForgeOpsDeployment =
    state.getDeploymentType() === Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;
  const isPlatformDeployment = isCloudDeployment || isForgeOpsDeployment;
  //Export mappings
  const mappings = await exportWithErrorHandling(
    exportMappings,
    {
      options: {
        useStringArrays,
        deps: false,
        connectorId: undefined,
        moType: undefined,
      },
      state,
    },
    errors,
    isPlatformDeployment
  );
  //Export global config
  const globalConfig: FullGlobalExportInterface = {
    emailTemplate: (
      await exportWithErrorHandling(
        exportEmailTemplates,
        stateObj,
        errors,
        isPlatformDeployment
      )
    )?.emailTemplate,
    idm: (
      await exportWithErrorHandling(
        exportConfigEntities,
        {
          options: {
            envReplaceParams: undefined,
            entitiesToExport: undefined,
          },
          state,
        },
        errors,
        isPlatformDeployment
      )
    )?.idm,
    mapping: mappings?.mapping,
    secret: (
      await exportWithErrorHandling(
        exportSecrets,
        { options: { includeActiveValues, target }, state },
        errors,
        isCloudDeployment
      )
    )?.secret,
    service: (
      await exportWithErrorHandling(exportServices, globalStateObj, errors)
    )?.service,
    sync: mappings?.sync,
    variable: (
      await exportWithErrorHandling(
        exportVariables,
        {
          noDecode,
          state,
        },
        errors,
        isCloudDeployment
      )
    )?.variable,
  };

  //Clean up duplicates
  if (globalConfig.idm) {
    Object.keys(globalConfig.idm)
      .filter(
        (k) =>
          k === 'ui/themerealm' ||
          k === 'sync' ||
          k.startsWith('mapping/') ||
          k.startsWith('emailTemplate/')
      )
      .forEach((k) => delete globalConfig.idm[k]);
  }

  //Export realm configs
  const realmConfig = {};
  const currentRealm = state.getRealm();
  for (const realm of await getRealmsForExport(stateObj)) {
    state.setRealm(getRealmUsingExportFormat(realm));
    //Export saml2 providers and circle of trusts
    let saml = (
      (await exportWithErrorHandling(
        exportSaml2Providers,
        stateObj,
        errors
      )) as CirclesOfTrustExportInterface
    )?.saml;
    const cotExport = await exportWithErrorHandling(
      exportCirclesOfTrust,
      stateObj,
      errors
    );
    if (saml) {
      saml.cot = cotExport?.saml.cot;
    } else {
      saml = cotExport?.saml;
    }
    realmConfig[realm] = {
      agent: (
        await exportWithErrorHandling(exportAgents, realmStateObj, errors)
      )?.agent,
      application: (
        await exportWithErrorHandling(
          exportOAuth2Clients,
          {
            options: { deps: false, useStringArrays },
            state,
          },
          errors
        )
      )?.application,
      authentication: (
        await exportWithErrorHandling(
          exportAuthenticationSettings,
          realmStateObj,
          errors
        )
      )?.authentication,
      idp: (
        await exportWithErrorHandling(
          exportSocialIdentityProviders,
          stateObj,
          errors
        )
      )?.idp,
      managedApplication: (
        await exportWithErrorHandling(
          exportApplications,
          {
            options: { deps: false, useStringArrays },
            state,
          },
          errors,
          isPlatformDeployment
        )
      )?.managedApplication,
      policy: (
        await exportWithErrorHandling(
          exportPolicies,
          {
            options: { deps: false, prereqs: false, useStringArrays },
            state,
          },
          errors
        )
      )?.policy,
      policyset: (
        await exportWithErrorHandling(
          exportPolicySets,
          {
            options: { deps: false, prereqs: false, useStringArrays },
            state,
          },
          errors
        )
      )?.policyset,
      resourcetype: (
        await exportWithErrorHandling(exportResourceTypes, stateObj, errors)
      )?.resourcetype,
      saml,
      script: (
        await exportWithErrorHandling(
          exportScripts,
          {
            options: {
              deps: false,
              includeDefault,
              useStringArrays,
            },
            state,
          },
          errors
        )
      )?.script,
      service: (
        await exportWithErrorHandling(exportServices, realmStateObj, errors)
      )?.service,
      theme: (
        await exportWithErrorHandling(
          exportThemes,
          {
            state,
          },
          errors,
          isPlatformDeployment
        )
      )?.theme,
      trees: (
        await exportWithErrorHandling(
          exportJourneys,
          {
            options: { deps: false, useStringArrays, coords },
            state,
          },
          errors
        )
      )?.trees,
    };
  }
  state.setRealm(currentRealm);

  if (throwErrors && errors.length > 0) {
    throw new FrodoError(`Error exporting full config`, errors);
  }

  return {
    meta: getMetadata(stateObj),
    global: globalConfig,
    realm: realmConfig,
  };
}

/**
 * Import full configuration
 * @param {FullExportInterface} importData import data
 * @param {FullImportOptions} options import options
 * @param {Error[]} collectErrors optional parameter to collect errors instead of having the function throw. Pass an empty array to collect errors and report on them but have the function perform all it can and return the export data even if it encounters errors.
 */
export async function importFullConfiguration({
  importData,
  options = {
    reUuidJourneys: false,
    reUuidScripts: false,
    cleanServices: false,
    includeDefault: false,
    includeActiveValues: true,
    source: '',
  },
  collectErrors,
  state,
}: {
  importData: FullExportInterface;
  options: FullImportOptions;
  collectErrors?: Error[];
  state: State;
}): Promise<(object | any[])[]> {
  const response: (object | any[])[] = [];
  let errors: Error[] = [];
  let throwErrors: boolean = true;
  if (collectErrors && Array.isArray(collectErrors)) {
    throwErrors = false;
    errors = collectErrors;
  }
  const isCloudDeployment =
    state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
  const isForgeOpsDeployment =
    state.getDeploymentType() === Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;
  const isPlatformDeployment = isCloudDeployment || isForgeOpsDeployment;
  const {
    reUuidJourneys,
    reUuidScripts,
    cleanServices,
    includeDefault,
    includeActiveValues,
    source,
  } = options;
  // Import to global
  let indicatorId = createProgressIndicator({
    total: 6,
    message: `Importing everything for global...`,
    state,
  });
  response.push(
    await importWithErrorHandling(
      importSecrets,
      {
        importData: importData.global,
        options: {
          includeActiveValues,
          source,
        },
        state,
      },
      errors,
      indicatorId,
      'Secrets',
      isCloudDeployment && !!importData.global.secret
    )
  );
  response.push(
    await importWithErrorHandling(
      importVariables,
      {
        importData: importData.global,
        state,
      },
      errors,
      indicatorId,
      'Variables',
      isCloudDeployment && !!importData.global.variable
    )
  );
  response.push(
    await importWithErrorHandling(
      importConfigEntities,
      {
        importData: importData.global,
        options: {
          envReplaceParams: undefined,
          entitiesToImport: undefined,
          validate: false,
        },
        state,
      },
      errors,
      indicatorId,
      'IDM Config Entities',
      isPlatformDeployment && !!importData.global.idm
    )
  );
  response.push(
    await importWithErrorHandling(
      importEmailTemplates,
      {
        importData: importData.global,
        state,
      },
      errors,
      indicatorId,
      'Email Templates',
      isPlatformDeployment && !!importData.global.emailTemplate
    )
  );
  response.push(
    await importWithErrorHandling(
      importMappings,
      {
        importData: importData.global,
        options: { deps: false },
        state,
      },
      errors,
      indicatorId,
      'Mappings',
      isPlatformDeployment
    )
  );
  response.push(
    await importWithErrorHandling(
      importServices,
      {
        importData: importData.global,
        options: { clean: cleanServices, global: true, realm: false },
        state,
      },
      errors,
      indicatorId,
      'Services',
      !!importData.global.service
    )
  );
  stopProgressIndicator({
    id: indicatorId,
    message: 'Finished Importing Everything to global!',
    status: 'success',
    state,
  });
  // Import to realms
  const currentRealm = state.getRealm();
  for (const realm of Object.keys(importData.realm)) {
    state.setRealm(getRealmUsingExportFormat(realm));
    indicatorId = createProgressIndicator({
      total: 14,
      message: `Importing everything for ${realm} realm...`,
      state,
    });
    // Order of imports matter here since we want dependencies to be imported first. For example, journeys depend on a lot of things, so they are last, and many things depend on scripts, so they are first.
    response.push(
      await importWithErrorHandling(
        importScripts,
        {
          scriptName: '',
          importData: importData.realm[realm],
          options: {
            deps: false,
            reUuid: reUuidScripts,
            includeDefault,
          },
          validate: false,
          state,
        },
        errors,
        indicatorId,
        'Scripts',
        !!importData.realm[realm].script
      )
    );
    response.push(
      await importWithErrorHandling(
        importThemes,
        {
          importData: importData.realm[realm],
          state,
        },
        errors,
        indicatorId,
        'Themes',
        isPlatformDeployment && !!importData.realm[realm].theme
      )
    );
    response.push(
      await importWithErrorHandling(
        importAgents,
        { importData: importData.realm[realm], state },
        errors,
        indicatorId,
        'Agents',
        !!importData.realm[realm].agent
      )
    );
    response.push(
      await importWithErrorHandling(
        importResourceTypes,
        {
          importData: importData.realm[realm],
          state,
        },
        errors,
        indicatorId,
        'Resource Types',
        !!importData.realm[realm].resourcetype
      )
    );
    response.push(
      await importWithErrorHandling(
        importCirclesOfTrust,
        {
          importData: importData.realm[realm],
          state,
        },
        errors,
        indicatorId,
        'Circles of Trust',
        !!importData.realm[realm].saml && !!importData.realm[realm].saml.cot
      )
    );
    response.push(
      await importWithErrorHandling(
        importSaml2Providers,
        {
          importData: importData.realm[realm],
          options: { deps: false },
          state,
        },
        errors,
        indicatorId,
        'Saml2 Providers',
        !!importData.realm[realm].saml
      )
    );
    response.push(
      await importWithErrorHandling(
        importSocialIdentityProviders,
        {
          importData: importData.realm[realm],
          options: { deps: false },
          state,
        },
        errors,
        indicatorId,
        'Social Identity Providers',
        !!importData.realm[realm].idp
      )
    );
    response.push(
      await importWithErrorHandling(
        importOAuth2Clients,
        {
          importData: importData.realm[realm],
          options: { deps: false },
          state,
        },
        errors,
        indicatorId,
        'OAuth2 Clients',
        !!importData.realm[realm].application
      )
    );
    response.push(
      await importWithErrorHandling(
        importApplications,
        {
          importData: importData.realm[realm],
          options: { deps: false },
          state,
        },
        errors,
        indicatorId,
        'Applications',
        isPlatformDeployment && !!importData.realm[realm].managedApplication
      )
    );
    response.push(
      await importWithErrorHandling(
        importPolicySets,
        {
          importData: importData.realm[realm],
          options: { deps: false, prereqs: false },
          state,
        },
        errors,
        indicatorId,
        'Policy Sets',
        !!importData.realm[realm].policyset
      )
    );
    response.push(
      await importWithErrorHandling(
        importPolicies,
        {
          importData: importData.realm[realm],
          options: { deps: false, prereqs: false },
          state,
        },
        errors,
        indicatorId,
        'Policies',
        !!importData.realm[realm].policy
      )
    );
    response.push(
      await importWithErrorHandling(
        importJourneys,
        {
          importData: importData.realm[realm],
          options: { deps: false, reUuid: reUuidJourneys },
          state,
        },
        errors,
        indicatorId,
        'Journeys',
        !!importData.realm[realm].trees
      )
    );
    response.push(
      await importWithErrorHandling(
        importServices,
        {
          importData: importData.realm[realm],
          options: { clean: cleanServices, global: false, realm: true },
          state,
        },
        errors,
        indicatorId,
        'Services',
        !!importData.realm[realm].service
      )
    );
    response.push(
      await importWithErrorHandling(
        importAuthenticationSettings,
        {
          importData: importData.realm[realm],
          state,
        },
        errors,
        indicatorId,
        'Authentication Settings',
        !!importData.realm[realm].authentication
      )
    );
    stopProgressIndicator({
      id: indicatorId,
      message: `Finished Importing Everything to ${realm} realm!`,
      status: 'success',
      state,
    });
  }
  state.setRealm(currentRealm);
  if (throwErrors && errors.length > 0) {
    throw new FrodoError(`Error importing full config`, errors);
  }
  // Filter out any null or empty results
  return response.filter((o) => o && (!Array.isArray(o) || o.length > 0));
}
