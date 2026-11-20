/**
 * Run tests
 *
 *        npm run test:only ToolRuntime.errorWrapping
 *
 * The runtime invokes a few capabilities through the api layer instead of the
 * facade (the page of a managed-object query). The library throws `FrodoError`
 * and not the error of the request (decision record 0008): a request that fails
 * in such an invocation is wrapped like every other invocation of the runtime.
 * Unit test: a loopback server answers, no recordings, no tenant.
 */
import '../index';
import http from 'http';
import { AddressInfo } from 'net';
import FrodoLib, { frodo } from '../lib/FrodoLib';
import { FrodoError } from '../ops/FrodoError';
import { buildCapabilityInventory } from './CapabilityRegistry';
import { buildToolManifest } from './ToolManifest';
import { createToolRuntime } from './ToolRuntime';

const inventory = buildCapabilityInventory(frodo, { includeUtils: false });
const manifest = buildToolManifest(inventory);
const context = { auth: { mode: 'state-config', config: {} } } as any;

let server: http.Server;
let host: string;

beforeAll(async () => {
  server = http.createServer((request, response) => {
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ code: 500, message: 'query refused' }));
    request.resume();
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve())
  );
  host = `http://127.0.0.1:${(server.address() as AddressInfo).port}/am`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

function idmInstance() {
  const instance = FrodoLib({
    host,
    deploymentType: 'cloud',
    realm: 'alpha',
  });
  instance.state.setUseTokenCache(false);
  instance.state.setBearerTokenMeta({
    access_token: 'MARKER-A-0001',
    token_type: 'Bearer',
    scope: 'fr:idm:*',
    expires_in: 3600,
    expires: Date.now() + 3600 * 1000,
  } as any);
  (instance.login as any).getTokens = async () => undefined;
  return instance;
}

describe('a capability that the runtime invokes through the api layer', () => {
  test('1: the failed request of a managed-object query is thrown as a FrodoError that wraps it', async () => {
    const instance = idmInstance();
    const runtime = createToolRuntime(manifest, inventory, {} as any, {
      resolveFrodoForRequest: () => instance,
    });

    const error = await runtime
      .executeTool({
        toolName: 'frodo_dispatch_read_only',
        arguments: {
          skillId: 'idm.managed.queryManagedObjects',
          namedArgs: { type: 'alpha_user' },
        },
        context,
      })
      .then(
        () => undefined,
        (caught: unknown) => caught
      );

    expect(error).toBeInstanceOf(FrodoError);
    const wrapper = error as FrodoError;
    expect(wrapper.message).toContain(
      "failed invoking 'idm.managed.queryManagedObjects'"
    );
    // the error of the request is the cause, with its status
    const cause = wrapper.originalErrors[0];
    expect(cause.name).toBe('AxiosError');
    expect(wrapper.isHttpError).toBe(true);
    expect(wrapper.httpStatus).toBe(500);
  });
});
