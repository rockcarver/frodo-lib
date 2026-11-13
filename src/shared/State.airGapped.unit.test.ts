import StateImpl, { deriveState } from './State';

describe('State air-gapped mode', () => {
  test('1: is off by default', () => {
    expect(StateImpl({}).getAirGapped()).toBe(false);
  });

  test('2: is turned on and off with setAirGapped', () => {
    const state = StateImpl({});
    state.setAirGapped(true);
    expect(state.getAirGapped()).toBe(true);
    state.setAirGapped(false);
    expect(state.getAirGapped()).toBe(false);
  });

  test('3: belongs to one state, not to the process', () => {
    const first = StateImpl({});
    const second = StateImpl({});
    first.setAirGapped(true);
    expect(first.getAirGapped()).toBe(true);
    expect(second.getAirGapped()).toBe(false);
    expect(StateImpl({}).getAirGapped()).toBe(false);
  });

  test('4: is off again after reset', () => {
    const state = StateImpl({});
    state.setAirGapped(true);
    state.reset();
    expect(state.getAirGapped()).toBe(false);
  });

  test('5: a derived state answers with the mode of its parent', () => {
    const parent = StateImpl({});
    const derived = deriveState(parent, { getIdmHost: () => 'https://x/y' });
    expect(derived.getAirGapped()).toBe(false);
    parent.setAirGapped(true);
    expect(derived.getAirGapped()).toBe(true);
  });

  test('6: is not read from the environment', () => {
    process.env.FRODO_AIR_GAPPED = 'true';
    process.env.FRODO_AIRGAPPED = 'true';
    try {
      expect(StateImpl({}).getAirGapped()).toBe(false);
    } finally {
      delete process.env.FRODO_AIR_GAPPED;
      delete process.env.FRODO_AIRGAPPED;
    }
  });
});
