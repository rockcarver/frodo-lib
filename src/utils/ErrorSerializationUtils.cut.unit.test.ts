/**
 * Run tests
 *
 *        npm run test:only ErrorSerializationUtils.cut
 *
 * A text of an error is cut to a fixed length. A value that stands where the cut
 * falls (it starts before the cut and ends after it, or the cut ends it) has to
 * be replaced as a whole and not shown in part: every shape of value, at every
 * offset around the cut, in the message of an error, in the combined message of a
 * `FrodoError`, and in a `Detail:` line of that combined message.
 */
import { FrodoError } from '../ops/FrodoError';
import { failure } from '../test/utils/SerializationForms';
import {
  describeBody,
  describeError,
  MAX_BODY_LENGTH,
} from './ErrorSerializationUtils';

/** A value that nothing else in these texts contains, not even a part of it. */
const SECRET = 'Q9Q9Q9Q9Q9Q9Q9Q9Q9Q9Q9';

/** The shapes of text that hold a value to replace; `S` stands for the value. */
const SHAPES: [string, string][] = [
  ['a bare value', 'password=S'],
  ['a quoted value', '{"password":"S"}'],
  ['a quoted value with spaces', '{ "password" : "S" }'],
  ['a single quoted value', "{'client_secret':'S'}"],
  ['a long token in a field', '{"access_token":"S"}'],
  ['the password of a URL', 'https://admin:S@host.example.com/path'],
  ['the password of a URL, no path', 'https://admin:S@host.example.com'],
  ['the password of a URL, no scheme', '//admin:S@host.example.com/path'],
  ['the password of a host, no scheme', 'admin:S@host.example.com'],
  ['a bearer value', 'Authorization: Bearer S'],
  ['a bearer value alone', 'Bearer S'],
  ['a cookie', 'Cookie: session=S'],
  ['a header', 'x-api-key: S'],
  ['a query value', 'https://host.example.com/x?access_token=S&a=b'],
  ['a query value in a path', '/x?access_token=S&a=b'],
  ['a token', 'eyJS.eyJS.S'],
  ['a token behind a word', 'kid-eyJhbGciOiJub25lIn0.eyJS.S'],
  [
    'a private key',
    '-----BEGIN PRIVATE KEY-----\nS\nS\n-----END PRIVATE KEY-----',
  ],
  ['a private key that does not end', '-----BEGIN PRIVATE KEY-----\nS\nS'],
];

/** A text that has `shape` with the value starting `offset` characters after the cut. */
function placed(shape: string, offset: number): string {
  const at = shape.indexOf('S');
  const value = shape.replace(/S/g, SECRET);
  // the value starts at `MAX_BODY_LENGTH + offset`; filler of short words before it
  const start = MAX_BODY_LENGTH + offset - at;
  const filler = `${'ab '.repeat(Math.ceil(Math.max(start, 1) / 3))}`.slice(
    0,
    Math.max(start - 1, 0)
  );
  return `${filler} ${value} ${'zy '.repeat(600)}`;
}

/** The offsets around the cut, from before the value to after it. */
function offsets(shape: string): number[] {
  const length = shape.replace(/S/g, SECRET).length;
  const list: number[] = [];
  for (let offset = -length - 3; offset <= 3; offset++) list.push(offset);
  return list;
}

function expectHidden(text: string, where: string) {
  if (text.includes('Q9')) {
    throw new Error(
      `${where}: a part of the value is written:\n${text.slice(-200)}`
    );
  }
}

describe('a value at the cut of a text is replaced as a whole, or not shown', () => {
  test.each(SHAPES)(
    '1: %s: in the message of an error, at every offset',
    (_name, shape) => {
      for (const offset of offsets(shape)) {
        const view = describeError(new Error(placed(shape, offset))) as {
          message: string;
        };
        expectHidden(view.message, `offset ${offset}`);
        expect(view.message.length).toBeLessThan(MAX_BODY_LENGTH + 60);
      }
    }
  );

  test.each(SHAPES)(
    '2: %s: in a FrodoError, in the message and in the combined message, at every offset',
    (_name, shape) => {
      for (const offset of offsets(shape)) {
        const view = JSON.stringify(new FrodoError(placed(shape, offset)));
        expectHidden(view, `offset ${offset}`);
      }
    }
  );

  test.each(SHAPES)(
    '3: %s: in the body of an answer that is text, at every offset',
    (_name, shape) => {
      for (const offset of offsets(shape)) {
        const written = describeBody(placed(shape, offset)) as string;
        expectHidden(written, `offset ${offset}`);
      }
    }
  );

  test('4: a value in a Detail line of the combined message, at every offset', () => {
    const detail = (pad: number) =>
      new FrodoError(
        'x',
        failure({
          responseData: { detail: { pad: 'x'.repeat(pad), password: SECRET } },
        })
      );
    // where the value stands in the combined message when there is no padding
    const base = detail(0).getCombinedMessage().indexOf(SECRET);
    expect(base).toBeGreaterThan(0);
    for (let offset = -SECRET.length - 40; offset <= 3; offset++) {
      const pad = MAX_BODY_LENGTH + offset - base;
      if (pad < 0) continue;
      const view = JSON.stringify(detail(pad));
      expectHidden(view, `offset ${offset}`);
    }
  });

  test('5: a value that is not cut is replaced as before, and the note counts the text as it was', () => {
    const text = `${'ab '.repeat(2000)} password=${SECRET} ${'zy '.repeat(600)}`;
    const view = describeError(new Error(text)) as { message: string };
    expect(view.message).not.toContain('Q9');
    expect(view.message.endsWith(`... (${text.length} characters)`)).toBe(true);
  });

  test.each([
    [
      'the password of the user info',
      (n: number) => `https://${'u'.repeat(n)}:${SECRET}@host.example.com/path`,
    ],
    [
      'the password of the user info, without a scheme',
      (n: number) => `//${'u'.repeat(n)}:${SECRET}@host.example.com/path`,
    ],
    [
      'a value of the query',
      (n: number) =>
        `https://host.example.com/${'p'.repeat(n)}?access_token=${SECRET}&a=b`,
    ],
    [
      'a value of the fragment',
      (n: number) =>
        `https://host.example.com/${'p'.repeat(n)}#access_token=${SECRET}`,
    ],
    [
      'a value of the query of a relative URL',
      (n: number) => `/${'p'.repeat(n)}?access_token=${SECRET}&a=b`,
    ],
  ])(
    '6: %s: in the URL of the request, at every offset around the cut',
    (_name, make) => {
      for (let n = MAX_BODY_LENGTH - 80; n <= MAX_BODY_LENGTH + 40; n++) {
        const view = describeError(failure({ url: make(n) })) as {
          url: string;
        };
        expectHidden(view.url, `length ${n}`);
        expect(view.url.length).toBeLessThan(MAX_BODY_LENGTH + 60);
      }
    }
  );

  test.each([
    [
      'Location',
      (n: number) =>
        `https://host.example.com/${'p'.repeat(n)}?access_token=${SECRET}&a=b`,
    ],
    [
      'Location',
      (n: number) => `https://${'u'.repeat(n)}:${SECRET}@host.example.com/x`,
    ],
    [
      'Content-Location',
      (n: number) =>
        `https://host.example.com/${'p'.repeat(n)}#access_token=${SECRET}`,
    ],
    [
      'Link',
      (n: number) =>
        `<https://host.example.com/${'p'.repeat(n)}?access_token=${SECRET}>; rel="next"`,
    ],
    [
      'Link',
      (n: number) =>
        `<https://${'u'.repeat(n)}:${SECRET}@host.example.com/x>; rel="next"`,
    ],
    [
      'Refresh',
      (n: number) =>
        `0; url=https://host.example.com/${'p'.repeat(n)}?access_token=${SECRET}`,
    ],
    [
      'Refresh',
      (n: number) =>
        `0; url=https://${'u'.repeat(n)}:${SECRET}@host.example.com/x`,
    ],
  ])(
    '7: %s: a header of an answer, at every offset around the cut',
    (header, make) => {
      for (let n = MAX_BODY_LENGTH - 80; n <= MAX_BODY_LENGTH + 40; n++) {
        const view = describeError(
          failure({ responseHeaders: { [header]: make(n) } })
        ) as { response: { headers: Record<string, string> } };
        expectHidden(view.response.headers[header], `length ${n}`);
      }
    }
  );
});
