/**
 * Hermetic tests of what the error of a request says when the proxy it went
 * through refuses the tunnel, refuses the credentials or cannot be reached.
 *
 * Run with:
 *
 *        npm run test:only -- src/api/BaseApi.proxyFailure.test.ts
 *
 * Origin: frodo-lib#986. A refused tunnel gave a network error with a status
 * and nothing that named the proxy, and a proxy address nobody listens on gave
 * `connect ECONNREFUSED <address>`, which reads as if the tenant were down. The
 * error of the request now carries `proxyFailure` (which proxy, what it did,
 * whether the target was HTTP or HTTPS) and a stable code, which the
 * `FrodoError` that wraps it carries too. See src/utils/ProxyFailureUtils.ts.
 *
 * Like BaseApi.proxy.test.ts, these tests start the proxy and the targets in
 * the test process, on the loopback interface, and drive the real request path
 * (`generateAmApi()` of BaseApi.ts with an anonymous request, the kind the
 * library makes before it logs in). The fake proxies here do what a proxy does
 * when it fails: answer CONNECT with a status, close the connection, never
 * answer. Nothing leaves the machine, and no squid is needed.
 *
 * Half of the tests prove the opposite: that a failure which is not the
 * proxy's, behind a working proxy or with no proxy at all, is never called one.
 * They pass on a library that names nothing, and fail on one that names too
 * much.
 *
 * Every test sets the proxy variables it needs and nothing else: `beforeEach`
 * clears all of them (the jest setup file test/jest-no-ambient-proxy.setup.js
 * has already hidden the ones of the machine) and `afterEach` restores them.
 *
 * Part of the proxy set, see decisions/0017-proxy-support-is-guarded-by-a-short-named-set-of-tests.md.
 */
import http from 'http';
import https from 'https';
import net, { AddressInfo } from 'net';
import 'reflect-metadata';
import AuthenticateOps from '../ops/AuthenticateOps';
import { FrodoError } from '../ops/FrodoError';
import StateImpl from '../shared/State';
import { createLoopbackCertificate } from '../test/utils/LoopbackCertificate';
import { generateAmApi } from './BaseApi';

/** Every variable these tests touch, see BaseApi.proxy.test.ts. */
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
];

/** Credentials made up for the tests; they must never be shown. */
const PROXY_USER = 'alice';
const PROXY_PASSWORD = 'made-up-pass';
const PROXY_QUERY_VALUE = 'made-up-token';

// ---------------------------------------------------------------------------
// The servers: targets and proxies, all on the loopback interface
// ---------------------------------------------------------------------------

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
function closer(server: net.Server, sockets: Set<net.Socket>) {
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

type Target = {
  port: number;
  /** `127.0.0.1:<port>`, what a CONNECT for this target names. */
  hostPort: string;
  /** The `host` of a state that points at this target. */
  host: string;
  requests: string[];
};

/** A target that answers every request with `answer`, or with what `onRequest` does. */
async function startTarget(
  scheme: 'http' | 'https',
  options: {
    tls?: { key: string; cert: string };
    status?: number;
    onRequest?: (
      req: http.IncomingMessage,
      res: http.ServerResponse,
      count: number
    ) => void;
  } = {}
): Promise<Target> {
  const target = { requests: [] as string[] } as Target;
  const handler: http.RequestListener = (req, res) => {
    target.requests.push(req.url ?? '');
    if (options.onRequest) {
      options.onRequest(req, res, target.requests.length);
      return;
    }
    res.writeHead(options.status ?? 200, {
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({ cookieName: 'frodoProxyFailureTest' }));
  };
  const server: http.Server | https.Server =
    scheme === 'https'
      ? https.createServer(
          { key: options.tls?.key, cert: options.tls?.cert },
          handler
        )
      : http.createServer(handler);
  const sockets = new Set<net.Socket>();
  server.on('connection', (socket: net.Socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  target.port = await listen(server);
  target.hostPort = `127.0.0.1:${target.port}`;
  target.host = `${scheme}://${target.hostPort}/am`;
  cleanups.push(closer(server, sockets));
  return target;
}

type Proxy = {
  port: number;
  /** What to put into a proxy variable: `http://127.0.0.1:<port>`. */
  url: string;
  /** The target of every CONNECT received. */
  connects: string[];
  /** The request target of every plain request received. */
  forwards: string[];
};

/** What a proxy does with a CONNECT request, or with a plain one. */
type CONNECT = (
  req: http.IncomingMessage,
  socket: net.Socket,
  proxy: Proxy
) => void;

/** Answers CONNECT with a status, closes the connection and says no more. */
const refuseWith =
  (status: number, headers: Record<string, string> = {}): CONNECT =>
  (_req, socket) => {
    const head = Object.entries(headers)
      .map(([name, value]) => `${name}: ${value}\r\n`)
      .join('');
    socket.end(
      `HTTP/1.1 ${status} ${http.STATUS_CODES[status]}\r\n${head}Content-Length: 0\r\nConnection: close\r\n\r\n`
    );
  };

/** Pipes the tunnel to the target it names, as a working proxy does. */
const tunnel: CONNECT = (req, socket) => {
  const [host, port] = (req.url ?? '').split(':');
  const upstream = net.connect(Number(port), host, () => {
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  socket.on('close', () => upstream.destroy());
};

/** Answers CONNECT with 200, so that the tunnel is up, and then does `then`. */
const tunnelThen =
  (then: (socket: net.Socket) => void): CONNECT =>
  (_req, socket) => {
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    then(socket);
  };

async function startProxy(
  options: {
    connect?: CONNECT;
    request?: http.RequestListener;
  } = {}
): Promise<Proxy> {
  const proxy = { connects: [], forwards: [] } as unknown as Proxy;
  const sockets = new Set<net.Socket>();
  const server = http.createServer((req, res) => {
    proxy.forwards.push(req.url ?? '');
    if (options.request) options.request(req, res);
    else res.writeHead(400).end();
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('connect', (req, socket) => {
    proxy.connects.push(req.url ?? '');
    (options.connect ?? tunnel)(req, socket as net.Socket, proxy);
  });
  proxy.port = await listen(server);
  proxy.url = `http://127.0.0.1:${proxy.port}`;
  cleanups.push(closer(server, sockets));
  return proxy;
}

// ---------------------------------------------------------------------------
// Driving the library
// ---------------------------------------------------------------------------

function stateFor(host: string, allowInsecureConnection = true) {
  const state = StateImpl({});
  state.setAllowInsecureConnection(allowInsecureConnection);
  state.setHost(host);
  return state;
}

/** The request instance of the library for an anonymous request to `host`. */
function requestTo(
  host: string,
  options: { timeout?: number; allowInsecureConnection?: boolean } = {}
) {
  return generateAmApi({
    resource: {},
    requiredScopes: [],
    anonymous: true,
    requestOverride: options.timeout ? { timeout: options.timeout } : {},
    state: stateFor(host, options.allowInsecureConnection ?? true),
  });
}

/** One unauthenticated request, the one the library makes before it logs in. */
function ask(
  host: string,
  options: { timeout?: number; allowInsecureConnection?: boolean } = {}
) {
  return requestTo(host, options).get(`${host}/json/serverinfo/*`);
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

/** The error as an ops function raises it, and a caller reads it. */
const wrap = (error: any) => new FrodoError('Error getting server info', error);

/** The failure of the proxy that the error reports, for `toMatchObject`. */
const proxyAt = (port: number) => ({
  protocol: 'http',
  host: '127.0.0.1',
  port,
});

/** An error that is not a proxy failure: it says nothing about a proxy, and nothing wraps one into a code. */
function expectNoProxyFailure(error: any) {
  expect(error.proxyFailure).toBeUndefined();
  const wrapped = wrap(error);
  expect(wrapped.code).toBeUndefined();
  expect(wrapped.getCombinedMessage()).not.toMatch(/\bproxy\b/i);
}

// ---------------------------------------------------------------------------
// The tests
// ---------------------------------------------------------------------------

const savedEnv = new Map<string, string | undefined>();
let tls: { key: string; cert: string };

beforeAll(async () => {
  tls = await createLoopbackCertificate();
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

describe('an HTTPS target and a proxy that refuses the tunnel', () => {
  test('407 with a challenge: the error names the proxy, the status and the challenge, with its code', async () => {
    const target = await startTarget('https', { tls });
    const proxy = await startProxy({
      connect: refuseWith(407, {
        'Proxy-Authenticate': 'Basic realm="proxy-test"',
      }),
    });
    process.env.HTTPS_PROXY = proxy.url;

    const error = await failureOf(ask(target.host));

    expect(error.proxyFailure).toEqual({
      code: 'PROXY_AUTHENTICATION_REQUIRED',
      proxy: proxyAt(proxy.port),
      target: 'https',
      status: 407,
      authenticate: 'Basic realm="proxy-test"',
      message: `The proxy 127.0.0.1:${proxy.port} refused the CONNECT request for an HTTPS target with status 407 (Proxy Authentication Required). Proxy-Authenticate: Basic realm="proxy-test"`,
    });
    // what the error said before is still there
    expect(error.isAxiosError).toBe(true);
    expect(error.response.status).toBe(407);
    expect(error.response.headers['proxy-authenticate']).toBe(
      'Basic realm="proxy-test"'
    );
    // the wrapper of an ops function carries the code and prints the facts
    const wrapped = wrap(error);
    expect(wrapped.code).toBe('PROXY_AUTHENTICATION_REQUIRED');
    expect(wrapped.getCombinedMessage()).toContain('Status: 407');
    expect(wrapped.getCombinedMessage()).toContain(error.proxyFailure.message);
    expect(target.requests).toEqual([]);
  });

  test('407 without a challenge: the same code, and no challenge is made up', async () => {
    const target = await startTarget('https', { tls });
    const proxy = await startProxy({ connect: refuseWith(407) });
    process.env.HTTPS_PROXY = proxy.url;

    const error = await failureOf(ask(target.host));

    expect(error.proxyFailure.code).toBe('PROXY_AUTHENTICATION_REQUIRED');
    expect(error.proxyFailure.status).toBe(407);
    expect(error.proxyFailure).not.toHaveProperty('authenticate');
    expect(error.proxyFailure.message).not.toContain('Proxy-Authenticate');
    expect(error.response.headers['proxy-authenticate']).toBeUndefined();
  });

  test.each([
    [400, 'Bad Request'],
    [403, 'Forbidden'],
    [502, 'Bad Gateway'],
    [503, 'Service Unavailable'],
    [504, 'Gateway Timeout'],
  ])(
    'a proxy that answers CONNECT with %i: the tunnel was refused, with that status',
    async (status, text) => {
      const target = await startTarget('https', { tls });
      const proxy = await startProxy({ connect: refuseWith(status) });
      process.env.HTTPS_PROXY = proxy.url;

      const error = await failureOf(ask(target.host));

      expect(error.proxyFailure).toEqual({
        code: 'PROXY_TUNNEL_REFUSED',
        proxy: proxyAt(proxy.port),
        target: 'https',
        status,
        message: `The proxy 127.0.0.1:${proxy.port} refused the CONNECT request for an HTTPS target with status ${status} (${text}).`,
      });
      expect(error.response.status).toBe(status);
      expect(wrap(error).code).toBe('PROXY_TUNNEL_REFUSED');
    }
  );
});

describe('an HTTPS target and a proxy that closes the connection during CONNECT', () => {
  test.each([
    ['ends the connection', (s: net.Socket) => s.end(), undefined],
    ['destroys the connection', (s: net.Socket) => s.destroy(), undefined],
    [
      'resets the connection',
      (s: net.Socket) => s.resetAndDestroy(),
      'ECONNRESET',
    ],
  ])(
    'a proxy that %s: the proxy closed the connection before it answered',
    async (_name, close, cause) => {
      const target = await startTarget('https', { tls });
      const proxy = await startProxy({
        connect: (_req, socket) => close(socket),
      });
      process.env.HTTPS_PROXY = proxy.url;

      const started = Date.now();
      const error = await failureOf(ask(target.host));

      expect(Date.now() - started).toBeLessThan(5000);
      expect(error.proxyFailure).toMatchObject({
        code: 'PROXY_CONNECTION_CLOSED',
        proxy: proxyAt(proxy.port),
        target: 'https',
        ...(cause && { cause }),
      });
      expect(error.proxyFailure).not.toHaveProperty('status');
      expect(error.proxyFailure.message).toContain(
        `The proxy 127.0.0.1:${proxy.port} closed the connection before it answered the CONNECT request for an HTTPS target`
      );
      expect(wrap(error).code).toBe('PROXY_CONNECTION_CLOSED');
      expect(target.requests).toEqual([]);
    },
    15000
  );
});

describe('a proxy that cannot be reached', () => {
  test('an HTTPS target and a proxy address nobody listens on: the proxy refused the connection, not the target', async () => {
    const target = await startTarget('https', { tls });
    const dead = await closedPort();
    process.env.HTTPS_PROXY = `http://127.0.0.1:${dead}`;

    const error = await failureOf(ask(target.host));

    expect(error.code).toBe('ECONNREFUSED');
    expect(error.proxyFailure).toEqual({
      code: 'PROXY_CONNECTION_REFUSED',
      proxy: proxyAt(dead),
      target: 'https',
      cause: 'ECONNREFUSED',
      message: `The proxy 127.0.0.1:${dead} refused the connection (ECONNREFUSED); the request was for an HTTPS target.`,
    });
    // the proxy is named, the target (which is up) is not
    expect(error.proxyFailure.message).not.toContain(`${target.port}`);
    expect(wrap(error).code).toBe('PROXY_CONNECTION_REFUSED');
    expect(target.requests).toEqual([]);
  }, 15000);

  test('an HTTP target and a proxy address nobody listens on', async () => {
    const target = await startTarget('http');
    const dead = await closedPort();
    process.env.HTTP_PROXY = `http://127.0.0.1:${dead}`;

    const error = await failureOf(ask(target.host));

    expect(error.proxyFailure).toMatchObject({
      code: 'PROXY_CONNECTION_REFUSED',
      proxy: proxyAt(dead),
      target: 'http',
      cause: 'ECONNREFUSED',
    });
    expect(error.proxyFailure.message).toContain('for an HTTP target');
    expect(target.requests).toEqual([]);
  }, 15000);

  test('a proxy whose name does not resolve: the proxy could not be reached, and the name lookup is still diagnosed', async () => {
    const target = await startTarget('https', { tls });
    // the .invalid top-level domain never resolves
    process.env.HTTPS_PROXY = 'http://frodo-proxy.invalid:3128';

    const error = await failureOf(ask(target.host));

    expect(error.proxyFailure).toMatchObject({
      code: 'PROXY_UNREACHABLE',
      proxy: { protocol: 'http', host: 'frodo-proxy.invalid', port: 3128 },
      target: 'https',
      cause: 'ENOTFOUND',
    });
    expect(error.nameResolutionDiagnosis?.message).toContain(
      'frodo-proxy.invalid'
    );
    expect(wrap(error).code).toBe('PROXY_UNREACHABLE');
    expect(target.requests).toEqual([]);
  }, 30000);
});

describe('an HTTP target through a proxy', () => {
  test('407 to the request itself: the proxy refused the request', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({
      request: (_req, res) => {
        res.writeHead(407, {
          'Proxy-Authenticate': 'Basic realm="proxy-test"',
        });
        res.end();
      },
    });
    process.env.HTTP_PROXY = proxy.url;

    const error = await failureOf(ask(target.host));

    expect(error.proxyFailure).toEqual({
      code: 'PROXY_AUTHENTICATION_REQUIRED',
      proxy: proxyAt(proxy.port),
      target: 'http',
      status: 407,
      authenticate: 'Basic realm="proxy-test"',
      message: `The proxy 127.0.0.1:${proxy.port} refused the request for an HTTP target with status 407 (Proxy Authentication Required). Proxy-Authenticate: Basic realm="proxy-test"`,
    });
    expect(error.response.status).toBe(407);
    expect(wrap(error).code).toBe('PROXY_AUTHENTICATION_REQUIRED');
    expect(proxy.connects).toEqual([]);
    expect(target.requests).toEqual([]);
  });

  test('a proxy that hangs up on the request: the proxy closed the connection', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({
      request: (req) => req.socket.destroy(),
    });
    process.env.HTTP_PROXY = proxy.url;

    const error = await failureOf(ask(target.host));

    expect(error.proxyFailure).toMatchObject({
      code: 'PROXY_CONNECTION_CLOSED',
      proxy: proxyAt(proxy.port),
      target: 'http',
      cause: 'ECONNRESET',
    });
    expect(wrap(error).code).toBe('PROXY_CONNECTION_CLOSED');
    expect(target.requests).toEqual([]);
  });

  test.each([403, 502, 504])(
    'a %i from the proxy is not called the proxy’s: through a forward proxy it could be the target’s answer',
    async (status) => {
      const target = await startTarget('http');
      const proxy = await startProxy({
        request: (_req, res) => res.writeHead(status).end(),
      });
      process.env.HTTP_PROXY = proxy.url;

      const error = await failureOf(ask(target.host));

      expect(error.response.status).toBe(status);
      expectNoProxyFailure(error);
      expect(proxy.forwards).toHaveLength(1);
    }
  );

  test('a proxy that never answers: the timeout of the request is not called the proxy’s, the target behind it may be the slow one', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({ request: () => undefined });
    process.env.HTTP_PROXY = proxy.url;

    const error = await failureOf(ask(target.host, { timeout: 300 }));

    expect(error.code).toBe('ECONNABORTED');
    expectNoProxyFailure(error);
    expect(proxy.forwards).toHaveLength(1);
  });
});

describe('an HTTPS target and a proxy that accepts the connection and never answers CONNECT', () => {
  // Measured while writing these tests: the request is still pending long
  // after its timeout (30 seconds by default). The timeout of an axios request
  // starts when the request has a socket, and a request that waits for its
  // tunnel has none, so the library waits for as long as the proxy does. There
  // is no timeout error to name the proxy in, and a timeout is not added here.
  test.todo(
    'the request times out, and the error is the proxy’s because no CONNECT answer has come'
  );
});

describe('a failure that is not the proxy’s is not called one', () => {
  test('the target is on NO_PROXY: its refused connection is the target’s, and the proxy that would have failed is never contacted', async () => {
    const dead = await closedPort();
    const closedTarget = await closedPort();
    process.env.HTTPS_PROXY = `http://127.0.0.1:${dead}`;
    process.env.NO_PROXY = '127.0.0.1';

    const error = await failureOf(ask(`https://127.0.0.1:${closedTarget}/am`));

    expect(error.code).toBe('ECONNREFUSED');
    expect(error.message).toContain(`${closedTarget}`);
    expect(error.message).not.toContain(`${dead}`);
    expectNoProxyFailure(error);
  }, 15000);

  test('the target is on NO_PROXY: its own 407 is the target’s', async () => {
    const target = await startTarget('https', { tls, status: 407 });
    const proxy = await startProxy();
    process.env.HTTPS_PROXY = proxy.url;
    process.env.NO_PROXY = '127.0.0.1';

    const error = await failureOf(ask(target.host));

    expect(error.response.status).toBe(407);
    expectNoProxyFailure(error);
    expect(proxy.connects).toEqual([]);
    expect(target.requests).toHaveLength(1);
  });

  test.each([
    ['HTTPS', 'https'],
    ['HTTP', 'http'],
  ] as const)(
    'no proxy is configured: a 407 from an %s tenant is the tenant’s',
    async (_name, scheme) => {
      const target = await startTarget(scheme, { tls, status: 407 });

      const error = await failureOf(ask(target.host));

      expect(error.response.status).toBe(407);
      expectNoProxyFailure(error);
    }
  );

  test('no proxy is configured: a refused connection is the target’s', async () => {
    const closedTarget = await closedPort();

    const error = await failureOf(ask(`https://127.0.0.1:${closedTarget}/am`));

    expect(error.code).toBe('ECONNREFUSED');
    expectNoProxyFailure(error);
  });

  test('the request does not use the proxy agent: a proxy variable that points at a dead proxy changes nothing', async () => {
    const dead = await closedPort();
    process.env.HTTPS_PROXY = `http://127.0.0.1:${dead}`;
    const closedTarget = await closedPort();
    const refusing = await startTarget('https', { tls, status: 407 });

    const toClosed = requestTo(`https://127.0.0.1:${closedTarget}/am`);
    toClosed.defaults.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });
    const refused = await failureOf(
      toClosed.get(`https://127.0.0.1:${closedTarget}/am/json/serverinfo/*`)
    );
    expect(refused.code).toBe('ECONNREFUSED');
    expectNoProxyFailure(refused);

    const toRefusing = requestTo(refusing.host);
    toRefusing.defaults.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });
    const answered = await failureOf(
      toRefusing.get(`${refusing.host}/json/serverinfo/*`)
    );
    expect(answered.response.status).toBe(407);
    expectNoProxyFailure(answered);
  }, 15000);

  describe('the proxy answered 200 to CONNECT, and the target failed behind it', () => {
    test('the tunnel is closed at once: the connection to the target ended, not the proxy’s', async () => {
      const target = await startTarget('https', { tls });
      const proxy = await startProxy({
        connect: tunnelThen((socket) => setTimeout(() => socket.end(), 20)),
      });
      process.env.HTTPS_PROXY = proxy.url;

      const error = await failureOf(ask(target.host));

      expect(error.code).toBe('ECONNRESET');
      expectNoProxyFailure(error);
      expect(proxy.connects).toEqual([target.hostPort]);
    });

    test('the tunnel is reset after the answer: the same', async () => {
      const target = await startTarget('https', { tls });
      const proxy = await startProxy({
        connect: tunnelThen((socket) =>
          setTimeout(() => socket.resetAndDestroy(), 20)
        ),
      });
      process.env.HTTPS_PROXY = proxy.url;

      const error = await failureOf(ask(target.host));

      expectNoProxyFailure(error);
      expect(proxy.connects).toEqual([target.hostPort]);
    });

    test('the target never answers the TLS handshake: its timeout is the target’s', async () => {
      const target = await startTarget('https', { tls });
      const proxy = await startProxy({ connect: tunnelThen(() => undefined) });
      process.env.HTTPS_PROXY = proxy.url;

      const error = await failureOf(ask(target.host, { timeout: 300 }));

      expect(error.code).toBe('ECONNABORTED');
      expectNoProxyFailure(error);
      expect(proxy.connects).toEqual([target.hostPort]);
    });

    test('the certificate of the target is refused: that is the library and the target', async () => {
      const target = await startTarget('https', { tls });
      const proxy = await startProxy();
      process.env.HTTPS_PROXY = proxy.url;

      const error = await failureOf(
        ask(target.host, { allowInsecureConnection: false })
      );

      expect(error.code).toMatch(/CERT|SIGNATURE|PURPOSE/);
      expectNoProxyFailure(error);
      expect(proxy.connects).toEqual([target.hostPort]);
    });

    test.each([407, 403, 502])(
      'the target answers %i itself: through a tunnel that is the target’s answer',
      async (status) => {
        const target = await startTarget('https', { tls, status });
        const proxy = await startProxy();
        process.env.HTTPS_PROXY = proxy.url;

        const error = await failureOf(ask(target.host));

        expect(error.response.status).toBe(status);
        expectNoProxyFailure(error);
        expect(proxy.connects).toEqual([target.hostPort]);
        expect(target.requests).toHaveLength(1);
      }
    );

    test('a request that reuses the tunnel of an earlier one and is reset: the tunnel is the target’s now', async () => {
      const target = await startTarget('https', {
        tls,
        onRequest: (req, res, count) => {
          if (count === 2) {
            req.socket.destroy();
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{}');
        },
      });
      const proxy = await startProxy();
      process.env.HTTPS_PROXY = proxy.url;

      await ask(target.host);
      const error = await failureOf(ask(target.host));

      expect(error.code).toBe('ECONNRESET');
      expectNoProxyFailure(error);
      // the second request went into the first one's tunnel
      expect(proxy.connects).toEqual([target.hostPort]);
      expect(target.requests).toHaveLength(2);
    });
  });

  test('two requests at once decide for themselves: one is sent through a dead proxy, the other is on NO_PROXY', async () => {
    const dead = await closedPort();
    const throughProxy = await closedPort();
    const direct = await closedPort();
    process.env.HTTPS_PROXY = `http://127.0.0.1:${dead}`;
    process.env.NO_PROXY = `127.0.0.1:${direct}`;

    const [proxied, notProxied] = await Promise.all([
      failureOf(ask(`https://127.0.0.1:${throughProxy}/am`)),
      failureOf(ask(`https://127.0.0.1:${direct}/am`)),
    ]);

    expect(proxied.proxyFailure).toMatchObject({
      code: 'PROXY_CONNECTION_REFUSED',
      proxy: proxyAt(dead),
    });
    expect(notProxied.code).toBe('ECONNREFUSED');
    expect(notProxied.message).toContain(`${direct}`);
    expectNoProxyFailure(notProxied);
  }, 15000);
});

describe('the decision that a proxy was used is the one the agent made for the request', () => {
  test('the proxy variable is gone when the request fails: the request still went through the proxy', async () => {
    const target = await startTarget('https', { tls });
    const proxy = await startProxy({
      connect: (_req, socket) => {
        // a re-reading of the environment finds no proxy from here on
        delete process.env.HTTPS_PROXY;
        refuseWith(407)(_req, socket, proxy);
      },
    });
    process.env.HTTPS_PROXY = proxy.url;

    const error = await failureOf(ask(target.host));

    expect(error.proxyFailure.code).toBe('PROXY_AUTHENTICATION_REQUIRED');
    expect(error.proxyFailure.proxy).toEqual(proxyAt(proxy.port));
  });

  test('a proxy variable appears while a direct request is on its way: the request still did not go through it', async () => {
    const dead = await closedPort();
    const target = await startTarget('https', {
      tls,
      onRequest: (_req, res) => {
        // a re-reading of the environment finds a proxy from here on
        delete process.env.NO_PROXY;
        process.env.HTTPS_PROXY = `http://127.0.0.1:${dead}`;
        res.writeHead(407).end();
      },
    });
    process.env.NO_PROXY = '127.0.0.1';

    const error = await failureOf(ask(target.host));

    expect(error.response.status).toBe(407);
    expectNoProxyFailure(error);
  });
});

describe('the credentials of the proxy URL are never shown', () => {
  /** The proxy URL as a person writes it: credentials, and a path and a query that carry a secret. */
  const withCredentials = (
    port: number,
    user = PROXY_USER,
    pass = PROXY_PASSWORD
  ) =>
    `http://${user}:${pass}@127.0.0.1:${port}/path?token=${PROXY_QUERY_VALUE}`;

  /**
   * Everything that serialises the error, as a log or a caller would: its
   * JSON, its text, its stack, what a wrapper prints, and the facts this
   * module adds. That the shared agents on `error.config` and the output of
   * `util.inspect` hold no credentials either is tested in
   * BaseApi.proxyErrors.serialization.test.ts.
   */
  function serialisations(error: any): string[] {
    const wrapped = wrap(error);
    return [
      JSON.stringify(error),
      JSON.stringify(wrapped),
      String(error),
      String(wrapped),
      error.message,
      error.stack ?? '',
      wrapped.stack ?? '',
      wrapped.getCombinedMessage(),
      JSON.stringify(error.proxyFailure),
      String(error.proxyFailure.code),
      String(wrapped.code),
    ];
  }

  function expectNoSecret(error: any, secrets: string[]) {
    expect(error.proxyFailure).toBeDefined();
    expect(Object.keys(error.proxyFailure.proxy).sort()).toEqual([
      'host',
      'port',
      'protocol',
    ]);
    for (const text of serialisations(error)) {
      for (const secret of secrets) expect(text).not.toContain(secret);
    }
  }

  const SECRETS = [
    PROXY_PASSWORD,
    PROXY_USER,
    PROXY_QUERY_VALUE,
    `${PROXY_USER}:`,
    Buffer.from(`${PROXY_USER}:${PROXY_PASSWORD}`).toString('base64'),
  ];

  test.each([
    ['a refused tunnel', refuseWith(403)],
    [
      'a 407',
      refuseWith(407, { 'Proxy-Authenticate': 'Basic realm="proxy-test"' }),
    ],
    [
      'a closed connection',
      (_req: unknown, socket: net.Socket) => socket.end(),
    ],
  ])('HTTPS target, %s', async (_name, connect) => {
    const target = await startTarget('https', { tls });
    const proxy = await startProxy({ connect: connect as CONNECT });
    process.env.HTTPS_PROXY = withCredentials(proxy.port);

    const error = await failureOf(ask(target.host));

    expectNoSecret(error, SECRETS);
    expect(error.proxyFailure.proxy.port).toBe(proxy.port);
  });

  test('HTTPS target, a proxy nobody listens on', async () => {
    const target = await startTarget('https', { tls });
    const dead = await closedPort();
    process.env.HTTPS_PROXY = withCredentials(dead);

    const error = await failureOf(ask(target.host));

    expectNoSecret(error, SECRETS);
    expect(error.proxyFailure.code).toBe('PROXY_CONNECTION_REFUSED');
  }, 15000);

  test('HTTPS target, a proxy whose name does not resolve', async () => {
    const target = await startTarget('https', { tls });
    process.env.HTTPS_PROXY = `http://${PROXY_USER}:${PROXY_PASSWORD}@frodo-proxy.invalid:3128/path?token=${PROXY_QUERY_VALUE}`;

    const error = await failureOf(ask(target.host));

    expectNoSecret(error, SECRETS);
    expect(error.proxyFailure.code).toBe('PROXY_UNREACHABLE');
  }, 30000);

  test('HTTP target, a closed connection', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({ request: (req) => req.socket.destroy() });
    process.env.HTTP_PROXY = withCredentials(proxy.port);

    const error = await failureOf(ask(target.host));

    expectNoSecret(error, SECRETS);
    expect(error.proxyFailure.code).toBe('PROXY_CONNECTION_CLOSED');
  });

  test('HTTP target, a 407', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({
      request: (_req, res) => res.writeHead(407).end(),
    });
    process.env.HTTP_PROXY = withCredentials(proxy.port);

    const error = await failureOf(ask(target.host));

    expectNoSecret(error, SECRETS);
    expect(error.proxyFailure.code).toBe('PROXY_AUTHENTICATION_REQUIRED');
  });

  test('credentials that are percent-encoded in the URL are not shown, encoded or decoded', async () => {
    const target = await startTarget('https', { tls });
    const proxy = await startProxy({ connect: refuseWith(407) });
    process.env.HTTPS_PROXY = `http://al%40ice:p%40ss%3Aw0rd@127.0.0.1:${proxy.port}`;

    const error = await failureOf(ask(target.host));

    expectNoSecret(error, ['al%40ice', 'al@ice', 'p%40ss', 'p@ss', 'w0rd']);
    expect(error.proxyFailure.code).toBe('PROXY_AUTHENTICATION_REQUIRED');
  });
});

describe('the code reaches the caller of a login', () => {
  test('getTokens through a proxy that answers 407 throws a FrodoError with the code', async () => {
    const proxy = await startProxy({ connect: refuseWith(407) });
    process.env.HTTPS_PROXY = proxy.url;
    const state = StateImpl({
      host: 'https://tenant.example/am',
      useTokenCache: false,
      allowInsecureConnection: true,
    });
    state.setUsername('admin');
    state.setPassword('made-up-pass');

    const error = await failureOf(AuthenticateOps(state).getTokens());

    expect(error).toBeInstanceOf(FrodoError);
    expect(error.code).toBe('PROXY_AUTHENTICATION_REQUIRED');
    expect(error.getCombinedMessage()).toContain(
      `The proxy 127.0.0.1:${proxy.port} refused the CONNECT request for an HTTPS target with status 407`
    );
    expect(proxy.connects).toEqual(['tenant.example:443']);
  });
});
