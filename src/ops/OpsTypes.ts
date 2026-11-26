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
 * What became of one object of a push: its id, and the error when it could not be pushed. A push gives one outcome for
 * every object it was asked to push, in the order it was given them, so that one failure never hides the others.
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
