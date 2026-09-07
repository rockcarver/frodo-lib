/**
 * Run tests
 *
 *        npm run test:only CallerTrustTierOps
 *
 * Regression coverage for Phase G's determineCallerTrustTier(): the
 * short-circuit to 'full-trust' for every non-browser auth mode, the
 * conservative 'delegated' default for a real interactive login with no
 * customer-supplied resolver, the extension point taking priority when one
 * is configured, and per-session caching.
 */
import { jest } from '@jest/globals';

import { determineCallerTrustTier } from './CallerTrustTierOps';
import StateImpl from '../shared/State';

describe('determineCallerTrustTier', () => {
  test('1: Short-circuits to full-trust for a non-interactive (e.g. admin-account) session, without consulting a resolver', async () => {
    const state = StateImpl({ host: 'https://openam-example.com/am' });
    const resolver = jest.fn(async () => 'delegated' as const);
    state.setCallerTrustTierResolver(resolver);

    const tier = await determineCallerTrustTier({ state });

    expect(tier).toBe('full-trust');
    expect(resolver).not.toHaveBeenCalled();
  });

  test('2: Defaults an interactive (browser-login) session with no configured resolver to the conservative delegated tier', async () => {
    const state = StateImpl({ host: 'https://openam-example.com/am' });
    state.setAuthMode('interactive');

    const tier = await determineCallerTrustTier({ state });

    expect(tier).toBe('delegated');
  });

  test('3: An interactive session with a configured resolver uses its result instead of the conservative default', async () => {
    const state = StateImpl({ host: 'https://openam-example.com/am' });
    state.setAuthMode('interactive');
    state.setCallerTrustTierResolver(async () => 'full-trust');

    const tier = await determineCallerTrustTier({ state });

    expect(tier).toBe('full-trust');
  });

  test('4: Caches the result for the life of the session, only ever consulting the resolver once', async () => {
    const state = StateImpl({ host: 'https://openam-example.com/am' });
    state.setAuthMode('interactive');
    const resolver = jest.fn(async () => 'delegated' as const);
    state.setCallerTrustTierResolver(resolver);

    const first = await determineCallerTrustTier({ state });
    const second = await determineCallerTrustTier({ state });

    expect(first).toBe('delegated');
    expect(second).toBe('delegated');
    expect(resolver).toHaveBeenCalledTimes(1);
  });
});
