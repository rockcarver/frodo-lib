import { FrodoError } from '../ops/FrodoError';
import { allForms, failure } from '../test/utils/SerializationForms';
import {
  SENSITIVE_FIELD_NAMES,
  SENSITIVE_HEADER_NAMES,
} from './SensitiveDataUtils';

/** The compound names of a secret (a word of a secret at the end of the name), in the spellings of configurations, environments and command lines. */
const COMPOUND_NAMES = [
  'dbPassword',
  'adminPassword',
  'smtpPassword',
  'bindPassword',
  'rootPassword',
  'passwordConfirm',
  'confirmPassword',
  'webhookSecret',
  'signingSecret',
  'sharedSecret',
  'githubToken',
  'authToken',
  'apiToken',
  'slack_token',
  'AWS_SECRET_ACCESS_KEY',
  'DB_PASSWORD',
  'MYSQL_ROOT_PASSWORD',
  'PGPASSWORD',
  'secretAccessKey',
  'oldPwd',
  'X-Db-Password',
  'password_confirmation',
  'passwordConfirmation',
  'password_repeat',
  'passwordRetype',
  'DB_PASS',
  'dbpass',
  'rootPass',
  'adminPass',
  'userPass',
  'bindCredentials',
  'userCredentials',
  'apiPassphrase',
  'secretValue',
  'clientSecretValue',
  'passwordValue',
  'secretToken',
  'apiSecretKey',
  'clientSecretKey',
  'resetToken',
  'inviteToken',
  'verificationToken',
  'personalAccessToken',
  'oauthToken',
  'csrfToken',
  'signingKey',
  'hmacKey',
  'encryptionKey',
  'masterKey',
  'privateKeyPem',
  'licenseKey',
  'Authorization-Token',
  'otp',
  'pin',
];

/** The names under which a value is a credential: fields of a body and headers, and the compound names. */
const NAMES = [
  ...SENSITIVE_FIELD_NAMES,
  ...SENSITIVE_HEADER_NAMES,
  ...COMPOUND_NAMES,
];

/** A name in one of the spellings that are read as the same name: with hyphens, underscores, in camel case, in upper case. */
function spelled(random: () => number, name: string): string {
  const words = name.split(/[-_]/);
  const upper = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
  const variants = [
    name,
    words.join('-'),
    words.join('_'),
    words.join(''),
    words.map((word, i) => (i === 0 ? word : upper(word))).join(''),
    words.map(upper).join(''),
    name.toUpperCase(),
  ];
  return variants[Math.floor(random() * variants.length)];
}

/**
 * A property of the view of an error: a value that stands in a text that an
 * answer or a request holds is in no form that the error can be written in
 * (`JSON.stringify`, `util.inspect`, `console.log`, `%j`, the combined message
 * of the view, and the others of `allForms`).
 *
 * What the generator covers: texts that are JSON (an object, a list, a pair of a
 * name and a value, a pair list, the answer to a password callback in a dozen
 * shapes), JSON inside strings inside strings (0 to 8 levels, a string literal),
 * JSON written with HTML entities or percent encoding, an XML element or an
 * HTML field of a credential, a value of several lines (in JSON, XML and HTML), a
 * list that holds a name and its value among other members (the flat raw headers
 * of a request), pretty-printed JSON (a name and its value, a pair list, an object),
 * XML with the value on its own line, an environment variable line and a command line
 * flag; a name in every spelling (`accessToken`,
 * `access-token`, `ACCESS_TOKEN`, and the compound names `dbPassword`, `DB_PASSWORD`,
 * `webhookSecret`) and a value of any kind (quotes, backslashes,
 * brackets, braces, control characters, surrogates, escapes), valid or not, with a
 * prefix, a suffix and one corruption, of any length around every bound, in eleven
 * places (the answer, the request, the detail, the message of the error, the message of an
 * original error, of a nested error, the message and the description of the answer). What it does not cover: a plain text that holds none of those forms (a
 * page, a log line, a form body), which the text rules write and the `withhold`
 * file pins.
 *
 * The number of texts is `FRODO_PROPERTY_SEEDS` (300 by default; the run of
 * 20,000 is `FRODO_PROPERTY_SEEDS=20000 npm run test:only -- ErrorSerializationUtils.property`;
 * `FRODO_PROPERTY_BASE` moves the seeds, `FRODO_PROPERTY_ONLY=9276,27877` runs only those texts of a run).
 */
const SEEDS = Number(process.env.FRODO_PROPERTY_SEEDS ?? 300);

/** The numbers of the texts to run again (`FRODO_PROPERTY_ONLY=9276,27877`): the whole text is reported. */
const ONLY = process.env.FRODO_PROPERTY_ONLY?.split(',').map(Number);

type Random = () => number;

/** A generator of numbers that is the same on every run (xorshift). */
function generator(start: number): Random {
  let seed = start >>> 0 || 1;
  return () => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 4294967296;
  };
}

const pick = <T>(random: Random, list: readonly T[]): T =>
  list[Math.floor(random() * list.length)];

/** Characters that a value may hold, and that a serializer writes with an escape or that a rule may take for the end of a value. */
const SPECIAL = [
  '"',
  '\\',
  '{',
  '}',
  '[',
  ']',
  '+',
  '%',
  '/',
  ':',
  ',',
  "'",
  '<',
  '>',
  '&',
  '=',
  ' ',
  'é',
  '😀',
  '\ud800',
  '\n',
  '\t',
  '\u0001',
  ' ',
  '"{"',
  '["',
  '{"',
  '[[',
  '\\"',
  '\\u0022',
];

/** The value: marks at both ends and in the middle, and what a value may hold in between. */
function secretOf(random: Random, index: number): string {
  const junk = () =>
    Array.from({ length: Math.floor(random() * 5) }, () =>
      pick(random, SPECIAL)
    ).join('');
  return `ZQXH${index}${junk()}ZQXM${index}${junk()}ZQXT${index}`;
}

const markersOf = (index: number) => [
  `ZQXH${index}`,
  `ZQXM${index}`,
  `ZQXT${index}`,
];

/** A string written with a unicode escape for every character that is not a letter or a digit, as a serializer may write it. */
const escapeAll = (text: string) =>
  Array.from(text)
    .map((character) =>
      /[A-Za-z0-9]/.test(character)
        ? character
        : Array.from(
            { length: character.length },
            (_, i) =>
              `\\u${character.charCodeAt(i).toString(16).padStart(4, '0')}`
          ).join('')
    )
    .join('');

/** A name with its first letter written as a unicode escape. */
const escapeFirst = (name: string) =>
  `\\u${name.charCodeAt(0).toString(16).padStart(4, '0')}${name.slice(1)}`;

type Form = (secret: string, random: Random) => string;

const callback = (input: string) =>
  `{"type":"PasswordCallback","output":[{"name":"prompt","value":"Password"}],"input":[${input}]}`;

/** The texts that hold a value, as a JSON text. */
/** The secret with a line break before its middle marker (a value of several lines). */
const lineBreak = (secret: string) => secret.replace(/ZQXM/, '\nZQXM');

/**
 * The form that is a plain text, read by the text rules: they do not read a text that is written with
 * percent escapes or entities, so this form is not encoded.
 */
const PLAIN_FORM = 'an environment variable line or a command line flag';

const FORMS: [string, Form][] = [
  [
    'a sensitive name',
    (secret, random) =>
      JSON.stringify({ [spelled(random, pick(random, NAMES))]: secret }),
  ],
  [
    'a sensitive name with an escape in it',
    (secret, random) =>
      `{"${escapeFirst(spelled(random, pick(random, NAMES)))}":${JSON.stringify(secret)}}`,
  ],
  [
    'a sensitive name, the value written with escapes',
    (secret, random) =>
      `{"${spelled(random, pick(random, NAMES))}":"${escapeAll(secret)}"}`,
  ],
  [
    'an authorization value',
    (secret) => JSON.stringify({ headers: { Authorization: secret } }),
  ],
  [
    'a callback, the name first',
    (secret) =>
      callback(`{"name":"IDToken2","value":${JSON.stringify(secret)}}`),
  ],
  [
    'a callback, the value first',
    (secret) =>
      callback(`{"value":${JSON.stringify(secret)},"name":"IDToken2"}`),
  ],
  [
    'a callback, an attribute between',
    (secret) =>
      callback(
        `{"name":"IDToken2","note":1,"value":${JSON.stringify(secret)}}`
      ),
  ],
  [
    'a callback with a name of its own',
    (secret) =>
      callback(`{"name":"prompt2","value":${JSON.stringify(secret)}}`),
  ],
  [
    'a callback, the name with an escape',
    (secret) =>
      callback(`{"name":"IDToken\\u0032","value":${JSON.stringify(secret)}}`),
  ],
  [
    'a callback, the value with escapes',
    (secret) => callback(`{"name":"IDToken2","value":"${escapeAll(secret)}"}`),
  ],
  [
    'a callback, the key is the name',
    (secret) =>
      `{"type":"PasswordCallback","IDToken2":${JSON.stringify(secret)}}`,
  ],
  [
    'a key that holds a backslash and u0070',
    (secret) => JSON.stringify({ '\\u0070assword': secret }),
  ],
  [
    'a key that holds two backslashes and u0070',
    (secret) => JSON.stringify({ '\\\\u0070assword': [secret] }),
  ],
  [
    'a callback, the value is a list',
    (secret) =>
      callback(`{"name":"IDToken2","value":[${JSON.stringify(secret)}]}`),
  ],
  [
    'a callback, the value is an object',
    (secret) =>
      callback(`{"name":"IDToken2","value":{"v":${JSON.stringify(secret)}}}`),
  ],
  [
    'a name and a value',
    (secret, random) =>
      JSON.stringify({
        id: 1,
        [pick(random, [
          'name',
          'key',
          'header',
          'field',
          'attribute',
          'propertyName',
          'headerName',
          'parameterName',
        ])]: spelled(random, pick(random, NAMES)),
        [pick(random, ['value', 'values', 'val', 'content', 'data'])]: pick(
          random,
          [secret, [secret], { x: secret }]
        ),
      }),
  ],
  [
    'a pair list',
    (secret, random) =>
      JSON.stringify(
        random() < 0.5
          ? [
              ['a', 'b'],
              [spelled(random, pick(random, NAMES)), secret],
            ]
          : [spelled(random, pick(random, NAMES)), secret]
      ),
  ],
  [
    'an XML element',
    (secret, random) => {
      const tag = pick(random, [
        'password',
        'Password',
        'passwd',
        'pwd',
        'secret',
        'client_secret',
        'accessToken',
        'token',
        'api_key',
        'credentials',
        'pass',
        'bindCredentials',
        'apiPassphrase',
      ]);
      return `<login><${tag}>${secret}</${tag}></login>`;
    },
  ],
  [
    'an HTML field',
    (secret) =>
      `<form><input type="password" name="p" value="${secret}"></form>`,
  ],
  [
    'an XML element with a line break in the value',
    (secret) => `<login><password>${lineBreak(secret)}</password></login>`,
  ],
  [
    'an HTML field with a line break in the value',
    (secret) =>
      `<form><input type="password" name="p" value="${lineBreak(secret)}"></form>`,
  ],
  [
    'a JSON text with a line break in the value',
    (secret, random) =>
      `{"${pick(random, NAMES)}":"${lineBreak(secret.replace(/["\\]/g, ''))}"}`,
  ],
  [
    'a pretty-printed name and value',
    (secret, random) =>
      JSON.stringify(
        {
          [pick(random, ['name', 'key', 'label', 'variable'])]: spelled(
            random,
            pick(random, NAMES)
          ),
          [pick(random, ['value', 'text', 'v'])]: secret,
        },
        null,
        2
      ),
  ],
  [
    'a pretty-printed pair list',
    (secret, random) =>
      JSON.stringify(
        random() < 0.5
          ? [[spelled(random, pick(random, NAMES)), secret]]
          : [spelled(random, pick(random, NAMES)), secret],
        null,
        2
      ),
  ],
  [
    'a pretty-printed object with a sensitive key',
    (secret, random) =>
      JSON.stringify(
        { a: { [spelled(random, pick(random, NAMES))]: secret } },
        null,
        2
      ),
  ],
  [
    'XML with the value on its own line',
    (secret, random) => {
      const tag = pick(random, ['password', 'Secret', 'token', 'dbPassword']);
      return `<login>\n  <${tag}>\n    ${secret}\n  </${tag}>\n</login>`;
    },
  ],
  [
    PLAIN_FORM,
    (secret, random) => {
      // the text rules read a value up to a blank, a quote or a bracket: a value of letters and digits
      const plain = secret.replace(/[^A-Za-z0-9]/g, '');
      const name = spelled(random, pick(random, NAMES));
      // a blank in front keeps the name apart from what a corruption puts at the start
      return ` ${pick(random, [
        `export ${name}=${plain}`,
        `${name}=${plain}`,
        `--${name} ${plain}`,
        `--${name}=${plain}`,
        `${name}: ${plain}`,
        `user[${name}]=${plain}`,
        `user[${name}][confirm]=${plain}`,
      ])}`;
    },
  ],
  [
    'a flat list of names and values',
    (secret, random) =>
      JSON.stringify([
        'Host',
        'example.test',
        spelled(random, pick(random, NAMES)),
        secret,
        'Accept',
        'text/plain',
      ]),
  ],
  [
    'a JSON text as the value of a sensitive name',
    (secret, random) =>
      JSON.stringify({
        [spelled(random, pick(random, NAMES))]: JSON.stringify({
          kty: 'RSA',
          d: secret,
        }),
      }),
  ],
  [
    'a list under a sensitive name',
    (secret, random) =>
      JSON.stringify({ [spelled(random, pick(random, NAMES))]: [secret] }),
  ],
  [
    'an object under a sensitive name',
    (secret, random) =>
      JSON.stringify({
        [spelled(random, pick(random, NAMES))]: { x: { y: secret } },
      }),
  ],
  [
    'a JSON list as the value of a sensitive name',
    (secret, random) =>
      JSON.stringify({
        [spelled(random, pick(random, NAMES))]: JSON.stringify([secret]),
      }),
  ],
];

/** What a text may be corrupted with: a character that JSON refuses in a string, an invalid escape, a cut followed by more text, a stray quote. */
const CORRUPTIONS: [string, (text: string, at: number) => string][] = [
  ['a raw newline', (text, at) => `${text.slice(0, at)}\n${text.slice(at)}`],
  ['a raw tab', (text, at) => `${text.slice(0, at)}\t${text.slice(at)}`],
  [
    'a control character',
    (text, at) => `${text.slice(0, at)}\u0001${text.slice(at)}`,
  ],
  [
    'an invalid escape',
    (text, at) => `${text.slice(0, at)}\\q${text.slice(at)}`,
  ],
  [
    'a partial unicode escape (not followed by a hexadecimal digit)',
    (text, at) => `${text.slice(0, at)}\\u12!${text.slice(at)}`,
  ],
  [
    'a cut followed by more text',
    (text, at) => `${text.slice(0, at)} more text {`,
  ],
  ['a stray quote', (text, at) => `${text.slice(0, at)}"${text.slice(at)}`],
];

/** A text with one corruption, at least 90 characters in front of the value or 60 behind it (or at the start). */
function corrupt(text: string, random: Random, head: string): string {
  const [, change] = pick(random, CORRUPTIONS);
  const from = text.indexOf(head);
  if (from === -1) return change(text, Math.floor(random() * text.length));
  const before = Math.max(0, from - 90 - Math.floor(random() * 40));
  const after = Math.min(text.length, from + 60 + Math.floor(random() * 60));
  return change(text, random() < 0.5 ? before : after);
}

/** How the text is wrapped: inside other texts (each one a string of an object), or as the string literal of a text; a level may be corrupted. */
function wrap(text: string, random: Random, head: string): string {
  let result = text;
  const depth = Math.floor(random() * 9);
  for (let level = 0; level < depth; level++) {
    if (random() < 0.08) result = corrupt(result, random, head);
    result = JSON.stringify({ w: result });
  }
  if (random() < 0.2) result = JSON.stringify(result);
  if (random() < 0.05) result = JSON.stringify(result);
  return result;
}

/** The lengths that a text is made as long as: around every bound of the view. */
const SIZES = [
  0, 300, 1_000, 4_100, 8_100, 8_300, 16_300, 16_500, 20_000, 65_000, 65_536,
  65_600, 100_000, 200_000, 700_000,
];

const sizeOf = (random: Random) =>
  random() < 0.03 ? 1_000_000 : pick(random, SIZES);

/** Padding at the end of an object or a list, so that the text is about as long as asked. */
function pad(text: string, length: number): string {
  const last = text.at(-1);
  const missing = length - text.length;
  if (missing < 10 || (last !== '}' && last !== ']')) return text;
  return last === '}'
    ? `${text.slice(0, -1)},"pad":"${'x'.repeat(missing - 10)}"}`
    : `${text.slice(0, -1)},"${'x'.repeat(missing - 4)}"]`;
}

const PREFIXES = [
  '',
  '',
  '',
  'Invalid value:\n',
  'Error: ',
  'data: ',
  ' '.repeat(70),
  '﻿',
  '"',
  'Unexpected " in: ',
  ' '.repeat(300),
  '[INFO] ',
];
const SUFFIXES = ['', '', '', '}}', ' {', '"', ']', '\n'];

type Place = [string, (text: string) => FrodoError];

const failed = (options: Parameters<typeof failure>[0]) =>
  new FrodoError('Error reading', failure(options));

/** Where the text stands in what the server answered or in what was sent. */
const PLACES: Place[] = [
  [
    'a value of the answer',
    (text) => failed({ responseData: { detail: { echo: text }, code: 400 } }),
  ],
  [
    'an item of a list',
    (text) => failed({ responseData: { detail: [text, 1] } }),
  ],
  ['the detail', (text) => failed({ responseData: { detail: text } })],
  ['the body, a text', (text) => failed({ responseData: text })],
  ['the request, a text', (text) => failed({ data: text })],
  ['the request, a value', (text) => failed({ data: { q: { echo: text } } })],
  [
    'the message of the error',
    (text) => new FrodoError(text, failure({ responseData: { code: 400 } })),
  ],
  [
    'the message of an original error',
    (text) => new FrodoError('Error reading', new Error(text)),
  ],
  [
    'the message of a nested error',
    (text) =>
      new FrodoError(
        'Error reading',
        new FrodoError(text, failure({ responseData: { code: 400 } }))
      ),
  ],
  [
    'the message of the answer',
    (text) => failed({ responseData: { message: text } }),
  ],
  [
    'the description of the answer',
    (text) => failed({ responseData: { error_description: text } }),
  ],
];

/** A text percent encoded (a lone surrogate, which cannot be encoded, is made a replacement character first). */
const percent = (text: string) => encodeURIComponent(text.toWellFormed());

/** The text written with HTML entities for its quotes, or percent encoded (once or twice), or as it is. */
function encode(text: string, random: Random): string {
  const kind = random();
  if (kind < 0.04) return `<pre>${text.replace(/"/g, '&quot;')}</pre>`;
  if (kind < 0.07) return text.replace(/"/g, '&#34;');
  if (kind < 0.09) return text.replace(/"/g, '&#x22;');
  if (kind < 0.12) return `data=${percent(text)}`;
  if (kind < 0.13) return `data=${percent(percent(text))}`;
  return text;
}

const SEED_BASE = Number(process.env.FRODO_PROPERTY_BASE ?? 20261119);

describe('a value in a text that an answer holds is in no form of the error', () => {
  test(`1: ${SEEDS} texts, built from a value, a form, a depth, a prefix, a suffix and a length`, () => {
    const failures: string[] = [];
    const indexes =
      ONLY ?? Array.from({ length: SEEDS }, (_, position) => position + 1);
    for (const index of indexes) {
      const random = generator(SEED_BASE + index * 7919);
      const secret = secretOf(random, index);
      const [formName, form] = pick(random, FORMS);
      const [placeName, place] = pick(random, PLACES);
      let base = form(secret, random);
      if (random() < 0.3) base = corrupt(base, random, markersOf(index)[0]);
      let text = `${pick(random, PREFIXES)}${pad(wrap(base, random, markersOf(index)[0]), sizeOf(random))}${pick(random, SUFFIXES)}`;
      if (random() < 0.1) text = corrupt(text, random, markersOf(index)[0]);
      if (formName !== PLAIN_FORM) text = encode(text, random);
      const error = place(text);
      const forms = allForms(error);
      for (const [name, written] of Object.entries(forms)) {
        // the raw forms hold the text of the message, which is not the view
        if (['%s', 'String', 'template'].includes(name)) continue;
        const found = markersOf(index).filter((marker) =>
          written.includes(marker)
        );
        if (found.length > 0) {
          failures.push(
            `${index} ${formName} in ${placeName}: ${found.join(' ')} in '${name}' (text of ${text.length} characters: ${JSON.stringify(ONLY ? text : text.slice(0, 1_500))})`
          );
          break;
        }
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
    expect(failures).toHaveLength(0);
  }, 3_600_000);
});
