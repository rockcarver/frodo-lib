/**
 * Verifies service-level MCP composition behavior.
 *
 * @remarks
 * These tests validate that preset policy composition, manifest flattening, and
 * runtime execution are correctly wired by `createMcpService`.
 */

import { jest } from '@jest/globals';

import {
  composeCapabilityPolicy,
  createMcpService,
  McpCapabilityDescriptor,
} from '../index';

/**
 * Builds a descriptor fixture for MCP service tests.
 *
 * @param overrides Optional descriptor overrides.
 * @returns Descriptor fixture.
 */
function makeDescriptor(
  overrides: Partial<McpCapabilityDescriptor> = {}
): McpCapabilityDescriptor {
  return {
    id: 'authn.journey.readJourney',
    toolName: 'frodo.authn.journey.readJourney',
    methodName: 'readJourney',
    modulePath: ['authn', 'journey'],
    domain: 'authn',
    objectType: 'Journey',
    operationType: 'read',
    kind: 'generic',
    riskClass: 'low',
    mutating: false,
    destructive: false,
    deploymentTypes: ['any'],
    requiredScopes: [],
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    ...overrides,
  };
}

describe('composeCapabilityPolicy', () => {
  test('merges override fields on top of preset', () => {
    const policy = composeCapabilityPolicy('read-only', {
      denyDomains: ['state'],
      name: 'read-only-custom',
    });

    expect(policy.name).toBe('read-only-custom');
    expect(policy.allowOperationTypes).toEqual([
      'count',
      'read',
      'search',
      'list',
    ]);
    expect(policy.includeSpecial).toBe(false);
    expect(policy.denyDomains).toEqual(['state']);
  });

  test('agentic preset excludes import and export operations', () => {
    const policy = composeCapabilityPolicy('agentic');

    expect(policy.name).toBe('agentic');
    expect(policy.allowOperationTypes).toEqual([
      'create',
      'count',
      'read',
      'update',
      'search',
      'list',
    ]);
    expect(policy.denyOperationTypes).toEqual(['delete', 'import', 'export']);
    expect(policy.includeSpecial).toBe(true);
  });
});

describe('createMcpService', () => {
  test('creates service with discovery tool in listTools output', () => {
    const service = createMcpService({
      inventoryOptions: { includeTopLevelDomains: ['authn'] },
      policyPreset: 'read-only',
    });

    const toolNames = service.listTools().map((tool) => tool.name);
    expect(toolNames).toContain('frodo_discover');
    expect(service.manifest.totalToolCount).toBeGreaterThanOrEqual(1);
  });

  test('executes generic tool using request-scoped state-config instance', async () => {
    const readJourney = jest.fn(async (journeyId: string) => ({
      id: journeyId,
      found: true,
    }));
    const scopedInstance = {
      login: { getTokens: jest.fn(async () => {}) },
      authn: {
        journey: {
          readJourney,
        },
      },
    };
    const rootInstance = {
      state: {},
      authn: {
        journey: {
          readJourney,
        },
      },
      createInstance: jest.fn().mockReturnValue(scopedInstance),
      createInstanceWithAdminAccount: jest.fn(),
      createInstanceWithServiceAccount: jest.fn(),
      createInstanceWithAmsterAccount: jest.fn(),
    } as any;

    const service = createMcpService({
      frodoInstance: rootInstance,
      policyPreset: 'read-only',
      inventoryOptions: {
        includeTopLevelDomains: ['authn'],
      },
    });

    const result = await service.executeTool({
      toolName: 'frodo_read',
      arguments: {
        domain: 'authn',
        objectType: 'Journey',
        positionalArgs: ['journey-123'],
      },
      context: {
        auth: {
          mode: 'state-config',
          config: { host: 'https://tenant.example/am' },
        },
      },
    });

    expect(rootInstance.createInstance).toHaveBeenCalledWith({
      host: 'https://tenant.example/am',
    });
    expect(readJourney).toHaveBeenCalledWith('journey-123');
    expect(result.descriptorId).toBe('authn.journey.readJourney');
    expect(result.data).toEqual({ id: 'journey-123', found: true });
  });

  test('listTools includes annotation hints for discovery and generic tools', () => {
    const service = createMcpService({
      inventoryOptions: { includeTopLevelDomains: ['authn'] },
      policyPreset: 'read-only',
    });

    const tools = service.listTools();
    const discovery = tools.find((tool) => tool.name === 'frodo_discover');
    expect(discovery).toBeDefined();
    expect(discovery?.annotations?.readOnlyHint).toBe(true);

    const generic = tools.find((tool) => tool.name.startsWith('frodo_'));
    expect(generic).toBeDefined();
    expect(generic?.description.length).toBeGreaterThan(0);
  });

  test('supports policyOverride to exclude authn domain', () => {
    const service = createMcpService({
      inventoryOptions: { includeTopLevelDomains: ['authn'] },
      policyPreset: 'read-only',
      policyOverride: {
        denyDomains: ['authn'],
      },
    });

    // Only discovery remains because all capabilities were filtered out.
    expect(service.manifest.backingDescriptorCount).toBe(0);
    expect(service.manifest.totalToolCount).toBe(1);
    expect(service.listTools()).toHaveLength(1);
    expect(service.listTools()[0].name).toBe('frodo_discover');
  });

  test('agentic policy does not expose import or export generic tools', () => {
    const service = createMcpService({
      inventoryOptions: { includeTopLevelDomains: ['authn'] },
      policyPreset: 'agentic',
    });

    const toolNames = service.listTools().map((tool) => tool.name);
    expect(toolNames).not.toContain('frodo_export');
    expect(toolNames).not.toContain('frodo_import');
    expect(toolNames).toContain('frodo_read');
  });

  test('builds from explicit descriptor fixture through custom runtime resolver', async () => {
    const descriptor = makeDescriptor();
    const readJourney = jest.fn(async () => ({ ok: true }));

    const service = createMcpService({
      frodoInstance: {
        state: {},
        authn: { journey: { readJourney } },
        createInstance: jest.fn(),
        createInstanceWithAdminAccount: jest.fn(),
        createInstanceWithServiceAccount: jest.fn(),
        createInstanceWithAmsterAccount: jest.fn(),
      } as any,
      policyPreset: 'admin',
      runtimeOptions: {
        resolveFrodoForRequest: async () =>
          ({
            login: { getTokens: jest.fn(async () => {}) },
            authn: {
              journey: {
                readJourney,
              },
            },
          }) as any,
      },
      inventoryOptions: {
        includeTopLevelDomains: ['authn'],
      },
    });

    const result = await service.executeTool({
      toolName: 'frodo_read',
      arguments: {
        domain: descriptor.domain,
        objectType: descriptor.objectType,
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(result.toolName).toBe('frodo_read');
    expect(result.data).toEqual({ ok: true });
  });
});
