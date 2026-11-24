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
