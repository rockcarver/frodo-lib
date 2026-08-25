import { State } from '../shared/State';
import {
  extractManagedObjectTypes,
  importSubConfigEntity,
  readSubConfigEntity,
  removeSubConfigEntity,
} from './IdmConfigOps';

const state = { getDebugHandler: () => undefined } as unknown as State;

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

const refusesAsManagedSystemObjectType = {
  originalErrors: [
    expect.objectContaining({
      message: expect.stringMatching(/is a managed system object type/),
    }),
  ],
};

describe('managed system object type guard on the generic managed config path', () => {
  test.each(['svcacct', 'teammember'])(
    'readSubConfigEntity refuses managed system object type "%s"',
    async (name) => {
      await expect(
        readSubConfigEntity({ entityId: 'managed', name, state })
      ).rejects.toMatchObject(refusesAsManagedSystemObjectType);
    }
  );

  test.each(['svcacct', 'teammember'])(
    'importSubConfigEntity refuses managed system object type "%s"',
    async (name) => {
      await expect(
        importSubConfigEntity({
          entityId: 'managed',
          updatedSubConfigEntity: { name },
          options: { entitiesToImport: undefined, validate: false },
          state,
        })
      ).rejects.toMatchObject(refusesAsManagedSystemObjectType);
    }
  );

  test.each(['svcacct', 'teammember'])(
    'removeSubConfigEntity refuses managed system object type "%s"',
    async (name) => {
      await expect(
        removeSubConfigEntity({ entityId: 'managed', name, state })
      ).rejects.toMatchObject(refusesAsManagedSystemObjectType);
    }
  );
});