/**
 * Run tests
 *
 *        npm run test:only ErrorSerializationUtils.unit
 *
 * How an error is written when it is serialized or printed: the view that
 * replaces the request configuration an `AxiosError` holds, for every way of
 * writing it (`JSON.stringify`, `util.inspect`, `console.log`, the `%o`, `%O`
 * and `%j` placeholders). Nothing here uses the network.
 */
import { inspect } from 'util';
import { jest } from '@jest/globals';
import { AxiosHeaders } from 'axios';
import { FrodoError } from '../ops/FrodoError';
import { leastCpuMilliseconds } from '../test/utils/CpuTime';
import {
  allForms,
  failure,
  MARKER_A,
  MARKER_B,
  MARKER_C,
  MARKER_D,
} from '../test/utils/SerializationForms';
import {
  attachSafeSerialization,
  describeBody,
  describeError,
  describeHeaders,
  describeResponseHeaders,
  MAX_BODY_LENGTH,
  MAX_ERROR_DEPTH,
  MAX_ERROR_NODES,
  MAX_STRUCTURED_TEXT,
} from './ErrorSerializationUtils';
import {
  SENSITIVE_FIELD_NAMES,
  SENSITIVE_HEADER_NAMES,
} from './SensitiveDataUtils';

/** Asserts that none of the markers is in any form the value can be written in. */
function expectNoMarker(value: unknown, markers: string[] = [MARKER_A]) {
  for (const [form, text] of Object.entries(allForms(value))) {
    for (const marker of markers) {
      if (text.includes(marker)) {
        throw new Error(`${marker} is in the form '${form}':\n${text}`);
      }
    }
  }
}

describe('describeHeaders', () => {
  test('1: the names stay and the values of the sensitive headers are replaced', () => {
    const headers = describeHeaders({
      Accept: 'application/json',
      Authorization: `Bearer ${MARKER_A}`,
      Cookie: `iPlanetDirectoryPro=${MARKER_B}; other=${MARKER_D}`,
      'X-API-Key': MARKER_A,
      'X-API-Secret': MARKER_D,
    });
    expect(headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer <redacted>',
      Cookie: 'iPlanetDirectoryPro=<redacted>; other=<redacted>',
      'X-API-Key': '<redacted>',
      'X-API-Secret': '<redacted>',
    });
  });

  test('2: header names are matched in any case', () => {
    const headers = describeHeaders({
      authorization: `Bearer ${MARKER_A}`,
      AUTHORIZATION: `Bearer ${MARKER_A}`,
      cookie: `a=${MARKER_B}`,
      'set-cookie': [`a=${MARKER_B}`, `b=${MARKER_B}`],
      'proxy-authorization': `Basic ${MARKER_A}`,
      IPLANETDIRECTORYPRO: MARKER_B,
    });
    expect(JSON.stringify(headers)).not.toContain(MARKER_A);
    expect(JSON.stringify(headers)).not.toContain(MARKER_B);
    expect(headers?.authorization).toBe('Bearer <redacted>');
    expect(headers?.['proxy-authorization']).toBe('Basic <redacted>');
    expect(Object.keys(headers ?? {})).toHaveLength(6);
  });

  test('3: an AxiosHeaders instance and a plain object give the same', () => {
    const plain = {
      Accept: 'application/json',
      Authorization: `Bearer ${MARKER_A}`,
    };
    expect(describeHeaders(new AxiosHeaders(plain))).toEqual(
      describeHeaders(plain)
    );
    expect(describeHeaders(new AxiosHeaders(plain))?.Authorization).toBe(
      'Bearer <redacted>'
    );
  });

  test('4: the names a caller gives are sensitive as well', () => {
    const headers = describeHeaders(
      { 'X-Custom-Name': MARKER_D, Accept: 'application/json' },
      ['x-custom-name']
    );
    expect(headers).toEqual({
      'X-Custom-Name': '<redacted>',
      Accept: 'application/json',
    });
  });

  test('5: a group of header lines is written the same way, a function is left out', () => {
    const headers = describeHeaders({
      common: { Authorization: `Bearer ${MARKER_A}`, Accept: '*/*' },
      post: { 'Content-Type': 'application/json' },
      delete: () => undefined,
    });
    expect(headers).toEqual({
      common: { Authorization: 'Bearer <redacted>', Accept: '*/*' },
      post: { 'Content-Type': 'application/json' },
    });
  });

  test('6: a sensitive header that holds an object is replaced as a whole', () => {
    const headers = describeHeaders({
      Authorization: { scheme: 'Bearer', value: MARKER_A },
    });
    expect(JSON.stringify(headers)).not.toContain(MARKER_A);
  });

  test.each([undefined, null, 'text', 3])('7: %p is no headers', (value) => {
    expect(describeHeaders(value)).toBeUndefined();
  });
});

describe('describeResponseHeaders', () => {
  test('1: a short list of headers is written with its value', () => {
    expect(
      describeResponseHeaders({
        'Content-Type': 'application/json',
        'content-length': '12',
        Date: 'Wed, 18 Nov 2026 17:50:30 GMT',
        'Retry-After': '5',
        'X-ForgeRock-TransactionId': 'txn-1',
        'X-RateLimit-Limit': '28',
        'x-ratelimit-reset': '1700000000',
        'RateLimit-Remaining': '3',
      })
    ).toEqual({
      'Content-Type': 'application/json',
      'content-length': '12',
      Date: 'Wed, 18 Nov 2026 17:50:30 GMT',
      'Retry-After': '5',
      'X-ForgeRock-TransactionId': 'txn-1',
      'X-RateLimit-Limit': '28',
      'x-ratelimit-reset': '1700000000',
      'RateLimit-Remaining': '3',
    });
  });

  test('2: every other header is named and its value is omitted', () => {
    const headers = describeResponseHeaders({
      'X-Custom-Name': MARKER_A,
      Server: 'a server',
      Connection: 'keep-alive',
      'x-openam-something': MARKER_D,
    });
    expect(headers).toEqual({
      'X-Custom-Name': '<omitted>',
      Server: '<omitted>',
      Connection: '<omitted>',
      'x-openam-something': '<omitted>',
    });
  });

  test('3: the sensitive headers keep the names of the cookies and nothing more', () => {
    const headers = describeResponseHeaders({
      'Set-Cookie': [`iPlanetDirectoryPro=${MARKER_B}; Path=/`],
      'Proxy-Authenticate': `Basic realm="${MARKER_D}"`,
      Authorization: `Bearer ${MARKER_A}`,
    });
    expect(headers?.['Set-Cookie']).toBe(
      'iPlanetDirectoryPro=<redacted>; Path=<redacted>'
    );
    expect(JSON.stringify(headers)).not.toContain(MARKER_A);
    expect(JSON.stringify(headers)).not.toContain(MARKER_B);
    expect(JSON.stringify(headers)).not.toContain(MARKER_D);
  });

  test('4: Location and Content-Location are written with the sensitive values of the URL replaced', () => {
    const headers = describeResponseHeaders({
      Location: `http://127.0.0.1:1/cb?code=${MARKER_A}&state=abc#access_token=${MARKER_B}`,
      'content-location': `/relative?id_token=${MARKER_C}&a=1`,
    });
    expect(headers).toEqual({
      Location:
        'http://127.0.0.1:1/cb?code=<redacted>&state=abc#access_token=<redacted>',
      'content-location': '/relative?id_token=<redacted>&a=1',
    });
  });

  test('5: Link and Refresh are written with the URL in them replaced', () => {
    const headers = describeResponseHeaders({
      Link: `<https://h/next?code=${MARKER_A}>; rel="next", </x?access_token=${MARKER_B}>; rel="prev"`,
      Refresh: `5; url=https://h/go?token=${MARKER_C}`,
    });
    expect(JSON.stringify(headers)).not.toContain(MARKER_A);
    expect(JSON.stringify(headers)).not.toContain(MARKER_B);
    expect(JSON.stringify(headers)).not.toContain(MARKER_C);
    expect(headers?.Link).toContain('rel="next"');
    expect(headers?.Refresh).toBe('5; url=https://h/go?token=<redacted>');
  });

  test('6: of WWW-Authenticate only the scheme is written', () => {
    expect(
      describeResponseHeaders({
        'WWW-Authenticate': `Bearer realm="${MARKER_A}", error="invalid_token"`,
      })
    ).toEqual({ 'WWW-Authenticate': 'Bearer' });
    expect(
      describeResponseHeaders({ 'www-authenticate': ['Basic realm="x"'] })
    ).toEqual({ 'www-authenticate': 'Basic' });
  });

  test('7: an AxiosHeaders instance gives the same as a plain object, in any case', () => {
    const plain = {
      LOCATION: `http://h/cb?code=${MARKER_A}`,
      'x-other': MARKER_D,
    };
    expect(describeResponseHeaders(new AxiosHeaders(plain))).toEqual({
      LOCATION: 'http://h/cb?code=<redacted>',
      'x-other': '<omitted>',
    });
  });

  test('8: the names the library knows from the state are sensitive', () => {
    expect(
      describeResponseHeaders({ 'X-Tenant-Name': MARKER_D }, ['x-tenant-name'])
    ).toEqual({ 'X-Tenant-Name': '<redacted>' });
  });

  test.each([undefined, null, 'text', 3])('9: %p is no headers', (value) => {
    expect(describeResponseHeaders(value)).toBeUndefined();
  });
});

describe('describeBody', () => {
  test('1: the sensitive fields of a JSON object are replaced, at any depth and in arrays', () => {
    const body = describeBody({
      userName: 'admin',
      password: MARKER_C,
      nested: { client_secret: MARKER_D, list: [{ access_token: MARKER_A }] },
      callbacks: [
        {
          type: 'PasswordCallback',
          input: [{ name: 'IDToken1', value: MARKER_C }],
        },
      ],
    });
    const text = JSON.stringify(body);
    for (const marker of [MARKER_C, MARKER_D, MARKER_A]) {
      expect(text).not.toContain(marker);
    }
    expect(text).toContain('admin');
  });

  test('2b: the answers to a password callback in a JSON text are replaced by the structure of the callback', () => {
    const body = JSON.stringify({
      authId: 'flow',
      callbacks: [
        {
          type: 'PasswordCallback',
          input: [{ name: 'IDToken2', value: MARKER_C }],
        },
      ],
    });
    const written = describeBody(body) as string;
    expect(written).not.toContain(MARKER_C);
    expect(JSON.parse(written).callbacks[0].input[0].value).toBe('<redacted>');
  });

  test('2: the sensitive fields of a JSON string and of a form are replaced', () => {
    expect(describeBody(JSON.stringify({ password: MARKER_C, a: 1 }))).toBe(
      JSON.stringify({ password: '<redacted>', a: 1 })
    );
    expect(
      describeBody(`grant_type=x&assertion=${MARKER_A}&client_id=frodo`)
    ).toBe('grant_type=x&assertion=<redacted>&client_id=frodo');
    expect(describeBody(new URLSearchParams({ client_secret: MARKER_D }))).toBe(
      'client_secret=<redacted>'
    );
  });

  test('2c: a JSON text longer than the cut is read whole before it is cut: the answer to a callback in its head is replaced by the structure', () => {
    const body = JSON.stringify({
      callbacks: [
        {
          type: 'PasswordCallback',
          input: [{ name: 'IDToken2', value: MARKER_C }],
        },
      ],
      padding: 'x'.repeat(6000),
    });
    expect(body.length).toBeGreaterThan(4000);
    expect(body.indexOf(MARKER_C)).toBeLessThan(4000);
    const written = describeBody(body) as string;
    expect(written).not.toContain(MARKER_C);
    expect(written).toContain('"value":"<redacted>"');
    expect(written).toMatch(/\.\.\. \(\d+ characters\)$/);
  });

  test('2d: a JSON text of more than the cut with a JSON text in a string of it is read whole, and the string is read as structure', () => {
    const callback = {
      callbacks: [
        {
          type: 'PasswordCallback',
          input: [{ name: 'IDToken2', value: MARKER_C }],
        },
      ],
    };
    const body = JSON.stringify({
      echoed: JSON.stringify(callback),
      padding: 'x'.repeat(6000),
    });
    expect(body.length).toBeGreaterThan(4000);
    expect(describeBody(body) as string).not.toContain(MARKER_C);
  });

  test('2e: JSON texts in strings are read as structure to the fourth level, and the fifth is read as a text of fields', () => {
    const callback = {
      callbacks: [
        {
          type: 'PasswordCallback',
          input: [{ name: 'IDToken2', value: MARKER_C }],
        },
      ],
    };
    for (let levels = 0; levels <= 6; levels++) {
      let text = JSON.stringify(callback);
      for (let level = 0; level < levels; level++) {
        text = JSON.stringify({ inner: text });
      }
      // up to the fifth level the answer to the callback is found by its structure
      const written = describeBody({ outer: text }) as { outer: string };
      if (levels <= 4) {
        expect(JSON.stringify(written)).not.toContain(MARKER_C);
      }
    }
  });

  test('2f: a JSON text that is a list is read as structure as well, in a string and as a body', () => {
    const callback = {
      callbacks: [
        {
          type: 'PasswordCallback',
          input: [{ name: 'IDToken2', value: MARKER_C }],
        },
      ],
    };
    const list = JSON.stringify([{ echo: JSON.stringify(callback) }]);
    expect(JSON.stringify(describeBody({ x: list }))).not.toContain(MARKER_C);
    expect(describeBody(list) as string).not.toContain(MARKER_C);
    expect(
      JSON.stringify(describeBody({ x: JSON.stringify(callback) }))
    ).not.toContain(MARKER_C);
  });

  describe('how much JSON text inside a string is read as structure', () => {
    const jsonText = (length: number) =>
      JSON.stringify({ padding: 'x'.repeat(length) });

    /** How many texts inside the body were read as structure: each one is written again by `JSON.stringify`. */
    function textsRead(body: unknown): number {
      const stringify = jest.spyOn(JSON, 'stringify');
      try {
        describeBody(body);
        // the copy of the body and the check of its length are two calls of the body itself
        return stringify.mock.calls.length - 2;
      } finally {
        stringify.mockRestore();
      }
    }

    test('2h: a text within the bound is read as structure, one longer than the bound is written as text', () => {
      expect(textsRead({ echo: jsonText(MAX_STRUCTURED_TEXT - 1000) })).toBe(1);
      expect(textsRead({ echo: jsonText(MAX_STRUCTURED_TEXT + 1000) })).toBe(0);
    });

    /** A JSON text of exactly `length` characters. */
    const exactly = (length: number) => {
      const empty = jsonText(0).length;
      return jsonText(length - empty);
    };

    test('2h2: the bound is exact: a text of the bound is read as structure, one of one character more is not', () => {
      expect(exactly(MAX_STRUCTURED_TEXT).length).toBe(MAX_STRUCTURED_TEXT);
      expect(textsRead({ echo: exactly(MAX_STRUCTURED_TEXT) })).toBe(1);
      expect(textsRead({ echo: exactly(MAX_STRUCTURED_TEXT + 1) })).toBe(0);
    });

    test('2i2: the budget is exact: texts that add up to the budget are all read, one more is not', () => {
      const text = exactly(MAX_STRUCTURED_TEXT);
      // 4 texts of the bound are 256 KiB, the budget of one body outside a view
      expect(textsRead({ list: [text, text, text, text] })).toBe(4);
      expect(textsRead({ list: [text, text, text, text, text] })).toBe(4);
    });

    test('2i3: the texts inside a text that is read are charged to the same budget', () => {
      // each of 4 texts of 60,000 characters holds a text of 30,000 characters: with the texts
      // inside charged, the budget of 262,144 lasts for 3 outer texts and 2 inner ones
      const inner = exactly(30_000);
      const outer = JSON.stringify({ inner, padding: 'y'.repeat(29_900) });
      expect(outer.length).toBeGreaterThan(59_000);
      expect(outer.length).toBeLessThanOrEqual(60_000);
      expect(textsRead({ list: [outer, outer, outer, outer] })).toBe(5);
    });

    test('2i: the texts of one body are read as structure up to a budget, the rest are written as text', () => {
      const text = jsonText(MAX_STRUCTURED_TEXT - 1000);
      // 10 texts of nearly 64 KiB: the budget of 256 KiB lasts for 4 of them
      expect(textsRead({ list: Array.from({ length: 10 }, () => text) })).toBe(
        4
      );
      expect(textsRead({ list: [text, text] })).toBe(2);
    });
  });

  describe('how much JSON text inside strings one view reads as structure, for all of its bodies together', () => {
    // a text of 60,000 characters exactly: the copy of a body is longer, so a read of the text is told by its length
    const TEXT_LENGTH = 60_000;
    const text = (n: number) => {
      const empty = JSON.stringify({ n, padding: '' }).length;
      return JSON.stringify({ n, padding: 'x'.repeat(TEXT_LENGTH - empty) });
    };

    /** How many texts of exactly {@link TEXT_LENGTH} characters were parsed while a view of the error is written. */
    function textsParsed(error: unknown): number {
      const parse = jest.spyOn(JSON, 'parse');
      try {
        describeError(error);
        return parse.mock.calls.filter(
          ([argument]) =>
            typeof argument === 'string' && argument.length === TEXT_LENGTH
        ).length;
      } finally {
        parse.mockRestore();
      }
    }

    /** An error of a request with a body in the answer, a body in the request and a text in the message of the answer. */
    function failedRequest(texts: number) {
      const body = (offset: number) =>
        Object.fromEntries(
          Array.from({ length: texts }, (_, i) => [
            `echo${i}`,
            text(offset + i),
          ])
        );
      const error = new FrodoError('Error reading things', {
        isAxiosError: true,
        message: 'Request failed with status code 400',
        response: { status: 400, data: { detail: body(0), ...body(100) } },
        config: { url: 'http://localhost/x', method: 'post', data: body(200) },
      } as unknown as Error);
      return error;
    }

    test('2n: the texts that the bodies of one error hold are read as structure up to one budget for the whole view', () => {
      // 3 bodies of 12 texts each: 36 texts of 60 KB would be 2.1 MB of reading, the budget of one view is 512 KiB
      const read = textsParsed(failedRequest(12));
      // 512 KiB hold 8 texts of 60,000 characters, and no more
      expect(read).toBe(Math.floor((512 * 1024) / TEXT_LENGTH));
    });

    test('2p: a text that the view reads twice (the answer and the detail that the combined message says again) is read once', () => {
      const error = new FrodoError('Error reading things', {
        isAxiosError: true,
        message: 'Request failed with status code 400',
        response: { status: 400, data: { detail: { echo: text(1) } } },
        config: { url: 'http://localhost/x', method: 'get' },
      } as unknown as Error);
      expect(textsParsed(error)).toBe(1);
      // each view is its own: a second view reads the text again, and shows the same
      expect(textsParsed(error)).toBe(1);
      expect(JSON.stringify(describeError(error))).toBe(
        JSON.stringify(describeError(error))
      );
    });

    test('2q: what a view writes for a text does not depend on what it read before: the same text at another depth is written as it would be alone', () => {
      // a text of 10 KiB (more than a text that is always read as structure): read at depth 0 it is read as
      // structure, at depth 4 it is written as a head, and the two are written differently
      const callback = JSON.stringify({
        callbacks: [
          {
            type: 'PasswordCallback',
            input: [{ name: 'IDToken2', value: MARKER_C }],
          },
        ],
        note: 'a b'.repeat(3_000),
      });
      const holder = JSON.stringify({ x: callback });
      const inside = (text: string, times: number) => {
        let result = text;
        for (let i = 0; i < times; i++) result = JSON.stringify({ w: result });
        return result;
      };
      // the request is written before the answer, in the same view: it is what the view read before
      const view = (request: string | undefined, answer: string) =>
        describeError({
          isAxiosError: true,
          message: 'Request failed with status code 400',
          response: { status: 400, data: answer },
          config: { url: 'http://localhost/x', method: 'post', data: request },
        }) as { data?: string; response: { data: string } };
      const alone = view(undefined, inside(holder, 3));
      const together = view(holder, inside(holder, 3));
      expect(together.response.data).toBe(alone.response.data);
      // the same text at depth 0 (the request) is written differently from at depth 3
      expect(together.data).not.toBe(alone.response.data);
      expect(JSON.stringify(together)).not.toContain(MARKER_C);
    });

    test('2r: a view that is written while another is written (a getter that writes a view) shares its budget', () => {
      const inner = failedRequest(12);
      const outer = failedRequest(12);
      Object.defineProperty(outer, 'httpDetail', {
        get() {
          describeError(inner);
          return undefined;
        },
      });
      expect(textsParsed(outer)).toBeLessThanOrEqual(
        Math.floor((512 * 1024) / TEXT_LENGTH)
      );
    });

    test('2o: what is not read as structure is written as text, with the secrets in it replaced', () => {
      const callback = JSON.stringify({
        callbacks: [
          {
            type: 'PasswordCallback',
            input: [{ name: 'IDToken2', value: MARKER_C }],
          },
        ],
      });
      const error = failedRequest(12);
      (
        (
          error as unknown as {
            originalErrors: { config: { data: unknown } }[];
          }
        ).originalErrors[0].config.data as Record<string, string>
      ).late = callback;
      expect(JSON.stringify(describeError(error))).not.toContain(MARKER_C);
    });
  });

  describe('the answer to a callback and a password key, in six forms of text', () => {
    const V = MARKER_C;
    // each form builds a JSON text of the length that is asked for
    const FORMS: [string, (length: number) => string][] = [
      [
        'the value before the name',
        (length) =>
          pad(
            (padding) =>
              `{"callbacks":[{"type":"PasswordCallback","input":[{"value":"${V}","name":"IDToken2"}]}],"padding":"${padding}"}`,
            length
          ),
      ],
      [
        'three levels of JSON text',
        (length) =>
          pad(
            (padding) =>
              JSON.stringify({
                wrapped: JSON.stringify({
                  inner: JSON.stringify({ password: V }),
                }),
                padding,
              }),
            length
          ),
      ],
      [
        'a password key escaped twice',
        (length) =>
          pad(
            (padding) =>
              JSON.stringify({
                wrapped: JSON.stringify({
                  text: JSON.stringify({ password: V }),
                }),
                padding,
              }),
            length
          ),
      ],
      [
        'a key with a unicode escape',
        (length) =>
          pad(
            (padding) => `{"\\u0070assword":"${V}","padding":"${padding}"}`,
            length
          ),
      ],
      [
        'a callback name with a unicode escape',
        (length) =>
          pad(
            (padding) =>
              `{"callbacks":[{"type":"PasswordCallback","input":[{"name":"IDToken\\u0032","value":"${V}"}]}],"padding":"${padding}"}`,
            length
          ),
      ],
      [
        'an attribute between the name and the value',
        (length) =>
          pad(
            (padding) =>
              `{"callbacks":[{"type":"PasswordCallback","input":[{"name":"IDToken2","note":1,"value":"${V}"}]}],"padding":"${padding}"}`,
            length
          ),
      ],
    ];

    /** The text that a form writes with a padding that makes it exactly `length` characters. */
    function pad(make: (padding: string) => string, length: number): string {
      const empty = make('').length;
      return make('x'.repeat(Math.max(length - empty, 0)));
    }

    test.each(
      FORMS.flatMap(([name, make]) =>
        [
          MAX_STRUCTURED_TEXT - 1,
          MAX_STRUCTURED_TEXT,
          MAX_STRUCTURED_TEXT + 1,
          MAX_STRUCTURED_TEXT + 1000,
          1_000_000,
        ].map((length) => [name, length, make] as const)
      )
    )(
      '2j: %s, in a text of %s characters (the bound is read as structure, one longer as text): replaced',
      (_name, length, make) => {
        const text = make(length);
        expect(text.length).toBeGreaterThanOrEqual(
          Math.min(length, text.length)
        );
        expect(JSON.stringify(describeBody({ echo: text }))).not.toContain(V);
        expect(
          JSON.stringify(describeBody({ list: [text, text] }))
        ).not.toContain(V);
        expect(describeBody(text) as string).not.toContain(V);
      }
    );

    // a JSON text that holds the secret, wrapped in more JSON texts (each one a string in an object)
    const SECRETS: [string, string][] = [
      [
        'an answer to a password callback',
        JSON.stringify({
          callbacks: [
            {
              type: 'PasswordCallback',
              input: [{ name: 'IDToken2', value: V }],
            },
          ],
        }),
      ],
      ['a password key', JSON.stringify({ password: V })],
    ];
    const wrapped = (text: string, times: number, padding: number) => {
      let result = text;
      for (let i = 0; i < times; i++) result = JSON.stringify({ w: result });
      return JSON.stringify({ w: result, padding: 'x'.repeat(padding) });
    };

    test.each(
      SECRETS.flatMap(([name, text]) =>
        [0, 1, 2, 3].map((times) => [name, times, text] as const)
      )
    )(
      '2j2: %s in a text of more than the bound, inside %s other texts (the escapes of three levels are taken off): replaced',
      (_name, times, secret) => {
        const text = wrapped(secret, times, MAX_STRUCTURED_TEXT * 2);
        expect(text.length).toBeGreaterThan(MAX_STRUCTURED_TEXT);
        expect(JSON.stringify(describeBody({ echo: text }))).not.toContain(V);
        expect(describeBody(text) as string).not.toContain(V);
      }
    );

    test.each(
      SECRETS.flatMap(([name, text]) =>
        [0, 4, 7].map((times) => [name, times, text] as const)
      )
    )(
      '2j3: %s in a text within the bound, inside %s other texts (four are read as structure, the escapes of three more are taken off): replaced',
      (_name, times, secret) => {
        const text = wrapped(secret, times, 100);
        expect(text.length).toBeLessThan(MAX_STRUCTURED_TEXT);
        expect(JSON.stringify(describeBody({ echo: text }))).not.toContain(V);
        expect(describeBody(text) as string).not.toContain(V);
      }
    );

    test.each(
      FORMS.flatMap(([name, make]) =>
        [1_000, 20_000, MAX_STRUCTURED_TEXT - 100].flatMap((length) =>
          ['}}', ' {', '"'].map(
            (suffix) => [name, length, suffix, make] as const
          )
        )
      )
    )(
      '2j4: %s, in a text of about %s characters that is not valid JSON (it ends with "%s"): replaced',
      (_name, length, suffix, make) => {
        const text = `${make(length - 2)}${suffix}`;
        expect(text.length).toBeLessThan(MAX_STRUCTURED_TEXT);
        expect(() => JSON.parse(text)).toThrow();
        expect(JSON.stringify(describeBody({ echo: text }))).not.toContain(V);
        expect(JSON.stringify(describeBody([text]))).not.toContain(V);
        expect(String(describeBody(text))).not.toContain(V);
      }
    );

    test.each(
      SECRETS.flatMap(([name, text]) =>
        [0, 1, 2, 3, 4].map((times) => [name, times, text] as const)
      )
    )(
      '2j5: %s inside %s other texts, in a text within the bound that is not valid JSON: replaced',
      (_name, times, secret) => {
        const text = `${wrapped(secret, times, 100)}}}`;
        expect(() => JSON.parse(text)).toThrow();
        expect(JSON.stringify(describeBody({ echo: text }))).not.toContain(V);
        expect(String(describeBody(text))).not.toContain(V);
      }
    );

    test('2k: the edge is exact: a text of the bound is read as structure, one of one more is not written, and says how long it is', () => {
      const at = FORMS[0][1](MAX_STRUCTURED_TEXT);
      const over = FORMS[0][1](MAX_STRUCTURED_TEXT + 1);
      expect(at.length).toBe(MAX_STRUCTURED_TEXT);
      expect(over.length).toBe(MAX_STRUCTURED_TEXT + 1);
      expect(JSON.stringify(describeBody({ echo: at }))).not.toContain(V);
      expect(describeBody({ echo: over })).toEqual({
        echo: `<text of ${over.length} characters not written>`,
      });
    });

    test('2l2: a body that is a text of form data is a text, whose secrets are replaced by the rules of text', () => {
      const form = new URLSearchParams({
        username: 'someone',
        password: MARKER_C,
        padding: 'x'.repeat(MAX_STRUCTURED_TEXT * 2),
      });
      expect(describeBody(form) as string).not.toContain(MARKER_C);
    });

    test('2l: a body that is a text above the bound is read once as a body: a number as the answer is replaced as well', () => {
      const text = JSON.stringify({
        callbacks: [
          {
            type: 'PasswordCallback',
            input: [{ name: 'IDToken2', value: 123456789 }],
          },
        ],
        padding: 'x'.repeat(MAX_STRUCTURED_TEXT * 2),
      });
      expect(describeBody(text) as string).not.toContain('123456789');
    });

    test('2m: three levels of JSON in a list text are read: the answer in it is replaced within the bound and above it', () => {
      const callback = {
        callbacks: [
          {
            type: 'PasswordCallback',
            input: [{ name: 'IDToken2', value: V }],
          },
        ],
      };
      const list = JSON.stringify([
        JSON.stringify([JSON.stringify([JSON.stringify(callback)])]),
      ]);
      expect(JSON.stringify(describeBody({ x: list }))).not.toContain(V);
      expect(describeBody(list) as string).not.toContain(V);
      const long = JSON.stringify([
        JSON.stringify([JSON.stringify([JSON.stringify(callback)])]),
        'x'.repeat(MAX_STRUCTURED_TEXT * 2),
      ]);
      expect(JSON.stringify(describeBody({ x: long }))).not.toContain(V);
    });
  });

  test('2g: a text that looks like JSON and does not parse is not written, a log line that starts with a bracket is a plain text', () => {
    expect(describeBody('{"message":"boom","oops')).toBe(
      '<text of 23 characters not written>'
    );
    expect(describeBody({ x: '{"message":"boom","oops' })).toEqual({
      x: '<text of 23 characters not written>',
    });
    expect(describeBody({ x: '[1, 2, boom' })).toEqual({
      x: '<text of 11 characters not written>',
    });
    expect(describeBody('[not json')).toBe('[not json');
    expect(describeBody({ x: '[INFO] boom' })).toEqual({ x: '[INFO] boom' });
    expect(describeBody('[ERROR] not json')).toBe('[ERROR] not json');
  });

  test('3: a body that is no text is named, not written', () => {
    expect(describeBody(Buffer.from(MARKER_A))).toBe('<Buffer 13 bytes>');
    expect(describeBody(new Uint8Array(4))).toBe('<binary 4 bytes>');
    expect(describeBody({ pipe: () => undefined, field: MARKER_A })).toBe(
      '<stream>'
    );
  });

  test('4: a body that cannot be written is named, a circular one too', () => {
    const circular: Record<string, unknown> = { password: MARKER_C };
    circular.self = circular;
    expect(describeBody(circular)).toBe('<body that cannot be written>');
  });

  test('5: a long body is cut', () => {
    const text = describeBody('x'.repeat(MAX_BODY_LENGTH + 100)) as string;
    expect(text.length).toBeLessThan(MAX_BODY_LENGTH + 60);
    expect(text).toContain(`(${MAX_BODY_LENGTH + 100} characters)`);
    const object = describeBody({ list: 'y'.repeat(MAX_BODY_LENGTH + 100) });
    expect(typeof object).toBe('string');
  });

  test('6: no body is no body', () => {
    expect(describeBody(undefined)).toBeUndefined();
    expect(describeBody(null)).toBeUndefined();
    expect(describeBody('')).toBeUndefined();
  });

  test('7: the state of an authentication flow and the field of a revocation request are replaced', () => {
    expect(describeBody({ authId: MARKER_A, callbacks: [] })).toEqual({
      authId: '<redacted>',
      callbacks: [],
    });
    expect(describeBody(`token=${MARKER_A}&token_type_hint=access_token`)).toBe(
      'token=<redacted>&token_type_hint=access_token'
    );
  });
});

describe('describeBody: a value that holds a quote', () => {
  const HEAD = 'MARKER-H-0001';
  const TAIL = 'MARKER-T-0001';
  /** The values that a serializer writes in several ways: a quote, a backslash, a quote between unicode escapes, several quotes. */
  const VALUES: [string, string][] = [
    ['a quote', `${HEAD}"${TAIL}`],
    ['a backslash and a quote', `${HEAD}\\"${TAIL}`],
    ['a quote between two unicode escapes', `${HEAD}\u00e9"\u00e9${TAIL}`],
    ['several quotes', `${HEAD}"a"b"${TAIL}`],
    ['a quote at the end', `${HEAD}${TAIL}"`],
  ];
  const callbackWith = (name: string, value: string) => ({
    callbacks: [{ type: 'PasswordCallback', input: [{ name, value }] }],
  });
  /** The text, as the JSON of an answer that echoes a request, for a value that holds quotes. */
  const FORMS: [string, (value: string) => unknown][] = [
    ['a password', (value) => ({ password: value })],
    ['a client secret', (value) => ({ client_secret: value })],
    [
      'an authorization value',
      (value) => ({ headers: { Authorization: value } }),
    ],
    ['the answer to a callback', (value) => callbackWith('IDToken2', value)],
    [
      'the answer to a callback with a name of its own',
      (value) => callbackWith('prompt', value),
    ],
  ];
  const SIZES = [
    MAX_STRUCTURED_TEXT - 1,
    MAX_STRUCTURED_TEXT,
    MAX_STRUCTURED_TEXT + 1,
    MAX_STRUCTURED_TEXT + 1000,
  ];
  const text = (form: unknown, size: number) => {
    const empty = JSON.stringify({ form, pad: '' }).length;
    return JSON.stringify({ form, pad: 'x'.repeat(Math.max(size - empty, 0)) });
  };

  const CASES = FORMS.flatMap(([formName, form]) =>
    VALUES.flatMap(([valueName, value]) =>
      SIZES.map((size) => [formName, valueName, size, form(value)] as const)
    )
  );

  test.each(CASES)(
    '1: %s with %s, in a text of %s characters, as a value of an object: replaced',
    (_form, _value, size, form) => {
      const written = JSON.stringify(describeBody({ echo: text(form, size) }));
      expect(written).not.toContain(HEAD);
      expect(written).not.toContain(TAIL);
    }
  );

  test.each(CASES)(
    '2: %s with %s, in a text of %s characters, as an item of a list: replaced',
    (_form, _value, size, form) => {
      const written = JSON.stringify(describeBody([text(form, size), 1]));
      expect(written).not.toContain(HEAD);
      expect(written).not.toContain(TAIL);
    }
  );

  test.each(CASES)(
    '3: %s with %s, in a text of %s characters, as the whole body: replaced',
    (_form, _value, size, form) => {
      const written = String(describeBody(text(form, size)));
      expect(written).not.toContain(HEAD);
      expect(written).not.toContain(TAIL);
    }
  );

  test.each(FORMS.map(([name, form]) => [name, form] as const))(
    '4: %s with a quote, in a text of a megabyte: replaced',
    (_form, form) => {
      const written = JSON.stringify(
        describeBody({ echo: text(form(VALUES[0][1]), 1_000_000) })
      );
      expect(written).not.toContain(HEAD);
      expect(written).not.toContain(TAIL);
    }
  );

  test('5: a name that is written with a unicode escape and a value that holds a quote: replaced', () => {
    const value = JSON.stringify(`${HEAD}"${TAIL}`);
    const echo = `{"\\u0070assword":${value},"pad":"${'x'.repeat(70_000)}"}`;
    const written = JSON.stringify(describeBody({ echo }));
    expect(written).not.toContain(HEAD);
    expect(written).not.toContain(TAIL);
  });

  // the shapes that the structure of a text covers: a list, a number, a quote
  const SHORT: [string, string, string][] = [
    ['a quote', JSON.stringify({ password: `${HEAD}"${TAIL}` }), TAIL],
    ['a list under a password', JSON.stringify({ password: [TAIL] }), TAIL],
    [
      'a list under a client secret',
      JSON.stringify({ client_secret: [TAIL] }),
      TAIL,
    ],
    [
      'a number as the answer of a callback',
      JSON.stringify(callbackWith('IDToken2', 123456789 as unknown as string)),
      '123456789',
    ],
  ];

  /** An error whose request holds nine texts of the bound (they use the budget of the view) and whose answer is the given body. */
  const afterTheBudget = (answer: unknown) => {
    const filler = (n: number) => {
      const empty = JSON.stringify({ n, pad: '' }).length;
      return JSON.stringify({
        n,
        pad: 'x'.repeat(MAX_STRUCTURED_TEXT - empty),
      });
    };
    // 8 texts of 65,536 characters (the bound) use the 524,288 characters that a view may read as structure
    const fillers = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [`f${i}`, filler(i)])
    );
    // the request is written before the answer: the texts of the request use the budget, the answer comes after
    return describeError({
      isAxiosError: true,
      message: 'Request failed with status code 400',
      response: { status: 400, data: answer },
      config: { url: 'http://localhost/x', method: 'post', data: fillers },
    }) as { response: { data: unknown } };
  };

  test.each(SHORT)(
    '6: %s, in a text of a few KiB that a view writes after its budget is spent: replaced',
    (_name, short, marker) => {
      const written = JSON.stringify(afterTheBudget({ late: short }));
      expect(written).not.toContain(marker);
      expect(written).not.toContain(HEAD);
      // the short text is written (not cut away with the rest): it is the one read after the budget
      expect(written).toContain('late');
    }
  );

  test('6b: what is written after the budget for a short text is what the view writes for it, with no note of a cut', () => {
    expect(
      afterTheBudget({ late: JSON.stringify({ password: `${HEAD}"${TAIL}` }) })
        .response.data
    ).toEqual({ late: '{"password":"<redacted>"}' });
    expect(
      afterTheBudget({
        late: JSON.stringify(callbackWith('IDToken2', 123456789 as never)),
      }).response.data
    ).toEqual({
      late: JSON.stringify(callbackWith('IDToken2', '<redacted>')),
    });
  });

  test.each([3_000, 5_000, 8_000, 8_192])(
    '6c: the answer to a callback that is a number, in a text of %s characters after the budget: replaced',
    (length) => {
      const empty = JSON.stringify({
        ...callbackWith('IDToken2', 123456789 as never),
        pad: '',
      }).length;
      const late = JSON.stringify({
        ...callbackWith('IDToken2', 123456789 as never),
        pad: 'x'.repeat(length - empty),
      });
      expect(late.length).toBe(length);
      expect(JSON.stringify(afterTheBudget({ late }))).not.toContain(
        '123456789'
      );
    }
  );

  test.each([8_192, 8_193, 20_000, 70_000])(
    '6e: a text of %s characters after the budget: up to 8 KiB it is read as structure, a longer one is not written',
    (length) => {
      const empty = JSON.stringify({ password: TAIL, pad: '' }).length;
      const late = JSON.stringify({
        password: TAIL,
        pad: 'x'.repeat(length - empty),
      });
      expect(late.length).toBe(length);
      const written = afterTheBudget({ late }).response.data;
      expect(JSON.stringify(written)).not.toContain(TAIL);
      if (length <= 8_192) {
        // read as structure (the body is cut at 4,000 characters, so it is written as a text)
        expect(JSON.stringify(written)).toContain('<redacted>');
        expect(JSON.stringify(written)).not.toContain('not written');
      } else {
        expect(written).toEqual({
          late: `<text of ${length} characters not written>`,
        });
      }
    }
  );

  test('6d: a body that is a text of 4,500 characters, after the budget: read as structure, so a password in it is replaced', () => {
    const body = JSON.stringify({
      password: `${HEAD}"${TAIL}`,
      a: 'x'.repeat(4_500),
    });
    const written = String(afterTheBudget(body).response.data);
    expect(written).not.toContain(HEAD);
    expect(written).not.toContain(TAIL);
    expect(written).toContain('{"password":"<redacted>","a":"xxxx');
  });

  test.each(
    [0, 1, 2, 3].flatMap((times) =>
      FORMS.map(([name, form]) => [name, times, form] as const)
    )
  )(
    '10: %s with a quote, inside %s other texts, in a text of more than the bound: replaced',
    (_form, times, form) => {
      const value = `${HEAD}"a\\${TAIL}`;
      let inner = JSON.stringify(form(value));
      for (let i = 0; i < times; i++) inner = JSON.stringify({ w: inner });
      const echo = JSON.stringify({
        w: inner,
        pad: 'x'.repeat(MAX_STRUCTURED_TEXT * 2),
      });
      const written = JSON.stringify(describeBody({ echo }));
      expect(written).not.toContain(HEAD);
      expect(written).not.toContain(TAIL);
    }
  );

  test.each([
    ['a quote written as \\u0022', 'ab\\u0022TAIL-A'],
    ['a backslash written as \\u005c', 'ab\\u005cTAIL-A'],
    ['a backslash and a quote written as escapes', 'ab\\u005c\\u0022TAIL-A'],
    ['a quote written as \\"', 'ab\\"TAIL-A'],
    ['a backslash and a quote', 'ab\\\\\\"TAIL-A'],
  ])(
    '13: a password that a serializer writes with %s (the text of the serializer, not JSON.stringify), in a text of more than the bound, also inside a string: replaced',
    (_name, escaped) => {
      const plain = `{"password":"${escaped}","pad":"${'x'.repeat(MAX_STRUCTURED_TEXT * 2)}"}`;
      const wrapped = JSON.stringify({ w: plain, pad: 'y'.repeat(70_000) });
      for (const text of [plain, wrapped]) {
        const written = JSON.stringify(describeBody({ echo: text }));
        expect(written).not.toContain('TAIL-A');
        expect(written).not.toContain('ab');
      }
    }
  );

  describe('a text in a text, in the forms that a serializer may write', () => {
    const SECRET = 'ZQXser0123456789abcdef';
    const PAD = 'y'.repeat(70_000);

    test('14: a text that is a list of strings, one of them a text with the secret in it (a list of 300 characters in front of it): replaced', () => {
      const list = JSON.stringify([
        'x'.repeat(300),
        JSON.stringify({ password: SECRET }),
      ]);
      const echo = JSON.stringify({ w: list, pad: PAD });
      expect(JSON.stringify(describeBody({ echo }))).not.toContain(SECRET);
      expect(String(describeBody(echo))).not.toContain(SECRET);
    });

    test.each(['\\u000a', '\\u0009', '\\u001f'])(
      '15: two texts inside each other, in a string that ends with the unicode escape %s of a control character: replaced',
      (escape) => {
        const middle = JSON.stringify({
          x: JSON.stringify({ password: SECRET }),
        });
        const literal = `${JSON.stringify(middle).slice(0, -1)}${escape}"`;
        const echo = `{"w":${literal},"pad":"${PAD}"}`;
        expect(() => JSON.parse(echo)).not.toThrow();
        expect(JSON.stringify(describeBody({ echo }))).not.toContain(SECRET);
        expect(String(describeBody(echo))).not.toContain(SECRET);
      }
    );
  });

  describe('a long text with a prefix, or a string literal that holds a text', () => {
    const SECRET = 'ZQXpre0123456789abcdef';
    const FORMS: [string, string][] = [
      [
        'a key with a unicode escape',
        `{"\\u0070assword":"${SECRET}","pad":"PAD"}`,
      ],
      [
        'a password key escaped twice',
        JSON.stringify({
          w: JSON.stringify({ x: JSON.stringify({ password: SECRET }) }),
          pad: 'PAD',
        }),
      ],
      [
        'the answer to a callback',
        JSON.stringify({ ...callbackWith('prompt', SECRET), pad: 'PAD' }),
      ],
      [
        'a list of objects',
        JSON.stringify([
          { w: JSON.stringify({ x: JSON.stringify({ password: SECRET }) }) },
          'PAD',
        ]),
      ],
    ];
    const PREFIXES: [string, (text: string) => string][] = [
      ['no prefix', (text) => text],
      ['"Error: "', (text) => `Error: ${text}`],
      ['"data: "', (text) => `data: ${text}`],
      ['70 spaces', (text) => `${' '.repeat(70)}${text}`],
      ['a string literal', (text) => JSON.stringify(text)],
      [
        'a string literal twice',
        (text) => JSON.stringify(JSON.stringify(text)),
      ],
    ];

    test.each(
      FORMS.flatMap(([form, text]) =>
        PREFIXES.flatMap(([prefix, add]) =>
          [100, 70_000].map((pad) => [form, prefix, pad, text, add] as const)
        )
      )
    )(
      '9: %s, after %s, in a text with %s characters of padding: replaced',
      (_form, _prefix, pad, text, add) => {
        const full = add(text.replace('PAD', 'x'.repeat(pad)));
        const marker = SECRET;
        expect(JSON.stringify(describeBody({ echo: full }))).not.toContain(
          marker
        );
        expect(String(describeBody(full))).not.toContain(marker);
      }
    );
  });
});

describe('describeError of an AxiosError', () => {
  test('1: it writes what may be shown and nothing else of the config', () => {
    const error = failure({
      baseURL: 'https://tenant.example.com',
      url: '/am/json/trees/n1?_queryFilter=true',
      data: { password: MARKER_C, name: 'n1' },
      auth: { username: 'admin', password: MARKER_C },
      responseHeaders: { 'x-forgerock-transactionid': 'txn-1' },
    });
    expect(describeError(error)).toEqual({
      name: 'AxiosError',
      message: 'Request failed with status code 409',
      code: 'ERR_BAD_REQUEST',
      status: 409,
      method: 'DELETE',
      url: 'https://tenant.example.com/am/json/trees/n1?_queryFilter=true',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer <redacted>',
      },
      data: { password: '<redacted>', name: 'n1' },
      response: {
        status: 409,
        statusText: 'sample status',
        headers: { 'x-forgerock-transactionid': 'txn-1' },
        data: { code: 409, message: 'sample failure' },
      },
    });
  });

  test('2: the sensitive values are in no form the error can be written in', () => {
    const error = failure({
      data: { password: MARKER_C },
      auth: { username: 'admin', password: MARKER_D },
    });
    expectNoMarker(describeError(error), [MARKER_A, MARKER_C, MARKER_D]);
  });

  test('3: the sensitive values of the URL are replaced: user info, query and fragment', () => {
    const error = failure({
      url: `https://admin:${MARKER_C}@tenant.example.com/am/x?access_token=${MARKER_A}&_fields=*&code=${MARKER_D}#access_token=${MARKER_A}`,
    });
    const view = describeError(error) as { url: string };
    expect(view.url).toBe(
      'https://admin:<redacted>@tenant.example.com/am/x?access_token=<redacted>&_fields=*&code=<redacted>#access_token=<redacted>'
    );
  });

  test('4: the response is a summary: the body is redacted and the headers are the short list', () => {
    const error = failure({
      responseData: { access_token: MARKER_A, error: 'invalid_grant' },
      responseHeaders: {
        'set-cookie': `iPlanetDirectoryPro=${MARKER_B}`,
        'x-custom-name': MARKER_D,
      },
    });
    expectNoMarker(describeError(error), [MARKER_A, MARKER_B, MARKER_D]);
    expect(
      (describeError(error) as { response: { data: unknown } }).response.data
    ).toEqual({ access_token: '<redacted>', error: 'invalid_grant' });
  });

  test('5: an error without a config or a response is written', () => {
    const error = failure();
    error.config = undefined;
    error.response = undefined;
    expect(describeError(error)).toEqual({
      name: 'AxiosError',
      message: 'Request failed with status code 409',
      code: 'ERR_BAD_REQUEST',
      status: 409,
    });
  });

  test('6: the diagnoses the library attaches stay, without anything else of them', () => {
    const error = failure();
    Object.assign(error, {
      proxyFailure: {
        code: 'PROXY_UNREACHABLE',
        message: 'The proxy cannot be reached',
        proxy: { host: 'proxy.example.com' },
        authenticate: 'Basic realm="x"',
      },
      nameResolutionDiagnosis: { message: 'The name does not resolve' },
    });
    const view = describeError(error) as Record<string, unknown>;
    expect(view.proxyFailure).toEqual({
      code: 'PROXY_UNREACHABLE',
      message: 'The proxy cannot be reached',
    });
    expect(view.nameResolutionDiagnosis).toEqual({
      message: 'The name does not resolve',
    });
  });

  test('7: an answer that redirects is written without the code in its Location', () => {
    const error = failure({
      status: 302,
      responseHeaders: {
        Location: `http://127.0.0.1:1/cb?code=${MARKER_A}&state=abc#access_token=${MARKER_B}`,
        'WWW-Authenticate': `Bearer realm="${MARKER_C}"`,
        'X-Custom-Name': MARKER_D,
      },
    });
    expectNoMarker(describeError(error), [
      MARKER_A,
      MARKER_B,
      MARKER_C,
      MARKER_D,
    ]);
    expect(
      (describeError(error) as { response: { headers: unknown } }).response
        .headers
    ).toEqual({
      Location:
        'http://127.0.0.1:1/cb?code=<redacted>&state=abc#access_token=<redacted>',
      'WWW-Authenticate': 'Bearer',
      'X-Custom-Name': '<omitted>',
    });
  });
});

describe('what is longer than the cut in the headers and the URL of an error of a request', () => {
  const LONG = 'x'.repeat(10_000);

  test('1: a URL is cut, and the note says how long it was', () => {
    const view = describeError(
      failure({ url: `https://h.example.com/${LONG}` })
    ) as { url: string };
    expect(view.url.endsWith(`... (${10_000 + 22} characters)`)).toBe(true);
    expect(view.url.length).toBeLessThan(4100);
  });

  test('2: the value of a header of a request is cut, a list of values too', () => {
    const headers = describeHeaders({
      'X-Long': LONG,
      'X-List': [LONG, 'short'],
      'X-Number': 3,
    }) as Record<string, unknown>;
    expect(headers['X-Long']).toBe(`${'x'.repeat(4000)}... (10000 characters)`);
    expect(headers['X-List']).toEqual([
      `${'x'.repeat(4000)}... (10000 characters)`,
      'short',
    ]);
    expect(headers['X-Number']).toBe(3);
  });

  test('3: the value of a header of an answer that is shown is cut, and so are the ones with a URL in them', () => {
    const headers = describeResponseHeaders({
      'Content-Type': LONG,
      Location: `https://h.example.com/${LONG}`,
      Link: `<https://h.example.com/${LONG}>; rel="next"`,
      Refresh: `0; url=https://h.example.com/${LONG}`,
    }) as Record<string, string>;
    expect(headers['Content-Type']).toBe(
      `${'x'.repeat(4000)}... (10000 characters)`
    );
    for (const name of ['Location', 'Link', 'Refresh']) {
      expect(headers[name]).toMatch(/\.\.\. \(\d+ characters\)$/);
      expect(headers[name].length).toBeLessThan(4100);
    }
  });
});

describe('the URL of an error of a request', () => {
  test('1: a URL that starts with two slashes is absolute: the base URL is not put in front of it, and its user info is replaced', () => {
    const error = failure({
      baseURL: 'https://api.example.com/base',
      url: `//admin:${MARKER_C}@host.example.com/path?access_token=${MARKER_D}`,
    });
    const view = describeError(error) as { url: string };
    expect(view.url).toBe(
      '//admin:<redacted>@host.example.com/path?access_token=<redacted>'
    );
  });

  test('2: a relative URL is joined to the base URL, and an absolute one is not', () => {
    expect(
      (
        describeError(
          failure({ baseURL: 'https://api.example.com', url: '/x?a=b' })
        ) as { url: string }
      ).url
    ).toBe('https://api.example.com/x?a=b');
    expect(
      (
        describeError(
          failure({
            baseURL: 'https://api.example.com',
            url: `https://u:${MARKER_C}@other.example.com/x`,
          })
        ) as { url: string }
      ).url
    ).toBe('https://u:<redacted>@other.example.com/x');
  });
});

describe('the cause of an error of a request', () => {
  test('1: it is written the same way, with its own request', () => {
    const error = failure();
    (error as { cause?: unknown }).cause = failure({
      headers: { Authorization: `Bearer ${MARKER_B}` },
    });
    const view = describeError(error) as {
      cause: { name: string; headers: Record<string, string> };
    };
    expect(view.cause.name).toBe('AxiosError');
    expect(view.cause.headers.Authorization).toBe('Bearer <redacted>');
    expectNoMarker(describeError(error), [MARKER_A, MARKER_B]);
  });
});

describe('describeError of other errors', () => {
  test('1: a plain error writes its name and message, which JSON.stringify does not', () => {
    expect(describeError(new TypeError('bad'))).toEqual({
      name: 'TypeError',
      message: 'bad',
    });
  });

  test('2: the cause is written the same way', () => {
    const view = describeError(new Error('outer', { cause: failure() })) as {
      cause: { name: string; headers: Record<string, string> };
    };
    expect(view.cause.name).toBe('AxiosError');
    expect(view.cause.headers.Authorization).toBe('Bearer <redacted>');
    expectNoMarker(describeError(new Error('outer', { cause: failure() })));
  });

  test('3: the errors of an AggregateError are written the same way', () => {
    const aggregate = new AggregateError(
      [failure(), new Error('second')],
      'many'
    );
    const view = describeError(aggregate) as { errors: unknown[] };
    expect(view.errors).toHaveLength(2);
    expectNoMarker(describeError(aggregate));
  });

  test('4: an error that refers to itself is cut at the second visit', () => {
    const error = new Error('loop') as Error & { cause?: unknown };
    error.cause = error;
    expect(describeError(error)).toEqual({
      name: 'Error',
      message: 'loop',
      cause: '[Circular]',
    });
  });

  test('5: the nesting is bounded', () => {
    let error: Error = new Error('level 0');
    for (let level = 1; level <= MAX_ERROR_DEPTH + 3; level++) {
      error = new Error(`level ${level}`, { cause: error });
    }
    const text = JSON.stringify(describeError(error));
    expect(text).toContain('[Truncated]');
    expect(text).not.toContain('level 0');
  });

  test('6: a value that is no error is written as it is, and nothing throws', () => {
    expect(describeError('plain text')).toBe('plain text');
    expect(describeError(undefined)).toBeUndefined();
    expect(describeError(42)).toBe(42);
    const hostile = {
      get name(): string {
        throw new Error('no');
      },
      originalErrors: [],
    };
    expect(() => describeError(hostile)).not.toThrow();
  });

  test('9: the cut comes first: the count in the note is the length of the text as it was', () => {
    const jwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.c2ln';
    const message = `${'x'.repeat(MAX_BODY_LENGTH + 500)} ${jwt}`;
    const view = describeError(new Error(message)) as { message: string };
    expect(view.message.endsWith(`(${message.length} characters)`)).toBe(true);
    expect(view.message).not.toContain(jwt);
  });

  test('10: a JSON web token that a server echoes in a message is replaced', () => {
    const jwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.c2ln';
    const view = describeError(new Error(`assertion ${jwt} was refused`)) as {
      message: string;
    };
    expect(view.message).toBe('assertion <redacted> was refused');
  });

  test('8: a message and a body are cut after the length, not before', () => {
    const exactly = 'm'.repeat(MAX_BODY_LENGTH);
    const over = 'm'.repeat(MAX_BODY_LENGTH + 1);
    expect(
      (describeError(new Error(exactly)) as { message: string }).message
    ).toBe(exactly);
    expect(
      (describeError(new Error(over)) as { message: string }).message
    ).toBe(`${exactly}... (${MAX_BODY_LENGTH + 1} characters)`);
    expect(describeBody(exactly)).toBe(exactly);
    expect(describeBody(over)).toBe(
      `${exactly}... (${MAX_BODY_LENGTH + 1} characters)`
    );
  });

  test('7: a message is cut to the length of a body', () => {
    const message = 'm'.repeat(MAX_BODY_LENGTH * 3);
    const view = describeError(new Error(message)) as { message: string };
    expect(view.message.length).toBeLessThan(MAX_BODY_LENGTH + 60);
    expect(view.message).toContain(`(${MAX_BODY_LENGTH * 3} characters)`);
    const nested = describeError(
      new Error('outer', { cause: new Error(message) })
    ) as { cause: { message: string } };
    expect(nested.cause.message.length).toBeLessThan(MAX_BODY_LENGTH + 60);
  });
});

describe('the bounds of the view', () => {
  test('1: an error that is reached twice is written once, and then named', () => {
    const shared = new Error('shared');
    const error = new Error('outer', { cause: shared }) as Error & {
      errors?: unknown[];
    };
    const aggregate = new AggregateError([error, shared], 'many');
    const view = describeError(aggregate) as {
      errors: [{ cause: { message: string } }, unknown];
    };
    expect(view.errors[0].cause.message).toBe('shared');
    expect(view.errors[1]).toBe('[Repeated]');
  });

  test('2: errors that share their children are written in a time that does not depend on the sharing', () => {
    // 8 levels with 8 children each, every level shares the same 8 children: 8^8 paths
    let level: Error[] = Array.from(
      { length: 8 },
      (_, i) => new Error(`leaf ${i}`)
    );
    for (let depth = 0; depth < 8; depth++) {
      const children = level;
      level = Array.from(
        { length: 8 },
        (_, i) => new AggregateError(children, `node ${depth}.${i}`)
      );
    }
    const top = new AggregateError(level, 'top');
    let text = '';
    expect(
      leastCpuMilliseconds(() => {
        text = JSON.stringify(describeError(top));
      }, 2000)
    ).toBeLessThan(2000);
    expect(text.length).toBeLessThan(100_000);
    expect(text).toContain('[Repeated]');
  });

  test('3: a long list of errors is written up to the bound, and the rest is counted', () => {
    const errors = Array.from({ length: 20_000 }, (_, i) => new Error(`e${i}`));
    const view = describeError(new AggregateError(errors, 'many')) as {
      errors: unknown[];
    };
    expect(view.errors).toHaveLength(MAX_ERROR_NODES + 1);
    expect(view.errors[MAX_ERROR_NODES]).toBe(
      `[${20_000 - MAX_ERROR_NODES} more omitted]`
    );
    expect(JSON.stringify(view).length).toBeLessThan(10_000);
  });

  test('4: a chain of lists is bound by the number of errors, not only by the depth', () => {
    const many = Array.from({ length: 30 }, (_, i) => new Error(`a${i}`));
    const more = Array.from({ length: 30 }, (_, i) => new Error(`b${i}`));
    const view = describeError(
      new AggregateError(
        [new AggregateError(many, 'x'), new AggregateError(more, 'y')],
        'z'
      )
    );
    const text = JSON.stringify(view);
    expect(text).toContain('[Truncated]');
    expect(text.match(/"message"/g)?.length).toBeLessThanOrEqual(
      MAX_ERROR_NODES
    );
  });
});

describe('attachSafeSerialization', () => {
  test('1: the error writes the view in every form, and keeps its config', () => {
    const error = failure({
      data: { password: MARKER_C },
      auth: { username: 'admin', password: MARKER_D },
    });
    attachSafeSerialization(error);
    expectNoMarker(error, [MARKER_A, MARKER_C, MARKER_D]);
    // the code that sends the request again reads the config
    expect(error.config?.headers?.get('Authorization')).toBe(
      `Bearer ${MARKER_A}`
    );
    expect((error.config as { extra?: string }).extra).toBe(
      `Bearer ${MARKER_A}`
    );
    expect(error.config?.auth?.password).toBe(MARKER_D);
    expect(error.response?.config).toBe(error.config);
  });

  test('2: toJSON and the inspect function are own properties that are not enumerable', () => {
    const error = failure();
    attachSafeSerialization(error);
    for (const key of ['toJSON', inspect.custom]) {
      const descriptor = Object.getOwnPropertyDescriptor(error, key);
      expect(descriptor).toBeDefined();
      expect(descriptor?.enumerable).toBe(false);
    }
    expect(Object.keys(error)).not.toContain('toJSON');
  });

  test('3: the stack comes first, then the view; the properties of the config are not there', () => {
    const error = failure();
    attachSafeSerialization(error);
    const text = inspect(error, { depth: null });
    expect(
      text.startsWith('AxiosError: Request failed with status code 409')
    ).toBe(true);
    expect(text).toContain("Authorization: 'Bearer <redacted>'");
    expect(text).not.toContain('extra');
    expect(text).not.toContain('_header');
  });

  test('4: the header names the library knows from the state are sensitive', () => {
    const error = failure({
      headers: { 'X-Tenant-Name': MARKER_D, Accept: 'application/json' },
    });
    attachSafeSerialization(error, ['X-Tenant-Name']);
    expectNoMarker(error, [MARKER_D]);
    // and a header that is not sensitive is shown
    expect(JSON.stringify(error)).toContain('application/json');
  });

  test('5: attaching twice leaves one view, and a frozen error is left alone', () => {
    const error = failure();
    attachSafeSerialization(error);
    attachSafeSerialization(error);
    expectNoMarker(error);
    const frozen = Object.freeze(failure());
    expect(() => attachSafeSerialization(frozen)).not.toThrow();
    expect(() => attachSafeSerialization(undefined)).not.toThrow();
  });

  test('6: a nested depth of the inspection still prints the error in short', () => {
    const error = failure();
    attachSafeSerialization(error);
    const text = inspect({ a: error }, { depth: 0 });
    expect(text).toContain('[AxiosError: Request failed with status code 409]');
    expect(text).not.toContain(MARKER_A);
  });

  test('7: config, request and response are not enumerable, and are still read by name', () => {
    const error = failure({ responseHeaders: { 'x-other': MARKER_D } });
    expect(Object.keys(error)).toEqual(
      expect.arrayContaining(['config', 'request', 'response'])
    );
    attachSafeSerialization(error);
    for (const name of ['config', 'request', 'response']) {
      expect(Object.keys(error)).not.toContain(name);
      expect(Object.getOwnPropertyDescriptor(error, name)).toMatchObject({
        enumerable: false,
        configurable: true,
        writable: true,
      });
      expect((error as unknown as Record<string, unknown>)[name]).toBeDefined();
    }
    expect(error.response?.status).toBe(409);
    expect(error.config?.url).toBe(
      'https://tenant.example.com/am/json/trees/n1'
    );
    expect(error.config?.headers?.get('Authorization')).toBe(
      `Bearer ${MARKER_A}`
    );
  });

  test('8: a spread, Object.assign, Object.entries and a copy by property do not carry them', () => {
    const error = failure();
    attachSafeSerialization(error);
    const spread = { ...error };
    const assigned = Object.assign({}, error);
    const entries = Object.fromEntries(Object.entries(error));
    for (const copy of [spread, assigned, entries]) {
      expect(Object.keys(copy)).not.toContain('config');
      expect(Object.keys(copy)).not.toContain('request');
      expect(Object.keys(copy)).not.toContain('response');
      expectNoMarker(copy);
    }
  });

  test('9: a property that cannot be changed is left as it is', () => {
    const error = failure();
    Object.defineProperty(error, 'config', {
      value: error.config,
      enumerable: true,
      configurable: false,
      writable: false,
    });
    expect(() => attachSafeSerialization(error)).not.toThrow();
    expect(Object.keys(error)).toContain('config');
    expect(Object.keys(error)).not.toContain('request');
  });
});

/** The usual spelling of each name of the shared list, as the library and the servers write it. */
const USUAL_SPELLING: Record<string, string> = {
  authorization: 'Authorization',
  'proxy-authorization': 'Proxy-Authorization',
  cookie: 'Cookie',
  'set-cookie': 'Set-Cookie',
  'x-openam-password': 'X-OpenAM-Password',
  'x-openidm-password': 'X-OpenIDM-Password',
  'x-api-key': 'X-API-Key',
  'x-api-secret': 'X-API-Secret',
  'api-key': 'Api-Key',
  'ocp-apim-subscription-key': 'Ocp-Apim-Subscription-Key',
  'x-auth-token': 'X-Auth-Token',
  iplanetdirectorypro: 'iPlanetDirectoryPro',
};

/** Every spelling of a header name that the tests below try. */
const spellings = (name: string) => [
  ...new Set([name, name.toUpperCase(), USUAL_SPELLING[name] ?? name]),
];

describe('every name of the shared list of sensitive headers', () => {
  const names = [...SENSITIVE_HEADER_NAMES];

  test('1: the list is the one that this test knows, and every name has a usual spelling', () => {
    // a name that is added to the list needs a spelling here, so that it is tried in its usual case
    expect([...names].sort()).toEqual(Object.keys(USUAL_SPELLING).sort());
  });

  test.each(names)(
    '2: %s on a request: lower case, upper case and the usual spelling, in a plain object and in AxiosHeaders',
    (name) => {
      for (const spelling of spellings(name)) {
        const plain = { [spelling]: MARKER_C, Accept: 'application/json' };
        for (const headers of [plain, new AxiosHeaders(plain)]) {
          const written = describeHeaders(headers) as Record<string, unknown>;
          expect(Object.keys(written)).toContain(spelling);
          expect(JSON.stringify(written)).not.toContain(MARKER_C);
          expect(written.Accept).toBe('application/json');
        }
      }
    }
  );

  test.each(names)(
    '3: %s on a response: lower case, upper case and the usual spelling, in a plain object and in AxiosHeaders',
    (name) => {
      for (const spelling of spellings(name)) {
        const plain = { [spelling]: MARKER_C, 'Content-Type': 'text/plain' };
        for (const headers of [plain, new AxiosHeaders(plain)]) {
          const written = describeResponseHeaders(headers) as Record<
            string,
            unknown
          >;
          expect(Object.keys(written)).toContain(spelling);
          expect(JSON.stringify(written)).not.toContain(MARKER_C);
          expect(written['Content-Type']).toBe('text/plain');
        }
      }
    }
  );

  test.each(names)(
    '4: %s in the error of a request, written in every form, as a header of the request and of the answer',
    (name) => {
      const spelling = USUAL_SPELLING[name];
      const error = failure({
        headers: { [spelling]: MARKER_C },
        responseHeaders: { [spelling]: MARKER_C },
      });
      // a FrodoError that wraps the error writes the view, whether the error passed an instance or not
      expectNoMarker(new FrodoError('wrapped', error), [MARKER_C]);
      attachSafeSerialization(error);
      expectNoMarker(error, [MARKER_C]);
    }
  );

  test('5: the view reads the list and no copy of it: a name added to the list is redacted', () => {
    const list = SENSITIVE_HEADER_NAMES as string[];
    list.push('x-added-by-the-test');
    try {
      expect(describeHeaders({ 'X-Added-By-The-Test': MARKER_C })).toEqual({
        'X-Added-By-The-Test': '<redacted>',
      });
      expect(
        describeResponseHeaders({ 'X-Added-By-The-Test': MARKER_C })
      ).toEqual({ 'X-Added-By-The-Test': '<redacted>' });
      const error = failure({
        headers: { 'X-Added-By-The-Test': MARKER_C },
        responseHeaders: { 'X-Added-By-The-Test': MARKER_C },
      });
      attachSafeSerialization(error);
      expectNoMarker(error, [MARKER_C]);
    } finally {
      list.pop();
    }
    // and once it is out of the list the header is written again
    expect(describeHeaders({ 'X-Added-By-The-Test': MARKER_C })).toEqual({
      'X-Added-By-The-Test': MARKER_C,
    });
  });

  test('6: the view reads the list of sensitive fields and no copy of it: a name added to it is redacted', () => {
    const list = SENSITIVE_FIELD_NAMES as string[];
    list.push('added_by_the_test');
    try {
      expect(describeBody({ added_by_the_test: MARKER_C, a: 1 })).toEqual({
        added_by_the_test: '<redacted>',
        a: 1,
      });
    } finally {
      list.pop();
    }
  });
});

describe('the cookies of a request and of an answer', () => {
  const COOKIE_NAME = 'customSession';

  test('1: a Cookie header holds cookies, the names stay and every value is replaced', () => {
    const headers = describeHeaders({
      Cookie: `a=${MARKER_A}; ${COOKIE_NAME}=${MARKER_B}; flag`,
    }) as Record<string, string>;
    expect(headers.Cookie).toBe(
      `a=<redacted>; ${COOKIE_NAME}=<redacted>; <redacted>`
    );
  });

  test('2: a Set-Cookie header with attributes: the names stay, no value stays', () => {
    const text = `${COOKIE_NAME}=${MARKER_B}; Path=/; Domain=example.com; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Max-Age=3600; HttpOnly; Secure; SameSite=None`;
    for (const written of [
      describeHeaders({ 'Set-Cookie': text }),
      describeResponseHeaders({ 'Set-Cookie': text }),
      describeResponseHeaders({ 'set-cookie': [text, `b=${MARKER_A}`] }),
    ]) {
      const value = JSON.stringify(written);
      expect(value).toContain(`${COOKIE_NAME}=<redacted>`);
      expect(value).not.toContain(MARKER_A);
      expect(value).not.toContain(MARKER_B);
      expect(value).not.toContain('example.com');
    }
  });

  test('3: a header that is named like the session cookie is replaced when the library knows the name', () => {
    expect(describeHeaders({ [COOKIE_NAME]: MARKER_B }, [COOKIE_NAME])).toEqual(
      { [COOKIE_NAME]: '<redacted>' }
    );
    expect(
      describeResponseHeaders({ [COOKIE_NAME]: MARKER_B }, [COOKIE_NAME])
    ).toEqual({ [COOKIE_NAME]: '<redacted>' });
    // by its default name it is on the list
    expect(describeHeaders({ iPlanetDirectoryPro: MARKER_B })).toEqual({
      iPlanetDirectoryPro: '<redacted>',
    });
  });

  test('4: the three forms together in the error of a request, in every form it is written in', () => {
    const error = failure({
      headers: {
        Cookie: `a=${MARKER_A}; ${COOKIE_NAME}=${MARKER_B}`,
        [COOKIE_NAME]: MARKER_B,
      },
      responseHeaders: { 'Set-Cookie': `${COOKIE_NAME}=${MARKER_B}; Path=/` },
    });
    attachSafeSerialization(error, [COOKIE_NAME]);
    expectNoMarker(error, [MARKER_A, MARKER_B]);
    const view = JSON.parse(JSON.stringify(error));
    expect(Object.keys(view.headers)).toEqual(
      expect.arrayContaining(['Cookie', COOKIE_NAME])
    );
    expect(view.headers.Cookie).toBe(`a=<redacted>; ${COOKIE_NAME}=<redacted>`);
  });
});

describe('the header overrides of the state', () => {
  const OVERRIDES = {
    authentication: [
      'X-Tenant-Access',
      'x-tenant-access-low',
      'X-TENANT-ACCESS-UP',
    ],
    configuration: [
      'X-Tenant-Config',
      'x-tenant-config-low',
      'X-TENANT-CONFIG-UP',
    ],
  };

  test.each(Object.entries(OVERRIDES))(
    '1: the %s overrides of the state are redacted in the request and the answer, in any case',
    (_kind, names) => {
      const headers = Object.fromEntries(names.map((name) => [name, MARKER_D]));
      const error = failure({ headers, responseHeaders: headers });
      attachSafeSerialization(error, names);
      expectNoMarker(error, [MARKER_D]);
      const view = JSON.parse(JSON.stringify(error));
      for (const name of names) {
        expect(view.headers[name]).toBe('<redacted>');
        expect(view.response.headers[name]).toBe('<redacted>');
      }
    }
  );

  test('2: the names that an instance told are known to the view of an error that never passed an instance', () => {
    attachSafeSerialization(failure(), ['X-Registered-Name']);
    const foreign = failure({
      headers: { 'x-registered-name': MARKER_D },
      responseHeaders: { 'X-REGISTERED-NAME': MARKER_D },
    });
    // the error never passed the interceptor, a FrodoError wraps it
    expectNoMarker(new FrodoError('wrapped', foreign), [MARKER_D]);
    const view = JSON.parse(JSON.stringify(new FrodoError('wrapped', foreign)));
    expect(view.originalErrors[0].headers['x-registered-name']).toBe(
      '<redacted>'
    );
  });
});

describe('what an error still holds', () => {
  test('1: config, request and response, and the config of the response, are readable by name and hold what they held', () => {
    const error = failure({ responseHeaders: { 'x-other': MARKER_D } });
    attachSafeSerialization(error);
    // unchanged by design: the code that sends the request again reads them, and so does a caller
    expect(String(error.config?.headers?.get('Authorization'))).toContain(
      MARKER_A
    );
    expect((error.request as { _header: string })._header).toContain(MARKER_A);
    expect(error.response?.headers?.['x-other']).toBe(MARKER_D);
    expect(
      String(error.response?.config?.headers?.get('Authorization'))
    ).toContain(MARKER_A);
    // and what a property walker reaches does not include them
    expect(Object.keys(error)).not.toContain('config');
    expect(Object.keys(error)).not.toContain('request');
    expect(Object.keys(error)).not.toContain('response');
  });
});
