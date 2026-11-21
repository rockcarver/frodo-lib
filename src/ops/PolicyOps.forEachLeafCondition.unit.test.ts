import { forEachLeafCondition } from './PolicyOps';

/**
 * `forEachLeafCondition` visits every leaf condition of a policy condition,
 * once, in order, going into the combinators AND, OR and NOT at any depth.
 * Pure unit test: no recording, no tenant.
 */

const leaf = (id: string, type = 'Script') => ({ type, id }) as any;

function visited(condition: any): string[] {
  const ids: string[] = [];
  forEachLeafCondition(condition, (found) => ids.push((found as any).id));
  return ids;
}

describe('forEachLeafCondition', () => {
  test('visits a leaf that is the condition itself, once', () => {
    expect(visited(leaf('a'))).toEqual(['a']);
  });

  test('visits the members of an AND in order', () => {
    expect(
      visited({ type: 'AND', conditions: [leaf('a'), leaf('b'), leaf('c')] })
    ).toEqual(['a', 'b', 'c']);
  });

  test('visits the members of an OR in order', () => {
    expect(visited({ type: 'OR', conditions: [leaf('a'), leaf('b')] })).toEqual(
      ['a', 'b']
    );
  });

  test('goes into the single condition of a NOT', () => {
    expect(visited({ type: 'NOT', condition: leaf('a') })).toEqual(['a']);
  });

  test('does not treat AND, OR or NOT as leaves', () => {
    const seen: string[] = [];
    forEachLeafCondition(
      {
        type: 'AND',
        conditions: [
          { type: 'OR', conditions: [{ type: 'NOT', condition: leaf('a') }] },
        ],
      } as any,
      (found) => seen.push(found.type)
    );

    expect(seen).toEqual(['Script']);
  });

  test('goes into nested combinators at any depth, in document order', () => {
    expect(
      visited({
        type: 'AND',
        conditions: [
          leaf('a'),
          {
            type: 'OR',
            conditions: [
              leaf('b'),
              { type: 'NOT', condition: leaf('c') },
              { type: 'AND', conditions: [leaf('d'), leaf('e')] },
            ],
          },
          leaf('f'),
        ],
      })
    ).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  test('visits a leaf that appears twice twice (it does not de-duplicate)', () => {
    expect(visited({ type: 'OR', conditions: [leaf('a'), leaf('a')] })).toEqual(
      ['a', 'a']
    );
  });

  test('visits leaves of other types than Script', () => {
    const types: string[] = [];
    forEachLeafCondition(
      {
        type: 'AND',
        conditions: [
          { type: 'AuthenticateToService', authenticateToService: 'Login' },
          { type: 'Session' },
        ],
      } as any,
      (found) => types.push(found.type)
    );

    expect(types).toEqual(['AuthenticateToService', 'Session']);
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['an AND without members', { type: 'AND' }],
    ['an AND with an empty list', { type: 'AND', conditions: [] }],
    ['a NOT without a condition', { type: 'NOT' }],
  ])('visits nothing for %s', (_what, condition) => {
    expect(visited(condition)).toEqual([]);
  });
});
