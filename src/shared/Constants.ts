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
  RETRY_NOTHING_KEY: string;
  RETRY_EVERYTHING_KEY: string;
  RETRY_NETWORK_KEY: string;
  RETRY_STRATEGIES: string[];
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
const DEFAULT_AMSTER_SERVICE = 'amsterService';
const DEFAULT_CLASSIC_USERNAME = 'amadmin';
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

  AmFullScope: 'fr:am:*', //                                                All Access Management APIs

  AutoAccessFullScope: 'fr:autoaccess:*', //                                All Auto Access APIs

  AnalyticsFullScope: 'fr:idc:analytics:*', //                              All Analytics APIs

  CertificateFullScope: 'fr:idc:certificate:*', //                          All TLS certificate APIs

  CertificateReadScope: 'fr:idc:certificate:read', //                       Read TLS certificates

  ContentSecurityPolicyFullScope: 'fr:idc:content-security-policy:*', //    All content security policy APIs
  ContentSecurityPolicyReadScope: 'fr:idc:content-security-policy:read', // Read content security policy

  CookieDomainsFullScope: 'fr:idc:cookie-domain:*', //                      All cookie domain APIs
  CookieDomainsReadScope: 'fr:idc:cookie-domain:read', //                   Read cookie domain APIs

  CustomDomainFullScope: 'fr:idc:custom-domain:*', //                       All custom domain APIs
  CustomDomainReadScope: 'fr:idc:custom-domain:read', //                    Read custom domain configuration

  DatasetDeletionFullScope: 'fr:idc:dataset:*', //                          All dataset deletion APIs
  DatasetDeletionReadScope: 'fr:idc:dataset:read', //                       Read dataset deletion configuration

  ESVFullScope: 'fr:idc:esv:*', //                                          All ESV APIs
  ESVReadScope: 'fr:idc:esv:read', //                                       Read ESVs, excluding values of secrets
  ESVUpdateScope: 'fr:idc:esv:update', //                                   Create, modify, and delete ESVs
  ESVRestartScope: 'fr:idc:esv:restart', //                                 Restart workloads that consume ESVs

  AdminFederationFullScope: 'fr:idc:federation:*', //                       Create, modify, and delete Admin Federation configuration
  AdminFederationReadScope: 'fr:idc:federation:read', //                    Read Admin Federation configuration

  MTLSFullScope: 'fr:idc:mtls:*', //                                        All mTLS APIs

  PromotionScope: 'fr:idc:promotion:*', //                                  All configuration promotion APIs
  PromotionReadScope: 'fr:idc:promotion:read', //                           Read configuration promotion configuration

  ProxyConnectFullScope: 'fr:idc:proxy-connect:*', //                       All Proxy Connect APIs
  ProxyConnectReadScope: 'fr:idc:proxy-connect:read', //                    Read Proxy Connect configuration
  ProxyConnectWriteScope: 'fr:idc:proxy-connect:write', //                  Create and update Proxy Connect configuration

  ReleaseFullScope: 'fr:idc:release:*', //                                  All product release APIs
  ReleaseReadScope: 'fr:idc:release:read', //                               Read product release information

  SSOCookieFullScope: 'fr:idc:sso-cookie:*', //                             All SSO cookie APIs
  SSOCookieReadScope: 'fr:idc:sso-cookie:read', //                          Read SSO cookie configuration

  WSFedAdminScope: 'fr:idc:ws:admin', //                                    All PingFederate APIs

  IdmFullScope: 'fr:idm:*', //                                              All Identity Management APIs

  IGAFullScope: 'fr:iga:*', //                                              All Governance APIs
};

const RETRY_EVERYTHING_KEY = 'everything';
const RETRY_NETWORK_KEY = 'network';
const RETRY_NOTHING_KEY = 'nothing';
const RETRY_STRATEGIES = [
  RETRY_NOTHING_KEY,
  RETRY_EVERYTHING_KEY,
  RETRY_NETWORK_KEY,
];

export default {
  DEFAULT_REALM_KEY,
  CLASSIC_DEPLOYMENT_TYPE_KEY,
  CLOUD_DEPLOYMENT_TYPE_KEY,
  FORGEOPS_DEPLOYMENT_TYPE_KEY,
  DEPLOYMENT_TYPES,
  DEPLOYMENT_TYPE_REALM_MAP,
  DEFAULT_AMSTER_SERVICE,
  DEFAULT_CLASSIC_USERNAME,
  FRODO_METADATA_ID,
  FRODO_CONNECTION_PROFILES_PATH_KEY,
  FRODO_MASTER_KEY_PATH_KEY,
  FRODO_MASTER_KEY_KEY,
  FRODO_TOKEN_CACHE_PATH_KEY,
  AVAILABLE_SCOPES,
  RETRY_NOTHING_KEY,
  RETRY_EVERYTHING_KEY,
  RETRY_NETWORK_KEY,
  RETRY_STRATEGIES,
};
