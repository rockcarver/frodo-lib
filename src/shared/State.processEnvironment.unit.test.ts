/**
 * Run tests
 *
 *        npm run test:only -- src/shared/State.processEnvironment
 *
 * The switch `setUseProcessEnvironmentForPlaceholders` lets the placeholders `${NAME}` of the files that the library
 * reads fall back to the environment variables of the process (frodo-lib#1109). It must be off for every caller that
 * does not ask for it, belong to one state, and never come from the environment, a profile or a file. What it does to
 * placeholders is tested in `ExportImportUtils.processEnvironment.unit.test.ts` and `IdmConfigOps.processEnvironment`.
 *
 * Hermetic: no network, no files.
 */
import StateImpl, { deriveState } from './State';

describe('State: placeholders from the process environment', () => {
  test('1: is off by default', () => {
    expect(StateImpl({}).getUseProcessEnvironmentForPlaceholders()).toBe(false);
  });

  test('2: is turned on and off with setUseProcessEnvironmentForPlaceholders', () => {
    const state = StateImpl({});
    state.setUseProcessEnvironmentForPlaceholders(true);
    expect(state.getUseProcessEnvironmentForPlaceholders()).toBe(true);
    state.setUseProcessEnvironmentForPlaceholders(false);
    expect(state.getUseProcessEnvironmentForPlaceholders()).toBe(false);
  });

  test('3: belongs to one state, not to the process', () => {
    const first = StateImpl({});
    const second = StateImpl({});
    first.setUseProcessEnvironmentForPlaceholders(true);
    expect(first.getUseProcessEnvironmentForPlaceholders()).toBe(true);
    expect(second.getUseProcessEnvironmentForPlaceholders()).toBe(false);
    expect(StateImpl({}).getUseProcessEnvironmentForPlaceholders()).toBe(false);
  });

  test('4: is off again after reset', () => {
    const state = StateImpl({});
    state.setUseProcessEnvironmentForPlaceholders(true);
    state.reset();
    expect(state.getUseProcessEnvironmentForPlaceholders()).toBe(false);
  });

  test('5: a derived state answers with the switch of its parent', () => {
    const parent = StateImpl({});
    const derived = deriveState(parent, { getIdmHost: () => 'https://x/y' });
    expect(derived.getUseProcessEnvironmentForPlaceholders()).toBe(false);
    parent.setUseProcessEnvironmentForPlaceholders(true);
    expect(derived.getUseProcessEnvironmentForPlaceholders()).toBe(true);
  });

  test('6: is not read from the environment of the process', () => {
    const names = [
      'FRODO_USE_PROCESS_ENVIRONMENT_FOR_PLACEHOLDERS',
      'FRODO_PROCESS_ENVIRONMENT_PLACEHOLDERS',
      'FRODO_PLACEHOLDERS_FROM_ENV',
    ];
    for (const name of names) process.env[name] = 'true';
    try {
      expect(StateImpl({}).getUseProcessEnvironmentForPlaceholders()).toBe(
        false
      );
    } finally {
      for (const name of names) delete process.env[name];
    }
  });

  test('7: only true turns it on: a value that is merely truthy does not', () => {
    const state = StateImpl({});
    state.setUseProcessEnvironmentForPlaceholders('yes' as unknown as boolean);
    expect(state.getUseProcessEnvironmentForPlaceholders()).toBe(false);
  });
});
