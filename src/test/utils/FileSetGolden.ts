import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { type VirtualFileSet } from '../../utils/FileSetUtils';

/**
 * The golden file set of a test: a folder that holds what a pull must give, byte for byte. The files of the set are below
 * `files/` at their own paths, and the owned folders are listed in `owned-folders.json` (a sorted JSON list). The folder is
 * written by hand and reviewed; a test never writes it, so that a change of what a pull gives shows up as a failure and not
 * as a new golden folder.
 *
 * Test-only: it reads the file system, which the code of the library never does for a file set.
 */

/** The folder of the files of the set, in a golden folder. */
const FILES_FOLDER = 'files';

/** The file that lists the owned folders, in a golden folder. */
const OWNED_FOLDERS_FILE = 'owned-folders.json';

/**
 * Every file below a folder, as its path relative to the folder with `/` between the parts.
 * @param {string} folder the folder
 * @param {string} prefix the path of the folder so far, for the recursion
 * @returns {string[]} the paths, sorted
 */
function filesBelow(folder: string, prefix = ''): string[] {
  const paths: string[] = [];
  for (const name of readdirSync(join(folder, prefix))) {
    const path = prefix === '' ? name : `${prefix}/${name}`;
    if (statSync(join(folder, path)).isDirectory()) {
      paths.push(...filesBelow(folder, path));
    } else {
      paths.push(path);
    }
  }
  return paths.sort();
}

/**
 * What differs between a file set and a golden folder, as one line for each difference: `changed: <path>` for a file whose
 * bytes differ, `missing: <path>` for a file of the golden folder that the set does not have, `extra: <path>` for a file of
 * the set that the golden folder does not have, and `owned folders: expected [...], got [...]` when the lists differ. An
 * empty list means the set is the golden set. The text of a file is compared as UTF-8 bytes, so a changed line end, a
 * byte order mark or a missing newline at the end all show.
 * @param {VirtualFileSet} fileSet the set that a pull gave
 * @param {string} goldenFolder the golden folder
 * @returns {string[]} the differences, empty if there are none
 */
export function goldenDifferences(
  fileSet: VirtualFileSet,
  goldenFolder: string
): string[] {
  const differences: string[] = [];
  const goldenPaths = new Set(filesBelow(join(goldenFolder, FILES_FOLDER)));
  const setPaths = new Set(fileSet.files.map((file) => file.path));
  for (const path of [...goldenPaths].sort()) {
    if (!setPaths.has(path)) differences.push(`missing: ${path}`);
  }
  for (const file of fileSet.files) {
    if (!goldenPaths.has(file.path)) {
      differences.push(`extra: ${file.path}`);
      continue;
    }
    const golden = readFileSync(join(goldenFolder, FILES_FOLDER, file.path));
    if (!golden.equals(Buffer.from(file.content, 'utf8'))) {
      differences.push(`changed: ${file.path}`);
    }
  }
  const expected = JSON.parse(
    readFileSync(join(goldenFolder, OWNED_FOLDERS_FILE), 'utf8')
  ) as string[];
  if (JSON.stringify(expected) !== JSON.stringify(fileSet.ownedFolders)) {
    differences.push(
      `owned folders: expected ${JSON.stringify(expected)}, got ${JSON.stringify(fileSet.ownedFolders)}`
    );
  }
  return differences;
}
