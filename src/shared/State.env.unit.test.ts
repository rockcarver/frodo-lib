/**
 * Run tests
 *
 *        npm run test:only -- src/shared/State.env
 *
 * Part of the hardening of State defaults (see State.headerOverrides.unit.test.ts).
 *
 * A state is built from a module-level default object. The map of environment
 * values (`setEnv`, `setEnvs`, the values of `--env` and `--env-file` in the
 * CLI) used to be the map of that default object, so every state that did not
 * bring its own map wrote into the same one: a value set through one state was
 * visible through every other state, through states created later, and through
 * the same state after `reset()`. These tests prove that each state owns its
 * map, and that a single state behaves as before.
 *
 * Hermetic: made-up values, no network, no files.
 */
import { replaceEnvSpecificValues } from '../utils/ExportImportUtils';
import StateImpl, { deriveState } from './State';

const host = 'https://openam-matrix.example.com/am';
const otherHost = 'https://openam-zion.example.com/am';

describe('Environment values of a state', () => {
  test('1: a state that set nothing starts with no values', () => {
    const state = StateImpl({ host });
    expect(state.getEnvs()).toEqual({});
    expect(state.getEnv('MADE_UP')).toBeUndefined();
  });

  test('2: a value set through setEnv is not visible through another state, nor through one created later', () => {
    const first = StateImpl({ host });
    const bystander = StateImpl({ host: otherHost });
    first.setEnv('MADE_UP', 'made-up-value');

    expect(first.getEnv('MADE_UP')).toBe('made-up-value');
    expect(bystander.getEnv('MADE_UP')).toBeUndefined();
    expect(bystander.getEnvs()).toEqual({});
    expect(StateImpl({ host: otherHost }).getEnvs()).toEqual({});
  });

  test('3: values set through setEnvs are not visible through another state, nor through one created later', () => {
    const first = StateImpl({ host });
    const bystander = StateImpl({ host: otherHost });
    first.setEnvs({ MADE_UP: 'made-up-value', OTHER: 'other-value' });

    expect(first.getEnvs()).toEqual({
      MADE_UP: 'made-up-value',
      OTHER: 'other-value',
    });
    expect(bystander.getEnvs()).toEqual({});
    expect(StateImpl({ host: otherHost }).getEnvs()).toEqual({});
  });

  test('4: after a reset the state has no values, and what it sets later is still its own', () => {
    const first = StateImpl({ host });
    const bystander = StateImpl({ host: otherHost });
    first.setEnv('BEFORE', 'before-value');
    first.reset();
    expect(first.getEnvs()).toEqual({});

    first.setEnv('AFTER', 'after-value');
    first.setEnvs({ AFTER_MANY: 'after-many-value' });

    expect(first.getEnvs()).toEqual({
      AFTER: 'after-value',
      AFTER_MANY: 'after-many-value',
    });
    expect(bystander.getEnvs()).toEqual({});
    expect(StateImpl({ host: otherHost }).getEnvs()).toEqual({});
  });

  test('5: a reset of one state leaves the values of another state as they are', () => {
    const first = StateImpl({ host });
    const second = StateImpl({ host: otherHost });
    first.setEnv('FIRST', 'first-value');
    second.setEnv('SECOND', 'second-value');
    first.reset();

    expect(second.getEnvs()).toEqual({ SECOND: 'second-value' });
  });

  test('6: values given in the initial state are the state’s own copy, and the given object stays as it was', () => {
    const given = { GIVEN: 'given-value' };
    const first = StateImpl({ host, env: given });
    expect(first.getEnvs()).toEqual({ GIVEN: 'given-value' });

    first.setEnv('ADDED', 'added-value');
    first.setEnvs({ MERGED: 'merged-value' });

    expect(given).toEqual({ GIVEN: 'given-value' });
    expect(StateImpl({ host: otherHost }).getEnvs()).toEqual({});
  });

  test('7: two states built from the same initial values do not share them', () => {
    const given = { GIVEN: 'given-value' };
    const first = StateImpl({ host, env: given });
    const second = StateImpl({ host: otherHost, env: given });
    first.setEnv('GIVEN', 'changed-by-first');

    expect(first.getEnv('GIVEN')).toBe('changed-by-first');
    expect(second.getEnv('GIVEN')).toBe('given-value');
  });

  test('8: a single state still sets, reads, merges and clears', () => {
    const state = StateImpl({ host });
    state.setEnv('ONE', '1');
    state.setEnv('TWO', '2');
    expect(state.getEnv('ONE')).toBe('1');
    expect(state.getEnvs()).toEqual({ ONE: '1', TWO: '2' });

    // merge: keeps the other values, replaces the one with the same name
    state.setEnvs({ TWO: 'two', THREE: '3' });
    expect(state.getEnvs()).toEqual({ ONE: '1', TWO: 'two', THREE: '3' });
    state.setEnvs({ FOUR: '4' }, false);
    expect(state.getEnvs()).toEqual({
      ONE: '1',
      TWO: 'two',
      THREE: '3',
      FOUR: '4',
    });

    // clear: only the given values remain
    state.setEnvs({ ONLY: 'only' }, true);
    expect(state.getEnvs()).toEqual({ ONLY: 'only' });
    expect(state.getEnv('ONE')).toBeUndefined();

    state.reset();
    expect(state.getEnvs()).toEqual({});
  });

  test('9: getEnvs answers a copy; changing it does not change the state', () => {
    const state = StateImpl({ host });
    state.setEnv('ONE', '1');
    const copy = state.getEnvs();
    copy.ONE = 'changed';
    copy.EXTRA = 'extra';

    expect(state.getEnvs()).toEqual({ ONE: '1' });
  });

  test.each([
    ['merged', false],
    ['replacing the values', true],
  ])(
    '10: setEnvs leaves the object it was given as it was (%s)',
    (_name, clear) => {
      const state = StateImpl({ host });
      const given = { GIVEN: 'given-value' };
      state.setEnvs(given, clear);
      state.setEnv('ADDED', 'added-value');
      state.setEnvs({ MERGED: 'merged-value' });

      expect(given).toEqual({ GIVEN: 'given-value' });
      expect(state.getEnvs()).toEqual({
        GIVEN: 'given-value',
        ADDED: 'added-value',
        MERGED: 'merged-value',
      });
    }
  );

  test('11: a view derived from a state sees the values of that state', () => {
    const parent = StateImpl({ host });
    parent.setEnv('MADE_UP', 'made-up-value');
    const view = deriveState(parent, { getIdmHost: () => 'https://view' });

    expect(view.getEnv('MADE_UP')).toBe('made-up-value');
    parent.setEnv('LATER', 'later-value');
    expect(view.getEnv('LATER')).toBe('later-value');
  });

  test('12: the placeholders of a text are resolved from the values of the state it is given', () => {
    const first = StateImpl({ host });
    const second = StateImpl({ host: otherHost });
    first.setEnv('NAME', 'first-name');
    second.setEnv('NAME', 'second-name');

    expect(
      replaceEnvSpecificValues({ content: 'hello ${NAME}', state: first })
    ).toBe('hello first-name');
    expect(
      replaceEnvSpecificValues({ content: 'hello ${NAME}', state: second })
    ).toBe('hello second-name');
    expect(() =>
      replaceEnvSpecificValues({
        content: 'hello ${NAME}',
        state: StateImpl({ host }),
      })
    ).toThrow('No value found for placeholder "NAME"');
  });
});
