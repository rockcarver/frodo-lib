/**
 * Focused end-to-end tests for canonical Hybrid MCP tools.
 */

import { jest } from '@jest/globals';

import {
  McpCapabilityDescriptor,
  McpToolRuntimeTraceEvent,
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
                deploymentTypes: readDescriptor.deploymentTypes,
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
                deploymentTypes: updateDescriptor.deploymentTypes,
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

  test.each([
    ['cloud', 'idm.managed.countManagedObjects', 'user.countUsers'],
    ['forgeops', 'idm.managed.countManagedObjects', 'user.countUsers'],
    ['classic', 'user.countUsers', 'idm.managed.countManagedObjects'],
  ] as const)(
    'find_skills prefers the correct user surface for %s',
    async (deploymentType, preferredSkillId, incompatibleSkillId) => {
      const managedDescriptor = makeDescriptor({
        id: 'idm.managed.countManagedObjects',
        toolName: 'frodo.idm.managed.countManagedObjects',
        methodName: 'countManagedObjects',
        modulePath: ['idm', 'managed'],
        domain: 'idm',
        objectType: 'ManagedObject',
        operationType: 'count',
        deploymentTypes: ['cloud', 'forgeops'],
        preferredDeploymentTypes: ['cloud', 'forgeops'],
        identitySurface: 'managed',
        objectTypePatterns: ['user', '*_user'],
      });
      const amUserDescriptor = makeDescriptor({
        id: 'user.countUsers',
        toolName: 'frodo.user.countUsers',
        methodName: 'countUsers',
        modulePath: ['user'],
        domain: 'user',
        objectType: 'User',
        operationType: 'count',
        deploymentTypes: ['classic'],
        preferredDeploymentTypes: ['classic'],
        identitySurface: 'am-user',
        objectTypePatterns: ['user'],
      });
      const descriptors = [amUserDescriptor, managedDescriptor];
      const runtime = createToolRuntime(makeManifest(descriptors), descriptors);

      const result = await runtime.executeTool({
        toolName: 'frodo_find_skills',
        arguments: { query: 'count users' },
        context: {
          auth: {
            mode: 'state-config',
            config: { deploymentType },
          },
        },
      });
      const payload = result.data as {
        skills: Array<{
          skillId: string;
          routingStatus: string;
          routingReason: string;
        }>;
      };

      expect(payload.skills.map((skill) => skill.skillId)).toEqual([
        preferredSkillId,
      ]);
      expect(payload.skills[0].routingStatus).toBe('preferred');

      const diagnosticResult = await runtime.executeTool({
        toolName: 'frodo_find_skills',
        arguments: { query: 'count users', includeIncompatible: true },
        context: {
          auth: {
            mode: 'state-config',
            config: { deploymentType },
          },
        },
      });
      const diagnosticPayload = diagnosticResult.data as {
        skills: Array<{ skillId: string; routingStatus: string }>;
      };
      expect(diagnosticPayload.skills.map((skill) => skill.skillId)).toEqual([
        preferredSkillId,
        incompatibleSkillId,
      ]);
      expect(diagnosticPayload.skills[1].routingStatus).toBe('incompatible');

      if (deploymentType !== 'classic') {
        const managedObjectResult = await runtime.executeTool({
          toolName: 'frodo_find_skills',
          arguments: { query: 'alpha_user' },
          context: {
            auth: {
              mode: 'state-config',
              config: { deploymentType },
            },
          },
        });
        const managedObjectPayload = managedObjectResult.data as {
          skills: Array<{ skillId: string }>;
        };
        expect(managedObjectPayload.skills[0].skillId).toBe(
          'idm.managed.countManagedObjects'
        );
      }
    }
  );

  test.each([
    'count users identities in a ForgeRock environment',
    'how many users are there',
    'user identity managed user count',
    'managed object user list query identity cloud total count',
    'users',
    'users/groups',
  ])('find_skills semantically matches managed user intent: %s', async (query) => {
    const managedDescriptor = makeDescriptor({
      id: 'idm.managed.countManagedObjects',
      toolName: 'frodo.idm.managed.countManagedObjects',
      methodName: 'countManagedObjects',
      modulePath: ['idm', 'managed'],
      domain: 'idm',
      objectType: 'ManagedObject',
      operationType: 'count',
      deploymentTypes: ['cloud', 'forgeops'],
      preferredDeploymentTypes: ['cloud', 'forgeops'],
      identitySurface: 'managed',
      objectTypePatterns: ['user', '*_user', 'group', '*_group'],
      notes: 'Count or query managed identities and native object types.',
    });
    const runtime = createToolRuntime(
      makeManifest([managedDescriptor]),
      [managedDescriptor]
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: { query },
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'cloud' },
        },
      },
    });
    const payload = result.data as { skills: Array<{ skillId: string }> };
    expect(payload.skills[0]?.skillId).toBe(
      'idm.managed.countManagedObjects'
    );
  });

  test('find_skills rejects a non-boolean includeIncompatible value', async () => {
    const descriptor = makeDescriptor();
    const runtime = createToolRuntime(makeManifest([descriptor]), [descriptor]);

    await expect(
      runtime.executeTool({
        toolName: 'frodo_find_skills',
        arguments: { includeIncompatible: 'yes' } as any,
        context: {
          auth: { mode: 'state-config', config: {} },
        },
      })
    ).rejects.toThrow('includeIncompatible to be a boolean');
  });

  test('find_skills returns bounded hydrated managed-object type matches', async () => {
    const descriptor = makeDescriptor({
      id: 'idm.managed.countManagedObjects',
      domain: 'idm',
      objectType: 'ManagedObject',
      operationType: 'count',
      identitySurface: 'managed',
      deploymentTypes: ['cloud'],
    });
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        managedObjectTypes: [
          'alpha_user',
          ...Array.from({ length: 12 }, (_, index) => `alpha_${index}`),
          'bravo_user',
        ],
      }
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: { query: 'alpha_user' },
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'cloud' },
        },
      },
    });
    const payload = result.data as {
      skills: Array<{
        matchedObjectTypes?: string[];
        matchedObjectTypeCount?: number;
      }>;
    };
    expect(payload.skills[0].matchedObjectTypes).toHaveLength(5);
    expect(payload.skills[0].matchedObjectTypeCount).toBe(13);
    expect(payload.skills[0].matchedObjectTypes).toContain('alpha_user');
    expect(payload.skills[0].matchedObjectTypes).not.toContain('bravo_user');
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

  test('runtime traces lifecycle metadata without arguments or results', async () => {
    const trace = jest.fn<(event: McpToolRuntimeTraceEvent) => void>();
    const readJourney = jest.fn(async () => ({ secretResult: 'hidden' }));
    const descriptor = makeDescriptor();
    const runtime = createToolRuntime(makeManifest([descriptor]), [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: { journey: { readJourney } },
        }) as any,
    });

    await runtime.executeTool({
      toolName: 'frodo_dispatch_read_only',
      arguments: {
        skillId: descriptor.id,
        positionalArgs: ['secret-argument'],
      },
      context: {
        requestId: 'request-123',
        trace,
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'classic' },
        },
      },
    });

    expect(trace.mock.calls.map(([event]) => event.event)).toEqual([
      'selection',
      'dispatch-start',
      'dispatch-success',
    ]);
    const serializedEvents = JSON.stringify(trace.mock.calls);
    expect(serializedEvents).toContain('request-123');
    expect(serializedEvents).toContain(descriptor.id);
    expect(serializedEvents).not.toContain('secret-argument');
    expect(serializedEvents).not.toContain('secretResult');
    expect(serializedEvents).not.toContain('hidden');
  });

  test('find_skills traces its criteria and top five ranked candidates', async () => {
    const trace = jest.fn<(event: McpToolRuntimeTraceEvent) => void>();
    const descriptors = Array.from({ length: 7 }, (_, index) =>
      makeDescriptor({
        id: `authn.journey.readJourney${index}`,
        toolName: `frodo.authn.journey.readJourney${index}`,
        methodName: `readJourney${index}`,
      })
    );
    const runtime = createToolRuntime(makeManifest(descriptors), descriptors);

    await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: {
        query: 'journey',
        domain: 'authn',
        skillIdPrefix: 'authn.journey',
        kind: 'generic',
        limit: 7,
      },
      context: {
        trace,
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'classic' },
        },
      },
    });

    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'discovery',
        criteria: {
          query: 'journey',
          domain: 'authn',
          skillIdPrefix: 'authn.journey',
          kind: 'generic',
          limit: 7,
        },
        candidateCount: 7,
        resultCount: 7,
        topCandidates: descriptors.slice(0, 5).map((descriptor) => ({
          skillId: descriptor.id,
          routingStatus: 'compatible',
        })),
      })
    );
  });

  test('dispatch uses deployment detected by getTokens before invocation', async () => {
    let detectedDeployment: string | undefined;
    const countUsers = jest.fn(async () => 1);
    const getTokens = jest.fn(async () => {
      detectedDeployment = 'cloud';
    });
    const descriptor = makeDescriptor({
      id: 'user.countUsers',
      toolName: 'frodo.user.countUsers',
      methodName: 'countUsers',
      modulePath: ['user'],
      domain: 'user',
      objectType: 'User',
      operationType: 'count',
      deploymentTypes: ['classic'],
      preferredDeploymentTypes: ['classic'],
      identitySurface: 'am-user',
      objectTypePatterns: ['user'],
    });
    const runtime = createToolRuntime(makeManifest([descriptor]), [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          state: { getDeploymentType: () => detectedDeployment },
          login: { getTokens },
          user: { countUsers },
        }) as any,
    });

    await expect(
      runtime.executeTool({
        toolName: 'frodo_dispatch_read_only',
        arguments: { skillId: descriptor.id },
        context: { auth: { mode: 'state-config', config: {} } },
      })
    ).rejects.toThrow("not supported for deployment 'cloud'");
    expect(getTokens).toHaveBeenCalledTimes(1);
    expect(countUsers).not.toHaveBeenCalled();
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
