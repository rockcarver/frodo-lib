import { removeBlankMarkupLines } from './Saml2Ops';

/**
 * `removeBlankMarkupLines` against a second, independent reading of the rule,
 * on 2,000 documents made by a small generator with fixed seeds (the same
 * documents on every run).
 *
 * The oracle shares no code with the function: it follows CDATA sections and
 * comments one character at a time over the whole text (the function does it
 * line by line), looks for the nearest line that is not blank by walking the
 * lines in both directions (the function groups runs), and finds a `Signature`
 * element without a regular expression.
 * Pure unit test: no recordings, no network.
 */

const OUTSIDE = 0;
const IN_CDATA = 1;
const IN_COMMENT = 2;

const isSpaceChar = (ch: string) => ch === ' ' || ch === '\t' || ch === '\r';
const isBlank = (line: string) => [...line].every(isSpaceChar);

/** where each line starts: outside, in a CDATA section or in a comment */
function regionsAtLineStarts(text: string): number[] {
  const starts = [OUTSIDE];
  let state = OUTSIDE;
  let i = 0;
  while (i < text.length) {
    if (state === OUTSIDE && text.startsWith('<![CDATA[', i)) {
      state = IN_CDATA;
      i += 9;
      continue;
    }
    if (state === OUTSIDE && text.startsWith('<!--', i)) {
      state = IN_COMMENT;
      i += 4;
      continue;
    }
    if (state === IN_CDATA && text.startsWith(']]>', i)) {
      state = OUTSIDE;
      i += 3;
      continue;
    }
    if (state === IN_COMMENT && text.startsWith('-->', i)) {
      state = OUTSIDE;
      i += 3;
      continue;
    }
    if (text[i] === '\n') starts.push(state);
    i++;
  }
  return starts;
}

/** a `Signature` start tag with any prefix or none, found without a regular expression */
function hasSignatureElement(text: string): boolean {
  const notInName = new Set([
    ' ',
    '\t',
    '\r',
    '\n',
    '<',
    '>',
    ':',
    '/',
    '=',
    '"',
    "'",
  ]);
  const endsName = new Set([' ', '\t', '\r', '\n', '>', '/']);
  const named = (at: number) =>
    text.startsWith('Signature', at) && endsName.has(text[at + 9]);
  for (let p = text.indexOf('<'); p !== -1; p = text.indexOf('<', p + 1)) {
    if (named(p + 1)) return true;
    let q = p + 1;
    while (q < text.length && !notInName.has(text[q])) q++;
    if (q > p + 1 && text[q] === ':' && named(q + 1)) return true;
  }
  return false;
}

function oracle(text: string): string {
  if (text.includes('xml:space') || hasSignatureElement(text)) return text;
  const lines = text.split('\n');
  const regions = regionsAtLineStarts(text);
  const out: string[] = [];
  lines.forEach((line, k) => {
    if (!isBlank(line)) {
      out.push(line);
      return;
    }
    let before = k - 1;
    while (before >= 0 && isBlank(lines[before])) before--;
    let after = k + 1;
    while (after < lines.length && isBlank(lines[after])) after++;
    if (before < 0 || after >= lines.length || regions[k] !== OUTSIDE) {
      out.push(line);
      return;
    }
    const last = [...lines[before]].reverse().find((ch) => !isSpaceChar(ch));
    const first = [...lines[after]].find((ch) => !isSpaceChar(ch));
    if (!(last === '>' && first === '<')) out.push(line);
  });
  return out.join('\n');
}

/** a small seeded generator (mulberry32): the same numbers for the same seed */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MARKUP = [
  '<a>',
  '    <b x="1">',
  '</b>',
  '<c/>',
  '<d>text</d>',
  '        <ds:KeyInfo>',
  '                <ds:X509Data>',
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- note -->',
];
const TEXT = [
  'some text',
  'a > b >',
  'x>',
  '<y',
  'y>',
  'ends with a tag >',
  '>',
];
const CERTIFICATE = [
  'MIIC8DCCAdigAwIBAgIQZzae6CymcZhG5gxIgB7mMDANBgkqhkiG9w0BAQsF',
];
const REGIONS = [
  '<![CDATA[',
  'foo]]>',
  '<![CDATA[x]]>',
  '<a><![CDATA[x>',
  ']]>',
  '<!--',
  '-->',
  '<b/><!-- x>',
  'y -->',
  '<!-- a --><![CDATA[',
  ']]><!--',
  '<!-- <![CDATA[ -->',
  '<![CDATA[ <!-- ]]>',
];
const UNICODE = ['\u00a0', '\ufeff', '\f', '\v', '\u3000'];
const SIGNATURES = [
  '<ds:Signature>',
  '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">',
  '<é:Signature/>',
  '<a:Signature\tId="s">',
];
const NOT_SIGNATURES = [
  '<SignatureValue>x</SignatureValue>',
  '<ds:SignatureMethod Algorithm="x"/>',
  '</ds:Signature>',
  'Signature',
];

function makeDocument(seed: number): string {
  const next = random(seed);
  const pick = <T>(list: T[]): T => list[Math.floor(next() * list.length)];
  const blank = () => {
    const width = Math.floor(next() * 17);
    let line = '';
    for (let i = 0; i < width; i++) line += pick([' ', ' ', ' ', '\t']);
    return next() < 0.15 ? line + '\r' : line;
  };
  const count = 1 + Math.floor(next() * 40);
  const lines: string[] = [];
  const withSignature = next() < 0.05;
  const withXmlSpace = next() < 0.03;
  for (let i = 0; i < count; i++) {
    const r = next();
    if (r < 0.3) lines.push(blank());
    else if (r < 0.55) lines.push(pick(MARKUP));
    else if (r < 0.65) lines.push(pick(TEXT));
    else if (r < 0.7) lines.push(pick(CERTIFICATE));
    else if (r < 0.82) lines.push(pick(REGIONS));
    else if (r < 0.85) lines.push(pick(NOT_SIGNATURES));
    else if (r < 0.9) lines.push(`${blank()}${pick(UNICODE)}${blank()}`);
    else if (r < 0.94) lines.push(`${pick(MARKUP)}${pick(UNICODE)}`);
    else if (r < 0.97) lines.push(`${pick(UNICODE)}${pick(MARKUP)}`);
    else lines.push(`${blank()}${pick(MARKUP)}${blank()}`);
  }
  if (withSignature)
    lines.splice(Math.floor(next() * lines.length), 0, pick(SIGNATURES));
  if (withXmlSpace) {
    lines.splice(
      Math.floor(next() * lines.length),
      0,
      '<a xml:space="preserve">'
    );
  }
  const eol = next() < 0.2 ? '\r\n' : '\n';
  const body = lines.join(eol);
  return next() < 0.5 ? body + eol : body;
}

/** is `part` what is left of `whole` when some blank lines are taken out? */
function onlyBlankLinesRemoved(whole: string[], part: string[]): boolean {
  let p = 0;
  for (const line of whole) {
    if (p < part.length && part[p] === line) p++;
    else if (!isBlank(line)) return false;
  }
  return p === part.length;
}

describe('removeBlankMarkupLines against an independent reading of the rule', () => {
  const seeds = Array.from({ length: 2000 }, (_unused, i) => i + 1);

  test('the output is what the oracle says, for 2,000 seeded documents', () => {
    let changed = 0;
    let inRegion = 0;
    let guarded = 0;
    for (const seed of seeds) {
      const xml = makeDocument(seed);
      const actual = removeBlankMarkupLines(xml);
      const expected = oracle(xml);
      if (actual !== expected) {
        // name the seed and the document in the failure
        expect({ seed, xml, output: actual }).toEqual({
          seed,
          xml,
          output: expected,
        });
      }
      if (actual !== xml) changed++;
      if (/<!--|<!\[CDATA\[/.test(xml)) inRegion++;
      if (xml.includes('xml:space') || hasSignatureElement(xml)) guarded++;
    }
    // the generator reaches every branch
    expect(changed).toBeGreaterThan(500);
    expect(inRegion).toBeGreaterThan(500);
    expect(guarded).toBeGreaterThan(50);
  });

  test('a second run changes nothing and nothing but blank lines is removed', () => {
    for (const seed of seeds) {
      const xml = makeDocument(seed);
      const once = removeBlankMarkupLines(xml);
      expect({ seed, again: removeBlankMarkupLines(once) }).toEqual({
        seed,
        again: once,
      });
      expect({
        seed,
        ok: onlyBlankLinesRemoved(xml.split('\n'), once.split('\n')),
      }).toEqual({ seed, ok: true });
    }
  });

  test('the generator makes the same documents on every run', () => {
    expect(makeDocument(1)).toBe(makeDocument(1));
    expect(makeDocument(1)).not.toBe(makeDocument(2));
  });
});
