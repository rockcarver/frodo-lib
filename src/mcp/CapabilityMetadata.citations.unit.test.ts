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

/** The text that an agent reads about a capability: its notes and the descriptions of its parameters. */
function textsOf(descriptor: (typeof inventory)[number]) {
  return [
    ...(descriptor.notes ? [descriptor.notes] : []),
    ...(descriptor.parameters ?? []).flatMap((parameter) =>
      parameter.description ? [parameter.description] : []
    ),
  ];
}

describe('what the notes and parameter descriptions of the capabilities cite', () => {
  test('the inventory is not empty, so that the checks below read something', () => {
    expect(ids.size).toBeGreaterThan(700);
    expect(inventory.flatMap(textsOf).length).toBeGreaterThan(1000);
  });

  test('a capability id in a note or a parameter description is a capability, or the module path in front of one', () => {
    const citation = new RegExp(
      `(?<![\\w.])(?:${domains.join('|')})(?:\\.[A-Za-z_][A-Za-z0-9_]*)+`,
      'g'
    );
    const unknown = inventory.flatMap((descriptor) =>
      textsOf(descriptor).flatMap((text) =>
        (text.match(citation) ?? [])
          .filter((token) => !known.has(token))
          .map((token) => `${descriptor.id} cites ${token}`)
      )
    );

    expect(unknown).toEqual([]);
  });

  test('no note cites a constant of the node catalog of the code, which no longer exists', () => {
    const citing = inventory
      .filter((descriptor) =>
        textsOf(descriptor).some((text) => text.includes('OOTB_NODE_TYPES'))
      )
      .map((descriptor) => descriptor.id);

    expect(citing).toEqual([]);
  });
});
