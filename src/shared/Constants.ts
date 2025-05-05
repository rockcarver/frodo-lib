export type Constants = {
  DEFAULT_REALM_KEY: string;
  CLASSIC_DEPLOYMENT_TYPE_KEY: string;
  CLOUD_DEPLOYMENT_TYPE_KEY: string;
  FORGEOPS_DEPLOYMENT_TYPE_KEY: string;
  IDM_DEPLOYMENT_TYPE_KEY : string;
  DEPLOYMENT_TYPES: string[];
  DEPLOYMENT_TYPE_REALM_MAP: {
    classic: string;
    cloud: string;
    forgeops: string;
    idm: string;
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
const IDM_DEPLOYMENT_TYPE_KEY  =  'idm'
const DEPLOYMENT_TYPES = [
  CLASSIC_DEPLOYMENT_TYPE_KEY,
  CLOUD_DEPLOYMENT_TYPE_KEY,
  FORGEOPS_DEPLOYMENT_TYPE_KEY,
  IDM_DEPLOYMENT_TYPE_KEY,
];
const DEPLOYMENT_TYPE_REALM_MAP = {
  [CLASSIC_DEPLOYMENT_TYPE_KEY]: '/',
  [CLOUD_DEPLOYMENT_TYPE_KEY]: 'alpha',
  [FORGEOPS_DEPLOYMENT_TYPE_KEY]: '/',
  [IDM_DEPLOYMENT_TYPE_KEY]: '/',
};
const FRODO_METADATA_ID = 'frodo';
const FRODO_CONNECTION_PROFILES_PATH_KEY = 'FRODO_CONNECTION_PROFILES_PATH';
const FRODO_MASTER_KEY_PATH_KEY = 'FRODO_MASTER_KEY_PATH';
const FRODO_MASTER_KEY_KEY = 'FRODO_MASTER_KEY';
const FRODO_TOKEN_CACHE_PATH_KEY = 'FRODO_TOKEN_CACHE_PATH';
const AVAILABLE_SCOPES = {
  // AMIntrospectRealmTokenScope lets you introspect scopes _from the same realm_, there is a separate scope to introspect tokens from _all_ realms
  AMIntrospectRealmTokenScope: 'am-introspect-all-tokens',

  // Special AM scopes (used by resource servers)
  AMIntrospectAllTokens: 'am-introspect-all-tokens',
  AMIntrospectAllTokensAnyRealm: 'am-introspect-all-tokens-any-realm',

  OpenIdScope: 'openid',
  ProfileScope: 'profile',

  // All Access Management APIs
  AmFullScope: 'fr:am:*',

  // All Auto Access APIs
  AutoAccessFullScope: 'fr:autoaccess:*',

  // All Analytics APIs
  AnalyticsFullScope: 'fr:idc:analytics:*',

  // All TLS certificate APIs
  CertificateFullScope: 'fr:idc:certificate:*',

  // Read TLS certificates
  CertificateReadScope: 'fr:idc:certificate:read',

  // All content security policy APIs
  ContentSecurityPolicyFullScope: 'fr:idc:content-security-policy:*',

  // All cookie domain APIs
  CookieDomainsFullScope: 'fr:idc:cookie-domain:*',

  // All custom domain APIs
  CustomDomainFullScope: 'fr:idc:custom-domain:*',

  // All dataset deletion APIs
  DatasetDeletionFullScope: 'fr:idc:dataset:*',

  // All ESV APIs
  ESVFullScope: 'fr:idc:esv:*',

  // Read ESVs, excluding values of secrets
  ESVReadScope: 'fr:idc:esv:read',

  // Create, modify, and delete ESVs
  ESVUpdateScope: 'fr:idc:esv:update',

  // Restart workloads that consume ESVs
  ESVRestartScope: 'fr:idc:esv:restart',

  // Create, modify, and delete Admin Federation configuration
  AdminFederationFullScope: 'fr:idc:federation:*',

  // Read Admin Federation configuration
  AdminFederationReadScope: 'fr:idc:federation:read',

  // All mTLS APIs
  MTLSFullScope: 'fr:idc:mtls:*',

  // All configuration promotion APIs
  PromotionScope: 'fr:idc:promotion:*',

  // All Proxy Connect APIs
  ProxyConnectFullScope: 'fr:idc:proxy-connect:*',

  // Read Proxy Connect configuration
  ProxyConnectReadScope: 'fr:idc:proxy-connect:read',

  // Create and update Proxy Connect configuration
  ProxyConnectWriteScope: 'fr:idc:proxy-connect:write',

  // All product release APIs
  ReleaseFullScope: 'fr:idc:release:*',

  // All SSO cookie APIs
  SSOCookieFullScope: 'fr:idc:sso-cookie:*',

  // All Identity Management APIs
  IdmFullScope: 'fr:idm:*',

  // All Governance APIs
  IGAFullScope: 'fr:iga:*',
};

export default {
  DEFAULT_REALM_KEY,
  CLASSIC_DEPLOYMENT_TYPE_KEY,
  CLOUD_DEPLOYMENT_TYPE_KEY,
  FORGEOPS_DEPLOYMENT_TYPE_KEY,
  IDM_DEPLOYMENT_TYPE_KEY,
  DEPLOYMENT_TYPES,
  DEPLOYMENT_TYPE_REALM_MAP,
  FRODO_METADATA_ID,
  FRODO_CONNECTION_PROFILES_PATH_KEY,
  FRODO_MASTER_KEY_PATH_KEY,
  FRODO_MASTER_KEY_KEY,
  FRODO_TOKEN_CACHE_PATH_KEY,
  AVAILABLE_SCOPES,
};
