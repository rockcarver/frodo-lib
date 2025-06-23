// instantiable modules
import AdminOps, { Admin } from '../ops/AdminOps';
import AgentOps, { Agent } from '../ops/AgentOps';
import AmConfigOps, { AmConfig } from '../ops/AmConfigOps';
import ApiOps, { ApiFactory } from '../ops/ApiFactoryOps';
import ApplicationOps, { Application } from '../ops/ApplicationOps';
import AuthenticateOps, { Authenticate } from '../ops/AuthenticateOps';
import AuthenticationSettingsOps, {
  AuthenticationSettings,
} from '../ops/AuthenticationSettingsOps';
import CirclesOfTrustOps, { CirclesOfTrust } from '../ops/CirclesOfTrustOps';
import SecretStoreOps, { SecretStore } from '../ops/classic/SecretStoreOps';
import ServerOps, { Server } from '../ops/classic/ServerOps';
import SiteOps, { Site } from '../ops/classic/SiteOps';
import AdminFederationOps, {
  AdminFederation,
} from '../ops/cloud/AdminFederationOps';
import EnvCertificatesOps, {
  EnvCertificate,
} from '../ops/cloud/EnvCertificatesOps';
import EnvContentSecurityOps, {
  EnvContentSecurityPolicy,
} from '../ops/cloud/EnvContentSecurityPolicyOps';
import EnvCookieDomainsOps, {
  EnvCookieDomains,
} from '../ops/cloud/EnvCookieDomainsOps';
import EnvCSRsOps, { EnvCSR } from '../ops/cloud/EnvCSRsOps';
import EnvCustomDomainsOps, {
  EnvCustomDomains,
} from '../ops/cloud/EnvCustomDomainsOps';
import EnvFederationEnforcementOps, {
  EnvFederationEnforcement,
} from '../ops/cloud/EnvFederationEnforcementOps';
import EnvPromotionOps, { EnvPromotion } from '../ops/cloud/EnvPromotionOps';
import EnvReleaseOps, { EnvRelease } from '../ops/cloud/EnvReleaseOps';
import EnvServiceAccountScopesOps, {
  EnvServiceAccountScopes,
} from '../ops/cloud/EnvServiceAccountScopesOps';
import EnvSSOCookieConfigOps, {
  EnvSSOCookieConfig,
} from '../ops/cloud/EnvSSOCookieConfigOps';
import EsvCountOps, { EsvCount } from '../ops/cloud/EsvCountOps';
import FeatureOps, { Feature } from '../ops/cloud/FeatureOps';
import LogOps, { Log } from '../ops/cloud/LogOps';
import SecretsOps, { Secret } from '../ops/cloud/SecretsOps';
import ServiceAccountOps, {
  ServiceAccount,
} from '../ops/cloud/ServiceAccountOps';
import StartupOps, { Startup } from '../ops/cloud/StartupOps';
import VariablesOps, { Variable } from '../ops/cloud/VariablesOps';
import ConfigOps, { Config } from '../ops/ConfigOps';
import ConnectionProfileOps, {
  ConnectionProfile,
} from '../ops/ConnectionProfileOps';
import ConnectorOps, { Connector } from '../ops/ConnectorOps';
import EmailTemplateOps, { EmailTemplate } from '../ops/EmailTemplateOps';
import FrConfigServiceObjectsOps, {
  FrConfigServiceObject,
} from '../ops/FrConfigServiceObjectsOps';
import IdmConfigOps, { IdmConfig } from '../ops/IdmConfigOps';
import IdmCryptoOps, { IdmCrypto } from '../ops/IdmCryptoOps';
import IdmScriptOps, { IdmScript } from '../ops/IdmScriptOps';
import IdmSystemOps, { IdmSystem } from '../ops/IdmSystemOps';
import IdpOps, { Idp } from '../ops/IdpOps';
import InfoOps, { Info } from '../ops/InfoOps';
import InternalRoleOps, { InternalRole } from '../ops/InternalRoleOps';
import JoseOps, { Jose } from '../ops/JoseOps';
import JourneyOps, { Journey } from '../ops/JourneyOps';
import ManagedObjectOps, { ManagedObject } from '../ops/ManagedObjectOps';
import MappingOps, { Mapping } from '../ops/MappingOps';
import NodeOps, { Node } from '../ops/NodeOps';
import OAuth2ClientOps, { OAuth2Client } from '../ops/OAuth2ClientOps';
import OAuth2OidcOps, { OAuth2Oidc } from '../ops/OAuth2OidcOps';
import OAuth2ProviderOps, { OAuth2Provider } from '../ops/OAuth2ProviderOps';
import OAuth2TrustedJwtIssuerOps, {
  OAuth2TrustedJwtIssuer,
} from '../ops/OAuth2TrustedJwtIssuerOps';
import OrganizationOps, { Organization } from '../ops/OrganizationOps';
import PolicyOps, { Policy } from '../ops/PolicyOps';
import PolicySetOps, { PolicySet } from '../ops/PolicySetOps';
import RawOps, { Raw } from '../ops/RawOps';
import RealmOps, { Realm } from '../ops/RealmOps';
import ReconOps, { Recon } from '../ops/ReconOps';
import ResourceTypeOps, { ResourceType } from '../ops/ResourceTypeOps';
import Saml2Ops, { Saml2 } from '../ops/Saml2Ops';
import ScriptOps, { Script } from '../ops/ScriptOps';
import ScriptTypeOps, { ScriptType } from '../ops/ScriptTypeOps';
import ServiceOps, { Service } from '../ops/ServiceOps';
import SessionOps, { Session } from '../ops/SessionOps';
import TermsAndConditionsOps, { Terms } from '../ops/TermsAndConditionsOps';
import ThemeOps, { Theme } from '../ops/ThemeOps';
import TokenCacheOps, { TokenCache } from '../ops/TokenCacheOps';
import UserOps, { User } from '../ops/UserOps';
import VersionUtils, { Version } from '../ops/VersionUtils';
// non-instantiable modules
import ConstantsImpl, { Constants } from '../shared/Constants';
import StateImpl, { State, StateInterface } from '../shared/State';
import Base64Utils, { Base64 } from '../utils/Base64Utils';
import ExportImportUtils, { ExportImport } from '../utils/ExportImportUtils';
import ForgeRockUtils, { FRUtils } from '../utils/ForgeRockUtils';
import JsonUtils, { Json } from '../utils/JsonUtils';
import ScriptValidationUtils, {
  ScriptValidation,
} from '../utils/ScriptValidationUtils';

/**
 * Frodo Library
 */
export type Frodo = {
  state: State;
  admin: Admin;
  agent: Agent;

  am: {
    config: AmConfig;
  };

  app: Application;

  authn: {
    journey: Journey;
    node: Node;
    settings: AuthenticationSettings;
  };

  authz: {
    policy: Policy;
    policySet: PolicySet;
    resourceType: ResourceType;
  };

  cloud: EsvCount & {
    adminFed: AdminFederation;
    env: EnvContentSecurityPolicy &
      EnvCookieDomains &
      EnvCustomDomains &
      EnvFederationEnforcement &
      EnvRelease &
      EnvServiceAccountScopes &
      EnvSSOCookieConfig & {
        cert: EnvCertificate;
        csr: EnvCSR;
        promotion: EnvPromotion;
      };
    /**
     * @deprecated since v2.0.4 use {@link frodo.cloud.getEsvCount | frodo.cloud.getEsvCount} instead
     */
    esvCount: EsvCount;
    feature: Feature;
    log: Log;
    secret: Secret;
    serviceAccount: ServiceAccount;
    startup: Startup;
    variable: Variable;
  };

  config: Config;
  conn: ConnectionProfile;
  cache: TokenCache;

  email: {
    template: EmailTemplate;
  };

  factory: ApiFactory;

  idm: {
    config: IdmConfig;
    connector: Connector;
    crypto: IdmCrypto;
    managed: ManagedObject;
    mapping: Mapping;
    organization: Organization;
    recon: Recon;
    script: IdmScript;
    system: IdmSystem;
  };

  info: Info;
  login: Authenticate;

  oauth2oidc: {
    client: OAuth2Client;
    endpoint: OAuth2Oidc;
    external: Idp;
    provider: OAuth2Provider;
    issuer: OAuth2TrustedJwtIssuer;
  };

  raw: Raw;

  realm: Realm;

  role: InternalRole;

  saml2: {
    circlesOfTrust: CirclesOfTrust;
    entityProvider: Saml2;
  };

  script: Script;
  scriptType: ScriptType;
  server: Server;
  secretStore: SecretStore;
  service: Service;
  serviceObject: FrConfigServiceObject;
  session: Session;
  site: Site;

  theme: Theme;

  terms: Terms;

  user: User;

  utils: FRUtils &
    ScriptValidation &
    ExportImport &
    Base64 & {
      constants: Constants;
      jose: Jose;
      json: Json;
      version: Version;
    };

  /**
   * Create a new frodo instance
   * @param {StateInterface} config Initial state configuration to use with the new instance
   * @returns {Frodo} frodo instance
   */
  createInstance(config: StateInterface): Frodo;

  /**
   * Factory helper to create a frodo instance ready for logging in with an admin user account
   * @param {string} host host base URL, e.g. 'https://openam-my-tenant.forgeblocks.com/am'
   * @param {string} username admin account username
   * @param {string} password admin account password
   * @param {string} realm (optional) override default realm
   * @param {string} deploymentType (optional) override deployment type ('cloud', 'forgeops', or 'classic')
   * @param {boolean} allowInsecureConnection (optional) allow insecure connection
   * @param {boolean} debug (optional) enable debug output
   * @param {boolean} curlirize (optional) enable output of all library REST calls as curl commands
   * @returns {Frodo} frodo instance
   */
  createInstanceWithAdminAccount(
    host: string,
    username: string,
    password: string,
    realm?: string,
    deploymentType?: string,
    allowInsecureConnection?: boolean,
    debug?: boolean,
    curlirize?: boolean
  ): Frodo;

  /**
   * Factory helper to create a frodo instance ready for logging in with a service account
   * @param {string} host host base URL, e.g. 'https://openam-my-tenant.forgeblocks.com/am'
   * @param {string} serviceAccountId service account uuid
   * @param {string} serviceAccountJwkStr service account JWK as stringified JSON
   * @param {string} realm (optional) override default realm
   * @param {string} deploymentType (optional) override deployment type ('cloud', 'forgeops', or 'classic')
   * @param {boolean} allowInsecureConnection (optional) allow insecure connection
   * @param {boolean} debug (optional) enable debug output
   * @param {boolean} curlirize (optional) enable output of all library REST calls as curl commands
   * @returns {Frodo} frodo instance
   */
  createInstanceWithServiceAccount(
    host: string,
    serviceAccountId: string,
    serviceAccountJwkStr: string,
    realm?: string,
    deploymentType?: string,
    allowInsecureConnection?: boolean,
    debug?: boolean,
    curlirize?: boolean
  ): Frodo;
};

/**
 * Create a new frodo instance
 * @param {StateInterface} config Initial state configuration to use with the new instance
 * @returns {Frodo} frodo instance
 */
const FrodoLib = (config: StateInterface = {}): Frodo => {
  const state = StateImpl(config);
  return {
    state: state,
    admin: AdminOps(state),
    agent: AgentOps(state),

    am: {
      config: AmConfigOps(state),
    },

    app: ApplicationOps(state),

    authn: {
      journey: JourneyOps(state),
      node: NodeOps(state),
      settings: AuthenticationSettingsOps(state),
    },

    authz: {
      policy: PolicyOps(state),
      policySet: PolicySetOps(state),
      resourceType: ResourceTypeOps(state),
    },

    cloud: {
      ...EsvCountOps(state),
      adminFed: AdminFederationOps(state),
      env: {
        ...EnvContentSecurityOps(state),
        ...EnvCookieDomainsOps(state),
        ...EnvCustomDomainsOps(state),
        ...EnvFederationEnforcementOps(state),
        ...EnvReleaseOps(state),
        ...EnvServiceAccountScopesOps(state),
        ...EnvSSOCookieConfigOps(state),
        cert: EnvCertificatesOps(state),
        csr: EnvCSRsOps(state),
        promotion: EnvPromotionOps(state),
      },
      esvCount: EsvCountOps(state),
      feature: FeatureOps(state),
      log: LogOps(state),
      secret: SecretsOps(state),
      serviceAccount: ServiceAccountOps(state),
      startup: StartupOps(state),
      variable: VariablesOps(state),
    },

    config: ConfigOps(state),
    conn: ConnectionProfileOps(state),
    cache: TokenCacheOps(state),

    email: {
      template: EmailTemplateOps(state),
    },

    factory: ApiOps(state),

    idm: {
      config: IdmConfigOps(state),
      connector: ConnectorOps(state),
      crypto: IdmCryptoOps(state),
      managed: ManagedObjectOps(state),
      mapping: MappingOps(state),
      organization: OrganizationOps(state),
      recon: ReconOps(state),
      script: IdmScriptOps(state),
      system: IdmSystemOps(state),
    },

    info: InfoOps(state),
    login: AuthenticateOps(state),

    oauth2oidc: {
      client: OAuth2ClientOps(state),
      endpoint: OAuth2OidcOps(state),
      external: IdpOps(state),
      provider: OAuth2ProviderOps(state),
      issuer: OAuth2TrustedJwtIssuerOps(state),
    },

    raw: RawOps(state),

    realm: RealmOps(state),

    role: InternalRoleOps(state),

    saml2: {
      circlesOfTrust: CirclesOfTrustOps(state),
      entityProvider: Saml2Ops(state),
    },

    script: ScriptOps(state),
    scriptType: ScriptTypeOps(state),
    server: ServerOps(state),
    secretStore: SecretStoreOps(state),
    service: ServiceOps(state),
    serviceObject: FrConfigServiceObjectsOps(state),
    session: SessionOps(state),
    site: SiteOps(state),

    theme: ThemeOps(state),

    terms: TermsAndConditionsOps(state),

    user: UserOps(state),

    utils: {
      ...ForgeRockUtils(state),
      ...ScriptValidationUtils(state),
      ...ExportImportUtils(state),
      ...Base64Utils(),
      constants: ConstantsImpl,
      jose: JoseOps(state),
      json: JsonUtils(),
      version: VersionUtils(state),
    },

    createInstance,
    createInstanceWithAdminAccount,
    createInstanceWithServiceAccount,
  };
};

function createInstance(config: StateInterface): Frodo {
  const frodo = FrodoLib(config);
  return frodo;
}

function createInstanceWithServiceAccount(
  host: string,
  serviceAccountId: string,
  serviceAccountJwkStr: string,
  realm: string = undefined,
  deploymentType: string = undefined,
  allowInsecureConnection = false,
  debug = false,
  curlirize = false
): Frodo {
  const config: StateInterface = {
    host,
    serviceAccountId,
    serviceAccountJwk: JSON.parse(serviceAccountJwkStr),
    realm,
    deploymentType,
    allowInsecureConnection,
    debug,
    curlirize,
  };
  const frodo = FrodoLib(config);
  return frodo;
}

function createInstanceWithAdminAccount(
  host: string,
  username: string,
  password: string,
  realm: string = undefined,
  deploymentType: string = undefined,
  allowInsecureConnection = false,
  debug = false,
  curlirize = false
): Frodo {
  const config: StateInterface = {
    host,
    username,
    password,
    realm,
    deploymentType,
    allowInsecureConnection,
    debug,
    curlirize,
  };
  const frodo = FrodoLib(config);
  return frodo;
}

/**
 * Default frodo instance
 *
 * @remarks
 *
 * If your application requires a single connection to a ForgeRock Identity Platform
 * instance at a time, then this default instance is all you need:
 *
 * In order to use the default {@link Frodo | frodo} instance, you must populate its {@link State | state} with the
 * minimum required information to login to your ForgeRock Identity Platform instance:
 *
 * ```javascript
 * // configure the state before invoking any library functions that require credentials
 * state.setHost('https://instance0/am');
 * state.setUsername('admin');
 * state.setPassword('p@ssw0rd!');
 *
 * // now the library can login
 * frodo.login.getTokens();
 *
 * // and perform operations
 * frodo.authn.journey.exportJourney('Login');
 * ```
 *
 * If your application needs to connect to multiple ForgeRock Identity Platform instances
 * simultaneously, then you will want to create additional frodo instances using any of
 * the available factory methods accessible from the default instance:
 *
 * {@link frodo.createInstance}
 * ```javascript
 * // use factory method to create a new Frodo instance
 * const instance1 = frodo.createInstance({
 *    host: 'https://instance1/am',
 *    username: 'admin',
 *    password: 'p@ssw0rd!',
 * });
 *
 * // now the instance can login
 * instance1.login.getTokens();
 *
 * // and perform operations
 * instance1.authn.journey.exportJourney('Login');
 * ```
 *
 * {@link frodo.createInstanceWithAdminAccount}
 * ```javascript
 * // use factory method to create a new Frodo instance ready to login with an admin user account
 * const instance2 = frodo.createInstanceWithAdminAccount(
 *   'https://instance2/am',
 *   'admin',
 *   'p@ssw0rd!'
 * );
 *
 * // now the instance can login
 * instance2.login.getTokens();
 *
 * // and perform operations
 * instance2.authn.journey.exportJourney('Login');
 * ```
 *
 * {@link frodo.createInstanceWithServiceAccount}
 * ```javascript
 * // use factory method to create a new Frodo instance ready to login with a service account
 * const instance3 = frodo.createInstanceWithServiceAccount(
 *   'https://instance3/am',
 *   'serviceAccount',
 *   '{"k":"jwk"}'
 * );
 *
 * // now the instance can login
 * instance3.login.getTokens();
 *
 * // and perform operations
 * instance3.authn.journey.exportJourney('Login');
 * ```
 */
const frodo = FrodoLib();

/**
 * Default state instance
 *
 * @remarks
 *
 * {@link Frodo} maintains a {@link State | state} for each instance. The state is where Frodo gets configuration
 * information from like host to connecto to, username and password to use, whether to
 * allow insecure connections or not, etc. As the library operates, it updates its state.
 *
 * The default frodo instance contains an empty state instance by default. In order to
 * use the default frodo instance, you must populate its state with the minimum required
 * information to login to your ForgeRock Identity Platform instance:
 *
 * ```javascript
 * // configure the state before invoking any library functions that require credentials
 * state.setHost('https://instance0/am');
 * state.setUsername('admin');
 * state.setPassword('p@ssw0rd!');
 *
 * // now the library can login
 * frodo.login.getTokens();
 *
 * // and perform operations
 * frodo.authn.journey.exportJourney('Login');
 * ```
 */
const state = frodo.state;

export { frodo, FrodoLib, state };

export default FrodoLib;
