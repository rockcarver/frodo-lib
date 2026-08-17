import {
  matchSemanticIdentifiers,
  normalizeSemanticIdentifier,
} from '../index';

describe('semantic identifier normalization', () => {
  test.each([
    ['alphaOrgPrivileges', ['alpha', 'organization', 'privilege']],
    ['alpha organization privileges', ['alpha', 'organization', 'privilege']],
    ['alpha_organization', ['alpha', 'organization']],
    ['fieldPolicy/alpha_user', ['field', 'policy', 'alpha', 'user']],
    ['emailTemplate', ['email', 'template']],
    ['provisioner.openicf', ['provisioner', 'openicf']],
  ])('normalizes %s', (value, expected) => {
    expect(normalizeSemanticIdentifier(value)).toEqual(expected);
  });

  test('prefers the fully qualified live identifier', () => {
    expect(
      matchSemanticIdentifiers(
        ['default alpha organization privileges for members'],
        ['alphaOrgPrivileges', 'bravoOrgPrivileges', 'privilegeAssignments']
      ).map((match) => match.identifier)
    ).toEqual(['alphaOrgPrivileges']);
  });

  test('retains equally plausible live identifiers', () => {
    expect(
      matchSemanticIdentifiers(
        ['organization privileges'],
        ['alphaOrgPrivileges', 'bravoOrgPrivileges', 'privilegeAssignments']
      ).map((match) => match.identifier)
    ).toEqual(['alphaOrgPrivileges', 'bravoOrgPrivileges']);
  });
});
