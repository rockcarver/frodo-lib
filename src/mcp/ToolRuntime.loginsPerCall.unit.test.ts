/**
 * Run tests
 *
 *        npm run test:only ToolRuntime.loginsPerCall
 *
 * Baseline for the session churn of the MCP server (frodo-lib#905, follow-up to
 * #897). Every test below describes how many logins a tool call SHOULD cause and
 * is marked `knownToFail` with the issue that fixes it: it passes while the
 * runtime still logs in on every call, and fails (so that someone removes the
 * mark) as soon as the fix lands. (`test.failing` is not available with this
 * repository's jest runner.)
 *
 * The logins are counted on the `login.getTokens` of the instances the runtime
 * ends up using; no request is made.
 */
import { jest } from '@jest/globals';
import FrodoLib from '../lib/FrodoLib';
import type { McpCapabilityDescriptor } from './CapabilityTypes';
import type { McpToolManifest } from './ToolManifest';
import { createToolRuntime } from './ToolRuntime';

const HOST = 'https://openam-example.example.com/am';

const descriptor: McpCapabilityDescriptor = {
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
};

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const manifest = {
  canonicalTools: [
    {
      toolName: 'frodo_dispatch_read_only',
      description: 'Dispatch read-only',
      annotations,
    },
  ],
  genericTools: [],
  discoveryTool: {
    toolName: 'frodo_discover',
    description: 'Discover tool surface.',
    domains: ['authn'],
    objectTypesByDomain: { authn: ['Journey'] },
    operationsByType: { read: ['authn.Journey'] },
    operationDetailsByType: {},
    objectTypeOperationSupport: [],
  },
  backingDescriptorCount: 1,
  totalToolCount: 2,
} as unknown as McpToolManifest;

/**
 * Passes while `fn` still fails on an assertion, and fails when it passes, so
 * that the mark is removed together with the fix. Anything that is not an
 * assertion mismatch (a setup error) is a real failure and is rethrown.
 */
function knownToFail(issue: string, name: string, fn: () => Promise<void>) {
  test(`${name} [known to fail until ${issue}]`, async () => {
    try {
      await fn();
    } catch (e) {
      if (!(e as any)?.matcherResult) throw e;
      return;
    }
    throw new Error(
      `${issue} appears to be fixed: remove knownToFail from this test.`
    );
  });
}

/** A real instance whose login and one read are counted fakes. */
function countedInstance(host = HOST) {
  const instance = FrodoLib({ host, deploymentType: 'cloud', realm: 'alpha' });
  const getTokens = jest.fn(async () => {
    authenticate(instance, 30 * 60 * 1000);
    return undefined;
  });
  const readJourney = jest.fn(async (id: string) => ({ id }));
  (instance.login as any).getTokens = getTokens;
  (instance.authn.journey as any).readJourney = readJourney;
  return { instance, getTokens, readJourney };
}

/** Puts a session and a bearer token into the state, valid for `lifetimeMs`. */
function authenticate(
  instance: ReturnType<typeof FrodoLib>,
  lifetimeMs: number
) {
  const expires = Date.now() + lifetimeMs;
  instance.state.setCookieName('iPlanetDirectoryPro');
  instance.state.setUserSessionTokenMeta({
    tokenId: 'session',
    successUrl: '/',
    realm: '/',
    expires,
  });
  instance.state.setBearerTokenMeta({
    access_token: 'bearer',
    token_type: 'Bearer',
    scope: 'fr:idm:*',
    expires_in: Math.round(lifetimeMs / 1000),
    expires,
  } as any);
}

function call(
  runtime: ReturnType<typeof createToolRuntime>,
  context: any = { auth: { mode: 'state-config', config: {} } }
) {
  return runtime.executeTool({
    toolName: 'frodo_dispatch_read_only',
    arguments: { skillId: descriptor.id, positionalArgs: ['journey-1'] },
    context,
  });
}

describe('MCP runtime logins per tool call', () => {
  test('0: Method is implemented', () => {
    expect(createToolRuntime).toBeDefined();
  });

  test('1: the counted fakes themselves work (a call reads once and logs in once on a fresh instance)', async () => {
    const { instance, getTokens, readJourney } = countedInstance();
    const runtime = createToolRuntime(manifest, [descriptor], {} as any, {
      resolveFrodoForRequest: () => instance,
    });
    await call(runtime);
    expect(readJourney).toHaveBeenCalledTimes(1);
    expect(getTokens).toHaveBeenCalledTimes(1);
  });

  // lib#906: an instance that is already authenticated is used as it is
  knownToFail(
    'frodo-lib#906',
    '2: five calls on an authenticated instance cause no login',
    async () => {
      const { instance, getTokens, readJourney } = countedInstance();
      authenticate(instance, 30 * 60 * 1000);
      const runtime = createToolRuntime(manifest, [descriptor], {} as any, {
        resolveFrodoForRequest: () => instance,
      });
      for (let i = 0; i < 5; i++) {
        await call(runtime);
      }
      expect(readJourney).toHaveBeenCalledTimes(5);
      expect(getTokens).toHaveBeenCalledTimes(0);
    }
  );

  // lib#906: an expired instance logs in once, also for parallel callers
  knownToFail(
    'frodo-lib#906',
    '3: parallel calls on an expired instance cause one login',
    async () => {
      const { instance, getTokens, readJourney } = countedInstance();
      authenticate(instance, -60 * 1000);
      const runtime = createToolRuntime(manifest, [descriptor], {} as any, {
        resolveFrodoForRequest: () => instance,
      });
      await Promise.all([1, 2, 3, 4, 5].map(() => call(runtime)));
      expect(readJourney).toHaveBeenCalledTimes(5);
      expect(getTokens).toHaveBeenCalledTimes(1);
    }
  );

  // lib#907: a realm override derives from the authenticated instance
  knownToFail(
    'frodo-lib#907',
    '4: a realm override causes no new instance and no new login',
    async () => {
      const root = countedInstance();
      authenticate(root.instance, 30 * 60 * 1000);
      const created: ReturnType<typeof countedInstance>[] = [];
      (root.instance as any).createInstanceWithServiceAccount = jest.fn(() => {
        const scoped = countedInstance();
        created.push(scoped);
        return scoped.instance;
      });
      const runtime = createToolRuntime(
        manifest,
        [descriptor],
        root.instance,
        {}
      );
      const context = {
        auth: {
          mode: 'service-account',
          host: HOST,
          serviceAccountId: 'service-account',
          serviceAccountJwk: '{}',
          realm: 'bravo',
          deploymentType: 'cloud',
        },
      };
      for (let i = 0; i < 3; i++) {
        await call(runtime, context);
      }
      const logins = created.reduce(
        (n, c) => n + c.getTokens.mock.calls.length,
        0
      );
      expect(
        (root.instance as any).createInstanceWithServiceAccount
      ).not.toHaveBeenCalled();
      expect(logins).toBe(0);
    }
  );
});
