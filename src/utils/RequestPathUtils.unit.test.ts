/**
 * Run tests
 *
 *        npm run test:only -- src/utils/RequestPathUtils
 *
 * `isRequestSegment` is the test of an id that a push reads from the content of a file and puts into the path of a request:
 * the value is one segment of that path, and what a request layer or a server could read as more than one segment, as a
 * query, as a fragment, as an escape, as a path that goes up, or as another id once a blank at its end is cut off is refused. It is not the test of a file name (`isOneSafeSegment`, which refuses `C:`
 * because the library removes it from a path, and lets `?`, `#` and `%` through): the differences are shown row by row.
 *
 * Hermetic: no file is read or written, no network.
 */
import { importSpecifiersOf } from '../test/exportFileFormat/importsOf';
import { isOneSafeSegment } from './FileSetPathUtils';
import { isRequestSegment } from './RequestPathUtils';

describe('isRequestSegment', () => {
  it.each([
    ['x'],
    ['zion-a'],
    ['fr'],
    ['en-US'],
    ['a b'],
    ['a.b'],
    ['..foo'],
    ['foo..'],
    ['a..b'],
    ['...'],
    ['2.2_Agent'],
    ['é'],
    ['€'],
    // a surrogate pair is text, a lone surrogate is not (below)
    ['😀'],
    // a colon is an ordinary character of an id: the removal of `C:` is a rule for the paths of a file system
    ['a:b'],
    ['ABC:x'],
    ['C:'],
    ['x.C:'],
    ['Login:SSO'],
    ['a@b'],
    ['a+b'],
    ['a,b;c=d'],
    ['a$b'],
    ['a{b}'],
    // characters that a request layer escapes, which still make one segment
    ['a"b'],
    ['a<b>'],
    ['a|b'],
    ['a^b'],
    ['a[b]'],
    // zero-width and bidirectional controls are not control characters of the C0 and C1 blocks
    ['a\u200bb'],
    ['a\u202eb'],
    // format characters are accepted, in every position: they travel percent-encoded, so they cannot retarget a request
    ['\u200ba'],
    ['a\u200b'],
    ['\ufeffa'],
    ['a\ufeff'],
    ['a\u180eb'],
    ['a\u202e'],
    // a blank inside a name is part of the name: it is escaped in the request and nothing is cut off
    ['My Schedule'],
    ['a b c'],
    ['a\u00a0b'],
    ['a\u3000b'],
    // a `;` and what follows it are part of the name, unless the name before the first `;` is empty, one dot or two (below)
    ['a;b'],
    ['a;..'],
    ['x;.'],
    ['a;'],
    ['a;;'],
    ['...;'],
    ['a.;'],
    ['.a;b'],
  ])('%j is one segment of a request path', (candidate) => {
    expect(isRequestSegment(candidate)).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['.', 'the current folder'],
    ['..', 'the parent folder'],
    ['a/b', 'a slash'],
    ['/a', 'a leading slash'],
    ['a/', 'a trailing slash'],
    ['../managed/alpha_user', 'a path to another object'],
    ['x/..', 'a path that goes up'],
    ['a\\b', 'a backslash, which a request layer may read as a slash'],
    ['..\\x', 'a backslash path'],
    ['x?_action=y', 'a query'],
    ['a?b', 'a question mark'],
    ['x#f', 'a fragment'],
    ['a#b', 'a number sign'],
    ['a%2fb', 'an escape of a slash'],
    ['a%2Fb', 'an escape of a slash, in capitals'],
    ['100%', 'a percent sign'],
    ['%2e%2e', 'an escape of the parent folder'],
    ['a\u0000b', 'a null character'],
    ['a\tb', 'a tab'],
    ['a\nb', 'a line feed'],
    ['a\rb', 'a carriage return'],
    ['a\u001fb', 'the last control character of the C0 block'],
    ['a\u007fb', 'DEL'],
    ['a\u0080b', 'the first control character of the C1 block'],
    ['a\u0085b', 'a control character of the C1 block'],
    ['a\u009fb', 'the last control character of the C1 block'],
    [' ', 'a space'],
    ['. ', 'the current folder and a space, which the URL parser cuts off'],
    ['.. ', 'the parent folder and a space, which the URL parser cuts off'],
    ['..  ', 'the parent folder and two spaces'],
    ['a ', 'a space at the end'],
    [' a', 'a space at the start'],
    [' a ', 'a space at both ends'],
    ['..;', 'the parent folder with a path parameter'],
    ['.;', 'the current folder with a path parameter'],
    ['..;x=y', 'the parent folder with a path parameter that has a value'],
    ['.;x', 'the current folder with a path parameter that has a name'],
    [';', 'a path parameter and no name before it'],
    [';..', 'a path parameter that is the parent folder and no name before it'],
    [';x', 'a path parameter that has a name and no name before it'],
    [';x=y', 'a path parameter that has a value and no name before it'],
    [';;', 'two empty path parameters'],
    [
      '..;..',
      'the parent folder with a path parameter that is the parent folder',
    ],
    ['\ud800', 'a lone high surrogate'],
    ['\udc00', 'a lone low surrogate'],
    ['x\ud800', 'a lone high surrogate at the end'],
    ['\udbffx', 'a lone high surrogate at the start'],
    ['a\udc00b', 'a lone low surrogate in the middle'],
  ])('%j is not (%s)', (candidate) => {
    expect(isRequestSegment(candidate)).toBe(false);
  });

  // a blank at either end: the WHATWG URL parser removes the spaces and the control characters at the end of a URL, so `uilocale/.. `
  // is the request for `uilocale/..`; the other blanks are refused for the same reason (a server or a proxy may cut them off too)
  const BLANKS: [string, string][] = [
    ['\u0020', 'a space'],
    ['\u00a0', 'a no-break space'],
    ['\u1680', 'an Ogham space mark'],
    ...Array.from({ length: 11 }, (_, index): [string, string] => [
      String.fromCharCode(0x2000 + index),
      `a space of U+${(0x2000 + index).toString(16)}`,
    ]),
    ['\u2028', 'a line separator'],
    ['\u2029', 'a paragraph separator'],
    ['\u202f', 'a narrow no-break space'],
    ['\u205f', 'a medium mathematical space'],
    ['\u3000', 'an ideographic space'],
  ];

  it.each(BLANKS)(
    'refuses %j (%s) at the end, at the start and at both ends, and takes it inside',
    (blank) => {
      expect(isRequestSegment(`a${blank}`)).toBe(false);
      expect(isRequestSegment(`${blank}a`)).toBe(false);
      expect(isRequestSegment(`${blank}a${blank}`)).toBe(false);
      expect(isRequestSegment(`..${blank}`)).toBe(false);
      expect(isRequestSegment(`${blank}`)).toBe(false);
      expect(isRequestSegment(`a${blank}b`)).toBe(true);
    }
  );

  it('refuses a blank at either end of a value of any length, not only of a short one', () => {
    for (const blank of [' ', '\u00a0', '\u2003', '\u3000']) {
      for (const name of ['en-US', 'My Schedule', 'a'.repeat(300)]) {
        expect(isRequestSegment(`${blank}${name}`)).toBe(false);
        expect(isRequestSegment(`${name}${blank}`)).toBe(false);
        expect(isRequestSegment(`${blank}${name}${blank}`)).toBe(false);
        expect(isRequestSegment(`${name}${blank}${name}`)).toBe(true);
      }
    }
  });

  it('refuses a control character at either end too, as the URL parser removes them', () => {
    for (let code = 0; code <= 0x20; code++) {
      const unit = String.fromCharCode(code);
      expect(isRequestSegment(`a${unit}`)).toBe(false);
      expect(isRequestSegment(`${unit}a`)).toBe(false);
    }
  });

  it('takes a `;` as part of the name, except when the part before the first `;` is empty, one dot or two, whatever follows', () => {
    // a server may cut the parameters off a segment before it reads the dots, and what is left is no name, or a dot
    for (const before of ['', '.', '..']) {
      for (const rest of ['', 'x', 'x=y', '..', ';', '/']) {
        expect(isRequestSegment(`${before};${rest}`)).toBe(false);
      }
    }
    // the part before the first `;` is a name: what follows is a parameter of that name
    for (const name of ['a', '...', '.a', 'a.', 'a..', 'My Schedule']) {
      for (const rest of ['', 'x', '..', ';', '.']) {
        expect(isRequestSegment(`${name};${rest}`)).toBe(true);
      }
    }
  });

  it('refuses what is not a text', () => {
    for (const value of [undefined, null, 7, true, {}, [], ['a']]) {
      expect(isRequestSegment(value as never)).toBe(false);
    }
  });

  describe('against isOneSafeSegment, the test of a name of a file', () => {
    // the two differ on purpose: the file test has the rules of a path of a file system, this one those of an id in a request
    it.each([
      ['ABC:x', true, false],
      ['C:', true, false],
      ['a ', false, true],
      ['.. ', false, true],
      [' a', false, true],
      ['a?b', false, true],
      ['x?_action=y', false, true],
      ['a#b', false, true],
      ['a%2fb', false, true],
      ['100%', false, true],
      ['\ud800', false, true],
      ['x\udc00', false, true],
    ])(
      '%j: a request segment is %s, a safe segment of a path is %s',
      (candidate, isRequest, isSafe) => {
        expect(isRequestSegment(candidate)).toBe(isRequest);
        expect(isOneSafeSegment(candidate)).toBe(isSafe);
      }
    );

    it.each([
      ['x'],
      ['a b'],
      ['..foo'],
      ['a..b'],
      ['Login:SSO'],
      ['é'],
      [''],
      ['.'],
      ['..'],
      ['a/b'],
      ['a\\b'],
      ['a\tb'],
      ['a\u007fb'],
      ['a\u0085b'],
    ])('%j: the two agree', (candidate) => {
      expect(isRequestSegment(candidate)).toBe(isOneSafeSegment(candidate));
    });
  });

  describe('what it accepts reaches a request as one segment', () => {
    // every code unit alone, between two letters, at the start, at the end, and around `.` and `..`, as a text that a file can
    // hold: a value that passes must be encodable, and the URL that is built from it, as the request layer builds it with the
    // WHATWG parser, must have exactly the path that is expected: the folder, then the value, with no query and no fragment
    const units = Array.from({ length: 0x10000 }, (_, code) =>
      String.fromCharCode(code)
    );
    const forms = (unit: string): string[] => [
      unit,
      `a${unit}b`,
      `${unit}a`,
      `a${unit}`,
      `.${unit}`,
      `..${unit}`,
      `${unit}.`,
      `${unit}..`,
    ];
    const accepted = units.flatMap(forms).filter(isRequestSegment);
    const FOLDER = '/openidm/config/uilocale/';

    it('accepts most characters, so that the sweep is not empty', () => {
      expect(accepted.length).toBeGreaterThan(200000);
    });

    it('never makes encodeURIComponent throw, which a lone surrogate does', () => {
      for (const value of accepted) {
        expect(() => encodeURIComponent(value)).not.toThrow();
      }
      // the rule that the sweep checks: this is what a lone surrogate does to an encoder
      expect(() => encodeURIComponent('\ud800')).toThrow();
    });

    it('builds a URL whose path is the folder and the value, whatever the value ends in', () => {
      const retargeted: string[] = [];
      for (const value of accepted) {
        const url = new URL(
          `https://openam-matrix.example.com${FOLDER}${value}`
        );
        // the path is the folder and one segment that the value escapes to: the segment decodes to the value, so nothing was
        // cut off the end of it and nothing in it was read as a dot, a slash, a query or a fragment
        const segments = url.pathname.split('/');
        if (
          url.pathname.length <= FOLDER.length ||
          !url.pathname.startsWith(FOLDER) ||
          segments.length !== 5 ||
          decodeURIComponent(segments[4]) !== value ||
          url.search !== '' ||
          url.hash !== ''
        ) {
          retargeted.push(JSON.stringify(value));
        }
      }
      expect(retargeted).toEqual([]);
    });

    it('is the check that sees a value that is cut off the end of the URL: a space at the end is the value without it', () => {
      // what the sweep is for: these are values that the check refuses, because the URL for them is the URL for another path
      for (const [value, path] of [
        ['.. ', '/openidm/config/'],
        ['. ', FOLDER],
        ['fr ', `${FOLDER}fr`],
      ]) {
        expect(isRequestSegment(value)).toBe(false);
        expect(
          new URL(`https://openam-matrix.example.com${FOLDER}${value}`).pathname
        ).toBe(path);
      }
    });
  });
});

describe('the module of the segment test', () => {
  it('is pure: it imports nothing', () => {
    expect(importSpecifiersOf('src/utils/RequestPathUtils.ts')).toEqual([]);
  });
});
