/**
 * Run tests
 *
 *        npm run test:only ToolRuntime.realmOverrideLogins
 *
 * What a realm-overridden request of the MCP runtime costs in logins
 * (frodo-lib#907). A request that carries a realm of its own is served by a new
 * instance, built from the credentials of its auth mode. The cache key does not
 * contain the realm of a request, so with the token cache on that instance
 * should find the credential that the server's own instance stored and log in
 * no more. The tests count what the real login code sends to a fake AM that
 * runs in the test process: after the login of the root instance, three
 * realm-overridden calls per auth mode, with the cache on and off.
 */
import '../index';
import fs from 'fs';
import { resolve } from 'path';
import { jest } from '@jest/globals';
import { startFakeAm, type FakeAm } from '../../test/support/fakeAm';
import FrodoLib from '../lib/FrodoLib';
import { createJwkRsa } from '../ops/JoseOps';
import type { McpCapabilityDescriptor } from './CapabilityTypes';
import type { McpToolManifest } from './ToolManifest';
import { createToolRuntime, resolveRequestScopedFrodo } from './ToolRuntime';

const TMP_DIR = resolve(
  '.',
  'test',
  'fs_tmp',
  'ToolRuntime.realmOverrideLogins'
);

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const descriptor = {
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
  annotations,
} as unknown as McpCapabilityDescriptor;

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

type Mode = 'state-config' | 'service-account' | 'admin-account';

const CALLS = 3;

let am: FakeAm;

// The instances that the runtime builds for a request do not get the master key
// path of the server's own instance, so they find the key through this
// variable. Without it they would use the default path, in the home directory.
const MASTER_KEY_PATH = 'FRODO_MASTER_KEY_PATH';
let savedMasterKeyPath: string | undefined;

beforeAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  savedMasterKeyPath = process.env[MASTER_KEY_PATH];
  process.env[MASTER_KEY_PATH] = resolve(TMP_DIR, 'masterkey.key');
});

afterAll(() => {
  if (savedMasterKeyPath === undefined) delete process.env[MASTER_KEY_PATH];
  else process.env[MASTER_KEY_PATH] = savedMasterKeyPath;
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  am = await startFakeAm();
});

afterEach(async () => {
  await am.close();
});

/** The server's own instance, logged in, and the context of a request in `realm` for the auth mode. */
async function server(mode: Mode, cache: boolean | undefined) {
  const deploymentType = mode === 'service-account' ? 'cloud' : 'classic';
  const root = FrodoLib({ host: am.host, deploymentType });
  if (cache !== undefined) root.state.setUseTokenCache(cache);
  root.state.setTokenCachePath(
    resolve(TMP_DIR, `${Math.random()}.TokenCache.json`)
  );
  root.state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
  const jwk = mode === 'service-account' ? await createJwkRsa() : undefined;
  if (mode === 'service-account') {
    root.state.setServiceAccountId('sa-1');
    root.state.setServiceAccountJwk(jwk);
  } else {
    root.state.setUsername('someone');
    root.state.setPassword('password');
  }
  // the login of the server at startup
  await root.login.getTokens();

  const context = (realm: string): any => {
    switch (mode) {
      case 'service-account':
        return {
          auth: {
            mode,
            host: am.host,
            serviceAccountId: 'sa-1',
            serviceAccountJwk: JSON.stringify(jwk),
            realm,
            deploymentType,
          },
        };
      case 'admin-account':
        return {
          auth: {
            mode,
            host: am.host,
            username: 'someone',
            password: 'password',
            realm,
            deploymentType,
          },
        };
      default:
        // what a host builds from the process state
        return { auth: { mode, config: { ...root.state.getState(), realm } } };
    }
  };
  return { root, context };
}

function call(runtime: ReturnType<typeof createToolRuntime>, context: any) {
  return runtime.executeTool({
    toolName: 'frodo_dispatch_read_only',
    arguments: { skillId: descriptor.id, positionalArgs: ['journey-1'] },
    context,
  });
}

/** What the calls cost: the logins (user sessions) and access tokens that the fake AM issued for them. */
async function callsAfterStartup(
  mode: Mode,
  cache: boolean | undefined,
  options: { resolveFrodoForRequest?: any } = {}
) {
  const { root, context } = await server(mode, cache);
  const logins = am.logins();
  const tokens = am.accessTokens();
  const runtime = createToolRuntime(manifest, [descriptor], root, options);
  for (let i = 0; i < CALLS; i++) {
    await call(runtime, context('bravo'));
  }
  return {
    logins: am.logins() - logins,
    tokens: am.accessTokens() - tokens,
  };
}

describe('realm-overridden MCP requests and the token cache (frodo-lib#907)', () => {
  test('0: Method is implemented', () => {
    expect(resolveRequestScopedFrodo).toBeDefined();
  });

  describe.each(['state-config', 'service-account', 'admin-account'] as Mode[])(
    'auth mode %s',
    (mode) => {
      test('1: with the token cache on, realm-overridden calls log in no more after the server has', async () => {
        const cost = await callsAfterStartup(mode, true);
        expect(cost).toEqual({ logins: 0, tokens: 0 });
      });

      test('2: with the token cache off, every realm-overridden call logs in (nothing ends that login yet: frodo-lib#908)', async () => {
        const cost = await callsAfterStartup(mode, false);
        if (mode === 'service-account') {
          expect(cost).toEqual({ logins: 0, tokens: CALLS });
        } else {
          expect(cost).toEqual({ logins: CALLS, tokens: 0 });
        }
      });
    }
  );

  test('3: a scoped instance that was given a cache setting of its own keeps it', async () => {
    // a custom resolver may configure the instance it returns
    const resolveFrodoForRequest = (context: any, frodoRoot: any) => {
      const scoped = resolveRequestScopedFrodo(context, frodoRoot);
      scoped.state.setUseTokenCache(false);
      return scoped;
    };
    const cost = await callsAfterStartup('admin-account', true, {
      resolveFrodoForRequest,
    });
    expect(cost).toEqual({ logins: CALLS, tokens: 0 });
  });

  test('4: a root instance that has no cache setting leaves the scoped instance without one', async () => {
    const { root, context } = await server('admin-account', undefined);
    const scoped = jest.fn((ctx: any, frodoRoot: any) =>
      resolveRequestScopedFrodo(ctx, frodoRoot)
    );
    const runtime = createToolRuntime(manifest, [descriptor], root, {
      resolveFrodoForRequest: scoped,
    });
    await call(runtime, context('bravo'));
    expect(scoped).toHaveBeenCalledTimes(1);
    const instance = scoped.mock.results[0].value as ReturnType<
      typeof FrodoLib
    >;
    expect(instance.state.getUseTokenCache()).toBeUndefined();
  });

  test('6: a browser login keeps its own session reuse: the scoped instance takes no cache setting from the root', async () => {
    const { root } = await server('admin-account', true);
    const created: ReturnType<typeof FrodoLib>[] = [];
    const runtime = createToolRuntime(manifest, [descriptor], root, {
      resolveFrodoForRequest: (ctx: any, frodoRoot: any) => {
        const scoped = resolveRequestScopedFrodo(ctx, frodoRoot);
        created.push(scoped);
        return scoped;
      },
    });
    // without a prompt handler the call is refused after the instance was made
    await call(runtime, {
      auth: {
        mode: 'browser',
        host: am.host,
        realm: 'bravo',
        deploymentType: 'cloud',
      },
    }).catch(() => undefined);
    expect(created).toHaveLength(1);
    expect(created[0].state.getUseTokenCache()).toBeUndefined();
  });

  test('5: a bearer token that a caller presented is never cached, whatever the root does', async () => {
    const { root } = await server('admin-account', true);
    const created: ReturnType<typeof FrodoLib>[] = [];
    const runtime = createToolRuntime(manifest, [descriptor], root, {
      resolveFrodoForRequest: (ctx: any, frodoRoot: any) => {
        const scoped = resolveRequestScopedFrodo(ctx, frodoRoot);
        created.push(scoped);
        return scoped;
      },
    });
    // the fake AM cannot verify a presented token, so the call itself fails; the instance was made before that
    await call(runtime, {
      auth: {
        mode: 'bearer-token',
        host: am.host,
        accessToken: 'presented-by-a-caller',
        scope: 'fr:idm:*',
        expiresAt: Date.now() + 30 * 60 * 1000,
        realm: 'bravo',
        deploymentType: 'classic',
      },
    }).catch(() => undefined);
    expect(created).toHaveLength(1);
    expect(created[0].state.getUseTokenCache()).toBe(false);
  });
});
