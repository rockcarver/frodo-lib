/**
 * Run tests
 *
 *        npm run test:only RequiredScopesOps
 */
import { assertHasRequiredScope, resolveAvailableScope } from './RequiredScopesOps';

function mockState(overrides: Record<string, any> = {}) {
  return {
    getAuthMode: () => undefined,
    getDeploymentType: () => 'cloud',
    ...overrides,
  } as any;
}

describe('RequiredScopesOps.resolveAvailableScope', () => {
  test('0: Method is implemented', () => {
    expect(resolveAvailableScope).toBeDefined();
  });

  test('1: Passes required scopes through unchanged outside cloud browser mode', () => {
    const state = mockState({ getAuthMode: () => 'noninteractive' });
    expect(
      resolveAvailableScope({
        requiredScopes: ['fr:idc:certificate:read'],
        state,
      })
    ).toBe('fr:idc:certificate:read');
  });

  test('2: Passes required scopes through unchanged in browser mode on a non-cloud deployment', () => {
    const state = mockState({
      getAuthMode: () => 'interactive',
      getDeploymentType: () => 'forgeops',
    });
    expect(
      resolveAvailableScope({ requiredScopes: ['fr:am:*'], state })
    ).toBe('fr:am:*');
  });

  test('3: Passes required scopes through when they are all within the cloud browser-mode allow-list', () => {
    const state = mockState({ getAuthMode: () => 'interactive' });
    expect(
      resolveAvailableScope({
        requiredScopes: ['fr:am:*', 'fr:idm:*'],
        state,
      })
    ).toBe('fr:am:* fr:idm:*');
  });

  test('4: Throws a clear error when a required scope is outside the cloud browser-mode allow-list', () => {
    const state = mockState({ getAuthMode: () => 'interactive' });
    expect(() =>
      resolveAvailableScope({
        requiredScopes: ['fr:idc:certificate:read'],
        state,
      })
    ).toThrow(/fr:idc:certificate:read/);
  });
});

describe('RequiredScopesOps.assertHasRequiredScope', () => {
  test('0: Method is implemented', () => {
    expect(assertHasRequiredScope).toBeDefined();
  });

  test('1: Is a no-op outside cloud, even with an insufficiently-scoped grant', () => {
    const state = mockState({ getDeploymentType: () => 'classic' });
    expect(() =>
      assertHasRequiredScope({
        requiredScopes: ['fr:am:*'],
        grantedScope: 'fr:idm:*',
        state,
      })
    ).not.toThrow();
  });

  test('2: Is a no-op when there is no granted scope to check (e.g. a plain session cookie)', () => {
    const state = mockState();
    expect(() =>
      assertHasRequiredScope({
        requiredScopes: ['fr:am:*'],
        grantedScope: undefined,
        state,
      })
    ).not.toThrow();
  });

  test('3: Passes when the granted scope exactly covers the required scope', () => {
    const state = mockState();
    expect(() =>
      assertHasRequiredScope({
        requiredScopes: ['fr:idm:*'],
        grantedScope: 'fr:am:* fr:idm:*',
        state,
      })
    ).not.toThrow();
  });

  test('4: Throws naming the missing scope when the granted scope does not cover it', () => {
    const state = mockState();
    expect(() =>
      assertHasRequiredScope({
        requiredScopes: ['fr:idc:esv:update'],
        grantedScope: 'fr:idm:*',
        state,
      })
    ).toThrow(/fr:idc:esv:update/);
  });

  test('5: A wildcard-granted scope covers a narrower required read scope', () => {
    const state = mockState();
    expect(() =>
      assertHasRequiredScope({
        requiredScopes: ['fr:idc:esv:read'],
        grantedScope: 'fr:idc:esv:*',
        state,
      })
    ).not.toThrow();
  });

  test('6: A wildcard-granted scope covers a narrower required update scope', () => {
    const state = mockState();
    expect(() =>
      assertHasRequiredScope({
        requiredScopes: ['fr:idc:esv:update'],
        grantedScope: 'fr:idc:esv:*',
        state,
      })
    ).not.toThrow();
  });

  test('7: A narrow granted scope does not satisfy a required wildcard scope', () => {
    const state = mockState();
    expect(() =>
      assertHasRequiredScope({
        requiredScopes: ['fr:idc:esv:*'],
        grantedScope: 'fr:idc:esv:read',
        state,
      })
    ).toThrow(/fr:idc:esv:\*/);
  });
});
