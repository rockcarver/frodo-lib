import {
  AgentSkeleton,
  AmServiceSkeleton,
  CircleOfTrustSkeleton,
  EmailTemplateSkeleton,
  NodeSkeleton,
  Saml2ProviderSkeleton,
  ScriptSkeleton,
  SocialIdpSkeleton,
  ThemeSkeleton,
  TreeSkeleton,
} from '../api/ApiTypes';
import State from '../shared/State';

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
  meta?: ExportMetaData;
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
  meta?: ExportMetaData;
  trees: Record<string, SingleTreeExportInterface>;
}

export interface AgentExportInterface {
  meta?: Record<string, ExportMetaData>;
  agents: Record<string, AgentSkeleton>;
}

export interface CirclesOfTrustExportInterface {
  meta?: ExportMetaData;
  script: Record<string, ScriptSkeleton>;
  saml: {
    hosted: Record<string, Saml2ProviderSkeleton>;
    remote: Record<string, Saml2ProviderSkeleton>;
    metadata: Record<string, string[]>;
    cot: Record<string, CircleOfTrustSkeleton>;
  };
}

export interface Saml2ExportInterface {
  meta?: ExportMetaData;
  script: Record<string, ScriptSkeleton>;
  saml: {
    hosted: Record<string, Saml2ProviderSkeleton>;
    remote: Record<string, Saml2ProviderSkeleton>;
    metadata: Record<string, string[]>;
  };
}

export interface ServiceExportInterface {
  meta?: Record<string, ExportMetaData>;
  service: Record<string, AmServiceSkeleton>;
}

export interface TreeDependencyMapInterface {
  [k: string]: TreeDependencyMapInterface[];
}

export interface TreeExportResolverInterface {
  (treeId: string, state: State): Promise<SingleTreeExportInterface>;
}

export interface ScriptExportInterface {
  meta?: ExportMetaData;
  script: Record<string, ScriptSkeleton>;
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

export interface MultiOpStatusInterface {
  total: number;
  successes: number;
  warnings: number;
  failures: number;
  message?: string;
}
