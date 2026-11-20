/**
 * What counts as a credential in a request, and how a copy of it that is meant
 * to be read by a person is made safe.
 *
 * There is one list of sensitive header names and one of sensitive body fields,
 * and every place that prints or records a request uses them: the curl lines of
 * `curlirize` (`api/BaseApi.ts`) and the recordings of the tests
 * (`utils/PollyUtils.ts`). A name that belongs in a list is added here and
 * nowhere else.
 */

/** The text that takes the place of a value that must not be printed. */
export const REDACTED = '<redacted>';

/**
 * Header names, in lower case, whose values are credentials. Header names are
 * case-insensitive, so every comparison lowers the name first. The names of the
 * header overrides a caller configured are not listed here: they are user-defined
 * and are added at the call site (see `isSensitiveHeaderName`).
 *
 * frodo-cli keeps a deliberate copy of this list, of the names of the fields of an
 * authorization exchange and of the rules for bearer values, JSON web tokens and
 * the user info of URLs in its `src/utils/McpResultScrub.ts` (`SENSITIVE_HEADER_NAMES`,
 * `EXCHANGE_NAMES`): a change to one of them here is made there too.
 */
export const SENSITIVE_HEADER_NAMES: readonly string[] = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-openam-password',
  'x-openidm-password',
  'x-api-key',
  'x-api-secret',
  'api-key',
  'ocp-apim-subscription-key',
  'x-auth-token',
  // AM accepts the session token in a header that is named like the session
  // cookie (logout, session validation); the default name is listed, the name of
  // a deployment is added at the call site with the other user-defined names
  'iplanetdirectorypro',
];

/**
 * Field names, in lower case, whose values are credentials when they appear in a
 * request body: as a JSON property or as a name of a form-encoded body.
 */
export const SENSITIVE_FIELD_NAMES: readonly string[] = [
  'password',
  'userpassword',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'secret',
  'client_secret',
  'clientsecret',
  'assertion',
  'access_token',
  'id_token',
  'refresh_token',
  'subject_token',
  'actor_token',
  'tokenid',
  // the session token, sent as the csrf field of the authorization request
  'csrf',
  'accesskey',
  // the state of an authentication flow, sent back with every answer to it
  'authid',
  'code_verifier',
  'valuebase64',
  // the other spellings of a credential that a body, a configuration or a form may use
  // the same names written with a separator, which a text is read for as it is written
  'user_password',
  'new_password',
  'old_password',
  'current_password',
  'access_key',
  'token_id',
  'auth_id',
  'token',
  'session_token',
  'api_key',
  'private_key',
  'secret_key',
  'password_hash',
  'passphrase',
  'passwd',
  'pwd',
  'pass',
  'jwt',
  'bearer',
  'credential',
  'credentials',
  // compound names of a secret that does not end in one of the words of `SECRET_NAME_ENDINGS`
  // (the names that end in `token` or `key` stay exact: `nextPageToken` and `sortKey` are no secrets)
  'password_confirm',
  'github_token',
  'gitlab_token',
  'auth_token',
  'api_token',
  'slack_token',
  'bearer_token',
  'secret_access_key',
  'aws_secret_access_key',
  // the other spellings of the repeated password and of the short forms of a password
  'password_confirmation',
  'password_repeat',
  'password_retype',
  'db_pass',
  'root_pass',
  'admin_pass',
  'user_pass',
  // a secret that is a value, a token or a key, by its name
  'secret_value',
  'client_secret_value',
  'password_value',
  'secret_token',
  'api_secret_key',
  'client_secret_key',
  'reset_token',
  'invite_token',
  'verification_token',
  'personal_access_token',
  'oauth_token',
  'csrf_token',
  'authorization_token',
  'signing_key',
  'hmac_key',
  'encryption_key',
  'master_key',
  'private_key_pem',
  'license_key',
  'otp',
  'pin',
];

/**
 * The words that a name of a secret may end in, in the form that {@link normalizeName} writes:
 * `dbPassword`, `DB_PASSWORD`, `PGPASSWORD`, `webhookSecret`, `apiPassphrase`, `bindCredentials`
 * and `smtp.password` are names of a secret. The other names are compared exactly (with the
 * compound names that are listed above), so that `nextPageToken` and `sortKey` stay visible. The
 * names are matched by a list and an ending rule: they are not exhaustive.
 */
export const SECRET_NAME_ENDINGS: readonly string[] = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'passphrase',
  'credentials',
];

/**
 * Whether a normalized name ends in one of the words of a secret.
 * @param {string} key a name, as {@link normalizeName} writes it
 * @returns {boolean} true if the name is the name of a secret
 */
function endsInSecretWord(key: string): boolean {
  return SECRET_NAME_ENDINGS.some((ending) => key.endsWith(ending));
}

/**
 * Names that are sensitive only in a form-encoded body (and in the query of a
 * URL): the authorization code of the code grant. As a JSON property it is too
 * common a name (a country code, a status code) to hide.
 */
const SENSITIVE_FORM_FIELD_NAMES: readonly string[] = ['code'];

/** Schemes of the `Authorization` header that are not secret and stay visible. */
const AUTHORIZATION_SCHEME =
  /^(bearer|basic|digest|negotiate|ntlm|dpop|token)\s+\S/i;

/**
 * A name as it is compared: in lower case, without hyphens, underscores, dots
 * and blanks, so that `accessToken`, `access-token`, `access_token` and
 * `ACCESS_TOKEN` are one name. This is the one function that the headers, the
 * fields of a body and the view of an error compare names with.
 * @param {string} name a header name, a field name or a key
 * @returns {string} the name to compare
 */
export function normalizeName(name: string): string {
  return String(name)
    .toLowerCase()
    .replace(/[-_.\s]/g, '');
}

const normalizedLists = new WeakMap<
  readonly string[],
  { size: number; last: string | undefined; names: Set<string> }
>();

/** The names of a list, normalized; read again when the list changed. */
function normalizedNames(list: readonly string[]): Set<string> {
  const known = normalizedLists.get(list);
  if (known && known.size === list.length && known.last === list.at(-1)) {
    return known.names;
  }
  const names = new Set(list.map(normalizeName));
  normalizedLists.set(list, { size: list.length, last: list.at(-1), names });
  return names;
}

/**
 * Whether the value of a header is a credential.
 * @param {string} name header name, in any case
 * @param {readonly string[]} extraNames more header names to treat as sensitive,
 * for example the names of the header overrides in the state
 * @returns {boolean} true if the value must not be printed
 */
export function isSensitiveHeaderName(
  name: string,
  extraNames: readonly string[] = []
): boolean {
  const key = normalizeName(name);
  return (
    normalizedNames(SENSITIVE_HEADER_NAMES).has(key) ||
    endsInSecretWord(key) ||
    extraNames.some((extra) => normalizeName(extra) === key)
  );
}

/**
 * Whether the value of a body field is a credential.
 * @param {string} name field name, in any case, with or without hyphens and underscores
 * @returns {boolean} true if the value must not be printed
 */
export function isSensitiveFieldName(name: string): boolean {
  const key = normalizeName(name);
  return (
    normalizedNames(SENSITIVE_FIELD_NAMES).has(key) || endsInSecretWord(key)
  );
}

/**
 * Whether a name is that of a sensitive field or of a sensitive header.
 * @param {string} name a key of a body or a header name
 * @returns {boolean} true if the value under it must not be printed
 */
export function isSensitiveName(name: string): boolean {
  const key = normalizeName(name);
  return (
    normalizedNames(SENSITIVE_FIELD_NAMES).has(key) ||
    normalizedNames(SENSITIVE_HEADER_NAMES).has(key) ||
    endsInSecretWord(key)
  );
}

/**
 * Replaces the value of a sensitive header by a placeholder and keeps what is
 * not secret: the scheme of an `Authorization` value (`Bearer <redacted>`) and
 * the names of the cookies (`iPlanetDirectoryPro=<redacted>`). An empty value is
 * returned as it is.
 * @param {string} name header name, in any case
 * @param {unknown} value header value
 * @returns {string} the value to print
 */
export function redactHeaderValue(name: string, value: unknown): string {
  const text = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  if (text === '') return text;
  const lower = String(name).toLowerCase();
  if (lower === 'cookie' || lower === 'set-cookie') {
    return text
      .split(';')
      .map((part) => {
        const equals = part.indexOf('=');
        return equals === -1
          ? REDACTED
          : `${part.slice(0, equals).trim()}=${REDACTED}`;
      })
      .join('; ');
  }
  if (lower === 'authorization' || lower === 'proxy-authorization') {
    const scheme = AUTHORIZATION_SCHEME.exec(text);
    if (scheme) return `${scheme[1]} ${REDACTED}`;
  }
  return REDACTED;
}

/**
 * Replaces the sensitive values in a URL as it is printed: the password of the
 * user info (`https://user:<redacted>@host`, `//user:<redacted>@host` without a
 * scheme, and the whole user info when it has no colon, because then it is the
 * value itself) and the value of every
 * sensitive name in the query and in the fragment (`?access_token=<redacted>`).
 * The user info ends at the last `@` of the authority, as a URL parser reads it.
 * Everything else is kept as it is, also a URL that cannot be parsed.
 * @param {string} url the URL, absolute or relative
 * @returns {string} the URL to print
 */
export function redactUrl(url: string): string {
  let text = String(url);
  text = text.replace(
    /^((?:[a-z][a-z0-9+.-]*:)?\/\/)([^/?#]*)@/i,
    (_match, scheme: string, userInfo: string) => {
      const colon = userInfo.indexOf(':');
      return colon === -1
        ? `${scheme}${REDACTED}@`
        : `${scheme}${userInfo.slice(0, colon)}:${REDACTED}@`;
    }
  );
  const redactPart = (part: string) => redactForm(part).data as string;
  const hash = text.indexOf('#');
  const fragment = hash === -1 ? undefined : text.slice(hash + 1);
  if (hash !== -1) text = text.slice(0, hash);
  const question = text.indexOf('?');
  const query = question === -1 ? undefined : text.slice(question + 1);
  if (question !== -1) text = text.slice(0, question);
  return (
    text +
    (query === undefined ? '' : `?${redactPart(query)}`) +
    (fragment === undefined ? '' : `#${redactPart(fragment)}`)
  );
}

/** The characters that end a URL in a text: white space, a quote, an angle bracket or a closing bracket. */
const URL_BODY_END = /[\s'"<>)\]]/;

/** The longest scheme that {@link scrubUrls} reads before `://`. */
const MAX_SCHEME_LENGTH = 32;

/**
 * Replaces the sensitive values of every URL in a text (see {@link redactUrl}),
 * and the password of the user info that stands without a scheme
 * (`user:password@host`, `//user:password@host`, see {@link scrubUserInfo}).
 * A single scan: it looks for `://`, reads the scheme before it and the URL after
 * it up to a character that ends a URL, and never goes back over text that it
 * has read, so the time grows with the length of the text and not with its
 * shape (a text of dotted words, of `://` or of `@` is no slower than any other).
 * @param {string} text the text, for example the message of an error
 * @returns {string} the text with the URLs redacted
 */
export function scrubUrls(text: string): string {
  let result = '';
  let from = 0;
  for (;;) {
    const separator = text.indexOf('://', from);
    if (separator === -1) break;
    let start = separator;
    while (
      start > from &&
      separator - start < MAX_SCHEME_LENGTH &&
      /[a-z0-9+.-]/i.test(text[start - 1])
    ) {
      start--;
    }
    // a scheme starts with a letter
    while (start < separator && !/[a-z]/i.test(text[start])) start++;
    if (start === separator) {
      result += text.slice(from, separator + 3);
      from = separator + 3;
      continue;
    }
    const end = endOfUrl(text, separator + 3);
    result += text.slice(from, start) + redactUrl(text.slice(start, end));
    from = end;
  }
  return scrubUserInfo(result + text.slice(from));
}

/** The characters of the user info of a URL that has no scheme in front of it. */
const USER_INFO_CHARACTER = /[^\s/@'"<>()[\]{},;=?#&`\\]/;

/** The start of what follows the at sign of the digest of an image (`image:tag@sha256:...`), which is no host. */
const DIGEST = /^(?:sha(?:1|224|256|384|512)|md5):/i;

/** The characters that end the authority of a URL in a text: white space, a quote, an angle bracket, `/`, `?`, `#` and a backslash. */
const AUTHORITY_END = /[\s/?#'"<>`\\]/;

/**
 * Where the URL that starts at `begin` (after its `://`) ends in a text. The
 * user info goes up to the last at sign of the authority, which ends at a
 * character of {@link AUTHORITY_END} or in front of the scheme of a second URL
 * that is joined to it, so a password may hold the characters that end a URL in
 * running text (a parenthesis, a bracket, a comma): when the authority holds an
 * at sign, the URL is read to the end of the authority at least. A second URL
 * that is joined to the first one is no part of it: it is read as its own.
 * @param {string} text the text
 * @param {number} begin where the authority starts (after the `://`)
 * @returns {number} where the URL ends
 */
function endOfUrl(text: string, begin: number): number {
  let end = begin;
  let lastAt = -1;
  let second = -1;
  while (end < text.length && !AUTHORITY_END.test(text[end])) {
    if (text[end] === ':' && text.startsWith('//', end + 1) && end > begin) {
      // a second URL begins here (`a@h1http://b:c@h2`): this authority ends in front of its scheme
      second = end;
      while (
        second > begin &&
        end - second < MAX_SCHEME_LENGTH &&
        /[a-z0-9+.-]/i.test(text[second - 1])
      ) {
        second--;
      }
      while (second < end && !/[a-z]/i.test(text[second])) second++;
      break;
    }
    if (text[end] === '@') lastAt = end;
    end++;
  }
  // what is read of the URL is read once: a text of many URLs costs what its length costs
  if (second !== -1) {
    return lastAt === -1 ? endOfUrlBody(text, begin, second) : second;
  }
  const bodyEnd = endOfUrlBody(text, begin, text.length);
  return lastAt === -1 || end <= bodyEnd
    ? bodyEnd
    : endOfUrlBody(text, end, text.length);
}

/**
 * Where the characters of a URL in a text end, from `from` on and not past
 * `limit`: at white space, a quote, an angle bracket or a closing bracket.
 * @param {string} text the text
 * @param {number} from where to start reading
 * @param {number} limit where to stop reading
 * @returns {number} the end
 */
function endOfUrlBody(text: string, from: number, limit: number): number {
  let end = from;
  while (end < limit && !URL_BODY_END.test(text[end])) end++;
  return end;
}

/** The longest user info that {@link scrubUserInfo} reads in front of an at sign. */
const MAX_USER_INFO_LENGTH = 256;

/**
 * Replaces the password of the user info that a text holds without a scheme in
 * front of it: `user:password@host` and `//user:password@host`. It looks at each
 * at sign once and reads at most {@link MAX_USER_INFO_LENGTH} characters back from
 * it, so the time grows with the length of the text and not with its shape. What
 * stands in front of the at sign has to hold a colon with something after it,
 * and a host has to follow (`user:password@ ` is not a user info; nor is the
 * address of a mail, which has no colon; nor is the digest of an image,
 * `image:tag@sha256:...`).
 *
 * A token of that shape in a harmless text is replaced as well: `time 12:30@room5`
 * becomes `12:<redacted>@room5`, and `host:8080@x`, `<john:smith@corp.com>` and
 * `@scope/pkg:1.0.0@next` the same. This is a limit that is taken on purpose:
 * the text is the text of an error, and a value that looks like a password is
 * better replaced than shown. A user info that is longer than
 * {@link MAX_USER_INFO_LENGTH} characters, or farther from its at sign, is not read.
 * @param {string} text the text, for example the message of an error
 * @returns {string} the text with the passwords of such user info replaced
 */
function scrubUserInfo(text: string): string {
  let result = '';
  let from = 0;
  let at = text.indexOf('@');
  // the authority that the last scan read: where it ended and where its last at sign is
  let regionEnd = -1;
  let regionLastAt = -1;
  while (at !== -1) {
    let start = at;
    while (
      start > from &&
      at - start < MAX_USER_INFO_LENGTH &&
      USER_INFO_CHARACTER.test(text[start - 1])
    ) {
      start--;
    }
    const userInfo = text.slice(start, at);
    const colon = userInfo.indexOf(':');
    if (
      colon !== -1 &&
      colon < userInfo.length - 1 &&
      userInfo.slice(0, colon).toLowerCase() !== 'mailto' &&
      !DIGEST.test(text.slice(at + 1, at + 12))
    ) {
      // the user info ends at the last at sign of the authority, as a URL is read: a password may hold one
      if (at >= regionEnd) {
        regionLastAt = at;
        regionEnd = at + 1;
        while (
          regionEnd < text.length &&
          !AUTHORITY_END.test(text[regionEnd])
        ) {
          if (text[regionEnd] === '@') regionLastAt = regionEnd;
          regionEnd++;
        }
      }
      if (/[a-z0-9[]/i.test(text[regionLastAt + 1] ?? '')) {
        result += `${text.slice(from, start + colon + 1)}${REDACTED}`;
        from = regionLastAt;
        at = regionLastAt;
      }
    }
    at = text.indexOf('@', at + 1);
  }
  return result + text.slice(from);
}

/** A body with its credentials replaced, and whether there were any. */
export type RedactedBody = { data: unknown; found: boolean };

type Context = { found: boolean; seen: WeakSet<object> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSecretValue(value: unknown): boolean {
  return (
    (typeof value === 'string' && value !== '') || typeof value === 'number'
  );
}

function isPasswordCallback(value: Record<string, unknown>): boolean {
  return (
    typeof value.type === 'string' && /passwordcallback$/i.test(value.type)
  );
}

/**
 * The answer to a password callback of a journey is a list of `{ name, value }`
 * pairs in `input`, and the value is the password: no field name says so.
 */
function redactCallbackInput(value: unknown, context: Context): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    if (!isPlainObject(entry) || !isSecretValue(entry.value)) return entry;
    context.found = true;
    return { ...entry, value: REDACTED };
  });
}

function redactJson(
  value: unknown,
  context: Context,
  underSensitiveName = false
): unknown {
  if (Array.isArray(value)) {
    if (context.seen.has(value)) return value;
    context.seen.add(value);
    return value.map((item) => redactJson(item, context, underSensitiveName));
  }
  if (isPlainObject(value)) {
    if (context.seen.has(value)) return value;
    context.seen.add(value);
    const callback = isPasswordCallback(value);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] =
        callback && key === 'input'
          ? redactCallbackInput(item, context)
          : redactJson(item, context, isSensitiveFieldName(key));
    }
    return result;
  }
  if (underSensitiveName && isSecretValue(value)) {
    context.found = true;
    return REDACTED;
  }
  return value;
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return text;
  }
}

function redactForm(data: string): RedactedBody {
  let found = false;
  const redacted = data.replace(
    /(^|&)([^=&]+)=([^&]*)/g,
    (match, separator: string, name: string, value: string) => {
      const field = decode(name).toLowerCase();
      if (
        value !== '' &&
        // the name of a field of a form has no blank in it (a text that holds a sentence before
        // the equals sign is no form, and a name that ends in a word of a secret would match it)
        !/\s/.test(name) &&
        (isSensitiveFieldName(field) ||
          SENSITIVE_FORM_FIELD_NAMES.includes(field))
      ) {
        found = true;
        return `${separator}${name}=${REDACTED}`;
      }
      return match;
    }
  );
  return { data: found ? redacted : data, found };
}

/**
 * Replaces the credentials in a request body: JSON properties (also in a body
 * that is a JSON string), the answer to a password callback, and the sensitive
 * names of a form-encoded string (`assertion=...&client_id=...`). Anything else is
 * returned as it is, and the input is never changed.
 * @param {unknown} data request body as the caller passed it to the client
 * @returns {RedactedBody} the body to print and whether it held a credential
 */
export function redactBody(data: unknown): RedactedBody {
  if (typeof data === 'string') {
    const start = data.trimStart()[0];
    if (start === '{' || start === '[') {
      try {
        const context: Context = { found: false, seen: new WeakSet() };
        const redacted = redactJson(JSON.parse(data), context);
        return context.found
          ? { data: JSON.stringify(redacted), found: true }
          : { data, found: false };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // not JSON after all: read it as form data
      }
    }
    return redactForm(data);
  }
  const context: Context = { found: false, seen: new WeakSet() };
  const redacted = redactJson(data, context);
  return { data: context.found ? redacted : data, found: context.found };
}

/** Escapes a name for use in a regular expression. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The names whose value is sensitive when it follows `name: ` or `name=`: the
 * sensitive body fields and header names of this module, the one place that
 * lists them.
 */
const NAMES_IN_TEXT = [
  ...new Set(
    [...SENSITIVE_FIELD_NAMES, ...SENSITIVE_HEADER_NAMES].flatMap((name) => [
      name,
      // the spellings that `normalizeName` reads as the same name: `access_token`, `access-token`, `accessToken`
      name.replace(/[-_.]/g, ''),
      name.replace(/[-.]/g, '_'),
      name.replace(/[_.]/g, '-'),
    ])
  ),
]
  .sort((left, right) => right.length - left.length)
  .map(escapeRegExp)
  .join('|');

/**
 * Where a name of a text may start: not in a word or after a hyphen, or after the escape
 * of a line break or a tab (`\n`, `\r`, `\t`) that a text holds when it was written as a
 * string (`line one\npassword=...`).
 */
const NAME_START = '(?:(?<![\\w-])|(?<=\\\\[nrt]))';

/**
 * A name of a secret as a text writes it: a word that ends in one of the words of
 * {@link SECRET_NAME_ENDINGS} (`DB_PASSWORD`, `PGPASSWORD`, `webhookSecret`, `--password`),
 * or one of the names of the lists (with the hyphens of a flag in front). The part in front of the ending is one word (letters,
 * digits, `_` and `-`, so that a dot ends it), which keeps the expression linear.
 */
const NAME_IN_TEXT = `(?:[A-Za-z0-9_-]*?(?:${SECRET_NAME_ENDINGS.map(escapeRegExp).join('|')})|-{0,2}(?:${NAMES_IN_TEXT}))`;

/**
 * `name: value`, `name=value` and `"name":"value"` for a sensitive name, also as
 * a JSON text inside a string writes it (`\"name\":\"value\"`), `user[name]=value`, `user[name][confirm]=value` and `name[0]=value`. A value in quotes
 * may hold an escaped quote, and may not be closed: a text that was cut ends in
 * the middle of it. The loops are unrolled (`a*(?:b a*)*`), so that a value of
 * many megabytes does not run the stack of the engine out.
 */
const NAMED_VALUE = new RegExp(
  `${NAME_START}(${NAME_IN_TEXT})(\\\\?["']?(?:\\]|\\[[\\w-]{0,16}\\])*\\s*(?:=>|[:=])\\s*)(?:(?:bearer|basic|digest|negotiate|ntlm|dpop|token)\\s+)?("[^"\\\\]*(?:\\\\[\\s\\S][^"\\\\]*)*"?|'[^'\\\\]*(?:\\\\[\\s\\S][^'\\\\]*)*'?|\\\\"[^"\\\\]*(?:\\\\(?!")[^"\\\\]*)*(?:\\\\")?|[^\\s"'&,;}\\])]+)`,
  'gi'
);

/**
 * A command line flag that names a secret and is followed by its value after blanks
 * (`--password S`, `--client-secret "a b"`). The value does not start with a hyphen (it is no
 * flag). `-p S` and `-pS` are not read: a single letter after one hyphen is too common to be
 * the name of a secret.
 */
const FLAG_VALUE = new RegExp(
  `${NAME_START}(--${NAME_IN_TEXT})([ \\t]+)(?!-)("[^"]*"?|'[^']*'?|[^\\s"']+)`,
  'gi'
);

/**
 * A string in quotes as a text writes it, as a JSON text inside a string writes it
 * (`\"..\"`), and one that is not closed (the text was cut): the quote, what is in it
 * (an escape is one unit), the quote if there is one. The loops are unrolled, so that
 * a string of many megabytes does not run the stack of the engine out.
 */
const QUOTED_VALUE =
  '"[^"\\\\]*(?:\\\\[\\s\\S][^"\\\\]*)*"?|\'[^\'\\\\]*(?:\\\\[\\s\\S][^\'\\\\]*)*\'?|\\\\"[^"\\\\]*(?:\\\\(?!")[^"\\\\]*)*(?:\\\\")?';

/**
 * The input of a callback of an authentication journey: `"name":"IDToken2","value":"..."`,
 * also as a JSON text inside a string writes it. A text that holds one and is too long
 * to be read as structure (see `MAX_STRUCTURED_TEXT` of the view) is still written with
 * the value replaced. A user name that is the answer to a name callback is replaced as well.
 */
const CALLBACK_INPUT = new RegExp(
  `(IDToken\\d+(?:\\\\?["'])?\\s*,\\s*\\\\?["']?value(?:\\\\?["'])?\\s*:\\s*)(${QUOTED_VALUE})`,
  'gi'
);

/** A text that has a password callback in it, of any journey (`PasswordCallback`, `ValidatedCreatePasswordCallback`). */
const PASSWORD_CALLBACK = /passwordcallback/i;

/**
 * Every `"value"` of a text that has a password callback in it. The answer to the
 * callback is the `value` of an input, whatever the input is called, whichever comes
 * first, and whatever stands between: the structure of a text that is read as
 * structure says so, a text that is only written (too long, or the head of one) has
 * no structure to read, so every `"value"` that it holds is replaced (the prompt of
 * the callback too, which is no secret and does no harm).
 */
const CALLBACK_VALUE = new RegExp(
  `(\\\\?["']value\\\\?["']\\s*:\\s*)(${QUOTED_VALUE})`,
  'gi'
);

/** A bearer value wherever it appears. */
const BEARER_VALUE =
  /\b(bearer)\s+[A-Za-z0-9\-._~+/]{8}[A-Za-z0-9\-._~+/]*=*/gi;

/** `Basic` and a base64 text: replaced when the text decodes to a user name and a password (see {@link replaceBasicValue}). */
const BASIC_VALUE = /\b(basic)\s+([A-Za-z0-9+/]{8,}={0,2})/gi;

/**
 * The value that follows `Basic`, when it is the base64 of `user:password`: a
 * word that follows the word `Basic` (`Basic authentication`) decodes to bytes
 * that are no login.
 * @param {string} match what was found
 * @param {string} scheme `Basic`, as it was written
 * @param {string} encoded the base64 text
 * @returns {string} the text to put in its place
 */
function replaceBasicValue(
  match: string,
  scheme: string,
  encoded: string
): string {
  const login = Buffer.from(encoded, 'base64').toString('latin1');
  return login.includes(':') && !hasControlCharacter(login)
    ? `${scheme} ${REDACTED}`
    : match;
}

/** Whether a text holds a control character (a login does not). */
function hasControlCharacter(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/** A PEM private key, up to its end line or the end of the text. */
const PRIVATE_KEY =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g;

/** The shortest part, from `eyJ` on, that is the header of a JSON web token. */
const MIN_TOKEN_HEADER_LENGTH = 'eyJ'.length + 4;

/** The shortest part that can be the payload of a JSON web token. */
const MIN_TOKEN_PART_LENGTH = 4;

/** A run of the characters that a JSON web token is made of, dots included. */
const TOKEN_RUN = /[A-Za-z0-9_.-]+/g;

/**
 * Whether the text decodes (base64url) as a JSON object, as the header of a
 * token does. It decides about a token that something sticks to (`kid-eyJ...`):
 * a word that merely holds `eyJ` (`surveyJobsList`) does not decode as JSON.
 * @param {string} text the part that starts with `eyJ`
 * @returns {boolean} whether it is the header of a token
 */
function decodesAsJson(text: string): boolean {
  try {
    const decoded = Buffer.from(
      text.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    // an object ends with a brace: most words that hold eyJ fail here, without the cost of a failed parse
    if (!decoded.trimEnd().endsWith('}')) return false;
    const value: unknown = JSON.parse(decoded);
    return value !== null && typeof value === 'object';
  } catch {
    return false;
  }
}

/**
 * Replaces the JSON web tokens in a text: three parts (or two) of base64url
 * characters, the first starting with `eyJ`; something may be stuck to it
 * (`kid-eyJ...`), which stays when the header decodes as JSON. It reads the text
 * as maximal runs of token characters and looks at each run once, so that a run
 * of `eyJ` or of dots costs no more than any other text.
 * @param {string} text the text
 * @returns {string} the text with the tokens replaced
 */
function redactJsonWebTokens(text: string): string {
  return text.replace(TOKEN_RUN, (run) => {
    if (run.length < 12 || !run.includes('eyJ')) return run;
    const parts = run.split('.');
    const written: string[] = [];
    let changed = false;
    for (let index = 0; index < parts.length;) {
      const part = parts[index];
      const at = part.indexOf('eyJ');
      if (
        at !== -1 &&
        index + 1 < parts.length &&
        // the parts of a run hold letters, digits, `_` and `-` only (see TOKEN_RUN): their length is all that is asked
        part.length - at >= MIN_TOKEN_HEADER_LENGTH &&
        parts[index + 1].length >= MIN_TOKEN_PART_LENGTH &&
        (at === 0 || decodesAsJson(part.slice(at)))
      ) {
        // a third part follows, empty or not, as in `header.payload.` of an unsecured token
        written.push(`${part.slice(0, at)}${REDACTED}`);
        index += index + 2 < parts.length ? 3 : 2;
        changed = true;
      } else {
        written.push(part);
        index++;
      }
    }
    return changed ? written.join('.') : run;
  });
}

/**
 * Replaces the sensitive values that the text of an error may contain: values of
 * sensitive names (`password=...`, `"access_token":"..."`, `Authorization:
 * Bearer ...`), bearer values, JSON web tokens, the sensitive values of a URL
 * (see {@link scrubUrls}) and private keys. The messages of the library state
 * facts, but an error nested in them may echo a request or a response.
 *
 * Every step is linear in the length of the text.
 * @param {string} text the text of an error
 * @returns {string} the text with the values replaced by a placeholder
 */
export function redactCredentials(text: string): string {
  try {
    return redactAll(text);
  } catch {
    // a step that fails (an expression runs out of the stack of the engine on a text of many
    // megabytes) never passes the text on as it is
    return REDACTED;
  }
}

function redactAll(text: string): string {
  const redacted = redactJsonWebTokens(
    scrubUrls(text.replace(PRIVATE_KEY, REDACTED))
      .replace(BEARER_VALUE, `$1 ${REDACTED}`)
      .replace(BASIC_VALUE, replaceBasicValue)
  )
    .replace(
      NAMED_VALUE,
      (_match, name: string, separator: string, value: string) => {
        // a value in quotes keeps them (also the quotes that a JSON text inside a string writes
        // as a backslash and a quote), so that a JSON text stays JSON
        const quote = value.startsWith('\\"')
          ? '\\"'
          : value[0] === '"' || value[0] === "'"
            ? value[0]
            : '';
        return `${name}${separator}${quote}${REDACTED}${quote}`;
      }
    )
    .replace(
      FLAG_VALUE,
      (_match, flag: string, gap: string) => `${flag}${gap}${REDACTED}`
    )
    .replace(CALLBACK_INPUT, replaceQuotedValue);
  // asked once for the whole text: a text with a password callback has every `value` replaced
  return PASSWORD_CALLBACK.test(redacted)
    ? redacted.replace(CALLBACK_VALUE, replaceQuotedValue)
    : redacted;
}

/** A value in quotes replaced, with the quotes it had. */
function replaceQuotedValue(
  _match: string,
  prefix: string,
  value: string
): string {
  const quote = value.startsWith('\\"')
    ? '\\"'
    : value[0] === '"' || value[0] === "'"
      ? value[0]
      : '';
  return `${prefix}${quote}${REDACTED}${quote}`;
}
