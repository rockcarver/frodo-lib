import { leastCpuMilliseconds } from '../test/utils/CpuTime';
import { describeBody, MAX_STRUCTURED_TEXT } from './ErrorSerializationUtils';

/**
 * What the view writes for a text that looks like JSON: the text is read as
 * structure (it parses and is within the bound, the budget of the view or a few
 * KiB, and the depth of texts in texts) or it is not written at all; a text that
 * does not look like JSON is written as any text is. The table of the cases is in
 * the description of `describeString`.
 */

const placeholder = (text: string) =>
  `<text of ${text.length} characters not written>`;
const T = 'ZQXwithheld0123456789';
const pad = (length: number) => 'x'.repeat(length);
const json = (value: unknown) => JSON.stringify(value);
const repeated = (text: string, length: number) =>
  text.repeat(Math.ceil(length / text.length)).slice(0, length);

describe('a text that does not look like JSON is written as any text is', () => {
  const rep = (text: string, length: number) =>
    text.repeat(Math.ceil(length / text.length)).slice(0, length);

  test.each([
    ['a log line', '2026-11-19 10:00:01 ERROR connection reset by peer'],
    ['a log line that starts with a bracket', '[INFO] retrying in 5 seconds'],
    ['a log line that starts with a word in brackets', '[timeout] giving up'],
    [
      'a log line that starts with a date in brackets',
      '[2026-11-19T10:00:01Z] failed: timeout after 30 s',
    ],
    ['a text that starts with a bracket and a word', '[not json'],
    ['a message with a quoted word', 'The value "abc" is not valid'],
    ['a message with a path', 'cannot open C:\\Users\\admin\\x.json: denied'],
    [
      'braces and brackets with no quote after them',
      'a { } {1} {x: 1} a[0] b[i]',
    ],
    ['a style sheet', 'body { margin: 0 } a{color:red} .x > .y{margin:0}'],
    ['a short text', 'Invalid credentials for user admin'],
  ])('1: %s is written as it is (cut at 4,000 characters)', (_name, text) => {
    const expected =
      text.length > 4_000
        ? `${text.slice(0, 4_000)}... (${text.length} characters)`
        : text;
    expect(describeBody(text)).toBe(expected);
    // as a value of an object (a text that is written whole there is part of a body that is cut at 4,000 characters)
    if (text.length < 3_000) {
      expect(describeBody({ detail: text })).toEqual({ detail: expected });
      expect(describeBody([text])).toEqual([expected]);
    }
  });

  test('2: a plain text of a megabyte with a named value in it is cut after its value is replaced', () => {
    const text = `password=${T} ${rep('lorem ipsum ', 1_000_000)}`;
    const written = String(describeBody(text));
    expect(written).not.toContain(T);
    // a text that starts with a field is a form: the field is replaced as the form says
    expect(written).toBe(`password=<redacted>... (${text.length} characters)`);
  });

  test('3: a Bearer value that the cut falls in is replaced, at every offset around the cut', () => {
    for (let offset = 3_950; offset <= 4_050; offset++) {
      const text = `${pad(offset)} Bearer ${T}${T} ${pad(70_000)}`;
      expect([offset, /Bearer Z/.test(String(describeBody(text)))]).toEqual([
        offset,
        false,
      ]);
    }
  });

  test('4: a form body has its sensitive fields replaced', () => {
    expect(
      describeBody(`grant_type=password&username=a&password=${T}&scope=x`)
    ).toBe('grant_type=password&username=a&password=<redacted>&scope=x');
  });

  test('5: what follows the part that is written is not looked at: a JSON text after it does not make the text one', () => {
    const text = `${pad(6_000)} {"password":"${T}"}`;
    expect(describeBody(text)).toBe(
      `${text.slice(0, 4_000)}... (${text.length} characters)`
    );
  });
});

describe('a text that looks like JSON is read as structure, or it is not written', () => {
  const json = (value: unknown) => JSON.stringify(value);
  const inside = (text: string, times: number) => {
    let result = text;
    for (let i = 0; i < times; i++) result = json({ w: result });
    return result;
  };

  test.each([
    ['an object', json({ a: 1, password: T })],
    ['a list of objects', json([{ password: T }, { b: 2 }])],
    ['a string literal that holds JSON', json(json({ password: T }))],
  ])(
    '1: %s that parses is written as structure, the sensitive value replaced',
    (_name, text) => {
      const written = JSON.stringify(describeBody(text));
      expect(written).not.toContain(T);
      expect(written).toContain('<redacted>');
      expect(written).not.toContain('not written');
    }
  );

  test('1b: a list of numbers that parses is written as structure (the text, cut at 4,000 characters)', () => {
    const text = `[${repeated('1,2,3,', 30_000)}0]`;
    expect(describeBody(text)).toBe(
      `${text.slice(0, 4_000)}... (${text.length} characters)`
    );
  });

  test('2: the bound is exact: a text of 64 KiB is read, one character more is not written', () => {
    const make = (length: number) => {
      const empty = json({ password: T, pad: '' }).length;
      return json({ password: T, pad: pad(length - empty) });
    };
    const at = make(MAX_STRUCTURED_TEXT);
    const over = make(MAX_STRUCTURED_TEXT + 1);
    expect(at.length).toBe(MAX_STRUCTURED_TEXT);
    expect(over.length).toBe(MAX_STRUCTURED_TEXT + 1);
    expect(JSON.stringify(describeBody({ detail: at }))).toContain(
      '<redacted>'
    );
    expect(describeBody({ detail: over })).toEqual({
      detail: placeholder(over),
    });
    expect(describeBody(over)).toBe(placeholder(over));
  });

  test.each([
    ['a text that does not parse', `{"password":"${T}","oops`],
    ['a text with a stray brace', `${json({ password: T })}}`],
    ['a text that is cut', json({ password: T, pad: pad(100) }).slice(0, 60)],
    ['a text after a prefix', `Error: ${json({ password: T })}`],
    ['a text after a quote', `"${json({ password: T })}`],
    [
      'a text that starts with a brace and is no JSON',
      `{PRE"type":"x","IDToken2":"${T}"}`,
    ],
    ['a text that starts with a brace and a word', `{password: ${T}}`],
    ['a text that starts with a bracket and a literal', `[true, ${T} oops`],
    ['a text after a byte order mark', `\ufeff x ${json({ password: T })}`],
    ['a text with a raw newline in a string', '{"password":"a\nb' + T + '"}'],
    ['a text with an invalid escape', `{"password":"a\\q${T}"}`],
    ['a text with a partial unicode escape', `{"password":"a\\u12${T}"}`],
    ['an escaped quote in a plain text', `say \\"hi\\" ${T}`],
    ['a unicode escape in a plain text', `x \\u0070assword ${T}`],
  ])('3: %s is not written, whatever its length', (_name, text) => {
    expect(describeBody(text)).toBe(placeholder(text));
    expect(describeBody({ detail: text })).toEqual({
      detail: placeholder(text),
    });
    expect(describeBody({ detail: [text] })).toEqual({
      detail: [placeholder(text)],
    });
  });

  test('4: the depth is exact: four texts inside each other are read, the fifth is not written', () => {
    const read = (times: number) =>
      JSON.stringify(
        describeBody({ detail: inside(json({ password: T }), times) })
      );
    // `detail` is a text (depth 0); each wrapper is one more level; the secret text stands at depth `times + 1`
    expect(read(0)).not.toContain('not written');
    expect(read(1)).not.toContain('not written');
    expect(read(2)).not.toContain('not written');
    expect(read(3)).not.toContain('not written');
    expect(read(4)).toContain('not written');
    expect(read(8)).toContain('not written');
    for (const times of [0, 1, 2, 3, 4, 5, 8]) {
      expect(read(times)).not.toContain(T);
    }
  });

  test('6: a string value of a sensitive name is replaced as a whole, also when it holds JSON', () => {
    for (const secret of [
      json({ kty: 'RSA', d: T }),
      json([T]),
      `["${T}"]`,
      `{"x":"${T}"}`,
      `a{"${T}`,
      `{[\n${T}`,
    ]) {
      for (const key of ['secret', 'client_secret', 'assertion', 'password']) {
        const text = json({ [key]: secret, pad: pad(70_000) });
        const small = json({ [key]: secret });
        expect(JSON.stringify(describeBody({ detail: text }))).not.toContain(T);
        expect(JSON.stringify(describeBody({ detail: small }))).not.toContain(
          T
        );
        expect(String(describeBody(small))).not.toContain(T);
        expect(String(describeBody(small))).toContain('<redacted>');
      }
    }
  });

  test('7: a list, an object or a number under a sensitive name is replaced, and so is a key that holds an escape', () => {
    for (const small of [
      json({ password: [T] }),
      json({ password: { x: { y: T } } }),
      json({ client_secret: [[T]] }),
      json({ cookie: [`a=${T}`] }),
      json({ '\\u0070assword': T }),
      json({ '\\\\u0070assword': [T] }),
      json({ '\\u005cu0070assword': { x: T } }),
      '{"\\u0070assword":["' + T + '"]}',
      json({
        callbacks: [
          {
            type: 'PasswordCallback',
            input: [{ name: 'IDToken2', value: [T] }],
          },
        ],
      }),
      json({
        callbacks: [
          { type: 'PasswordCallback', input: [{ name: 'a', value: { v: T } }] },
        ],
      }),
      json({ type: 'PasswordCallback', IDToken2: T }),
    ]) {
      expect(String(describeBody(small))).not.toContain(T);
      expect(JSON.stringify(describeBody({ detail: small }))).not.toContain(T);
    }
  });

  test('8: a number as the answer to a callback is replaced', () => {
    const small = json({
      callbacks: [
        {
          type: 'PasswordCallback',
          input: [{ name: 'IDToken2', value: 987654321 }],
        },
      ],
    });
    expect(String(describeBody(small))).not.toContain('987654321');
  });
});

describe('the trigger: each part of it decides on its own', () => {
  test.each([
    ['an opening brace and a quote', 'x {"a":1} y'],
    ['an opening brace, a blank and a quote', 'x { "a":1} y'],
    ['an opening bracket and a quote', 'x ["a"] y'],
    ['an opening brace and a backslash', 'x {\\ y'],
    ['two opening braces', 'x {{ y'],
    ['two opening brackets', 'x [[ y'],
    ['an opening bracket and an opening brace', 'x [{ y'],
    ['an escaped quote', 'x \\" y'],
    ['a unicode escape', 'x \\u0041 y'],
    ['a text that starts with a brace', '{x'],
    ['a text that starts with blanks and a brace', '   {x'],
    ['a text that starts with a bracket, a number and a comma', '[1, x'],
    ['a text that starts with a bracket and a number', '[12] x'],
    ['a text that starts with a bracket and a negative number', '[-1.5e3] x'],
    ['a text that starts with a bracket and true', '[true] x'],
    ['a text that starts with a bracket and null', '[null, x'],
    ['a text that starts with a bracket and a quote', '["x'],
    ['a text that starts with an empty list', '[] x'],
    ['a trigger after 4,100 characters', `${pad(4_100)} {"a":1}`],
  ])('1: %s: the text is not written', (_name, text) => {
    expect(describeBody(text)).toBe(placeholder(text));
  });

  test.each([
    ['a unicode escape of three digits', 'x \\u004 y'],
    ['an opening bracket and a word', 'x [abc] y'],
    ['an opening brace and a word', 'x {abc} y'],
    [
      'a text that starts with a bracket and a date',
      '[2026-11-19T10:00:00Z] x',
    ],
    ['a text that starts with a bracket and a word', '[timeout] x'],
    [
      'a text that starts with a bracket and a literal that is a word',
      '[trouble] x',
    ],
    ['a trigger after the part that is written', `${pad(6_000)} {"a":1}`],
  ])('2: %s: the text is written as any text is', (_name, text) => {
    const expected =
      text.length > 4_000
        ? `${text.slice(0, 4_000)}... (${text.length} characters)`
        : text;
    expect(describeBody(text)).toBe(expected);
  });

  test('3: an object that is no callback keeps the values of its input', () => {
    const text = json({ input: [{ name: 'a', value: 'visible' }] });
    expect(describeBody(text)).toBe(text);
  });
});

describe('the body of a request or an answer that is an object', () => {
  test('1: the values of sensitive names are replaced whatever they are, at any depth', () => {
    const body = {
      a: { password: { x: { y: T } } },
      b: [{ client_secret: [T] }, { cookie: [`a=${T}`] }],
      c: { secret: JSON.stringify({ kty: 'RSA', d: T }) },
      d: { assertion: 12345, tokens: 'kept' },
      e: { password: '', other: true },
    };
    const written = describeBody(body) as Record<string, any>;
    expect(JSON.stringify(written)).not.toContain(T);
    expect(written.a.password).toBe('<redacted>');
    expect(written.b[0].client_secret).toBe('<redacted>');
    expect(written.b[1].cookie).toBe('<redacted>');
    expect(written.c.secret).toBe('<redacted>');
    expect(written.d).toEqual({ assertion: '<redacted>', tokens: 'kept' });
    // nothing is replaced where nothing is held
    expect(written.e).toEqual({ password: '', other: true });
  });

  test('2: a key that is named __proto__ is written as a key, and changes nothing', () => {
    const text = '{"__proto__":{"polluted":"yes"},"n":1}';
    const written = describeBody(text) as string;
    expect(written).toBe(text);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const object = describeBody(JSON.parse(text)) as Record<string, unknown>;
    expect(Object.keys(object)).toEqual(['__proto__', 'n']);
    expect(Object.getPrototypeOf(object)).toBe(Object.prototype);
    // with a value to replace, the key is dropped and nothing else of it is written
    const withSecret = describeBody(
      '{"__proto__":{"polluted":"yes"},"password":"x"}'
    );
    expect(withSecret).toBe('{"password":"<redacted>"}');
  });

  test('3: a value that is a boolean, null or an empty string under a sensitive name stays', () => {
    expect(
      describeBody({ password: true, secret: null, client_secret: '' })
    ).toEqual({ password: true, secret: null, client_secret: '' });
  });
});

describe('a value that holds a quote and a brace or a bracket', () => {
  const VALUES = [
    `a{"${T}`,
    `a["${T}`,
    `a{{"${T}`,
    `a[["${T}`,
    `a{["${T}`,
    `a[{"${T}`,
    `a{ "${T}`,
    `a"{"${T}`,
    `a"{${T}`,
    `a"[[${T}`,
    `a\\{{${T}`,
    `a\\[{${T}`,
    `a\n{"${T}`,
    `x{\\${T}`,
    `a"b{c${T}`,
    `a{{${T}`,
    `a[[${T}`,
    `a{"b"c${T}`,
    `{"${T}`,
    `["${T}`,
    `Error: {"${T}`,
  ];

  test.each(VALUES.map((value) => [JSON.stringify(value), value]))(
    '1: %s under a password, in a text of every length, as a detail value, a list item and a body',
    (_name, value) => {
      for (const size of [0, 5_000, 70_000]) {
        for (const text of [
          JSON.stringify({ password: value, pad: pad(size) }),
          `${JSON.stringify({ password: value, pad: pad(size) })}}}`,
          JSON.stringify({
            w: JSON.stringify({ password: value, pad: pad(size) }),
          }),
        ]) {
          expect(
            JSON.stringify(describeBody({ detail: { echo: text } }))
          ).not.toContain(T);
          expect(JSON.stringify(describeBody([text]))).not.toContain(T);
          expect(String(describeBody(text))).not.toContain(T);
        }
      }
    }
  );
});

describe('the time that a text takes does not depend on its shape', () => {
  const rep = (text: string, length: number) =>
    text.repeat(Math.ceil(length / text.length)).slice(0, length);

  /** The least CPU time of a few runs in milliseconds: a load on the machine does not count. */
  const cpu = (run: () => unknown, bound: number): number =>
    leastCpuMilliseconds(run, bound);

  const SHAPES: [string, (length: number) => string][] = [
    ['backslashes and then a letter', (n) => `${rep('\\', n)}x`],
    [
      'a string that holds a run of backslashes',
      (n) => `{"a":"${rep('\\', n)}x"}`,
    ],
    [
      'a text that does not parse, with a run of backslashes in it',
      (n) => `{"a":"${rep('\\', n + 1)}x" more`,
    ],
    [
      'a text that does not parse, with a run of backslashes and a letter',
      (n) => `{"a":"${rep('\\', n + 1)}x`,
    ],
    ['backslashes and then a quote', (n) => `${rep('\\', n)}"x`],
    ['a run of quotes', (n) => rep('"', n)],
    ['a run of braces', (n) => rep('{', n)],
    ['a run of brackets', (n) => rep('[', n)],
    ['braces and quotes', (n) => rep('{"', n)],
    ['brackets and braces', (n) => rep('[{', n)],
    [
      'small strings with an escaped quote',
      (n) => `[${rep('"a\\"b",', n)}"z"]`,
    ],
    ['small objects', (n) => `[${rep('{"a":"\\"x\\""},', n)}{}]`],
    ['lists inside lists', (n) => `${rep('[', n / 2)}${rep(']', n / 2)}`],
    [
      'objects inside objects',
      (n) => `${rep('{"a":', n / 5)}1${rep('}', n / 5)}`,
    ],
    ['unicode escapes', (n) => `{"a":"${rep('\\u0070', n)}"}`],
    ['escaped quotes', (n) => rep('\\"', n)],
    ['blanks and then an object', (n) => `${rep(' ', n)}{"a":1}`],
    ['an object with blanks in it', (n) => `{${rep(' ', n)}"a":1}`],
    ['URLs', (n) => rep('http://u:p@h/x?y=1 ', n)],
  ];

  test.each(
    SHAPES.flatMap(([name, make]) =>
      [
        [16_000, 250],
        [1 << 20, 500],
        [4 << 20, 1_500],
      ].map(([length, bound]) => [name, length, bound, make] as const)
    )
  )(
    '1: %s, %s characters: as a body, as a value of an object and in a list, in under %s ms of CPU in all',
    (_name, length, bound, make) => {
      const text = make(length);
      const milliseconds = cpu(() => {
        describeBody(text);
        describeBody({ detail: { echo: text } });
        describeBody([text, text]);
      }, bound);
      expect(milliseconds).toBeLessThan(bound);
    }
  );

  test('2: 20 different texts of 16,000 backslashes and a letter, the same text 11 times: milliseconds', () => {
    const texts = Array.from(
      { length: 20 },
      (_, i) => `${rep('\\', 16_000)}${i}x`
    );
    const milliseconds = cpu(() => {
      for (const text of texts) {
        for (let times = 0; times < 11; times++) describeBody({ detail: text });
      }
    }, 1000);
    expect(milliseconds).toBeLessThan(1000);
  });

  test('3: 10,000 small JSON texts in strings of one list are read in time in proportion to their size', () => {
    const list = JSON.stringify(
      Array.from({ length: 10_000 }, (_, i) => JSON.stringify({ n: i, a: '"' }))
    );
    expect(list.length).toBeGreaterThan(MAX_STRUCTURED_TEXT);
    const milliseconds = cpu(() => {
      describeBody({ detail: list });
      describeBody({ detail: JSON.parse(list) });
    }, 2000);
    expect(milliseconds).toBeLessThan(2000);
  });
});

describe('a sensitive name that stands as a value: the value beside it is replaced', () => {
  const written = (value: unknown) =>
    JSON.stringify(describeBody({ detail: JSON.stringify(value) }));
  const writtenBody = (value: unknown) =>
    String(describeBody(JSON.stringify(value)));

  test.each([
    ['a name and a value', { name: 'x-api-key', value: T }],
    ['a name that is a header', { name: 'Cookie', value: `sid=${T}` }],
    [
      'a name that is Authorization',
      { name: 'Authorization', value: `Basic ${T}` },
    ],
    ['a property name', { propertyName: 'password', value: T }],
    ['a key and a val', { key: 'password', val: T }],
    ['a header and a content', { header: 'X-Auth-Token', content: T }],
    ['a field and values', { field: 'client_secret', values: [T] }],
    ['an attribute and a data', { attribute: 'userPassword', data: { x: T } }],
    ['a headerName and a value', { headerName: 'set-cookie', value: T }],
    [
      'a parameter name in camel case',
      { parameterName: 'accessToken', value: T },
    ],
    ['a name with an escape in it', { name: '\\u0070assword', value: T }],
    [
      'a name that holds other members',
      { id: 1, name: 'password', note: 'n', value: T },
    ],
    [
      'a name in a list of such objects',
      [
        { name: 'a', value: 'v' },
        { name: 'api_key', value: T },
      ],
    ],
  ])('1: %s', (_name, value) => {
    expect(written(value)).not.toContain(T);
    expect(writtenBody(value)).not.toContain(T);
    expect(writtenBody(value)).toContain('<redacted>');
  });

  test.each([
    ['a name that is no sensitive name', { name: 'user', value: 'visible' }],
    ['a name without a value beside it', { name: 'password', note: 'visible' }],
    ['a name that is a number', { name: 5, value: 'visible' }],
    ['a value without a name', { value: 'visible', other: 1 }],
    ['a name that is empty', { name: '', value: 'visible' }],
    [
      'a name that is much too long to be one',
      { name: `password${' '.repeat(100)}`, value: 'visible' },
    ],
  ])('2: %s keeps its value', (_name, value) => {
    expect(writtenBody(value)).toBe(JSON.stringify(value));
  });

  test.each([
    'name',
    'key',
    'header',
    'headerName',
    'field',
    'fieldName',
    'attribute',
    'attributeName',
    'property',
    'propertyName',
    'parameter',
    'parameterName',
    'param',
    'paramName',
    'Header_Name',
    'PROPERTY-NAME',
    'label',
    'id',
    'type',
    'title',
    'headerKey',
    'propName',
    'variable',
    'variableName',
    'env',
    'setting',
    'settingName',
  ])('2b: %s names the field, whichever value key is beside it', (nameKey) => {
    for (const valueKey of [
      'value',
      'values',
      'val',
      'content',
      'data',
      'Value',
      'VALUE',
      'text',
      'v',
      'stringValue',
      'propValue',
      'headerValue',
      'encrypted',
      'string_value',
    ]) {
      const object = { [nameKey]: 'x-api-key', [valueKey]: T };
      expect([nameKey, valueKey, writtenBody(object).includes(T)]).toEqual([
        nameKey,
        valueKey,
        false,
      ]);
    }
  });

  test.each([
    [
      'a name under a key that is not in the list',
      { nm: 'x-api-key', value: T },
    ],
    ['a name under `names`', { names: 'x-api-key', value: T }],
    [
      'a value under a key that is not in the list',
      { name: 'x-api-key', payload: T },
    ],
    ['a value under `valued`', { name: 'x-api-key', valued: T }],
    ['a name that is no name of a secret', { name: 'label', value: T }],
  ])(
    '2c: %s: the value is written (the rule reads the listed keys only)',
    (_name, object) => {
      expect(writtenBody(object)).toContain(T);
    }
  );

  test('3: an object with more than 64 members is no pair of a name and a value', () => {
    const many: Record<string, unknown> = {
      name: 'password',
      value: 'visible',
    };
    for (let i = 0; i < 63; i++) many[`m${i}`] = i;
    expect(Object.keys(many)).toHaveLength(65);
    expect(writtenBody(many)).toContain('"value":"visible"');
    delete many.m0;
    expect(writtenBody(many)).toContain('"value":"<redacted>"');
  });

  test.each([
    ['a pair in a list', [['Cookie', `sid=${T}`]], [['Cookie', '<redacted>']]],
    ['a pair', ['password', T], ['password', '<redacted>']],
    [
      'pairs of two kinds',
      [
        ['a', 'b'],
        ['X-Api-Key', T],
      ],
      [
        ['a', 'b'],
        ['X-Api-Key', '<redacted>'],
      ],
    ],
    [
      'a pair with a list as the value',
      ['Set-Cookie', [T]],
      ['Set-Cookie', '<redacted>'],
    ],
    ['a pair with a number', ['api_key', 12345], ['api_key', '<redacted>']],
    [
      'a pair in an object',
      { headers: [['Authorization', `Bearer ${T}`]] },
      { headers: [['Authorization', '<redacted>']] },
    ],
    [
      'a name, its value and more',
      ['Cookie', `sid=${T}`, 'Path=/'],
      ['Cookie', '<redacted>', 'Path=/'],
    ],
    [
      'a flat list of header names and values (the raw headers of a request)',
      ['Host', 'example.test', 'Cookie', `sid=${T}`, 'Accept', 'text/plain'],
      ['Host', 'example.test', 'Cookie', '<redacted>', 'Accept', 'text/plain'],
    ],
    [
      'a name in the middle of a list',
      ['a', 'password', T, 'b'],
      ['a', 'password', '<redacted>', 'b'],
    ],
    [
      'two names in a row: both the next member of each is replaced',
      ['password', 'Cookie', T],
      ['password', '<redacted>', '<redacted>'],
    ],
    [
      'a name followed by an object',
      ['password', { value: T }, 'b'],
      ['password', '<redacted>', 'b'],
    ],
    [
      'an object after a list that holds no name',
      ['a', 'b', { password: T }],
      ['a', 'b', { password: '<redacted>' }],
    ],
  ])('4: %s', (_name, value, expected) => {
    expect(writtenBody(value)).toBe(JSON.stringify(expected));
    expect(written(value)).not.toContain(T);
  });

  test.each([
    ['a list of two names', ['Cookie', 'Authorization']],
    ['a pair of no names', ['a', 'b']],
    ['a pair that holds nothing', ['password', '']],
    ['a pair that holds null', ['password', null]],
    ['three members, no name', ['a', 'visible', 'x']],
    ['one member', ['Cookie']],
    ['a name that is last', ['visible', 'Cookie']],
    ['a name followed by nothing', ['a', 'password', '']],
    ['a name followed by null', ['a', 'password', null, 'b']],
  ])('5: %s is not a pair of a name and a value', (_name, value) => {
    const expected =
      JSON.stringify(value) === JSON.stringify(['Cookie', 'Authorization'])
        ? ['Cookie', '<redacted>']
        : value;
    expect(writtenBody(value)).toBe(JSON.stringify(expected));
  });
});

describe('the spellings of the names of credentials, as keys of a text that is read as structure', () => {
  const SPELLED = [
    'user_password',
    'userPassword',
    'passwordHash',
    'pwd',
    'passwd',
    'pass',
    'passphrase',
    'secretKey',
    'client-secret',
    'clientSecret',
    'accessToken',
    'access-token',
    'ACCESS_TOKEN',
    'idToken',
    'refreshToken',
    'token',
    'sessionToken',
    'session_token',
    'jwt',
    'bearer',
    'api_key',
    'apiKey',
    'x-api-key',
    'X-Api-Key',
    'privateKey',
    'credential',
    'credentials',
    'authorization',
    'Cookie',
    'set-cookie',
    'X-Auth-Token',
  ];

  test.each(SPELLED)(
    '1: %s: the value is replaced, as a field of a body, of a text and inside headers',
    (name) => {
      expect(JSON.stringify(describeBody({ [name]: T }))).not.toContain(T);
      expect(
        JSON.stringify(describeBody({ headers: { [name]: T } }))
      ).not.toContain(T);
      expect(String(describeBody(JSON.stringify({ [name]: T })))).toBe(
        JSON.stringify({ [name]: '<redacted>' })
      );
      expect(
        JSON.stringify(
          describeBody({ detail: JSON.stringify({ a: { [name]: [T] } }) })
        )
      ).not.toContain(T);
    }
  );

  test('2: the key `value` and the other keys that are no names keep their values', () => {
    const text = JSON.stringify({
      value: 'a',
      tokens: 'b',
      passwords: 'c',
      code: 401,
      username: 'u',
    });
    expect(describeBody(text)).toBe(text);
  });
});

describe('JSON written with entities or percent encoding, and the markup of a credential', () => {
  test.each([
    ['entities', '<pre>{&quot;password&quot;:&quot;S&quot;}</pre>'],
    ['entities with a number', 'x {&#34;password&#34;:&#34;S&#34;} y'],
    ['entities with a hexadecimal number', 'x {&#x22;password&#x22;:1} y'],
    ['entities with a zero in front', 'x [&#0034;a&#0034;] y'],
    ['entities after blanks', 'x {  &quot;a&quot;:1} y'],
    ['a bracket and an entity', 'x [&quot;a&quot;] y'],
    ['a brace and an encoded quote', 'x {%22a%22:1} y'],
    ['percent encoding', 'data=%7B%22password%22%3A%22S%22%7D'],
    ['percent encoding in lower case', 'data=%7b%22password%22%3a%22S%22%7d'],
    ['percent encoding of a list', 'data=%5B%22a%22%5D'],
    [
      'percent encoding twice',
      'data=%257B%2522password%2522%253A%2522S%2522%257D',
    ],
    [
      'percent encoding three times',
      'data=%25257B%252522password%252522%25253A1%25257D',
    ],
    ['an entity of a brace', 'x &lbrace;&quot;a&quot;:1&rbrace; y'],
    ['an entity of a curly bracket', 'x &lcub;&quot;a&quot;:1&rcub; y'],
    ['an entity of a bracket', 'x &lbrack;&quot;a&quot;&rbrack; y'],
    ['an entity of a square bracket', 'x &lsqb;&quot;a&quot;&rsqb; y'],
    ['an entity of a backslash', 'x &bsol;&quot; y'],
    ['an entity of an angle bracket', 'x &lt;password&gt;S&lt;/password&gt; y'],
    ['an entity of an ampersand', 'x &amp;#34; {&amp;quot;a&amp;quot;:1} y'],
    ['an XML element', '<login><password>S</password></login>'],
    ['an XML element with an attribute', '<Password type="x">S</Password>'],
    ['an XML element that is closed at once', 'x <passwd/> y'],
    ['an XML element of a client secret', '<client_secret>S</client_secret>'],
    ['an XML element of a token', '<accessToken>S</accessToken>'],
    ['an XML element of a token, in a message', 'got <token> in the answer'],
    ...[
      'password',
      'passwd',
      'pwd',
      'passphrase',
      'secret',
      'clientSecret',
      'client_secret',
      'apiKey',
      'api_key',
      'accessToken',
      'refresh_token',
      'refreshToken',
      'idToken',
      'id_token',
      'token',
      'credential',
      'credentials',
      'PASSWORD',
    ].map(
      (tag) =>
        [`an XML element ${tag}`, `<${tag}>S</${tag}>`] as [string, string]
    ),
    ['an XML element with blanks', '< password >S</password>'],
    [
      'an XML element with an attribute of 300 characters',
      `<password ${'a'.repeat(300)}>S</password>`,
    ],
    ['an XML element that is closed at once, no blank', '<token/>'],
    ['an HTML password field', '<input type="password" name="p" value="S">'],
    [
      'an HTML password field with blanks around the equal sign',
      '<input name=p type = "password">',
    ],
    [
      'an HTML password field in upper case',
      '<INPUT TYPE=password NAME=p VALUE=S>',
    ],
    [
      'an HTML password field in single quotes',
      "<input name='p' type='password'>",
    ],
  ])('1: %s: the text is not written', (_name, text) => {
    expect(describeBody(text)).toBe(placeholder(text));
    expect(describeBody({ detail: text })).toEqual({
      detail: placeholder(text),
    });
  });

  test.each(['x &#9999999; y', 'x &#x110000; y', 'x &#1114112; y {&#9999999;'])(
    '1b: a number that is no character does not stop the view: %s',
    (text) => {
      expect(() => describeBody(text)).not.toThrow();
      expect(describeBody(text)).toBe(text);
    }
  );

  test.each([
    [
      'an HTML page that quotes a word',
      '<html><body><p>The &quot;id&quot; field is required</p></body></html>',
    ],
    [
      'an HTML page with a quote and a brace apart',
      '<p>&quot;a&quot; and {b}</p>',
    ],
    ['a URL with an encoded brace', 'GET https://h/a%7Bb%7D?x=1 failed'],
    ['a URL with an encoded quote', 'GET https://h/a%22b?x=1 failed'],
    ['a text field', '<input type="text" name="user" value="x">'],
    ['a plural element', '<tokens><a>1</a></tokens>'],
    ['a closing tag only', 'x </password> y'],
    [
      'an element with a hyphen after the name',
      '<password-reset>x</password-reset>',
    ],
    ['an element whose name goes on', '<passwordless>x</passwordless>'],
    ['an element that starts like one', '<passwordless>yes</passwordless>'],
    ['a tag with a word', '<p>token</p>'],
    ['the word type and password apart', 'the type of the password is text'],
    ['an encoded brace and no quote', 'x %7B y'],
  ])('2: %s is written as any text is', (_name, text) => {
    expect(describeBody(text)).toBe(text);
  });
});

describe('the compound names of a secret, as keys, as the name of a pair and as members of a list', () => {
  const COMPOUND = [
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
  const VISIBLE = [
    'accessKeyId',
    'clientId',
    'tokenType',
    'nextPageToken',
    'pageToken',
    'sortKey',
    'isPasswordRequired',
    'passwordPolicy',
    'bypass',
    'compass',
    'passthrough',
    'otpLength',
    'pinned',
    'credentialsPolicy',
  ];
  const body = (value: unknown) => JSON.stringify(describeBody(value));

  test.each(COMPOUND)(
    '1: %s: the value is replaced as a key of a body, of a text and inside headers',
    (name) => {
      expect(body({ [name]: T })).not.toContain(T);
      expect(body(json({ [name]: T }))).not.toContain(T);
      expect(body({ headers: { [name]: T } })).not.toContain(T);
      expect(body({ a: { b: [{ [name]: [T] }] } })).not.toContain(T);
    }
  );

  test.each(COMPOUND)(
    '2: %s: the value beside it is replaced when it is the name of a pair, and the member after it in a list',
    (name) => {
      expect(body({ name, value: T })).not.toContain(T);
      expect(body(json({ key: name, val: T }))).not.toContain(T);
      expect(body([[name, T]])).not.toContain(T);
      expect(body(json([name, T, 'x']))).not.toContain(T);
      expect(body(`env ${json([{ name, value: T }])}`)).not.toContain(T);
    }
  );

  test('4: a log line with a password keeps the words after it', () => {
    expect(body(`ERROR: login failed password=${T} user=admin`)).toBe(
      json('ERROR: login failed password=<redacted> user=admin')
    );
  });

  test.each(VISIBLE)(
    '3: %s is no name of a secret: its value is written, as a key, as a pair and in a list',
    (name) => {
      expect(body({ [name]: T })).toContain(T);
      expect(body({ name, value: T })).toContain(T);
      expect(body([name, T])).toContain(T);
    }
  );
});

describe('an XML element with the name of a secret, in a text', () => {
  const text = (tag: string) => `<login><${tag}>${T}</${tag}></login>`;

  test.each([
    'password',
    'dbPassword',
    'DB_PASSWORD',
    'smtp.password',
    'webhookSecret',
    'client_secret',
    'ns:adminPwd',
    'passwd',
    'token',
    'accessToken',
    'apiKey',
    'credentials',
    'passphrase',
    'pass',
    'bindCredentials',
    'apiPassphrase',
    'api_key',
    'refresh_token',
    'refreshToken',
    'idToken',
    'id_token',
    'access_token',
    'credential',
    'db-password',
    'PASSWORD',
  ])('1: <%s> makes the text one that is not written', (tag) => {
    const written = String(describeBody(text(tag)));
    expect(written).not.toContain(T);
    expect(written).toMatch(/^<text of \d+ characters not written>$/);
  });

  test.each([
    [
      'an element with an attribute',
      `<login><token id="1">${T}</token></login>`,
    ],
    ['a self-closing element', `<login><secret value="${T}"/></login>`],
    ['an element with a slash after the name', `<secret/>${T}`],
    ['blanks after the angle bracket', `< password>${T}</password>`],
    ['a password field', `<input type="password" value="${T}">`],
    ['a password field without quotes', `<input type=password value=${T}>`],
    ['a password field with blanks', `<input type = 'password' value='${T}'>`],
    ['a password field in capitals', `<INPUT TYPE="PASSWORD" VALUE="${T}">`],
  ])('1b: %s makes the text one that is not written', (_name, value) => {
    const written = String(describeBody(value));
    expect(written).not.toContain(T);
    expect(written).toMatch(/^<text of \d+ characters not written>$/);
  });

  test.each([
    [
      'a field of a type that starts with the word',
      `<input type=passwordless value="${T}">`,
    ],
    [
      'an attribute that ends in type',
      `<input prototype="password" value="${T}">`,
    ],
    ['an element that starts with the word', `<tokenizer>${T}</tokenizer>`],
  ])('2b: %s is written as it is', (_name, value) => {
    expect(String(describeBody(value))).toBe(value);
  });

  test.each([
    'tokenizer',
    'passwordPolicy',
    'passwords',
    'secretary',
    'user',
    'passage',
    'passthrough',
    'bypass',
    'compass',
  ])('2: <%s> is no name of a secret: the text is written as it is', (tag) => {
    expect(String(describeBody(text(tag)))).toBe(text(tag));
  });
});
