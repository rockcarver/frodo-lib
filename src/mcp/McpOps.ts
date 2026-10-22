import type { Frodo } from '../lib/FrodoLib';
import { MCP_POLICY_PRESETS } from './CapabilityPolicy';
import { buildCapabilityInventory } from './CapabilityRegistry';
import type {
  McpCapabilityDescriptor,
  McpCapabilityInventoryOptions,
} from './CapabilityTypes';
import { hydrateMcpDiscoveryContext } from './DiscoveryHydration';
import type { McpDiscoveryHydrationOptions } from './DiscoveryHydration';
import { createMcpService } from './McpService';
import type { McpServiceOptions } from './McpService';
import { listMcpProfiles, resolveMcpProfileSelection } from './ProfileRegistry';
import type { McpProfileName } from './ProfileRegistry';
import { getRealmFromContext, resolveRequestScopedFrodo } from './ToolRuntime';
import type { McpRuntimeRequestContext } from './ToolRuntime';

export type Mcp = {
  createService(
    options?: Omit<McpServiceOptions, 'frodoInstance'>
  ): ReturnType<typeof createMcpService>;
  hydrateDiscoveryContext(
    options?: Omit<McpDiscoveryHydrationOptions, 'frodoInstance'>
  ): ReturnType<typeof hydrateMcpDiscoveryContext>;
  buildCapabilityInventory(
    options?: McpCapabilityInventoryOptions
  ): McpCapabilityDescriptor[];
  listProfiles(): ReturnType<typeof listMcpProfiles>;
  resolveProfileSelection(
    name: McpProfileName
  ): ReturnType<typeof resolveMcpProfileSelection>;
  policyPresets: typeof MCP_POLICY_PRESETS;
  resolveRequestScopedFrodo(requestContext: McpRuntimeRequestContext): Frodo;
  getRealmFromContext(context: McpRuntimeRequestContext): string | undefined;
};

export default (instance: Frodo): Mcp => ({
  createService: (options = {}) => createMcpService(instance, options),
  hydrateDiscoveryContext: (options = {}) =>
    hydrateMcpDiscoveryContext(instance, options),
  buildCapabilityInventory: (options = {}) =>
    buildCapabilityInventory(instance, options),
  listProfiles: () => listMcpProfiles(),
  resolveProfileSelection: (name) => resolveMcpProfileSelection(name),
  policyPresets: MCP_POLICY_PRESETS,
  resolveRequestScopedFrodo: (requestContext) =>
    resolveRequestScopedFrodo(requestContext, instance),
  getRealmFromContext: (context) => getRealmFromContext(context),
});
