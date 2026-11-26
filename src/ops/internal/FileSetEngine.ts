import Constants from '../../shared/Constants';
import { type State } from '../../shared/State';
import {
  escapePlaceholders,
  parseExportJson,
  serializeExportJson,
} from '../../utils/ExportFileFormatUtils';
import {
  getErrorCallback,
  replaceEnvSpecificValues,
} from '../../utils/ExportImportUtils';
import { fileNameOf, sameOnAnyFileSystem } from '../../utils/FileSetPathUtils';
import { type FileSetReader, type VirtualFile } from '../../utils/FileSetUtils';
import { cloneDeep, mergeDeep } from '../../utils/JsonUtils';
import { FrodoError } from '../FrodoError';
import {
  type LeftOutAttributesCallback,
  type PushOutcome,
  type ResultCallback,
} from '../OpsTypes';

/**
 * The parts of a pull to a file set and a push from one that do not depend on the configuration type: which realms to
 * visit, the file name of every object, the overrides, reading a file of a file set, writing an object to one, and running a
 * push object by object. A type passes in what differs (what to read from the tenant, what to write to it, how the files of
 * the type are named) and the rules of the family are written once.
 *
 * The engine does not print, reads no file (a file set is read through a {@link FileSetReader} that the caller gives it) and
 * knows nothing about a command line. It reaches the tenant only through what the caller passes in.
 */

/**
 * The overrides of the objects of a type: for each realm, the objects that get overrides. An entry names an object by its
 * id and holds the values to merge into the object.
 */
export type RealmOverrides = Record<
  string,
  { id: string; overrides?: Record<string, unknown> }[]
>;

/**
 * Whether the realm that was asked for is the root realm of a Cloud deployment, which has no configuration of these types: it
 * is answered and not visited.
 * @param {string} realm the realm that was asked for, if any
 * @param {State} state the state, which knows the deployment type
 * @returns {boolean} true for `/` on Cloud
 */
export function isCloudRootRealm({
  realm,
  state,
}: {
  realm?: string;
  state: State;
}): boolean {
  return (
    realm === '/' &&
    state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY
  );
}

/**
 * The realms that a pull or a push visits: the realm that was asked for, or every realm of the deployment. The root realm
 * of a Cloud deployment is left out, as it has no realm configuration and a request for it would be refused.
 * @param {string} realm the realm that was asked for; none, or the default key, means every realm
 * @param {() => Promise<string[]>} realmNames gives the names of every realm of the deployment; it is called only when no realm was asked for, because the engine reads no tenant
 * @param {State} state the state, which knows the deployment type
 * @returns {Promise<string[]>} the realms, in the order given
 */
export async function realmsToVisit({
  realm,
  realmNames,
  state,
}: {
  realm?: string;
  realmNames: () => Promise<string[]>;
  state: State;
}): Promise<string[]> {
  const realms =
    realm && realm !== Constants.DEFAULT_REALM_KEY
      ? [realm]
      : await realmNames();
  return state.getDeploymentType() === Constants.CLOUD_DEPLOYMENT_TYPE_KEY
    ? realms.filter((r) => r !== '/')
    : realms;
}

/**
 * Run work with the state set to a realm, and put the realm of the caller back afterwards, whether the work succeeded or
 * threw. Without it a failure in the loop over realms leaves the state on the realm that was being visited, and every
 * later call on the same state goes to the wrong realm (frodo-lib#838).
 * @param {string} realm the realm to work in
 * @param {State} state the state
 * @param {() => Promise<R>} work the work
 * @returns {Promise<R>} what the work gives
 */
export async function inRealm<R>({
  realm,
  state,
  work,
}: {
  realm: string;
  state: State;
  work: () => Promise<R>;
}): Promise<R> {
  const callersRealm = state.getRealm();
  state.setRealm(realm);
  try {
    return await work();
  } finally {
    state.setRealm(callersRealm);
  }
}

/**
 * The file names of objects that are written to one folder. Two ids whose names are the same on a file system that ignores
 * case or Unicode form (and two long ids that are cut to one name) collide: the first id keeps the name and the later ones
 * are reported. An id for which the name function throws gets no name: it is reported as refused, with the error, and never
 * thrown, so one id that leaves no name does not stop the others. Only what the name function throws is refused here: a
 * name that passes it can still make a path that `assertFileSetPath` refuses (a name of 251 to 255 bytes with its extension,
 * a lone surrogate), and `buildFileSet` then throws for the whole set. The ids are taken in the order they are given: a
 * caller that wants the same names whatever order the tenant answers in sorts them first (`compareOrdinal`).
 * @param {string[]} ids the ids, in the order they are written
 * @param {(id: string) => string} nameOf gives the file name of an id, without the extension; the name that the agent types use by default
 * @returns {{ names: Map<string, string>; collisions: { id: string; firstId: string }[]; refused: { id: string; error: Error }[] }} the file name of each id that has one, the ids that collide with an earlier one, and the ids that have no name
 */
export function assignFileNames(
  ids: string[],
  nameOf: (id: string) => string = fileNameOf
): {
  names: Map<string, string>;
  collisions: { id: string; firstId: string }[];
  refused: { id: string; error: Error }[];
} {
  const names = new Map<string, string>();
  const collisions: { id: string; firstId: string }[] = [];
  const refused: { id: string; error: Error }[] = [];
  const taken = new Map<string, string>();
  for (const id of ids) {
    let name: string;
    try {
      name = nameOf(id);
    } catch (error) {
      refused.push({
        id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      continue;
    }
    const key = sameOnAnyFileSystem(name);
    const firstId = taken.get(key);
    if (firstId !== undefined) {
      collisions.push({ id, firstId });
      continue;
    }
    taken.set(key, id);
    names.set(id, name);
  }
  return { names, collisions, refused };
}

/** The key under which a matched overrides entry is remembered. */
const entryKey = (realm: string, id: string): string =>
  `${realm}\u0000${id.toLowerCase()}`;

/**
 * The overrides of one object. An id matches ignoring case, because the servers of these types hold one object for ids that
 * differ only in case.
 * @param {RealmOverrides | undefined} entries the overrides, if there are any
 * @param {string} realm the realm of the object
 * @param {string} id the id of the object
 * @param {Set<string>} matched remembers which entries were used, for {@link unmatchedOverrides}
 * @returns {Record<string, unknown> | undefined} the overrides to merge into the object, if its entry has any
 */
export function overridesOf(
  entries: RealmOverrides | undefined,
  realm: string,
  id: string,
  matched: Set<string>
): Record<string, unknown> | undefined {
  // an own entry only: `constructor`, `toString` and `__proto__` are names of realms like any other, not members that every object has
  const own =
    entries && Object.hasOwn(entries, realm) ? entries[realm] : undefined;
  const entry = own?.find(
    (candidate) => candidate.id.toLowerCase() === id.toLowerCase()
  );
  if (!entry) return undefined;
  matched.add(entryKey(realm, entry.id));
  return entry.overrides;
}

/**
 * The entries of the overrides that matched no object. This is the only accounting that the engine does: what it tells the
 * caller is for the caller to say.
 * @param {RealmOverrides | undefined} entries the overrides, if there are any
 * @param {Set<string>} matched what {@link overridesOf} remembered
 * @param {Set<string>} visited the realms that were looked at; an entry of a realm that was not visited is not reported
 * @returns {{ realm: string; id: string }[]} the entries that were not used
 */
export function unmatchedOverrides(
  entries: RealmOverrides | undefined,
  matched: Set<string>,
  visited: Set<string>
): { realm: string; id: string }[] {
  const unmatched: { realm: string; id: string }[] = [];
  for (const [realm, list] of Object.entries(entries ?? {})) {
    if (!visited.has(realm)) continue;
    for (const entry of list) {
      if (!matched.has(entryKey(realm, entry.id))) {
        unmatched.push({ realm, id: entry.id });
      }
    }
  }
  return unmatched;
}

/**
 * Merge overrides into an object. A scalar, an object or `null` in the overrides replaces what the object has under that
 * key, and the arrays of the two merge by position and are never shortened (the rules of `frodo.utils.json.mergeDeep`).
 * Both arguments are copied first and neither is changed, and what is returned shares nothing with either.
 * @param {Record<string, unknown>} object the object, which is JSON data
 * @param {Record<string, unknown> | undefined} overrides the values to merge in, if there are any
 * @returns {Record<string, unknown>} a new object
 */
export function applyOverrides(
  object: Record<string, unknown>,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  const copy = cloneDeep(object);
  return overrides === undefined ? copy : mergeDeep(copy, cloneDeep(overrides));
}

/**
 * The id of an object whose file has no id of its own: the name of the file without `.json`, decoded, because the names of
 * the files of a pull write what a file system cannot hold as `%XX`. A name that does not decode is the id as it is.
 * @param {string} fileName the name of the file
 * @returns {string} the id
 */
export function idOfFile(fileName: string): string {
  const name = fileName.replace(/\.json$/, '');
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/**
 * The realm that the folder of a realm in a file set stands for.
 * @param {string} dir the name of the folder
 * @returns {string} the realm, as the state names it: `/` for `root`
 */
export function realmOfDir(dir: string): string {
  return dir === 'root' ? '/' : dir;
}

/**
 * Read a JSON file of a file set and fill its placeholders: the values that the state holds (and, only when the state's
 * switch is on, the variables of the process) and `BASE64:` values, and the escaped `\\${` stays as it was written. A
 * placeholder that has no value fails with an error that names the placeholder and never shows a value.
 * @param {FileSetReader} reader the reader of the file set
 * @param {string} path the path of the file
 * @param {State} state the state, which holds the values of the placeholders
 * @returns {Promise<object | undefined>} the data of the file, or undefined when the file does not exist
 * @throws {FrodoError} if the file cannot be read ("Error reading file"), a placeholder has no value, or the text is not JSON ("Error parsing JSON from")
 */
export async function readFileSetJson({
  reader,
  path,
  state,
}: {
  reader: FileSetReader;
  path: string;
  state: State;
}): Promise<object | undefined> {
  let content: string | undefined;
  try {
    content = await reader.readFile(path);
  } catch (error) {
    throw new FrodoError(`Error reading file ${path}`, error);
  }
  if (content === undefined) return undefined;
  const resolved = replaceEnvSpecificValues({ content, state });
  try {
    return parseExportJson(resolved);
  } catch (error) {
    throw new FrodoError(`Error parsing JSON from ${path}`, error);
  }
}

/**
 * The file that an object is written to, as a pull writes it: every `${` in the object is escaped, so that a push does not
 * take it for a placeholder (the values that the state holds for placeholders are never put into a file); the keys are
 * sorted at every depth; `_rev` is left out and the modified properties are kept; the text ends with a newline. Without
 * overrides the object is escaped as it is. With overrides they are merged in after the escaping and written as they are, so
 * that a `${NAME}` in an override stays a placeholder for a push to fill. The object and the overrides are not changed.
 * @param {string} path the path of the file in the file set
 * @param {object} object the object to write, which is JSON data
 * @param {Record<string, unknown> | undefined} overrides the overrides of the object, if it has any
 * @returns {VirtualFile} the file
 */
export function fileOfObject({
  path,
  object,
  overrides,
}: {
  path: string;
  object: object;
  overrides?: Record<string, unknown>;
}): VirtualFile {
  const escaped = escapePlaceholders(object) as Record<string, unknown>;
  const data =
    overrides === undefined ? escaped : applyOverrides(escaped, overrides);
  return {
    path,
    content: serializeExportJson({
      data,
      metadata: {},
      includeMeta: false,
      keepRev: false,
      keepModifiedProperties: true,
    }),
  };
}

/**
 * Run work for every object, one after the other, and say what became of each. Every object runs: a throw is the failure of
 * that object, wrapped in a `FrodoError` that keeps the cause, and the others still run. What the caller can rely on:
 * - The result holds one outcome for every object, in the order the objects were given. An outcome has an `error` when the
 *   work threw, and only then.
 * - `resultCallback` is told once for every object how its work ended: `(error)` after a throw, `(undefined, result)` after
 *   a return. It is told more than once for an object whose work reports through the `errorCallback` that it was given: the
 *   error goes to `resultCallback(error)` at that moment and the work goes on, and when it returns, `resultCallback` is told
 *   `(undefined, result)` as for any success, and the outcome of that object has no error. A caller that makes an exit code from
 *   the outcomes alone does not see such a failure of a part: it counts the errors that its callback was told as well.
 * - Without a `resultCallback`, the `errorCallback` throws the error it is given, so the work ends and the failure is the
 *   object's: it is in the outcome.
 * - A `resultCallback` that throws ends the run: that is the caller's code and not the object's, so the objects after it do
 *   not run and the function rejects with that error (the outcomes so far are not returned).
 *
 * The work is also given the `leftOutCallback` as it was passed in; the engine counts and prints nothing.
 * @param {T[]} objects the objects, each with its id
 * @param {(arguments: { object: T; errorCallback: ResultCallback<unknown>; leftOutCallback?: LeftOutAttributesCallback }) => Promise<R>} work what to do with one object; its result goes to the callback
 * @param {ResultCallback<R>} resultCallback Optional. Told how the work of every object ended, and of every error that the work gave to its `errorCallback`
 * @param {LeftOutAttributesCallback} leftOutCallback Optional. Passed on to the work
 * @returns {Promise<PushOutcome[]>} one outcome for every object, in the order the objects were given
 */
export async function runPerObject<T extends { id: string }, R>({
  objects,
  work,
  resultCallback,
  leftOutCallback,
}: {
  objects: T[];
  work: (parameters: {
    object: T;
    errorCallback: ResultCallback<unknown>;
    leftOutCallback?: LeftOutAttributesCallback;
  }) => Promise<R>;
  resultCallback?: ResultCallback<R>;
  leftOutCallback?: LeftOutAttributesCallback;
}): Promise<PushOutcome[]> {
  const errorCallback = getErrorCallback<R, unknown>(resultCallback);
  const outcomes: PushOutcome[] = [];
  for (const object of objects) {
    let result: R | undefined;
    let failure: FrodoError | undefined;
    try {
      result = await work({ object, errorCallback, leftOutCallback });
    } catch (error) {
      failure = new FrodoError(
        `Error processing ${object.id}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
    if (failure) {
      outcomes.push({ id: object.id, error: failure });
      resultCallback?.(failure);
    } else {
      outcomes.push({ id: object.id });
      resultCallback?.(undefined, result);
    }
  }
  return outcomes;
}
