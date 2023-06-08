// instantiable modules
import State, { StateInterface } from '../shared/State';
import AdminOps from '../ops/AdminOps';
import AgentOps from '../ops/AgentOps';
import AuthenticateOps from '../ops/AuthenticateOps';
import CirclesOfTrustOps from '../ops/CirclesOfTrustOps';
import ConnectionProfileOps from '../ops/ConnectionProfileOps';
import EmailTemplateOps from '../ops/EmailTemplateOps';
import FeatureOps from '../ops/cloud/FeatureOps';
import IdmOps from '../ops/IdmOps';
import IdpOps from '../ops/IdpOps';
import InfoOps from '../ops/InfoOps';
import JourneyOps from '../ops/JourneyOps';
import LogOps from '../ops/cloud/LogOps';
import ManagedObjectOps from '../ops/ManagedObjectOps';
import NodeOps from '../ops/NodeOps';
import OAuth2ClientOps from '../ops/OAuth2ClientOps';
import OAuth2ProviderOps from '../ops/OAuth2ProviderOps';
import OrganizationOps from '../ops/OrganizationOps';
import PolicyOps from '../ops/PolicyOps';
import PolicySetOps from '../ops/PolicySetOps';
import RealmOps from '../ops/RealmOps';
import ResourceTypeOps from '../ops/ResourceTypeOps';
import Saml2Ops from '../ops/Saml2Ops';
import ScriptOps from '../ops/ScriptOps';
import ServiceOps from '../ops/ServiceOps';
import SecretsOps from '../ops/cloud/SecretsOps';
import ServiceAccountOps from '../ops/cloud/ServiceAccountOps';
import StartupOps from '../ops/cloud/StartupOps';
import ThemeOps from '../ops/ThemeOps';
import VariablesOps from '../ops/cloud/VariablesOps';

// non-instantiable modules
import * as JoseOps from '../ops/JoseOps';
import * as OpsUtils from '../ops/utils/OpsUtils';
import * as Base64 from '../api/utils/Base64';
import * as ScriptValidationUtils from '../ops/utils/ScriptValidationUtils';
import * as Version from '../ops/utils/Version';
import * as ExportImportUtils from '../ops/utils/ExportImportUtils';
import * as constants from '../storage/StaticStorage';

export class FrodoLib {
  state: State;
  admin: AdminOps;
  agent: AgentOps;
  authn: {
    journey: JourneyOps;
    node: NodeOps;
  } = { journey: undefined, node: undefined };
  authz: {
    policy: PolicyOps;
    policySet: PolicySetOps;
    resourceType: ResourceTypeOps;
  } = { policy: undefined, policySet: undefined, resourceType: undefined };
  cloud: {
    feature: FeatureOps;
    log: LogOps;
    secret: SecretsOps;
    serviceAccount: ServiceAccountOps;
    startup: StartupOps;
    variable: VariablesOps;
  } = {
    feature: undefined,
    log: undefined,
    secret: undefined,
    serviceAccount: undefined,
    startup: undefined,
    variable: undefined,
  };
  conn: ConnectionProfileOps;
  email: { template: EmailTemplateOps } = { template: undefined };
  helpers = {
    jose: JoseOps,
    utils: OpsUtils,
    base64: Base64,
    script: ScriptValidationUtils,
    version: Version,
    exportImportUtils: ExportImportUtils,
    constants: constants,
  };
  idm: {
    config: IdmOps;
    managed: ManagedObjectOps;
    organization: OrganizationOps;
  } = { config: undefined, managed: undefined, organization: undefined };
  info: InfoOps;
  login: AuthenticateOps = null;
  oauth2oidc: {
    client: OAuth2ClientOps;
    external: IdpOps;
    provider: OAuth2ProviderOps;
  } = { client: undefined, external: undefined, provider: undefined };
  realm: RealmOps;
  saml2: {
    circlesOfTrust: CirclesOfTrustOps;
    entityProvider: Saml2Ops;
  } = { circlesOfTrust: undefined, entityProvider: undefined };
  script: ScriptOps;
  service: ServiceOps;
  theme: ThemeOps;

  constructor(config: StateInterface = {}) {
    this.state = new State(config);

    this.admin = new AdminOps(this.state);
    this.agent = new AgentOps(this.state);

    this.authn.journey = new JourneyOps(this.state);
    this.authn.node = new NodeOps(this.state);

    this.authz.policy = new PolicyOps(this.state);
    this.authz.policySet = new PolicySetOps(this.state);
    this.authz.resourceType = new ResourceTypeOps(this.state);

    this.cloud.feature = new FeatureOps(this.state);
    this.cloud.log = new LogOps(this.state);
    this.cloud.secret = new SecretsOps(this.state);
    this.cloud.serviceAccount = new ServiceAccountOps(this.state);
    this.cloud.startup = new StartupOps(this.state);
    this.cloud.variable = new VariablesOps(this.state);

    this.conn = new ConnectionProfileOps(this.state);

    this.email.template = new EmailTemplateOps(this.state);

    this.idm.config = new IdmOps(this.state);
    this.idm.managed = new ManagedObjectOps(this.state);
    this.idm.organization = new OrganizationOps(this.state);

    this.info = new InfoOps(this.state);
    this.login = new AuthenticateOps(this.state);

    this.oauth2oidc.client = new OAuth2ClientOps(this.state);
    this.oauth2oidc.external = new IdpOps(this.state);
    this.oauth2oidc.provider = new OAuth2ProviderOps(this.state);

    this.realm = new RealmOps(this.state);

    this.saml2.circlesOfTrust = new CirclesOfTrustOps(this.state);
    this.saml2.entityProvider = new Saml2Ops(this.state);

    this.script = new ScriptOps(this.state);
    this.service = new ServiceOps(this.state);

    this.theme = new ThemeOps(this.state);
  }
}

export const frodo = new FrodoLib();
export const globalState = frodo.state;
