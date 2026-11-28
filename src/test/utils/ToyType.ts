import {
  inRealm,
  mergeAndWriteList,
  mergeList,
  overridesOf,
  realmOfDir,
  realmsToVisit,
  splitList,
  unmatchedOverrides,
  type ListSpec,
  type RealmOverrides,
} from '../../ops/internal/FileSetEngine';
import {
  type LeftOutAttributesCallback,
  type PullFinding,
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
 * `realms/<realm>/toys/<name>.json`. It is written the way that the first real type will be, from the list functions of the
 * engine and the builder and nothing else, so the tests of the engine have a type to run through: `splitToys` is the pure split
 * of the toys of the realms into a file set and its findings, `pullToys` reads the toys of the realms and splits them,
 * `mergeToys` is the pure merge of a file set back into the toys of the realms, and `pushToys` merges and sends each toy
 * through a function that the caller passes in. The realms are the toy's own: the engine knows one folder, and the toy asks it
 * once for each realm. No tenant, no file system.
 */

/** One toy, as the tenant has it: it has an id and anything else. */
export type ToyObject = { _id: string; [key: string]: unknown };

/** A finding of the engine, and the realm of the toy that it is about: the engine knows one folder, the toy has one for each realm. */
export type ToyFinding = PullFinding & { realm: string };

/** What a split gives: the file set, and what the engine reported while it was made. */
export type ToySplit = {
  fileSet: VirtualFileSet;
  findings: ToyFinding[];
  unmatched: { realm: string; id: string }[];
};

/**
 * What the toy tells the engine about the toys of a realm: one folder for each realm, an id that never reaches a request (a toy
 * is never sent anywhere that builds a path from its id), and the names that encode every character of a path.
 * @param {string} realm the realm
 * @returns {ListSpec} the spec for the realm
 */
function toySpec(realm: string): ListSpec {
  return {
    folder: `realms/${realmFolderOf(realm)}/toys`,
    idPrefix: null,
    type: { key: 'toys' },
    nameOf: encodedName,
  };
}

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
 * The pure split of the toys of the realms into a file set, realm by realm through `splitList`. Ids are taken in ordinal order,
 * so the same toys give the same set whatever order the tenant answered in; a toy whose id leaves no file name, one whose name
 * another toy has, and an entry that is no toy, are findings and not written.
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
  const findings: ToyFinding[] = [];
  for (const realm of Object.keys(toys)) {
    visited.add(realm);
    const result = splitList({
      ...toySpec(realm),
      objects: toys[realm],
      keepRev: false,
      keepModifiedProperties: true,
      overridesFor: (id) => overridesOf(overrides, realm, id, matched),
    });
    files.push(...result.fileSet.files);
    ownedFolders.push(...result.fileSet.ownedFolders);
    findings.push(...result.findings.map((finding) => ({ ...finding, realm })));
  }
  return {
    fileSet: buildFileSet({ files, ownedFolders }),
    findings,
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

/**
 * The realms of a file set that a pull or a push visits: the realm that was asked for, or the folders below `realms`.
 * @param {FileSetReader} reader the reader of the file set
 * @param {string} realm the realm to read, if one was asked for
 * @param {State} state the state
 * @returns {Promise<string[]>} the realms
 */
async function toyRealmsOf({
  reader,
  realm,
  state,
}: {
  reader: FileSetReader;
  realm?: string;
  state: State;
}): Promise<string[]> {
  return realmsToVisit({
    realm,
    realmNames: async () =>
      ((await reader.listDirectory('realms')) ?? [])
        .filter((entry) => entry.isDirectory)
        .map((entry) => realmOfDir(entry.name)),
    state,
  });
}

/**
 * The merge of a file set into the toys of each realm that it holds: the realms are the folders below `realms`, a toy is
 * the id of its file (`_id`) and the rest of the file, placeholders filled from the state. The toys of a realm are in the
 * order of their ids, whatever the files are called. A file that cannot be read, holds no `_id`, or holds an id that another
 * file holds, fails the merge with the error that the engine gave for the file.
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
  for (const visit of await toyRealmsOf({ reader, realm, state })) {
    const read: ToyObject[] = [];
    for (const file of await mergeList({
      ...toySpec(visit),
      reader,
      state,
    })) {
      if (file.error) throw file.error;
      read.push(file.object as ToyObject);
    }
    read.sort((a, b) => compareOrdinal(a._id, b._id));
    entries.push([visit, read]);
  }
  return Object.fromEntries(entries);
}

/**
 * Push the toys: send each toy of the file set through `importToy`, in its realm. Every file is one object of the run, so a
 * file that cannot be read (a placeholder that has no value, text that is not JSON, no `_id`) and a toy that the server
 * refuses fail only themselves, and the others go on. The id of a toy is the `_id` of its file, never its name: the toys
 * are sent in the order of their ids, whatever the files are called, and a file that cannot be read has its path for an id.
 * @param {FileSetReader} reader the reader of the file set
 * @param {(realm: string, toy: ToyObject, leftOutCallback?: LeftOutAttributesCallback) => Promise<ToyObject>} importToy sends one toy to the tenant, in the realm that the state is set to
 * @param {string} realm the realm to push, if one was asked for
 * @param {ResultCallback<ToyObject>} resultCallback Optional. Called once for every toy
 * @param {LeftOutAttributesCallback} leftOutCallback Optional. Passed on to `importToy`
 * @param {State} state the state
 * @returns {Promise<PushOutcome[]>} one outcome for every file, realm by realm, in the order of the ids; the id is the `_id` of the file, or its path when it could not be read
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
  for (const visit of await toyRealmsOf({ reader, realm, state })) {
    outcomes.push(
      ...(await inRealm({
        realm: visit,
        state,
        work: () =>
          mergeAndWriteList({
            ...toySpec(visit),
            reader,
            state,
            write: (toy, _id, leftOut) =>
              importToy(visit, toy as ToyObject, leftOut),
            resultCallback,
            leftOutCallback,
          }),
      }))
    );
  }
  return outcomes;
}
