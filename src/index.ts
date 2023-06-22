import Color from 'colors';

Color.enable();

// Api Layer
export * as AgentRaw from './api/AgentApi';
export * as AuthenticateRaw from './api/AuthenticateApi';
export * as NodeRaw from './api/NodeApi';
// TODO: need to figure out if this is the right approach or if we should even
// use a public oauth2/oidc library. might be ok for now since there is only
// one place where the cli needs to execute an oauth flow.
export * as OAuth2OIDCApi from './api/OAuth2OIDCApi';
export * as SecretsRaw from './api/cloud/SecretsApi';
export * as SocialIdentityProvidersRaw from './api/SocialIdentityProvidersApi';
export * as StartupRaw from './api/cloud/StartupApi';
export * as TreeRaw from './api/TreeApi';
export * as TypesRaw from './api/ApiTypes';
export * as VariablesRaw from './api/cloud/VariablesApi';
export * as IdmConfigRaw from './api/IdmConfigApi';

// Ops Layer
export * as Admin from './ops/AdminOps';
export * as AdminFederation from './ops/cloud/AdminFederationOps';
export * as Agent from './ops/AgentOps';
export * as Authenticate from './ops/AuthenticateOps';
export * as CirclesOfTrust from './ops/CirclesOfTrustOps';
export * as ConnectionProfile from './ops/ConnectionProfileOps';
export * as EmailTemplate from './ops/EmailTemplateOps';
export * as Idp from './ops/IdpOps';
export * as Idm from './ops/IdmOps';
export * as Info from './ops/InfoOps';
export * as Journey from './ops/JourneyOps';
export * as Jose from './ops/JoseOps';
export * as Log from './ops/cloud/LogOps';
export * as ManagedObject from './ops/ManagedObjectOps';
export * as Node from './ops/NodeOps';
export * as OAuth2Client from './ops/OAuth2ClientOps';
export * as OAuth2Provider from './ops/OAuth2ProviderOps';
export * as Organization from './ops/OrganizationOps';
export * as Policy from './ops/PolicyOps';
export * as PolicySet from './ops/PolicySetOps';
export * as Realm from './ops/RealmOps';
export * as ResourceType from './ops/ResourceTypeOps';
export * as Saml2 from './ops/Saml2Ops';
export * as Script from './ops/ScriptOps';
export * as Service from './ops/ServiceOps';
export * as Secrets from './ops/cloud/SecretsOps';
export * as ServiceAccount from './ops/cloud/ServiceAccountOps';
export * as Startup from './ops/cloud/StartupOps';
export * as Theme from './ops/ThemeOps';
export * as Types from './ops/OpsTypes';
export * as Variables from './ops/cloud/VariablesOps';
// TODO: revisit if there are better ways
export * as Utils from './ops/utils/OpsUtils';
export * as Base64 from './api/utils/Base64';
export * as ValidationUtils from './ops/utils/ValidationUtils';
export * as LibVersion from './ops/utils/Version';
export * as ExportImportUtils from './ops/utils/ExportImportUtils';
// TODO: reconsider the aproach to pass in state from client
// lib should be stateless, an aplication should own its state
export * as state from './shared/State';
export * as constants from './storage/StaticStorage';
