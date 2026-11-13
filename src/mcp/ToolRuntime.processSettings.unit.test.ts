/**
 * Run tests
 *
 *        npm run test:only ToolRuntime.processSettings
 *
 * Three settings belong to the process and not to a request: air-gapped mode,
 * the switch of the template catalog cache and its directory. A request of the
 * MCP runtime is served by a scoped instance that the factory helpers build
 * from the credentials of the auth mode, so it starts with all three at their
 * defaults. Without the inheritance a call of `app.template.listTemplates`
 * could reach the public catalog host although the process is air-gapped, and
 * would download the catalog again on every call. The tests look at the scoped
 * instance of every auth mode (the inheritance happens before the instance
 * logs in, so no AM is needed), and then at a real call of the tool.
 */
import '../index';
import fs from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import { gzipSync } from 'zlib';
import { APP_TEMPLATE_CATALOG_URLS } from '../api/ApplicationTemplateApi';
import FrodoLib, { frodo } from '../lib/FrodoLib';
import { buildCapabilityInventory } from './CapabilityRegistry';
import { buildToolManifest } from './ToolManifest';
import { createToolRuntime, resolveRequestScopedFrodo } from './ToolRuntime';

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
} as any;
const smallManifest = {
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
} as any;

// a host that nothing listens on: the instances are never logged in
const HOST = 'http://127.0.0.1:1/am';

const contexts: Record<string, any> = {
  'state-config (host only)': {
    auth: { mode: 'state-config', config: { host: HOST } },
  },
  'state-config (the whole state of the process)': { auth: undefined },
  'service-account': {
    auth: {
      mode: 'service-account',
      host: HOST,
      serviceAccountId: 'sa-1',
      serviceAccountJwk: '{"kty":"RSA"}',
      deploymentType: 'cloud',
    },
  },
  'admin-account': {
    auth: {
      mode: 'admin-account',
      host: HOST,
      username: 'someone',
      password: 'password',
      deploymentType: 'classic',
    },
  },
  'bearer-token': {
    auth: {
      mode: 'bearer-token',
      host: HOST,
      accessToken: 'token',
      deploymentType: 'classic',
    },
  },
  browser: {
    auth: { mode: 'browser', host: HOST, deploymentType: 'classic' },
  },
};

/** The server's own instance, and the scoped instances that its factory helpers build. */
function server(settings: {
  airGapped?: boolean;
  cache?: boolean;
  cachePath?: string;
}) {
  const root = FrodoLib({ host: HOST, deploymentType: 'classic' });
  if (settings.airGapped) root.state.setAirGapped(true);
  if (settings.cache) root.state.setUseTemplateCatalogCache(true);
  if (settings.cachePath) {
    root.state.setTemplateCatalogCachePath(settings.cachePath);
  }
  const scoped: any[] = [];
  for (const name of [
    'createInstance',
    'createInstanceWithServiceAccount',
    'createInstanceWithAdminAccount',
    'createInstanceWithAccessToken',
    'createInstanceWithBrowserLogin',
  ]) {
    const original = (root as any)[name].bind(root);
    (root as any)[name] = (...args: any[]) => {
      const instance = original(...args);
      scoped.push(instance);
      return instance;
    };
  }
  return { root, scoped };
}

async function call(root: any, context: any, resolveFrodoForRequest?: any) {
  const runtime = createToolRuntime(smallManifest, [descriptor], root, {
    resolveFrodoForRequest,
  });
  try {
    await runtime.executeTool({
      toolName: 'frodo_dispatch_read_only',
      arguments: { skillId: descriptor.id, positionalArgs: ['journey-1'] },
      context,
    });
  } catch {
    // the instance cannot log in anywhere; what is looked at happened before
  }
}

describe('the settings of the process on a request-scoped instance', () => {
  test('0: Method is implemented', () => {
    expect(resolveRequestScopedFrodo).toBeDefined();
  });

  describe.each(Object.keys(contexts))('auth mode %s', (name) => {
    const contextOf = (root: any) =>
      contexts[name].auth
        ? contexts[name]
        : {
            auth: {
              mode: 'state-config',
              config: { ...root.state.getState() },
            },
          };

    test('1: takes air-gapped mode, the cache switch and the directory from the root instance', async () => {
      const { root, scoped } = server({
        airGapped: true,
        cache: true,
        cachePath: '/tmp/frodo-catalog-cache',
      });
      await call(root, contextOf(root));
      expect(scoped).toHaveLength(1);
      expect(scoped[0].state.getAirGapped()).toBe(true);
      expect(scoped[0].state.getUseTemplateCatalogCache()).toBe(true);
      expect(scoped[0].state.getTemplateCatalogCachePath()).toBe(
        '/tmp/frodo-catalog-cache'
      );
    });

    test('2: stays as it is when the root instance has none of them on', async () => {
      const { root, scoped } = server({});
      await call(root, contextOf(root));
      expect(scoped).toHaveLength(1);
      expect(scoped[0].state.getAirGapped()).toBe(false);
      expect(scoped[0].state.getUseTemplateCatalogCache()).toBe(false);
      expect(scoped[0].state.getTemplateCatalogCachePath()).toBeUndefined();
    });

    test('3: takes the cache but not air-gapped mode, and the other way round', async () => {
      const cacheOnly = server({ cache: true });
      await call(cacheOnly.root, contextOf(cacheOnly.root));
      expect(cacheOnly.scoped[0].state.getAirGapped()).toBe(false);
      expect(cacheOnly.scoped[0].state.getUseTemplateCatalogCache()).toBe(true);
      const airGappedOnly = server({ airGapped: true });
      await call(airGappedOnly.root, contextOf(airGappedOnly.root));
      expect(airGappedOnly.scoped[0].state.getAirGapped()).toBe(true);
      expect(airGappedOnly.scoped[0].state.getUseTemplateCatalogCache()).toBe(
        false
      );
    });
  });

  test('4: air-gapped mode only ever goes on: a scoped instance that a custom resolver builds can not turn it off, one that has it on keeps it', async () => {
    const { root } = server({ airGapped: true });
    let scoped: any;
    await call(
      root,
      contexts['admin-account'],
      (context: any, frodoRoot: any) => {
        scoped = resolveRequestScopedFrodo(context, frodoRoot);
        scoped.state.setAirGapped(false);
        return scoped;
      }
    );
    expect(scoped.state.getAirGapped()).toBe(true);

    const open = server({});
    let own: any;
    await call(
      open.root,
      contexts['admin-account'],
      (context: any, frodoRoot: any) => {
        own = resolveRequestScopedFrodo(context, frodoRoot);
        own.state.setAirGapped(true);
        return own;
      }
    );
    // the root has it off, the instance asked for it: it keeps it
    expect(own.state.getAirGapped()).toBe(true);
    expect(open.root.state.getAirGapped()).toBe(false);
  });

  test('5: a directory that the scoped instance has of its own is kept', async () => {
    const { root } = server({ cache: true, cachePath: '/tmp/root-dir' });
    let scoped: any;
    await call(
      root,
      contexts['admin-account'],
      (context: any, frodoRoot: any) => {
        scoped = resolveRequestScopedFrodo(context, frodoRoot);
        scoped.state.setTemplateCatalogCachePath('/tmp/own-dir');
        return scoped;
      }
    );
    expect(scoped.state.getTemplateCatalogCachePath()).toBe('/tmp/own-dir');
    expect(scoped.state.getUseTemplateCatalogCache()).toBe(true);
  });

  test('6: the root instance is not changed by what a scoped instance does', async () => {
    const { root, scoped } = server({ airGapped: true, cache: true });
    await call(root, contexts['admin-account']);
    scoped[0].state.setAirGapped(false);
    scoped[0].state.setUseTemplateCatalogCache(false);
    expect(root.state.getAirGapped()).toBe(true);
    expect(root.state.getUseTemplateCatalogCache()).toBe(true);
  });
});

describe('a call of app.template.listTemplates through the runtime', () => {
  const inventory = buildCapabilityInventory(frodo, { includeUtils: false });
  const manifest = buildToolManifest(inventory);
  const original = { ...APP_TEMPLATE_CATALOG_URLS };
  const catalogText = JSON.stringify({
    AppTemplates: {
      consumer: {
        Web: {
          '1_0-web': {
            id: 'web',
            templateVersion: '1.0',
            displayName: 'Sample Web',
          },
        },
      },
      enterprise: {},
    },
  });
  let httpServer: http.Server;
  let requests: string[];
  let directory: string;

  beforeAll(async () => {
    requests = [];
    httpServer = http.createServer((req, res) => {
      requests.push(req.url ?? '');
      res.writeHead(200, { 'Content-Type': 'application/json', ETag: '"e1"' });
      res.end(gzipSync(Buffer.from(catalogText)));
    });
    await new Promise<void>((resolvePromise) =>
      httpServer.listen(0, '127.0.0.1', () => resolvePromise())
    );
    (APP_TEMPLATE_CATALOG_URLS as any).production =
      `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/production.json.gz`;
  });

  afterAll(async () => {
    Object.assign(APP_TEMPLATE_CATALOG_URLS, original);
    await new Promise<void>((resolvePromise) =>
      httpServer.close(() => resolvePromise())
    );
  });

  beforeEach(() => {
    requests = [];
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frodo-process-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  /** The tool, called with a scoped instance that is built from the credentials of the request. */
  function listTemplates(root: any) {
    // the scoped instance is a new one for every call, as in the runtime; the
    // instance only needs the module of the tool, no login
    const resolveFrodoForRequest = () => {
      const scoped = FrodoLib({ host: HOST, deploymentType: 'classic' });
      return {
        ...scoped,
        login: { getTokens: async () => undefined },
      } as any;
    };
    const runtime = createToolRuntime(manifest, inventory, root, {
      resolveFrodoForRequest,
    }) as any;
    return runtime.executeTool({
      toolName: 'frodo_dispatch_read_only',
      arguments: {
        skillId: 'app.template.listTemplates',
        namedArgs: { options: { includeOverrides: false } },
      },
      context: { auth: { mode: 'state-config', config: {} } },
    });
  }

  const codes = (error: any): string[] => {
    const found: string[] = [];
    const walk = (e: any) => {
      if (!e) return;
      if (e.code) found.push(String(e.code));
      for (const inner of e.originalErrors ?? []) walk(inner);
    };
    walk(error);
    return found;
  };

  test('1: the process is air-gapped: the call is refused and nothing is requested', async () => {
    const { root } = server({ airGapped: true });
    const error = await listTemplates(root).then(
      () => undefined,
      (e: any) => e
    );
    expect(codes(error)).toContain('AIR_GAPPED');
    expect(requests).toEqual([]);
  });

  test('2: the process is air-gapped and has a copy of the catalog in the cache: the call is served from the files', async () => {
    // a copy that the server's own instance kept earlier, long ago
    const warm = FrodoLib({ host: HOST });
    warm.state.setUseTemplateCatalogCache(true);
    warm.state.setTemplateCatalogCachePath(directory);
    await warm.app.template.readCatalog();
    requests = [];
    const { root } = server({
      airGapped: true,
      cache: true,
      cachePath: directory,
    });
    const result = await listTemplates(root);
    expect(requests).toEqual([]);
    expect(JSON.stringify(result)).toContain('1_0-web');
  });

  test('3: with the cache on in the process, the calls share the files and the source is asked once', async () => {
    const { root } = server({ cache: true, cachePath: directory });
    await listTemplates(root);
    await listTemplates(root);
    await listTemplates(root);
    expect(requests).toHaveLength(1);
    expect(fs.existsSync(path.join(directory, 'production.json'))).toBe(true);
  });

  test('4: without the cache every call asks the source', async () => {
    const { root } = server({});
    await listTemplates(root);
    await listTemplates(root);
    expect(requests).toHaveLength(2);
  });
});
