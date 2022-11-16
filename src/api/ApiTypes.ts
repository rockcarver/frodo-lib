interface ObjectSkeletonInterface {
  _id: string;
  _rev?: number;
  [k: string]: string | number | boolean | string[] | ObjectSkeletonInterface;
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

export type TreeSkeleton = ObjectSkeletonInterface & {
  entryNodeId: string;
  nodes: Record<string, NodeRefSkeletonInterface>;
  identityResource?: string;
  uiConfig?: UiConfigInterface;
  enabled?: boolean;
};

export type AmServiceType = ObjectSkeletonInterface & {
  name: string;
};

export type NodeSkeleton = ObjectSkeletonInterface & {
  _type: AmServiceType;
  nodes?: InnerNodeRefSkeletonInterface[];
  tree?: string;
  identityResource?: string;
};

export type SocialIdpSkeleton = ObjectSkeletonInterface & {
  _type: AmServiceType;
  enabled: boolean;
};

export type AmServiceSkeleton = ObjectSkeletonInterface & {
  _type: AmServiceType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type AgentSkeleton = ObjectSkeletonInterface & {
  _type: AmServiceType;
};

export type EmailTemplateSkeleton = ObjectSkeletonInterface & {
  defaultLocale?: string;
  displayName?: string;
  enabled?: boolean;
  from: string;
  subject: Record<string, string>;
};

export type ThemeSkeleton = ObjectSkeletonInterface & {
  name: string;
  isDefault: boolean;
  linkedTrees: string[];
};

export type UiThemeRealmObject = ObjectSkeletonInterface & {
  name: string;
  realm: Map<string, ThemeSkeleton[]>;
};

export enum ScriptLanguage {
  GROOVY = 'GROOVY',
  JAVASCRIPT = 'JAVASCRIPT',
}

export enum ScriptContext {
  OAUTH2_ACCESS_TOKEN_MODIFICATION = 'OAUTH2_ACCESS_TOKEN_MODIFICATION',
  AUTHENTICATION_CLIENT_SIDE = 'AUTHENTICATION_CLIENT_SIDE',
  AUTHENTICATION_TREE_DECISION_NODE = 'AUTHENTICATION_TREE_DECISION_NODE',
  AUTHENTICATION_SERVER_SIDE = 'AUTHENTICATION_SERVER_SIDE',
  SOCIAL_IDP_PROFILE_TRANSFORMATION = 'SOCIAL_IDP_PROFILE_TRANSFORMATION',
  OAUTH2_VALIDATE_SCOPE = 'OAUTH2_VALIDATE_SCOPE',
  CONFIG_PROVIDER_NODE = 'CONFIG_PROVIDER_NODE',
  OAUTH2_AUTHORIZE_ENDPOINT_DATA_PROVIDER = 'OAUTH2_AUTHORIZE_ENDPOINT_DATA_PROVIDER',
  OAUTH2_EVALUATE_SCOPE = 'OAUTH2_EVALUATE_SCOPE',
  POLICY_CONDITION = 'POLICY_CONDITION',
  OIDC_CLAIMS = 'OIDC_CLAIMS',
  SAML2_IDP_ADAPTER = 'SAML2_IDP_ADAPTER',
  SAML2_IDP_ATTRIBUTE_MAPPER = 'SAML2_IDP_ATTRIBUTE_MAPPER',
  OAUTH2_MAY_ACT = 'OAUTH2_MAY_ACT',
}

export type ScriptSkeleton = ObjectSkeletonInterface & {
  name: string;
  description: string;
  isDefault: boolean;
  script: string;
  language: ScriptLanguage;
  context: ScriptContext;
  createdBy: string;
  creationDate: number;
  lastModifiedBy: string;
  lastModifiedDate: number;
};

export enum Saml2ProiderLocation {
  HOSTED = 'hosted',
  REMOTE = 'remote',
}

export type Saml2ProviderSkeleton = ObjectSkeletonInterface & {
  entityId: string;
  entityLocation: Saml2ProiderLocation;
  serviceProvider: unknown;
  identityProvider: unknown;
  attributeQueryProvider: unknown;
  xacmlPolicyEnforcementPoint: unknown;
};

export type CircleOfTrustSkeleton = ObjectSkeletonInterface & {
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
