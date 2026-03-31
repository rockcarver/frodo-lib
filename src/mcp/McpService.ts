/**
 * Composes MCP capability inventory, policy filtering, manifest generation, and
 * runtime execution into one launch-ready service object.
 *
 * @remarks
 * This module is intentionally transport-agnostic. It prepares all data and
 * execution hooks required by both stdio and HTTP MCP transports, while leaving
 * actual transport wiring to higher layers.
 */

import { Frodo, frodo } from '../lib/FrodoLib';
import {
  McpCapabilityDescriptor,
  McpCapabilityInventoryOptions,
  McpCapabilityPolicy,
  McpCapabilityPolicyPresetName,
} from './CapabilityTypes';
import { MCP_POLICY_PRESETS, applyCapabilityPolicy } from './CapabilityPolicy';
import { buildCapabilityInventory } from './CapabilityRegistry';
import { buildToolManifest, McpToolManifest } from './ToolManifest';
import {
  createToolRuntime,
  McpToolExecutionRequest,
  McpToolExecutionResult,
  McpToolRuntime,
  McpToolRuntimeOptions,
} from './ToolRuntime';

/**
 * Lightweight tool metadata surface suitable for MCP tool registration calls.
 */
export type McpServiceToolDefinition = {
  /** Stable tool name exposed to MCP clients. */
  name: string;
  /** Human-readable tool description. */
  description: string;
  /** Optional MCP annotation hints for tool selection behavior. */
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
};

/**
 * Options for constructing an MCP service instance.
 */
export type McpServiceOptions = {
  /**
   * Frodo instance to inspect and use as runtime factory root.
   * Defaults to the library singleton.
   */
  frodoInstance?: Frodo;
  /** Optional inventory-scoping controls (domains, utils visibility). */
  inventoryOptions?: McpCapabilityInventoryOptions;
  /** Built-in policy preset to start from. Defaults to `standard`. */
  policyPreset?: McpCapabilityPolicyPresetName;
  /** Optional override fields merged on top of the selected preset. */
  policyOverride?: Partial<McpCapabilityPolicy>;
  /** Optional runtime customization hooks. */
  runtimeOptions?: Omit<McpToolRuntimeOptions, 'frodoRoot'>;
};

/**
 * Fully composed MCP service object.
 */
export type McpService = {
  /** Effective capability policy after preset + overrides are merged. */
  policy: McpCapabilityPolicy;
  /** Policy-filtered capabilities backing the current service. */
  capabilities: McpCapabilityDescriptor[];
  /** Reduced manifest consumed by transport registration code. */
  manifest: McpToolManifest;
  /** Runtime executor for tool calls. */
  runtime: McpToolRuntime;
  /**
   * Returns tool definition metadata for transport registration.
   *
   * @returns Flattened tool list including generic, special, and discovery.
   */
  listTools(): McpServiceToolDefinition[];
  /**
   * Executes one tool request.
   *
   * @param request Tool execution request envelope.
   * @returns Tool execution result envelope.
   */
  executeTool(
    request: McpToolExecutionRequest
  ): Promise<McpToolExecutionResult>;
};

/**
 * Merges a built-in policy preset with caller-provided overrides.
 *
 * @param presetName Built-in preset key.
 * @param override Optional override object.
 * @returns Effective policy object.
 */
export function composeCapabilityPolicy(
  presetName: McpCapabilityPolicyPresetName,
  override?: Partial<McpCapabilityPolicy>
): McpCapabilityPolicy {
  const preset = MCP_POLICY_PRESETS[presetName];
  return {
    ...preset,
    ...override,
    name: override?.name || preset.name,
  };
}

/**
 * Builds an MCP service from Frodo capabilities and policy configuration.
 *
 * @param options Service construction options.
 * @returns Composed service object with manifest and runtime hooks.
 */
export function createMcpService(options: McpServiceOptions = {}): McpService {
  const frodoInstance = options.frodoInstance ?? frodo;
  const policy = composeCapabilityPolicy(
    options.policyPreset ?? 'standard',
    options.policyOverride
  );
  const inventory = buildCapabilityInventory(
    frodoInstance,
    options.inventoryOptions
  );
  const capabilities = applyCapabilityPolicy(inventory, policy);
  const manifest = buildToolManifest(capabilities);
  const runtime = createToolRuntime(manifest, capabilities, {
    frodoRoot: frodoInstance,
    ...options.runtimeOptions,
  });

  /**
   * Flattens manifest entries into simple tool definitions for transport
   * registration APIs.
   *
   * @returns Tool definition list.
   */
  const listTools = (): McpServiceToolDefinition[] => {
    const genericDefinitions = manifest.genericTools.map((tool) => ({
      name: tool.toolName,
      description: tool.description,
      annotations: tool.annotations,
    }));
    const specialDefinitions = manifest.specialTools.map((tool) => ({
      name: tool.toolName,
      description: tool.description,
      annotations: tool.descriptor.annotations,
    }));
    const discoveryDefinition: McpServiceToolDefinition = {
      name: manifest.discoveryTool.toolName,
      description: manifest.discoveryTool.description,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    };
    return [
      ...genericDefinitions,
      ...specialDefinitions,
      discoveryDefinition,
    ].sort((a, b) => a.name.localeCompare(b.name));
  };

  return {
    policy,
    capabilities,
    manifest,
    runtime,
    listTools,
    executeTool: (request) => runtime.executeTool(request),
  };
}
