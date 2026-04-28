/**
 * Verifies manifest-driven MCP runtime execution behavior.
 *
 * @remarks
 * These tests are intentionally network-free and use mocked Frodo instances to
 * validate routing, argument forwarding, request-scoped instance resolution,
 * and error handling guarantees.
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { FrodoError } from '../ops/FrodoError';
import { jest } from '@jest/globals';
import {
  McpCapabilityDescriptor,
  McpToolManifest,
  createToolRuntime,
  resolveRequestScopedFrodo,
} from '../index';

const mock = new MockAdapter(axios);

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
            methodName: descriptor.methodName,
            sourcePath: descriptor.id,
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
      operationDetailsByType: {},
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

  test('maps named args into descriptor parameter order for generic tools', async () => {
    const descriptor = makeDescriptor({
      id: 'authn.node.readNode',
      methodName: 'readNode',
      modulePath: ['authn', 'node'],
      objectType: 'Node',
      argumentMode: 'named',
      parameters: [
        {
          name: 'nodeId',
          type: 'string',
          required: true,
          position: 0,
        },
        {
          name: 'nodeType',
          type: 'string',
          required: true,
          position: 1,
        },
      ],
    } as any);
    const manifest = makeManifest(descriptor);
    manifest.discoveryTool.objectTypesByDomain = { authn: ['Journey', 'Node'] };
    manifest.discoveryTool.operationsByType = {
      read: ['authn.Journey', 'authn.Node'],
    };
    const readNode = jest.fn(async () => ({
      id: 'node-123',
      type: 'PageNode',
    }));

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: {
            node: {
              readNode,
            },
          },
        }) as any,
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_read',
      arguments: {
        domain: 'authn',
        objectType: 'Node',
        namedArgs: {
          nodeType: 'PageNode',
          nodeId: 'node-123',
        },
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(readNode).toHaveBeenCalledWith('node-123', 'PageNode');
    expect(result.data).toEqual({ id: 'node-123', type: 'PageNode' });
  });

  test('defaults scriptName to scriptId for script.createScript named args', async () => {
    const descriptor = makeDescriptor({
      id: 'script.createScript',
      toolName: 'frodo.script.createScript',
      methodName: 'createScript',
      modulePath: ['script'],
      domain: 'script',
      objectType: 'Script',
      operationType: 'create',
      argumentMode: 'named',
      parameters: [
        {
          name: 'scriptId',
          type: 'string',
          required: true,
          position: 0,
        },
        {
          name: 'scriptName',
          type: 'string',
          required: false,
          position: 1,
        },
        {
          name: 'scriptData',
          type: 'ScriptSkeleton',
          required: true,
          position: 2,
        },
      ],
    } as any);

    const manifest: McpToolManifest = {
      genericTools: [
        {
          toolName: 'frodo_create',
          operationType: 'create',
          description: 'Create object.',
          annotations: descriptor.annotations,
          riskClass: descriptor.riskClass,
          supportedObjectTypes: [
            {
              domain: descriptor.domain,
              objectType: descriptor.objectType,
              descriptorId: descriptor.id,
              methodName: descriptor.methodName,
              sourcePath: descriptor.id,
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
        domains: ['script'],
        objectTypesByDomain: { script: ['Script'] },
        operationsByType: { create: ['script.Script'] },
        operationDetailsByType: {},
      },
      backingDescriptorCount: 1,
      totalToolCount: 2,
    };

    const createScript = jest.fn(async () => ({ _id: 'mcp-script-1' }));

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          script: {
            createScript,
          },
        }) as any,
    });

    const scriptData = {
      context: 'OAUTH2_MAY_ACT',
      language: 'JAVASCRIPT',
      script: 'KGZ1bmN0aW9uICgpIHtyZXR1cm4gdHJ1ZTt9KCk7',
    };

    const result = await runtime.executeTool({
      toolName: 'frodo_create',
      arguments: {
        domain: 'script',
        objectType: 'Script',
        namedArgs: {
          scriptId: 'mcp-script-1',
          scriptData,
        },
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(createScript).toHaveBeenCalledWith(
      'mcp-script-1',
      'mcp-script-1',
      scriptData
    );
    expect(result.data).toEqual({ _id: 'mcp-script-1' });
  });

  test('rejects positional args for named-only generic contracts', async () => {
    const descriptor = makeDescriptor({
      id: 'authn.node.readNode',
      methodName: 'readNode',
      modulePath: ['authn', 'node'],
      objectType: 'Node',
      argumentMode: 'named',
      parameters: [
        {
          name: 'nodeId',
          type: 'string',
          required: true,
          position: 0,
        },
        {
          name: 'nodeType',
          type: 'string',
          required: true,
          position: 1,
        },
      ],
    } as any);
    const manifest = makeManifest(descriptor);
    manifest.discoveryTool.objectTypesByDomain = { authn: ['Journey', 'Node'] };
    manifest.discoveryTool.operationsByType = {
      read: ['authn.Journey', 'authn.Node'],
    };

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: {
            node: {
              readNode: jest.fn(async () => ({ id: 'node-123' })),
            },
          },
        }) as any,
    });

    await expect(
      runtime.executeTool({
        toolName: 'frodo_read',
        arguments: {
          domain: 'authn',
          objectType: 'Node',
          positionalArgs: ['node-123', 'PageNode'],
        },
        context: {
          auth: {
            mode: 'state-config',
            config: {},
          },
        },
      })
    ).rejects.toThrow('requires namedArgs');
  });

  test('gives actionable errors for unsupported generic search combinations', async () => {
    const readDescriptor = makeDescriptor();
    const searchDescriptor = makeDescriptor({
      id: 'role.queryInternalRoles',
      toolName: 'frodo.role.queryInternalRoles',
      methodName: 'queryInternalRoles',
      modulePath: ['role'],
      domain: 'role',
      objectType: 'InternalRole',
      operationType: 'search',
    });
    const manifest: McpToolManifest = {
      genericTools: [
        {
          toolName: 'frodo_read',
          operationType: 'read',
          description: 'Read object.',
          annotations: readDescriptor.annotations,
          riskClass: readDescriptor.riskClass,
          supportedObjectTypes: [
            {
              domain: readDescriptor.domain,
              objectType: readDescriptor.objectType,
              descriptorId: readDescriptor.id,
              methodName: readDescriptor.methodName,
              sourcePath: readDescriptor.id,
              riskClass: readDescriptor.riskClass,
              annotations: readDescriptor.annotations,
            },
          ],
        },
        {
          toolName: 'frodo_search',
          operationType: 'search',
          description: 'Search roles.',
          annotations: searchDescriptor.annotations,
          riskClass: searchDescriptor.riskClass,
          supportedObjectTypes: [
            {
              domain: searchDescriptor.domain,
              objectType: searchDescriptor.objectType,
              descriptorId: searchDescriptor.id,
              methodName: searchDescriptor.methodName,
              sourcePath: searchDescriptor.id,
              riskClass: searchDescriptor.riskClass,
              annotations: searchDescriptor.annotations,
            },
          ],
        },
      ],
      specialTools: [],
      discoveryTool: {
        toolName: 'frodo_discover',
        description: 'Discover tool surface.',
        domains: ['authn', 'role'],
        objectTypesByDomain: { authn: ['Journey'], role: ['InternalRole'] },
        operationsByType: {
          read: ['authn.Journey'],
          search: ['role.InternalRole'],
        },
        operationDetailsByType: {},
        objectTypeOperationSupport: [
          {
            domain: 'authn',
            objectType: 'Journey',
            supportedOperations: ['read'],
            unsupportedOperations: ['search'],
          },
          {
            domain: 'role',
            objectType: 'InternalRole',
            supportedOperations: ['search'],
            unsupportedOperations: ['read'],
          },
        ],
      },
      backingDescriptorCount: 2,
      totalToolCount: 3,
    };

    const runtime = createToolRuntime(
      manifest,
      [readDescriptor, searchDescriptor],
      {
        resolveFrodoForRequest: () => ({}) as any,
      }
    );

    await expect(
      runtime.executeTool({
        toolName: 'frodo_search',
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
    ).rejects.toThrow(
      "Supported operations for 'authn.Journey': read. Use 'frodo_discover' to inspect supported combinations."
    );
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

  test('forwards generic paging controls into named search contracts', async () => {
    const descriptor = makeDescriptor({
      id: 'idm.system.querySystemObjects',
      toolName: 'frodo.idm.system.querySystemObjects',
      methodName: 'querySystemObjects',
      modulePath: ['idm', 'system'],
      domain: 'idm',
      objectType: 'SystemObject',
      operationType: 'search',
      argumentMode: 'named',
      parameters: [
        { name: 'systemName', type: 'string', required: true, position: 0 },
        {
          name: 'systemObjectType',
          type: 'string',
          required: true,
          position: 1,
        },
        { name: 'filter', type: 'string', required: true, position: 2 },
        { name: 'fields', type: 'string[]', required: false, position: 3 },
        { name: 'pageSize', type: 'integer', required: false, position: 4 },
        { name: 'pageCookie', type: 'string', required: false, position: 5 },
      ],
      supportsPaging: true,
    } as any);
    const querySystemObjects = jest.fn(async () => ({
      result: [{ uid: 'user.1' }],
      pagedResultsCookie: 'next-cookie',
      remainingPagedResults: 12,
    }));
    const manifest: McpToolManifest = {
      genericTools: [
        {
          toolName: 'frodo_search',
          operationType: 'search',
          description: 'Search system objects.',
          annotations: descriptor.annotations,
          riskClass: descriptor.riskClass,
          supportedObjectTypes: [
            {
              domain: descriptor.domain,
              objectType: descriptor.objectType,
              descriptorId: descriptor.id,
              methodName: descriptor.methodName,
              sourcePath: descriptor.id,
              argumentMode: descriptor.argumentMode,
              parameters: descriptor.parameters,
              supportsPaging: descriptor.supportsPaging,
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
        domains: ['idm'],
        objectTypesByDomain: { idm: ['SystemObject'] },
        operationsByType: { search: ['idm.SystemObject'] },
        operationDetailsByType: {},
      },
      backingDescriptorCount: 1,
      totalToolCount: 2,
    };

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          idm: {
            system: {
              querySystemObjects,
            },
          },
        }) as any,
    });

    await runtime.executeTool({
      toolName: 'frodo_search',
      arguments: {
        domain: 'idm',
        objectType: 'SystemObject',
        pageSize: 250,
        pageToken: 'next-cookie',
        namedArgs: {
          systemName: 'ldap',
          systemObjectType: 'account',
          filter: "uid sw 'a'",
          fields: ['uid'],
        },
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(querySystemObjects).toHaveBeenCalledWith(
      'ldap',
      'account',
      "uid sw 'a'",
      ['uid'],
      250,
      'next-cookie'
    );
  });

  test('routes idm managed-object search through the paged API adapter', async () => {
    const descriptor = makeDescriptor({
      id: 'idm.managed.queryManagedObjects',
      toolName: 'frodo.idm.managed.queryManagedObjects',
      methodName: 'queryManagedObjects',
      modulePath: ['idm', 'managed'],
      domain: 'idm',
      objectType: 'ManagedObject',
      operationType: 'search',
      argumentMode: 'named',
      parameters: [
        { name: 'type', type: 'string', required: true, position: 0 },
        { name: 'filter', type: 'string', required: false, position: 1 },
        { name: 'fields', type: 'string[]', required: false, position: 2 },
        { name: 'pageSize', type: 'integer', required: false, position: 3 },
        { name: 'pageCookie', type: 'string', required: false, position: 4 },
      ],
      supportsPaging: true,
      supportsIncludeTotal: true,
    });
    const manifest: McpToolManifest = {
      genericTools: [
        {
          toolName: 'frodo_search',
          operationType: 'search',
          description: 'Search managed objects.',
          annotations: descriptor.annotations,
          riskClass: descriptor.riskClass,
          supportedObjectTypes: [
            {
              domain: descriptor.domain,
              objectType: descriptor.objectType,
              descriptorId: descriptor.id,
              methodName: descriptor.methodName,
              sourcePath: descriptor.id,
              argumentMode: descriptor.argumentMode,
              parameters: descriptor.parameters,
              supportsPaging: descriptor.supportsPaging,
              supportsIncludeTotal: descriptor.supportsIncludeTotal,
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
        domains: ['idm'],
        objectTypesByDomain: { idm: ['ManagedObject'] },
        operationsByType: { search: ['idm.ManagedObject'] },
        operationDetailsByType: {},
      },
      backingDescriptorCount: 1,
      totalToolCount: 2,
    };
    mock.reset();
    mock
      .onGet(
        'https://tenant.example/openidm/managed/alpha_user?_queryFilter=true&_pageSize=10&_fields=userName,_id&_pagedResultsCookie=next-cookie'
      )
      .reply(200, {
        result: [{ _id: 'user-1' }],
        resultCount: 1,
        pagedResultsCookie: 'next-cookie',
        totalPagedResultsPolicy: 'EXACT',
        totalPagedResults: 2019,
        remainingPagedResults: 2009,
      });

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          state: {
            getIdmHost: jest.fn(() => 'https://tenant.example/openidm'),
            getHost: jest.fn(() => 'https://tenant.example/am'),
            getAuthenticationHeaderOverrides: jest.fn(() => ({})),
            getConfigurationHeaderOverrides: jest.fn(() => ({})),
            getBearerToken: jest.fn(() => undefined),
            getAllowInsecureConnection: jest.fn(() => false),
            getCurlirize: jest.fn(() => false),
            getAxiosRetryConfig: jest.fn(() => undefined),
          },
          login: { getTokens: jest.fn(async () => {}) },
          idm: {
            managed: {
              queryManagedObjects: jest.fn(async () => ['should-not-be-used']),
            },
          },
        }) as any,
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_search',
      arguments: {
        domain: 'idm',
        objectType: 'ManagedObject',
        pageSize: 10,
        pageToken: 'next-cookie',
        namedArgs: {
          type: 'alpha_user',
          fields: ['userName', '_id'],
        },
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(result.data).toEqual({
      result: [{ _id: 'user-1' }],
      resultCount: 1,
      pagedResultsCookie: 'next-cookie',
      totalPagedResultsPolicy: 'EXACT',
      totalPagedResults: 2019,
      remainingPagedResults: 2009,
    });
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
              methodName: descriptor.methodName,
              sourcePath: descriptor.id,
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
        operationDetailsByType: {},
      },
      backingDescriptorCount: 1,
      totalToolCount: 2,
    };
    const listUsers = jest.fn(async () =>
      Array.from({ length: 1000 }, (_, i) => ({ id: i }))
    );

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

  test('rejects invalid structured named args using the parameter schema contract', async () => {
    const descriptor = makeDescriptor({
      id: 'authn.journey.exportJourney',
      toolName: 'frodo.authn.journey.exportJourney',
      methodName: 'exportJourney',
      modulePath: ['authn', 'journey'],
      objectType: 'Journey',
      operationType: 'export',
      argumentMode: 'named',
      scope: 'single',
      parameters: [
        {
          name: 'journeyId',
          type: 'string',
          required: true,
          position: 0,
        },
        {
          name: 'options',
          type: 'TreeExportOptions',
          required: false,
          position: 1,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              deps: { type: 'boolean' },
              useStringArrays: { type: 'boolean' },
              coords: { type: 'boolean' },
            },
          },
          examples: [{ deps: false, useStringArrays: true, coords: true }],
          defaultValue: {
            deps: false,
            useStringArrays: true,
            coords: true,
          },
        },
      ],
    } as any);
    const manifest: McpToolManifest = {
      genericTools: [
        {
          toolName: 'frodo_export',
          operationType: 'export',
          description: 'Export journey.',
          annotations: descriptor.annotations,
          riskClass: descriptor.riskClass,
          supportedObjectTypes: [
            {
              domain: descriptor.domain,
              objectType: descriptor.objectType,
              descriptorId: descriptor.id,
              methodName: descriptor.methodName,
              sourcePath: descriptor.id,
              argumentMode: descriptor.argumentMode,
              parameters: descriptor.parameters,
              scope: descriptor.scope,
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
        domains: ['authn'],
        objectTypesByDomain: { authn: ['Journey'] },
        operationsByType: { export: ['authn.Journey'] },
        operationDetailsByType: {},
      },
      backingDescriptorCount: 1,
      totalToolCount: 2,
    };

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: {
            journey: {
              exportJourney: jest.fn(async () => ({ tree: { _id: 'Azure' } })),
            },
          },
        }) as any,
    });

    await expect(
      runtime.executeTool({
        toolName: 'frodo_export',
        arguments: {
          domain: 'authn',
          objectType: 'Journey',
          scope: 'single',
          namedArgs: {
            journeyId: 'Azure',
            options: {
              deps: 'yes',
              unexpected: true,
            },
          },
        },
        context: {
          auth: {
            mode: 'state-config',
            config: {},
          },
        },
      })
    ).rejects.toThrow(
      'expected object with fields deps?: boolean, useStringArrays?: boolean, coords?: boolean'
    );
  });

  test('applies thin MCP default options for journey export when options are omitted', async () => {
    const descriptor = makeDescriptor({
      id: 'authn.journey.exportJourney',
      toolName: 'frodo.authn.journey.exportJourney',
      methodName: 'exportJourney',
      modulePath: ['authn', 'journey'],
      objectType: 'Journey',
      operationType: 'export',
      argumentMode: 'named',
      scope: 'single',
      parameters: [
        {
          name: 'journeyId',
          type: 'string',
          required: true,
          position: 0,
        },
        {
          name: 'options',
          type: 'TreeExportOptions',
          required: false,
          position: 1,
          defaultValue: {
            deps: false,
            useStringArrays: true,
            coords: true,
          },
        },
      ],
    } as any);
    const manifest: McpToolManifest = {
      genericTools: [
        {
          toolName: 'frodo_export',
          operationType: 'export',
          description: 'Export journey.',
          annotations: descriptor.annotations,
          riskClass: descriptor.riskClass,
          supportedObjectTypes: [
            {
              domain: descriptor.domain,
              objectType: descriptor.objectType,
              descriptorId: descriptor.id,
              methodName: descriptor.methodName,
              sourcePath: descriptor.id,
              argumentMode: descriptor.argumentMode,
              parameters: descriptor.parameters,
              scope: descriptor.scope,
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
        domains: ['authn'],
        objectTypesByDomain: { authn: ['Journey'] },
        operationsByType: { export: ['authn.Journey'] },
        operationDetailsByType: {},
      },
      backingDescriptorCount: 1,
      totalToolCount: 2,
    };
    const exportJourney = jest.fn(async () => ({
      tree: { _id: 'Azure' },
      nodes: { one: {}, two: {} },
      scripts: { script1: {} },
      themes: [],
    }));

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: {
            journey: {
              exportJourney,
            },
          },
        }) as any,
    });

    await runtime.executeTool({
      toolName: 'frodo_export',
      arguments: {
        domain: 'authn',
        objectType: 'Journey',
        scope: 'single',
        namedArgs: {
          journeyId: 'Azure',
        },
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(exportJourney).toHaveBeenCalledWith('Azure', {
      deps: false,
      useStringArrays: true,
      coords: true,
    });
  });

  test('adds result summary metadata for structured export payloads', async () => {
    const descriptor = makeDescriptor({
      id: 'authn.journey.exportJourney',
      toolName: 'frodo.authn.journey.exportJourney',
      methodName: 'exportJourney',
      modulePath: ['authn', 'journey'],
      objectType: 'Journey',
      operationType: 'export',
      argumentMode: 'named',
      scope: 'single',
      parameters: [
        {
          name: 'journeyId',
          type: 'string',
          required: true,
          position: 0,
        },
      ],
    } as any);
    const manifest: McpToolManifest = {
      genericTools: [
        {
          toolName: 'frodo_export',
          operationType: 'export',
          description: 'Export journey.',
          annotations: descriptor.annotations,
          riskClass: descriptor.riskClass,
          supportedObjectTypes: [
            {
              domain: descriptor.domain,
              objectType: descriptor.objectType,
              descriptorId: descriptor.id,
              methodName: descriptor.methodName,
              sourcePath: descriptor.id,
              argumentMode: descriptor.argumentMode,
              parameters: descriptor.parameters,
              scope: descriptor.scope,
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
        domains: ['authn'],
        objectTypesByDomain: { authn: ['Journey'] },
        operationsByType: { export: ['authn.Journey'] },
        operationDetailsByType: {},
      },
      backingDescriptorCount: 1,
      totalToolCount: 2,
    };
    const exportJourney = jest.fn(async () => ({
      tree: { _id: 'Azure' },
      nodes: { one: {}, two: {} },
      scripts: { script1: {} },
      themes: [],
    }));

    const runtime = createToolRuntime(manifest, [descriptor], {
      resolveFrodoForRequest: () =>
        ({
          login: { getTokens: jest.fn(async () => {}) },
          authn: {
            journey: {
              exportJourney,
            },
          },
        }) as any,
    });

    const result = await runtime.executeTool({
      toolName: 'frodo_export',
      arguments: {
        domain: 'authn',
        objectType: 'Journey',
        scope: 'single',
        namedArgs: {
          journeyId: 'Azure',
        },
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(result.metadata?.result?.topLevelType).toBe('object');
    expect(result.metadata?.result?.payloadSizeBytes).toBeGreaterThan(0);
    expect(result.metadata?.result?.fieldCounts).toEqual(
      expect.objectContaining({
        nodes: 2,
        scripts: 1,
        themes: 0,
      })
    );
  });

  test('flags large results with actionable summary metadata', async () => {
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
              methodName: descriptor.methodName,
              sourcePath: descriptor.id,
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
        operationDetailsByType: {},
      },
      backingDescriptorCount: 1,
      totalToolCount: 2,
    };
    const listUsers = jest.fn(async () => [
      { id: 1, blob: 'x'.repeat(256) },
      { id: 2, blob: 'y'.repeat(256) },
    ]);

    const runtime = createToolRuntime(manifest, [descriptor], {
      paginationWarningThreshold: 1000,
      resultWarningThresholdBytes: 100,
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
      },
      context: {
        auth: {
          mode: 'state-config',
          config: {},
        },
      },
    });

    expect(result.metadata?.result?.isLarge).toBe(true);
    expect(result.metadata?.result?.warning).toContain('narrow the request');
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

    const runtime = createToolRuntime(
      manifest,
      [genericDescriptor, specialDescriptor],
      {
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
      }
    );

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
      resolveFrodoForRequest: () => ({}) as any,
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
      resolveFrodoForRequest: () => ({}) as any,
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
              methodName: descriptor.methodName,
              sourcePath: descriptor.id,
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
        operationDetailsByType: {},
      },
      backingDescriptorCount: 1,
      totalToolCount: 2,
    };

    const resolver = jest.fn(
      () =>
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
    ).rejects.toThrow(
      "descriptor 'user.countUsers' is not supported for deployment 'cloud'"
    );

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

    expect(createInstance).toHaveBeenCalledWith({
      host: 'https://example.com/am',
    });
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
