import {
  assignFileNames,
  fileOfObject,
  idOfFile,
  inRealm,
  overridesOf,
  readFileSetJson,
  realmOfDir,
  realmsToVisit,
  runPerObject,
  unmatchedOverrides,
  type RealmOverrides,
} from '../../ops/internal/FileSetEngine';
import {
  type LeftOutAttributesCallback,
  type PushOutcome,
  type ResultCallback,
} from '../../ops/OpsTypes';
import { type State } from '../../shared/State';
import { encodedName, realmFolderOf } from '../../utils/FileSetPathUtils';
import {
  buildFileSet,
  compareOrdinal,
  type FileSetReader,
  type VirtualFile,
  type VirtualFileSet,
} from '../../utils/FileSetUtils';

/**
 * A configuration type that exists only for the tests: a toy, one JSON file for each toy in the folder of its realm,
 * `realms/<realm>/toys/<name>.json`. It is written the way that the first real type will be, from the functions of the engine
 * and the builder and nothing else, so the tests of the engine have a type to run through: `splitToys` is the pure split of
 * the toys of the realms into a file set, `pullToys` reads the toys of the realms and splits them, `mergeToys` is the pure
 * merge of a file set back into the toys of the realms, and `pushToys` merges and sends each toy through a function that the
 * caller passes in. No tenant, no file system.
 */

/** One toy, as the tenant has it: it has an id and anything else. */
export type ToyObject = { _id: string; [key: string]: unknown };

/** What a split gives: the file set, and what the engine reported while it was made. */
export type ToySplit = {
  fileSet: VirtualFileSet;
  collisions: { realm: string; id: string; firstId: string }[];
  refused: { realm: string; id: string; error: Error }[];
  unmatched: { realm: string; id: string }[];
};

/**
 * The toys of the realms as they are on the tenant, and what a split of them must give (the golden folder
 * `src/test/golden/toy` holds the files, written by hand).
 */
export const TOY_TENANT: Record<string, ToyObject[]> = {
  alpha: [
    {
      _id: 'a/b',
      _rev: '3',
      name: 'Slash',
      script: 'return "${notAPlaceholder}";',
    },
    {
      _id: 'Login',
      _rev: '1',
      name: 'Login',
      description: 'Plain',
      size: 3,
      modifiedDate: 1700000000000,
      tags: ['b', 'a'],
    },
    { _id: 'Zion', _rev: '2', nested: { z: 1, a: 2 } },
  ],
  bravo: [{ _id: 'Login', _rev: '4', name: 'Bravo login' }],
};

/**
 * The pure split of the toys of the realms into a file set. Ids are taken in ordinal order, so the same toys give the same
 * set whatever order the tenant answered in; a toy whose id leaves no file name, and one whose name another toy has, are
 * reported and not written.
 * @param {Record<string, ToyObject[]>} toys the toys of each realm
 * @param {RealmOverrides} overrides the overrides, if there are any
 * @returns {ToySplit} the file set and what was reported
 */
export function splitToys({
  toys,
  overrides,
}: {
  toys: Record<string, ToyObject[]>;
  overrides?: RealmOverrides;
}): ToySplit {
  const files: VirtualFile[] = [];
  const ownedFolders: string[] = [];
  const matched = new Set<string>();
  const visited = new Set<string>();
  const collisions: ToySplit['collisions'] = [];
  const refused: ToySplit['refused'] = [];
  for (const realm of Object.keys(toys)) {
    visited.add(realm);
    const folder = `realms/${realmFolderOf(realm)}/toys`;
    ownedFolders.push(folder);
    const sorted = [...toys[realm]].sort((a, b) =>
      compareOrdinal(a._id, b._id)
    );
    const named = assignFileNames(
      sorted.map((toy) => toy._id),
      encodedName
    );
    for (const { id, firstId } of named.collisions) {
      collisions.push({ realm, id, firstId });
    }
    for (const { id, error } of named.refused) {
      refused.push({ realm, id, error });
    }
    for (const toy of sorted) {
      const name = named.names.get(toy._id);
      if (name === undefined) continue;
      files.push(
        fileOfObject({
          path: `${folder}/${name}.json`,
          object: toy,
          overrides: overridesOf(overrides, realm, toy._id, matched),
        })
      );
    }
  }
  return {
    fileSet: buildFileSet({ files, ownedFolders }),
    collisions,
    refused,
    unmatched: unmatchedOverrides(overrides, matched, visited),
  };
}

/**
 * Pull the toys: read the toys of every realm that is visited, in that realm, and split them.
 * @param {(realm: string) => Promise<ToyObject[]>} readToys reads the toys of the realm that the state is set to
 * @param {() => Promise<string[]>} realmNames gives the realms of the deployment
 * @param {string} realm the realm to pull, if one was asked for
 * @param {RealmOverrides} overrides the overrides, if there are any
 * @param {State} state the state
 * @returns {Promise<ToySplit>} the file set and what was reported
 */
export async function pullToys({
  readToys,
  realmNames,
  realm,
  overrides,
  state,
}: {
  readToys: (realm: string) => Promise<ToyObject[]>;
  realmNames: () => Promise<string[]>;
  realm?: string;
  overrides?: RealmOverrides;
  state: State;
}): Promise<ToySplit> {
  // `Object.fromEntries` makes an own property for every name, `__proto__` and `constructor` included: `toys[name] = ...` would not
  const entries: [string, ToyObject[]][] = [];
  for (const visit of await realmsToVisit({ realm, realmNames, state })) {
    entries.push([
      visit,
      await inRealm({ realm: visit, state, work: () => readToys(visit) }),
    ]);
  }
  return splitToys({ toys: Object.fromEntries(entries), overrides });
}

/** The files of the toys of each realm that a reader holds, in the order of the listing. */
type ToyFiles = { realm: string; folder: string; names: string[] }[];

/**
 * The folders of the toys of the realms to visit and the files in them: the realms are the folders below `realms`.
 * @param {FileSetReader} reader the reader of the file set
 * @param {string} realm the realm to read, if one was asked for
 * @param {State} state the state
 * @returns {Promise<ToyFiles>} the realms and their files
 */
async function toyFilesOf({
  reader,
  realm,
  state,
}: {
  reader: FileSetReader;
  realm?: string;
  state: State;
}): Promise<ToyFiles> {
  const realms = await realmsToVisit({
    realm,
    realmNames: async () =>
      ((await reader.listDirectory('realms')) ?? [])
        .filter((entry) => entry.isDirectory)
        .map((entry) => realmOfDir(entry.name)),
    state,
  });
  const found: ToyFiles = [];
  for (const visit of realms) {
    const folder = `realms/${realmFolderOf(visit)}/toys`;
    const entries = (await reader.listDirectory(folder)) ?? [];
    found.push({
      realm: visit,
      folder,
      names: entries
        .filter((entry) => !entry.isDirectory && entry.name.endsWith('.json'))
        .map((entry) => entry.name),
    });
  }
  return found;
}

/**
 * Read one toy of a file set: the id is the `_id` of the file, or the id that the name of the file stands for.
 * @param {FileSetReader} reader the reader of the file set
 * @param {string} path the path of the file
 * @param {State} state the state, which holds the values of the placeholders
 * @returns {Promise<ToyObject>} the toy
 */
async function readToy({
  reader,
  path,
  state,
}: {
  reader: FileSetReader;
  path: string;
  state: State;
}): Promise<ToyObject> {
  const object = (await readFileSetJson({ reader, path, state })) as Record<
    string,
    unknown
  >;
  return {
    ...object,
    _id: String(object._id ?? idOfFile(path.slice(path.lastIndexOf('/') + 1))),
  };
}

/**
 * The merge of a file set into the toys of each realm that it holds: the realms are the folders below `realms`, a toy is
 * the id of its file (`_id`) and the rest of the file, placeholders filled from the state. A file that cannot be read
 * fails the merge.
 * @param {FileSetReader} reader the reader of the file set
 * @param {string} realm the realm to read, if one was asked for
 * @param {State} state the state
 * @returns {Promise<Record<string, ToyObject[]>>} the toys of each realm
 */
export async function mergeToys({
  reader,
  realm,
  state,
}: {
  reader: FileSetReader;
  realm?: string;
  state: State;
}): Promise<Record<string, ToyObject[]>> {
  const entries: [string, ToyObject[]][] = [];
  for (const found of await toyFilesOf({ reader, realm, state })) {
    const read: ToyObject[] = [];
    for (const name of found.names) {
      read.push(
        await readToy({ reader, path: `${found.folder}/${name}`, state })
      );
    }
    entries.push([found.realm, read]);
  }
  return Object.fromEntries(entries);
}

/**
 * Push the toys: send each toy of the file set through `importToy`, in its realm. Every file is one object of the run, so a
 * file that cannot be read (a placeholder that has no value, text that is not JSON) and a toy that the server refuses fail
 * only themselves, and the others go on.
 * @param {FileSetReader} reader the reader of the file set
 * @param {(realm: string, toy: ToyObject, leftOutCallback?: LeftOutAttributesCallback) => Promise<ToyObject>} importToy sends one toy to the tenant, in the realm that the state is set to
 * @param {string} realm the realm to push, if one was asked for
 * @param {ResultCallback<ToyObject>} resultCallback Optional. Called once for every toy
 * @param {LeftOutAttributesCallback} leftOutCallback Optional. Passed on to `importToy`
 * @param {State} state the state
 * @returns {Promise<PushOutcome[]>} one outcome for every file, realm by realm; the id is the one that the name of the file stands for
 */
export async function pushToys({
  reader,
  importToy,
  realm,
  resultCallback,
  leftOutCallback,
  state,
}: {
  reader: FileSetReader;
  importToy: (
    realm: string,
    toy: ToyObject,
    leftOutCallback?: LeftOutAttributesCallback
  ) => Promise<ToyObject>;
  realm?: string;
  resultCallback?: ResultCallback<ToyObject>;
  leftOutCallback?: LeftOutAttributesCallback;
  state: State;
}): Promise<PushOutcome[]> {
  const outcomes: PushOutcome[] = [];
  for (const found of await toyFilesOf({ reader, realm, state })) {
    outcomes.push(
      ...(await inRealm({
        realm: found.realm,
        state,
        work: () =>
          runPerObject({
            objects: found.names.map((name) => ({
              id: idOfFile(name),
              path: `${found.folder}/${name}`,
            })),
            work: async ({ object, leftOutCallback: leftOut }) =>
              importToy(
                found.realm,
                await readToy({ reader, path: object.path, state }),
                leftOut
              ),
            resultCallback,
            leftOutCallback,
          }),
      }))
    );
  }
  return outcomes;
}
