/**
 * Live-socket tests for what an interactive session sends, and what it is refused before sending
 * (a local loopback HTTP server, no Polly, no tenant).
 *
 * Run with:
 *
 *        npm run test:only BaseApi.interactiveSessions
 *
 * Measured on a Cloud development tenant on 2026-11-14:
 *
 *   - a device authorization login has an access token without an Access Management session, and
 *     Access Management answers every call with 403 "No session for request" or 401 "Access
 *     Denied", also after the token exchange: the call is refused before the exchange and before
 *     the request;
 *   - an interactive login never gets a PingFederate token: the request used to go out without a
 *     credential and come back as a bare 401: it is refused before it is sent.
 */
import http from 'http';
import { AddressInfo } from 'net';
import { describe, expect, test } from '@jest/globals';
import AuthenticateImpl from '../ops/AuthenticateOps';
import { InsufficientScopeError } from '../ops/RequiredScopesOps';
import StateImpl from '../shared/State';
import { getFeatures } from './cloud/FeatureApi';
import { getFederationInfo } from './cloud/WSFedApi';

type Seen = { method: string; url: string; authorization?: string };

async function withServer<T>(
  run: (host: string, seen: Seen[]) => Promise<T>
): Promise<T> {
  const seen: Seen[] = [];
  const server = http.createServer((req, res) => {
    seen.push({
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.url?.includes('/oauth2/access_token')) {
      res.end(
        JSON.stringify({
          access_token: 'exchanged-am-token',
          token_type: 'Bearer',
          scope: 'fr:am:*',
          expires_in: 40,
        })
      );
    } else if (req.url?.startsWith('/feature')) {
      res.end(JSON.stringify({ result: [{ _id: 'service-accounts' }] }));
    } else {
      res.end(JSON.stringify({}));
    }
  });
  await new Promise<void>((resolvePromise) =>
    server.listen(0, '127.0.0.1', () => resolvePromise())
  );
  try {
    const port = (server.address() as AddressInfo).port;
    return await run(`http://127.0.0.1:${port}/am`, seen);
  } finally {
    await new Promise<void>((resolvePromise, rejectPromise) =>
      server.close((err) => (err ? rejectPromise(err) : resolvePromise()))
    );
  }
}

function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode(claims)}.fake-signature`;
}

function interactiveToken({
  flow,
  session,
}: {
  flow: 'browser' | 'device';
  session: boolean;
}) {
  return {
    access_token: fakeJwt({
      sub: 'jdoe',
      client_id: 'AICMCPClient',
      may_act: { client_id: 'AICMCPExchangeClient' },
      ...(session ? { sessionToken: 'a-session' } : {}),
    }),
    token_type: 'Bearer',
    scope: 'fr:idm:*',
    expires_in: 1800,
    expires: Date.now() + 1_800_000,
    login: { flow, requestedScope: 'fr:idm:*' },
  } as any;
}

async function interactiveState(
  host: string,
  token: ReturnType<typeof interactiveToken>
) {
  const state = StateImpl({ host, deploymentType: 'cloud' });
  await AuthenticateImpl(state).applyAccessToken(token);
  return state;
}

const onlyAmDomain = (seen: Seen[]) =>
  seen.filter(
    (s) =>
      s.url.startsWith('/feature') || s.url.includes('/oauth2/access_token')
  );

describe('an AM-domain call of an interactive session', () => {
  test('1: a device login without an AM session is refused before the exchange and before the request', async () => {
    await withServer(async (host, seen) => {
      const state = await interactiveState(
        host,
        interactiveToken({ flow: 'device', session: false })
      );
      const error: any = await getFeatures({ state }).then(
        () => undefined,
        (e) => e
      );
      expect(error).toBeInstanceOf(InsufficientScopeError);
      expect(error.code).toBe('NO_AM_SESSION');
      expect(error.message).toContain('a device authorization login');
      expect(onlyAmDomain(seen)).toEqual([]);
    });
  });

  test('2: a browser login with an AM session exchanges its token and sends the exchanged one', async () => {
    await withServer(async (host, seen) => {
      const state = await interactiveState(
        host,
        interactiveToken({ flow: 'browser', session: true })
      );
      await getFeatures({ state });
      const am = onlyAmDomain(seen);
      expect(am.map((s) => `${s.method} ${s.url.split('?')[0]}`)).toEqual([
        'POST /am/oauth2/access_token',
        'GET /feature',
      ]);
      expect(am[1].authorization).toBe('Bearer exchanged-am-token');
    });
  });

  test('3: an access token issued elsewhere, without a session claim, is not refused: the library does not guess, the server decides', async () => {
    await withServer(async (host, seen) => {
      const token = interactiveToken({ flow: 'browser', session: false });
      delete token.login;
      const state = await interactiveState(host, token);
      await getFeatures({ state });
      expect(onlyAmDomain(seen).length).toBeGreaterThan(0);
    });
  });
});

describe('a PingFederate call', () => {
  test('4: an interactive login is refused before the request, with the scope, what it holds and why', async () => {
    await withServer(async (host, seen) => {
      const state = await interactiveState(
        host,
        interactiveToken({ flow: 'browser', session: true })
      );
      const error: any = await getFederationInfo({ state }).then(
        () => undefined,
        (e) => e
      );
      expect(error).toBeInstanceOf(InsufficientScopeError);
      expect(error.code).toBe('INSUFFICIENT_SCOPE');
      expect(error.message).toContain('fr:idc:ws:admin');
      expect(error.message).toContain('a browser (authorization code) login');
      expect(seen.some((s) => s.url.includes('/ws/admin/'))).toBe(false);
    });
  });

  test('5: a session that holds a PingFederate token sends it', async () => {
    await withServer(async (host, seen) => {
      const state = StateImpl({ host, deploymentType: 'cloud' });
      state.setPfBearerTokenMeta({
        access_token: 'pf-token',
        token_type: 'Bearer',
        scope: 'fr:idc:ws:admin',
        expires_in: 3600,
        expires: Date.now() + 3_600_000,
      });
      await getFederationInfo({ state });
      const pf = seen.find((s) => s.url.includes('/ws/admin/'));
      expect(pf?.authorization).toBe('Bearer pf-token');
    });
  });
});
