import { State } from '../../shared/State';
import { FrodoError } from '../FrodoError';

/**
 * One source of a reference lookup: what is read, and how the references to
 * one object are found in what was read. A lookup is a list of these rows; the
 * read of every row happens once and together, and the answer is joined in
 * memory, so the same reads can answer any number of ids.
 */
export type ReferenceSource<Source extends string, Reference> = {
  /** The `source` of the references that this row yields. One row per source. */
  source: Source;
  /** What the read is called in an error. */
  label: string;
  /** Present if the row is only read for some deployments. */
  appliesTo?: (state: State) => boolean;
  read: (state: State) => Promise<unknown>;
  /** Pure: the references to one id in what `read` returned. */
  find: (data: unknown, id: string) => Reference[];
};

/** What every row returned, keyed by source. A row that was not read has no entry. */
export type ReferenceReads<Source extends string> = Partial<
  Record<Source, unknown>
>;

/** A row whose read failed. */
export type ReferenceReadFailure<Source extends string> = {
  source: Source;
  /** `Error reading <label>`, with the cause nested. */
  error: FrodoError;
};

/**
 * Make a row from a typed reader and a typed matcher.
 * @param row the row
 * @returns the row, with its data typed as `unknown`
 */
export function defineReferenceSource<
  Source extends string,
  Reference,
  Data,
>(row: {
  source: Source;
  label: string;
  appliesTo?: (state: State) => boolean;
  read: (state: State) => Promise<Data>;
  find: (data: Data, id: string) => Reference[];
}): ReferenceSource<Source, Reference> {
  return row as unknown as ReferenceSource<Source, Reference>;
}

/**
 * Reads every row that applies once, together. Nothing is thrown for a row
 * that cannot be read: it is reported as a failure, and every other row is
 * still read.
 * @param sources the rows
 * @param state the state
 * @returns what every row that could be read returned, and one failure per row that could not
 */
export async function readReferenceSources<Source extends string>(
  sources: readonly Pick<
    ReferenceSource<Source, unknown>,
    'source' | 'label' | 'appliesTo' | 'read'
  >[],
  state: State
): Promise<{
  reads: ReferenceReads<Source>;
  failures: ReferenceReadFailure<Source>[];
}> {
  const applicable = sources.filter(
    (source) => !source.appliesTo || source.appliesTo(state)
  );
  const settled = await Promise.allSettled(
    applicable.map(async (source) => source.read(state))
  );
  const reads: ReferenceReads<Source> = {};
  const failures: ReferenceReadFailure<Source>[] = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      reads[applicable[index].source] = result.value;
    } else {
      failures.push({
        source: applicable[index].source,
        error: new FrodoError(
          `Error reading ${applicable[index].label}`,
          result.reason
        ),
      });
    }
  });
  return { reads, failures };
}

/**
 * The pure join: the references to one id in one set of reads. A row that has
 * no entry in `reads` (not read for this deployment, or not readable) yields
 * no reference.
 * @param sources the rows, in the order of the result
 * @param reads what every row returned
 * @param id the id that is looked up
 * @returns every reference found, in the order of the rows
 */
export function joinReferences<Source extends string, Reference>(
  sources: readonly ReferenceSource<Source, Reference>[],
  reads: ReferenceReads<Source>,
  id: string
): Reference[] {
  return sources.flatMap((source) =>
    source.source in reads ? source.find(reads[source.source], id) : []
  );
}

/**
 * Fails closed: reads every row, and if any row cannot be read, throws one
 * error that nests one error per row that failed (every row is still
 * attempted). Otherwise joins the answer for one id.
 * @param params.sources the rows, in the order of the result
 * @param params.state the state
 * @param params.id the id that is looked up
 * @param params.failure the start of the message of the error that is thrown; the messages of the nested errors follow it
 * @returns every reference found, in the order of the rows
 */
export async function findReferencesInSources<
  Source extends string,
  Reference,
>({
  sources,
  state,
  id,
  failure,
}: {
  sources: readonly ReferenceSource<Source, Reference>[];
  state: State;
  id: string;
  failure: string;
}): Promise<Reference[]> {
  const { reads, failures } = await readReferenceSources(sources, state);
  if (failures.length > 0) {
    const errors = failures.map((read) => read.error);
    throw new FrodoError(
      `${failure}: ${errors.map((error) => error.message).join('; ')}`,
      errors
    );
  }
  return joinReferences(sources, reads, id);
}

/**
 * The answer of a reference lookup for a list of ids: the references to each
 * distinct id, and the sources that could not be read. A lookup for a list
 * does not fail for a source it could not read, so a caller reads `unreadable`
 * before it relies on an empty list for an id.
 */
export type ReferenceLookupResult<Source extends string, Reference> = {
  /** One entry per distinct id that was asked for; an id that nothing names has an empty list. An object without a prototype whose key order is not promised: read it by key. */
  references: Record<string, Reference[]>;
  /** The sources that could not be read, in the order of the rows; empty when every source was read. */
  unreadable: Source[];
};

function assertReferenceId(id: unknown, message: string): asserts id is string {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new FrodoError(message);
  }
}

/**
 * The one or many form of a reference lookup.
 *
 * For one id the lookup fails closed (see {@link findReferencesInSources}) and
 * answers a list. For a list of ids the same rows are read once, whatever the
 * number of ids, and the answer is an object: the references of every distinct
 * id (built without a prototype, so an id such as `__proto__` is a plain key),
 * and the sources that could not be read. A list never throws for a source that
 * cannot be read: it answers with what it found and names what it could not
 * check. An empty list is answered without a read. A blank or non-string id,
 * whether alone or in a list, throws before anything is read.
 * @param params.sources the rows, in the order of the result
 * @param params.state the state
 * @param params.ids one id, or a list of ids
 * @param params.subject what the id names, for the messages (for example `connector`)
 * @returns the references to one id, or the answer for a list of ids
 */
export async function findReferencesForIds<
  Source extends string,
  Reference,
>(params: {
  sources: readonly ReferenceSource<Source, Reference>[];
  state: State;
  ids: string;
  subject: string;
}): Promise<Reference[]>;
export async function findReferencesForIds<
  Source extends string,
  Reference,
>(params: {
  sources: readonly ReferenceSource<Source, Reference>[];
  state: State;
  ids: string[];
  subject: string;
}): Promise<ReferenceLookupResult<Source, Reference>>;
export async function findReferencesForIds<
  Source extends string,
  Reference,
>(params: {
  sources: readonly ReferenceSource<Source, Reference>[];
  state: State;
  ids: string | string[];
  subject: string;
}): Promise<Reference[] | ReferenceLookupResult<Source, Reference>>;
export async function findReferencesForIds<Source extends string, Reference>({
  sources,
  state,
  ids,
  subject,
}: {
  sources: readonly ReferenceSource<Source, Reference>[];
  state: State;
  ids: string | string[];
  subject: string;
}): Promise<Reference[] | ReferenceLookupResult<Source, Reference>> {
  if (!Array.isArray(ids)) {
    assertReferenceId(
      ids,
      `Error finding references to a ${subject}: the ${subject} id is empty`
    );
    return findReferencesInSources({
      sources,
      state,
      id: ids,
      failure: `Error finding references to ${subject} ${ids}`,
    });
  }
  ids.forEach((id) =>
    assertReferenceId(
      id,
      `Error finding references to ${subject}s: an id in the list is empty or not a string`
    )
  );
  const references: Record<string, Reference[]> = Object.create(null);
  const distinct = [...new Set(ids)];
  if (distinct.length === 0) {
    return { references, unreadable: [] };
  }
  const { reads, failures } = await readReferenceSources(sources, state);
  for (const id of distinct) {
    references[id] = joinReferences(sources, reads, id);
  }
  return { references, unreadable: failures.map((failure) => failure.source) };
}
