/**
 * Unit test for what the notes and parameter descriptions of the MCP
 * capabilities cite.
 *
 * Run with:
 *
 *        npm run test:only CapabilityMetadata.citations
 *
 * Origin: frodo-cli#1373. A note that names another capability, or a constant
 * of the code, sends an agent to something that must exist. Two citations had
 * gone stale: a capability id with a module segment too many, and a constant
 * that no longer exists.
 *
 * A token that starts with a domain word (`config`, `user`, `login`, ...) is
 * read as a citation, so a description that names a file or a property such
 * as `config.json` or `user.name` fails the test. Reword the text, or add the
 * token to NOT_CITATIONS below with the reason. An entry that no text
 * contains any more fails too, so the list cannot collect leftovers.
 */
import '../index';
import { frodo } from '../lib/FrodoLib';
import { buildCapabilityInventory } from './CapabilityRegistry';

const inventory = buildCapabilityInventory(frodo, { includeUtils: false });
const ids = new Set(inventory.map((descriptor) => descriptor.id));
// every capability id and every module path in front of one
const known = new Set(
  inventory.flatMap((descriptor) => {
    const segments = descriptor.id.split('.');
    return segments.map((_, index) => segments.slice(0, index + 1).join('.'));
  })
);
const domains = [...new Set(inventory.map((d) => d.id.split('.')[0]))];

/**
 * Tokens that look like a citation (they start with a domain word) and are
 * none, each with the reason. Empty: no text of the shipped inventory needs an
 * entry.
 */
const NOT_CITATIONS: ReadonlyMap<string, string> = new Map<string, string>([]);

/** A text that an agent reads about a capability, and the capability it is about. */
type Text = { id: string; text: string };

/** The notes and the parameter descriptions of the capabilities. */
function textsOf(descriptors: typeof inventory): Text[] {
  return descriptors.flatMap((descriptor) =>
    [
      ...(descriptor.notes ? [descriptor.notes] : []),
      ...(descriptor.parameters ?? []).flatMap((parameter) =>
        parameter.description ? [parameter.description] : []
      ),
    ].map((text) => ({ id: descriptor.id, text }))
  );
}

/** Every token of a text that starts with a domain word and a dot. */
function citedTokens(text: string): string[] {
  return (
    text.match(
      new RegExp(
        `(?<![\\w.])(?:${domains.join('|')})(?:\\.[A-Za-z_][A-Za-z0-9_]*)+`,
        'g'
      )
    ) ?? []
  );
}

/** The citations that are neither a capability, a module path in front of one, nor an entry of the allow-list. */
function unknownCitations(
  texts: Text[],
  notCitations: ReadonlyMap<string, string>
): string[] {
  return texts.flatMap(({ id, text }) =>
    citedTokens(text)
      .filter((token) => !known.has(token) && !notCitations.has(token))
      .map((token) => `${id} cites ${token}`)
  );
}

/** The entries of the allow-list that no text contains: the reason for them is gone. */
function unusedEntries(
  texts: Text[],
  notCitations: ReadonlyMap<string, string>
): string[] {
  const cited = new Set(texts.flatMap(({ text }) => citedTokens(text)));
  return [...notCitations.keys()].filter((entry) => !cited.has(entry));
}

describe('what the notes and parameter descriptions of the capabilities cite', () => {
  const texts = textsOf(inventory);

  test('the inventory is not empty, so that the checks below read something', () => {
    expect(ids.size).toBeGreaterThan(700);
    expect(texts.length).toBeGreaterThan(1000);
  });

  test('a capability id in a note or a parameter description is a capability, or the module path in front of one', () => {
    expect(unknownCitations(texts, NOT_CITATIONS)).toEqual([]);
  });

  test('every entry of the allow-list is still in a note or a parameter description, and has a reason', () => {
    expect(unusedEntries(texts, NOT_CITATIONS)).toEqual([]);
    for (const [entry, reason] of NOT_CITATIONS) {
      // one line of reason per entry
      expect({ entry, reason: reason.trim() }).toEqual({
        entry,
        reason: expect.stringMatching(/^[^\n]+$/),
      });
    }
  });

  test('no note cites a constant of the node catalog of the code, which no longer exists', () => {
    const citing = texts
      .filter(({ text }) => text.includes('OOTB_NODE_TYPES'))
      .map(({ id }) => id);

    expect(citing).toEqual([]);
  });
});

describe('the checks of the citations themselves', () => {
  const sample: Text[] = [
    {
      id: 'script.readScript',
      text: 'Reads the file config.json; see script.readScript and authn.journey for more.',
    },
  ];

  test('a token that starts with a domain word and is no capability is reported', () => {
    expect(unknownCitations(sample, new Map())).toEqual([
      'script.readScript cites config.json',
    ]);
  });

  test('a capability id and the module path in front of one are not reported', () => {
    expect(
      unknownCitations(
        [{ id: 'x', text: 'script.readScript, authn.journey and script' }],
        new Map()
      )
    ).toEqual([]);
  });

  test('an entry of the allow-list is not reported, and only that entry', () => {
    const allowed = new Map([['config.json', 'a file name, not a capability']]);

    expect(unknownCitations(sample, allowed)).toEqual([]);
    expect(
      unknownCitations(
        [{ id: 'x', text: 'config.json and user.name' }],
        allowed
      )
    ).toEqual(['x cites user.name']);
  });

  test('an entry that no text contains is reported as unused', () => {
    const allowed = new Map([
      ['config.json', 'a file name, not a capability'],
      ['user.name', 'a property, not a capability'],
    ]);

    expect(unusedEntries(sample, allowed)).toEqual(['user.name']);
    expect(unusedEntries(sample, new Map())).toEqual([]);
  });
});
