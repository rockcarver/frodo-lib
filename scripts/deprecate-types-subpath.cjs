#!/usr/bin/env node
/**
 * Prepends a formal deprecation notice to every generated declaration file
 * in the `types/` tree (the `./types/*` deep-import subpath).
 *
 * TypeScript and npm have no mechanism to mark an exports *subpath*
 * deprecated (`@deprecated` JSDoc only works on declarations, and
 * `npm deprecate` applies to whole package versions). The banner below is
 * the formal in-artifact notice: anyone opening a `types/**` file — in an
 * IDE, a diff, or a tarball — sees it. Removal of the subpath is tracked
 * for a future major; see MIGRATION.md.
 *
 * Runs after `generate-types` in the build. Idempotent: skips files that
 * already carry the banner.
 */
const fs = require('node:fs');
const path = require('node:path');

const BANNER = [
  '/**',
  ' * @deprecated The `@rockcarver/frodo-lib/types/*` deep-import subpath is',
  ' * deprecated since 4.12.0. Import from the package root instead:',
  ' *',
  ' * ```ts',
  ' * // before (deprecated)',
  " * import { type TreeSkeleton } from '@rockcarver/frodo-lib/types/api/TreeApi';",
  ' *',
  ' * // after',
  " * import { type TreeSkeleton } from '@rockcarver/frodo-lib';",
  ' * ```',
  ' *',
  ' * The subpath only resolves under the legacy `moduleResolution: node`',
  ' * (node10) mode, which TypeScript 6 deprecates and TypeScript 7 removes.',
  ' * It will be removed in a future major release. See MIGRATION.md.',
  ' */',
].join('\n');

const typesDir = path.join(__dirname, '..', 'types');

function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(p));
    else if (entry.name.endsWith('.d.ts')) files.push(p);
  }
  return files;
}

let count = 0;
for (const file of walk(typesDir)) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.startsWith(BANNER)) continue; // already stamped
  fs.writeFileSync(file, `${BANNER}\n${src}`);
  count++;
}
console.error(`deprecation banner added to ${count} declaration file(s)`);
