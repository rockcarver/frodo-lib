/**
 * Run tests
 *
 *        npm run test:only -- src/ops/ConfigTypeRegistry
 *
 * The registry of configuration types (`src/ops/ConfigTypeRegistry.ts`) is one list that a person keeps by hand. These
 * tests keep it honest: a module of `src/ops` that exports a function whose name starts with `pull` or `push` (a pull
 * to a file set, a push from one) must have a descriptor in the list that names that function, or the test fails and says
 * which function it is. The list holds the KBA configuration today and the real source passes; a fixture source stands in
 * for a module that has no descriptor.
 *
 * A module counts as listed when the `pull` or the `push` function of a descriptor has the name of one of its exported pull
 * and push functions. Hermetic: it reads the sources of `src/ops` and nothing else.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  importSpecifiersOf,
  NODE_IO_MODULES,
} from '../test/exportFileFormat/importsOf';
import { parsedSource, typeAlias } from '../test/utils/SourceText';
import { type VirtualFile, type VirtualFileSet } from '../utils/FileSetUtils';
import {
  ConfigTypeRegistry,
  type ConfigTypeDescriptor,
} from './ConfigTypeRegistry';
import { kbaConfigType, pullKbaConfig, pushKbaConfig } from './IdmConfigOps';
import {
  type FileSetPull,
  type PullResult,
  type PushOutcome,
} from './OpsTypes';

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
async function pullToys(): Promise<PullResult> {
  return { fileSet: { files: [], ownedFolders: [] }, findings: [] };
}
async function pushToys(): Promise<PushOutcome[]> {
  return [];
}
async function pullOther(): Promise<PullResult> {
  return { fileSet: { files: [], ownedFolders: [] }, findings: [] };
}

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

  it('types the pull and the push of a descriptor: a pull gives a file set and its findings, a push gives outcomes', () => {
    // a type error of a test file is not reported by a test run, so the declaration is read as text: the functions that
    // an owner module gives are checked by the compiler against these two types when the library is built
    const declaration = parsedSource('ops/OpsTypes.ts').statements.find(
      (statement): statement is ts.InterfaceDeclaration =>
        ts.isInterfaceDeclaration(statement) &&
        statement.name.text === 'ConfigTypeDescriptor'
    );
    const typeOf = (member: string): string | undefined =>
      declaration?.members
        .find((m) => m.name?.getText() === member)
        ?.getChildren()
        .find((child) => ts.isTypeReferenceNode(child))
        ?.getText();

    expect(typeOf('pull')).toBe('FileSetPull');
    expect(typeOf('push')).toBe('FileSetPush');
    // the two types say what the owner modules give: the file set and the findings of a pull, the outcomes of a push
    const types = parsedSource('ops/OpsTypes.ts')
      .getText()
      .replace(/\s+/g, ' ');
    expect(types).toContain('}) => Promise<PullResult>');
    expect(types).toContain('}) => Promise<PushOutcome[]>');
  });

  it('types what a pull gives as a file set and a list of findings, and both are required', () => {
    const result = typeAlias('ops/OpsTypes.ts', 'PullResult');
    const members = ts.isTypeLiteralNode(result.type)
      ? result.type.members.filter(ts.isPropertySignature)
      : [];
    const member = (name: string) =>
      members.find((m) => m.name.getText() === name);

    expect(members.map((m) => m.name.getText())).toEqual([
      'fileSet',
      'findings',
    ]);
    expect(member('fileSet')?.type?.getText()).toBe('VirtualFileSet');
    expect(member('findings')?.type?.getText()).toBe('PullFinding[]');
    // a pull that does not say what it found is not a pull: no `?`
    expect(member('fileSet')?.questionToken).toBeUndefined();
    expect(member('findings')?.questionToken).toBeUndefined();
  });

  it('types a finding: what it was, which object, and a message', () => {
    const finding = typeAlias('ops/OpsTypes.ts', 'PullFinding');
    const members = ts.isTypeLiteralNode(finding.type)
      ? finding.type.members.filter(ts.isPropertySignature)
      : [];
    const text = (name: string) =>
      members
        .find((m) => m.name.getText() === name)
        ?.getText()
        .replace(/\s+/g, ' ');

    expect(text('kind')).toBe(
      "kind: 'collision' | 'refused' | 'unreadable' | 'not-of-type';"
    );
    expect(text('id')).toBe('id?: string;');
    expect(text('firstId')).toBe('firstId?: string;');
    expect(text('message')).toBe('message: string;');
    expect(members).toHaveLength(4);
  });

  it('types the volume of a type as bounded or unbounded, and a type that names none is bounded', () => {
    const volume = typeAlias('ops/OpsTypes.ts', 'Volume');
    const descriptor = parsedSource('ops/OpsTypes.ts').statements.find(
      (statement): statement is ts.InterfaceDeclaration =>
        ts.isInterfaceDeclaration(statement) &&
        statement.name.text === 'ConfigTypeDescriptor'
    );
    const member = descriptor?.members.find(
      (m) => m.name?.getText() === 'volume'
    );

    expect(volume.type.getText()).toBe("'bounded' | 'unbounded'");
    expect(member?.getText()).toContain('volume?: Volume;');
    // the KBA configuration has one object and names no volume
    expect(Object.keys(kbaConfigType)).not.toContain('volume');
  });

  describe('what the compiler refuses (read by tsc over the test files, which a test run does not do)', () => {
    // each line below is a type error that `@ts-expect-error` marks: tsc reports the comment when the line compiles
    const write = (_set: VirtualFileSet): void => undefined;
    const files: VirtualFile[] = [];

    /** Never called: it is here for the compiler. */
    async function probes(pull: FileSetPull, state: never): Promise<void> {
      // a pull that gives a bare file set is not a pull
      // @ts-expect-error a file set is not a PullResult
      const bare: FileSetPull = async () => ({ files, ownedFolders: [] });
      // a result without its findings is not a pull
      // @ts-expect-error findings are required
      const silent: FileSetPull = async () => ({
        fileSet: { files, ownedFolders: [] },
      });
      // the findings of a pull cannot be dropped by handing its result to a writer
      // @ts-expect-error a PullResult is not a file set
      write(await pull({ state }));
      // the right shape compiles
      const right: FileSetPull = async () => ({
        fileSet: { files, ownedFolders: [] },
        findings: [{ kind: 'collision', message: 'a message' }],
      });
      write((await pull({ state })).fileSet);
      // a finding has one of the four reasons
      const unknown: PullResult['findings'] = [
        // @ts-expect-error an unknown reason
        { kind: 'skipped', message: 'x' },
      ];
      void [bare, silent, right, unknown];
    }

    it('is written for the compiler: the probes exist and are not run', () => {
      expect(typeof probes).toBe('function');
    });
  });

  it('lists the KBA configuration, once, with the fields that its owner gave it', () => {
    expect(
      ConfigTypeRegistry.filter((type) => type === kbaConfigType)
    ).toHaveLength(1);
    expect(kbaConfigType).toEqual({
      key: 'kba',
      scope: 'global',
      isStatic: true,
      deployments: ['cloud', 'forgeops'],
      exportOrder: 140,
      importOrder: 130,
      pull: pullKbaConfig,
      push: pushKbaConfig,
    });
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
    // the scan finds the two functions of the KBA configuration, in the module that owns the type
    expect(names).toEqual(
      expect.arrayContaining(['pullKbaConfig', 'pushKbaConfig'])
    );
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
  const imports = importSpecifiersOf('src/ops/ConfigTypeRegistry.ts');

  it('imports only the owner modules of the types: one of the modules named here, and nothing else', () => {
    // a type that is added with a module of its own adds that module to this list; a sibling that is not an owner (the
    // errors, the engine, the full export) is not on it, so that the registry cannot become a hub that imports the layer
    const OWNER_MODULES = ['./IdmConfigOps'];
    // and the module that declares what a descriptor is, which holds types only and imports no module of the ops
    const TYPES_MODULE = './OpsTypes';

    expect(imports).toContain('./IdmConfigOps');
    expect(
      imports.filter((s) => !OWNER_MODULES.includes(s) && s !== TYPES_MODULE)
    ).toEqual([]);
  });

  it('reaches no module of the file system, the machine or other processes', () => {
    expect(imports.filter((s) => NODE_IO_MODULES.includes(s))).toEqual([]);
  });
});
