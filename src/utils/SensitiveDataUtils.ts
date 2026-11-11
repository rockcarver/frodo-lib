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
  'code_verifier',
  'valuebase64',
];

/**
 * Names that are a credential only in a form-encoded body: the authorization code
 * of the token request of the authorization code grant. As a JSON property `code`
 * is too common a name (a country code, a status code) to hide.
 */
const SENSITIVE_FORM_FIELD_NAMES: readonly string[] = ['code'];

/** Schemes of the `Authorization` header that are not secret and stay visible. */
const AUTHORIZATION_SCHEME =
  /^(bearer|basic|digest|negotiate|ntlm|dpop|token)\s+\S/i;

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
  const lower = String(name).toLowerCase();
  return (
    SENSITIVE_HEADER_NAMES.includes(lower) ||
    extraNames.some((extra) => String(extra).toLowerCase() === lower)
  );
}

/**
 * Whether the value of a body field is a credential.
 * @param {string} name field name, in any case
 * @returns {boolean} true if the value must not be printed
 */
export function isSensitiveFieldName(name: string): boolean {
  return SENSITIVE_FIELD_NAMES.includes(String(name).toLowerCase());
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
