/**
 * Hermetic tests of what the error of a failed request holds when the request
 * went through a proxy that has credentials in its URL.
 *
 * Run with:
 *
 *        npm run test:only -- src/api/BaseApi.proxyErrors.serialization.test.ts
 *
 * The proxy URL of the environment (`http://user:made-up-pass@127.0.0.1:<port>`)
 * is the only place the library can receive the credentials of a proxy from, so
 * the agents that proxy-agent makes for the proxy keep it. The config of a
 * request (`error.config`) refers to the shared agents of BaseApi.ts, and axios
 * puts that config on the error of a failed request. The tests start the
 * proxies and the targets in the test process, on the loopback interface, drive
 * the real request path (`getServerInfo()`) and then look at the error in every
 * form it can be written in: `JSON.stringify`, `util.inspect` with every
 * property shown, `String`, and the same for a `FrodoError` that wraps it.
 *
 * The values are made up. A request that fails must keep failing the way it
 * did: the tests also check the status, the code and the message of the error,
 * and that a request through the same proxy still carries the credentials the
 * proxy asked for, also when it is sent again.
 */
import { createPrivateKey, createPublicKey, webcrypto } from 'crypto';
import http from 'http';
import https from 'https';
import net, { AddressInfo } from 'net';
import util from 'util';
import 'reflect-metadata';
import {
  BasicConstraintsExtension,
  GeneralName,
  KeyUsagesExtension,
  SubjectAlternativeNameExtension,
  X509CertificateGenerator,
} from '@peculiar/x509';
import { ProxyAgent } from 'proxy-agent';
import { FrodoError } from '../ops/FrodoError';
import StateImpl from '../shared/State';
import { getPrivateKey, getPublicKey } from '../test/utils/TestUtils';
import { getServerInfo } from './ServerInfoApi';

const USER = 'user';
const PASSWORD = 'made-up-pass';
const OTHER_PASSWORD = 'made-up-other-pass';
const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

/** What the targets answer with, so that a test can tell the answer reached it. */
const COOKIE_NAME = 'frodoProxyErrorsTestCookie';

/** Names that nothing resolves: a request that is refused by the proxy never needs them. */
const HTTP_TARGET = 'http://target.example.com/am';
const HTTPS_TARGET = 'https://target.example.com/am';

/** Every variable proxy-from-env reads, so that a test sets exactly what it needs. */
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

// ---------------------------------------------------------------------------
// Servers: a proxy, targets, and a port on which nothing listens
// ---------------------------------------------------------------------------

type Seen = {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
};

type Proxy = {
  url: (user?: string, password?: string) => string;
  port: number;
  connects: Seen[];
  forwards: Seen[];
};

type ProxyOptions = {
  /** Answer every CONNECT and forwarded request with 407. */
  answer407?: boolean;
  /** Answer the first n forwarded requests with 503, then serve. */
  failFirst?: number;
  /** Where the requests go. */
  target?: { host: string; port: number };
};

const cleanups: Array<() => Promise<void>> = [];

function listen(server: net.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve((server.address() as AddressInfo).port)
    );
  });
}

function closer(server: http.Server, sockets: Set<net.Socket>) {
  return () =>
    new Promise<void>((resolve) => {
      sockets.forEach((socket) => socket.destroy());
      server.close(() => resolve());
    });
}

async function closedPort(): Promise<number> {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function createSelfSignedCertificate(): Promise<{
  key: string;
  cert: string;
}> {
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

type Target = { port: number; host: string; requests: Seen[] };

async function startTarget(
  scheme: 'http' | 'https',
  tls?: { key: string; cert: string }
): Promise<Target> {
  const target = { requests: [] } as unknown as Target;
  const handler: http.RequestListener = (req, res) => {
    target.requests.push({
      method: req.method ?? '',
      url: req.url ?? '',
      headers: req.headers,
    });
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cookieName: COOKIE_NAME }));
    });
  };
  const server: http.Server | https.Server =
    scheme === 'https'
      ? https.createServer({ key: tls?.key, cert: tls?.cert }, handler)
      : http.createServer(handler);
  const sockets = new Set<net.Socket>();
  server.on('connection', (s: net.Socket) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  target.port = await listen(server);
  target.host = `${scheme}://127.0.0.1:${target.port}/am`;
  cleanups.push(closer(server, sockets));
  return target;
}

async function startProxy(options: ProxyOptions = {}): Promise<Proxy> {
  const proxy = { connects: [], forwards: [] } as unknown as Proxy;
  const sockets = new Set<net.Socket>();
  const server = http.createServer();
  let failures = options.failFirst ?? 0;
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  server.on('connect', (req, clientSocket, head) => {
    proxy.connects.push({
      method: req.method ?? '',
      url: req.url ?? '',
      headers: req.headers,
    });
    if (options.answer407) {
      clientSocket.end(
        'HTTP/1.1 407 Proxy Authentication Required\r\n' +
          'Proxy-Authenticate: Basic realm="test"\r\n' +
          'Content-Length: 0\r\nConnection: close\r\n\r\n'
      );
      return;
    }
    const upstream = net.connect(
      options.target?.port ?? 443,
      options.target?.host ?? '127.0.0.1',
      () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
      }
    );
    sockets.add(upstream);
    upstream.on('close', () => sockets.delete(upstream));
    upstream.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => upstream.destroy());
    clientSocket.on('close', () => upstream.destroy());
  });

  server.on('request', (req, res) => {
    proxy.forwards.push({
      method: req.method ?? '',
      url: req.url ?? '',
      headers: req.headers,
    });
    if (options.answer407) {
      res.writeHead(407, {
        'Proxy-Authenticate': 'Basic realm="test"',
        'Content-Length': '0',
      });
      res.end();
      return;
    }
    if (failures > 0) {
      failures--;
      res.writeHead(503, { 'Content-Length': '0' });
      res.end();
      return;
    }
    const headers = { ...req.headers };
    delete headers['proxy-authorization'];
    delete headers['proxy-connection'];
    const upstream = http.request(
      {
        host: options.target?.host ?? '127.0.0.1',
        port: options.target?.port ?? 80,
        path: new URL(req.url as string).pathname,
        method: req.method,
        headers,
        agent: false,
      },
      (answer) => {
        const answerHeaders = { ...answer.headers };
        delete answerHeaders.connection;
        delete answerHeaders['keep-alive'];
        res.writeHead(answer.statusCode ?? 502, answerHeaders);
        answer.pipe(res);
      }
    );
    upstream.on('error', () => res.writeHead(502).end());
    req.pipe(upstream);
  });

  proxy.port = await listen(server);
  proxy.url = (user = USER, password = PASSWORD) =>
    `http://${user}:${password}@127.0.0.1:${proxy.port}`;
  cleanups.push(closer(server, sockets));
  return proxy;
}

// ---------------------------------------------------------------------------
// Driving the library and reading the error
// ---------------------------------------------------------------------------

function stateFor(host: string) {
  const state = StateImpl({});
  state.setAllowInsecureConnection(true);
  state.setHost(host);
  return state;
}

/** One unauthenticated request, the one the library makes before it logs in. */
async function ask(host: string) {
  return getServerInfo({ state: stateFor(host) });
}

async function failureOf(call: Promise<unknown>): Promise<any> {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error('the call was expected to fail, and it succeeded');
}

/**
 * Every form an error can be written in, for the error and for a FrodoError
 * that wraps it.
 */
function formsOf(error: any): Record<string, string> {
  const wrapper = new FrodoError('Reading the server info failed', error);
  const inspectAll = (value: unknown) =>
    util.inspect(value, { depth: null, showHidden: true });
  return {
    'JSON.stringify(error)': JSON.stringify(error),
    'util.inspect(error)': inspectAll(error),
    'String(error)': String(error),
    'JSON.stringify(FrodoError)': JSON.stringify(wrapper),
    'util.inspect(FrodoError)': inspectAll(wrapper),
    'String(FrodoError)': String(wrapper),
    'FrodoError.getCombinedMessage()': wrapper.getCombinedMessage(),
  };
}

/**
 * Where the user info of a proxy URL still is, per form: a few characters
 * around each occurrence. Empty when there is none. The made-up password is
 * searched for as it is, as the `user:password` pair of a URL and, for the
 * HTTPS targets (whose CONNECT request is not part of the error), as the Basic
 * credentials of a Proxy-Authorization header.
 */
function userinfoIn(
  error: any,
  passwords: string[],
  encoded = false
): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const [form, text] of Object.entries(formsOf(error))) {
    const needles = passwords.flatMap((password) => [
      password,
      `${USER}:${password}`,
      ...(encoded ? [basic(USER, password).slice('Basic '.length)] : []),
    ]);
    const snippets = new Set<string>();
    for (const needle of needles) {
      let at = text.indexOf(needle);
      while (at !== -1 && snippets.size < 3) {
        snippets.add(
          text
            .slice(Math.max(0, at - 30), at + needle.length + 10)
            .replace(/\s+/g, ' ')
        );
        at = text.indexOf(needle, at + needle.length);
      }
    }
    if (snippets.size) found[form] = [...snippets];
  }
  return found;
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

describe('the error of a request that failed through a proxy with user info in its URL', () => {
  test('an HTTP target, the proxy answers 407: the error is the 407 and does not contain the user info', async () => {
    const proxy = await startProxy({ answer407: true });
    process.env.HTTP_PROXY = proxy.url();

    const error = await failureOf(ask(HTTP_TARGET));

    // the request went through the proxy and got what the proxy answers
    expect(proxy.forwards.map((f) => f.url)).toEqual([
      `${HTTP_TARGET}/json/serverinfo/*`,
    ]);
    expect(proxy.forwards[0].headers['proxy-authorization']).toBe(
      basic(USER, PASSWORD)
    );
    expect(error.response.status).toBe(407);
    expect(error.code).toBe('ERR_BAD_REQUEST');
    expect(error.message).toBe('Request failed with status code 407');
    // and none of the forms of the error holds the URL of the proxy
    expect(userinfoIn(error, [PASSWORD])).toEqual({});
  });

  test('an HTTPS target, the proxy answers 407 to the CONNECT request: the error does not contain the user info', async () => {
    const proxy = await startProxy({ answer407: true });
    process.env.HTTPS_PROXY = proxy.url();

    const error = await failureOf(ask(HTTPS_TARGET));

    expect(proxy.connects.map((c) => c.url)).toEqual([
      'target.example.com:443',
    ]);
    expect(proxy.connects[0].headers['proxy-authorization']).toBe(
      basic(USER, PASSWORD)
    );
    expect(error.message).toMatch(/407/);
    expect(userinfoIn(error, [PASSWORD], true)).toEqual({});
  });

  test('an HTTP target, nothing listens at the proxy: the error is the refused connection and does not contain the user info', async () => {
    process.env.HTTP_PROXY = `http://${USER}:${PASSWORD}@127.0.0.1:${await closedPort()}`;

    const error = await failureOf(ask(HTTP_TARGET));

    expect(error.code).toBe('ECONNREFUSED');
    expect(error.response).toBeUndefined();
    expect(userinfoIn(error, [PASSWORD])).toEqual({});
  });

  test('an HTTPS target, nothing listens at the proxy: the error is the refused connection and does not contain the user info', async () => {
    process.env.HTTPS_PROXY = `http://${USER}:${PASSWORD}@127.0.0.1:${await closedPort()}`;

    const error = await failureOf(ask(HTTPS_TARGET));

    expect(error.code).toBe('ECONNREFUSED');
    expect(userinfoIn(error, [PASSWORD], true)).toEqual({});
  });

  test('the user info of the proxies of earlier requests is not in the error either', async () => {
    // the agents are shared by every request of the process, and they keep a
    // proxy for as long as they live
    const first = await startProxy({ answer407: true });
    process.env.HTTP_PROXY = first.url(USER, PASSWORD);
    await failureOf(ask(HTTP_TARGET));

    const second = await startProxy({ answer407: true });
    process.env.HTTP_PROXY = second.url(USER, OTHER_PASSWORD);
    const error = await failureOf(ask(HTTP_TARGET));

    expect(second.forwards).toHaveLength(1);
    expect(userinfoIn(error, [PASSWORD, OTHER_PASSWORD])).toEqual({});
  });

  test('the config of the error keeps the agents, as the requests that are sent again need them', async () => {
    const proxy = await startProxy({ answer407: true });
    process.env.HTTP_PROXY = proxy.url();
    process.env.HTTPS_PROXY = proxy.url();

    const error = await failureOf(ask(HTTP_TARGET));

    expect(error.config.httpAgent).toBeInstanceOf(ProxyAgent);
    expect(error.config.httpsAgent).toBeInstanceOf(ProxyAgent);
    // the agent is written as its name, the same for both forms
    expect(JSON.stringify(error.config.httpAgent)).toBe('"[ProxyAgent]"');
    expect(util.inspect(error.config.httpsAgent, { showHidden: true })).toBe(
      '[ProxyAgent]'
    );
  });
});

describe('a proxy URL that the agent cannot use', () => {
  test.each([
    ['an HTTP target', 'HTTP_PROXY', HTTP_TARGET],
    ['an HTTPS target', 'HTTPS_PROXY', HTTPS_TARGET],
  ])(
    'an unsupported scheme (%s): the message names the scheme, the host and the port, and nothing else',
    async (_name, variable, target) => {
      process.env[variable] =
        `foo://${USER}:${PASSWORD}@127.0.0.1:3128/path?q=1`;

      const error = await failureOf(ask(target));

      expect(userinfoIn(error, [PASSWORD])).toEqual({});
      expect(error.message).toBe(
        'Unsupported protocol for proxy URL: foo://127.0.0.1:3128'
      );
      expect(error.response).toBeUndefined();
      // the message of the error that wraps it carries the same words
      expect(
        new FrodoError('Reading the server info failed', error)
          .getCombinedMessage()
          .includes('Unsupported protocol for proxy URL: foo://127.0.0.1:3128')
      ).toBe(true);
    }
  );

  test('a URL that cannot be parsed: the error says so without the URL', async () => {
    process.env.HTTP_PROXY = `http://${USER}:${PASSWORD}@`;

    const error = await failureOf(ask(HTTP_TARGET));

    expect(userinfoIn(error, [PASSWORD])).toEqual({});
    expect(error.message).toBe('Invalid proxy URL');
  });
});

describe('a request through a proxy with user info in its URL still carries the credentials', () => {
  test('an HTTP target: the proxy receives the request line of the target and the Proxy-Authorization header', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({
      target: { host: '127.0.0.1', port: target.port },
    });
    process.env.HTTP_PROXY = proxy.url();

    const data = await ask(`http://target.example.com:${target.port}/am`);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expect(proxy.forwards).toHaveLength(1);
    expect(proxy.forwards[0].url).toBe(
      `http://target.example.com:${target.port}/am/json/serverinfo/*`
    );
    expect(proxy.forwards[0].headers['proxy-authorization']).toBe(
      basic(USER, PASSWORD)
    );
  });

  test('an HTTPS target: the CONNECT request carries the Proxy-Authorization header and the answer reaches the caller', async () => {
    const target = await startTarget('https', tls);
    const proxy = await startProxy({
      target: { host: '127.0.0.1', port: target.port },
    });
    process.env.HTTPS_PROXY = proxy.url();

    const data = await ask(target.host);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expect(proxy.connects).toHaveLength(1);
    expect(proxy.connects[0].headers['proxy-authorization']).toBe(
      basic(USER, PASSWORD)
    );
    expect(target.requests).toHaveLength(1);
  });

  test('a request that the retry configuration sends again goes through the proxy again, with the credentials', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({
      failFirst: 1,
      target: { host: '127.0.0.1', port: target.port },
    });
    process.env.HTTP_PROXY = proxy.url();
    const state = stateFor(`http://target.example.com:${target.port}/am`);
    state.setAxiosRetryConfig({
      retries: 1,
      retryDelay: () => 0,
      retryCondition: (error) => error.response?.status === 503,
    });

    const data = await getServerInfo({ state });

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expect(proxy.forwards).toHaveLength(2);
    expect(proxy.forwards.map((f) => f.headers['proxy-authorization'])).toEqual(
      [basic(USER, PASSWORD), basic(USER, PASSWORD)]
    );
    expect(target.requests).toHaveLength(1);
  });

  test('a host named in NO_PROXY is reached directly', async () => {
    const target = await startTarget('http');
    const proxy = await startProxy({ answer407: true });
    process.env.HTTP_PROXY = proxy.url();
    process.env.NO_PROXY = '127.0.0.1';

    const data = await ask(target.host);

    expect(data).toEqual({ cookieName: COOKIE_NAME });
    expect(proxy.forwards).toEqual([]);
    expect(target.requests).toHaveLength(1);
  });
});
