/**
 * Regression coverage for Phase H: wiring browser login (`auth.mode:
 * 'browser'`) into the MCP tool runtime.
 */
import { jest } from '@jest/globals';

import type { Frodo } from '../lib/FrodoLib';
import StateImpl from '../shared/State';
import type { McpCapabilityDescriptor } from './CapabilityTypes';
import type { McpToolManifest } from './ToolManifest';
import {
  createToolRuntime,
  getRealmFromContext,
  McpRuntimeRequestContext,
  resolveRequestScopedFrodo,
} from './ToolRuntime';

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
    trustTier: 'full-trust',
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
    ],
    discoveryTool: {
      toolName: 'frodo_discover',
      description: 'Discover tool surface.',
      domains: ['authn'],
      objectTypesByDomain: { authn: ['Journey'] },
      operationsByType: { read: ['authn.Journey'] },
      operationDetailsByType: {},
      objectTypeOperationSupport: [],
    },
    backingDescriptorCount: descriptors.length,
    totalToolCount: 4,
  };
}

describe('resolveRequestScopedFrodo() — browser mode', () => {
  test('delegates to createInstanceWithBrowserLogin with the context fields, and nothing else', () => {
    const fakeInstance = { marker: 'fake-instance' } as unknown as Frodo;
    const createInstanceWithBrowserLogin = jest.fn(() => fakeInstance);
    const frodoRoot = {
      createInstanceWithBrowserLogin,
    } as unknown as Frodo;

    const context: McpRuntimeRequestContext = {
      auth: {
        mode: 'browser',
        host: 'https://openam-forgeops.example.com/am',
        deploymentType: 'forgeops',
        realm: 'alpha',
        loginClientId: 'my-mcp-browser-client',
        loginScope: 'openid fr:idm:*',
        loginRedirectUri: 'http://127.0.0.1:54321/callback',
      },
    };

    const result = resolveRequestScopedFrodo(context, frodoRoot);

    expect(result).toBe(fakeInstance);
    expect(createInstanceWithBrowserLogin).toHaveBeenCalledWith(
      'https://openam-forgeops.example.com/am',
      'my-mcp-browser-client',
      'openid fr:idm:*',
      'http://127.0.0.1:54321/callback',
      'alpha',
      'forgeops',
      undefined,
      undefined,
      undefined
    );
  });
});

describe('getRealmFromContext() — browser mode', () => {
  test('reads the realm from a browser auth context', () => {
    const context: McpRuntimeRequestContext = {
      auth: {
        mode: 'browser',
        host: 'https://openam-classic.example.com/am',
        realm: 'bravo',
      },
    };
    expect(getRealmFromContext(context)).toBe('bravo');
  });
});

describe('MCP runtime — browser-login auth mode end to end', () => {
  test('throws a clear error when no browserLoginPromptHandler is configured', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest([descriptor]);
    const fakeInstance = {
      login: {
        getTokensInteractive: jest.fn(),
        getTokens: jest.fn(),
      },
    } as unknown as Frodo;
    const frodoRoot = {
      createInstanceWithBrowserLogin: jest.fn(() => fakeInstance),
    } as unknown as Frodo;

    const runtime = createToolRuntime(manifest, [descriptor], { frodoRoot });

    await expect(
      runtime.executeTool({
        toolName: 'frodo_discover',
        context: {
          auth: {
            mode: 'browser',
            host: 'https://openam-forgeops.example.com/am',
          },
        },
      })
    ).rejects.toThrow(/requires a browserLoginPromptHandler/);
    expect(fakeInstance.login.getTokensInteractive).not.toHaveBeenCalled();
  });

  test('calls getTokensInteractive() (not getTokens()) with the supplied promptHandler and context fields', async () => {
    const descriptor = makeDescriptor();
    const manifest = makeManifest([descriptor]);
    const getTokensInteractive = jest.fn(async () => ({}));
    const getTokens = jest.fn(async () => ({}));
    const readJourney = jest.fn(async () => ({ _id: 'Login' }));
    const fakeInstance = {
      state: { getDeploymentType: () => 'forgeops' },
      login: { getTokensInteractive, getTokens },
      authn: { journey: { readJourney } },
    } as unknown as Frodo;
    const frodoRoot = {
      createInstanceWithBrowserLogin: jest.fn(() => fakeInstance),
    } as unknown as Frodo;
    const browserLoginPromptHandler = jest.fn(async () => {});

    const runtime = createToolRuntime(manifest, [descriptor], {
      frodoRoot,
      browserLoginPromptHandler,
    });

    // Deliberately no deploymentType in context — a dispatch call always
    // resolves and authenticates a scoped instance regardless (unlike
    // frodo_discover's fast path when the deployment type is already known),
    // so this reaches resolveScopedFrodoInstance()'s browser-mode branch.
    await runtime.executeTool({
      toolName: 'frodo_dispatch_read_only',
      context: {
        auth: {
          mode: 'browser',
          host: 'https://openam-forgeops.example.com/am',
          loginClientId: 'my-mcp-browser-client',
          useDeviceFlow: true,
        },
      },
      arguments: {
        domain: 'authn',
        objectType: 'Journey',
        operationType: 'read',
        namedArgs: {},
      },
    });

    expect(getTokens).not.toHaveBeenCalled();
    expect(getTokensInteractive).toHaveBeenCalledTimes(1);
    expect(getTokensInteractive).toHaveBeenCalledWith(
      expect.objectContaining({
        loginClientId: 'my-mcp-browser-client',
        useDeviceFlow: true,
        promptHandler: browserLoginPromptHandler,
      })
    );
    expect(readJourney).toHaveBeenCalledTimes(1);
  });
});

describe('assertTrustTierAllowed — Phase G enforcement', () => {
  function makeBrowserFakeInstance(readJourney: jest.Mock) {
    const state = StateImpl({ host: 'https://openam-forgeops.example.com/am' });
    state.setAuthMode('interactive');
    return {
      state,
      login: {
        getTokensInteractive: jest.fn(async () => ({})),
        getTokens: jest.fn(async () => ({})),
      },
      authn: { journey: { readJourney } },
    } as unknown as Frodo;
  }

  async function dispatchReadJourney(
    manifest: McpToolManifest,
    descriptor: McpCapabilityDescriptor,
    frodoRoot: Frodo,
    auth: McpRuntimeRequestContext['auth']
  ) {
    const runtime = createToolRuntime(manifest, [descriptor], {
      frodoRoot,
      browserLoginPromptHandler: jest.fn(async () => {}),
    });
    return runtime.executeTool({
      toolName: 'frodo_dispatch_read_only',
      context: { auth },
      arguments: {
        domain: 'authn',
        objectType: 'Journey',
        operationType: 'read',
        namedArgs: {},
      },
    });
  }

  test('a delegated caller is rejected from a full-trust-only descriptor', async () => {
    const descriptor = makeDescriptor({ trustTier: 'full-trust' });
    const manifest = makeManifest([descriptor]);
    const readJourney = jest.fn(async () => ({ _id: 'Login' }));
    const frodoRoot = {
      createInstanceWithBrowserLogin: jest.fn(() =>
        makeBrowserFakeInstance(readJourney)
      ),
    } as unknown as Frodo;

    await expect(
      dispatchReadJourney(manifest, descriptor, frodoRoot, {
        mode: 'browser',
        host: 'https://openam-forgeops.example.com/am',
        loginClientId: 'my-mcp-browser-client',
      })
    ).rejects.toThrow(/requires trust tier 'full-trust'/);
    expect(readJourney).not.toHaveBeenCalled();
  });

  test('a delegated caller is allowed to invoke a both-tier descriptor', async () => {
    const descriptor = makeDescriptor({ trustTier: 'both' });
    const manifest = makeManifest([descriptor]);
    const readJourney = jest.fn(async () => ({ _id: 'Login' }));
    const frodoRoot = {
      createInstanceWithBrowserLogin: jest.fn(() =>
        makeBrowserFakeInstance(readJourney)
      ),
    } as unknown as Frodo;

    await dispatchReadJourney(manifest, descriptor, frodoRoot, {
      mode: 'browser',
      host: 'https://openam-forgeops.example.com/am',
      loginClientId: 'my-mcp-browser-client',
    });

    expect(readJourney).toHaveBeenCalledTimes(1);
  });

  test('a full-trust caller (e.g. admin-account) can invoke a delegated-only descriptor — full-trust is a superset, not a separate exclusive tier', async () => {
    const descriptor = makeDescriptor({ trustTier: 'delegated' });
    const manifest = makeManifest([descriptor]);
    const readJourney = jest.fn(async () => ({ _id: 'Login' }));
    const state = StateImpl({ host: 'https://openam-example.com/am' });
    const fakeInstance = {
      state,
      login: {
        getTokens: jest.fn(async () => ({})),
        getTokensInteractive: jest.fn(async () => ({})),
      },
      authn: { journey: { readJourney } },
    } as unknown as Frodo;
    const frodoRoot = {
      createInstanceWithAdminAccount: jest.fn(() => fakeInstance),
    } as unknown as Frodo;

    await dispatchReadJourney(manifest, descriptor, frodoRoot, {
      mode: 'admin-account',
      host: 'https://openam-example.com/am',
      username: 'amadmin',
      password: 'secret',
    });

    expect(readJourney).toHaveBeenCalledTimes(1);
  });
});
