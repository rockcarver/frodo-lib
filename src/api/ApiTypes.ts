export interface NoIdObjectSkeletonInterface {
  _rev?: number;
  [k: string]:
    | string
    | number
    | boolean
    | string[]
    | IdObjectSkeletonInterface
    | object
    | undefined;
}

export interface IdObjectSkeletonInterface extends NoIdObjectSkeletonInterface {
  _id?: string;
}

// export interface PagedResults {
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   result: any[];
//   resultCount: number;
//   pagedResultsCookie: string;
//   totalPagedResultsPolicy: string;
//   totalPagedResults: number;
//   remainingPagedResults: number;
// }

export interface UiConfigInterface {
  categories: string;
}

export type AdminFederationConfigSkeleton = IdObjectSkeletonInterface & {
  groups: {
    claim: string;
    mappings: {
      'super-admins': string[];
      'tenant-admins': string[];
    };
  };
};

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

export type PolicyConditionType =
  | 'Script'
  | 'AMIdentityMembership'
  | 'IPv6'
  | 'IPv4'
  | 'SimpleTime'
  | 'LEAuthLevel'
  | 'LDAPFilter'
  | 'AuthScheme'
  | 'Session'
  | 'AND'
  | 'AuthenticateToRealm'
  | 'ResourceEnvIP'
  | 'Policy'
  | 'OAuth2Scope'
  | 'SessionProperty'
  | 'OR'
  | 'Transaction'
  | 'NOT'
  | 'AuthLevel'
  | 'AuthenticateToService';

export type PolicyCondition = NoIdObjectSkeletonInterface & {
  type: PolicyConditionType;
  condition?: PolicyCondition;
  conditions?: PolicyCondition[];
};

export type PolicySkeleton = IdObjectSkeletonInterface & {
  name: string;
  applicationName: string;
  condition?: PolicyCondition;
  resourceTypeUuid: string;
};

export type VersionOfSecretStatus = 'DISABLED' | 'ENABLED';

export type ReadableStrings = string[];

export type WritableStrings = {
  inherited: boolean;
  value: string[];
};

export type OAuth2ClientSkeleton = IdObjectSkeletonInterface & {
  overrideOAuth2ClientConfig?: {
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  advancedOAuth2ClientConfig?: {
    descriptions: {
      inherited: boolean;
      value: string[];
    };
    grantTypes?: ReadableStrings | WritableStrings;
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  signEncOAuth2ClientConfig?: {
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  coreOpenIDClientConfig?: {
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  coreOAuth2ClientConfig?: {
    userpassword?: string;
    clientName?: {
      inherited: boolean;
      value: string[];
    };
    accessTokenLifetime?: {
      inherited: boolean;
      value: number;
    };
    scopes?: ReadableStrings | WritableStrings;
    defaultScopes?: {
      value: string[];
      [k: string]: string | number | boolean | string[] | object | undefined;
    };
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  coreUmaClientConfig?: {
    [k: string]: string | number | boolean | string[] | object | undefined;
  };
  _type: AmServiceType;
};

export type AmServiceSkeleton = IdObjectSkeletonInterface & {
  _type: AmServiceType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface ServiceNextDescendentResponse {
  result: ServiceNextDescendent;
}

export interface ServiceNextDescendent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface FullService extends AmServiceSkeleton {
  nextDescendents?: ServiceNextDescendent[];
}

export type GatewayAgentType = 'IdentityGatewayAgent';
export type JavaAgentType = 'J2EEAgent';
export type WebAgentType = 'WebAgent';
export type AgentType = GatewayAgentType | JavaAgentType | WebAgentType;

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

export type ScriptLanguage = 'GROOVY' | 'JAVASCRIPT';

export type ScriptContext =
  | 'OAUTH2_ACCESS_TOKEN_MODIFICATION'
  | 'AUTHENTICATION_CLIENT_SIDE'
  | 'AUTHENTICATION_TREE_DECISION_NODE'
  | 'AUTHENTICATION_SERVER_SIDE'
  | 'SOCIAL_IDP_PROFILE_TRANSFORMATION'
  | 'OAUTH2_VALIDATE_SCOPE'
  | 'CONFIG_PROVIDER_NODE'
  | 'OAUTH2_AUTHORIZE_ENDPOINT_DATA_PROVIDER'
  | 'OAUTH2_EVALUATE_SCOPE'
  | 'POLICY_CONDITION'
  | 'OIDC_CLAIMS'
  | 'SAML2_IDP_ADAPTER'
  | 'SAML2_IDP_ATTRIBUTE_MAPPER'
  | 'OAUTH2_MAY_ACT';

export type ScriptSkeleton = IdObjectSkeletonInterface & {
  name: string;
  description: string;
  default: boolean;
  script: string | string[];
  language: ScriptLanguage;
  context: ScriptContext;
  createdBy: string;
  creationDate: number;
  lastModifiedBy: string;
  lastModifiedDate: number;
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
  api_key_secret?: string;
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
