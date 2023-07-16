/**
 * Run tests
 *
 *        npm run test:only JsonUtils
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { isEqualJson } from './JsonUtils';

describe('JsonUtils', () => {
  describe('OpsUtils - isEqualJson()', () => {
    test('isEqualJson() 0: Method is implemented', async () => {
      expect(isEqualJson).toBeDefined();
    });

    test('isEqualJson() 1: two empty objects should be equal', () => {
      const obj1 = {};
      const obj2 = {};
      expect(isEqualJson(obj1, obj2)).toBeTruthy();
    });

    test('isEqualJson() 2: two objects with single and equal entry should be equal', () => {
      const obj1 = { key: 'value' };
      const obj2 = { key: 'value' };
      expect(isEqualJson(obj1, obj2)).toBeTruthy();
    });

    test('isEqualJson() 3: two objects with equal key but different value should not be equal', () => {
      const obj1 = { key: 'value1' };
      const obj2 = { key: 'value2' };
      expect(isEqualJson(obj1, obj2)).toBeFalsy();
    });

    test('isEqualJson() 4: two objects with differing keys but equal values should not be equal', () => {
      const obj1 = { key1: 'value' };
      const obj2 = { key2: 'value' };
      expect(isEqualJson(obj1, obj2)).toBeFalsy();
    });

    test('isEqualJson() 5: two objects with unequal amounts of entries should not be equal', () => {
      const obj1 = { key1: 'value' };
      const obj2 = { key1: 'value', key2: 'value2' };
      expect(isEqualJson(obj1, obj2)).toBeFalsy();
    });

    test('isEqualJson() 6: two objects with equal but nested keys should be equal', () => {
      const obj1 = { key1: 'value1', key2: { key3: 'value3' } };
      const obj2 = { key1: 'value1', key2: { key3: 'value3' } };
      expect(isEqualJson(obj1, obj2)).toBeTruthy();
    });

    test('isEqualJson() 7: two objects with equal but multi-nested keys should be equal', () => {
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

    test('isEqualJson() 8: two objects with equal multi-nested keys but unequal values should not be equal', () => {
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

    test('isEqualJson() 9: two objects with equal multi-nested keys but unequal values with the offending key excluded should be equal', () => {
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
});
