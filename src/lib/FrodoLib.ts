// instantiable modules
import State, { StateInterface } from '../shared/State';
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
import * as Constants from '../shared/Constants';

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
    constants: typeof Constants;
    impex: ExportImport;
    jose: Jose;
    script: ScriptValidation;
    version: Version;
  };
};

export default (config: StateInterface = {}): Frodo => {
  const state = new State(config);
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
      constants: Constants,
      impex: ExportImportUtils(state),
      jose: JoseOps(state),
      script: ScriptValidationUtils(state),
      version: VersionUtils(state),
    },
  };
};
