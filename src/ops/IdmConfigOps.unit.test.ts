import { extractManagedObjectTypes } from './IdmConfigOps';

describe('managed-object type extraction', () => {
  test('validates, trims, deduplicates, and sorts names', () => {
    expect(
      extractManagedObjectTypes({
        objects: [
          { name: 'user' },
          { name: ' alpha_user ' },
          { name: 'user' },
          { name: '' },
          { name: 42 },
          null,
        ],
      })
    ).toEqual(['alpha_user', 'user']);
  });

  test.each([undefined, null, {}, { objects: null }, { objects: {} }])(
    'returns an empty list for malformed config: %p',
    (entity) => {
      expect(extractManagedObjectTypes(entity)).toEqual([]);
    }
  );
});