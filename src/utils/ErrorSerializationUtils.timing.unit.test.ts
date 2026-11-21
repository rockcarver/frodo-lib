/**
 * Run tests
 *
 *        npm run test:only ErrorSerializationUtils.timing
 *
 * The time that it takes to write an error and to redact a text does not depend
 * on the shape of the text. The text of an error comes from a server, and a text
 * of dotted words, of scheme separators, of at signs or of `eyJ` is as likely as
 * any other: every function that reads such a text has to read it once. The
 * bounds are CPU time (see `CpuTime.ts`: the least of a few runs, and a run that
 * does not return is interrupted and fails the test), generous, and far under
 * what a function that reads a text again for each of its characters takes
 * (minutes).
 */
import { inspect } from 'util';
import { FrodoError } from '../ops/FrodoError';
import { leastCpuMilliseconds } from '../test/utils/CpuTime';
import { failure } from '../test/utils/SerializationForms';
import {
  attachSafeSerialization,
  describeBody,
  describeError,
  MAX_STRUCTURED_TEXT,
} from './ErrorSerializationUtils';
import {
  redactBody,
  redactCredentials,
  redactUrl,
  scrubUrls,
} from './SensitiveDataUtils';

const MEGABYTE = 1024 * 1024;
const BOUND_MS = 2500;

/** The shapes of text that make a careless regular expression take a time that grows with the square of the length. */
const SHAPES: [string, string][] = [
  ['dotted words', 'a.'.repeat(MEGABYTE / 2)],
  ['dashed words', 'a-'.repeat(MEGABYTE / 2)],
  ['dotted scheme', 'a.b+c-'.repeat(MEGABYTE / 6)],
  ['scheme separators', '://'.repeat(MEGABYTE / 3)],
  ['a scheme and separators', 'a://'.repeat(MEGABYTE / 4)],
  ['URLs without an end', 'http://a:b@c/?d=e#f'.repeat(MEGABYTE / 19)],
  ['at signs', '@'.repeat(MEGABYTE)],
  ['user info', 'http://a:b@'.repeat(MEGABYTE / 11)],
  ['question marks', '?'.repeat(MEGABYTE)],
  ['hashes', '#'.repeat(MEGABYTE)],
  ['percent signs', '%'.repeat(MEGABYTE)],
  ['ampersands and equals', 'a=b&'.repeat(MEGABYTE / 4)],
  ['equals', '='.repeat(MEGABYTE)],
  ['token headers', 'eyJ'.repeat(MEGABYTE / 3)],
  ['token parts', 'eyJabcde.'.repeat(MEGABYTE / 9)],
  ['token parts with a dot in front', '.eyJabcde'.repeat(MEGABYTE / 9)],
  ['bearer words', 'Bearer '.repeat(MEGABYTE / 7)],
  ['bearer and a long run', `Bearer ${'a'.repeat(MEGABYTE)}`],
  ['bearer and spaces', `Bearer${' '.repeat(MEGABYTE)}`],
  ['bearer and token headers', `Bearer ${'eyJ'.repeat(MEGABYTE / 3)}`],
  ['named values', 'password='.repeat(MEGABYTE / 9)],
  ['named values with a quote', 'password:"'.repeat(MEGABYTE / 10)],
  ['named values with spaces', `password${' '.repeat(MEGABYTE)}`],
  ['named values with names', 'access_token=password:'.repeat(MEGABYTE / 22)],
  ['key markers', '-----BEGIN PRIVATE KEY-----'.repeat(MEGABYTE / 27)],
  ['angle brackets', '<'.repeat(MEGABYTE)],
  ['links', '<a'.repeat(MEGABYTE / 2)],
  ['refresh words', 'url = '.repeat(MEGABYTE / 6)],
  ['semicolons', ';'.repeat(MEGABYTE)],
  ['quotes', '"'.repeat(MEGABYTE)],
  ['braces', '{'.repeat(MEGABYTE)],
  ['brackets and commas', '[1,'.repeat(MEGABYTE / 3)],
  ['user info candidates', 'a:b@'.repeat(MEGABYTE / 4)],
  ['colons and at signs', ':@'.repeat(MEGABYTE / 2)],
  ['long user info', `${'a:'.repeat(200)}@`.repeat(MEGABYTE / 401)],
  ['user info without end', `${'a:'.repeat(MEGABYTE / 2)}@`],
  ['hosts after at signs', 'a:b@host '.repeat(MEGABYTE / 9)],
  ['token parts with something in front', 'xeyJabcde.'.repeat(MEGABYTE / 10)],
  [
    'tokens with a header that decodes',
    'x-eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.'.repeat(MEGABYTE / 38),
  ],
  [
    'headers that decode and no payload',
    'x-eyJhbGciOiJub25lIn0.'.repeat(MEGABYTE / 22),
  ],
  ['named values with escaped quotes', 'password:"\\"'.repeat(MEGABYTE / 13)],
  ['named values and escapes', `password:"${'\\\\'.repeat(MEGABYTE / 2)}`],
  ['named values and a long string', `password:"${'a'.repeat(MEGABYTE)}`],
  [
    'a header of a megabyte that decodes',
    `x-${Buffer.from(JSON.stringify({ a: 'A'.repeat(MEGABYTE * 0.7) })).toString('base64url')}.abcdefgh`,
  ],
  [
    'a header of a megabyte that does not decode',
    `x-eyJ${'A'.repeat(MEGABYTE)}.abcdefgh`,
  ],
  [
    'callback values',
    `PasswordCallback${'"value":"a",'.repeat(MEGABYTE / 12)}`,
  ],
  [
    'callback values that are not closed',
    'PasswordCallback"value":"'.repeat(MEGABYTE / 25),
  ],
  [
    'escaped callback values',
    `PasswordCallback${'\\"value\\":\\"a\\",'.repeat(MEGABYTE / 16)}`,
  ],
  ['callback words', 'PasswordCallback '.repeat(MEGABYTE / 17)],
  ['values and no callback', '"value":"a",'.repeat(MEGABYTE / 12)],
  ['detail lines', `Detail: {"a":${'1,'.repeat(MEGABYTE / 2)}`],
  ['many detail lines', 'Detail: {"password":"x"}\n'.repeat(MEGABYTE / 24)],
  ['new lines', '\n'.repeat(MEGABYTE)],
];

/** The shapes that the redaction of a text read again and again before the clip came first. */
const QUADRATIC = [
  'dotted words',
  'dashed words',
  'dotted scheme',
  'a scheme and separators',
  'token parts with something in front',
  'tokens with a header that decodes',
  'headers that decode and no payload',
  'a header of a megabyte that does not decode',
];

/** Runs a function and throws when its CPU time (the least of a few runs) is over the bound. */
function within<T>(label: string, run: () => T, bound = BOUND_MS): T {
  let result: T | undefined;
  const milliseconds = leastCpuMilliseconds(() => {
    result = run();
  }, bound);
  if (!(milliseconds < bound)) {
    throw new Error(`${label} took ${milliseconds.toFixed(0)} ms of CPU`);
  }
  return result as T;
}

/** A megabyte in a dozen places: the bound is a few times the one for a single text. */
const manyPlaces = <T>(label: string, run: () => T): T =>
  within(label, run, 5 * BOUND_MS);

describe('writing an error whose text has an adversarial shape', () => {
  test.each(SHAPES)(
    '1: %s: a megabyte in the message of an error',
    (_name, text) => {
      const error = new Error(text, { cause: new Error(text) });
      const view = within('describeError', () => describeError(error)) as {
        message: string;
      };
      expect(view.message.length).toBeLessThan(8000);
      within('JSON.stringify', () => JSON.stringify({ status: error }));
      within('util.inspect', () => inspect(error, { depth: null }));
    }
  );

  test.each(SHAPES)(
    '2: %s: a megabyte in every place of the error of a request',
    (_name, text) => {
      const error = failure({
        url: `https://tenant.example.com/${text}`,
        data: text,
        responseData: text,
        responseHeaders: {
          Location: text,
          'Content-Location': text,
          Link: text,
          Refresh: text,
          'WWW-Authenticate': text,
          'Content-Type': text,
          'X-Custom-Name': text,
          'Set-Cookie': text,
        },
      });
      error.message = text;
      // a request of the library: the error writes the view
      attachSafeSerialization(error);
      manyPlaces('describeError', () => describeError(error));
      // the size of the view does not depend on the size of the text either
      expect(
        manyPlaces('JSON.stringify', () => JSON.stringify(error)).length
      ).toBeLessThan(150_000);
      manyPlaces('util.inspect', () => inspect(error, { depth: null }));
    }
  );

  test.each(SHAPES)(
    '3: %s: a megabyte in the answer that a FrodoError wraps',
    (_name, text) => {
      const error = new FrodoError(
        text,
        failure({
          responseData: {
            message: text,
            detail: { message: text },
            error: text,
            reason: text,
            error_description: text,
          },
        })
      );
      const view = manyPlaces('describeError', () => describeError(error)) as {
        combinedMessage: string;
      };
      expect(view.combinedMessage.length).toBeLessThan(8000);
      manyPlaces('JSON.stringify', () => JSON.stringify(error));
      manyPlaces('util.inspect', () => inspect(error, { depth: null }));
    }
  );

  test.each(SHAPES)(
    '4: %s: a megabyte as a detail line of the combined message',
    (_name, text) => {
      const error = new FrodoError(
        'outer',
        failure({ responseData: { detail: text } })
      );
      within('describeError', () => describeError(error));
    }
  );
});

describe('redacting a text of an adversarial shape', () => {
  test.each(SHAPES)('5: %s: a megabyte through each function', (name, text) => {
    // the shapes that a regular expression read again and again are cut down so that a function
    // that still does it ends in a minute and not in an hour
    const size = QUADRATIC.includes(name) ? text.slice(0, 128 * 1024) : text;
    within('scrubUrls', () => scrubUrls(size));
    within('redactUrl', () => redactUrl(size));
    within('redactCredentials', () => redactCredentials(size));
    within('redactBody', () => redactBody(size));
    within('redactBody of a form', () => redactBody(`a=${size}&b=c`));
  });
});

describe('writing an error that holds the same error many times', () => {
  /** An error with `width` children, all the same error, `depth` levels deep: `width ** depth` ways to reach a leaf. */
  function shared(depth: number, width: number, message = 'x') {
    let level = new FrodoError(message);
    for (let index = 0; index < depth; index++) {
      level = new FrodoError(`${message} ${index}`, Array(width).fill(level));
    }
    return level;
  }

  /** The least CPU time of a few runs, so that a pause of the machine does not decide. */
  const fastest = (run: () => unknown, bound: number): number =>
    leastCpuMilliseconds(run, bound);

  test('1: 8 levels of 8 shared children (16 million ways to reach a leaf) are written in the time of a few errors', () => {
    const error = shared(8, 8);
    expect(fastest(() => JSON.stringify(error), 100)).toBeLessThan(100);
    expect(fastest(() => inspect(error, { depth: null }), 100)).toBeLessThan(
      100
    );
    expect(fastest(() => describeError(error), 100)).toBeLessThan(100);
  });

  test('2: the same, with a message of 4 MiB in every error', () => {
    const error = shared(8, 8, 'x'.repeat(4 * MEGABYTE));
    expect(fastest(() => JSON.stringify(error), 1000)).toBeLessThan(1000);
  });

  test('3: a message of 4 MiB is written in a fraction of a second', () => {
    const error = new FrodoError('y'.repeat(4 * MEGABYTE), failure());
    expect(fastest(() => JSON.stringify(error), 500)).toBeLessThan(500);
  });

  test('4: what is written of the shared graph is the head of the text of the error, and says how long it is', () => {
    // a graph that is small enough to build the whole text: the head is the same
    const error = shared(4, 4, 'xxxxxx');
    const whole = error.getCombinedMessage();
    expect(whole.length).toBeGreaterThan(4000);
    expect(whole.length).toBeLessThan(20_000);
    const view = describeError(error) as { combinedMessage: string };
    expect(view.combinedMessage).toBe(
      `${whole.slice(0, 4000)}... (${whole.length} characters)`
    );
  });
});

describe('redacting a text that is many megabytes long', () => {
  const MEBIBYTE = 1024 * 1024;
  const big = (length: number, character = 'a') => character.repeat(length);

  // `redactCredentials` is also used on text that is not cut first (the message of a
  // failed item of a collected result): an expression that keeps an entry per character
  // runs the stack of the engine out on a value of many megabytes and throws
  const LARGE: [string, string, string][] = [
    [
      'a quoted value of 16 MiB',
      `{"password":"${big(16 * MEBIBYTE)}"}`,
      '{"password":"<redacted>"}',
    ],
    [
      'a value in escaped quotes of 16 MiB',
      `{\\"password\\":\\"${big(16 * MEBIBYTE)}\\"}`,
      '{\\"password\\":\\"<redacted>\\"}',
    ],
    [
      'a bearer value of 16 MiB',
      `Bearer ${big(16 * MEBIBYTE)}`,
      'Bearer <redacted>',
    ],
    [
      'a bare value of 16 MiB',
      `password=${big(16 * MEBIBYTE)}`,
      'password=<redacted>',
    ],
    [
      'a token with a header of 6 MiB and a payload',
      `eyJ${big(6 * MEBIBYTE, 'A')}.abcdefgh`,
      '<redacted>',
    ],
    [
      'a header of 6 MiB behind a word that decodes as JSON, and a payload',
      `x-${Buffer.from(JSON.stringify({ a: big(5 * MEBIBYTE) })).toString('base64url')}.abcdefgh`,
      'x-<redacted>',
    ],
    [
      'a header of 6 MiB behind a word that does not decode as JSON: not a token',
      `x-eyJ${big(6 * MEBIBYTE, 'A')}.abcdefgh`,
      `x-eyJ${big(6 * MEBIBYTE, 'A')}.abcdefgh`,
    ],
    [
      'a single part of 6 MiB that starts with eyJ',
      `eyJ${big(6 * MEBIBYTE, 'A')}`,
      `eyJ${big(6 * MEBIBYTE, 'A')}`,
    ],
    [
      'a payload of 6 MiB behind a header',
      `eyJhbGciOiJub25lIn0.${big(6 * MEBIBYTE, 'A')}`,
      '<redacted>',
    ],
  ];

  test('2: a text that no expression can read is not passed on, and no exception is thrown', () => {
    // millions of escapes in one quoted value: whether the engine reads it or runs out of its
    // stack, what comes back holds none of the value
    const redacted = redactCredentials(
      `{"password":"${'\\\\'.repeat(4 * MEBIBYTE)}"}`
    );
    expect(redacted.length).toBeLessThan(100);
    expect(redacted).toContain('<redacted>');
  });

  test.each(LARGE)('1: %s', (_name, text, expected) => {
    let redacted = '';
    const milliseconds = leastCpuMilliseconds(() => {
      redacted = redactCredentials(text);
    }, BOUND_MS * 4);
    expect(redacted === expected).toBe(true);
    expect(milliseconds).toBeLessThan(BOUND_MS * 4);
  });
});

describe('writing an answer that holds a JSON text of megabytes inside a string', () => {
  const MEBIBYTE = 1024 * 1024;

  /** The least CPU time of a few runs, in milliseconds: a load on the machine does not count. */
  const cpu = (run: () => unknown, bound: number) =>
    leastCpuMilliseconds(run, bound);

  /** The texts that a tenant can answer with: JSON of 3 MiB or more, of four shapes. */
  const TEXTS: [string, string][] = [
    [
      'an object with many keys',
      JSON.stringify(
        Object.fromEntries(
          Array.from({ length: 60_000 }, (_, index) => [
            `key${index}`,
            'x'.repeat(40),
          ])
        )
      ),
    ],
    [
      'a list of strings',
      JSON.stringify(Array.from({ length: 80_000 }, () => 'x'.repeat(36))),
    ],
    ['deep lists', `${'['.repeat(300_000)}${']'.repeat(300_000)}`],
    [
      'a list of small objects',
      JSON.stringify(
        Array.from({ length: 50_000 }, (_, index) => ({
          n: index,
          v: 'abcdefghij',
        }))
      ),
    ],
  ];

  const padded = (text: string) =>
    text.length < 3 * MEBIBYTE
      ? `${text}${' '.repeat(3 * MEBIBYTE - text.length)}`
      : text;

  test.each(TEXTS)(
    '1: %s as the value of a string in an object (describeBody): about as long as writing the object',
    (_name, text) => {
      const body = { echo: padded(text) };
      expect(cpu(() => describeBody(body), 150)).toBeLessThan(150);
    }
  );

  test.each(TEXTS)(
    '2: %s as the detail of an answer in the view of a FrodoError (JSON.stringify, util.inspect)',
    (_name, text) => {
      const error = new FrodoError(
        'Error',
        failure({ responseData: { detail: { echo: padded(text) } } })
      );
      const milliseconds = cpu(() => {
        JSON.stringify(error);
        inspect(error, { depth: null });
      }, 1000);
      expect(milliseconds).toBeLessThan(1000);
    }
  );

  test.each(TEXTS)(
    '3: %s as the whole body of an answer that is text: read once as a body',
    (_name, text) => {
      expect(cpu(() => describeBody(padded(text)), 600)).toBeLessThan(600);
    }
  );

  /** Texts that are no JSON (they start with a letter) and have a value to replace in every few characters. */
  const PLAIN_TEXTS: [string, string][] = [
    ['a form with many passwords', 'a=1&password=abcdefgh&'.repeat(200_000)],
    [
      'many user infos of URLs',
      'see http://user:abcdefgh@host.example/path?x=1 '.repeat(100_000),
    ],
    ['many bearer values', 'Bearer abcdefgh1234567890 '.repeat(200_000)],
  ];

  test.each(PLAIN_TEXTS)(
    '3b: %s (a text of several MiB that is no JSON) is written from its head: the time does not depend on its length',
    (_name, text) => {
      expect(text.length).toBeGreaterThan(3 * MEBIBYTE);
      expect(cpu(() => describeBody(text), 40)).toBeLessThan(40);
      expect(cpu(() => describeBody({ echo: text }), 120)).toBeLessThan(120);
    }
  );

  test('4: a text within the bound is read as structure, a longer one is not written', () => {
    const callback = (value: string) => ({
      callbacks: [
        {
          type: 'PasswordCallback',
          input: [{ name: 'IDToken2', value }],
        },
      ],
    });
    const within = JSON.stringify({
      ...callback('MARKER-V-0001'),
      padding: 'x'.repeat(MAX_STRUCTURED_TEXT / 2),
    });
    expect(within.length).toBeLessThan(MAX_STRUCTURED_TEXT);
    expect(JSON.stringify(describeBody({ echo: within }))).not.toContain(
      'MARKER-V-0001'
    );
    // longer than the bound: nothing of it is written, only how long it is
    const longer = JSON.stringify({
      ...callback('MARKER-V-0002'),
      padding: 'x'.repeat(2 * MAX_STRUCTURED_TEXT),
    });
    expect(longer.length).toBeGreaterThan(MAX_STRUCTURED_TEXT);
    expect(describeBody({ echo: longer })).toEqual({
      echo: `<text of ${longer.length} characters not written>`,
    });
  });
});
