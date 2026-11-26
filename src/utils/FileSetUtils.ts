import { assertFileSetPath, sameOnAnyFileSystem } from './FileSetPathUtils';

/**
 * File sets: a tree of files as data. A pull gives one, a push takes one from a reader. Nothing here knows a file system,
 * a tenant or the state: the shapes, the builder that checks and orders a set, and a reader that reads a set from memory.
 * The paths are the paths that {@link assertFileSetPath} lets through.
 */

/** One file of a file set: its path, relative to the root of the set with `/` between the parts, and its text (UTF-8). */
export type VirtualFile = {
  path: string;
  content: string;
};

/**
 * A file set: the files, sorted by path, and the folders that the set owns. An owned folder is a folder whose whole
 * content the set describes, so a consumer that writes the set may remove what it holds that the set does not
 * (a folder that is not owned is never cleaned). A set that {@link buildFileSet} made holds every path once.
 */
export type VirtualFileSet = {
  files: VirtualFile[];
  ownedFolders: string[];
};

/** One entry of a directory listing: the name of a child of the directory (not its path), and whether it is a directory. */
export type FileSetEntry = {
  name: string;
  isDirectory: boolean;
};

/**
 * What a push asks for the files of a file set. A consumer supplies it (a file system, a version control system, memory),
 * and the library imports no file system module for it. Both methods are asynchronous.
 *
 * A path is relative to the root of the set, with `/` between the parts, and passes {@link assertFileSetPath}.
 *
 * - `listDirectory(path)` gives the direct children of the directory, as {@link FileSetEntry} (the order is the reader's),
 *   or `undefined` when the directory does not exist. A directory that exists and is empty gives `[]`.
 * - `readFile(path)` gives the text of the file, or `undefined` when the file does not exist.
 *
 * Anything else is an error that rejects: a path that is not a path of a file set, a file asked for as a directory, a
 * directory asked for as a file, and a failure to read.
 */
export interface FileSetReader {
  listDirectory(path: string): Promise<FileSetEntry[] | undefined>;
  readFile(path: string): Promise<string | undefined>;
}

/**
 * Two strings in ordinal order (by UTF-16 code unit, as `<` compares them), never by a locale.
 * @param {string} a the first string
 * @param {string} b the second string
 * @returns {number} negative if a is first, positive if b is first, 0 if they are equal
 */
function compareOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/**
 * Every folder above a path, and the path itself, shortest first (`a/b/c` gives `a`, `a/b`, `a/b/c`).
 * @param {string} path the path
 * @returns {string[]} the path and what it lies below
 */
function prefixesOf(path: string): string[] {
  const parts = path.split('/');
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
}

/**
 * Build a file set: check every path, refuse what a file system could not hold apart, and sort. The input is not changed
 * and the set it returns shares nothing with it.
 *
 * Every path of a file and every owned folder passes {@link assertFileSetPath}, so an owned folder is never empty, the
 * root, or written with a trailing slash. The builder refuses
 * - a path that two files have (`The file set holds the path ... twice.`),
 * - two paths, or two folders on the way to them, that are the same on a file system that ignores case or Unicode form
 *   (`A.json` and `a.json`; {@link sameOnAnyFileSystem} says what is the same),
 * - a file that is also a folder, because another path lies below it or it is an owned folder (`a` and `a/b.json`),
 * - an owned folder that is listed twice.
 *
 * `files` come back sorted by path and `ownedFolders` sorted, both in ordinal order (by UTF-16 code unit, never by a
 * locale), so the same content gives the same set whatever order it was found in. The text of a file is kept byte for byte.
 * @param {VirtualFileSet} fileSet the files and the owned folders; the owned folders may be left out
 * @param {VirtualFile[]} fileSet.files the files
 * @param {string[]} fileSet.ownedFolders the folders that the set owns
 * @returns {VirtualFileSet} a new, sorted file set
 * @throws {Error} if a path is not a path of a file set, a path is there twice or is the same as another on a file system that ignores case, or a file is also a folder
 */
export function buildFileSet({
  files,
  ownedFolders = [],
}: {
  files: VirtualFile[];
  ownedFolders?: string[];
}): VirtualFileSet {
  const seenFiles = new Set<string>();
  for (const { path } of files) {
    assertFileSetPath(path);
    if (seenFiles.has(path)) {
      throw new Error(`The file set holds the path '${path}' twice.`);
    }
    seenFiles.add(path);
  }
  const seenFolders = new Set<string>();
  for (const folder of ownedFolders) {
    assertFileSetPath(folder);
    if (seenFolders.has(folder)) {
      throw new Error(`The file set lists the owned folder '${folder}' twice.`);
    }
    seenFolders.add(folder);
  }

  // every file, folder and folder above them, by what a file system takes for one name, with the spelling that was seen
  const spelled = new Map<string, string>();
  // the folders: the owned ones and what lies above any path
  const folders = new Set<string>();
  const claim = (path: string, isFolder: boolean): void => {
    const key = sameOnAnyFileSystem(path);
    const first = spelled.get(key);
    if (first !== undefined && first !== path) {
      throw new Error(
        `The paths '${first}' and '${path}' are the same path on a file system that ignores case or Unicode form.`
      );
    }
    spelled.set(key, path);
    if (isFolder) folders.add(key);
  };
  for (const path of seenFiles) {
    const prefixes = prefixesOf(path);
    prefixes.forEach((prefix, index) =>
      claim(prefix, index < prefixes.length - 1)
    );
  }
  for (const path of seenFolders) {
    for (const prefix of prefixesOf(path)) claim(prefix, true);
  }
  for (const path of seenFiles) {
    if (folders.has(sameOnAnyFileSystem(path))) {
      throw new Error(
        `The path '${path}' is a file and also a folder of the file set.`
      );
    }
  }

  return {
    files: files
      .map(({ path, content }) => ({ path, content }))
      .sort((a, b) => compareOrdinal(a.path, b.path)),
    ownedFolders: [...ownedFolders].sort(compareOrdinal),
  };
}

/**
 * A reader that serves a file set from memory, for a push that has no file system (a test, a caller that holds a set it
 * made or fetched itself). The set is checked and copied by {@link buildFileSet} first, so what it serves cannot change
 * under the reader, and a set that holds a path twice or a file that is also a folder fails here, not later.
 *
 * - A directory exists when a file lies below it or it is an owned folder (or lies above one); an empty owned folder
 *   lists as `[]`.
 * - A listing gives the direct children only, sorted by name in ordinal order. A child that has files or folders below it is
 *   a directory.
 * - A directory that does not exist, and a file that does not exist, give `undefined`.
 * - A path that is not a path of a file set (including `''`: the root cannot be listed), a file asked for as a directory
 *   and a directory asked for as a file reject.
 * - A path is looked up as it is written: `A.json` is not `a.json`.
 * @param {VirtualFileSet} fileSet the set to serve
 * @returns {FileSetReader} the reader
 * @throws {Error} if the set is not one that {@link buildFileSet} accepts
 */
export function createMemoryFileSetReader(
  fileSet: VirtualFileSet
): FileSetReader {
  const built = buildFileSet(fileSet);
  const contents = new Map<string, string>();
  // a directory, to its children: name to isDirectory
  const directories = new Map<string, Map<string, boolean>>();
  const addDirectory = (path: string): Map<string, boolean> => {
    let children = directories.get(path);
    if (!children) {
      children = new Map<string, boolean>();
      directories.set(path, children);
    }
    return children;
  };
  const addPath = (path: string, isFolder: boolean): void => {
    const parts = path.split('/');
    parts.forEach((name, index) => {
      const isDirectory = isFolder || index < parts.length - 1;
      if (index > 0) {
        addDirectory(parts.slice(0, index).join('/')).set(name, isDirectory);
      }
      if (isDirectory) addDirectory(parts.slice(0, index + 1).join('/'));
    });
  };
  for (const { path, content } of built.files) {
    contents.set(path, content);
    addPath(path, false);
  }
  for (const folder of built.ownedFolders) addPath(folder, true);

  return {
    async listDirectory(path: string): Promise<FileSetEntry[] | undefined> {
      assertFileSetPath(path);
      if (contents.has(path)) {
        throw new Error(`The path '${path}' is a file, not a directory.`);
      }
      const children = directories.get(path);
      if (!children) return undefined;
      return [...children]
        .map(([name, isDirectory]) => ({ name, isDirectory }))
        .sort((a, b) => compareOrdinal(a.name, b.name));
    },
    async readFile(path: string): Promise<string | undefined> {
      assertFileSetPath(path);
      if (directories.has(path)) {
        throw new Error(`The path '${path}' is a directory, not a file.`);
      }
      return contents.get(path);
    },
  };
}
