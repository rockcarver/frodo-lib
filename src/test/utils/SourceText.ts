import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * The source of a file of the library, for the tests that check what a type check in a test cannot see (a test run does not
 * report a type error of a test file). It lives here and not in the test, so that the test itself reads no file: the test of
 * the pipeline lists the tests that read guidance files, and a test that only looks at TypeScript is not one of them.
 */

/** The folder `src`. */
const SRC = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The text of a source file.
 * @param {string} relative the path of the file, relative to `src`
 * @returns {string} the text
 */
export function sourceText(relative: string): string {
  return readFileSync(resolve(SRC, relative), 'utf8');
}

/**
 * A source file, parsed, with the parents of its nodes set (so that `getText()` works on a node).
 * @param {string} relative the path of the file, relative to `src`
 * @returns {ts.SourceFile} the parsed file
 */
export function parsedSource(relative: string): ts.SourceFile {
  return ts.createSourceFile(
    resolve(SRC, relative),
    sourceText(relative),
    ts.ScriptTarget.Latest,
    true
  );
}

/**
 * What a source file exports from a module by `export ... from '<module>'`: the names that are exported as types and the
 * names that are exported as values (`*` for `export *`).
 * @param {string} relative the path of the file, relative to `src`
 * @param {string} module the module, as the specifier is written
 * @returns {{ types: string[]; values: string[] }} the names, sorted
 */
export function exportsFrom(
  relative: string,
  module: string
): { types: string[]; values: string[] } {
  const types: string[] = [];
  const values: string[] = [];
  for (const statement of parsedSource(relative).statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === module
    ) {
      const names =
        statement.exportClause && ts.isNamedExports(statement.exportClause)
          ? statement.exportClause.elements.map((element) => ({
              name: element.name.text,
              isType: statement.isTypeOnly || element.isTypeOnly,
            }))
          : [{ name: '*', isType: false }];
      for (const { name, isType } of names) {
        (isType ? types : values).push(name);
      }
    }
  }
  return { types: types.sort(), values: values.sort() };
}

/**
 * The declaration of a type alias in a source file.
 * @param {string} relative the path of the file, relative to `src`
 * @param {string} name the name of the type
 * @returns {ts.TypeAliasDeclaration} the declaration
 * @throws {Error} if the file declares no such type
 */
export function typeAlias(
  relative: string,
  name: string
): ts.TypeAliasDeclaration {
  const found = parsedSource(relative).statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === name
  );
  if (!found) throw new Error(`no type ${name} in ${relative}`);
  return found;
}
