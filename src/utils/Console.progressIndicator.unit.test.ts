/**
 * Run tests
 *
 *        npm run test:only Console.progressIndicator
 *
 * Unit tests of the progress indicator calls in Console.ts: no recordings, no
 * tenant. An operation that fails before it created its progress indicator
 * still stops it in its catch block, with the id it never got. The caller's
 * handler must never see that call, because it can only report it as an
 * unknown indicator on top of the real error.
 */
import { jest } from '@jest/globals';
import StateImpl from '../shared/State';
import {
  createProgressIndicator,
  stopProgressIndicator,
  updateProgressIndicator,
} from './Console';

/** The ids an operation has when it failed before it created its indicator. */
const NO_ID: [string, any][] = [
  ['undefined', undefined],
  ['null', null],
  ['an empty string', ''],
];

function newState() {
  const create = jest.fn<any>(() => 'created-by-handler');
  const update = jest.fn<any>();
  const stop = jest.fn<any>();
  const debug = jest.fn<any>();
  const state = StateImpl({});
  state.setCreateProgressHandler(create);
  state.setUpdateProgressHandler(update);
  state.setStopProgressHandler(stop);
  state.setDebugHandler(debug);
  return { state, create, update, stop, debug };
}

describe('Console progress indicators', () => {
  describe('stopProgressIndicator()', () => {
    test.each(NO_ID)(
      '1: ignores %s as the id: the handler is not called and nothing throws',
      (_name, id) => {
        const { state, stop } = newState();
        expect(() =>
          stopProgressIndicator({
            id,
            message: 'Error exporting things',
            status: 'fail',
            state,
          })
        ).not.toThrow();
        expect(stop).not.toHaveBeenCalled();
      }
    );

    test.each(NO_ID)(
      '2: leaves a trace in the debug output when it ignores %s',
      (_name, id) => {
        const { state, debug } = newState();
        stopProgressIndicator({ id, state });
        expect(debug).toHaveBeenCalledTimes(1);
        expect(typeof debug.mock.calls[0][0]).toBe('string');
      }
    );

    test('3: passes a real id with its message and status to the handler', () => {
      const { state, stop, debug } = newState();
      stopProgressIndicator({
        id: 'abc',
        message: 'Exported 3 things.',
        status: 'success',
        state,
      });
      expect(stop).toHaveBeenCalledTimes(1);
      expect(stop).toHaveBeenCalledWith('abc', 'Exported 3 things.', 'success');
      expect(debug).not.toHaveBeenCalled();
    });

    test('4: passes the defaults of a stop that has only an id', () => {
      const { state, stop } = newState();
      stopProgressIndicator({ id: 'abc', state });
      expect(stop).toHaveBeenCalledWith('abc', null, 'none');
    });

    test('5: passes an id nobody created on, the handler is the one that knows the indicators', () => {
      const { state, stop } = newState();
      stopProgressIndicator({ id: 'never-created', state });
      expect(stop).toHaveBeenCalledTimes(1);
      expect(stop.mock.calls[0][0]).toBe('never-created');
    });

    test('6: does not hide a failure of the handler for a real id', () => {
      const { state, stop } = newState();
      stop.mockImplementation(() => {
        throw new Error('handler failed');
      });
      expect(() => stopProgressIndicator({ id: 'abc', state })).toThrow(
        'handler failed'
      );
    });

    test('7: does nothing when the caller registered no handler', () => {
      const state = StateImpl({});
      expect(() =>
        stopProgressIndicator({ id: 'abc', message: 'done', state })
      ).not.toThrow();
      expect(() =>
        stopProgressIndicator({ id: undefined, message: 'done', state })
      ).not.toThrow();
    });
  });

  describe('updateProgressIndicator()', () => {
    test.each(NO_ID)(
      '1: ignores %s as the id: the handler is not called and nothing throws',
      (_name, id) => {
        const { state, update } = newState();
        expect(() =>
          updateProgressIndicator({ id, message: 'Exporting thing', state })
        ).not.toThrow();
        expect(update).not.toHaveBeenCalled();
      }
    );

    test.each(NO_ID)(
      '2: leaves a trace in the debug output when it ignores %s',
      (_name, id) => {
        const { state, debug } = newState();
        updateProgressIndicator({ id, state });
        expect(debug).toHaveBeenCalledTimes(1);
        expect(typeof debug.mock.calls[0][0]).toBe('string');
      }
    );

    test('3: passes a real id and its message to the handler', () => {
      const { state, update, debug } = newState();
      updateProgressIndicator({
        id: 'abc',
        message: 'Exporting thing',
        state,
      });
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith('abc', 'Exporting thing');
      expect(debug).not.toHaveBeenCalled();
    });

    test('4: passes an id nobody created on, the handler is the one that knows the indicators', () => {
      const { state, update } = newState();
      updateProgressIndicator({ id: 'never-created', state });
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0]).toBe('never-created');
    });

    test('5: does not hide a failure of the handler for a real id', () => {
      const { state, update } = newState();
      update.mockImplementation(() => {
        throw new Error('handler failed');
      });
      expect(() => updateProgressIndicator({ id: 'abc', state })).toThrow(
        'handler failed'
      );
    });

    test('6: does nothing when the caller registered no handler', () => {
      const state = StateImpl({});
      expect(() =>
        updateProgressIndicator({ id: 'abc', message: 'working', state })
      ).not.toThrow();
      expect(() =>
        updateProgressIndicator({ id: null, message: 'working', state })
      ).not.toThrow();
    });
  });

  describe('createProgressIndicator()', () => {
    test('1: returns the id the handler made, with the type, total and message', () => {
      const { state, create } = newState();
      const id = createProgressIndicator({
        total: 5,
        message: 'Exporting things...',
        type: 'indeterminate',
        state,
      });
      expect(id).toBe('created-by-handler');
      expect(create).toHaveBeenCalledWith(
        'indeterminate',
        5,
        'Exporting things...'
      );
    });

    test('2: makes up a different id for each call when the caller registered no handler', () => {
      const state = StateImpl({});
      const first = createProgressIndicator({ total: 1, state });
      const second = createProgressIndicator({ total: 1, state });
      expect(typeof first).toBe('string');
      expect(first).not.toBe('');
      expect(second).not.toBe(first);
    });

    test('3: does not hide a failure of the handler', () => {
      const { state, create } = newState();
      create.mockImplementation(() => {
        throw new Error('cannot create');
      });
      expect(() => createProgressIndicator({ total: 1, state })).toThrow(
        'cannot create'
      );
    });
  });
});
