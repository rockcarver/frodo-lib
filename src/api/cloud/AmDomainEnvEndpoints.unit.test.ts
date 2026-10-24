/**
 * Live-socket tests for the two host-root calls that answer only to the
 * AM-domain credential: the feature list and the service account scopes.
 *
 * Run with:
 *
 *        npm run test:only AmDomainEnvEndpoints
 *
 * Against a live tenant both answered 401 to a browser login's primary token
 * and to the token exchanged for fr:idm:*, and 200 to the token exchanged for
 * fr:am:*. A local loopback HTTP server (no Polly) shows the headers that go
 * out for each kind of login.
 */
import http from 'http';
import { AddressInfo } from 'net';
import StateImpl from '../../shared/State';
import { getServiceAccountScopes } from './EnvServiceAccountScopesApi';
import { getFeatures } from './FeatureApi';

interface Received {
  authorization?: string;
  cookie?: string;
  url?: string;
}

const calls = {
  'feature list': {
    call: getFeatures,
    path: '/feature?_queryFilter=true',
    body: { result: [{ _id: 'service-accounts', installedVersion: '1.0' }] },
  },
  'service account scopes': {
    call: getServiceAccountScopes,
    path: '/environment/scopes/service-accounts',
    body: [{ scope: 'fr:am:*' }],
  },
};

async function withServer<T>(
  body: object,
  run: (host: string, received: Received) => Promise<T>
): Promise<T> {
  const received: Received = {};
  const server = http.createServer((req, res) => {
    received.authorization = req.headers.authorization;
    received.cookie = req.headers.cookie;
    received.url = req.url;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>((resolvePromise) =>
    server.listen(0, '127.0.0.1', () => resolvePromise())
  );
  try {
    const port = (server.address() as AddressInfo).port;
    return await run(`http://127.0.0.1:${port}/am`, received);
  } finally {
    await new Promise<void>((resolvePromise, rejectPromise) =>
      server.close((err) => (err ? rejectPromise(err) : resolvePromise()))
    );
  }
}

const bearerMeta = (token: string) =>
  ({
    access_token: token,
    token_type: 'Bearer',
    scope: 'fr:am:* fr:idm:*',
    expires_in: 3600,
    expires: Date.now() + 60 * 60 * 1000,
  }) as any;

describe.each(Object.entries(calls))(
  'the %s',
  (_name, { call, path, body }) => {
    test('1: a browser login sends the token exchanged for AM, not its primary token', async () => {
      await withServer(body, async (host, received) => {
        const state = StateImpl({});
        state.setHost(host);
        state.setBearerTokenMeta(bearerMeta('primary-token'));
        const asked: string[][] = [];
        state.setAmCredentialProvider(async (requiredScopes) => {
          asked.push(requiredScopes);
          return {
            header: 'Authorization',
            value: 'Bearer exchanged-am-token',
          };
        });

        await call({ state });

        expect(received.url).toBe(path);
        expect(received.authorization).toBe('Bearer exchanged-am-token');
        // no scope named: the exchange then defaults to fr:am:*
        expect(asked).toEqual([[]]);
      });
    });

    test('2: a session login sends its cookie and no token', async () => {
      await withServer(body, async (host, received) => {
        const state = StateImpl({});
        state.setHost(host);
        state.setCookieName('iPlanetDirectoryPro');
        state.setUserSessionTokenMeta({
          tokenId: 'session-cookie-value',
          expires: Date.now() + 60 * 60 * 1000,
        } as any);
        state.setBearerTokenMeta(bearerMeta('primary-token'));

        await call({ state });

        expect(received.cookie).toBe(
          'iPlanetDirectoryPro=session-cookie-value'
        );
        expect(received.authorization).toBeUndefined();
      });
    });

    test('3: with no credential yet, the request still goes out without one', async () => {
      await withServer(body, async (host, received) => {
        const state = StateImpl({});
        state.setHost(host);

        await call({ state });

        expect(received.url).toBe(path);
        expect(received.authorization).toBeUndefined();
        expect(received.cookie).toBeUndefined();
      });
    });
  }
);
