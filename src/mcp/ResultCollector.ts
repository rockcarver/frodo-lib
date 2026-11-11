/**
 * The collecting result callback of the MCP runtime.
 *
 * @remarks
 * A bulk function of the facade (an export of everything, an import, a bulk
 * delete) takes a trailing `resultCallback`. With one, a failed item (a
 * section a credential has no scope for, a journey that cannot be written) is
 * reported to it and the other items are still processed; without one, the
 * function throws at the first failed item. An MCP caller cannot pass a
 * function, so the runtime passes one of its own: the collector in this module.
 * It records what was reported, and the runtime returns the result of the
 * function together with the failed items instead of one error that hides the
 * readable part.
 *
 * Everything here is bounded and total: the collector never throws, whatever
 * the function reports to it, and it records at most
 * {@link MAX_RECORDED_FAILURES} failures of at most
 * {@link MAX_FAILURE_MESSAGE_LENGTH} characters each.
 */

import {
  FRODO_ERROR_CODES,
  FrodoError,
  FrodoErrorCode,
} from '../ops/FrodoError';
import type { ResultCallback } from '../ops/OpsTypes';
import {
  REDACTED,
  SENSITIVE_FIELD_NAMES,
  SENSITIVE_HEADER_NAMES,
} from '../utils/SensitiveDataUtils';

/** The most failures a collector records; later ones are only counted. */
export const MAX_RECORDED_FAILURES = 50;

/** The most characters of the message of one recorded failure. */
export const MAX_FAILURE_MESSAGE_LENGTH = 1000;

/** The most characters of the item label of one recorded failure. */
export const MAX_ITEM_LABEL_LENGTH = 120;

/**
 * How much of a reported message is looked at before the credentials are
 * replaced and the message is cut: the work per failure stays bounded however
 * large the message is.
 */
const MAX_MESSAGE_WINDOW = 10_000;

/** How deep the nested errors of a reported error are searched for a code. */
const MAX_CAUSE_DEPTH = 8;

/**
 * One item that failed, as an MCP caller sees it.
 */
export type McpItemFailure = {
  /**
   * The message of the error, with the messages of the errors nested in it,
   * without a stack and with credentials replaced. Cut to
   * {@link MAX_FAILURE_MESSAGE_LENGTH} characters.
   */
  message: string;
  /**
   * The stable identity of the condition (`FrodoError.code`, for example
   * `INSUFFICIENT_SCOPE`), when the error or an error nested in it carries one.
   */
  code?: FrodoErrorCode;
  /**
   * A short label of the item that the message names (`Mappings` for the
   * message `Error Exporting Mappings`), when it names one.
   */
  item?: string;
};

/**
 * What a function with a result callback reported, when at least one item
 * failed.
 */
export type McpItemResults = {
  /** How many successes the function reported (items or sections, as it counts them). */
  succeededCount: number;
  /** How many failures the function reported, including those not recorded in `failures`. */
  failedCount: number;
  /** The failures, in the order they were reported, at most {@link MAX_RECORDED_FAILURES}. */
  failures: McpItemFailure[];
  /** How many failures are not in `failures` because of the limit; absent when none were left out. */
  omittedFailureCount?: number;
};

/** The limits of a collector. Tests lower them; the runtime uses the defaults. */
export type McpResultCollectorLimits = {
  maxFailures: number;
  maxMessageLength: number;
  maxItemLabelLength: number;
};

/**
 * Collects what a function reports to its result callback.
 */
export type McpResultCollector = {
  /** The function to hand to the facade method as its result callback. It never throws. */
  callback: ResultCallback<unknown>;
  /**
   * What was reported so far.
   *
   * @returns The results, or `undefined` when no item failed (also when nothing was reported).
   */
  results(): McpItemResults | undefined;
};

/**
 * Creates a collector for one call.
 *
 * @param limits Limits to use instead of the defaults.
 * @returns The collector.
 */
export function createResultCollector(
  limits: Partial<McpResultCollectorLimits> = {}
): McpResultCollector {
  const maxFailures = limits.maxFailures ?? MAX_RECORDED_FAILURES;
  const maxMessageLength =
    limits.maxMessageLength ?? MAX_FAILURE_MESSAGE_LENGTH;
  const maxItemLabelLength = limits.maxItemLabelLength ?? MAX_ITEM_LABEL_LENGTH;
  const failures: McpItemFailure[] = [];
  let succeededCount = 0;
  let failedCount = 0;

  const callback = (error?: unknown): void => {
    try {
      if (!error) {
        succeededCount++;
        return;
      }
      failedCount++;
      if (failures.length < maxFailures) {
        failures.push(
          describeFailure(error, maxMessageLength, maxItemLabelLength)
        );
      }
    } catch {
      // The collector sits between a function and its caller: whatever is
      // reported to it, the call must go on.
    }
  };

  return {
    callback: callback as ResultCallback<unknown>,
    results: () => {
      if (failedCount === 0) {
        return undefined;
      }
      const omitted = failedCount - failures.length;
      return {
        succeededCount,
        failedCount,
        failures: failures.map((failure) => ({ ...failure })),
        ...(omitted > 0 && { omittedFailureCount: omitted }),
      };
    },
  };
}

/**
 * Places the callback among the arguments of a call, unless the caller already
 * put a function there.
 *
 * @remarks
 * A JSON payload cannot carry a function, so whatever an MCP caller sent at
 * that position (nothing, `null`, an object that a named-argument call put
 * there) is not a callback and is replaced. A host that calls the runtime in
 * process may pass its own function; that one is kept.
 *
 * @param args The positional arguments of the call. Not changed.
 * @param position The index of the result callback among the parameters of the function.
 * @param callback The callback to place.
 * @returns A copy of the arguments with the callback at `position`.
 */
export function placeResultCallback(
  args: readonly unknown[],
  position: number,
  callback: ResultCallback<unknown>
): unknown[] {
  const placed = args.slice();
  while (placed.length < position) {
    placed.push(undefined);
  }
  if (typeof placed[position] !== 'function') {
    placed[position] = callback;
  }
  return placed;
}

/**
 * Describes one reported failure for an MCP caller. Total: it never throws.
 */
function describeFailure(
  error: unknown,
  maxMessageLength: number,
  maxItemLabelLength: number
): McpItemFailure {
  const message = redactCredentials(
    readMessage(error).slice(0, MAX_MESSAGE_WINDOW)
  ).trim();
  const code = findErrorCode(error);
  const item = findItemLabel(message, maxItemLabelLength);
  return {
    message: cut(message, maxMessageLength),
    ...(code && { code }),
    ...(item && { item }),
  };
}

/**
 * The message of an error without its stack: the combined message of a
 * `FrodoError` (its own message and those of the errors nested in it), the
 * message of any other error, or the text of whatever was reported.
 */
function readMessage(error: unknown): string {
  try {
    const combined = (error as { getCombinedMessage?: unknown })
      ?.getCombinedMessage;
    if (typeof combined === 'function') {
      const text = combined.call(error);
      if (typeof text === 'string' && text.trim()) {
        return text;
      }
    }
  } catch {
    // fall through to the plain message
  }
  try {
    const message = (error as { message?: unknown })?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  } catch {
    // fall through to the text of the value
  }
  try {
    const text = String(error);
    if (text.trim()) {
      return text;
    }
  } catch {
    // fall through to the placeholder
  }
  return 'An item failed and its error could not be read.';
}

/** Whether a value is a `FrodoError`, also one from another copy of the library. */
function isFrodoErrorLike(value: unknown): value is FrodoError {
  return (
    value instanceof FrodoError ||
    typeof (value as { getCombinedMessage?: unknown })?.getCombinedMessage ===
      'function'
  );
}

/**
 * The code of the condition an error reports: its own, or the first one found
 * in the errors nested in it (a `FrodoError` does not copy the code of the
 * error it wraps).
 */
function findErrorCode(
  error: unknown,
  depth = 0,
  seen: Set<unknown> = new Set()
): FrodoErrorCode | undefined {
  try {
    if (
      !error ||
      typeof error !== 'object' ||
      depth > MAX_CAUSE_DEPTH ||
      seen.has(error) ||
      !isFrodoErrorLike(error)
    ) {
      return undefined;
    }
    seen.add(error);
    const code = error.code;
    if (
      typeof code === 'string' &&
      (FRODO_ERROR_CODES as readonly string[]).includes(code)
    ) {
      return code;
    }
    const nested = error.originalErrors;
    if (Array.isArray(nested)) {
      for (const cause of nested) {
        const found = findErrorCode(cause, depth + 1, seen);
        if (found) {
          return found;
        }
      }
    }
  } catch {
    // an error whose properties throw has no code to report
  }
  return undefined;
}

/**
 * The verbs of the messages that name an item: `Error Exporting Mappings`,
 * `Error importing the alpha realm journey Broken`, `Failed to delete agent X`.
 */
const ITEM_MESSAGE =
  /^(?:error|failed)\s+(?:(?:to\s+\w+)|\w+ing)\s+(?:the\s+)?(.+)$/i;

/**
 * The label of the item that the first line of a message names, if it does.
 */
function findItemLabel(
  message: string,
  maxItemLabelLength: number
): string | undefined {
  const firstLine = message.split('\n', 1)[0].trim();
  const named = ITEM_MESSAGE.exec(firstLine)?.[1];
  if (!named) {
    return undefined;
  }
  // `Error importing journey 'Broken': 3 errors` names `journey Broken`
  const label = named
    .split(/:\s/, 1)[0]
    .replace(/['"`]/g, '')
    .replace(/[.,;:]+$/, '')
    .trim();
  return label ? cut(label, maxItemLabelLength) : undefined;
}

/** Cuts a text to `max` characters, marking the cut. */
function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

/** Escapes a name for use in a regular expression. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The names whose value is a credential when it follows `name: ` or `name=`:
 * the sensitive body fields and header names of `SensitiveDataUtils`, the one
 * place that lists them.
 */
const CREDENTIAL_NAMES = [
  ...new Set([...SENSITIVE_FIELD_NAMES, ...SENSITIVE_HEADER_NAMES]),
]
  .sort((left, right) => right.length - left.length)
  .map(escapeRegExp)
  .join('|');

/** `name: value`, `name=value` and `"name":"value"` for a credential name. */
const NAMED_CREDENTIAL = new RegExp(
  `(?<![\\w-])(${CREDENTIAL_NAMES})(["']?\\s*[:=]\\s*)(?:(?:bearer|basic|digest|negotiate|ntlm|dpop|token)\\s+)?("[^"]*"|'[^']*'|[^\\s"'&,;}\\])]+)`,
  'gi'
);

/** A bearer token wherever it appears. */
const BEARER_TOKEN = /\b(bearer)\s+[A-Za-z0-9\-._~+/]{8,}=*/gi;

/** A JSON web token (access token, id token, signed assertion). */
const JSON_WEB_TOKEN = /\beyJ[\w-]{4,}\.[\w-]{4,}(?:\.[\w-]*)?/g;

/** The user and password of a URL: `https://user:password@host`. */
const URL_USER_INFO = /(\b[a-z][a-z0-9+.-]*:\/\/)([^\s/@:]+):([^\s/@]+)@/gi;

/** A PEM private key, up to its end line or the end of the text. */
const PRIVATE_KEY =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g;

/**
 * Replaces the credentials that the text of an error may contain: values of
 * credential names (`password=...`, `"access_token":"..."`, `Authorization:
 * Bearer ...`), bearer tokens, JSON web tokens, the password of a URL and
 * private keys. The messages of the library state facts and do not carry
 * credentials, but an error nested in them may echo a request or a response.
 *
 * @param text The text of an error.
 * @returns The text with the credentials replaced by a placeholder.
 */
export function redactCredentials(text: string): string {
  return text
    .replace(PRIVATE_KEY, REDACTED)
    .replace(URL_USER_INFO, `$1$2:${REDACTED}@`)
    .replace(BEARER_TOKEN, `$1 ${REDACTED}`)
    .replace(JSON_WEB_TOKEN, REDACTED)
    .replace(NAMED_CREDENTIAL, `$1$2${REDACTED}`);
}
