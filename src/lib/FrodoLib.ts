// instantiable modules
import AdminOps, { Admin } from '../ops/AdminOps';
import AgentOps, { Agent } from '../ops/AgentOps';
import ApplicationOps, { Application } from '../ops/ApplicationOps';
import AuthenticateOps, { Authenticate } from '../ops/AuthenticateOps';
import AuthenticationSettingsOps, {
  AuthenticationSettings,
} from '../ops/AuthenticationSettingsOps';
import CirclesOfTrustOps, { CirclesOfTrust } from '../ops/CirclesOfTrustOps';
import AdminFederationOps, {
  AdminFederation,
} from '../ops/cloud/AdminFederationOps';
import FeatureOps, { Feature } from '../ops/cloud/FeatureOps';
import LogOps, { Log } from '../ops/cloud/LogOps';
import SecretsOps, { Secret } from '../ops/cloud/SecretsOps';
import ServiceAccountOps, {
  ServiceAccount,
} from '../ops/cloud/ServiceAccountOps';
import StartupOps, { Startup } from '../ops/cloud/StartupOps';
import VariablesOps, { Variable } from '../ops/cloud/VariablesOps';
import ConnectionProfileOps, {
  ConnectionProfile,
} from '../ops/ConnectionProfileOps';
import ConnectorOps, { Connector } from '../ops/ConnectorOps';
import EmailTemplateOps, { EmailTemplate } from '../ops/EmailTemplateOps';
import IdmConfigOps, { IdmConfig } from '../ops/IdmConfigOps';
import IdmSystemOps, { IdmSystem } from '../ops/IdmSystemOps';
import IdpOps, { Idp } from '../ops/IdpOps';
import InfoOps, { Info } from '../ops/InfoOps';
import JoseOps, { Jose } from '../ops/JoseOps';
import JourneyOps, { Journey } from '../ops/JourneyOps';
import ManagedObjectOps, { ManagedObject } from '../ops/ManagedObjectOps';
import MappingOps, { Mapping } from '../ops/MappingOps';
import NodeOps, { Node } from '../ops/NodeOps';
import OAuth2ClientOps, { OAuth2Client } from '../ops/OAuth2ClientOps';
import OAuth2OidcOps, { OAuth2Oidc } from '../ops/OAuth2OidcOps';
import OAuth2ProviderOps, { OAuth2Provider } from '../ops/OAuth2ProviderOps';
import OrganizationOps, { Organization } from '../ops/OrganizationOps';
import PolicyOps, { Policy } from '../ops/PolicyOps';
import PolicySetOps, { PolicySet } from '../ops/PolicySetOps';
import RealmOps, { Realm } from '../ops/RealmOps';
import ReconOps, { Recon } from '../ops/ReconOps';
import ResourceTypeOps, { ResourceType } from '../ops/ResourceTypeOps';
import Saml2Ops, { Saml2 } from '../ops/Saml2Ops';
import ScriptOps, { Script } from '../ops/ScriptOps';
import ServiceOps, { Service } from '../ops/ServiceOps';
import ThemeOps, { Theme } from '../ops/ThemeOps';
import TokenCacheOps, { TokenCache } from '../ops/TokenCacheOps';
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

  cloud: {
    adminFed: AdminFederation;
    feature: Feature;
    log: Log;
    secret: Secret;
    serviceAccount: ServiceAccount;
    startup: Startup;
    variable: Variable;
  };

  conn: ConnectionProfile;
  cache: TokenCache;

  email: {
    template: EmailTemplate;
  };

  idm: {
    config: IdmConfig;
    connector: Connector;
    managed: ManagedObject;
    mapping: Mapping;
    organization: Organization;
    recon: Recon;
    system: IdmSystem;
  };

  info: Info;
  login: Authenticate;

  oauth2oidc: {
    client: OAuth2Client;
    endpoint: OAuth2Oidc;
    external: Idp;
    provider: OAuth2Provider;
  };

  realm: Realm;

  saml2: {
    circlesOfTrust: CirclesOfTrust;
    entityProvider: Saml2;
  };

  script: Script;
  service: Service;

  theme: Theme;

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
    serviceAccountId: string,
    serviceAccountJwkStr: string,
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
      adminFed: AdminFederationOps(state),
      feature: FeatureOps(state),
      log: LogOps(state),
      secret: SecretsOps(state),
      serviceAccount: ServiceAccountOps(state),
      startup: StartupOps(state),
      variable: VariablesOps(state),
    },

    conn: ConnectionProfileOps(state),
    cache: TokenCacheOps(state),

    email: {
      template: EmailTemplateOps(state),
    },

    idm: {
      config: IdmConfigOps(state),
      connector: ConnectorOps(state),
      managed: ManagedObjectOps(state),
      mapping: MappingOps(state),
      organization: OrganizationOps(state),
      recon: ReconOps(state),
      system: IdmSystemOps(state),
    },

    info: InfoOps(state),
    login: AuthenticateOps(state),

    oauth2oidc: {
      client: OAuth2ClientOps(state),
      endpoint: OAuth2OidcOps(state),
      external: IdpOps(state),
      provider: OAuth2ProviderOps(state),
    },

    realm: RealmOps(state),

    saml2: {
      circlesOfTrust: CirclesOfTrustOps(state),
      entityProvider: Saml2Ops(state),
    },

    script: ScriptOps(state),
    service: ServiceOps(state),

    theme: ThemeOps(state),

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
