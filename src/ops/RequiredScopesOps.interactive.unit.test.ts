/**
 * Run tests
 *
 *        npm run test:only RequiredScopesOps.interactive
 *
 * The pre-flight checks that know about the kind of login of the session (measured on a Cloud
 * development tenant on 2026-11-14):
 *
 *   - a device authorization login has no Access Management session: AM answers 403 "No session for
 *     request" and 401 "Access Denied", so the call is refused before it is sent;
 *   - an interactive login never gets a PingFederate token: the call went out without a credential
 *     and came back as a bare 401, so it is refused before it is sent;
 *   - the messages of the scope checks name the kind of login, in words that name no interface of
 *     a caller.
 */
import { describe, expect, test } from '@jest/globals';
import StateImpl from '../shared/State';
import type { LoginInfo } from './AccessProfileOps';
import {
  assertAmSessionAvailable,
  assertHasRequiredScope,
  assertPingFederateAvailable,
  InsufficientScopeError,
  resolveAvailableScope,
} from './RequiredScopesOps';

function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode(claims)}.fake-signature`;
}

function session({
  login,
  claims = {},
  scope = 'fr:idm:*',
  deploymentType = 'cloud',
  interactive = true,
  pfToken = false,
}: {
  login?: LoginInfo;
  claims?: Record<string, unknown>;
  scope?: string;
  deploymentType?: string;
  interactive?: boolean;
  pfToken?: boolean;
}) {
  const state = StateImpl({
    host: 'https://openam-example.forgeblocks.com/am',
    deploymentType,
  });
  state.setBearerTokenMeta({
    access_token: fakeJwt({ sub: 'jdoe', ...claims }),
    token_type: 'Bearer',
    scope,
    expires_in: 1800,
    expires: Date.now() + 1_800_000,
    ...(login ? { login } : {}),
  });
  if (interactive) {
    state.setAuthMode('interactive');
    state.setAmCredentialProvider(async () => null);
  }
  if (pfToken) {
    state.setPfBearerTokenMeta({
      access_token: fakeJwt({ sub: 'sa' }),
      token_type: 'Bearer',
      scope: 'fr:idc:ws:admin',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
    });
  }
  return state;
}

function thrown(fn: () => void): InsufficientScopeError {
  try {
    fn();
  } catch (error) {
    return error as InsufficientScopeError;
  }
  throw new Error('Expected the call to throw');
}

// words that would name an interface of a caller
const CALLER_WORDS = /--[a-z]|frodo |conn save|FRODO_|\bCLI\b|command line/;

describe('RequiredScopesOps.assertAmSessionAvailable', () => {
  test('1: a device authorization login without a session claim is refused before the request, with the reason', () => {
    const state = session({
      login: { flow: 'device' },
      claims: { may_act: { client_id: 'AICMCPExchangeClient' } },
    });
    const error = thrown(() => assertAmSessionAvailable({ state }));
    expect(error).toBeInstanceOf(InsufficientScopeError);
    expect(error.code).toBe('NO_AM_SESSION');
    expect(error.message).toContain('Access Management');
    expect(error.message).toContain('a device authorization login');
    expect(error.message).toContain('browser (authorization code) login');
    expect(error.message).toContain('service account');
    expect(error.message).not.toMatch(CALLER_WORDS);
  });

  test('2: a device login whose token does carry the session claim is let through', () => {
    const state = session({
      login: { flow: 'device' },
      claims: { sessionToken: 'a-session' },
    });
    expect(() => assertAmSessionAvailable({ state })).not.toThrow();
  });

  test('3: a browser login without the claim is not refused: the library does not guess about tenants it has not measured', () => {
    const state = session({ login: { flow: 'browser' } });
    expect(() => assertAmSessionAvailable({ state })).not.toThrow();
  });

  test('4: a session of unknown kind (cached by an earlier version) is not refused', () => {
    const state = session({});
    expect(() => assertAmSessionAvailable({ state })).not.toThrow();
  });

  test('5: an opaque token is not refused (the library cannot read it)', () => {
    const state = StateImpl({
      host: 'https://openam-example.forgeblocks.com/am',
      deploymentType: 'cloud',
    });
    state.setBearerTokenMeta({
      access_token: 'opaque-token',
      token_type: 'Bearer',
      scope: 'fr:idm:*',
      expires_in: 1800,
      expires: Date.now() + 1_800_000,
      login: { flow: 'device' },
    });
    expect(() => assertAmSessionAvailable({ state })).not.toThrow();
  });

  test('6: outside cloud nothing is checked', () => {
    const state = session({
      login: { flow: 'device' },
      deploymentType: 'forgeops',
    });
    expect(() => assertAmSessionAvailable({ state })).not.toThrow();
  });
});

describe('RequiredScopesOps.assertPingFederateAvailable', () => {
  test('7: an interactive login is refused before the request, naming the scope, what it holds and the kind of login', () => {
    const state = session({
      login: { flow: 'browser' },
      scope: 'fr:am:* fr:idm:*',
    });
    const error = thrown(() => assertPingFederateAvailable({ state }));
    expect(error).toBeInstanceOf(InsufficientScopeError);
    expect(error.code).toBe('INSUFFICIENT_SCOPE');
    expect(error.message).toContain('fr:idc:ws:admin');
    expect(error.message).toContain('granted: [fr:am:*, fr:idm:*]');
    expect(error.message).toContain('a browser (authorization code) login');
    expect(error.message).toContain(
      'PingFederate administration needs a token of its own'
    );
    expect(error.message).not.toMatch(CALLER_WORDS);
  });

  test('8: an access token applied from elsewhere is refused the same way', () => {
    const state = session({ login: { flow: 'external-token' } });
    expect(() => assertPingFederateAvailable({ state })).toThrow(
      /an access token issued elsewhere/
    );
  });

  test('9: a session that holds a PingFederate token goes through', () => {
    const state = session({ login: { flow: 'browser' }, pfToken: true });
    expect(() => assertPingFederateAvailable({ state })).not.toThrow();
  });

  test('10: a session that is not interactive (service account) is not refused here', () => {
    const state = session({ interactive: false });
    expect(() => assertPingFederateAvailable({ state })).not.toThrow();
  });

  test('11: outside cloud nothing is checked', () => {
    const state = session({
      login: { flow: 'browser' },
      deploymentType: 'forgeops',
    });
    expect(() => assertPingFederateAvailable({ state })).not.toThrow();
  });
});

describe('RequiredScopesOps: the scope checks name the kind of login', () => {
  test('12: assertHasRequiredScope says the session is a device authorization login, and keeps its first sentence', () => {
    const state = session({
      login: { flow: 'device' },
      scope: 'fr:idm:* fr:idc:esv:read',
    });
    const error = thrown(() =>
      assertHasRequiredScope({
        requiredScopes: ['fr:idc:promotion:read'],
        grantedScope: 'fr:idm:* fr:idc:esv:read',
        state,
      })
    );
    expect(error.message).toContain(
      "This operation requires scope(s) [fr:idc:promotion:read], which the current session's token does not carry (granted: [fr:idm:*, fr:idc:esv:read])."
    );
    expect(error.message).toContain(
      'The current session is a device authorization login.'
    );
    expect(error.message).not.toMatch(CALLER_WORDS);
    expect(error.code).toBe('INSUFFICIENT_SCOPE');
  });

  test('13: without a known kind of login the message is what it was', () => {
    const state = StateImpl({
      host: 'https://openam-example.forgeblocks.com/am',
      deploymentType: 'cloud',
    });
    const error = thrown(() =>
      assertHasRequiredScope({
        requiredScopes: ['fr:iga:*'],
        grantedScope: 'fr:idm:*',
        state,
      })
    );
    expect(error.message).toBe(
      "This operation requires scope(s) [fr:iga:*], which the current session's token does not carry (granted: [fr:idm:*]). Re-authenticate with a credential granted the required scope to continue."
    );
  });

  test('14: resolveAvailableScope names the kind of login when the exchange client refuses a scope', () => {
    const state = session({ login: { flow: 'browser' } });
    const error = thrown(() =>
      resolveAvailableScope({
        requiredScopes: ['fr:idc:federation:*'],
        state,
      })
    );
    expect(error.message).toContain('fr:idc:federation:*');
    expect(error.message).toContain(
      'The current session is a browser (authorization code) login.'
    );
    // the ceiling in the message includes the monitoring scope (measured 2026-11-14)
    expect(error.message).toContain('fr:idc:monitoring:*');
  });
});
