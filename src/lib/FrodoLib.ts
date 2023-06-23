// instantiable modules
import State, { StateInterface } from '../shared/State';
import AdminFederationOps from '../ops/cloud/AdminFederationOps';
import AdminOps from '../ops/AdminOps';
import AgentOps from '../ops/AgentOps';
import AuthenticateOps from '../ops/AuthenticateOps';
import CirclesOfTrustOps from '../ops/CirclesOfTrustOps';
import ConnectionProfileOps from '../ops/ConnectionProfileOps';
import EmailTemplateOps from '../ops/EmailTemplateOps';
import ExportImportUtils from '../ops/utils/ExportImportUtils';
import FeatureOps from '../ops/cloud/FeatureOps';
import IdmOps from '../ops/IdmOps';
import IdpOps from '../ops/IdpOps';
import InfoOps from '../ops/InfoOps';
import JourneyOps from '../ops/JourneyOps';
import LogOps from '../ops/cloud/LogOps';
import ManagedObjectOps from '../ops/ManagedObjectOps';
import NodeOps from '../ops/NodeOps';
import OAuth2ClientOps from '../ops/OAuth2ClientOps';
import OAuth2OidcOps from '../ops/OAuth2OidcOps';
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
import Version from '../ops/utils/Version';

// non-instantiable modules
import * as jose from '../ops/JoseOps';
import * as utils from '../ops/utils/OpsUtils';
import * as base64 from '../api/utils/Base64';
import * as script from '../ops/utils/ScriptValidationUtils';
import * as constants from '../storage/StaticStorage';

export default (config: StateInterface = {}) => {
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

    helper: {
      base64,
      constants,
      jose,
      script,
      utils,
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
      impex: ExportImportUtils(state),
      version: Version(state),
    },
  };
};
