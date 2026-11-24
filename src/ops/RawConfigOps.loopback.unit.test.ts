/**
 * Run tests
 *
 *        npm run test:only RawConfigOps.loopback.unit
 *
 * Raw config through the whole library chain (ops, api, HTTP client) against
 * local servers, no recording and no tenant. Server A stands for the tenant
 * host, server B for any other host that a path names, and, in the tests of a
 * hostile path under the openidm root, server C for the IDM host. In the other
 * tests B stands for the IDM host. Credentials are made up.
 *
 * They show which server a raw request goes to (the IDM host of a connection
 * is honoured; the `am` root works on a host whose context is not /am), which
 * credential and version header each root sends, and that a path cannot send
 * the request, the credential or the log keys to another host.
 */
import http from 'http';
import { AddressInfo } from 'net';
import StateImpl from '../shared/State';
import RawConfigOps from './RawConfigOps';

type Received = {
  method: string;
  url: string;
  host?: string;
  authorization?: string;
  cookie?: string;
  version?: string;
  apiKey?: string;
  apiSecret?: string;
  xsrf?: string;
  body: string;
};

type Server = {
  origin: string;
  port: number;
  received: Received[];
  close: () => Promise<void>;
};

async function startServer(name: string): Promise<Server> {
  const received: Received[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      received.push({
        method: req.method,
        url: req.url,
        host: req.headers.host,
        authorization: req.headers['authorization'] as string,
        cookie: req.headers.cookie,
        version: req.headers['accept-api-version'] as string,
        apiKey: req.headers['x-api-key'] as string,
        apiSecret: req.headers['x-api-secret'] as string,
        xsrf: req.headers['x-xsrf-header'] as string,
        body: Buffer.concat(chunks).toString(),
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ answeredBy: name }));
    });
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve())
  );
  const port = (server.address() as AddressInfo).port;
  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    received,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      ),
  };
}

let a: Server;
let b: Server;
let c: Server;

beforeAll(async () => {
  a = await startServer('A');
  b = await startServer('B');
  c = await startServer('C');
});

afterAll(async () => {
  await a.close();
  await b.close();
  await c.close();
});

beforeEach(() => {
  a.received.length = 0;
  b.received.length = 0;
  c.received.length = 0;
});

const MAIN_TOKEN = 'sample-main-bearer-token';
const PF_TOKEN = 'sample-pf-bearer-token';
const SESSION = 'sample-session-cookie-value';
const LOG_KEY = 'sample-log-key';
const LOG_SECRET = 'sample-log-secret';
const DEFAULT_VERSION = 'protocol=2.0,resource=1.0';
const CUSTOM = { protocol: '2.1', resource: '3.0' };
const CUSTOM_VERSION = 'protocol=2.1,resource=3.0';

const meta = (token: string) =>
  ({
    access_token: token,
    token_type: 'Bearer',
    scope: 'fr:am:* fr:idm:* fr:iga:*',
    expires_in: 3600,
    expires: Date.now() + 60 * 60 * 1000,
  }) as any;

function newState({
  context = '/am',
  idmHost = '',
  bearer = true,
}: { context?: string; idmHost?: string; bearer?: boolean } = {}) {
  const state = StateImpl({});
  state.setHost(`${a.origin}${context}`);
  if (idmHost) state.setIdmHost(idmHost);
  state.setCookieName('iPlanetDirectoryPro');
  state.setUserSessionTokenMeta({
    tokenId: SESSION,
    expires: Date.now() + 60 * 60 * 1000,
  } as any);
  if (bearer) state.setBearerTokenMeta(meta(MAIN_TOKEN));
  state.setPfBearerTokenMeta(meta(PF_TOKEN));
  state.setLogApiKey(LOG_KEY);
  state.setLogApiSecret(LOG_SECRET);
  return state;
}

describe('a raw IDM request', () => {
  test('1: goes to the IDM host of the connection when there is one, GET and PUT', async () => {
    const state = newState({ idmHost: `${b.origin}/openidm` });
    const rawConfig = RawConfigOps(state);

    await rawConfig.exportRawConfig({ path: '/openidm/config/sample' });
    await rawConfig.importRawConfig(
      { path: '/openidm/config/sample' },
      { _id: 'sample', value: 'x' }
    );

    expect(a.received).toHaveLength(0);
    expect(b.received.map((r) => [r.method, r.url])).toEqual([
      ['GET', '/openidm/config/sample'],
      ['PUT', '/openidm/config/sample'],
    ]);
    expect(JSON.parse(b.received[1].body)).toEqual({
      _id: 'sample',
      value: 'x',
    });
    // the credential of the connection goes with it
    expect(b.received[0].authorization).toBe(`Bearer ${MAIN_TOKEN}`);
  });

  test('2: goes to the host and /openidm without an IDM host, and sends no version header', async () => {
    const rawConfig = RawConfigOps(newState());

    await rawConfig.exportRawConfig({ path: '/openidm/config/sample' });
    await rawConfig.importRawConfig(
      { path: 'openidm/config/sample' },
      { _id: 'sample' }
    );

    expect(b.received).toHaveLength(0);
    expect(a.received.map((r) => [r.method, r.url])).toEqual([
      ['GET', '/openidm/config/sample'],
      ['PUT', '/openidm/config/sample'],
    ]);
    expect(a.received.map((r) => r.version)).toEqual([undefined, undefined]);
    expect(a.received[0].authorization).toBe(`Bearer ${MAIN_TOKEN}`);
  });

  test('3: sends a version header when the caller names a version', async () => {
    const rawConfig = RawConfigOps(newState());

    await rawConfig.exportRawConfig({
      path: '/openidm/config/sample',
      apiVersion: CUSTOM,
    });
    await rawConfig.importRawConfig(
      { path: '/openidm/config/sample', apiVersion: CUSTOM },
      { _id: 'sample' }
    );

    expect(a.received.map((r) => r.version)).toEqual([
      CUSTOM_VERSION,
      CUSTOM_VERSION,
    ]);
  });
});

describe('the am root', () => {
  test.each([
    ['/am', '/am'],
    ['/openam', '/openam'],
    ['/auth', '/auth'],
  ])(
    '1: on a host whose context is %s, /am/... goes to that context, GET and PUT',
    async (context, prefix) => {
      const rawConfig = RawConfigOps(newState({ context }));

      await rawConfig.exportRawConfig({ path: '/am/json/realms/root/x' });
      await rawConfig.importRawConfig(
        { path: '/am/json/realms/root/x' },
        { _id: 'x' }
      );

      expect(b.received).toHaveLength(0);
      expect(a.received.map((r) => [r.method, r.url])).toEqual([
        ['GET', `${prefix}/json/realms/root/x`],
        ['PUT', `${prefix}/json/realms/root/x`],
      ]);
      expect(a.received.map((r) => r.version)).toEqual([
        DEFAULT_VERSION,
        DEFAULT_VERSION,
      ]);
    }
  );

  test('2: the context of the host is no root: /openam/... is refused and nothing is sent', async () => {
    const rawConfig = RawConfigOps(newState({ context: '/openam' }));

    await expect(
      rawConfig.exportRawConfig({ path: '/openam/json/realms/root/x' })
    ).rejects.toThrow('Error in exportRawIdm');
    await expect(
      rawConfig.importRawConfig(
        { path: '/openam/json/realms/root/x' },
        { _id: 'x' }
      )
    ).rejects.toThrow('Error in importRawConfig');

    expect(a.received).toHaveLength(0);
    expect(b.received).toHaveLength(0);
  });
});

describe('the roots at the root of the host', () => {
  test('1: iga goes to /iga with the main bearer token and the default version, GET and PUT', async () => {
    const rawConfig = RawConfigOps(newState());

    await rawConfig.exportRawConfig({ path: '/iga/governance/requestTypes/x' });
    await rawConfig.importRawConfig(
      { path: '/iga/governance/requestTypes/x' },
      { id: 'x', value: 'y' }
    );

    expect(b.received).toHaveLength(0);
    expect(a.received.map((r) => [r.method, r.url])).toEqual([
      ['GET', '/iga/governance/requestTypes/x'],
      ['PUT', '/iga/governance/requestTypes/x'],
    ]);
    expect(a.received.map((r) => r.authorization)).toEqual([
      `Bearer ${MAIN_TOKEN}`,
      `Bearer ${MAIN_TOKEN}`,
    ]);
    expect(a.received.map((r) => r.version)).toEqual([
      DEFAULT_VERSION,
      DEFAULT_VERSION,
    ]);
    expect(JSON.parse(a.received[1].body)).toEqual({ id: 'x', value: 'y' });
  });

  test('2: iga sends the version the caller names, GET and PUT', async () => {
    const rawConfig = RawConfigOps(newState());

    await rawConfig.exportRawConfig({
      path: '/iga/governance/requestTypes/x',
      apiVersion: CUSTOM,
    });
    await rawConfig.importRawConfig(
      { path: '/iga/governance/requestTypes/x', apiVersion: CUSTOM },
      { id: 'x' }
    );

    expect(a.received.map((r) => r.version)).toEqual([
      CUSTOM_VERSION,
      CUSTOM_VERSION,
    ]);
  });

  test('3: keys goes to /keys with the main bearer token and no version, GET and PUT', async () => {
    const rawConfig = RawConfigOps(newState());

    await rawConfig.exportRawConfig({ path: '/keys' });
    await rawConfig.importRawConfig({ path: '/keys/x' }, { name: 'y' });

    expect(b.received).toHaveLength(0);
    expect(a.received.map((r) => [r.method, r.url])).toEqual([
      ['GET', '/keys'],
      ['PUT', '/keys/x'],
    ]);
    expect(a.received.map((r) => r.authorization)).toEqual([
      `Bearer ${MAIN_TOKEN}`,
      `Bearer ${MAIN_TOKEN}`,
    ]);
    expect(a.received.map((r) => r.version)).toEqual([undefined, undefined]);
  });

  test('4: keys sends the version the caller names with a bearer token and without one', async () => {
    for (const bearer of [true, false]) {
      a.received.length = 0;
      const rawConfig = RawConfigOps(newState({ bearer }));

      await rawConfig.exportRawConfig({ path: '/keys', apiVersion: CUSTOM });
      await rawConfig.importRawConfig(
        { path: '/keys/x', apiVersion: CUSTOM },
        { name: 'y' }
      );

      expect(a.received.map((r) => r.version)).toEqual([
        CUSTOM_VERSION,
        CUSTOM_VERSION,
      ]);
      expect(a.received.map((r) => r.authorization)).toEqual(
        bearer
          ? [`Bearer ${MAIN_TOKEN}`, `Bearer ${MAIN_TOKEN}`]
          : [undefined, undefined]
      );
    }
  });

  test('5: monitoring goes to /monitoring with the log key and secret, not with a bearer token', async () => {
    const rawConfig = RawConfigOps(newState());

    await rawConfig.exportRawConfig({
      path: '/monitoring/logs?source=am-core&_pageSize=1',
    });
    await rawConfig.importRawConfig(
      { path: '/monitoring/logs/x' },
      { name: 'y' }
    );

    expect(b.received).toHaveLength(0);
    expect(a.received.map((r) => [r.method, r.url])).toEqual([
      ['GET', '/monitoring/logs?source=am-core&_pageSize=1'],
      ['PUT', '/monitoring/logs/x'],
    ]);
    for (const request of a.received) {
      expect(request.apiKey).toBe(LOG_KEY);
      expect(request.apiSecret).toBe(LOG_SECRET);
      expect(request.authorization).toBeUndefined();
      expect(request.cookie).toBeUndefined();
      expect(request.version).toBeUndefined();
    }
  });

  test('6: monitoring sends the version the caller names', async () => {
    const rawConfig = RawConfigOps(newState());

    await rawConfig.exportRawConfig({
      path: '/monitoring/logs',
      apiVersion: CUSTOM,
    });

    expect(a.received.map((r) => r.version)).toEqual([CUSTOM_VERSION]);
  });

  test('7: ws goes to /ws with the PingFederate bearer token, not the main one, GET and PUT', async () => {
    const rawConfig = RawConfigOps(newState());

    await rawConfig.exportRawConfig({ path: '/ws/admin/pf-admin-api/v1/x' });
    await rawConfig.importRawConfig(
      { path: '/ws/admin/pf-admin-api/v1/x' },
      { name: 'y' }
    );

    expect(b.received).toHaveLength(0);
    expect(a.received.map((r) => [r.method, r.url])).toEqual([
      ['GET', '/ws/admin/pf-admin-api/v1/x'],
      ['PUT', '/ws/admin/pf-admin-api/v1/x'],
    ]);
    for (const request of a.received) {
      expect(request.authorization).toBe(`Bearer ${PF_TOKEN}`);
      expect(request.xsrf).toBe('PingFederate');
      expect(request.version).toBeUndefined();
    }
    expect(JSON.parse(a.received[1].body)).toEqual({ name: 'y' });
  });

  test('8: ws sends the version the caller names', async () => {
    const rawConfig = RawConfigOps(newState());

    await rawConfig.importRawConfig(
      { path: '/ws/admin/pf-admin-api/v1/x', apiVersion: CUSTOM },
      { name: 'y' }
    );

    expect(a.received.map((r) => r.version)).toEqual([CUSTOM_VERSION]);
  });

  test('9: environment goes to /environment, not to the context of the host', async () => {
    const rawConfig = RawConfigOps(newState({ context: '/openam' }));

    await rawConfig.exportRawConfig({ path: '/environment/variables/x' });

    expect(a.received.map((r) => [r.method, r.url])).toEqual([
      ['GET', '/environment/variables/x'],
    ]);
    expect(a.received[0].version).toBe(DEFAULT_VERSION);
  });
});

/**
 * A raw path is a path by design. Whatever it holds, the request goes to the
 * host of the connection and the credentials stay with it: server B must see
 * nothing, not even a request without a credential.
 */
describe('a path that tries to send the request somewhere else', () => {
  // the root, and whether the connection has an IDM host (server C) that the openidm root goes to
  const hostileRoots: [string, boolean][] = [
    ['iga', false],
    ['keys', false],
    ['monitoring', false],
    ['ws', false],
    ['environment', false],
    ['am', false],
    ['openidm', false],
    ['openidm', true],
  ];
  const tails = (bPort: number) => [
    `https://127.0.0.1:${bPort}/x`,
    `//127.0.0.1:${bPort}/x`,
    `a@127.0.0.1:${bPort}/x`,
    `@127.0.0.1:${bPort}/x`,
    `x/@127.0.0.1:${bPort}/y`,
    `x:y@127.0.0.1:${bPort}/z`,
    '..',
    '../../x',
    '%2e%2e/x',
    '%2e%2e%2f%2e%2e%2fx',
    '..\\x',
    `\\\\127.0.0.1:${bPort}\\x`,
    `x\r\nHost: 127.0.0.1:${bPort}`,
    `x%0d%0aHost:%20127.0.0.1:${bPort}`,
    `?next=http://127.0.0.1:${bPort}/x`,
    `#@127.0.0.1:${bPort}`,
  ];

  test.each(hostileRoots)(
    '1: on the %s root (IDM host: %s), B sees nothing and the host it was sent to sees every request',
    async (root, withIdmHost) => {
      const rawConfig = RawConfigOps(
        newState({ idmHost: withIdmHost ? `${c.origin}/openidm` : '' })
      );
      const target = withIdmHost ? c : a;
      const other = withIdmHost ? a : c;
      let sent = 0;
      for (const tail of tails(b.port)) {
        for (const send of [
          () => rawConfig.exportRawConfig({ path: `${root}/${tail}` }),
          () =>
            rawConfig.importRawConfig(
              { path: `${root}/${tail}` },
              { name: 'y' }
            ),
        ]) {
          // the HTTP client may refuse a path (a line break), which is fine
          await send().catch(() => undefined);
          sent++;
        }
      }

      expect(b.received).toHaveLength(0);
      expect(other.received).toHaveLength(0);
      expect(target.received.length).toBeGreaterThan(0);
      expect(target.received.length).toBeLessThanOrEqual(sent);
      for (const request of target.received) {
        expect(request.host).toBe(`127.0.0.1:${target.port}`);
      }
    }
  );

  test('2: a path that starts with a host or a scheme is no root and nothing is sent', async () => {
    const rawConfig = RawConfigOps(newState());
    const paths = [
      `https://127.0.0.1:${b.port}/x`,
      `http://127.0.0.1:${b.port}/am/json/x`,
      `//127.0.0.1:${b.port}/x`,
      `/\\127.0.0.1:${b.port}/x`,
      `127.0.0.1:${b.port}/x`,
      `a@127.0.0.1:${b.port}/x`,
      `openidm@127.0.0.1:${b.port}/config/x`,
      `iga@127.0.0.1:${b.port}/x`,
    ];
    for (const path of paths) {
      await expect(rawConfig.exportRawConfig({ path })).rejects.toThrow(
        'Error in exportRawIdm'
      );
      await expect(
        rawConfig.importRawConfig({ path }, { name: 'y' })
      ).rejects.toThrow('Error in importRawConfig');
    }

    expect(a.received).toHaveLength(0);
    expect(b.received).toHaveLength(0);
  });

  test('3: the credentials of every root go to A only, whatever the path', async () => {
    const rawConfig = RawConfigOps(newState());
    for (const root of ['iga', 'keys', 'monitoring', 'ws']) {
      await rawConfig
        .exportRawConfig({ path: `${root}/@127.0.0.1:${b.port}/x` })
        .catch(() => undefined);
    }
    await rawConfig
      .exportRawConfig({ path: `openidm/@127.0.0.1:${b.port}/x` })
      .catch(() => undefined);

    expect(b.received).toHaveLength(0);
    expect(a.received.map((r) => r.url)).toEqual([
      `/iga/@127.0.0.1:${b.port}/x`,
      `/keys/@127.0.0.1:${b.port}/x`,
      `/monitoring/@127.0.0.1:${b.port}/x`,
      `/ws/@127.0.0.1:${b.port}/x`,
      `/openidm/@127.0.0.1:${b.port}/x`,
    ]);
    expect(a.received.map((r) => r.authorization ?? r.apiKey)).toEqual([
      `Bearer ${MAIN_TOKEN}`,
      `Bearer ${MAIN_TOKEN}`,
      LOG_KEY,
      `Bearer ${PF_TOKEN}`,
      `Bearer ${MAIN_TOKEN}`,
    ]);
  });
});
