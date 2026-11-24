import { jest } from '@jest/globals';
import { FrodoError } from '../FrodoError';
import {
  defineReferenceSource,
  findReferencesForIds,
  findReferencesInSources,
  joinReferences,
  readReferenceSources,
} from './ReferenceLookup';

/**
 * The shared helper of the reference lookups: rows that are read once and
 * together, a read that fails is reported and does not stop the others, and
 * the fail-closed form throws one error that nests one error per row that
 * failed. Pure unit test: the rows are fakes, no module is mocked.
 */

type Source = 'a' | 'b' | 'c';
type Reference = { source: Source; id: string };

const state = { name: 'state' } as any;

function row(
  source: Source,
  extra: {
    read?: (state: any) => Promise<unknown>;
    appliesTo?: (state: any) => boolean;
  } = {}
) {
  return defineReferenceSource<Source, Reference, string[]>({
    source,
    label: `label of ${source}`,
    read: extra.read ?? (async () => [`${source}-data`]),
    ...(extra.appliesTo && { appliesTo: extra.appliesTo }),
    find: (data, id) =>
      data.filter((entry) => entry.includes(id)).map(() => ({ source, id })),
  });
}

describe('readReferenceSources', () => {
  test('reads every row once and keys the data by source', async () => {
    const readA = jest.fn(async (_state: any) => ['a-data']);
    const readB = jest.fn(async (_state: any) => ['b-data']);
    const { reads, failures } = await readReferenceSources(
      [row('a', { read: readA }), row('b', { read: readB })],
      state
    );
    expect(reads).toEqual({ a: ['a-data'], b: ['b-data'] });
    expect(failures).toEqual([]);
    expect(readA).toHaveBeenCalledTimes(1);
    expect(readA).toHaveBeenCalledWith(state);
    expect(readB).toHaveBeenCalledTimes(1);
  });

  test('does not read a row that does not apply, and reads one that does', async () => {
    const readA = jest.fn(async () => ['a-data']);
    const readB = jest.fn(async () => ['b-data']);
    const readC = jest.fn(async () => ['c-data']);
    const appliesToB = jest.fn((_state: any) => false);
    const appliesToC = jest.fn((_state: any) => true);
    const { reads, failures } = await readReferenceSources(
      [
        row('a', { read: readA }),
        row('b', { read: readB, appliesTo: appliesToB }),
        row('c', { read: readC, appliesTo: appliesToC }),
      ],
      state
    );
    expect(readA).toHaveBeenCalledTimes(1);
    expect(readB).not.toHaveBeenCalled();
    expect(readC).toHaveBeenCalledTimes(1);
    expect(appliesToB).toHaveBeenCalledWith(state);
    expect(appliesToC).toHaveBeenCalledWith(state);
    // a row that was not read has no entry, and is not a failure
    expect(Object.keys(reads)).toEqual(['a', 'c']);
    expect(failures).toEqual([]);
  });

  test('a row that fails is reported with its label and cause, and every other row is still read', async () => {
    const cause = new Error('boom');
    const readC = jest.fn(async () => ['c-data']);
    const { reads, failures } = await readReferenceSources(
      [
        row('a', { read: async () => Promise.reject(cause) }),
        row('b', { read: async () => Promise.reject(new Error('second')) }),
        row('c', { read: readC }),
      ],
      state
    );
    expect(readC).toHaveBeenCalledTimes(1);
    expect(reads).toEqual({ c: ['c-data'] });
    expect(failures.map((failure) => failure.source)).toEqual(['a', 'b']);
    expect(failures[0].error).toBeInstanceOf(FrodoError);
    expect(failures[0].error.message).toBe('Error reading label of a');
    expect(failures[0].error.originalErrors[0]).toBe(cause);
    expect(failures[1].error.message).toBe('Error reading label of b');
  });

  test('a row that fails late does not stop a row that is slow but fine (all rows run together)', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started: string[] = [];
    const pending = readReferenceSources(
      [
        row('a', {
          read: async () => {
            started.push('a');
            await gate;
            return ['a-data'];
          },
        }),
        row('b', {
          read: async () => {
            started.push('b');
            throw new Error('fails at once');
          },
        }),
      ],
      state
    );
    // both reads were started before either finished
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual(['a', 'b']);
    release();
    const { reads, failures } = await pending;
    expect(reads).toEqual({ a: ['a-data'] });
    expect(failures.map((failure) => failure.source)).toEqual(['b']);
  });
});

describe('joinReferences', () => {
  test('joins in the order of the rows and passes the id to every row', () => {
    const rows = [row('b'), row('a'), row('c')];
    const reads = {
      a: ['a-data'],
      b: ['b-data'],
      c: ['c-data'],
    };
    expect(joinReferences(rows, reads, 'data')).toEqual([
      { source: 'b', id: 'data' },
      { source: 'a', id: 'data' },
      { source: 'c', id: 'data' },
    ]);
    expect(joinReferences(rows, reads, 'b-')).toEqual([
      { source: 'b', id: 'b-' },
    ]);
  });

  test('a row without an entry in the reads yields nothing, and its find is not called', () => {
    const find = jest.fn((_data: string[], _id: string): Reference[] => [
      { source: 'a', id: 'x' },
    ]);
    const unread = defineReferenceSource<Source, Reference, string[]>({
      source: 'a',
      label: 'a',
      read: async () => [],
      find,
    });
    expect(joinReferences([unread], {}, 'x')).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });

  test('a row that was read and holds nothing is asked (an empty read is not a missing read)', () => {
    const find = jest.fn((_data: string[], _id: string): Reference[] => []);
    const empty = defineReferenceSource<Source, Reference, string[]>({
      source: 'a',
      label: 'a',
      read: async () => [],
      find,
    });
    expect(joinReferences([empty], { a: [] }, 'x')).toEqual([]);
    expect(find).toHaveBeenCalledWith([], 'x');
  });
});

describe('findReferencesInSources', () => {
  test('answers when every row can be read', async () => {
    await expect(
      findReferencesInSources({
        sources: [row('a'), row('b')],
        state,
        id: 'data',
        failure: 'Error finding references',
      })
    ).resolves.toEqual([
      { source: 'a', id: 'data' },
      { source: 'b', id: 'data' },
    ]);
  });

  test('fails closed with one error that nests one error per row that failed, and attempts every row', async () => {
    const readB = jest.fn(async () => ['b-data']);
    const readC = jest.fn(async () => {
      throw new Error('c is down');
    });
    const failure = findReferencesInSources({
      sources: [
        row('a', { read: async () => Promise.reject(new Error('a is down')) }),
        row('b', { read: readB }),
        row('c', { read: readC }),
      ],
      state,
      id: 'data',
      failure: 'Error finding references to thing data',
    });
    await expect(failure).rejects.toBeInstanceOf(FrodoError);
    const error: FrodoError = await failure.catch((caught) => caught);
    expect(error.message).toBe(
      'Error finding references to thing data: Error reading label of a; Error reading label of c'
    );
    expect(error.originalErrors).toHaveLength(2);
    expect(error.originalErrors.map((nested) => nested.message)).toEqual([
      'Error reading label of a',
      'Error reading label of c',
    ]);
    // every row was attempted although the first one failed, and nothing partial came back
    expect(readB).toHaveBeenCalledTimes(1);
    expect(readC).toHaveBeenCalledTimes(1);
  });

  test('a row that does not apply is neither read nor a failure', async () => {
    const read = jest.fn(async () => {
      throw new Error('would fail');
    });
    await expect(
      findReferencesInSources({
        sources: [row('a'), row('b', { read, appliesTo: () => false })],
        state,
        id: 'data',
        failure: 'Error finding references',
      })
    ).resolves.toEqual([{ source: 'a', id: 'data' }]);
    expect(read).not.toHaveBeenCalled();
  });
});

describe('defineReferenceSource', () => {
  test('returns the row it was given', () => {
    const definition = {
      source: 'a' as Source,
      label: 'a',
      read: async () => ['a-data'],
      find: () => [] as Reference[],
    };
    expect(defineReferenceSource(definition)).toBe(definition);
  });
});

describe('findReferencesForIds', () => {
  const failing = (source: Source) =>
    row(source, {
      read: async () => Promise.reject(new Error(`${source} down`)),
    });

  test('one id answers a list, in the order of the rows', async () => {
    const answer = await findReferencesForIds({
      sources: [row('b'), row('a')],
      state,
      ids: 'data',
      subject: 'thing',
    });
    expect(Array.isArray(answer)).toBe(true);
    expect(answer).toEqual([
      { source: 'b', id: 'data' },
      { source: 'a', id: 'data' },
    ]);
  });

  test('one id fails closed with the subject and the id in the message, and every row is attempted', async () => {
    const readB = jest.fn(async () => ['b-data']);
    const failure = findReferencesForIds({
      sources: [failing('a'), row('b', { read: readB })],
      state,
      ids: 'data',
      subject: 'thing',
    });
    const error: FrodoError = await failure.catch((caught) => caught);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toBe(
      'Error finding references to thing data: Error reading label of a'
    );
    expect(error.originalErrors).toHaveLength(1);
    expect(readB).toHaveBeenCalledTimes(1);
  });

  test.each([[''], ['   '], [undefined], [null], [42], [{}]])(
    'one id %p is refused before anything is read',
    async (id) => {
      const read = jest.fn(async () => ['a-data']);
      await expect(
        findReferencesForIds({
          sources: [row('a', { read })],
          state,
          ids: id as any,
          subject: 'thing',
        })
      ).rejects.toThrow(
        'Error finding references to a thing: the thing id is empty'
      );
      expect(read).not.toHaveBeenCalled();
    }
  );

  test('a list reads the rows once whatever the number of ids, and answers one entry per id', async () => {
    const read = jest.fn(async () => ['a-data', 'a-more']);
    const answer = await findReferencesForIds({
      sources: [row('a', { read })],
      state,
      ids: ['data', 'more', 'nothing'],
      subject: 'thing',
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(answer).toEqual({
      references: {
        data: [{ source: 'a', id: 'data' }],
        more: [{ source: 'a', id: 'more' }],
        nothing: [],
      },
      unreadable: [],
    });
  });

  test('a list answers every id once, in the order it was asked, however often it is repeated', async () => {
    const find = jest.fn((_data: string[], id: string): Reference[] => [
      { source: 'a', id },
    ]);
    const counting = defineReferenceSource<Source, Reference, string[]>({
      source: 'a',
      label: 'a',
      read: async () => [],
      find,
    });
    const answer = await findReferencesForIds({
      sources: [counting],
      state,
      ids: ['x', 'y', 'x', 'x', 'y'],
      subject: 'thing',
    });
    expect(Object.keys(answer.references)).toEqual(['x', 'y']);
    expect(find).toHaveBeenCalledTimes(2);
  });

  test('ids that look like integers are plain keys of the answer, whatever order an object gives its keys', async () => {
    const answer = await findReferencesForIds({
      sources: [row('a', { read: async () => ['10-data', '2-data'] })],
      state,
      ids: ['10', '2', 'b'],
      subject: 'thing',
    });
    expect(Object.keys(answer.references).sort()).toEqual(['10', '2', 'b']);
    expect(answer.references['10']).toEqual([{ source: 'a', id: '10' }]);
    expect(answer.references['2']).toEqual([{ source: 'a', id: '2' }]);
    expect(answer.references['b']).toEqual([]);
  });

  test('a list names the sources it could not read and still answers with the rest', async () => {
    const answer = await findReferencesForIds({
      sources: [failing('a'), row('b'), failing('c')],
      state,
      ids: ['data'],
      subject: 'thing',
    });
    expect(answer).toEqual({
      references: { data: [{ source: 'b', id: 'data' }] },
      unreadable: ['a', 'c'],
    });
  });

  test('a list in which nothing can be read still answers, and names every source', async () => {
    const answer = await findReferencesForIds({
      sources: [failing('a'), failing('b')],
      state,
      ids: ['data'],
      subject: 'thing',
    });
    expect(answer).toEqual({
      references: { data: [] },
      unreadable: ['a', 'b'],
    });
  });

  test('an empty list answers an empty result and reads nothing', async () => {
    const read = jest.fn(async () => ['a-data']);
    const answer = await findReferencesForIds({
      sources: [row('a', { read })],
      state,
      ids: [],
      subject: 'thing',
    });
    expect(answer).toEqual({ references: {}, unreadable: [] });
    expect(read).not.toHaveBeenCalled();
  });

  test.each([[''], ['  '], [undefined], [null], [7]])(
    'a list with the element %p is refused before anything is read',
    async (element) => {
      const read = jest.fn(async () => ['a-data']);
      await expect(
        findReferencesForIds({
          sources: [row('a', { read })],
          state,
          ids: ['data', element as any],
          subject: 'thing',
        })
      ).rejects.toThrow(
        'Error finding references to things: an id in the list is empty or not a string'
      );
      expect(read).not.toHaveBeenCalled();
    }
  );

  test('a list is answered without a prototype, so __proto__ is a plain key', async () => {
    const answer = await findReferencesForIds({
      sources: [row('a', { read: async () => ['__proto__-data'] })],
      state,
      ids: ['__proto__', 'constructor'],
      subject: 'thing',
    });
    expect(Object.getPrototypeOf(answer.references)).toBeNull();
    expect(Object.keys(answer.references)).toEqual([
      '__proto__',
      'constructor',
    ]);
    expect(answer.references['__proto__']).toEqual([
      { source: 'a', id: '__proto__' },
    ]);
    expect(answer.references['constructor']).toEqual([]);
    expect(Object.prototype).not.toHaveProperty('source');
  });
});
