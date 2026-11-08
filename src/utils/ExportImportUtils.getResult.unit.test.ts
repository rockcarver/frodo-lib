/**
 * Unit tests for getResult(), the helper behind the bulk exports, imports and deletes that
 * report every item to a result callback.
 *
 * Run with:
 *
 *        npm run test:only ExportImportUtils.getResult
 *
 * Origin: frodo-cli#1099 (record 0040). getResult() passed a result to the callback only when
 * the result was truthy, so a call that succeeded and returned false, 0 or an empty string was
 * never reported, and a caller that counts successes through the callback counted too few.
 * No recording and no tenant is needed: the functions are fakes.
 */
import { jest } from '@jest/globals';
import { FrodoError } from '../ops/FrodoError';
import { getResult } from './ExportImportUtils';

describe('getResult()', () => {
  describe('a call that did not throw', () => {
    test.each([
      ['false', false],
      ['0', 0],
      ['an empty string', ''],
    ])(
      'reports a result of %s to the callback as a success',
      async (_name, value) => {
        const resultCallback = jest.fn();
        const func = jest.fn(async () => value);

        const result = await getResult(resultCallback, 'Error doing it', func);

        expect(result).toBe(value);
        expect(resultCallback).toHaveBeenCalledTimes(1);
        expect(resultCallback).toHaveBeenCalledWith(undefined, value);
      }
    );

    test.each([
      ['an object', { _id: 'a' }],
      ['an empty array', []],
      ['true', true],
    ])('still reports %s', async (_name, value) => {
      const resultCallback = jest.fn();

      const result = await getResult(
        resultCallback,
        'Error doing it',
        async () => value
      );

      expect(result).toBe(value);
      expect(resultCallback).toHaveBeenCalledTimes(1);
      expect(resultCallback).toHaveBeenCalledWith(undefined, value);
    });

    test.each([
      ['null', null],
      ['undefined', undefined],
    ])('does not report a result of %s', async (_name, value) => {
      const resultCallback = jest.fn();

      const result = await getResult(
        resultCallback,
        'Error doing it',
        async () => value
      );

      expect(result).toBe(value);
      expect(resultCallback).not.toHaveBeenCalled();
    });

    test('passes the parameters to the function and works without a callback', async () => {
      const func = jest.fn(async (...params: unknown[]) => params.length);

      const result = await getResult(
        undefined,
        'Error doing it',
        func,
        'a',
        'b'
      );

      expect(result).toBe(2);
      expect(func).toHaveBeenCalledWith('a', 'b');
    });
  });

  describe('a call that threw', () => {
    test('reports the failure to the callback, names it and returns null', async () => {
      const resultCallback = jest.fn();
      const cause = new Error('boom');

      const result = await getResult(
        resultCallback,
        'Error doing it',
        async () => {
          throw cause;
        }
      );

      expect(result).toBeNull();
      expect(resultCallback).toHaveBeenCalledTimes(1);
      const [error, value] = resultCallback.mock.calls[0] as [
        FrodoError,
        unknown,
      ];
      expect(error).toBeInstanceOf(FrodoError);
      expect(error.message).toBe('Error doing it');
      expect(error.originalErrors).toEqual([cause]);
      expect(value).toBeUndefined();
    });

    test('throws the failure when there is no callback', async () => {
      await expect(
        getResult(undefined, 'Error doing it', async () => {
          throw new Error('boom');
        })
      ).rejects.toMatchObject({
        name: 'FrodoError',
        message: 'Error doing it',
      });
    });

    test('ignores an operation that is not available in the cloud', async () => {
      const resultCallback = jest.fn();
      const notAvailable = Object.assign(new Error('not available'), {
        httpStatus: 403,
        httpMessage:
          'This operation is not available in PingOne Advanced Identity Cloud.',
      });

      const result = await getResult(
        resultCallback,
        'Error doing it',
        async () => {
          throw notAvailable;
        }
      );

      expect(result).toBeNull();
      expect(resultCallback).not.toHaveBeenCalled();
    });
  });
});
