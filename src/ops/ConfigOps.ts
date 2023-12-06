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
  exportWithErrorHandling,
  getMetadata,
} from '../utils/ExportImportUtils';
import { exportAgents } from './AgentOps';
import { ApplicationSkeleton, exportApplications } from './ApplicationOps';
import { exportAuthenticationSettings } from './AuthenticationSettingsOps';
import {
  CirclesOfTrustExportInterface,
  exportCirclesOfTrust,
} from './CirclesOfTrustOps';
import { exportSecrets } from './cloud/SecretsOps';
import { exportVariables } from './cloud/VariablesOps';
import {
  EmailTemplateSkeleton,
  exportEmailTemplates,
} from './EmailTemplateOps';
import { exportConfigEntities } from './IdmConfigOps';
import { exportSocialProviders } from './IdpOps';
import { exportJourneys, SingleTreeExportInterface } from './JourneyOps';
import { exportOAuth2Clients } from './OAuth2ClientOps';
import { ExportMetaData } from './OpsTypes';
import { exportPolicies } from './PolicyOps';
import { exportPolicySets } from './PolicySetOps';
import { exportResourceTypes } from './ResourceTypeOps';
import { exportSaml2Providers } from './Saml2Ops';
import { exportScripts } from './ScriptOps';
import { exportServices } from './ServiceOps';
import { exportThemes, ThemeSkeleton } from './ThemeOps';

export type Config = {
  exportFullConfiguration(
    options: FullExportOptions
  ): Promise<FullExportInterface>;
};

export default (state: State): Config => {
  return {
    async exportFullConfiguration(
      options: FullExportOptions = { useStringArrays: true, noDecode: false }
    ) {
      return exportFullConfiguration({ options, state });
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
  options = { useStringArrays: true, noDecode: false },
  state,
}: {
  options: FullExportOptions;
  state: State;
}): Promise<FullExportInterface> {
  const { useStringArrays, noDecode } = options;
  const stateObj = { state };
  //Export saml2 providers and circle of trusts
  let saml = (
    (await exportWithErrorHandling(
      exportSaml2Providers,
      stateObj
    )) as CirclesOfTrustExportInterface
  )?.saml;
  const cotExport = await exportWithErrorHandling(
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
    agents: (await exportWithErrorHandling(exportAgents, stateObj))?.agents,
    application: (
      await exportWithErrorHandling(exportOAuth2Clients, {
        options: { deps: false, useStringArrays },
        state,
      })
    )?.application,
    authentication: (
      await exportWithErrorHandling(exportAuthenticationSettings, stateObj)
    )?.authentication,
    config: (await exportWithErrorHandling(exportConfigEntities, stateObj))
      ?.config,
    emailTemplate: (
      await exportWithErrorHandling(exportEmailTemplates, stateObj)
    )?.emailTemplate,
    idp: (await exportWithErrorHandling(exportSocialProviders, stateObj))?.idp,
    managedApplication: (
      await exportWithErrorHandling(exportApplications, {
        options: { deps: false, useStringArrays },
        state,
      })
    )?.managedApplication,
    policy: (
      await exportWithErrorHandling(exportPolicies, {
        options: { deps: false, prereqs: false, useStringArrays },
        state,
      })
    )?.policy,
    policyset: (
      await exportWithErrorHandling(exportPolicySets, {
        options: { deps: false, prereqs: false, useStringArrays },
        state,
      })
    )?.policyset,
    resourcetype: (await exportWithErrorHandling(exportResourceTypes, stateObj))
      ?.resourcetype,
    saml,
    script: (await exportWithErrorHandling(exportScripts, stateObj))?.script,
    secrets: (await exportWithErrorHandling(exportSecrets, stateObj))?.secrets,
    service: {
      ...(
        await exportWithErrorHandling(exportServices, {
          globalConfig: true,
          state,
        })
      )?.service,
      ...(
        await exportWithErrorHandling(exportServices, {
          globalConfig: false,
          state,
        })
      )?.service,
    },
    theme: (await exportWithErrorHandling(exportThemes, stateObj))?.theme,
    trees: (
      await exportWithErrorHandling(exportJourneys, {
        options: { deps: false, useStringArrays },
        state,
      })
    )?.trees,
    variables: (
      await exportWithErrorHandling(exportVariables, { noDecode, state })
    )?.variables,
  };
}
