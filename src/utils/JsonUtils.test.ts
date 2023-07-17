/**
 * Run tests
 *
 *        npm run test:only JsonUtils
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { isEqualJson, get } from './JsonUtils';

describe('JsonUtils', () => {
  describe('isEqualJson()', () => {
    test('0: Method is implemented', async () => {
      expect(isEqualJson).toBeDefined();
    });

    test('1: two empty objects should be equal', () => {
      const obj1 = {};
      const obj2 = {};
      expect(isEqualJson(obj1, obj2)).toBeTruthy();
    });

    test('2: two objects with single and equal entry should be equal', () => {
      const obj1 = { key: 'value' };
      const obj2 = { key: 'value' };
      expect(isEqualJson(obj1, obj2)).toBeTruthy();
    });

    test('3: two objects with equal key but different value should not be equal', () => {
      const obj1 = { key: 'value1' };
      const obj2 = { key: 'value2' };
      expect(isEqualJson(obj1, obj2)).toBeFalsy();
    });

    test('4: two objects with differing keys but equal values should not be equal', () => {
      const obj1 = { key1: 'value' };
      const obj2 = { key2: 'value' };
      expect(isEqualJson(obj1, obj2)).toBeFalsy();
    });

    test('5: two objects with unequal amounts of entries should not be equal', () => {
      const obj1 = { key1: 'value' };
      const obj2 = { key1: 'value', key2: 'value2' };
      expect(isEqualJson(obj1, obj2)).toBeFalsy();
    });

    test('6: two objects with equal but nested keys should be equal', () => {
      const obj1 = { key1: 'value1', key2: { key3: 'value3' } };
      const obj2 = { key1: 'value1', key2: { key3: 'value3' } };
      expect(isEqualJson(obj1, obj2)).toBeTruthy();
    });

    test('7: two objects with equal but multi-nested keys should be equal', () => {
      const obj1 = {
        key1: 'value1',
        key2: {
          key3: 'value3',
          key4: {
            key5: 'value5',
          },
        },
      };
      const obj2 = {
        key1: 'value1',
        key2: {
          key3: 'value3',
          key4: {
            key5: 'value5',
          },
        },
      };
      expect(isEqualJson(obj1, obj2)).toBeTruthy();
    });

    test('8: two objects with equal multi-nested keys but unequal values should not be equal', () => {
      const obj1 = {
        key1: 'value1',
        key2: {
          key3: 'value3',
          key4: {
            key5: 'value5',
          },
        },
      };
      const obj2 = {
        key1: 'value1',
        key2: {
          key3: 'value3',
          key4: {
            key5: 'value',
          },
        },
      };
      expect(isEqualJson(obj1, obj2)).toBeFalsy();
    });

    test('9: two objects with equal multi-nested keys but unequal values with the offending key excluded should be equal', () => {
      const obj1 = {
        key1: 'value1',
        key2: {
          key3: 'value3',
          key4: {
            key5: 'value5',
          },
        },
      };
      const obj2 = {
        key1: 'value1',
        key2: {
          key3: 'value3',
          key4: {
            key5: 'value',
          },
        },
      };
      expect(isEqualJson(obj1, obj2, ['key5'])).toBeTruthy();
    });
  });

  describe('get()', () => {
    test('0: Method is implemented', async () => {
      expect(get).toBeDefined();
    });

    test('1: resolve an existing value', () => {
      const obj = { a: [{ b: { c: 3 } }] };
      expect(get(obj, ['a', '0', 'b', 'c'])).toEqual(3);
    });

    test('2: resolve a non-existing value w/o defaultValue', () => {
      const obj = { a: [{ b: { c: 3 } }] };
      expect(get(obj, ['a', 'b', 'c'])).toBeUndefined();
    });

    test('3: resolve a non-existing value w/ defaultValue', () => {
      const obj = { a: [{ b: { c: 3 } }] };
      expect(get(obj, ['a', 'b', 'c'], 'default')).toEqual('default');
    });
  });
});
