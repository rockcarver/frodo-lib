import type { State } from '../shared/State';
import type { FileSetReader, VirtualFileSet } from '../utils/FileSetUtils';
import { FrodoError } from './FrodoError';

export interface ExportMetaData {
  origin: string;
  originAmVersion: string;
  exportedBy: string;
  exportDate: string;
  exportTool: string;
  exportToolVersion: string;
}

export type ResultCallback<R> = (error?: FrodoError, result?: R) => void;

/**
 * Callback that tells the caller which attributes of an object were left out. The server refuses an attribute that it
 * does not know; the library then leaves the unknown top-level attributes out of a copy of the body and sends it once
 * more. When an object was stored without such attributes, the callback is called once for that object, after the
 * second request has succeeded. It is not called when nothing was left out, and not when the object could not be stored.
 * The callback should not throw: an error it throws ends that call with that error.
 * @param {string} id the id of the object that was stored without the attributes
 * @param {string[]} attributes the names of the top-level attributes that were left out; a new array that the callback may keep
 */
export type LeftOutAttributesCallback = (
  id: string,
  attributes: string[]
) => void;

/**
 * What became of one object of a push: its id, and the error when the push of it failed. A push gives one outcome for every
 * object it was asked to push, in the order it was given them, so that one failure never hides the others. The error is the
 * failure of the whole object. A failure of a part of the object that the push reported to the result callback and then went
 * on from is told to that callback and is not in the outcome.
 * - `id`: the id of the object, as the file of the object holds it; when the file could not be used, the path of the file.
 * - `error`: why the object was not pushed, with the cause nested. It is not there when the push of the object succeeded.
 */
export type PushOutcome = {
  id: string;
  error?: FrodoError;
};

export type ErrorFilter = (error: FrodoError) => boolean;

/**
 * How much a holder depends on the object it names. A `hard` dependency breaks
 * the holder at run time without the object, a `soft` dependency does not (the
 * holder works without it). The flag says what happens to the holder, not what
 * the platform does when the object is deleted: a `hard` holder is not
 * necessarily protected.
 */
export type ReferenceDependency = 'hard' | 'soft';

/**
 * One object that names another object, found by one of the reference lookups
 * (`findJourneyReferences` reports the same fields for the objects that hold a
 * journey name). `source` says which type of holder it is, `id` which one, and
 * `from` where in the holder the name was found. An empty answer is never
 * proof that the named object is unused: it means only that the sources the
 * lookup reads do not name it.
 */
export type ObjectReference<Source extends string> = {
  /** Which type of holder this is. */
  source: Source;
  /** How much the holder depends on the object it names. */
  dependency: ReferenceDependency;
  /** The id of the holder: a configuration id, an application id, a server cluster name or a connector name. */
  id: string;
  /** The name of the holder, where it has one (applications, mappings). */
  name?: string;
  /** The realm of the holder, only for a holder that lives in one realm (applications). */
  realm?: string;
  /** The field of the holder that holds the name, as a dotted path without list indexes; a list is reported by the path of the list. */
  from: string;
};

/** A configuration type: its key. The keys are plain strings: the word that the type goes by, in lower case (`kba`). */
export type ConfigType = string;

/**
 * The pull of a configuration type to a file set: it reads the type from the tenant with the state it is given and returns
 * the file set, and writes nothing. A type that is visited by realm or takes overrides accepts more optional properties.
 */
export type FileSetPull = (options: {
  state: State;
}) => Promise<VirtualFileSet>;

/**
 * The push of a configuration type from a file set: it reads the files of the type through the reader, writes them to the
 * tenant with the state it is given, and gives one outcome for every object. A failure for an object is an outcome with the
 * error and is not thrown; the result callback, if there is one, is told once for every object. A type that is visited by
 * realm or takes overrides accepts more optional properties.
 */
export type FileSetPush = (options: {
  reader: FileSetReader;
  resultCallback?: ResultCallback<unknown>;
  state: State;
}) => Promise<PushOutcome[]>;

/** A function of a configuration type that is not typed yet: it takes what the type needs, and answers when it is done. */
type ConfigTypeFunction = (...args: never[]) => Promise<unknown>;

/**
 * What the registry of the configuration types knows about one configuration type. The module that owns the type writes it
 * (one owner per type).
 */
export interface ConfigTypeDescriptor {
  /** The key of the type. */
  key: ConfigType;
  /** Whether the type lives once for the tenant (`global`) or once for every realm (`realm`). */
  scope: 'global' | 'realm';
  /** Whether the type is static configuration (what a promotion carries) or dynamic. */
  isStatic: boolean;
  /** The deployment types that offer the type. */
  deployments: ('cloud' | 'forgeops' | 'classic')[];
  /** The place of the type in an export: types are exported in ascending order. */
  exportOrder: number;
  /** The place of the type in an import: types are imported in ascending order, which need not be the export order. */
  importOrder: number;
  /** The function that exports the type, if it has one. */
  export?: ConfigTypeFunction;
  /** The function that imports the type, if it has one. */
  import?: ConfigTypeFunction;
  /** The function that pulls the type to a file set, if it has one. */
  pull?: FileSetPull;
  /** The function that pushes the type from a file set, if it has one. */
  push?: FileSetPush;
}
