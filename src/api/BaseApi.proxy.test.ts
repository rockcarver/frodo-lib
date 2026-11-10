/**
 * Hermetic tests of the proxy support of the library's HTTP layer.
 *
 * Run with:
 *
 *        npm run test:only -- src/api/BaseApi.proxy.test.ts
 *
 * The library sends every request through proxy-agent (`getHttpAgent()` and
 * `getHttpsAgent()` in BaseApi.ts), which reads HTTP_PROXY, HTTPS_PROXY,
 * ALL_PROXY and NO_PROXY from the environment when a request is made. These
 * tests start a proxy and the targets in the test process, on the loopback
 * interface, and drive the real request path (`getServerInfo()` of
 * ServerInfoApi.ts, the call the live probe in BaseApi.proxy.live.test.ts also
 * makes). Nothing leaves the machine, and no squid is needed.
 *
 * What a test proves is read from the proxy, not guessed from the answer: the
 * proxy records every CONNECT, every forwarded request and the bytes that pass
 * through its tunnels, and a target records every request and connection it
 * sees. A request that bypassed the proxy would still get an answer, so the
 * answer alone proves nothing.
 *
 * Every test sets the proxy variables it needs and nothing else: `beforeEach`
 * clears all of them (the jest setup file test/jest-no-ambient-proxy.setup.js
 * has already hidden the ones of the machine) and `afterEach` restores them.
 *
 * The tests that depend on FRODO_NO_KEEPALIVE import the library afresh,
 * because BaseApi.ts reads it when it is loaded (like BaseApi.agentConfig.unit.test.ts).
 *
 * The files that make up the proxy set are listed in the `test:proxy` script of
 * package.json; the last describe block below keeps that list from shrinking.
 * See decisions/0017-proxy-support-is-guarded-by-a-short-named-set-of-tests.md.
 */
import { spawnSync } from 'child_process';
import { createPrivateKey, createPublicKey, webcrypto } from 'crypto';
import fs from 'fs';
import http from 'http';
import https from 'https';
import net, { AddressInfo } from 'net';
import path from 'path';
import 'reflect-metadata';
import { jest } from '@jest/globals';
import {
  BasicConstraintsExtension,
  GeneralName,
  KeyUsagesExtension,
  SubjectAlternativeNameExtension,
  X509CertificateGenerator,
} from '@peculiar/x509';
import { FrodoError } from '../ops/FrodoError';
import StateImpl from '../shared/State';
import { getPrivateKey, getPublicKey } from '../test/utils/TestUtils';
import { generateAmApi } from './BaseApi';
import { getServerInfo } from './ServerInfoApi';

const ROOT = process.cwd();

/** What the targets answer with, so that a test can tell the answer reached it. */
const COOKIE_NAME = 'frodoProxyTestCookie';

/** The path the library asks for: `<host>/json/serverinfo/*`, host being `<origin>/am`. */
const SERVER_INFO_PATH = '/am/json/serverinfo/*';

/** A name that only the test proxy can resolve (the `.invalid` TLD never resolves). */
const PROXY_ONLY_NAME = 'frodo-target.invalid';

/**
 * Every variable these tests touch: those proxy-from-env reads (lower case
 * first, then upper case, then the npm_config_ ones) and the keep-alive switch.
 */
const ENV_NAMES = [
  'HTTP_PROXY',
  'http_proxy',
  'HTTPS_PROXY',
  'https_proxy',
  'ALL_PROXY',
  'all_proxy',
  'NO_PROXY',
  'no_proxy',
  'npm_config_proxy',
  'npm_config_http_proxy',
  'npm_config_https_proxy',
  'npm_config_no_proxy',
  'FRODO_NO_KEEPALIVE',
];

// ---------------------------------------------------------------------------
// A self-signed certificate for the HTTPS targets
// ---------------------------------------------------------------------------

async function createSelfSignedCertificate(): Promise<{
  key: string;
  cert: string;
}> {
  // The signing keys are the fixed test PEMs from TestUtils. @peculiar/x509
  // signs with WebCrypto CryptoKeys, so import the PEMs as PKCS#8/SPKI DER.
  const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  const signingKey = await webcrypto.subtle.importKey(
    'pkcs8',
    createPrivateKey(getPrivateKey()).export({ type: 'pkcs8', format: 'der' }),
    alg,
    true,
    ['sign']
  );
  const publicKey = await webcrypto.subtle.importKey(
    'spki',
    createPublicKey(getPublicKey()).export({ type: 'spki', format: 'der' }),
    alg,
    true,
    ['verify']
  );
  const cert = await X509CertificateGenerator.create({
    serialNumber: '01',
    subject: 'CN=127.0.0.1',
    issuer: 'CN=127.0.0.1',
    notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
    notAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
    publicKey,
    signingKey,
    signingAlgorithm: 'RSASSA-PKCS1-v1_5',
    extensions: [
      new SubjectAlternativeNameExtension([new GeneralName('ip', '127.0.0.1')]),
      new BasicConstraintsExtension(false, undefined, true),
      new KeyUsagesExtension(0x80, true), // digitalSignature
    ],
  });
  return { key: getPrivateKey(), cert: cert.toString('pem') };
}

// ---------------------------------------------------------------------------
// The servers: targets and a proxy, all on the loopback interface
// ---------------------------------------------------------------------------

type Seen = {
  method: string;
  /** The request target as the server read it: a path, `host:port` for CONNECT, an absolute URI for a forwarded request. */
  url: string;
  headers: http.IncomingHttpHeaders;
};

type Target = {
  scheme: 'http' | 'https';
  port: number;
  /** `127.0.0.1:<port>`, what a CONNECT for this target names. */
  hostPort: string;
  /** The `host` of a state that points at this target. */
  host: string;
  requests: Seen[];
  connections: number;
};

type Proxy = {
  /** What to put into a proxy variable: `http://127.0.0.1:<port>`. */
  url: string;
  port: number;
  /** Every CONNECT received. */
  connects: Seen[];
  /** Every plain request received (the request target is an absolute URI). */
  forwards: Seen[];
  /** TCP connections from the client, one per tunnel or per kept-alive connection. */
  connections: number;
  /** Bytes the clients sent into the tunnels. */
  tunnelBytes: number;
  /** Bytes a client sent after the proxy refused its CONNECT: a request that was meant for the target. */
  bytesAfterRefusal: number;
};

type ProxyOptions = {
  /** Answer every CONNECT and forwarded request with this status instead of serving it. */
  refuseWith?: number;
  /** Require this `user:password` as Basic credentials, answer 407 without them. */
  credentials?: string;
  /** Names the proxy resolves on its own: name to address. */
  hosts?: Record<string, string>;
};

const STATUS_TEXT: Record<number, string> = {
  403: 'Forbidden',
  407: 'Proxy Authentication Required',
  502: 'Bad Gateway',
};

/** Servers started by a test, closed by `afterEach`. */
const cleanups: Array<() => Promise<void>> = [];

function listen(server: net.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve((server.address() as AddressInfo).port)
    );
  });
}

/** Closes a server, destroying the connections that a client keeps alive. */
function closer(server: http.Server, sockets: Set<net.Socket>) {
  return () =>
    new Promise<void>((resolve) => {
      sockets.forEach((socket) => socket.destroy());
      server.close(() => resolve());
    });
}

/** A port on which nothing listens. */
async function closedPort(): Promise<number> {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function startTarget(
  scheme: 'http' | 'https',
  tls?: { key: string; cert: string }
): Promise<Target> {
  const target = { scheme, requests: [], connections: 0 } as unknown as Target;
  const handler: http.RequestListener = (req, res) => {
    target.requests.push({
      method: req.method ?? '',
      url: req.url ?? '',
      headers: req.headers,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ cookieName: COOKIE_NAME }));
  };
  const server: http.Server | https.Server =
    scheme === 'https'
      ? https.createServer({ key: tls?.key, cert: tls?.cert }, handler)
      : http.createServer(handler);
  const sockets = new Set<net.Socket>();
  server.on(scheme === 'https' ? 'secureConnection' : 'connection', (s) => {
    target.connections++;
    sockets.add(s as net.Socket);
    s.on('close', () => sockets.delete(s as net.Socket));
  });
  // a TLS server also emits 'connection' for the raw socket: track those to close them
  server.on('connection', (s: net.Socket) => sockets.add(s));
  target.port = await listen(server);
  target.hostPort = `127.0.0.1:${target.port}`;
  target.host = `${scheme}://${target.hostPort}/am`;
  cleanups.push(closer(server, sockets));
  return target;
}

async function startProxy(options: ProxyOptions = {}): Promise<Proxy> {
  const proxy = {
    connects: [],
    forwards: [],
    connections: 0,
    tunnelBytes: 0,
    bytesAfterRefusal: 0,
  } as unknown as Proxy;
  const sockets = new Set<net.Socket>();
  const server = http.createServer();

  const resolveHost = (name: string) => options.hosts?.[name] ?? name;
  const expected = options.credentials
    ? `Basic ${Buffer.from(options.credentials).toString('base64')}`
    : undefined;
  /** The status the proxy answers with instead of serving the request, if any. */
  const refusal = (headers: http.IncomingHttpHeaders): number | undefined => {
    if (options.refuseWith) return options.refuseWith;
    if (expected && headers['proxy-authorization'] !== expected) return 407;
    return undefined;
  };
  const refusalHead = (status: number) =>
    `HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? 'Error'}\r\n` +
    (status === 407
      ? 'Proxy-Authenticate: Basic realm="frodo-test-proxy"\r\n'
      : '') +
    'Content-Length: 0\r\nConnection: close\r\n\r\n';

  server.on('connection', (socket) => {
    proxy.connections++;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  // HTTPS targets: a tunnel that is piped blindly in both directions, so that
  // the TLS handshake happens between the client and the target.
  server.on('connect', (req, clientSocket, head) => {
    proxy.connects.push({
      method: req.method ?? '',
      url: req.url ?? '',
      headers: req.headers,
    });
    const status = refusal(req.headers);
    if (status) {
      clientSocket.on('data', (chunk) => {
        proxy.bytesAfterRefusal += chunk.length;
      });
      clientSocket.end(refusalHead(status));
      return;
    }
    const [name, port] = (req.url ?? '').split(':');
    const upstream = net.connect(Number(port) || 443, resolveHost(name), () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      clientSocket.on('data', (chunk) => {
        proxy.tunnelBytes += chunk.length;
      });
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    sockets.add(upstream);
    upstream.on('close', () => sockets.delete(upstream));
    upstream.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => upstream.destroy());
    clientSocket.on('close', () => upstream.destroy());
  });

  // HTTP targets: a forward proxy. The request target is an absolute URI.
  server.on('request', (req, res) => {
    if (!/^http:\/\//i.test(req.url ?? '')) {
      res.writeHead(400).end();
      return;
    }
    proxy.forwards.push({
      method: req.method ?? '',
      url: req.url ?? '',
      headers: req.headers,
    });
    const status = refusal(req.headers);
    if (status) {
      res.writeHead(status, {
        ...(status === 407 && {
          'Proxy-Authenticate': 'Basic realm="frodo-test-proxy"',
        }),
        'Content-Length': '0',
      });
      res.end();
      return;
    }
    const url = new URL(req.url as string);
    const headers = { ...req.headers, host: url.host };
    delete headers['proxy-authorization'];
    delete headers['proxy-connection'];
    const upstream = http.request(
      {
        host: resolveHost(url.hostname),
        port: Number(url.port) || 80,
        path: url.pathname + url.search,
        method: req.method,
        headers,
        agent: false,
      },
      (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
      }
    );
    upstream.on('error', () => res.writeHead(502).end());
    req.pipe(upstream);
  });

  proxy.port = await listen(server);
  proxy.url = `http://127.0.0.1:${proxy.port}`;
  cleanups.push(closer(server, sockets));
  return proxy;
}

// ---------------------------------------------------------------------------
// Driving the library
// ---------------------------------------------------------------------------

/** A state that points at the target; the certificate of an HTTPS target is self-signed. */
function stateFor(host: string, allowInsecureConnection = true) {
  const state = StateImpl({});
  state.setAllowInsecureConnection(allowInsecureConnection);
  state.setHost(host);
  return state;
}

/** One unauthenticated request, the one the library makes before it logs in. */
async function ask(host: string, allowInsecureConnection = true) {
  return getServerInfo({ state: stateFor(host, allowInsecureConnection) });
}

/** What a rejected call rejected with. */
async function failureOf(call: Promise<unknown>): Promise<any> {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error('the call was expected to fail, and it succeeded');
}

/** Imports the library afresh, so that BaseApi.ts reads FRODO_NO_KEEPALIVE again. */
async function importLibraryAfresh() {
  jest.resetModules();
  const { getServerInfo: freshGetServerInfo } = await import('./ServerInfoApi');
  const freshStateImpl = (await import('../shared/State')).default;
  return (host: string) => {
    const state = freshStateImpl({});
    state.setAllowInsecureConnection(true);
    state.setHost(host);
    return freshGetServerInfo({ state });
  };
}

// ---------------------------------------------------------------------------
// The tests
// ---------------------------------------------------------------------------

const savedEnv = new Map<string, string | undefined>();
let tls: { key: string; cert: string };

beforeAll(async () => {
  tls = await createSelfSignedCertificate();
});

beforeEach(() => {
  for (const name of ENV_NAMES) {
    savedEnv.set(name, process.env[name]);
    delete process.env[name];
  }
});

afterEach(async () => {
  for (const [name, value] of savedEnv) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  savedEnv.clear();
  await Promise.all(cleanups.splice(0).map((close) => close()));
});

/**
 * A proxy that refused a CONNECT must not be sent the request meant for the
 * target (it could carry an Authorization header): the library sends nothing
 * more on that connection. Gives a late write a moment to arrive.
 */
async function expectNothingSentAfterRefusal(proxy: Proxy) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(proxy.bytesAfterRefusal).toBe(0);
}

/** A direct request: nothing reached the proxy, and the target saw the request. */
function expectDirect(proxy: Proxy, target: Target, requests = 1) {
  expect(proxy.connects).toEqual([]);
  expect(proxy.forwards).toEqual([]);
  expect(proxy.tunnelBytes).toBe(0);
  expect(target.requests).toHaveLength(requests);
}

describe('BaseApi with HTTPS_PROXY: an HTTPS target is reached through a CONNECT tunnel', () => {
  test('the proxy sees one CONNECT for the target host and port, and the answer reaches the caller', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;

    const data = await ask(target.host);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expect(proxy.connects.map((c) => [c.method, c.url])).toEqual([
      ['CONNECT', target.hostPort],
    ]);
    expect(proxy.forwards).toEqual([]);
    expect(proxy.tunnelBytes).toBeGreaterThan(0);
    expect(target.requests.map((r) => r.url)).toEqual([SERVER_INFO_PATH]);
  });

  test('the proxy is given the host name, not an address the library resolved', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy({
      hosts: { [PROXY_ONLY_NAME]: '127.0.0.1' },
    });
    process.env.HTTPS_PROXY = proxy.url;

    const data = await ask(`https://${PROXY_ONLY_NAME}:${target.port}/am`);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expect(proxy.connects.map((c) => c.url)).toEqual([
      `${PROXY_ONLY_NAME}:${target.port}`,
    ]);
  });

  test.each(['HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy'])(
    '%s selects the proxy',
    async (name) => {
      const target = await startTarget('https', tls);
      const proxy = await startProxy();
      process.env[name] = proxy.url;

      await ask(target.host);

      expect(proxy.connects.map((c) => c.url)).toEqual([target.hostPort]);
    }
  );

  test('https_proxy takes precedence over HTTPS_PROXY', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = `http://127.0.0.1:${await closedPort()}`;
    process.env.https_proxy = proxy.url;

    await ask(target.host);

    expect(proxy.connects.map((c) => c.url)).toEqual([target.hostPort]);
  });

  test('a variable for the scheme takes precedence over ALL_PROXY', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.ALL_PROXY = `http://127.0.0.1:${await closedPort()}`;
    process.env.HTTPS_PROXY = proxy.url;

    await ask(target.host);

    expect(proxy.connects.map((c) => c.url)).toEqual([target.hostPort]);
  });

  test('HTTP_PROXY alone does not touch an HTTPS request', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTP_PROXY = proxy.url;

    const data = await ask(target.host);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expectDirect(proxy, target);
  });

  test('the self-signed certificate of the target is checked end to end, through the tunnel', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;

    // allowInsecureConnection is off: the library must see the target's
    // certificate (the proxy only pipes bytes), and refuse it
    const error = await failureOf(ask(target.host, false));

    expect(error.code).toMatch(
      /^(DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|INVALID_PURPOSE|UNABLE_TO_VERIFY_LEAF_SIGNATURE)$/
    );
    expect(proxy.connects).toHaveLength(1);
    expect(target.requests).toEqual([]);
  });
});

describe('BaseApi with NO_PROXY', () => {
  test.each([
    ['NO_PROXY', '127.0.0.1'],
    ['no_proxy', '127.0.0.1'],
    ['NO_PROXY', 'corp.example,127.0.0.1,other.example'],
    ['NO_PROXY', '*'],
  ])('%s=%s: the target is reached directly', async (name, value) => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;
    process.env[name] = value;

    const data = await ask(target.host);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expectDirect(proxy, target);
  });

  test('NO_PROXY with the port of the target: the target is reached directly', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;
    process.env.NO_PROXY = target.hostPort;

    await ask(target.host);

    expectDirect(proxy, target);
  });

  test('NO_PROXY with another port of the same host does not exclude the target', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;
    process.env.NO_PROXY = `127.0.0.1:${target.port + 1}`;

    await ask(target.host);

    expect(proxy.connects.map((c) => c.url)).toEqual([target.hostPort]);
  });

  test('NO_PROXY naming another host does not exclude the target', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;
    process.env.NO_PROXY = 'other.example';

    await ask(target.host);

    expect(proxy.connects.map((c) => c.url)).toEqual([target.hostPort]);
  });

  test('no_proxy takes precedence over NO_PROXY: a lower case list that does not name the target wins', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;
    process.env.no_proxy = 'other.example';
    process.env.NO_PROXY = '127.0.0.1';

    await ask(target.host);

    expect(proxy.connects.map((c) => c.url)).toEqual([target.hostPort]);
  });

  test('no_proxy takes precedence over NO_PROXY: a lower case list that names the target wins', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;
    process.env.no_proxy = '127.0.0.1';
    process.env.NO_PROXY = 'other.example';

    await ask(target.host);

    expectDirect(proxy, target);
  });

  test('NO_PROXY also excludes an HTTP target from HTTP_PROXY', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy();
    process.env.HTTP_PROXY = proxy.url;
    process.env.NO_PROXY = '127.0.0.1';

    const data = await ask(target.host);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expectDirect(proxy, target);
  });
});

describe('BaseApi with credentials in the proxy URL', () => {
  const basic = (credentials: string) =>
    `Basic ${Buffer.from(credentials).toString('base64')}`;

  test('the proxy sees a Proxy-Authorization header, and the target does not', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy({ credentials: 'alice:s3cret' });
    process.env.HTTPS_PROXY = `http://alice:s3cret@127.0.0.1:${proxy.port}`;

    const data = await ask(target.host);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expect(proxy.connects).toHaveLength(1);
    expect(proxy.connects[0].headers['proxy-authorization']).toBe(
      basic('alice:s3cret')
    );
    // the credentials belong to the proxy: they are not sent on to the target
    expect(target.requests).toHaveLength(1);
    expect(target.requests[0].headers['proxy-authorization']).toBeUndefined();
    expect(target.requests[0].headers.authorization).toBeUndefined();
  });

  test('percent-encoded credentials are decoded before they are sent', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy({ credentials: 'al@ice:p:ss/w rd' });
    process.env.HTTPS_PROXY = `http://al%40ice:p%3Ass%2Fw%20rd@127.0.0.1:${proxy.port}`;

    await ask(target.host);

    expect(proxy.connects[0].headers['proxy-authorization']).toBe(
      basic('al@ice:p:ss/w rd')
    );
    expect(target.requests).toHaveLength(1);
  });

  test('a proxy that wants credentials and gets none answers 407, and the error says so', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy({ credentials: 'alice:s3cret' });
    process.env.HTTPS_PROXY = proxy.url;

    const started = Date.now();
    const error = await failureOf(ask(target.host));

    expect(Date.now() - started).toBeLessThan(5000);
    expect(error.response?.status).toBe(407);
    // the challenge of the proxy is kept, so a caller can tell the proxy from the target
    expect(error.response?.headers['proxy-authenticate']).toMatch(/^Basic/);
    expect(proxy.connects[0].headers['proxy-authorization']).toBeUndefined();
    expect(target.requests).toEqual([]);
    await expectNothingSentAfterRefusal(proxy);

    // what an ops function makes of it, and a command prints
    const wrapped = new FrodoError('Error getting server info', error);
    expect(wrapped.isHttpError).toBe(true);
    expect(wrapped.httpStatus).toBe(407);
    expect(wrapped.getCombinedMessage()).toContain('Status: 407');
  });

  test('wrong credentials also answer 407, and the target is not contacted', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy({ credentials: 'alice:s3cret' });
    process.env.HTTPS_PROXY = `http://alice:wrong@127.0.0.1:${proxy.port}`;

    const error = await failureOf(ask(target.host));

    expect(error.response?.status).toBe(407);
    expect(proxy.connects[0].headers['proxy-authorization']).toBe(
      basic('alice:wrong')
    );
    expect(target.requests).toEqual([]);
  });

  test.each([403, 502])(
    'a proxy that refuses the tunnel with %i: the error carries that status',
    async (status) => {
      const target = await startTarget('https', tls);
      const proxy = await startProxy({ refuseWith: status });
      process.env.HTTPS_PROXY = proxy.url;

      const error = await failureOf(ask(target.host));

      expect(error.response?.status).toBe(status);
      expect(new FrodoError('x', error).getCombinedMessage()).toContain(
        `Status: ${status}`
      );
      expect(target.requests).toEqual([]);
      await expectNothingSentAfterRefusal(proxy);
    }
  );

  test('credentials are sent with a forwarded HTTP request too', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({ credentials: 'alice:s3cret' });
    process.env.HTTP_PROXY = `http://alice:s3cret@127.0.0.1:${proxy.port}`;

    const data = await ask(target.host);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expect(proxy.forwards).toHaveLength(1);
    expect(proxy.forwards[0].headers['proxy-authorization']).toBe(
      basic('alice:s3cret')
    );
    expect(target.requests[0].headers['proxy-authorization']).toBeUndefined();
  });

  test('an HTTP request to a proxy that wants credentials and gets none answers 407', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({ credentials: 'alice:s3cret' });
    process.env.HTTP_PROXY = proxy.url;

    const error = await failureOf(ask(target.host));

    expect(error.response?.status).toBe(407);
    expect(target.requests).toEqual([]);
  });
});

describe('BaseApi with a proxy that cannot be reached', () => {
  test('an HTTPS request fails quickly, and names the proxy address', async () => {
    const target = await startTarget('https', tls);
    const dead = await closedPort();
    process.env.HTTPS_PROXY = `http://127.0.0.1:${dead}`;

    const started = Date.now();
    const error = await failureOf(ask(target.host));

    expect(Date.now() - started).toBeLessThan(5000);
    expect(error.code).toBe('ECONNREFUSED');
    expect(error.message).toContain(`127.0.0.1:${dead}`);
    // the library does not fall back to a direct request
    expect(target.requests).toEqual([]);
    expect(
      new FrodoError('Error getting server info', error).getCombinedMessage()
    ).toContain(`ECONNREFUSED 127.0.0.1:${dead}`);
  }, 15000);

  test('an HTTP request fails quickly, and names the proxy address', async () => {
    const target = await startTarget('http');
    const dead = await closedPort();
    process.env.HTTP_PROXY = `http://127.0.0.1:${dead}`;

    const started = Date.now();
    const error = await failureOf(ask(target.host));

    expect(Date.now() - started).toBeLessThan(5000);
    expect(error.code).toBe('ECONNREFUSED');
    expect(error.message).toContain(`127.0.0.1:${dead}`);
    expect(target.requests).toEqual([]);
  }, 15000);
});

describe('BaseApi with HTTP_PROXY: an HTTP target is reached through a forward proxy', () => {
  test('the proxy sees an absolute-URI request line, and the answer reaches the caller', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy();
    process.env.HTTP_PROXY = proxy.url;

    const data = await ask(target.host);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expect(proxy.forwards.map((r) => [r.method, r.url])).toEqual([
      ['GET', `http://${target.hostPort}${SERVER_INFO_PATH}`],
    ]);
    expect(proxy.connects).toEqual([]);
    // the target sees the request as if it came straight from the client
    expect(target.requests.map((r) => r.url)).toEqual([SERVER_INFO_PATH]);
    expect(target.requests[0].headers.host).toBe(target.hostPort);
  });

  test('the proxy is given the host name, not an address the library resolved', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({
      hosts: { [PROXY_ONLY_NAME]: '127.0.0.1' },
    });
    process.env.http_proxy = proxy.url;

    const data = await ask(`http://${PROXY_ONLY_NAME}:${target.port}/am`);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expect(proxy.forwards.map((r) => r.url)).toEqual([
      `http://${PROXY_ONLY_NAME}:${target.port}${SERVER_INFO_PATH}`,
    ]);
  });

  test('HTTPS_PROXY alone does not touch an HTTP request', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;

    const data = await ask(target.host);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expectDirect(proxy, target);
  });
});

describe('BaseApi reuses a tunnel through the shared agents', () => {
  test('two sequential HTTPS requests use one CONNECT tunnel', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;
    const askAfresh = await importLibraryAfresh();

    await askAfresh(target.host);
    await askAfresh(target.host);

    expect(proxy.connects).toHaveLength(1);
    expect(proxy.connections).toBe(1);
    expect(target.requests).toHaveLength(2);
    expect(target.connections).toBe(1);
  });

  test('with FRODO_NO_KEEPALIVE=1 they use two', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;
    process.env.FRODO_NO_KEEPALIVE = '1';
    const askAfresh = await importLibraryAfresh();

    await askAfresh(target.host);
    await askAfresh(target.host);

    expect(proxy.connects).toHaveLength(2);
    expect(proxy.connections).toBe(2);
    expect(target.requests).toHaveLength(2);
    expect(target.connections).toBe(2);
  });

  // Found while writing these tests: on a kept-alive connection to a forward
  // proxy, the second request of an HTTP target goes out with a relative
  // request line (`GET /am/json/serverinfo/*`) and without its
  // Proxy-Authorization, so a proxy answers 400 or 407. The agent rewrites the
  // request line when it opens a connection, and not when it reuses one. HTTPS
  // targets are not affected: the proxy only carries bytes after CONNECT.
  // FRODO_NO_KEEPALIVE=1 is the way around it, and the test below pins that.
  test.todo(
    'two sequential HTTP requests through a forward proxy reuse one connection and both carry an absolute-URI request line and the proxy credentials'
  );

  test('with FRODO_NO_KEEPALIVE=1 two sequential HTTP requests each open a connection to the forward proxy and carry an absolute-URI request line and the proxy credentials', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({ credentials: 'alice:s3cret' });
    process.env.HTTP_PROXY = `http://alice:s3cret@127.0.0.1:${proxy.port}`;
    process.env.FRODO_NO_KEEPALIVE = '1';
    const askAfresh = await importLibraryAfresh();

    await askAfresh(target.host);
    await askAfresh(target.host);

    expect(proxy.connections).toBe(2);
    expect(proxy.forwards.map((r) => r.url)).toEqual([
      `http://${target.hostPort}${SERVER_INFO_PATH}`,
      `http://${target.hostPort}${SERVER_INFO_PATH}`,
    ]);
    for (const forward of proxy.forwards) {
      expect(forward.headers['proxy-authorization']).toBe(
        `Basic ${Buffer.from('alice:s3cret').toString('base64')}`
      );
    }
    expect(target.requests).toHaveLength(2);
  });
});

describe('BaseApi shares its agents between request instances', () => {
  // A tunnel is kept in the pool of an agent. An agent made per call would
  // open a tunnel per call, whatever the keep-alive option says.
  const requestFor = (allowInsecureConnection: boolean) =>
    generateAmApi({
      resource: {},
      requiredScopes: [],
      state: stateFor('http://127.0.0.1:1/am', allowInsecureConnection),
    });

  test('the HTTP agent, and the HTTPS agent of each certificate mode, are created once', () => {
    const [insecure1, insecure2] = [requestFor(true), requestFor(true)];
    const [secure1, secure2] = [requestFor(false), requestFor(false)];

    expect(insecure1.defaults.httpAgent).toBeDefined();
    expect(insecure1.defaults.httpAgent).toBe(insecure2.defaults.httpAgent);
    expect(insecure1.defaults.httpAgent).toBe(secure1.defaults.httpAgent);
    expect(insecure1.defaults.httpsAgent).toBeDefined();
    expect(insecure1.defaults.httpsAgent).toBe(insecure2.defaults.httpsAgent);
    expect(secure1.defaults.httpsAgent).toBeDefined();
    expect(secure1.defaults.httpsAgent).toBe(secure2.defaults.httpsAgent);
    // the agent that accepts any certificate is never handed to a request that does not allow that
    expect(secure1.defaults.httpsAgent).not.toBe(insecure1.defaults.httpsAgent);
  });

  test('axios is told not to apply the proxy variables itself', () => {
    expect(requestFor(true).defaults.proxy).toBe(false);
  });
});

describe('BaseApi reads the proxy variables when it sends a request', () => {
  test('variables set after the agents were created apply to the next request, and unsetting them makes it direct', async () => {
    const target = await startTarget('https', tls);
    const proxyA = await startProxy();
    const proxyB = await startProxy();

    // 1: the agents are created by this request, which has no proxy
    await ask(target.host);
    expectDirect(proxyA, target, 1);

    // 2: set now, used by the next request
    process.env.HTTPS_PROXY = proxyA.url;
    await ask(target.host);
    expect(proxyA.connects.map((c) => c.url)).toEqual([target.hostPort]);
    expect(proxyA.tunnelBytes).toBeGreaterThan(0);
    expect(target.requests).toHaveLength(2);

    // 3: unset, and the next request is direct again, not through a kept tunnel
    delete process.env.HTTPS_PROXY;
    const carried = proxyA.tunnelBytes;
    await ask(target.host);
    expect(proxyA.tunnelBytes).toBe(carried);
    expect(proxyA.connects).toHaveLength(1);
    expect(target.requests).toHaveLength(3);

    // 4: another proxy, and the next request goes through that one
    process.env.HTTPS_PROXY = proxyB.url;
    await ask(target.host);
    expect(proxyB.connects.map((c) => c.url)).toEqual([target.hostPort]);
    expect(proxyA.connects).toHaveLength(1);
    expect(target.requests).toHaveLength(4);

    // 5: NO_PROXY set now excludes the target from the next request
    process.env.NO_PROXY = '127.0.0.1';
    const carriedB = proxyB.tunnelBytes;
    await ask(target.host);
    expect(proxyB.tunnelBytes).toBe(carriedB);
    expect(proxyB.connects).toHaveLength(1);
    expect(target.requests).toHaveLength(5);
  });

  test('the same holds for HTTP requests and HTTP_PROXY', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy();

    await ask(target.host);
    expectDirect(proxy, target, 1);

    process.env.HTTP_PROXY = proxy.url;
    await ask(target.host);
    expect(proxy.forwards).toHaveLength(1);

    delete process.env.HTTP_PROXY;
    await ask(target.host);
    expect(proxy.forwards).toHaveLength(1);
    expect(target.requests).toHaveLength(3);
  });
});

/*
 * The jest setup file is the reason the other suites with real sockets pass
 * behind a proxy. Run it in a process of its own, with the variables a
 * corporate machine has, instead of trusting that the tests of this run saw
 * a clean environment (they would also see one if this run had none to hide).
 */
describe('the jest setup file test/jest-no-ambient-proxy.setup.js', () => {
  const SETUP = path.join(ROOT, 'test', 'jest-no-ambient-proxy.setup.js');
  const AMBIENT: Record<string, string> = {
    HTTP_PROXY: 'http://upper-http.corp.example:3128',
    http_proxy: 'http://lower-http.corp.example:3128',
    HTTPS_PROXY: 'http://upper-https.corp.example:3128',
    https_proxy: 'http://lower-https.corp.example:3128',
    ALL_PROXY: 'socks5://upper-all.corp.example:1080',
    all_proxy: 'socks5://lower-all.corp.example:1080',
    NO_PROXY: 'corp.example',
    no_proxy: 'lower.corp.example',
    npm_config_proxy: 'http://npm.corp.example:3128',
    npm_config_http_proxy: 'http://npm-http.corp.example:3128',
    npm_config_https_proxy: 'http://npm-https.corp.example:3128',
    npm_config_no_proxy: 'npm.corp.example',
  };

  function runSetup(env: Record<string, string>) {
    const run = spawnSync(
      process.execPath,
      [
        '-e',
        `require(${JSON.stringify(SETUP)}); process.stdout.write(JSON.stringify(process.env));`,
      ],
      { env, encoding: 'utf8' }
    );
    expect(run.status).toBe(0);
    return JSON.parse(run.stdout) as Record<string, string | undefined>;
  }

  test('removes every proxy variable, in either case, and the npm_config_ ones', () => {
    const after = runSetup({ ...AMBIENT, OTHER_SETTING: 'kept' });
    for (const name of Object.keys(AMBIENT)) {
      if (name === 'NO_PROXY') continue;
      expect({ name, value: after[name] }).toEqual({ name, value: undefined });
    }
    expect(after.OTHER_SETTING).toBe('kept');
  });

  test('exempts the loopback interface from proxying, whatever NO_PROXY was', () => {
    const after = runSetup(AMBIENT);
    expect(after.NO_PROXY).toBe('127.0.0.1,localhost,::1');
    expect(after.no_proxy).toBeUndefined();
  });

  test('keeps what it removed for the live probe, and only what was set', () => {
    const after = runSetup(AMBIENT);
    expect(JSON.parse(after.FRODO_TEST_AMBIENT_PROXY as string)).toEqual(
      AMBIENT
    );
    const none = runSetup({ HTTPS_PROXY: 'http://only.corp.example:3128' });
    expect(JSON.parse(none.FRODO_TEST_AMBIENT_PROXY as string)).toEqual({
      HTTPS_PROXY: 'http://only.corp.example:3128',
    });
  });

  test('is wired into jest.config.js as a setup file', () => {
    const config = fs.readFileSync(path.join(ROOT, 'jest.config.js'), 'utf8');
    expect(config).toMatch(
      /setupFiles:\s*\['<rootDir>\/test\/jest-no-ambient-proxy\.setup\.js'\]/
    );
  });
});

/*
 * The proxy set is the file list of the `test:proxy` script. CI runs that
 * script against a real proxy, so a list that quietly shrank (a renamed file,
 * a deleted one, a path that no longer matches) would leave proxy support
 * guarded by nothing. jest ignores a name that matches no file.
 */
describe('the test:proxy script of package.json', () => {
  const REQUIRED = [
    'src/api/BaseApi.proxy.test.ts',
    'src/api/BaseApi.expiredCert.test.ts',
    'src/api/BaseApi.agentConfig.unit.test.ts',
    'src/api/BaseApi.connectionReuse.test.ts',
    'src/api/BaseApi.proxy.live.test.ts',
  ];
  const scripts = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
  ).scripts as Record<string, string>;
  const named = (scripts['test:proxy'] ?? '')
    .split(/\s+/)
    .filter((word) => word.endsWith('.test.ts'));

  test('names every file of the proxy set', () => {
    expect(named).toEqual(expect.arrayContaining(REQUIRED));
    expect(named.length).toBeGreaterThanOrEqual(REQUIRED.length);
  });

  test('names only files that exist', () => {
    expect(
      named.filter((file) => !fs.existsSync(path.join(ROOT, file)))
    ).toEqual([]);
  });

  test('names each file once, by path', () => {
    expect(new Set(named).size).toBe(named.length);
    expect(scripts['test:proxy']).toContain('--runTestsByPath');
  });

  test('runs jest with the command and the flags of test:only', () => {
    expect(scripts['test:only']).toContain('--experimental-vm-modules');
    expect(scripts['test:proxy'].startsWith(`${scripts['test:only']} `)).toBe(
      true
    );
  });
});
