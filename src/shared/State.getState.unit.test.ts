/**
 * Run tests
 *
 *        NODE_OPTIONS=--experimental-vm-modules npx jest --silent State.getState
 */
import { setTimeout as delay } from 'node:timers';
import StateImpl from './State';

describe('getState()', () => {
  it('returns a JSON-serialisable snapshot after an auto-refresh timer is set', () => {
    const state = StateImpl({
      host: 'https://openam-frodo-dev.example.com/am',
      realm: 'alpha',
    });
    const timer = delay(() => {}, 60_000);
    timer.unref?.();
    try {
      state.setAutoRefreshTimer(timer);
      const snapshot = state.getState();
      expect(snapshot).not.toHaveProperty('autoRefreshTimer');
      expect(() => JSON.stringify(snapshot)).not.toThrow();
      expect(JSON.parse(JSON.stringify(snapshot)).host).toBe(
        'https://openam-frodo-dev.example.com/am'
      );
      // The live timer remains reachable through its dedicated accessor.
      expect(state.getAutoRefreshTimer()).toBe(timer);
    } finally {
      clearTimeout(timer);
    }
  });
});
