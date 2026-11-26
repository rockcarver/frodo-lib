/**
 * Run tests
 *
 *        npm run test:only -- src/ops/ConfigTypeRegistry
 *
 * The registry of configuration types (`src/ops/ConfigTypeRegistry.ts`) is one list that a person keeps by hand. These
 * tests keep it honest: a module of `src/ops` that exports a function whose name starts with `pull` or `push` (a pull
 * to a file set, a push from one) must have a descriptor in the list that names that function, or the test fails and says
 * which function it is. The list is empty today and the real source passes; a fixture source stands in for the module that
 * does not exist yet.
 *
 * A module counts as listed when the `pull` or the `push` function of a descriptor has the name of one of its exported pull
 * and push functions. Hermetic: it reads the sources of `src/ops` and nothing else.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { importSpecifiersOf } from '../test/exportFileFormat/importsOf';
import {
  ConfigTypeRegistry,
  type ConfigTypeDescriptor,
} from './ConfigTypeRegistry';

/** The names of the functions that the registry has to know. */
const PULL_OR_PUSH = /^(pull|push)[A-Z]/;

/**
 * The names that a source file exports at its top level: functions, variables, and the names of `export { a, b as c }`.
 * @param {string} source the text of the source file
 * @returns {string[]} the exported names, in the order of the file
 */
function exportedNames(source: string): string[] {
  const parsed = ts.createSourceFile(
    'module.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const names: string[] = [];
  for (const statement of parsed.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      names.push(statement.name.text);
    } else if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          names.push(declaration.name.text);
        }
      }
    } else if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const specifier of statement.exportClause.elements) {
        if (!specifier.isTypeOnly) names.push(specifier.name.text);
      }
    }
  }
  return names;
}

/**
 * The exported pull and push functions that no descriptor names.
 * @param {Record<string, string>} sources the text of each module, by its path
 * @param {Pick<ConfigTypeDescriptor, 'pull' | 'push'>[]} descriptors the registry
 * @returns {{ file: string; name: string }[]} the functions that are not listed
 */
function unlistedPullAndPush(
  sources: Record<string, string>,
  descriptors: Pick<ConfigTypeDescriptor, 'pull' | 'push'>[]
): { file: string; name: string }[] {
  const listed = new Set(
    descriptors.flatMap((d) => [d.pull?.name, d.push?.name]).filter(Boolean)
  );
  const unlisted: { file: string; name: string }[] = [];
  for (const [file, source] of Object.entries(sources)) {
    for (const name of exportedNames(source)) {
      if (PULL_OR_PUSH.test(name) && !listed.has(name)) {
        unlisted.push({ file, name });
      }
    }
  }
  return unlisted;
}

/** The sources of `src/ops`, by path relative to `src/ops`, without tests and declarations. */
function opsSources(): Record<string, string> {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const sources: Record<string, string> = {};
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.d.ts')
      ) {
        sources[path.slice(root.length)] = readFileSync(path, 'utf8');
      }
    }
  };
  walk(root);
  return sources;
}

/** A function with the name that a type module would give it. */
async function pullToys(): Promise<void> {}
async function pushToys(): Promise<void> {}
async function pullOther(): Promise<void> {}

const toy = (own: Partial<ConfigTypeDescriptor>): ConfigTypeDescriptor => ({
  key: 'toys',
  scope: 'realm',
  isStatic: false,
  deployments: ['cloud', 'forgeops', 'classic'],
  exportOrder: 1,
  importOrder: 1,
  ...own,
});

describe('the registry of configuration types', () => {
  it('is a list, and a descriptor has the fields of the design', () => {
    const descriptor: ConfigTypeDescriptor = toy({
      pull: pullToys,
      push: pushToys,
      export: async () => ({}),
      import: async () => ({}),
    });

    expect(Array.isArray(ConfigTypeRegistry)).toBe(true);
    expect(Object.keys(descriptor).sort()).toEqual([
      'deployments',
      'export',
      'exportOrder',
      'import',
      'importOrder',
      'isStatic',
      'key',
      'pull',
      'push',
      'scope',
    ]);
  });

  it('lists every pull and push function that a module of src/ops exports', () => {
    const sources = opsSources();

    expect(unlistedPullAndPush(sources, ConfigTypeRegistry)).toEqual([]);
  });

  it('reads the real sources: it sees the modules and what they export', () => {
    const sources = opsSources();
    const files = Object.keys(sources);
    const names = Object.values(sources).flatMap(exportedNames);

    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('ConfigTypeRegistry.ts');
    expect(files.some((file) => file.startsWith('internal/'))).toBe(true);
    // the scan finds functions and constants, so a name that starts with pull would be found as well
    expect(names).toContain('ConfigTypeRegistry');
    expect(
      names.filter((name) => /^read[A-Z]/.test(name)).length
    ).toBeGreaterThan(100);
    expect(names.filter((name) => PULL_OR_PUSH.test(name))).toEqual([]);
  });

  it('fails for a module that exports a pull function that no descriptor names', () => {
    const sources = {
      'ToyOps.ts': 'export async function pullToys() { return []; }\n',
    };

    expect(unlistedPullAndPush(sources, [])).toEqual([
      { file: 'ToyOps.ts', name: 'pullToys' },
    ]);
  });

  it('passes when a descriptor names the pull function', () => {
    const sources = {
      'ToyOps.ts': 'export async function pullToys() { return []; }\n',
    };

    expect(unlistedPullAndPush(sources, [toy({ pull: pullToys })])).toEqual([]);
  });

  it('checks push as well as pull', () => {
    const sources = {
      'ToyOps.ts': [
        'export async function pullToys() { return []; }',
        'export async function pushToys() { return []; }',
      ].join('\n'),
    };

    expect(unlistedPullAndPush(sources, [])).toEqual([
      { file: 'ToyOps.ts', name: 'pullToys' },
      { file: 'ToyOps.ts', name: 'pushToys' },
    ]);
    // a descriptor that lists the pull leaves the push unlisted, and the other way round
    expect(unlistedPullAndPush(sources, [toy({ pull: pullToys })])).toEqual([
      { file: 'ToyOps.ts', name: 'pushToys' },
    ]);
    expect(unlistedPullAndPush(sources, [toy({ push: pushToys })])).toEqual([
      { file: 'ToyOps.ts', name: 'pullToys' },
    ]);
    expect(
      unlistedPullAndPush(sources, [toy({ pull: pullToys, push: pushToys })])
    ).toEqual([]);
  });

  it('is satisfied by a descriptor of another type only for the name it holds', () => {
    const sources = {
      'ToyOps.ts': 'export async function pullToys() { return []; }\n',
    };

    expect(
      unlistedPullAndPush(sources, [toy({ key: 'other', pull: pullOther })])
    ).toEqual([{ file: 'ToyOps.ts', name: 'pullToys' }]);
  });

  it.each([
    ['a function', 'export async function pullToys() {}', ['pullToys']],
    ['a constant', 'export const pushToys = async () => {};', ['pushToys']],
    [
      'a list of exports',
      'async function a() {}\nexport { a as pullToys };',
      ['pullToys'],
    ],
    [
      'two constants of one statement',
      'export const pullA = 1, pushB = 2;',
      ['pullA', 'pushB'],
    ],
    [
      'a re-export',
      "export { pullToys, other as pushToys } from './Elsewhere';",
      ['pullToys', 'pushToys'],
    ],
  ])(
    'finds the pull and push functions that %s exports',
    (_what, source, names) => {
      expect(exportedNames(source).filter((n) => PULL_OR_PUSH.test(n))).toEqual(
        names
      );
    }
  );

  it.each([
    ['a function that is not exported', 'async function pullToys() {}'],
    ['a name that goes on in lower case', 'export function pulled() {}'],
    [
      'a name with lower case after the verb',
      'export function pullrequest() {}',
    ],
    ['the bare verb', 'export function pull() {}\nexport function push() {}'],
    ['a name that has the verb inside', 'export function importPush() {}'],
    ['a type', 'export type pullToys = string;\nexport interface PushToys {}'],
    ['a type only export', "export type { pullToys } from './Elsewhere';"],
    ['a method of an object', 'export const api = { pullToys() {} };'],
  ])('does not take %s for a pull or push function', (_what, source) => {
    expect(exportedNames(source).filter((n) => PULL_OR_PUSH.test(n))).toEqual(
      []
    );
  });
});

describe('the module stays pure', () => {
  it('imports nothing: the descriptors give the functions as they are', () => {
    expect(importSpecifiersOf('src/ops/ConfigTypeRegistry.ts')).toEqual([]);
  });
});
