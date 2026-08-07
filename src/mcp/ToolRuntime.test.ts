/**
 * Focused end-to-end tests for canonical Hybrid MCP tools.
 */

import { jest } from '@jest/globals';

import {
  McpCapabilityDescriptor,
  McpToolManifest,
  createToolRuntime,
} from '../index';

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

function makeManifest(descriptors: McpCapabilityDescriptor[]): McpToolManifest {
  const readDescriptor = descriptors.find((d) => d.operationType === 'read');
  const updateDescriptor = descriptors.find(
    (d) => d.operationType === 'update'
  );

  return {
    canonicalTools: [
      {
        toolName: 'frodo_find_skills',
        description: 'Find skills',
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      {
        toolName: 'frodo_describe_skill',
        description: 'Describe skill',
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      {
        toolName: 'frodo_dispatch_read_only',
        description: 'Dispatch read-only',
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      {
        toolName: 'frodo_dispatch',
        description: 'Dispatch mutating',
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
    ],
    genericTools: [
      {
        toolName: 'frodo_read',
        operationType: 'read',
        description: 'Legacy internal mapping',
        annotations: readDescriptor?.annotations ?? {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        riskClass: readDescriptor?.riskClass ?? 'low',
        supportedObjectTypes: readDescriptor
          ? [
              {
                domain: readDescriptor.domain,
                objectType: readDescriptor.objectType,
                descriptorId: readDescriptor.id,
                methodName: readDescriptor.methodName,
                sourcePath: readDescriptor.id,
                riskClass: readDescriptor.riskClass,
                annotations: readDescriptor.annotations,
              },
            ]
          : [],
      },
      {
        toolName: 'frodo_update',
        operationType: 'update',
        description: 'Legacy internal mapping',
        annotations: updateDescriptor?.annotations ?? {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
        riskClass: updateDescriptor?.riskClass ?? 'medium',
        supportedObjectTypes: updateDescriptor
          ? [
              {
                domain: updateDescriptor.domain,
                objectType: updateDescriptor.objectType,
                descriptorId: updateDescriptor.id,
                methodName: updateDescriptor.methodName,
                sourcePath: updateDescriptor.id,
                riskClass: updateDescriptor.riskClass,
                annotations: updateDescriptor.annotations,
              },
            ]
          : [],
      },
    ],
    specialTools: [],
    discoveryTool: {
      toolName: 'frodo_discover',
      description: 'Discover tool surface.',
      domains: ['authn'],
      objectTypesByDomain: { authn: ['Journey'] },
      operationsByType: {
        read: ['authn.Journey'],
        update: ['authn.Journey'],
      },
      operationDetailsByType: {},
      objectTypeOperationSupport: [
        {
          domain: 'authn',
          objectType: 'Journey',
          supportedOperations: ['read', 'update'],
          unsupportedOperations: [
            'create',
            'delete',
            'search',
            'list',
            'count',
            'export',
            'import',
            'special',
          ],
        },
      ],
    },
    backingDescriptorCount: descriptors.length,
    totalToolCount: 5,
  };
}

describe('MCP hybrid runtime', () => {
  test('find_skills returns filtered results', async () => {
    const readDescriptor = makeDescriptor();
    const updateDescriptor = makeDescriptor({
      id: 'authn.journey.updateJourney',
      methodName: 'updateJourney',
      operationType: 'update',
      riskClass: 'medium',
      mutating: true,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    });
    const manifest = makeManifest([readDescriptor, updateDescriptor]);

    const runtime = createToolRuntime(
      manifest,
      [readDescriptor, updateDescriptor],
      {
        resolveFrodoForRequest: () =>
          ({
            login: { getTokens: jest.fn(async () => {}) },
            authn: { journey: {} },
          }) as any,
      }
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: { operationTypes: ['read'] },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    const payload = result.data as {
      total: number;
      returned: number;
      skills: Array<{ skillId: string }>;
    };
    expect(payload.total).toBe(1);
    expect(payload.returned).toBe(1);
    expect(payload.skills[0].skillId).toBe('authn.journey.readJourney');
  });

  test('describe_skill returns descriptor contract by id', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest([descriptor]);

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: { journey: {} },
        }) as any,
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_describe_skill',
      arguments: { skillId: descriptor.id },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    const payload = result.data as { descriptor: McpCapabilityDescriptor };
    expect(result.descriptorId).toBe(descriptor.id);
    expect(payload.descriptor.id).toBe(descriptor.id);
    expect(payload.descriptor.operationType).toBe('read');
  });

  test('dispatch_read_only executes read descriptor by skill id', async () => {
    const readJourney = jest.fn(async (journeyId: string) => ({
      id: journeyId,
    }));
    const descriptor = makeDescriptor();
    const manifest = makeManifest([descriptor]);

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: {
            journey: {
              readJourney,
            },
          },
        }) as any,
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_dispatch_read_only',
      arguments: {
        skillId: descriptor.id,
        positionalArgs: ['journey-123'],
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(readJourney).toHaveBeenCalledWith('journey-123');
    expect(result.descriptorId).toBe(descriptor.id);
    expect(result.data).toEqual({ id: 'journey-123' });
  });

  test('dispatch executes mutating descriptor selected by tuple', async () => {
    const updateJourney = jest.fn(
      async (journeyId: string, payload: unknown) => ({
        id: journeyId,
        payload,
        updated: true,
      })
    );
    const descriptor = makeDescriptor({
      id: 'authn.journey.updateJourney',
      methodName: 'updateJourney',
      operationType: 'update',
      mutating: true,
      riskClass: 'medium',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    });
    const manifest = makeManifest([descriptor]);

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: {
            journey: {
              updateJourney,
            },
          },
        }) as any,
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_dispatch',
      arguments: {
        operationType: 'update',
        domain: 'authn',
        objectType: 'Journey',
        positionalArgs: ['journey-321', { status: 'active' }],
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(updateJourney).toHaveBeenCalledWith('journey-321', {
      status: 'active',
    });
    expect(result.descriptorId).toBe('authn.journey.updateJourney');
    expect(result.data).toEqual({
      id: 'journey-321',
      payload: { status: 'active' },
      updated: true,
    });
  });

  test('dispatch_read_only rejects mutating descriptors', async () => {
    const descriptor = makeDescriptor({
      id: 'authn.journey.updateJourney',
      methodName: 'updateJourney',
      operationType: 'update',
      mutating: true,
      riskClass: 'medium',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    });
    const manifest = makeManifest([descriptor]);

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: { journey: { updateJourney: jest.fn() } },
        }) as any,
    });

    await expect(
      runtime.executeTool({
        toolName: 'frodo_dispatch_read_only',
        arguments: {
          skillId: descriptor.id,
        },
        context: {
          auth: {
            mode: 'state-config',
            config: {},
          },
        },
      })
    ).rejects.toThrow("'frodo_dispatch_read_only' cannot execute 'update'");
  });

  test('legacy CRUD tool names are rejected', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest([descriptor]);

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: { journey: { readJourney: jest.fn() } },
        }) as any,
    });

    await expect(
      runtime.executeTool({
        toolName: 'frodo_read',
        arguments: {
          domain: 'authn',
          objectType: 'Journey',
        },
        context: {
          auth: {
            mode: 'state-config',
            config: {},
          },
        },
      })
    ).rejects.toThrow("unknown tool 'frodo_read'");
  });
});
