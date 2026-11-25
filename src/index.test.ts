import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as root from './index';
import type { McpCapabilityDescriptor, TerminalContrastFilter } from './index';

const POLICY_FILE = 'CONTRIBUTE.md';

describe('package root exports', () => {
  test('exports only the supported runtime values', () => {
    const actual = Object.keys(root).sort();
    const expected = ['FrodoError', 'frodo', 'state'];
    if (actual.join(',') !== expected.join(',')) {
      throw new Error(
        `Unexpected package root runtime exports: ${actual.join(', ')}. New capabilities belong on the facade (frodo.<domain>...), not at the package root. See ${POLICY_FILE}.`
      );
    }
  });

  test('references an existing policy file from the guard message', () => {
    const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
    const policyFilePath = resolve(repositoryRoot, POLICY_FILE);
    if (!existsSync(policyFilePath)) {
      throw new Error(
        `The package root export guard text points at a missing file: ${POLICY_FILE}.`
      );
    }
  });

  test('exports the types of the reference lookups, among them the answer for a list of ids', () => {
    // A type leaves no runtime export: read the export declarations of the
    // source of the package entry, and find where each type is declared.
    const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
    const entry = resolve(repositoryRoot, 'src/index.ts');
    const exported = new Map<string, string>();
    const parsed = ts.createSourceFile(
      entry,
      readFileSync(entry, 'utf8'),
      ts.ScriptTarget.Latest
    );
    for (const statement of parsed.statements) {
      if (
        ts.isExportDeclaration(statement) &&
        statement.isTypeOnly &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        for (const specifier of statement.exportClause.elements) {
          exported.set(specifier.name.text, statement.moduleSpecifier.text);
        }
      }
    }
    for (const name of [
      'ObjectReference',
      'ReferenceDependency',
      'ReferenceLookupResult',
      'ConnectorReference',
      'ConnectorServerReference',
      'MappingReference',
    ]) {
      const from = exported.get(name);
      expect(from).toBeDefined();
      // the module that the entry names declares the type under that name
      const declaring = resolve(repositoryRoot, 'src', `${from}.ts`);
      expect(readFileSync(declaring, 'utf8')).toMatch(
        new RegExp(`export type ${name}\\b`)
      );
    }
  });

  test('preserves type-only exports', () => {
    const types: [
      TerminalContrastFilter | undefined,
      McpCapabilityDescriptor | undefined,
    ] = [undefined, undefined];
    expect(types).toEqual([undefined, undefined]);
  });
});
