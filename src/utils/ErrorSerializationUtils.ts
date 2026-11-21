import { inspect, type InspectOptions } from 'util';
import {
  isSensitiveHeaderName,
  isSensitiveName,
  normalizeName,
  redactBody,
  redactCredentials,
  REDACTED,
  redactHeaderValue,
  redactUrl,
  SECRET_NAME_ENDINGS,
} from './SensitiveDataUtils';

/**
 * How an error is written when something serializes or prints it.
 *
 * The error of a failed request holds the request: its config has the headers
 * the request was sent with, its body, its authentication and its agents, and
 * `JSON.stringify` and `util.inspect` write all of it. The config stays on the
 * error, because a request that is sent again (retry, renewal of a session) is
 * sent with it. What the error writes instead is a view of its own, built from
 * a list of what may be shown and not from what is there:
 *
 * - An `AxiosError`: name, message, code, status, method, the URL (user info,
 *   query and fragment with their sensitive values replaced), the names of the
 *   request headers with the values of the sensitive ones replaced (the scheme
 *   of an `Authorization` header stays: `Bearer <redacted>`), the request body,
 *   and a summary of the response: status, a short list of headers (every
 *   other header is named and its value omitted, a URL in a header is
 *   redacted) and the body. Nothing else of the config.
 * - A `FrodoError`: name, message, combined message, code, the http fields,
 *   the transaction id and its original errors, each written the same way.
 * - Any other error: name, message, code, status, and its `cause` or `errors`
 *   (an `AggregateError`), each written the same way.
 *
 * The names of the headers that are sensitive although no list says so (the
 * header overrides of the state, the name of the session cookie) are known to the
 * view of an error that passed an instance of the library, and, through a
 * registry of the names that any instance told, to the view of an `AxiosError`
 * that never passed one (a foreign one that a `FrodoError` wraps). The registry
 * is bounded, and a name of another instance is redacted for it as well, which
 * can only redact more.
 *
 * The view is cycle safe and bounded: {@link MAX_ERROR_DEPTH} levels of nested
 * errors, {@link MAX_ERROR_NODES} errors in all (an error that is reached a
 * second time is written once and then named `[Repeated]`), and
 * {@link MAX_BODY_LENGTH} characters of a body or a message.
 */

/** How many levels of nested errors are written; deeper ones are `[Truncated]`. */
export const MAX_ERROR_DEPTH = 8;

/** How many errors are written in all, however many an error holds. */
export const MAX_ERROR_NODES = 50;

/** How many characters of a request or response body or of a message are written. */
export const MAX_BODY_LENGTH = 4000;

/**
 * How many characters past the cut a text is read before it is cut. A value that
 * starts before the cut and ends after it is read whole, replaced, and only then
 * is the text cut; the margin is longer than the values that have a length of
 * their own (a token, a key, a password).
 */
export const CUT_MARGIN = 1024;

/** How many characters of a combined message may be built for the view of one error. */
const COMBINED_MESSAGE_BUDGET = 8 * (MAX_BODY_LENGTH + CUT_MARGIN);

/**
 * The characters that the combined message of the error that is being written
 * may still build, or `undefined` when no view is being written. The combined
 * message of a `FrodoError` expands an error that is held at many places once
 * for each place, so for errors that share their children the text it builds
 * grows with the number of ways to reach a child, not with the number of
 * errors. The view needs only the head of that text, so while it is written
 * `FrodoError.getCombinedMessage` stops building when this has been used up.
 * Called by anyone else it builds the whole text, as it always did.
 */
let combinedMessageBudget: { left: number } | undefined;

/**
 * Whether the view that is being written has built as much of a combined message
 * as it may.
 * @returns {boolean} `true` when the rest of the text is not needed
 */
export function combinedMessageBudgetSpent(): boolean {
  return combinedMessageBudget !== undefined && combinedMessageBudget.left <= 0;
}

/**
 * Counts the text that a call of `getCombinedMessage` built against the budget of
 * the view that is being written; no view, no count. A call counts at least one
 * character, so that errors that say nothing are counted as well.
 * @param {number} characters how long the text of the call is
 */
export function chargeCombinedMessageBudget(characters: number): void {
  if (combinedMessageBudget) {
    combinedMessageBudget.left -= Math.max(characters, 1);
  }
}

/**
 * The detail of an answer as the combined message of the error that is being
 * written says it: the structure of the detail written the way the view writes a
 * body (the sensitive fields, the answers to a password callback and the strings
 * of the detail replaced, and cut), instead of the text of the detail, which a
 * rule that reads text cannot read when it holds a JSON text in a string or runs
 * on past the cut. `undefined` when no view is being written: the combined
 * message then says the detail as it always did.
 * @param {unknown} detail the `detail` of the body of an answer
 * @returns {string | undefined} the text to put after `Detail: `
 */
export function describeDetailOfCombinedMessage(
  detail: unknown
): string | undefined {
  if (!combinedMessageBudget) return undefined;
  const written = describeBody(detail);
  return typeof written === 'string' ? written : JSON.stringify(written);
}

/**
 * Runs a function with a fresh budget for the combined message it builds.
 * @param {() => T} run the function that builds the combined message
 * @returns {T} what it returned
 */
function withCombinedMessageBudget<T>(run: () => T): T {
  const outer = combinedMessageBudget;
  combinedMessageBudget = { left: COMBINED_MESSAGE_BUDGET };
  try {
    return run();
  } finally {
    combinedMessageBudget = outer;
  }
}

/** How many JSON texts inside strings inside JSON texts are read as structure, no further. */
const MAX_NESTED_TEXTS = 4;

/**
 * The longest JSON text inside a string that is read as structure. A longer one
 * is written as a text: its head is cut first and then redacted. The text of an
 * answer is not under our control, and the cost of reading a text as structure
 * (parse, walk, write again) grows with its length.
 */
export const MAX_STRUCTURED_TEXT = 64 * 1024;

/** The longest JSON text that is read as structure after the budget of the view is spent, or at a depth where texts are no longer read (it costs its length, once). */
const SHORT_TEXT = 8 * 1024;

/**
 * How much of a text is read to decide whether it looks like JSON, and to write
 * it when it does not: the head that is written ({@link MAX_BODY_LENGTH}) and the
 * margin after it ({@link CUT_MARGIN}).
 */
const PLAIN_WINDOW = MAX_BODY_LENGTH + CUT_MARGIN;

/** Where a JSON text starts: an opening brace or bracket, then blanks and a quote, an escape (a text that is in a string) or another opening. */
const JSON_START = /[{[]\s*["\\{[]/;

/** An escaped quote or a unicode escape: a JSON text that is in a string, or a name written with an escape. */
const JSON_ESCAPE = /\\(?:"|u[0-9a-fA-F]{4})/;

/** A percent escape, a numeric or a named entity of HTML: the characters that a text may be written with instead of itself. */
const ENCODED =
  /%([0-9A-Fa-f]{2})|&#(\d{1,7});|&#[xX]([0-9A-Fa-f]{1,6});|&(quot|amp|lt|gt|lbrace|rbrace|lbrack|rbrack|lcub|rcub|lsqb|rsqb|bsol);/g;

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  lbrace: '{',
  rbrace: '}',
  lcub: '{',
  rcub: '}',
  lbrack: '[',
  rbrack: ']',
  lsqb: '[',
  rsqb: ']',
  bsol: '\\',
};

/**
 * A text with its percent escapes and its entities replaced by the characters
 * they stand for, three times (a text that was encoded more than once).
 * @param {string} text the text
 * @returns {string} the text as it reads when it is decoded
 */
function decodeEncodings(text: string): string {
  let result = text;
  for (let pass = 0; pass < 3; pass++) {
    const next = result.replace(
      ENCODED,
      (
        match: string,
        percent?: string,
        decimal?: string,
        hexadecimal?: string,
        named?: string
      ) => {
        if (named !== undefined) return NAMED_ENTITIES[named];
        const code = parseInt(
          (percent ?? hexadecimal ?? decimal) as string,
          percent !== undefined || hexadecimal !== undefined ? 16 : 10
        );
        return code <= 0x10ffff ? String.fromCodePoint(code) : match;
      }
    );
    if (next === result) break;
    result = next;
  }
  return result;
}

/**
 * An XML element or an HTML field that holds a credential: `<password>`, `<dbPassword>`,
 * `<input type="password">`. The names of the elements are read as the names of a text: a word
 * that ends in a word of a secret, or one of the other names.
 */
const MARKUP_SECRET = new RegExp(
  `<\\s*(?:[\\w:.-]*?(?:${SECRET_NAME_ENDINGS.join('|')})|pass|passphrase|api_?key|(?:access_?|refresh_?|id_?)token|token|credentials?)(?=[\\s/>])|\\btype\\s*=\\s*["']?password\\b`,
  'i'
);

/**
 * A text that starts like JSON: after blanks (and a byte order mark), an opening
 * brace, or an opening bracket and then a quote, an opening, a closing bracket,
 * or a number or `true`, `false` or `null` and a comma or a closing bracket,
 * whatever follows. A text that starts like that and is no JSON is not written.
 */
const JSON_STARTS_TEXT =
  /^\s*(?:\{|\[\s*(?:["[{\]]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\s*[,\]]|(?:true|false|null)\s*[,\]]))/;

/** How many characters of JSON texts inside strings are read as structure for one body, in all. */
const STRUCTURED_TEXT_BUDGET = 256 * 1024;

/**
 * How many characters of JSON texts inside strings are read as structure for all
 * the bodies of one view, in all: the answer, the request, and the detail that the
 * combined message says again, of every error that the view reaches. What is
 * left after the budget is written as the head of a text, with its secrets replaced.
 */
const VIEW_STRUCTURED_TEXT_BUDGET = 2 * STRUCTURED_TEXT_BUDGET;

/** The budget of the view that is being written, `undefined` when none is. */
let viewStructuredTextBudget: { left: number } | undefined;

/**
 * The texts that the view being written has read as structure, and what it wrote
 * for them: one map for each depth of texts in texts (what is written of a text
 * depends on how deep it stands). `undefined` when no view is being written.
 */
let viewTextReads: Map<string, string>[] | undefined;

/**
 * The budget for the texts of a body: the budget of the view that is being
 * written, which all its bodies share, or a fresh one of its own.
 * @returns {{ left: number }} the budget
 */
function structuredTextBudget(): { left: number } {
  return viewStructuredTextBudget ?? { left: STRUCTURED_TEXT_BUDGET };
}

/** What stands where an error refers back to one that is being written. */
const CIRCULAR = '[Circular]';

/** What stands where an error was written before, somewhere else in the view. */
const REPEATED = '[Repeated]';

/** What stands where the nesting or the number of errors is over its bound. */
const TRUNCATED = '[Truncated]';

/** What stands in place of the value of a header that is not on the short list. */
const OMITTED = '<omitted>';

/**
 * The response headers that are written with their value: they say what the
 * answer was and when to try again. Every other response header is written by
 * name only (see {@link describeResponseHeaders}).
 */
const RESPONSE_HEADERS_SHOWN = [
  'content-type',
  'content-length',
  'content-encoding',
  'date',
  'retry-after',
  'cache-control',
  'allow',
  'x-forgerock-transactionid',
];

/** Prefixes of the response headers that state the rate limit, written with their value. */
const RESPONSE_HEADER_PREFIXES_SHOWN = ['x-ratelimit-', 'ratelimit-'];

/** The response headers that hold a URL: written with the URL redacted. */
const RESPONSE_HEADERS_WITH_URL = ['location', 'content-location'];

/**
 * The names of the headers whose values are redacted although no list says so
 * (the header overrides of the state and the name of the session cookie), as the
 * library knew them when the error was made.
 */
const extraHeaderNames = new WeakMap<object, readonly string[]>();

/**
 * Every such name that an instance of the library has told the view of an error
 * (in lower case). The view of an `AxiosError` that never passed an instance (a
 * foreign one that a `FrodoError` wraps) has no names of its own, and takes
 * these: a name that another instance of the process uses is redacted for it as
 * well, which can only redact more. The registry is bounded.
 */
const knownHeaderNames = new Set<string>();

/** The most names that the registry keeps. */
const MAX_KNOWN_HEADER_NAMES = 256;

type Context = {
  /** The errors on the way from the top to the error that is written now. */
  path: WeakSet<object>;
  /** Every error that was written, or is being written. */
  done: WeakSet<object>;
  /** How many more errors may be written. */
  nodes: { left: number };
  depth: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/** Reads a property and never throws, whatever a getter does. */
function read(source: unknown, name: string): unknown {
  try {
    return isObject(source) ? source[name] : undefined;
  } catch {
    return undefined;
  }
}

function isAxiosErrorLike(error: Record<string, unknown>): boolean {
  return (
    read(error, 'isAxiosError') === true || read(error, 'name') === 'AxiosError'
  );
}

/** The entries of an object that have a value; an empty result is `undefined`. */
function compact(entries: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(entries).filter(
      ([, value]) => value !== undefined && value !== null
    )
  );
}

function clip(text: string): string {
  return text.length > MAX_BODY_LENGTH
    ? `${text.slice(0, MAX_BODY_LENGTH)}... (${text.length} characters)`
    : text;
}

/**
 * A text as it may be written. Only its head is read, so that nothing that
 * follows depends on the length of what a server answered: the sensitive values
 * in the head and in the {@link CUT_MARGIN} characters after it are replaced
 * (see `redactCredentials`), so that a value that the cut would end is replaced
 * as a whole, and then the text is cut, with a note of how long it was.
 * @param {string} text the text to write
 * @param {(window: string) => string} redact replaces the sensitive values of the head of the text
 * @returns {string} the text to write
 */
function cutAfterRedaction(
  text: string,
  redact: (window: string) => string
): string {
  if (text.length <= MAX_BODY_LENGTH) return redact(text);
  const redacted = redact(text.slice(0, MAX_BODY_LENGTH + CUT_MARGIN));
  return `${redacted.slice(0, MAX_BODY_LENGTH)}... (${text.length} characters)`;
}

/**
 * A text as it may be written: cut to a fixed length with the sensitive values
 * in it replaced (URLs, bearer values, JSON web tokens, values of sensitive
 * names, see `redactCredentials`).
 * @param {string} text a message, a combined message or a stack
 * @returns {string} the text to write
 */
function describeText(text: string): string {
  return cutAfterRedaction(text, redactCredentials);
}

/**
 * A message, a stack or another text of an error as it may be written: a text
 * that looks like JSON (it holds an echo of a request or an answer) is read as
 * structure when it parses and is not written otherwise; any other text is cut
 * with the sensitive values in it replaced.
 * @param {string} text a message or a stack
 * @returns {string} the text to write
 */
function describeErrorText(text: string): string {
  return looksLikeJson(text) ? describeString(text) : describeText(text);
}

/**
 * A message as it may be written.
 * @param {unknown} message the message of an error
 * @returns {string | undefined} the message to write
 */
function describeMessage(message: unknown): string | undefined {
  return typeof message === 'string' ? describeErrorText(message) : undefined;
}

/**
 * The labels that `FrodoError.getCombinedMessage` starts the lines of one source with
 * (an answer of the server: its URL, status, code, error, reason, message, detail and
 * description; the id of the transaction).
 */
const COMBINED_MESSAGE_LABEL =
  /^\s*(?:Network error|URL|Status|Code|Error|Reason|Message|Detail|Description|Transaction id):/;

/** A line that ends in an opening bracket or brace: the text that it opens goes on in the next lines. */
const OPENING_LINE = /[{[]\s*$/;

/**
 * The combined message of a `FrodoError` as it may be written: only its head is
 * read, so that the work does not depend on the length of what a server
 * answered. Its `Detail:` lines hold the detail of an answer as JSON text, and
 * that JSON gets the same redaction as the `httpDetail` of the view (the fields
 * by name, the answers to a password callback); a line that the end of the head
 * ends in the middle is not JSON any more and gets the redaction of any text.
 * The combined message starts with the message of the error. A message of
 * several lines that looks like JSON is one text, written as the `message` of
 * the error is (a newline inside a value does not end the text); the lines after
 * it are read one by one. A line that opens JSON or markup (see
 * {@link looksLikeJson}, or ends in an opening bracket or brace) is the start of a
 * text that goes on in the lines after it, so those lines are not written either, up
 * to the line that starts with one of the labels that `getCombinedMessage` writes
 * for each source (`Network error:`, `URL:`, ...): one note stands for the whole run.
 * @param {unknown} combined the combined message
 * @param {unknown} message the message of the error
 * @returns {string | undefined} the combined message to write
 */
function describeCombinedMessage(
  combined: unknown,
  message?: unknown
): string | undefined {
  if (typeof combined !== 'string') return undefined;
  const wholeMessage =
    typeof message === 'string' &&
    message.includes('\n') &&
    combined.startsWith(message) &&
    looksLikeJson(message);
  const first = wholeMessage ? describeString(message) : undefined;
  // only the head of the text is written, so only the head (and the margin
  // after it, see CUT_MARGIN) is read; the note keeps the length of the whole
  const head =
    combined.length > MAX_BODY_LENGTH + CUT_MARGIN
      ? combined.slice(0, MAX_BODY_LENGTH + CUT_MARGIN)
      : combined;
  const rest = wholeMessage ? head.slice(message.length) : head;
  const lines: string[] = [];
  // the lines of a text that a line opened: not written, up to the next label
  let run: string[] | undefined;
  for (const line of rest.split('\n')) {
    if (run) {
      if (!COMBINED_MESSAGE_LABEL.test(line)) {
        run.push(line);
        continue;
      }
      lines.push(withheld(run.join('\n')));
      run = undefined;
    }
    const at = line.indexOf('Detail: ');
    const json = at === -1 ? '' : line.slice(at + 'Detail: '.length);
    if (
      at !== -1 &&
      line.slice(0, at).trim() === '' &&
      (json[0] === '{' || json[0] === '[')
    ) {
      try {
        const detail = describeBody(JSON.parse(json));
        lines.push(
          `${line.slice(0, at)}Detail: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
        );
      } catch {
        // a line that the end of the head cut is not JSON any more: nothing of it is written
        lines.push(`${line.slice(0, at)}Detail: ${withheld(json)}`);
      }
    } else if (looksLikeJson(line) || OPENING_LINE.test(line)) {
      run = [line];
    } else {
      lines.push(line);
    }
  }
  if (run) lines.push(withheld(run.join('\n')));
  const written = redactCredentials(
    first === undefined ? lines.join('\n') : first + lines.join('\n')
  );
  const total =
    combined.length > MAX_BODY_LENGTH ? combined.length : written.length;
  return total > MAX_BODY_LENGTH
    ? `${written.slice(0, MAX_BODY_LENGTH)}... (${total} characters)`
    : written;
}

/**
 * The strings of a JSON value, each cut and redacted as a text (see
 * `describeText`). The value comes from `JSON.parse`, so it has no cycle.
 * @param {unknown} value a value read from JSON
 * @param {number} depth how deep in the value this call is
 * @returns {unknown} the value with its strings written
 */
function describeStrings(
  value: unknown,
  depth = 0,
  nesting = 0,
  budget: { left: number } = structuredTextBudget()
): unknown {
  if (typeof value === 'string') return describeString(value, nesting, budget);
  if (depth > 64) return TRUNCATED;
  if (Array.isArray(value)) {
    return value.map((item) =>
      describeStrings(item, depth + 1, nesting, budget)
    );
  }
  if (isObject(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      setOwn(
        result,
        key,
        describeStrings(value[key], depth + 1, nesting, budget)
      );
    }
    return result;
  }
  return value;
}

/** Sets an own property, also one that is named `__proto__` (a JSON text can hold such a key). */
function setOwn(target: Record<string, unknown>, key: string, value: unknown) {
  if (key === '__proto__') {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  } else {
    target[key] = value;
  }
}

/**
 * A JSON text read as the structure it is, and the strings in it the same way, so
 * that a JSON text inside a string (an answer that echoes a request) has its
 * fields replaced too. A text that does not parse is not written (see
 * {@link withheld}).
 * @param {string} text the text
 * @param {number} nesting how many texts inside texts this one is in
 * @param {{ left: number }} budget how much more text may be read as structure
 * @returns {string} the text to write
 */
function describeAsStructure(
  text: string,
  nesting: number,
  budget: { left: number }
): string {
  try {
    const parsed: unknown = JSON.parse(text);
    return describeText(
      JSON.stringify(
        describeStrings(redactStructure(parsed), 0, nesting + 1, budget)
      )
    );
  } catch {
    // not JSON after all (a stray brace, a text that is cut), or too deep to be read
    return withheld(text);
  }
}

/**
 * What stands for a text that looks like JSON and cannot be read as structure:
 * nothing of it is written, only how long it is.
 * @param {string} text the text
 * @returns {string} the placeholder
 */
function withheld(text: string): string {
  return `<text of ${text.length} characters not written>`;
}

/**
 * Whether a text looks like JSON, or holds a JSON text: in the part of it that a
 * plain text is written from, it starts like JSON, or it holds an opening brace
 * or bracket with a quote, an escape or another opening after it, or an escaped
 * quote or a unicode escape, or an XML element or an HTML field of a credential,
 * also when it is written with percent escapes or HTML entities (it is read as it
 * decodes, three times).
 * A text that does is written only as structure, or not at all.
 * @param {string} text the text
 * @returns {boolean} whether it looks like JSON
 */
function looksLikeJson(text: string): boolean {
  const window =
    text.length > PLAIN_WINDOW ? text.slice(0, PLAIN_WINDOW) : text;
  return (
    looksLikeJsonAsWritten(window) ||
    (/[%&]/.test(window) && looksLikeJsonAsWritten(decodeEncodings(window)))
  );
}

/** The parts of {@link looksLikeJson}, asked of a text as it is. */
function looksLikeJsonAsWritten(window: string): boolean {
  return (
    JSON_STARTS_TEXT.test(window) ||
    JSON_START.test(window) ||
    JSON_ESCAPE.test(window) ||
    MARKUP_SECRET.test(window)
  );
}

/**
 * A text of an answer or a request as it may be written. What is written for a
 * text depends on what it looks like (see {@link looksLikeJson}):
 *
 * | the text | what is written |
 * | -------- | --------------- |
 * | does not look like JSON (a page, a log line, a form, a short error) | read up to the cut and a margin, the values of sensitive names, bearer values, tokens and URLs in it replaced, cut at {@link MAX_BODY_LENGTH} characters with the note of its length |
 * | looks like JSON, parses, is within {@link MAX_STRUCTURED_TEXT}, the depth of {@link MAX_NESTED_TEXTS} texts in texts, and the budget of the view (or is within {@link SHORT_TEXT}) | its structure: the values of sensitive names replaced whatever they are, the strings in it written by this same table |
 * | looks like JSON and does not parse, or is longer, or deeper, or comes after the budget and is longer than {@link SHORT_TEXT} | nothing of it: `<text of N characters not written>` |
 *
 * A text that looks like JSON is read as structure or not written, whatever it holds.
 * @param {string} text the text
 * @param {number} nesting how many JSON texts inside strings this text is in
 * @param {{ left: number }} budget how much more text may be read as structure
 * @returns {string} the text to write
 */
function describeString(
  text: string,
  nesting = 0,
  budget: { left: number } = structuredTextBudget()
): string {
  if (!looksLikeJson(text)) {
    return cutAfterRedaction(text, (window) =>
      redactCredentials(String(redactBody(window).data))
    );
  }
  // a text that the view has read as structure before (the answer and the detail that the combined
  // message says again are the same text) is written as it was
  const reads = viewTextReads?.[nesting];
  const known = reads?.get(text);
  if (known !== undefined) return known;
  if (
    text.length <= MAX_STRUCTURED_TEXT &&
    nesting < MAX_NESTED_TEXTS &&
    (budget.left >= text.length || text.length <= SHORT_TEXT)
  ) {
    budget.left = Math.max(0, budget.left - text.length);
    const written = describeAsStructure(text, nesting, budget);
    reads?.set(text, written);
    return written;
  }
  return withheld(text);
}

/** A unicode escape: a backslash, `u` and four hexadecimal digits (one backslash, so that a run of backslashes costs its length). */
const UNICODE_ESCAPE = /\\u([0-9a-fA-F]{4})/g;

/**
 * Whether a key of a JSON value names a sensitive field or header: as it is, or with the
 * unicode escapes in it taken off and its backslashes dropped (a key that holds
 * `\u0070assword` as characters is the key of a text that was written twice).
 * @param {string} key the key
 * @returns {boolean} whether the value under it is a credential
 */
function isSensitiveKey(key: string): boolean {
  const sensitive = isSensitiveName;
  if (sensitive(key)) return true;
  let name = key;
  for (let level = 0; level < 3 && name.includes('\\'); level++) {
    name = name.replace(UNICODE_ESCAPE, (_match, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    if (sensitive(name.replace(/\\/g, ''))) return true;
  }
  return false;
}

/** Whether a value is something to replace under a sensitive name: all but nothing (`null`, a boolean, an empty string). */
const isSomething = (item: unknown): boolean =>
  item !== null &&
  item !== undefined &&
  typeof item !== 'boolean' &&
  item !== '';

/**
 * The keys that name a field, a header or a property whose value is in a key beside it
 * (`{"name":"x-api-key","value":"..."}`), as `normalizeName` reads them. The rule is a
 * heuristic that reads these keys and the keys of {@link VALUE_KEYS}: a pair under other
 * keys, a name and its value in two parallel lists (a table with a column of names), and an
 * object of more than {@link MAX_KEYS_OF_A_PAIR} members are not read as a pair.
 */
const NAME_KEYS = new Set([
  'name',
  'key',
  'header',
  'headername',
  'field',
  'fieldname',
  'attribute',
  'attributename',
  'property',
  'propertyname',
  'parameter',
  'parametername',
  'param',
  'paramname',
  'label',
  'id',
  'type',
  'title',
  'headerkey',
  'propname',
  'variable',
  'variablename',
  'env',
  'setting',
  'settingname',
]);

/** The keys that hold the value that goes with such a name, as `normalizeName` reads them. */
const VALUE_KEYS = new Set([
  'value',
  'values',
  'val',
  'content',
  'data',
  'text',
  'v',
  'stringvalue',
  'propvalue',
  'headervalue',
  'encrypted',
]);

/** An object with more members than this is no pair of a name and a value (it is not looked at for one). */
const MAX_KEYS_OF_A_PAIR = 64;

/** Whether a value is the name of a sensitive field or header (a name is short). */
function isNameOfSecret(value: unknown): boolean {
  return (
    typeof value === 'string' && value.length <= 64 && isSensitiveKey(value)
  );
}

/**
 * The structure of a JSON text as it may be written: the value of a sensitive
 * name is replaced whatever it is (a string, a number, a list, an object, also a
 * string that holds a JSON text), and so is the value that stands beside a name
 * that is a sensitive name (`{"name":"x-api-key","value":"..."}`, the member of a
 * list that follows one: `["Cookie", "..."]`), and the answer to a password callback (whatever it is, a
 * name of the input of a callback that is a key included).
 * @param {unknown} value a value read from JSON
 * @param {number} depth how deep in the value this call is
 * @returns {unknown} the value without the sensitive values
 */
function redactStructure(value: unknown, depth = 0): unknown {
  const redacted = depth === 0 ? redactBody(value).data : value;
  if (!isObject(redacted)) return redacted;
  if (depth > 64) return TRUNCATED;
  if (Array.isArray(redacted)) {
    // a name of a sensitive field in a list is followed by its value: `["Cookie", "sid=..."]`, also
    // in a longer list (`["Cookie", "sid=...", "Path=/"]`, the flat `rawHeaders` of a request)
    return redacted.map((item, index) =>
      index > 0 && isSomething(item) && isNameOfSecret(redacted[index - 1])
        ? REDACTED
        : isObject(item)
          ? redactStructure(item, depth + 1)
          : item
    );
  }
  const callback =
    typeof redacted.type === 'string' &&
    /passwordcallback$/i.test(redacted.type);
  const keys = Object.keys(redacted);
  // an object that names a sensitive field and holds its value: `{"name":"x-api-key","value":"..."}`
  const named =
    keys.length <= MAX_KEYS_OF_A_PAIR &&
    keys.some(
      (key) =>
        NAME_KEYS.has(normalizeName(key)) && isNameOfSecret(redacted[key])
    );
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const item = redacted[key];
    if (
      isSomething(item) &&
      (isSensitiveKey(key) ||
        (callback && /^idtoken\d+$/i.test(key)) ||
        (named && VALUE_KEYS.has(normalizeName(key))))
    ) {
      setOwn(result, key, REDACTED);
    } else if (callback && key === 'input' && Array.isArray(item)) {
      setOwn(
        result,
        key,
        item.map((entry) =>
          isObject(entry) && isSomething(entry.value)
            ? { ...entry, value: REDACTED }
            : redactStructure(entry, depth + 1)
        )
      );
    } else {
      setOwn(
        result,
        key,
        isObject(item) ? redactStructure(item, depth + 1) : item
      );
    }
  }
  return result;
}

/**
 * A request or response body as it may be written: the sensitive fields of a
 * JSON body and of a form are replaced, the strings in it are written as texts
 * (an answer can echo a request in free text), a body that is no text (a
 * stream, a buffer) is named and not written, and a long body is cut.
 * @param {unknown} data the body, as the client holds it
 * @returns {unknown} what may be written; `undefined` for no body
 */
export function describeBody(data: unknown): unknown {
  if (data === undefined || data === null || data === '') return undefined;
  if (typeof data === 'string') {
    return describeString(data);
  }
  if (typeof data !== 'object') return data;
  if (Buffer.isBuffer(data)) return `<Buffer ${data.length} bytes>`;
  if (ArrayBuffer.isView(data) || data instanceof ArrayBuffer) {
    return `<binary ${(data as ArrayBuffer).byteLength} bytes>`;
  }
  if (typeof (data as { pipe?: unknown }).pipe === 'function') {
    return '<stream>';
  }
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    return '<form data>';
  }
  if (data instanceof URLSearchParams) {
    // a form text starts with a percent sign, never with a brace or a bracket: it is no JSON text
    return describeString(data.toString());
  }
  try {
    const redacted = describeStrings(
      redactStructure(JSON.parse(JSON.stringify(data)))
    );
    const text = JSON.stringify(redacted);
    return text !== undefined && text.length > MAX_BODY_LENGTH
      ? clip(text)
      : redacted;
  } catch {
    return '<body that cannot be written>';
  }
}

/**
 * The headers of a request with the values of the sensitive headers replaced
 * and every name kept, whether they are an `AxiosHeaders` instance or a plain
 * object, in any case, also in the groups of header lines (`common`, `post`)
 * that axios keeps in its defaults.
 * @param {unknown} headers the headers
 * @param {readonly string[]} extraNames header names that are sensitive besides the shared list
 * @param {number} depth how deep in groups of header lines this call is
 * @returns {Record<string, unknown> | undefined} the headers to write
 */
export function describeHeaders(
  headers: unknown,
  extraNames: readonly string[] = [],
  depth = 0
): Record<string, unknown> | undefined {
  if (!isObject(headers)) return undefined;
  let source: unknown = headers;
  try {
    if (typeof headers.toJSON === 'function') source = headers.toJSON();
  } catch {
    source = headers;
  }
  if (!isObject(source)) return undefined;
  const result: Record<string, unknown> = {};
  for (const name of Object.keys(source)) {
    const value = read(source, name);
    if (typeof value === 'function') continue;
    if (isSensitiveHeaderName(name, extraNames)) {
      result[name] = clip(redactHeaderValue(name, value));
    } else if (Array.isArray(value)) {
      result[name] = value.map((item) => clip(String(item)));
    } else if (isObject(value)) {
      if (depth < 2)
        result[name] = describeHeaders(value, extraNames, depth + 1);
    } else {
      result[name] = typeof value === 'string' ? clip(value) : value;
    }
  }
  return result;
}

/** A header value as one text, whether it is a list or not. */
function headerText(value: unknown): string {
  return Array.isArray(value)
    ? value.map((item) => String(item)).join(', ')
    : String(value ?? '');
}

/**
 * The headers of a response, as a short list of what may be shown: the headers
 * on {@link RESPONSE_HEADERS_SHOWN} and the rate limit headers with their value,
 * `Location` and `Content-Location` with the sensitive values of the URL
 * replaced, the scheme of `WWW-Authenticate`, the sensitive headers with their
 * value replaced (the names of the cookies stay), and every other header by name
 * with {@link OMITTED} as its value: a server can put anything in a header, and
 * an answer that redirects carries a URL with a code in it.
 * @param {unknown} headers the headers, an `AxiosHeaders` instance or a plain object
 * @param {readonly string[]} extraNames header names that are sensitive besides the shared list
 * @returns {Record<string, unknown> | undefined} the headers to write
 */
export function describeResponseHeaders(
  headers: unknown,
  extraNames: readonly string[] = []
): Record<string, unknown> | undefined {
  if (!isObject(headers)) return undefined;
  let source: unknown = headers;
  try {
    if (typeof headers.toJSON === 'function') source = headers.toJSON();
  } catch {
    source = headers;
  }
  if (!isObject(source)) return undefined;
  const result: Record<string, unknown> = {};
  for (const name of Object.keys(source)) {
    const value = read(source, name);
    if (typeof value === 'function') continue;
    const lower = name.toLowerCase();
    if (isSensitiveHeaderName(name, extraNames)) {
      result[name] = clip(redactHeaderValue(name, value));
    } else if (RESPONSE_HEADERS_WITH_URL.includes(lower)) {
      result[name] = cutAfterRedaction(headerText(value), redactUrl);
    } else if (lower === 'link') {
      result[name] = cutAfterRedaction(headerText(value), (window) =>
        window.replace(
          /<([^>]*)>/g,
          (_match, url: string) => `<${redactUrl(url)}>`
        )
      );
    } else if (lower === 'refresh') {
      result[name] = cutAfterRedaction(headerText(value), (window) =>
        window.replace(
          /(url\s*=\s*)(.*)$/i,
          (_match, prefix: string, url: string) =>
            `${prefix}${redactUrl(url.trim())}`
        )
      );
    } else if (lower === 'www-authenticate') {
      // the scheme of the challenge says what the server wants, its parameters can say more
      result[name] = clip(headerText(value)).trim().split(/[\s,]/)[0];
    } else if (
      RESPONSE_HEADERS_SHOWN.includes(lower) ||
      RESPONSE_HEADER_PREFIXES_SHOWN.some((prefix) => lower.startsWith(prefix))
    ) {
      result[name] = Array.isArray(value)
        ? value.map((item) => clip(String(item)))
        : typeof value === 'string'
          ? clip(value)
          : value;
    } else {
      result[name] = OMITTED;
    }
  }
  return result;
}

function describeUrl(config: unknown): string | undefined {
  const url = read(config, 'url');
  const base = read(config, 'baseURL');
  if (typeof url !== 'string' && typeof base !== 'string') return undefined;
  const target = typeof url === 'string' ? url : '';
  // a URL that starts with `//` is absolute as well: the client takes its host from it
  const absolute = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(target);
  return cutAfterRedaction(
    absolute || typeof base !== 'string' ? target : `${base}${target}`,
    redactUrl
  );
}

function describeResponse(
  response: unknown,
  names: readonly string[]
): Record<string, unknown> | undefined {
  if (!isObject(response)) return undefined;
  return compact({
    status: read(response, 'status'),
    statusText: read(response, 'statusText'),
    headers: describeResponseHeaders(read(response, 'headers'), names),
    data: describeBody(read(response, 'data')),
  });
}

/** A short fact that the library attached to the error of a request (`proxyFailure`, `nameResolutionDiagnosis`). */
function describeFact(fact: unknown): Record<string, unknown> | undefined {
  if (!isObject(fact)) return undefined;
  return compact({
    code: read(fact, 'code'),
    message: describeMessage(read(fact, 'message')),
  });
}

/** A list of errors, written up to the number of errors that may still be written. */
function describeList(list: unknown[], context: Context): unknown[] {
  const written = list
    .slice(0, MAX_ERROR_NODES)
    .map((item) => describeNested(item, context));
  if (list.length > written.length) {
    written.push(`[${list.length - written.length} more omitted]`);
  }
  return written;
}

function describeAxiosError(
  error: Record<string, unknown>,
  context: Context
): Record<string, unknown> {
  const config = read(error, 'config');
  const response = read(error, 'response');
  const names = [...(extraHeaderNames.get(error) ?? []), ...knownHeaderNames];
  const method = read(config, 'method');
  return compact({
    name: read(error, 'name'),
    message: describeMessage(read(error, 'message')),
    code: read(error, 'code'),
    status: read(error, 'status') ?? read(response, 'status'),
    method: typeof method === 'string' ? method.toUpperCase() : undefined,
    url: describeUrl(config),
    headers: describeHeaders(read(config, 'headers'), names),
    data: describeBody(read(config, 'data')),
    response: describeResponse(response, names),
    proxyFailure: describeFact(read(error, 'proxyFailure')),
    nameResolutionDiagnosis: describeFact(
      read(error, 'nameResolutionDiagnosis')
    ),
    cause: describeNested(read(error, 'cause'), context),
  });
}

function describeFrodoError(
  error: Record<string, unknown>,
  context: Context
): Record<string, unknown> {
  let combined: unknown;
  try {
    const getCombinedMessage = read(error, 'getCombinedMessage');
    combined =
      typeof getCombinedMessage === 'function'
        ? withCombinedMessageBudget(() => getCombinedMessage.call(error))
        : undefined;
  } catch {
    combined = undefined;
  }
  const originalErrors = read(error, 'originalErrors');
  return compact({
    name: read(error, 'name'),
    message: describeMessage(read(error, 'message')),
    combinedMessage: describeCombinedMessage(combined, read(error, 'message')),
    code: read(error, 'code'),
    isHttpError: read(error, 'isHttpError'),
    httpCode: read(error, 'httpCode'),
    httpStatus: read(error, 'httpStatus'),
    httpMessage: describeBody(read(error, 'httpMessage')),
    httpDetail: describeBody(read(error, 'httpDetail')),
    httpErrorText: describeBody(read(error, 'httpErrorText')),
    httpErrorReason: describeBody(read(error, 'httpErrorReason')),
    httpDescription: describeBody(read(error, 'httpDescription')),
    httpTransactionId: read(error, 'httpTransactionId'),
    rateLimit: describeBody(read(error, 'rateLimit')),
    originalErrors: Array.isArray(originalErrors)
      ? describeList(originalErrors, context)
      : undefined,
    cause: describeNested(read(error, 'cause'), context),
  });
}

function describePlainError(
  error: Record<string, unknown>,
  context: Context
): Record<string, unknown> {
  const errors = read(error, 'errors');
  return compact({
    name: read(error, 'name'),
    message: describeMessage(read(error, 'message')),
    code: read(error, 'code'),
    status: read(error, 'status'),
    cause: describeNested(read(error, 'cause'), context),
    errors: Array.isArray(errors) ? describeList(errors, context) : undefined,
  });
}

function describeNested(value: unknown, context: Context): unknown {
  if (value === undefined || value === null) return undefined;
  if (!isObject(value))
    return typeof value === 'string' ? describeMessage(value) : value;
  if (context.path.has(value)) return CIRCULAR;
  if (context.done.has(value)) return REPEATED;
  if (context.depth >= MAX_ERROR_DEPTH || context.nodes.left <= 0) {
    return TRUNCATED;
  }
  context.nodes.left--;
  context.path.add(value);
  context.done.add(value);
  const nested: Context = { ...context, depth: context.depth + 1 };
  try {
    if (isAxiosErrorLike(value)) return describeAxiosError(value, nested);
    if (Array.isArray(read(value, 'originalErrors'))) {
      return describeFrodoError(value, nested);
    }
    return describePlainError(value, nested);
  } catch {
    return compact({
      name: read(value, 'name'),
      message: describeMessage(read(value, 'message')),
    });
  } finally {
    context.path.delete(value);
  }
}

/**
 * What an error writes when it is serialized or printed, see the description of
 * this module. Total: it never throws.
 * @param {unknown} error the error, of any kind
 * @returns {unknown} a plain object, safe to stringify and to print
 */
export function describeError(error: unknown): unknown {
  const outer = viewStructuredTextBudget;
  const outerReads = viewTextReads;
  viewStructuredTextBudget = outer ?? { left: VIEW_STRUCTURED_TEXT_BUDGET };
  viewTextReads =
    outerReads ??
    Array.from({ length: MAX_NESTED_TEXTS }, () => new Map<string, string>());
  try {
    return describeNested(error, {
      path: new WeakSet(),
      done: new WeakSet(),
      nodes: { left: MAX_ERROR_NODES },
      depth: 0,
    });
  } finally {
    viewStructuredTextBudget = outer;
    viewTextReads = outerReads;
  }
}

/**
 * `[util.inspect.custom]` of an error that is written through its view: the
 * stack of the error (its name, message and frames), then the rest of the view.
 * @param {Error} error the error
 * @param {number} depth the depth that `util.inspect` has left
 * @param {InspectOptions} options the options of `util.inspect`
 * @param {typeof inspect} inspectFn `util.inspect`
 * @returns {string} the text to print
 */
export function inspectErrorView(
  error: Error,
  depth: number,
  options: InspectOptions & {
    stylize?: (text: string, style: string) => string;
  },
  inspectFn: typeof inspect
): string {
  const view = describeError(error);
  const name = read(error, 'name');
  const message = read(error, 'message');
  if (!isObject(view)) return String(view);
  if (depth < 0) {
    const short = describeErrorText(`[${String(name)}: ${String(message)}]`);
    return options?.stylize ? options.stylize(short, 'special') : short;
  }
  const rest = { ...view };
  delete rest.name;
  delete rest.message;
  const stack = read(error, 'stack');
  const head = describeErrorText(
    typeof stack === 'string' && stack !== ''
      ? stack
      : `${String(name)}: ${String(message)}`
  );
  if (Object.keys(rest).length === 0) return head;
  const nextOptions: InspectOptions = {
    ...options,
    depth:
      options?.depth === null || options?.depth === undefined
        ? options?.depth
        : options.depth - 1,
  };
  return `${head} ${inspectFn(rest, nextOptions)}`;
}

/** The properties of the error of a request that hold the request and the answer. */
const REQUEST_PROPERTIES = ['config', 'request', 'response'];

/**
 * Gives the error of a failed request its own `toJSON` and `[util.inspect.custom]`
 * that write the view of {@link describeError}, instead of the `config` that the
 * default serialization of an `AxiosError` writes, and makes `config`, `request`
 * and `response` properties that are not enumerable, so that `Object.keys`, a
 * spread and `Object.assign` do not carry them either. All of them stay readable
 * by name, and the config stays on the error for the code that sends the request
 * again.
 * @param {unknown} error the error that a request of the library failed with
 * @param {readonly string[]} headerNames the names of the headers that are sensitive besides the shared list
 */
export function attachSafeSerialization(
  error: unknown,
  headerNames: readonly string[] = []
): void {
  if (!isObject(error) || !Object.isExtensible(error)) return;
  extraHeaderNames.set(error, headerNames);
  for (const name of headerNames) {
    if (knownHeaderNames.size >= MAX_KNOWN_HEADER_NAMES) break;
    knownHeaderNames.add(String(name).toLowerCase());
  }
  Object.defineProperty(error, 'toJSON', {
    value: () => describeError(error),
    enumerable: false,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(error, inspect.custom, {
    value: (
      depth: number,
      options: InspectOptions,
      inspectFn: typeof inspect
    ) => inspectErrorView(error as unknown as Error, depth, options, inspectFn),
    enumerable: false,
    configurable: true,
    writable: true,
  });
  for (const name of REQUEST_PROPERTIES) {
    const descriptor = Object.getOwnPropertyDescriptor(error, name);
    if (descriptor?.enumerable && descriptor.configurable) {
      Object.defineProperty(error, name, { ...descriptor, enumerable: false });
    }
  }
}
