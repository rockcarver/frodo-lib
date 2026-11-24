import {
  FAKE_CERTIFICATE_LINES,
  hostedSpMetadata,
  remoteIdpMetadata,
} from '../test/utils/RemoteSamlMetadata';
import { removeBlankMarkupLines } from './Saml2Ops';

/**
 * The server puts whitespace-only lines between two lines of markup into the
 * metadata of a remote SAML provider (inside `ds:KeyInfo` and
 * `EncryptionMethod`) and adds more with every save. The export removes them:
 * a blank line goes when the nearest line before it that is not blank ends
 * with `>` and the nearest line after it that is not blank starts with `<`.
 * A document with a `Signature` element is left alone.
 * Pure unit test: no recordings, no network.
 */

/** the whitespace-only lines of a text, not counting the empty rest after the last newline */
const blankLinesOf = (xml: string) =>
  xml
    .replace(/\n$/, '')
    .split('\n')
    .filter((line) => /^[ \t\r]*$/.test(line)).length;

describe('removeBlankMarkupLines', () => {
  describe('the shapes the server produces', () => {
    const clean = remoteIdpMetadata({ keyInfoBlankLines: [0, 0] });

    test.each([
      ['4 lines per ds:KeyInfo (a provider saved once more)', [4, 4], 8],
      ['3 lines per ds:KeyInfo (a provider just created)', [3, 3], 6],
      ['no lines at all', [0, 0], 0],
      ['a different number in each ds:KeyInfo', [1, 3], 4],
      ['two lines in one ds:KeyInfo only', [0, 2], 2],
    ])('%s', (_name, keyInfoBlankLines, expectedBlank) => {
      const xml = remoteIdpMetadata({
        keyInfoBlankLines: keyInfoBlankLines as number[],
      });
      expect(blankLinesOf(xml)).toBe(expectedBlank);
      expect(removeBlankMarkupLines(xml)).toBe(clean);
    });

    test('removes the lines before ds:DigestMethod and xenc:KeySize of an EncryptionMethod', () => {
      const xml = remoteIdpMetadata({
        keyInfoBlankLines: [4],
        encryptionBlankLines: 2,
      });
      // 4 in the signing key, 2 before each of the two elements
      expect(blankLinesOf(xml)).toBe(8);
      expect(removeBlankMarkupLines(xml)).toBe(
        remoteIdpMetadata({ keyInfoBlankLines: [0], encryptionBlankLines: 0 })
      );
    });

    test('removes every line of a run of blank lines', () => {
      const xml = remoteIdpMetadata({ keyInfoBlankLines: [25] });
      expect(blankLinesOf(xml)).toBe(25);
      expect(removeBlankMarkupLines(xml)).toBe(
        remoteIdpMetadata({ keyInfoBlankLines: [0] })
      );
    });

    test('removes a line that holds only tabs and one that is empty', () => {
      const xml = ['<a>', '\t\t\t', '', '  \t ', '<b/>', '</a>'].join('\n');
      expect(removeBlankMarkupLines(xml)).toBe('<a>\n<b/>\n</a>');
    });

    test('removes the blank lines after a markup line that ends in white space', () => {
      expect(removeBlankMarkupLines('<a>  \t\n \n<b/>')).toBe('<a>  \t\n<b/>');
    });

    test('removes the blank lines before a markup line that starts with white space', () => {
      expect(removeBlankMarkupLines('<a>\n\n    <b/>')).toBe('<a>\n    <b/>');
    });

    test('is the same text with the lines of an export-import-export cycle', () => {
      // every save of the server adds one line per ds:KeyInfo: the export of
      // each state is the same text
      const exports = [0, 1, 2, 5].map((added) =>
        removeBlankMarkupLines(
          remoteIdpMetadata({ keyInfoBlankLines: [added, added] })
        )
      );
      expect(new Set(exports).size).toBe(1);
    });
  });

  describe('what stays', () => {
    test('a document without such lines comes back byte-identical (hosted provider)', () => {
      const xml = hostedSpMetadata();
      expect(blankLinesOf(xml)).toBe(0);
      expect(removeBlankMarkupLines(xml)).toBe(xml);
    });

    test('the lines of the certificates are not changed', () => {
      const xml = remoteIdpMetadata({
        keyInfoBlankLines: [4, 4],
        encryptionBlankLines: 3,
      });
      const lines = removeBlankMarkupLines(xml).split('\n');
      for (const certificateLine of FAKE_CERTIFICATE_LINES) {
        // three key descriptors, each with the certificate
        expect(lines.filter((line) => line === certificateLine)).toHaveLength(
          3
        );
      }
    });

    test('no line is changed, only removed', () => {
      const xml = remoteIdpMetadata({
        keyInfoBlankLines: [4, 3],
        encryptionBlankLines: 1,
      });
      const before = xml.split('\n');
      const after = removeBlankMarkupLines(xml).split('\n');
      const nonBlank = before.filter((line) => line.trim() !== '');
      // the same lines in the same order, apart from the whitespace-only ones
      expect(after.filter((line) => line.trim() !== '')).toEqual(nonBlank);
      expect(after.length).toBe(nonBlank.length + 1); // + the entry after the last newline
    });

    test('a blank line at the start of the document stays', () => {
      expect(removeBlankMarkupLines('\n  \n<a>\n</a>')).toBe('\n  \n<a>\n</a>');
    });

    test('blank lines at the end of the document stay', () => {
      expect(removeBlankMarkupLines('<a>\n</a>\n\n  \n')).toBe(
        '<a>\n</a>\n\n  \n'
      );
    });

    test('a blank line between a text line and a markup line stays', () => {
      expect(removeBlankMarkupLines('<a>\nsome text\n\n<b/>\n</a>')).toBe(
        '<a>\nsome text\n\n<b/>\n</a>'
      );
    });

    test('a blank line between a markup line and a text line stays', () => {
      expect(removeBlankMarkupLines('<a>\n\nsome text\n</a>')).toBe(
        '<a>\n\nsome text\n</a>'
      );
    });

    test('a blank line inside a text stays', () => {
      expect(
        removeBlankMarkupLines('<a>\nfirst paragraph\n\nsecond paragraph\n</a>')
      ).toBe('<a>\nfirst paragraph\n\nsecond paragraph\n</a>');
    });

    test('a blank line inside a CDATA section stays', () => {
      const xml = '<a>\n<![CDATA[first\n\nsecond]]>\n</a>';
      expect(removeBlankMarkupLines(xml)).toBe(xml);
    });

    test('a blank line between two lines of text that look like markup at the edges only stays', () => {
      // the line before ends in text, the line after starts with text
      const xml = '<a>x\n\ny</a>';
      expect(removeBlankMarkupLines(xml)).toBe(xml);
    });
  });

  describe('line endings', () => {
    test('\\r\\n input keeps \\r\\n and loses the blank lines', () => {
      const xml = remoteIdpMetadata({
        keyInfoBlankLines: [4, 4],
        eol: '\r\n',
      });
      const expected = remoteIdpMetadata({
        keyInfoBlankLines: [0, 0],
        eol: '\r\n',
      });
      const result = removeBlankMarkupLines(xml);
      expect(result).toBe(expected);
      expect(result.split('\r\n').length).toBe(expected.split('\r\n').length);
      // no bare \n was introduced
      expect(result.replace(/\r\n/g, '')).not.toMatch(/\n/);
    });

    test('a blank line that holds only a carriage return is removed', () => {
      expect(removeBlankMarkupLines('<a>\r\n\r\n<b/>\r\n')).toBe(
        '<a>\r\n<b/>\r\n'
      );
    });

    test('a document with \\r\\n and nothing to remove comes back byte-identical', () => {
      const xml = '<a>\r\n    <b/>\r\n</a>\r\n';
      expect(removeBlankMarkupLines(xml)).toBe(xml);
    });
  });

  describe('signed metadata', () => {
    test('a document with a ds:Signature element comes back byte-identical, blank lines included', () => {
      const xml = remoteIdpMetadata({
        keyInfoBlankLines: [4, 4],
        signed: true,
      });
      expect(blankLinesOf(xml)).toBe(8);
      expect(removeBlankMarkupLines(xml)).toBe(xml);
    });

    test.each([
      ['no prefix', '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">'],
      ['another prefix', '<dsig:Signature>'],
      ['a prefix with a dot and a digit', '<ns1.x2:Signature Id="s">'],
      ['an empty element', '<ds:Signature/>'],
      ['a tag that continues on the next line', '<ds:Signature\nId="s">'],
    ])('a Signature element with %s is detected', (_name, tag) => {
      const xml = `<a>\n\n  ${tag}\n</a>\n\n<b/>`;
      expect(removeBlankMarkupLines(xml)).toBe(xml);
    });

    test.each([
      ['ds:SignatureMethod', '<ds:SignatureMethod Algorithm="x"/>'],
      ['SignatureValue', '<SignatureValue>x</SignatureValue>'],
      ['a closing tag only', '</ds:Signature>'],
      ['the word as the text of an element', '<b>Signature</b>'],
      ['an attribute value', '<c name="Signature"/>'],
    ])('%s is not a Signature element', (_name, text) => {
      expect(removeBlankMarkupLines(`<a>\n\n${text}\n</a>`)).toBe(
        `<a>\n${text}\n</a>`
      );
    });

    test('a ds:KeyInfo is not a signature', () => {
      const xml = remoteIdpMetadata({ keyInfoBlankLines: [4] });
      expect(xml).toContain('<ds:KeyInfo>');
      expect(removeBlankMarkupLines(xml)).not.toBe(xml);
    });
  });

  describe('robustness', () => {
    test('running it twice gives the same text', () => {
      for (const xml of [
        remoteIdpMetadata({
          keyInfoBlankLines: [4, 4],
          encryptionBlankLines: 2,
        }),
        remoteIdpMetadata({ keyInfoBlankLines: [3, 3], eol: '\r\n' }),
        remoteIdpMetadata({ keyInfoBlankLines: [4], signed: true }),
        hostedSpMetadata(),
        '<a>\n\ntext\n\n<b/>\n\n\n',
      ]) {
        const once = removeBlankMarkupLines(xml);
        expect(removeBlankMarkupLines(once)).toBe(once);
      }
    });

    test('an empty string comes back as an empty string', () => {
      expect(removeBlankMarkupLines('')).toBe('');
    });

    test('a string without any > comes back unchanged', () => {
      const text = 'plain text\n\n  \nmore text\n';
      expect(removeBlankMarkupLines(text)).toBe(text);
    });

    test('a string of blank lines only comes back unchanged', () => {
      expect(removeBlankMarkupLines('  \n\n\t\n')).toBe('  \n\n\t\n');
    });

    test('a value that is not a string comes back as it is', () => {
      const notText = { not: 'text' } as unknown as string;
      expect(removeBlankMarkupLines(notText)).toBe(notText);
      expect(removeBlankMarkupLines(undefined as unknown as string)).toBe(
        undefined
      );
    });

    test('a long document is handled in well under a second', () => {
      const unit = [
        '<a>',
        '                ',
        '                ',
        '    <b>',
        '        text',
        '',
        '        more text',
        '    </b>',
        '</a>',
      ];
      const lines: string[] = [];
      while (lines.length < 50000) lines.push(...unit);
      const xml = lines.join('\n');
      const start = performance.now();
      const result = removeBlankMarkupLines(xml);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
      // the two blank lines after each <a> go, the one inside the text stays
      const resultLines = result.split('\n');
      const rounds = Math.ceil(50000 / unit.length);
      expect(resultLines.length).toBe(rounds * (unit.length - 2));
    });

    test('a long run of blank lines, a long line and an unterminated tag are handled in linear time', () => {
      const runOfBlank = `<a>${'\n  '.repeat(200000)}\n<b/>`;
      const longLine = `<a>\n\n<${'x'.repeat(200000)}`;
      const manyOpenings = `${'<a:'.repeat(100000)}>\n\n<b/>`;
      const start = performance.now();
      expect(removeBlankMarkupLines(runOfBlank)).toBe('<a>\n<b/>');
      expect(removeBlankMarkupLines(longLine)).toBe(
        `<a>\n<${'x'.repeat(200000)}`
      );
      expect(removeBlankMarkupLines(manyOpenings)).toBe(
        manyOpenings.replace('\n\n', '\n')
      );
      expect(performance.now() - start).toBeLessThan(1000);
    });
  });
});
