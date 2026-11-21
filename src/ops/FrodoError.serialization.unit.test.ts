/**
 * Run tests
 *
 *        npm run test:only FrodoError.serialization.unit
 *
 * How a `FrodoError` is written when it is serialized or printed: its own
 * fields and its original errors, each without the request configuration an
 * `AxiosError` holds. The text of `getCombinedMessage()` is not changed.
 */
import { inspect } from 'util';
import { jest } from '@jest/globals';
import {
  allForms,
  failure,
  MARKER_A,
  MARKER_B,
  MARKER_C,
  MARKER_D,
} from '../test/utils/SerializationForms';
import { attachSafeSerialization } from '../utils/ErrorSerializationUtils';
import { FrodoError } from './FrodoError';

/** The forms that write the combined message, which is the text of the error and is not changed. */
const TEXT_FORMS = ['%s', 'String', 'template'];

function expectNoMarker(
  value: unknown,
  markers: string[] = [MARKER_A],
  skip: string[] = []
) {
  for (const [form, text] of Object.entries(allForms(value))) {
    if (skip.includes(form)) continue;
    for (const marker of markers) {
      if (text.includes(marker)) {
        throw new Error(`${marker} is in the form '${form}':\n${text}`);
      }
    }
  }
}

describe('a FrodoError that wraps the error of a failed request', () => {
  test.each([1, 2, 3])(
    '1: wrapped %i time(s), no form holds the request configuration',
    (levels) => {
      let error = new FrodoError('Error deleting node n1', failure());
      for (let level = 2; level <= levels; level++) {
        error = new FrodoError(`Error at level ${level}`, error);
      }
      expectNoMarker(error);
    }
  );

  test('2: it writes its own fields and the view of the original errors', () => {
    const error = new FrodoError(
      'Error deleting node n1',
      failure({ responseData: { message: 'conflict', reason: 'Conflict' } })
    );
    const view = JSON.parse(JSON.stringify(error));
    expect(view).toMatchObject({
      name: 'FrodoError',
      message: 'Error deleting node n1',
      isHttpError: true,
      httpCode: 'ERR_BAD_REQUEST',
      httpStatus: 409,
      httpMessage: 'conflict',
      httpErrorReason: 'Conflict',
    });
    expect(view.combinedMessage).toBe(error.getCombinedMessage());
    expect(view.originalErrors).toHaveLength(1);
    expect(view.originalErrors[0]).toMatchObject({
      name: 'AxiosError',
      status: 409,
      method: 'DELETE',
      url: 'https://tenant.example.com/am/json/trees/n1',
      headers: { Authorization: 'Bearer <redacted>' },
    });
  });

  test('3: the code, the transaction id and the rate limit are written', () => {
    const error = new FrodoError('Error', failure(), 'LOG_API_RATE_LIMITED');
    error.httpTransactionId = 'txn-1';
    error.rateLimit = { limit: 10, remaining: 0, resetAt: 1000 } as never;
    expect(JSON.parse(JSON.stringify(error))).toMatchObject({
      code: 'LOG_API_RATE_LIMITED',
      httpTransactionId: 'txn-1',
      rateLimit: { limit: 10, remaining: 0, resetAt: 1000 },
    });
  });

  test('4: a list of original errors, a nested FrodoError, a cause and an AggregateError', () => {
    const inner = new FrodoError('inner', failure());
    const plain = new Error('plain', { cause: failure() });
    const aggregate = new AggregateError([failure()], 'aggregate');
    const error = new FrodoError('outer', [inner, plain, aggregate]);
    expectNoMarker(error);
    const view = JSON.parse(JSON.stringify(error));
    expect(
      view.originalErrors.map((nested: { name: string }) => nested.name)
    ).toEqual(['FrodoError', 'Error', 'AggregateError']);
    expect(view.originalErrors[1].cause.name).toBe('AxiosError');
    expect(view.originalErrors[2].errors[0].name).toBe('AxiosError');
  });

  test('4b: a FrodoError that has a cause is written with the cause the same way', () => {
    const error = new FrodoError('outer');
    (error as { cause?: unknown }).cause = failure();
    expectNoMarker(error);
    expect(JSON.parse(JSON.stringify(error)).cause.name).toBe('AxiosError');
  });

  test('5: an error that holds a list of errors that refers back to it', () => {
    const error = new FrodoError('outer', new Error('inner'));
    error.originalErrors.push(error);
    expect(JSON.parse(JSON.stringify(error)).originalErrors[1]).toBe(
      '[Circular]'
    );
    expect(() => inspect(error, { depth: null })).not.toThrow();
  });

  test('6: the request body and the URL are written with their sensitive values replaced', () => {
    const error = new FrodoError(
      'Error',
      failure({
        url: `https://tenant.example.com/am/x?password=${MARKER_C}`,
        data: JSON.stringify({ userPassword: MARKER_C }),
        headers: { Cookie: `iPlanetDirectoryPro=${MARKER_B}` },
      })
    );
    // the combined message is the text of the error and says the URL as it is
    expectNoMarker(error, [MARKER_C, MARKER_B], TEXT_FORMS);
    expectNoMarker(error, [MARKER_B]);
    expect(JSON.parse(JSON.stringify(error)).originalErrors[0].url).toBe(
      'https://tenant.example.com/am/x?password=<redacted>'
    );
  });

  test('6b: a URL in the message is written with its sensitive values replaced, in the JSON and in the inspection', () => {
    const error = new FrodoError(
      `Error reading 'https://tenant.example.com/am/x?access_token=${MARKER_A}&a=1'`,
      failure()
    );
    // the message itself is the text of the error and says the URL as it is
    expectNoMarker(error, [MARKER_A], TEXT_FORMS);
    expect(JSON.parse(JSON.stringify(error)).message).toBe(
      "Error reading 'https://tenant.example.com/am/x?access_token=<redacted>&a=1'"
    );
    expect(inspect(error, { depth: null })).not.toContain(
      `access_token=${MARKER_A}`
    );
  });

  test('7: a returned object that holds the error is written as a view', () => {
    // the error of a request of the library has passed the interceptor of BaseApi
    const raw = failure();
    attachSafeSerialization(raw);
    const status = {
      status: 'success',
      nodes: {
        n1: { status: 'error', error: new FrodoError('n1', failure()) },
        n2: { status: 'error', error: raw },
        n3: { status: 'success' },
      },
    };
    expectNoMarker(status);
    const written = JSON.parse(JSON.stringify(status));
    expect(written.nodes.n3).toEqual({ status: 'success' });
    expect(written.nodes.n2.error.headers.Authorization).toBe(
      'Bearer <redacted>'
    );
  });

  test('8: the error keeps its shape for the code that reads it', () => {
    const cause = failure();
    const error = new FrodoError('Error', cause);
    expect(error.originalErrors[0]).toBe(cause);
    expect(error.httpStatus).toBe(409);
    expect(cause.config?.headers?.get('Authorization')).toBe(
      `Bearer ${MARKER_A}`
    );
    expect(Object.keys(error)).toEqual(
      expect.arrayContaining(['originalErrors', 'isHttpError', 'httpStatus'])
    );
    expect(Object.keys(error)).not.toContain('toJSON');
    expect(error.getCombinedMessage()).toBe(
      [
        'Error',
        '  Network error:',
        '    URL: https://tenant.example.com/am/json/trees/n1',
        '    Status: 409',
        '    Code: ERR_BAD_REQUEST',
        '    Message: sample failure',
      ].join('\n')
    );
    expect(String(error)).toBe(error.getCombinedMessage());
  });

  test('9: util.inspect prints the stack and the view', () => {
    const text = inspect(new FrodoError('Error deleting node n1', failure()), {
      depth: null,
    });
    expect(text.startsWith('FrodoError: Error deleting node n1\n')).toBe(true);
    expect(text).toContain("Authorization: 'Bearer <redacted>'");
    expect(text).toContain('httpStatus: 409');
  });

  test('10: errors that are many or shared are written within the bounds of the view', () => {
    const shared = failure();
    const many = Array.from({ length: 5000 }, () => shared);
    const view = JSON.parse(JSON.stringify(new FrodoError('many', many)));
    expect(view.originalErrors[0].name).toBe('AxiosError');
    expect(view.originalErrors[1]).toBe('[Repeated]');
    expect(JSON.stringify(view).length).toBeLessThan(20_000);
  });

  test('11: the fields that the answer gives are written with their sensitive values replaced', () => {
    const error = new FrodoError(
      'Error',
      failure({
        responseData: {
          message: `password=${MARKER_C}&a=1`,
          detail: {
            password: MARKER_C,
            callbacks: [
              {
                type: 'PasswordCallback',
                input: [{ name: 'IDToken2', value: MARKER_D }],
              },
            ],
          },
          error: `client_secret=${MARKER_D}`,
          reason: `access_token=${MARKER_A}`,
          error_description: `assertion=${MARKER_B}`,
        },
      })
    );
    const view = JSON.parse(JSON.stringify(error));
    expect(view.httpMessage).toBe('password=<redacted>&a=1');
    expect(view.httpDetail.password).toBe('<redacted>');
    expect(view.httpDetail.callbacks[0].input[0].value).toBe('<redacted>');
    expect(view.httpErrorText).toBe('client_secret=<redacted>');
    expect(view.httpErrorReason).toBe('access_token=<redacted>');
    expect(view.httpDescription).toBe('assertion=<redacted>');
    expectNoMarker(error, [MARKER_A, MARKER_B, MARKER_C, MARKER_D], TEXT_FORMS);
  });

  test('12: the combined message of the view is written with the same replacements as the detail', () => {
    const error = new FrodoError(
      'Error',
      failure({
        responseData: {
          message: 'conflict',
          detail: {
            password: MARKER_C,
            callbacks: [
              {
                type: 'PasswordCallback',
                input: [{ name: 'IDToken2', value: MARKER_D }],
              },
            ],
          },
          error_description: `assertion ${MARKER_B}`,
        },
      })
    );
    // the text of the error is what it was, byte for byte: it says the detail as it is
    const text = error.getCombinedMessage();
    expect(text).toContain(`"password":"${MARKER_C}"`);
    expect(text).toContain(MARKER_D);
    const view = JSON.parse(JSON.stringify(error));
    expect(view.combinedMessage).toContain('Detail: {"password":"<redacted>"');
    expect(view.combinedMessage).toContain('"value":"<redacted>"');
    expect(view.combinedMessage).not.toContain(MARKER_C);
    expect(view.combinedMessage).not.toContain(MARKER_D);
    expect(view.combinedMessage).toContain('Message: conflict');
    expectNoMarker(error, [MARKER_C, MARKER_D], TEXT_FORMS);
    expect(inspect(error, { depth: null })).not.toContain(MARKER_D);
  });

  test('13: a detail that is not JSON, or is cut, is written with the generic replacements', () => {
    const error = new FrodoError(
      'Error',
      failure({
        responseData: {
          message: 'conflict',
          detail: `{"password":"${MARKER_C}", "broken": `,
        },
      })
    );
    const view = JSON.parse(JSON.stringify(error));
    expect(view.combinedMessage).not.toContain(MARKER_C);
  });

  test('13b: the combined message is cut, and the note says how long the text that the view built was', () => {
    const error = new FrodoError(
      'Error',
      failure({
        responseData: {
          message: 'conflict',
          detail: { password: MARKER_C, notes: 'x'.repeat(20_000) },
        },
      })
    );
    const whole = error.getCombinedMessage();
    expect(whole.length).toBeGreaterThan(20_000);
    const view = JSON.parse(JSON.stringify(error));
    // the detail is written as a body is (cut at 4000 characters), then the whole text is cut
    expect(view.combinedMessage).toMatch(/\.\.\. \(\d+ characters\)$/);
    expect(view.combinedMessage.length).toBeLessThan(4100);
    expect(view.combinedMessage).not.toContain(MARKER_C);
    expect(view.combinedMessage).toContain('Message: conflict');
  });

  test('13c: only a head of the combined message is built: the details past the budget are not written', () => {
    const many = Array.from({ length: 10_000 }, () =>
      failure({ responseData: { detail: { note: 'a detail line' } } })
    );
    const error = new FrodoError('Error', many);
    // ten thousand detail lines, a few thousand characters of them are written
    expect(error.getCombinedMessage().split('Detail: ').length).toBe(10_001);
    const parse = jest.spyOn(JSON, 'parse');
    try {
      const view = JSON.parse(JSON.stringify(error));
      const parsedForTheView = parse.mock.calls.length;
      expect(view.combinedMessage.length).toBeLessThan(4100);
      expect(view.combinedMessage).toContain('"note":"a detail line"');
      // the view writes the first 50 errors and builds the head of the text for them: not the 10,000 details
      expect(parsedForTheView).toBeLessThan(3000);
    } finally {
      parse.mockRestore();
    }
  });

  test('13d: the detail is written as a body is, with the answers of a password callback and the fields replaced, then the whole text is cut', () => {
    const many = Array.from({ length: 2000 }, () =>
      failure({ responseData: { detail: { password: 'x', secret: 'y' } } })
    );
    const error = new FrodoError('Error', many);
    const view = JSON.parse(JSON.stringify(error));
    expect(view.combinedMessage).toContain('"password":"<redacted>"');
    expect(view.combinedMessage).toMatch(/\.\.\. \(\d+ characters\)$/);
    // the written text is 4000 characters and the note
    expect(view.combinedMessage.length).toBeLessThan(4100);
  });

  test('13e: a URL without a scheme in the combined message is written with its user info replaced; the text of the error is what it was', () => {
    const url = `//admin:${MARKER_C}@host.example.com/path`;
    const error = new FrodoError('Error', failure({ url }));
    // the text of the error says the URL as it is
    expect(error.getCombinedMessage()).toContain(`URL: ${url}`);
    const view = JSON.parse(JSON.stringify(error));
    expect(view.combinedMessage).toContain(
      'URL: //admin:<redacted>@host.example.com/path'
    );
    expect(view.combinedMessage).not.toContain(MARKER_C);
    expectNoMarker(error, [MARKER_C], TEXT_FORMS);
  });

  test('13f: the combined message of the view is the head of the combined message of the error, for errors that nest and share', () => {
    const leaf = new FrodoError('leaf');
    const middle = new FrodoError('middle', [leaf, leaf, new Error('plain')]);
    const root = new FrodoError('root', [middle, middle, failure()]);
    const whole = root.getCombinedMessage();
    expect(whole.split('leaf').length - 1).toBe(4);
    const view = JSON.parse(JSON.stringify(root));
    expect(view.combinedMessage).toBe(whole);
  });

  test('13g: the combined message of an error is built whole when no view is being written, however large', () => {
    // 5 levels with 5 children each, all the same error: 5^5 leaves
    let level = new FrodoError('leaf');
    for (let depth = 0; depth < 5; depth++) {
      level = new FrodoError(`level ${depth}`, Array(5).fill(level));
    }
    const whole = level.getCombinedMessage();
    expect(whole.split('leaf').length - 1).toBe(5 ** 5);
    // and what the view built did not change what an error builds afterwards
    JSON.stringify(level);
    expect(level.getCombinedMessage()).toBe(whole);
  });

  test('13h: the view builds a bounded part of the combined message of an error that holds the same error many times', () => {
    // 6 levels of 6 children that are all the same error: 6^6 = 46,656 ways to reach a leaf
    let level = new FrodoError('x'.repeat(100));
    for (let depth = 0; depth < 6; depth++) {
      level = new FrodoError(`level ${depth}`, Array(6).fill(level));
    }
    const build = jest.spyOn(FrodoError.prototype, 'getCombinedMessage');
    try {
      // what an error builds for the caller: every way to reach a leaf
      level.getCombinedMessage();
      const callsForTheCaller = build.mock.calls.length;
      expect(callsForTheCaller).toBeGreaterThan(46_000);
      build.mockClear();
      const view = JSON.parse(JSON.stringify(level));
      // what it builds for the view: the head of the text, in a few thousand calls per error written
      expect(build.mock.calls.length).toBeLessThan(callsForTheCaller / 2);
      expect(view.combinedMessage.length).toBeLessThan(4100);
      expect(view.combinedMessage.startsWith('level 5\n  level 4')).toBe(true);
    } finally {
      build.mockRestore();
    }
  });

  describe('the combined message of the view is as strong as the detail of the view', () => {
    const detail = (value: unknown) =>
      new FrodoError('Error', failure({ responseData: { detail: value } }));

    // the value to hide is spelled `V` here: a made-up value that appears nowhere else
    const V = 'MARKER-V-0001';
    const callback = (value: string) => ({
      callbacks: [
        {
          type: 'PasswordCallback',
          input: [{ name: 'IDToken2', value }],
        },
      ],
    });

    test.each([
      [
        'a JSON text in a string value',
        { echoed: JSON.stringify({ password: V }) },
      ],
      [
        'a JSON text in a JSON text in a string value (two levels)',
        { a: JSON.stringify({ b: JSON.stringify({ password: V }) }) },
      ],
      [
        'a list of JSON texts',
        { list: [JSON.stringify({ client_secret: V }), 'x'] },
      ],
      ['a JSON text that is the detail', JSON.stringify({ password: V })],
      [
        'the answer to a password callback, in a detail of 6000 characters',
        { ...callback(V), padding: 'x'.repeat(6000) },
      ],
      [
        'the answer to a password callback, after 4900 characters of detail',
        { padding: 'x'.repeat(4900), ...callback(V) },
      ],
      [
        'a field with a name, after 6000 characters of detail',
        { padding: 'x'.repeat(6000), password: V },
      ],
      [
        'a JSON text with an answer to a password callback, in a string value',
        { echoed: JSON.stringify(callback(V)) },
      ],
      [
        'a JSON text with an answer to a password callback, in a JSON text in a string value (two levels)',
        { x: JSON.stringify({ y: JSON.stringify(callback(V)) }) },
      ],
      [
        'a JSON text with an answer to a password callback, in four levels of JSON texts in strings',
        {
          x: JSON.stringify({
            y: JSON.stringify({
              z: JSON.stringify({ w: JSON.stringify(callback(V)) }),
            }),
          }),
        },
      ],
    ])('13i: %s: the value is in no part of the view', (_name, value) => {
      const error = detail(value);
      const view = JSON.parse(JSON.stringify(error));
      expect(JSON.stringify(view.httpDetail)).not.toContain(V);
      expect(view.combinedMessage).not.toContain(V);
      expectNoMarker(error, [V], TEXT_FORMS);
      expect(inspect(error, { depth: null })).not.toContain(V);
    });

    describe('a combined message that the view reads as text (an error that builds it its own way)', () => {
      const V = 'MARKER-V-0001';
      const withText = (text: string) => {
        const error = new FrodoError('Error');
        error.getCombinedMessage = () => text;
        return error;
      };

      test('13k: a `Detail:` line is read as JSON, so the answer to a password callback in it is replaced', () => {
        const text = `Error\n  Detail: ${JSON.stringify({
          callbacks: [
            {
              type: 'PasswordCallback',
              input: [{ name: 'IDToken2', value: V }],
            },
          ],
        })}\n  Detail: ${JSON.stringify({ password: V })}`;
        const view = JSON.parse(JSON.stringify(withText(text)));
        expect(view.combinedMessage).not.toContain(V);
        expect(view.combinedMessage).toContain('"value":"<redacted>"');
      });

      test('13l: only the head of such a text is read, and the note says how long it was', () => {
        const lines = Array.from(
          { length: 10_000 },
          () => '  Detail: {"note":"a detail line"}'
        );
        const text = `Error\n${lines.join('\n')}`;
        const parse = jest.spyOn(JSON, 'parse');
        try {
          const view = JSON.parse(JSON.stringify(withText(text)));
          // the lines of the head, a few hundred: not the 10,000 of the text
          expect(parse.mock.calls.length).toBeLessThan(1000);
          expect(
            view.combinedMessage.endsWith(`... (${text.length} characters)`)
          ).toBe(true);
          expect(view.combinedMessage.length).toBeLessThan(4100);
        } finally {
          parse.mockRestore();
        }
      });
    });

    describe('the lines of a combined message that holds JSON', () => {
      const withLines = (text: string) => {
        const error = new FrodoError('x', failure());
        (
          error as unknown as { getCombinedMessage: () => string }
        ).getCombinedMessage = () => text;
        return JSON.parse(JSON.stringify(error)).combinedMessage as string;
      };

      test('13n: a line that is no `Detail:` line and holds JSON is not written, the other lines are', () => {
        const line = `HTTP body: {"password":"${V}"}`;
        const written = withLines(`Error reading\n  ${line}\n  Code: 400`);
        expect(written).not.toContain(V);
        expect(written).toContain('Error reading');
        expect(written).toContain('Code: 400');
        expect(written).toContain(
          `<text of ${`  ${line}`.length} characters not written>`
        );
      });

      test('13o: a `Detail:` line that is not a JSON text and holds JSON is not written', () => {
        const line = `  Detail: see {"password":"${V}"} for more`;
        const written = withLines(`Error\n${line}`);
        expect(written).not.toContain(V);
        expect(written).toContain(
          `<text of ${line.length} characters not written>`
        );
      });

      test('13p: a `Detail:` line that is a JSON text that does not parse is not written', () => {
        const json = `{"password":"a\\"${V}`;
        const written = withLines(`Error\n  Detail: ${json}`);
        expect(written).not.toContain(V);
        expect(written).toContain(
          `Detail: <text of ${json.length} characters not written>`
        );
      });

      test.each([
        'Network error:',
        'URL:',
        'Status:',
        'Code:',
        'Error:',
        'Reason:',
        'Message:',
        'Detail:',
        'Description:',
        'Transaction id:',
      ])(
        '13q2: the lines of a text that a line opened end at the line that starts with %s',
        (label) => {
          const written = withLines(
            `Error\n  body: {\n  "a": "${V}"\n  }\n  ${label} stays\n  tail`
          );
          expect(written).not.toContain(V);
          const run = `  body: {\n  "a": "${V}"\n  }`;
          const note = `<text of ${run.length} characters not written>`;
          expect(written).toBe(`Error\n${note}\n  ${label} stays\n  tail`);
        }
      );

      test('13q3: a label inside a line does not end the lines of the text', () => {
        const written = withLines(
          `Error\n  body: {\n  "a": "see Code: 1 ${V}"\n  }\n  Code: 400`
        );
        expect(written).not.toContain(V);
        expect(written.endsWith('\n  Code: 400')).toBe(true);
      });

      test('13q: a line that holds no JSON is written as it is', () => {
        expect(withLines('Error reading\n  Code: 400\n  Detail: plain')).toBe(
          'Error reading\n  Code: 400\n  Detail: plain'
        );
      });
    });

    describe('the message of several lines that looks like JSON, in the combined message', () => {
      const AFTER = '\n  Code: 400';
      const withMessage = (message: string, combined = message + AFTER) => {
        const error = new FrodoError(message, failure());
        (
          error as unknown as { getCombinedMessage: () => string }
        ).getCombinedMessage = () => combined;
        return JSON.parse(JSON.stringify(error)) as {
          message: string;
          combinedMessage: string;
        };
      };
      const V2 = 'ZQXlineTAIL4321';

      test.each([
        [
          'a JSON text with a line break in a value',
          `{"password":"${V}\n${V2}"}`,
        ],
        ['a JSON text after a prefix', `Error: {"password":"${V}\n${V2}"}`],
        [
          'an XML element with a line break in the value',
          `<login><password>${V}\n${V2}</password></login>`,
        ],
        [
          'an HTML field with a line break in the value',
          `<form><input type="password" name="p" value="${V}\n${V2}"></form>`,
        ],
      ])(
        '13r: %s is one text, the lines after it are written',
        (_name, message) => {
          const view = withMessage(message);
          expect(view.combinedMessage).toBe(
            `<text of ${message.length} characters not written>${AFTER}`
          );
          expect(view.message).toBe(
            `<text of ${message.length} characters not written>`
          );
        }
      );

      test('13s: a message of several lines that parses is written as its structure', () => {
        const message = `{\n  "a": 1,\n  "password": "${V}"\n}`;
        expect(withMessage(message).combinedMessage).toBe(
          `{"a":1,"password":"<redacted>"}${AFTER}`
        );
      });

      test('13t: a message of several lines that does not look like JSON is read line by line, as before', () => {
        const message = 'First line\n  Second line';
        expect(withMessage(message).combinedMessage).toBe(message + AFTER);
        // a message that holds a line of JSON looks like JSON as a whole (as the `message` of the view does)
        const mixed = `First line\n  body: {"password":"${V}"}`;
        const view = withMessage(mixed);
        expect(view.message).toBe(
          `<text of ${mixed.length} characters not written>`
        );
        expect(view.combinedMessage).toBe(
          `<text of ${mixed.length} characters not written>${AFTER}`
        );
      });

      test('13u: a message of one line that looks like JSON is read as a line, as before', () => {
        // it parses, and would be written as its structure if it were read as a message
        expect(withMessage('{"a":1}').combinedMessage).toBe(
          `<text of 7 characters not written>${AFTER}`
        );
      });

      test('13v: a combined message that does not start with the message is read line by line', () => {
        const view = withMessage(
          `a\n{"password":"${V}\n${V2}"}`,
          `other\n  {"password":"${V}\n${V2}"}`
        );
        expect(view.combinedMessage).not.toContain(V);
        expect(view.combinedMessage.startsWith('other\n')).toBe(true);
      });

      test('13x: an error whose message is no text has its combined message read line by line', () => {
        const error = new FrodoError('x', failure());
        Object.assign(error, {
          message: undefined,
          getCombinedMessage: () => `{"a":1}${AFTER}`,
        });
        const view = JSON.parse(JSON.stringify(error));
        expect(view.combinedMessage).toBe(
          `<text of 7 characters not written>${AFTER}`
        );
      });

      test('13w: a message longer than the head of the combined message is written as one text, with the length of the whole', () => {
        const message = `{"password":"${V}\n${'x'.repeat(6000)}"}`;
        const view = withMessage(message);
        expect(view.combinedMessage).toBe(
          `<text of ${message.length} characters not written>... (${message.length + AFTER.length} characters)`
        );
      });
    });

    describe('a text of several lines in the chain of the combined message', () => {
      const PRETTY = `Invalid value:\n{\n  "name": "x-api-key",\n  "value": "${V}"\n}`;
      const RUN = PRETTY.slice(PRETTY.indexOf('\n') + 1);
      const NOTE = `<text of ${RUN.length} characters not written>`;
      const view = (error: FrodoError) =>
        JSON.parse(JSON.stringify(error)).combinedMessage as string;

      test.each([
        [
          'the message of the answer',
          () =>
            new FrodoError(
              'outer',
              failure({ responseData: { message: PRETTY } })
            ),
        ],
        [
          'the error_description of the answer',
          () =>
            new FrodoError(
              'outer',
              failure({ responseData: { error_description: PRETTY } })
            ),
        ],
        [
          'the error of the answer',
          () =>
            new FrodoError(
              'outer',
              failure({ responseData: { error: PRETTY } })
            ),
        ],
        [
          'the reason of the answer',
          () =>
            new FrodoError(
              'outer',
              failure({ responseData: { reason: PRETTY } })
            ),
        ],
        [
          'the message of a plain error',
          () => new FrodoError('outer', new Error(PRETTY)),
        ],
        [
          'the message of a nested error',
          () => new FrodoError('outer', new FrodoError(PRETTY, failure())),
        ],
        [
          'the message of an error nested twice',
          () =>
            new FrodoError(
              'outer',
              new FrodoError('middle', new FrodoError(PRETTY, failure()))
            ),
        ],
      ])(
        '13y: %s, a pretty-printed text: the line that opens it and the lines after it are not written',
        (_name, make) => {
          const error = make();
          const written = view(error);
          expect(written).not.toContain(V);
          expect(written).not.toContain('x-api-key');
          expect(written).toContain(`Invalid value:\n${NOTE}`);
          // the text of the error is not changed
          expect(error.getCombinedMessage()).toContain(V);
          expect(String(error)).toContain(V);
        }
      );

      test('13z: the lines that a label starts are written again after the run', () => {
        const error = new FrodoError(
          'outer',
          failure({
            responseData: { message: PRETTY, error_description: 'Bad Request' },
          })
        );
        expect(view(error)).toBe(
          `outer\n  Network error:\n    URL: https://tenant.example.com/am/json/trees/n1\n    Status: 409\n    Code: ERR_BAD_REQUEST\n    Message: Invalid value:\n${NOTE}\n    Description: Bad Request`
        );
      });

      test.each([
        [
          'a pair list, pretty-printed',
          `rows:\n${JSON.stringify([['Cookie', `sid=${V}`]], null, 2)}\nend`,
        ],
        [
          'a name and its value in a list, pretty-printed',
          `list: ${JSON.stringify(['Cookie', `sid=${V}`], null, 2)}`,
        ],
        [
          'XML with the value on its own line',
          `bad:\n<login>\n  <password>\n    ${V}\n  </password>\n</login>`,
        ],
        [
          'XML with a line break in the value',
          `bad: <password>${V}\nrest</password>`,
        ],
        [
          'a pretty-printed object with the value of a pair',
          `config:\n${JSON.stringify({ properties: [{ label: 'DB_PASSWORD', text: V }] }, null, 2)}`,
        ],
        ['an opening brace that ends the line', `got {\n  "x": "${V}"\n}`],
        ['an opening bracket that ends the line', `got [\n  "${V}"\n]`],
        [
          'an opening brace and blanks that end the line',
          `got {  \n  "x": "${V}"\n}`,
        ],
      ])(
        '13aa: %s in the message of an original error is not written',
        (_name, text) => {
          const written = view(new FrodoError('outer', new Error(text)));
          expect(written).not.toContain(V);
          expect(written).toMatch(/<text of \d+ characters not written>/);
        }
      );

      test('13ab: a plain multi-line message, and lines that open no text, are written as they are', () => {
        const error = new FrodoError(
          'outer',
          new Error('line one\nline two (3 of 4)\nline three')
        );
        expect(view(error)).toBe(error.getCombinedMessage());
        const withLabels = new FrodoError(
          'outer',
          failure({ responseData: { message: 'conflict', reason: 'Conflict' } })
        );
        expect(view(withLabels)).toBe(withLabels.getCombinedMessage());
      });

      test('13ac: the text of the error is the same for any chain', () => {
        const error = new FrodoError(
          'outer',
          new FrodoError('inner', [
            new Error(PRETTY),
            failure({ responseData: { message: PRETTY } }),
          ])
        );
        const written = view(error);
        expect(written).not.toContain(V);
        expect(error.getCombinedMessage().split(V)).toHaveLength(3);
      });
    });

    test('13m: the message of an error that is long uses the budget up: the errors behind it are not written', () => {
      const many = Array.from({ length: 2000 }, () =>
        failure({ responseData: { detail: { note: 'a detail line' } } })
      );
      const error = new FrodoError('y'.repeat(1_000_000), many);
      const parse = jest.spyOn(JSON, 'parse');
      try {
        const view = JSON.parse(JSON.stringify(error));
        // the head of the text is the message: nothing behind it is built
        expect(parse.mock.calls.length).toBeLessThan(300);
        expect(view.combinedMessage.length).toBeLessThan(4100);
      } finally {
        parse.mockRestore();
      }
    });

    test('13j: the text of the error is what it was, the view is the detail written without the value', () => {
      const error = detail({
        echoed: JSON.stringify({ password: V }),
        note: 'kept',
      });
      expect(error.getCombinedMessage()).toContain(V);
      const view = JSON.parse(JSON.stringify(error));
      expect(view.combinedMessage).toContain('kept');
      expect(view.combinedMessage).toContain('<redacted>');
    });
  });

  test('14: the URL in the message of an AxiosError, of a plain error and of a diagnosis is written with its values replaced', () => {
    const url = `https://u:${MARKER_C}@h.example.com/x?access_token=${MARKER_A}`;
    const axiosError = failure();
    axiosError.message = `failed ${url}`;
    Object.assign(axiosError, {
      proxyFailure: { code: 'PROXY_UNREACHABLE', message: `proxy ${url}` },
      nameResolutionDiagnosis: { message: `name ${url}` },
    });
    const error = new FrodoError('Error', [
      axiosError,
      new Error(`plain ${url}`),
    ]);
    for (const marker of [MARKER_A, MARKER_C]) {
      expect(JSON.stringify(error)).not.toContain(marker);
      expect(inspect(error, { depth: null })).not.toContain(marker);
    }
    const written = JSON.parse(JSON.stringify(error));
    expect(written.originalErrors[0].message).toContain('<redacted>');
    expect(written.originalErrors[0].proxyFailure.message).toContain(
      '<redacted>'
    );
    expect(written.originalErrors[0].nameResolutionDiagnosis.message).toContain(
      '<redacted>'
    );
    expect(written.originalErrors[1].message).toContain('<redacted>');
  });

  test('15: a JSON web token that the answer echoes in free text is in no form of the view', () => {
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl';
    const error = new FrodoError(
      `Error with assertion ${jwt}`,
      failure({
        responseData: {
          message: `the assertion ${jwt} is not valid`,
          error_description: `Invalid assertion: ${jwt}`,
          nested: { text: `echo ${jwt}` },
        },
      })
    );
    for (const form of ['JSON.stringify', 'util.inspect depth null']) {
      const text = allForms(error)[form];
      expect(text).not.toContain(jwt);
      expect(text).not.toContain('eyJhbGciOiJSUzI1NiJ9');
    }
    // the text of the error is what it was
    expect(error.getCombinedMessage()).toContain(jwt);
  });
});
