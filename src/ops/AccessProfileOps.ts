import Constants from '../shared/Constants';
import { State } from '../shared/State';
import { decodeJwtPayload } from '../utils/JwtUtils';
import { type AccessTokenMetaType } from './OAuth2OidcOps';

/**
 * The access profile of a session: what the credential the library holds can do on a Cloud
 * tenant, in terms a person or a tool can act on, derived from the token and from the same
 * rules the pre-flight scope check applies, so that the profile and the check cannot disagree.
 *
 * @remarks
 * Interactive logins (the client `AICMCPClient`) reach less than a service account, and the two
 * flows differ: a browser login (authorization code) gets an Access Management session, a device
 * authorization login does not. The profile says so before a command fails.
 *
 * Every statement in the profile has a basis (`AccessProfileBasis`): what the token itself says
 * (the granted scopes, the session claim), or a measured constant of the library with the date it
 * was measured (`measuredOn`): the scopes the client offers, and the scopes its exchange client
 * accepts. Nothing in the profile claims reach that nobody measured: where the library cannot
 * tell, the answer is `unknown`.
 *
 * The profile exists for Cloud tenants only: scopes are a concept of Advanced Identity Cloud.
 */

/** How the credential of the session was obtained. */
export type AccessProfileFlow =
  /** Browser login: authorization code with PKCE and a loopback redirect. */
  | 'browser'
  /** Device authorization login (RFC 8628). */
  | 'device'
  /** An interactive login of a kind the library cannot tell (for example a session cached by an earlier version). */
  | 'interactive'
  /** An access token issued elsewhere and applied to the session. */
  | 'external-token'
  /** A service account. */
  | 'service-account';

/** Why an area is out of reach, or why the library cannot tell. */
export type AccessAreaReason =
  /** The login did not request a scope that the client offers; a new login that requests it would carry it. */
  | 'scope-not-requested'
  /** The built-in client does not offer the scope at all: no interactive login can carry it. */
  | 'scope-not-offered'
  /** The token does not carry the scope. */
  | 'scope-not-granted'
  /** Access Management calls go through a token exchange, and the exchange client refuses the scope. */
  | 'scope-not-exchangeable'
  /** Access Management calls need a session that the access token of this login does not carry. */
  | 'no-am-session'
  /** PingFederate administration needs a token of its own that an interactive login never gets. */
  | 'no-pingfederate-token';

/** What the library based a statement on. */
export type AccessProfileBasis =
  /** The scopes granted according to the token response. */
  | 'granted-scope'
  /** The session claim of the access token. */
  | 'session-claim'
  /** The scopes the exchange client accepts (measured). */
  | 'exchange-ceiling'
  /** The scopes the built-in client offers (measured). */
  | 'client-scope-list'
  /** The kind of credential (service account, external token). */
  | 'credential-kind';

/** The areas of the library's API that an access token can be required for. */
export type AccessAreaId =
  | 'am'
  | 'idm'
  | 'esv'
  | 'governance'
  | 'promotion'
  | 'release'
  | 'certificates'
  | 'custom-domains'
  | 'content-security-policy'
  | 'cookie-domains'
  | 'sso-cookie'
  | 'direct-configuration'
  | 'admin-federation'
  | 'telemetry'
  | 'pingfederate';

/** One area of the API and whether the session can reach it. */
export type AccessProfileArea = {
  /** Stable identifier of the area. */
  id: AccessAreaId;
  /** Name of the area in words. */
  title: string;
  /** The scopes that the API calls of the area declare. */
  scopes: string[];
  /**
   * `yes`: every scope of the area is reachable. `partial`: some are (for example read but not
   * update). `no`: none is. `unknown`: the library cannot tell from what it has.
   */
  reachable: 'yes' | 'partial' | 'no' | 'unknown';
  /** How the area is reached: with the token as it is (`direct`) or through a token exchange (`exchange`). */
  via?: 'direct' | 'exchange';
  /** Why the area is not (fully) reachable. */
  reason?: AccessAreaReason;
  /** One sentence that states why, in plain words and without naming any interface of a caller. */
  explanation?: string;
  /** What the statement is based on. */
  basis: AccessProfileBasis[];
};

/** Something the library did differently from its defaults to make the chosen login succeed. */
export type AccessProfileAdaptation = {
  /** Stable identifier of the adaptation. */
  code: AccessProfileAdaptationCode;
  /** The adaptation in words. */
  message: string;
};

/**
 * What the library did differently from its defaults to make the login succeed.
 * `DEVICE_LOGIN_AM_SCOPE_NOT_REQUESTED`: a device authorization login on the built-in client did not request
 * the scope `fr:am:*` (a device login that requests it ends in a server error after the approval on tenants
 * where it was measured). `DEFAULT_SCOPES_REDUCED`: the client of the tenant refused the default scopes
 * (`invalid_scope`), and the login asked again for fewer.
 */
export type AccessProfileAdaptationCode =
  'DEVICE_LOGIN_AM_SCOPE_NOT_REQUESTED' | 'DEFAULT_SCOPES_REDUCED';

/**
 * What the library remembers of how an interactive access token was obtained. Stored with the token
 * (and so in the session cache), optional: a token without it is treated as an interactive login of
 * unknown kind.
 */
export type LoginInfo = {
  /** Which kind of login obtained the token. */
  flow: 'browser' | 'device' | 'external-token';
  /** The scope the library sent with the request, when the library made the request. */
  requestedScope?: string;
  /** Adaptations the library made to the request. */
  adaptations?: AccessProfileAdaptationCode[];
};

/** The access profile of the current session. */
export type AccessProfile = {
  /** How the credential was obtained. */
  flow: AccessProfileFlow;
  /** The OAuth 2.0 client the access token was issued to, if known. */
  clientId?: string;
  /** Who is logged in, if known. */
  subject?: string;
  /** When the access token expires, in milliseconds since the epoch. */
  expiresAt?: number;
  /** Whether the session holds a refresh token. A session without one ends when the access token expires. */
  refreshable: boolean;
  /** The scopes granted according to the token response. */
  grantedScopes: string[];
  /** The scope the library requested, if it made the request and it differs from what was granted. */
  requestedScope?: string;
  /** The requested scopes the token does not carry. Not an error: a client may grant less than it is asked for. */
  scopesNotGranted: string[];
  /**
   * Whether the access token carries an Access Management session. `present` and `absent` are read
   * from the token; `unknown` when the token is not readable.
   */
  amSession: 'present' | 'absent' | 'unknown';
  /** What the library did differently from its defaults. */
  adaptations: AccessProfileAdaptation[];
  /** Every area of the API and whether the session can reach it. */
  areas: AccessProfileArea[];
  /** The date the measured constants behind the profile were last measured (YYYY-MM-DD). */
  measuredOn: string;
};

type AreaDomain = 'am' | 'direct' | 'pingfederate';

type AreaDefinition = {
  id: AccessAreaId;
  title: string;
  domain: AreaDomain;
  scopes: string[];
};

const s = Constants.AVAILABLE_SCOPES;

/**
 * The areas of the API, and the scopes the API calls of each declare (`requiredScopes` in
 * `src/api`). A test fails when an API module declares a scope that no area lists, so a new module
 * cannot slip past the profile.
 */
export const ACCESS_AREAS: readonly AreaDefinition[] = [
  {
    id: 'am',
    title: 'Access Management',
    domain: 'am',
    scopes: [s.AmFullScope],
  },
  {
    id: 'idm',
    title: 'Identity Management',
    domain: 'direct',
    scopes: [s.IdmFullScope],
  },
  {
    id: 'esv',
    title: 'Environment secrets and variables',
    domain: 'direct',
    scopes: [s.ESVReadScope, s.ESVUpdateScope],
  },
  {
    id: 'governance',
    title: 'Governance',
    domain: 'direct',
    scopes: [s.IGAFullScope],
  },
  {
    id: 'promotion',
    title: 'Configuration promotion',
    domain: 'direct',
    scopes: [s.PromotionReadScope, s.PromotionScope],
  },
  {
    id: 'release',
    title: 'Release information',
    domain: 'direct',
    scopes: [s.ReleaseReadScope],
  },
  {
    id: 'certificates',
    title: 'Certificates',
    domain: 'direct',
    scopes: [s.CertificateReadScope, s.CertificateFullScope],
  },
  {
    id: 'custom-domains',
    title: 'Custom domains',
    domain: 'direct',
    scopes: [s.CustomDomainReadScope, s.CustomDomainFullScope],
  },
  {
    id: 'content-security-policy',
    title: 'Content security policy',
    domain: 'direct',
    scopes: [
      s.ContentSecurityPolicyReadScope,
      s.ContentSecurityPolicyFullScope,
    ],
  },
  {
    id: 'cookie-domains',
    title: 'Cookie domains',
    domain: 'direct',
    scopes: [s.CookieDomainsReadScope, s.CookieDomainsFullScope],
  },
  {
    id: 'sso-cookie',
    title: 'SSO cookie',
    domain: 'direct',
    scopes: [s.SSOCookieReadScope, s.SSOCookieFullScope],
  },
  {
    id: 'direct-configuration',
    title: 'Direct configuration session',
    domain: 'direct',
    scopes: [
      s.DirectConfigurationSessionReadScope,
      s.DirectConfigurationSessionFullScope,
    ],
  },
  {
    id: 'admin-federation',
    title: 'Admin federation',
    domain: 'am',
    scopes: [s.AdminFederationFullScope],
  },
  {
    id: 'telemetry',
    title: 'Telemetry',
    domain: 'direct',
    scopes: [s.TelemetryReadScope],
  },
  {
    id: 'pingfederate',
    title: 'PingFederate administration',
    domain: 'pingfederate',
    scopes: [s.WSFedAdminScope],
  },
];

/** An area of the API, as listed by `listAccessAreas()`. */
export type AccessAreaDescriptor = {
  /** Stable identifier of the area. */
  id: AccessAreaId;
  /** Name of the area in words. */
  title: string;
  /** The scopes that the API calls of the area declare. */
  scopes: string[];
};

/**
 * The areas of the API that the access profile covers, with the scopes the API calls of each declare.
 * @returns {AccessAreaDescriptor[]} the areas, in the order the profile lists them
 */
export function listAccessAreas(): AccessAreaDescriptor[] {
  return ACCESS_AREAS.map(({ id, title, scopes }) => ({
    id,
    title,
    scopes: [...scopes],
  }));
}

/**
 * The area that a scope declared by an API module belongs to, or `undefined` when no area lists it.
 * A scope that a granted wildcard covers (for example `fr:idc:esv:read` by `fr:idc:esv:*`) is not
 * what is looked up here: this is about the scopes the API calls declare.
 * @param {string} scope a scope declared by an API call
 * @returns {AccessAreaId | undefined} the area, or undefined if the scope is not classified
 */
export function areaOfScope(scope: string): AccessAreaId | undefined {
  return ACCESS_AREAS.find((area) =>
    area.scopes.some((declared) => declared === scope)
  )?.id;
}

/**
 * Human wording for the kind of login that obtained a credential, for messages. The wording names
 * no interface of a caller.
 * @param {AccessProfileFlow} flow the flow
 * @returns {string} for example "a device authorization login"
 */
export function describeFlow(flow: AccessProfileFlow): string {
  switch (flow) {
    case 'browser':
      return 'a browser (authorization code) login';
    case 'device':
      return 'a device authorization login';
    case 'service-account':
      return 'a service account';
    case 'external-token':
      return 'an access token issued elsewhere';
    default:
      return 'an interactive login';
  }
}

/**
 * Which kind of login the current session is, as far as the library can tell. `undefined` when the
 * session holds no credential the profile covers (a user session cookie, Amster, no login yet).
 * @param {object} params parameters object
 * @param {State} params.state library state
 * @returns {AccessProfileFlow | undefined} the flow
 */
export function flowOfSession({
  state,
}: {
  state: State;
}): AccessProfileFlow | undefined {
  const meta = state.getBearerTokenMeta();
  if (!meta) return undefined;
  if (meta.login?.flow) return meta.login.flow;
  if (state.getAmCredentialProvider()) return 'interactive';
  if (state.getActiveCredentialSource() === 'svcacct') return 'service-account';
  return undefined;
}

/**
 * Wording for the kind of login the current session is, for messages; `undefined` when the library
 * cannot tell or the session is not one the profile covers.
 * @param {object} params parameters object
 * @param {State} params.state library state
 * @returns {string | undefined} for example "a device authorization login"
 */
export function describeSession({
  state,
}: {
  state: State;
}): string | undefined {
  // Only decorates messages: it must never be the reason a message is not raised.
  try {
    const flow = flowOfSession({ state });
    return flow ? describeFlow(flow) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the access token carries an Access Management session (the `sessionToken` claim).
 * Reads the claim name only: the value is never returned, logged or stored.
 * @param {string} accessToken the access token (a JWT)
 * @returns {'present' | 'absent' | 'unknown'} `unknown` if the token is not a readable JWT
 */
export function amSessionOf(
  accessToken: string | undefined
): 'present' | 'absent' | 'unknown' {
  if (!accessToken) return 'unknown';
  try {
    const claim = decodeJwtPayload(accessToken)['sessionToken'];
    return typeof claim === 'string' && claim.length > 0 ? 'present' : 'absent';
  } catch {
    return 'unknown';
  }
}

function claimOf(
  accessToken: string | undefined,
  name: string
): unknown | undefined {
  if (!accessToken) return undefined;
  try {
    return decodeJwtPayload(accessToken)[name];
  } catch {
    return undefined;
  }
}

/** Whether the token names an exchange client (`may_act`), which is what routes Access Management calls through the exchange. */
function usesExchange(accessToken: string | undefined): boolean {
  const mayAct = claimOf(accessToken, 'may_act') as
    { client_id?: string } | undefined;
  return !!mayAct?.client_id;
}

/**
 * Whether a granted scope covers a required scope: an exact match, or a wildcard grant
 * (`fr:idc:esv:*`) whose prefix covers the required scope (`fr:idc:esv:read`).
 * @param {string} grantedScope a scope the credential carries
 * @param {string} requiredScope a scope an operation requires
 * @returns {boolean} true if the granted scope covers the required one
 */
export function scopeSatisfies(
  grantedScope: string,
  requiredScope: string
): boolean {
  if (grantedScope === requiredScope) return true;
  return (
    grantedScope.endsWith(':*') &&
    requiredScope.startsWith(grantedScope.slice(0, -1))
  );
}

function adaptationMessage(code: AccessProfileAdaptationCode): string {
  switch (code) {
    case 'DEVICE_LOGIN_AM_SCOPE_NOT_REQUESTED':
      return `The scope ${s.AmFullScope} was not requested: a device login that requests it fails after the approval on the tenants where this was measured, and its token cannot reach Access Management anyway.`;
    case 'DEFAULT_SCOPES_REDUCED':
      return 'The client of this tenant refused the default scopes of the login (invalid_scope), so the login asked again for fewer.';
  }
}

/** Splits a scope string into its scopes. */
function scopesOf(scope: string | undefined): string[] {
  return (scope ?? '').split(' ').filter(Boolean);
}

type SessionFacts = {
  flow: AccessProfileFlow;
  granted: string[];
  amSession: 'present' | 'absent' | 'unknown';
  exchange: boolean;
  builtInClient: boolean;
  interactive: boolean;
  pfGranted: string[] | undefined;
};

function explain(reason: AccessAreaReason, scope: string, facts: SessionFacts) {
  switch (reason) {
    case 'scope-not-requested':
      return `The login did not request ${scope}, which the client offers: a new login that requests it would carry it.`;
    case 'scope-not-offered':
      return `The built-in client does not offer ${scope}: no interactive login can carry it.`;
    case 'scope-not-granted':
      return `The access token does not carry ${scope}.`;
    case 'scope-not-exchangeable':
      return `Access Management calls go through a token exchange, and the exchange client does not accept ${scope}.`;
    case 'no-am-session':
      return `The access token of ${describeFlow(facts.flow)} carries no Access Management session, and Access Management refuses it.`;
    case 'no-pingfederate-token':
      return `PingFederate administration needs a token of its own, which an interactive login never gets.`;
  }
}

type ScopeReach = {
  reach: 'yes' | 'no' | 'unknown';
  via: 'direct' | 'exchange';
  reason?: AccessAreaReason;
  basis: AccessProfileBasis[];
};

function directReach(scope: string, facts: SessionFacts): ScopeReach {
  if (facts.granted.some((g) => scopeSatisfies(g, scope))) {
    return { reach: 'yes', via: 'direct', basis: ['granted-scope'] };
  }
  if (facts.builtInClient && facts.interactive) {
    const offered = Constants.CLOUD_INTERACTIVE_CLIENT_SCOPES.some((o) =>
      scopeSatisfies(o, scope)
    );
    return {
      reach: 'no',
      via: 'direct',
      reason: offered ? 'scope-not-requested' : 'scope-not-offered',
      basis: ['granted-scope', 'client-scope-list'],
    };
  }
  return {
    reach: 'no',
    via: 'direct',
    reason: 'scope-not-granted',
    basis: ['granted-scope'],
  };
}

function amReach(scope: string, facts: SessionFacts): ScopeReach {
  if (!facts.exchange) {
    // A credential that Access Management accepts as it is (a service account, a token without an
    // exchange client): the same rule as every other direct call.
    return {
      ...directReach(scope, facts),
      basis: ['granted-scope', 'credential-kind'],
    };
  }
  if (!Constants.CLOUD_BROWSER_MODE_AVAILABLE_SCOPES.includes(scope)) {
    return {
      reach: 'no',
      via: 'exchange',
      reason: 'scope-not-exchangeable',
      basis: ['exchange-ceiling'],
    };
  }
  if (facts.amSession === 'present') {
    return {
      reach: 'yes',
      via: 'exchange',
      basis: ['exchange-ceiling', 'session-claim'],
    };
  }
  if (facts.flow === 'device') {
    return {
      reach: 'no',
      via: 'exchange',
      reason: 'no-am-session',
      basis: ['exchange-ceiling', 'session-claim'],
    };
  }
  return {
    reach: 'unknown',
    via: 'exchange',
    basis: ['exchange-ceiling', 'session-claim'],
  };
}

function areaOf(
  definition: AreaDefinition,
  facts: SessionFacts
): AccessProfileArea {
  const perScope = definition.scopes.map((scope) => {
    if (definition.domain === 'pingfederate') {
      if (facts.interactive) {
        return {
          scope,
          reach: 'no',
          via: 'direct',
          reason: 'no-pingfederate-token',
          basis: ['credential-kind'],
        } as ScopeReach & { scope: string };
      }
      const granted = facts.pfGranted;
      if (!granted) {
        return {
          scope,
          reach: 'unknown',
          via: 'direct',
          basis: ['credential-kind'],
        } as ScopeReach & { scope: string };
      }
      return { scope, ...directReach(scope, { ...facts, granted }) };
    }
    return {
      scope,
      ...(definition.domain === 'am'
        ? amReach(scope, facts)
        : directReach(scope, facts)),
    };
  });
  const yes = perScope.filter((r) => r.reach === 'yes').length;
  const no = perScope.filter((r) => r.reach === 'no').length;
  const reachable: AccessProfileArea['reachable'] =
    yes === perScope.length
      ? 'yes'
      : no === perScope.length
        ? 'no'
        : yes > 0
          ? 'partial'
          : 'unknown';
  const area: AccessProfileArea = {
    id: definition.id,
    title: definition.title,
    scopes: [...definition.scopes],
    reachable,
    via: perScope[0].via,
    basis: [...new Set(perScope.flatMap((r) => r.basis))],
  };
  const firstBlocked = perScope.find((r) => r.reach === 'no');
  if (firstBlocked?.reason && reachable !== 'yes') {
    area.reason = firstBlocked.reason;
    area.explanation = explain(firstBlocked.reason, firstBlocked.scope, facts);
  } else if (reachable === 'unknown') {
    area.explanation =
      'The access token carries no Access Management session, and the library has not measured whether this tenant accepts it.';
  }
  return area;
}

/**
 * Builds the access profile of the current session from the access token and the library state.
 * Never reads the network, never throws, never returns or stores a token.
 * @param {object} params parameters object
 * @param {State} params.state library state
 * @returns {AccessProfile | undefined} the profile, or undefined if the session is not a Cloud session with an access token the profile covers (a user session cookie, Amster, a ForgeOps or classic deployment, no login yet)
 */
export function buildAccessProfile({
  state,
}: {
  state: State;
}): AccessProfile | undefined {
  try {
    if (state.getDeploymentType() !== Constants.CLOUD_DEPLOYMENT_TYPE_KEY) {
      return undefined;
    }
    const flow = flowOfSession({ state });
    const meta: AccessTokenMetaType | undefined = state.getBearerTokenMeta();
    if (!flow || !meta) return undefined;
    const granted = scopesOf(meta.scope);
    const requested = scopesOf(meta.login?.requestedScope);
    const clientId =
      (claimOf(meta.access_token, 'client_id') as string | undefined) ||
      state.getBrowserLoginClientId() ||
      undefined;
    const interactive = flow !== 'service-account';
    const facts: SessionFacts = {
      flow,
      granted,
      amSession: amSessionOf(meta.access_token),
      exchange: interactive && usesExchange(meta.access_token),
      builtInClient: clientId === 'AICMCPClient',
      interactive,
      pfGranted: state.getPfBearerTokenMeta()
        ? scopesOf(state.getPfBearerTokenMeta().scope)
        : undefined,
    };
    const profile: AccessProfile = {
      flow,
      grantedScopes: granted,
      refreshable: !!meta.refresh_token,
      scopesNotGranted: requested.filter(
        (r) => !granted.some((g) => scopeSatisfies(g, r))
      ),
      amSession: facts.amSession,
      adaptations: (meta.login?.adaptations ?? []).map((code) => ({
        code,
        message: adaptationMessage(code),
      })),
      areas: ACCESS_AREAS.map((definition) => areaOf(definition, facts)),
      measuredOn: Constants.CLOUD_INTERACTIVE_MEASURED_ON,
    };
    if (clientId) profile.clientId = clientId;
    if (state.getUsername()) profile.subject = state.getUsername();
    if (typeof meta.expires === 'number') profile.expiresAt = meta.expires;
    if (meta.login?.requestedScope) {
      profile.requestedScope = meta.login.requestedScope;
    }
    return profile;
  } catch {
    return undefined;
  }
}
