/**
 * Run tests
 *
 *        npm run test:only AccessProfileOps.drift
 *
 * The drift guard of the access profile: every scope that an API module of `src/api` declares
 * (`requiredScopes`) belongs to an area of the profile, and every scope of an area is declared by
 * an API module. A new module that needs a scope the profile does not know cannot slip through:
 * this test fails until the scope is classified, so the profile (and the pre-flight check that
 * shares its rules) keeps saying the truth about what a session can reach.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, test } from '@jest/globals';
import Constants from '../shared/Constants';
import { ACCESS_AREAS, areaOfScope, listAccessAreas } from './AccessProfileOps';

const API_DIR = fileURLToPath(new URL('../api', import.meta.url));

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.includes('.test.')
      ? [full]
      : [];
  });
}

/** The scopes the API modules declare, with the files that declare them. */
function declaredScopes(): {
  scopes: Map<string, string[]>;
  unresolved: string[];
} {
  const scopes = new Map<string, string[]>();
  const unresolved: string[] = [];
  for (const file of sourceFiles(API_DIR)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/requiredScopes:\s*\[([^\]]*)\]/g)) {
      for (const raw of match[1].split(',')) {
        const item = raw.trim();
        if (!item) continue;
        const constant = /^Constants\.AVAILABLE_SCOPES\.(\w+)$/.exec(item);
        const literal = /^['"]([^'"]+)['"]$/.exec(item);
        const scope = constant
          ? Constants.AVAILABLE_SCOPES[constant[1]]
          : literal?.[1];
        if (!scope) {
          unresolved.push(`${path.relative(API_DIR, file)}: ${item}`);
          continue;
        }
        scopes.set(scope, [
          ...(scopes.get(scope) ?? []),
          path.relative(API_DIR, file),
        ]);
      }
    }
  }
  return { scopes, unresolved };
}

describe('AccessProfileOps drift guard', () => {
  const { scopes, unresolved } = declaredScopes();

  test('1: the scan finds the scopes the API modules declare (it is not vacuous)', () => {
    expect(scopes.size).toBeGreaterThan(15);
    expect([...scopes.keys()]).toEqual(
      expect.arrayContaining([
        'fr:am:*',
        'fr:idm:*',
        'fr:idc:esv:read',
        'fr:idc:esv:update',
        'fr:iga:*',
        'fr:idc:ws:admin',
        'fr:idc:promotion:read',
      ])
    );
  });

  test('2: every scope an API module declares belongs to an area of the access profile', () => {
    const unclassified = [...scopes.entries()]
      .filter(([scope]) => !areaOfScope(scope))
      .map(
        ([scope, files]) =>
          `${scope} (declared in ${[...new Set(files)].join(', ')})`
      );
    expect(unclassified).toEqual([]);
  });

  test('3: every scope of an area is declared by an API module (no dead entries)', () => {
    const dead = ACCESS_AREAS.flatMap((area) =>
      area.scopes
        .filter((scope) => !scopes.has(scope))
        .map((scope) => `${area.id}: ${scope}`)
    );
    expect(dead).toEqual([]);
  });

  test('4: a required scope the scan cannot resolve is a failure, not a silent gap', () => {
    expect(unresolved).toEqual([]);
  });

  test('5: area identifiers are unique, and listAccessAreas() is the same list, as copies', () => {
    const ids = ACCESS_AREAS.map((area) => area.id);
    expect(new Set(ids).size).toBe(ids.length);
    const listed = listAccessAreas();
    expect(listed.map((a) => a.id)).toEqual(ids);
    listed[0].scopes.push('fr:changed:*');
    expect(listAccessAreas()[0].scopes).not.toContain('fr:changed:*');
  });
});
