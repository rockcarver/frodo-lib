/**
 * Run tests
 *
 *        npm run test:only -- src/utils/RequestPathUtils
 *
 * `isRequestSegment` is the test of an id that a push reads from the content of a file and puts into the path of a request:
 * the value is one segment of that path, and what a request layer or a server could read as more than one segment, as a
 * query, as a fragment or as an escape is refused. It is not the test of a file name (`isOneSafeSegment`, which refuses `C:`
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
    ['a​b'],
    ['a‮b'],
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
    ['\ud800', 'a lone high surrogate'],
    ['\udc00', 'a lone low surrogate'],
    ['x\ud800', 'a lone high surrogate at the end'],
    ['\udbffx', 'a lone high surrogate at the start'],
    ['a\udc00b', 'a lone low surrogate in the middle'],
  ])('%j is not (%s)', (candidate) => {
    expect(isRequestSegment(candidate)).toBe(false);
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
    // every code unit alone and between two letters, as a text that a file can hold: a value that passes must be encodable and
    // must stay one segment, without a query or a fragment, when it is put after a folder of a URL
    const units = Array.from({ length: 0x10000 }, (_, code) =>
      String.fromCharCode(code)
    );
    const accepted = units
      .flatMap((unit) => [unit, `a${unit}b`])
      .filter(isRequestSegment);

    it('accepts most characters, so that the sweep is not empty', () => {
      expect(accepted.length).toBeGreaterThan(100000);
    });

    it('never makes encodeURIComponent throw, which a lone surrogate does', () => {
      for (const value of accepted) {
        expect(() => encodeURIComponent(value)).not.toThrow();
      }
      // the rule that the sweep checks: this is what a lone surrogate does to an encoder
      expect(() => encodeURIComponent('\ud800')).toThrow();
    });

    it('keeps one segment, with no query and no fragment, in the path of a URL', () => {
      const broken: string[] = [];
      for (const value of accepted) {
        const url = new URL(`https://openam-matrix.example.com/c/${value}`);
        const segments = url.pathname.split('/');
        if (
          segments.length !== 3 ||
          segments[1] !== 'c' ||
          url.search !== '' ||
          url.hash !== ''
        ) {
          broken.push(JSON.stringify(value));
        }
      }
      expect(broken).toEqual([]);
    });
  });
});

describe('the module of the segment test', () => {
  it('is pure: it imports nothing', () => {
    expect(importSpecifiersOf('src/utils/RequestPathUtils.ts')).toEqual([]);
  });
});
