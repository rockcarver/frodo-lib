import http from 'http';
import https from 'https';
import net, { AddressInfo } from 'net';

import forge from 'node-forge';

import { generateAmApi } from './BaseApi';
import StateImpl from '../shared/State';
import { getPrivateKey, getPublicKey } from '../test/utils/TestUtils';

function createExpiredCertificate(): { key: string; cert: string } {
  const pki = forge.pki;
  const cert = pki.createCertificate();
  cert.publicKey = pki.publicKeyFromPem(getPublicKey());
  cert.serialNumber = '01';

  cert.validity.notBefore = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  cert.validity.notAfter = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const attrs = [{ name: 'commonName', value: '127.0.0.1' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    {
      name: 'subjectAltName',
      altNames: [{ type: 7, ip: '127.0.0.1' }],
    },
  ]);

  cert.sign(pki.privateKeyFromPem(getPrivateKey()));

  return {
    key: getPrivateKey(),
    cert: pki.certificateToPem(cert),
  };
}

/**
 * Minimal HTTP CONNECT proxy used by the proxy-tunnel suite below.
 * It accepts CONNECT tunnels and blindly pipes both directions so the
 * TLS handshake (and any certificate errors) happen end-to-end between
 * the axios client and the target server.
 */
function createConnectProxy(): http.Server {
  const proxy = http.createServer();
  proxy.on('connect', (req, clientSocket, head) => {
    const [hostname, portStr] = (req.url ?? '').split(':');
    const targetPort = parseInt(portStr, 10) || 443;
    const targetSocket = net.connect(targetPort, hostname, () => {
      clientSocket.write(
        'HTTP/1.1 200 Connection Established\r\nProxy-agent: frodo-test\r\n\r\n'
      );
      if (head.length) targetSocket.write(head);
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });
    targetSocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => targetSocket.destroy());
  });
  return proxy;
}

describe('BaseApi expired TLS certificate handling', () => {
  let server: https.Server;
  let baseURL: string;
  const priorNoProxy = process.env.NO_PROXY;

  beforeAll(async () => {
    const { key, cert } = createExpiredCertificate();
    server = https.createServer({ key, cert }, (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseURL = `https://127.0.0.1:${address.port}`;
    process.env.NO_PROXY = '127.0.0.1,localhost';
  });

  afterAll(async () => {
    if (priorNoProxy === undefined) delete process.env.NO_PROXY;
    else process.env.NO_PROXY = priorNoProxy;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test('fails when allowInsecureConnection is false and certificate is expired', async () => {
    expect.assertions(2);
    const state = StateImpl({});
    state.setAllowInsecureConnection(false);
    const request = generateAmApi({
      resource: {},
      requestOverride: { baseURL },
      state,
    });

    try {
      await request.get('/');
    } catch (error) {
      const code = (error as any).code ?? '';
      const message = (error as any).message ?? '';
      expect(code).toBeTruthy();
      expect(`${code} ${message}`).toMatch(
        /CERT_HAS_EXPIRED|certificate has expired/i
      );
    }
  });

  test('succeeds when allowInsecureConnection is true and certificate is expired', async () => {
    const state = StateImpl({});
    state.setAllowInsecureConnection(true);
    const request = generateAmApi({
      resource: {},
      requestOverride: { baseURL },
      state,
    });

    const response = await request.get('/');
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ status: 'ok' });
  });
});

/**
 * Proxy-tunnel suite
 *
 * Guards the `addRequest` monkey-patch applied by getHttpsAgent() in BaseApi.ts
 * when allowInsecureConnection=true.  When traffic is routed through an HTTP
 * CONNECT proxy, Node's http machinery calls agent.addRequest(req, opts) where
 * opts carries the TLS options (including rejectUnauthorized).  Without the
 * monkey-patch, opts retains the Node default (rejectUnauthorized: true) and
 * the TLS handshake with the TARGET through the tunnel fails.  The patch merges
 * rejectUnauthorized: false into opts so https-proxy-agent uses it when opening
 * the target TLS socket inside the tunnel.
 *
 * proxy-from-env (used by the cached ProxyAgent instances) reads HTTPS_PROXY
 * and NO_PROXY from process.env at request time, so even agents that were
 * pre-created in the suite above will honour the values set in beforeAll here.
 */
describe('BaseApi expired TLS certificate handling - via HTTPS proxy', () => {
  let targetServer: https.Server;
  let proxyServer: http.Server;
  let baseURL: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    const { key, cert } = createExpiredCertificate();
    targetServer = https.createServer({ key, cert }, (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
    await new Promise<void>((resolve) => {
      targetServer.listen(0, '127.0.0.1', () => resolve());
    });

    proxyServer = createConnectProxy();
    await new Promise<void>((resolve) => {
      proxyServer.listen(0, '127.0.0.1', () => resolve());
    });

    const targetAddr = targetServer.address() as AddressInfo;
    const proxyAddr = proxyServer.address() as AddressInfo;
    baseURL = `https://127.0.0.1:${targetAddr.port}`;

    // Save then overwrite proxy-related env vars.
    // proxy-from-env reads these dynamically per request, so even the
    // ProxyAgent instances cached by getHttpsAgent() will use them.
    for (const k of ['HTTPS_PROXY', 'https_proxy', 'NO_PROXY', 'no_proxy']) {
      savedEnv[k] = process.env[k];
    }
    process.env.HTTPS_PROXY = `http://127.0.0.1:${proxyAddr.port}`;
    delete process.env.https_proxy; // remove shadow that would take precedence
    delete process.env.NO_PROXY; // must not be set to bypass 127.0.0.1
    delete process.env.no_proxy;
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await Promise.all([
      new Promise<void>((resolve, reject) =>
        targetServer.close((err) => (err ? reject(err) : resolve()))
      ),
      new Promise<void>((resolve, reject) =>
        proxyServer.close((err) => (err ? reject(err) : resolve()))
      ),
    ]);
  });

  test('fails when allowInsecureConnection is false and certificate is expired (proxy tunnel)', async () => {
    expect.assertions(2);
    const state = StateImpl({});
    state.setAllowInsecureConnection(false);
    const request = generateAmApi({
      resource: {},
      requestOverride: { baseURL },
      state,
    });

    try {
      await request.get('/');
    } catch (error) {
      const code = (error as any).code ?? '';
      const message = (error as any).message ?? '';
      expect(code).toBeTruthy();
      expect(`${code} ${message}`).toMatch(
        /CERT_HAS_EXPIRED|certificate has expired/i
      );
    }
  });

  test('succeeds when allowInsecureConnection is true and certificate is expired (proxy tunnel)', async () => {
    const state = StateImpl({});
    state.setAllowInsecureConnection(true);
    const request = generateAmApi({
      resource: {},
      requestOverride: { baseURL },
      state,
    });

    const response = await request.get('/');
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ status: 'ok' });
  });
});
