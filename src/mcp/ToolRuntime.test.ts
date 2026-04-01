/**
 * Verifies manifest-driven MCP runtime execution behavior.
 *
 * @remarks
 * These tests are intentionally network-free and use mocked Frodo instances to
 * validate routing, argument forwarding, request-scoped instance resolution,
 * and error handling guarantees.
 */

import { FrodoError } from '../ops/FrodoError';
import { jest } from '@jest/globals';
import {
  McpCapabilityDescriptor,
  McpToolManifest,
  createToolRuntime,
  resolveRequestScopedFrodo,
} from '../index';

/**
 * Builds a minimal descriptor fixture for runtime tests.
 *
 * @param overrides Optional partial overrides.
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

/**
 * Builds a minimal manifest fixture for runtime tests.
 *
 * @param descriptor Generic descriptor fixture.
 * @param specialDescriptor Optional special descriptor fixture.
 * @returns Manifest fixture.
 */
function makeManifest(
  descriptor: McpCapabilityDescriptor,
  specialDescriptor?: McpCapabilityDescriptor
): McpToolManifest {
  return {
    genericTools: [
      {
        toolName: 'frodo_read',
        operationType: 'read',
        description: 'Read object.',
        annotations: descriptor.annotations,
        riskClass: descriptor.riskClass,
        supportedObjectTypes: [
          {
            domain: descriptor.domain,
            objectType: descriptor.objectType,
            descriptorId: descriptor.id,
            riskClass: descriptor.riskClass,
            annotations: descriptor.annotations,
          },
        ],
      },
    ],
    specialTools: specialDescriptor
      ? [
          {
            toolName: specialDescriptor.toolName,
            domain: specialDescriptor.domain,
            description: 'Special operation.',
            descriptor: specialDescriptor,
          },
        ]
      : [],
    discoveryTool: {
      toolName: 'frodo_discover',
      description: 'Discover tool surface.',
      domains: ['authn'],
      objectTypesByDomain: { authn: ['Journey'] },
      operationsByType: { read: ['authn.Journey'] },
    },
    backingDescriptorCount: specialDescriptor ? 2 : 1,
    totalToolCount: specialDescriptor ? 3 : 2,
  };
}

describe('MCP tool runtime', () => {
  test('returns discovery payload without resolving a scoped instance', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest(descriptor);

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () => {
        throw new Error('resolver should not be called for discovery');
      },
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_discover',
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(result.toolName).toBe('frodo_discover');
    expect(result.descriptorId).toBeUndefined();
    expect(result.data).toEqual(manifest.discoveryTool);
  });

  test('executes a generic tool via descriptor lookup and forwards positional args', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest(descriptor);
    const readJourney = jest.fn(async () => ({ id: 'journey1' }));

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
      toolName: 'frodo_read',
      arguments: {
        domain: 'authn',
        objectType: 'Journey',
        positionalArgs: ['journey1'],
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(readJourney).toHaveBeenCalledWith('journey1');
    expect(result.descriptorId).toBe('authn.journey.readJourney');
    expect(result.data).toEqual({ id: 'journey1' });
  });

  test('applies realm override from generic arguments to state-config context', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest(descriptor);
    const readJourney = jest.fn(async () => ({ id: 'journey1' }));
    let capturedContext: any;

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: (context) => {
        capturedContext = context;
        return {
          login: { getTokens: jest.fn(async () => {}) },
          authn: {
            journey: {
              readJourney,
            },
          },
        } as any;
      },
    });

    await runtime.executeTool({
      toolName: 'frodo_read',
      arguments: {
        domain: 'authn',
        objectType: 'Journey',
        realm: '/bravo',
        positionalArgs: ['journey1'],
      },
      context: {
        auth: {
          mode: 'state-config',
          config: { host: 'https://example.com/am', realm: '/alpha' },
        },
      },
    });

    expect(capturedContext.auth.mode).toBe('state-config');
    expect(capturedContext.auth.config.realm).toBe('/bravo');
  });

  test('adds pagination warning metadata for likely truncated list responses', async () => {
    const descriptor = makeDescriptor({
      id: 'user.user.listUsers',
      domain: 'user',
      objectType: 'User',
      methodName: 'listUsers',
      modulePath: ['user'],
      operationType: 'list',
    });
    const manifest: McpToolManifest = {
      genericTools: [
        {
          toolName: 'frodo_list',
          operationType: 'list',
          description: 'List users.',
          annotations: descriptor.annotations,
          riskClass: descriptor.riskClass,
          supportedObjectTypes: [
            {
              domain: 'user',
              objectType: 'User',
              descriptorId: descriptor.id,
              riskClass: descriptor.riskClass,
              annotations: descriptor.annotations,
            },
          ],
        },
      ],
      specialTools: [],
      discoveryTool: {
        toolName: 'frodo_discover',
        description: 'Discover tool surface.',
        domains: ['user'],
        objectTypesByDomain: { user: ['User'] },
        operationsByType: { list: ['user.User'] },
      },
      backingDescriptorCount: 1,
      totalToolCount: 2,
    };
    const listUsers = jest.fn(async () => Array.from({ length: 1000 }, (_, i) => ({ id: i })));

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          user: {
            listUsers,
          },
        }) as any,
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_list',
      arguments: {
        domain: 'user',
        objectType: 'User',
        realm: '/alpha',
      },
      context: {
        auth: {
          mode: 'state-config',
          config: { host: 'https://example.com/am' },
        },
      },
    });

    expect(result.metadata?.pagination?.isPartial).toBe(true);
    expect(result.metadata?.pagination?.returnedCount).toBe(1000);
    expect(result.metadata?.scope?.requestedRealm).toBe('/alpha');
  });

  test('executes a special tool and forwards named args as one argument object', async () => {
    const genericDescriptor = makeDescriptor();
    const specialDescriptor = makeDescriptor({
      id: 'authn.journey.enableJourney',
      toolName: 'frodo.authn.journey.enableJourney',
      methodName: 'enableJourney',
      operationType: 'special',
      kind: 'special',
      objectType: 'journey',
      riskClass: 'medium',
      mutating: true,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    });
    const manifest = makeManifest(genericDescriptor, specialDescriptor);
    const enableJourney = jest.fn(async () => ({ enabled: true }));

    const runtime = createToolRuntime(manifest, [genericDescriptor, specialDescriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: {
            journey: {
              readJourney: jest.fn(),
              enableJourney,
            },
          },
        }) as any,
    });

    const result = await runtime.executeTool({
      toolName: 'frodo.authn.journey.enableJourney',
      arguments: {
        namedArgs: {
          journeyId: 'journey1',
          enabled: true,
        },
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(enableJourney).toHaveBeenCalledWith({
      journeyId: 'journey1',
      enabled: true,
    });
    expect(result.descriptorId).toBe('authn.journey.enableJourney');
    expect(result.data).toEqual({ enabled: true });
  });

  test('throws when generic tool arguments are missing required domain/objectType', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest(descriptor);

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () => ({} as any),
    });

    await expect(
      runtime.executeTool({
        toolName: 'frodo_read',
        arguments: {},
        context: {
          auth: {
            mode: 'state-config',
            config: {},
          },
        },
      })
    ).rejects.toThrow('generic tools require a string domain argument');
  });

  test('throws unknown-tool error for tools not present in the manifest', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest(descriptor);

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () => ({} as any),
    });

    await expect(
      runtime.executeTool({
        toolName: 'frodo_nonexistent',
        context: {
          auth: {
            mode: 'state-config',
            config: {},
          },
        },
      })
    ).rejects.toThrow("unknown tool 'frodo_nonexistent'");
  });

  test('wraps underlying invocation errors in FrodoError', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest(descriptor);

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: {
            journey: {
              readJourney: jest.fn(async () => {
                throw new Error('network down');
              }),
            },
          },
        }) as any,
    });

    await expect(
      runtime.executeTool({
        toolName: 'frodo_read',
        arguments: {
          domain: 'authn',
          objectType: 'Journey',
          positionalArgs: ['journey1'],
        },
        context: {
          auth: {
            mode: 'state-config',
            config: {},
          },
        },
      })
    ).rejects.toBeInstanceOf(FrodoError);
  });

  test('rejects deployment-incompatible descriptor for generic tools', async () => {
    const descriptor = makeDescriptor({
      id: 'user.countUsers',
      methodName: 'countUsers',
      modulePath: ['user'],
      domain: 'user',
      objectType: 'User',
      operationType: 'count',
      deploymentTypes: ['classic'],
    });
    const manifest: McpToolManifest = {
      genericTools: [
        {
          toolName: 'frodo_count',
          operationType: 'count',
          description: 'Count users.',
          annotations: descriptor.annotations,
          riskClass: descriptor.riskClass,
          supportedObjectTypes: [
            {
              domain: descriptor.domain,
              objectType: descriptor.objectType,
              descriptorId: descriptor.id,
              riskClass: descriptor.riskClass,
              annotations: descriptor.annotations,
            },
          ],
        },
      ],
      specialTools: [],
      discoveryTool: {
        toolName: 'frodo_discover',
        description: 'Discover tool surface.',
        domains: ['user'],
        objectTypesByDomain: { user: ['User'] },
        operationsByType: { count: ['user.User'] },
      },
      backingDescriptorCount: 1,
      totalToolCount: 2,
    };

    const resolver = jest.fn(() =>
      ({
        login: { getTokens: jest.fn(async () => {}) },
        user: {
          countUsers: jest.fn(async () => 1),
        },
      }) as any
    );

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: resolver,
    });

    await expect(
      runtime.executeTool({
        toolName: 'frodo_count',
        arguments: {
          domain: 'user',
          objectType: 'User',
        },
        context: {
          auth: {
            mode: 'state-config',
            config: {
              deploymentType: 'cloud',
            } as any,
          },
        },
      })
    ).rejects.toThrow("descriptor 'user.countUsers' is not supported for deployment 'cloud'");

    expect(resolver).not.toHaveBeenCalled();
  });
});

describe('resolveRequestScopedFrodo', () => {
  test('uses createInstance for state-config auth', () => {
    const scoped = { id: 'scoped-state' } as any;
    const createInstance = jest.fn().mockReturnValue(scoped);

    const result = resolveRequestScopedFrodo(
      {
        auth: {
          mode: 'state-config',
          config: { host: 'https://example.com/am' },
        },
      },
      {
        createInstance,
      } as any
    );

    expect(createInstance).toHaveBeenCalledWith({ host: 'https://example.com/am' });
    expect(result).toBe(scoped);
  });

  test('uses createInstanceWithServiceAccount for service-account auth', () => {
    const scoped = { id: 'scoped-service' } as any;
    const createInstanceWithServiceAccount = jest.fn().mockReturnValue(scoped);

    const result = resolveRequestScopedFrodo(
      {
        auth: {
          mode: 'service-account',
          host: 'https://example.com/am',
          serviceAccountId: 'sa-123',
          serviceAccountJwk: { kty: 'RSA' },
          realm: 'alpha',
          deploymentType: 'cloud',
          allowInsecureConnection: true,
          debug: true,
          curlirize: true,
        },
      },
      {
        createInstanceWithServiceAccount,
      } as any
    );

    expect(createInstanceWithServiceAccount).toHaveBeenCalledWith(
      'https://example.com/am',
      'sa-123',
      JSON.stringify({ kty: 'RSA' }),
      'alpha',
      'cloud',
      true,
      true,
      true
    );
    expect(result).toBe(scoped);
  });

  test('uses createInstanceWithAdminAccount for admin-account auth', () => {
    const scoped = { id: 'scoped-admin' } as any;
    const createInstanceWithAdminAccount = jest.fn().mockReturnValue(scoped);

    const result = resolveRequestScopedFrodo(
      {
        auth: {
          mode: 'admin-account',
          host: 'https://example.com/am',
          username: 'admin',
          password: 'secret',
          realm: 'alpha',
        },
      },
      {
        createInstanceWithAdminAccount,
      } as any
    );

    expect(createInstanceWithAdminAccount).toHaveBeenCalledWith(
      'https://example.com/am',
      'admin',
      'secret',
      'alpha',
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(result).toBe(scoped);
  });
});
