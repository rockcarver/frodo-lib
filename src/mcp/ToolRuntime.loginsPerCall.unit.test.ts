/**
 * Run tests
 *
 *        npm run test:only ToolRuntime.loginsPerCall
 *
 * The session churn of the MCP server (frodo-lib#905, follow-up to #897): how
 * many logins a tool call causes. The runtime calls `login.getTokens()` for
 * every request; what that costs is decided by the library (frodo-lib#906).
 * Those cases therefore count the logins that the real login code sends to a
 * fake AM. What a realm-overridden request costs is in
 * ToolRuntime.realmOverrideLogins.unit.test.ts (frodo-lib#907).
 */
import '../index';
import { jest } from '@jest/globals';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
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

  describe('with the real login code (frodo-lib#906)', () => {
    let am: FakeAm;

    beforeEach(async () => {
      am = await startFakeAm();
    });

    afterEach(async () => {
      await am.close();
    });

    /** A real instance with credentials; only the read itself is a fake. */
    function realInstance() {
      const instance = FrodoLib({ host: am.host, deploymentType: 'classic' });
      instance.state.setUseTokenCache(false);
      instance.state.setUsername('someone');
      instance.state.setPassword('password');
      const readJourney = jest.fn(async (id: string) => ({ id }));
      (instance.authn.journey as any).readJourney = readJourney;
      return { instance, readJourney };
    }

    test('2: five calls cause one login, however often the runtime asks for the tokens', async () => {
      const { instance, readJourney } = realInstance();
      const runtime = createToolRuntime(manifest, [descriptor], {} as any, {
        resolveFrodoForRequest: () => instance,
      });
      for (let i = 0; i < 5; i++) {
        await call(runtime);
      }
      expect(readJourney).toHaveBeenCalledTimes(5);
      expect(am.logins()).toBe(1);
    });

    test('3: parallel calls on an expired instance cause one login', async () => {
      const { instance, readJourney } = realInstance();
      authenticate(instance, -60 * 1000);
      const runtime = createToolRuntime(manifest, [descriptor], {} as any, {
        resolveFrodoForRequest: () => instance,
      });
      await Promise.all([1, 2, 3, 4, 5].map(() => call(runtime)));
      expect(readJourney).toHaveBeenCalledTimes(5);
      expect(am.logins()).toBe(1);
    });
  });
});
