import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
);

export function getVersion() {
  return `v${pkg.version}`;
}

// Api Layer
export * as NodeRaw from './api/NodeApi';
export * as TreeRaw from './api/TreeApi';
export * as StartupRaw from './api/StartupApi';
export * as SecretsRaw from './api/SecretsApi';
export * as VariablesRaw from './api/VariablesApi';

// Ops Layer
export * as Admin from './ops/AdminOps';
export * as Authenticate from './ops/AuthenticateOps';
export * as CirclesOfTrust from './ops/CirclesOfTrustOps';
export * as ConnectionProfile from './ops/ConnectionProfileOps';
export * as EmailTemplate from './ops/EmailTemplateOps';
export * as Idm from './ops/IdmOps';
export * as Idp from './ops/IdpOps';
export * as Journey from './ops/JourneyOps';
export * as Log from './ops/LogOps';
export * as ManagedObject from './ops/ManagedObjectOps';
export * as OAuth2Client from './ops/OAuth2ClientOps';
export * as Organization from './ops/OrganizationOps';
export * as Realm from './ops/RealmOps';
export * as Saml from './ops/SamlOps';
export * as Script from './ops/ScriptOps';
export * as Secrets from './ops/SecretsOps';
export * as Startup from './ops/StartupOps';
export * as Theme from './ops/ThemeOps';
export * as Variables from './ops/VariablesOps';
// TODO: revisit if there are better ways
export * as Utils from './ops/utils/OpsUtils';
// TODO: reconsider the aproach to pass in state from client
// lib should be stateless, an aplication should own its state
export * as state from './storage/SessionStorage';
// TODO: need to figure out if this is the right approach or if we should even
// use a public oauth2/oidc library. might be ok for now since there is only
// one place where the cli needs to execute an oauth flow.
export * as OAuth2OIDCApi from './api/OAuth2OIDCApi';
