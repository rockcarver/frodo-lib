import State, { StateInterface } from '../shared/State';

import * as Admin from '../ops/AdminOps';
import * as Agent from '../ops/AgentOps';
import AuthenticateOps from '../ops/AuthenticateOps';
import * as CirclesOfTrust from '../ops/CirclesOfTrustOps';
import ConnectionProfileOps from '../ops/ConnectionProfileOps';
import FeatureOps from '../ops/cloud/FeatureOps';
import * as EmailTemplate from '../ops/EmailTemplateOps';
import * as Idp from '../ops/IdpOps';
import * as Idm from '../ops/IdmOps';
import InfoOps from '../ops/InfoOps';
import * as Journey from '../ops/JourneyOps';
import * as Jose from '../ops/JoseOps';
import LogOps from '../ops/cloud/LogOps';
import * as ManagedObject from '../ops/ManagedObjectOps';
import * as Node from '../ops/NodeOps';
import * as OAuth2Client from '../ops/OAuth2ClientOps';
import * as OAuth2Provider from '../ops/OAuth2ProviderOps';
import * as Organization from '../ops/OrganizationOps';
import * as Policy from '../ops/PolicyOps';
import * as PolicySet from '../ops/PolicySetOps';
import * as Realm from '../ops/RealmOps';
import * as ResourceType from '../ops/ResourceTypeOps';
import * as Saml2 from '../ops/Saml2Ops';
import * as Script from '../ops/ScriptOps';
import * as Service from '../ops/ServiceOps';
import Secrets from '../ops/cloud/SecretsOps';
import ServiceAccount from '../ops/cloud/ServiceAccountOps';
import Startup from '../ops/cloud/StartupOps';
import * as Theme from '../ops/ThemeOps';
import * as Types from '../ops/OpsTypes';
import Variables from '../ops/cloud/VariablesOps';
// TODO: revisit if there are better ways
import * as Utils from '../ops/utils/OpsUtils';
import * as Base64 from '../api/utils/Base64';
import * as ValidationUtils from '../ops/utils/ValidationUtils';
import * as LibVersion from '../ops/utils/Version';
import * as ExportImportUtils from '../ops/utils/ExportImportUtils';
import * as constants from '../storage/StaticStorage';

export class FrodoLib {
  state: State;

  constructor(config: StateInterface = {}) {
    this.state = new State(config);

    // initialize all the modules needing state
    this.authn = new AuthenticateOps(this.state);
    this.cloud.feature = new FeatureOps(this.state);
    this.cloud.log = new LogOps(this.state);
    this.cloud.secret = new Secrets(this.state);
    this.cloud.serviceAccount = new ServiceAccount(this.state);
    this.cloud.startup = new Startup(this.state);
    this.cloud.variable = new Variables(this.state);
    this.conn = new ConnectionProfileOps(this.state);
    this.info = new InfoOps(this.state);
  }

  Admin = Admin;
  Agent = Agent;
  authn: AuthenticateOps;
  authz = {
    Policy: Policy,
    PolicySet: PolicySet,
    ResourceType: ResourceType,
  };
  cloud: {
    feature: FeatureOps;
    log: LogOps;
    secret: Secrets;
    serviceAccount: ServiceAccount;
    startup: Startup;
    variable: Variables;
  };
  conn: ConnectionProfileOps;
  EmailTemplate = EmailTemplate;
  Helpers = {
    Utils: Utils,
    Base64: Base64,
    ValidationUtils: ValidationUtils,
    LibVersion: LibVersion,
    ExportImportUtils: ExportImportUtils,
    constants: constants,
  };
  Idp = Idp;
  Idm = Idm;
  info: InfoOps;
  Journey = Journey;
  Jose = Jose;
  ManagedObject = ManagedObject;
  Node = Node;
  OAuth2Client = OAuth2Client;
  OAuth2Provider = OAuth2Provider;
  Organization = Organization;
  Realm = Realm;
  Saml2 = {
    EntityProvider: Saml2,
    CirclesOfTrust: CirclesOfTrust,
  };
  Script = Script;
  Service = Service;
  Theme = Theme;
  Types = Types;
}

export const frodo = new FrodoLib();
export const globalState = frodo.state;
// frodo.Admin.repairOrgModel(false, true, true);
// frodo.Cloud.Log.tail('', '');
// frodo.Info.getInfo();
// frodo.Saml2.EntityProvider.deleteRawSaml2Provider('');
// frodo.Authz.Policy.exportPolicy('');
// frodo.authn.getTokens();
