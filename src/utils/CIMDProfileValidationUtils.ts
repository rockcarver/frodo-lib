/**
 * Offline validation of a CIMD profile (agent type `CIMDProfile`).
 *
 * The server validates a profile when it is written, but its messages are terse ("Data validation failed for the
 * attribute, CIMD Client ID URL Patterns" stands for fifteen different mistakes) and it accepts several settings that
 * weaken the authorization server. This module reads a profile and says, without any request, what the server refuses
 * (`error`) and what it accepts but should not be accepted unnoticed (`warning`). It changes nothing and never blocks a
 * write: the server stays authoritative.
 *
 * The rules are what a probe of an Identity Cloud tenant showed (AM 9.0.0, 2026-11-10, the bravo realm of a Cloud
 * development tenant, about 110 requests). A later build may refuse more or less.
 *
 * The module is pure: it makes no request, reads no state and does not modify its input. It does not import the api or
 * ops layers: the shapes it reads are described here by what the functions check.
 */

/** Whether the server refuses the profile (`error`) or accepts it although the setting is risky (`warning`). */
export type CIMDProfileFindingSeverity = 'error' | 'warning';

/**
 * Stable validation codes.
 *
 * | Code | Severity | The finding |
 * | --- | --- | --- |
 * | PATTERNS_REQUIRED | error | no `cimdConfig`, or no, empty or inherited `cimdClientIdUrlPatterns` |
 * | PATTERN_SYNTAX | error | a pattern that the server refuses (not a list of strings, not lower-case `https://`, no or empty host, white space, non-ASCII host, wildcard port) |
 * | DENY_LIST_UNKNOWN_FIELD | error | an entry of `cimdMetadataDenyList` that is not a metadata field of the schema |
 * | AUTH_METHOD_NOT_ALLOWED | error | a `tokenEndpointAuthMethod` that the server refuses |
 * | ENUM_VALUE | error | `status` or `subjectType` outside their values |
 * | LIFETIME_INVALID | error | a token lifetime that is negative or not a number |
 * | REDIRECT_URI_WILDCARD | error | a wildcard in `redirectionUris` |
 * | UNKNOWN_ATTRIBUTE | error | a top-level member that is no group, or an attribute the server does not know (`_rev` is a warning: the library removes it before it sends a profile) |
 * | VALUE_TYPE | error | a value of the wrong JSON type for its attribute (a string for a list, a string for a flag) |
 * | PATTERN_WHOLE_HOST_WILDCARD | warning | a wildcard in the host of a pattern |
 * | PATTERN_NO_PATH | warning | a pattern without a path or with the root path only |
 * | PATTERN_QUERY_FRAGMENT_USERINFO | warning | a pattern with a query, a fragment or user info |
 * | PATTERN_DOT_SEGMENTS | warning | a pattern with a `.` or `..` path segment |
 * | PATTERN_LOCAL_ADDRESS | warning | a pattern for `localhost`, a loopback address, an IP address or with a port out of range |
 * | PATTERN_DUPLICATE | warning | the same pattern twice in the profile |
 * | PATTERN_OVERLAPS_PROFILE | warning | a pattern identical to, inside or around a pattern of another profile |
 * | SSRF_PROTECTION_DISABLED | warning | `cimdSsrfProtectionEnabled` is `false` or `null` |
 * | REDIRECT_URIS_DENIED_BUT_EMPTY | warning | `redirect_uris` is on the deny list and `redirectionUris` is empty |
 * | GRANT_TYPE_UNKNOWN | warning | a grant type outside the six the server documents |
 * | REDIRECT_URI_NOT_HTTPS | warning | an `http://` redirect URI |
 */
export type CIMDProfileFindingCode =
  | 'PATTERNS_REQUIRED'
  | 'PATTERN_SYNTAX'
  | 'DENY_LIST_UNKNOWN_FIELD'
  | 'AUTH_METHOD_NOT_ALLOWED'
  | 'ENUM_VALUE'
  | 'LIFETIME_INVALID'
  | 'REDIRECT_URI_WILDCARD'
  | 'UNKNOWN_ATTRIBUTE'
  | 'VALUE_TYPE'
  | 'PATTERN_WHOLE_HOST_WILDCARD'
  | 'PATTERN_NO_PATH'
  | 'PATTERN_QUERY_FRAGMENT_USERINFO'
  | 'PATTERN_DOT_SEGMENTS'
  | 'PATTERN_LOCAL_ADDRESS'
  | 'PATTERN_DUPLICATE'
  | 'PATTERN_OVERLAPS_PROFILE'
  | 'SSRF_PROTECTION_DISABLED'
  | 'REDIRECT_URIS_DENIED_BUT_EMPTY'
  | 'GRANT_TYPE_UNKNOWN'
  | 'REDIRECT_URI_NOT_HTTPS';

/**
 * One finding of the validation of a CIMD profile.
 */
export interface CIMDProfileFinding {
  /** Stable identifier of the rule that produced the finding. */
  code: CIMDProfileFindingCode;
  /** `error`: the server refuses the profile. `warning`: the server accepts it, the setting is risky or has no effect. */
  severity: CIMDProfileFindingSeverity;
  /** What is wrong, in facts: the attribute and the value, never an option or a command of a caller. */
  message: string;
  /** JSON pointer to the attribute in the plain shape of the profile, for example `/cimdConfig/cimdClientIdUrlPatterns/2`. */
  path: string;
}

/**
 * The metadata fields that a CIMD document may be forbidden to override (`cimdMetadataDenyList`), as the schema of
 * AM 9.0.0 lists them. The schema, when supplied, takes precedence.
 */
export const CIMD_METADATA_DENY_LIST_FIELDS: string[] = [
  'application_type',
  'claims_redirect_uris',
  'client_name',
  'client_uri',
  'contacts',
  'default_acr_values',
  'default_max_age',
  'grant_types',
  'id_token_encrypted_response_alg',
  'id_token_encrypted_response_enc',
  'id_token_signed_response_alg',
  'introspection_encrypted_response_alg',
  'introspection_encrypted_response_enc',
  'introspection_signed_response_alg',
  'jwks',
  'jwks_uri',
  'logo_uri',
  'policy_uri',
  'post_logout_redirect_uris',
  'redirect_uris',
  'request_object_encryption_alg',
  'request_object_encryption_enc',
  'request_object_signing_alg',
  'request_uris',
  'response_types',
  'scope',
  'sector_identifier_uri',
  'subject_type',
  'tls_client_auth_subject_dn',
  'tls_client_certificate_bound_access_tokens',
  'token_endpoint_auth_method',
  'token_endpoint_auth_signing_alg',
  'tos_uri',
  'userinfo_encrypted_response_alg',
  'userinfo_encrypted_response_enc',
  'userinfo_signed_response_alg',
];

/** The values of `coreOAuth2ClientConfig.status`. */
export const CIMD_STATUS_VALUES: string[] = ['Active', 'Inactive'];

/** The values of `advancedOAuth2ClientConfig.subjectType`. */
export const CIMD_SUBJECT_TYPES: string[] = ['pairwise', 'public'];

/** The values of `advancedOAuth2ClientConfig.tokenEndpointAuthMethod` that the server accepts. */
export const CIMD_TOKEN_ENDPOINT_AUTH_METHODS: string[] = [
  'private_key_jwt',
  'tls_client_auth',
  'self_signed_tls_client_auth',
  'none',
];

/** The grant types the server documents for a CIMD profile (`advancedOAuth2ClientConfig.grantTypes`). */
export const CIMD_GRANT_TYPES: string[] = [
  'authorization_code',
  'client_credentials',
  'refresh_token',
  'urn:ietf:params:oauth:grant-type:device_code',
  'urn:ietf:params:oauth:grant-type:jwt-bearer',
  'urn:ietf:params:oauth:grant-type:token-exchange',
];

const GROUPS = [
  'cimdConfig',
  'coreOAuth2ClientConfig',
  'advancedOAuth2ClientConfig',
  'coreOpenIDClientConfig',
  'signEncOAuth2ClientConfig',
  'overrideOAuth2ClientConfig',
];

/** Attributes the server refuses in every group ("Invalid attribute specified."). */
const REFUSED_ATTRIBUTES = ['client_secret', 'userpassword'];

const LIFETIME_ATTRIBUTES = [
  'accessTokenLifetime',
  'authorizationCodeLifetime',
  'refreshTokenLifetime',
];

type Plain = Record<string, unknown>;

const isObject = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The pointer segment of a name: `~` and `/` are escaped as RFC 6901 says. */
const pointer = (...segments: (string | number)[]): string =>
  segments
    .map(
      (segment) =>
        `/${String(segment).replace(/~/g, '~0').replace(/\//g, '~1')}`
    )
    .join('');

/** How a value is quoted in a message: short and on one line. */
function show(value: unknown): string {
  let text: string;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  text = String(text).replace(/\s/g, (char) =>
    char === ' '
      ? ' '
      : `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

type Read = { present: boolean; value?: unknown };

/**
 * Read an attribute of a group in the plain or the wrapped shape (`{ inherited, value }`). The server stores a value
 * that is inherited as no value at all, so `{ inherited: true }` (with or without a value) reads as absent.
 * @param {unknown} group the group object
 * @param {string} name the attribute name
 * @returns {Read} whether the attribute has a value of its own and which
 */
function valueOf(group: unknown, name: string): Read {
  if (!isObject(group) || !Object.prototype.hasOwnProperty.call(group, name)) {
    return { present: false };
  }
  const raw = group[name];
  if (isObject(raw) && typeof raw.inherited === 'boolean') {
    if (raw.inherited === true) return { present: false };
    return Object.prototype.hasOwnProperty.call(raw, 'value')
      ? { present: true, value: raw.value }
      : { present: false };
  }
  return { present: true, value: raw };
}

/** The enum of an attribute from the schema, if the schema is supplied and has one (`enum`, or `items.enum` for a list). */
function enumFromSchema(
  schema: unknown,
  group: string,
  name: string
): string[] | undefined {
  const properties = (schema as Plain | undefined)?.properties;
  const groupSchema = isObject(properties) ? properties[group] : undefined;
  const attributes = isObject(groupSchema) ? groupSchema.properties : undefined;
  const attribute = isObject(attributes) ? attributes[name] : undefined;
  if (!isObject(attribute)) return undefined;
  const direct = attribute.enum;
  const items = isObject(attribute.items) ? attribute.items.enum : undefined;
  const found = Array.isArray(direct) ? direct : items;
  return Array.isArray(found) ? found.map(String) : undefined;
}

/** The attribute names of a group from the schema, if the schema is supplied. */
function attributesFromSchema(
  schema: unknown,
  group: string
): Set<string> | undefined {
  const properties = (schema as Plain | undefined)?.properties;
  const groupSchema = isObject(properties) ? properties[group] : undefined;
  const attributes = isObject(groupSchema) ? groupSchema.properties : undefined;
  return isObject(attributes) ? new Set(Object.keys(attributes)) : undefined;
}

/**
 * A client id URL pattern, taken apart. `*` is kept in the parts where it stands.
 */
type ParsedPattern = {
  userInfo?: string;
  host: string;
  ipv6: boolean;
  port?: string;
  path: string;
  query?: string;
  fragment?: string;
};

/**
 * Take a pattern apart, or say why the server refuses it. The rules are the ones the probe found: a lower-case
 * `https://`, no white space around or in the host, a host that is not empty and ASCII, no wildcard port.
 * @param {string} pattern the pattern
 * @returns {{ parsed?: ParsedPattern, refusal?: string }} the parts, or the reason
 */
function parsePattern(pattern: string): {
  parsed?: ParsedPattern;
  refusal?: string;
} {
  if (pattern.trim() === '') return { refusal: 'is empty or blank' };
  if (pattern !== pattern.trim()) {
    return { refusal: 'has white space before or after it' };
  }
  if (!pattern.startsWith('https://')) {
    return {
      refusal:
        'does not start with https:// in lower case (the scheme must be exactly https://)',
    };
  }
  const rest = pattern.slice('https://'.length);
  const authorityEnd = rest.search(/[/?#]/);
  const authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  const tail = authorityEnd === -1 ? '' : rest.slice(authorityEnd);
  const at = authority.lastIndexOf('@');
  const userInfo = at === -1 ? undefined : authority.slice(0, at);
  const hostPort = at === -1 ? authority : authority.slice(at + 1);
  let host: string;
  let port: string | undefined;
  let ipv6 = false;
  if (hostPort.startsWith('[')) {
    const close = hostPort.indexOf(']');
    if (close === -1)
      return { refusal: 'has an IPv6 host without a closing ]' };
    ipv6 = true;
    host = hostPort.slice(1, close);
    const after = hostPort.slice(close + 1);
    if (after.startsWith(':')) port = after.slice(1);
  } else {
    const colon = hostPort.lastIndexOf(':');
    host = colon === -1 ? hostPort : hostPort.slice(0, colon);
    port = colon === -1 ? undefined : hostPort.slice(colon + 1);
  }
  if (host === '') return { refusal: 'has an empty host' };
  if (/\s/.test(host)) return { refusal: 'has white space in the host' };
  // eslint-disable-next-line no-control-regex
  if (/[^\u0000-\u007f]/.test(host)) {
    return { refusal: 'has a host with characters that are not ASCII' };
  }
  if (port === '*') return { refusal: 'has a wildcard (*) as the port' };
  const queryAt = tail.indexOf('?');
  const fragmentAt = tail.indexOf('#');
  const pathEnd = [queryAt, fragmentAt]
    .filter((index) => index !== -1)
    .reduce((min, index) => Math.min(min, index), tail.length);
  const path = tail.slice(0, pathEnd);
  const query =
    queryAt === -1
      ? undefined
      : tail.slice(queryAt + 1, fragmentAt > queryAt ? fragmentAt : undefined);
  const fragment = fragmentAt === -1 ? undefined : tail.slice(fragmentAt + 1);
  return { parsed: { userInfo, host, ipv6, port, path, query, fragment } };
}

/**
 * Whether a wildcard pattern (`*` matches any run of characters, including none) matches a text. Linear, without
 * regular expressions, so a pattern with many wildcards cannot make it slow.
 * @param {string} pattern the pattern
 * @param {string} text the text
 * @returns {boolean} true if the pattern matches the whole text
 */
export function matchesWildcardPattern(pattern: string, text: string): boolean {
  let p = 0;
  let t = 0;
  let star = -1;
  let mark = 0;
  while (t < text.length) {
    if (p < pattern.length && pattern[p] === '*') {
      star = p++;
      mark = t;
    } else if (p < pattern.length && pattern[p] === text[t]) {
      p++;
      t++;
    } else if (star !== -1) {
      p = star + 1;
      t = ++mark;
    } else {
      return false;
    }
  }
  while (p < pattern.length && pattern[p] === '*') p++;
  return p === pattern.length;
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** What is dubious about the host or the port of a pattern, if anything. */
function localAddressReason(parsed: ParsedPattern): string | undefined {
  const host = parsed.host.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return 'names localhost';
  }
  if (parsed.ipv6) return 'names an IPv6 address';
  if (IPV4.test(host)) {
    return host.startsWith('127.')
      ? 'names a loopback address'
      : 'names an IPv4 address';
  }
  if (parsed.port !== undefined && /^\d+$/.test(parsed.port)) {
    if (Number(parsed.port) > 65535) {
      return `has the port ${parsed.port}, which is outside 0 to 65535`;
    }
  }
  return undefined;
}

/**
 * Validate a CIMD profile without any request.
 *
 * @remarks
 * `profileData` may be in the plain shape (as `readCIMDProfiles` returns it) or the wrapped shape (`{ inherited,
 * value }`, as `readCIMDProfile` returns it); both give the same findings. A property that is inherited
 * (`{ inherited: true }`) reads as absent, as the server stores it. `otherProfiles` are the other profiles of the
 * realm: when given, the patterns are also compared with theirs. `schema` is the schema of the profile
 * (`readCIMDProfileSchema`): when given, the enums and the list of attributes come from it, otherwise from the
 * values the library knows (AM 9.0.0). The function never throws for a malformed profile, it reports it.
 * @param {object} params structured and named parameters
 * @param {unknown} params.profileData the profile
 * @param {unknown[]} [params.otherProfiles] the other profiles of the realm, for the overlap checks
 * @param {unknown} [params.schema] the schema of the profile
 * @returns {CIMDProfileFinding[]} the findings, errors and warnings, grouped by what was checked (attribute names, patterns, SSRF switch, core, advanced, deny list); an empty list for a profile without any
 */
export function validateCIMDProfile({
  profileData,
  otherProfiles,
  schema,
}: {
  profileData: unknown;
  otherProfiles?: unknown[];
  schema?: unknown;
}): CIMDProfileFinding[] {
  const findings: CIMDProfileFinding[] = [];
  const add = (
    code: CIMDProfileFindingCode,
    severity: CIMDProfileFindingSeverity,
    path: string,
    message: string
  ) => findings.push({ code, severity, message, path });
  try {
    const profile: Plain = isObject(profileData) ? profileData : {};
    checkAttributeNames(profile, schema, add);
    const cimd = profile.cimdConfig;
    const denyList = checkCimdConfig(profile, cimd, otherProfiles, add);
    checkCoreConfig(profile, denyList, schema, add);
    checkAdvancedConfig(profile, schema, add);
    checkDenyList(denyList, schema, add);
  } catch {
    // a validation must not be the reason a caller fails; what was found so far is the answer
  }
  return findings;
}

type Add = (
  code: CIMDProfileFindingCode,
  severity: CIMDProfileFindingSeverity,
  path: string,
  message: string
) => void;

function checkAttributeNames(profile: Plain, schema: unknown, add: Add): void {
  for (const key of Object.keys(profile)) {
    if (key === '_id' || key === '_type') continue;
    if (key === '_rev') {
      // A profile as the server returns it carries _rev, and the library removes it before it sends one: a warning, not
      // an error, or no profile that was read from a tenant would ever be clean.
      add(
        'UNKNOWN_ATTRIBUTE',
        'warning',
        pointer(key),
        'The member _rev is not an attribute of a CIMD profile and the server refuses it in a request; the library removes it before it sends a profile.'
      );
      continue;
    }
    if (!GROUPS.includes(key)) {
      add(
        'UNKNOWN_ATTRIBUTE',
        'error',
        pointer(key),
        `The member ${key} is not a group of a CIMD profile (the groups are ${GROUPS.join(', ')}); the server refuses a profile that has it.`
      );
      continue;
    }
    const group = profile[key];
    if (!isObject(group)) {
      add(
        'VALUE_TYPE',
        'error',
        pointer(key),
        `The group ${key} must be an object; the value is ${show(group)}.`
      );
      continue;
    }
    const known = attributesFromSchema(schema, key);
    for (const attribute of Object.keys(group)) {
      if (REFUSED_ATTRIBUTES.includes(attribute)) {
        add(
          'UNKNOWN_ATTRIBUTE',
          'error',
          pointer(key, attribute),
          `The attribute ${attribute} is not accepted in a CIMD profile (the server answers "Invalid attribute specified.").`
        );
      } else if (known && !known.has(attribute)) {
        add(
          'UNKNOWN_ATTRIBUTE',
          'error',
          pointer(key, attribute),
          `The attribute ${attribute} is not an attribute of the group ${key} in the schema (the server answers "Invalid attribute specified.").`
        );
      }
    }
  }
}

/** The patterns, the deny list and the SSRF switch. Returns the deny list read, for the checks that need it. */
function checkCimdConfig(
  profile: Plain,
  cimd: unknown,
  otherProfiles: unknown[] | undefined,
  add: Add
): Read {
  const patternsPath = pointer('cimdConfig', 'cimdClientIdUrlPatterns');
  const patterns = valueOf(cimd, 'cimdClientIdUrlPatterns');
  const denyList = valueOf(cimd, 'cimdMetadataDenyList');
  if (!isObject(cimd)) {
    add(
      'PATTERNS_REQUIRED',
      'error',
      patternsPath,
      'The profile has no cimdConfig group, so no cimdClientIdUrlPatterns: the server refuses to create it, and an update stores a profile that matches no client id.'
    );
  } else if (
    !patterns.present ||
    patterns.value === null ||
    (Array.isArray(patterns.value) && patterns.value.length === 0)
  ) {
    add(
      'PATTERNS_REQUIRED',
      'error',
      patternsPath,
      'The profile has no cimdClientIdUrlPatterns (absent, null, empty or inherited): the server requires at least one pattern to create it, and an update stores a profile that matches no client id.'
    );
  } else if (!Array.isArray(patterns.value)) {
    add(
      'PATTERN_SYNTAX',
      'error',
      patternsPath,
      `cimdClientIdUrlPatterns must be a list of strings; the value is ${show(patterns.value)}.`
    );
  } else {
    checkPatterns(profile, patterns.value, otherProfiles, add);
  }

  const ssrf = valueOf(cimd, 'cimdSsrfProtectionEnabled');
  if (ssrf.present) {
    const ssrfPath = pointer('cimdConfig', 'cimdSsrfProtectionEnabled');
    if (ssrf.value === false || ssrf.value === null) {
      add(
        'SSRF_PROTECTION_DISABLED',
        'warning',
        ssrfPath,
        `cimdSsrfProtectionEnabled is ${show(ssrf.value)}: the server accepts it, and then fetches the client id document from any address, internal ones included.`
      );
    } else if (typeof ssrf.value !== 'boolean') {
      add(
        'VALUE_TYPE',
        'error',
        ssrfPath,
        `cimdSsrfProtectionEnabled must be true or false; the value is ${show(ssrf.value)}.`
      );
    }
  }
  return denyList;
}

function checkPatterns(
  profile: Plain,
  patterns: unknown[],
  otherProfiles: unknown[] | undefined,
  add: Add
): void {
  const base = ['cimdConfig', 'cimdClientIdUrlPatterns'];
  const seen = new Map<string, number>();
  const valid: { index: number; pattern: string }[] = [];
  patterns.forEach((entry, index) => {
    const path = pointer(...base, index);
    if (typeof entry !== 'string') {
      add(
        'PATTERN_SYNTAX',
        'error',
        path,
        `The entry ${show(entry)} is not a string; every pattern must be a string.`
      );
      return;
    }
    const { parsed, refusal } = parsePattern(entry);
    if (!parsed) {
      add(
        'PATTERN_SYNTAX',
        'error',
        path,
        `The pattern ${show(entry)} ${refusal}; the server refuses it.`
      );
      return;
    }
    valid.push({ index, pattern: entry });
    if (parsed.host.includes('*')) {
      add(
        'PATTERN_WHOLE_HOST_WILDCARD',
        'warning',
        path,
        parsed.host === '*'
          ? `The pattern ${show(entry)} has a wildcard as the whole host: a client id on any host matches it.`
          : `The pattern ${show(entry)} has a wildcard in the host: every client id whose host matches ${show(parsed.host)} is accepted.`
      );
    }
    if (parsed.path === '' || parsed.path === '/') {
      add(
        'PATTERN_NO_PATH',
        'warning',
        path,
        `The pattern ${show(entry)} has ${parsed.path === '' ? 'no path' : 'the root path only'}; a client id URL has a path other than / (the draft of the specification requires it), so the pattern is wider than any valid client id.`
      );
    }
    if (
      parsed.query !== undefined ||
      parsed.fragment !== undefined ||
      parsed.userInfo !== undefined
    ) {
      add(
        'PATTERN_QUERY_FRAGMENT_USERINFO',
        'warning',
        path,
        `The pattern ${show(entry)} has ${[
          parsed.userInfo !== undefined ? 'user info' : '',
          parsed.query !== undefined ? 'a query' : '',
          parsed.fragment !== undefined ? 'a fragment' : '',
        ]
          .filter(Boolean)
          .join(
            ', '
          )}; a client id URL has none of these, so no valid client id can match it.`
      );
    }
    if (parsed.path.split('/').some((s) => s === '.' || s === '..')) {
      add(
        'PATTERN_DOT_SEGMENTS',
        'warning',
        path,
        `The pattern ${show(entry)} has a . or .. path segment; a client id URL has none, so no valid client id can match it.`
      );
    }
    const local = localAddressReason(parsed);
    if (local) {
      add(
        'PATTERN_LOCAL_ADDRESS',
        'warning',
        path,
        `The pattern ${show(entry)} ${local}; a client id URL is a public https:// URL.`
      );
    }
    const first = seen.get(entry);
    if (first !== undefined) {
      add(
        'PATTERN_DUPLICATE',
        'warning',
        path,
        `The pattern ${show(entry)} is already the entry ${first} of the list.`
      );
    } else {
      seen.set(entry, index);
    }
  });
  checkOverlaps(profile, valid, otherProfiles, add);
}

/** The relations of the patterns of this profile to the patterns of the other profiles of the realm. */
function checkOverlaps(
  profile: Plain,
  own: { index: number; pattern: string }[],
  otherProfiles: unknown[] | undefined,
  add: Add
): void {
  if (!Array.isArray(otherProfiles)) return;
  const ownId = typeof profile._id === 'string' ? profile._id : undefined;
  for (const other of otherProfiles) {
    if (!isObject(other)) continue;
    const otherId = typeof other._id === 'string' ? other._id : undefined;
    if (ownId !== undefined && otherId === ownId) continue;
    const list = valueOf(other.cimdConfig, 'cimdClientIdUrlPatterns').value;
    if (!Array.isArray(list)) continue;
    const theirs = list.filter((p): p is string => typeof p === 'string');
    for (const { index, pattern } of own) {
      let found: { relation: string; theirs: string } | undefined;
      for (const candidate of theirs) {
        let relation: string | undefined;
        if (candidate === pattern) relation = 'identical';
        else if (matchesWildcardPattern(candidate, pattern))
          relation = 'inside';
        else if (matchesWildcardPattern(pattern, candidate))
          relation = 'around';
        if (
          relation &&
          (!found ||
            ['identical', 'inside', 'around'].indexOf(relation) <
              ['identical', 'inside', 'around'].indexOf(found.relation))
        ) {
          found = { relation, theirs: candidate };
        }
      }
      if (found) {
        const how =
          found.relation === 'identical'
            ? 'identical to'
            : found.relation === 'inside'
              ? 'inside'
              : 'around';
        add(
          'PATTERN_OVERLAPS_PROFILE',
          'warning',
          pointer('cimdConfig', 'cimdClientIdUrlPatterns', index),
          `The pattern ${show(pattern)} is ${how} the pattern ${show(found.theirs)} of the profile ${show(otherId ?? '(without id)')}: a client id that matches both profiles is refused with invalid_client at run time (zero or more than one matching profile).`
        );
      }
    }
  }
}

function checkDenyList(denyList: Read, schema: unknown, add: Add): void {
  if (!denyList.present) return;
  const path = pointer('cimdConfig', 'cimdMetadataDenyList');
  if (!Array.isArray(denyList.value)) {
    add(
      'VALUE_TYPE',
      'error',
      path,
      `cimdMetadataDenyList must be a list of strings; the value is ${show(denyList.value)}.`
    );
    return;
  }
  const allowed =
    enumFromSchema(schema, 'cimdConfig', 'cimdMetadataDenyList') ??
    CIMD_METADATA_DENY_LIST_FIELDS;
  denyList.value.forEach((entry, index) => {
    if (typeof entry === 'string' && allowed.includes(entry)) return;
    const hint =
      entry === 'redirect_uri'
        ? ' (the field is called redirect_uris, in the plural)'
        : typeof entry === 'string' && allowed.includes(entry.toLowerCase())
          ? ` (the fields are lower case: ${entry.toLowerCase()})`
          : '';
    add(
      'DENY_LIST_UNKNOWN_FIELD',
      'error',
      pointer('cimdConfig', 'cimdMetadataDenyList', index),
      `The entry ${show(entry)} is not a metadata field that the schema lists${hint}; the server refuses it.`
    );
  });
}

function checkCoreConfig(
  profile: Plain,
  denyList: Read,
  schema: unknown,
  add: Add
): void {
  const core = profile.coreOAuth2ClientConfig;
  const status = valueOf(core, 'status');
  const statuses =
    enumFromSchema(schema, 'coreOAuth2ClientConfig', 'status') ??
    CIMD_STATUS_VALUES;
  if (status.present && !statuses.includes(status.value as string)) {
    add(
      'ENUM_VALUE',
      'error',
      pointer('coreOAuth2ClientConfig', 'status'),
      `status is ${show(status.value)}; the values are ${statuses.join(' and ')}.`
    );
  }
  for (const name of LIFETIME_ATTRIBUTES) {
    const lifetime = valueOf(core, name);
    if (!lifetime.present) continue;
    const v = lifetime.value;
    const numeric =
      typeof v === 'number'
        ? v
        : typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v)
          ? Number(v)
          : NaN;
    if (!Number.isFinite(numeric) || numeric < 0) {
      add(
        'LIFETIME_INVALID',
        'error',
        pointer('coreOAuth2ClientConfig', name),
        `${name} is ${show(v)}; a lifetime is a number of seconds that is not negative.`
      );
    }
  }
  const redirects = valueOf(core, 'redirectionUris');
  let redirectCount = 0;
  if (redirects.present) {
    const uriPath = pointer('coreOAuth2ClientConfig', 'redirectionUris');
    if (!Array.isArray(redirects.value)) {
      add(
        'VALUE_TYPE',
        'error',
        uriPath,
        `redirectionUris must be a list of strings; the value is ${show(redirects.value)}.`
      );
    } else {
      redirectCount = redirects.value.length;
      redirects.value.forEach((uri, index) => {
        if (typeof uri !== 'string') return;
        const path = pointer(
          'coreOAuth2ClientConfig',
          'redirectionUris',
          index
        );
        if (uri.includes('*')) {
          add(
            'REDIRECT_URI_WILDCARD',
            'error',
            path,
            `The redirect URI ${show(uri)} has a wildcard; the server refuses a wildcard in a redirect URI.`
          );
        }
        if (uri.toLowerCase().startsWith('http://')) {
          add(
            'REDIRECT_URI_NOT_HTTPS',
            'warning',
            path,
            `The redirect URI ${show(uri)} is an http:// URI; the server accepts it, and a code or a token sent to it is not protected in transit.`
          );
        }
      });
    }
  }
  if (
    denyList.present &&
    Array.isArray(denyList.value) &&
    denyList.value.includes('redirect_uris') &&
    redirectCount === 0
  ) {
    add(
      'REDIRECT_URIS_DENIED_BUT_EMPTY',
      'warning',
      pointer('cimdConfig', 'cimdMetadataDenyList'),
      'redirect_uris is on the deny list, so the redirect URIs of the profile are used instead of those of the client id document, and the profile has none (coreOAuth2ClientConfig.redirectionUris is empty).'
    );
  }
}

function checkAdvancedConfig(profile: Plain, schema: unknown, add: Add): void {
  const advanced = profile.advancedOAuth2ClientConfig;
  const method = valueOf(advanced, 'tokenEndpointAuthMethod');
  if (method.present) {
    const allowed =
      enumFromSchema(
        schema,
        'advancedOAuth2ClientConfig',
        'tokenEndpointAuthMethod'
      ) ?? CIMD_TOKEN_ENDPOINT_AUTH_METHODS;
    if (!allowed.includes(method.value as string)) {
      add(
        'AUTH_METHOD_NOT_ALLOWED',
        'error',
        pointer('advancedOAuth2ClientConfig', 'tokenEndpointAuthMethod'),
        `tokenEndpointAuthMethod is ${show(method.value)}; a client that is not registered has no secret, so the server accepts ${allowed.join(', ')} only.`
      );
    }
  }
  const subject = valueOf(advanced, 'subjectType');
  if (subject.present) {
    const allowed =
      enumFromSchema(schema, 'advancedOAuth2ClientConfig', 'subjectType') ??
      CIMD_SUBJECT_TYPES;
    if (!allowed.includes(subject.value as string)) {
      add(
        'ENUM_VALUE',
        'error',
        pointer('advancedOAuth2ClientConfig', 'subjectType'),
        `subjectType is ${show(subject.value)}; the values are ${allowed.join(' and ')}.`
      );
    }
  }
  const grants = valueOf(advanced, 'grantTypes');
  if (grants.present) {
    const path = pointer('advancedOAuth2ClientConfig', 'grantTypes');
    if (!Array.isArray(grants.value)) {
      add(
        'VALUE_TYPE',
        'error',
        path,
        `grantTypes must be a list of strings; the value is ${show(grants.value)}.`
      );
    } else {
      const known =
        enumFromSchema(schema, 'advancedOAuth2ClientConfig', 'grantTypes') ??
        CIMD_GRANT_TYPES;
      grants.value.forEach((grant, index) => {
        if (typeof grant === 'string' && known.includes(grant)) return;
        add(
          'GRANT_TYPE_UNKNOWN',
          'warning',
          pointer('advancedOAuth2ClientConfig', 'grantTypes', index),
          `The grant type ${show(grant)} is not one of the grant types that the server documents (${known.join(', ')}); the server accepts it.`
        );
      });
    }
  }
}
