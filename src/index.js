import fs from 'fs';

const pkg = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url))
);

export function getVersion() {
  return `v${pkg.version}`;
}

export * as Admin from './ops/AdminOps.js';
export * as Authenticate from './ops/AuthenticateOps.js';
export * as CirclesOfTrust from './ops/CirclesOfTrustOps.js';
export * as ConnectionProfile from './ops/ConnectionProfileOps.js';
export * as EmailTemplate from './ops/EmailTemplateOps.js';
export * as Idm from './ops/IdmOps.js';
export * as Idp from './ops/IdmOps.js';
export * as Journey from './ops/JourneyOps.js';
export * as Log from './ops/LogOps.js';
export * as ManagedObject from './ops/ManagedObjectOps.js';
export * as OAuth2Client from './ops/OAuth2ClientOps.js';
export * as Organization from './ops/OrganizationOps.js';
export * as Realm from './ops/RealmOps.js';
export * as Saml from './ops/SamlOps.js';
export * as Script from './ops/ScriptOps.js';
export * as Secrets from './ops/SecretsOps.js';
export * as Startup from './ops/StartupOps.js';
export * as Theme from './ops/ThemeOps.js';
export * as Variables from './ops/VariablesOps.js';
// TODO: revisit if there are better ways
export * as Utils from './ops/utils/OpsUtils.js';
// TODO: reconsider the aproach to pass in state from client
// lib should be stateless, an aplication should own its state
export * as state from './storage/SessionStorage.js';
// TODO: need to figure out if this is the right approach or if we should even
// use a public oauth2/oidc library. might be ok for now since there is only 
// one place where the cli needs to execute an oauth flow.
export * as OAuth2OIDCApi from './api/OAuth2OIDCApi.js';
