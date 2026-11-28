import { leastCpuMilliseconds } from '../test/utils/CpuTime';
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

/**
 * The time that a linear function may take. It is CPU time and not the wall clock (a pause of the machine does not
 * count), the least of a few runs, and a run that does not return in a few seconds is interrupted and fails the test:
 * a function that reads the text again for each line takes minutes on these texts.
 */
const CPU_BOUND_MS = 1000;
const cpuTime = (run: () => unknown) => leastCpuMilliseconds(run, CPU_BOUND_MS);

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

    test('every number of saves of the server exports the same text', () => {
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

    test.each([
      [
        'a CDATA line that ends in > and one that starts with <',
        '<a><![CDATA[\nfoo>\n\n<bar\n]]></a>',
      ],
      ['several of them', '<a><![CDATA[\nfoo>\n\n  \n\t\n  <bar\n]]></a>'],
      [
        'a CDATA section and no text around it',
        '<a>\n<![CDATA[\n>\n\n<\n]]>\n</a>',
      ],
      [
        'a CDATA section that starts on a line of markup',
        '<a>\n<b/><![CDATA[x>\n\n<y]]>\n</a>',
      ],
      [
        'a CDATA section that holds the start of a comment',
        '<a><![CDATA[\n<!--\n\n<b>\n]]></a>',
      ],
      [
        'a CDATA section that is never closed',
        '<a><![CDATA[\nfoo>\n\n<bar>\n\n</a>',
      ],
      [
        'a CDATA section with a bare ]] in it (not the end marker)',
        '<a><![CDATA[x ]] y>\n\n<z ]]></a>',
      ],
      [
        'a CDATA section with a bare ]> in it (not the end marker)',
        '<a><![CDATA[x ]> y>\n\n<z ]]></a>',
      ],
    ])('a blank line inside a CDATA section stays: %s', (_name, xml) => {
      expect(removeBlankMarkupLines(xml)).toBe(xml);
    });

    test.each([
      ['a comment', '<a>\n<!--\n<x>\n\n<y>\n-->\n</a>'],
      [
        'a comment that starts on a line of markup',
        '<a>\n<b/><!-- x>\n\n<y -->\n</a>',
      ],
      [
        'a comment that holds the start of a CDATA section',
        '<a>\n<!-- <![CDATA[ >\n\n<b>\n-->\n</a>',
      ],
      ['a comment that is never closed', '<a>\n<!-- >\n\n<b/>\n\n</a>'],
      [
        'a comment with a bare -- in it (not the end marker)',
        '<a>\n<!-- x -- y>\n\n<z -->\n</a>',
      ],
    ])('a blank line inside %s stays', (_name, xml) => {
      expect(removeBlankMarkupLines(xml)).toBe(xml);
    });

    test('the blank lines around a CDATA section and a comment still go', () => {
      expect(
        removeBlankMarkupLines(
          '<a>\n\n<![CDATA[\nx\n\ny\n]]>\n\n<!-- c\n\nd -->\n\n<b/>\n\n</a>'
        )
      ).toBe('<a>\n<![CDATA[\nx\n\ny\n]]>\n<!-- c\n\nd -->\n<b/>\n</a>');
    });

    test('a CDATA section and a comment on one line are followed to their ends', () => {
      // the comment ends on the line, the CDATA section after it does not
      expect(
        removeBlankMarkupLines('<a><!-- c --><![CDATA[x>\n\n<y]]>\n\n<b/></a>')
      ).toBe('<a><!-- c --><![CDATA[x>\n\n<y]]>\n<b/></a>');
    });

    test('many CDATA sections and comments on a line are followed in linear time', () => {
      const tokens = '<!-- a -->'.repeat(100000);
      const cdata = '<![CDATA[ a ]]>'.repeat(100000);
      let results: string[] = [];
      const milliseconds = cpuTime(() => {
        results = [
          removeBlankMarkupLines(`<a>${tokens}\n\n<b/>`),
          removeBlankMarkupLines(`<a>${cdata}\n\n<b/>`),
        ];
      });
      expect(results).toEqual([`<a>${tokens}\n<b/>`, `<a>${cdata}\n<b/>`]);
      expect(milliseconds).toBeLessThan(CPU_BOUND_MS);
    });

    test.each([
      ['xml:space="preserve"', '<a xml:space="preserve">\n\n<b/>\n</a>'],
      ["xml:space='default'", "<a>\n\n<b xml:space='default'/>\n</a>"],
      ['xml:space in a comment', '<a>\n\n<!-- xml:space -->\n</a>'],
    ])('a document with %s comes back byte-identical', (_name, xml) => {
      expect(removeBlankMarkupLines(xml)).toBe(xml);
    });

    test.each([
      ['a line of text that ends in >', '<a>x >\n\n</a>', '<a>x >\n</a>'],
      [
        'a processing instruction that goes over several lines',
        '<a>\n<?pi data>\n\n<more?>\n</a>',
        '<a>\n<?pi data>\n<more?>\n</a>',
      ],
      [
        'the entity value of a DOCTYPE that goes over several lines',
        '<!DOCTYPE a [\n<!ENTITY e "p>\n\n<q">\n]>\n<a/>',
        '<!DOCTYPE a [\n<!ENTITY e "p>\n<q">\n]>\n<a/>',
      ],
      [
        'an element whose only content is blank lines',
        '<a>\n\n</a>',
        '<a>\n</a>',
      ],
    ])(
      'a blank line next to %s is taken for indentation (a known limit of a rule that reads lines)',
      (_name, xml, expected) => {
        expect(removeBlankMarkupLines(xml)).toBe(expected);
      }
    );

    test('a blank line between two lines of text stays', () => {
      // the line before ends in text, the line after starts with text
      const xml = '<a>x\n\ny</a>';
      expect(removeBlankMarkupLines(xml)).toBe(xml);
    });
  });

  describe('white space is space, tab and carriage return', () => {
    const others = [
      ['a no-break space', '\u00a0'],
      ['a byte order mark', '\ufeff'],
      ['a form feed', '\f'],
      ['a vertical tab', '\v'],
      ['an ideographic space', '\u3000'],
      ['a line separator', '\u2028'],
    ];

    test.each(others)('a line that holds only %s is not blank', (_name, c) => {
      const xml = `<a>\n${c}\n<b/>`;
      expect(removeBlankMarkupLines(xml)).toBe(xml);
    });

    test.each(others)(
      'a markup line that ends in %s does not end the markup',
      (_name, c) => {
        const xml = `<a>${c}\n\n<b/>`;
        expect(removeBlankMarkupLines(xml)).toBe(xml);
      }
    );

    test.each(others)(
      'a markup line that starts with %s does not start the markup',
      (_name, c) => {
        const xml = `<a>\n\n${c}<b/>`;
        expect(removeBlankMarkupLines(xml)).toBe(xml);
      }
    );

    test.each(others)(
      'blank lines next to a line that holds only %s stay',
      (_name, c) => {
        const xml = `<a>\n\n${c}\n\n<b/>`;
        expect(removeBlankMarkupLines(xml)).toBe(xml);
      }
    );

    test('spaces, tabs and a carriage return around the markup do not matter', () => {
      expect(removeBlankMarkupLines('<a> \t\r\n\n \t<b/>')).toBe(
        '<a> \t\r\n \t<b/>'
      );
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
      ['a prefix with an accent', '<é:Signature>'],
      ['a prefix in another script', '<日本:Signature Id="s">'],
      ['a prefix with a hyphen and an underscore', '<ns-1_x:Signature>'],
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
      ['a longer name', '<ds:Signature2 a="b"/>'],
      ['a name with a second colon', '<a:b:Signature>'],
      [
        'a lower-case signature element (the check is case sensitive)',
        '<signature Id="s">',
      ],
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
      let result = '';
      const milliseconds = cpuTime(() => {
        result = removeBlankMarkupLines(xml);
      });
      expect(milliseconds).toBeLessThan(CPU_BOUND_MS);
      // the two blank lines after each <a> go, the one inside the text stays
      const resultLines = result.split('\n');
      const rounds = Math.ceil(50000 / unit.length);
      expect(resultLines.length).toBe(rounds * (unit.length - 2));
    });

    test('a long run of blank lines, a long line and an unterminated tag are handled in linear time', () => {
      const runOfBlank = `<a>${'\n  '.repeat(200000)}\n<b/>`;
      const longLine = `<a>\n\n<${'x'.repeat(200000)}`;
      const manyOpenings = `${'<a:'.repeat(100000)}>\n\n<b/>`;
      let results: string[] = [];
      const milliseconds = cpuTime(() => {
        results = [
          removeBlankMarkupLines(runOfBlank),
          removeBlankMarkupLines(longLine),
          removeBlankMarkupLines(manyOpenings),
        ];
      });
      expect(results).toEqual([
        '<a>\n<b/>',
        `<a>\n<${'x'.repeat(200000)}`,
        manyOpenings.replace('\n\n', '\n'),
      ]);
      expect(milliseconds).toBeLessThan(CPU_BOUND_MS);
    });
  });
});
