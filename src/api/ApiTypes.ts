export interface NoIdObjectSkeletonInterface {
  _rev?: number;
  [k: string]:
    | string
    | number
    | boolean
    | string[]
    | IdObjectSkeletonInterface
    | object
    | null;
}

export interface IdObjectSkeletonInterface extends NoIdObjectSkeletonInterface {
  _id: string;
}

export interface PagedResults {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any[];
  resultCount: number;
  pagedResultsCookie: string;
  totalPagedResultsPolicy: string;
  totalPagedResults: number;
  remainingPagedResults: number;
}

export interface UiConfigInterface {
  categories: string;
}

export interface NodeRefSkeletonInterface {
  connections: Record<string, string>;
  displayName: string;
  nodeType: string;
  x: number;
  y: number;
}

export interface InnerNodeRefSkeletonInterface {
  _id: string;
  displayName: string;
  nodeType: string;
}

export type TreeSkeleton = IdObjectSkeletonInterface & {
  entryNodeId: string;
  nodes: Record<string, NodeRefSkeletonInterface>;
  identityResource?: string;
  uiConfig?: UiConfigInterface;
  enabled?: boolean;
};

export type AmServiceType = IdObjectSkeletonInterface & {
  name: string;
};

export type NodeSkeleton = IdObjectSkeletonInterface & {
  _type: AmServiceType;
  nodes?: InnerNodeRefSkeletonInterface[];
  tree?: string;
  identityResource?: string;
};

export type SocialIdpSkeleton = IdObjectSkeletonInterface & {
  _type: AmServiceType;
  enabled: boolean;
};

export type PolicySetSkeleton = NoIdObjectSkeletonInterface & {
  name: string;
  resourceTypeUuids: string[];
};

export type ResourceTypeSkeleton = NoIdObjectSkeletonInterface & {
  uuid: string;
  name: string;
};

export enum PolicyConditionType {
  Script = 'Script',
  AMIdentityMembership = 'AMIdentityMembership',
  IPv6 = 'IPv6',
  IPv4 = 'IPv4',
  SimpleTime = 'SimpleTime',
  LEAuthLevel = 'LEAuthLevel',
  LDAPFilter = 'LDAPFilter',
  AuthScheme = 'AuthScheme',
  Session = 'Session',
  AND = 'AND',
  AuthenticateToRealm = 'AuthenticateToRealm',
  ResourceEnvIP = 'ResourceEnvIP',
  Policy = 'Policy',
  OAuth2Scope = 'OAuth2Scope',
  SessionProperty = 'SessionProperty',
  OR = 'OR',
  Transaction = 'Transaction',
  NOT = 'NOT',
  AuthLevel = 'AuthLevel',
  AuthenticateToService = 'AuthenticateToService',
}

export type PolicyCondition = NoIdObjectSkeletonInterface & {
  type: keyof typeof PolicyConditionType;
  condition?: PolicyCondition;
  conditions?: PolicyCondition[];
};

export type PolicySkeleton = IdObjectSkeletonInterface & {
  name: string;
  applicationName: string;
  condition?: PolicyCondition;
  resourceTypeUuid: string;
};

export type OAuth2ClientSkeleton = IdObjectSkeletonInterface & {
  overrideOAuth2ClientConfig?: {
    [k: string]: string | number | boolean | string[] | object | null;
  };
  advancedOAuth2ClientConfig?: {
    descriptions: {
      inherited: boolean;
      value: string[];
    };
    [k: string]: string | number | boolean | string[] | object | null;
  };
  signEncOAuth2ClientConfig?: {
    [k: string]: string | number | boolean | string[] | object | null;
  };
  coreOpenIDClientConfig?: {
    [k: string]: string | number | boolean | string[] | object | null;
  };
  coreOAuth2ClientConfig?: {
    userpassword?: null;
    clientName?: {
      inherited: boolean;
      value: string[];
    };
    accessTokenLifetime?: {
      inherited: boolean;
      value: number;
    };
    [k: string]: string | number | boolean | string[] | object | null;
  };
  coreUmaClientConfig?: {
    [k: string]: string | number | boolean | string[] | object | null;
  };
  _type: AmServiceType;
};

export type AmServiceSkeleton = IdObjectSkeletonInterface & {
  _type: AmServiceType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type AgentSkeleton = IdObjectSkeletonInterface & {
  _type: AmServiceType;
};

export type EmailTemplateSkeleton = IdObjectSkeletonInterface & {
  defaultLocale?: string;
  displayName?: string;
  enabled?: boolean;
  from: string;
  subject: Record<string, string>;
  message?: Record<string, string>;
  html?: Record<string, string>;
};

export type ThemeSkeleton = IdObjectSkeletonInterface & {
  name: string;
  isDefault: boolean;
  linkedTrees: string[];
};

export type UiThemeRealmObject = IdObjectSkeletonInterface & {
  name: string;
  realm: Map<string, ThemeSkeleton[]>;
};

export enum ScriptLanguage {
  GROOVY,
  JAVASCRIPT,
}

export enum ScriptContext {
  OAUTH2_ACCESS_TOKEN_MODIFICATION,
  AUTHENTICATION_CLIENT_SIDE,
  AUTHENTICATION_TREE_DECISION_NODE,
  AUTHENTICATION_SERVER_SIDE,
  SOCIAL_IDP_PROFILE_TRANSFORMATION,
  OAUTH2_VALIDATE_SCOPE,
  CONFIG_PROVIDER_NODE,
  OAUTH2_AUTHORIZE_ENDPOINT_DATA_PROVIDER,
  OAUTH2_EVALUATE_SCOPE,
  POLICY_CONDITION,
  OIDC_CLAIMS,
  SAML2_IDP_ADAPTER,
  SAML2_IDP_ATTRIBUTE_MAPPER,
  OAUTH2_MAY_ACT,
}

export type ScriptSkeleton = IdObjectSkeletonInterface & {
  name: string;
  description: string;
  default: boolean;
  script: string | string[];
  language: keyof typeof ScriptLanguage;
  context: keyof typeof ScriptContext;
  createdBy: string;
  creationDate: number;
  lastModifiedBy: string;
  lastModifiedDate: number;
};

export enum Saml2ProiderLocation {
  HOSTED = 'hosted',
  REMOTE = 'remote',
}

export type Saml2ProviderStub = IdObjectSkeletonInterface & {
  entityId: string;
  location: Saml2ProiderLocation;
  roles: string[];
};

export type Saml2ProviderSkeleton = IdObjectSkeletonInterface & {
  entityId: string;
  entityLocation: Saml2ProiderLocation;
  serviceProvider: unknown;
  identityProvider: unknown;
  attributeQueryProvider: unknown;
  xacmlPolicyEnforcementPoint: unknown;
};

export type CircleOfTrustSkeleton = IdObjectSkeletonInterface & {
  _type: AmServiceType;
  status: string;
  trustedProviders: string[];
};

export type PagedResult<Result> = {
  result: Result[];
  resultCount: number;
  pagedResultsCookie: string;
  totalPagedResultsPolicy: 'EXACT';
  totalPagedResults: number;
  remainingPagedResults: number;
};

export type LogApiKey = {
  name: string;
  api_key_id: string;
  created_at: string;
};

export type LogEventPayloadSkeleton = NoIdObjectSkeletonInterface & {
  context: string;
  level: string;
  logger: string;
  mdc: {
    transactionId: string;
  };
  message: string;
  thread: string;
  timestamp: string;
  transactionId: string;
};

export type LogEventSkeleton = NoIdObjectSkeletonInterface & {
  payload: string | LogEventPayloadSkeleton;
  timestamp: string;
  type: string;
  source: string;
};
