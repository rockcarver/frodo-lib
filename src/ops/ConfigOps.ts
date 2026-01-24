import { AgentGroupSkeleton, AgentSkeleton } from '../api/AgentApi';
import { AmConfigEntitiesInterface } from '../api/AmConfigApi';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import { AuthenticationSettingsSkeleton } from '../api/AuthenticationSettingsApi';
import { CircleOfTrustSkeleton } from '../api/CirclesOfTrustApi';
import { SiteSkeleton } from '../api/classic/SiteApi';
import { SecretSkeleton } from '../api/cloud/SecretsApi';
import { VariableSkeleton } from '../api/cloud/VariablesApi';
import { OAuth2ClientSkeleton } from '../api/OAuth2ClientApi';
import { OAuth2TrustedJwtIssuerSkeleton } from '../api/OAuth2TrustedJwtIssuerApi';
import { PolicySkeleton } from '../api/PoliciesApi';
import { PolicySetSkeleton } from '../api/PolicySetApi';
import { RealmSkeleton } from '../api/RealmApi';
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
  getErrorCallback,
  getMetadata,
  importWithErrorHandling,
} from '../utils/ExportImportUtils';
import { getRealmUsingExportFormat } from '../utils/ForgeRockUtils';
import {
  exportAgentGroups,
  exportAgents,
  importAgentGroups,
  importAgents,
} from './AgentOps';
import {
  ConfigEntityExportInterface,
  exportAmConfigEntities,
  importAmConfigEntities,
} from './AmConfigOps';
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
import {
  exportSecretStores,
  importSecretStores,
  SecretStoreExportSkeleton,
} from './classic/SecretStoreOps';
import {
  exportServers,
  importServers,
  ServerExportInterface,
} from './classic/ServerOps';
import { exportSites, importSites } from './classic/SiteOps';
import { exportSecrets, importSecrets } from './cloud/SecretsOps';
import { exportVariables, importVariables } from './cloud/VariablesOps';
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
  exportInternalRoles,
  importInternalRoles,
  InternalRoleSkeleton,
} from './InternalRoleOps';
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
import {
  exportOAuth2TrustedJwtIssuers,
  importOAuth2TrustedJwtIssuers,
} from './OAuth2TrustedJwtIssuerOps';
import { ExportMetaData, ResultCallback } from './OpsTypes';
import { exportPolicies, importPolicies } from './PolicyOps';
import { exportPolicySets, importPolicySets } from './PolicySetOps';
import { exportRealms, importRealms } from './RealmOps';
import { exportResourceTypes, importResourceTypes } from './ResourceTypeOps';
import { exportSaml2Providers, importSaml2Providers } from './Saml2Ops';
import { exportScripts, importScripts } from './ScriptOps';
import {
  exportScriptTypes,
  importScriptTypes,
  ScriptTypeExportSkeleton,
} from './ScriptTypeOps';
import { exportServices, importServices } from './ServiceOps';
import { exportThemes, importThemes, ThemeSkeleton } from './ThemeOps';

export type Config = {
  /**
   * Export full configuration
   * @param {FullExportOptions} options export options
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   * @returns {Promise<FullExportInterface>} a promise resolving to a full export object
   */
  exportFullConfiguration(
    options: FullExportOptions,
    resultCallback: ResultCallback<any>
  ): Promise<FullExportInterface>;
  /**
   * Import full configuration
   * @param {FullExportInterface} importData import data
   * @param {FullImportOptions} options import options
   * @param {ResultCallback} resultCallback Optional callback to process individual results
   */
  importFullConfiguration(
    importData: FullExportInterface,
    options: FullImportOptions,
    resultCallback: ResultCallback<any>
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
        target: '',
        includeReadOnly: false,
        onlyRealm: false,
        onlyGlobal: false,
      },
      resultCallback = void 0
    ) {
      return exportFullConfiguration({ options, resultCallback, state });
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
      resultCallback = void 0
    ): Promise<(object | any[])[]> {
      return importFullConfiguration({
        importData,
        options,
        resultCallback,
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
  /**
   * Include read only config in export if true
   */
  includeReadOnly: boolean;
  /**
   * Export config only for the current realm
   */
  onlyRealm: boolean;
  /**
   * Export only global config
   */
  onlyGlobal: boolean;
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

export interface FullGlobalExportInterface extends AmConfigEntitiesInterface {
  agent: Record<string, AgentSkeleton> | undefined;
  authentication: AuthenticationSettingsSkeleton | undefined;
  emailTemplate: Record<string, EmailTemplateSkeleton> | undefined;
  idm: Record<string, IdObjectSkeletonInterface> | undefined;
  internalRole: Record<string, InternalRoleSkeleton>;
  mapping: Record<string, MappingSkeleton> | undefined;
  realm: Record<string, RealmSkeleton> | undefined;
  scripttype: Record<string, ScriptTypeExportSkeleton> | undefined;
  secret: Record<string, SecretSkeleton> | undefined;
  secretstore: Record<string, SecretStoreExportSkeleton> | undefined;
  server: ServerExportInterface | undefined;
  service: Record<string, AmServiceSkeleton> | undefined;
  site: Record<string, SiteSkeleton> | undefined;
  sync: SyncSkeleton | undefined;
  variable: Record<string, VariableSkeleton> | undefined;
}

export interface FullRealmExportInterface extends AmConfigEntitiesInterface {
  agentGroup: Record<string, AgentGroupSkeleton> | undefined;
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
  secretstore: Record<string, SecretStoreExportSkeleton> | undefined;
  service: Record<string, AmServiceSkeleton> | undefined;
  theme: Record<string, ThemeSkeleton> | undefined;
  trees: Record<string, SingleTreeExportInterface> | undefined;
  trustedJwtIssuer: Record<string, OAuth2TrustedJwtIssuerSkeleton> | undefined;
}

/**
 * Export full configuration
 * @param {FullExportOptions} options export options
 * @param {ResultCallback} resultCallback Optional callback to process individual results
 */
export async function exportFullConfiguration({
  options = {
    useStringArrays: true,
    noDecode: false,
    coords: true,
    includeDefault: false,
    includeActiveValues: true,
    target: '',
    includeReadOnly: false,
    onlyRealm: false,
    onlyGlobal: false,
  },
  resultCallback = void 0,
  state,
}: {
  options: FullExportOptions;
  resultCallback: ResultCallback<any>;
  state: State;
}): Promise<FullExportInterface> {
  const {
    useStringArrays,
    noDecode,
    coords,
    includeDefault,
    includeActiveValues,
    target,
    includeReadOnly,
    onlyRealm,
    onlyGlobal,
  } = options;
  const stateObj = { state };
  const globalStateObj = { globalConfig: true, state };
  const realmStateObj = { globalConfig: false, state };
  const isClassicDeployment =
    state.getDeploymentType() === Constants.CLASSIC_DEPLOYMENT_TYPE_KEY;
  const isCloudDeployment =
    state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY;
  const isForgeOpsDeployment =
    state.getDeploymentType() === Constants.FORGEOPS_DEPLOYMENT_TYPE_KEY;
  const isPlatformDeployment = isCloudDeployment || isForgeOpsDeployment;
  const errorCallback = getErrorCallback(resultCallback);

  const config = await exportWithErrorHandling(
    exportAmConfigEntities,
    {
      includeReadOnly,
      onlyRealm,
      onlyGlobal,
      errorCallback,
      state,
    },
    'AM Config Entities',
    resultCallback
  );

  // export global config
  let globalConfig = {} as FullGlobalExportInterface;
  if (!onlyRealm || onlyGlobal) {
    // Export mappings
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
      'Mappings',
      resultCallback,
      isPlatformDeployment
    );

    // Export servers and server properties
    const serverExport = await exportWithErrorHandling(
      exportServers,
      { options: { includeDefault: true }, state },
      'Servers',
      resultCallback,
      isClassicDeployment
    );
    if (serverExport) {
      delete serverExport.meta;
    }

    // Export global config
    globalConfig = {
      agent: (
        await exportWithErrorHandling(
          exportAgents,
          globalStateObj,
          'Global Agents',
          resultCallback,
          isClassicDeployment
        )
      )?.agent,
      authentication: (
        await exportWithErrorHandling(
          exportAuthenticationSettings,
          globalStateObj,
          'Global Authentication Settings',
          resultCallback,
          isClassicDeployment
        )
      )?.authentication,
      emailTemplate: (
        await exportWithErrorHandling(
          exportEmailTemplates,
          { includeDefault: includeReadOnly, state },
          'Email Templates',
          resultCallback,
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
            resultCallback: errorCallback,
            state,
          },
          'IDM Config Entities',
          resultCallback,
          isPlatformDeployment
        )
      )?.idm,
      internalRole: (
        await exportWithErrorHandling(
          exportInternalRoles,
          stateObj,
          'Internal Roles',
          resultCallback,
          isPlatformDeployment
        )
      )?.internalRole,
      mapping: mappings?.mapping,
      realm: (
        await exportWithErrorHandling(
          exportRealms,
          stateObj,
          'Realms',
          resultCallback,
          includeReadOnly || isClassicDeployment
        )
      )?.realm,
      scripttype: (
        await exportWithErrorHandling(
          exportScriptTypes,
          stateObj,
          'Script Types',
          resultCallback,
          includeReadOnly || isClassicDeployment
        )
      )?.scripttype,
      secret: (
        await exportWithErrorHandling(
          exportSecrets,
          { options: { includeActiveValues, target }, state },
          'ESV Secrets',
          resultCallback,
          isCloudDeployment
        )
      )?.secret,
      secretstore: (
        await exportWithErrorHandling(
          exportSecretStores,
          globalStateObj,
          'Global Secret Stores',
          resultCallback,
          isClassicDeployment
        )
      )?.secretstore,
      server: serverExport,
      service: (
        await exportWithErrorHandling(
          exportServices,
          globalStateObj,
          'Services',
          resultCallback
        )
      )?.service,
      site: (
        await exportWithErrorHandling(
          exportSites,
          stateObj,
          'Sites',
          resultCallback,
          isClassicDeployment
        )
      )?.site,
      sync: mappings?.sync,
      variable: (
        await exportWithErrorHandling(
          exportVariables,
          {
            noDecode,
            state,
          },
          'ESV Variables',
          resultCallback,
          isCloudDeployment
        )
      )?.variable,
      ...config.global,
    } as FullGlobalExportInterface;

    // Clean up duplicates
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
  }

  const realmConfig = {};
  if (!onlyGlobal || onlyRealm) {
    // Export realm configs
    const activeRealm = state.getRealm();
    for (const realm of Object.keys(config.realm)) {
      const currentRealm = getRealmUsingExportFormat(realm);
      if (
        onlyRealm &&
        (activeRealm.startsWith('/') ? activeRealm : '/' + activeRealm) !==
          currentRealm
      ) {
        continue;
      }
      state.setRealm(currentRealm);
      // Export saml2 providers and circle of trusts
      let saml = (
        (await exportWithErrorHandling(
          exportSaml2Providers,
          stateObj,
          'SAML2 Providers',
          resultCallback
        )) as CirclesOfTrustExportInterface
      )?.saml;
      const cotExport = await exportWithErrorHandling(
        exportCirclesOfTrust,
        stateObj,
        'Circle of Trusts',
        resultCallback
      );
      if (saml) {
        saml.cot = cotExport?.saml.cot;
      } else {
        saml = cotExport?.saml;
      }
      realmConfig[realm] = {
        agentGroup: (
          await exportWithErrorHandling(
            exportAgentGroups,
            stateObj,
            'Agent Groups',
            resultCallback
          )
        )?.agentGroup,
        agent: (
          await exportWithErrorHandling(
            exportAgents,
            realmStateObj,
            'Agents',
            resultCallback
          )
        )?.agent,
        application: (
          await exportWithErrorHandling(
            exportOAuth2Clients,
            {
              options: { deps: false, useStringArrays },
              state,
            },
            'OAuth2 Client Applications',
            resultCallback
          )
        )?.application,
        authentication: (
          await exportWithErrorHandling(
            exportAuthenticationSettings,
            realmStateObj,
            'Authentication Settings',
            resultCallback
          )
        )?.authentication,
        idp: (
          await exportWithErrorHandling(
            exportSocialIdentityProviders,
            stateObj,
            'Social Identity Providers',
            resultCallback
          )
        )?.idp,
        trees: (
          await exportWithErrorHandling(
            exportJourneys,
            {
              options: { deps: false, useStringArrays, coords },
              resultCallback: errorCallback,
              state,
            },
            'Journeys',
            resultCallback
          )
        )?.trees,
        managedApplication: (
          await exportWithErrorHandling(
            exportApplications,
            {
              options: { deps: false, useStringArrays },
              state,
            },
            'Applications',
            resultCallback,
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
            'Policies',
            resultCallback
          )
        )?.policy,
        policyset: (
          await exportWithErrorHandling(
            exportPolicySets,
            {
              options: { deps: false, prereqs: false, useStringArrays },
              state,
            },
            'Policy Sets',
            resultCallback
          )
        )?.policyset,
        resourcetype: (
          await exportWithErrorHandling(
            exportResourceTypes,
            stateObj,
            'Resource Types',
            resultCallback
          )
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
              resultCallback: errorCallback,
              state,
            },
            'Scripts',
            resultCallback
          )
        )?.script,
        secretstore: (
          await exportWithErrorHandling(
            exportSecretStores,
            realmStateObj,
            'Secret Stores',
            resultCallback,
            isClassicDeployment
          )
        )?.secretstore,
        service: (
          await exportWithErrorHandling(
            exportServices,
            realmStateObj,
            'Services',
            resultCallback
          )
        )?.service,
        theme: (
          await exportWithErrorHandling(
            exportThemes,
            {
              state,
            },
            'Themes',
            resultCallback,
            isPlatformDeployment
          )
        )?.theme,
        trustedJwtIssuer: (
          await exportWithErrorHandling(
            exportOAuth2TrustedJwtIssuers,
            {
              options: { deps: false, useStringArrays },
              state,
            },
            'Trusted JWT Issuers',
            resultCallback
          )
        )?.trustedJwtIssuer,
        ...config.realm[realm],
      };
      //Clean up realm duplicates
      if (
        realmConfig[realm].service &&
        realmConfig[realm].service['SocialIdentityProviders']
      ) {
        delete realmConfig[realm].service['SocialIdentityProviders']
          .nextDescendents;
      }
    }
    state.setRealm(activeRealm);
  }

  const fullConfig = {
    meta: getMetadata(stateObj),
    global: globalConfig as FullGlobalExportInterface,
    realm: realmConfig,
  };

  return fullConfig;
}

/**
 * Import full configuration
 * @param {FullExportInterface} importData import data
 * @param {FullImportOptions} options import options
 * @param {ResultCallback} resultCallback Optional callback to process individual results
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
  resultCallback = void 0,
  state,
}: {
  importData: FullExportInterface;
  options: FullImportOptions;
  resultCallback: ResultCallback<any>;
  state: State;
}): Promise<(object | any[])[]> {
  let response: (object | any[])[] = [];
  const isClassicDeployment =
    state.getDeploymentType() === Constants.CLASSIC_DEPLOYMENT_TYPE_KEY;
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
  const errorCallback = getErrorCallback(resultCallback);
  // Import to global
  let indicatorId = createProgressIndicator({
    total: 14,
    message: `Importing everything for global...`,
    state,
  });
  response.push(
    await importWithErrorHandling(
      importServers,
      {
        serverId: '',
        serverUrl: '',
        importData: importData.global.server,
        options: {
          includeDefault: true,
        },
        state,
      },
      indicatorId,
      'Servers',
      resultCallback,
      isClassicDeployment && !!importData.global.server
    )
  );
  response.push(
    await importWithErrorHandling(
      importSites,
      {
        siteId: '',
        siteUrl: '',
        importData: importData.global,
        state,
      },
      indicatorId,
      'Sites',
      resultCallback,
      isClassicDeployment && !!importData.global.site
    )
  );
  response.push(
    await importWithErrorHandling(
      importRealms,
      {
        realmId: '',
        realmName: '',
        importData: importData.global,
        state,
      },
      indicatorId,
      'Realms',
      resultCallback,
      isClassicDeployment && !!importData.global.realm
    )
  );
  response.push(
    await importWithErrorHandling(
      importScriptTypes,
      {
        scriptTypeId: '',
        importData: importData.global,
        state,
      },
      indicatorId,
      'Script Types',
      resultCallback,
      isClassicDeployment && !!importData.global.scripttype
    )
  );
  response.push(
    await importWithErrorHandling(
      importSecretStores,
      {
        importData: importData.global,
        globalConfig: true,
        secretStoreId: '',
        state,
      },
      indicatorId,
      'Secret Stores',
      resultCallback,
      isClassicDeployment && !!importData.global.secretstore
    )
  );
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
      indicatorId,
      'Secrets',
      resultCallback,
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
      indicatorId,
      'Variables',
      resultCallback,
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
        resultCallback: errorCallback,
        state,
      },
      indicatorId,
      'IDM Config Entities',
      resultCallback,
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
      indicatorId,
      'Email Templates',
      resultCallback,
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
      indicatorId,
      'Mappings',
      resultCallback,
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
      indicatorId,
      'Services',
      resultCallback,
      !!importData.global.service
    )
  );
  response.push(
    await importWithErrorHandling(
      importAgents,
      { importData: importData.global, globalConfig: true, state },
      indicatorId,
      'Agents',
      resultCallback,
      isClassicDeployment && !!importData.global.agent
    )
  );
  response.push(
    await importWithErrorHandling(
      importAuthenticationSettings,
      {
        importData: importData.global,
        globalConfig: true,
        state,
      },
      indicatorId,
      'Authentication Settings',
      resultCallback,
      isClassicDeployment && !!importData.global.authentication
    )
  );
  response.push(
    await importWithErrorHandling(
      importInternalRoles,
      {
        importData: importData.global,
        state,
      },
      indicatorId,
      'Internal Roles',
      resultCallback,
      isPlatformDeployment && !!importData.global.internalRole
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
      total: 17,
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
          resultCallback: errorCallback,
          state,
        },
        indicatorId,
        'Scripts',
        resultCallback,
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
        indicatorId,
        'Themes',
        resultCallback,
        isPlatformDeployment && !!importData.realm[realm].theme
      )
    );
    response.push(
      await importWithErrorHandling(
        importSecretStores,
        {
          importData: importData.realm[realm],
          globalConfig: false,
          secretStoreId: '',
          state,
        },
        indicatorId,
        'Secret Stores',
        resultCallback,
        isClassicDeployment && !!importData.realm[realm].secretstore
      )
    );
    response.push(
      await importWithErrorHandling(
        importAgentGroups,
        { importData: importData.realm[realm], state },
        indicatorId,
        'Agent Groups',
        resultCallback,
        !!importData.realm[realm].agentGroup
      )
    );
    response.push(
      await importWithErrorHandling(
        importAgents,
        { importData: importData.realm[realm], globalConfig: false, state },
        indicatorId,
        'Agents',
        resultCallback,
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
        indicatorId,
        'Resource Types',
        resultCallback,
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
        indicatorId,
        'Circles of Trust',
        resultCallback,
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
        indicatorId,
        'Saml2 Providers',
        resultCallback,
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
        indicatorId,
        'Social Identity Providers',
        resultCallback,
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
        indicatorId,
        'OAuth2 Clients',
        resultCallback,
        !!importData.realm[realm].application
      )
    );
    response.push(
      await importWithErrorHandling(
        importOAuth2TrustedJwtIssuers,
        {
          importData: importData.realm[realm],
          state,
        },
        indicatorId,
        'Trusted JWT Issuers',
        resultCallback,
        !!importData.realm[realm].trustedJwtIssuer
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
        indicatorId,
        'Applications',
        resultCallback,
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
        indicatorId,
        'Policy Sets',
        resultCallback,
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
        indicatorId,
        'Policies',
        resultCallback,
        !!importData.realm[realm].policy
      )
    );
    response.push(
      await importWithErrorHandling(
        importJourneys,
        {
          importData: importData.realm[realm],
          options: { deps: false, reUuid: reUuidJourneys },
          resultCallback: errorCallback,
          state,
        },
        indicatorId,
        'Journeys',
        resultCallback,
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
        indicatorId,
        'Services',
        resultCallback,
        !!importData.realm[realm].service
      )
    );
    response.push(
      await importWithErrorHandling(
        importAuthenticationSettings,
        {
          importData: importData.realm[realm],
          globalConfig: false,
          state,
        },
        indicatorId,
        'Authentication Settings',
        resultCallback,
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
  // Import everything else
  indicatorId = createProgressIndicator({
    total: 1,
    message: `Importing all other AM config entities`,
    state,
  });
  response.push(
    await importWithErrorHandling(
      importAmConfigEntities,
      {
        importData: importData as unknown as ConfigEntityExportInterface,
        resultCallback: errorCallback,
        state,
      },
      indicatorId,
      'Other AM Config Entities',
      resultCallback
    )
  );
  // Filter out any null or empty results
  response = response.filter(
    (o) =>
      o &&
      (!Array.isArray(o) || o.length > 0) &&
      (!(o as ServerExportInterface).server ||
        Object.keys((o as ServerExportInterface).server).length > 0)
  );
  stopProgressIndicator({
    id: indicatorId,
    message: `Finished Importing all other AM config entities!`,
    status: 'success',
    state,
  });
  return response;
}
