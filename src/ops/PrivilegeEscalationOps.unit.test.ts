/**
 * Run tests
 *
 *        npm run test:only PrivilegeEscalationOps
 *
 * Regression coverage for the pure ranking/classification logic behind
 * item 1+21's "try the least-privileged available credential, escalate on
 * a real insufficient-scope failure" mechanism: classifying a credential's
 * tier from its own AM-native privilege groups, and picking the next
 * untried, least-additionally-privileged candidate to escalate to.
 */
import { jest } from '@jest/globals';

const readUser = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('./UserOps', () => ({
  readUser,
}));

const { classifyCredentialTier, pickNextEscalationCandidate } = await import(
  './PrivilegeEscalationOps'
);
const { default: StateImpl } = await import('../shared/State');

describe('classifyCredentialTier', () => {
  beforeEach(() => {
    readUser.mockReset();
  });

  test.each([
    ['cn=super-admins,ou=groups,o=root,ou=identities', 'super-admin'],
    ['cn=tenant-admins,ou=groups,o=root,ou=identities', 'tenant-admin'],
    ['cn=tenant-auditor,ou=groups,o=root,ou=identities', 'tenant-auditor'],
    ['cn=brand-admin,ou=groups,o=root,ou=identities', 'theme-admin'],
  ])('classifies isMemberOf %s as %s', async (dn, expectedTier) => {
    readUser.mockResolvedValue({ isMemberOf: [dn] });
    const state = StateImpl({ host: 'https://openam-example.com/am' });

    const tier = await classifyCredentialTier({
      username: 'someone',
      state,
    });

    expect(tier).toBe(expectedTier);
  });

  test('classifies no recognized group as unknown', async () => {
    readUser.mockResolvedValue({ isMemberOf: ['cn=some-other-group,ou=groups,o=root,ou=identities'] });
    const state = StateImpl({ host: 'https://openam-example.com/am' });

    const tier = await classifyCredentialTier({ username: 'someone', state });

    expect(tier).toBe('unknown');
  });

  test('classifies a missing username as unknown, without calling readUser()', async () => {
    const state = StateImpl({ host: 'https://openam-example.com/am' });

    const tier = await classifyCredentialTier({ username: undefined, state });

    expect(tier).toBe('unknown');
    expect(readUser).not.toHaveBeenCalled();
  });

  test('classifies a readUser() failure as unknown rather than throwing', async () => {
    readUser.mockRejectedValue(new Error('403'));
    const state = StateImpl({ host: 'https://openam-example.com/am' });

    const tier = await classifyCredentialTier({ username: 'someone', state });

    expect(tier).toBe('unknown');
  });
});

describe('pickNextEscalationCandidate', () => {
  test('picks the untried candidate with the lowest rank, never jumping straight to the most privileged one', () => {
    const picked = pickNextEscalationCandidate({
      available: [
        { source: 'user', tier: 'super-admin' },
        { source: 'svcacct', tier: 'service-account' },
        { source: 'browser', tier: 'tenant-admin' },
      ],
      tried: new Set(),
    });

    // The browser (tenant-admin) session ranks lowest of the three
    // available candidates — tried first, not the highest-privilege one.
    expect(picked).toEqual({ source: 'browser', tier: 'tenant-admin' });
  });

  test('skips already-tried sources', () => {
    const picked = pickNextEscalationCandidate({
      available: [
        { source: 'browser', tier: 'tenant-admin' },
        { source: 'svcacct', tier: 'service-account' },
        { source: 'user', tier: 'super-admin' },
      ],
      tried: new Set(['browser']),
    });

    expect(picked).toEqual({ source: 'svcacct', tier: 'service-account' });
  });

  test('returns undefined once every available candidate has been tried', () => {
    const picked = pickNextEscalationCandidate({
      available: [
        { source: 'browser', tier: 'tenant-admin' },
        { source: 'svcacct', tier: 'service-account' },
      ],
      tried: new Set(['browser', 'svcacct']),
    });

    expect(picked).toBeUndefined();
  });

  test('an unclassified (unknown) candidate ranks lowest of all, regardless of source', () => {
    const picked = pickNextEscalationCandidate({
      available: [
        { source: 'svcacct', tier: 'service-account' },
        { source: 'user', tier: 'unknown' },
      ],
      tried: new Set(),
    });

    expect(picked).toEqual({ source: 'user', tier: 'unknown' });
  });

  test("theme-admin ranks below tenant-auditor, which ranks below tenant-admin, which ranks below super-admin, for browser sessions", () => {
    const order: { source: 'browser'; tier: any }[] = [
      { source: 'browser', tier: 'theme-admin' },
      { source: 'browser', tier: 'tenant-auditor' },
      { source: 'browser', tier: 'tenant-admin' },
      { source: 'browser', tier: 'super-admin' },
    ];
    const tried = new Set<'user' | 'svcacct' | 'browser'>();
    const observedOrder: any[] = [];
    // Only one source ('browser') is available across all four candidates,
    // so simulate escalation one tier at a time by re-filtering `available`
    // down to whichever single candidate should be picked next.
    for (let i = 0; i < order.length; i++) {
      const remaining = order.filter((_, idx) => idx >= observedOrder.length);
      const picked = pickNextEscalationCandidate({
        available: remaining,
        tried,
      });
      observedOrder.push(picked.tier);
      tried.add(picked.source);
      // pickNextEscalationCandidate only tracks tried by source, not tier —
      // since there's one source here, simulate moving to the next tier by
      // only ever offering the next untried tier as "available".
      tried.delete(picked.source);
    }
    expect(observedOrder).toEqual([
      'theme-admin',
      'tenant-auditor',
      'tenant-admin',
      'super-admin',
    ]);
  });

  test('service account ranks between a browser session and a plain-user session', () => {
    const picked1 = pickNextEscalationCandidate({
      available: [
        { source: 'svcacct', tier: 'service-account' },
        { source: 'browser', tier: 'super-admin' },
      ],
      tried: new Set(),
    });
    // A super-admin browser session (rank 3) still ranks below svcacct
    // (rank 4) — even the most privileged browser tier is tried before
    // the service account.
    expect(picked1).toEqual({ source: 'browser', tier: 'super-admin' });

    const picked2 = pickNextEscalationCandidate({
      available: [
        { source: 'svcacct', tier: 'service-account' },
        { source: 'user', tier: 'tenant-admin' },
      ],
      tried: new Set(),
    });
    expect(picked2).toEqual({ source: 'svcacct', tier: 'service-account' });
  });
});
