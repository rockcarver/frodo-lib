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
  /** Ends every session and access token issued so far, as an administrator or a restart would. */
  revokeAll(): void;
  /** Answer 401 to the protected endpoint whatever credential it carries. */
  alwaysReject(): void;
  /** The number of requests received for paths containing `part`. */
  count(part: string): number;
  /** The bodies received for paths containing `part`. */
  bodies(part: string): string[];
  close(): Promise<void>;
};

export async function startFakeAm({
  sessionLifetimeMs = 30 * 60 * 1000,
}: { sessionLifetimeMs?: number } = {}): Promise<FakeAm> {
  const requests: string[] = [];
  const received: { path: string; body: string }[] = [];
  let logins = 0;
  let accessTokens = 0;
  let rejectEverything = false;
  // the sessions and access tokens that are valid
  const valid = new Set<string>();
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const path = new URL(req.url as string, 'http://fake').pathname;
      requests.push(`${req.method} ${path}`);
      received.push({ path, body });
      const send = (status: number, payload: object) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (path.includes('/access_token')) {
        accessTokens++;
        valid.add(`fake-access-token-${accessTokens}`);
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
        const password = posted.callbacks?.find(
          (c: { type: string }) => c.type === 'PasswordCallback'
        )?.input?.[0]?.value;
        if (password === 'wrong') {
          return send(401, {
            code: 401,
            reason: 'Unauthorized',
            message: 'Authentication Failed',
          });
        }
        logins++;
        valid.add(`fake-session-${logins}`);
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
      if (path.includes('/boom')) {
        return send(500, { code: 500, reason: 'Internal Server Error' });
      }
      // the endpoints that need a credential (the configuration of a realm)
      if (path.includes('/realm-config/')) {
        const cookie = /iPlanetDirectoryPro=([^;]+)/.exec(
          req.headers.cookie ?? ''
        )?.[1];
        const bearer = /^Bearer (.+)$/.exec(
          req.headers.authorization ?? ''
        )?.[1];
        const credential = cookie ?? bearer;
        if (rejectEverything || !credential || !valid.has(credential)) {
          const rejected = () =>
            send(401, {
              code: 401,
              reason: 'Unauthorized',
              message: 'Access Denied',
            });
          // a rejection that arrives late, when another request has found out
          // and renewed the credential in the meantime
          return path.includes('/slow-')
            ? void setTimeout(rejected, 400)
            : rejected();
        }
        return send(200, {
          result: [],
          resultCount: 0,
          pagedResultsCookie: null,
          totalPagedResultsPolicy: 'NONE',
          totalPagedResults: 0,
          remainingPagedResults: -1,
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
    revokeAll: () => valid.clear(),
    alwaysReject: () => {
      rejectEverything = true;
    },
    count: (part: string) => requests.filter((r) => r.includes(part)).length,
    bodies: (part: string) =>
      received.filter((r) => r.path.includes(part)).map((r) => r.body),
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}
