/**
 * Focused end-to-end tests for canonical Hybrid MCP tools.
 */

import { jest } from '@jest/globals';

import {
  McpCapabilityDescriptor,
  McpToolExecutionResult,
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
  test('discover returns active connection metadata before the large catalog', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest([descriptor]);
    manifest.discoveryTool.activeTarget = {
      host: 'https://example.test/am',
      profile: 'all',
    };
    manifest.discoveryTool.managedObjectTypeCount = 16;
    const runtime = createToolRuntime(manifest, [descriptor], {
      managedObjectTypes: [
        'alpha_aiagent',
        'alpha_aiagentprivilege',
        'alpha_application',
        'alpha_assignment',
        'alpha_group',
        'alpha_organization',
        'alpha_role',
        'alpha_user',
        'bravo_aiagent',
        'bravo_aiagentprivilege',
        'bravo_application',
        'bravo_assignment',
        'bravo_group',
        'bravo_organization',
        'bravo_role',
        'bravo_user',
      ],
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_discover',
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'cloud' },
        },
      },
    });
    const data = result.data as Record<string, unknown>;

    expect(Object.keys(data).slice(0, 3)).toEqual([
      'activeTarget',
      'activeDeploymentType',
      'managedObjectTypeCount',
    ]);
    expect(data).toMatchObject({
      skillCount: 1,
      objectFamilies: [
        'aiagent',
        'aiagentprivilege',
        'application',
        'assignment',
        'group',
        'organization',
        'role',
        'user',
      ],
    });
    expect(data).not.toHaveProperty('operationDetailsByType');
  });

  test('discover resolves docsContext to the unversioned pingoneaic docset for cloud', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest([descriptor]);
    const runtime = createToolRuntime(manifest, [descriptor]);

    const result = await runtime.executeTool({
      toolName: 'frodo_discover',
      context: {
        auth: { mode: 'state-config', config: { deploymentType: 'cloud' } },
      },
    });
    const data = result.data as { docsContext: Record<string, unknown> };

    expect(data.docsContext).toMatchObject({
      product: 'pingoneaic',
      versioned: false,
      llmsTxtUrl: 'https://docs.pingidentity.com/pingoneaic/llms.txt',
    });
  });

  test('discover resolves docsContext to a versioned pingam docset for classic, using the scoped instance already authenticated for deployment detection', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest([descriptor]);
    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          state: {
            getDeploymentType: () => 'classic',
            getAmVersion: () => '7.5.0',
          },
          login: { getTokens: jest.fn(async () => {}) },
        }) as any,
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_discover',
      context: {
        auth: { mode: 'state-config', config: { host: 'https://example.test/am' } },
      },
    });
    const data = result.data as { docsContext: Record<string, unknown> };

    expect(data.docsContext).toMatchObject({
      product: 'pingam',
      versioned: true,
      version: '7.5',
      llmsTxtUrl: 'https://docs.pingidentity.com/pingam/llms.txt',
    });
  });

  test('discover resolves docsContext to independently versioned am/idm docsets plus domain routing for forgeops', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest([descriptor]);
    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          state: {
            getDeploymentType: () => 'forgeops',
            getAmVersion: () => '7.5.0',
            getIdmVersion: () => '8.1.0',
          },
          login: { getTokens: jest.fn(async () => {}) },
        }) as any,
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_discover',
      context: {
        auth: { mode: 'state-config', config: { host: 'https://example.test/am' } },
      },
    });
    const data = result.data as { docsContext: Record<string, unknown> };

    expect(data.docsContext).toMatchObject({
      deploymentType: 'forgeops',
      am: { product: 'pingam', version: '7.5' },
      idm: { product: 'pingidm', version: '8.1' },
      domainRouting: { idm: 'idm', realm: 'am' },
    });
  });

  test('discover returns the legacy operation catalog only when requested', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest([descriptor]);
    const runtime = createToolRuntime(manifest, [descriptor]);

    const result = await runtime.executeTool({
      toolName: 'frodo_discover',
      arguments: { detail: 'catalog' },
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'cloud' },
        },
      },
    });
    const data = result.data as Record<string, unknown>;

    expect(data).toHaveProperty('operationDetailsByType');
    expect(data).toHaveProperty('objectTypeOperationSupport');
    expect(data).not.toHaveProperty('skillCount');
  });

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
    [
      "what's the alpha realm password policy in volker-dev?",
      'idm.config.readConfigEntity',
      'realm password policy',
    ],
    [
      'list all realm password policies',
      'idm.config.readConfigEntitiesByType',
      'all password policies',
    ],
  ])(
    'find_skills ranks password-policy intent: %s',
    async (query, expectedSkillId, expectedAlias) => {
      const singleDescriptor = makeDescriptor({
        id: 'idm.config.readConfigEntity',
        toolName: 'frodo.idm.config.readConfigEntity',
        methodName: 'readConfigEntity',
        modulePath: ['idm', 'config'],
        domain: 'idm',
        objectType: 'ConfigEntity',
        scope: 'single',
        semanticAliases: [
          'realm password policy',
          'password policy',
          'field policy',
        ],
      });
      const bulkDescriptor = makeDescriptor({
        id: 'idm.config.readConfigEntitiesByType',
        toolName: 'frodo.idm.config.readConfigEntitiesByType',
        methodName: 'readConfigEntitiesByType',
        modulePath: ['idm', 'config'],
        domain: 'idm',
        objectType: 'ConfigEntity',
        scope: 'bulk',
        semanticAliases: [
          'all password policies',
          'password policies',
          'field policies',
        ],
      });
      const descriptors = [singleDescriptor, bulkDescriptor];
      const runtime = createToolRuntime(
        makeManifest(descriptors),
        descriptors,
        {
          resolveFrodoForRequest: () =>
            ({ login: { getTokens: jest.fn(async () => {}) } }) as any,
        }
      );

      const result = await runtime.executeTool({
        toolName: 'frodo_find_skills',
        arguments: { query, operationTypes: ['read'] },
        context: { auth: { mode: 'state-config', config: {} } },
      });
      const payload = result.data as {
        skills: Array<{
          skillId: string;
          matchedSemanticAliases?: string[];
        }>;
      };

      expect(payload.skills[0]).toMatchObject({
        skillId: expectedSkillId,
        matchedSemanticAliases: expect.arrayContaining([expectedAlias]),
      });
    }
  );

  test('find_skills derives hydrated config entity type matches', async () => {
    const descriptor = makeDescriptor({
      id: 'idm.config.readConfigEntitiesByType',
      toolName: 'frodo.idm.config.readConfigEntitiesByType',
      methodName: 'readConfigEntitiesByType',
      modulePath: ['idm', 'config'],
      domain: 'idm',
      objectType: 'ConfigEntity',
      argumentMode: 'named',
      scope: 'bulk',
      semanticAliases: ['password policies', 'field policies'],
      parameters: [
        {
          name: 'type',
          type: 'string',
          required: true,
          position: 0,
        },
      ],
    });
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        configEntityIds: [
          'fieldPolicy/alpha_user',
          'fieldPolicy/bravo_user',
          'emailTemplate/welcome',
        ],
      }
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: {
        query: 'list all password policies',
        operationTypes: ['read'],
      },
      context: { auth: { mode: 'state-config', config: {} } },
    });
    const payload = result.data as {
      skills: Array<{
        matchedConfigEntityTypes?: string[];
        matchedConfigEntityTypeCount?: number;
      }>;
    };

    expect(payload.skills[0]).toMatchObject({
      matchedConfigEntityTypes: ['fieldPolicy'],
      matchedConfigEntityTypeCount: 1,
    });
  });

  test.each(['cloud', 'forgeops'] as const)(
    'find_skills maps user.User coordinates to managed identities on %s',
    async (deploymentType) => {
      const descriptor = makeDescriptor({
        id: 'idm.managed.countManagedObjects',
        domain: 'idm',
        objectType: 'ManagedObject',
        operationType: 'count',
        deploymentTypes: ['cloud', 'forgeops'],
        preferredDeploymentTypes: ['cloud', 'forgeops'],
        identitySurface: 'managed',
        objectTypePatterns: ['user', '*_user'],
      });
      const runtime = createToolRuntime(makeManifest([descriptor]), [
        descriptor,
      ]);

      const result = await runtime.executeTool({
        toolName: 'frodo_find_skills',
        arguments: {
          query: 'count users exact total',
          domain: 'user',
          objectType: 'User',
          operationTypes: ['count'],
          riskClasses: ['low'],
          limit: 10,
        },
        context: {
          auth: {
            mode: 'state-config',
            config: { deploymentType },
          },
        },
      });
      const payload = result.data as {
        returned: number;
        skills: Array<{
          skillId: string;
          domain: string;
          objectType: string;
          routingStatus: string;
        }>;
        guidance?: string;
      };

      expect(payload.returned).toBe(1);
      expect(payload.skills[0]).toMatchObject({
        skillId: 'idm.managed.countManagedObjects',
        domain: 'idm',
        objectType: 'ManagedObject',
        routingStatus: 'preferred',
      });
      expect(payload.guidance).toBeUndefined();
    }
  );

  test('find_skills maps a user domain without requiring objectType and recommends aggregate dispatch', async () => {
    const descriptor = makeDescriptor({
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
      objectTypePatterns: ['*'],
    });
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        managedObjectTypes: ['alpha_user', 'bravo_user'],
      }
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: {
        query: 'count users in volker-dev',
        objectFamily: 'user',
        domain: 'user',
        operationTypes: ['count'],
        limit: 20,
      },
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'cloud' },
        },
      },
    });
    const payload = result.data as {
      returned: number;
      guidance?: string;
      nextAction?: string;
      recommendedDispatch?: Record<string, unknown>;
      skills: Array<Record<string, unknown>>;
    };

    expect(payload.returned).toBe(1);
    expect(payload.guidance).toBeUndefined();
    expect(payload.nextAction).toContain('Do not call frodo_discover');
    expect(payload.recommendedDispatch).toEqual({
      toolName: 'frodo_dispatch_read_only',
      arguments: {
        skillId: 'idm.managed.countManagedObjects',
        semanticTarget: { family: 'user' },
      },
    });
    expect(payload.skills[0]).toMatchObject({
      skillId: 'idm.managed.countManagedObjects',
      recommendedDispatch: {
        toolName: 'frodo_dispatch_read_only',
        arguments: {
          skillId: 'idm.managed.countManagedObjects',
          semanticTarget: { family: 'user' },
        },
      },
    });
  });

  test('find_skills executes a unique read-only recommendation when host policy enables it', async () => {
    const countManagedObjects = jest.fn(async (type: string) =>
      type === 'alpha_user' ? 2020 : 2
    );
    const descriptor = makeDescriptor({
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
      objectTypePatterns: ['*'],
    });
    const runtime = createToolRuntime(makeManifest([descriptor]), [descriptor], {
      managedObjectTypes: ['alpha_user', 'bravo_user'],
      managedObjectHydrationStatus: 'available',
      executeRecommendedByDefault: true,
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          idm: { managed: { countManagedObjects } },
        }) as any,
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: {
        query: 'count users in volker-dev',
        objectFamily: 'user',
        domain: 'idm',
        operationTypes: ['count'],
      },
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'cloud' },
        },
      },
    });
    const payload = result.data as {
      nextAction?: string;
      execution?: McpToolExecutionResult;
    };

    expect(payload.nextAction).toContain('execution.data');
    expect(payload.execution).toMatchObject({
      toolName: 'frodo_dispatch_read_only',
      descriptorId: 'idm.managed.countManagedObjects',
      data: {
        family: 'user',
        total: 2022,
        breakdown: [
          { type: 'alpha_user', realm: 'alpha', count: 2020 },
          { type: 'bravo_user', realm: 'bravo', count: 2 },
        ],
      },
    });
    expect(countManagedObjects).toHaveBeenCalledTimes(2);
  });

  test('find_skills recommends exact dispatch for an explicit managed-object type', async () => {
    const descriptor = makeDescriptor({
      id: 'idm.managed.countManagedObjects',
      domain: 'idm',
      objectType: 'ManagedObject',
      operationType: 'count',
      identitySurface: 'managed',
      objectTypePatterns: ['*'],
    });
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        managedObjectTypes: ['alpha_user', 'bravo_user'],
      }
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: {
        query: 'count alpha_user',
        objectFamily: 'user',
        domain: 'idm',
        operationTypes: ['count'],
      },
      context: { auth: { mode: 'state-config', config: {} } },
    });
    const payload = result.data as {
      recommendedDispatch?: Record<string, unknown>;
    };

    expect(payload.recommendedDispatch).toEqual({
      toolName: 'frodo_dispatch_read_only',
      arguments: {
        skillId: 'idm.managed.countManagedObjects',
        namedArgs: { type: 'alpha_user' },
      },
    });
  });

  test('find_skills lets a specific notes match compete with the generic identity/user bonus', async () => {
    // Regression test: session.getSessionInfo went undiscoverable for
    // natural-language identity queries ("authenticated identity session")
    // because a matched notes field scored at the lowest weight in the
    // system (2) while every identitySurface: 'managed' read skill gets a
    // flat +8 for the same query just for touching a user-shaped object,
    // regardless of how well its own notes actually describe it. A
    // handful of such flat-bonus skills could bury a real, well-documented
    // match. The target descriptor here matches purely via a specific,
    // multi-term notes phrase; the noise descriptors match purely via the
    // generic bonus on a single term ("identity") and are otherwise
    // unrelated to the query.
    const targetDescriptor = makeDescriptor({
      id: 'session.getSessionInfo',
      domain: 'session',
      objectType: 'SessionInfo',
      modulePath: ['session'],
      notes:
        'Reports the authenticated identity behind the current session.',
    });
    const noiseDescriptors = ['a', 'b', 'c', 'd'].map((suffix) =>
      makeDescriptor({
        id: `idm.managed.noiseSkill${suffix}`,
        domain: 'idm',
        objectType: 'ManagedObject',
        methodName: `noiseSkill${suffix}`,
        modulePath: ['idm', 'managed'],
        identitySurface: 'managed',
        objectTypePatterns: ['*'],
      })
    );
    const descriptors = [targetDescriptor, ...noiseDescriptors];
    const runtime = createToolRuntime(makeManifest(descriptors), descriptors);

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: {
        query: 'authenticated identity session',
        executeRecommended: false,
        limit: 4,
      },
      context: { auth: { mode: 'state-config', config: {} } },
    });
    const skillIds = (
      result.data as { skills: Array<{ skillId: string }> }
    ).skills.map((skill) => skill.skillId);

    expect(skillIds).toContain('session.getSessionInfo');
  });

  test('find_skills does not give the generic identity/user bonus to mutating operations', async () => {
    // A create/update/delete skill on a user-shaped object shouldn't tie
    // with genuine identity-lookup skills just because it touches a user
    // object — that bonus is reserved for read-like operations.
    const readDescriptor = makeDescriptor({
      id: 'idm.managed.readManagedObject',
      domain: 'idm',
      objectType: 'ManagedObject',
      methodName: 'readManagedObject',
      operationType: 'read',
      identitySurface: 'managed',
      objectTypePatterns: ['*'],
    });
    const mutatingDescriptor = makeDescriptor({
      id: 'idm.managed.deleteManagedObject',
      domain: 'idm',
      objectType: 'ManagedObject',
      methodName: 'deleteManagedObject',
      operationType: 'delete',
      mutating: true,
      destructive: true,
      identitySurface: 'managed',
      objectTypePatterns: ['*'],
    });
    const descriptors = [readDescriptor, mutatingDescriptor];
    const runtime = createToolRuntime(makeManifest(descriptors), descriptors);

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: {
        query: 'identity',
        executeRecommended: false,
        limit: 1,
      },
      context: { auth: { mode: 'state-config', config: {} } },
    });
    const skillIds = (
      result.data as { skills: Array<{ skillId: string }> }
    ).skills.map((skill) => skill.skillId);

    expect(skillIds).toEqual(['idm.managed.readManagedObject']);
  });

  test('find_skills keeps user.User coordinates on the classic AM surface', async () => {
    const managedDescriptor = makeDescriptor({
      id: 'idm.managed.countManagedObjects',
      domain: 'idm',
      objectType: 'ManagedObject',
      operationType: 'count',
      deploymentTypes: ['cloud', 'forgeops'],
      identitySurface: 'managed',
      objectTypePatterns: ['user', '*_user'],
    });
    const amDescriptor = makeDescriptor({
      id: 'user.countUsers',
      domain: 'user',
      objectType: 'User',
      operationType: 'count',
      deploymentTypes: ['classic'],
      preferredDeploymentTypes: ['classic'],
      identitySurface: 'am-user',
      objectTypePatterns: ['user'],
    });
    const runtime = createToolRuntime(
      makeManifest([managedDescriptor, amDescriptor]),
      [managedDescriptor, amDescriptor]
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: {
        query: 'count users',
        domain: 'user',
        objectType: 'User',
        operationTypes: ['count'],
      },
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'classic' },
        },
      },
    });
    const payload = result.data as {
      skills: Array<{ skillId: string; routingStatus: string }>;
    };

    expect(payload.skills).toEqual([
      expect.objectContaining({
        skillId: 'user.countUsers',
        routingStatus: 'preferred',
      }),
    ]);
  });

  test('find_skills retains both user identity surfaces when deployment is unresolved', async () => {
    const managedDescriptor = makeDescriptor({
      id: 'idm.managed.countManagedObjects',
      domain: 'idm',
      objectType: 'ManagedObject',
      operationType: 'count',
      deploymentTypes: ['cloud', 'forgeops'],
      identitySurface: 'managed',
      objectTypePatterns: ['user', '*_user'],
    });
    const amDescriptor = makeDescriptor({
      id: 'user.countUsers',
      domain: 'user',
      objectType: 'User',
      operationType: 'count',
      deploymentTypes: ['classic'],
      identitySurface: 'am-user',
      objectTypePatterns: ['user'],
    });
    const runtime = createToolRuntime(
      makeManifest([managedDescriptor, amDescriptor]),
      [managedDescriptor, amDescriptor]
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: {
        query: 'count users',
        domain: 'user',
        objectType: 'User',
        operationTypes: ['count'],
      },
      context: {
        auth: { mode: 'state-config', config: {} },
      },
    });
    const payload = result.data as {
      skills: Array<{ skillId: string; routingStatus: string }>;
    };

    expect(payload.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: 'idm.managed.countManagedObjects',
          routingStatus: 'unknown',
        }),
        expect.objectContaining({
          skillId: 'user.countUsers',
          routingStatus: 'unknown',
        }),
      ])
    );
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

  test('find_skills lets a much more relevant compatible-tier result outrank a barely-relevant preferred-tier one', async () => {
    // Regression test: routing status (preferred/compatible) used to be an
    // absolute pre-sort tier — checked before relevance was even
    // consulted, so any "preferred" result outranked every "compatible"
    // result regardless of actual query relevance. A skill that happened
    // to be "preferred" for the active deployment (idm.managed.* skills
    // are preferred on cloud) could bury a genuinely, strongly relevant
    // "compatible" result from an entirely different domain no matter how
    // well-matched it was.
    const preferredButBarelyRelevant = makeDescriptor({
      id: 'idm.managed.readManagedObjectSchema',
      toolName: 'frodo.idm.managed.readManagedObjectSchema',
      methodName: 'readManagedObjectSchema',
      modulePath: ['idm', 'managed'],
      domain: 'idm',
      objectType: 'ManagedObjectSchema',
      operationType: 'read',
      deploymentTypes: ['cloud', 'forgeops'],
      preferredDeploymentTypes: ['cloud', 'forgeops'],
      identitySurface: 'managed',
    });
    const compatibleButHighlyRelevant = makeDescriptor({
      id: 'session.getSessionInfo',
      toolName: 'frodo.session.getSessionInfo',
      methodName: 'getSessionInfo',
      modulePath: ['session'],
      domain: 'session',
      objectType: 'SessionInfo',
      operationType: 'read',
      deploymentTypes: ['any'],
      semanticAliases: ['authenticated identity'],
      notes: 'Reports the authenticated identity behind the current session.',
    });
    const descriptors = [preferredButBarelyRelevant, compatibleButHighlyRelevant];
    const runtime = createToolRuntime(makeManifest(descriptors), descriptors);

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: { query: 'authenticated identity', executeRecommended: false },
      context: {
        auth: { mode: 'state-config', config: { deploymentType: 'cloud' } },
      },
    });
    const skillIds = (
      result.data as { skills: Array<{ skillId: string }> }
    ).skills.map((skill) => skill.skillId);

    expect(skillIds[0]).toBe('session.getSessionInfo');
  });

  test.each([
    'count users identities in a ForgeRock environment',
    'how many users are there',
    'user identity managed user count',
    'managed object user list query identity cloud total count',
    'users',
    'users/groups',
  ])(
    'find_skills semantically matches managed user intent: %s',
    async (query) => {
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
      const runtime = createToolRuntime(makeManifest([managedDescriptor]), [
        managedDescriptor,
      ]);

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
    }
  );

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

  test.each([
    [
      'default alpha organization privileges for members',
      ['alphaOrgPrivileges'],
    ],
    [
      'default organization privileges for members',
      ['alphaOrgPrivileges', 'bravoOrgPrivileges'],
    ],
  ])(
    'find_skills returns hydrated config entity matches: %s',
    async (query, expectedIds) => {
      const descriptor = makeDescriptor({
        id: 'idm.config.readConfigEntity',
        toolName: 'frodo.idm.config.readConfigEntity',
        methodName: 'readConfigEntity',
        modulePath: ['idm', 'config'],
        domain: 'idm',
        objectType: 'ConfigEntity',
        argumentMode: 'named',
        parameters: [
          {
            name: 'entityId',
            type: 'string',
            required: true,
            position: 0,
          },
        ],
      });
      const runtime = createToolRuntime(
        makeManifest([descriptor]),
        [descriptor],
        {
          configEntityIds: [
            'alphaOrgPrivileges',
            'bravoOrgPrivileges',
            'privilegeAssignments',
          ],
        }
      );

      const result = await runtime.executeTool({
        toolName: 'frodo_find_skills',
        arguments: { query, operationTypes: ['read'] },
        context: { auth: { mode: 'state-config', config: {} } },
      });
      const payload = result.data as {
        skills: Array<{
          matchedConfigEntityIds?: string[];
          matchedConfigEntityIdCount?: number;
        }>;
      };

      expect(payload.skills[0]).toMatchObject({
        matchedConfigEntityIds: expectedIds,
        matchedConfigEntityIdCount: expectedIds.length,
      });
    }
  );

  test.each([
    ['users', 'user', ['alpha_user', 'bravo_user']],
    ['people', 'user', ['alpha_user', 'bravo_user']],
    ['identities', 'user', ['alpha_user', 'bravo_user']],
    ['orgs', 'organization', ['alpha_organization']],
    ['apps', 'application', ['alpha_application']],
    ['orgnizations', 'organization', ['alpha_organization']],
    ['families', 'family', ['alpha_family', 'bravo_family', 'charlie_family']],
    ['ai agent privileges', 'aiagentprivilege', ['alpha_aiagentprivilege']],
  ] as const)(
    'find_skills resolves the %s semantic family',
    async (query, family, expectedTypes) => {
      const descriptor = makeDescriptor({
        id: 'idm.managed.countManagedObjects',
        domain: 'idm',
        objectType: 'ManagedObject',
        operationType: 'count',
        identitySurface: 'managed',
        deploymentTypes: ['cloud'],
        objectTypePatterns: ['*'],
      });
      const runtime = createToolRuntime(
        makeManifest([descriptor]),
        [descriptor],
        {
          managedObjectTypes: [
            'alpha_user',
            'bravo_user',
            'alpha_group',
            'bravo_group',
            'alpha_organization',
            'alpha_application',
            'alpha_aiagent',
            'alpha_aiagentprivilege',
            'alpha_family',
            'bravo_family',
            'charlie_family',
          ],
        }
      );

      const result = await runtime.executeTool({
        toolName: 'frodo_find_skills',
        arguments: { query, operationTypes: ['count'] },
        context: {
          auth: {
            mode: 'state-config',
            config: { deploymentType: 'cloud' },
          },
        },
      });
      const payload = result.data as {
        skills: Array<{
          matchedObjectFamilies?: string[];
          matchedObjectTypes?: string[];
        }>;
      };

      expect(payload.skills[0].matchedObjectFamilies).toEqual([family]);
      expect(payload.skills[0].matchedObjectTypes).toEqual(expectedTypes);
    }
  );

  test('find_skills accepts an explicit objectFamily alias without a query', async () => {
    const descriptor = makeDescriptor({
      id: 'idm.managed.countManagedObjects',
      domain: 'idm',
      objectType: 'ManagedObject',
      operationType: 'count',
      identitySurface: 'managed',
      deploymentTypes: ['cloud'],
      objectTypePatterns: ['*'],
    });
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        managedObjectTypes: ['north_america_organization', 'alpha_user'],
      }
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: { objectFamily: 'orgs', operationTypes: ['count'] },
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'cloud' },
        },
      },
    });
    const payload = result.data as {
      skills: Array<{ matchedObjectTypes?: string[] }>;
    };

    expect(payload.skills[0].matchedObjectTypes).toEqual([
      'north_america_organization',
    ]);
  });

  test('find_skills returns candidates for ambiguous entitlement language', async () => {
    const descriptor = makeDescriptor({
      id: 'idm.managed.countManagedObjects',
      domain: 'idm',
      objectType: 'ManagedObject',
      operationType: 'count',
      identitySurface: 'managed',
      deploymentTypes: ['cloud'],
      objectTypePatterns: ['*'],
    });
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        managedObjectTypes: [
          'alpha_assignment',
          'alpha_role',
          'alpha_aiagentprivilege',
        ],
      }
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: { query: 'count entitlements' },
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'cloud' },
        },
      },
    });
    const payload = result.data as { guidance?: string; skills: unknown[] };

    expect(payload.skills).toEqual([]);
    expect(payload.guidance).toContain(
      'Choose one of: assignment, role, aiagentprivilege.'
    );
  });

  test('find_skills prefers an exact live entitlement family', async () => {
    const descriptor = makeDescriptor({
      id: 'idm.managed.countManagedObjects',
      domain: 'idm',
      objectType: 'ManagedObject',
      operationType: 'count',
      identitySurface: 'managed',
      deploymentTypes: ['cloud'],
      objectTypePatterns: ['*'],
    });
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        managedObjectTypes: ['alpha_entitlement', 'bravo_entitlement'],
      }
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: { query: 'count entitlements' },
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'cloud' },
        },
      },
    });
    const payload = result.data as {
      guidance?: string;
      skills: Array<{ matchedObjectTypes?: string[] }>;
    };

    expect(payload.guidance).toBeUndefined();
    expect(payload.skills[0].matchedObjectTypes).toEqual([
      'alpha_entitlement',
      'bravo_entitlement',
    ]);
  });

  test('find_skills does not recommend looser filters for an unavailable known family', async () => {
    const runtime = createToolRuntime(makeManifest([]), []);

    const result = await runtime.executeTool({
      toolName: 'frodo_find_skills',
      arguments: {
        query: 'count users',
        domain: 'user',
        objectType: 'User',
        operationTypes: ['count'],
      },
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'cloud' },
        },
      },
    });
    const payload = result.data as { guidance?: string };

    expect(payload.guidance).toContain('unavailable under the active profile');
    expect(payload.guidance).not.toContain('Retry');
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

  test('dispatch_read_only directs named-argument errors to describe_skill', async () => {
    const descriptor = makeDescriptor({
      argumentMode: 'named',
      parameters: [
        {
          name: 'entityId',
          type: 'string',
          required: true,
          position: 0,
        },
      ],
    });
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        resolveFrodoForRequest: () =>
          ({
            login: { getTokens: jest.fn(async () => {}) },
            authn: { journey: { readJourney: jest.fn() } },
          }) as any,
      }
    );

    await expect(
      runtime.executeTool({
        toolName: 'frodo_dispatch_read_only',
        arguments: {
          skillId: descriptor.id,
          positionalArgs: ['alphaOrgPrivileges'],
        },
        context: { auth: { mode: 'state-config', config: {} } },
      })
    ).rejects.toThrow(
      'requires namedArgs. Use frodo_describe_skill for the exact parameter contract.'
    );
  });

  test('dispatch_read_only aggregates a dynamic family across IDM realms', async () => {
    const countManagedObjects = jest.fn(async (type: string) =>
      type === 'alpha_family' ? 12 : type === 'bravo_family' ? 8 : 3
    );
    const descriptor = makeDescriptor({
      id: 'idm.managed.countManagedObjects',
      toolName: 'frodo.idm.managed.countManagedObjects',
      methodName: 'countManagedObjects',
      modulePath: ['idm', 'managed'],
      domain: 'idm',
      objectType: 'ManagedObject',
      operationType: 'count',
      deploymentTypes: ['cloud'],
      identitySurface: 'managed',
      objectTypePatterns: ['*'],
    });
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        managedObjectTypes: [
          'alpha_family',
          'bravo_family',
          'charlie_family',
          'alpha_user',
        ],
        resolveFrodoForRequest: () =>
          ({
            login: { getTokens: jest.fn(async () => {}) },
            idm: { managed: { countManagedObjects } },
          }) as any,
      }
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_dispatch_read_only',
      arguments: {
        skillId: descriptor.id,
        semanticTarget: { family: 'families' },
      },
      context: {
        auth: {
          mode: 'state-config',
          config: { deploymentType: 'cloud' },
        },
      },
    });

    expect(countManagedObjects).toHaveBeenCalledTimes(3);
    expect(result.data).toEqual({
      family: 'family',
      total: 23,
      breakdown: [
        {
          family: 'family',
          type: 'alpha_family',
          realm: 'alpha',
          count: 12,
        },
        {
          family: 'family',
          type: 'bravo_family',
          realm: 'bravo',
          count: 8,
        },
        {
          family: 'family',
          type: 'charlie_family',
          realm: 'charlie',
          count: 3,
        },
      ],
    });
  });

  test('runtime traces lifecycle metadata without arguments or results', async () => {
    const trace = jest.fn<(event: McpToolRuntimeTraceEvent) => void>();
    const readJourney = jest.fn(async () => ({ secretResult: 'hidden' }));
    const descriptor = makeDescriptor();
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        resolveFrodoForRequest: () =>
          ({
            login: { getTokens: jest.fn(async () => {}) },
            authn: { journey: { readJourney } },
          }) as any,
      }
    );

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
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        resolveFrodoForRequest: () =>
          ({
            state: { getDeploymentType: () => detectedDeployment },
            login: { getTokens },
            user: { countUsers },
          }) as any,
      }
    );

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

  test('dispatch rejects a descriptor requiring log API credentials when none are configured', async () => {
    const fetch = jest.fn(async () => ({ result: [] }));
    const descriptor = makeDescriptor({
      id: 'cloud.log.fetch',
      toolName: 'frodo.cloud.log.fetch',
      methodName: 'fetch',
      modulePath: ['cloud', 'log'],
      domain: 'cloud',
      objectType: 'LogEvent',
      operationType: 'search',
      requiredCredential: 'logApi',
    });
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        resolveFrodoForRequest: () =>
          ({
            state: {
              getLogApiKey: () => undefined,
              getLogApiSecret: () => undefined,
            },
            login: { getTokens: jest.fn(async () => {}) },
            cloud: { log: { fetch } },
          }) as any,
      }
    );

    await expect(
      runtime.executeTool({
        toolName: 'frodo_dispatch_read_only',
        arguments: { skillId: descriptor.id },
        context: { auth: { mode: 'state-config', config: {} } },
      })
    ).rejects.toThrow('requires a Log API key/secret');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('dispatch executes a descriptor requiring log API credentials when they are configured', async () => {
    const fetch = jest.fn(async () => ({ result: [] }));
    const descriptor = makeDescriptor({
      id: 'cloud.log.fetch',
      toolName: 'frodo.cloud.log.fetch',
      methodName: 'fetch',
      modulePath: ['cloud', 'log'],
      domain: 'cloud',
      objectType: 'LogEvent',
      operationType: 'search',
      requiredCredential: 'logApi',
    });
    const runtime = createToolRuntime(
      makeManifest([descriptor]),
      [descriptor],
      {
        resolveFrodoForRequest: () =>
          ({
            state: {
              getLogApiKey: () => 'example-key-id',
              getLogApiSecret: () => 'example-secret',
            },
            login: { getTokens: jest.fn(async () => {}) },
            cloud: { log: { fetch } },
          }) as any,
      }
    );

    const result = await runtime.executeTool({
      toolName: 'frodo_dispatch_read_only',
      arguments: { skillId: descriptor.id },
      context: { auth: { mode: 'state-config', config: {} } },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual({ result: [] });
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
