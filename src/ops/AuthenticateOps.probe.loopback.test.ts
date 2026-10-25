/**
 * Live-socket tests for probeDeploymentType().
 *
 * Run with:
 *
 *        npm run test:only AuthenticateOps.probe.loopback
 *
 * These cells use a local loopback HTTP server (no Polly, no mocks) to see
 * what really goes over the wire: the two built-in client ids, no
 * credentials, the connection-shaping header overrides, and how a host that
 * is not an AM answers.
 */
import http from 'http';
import { AddressInfo } from 'net';
import StateImpl from '../shared/State';
import AuthenticateOps from './AuthenticateOps';

interface Seen {
  clientId: string;
  headers: http.IncomingHttpHeaders;
}

type Answer = { status: number; location?: string };

function startServer(
  answerFor: (clientId: string) => Answer,
  seen: Seen[]
): Promise<http.Server> {
  return new Promise((resolvePromise) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const clientId = new URLSearchParams(body).get('client_id') ?? '';
        seen.push({ clientId, headers: req.headers });
        const { status, location } = answerFor(clientId);
        res.writeHead(status, location ? { Location: location } : {});
        res.end();
      });
    });
    server.listen(0, '127.0.0.1', () => resolvePromise(server));
  });
}

function stopServer(server: http.Server): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    server.close((err) => (err ? rejectPromise(err) : resolvePromise()));
  });
}

async function probe(
  answerFor: (clientId: string) => Answer,
  setup: (state: ReturnType<typeof StateImpl>) => void = () => undefined
) {
  const seen: Seen[] = [];
  const server = await startServer(answerFor, seen);
  try {
    const port = (server.address() as AddressInfo).port;
    const host = `http://127.0.0.1:${port}/am`;
    const state = StateImpl({ host, useTokenCache: false });
    setup(state);
    const result = await AuthenticateOps(state).probeDeploymentType(host);
    return { result, seen, host };
  } finally {
    await stopServer(server);
  }
}

const toLogin = (host: string) => `${host}/UI/Login?realm=/`;

describe('probeDeploymentType() over a real socket', () => {
  test('1: cloud: the cloud client redirects to the AM login, the ForgeOps client gets 400', async () => {
    const { result, seen } = await probe((clientId) =>
      clientId === 'idmAdminClient'
        ? { status: 302, location: 'http://x/am/UI/Login?realm=/' }
        : { status: 400 }
    );
    expect(result.deploymentType).toBe('cloud');
    expect(result.conclusive).toBe(true);
    expect(seen.map((s) => s.clientId).sort()).toEqual([
      'idm-admin-ui',
      'idmAdminClient',
    ]);
  });

  test('2: classic: both clients get 400', async () => {
    const { result } = await probe(() => ({ status: 400 }));
    expect(result.deploymentType).toBe('classic');
    expect(result.conclusive).toBe(true);
  });

  test('3: a host that is not an AM (404 everywhere) is inconclusive', async () => {
    const { result } = await probe(() => ({ status: 404 }));
    expect(result.conclusive).toBe(false);
  });

  test('4: a gateway that redirects everything elsewhere is inconclusive', async () => {
    const { result } = await probe(() => ({
      status: 302,
      location: 'https://gateway.example.net/login',
    }));
    expect(result.conclusive).toBe(false);
  });

  test('5: nothing listens on the port: inconclusive, not classic', async () => {
    const server = await startServer(() => ({ status: 400 }), []);
    const port = (server.address() as AddressInfo).port;
    await stopServer(server);
    const host = `http://127.0.0.1:${port}/am`;
    const state = StateImpl({ host, useTokenCache: false });
    const result = await AuthenticateOps(state).probeDeploymentType(host);
    expect(result.conclusive).toBe(false);
    expect(result.responses.idmAdminClient.status).toBeUndefined();
  });

  test('6: header overrides are sent, credentials are not', async () => {
    const { seen } = await probe(
      () => ({ status: 400 }),
      (state) => state.setAuthenticationHeaderOverrides({ 'X-Gateway': 'ok' })
    );
    expect(seen).toHaveLength(2);
    for (const { headers } of seen) {
      expect(headers['x-gateway']).toBe('ok');
      expect(headers.cookie).toBeUndefined();
      expect(headers.authorization).toBeUndefined();
    }
  });
});
