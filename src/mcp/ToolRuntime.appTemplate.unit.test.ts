/**
 * The MCP tools of frodo.app.template are called on behalf of a model. The
 * library lets a caller name the catalog (`options.catalog`), a URL
 * (`options.url`) and a refresh; those must not reach the library through a
 * tool, because a model could then make the machine request any host, in
 * air-gapped mode too. A loopback server shows whether a request arrives.
 *
 * Run with:
 *
 *        npm run test:only ToolRuntime.appTemplate
 */
import '../index';
import http from 'http';
import { AddressInfo } from 'net';
import FrodoLib, { frodo } from '../lib/FrodoLib';
import { buildCapabilityInventory } from './CapabilityRegistry';
import { buildToolManifest } from './ToolManifest';
import { createToolRuntime } from './ToolRuntime';

const inventory = buildCapabilityInventory(frodo, { includeUtils: false });
const manifest = buildToolManifest(inventory);

const catalog = {
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
};

async function withServer<T>(
  run: (base: string, seen: string[]) => Promise<T>
): Promise<T> {
  const seen: string[] = [];
  const server = http.createServer((req, res) => {
    seen.push(req.url ?? '');
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(catalog));
  });
  await new Promise<void>((resolvePromise) =>
    server.listen(0, '127.0.0.1', () => resolvePromise())
  );
  try {
    return await run(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      seen
    );
  } finally {
    await new Promise<void>((resolvePromise) =>
      server.close(() => resolvePromise())
    );
  }
}

/** A runtime whose tool calls go to a state with air-gapped mode on, as a model's would. */
function runtimeForAirGappedState() {
  const real = FrodoLib({});
  real.state.setAirGapped(true);
  const root: any = {
    login: { getTokens: async () => undefined },
    app: real.app,
    state: real.state,
  };
  return createToolRuntime(manifest, inventory, {} as any, {
    resolveFrodoForRequest: () => root,
  }) as any;
}

const dispatch = (
  runtime: any,
  skillId: string,
  args: Record<string, unknown>
) =>
  runtime.executeTool({
    toolName: 'frodo_dispatch_read_only',
    arguments: { skillId, ...args },
    context: { auth: { mode: 'state-config', config: {} } } as any,
  });

/** The codes of an error and of the errors it wraps. */
function causes(error: any): string[] {
  const codes: string[] = [];
  const walk = (e: any) => {
    if (!e) return;
    if (e.code) codes.push(String(e.code));
    for (const inner of e.originalErrors ?? []) walk(inner);
  };
  walk(error);
  return codes;
}

const descriptor = (id: string) => inventory.find((c) => c.id === id) as any;

describe.each([
  ['app.template.listTemplates', {}],
  [
    'app.template.readTemplate',
    { application: { templateName: 'web', templateVersion: '1.0' } },
  ],
])('MCP tool %s', (skillId, required) => {
  test('1: offers only the channel and the flag that leaves the tenant out, in a closed schema, by name', () => {
    const d = descriptor(skillId);
    expect(d.argumentMode).toBe('named');
    const options = d.parameters.find((p: any) => p.name === 'options');
    expect(Object.keys(options.schema.properties).sort()).toEqual([
      'channel',
      'includeOverrides',
    ]);
    expect(options.schema.additionalProperties).toBe(false);
    expect(options.schema.properties.channel.enum).toEqual([
      'production',
      'development',
    ]);
  });

  test.each([
    ['url', { url: 'HTTP-BASE/anything' }],
    ['catalog', { catalog }],
    ['refresh', { refresh: true }],
    [
      'url with the allowed fields',
      { url: 'HTTP-BASE/x', includeOverrides: false },
    ],
  ])(
    '2: a model-supplied %s is refused and nothing is requested, in air-gapped mode',
    async (field, options) => {
      await withServer(async (base, seen) => {
        const given = JSON.parse(
          JSON.stringify(options).replace('HTTP-BASE', base)
        );
        const error = await dispatch(runtimeForAirGappedState(), skillId, {
          namedArgs: { ...required, options: given },
        }).then(
          () => undefined,
          (e: any) => e
        );
        expect(error).toBeDefined();
        expect(String(error.message)).toMatch(
          /unexpected field\(s\): (url|catalog|refresh)/
        );
        expect(seen).toEqual([]);
      });
    }
  );

  test('3: the options cannot be passed positionally, around the schema', async () => {
    await withServer(async (base, seen) => {
      const args =
        skillId === 'app.template.listTemplates'
          ? [{ url: `${base}/anything`, includeOverrides: false }]
          : [
              { templateName: 'web', templateVersion: '1.0' },
              { url: `${base}/anything`, includeOverrides: false },
            ];
      const error = await dispatch(runtimeForAirGappedState(), skillId, {
        positionalArgs: args,
      }).then(
        () => undefined,
        (e: any) => e
      );
      expect(error).toBeDefined();
      expect(String(error.message)).toMatch(/requires namedArgs/);
      expect(seen).toEqual([]);
    });
  });

  test.each(['constructor', 'toString', 'staging'])(
    '4: the channel %s is refused',
    async (channel) => {
      const error = await dispatch(runtimeForAirGappedState(), skillId, {
        namedArgs: { ...required, options: { channel } },
      }).then(
        () => undefined,
        (e: any) => e
      );
      expect(error).toBeDefined();
      expect(String(error.message)).toMatch(/must be one of/);
    }
  );

  test('5: the allowed fields pass, and the library then refuses the public host because air-gapped mode is on', async () => {
    await withServer(async (_base, seen) => {
      const error = await dispatch(runtimeForAirGappedState(), skillId, {
        namedArgs: {
          ...required,
          options: { channel: 'production', includeOverrides: false },
        },
      }).then(
        () => undefined,
        (e: any) => e
      );
      // the runtime wraps what the library throws; the cause is underneath
      expect(causes(error)).toContain('AIR_GAPPED');
      expect(seen).toEqual([]);
    });
  });
});

describe('MCP tool app.template.readTemplate: the application', () => {
  test('1: needs a templateName and a templateVersion', async () => {
    const error = await dispatch(
      runtimeForAirGappedState(),
      'app.template.readTemplate',
      {
        namedArgs: { application: { templateName: 'web' } },
      }
    ).then(
      () => undefined,
      (e: any) => e
    );
    expect(String(error.message)).toMatch(
      /missing field\(s\): templateVersion/
    );
  });
});
