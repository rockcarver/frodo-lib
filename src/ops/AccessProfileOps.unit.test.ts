/**
 * Run tests
 *
 *        npm run test:only AccessProfileOps.unit
 *
 * The access profile of a session: what the credential can do, derived from the access token and
 * the state with no network call. The expectations for the three interactive sessions are the
 * read sweep measured on a Cloud development tenant on 2026-11-14 (lib 5.0.0-43, one read call per
 * API area through the library, one exchange attempt per scope):
 *
 *   browser login, default scopes (`fr:am:* fr:idm:*`): AM and IDM work, ESV is refused because
 *   the scopes were not requested, everything else is refused;
 *   browser login, all five scopes: AM, IDM and ESV work;
 *   device login without `fr:am:*`: IDM and ESV work, AM answers 403 "No session for request".
 *
 * Fixtures carry claim names and scopes only, never a real token.
 */
import { describe, expect, test } from '@jest/globals';
import Constants from '../shared/Constants';
import StateImpl from '../shared/State';
import {
  ACCESS_AREAS,
  amSessionOf,
  areaOfScope,
  buildAccessProfile,
  describeFlow,
  describeSession,
  scopeSatisfies,
  type AccessAreaId,
  type AccessProfile,
  type LoginInfo,
} from './AccessProfileOps';

const HOST = 'https://openam-example.forgeblocks.com/am';

function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ typ: 'JWT', alg: 'RS256' })}.${encode(claims)}.fake-signature`;
}

const SESSION_VALUE = 'a-session-value-that-must-never-leak';

type SessionOptions = {
  scope: string;
  claims?: Record<string, unknown>;
  login?: LoginInfo;
  refresh?: boolean;
  source?: 'browser' | 'svcacct' | 'user';
  provider?: boolean;
  deploymentType?: string;
  pfScope?: string;
  expires?: number;
};

function session({
  scope,
  claims = {},
  login,
  refresh = false,
  source = 'browser',
  provider = true,
  deploymentType = 'cloud',
  pfScope,
  expires = 1_900_000_000_000,
}: SessionOptions) {
  const state = StateImpl({ host: HOST, deploymentType });
  const access_token = fakeJwt({
    sub: 'jdoe',
    client_id: 'AICMCPClient',
    scope: scope.split(' '),
    ...claims,
  });
  state.setBearerTokenMeta({
    access_token,
    token_type: 'Bearer',
    scope,
    expires_in: 1800,
    expires,
    ...(refresh ? { refresh_token: 'a-refresh-token' } : {}),
    ...(login ? { login } : {}),
  });
  if (provider) state.setAmCredentialProvider(async () => null);
  state.setActiveCredentialSource(source);
  state.setUsername('jdoe');
  if (pfScope) {
    state.setPfBearerTokenMeta({
      access_token: fakeJwt({ sub: 'sa' }),
      token_type: 'Bearer',
      scope: pfScope,
      expires_in: 1800,
      expires: expires,
    });
  }
  return state;
}

const MAY_ACT = { may_act: { client_id: 'AICMCPExchangeClient' } };
const WITH_SESSION = { sessionToken: SESSION_VALUE, ...MAY_ACT };

const BROWSER_DEFAULT = session({
  scope: 'fr:am:* fr:idm:*',
  claims: WITH_SESSION,
  login: { flow: 'browser', requestedScope: 'fr:am:* fr:idm:*' },
});
const FIVE =
  'fr:am:* fr:idm:* fr:idc:esv:read fr:idc:esv:update fr:idc:monitoring:*';
const BROWSER_FIVE = session({
  scope: FIVE,
  claims: WITH_SESSION,
  login: { flow: 'browser', requestedScope: FIVE },
});
const DEVICE_FOUR =
  'fr:idm:* fr:idc:esv:read fr:idc:esv:update fr:idc:monitoring:*';
const DEVICE = session({
  scope: DEVICE_FOUR,
  claims: MAY_ACT,
  login: {
    flow: 'device',
    requestedScope: DEVICE_FOUR,
    adaptations: ['DEVICE_LOGIN_AM_SCOPE_NOT_REQUESTED'],
  },
});

function reach(profile: AccessProfile, id: AccessAreaId) {
  const area = profile.areas.find((a) => a.id === id);
  if (!area) throw new Error(`no area ${id}`);
  return area;
}

const NOT_REACHABLE_BY_INTERACTIVE: AccessAreaId[] = [
  'governance',
  'promotion',
  'release',
  'certificates',
  'custom-domains',
  'content-security-policy',
  'cookie-domains',
  'sso-cookie',
  'direct-configuration',
  'telemetry',
];

describe('AccessProfileOps: the profile of an interactive session (measured 2026-11-14)', () => {
  test('1: browser login with the default scopes reaches AM and IDM, not ESV, and says why', () => {
    const profile = buildAccessProfile({ state: BROWSER_DEFAULT });
    expect(profile).toBeDefined();
    expect(profile.flow).toBe('browser');
    expect(profile.clientId).toBe('AICMCPClient');
    expect(profile.grantedScopes).toEqual(['fr:am:*', 'fr:idm:*']);
    expect(profile.amSession).toBe('present');
    expect(reach(profile, 'am')).toMatchObject({
      reachable: 'yes',
      via: 'exchange',
    });
    expect(reach(profile, 'idm')).toMatchObject({
      reachable: 'yes',
      via: 'direct',
    });
    expect(reach(profile, 'esv')).toMatchObject({
      reachable: 'no',
      reason: 'scope-not-requested',
    });
  });

  test('2: browser login with all five scopes reaches AM, IDM and ESV', () => {
    const profile = buildAccessProfile({ state: BROWSER_FIVE });
    expect(profile.grantedScopes).toEqual(FIVE.split(' '));
    expect(reach(profile, 'am').reachable).toBe('yes');
    expect(reach(profile, 'idm').reachable).toBe('yes');
    expect(reach(profile, 'esv')).toMatchObject({
      reachable: 'yes',
      via: 'direct',
    });
    expect(profile.scopesNotGranted).toEqual([]);
  });

  test('3: device login without fr:am:* reaches IDM and ESV, never AM (no session claim)', () => {
    const profile = buildAccessProfile({ state: DEVICE });
    expect(profile.flow).toBe('device');
    expect(profile.amSession).toBe('absent');
    expect(reach(profile, 'am')).toMatchObject({
      reachable: 'no',
      reason: 'no-am-session',
      via: 'exchange',
    });
    expect(reach(profile, 'idm').reachable).toBe('yes');
    expect(reach(profile, 'esv').reachable).toBe('yes');
    expect(profile.adaptations).toEqual([
      expect.objectContaining({
        code: 'DEVICE_LOGIN_AM_SCOPE_NOT_REQUESTED',
        message: expect.stringContaining('fr:am:*'),
      }),
    ]);
  });

  test.each([
    ['browser, default scopes', BROWSER_DEFAULT],
    ['browser, all five scopes', BROWSER_FIVE],
    ['device, without fr:am:*', DEVICE],
  ])(
    '4: %s: promotion, release, certificates, domains, CSP, cookies, telemetry and governance are out of reach, PingFederate has no token',
    (_name, state) => {
      const profile = buildAccessProfile({ state });
      for (const id of NOT_REACHABLE_BY_INTERACTIVE) {
        expect(reach(profile, id)).toMatchObject({
          reachable: 'no',
          reason: 'scope-not-offered',
        });
        expect(reach(profile, id).explanation).toEqual(expect.any(String));
      }
      expect(reach(profile, 'pingfederate')).toMatchObject({
        reachable: 'no',
        reason: 'no-pingfederate-token',
      });
      // Admin federation is an AM call with a scope the exchange client refuses.
      expect(reach(profile, 'admin-federation')).toMatchObject({
        reachable: 'no',
        reason: 'scope-not-exchangeable',
        via: 'exchange',
      });
    }
  );

  test('5: the table of the issue, area by area, for the three sessions', () => {
    const table: Record<string, [AccessProfile, Record<string, string>]> = {
      'browser default': [
        buildAccessProfile({ state: BROWSER_DEFAULT }),
        { am: 'yes', idm: 'yes', esv: 'no' },
      ],
      'browser all five': [
        buildAccessProfile({ state: BROWSER_FIVE }),
        { am: 'yes', idm: 'yes', esv: 'yes' },
      ],
      device: [
        buildAccessProfile({ state: DEVICE }),
        { am: 'no', idm: 'yes', esv: 'yes' },
      ],
    };
    for (const [name, [profile, expected]] of Object.entries(table)) {
      const actual = Object.fromEntries(
        profile.areas
          .filter((a) => a.id in expected)
          .map((a) => [a.id, a.reachable])
      );
      expect({ name, actual }).toEqual({ name, actual: expected });
    }
  });

  test('6: a login that was granted fewer scopes than it requested reports them, no error', () => {
    const profile = buildAccessProfile({
      state: session({
        scope: 'fr:am:* fr:idm:*',
        claims: WITH_SESSION,
        login: { flow: 'browser', requestedScope: FIVE },
      }),
    });
    expect(profile.scopesNotGranted).toEqual([
      'fr:idc:esv:read',
      'fr:idc:esv:update',
      'fr:idc:monitoring:*',
    ]);
    expect(profile.requestedScope).toBe(FIVE);
    expect(reach(profile, 'esv').reachable).toBe('no');
  });

  test('7: the profile carries expiry, refresh, subject and the measurement date, and no token or session value', () => {
    const profile = buildAccessProfile({
      state: session({
        scope: FIVE,
        claims: WITH_SESSION,
        login: { flow: 'browser', requestedScope: FIVE },
        refresh: true,
        expires: 1_900_000_000_000,
      }),
    });
    expect(profile).toMatchObject({
      refreshable: true,
      expiresAt: 1_900_000_000_000,
      subject: 'jdoe',
      measuredOn: Constants.CLOUD_INTERACTIVE_MEASURED_ON,
    });
    const json = JSON.stringify(profile);
    expect(json).not.toContain(SESSION_VALUE);
    expect(json).not.toContain('fake-signature');
    expect(json).not.toContain('a-refresh-token');
    expect(buildAccessProfile({ state: BROWSER_DEFAULT }).refreshable).toBe(
      false
    );
  });

  test('8: a browser token without the session claim is not guessed about: AM reach is unknown', () => {
    const profile = buildAccessProfile({
      state: session({
        scope: 'fr:am:* fr:idm:*',
        claims: MAY_ACT,
        login: { flow: 'browser', requestedScope: 'fr:am:* fr:idm:*' },
      }),
    });
    expect(profile.amSession).toBe('absent');
    expect(reach(profile, 'am').reachable).toBe('unknown');
    expect(reach(profile, 'am').explanation).toEqual(expect.any(String));
  });

  test('9: a session cached by an earlier version (no login info) is an interactive login of unknown kind', () => {
    const profile = buildAccessProfile({
      state: session({ scope: 'fr:am:* fr:idm:*', claims: WITH_SESSION }),
    });
    expect(profile.flow).toBe('interactive');
    expect(reach(profile, 'am').reachable).toBe('yes');
    expect(profile.adaptations).toEqual([]);
  });

  test('10: a client the customer registered is not told it did not offer a scope', () => {
    const profile = buildAccessProfile({
      state: session({
        scope: 'fr:am:* fr:idm:*',
        claims: { ...WITH_SESSION, client_id: 'my-own-client' },
        login: { flow: 'browser', requestedScope: 'fr:am:* fr:idm:*' },
      }),
    });
    expect(profile.clientId).toBe('my-own-client');
    expect(reach(profile, 'esv')).toMatchObject({
      reachable: 'no',
      reason: 'scope-not-granted',
    });
    expect(reach(profile, 'promotion').reason).toBe('scope-not-granted');
  });
});

describe('AccessProfileOps: other sessions', () => {
  test('11: a service account reaches what its scopes say, PingFederate through its own token', () => {
    const profile = buildAccessProfile({
      state: session({
        scope:
          'fr:am:* fr:idm:* fr:idc:esv:read fr:idc:promotion:* fr:idc:release:*',
        claims: { client_id: 'service-account-client' },
        source: 'svcacct',
        provider: false,
        pfScope: 'fr:idc:ws:admin',
      }),
    });
    expect(profile.flow).toBe('service-account');
    expect(reach(profile, 'am')).toMatchObject({
      reachable: 'yes',
      via: 'direct',
    });
    expect(reach(profile, 'promotion').reachable).toBe('yes');
    expect(reach(profile, 'release').reachable).toBe('yes');
    // read granted, update not: partly reachable
    expect(reach(profile, 'esv').reachable).toBe('partial');
    expect(reach(profile, 'certificates')).toMatchObject({
      reachable: 'no',
      reason: 'scope-not-granted',
    });
    expect(reach(profile, 'pingfederate').reachable).toBe('yes');
  });

  test('12: a service account on a tenant without a PingFederate token has unknown PingFederate reach', () => {
    const profile = buildAccessProfile({
      state: session({
        scope: 'fr:am:* fr:idm:*',
        source: 'svcacct',
        provider: false,
      }),
    });
    expect(reach(profile, 'pingfederate').reachable).toBe('unknown');
  });

  test('13: an access token issued elsewhere is said to be that', () => {
    const profile = buildAccessProfile({
      state: session({
        scope: 'fr:am:* fr:idm:*',
        claims: WITH_SESSION,
        login: { flow: 'external-token' },
      }),
    });
    expect(profile.flow).toBe('external-token');
    expect(reach(profile, 'am').reachable).toBe('yes');
  });

  test.each([
    ['a ForgeOps session', { deploymentType: 'forgeops', scope: 'fr:idm:*' }],
    ['a classic session', { deploymentType: 'classic', scope: 'openid' }],
    [
      'a user session (cookie)',
      { scope: 'fr:idm:*', source: 'user' as const, provider: false },
    ],
  ])('14: %s has no access profile', (_name, options) => {
    expect(buildAccessProfile({ state: session(options) })).toBeUndefined();
  });

  test('15: no login yet: no profile, and no throw', () => {
    expect(
      buildAccessProfile({
        state: StateImpl({ host: HOST, deploymentType: 'cloud' }),
      })
    ).toBeUndefined();
    expect(buildAccessProfile({ state: {} as any })).toBeUndefined();
  });
});

describe('AccessProfileOps: helpers', () => {
  test('16: amSessionOf reads the claim name only, and tolerates tokens it cannot read', () => {
    expect(amSessionOf(fakeJwt({ sessionToken: 'x' }))).toBe('present');
    expect(amSessionOf(fakeJwt({ sub: 'x' }))).toBe('absent');
    expect(amSessionOf(fakeJwt({ sessionToken: '' }))).toBe('absent');
    expect(amSessionOf('not-a-jwt')).toBe('unknown');
    expect(amSessionOf(undefined)).toBe('unknown');
  });

  test('17: scopeSatisfies: exact, wildcard prefix, and a narrow grant does not cover a wildcard', () => {
    expect(scopeSatisfies('fr:idm:*', 'fr:idm:*')).toBe(true);
    expect(scopeSatisfies('fr:idc:esv:*', 'fr:idc:esv:read')).toBe(true);
    expect(scopeSatisfies('fr:idc:esv:read', 'fr:idc:esv:*')).toBe(false);
    expect(scopeSatisfies('fr:idm:*', 'fr:am:*')).toBe(false);
  });

  test('18: the wording of flows names no interface of a caller', () => {
    for (const flow of [
      'browser',
      'device',
      'interactive',
      'external-token',
      'service-account',
    ] as const) {
      expect(describeFlow(flow)).not.toMatch(/--|frodo |conn save|FRODO_/);
    }
    expect(describeSession({ state: DEVICE })).toBe(
      'a device authorization login'
    );
    expect(describeSession({ state: {} as any })).toBeUndefined();
  });

  test('19: every area lists scopes, and every scope belongs to one area only', () => {
    const seen = new Map<string, AccessAreaId>();
    for (const area of ACCESS_AREAS) {
      expect(area.scopes.length).toBeGreaterThan(0);
      for (const scope of area.scopes) {
        expect(seen.get(scope)).toBeUndefined();
        seen.set(scope, area.id);
        expect(areaOfScope(scope)).toBe(area.id);
      }
    }
    expect(areaOfScope('fr:something:else')).toBeUndefined();
  });

  test('20: the ceiling and the scopes the client offers include the monitoring scope (measured 2026-11-14)', () => {
    expect(Constants.CLOUD_BROWSER_MODE_AVAILABLE_SCOPES).toEqual([
      'fr:am:*',
      'fr:idm:*',
      'fr:idc:esv:read',
      'fr:idc:esv:update',
      'fr:idc:monitoring:*',
    ]);
    expect(Constants.CLOUD_INTERACTIVE_CLIENT_SCOPES).toEqual(
      Constants.CLOUD_BROWSER_MODE_AVAILABLE_SCOPES
    );
  });
});
