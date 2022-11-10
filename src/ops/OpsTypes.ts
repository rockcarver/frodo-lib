import {
  AgentSkeleton,
  CircleOfTrustSkeleton,
  EmailTemplateSkeleton,
  NodeSkeleton,
  Saml2ProviderSkeleton,
  ScriptSkeleton,
  SocialIdpSkeleton,
  ThemeSkeleton,
  TreeSkeleton,
} from '../api/ApiTypes';

/**
 * Tree export options
 */
export interface TreeExportOptions {
  /**
   * Where applicable, use string arrays to store multi-line text (e.g. scripts).
   */
  useStringArrays: boolean;
  /**
   * Include any dependencies (scripts, email templates, SAML entity providers and circles of trust, social identity providers, themes).
   */
  deps: boolean;
}

/**
 * Tree import options
 */
export interface TreeImportOptions {
  /**
   * Generate new UUIDs for all nodes during import.
   */
  reUuid: boolean;
  /**
   * Include any dependencies (scripts, email templates, SAML entity providers and circles of trust, social identity providers, themes).
   */
  deps: boolean;
}

export interface ExportMetaData {
  origin: string;
  originAmVersion: string;
  exportedBy: string;
  exportDate: string;
  exportTool: string;
  exportToolVersion: string;
}

export interface SingleTreeExportInterface {
  meta?: Record<string, ExportMetaData>;
  innerNodes?: Record<string, NodeSkeleton>;
  innernodes?: Record<string, NodeSkeleton>;
  nodes: Record<string, NodeSkeleton>;
  scripts: Record<string, ScriptSkeleton>;
  emailTemplates: Record<string, EmailTemplateSkeleton>;
  socialIdentityProviders: Record<string, SocialIdpSkeleton>;
  themes: ThemeSkeleton[];
  saml2Entities: Record<string, Saml2ProviderSkeleton>;
  circlesOfTrust: Record<string, CircleOfTrustSkeleton>;
  tree: TreeSkeleton;
}

export interface MultiTreeExportInterface {
  meta?: Record<string, ExportMetaData>;
  trees: Record<string, SingleTreeExportInterface>;
}

export interface AgentExportInterface {
  meta?: Record<string, ExportMetaData>;
  agents: Record<string, AgentSkeleton>;
}

export interface TreeDependencyMapInterface {
  [k: string]: TreeDependencyMapInterface[];
}

export interface TreeExportResolverInterface {
  (treeId: string): Promise<SingleTreeExportInterface>;
}

export enum NodeClassification {
  STANDARD = 'standard',
  CUSTOM = 'custom',
  CLOUD = 'cloud',
  PREMIUM = 'premium',
}

export enum JourneyClassification {
  STANDARD = 'standard',
  CUSTOM = 'custom',
  CLOUD = 'cloud',
  PREMIUM = 'premium',
}
