/**
 * Unit tests of mergeDeep, the deep merge of the second object into the first.
 *
 * Run with:
 *
 *        npm run test:only -- src/utils/JsonUtils.mergeDeep.unit
 *
 * What mergeDeep does when the two values of a key are of different types was
 * not decided before: a scalar that an object replaced, and a truthy value that
 * null replaced, threw a TypeError; an object that replaced a falsy value or
 * null, and a null that replaced a falsy value, was dropped without a word; a key
 * named `__proto__` swapped the prototype of the result; a target without
 * prototype threw. These tests pin the rules that replace that:
 *
 *  - the table of 69 inputs, each with the result it must give (what each rule
 *    does to a scalar, null, undefined, an array, an object, a Date, a Map, a
 *    Set, a class instance, a function, a frozen object, a getter and a
 *    symbol key);
 *  - which pairs of objects merge and which replace each other (plain objects
 *    and class instances of the same class or of another class, the built-in
 *    value types), one row of the table of the TSDoc each;
 *  - the arguments (a falsy first argument comes back as it is, a second
 *    argument that is not an object changes nothing);
 *  - arrays, merged by index;
 *  - the keys that must never reach `Object.prototype` and the own-key test;
 *  - what a caller of the public factory sees (a proxy, an https agent and
 *    AxiosHeaders in the request override);
 *  - a seeded fuzz over JSON values: never throws, gives the result of a
 *    reference implementation of the rules, and the result of the old function
 *    wherever the old function had no type conflict to meet.
 *
 * Hermetic: made-up values, no network, no recording, no file.
 */
import https from 'https';
import { inspect, isDeepStrictEqual } from 'util';
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { AxiosHeaders } from 'axios';
import { frodo } from '../index';
import JsonUtils, { mergeDeep } from './JsonUtils';

// ---------------------------------------------------------------------------
// The references
// ---------------------------------------------------------------------------

/**
 * The function of frodo-lib before the rules were decided (`mergeDeep` of
 * `src/utils/JsonUtils.ts` at c5c3f8332), copied. It is the baseline of the
 * fuzz (equal wherever it met no type conflict) and of the check that says
 * which rows of the table were fixed.
 */
function legacyMergeDeep(obj1: any, obj2: any): any {
  if (obj1) {
    for (const key of Object.keys(obj2)) {
      // eslint-disable-next-line no-prototype-builtins
      if (!obj1.hasOwnProperty(key) || typeof obj2[key] !== 'object')
        obj1[key] = obj2[key];
      else legacyMergeDeep(obj1[key], obj2[key]);
    }
  }
  return obj1;
}

/**
 * The rules for JSON values, written out once more as a reference
 * implementation: both values are objects that are not arrays, or both are
 * arrays, then merge; anything else, the second value wins. It is the
 * reference of the fuzz, which has only JSON values (no class instance, no
 * built-in value type). It does not know `__proto__`, which the fuzz keys never
 * contain.
 */
function referenceMerge(target: any, source: any): any {
  if (!source) return target;
  for (const key of Object.keys(source)) {
    const s = source[key];
    const t = target[key];
    const bothObjects =
      typeof s === 'object' &&
      s !== null &&
      !Array.isArray(s) &&
      typeof t === 'object' &&
      t !== null &&
      !Array.isArray(t)
        ? true
        : Array.isArray(s) && Array.isArray(t);
    if (bothObjects) referenceMerge(t, s);
    else target[key] = s;
  }
  return target;
}

class Foo {
  x = 1;
}

class Other {
  z = 9;
}

class Sub extends Foo {
  w = 3;
}

/** Stands for the shared default agent of the factory: a class that is not https.Agent. */
class SharedDefaultAgent {
  maxSockets = 7;
}

const SYM = Symbol('s');

const show = (value: unknown): string =>
  inspect(value, { depth: null, compact: true, breakLength: Infinity });

/** What a function gives for a fresh pair of inputs, as text: its result, or the name of the error it threw. */
function outcome(
  fn: (target: any, source: any) => any,
  make: () => { target: any; source: any }
): string {
  const { target, source } = make();
  try {
    return show(fn(target, source));
  } catch (error) {
    return `THROWS ${(error as Error).name}`;
  }
}

// ---------------------------------------------------------------------------
// The table: 69 inputs
// ---------------------------------------------------------------------------

type Row = {
  id: string;
  label: string;
  /** fresh inputs, because the merge writes into the first */
  make: () => { target: any; source: any };
  /** the result, compared with toStrictEqual (a key with the value undefined is not a missing key) */
  expected?: unknown;
  /** the error a merge into this input throws */
  throws?: new (...args: any[]) => Error;
  /** more probes of the result, of the first and of the second object */
  check?: (result: any, target: any, source: any) => void;
  /** the old function threw, dropped a value or gave another result on this input */
  fixed?: true;
};

const rows: Row[] = [
  // plain objects
  {
    id: 'B1',
    label: '{a:1} + {b:2} adds the key',
    make: () => ({ target: { a: 1 }, source: { b: 2 } }),
    expected: { a: 1, b: 2 },
  },
  {
    id: 'B2',
    label: '{a:{x:1}} + {a:{y:2}} merges the nested objects',
    make: () => ({ target: { a: { x: 1 } }, source: { a: { y: 2 } } }),
    expected: { a: { x: 1, y: 2 } },
  },
  {
    id: 'B3',
    label: '{a:{x:1}} + {a:{x:2}} the second value wins',
    make: () => ({ target: { a: { x: 1 } }, source: { a: { x: 2 } } }),
    expected: { a: { x: 2 } },
  },
  {
    id: 'B4',
    label: '{} + {a:{b:1}} shares the subtree, it does not copy it',
    make: () => ({ target: {}, source: { a: { b: 1 } } }),
    expected: { a: { b: 1 } },
    check: (result, _target, source) => expect(result.a).toBe(source.a),
  },
  {
    id: 'B5',
    label: '{a:1} + {a:2} replaces a scalar by a scalar',
    make: () => ({ target: { a: 1 }, source: { a: 2 } }),
    expected: { a: 2 },
  },

  // type conflicts: what the second value does to the first
  {
    id: 'T1',
    label: "a string becomes an object: {a:'s'} + {a:{x:1}}",
    make: () => ({ target: { a: 's' }, source: { a: { x: 1 } } }),
    expected: { a: { x: 1 } },
    fixed: true,
  },
  {
    id: 'T2',
    label: 'true becomes an object: {a:true} + {a:{x:1}}',
    make: () => ({ target: { a: true }, source: { a: { x: 1 } } }),
    expected: { a: { x: 1 } },
    fixed: true,
  },
  {
    id: 'T3',
    label: 'a number becomes an object: {a:5} + {a:{x:1}}',
    make: () => ({ target: { a: 5 }, source: { a: { x: 1 } } }),
    expected: { a: { x: 1 } },
    fixed: true,
  },
  {
    id: 'T4',
    label: '0 becomes an object (it was dropped): {a:0} + {a:{x:1}}',
    make: () => ({ target: { a: 0 }, source: { a: { x: 1 } } }),
    expected: { a: { x: 1 } },
    fixed: true,
  },
  {
    id: 'T5',
    label: "'' becomes an object (it was dropped): {a:''} + {a:{x:1}}",
    make: () => ({ target: { a: '' }, source: { a: { x: 1 } } }),
    expected: { a: { x: 1 } },
    fixed: true,
  },
  {
    id: 'T6',
    label: 'false becomes an object (it was dropped): {a:false} + {a:{x:1}}',
    make: () => ({ target: { a: false }, source: { a: { x: 1 } } }),
    expected: { a: { x: 1 } },
    fixed: true,
  },
  {
    id: 'T7',
    label: 'null becomes an object (it was dropped): {a:null} + {a:{x:1}}',
    make: () => ({ target: { a: null }, source: { a: { x: 1 } } }),
    expected: { a: { x: 1 } },
    fixed: true,
  },
  {
    id: 'T8',
    label:
      'undefined becomes an object (it was dropped): {a:undefined} + {a:{x:1}}',
    make: () => ({ target: { a: undefined }, source: { a: { x: 1 } } }),
    expected: { a: { x: 1 } },
    fixed: true,
  },
  {
    id: 'T9',
    label: "an object becomes a string: {a:{x:1}} + {a:'s'}",
    make: () => ({ target: { a: { x: 1 } }, source: { a: 's' } }),
    expected: { a: 's' },
  },
  {
    id: 'T10',
    label: 'an object becomes 0: {a:{x:1}} + {a:0}',
    make: () => ({ target: { a: { x: 1 } }, source: { a: 0 } }),
    expected: { a: 0 },
  },
  {
    id: 'T11',
    label: "an object becomes '': {a:{x:1}} + {a:''}",
    make: () => ({ target: { a: { x: 1 } }, source: { a: '' } }),
    expected: { a: '' },
  },
  {
    id: 'T12',
    label: 'an object becomes false: {a:{x:1}} + {a:false}',
    make: () => ({ target: { a: { x: 1 } }, source: { a: false } }),
    expected: { a: false },
  },
  {
    id: 'T13',
    label: 'an object becomes null: {a:{x:1}} + {a:null}',
    make: () => ({ target: { a: { x: 1 } }, source: { a: null } }),
    expected: { a: null },
    fixed: true,
  },
  {
    id: 'T14',
    label: 'a number becomes null: {a:1} + {a:null}',
    make: () => ({ target: { a: 1 }, source: { a: null } }),
    expected: { a: null },
    fixed: true,
  },
  {
    id: 'T15',
    label: "a string becomes null: {a:'s'} + {a:null}",
    make: () => ({ target: { a: 's' }, source: { a: null } }),
    expected: { a: null },
    fixed: true,
  },
  {
    id: 'T16',
    label: 'null stays null: {a:null} + {a:null}',
    make: () => ({ target: { a: null }, source: { a: null } }),
    expected: { a: null },
  },
  {
    id: 'T17',
    label: 'a missing key gets null: {} + {a:null}',
    make: () => ({ target: {}, source: { a: null } }),
    expected: { a: null },
  },
  {
    id: 'T18',
    label: 'a scalar becomes a scalar: {a:1} + {a:2}',
    make: () => ({ target: { a: 1 }, source: { a: 2 } }),
    expected: { a: 2 },
  },
  {
    id: 'T19',
    label: "a truthy scalar becomes '', 0 and false",
    make: () => ({
      target: { a: 'x', b: 1, c: true },
      source: { a: '', b: 0, c: false },
    }),
    expected: { a: '', b: 0, c: false },
  },
  {
    id: 'T20',
    label: 'a number becomes an array: {a:5} + {a:[1]}',
    make: () => ({ target: { a: 5 }, source: { a: [1] } }),
    expected: { a: [1] },
    fixed: true,
  },
  {
    id: 'T21',
    label: "a string becomes an array: {a:'str'} + {a:[1]}",
    make: () => ({ target: { a: 'str' }, source: { a: [1] } }),
    expected: { a: [1] },
    fixed: true,
  },

  // an undefined value of the second object is assigned
  {
    id: 'U1',
    label: '{a:1} + {a:undefined} assigns undefined',
    make: () => ({ target: { a: 1 }, source: { a: undefined } }),
    expected: { a: undefined },
  },
  {
    id: 'U2',
    label: '{} + {a:undefined} adds the key with undefined',
    make: () => ({ target: {}, source: { a: undefined } }),
    expected: { a: undefined },
  },
  {
    id: 'U3',
    label: '{a:{x:1}} + {a:undefined} replaces the object by undefined',
    make: () => ({ target: { a: { x: 1 } }, source: { a: undefined } }),
    expected: { a: undefined },
  },

  // arrays are merged by index
  {
    id: 'A1',
    label: '{a:[1,2,3]} + {a:[9]} (shorter source: the rest stays)',
    make: () => ({ target: { a: [1, 2, 3] }, source: { a: [9] } }),
    expected: { a: [9, 2, 3] },
  },
  {
    id: 'A2',
    label: '{a:[1]} + {a:[7,8,9]} (longer source: it grows)',
    make: () => ({ target: { a: [1] }, source: { a: [7, 8, 9] } }),
    expected: { a: [7, 8, 9] },
  },
  {
    id: 'A3',
    label: '{a:[{x:1},{y:2}]} + {a:[{z:3}]} (objects merge by index)',
    make: () => ({
      target: { a: [{ x: 1 }, { y: 2 }] },
      source: { a: [{ z: 3 }] },
    }),
    expected: { a: [{ x: 1, z: 3 }, { y: 2 }] },
  },
  {
    id: 'A4',
    label: '{a:[1,2]} + {a:[]} (empty source array: nothing changes)',
    make: () => ({ target: { a: [1, 2] }, source: { a: [] } }),
    expected: { a: [1, 2] },
  },
  {
    id: 'A5',
    label: '{a:[1,2]} + {a:{x:1}} an array becomes an object',
    make: () => ({ target: { a: [1, 2] }, source: { a: { x: 1 } } }),
    expected: { a: { x: 1 } },
    check: (result) => expect(Array.isArray(result.a)).toBe(false),
    fixed: true,
  },
  {
    id: 'A6',
    label: '{a:{x:1}} + {a:[1]} an object becomes an array',
    make: () => ({ target: { a: { x: 1 } }, source: { a: [1] } }),
    expected: { a: [1] },
    check: (result) => expect(Array.isArray(result.a)).toBe(true),
    fixed: true,
  },
  {
    id: 'A7',
    label: "{a:[1,2]} + {a:'s'} an array becomes a string",
    make: () => ({ target: { a: [1, 2] }, source: { a: 's' } }),
    expected: { a: 's' },
  },
  {
    id: 'A8',
    label: '{a:[1,2]} + {a:null} an array becomes null',
    make: () => ({ target: { a: [1, 2] }, source: { a: null } }),
    expected: { a: null },
    fixed: true,
  },
  {
    id: 'A9',
    label: '{} + {a:[1,{b:2}]} shares the array',
    make: () => ({ target: {}, source: { a: [1, { b: 2 }] } }),
    expected: { a: [1, { b: 2 }] },
    check: (result, _target, source) => expect(result.a).toBe(source.a),
  },
  {
    id: 'A10',
    label: 'top-level arrays: [1,2,3] + [9]',
    make: () => ({ target: [1, 2, 3], source: [9] }),
    expected: [9, 2, 3],
  },
  {
    id: 'A11',
    label: '{a:[1,2,3]} + {a:[1,undefined,5]} assigns the undefined element',
    make: () => ({
      target: { a: [1, 2, 3] },
      source: { a: [1, undefined, 5] },
    }),
    expected: { a: [1, undefined, 5] },
  },

  // the first object is changed and returned, the second is not changed
  {
    id: 'M1',
    label: 'a shared subtree is the same object in the result and the second',
    make: () => ({ target: {}, source: { a: { b: 1 } } }),
    expected: { a: { b: 1 } },
    check: (result, _target, source) => {
      // a change of the result shows in the second object: the subtree is shared
      result.a.b = 99;
      expect(source.a.b).toBe(99);
    },
  },
  {
    id: 'M2',
    label: '{a:{x:1}} + {a:{y:2}} changes the first object and returns it',
    make: () => ({ target: { a: { x: 1 } }, source: { a: { y: 2 } } }),
    expected: { a: { x: 1, y: 2 } },
    check: (result, target) => expect(target).toBe(result),
  },
  {
    id: 'M3',
    label: 'a frozen first object throws a TypeError, as it did',
    make: () => ({ target: Object.freeze({ a: 1 }), source: { a: 2 } }),
    throws: TypeError,
  },
  {
    id: 'M4',
    label: 'a frozen nested object throws a TypeError, as it did',
    make: () => ({
      target: { a: Object.freeze({ x: 1 }) },
      source: { a: { x: 2 } },
    }),
    throws: TypeError,
  },
  {
    id: 'M5',
    label: 'a frozen second object is read, not changed',
    make: () => ({
      target: {},
      source: Object.freeze({ a: Object.freeze({ x: 1 }) }),
    }),
    expected: { a: { x: 1 } },
  },

  // the shape of the arguments
  {
    id: 'S1',
    label: 'a second argument undefined changes nothing',
    make: () => ({ target: { a: 1 }, source: undefined }),
    expected: { a: 1 },
    fixed: true,
  },
  {
    id: 'S2',
    label: 'a second argument null changes nothing',
    make: () => ({ target: { a: 1 }, source: null }),
    expected: { a: 1 },
    fixed: true,
  },
  {
    id: 'S3',
    label: 'a first argument undefined comes back as undefined',
    make: () => ({ target: undefined, source: { a: 1 } }),
    expected: undefined,
  },
  {
    id: 'S4',
    label: 'a first argument null comes back as null',
    make: () => ({ target: null, source: { a: 1 } }),
    expected: null,
  },
  {
    id: 'S5',
    label: 'a first argument that is a number cannot take a key: TypeError',
    make: () => ({ target: 5, source: { a: 1 } }),
    throws: TypeError,
  },
  {
    id: 'S6',
    label: "a second argument that is a string changes nothing (it was 'ab')",
    make: () => ({ target: { a: 1 }, source: 'ab' }),
    expected: { a: 1 },
    fixed: true,
  },
  {
    id: 'S7',
    label: 'a second argument that is a number changes nothing',
    make: () => ({ target: { a: 1 }, source: 5 }),
    expected: { a: 1 },
  },
  {
    id: 'S8',
    label: 'a second argument that is an array adds its indexes as keys',
    make: () => ({ target: { a: 1 }, source: [7] }),
    expected: { a: 1, 0: 7 },
  },
  {
    id: 'S9',
    label: 'two empty objects',
    make: () => ({ target: {}, source: {} }),
    expected: {},
  },

  // values that are not plain objects
  {
    id: 'E1',
    label: 'a Date replaces a Date',
    make: () => ({
      target: { a: new Date(0) },
      source: { a: new Date(1) },
    }),
    expected: { a: new Date(1) },
    check: (result, _target, source) => expect(result.a).toBe(source.a),
    fixed: true,
  },
  {
    id: 'E2',
    label: 'a Date is added to a missing key',
    make: () => ({ target: {}, source: { a: new Date(1) } }),
    expected: { a: new Date(1) },
  },
  {
    id: 'E3',
    label: 'a Map replaces a Map, it is not merged',
    make: () => ({
      target: { a: new Map([[1, 2]]) },
      source: { a: new Map([[3, 4]]) },
    }),
    expected: { a: new Map([[3, 4]]) },
    fixed: true,
  },
  {
    id: 'E4',
    label: 'a Set replaces a Set, it is not merged',
    make: () => ({
      target: { a: new Set([1]) },
      source: { a: new Set([2]) },
    }),
    expected: { a: new Set([2]) },
    fixed: true,
  },
  {
    id: 'E5',
    label: 'a plain object is merged into a class instance of the first object',
    make: () => ({ target: { a: new Foo() }, source: { a: { y: 2 } } }),
    expected: { a: Object.assign(new Foo(), { y: 2 }) },
    check: (result) => expect(result.a).toBeInstanceOf(Foo),
  },
  {
    id: 'E6',
    label:
      'a class instance of the second object is merged into a plain object of the first, as before',
    make: () => ({ target: { a: { y: 2 } }, source: { a: new Foo() } }),
    expected: { a: { y: 2, x: 1 } },
    check: (result, _target, source) => {
      expect(Object.getPrototypeOf(result.a)).toBe(Object.prototype);
      expect(result.a).not.toBe(source.a);
    },
  },
  {
    id: 'E7',
    label: 'an object replaces a function: {a:fn} + {a:{x:1}}',
    make: () => ({
      target: { a: function f() {} },
      source: { a: { x: 1 } },
    }),
    expected: { a: { x: 1 } },
    check: (result) => expect(typeof result.a).toBe('object'),
    fixed: true,
  },
  {
    id: 'E8',
    label: 'a function replaces an object: {a:{x:1}} + {a:fn}',
    make: () => ({
      target: { a: { x: 1 } },
      source: {
        a: function g() {},
      },
    }),
    check: (result, _target, source) => expect(result.a).toBe(source.a),
  },
  {
    id: 'E9',
    label: 'a symbol key is ignored: {[s]:1} + {[s]:2}',
    make: () => ({ target: { [SYM]: 1 }, source: { [SYM]: 2 } }),
    expected: { [SYM]: 1 },
  },
  {
    id: 'E10',
    label: 'a symbol key only in the second object is not added',
    make: () => ({ target: {}, source: { [SYM]: 2 } }),
    expected: {},
    check: (result) =>
      expect(Object.getOwnPropertySymbols(result)).toHaveLength(0),
  },
  {
    id: 'E11',
    label: 'an inherited key of the second object is not copied',
    make: () => {
      const source = Object.create({ inherited: 1 });
      source.own = 2;
      return { target: {}, source };
    },
    expected: { own: 2 },
    check: (result) => expect('inherited' in result).toBe(false),
  },
  {
    id: 'E12',
    label: 'a key of the second object that is not enumerable is not copied',
    make: () => {
      const source = {};
      Object.defineProperty(source, 'hidden', {
        value: 1,
        enumerable: false,
      });
      return { target: {}, source };
    },
    expected: {},
    check: (result) => expect(Object.getOwnPropertyNames(result)).toEqual([]),
  },
  {
    id: 'E13',
    label: 'a first object without prototype is merged (it threw)',
    make: () => {
      const target = Object.create(null);
      target.a = { x: 1 };
      return { target, source: { a: { y: 2 } } };
    },
    check: (result) => {
      expect(Object.getPrototypeOf(result)).toBeNull();
      expect(result.a).toStrictEqual({ x: 1, y: 2 });
    },
    fixed: true,
  },
  {
    id: 'E14',
    label: "a JSON key named 'hasOwnProperty' is data, not a method (it threw)",
    make: () => ({
      target: { a: 1 },
      source: JSON.parse('{"hasOwnProperty":1,"b":2}'),
    }),
    expected: { a: 1, hasOwnProperty: 1, b: 2 },
    fixed: true,
  },
  {
    id: 'E15',
    label: 'a getter without setter in the first object throws a TypeError',
    make: () => {
      const target = {};
      Object.defineProperty(target, 'a', {
        get: () => 1,
        enumerable: true,
        configurable: true,
      });
      return { target, source: { a: 2 } };
    },
    throws: TypeError,
  },
];

describe('mergeDeep', () => {
  describe('the table of 69 inputs', () => {
    test('the table has 69 rows with distinct ids', () => {
      expect(rows).toHaveLength(69);
      expect(new Set(rows.map((row) => row.id)).size).toBe(69);
    });

    test.each(rows.map((row) => [`${row.id}: ${row.label}`, row] as const))(
      '%s',
      (_name, row) => {
        const { target, source } = row.make();
        const sourceBefore = show(source);
        if (row.throws) {
          expect(() => mergeDeep(target, source)).toThrow(row.throws);
          return;
        }
        const result = mergeDeep(target, source);
        // the first object is changed and returned, the second is not changed
        expect(result).toBe(target);
        expect(show(source)).toBe(sourceBefore);
        if ('expected' in row) expect(result).toStrictEqual(row.expected);
        row.check?.(result, target, source);
      }
    );

    test('the rows marked as fixed are the rows on which the old function threw, dropped a value or gave another result', () => {
      const fixedIds = rows.filter((row) => row.fixed).map((row) => row.id);
      const differs = rows
        .filter(
          (row) =>
            outcome(legacyMergeDeep, row.make) !== outcome(mergeDeep, row.make)
        )
        .map((row) => row.id);
      expect(differs).toEqual(fixedIds);
      expect(fixedIds).toHaveLength(25);
    });
  });

  describe('the arguments', () => {
    test.each([
      ['undefined', undefined],
      ['null', null],
      ['0', 0],
      ["''", ''],
      ['false', false],
      ['NaN', NaN],
    ])(
      'a falsy first argument (%s) is returned as it is, without reading the second argument',
      (_name, first) => {
        // reading the keys of this second argument throws
        const tripwire = new Proxy(
          {},
          {
            ownKeys: () => {
              throw new Error('the second argument was read');
            },
          }
        );
        expect(mergeDeep(first, tripwire)).toBe(first);
        expect(mergeDeep(first, { a: 1 })).toBe(first);
        expect(mergeDeep(first, null)).toBe(first);
        expect(mergeDeep(first, undefined)).toBe(first);
      }
    );

    test.each([
      ['undefined', undefined],
      ['null', null],
      ['a number', 5],
      ['a string', 'ab'],
      ['true', true],
      ['a function', () => ({ a: 2 })],
    ])('a second argument that is %s changes nothing', (_name, second) => {
      const first = { a: 1, b: { c: 2 } };
      expect(mergeDeep(first, second)).toBe(first);
      expect(first).toStrictEqual({ a: 1, b: { c: 2 } });
    });

    test('the key of a second object is applied whatever the type of the first value, in one call', () => {
      const first: any = {
        scalar: 'text',
        zero: 0,
        nothing: null,
        object: { keep: 1 },
        list: [1, 2],
      };
      mergeDeep(first, {
        scalar: { now: 'object' },
        zero: [5],
        nothing: { now: 'object' },
        object: null,
        list: 'gone',
      });
      expect(first).toStrictEqual({
        scalar: { now: 'object' },
        zero: [5],
        nothing: { now: 'object' },
        object: null,
        list: 'gone',
      });
    });

    test.each([
      ['0', 0],
      ["''", ''],
      ['false', false],
      ['undefined', undefined],
    ])(
      'a falsy value of the first object (%s) is replaced by an object, an array and null (they were dropped)',
      (_name, falsy) => {
        for (const value of [{ x: 1 }, [1], null]) {
          const first = { a: falsy };
          const second = { a: value };
          expect(mergeDeep(first, second)).toStrictEqual({ a: value });
          expect(first.a).toBe(value);
        }
      }
    );

    test('the public method of the facade does the same', () => {
      const json = JsonUtils();
      const first = { a: 5, b: { c: 1 } };
      expect(json.mergeDeep(first, { a: { x: 1 }, b: { d: 2 } })).toBe(first);
      expect(first).toStrictEqual({ a: { x: 1 }, b: { c: 1, d: 2 } });
      expect(json.mergeDeep(undefined, { a: 1 })).toBeUndefined();
    });
  });

  describe('arrays are merged by index', () => {
    test('arrays inside arrays merge element by element', () => {
      expect(mergeDeep({ a: [[1, 2], [3]] }, { a: [[9]] })).toStrictEqual({
        a: [[9, 2], [3]],
      });
    });

    test('at an index, a value of another type replaces the element of the first array', () => {
      expect(
        mergeDeep({ a: [1, { x: 1 }, [1]] }, { a: [{ y: 2 }, 5, { z: 3 }] })
      ).toStrictEqual({ a: [{ y: 2 }, 5, { z: 3 }] });
    });

    test('an object inside an array merges into the object of the first array at that index', () => {
      expect(
        mergeDeep({ a: [{ x: 1, y: { p: 1 } }] }, { a: [{ y: { q: 2 } }] })
      ).toStrictEqual({ a: [{ x: 1, y: { p: 1, q: 2 } }] });
    });

    test('the first array is never shortened, and a longer second array grows it', () => {
      const first = { a: [1, 2, 3] };
      mergeDeep(first, { a: [] });
      expect(first.a).toStrictEqual([1, 2, 3]);
      mergeDeep(first, { a: [0, 0, 0, 4, 5] });
      expect(first.a).toStrictEqual([0, 0, 0, 4, 5]);
    });

    test('an array in the second object is never concatenated to the array of the first', () => {
      expect(mergeDeep({ a: ['x', 'y'] }, { a: ['z'] }).a).toStrictEqual([
        'z',
        'y',
      ]);
    });
  });

  describe('which pairs of objects merge and which replace each other', () => {
    // One test per row of the table in the TSDoc. `source` is the value of the
    // second object, `target` the value of the first object under the same key.
    test('plain object into plain object: merged key by key, the first object stays', () => {
      const target = { x: 1 };
      const first: any = mergeDeep({ a: target }, { a: { y: 2 } });
      expect(first.a).toBe(target);
      expect(first.a).toStrictEqual({ x: 1, y: 2 });
    });

    test('plain object into a class instance: merged into the instance, which stays', () => {
      const target = new Foo();
      const first: any = mergeDeep({ a: target }, { a: { y: 2 } });
      expect(first.a).toBe(target);
      expect(first.a).toBeInstanceOf(Foo);
      expect(first.a).toMatchObject({ x: 1, y: 2 });
    });

    test('class instance into a plain object: its own enumerable string keys are merged into the plain object, which stays plain', () => {
      const target = { y: 2, x: 0 };
      const first: any = mergeDeep({ a: target }, { a: new Foo() });
      expect(first.a).toBe(target);
      expect(Object.getPrototypeOf(first.a)).toBe(Object.prototype);
      expect(first.a).toStrictEqual({ y: 2, x: 1 });
    });

    test('class instance into an instance of the same class: merged key by key, the first instance stays', () => {
      const target = new Foo();
      target.x = 5;
      const source = new Foo();
      (source as any).extra = { k: 1 };
      const first: any = mergeDeep({ a: target }, { a: source });
      expect(first.a).toBe(target);
      expect(first.a).toMatchObject({ x: 1, extra: { k: 1 } });
    });

    test('the same rules apply at every depth of a class instance', () => {
      class Holder {
        inner = { k: 2 };
        list = [9];
      }
      const first = mergeDeep(
        { a: { inner: { j: 1 }, list: [1, 2], keep: true } },
        { a: new Holder() }
      );
      expect(first.a).toStrictEqual({
        inner: { j: 1, k: 2 },
        list: [9, 2],
        keep: true,
      });
    });

    test('class instance into an instance of another class: replaces it by reference, the first instance is not changed', () => {
      const target = new Other();
      const source = new Foo();
      const first: any = mergeDeep({ a: target }, { a: source });
      expect(first.a).toBe(source);
      expect(target).toStrictEqual(new Other());
      expect(first.a).not.toHaveProperty('z');
    });

    test('an instance of a subclass into an instance of its base class (and the other way round) is another class: it replaces', () => {
      const base = new Foo();
      const sub = new Sub();
      expect((mergeDeep({ a: base }, { a: sub }) as any).a).toBe(sub);
      expect(base).toStrictEqual(new Foo());
      expect((mergeDeep({ a: sub }, { a: base }) as any).a).toBe(base);
      expect(sub).toStrictEqual(new Sub());
    });

    test('an https.Agent into the shared default agent (another class): replaces it by reference and the shared agent is not changed', () => {
      const shared = new SharedDefaultAgent();
      const own = new https.Agent({ maxSockets: 3 });
      const first: any = mergeDeep({ httpsAgent: shared }, { httpsAgent: own });
      expect(first.httpsAgent).toBe(own);
      expect(shared).toStrictEqual(new SharedDefaultAgent());
      expect(own.maxSockets).toBe(3);
    });

    test('a function and a scalar of the second object replace an instance; an instance replaces a scalar and a function', () => {
      const fn = () => 1;
      const foo = new Foo();
      const first: any = mergeDeep(
        { a: new Foo(), b: new Foo(), c: 1, d: () => 2 },
        { a: fn, b: 's', c: foo, d: foo }
      );
      expect(first.a).toBe(fn);
      expect(first.b).toBe('s');
      expect(first.c).toBe(foo);
      expect(first.d).toBe(foo);
    });

    describe('the built-in value types are never merged', () => {
      // the own enumerable keys of these are not their value
      const builtIns: [string, () => any][] = [
        ['a Date', () => new Date(5)],
        ['a RegExp', () => /x/g],
        ['an Error', () => new Error('made up')],
        ['a subclass of Error', () => new (class MadeUp extends Error {})('x')],
        ['a Map', () => new Map([[1, 2]])],
        ['a Set', () => new Set([1])],
        ['a WeakMap', () => new WeakMap()],
        ['a WeakSet', () => new WeakSet()],
        ['a Promise', () => Promise.resolve(1)],
        ['an ArrayBuffer', () => new ArrayBuffer(2)],
        ['a SharedArrayBuffer', () => new SharedArrayBuffer(2)],
        ['a typed array', () => new Uint8Array([1, 2])],
        ['a DataView', () => new DataView(new ArrayBuffer(2))],
        ['a Buffer', () => Buffer.from('ab')],
        ['a boxed Number', () => new Number(1)],
        ['a boxed String', () => new String('ab')],
        ['a boxed Boolean', () => new Boolean(true)],
        ['a boxed Symbol', () => Object(Symbol('s'))],
        ['a boxed BigInt', () => Object(BigInt(1))],
      ];

      test.each(builtIns)(
        '%s replaces a plain object and a class instance, and is replaced by a plain object, a class instance and its own type',
        (_name, make) => {
          // as the second value: it replaces
          const value = make();
          expect((mergeDeep({ a: { x: 1 } }, { a: value }) as any).a).toBe(
            value
          );
          expect((mergeDeep({ a: new Foo() }, { a: value }) as any).a).toBe(
            value
          );
          // as the first value: it is replaced and is not changed
          const held = make();
          const before = show(held);
          const plain = { x: 1 };
          expect((mergeDeep({ a: held }, { a: plain }) as any).a).toBe(plain);
          const foo = new Foo();
          expect((mergeDeep({ a: held }, { a: foo }) as any).a).toBe(foo);
          expect(show(held)).toBe(before);
          expect(held).not.toHaveProperty('x');
          // against a value of its own type
          const other = make();
          expect((mergeDeep({ a: make() }, { a: other }) as any).a).toBe(other);
        }
      );
    });

    test('an object without prototype in the second object is plain: it merges', () => {
      const source = Object.create(null);
      source.y = 2;
      expect(mergeDeep({ a: { x: 1 } }, { a: source })).toStrictEqual({
        a: { x: 1, y: 2 },
      });
    });

    test('an object without prototype in the first object takes a plain object of the second', () => {
      const inner = Object.create(null);
      inner.x = 1;
      const first: any = mergeDeep({ a: inner }, { a: { y: 2 } });
      expect(first.a).toBe(inner);
      expect(Object.getPrototypeOf(first.a)).toBeNull();
      expect({ ...first.a }).toStrictEqual({ x: 1, y: 2 });
    });
  });

  describe('keys that must never reach Object.prototype', () => {
    const polluted = 'polluted';

    afterEach(() => {
      // a merge that polluted must not leak into the other tests of the file
      delete (Object.prototype as any)[polluted];
    });

    /** Nothing reached Object.prototype, and the object (and the one at `a`) still has it as its prototype. */
    function expectNotPolluted(result: any, nested = false): void {
      expect(
        Object.prototype.hasOwnProperty.call(Object.prototype, polluted)
      ).toBe(false);
      expect(({} as any)[polluted]).toBeUndefined();
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(result[polluted]).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(
        false
      );
      if (nested) {
        expect(Object.getPrototypeOf(result.a)).toBe(Object.prototype);
        expect(result.a[polluted]).toBeUndefined();
        expect(
          Object.prototype.hasOwnProperty.call(result.a, '__proto__')
        ).toBe(false);
      }
    }

    test('PP1: a __proto__ key at the top level is skipped (the prototype of the result was swapped)', () => {
      const result = mergeDeep(
        {},
        JSON.parse('{"__proto__":{"polluted":"yes"},"kept":1}')
      );
      expectNotPolluted(result);
      expect(Object.keys(result)).toEqual(['kept']);
    });

    test('PP2: a __proto__ key in a nested object, the first object has an empty one, is skipped', () => {
      const result = mergeDeep(
        { a: {} },
        JSON.parse('{"a":{"__proto__":{"polluted":"yes"},"kept":1}}')
      );
      expectNotPolluted(result, true);
      expect(result.a).toStrictEqual({ kept: 1 });
    });

    test('PP3: constructor.prototype at the top level is data and reaches nothing', () => {
      const result = mergeDeep(
        {},
        JSON.parse('{"constructor":{"prototype":{"polluted":"yes"}}}')
      );
      expectNotPolluted(result);
      expect(result.constructor).toStrictEqual({
        prototype: { polluted: 'yes' },
      });
    });

    test('PP4: constructor.prototype in a nested object is data and reaches nothing', () => {
      const result = mergeDeep(
        { a: {} },
        JSON.parse('{"a":{"constructor":{"prototype":{"polluted":"yes"}}}}')
      );
      expectNotPolluted(result, true);
      expect(result.a.constructor).toStrictEqual({
        prototype: { polluted: 'yes' },
      });
    });

    test('PP5: a __proto__ key in a nested object, the first object has keys there, is skipped (the prototype was swapped)', () => {
      const result = mergeDeep(
        { a: { b: 1 } },
        JSON.parse('{"a":{"__proto__":{"polluted":"yes"}}}')
      );
      expectNotPolluted(result, true);
      expect(result.a).toStrictEqual({ b: 1 });
    });

    test('PP6: a __proto__ key in an object inside an array is skipped', () => {
      const result = mergeDeep(
        { a: [{}] },
        JSON.parse('{"a":[{"__proto__":{"polluted":"yes"}}]}')
      );
      expectNotPolluted(result);
      expect(Object.getPrototypeOf(result.a[0])).toBe(Object.prototype);
      expect(result.a[0][polluted]).toBeUndefined();
    });

    test('a first object that has an own __proto__ key keeps it and merges every other key', () => {
      const first = JSON.parse('{"__proto__":{"own":1}}');
      const result = mergeDeep(
        first,
        JSON.parse('{"__proto__":{"polluted":"yes"},"b":2}')
      );
      expect(result).toBe(first);
      expect(
        Object.getOwnPropertyDescriptor(first, '__proto__')?.value
      ).toEqual({
        own: 1,
      });
      expect(first.b).toBe(2);
      expect(({} as any)[polluted]).toBeUndefined();
    });
  });

  describe('own keys', () => {
    test('a value that the first object inherits is not merged into: a plain object of the second object becomes an own value', () => {
      const inherited = { x: 1 };
      const first: any = Object.create({ a: inherited });
      mergeDeep(first, { a: { y: 2 } });
      expect(inherited).toStrictEqual({ x: 1 });
      expect(Object.prototype.hasOwnProperty.call(first, 'a')).toBe(true);
      expect(first.a).toStrictEqual({ y: 2 });
    });

    test('a value of the first object that is own but not enumerable is merged into', () => {
      const first: any = {};
      const inner = { x: 1 };
      Object.defineProperty(first, 'a', {
        value: inner,
        enumerable: false,
        writable: true,
        configurable: true,
      });
      mergeDeep(first, { a: { y: 2 } });
      expect(first.a).toBe(inner);
      expect(first.a).toStrictEqual({ x: 1, y: 2 });
    });

    test('a JSON key named hasOwnProperty in the second object is copied and the keys after it still merge', () => {
      const result = mergeDeep(
        { a: { x: 1 }, b: { y: 1 } },
        JSON.parse('{"hasOwnProperty":{"z":1},"a":{"x":2},"b":{"w":2}}')
      );
      expect(result.a).toStrictEqual({ x: 2 });
      expect(result.b).toStrictEqual({ y: 1, w: 2 });
      expect(result.hasOwnProperty).toStrictEqual({ z: 1 });
    });

    test('a first object without prototype is merged at every depth', () => {
      const first = Object.create(null);
      first.a = Object.create(null);
      first.a.x = 1;
      const result = mergeDeep(first, { a: { y: 2 }, b: { z: 3 } });
      expect(result).toBe(first);
      expect(Object.getPrototypeOf(result.a)).toBeNull();
      expect({ ...result.a }).toStrictEqual({ x: 1, y: 2 });
      expect(result.b).toStrictEqual({ z: 3 });
    });
  });

  describe('what a caller of the public factory sees', () => {
    // The request override of frodo.factory.generate*Api reaches mergeDeep: the
    // default configuration of the instance is the first object (the default
    // headers, `proxy: false` and a shared agent that is not an https.Agent),
    // the override the second.
    const resource = { apiVersion: 'protocol=2.1,resource=1.0' };
    const switches = ['FRODO_MOCK', 'FRODO_POLLY_MODE'] as const;
    const saved: Record<string, string | undefined> = {};

    beforeEach(() => {
      // a record run (`FRODO_POLLY_MODE=record`) gives the instance no agents
      for (const name of switches) {
        saved[name] = process.env[name];
        delete process.env[name];
      }
    });

    afterEach(() => {
      for (const name of switches) {
        if (saved[name] === undefined) delete process.env[name];
        else process.env[name] = saved[name];
      }
    });

    /** The fields of an agent that are strings, numbers or booleans, as text. */
    const snapshot = (agent: any): string =>
      JSON.stringify(
        Object.fromEntries(
          Object.keys(agent)
            .filter((key) =>
              ['string', 'number', 'boolean'].includes(typeof agent[key])
            )
            .map((key) => [key, agent[key]])
        )
      );

    test('a proxy object in the request override is applied over the default proxy: false (it was dropped)', () => {
      const request = frodo.factory.generateAmApi(resource, {
        proxy: { protocol: 'http', host: 'proxy.example.com', port: 8080 },
      });
      expect(request.defaults.proxy).toStrictEqual({
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
      });
    });

    test('an https agent in the request override replaces the default agent by reference and leaves the shared agent alone (it threw)', () => {
      const own = new https.Agent({ maxSockets: 3 });
      const shared = frodo.factory.generateAmApi(resource).defaults.httpsAgent;
      expect(shared).toBeDefined();
      expect(shared).not.toBeInstanceOf(https.Agent);
      const before = snapshot(shared);
      const request = frodo.factory.generateAmApi(resource, {
        httpsAgent: own,
      });
      expect(request.defaults.httpsAgent).toBe(own);
      expect(own.maxSockets).toBe(3);
      expect(snapshot(shared)).toBe(before);
      expect(frodo.factory.generateAmApi(resource).defaults.httpsAgent).toBe(
        shared
      );
    });

    test('an AxiosHeaders instance in the request override merges into the default headers: they survive, its values win (it merged before)', () => {
      const request = frodo.factory.generateAmApi(resource, {
        headers: new AxiosHeaders({
          'X-Made-Up': 'yes',
          'Content-Type': 'text/plain',
        }),
      });
      const headers = request.defaults.headers as any;
      expect(headers['X-Made-Up']).toBe('yes');
      expect(headers['Content-Type']).toBe('text/plain');
      expect(headers['Accept-API-Version']).toBe(resource.apiVersion);
      expect(headers['User-Agent']).toBeDefined();
      expect(headers['X-ForgeRock-TransactionId']).toBeDefined();
    });

    test('a Headers instance in the request override has no own keys to merge and leaves the default headers as they are', () => {
      const request = frodo.factory.generateAmApi(resource, {
        headers: new Headers({ 'X-Made-Up': 'yes' }) as any,
      });
      const headers = request.defaults.headers as any;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Accept-API-Version']).toBe(resource.apiVersion);
      expect(headers['User-Agent']).toBeDefined();
    });

    test('a header and a timeout in the request override still merge with the defaults', () => {
      const request = frodo.factory.generateAmApi(resource, {
        headers: { 'X-Made-Up': 'yes' },
        timeout: 5000,
      });
      expect(request.defaults.timeout).toBe(5000);
      expect(request.defaults.headers).toMatchObject({
        'X-Made-Up': 'yes',
        'Content-Type': 'application/json',
      });
    });

    test('the merge of a default configuration and the overrides in the shape the factory uses', () => {
      const shared = new SharedDefaultAgent();
      const own = new https.Agent({ maxSockets: 3 });
      const defaults = () => ({
        timeout: 30000,
        headers: { 'X-A': 'a' },
        httpsAgent: shared,
        proxy: false,
      });
      const withProxy = mergeDeep(defaults(), {
        proxy: { host: 'h', port: 8080 },
      });
      expect(withProxy.proxy).toStrictEqual({ host: 'h', port: 8080 });
      const withAgent = mergeDeep(defaults(), { httpsAgent: own });
      expect(withAgent.httpsAgent).toBe(own);
      expect(shared.maxSockets).toBe(7);
      const withHeaders = mergeDeep(defaults(), {
        headers: new AxiosHeaders({ 'X-B': 'b' }),
      });
      expect({ ...withHeaders.headers }).toStrictEqual({
        'X-A': 'a',
        'X-B': 'b',
      });
    });
  });

  describe('a seeded fuzz over JSON values', () => {
    const KEYS = ['a', 'b', 'c', 'd'];
    const SCALARS = [0, 1, 2, '', 'x', 'y', true, false, 3.5];

    /** The same pairs on every run: a mulberry32 generator started from the seed. */
    function pairsFrom(seed: number): () => { first: any; second: any } {
      const random = (): number => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const pick = <T>(list: T[]): T =>
        list[Math.floor(random() * list.length)];
      const generate = (depth: number): any => {
        const r = random();
        if (depth <= 0 || r < 0.35)
          return random() < 0.15 ? null : pick(SCALARS);
        if (r < 0.7) {
          const object: Record<string, any> = {};
          const count = Math.floor(random() * 4);
          for (let i = 0; i < count; i++)
            object[pick(KEYS)] = generate(depth - 1);
          return object;
        }
        const list: any[] = [];
        const count = Math.floor(random() * 4);
        for (let i = 0; i < count; i++) list.push(generate(depth - 1));
        return list;
      };
      return () => ({
        first: { a: generate(3), b: generate(3), c: generate(2) },
        second: { a: generate(3), b: generate(3), d: generate(2) },
      });
    }

    const typeOf = (value: any): string =>
      value === null
        ? 'null'
        : Array.isArray(value)
          ? 'array'
          : typeof value === 'object'
            ? 'object'
            : 'scalar';

    /**
     * The type conflicts of a pair: the types that differ at a key both sides
     * have, walked the way the merge walks (only an object with an object, an
     * array with an array, is entered). The pairs object to scalar, array to
     * scalar, scalar to scalar, null to scalar and null to null are no
     * conflict: the old function handled them.
     */
    const conflicts = (target: any, source: any, found = new Set<string>()) => {
      for (const key of Object.keys(source)) {
        if (!(key in target)) continue;
        const from = typeOf(target[key]);
        const to = typeOf(source[key]);
        if (
          (from === 'object' && to === 'object') ||
          (from === 'array' && to === 'array')
        )
          conflicts(target[key], source[key], found);
        else if (
          [
            'object->scalar',
            'array->scalar',
            'scalar->scalar',
            'null->scalar',
            'null->null',
          ].includes(`${from}->${to}`)
        )
          continue;
        else found.add(`${from}->${to}`);
      }
      return found;
    };
    const clone = (value: any): any => JSON.parse(JSON.stringify(value));

    test('5000 pairs: never throws, changes only the first object and returns it, equals the reference implementation of the rules, equals the old function where it had no type conflict', () => {
      const nextPair = pairsFrom(20261122);
      const problems: string[] = [];
      let withConflict = 0;
      let withoutConflict = 0;
      const conflictTypes = new Set<string>();
      for (let i = 0; i < 5000; i++) {
        const { first, second } = nextPair();
        const found = conflicts(first, second);
        found.forEach((entry) => conflictTypes.add(entry));
        if (found.size === 0) withoutConflict++;
        else withConflict++;
        const input = JSON.stringify([first, second]);

        const target = clone(first);
        const source = clone(second);
        let result: any;
        try {
          result = mergeDeep(target, source);
        } catch (error) {
          problems.push(`throws ${(error as Error).message}: ${input}`);
          continue;
        }
        if (result !== target)
          problems.push(`does not return the first: ${input}`);
        if (!isDeepStrictEqual(source, second))
          problems.push(`changes the second: ${input}`);
        if (
          !isDeepStrictEqual(
            result,
            referenceMerge(clone(first), clone(second))
          )
        )
          problems.push(`differs from the reference implementation: ${input}`);
        if (
          found.size === 0 &&
          !isDeepStrictEqual(
            result,
            legacyMergeDeep(clone(first), clone(second))
          )
        )
          problems.push(
            `differs from the old function without a conflict: ${input}`
          );
      }
      expect(problems.slice(0, 3)).toEqual([]);
      expect(problems).toHaveLength(0);
      // the property is not vacuous: most pairs have a conflict, of every type
      expect(withConflict).toBeGreaterThan(3000);
      expect(withoutConflict).toBeGreaterThan(500);
      expect([...conflictTypes].sort()).toEqual([
        'array->null',
        'array->object',
        'null->array',
        'null->object',
        'object->array',
        'object->null',
        'scalar->array',
        'scalar->null',
        'scalar->object',
      ]);
    });

    test('the old function throws on many of the same pairs: the fuzz can fail', () => {
      const nextPair = pairsFrom(20261122);
      let throws = 0;
      for (let i = 0; i < 300; i++) {
        const { first, second } = nextPair();
        try {
          legacyMergeDeep(clone(first), clone(second));
        } catch {
          throws++;
        }
      }
      expect(throws).toBeGreaterThan(30);
    });
  });
});
