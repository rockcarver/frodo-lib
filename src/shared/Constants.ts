export type Constants = {
  DEFAULT_REALM_KEY: string;
  CLASSIC_DEPLOYMENT_TYPE_KEY: string;
  CLOUD_DEPLOYMENT_TYPE_KEY: string;
  FORGEOPS_DEPLOYMENT_TYPE_KEY: string;
  DEPLOYMENT_TYPES: string[];
  DEPLOYMENT_TYPE_REALM_MAP: {
    classic: string;
    cloud: string;
    forgeops: string;
  };
  FRODO_METADATA_ID: string;
  FRODO_CONNECTION_PROFILES_PATH_KEY: string;
  FRODO_MASTER_KEY_PATH_KEY: string;
  FRODO_MASTER_KEY_KEY: string;
};
const DEFAULT_REALM_KEY = '__default__realm__';
const CLASSIC_DEPLOYMENT_TYPE_KEY = 'classic';
const CLOUD_DEPLOYMENT_TYPE_KEY = 'cloud';
const FORGEOPS_DEPLOYMENT_TYPE_KEY = 'forgeops';
const DEPLOYMENT_TYPES = [
  CLASSIC_DEPLOYMENT_TYPE_KEY,
  CLOUD_DEPLOYMENT_TYPE_KEY,
  FORGEOPS_DEPLOYMENT_TYPE_KEY,
];
const DEPLOYMENT_TYPE_REALM_MAP = {
  [CLASSIC_DEPLOYMENT_TYPE_KEY]: '/',
  [CLOUD_DEPLOYMENT_TYPE_KEY]: 'alpha',
  [FORGEOPS_DEPLOYMENT_TYPE_KEY]: '/',
};
const FRODO_METADATA_ID = 'frodo';
const FRODO_CONNECTION_PROFILES_PATH_KEY = 'FRODO_CONNECTION_PROFILES_PATH';
const FRODO_MASTER_KEY_PATH_KEY = 'FRODO_MASTER_KEY_PATH';
const FRODO_MASTER_KEY_KEY = 'FRODO_MASTER_KEY';
const FRODO_TOKEN_CACHE_PATH_KEY = 'FRODO_TOKEN_CACHE_PATH';
const AVAILABLE_SCOPES = {
  OpenIdScope: 'openid',
  ProfileScope: 'profile',
  AmFullScope: 'fr:am:*',
  IdmFullScope: 'fr:idm:*',
  AutoAccessFullScope: 'fr:autoaccess:*',
  AnalyticsFullScope: 'fr:idc:analytics:*',

  // AMIntrospectRealmTokenScope lets you introspect scopes _from the same realm_, there is a separate scope to introspect tokens from _all_ realms
  AMIntrospectRealmTokenScope: 'am-introspect-all-tokens',

  // Special AM scopes (used by resource servers)
  AMIntrospectAllTokens: 'am-introspect-all-tokens',
  AMIntrospectAllTokensAnyRealm: 'am-introspect-all-tokens-any-realm',

  // Certificate scopes
  CertificateFullScope: 'fr:idc:certificate:*',
  CertificateReadScope: 'fr:idc:certificate:read',

  // ESV API scopes
  ESVFullScope: 'fr:idc:esv:*',
  ESVReadScope: 'fr:idc:esv:read',
  ESVUpdateScope: 'fr:idc:esv:update',
  ESVRestartScope: 'fr:idc:esv:restart',

  // Content security policy scopes
  ContentSecurityPolicyFullScope: 'fr:idc:content-security-policy:*',

  // Federation scopes
  FederationFullScope: 'fr:idc:federation:*',
  FederationReadScope: 'fr:idc:federation:read',

  // Release scopes
  ReleaseFullScope: 'fr:idc:release:*',

  // SSOCookie scopes
  SSOCookieFullScope: 'fr:idc:sso-cookie:*',

  // CustomDomainFullScope Custom domain scopes
  CustomDomainFullScope: 'fr:idc:custom-domain:*',

  // Promotion scopes
  PromotionScope: 'fr:idc:promotion:*',

  // Cookie Domains scopes
  CookieDomainsFullScope: 'fr:idc:cookie-domain:*',

  // Admin Federation Enforcement
  FederationEnforcementFullScope: 'fr:idc:federation:*',
};

export default {
  DEFAULT_REALM_KEY,
  CLASSIC_DEPLOYMENT_TYPE_KEY,
  CLOUD_DEPLOYMENT_TYPE_KEY,
  FORGEOPS_DEPLOYMENT_TYPE_KEY,
  DEPLOYMENT_TYPES,
  DEPLOYMENT_TYPE_REALM_MAP,
  FRODO_METADATA_ID,
  FRODO_CONNECTION_PROFILES_PATH_KEY,
  FRODO_MASTER_KEY_PATH_KEY,
  FRODO_MASTER_KEY_KEY,
  FRODO_TOKEN_CACHE_PATH_KEY,
  AVAILABLE_SCOPES,
};
