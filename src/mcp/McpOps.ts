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
    options?: McpServiceOptions
  ): ReturnType<typeof createMcpService>;
  hydrateDiscoveryContext(
    options?: McpDiscoveryHydrationOptions
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

export default (getInstance: () => Frodo): Mcp => ({
  createService: (options = {}) => createMcpService(getInstance(), options),
  hydrateDiscoveryContext: (options = {}) =>
    hydrateMcpDiscoveryContext(getInstance(), options),
  buildCapabilityInventory: (options = {}) =>
    buildCapabilityInventory(getInstance(), options),
  listProfiles: () => listMcpProfiles(),
  resolveProfileSelection: (name) => resolveMcpProfileSelection(name),
  policyPresets: MCP_POLICY_PRESETS,
  resolveRequestScopedFrodo: (requestContext) =>
    resolveRequestScopedFrodo(requestContext, getInstance()),
  getRealmFromContext: (context) => getRealmFromContext(context),
});
