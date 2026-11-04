/**
 * Run tests
 *
 *        npm run test:only JsonUtils
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import JsonUtils, {
  deleteDeepByKey,
  deleteDeepByKeys,
  get,
  isEqualJson,
} from './JsonUtils';

const nestedKeys = () => ({
  modified: 1,
  modifiedBy: 'x',
  nested: {
    modified: 2,
    modifiedAt: 3,
    deeper: [{ modified: 4, lastmodified: 5, keep: 6 }],
  },
});
const withoutExactModified = {
  modifiedBy: 'x',
  nested: { modifiedAt: 3, deeper: [{ lastmodified: 5, keep: 6 }] },
};

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

  describe('deleteDeepByKey()', () => {
    test('0: Method is implemented', async () => {
      expect(deleteDeepByKey).toBeDefined();
    });

    test('1: delete by key exact match', () => {
      const obj = {
        key1: 'first',
        key2: 2,
        key3: true,
      };
      const result = deleteDeepByKey(obj, 'key2', true);
      expect(result).toMatchObject({
        key1: 'first',
        key3: true,
      });
      expect(result).toBe(obj);
    });

    test('2: delete by key substring match', () => {
      const obj = {
        key1: 'first',
        key2: 2,
        key3: true,
        old1: 'old',
        old2: 'two',
        old3: 3,
      };
      const result = deleteDeepByKey(obj, '1', false);
      expect(result).toMatchObject({
        key2: 2,
        key3: true,
        old2: 'two',
        old3: 3,
      });
      expect(result).toBe(obj);
    });

    test('3: exact match keeps keys that only contain the key, at every depth', () => {
      expect(deleteDeepByKey(nestedKeys(), 'modified', true)).toStrictEqual(
        withoutExactModified
      );
    });

    test('4: without the flag, keys that contain the key are deleted', () => {
      const obj = {
        'password-encrypted': 'a',
        password: 'b',
        nested: { 'secret-encrypted': 'c', keep: 'd' },
      };
      expect(deleteDeepByKey(obj, '-encrypted')).toStrictEqual({
        password: 'b',
        nested: { keep: 'd' },
      });
    });

    test('5: the Json facade defaults to substring and passes exact on', () => {
      const json = JsonUtils();
      expect(
        json.deleteDeepByKey({ 'a-encrypted': 1, b: 2 }, '-encrypted')
      ).toStrictEqual({ b: 2 });
      expect(
        json.deleteDeepByKey(nestedKeys(), 'modified', true)
      ).toStrictEqual(withoutExactModified);
    });
  });

  describe('deleteDeepByKeys()', () => {
    test('0: Method is implemented', async () => {
      expect(deleteDeepByKeys).toBeDefined();
    });

    test('1: delete by keys exact match', () => {
      const array = [
        {
          key1: 'first',
          key2: 2,
          key3: true,
        },
      ];
      const result = deleteDeepByKeys(array, ['key1', 'key2'], true);
      expect(result).toEqual([
        {
          key3: true,
        },
      ]);
      expect(result).toBe(array);
    });

    test('2: delete by keys substring match', () => {
      const array = [
        {
          key1: 'first',
          key2: 2,
          key3: true,
          old1: 'old',
          old2: 'two',
          old3: 3,
        },
      ];
      const result = deleteDeepByKeys(array, ['1', '2'], false);
      expect(result).toEqual([
        {
          key3: true,
          old3: 3,
        },
      ]);
      expect(result).toBe(array);
    });

    test('3: exact match keeps keys that only contain a key, at every depth', () => {
      expect(
        deleteDeepByKeys([nestedKeys()], ['modified'], true)
      ).toStrictEqual([withoutExactModified]);
    });

    test('4: without the flag, keys that contain a key are deleted', () => {
      expect(
        deleteDeepByKeys([{ 'a-encrypted': 1, b: 2 }], ['-encrypted'])
      ).toStrictEqual([{ b: 2 }]);
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
