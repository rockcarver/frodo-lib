import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * The module specifiers that a source file imports or re-exports, in the order they appear: `import ... from 'x'`,
 * `import 'x'`, `export ... from 'x'`, `import('x')` and `require('x')`. A type-only import counts as well (record 0004:
 * the direction rule applies to types too). Comments are removed first, so a word in a comment is not an import.
 * Used by the tests that keep the pure modules of `src/utils` free of upward imports and of the file system.
 * @param {string} sourcePath path of the source file, relative to the root of the repository
 * @returns {string[]} the specifiers
 */
export function importSpecifiersOf(sourcePath: string): string[] {
  const source = readFileSync(resolve(sourcePath), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const specifiers: string[] = [];
  const patterns = [
    /\b(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

/** The layers of the library that a module of the foundation (`src/utils`) must not import (record 0004). */
export const UPWARD_PATTERN = /^\.\.\/(api|ops|lib)(\/|$)|^\.\.\/index$/;

/** The built-in modules that reach the file system, the machine or other processes. */
export const NODE_IO_MODULES = [
  'fs',
  'fs/promises',
  'node:fs',
  'node:fs/promises',
  'os',
  'node:os',
  'child_process',
  'node:child_process',
];
