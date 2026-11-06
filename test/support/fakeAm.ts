/**
 * A minimal fake ForgeRock AM that runs inside the test process and records
 * every request, for tests that need the real login code to talk to a server
 * and count what it sends. It answers what a classic username/password login
 * and a service account login touch; everything else answers 404.
 */
import http from 'http';
import { AddressInfo } from 'net';

export type FakeAm = {
  /** The host to give to the library (http://127.0.0.1:<port>/am). */
  host: string;
  /** Every request received, as `METHOD path`. */
  requests: string[];
  /** The number of password logins (authenticate calls that returned a session). */
  logins(): number;
  /** The number of access tokens issued. */
  accessTokens(): number;
  close(): Promise<void>;
};

export async function startFakeAm({
  sessionLifetimeMs = 30 * 60 * 1000,
}: { sessionLifetimeMs?: number } = {}): Promise<FakeAm> {
  const requests: string[] = [];
  let logins = 0;
  let accessTokens = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const path = new URL(req.url as string, 'http://fake').pathname;
      requests.push(`${req.method} ${path}`);
      const send = (status: number, payload: object) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (path.includes('/access_token')) {
        accessTokens++;
        return send(200, {
          access_token: `fake-access-token-${accessTokens}`,
          token_type: 'Bearer',
          scope: 'fr:am:* fr:idm:*',
          expires_in: Math.round(sessionLifetimeMs / 1000),
        });
      }
      if (path.includes('/json/serverinfo')) {
        return send(200, {
          cookieName: 'iPlanetDirectoryPro',
          realm: '/',
          domains: [],
          secureCookie: false,
        });
      }
      if (path.endsWith('/authenticate')) {
        const posted = body ? JSON.parse(body) : {};
        if (!posted.callbacks) {
          return send(200, {
            authId: 'fake-auth',
            callbacks: [
              {
                type: 'NameCallback',
                output: [{ name: 'prompt', value: 'User Name' }],
                input: [{ name: 'IDToken1', value: '' }],
              },
              {
                type: 'PasswordCallback',
                output: [{ name: 'prompt', value: 'Password' }],
                input: [{ name: 'IDToken2', value: '' }],
              },
            ],
          });
        }
        logins++;
        return send(200, {
          tokenId: `fake-session-${logins}`,
          successUrl: '/',
          realm: '/',
        });
      }
      if (path.includes('/sessions') && req.url?.includes('getSessionInfo')) {
        const now = Date.now();
        return send(200, {
          username: 'someone',
          universalId: 'id=someone,ou=user,dc=openam',
          realm: '/',
          latestAccessTime: new Date(now).toISOString(),
          maxIdleExpirationTime: new Date(
            now + sessionLifetimeMs
          ).toISOString(),
          maxSessionExpirationTime: new Date(
            now + sessionLifetimeMs
          ).toISOString(),
          properties: { AMCtxId: 'fake' },
        });
      }
      return send(404, {});
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as AddressInfo).port;
  return {
    host: `http://127.0.0.1:${port}/am`,
    requests,
    logins: () => logins,
    accessTokens: () => accessTokens,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}
