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
import {
  fileNameOf,
  nameInFolder,
  sameOnAnyFileSystem,
} from '../../utils/FileSetPathUtils';
import {
  buildFileSet,
  compareOrdinal,
  type FileSetReader,
  type VirtualFile,
  type VirtualFileSet,
} from '../../utils/FileSetUtils';
import { cloneDeep, mergeDeep } from '../../utils/JsonUtils';
import { isRequestSegment } from '../../utils/RequestPathUtils';
import { FrodoError } from '../FrodoError';
import {
  type ConfigTypeDescriptor,
  type LeftOutAttributesCallback,
  type PullFinding,
  type PullResult,
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
 * case or Unicode form collide: the first id keeps the name and the later ones are reported. The name functions of
 * `FileSetPathUtils` give a name that fits in a file name to every id that has a name: an id that was not a valid file name
 * with its suffix, or that is not text (a lone surrogate, U+007F), gets a shortened name, the start of its name and a checksum
 * of the complete id, so long ids that start alike have their own names. Two ids can still collide, when the cut and the 8
 * hexadecimal characters of the checksum are both the same (about one pair in four billion that shares a cut), and when an id
 * is written like the shortened name of another (`a` repeated 241 times and `~e8722168` is the name of `a` repeated 300
 * times, and it is also an id of 250 bytes that keeps its name): the first id keeps the name, the other is reported as a
 * collision, and nothing is renamed or written for it, so a name never depends on the other ids. An id for which the name
 * function throws gets no name: it is reported as refused, with the error, and never thrown, so one id that leaves no name
 * does not stop the others. The ids are taken in the order they are given: a caller that wants the same names whatever order
 * the tenant answers in sorts them first (`compareOrdinal`).
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
 * The realm that the folder of a realm in a file set stands for.
 * @param {string} dir the name of the folder
 * @returns {string} the realm, as the state names it: `/` for `root`
 */
export function realmOfDir(dir: string): string {
  return dir === 'root' ? '/' : dir;
}

/**
 * Read the content of a file of a file set through the reader, without looking at what it is.
 * @param {FileSetReader} reader the reader of the file set
 * @param {string} path the path of the file
 * @returns {Promise<unknown>} what the reader gave: the text of the file, or undefined when the file does not exist
 * @throws {FrodoError} if the reader fails ("Error reading file")
 */
async function readFileSetContent(
  reader: FileSetReader,
  path: string
): Promise<unknown> {
  try {
    return await reader.readFile(path);
  } catch (error) {
    throw new FrodoError(`Error reading file ${path}`, error);
  }
}

/**
 * The text of a file, from what the reader gave: a reader gives text or nothing, and anything else breaks its contract, so what
 * it gave is not shown.
 * @param {unknown} content what the reader gave for the file
 * @param {string} path the path of the file
 * @returns {string} the text
 * @throws {FrodoError} if the reader gave something that is not text ("The reader did not return text for")
 */
function textOfContent(content: unknown, path: string): string {
  if (typeof content !== 'string') {
    throw new FrodoError(`The reader did not return text for ${path}.`);
  }
  return content;
}

/**
 * Fill the placeholders of the text of a file and parse it.
 * @param {string} content the text of the file
 * @param {string} path the path of the file
 * @param {State} state the state, which holds the values of the placeholders
 * @returns {object} the data of the file, with the placeholders filled
 * @throws {FrodoError} if a placeholder has no value, or the text is not JSON ("Error parsing JSON from")
 */
function parseFileSetText(content: string, path: string, state: State): object {
  const resolved = replaceEnvSpecificValues({ content, state });
  try {
    return parseExportJson(resolved);
  } catch (error) {
    throw new FrodoError(`Error parsing JSON from ${path}`, error);
  }
}

/**
 * Read a JSON file of a file set and fill its placeholders: the values that the state holds (and, only when the state's
 * switch is on, the variables of the process) and `BASE64:` values, and the escaped `\\${` stays as it was written. A
 * placeholder that has no value fails with an error that names the placeholder and never shows a value.
 * @param {FileSetReader} reader the reader of the file set
 * @param {string} path the path of the file
 * @param {State} state the state, which holds the values of the placeholders
 * @returns {Promise<object | undefined>} the data of the file, or undefined when the file does not exist
 * @throws {FrodoError} if the file cannot be read ("Error reading file"), the reader gives something that is not text ("The reader did not return text for"), a placeholder has no value, or the text is not JSON ("Error parsing JSON from")
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
  const content = await readFileSetContent(reader, path);
  if (content === undefined) return undefined;
  return parseFileSetText(textOfContent(content, path), path, state);
}

/**
 * The file that an object is written to, as a pull writes it: every `${` in the object is escaped, so that a push does not
 * take it for a placeholder (the values that the state holds for placeholders are never put into a file); the keys are
 * sorted at every depth; the text ends with a newline. `_rev` is left out unless `keepRev` is set, and the modified
 * properties are kept unless `keepModifiedProperties` is false: the defaults are the rules of the agent files, and a type
 * whose files follow other rules passes what differs. Without overrides the object is escaped as it is. With overrides they
 * are merged in after the escaping and written as they are, so that a `${NAME}` in an override stays a placeholder for a push
 * to fill; the two options apply to the merged object. The object and the overrides are not changed.
 * @param {string} path the path of the file in the file set
 * @param {object} object the object to write, which is JSON data
 * @param {Record<string, unknown> | undefined} overrides the overrides of the object, if it has any
 * @param {boolean} keepRev true to keep the `_rev` keys. Default: false
 * @param {boolean} keepModifiedProperties false to leave out the modified properties (`lastModifiedBy`, `lastModifiedDate`, `modified`, `modifiedDate`, `lastChangeDate`, `lastChangedBy`, `lastChanged`, `createdBy`, `creationDate`, `createdDate`) at every depth. Default: true, the rule of the agent files; {@link splitSingleton} has the opposite default (false, the rule of the files of the single-object types), so a type that writes a file with this function passes the option it means
 * @returns {VirtualFile} the file
 */
export function fileOfObject({
  path,
  object,
  overrides,
  keepRev = false,
  keepModifiedProperties = true,
}: {
  path: string;
  object: object;
  overrides?: Record<string, unknown>;
  keepRev?: boolean;
  keepModifiedProperties?: boolean;
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
      keepRev,
      keepModifiedProperties,
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
 * - A throw ends the run only when it comes from a call that the engine makes itself: a `resultCallback` that throws, after a
 *   success or after a failure, is the caller's code and not the object's, so the objects after it do not run and the function
 *   rejects with that error (the outcomes so far are not returned). A throw from the call that the `errorCallback` makes inside
 *   the work is a throw of the work: it is the failure of that object (wrapped, with the callback's error as its cause), the
 *   callback is told of it as of any other failure, and the run goes on.
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

/**
 * The folders that a type owns when it keeps its one object in a single file: the folder that the file lies in. A file at
 * the root of the set has no folder, so the type owns none: the file is the whole of what the type owns, and a consumer that
 * cleans owned folders has nothing to remove for it.
 * @param {string} path the path of the file in the file set
 * @returns {string[]} the owned folders: the folder of the file, or none for a file at the root
 */
export function ownedFoldersOf(path: string): string[] {
  const end = path.lastIndexOf('/');
  return end === -1 ? [] : [path.slice(0, end)];
}

/**
 * What a type that has exactly one object, kept in one file, passes to the functions below: where the file is, and what the
 * object is called. The object is the type: it has one id, which is a constant of the type and is never read from a file
 * name, and a push refuses a file that names another.
 * @property {string} path the path of the file in the file set
 * @property {string} id the id of the one object of the type
 * @property {string | null} idKey the key of the object that holds its id: `_id` unless said otherwise, and `null` for a type whose object holds no id (the file is then taken as it is)
 */
export type SingletonSpec = {
  path: string;
  id: string;
  idKey?: string | null;
};

/**
 * Split the one object of a type into a file set of one file. The file is written by the rules of the files of a
 * single-object type: `_rev` and the modified properties are left out unless the type keeps them, the keys are in order,
 * every `${` is escaped and the text ends with a newline. The object is not changed.
 * @param {object} object the object, as the tenant has it
 * @param {string} path the path of the file in the file set; the folder it lies in is owned by the set (none for a file at the root)
 * @param {boolean} keepRev true if the file keeps the `_rev` keys. Default: false
 * @param {boolean} keepModifiedProperties true if the file keeps the modified properties. Default: false, the rule of the files of the single-object types; {@link fileOfObject} has the opposite default (true, the rule of the agent files), because the files of the types that call it first were written that way
 * @returns {VirtualFileSet} the file set
 * @throws {Error} if the path is not a path of a file set
 */
export function splitSingleton({
  object,
  path,
  keepRev = false,
  keepModifiedProperties = false,
}: {
  object: object;
  path: string;
  keepRev?: boolean;
  keepModifiedProperties?: boolean;
}): VirtualFileSet {
  return buildFileSet({
    files: [fileOfObject({ path, object, keepRev, keepModifiedProperties })],
    ownedFolders: ownedFoldersOf(path),
  });
}

/**
 * Merge the file of a single-object type back into its object. Only the one file is asked for, and the id of the object
 * is the one that the file holds, compared with the id of the type exactly (no case folding, no trimming, no Unicode
 * normalisation) after the placeholders of the file are filled: a file that names another id is refused, so that a file set
 * cannot point a push at another object (an id such as `../managed/x` would be a request to another path). The message of
 * the refusal names the path and the id of the type and never the id that the file holds, which can be the value of a
 * placeholder. The name of the file is never read. A type that keeps the id of its objects in a file that is a list of
 * them has no constant to compare with, and decides for itself how such an id is checked.
 * @param {FileSetReader} reader the reader of the file set
 * @param {string} path the path of the file in the file set
 * @param {string} id the id of the one object of the type
 * @param {string | null} idKey the key of the object that holds its id: `_id` unless said otherwise; `null` for a type whose object holds none. Default: `_id`
 * @param {State} state the state, which holds the values of the placeholders
 * @returns {Promise<object>} the object, with the placeholders filled
 * @throws {FrodoError} if the file is not there or cannot be read, a placeholder has no value, the text is not JSON, the file holds no object, holds no id that is a text, or holds the id of another object
 */
export async function mergeSingleton({
  reader,
  path,
  id,
  idKey = '_id',
  state,
}: SingletonSpec & { reader: FileSetReader; state: State }): Promise<object> {
  const object = (await readFileSetJson({ reader, path, state })) as
    Record<string, unknown> | null | undefined;
  if (object === undefined) {
    throw new FrodoError(`The file ${path} does not exist.`);
  }
  const isObject =
    typeof object === 'object' && object !== null && !Array.isArray(object);
  if (idKey === null) {
    if (!isObject) {
      throw new FrodoError(`The file ${path} does not hold a JSON object.`);
    }
    return object;
  }
  const held = isObject ? object[idKey] : undefined;
  if (typeof held !== 'string' || held === '') {
    throw new FrodoError(`The file ${path} holds no ${idKey} that is a text.`);
  }
  if (held !== id) {
    // the id that the file holds is not in the message: it is what the placeholders of the file made of it, so it can be the
    // value of a name of the state or of the environment of the process, which a message must never show
    throw new FrodoError(
      `The file ${path} does not hold the id of this type, ${JSON.stringify(id)}.`
    );
  }
  return object;
}

/**
 * Push the one object of a type: merge its file, then write what the merge gave. The object is the one object of the run
 * of {@link runPerObject}, so whatever fails for it is the error of its outcome and nothing is thrown, and the result
 * callback is told once. The id of the outcome is the id of the type; when the merge fails, so that the file could not be
 * used, it is the path of the file.
 * @param {string} id the id of the one object of the type
 * @param {string} path the path of its file, for the outcome of a file that could not be used
 * @param {() => Promise<M>} merge merges the file into what the write needs; it throws for a file that cannot be used (see {@link mergeSingleton})
 * @param {(merged: M) => Promise<R>} write writes what the merge gave to the tenant, and gives what the tenant answered
 * @param {ResultCallback<R>} resultCallback Optional. Told once how the push of the object ended
 * @returns {Promise<PushOutcome[]>} one outcome
 */
export async function mergeAndWriteSingleton<M, R>({
  id,
  path,
  merge,
  write,
  resultCallback,
}: {
  id: string;
  path: string;
  merge: () => Promise<M>;
  write: (merged: M) => Promise<R>;
  resultCallback?: ResultCallback<R>;
}): Promise<PushOutcome[]> {
  let read: { id: string; merged?: M; error?: Error };
  try {
    read = { id, merged: await merge() };
  } catch (error) {
    read = {
      id: path,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
  return runPerObject({
    objects: [read],
    work: async ({ object }) => {
      if (object.error) throw object.error;
      return write(object.merged as M);
    },
    resultCallback,
  });
}

// ── A type with a list of objects ───────────────────────────────────────────────────────────────────────────────────

/**
 * What a type with a list of objects (a file for each object, in one folder) passes to the functions below: where its files
 * are, what its ids look like, and what it is. The functions take the spec as it is, so a type holds one constant and hands it
 * to the split, the merge and the push.
 * @property {string} folder the folder of the type in the file set; the set owns it
 * @property {string | null} idPrefix what the id of an object of the type looks like, which is checked on a pull and on a push, because a push reads the id from the content of a file and puts it into the path of a request, and nothing else says which object the file is for. A prefix, such as `a/`, means the id is that prefix and one name, as `isRequestSegment` says what a name is (the type decides which entries of a tenant are its objects by the prefix). The empty text means the id is one name and has no prefix. `null` means the id never reaches a request, so any text that is not empty will do, if it holds no control character and no lone surrogate. In every case an id that holds `${` is refused, and an id that is accepted is still text from a file or a tenant: in the mode `null` it can hold characters that change what a terminal shows (a bidirectional control, a zero-width character), and it is the `id` of the outcome of a push and is in the text of the error that the run of a push gives for the object, so a caller shows it in the form that is safe for its output
 * @property {Pick<ConfigTypeDescriptor, 'key' | 'volume'>} type the type itself: its descriptor, so that the flag that makes the engine refuse an unbounded type has one source
 * @property {(name: string) => string} nameOf gives the file name of an object, without the extension, from its id without the prefix. Default: `nameInFolder`, which keeps the name as it is when it is one name of a file (`Login:SSO` keeps its colon), and writes every other name with the characters of a path as `%XX`: a name that holds `C:` anywhere is written so, and its colon is `%3A` (`ABC:x` is `ABC%3Ax`), because the library removes `C:` from a path
 */
export type ListSpec = {
  folder: string;
  idPrefix: string | null;
  type: Pick<ConfigTypeDescriptor, 'key' | 'volume'>;
  nameOf?: (name: string) => string;
};

/**
 * One file of the folder of a type with a list of objects, read for a push: the object, or why the file cannot be used.
 * @property {string} id the id of the object, as the file holds it; when the file cannot be used, the path of the file
 * @property {string} path the path of the file
 * @property {Record<string, unknown>} object the object with its placeholders filled; not there when the file cannot be used
 * @property {Error} error why the file cannot be used; never holds the id that the file holds, which can be the value of a placeholder
 */
export type ListRead = {
  id: string;
  path: string;
  object?: Record<string, unknown>;
  error?: Error;
};

/**
 * Throw for a type that is unbounded, so that the functions for a list of objects never read, list or write anything for one: a
 * file set holds the whole of a type in memory, and a type with more objects than that has no file set. A type that names no
 * volume is bounded.
 * @param {Pick<ConfigTypeDescriptor, 'key' | 'volume'>} type the type, as its descriptor says
 * @throws {FrodoError} if the volume of the type is `unbounded`
 */
export function assertBounded(
  type: Pick<ConfigTypeDescriptor, 'key' | 'volume'>
): void {
  if (type.volume === 'unbounded') {
    throw new FrodoError(
      `The configuration type '${type.key}' is unbounded: a file set holds the whole of a type in memory, so a type that can have more objects than that is not pulled to a file set and not pushed from one.`
    );
  }
}

/** The opener of a placeholder. An id never holds one: a value of the state or of the process would end up in a request. */
const PLACEHOLDER_OPENER = '${';

/** Whether a value is a JSON object: not `null`, not an array. */
const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What a check of an id finds. */
type IdVerdict =
  'ok' | 'not-of-type' | 'not-an-id' | 'not-text' | 'placeholder';

/**
 * Check an id against the spec of a type. The same check runs on a pull, on the id that the tenant gave, and on a push, on the id
 * that the file holds, so that a pull never writes a file that a push would refuse.
 * @param {string} id the id, which is text that is not empty
 * @param {string | null} idPrefix what the id of the type looks like (see {@link ListSpec})
 * @returns {IdVerdict} `not-of-type` for an id that does not start with the prefix, `not-an-id` for one that is not the prefix and one name, `not-text` for an id that never reaches a request and holds a control character or a lone surrogate, `placeholder` for one that holds `${`, `ok` otherwise
 */
function judgeId(id: string, idPrefix: string | null): IdVerdict {
  if (idPrefix !== null) {
    if (!id.startsWith(idPrefix)) return 'not-of-type';
    if (!isRequestSegment(id.slice(idPrefix.length))) return 'not-an-id';
  } else if (/\p{Cc}/u.test(id) || !id.isWellFormed()) {
    return 'not-text';
  }
  return id.includes(PLACEHOLDER_OPENER) ? 'placeholder' : 'ok';
}

/** What one name is, in the words of a message: what `isRequestSegment` accepts. */
const ONE_NAME =
  'one name (not empty, not "." or "..", not starting with ";", ".;" or "..;", no slash, backslash, "?", "#", "%" or control character, and no blank at either end)';

/** What an id has to be, in the words of a message, with the prefix of the type (a constant of the type) and never an id. */
const shapeOfId = (idPrefix: string | null): string =>
  idPrefix
    ? `the prefix ${JSON.stringify(idPrefix)} followed by ${ONE_NAME}`
    : ONE_NAME;

/**
 * The finding for an id that is not an id of the type. One message for each reason, and none holds an id: the id is the `id` of
 * the finding.
 * @param {string} id the id
 * @param {IdVerdict} verdict what the check found, not `ok`
 * @param {string | null} idPrefix what the id of the type looks like
 * @returns {PullFinding} the finding
 */
function findingOfVerdict(
  id: string,
  verdict: Exclude<IdVerdict, 'ok'>,
  idPrefix: string | null
): PullFinding {
  switch (verdict) {
    case 'not-of-type':
      return {
        kind: 'not-of-type',
        id,
        message:
          'its id does not start with the prefix: not an object of this type',
      };
    case 'not-an-id':
      return {
        kind: 'refused',
        id,
        message: `its id is not an id of this type: it is not ${shapeOfId(idPrefix)}`,
      };
    case 'not-text':
      return {
        kind: 'refused',
        id,
        message:
          'its id holds a control character or a character that is not text',
      };
    case 'placeholder':
      return {
        kind: 'refused',
        id,
        message:
          'its id holds a placeholder opener: an id is never filled from a placeholder',
      };
  }
}

/**
 * Split the objects of a type with a list of objects into a file set of one file for each, and say what could not be written.
 * Pure: it reads no tenant and no file, and prints nothing. The objects are not changed.
 *
 * The ids are taken in ordinal order before any file name is made, so that the same objects give the same files whatever order
 * the tenant answered in, and of two ids that have one file name (they differ only in case or Unicode form, or the name
 * function writes them alike) the one that sorts first keeps the name. What is not written is a finding, never silently
 * dropped and never thrown, so one bad entry does not stop the others:
 * - `unreadable`: the entry is not an object that holds an id that is a text that is not empty (it has no `id`),
 * - `not-of-type`: the id does not start with the prefix, so the entry is not an object of this type (a query for a prefix can
 *   answer with others); a notice, and not a failure,
 * - `refused`: the id is not the prefix and one name, or holds `${`, or leaves no file name,
 * - `collision`: another object has the same file name, and `firstId` is the id that has it (an id that the answer holds twice
 *   collides with itself).
 * The findings are in this order: the unreadable ones in the order of the answer, then the others by id in ordinal order. No
 * message holds an id.
 *
 * The file set owns the folder, also when there is no object, so a consumer that cleans owned folders removes what the tenant no
 * longer has. A consumer that finds findings does not clean.
 * @param {string} folder the folder of the type in the file set
 * @param {string | null} idPrefix what the id of the type looks like (see {@link ListSpec})
 * @param {Pick<ConfigTypeDescriptor, 'key' | 'volume'>} type the type; an unbounded type is refused before the objects are looked at
 * @param {(name: string) => string} nameOf Optional. Gives the file name of an object from its id without the prefix. Default: `nameInFolder`
 * @param {unknown[]} objects what the tenant answered, one entry for each object, each of which should be an object that holds an `_id`
 * @param {boolean} keepRev true if the files keep the `_rev` keys; there is no default, because the defaults of the files of the types differ
 * @param {boolean} keepModifiedProperties true if the files keep the modified properties; there is no default, as for `keepRev`
 * @param {(id: string) => Record<string, unknown> | undefined} overridesFor Optional. Gives the overrides of the object with the id, which are merged in after the escaping and written as they are
 * @returns {PullResult} the file set, and the findings
 * @throws {FrodoError} if the type is unbounded
 * @throws {Error} if the folder is not a path of a file set, or the name function gives a name that is not one
 */
export function splitList({
  folder,
  idPrefix,
  type,
  nameOf = nameInFolder,
  objects,
  keepRev,
  keepModifiedProperties,
  overridesFor,
}: ListSpec & {
  objects: unknown[];
  keepRev: boolean;
  keepModifiedProperties: boolean;
  overridesFor?: (id: string) => Record<string, unknown> | undefined;
}): PullResult {
  assertBounded(type);
  const unreadable: PullFinding[] = [];
  const entries: { id: string; object: Record<string, unknown> }[] = [];
  for (const entry of objects) {
    const id = isJsonObject(entry) ? entry._id : undefined;
    if (typeof id !== 'string' || id === '') {
      unreadable.push({
        kind: 'unreadable',
        message: 'the entry is not an object that holds an id that is a text',
      });
    } else {
      entries.push({ id, object: entry as Record<string, unknown> });
    }
  }
  // a stable sort: of two entries with one id the first of the answer is the one that is kept
  entries.sort((a, b) => compareOrdinal(a.id, b.id));

  const others: PullFinding[] = [];
  const kept: typeof entries = [];
  const keptIds = new Set<string>();
  for (const entry of entries) {
    const verdict = judgeId(entry.id, idPrefix);
    if (verdict !== 'ok') {
      others.push(findingOfVerdict(entry.id, verdict, idPrefix));
    } else if (keptIds.has(entry.id)) {
      others.push({
        kind: 'collision',
        id: entry.id,
        firstId: entry.id,
        message: 'another object has the same file name',
      });
    } else {
      keptIds.add(entry.id);
      kept.push(entry);
    }
  }

  const prefixLength = idPrefix === null ? 0 : idPrefix.length;
  const named = assignFileNames(
    kept.map((entry) => entry.id),
    (id) => nameOf(id.slice(prefixLength))
  );
  for (const { id, firstId } of named.collisions) {
    others.push({
      kind: 'collision',
      id,
      firstId,
      message: 'another object has the same file name',
    });
  }
  for (const { id } of named.refused) {
    others.push({
      kind: 'refused',
      id,
      message: 'its id leaves no file name',
    });
  }

  const files = kept.flatMap((entry) => {
    const name = named.names.get(entry.id);
    return name === undefined
      ? []
      : [
          fileOfObject({
            path: `${folder}/${name}.json`,
            object: entry.object,
            overrides: overridesFor?.(entry.id),
            keepRev,
            keepModifiedProperties,
          }),
        ];
  });
  others.sort((a, b) => compareOrdinal(a.id as string, b.id as string));
  return {
    fileSet: buildFileSet({ files, ownedFolders: [folder] }),
    findings: [...unreadable, ...others],
  };
}

/**
 * Read one file of a type with a list of objects, and check the id that it holds, before anything is sent for it. The text is
 * read once and checked in this order, so that a value of the state or of the process never reaches an id, an error or a request:
 * 1. The id as the text of the file holds it, parsed as it is written, before any placeholder is filled: an `_id` that holds `${`
 *    is refused, whatever the placeholder would be filled with, and whether or not the state has a value for it.
 * 2. The placeholders are filled and the text parsed, as for every file of a file set (a placeholder without a value, and text
 *    that is not JSON, fail with their own errors).
 * 3. The text has to be JSON as it is written, and the id that it holds after the placeholders are filled has to be the id that it
 *    held before (a value that closes the string and adds another `_id` would otherwise make the id of the file).
 * 4. The id is a text that is not empty, and is an id of the type (see {@link ListSpec}).
 * @param {string} text the text of the file
 * @param {string} path the path of the file
 * @param {string | null} idPrefix what the id of the type looks like
 * @param {State} state the state, which holds the values of the placeholders
 * @returns {Record<string, unknown>} the object with its placeholders filled
 * @throws {FrodoError} if the file cannot be used; the message names the path and never an id
 */
function objectOfListFile(
  text: string,
  path: string,
  idPrefix: string | null,
  state: State
): Record<string, unknown> {
  let rawId: unknown;
  let isRawJson = true;
  try {
    const raw = parseExportJson(text) as unknown;
    rawId = isJsonObject(raw) ? raw._id : undefined;
  } catch {
    isRawJson = false;
  }
  if (typeof rawId === 'string' && rawId.includes(PLACEHOLDER_OPENER)) {
    throw new FrodoError(
      `The file ${path} holds an _id with a placeholder opener, which an id never holds.`
    );
  }
  const object = parseFileSetText(text, path, state) as unknown;
  if (!isRawJson) {
    throw new FrodoError(
      `The file ${path} is not JSON until its placeholders are filled, so its _id cannot be checked.`
    );
  }
  const id = isJsonObject(object) ? object._id : undefined;
  if (id === undefined || id === null) {
    throw new FrodoError(`The file ${path} holds no _id.`);
  }
  if (typeof id !== 'string' || id === '') {
    throw new FrodoError(
      `The file ${path} holds an _id that is empty or not a text.`
    );
  }
  if (id !== rawId) {
    throw new FrodoError(
      `The file ${path} holds an _id that its placeholders changed, which an id never does.`
    );
  }
  const verdict = judgeId(id, idPrefix);
  if (verdict === 'not-text') {
    throw new FrodoError(
      `The file ${path} holds an _id with a control character or a character that is not text.`
    );
  }
  // the verdict `placeholder` cannot come here: an id that holds `${` was refused on the raw text, and the filled id is the raw id
  if (verdict !== 'ok') {
    throw new FrodoError(
      `The file ${path} does not hold an id of this type: it is not ${shapeOfId(idPrefix)}.`
    );
  }
  return object as Record<string, unknown>;
}

/**
 * Read the files of a type with a list of objects, and check every id, for a push. Only the `.json` files that lie in the folder
 * are read, in the order of their paths; a folder that does not exist has no file, and nothing else is listed or read. The id
 * of an object is the `_id` that its file holds and never the name of the file: files can be renamed, or shortened because their
 * id is long, and the object is the same object. A file that cannot be used is a result of its own with its path for an id and
 * the error, and the other files are read: the reader cannot read the file, the text is not JSON, a placeholder has no value, the
 * file holds no `_id` that is a text that is not empty, the id is not an id of the type (see {@link ListSpec}), or it holds `${`, or another file that is
 * earlier in the order of the paths holds the same id (the later file is refused and the message names the earlier PATH). No
 * message holds an id. The comparison of ids is exact, with no case folding and no Unicode normalisation, as for the single
 * object of a type.
 * @param {string} folder the folder of the type in the file set
 * @param {string | null} idPrefix what the id of the type looks like (see {@link ListSpec})
 * @param {Pick<ConfigTypeDescriptor, 'key' | 'volume'>} type the type; an unbounded type is refused before anything is listed or read
 * @param {FileSetReader} reader the reader of the file set
 * @param {State} state the state, which holds the values of the placeholders
 * @returns {Promise<ListRead[]>} one result for every file, in the order of the paths
 * @throws {FrodoError} if the type is unbounded, or the reader cannot list the folder ("Error listing the folder"): nothing can be read then, so it rejects for every file at once. A file that the reader cannot read ("Error reading file", with the cause) is a result of its own and does not reject
 */
export async function mergeList({
  folder,
  idPrefix,
  type,
  reader,
  state,
}: ListSpec & { reader: FileSetReader; state: State }): Promise<ListRead[]> {
  assertBounded(type);
  let entries: Awaited<ReturnType<FileSetReader['listDirectory']>>;
  try {
    entries = await reader.listDirectory(folder);
  } catch (error) {
    throw new FrodoError(`Error listing the folder ${folder}`, error);
  }
  const paths = (entries ?? [])
    .filter((entry) => !entry.isDirectory && entry.name.endsWith('.json'))
    .map((entry) => `${folder}/${entry.name}`)
    .sort(compareOrdinal);
  const reads: ListRead[] = [];
  // the id of each object that was read, and the file it was read from
  const holders = new Map<string, string>();
  for (const path of paths) {
    try {
      // a reader that cannot read this file is one failed object, as a file that cannot be used: the others are read
      const content = await readFileSetContent(reader, path);
      if (content === undefined) {
        throw new FrodoError(`The file ${path} does not exist.`);
      }
      const object = objectOfListFile(
        textOfContent(content, path),
        path,
        idPrefix,
        state
      );
      const id = object._id as string;
      const earlier = holders.get(id);
      if (earlier !== undefined) {
        throw new FrodoError(
          `The file ${path} holds the same _id as the file ${earlier}.`
        );
      }
      holders.set(id, path);
      reads.push({ id, path, object });
    } catch (error) {
      reads.push({
        id: path,
        path,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
  return reads;
}

/**
 * Push the objects of a type with a list of objects: read the files of the folder with {@link mergeList}, then write each object,
 * one after the other, in the order of their ids (a file that cannot be used has its path for an id and sorts with the others,
 * and nothing is written for it). Whatever fails for an object is the error of its outcome and is not thrown, and the other
 * objects are written; see {@link runPerObject} for what the outcomes and the callbacks are, which is what this function hands on.
 * @param {string} folder the folder of the type in the file set
 * @param {string | null} idPrefix what the id of the type looks like (see {@link ListSpec})
 * @param {Pick<ConfigTypeDescriptor, 'key' | 'volume'>} type the type; an unbounded type is refused before anything is listed, read or written
 * @param {FileSetReader} reader the reader of the file set
 * @param {State} state the state, which holds the values of the placeholders
 * @param {(object: Record<string, unknown>, id: string, leftOutCallback?: LeftOutAttributesCallback) => Promise<R>} write writes one object to the tenant, and gives what the tenant answered; its result goes to the callback
 * @param {ResultCallback<R>} resultCallback Optional. Told how the push of every object ended; the callback of the push of the type that was shipped before the engine took lists
 * @param {LeftOutAttributesCallback} leftOutCallback Optional. Passed on to every write
 * @returns {Promise<PushOutcome[]>} one outcome for every file, in the order of the ids; the id is the `_id` of the file, or its path when the file could not be used, which a file that the reader cannot read is too
 * @throws {FrodoError} if the type is unbounded, or the reader cannot list the folder; a `resultCallback` that throws ends the push with its own error
 */
export async function mergeAndWriteList<R>({
  folder,
  idPrefix,
  type,
  reader,
  state,
  write,
  resultCallback,
  leftOutCallback,
}: ListSpec & {
  reader: FileSetReader;
  state: State;
  write: (
    object: Record<string, unknown>,
    id: string,
    leftOutCallback?: LeftOutAttributesCallback
  ) => Promise<R>;
  resultCallback?: ResultCallback<R>;
  leftOutCallback?: LeftOutAttributesCallback;
}): Promise<PushOutcome[]> {
  // `mergeList` refuses an unbounded type before it lists or reads anything
  const reads = await mergeList({ folder, idPrefix, type, reader, state });
  reads.sort((a, b) => compareOrdinal(a.id, b.id));
  return runPerObject({
    objects: reads,
    work: async ({ object, leftOutCallback: leftOut }) => {
      if (object.error) throw object.error;
      return write(
        object.object as Record<string, unknown>,
        object.id,
        leftOut
      );
    },
    resultCallback,
    leftOutCallback,
  });
}
