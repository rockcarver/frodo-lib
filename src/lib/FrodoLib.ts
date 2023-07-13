// instantiable modules
import StateImpl, { State, StateInterface } from '../shared/State';
import AdminFederationOps, {
  AdminFederation,
} from '../ops/cloud/AdminFederationOps';
import AdminOps, { Admin } from '../ops/AdminOps';
import AgentOps, { Agent } from '../ops/AgentOps';
import AuthenticateOps, { Authenticate } from '../ops/AuthenticateOps';
import CirclesOfTrustOps, { CirclesOfTrust } from '../ops/CirclesOfTrustOps';
import ConnectionProfileOps, {
  ConnectionProfile,
} from '../ops/ConnectionProfileOps';
import EmailTemplateOps, { EmailTemplate } from '../ops/EmailTemplateOps';
import ExportImportUtils, {
  ExportImport,
} from '../ops/utils/ExportImportUtils';
import FeatureOps, { Feature } from '../ops/cloud/FeatureOps';
import IdmOps, { Idm } from '../ops/IdmOps';
import IdpOps, { Idp } from '../ops/IdpOps';
import InfoOps, { Info } from '../ops/InfoOps';
import JoseOps, { Jose } from '../ops/JoseOps';
import JourneyOps, { Journey } from '../ops/JourneyOps';
import LogOps, { Log } from '../ops/cloud/LogOps';
import ManagedObjectOps, { ManagedObject } from '../ops/ManagedObjectOps';
import NodeOps, { Node } from '../ops/NodeOps';
import OAuth2ClientOps, { OAuth2Client } from '../ops/OAuth2ClientOps';
import OAuth2OidcOps, { OAuth2Oidc } from '../ops/OAuth2OidcOps';
import OAuth2ProviderOps, { OAuth2Provider } from '../ops/OAuth2ProviderOps';
import OpsUtils, { Utils } from '../ops/utils/OpsUtils';
import OrganizationOps, { Organization } from '../ops/OrganizationOps';
import PolicyOps, { Policy } from '../ops/PolicyOps';
import PolicySetOps, { PolicySet } from '../ops/PolicySetOps';
import RealmOps, { Realm } from '../ops/RealmOps';
import ResourceTypeOps, { ResourceType } from '../ops/ResourceTypeOps';
import Saml2Ops, { Saml2 } from '../ops/Saml2Ops';
import ScriptOps, { Script } from '../ops/ScriptOps';
import ScriptValidationUtils, {
  ScriptValidation,
} from '../ops/utils/ScriptValidationUtils';
import ServiceOps, { Service } from '../ops/ServiceOps';
import SecretsOps, { Secret } from '../ops/cloud/SecretsOps';
import ServiceAccountOps, {
  ServiceAccount,
} from '../ops/cloud/ServiceAccountOps';
import StartupOps, { Startup } from '../ops/cloud/StartupOps';
import ThemeOps, { Theme } from '../ops/ThemeOps';
import VariablesOps, { Variable } from '../ops/cloud/VariablesOps';
import VersionUtils, { Version } from '../ops/utils/VersionUtils';

// non-instantiable modules
import ConstantsImpl, { Constants } from '../shared/Constants';

/**
 * Frodo Library
 */
export type Frodo = {
  state: State;
  admin: Admin;
  agent: Agent;

  authn: {
    journey: Journey;
    node: Node;
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

  email: {
    template: EmailTemplate;
  };

  idm: {
    config: Idm;
    managed: ManagedObject;
    organization: Organization;
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

  utils: Utils & {
    constants: Constants;
    impex: ExportImport;
    jose: Jose;
    script: ScriptValidation;
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

    authn: {
      journey: JourneyOps(state),
      node: NodeOps(state),
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

    email: {
      template: EmailTemplateOps(state),
    },

    idm: {
      config: IdmOps(state),
      managed: ManagedObjectOps(state),
      organization: OrganizationOps(state),
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
      ...OpsUtils(state),
      constants: ConstantsImpl,
      impex: ExportImportUtils(state),
      jose: JoseOps(state),
      script: ScriptValidationUtils(state),
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

export { frodo, state, FrodoLib };

export default FrodoLib;
